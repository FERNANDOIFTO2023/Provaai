/* Painel real em navegador isolado; API simulada. Agregação e isolamento são testados no Laravel. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { demoDashboard, dashboardToday, shiftMonth, formatDay } from '../../lib/teacher-dashboard.ts';
import { demoData } from '../../lib/model.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const publicDir = resolve(root, 'public');
const artifacts = resolve(root, 'docs/relatorios/2026-11-23-area-professor');
await mkdir(artifacts, { recursive: true });
const entry = JSON.parse(await readFile(resolve(publicDir, 'build/manifest.json'), 'utf8'))['resources/js/app.tsx'];
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">${entry.css.map(css => `<link rel="stylesheet" href="/build/${css}">`).join('')}</head><body><div id="app"></div><script type="module" src="/build/${entry.file}"></script></body></html>`);
    }
    const file = resolve(publicDir, `.${decodeURIComponent(path)}`);
    if (!file.startsWith(publicDir + sep)) { res.writeHead(403); return res.end(); }
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
// As chamadas são simuladas; os testes PHP conferem agregação, autorização e telemetria reais.
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  for (const width of [1440, 768, 375, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: width === 1440 ? 'no-preference' : 'reduce' });
    await context.addInitScript(() => localStorage.setItem('provaai:activity:v1:visual:fixture', JSON.stringify({ lastActivity: Date.now(), ended: false })));
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [], data = demoData(), requests = [];
    let fail = false, empty = false;
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname;
      const fulfill = json => route.fulfill({ json });
      if (path === '/api/auth/session') return fulfill({ session: { user: { id: 'visual', email: 'professor@example.test', user_metadata: {} }, access_token: `fixture.${Buffer.from(JSON.stringify({ sub: 'visual', session_id: 'fixture' })).toString('base64url')}.fixture` } });
      if (path === '/api/config') return fulfill({ aiConfigured: true });
      if (path === '/api/exam-batch') return fulfill({ batch: null });
      if (path === '/api/teacher/dashboard') {
        requests.push(url.search);
        await new Promise(resolve => setTimeout(resolve, 120));
        if (fail) return route.fulfill({ status: 500, json: {} });
        const result = demoDashboard(url.searchParams.get('month'), url.searchParams.get('period'));
        if (empty) {
          for (const key of Object.keys(result.summary)) result.summary[key] = 0;
          for (const key of Object.keys(result.usage)) if (typeof result.usage[key] === 'number') result.usage[key] = 0;
          Object.assign(result.usage, { first_recorded_at: null, average_seconds: null, stages: {}, providers: {} });
          result.classes = [];
          result.daily = result.daily.map(day => ({ ...day, exams: 0, regular: 0, recovery: 0, tokens: 0 }));
        }
        return fulfill(result);
      }
      if (path.startsWith('/api/data/')) {
        const rows = { sala_classes: data.classes, sala_students: data.students, sala_exams: [], sala_templates: [], sala_recovery_students: [], sala_copy_invitations: [], sala_exam_batches: null, sala_teacher_template_defaults: null };
        if (path.split('/').pop() in rows) return fulfill({ data: rows[path.split('/').pop()] });
      }
      errors.push(`Requisição inesperada: ${path}`);
      return route.fulfill({ status: 500, json: {} });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button', { name: `Abrir turma ${data.classes[0].name}`, exact: true }).waitFor();
    const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole('button', { name: 'Área do professor', exact: true }).click();
    const panel = page.locator('.teacher-dashboard');
    await panel.getByRole('region', { name: 'Calendário de provas' }).waitFor();
    assert.equal(await page.locator('input[type=file]').count(), 0, 'Não oferece envio de foto');
    assert.match(requests[0], /period=month/);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.dashboard-bar-stack')).transform === 'none');
    const previous = shiftMonth(dashboardToday().slice(0, 7), -1);
    await panel.getByRole('button', { name: 'Mês anterior', exact: true }).click();
    await panel.getByRole('status').waitFor();
    await panel.locator('.dashboard-day').first().waitFor();
    assert.equal(await panel.getByLabel('Mês de referência').inputValue(), previous);
    // Se dia 1 for domingo a demonstração registra zero; selecione pela data, independentemente do dia da semana.
    const firstDay = panel.locator('.dashboard-day').first();
    await firstDay.focus();
    await page.keyboard.press('Enter');
    assert.equal(await firstDay.getAttribute('aria-pressed'), 'true');
    assert.equal(await firstDay.evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
    assert.match(await panel.locator('.dashboard-day-detail').innerText(), /01 de/);
    const light = await panel.locator('.dashboard-day.level-1').first().evaluate(e => getComputedStyle(e).backgroundColor);
    const dark = await panel.locator('.dashboard-day.level-4').first().evaluate(e => getComputedStyle(e).backgroundColor);
    assert.notEqual(light, dark, 'Intensidade visual varia com a quantidade');
    await panel.getByText('Ver valores do gráfico', { exact: true }).click();
    assert.equal(await panel.getByRole('table').isVisible(), true);
    await panel.getByText('Ver valores do gráfico', { exact: true }).click();
    await panel.getByLabel('Período', { exact: true }).selectOption('year');
    await panel.locator('.dashboard-chart-column').nth(11).waitFor();
    assert.equal(await panel.locator('.dashboard-chart-column').count(), 12);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: gráfico anual sem rolagem horizontal`);
    await panel.getByLabel('Período', { exact: true }).selectOption('quarter');
    await page.waitForFunction(() => document.querySelectorAll('.dashboard-chart-column').length === 3);
    await panel.getByLabel('Período', { exact: true }).selectOption('month');
    await panel.locator('.dashboard-chart-column').nth(3).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.dashboard-bar-stack')].every(e => getComputedStyle(e).transform === 'none'));
    await panel.screenshot({ path: resolve(artifacts, `painel-${width}.png`), animations: 'disabled' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: painel sem rolagem horizontal`);
    fail = true;
    await panel.getByRole('button', { name: 'Atualizar dados', exact: true }).click();
    await panel.getByRole('alert').waitFor();
    assert.equal(await panel.locator('.dashboard-stats').count(), 0, 'Falha não apresenta números antigos');
    fail = false; empty = true;
    await panel.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await panel.getByText('Nenhuma prova com questões neste período.', { exact: false }).waitFor();
    assert.equal(await panel.locator('.dashboard-stats article').nth(3).locator('strong').innerText(), '—');
    assert.match(await panel.locator('.dashboard-measurement-note').innerText(), /não foi registrado/);
    await panel.getByRole('button', { name: 'Ir para minhas turmas', exact: true }).click();
    await page.getByRole('button', { name: `Abrir turma ${data.classes[0].name}`, exact: true }).waitFor();
    await page.goBack();
    await panel.getByRole('heading', { name: 'Área do professor.', exact: true }).waitFor();
    await page.goForward();
    await page.getByRole('button', { name: `Abrir turma ${data.classes[0].name}`, exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: calendário, cores, teclado, períodos, tabela, erro/repetição, vazio, navegação e responsividade`);
    await context.close();
  }
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
