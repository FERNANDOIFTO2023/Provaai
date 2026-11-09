import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {generate} from '../supabase/functions/_shared/generate.ts';
test('PDF antigo nunca envia perguntas, texto extraído ou orientações do arquivo à IA',async t=>{
  const exam={id:randomUUID(),template_id:randomUUID(),question_count:1,subject:'Ciências',topics:'Fotossíntese',
    content:{questions:[],objectiveCount:0},profile_snapshot:{}};
  let calls=0;
  t.mock.method(globalThis,'fetch',async(input,init)=>{
    const url=new URL(input instanceof Request?input.url:input);
    if(url.pathname==='/auth/v1/user')return Response.json({id:'teacher'});
    if(url.pathname.endsWith('/sala_generation_jobs'))return Response.json({});
    if(url.pathname.endsWith('/sala_templates'))return Response.json({filename:'MODELO.PDF',processing_status:'ready',
      extracted_text:'PERGUNTAS ANTIGAS',reference_text:'INSTRUCAO DO PDF'});
    if(url.pathname.endsWith('/sala_exams'))return Response.json(init.method==='PATCH'?{...exam,content:JSON.parse(init.body).content}:url.searchParams.get('select')==='content'?[]:exam);
    const body=JSON.parse(init.body),context=JSON.parse(body.contents[0].parts[0].text);calls++;
    assert.doesNotMatch(JSON.stringify(body),/PERGUNTAS ANTIGAS|INSTRUCAO DO PDF/);
    if(!context.questions)assert.equal(context.reference,'');
    const text=JSON.stringify(context.questions?{aligned:true,offTopicQuestions:[],missingTopics:[]}:
      {instructions:'Responda.',questions:[{type:'essay',statement:'Explique a fotossíntese.',options:[],answer:'Luz e produção de açúcares.',objective:'Compreender',points:10}]});
    return Response.json({candidates:[{content:{parts:[{text}]}}]});
  });
  const response=await generate(new Request('https://app.test/api/generate',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({examId:exam.id})}),
    {url:'https://db.example.test',anonKey:'test',provider:'gemini',model:'test',apiKey:'test'});
  assert.equal(response.status,200,await response.text());assert.equal(calls,2);
});
