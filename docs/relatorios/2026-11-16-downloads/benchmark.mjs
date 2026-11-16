// Diagnóstico local com dados fictícios: não acessa banco, conta ou serviço externo.
// Execute com: node docs/relatorios/2026-11-16-downloads/benchmark.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const folder = dirname(fileURLToPath(import.meta.url));
const root = resolve(folder, '../../..');
const require = createRequire(join(root, 'package.json'));
const temporary = await mkdtemp(join(tmpdir(), 'provaai-download-bench-'));
const samples = [];
let converter;
const exam = {
  id: 'benchmark-only', status: 'approved', title: 'Avaliação fictícia', subject: 'Matemática',
  profile_snapshot: { name: 'Aluno de teste', code: 'A001' },
  content: { instructions: 'Responda às questões.', questions: Array.from({ length: 5 }, (_, i) => ({
    type: 'essay', statement: `Questão ${i + 1}: calcule \\(2+3\\).`,
    answer: '5', options: [], objective: 'Somar', points: 2,
  })) },
};

async function run(input) {
  const request = join(temporary, 'request.json');
  await writeFile(request, JSON.stringify(input));
  const start = performance.now();
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', 'scripts/render-document.mjs', request], {
      cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    const timeout = setTimeout(() => child.kill(), 125_000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', code => {
      clearTimeout(timeout);
      if (code !== 0) reject(new Error(`Conversor: saída ${code}: ${stderr.slice(-1200)}`));
      else resolve(JSON.parse(stdout.trim().split(/\r?\n/).at(-1)));
    });
  });
  return { ms: Math.round(performance.now() - start), result: output };
}

try {
  let lastDocx;
  for (let round = 1; round <= 2; round++) {
    for (const template of ['builtin', 'pdf', 'docx']) {
      let header, headerMs = 0;
      if (template === 'pdf') {
        const cropped = await run({ operation: 'header', templatePath: join(root, 'tests/fixtures/model.pdf'), ratio: .25 });
        header = cropped.result;
        headerMs = cropped.ms;
      }
      for (const answerKey of [false, true]) {
        const docxPath = join(temporary, 'exam.docx');
        const outputPath = join(temporary, 'exam.pdf');
        const docx = await run({ operation: 'export', exam, className: 'Turma fictícia', teacherName: 'Professor de teste',
          format: 'docx', answerKey, outputPath: docxPath,
          ...(header ? { header } : {}),
          ...(template === 'docx' ? { templatePath: join(root, 'tests/fixtures/model.docx'), filename: 'model.docx' } : {}),
        });
        const pdf = await run({ operation: 'convert', docxPath, outputPath });
        lastDocx = await readFile(docxPath);
        const bytes = await readFile(outputPath);
        assert.equal(lastDocx.subarray(0, 2).toString(), 'PK');
        assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
        const sample = { round, template, answerKey, headerMs, docxMs: docx.ms, pdfMs: pdf.ms,
          totalMs: headerMs + docx.ms + pdf.ms, docxBytes: lastDocx.length, pdfBytes: bytes.length };
        samples.push(sample);
        console.log(JSON.stringify(sample));
      }
    }
  }
  // Experimento separado: mantém o mesmo motor vivo para medir custo de inicialização e reutilização.
  const { createWorkerConverter } = require('@matbee/libreoffice-converter/server');
  const start = performance.now();
  converter = await createWorkerConverter({ wasmPath: join(dirname(require.resolve('@matbee/libreoffice-converter/package.json')), 'wasm') });
  const startupMs = Math.round(performance.now() - start);
  const warm = [];
  for (let i = 0; i < 4; i++) {
    const began = performance.now();
    const result = await converter.convert(lastDocx, { outputFormat: 'pdf' });
    assert.equal(Buffer.from(result.data).subarray(0, 5).toString(), '%PDF-');
    warm.push(Math.round(performance.now() - began));
  }
  const evidence = { date: new Date().toISOString(), node: process.version, platform: process.platform,
    syntheticQuestions: 5, samples, persistentWorker: { startupMs, conversionMs: warm },
    limits: 'Medição local de subprocessos, sem rede HTTP, banco, fila concorrente ou cache Laravel. Não representa a latência de produção. Prova e gabarito têm conteúdo fictício. Assinaturas de arquivo verificadas; sem comparação visual completa.' };
  await writeFile(join(folder, 'benchmark.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('Motor reutilizado:', evidence.persistentWorker);
} finally {
  await converter?.destroy();
  // O diretório foi criado exclusivamente para este ensaio sob o diretório temporário do sistema.
  assert.ok(resolve(temporary).startsWith(resolve(tmpdir()) + (process.platform === 'win32' ? '\\' : '/')));
  await rm(temporary, { recursive: true, force: true });
}
