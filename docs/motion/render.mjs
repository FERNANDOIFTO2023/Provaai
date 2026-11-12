/** Provaai — Cada aluno, uma possibilidade.
 * Deterministic 60fps motion film. All animation is evaluated from time,
 * including the original stereo score. No network or live data at render time.
 */
import {createCanvas, loadImage, GlobalFonts} from '@napi-rs/canvas';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DIR=path.dirname(fileURLToPath(import.meta.url));
const OUT=path.join(DIR,'output');
await mkdir(OUT,{recursive:true});
GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeui.ttf','Segoe');
GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeuib.ttf','Segoe Bold');
GlobalFonts.registerFromPath('C:/Windows/Fonts/trebucbd.ttf','Trebuchet Bold');
const W=1920,H=1080,FPS=60,DURATION=36;
const C={ink:'#0D1823',purple:'#5210CE',mint:'#2ADFB8',paper:'#F5F3F5',muted:'#69717D',line:'#DED9E6'};
const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
const imgs={};
for(const name of ['turmas','alunos','login','formulario','revisao']) {
 const file=path.join(DIR,'assets',`${name}.png`);
 if(existsSync(file)) imgs[name]=await loadImage(file);
}
imgs.bloub=await loadImage(path.resolve(DIR,'../../public/bloub/static/bloub-feliz.svg'));
imgs.symbol=await loadImage(path.resolve(DIR,'../../public/bloub/bloub-symbol.svg'));
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,p)=>a+(b-a)*p;
const ease=v=>{v=clamp(v);return v*v*v*(v*(6*v-15)+10)};
const out=v=>1-Math.pow(1-clamp(v),4);
const spring=(t,speed=8)=>t<=0?0:1-Math.exp(-speed*t)*(Math.cos(speed*1.1*t)+.35*Math.sin(speed*1.1*t));
function group(x,y,s,rot,alpha,fn){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);ctx.globalAlpha*=clamp(alpha);fn();ctx.restore();}
function box(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.5;ctx.stroke()}}
function circle(x,y,r,fill){ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);ctx.fillStyle=fill;ctx.fill()}
function line(x1,y1,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function text(str,x,y,size=32,color=C.ink,weight='bold',align='left'){
 ctx.font=`${size}px "${weight==='bold'?'Segoe Bold':'Segoe'}"`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(str,x,y);
}
function wrap(str,x,y,width,size=28,color=C.ink,leading=1.42){
 ctx.font=`${size}px "Segoe"`;let row='',n=0;
 for(const word of str.split(' ')){const v=row?row+' '+word:word;if(ctx.measureText(v).width>width&&row){text(row,x,y+n*size*leading,size,color,'normal');n++;row=word}else row=v}
 text(row,x,y+n*size*leading,size,color,'normal');return(n+1)*size*leading;
}
function label(str,x,y,color=C.purple){text(str,x,y,21,color,'bold')}
function shadow(fn,blur=50,color='#13052d24',dy=25){ctx.save();ctx.shadowBlur=blur;ctx.shadowColor=color;ctx.shadowOffsetY=dy;fn();ctx.restore()}
function pill(str,x,y,w,fill=C.purple,color='white',h=56){box(x,y,w,h,h/2,fill);text(str,x+w/2,y+h/2+10,25,color,'bold','center')}
function check(x,y,s=1,color=C.purple,p=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);const q=clamp(p*2);line(-12,0,lerp(-12,-2,q),lerp(0,10,q),color,5);if(p>.5)line(-2,10,lerp(-2,18,(p-.5)*2),lerp(10,-14,(p-.5)*2),color,5);ctx.restore()}
function arrow(x,y,color=C.purple){line(x-18,y,x+18,y,color,3);line(x+7,y-11,x+18,y,color,3);line(x+7,y+11,x+18,y,color,3)}
function sparkle(x,y,size,color,rot=0){group(x,y,size,rot,1,()=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-1);ctx.quadraticCurveTo(.18,-.18,1,0);ctx.quadraticCurveTo(.18,.18,0,1);ctx.quadraticCurveTo(-.18,.18,-1,0);ctx.quadraticCurveTo(-.18,-.18,0,-1);ctx.fill()})}
function brand(x,y,size,color=C.ink,alpha=1){group(x,y,size/60,0,alpha,()=>{ctx.drawImage(imgs.symbol,0,-51,62,62);text('Provaai',78,0,60,color);ctx.font='60px "Segoe Bold"';text('.',78+ctx.measureText('Provaai').width,0,60,C.mint)})}
function credit(dark=false){text('PROVAAI',84,75,18,dark?'#ffffff80':'#0d182370');text('CADA ALUNO, UMA POSSIBILIDADE',1836,75,16,dark?'#ffffff80':'#0d182370','normal','right')}
function reveal(str,x,y,size,t,color=C.ink,align='left',delay=0){const p=out((t-delay)/.8);group(x,y+65*(1-p),1+.04*(1-p),0,p,()=>text(str,0,0,size,color,'bold',align))}
function ambient(t,color=C.paper){ctx.fillStyle=color;ctx.fillRect(0,0,W,H);}
function screen(img,x,y,w,h,rotation=0,alpha=1,crop){
 group(x,y,1,rotation,alpha,()=>{
  shadow(()=>box(-w/2,-h/2,w,h,24,'white'),55,'#1a063a2a',28);
  ctx.save();ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,24);ctx.clip();
  if(crop)ctx.drawImage(img,...crop,-w/2,-h/2,w,h);else ctx.drawImage(img,-w/2,-h/2,w,h);
  ctx.restore();box(-w/2,-h/2,w,h,24,null,'#ffffffc0');
 });
}
function bloub(x,y,size,t,alpha=1){group(x,y,1,Math.sin(t*1.6)*.055,alpha,()=>{ctx.scale(1+Math.sin(t*2.8)*.025,1-Math.sin(t*2.8)*.025);ctx.drawImage(imgs.bloub,-size/2,-size/2,size,size)})}

// 00–05.5: typography is the hero; a small living brand mark starts the story.
function opening(t){
 ambient(t,'#FBFAFC');
 const enter=spring(t-.12,6);
 const exit=ease((t-2.65)/.75);
 group(960,510,lerp(1,.82,exit),0,1-exit,()=>{
  reveal('Uma turma.',0,-85,136,t,C.ink,'center');
  reveal('Muitos jeitos de aprender.',0,80,92,t,C.purple,'center',.55);
  group(0,210,1,0,out(t-1.15),()=>text('É aqui que cada possibilidade começa.',0,0,31,C.muted,'normal','center'));
 });
 const orbit=1-ease((t-2.3)/.75);
 for(let i=0;i<6;i++){const a=i*Math.PI/3+t*.17,r=660;const x=960+Math.cos(a)*r,y=510+Math.sin(a)*400;
  group(x,y,Math.max(.001,enter)*orbit,.1*Math.sin(t+i),orbit,()=>{if(i%2) sparkle(0,0,18+i*2,i%3?C.mint:C.purple,t*.15);else {circle(0,0,27+i*3,['#E2D5FB','#B9F6E8','#D7E8FF'][i/2]);circle(0,0,6,C.purple)}});
 }
 const p=spring(t-3.05,6.5);
 group(960,500,Math.max(.001,p),.04*(1-p),out((t-3)/.5),()=>{
  bloub(-390,-8,220,t);text('Provaai',-240,52,158,C.ink);text('.',325,52,158,C.mint);
  text('Cada aluno, uma possibilidade.',0,180,43,C.muted,'normal','center');
 });
 const swipe=ease((t-4.93)/.57);
 if(swipe>0){ctx.fillStyle=C.purple;ctx.beginPath();ctx.moveTo(1920*(1-swipe),0);ctx.bezierCurveTo(2100*(1-swipe),350,1500*(1-swipe),750,1920*(1-swipe),1080);ctx.lineTo(1920,1080);ctx.lineTo(1920,0);ctx.fill()}
}

// 05.5–10.5: real public demo capture, moving as a product surface.
function classroom(t){
 ambient(t,'#F1EBFA');credit();
 const p=spring(t,.85*8),z=ease((t-2.8)/1.7);
 group(-z*80,0,1,0,1-z*.24,()=>{
  label('01 / ORGANIZE',100,285);
  reveal('Tudo começa',100,414,83,t,C.ink);
  reveal('pela sua',100,512,83,t,C.ink,'left',.12);
  reveal('turma.',100,610,104,t,C.purple,'left',.25);
  group(100,700,1,0,out(t-.8),()=>{wrap('Alunos, perfis e avaliações.\nUm espaço para ensinar.',0,0,500,31,C.muted)});
  group(100,845,1,0,out(t-1.25),()=>{pill('Turmas',0,0,148,'white',C.purple);pill('Alunos',165,0,148,'white',C.purple);});
 });
 const sw=1100+z*200,sh=sw*1000/1440;
 screen(imgs.turmas,1320+650*(1-p)-z*30,555+70*(1-p),sw,sh,-.035*(1-z)+.006*Math.sin(t),out(t/.4));
 group(1120,905,Math.max(.01,spring(t-1.5)),.018, out(t-1.4),()=>{shadow(()=>box(-260,-42,520,84,25,C.ink),25,'#00000020',10);circle(-213,0,15,C.mint);check(-213,0,.5,C.ink);text('Mais tempo para ensinar.',-180,10,29,'white')});
}

// 10.5–15.5: pedagogical profile cards, based on the demo's exact data.
function profiles(t){
 ambient(t,'#DFF9F2');credit();
 reveal('Um olhar para',960,234,83,t,C.ink,'center');
 reveal('cada aluno.',960,333,100,t,C.purple,'center',.14);
 const cards=[
  {name:'Ana Clara',initials:'AC',color:'#EAE0FD',tag:'Enunciados curtos',detail:'Mais espaço para os cálculos.',caption:'Frações e equivalência'},
  {name:'Bruno Henrique',initials:'BH',color:'#D5F4E9',tag:'Exemplos do cotidiano',detail:'Problemas que fazem sentido.',caption:'Porcentagens'},
  {name:'Camila Oliveira',initials:'CO',color:'#FFEDD9',tag:'Uma questão de desafio',detail:'Novas formas de ir além.',caption:'Matemática · 7º ano A'}
 ];
 cards.forEach((c,i)=>{
  const p=spring(t-.45-i*.14,6.8),u=ease((t-3.8)/1),targetX=430+i*530;
  group(lerp(960,targetX,p),lerp(1150,640,p)+Math.sin(t*1.5+i)*8,lerp(.72,1,p),lerp((i-1)*.15,(i-1)*.025,p)*(1-u),out(t-.3-i*.15),()=>{
   shadow(()=>box(-242,-205,484,430,30,'white'),38,'#14352818',20);
   circle(-155,-113,43,c.color);text(c.initials,-155,-100,29,C.purple,'bold','center');
   text(c.name,-94,-120,29,C.ink);text('Perfil pedagógico',-94,-81,21,C.muted,'normal');
   line(-200,-40,200,-40,C.line,1);
   text(c.caption,-200,10,24,C.muted,'normal');
   pill(c.tag,-204,47,408,c.color,C.ink,52);
   wrap(c.detail,-198,151,390,25,C.muted);
   circle(199,-175,21,C.mint);check(199,-175,.6,C.ink,out(t-1.2-i*.15));
  });
 });
 group(960,969,1,0,out(t-1.8),()=>text('O mesmo conteúdo. Diferentes caminhos.',0,0,34,C.ink,'normal','center'));
}

function input(labelText,value,x,y,w,t,delay=0){
 const p=out((t-delay)/.55);group(x,y+25*(1-p),1,0,p,()=>{text(labelText,0,0,22,C.muted,'normal');box(0,17,w,66,15,'#F6F4FA',C.line);text(value,21,61,29,C.ink,'normal')});
}
// 15.5–21: editable UI details interpreted from the real preparation form.
function prepare(t){
 ambient(t,C.purple);credit(true);
 const glow=ctx.createRadialGradient(1600,300,0,1600,300,950);glow.addColorStop(0,'#8C54EE');glow.addColorStop(1,C.purple);ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
 label('02 / PREPARE',100,265,'#CDB9F3');
 reveal('Seu conteúdo.',100,401,83,t,'white');
 reveal('Novas',100,505,83,t,'white','left',.12);
 reveal('possibilidades.',100,609,83,t,C.mint,'left',.25);
 group(100,704,1,0,out(t-.8),()=>wrap('Defina os objetivos. Escolha o modelo. Prepare com apoio da IA.',0,0,570,32,'#E0D2F8'));
 bloub(390,920,145,t,out(t-1.4));
 const p=spring(t-.2,7);
 group(1325+550*(1-p),560+80*(1-p),.95+.05*p,-.035*(1-p)+Math.sin(t*.65)*.008,out(t/.4),()=>{
  shadow(()=>box(-405,-406,810,812,34,'white'),60,'#1E004B70',30);
  text('Preparar provas',-356,-337,37,C.ink);pill('7º ano A',220,-370,132,'#EDE4FC',C.purple,44);
  input('Título da avaliação','Frações no cotidiano',-355,-265,710,t,.6);
  input('Conteúdos e objetivos','Frações e equivalência',-355,-135,710,t,.85);
  text('Questões por aluno',-355,18,25,C.ink);
  const n= Math.round(lerp(2,5,ease((t-1.4)/.8)));
  for(let i=0;i<3;i++){const x=-355+i*244;box(x,42,220,111,18,i===0?'#EEE5FC':'#F6F4FA');text(['Total','Objetivas','Discursivas'][i],x+20,76,21,C.muted,'normal');text(String([n,Math.min(3,n),Math.max(0,n-3)][i]),x+20,127,40,C.purple)}
  group(0,0,1,0,out(t-1.8),()=>{box(-355,184,710,64,17,'#E5FAF4');circle(-318,216,16,C.mint);check(-318,216,.55,C.ink);text('Gerar rascunhos com IA',-284,226,27,C.ink)});
  const b=1+.025*Math.sin(clamp((t-2.6)/.5)*Math.PI);
  group(0,0,b,0,1,()=>{box(-355,277,710,73,18,C.purple);text('Preparar provas',0,325,28,'white','bold','center')});
  text('Você revisa antes de imprimir.',0,382,21,C.muted,'normal','center');
 });
 const q=out((t-3)/.5);group(1600,940,Math.max(.001,spring(t-3)),0,q,()=>{pill('✦  Uma prova por aluno',-210,-35,420,C.mint,C.ink,70)});
}

function documentCard(x,y,w,h,t,mode='review',rotation=0){
 group(x,y,1,rotation,1,()=>{
  shadow(()=>box(-w/2,-h/2,w,h,25,'white'),45,'#14072824',22);
  const left=-w/2+52,top=-h/2+64;
  label('MATEMÁTICA · 7º ANO A',left,top);
  text('Frações no cotidiano',left,top+59,39,C.ink);
  text('Ana Clara Martins',left,top+104,27,C.muted,'normal');
  line(left,top+137,w/2-52,top+137,C.line);
  text('01',left,top+193,31,C.purple);
  wrap('Uma receita usa 1/2 de xícara de leite e 1/4 de xícara de água. Qual é o volume total de líquidos?',left+65,top+190,w-165,27,C.ink,1.4);
  const opts=['1/4','1/2','3/4','1'];
  opts.forEach((v,i)=>{const yy=top+341+i*55;const p=i===2?out((t-1.4)/.4):0;box(left+55,yy-28,w-162,47,11,p?'#DDF9F0':'#F8F7FA');circle(left+80,yy-5,10,p?C.purple:'#D9D3E3');text(v,left+110,yy+3,25,C.ink,'normal');if(p)check(w/2-93,yy-5,.5,C.purple,p)});
  if(mode==='review'){
   const p=spring(t-2.6,8);group(0,h/2-57,Math.max(.001,p),0,out(t-2.6),()=>{pill('Revisada e aprovada',-w/2+52,-33,w-104,C.mint,C.ink,66);check(-w/2+105,0,.7,C.ink)});
  }else {line(left,h/2-130,w/2-52,h/2-130,C.line);text('Espaço para os cálculos',left,h/2-95,21,C.muted,'normal');}
 });
}
// 21–26: editorial review and human approval, with a readable question.
function review(t){
 ambient(t,'#FAF9FC');credit();
 label('03 / REVISE',100,276);
 reveal('A IA prepara.',100,417,89,t,C.ink);
 reveal('Você decide.',100,527,94,t,C.purple,'left',.2);
 group(100,635,1,0,out(t-.75),()=>wrap('Revise os enunciados. Ajuste as respostas. Aprove cada avaliação.',0,0,560,32,C.muted));
 const p=spring(t-.15,6.5);
 group(1325+650*(1-p),565,1,-.02*(1-p),out(t/.3),()=>documentCard(0,0,780,830,t));
 group(390,875,Math.max(.001,spring(t-2.9)),0,out(t-2.8),()=>{circle(-231,-9,30,C.mint);check(-231,-9,.9,C.ink);text('O professor no controle.',-182,1,30,C.ink)});
}

function fileCard(x,y,rot,title,tag,color,t,i){
 const p=spring(t-.45-i*.12,6.5);
 group(lerp(960,x,p),lerp(1200,y,p)+Math.sin(t*1.3+i)*7,lerp(.6,1,p),rot*p,out(t-.4-i*.12),()=>{
  shadow(()=>box(-175,-225,350,450,26,'white'),45,'#00000035',22);
  box(-175,-225,350,13,[26,26,0,0],color);
  pill(tag,-129,-176,tag.length>5?215:110,color,'white',45);
  text(title,-130,-74,32,C.ink);
  text('Frações no cotidiano',-130,-26,20,C.muted,'normal');
  for(let j=0;j<5;j++)box(-130,17+j*29,j%3===0?180:250,7,4,j===0?'#AFA4C0':'#E1DCE8');
  circle(105,162,27,color);line(105,148,105,170,'white',3);line(97,163,105,171,'white',3);line(113,163,105,171,'white',3);
 });
}
// 26–30.5: files burst outward on musical accents and settle in a small fan.
function exportsScene(t){
 ambient(t,C.ink);credit(true);
 reveal('Do seu jeito.',960,232,87,t,'white','center');
 reveal('Pronta para imprimir.',960,330,87,t,C.mint,'center',.13);
 fileCard(520,690,-.105,'Sua prova','PDF',C.purple,t,0);
 fileCard(1400,690,.105,'Gabarito','RESPOSTAS','#138B76',t,2);
 fileCard(960,670,-.015,'Sua prova','WORD','#3066D9',t,1);
 group(960,1005,1,0,out(t-1.4),()=>text('PDF, Word e gabarito. Individual ou em lote.',0,0,30,'#C8D1D9','normal','center'));
 const a=ease((t-3.8)/.7);if(a>0)circle(960,540,a*1200,C.purple);
}
// 30.5–36: distinct brand resolve, no fade-to-black truncation.
function ending(t){
 ambient(t,C.purple);
 for(let i=0;i<3;i++){const r=240+i*150+Math.sin(t*.5+i)*10;ctx.beginPath();ctx.ellipse(960,470,r,r*.72,0,0,Math.PI*2);ctx.strokeStyle='#FFFFFF10';ctx.lineWidth=1.5;ctx.stroke()}
 const p=spring(t,7);bloub(960,lerp(680,285,p),225,t,out(t/.4));
 group(960,520,1,0,out(t/.4),()=>{reveal('Provaai.',0,0,157,t,'white','center',.15)});
 reveal('Cada aluno, uma possibilidade.',960,635,48,t,'white','center',.55);
 const q=spring(t-1.15,7);group(960,780,Math.max(.001,q),0,out(t-1.1),()=>{box(-275,-42,550,84,42,C.mint);text('Conheça o Provaai',-22,10,31,C.ink,'bold','center');arrow(218,0,C.ink)});
 group(960,910,1,0,out(t-1.6),()=>text('provaai.vercel.app',0,0,30,'#D5C3F4','normal','center'));
 sparkle(573,303,23,C.mint,t*.25);sparkle(1370,418,14,'#B996F7',-t*.2);
}

const scenes=[{start:0,end:5.5,draw:opening},{start:5.5,end:10.5,draw:classroom},{start:10.5,end:15.5,draw:profiles},{start:15.5,end:21,draw:prepare},{start:21,end:26,draw:review},{start:26,end:30.5,draw:exportsScene},{start:30.5,end:36,draw:ending}];
function frame(t){ctx.resetTransform();ctx.globalAlpha=1;ctx.clearRect(0,0,W,H);const ix=scenes.findIndex(s=>t>=s.start&&t<s.end);const s=scenes[Math.max(0,ix)];s.draw(t-s.start);
 // Short overlapping transitions; outgoing content carries velocity into the cut.
 const next=scenes[ix+1],dur=.38;
 if(next&&t>s.end-dur&&ix!==0&&ix!==5){const p=ease((t-s.end+dur)/dur);ctx.save();ctx.globalAlpha=p;ctx.translate(0,80*(1-p));next.draw(0);ctx.restore()}
}

// Original instrumental: warm A-major/F#-minor harmony, syncopated plucks,
// soft percussion and quiet transition sweeps. No copyrighted audio assets.
async function score(){
 const sr=48000,n=sr*DURATION,L=new Float32Array(n),R=new Float32Array(n),bpm=110,beat=60/bpm;
 let seed=1927;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1};
 function add(start,len,fn,pan=0){const offset=Math.floor(start*sr),count=Math.min(Math.floor(len*sr),n-offset);for(let i=Math.max(0,-offset);i<count;i++){const v=fn(i/sr,i);L[offset+i]+=v*Math.sqrt((1-pan)/2);R[offset+i]+=v*Math.sqrt((1+pan)/2)}}
 const freq=m=>440*2**((m-69)/12);
 function tone(at,m,dur,amp,pan=0,kind='pluck'){
  const f=freq(m);add(at,dur,(s)=>{const env=kind==='pad'?Math.min(1,s/.35)*Math.min(1,(dur-s)/.65)*.5:Math.min(1,s/.008)*Math.exp(-s*3.8)*Math.min(1,(dur-s)/.1);return amp*env*(Math.sin(2*Math.PI*f*s)+.25*Math.sin(2*Math.PI*f*2*s)+.08*Math.sin(2*Math.PI*f*3.002*s))},pan);
  if(kind==='pluck'&&amp>.02){tone(at+beat*.75,m,dur,.018,pan*.6,'echo')}
 }
 const chords=[[57,61,64,68],[54,57,61,64],[50,54,57,61],[52,56,59,64]];
 for(let bar=0;bar<17;bar++){
  const at=bar*4*beat,notes=chords[bar%4];
  notes.forEach((v,j)=>tone(at,v,beat*4+.5,.055,(j-1.5)*.35,'pad'));
  if(bar<16){[0,.75,1.5,2.5,3.25].forEach((b,j)=>tone(at+b*beat,notes[(j+bar)%4]+12,1.1,.105*(bar===0?.5:1),Math.sin(j*2+bar)*.65));}
 }
 for(let b=0;b<64;b++){
  const at=b*beat;if(at<4||at>32.8)continue;
  add(at,.30,s=>.22*Math.sin(2*Math.PI*(47*s+2.5*(1-Math.exp(-s*35))))*Math.exp(-s*16));
  if(b%2===1)add(at,.18,s=>rnd()*.07*Math.exp(-s*33)+.025*Math.sin(2*Math.PI*180*s)*Math.exp(-s*28),.12);
  [0,.5,.75].forEach((q,j)=>{let prev=0;add(at+q*beat,.07,s=>{let z=rnd(),v=z-prev;prev=z;return v*.021*Math.exp(-s*65)},j%2?.5:-.5)});
  if(b%2===0)tone(at,chords[Math.floor(b/4)%4][0]-12,.5,.12,0,'bass');
 }
 for(const at of [5.5,10.5,15.5,21,26,30.5]){let prev=0;add(at-.33,.65,s=>{const noise=rnd();prev=.84*prev+.16*noise;return prev*.17*Math.sin(Math.PI*s/.65)**2},.1);tone(at,88,.8,.045,.5)}
 const pcm=Buffer.alloc(n*4);let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));
 const gain=.83/Math.max(peak,.01);
 for(let i=0;i<n;i++){const t=i/sr,fade=Math.min(1,t/.6)*Math.min(1,(DURATION-t)/1.6);pcm.writeInt16LE(Math.round(clamp(L[i]*gain*fade,-1,1)*32767),i*4);pcm.writeInt16LE(Math.round(clamp(R[i]*gain*fade,-1,1)*32767),i*4+2)}
 const hdr=Buffer.alloc(44);hdr.write('RIFF');hdr.writeUInt32LE(pcm.length+36,4);hdr.write('WAVEfmt ',8);hdr.writeUInt32LE(16,16);hdr.writeUInt16LE(1,20);hdr.writeUInt16LE(2,22);hdr.writeUInt32LE(sr,24);hdr.writeUInt32LE(sr*4,28);hdr.writeUInt16LE(4,32);hdr.writeUInt16LE(16,34);hdr.write('data',36);hdr.writeUInt32LE(pcm.length,40);
 await writeFile(path.join(OUT,'trilha-original.wav'),Buffer.concat([hdr,pcm]));
}

const stillTimes=[1.8,4.25,7.8,12.8,18.4,24.4,28.5,33.8];
for(const [i,t] of stillTimes.entries()){frame(t);await writeFile(path.join(OUT,`quadro-${i+1}.png`),canvas.toBuffer('image/png'))}
const contact=createCanvas(1600,1800),cc=contact.getContext('2d');
for(let i=0;i<8;i++){const img=await loadImage(path.join(OUT,`quadro-${i+1}.png`));cc.drawImage(img,(i%2)*800,Math.floor(i/2)*450,800,450)}
await writeFile(path.join(OUT,'storyboard.jpg'),contact.toBuffer('image/jpeg'));
if(process.argv.includes('--stills')){console.log('8 keyframes rendered.');process.exit(0)}
await score();
const ffmpeg=process.env.FFMPEG_PATH||path.join(DIR,'ffmpeg.exe');
const movie=path.join(OUT,'Provaai-apresentacao-1080p.mp4');
const proc=spawn(ffmpeg,['-hide_banner','-loglevel','warning','-y','-f','rawvideo','-pixel_format','rgba','-video_size',`${W}x${H}`,'-framerate',String(FPS),'-i','pipe:0','-i',path.join(OUT,'trilha-original.wav'),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-ar','48000','-movflags','+faststart','-t',String(DURATION),movie],{stdio:['pipe','ignore','inherit'],windowsHide:true});
let failure;proc.on('error',e=>failure=e);proc.stdin.on('error',e=>failure=e);
for(let f=0;f<FPS*DURATION;f++){
 if(failure)throw failure;
 frame(f/FPS);const data=canvas.data();if(!proc.stdin.write(data))await once(proc.stdin,'drain');
 if(f%(FPS*3)===0)console.log(`Rendered ${f/FPS}s / ${DURATION}s`);
}
proc.stdin.end();const [code]=await once(proc,'close');if(code!==0)throw new Error(`FFmpeg exited ${code}`);
console.log(`Completed: ${movie}`);
