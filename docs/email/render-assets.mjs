// Regenerate the email-safe raster versions of the existing Bloub SVG.
// Run: node docs/email/render-assets.mjs (FFMPEG_PATH may override the binary).
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'public/email');
await mkdir(output, { recursive: true });
const mascot = await loadImage(await readFile(path.join(root, 'public/bloub/static/bloub-feliz.svg')));
const canvas = createCanvas(192, 192);
const ctx = canvas.getContext('2d');
// Same bounce keyframes as public/bloub/animated/bloub-feliz.svg.
const keys = [[0,0,1,1],[.15,5,1.04,.94],[.30,-15,.98,1.03],[.42,2,1.03,.97],[.55,0,1,1],[1,0,1,1]];
function draw(t) {
  const next = keys.findIndex((key, index) => index > 0 && key[0] >= t);
  const a = keys[next - 1], b = keys[next];
  const p = (1 - Math.cos(Math.PI * (t - a[0]) / (b[0] - a[0]))) / 2;
  const [, y, sx, sy] = a.map((value, index) => value + (b[index] - value) * p);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 192, 192);
  ctx.save(); ctx.translate(96, 96); ctx.scale(192/250, 192/250);
  ctx.translate(0, 15 + y); ctx.scale(sx, sy); ctx.translate(0, -15);
  ctx.drawImage(mascot, -125, -125, 250, 250); ctx.restore();
  return canvas.toBuffer('image/png');
}
await writeFile(path.join(output, 'bloub-login.png'), draw(0));
const ffmpeg = process.env.FFMPEG_PATH || path.join(root, 'docs/motion/ffmpeg.exe');
const child = spawn(ffmpeg, ['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','20','-i','pipe:0','-filter_complex','split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a','-loop','1',path.join(output, 'bloub-login.gif')], { windowsHide: true, stdio: ['pipe','ignore','inherit'] });
const finished = once(child, 'close');
for (let i = 0; i < 48; i++) {
  if (!child.stdin.write(draw(i / 48))) await once(child.stdin, 'drain');
}
child.stdin.end();
const [exitCode] = await finished;
if (exitCode !== 0) throw new Error(`ffmpeg exited with ${exitCode}`);
console.log('Created 192px PNG and GIF (2.4 seconds, two plays, complete first frame).');
