/* Interface real em navegador isolado; API simulada. A extração real é testada no CLI e no Laravel. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { demoData } from '../../lib/model.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const publicDir = resolve(root, 'public');
const artifacts = resolve(root, 'docs/relatorios/2026-11-23-materiais-ui');
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
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  for (const width of [1440, 768, 375, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('provaai:activity:v1:visual:fixture', JSON.stringify({ lastActivity: Date.now(), ended: false })));
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const data = demoData();
    data.classes[2].archived_at = '2026-11-01T00:00:00Z';
    let materials = [], external = false, rejectUpload = false, postCount = 0, reads = 0;
    await page.route('**/api/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname;
      const fulfill = json => route.fulfill({ json });
      if (path === '/api/auth/session') return fulfill({ session: { user: { id: 'visual', email: 'professor@example.test', user_metadata: {} }, access_token: `fixture.${Buffer.from(JSON.stringify({ sub: 'visual', session_id: 'fixture' })).toString('base64url')}.fixture` } });
      if (path === '/api/config') return fulfill({ aiConfigured: true });
      if (path === '/api/exam-batch') return fulfill({ batch: null });
      if (/^\/api\/classes\/[^/]+\/materials/.test(path)) {
        if (req.method() === 'POST') {
          postCount++;
          assert.match(req.postDataBuffer().toString(), /name="file"; filename="aula\.pdf"/);
          if (rejectUpload) return route.fulfill({ status: 422, json: { errors: { file: ['PDF sem texto selecionável.'] } } });
          await new Promise(resolve => setTimeout(resolve, 300));
          const material = { id: 'm1', filename: 'aula.pdf', size: 100, extracted_text: 'Fotossíntese: plantas usam luz, água e gás carbônico para produzir açúcares.' };
          materials.push(material);
          return route.fulfill({ status: 201, json: { material } });
        }
        if (req.method() === 'PATCH') { external = req.postDataJSON().allow_external_sources; return fulfill({ allow_external_sources: external }); }
        if (req.method() === 'DELETE') { materials = []; return route.fulfill({ status: 204 }); }
        if (path.endsWith('/m1')) return route.fulfill({ body: await readFile(resolve(root, 'tests/fixtures/class-material.pdf')), headers: { 'Content-Disposition': 'attachment; filename="aula.pdf"', 'Content-Type': 'application/pdf' } });
        reads++;
        return fulfill({ materials, allow_external_sources: external, external_search_available: true });
      }
      if (path.startsWith('/api/data/')) {
        const table = path.split('/').pop();
        const rows = { sala_classes: data.classes, sala_students: data.students, sala_exams: [], sala_templates: [], sala_recovery_students: [], sala_copy_invitations: [], sala_exam_batches: null, sala_teacher_template_defaults: null };
        if (table in rows) return fulfill({ data: rows[table] });
      }
      errors.push(`Requisição inesperada: ${path}`);
      return route.fulfill({ status: 500, json: {} });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button', { name: `Abrir turma ${data.classes[0].name}`, exact: true }).click();
    assert.equal(reads, 0, 'Não faz leitura dos anexos ao abrir a turma');
    await page.getByRole('button', { name: 'Materiais da turma', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Materiais da turma', exact: true });
    const upload = panel.getByLabel('Anexar material de estudo');
    await panel.getByText('Sem materiais anexados,', { exact: false }).waitFor();
    const checkbox = panel.getByRole('checkbox');
    assert.equal(await checkbox.isChecked(), false);
    assert.match(await panel.innerText(), /animações avançadas/);
    await panel.screenshot({ path: resolve(artifacts, `vazio-${width}.png`) });
    const help = panel.getByText('Limites, leitura dos arquivos e uso nas provas', { exact: true });
    await help.focus();
    await page.keyboard.press('Enter');
    assert.equal(await panel.getByRole('heading', { name: 'O que pode ser lido', exact: true }).isVisible(), true);
    assert.match(await panel.innerText(), /60.000 caracteres/);
    await page.keyboard.press('Enter');
    assert.equal(await panel.getByRole('heading', { name: 'O que pode ser lido', exact: true }).isVisible(), false);
    const select = panel.getByRole('button', { name: 'Selecionar arquivo', exact: true });
    await select.focus();
    assert.equal(await select.evaluate(e => getComputedStyle(e).outlineStyle), 'solid', 'Foco visível no botão de envio');
    const buttonBox = await select.boundingBox();
    assert.ok(buttonBox.height >= 44, 'Alvo de toque com pelo menos 44 px');
    const file = { name: 'aula.pdf', mimeType: 'application/pdf', buffer: await readFile(resolve(root, 'tests/fixtures/class-material.pdf')) };
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
    await chooser.setFiles(file);
    await panel.getByRole('status').filter({ hasText: 'Processando' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Preparar provas', exact: true }).isDisabled(), true);
    await panel.getByRole('status').filter({ hasText: 'Material lido.' }).waitFor();
    assert.equal(await upload.inputValue(), '');
    assert.equal(postCount, 1);
    assert.match(await panel.locator('.materials-count').first().innerText(), /1 de 5/);
    assert.equal(await panel.getByText('Os anexos são opcionais.', { exact: true }).count(), 0);
    await panel.getByText('Conferir texto lido', { exact: true }).click();
    assert.match(await panel.locator('pre').innerText(), /Fotossíntese/);
    await panel.screenshot({ path: resolve(artifacts, `restrito-${width}.png`) });
    await checkbox.check();
    await panel.getByRole('status').filter({ hasText: 'Preferência salva' }).waitFor();
    assert.match(await panel.innerText(), /não estão nos arquivos anexados/);
    await panel.screenshot({ path: resolve(artifacts, `materiais-${width}.png`) });
    const overflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }).slice(0, 12).map(e => ({ tag: e.tagName, class: e.className, right: e.getBoundingClientRect().right })) }));
    assert.ok(overflow.scrollWidth <= overflow.width, `Sem rolagem horizontal: ${JSON.stringify(overflow)}`);
    await page.reload();
    await page.getByRole('button', { name: 'Materiais da turma', exact: true }).click();
    await panel.getByRole('link', { name: 'Baixar original' }).waitFor();
    assert.equal(await checkbox.isChecked(), true, 'Preferência mantida após recarregar');
    const [download] = await Promise.all([page.waitForEvent('download'), panel.getByRole('link', { name: 'Baixar original' }).click()]);
    assert.equal(download.suggestedFilename(), 'aula.pdf');
    await checkbox.uncheck();
    await panel.getByRole('status').filter({ hasText: 'Preferência salva' }).waitFor();
    assert.equal(external, false);
    rejectUpload = true;
    await upload.setInputFiles(file);
    await panel.getByRole('alert').waitFor();
    assert.match(await panel.getByRole('alert').innerText(), /sem texto/);
    assert.equal(await panel.locator('.materials-list li').count(), 1, 'Falha não acrescenta material');
    await panel.getByRole('button', { name: 'Remover material', exact: true }).click();
    await panel.getByRole('status').filter({ hasText: 'Material removido' }).waitFor();
    assert.equal(materials.length, 0);
    await page.getByRole('button', { name: 'Todas as turmas', exact: true }).click();
    await page.getByLabel('Status das turmas').selectOption('inactive');
    await page.getByRole('button', { name: `Abrir turma ${data.classes[2].name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Materiais da turma', exact: true }).click();
    await panel.getByText('Sem materiais anexados,', { exact: false }).waitFor();
    assert.equal(await upload.isDisabled(), true);
    assert.equal(await checkbox.isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: seletor por teclado, foco, ajuda expansível, anexar, prévia, baixar, pesquisa persistente, falha, remover, turma arquivada e responsividade`);
    await context.close();
  }
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
