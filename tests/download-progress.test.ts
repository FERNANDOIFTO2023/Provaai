import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { downloadExams } from '../lib/export.ts';
import { demoData } from '../lib/model.ts';

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
    await downloadExams(exams, 'pdf', false, async exam => new Blob([exam.id]), n => progress.push(n));
    assert.deepEqual(progress, [1, 2]);
    assert.equal(clicked, 1);
    const zip = await JSZip.loadAsync(await files[0].arrayBuffer());
    assert.equal(await zip.file('A001_1.pdf')!.async('string'), '1');
    assert.equal(await zip.file('A002_2.pdf')!.async('string'), '2');
    const failedProgress: number[] = [];
    await assert.rejects(downloadExams(exams, 'pdf', false, async exam => {
      if (exam.id === '2') throw new Error('Falha no segundo arquivo');
      return new Blob([exam.id]);
    }, n => failedProgress.push(n)), /segundo arquivo/);
    assert.deepEqual(failedProgress, [1]);
    assert.equal(clicked, 1, 'um ZIP incompleto não deve ser baixado');
  } finally {
    URL.createObjectURL = originalCreate;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
