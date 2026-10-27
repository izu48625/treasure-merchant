'use strict';
// R5.15: Attack / investigate buttons must work through the delegated click handler.
// Run: node --test tests/exploration-controls.test.cjs
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Layout=require('../exploration-layout.js');
const Maze=require('../exploration-layout-v3.js');
const Pilot=require('../equipment-pilot.js'),Combat=require('../combat-rules.js');
const MapItem=require('../exploration-map-item.js');
const ITEMS=[
 {id:'ITM-00001',name:'エクスカリバー',rarity:'EX',category:'神話・武器',group:'神話・伝説',base:3600000,image:'data:mock'},
 {id:'ITM-00002',name:'ダイヤ',rarity:'UR',category:'宝石',group:'宝石・宝飾',base:500,image:'data:mock'},
 ...Pilot.items,MapItem.item
],ITEM_BY_ID=new Map(ITEMS.map(it=>[it.id,it]));
function harness(){
 const state={inv:[],exploreArea:'mall',
  exploreEquip:{weapon:0,weapon2:0,head:0,body:0,legs:0,accessory:0,tool:0},exploreRun:null};
 const nodes=new Map();
 for(const id of ['exp-interact','exp-pause-layer','exp-action-toast']){
  nodes.set(id,{id,dataset:{},disabled:false,textContent:'',innerHTML:'',
   setAttribute(k,v){this[k]=v}});
 }
 const document={body:{classList:{remove(){},add(){},toggle(){}},addEventListener(){}},
  addEventListener(){},getElementById(id){return nodes.get(id)||null},hidden:false};
 const window={TreasureMallLayout:Layout,TreasureMallLayoutV3:Maze,TreasureMapItem:MapItem,
  TreasureEquipmentPilot:Pilot,TreasureCombatRules:Combat,addEventListener(){},
  crypto:{randomUUID(){return 'r515-controls-test'}},confirm(){return true}};
 const source=fs.readFileSync(path.join(__dirname,'../exploration.js'),'utf8');
 const offset=source.lastIndexOf('})();');assert.ok(offset>=0);
 const module=source.slice(0,offset)+
  'window.__controlsTest={startRun,runRef:()=>run,updateHUD,contents};'+source.slice(offset);
 new Function('window','document','state','ITEMS','ITEM_BY_ID','item','quality','RARITY','QNAME',
  'storageReady','actionPersisting','save','saveWithCommit','render','Image','esc','cancelAnimationFrame',module)(
 window,document,state,ITEMS,ITEM_BY_ID,id=>ITEM_BY_ID.get(id),()=>1,
 ['N','C','R','SR','SSR','UR','EX'],['低','中','高','最高'],true,false,()=>{},fn=>fn(),()=>{},
 function(){this.complete=true;this.naturalWidth=0;this.src=''},String,()=>{});
 return {state,nodes,click:type=>window.explorationAction({dataset:{explore:type}}),
  context:kind=>window.explorationAction({dataset:{explore:'context',context:kind}}),
  ...window.__controlsTest};
}
test('attack works with no nearby enemy and confirms on-screen feedback',()=>{
 const h=harness();h.startRun();
 const run=h.runRef();run.enemies=[];run.attackAt=0;
 h.click('attack');
 assert.ok(run.slash,'manual slash should animate even without a target');
 assert.equal(run.message,'攻撃！');
 assert.equal(h.nodes.get('exp-action-toast').textContent,'攻撃！');
});
test('rapid attack tap queues attack instead of silently failing',()=>{
 const h=harness();h.startRun();const run=h.runRef();
 run.attackAt=300;
 h.click('attack');
 assert.equal(run.manualAttack,true);
 assert.equal(run.message,'攻撃準備中…');
});
test('interact at 70px is enabled and opens the container',()=>{
 const h=harness();h.startRun();const r=h.runRef(),c=r.containers[0];
 r.player.x=c.x+70;r.player.y=c.y;r.enemies=[];
 h.updateHUD(true);
 const button=h.nodes.get('exp-interact');
 assert.equal(button.disabled,false);
 assert.equal(button.dataset.context,'container');
 h.context(button.dataset.context);
 assert.equal(r.paused,true);
 assert.equal(r.lootOpenId,c.id);
});
test('out-of-range investigate tap explains why it cannot open',()=>{
 const h=harness();h.startRun();const r=h.runRef();
 r.containers=[];r.enemies=[];
 h.updateHUD(true);
 assert.equal(h.nodes.get('exp-interact').dataset.context,'none');
 assert.equal(h.nodes.get('exp-interact').disabled,false);
 h.context('none');
 assert.match(r.message,/近づいて/);
 assert.equal(h.nodes.get('exp-action-toast').textContent,r.message);
});
test('world action buttons have priority over invisible joystick hit layer',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../exploration.css'),'utf8');
 const zone=css.match(/#exp-stick-zone\{z-index:(\d+)!important\}/);
 const controls=css.match(/\.exp-controls\{z-index:(\d+)!important\}/);
 assert.ok(zone,'explicit joystick z-index required');
 assert.ok(controls,'explicit button controls z-index required');
 assert.ok(Number(controls[1])>Number(zone[1]),'button stack must win touches');
 assert.match(css,/\.exp-action-toast\{[\s\S]*?pointer-events:none/);
});
test('attack and interact buttons remain on the active raid screen',()=>{
 const h=harness();h.startRun();const html=h.contents();
 for(const id of ['exp-attack','exp-interact','exp-action-toast'])assert.ok(html.includes('id="'+id+'"'));
});
