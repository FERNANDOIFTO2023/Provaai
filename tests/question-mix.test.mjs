import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../supabase/functions/_shared/generate.ts';

const examId = 'bc47c53e-fd32-482b-881b-bbdfe11d104a';
const settings = {
  url: 'https://db.example.test',
  anonKey: 'test',
  apiKey: 'fake',
  model: 'test',
};

for (const [provider, requested, returned, status] of [
  ['gemini', 0, 0, 200],
  ['mistral', 4, 4, 200],
  ['gemini', 3, 3, 200],
  ['mistral', 3, 2, 502],
  ['gemini', 5, 4, 422],
]) {
  test(`${provider}: pedido de ${requested} objetivas em quatro, retorno com ${returned}`, async (t) => {
    let saved,
      released = false,
      calls = 0;
    const exam = {
      id: examId,
      question_count: 4,
      profile_snapshot: {},
      content: { instructions: '', questions: [], objectiveCount: requested },
    };
    t.mock.method(globalThis, 'fetch', async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === '/auth/v1/user')
        return Response.json({ id: 'teacher' });
      if (url.pathname.endsWith('/sala_generation_jobs')) {
        if (init.method === 'DELETE') released = true;
        return Response.json({});
      }
      if (url.pathname.endsWith('/sala_exams')) {
        if (init.method === 'PATCH') {
          saved = JSON.parse(init.body).content;
          return Response.json({ ...exam, content: saved });
        }
        return Response.json(
          url.searchParams.get('select') === 'content' ? [] : exam,
        );
      }
      assert.match(
        url.hostname,
        /^(api\.mistral\.ai|generativelanguage\.googleapis\.com)$/,
      );
      calls++;
      const body = JSON.parse(init.body);
      const context = JSON.parse(
        provider === 'gemini'
          ? body.contents[0].parts[0].text
          : body.messages[1].content,
      );
      if (context.questions) {
        const text = JSON.stringify({aligned:true,offTopicQuestions:[],missingTopics:[]});
        return Response.json(provider === 'gemini'
          ? {candidates:[{content:{parts:[{text}]}}]}
          : {choices:[{message:{content:text}}]});
      }
      assert.deepEqual(context.distribution, {
        objective: requested,
        essay: 4 - requested,
      });
      const questions = Array.from({ length: 4 }, (_, i) => ({
        type: i < returned ? 'objective' : 'essay',
        statement: 'Questão ' + i,
        options: i < returned ? ['A', 'B', 'C', 'D'] : [],
        answer: 'A',
        objective: 'Teste',
        points: 2.5,
      }));
      const text = JSON.stringify({ instructions: '', questions });
      return Response.json(
        provider === 'gemini'
          ? { candidates: [{ content: { parts: [{ text }] } }] }
          : { choices: [{ message: { content: text } }] },
      );
    });
    const response = await generate(
      new Request('http://localhost/api/generate', {
        method: 'POST',
        headers: { authorization: 'Bearer test' },
        body: JSON.stringify({ examId }),
      }),
      { ...settings, provider },
    );
    assert.equal(response.status, status, await response.text());
    assert.equal(calls, status === 422 ? 0 : status === 200 ? 2 : 1);
    if (status === 200) assert.equal(saved.objectiveCount, requested);
    else assert.equal(saved, undefined);
    if (status === 502) assert.equal(released, true);
  });
}
