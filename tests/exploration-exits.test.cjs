'use strict';
// R5.14 exit & floorplan regression. Run: node --test tests/exploration-exits.test.cjs
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const OldMall=require('../exploration-layout.js');
const Maze=require('../exploration-layout-v3.js');
const MapItem=require('../exploration-map-item.js');
const Pilot=require('../equipment-pilot.js');
const Combat=require('../combat-rules.js');
const ITEMS=[
 {id:'ITM-00001',name:'エクスカリバー',rarity:'EX',category:'神話・武器',group:'神話・伝説',base:3000000,image:'data:mock'},
 {id:'ITM-00002',name:'ダイヤ',rarity:'UR',category:'宝石',group:'宝石・宝飾',base:500,image:'data:mock'},
 ...Pilot.items,MapItem.item
],BY_ID=new Map(ITEMS.map(it=>[it.id,it]));
function harness(){
 const state={inv:[],exploreArea:'mall',exploreEquip:{weapon:0,weapon2:0,head:0,body:0,legs:0,accessory:0,tool:0},exploreRun:null};
 const document={body:{classList:{remove(){},add(){},toggle(){}},addEventListener(){}},
  addEventListener(){},getElementById(){return null},hidden:false};
 const window={TreasureMallLayout:OldMall,TreasureMallLayoutV3:Maze,TreasureMapItem:MapItem,
  TreasureEquipmentPilot:Pilot,TreasureCombatRules:Combat,addEventListener(){},
  crypto:{randomUUID(){return 'r514-test'}},confirm(){return true}};
 const src=fs.readFileSync(path.join(__dirname,'../exploration.js'),'utf8');
 const offset=src.lastIndexOf('})();');assert.ok(offset>0);
 const injection='window.__test={startRun,snapshotRun,validCheckpoint,restoreRunIfNeeded,runRef:()=>run,setRun:v=>run=v,exitPoint,hasDetailedMap,mapPanel,gearCandidates,contents,remaining};';
 const patched=src.slice(0,offset)+injection+src.slice(offset);
 new Function('window','document','state','ITEMS','ITEM_BY_ID','item','quality','RARITY','QNAME',
 'storageReady','actionPersisting','save','saveWithCommit','render','Image','esc','cancelAnimationFrame',patched)(
 window,document,state,ITEMS,BY_ID,id=>BY_ID.get(id),()=>1,['N','C','R','SR','SSR','UR','EX'],
 ['低','中','高','最高'],true,false,()=>{},fn=>fn(),()=>{},function(){this.src='';this.complete=true;this.naturalWidth=0},
 v=>String(v),()=>{});
 return {t:window.__test,state,act:window.explorationAction};
}
test('25 distant selectable exit sites differ from entry',()=>{
 assert.equal(Maze.exitCandidates.length,25);
 assert.ok(Maze.exitCandidates.every(p=>Math.hypot(p.x-Maze.start.x,p.y-Maze.start.y)>500));
 assert.ok(Maze.exitCandidates.every(p=>Maze.roomAt(p)===p.roomIndex));
 assert.notEqual(Maze.pickExit(()=>0).id,Maze.pickExit(()=>.99999).id);
});
test('each new sortie seals one exit in checkpoint',()=>{
 const {t}=harness();t.startRun();const r=t.runRef();
 assert.equal(r.mapVersion,3);assert.ok(Maze.exitById(r.exitId));
 assert.equal(t.exitPoint().id,r.exitId);
 assert.equal(t.snapshotRun().exitId,r.exitId);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('exit ID is retained after reload, tampered exit rejected',()=>{
 const {t,state}=harness();t.startRun();const id=t.runRef().exitId;
 state.exploreRun=t.snapshotRun();t.setRun(null);t.restoreRunIfNeeded();
 assert.equal(t.runRef().exitId,id);assert.equal(t.exitPoint().id,id);
 const bad=t.snapshotRun();bad.exitId='sector-NO';assert.equal(t.validCheckpoint(bad),false);
});
test('older saved labyrinth without exit ID keeps original exit',()=>{
 const {t,state}=harness();t.startRun();
 const old=t.snapshotRun();delete old.exitId;
 assert.ok(t.validCheckpoint(old));
 state.exploreRun=old;t.setRun(null);t.restoreRunIfNeeded();
 assert.equal(t.exitPoint().x,Maze.exit.x);
 assert.equal(t.exitPoint().y,Maze.exit.y);
});
test('non-map players see approximate region, never precise floorplan',()=>{
 const {t}=harness();t.startRun();const view=t.mapPanel();
 assert.match(view,/出口の方角/);assert.match(view,/脱出口/);
 assert.doesNotMatch(view,/viewBox="0 0 3600 2600"/);
 assert.ok(!t.hasDetailedMap());
});
test('facility map is equipable in tool slot and unlocks precise layout',()=>{
 const {t,state}=harness();t.startRun();
 state.inv.push({uid:501,id:MapItem.id,q:1,locked:false});
 assert.ok(t.gearCandidates('tool').some(x=>x.uid===501));
 assert.ok(!t.hasDetailedMap());
 state.exploreEquip.tool=501;
 assert.ok(t.hasDetailedMap());
 assert.match(t.mapPanel(),/viewBox="0 0 3600 2600"/);
 assert.match(t.mapPanel(),/全48区画の接続/);
 state.exploreEquip.tool=0;
 assert.ok(!t.hasDetailedMap());
});
test('map recovered into loot unlocks detail; dropping it removes access',()=>{
 const {t}=harness();t.startRun();
 t.runRef().loot.push({id:MapItem.id,q:1,tid:5});
 assert.ok(t.hasDetailedMap());
 t.runRef().loot=[];
 assert.ok(!t.hasDetailedMap());
});
test('direct map control freezes sortie and returns to gameplay',()=>{
 const {t,act}=harness();t.startRun();
 assert.match(t.contents(),/id="exp-map-toggle"/);
 act({dataset:{explore:'field-map'}});
 assert.ok(t.runRef().paused);
 assert.ok(t.runRef().showMap);
 assert.ok(t.runRef().mapDirect);
 act({dataset:{explore:'map-back'}});
 assert.equal(t.runRef().paused,false);
 assert.equal(t.runRef().showMap,false);
});
test('non-labyrinth area keeps the original exit and no map button',()=>{
 const {t,state}=harness();state.exploreArea='factory';t.startRun();
 assert.equal(t.exitPoint().x,88);
 assert.equal(t.exitPoint().y,100);
 assert.doesNotMatch(t.contents(),/id="exp-map-toggle"/);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
