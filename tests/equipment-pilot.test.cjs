'use strict';
// R5.11 equipment smoke/regression tests. Run: node tests/equipment-pilot.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const pilot=require('../equipment-pilot.js');
const combat=require('../combat-rules.js');
const itemById=new Map(pilot.items.map(it=>[it.id,it]));
const state={
 inv:pilot.items.map((it,i)=>({uid:i+1,id:it.id,q:1,locked:false})),
 exploreEquip:{weapon:0,weapon2:0,head:0,body:0,legs:0,accessory:0,tool:0}
};
const view={TreasureEquipmentPilot:pilot,TreasureCombatRules:combat,addEventListener(){}};
const doc={body:{addEventListener(){}},addEventListener(){}};
const exploration=fs.readFileSync(path.join(__dirname,'../exploration.js'),'utf8');
const last=exploration.lastIndexOf('})();');
assert.ok(last>0,'exploration module ending present');
const script=exploration.slice(0,last)+'window.__test={gearStats,gearSelect,weightTenths};'+exploration.slice(last);
new Function('window','document','state','item','RARITY','QNAME','ITEMS','ITEM_BY_ID','esc',script)(
 view,doc,state,id=>itemById.get(id),['N','C','R','SR','SSR','UR','EX'],
 ['低','中','高','最高'],pilot.items,itemById,s=>String(s)
);
const {gearStats,gearSelect,weightTenths}=view.__test;
const uid=name=>state.inv.find(row=>itemById.get(row.id).name===name).uid;
const cases=[];
function test(name,fn){try{fn();cases.push(name)}catch(err){console.error('FAIL:',name);throw err}}
test('22 item IDs unique',()=>{
 assert.equal(pilot.items.length,22);
 assert.equal(new Set(pilot.items.map(it=>it.id)).size,22);
});
test('all pilot items have placeholder art',()=>assert.ok(pilot.items.every(it=>it.image.startsWith('data:image/svg+xml'))));
test('all pilot weapons use valid style and attack rate',()=>{
 for(const x of pilot.records.filter(x=>x.slot==='weapon')){
  assert.ok(combat.styles[x.style]);assert.ok(x.interval>=.25);assert.ok(x.attack>0);
 }
});
test('legacy base stats unchanged',()=>{
 const r=gearStats();assert.equal(r.attack,14);assert.equal(r.defense,0);
 assert.equal(r.speed,118);assert.equal(r.weightLimit,12);
 assert.equal(r.combatRulesVersion,undefined);
});
test('nail bat damage profile',()=>{
 state.exploreEquip.weapon=uid('釘バット');
 const r=gearStats();assert.equal(r.combatRulesVersion,2);
 assert.equal(r.weapons[0].attack,19);
 assert.equal(r.weapons[0].pattern.cooldown,.82);
 assert.equal(r.weapons[0].effect,'bleed');
});
test('shinai fast reach',()=>{
 state.exploreEquip.weapon=uid('竹刀');
 const r=gearStats();assert.equal(r.weapons[0].pattern.cooldown,.38);
 assert.equal(r.weapons[0].pattern.range,85);
});
test('chain wide hit count',()=>{
 state.exploreEquip.weapon=uid('チェーン');
 const r=gearStats();assert.equal(r.weapons[0].pattern.maxTargets,3);
 assert.equal(r.weapons[0].pattern.range,110);
});
test('catcher armor 3-part stats',()=>{
 state.exploreEquip.weapon=0;
 state.exploreEquip.head=uid('キャッチャーマスク');
 state.exploreEquip.body=uid('キャッチャープロテクター');
 state.exploreEquip.legs=uid('キャッチャーレガース');
 const r=gearStats();assert.equal(r.maxHp,129);
 assert.equal(r.defense,13);assert.equal(r.speed,107);assert.equal(r.resists.frontal,14);
});
test('backpack capacity depends on item',()=>{
 state.exploreEquip.tool=uid('大型登山リュック');
 assert.equal(gearStats().weightLimit,20);
 state.exploreEquip.tool=uid('小型リュック');
 assert.equal(gearStats().weightLimit,16);
});
test('new item weight is not default 1kg',()=>{
 const id=pilot.items.find(it=>it.name==='チェーンソー').id;
 assert.equal(weightTenths(id),50);
});
test('quality affects weapon stats',()=>{
 state.exploreEquip.weapon=uid('竹刀');
 const row=state.inv.find(row=>row.uid===state.exploreEquip.weapon);
 row.q=3;assert.equal(gearStats().weapons[0].attack,18);row.q=1;
});
test('loadout exposes weapon stats',()=>{
 state.exploreEquip.weapon=uid('釘バット');
 assert.match(gearSelect('weapon'),/威力 19 · 間隔 0.82秒/);
});
test('weapon effect damage survives restore',()=>{
 const e={};combat.applyEquipmentEffect({effect:'bleed',chance:1,effectAmount:3},e,4,()=>0);
 const copy={};combat.restoreEffects(e,copy);
 assert.equal(combat.advanceEffects(copy,4.61),3);
});
test('weapon custom range is active',()=>{
 const hit=combat.attackTargets({x:0,y:0},[{x:80,y:0,kind:'normal'}],{x:1,y:0},
 'strike',()=>true,{normal:{radius:11}},{range:100,arc:1,maxTargets:1});
 assert.equal(hit.length,1);
});
test('R5.68 quality-adjusted loadout text matches the real weapon',()=>{
 state.exploreEquip.weapon=uid('竹刀');
 const row=state.inv.find(v=>v.uid===state.exploreEquip.weapon);
 row.q=3;
 assert.equal(gearStats().weapons[0].attack,18);
 assert.match(gearSelect('weapon'),/威力 18 · 間隔 0.38秒/);
 assert.match(gearSelect('weapon'),/対通常型/);
 assert.match(gearSelect('weapon'),/用途：素早い単体攻撃/);
 row.q=1;
 assert.match(gearSelect('weapon'),/威力 16 · 間隔 0.38秒/);
});
test('R5.68 clear role/limitations for defense and unused fire resistance',()=>{
 state.exploreEquip.weapon=0;
 state.exploreEquip.head=uid('消防ヘルメット');
 assert.match(gearSelect('head'),/耐火（現施設では未使用）/);
 assert.match(pilot.roleFor('ITM-00432'),/重装型/);
 assert.equal(pilot.roleFor('not-an-item'),'');
 const bat=pilot.forItem('ITM-00303'),wood=pilot.forItem('ITM-00305');
 assert.equal(bat.interval,.82);assert.equal(bat.chance,.22);
 assert.ok(wood.interval<bat.interval);
});
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('catalog insert happens before ID map',()=>{
 assert.ok(html.indexOf('ITEMS.push(...window.TreasureEquipmentPilot.items)')<html.indexOf('const ITEM_BY_ID='));
});
test('scripts load in order',()=>{
 const pilotAt=html.search(/<script src="equipment-pilot\.js\?v=[^"]+"/);
 const explorationAt=html.search(/<script src="exploration\.js\?v=[^"]+"/);
 assert.ok(pilotAt>=0&&explorationAt>=0&&pilotAt<explorationAt);
});
console.log('PASS:',cases.length,'equipment pilot regression tests');
