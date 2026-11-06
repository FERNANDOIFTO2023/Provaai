import JSZip from 'jszip';
import { DOMParser, XMLSerializer, type Element as XmlElement } from '@xmldom/xmldom';
import type { Exam } from './model.ts';

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
  function paragraph(text: string, options: {bold?:boolean;keepNext?:boolean;lines?:boolean} = {}) {
    const p = doc.createElementNS(W,'w:p');
    const props=doc.createElementNS(W,'w:pPr');
    props.appendChild(doc.createElementNS(W,'w:keepLines'));
    if (options.keepNext) props.appendChild(doc.createElementNS(W,'w:keepNext'));
    const spacing=doc.createElementNS(W,'w:spacing');
    spacing.setAttributeNS(W,'w:after',options.lines?'60':'100');
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
    else for(let line=0;line<4;line++) paragraph('________________________________________________________',{lines:true,keepNext:line<3});
  });
  zip.file('word/document.xml',write(doc));
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
