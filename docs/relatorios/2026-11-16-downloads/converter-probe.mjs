// Ensaio isolado com conteúdo fictício. Compara a ponte Worker com a execução direta
// no subprocesso; registra etapas sem enviar documentos nem acessar banco/produção.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { writeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const require = createRequire(join(root, 'package.json'));
const packageRoot = dirname(require.resolve('@matbee/libreoffice-converter/package.json'));
const mark = phase => writeSync(2, JSON.stringify({ phase, ms: Math.round(performance.now()) }) + '\n');

if (process.argv[2] === '--child') {
  const [mode, docxPath, workerPath] = process.argv.slice(3);
  const { createWorkerConverter, createConverter } = require('@matbee/libreoffice-converter/server');
  mark('init-start');
  const loader = mode === 'library' ? { createModule: options => require('@matbee/libreoffice-converter/wasm/loader').createModule({ ...options, noInitialRun: true }) }
    : mode === 'direct' ? require('@matbee/libreoffice-converter/wasm/loader') : undefined;
  const converter = mode === 'worker'
    ? await createWorkerConverter({ wasmPath: join(packageRoot, 'wasm'), workerPath })
    : await createConverter({ wasmLoader: loader,
      onProgress: p => mark(p.phase + ':' + p.percent) });
  mark('init-done');
  const data = await readFile(docxPath);
  mark('convert-start');
  const result = await converter.convert(data, { outputFormat: 'pdf' });
  mark('convert-done');
  assert.equal(Buffer.from(result.data).subarray(0, 5).toString(), '%PDF-');
  writeSync(1, JSON.stringify({ bytes: result.data.length }) + '\n');
  // Igual ao CLI de produção: o processo isolado encerra todos os seus threads.
  mark('exit');
  process.exit(0);
}

const rounds = Number(process.argv[2] ?? 12);
const modes = (process.argv[3] ?? 'worker,direct').split(',');
assert.ok(Number.isInteger(rounds) && rounds > 0 && rounds <= 100);
assert.ok(modes.every(m => ['worker', 'direct', 'cli', 'library', 'fixed'].includes(m)));
const temporary = await mkdtemp(join(tmpdir(), 'provaai-converter-probe-'));
const samples = [];
try {
  // Cópia instrumentada em pasta temporária; nenhum arquivo de node_modules é modificado.
  const original = await readFile(join(packageRoot, 'dist/node.worker.cjs'), 'utf8');
  const traced = original.replace('__require("../wasm/loader.cjs")', '__require(' + JSON.stringify(join(packageRoot, 'wasm/loader.cjs')) + ')')
    .replace('    wasmLoader\n  });', '    wasmLoader, onProgress: p => require("node:fs").writeSync(2, JSON.stringify({phase: p.phase + ":" + p.percent, ms: Math.round(performance.now())}) + "\\n")\n  });');
  assert.notEqual(traced, original);
  const workerPath = join(temporary, 'traced-worker.cjs');
  await writeFile(workerPath, traced);
  const { examFile } = await import('../../../lib/export.ts');
  const { pdfHeader } = await import('../../../lib/pdf-header.ts');
  const exam = { status: 'approved', title: 'Fotossíntese', subject: 'Ciências',
    profile_snapshot: { name: 'Aluno fictício', code: 'A001' },
    content: { instructions: 'Responda.', questions: [{ type: 'essay', statement: 'Explique a fotossíntese.',
      options: [], answer: 'RESPOSTA RESERVADA', objective: 'Compreender', points: 10 }] } };
  const header = await pdfHeader(new Uint8Array(await readFile(join(root, 'tests/fixtures/model.pdf'))), .25);
  const docxPath = join(temporary, 'exam.docx');
  await writeFile(docxPath, Buffer.from(await (await examFile(exam, 'docx', false, header)).arrayBuffer()));
  // Observa também o CLI original, incluindo gravação do PDF, stdout e process.exit.
  const cliSource = (await readFile(join(root, 'scripts/render-document.mjs'), 'utf8'))
    .replace("createRequire(import.meta.url)", 'createRequire(' + JSON.stringify(join(root, 'package.json')) + ')')
    .replaceAll("'../lib/", "'" + pathToFileURL(join(root, 'lib')).href + '/')
    .replace("'./office-converter.mjs'", JSON.stringify(pathToFileURL(join(root, 'scripts/office-converter.mjs')).href))
    .replace('  worker ??=', "  trace('init-start');\n  worker ??=")
    .replace('  converter ??=', "  trace('init-start');\n  converter ??=")
    .replace('  return (await worker.convert(bytes, { outputFormat })).data;', "  trace('init-done'); trace('convert-start'); const converted = (await worker.convert(bytes, { outputFormat })).data; trace('convert-done'); return converted;")
    .replace('  return (await converter.convert(bytes, { outputFormat })).data;', "  trace('init-done'); trace('convert-start'); const converted = (await converter.convert(bytes, { outputFormat })).data; trace('convert-done'); return converted;")
    .replace('  await new Promise((resolve, reject) => {', "  trace('render-done');\n  await new Promise((resolve, reject) => {")
    .replace('process.exit(process.exitCode ?? 0);', "trace('stdout-done'); trace('exit'); process.exit(process.exitCode ?? 0);");
  const cliPath = join(temporary, 'traced-cli.mjs');
  await writeFile(cliPath, 'import { writeSync as traceWrite } from "node:fs";\nconst trace = phase => traceWrite(2, JSON.stringify({phase,ms:Math.round(performance.now())})+"\\n");\n' + cliSource);
  const requestPath = join(temporary, 'request.json');
  await writeFile(requestPath, JSON.stringify({ operation: 'convert', docxPath, outputPath: join(temporary, 'output.pdf') }));
  for (let round = 1; round <= rounds; round++) {
    for (const mode of modes) {
      const started = performance.now();
      const sample = await new Promise((resolve, reject) => {
        const args = ['cli', 'fixed'].includes(mode) ? [cliPath, requestPath] : [fileURLToPath(import.meta.url), '--child', mode, docxPath, workerPath];
        const child = spawn(process.execPath, args,
          { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '', timedOut = false;
        // Limite de investigação, não altera os 120 segundos do aplicativo.
        const timer = setTimeout(() => { timedOut = true; child.kill(); }, 20_000);
        child.stdout.on('data', data => { stdout += data; });
        child.stderr.on('data', data => { stderr += data; });
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.once('close', code => {
          clearTimeout(timer);
          resolve({ round, mode, code, timedOut, elapsedMs: Math.round(performance.now() - started),
            output: stdout.trim(), stages: stderr.trim().split(/\r?\n/).filter(Boolean).map(line => {
              try { return JSON.parse(line); } catch { return { diagnostic: line.slice(0, 250) }; }
            }) });
        });
      });
      samples.push(sample);
      console.log(JSON.stringify(sample));
    }
  }
  await writeFile(join(here, 'converter-probe-' + modes.join('-') + '.json'), JSON.stringify({
    node: process.version, platform: process.platform, samples,
    limits: 'Ensaio local sequencial, com dados fictícios. O teto de 20 s não mede um timeout de 120 s; apenas identifica execuções presas para comparação. Sem medição de produção.' }, null, 2) + '\n');
} finally {
  assert.ok(resolve(temporary).startsWith(resolve(tmpdir()) + sep));
  await rm(temporary, { recursive: true, force: true });
}
