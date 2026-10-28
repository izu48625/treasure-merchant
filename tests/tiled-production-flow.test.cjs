'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Tiled=require('../maps/indoor/tiled-runtime.js');
const Mall=require('../exploration-layout.js');
const MallV3=require('../exploration-layout-v3.js');
const MallV4=require('../exploration-layout-v4.js');
const Combat=require('../combat-rules.js');
const Equipment=require('../equipment-pilot.js');
const MapItem=require('../exploration-map-item.js');
const ITEMS=[
 {id:'ITM-00001',name:'古代の剣',rarity:'EX',category:'武具',group:'歴史・武具',base:400000,image:'data:mock'},
 {id:'ITM-00002',name:'家電製品',rarity:'N',category:'電化',group:'現代・生活',base:200,image:'data:mock'},
 {id:'ITM-00003',name:'宝石の首飾り',rarity:'UR',category:'宝石',group:'宝石・宝飾',base:10000,image:'data:mock'},
 ...Equipment.items,MapItem.item
];
const itemMap=new Map(ITEMS.map(it=>[it.id,it]));
async function harness(){
 const map=JSON.parse(read('maps/indoor/indoor.tmj'));
 const tiles=JSON.parse(read('maps/indoor/tiles/warehouse.tsj'));
 const source=read('exploration-layout-v5.js');
 const V5Window={TreasureTiledMap:Tiled};
 class Image{
  constructor(){this.complete=true;this.naturalWidth=192}
  set src(url){this.url=url;queueMicrotask(()=>this.onload?.())}
 }
 new Function('window','fetch','Image',source)(
  V5Window,async p=>({ok:true,json:async()=>p.startsWith('maps/indoor/indoor.tmj')?map:tiles}),Image);
 const layout=await V5Window.TreasureIndoorLayoutV5.load();
 const state={inv:[],exploreArea:'mall',exploreEquip:{},exploreRun:null,bonusTickets:0};
 const dom=new Map();
 const document={body:{classList:{add(){},remove(){},toggle(){}},addEventListener(){}},
  getElementById:id=>dom.get(id)||null,querySelector:()=>null,addEventListener(){},hidden:false};
 const window={TreasureMallLayout:Mall,TreasureMallLayoutV3:MallV3,TreasureFacilityLayoutV4:MallV4,
  TreasureIndoorLayoutV5:{load:()=>Promise.resolve(layout)},TreasureCombatRules:Combat,
  TreasureEquipmentPilot:Equipment,TreasureMapItem:MapItem,
  crypto:{randomUUID:()=>String(Math.random()).slice(2)},confirm:()=>true,addEventListener(){}};
 let sourceGame=read('exploration.js');
 const end=sourceGame.lastIndexOf('})();');
 assert.ok(end>0);
 sourceGame=sourceGame.slice(0,end)+
  'window.__v5test={startRun,runRef:()=>run,resetRun:()=>{run=null},snapshotRun,restoreRunIfNeeded,validCheckpoint,openContainer,takeContainerItem,closeContainer,bank,lose,exitPoint};'+sourceGame.slice(end);
 let nextUid=1000,received=[],renders=0;
 function receive(it,q){received.push({id:it.id,q});state.inv.push({id:it.id,q,uid:nextUid++,locked:false})}
 const deps=[
  window,document,state,ITEMS,itemMap,id=>itemMap.get(id),()=>1,
  ['N','C','R','SR','SSR','UR','EX'],['普通','良','優','特'],true,false,
  ()=>{},fn=>fn(),()=>{renders++},Image,
  s=>String(s).replace(/[&<>"]/g,''),()=>{},receive,()=>{}
 ];
 new Function('window','document','state','ITEMS','ITEM_BY_ID','item','quality','RARITY',
  'QNAME','storageReady','actionPersisting','save','saveWithCommit','render','Image',
  'esc','cancelAnimationFrame','receive','markDelete',sourceGame)(...deps);
 await Promise.resolve();
 return {t:window.__v5test,layout,state,received,renderCount:()=>renders};
}
test('V5 full raid uses production containers and resumes exact sealed loot',async()=>{
 const {t,layout,state}=await harness();
 t.startRun();const run=t.runRef();
 assert.equal(run.mapVersion,5);
 assert.equal(run.duration,300);
 assert.equal(run.exitId,layout.fixedExit.id);
 assert.equal(run.containers.length,11);
 assert.equal(run.pendingGuardPosts.length<=6,true);
 assert.ok(t.validCheckpoint(t.snapshotRun()),'new V5 checkpoint should validate');
 const cache=run.containers.find(c=>c.contents.length);
 run.enemies=[];run.player.x=cache.x;run.player.y=cache.y;
 const first=JSON.stringify(cache.contents[0]);
 t.openContainer();assert.equal(run.paused,true);
 assert.equal(run.lootOpenId,cache.id);
 t.takeContainerItem({dataset:{container:cache.id,i:'0'}});
 assert.equal(JSON.stringify(run.loot[0]).includes(JSON.parse(first).id),true);
 assert.ok(t.validCheckpoint(t.snapshotRun()),'checkpoint after loot must validate');
 const saved=t.snapshotRun();
 state.exploreRun=saved;t.resetRun();t.restoreRunIfNeeded();
 const restored=t.runRef();
 assert.equal(restored.mapVersion,5);
 assert.equal(restored.paused,true);
 assert.equal(restored.loot.length,1);
 assert.equal(restored.containers.find(x=>x.id===cache.id).contents.length,cache.contents.length);
 assert.equal(restored.loot[0].id,JSON.parse(first).id);
});
test('V5 successful extraction commits retrieved item to merchant inventory once',async()=>{
 const {t,layout,state,received}=await harness();
 t.startRun();const run=t.runRef(),cache=run.containers[0];
 run.enemies=[];run.player.x=cache.x;run.player.y=cache.y;
 t.openContainer();
 t.takeContainerItem({dataset:{container:cache.id,i:'0'}});
 t.closeContainer();
 run.player.x=layout.fixedExit.x;run.player.y=layout.fixedExit.y;
 t.bank();
 assert.equal(run.status,'escaped');
 assert.equal(received.length,1);
 assert.equal(state.inv.length,1);
 assert.equal(state.exploreRun,null);
 assert.equal(state.exploreLastResult.status,'escaped');
 assert.equal(state.exploreLastResult.saved.length,1);
});
test('V5 death protects only safety pouch loot',async()=>{
 const {t,state,received}=await harness();
 t.startRun();const run=t.runRef();
 run.loot=[{id:'ITM-00002',q:1,tid:1},{id:'ITM-00003',q:2,tid:2}];
 run.safeIds=[2];run.lootSerial=3;
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 t.lose('test loss');
 assert.equal(received.length,1);
 assert.equal(received[0].id,'ITM-00003');
 assert.equal(state.exploreLastResult.status,'lost');
 assert.equal(state.exploreLastResult.saved.length,1);
 assert.equal(state.exploreRun,null);
});
