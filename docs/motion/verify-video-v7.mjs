import {spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FPS,DURATION} from './timing-v7.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),out=path.join(dir,'output/v7');
const frames=path.join(out,'frames.framemd5');
const result=spawnSync(path.join(dir,'ffmpeg.exe'),['-hide_banner','-loglevel','error','-y','-i',path.join(out,'Provaai-motion-v7-1080p-120fps.mp4'),'-an','-fps_mode','passthrough','-f','framemd5',frames],{encoding:'utf8',windowsHide:true});
if(result.status!==0)throw new Error(result.stderr);
const source=await readFile(frames,'utf8'),rows=source.split('\n').filter(s=>s&&!s.startsWith('#')).map(s=>s.split(',').map(v=>v.trim()));
let repeated=0;for(let i=1;i<rows.length;i++){if(rows[i][5]===rows[i-1][5])repeated++;if(Number(rows[i][2])-Number(rows[i-1][2])!==1)throw new Error('Non-contiguous presentation timestamps');}
if(!source.includes('#tb 0: 1/120')||!source.includes('#dimensions 0: 1920x1080')||rows.length!==FPS*DURATION)throw new Error('Unexpected video format');
if(repeated>rows.length*.01)throw new Error('Excessive repeated frames');
const report={width:1920,height:1080,fps:FPS,frames:rows.length,duration:DURATION,adjacentDuplicateFrames:repeated,decode:'complete; no errors',timestamps:'continuous'};
await writeFile(path.join(out,'verificacao-video.json'),JSON.stringify(report,null,2));console.log(report);
