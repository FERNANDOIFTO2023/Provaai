import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

// O artefato Laravel inclui o motor compactado, aberto pelo conversor ao exportar PDF.
const require = createRequire(import.meta.url);
const source = dirname(require.resolve('@matbee/libreoffice-converter/package.json'));
const files = ['dist/server.cjs','dist/node.worker.cjs','wasm/loader.cjs','wasm/soffice.cjs',
  'wasm/soffice.worker.cjs','wasm/soffice.worker.js','wasm/soffice.js','wasm/soffice.data','wasm/soffice.wasm'];
await mkdir('.office-runtime',{recursive:true});
for (const name of files) {
  await writeFile(join('.office-runtime',name.replace('/','_')+'.gz'),gzipSync(await readFile(join(source,name)),{level:6}));
}
// O conversor é carregado fora de node_modules; leve também sua dependência de validação.
const zod = dirname(require.resolve('zod/package.json'));
async function copyZod(relative = '') {
  for (const entry of await readdir(join(zod, relative), {withFileTypes:true})) {
    const path = relative ? relative + '/' + entry.name : entry.name;
    if (entry.isDirectory()) await copyZod(path);
    else if (/\.(?:cjs|js|json)$/.test(path)) {
      const name = 'dep_' + Buffer.from('node_modules/zod/' + path).toString('base64url') + '.gz';
      await writeFile(join('.office-runtime', name), gzipSync(await readFile(join(zod,path))));
    }
  }
}
await copyZod();
