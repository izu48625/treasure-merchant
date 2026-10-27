'use strict';
// R5.20: combat and movement balance for the integrated facility only.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const V2=require('../exploration-layout.js'),V3=require('../exploration-layout-v3.js'),V4=require('../exploration-layout-v4.js');
const Pilot=require('../equipment-pilot.js'),Combat=require('../combat-rules.js'),MapItem=require('../exploration-map-item.js');
const ITEMS=[
 {id:'ITM-00001',name:'エクスカリバー',rarity:'EX',category:'神話・武器',group:'神話・伝説',base:3000000,image:'data:mock'},
 {id:'ITM-00002',name:'ダイヤ',rarity:'UR',category:'宝石',group:'宝石・宝飾',base:500,image:'data:mock'},
 ...Pilot.items,MapItem.item
],ITEM_BY_ID=new Map(ITEMS.map(x=>[x.id,x]));
function harness(v4=true){
 const state={inv:[],exploreArea:'mall',exploreEquip:{weapon:0,weapon2:0,head:0,body:0,legs:0,accessory:0,tool:0},exploreRun:null};
 const document={body:{classList:{toggle(){},add(){},remove(){}},addEventListener(){}},
  addEventListener(){},querySelector(){return null},getElementById(){return null},hidden:false};
 const window={TreasureMallLayout:V2,TreasureMallLayoutV3:V3,TreasureFacilityLayoutV4:v4?V4:undefined,
  TreasureEquipmentPilot:Pilot,TreasureCombatRules:Combat,TreasureMapItem:MapItem,
  addEventListener(){},crypto:{randomUUID(){return 'combat-test'}},confirm(){return true}};
 const source=fs.readFileSync(path.join(__dirname,'../exploration.js'),'utf8'),at=source.lastIndexOf('})();');
 assert.ok(at>0);
 const patched=source.slice(0,at)+
  'window.__combatTest={startRun,runRef:()=>run,enemyDefinition,restoreEnemy,performAttack,updateEnemy,gearStats,solid,canSeeBetween,snapshotRun,validCheckpoint};'+source.slice(at);
 new Function('window','document','state','ITEMS','ITEM_BY_ID','item','quality','RARITY','QNAME',
 'storageReady','actionPersisting','save','saveWithCommit','render','Image','esc','cancelAnimationFrame',patched)(
 window,document,state,ITEMS,ITEM_BY_ID,id=>ITEM_BY_ID.get(id),()=>1,
 ['N','C','R','SR','SSR','UR','EX'],['低','中','高','最高'],true,false,()=>{},fn=>fn(),()=>{},
 function(){this.complete=true;this.naturalWidth=0;this.src=''},String,()=>{});
 return {t:window.__combatTest,state};
}
function target(h,kind='normal',offset=-35,mode='chase'){
 const run=h.t.runRef(),p=run.player;
 return h.t.restoreEnemy({
  x:p.x+offset,y:p.y,kind,hp:h.t.enemyDefinition(kind).hp,mode,
  homeX:p.x+offset,homeY:p.y,attackAt:99,
  lastSeen:0,lastX:p.x,lastY:p.y
 });
}
test('facility enemies have deliberately differentiated roles',()=>{
 const h=harness();h.t.startRun();
 const normal=h.t.enemyDefinition('normal'),fast=h.t.enemyDefinition('fast'),heavy=h.t.enemyDefinition('heavy');
 assert.equal(normal.hp,42);assert.equal(fast.hp,29);assert.equal(heavy.hp,108);
 assert.ok(fast.speed>normal.speed&&normal.speed>heavy.speed);
 assert.ok(h.t.gearStats().speed>fast.speed,'unencumbered player can run away');
 assert.ok(heavy.windup>normal.windup&&normal.windup>fast.windup);
 assert.ok(heavy.recovery>fast.recovery&&fast.recovery>normal.recovery);
});
test('facilities only: restored prior V3 enemies retain original stats',()=>{
 const h=harness(false);h.t.startRun();
 assert.equal(h.t.runRef().mapVersion,3);
 assert.equal(h.t.enemyDefinition('normal').hp,35);
 assert.equal(h.t.enemyDefinition('fast').speed,86);
 assert.equal(h.t.enemyDefinition('heavy').damage,20);
});
test('mobile manual attack locks onto a nearby enemy while retreating',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef(),e=target(h,'normal',-35);
 r.enemies=[e];r.facing={x:1,y:0};r.attackAt=0;
 assert.equal(h.t.canSeeBetween(r.player,e),true);
 assert.equal(h.t.performAttack(true,.1),true);
 assert.ok(e.hp<42,'manual tap should damage a visible threat behind movement direction');
 assert.ok(r.slash.dx<0,'attack animation points to actual enemy');
});
test('empty manual taps still swing in the actual movement direction',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef();
 r.enemies=[];r.facing={x:1,y:0};r.attackAt=0;
 h.t.performAttack(true,.2);
 assert.ok(r.slash.dx>0);
});
test('a manual hit interrupts regular/fast windup but not heavy windup',()=>{
 for(const kind of ['normal','fast','heavy']){
  const h=harness();h.t.startRun();const r=h.t.runRef(),e=target(h,kind,-35,'windup');
  e.phaseUntil=1.4;e.attackAt=0;r.enemies=[e];r.facing={x:1,y:0};
  h.t.performAttack(true,.2);
  assert.equal(e.mode,kind==='heavy'?'windup':'recover',kind);
 }
});
test('fast target briefly moves laterally in open corridor instead of only charging',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef(),e=target(h,'fast',75,'chase');
 e.lastSeen=.1;e.attackAt=100;r.enemies=[e];
 const before={x:e.x,y:e.y};
 assert.equal(h.t.canSeeBetween(e,r.player),true);
 h.t.updateEnemy(e,.5,.12);
 assert.ok(Math.abs(e.y-before.y)>0.1,'fast enemy should sidestep');
 assert.ok(!h.t.solid(e.x,e.y,10),'lateral movement must remain physical');
});
test('save and restore preserve enemy mode, health and loot',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef(),e=target(h,'fast',75,'chase');
 r.enemies=[e];e.hp=9;e.lastSeen=2;
 const saved=h.t.snapshotRun();
 assert.ok(h.t.validCheckpoint(saved));
 assert.equal(saved.enemies[0].hp,9);
 assert.equal(saved.enemies[0].mode,'chase');
});
