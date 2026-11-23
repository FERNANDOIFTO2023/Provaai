/*
 * Processos / conversor Node
 * Recebe um pedido JSON em arquivo privado criado pelo DocumentService e produz texto, cabeçalho ou
 * documento. A última linha de stdout é a resposta JSON consumida pelo PHP; mensagens de falha vão
 * para stderr.
 */
// Processo auxiliar de conversão. Não oferece HTTP, autenticação ou acesso ao banco.
import { readFile, writeFile } from 'node:fs/promises';
import { createOfficeConverter } from './office-converter.mjs';

let converter;
// Reutiliza o motor somente dentro deste processo isolado. O PHP já executa este CLI
// fora do servidor HTTP: não é necessário o wrapper WorkerConverter, que não permite
// configurar o loader para impedir a inicialização automática concorrente de main().
async function convertOffice(bytes, outputFormat, inputFormat) {
  converter ??= await createOfficeConverter();
  return (await converter.convert(bytes, { outputFormat, ...(inputFormat ? { inputFormat } : {}) })).data;
}

// Despacha a operação informada pelo PHP e carrega apenas as bibliotecas necessárias.
async function render(input) {
  if (input.operation === 'class-material') {
    const { extractClassMaterial } = await import('./class-material.mjs');
    return { text: await extractClassMaterial(await readFile(input.templatePath), input.extension, convertOffice) };
  }
  if (input.operation === 'convert') {
    await writeFile(input.outputPath, await convertOffice(await readFile(input.docxPath), 'pdf'));
    return { ok: true };
  }
  if (input.operation === 'word') {
    const { default: WordExtractor } = await import('word-extractor');
    const doc = await new WordExtractor().extract(await readFile(input.templatePath));
    const text = doc.getBody();
    if (text.trim().length < 20 || text.length > 60000) throw Error('Use Word legível, com 20 a 60.000 caracteres.');
    return { text };
  }
  if (input.operation === 'header') {
    const { pdfHeader } = await import('../lib/pdf-header.ts');
    const header = await pdfHeader(new Uint8Array(await readFile(input.templatePath)), input.ratio, input.fitBoundary);
    return { ...header, ratio: header.headerHeight / header.height, image: Buffer.from(header.image).toString('base64') };
  }
  if (input.operation !== 'export') throw Error('Operação inválida.');

  let doc;
  if (input.templatePath) {
    if (!/\.docx?$/i.test(input.filename)) throw Error('Formato de modelo incompatível.');
    const { fillDocxLayout } = await import('../lib/docx-layout.ts');
    const original = await readFile(input.templatePath);
    const layout = /\.doc$/i.test(input.filename) ? await convertOffice(original, 'docx') : original;
    doc = await fillDocxLayout(layout, input.exam, input.className, input.teacherName, input.answerKey);
  } else {
    const { examFile } = await import('../lib/export.ts');
    const header = input.header ? { ...input.header, image: Buffer.from(input.header.image, 'base64') } : undefined;
    doc = new Uint8Array(await (await examFile(input.exam, 'docx', input.answerKey, header)).arrayBuffer());
  }
  await writeFile(input.outputPath, input.format === 'pdf' ? await convertOffice(doc, 'pdf') : doc);
  return { ok: true };
}

// A saída estruturada precisa ser completamente escrita antes de encerrar o trabalhador.
try {
  const result = await render(JSON.parse(await readFile(process.argv[2], 'utf8')));
  await new Promise((resolve, reject) => {
    process.stdout.write(JSON.stringify(result) + '\n', error => error ? reject(error) : resolve());
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha ao converter documento.');
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
