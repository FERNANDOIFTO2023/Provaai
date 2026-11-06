import test from 'node:test';
import assert from 'node:assert/strict';
import { createExportCache } from '../lib/export-cache.ts';

test('requisições simultâneas do mesmo arquivo compartilham a conversão', async () => {
  const cache = createExportCache();
  let calls = 0;
  const render = async () => { calls++; return new Uint8Array([1, 2]); };
  const [a, b] = await Promise.all([cache('professor:prova:v1', render), cache('professor:prova:v1', render)]);
  assert.deepEqual(a, b);
  await cache('professor:prova:v1', render);
  assert.equal(calls, 1);
  await cache('professor:prova:v2', render);
  await cache('outro-professor:prova:v1', render);
  await cache('professor:prova:v1:gabarito', render);
  assert.equal(calls, 4);
});

test('falha não fica no cache e uma nova tentativa pode concluir', async () => {
  const cache = createExportCache();
  await assert.rejects(cache('prova', async () => { throw new Error('Conversão falhou'); }));
  assert.deepEqual(await cache('prova', async () => new Uint8Array([7])), new Uint8Array([7]));
});

test('cache respeita tamanho máximo e validade', async () => {
  const cache = createExportCache(2);
  let calls = 0;
  const render = async () => { calls++; return new Uint8Array([1, 2]); };
  await cache('a', render);
  await cache('b', render);
  await cache('a', render);
  assert.equal(calls, 3);
  const expired = createExportCache(2, -1);
  await expired('a', render);
  await expired('a', render);
  assert.equal(calls, 5);
});
