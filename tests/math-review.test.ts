import test from 'node:test';
import assert from 'node:assert/strict';
import { currentMathResult } from '../lib/math-review.ts';
import type { ExamContent } from '../lib/exam.ts';

test('a math report is invalidated by edits, question reordering or subject changes', () => {
  const question = { statement: 'Calcule 2+3.', answer: '5', options: [], type: 'essay' as const, points: 1, objective: 'Somar' };
  const content: ExamContent = { instructions: 'Responda.', questions: [question], mathReview: {
    version: 1, subject: 'Matemática', instructions: 'Responda.',
    results: [{ status: 'verified', message: 'Conferido', input: { ...question } }],
  } };
  assert.equal(currentMathResult(content, 'Matemática', 0)?.status, 'verified');
  assert.equal(currentMathResult(content, 'Português', 0), undefined);
  assert.equal(currentMathResult({ ...content, instructions: 'Arredonde.' }, 'Matemática', 0), undefined);
  for (const edit of [{ answer: '6' }, { statement: 'Calcule 3+3.' }, { type: 'objective' as const }, { options: ['1'] }])
    assert.equal(currentMathResult({ ...content, questions: [{ ...question, ...edit }] }, 'Matemática', 0), undefined);
  assert.equal(currentMathResult(content, 'Matemática', 1), undefined);
});
