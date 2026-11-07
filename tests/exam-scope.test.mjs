import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {generate} from '../supabase/functions/_shared/generate.ts';
import {checkExamScope} from '../supabase/functions/_shared/exam-scope.ts';

const content = statement => ({instructions:'Responda.',questions:[{
  statement,type:'essay',options:[],answer:'Resposta esperada',objective:'Aplicar o conceito',points:10,
}]});
const settings = {url:'https://db.example.test',anonKey:'test',apiKey:'fake',model:'test'};

for (const purpose of ['regular','recovery']) for (const provider of ['gemini','mistral']) {
  test(`${purpose}/${provider}: mesmo aluno, prova A e depois B mantêm seus próprios pedidos`, async t => {
    const common={class_id:randomUUID(),student_id:randomUUID(),title:'Avaliação',purpose,
      question_count:1,template_id:randomUUID(),
      profile_snapshot:{difficulties:'Somar frações',criteria:'Enunciados curtos',level:'Intermediário'},
      content:{instructions:'',questions:[],objectiveCount:0}};
    const exams=[
      {...common,id:randomUUID(),subject:'Matemática',topics:'Adição de frações'},
      {...common,id:randomUUID(),subject:'Ciências',topics:'Fotossíntese'},
      {...common,id:randomUUID(),subject:'Ciências',topics:'Sistema digestório'},
    ];
    const saved=new Map(); const contexts=[]; let current;
    t.mock.method(globalThis,'fetch',async(input,init)=>{
      const url=new URL(input instanceof Request?input.url:input);
      if(url.pathname==='/auth/v1/user') return Response.json({id:'teacher'});
      if(url.pathname.endsWith('/sala_generation_jobs')) return Response.json({});
      if(url.pathname.endsWith('/sala_templates')) return Response.json({processing_status:'ready',
        reference_text:'Exercícios de matemática',extracted_text:'Calcule 1/2 + 1/4. Mostre o cálculo.'});
      if(url.pathname.endsWith('/sala_exams')) {
        if(init.method==='PATCH') {
          const record={...current,content:JSON.parse(init.body).content};saved.set(current.id,record);
          return Response.json(record);
        }
        if(url.searchParams.get('select')==='content') {
          assert.equal(url.searchParams.get('subject'),'eq.'+current.subject);
          assert.equal(url.searchParams.get('topics'),'eq.'+current.topics);
          assert.equal(url.searchParams.get(purpose==='recovery'?'student_id':'title'),'eq.'+current[purpose==='recovery'?'student_id':'title']);
          return Response.json([...saved.values()].filter(e=>e.subject===current.subject&&e.topics===current.topics));
        }
        current=exams.find(e=>'eq.'+e.id===url.searchParams.get('id'));
        return Response.json(saved.get(current.id)??current);
      }
      assert.match(url.hostname,/^(api\.mistral\.ai|generativelanguage\.googleapis\.com)$/);
      const body=JSON.parse(init.body);
      const context=JSON.parse(provider==='gemini'?body.contents[0].parts[0].text:body.messages[1].content);
      const instruction=provider==='gemini'?body.systemInstruction.parts[0].text:body.messages[0].content;
      assert.equal(context.subject,current.subject);assert.equal(context.topics,current.topics);
      let text;
      if(context.questions){
        assert.deepEqual(Object.keys(context).sort(),['instructions','questions','subject','topics']);
        assert.equal(context.questions[0].statement,'Explique: '+current.topics);
        text=JSON.stringify({aligned:true,offTopicQuestions:[],missingTopics:[]});
      }else{
        contexts.push(context);
        assert.deepEqual(context.exclude,[]);
        assert.match(instruction,/Ignore dificuldades e critérios de outras matérias/);
        assert.match(instruction,/Se o modelo tratar de outra matéria, adapte/);
        text=JSON.stringify(content('Explique: '+current.topics));
      }
      return Response.json(provider==='gemini'?{candidates:[{content:{parts:[{text}]}}]}:{choices:[{message:{content:text}}]});
    });
    for(const exam of exams){
      const response=await generate(new Request('http://localhost/api/generate',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({examId:exam.id})}),{...settings,provider});
      assert.equal(response.status,200,await response.text());
    }
    assert.equal(saved.size,3);assert.equal(contexts.length,3);
    assert.equal(saved.get(exams[0].id).content.questions[0].statement,'Explique: Adição de frações');
    assert.equal(saved.get(exams[1].id).content.questions[0].statement,'Explique: Fotossíntese');
    assert.equal(saved.get(exams[2].id).content.questions[0].statement,'Explique: Sistema digestório');
    // A retomada de um pedido já concluído é idempotente, sem gerar outra prova.
    const response=await generate(new Request('http://localhost/api/generate',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({examId:exams[1].id})}),{...settings,provider});
    assert.equal(response.status,200);assert.equal(contexts.length,3);
  });
}

for(const review of [{aligned:false,offTopicQuestions:[1],missingTopics:['Fotossíntese']},
  {aligned:true,offTopicQuestions:[1],missingTopics:[]},
  {aligned:true,offTopicQuestions:[],missingTopics:['Fotossíntese']},{}]) {
  test('conferência rejeita retorno fora do pedido ou incompleto: '+JSON.stringify(review),()=>{
    assert.throws(()=>checkExamScope(JSON.stringify(review),1));
  });
}

test('questão sobre A em pedido B não é salva e libera o rascunho para nova tentativa',async t=>{
  const exam={id:randomUUID(),subject:'Ciências',topics:'Fotossíntese',question_count:1,
    content:{questions:[],objectiveCount:0},profile_snapshot:{}};
  let saved=false,released=false,calls=0;
  t.mock.method(globalThis,'fetch',async(input,init)=>{
    const url=new URL(input instanceof Request?input.url:input);
    if(url.pathname==='/auth/v1/user') return Response.json({id:'teacher'});
    if(url.pathname.endsWith('/sala_generation_jobs')) {released ||= init.method==='DELETE';return Response.json({});}
    if(url.pathname.endsWith('/sala_exams')) {
      saved ||= init.method==='PATCH';
      return Response.json(url.searchParams.get('select')==='content'?[]:exam);
    }
    const context=JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);calls++;
    const text=JSON.stringify(context.questions
      ? {aligned:false,offTopicQuestions:[1],missingTopics:['Fotossíntese']}
      : content('Quanto é 1/2 + 1/4?'));
    return Response.json({candidates:[{content:{parts:[{text}]}}]});
  });
  const response=await generate(new Request('http://localhost/api/generate',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({examId:exam.id})}),{...settings,provider:'gemini'});
  assert.equal(response.status,502);assert.match(await response.text(),/não correspondeu/);
  assert.equal(saved,false);assert.equal(released,true);assert.equal(calls,2);
});

test('banco salva matéria e conteúdos próprios nos dois fluxos, sem alterar a turma ou provas antigas',async()=>{
  const db=new PGlite(); const file=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select current_setting('test.uid')::uuid$$;
      grant usage on schema auth to authenticated;`);
    const schema=await file('public/schema.sql');
    await db.exec(schema.slice(0,schema.indexOf('insert into storage.buckets'))+'commit;');
    await db.exec("alter table sala_templates add processing_status text default 'ready';");
    for(const name of ['20261105162821_teacher_template_defaults','20261105220532_teacher_exam_batch',
      '20261105235000_recovery_and_archived_students','20261106161318_reactivate_student_in_class',
      '20261106181131_class_lifecycle_and_copies','20261106235019_exam_request_subject'])
      await db.exec(await file('supabase/migrations/'+name+'.sql'));
    const user=randomUUID(),room=randomUUID(),student=randomUUID();
    await db.query('insert into auth.users(id) values($1)',[user]);
    await db.query("insert into sala_classes(id,user_id,name,grade,subject) values($1,$2,'Turma','7','Matemática')",[room,user]);
    await db.query("insert into sala_students(id,user_id,class_id,name,code) values($1,$2,$3,'Aluno','A001')",[student,user,room]);
    await db.query('insert into sala_recovery_students(user_id,student_id) values($1,$2)',[user,student]);
    await db.exec('set role authenticated');await db.query("select set_config('test.uid',$1,false)",[user]);
    const input={classId:room,students:[student],title:'Avaliação',topics:'Frações',count:1,objectiveCount:0,choice:'builtin'};
    const start=value=>db.query('select sala_begin_exam_batch($1)',[JSON.stringify(value)]);
    const finish=async()=>{const step=(await db.query('select sala_claim_exam_step() as step')).rows[0].step;await db.query('select sala_finish_exam_step($1,null)',[step.lease]);return step.examId;};
    const ids=[];
    for(const purpose of ['regular','recovery']){
      await start({...input,purpose,subject:'Matemática'});ids.push(await finish());
      await start({...input,purpose,subject:'Ciências',topics:'Fotossíntese'});ids.push(await finish());
      await start({...input,purpose,subject:'Ciências',topics:'Sistema digestório'});ids.push(await finish());
    }
    assert.equal(new Set(ids).size,6);
    for(let i=0;i<ids.length;i++){
      const row=(await db.query('select subject,topics from sala_exams where id=$1',[ids[i]])).rows[0];
      assert.deepEqual(row,[{subject:'Matemática',topics:'Frações'},{subject:'Ciências',topics:'Fotossíntese'},{subject:'Ciências',topics:'Sistema digestório'}][i%3]);
    }
    assert.equal((await db.query('select subject from sala_classes where id=$1',[room])).rows[0].subject,'Matemática');
    for(const subject of ['',null,' '.repeat(10),'x'.repeat(81)]) await assert.rejects(start({...input,subject}),/Confira os dados/);
    await start(input);const legacy=await finish();
    assert.equal((await db.query('select subject from sala_exams where id=$1',[legacy])).rows[0].subject,'Matemática');
    // A repetição de um rascunho usa o pedido persistido, não novos campos arbitrários.
    await start({retry:ids[1],subject:'Geografia',topics:'Clima'});await finish();
    assert.deepEqual((await db.query('select subject,topics from sala_exams where id=$1',[ids[1]])).rows[0],{subject:'Ciências',topics:'Fotossíntese'});
  }finally{await db.close();}
});
