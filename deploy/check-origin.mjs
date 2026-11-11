import { copyFile, mkdir, writeFile } from 'node:fs/promises';

const value = process.env.PROVAAI_ORIGIN;
if (!value) throw new Error('Configure PROVAAI_ORIGIN com a origem HTTPS da AWS neste ambiente da Vercel.');
const origin = new URL(value);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash ||
    !['/', '/producao', '/producao/'].includes(origin.pathname) || origin.hostname.endsWith('.vercel.app')) {
  throw new Error('Configure a origem HTTPS da AWS, com o prefixo /producao quando aplicável.');
}
const upstream = origin.href.replace(/\/$/, '');
const options = { redirect: 'error', signal: AbortSignal.timeout(15000) };
const [health, configuration] = await Promise.all([
  fetch(upstream + '/up', options),
  fetch(upstream + '/api/config', options),
]);
if (!health.ok || !configuration.ok) throw new Error('A origem não respondeu às verificações de saúde.');
const {backend, aiConfigured} = await configuration.json();
if (backend !== 'laravel') throw new Error('A origem não está servindo o backend Laravel.');
if (process.env.VERCEL_ENV === 'production' && aiConfigured !== true) {
  throw new Error('A origem de produção ainda não configurou a IA.');
}
const output = '.vercel/output';
await mkdir(output + '/static', {recursive: true});
await copyFile('public/favicon.svg', output + '/static/favicon.svg');
await writeFile(output + '/config.json', JSON.stringify({
  version: 3,
  routes: [
    {src: '/(?:api/.*)?', headers: {'Cache-Control': 'private, no-store'}, continue: true},
    {src: '/(.*)', dest: upstream + '/$1'},
  ],
}));
