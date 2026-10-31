'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Combat=require('../combat-rules.js');
const enemies={normal:{radius:11},fast:{radius:10},heavy:{radius:17}};
test('all eight equipped families plus unarmed have safe and distinct definitions',()=>{
 for(const id of ['strike','rapid','reach','slash','whip','machine','ranged','special','unarmed']){
  const s=Combat.styleFor(id);
  assert.ok(s.range>=30&&s.range<=300,id);
  assert.ok(s.cooldown>=.25&&s.cooldown<=2,id);
  assert.ok(s.maxTargets>=1&&s.maxTargets<=4,id);
  assert.ok(s.animationMs>0,id);
 }
 assert.equal(Combat.styleFor('not-a-style'),Combat.styles.unarmed);
});
test('shipped catalogue names keep their pre-R5.10 style',()=>{
 const fixtures=[
  ['ITM-00001','エクスカリバー','strike'],
  ['ITM-00003','村正','rapid'],
  ['ITM-00009','スコップ','reach'],
  ['ITM-00010','鉄のフライパン','strike'],
  ['ITM-00020','賢者の杖','reach']
 ];
 for(const [id,name,expect] of fixtures)assert.equal(Combat.weaponStyle({id,name}),expect);
});
test('new names and explicit master styles resolve consistently',()=>{
 for(const [name,expect] of [
  ['釘バット','strike'],['竹刀','rapid'],['物干し竿','reach'],
  ['包丁','slash'],['チェーン','whip'],['チェーンソー','machine'],
  ['ボウガン','ranged'],['電撃チェーン','special']
 ])assert.equal(Combat.weaponStyle({name}),expect,name);
 assert.equal(Combat.weaponStyle({id:'ITM-00003',name:'村正',combatStyle:'slash'}),'slash');
 assert.equal(Combat.weaponStyle({name:'釘バット',style:'ranged'}),'ranged');
});
test('old damage formula and heavy/fast enemy affinities are preserved',()=>{
 for(const [style,kind,attack] of [['strike','heavy',20],['rapid','fast',21],['reach','normal',17]]){
  const expected=Math.max(1,Math.round(attack*Combat.styles[style].power*Combat.affinityMultiplier(style,kind)));
  assert.equal(Combat.hitDamage(attack,style,kind),expected);
 }
 assert.equal(Combat.affinityMultiplier('whip','heavy'),1);
});
test('R5.68 heavy bonuses preserve legacy behavior and restrict pierce to V5',()=>{
 const base=Combat.hitDamage(15,'ranged','heavy');
 const knife={effect:'pierce',effectAmount:.18};
 assert.equal(Combat.equipmentDamage(base,knife,'heavy',5),Math.round(base*1.18));
 assert.equal(Combat.equipmentDamage(base,knife,'normal',5),base);
 assert.equal(Combat.equipmentDamage(base,knife,'heavy',4),base);
 assert.equal(Combat.equipmentDamage(base,knife,'heavy',3),base);
 assert.equal(Combat.equipmentDamage(40,{effect:'armor_bonus',effectAmount:.15},'heavy',4),46);
 assert.equal(Combat.equipmentDamage(40,{effect:'armor_bonus',effectAmount:.15},'normal',5),40);
 assert.equal(Combat.equipmentDamage(20,{effect:'pierce',effectAmount:Infinity},'heavy',5),20);
});
test('whip hits at most three visible enemies in its cone',()=>{
 const p={x:0,y:0},targets=[
  {id:'a',x:50,y:0,kind:'normal'},
  {id:'b',x:55,y:5,kind:'normal'},
  {id:'c',x:65,y:-4,kind:'normal'},
  {id:'blocked',x:75,y:3,kind:'normal'},
  {id:'behind',x:-30,y:0,kind:'normal'}
 ];
 const hits=Combat.attackTargets(p,targets,{x:1,y:0},'whip',(_,e)=>e.id!=='blocked',enemies);
 assert.deepEqual(hits.map(v=>v.id),['a','b','c']);
});
test('ranged never shoots through walls, outside its arc, or beyond range',()=>{
 const p={x:0,y:0},targets=[
  {id:'good',x:100,y:0,kind:'normal'},
  {id:'wall',x:120,y:0,kind:'normal'},
  {id:'side',x:0,y:90,kind:'normal'},
  {id:'far',x:400,y:0,kind:'normal'}
 ];
 assert.deepEqual(
  Combat.attackTargets(p,targets,{x:1,y:0},'ranged',(_,e)=>e.id!=='wall',enemies).map(v=>v.id),
  ['good']
 );
});
test('slash bleed is finite, refreshes instead of stacking, and survives serialization',()=>{
 const e={};
 assert.equal(Combat.applyHitEffect('slash',e,3,()=>0),'出血');
 assert.equal(Combat.advanceEffects(e,3.59),0);
 assert.equal(Combat.advanceEffects(e,3.6),2);
 assert.equal(Combat.advanceEffects(e,3.6),0);
 const saved=JSON.parse(JSON.stringify(e));
 const restored=Combat.restoreEffects(saved,{});
 assert.equal(Combat.advanceEffects(restored,4.2),2);
 assert.equal(Combat.advanceEffects(restored,4.8),2);
 assert.equal(Combat.advanceEffects(restored,9),0);
 assert.equal(restored.bleedTicks,0);
 Combat.applyHitEffect('slash',restored,10,()=>0);
 Combat.applyHitEffect('slash',restored,10.1,()=>0);
 assert.equal(restored.bleedTicks,3);
});
test('whip/special slow expires on raid time and invalid saves are sanitized',()=>{
 const e={};
 assert.equal(Combat.applyHitEffect('whip',e,4,()=>1),'鈍足');
 assert.equal(Combat.speedFactor(e,4.5),.72);
 assert.equal(Combat.speedFactor(e,6),1);
 assert.equal(Combat.applyHitEffect('special',e,10,()=>0),'衝撃');
 assert.ok(Combat.speedFactor(e,10.5)<1);
 const tampered=Combat.restoreEffects({bleedTicks:1e9,bleedNext:Infinity,slowUntil:-500,slowFactor:.001},{});
 assert.equal(tampered.bleedTicks,0);
 assert.equal(tampered.slowFactor,1);
 assert.equal(Combat.speedFactor(tampered,0),1);
});
test('legacy profiles do not roll new status effects',()=>{
 const e={};
 for(const style of ['strike','rapid','reach','unarmed']){
  assert.equal(Combat.applyHitEffect(style,e,10,()=>0),'');
 }
 assert.equal(Combat.advanceEffects(e,12),0);
});
