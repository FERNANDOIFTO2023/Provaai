import test from 'node:test';
import assert from 'node:assert/strict';
import { approveSavedExam } from '../lib/exam-approval.ts';
import type { Exam } from '../lib/model.ts';

const saved = {
  id: 'exam-1', status: 'draft', subject: 'Matemática',
  content: { instructions: 'Calcule.', questions: [], mathReview: { version: 1 } },
} as unknown as Exam;

test('aprovação envia só identidade e status, sem reenviar o parecer ou o conteúdo', async () => {
  const confirmed = { ...saved, status: 'approved' as const };
  const result = await approveSavedExam(saved, async payload => {
    assert.deepEqual(payload, { id: saved.id, status: 'approved' });
    return confirmed;
  });
  assert.equal(result, confirmed);
});

test('resposta de rascunho não pode anunciar aprovação nem liberar download', async () => {
  await assert.rejects(approveSavedExam(saved, async () => saved), /aprovação não foi confirmada/);
});

test('confirmação de outra prova não libera o documento em revisão', async () => {
  await assert.rejects(approveSavedExam(saved, async () => ({ ...saved, id: 'other', status: 'approved' })), /aprovação não foi confirmada/);
});

test('falha da API é preservada sem inventar uma aprovação local', async () => {
  const error = new Error('Sessão expirada');
  await assert.rejects(approveSavedExam(saved, async () => { throw error; }), error);
  assert.equal(saved.status, 'draft');
});
