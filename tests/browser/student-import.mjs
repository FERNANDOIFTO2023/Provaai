/* Testes / importação no navegador. API simulada; parser e banco são cobertos no StudentImportTest. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { demoData } from '../../lib/model.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = resolve(root, 'docs/relatorios/2026-11-23-importacao-alunos');
await mkdir(artifacts, { recursive: true });
const publicDir = resolve(root, 'public');
const manifest = JSON.parse(await readFile(resolve(publicDir, 'build/manifest.json'), 'utf8'));
const entry = manifest['resources/js/app.tsx'];
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      return response.end(`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Importação de alunos — teste</title>${entry.css.map(css => `<link rel="stylesheet" href="/build/${css}">`).join('')}</head><body><div id="app"></div><script type="module" src="/build/${entry.file}"></script></body></html>`);
    }
    const path = resolve(publicDir, `.${decodeURIComponent(pathname)}`);
    if (!path.startsWith(publicDir + sep)) { response.writeHead(403); return response.end(); }
    response.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[extname(path)] || 'application/octet-stream');
    response.end(await readFile(path));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('provaai:activity:v1:visual:fixture', JSON.stringify({ lastActivity: Date.now(), ended: false })));
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const data = demoData();
    data.classes[2].archived_at = '2026-11-01T00:00:00Z';
    let reject = true, imports = 0, requests = 0, expectedClass = 'c1', importedName = 'Aluno Importado';
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const fulfill = json => route.fulfill({ json });
      if (path === '/api/auth/session') return fulfill({ session: { user: { id: 'visual', email: 'professor@example.test', user_metadata: {} }, access_token: `fixture.${Buffer.from(JSON.stringify({ sub: 'visual', session_id: 'fixture' })).toString('base64url')}.fixture` } });
      if (path === '/api/config') return fulfill({ aiConfigured: true });
      if (path === '/api/exam-batch') return fulfill({ batch: null });
      if (path === '/api/students/import') {
        requests++;
        const multipart = route.request().postDataBuffer().toString();
        assert.match(multipart, /name="file"; filename="modelo-alunos.xlsx"/);
        assert.ok(multipart.includes(`name="class_id"\r\n\r\n${expectedClass}\r\n`), 'Arquivo enviado para a turma escolhida');
        if (reject) return route.fulfill({ status: 422, json: { errors: [{ line: 3, message: 'Informe o nome do aluno.' }] } });
        const students = [{ line: 2, name: importedName, level: 'Intermediário', difficulties: 'Frações', criteria: 'Enunciados curtos' }];
        if (/name="preview"\r\n\r\n1/.test(multipart)) return fulfill({ students, count: 1 });
        imports++;
        await new Promise(resolve => setTimeout(resolve, 250));
        return route.fulfill({ status: 201, json: { count: 1, students: students.map(student => ({ ...student, id: `importado-${imports}`, class_id: expectedClass, code: 'A005', archived_at: null })) } });
      }
      if (path.startsWith('/api/data/')) {
        const table = path.split('/').pop();
        const rows = { sala_classes: data.classes, sala_students: data.students, sala_exams: [], sala_templates: [], sala_recovery_students: [], sala_copy_invitations: [], sala_exam_batches: null, sala_teacher_template_defaults: null };
        if (table in rows) return fulfill({ data: rows[table] });
      }
      errors.push(`Unexpected request: ${path}`);
      return route.fulfill({ status: 500, json: { error: 'Unexpected fixture request' } });
    });
    await page.goto(origin);
    await page.getByRole('button', { name: 'Editar turma 7º ano A', exact: true }).waitFor();
    const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
    if (await menu.isVisible()) await menu.click();
    await page.locator('.sidebar').getByRole('button', { name: /^Alunos(?:\s*\d+)?$/ }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Modelo Excel' }).click()]);
    assert.equal(download.suggestedFilename(), 'modelo-alunos.xlsx');
    assert.equal((await readFile(await download.path())).subarray(0, 2).toString(), 'PK');
    await page.getByRole('button', { name: 'Importar alunos', exact: true }).click();
    const check = page.getByRole('button', { name: 'Conferir arquivo', exact: true });
    assert.equal(await check.isDisabled(), true);
    const target = page.getByLabel('1. Turma de destino');
    assert.equal(await target.locator('option').count(), 3, 'Turma arquivada indisponível');
    await target.selectOption('c1');
    const file = page.getByLabel('2. Modelo preenchido');
    await file.setInputFiles({ name: 'errado.csv', mimeType: 'text/csv', buffer: Buffer.from('Nome') });
    await page.getByRole('alert').filter({ hasText: 'Escolha um arquivo .xlsx' }).waitFor();
    assert.equal(requests, 0);
    await file.setInputFiles(resolve(publicDir, 'modelos/modelo-alunos.xlsx'));
    await check.click();
    await page.getByRole('alert').filter({ hasText: 'Linha 3: Informe o nome' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Confirmar importação/ }).count(), 0);
    reject = false;
    await check.click();
    await page.getByRole('region', { name: 'Prévia dos alunos' }).waitFor();
    assert.equal(imports, 0, 'Prévia não confirma');
    await target.selectOption('c2');
    assert.equal(await page.getByRole('region', { name: 'Prévia dos alunos' }).count(), 0);
    await target.selectOption('c1');
    await check.click();
    await page.getByRole('region', { name: 'Prévia dos alunos' }).waitFor();
    await file.setInputFiles([]);
    await file.setInputFiles(resolve(publicDir, 'modelos/modelo-alunos.xlsx'));
    assert.equal(await page.getByRole('region', { name: 'Prévia dos alunos' }).count(), 0, 'Troca de arquivo invalida prévia');
    await check.click();
    await page.getByRole('region', { name: 'Prévia dos alunos' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('.student-import').screenshot({ path: resolve(artifacts, `previa-${width}.png`) });
    const confirm = page.getByRole('button', { name: 'Confirmar importação de 1 aluno', exact: true });
    await confirm.click();
    assert.equal(await page.getByRole('button', { name: 'Cadastrando…' }).isDisabled(), true);
    await page.getByRole('status').filter({ hasText: '1 aluno cadastrado' }).waitFor();
    assert.equal(imports, 1);
    assert.match(await page.locator('.directory-card').filter({ hasText: 'Aluno Importado' }).innerText(), /A005/);
    assert.equal(await file.inputValue(), '');
    // Acesso direto pelo cartão: outra turma fica fixada e recebe o novo aluno.
    if (await menu.isVisible()) await menu.click();
    await page.locator('.sidebar').getByRole('button', { name: 'Minhas turmas', exact: true }).click();
    const room = data.classes[1];
    expectedClass = room.id; importedName = 'Aluno via cartão';
    await page.getByRole('button', { name: `Importar alunos para ${room.name}`, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.equal(await dialog.getByLabel('1. Turma de destino').inputValue(), room.id);
    assert.equal(await dialog.getByLabel('1. Turma de destino').isDisabled(), true);
    assert.equal(await dialog.getByRole('link', { name: 'Modelo Excel' }).isVisible(), true);
    await dialog.getByLabel('2. Modelo preenchido').setInputFiles(resolve(publicDir, 'modelos/modelo-alunos.xlsx'));
    await dialog.getByRole('button', { name: 'Conferir arquivo' }).click();
    await dialog.getByRole('region', { name: 'Prévia dos alunos' }).waitFor();
    await dialog.screenshot({ path: resolve(artifacts, `cartao-turma-${width}.png`) });
    await dialog.getByRole('button', { name: 'Confirmar importação de 1 aluno', exact: true }).click();
    await dialog.getByRole('status').filter({ hasText: `1 aluno cadastrado em ${room.name}` }).waitFor();
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
    const card = page.locator('.class-card').filter({ has: page.getByRole('button', { name: `Abrir turma ${room.name}`, exact: true }) });
    await card.waitFor();
    assert.match(await card.locator('.class-count').innerText(), /3 alunos/);
    await page.locator('.class-grid').screenshot({ path: resolve(artifacts, `cartoes-${width}.png`) });

    // O acesso na página da turma também fixa o destino e abre sem rascunhos anteriores.
    const firstRoom = data.classes[0];
    expectedClass = firstRoom.id; importedName = 'Aluno dentro da turma';
    await page.getByRole('button', { name: `Abrir turma ${firstRoom.name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Importar alunos', exact: true }).click();
    assert.equal(await dialog.getByLabel('1. Turma de destino').inputValue(), firstRoom.id);
    assert.equal(await dialog.getByLabel('2. Modelo preenchido').inputValue(), '');
    await dialog.getByLabel('2. Modelo preenchido').setInputFiles(resolve(publicDir, 'modelos/modelo-alunos.xlsx'));
    await dialog.getByRole('button', { name: 'Conferir arquivo' }).click();
    await dialog.getByRole('button', { name: 'Confirmar importação de 1 aluno', exact: true }).click();
    await dialog.getByRole('status').filter({ hasText: `1 aluno cadastrado em ${firstRoom.name}` }).waitFor();
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('heading', { name: `${firstRoom.name}.`, exact: true }).waitFor();
    assert.match(await page.locator('.table-wrap').innerText(), /Aluno dentro da turma/);
    await page.goBack();
    await page.getByRole('button', { name: `Abrir turma ${firstRoom.name}`, exact: true }).waitFor();
    await page.goForward();
    await page.getByRole('heading', { name: `${firstRoom.name}.`, exact: true }).waitFor();
    assert.equal(await dialog.count(), 0, 'Avançar não reabre a importação concluída');
    assert.equal(imports, 3);
    await page.getByRole('button', { name: 'Todas as turmas', exact: true }).click();
    await page.getByLabel('Status das turmas').selectOption('inactive');
    const archived = data.classes[2];
    assert.equal(await page.getByRole('button', { name: `Importar alunos para ${archived.name}`, exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: `Abrir turma ${archived.name}`, exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Importar alunos', exact: true }).isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: importação em Alunos, cartão e página da turma; destino fixo, atualização e histórico`);
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
