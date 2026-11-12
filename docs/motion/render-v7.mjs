/** Model B: a continuous camera journey. Native 120fps, no frame interpolation. */
import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {FPS,DURATION,stations,action,events} from './timing-v7.mjs';
import {createAudio} from './audio-v7.mjs';
import {loadBloub} from './bloub-animation.mjs';
const DIR=path.dirname(fileURLToPath(import.meta.url)),OUT=path.join(DIR,'output/v7');
await mkdir(OUT,{recursive:true});
for(const [file,family] of [['segoeui.ttf','UI'],['segoeuib.ttf','Bold'],['segoeuisl.ttf','Light']])GlobalFonts.registerFromPath(`C:/Windows/Fonts/${file}`,family);
const W=1920,H=1080,P='#5210CE',M='#2ADFB8',INK='#101823',MUTED='#727782',BG='#FCFCFE';
const canvas=createCanvas(W,H),g=canvas.getContext('2d');
const mascot=await loadBloub(path.resolve(DIR,'../..'));
const screenshot=await loadImage(path.join(DIR,'assets/turmas.png'));
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,p)=>a+(b-a)*p;
const ease=v=>{v=clamp(v);return v*v*v*(v*(v*6-15)+10)};
const out=v=>1-(1-clamp(v))**3;
const pulse=(t,at,d=.25)=>Math.sin(Math.PI*clamp((t-at)/d));
function group(x,y,s,r,alpha,fn){g.save();g.translate(x,y);g.rotate(r);g.scale(s,s);g.globalAlpha*=clamp(alpha);fn();g.restore()}
function rect(x,y,w,h,r,fill,stroke){if(w<=0||h<=0)return;g.beginPath();g.roundRect(x,y,w,h,r);if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.strokeStyle=stroke;g.lineWidth=1.5;g.stroke()}}
function txt(text,x,y,size=40,color=INK,font='UI',align='center'){g.font=`${size}px "${font}"`;g.fillStyle=color;g.textAlign=align;g.textBaseline='middle';g.fillText(text,x,y)}
function line(x,y,X,Y,c,w=3){g.beginPath();g.moveTo(x,y);g.lineTo(X,Y);g.strokeStyle=c;g.lineWidth=w;g.lineCap='round';g.stroke()}
function dot(x,y,r,c){g.beginPath();g.arc(x,y,Math.max(.01,r),0,Math.PI*2);g.fillStyle=c;g.fill()}
function star(x,y,r,c,rotation=0){group(x,y,r,rotation,1,()=>{g.beginPath();g.moveTo(0,-1);g.quadraticCurveTo(.2,-.2,1,0);g.quadraticCurveTo(.2,.2,0,1);g.quadraticCurveTo(-.2,.2,-1,0);g.quadraticCurveTo(-.2,-.2,0,-1);g.fillStyle=c;g.fill()})}
function shadow(fn,dy=17,blur=34){g.save();g.shadowColor='#291A3F1A';g.shadowOffsetY=dy;g.shadowBlur=blur;fn();g.restore()}
function card(x,y,w,h,r=34,fill='white'){shadow(()=>rect(x,y,w,h,r,fill,'#E5E1EC'))}
function tick(x,y,s=1,c=INK,p=1){group(x,y,s,0,1,()=>{const a=clamp(p*2),b=clamp(p*2-1);line(-15,0,mix(-15,-3,a),12*a,c,4);if(b)line(-3,12,mix(-3,20,b),mix(12,-15,b),c,4)})}
function label(s,x,y,w,color=P,fill='#EEE8FB'){rect(x-w/2,y-24,w,48,24,fill);txt(s,x,y,22,color)}
function title(s,t,y=-320,size=69,color=INK){const a=out((t+.18)/.7);group(0,y+(1-a)*44,1,0,a,()=>txt(s,0,0,size,color,'Bold'))}
function cursor(x,y,t,at){const p=pulse(t,at-.07,.16);group(x,y,1-.12*p,-.1,1,()=>{g.beginPath();g.moveTo(0,0);g.lineTo(1,48);g.lineTo(14,36);g.lineTo(27,59);g.lineTo(37,53);g.lineTo(25,31);g.lineTo(44,27);g.closePath();g.fillStyle='white';g.strokeStyle=INK;g.lineWidth=2.7;g.fill();g.stroke()})}
function ring(x,y,t,at,color=M,r=30){const p=(t-at)/.55;if(p<0||p>1)return;group(x,y,1,0,1-p,()=>{g.beginPath();g.arc(0,0,r+out(p)*62,0,Math.PI*2);g.strokeStyle=color;g.lineWidth=2.4*(1-p);g.stroke()})}
function bloub(x,y,size,t,pose={}){mascot.draw(g,{x,y,size,pose:{y:Math.sin(t*1.5)*3,rotation:Math.sin(t)*2,eyeX:0,eyeY:0,...pose}})}
const glowSprites=new Map();
function glow(x,y,r,c,alpha=.15){if(!glowSprites.has(c)){const a=createCanvas(256,256),q=a.getContext('2d'),d=q.createRadialGradient(128,128,0,128,128,128);d.addColorStop(0,c);d.addColorStop(1,c+'00');q.fillStyle=d;q.fillRect(0,0,256,256);glowSprites.set(c,a)}group(x,y,1,0,alpha,()=>g.drawImage(glowSprites.get(c),-r,-r,r*2,r*2))}
function wire(points,progress=1,color='#D9D0EE',width=3){const lengths=points.slice(1).map((v,i)=>Math.hypot(v[0]-points[i][0],v[1]-points[i][1]));let remain=clamp(progress)*lengths.reduce((a,b)=>a+b,0),end=points[0];g.beginPath();g.moveTo(...end);for(let i=0;i<lengths.length&&remain>0;i++){const p=clamp(remain/lengths[i]);end=[mix(points[i][0],points[i+1][0],p),mix(points[i][1],points[i+1][1],p)];g.lineTo(...end);remain-=lengths[i]}g.strokeStyle=color;g.lineWidth=width;g.lineJoin='round';g.lineCap='round';g.stroke();return end}
function signal(points,t,at,d=.65,color=P){const p=(t-at)/d;if(p<0||p>1)return;for(let j=9;j>=0;j--){const q=clamp(ease(p)-j*.018);group(0,0,1,0,(1-j/10)*.45,()=>{const v=wire(points,q,color,.5);dot(...v,4-j*.25,color)})}const v=wire(points,ease(p),color,2);glow(...v,30,color,.3);dot(...v,5,color);dot(...v,2,'white')}
function icon(kind,x,y,color=P){group(x,y,1,0,1,()=>{if(kind==='Turmas'){for(let j=0;j<4;j++)rect(-23+j%2*28,-23+Math.floor(j/2)*28,18,18,5,null,color)}else if(kind==='Perfis'){dot(-9,-10,10,color);dot(14,-5,8,color);g.beginPath();g.arc(-9,19,17,Math.PI,0);g.strokeStyle=color;g.lineWidth=4;g.stroke()}else if(kind==='Questões')star(0,0,27,color);else{rect(-20,-28,40,56,8,null,color);for(let j=0;j<3;j++)line(-10,-9+j*11,10,-9+j*11,color,3)}})}

function network(t){
 const morph=ease((t-.4)/.6);glow(0,0,370,P,.06);glow(50,0,260,M,.12);
 const nodes=[[-500,-235,'Turmas'],[500,-235,'Perfis'],[-500,235,'Questões'],[500,235,'Modelos']];
 for(const [i,[x,y,s]] of nodes.entries()){
  const q=out((t-1.02-i*.15)/.55),pts=[[x<0?-150:150,0],[x*.55,0],[x*.55,y],[x,y]];
  wire(pts,q);signal(pts,t,.9+i*.18,.65,i%2?M:P);ring(x,y,t,1.55+i*.18,M,58);
  group(x,y+(1-q)*55,Math.max(.01,q),.08*(1-q)*(i%2?1:-1),q,()=>{card(-65,-65,130,130,30);icon(s,0,0,i%2?'#078F78':P);txt(s,0,100,28,INK)});
 }
 const press=pulse(t,action.connect-.07,.18);group(0,0,1-.035*press,0,1,()=>{if(morph)card(-mix(85,177,morph),-56,mix(170,354,morph),112,32,'#F5F3F9');bloub(mix(0,-111,morph),0,mix(220,76,morph),t,{eyeX:Math.sin(t*3)*9,rotation:mix(-12,0,out(t/.45))});group(35,0,1,0,morph,()=>txt('Criar prova',0,0,35,INK))});
 const c=ease((t-.45)/.42);group(0,0,1,0,c*(1-ease((t-1.15)/.3)),()=>cursor(mix(380,123,c),mix(230,35,c),t,.9));
 title('Do seu jeito. Para cada aluno.',t-1.5,400,44,INK);
 ring(0,0,t,3.12,M,170);
}
function words(t){
 const focus=ease((t-.85)/1.0),s=mix(.95,2.05,focus),select=ease((t-.95)/.35);
 group(0,-20,s,-.026*focus,1,()=>{
  const a=out((t+.1)/.5),b=out((t-.12)/.5),c=out((t-.35)/.5);
  group(-300,(1-a)*40,1,0,a,()=>txt('Cada',0,0,88,INK,'Bold'));
  group(345,(1-c)*40,1,0,c,()=>txt('importa.',0,0,88,INK,'Bold'));
  rect(-138,-61,262*select,122,5,'#EEE6FC');
  group(-7,(1-b)*40,1,0,b,()=>txt('aluno',0,0,88,P,'Bold'));
  if(select){const right=-138+262*select;line(-138,-61,-138,61,P,2);line(right,-61,right,61,P,2);dot(-138,66,7,P);dot(right,-66,7,P);ring(right,-66,t,1.3,M,8);}
  const scan=clamp((t-1.5)/.6);if(scan>0&&scan<1){g.save();g.beginPath();g.rect(-138,-61,262,122);g.clip();const xx=-180+360*scan,d=g.createLinearGradient(xx-30,0,xx+30,0);d.addColorStop(0,'#2ADFB800');d.addColorStop(.5,'#2ADFB877');d.addColorStop(1,'#2ADFB800');g.fillStyle=d;g.fillRect(xx-30,-61,60,122);g.restore();}
 });
}
function prompt(t){
 title('Sua ideia ganha forma.',t,-330,66);
 const grow=ease((t-.1)/1.2),h=mix(210,410,grow),press=pulse(t,action.create-.08,.18);
 group(0,30,1+.02*Math.sin(t*.7),-.012*Math.sin(t),1,()=>{
  glow(0,80,670,P,.09);glow(400,10,360,M,.16);card(-620,-h/2,1240,h,44,'#F6F5F9');
  txt('O que sua turma vai aprender?',-555,-h/2+52,27,MUTED,'UI','left');
  const text='Matemática. Frações. 7º ano.',count=Math.floor(clamp((t-.5)/1.1)*text.length);txt(text.slice(0,count),-555,-h/2+123,48,INK,'UI','left');
  if(t<1.75){g.font='48px UI';const w=g.measureText(text.slice(0,count)).width;line(-549+w,-h/2+97,-549+w,-h/2+149,P,3);}
  group(0,0,1,0,grow,()=>{line(-555,18,555,18,'#DEDAE8',1);label('3 objetivas',-410,82,260);label('2 discursivas',-110,82,280,'#087D65','#DEF7EE');group(420,82,1-.055*press,0,1,()=>{rect(-128,-37,256,74,25,P);star(-77,0,18,M);txt('Criar',13,0,33,'white','Bold')});txt('Conteúdo definido por você.',-555,161,25,MUTED,'UI','left')});
  ring(420,82,t,action.create,M,35);
 });
 const q=ease((t-1.65)/.65);group(0,0,1,0,q*(1-ease((t-2.6)/.3)),()=>cursor(mix(670,490,q),mix(310,125,q),t,action.create));
}
function profiles(t){
 title('Uma turma. Muitos jeitos.',t,-340,68);
 for(let i=0;i<3;i++){
  const q=out((t-.13-i*.12)/.65),x=(i-1)*465,orbit=Math.sin(t*.9+i)*8;
  group(x,orbit+(1-q)*95,Math.max(.01,mix(.88,1,q)),(i-1)*.03+.006*Math.sin(t),q,()=>{card(-211,-205,422,410,35);dot(0,-113,48,i===1?'#D5F4E9':'#E8DEFB');txt(['AC','BH','CO'][i],0,-113,31,P,'Bold');txt(['Ana Clara','Bruno Henrique','Camila Oliveira'][i],0,-12,30,INK,'Bold');txt(['Enunciados curtos','Exemplos do cotidiano','Questões de desafio'][i],0,51,25,MUTED);label(['Clareza','Contexto','Desafio'][i],0,125,210,i===1?'#078F78':P,i===1?'#DEF7EE':'#EEE8FB')});
  const pts=[[x,220],[x,300],[0,300],[0,364]];wire(pts,out((t-.7)/.7));signal(pts,t,1.44+i*.09,.6,i===1?M:P);
 }
 bloub(0,390,120,t,{eyeX:Math.sin(t*4)*12,eyeY:-12,y:-8*pulse(t,action.merge,.5),happy:t>2.22?1:0});
 ring(0,365,t,action.merge,M,30);
}
function drafting(t){
 title('A IA prepara.',t,-360,77);
 group(50,5,1,-.018+Math.sin(t*.8)*.006,1,()=>{
  shadow(()=>rect(-615,-247,1230,545,40,'#141923'),22,45);glow(300,200,420,P,.3);star(-535,-172,23,M,t*.35);txt('Rascunhos da sua turma',-480,-169,33,'white','UI','left');
  for(let i=0;i<3;i++){
   const q=out((t-.5-i*.38)/.5),y=-82+i*108;
   group((1-q)*60,y,1,0,q,()=>{rect(-545,-37,1090,82,17,'#282F3E');dot(-494,4,24,['#E1D2FC','#C8F4E6','#F2DFC7'][i]);txt(['AC','BH','CO'][i],-494,4,17,INK,'Bold');txt(['Frações no cotidiano','Porcentagens na prática','Um novo desafio'][i],-447,-8,29,'white','UI','left');rect(-447,22,790*clamp((t-.68-i*.38)/.95),5,3,M);tick(489,3,.9,M,out((t-1.7-i*.2)/.3))});
  }
 });
 bloub(-725,170,155,t,{eyeX:16,eyeY:mix(-17,17,ease((t-.6)/1.5)),rotation:9+4*Math.sin(t),happy:t>action.draftDone?1:0});
 group(0,390,1,0,out((t-1.9)/.5),()=>txt('Você revisa. Você aprova.',0,0,37,MUTED));
}
function review(t){
 title('A decisão é sua.',t,-390,64);
 const yes=ease((t-action.approve)/.26),answer=ease((t-action.answer)/.25);
 group(-80,45,1,-.018+ease(t/3)*.03,1,()=>{
  card(-490,-320,980,640,35);txt('Frações no cotidiano',0,-244,38,INK,'Bold');txt('Quanto é 1/2 + 1/4?',-407,-165,36,INK,'UI','left');
  ['1/4','1/2','3/4','1'].forEach((v,i)=>{const y=-83+i*71;rect(-415,y-26,830,55,14,i===2&&answer>0?'#DEF7EE':'#F4F2F7');dot(-378,y,10,i===2&&answer>0?P:'#D7D0E2');txt(v,-342,y,29,INK,'UI','left');if(i===2)group(0,0,1,0,answer,()=>tick(365,y,.7,P,answer));});
  const p=pulse(t,action.approve-.07,.16);group(0,251,1-.03*p,0,1,()=>{rect(-415,-37,830,74,23,yes>.45?M:P);txt(yes>.45?'Revisada e aprovada':'Aprovar prova',0,0,31,yes>.45?INK:'white','Bold');if(yes>.45)tick(-345,0,.8,INK,yes)});
 });
 const jump=pulse(t,action.approve,.68);bloub(610,165,230,t,{eyeX:t<action.approve?-17:0,eyeY:10,rotation:t<action.approve?-10:jump*10,y:-jump*75,sy:1+jump*.06,sx:1-jump*.04,happy:t>=action.approve?1:0});
 const q=ease((t-.45)/.5),p=ease((t-1.25)/.65),cx=mix(520,260,q),cy=mix(400,105,q);group(0,0,1,0,out(t/.3)*(1-ease((t-2.5)/.3)),()=>cursor(cx, mix(cy,306,p),t,p>.5?action.approve:action.answer));ring(200,300,t,action.approve,M,35);
}
function files(t){
 title('Pronta para a sala de aula.',t,-350,64);
 const pull=ease((t-action.download)/.65);
 for(const i of [0,2,1]){
  const q=out((t-.2-i*.13)/.6),x=(i-1)*430,y=Math.sin(t+i)*6;
  group(mix(x,0,pull)+Math.sin(pull*Math.PI)*(i-1)*75,mix(y,350,pull),Math.max(.01,q*(1-pull*.93)),(i-1)*.09*(1-pull),1-ease((pull-.83)/.17),()=>{
   card(-164,-223,328,446,27);rect(-125,-178,250,52,15,[P,'#3779D6','#079F82'][i]);txt(['PDF','WORD','GABARITO'][i],0,-152,26,'white','Bold');txt('Frações',-125,-65,34,INK,'Bold','left');txt('no cotidiano',-125,-24,28,INK,'UI','left');for(let j=0;j<5;j++)rect(-125,38+j*26,j%3===2?150:250,7,4,'#DAD5E4');dot(112,178,23,[P,'#3779D6','#079F82'][i]);line(112,167,112,188,'white',3);line(104,180,112,188,'white',3);line(120,180,112,188,'white',3);
  });
 }
 const done=ease((t-action.downloadDone)/.2);group(0,355,1,0,out((t-.4)/.5),()=>{rect(-205,-42,410,84,28,done>.4?M:'#EEE9F8');txt(done>.4?'Tudo pronto':'Baixar provas',0,0,31,done>.4?INK:P,'Bold');ring(0,0,t,action.downloadDone,M,47)});
 const c=ease((t-.92)/.6);group(0,0,1,0,c*(1-ease((t-1.95)/.25)),()=>cursor(mix(440,125,c),mix(460,365,c),t,action.download));
 bloub(650,335,155,t,{eyeX:-16,eyeY:mix(-15,15,pull),rotation:-15*pull*(1-done),y:10*pull*(1-done)-8*pulse(t,action.downloadDone,.4),happy:done>.5?1:0});
}
function product(t){
 title('Tudo conectado no Provaai.',t,-385,60);
 const a=out((t+.1)/.8),w=Math.min(1400,680*screenshot.width/screenshot.height),h=w*screenshot.height/screenshot.width;
 group(0,45,mix(.92,1.025,ease((t+.3)/3)),mix(-.035,.012,ease(t/2.7)),a,()=>{card(-w/2,-h/2,w,h,24);g.save();g.beginPath();g.roundRect(-w/2,-h/2,w,h,24);g.clip();g.drawImage(screenshot,-w/2,-h/2,w,h);g.restore()});
}
function outro(t){
 const p=out((t+.1)/.8);glow(0,-180,450,M,.1);
 bloub(0,-255,220,t,{rotation:8*Math.sin(t*3)*Math.exp(-t),eyeY:16*pulse(t,.75,.7),happy:t>1.1&&t<1.85?1:0});
 group(0,-76,1,0,p,()=>{txt('Provaai',0,0,143,INK,'Bold');dot(267,35,9,M)});
 title('Mais tempo para ensinar.',t-.15,90,56,INK);
 group(0,222,1,0,out((t-.6)/.55),()=>{rect(-260,-43,520,86,43,P);txt('Conheça o Provaai',-20,0,32,'white');line(188,0,220,0,M,3);line(209,-11,220,0,M,3);line(209,11,220,0,M,3)});
 group(0,352,1,0,out((t-.9)/.5),()=>txt('provaai.vercel.app',0,0,29,MUTED));
}
const scenes=[network,words,prompt,profiles,drafting,review,files,product,outro];

export function cameraAt(t){
 let i=stations.findLastIndex(s=>t>=s.at+.48);i=Math.max(0,i);const next=stations[i+1],s=stations[i];
 const start=next?next.at-.72:Infinity,p=next?ease((t-start)/1.2):0;
 const local=t-s.at,driftX=Math.sin(local*.5)*18,driftY=Math.sin(local*.7)*9;
 const nextLocal=next?t-next.at:local;
 const x=mix(s.x+driftX,(next?.x??s.x)+Math.sin(nextLocal*.5)*18,p),y=mix(s.y+driftY,(next?.y??s.y)+Math.sin(nextLocal*.7)*9,p)-Math.sin(p*Math.PI)*90;
 const z=1+.025*mix(Math.sin(local*.6),Math.sin(nextLocal*.6),p)-.24*Math.sin(p*Math.PI)**2;
 const r=.008*Math.sin(t*.6)+Math.sin(p*Math.PI)*((i===3||i===5)?-.052:.032);
 return {x,y,z,r,travel:p>0&&p<1,station:i};
}
function render(t){
 g.resetTransform();g.globalAlpha=1;g.filter='none';g.fillStyle=BG;g.fillRect(0,0,W,H);
 const cam=cameraAt(t);
 glow(430-Math.sin(t*.24)*140,350,560,P,.025);glow(1540+Math.sin(t*.3)*150,760,590,M,.05);
 // World-space camera: all panels share one coordinate system and keep spatial continuity.
 g.save();g.translate(960,540);g.rotate(cam.r);g.scale(cam.z,cam.z);g.translate(-cam.x,-cam.y);
 for(let i=0;i<stations.length-1;i++){
  const a=stations[i],b=stations[i+1];if(Math.abs((a.x+b.x)/2-cam.x)>3400)continue;
  const pts=[[a.x+700,a.y],[a.x+1030,a.y],[b.x-1030,b.y],[b.x-700,b.y]];
  wire(pts,1,'#EAE5F2',2);signal(pts,t,b.at-.72,1.2,M);
 }
 for(let i=0;i<stations.length;i++){
  const s=stations[i];if(Math.abs(s.x-cam.x)>2300||Math.abs(s.y-cam.y)>1700)continue;
  group(s.x,s.y,1,0,1,()=>scenes[i](t-s.at));
 }
 g.restore();
}
// Half-frame exposure only during fast travel. Every output frame is evaluated at 120Hz.
const accum=createCanvas(W,H),ag=accum.getContext('2d');
function frame(t){if(!cameraAt(t).travel){render(t);return}ag.clearRect(0,0,W,H);for(const offset of [-.2/FPS,.2/FPS]){render(Math.max(0,t+offset));ag.globalCompositeOperation='lighter';ag.globalAlpha=.5;ag.drawImage(canvas,0,0)}ag.globalCompositeOperation='source-over';ag.globalAlpha=1;g.resetTransform();g.globalAlpha=1;g.clearRect(0,0,W,H);g.drawImage(accum,0,0)}
const marks=[1.9,3.7,5.55,8.8,11.9,14.95,18.6,19.3,21.5,22.7,24.9,28.7];
const board=createCanvas(1920,1440),bc=board.getContext('2d');
for(const [i,t] of marks.entries()){frame(t);await writeFile(path.join(OUT,`quadro-${String(i+1).padStart(2,'0')}.png`),canvas.toBuffer('image/png'));bc.drawImage(canvas,i%3*640,Math.floor(i/3)*360,640,360)}
await writeFile(path.join(OUT,'storyboard-v7.jpg'),board.toBuffer('image/jpeg'));
await writeFile(path.join(OUT,'camera-120fps.json'),JSON.stringify(Array.from({length:DURATION*FPS},(_,f)=>({frame:f,time:f/FPS,...cameraAt(f/FPS)}))));
if(process.argv.includes('--stills')){console.log('V7: storyboard e câmera gerados.');process.exit(0)}
console.log('Áudio V7:',await createAudio(OUT));
const target=path.join(OUT,'Provaai-motion-v7-1080p-120fps.mp4');
const ff=spawn(path.join(DIR,'ffmpeg.exe'),['-hide_banner','-loglevel','warning','-y','-thread_queue_size','64','-f','rawvideo','-pixel_format','rgba','-video_size',`${W}x${H}`,'-framerate',String(FPS),'-i','pipe:0','-i',path.join(OUT,'mix-v7.wav'),'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-af','loudnorm=I=-16:TP=-1.5:LRA=9','-c:a','aac','-b:a','256k','-ar','48000','-movflags','+faststart','-t',String(DURATION),target],{stdio:['pipe','ignore','inherit'],windowsHide:true});
let error;ff.on('error',e=>error=e);ff.stdin.on('error',e=>error=e);const closed=once(ff,'close');
for(let f=0;f<DURATION*FPS;f++){if(error)throw error;frame(f/FPS);if(!ff.stdin.write(canvas.data()))await once(ff.stdin,'drain');if(f%(FPS*2)===0)console.log(`V7 · 120fps: ${f/FPS}s / ${DURATION}s`)}
ff.stdin.end();const [code]=await closed;if(code)throw new Error(`FFmpeg failed: ${code}`);console.log(`Concluído: ${target}`);
