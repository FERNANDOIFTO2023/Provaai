import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { examAi } from '../supabase/functions/_shared/ai-fallback.ts';
import { groqQuestions, GROQ_MODEL } from '../supabase/functions/_shared/groq.ts';
import { generate } from '../supabase/functions/_shared/generate.ts';

const settings = { apiKey: 'gemini-test', groqApiKey: 'groq-test', model: 'gemini-3.5-flash-lite' };
const gemini = text => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
const groq = text => Response.json({ choices: [{ finish_reason: 'stop', message: { content: text } }] });

test('Gemini saudável não chama nem envia dados à Groq', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => { calls.push({ url, init }); return gemini('{}'); });
  const ask = examAi(settings);
  await ask('JSON', {}, 'generation');
  await ask('JSON', {}, 'review');
  assert.equal(calls.length, 2);
  assert.ok(calls.every(c => c.url.includes('googleapis.com')));
});

for (const failure of [429, 503, 500, 408, 401, 403, 404, 'network', 'timeout', 'body']) {
  test(`falha ${failure} aciona Groq uma vez, com o mesmo contexto e instruções`, async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      calls.push({ url, init });
      if (url.includes('groq.com')) return groq('{}');
      if (failure === 'network') throw new TypeError('fetch failed');
      if (failure === 'timeout') throw new DOMException('timed out', 'TimeoutError');
      if (failure === 'body') return new Response('invalid-json');
      return Response.json({ error: { message: 'Private provider details' } }, { status: failure });
    });
    const context = { subject: 'Ciências', topics: 'Fotossíntese', count: 1, reference: 'Folhas', exclude: [] };
    const ask = examAi(settings);
    assert.equal(await ask('Retorne JSON', context, 'generation'), '{}');
    assert.equal(calls.length, 2);
    const first = JSON.parse(calls[0].init.body), second = JSON.parse(calls[1].init.body);
    assert.equal(second.messages[0].content, first.systemInstruction.parts[0].text);
    assert.equal(second.messages[1].content, first.contents[0].parts[0].text);
    assert.equal(second.model, GROQ_MODEL);
    assert.equal(second.reasoning_effort, 'low');
    assert.equal(second.include_reasoning, false);
    assert.equal(calls[1].init.headers.Authorization, 'Bearer groq-test');
    assert.equal(calls[0].init.headers['x-goog-api-key'], 'gemini-test');
    assert.notEqual(calls[0].init.signal, calls[1].init.signal);
    // A próxima etapa não espera o provedor que acabou de falhar.
    await ask('Confira JSON', { questions: [] }, 'review');
    assert.equal(calls.length, 3);
    assert.match(calls[2].url, /groq.com/);
  });
}

test('pedido inválido ou bloqueio de conteúdo não tenta contornar a recusa com Groq', async t => {
  for (const response of [Response.json({}, { status: 400 }),
    Response.json({ promptFeedback: { blockReason: 'SAFETY' } }),
    Response.json({ candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: '{}' }] } }] })]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => response);
    await assert.rejects(examAi(settings)('JSON', {}, 'generation'));
    assert.equal(mock.mock.callCount(), 1);
    mock.mock.restore();
  }
});

test('ausência de chave Gemini usa apenas a reserva configurada', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async url => { assert.match(url, /groq.com/); return groq('{}'); });
  await examAi({ ...settings, apiKey: undefined })('JSON', {}, 'generation');
  assert.equal(mock.mock.callCount(), 1);
});

test('Groq com cota esgotada encerra sem repetir e sem expor a resposta privada', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async url => Response.json(
    { error: { message: 'PRIVATE key and context' } }, { status: url.includes('groq.com') ? 429 : 503 }));
  await assert.rejects(examAi(settings)('JSON', {}, 'generation'), error => {
    assert.match(error.message, /Groq.*limite/);
    assert.doesNotMatch(error.message, /PRIVATE|groq-test|gemini-test/);
    return true;
  });
  assert.equal(mock.mock.callCount(), 2);
});

test('Groq rejeita resposta truncada, vazia ou recusada', async t => {
  for (const choice of [{ finish_reason: 'length', message: { content: '{' } },
    { finish_reason: 'stop', message: { content: '' } },
    { finish_reason: 'content_filter', message: { content: '{}' } }]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ choices: [choice] }));
    await assert.rejects(groqQuestions('test', 'JSON', {}));
    mock.mock.restore();
  }
});

for (const reviewValid of [true, false]) {
  test(`falha na conferência mantém as questões do Gemini; revisão Groq válida=${reviewValid}`, async t => {
    const exam = { id: randomUUID(), subject: 'Ciências', topics: 'Fotossíntese', question_count: 1,
      profile_snapshot: { name: 'Nome privado', code: 'Código privado' },
      content: { instructions: '', questions: [], objectiveCount: 0 } };
    const content = { instructions: 'Responda.', questions: [{ type: 'essay', statement: 'Explique a fotossíntese.',
      options: [], answer: 'Produção de açúcares com luz.', objective: 'Compreender a fotossíntese', points: 10 }] };
    let saved, generated = 0, reviewed = 0, released = false;
    t.mock.method(globalThis, 'fetch', async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname === '/auth/v1/user') return Response.json({ id: 'teacher' });
      if (url.pathname.endsWith('/sala_generation_jobs')) { released ||= init.method === 'DELETE'; return Response.json({}); }
      if (url.pathname.endsWith('/sala_exams')) {
        if (init.method === 'PATCH') { saved = JSON.parse(init.body).content; return Response.json({ ...exam, content: saved }); }
        return Response.json(url.searchParams.get('select') === 'content' ? [] : exam);
      }
      const body = JSON.parse(init.body);
      const context = JSON.parse(url.hostname === 'api.groq.com' ? body.messages[1].content : body.contents[0].parts[0].text);
      assert.doesNotMatch(JSON.stringify(context), /Nome privado|Código privado/);
      if (!context.questions) { generated++; return gemini(JSON.stringify(content)); }
      assert.deepEqual(context.questions, content.questions);
      if (url.hostname !== 'api.groq.com') return Response.json({}, { status: 503 });
      reviewed++;
      return groq(JSON.stringify({ aligned: reviewValid, offTopicQuestions: reviewValid ? [] : [1], missingTopics: [] }));
    });
    const response = await generate(new Request('https://app.test/generate', { method: 'POST',
      headers: { authorization: 'Bearer test' }, body: JSON.stringify({ examId: exam.id }) }),
    { ...settings, provider: 'gemini', url: 'https://db.example.test', anonKey: 'test' });
    assert.equal(response.status, reviewValid ? 200 : 502, await response.text());
    assert.equal(generated, 1); assert.equal(reviewed, 1);
    if (reviewValid) assert.deepEqual(saved.questions, content.questions);
    else { assert.equal(saved, undefined); assert.equal(released, true); }
  });
}

test('requisição sem sessão não chama nenhum provedor', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected request'); });
  const response = await generate(new Request('https://app.test/generate', { method: 'POST' }),
    { ...settings, provider: 'gemini', url: 'https://db.example.test', anonKey: 'test' });
  assert.equal(response.status, 401);
  assert.equal(mock.mock.callCount(), 0);
});
