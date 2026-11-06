import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser} from '@xmldom/xmldom';
import {fillDocxLayout} from '../lib/docx-layout.ts';
import {demoData} from '../lib/model.ts';

const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
async function template() {
  const zip=new JSZip();
  zip.file('word/document.xml',`<w:document xmlns:w="${W}"><w:body>
    <w:p><w:r><w:t>Nome do estudante: </w:t></w:r></w:p>
    <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Turma :</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>Tema</w:t></w:r></w:p>
    <w:p><w:r><w:t>Exercício antigo que deve ser substituído</w:t></w:r></w:p>
    <w:sectPr><w:pgMar w:top="1440" w:left="1440"/></w:sectPr>
    </w:body></w:document>`);
  zip.file('word/header1.xml','cabeçalho da instituição');
  zip.file('word/media/logo.png',new Uint8Array([137,80,78,71]));
  zip.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Target="header1.xml"/><Relationship Id="r2" Target="https://example.invalid" TargetMode="External"/></Relationships>');
  return zip.generateAsync({type:'uint8array'});
}
test('modelo mantém cabeçalho, imagem, margens e estilo; substitui campos e atividades',async()=>{
  const exam=demoData().exams[0];
  exam.title='Cálculo ∫ ≤ ∞';
  exam.profile_snapshot.name='Ana & João <A>';
  const bytes=await fillDocxLayout(await template(),exam,'Turma B','',false);
  const zip=await JSZip.loadAsync(bytes);
  const xml=await zip.file('word/document.xml')!.async('string');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  assert.match(doc.documentElement!.textContent!,/Ana & João <A>/);
  for(const text of ['Turma : Turma B','Cálculo ∫ ≤ ∞','w:top="1440"','w:val="center"'])assert.ok(xml.includes(text));
  assert.ok(!xml.includes('Exercício antigo'));
  assert.ok(!xml.includes('Resposta:'));
  assert.equal(await zip.file('word/header1.xml')!.async('string'),'cabeçalho da instituição');
  assert.deepEqual(await zip.file('word/media/logo.png')!.async('uint8array'),new Uint8Array([137,80,78,71]));
  const rels=await zip.file('word/_rels/document.xml.rels')!.async('string');
  assert.ok(rels.includes('header1.xml'));
  assert.ok(!rels.includes('example.invalid'));
  assert.ok(xml.includes('w:keepNext'));
});
test('gabarito usa o mesmo modelo e separa respostas da prova do aluno',async()=>{
  const exam=demoData().exams[0];
  const zip=await JSZip.loadAsync(await fillDocxLayout(await template(),exam,'7º A','',true));
  const xml=await zip.file('word/document.xml')!.async('string');
  assert.ok(xml.includes('Gabarito · '));
  assert.ok(xml.includes('Resposta: '+exam.content.questions[0].answer));
  assert.ok(!xml.includes('________________________________________________________'));
});
test('arquivos que não são DOCX e objetos incorporados são rejeitados',async()=>{
  const exam=demoData().exams[0];
  await assert.rejects(fillDocxLayout(new Uint8Array([1,2]),exam,'','',false));
  const zip=await JSZip.loadAsync(await template());
  zip.file('word/embeddings/active.bin','object');
  await assert.rejects(fillDocxLayout(await zip.generateAsync({type:'uint8array'}),exam,'','',false),/incorporados/);
});
