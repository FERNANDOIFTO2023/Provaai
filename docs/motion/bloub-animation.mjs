// Reuse the site's original SVG layers and CSS keyframe values.
// Canvas does not execute SVG CSS animation, so evaluate it on the film clock.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {loadImage} from '@napi-rs/canvas';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
const clamp=v=>Math.max(0,Math.min(1,v));
const lerp=(a,b,p)=>a+(b-a)*p;
const identity=()=>({x:0,y:0,rotation:0,sx:1,sy:1});
// CSS ease-in-out = cubic-bezier(.42,0,.58,1), as used by the site.
function cssEase(x){x=clamp(x);let a=0,b=1;const curve=(t,c1,c2)=>3*(1-t)**2*t*c1+3*(1-t)*t*t*c2+t**3;for(let i=0;i<18;i++){const t=(a+b)/2;if(curve(t,.42,.58)<x)a=t;else b=t}return curve((a+b)/2,0,1)}
function parseTransform(text){const v=identity();for(const [,name,args] of text.matchAll(/(translateX|translateY|rotate|scaleX|scaleY|scale)\(([^)]+)\)/g)){const numbers=args.split(',').map(parseFloat);if(name==='translateX')v.x=numbers[0];if(name==='translateY')v.y=numbers[0];if(name==='rotate')v.rotation=numbers[0];if(name==='scaleX')v.sx=numbers[0];if(name==='scaleY')v.sy=numbers[0];if(name==='scale'){v.sx=numbers[0];v.sy=numbers[1]??numbers[0]}}return v}
function keyframes(css,name){const start=css.indexOf('@keyframes '+name);if(start<0)throw new Error(`Missing animation ${name}`);const opening=css.indexOf('{',start);let depth=1,end=opening+1;for(;depth>0&&end<css.length;end++){if(css[end]==='{')depth++;if(css[end]==='}')depth--}const body=css.slice(opening+1,end-1),frames=[];for(const [,selectors,rules] of body.matchAll(/([^{}]+)\{([^{}]+)\}/g)){const transform=rules.match(/transform\s*:\s*([^;}]+)/)?.[1]??'';for(const selector of selectors.split(',')){const percent=parseFloat(selector);if(Number.isFinite(percent))frames.push({p:percent/100,...parseTransform(transform)})}}if(!frames.some(f=>f.p===0))frames.push({p:0,...identity()});if(!frames.some(f=>f.p===1))frames.push({p:1,...identity()});return frames.sort((a,b)=>a.p-b.p)}
function sample(frames,time,duration){const p=((time%duration)+duration)%duration/duration;let i=0;while(i<frames.length-2&&p>frames[i+1].p)i++;const a=frames[i],b=frames[i+1],u=cssEase((p-a.p)/(b.p-a.p));return Object.fromEntries(Object.keys(identity()).map(k=>[k,lerp(a[k],b[k],u)]))}
function transform(ctx,v,origin=15){ctx.translate(0,origin);ctx.translate(v.x,v.y);ctx.rotate(v.rotation*Math.PI/180);ctx.scale(v.sx,v.sy);ctx.translate(0,-origin)}
export async function loadBloub(root){
 const parser=new DOMParser(),serializer=new XMLSerializer(),assets={};
 const definitions={curioso:{animation:'tilt',duration:3.6,faceAnimation:'look'},feliz:{animation:'bounce',duration:2.4},carinhoso:{animation:'heart',duration:3},surpreso:{animation:'pop',duration:2.8}};
 const svg=markup=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-125 -125 250 250" width="750" height="750">${markup}</svg>`);
 for(const [mood,def] of Object.entries(definitions)){
  const source=await readFile(path.join(root,`public/bloub/animated/bloub-${mood}.svg`),'utf8'),doc=parser.parseFromString(source,'image/svg+xml'),groups=Array.from(doc.getElementsByTagName('g')),body=groups.find(n=>n.getAttribute('class')==='body'),face=groups.find(n=>n.getAttribute('class')==='face');
  if(!body||!face)throw new Error(`Missing SVG layers for ${mood}`);
  const shape=Array.from(body.childNodes).filter(n=>n.nodeType===1&&n!==face).map(n=>serializer.serializeToString(n)).join('');
  const css=doc.getElementsByTagName('style')[0].textContent;
  assets[mood]={body:await loadImage(svg(shape)),face:await loadImage(svg(serializer.serializeToString(face))),duration:def.duration,frames:keyframes(css,def.animation),faceFrames:def.faceAnimation?keyframes(css,def.faceAnimation):null};
 }
 const siteCSS=await readFile(path.join(root,'resources/css/bloub.css'),'utf8');
 const floatFrames=keyframes(siteCSS,'bloub-float'),blinkFrames=keyframes(siteCSS,'bloub-blink');
 return {
  draw(ctx,{x,y,size,time=0,mood='curioso',lookX=0,lookY=0,pose=null}){
   const asset=assets[mood==='login'?'curioso':mood];if(!asset)throw new Error(`Unknown Bloub mood ${mood}`);
   ctx.save();ctx.translate(x,y);ctx.scale(size/250,size/250);
   // Film choreography bypasses the site's infinite loops; V5 stays reproducible.
   if(pose){
    transform(ctx,{...identity(),...pose});
    ctx.drawImage(asset.body,-125,-125,250,250);
    const happy=clamp(pose.happy??0);
    // Close the lids through the expression change, avoiding double/ghost eyes.
    ctx.translate(pose.eyeX??0,pose.eyeY??0);
    ctx.scale(1,(pose.blink??1)*(.06+.94*Math.abs(2*happy-1)));
    ctx.drawImage(happy<.5?assets.curioso.face:assets.feliz.face,-125,-125,250,250);
    ctx.restore();return;
   }
   transform(ctx,mood==='login'?sample(floatFrames,time,5):sample(asset.frames,time,asset.duration));
   if(mood==='login')ctx.rotate(clamp(Math.abs(lookX))*Math.sign(lookX)*5*Math.PI/180);
   ctx.drawImage(asset.body,-125,-125,250,250);
   ctx.save();if(mood==='login'){ctx.translate(lookX*11,lookY*7);transform(ctx,sample(blinkFrames,time,6.4),0)}else if(asset.faceFrames)transform(ctx,sample(asset.faceFrames,time,asset.duration),0);
   ctx.drawImage(asset.face,-125,-125,250,250);ctx.restore();ctx.restore();
  },
  // Expose exact source timing for the render's visual review and reproducibility.
  metadata:Object.fromEntries(Object.entries(assets).map(([m,a])=>[m,{duration:a.duration,frames:a.frames,faceFrames:a.faceFrames}]))
 };
}
