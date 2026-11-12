// One-shot acting tied to UI changes. Coordinates are in the original 250px rig.
// No repeating curious/happy SVG loop is used by the V6 film.
import {action,visualFx as FX} from './timing-v6.mjs';
const base={x:0,y:0,rotation:0,sx:1,sy:1,eyeX:0,eyeY:0,blink:1,happy:0};
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
function track(keys,t){if(t<=keys[0][0])return {...base,...keys[0][1]};let prev={...base},at=keys[0][0];for(const [nextAt,delta] of keys){const next={...prev,...delta};if(t<=nextAt){const u=smooth((t-at)/Math.max(.001,nextAt-at));return Object.fromEntries(Object.keys(base).map(k=>[k,prev[k]+(next[k]-prev[k])*u]));}prev=next;at=nextAt;}return prev;}
const approve=action.approve,download=action.download,done=action.downloadDone;
const sequences={
 intro:[[0,{y:32,rotation:-16,sx:.86,sy:1.12}],[.27,{y:-9,rotation:5,sx:1.04,sy:.97}],[.58,{y:0,rotation:0,sx:1,sy:1}],[.8,{blink:.1}],[.92,{blink:1}],[1.14,{eyeX:13,eyeY:10,rotation:8}],[action.introClick,{y:5,sx:1.08,sy:.92}],[1.57,{y:0,sx:1,sy:1}]],
 network:[[0,{eyeX:9,eyeY:7}],[.46,{eyeX:-14,eyeY:-12,rotation:-8}],[.91,{eyeX:14,rotation:8}],[1.29,{eyeX:-14,eyeY:12,rotation:-6}],[1.67,{eyeX:14,rotation:6}],[FX.networkEcho+FX.echoTravel,{eyeX:0,eyeY:0,y:6,sx:1.08,sy:.92}],[2.28,{y:-3,sx:.98,sy:1.02}],[2.5,{y:0,sx:1,sy:1}]],
 people:[[0,{}],[1.2,{y:14,eyeX:-13,eyeY:-16,rotation:-8}],[1.65,{y:0}],[FX.profileLaunch+FX.profileTravel,{eyeX:-12,rotation:-7,sx:1.06,sy:.94}],[1.91,{eyeX:0,rotation:0,sx:.97,sy:1.03}],[2.03,{eyeX:12,rotation:7,sx:1.05,sy:.95}],[2.24,{eyeX:0,eyeY:-8,rotation:0,sx:1,sy:1,happy:1}]],
 drafting:[[0,{x:-28,y:12,rotation:-10}],[.44,{x:0,y:0,rotation:9,eyeX:17,eyeY:-17}],[.77,{eyeY:-10,x:8}],[1.04,{eyeY:0,rotation:13}],[1.39,{eyeY:14,x:17,rotation:17,sx:1.02,sy:.98}],[1.68,{eyeY:12}],[1.9,{x:11,y:6,rotation:8,blink:.12}],[2.06,{x:6,y:0,rotation:3,blink:1,happy:1}],[2.37,{x:0,rotation:0,happy:0}],[2.78,{eyeX:8,eyeY:5}]],
 review:[[0,{eyeX:-17,eyeY:-13,rotation:-12}],[.65,{x:-13,rotation:-15,eyeY:-3}],[action.selectAnswer,{eyeY:10,y:3}],[1.14,{y:0,eyeY:14}],[approve-.18,{x:-18,y:10,sx:1.08,sy:.92,rotation:-10}],[approve,{x:-18,y:15,sx:1.13,sy:.85}],[approve+.14,{x:-8,y:-38,sx:.94,sy:1.09,rotation:9,happy:1,eyeX:0,eyeY:0}],[approve+.33,{x:4,y:-47,rotation:12,sx:1,sy:1}],[approve+.59,{x:0,y:8,rotation:-4,sx:1.12,sy:.88}],[approve+.76,{y:-3,rotation:2,sx:.98,sy:1.02}],[approve+.98,{y:0,rotation:0,sx:1,sy:1}]],
 files:[[0,{eyeX:-16,eyeY:-18,rotation:-7}],[.7,{eyeX:-8,eyeY:-21,rotation:5}],[download-.12,{eyeX:-17,eyeY:-8,rotation:-9}],[download+.3,{x:-14,y:6,eyeY:6,rotation:-16}],[done-.13,{x:-26,y:19,eyeX:-20,eyeY:17,rotation:-22,sx:1.04,sy:.96}],[done,{x:-26,y:23,blink:.15,sx:1.11,sy:.89}],[done+.17,{x:6,y:-9,eyeX:-9,eyeY:0,blink:1,rotation:8,sx:.98,sy:1.03,happy:1}],[done+.39,{x:0,y:0,rotation:0,sx:1,sy:1}],[2.8,{eyeX:0,happy:0}]],
 outro:[[0,{x:-100,y:16,rotation:-22,sx:1.08,sy:.94}],[.48,{x:12,y:-4,rotation:7,sx:.97,sy:1.03}],[.72,{x:0,y:0,rotation:0,sx:1,sy:1}],[.88,{eyeY:0}],[1.08,{eyeY:18,rotation:9,y:6}],[1.15,{y:11,sx:1.05,sy:.95,happy:.5}],[1.42,{y:-3,rotation:-3,sx:.99,sy:1.01,happy:1}],[1.7,{y:0,rotation:0,sx:1,sy:1,eyeY:0}],[2.28,{happy:0}],[2.43,{blink:.1}],[2.57,{blink:1}],[3.3,{}]]
};
export function bloubPose(scene,t){if(!sequences[scene])throw new Error(`Unknown acting scene ${scene}`);return track(sequences[scene],t);}
export const choreography=sequences;
