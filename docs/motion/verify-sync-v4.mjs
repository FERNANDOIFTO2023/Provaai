// Verifies the actual exported AAC against the source mix, not only cue labels.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {events,FPS} from './timing-v4.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),out=path.join(dir,'output/v4');
const ff=process.env.FFMPEG_PATH||path.join(dir,'ffmpeg.exe');
const decoded=path.join(out,'audio-decodificado.f32');
const result=spawnSync(ff,['-hide_banner','-loglevel','error','-y','-i',path.join(out,'Provaai-motion-v4-1080p.mp4'),'-vn','-ac','1','-ar','48000','-f','f32le',decoded],{encoding:'utf8',windowsHide:true});
if(result.status!==0)throw new Error(result.stderr);
const wav=await readFile(path.join(out,'mix-v4.wav')),raw=await readFile(decoded),N=(wav.length-44)/4;
const a=new Float32Array(N),b=new Float32Array(raw.length/4);
for(let i=0;i<N;i++)a[i]=(wav.readInt16LE(44+i*4)+wav.readInt16LE(46+i*4))/65536;
for(let i=0;i<b.length;i++)b[i]=raw.readFloatLE(i*4);
const checks=events.filter(e=>e.type==='click'||e.type==='select'||e.type==='plink'||e.type==='glint'||e.id.startsWith('transition-'));
const measurements=[];
for(const event of checks){const start=Math.max(0,Math.round((event.time-.04)*48000)),count=7680;let best={correlation:-1,lag:0};
 for(let lag=-800;lag<=800;lag+=4){let aa=0,bb=0,ab=0;for(let i=0;i<count;i+=8){const k=start+i;if(k+lag<0||k+lag>=b.length||k>=a.length)continue;const x=a[k],y=b[k+lag];aa+=x*x;bb+=y*y;ab+=x*y}const c=ab/Math.sqrt(aa*bb);if(c>best.correlation)best={correlation:c,lag};}
 measurements.push({id:event.id,time:event.time,offsetMs:best.lag/48,correlation:Number(best.correlation.toFixed(5))});
}
const report={duration:28,fps:FPS,sourceSamples:N,decodedSamples:b.length,maxEncodedOffsetMs:Math.max(...measurements.map(m=>Math.abs(m.offsetMs))),minCorrelation:Math.min(...measurements.map(m=>m.correlation)),transitionEnvelopePeaks:events.filter(e=>e.visualPeak!==undefined).map(e=>({id:e.id,visualPeak:e.visualPeak,soundEnvelopePeak:e.time,offsetMs:1000*(e.time-e.visualPeak)})),measurements};
await writeFile(path.join(out,'verificacao-sincronia.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({maxEncodedOffsetMs:report.maxEncodedOffsetMs,minCorrelation:report.minCorrelation,checkedEvents:measurements.length,transitionEnvelopeOffsetsMs:report.transitionEnvelopePeaks.map(e=>e.offsetMs)},null,2));
if(report.maxEncodedOffsetMs>1000/FPS||report.minCorrelation<.85)throw new Error('Exported sound timing requires review.');
