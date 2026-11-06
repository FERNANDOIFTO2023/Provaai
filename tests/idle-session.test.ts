import test from 'node:test';
import assert from 'node:assert/strict';
import { activityKey, idleStatus, readActivity, writeActivity, IDLE_LIMIT_MS, IDLE_WARNING_MS } from '../lib/idle-session.ts';

const start = 1_800_000_000_000;
const active = { lastActivity: start, ended: false };
const token = (sub: string, session_id: string, iat = 1) =>
  'header.' + Buffer.from(JSON.stringify({ sub, session_id, iat })).toString('base64url') + '.signature';

test('avisa dois minutos antes e encerra exatamente após 30 minutos', () => {
  assert.equal(idleStatus(active, start + IDLE_LIMIT_MS - IDLE_WARNING_MS - 1).phase, 'active');
  assert.deepEqual(idleStatus(active, start + IDLE_LIMIT_MS - IDLE_WARNING_MS), { phase: 'warning', remaining: 120_000 });
  assert.equal(idleStatus(active, start + IDLE_LIMIT_MS - 1).phase, 'warning');
  assert.equal(idleStatus(active, start + IDLE_LIMIT_MS).phase, 'expired');
});

test('reabrir depois de horas não reinicia o relógio salvo', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const key = activityKey(token('professor', 'sessao'))!;
  writeActivity(key, active, storage);
  assert.equal(idleStatus(readActivity(key, storage), start + 10 * 60_000).phase, 'active');
  assert.equal(idleStatus(readActivity(key, storage), start + 4 * 60 * 60_000).phase, 'expired');
  assert.equal(readActivity(key, storage)?.lastActivity, start);
});

test('renovação do token conserva a identidade; contas e novos logins ficam separados', () => {
  assert.equal(activityKey(token('a', 's1', 1)), activityKey(token('a', 's1', 2)));
  assert.notEqual(activityKey(token('a', 's1')), activityKey(token('a', 's2')));
  assert.notEqual(activityKey(token('a', 's1')), activityKey(token('b', 's1')));
  assert.equal(activityKey('inválido'), null);
});

test('tarefas adiam a saída sem renovar a inatividade; conclusão libera o encerramento', () => {
  const now = start + IDLE_LIMIT_MS + 60_000;
  assert.equal(idleStatus(active, now, true).phase, 'deferred');
  assert.equal(idleStatus(active, now, false).phase, 'expired');
  assert.equal(idleStatus({ lastActivity: now, ended: false }, now).phase, 'active');
  assert.equal(idleStatus({ ...active, ended: true }, now, true).phase, 'expired');
});

test('registros ausentes, corrompidos ou com relógio futuro exigem login', () => {
  assert.equal(idleStatus(null, start).phase, 'expired');
  assert.equal(idleStatus({ ...active, lastActivity: start + 1 }, start).phase, 'expired');
  const storage = { getItem: () => '{broken', setItem: () => {} };
  assert.equal(readActivity('broken', storage), null);
});

test('sincroniza renovação e encerramento entre leitores do mesmo armazenamento', () => {
  let saved: string | null = null;
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
  writeActivity('shared', active, storage);
  writeActivity('shared', { lastActivity: start + 29 * 60_000, ended: false }, storage);
  assert.equal(idleStatus(readActivity('shared', storage), start + 31 * 60_000).phase, 'active');
  writeActivity('shared', { lastActivity: start + 31 * 60_000, ended: true }, storage);
  assert.equal(idleStatus(readActivity('shared', storage), start + 31 * 60_000).phase, 'expired');
});

test('armazenamento bloqueado mantém somente o relógio em memória nesta aba', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); } };
  writeActivity('quota', active, storage);
  assert.deepEqual(readActivity('quota', storage), active);
  assert.equal(idleStatus(readActivity('quota', storage), start + IDLE_LIMIT_MS).phase, 'expired');
});
