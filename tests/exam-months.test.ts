import test from 'node:test';
import assert from 'node:assert/strict';
import { examMonths, examDate } from '../lib/exam-library.ts';
import { demoData } from '../lib/model.ts';
test('organiza meses e anos do mais recente para o mais antigo sem alterar a lista',()=>{
  const e=demoData().exams[0];
  const list=['2025-11-12T12:00:00Z','2026-10-31T23:00:00Z','2026-11-01T02:00:00Z','2026-11-02T12:00:00Z']
    .map((created_at,i)=>({...e,id:String(i),created_at}));
  const groups=examMonths(list);
  assert.deepEqual(groups.map(g=>g.key),['2026-11','2026-10','2025-11']);
  assert.deepEqual(groups[1].exams.map(e=>e.id),['2','1']);
  assert.equal(groups[0].label,'novembro de 2026');
  assert.equal(examDate(list[2].created_at),'31/10/2026');
  assert.equal(list[0].id,'0');
  assert.deepEqual(examMonths([]),[]);
});
test('data inválida não derruba a lista nem perde a prova',()=>{
  const e={...demoData().exams[0],created_at:'invalid'};
  assert.equal(examMonths([e])[0].label,'Data não informada');
  assert.equal(examDate(e.created_at),'Data não informada');
});
