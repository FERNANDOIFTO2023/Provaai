import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from '../lib/api-client.ts';

test('salvamento sem resposta tem prazo, interrompe a espera e permite nova tentativa', async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: '', querySelector: () => null } });
  try {
    let signal: AbortSignal | null | undefined;
    globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
      signal = init?.signal;
      signal?.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')), { once: true });
    });
    const result = await apiClient.from('sala_exams').update({ status: 'approved' }).eq('id', 'example').timeout(5).single();
    assert.equal(signal?.aborted, true);
    assert.equal(result.data, null);
    assert.equal(result.error?.code, 'request_timeout');
    assert.match(result.error!.message, /pode ter sido salvo/);
    globalThis.fetch = async () => new Response(JSON.stringify({ data: { id: 'example', status: 'approved' } }));
    const retry = await apiClient.from('sala_exams').update({ status: 'approved' }).eq('id', 'example').timeout(100).single();
    assert.equal(retry.error, null);
    assert.equal(retry.data.status, 'approved');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
