import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mistralQuestions,
  mistralPdf,
} from '../supabase/functions/sala-ai-mistral/mistral.ts';
test('envia contexto e exige JSON sem expor chave no corpo', async () => {
  const fake = (async (url, init) => {
    assert.equal(url, 'https://api.mistral.ai/v1/chat/completions');
    const body = JSON.parse(init!.body as string);
    assert.equal(body.response_format.type, 'json_object');
    assert.match(body.messages[1].content, /frações/);
    assert.ok(!(init!.body as string).includes('test-secret'));
    return Response.json({
      choices: [
        { finish_reason: 'stop', message: { content: '{"questions":[]}' } },
      ],
    });
  }) as typeof fetch;
  assert.equal(
    await mistralQuestions(
      'test-secret',
      'mistral-small-latest',
      'Retorne JSON',
      { topic: 'frações' },
      fake,
    ),
    '{"questions":[]}',
  );
});
test('OCR preserva todas as páginas e envia PDF privado inline', async () => {
  const fake = (async (url, init) => {
    assert.equal(url, 'https://api.mistral.ai/v1/ocr');
    const body = JSON.parse(init!.body as string);
    assert.equal(
      body.document.document_url,
      'data:application/pdf;base64,cGRm',
    );
    return Response.json({
      pages: [{ markdown: 'Primeira página' }, { markdown: 'Segunda página' }],
    });
  }) as typeof fetch;
  assert.equal(
    await mistralPdf('test-secret', 'mistral-ocr-latest', 'cGRm', fake),
    'Primeira página\n\nSegunda página',
  );
});
test('cota e acesso pago não acionam fallback nem revelam resposta do provedor', async () => {
  for (const status of [402, 429]) {
    let calls = 0;
    const fake = (async () => {
      calls++;
      return new Response('secret-provider-response', { status });
    }) as typeof fetch;
    await assert.rejects(
      mistralQuestions('test-secret', 'model', 'JSON', {}, fake),
      (e) =>
        e instanceof Error && !e.message.includes('secret-provider-response'),
    );
    assert.equal(calls, 1);
  }
});
test('resposta truncada e ausência de chave bloqueiam geração', async () => {
  await assert.rejects(
    mistralQuestions('', 'model', 'JSON', {}, async () => {
      throw new Error('Não deve chamar API');
    }),
    /MISTRAL_API_KEY/,
  );
  await assert.rejects(
    mistralQuestions('test', 'model', 'JSON', {}, (async () =>
      Response.json({
        choices: [{ finish_reason: 'length', message: { content: '{}' } }],
      })) as typeof fetch),
    /interrompida/,
  );
});
