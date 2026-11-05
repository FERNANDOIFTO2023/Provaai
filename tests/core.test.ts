import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  demoData,
  examContentSchema,
  duplicateQuestions,
} from '../lib/model.ts';
import { examFile } from '../lib/export.ts';
test('validação rejeita resposta objetiva fora das alternativas', () => {
  const c = structuredClone(demoData().exams[0].content);
  c.questions[0].answer = 'inexistente';
  assert.equal(examContentSchema.safeParse(c).success, false);
});
test('questões repetidas são detectadas com espaços e caixa diferentes', () => {
  const c = structuredClone(demoData().exams[0].content);
  const other = structuredClone(c);
  other.questions[0].statement =
    '  ' + other.questions[0].statement.toUpperCase() + '  ';
  assert.equal(duplicateQuestions(c, [other]), true);
});
test('prova não aprovada não pode ser exportada', async () => {
  await assert.rejects(examFile(demoData().exams[0], 'pdf'), /aprove/);
});
test('DOCX editável não contém gabarito e arquivo docente contém respostas', async () => {
  const e = demoData().exams[0];
  e.status = 'approved';
  const student = await JSZip.loadAsync(
    await (await examFile(e, 'docx')).arrayBuffer(),
  );
  const text = await student.file('word/document.xml')!.async('string');
  assert.ok(text.includes('Ana Clara Martins'));
  assert.ok(!text.includes('Usar denominador 6'));
  const teacher = await JSZip.loadAsync(
    await (await examFile(e, 'docx', true)).arrayBuffer(),
  );
  assert.ok(
    (await teacher.file('word/document.xml')!.async('string')).includes(
      'Usar denominador 6',
    ),
  );
});
test('PDF aprovado gera arquivo válido', async () => {
  const e = demoData().exams[0];
  e.status = 'approved';
  const pdf = await examFile(e, 'pdf');
  assert.equal((await pdf.text()).slice(0, 5), '%PDF-');
  assert.ok(pdf.size > 1000);
});
