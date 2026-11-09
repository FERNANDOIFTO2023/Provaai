// Executar após npm run build: node --experimental-strip-types tests/pdf-build-smoke.mjs
// Usa somente documentos sintéticos e respostas locais, sem acesso a contas reais.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { jsPDF } from 'jspdf';
import { demoData } from '../lib/model.ts';
const original = new jsPDF();
original.setFillColor(20,100,180); original.rect(0,0,210,35,'F');
original.text('ESCOLA EXEMPLO',20,20);
original.text('PERGUNTA ANTIGA CONFIDENCIAL',20,140);
const source = original.output('arraybuffer');
const id = '11111111-1111-4111-8111-111111111111';
const template = {id,filename:'modelo.pdf',path:'teacher/modelo.pdf',pdf_header_ratio:0.2,processing_status:'ready'};
const exam = demoData().exams[0]; exam.status='approved'; exam.template_id=id;
exam.content.questions = Array.from({length:12},(_,i)=>({...exam.content.questions[0],
  statement:`Questão nova ${i+1}: √9 ≤ 3; ½ × 2`,type:'essay',options:[],answer:'RESPOSTA RESERVADA'}));
const previousFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const url = new URL(input instanceof Request ? input.url : input);
  if(url.pathname==='/auth/v1/user') return Response.json({id:'teacher'});
  if(url.pathname.includes('/rest/v1/sala_templates')) return Response.json(template);
  if(url.pathname.includes('/rest/v1/sala_exams')) return Response.json(exam);
  if(url.pathname.includes('/storage/v1/')) return new Response(source,{headers:{'Content-Type':'application/pdf'}});
  throw Error('Requisição inesperada: '+url.pathname);
};
try {
  const require = createRequire(import.meta.url);
  const preview = require('../.next/server/app/api/template/process/route.js').routeModule.userland.POST;
  const response = await preview(new Request('http://localhost/api/template/process',{
    method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({templateId:id,preview:true})}));
  assert.equal(response.status,200,response.status===200?'':await response.text());
  assert.equal(response.headers.get('content-type'),'image/png');
  assert.ok((await response.arrayBuffer()).byteLength>100);
  const exportExam = require('../.next/server/app/api/export/exam/route.js').routeModule.userland.POST;
  const output = await exportExam(new Request('http://localhost/api/export/exam',{
    method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({id,format:'pdf'})}));
  assert.equal(output.status,200,output.status===200?'':await output.text());
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = pdfjs.getDocument({data:new Uint8Array(await output.arrayBuffer())});
  try {
    const pdf=await loading.promise;let all='';assert.ok(pdf.numPages>1);
    for(let i=1;i<=pdf.numPages;i++) {
      const page=await pdf.getPage(i), content=await page.getTextContent();
      all+=content.items.map(x=>x.str||'').join(' ');
      const ops=await page.getOperatorList();
      assert.ok(ops.fnArray.includes(pdfjs.OPS.paintImageXObject));
      for(const item of content.items) if(item.str?.includes('Questão nova'))
        assert.ok(item.transform[5]<page.getViewport({scale:1}).height*0.8);
    }
    assert.match(all,/√9 ≤ 3/);assert.match(all,/Questão nova 12/);
    assert.doesNotMatch(all,/PERGUNTA ANTIGA|RESPOSTA RESERVADA/);
    console.log(`Build validado: prévia PNG, ${pdf.numPages} páginas, cabeçalho repetido, Unicode e conteúdo isolado.`);
  } finally {await loading.destroy();}
} finally {globalThis.fetch=previousFetch;}
// O worker do LibreOffice permaneceria ocioso por um minuto.
process.exit(0);
