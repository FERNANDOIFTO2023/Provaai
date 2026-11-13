import JSZip from 'jszip';
import { DOMParser, XMLSerializer, type Element, type Document } from '@xmldom/xmldom';
import { mml2omml } from 'mathml2omml';
import { renderFormula } from './math-render.ts';
import { hasMath, splitMath, type MathPart } from './math-text.ts';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const MML = 'http://www.w3.org/1998/Math/MathML';
const supported = new Set('math semantics mrow mi mn mo mtext ms mspace mfrac msqrt mroot msup msub msubsup munder mover munderover mmultiscripts mtable mtr mtd mstyle menclose'.split(' '));
const message = 'PROVAAI_INVALID_MATH: Confira as fórmulas na revisão da prova antes de baixar.';

function repairOfficeStructures(doc: Document) {
  // The converter can leave an integral's argument next to an empty m:e.
  // Office renders that empty argument as a square placeholder.
  for (const nary of Array.from(doc.getElementsByTagNameNS(M, 'nary'))) {
    const argument = Array.from(nary.childNodes).find(n => n.nodeType === 1 && n.localName === 'e');
    if (!argument || argument.hasChildNodes()) continue;
    let next = nary.nextSibling;
    while (next && !next.textContent?.trim()) next = next.nextSibling;
    if (next) argument.appendChild(next);
    else {
      const run = doc.createElementNS(M, 'm:r');
      const text = doc.createElementNS(M, 'm:t');
      text.textContent = '\u200b';
      run.appendChild(text);
      argument.appendChild(run);
    }
  }
  // Matrix fences must stretch to all rows, rather than being ordinary glyphs.
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', '∣': '∣', '|': '|', '∥': '∥', '‖': '‖' };
  for (const matrix of Array.from(doc.getElementsByTagNameNS(M, 'm'))) {
    const before = matrix.previousSibling as Element | null;
    const after = matrix.nextSibling as Element | null;
    const left = before?.textContent ?? '';
    const right = after?.textContent ?? '';
    if (before?.localName !== 'r' || after?.localName !== 'r' || !pairs[left] || pairs[left] !== right) continue;
    const fence = doc.createElementNS(M, 'm:d');
    const props = doc.createElementNS(M, 'm:dPr');
    for (const [name, value] of [['begChr', left.replace('∣', '|')], ['endChr', right.replace('∣', '|')], ['grow', '1']]) {
      const prop = doc.createElementNS(M, 'm:' + name);
      prop.setAttributeNS(M, 'm:val', value);
      props.appendChild(prop);
    }
    fence.appendChild(props);
    const body = doc.createElementNS(M, 'm:e');
    const parent = matrix.parentNode!;
    parent.insertBefore(fence, before);
    body.appendChild(matrix);
    fence.appendChild(body);
    parent.removeChild(before);
    parent.removeChild(after);
  }
}

export function formulaToOmml(part: Extract<MathPart, { kind: 'math' }>): string {
  try {
    const rendered = renderFormula(part, 'mathml');
    const xml = rendered.slice(rendered.indexOf('<math'), rendered.lastIndexOf('</math>') + 7);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    for (const annotation of Array.from(doc.getElementsByTagNameNS(MML, 'annotation'))) annotation.parentNode!.removeChild(annotation);
    for (const element of Array.from(doc.getElementsByTagName('*'))) {
      if (!supported.has(element.localName!)) throw new Error(message);
      // Preserve blackboard-bold sets even in Office converters without mathvariant support.
      if (element.getAttribute('mathvariant') === 'double-struck') {
        const special: Record<string, string> = { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' };
        element.textContent = Array.from(element.textContent ?? '').map(c => special[c] ??
          (/[A-Z]/.test(c) ? String.fromCodePoint(0x1d538 + c.charCodeAt(0) - 65) :
          /[a-z]/.test(c) ? String.fromCodePoint(0x1d552 + c.charCodeAt(0) - 97) :
          /[0-9]/.test(c) ? String.fromCodePoint(0x1d7d8 + Number(c)) : c)).join('');
        element.removeAttribute('mathvariant');
      }
    }
    const omml = mml2omml(new XMLSerializer().serializeToString(doc));
    const result = new DOMParser().parseFromString(omml, 'application/xml');
    if (result.documentElement?.namespaceURI !== M || result.documentElement.localName !== 'oMath' || !result.getElementsByTagNameNS(M, 't').length) throw new Error(message);
    repairOfficeStructures(result);
    // Word and LibreOffice use this mathematical font for extensible symbols.
    for (const run of Array.from(result.getElementsByTagNameNS(M, 'r'))) {
      for (const previous of Array.from(run.childNodes).filter(n => n.nodeType === 1 && n.localName === 'rPr' && n.namespaceURI === W)) run.removeChild(previous);
      const properties = result.createElementNS(W, 'w:rPr');
      const font = result.createElementNS(W, 'w:rFonts');
      font.setAttributeNS(W, 'w:ascii', 'Cambria Math');
      font.setAttributeNS(W, 'w:hAnsi', 'Cambria Math');
      properties.appendChild(font);
      const mathProperties = Array.from(run.childNodes).find(n => n.nodeType === 1 && (n as Element).namespaceURI === M && n.localName === 'rPr');
      run.insertBefore(properties, mathProperties ? mathProperties.nextSibling : run.firstChild);
    }
    return new XMLSerializer().serializeToString(result);
  } catch {
    throw new Error(message);
  }
}

function textRun(doc: Document, text: string, style?: Element): Element {
  const run = doc.createElementNS(W, 'w:r');
  if (style) run.appendChild(style.cloneNode(true));
  text.split(/\r?\n/).forEach((line, i) => {
    if (i) run.appendChild(doc.createElementNS(W, 'w:br'));
    const t = doc.createElementNS(W, 'w:t');
    t.setAttribute('xml:space', 'preserve');
    t.textContent = line;
    run.appendChild(t);
  });
  return run;
}

/** Replace generated LaTeX runs with editable equations, preserving the DOCX layout. */
export async function formatDocxMath(bytes: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  const source = await zip.file('word/document.xml')?.async('string');
  if (!source) throw new Error('Documento Word inválido.');
  if (!hasMath(source)) return bytes;
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  let changed = false;
  for (const run of Array.from(doc.getElementsByTagNameNS(W, 'r'))) {
    const children = Array.from(run.childNodes).filter(n => n.nodeType === 1) as Element[];
    // Do not rewrite drawings, fields, links, or existing native equations.
    if (children.some(n => n.namespaceURI !== W || !['rPr', 't', 'br'].includes(n.localName!))) continue;
    const text = children.map(n => n.localName === 't' ? n.textContent : n.localName === 'br' ? '\n' : '').join('');
    if (!hasMath(text)) continue;
    const style = children.find(n => n.localName === 'rPr');
    const parent = run.parentNode!;
    for (const part of splitMath(text)) {
      if (part.kind === 'text') parent.insertBefore(textRun(doc, part.text, style), run);
      else {
        const equation = new DOMParser().parseFromString(formulaToOmml(part), 'application/xml').documentElement!;
        if (part.display) parent.insertBefore(textRun(doc, '\n'), run);
        parent.insertBefore(doc.importNode(equation, true), run);
        if (part.display) parent.insertBefore(textRun(doc, '\n'), run);
      }
    }
    parent.removeChild(run);
    changed = true;
  }
  if (!changed) return bytes;
  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
