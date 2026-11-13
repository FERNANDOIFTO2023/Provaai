import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, Header, Footer } from 'docx';
import { DOMParser } from '@xmldom/xmldom';
import { demoData } from '../lib/model.ts';
import { isMathematics, answerRows } from '../lib/answer-space.ts';
import { examFile } from '../lib/export.ts';
import { fillDocxLayout } from '../lib/docx-layout.ts';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
async function xml(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  return new DOMParser().parseFromString(await zip.file('word/document.xml')!.async('string'), 'application/xml');
}
function exam(subject: string) {
  const e = demoData().exams[0]; e.subject = subject; e.status = 'approved';
  e.content.questions = [{statement:'Resolva a atividade proposta.', type:'essay', options:[],answer:'Resposta do professor',objective:'Compreender',points:10}];
  return e;
}
test('espaço livre é escolhido pela matéria; outras disciplinas com fórmulas continuam pautadas', () => {
  for (const subject of ['Matemática', 'MATEMATICA FINANCEIRA', 'Cálculo I', 'Álgebra linear']) assert(isMathematics(subject));
  for (const subject of ['Português', 'Física', 'História', 'Química']) assert(!isMathematics(subject));
});
test('Word padrão reserva espaço sem linhas em matemática e pauta até a margem nas outras matérias', async () => {
  for (const subject of ['Matemática', 'Português']) {
    const doc = await xml(new Uint8Array(await (await examFile(exam(subject),'docx')).arrayBuffer()));
    const leaders = Array.from(doc.getElementsByTagNameNS(W,'tab')).filter(n=>n.getAttributeNS(W,'leader')==='underscore');
    assert.equal(leaders.length, subject === 'Matemática' ? 0 : answerRows);
    leaders.forEach(n=>assert.equal(n.getAttributeNS(W,'pos'),'9906'));
    assert.equal(Array.from(doc.getElementsByTagNameNS(W,'spacing')).filter(n=>n.getAttributeNS(W,'line')==='360').length, answerRows);
  }
});
test('modelo Word usa cabeçalho apenas na primeira folha, mantém rodapé e pauta entre margens', async () => {
  const template = new Uint8Array(await Packer.toArrayBuffer(new Document({sections:[{
    headers:{default:new Header({children:[new Paragraph('CABEÇALHO DA ESCOLA')]})},
    footers:{default:new Footer({children:[new Paragraph('RODAPÉ DA ESCOLA')]})},
    children:[new Paragraph('Aluno:'),new Paragraph('Atividade antiga')],
    properties:{page:{margin:{left:1200,right:1200}}},
  }]})));
  for (const subject of ['Matemática','Português']) {
    const doc=await xml(await fillDocxLayout(template,exam(subject),'7º A','Professor',false));
    const headers=Array.from(doc.getElementsByTagNameNS(W,'headerReference'));
    assert.equal(headers.length,1);assert.equal(headers[0].getAttributeNS(W,'type'),'first');
    assert.equal(doc.getElementsByTagNameNS(W,'titlePg').length,1);
    assert.deepEqual(Array.from(doc.getElementsByTagNameNS(W,'footerReference')).map(f=>f.getAttributeNS(W,'type')).sort(),['default','first']);
    assert.equal(doc.getElementsByTagNameNS(W,'pBdr').length,subject==='Matemática'?0:answerRows);
    assert.equal(doc.getElementsByTagNameNS(W,'pgMar')[0].getAttributeNS(W,'left'),'1200');
  }
});
