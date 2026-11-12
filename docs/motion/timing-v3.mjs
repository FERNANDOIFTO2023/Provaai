// One clock for visual actions and audio. Seconds are quantized to 60fps.
export const FPS=60;
export const frameTime=t=>Math.round(t*FPS)/FPS;
export const transitions=[
 {at:0,type:'none'}, {at:1.6,type:'none'},
 {at:4,type:'zoom',dur:.5}, {at:6.4,type:'focus',dur:.5},
 {at:9.6,type:'whip',dur:.5}, {at:12,type:'iris',dur:.6},
 {at:15,type:'up',dur:.55}, {at:18,type:'zoom',dur:.5},
 {at:20.8,type:'whip',dur:.55}, {at:23,type:'focus',dur:.45},
 {at:25,type:'zoom',dur:.55}
];
export const action={introClick:1.38,promptClick:2.42,selectAnswer:.96,approve:1.72,download:1.36,downloadDone:2.08};
export const promptText='Matemática. Frações. 7º ano.';
let cursor=.3;
export const typing=Array.from(promptText,(character,index)=>{cursor+=character===' '? .085:character==='.'?.115:[.035,.043,.055,.038][index%4];return {character,time:frameTime(cursor),index}});
export const typedCount=t=>typing.filter(e=>t>=e.time).length;
const ev=(id,time,type,details={})=>({id,time:frameTime(time),type,...details});
export const events=[
 ev('logo-arrival',.15,'bloom'),ev('logo-morph',1.06,'swoop',{duration:.5}),ev('intro-click',action.introClick,'click'),
 ...[0,1,2,3].map(i=>ev(`node-${i}`,1.6+.48+i*.12,'tick')),
 ...[0,.2,.43].map((d,i)=>ev(`word-${i}`,4+d+.23,'tap')),
 ev('word-selection',5.32,'select'),
 ...typing.filter((e,i)=>i%2===0&&e.character!==' ').map(e=>ev(`key-${e.index}`,6.4+e.time,'type')),
 ev('objective-chip',7.52,'tick'),ev('essay-chip',7.68,'tick'),ev('prompt-click',6.4+action.promptClick,'click'),
 ...[0,1,2].map(i=>ev(`profile-${i}`,9.6+.36+i*.16,'pop')),
 ev('profile-merge',11.1,'tick'),
 ...[0,1,2].map(i=>ev(`draft-${i}`,12+.57+i*.32,'tick')),
 ev('draft-ready',13.9,'chime'),ev('answer-selected',15+action.selectAnswer,'select'),
 ev('approve-click',15+action.approve,'click'),ev('approved',15+action.approve+.1,'chime'),
 ...[0,1,2].map(i=>ev(`file-${i}`,18+.42+i*.14,'paper',{duration:.28})),
 ev('download-click',18+action.download,'click'),ev('download-finish',18+action.downloadDone,'download'),
 ev('tagline-1',23.34,'tap'),ev('tagline-2',23.84,'tap'),ev('brand-ready',26.15,'chime'),
 ...transitions.filter(t=>t.dur).map((t,i)=>ev(`transition-${i}`,t.at+t.dur/2,t.type==='whip'?'whip':'swoop',{duration:t.dur,visualPeak:frameTime(t.at+t.dur/2)}))
].sort((a,b)=>a.time-b.time);
