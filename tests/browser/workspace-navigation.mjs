/*
 * Testes / histórico de navegação
 * Exercita Voltar e Avançar no build real com API simulada e dados controlados. Verifica que
 * formulários concluídos ou cancelados não reaparecem como páginas do histórico.
 */
// Use PLAYWRIGHT_MODULE para indicar playwright/index.mjs quando a biblioteca não estiver instalada localmente.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { build } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
await build({ root, logLevel: 'error' });
const publicDir = resolve(root, 'public');
const manifest = JSON.parse(await readFile(resolve(publicDir, 'build/manifest.json'), 'utf8'));
const entry = manifest['resources/js/app.tsx'];
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      return response.end(`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Navigation tests</title>${entry.css.map(css => `<link rel="stylesheet" href="/build/${css}">`).join('')}</head><body><div id="app"></div><script type="module" src="/build/${entry.file}"></script></body></html>`);
    }
    const path = resolve(publicDir, `.${decodeURIComponent(pathname)}`);
    if (!path.startsWith(publicDir + sep)) { response.writeHead(403); return response.end(); }
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
    response.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    response.end(await readFile(path));
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
console.log(`Navigation test server: ${origin}`);
let browser;
let passed = 0;
const failures = [];

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function openFirstExamFolder(page) {
  const folder = page.locator('.exam-day-folder').first();
  if (!(await folder.evaluate(node => node.open))) await folder.locator('summary').click();
}
async function expectPage(page, view, current = null) {
  await page.waitForFunction(({ view, current }) => {
    const location = history.state?.provaai?.location;
    return location?.view === view && location.current === current && !document.querySelector('dialog[open]');
  }, { view, current });
  await settle(page);
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.deepEqual(await page.evaluate(() => history.state.provaai.location), { view, current });
}
async function navigate(page, name) {
  const menu = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.locator('.sidebar').getByRole('button', { name: new RegExp(`^${name}(?:\\s*\\d+)?$`) }).click();
  const views = { 'Minhas turmas': 'classes', Alunos: 'students', 'Provas coletivas': 'exams', 'Provas individuais': 'recovery', 'Modelos de prova': 'templates', Compartilhamentos: 'sharing', Sobre: 'about' };
  await expectPage(page, views[name]);
}
async function run(name, test, width = 1440) {
  if (process.env.NAVIGATION_TEST_FILTER && !name.includes(process.env.NAVIGATION_TEST_FILTER)) return;
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/session') return route.fulfill({ json: { session: null } });
    if (path === '/api/config') return route.fulfill({ json: { aiConfigured: false } });
    errors.push(`Unexpected demo request: ${path}`);
    return route.fulfill({ status: 500, json: { error: 'Unexpected demo request' } });
  });
  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Explorar demonstração' }).click();
    await expectPage(page, 'classes');
    await test(page);
    assert.deepEqual(errors, [], 'Erros JavaScript ou chamadas inesperadas à API');
    passed++;
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL: ${name}\n${error.stack}`);
    console.error({ errors, text: (await page.locator('body').innerText()).slice(0, 1200) });
    console.error(await page.evaluate(() => ({ location: history.state?.provaai?.location, heading: document.querySelector('h1')?.textContent, dialogs: [...document.querySelectorAll('dialog[open] h2')].map(node => node.textContent) })));
  } finally { await context.close(); }
}

try {
  browser = await chromium.launch({ headless: true, timeout: 20000, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  for (const width of [1440, 375]) {
    await run(`pastas diárias: filtros, seleção, teclado e retorno (${width}px)`, async page => {
      // Dados sintéticos: a primeira prova UTC ainda pertence ao dia 27 em Brasília.
      const timestamp = '2026-11-27T12:00:00Z';
      const token = `test.${Buffer.from(JSON.stringify({ sub: 'folder-test', session_id: 'folders' })).toString('base64url')}.test`;
      const room = { id: 'c1', user_id: 'folder-test', name: 'Turma das pastas', grade: '7º', subject: 'Matemática', color: 'sage', icon: 'book', created_at: timestamp };
      const student = { id: 's1', user_id: 'folder-test', class_id: 'c1', name: 'Aluno de teste', code: 'A001', difficulties: '', criteria: '', level: 'Intermediário', created_at: timestamp };
      const base = { user_id: 'folder-test', class_id: 'c1', student_id: 's1', purpose: 'regular', subject: 'Matemática', topics: 'Soma', question_count: 1, status: 'approved', template_id: null,
        content: { instructions: 'Resolva.', objectiveCount: 0, questions: [{ type: 'essay', statement: 'Quanto é 2 + 3?', options: [], answer: '5', objective: 'Somar', points: 1 }] }, profile_snapshot: student, updated_at: timestamp };
      const exams = [
        {...base, id: 'e1', title: 'Soma recente', created_at: '2026-11-28T02:00:00Z'},
        {...base, id: 'e2', title: 'Soma em revisão', status: 'draft', created_at: timestamp},
        {...base, id: 'e3', title: 'Soma anterior', created_at: '2026-11-26T12:00:00Z'},
        {...base, id: 'e4', title: 'Individual oculta', purpose: 'recovery', created_at: timestamp},
      ];
      const exports = [];
      await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/config') return route.fulfill({ json: { aiConfigured: true } });
        if (path === '/api/auth/session') return route.fulfill({ json: { session: { access_token: token, refresh_token: '', user: { id: 'folder-test', email: 'folders@example.test', user_metadata: {} } } } });
        if (path.startsWith('/api/data/')) {
          const data = { sala_classes: [room, {...room, id: 'c2', name: 'Turma sem provas'}], sala_students: [student], sala_exams: exams, sala_recovery_students: [], sala_templates: [], sala_teacher_template_defaults: null, sala_copy_invitations: [] };
          const payload = route.request().postDataJSON();
          return route.fulfill({ json: { data: payload.single === 'maybe' ? null : data[path.split('/').at(-1)] ?? [] } });
        }
        if (path === '/api/export/exam') {
          exports.push(route.request().postDataJSON());
          return route.fulfill({ body: 'PK-fixture', contentType: 'application/octet-stream' });
        }
        if (path.startsWith('/api/export/progress/')) return route.fulfill({ json: { stage: 'pending' } });
        return route.fallback();
      });
      await page.evaluate(() => localStorage.setItem('provaai:activity:v1:folder-test:folders', JSON.stringify({ lastActivity: Date.now(), ended: false })));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expectPage(page, 'classes');
      await navigate(page, 'Provas coletivas');
      await page.getByRole('button', { name: 'Abrir provas', exact: true }).first().click();
      const folders = page.locator('.exam-day-folder');
      assert.equal(await folders.count(), 2);
      assert.deepEqual(await folders.locator('summary strong').allTextContents(), ['27/11/2026', '26/11/2026']);
      assert.match(await folders.first().locator('summary').innerText(), /2 provas · 1 em revisão/);
      assert.equal(await page.locator('.exam-day-folder[open]').count(), 0);
      const length = await page.evaluate(() => history.length);
      await folders.first().locator('summary').focus();
      await page.keyboard.press('Enter');
      await page.getByText('Soma recente', { exact: true }).waitFor();
      assert.equal(await page.getByText('Individual oculta', { exact: true }).count(), 0);
      assert.equal(await page.getByLabel('Selecionar Soma em revisão de Aluno de teste').isDisabled(), true);
      await page.getByLabel('Selecionar Soma recente de Aluno de teste').check();
      await folders.first().locator('summary').click();
      assert.match(await folders.first().locator('summary').innerText(), /1 selecionada/);
      await page.getByLabel('Selecionar aprovadas de todas as pastas filtradas').check();
      await page.getByLabel('Formato de download').selectOption('docx');
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Baixar ZIP', exact: true }).click();
      await downloaded;
      assert.equal(exports.length, 2);
      assert.deepEqual(exports.map(request => request.id).sort(), ['e1', 'e3']);
      assert.ok(exports.every(request => request.format === 'docx'));
      await page.getByRole('dialog').getByRole('button', { name: 'Concluir', exact: true }).click();
      await page.getByLabel('Buscar provas', { exact: true }).fill('anterior');
      assert.equal(await folders.count(), 1);
      assert.equal(await folders.locator('summary strong').innerText(), '26/11/2026');
      await page.getByLabel('Buscar provas', { exact: true }).fill('');
      await page.getByLabel('Buscar provas', { exact: true }).fill('sem resultado');
      assert.equal(await folders.count(), 0, 'Não cria pastas vazias');
      await page.getByLabel('Buscar provas', { exact: true }).fill('');
      await page.getByLabel('Estado das provas').selectOption('draft');
      assert.equal(await folders.count(), 1);
      assert.match(await folders.locator('summary').innerText(), /1 prova · 1 em revisão/);
      await page.getByLabel('Estado das provas').selectOption('all');
      await openFirstExamFolder(page);
      await page.getByRole('button', { name: 'Revisar', exact: true }).first().click();
      await page.getByRole('heading', { name: 'Baixar prova aprovada', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Voltar às provas', exact: true }).click();
      assert.equal(await folders.first().evaluate(node => node.open), true);
      assert.equal(await page.evaluate(() => history.length), length);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Sem rolagem horizontal');
      assert.ok((await folders.first().locator('.exam-row-info').first().boundingBox()).width >= 150, 'Texto mantém largura legível no celular');
      if (process.env.NAVIGATION_SCREENSHOT_DIR) {
        await mkdir(process.env.NAVIGATION_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: resolve(process.env.NAVIGATION_SCREENSHOT_DIR, `pastas-${width}.png`), fullPage: true });
      }
      await page.goBack();
      await expectPage(page, 'exams');
      await page.goForward();
      await expectPage(page, 'exams', 'c1');
      await page.getByRole('button', { name: 'Todas as turmas', exact: true }).click();
      await page.getByRole('button', { name: 'Abrir provas', exact: true }).nth(1).click();
      await page.getByRole('heading', { name: 'Esta turma ainda não tem provas', exact: true }).waitFor();
      assert.equal(await folders.count(), 0, 'Turma sem provas não recebe pastas');
    }, width);
  }
  for (const width of [1440, 375]) {
    await run(`editar cartão, salvar, voltar e avançar (${width}px)`, async page => {
      await page.getByRole('button', { name: 'Editar turma 7º ano A', exact: true }).click();
      await page.getByLabel('Nome da turma', { exact: true }).fill('7º ano A revisado');
      await page.locator('input[name="color"][value="blue"]').check();
      await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
      await expectPage(page, 'classes', 'c1');
      await page.getByRole('heading', { name: /^7º ano A revisado/ }).waitFor();
      await page.goBack();
      await expectPage(page, 'classes');
      await page.getByRole('button', { name: 'Abrir turma 7º ano A revisado', exact: true }).waitFor();
      await page.goForward();
      await expectPage(page, 'classes', 'c1');
    }, width);
  }

  await run('cancelar, fechar e Escape não criam etapas nem mudam a página de origem', async page => {
    await navigate(page, 'Sobre');
    await navigate(page, 'Minhas turmas');
    const length = await page.evaluate(() => history.length);
    for (const method of ['cancel', 'close', 'escape']) {
      await page.getByRole('button', { name: 'Editar turma 7º ano A', exact: true }).click();
      await page.getByLabel('Nome da turma', { exact: true }).fill('Não salvar');
      if (method === 'escape') await page.keyboard.press('Escape');
      else await page.getByRole('dialog').getByRole('button', { name: method === 'cancel' ? 'Cancelar' : 'Fechar', exact: true }).click();
      await expectPage(page, 'classes');
      await page.getByRole('button', { name: 'Abrir turma 7º ano A', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => history.length), length);
    }
    await page.goBack();
    await expectPage(page, 'about');
    await page.goForward();
    await expectPage(page, 'classes');
  });

  await run('criar turma e voltar à lista sem reabrir cadastro', async page => {
    await page.getByRole('button', { name: 'Nova turma', exact: true }).click();
    await page.getByLabel('Nome da turma', { exact: true }).fill('Turma Navegação');
    await page.getByLabel('Série / etapa', { exact: true }).fill('9º ano');
    await page.getByLabel('Matéria', { exact: true }).fill('História');
    await page.getByRole('button', { name: 'Criar turma', exact: true }).click();
    await page.getByRole('heading', { name: /^Turma Navegação/ }).waitFor();
    await settle(page);
    const id = await page.evaluate(() => history.state.provaai.location.current);
    assert.ok(id);
    await page.goBack();
    await expectPage(page, 'classes');
    await page.getByRole('button', { name: 'Abrir turma Turma Navegação', exact: true }).waitFor();
    await page.goForward();
    await expectPage(page, 'classes', id);
  });

  await run('salvar aluno dentro da turma sem criar histórico do formulário', async page => {
    await page.getByRole('button', { name: 'Abrir turma 7º ano A', exact: true }).click();
    await expectPage(page, 'classes', 'c1');
    const length = await page.evaluate(() => history.length);
    await page.getByRole('button', { name: 'Adicionar aluno', exact: true }).first().click();
    await page.getByLabel('Nome do aluno', { exact: true }).fill('Aluno Navegação');
    await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
    await expectPage(page, 'classes', 'c1');
    await page.getByText('Aluno Navegação', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => history.length), length);
    await page.goBack();
    await expectPage(page, 'classes');
  });

  await run('editar aluno no diretório preserva a tela Alunos e o histórico', async page => {
    await navigate(page, 'Alunos');
    await page.getByRole('button', { name: 'Editar perfil', exact: true }).first().click();
    await page.getByLabel('Nome do aluno', { exact: true }).fill('Ana Clara revisada');
    await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
    await expectPage(page, 'students');
    await page.getByRole('heading', { name: 'Ana Clara revisada', exact: true }).waitFor();
    await page.goBack();
    await expectPage(page, 'classes');
    await page.goForward();
    await expectPage(page, 'students');
  });

  await run('cancelar geração pela biblioteca não deixa filtro de turma nem formulário no histórico', async page => {
    await navigate(page, 'Provas coletivas');
    await page.getByRole('button', { name: 'Preparar provas de 7º ano A', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expectPage(page, 'exams');
    await page.getByRole('heading', { name: 'Provas coletivas.', exact: true }).waitFor();
    await page.goBack();
    await expectPage(page, 'classes');
    await page.goForward();
    await expectPage(page, 'exams');
  });

  await run('gerar rascunhos navega para provas e Voltar retorna à turma', async page => {
    await page.getByRole('button', { name: 'Abrir turma 7º ano A', exact: true }).click();
    await page.getByRole('button', { name: 'Preparar provas', exact: true }).click();
    await page.getByLabel('Título da avaliação', { exact: true }).fill('Avaliação Navegação');
    await page.getByLabel('Conteúdos e objetivos desta prova', { exact: true }).fill('Frações');
    await page.getByRole('dialog').getByRole('button', { name: 'Preparar provas', exact: true }).click();
    await expectPage(page, 'exams', 'c1');
    assert.ok(await page.getByText('Avaliação Navegação', { exact: true }).count() > 0);
    await page.goBack();
    await expectPage(page, 'classes', 'c1');
    await page.goForward();
    await expectPage(page, 'exams', 'c1');
  });

  await run('revisar, salvar e fechar prova preserva biblioteca e seleção de turma', async page => {
    await navigate(page, 'Provas coletivas');
    await page.getByRole('button', { name: 'Abrir provas', exact: true }).first().click();
    await expectPage(page, 'exams', 'c1');
    const length = await page.evaluate(() => history.length);
    await openFirstExamFolder(page);
    await page.getByRole('button', { name: 'Revisar', exact: true }).first().click();
    await page.getByLabel('Título', { exact: true }).fill('Prova revisada');
    await page.getByRole('button', { name: 'Salvar rascunho', exact: true }).click();
    await page.getByText('Rascunho salvo.', { exact: true }).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
    await expectPage(page, 'exams', 'c1');
    assert.equal(await page.evaluate(() => history.length), length);
    await page.goBack();
    await expectPage(page, 'exams');
    await page.goForward();
    await expectPage(page, 'exams', 'c1');
  });

  await run('prova individual cancelada mantém a lista e não reabre pelo Avançar', async page => {
    await navigate(page, 'Provas individuais');
    await page.getByLabel('Buscar aluno para prova individual', { exact: true }).fill('Ana Clara');
    await page.getByRole('button', { name: 'Adicionar Ana Clara Martins a Provas individuais', exact: true }).click();
    await page.getByRole('button', { name: 'Preparar prova individual de Ana Clara Martins', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expectPage(page, 'recovery');
    await page.goBack();
    await expectPage(page, 'classes');
    await page.goForward();
    await expectPage(page, 'recovery');
  });

  await run('compartilhamento e inclusão de modelos não reaparecem ao voltar/avançar', async page => {
    await navigate(page, 'Alunos');
    await page.getByRole('button', { name: 'Compartilhar cópia', exact: true }).first().click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expectPage(page, 'students');
    await navigate(page, 'Modelos de prova');
    await page.getByRole('button', { name: 'Adicionar modelos', exact: true }).click();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.goBack();
    await expectPage(page, 'students');
    await page.goForward();
    await expectPage(page, 'templates');
  });

  await run('Voltar durante formulário e recarregar não restauram rascunhos abertos', async page => {
    await navigate(page, 'Modelos de prova');
    await page.getByRole('button', { name: 'Adicionar modelos', exact: true }).click();
    await page.goBack();
    await expectPage(page, 'classes');
    await page.goForward();
    await expectPage(page, 'templates');
    await page.getByRole('button', { name: 'Adicionar modelos', exact: true }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Explorar demonstração' }).click();
    await expectPage(page, 'templates');
  });

  await run('histórico antigo é sanitizado sem apagar campos de outros componentes', async page => {
    await page.evaluate(() => history.replaceState({ marker: 'preserve', provaai: { scope: 'demo', location: { view: 'settings', current: 'c1', modal: 'edit-class', student: 's1', exam: null, recovery: null, share: null } } }, ''));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Explorar demonstração' }).click();
    await expectPage(page, 'about');
    assert.equal(await page.evaluate(() => history.state.marker), 'preserve');
    await navigate(page, 'Alunos');
    await page.goBack();
    await expectPage(page, 'about');
  });

  await run('navegação entre todas as seções funciona em tela pequena', async page => {
    const pages = [['Alunos', 'students'], ['Provas coletivas', 'exams'], ['Provas individuais', 'recovery'], ['Modelos de prova', 'templates'], ['Compartilhamentos', 'sharing'], ['Sobre', 'about']];
    for (const [name, view] of pages) { await navigate(page, name); await expectPage(page, view); }
    for (const [, view] of pages.slice(0, -1).reverse()) { await page.goBack(); await expectPage(page, view); }
    await page.goBack();
    await expectPage(page, 'classes');
    for (const [, view] of pages) { await page.goForward(); await expectPage(page, view); }
  }, 375);

  await run('cancelar confirmação de exclusão e edição retorna à lista original', async page => {
    await navigate(page, 'Sobre');
    await navigate(page, 'Minhas turmas');
    const length = await page.evaluate(() => history.length);
    await page.getByRole('button', { name: 'Editar turma 7º ano A', exact: true }).click();
    await page.getByRole('button', { name: 'Excluir turma', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('heading', { name: 'Configurações da turma', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expectPage(page, 'classes');
    assert.equal(await page.evaluate(() => history.length), length);
    await page.goBack();
    await expectPage(page, 'about');
  });

  await run('reativar aluno não reabre a confirmação ao voltar e avançar', async page => {
    await navigate(page, 'Alunos');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Inativar aluno', exact: true }).first().click();
    await page.getByLabel('Status dos alunos', { exact: true }).selectOption('inactive');
    await page.getByRole('button', { name: 'Reativar aluno', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reativar aluno', exact: true }).click();
    await expectPage(page, 'students');
    await page.getByLabel('Status dos alunos', { exact: true }).selectOption('active');
    await page.getByRole('heading', { name: 'Ana Clara Martins', exact: true }).waitFor();
    await page.goBack();
    await expectPage(page, 'classes');
    await page.goForward();
    await expectPage(page, 'students');
  });

  await run('aprovar e baixar PDF não deixa revisão nem progresso no histórico', async page => {
    await navigate(page, 'Provas coletivas');
    await page.getByRole('button', { name: 'Abrir provas', exact: true }).first().click();
    await expectPage(page, 'exams', 'c1');
    await openFirstExamFolder(page);
    await page.getByRole('button', { name: 'Revisar', exact: true }).first().click();
    await page.getByRole('button', { name: 'Revisei e aprovo', exact: true }).click();
    await page.getByText('Prova aprovada! Escolha PDF ou DOCX para baixar.', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Baixar prova aprovada', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'DOCX', exact: true }).isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Baixar PDF', exact: true }).isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Revisei e aprovo', exact: true }).count(), 0);
    const downloadReady = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
    const download = await downloadReady;
    assert.match(download.suggestedFilename(), /\.pdf$/i);
    await page.getByRole('dialog').getByRole('button', { name: 'Concluir', exact: true }).click();
    await expectPage(page, 'exams', 'c1');
    await page.goBack();
    await expectPage(page, 'exams');
    await page.goForward();
    await expectPage(page, 'exams', 'c1');
  });

  for (const width of [1440, 375]) {
    await run(`downloads ficam visíveis após revisão longa e reabertura (${width}px)`, async page => {
      await page.setViewportSize({ width, height: 667 });
      await navigate(page, 'Provas coletivas');
      await page.getByRole('button', { name: 'Abrir provas', exact: true }).first().click();
      await openFirstExamFolder(page);
      await page.getByRole('button', { name: 'Revisar', exact: true }).first().click();
      assert.equal(await page.getByRole('dialog').evaluate(node => node.scrollHeight > node.clientHeight), true);
      await page.getByRole('button', { name: 'Revisei e aprovo', exact: true }).click();
      await page.getByRole('heading', { name: 'Baixar prova aprovada', exact: true }).waitFor();
      for (const name of ['Baixar PDF', 'DOCX', 'Gabarito']) {
        const button = page.getByRole('button', { name, exact: true });
        assert.equal(await button.isEnabled(), true);
        const box = await button.boundingBox();
        assert.ok(box && box.y >= 0 && box.y + box.height <= 667, `${name} visível sem rolar`);
      }
      assert.equal(await page.getByRole('dialog').evaluate(node => node.scrollTop), 0);
      await page.getByRole('button', { name: 'Voltar às provas', exact: true }).click();
      await openFirstExamFolder(page);
      await page.getByRole('button', { name: 'Revisar', exact: true }).first().click();
      await page.getByRole('heading', { name: 'Baixar prova aprovada', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Editar prova', exact: true }).click();
      await page.getByLabel('Título', { exact: true }).fill('Prova revisada novamente');
      assert.equal(await page.getByRole('button', { name: 'Baixar PDF', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Revisei e aprovo', exact: true }).click();
      await page.getByRole('heading', { name: 'Baixar prova aprovada', exact: true }).waitFor();
      await page.getByRole('dialog').getByRole('heading', { name: 'Prova revisada novamente', exact: true }).waitFor();
    }, width);
  }

  await run('aprovação autenticada libera PDF e DOCX sem aguardar a fila ou recarregar a conta', async page => {
    const timestamp = new Date().toISOString();
    const activityToken = `test.${Buffer.from(JSON.stringify({ sub: 'teacher-test', session_id: 'review-test' })).toString('base64url')}.test`;
    const room = { id: 'c1', user_id: 'teacher-test', name: '7º ano A', grade: '7º', subject: 'Matemática', color: 'sage', icon: 'book', created_at: timestamp };
    const student = { id: 's1', user_id: 'teacher-test', class_id: 'c1', name: 'Aluno fictício', code: 'A001', difficulties: '', criteria: '', level: 'Intermediário', created_at: timestamp };
    let exam = { id: 'e1', user_id: 'teacher-test', class_id: 'c1', student_id: 's1', purpose: 'regular', title: 'Operações', subject: 'Matemática', topics: 'Multiplicação', question_count: 1, status: 'draft', template_id: null,
      content: { instructions: 'Apresente os cálculos.', objectiveCount: 0, questions: [{ type: 'essay', statement: 'Calcule 14 vezes 400.', options: [], answer: '5600', objective: 'Multiplicar', points: 1 }] },
      profile_snapshot: student, created_at: timestamp, updated_at: timestamp };
    const updates = [], exports = [];
    let selects = 0;
    let refuseApproval = true;
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/session') return route.fulfill({ json: { session: { access_token: activityToken, refresh_token: '', user: { id: 'teacher-test', email: 'teacher@example.test', user_metadata: {} } } } });
      if (path === '/api/config') return route.fulfill({ json: { aiConfigured: true } });
      if (path.startsWith('/api/data/')) {
        const resource = path.split('/').at(-1), payload = route.request().postDataJSON();
        if (payload.op === 'update' && resource === 'sala_exams') {
          updates.push(payload.values);
          // Conteúdo reserializado pode ser tratado como edição. A confirmação deve enviar somente status.
          exam = { ...exam, ...payload.values, status: payload.values.content || refuseApproval ? 'draft' : payload.values.status };
          return route.fulfill({ json: { data: exam } });
        }
        selects++;
        const data = { sala_classes: [room], sala_students: [student], sala_exams: [exam], sala_recovery_students: [], sala_templates: [], sala_teacher_template_defaults: null, sala_copy_invitations: [] };
        return route.fulfill({ json: { data: payload.single === 'maybe' ? null : data[resource] ?? [] } });
      }
      if (path === '/api/export/exam') {
        const payload = route.request().postDataJSON();
        exports.push(payload);
        assert.equal(exam.status, 'approved');
        return route.fulfill({ body: payload.format === 'pdf' ? '%PDF-test' : 'PK-test', contentType: 'application/octet-stream' });
      }
      if (path.startsWith('/api/export/progress/')) return route.fulfill({ json: { stage: 'pending' } });
      throw new Error(`Unexpected authenticated request: ${path}`);
    });
    await page.evaluate(() => localStorage.setItem('provaai:activity:v1:teacher-test:review-test', JSON.stringify({ lastActivity: Date.now(), ended: false })));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectPage(page, 'classes');
    await navigate(page, 'Provas coletivas');
    await page.getByRole('button', { name: 'Abrir provas', exact: true }).first().click();
    await openFirstExamFolder(page);
    await page.getByRole('button', { name: 'Revisar', exact: true }).first().click();
    const before = selects;
    await page.getByRole('button', { name: 'Revisei e aprovo', exact: true }).click();
    await page.getByRole('dialog').getByRole('alert').filter({ hasText: 'A aprovação não foi confirmada' }).waitFor();
    assert.equal(await page.getByRole('dialog').getByRole('alert').evaluate(node => document.activeElement === node), true);
    assert.equal(await page.getByRole('heading', { name: 'Baixar prova aprovada', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Baixar PDF', exact: true }).count(), 0);
    refuseApproval = false;
    await page.getByRole('button', { name: 'Revisei e aprovo', exact: true }).click();
    await page.getByText('Prova aprovada! Escolha PDF ou DOCX para baixar.', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Baixar prova aprovada', exact: true }).waitFor();
    assert.equal(updates.length, 4);
    assert.deepEqual(updates[1], { status: 'approved' });
    assert.deepEqual(updates[3], { status: 'approved' });
    assert.equal(selects, before, 'Aprovar não precisa recarregar todas as coleções');
    assert.equal(exports.length, 0, 'A interface não espera exportação para liberar os botões');
    assert.equal(await page.getByRole('button', { name: 'DOCX', exact: true }).isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Baixar PDF', exact: true }).isEnabled(), true);
    const ready = page.waitForEvent('download');
    await page.getByRole('button', { name: 'DOCX', exact: true }).click();
    assert.match((await ready).suggestedFilename(), /\.docx$/i);
    assert.equal(exports[0].format, 'docx');
  });

  console.log(`Navigation: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
