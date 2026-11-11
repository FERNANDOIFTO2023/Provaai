import { copyFile, mkdir } from 'node:fs/promises';

const origin = new URL(process.env.PROVAAI_ORIGIN);
const options = { redirect: 'error', signal: AbortSignal.timeout(15000) };
const [health, configuration] = await Promise.all([
  fetch(new URL('/up', origin), options),
  fetch(new URL('/api/config', origin), options),
]);
if (!health.ok || !configuration.ok) throw new Error('A origem não respondeu às verificações de saúde.');
const {backend, aiConfigured} = await configuration.json();
if (backend !== 'laravel') throw new Error('A origem não está servindo o backend Laravel.');
if (process.env.VERCEL_ENV === 'production' && aiConfigured !== true) {
  throw new Error('A origem de produção ainda não configurou a IA.');
}
await mkdir('.provaai-vercel', {recursive: true});
await copyFile('public/favicon.svg', '.provaai-vercel/favicon.svg');
