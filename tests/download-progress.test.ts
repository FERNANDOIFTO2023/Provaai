import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { downloadExams } from '../lib/export.ts';
import { demoData } from '../lib/model.ts';
import { fetchExamFile } from '../lib/download-file.ts';

test('transferência mede bytes recebidos e rejeita um documento truncado', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'XSRF-TOKEN=test' } });
  let length = 4;
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1]));
      controller.enqueue(new Uint8Array([2, 3, 4]));
      controller.close();
    },
  }), { headers: { 'X-Document-Length': String(length), 'Content-Type': 'application/pdf' } });
  try {
    const steps: number[] = [];
    const exam = demoData().exams[0];
    const blob = await fetchExamFile(exam, 'pdf', false, n => steps.push(n));
    assert.equal(blob.size, 4);
    assert.deepEqual(steps, [3, 3.25, 4]);
    length = 7;
    await assert.rejects(fetchExamFile(exam, 'pdf', false, () => {}), /incompleto/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('ZIP informa progresso após cada arquivo e não inicia download se um deles falhar', async () => {
  const source = demoData().exams[0];
  const exams = [1, 2].map(n => ({ ...source, id: String(n), status: 'approved' as const,
    profile_snapshot: { ...source.profile_snapshot, code: 'A00' + n } }));
  const files: Blob[] = [];
  let clicked = 0;
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalCreate = URL.createObjectURL;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ href: '', download: '', click: () => { clicked++; } }),
  } });
  URL.createObjectURL = blob => { assert.ok(blob instanceof Blob); files.push(blob); return 'blob:test'; };
  try {
    const progress: number[] = [];
    await downloadExams(exams, 'pdf', false, async (exam, _format, _key, stage) => {
      stage(2, 'Convertendo o documento em PDF');
      return new Blob([exam.id]);
    }, state => progress.push(state.percent));
    assert.ok(progress.some(n => n > 0 && n < 50));
    assert.deepEqual(progress, [...progress].sort((a, b) => a - b));
    assert.equal(progress.at(-1), 100);
    assert.equal(clicked, 1);
    const zip = await JSZip.loadAsync(await files[0].arrayBuffer());
    assert.equal(await zip.file('A001_1.pdf')!.async('string'), '1');
    assert.equal(await zip.file('A002_2.pdf')!.async('string'), '2');
    const failedProgress: number[] = [];
    await assert.rejects(downloadExams(exams, 'pdf', false, async exam => {
      if (exam.id === '2') throw new Error('Falha no segundo arquivo');
      return new Blob([exam.id]);
    }, state => failedProgress.push(state.percent)), /segundo arquivo/);
    assert.ok(failedProgress.some(n => n > 0));
    assert.ok(!failedProgress.includes(100));
    assert.equal(clicked, 1, 'um ZIP incompleto não deve ser baixado');
  } finally {
    URL.createObjectURL = originalCreate;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
