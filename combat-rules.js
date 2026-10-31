/* Treasure Merchant R5.10: independent combat-style rules.
 * Safe for browsers and Node.js tests. No inventory, gacha or save writes.
 */
(function(root){
'use strict';
const styles=Object.freeze({
 strike:{name:'打撃',range:64,arc:1.08,cooldown:.77,power:1.35,maxTargets:2,effect:'#edbd7d',animationMs:230},
 rapid:{name:'連撃',range:49,arc:.72,cooldown:.30,power:.72,maxTargets:1,effect:'#a3eee0',animationMs:145},
 reach:{name:'長射程',range:104,arc:.36,cooldown:.72,power:1.00,maxTargets:1,effect:'#b2cdf6',animationMs:230},
 unarmed:{name:'素手',range:43,arc:.79,cooldown:.62,power:.85,maxTargets:1,effect:'#dad4c1',animationMs:230},
 slash:{name:'斬撃',range:64,arc:.83,cooldown:.68,power:1.02,maxTargets:2,effect:'#f6a6a3',animationMs:220},
 whip:{name:'鞭・鎖',range:110,arc:1.36,cooldown:.95,power:.90,maxTargets:3,effect:'#e7c186',animationMs:260},
 machine:{name:'機械',range:40,arc:.52,cooldown:.30,power:.75,maxTargets:1,effect:'#efbb77',animationMs:160},
 ranged:{name:'射撃・投擲',range:185,arc:.20,cooldown:.95,power:.92,maxTargets:1,effect:'#98d9ed',animationMs:210},
 special:{name:'特殊',range:96,arc:.75,cooldown:1.10,power:1.00,maxTargets:2,effect:'#c8a8ff',animationMs:290}
});
const affinity=Object.freeze({
 strike:{heavy:1.22},rapid:{fast:1.22},reach:{normal:1.15},
 machine:{heavy:1.10}
});
function legacyStyle(name){
 if(/村正|刀|短剣|ナイフ|ダガー|ヌンチャク|双剣|チェーンソー/.test(name))return 'rapid';
 if(/スコップ|杖|槍|長柄|ランス|ロッド|弓|銃/.test(name))return 'reach';
 return 'strike';
}
function weaponStyle(item){
 if(!item)return 'unarmed';
 const explicit=item.combatStyle||item.weaponStyle||item.style;
 if(typeof explicit==='string'&&Object.prototype.hasOwnProperty.call(styles,explicit))return explicit;
 const name=String(item.name||'');
 // Preserve the shipped 20 catalogue items' exact old style classifications.
 if(/^ITM-000(?:0[1-9]|1[0-9]|20)$/.test(String(item.id||'')))return legacyStyle(name);
 if(/レーザー|プラズマ|電磁|電撃|雷撃|重力|パルス|振動|音波|マグネット|ホログラム|熱線|冷却キャノン|エネルギーランス/.test(name))return 'special';
 if(/チェーンソー|電動|ドリル|丸ノコ|グラインダー|高圧洗浄機|ブロワー|ヒートガン|草刈り機|溶接トーチ|撹拌ミキサー/.test(name))return 'machine';
 if(/チェーン|鎖鎌|フレイル|三節棍|鞭|ワイヤー|ロープ|ベルト/.test(name))return 'whip';
 if(/ボウガン|クロスボウ|弓|銃|投げ|ブーメラン|スリングショット|パチンコ|投石|手裏剣|釘打ち機|ランチャー/.test(name))return 'ranged';
 if(/竹刀|ヌンチャク|トンファー|警棒|短棒/.test(name))return 'rapid';
 if(/包丁|ナイフ|鉈|剣|刀|鎌|斧|サーベル|レイピア|ククリ|ノコギリ|鋸/.test(name))return 'slash';
 if(/物干し|竿|槍|杖|ポール|スコップ|モップ|ほうき|ピッケル|薙刀/.test(name))return 'reach';
 return 'strike';
}
function styleFor(id){return styles[id]||styles.unarmed}
function affinityMultiplier(style,kind){return (affinity[style]&&affinity[style][kind])||1}
function hitDamage(attack,style,kind){
 const s=styleFor(style);
 return Math.max(1,Math.round(Math.max(0,Number(attack)||0)*s.power*affinityMultiplier(style,kind)));
}
// R5.68: deterministic anti-heavy weapon effects; pierce applies to V5 only.
function equipmentDamage(baseDamage,profile,kind,mapVersion){
 const base=Math.max(1,Math.round(Number(baseDamage)||1));
 if(kind!=='heavy')return base;
 if(profile?.effect==='armor_bonus')return Math.max(1,Math.round(base*(1+(Number(profile.effectAmount)||0))));
 if(mapVersion===5&&profile?.effect==='pierce'){
  const bonus=Math.max(0,Math.min(.35,Number(profile.effectAmount)||0));
  return Math.max(1,Math.round(base*(1+bonus)));
 }
 return base;
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function attackTargets(player,enemies,aim,styleId,canSee,enemyTypes,pattern){
 const style=pattern?{...styleFor(styleId),...pattern}:styleFor(styleId),eligible=[];
 for(const e of enemies){
  const d=distance(player,e),r=(enemyTypes[e.kind]||enemyTypes.normal).radius;
  if(d>style.range+r||!canSee(player,e))continue;
  const dot=d<.001?1:((e.x-player.x)*aim.x+(e.y-player.y)*aim.y)/d;
  if(dot<Math.cos(style.arc))continue;
  eligible.push({enemy:e,d});
 }
 return eligible.sort((a,b)=>a.d-b.d).slice(0,style.maxTargets).map(v=>v.enemy);
}
function applyHitEffect(style,enemy,elapsed,random=Math.random){
 if(style==='slash'&&random()<.20){
  // Refresh rather than stack. Deterministic ticks measured in active raid seconds.
  enemy.bleedTicks=3;enemy.bleedNext=elapsed+.6;
  return '出血';
 }
 if(style==='whip'){
  enemy.slowUntil=Math.max(enemy.slowUntil||0,elapsed+1.4);
  enemy.slowFactor=.72;return '鈍足';
 }
 if(style==='special'&&random()<.25){
  enemy.slowUntil=Math.max(enemy.slowUntil||0,elapsed+1);
  enemy.slowFactor=Math.min(enemy.slowFactor||1,.78);return '衝撃';
 }
 return '';
}
// Pilot weapon statuses. Unimplemented effects (fragile, pierce) remain inert.
function applyEquipmentEffect(profile,enemy,elapsed,random=Math.random){
 const effect=String(profile?.effect||'');
 const chance=Math.max(0,Math.min(1,Number(profile?.chance)||0));
 if(!chance||random()>=chance)return '';
 if(effect==='bleed'){
  enemy.bleedTicks=3;enemy.bleedNext=elapsed+.6;
  enemy.bleedDamage=Math.max(1,Math.min(6,Math.round(Number(profile.effectAmount)||2)));
  return '出血';
 }
 if(effect==='slow'||effect==='shock'||effect==='stagger'){
  const duration=effect==='stagger'?.55:effect==='shock'?1.4:1.4;
  const factor=effect==='stagger'?.60:effect==='shock'?.65:.78;
  enemy.slowUntil=Math.max(enemy.slowUntil||0,elapsed+duration);
  enemy.slowFactor=Math.min(enemy.slowFactor||1,factor);
  return effect==='stagger'?'ひるみ':effect==='shock'?'感電':'鈍足';
 }
 return '';
}
function restoreEffects(saved,enemy){
 const t=Number(saved.bleedTicks),next=Number(saved.bleedNext),slow=Number(saved.slowUntil),factor=Number(saved.slowFactor);
 enemy.bleedTicks=Number.isInteger(t)&&t>=0&&t<=3?t:0;
 enemy.bleedNext=Number.isFinite(next)&&next>=0&&next<=240?next:0;
 const bleedDamage=Number(saved.bleedDamage);
 enemy.bleedDamage=Number.isInteger(bleedDamage)&&bleedDamage>=1&&bleedDamage<=6?bleedDamage:2;
 enemy.slowUntil=Number.isFinite(slow)&&slow>=0&&slow<=240?slow:0;
 enemy.slowFactor=Number.isFinite(factor)&&factor>=.5&&factor<=1?factor:1;
 return enemy;
}
function advanceEffects(enemy,elapsed){
 if(!Number.isFinite(elapsed)||elapsed<0)return 0;
 let damage=0;
 // Cap ticks to a fixed finite number even for corrupt/old saves.
 for(let n=0;n<3&&enemy.bleedTicks>0&&elapsed+1e-7>=enemy.bleedNext;n++){
  damage+=(enemy.bleedDamage||2);enemy.bleedTicks--;enemy.bleedNext+=.6;
 }
 if(enemy.bleedTicks===0)enemy.bleedNext=0;
 return damage;
}
function speedFactor(enemy,elapsed){
 return Number.isFinite(enemy.slowUntil)&&elapsed<enemy.slowUntil?
  Math.max(.5,Math.min(1,Number(enemy.slowFactor)||1)):1;
}
const api=Object.freeze({styles,weaponStyle,styleFor,affinityMultiplier,hitDamage,equipmentDamage,attackTargets,applyHitEffect,applyEquipmentEffect,restoreEffects,advanceEffects,speedFactor});
root.TreasureCombatRules=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
