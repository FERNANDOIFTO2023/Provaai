import test from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { pdfHeader, headerRatio } from '../lib/pdf-header.ts';
import { examFile } from '../lib/export.ts';
import { demoData } from '../lib/model.ts';
import JSZip from 'jszip';
import { createCanvas, loadImage } from '@napi-rs/canvas';

test('cabeçalho escaneado em alta resolução não perde a imagem',async()=>{
  const scan=createCanvas(2200,3200), ctx=scan.getContext('2d');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,2200,3200);
  ctx.fillStyle='#1464b4';ctx.fillRect(0,0,2200,800);
  const source=new jsPDF({compress:true});source.addImage(new Uint8Array(scan.toBuffer('image/png')),'PNG',0,0,210,297);
  const header=await pdfHeader(new Uint8Array(source.output('arraybuffer')),0.2);
  const decoded=await loadImage(header.image), output=createCanvas(decoded.width,decoded.height);
  const context=output.getContext('2d');context.drawImage(decoded,0,0);
  const pixel=context.getImageData(100,100,1,1).data;
  assert.ok(pixel[2]>150 && pixel[0]<50,'a faixa azul escaneada deve ser preservada');
});

test('PDF usa só pixels do cabeçalho, repete nas páginas e não leva perguntas antigas nem gabarito',async()=>{
  const source=new jsPDF();
  source.setFillColor(20,100,180);source.rect(0,0,210,35,'F');
  source.text('ESCOLA EXEMPLO',20,20);
  source.text('PERGUNTA ANTIGA CONFIDENCIAL',20,140);
  source.addPage();source.text('OUTRA QUESTAO ANTIGA',20,20);
  const bytes=new Uint8Array(source.output('arraybuffer'));
  const header=await pdfHeader(bytes,0.2);
  assert.ok(Math.abs(header.width-210)<0.01);
  assert.ok(Math.abs(header.headerHeight-59.4)<0.01);
  const exam=demoData().exams[0];exam.status='approved';
  exam.content.questions=Array.from({length:12},(_,i)=>({...exam.content.questions[0],statement:`Questão nova ${i+1}`,type:'essay',options:[],answer:'RESPOSTA RESERVADA'}));
  const blob=await examFile(exam,'pdf',false,header);
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer())});
  try {
    const pdf=await loading.promise;
    assert.ok(pdf.numPages>1);
    let all='';
    for(let n=1;n<=pdf.numPages;n++) {
      const page=await pdf.getPage(n);
      const content=await page.getTextContent();
      all+=content.items.map(i=>'str' in i?i.str:'').join(' ');
      const ops=await page.getOperatorList();
      assert.ok(ops.fnArray.includes(pdfjs.OPS.paintImageXObject),'cabeçalho deve aparecer em cada página');
      for(const item of content.items) if('str' in item && item.str.startsWith('Questão nova'))
        assert.ok(item.transform[5] < page.getViewport({scale:1}).height*(1-0.2));
    }
    assert.match(all,/Questão nova 12/);
    assert.doesNotMatch(all,/PERGUNTA ANTIGA|OUTRA QUESTAO|RESPOSTA RESERVADA/);
  } finally {await loading.destroy();}
  const key=await examFile(exam,'pdf',true,header);
  assert.match(await key.text(),/RESPOSTA RESERVADA/);
  const docx=await JSZip.loadAsync(await (await examFile(exam,'docx',false,header)).arrayBuffer());
  assert.ok(docx.file(/word\/header\d+\.xml/).length);
  assert.ok(docx.file(/word\/media\/.+\.png/).length);
  assert.doesNotMatch(await docx.file('word/document.xml')!.async('string'),/PERGUNTA ANTIGA|OUTRA QUESTAO|RESPOSTA RESERVADA/);
});
test('PDF inválido e recortes fora do limite são recusados',async()=>{
  for(const value of [NaN,0,0.46,'0.2',null]) assert.throws(()=>headerRatio(value));
  await assert.rejects(pdfHeader(new TextEncoder().encode('arquivo falso')),/PDF válido/);
  await assert.rejects(pdfHeader(new TextEncoder().encode('%PDF-1.7 invalid')),/Não foi possível/);
});
