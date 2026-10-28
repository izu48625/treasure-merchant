'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const V2=require('../exploration-layout.js'),V3=require('../exploration-layout-v3.js'),V4=require('../exploration-layout-v4.js');
const Pilot=require('../equipment-pilot.js'),Combat=require('../combat-rules.js'),MapItem=require('../exploration-map-item.js');
const engine=require('../maps/indoor/tiled-runtime.js');
const compiledText=fs.readFileSync(path.join(__dirname,'../maps/indoor/indoor-compiled-v5.js'),'utf8');
const adapterText=fs.readFileSync(path.join(__dirname,'../maps/indoor/exploration-layout-v5.js'),'utf8');
function getMap(){
 const win={TreasureTiledMap:engine};
 new Function('globalThis',compiledText)(win);
 const module={exports:{}};
 function Image(){this.complete=true;this.naturalWidth=128;this.src=''}
 new Function('window','Image','module',adapterText)(win,Image,module);
 assert.ok(win.TreasureFacilityLayoutV5);
 return win.TreasureFacilityLayoutV5;
}
const V5=getMap(),ITEMS=[
 {id:'ITM-00001',name:'エクスカリバー',rarity:'EX',category:'神話・武器',group:'神話・伝説',base:3000000,image:'data:mock'},
 {id:'ITM-00002',name:'ダイヤ',rarity:'UR',category:'宝石',group:'宝石・宝飾',base:500,image:'data:mock'},
 ...Pilot.items,MapItem.item
],ITEM_BY_ID=new Map(ITEMS.map(x=>[x.id,x]));
function harness(mapChoice='tiled'){
 const state={inv:[],exploreArea:'mall',exploreMapChoice:mapChoice,exploreEquip:{weapon:0,weapon2:0,head:0,body:0,legs:0,accessory:0,tool:0},exploreRun:null};
 const nodes=new Map(),listeners={};
 const document={body:{classList:{toggle(){},add(){},remove(){}},addEventListener(name,callback){listeners[name]=callback}},addEventListener(name,callback){listeners[name]=callback},getElementById(id){return nodes.get(id)||null},querySelector(){return null},hidden:false};
 const window={TreasureMallLayout:V2,TreasureMallLayoutV3:V3,TreasureFacilityLayoutV4:V4,TreasureFacilityLayoutV5:V5,TreasureCombatRules:Combat,TreasureEquipmentPilot:Pilot,TreasureMapItem:MapItem,
  crypto:{randomUUID(){return 'v5-test'}},confirm(){return true},addEventListener(){}};
 const source=fs.readFileSync(path.join(__dirname,'../exploration.js'),'utf8'),end=source.lastIndexOf('})();');
 assert.ok(end>0);
 const patched=source.slice(0,end)+
  'window.__v5Test={startRun,snapshotRun,validCheckpoint,restoreRunIfNeeded,runRef:()=>run,setRun:x=>run=x,solid,canSeeBetween,exitPoint,remaining,nearContainer,openContainer,contents,bank,enemyDefinition,performAttack,updateEnemy,drawFacilityVision,areaPicker,createMallContainers,facilityThreatLevel,activateFacilityGuardPosts,draw,tick};'+source.slice(end);
 new Function('window','document','state','ITEMS','ITEM_BY_ID','item','quality','RARITY','QNAME',
 'storageReady','actionPersisting','save','saveWithCommit','render','Image','esc','cancelAnimationFrame',patched)(
 window,document,state,ITEMS,ITEM_BY_ID,id=>ITEM_BY_ID.get(id),()=>1,
 ['N','C','R','SR','SSR','UR','EX'],['低','中','高','最高'],true,false,()=>{},f=>f(),()=>{},
 function(){this.complete=true;this.naturalWidth=0;this.src=''},String,()=>{});
 return {t:window.__v5Test,state,window,listeners};
}
const cell=p=>Math.floor(p.y/40)*V5.gridWidth+Math.floor(p.x/40);
test('R5.33 Tiled map adapter loads playable 1,920x1,520 world from editor data',()=>{
 assert.equal(V5.w,1920);assert.equal(V5.h,1520);
 assert.equal(V5.rooms.length,9);assert.equal(V5.candidates.length,11);assert.equal(V5.guardPosts.length,6);
 assert.equal(V5.pickExit().id,V5.fixedExit.id);
 assert.equal(V5.exitById(V5.fixedExit.id).id,V5.fixedExit.id);
 assert.ok(!V5.solid(V5.start.x,V5.start.y,12));
 assert.ok(!V5.solid(V5.fixedExit.x,V5.fixedExit.y,12));
});
test('R5.33 Tiled adapter supports collision, sight and wall-avoiding pathfinding',()=>{
 const p=V5.guardPosts[0],wall=V5.walls[0];
 assert.ok(V5.solid(wall.x+wall.w/2,wall.y+wall.h/2,5));
 assert.equal(V5.lineClear({x:wall.x-30,y:wall.y+wall.h/2},{x:wall.x+wall.w+30,y:wall.y+wall.h/2}),false);
 assert.ok(V5.walkCells[cell(V5.start)]);
 assert.ok(V5.walkCells[cell(V5.fixedExit)]);
 const safe=V5.nearestWalkablePoint({x:wall.x+wall.w/2,y:wall.y+wall.h/2});
 assert.ok(!V5.solid(safe.x,safe.y,12));
 const wp=V5.nextWaypoint({...V5.start},V5.fixedExit);
 assert.ok(Number.isFinite(wp.x)&&Number.isFinite(wp.y));
});
test('R5.33 full game starts on Tiled V5 with sealed randomized real item contents',()=>{
 const {t,state}=harness();t.startRun();const r=t.runRef();
 assert.equal(r.mapVersion,5);
 assert.equal(r.duration,300);
 assert.equal(r.exitId,V5.fixedExit.id);
 assert.equal(r.containers.length,11);
 assert.equal(r.chests.length,0);
 assert.equal(r.riskUids.length,0);
 assert.ok(r.containers.every(c=>c.contents.length>=1&&c.contents.every(v=>ITEM_BY_ID.has(v.id))));
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.deepEqual(state.exploreRun.containers,r.containers);
});
test('R5.33 default map and deliberate classic map selection preserve separate versions',()=>{
 const tiled=harness();assert.match(tiled.t.contents(),/屋内ドット絵施設/);
 assert.match(tiled.t.areaPicker(),/data-exp-map/);
 const classic=harness('classic');classic.t.startRun();
 assert.equal(classic.t.runRef().mapVersion,4);
 assert.equal(classic.t.runRef().containers.length,80);
 assert.ok(classic.t.validCheckpoint(classic.t.snapshotRun()));
});
test('R5.33 every V5 loot point stays reachable, and rare cache grades survive save',()=>{
 const {t,state}=harness();t.startRun();const r=t.runRef(),pick=r.containers.find(c=>c.grade==='high');
 assert.ok(pick);assert.equal(V5.supplyTierForContainer(pick),'high');
 const snapshot=t.snapshotRun();state.exploreRun=snapshot;t.setRun(null);t.restoreRunIfNeeded();
 assert.equal(t.runRef().mapVersion,5);
 assert.deepEqual(t.runRef().containers,snapshot.containers);
 assert.ok(t.runRef().paused);
 assert.equal(t.runRef().duration,300);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('R5.33 real player proximity and attacks use old equipment/combat rules in new map',()=>{
 const {t}=harness();t.startRun();const r=t.runRef(),cache=r.containers[0];
 r.player.x=cache.x;r.player.y=cache.y;
 assert.equal(t.nearContainer()?.id,cache.id);
 r.enemies=[{x:r.player.x+34,y:r.player.y,kind:'normal',mode:'chase',hp:t.enemyDefinition('normal').hp,
  homeX:r.player.x+34,homeY:r.player.y,attackAt:10,lastSeen:0,facingX:1,facingY:0}];
 r.attackAt=0;r.facing={x:1,y:0};
 const hit=t.performAttack(true,.2);
 assert.ok(hit,'manual strike should use the same weapon system');
 assert.ok(r.enemies[0].hp<t.enemyDefinition('normal').hp);
});
test('R5.33 past classic checkpoint validates and stays on its own map',()=>{
 const {t,state}=harness('classic');t.startRun();
 const old=t.snapshotRun();assert.equal(old.mapVersion,4);
 state.exploreMapChoice='tiled';state.exploreRun=old;
 t.setRun(null);t.restoreRunIfNeeded();
 assert.equal(t.runRef().mapVersion,4);assert.equal(t.runRef().exitId,old.exitId);
 assert.deepEqual(t.runRef().containers,old.containers);
});
test('R5.33 Tiled map is still authored and editable from the original .tmj',()=>{
 const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../maps/indoor/indoor.tmj'),'utf8'));
 assert.equal(source.layers.length,V5.model.map.layers.length);
 assert.deepEqual(source.layers.find(x=>x.name==='Gameplay').objects.map(x=>x.id),
  V5.model.map.layers.find(x=>x.name==='Gameplay').objects.map(x=>x.id));
 assert.deepEqual(source.layers.find(x=>x.name==='SetDressing').data,
  V5.model.map.layers.find(x=>x.name==='SetDressing').data);
});
