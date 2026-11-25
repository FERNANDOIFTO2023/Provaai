// Regressão da inicialização concorrente do LibreOffice. Tudo roda em subprocessos
// com conteúdo fictício; os threads WASM não permanecem vivos no processo dos testes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { examFile } from '../lib/export.ts';
import { pdfHeader } from '../lib/pdf-header.ts';

const exec = promisify(execFile);
const cli = async request => {
  const { stdout } = await exec(process.execPath,
    ['--experimental-strip-types', 'scripts/render-document.mjs', request],
    { timeout: 30_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  assert.deepEqual(JSON.parse(stdout.trim().split(/\r?\n/).at(-1)), { ok: true });
};

test('motor real inicia somente pela biblioteca, sem disparar main em paralelo', async () => {
  const helper = pathToFileURL(resolve('scripts/office-converter.mjs')).href;
  const source = `import { createOfficeConverter } from ${JSON.stringify(helper)};
    import { writeSync } from 'node:fs';
    const converter = await createOfficeConverter();
    writeSync(1, JSON.stringify({ready: converter.isReady(), noInitialRun: converter.module.noInitialRun}));
    process.exit(0);`;
  const { stdout } = await exec(process.execPath, ['--input-type=module', '--eval', source],
    { timeout: 30_000, windowsHide: true });
  assert.deepEqual(JSON.parse(stdout), { ready: true, noInitialRun: true });
});

test('CLI converte provas e gabaritos distintos, preservando perguntas, cabeçalho e isolamento', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'provaai-office-test-'));
  const root = join(process.cwd(), 'node_modules/pdfjs-dist');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(join(root, 'legacy/build/pdf.worker.mjs')).href;
  try {
    const header = await pdfHeader(new Uint8Array(await readFile('tests/fixtures/model.pdf')), .25);
    const statements = ['Explique a fotossíntese das plantas.', 'Descreva o ciclo da água na natureza.'];
    for (const [index, statement] of statements.entries()) {
      for (const answerKey of [false, true]) {
        const exam = { status: 'approved', title: `Prova exclusiva ${index + 1}`, subject: 'Ciências',
          profile_snapshot: { name: `Aluno fictício ${index + 1}`, code: `A00${index + 1}` },
          content: { instructions: 'Responda.', questions: [{ type: 'essay', statement,
            options: [], answer: `GABARITORESERVADO${index + 1}`, objective: 'Compreender', points: 10 }] } };
        const docxPath = join(temporary, 'exam.docx');
        const outputPath = join(temporary, 'exam.pdf');
        const requestPath = join(temporary, 'request.json');
        await writeFile(docxPath, Buffer.from(await (await examFile(exam, 'docx', answerKey, header)).arrayBuffer()));
        await writeFile(requestPath, JSON.stringify({ operation: 'convert', docxPath, outputPath }));
        await cli(requestPath);
        const bytes = await readFile(outputPath);
        assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
        const loading = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false,
          standardFontDataUrl: join(root, 'standard_fonts') + '/', wasmUrl: join(root, 'wasm') + '/' });
        try {
          const pdf = await loading.promise;
          let text = '', hasHeaderImage = false;
          for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            text += (await page.getTextContent()).items.map(item => item.str ?? '').join(' ');
            if (pageNumber === 1) {
              const operators = await page.getOperatorList();
              hasHeaderImage = operators.fnArray.includes(pdfjs.OPS.paintImageXObject);
            }
          }
          assert.ok(hasHeaderImage, 'O cabeçalho deve continuar presente no PDF.');
          assert.ok(!text.includes(exam.title), 'O título interno não deve aparecer no PDF convertido.');
          assert.ok(text.includes(statement), text);
          assert.ok(!text.includes(statements[1 - index]), 'Não pode copiar a pergunta da outra prova.');
          assert.equal(text.includes(`GABARITORESERVADO${index + 1}`), answerKey);
          assert.ok(!text.includes(`GABARITORESERVADO${2 - index}`));
        } finally {
          await loading.destroy();
        }
      }
    }
  } finally {
    assert.ok(resolve(temporary).startsWith(resolve(tmpdir()) + sep));
    await rm(temporary, { recursive: true, force: true });
  }
});
