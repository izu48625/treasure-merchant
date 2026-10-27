'use strict';
// R5.13 maze checks: node --test tests/exploration-maze.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const V2=require('../exploration-layout.js');
const Maze=require('../exploration-layout-v3.js');
const Pilot=require('../equipment-pilot.js');
const Combat=require('../combat-rules.js');
const ITEMS=[
 {id:'ITM-00001',name:'エクスカリバー',rarity:'EX',category:'神話・武器',group:'神話・伝説',base:3000000,image:'data:mock'},
 {id:'ITM-00002',name:'ダイヤ',rarity:'UR',category:'宝石',group:'宝石・宝飾',base:500,image:'data:mock'},
 ...Pilot.items
];
const ITEM_BY_ID=new Map(ITEMS.map(it=>[it.id,it]));
function harness(v3=true){
 const state={inv:[],exploreArea:'mall',exploreEquip:{weapon:0,weapon2:0,head:0,body:0,legs:0,accessory:0,tool:0},exploreRun:null};
 const doc={body:{classList:{add(){},remove(){},toggle(){}},addEventListener(){}},addEventListener(){},getElementById(){return null},hidden:false};
 const win={TreasureMallLayout:V2,TreasureMallLayoutV3:v3?Maze:undefined,TreasureEquipmentPilot:Pilot,TreasureCombatRules:Combat,
  addEventListener(){},confirm(){return true},crypto:{randomUUID(){return 'r513-test-raid'}}};
 const original=fs.readFileSync(path.join(__dirname,'../exploration.js'),'utf8');
 const at=original.lastIndexOf('})();');assert.ok(at>0);
 const script=original.slice(0,at)+
  'window.__test={startRun,snapshotRun,validCheckpoint,restoreRunIfNeeded,openContainer,closeContainer,takeContainerItem,pausePanel,tick,raidElapsed,runRef:()=>run,setRun:v=>run=v,world:WORLD};'+
  original.slice(at);
 new Function('window','document','state','ITEMS','ITEM_BY_ID','item','quality','RARITY','QNAME',
  'storageReady','actionPersisting','save','saveWithCommit','render','Image','esc','cancelAnimationFrame',script)(
  win,doc,state,ITEMS,ITEM_BY_ID,id=>ITEM_BY_ID.get(id),()=>1,['N','C','R','SR','SSR','UR','EX'],['低','中','高','最高'],
  true,false,()=>{},callback=>callback(),()=>{},function(){this.complete=true;this.naturalWidth=0;this.src=''},value=>String(value),()=>{});
 return {t:win.__test,state};
}
test('48 connected zones, 144 candidate nodes and 80 active containers',()=>{
 assert.equal(Maze.w,3600);assert.equal(Maze.h,2600);
 assert.equal(Maze.rooms.length,48);assert.equal(Maze.candidates.length,144);
 assert.equal(Maze.rollContainers().length,80);
 assert.equal(Maze.maxDepth>=20,true,'return route requires many doors');
 const counts={};for(const r of Maze.rollContainers())counts[r.kind]=(counts[r.kind]||0)+1;
 for(const [k,spec] of Object.entries(Maze.types))assert.equal(counts[k],spec.count);
});
test('maze room graph connected and exits reachable',()=>{
 const seen=new Set([Maze.roomAt(Maze.start)]),queue=[...seen];
 for(let i=0;i<queue.length;i++)for(const n of Maze.graph[queue[i]])if(!seen.has(n)){seen.add(n);queue.push(n)}
 assert.equal(seen.size,48);
 assert.equal(Maze.roomAt(Maze.start),Maze.roomAt(Maze.exit));
});
test('all 144 candidate sites physically reachable with player collision radius',()=>{
 const step=20,W=Math.ceil(Maze.w/step),H=Math.ceil(Maze.h/step),rad=12;
 const walk=(ix,iy)=>{
  const x=ix*step+10,y=iy*step+10;
  return x>=rad&&y>=rad&&x<=Maze.w-rad&&y<=Maze.h-rad&&
   !Maze.walls.some(b=>x+rad>b.x&&x-rad<b.x+b.w&&y+rad>b.y&&y-rad<b.y+b.h);
 };
 const sx=Math.floor(Maze.start.x/step),sy=Math.floor(Maze.start.y/step);
 const found=new Uint8Array(W*H),queue=[[sx,sy]];found[sy*W+sx]=1;
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i];
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const u=x+dx,v=y+dy;
   if(u<0||v<0||u>=W||v>=H||found[v*W+u]||!walk(u,v))continue;
   found[v*W+u]=1;queue.push([u,v]);
  }
 }
 for(const c of Maze.candidates)assert.ok(found[Math.floor(c.y/step)*W+Math.floor(c.x/step)],'unreachable '+c.id);
});
test('mall art can render on 360px field with no missing Canvas methods',()=>{
 let n=0;
 const ctx={fillRect(){n++},strokeRect(){n++},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){n++}};
 const at=Maze.rooms[20];
 Maze.drawScene(ctx,at.x,at.y,360,416);
 assert.ok(n>6,'room artwork visible');
});
test('version 3 start seals container contents and saves visited region',()=>{
 const {t}=harness();t.startRun();
 const r=t.runRef(),c=t.snapshotRun();
 assert.equal(r.mapVersion,3);assert.equal(r.containers.length,80);assert.equal(t.world.w,3600);
 assert.ok(r.containers.every(v=>v.contents.length>0&&v.contents.length<=3));
 assert.equal(c.visitedRooms.length,1);assert.ok(t.validCheckpoint(c));
});
test('loot selection freezes game, commits one item, keeps leftovers on reload',()=>{
 const {t,state}=harness();t.startRun();
 const r=t.runRef(),c=r.containers.find(v=>v.contents.length>1);
 r.player.x=c.x;r.player.y=c.y;r.enemies=[];
 t.openContainer();assert.equal(r.paused,true);assert.equal(r.lootOpenId,c.id);
 const before=c.contents.length;
 t.takeContainerItem({dataset:{container:c.id,i:'0'}});
 assert.equal(c.contents.length,before-1);assert.equal(r.loot.length,1);
 state.exploreRun=t.snapshotRun();assert.ok(t.validCheckpoint(state.exploreRun));
 t.setRun(null);t.restoreRunIfNeeded();
 assert.equal(t.runRef().mapVersion,3);assert.equal(t.runRef().paused,true);
 assert.deepEqual(t.runRef().containers.find(v=>v.id===c.id).contents,c.contents);
});
test('untimed preview survives beyond old 4-minute limit',()=>{
 const {t}=harness();t.startRun();
 t.runRef().start=Date.now()-500000;t.runRef().enemies=[];
 t.tick(.016);
 assert.equal(t.runRef().status,'playing');
 assert.ok(t.raidElapsed()>=500);
});
test('visited map shows only explored zones and exit',()=>{
 const {t}=harness();t.startRun();
 t.runRef().paused=true;t.runRef().pausedAt=Date.now();t.runRef().showMap=true;
 const view=t.pausePanel();
 assert.match(view,/出口の方角/);assert.match(view,/脱出口/);assert.match(view,/一時停止メニューへ戻る/);
});
test('legacy v2 mall and v1 factory remain compatible',()=>{
 const {t}=harness(false);t.startRun();
 assert.equal(t.runRef().mapVersion,2);assert.equal(t.runRef().containers.length,45);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 const v1=harness();v1.state.exploreArea='factory';v1.t.startRun();
 assert.equal(v1.t.runRef().mapVersion,1);assert.equal(v1.t.runRef().chests.length,12);
 assert.ok(v1.t.validCheckpoint(v1.t.snapshotRun()));
});
