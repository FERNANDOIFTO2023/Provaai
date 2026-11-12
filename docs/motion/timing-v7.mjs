export const FPS=120,DURATION=30;
export const frameTime=t=>Math.round(t*FPS)/FPS;
export const stations=[
 {at:0,x:0,y:0,name:'Conexões'},
 {at:4,x:2250,y:-180,name:'Cada aluno'},
 {at:7,x:4400,y:100,name:'Sua ideia'},
 {at:10.4,x:6500,y:-240,name:'Perfis'},
 {at:13.4,x:8500,y:1350,name:'Rascunhos'},
 {at:16.8,x:10600,y:1350,name:'Revisão'},
 {at:20.2,x:12650,y:-120,name:'Arquivos'},
 {at:23.6,x:14850,y:0,name:'Produto'},
 {at:26.6,x:17100,y:0,name:'Provaai'},
];
export const action={connect:.9,select:1.15,shine:1.8,create:2.35,merge:2.1,draftDone:2.5,answer:1.05,approve:2.05,download:1.65,downloadDone:2.3,brand:1.05};
const ev=(id,time,type,extra={})=>({id,time:frameTime(time),type,...extra});
export const events=[
 ev('bloub-entry',.22,'bloom'),ev('create-start',.9,'click'),
 ...[0,1,2,3].map(i=>ev(`connection-${i}`,1.55+i*.18,'plink',{pan:i%2?.55:-.55})),
 ev('network-return',3.12,'glint'),
 ev('cada',4.55,'tap'),ev('aluno',4.8,'tap'),ev('importa',5.03,'tap'),
 ev('select-aluno',4+action.select,'select'),ev('selection-scan',4+action.shine,'glint'),
 ...[0,1,2,3,4,5,6,7,8,9].map(i=>ev(`type-${i}`,7.6+i*.105,'type',{pan:-.25+i*.035})),
 ev('create-click',7+action.create,'click'),ev('create-launch',9.48,'launch'),
 ...[0,1,2].map(i=>ev(`profile-${i}`,10.95+i*.12,'pop',{pan:(i-1)*.45})),
 ev('profile-merge',10.4+action.merge,'glint'),
 ...[0,1,2].map(i=>ev(`draft-${i}`,14.15+i*.38,'paper',{pan:(i-1)*.35,duration:.2})),
 ev('draft-ready',13.4+action.draftDone,'chime'),
 ev('answer',16.8+action.answer,'select'),ev('approve-click',16.8+action.approve,'click'),ev('approved',19,'chime'),
 ...[0,1,2].map(i=>ev(`file-${i}`,20.8+i*.13,'paper',{pan:(i-1)*.55,duration:.25})),
 ev('download-click',20.2+action.download,'click'),ev('download-finish',20.2+action.downloadDone,'download'),
 ev('product-land',24.25,'bloom'),ev('brand-ready',26.6+action.brand,'chime'),
 ...stations.slice(1).map((s,i)=>ev(`travel-${i}`,s.at-.12,i===3||i===5?'whip':'swoop',{duration:1.05,visualPeak:frameTime(s.at-.12),pan:i%2?-.6:.6}))
].sort((a,b)=>a.time-b.time);
