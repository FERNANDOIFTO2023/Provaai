import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { extractClassMaterial } from '../scripts/class-material.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const text = 'A fotossíntese utiliza luz, água e dióxido de carbono para produzir açúcares nas plantas.';
async function pptx(slides = [text]) {
  const zip = new JSZip();
  slides.forEach((value, i) => zip.file(`ppt/slides/slide${i + 1}.xml`, `<p:sld xmlns:p="urn:slide" xmlns:a="urn:drawing"><a:p><a:r><a:t>${value}</a:t></a:r></a:p></p:sld>`));
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('extrai texto do Word real sem converter novamente para PDF', async () => {
  const result = await extractClassMaterial(await readFile(new URL('./fixtures/model.docx', import.meta.url)), 'docx');
  assert.match(result, /Fotossíntese/);
});

test('PowerPoint preserva ordem numérica dos slides e ignora animações', async () => {
  const slides = Array.from({ length: 12 }, (_, i) => `Slide ${i + 1}: ${text}`);
  const result = await extractClassMaterial(await pptx(slides), 'pptx');
  assert.ok(result.indexOf('Slide 2:') < result.indexOf('Slide 10:'));
  assert.match(result, /fotossíntese/);
});

test('PDF real com texto é extraído; PDF vazio não pode liberar geração sem fontes', async () => {
  const pdf = new jsPDF();
  pdf.text('Plants use sunlight and water to produce sugars through photosynthesis.', 15, 20);
  const result = await extractClassMaterial(Buffer.from(pdf.output('arraybuffer')), 'pdf');
  assert.match(result, /photosynthesis/);
  const blank = new jsPDF();
  await assert.rejects(extractClassMaterial(Buffer.from(blank.output('arraybuffer')), 'pdf'), /texto selecionável/);
});

test('recusa formatos falsos, macros, XML com entidades, texto vazio e material excessivo', async () => {
  await assert.rejects(extractClassMaterial(Buffer.from('fake'), 'pdf'), /PDF inválido/);
  await assert.rejects(extractClassMaterial(Buffer.from('fake'), 'exe'), /Formato/);
  await assert.rejects(extractClassMaterial(await pptx(['']), 'pptx'), /vazio/);
  await assert.rejects(extractClassMaterial(await pptx(['a'.repeat(60001)]), 'pptx'), /longo/);
  const zip = await JSZip.loadAsync(await pptx());
  zip.file('ppt/vbaProject.bin', 'macro');
  await assert.rejects(extractClassMaterial(await zip.generateAsync({ type: 'nodebuffer' }), 'pptx'), /Macros/);
  zip.remove('ppt/vbaProject.bin');
  zip.file('ppt/slides/slide1.xml', '<!DOCTYPE s [<!ENTITY x SYSTEM "file:///secret">]><s>&x;</s>');
  await assert.rejects(extractClassMaterial(await zip.generateAsync({ type: 'nodebuffer' }), 'pptx'), /XML não permitido/);
});

test('PPT antigo converte uma vez para PPTX e propaga falha de conversão', async () => {
  let conversions = 0;
  const result = await extractClassMaterial(Buffer.from('legacy'), 'ppt', async (_, format) => { conversions++; assert.equal(format, 'pptx'); return pptx(); });
  assert.equal(conversions, 1); assert.match(result, /fotossíntese/);
  await assert.rejects(extractClassMaterial(Buffer.from('legacy'), 'ppt', async () => { throw Error('falha no conversor'); }), /falha no conversor/);
});

test('ordem editada no PowerPoint segue a apresentação, não o nome do arquivo', async () => {
  const zip = await JSZip.loadAsync(await pptx([`Primeiro ${text}`, `Segundo ${text}`]));
  zip.file('ppt/presentation.xml', '<p:presentation xmlns:p="urn:p" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldId r:id="r2"/><p:sldId r:id="r1"/></p:presentation>');
  zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/><Relationship Id="r2" Target="slides/slide2.xml"/></Relationships>');
  const result = await extractClassMaterial(await zip.generateAsync({ type: 'nodebuffer' }), 'pptx');
  assert.ok(result.indexOf('Segundo') < result.indexOf('Primeiro'));
});

test('lê DOC, PPTX e PPT reais pelo mesmo CLI usado pelo servidor', { timeout: 45000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), 'provaai-material-'));
  const input = join(folder, 'input.json');
  try {
    for (const extension of ['doc', 'pptx', 'ppt']) {
      await writeFile(input, JSON.stringify({ operation: 'class-material', extension,
        templatePath: fileURLToPath(new URL(`./fixtures/class-material.${extension}`, import.meta.url)) }));
      const start = performance.now();
      const { stdout } = await promisify(execFile)(process.execPath, ['--experimental-strip-types', 'scripts/render-document.mjs', input], { timeout: 40000 });
      const result = JSON.parse(stdout.trim().split('\n').at(-1));
      assert.match(result.text, /Fotossíntese|Photosynthesis/);
      console.log(`${extension.toUpperCase()} real: ${(performance.now() - start).toFixed(0)} ms, ${result.text.length} caracteres`);
    }
  } finally { await unlink(input).catch(() => {}); await rmdir(folder); }
});
