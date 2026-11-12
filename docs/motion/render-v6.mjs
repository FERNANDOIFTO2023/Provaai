/** Provaai motion V6. 28s / 60fps. Shared audio clock and temporal supersampling.
 * The user-supplied reference informs pacing and visual grammar only.
 * No images, music, logos or speech are reused from that reference.
 */
import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createAudio} from './audio-v6.mjs';
import {loadBloub} from './bloub-animation.mjs';
import {bloubPose,choreography} from './bloub-choreography.mjs';
import {FPS,transitions,action,promptText,typedCount,events,visualFx as FX} from './timing-v6.mjs';
const DIR=path.dirname(fileURLToPath(import.meta.url)),OUT=path.join(DIR,'output/v6');
await mkdir(OUT,{recursive:true});
GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeui.ttf','UI');
GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeuib.ttf','UI Bold');
GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeuisl.ttf','UI Light');
const W=1920,H=1080,DURATION=28;
const P='#5210CE',M='#2ADFB8',INK='#0D1823',GRAY='#6E7480',WHITE='#FCFCFD';
const canvas=createCanvas(W,H),output=canvas.getContext('2d');
const layers=[createCanvas(W,H),createCanvas(W,H)];let g=layers[0].getContext('2d');
const animatedBloub=await loadBloub(path.resolve(DIR,'../..'));
const symbol=await loadImage(path.resolve(DIR,'../../public/bloub/bloub-symbol.svg'));
const screen=await loadImage(path.join(DIR,'assets/turmas.png'));
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,p)=>a+(b-a)*p;
const ease=v=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10)};
// Cubic deceleration and lightly underdamped settling avoid the V2 snap/hold.
const out=v=>1-(1-clamp(v))**3;
const spr=(t,k=10)=>{if(t<=0)return 0;const w=k*1.45,z=.86,d=Math.sqrt(1-z*z);return 1-Math.exp(-z*w*t)*(Math.cos(w*d*t)+z/d*Math.sin(w*d*t));};
const press=(t,at)=>Math.sin(clamp((t-at+.08)/.16)*Math.PI);
function arc(a,b,p,bend=0){return [mix(a[0],b[0],p)+Math.sin(Math.PI*p)*bend,mix(a[1],b[1],p)-Math.sin(Math.PI*p)*Math.abs(bend)*.55]}
function group(x,y,s,r,alpha,fn){g.save();g.translate(x,y);g.rotate(r);g.scale(s,s);g.globalAlpha*=clamp(alpha);fn();g.restore()}
function rect(x,y,w,h,r,fill,stroke){if(w<=0||h<=0)return;g.beginPath();g.roundRect(x,y,w,h,r);if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.lineWidth=1.6;g.strokeStyle=stroke;g.stroke()}}
function dot(x,y,r,color){g.beginPath();g.arc(x,y,Math.max(0,r),0,Math.PI*2);g.fillStyle=color;g.fill()}
function line(x,y,X,Y,color,w=3){g.beginPath();g.moveTo(x,y);g.lineTo(X,Y);g.strokeStyle=color;g.lineWidth=w;g.lineCap='round';g.lineJoin='round';g.stroke()}
function txt(s,x,y,size=40,color=INK,weight='normal',align='center'){g.font=`${size}px "${weight==='bold'?'UI Bold':weight==='light'?'UI Light':'UI'}"`;g.fillStyle=color;g.textAlign=align;g.textBaseline='middle';g.fillText(s,x,y)}
function measure(s,size=40,bold=false){g.font=`${size}px "${bold?'UI Bold':'UI'}"`;return g.measureText(s).width}
function shadow(fn,blur=35,dy=14,color='#24143820'){g.save();g.shadowColor=color;g.shadowBlur=blur;g.shadowOffsetY=dy;fn();g.restore()}
function bg(color=WHITE){g.fillStyle=color;g.fillRect(-250,-250,W+500,H+500)}
function glow(x,y,r,color,alpha=.12){g.save();g.globalAlpha*=alpha;const d=g.createRadialGradient(x,y,0,x,y,r);d.addColorStop(0,color);d.addColorStop(1,color+'00');g.fillStyle=d;g.fillRect(x-r,y-r,r*2,r*2);g.restore()}
function star(x,y,s,color,r=0){group(x,y,s,r,1,()=>{g.beginPath();g.moveTo(0,-1);g.quadraticCurveTo(.16,-.16,1,0);g.quadraticCurveTo(.16,.16,0,1);g.quadraticCurveTo(-.16,.16,-1,0);g.quadraticCurveTo(-.16,-.16,0,-1);g.fillStyle=color;g.fill()})}
function tick(x,y,s=1,color=INK,p=1){group(x,y,s,0,1,()=>{const a=clamp(p*2),b=clamp(p*2-1);line(-12,0,mix(-12,-2,a),mix(0,10,a),color,4);if(b)line(-2,10,mix(-2,18,b),mix(10,-14,b),color,4)})}
function bloub(x,y,size,t,scene){animatedBloub.draw(g,{x,y,size,pose:bloubPose(scene,t)})}
function companion(x,y,size,t,scene,opacity=1){group(x,y,1,0,opacity,()=>{const pose=bloubPose(scene,t),lift=clamp(-pose.y/60);g.save();g.fillStyle=`rgba(13,24,35,${.055*(1-.5*lift)})`;g.beginPath();g.ellipse(pose.x*size/250,size*.41,size*.24*(1-.25*lift),size*.035,0,0,Math.PI*2);g.fill();g.restore();bloub(0,0,size,t,scene)})}
function chip(s,x,y,w,color=P,bgcolor='#EEE8F8'){rect(x-w/2,y-27,w,54,27,bgcolor);txt(s,x,y,24,color)}
function heading(s,x,y,size,t,color=INK,delay=0){const a=out((t-delay)/.65);group(x,y+(1-a)*48,1+(1-a)*.035,0,a,()=>{g.filter=`blur(${(1-a)*5}px)`;txt(s,0,0,size,color,'bold')})}
function cursor(x,y,s=1,press=0){group(x,y,s*(1-.13*press),-.08,1,()=>{g.beginPath();g.moveTo(0,0);g.lineTo(3,52);g.lineTo(16,39);g.lineTo(28,64);g.lineTo(40,58);g.lineTo(28,34);g.lineTo(48,30);g.closePath();g.fillStyle='white';g.strokeStyle=INK;g.lineWidth=3;g.shadowColor='#0003';g.shadowBlur=10;g.shadowOffsetY=3;g.fill();g.stroke()})}
function pulse(x,y,t,color=P){const a=clamp(t/.45);if(t>=0&&t<.45){g.save();g.globalAlpha*=1-a;g.beginPath();g.arc(x,y,12+a*55,0,Math.PI*2);g.lineWidth=2;g.strokeStyle=color;g.stroke();g.restore()}}
function pathDraw(points,p,color='#D5D2DA',width=3){let total=0;const lens=[];for(let i=1;i<points.length;i++){const d=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);lens.push(d);total+=d}let remain=total*clamp(p);g.beginPath();g.moveTo(...points[0]);let endpoint=points[0];for(let i=1;i<points.length&&remain>0;i++){const a=clamp(remain/lens[i-1]);endpoint=[mix(points[i-1][0],points[i][0],a),mix(points[i-1][1],points[i][1],a)];g.lineTo(...endpoint);remain-=lens[i-1]}g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.stroke();return endpoint}
// Arc-length particles follow the actual connector rather than a straight shortcut.
function pathPoint(points,p){const lengths=points.slice(1).map((v,i)=>Math.hypot(v[0]-points[i][0],v[1]-points[i][1]));let remaining=clamp(p)*lengths.reduce((a,b)=>a+b,0);for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]||i===lengths.length-1){const u=clamp(remaining/lengths[i]);return [mix(points[i][0],points[i+1][0],u),mix(points[i][1],points[i+1][1],u)]}remaining-=lengths[i]}return points.at(-1)}
function signal(points,t,start,duration,color,reverse=false){const age=(t-start)/duration;if(age<0||age>1.18)return;const p=ease(clamp(age)),fade=1-ease((age-1)/.18);
 group(0,0,1,0,fade,()=>{for(let j=15;j>=0;j--){const q=p-j*.012;if(q<0)continue;const [x,y]=pathPoint(points,reverse?1-q:q);const a=(1-j/16)**1.6;group(x,y,1,0,a,()=>{dot(0,0,3.5-j*.12,color)})}const [x,y]=pathPoint(points,reverse?1-p:p);glow(x,y,36,color,.32);g.save();g.shadowColor=color;g.shadowBlur=18;dot(x,y,5.5,color);dot(x,y,2.1,'white');g.restore()});
}
function halo(x,y,t,color,r=40){if(t<0||t>.62)return;const a=clamp(t/.62);group(x,y,1,0,1-a,()=>{g.beginPath();g.arc(0,0,r+out(a)*42,0,Math.PI*2);g.strokeStyle=color;g.lineWidth=2*(1-a)+.5;g.stroke();glow(0,0,r+50,color,.17*(1-a))})}
function sparks(x,y,t,color,seed=0){if(t<0||t>.5)return;const p=clamp(t/.5);for(let i=0;i<5;i++){const a=i*Math.PI*2/5+seed;group(x+Math.cos(a)*(10+out(p)*28),y+Math.sin(a)*(10+out(p)*28),1,0,(1-p)*.8,()=>dot(0,0,1.7*(1-p)+.5,color))}}
function icon(kind,x,y,size,color=P){group(x,y,size/64,0,1,()=>{if(kind==='grid'){for(let j=0;j<4;j++)rect(-26+(j%2)*32,-26+Math.floor(j/2)*32,22,22,6,null,color)}else if(kind==='users'){dot(-10,-14,10,color);dot(15,-8,8,color);g.beginPath();g.arc(-10,18,18,Math.PI,0);g.strokeStyle=color;g.lineWidth=5;g.stroke();g.beginPath();g.arc(17,20,12,Math.PI,0);g.stroke()}else if(kind==='star'){star(0,0,31,color)}else{rect(-22,-29,44,58,8,null,color);for(let i=0;i<3;i++)line(-12,-9+i*12,i===2?3:12,-9+i*12,color,4)}})}
function brand(x,y,size=92,color=INK){const word='Provaai',width=measure(word,size,true);group(x,y,1,0,1,()=>{g.drawImage(symbol,-width/2-size*.95,-size*.47,size*.75,size*.75);txt(word,-size*.04,0,size,color,'bold');dot(width/2+size*.15,size*.25,size*.065,M)})}

// 0–1.6: small logo floats in, then physically expands into the primary button.
function intro(t){bg();const p=spr(t-.03,9),m=ease((t-.78)/.58);glow(960,540,180,P,.11*(1-m));glow(990,555,150,M,.15*(1-m));
 group(960,540,Math.max(.001,p),0,1,()=>{group(0,0,1,0,m,()=>shadow(()=>rect(-mix(56,158,m),-mix(56,47,m),mix(112,316,m),mix(112,94,m),mix(42,25,m),'#F3F2F5','#DAD7E2'),30,12));group(mix(0,-99,m),0,mix(1,.43,m),0,1,()=>bloub(0,0,mix(230,126,m),t,'intro'));group(32,0,1,0,ease((m-.35)/.65),()=>txt('Criar prova',0,0,34,INK,'normal'));});
 const c=ease((t-.97)/.37),pos=arc([1240,800],[1085,568],c,-65);group(0,0,1,0,c,()=>cursor(...pos,.8,press(t,action.introClick)));pulse(1075,565,t-action.introClick);
}
function mixColor(a,b,p){const aa=a.match(/\w\w/g).map(x=>parseInt(x,16)),bb=b.match(/\w\w/g).map(x=>parseInt(x,16));return '#'+aa.map((v,i)=>Math.round(mix(v,bb[i],p)).toString(16).padStart(2,'0')).join('')}

// 1.6–4: connected system, staggered endpoints and travelling energy.
function network(t){bg();const z=1+t*.025;group(960,540,z,Math.sin(t*.5)*.006,1,()=>{
 const nodes=[[-490,-255,'Turmas','grid',P],[490,-255,'Perfis','users','#0C9E83'],[-490,255,'Questões','star',P],[490,255,'Modelos','doc','#0C9E83']];
 nodes.forEach(([x,y,label,kind,color],i)=>{const p=out((t-.12-i*.12)/.62),pts=[[x*.28,0],[x*.5,0],[x*.5,y*.5],[x,y*.5],[x,y]],launch=FX.networkLaunch+i*FX.networkStagger,arrival=launch+FX.networkTravel;
 pathDraw(pts,p,'#DAD6E4',2.5);group(0,0,1,0,.22*out(t-arrival),()=>pathDraw(pts,1,color,2));
 signal(pts,t,launch,FX.networkTravel,color);signal(pts,t,FX.networkEcho,FX.echoTravel,color,true);
 const a=spr(t-.33-i*.12,10),bump=t>=arrival?1+.045*Math.exp(-(t-arrival)*10)*Math.sin((t-arrival)*20):1;
 halo(x,y,t-arrival,color,69);sparks(x,y,t-arrival,color,i*.7);
 group(x,y,Math.max(.001,a)*bump,.05*(1-a),out(t-.2-i*.12),()=>{glow(0,0,105,color,.1);shadow(()=>rect(-64,-64,128,128,32,'white'),24,9);icon(kind,0,0,64,color);txt(label,0,102,30,INK)});});
 const returned=t-FX.networkEcho-FX.echoTravel;halo(0,0,returned,M,160);
 shadow(()=>rect(-158,-47,316,94,25,'#F3F2F5','#DAD7E2'),30,12);bloub(-102,0,65,t,'network');txt('Criar prova',32,0,34);
 });
}

// 4–6.4: word-by-word build; a fast macro lens selects the word aluno.
function words(t){bg();const zoom=ease((t-1.04)/1.16),s=mix(1,2.55,zoom)+t*.006,shift=-196*zoom,select=ease((t-FX.selectStart)/(FX.selectEnd-FX.selectStart)),lock=t-FX.handleLock,shine=t-FX.selectionShine;
 glow(960+shift,540,360,P,.035*zoom);
 group(960+shift,540,s,-.018*zoom+.008*Math.sin(t*2)*zoom,1,()=>{
 const left=-137,right=mix(left+3,113,select),bounce=lock>=0?Math.sin(lock*23)*Math.exp(-lock*9)*3:0;
 // Background grows behind the glyphs; handles and scan light are foreground.
 group(0,0,1,0,out((t-FX.selectStart)/.16),()=>{
  g.save();g.shadowColor='#8354ED55';g.shadowBlur=18*select;rect(left,-53,right-left,109,5,'#5210ce14');g.restore();
  if(shine>-.25&&shine<.25){const q=clamp((shine+.25)/.5),gx=mix(left-80,193,q);g.save();g.beginPath();g.roundRect(left,-53,250,109,5);g.clip();const grad=g.createLinearGradient(gx-40,0,gx+40,0);grad.addColorStop(0,'#2ADFB800');grad.addColorStop(.5,'#2ADFB855');grad.addColorStop(1,'#2ADFB800');g.fillStyle=grad;g.fillRect(gx-40,-53,80,109);g.restore();}
 });
 heading('Cada',-315-zoom*6,0,84,t,INK);
 heading('importa.',355+zoom*6,0,84,t,INK,.43);
 group(-15,-Math.sin(select*Math.PI)*3,1+.025*Math.sin(select*Math.PI),0,1,()=>heading('aluno',0,0,84,t,P,.2));
 group(0,0,1,0,out((t-FX.selectStart)/.16),()=>{
  line(left,-53,left,56,P,1.7);line(right+bounce,-53,right+bounce,56,P,1.7);
  dot(left,59,7,P);dot(right+bounce,-57,7,P);
  halo(right,-57,lock,P,8);halo(left,59,lock+.04,P,8);sparks(right,-57,lock,M,.6);
  const scan=ease((t-FX.selectEnd)/.42);if(scan>0&&scan<1){g.save();g.shadowColor=M;g.shadowBlur=9;line(left+250*scan-15,56,left+250*scan+6,56,M,2);g.restore()}
  if(shine>-.2&&shine<.2){const amp=Math.sin(clamp((shine+.2)/.4)*Math.PI);star(right+13,-67,9*amp,M,shine*2)}
 });
 });
}

// 6.4–9.6: the selected word resolves into the input surface; type, configure, click.
function prompt(t){bg();glow(950,545,430,P,.12);glow(1200,580,320,M,.18);
 const p=spr(t+.24,6),grow=ease((t-.7)/.82),height=mix(190,400,grow);
 group(960,540,Math.max(.01,p)*mix(1.04,1,ease(t/2)),.015*Math.exp(-t*3),1,()=>{
 shadow(()=>rect(-490,-height/2,980,height,42,'#F4F4F7','#ECE9F0'),44,18);
 txt('O que sua turma vai aprender?',-434,-height/2+47,26,GRAY,'normal','left');
 const str=promptText,count=typedCount(t);txt(str.slice(0,count),-434,-height/2+109,41,INK,'normal','left');
 if(t<2){const tw=measure(str.slice(0,count),41);line(-428+tw,-height/2+87,-428+tw,-height/2+130,P,3)}
 group(0,0,1,0,grow,()=>{line(-432,-8,432,-8,'#DEDCE4',1.5);group(-275,56,Math.max(.01,spr(t-.82,8)),0,1,()=>chip('3 objetivas',0,0,240));group(-8,56,Math.max(.01,spr(t-.98,8)),0,1,()=>chip('2 discursivas',0,0,250,'#12836E','#DAF6EE'));group(336,56,1-.045*press(t,action.promptClick),0,1,()=>{rect(-90,-31,180,62,22,P);star(-49,0,14,M);txt('Criar',14,0,29,'white')});txt('Conteúdo definido por você.',-432,145,24,GRAY,'normal','left')});
 });
 const a=ease((t-1.78)/.61),pos=arc([1580,870],[1320,606],a,-75);group(0,0,1,0,a,()=>{cursor(...pos,.85,press(t,action.promptClick));pulse(1310,599,t-action.promptClick,M)});
}

// 9.6–12: profiles orbit, spread and send their criteria to one shared point.
function people(t){bg();heading('Um jeito para cada aluno.',960,225,65,t,INK,.12);
 const names=['Ana Clara','Bruno Henrique','Camila Oliveira'],initials=['AC','BH','CO'],labels=['Enunciados curtos','Exemplos do cotidiano','Uma questão de desafio'];
 for(let i=0;i<3;i++){const p=spr(t-.08-i*.16,6.5),x=500+i*460,y=560+Math.sin(t*1.35+i)*10,pos=arc([960,850],[x,y],p,(i-1)*65);
 group(...pos,mix(.78,1,p),(i-1)*.075*Math.exp(-t*1.4)+Math.sin(t*.8+i)*.006,out(t-i*.1),()=>{
 shadow(()=>rect(-208,-172,416,344,34,'white','#ECEAF0'),30,15);dot(0,-85,46,i===1?'#CFF5E9':'#E6DDF7');txt(initials[i],0,-85,30,P,'bold');txt(names[i],0,-3,30,INK,'bold');chip(labels[i],0,73,365,i===1?'#0B7B63':P,i===1?'#E3F9F1':'#F0EBF8');
 });
 const q=out((t-.95)/.65),pts=[[x,745],[x,810],[960,810],[960,870]],launch=FX.profileLaunch+i*FX.profileStagger,arrival=launch+FX.profileTravel;pathDraw(pts,q,'#D9D4E4',2);signal(pts,t,launch,FX.profileTravel,i===1?M:P);halo(960,885,t-arrival,i===1?M:P,43);sparks(960,870,t-arrival,M,i*.5);
 }
 group(960,885,Math.max(.01,spr(t-1.15)),0,out(t-1.1),()=>{glow(0,0,82,P,.08);bloub(0,0,125,t,'people')});
}

// 12–15: dark generation surface, flowing light, cards forming in sequence.
function drafting(t){bg('#10131D');glow(960,850,800,P,.6);glow(1380,560,500,M,.13);
 companion(202,592,236,t,'drafting',out((t-.38)/.55));
 heading('A IA prepara.',960,207,76,t,'white');
 const p=spr(t-.08,8);group(960,595,Math.max(.01,p),-.012*Math.sin(t),1,()=>{
 shadow(()=>rect(-520,-266,1040,532,40,'#1E2230','#343A4F'),50,25,'#00000050');star(-446,-193,25,M,t*.3);txt('Rascunhos da sua turma',-390,-190,32,'white','normal','left');
 for(let i=0;i<3;i++){const q=out((t-.42-i*.32)/.4);group(0,(1-q)*45,1,0,q,()=>{const y=-110+i*100;rect(-455,y,910,79,18,'#2B3040');dot(-414,y+39,21,['#D8CBFB','#BCF1DF','#ECDAC4'][i]);txt(['AC','BH','CO'][i],-414,y+39,15,INK,'bold');txt(['Frações no cotidiano','Porcentagens na prática','Um novo desafio'][i],-365,y+27,26,'#FFFFFF','normal','left');rect(-365,y+51,510*clamp((t-.5-i*.3)/.9),5,3,M);tick(405,y+40,.75,M,out(t-1.2-i*.2))})}
 });
 group(960,958,1,0,out(t-1.6),()=>txt('Você revisa e aprova.',0,0,33,'#BFC6D9'));
}

// 15–18: a physical paper, cursor interaction, and an approval that becomes a seal.
function review(t){bg();const macro=ease((t-1.1)/1.25),p=spr(t+.3,6);group(960,585,Math.max(.01,p)*mix(.94,1.08,macro),-.015*(1-macro),1,()=>{
 shadow(()=>rect(-410,-375,820,750,35,'white','#EBE8F0'),45,20);
 txt('Você decide.',0,-280,57,INK,'bold');txt('Frações no cotidiano',0,-213,27,GRAY);
 txt('Quanto é 1/2 + 1/4?',-330,-130,35,INK,'normal','left');
 ['1/4','1/2','3/4','1'].forEach((v,i)=>{const y=-50+i*67,sel=i===2?out((t-action.selectAnswer)/.25):0;rect(-330,y-25,660,53,14,mixColor('#F4F3F7','#E2F8EF',sel));dot(-298,y,10,sel?P:'#D4D0DD');txt(v,-264,y,29,INK,'normal','left');if(sel)tick(295,y,.65,P,sel)});
 const approved=out((t-action.approve)/.26);group(0,285,1-.035*press(t,action.approve),0,1,()=>{rect(-330,-36,660,72,22,mixColor(P,M,approved));group(0,0,1,0,1-approved,()=>txt('Aprovar prova',0,0,29,'white','bold'));group(0,10*(1-approved),1,0,approved,()=>txt('Revisada e aprovada',0,0,29,INK,'bold'));if(approved)tick(-268,0,.8,INK,approved)});
 });
 companion(1630,627,234,t,'review',out((t-.4)/.55));
 const a=ease((t-.28)/.66),b=ease((t-1.08)/.62),scale=Math.max(.01,p)*mix(.94,1.08,macro),targetA=[960+250*scale,585+84*scale],targetB=[960+175*scale,585+285*scale],posA=arc([1490,830],targetA,a,-70),pos=arc(posA,targetB,b,48);
 group(0,0,1,0,out(t/.2)*(1-out((t-2.05)/.45)),()=>cursor(...pos,.9,Math.max(press(t,action.selectAnswer),press(t,action.approve))));pulse(...targetB,t-action.approve);
}

function sheet(tag,x,y,r,s,t,color){group(x,y,s,r,1,()=>{
 shadow(()=>rect(-150,-194,300,388,24,'white','#E9E6EE'),32,17);rect(-110,-150,tag.length>5?220:105,46,14,color);txt(tag,-110+(tag.length>5?110:52.5),-127,21,'white','bold');txt('Frações',-110,-47,31,INK,'bold','left');txt('no cotidiano',-110,-9,27,INK,'normal','left');
 for(let j=0;j<5;j++)rect(-110,43+j*23,(j%3===2?120:220)*out((t-j*.05)/.35),6,3,j===0?'#A59AAE':'#DFDAE6');
 dot(105,144,22,color);line(105,134,105,153,'white',2.5);line(98,146,105,153,'white',2.5);line(112,146,105,153,'white',2.5);
 })}
// 18–20.8: three file formats fan outward and are pulled into a download tray.
function files(t){bg();heading('Pronta para imprimir.',960,230,68,t);
 const pull=ease((t-action.download)/.72);
 for(const i of [0,2,1]){const p=spr(t-.08-i*.14,6.5),x=mix(960,540+i*420,p),y=mix(800,562,p)-Math.sin(t*1.4+i)*8,scale=mix(.7,1,p),pos=arc([x,y],[960,866],pull,(i-1)*95);
 group(0,0,1,0,1-ease((pull-.85)/.15),()=>sheet(['PDF','WORD','GABARITO'][i],...pos,mix((i-1)*.105+Math.sin(t+i)*.012,(i-1)*-.12,pull),Math.max(.01,scale*(1-pull*.96)),t,['#6518D5','#3476D6','#0A9D81'][i]));}
 const q=spr(t-.64,7),done=out((t-action.downloadDone)/.2);group(960,880,Math.max(.01,q)*(1-.04*press(t,action.download)),0,1,()=>{shadow(()=>rect(-175,-42,350,84,25,mixColor('#EFEDF4',M,done)),20,8);if(done>.01){tick(-115,0,.7,INK,done);group(24,0,1,0,done,()=>txt('Tudo pronto',0,0,29,INK))}group(0,0,1,0,1-done,()=>txt('Baixar provas',0,0,29,P))});
 const cp=ease((t-.82)/.52),pos=arc([1260,1010],[1050,880],cp,-45);group(0,0,1,0,cp*(1-out((t-1.55)/.4)),()=>cursor(...pos,.7,press(t,action.download)));
 pulse(960,880,t-action.downloadDone,M);
 companion(1510,866,200,t,'files',out((t-.35)/.6));
}

// 20.8–23: briefly reveal the actual product, then punch into its brand header.
function product(t){bg();const p=spr(t+.35,5.5),z=ease((t-.7)/1.65);heading('Tudo no seu Provaai.',960,121,58,t,INK,.1);
 const ww=1320,hh=ww*screen.height/screen.width;
 group(960+z*370,600+z*240,Math.max(.01,p)*mix(.96,1.55,z),mix(-.025,.008,ease(t/2.2)),1,()=>{shadow(()=>rect(-ww/2,-hh/2,ww,hh,25,'white'),40,17);g.save();g.beginPath();g.roundRect(-ww/2,-hh/2,ww,hh,25);g.clip();g.drawImage(screen,-ww/2,-hh/2,ww,hh);g.restore()});
}

// 23–25: kinetic two-line statement with different arrival direction and tempo.
function tagline(t){bg();const p=out(t/.5),q=out((t-.5)/.55);group(mix(-800,960,p),440,1,0,1,()=>txt('Mais tempo.',0,0,110,INK,'bold'));group(mix(2600,960,q),581,1,0,1,()=>txt('Para ensinar.',0,0,110,P,'bold'));
 const a=out((t-.9)/.5);line(960-360*a,682,960+360*a,682,M,8);star(1440,414,27*spr(t-.9),M,t*.3);
}
function outro(t){bg();const p=spr(t+.04,7);glow(960,400,400,M,.08);group(960,490,Math.max(.01,p),-.025*(1-p),1,()=>{txt('Provaai',0,0,132,INK,'bold');dot(measure('Provaai',132,true)/2+18,33,8.5,M)});
 companion(960,285,235,t,'outro',out((t-.1)/.45));
 heading('Cada aluno, uma possibilidade.',960,641,43,t,GRAY,.4);
 group(960,782,Math.max(.001,spr(t-.8,9)),0,out(t-.7),()=>{rect(-227,-36,454,72,36,P);txt('Conheça o Provaai',-14,0,28,'white');line(166,0,192,0,M,3);line(181,-10,192,0,M,3);line(181,10,192,0,M,3)});
 group(960,900,1,0,out(t-1.1),()=>txt('provaai.vercel.app',0,0,27,GRAY));
}

const draws=[intro,network,words,prompt,people,drafting,review,files,product,tagline,outro];
const scenes=transitions.map((s,i)=>({...s,fn:draws[i]}));
function renderLayer(index,t,layer){g=layers[layer].getContext('2d');g.resetTransform();g.globalAlpha=1;g.filter='none';g.clearRect(0,0,W,H);const local=Math.max(0,t-scenes[index].at),duration=(scenes[index+1]?.at??DURATION)-scenes[index].at,q=clamp(local/duration);g.save();g.translate(960+Math.sin(t*.4)*5,540+Math.sin(t*.31)*3);g.scale(1.006+.016*q,1.006+.016*q);g.translate(-960,-540);scenes[index].fn(local);g.restore();}
function drawFrame(t){let ix=scenes.findLastIndex(s=>t>=s.at);ix=Math.max(0,ix);const s=scenes[ix],local=t-s.at,d=s.dur||0;renderLayer(ix,t,0);output.resetTransform();output.globalAlpha=1;output.filter='none';output.fillStyle=WHITE;output.fillRect(0,0,W,H);
 if(ix===0||local>=d||s.type==='none'){output.drawImage(layers[0],0,0);return}
 renderLayer(ix-1,t,1);const p=ease(local/d);
 function layer(canvas,x,y,scale=1,alpha=1,blur=0){output.save();output.translate(x,y);output.scale(scale,scale);output.globalAlpha=alpha;output.filter=blur>.2?`blur(${blur}px)`:'none';output.drawImage(canvas,-W/2,-H/2);output.restore()}
 if(s.type==='whip'){layer(layers[1],960-W*p,540,1,1,Math.sin(p*Math.PI)*3);layer(layers[0],960+W*(1-p),540,1,1,Math.sin(p*Math.PI)*3)}
 else if(s.type==='up'){layer(layers[1],960,540-H*p,1,1,Math.sin(p*Math.PI)*2);layer(layers[0],960,540+H*(1-p),1,1,Math.sin(p*Math.PI)*2)}
 else if(s.type==='iris'){layer(layers[1],960,540);output.save();output.beginPath();output.arc(960,885,Math.max(1,1500*p),0,Math.PI*2);output.clip();layer(layers[0],960,540);output.restore()}
 else{layer(layers[1],960,540,1+p*(s.type==='focus'?.38:.12),1-p,p*8);layer(layers[0],960,540,mix(s.type==='focus'?.92:1.12,1,p),p,(1-p)*6)}
}

// Temporal accumulation at 60fps: real path blur, centered on the audio clock.
const exposure=createCanvas(W,H),exposureCtx=exposure.getContext('2d');
function renderExposure(t){exposureCtx.clearRect(0,0,W,H);for(const [offset,weight] of [[-1/200,.25],[0,.5],[1/200,.25]]){drawFrame(Math.max(0,t+offset));exposureCtx.globalCompositeOperation='lighter';exposureCtx.globalAlpha=weight;exposureCtx.drawImage(canvas,0,0);}exposureCtx.globalCompositeOperation='source-over';exposureCtx.globalAlpha=1;output.resetTransform();output.globalAlpha=1;output.filter='none';output.clearRect(0,0,W,H);output.drawImage(exposure,0,0);}

const marks=[.58,2.9,4.9,5.85,8.2,10.9,13.7,17.25,19,21.7,24.25,27.1];
const actingBoard=createCanvas(1800,1200),ac=actingBoard.getContext('2d');
for(const [i,[at,x,y]] of [[16.68,1320,400],[16.92,1320,400],[17.38,1320,400],[19.4,1220,620],[20.08,1220,620],[20.5,1220,620],[25.65,660,90],[26.2,660,90],[27.75,660,90]].entries()){
 renderExposure(at);ac.drawImage(canvas,x,y,600,400,i%3*600,Math.floor(i/3)*400,600,400);
}
await writeFile(path.join(OUT,'atuacao-detalhes.jpg'),actingBoard.toBuffer('image/jpeg'));
const mascotBoard=createCanvas(1920,1440),mc=mascotBoard.getContext('2d');
for(const [i,at] of [.25,.6,.9,12.7,13.4,14.2,16.55,17.08,17.44,25.4,26.2,27.3].entries()){renderExposure(at);mc.drawImage(canvas,(i%3)*640,Math.floor(i/3)*360,640,360)}
await writeFile(path.join(OUT,'bloub-no-filme.jpg'),mascotBoard.toBuffer('image/jpeg'));
await writeFile(path.join(OUT,'bloub-coreografia.json'),JSON.stringify(choreography,null,2));
const effectsBoard=createCanvas(1920,1080),ec=effectsBoard.getContext('2d');
for(const [i,at] of [2.52,2.95,3.35,5.12,5.53,5.82,11.12,11.4,11.63].entries()){renderExposure(at);ec.drawImage(canvas,(i%3)*640,Math.floor(i/3)*360,640,360)}
await writeFile(path.join(OUT,'detalhes-efeitos.jpg'),effectsBoard.toBuffer('image/jpeg'));
for(let i=0;i<marks.length;i++){renderExposure(marks[i]);await writeFile(path.join(OUT,`quadro-${String(i+1).padStart(2,'0')}.png`),canvas.toBuffer('image/png'))}
const contact=createCanvas(1920,1440),cc=contact.getContext('2d');for(let i=0;i<marks.length;i++){const im=await loadImage(path.join(OUT,`quadro-${String(i+1).padStart(2,'0')}.png`));cc.drawImage(im,(i%3)*640,Math.floor(i/3)*360,640,360)}await writeFile(path.join(OUT,'storyboard-v6.jpg'),contact.toBuffer('image/jpeg'));
const syncBoard=createCanvas(1920,1080),sc=syncBoard.getContext('2d');let n=0;for(const at of [6.4+action.promptClick,15+action.approve,18+action.download])for(const dt of [-.1,0,.1]){renderExposure(at+dt);sc.drawImage(canvas,n%3*640,Math.floor(n/3)*360,640,360);n++}await writeFile(path.join(OUT,'conferencia-cliques.jpg'),syncBoard.toBuffer('image/jpeg'));
if(process.argv.includes('--stills')){console.log('V6: quadros e conferência de cliques gerados.');process.exit(0)}
console.log('Áudio:',await createAudio(OUT,DURATION));
const ff=process.env.FFMPEG_PATH||path.join(DIR,'ffmpeg.exe');const target=path.join(OUT,'Provaai-motion-v6-1080p.mp4');
const proc=spawn(ff,['-hide_banner','-loglevel','warning','-y','-thread_queue_size','64','-f','rawvideo','-pixel_format','rgba','-video_size',`${W}x${H}`,'-framerate',`${FPS}`,'-i','pipe:0','-i',path.join(OUT,'mix-v6.wav'),'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-af','loudnorm=I=-16:TP=-1.5:LRA=9','-c:a','aac','-b:a','256k','-ar','48000','-movflags','+faststart','-t',`${DURATION}`,target],{stdio:['pipe','ignore','inherit'],windowsHide:true});
let failure;proc.on('error',e=>failure=e);proc.stdin.on('error',e=>failure=e);const closed=once(proc,'close');
for(let f=0;f<DURATION*FPS;f++){if(failure)throw failure;renderExposure(f/FPS);if(!proc.stdin.write(canvas.data()))await once(proc.stdin,'drain');if(f%(FPS*2)===0)console.log(`V6: ${f/FPS}s / ${DURATION}s`)}
proc.stdin.end();const [code]=await closed;if(code!==0)throw new Error(`FFmpeg: ${code}`);console.log(`Concluído: ${target}`);

