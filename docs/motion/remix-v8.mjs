// Rebuild the soundtrack and copy V7's native 120fps video without re-encoding.
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAudio} from './audio-v8.mjs';
const DIR=path.dirname(fileURLToPath(import.meta.url)),OUT=path.join(DIR,'output/v8'),FF=path.join(DIR,'ffmpeg.exe');
await mkdir(OUT,{recursive:true});console.log(await createAudio(OUT));
function ff(args){const r=spawnSync(FF,['-hide_banner','-nostats',...args],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw new Error(r.stderr);return r;}
const mix=path.join(OUT,'mix-v8.wav');
const pass1=ff(['-i',mix,'-af','loudnorm=I=-16:TP=-1.8:LRA=9:print_format=json','-f','null','-']);
const measured=JSON.parse(pass1.stderr.slice(pass1.stderr.lastIndexOf('{')));
const filter=`loudnorm=I=-16:TP=-1.8:LRA=9:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=json`;
const target=path.join(OUT,'Provaai-motion-v8-1080p-120fps.mp4');
ff(['-y','-i',path.join(DIR,'output/v7/Provaai-motion-v7-1080p-120fps.mp4'),'-i',mix,'-map','0:v:0','-map','1:a:0','-c:v','copy','-af',filter,'-c:a','aac','-b:a','256k','-ar','48000','-t','30','-movflags','+faststart',target]);
const audit=ff(['-i',target,'-vn','-af','loudnorm=I=-16:TP=-1.8:LRA=9:print_format=json','-f','null','-']);
const final=JSON.parse(audit.stderr.slice(audit.stderr.lastIndexOf('{')));
await writeFile(path.join(OUT,'loudness-final.json'),JSON.stringify({integratedLUFS:Number(final.input_i),truePeakDbTP:Number(final.input_tp),loudnessRangeLU:Number(final.input_lra),method:'two-pass loudnorm; video stream copied from V7'},null,2));
console.log('Concluído:',target);console.log({LUFS:final.input_i,truePeak:final.input_tp});
