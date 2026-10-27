'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const V2=require('../exploration-layout.js'),V3=require('../exploration-layout-v3.js'),V4=require('../exploration-layout-v4.js');
const Pilot=require('../equipment-pilot.js'),Combat=require('../combat-rules.js'),MapItem=require('../exploration-map-item.js');
const ITEMS=[
 {id:'ITM-00001',name:'エクスカリバー',rarity:'EX',category:'神話・武器',group:'神話・伝説',base:3000000,image:'data:mock'},
 {id:'ITM-00002',name:'ダイヤ',rarity:'UR',category:'宝石',group:'宝石・宝飾',base:500,image:'data:mock'},
 ...Pilot.items,MapItem.item
],ITEM_BY_ID=new Map(ITEMS.map(v=>[v.id,v]));
function harness(){
 const state={inv:[],exploreArea:'mall',exploreEquip:{weapon:0,weapon2:0,head:0,body:0,legs:0,accessory:0,tool:0},exploreRun:null};
 const layer={innerHTML:''};
 const document={body:{classList:{add(){},remove(){},toggle(){}},addEventListener(){}},
  addEventListener(){},querySelector(){return null},getElementById(id){return id==='exp-pause-layer'?layer:null},hidden:false};
 const window={TreasureMallLayout:V2,TreasureMallLayoutV3:V3,TreasureFacilityLayoutV4:V4,
  TreasureEquipmentPilot:Pilot,TreasureCombatRules:Combat,TreasureMapItem:MapItem,
  addEventListener(){},crypto:{randomUUID(){return 'preview-test-uuid'}},confirm(){return true}};
 const source=fs.readFileSync(path.join(__dirname,'../exploration.js'),'utf8');
 const pos=source.lastIndexOf('})();');assert.ok(pos>0);
 const modified=source.slice(0,pos)+
  'window.__previewTest={contents,pausePanel,startRun,restoreRunIfNeeded,snapshotRun,runRef:()=>run,setRun:v=>run=v,preview:()=>facilityPreviewOpen};'+source.slice(pos);
 let renders=0;
 new Function('window','document','state','ITEMS','ITEM_BY_ID','item','quality','RARITY','QNAME',
  'storageReady','actionPersisting','save','saveWithCommit','render','Image','esc','cancelAnimationFrame',modified)(
  window,document,state,ITEMS,ITEM_BY_ID,id=>ITEM_BY_ID.get(id),()=>1,
  ['N','C','R','SR','SSR','UR','EX'],['低','中','高','最高'],
  true,false,()=>{},fn=>fn(),()=>{renders++},
  function(){this.complete=true;this.naturalWidth=0;this.src=''},String,()=>{});
 return {...window.__previewTest,state,layer,act:type=>window.explorationAction({dataset:{explore:type}}),renderCount:()=>renders};
}
test('intro can show a save-safe real facility preview with a close button',()=>{
 const h=harness();
 assert.match(h.contents(),/新施設の全体図を下見する/);
 h.act('preview-map');
 assert.equal(h.preview(),true);
 const html=h.contents();
 assert.match(html,/実際の床・壁・家具データ/);
 assert.match(html,/viewBox="0 0 3600 2600"/);
 assert.match(html,/data-explore="preview-close"/);
 assert.equal(h.runRef(),null);
 h.act('preview-close');
 assert.equal(h.preview(),false);
 assert.doesNotMatch(h.contents(),/exp-map-preview-card/);
});
test('old V3 checkpoint stays intact and warns that terrain is old',()=>{
 const h=harness();h.startRun();const latest=h.snapshotRun();
 assert.equal(latest.mapVersion,4);
 // Build legitimate older map snapshot with the older layout.
 const c={...latest,mapVersion:3,containers:V3.rollContainers().map(row=>({
  ...row,contents:[{id:ITEMS[0].id,q:1}]})),player:{...latest.player,x:V3.start.x,y:V3.start.y},
  exitId:V3.exitCandidates[0].id,visitedRooms:[V3.roomAt(V3.start)]};
 h.state.exploreRun=c;h.setRun(null);h.restoreRunIfNeeded();
 assert.equal(h.runRef().mapVersion,3);
 const screen=h.contents();
 assert.match(screen,/旧地形・48区画マップ/);
 assert.match(screen,/実際の地形 V3/);
 assert.ok(h.runRef().paused);
 assert.match(h.pausePanel(),/旧マップを復帰中/);
 h.act('preview-map');
 assert.match(h.layer.innerHTML,/新施設の全体構造/);
 assert.equal(h.runRef().mapVersion,3);
 assert.equal(h.runRef().exitId,c.exitId);
 h.act('preview-close');
 assert.equal(h.runRef().mapVersion,3);
});
test('new V4 raid clearly names its actual terrain, not just the app version',()=>{
 const h=harness();h.startRun();
 assert.equal(h.runRef().mapVersion,4);
 assert.match(h.contents(),/新地形・一体型施設/);
 assert.match(h.contents(),/実際の地形 V4/);
 assert.doesNotMatch(h.contents(),/旧地形・48区画マップ/);
});

test('every newly selected area launches the same V4 physical facility',()=>{
 for(const selected of ['mall','factory','ruins']){
  const h=harness();h.state.exploreArea=selected;h.startRun();
  const run=h.runRef();
  assert.equal(run.mapVersion,4,'selected area '+selected);
  assert.equal(run.area,selected,'drop-weight identity unchanged');
  assert.equal(run.player.x,V4.start.x);
  assert.equal(run.player.y,V4.start.y);
  assert.equal(run.containers.length,80);
  assert.match(h.contents(),/新地形・一体型施設/);
 }
});
test('V4 is untimed and its checkpoint stays valid after more than four minutes',()=>{
 const h=harness();h.state.exploreArea='factory';h.startRun();
 const r=h.runRef();r.start=Date.now()-1000*510;
 const snapshot=h.snapshotRun();
 assert.equal(snapshot.remaining,240);
 assert.ok(Number.isFinite(snapshot.elapsedSeconds)&&snapshot.elapsedSeconds>=500);
 h.state.exploreRun=snapshot;h.setRun(null);h.restoreRunIfNeeded();
 assert.equal(h.runRef().mapVersion,4);
 assert.equal(h.runRef().area,'factory');
});
