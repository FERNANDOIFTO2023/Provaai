import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {demoData} from '../lib/model.ts';
import {regularExams, searchStudents} from '../lib/exam-library.ts';

test('listas separam recuperação e turmas; busca ignora acentos e alunos retirados',()=>{
  const data=demoData();
  const exam=data.exams[0];
  const recovery={...exam,id:'recovery',purpose:'recovery'};
  assert.deepEqual(regularExams([...data.exams,recovery],exam.class_id),data.exams.filter(item=>item.class_id===exam.class_id));
  const students=[{...data.students[0],name:'João Ávila'}, {...data.students[1],name:'João retirado',archived_at:new Date().toISOString()}];
  assert.deepEqual(searchStudents(students,data.classes,'joao').map(s=>s.name),['João Ávila']);
});

test('recuperação preserva a turma, isola contas e exige um aluno ativo por prova',async()=>{
  const db=new PGlite();
  const file=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select current_setting('test.uid')::uuid$$;
      grant usage on schema auth to authenticated;`);
    const schema=await file('public/schema.sql');
    await db.exec(schema.slice(0,schema.indexOf('insert into storage.buckets'))+'commit;');
    await db.exec("alter table sala_templates add processing_status text default 'ready';");
    for(const migration of ['20261105162821_teacher_template_defaults.sql','20261105220532_teacher_exam_batch.sql','20261105235000_recovery_and_archived_students.sql'])
      await db.exec(await file('supabase/migrations/'+migration));
    const accounts=[];
    for(let i=0;i<2;i++) {
      const user=randomUUID(),room=randomUUID(),student=randomUUID(),other=randomUUID();
      await db.query('insert into auth.users values($1)',[user]);
      await db.query("insert into sala_classes(id,user_id,name,grade,subject,use_provaai_template) values($1,$2,'Turma','7','Matemática',true)",[room,user]);
      for(const id of [student,other])await db.query("insert into sala_students(id,user_id,class_id,name,code) values($1,$2,$3,'Aluno',$4)",[id,user,room,id.slice(0,8)]);
      accounts.push({user,room,student,other});
    }
    await db.exec('set role authenticated');
    const a=accounts[0],b=accounts[1];
    const login=account=>db.query("select set_config('test.uid',$1,false)",[account.user]);
    const input={classId:a.room,students:[a.student],title:'Recuperação',topics:'Frações',count:2,objectiveCount:1,choice:'inherit',purpose:'recovery'};
    const start=value=>db.query('select sala_begin_exam_batch($1)',[JSON.stringify(value)]);
    await login(a);
    await assert.rejects(start(input),/recuperação/);
    await db.query('insert into sala_recovery_students(student_id) values($1)',[a.student]);
    assert.equal((await db.query('select class_id from sala_students where id=$1',[a.student])).rows[0].class_id,a.room);
    await assert.rejects(db.query('insert into sala_recovery_students(student_id) values($1)',[b.student]));
    await assert.rejects(start({...input,students:[a.student,a.other]}),/recuperação/);
    await start(input);
    const exams=(await db.query('select id,student_id,purpose from sala_exams')).rows;
    assert.equal(exams.length,1);assert.equal(exams[0].purpose,'recovery');assert.equal(exams[0].student_id,a.student);
    assert.equal((await db.query('select use_provaai_template from sala_classes')).rows[0].use_provaai_template,true);
    await assert.rejects(start({...input,purpose:'regular'}),/andamento/);
    await login(b);
    assert.equal((await db.query('select * from sala_recovery_students')).rows.length,0);
    assert.equal((await db.query('select * from sala_exams')).rows.length,0);
    await login(a);
    const step=(await db.query('select sala_claim_exam_step() as step')).rows[0].step;
    await db.query('select sala_finish_exam_step($1,null)',[step.lease]);
    await db.query('update sala_students set archived_at=now() where id=$1',[a.student]);
    assert.equal((await db.query('select id from sala_exams')).rows.length,1);
    await assert.rejects(start(input),/alunos/);
    await assert.rejects(db.query('insert into sala_generation_jobs(exam_id) values($1)',[exams[0].id]),/Restaure/);
    await db.query('update sala_students set archived_at=null where id=$1',[a.student]);
    await start(input);
    assert.equal((await db.query('select id from sala_exams')).rows.length,2);
  } finally {await db.close();}
});
