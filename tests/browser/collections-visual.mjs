import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { build } from 'vite';
import { demoData } from '../../lib/model.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = resolve(root, 'docs/relatorios/2026-11-13-colecoes');
await mkdir(artifacts, { recursive: true });
await build({ root, logLevel: 'error' });
const publicDir = resolve(root, 'public');
const manifest = JSON.parse(await readFile(resolve(publicDir, 'build/manifest.json'), 'utf8'));
const entry = manifest['resources/js/app.tsx'];
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      return response.end(`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Provaai — testes visuais</title>${entry.css.map(css => `<link rel="stylesheet" href="/build/${css}">`).join('')}</head><body><div id="app"></div><script type="module" src="/build/${entry.file}"></script></body></html>`);
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
  browser = await chromium.launch({ headless: true, timeout: 20000, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    // Only a synthetic activity marker for this isolated fixture session.
    await context.addInitScript(() => localStorage.setItem('provaai:activity:v1:visual:fixture', JSON.stringify({ lastActivity: Date.now(), ended: false })));
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const data = demoData();
    data.students[1].name = 'Bruno Henrique Costa de Albuquerque e Vasconcelos';
    data.exams = [
      { ...data.exams[0], purpose: 'recovery', title: 'Frações e equivalência', status: 'approved', created_at: '2026-11-10T12:00:00Z' },
      { ...data.exams[0], id: 'e2', purpose: 'recovery', title: 'Operações no cotidiano', status: 'draft', created_at: '2026-11-12T12:00:00Z' },
    ];
    let selected = 'word';
    let permissionError = false;
    const members = ['s1', 's2'];
    const templates = [
      { id: 'word', name: 'Cabeçalho da escola', filename: 'cabecalho-escola.docx', reference_text: '', extracted_text: 'Escola · Nome do aluno · Data', processing_status: 'ready' },
      { id: 'pdf', name: 'Avaliação de Matemática', filename: 'avaliacao-matematica.pdf', reference_text: '', processing_status: 'ready' },
      { id: 'pending', name: 'Modelo interdisciplinar com nome longo para todas as áreas de conhecimento', filename: 'modelo_interdisciplinar_segundo_semestre.docx', reference_text: '', processing_status: 'pending' },
      { id: 'error', name: 'Arquivo para revisar', filename: 'arquivo-incompleto.pdf', reference_text: '', processing_status: 'failed', processing_error: 'Não foi possível ler o arquivo. Envie o modelo novamente.' },
    ].map(template => ({ ...template, user_id: 'visual', path: `visual/${template.filename}`, created_at: '2026-11-01T12:00:00Z' }));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const body = route.request().postDataJSON();
      const fulfill = json => route.fulfill({ json });
      if (path === '/api/auth/session') return fulfill({ session: { user: { id: 'visual', email: 'professor@example.test', user_metadata: {} }, access_token: `fixture.${Buffer.from(JSON.stringify({ sub: 'visual', session_id: 'fixture' })).toString('base64url')}.fixture` } });
      if (path === '/api/config') return fulfill({ aiConfigured: true });
      if (path === '/api/exam-batch') return fulfill({ batch: null });
      if (path.startsWith('/api/data/')) {
        const table = path.split('/').pop();
        if (table === 'sala_exam_batches' && body.op === 'select') return fulfill({ data: null });
        if (table === 'sala_recovery_students' && body.op === 'upsert') {
          members.push(body.values.student_id); return fulfill({ data: null });
        }
        if (table === 'sala_teacher_template_defaults') {
          if (body.op === 'upsert') {
            if (permissionError) return route.fulfill({ status: 403, json: { error: 'Sem permissão para alterar o modelo padrão.' } });
            selected = body.values.template_id;
          }
          return fulfill({ data: { template_id: selected } });
        }
        if (table === 'sala_templates' && body.op === 'update') {
          Object.assign(templates.find(item => item.id === body.filters.find(([key]) => key === 'id')[1]), body.values);
          return fulfill({ data: null });
        }
        const rows = { sala_classes: data.classes, sala_students: data.students, sala_exams: data.exams, sala_templates: templates, sala_recovery_students: members.map(student_id => ({ student_id })), sala_copy_invitations: [] };
        if (table in rows && body.op === 'select') return fulfill({ data: rows[table] });
      }
      errors.push(`Unexpected request: ${path}`);
      return route.fulfill({ status: 500, json: { error: 'Unexpected fixture request' } });
    });
    async function nav(name) {
      const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
      if (await menu.isVisible()) await menu.click();
      await page.locator('.sidebar').getByRole('button', { name, exact: true }).click();
    }
    async function capture(name) {
      const dismiss = page.getByRole('status').getByRole('button', { name: 'Fechar', exact: true });
      if (await dismiss.count()) await dismiss.first().click();
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.main-content').scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Horizontal overflow');
      await page.locator('.main-content').screenshot({ path: resolve(artifacts, `${name}-${width}.png`) });
    }
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Editar turma 7º ano A', exact: true }).waitFor();
    await nav('Modelos de prova');
    await page.locator('.model-card').filter({ hasText: 'Cabeçalho da escola' }).waitFor();
    assert.equal(await page.locator('.model-card').count(), 5);
    await capture('modelos');
    await page.getByRole('button', { name: 'PDF', exact: true }).click();
    assert.equal(await page.locator('.model-card').count(), 2);
    await page.getByRole('button', { name: 'Word', exact: true }).click();
    assert.equal(await page.locator('.model-card').count(), 2);
    const pending = page.locator('.model-card').filter({ hasText: 'Modelo interdisciplinar' });
    assert.equal(await pending.getByRole('button', { name: 'Definir como padrão' }).isDisabled(), true);
    await page.getByLabel('Buscar modelos', { exact: true }).fill('inexistente');
    await page.getByRole('heading', { name: 'Nenhum modelo encontrado' }).waitFor();
    await capture('modelos-vazio');
    await page.getByRole('button', { name: 'Ver todos os modelos' }).click();
    const pdf = page.locator('.model-card').filter({ hasText: 'Avaliação de Matemática' });
    permissionError = true;
    await pdf.getByRole('button', { name: 'Definir como padrão' }).click();
    await page.getByText('Sem permissão para alterar o modelo padrão.', { exact: true }).waitFor();
    assert.equal(selected, 'word');
    permissionError = false;
    await pdf.getByRole('button', { name: 'Definir como padrão' }).click();
    await pdf.getByText('Meu padrão', { exact: true }).waitFor();
    await pdf.locator('summary').first().focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await pdf.locator('summary').first().evaluate(node => getComputedStyle(node).outlineStyle), 'solid');
    await page.keyboard.press('Enter');
    await pdf.getByRole('button', { name: 'Validar PDF novamente', exact: true }).waitFor();
    await pdf.getByText('Ajustar cabeçalho do PDF', { exact: true }).click();
    await pdf.getByRole('slider').waitFor();
    await capture('modelos-opcoes');
    const word = page.locator('.model-card').filter({ hasText: 'Cabeçalho da escola' });
    await word.locator('summary').first().click();
    await word.getByText('Revisar texto extraído', { exact: true }).click();
    await word.getByLabel('Texto extraído de Cabeçalho da escola').fill('Escola · Aluno · Turma');
    await word.getByRole('button', { name: 'Salvar revisão', exact: true }).click();
    await page.getByText('Texto revisado salvo.', { exact: true }).waitFor();
    assert.equal(templates[0].extracted_text, 'Escola · Aluno · Turma');
    assert.equal(await page.locator('.model-card').first().evaluate(node => getComputedStyle(node).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const firstCard = page.locator('.model-card').first();
    await firstCard.hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.model-card')).transform !== 'none');
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await nav('Provas individuais');
    await page.getByRole('heading', { name: 'Ana Clara Martins', exact: true }).waitFor();
    assert.deepEqual(await page.locator('.individual-summary dd').allTextContents(), ['2', '1', '1']);
    for (const info of await page.locator('.individual-workspace .exam-row-info').all()) {
      assert.ok((await info.boundingBox()).width >= 180, 'Exam text must keep a readable column on mobile');
    }
    await capture('individuais');
    await page.getByRole('button', { name: 'Adicionar aluno', exact: true }).click();
    assert.equal(await page.getByLabel('Buscar aluno para prova individual', { exact: true }).evaluate(node => node === document.activeElement), true);
    for (const control of [page.getByRole('button', { name: 'Adicionar aluno', exact: true }), page.getByLabel('Buscar aluno para prova individual', { exact: true }), page.getByLabel('Situação dos alunos', { exact: true })]) {
      assert.ok((await control.boundingBox()).height >= 44, 'Primary controls must provide 44px touch targets');
    }
    await page.getByLabel('Buscar aluno para prova individual', { exact: true }).fill('Camila');
    await page.getByRole('button', { name: 'Adicionar Camila Oliveira a Provas individuais', exact: true }).click();
    await page.getByRole('heading', { name: 'Camila Oliveira', exact: true }).waitFor();
    assert.deepEqual(await page.locator('.individual-summary dd').allTextContents(), ['3', '1', '1']);
    await page.getByLabel('Filtrar alunos para provas individuais', { exact: true }).fill('ninguém');
    await page.getByRole('heading', { name: 'Nenhum aluno encontrado', exact: true }).waitFor();
    await capture('individuais-vazio');
    await page.getByLabel('Filtrar alunos para provas individuais', { exact: true }).fill('Ana');
    const history = page.locator('.student-exam-history');
    await history.locator('summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await history.getAttribute('open'), null);
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Revisar', exact: true }).first().click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('button', { name: 'Preparar prova individual de Ana Clara Martins', exact: true }).click();
    await page.getByRole('heading', { name: 'Preparar prova individual', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await context.close();
    assert.deepEqual(errors, []);
    console.log(`PASS: collections at ${width}x1000, filters, defaults, errors, keyboard, reduced motion, student addition, review and generation`);
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
