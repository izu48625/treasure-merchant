'use strict';
// R5.13 labyrinth regression. Run: node --test tests/exploration-labyrinth.test.cjs
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const V2=require('../exploration-layout.js'),V3=require('../exploration-layout-v3.js');
const Pilot=require('../equipment-pilot.js'),Combat=require('../combat-rules.js');
const ITEMS=[{id:'ITM-00001',name:'エクスカリバー',rarity:'EX',group:'神話・伝説',category:'神話・武器',image:'data:mock',base:1000},
 {id:'ITM-00002',name:'ダイヤ',rarity:'UR',group:'宝石・宝飾',category:'宝石',image:'data:mock',base:100},...Pilot.items];
const ITEM_BY_ID=new Map(ITEMS.map(it=>[it.id,it]));
function harness(){
 const state={inv:[],exploreArea:'mall',exploreRun:null,exploreEquip:{
  weapon:0,weapon2:0,head:0,body:0,legs:0,accessory:0,tool:0}};
 const doc={body:{classList:{remove(){},add(){},toggle(){}},addEventListener(){}},
  addEventListener(){},getElementById(){return null},hidden:false};
 const win={TreasureMallLayout:V2,TreasureMallLayoutV3:V3,TreasureEquipmentPilot:Pilot,
  TreasureCombatRules:Combat,addEventListener(){},crypto:{randomUUID(){return 'lab-test'}},confirm(){return true}};
 const code=fs.readFileSync(path.join(__dirname,'../exploration.js'),'utf8'),end=code.lastIndexOf('})();');
 assert.ok(end>0);
 const source=code.slice(0,end)+
  'window.__lab={startRun,snapshotRun,restoreRunIfNeeded,validCheckpoint,raidElapsed,remaining,openContainer,closeContainer,takeContainerItem,pausePanel,togglePause,world:WORLD,runRef:()=>run,setRun:r=>run=r};'+
  code.slice(end);
 new Function('window','document','state','ITEMS','ITEM_BY_ID','item','quality','RARITY','QNAME',
  'storageReady','actionPersisting','save','saveWithCommit','render','Image','esc','cancelAnimationFrame',source)(
  win,doc,state,ITEMS,ITEM_BY_ID,id=>ITEM_BY_ID.get(id),()=>1,
  ['N','C','R','SR','SSR','UR','EX'],['低','中','高','最高'],
  true,false,()=>{},fn=>fn(),()=>{},function(){this.complete=true;this.naturalWidth=0;this.src=''},s=>String(s),()=>{}
 );
 return {t:win.__lab,state};
}
test('larger labyrinth has 48 chambers, 144 points, and exactly 80 active',()=>{
 assert.equal(V3.w,3600);assert.equal(V3.h,2600);
 assert.equal(V3.rooms.length,48);assert.equal(V3.candidates.length,144);
 const contents=V3.rollContainers();assert.equal(contents.length,80);
 assert.ok(V3.validContainers(contents,()=>true));
 assert.equal(new Set(contents.map(c=>c.id)).size,80);
});
test('all configured container types use the same repeated visual setting',()=>{
 const candidates=V3.candidates;
 assert.ok(candidates.every(x=>x.theme==='storage'));
 const amounts={};
 for(const c of V3.rollContainers())amounts[c.kind]=(amounts[c.kind]||0)+1;
 for(const [kind,t] of Object.entries(V3.types))assert.equal(amounts[kind],t.count);
});
test('door graph forms a connected path to the base',()=>{
 const graph=V3.graph,seen=new Set([40]),q=[40];
 for(let i=0;i<q.length;i++)for(const next of graph[q[i]])if(!seen.has(next)){seen.add(next);q.push(next)}
 assert.equal(seen.size,V3.rooms.length);
 assert.ok(V3.maxDepth>=15);
});
test('all 144 search locations are physically walkable from spawn',()=>{
 const step=20,W=Math.ceil(V3.w/step),H=Math.ceil(V3.h/step),radius=12;
 const blocks=new Uint8Array(W*H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const px=x*step+step/2,py=y*step+step/2;
  blocks[y*W+x]=Number(V3.walls.some(b=>px+radius>b.x&&px-radius<b.x+b.w&&
   py+radius>b.y&&py-radius<b.y+b.h));
 }
 const sx=Math.floor(V3.start.x/step),sy=Math.floor(V3.start.y/step),q=[[sx,sy]],seen=new Uint8Array(W*H);
 seen[sy*W+sx]=1;
 for(let i=0;i<q.length;i++){
  const [x,y]=q[i];
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=x+dx,ny=y+dy;
   if(nx<0||ny<0||nx>=W||ny>=H||seen[ny*W+nx]||blocks[ny*W+nx])continue;
   seen[ny*W+nx]=1;q.push([nx,ny]);
  }
 }
 for(const c of V3.candidates)assert.ok(seen[Math.floor(c.y/step)*W+Math.floor(c.x/step)],'sealed '+c.id);
});
test('R5.13 sortie has no timeout and seals all items',()=>{
 const {t}=harness();t.startRun();const r=t.runRef();
 assert.equal(r.mapVersion,3);assert.equal(r.containers.length,80);
 assert.equal(r.chests.length,0);assert.equal(t.world.w,3600);
 assert.equal(t.remaining(),240);assert.ok(t.raidElapsed()>=0);
 assert.ok(r.containers.every(c=>c.contents.length>0));
 assert.deepEqual(r.visitedRooms,[V3.roomAt(V3.start)]);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('looting fully pauses, only removes one item, and reopens with remainder',()=>{
 const {t}=harness();t.startRun();
 const r=t.runRef(),c=r.containers.find(x=>x.contents.length>1),old=c.contents.map(x=>({...x}));
 r.player.x=c.x;r.player.y=c.y;r.enemies=[];t.openContainer();
 assert.equal(r.paused,true);assert.equal(r.lootOpenId,c.id);
 const elapsedBefore=t.raidElapsed();
 t.takeContainerItem({dataset:{container:c.id,i:'0'}});
 assert.ok(Math.abs(elapsedBefore-t.raidElapsed())<.2);
 assert.deepEqual(c.contents,old.slice(1));assert.equal(r.loot.length,1);
 assert.ok(t.validCheckpoint(t.snapshotRun()));t.closeContainer();
 assert.equal(r.paused,false);
});
test('V3 checkpoint restores visited rooms, item selection and paused state',()=>{
 const {t,state}=harness();t.startRun();
 const r=t.runRef(),c=r.containers[0];r.player.x=c.x;r.player.y=c.y;r.enemies=[];
 r.visitedRooms.push(3);t.openContainer();t.takeContainerItem({dataset:{container:c.id,i:'0'}});
 state.exploreRun=t.snapshotRun();t.setRun(null);t.restoreRunIfNeeded();
 assert.ok(t.runRef().paused);assert.equal(t.runRef().mapVersion,3);
 assert.equal(t.runRef().loot.length,1);
 assert.ok(t.runRef().visitedRooms.includes(3));
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('player can open explored-only map without unpausing combat',()=>{
 const {t}=harness();t.startRun();t.togglePause();
 const r=t.runRef();assert.ok(t.pausePanel().includes('data-explore="map"'));
 r.showMap=true;
 const html=t.pausePanel();assert.ok(html.includes('data-explore="map-back"'));
 assert.ok(html.includes('踏査記録'));assert.ok(r.paused);
});
test('historic v2 checkpoint remains valid despite new world size',()=>{
 const {t}=harness();t.startRun();
 const snap=t.snapshotRun(),positions=V2.rollContainers().map(x=>({...x,contents:[{id:'ITM-00001',q:1}]}));
 const c={...snap,mapVersion:2,containers:positions,chests:[],loot:[],player:{x:V2.start.x,y:V2.start.y,hp:100}};
 delete c.visitedRooms;delete c.elapsedSeconds;
 assert.ok(t.validCheckpoint(c));
});
test('old factory still uses 920x720 and old chest checkpoints',()=>{
 const {t,state}=harness();state.exploreArea='factory';t.startRun();
 assert.equal(t.runRef().mapVersion,1);assert.equal(t.world.w,920);
 assert.equal(t.runRef().chests.length,12);assert.ok(t.validCheckpoint(t.snapshotRun()));
});
