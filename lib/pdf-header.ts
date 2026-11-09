import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export type PdfHeader = { image: Uint8Array; width: number; height: number; headerHeight: number };
export function headerRatio(value: unknown = 0.25) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.05 || value > 0.45)
    throw new Error('Escolha um cabeçalho entre 5% e 45% da primeira página.');
  return value;
}

// Renderizar somente pixels do cabeçalho impede levar texto oculto e questões antigas
// nos objetos internos do PDF exportado. Nenhuma URL do documento é aberta.
export async function pdfHeader(bytes: Uint8Array, ratio = 0.25): Promise<PdfHeader> {
  headerRatio(ratio);
  if (!bytes.length || bytes.length > 20 * 1024 * 1024 || new TextDecoder().decode(bytes.slice(0,5)) !== '%PDF-')
    throw new Error('Use um PDF válido, sem senha e de até 20 MB.');
  // Assets copiados pelo outputFileTracingIncludes, relativos à raiz do servidor.
  // require.resolve é convertido em identificador numérico pelo Turbopack.
  const root = join(process.cwd(),'node_modules','pdfjs-dist');
  const {createCanvas} = await import('@napi-rs/canvas');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(join(root,'legacy/build/pdf.worker.mjs')).href;
  const task = pdfjs.getDocument({data: new Uint8Array(bytes),
    useSystemFonts: false, standardFontDataUrl: join(root,'standard_fonts')+'/',
    cMapUrl: join(root,'cmaps')+'/', cMapPacked: true, wasmUrl: join(root,'wasm')+'/',
    stopAtErrors: true});
  try {
    const document = await task.promise;
    const page = await document.getPage(1);
    const original = page.getViewport({scale: 1});
    if (original.width < 200 || original.height < 200 || original.width > 1500 || original.height > 1500)
      throw new Error('Use um PDF com tamanho de página entre 7 e 52 cm.');
    const viewport = page.getViewport({scale: 2});
    const canvas = createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height * ratio));
    await page.render({canvas: canvas as never, canvasContext: canvas.getContext('2d') as never,
      viewport, background: 'rgb(255,255,255)', annotationMode: pdfjs.AnnotationMode.DISABLE}).promise;
    return {image: new Uint8Array(canvas.toBuffer('image/png')), width: original.width*25.4/72,
      height: original.height*25.4/72, headerHeight: original.height*ratio*25.4/72};
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Use um PDF')) throw error;
    throw new Error('Não foi possível abrir o PDF. Confira se está legível, sem senha e sem danos.');
  } finally { await task.destroy(); }
}
