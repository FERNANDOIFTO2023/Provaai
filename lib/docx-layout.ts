import JSZip from 'jszip';
import { DOMParser, XMLSerializer, type Element as XmlElement } from '@xmldom/xmldom';
import type { Exam } from './model.ts';
import { formatDocxMath } from './docx-math.ts';
import { isMathematics, answerRows, answerRowTwips } from './answer-space.ts';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const elements = (node: XmlElement, tag: string) => Array.from(node.getElementsByTagNameNS(W, tag));
const wording = (node: XmlElement) => elements(node, 't').map(t => t.textContent).join('').trim();
const parse = (xml: string) => {
  if (/<!DOCTYPE/i.test(xml)) throw new Error('O modelo contém XML incompatível.');
  return new DOMParser().parseFromString(xml, 'application/xml');
};
const write = (node: ReturnType<typeof parse>) => new XMLSerializer().serializeToString(node);

export async function fillDocxLayout(bytes: Uint8Array, exam: Exam, room: string, teacher: string, key: boolean) {
  const zip = await JSZip.loadAsync(bytes);
  let expanded = 0;
  for (const part of Object.values(zip.files)) {
    expanded += (part as unknown as {_data?:{uncompressedSize:number}})._data?.uncompressedSize ?? 0;
    if (expanded > 80 * 1024 * 1024 || /vbaProject|activeX\/|embeddings\/|altChunk/i.test(part.name))
      throw new Error('Use um DOCX sem macros ou objetos incorporados.');
    if (part.name.endsWith('.rels')) {
      const rels = parse(await part.async('string'));
      let changed = false;
      for (const rel of Array.from(rels.documentElement!.childNodes)) {
        if (rel.nodeType !== 1) continue;
        const link = rel as XmlElement;
        if (link.getAttribute('TargetMode')?.toLowerCase() === 'external') {
          rels.documentElement!.removeChild(link);
          changed = true;
        }
      }
      if (changed) zip.file(part.name, write(rels));
    }
  }
  const main = await zip.file('word/document.xml')?.async('string');
  if (!main) throw new Error('O arquivo não é um modelo DOCX válido.');
  const doc = parse(main);
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  if (!body) throw new Error('O modelo não tem corpo de documento.');
  const blocks = Array.from(body.childNodes).filter(n => n.nodeType === 1).map(n => n as XmlElement);
  const section = blocks.findLast(n=>n.localName === 'sectPr') ?? null;
  const title = key ? 'Gabarito · ' + exam.title : exam.title;
  let anchor = -1, hasTitle = false, hasStudent = false;
  const fields = [
    {pattern:/^(?:nome (?:do|da|do\(a\)) )?(?:estudante|alun[oa](?:\(a\))?)\s*:/i,value:exam.profile_snapshot.name,student:true},
    {pattern:/^turma\s*:/i,value:room},
    {pattern:/^(?:nome (?:do|da) )?professor(?:a|\(a\))?\s*:/i,value:teacher},
    {pattern:/^(?:disciplina|matéria)\s*:/i,value:exam.subject},
  ];
  for (const [index, block] of blocks.entries()) {
    if (block === section) continue;
    const paragraphs = block.localName === 'p' ? [block] : elements(block,'p');
    for (const para of paragraphs) {
      const text = wording(para);
      const theme = /^(tema|título)(?:\s*:\s*[_…]*)?$/i.test(text);
      const field = fields.find(f => f.pattern.test(text) && /^[\s_.…]*$/.test(text.replace(f.pattern,'')));
      if (!field && !theme) continue;
      const runs = elements(para,'t');
      if (!runs.length) continue;
      const label = field && text.match(field.pattern)?.[0];
      runs[0].textContent = theme ? title : label + ' ' + (field?.value || '________________');
      for (const run of runs.slice(1)) run.textContent='';
      anchor = index;
      if (theme) hasTitle = true;
      if (field?.student) hasStudent = true;
    }
  }
  // Conteúdo didático preexistente orienta a IA, mas não vira uma segunda prova no arquivo.
  for (const [index, block] of blocks.entries()) {
    if (block !== section && index > anchor) body.removeChild(block);
  }
  // The model's body appears once. Collapse retained section breaks so a first-page
  // header cannot restart later in the same exam.
  for (const properties of Array.from(doc.getElementsByTagNameNS(W, 'sectPr'))) {
    if (properties !== section) properties.parentNode!.removeChild(properties);
  }
  if (section) {
    const headers = elements(section, 'headerReference');
    const first = headers.find(h => h.getAttributeNS(W, 'type') === 'first') ??
      headers.find(h => h.getAttributeNS(W, 'type') === 'default') ?? headers[0];
    for (const reference of headers) {
      if (reference === first) reference.setAttributeNS(W, 'w:type', 'first');
      else reference.parentNode!.removeChild(reference);
    }
    if (first) {
      const footers = elements(section, 'footerReference');
      if (!footers.some(f => f.getAttributeNS(W, 'type') === 'first')) {
        const regularFooter = footers.find(f => f.getAttributeNS(W, 'type') === 'default');
        if (regularFooter) {
          const firstFooter = regularFooter.cloneNode(true) as XmlElement;
          firstFooter.setAttributeNS(W, 'w:type', 'first');
          section.insertBefore(firstFooter, regularFooter);
        }
      }
      const titlePage = elements(section, 'titlePg')[0] ?? doc.createElementNS(W, 'w:titlePg');
      titlePage.setAttributeNS(W, 'w:val', 'true');
      if (!titlePage.parentNode) section.appendChild(titlePage);
    }
  }
  function paragraph(text: string, options: {bold?:boolean;keepNext?:boolean;lines?:boolean} = {}) {
    const p = doc.createElementNS(W,'w:p');
    const props=doc.createElementNS(W,'w:pPr');
    props.appendChild(doc.createElementNS(W,'w:keepLines'));
    if (options.keepNext) props.appendChild(doc.createElementNS(W,'w:keepNext'));
    const spacing=doc.createElementNS(W,'w:spacing');
    spacing.setAttributeNS(W,'w:after',options.lines?'60':'100');
    if (options.lines) {
      spacing.setAttributeNS(W,'w:before','0');
      spacing.setAttributeNS(W,'w:after','0');
      spacing.setAttributeNS(W,'w:line',String(answerRowTwips));
      spacing.setAttributeNS(W,'w:lineRule','exact');
      const indent = doc.createElementNS(W, 'w:ind');
      indent.setAttributeNS(W, 'w:left', '0');
      indent.setAttributeNS(W, 'w:right', '0');
      props.appendChild(indent);
      if (!isMathematics(exam.subject)) {
        const borders = doc.createElementNS(W, 'w:pBdr');
        for (const name of ['bottom', 'between']) {
          const border = doc.createElementNS(W, 'w:' + name);
          for (const [key, value] of Object.entries({val:'single', sz:'4', color:'737373', space:'0'})) border.setAttributeNS(W, 'w:' + key, value);
          borders.appendChild(border);
        }
        props.appendChild(borders);
      }
    }
    props.appendChild(spacing);
    p.appendChild(props);
    const run=doc.createElementNS(W,'w:r');
    if (options.bold) {
      const style=doc.createElementNS(W,'w:rPr');
      style.appendChild(doc.createElementNS(W,'w:b'));
      run.appendChild(style);
    }
    text.split(/\r?\n/).forEach((line,i)=>{
      if (i) run.appendChild(doc.createElementNS(W,'w:br'));
      const t=doc.createElementNS(W,'w:t'); t.textContent=line;run.appendChild(t);
    });
    p.appendChild(run);
    body.insertBefore(p, section);
  }
  if (!hasTitle) paragraph(title,{bold:true,keepNext:true});
  if (!hasStudent) paragraph('Aluno: '+exam.profile_snapshot.name+(room?' · Turma: '+room:''));
  if (exam.content.instructions) paragraph(exam.content.instructions);
  exam.content.questions.forEach((q,i)=>{
    paragraph(`${i+1}. ${q.statement} (${q.points} ${q.points===1?'ponto':'pontos'})`,{bold:true,keepNext:true});
    if (key) paragraph('Resposta: '+q.answer);
    else if (q.type==='objective') q.options.forEach((o,j)=>paragraph(String.fromCharCode(65+j)+') '+o,{keepNext:j<q.options.length-1}));
    else for(let line=0;line<answerRows;line++) paragraph('',{lines:true,keepNext:line<answerRows-1});
  });
  zip.file('word/document.xml',write(doc));
  return formatDocxMath(await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}));
}
