'use strict';
/* R5.10 combat regression tests. Run: node tests/combat-rules.test.js */
const assert=require('node:assert/strict');
const combat=require('../combat-rules.js');
const cases=[];
function test(name,fn){cases.push([name,fn])}
const old=[
  ['ITM-00001','エクスカリバー','strike'],
  ['ITM-00003','村正','rapid'],
  ['ITM-00009','スコップ','reach'],
  ['ITM-00010','鉄のフライパン','strike'],
  ['ITM-00020','賢者の杖','reach']
];
for(const [id,name,style] of old)test('legacy '+name,()=>assert.equal(combat.weaponStyle({id,name}),style));
const modern=[
  ['釘バット','strike'],['竹刀','rapid'],['包丁','slash'],
  ['チェーン','whip'],['チェーンソー','machine'],
  ['ボウガン','ranged'],['重力ハンマー','special'],['物干し竿','reach']
];
for(const [name,style] of modern)test('new '+name,()=>assert.equal(combat.weaponStyle({name}),style));
test('all eight armed types and unarmed present',()=>assert.equal(Object.keys(combat.styles).length,9));
test('legacy strike damage parity',()=>assert.equal(combat.hitDamage(20,'strike','heavy'),Math.round(20*1.35*1.22)));
test('legacy rapid damage parity',()=>assert.equal(combat.hitDamage(20,'rapid','fast'),Math.round(20*.72*1.22)));
test('legacy reach damage parity',()=>assert.equal(combat.hitDamage(20,'reach','normal'),Math.round(20*1.15)));
test('old saves restore without effects',()=>{
 const enemy={};combat.restoreEffects({},enemy);
 assert.equal(enemy.bleedTicks,0);assert.equal(enemy.slowFactor,1);
});
test('valid effects persist',()=>{
 const enemy={};combat.restoreEffects({bleedTicks:2,bleedNext:15,slowUntil:20,slowFactor:.72},enemy);
 assert.equal(enemy.bleedTicks,2);assert.equal(enemy.bleedNext,15);assert.equal(enemy.slowFactor,.72);
});
test('bleed ticks advance in raid time only',()=>{
 const enemy={};combat.applyHitEffect('slash',enemy,10,()=>0);
 assert.equal(combat.advanceEffects(enemy,10.59),0);
 assert.equal(combat.advanceEffects(enemy,10.61),2);
 assert.equal(combat.advanceEffects(enemy,11.81),4);
 assert.equal(enemy.bleedTicks,0);
});
test('whip speed penalty expires',()=>{
 const enemy={};combat.applyHitEffect('whip',enemy,10);
 assert.ok(combat.speedFactor(enemy,11)<1);assert.equal(combat.speedFactor(enemy,12),1);
});
test('whip hits three enemies in front only',()=>{
 const player={x:0,y:0},enemies=[
  {x:55,y:0,kind:'normal'},{x:55,y:12,kind:'normal'},
  {x:55,y:-12,kind:'normal'},{x:-40,y:0,kind:'normal'}
 ];
 const hit=combat.attackTargets(player,enemies,{x:1,y:0},'whip',()=>true,{normal:{radius:11}});
 assert.equal(hit.length,3);
});
test('walls block ranged attacks',()=>{
 const result=combat.attackTargets({x:0,y:0},[{x:110,y:0,kind:'normal'}],{x:1,y:0},
  'ranged',()=>false,{normal:{radius:11}});
 assert.equal(result.length,0);
});
test('all styles respect .25s rate floor',()=>{
 for(const s of Object.values(combat.styles))assert.ok(s.cooldown>=.25);
});
for(const [name,fn] of cases){try{fn()}catch(e){console.error('FAIL:',name);throw e}}
console.log('PASS:',cases.length,'R5.10 combat regression tests');
