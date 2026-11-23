/* Leitura de materiais: somente texto. Não executa macros, animações, scripts ou URLs dos arquivos. */
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_TEXT = 60000;
function checked(text) {
  const clean = text.replace(/\u0000/g, '').trim();
  if (clean.length < 40 || clean.length > MAX_TEXT) throw Error('Material vazio, digitalizado ou muito longo.');
  return clean;
}

async function officeXml(bytes, extension) {
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.values(zip.files);
  if (entries.length > 2000) throw Error('Arquivo complexo demais.');
  // Conferência pelo diretório central evita descompactar uma bomba ZIP.
  let expanded = 0;
  for (let offset = 0; offset + 46 <= bytes.length; offset++) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) continue;
    expanded += bytes.readUInt32LE(offset + 24);
    if (expanded > 40 * 1024 * 1024) throw Error('Arquivo expandido grande demais.');
    offset += 45 + bytes.readUInt16LE(offset + 28) + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
  }
  if (entries.some(entry => /vbaProject\.bin$/i.test(entry.name))) throw Error('Macros não são aceitas.');
  const parse = xml => {
    if (/<!\s*(DOCTYPE|ENTITY)/i.test(xml)) throw Error('XML não permitido.');
    return new DOMParser({ onError: () => { throw Error('XML inválido.'); } }).parseFromString(xml, 'text/xml');
  };
  // Além do tamanho declarado, limita o texto efetivamente descompactado, antes de montar o XML.
  const readXml = name => new Promise((resolve, reject) => {
    const entry = zip.file(name);
    if (!entry) { reject(Error('Estrutura do Office inválida.')); return; }
    let size = 0;
    const chunks = [];
    const stream = entry.internalStream('uint8array');
    stream.on('data', chunk => {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) { stream.pause(); reject(Error('XML expandido grande demais.')); return; }
      chunks.push(chunk);
    }).on('error', reject).on('end', () => {
      try { resolve(parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); }
    }).resume();
  });
  let names = extension === 'docx' ? ['word/document.xml'] : entries.map(e => e.name)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
  // Quando o professor reorganiza os slides, os nomes dos arquivos não mudam; usa a ordem da apresentação.
  if (extension === 'pptx' && zip.file('ppt/presentation.xml')) {
    const presentation = await readXml('ppt/presentation.xml');
    const relations = await readXml('ppt/_rels/presentation.xml.rels');
    const targets = new Map(Array.from(relations.getElementsByTagNameNS('*', 'Relationship'))
      .filter(r => r.getAttribute('TargetMode') !== 'External').map(r => [r.getAttribute('Id'), posix.normalize(posix.join('ppt', r.getAttribute('Target') ?? ''))]));
    names = Array.from(presentation.getElementsByTagNameNS('*', 'sldId')).map(s => targets.get(s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')));
    if (names.some(name => !name || !/^ppt\/slides\/[^/]+\.xml$/.test(name))) throw Error('Referência de slide inválida.');
  }
  if (!names.length || names.length > 150) throw Error('Use até 150 slides com texto.');
  const parts = [];
  for (const name of names) {
    const doc = await readXml(name);
    const paragraphs = Array.from(doc.getElementsByTagNameNS('*', 'p'));
    const text = paragraphs.map(p => Array.from(p.getElementsByTagNameNS('*', 't')).map(t => t.textContent).join('')).join('\n');
    if (extension === 'pptx' && !text.trim()) throw Error('Slide vazio ou sem texto selecionável.');
    parts.push(text);
    if (parts.join('\n').length > MAX_TEXT) throw Error('Texto longo demais.');
  }
  return checked(parts.join('\n\n'));
}

export async function extractClassMaterial(bytes, extension, convertOffice) {
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw Error('Use até 20 MB.');
  if (extension === 'pdf') {
    if (bytes.subarray(0, 5).toString() !== '%PDF-') throw Error('PDF inválido.');
    const root = join(process.cwd(), 'node_modules', 'pdfjs-dist');
    await import('@napi-rs/canvas');
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(join(root, 'legacy/build/pdf.worker.mjs')).href;
    const task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false,
      standardFontDataUrl: join(root, 'standard_fonts')+'/', stopAtErrors: true });
    try {
      const doc = await task.promise;
      if (doc.numPages > 150) throw Error('Use até 150 páginas.');
      const pages = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map(item => item.str ?? '').join(' ').trim();
        // Não descarta páginas sem texto silenciosamente: poderiam conter todo o assunto em imagem.
        if (text.length < 10) throw Error('Página sem texto selecionável. Faça OCR ou remova páginas vazias.');
        pages.push(text);
        if (pages.join('\n').length > MAX_TEXT) throw Error('Texto longo demais.');
        page.cleanup();
      }
      return checked(pages.join('\n\n'));
    } finally { await task.destroy(); }
  }
  if (extension === 'doc') {
    const { default: WordExtractor } = await import('word-extractor');
    return checked((await new WordExtractor().extract(bytes)).getBody());
  }
  if (extension === 'ppt') return officeXml(Buffer.from(await convertOffice(bytes, 'pptx', 'ppt')), 'pptx');
  if (extension === 'docx' || extension === 'pptx') return officeXml(bytes, extension);
  throw Error('Formato não aceito.');
}
