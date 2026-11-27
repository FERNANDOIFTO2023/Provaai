/*
 * Testes / exam-months
 * Verifica agrupamento mensal e busca no fuso de São Paulo.
 * Os cenários documentam comportamentos esperados. Ao mudar uma regra, confira primeiro se a
 * expectativa representa uma garantia que deve ser preservada.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { examMonths, examDays, examDate, regularExams } from '../lib/exam-library.ts';
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

test('pastas diárias respeitam Brasília, ordenam dias e preservam criação e entrada', () => {
  const base = demoData().exams[0];
  const dates = ['2026-11-28T02:59:59Z', '2026-11-28T03:00:00Z', '2026-11-27T12:00:00Z', '2025-12-31T23:00:00Z', 'invalid'];
  const exams = dates.map((created_at, index) => ({...base, id: String(index), created_at, updated_at: '2027-01-01T12:00:00Z'}));
  const original = structuredClone(exams);
  const groups = examDays(exams);
  assert.deepEqual(groups.map(group => group.key), ['2026-11-28', '2026-11-27', '2025-12-31', 'unknown']);
  assert.deepEqual(groups[1].exams.map(exam => exam.id), ['0', '2']);
  assert.equal(groups[1].label, '27/11/2026');
  assert.equal(groups[3].label, 'Data não informada');
  assert.deepEqual(exams, original);
  assert.deepEqual(examDays([]), []);
});

test('pastas coletivas recebem somente provas da turma e preservam provas individuais fora da lista', () => {
  const base = demoData().exams[0];
  const exams = [{...base, id: 'regular'}, {...base, id: 'individual', purpose: 'recovery' as const}, {...base, id: 'other', class_id: 'other'}];
  assert.deepEqual(examDays(regularExams(exams, base.class_id)).flatMap(group => group.exams.map(exam => exam.id)), ['regular']);
});
