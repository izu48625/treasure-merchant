'use strict';
// R5.16: simulate a held joystick finger and a second iPhone action touch.
// node --test tests/exploration-multitouch.test.cjs
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const V2=require('../exploration-layout.js'),V3=require('../exploration-layout-v3.js');
const MapItem=require('../exploration-map-item.js'),Pilot=require('../equipment-pilot.js'),Combat=require('../combat-rules.js');
const ITEMS=[
 {id:'ITM-00001',name:'エクスカリバー',rarity:'EX',category:'神話・武器',group:'神話・伝説',base:3600000,image:'data:mock'},
 {id:'ITM-00002',name:'ダイヤ',rarity:'UR',category:'宝石',group:'宝石・宝飾',base:500,image:'data:mock'},
 ...Pilot.items,MapItem.item
],BY_ID=new Map(ITEMS.map(i=>[i.id,i]));
function element(id){
 const handlers=new Map();
 return {id,dataset:{},disabled:false,offsetWidth:110,offsetHeight:110,
  style:{},classList:{add(){},remove(){},contains(){return false}},
  textContent:'',innerHTML:'',
  getBoundingClientRect(){return {left:0,top:0,right:390,bottom:844}},
  closest(sel){return sel==='.exp-playing'?{getBoundingClientRect(){return {left:0,top:0,right:390,bottom:844}}}:null},
  setPointerCapture(){},releasePointerCapture(){},hasPointerCapture(){return false},
  addEventListener(name,fn){handlers.set(name,fn)},
  fire(name,event){const fn=handlers.get(name);assert.ok(fn,'event handler for '+id+' '+name);fn(event)},
  setAttribute(k,v){this[k]=v}
 };
}
function harness(){
 const zone=element('exp-stick-zone'),stick=element('exp-stick'),thumb=element('exp-stick-thumb');
 thumb.offsetWidth=34;
 const controls=element('action-controls'),attack=element('exp-attack'),interact=element('exp-interact'),swap=element('exp-swap');
 const bag=element('exp-bag-button'),auto=element('exp-auto'),backpack=element('exp-backpack');
 backpack.classList.toggle=name=>{backpack.isOpen=!backpack.isOpen;return backpack.isOpen};
 attack.dataset.explore='attack';interact.dataset.explore='context';swap.dataset.explore='swap';
 bag.dataset.explore='bag';auto.dataset.explore='auto';
 const buttons=[attack,interact,swap,bag,auto];
 for(const b of buttons)b.closest=sel=>sel==='button[data-explore]'?b:null;
 controls.contains=b=>buttons.includes(b);
 const nodes=new Map([
  ['exp-stick-zone',zone],['exp-stick',stick],['exp-stick-thumb',thumb],
  ['exp-interact',interact],['exp-auto',auto],['exp-backpack',backpack],['exp-pause-layer',element('exp-pause-layer')],
  ['exp-action-toast',element('exp-action-toast')]
 ]);
 const doc={body:{classList:{add(){},remove(){},toggle(){}},addEventListener(){}},
  getElementById:id=>nodes.get(id)||null,
  querySelector:selector=>selector==='.exp-playing .exp-control-actions'?controls:null,
  addEventListener(){},hidden:false
 };
 const win={TreasureMallLayout:V2,TreasureMallLayoutV3:V3,TreasureMapItem:MapItem,
  TreasureEquipmentPilot:Pilot,TreasureCombatRules:Combat,
  addEventListener(){},confirm(){return true},crypto:{randomUUID(){return 'r516-test'}}};
 const state={inv:[],exploreArea:'mall',exploreEquip:{weapon:0,weapon2:0,head:0,body:0,legs:0,accessory:0,tool:0},exploreRun:null};
 const src=fs.readFileSync(path.join(__dirname,'../exploration.js'),'utf8');
 const end=src.lastIndexOf('})();');assert.ok(end>0);
 const modified=src.slice(0,end)+
  'window.__touchTest={startRun,bindStick,bindMultiTouchActions,runRef:()=>run,updateHUD};'+src.slice(end);
 new Function('window','document','state','ITEMS','ITEM_BY_ID','item','quality','RARITY','QNAME',
  'storageReady','actionPersisting','save','saveWithCommit','render','Image','esc','cancelAnimationFrame','active',modified)(
  win,doc,state,ITEMS,BY_ID,id=>BY_ID.get(id),()=>1,['N','C','R','SR','SSR','UR','EX'],['低','中','高','最高'],
  true,false,()=>{},fn=>fn(),()=>{},function(){this.complete=true;this.naturalWidth=0;this.src=''},String,()=>{},'explore'
 );
 const {startRun,bindStick,bindMultiTouchActions,runRef,updateHUD}=win.__touchTest;
 startRun();bindStick();bindMultiTouchActions();
 const pointer=(name,x)=>zone.fire(name,{
  pointerId:1,pointerType:'touch',clientX:x,clientY:620,button:0,
  preventDefault(){},cancelable:true
 });
 const tap=(button)=>{
  const evt={target:button,cancelable:true,prevented:false,
   preventDefault(){this.prevented=true}};
  controls.fire('touchstart',evt);return evt
 };
 const click=(button,detail=1)=>{
  const evt={target:button,detail,stopped:false,prevented:false,
   preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}};
  controls.fire('click',evt);return evt
 };
 return {state,runRef,updateHUD,pointer,tap,click,attack,interact,swap,bag,auto,backpack,controls,win};
}
test('second-finger attack works while primary joystick touch stays held',()=>{
 const h=harness(),r=h.runRef();r.enemies=[];r.attackAt=0;
 h.pointer('pointerdown',90);h.pointer('pointermove',133);
 assert.ok(r.joy.x>.5,'the left thumb is actively steering');
 const event=h.tap(h.attack);
 assert.equal(event.prevented,true);
 assert.ok(r.slash,'right thumb attack should trigger immediately, without click');
 assert.equal(r.message,'攻撃！');
 assert.ok(r.joy.x>.5,'left thumb must keep steering after right tap');
});
test('Safari synthetic click following touchstart is suppressed once',()=>{
 const h=harness(),r=h.runRef();r.enemies=[];r.attackAt=0;
 h.pointer('pointerdown',90);h.pointer('pointermove',129);
 h.tap(h.attack);
 const duplicate=h.click(h.attack,1);
 assert.equal(duplicate.stopped,true);assert.equal(duplicate.prevented,true);
 assert.ok(r.joy.x>0);
 const keyboard=h.click(h.attack,0);
 assert.equal(keyboard.stopped,false,'keyboard-generated click remains usable');
});
test('second-finger container touch opens loot pause without first releasing joystick',()=>{
 const h=harness(),r=h.runRef(),c=r.containers[0];
 r.enemies=[];r.player.x=c.x+60;r.player.y=c.y;
 h.updateHUD(true);
 assert.equal(h.interact.dataset.context,'container');
 h.pointer('pointerdown',90);h.pointer('pointermove',130);
 assert.ok(r.joy.x>0);
 const event=h.tap(h.interact);
 assert.equal(event.prevented,true);
 assert.equal(r.lootOpenId,c.id);
 assert.equal(r.paused,true,'the loot chooser must pause the game');
});
test('rapid second-finger repeated taps are never swallowed',()=>{
 const h=harness(),r=h.runRef();r.enemies=[];r.attackAt=0;
 h.pointer('pointerdown',80);h.pointer('pointermove',115);
 h.tap(h.attack);assert.equal(r.message,'攻撃！');
 h.tap(h.attack);assert.equal(r.message,'攻撃準備中…');
 assert.equal(r.manualAttack,true);
 assert.ok(r.joy.x>0);
});
test('mouse click remains delegated when no touchscreen action occurred',()=>{
 const h=harness(),c=h.click(h.swap,1);
 assert.equal(c.stopped,false);
 assert.equal(c.prevented,false);
});
test('R5.69 bottom-row AUTO is responsive with joystick held; Bag opens once',()=>{
 const h=harness(),r=h.runRef();
 h.pointer('pointerdown',90);h.pointer('pointermove',134);
 assert.ok(r.joy.x>.5);
 assert.equal(r.autoAttack,true,'older map begins with auto mode');
 const touch=h.tap(h.auto);assert.equal(touch.prevented,true);
 assert.equal(r.autoAttack,false,'AUTO toggled once on touchstart');
 assert.ok(r.joy.x>.5,'AUTO must not release steering finger');
 assert.equal(h.click(h.auto).stopped,true,'synthetic click is suppressed');
 assert.equal(r.autoAttack,false,'AUTO did not double-toggle');
 h.tap(h.bag);
 assert.equal(h.backpack.isOpen,true,'bag can open using second finger');
 assert.equal(r.joy.x,0,'opening inventory intentionally releases joystick');
 assert.equal(h.click(h.bag).stopped,true,'bag synthetic click is suppressed');
});
test('CSS reserves right-hand action touch and keeps it above joystick',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../exploration.css'),'utf8');
 assert.match(css,/\.exp-action-grid button\{\s*touch-action:none!important/);
 assert.match(css,/#exp-stick-zone\{z-index:6!important\}/);
 assert.match(css,/\.exp-controls\{z-index:12!important\}/);
});
