import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';

let runtime: Promise<string> | undefined;
async function unpack() {
  const folder=await mkdtemp(join(tmpdir(),'provaai-office-'));
  const assets=join(process.cwd(),'.office-runtime');
  await mkdir(join(folder,'dist')); await mkdir(join(folder,'wasm'));
  for (const name of await readdir(assets)) {
    if (!/^(dist|wasm|dep)_[\w.-]+\.gz$/.test(name)) continue;
    const path=name.startsWith('dep_')
      ? Buffer.from(name.slice(4,-3),'base64url').toString('utf8')
      : name.replace('_','/').slice(0,-3);
    if (path.includes('..') || !/^(dist|wasm|node_modules\/zod)\//.test(path)) throw new Error('Runtime inválido.');
    await mkdir(dirname(join(folder,path)),{recursive:true});
    await writeFile(join(folder,path),gunzipSync(await readFile(join(assets,name))));
  }
  return folder;
}

type Converter = { convert: (input: Uint8Array, options: { outputFormat: string }) => Promise<{ data: Uint8Array }>; destroy: () => Promise<void> };
let converter: Converter | undefined;
let idle: ReturnType<typeof setTimeout> | undefined;
// Um worker por instância, com conversões sequenciais e descarte após um minuto ocioso.
let previous: Promise<unknown> = Promise.resolve();
export function officePdf(docx: Uint8Array): Promise<Uint8Array> {
  if (idle) clearTimeout(idle);
  const task=previous.then(async()=>{
    if (idle) clearTimeout(idle);
    const folder=await (runtime ??= unpack().catch(err=>{runtime=undefined;throw err;}));
    const requireRuntime=createRequire(join(folder,'converter.cjs'));
    const {createWorkerConverter}=requireRuntime('./dist/server.cjs');
    converter ??= await createWorkerConverter();
    try {
      const result=await converter!.convert(docx,{outputFormat:'pdf'});
      return result.data as Uint8Array;
    } catch (error) {
      const failed = converter;
      converter = undefined;
      await failed?.destroy();
      throw error;
    } finally {
      idle = setTimeout(() => {
        const retired = converter;
        converter = undefined;
        previous = previous.then(() => retired?.destroy()).catch(() => undefined);
      }, 60_000);
      idle.unref();
    }
  });
  previous=task.then(()=>undefined,()=>undefined);
  return task;
}
