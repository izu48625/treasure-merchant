'use strict';
// R5.17: authored facility map, collision + loot + save compatibility.
// Run: node --test tests/exploration-facility.test.cjs
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const V2=require('../exploration-layout.js');
const V3=require('../exploration-layout-v3.js');
const V4=require('../exploration-layout-v4.js');
const Pilot=require('../equipment-pilot.js'),Combat=require('../combat-rules.js');
const MapItem=require('../exploration-map-item.js');
const ITEMS=[
 {id:'ITM-00001',name:'エクスカリバー',rarity:'EX',category:'神話・武器',group:'神話・伝説',base:3000000,image:'data:mock'},
 {id:'ITM-00002',name:'ダイヤ',rarity:'UR',category:'宝石',group:'宝石・宝飾',base:500,image:'data:mock'},
 ...Pilot.items,MapItem.item
],ITEM_BY_ID=new Map(ITEMS.map(x=>[x.id,x]));
function harness(allowV4=true){
 const state={inv:[],exploreArea:'mall',
  exploreEquip:{weapon:0,weapon2:0,head:0,body:0,legs:0,accessory:0,tool:0},exploreRun:null};
 const nodes=new Map();
 const document={body:{classList:{toggle(){},add(){},remove(){}},addEventListener(){}},
  addEventListener(){},getElementById(id){return nodes.get(id)||null},
  querySelector(){return null},hidden:false};
 const window={TreasureMallLayout:V2,TreasureMallLayoutV3:V3,
  TreasureFacilityLayoutV4:allowV4?V4:undefined,TreasureMapItem:MapItem,
  TreasureEquipmentPilot:Pilot,TreasureCombatRules:Combat,
  addEventListener(){},crypto:{randomUUID(){return 'r517-test'}},confirm(){return true}};
 const original=fs.readFileSync(path.join(__dirname,'../exploration.js'),'utf8'),end=original.lastIndexOf('})();');
 assert.ok(end>0);
 const code=original.slice(0,end)+
  'window.__facilityTest={startRun,snapshotRun,validCheckpoint,restoreRunIfNeeded,runRef:()=>run,setRun:v=>run=v,mapPanel,hasDetailedMap,solid,canSeeBetween,tick,draw,nearContainer,openContainer,takeContainerItem,exitPoint};'+original.slice(end);
 new Function('window','document','state','ITEMS','ITEM_BY_ID','item','quality','RARITY','QNAME',
 'storageReady','actionPersisting','save','saveWithCommit','render','Image','esc','cancelAnimationFrame',code)(
  window,document,state,ITEMS,ITEM_BY_ID,id=>ITEM_BY_ID.get(id),()=>1,
  ['N','C','R','SR','SSR','UR','EX'],['低','中','高','最高'],
  true,false,()=>{},f=>f(),()=>{},function(){this.complete=true;this.naturalWidth=0;this.src=''},String,()=>{});
 return {t:window.__facilityTest,state};
}
test('single irregular footprint, not 48 separate identical cells',()=>{
 assert.equal(V4.w,3600);assert.equal(V4.h,2600);
 assert.ok(V4.rooms.length>=10&&V4.rooms.length<=18);
 assert.equal(new Set(V4.rooms.map(r=>r.w+'x'+r.h)).size>8,true);
 assert.ok(V4.walls.length>30);
 assert.equal(V4.candidates.length,144);
 assert.equal(V4.fixtures.length,144);
 assert.equal(V4.rollContainers().length,80);
});
test('fixed western exit is walkable and historical extraction gates remain valid',()=>{
 assert.ok(V4.exitCandidates.length>=12);
 for(const e of V4.exitCandidates){
  assert.ok(Math.hypot(e.x-V4.start.x,e.y-V4.start.y)>500);
  assert.ok(!V4.solid(e.x,e.y,16),'exit blocked: '+e.id);
  assert.equal(V4.exitById(e.id)?.id,e.id);
 }
 assert.equal(V4.pickExit(()=>0).id,'gate-08');
 assert.equal(V4.pickExit(()=>.999999).id,'gate-08');
 assert.deepEqual(V4.pickExit(),V4.fixedExit);
 assert.equal(V4.fixedExit.x,400);assert.equal(V4.fixedExit.y,1550);
});
test('all active loot candidates remain next to collision-free walking cells',()=>{
 const w=V4.gridWidth,walk=V4.walkCells,step=40;
 for(const c of V4.candidates){
  let reachable=false;
  for(let y=Math.floor((c.y-78)/step);y<=Math.floor((c.y+78)/step);y++)
   for(let x=Math.floor((c.x-78)/step);x<=Math.floor((c.x+78)/step);x++){
    if(x<0||y<0||x>=w||y>=V4.gridHeight||!walk[y*w+x])continue;
    if(Math.hypot(c.x-(x*step+20),c.y-(y*step+20))<78)reachable=true;
   }
  assert.ok(reachable,'loot inaccessible: '+c.id);
 }
});
test('furniture is a real physical obstacle and breaks line of sight',()=>{
 const prop=V4.fixtures.find(p=>p.kind==='shelf');
 const cx=prop.x+prop.w/2,cy=prop.y+prop.h/2;
 assert.ok(V4.solid(cx,cy,12));
 assert.equal(V4.lineClear({x:cx-75,y:cy},{x:cx+75,y:cy}),false);
});
test('all physical route cells and exits connect to start via flood fill',()=>{
 const W=V4.gridWidth,H=V4.gridHeight,open=V4.walkCells;
 const first=Math.floor(V4.start.y/40)*W+Math.floor(V4.start.x/40);
 const checked=new Uint8Array(open.length),queue=[first];checked[first]=1;
 for(let i=0;i<queue.length;i++){
  const cell=queue[i],x=cell%W,y=Math.floor(cell/W);
  for(const n of [x?cell-1:-1,x<W-1?cell+1:-1,y?cell-W:-1,y<H-1?cell+W:-1]){
   if(n<0||!open[n]||checked[n])continue;checked[n]=1;queue.push(n);
  }
 }
 for(const e of V4.exitCandidates){
  const cell=Math.floor(e.y/40)*W+Math.floor(e.x/40);
  assert.ok(checked[cell],'exit unreachable: '+e.id);
 }
 assert.ok(queue.length>2500,'world unexpectedly too small');
});
test('all 18 exits can be reached and escaped from in both directions',()=>{
 function travel(from,to){
  const pos={x:from.x,y:from.y};
  for(let step=0;step<4600;step++){
   if(Math.hypot(pos.x-to.x,pos.y-to.y)<34)return true;
   const waypoint=V4.nextWaypoint(pos,to);
   const d=Math.hypot(waypoint.x-pos.x,waypoint.y-pos.y);
   if(d<.01)break;
   const dx=4*(waypoint.x-pos.x)/d,dy=4*(waypoint.y-pos.y)/d;
   if(!V4.solid(pos.x+dx,pos.y,12))pos.x+=dx;
   if(!V4.solid(pos.x,pos.y+dy,12))pos.y+=dy;
  }
  return false;
 }
 for(const exit of V4.exitCandidates){
  assert.ok(travel(V4.start,exit),'cannot reach exit '+exit.id);
  assert.ok(travel(exit,V4.start),'cannot return from '+exit.id);
 }
});
test('v4 run, sealed loot and checkpoint survive reload without rerolls',()=>{
 const {t,state}=harness();t.startRun();
 const run=t.runRef();
 assert.equal(run.mapVersion,4);assert.equal(run.containers.length,80);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 const c=run.containers[0],prior=c.contents.map(item=>({...item}));
 run.enemies=[];run.player.x=c.x+61;run.player.y=c.y;
 assert.ok(t.nearContainer());
 t.openContainer();
 assert.ok(run.paused);
 t.takeContainerItem({dataset:{container:c.id,i:'0'}});
 assert.deepEqual(c.contents,prior.slice(1));
 state.exploreRun=t.snapshotRun();
 const exit=run.exitId;
 t.setRun(null);t.restoreRunIfNeeded();
 assert.equal(t.runRef().mapVersion,4);
 assert.equal(t.runRef().exitId,exit);
 assert.deepEqual(t.runRef().containers.find(v=>v.id===c.id).contents,prior.slice(1));
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('map with no floorplan stays coarse; equipped map reveals entire building',()=>{
 const {t,state}=harness();t.startRun();
 const coarse=t.mapPanel();
 assert.match(coarse,/出口の方角/);
 assert.doesNotMatch(coarse,/viewBox="0 0 3600 2600"/);
 state.inv.push({uid:991,id:MapItem.id,q:1,locked:false});
 state.exploreEquip.tool=991;
 const detailed=t.mapPanel();
 assert.match(detailed,/viewBox="0 0 3600 2600"/);
 assert.match(detailed,/踏査/);
 assert.doesNotMatch(detailed,/48区画/);
 assert.match(detailed,/旧管理棟|施設案内図/);
});
test('old R5.16 checkpoint stays on old V3 map when V4 is installed',()=>{
 const old=harness(false);old.t.startRun();
 assert.equal(old.t.runRef().mapVersion,3);
 const c=old.t.snapshotRun();
 const current=harness(true);current.state.exploreRun=c;
 current.t.restoreRunIfNeeded();
 assert.equal(current.t.runRef().mapVersion,3);
 assert.equal(current.t.runRef().exitId,c.exitId);
 assert.ok(current.t.validCheckpoint(current.t.snapshotRun()));
});
test('old V2 and V1 runs still work without V4 conversion',()=>{
 const legacy=harness(false);legacy.state.exploreArea='factory';legacy.t.startRun();
 assert.equal(legacy.t.runRef().mapVersion,1);
 assert.ok(legacy.t.validCheckpoint(legacy.t.snapshotRun()));
 const v2=V2.rollContainers().map(c=>({...c,contents:[{id:'ITM-00001',q:1}]}));
 assert.ok(V2.validContainers(v2,()=>true));
});
test('facility draw clips to 360x416 view and does not require images',()=>{
 const counts={rect:0};
 const ctx={fillRect(){counts.rect++},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},
  stroke(){},fillText(){},arc(){}};
 V4.drawScene(ctx,V4.start.x-120,V4.start.y-120,360,416);
 assert.ok(counts.rect>5);
});
