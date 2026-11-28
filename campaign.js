/* R6.92 - Campaign gate and independent deterministic boss simulation.
 * No mutation, random draws, inventory loss or reward issuance here.
 */
(function(root){
'use strict';
const maps=Object.freeze([
 Object.freeze({id:'mall',name:'MAP 1 商業施設',available:true,boss:'施設の重装警備兵'}),
 Object.freeze({id:'facility2',name:'MAP 2 次の探索施設',available:false,boss:'第2区域のボス'}),
 Object.freeze({id:'facility3',name:'MAP 3 最終探索施設',available:false,boss:'最終区域のボス'})
]);
const bosses=Object.freeze([
 Object.freeze({hp:240,damage:24,interval:1200,kind:'heavy'}),
 Object.freeze({hp:400,damage:32,interval:1100,kind:'fast'}),
 Object.freeze({hp:650,damage:42,interval:1000,kind:'heavy'})
]);
function normalize(value){
 const cleared=Number.isInteger(value?.cleared)?Math.max(0,Math.min(3,value.cleared)):0;
 const r=value?.last;
 const last=r&&Number.isInteger(r.stage)&&r.stage>=0&&r.stage<3&&r.stage<=cleared&&
  typeof r.won==='boolean'&&(!r.won||r.stage<cleared)&&
  Number.isInteger(r.playerHp)&&r.playerHp>=0&&r.playerHp<=250&&
  Number.isInteger(r.bossHp)&&r.bossHp>=0&&r.bossHp<=bosses[r.stage].hp&&
  Number.isInteger(r.ms)&&r.ms>=0&&r.ms<=30000&&
  (r.won?r.bossHp===0&&r.playerHp>0:r.bossHp>0)?
  {stage:r.stage,won:r.won,playerHp:r.playerHp,bossHp:r.bossHp,ms:r.ms}:null;
 return {cleared,last};
}
function canChallenge(progress,stage){
 return Number.isInteger(stage)&&stage>=0&&stage<maps.length&&maps[stage].available&&stage<=normalize(progress).cleared;
}
function bounded(v,lo,hi,fallback=lo){return Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):fallback}
function simulate(stage,stats,combat){
 const boss=bosses[stage];
 if(!boss||!combat)throw new Error('invalid boss or combat rules');
 let playerHp=Math.round(bounded(stats?.maxHp,1,250,100)),bossHp=boss.hp;
 const defense=Math.round(bounded(stats?.defense,0,20));
 const weapons=(Array.isArray(stats?.weapons)?stats.weapons:[]).slice(0,2);
 if(!weapons.length)weapons.push({style:'unarmed',attack:14});
 const profiles=weapons.map(w=>{
  const style=combat.styleFor(w?.style);
  const interval=Math.round(bounded(w?.pattern?.cooldown??style.cooldown,.25,3,.62)*1000);
  const damage=combat.equipmentDamage(combat.hitDamage(bounded(w?.attack,1,180,14),w?.style,boss.kind),w,boss.kind,5);
  return {interval,damage};
 }).sort((a,b)=>b.damage/b.interval-a.damage/a.interval);
 const weapon=profiles[0],limit=30000;
 let playerAt=weapon.interval,bossAt=boss.interval,ms=0;
 const log=[];
 while(playerHp>0&&bossHp>0&&Math.min(playerAt,bossAt)<=limit){
  ms=Math.min(playerAt,bossAt);
  // On simultaneous attacks the player strikes first; dead opponents cannot retaliate.
  if(playerAt===ms){bossHp=Math.max(0,bossHp-weapon.damage);playerAt+=weapon.interval;log.push({ms,playerHp,bossHp,actor:'player'})}
  if(bossHp>0&&bossAt===ms){playerHp=Math.max(0,playerHp-Math.max(1,boss.damage-defense));bossAt+=boss.interval;log.push({ms,playerHp,bossHp,actor:'boss'})}
 }
 if(playerHp>0&&bossHp>0)ms=limit;
 return {stage,won:bossHp===0&&playerHp>0,playerHp,bossHp,ms,log};
}
function challenge(progress,stage,stats,combat){
 const current=normalize(progress);
 if(!canChallenge(current,stage))return null;
 const result=simulate(stage,stats,combat);
 const {log,...last}=result;
 return {progress:{cleared:result.won?Math.max(current.cleared,stage+1):current.cleared,last},result};
}
const api=Object.freeze({maps,bosses,normalize,canChallenge,simulate,challenge});
root.TreasureCampaign=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
