// Processo auxiliar de conversão. Não oferece HTTP, autenticação ou acesso ao banco.
import { readFile, writeFile } from 'node:fs/promises';
import { pdfHeader } from '../lib/pdf-header.ts';
import { examFile } from '../lib/export.ts';
import { fillDocxLayout } from '../lib/docx-layout.ts';
import { officePdf, disposeOfficeRuntime } from '../lib/office-pdf.ts';
import WordExtractor from 'word-extractor';
try {
  const input=JSON.parse(await readFile(process.argv[2],'utf8'));
  const bytes=input.templatePath?new Uint8Array(await readFile(input.templatePath)):undefined;
  let result;
  if(input.operation==='word') {
    const doc=await new WordExtractor().extract(Buffer.from(bytes));const text=doc.getBody();
    if(text.trim().length<20 || text.length>60000)throw Error('Use Word legível, com 20 a 60.000 caracteres.');
    result = {text};
  } else if(input.operation==='header') {
    const header=await pdfHeader(bytes,input.ratio);
    result = {...header,image:Buffer.from(header.image).toString('base64')};
  } else if(input.operation==='export') {
    const header=input.header?{...input.header,image:new Uint8Array(Buffer.from(input.header.image,'base64'))}:undefined;
    const doc=bytes && /\.docx$/i.test(input.filename)
      ? await fillDocxLayout(bytes,input.exam,input.className,input.teacherName,input.answerKey)
      : new Uint8Array(await(await examFile(input.exam,'docx',input.answerKey,header)).arrayBuffer());
    const output=input.format==='pdf'?await officePdf(doc):doc;
    await writeFile(input.outputPath,output);
    result = {ok:true};
  } else throw Error('Operação inválida.');
  // O Laravel lê por um pipe. Cabeçalhos grandes exigem várias escritas antes da saída.
  await new Promise((resolve, reject) => {
    process.stdout.write(JSON.stringify(result) + '\n', error => error ? reject(error) : resolve());
  });
} catch(error) {console.error(error instanceof Error?error.message:'Falha ao converter documento.');process.exitCode=1;}
finally {await disposeOfficeRuntime();}
process.exit(process.exitCode ?? 0);
