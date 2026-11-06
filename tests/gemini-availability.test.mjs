import test from 'node:test';
import assert from 'node:assert/strict';
import {geminiQuestions} from '../supabase/functions/_shared/gemini.ts';

test('indisponibilidade temporária usa outro Flash-Lite com a mesma referência e prazo', async t => {
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    calls.push({url,options});
    return calls.length===1 ? new Response(null,{status:503}) :
      Response.json({candidates:[{content:{parts:[{text:'questões'}]}}]});
  });
  const result=await geminiQuestions('test','gemini-3.5-flash-lite','instrução',{reference:'Tabela da cantina'});
  assert.equal(result,'questões');
  assert.match(calls[1].url,/gemini-3\.1-flash-lite/);
  assert.equal(calls[0].options.body,calls[1].options.body);
  assert.equal(calls[0].options.signal,calls[1].options.signal);
});
test('cota esgotada encerra a tentativa sem chamar outro modelo',async t=>{
  const mock=t.mock.method(globalThis,'fetch',async()=>Response.json({}, {status:429}));
  await assert.rejects(geminiQuestions('test','gemini-3.5-flash-lite','',{}),/cota/);
  assert.equal(mock.mock.callCount(),1);
});
