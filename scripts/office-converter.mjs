import { createRequire } from 'node:module';

/**
 * Inicializa o LibreOffice como biblioteca, exclusivamente pela API LibreOfficeKit.
 * O loader padrão também chama main() automaticamente em outro pthread. Deixar esse
 * início automático competir com libreofficekit_hook() pode prender a inicialização.
 * noInitialRun impede a segunda entrada; não reduz o prazo nem descarta uma conversão.
 * Este helper só deve ser usado no processo CLI isolado, nunca no bundle do navegador.
 */
export async function createOfficeConverter() {
  const require = createRequire(import.meta.url);
  const { createConverter } = require('@matbee/libreoffice-converter/server');
  const loader = require('@matbee/libreoffice-converter/wasm/loader');

  return createConverter({
    wasmLoader: {
      createModule: options => loader.createModule({ ...options, noInitialRun: true }),
    },
  });
}
