'use strict';
// R5.12 mall regression test: node tests/exploration-mall.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Layout=require('../exploration-layout.js');
const Equipment=require('../equipment-pilot.js');
const Combat=require('../combat-rules.js');
const test=require('node:test');
const base=[
 {id:'ITM-00001',name:'エクスカリバー',rarity:'EX',category:'神話・武器',group:'神話・伝説',base:3600000,image:'data:mock'},
 {id:'ITM-00002',name:'ダイヤ',rarity:'UR',category:'宝石',group:'宝石・宝飾',base:500,image:'data:mock'}
];
const ITEMS=[...base,...Equipment.items],ITEM_BY_ID=new Map(ITEMS.map(it=>[it.id,it]));
const RARITY=['N','C','R','SR','SSR','UR','EX'];
const QNAME=['低','中','高','最高'];
function harness(){
 const state={inv:[],exploreArea:'mall',
  exploreEquip:{weapon:0,weapon2:0,head:0,body:0,legs:0,accessory:0,tool:0},exploreRun:null};
 const document={body:{classList:{remove(){},add(){},toggle(){}},addEventListener(){}},
  addEventListener(){},getElementById(){return null},hidden:false};
 const window={TreasureMallLayout:Layout,TreasureEquipmentPilot:Equipment,
  TreasureCombatRules:Combat,addEventListener(){},crypto:{randomUUID(){return 'test-mall-raid'}},confirm(){return true}};
 const code=fs.readFileSync(path.join(__dirname,'../exploration.js'),'utf8');
 const final=code.lastIndexOf('})();');
 assert.ok(final>0);
 const patched=code.slice(0,final)+
  'window.__mallTest={startRun,snapshotRun,validCheckpoint,restoreRunIfNeeded,openContainer,closeContainer,takeContainerItem,remaining,runRef:()=>run,setRun:v=>run=v,world:WORLD,wallCount:()=>WALLS.length};'+
  code.slice(final);
 new Function('window','document','state','ITEMS','ITEM_BY_ID','item','quality','RARITY','QNAME',
  'storageReady','actionPersisting','save','saveWithCommit','render','Image','esc','cancelAnimationFrame',patched)(
   window,document,state,ITEMS,ITEM_BY_ID,id=>ITEM_BY_ID.get(id),()=>1,RARITY,QNAME,
   true,false,()=>{},fn=>fn(),()=>{},function(){this.complete=true;this.naturalWidth=0;this.src='';},
   s=>String(s),()=>{}
  );
 return {state,t:window.__mallTest};
}
test('layout has 16 rooms, 60 sites and 45 active containers',()=>{
 assert.equal(Layout.rooms.length,16);
 assert.equal(Layout.candidates.length,60);
 assert.equal(Layout.rollContainers().length,45);
 assert.equal(Layout.w,2000);assert.equal(Layout.h,1600);
});
test('exact container type distribution',()=>{
 const counts={};for(const c of Layout.rollContainers())counts[c.kind]=(counts[c.kind]||0)+1;
 for(const [kind,spec] of Object.entries(Layout.types))assert.equal(counts[kind],spec.count);
});
test('all containers are unique and valid',()=>{
 const containers=Layout.rollContainers();
 assert.ok(Layout.validContainers(containers,()=>true));
 const tampered=containers.map(x=>({...x}));tampered[1].id=tampered[0].id;
 assert.equal(Layout.validContainers(tampered,()=>true),false);
});
test('new sortie creates pre-sealed contents before checkpoint',()=>{
 const {t}=harness();t.startRun();
 const run=t.runRef();
 assert.equal(run.mapVersion,2);
 assert.equal(run.containers.length,45);
 assert.equal(run.chests.length,0);
 assert.equal(t.world.w,2000);assert.equal(t.wallCount(),80);
 assert.ok(run.containers.every(c=>c.contents.length>=1&&c.contents.length<=3));
 assert.ok(run.containers.every(c=>c.contents.every(v=>ITEM_BY_ID.has(v.id))));
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('looting pauses combat timer and only removes the selected item',()=>{
 const {t}=harness();t.startRun();
 const run=t.runRef(),c=run.containers.find(c=>c.contents.length>1);
 run.player.x=c.x;run.player.y=c.y;run.enemies=[];
 const before=t.remaining(),old=c.contents.map(x=>({...x}));
 t.openContainer();assert.ok(run.paused);assert.equal(run.lootOpenId,c.id);
 assert.ok(Math.abs(t.remaining()-before)<.2);
 t.takeContainerItem({dataset:{container:c.id,i:'0'}});
 assert.equal(run.loot.length,1);
 assert.equal(c.contents.length,old.length-1);
 assert.deepEqual(c.contents,old.slice(1));
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 t.closeContainer();assert.equal(run.paused,false);
});
test('reloaded raid restores remaining goods without rerolls',()=>{
 const {t,state}=harness();t.startRun();
 const r=t.runRef(),c=r.containers.find(c=>c.contents.length>1);
 r.player.x=c.x;r.player.y=c.y;r.enemies=[];
 t.openContainer();t.takeContainerItem({dataset:{container:c.id,i:'0'}});
 const expected=c.contents.map(x=>({...x}));
 state.exploreRun=t.snapshotRun();assert.ok(t.validCheckpoint(state.exploreRun));
 t.setRun(null);t.restoreRunIfNeeded();
 assert.ok(t.runRef().paused);
 assert.deepEqual(t.runRef().containers.find(x=>x.id===c.id).contents,expected);
 assert.equal(t.runRef().loot.length,1);
});
test('all 60 possible locations are reachable through room doorways',()=>{
 const step=10,W=Math.ceil(Layout.w/step),H=Math.ceil(Layout.h/step),r=12;
 const valid=(ix,iy)=>{
  const x=ix*step+5,y=iy*step+5;
  return x>=r&&y>=r&&x<=Layout.w-r&&y<=Layout.h-r&&
   !Layout.walls.some(w=>x+r>w.x&&x-r<w.x+w.w&&y+r>w.y&&y-r<w.y+w.h);
 };
 const visited=new Uint8Array(W*H),sx=Math.floor(Layout.start.x/step),sy=Math.floor(Layout.start.y/step);
 const queue=[[sx,sy]];visited[sy*W+sx]=1;
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i];
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const u=x+dx,v=y+dy;
   if(u<0||u>=W||v<0||v>=H||visited[v*W+u]||!valid(u,v))continue;
   visited[v*W+u]=1;queue.push([u,v]);
  }
 }
 for(const c of Layout.candidates){
  assert.ok(visited[Math.floor(c.y/step)*W+Math.floor(c.x/step)],'unreachable: '+c.id);
 }
});
test('legacy area and old checkpoint remain valid',()=>{
 const {t,state}=harness();state.exploreArea='factory';t.startRun();
 assert.equal(t.runRef().mapVersion,1);
 assert.equal(t.runRef().chests.length,12);
 assert.equal(t.world.w,920);assert.equal(t.world.h,720);assert.equal(t.wallCount(),11);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
