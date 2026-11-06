import test from 'node:test';
import assert from 'node:assert/strict';
import { nextStudentCode, saveWithStudentCode } from '../lib/student-code.ts';

test('código avança na turma sem reutilizar números e aceita códigos legados', () => {
  assert.equal(nextStudentCode([]), 'A001');
  assert.equal(nextStudentCode(['A001', 'A003', 'matricula-antiga', ' a010 ']), 'A011');
  assert.equal(nextStudentCode(['A999']), 'A1000');
});

test('confirma o código sugerido e vincula ao aluno salvo', async () => {
  const saved = await saveWithStudentCode('A003', async () => ['A001', 'A002'],
    async code => ({ id: 'student-1', class_id: 'class-1', code }));
  assert.equal(saved.code, 'A003');
  assert.equal(saved.student.code, 'A003');
  assert.equal(saved.student.id, 'student-1');
});

test('código ocupado por cadastro simultâneo é substituído sem intervenção do professor', async () => {
  const used = ['A001'];
  const attempts: string[] = [];
  const result = await saveWithStudentCode('A002', async () => [...used], async code => {
    attempts.push(code);
    if (attempts.length === 1) { used.push(code); throw { code: '23505' }; }
    used.push(code);
    return { code };
  });
  assert.deepEqual(attempts, ['A002', 'A003']);
  assert.equal(result.student.code, 'A003');
});

test('códigos de alunos arquivados continuam reservados e sugestões vencidas são atualizadas', async () => {
  const result = await saveWithStudentCode('A002', async () => ['A001', 'A002', 'A004'],
    async code => ({ code }));
  assert.equal(result.code, 'A005');
});

test('turmas independentes podem começar com o mesmo código', async () => {
  for (const classId of ['class-1', 'class-2']) {
    const result = await saveWithStudentCode('A001', async () => [], async code => ({ classId, code }));
    assert.deepEqual(result.student, { classId, code: 'A001' });
  }
});

test('erros de permissão não são repetidos como se fossem colisões', async () => {
  let attempts = 0;
  await assert.rejects(saveWithStudentCode('A001', async () => [], async () => {
    attempts++; throw Object.assign(new Error('Sem acesso'), { code: '42501' });
  }), /Sem acesso/);
  assert.equal(attempts, 1);
});

test('limita as tentativas em caso de colisões persistentes', async () => {
  let attempts = 0;
  await assert.rejects(saveWithStudentCode('A001', async () => [], async () => {
    attempts++; throw { code: '23505' };
  }), /Tente salvar novamente/);
  assert.equal(attempts, 5);
});
