(function explorationModule(){
'use strict';
// Independent, single-player extraction prototype. No gacha/arcade draw results are changed.
const WORLD={w:920,h:720}, VIEW={w:360,h:416}, DURATION=240, FACILITY_DURATION=300;
const ORIGINAL_WORLD={w:920,h:720},Mall=window.TreasureMallLayout,MallV3=window.TreasureMallLayoutV3,MallV4=window.TreasureFacilityLayoutV4;
let MallV5=null,indoorModeSelected=!!window.TreasureIndoorLayoutV5,indoorLoadError='';
const tiledSource=window.TreasureIndoorLayoutV5;
if(tiledSource)tiledSource.load().then(m=>{
 MallV5=m;if(typeof active!=='undefined'&&active==='explore')render();
}).catch(e=>{
 indoorLoadError=String(e?.message||e);
 if(typeof active!=='undefined'&&active==='explore')render();
});
function mapFor(v){return v===5?MallV5:v===4?MallV4:v===3?MallV3:v===2?Mall:null}
function useWorld(v){
 const m=mapFor(v);
 WORLD.w=m?m.w:ORIGINAL_WORLD.w;WORLD.h=m?m.h:ORIGINAL_WORLD.h;
 WALLS.splice(0,WALLS.length,...(m?m.walls:ORIGINAL_WALLS));
}
function isFixedFacilityExit(){return run?.mapVersion>=4&&run.exitId===mapFor(run.mapVersion)?.fixedExit?.id}
function exitPoint(){
 if(run?.mapVersion>=3&&run.exitId){
  const m=mapFor(run.mapVersion);return m?.exitById(run.exitId)||m?.exit||{x:88,y:100};
 }
 return mapFor(run?.mapVersion)?.exit||{x:88,y:100};
}
const MAP_ITEM_ID='ITM-00901';
const INTERACT_RANGE=78; // R5.15: forgiving touch proximity; also used by HUD.
function hasDetailedMap(){
 if(run?.mapVersion===5)return true; // V5 facility floorplan is always available while raiding.
 return !!(run?.mapVersion>=3&&(
  run.loot?.some(row=>row.id===MAP_ITEM_ID)||
  gearItem('tool')?.it.id===MAP_ITEM_ID
 ));
}
// Existing normal/premium chest artworks only; no asset replacement.
const TYPES=['normal','premium'];
const DEFAULT_AREA='mall';
const MAP_PROFILES={
 mall:{name:'廃商業区',description:'日用品や宝飾品が見つかりやすい',groupWeights:{'現代・生活':3,'宝石・宝飾':2.7,'骨董・道具':1.1,'歴史・武具':.8,'神話・伝説':.65},floor:'#202d2c',grid:'#344640',wall:'#52605f'},
 factory:{name:'廃工場',description:'工具・機械・武器が見つかりやすい',groupWeights:{'現代・生活':2.3,'宝石・宝飾':.55,'骨董・道具':2.8,'歴史・武具':2.3,'神話・伝説':.65},floor:'#292e32',grid:'#3e4b4b',wall:'#5c686a'},
 ruins:{name:'旧遺構',description:'骨董品・歴史的武具・伝説の品が見つかりやすい',groupWeights:{'現代・生活':.55,'宝石・宝飾':1.7,'骨董・道具':2.0,'歴史・武具':2.6,'神話・伝説':2.1},floor:'#282c27',grid:'#414b3a',wall:'#626a56'}
};
// Weights are integer tenths of kg, separate from original gacha/market definitions.
const ITEM_WEIGHT_TENTHS={
 'ITM-00001':30,'ITM-00002':1,'ITM-00003':14,'ITM-00004':15,
 'ITM-00005':50,'ITM-00006':2,'ITM-00007':5,'ITM-00008':25,
 'ITM-00009':20,'ITM-00010':18,'ITM-00011':12,'ITM-00012':2,
 'ITM-00013':15,'ITM-00014':10,'ITM-00015':6,'ITM-00016':1,
 'ITM-00017':17,'ITM-00018':45,'ITM-00019':35,'ITM-00020':22,'ITM-00901':2
};
const weightTenths=id=>ITEM_WEIGHT_TENTHS[id]??Math.round((window.TreasureEquipmentPilot?.forItem(id)?.weight??1)*10);
const formatWeight=tenth=>(tenth/10).toFixed(1);
const BASE_WEIGHT_KG=12,BACKPACK_BONUS_KG=6;
function lootWeightTenths(loot){return (loot||[]).reduce((sum,row)=>sum+weightTenths(row.id),0)}
function carryTier(loot,limitKg){
 const overweight=lootWeightTenths(loot)-Math.round(limitKg*10);
 return overweight<=0?0:overweight<=20?1:2;
}
function carrySpeedFactor(loot,limitKg){
 // Only the integrated facility uses smooth encumbrance. Old maps preserve
 // their original 40% / 20% breakpoints and restored save behavior.
 if(run?.mapVersion<4)return [1,.4,.2][carryTier(loot,limitKg)];
 const weight=lootWeightTenths(loot),limit=Math.round(limitKg*10);
 const extraTenths=Math.max(0,weight-limit);
 if(run?.mapVersion===5){
  // R5.66: sprint freely below 70%, slow to 84% at nominal capacity,
  // then lose 12 percentage points per extra kilogram (35% minimum).
  // Kept V5-only; no loot/rarity/item save changes.
  const preLoad=Math.max(0,weight-limit*.70);
  const nearFull=Math.min(1,preLoad/Math.max(1,limit*.30));
  return Math.max(.35,1-.16*nearFull-.012*extraTenths);
 }
 return Math.max(.60,1-extraTenths*.006);
}
// R5.66: no RNG and no saved fields. All feedback derives from the current
// sealed loot, current capacity and actual movement speed multiplier.
function v5CargoRisk(loot=run?.loot||[],limitKg=run?.stats?.weightLimit||BASE_WEIGHT_KG){
 const weight=lootWeightTenths(loot),limit=Math.round(limitKg*10);
 const factor=carrySpeedFactor(loot,limitKg),pct=Math.round(factor*100);
 const over=Math.max(0,weight-limit),headroom=Math.max(0,limit-weight);
 const grade=pct>=90?'軽量':pct>=70?'注意':pct>=50?'重量過多':'危険な重量超過';
 return {weight,limit,over,headroom,pct,grade,
  text:grade+'・移動'+pct+'%'+(over?'・'+formatWeight(over)+'kg超過':'・残容量'+formatWeight(headroom)+'kg')};
}
// R5.71: optional hypothetical bag is preview-only. Never alter sealed loot.
function v5ReturnRisk(loot=run?.loot||[]){
 if(run?.mapVersion!==5)return null;
 const cargo=v5CargoRisk(loot),remainingSeconds=remaining();
 const speed=Math.max(1,run.stats.speed*TILED_BALANCE.playerSpeedFactor*cargo.pct/100);
 const straightSeconds=Math.ceil(distance(run.player,exitPoint())/speed);
 // This is only the physics lower bound, NOT a route ETA: doors, hatch,
 // patrols and detours can make the actual return much longer.
 const urgent=remainingSeconds<Math.max(75,straightSeconds*3);
 return {cargo,straightSeconds,remainingSeconds,urgent,
  text:'出口まで直線最短'+straightSeconds+'秒以上・残り'+Math.floor(remainingSeconds)+'秒'+
   (urgent?'／帰還を優先':'')};
}
function areaProfile(id){return MAP_PROFILES[id]||MAP_PROFILES[DEFAULT_AREA]}

// Enemy states are clocked by elapsed active-raid time; pause freezes AI and attacks.
const ENEMY_TYPES={
 normal:{name:'通常',hp:35,speed:46,detect:155,lose:245,leash:290,windup:.62,cooldown:1.50,recovery:.34,damage:9,range:26,radius:11},
 fast:{name:'高速',hp:23,speed:86,detect:175,lose:285,leash:350,windup:.38,cooldown:1.45,recovery:.55,damage:7,range:24,radius:10},
 heavy:{name:'重装',hp:94,speed:31,detect:145,lose:210,leash:220,windup:1.00,cooldown:2.35,recovery:.78,damage:20,range:39,radius:17}
};
// V4 facility tuning. Legacy V1–V3 sorties retain the old parameters.
const FACILITY_ENEMY_TYPES=Object.freeze({
 normal:{...ENEMY_TYPES.normal,hp:68,speed:68,chaseSpeed:142,detect:245,lose:520,leash:1080,visionHalfArc:Math.PI/3,windup:.58,cooldown:1.60,recovery:.46,damage:28,range:29},
 fast:{...ENEMY_TYPES.fast,hp:46,speed:105,chaseSpeed:166,detect:270,lose:590,leash:1250,visionHalfArc:Math.PI*165/360,windup:.43,cooldown:1.65,recovery:.72,damage:23,range:27},
 heavy:{...ENEMY_TYPES.heavy,hp:125,speed:43,chaseSpeed:110,detect:205,lose:430,leash:850,visionHalfArc:Math.PI*75/360,windup:1.12,cooldown:2.80,recovery:1.02,damage:36,range:44}
});
// R5.34: Apply the more dangerous, shorter-range profile only to the Tiled V5 map.
// V4's established combat contract stays unchanged for saved runs and regression tests.
// R5.53: only V5 changes. Existing V4 patrol/chase contracts stay intact.
const TILED_BALANCE=Object.freeze({
 noticeSeconds:.48, noticeDecay:2.5, closeAlertDistance:52,
 playerSpeedFactor:1.08, chaseMemory:2.4, searchDuration:6.4,
 trackingViewScale:1.35, trackingRangeScale:1.3, searchProbeDistance:58
});
const TILED_ENEMY_TYPES=Object.freeze({
 // R5.65: V5-only longer warning/recovery gives mobile players a fair chance
 // to dodge lethal melee. V3/V4 keep their historical profiles.
 // Normal sentries cannot indefinitely outrun an unencumbered player.
 normal:{...FACILITY_ENEMY_TYPES.normal,hp:92,damage:52,detect:155,lose:320,leash:690,chaseSpeed:126,windup:.76,cooldown:1.80,recovery:.56},
 // Fast sentries remain a threat; cover and corners are still important.
 fast:{...FACILITY_ENEMY_TYPES.fast,hp:68,damage:51,detect:170,lose:350,leash:760,chaseSpeed:146,windup:.57,cooldown:1.90,recovery:.74},
 heavy:{...FACILITY_ENEMY_TYPES.heavy,hp:175,damage:60,detect:135,lose:285,leash:600,chaseSpeed:100,windup:1.28,cooldown:3.00,recovery:1.10}
});
function enemyDefinition(kind){
 const types=run?.mapVersion===5?TILED_ENEMY_TYPES:run?.mapVersion>=4?FACILITY_ENEMY_TYPES:ENEMY_TYPES;
 return types[kind]||types.normal;
}
const ENEMY_CAP=12;
const ENEMY_WINDUP_CAP=2;
// R5.5c: a gentle early game and visible late danger, without guaranteed swarms.
function facilityThreatLevel(){
 if(!run||run.mapVersion<4)return 0;
 const start=mapFor(run.mapVersion)?.start||{x:340,y:2270};
 const dist=Math.hypot(run.player.x-start.x,run.player.y-start.y);
 const depth=run.mapVersion===5?(dist>=1250?3:dist>=850?2:dist>=420?1:0):(dist>=2250?3:dist>=1400?2:dist>=650?1:0);
 const loot=(run.loot||[]).length;
 const greed=loot>=16?3:loot>=8?2:loot>=3?1:0;
 return Math.max(depth,greed);
}
function liveEnemyCap(elapsed){
 // V5 uses authored sentries instead of an ever-growing random horde.
 if(run?.mapVersion===5)return run.vaultAlarm?7:5;
 if(run?.mapVersion>=4){
  // Exploration depth/loot still sets the base danger. A slow active-time
  // bonus ensures a stationary raider encounters additional patrols eventually.
  const timeBonus=elapsed>=210?2:elapsed>=90?1:0;
  return Math.min(11,[4,6,8,10][facilityThreatLevel()]+timeBonus);
 }
 return elapsed<45?4:elapsed<105?6:elapsed<170?8:10;
}
// Shared combat engine. Existing three weapon styles retain their exact parameters.
const Combat=window.TreasureCombatRules;
if(!Combat)throw new Error('combat-rules.js failed to load');
const affinityMultiplier=Combat.affinityMultiplier

// Semi-open layout: broad sightlines with scattered cover and two short partitions.
const WALLS=[
{x:228,y:92,w:85,h:45},{x:490,y:68,w:65,h:94},{x:735,y:122,w:90,h:42},
{x:135,y:313,w:88,h:45},{x:386,y:265,w:105,h:57},{x:670,y:330,w:75,h:85},
{x:255,y:531,w:80,h:42},{x:495,y:509,w:90,h:48},{x:764,y:557,w:83,h:49},
{x:330,y:174,w:12,h:90},{x:574,y:382,w:13,h:94}
];
// Old checkpoints can contain historical/modern types 1 and 2.
const LEGACY_CHEST_TYPES=[0,1,2,3,1,0,2,0,2,3,1,3];
const ORIGINAL_WALLS=WALLS.map(w=>({...w}));
const CHEST_SPOTS=[
[178,193,0],[369,191,0],[556,165,0],[838,202,3],
[270,390,0],[544,371,0],[776,405,0],[99,505,0],
[366,599,0],[592,606,3],[820,633,0],[62,653,3]
];
// Exactly seven worn slots. Old "charm" records are migrated by index.html.
const EQUIP_SLOTS=['weapon','weapon2','head','body','legs','accessory','tool'];
const SAFE_POUCH_CAP=2;
// Explicit slots supplied by the future equipment master take priority over name heuristics.
function equipmentMatches(it,slot,pattern){
 const declared=it.equipmentSlot||it.slot;
 if(typeof declared==='string'&&declared)return declared===slot||(slot==='weapon'&&declared==='weapon2');
 return pattern.test(String(it.category||'')+' '+String(it.name||''));
}
const WEAPON_NAME_MATCH=/武器|剣|刀|杖|フライパン|スコップ|村正|エクスカリバー|槍|バット|ナイフ|ヌンチャク|レンチ|ハンマー|チェーンソー|竹刀|物干し|チェーン|鞭|包丁|鎌|ボウガン|弓|ドリル|丸ノコ|警棒|トンファー|ノコギリ|斧|モップ|ほうき|釘打ち機/;
const GEAR_RULES={
 weapon:{name:'メイン武器',match:it=>equipmentMatches(it,'weapon',WEAPON_NAME_MATCH)},
 weapon2:{name:'サブ武器',match:it=>equipmentMatches(it,'weapon',WEAPON_NAME_MATCH)},
 head:{name:'頭防具',match:it=>equipmentMatches(it,'head',/冠|兜|ヘルメット|帽子|頭巾|マスク|面/)},
 body:{name:'胴防具',match:it=>equipmentMatches(it,'body',/鎧|装甲|防弾|胸当て|防具・胴|コート|ローブ|ジャケット|プロテクター|防護服|消防服/)},
 legs:{name:'脚防具',match:it=>equipmentMatches(it,'legs',/靴|ブーツ|脚甲|ズボン|レギンス|グリーブ|レガース|シューズ|垂/)},
 accessory:{name:'アクセサリー',match:it=>equipmentMatches(it,'accessory',/ペンダント|聖杯|護符|お守り|指輪|首飾り|ダイヤ|宝石|砂時計|天球儀/)},
 tool:{name:'探索道具',match:it=>equipmentMatches(it,'tool',/リュック|ロープ|方位磁石|ランタン|望遠鏡|道具・探検|道具・旅行|探知機|双眼鏡|懐中電灯|ドローン/)}
};
const WEAPON_STYLES=Combat.styles;
const weaponStyle=Combat.weaponStyle;
let run=null,raf=0,canvas=null,ctx=null,lastFrame=0,lastHud=0,lastCheckpointAt=0;
let pauseVisualDirty=true;
// R5.69b: local diagnostics split slow frames before/after vault alarm.
const perf={windowStart:0,frames:0,fps:0,slow:0,alarmFrames:0,alarmSlow:0};
function sampleFrame(ts,rawMs){
 if(!run||run.paused)return;
 if(!perf.windowStart)perf.windowStart=ts;
 perf.frames++;
 if(rawMs>=40&&rawMs<250)perf.slow++;
 if(run.mapVersion===5&&run.vaultAlarm&&rawMs>0&&rawMs<250){
  perf.alarmFrames++;
  if(rawMs>=40)perf.alarmSlow++;
 }
 if(ts-perf.windowStart>=1100){
  perf.fps=Math.round(perf.frames*1000/(ts-perf.windowStart));
  perf.frames=0;perf.windowStart=ts;
 }
}
const keys=new Set(),images={};
const stickVisual={thumb:null,x:0,y:0,targetX:0,targetY:0,range:32,active:false,release:null};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function gearItem(kind,equip=state.exploreEquip){
 const uid=equip&&equip[kind];
 const entry=state.inv.find(v=>v.uid===uid);
 const it=entry?item(entry.id):null;
 return entry&&it&&GEAR_RULES[kind].match(it)?{it,entry}:null;
}
function gearCandidates(kind){
 return state.inv.filter(row=>{const it=item(row.id);return it&&GEAR_RULES[kind].match(it)}).slice(-120).reverse();
}
function pilotDefinition(g){return g&&window.TreasureEquipmentPilot?.forItem(g.it.id)||null}
function gearStats(equip=state.exploreEquip){
 const gear=Object.fromEntries(EQUIP_SLOTS.map(kind=>[kind,gearItem(kind,equip)]));
 const bonus=g=>g?RARITY.indexOf(g.it.rarity)*3+g.entry.q*2+4:0;
 const legacy=g=>pilotDefinition(g)||g?.it.id===MAP_ITEM_ID?0:bonus(g);
 const qualityBonus=[.95,1,1.07,1.15];
 const profile=g=>{
  if(!g)return {uid:0,name:'素手',style:'unarmed',attack:14};
  const pilot=pilotDefinition(g);
  if(!pilot)return {uid:g.entry.uid,name:g.it.name,style:weaponStyle(g.it),attack:18+bonus(g)};
  const quality=qualityBonus[clamp(Number(g.entry.q)||0,0,3)];
  return {
   uid:g.entry.uid,name:g.it.name,style:pilot.style,
   attack:clamp(Math.round(pilot.attack*quality),1,150),
   pattern:{range:pilot.range,arc:pilot.arc,cooldown:pilot.interval,maxTargets:pilot.targets},
   effect:pilot.effect,chance:pilot.chance,effectAmount:pilot.effectAmount
  };
 };
 const main=gear.weapon,secondary=gear.weapon2&&gear.weapon2.entry.uid!==main?.entry.uid?gear.weapon2:null;
 const accessories=bonus(gear.accessory);
 const weapons=[profile(main),profile(secondary)];
 for(const weapon of weapons)weapon.attack+=Math.round(accessories*.18);
 const pilots=EQUIP_SLOTS.map(k=>pilotDefinition(gear[k])).filter(Boolean);
 const v2=pilots.length>0;
 const armor=['head','body','legs'].map(k=>pilotDefinition(gear[k])).filter(Boolean);
 const resistance={};
 for(const piece of armor){
  if(piece.resist!=='none')resistance[piece.resist]=Math.max(resistance[piece.resist]||0,piece.resistPct);
 }
 const legacyHp=Math.round(legacy(gear.head)*1.7+legacy(gear.body)*1.25+legacy(gear.accessory)*1.5);
 const legacyDefense=Math.round(legacy(gear.body)*.28+legacy(gear.head)*.08+legacy(gear.legs)*.06);
 const pilotTool=pilotDefinition(gear.tool),legacyBackpack=gear.tool&&!pilotTool&&/リュック/.test(gear.tool.it.name);
 const carry=pilotTool?pilotTool.carry:(legacyBackpack?BACKPACK_BONUS_KG:0);
 const result={
  attack:weapons[0].attack,weapons,
  speed:118+legacy(gear.tool)*.6+legacy(gear.legs)*1.1+pilots.reduce((n,p)=>n+p.speed,0),
  maxHp:100+legacyHp+pilots.reduce((n,p)=>n+p.hp,0),
  defense:legacyDefense+armor.reduce((n,p)=>n+p.defense,0),
  capacity:6+((pilotTool&&pilotTool.carry>0)||legacyBackpack?2:0),
  weightLimit:BASE_WEIGHT_KG+carry
 };
 if(v2){
  result.combatRulesVersion=2;
  result.maxHp=Math.min(250,result.maxHp);
  result.defense=Math.min(20,result.defense);
  result.speed=Math.max(1,Math.min(190,result.speed));
  result.weightLimit=Math.min(30,result.weightLimit);
  result.resists=resistance;
 }else result.defense=Math.min(12,result.defense);
 return result;
}
function equippedUids(equip=state.exploreEquip){
 return [...new Set(EQUIP_SLOTS.map(k=>Number(equip?.[k])||0).filter(uid=>uid>0&&state.inv.some(row=>row.uid===uid)))];
}
function duplicateEquipmentUid(equip){
 const uids=EQUIP_SLOTS.map(k=>Number(equip?.[k])||0).filter(v=>v>0);
 return new Set(uids).size!==uids.length;
}
function weaponProfile(slot=0){
 const gear=run&&run.stats&&run.stats.weapons;
 return gear&&gear[slot]&&WEAPON_STYLES[gear[slot].style]?gear[slot]:{uid:0,name:'素手',style:'unarmed',attack:14};
}
function escapeHTML(s){return esc(String(s))}
function gearSelect(kind){
 const chosen=gearItem(kind),opts=gearCandidates(kind),reserved=new Set();
 for(const k of EQUIP_SLOTS)if(k!==kind&&state.exploreEquip?.[k])reserved.add(Number(state.exploreEquip[k]));
 return '<label class="exp-equip"><span>'+GEAR_RULES[kind].name+'</span><select data-exp-gear="'+kind+'" aria-label="'+GEAR_RULES[kind].name+'">'+
 '<option value="0">装備なし'+(['weapon','weapon2'].includes(kind)?'（素手）':'')+'</option>'+
 opts.map(row=>{
  const it=item(row.id),type=['weapon','weapon2'].includes(kind)?' / '+WEAPON_STYLES[weaponStyle(it)].name:'';
  const blocked=reserved.has(row.uid)||!!row.locked;
  return '<option value="'+row.uid+'"'+(chosen&&chosen.entry.uid===row.uid?' selected':'')+
   (blocked?' disabled':'')+'>'+escapeHTML(it.name)+type+' / '+escapeHTML(it.rarity)+' / '+QNAME[row.q]+
   (row.locked?'（保護中・出撃不可）':'')+'</option>';
 }).join('')+
 '</select>'+(()=>{
  const p=pilotDefinition(chosen);
  if(chosen?.it.id===MAP_ITEM_ID)return '<small class="exp-equip-stats">詳細地図を表示（出撃装備・ロスト対象）</small>';
  if(!p)return '';
  const role=window.TreasureEquipmentPilot?.roleFor(chosen.it.id)||'';
  let info;
  if(p.slot==='weapon'){
   const active=gearStats().weapons[kind==='weapon2'?1:0];
   const pattern=active.pattern||WEAPON_STYLES[active.style];
   const normalDps=(Combat.hitDamage(active.attack,active.style,'normal')/pattern.cooldown).toFixed(1);
   const effects={bleed:'出血',stagger:'短時間の鈍足',slow:'鈍足',shock:'感電',
    armor_bonus:'重装特効',pierce:'重装貫通'};
   const effect=effects[active.effect]||'';
   info='威力 '+active.attack+' · 間隔 '+pattern.cooldown.toFixed(2)+'秒 · 射程 '+pattern.range+
    'px · '+pattern.maxTargets+'体 · 対通常型 '+normalDps+'/秒（状態異常を除く）'+
    (effect?' · '+effect+(active.chance>0&&active.chance<1?' '+Math.round(active.chance*100)+'%':''):'');
  }else{
   info='防御 +'+p.defense+' · HP +'+p.hp+' · 速度 '+(p.speed>=0?'+':'')+p.speed+
    (p.carry?' · 運搬 +'+p.carry+'kg':'');
   if(p.resist==='frontal')info+=' · 正面軽減 '+p.resistPct+'%（重複時最大）';
   if(p.resist==='melee')info+=' · 近接軽減 '+p.resistPct+'%（重複時最大）';
   if(p.resist==='fire')info+=' · 耐火（現施設では未使用）';
  }
  return '<small class="exp-equip-stats">'+escapeHTML(info)+'</small>'+
   (role?'<small class="exp-equip-stats">'+escapeHTML('用途：'+role)+'</small>':'');
 })()+'</label>';
}
function gearGrid(){return EQUIP_SLOTS.map(gearSelect).join('')}
function areaPicker(){
 const selected=MAP_PROFILES[state.exploreArea]?state.exploreArea:DEFAULT_AREA;
 return '<div class="exp-area-picker"><h2>探索区域とドロップ傾向</h2>'+
  '<select data-exp-area aria-label="探索する区域を選ぶ">'+
  Object.entries(MAP_PROFILES).map(([key,p])=>
   '<option value="'+key+'"'+(selected===key?' selected':'')+'>'+p.name+' — '+p.description+'</option>'
  ).join('')+'</select>'+
  '<p><strong>新規出撃は下の地形切替から屋内ドット絵版・従来の一体型施設を選べます。</strong>区域選択では入手できる戦利品の傾向だけが変化します。旧途中セーブは旧地形のまま再開されます。</p></div>';
}
function itemWeightLine(it){
 return formatWeight(weightTenths(it.id))+'kg ・ 売却基準 '+(Number(it.base)||0).toLocaleString('ja-JP');
}
function weightLabel(){
 const weight=lootWeightTenths(run.loot),limit=run.stats.weightLimit;
 const tier=carryTier(run.loot,limit),pct=Math.round(carrySpeedFactor(run.loot,limit)*100);
 return {weight,limit,tier,pct,text:formatWeight(weight)+' / '+limit.toFixed(1)+'kg'};
}
// R5.55: sale reference value, not a promise of actual selling price.
// The original saved {id,q,tid} item rows remain unchanged.
function lootBaseValue(reward){return Math.max(0,Math.round(Number(item(reward.id)?.base)||0))}
function lootBaseTotal(rows){return (rows||[]).reduce((sum,v)=>sum+lootBaseValue(v),0)}
function lootCurrency(value){return Math.max(0,Math.round(value)).toLocaleString('ja-JP')}
function lootSummary(){
 const safe=new Set(run?.safeIds||[]),rows=run?.loot||[];
 const protectedRows=rows.filter(v=>safe.has(v.tid));
 return {total:lootBaseTotal(rows),secured:lootBaseTotal(protectedRows),
  weight:lootWeightTenths(rows),protectedCount:protectedRows.length};
}
// R5.72: information-only escape stakes. No new RNG, enemy behavior or save fields.
function v5ExtractionStakes(){
 if(run?.mapVersion!==5)return null;
 const safe=new Set(run.safeIds||[]);
 const rare=(run.loot||[]).filter(v=>['SSR','UR','EX'].includes(item(v.id)?.rarity));
 const unsecured=rare.filter(v=>!safe.has(v.tid));
 const protectedRare=rare.length-unsecured.length;
 const exposedValue=lootBaseTotal(unsecured);
 const route=run.vaultHatchUsed?vaultLayout()?.escapeRoute:null;
 let progress=null;
 if(route?.length>1){
  let nearest=0,best=Infinity;
  for(let i=0;i<route.length;i++){
   const d=(route[i].x-run.player.x)**2+(route[i].y-run.player.y)**2;
   if(d<best){best=d;nearest=i}
  }
  // A and B share an authored route trunk. This is a POSITION GUIDE only,
  // not a safe ETA, obstacle-free path or an estimate of guard encounters.
  progress=Math.round(nearest/(route.length-1)*100);
 }
 return {unsecuredCount:unsecured.length,protectedRare,exposedValue,
  pouchFree:Math.max(0,SAFE_POUCH_CAP-safe.size),progress};
}
function lootOrder(){
 if(!run)return [];
 const mode=run.lootSort||'value';
 return run.loot.map((v,i)=>({v,i})).sort((a,b)=>{
  if(mode==='recent')return b.i-a.i;
  if(mode==='weight')return weightTenths(b.v.id)-weightTenths(a.v.id)||lootBaseValue(b.v)-lootBaseValue(a.v)||a.i-b.i;
  const av=lootBaseValue(a.v)/Math.max(1,weightTenths(a.v.id));
  const bv=lootBaseValue(b.v)/Math.max(1,weightTenths(b.v.id));
  return bv-av||lootBaseValue(b.v)-lootBaseValue(a.v)||a.i-b.i;
 });
}
function lootSortControls(){
 if(run?.mapVersion!==5)return '';
 const mode=run.lootSort||'value';
 return '<div class="exp-loot-sort" role="group" aria-label="戦利品の並べ替え">'+
  [['value','価値/kg順'],['weight','重い順'],['recent','入手順']].map(([id,label])=>
   '<button type="button" data-explore="bag-sort" data-sort="'+id+'" aria-pressed="'+(mode===id)+'">'+label+'</button>').join('')+'</div>';
}
function lootAutoProtectButton(){
 if(run?.mapVersion!==5)return '';
 const available=Math.max(0,SAFE_POUCH_CAP-(run.safeIds||[]).length);
 return '<button type="button" class="exp-auto-protect" data-explore="auto-protect"'+(available?'':' disabled')+'>'+
  '🔒 空き枠に高額品を保護'+(available?'（残り'+available+'）':'（満杯）')+'</button>';
}
function lootRowsV5(){
 const protectedIds=new Set(run.safeIds||[]);
 return lootOrder().map(({v,i})=>{
  const it=item(v.id),safe=protectedIds.has(v.tid),value=lootBaseValue(v),weight=weightTenths(v.id);
  const density=weight>0?lootCurrency(value/(weight/10)):'—';
  return '<div class="exp-loot-item exp-loot-valued'+(safe?' exp-protected':'')+'">'+
   '<img src="'+it.image+'" alt=""><span><b>'+escapeHTML(it.name)+'</b>'+
   '<small>'+escapeHTML(it.rarity)+'・'+QNAME[v.q]+' ／ '+formatWeight(weight)+'kg</small>'+
   '<small>売却基準 '+lootCurrency(value)+' ／ 価値/kg '+density+'</small></span>'+
   '<button type="button" class="exp-safe-toggle" data-explore="protect" data-i="'+i+'" aria-pressed="'+safe+'" aria-label="'+escapeHTML(it.name)+(safe?'の保護を解除':'を安全ポーチに保護')+'">'+(safe?'🔒':'保護')+'</button>'+
   '<button type="button" data-explore="drop" data-i="'+i+'" aria-label="'+escapeHTML(it.name)+'を捨てる">×</button></div>';
 }).join('')||'<p>まだ戦利品はありません</p>';
}

// R5.8: four approved, corner-bracket-free sprites in one transparent WebP.
 // Atlas coordinates: wood closed(0,0) / open(0,96);
 // iron closed(96,0) / open(96,96). The box base remains bottom-aligned.
const CHEST_ATLAS_SRC='assets/exploration/chest_atlas_r58.webp';
const CHEST_SPRITE_SIZE=96;
function chestAsset(){return CHEST_ATLAS_SRC}
function preload(){
 if(images[CHEST_ATLAS_SRC])return;
 const img=new Image();img.src=CHEST_ATLAS_SRC;images[CHEST_ATLAS_SRC]=img;
}
function pickWeighted(rows,weight){
 let total=0;
 for(const row of rows)total+=Math.max(0,weight(row));
 if(total<=0)return rows[0]||null;
 let roll=Math.random()*total;
 for(const row of rows){roll-=Math.max(0,weight(row));if(roll<0)return row}
 return rows[rows.length-1]||null;
}
function chooseLoot(type,areaId=DEFAULT_AREA){
 const weights=[4300,2800,1700,900,245,50,5];
 let tier=pickWeighted(weights.map((_,i)=>i),i=>weights[i]);
 if(!Number.isInteger(tier))tier=0;
 const rarity=RARITY[clamp(tier+(type===3?1:0),0,RARITY.length-1)];
 let pool=ITEMS.filter(it=>it.rarity===rarity);
 if(!pool.length)pool=ITEMS;
 const area=areaProfile(areaId);
 const picked=pickWeighted(pool,it=>area.groupWeights[it.group]||1);
 return {id:picked.id,q:quality(picked.rarity)};
}
// R5.54: risk/reward is tied to the authored V5 supply grade, not merely the
// graphical chest model. Yellow still has an exceptionally rare UR jackpot;
// violet vaults are lucrative on average, but SSR+ is never guaranteed.
// Order: N, C, R, SR, SSR, UR, EX. Each profile totals 1000.
const V5_SUPPLY_WEIGHTS=Object.freeze({
 standard:Object.freeze([490,310,150,37,11,2,0]),
 mid:Object.freeze([220,310,260,158,46,6,0]),
 high:Object.freeze([55,115,210,340,225,52,3]),
 ultra:Object.freeze([20,45,100,280,350,170,35])
});
function v5SsrPlusPercent(tier){
 const weights=V5_SUPPLY_WEIGHTS[tier]||V5_SUPPLY_WEIGHTS.standard;
 // Round at one decimal place so odds shown in the map match stable test/UI text.
 return Math.round(weights.slice(4).reduce((sum,v)=>sum+v,0)/weights.reduce((sum,v)=>sum+v,0)*1000)/10;
}
// New mall loot is sealed before the sortie checkpoint, never on opening.
function containerReward(kind,theme,supplyTier,mapVersion=4){
 const all={
  shelf:[480,320,170,27,3,0,0],locker:[360,320,240,65,13,2,0],
  crate:[400,330,200,58,10,2,0],register:[420,310,210,52,7,1,0],
  wood:[240,270,310,140,35,5,0],iron:[100,160,290,335,95,19,1],
  safe:[65,130,255,365,145,38,2]
 };
 // Preserve V4's existing drop tables. Only V5 uses the authored
 // yellow/blue/violet risk ladder, regardless of shelf/locker/safe artwork.
 let weights=mapVersion===5?
  (V5_SUPPLY_WEIGHTS[supplyTier]||V5_SUPPLY_WEIGHTS.standard):all[kind];
 if(mapVersion!==5&&supplyTier==='mid'&&(kind==='iron'||kind==='safe')){
  // Nearer iron caches are blue, not guaranteed violet-class vaults.
  weights=[255,300,290,125,25,5,0];
 }else if(mapVersion!==5&&supplyTier==='standard'){
  // Even yellow supplies retain a tiny UR jackpot chance.
  weights=weights.map((v,i)=>i===5?Math.max(1,v):v);
 }
 const tier=pickWeighted(weights.map((_,i)=>i),i=>weights[i]);
 const pool=ITEMS.filter(it=>it.rarity===RARITY[tier]);
 const themes={sports:/バット|竹刀|木刀|スポーツ|シューズ|防具/,
  hardware:/ハンマー|レンチ|チェーンソー|スコップ|チェーン|工具/,
  clinic:/薬|医療|包帯|マスク/,jewelry:/宝石|ダイヤ|指輪|ペンダント|冠|金/,
  food:/缶詰|フライパン|食品|調理/,appliance:/家電|電動|炊飯器/,
  office:/時計|紙|ロープ/,storage:/リュック|工具|ロープ/};
 const regex=themes[theme],picked=pickWeighted(pool.length?pool:ITEMS,it=>regex&&regex.test(it.name+' '+it.category)?4:1);
 return {id:picked.id,q:quality(picked.rarity)};
}
function createMallContainers(layout){
 const mapVersion=layout===MallV5?5:4;
 return layout.rollContainers().map(c=>{
  const spec=layout.types[c.kind],n=spec.min+Math.floor(Math.random()*(spec.max-spec.min+1));
  const tier=layout.supplyTierForContainer?layout.supplyTierForContainer(c):undefined;
  return {...c,contents:Array.from({length:n},()=>containerReward(c.kind,c.theme,tier,mapVersion))};
 });
}
function nearContainer(){return (run?.containers||[]).filter(c=>c.contents.length&&distance(c,run.player)<INTERACT_RANGE&&
  (run.mapVersion!==5||canSeeBetween(run.player,c))).sort((a,b)=>distance(a,run.player)-distance(b,run.player))[0]||null}
// R5.56: the keycard and emergency hatch are authored Tiled map interactions,
// independent of random loot, and persist across checkpoint restores.
function vaultLayout(){return run?.mapVersion===5?mapFor(5):null}
function nearVaultKeycard(){
 const key=vaultLayout()?.vaultKeycard;
 return key&&!run.hasKeycard&&distance(key,run.player)<INTERACT_RANGE?key:null;
}
function nearVaultGate(){
 const gate=vaultLayout()?.vaultGate;
 return gate&&distance(gate,run.player)<INTERACT_RANGE?gate:null;
}
function nearVaultHatch(){
 const hatch=vaultLayout()?.vaultHatch;
 return hatch&&!run.vaultHatchUsed&&distance(hatch,run.player)<INTERACT_RANGE?hatch:null;
}
function useVaultInteraction(){
 if(run?.mapVersion!==5||run.paused||run.status!=='playing')return false;
 const key=nearVaultKeycard();
 if(key){
  run.hasKeycard=true;
  notify('🔑マスターカードキーを入手！右下の最上位金庫へ向かおう');
  saveRunCheckpoint(true);updateHUD(true);return true;
 }
 const hatch=nearVaultHatch();
 if(hatch){
  if(!run.vaultSealed){notify('非常ハッチは最上位金庫への入場後に利用できます');return true}
  run.vaultHatchUsed=true;run.vaultAlarm=true;
  run.player.x=hatch.landing.x;run.player.y=hatch.landing.y;
  // R5.57: escape side passages seal only after this one-way hatch is used.
  run.joy={x:0,y:0};run.steer={x:0,y:0};
  // Older checkpoints can predate the new alarm-only guard posts.
  for(const post of vaultLayout().guardPosts.filter(p=>p.alarmOnly)){
   if(!run.pendingGuardPosts.includes(post.id)&&
    !run.enemies.some(e=>Math.hypot(e.homeX-post.x,e.homeY-post.y)<4))run.pendingGuardPosts.push(post.id);
  }
  activateFacilityGuardPosts();
  notify(run.escapeVariant==='cover'?'🚨警報！帰還通路に隠れ場所あり。警備をかいくぐれ！':'🚨警報！完全一本道の警備通路を突破して脱出せよ！');
  saveRunCheckpoint(true);updateHUD(true);return true;
 }
 const gate=nearVaultGate();
 if(gate){
  if(run.vaultSealed){notify('⛔入場した扉は完全封鎖。金庫室の非常ハッチを使ってください');return true}
  if(!run.hasKeycard){notify('🔒カードキーが必要。中央の警備室に保管されています');return true}
  if(!run.vaultUnlocked){
   run.vaultUnlocked=true;
   notify('🔓カード認証成功。通過すると入口が閉まります');
   saveRunCheckpoint(true);
  }else notify('扉は開いています。通過すると封鎖されます');
  updateHUD(true);return true;
 }
 return false;
}
function sealVaultOnEntry(){
 if(run?.mapVersion!==5||!run.vaultUnlocked||run.vaultSealed)return;
 const gate=vaultLayout()?.vaultGate;
 if(!gate)return;
 if(run.player.x>gate.x+gate.tileSize/2+12 &&
  Math.abs(run.player.y-gate.y)<gate.tileSize*1.5){
  run.vaultEntered=true;run.vaultSealed=true;
  notify('⛔金庫入口が閉鎖！帰還は東側の非常ハッチから');
  saveRunCheckpoint(true);
 }
}
// R5.4: a small checkpoint is stored in the same IndexedDB metadata as the merchant save.
// The final claim and the claim marker are committed atomically in bank().
const CHECKPOINT_INTERVAL_MS=3000;
function rewardValid(v){
 return !!(v&&ITEM_BY_ID.has(v.id)&&Number.isInteger(v.q)&&v.q>=0&&v.q<QNAME.length);
}
function pointValid(v,w=WORLD.w,h=WORLD.h){
 return !!(v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&v.x>=0&&v.y>=0&&v.x<=w&&v.y<=h);
}
function directionValid(v){return !!(v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Math.hypot(v.x,v.y)>.01&&Math.hypot(v.x,v.y)<1.1)}
function validCheckpoint(c){
 if(!c||c.v!==1||c.status!=='playing'||typeof c.id!=='string'||c.id.length>96||!c.id)return false;
 if(!Number.isFinite(c.remaining)||c.remaining<0||c.remaining>(c.mapVersion>=4?FACILITY_DURATION:DURATION))return false;
 if(c.mapVersion>=4&&c.timeLimitVersion!==undefined&&c.timeLimitVersion!==1)return false;
 const layout=mapFor(c.mapVersion),indoor=c.mapVersion>=2&&c.mapVersion<=5;
 if(c.mapVersion!==undefined&&c.mapVersion!==2&&c.mapVersion!==3&&c.mapVersion!==4&&c.mapVersion!==5)return false;
 if(indoor&&(!layout||!layout.validContainers(c.containers,rewardValid)))return false;
 if(c.mapVersion>=3&&(!Number.isFinite(c.elapsedSeconds)||c.elapsedSeconds<0||c.elapsedSeconds>86400||
   (c.visitedRooms!==undefined&&(!Array.isArray(c.visitedRooms)||c.visitedRooms.length>layout.rooms.length||
    new Set(c.visitedRooms).size!==c.visitedRooms.length||
    !c.visitedRooms.every(i=>Number.isInteger(i)&&i>=0&&i<layout.rooms.length)))))return false;
 if(c.mapVersion>=3&&c.exitId!==undefined&&(!layout?.exitById(c.exitId)))return false;
 if(c.mapVersion>=4&&c.pendingGuardPosts!==undefined){
  const allowed=new Set(layout?.guardPosts?.map(p=>p.id)||[]);
  if(!Array.isArray(c.pendingGuardPosts)||c.pendingGuardPosts.length>allowed.size||
   new Set(c.pendingGuardPosts).size!==c.pendingGuardPosts.length||
   !c.pendingGuardPosts.every(id=>typeof id==='string'&&allowed.has(id)))return false;
 }
 if(c.mapVersion===5){
  const bools=['hasKeycard','vaultUnlocked','vaultEntered','vaultSealed','vaultHatchUsed','vaultAlarm'];
  if(bools.some(name=>c[name]!==undefined&&typeof c[name]!=='boolean'))return false;
  if(c.escapeVariant!==undefined&&!['strict','cover'].includes(c.escapeVariant))return false;
  if(c.vaultSealed&&!c.vaultUnlocked)return false;
  if(c.vaultHatchUsed&&!c.vaultSealed)return false;
  if(c.vaultAlarm&&!c.vaultHatchUsed)return false;
 }
 const bounds=layout||ORIGINAL_WORLD;
 if(!pointValid(c.player,bounds.w,bounds.h)||!Number.isFinite(c.player.hp)||c.player.hp<=0||!c.stats||c.stats.maxHp<1||c.stats.maxHp>5000)return false;
 if(!['attack','speed','capacity'].every(k=>Number.isFinite(c.stats[k])&&c.stats[k]>=0)||c.stats.capacity>50)return false;
 if(c.stats.weightLimit!==undefined&&(!Number.isFinite(c.stats.weightLimit)||c.stats.weightLimit<1||c.stats.weightLimit>100))return false;
 if(c.area!==undefined&&!Object.prototype.hasOwnProperty.call(MAP_PROFILES,c.area))return false;
 if(c.stats.weapons!==undefined&&(!Array.isArray(c.stats.weapons)||c.stats.weapons.length!==2||!c.stats.weapons.every(w=>w&&Number.isSafeInteger(w.uid)&&w.uid>=0&&typeof w.name==='string'&&w.name.length<=100&&Object.prototype.hasOwnProperty.call(WEAPON_STYLES,w.style)&&Number.isFinite(w.attack)&&w.attack>=0&&w.attack<=5000)))return false;
 if(indoor){if(!Array.isArray(c.chests)||c.chests.length!==0)return false}
 else if(!Array.isArray(c.chests)||c.chests.length!==CHEST_SPOTS.length||!c.chests.every((v,i)=>v&&v.i===i&&v.x===CHEST_SPOTS[i][0]&&v.y===CHEST_SPOTS[i][1]&&(v.type===CHEST_SPOTS[i][2]||v.type===LEGACY_CHEST_TYPES[i])&&typeof v.opened==='boolean'&&(v.ticket===undefined||typeof v.ticket==='boolean')&&rewardValid(v.reward)))return false;
 if(!Array.isArray(c.enemies)||c.enemies.length>20||!c.enemies.every(v=>pointValid(v,bounds.w,bounds.h)&&Number.isFinite(v.hp)&&v.hp>0&&v.hp<=1000&&(!v.kind||Object.prototype.hasOwnProperty.call(ENEMY_TYPES,v.kind))))return false;
 if(!Array.isArray(c.loot)||c.loot.length>(indoor?250:CHEST_SPOTS.length)||!c.loot.every(rewardValid))return false;
 const lootTokens=c.loot.map((row,i)=>row.tid===undefined?i+1:row.tid);
 if(lootTokens.some(tid=>!Number.isSafeInteger(tid)||tid<1)||new Set(lootTokens).size!==lootTokens.length)return false;
 if(c.riskUids!==undefined&&(!Array.isArray(c.riskUids)||c.riskUids.length>100||
  new Set(c.riskUids).size!==c.riskUids.length||
  !c.riskUids.every(uid=>Number.isSafeInteger(uid)&&uid>0)))return false;
 if(c.safeIds!==undefined&&(!Array.isArray(c.safeIds)||c.safeIds.length>SAFE_POUCH_CAP||
  new Set(c.safeIds).size!==c.safeIds.length||
  !c.safeIds.every(tid=>Number.isSafeInteger(tid)&&tid>0&&c.loot.some((row,i)=>(row.tid||i+1)===tid))))return false;
 if(c.lootSerial!==undefined&&(!Number.isSafeInteger(c.lootSerial)||c.lootSerial<1||c.lootSerial>1000))return false;
 if(!Number.isInteger(c.tickets)||c.tickets<0||c.tickets>1000)return false;
 if(!Number.isFinite(c.spawnAt)||!Number.isFinite(c.attackAt)||!Number.isInteger(c.weaponSlot)||![0,1].includes(c.weaponSlot))return false;
 return true;
}
function snapshotRun(){
 if(!run||run.status!=='playing')return null;
 return {
  v:1,status:'playing',id:run.id,area:run.area||DEFAULT_AREA,mapVersion:run.mapVersion>=2?run.mapVersion:undefined,
   containers:run.mapVersion>=2?run.containers.map(c=>({...c,contents:c.contents.map(v=>({...v}))})):undefined,
   elapsedSeconds:run.mapVersion>=3?raidElapsed():undefined,
   timeLimitVersion:run.mapVersion>=4?1:undefined,
   visitedRooms:run.mapVersion>=3?[...(run.visitedRooms||[])]:undefined,
   exitId:run.mapVersion>=3?run.exitId:undefined,
   pendingGuardPosts:run.mapVersion>=4?[...run.pendingGuardPosts]:undefined,
   savedAt:Date.now(),remaining:remaining(),
  player:{...run.player},stats:{...run.stats},
  chests:run.chests.map(c=>({...c,reward:{...c.reward}})),
  enemies:run.enemies.map(e=>({...e})),loot:run.loot.map(v=>({...v})),
  tickets:run.tickets,kills:run.kills,spawnAt:run.spawnAt,attackAt:run.attackAt,
  autoAttack:run.autoAttack,weaponSlot:run.weaponSlot,facing:{...run.facing},
  hasKeycard:run.mapVersion===5?!!run.hasKeycard:undefined,
  vaultUnlocked:run.mapVersion===5?!!run.vaultUnlocked:undefined,
  vaultEntered:run.mapVersion===5?!!run.vaultEntered:undefined,
  vaultSealed:run.mapVersion===5?!!run.vaultSealed:undefined,
  vaultHatchUsed:run.mapVersion===5?!!run.vaultHatchUsed:undefined,
  vaultAlarm:run.mapVersion===5?!!run.vaultAlarm:undefined,
  escapeVariant:run.mapVersion===5?run.escapeVariant:undefined,
  riskUids:[...(run.riskUids||[])],safeIds:[...(run.safeIds||[])],lootSerial:run.lootSerial||1
 };
}
function stageRunCheckpoint(){
 if(run&&run.status==='playing')state.exploreRun=snapshotRun();
}
function saveRunCheckpoint(force=false){
 if(!run||run.status!=='playing'||!storageReady||actionPersisting)return;
 const now=Date.now();
 if(!force&&now-lastCheckpointAt<CHECKPOINT_INTERVAL_MS)return;
 lastCheckpointAt=now;
 stageRunCheckpoint();
 save();
}
// Keep active V5 prototype saves intact when the authored caches move.
// Never re-roll sealed contents or the user's protected/collected inventory.
function reconcileIndoorCheckpoint(c){
 const layout=mapFor(5);
 if(!layout||!Array.isArray(c.containers))return;
 const current=new Map(layout.authoredContainers.map(o=>[o.id,o]));
 if(c.containers.length===current.size&&c.containers.every(o=>current.has(o?.id))){
  c.containers=c.containers.map(old=>{
   const latest=current.get(old.id);
   return {...old,x:latest.x,y:latest.y,kind:latest.kind,room:latest.room,
    theme:latest.theme,tier:latest.tier};
  });
 }
 const keys=['hasKeycard','vaultUnlocked','vaultEntered','vaultSealed','vaultHatchUsed','vaultAlarm'];
 for(const key of keys)if(c[key]===undefined)c[key]=false;
 if(!['strict','cover'].includes(c.escapeVariant))c.escapeVariant='strict'; // migration, no re-roll
 const gate=layout.vaultGate;
 // Previous map saves can place a player inside what is now a sealed vault.
 // Grant the required state instead of trapping or deleting their old raid.
 if(gate&&c.player?.x>gate.x+gate.tileSize/2+12&&
    c.player.y>=29*gate.tileSize&&c.player.y<36*gate.tileSize){
  c.hasKeycard=true;c.vaultUnlocked=true;c.vaultEntered=true;c.vaultSealed=true;
 }
}
function restoreRunIfNeeded(){
 if(run||!storageReady)return;
 const c=state.exploreRun;
 if(!c)return;
 // Wait for Tiled before validating V5 checkpoint: never erase it during loading.
 if(c.mapVersion===5&&!MallV5)return;
 if(c.mapVersion===5)reconcileIndoorCheckpoint(c);
 if(!validCheckpoint(c)){
  // Invalid or already claimed checkpoints are never credited or resumed.
  state.exploreRun=null;save();return;
 }
 const now=Date.now();
 // Unlimited-era V4 checkpoints may have elapsed for hours; grant at least
 // two minutes on their first migration without resetting new timed saves.
 const resumeElapsed=c.mapVersion>=4&&c.timeLimitVersion!==1?
  Math.min(c.elapsedSeconds,FACILITY_DURATION-120):c.elapsedSeconds;
 useWorld(c.mapVersion||1);
 run={
  mapVersion:c.mapVersion||1,containers:c.mapVersion>=2?c.containers.map(v=>({...v,contents:v.contents.map(p=>({...p}))})):[],
  lootOpenId:null,showMap:false,mapDirect:false,exitId:c.mapVersion>=3?c.exitId:undefined,
   pendingGuardPosts:c.mapVersion>=4?(Array.isArray(c.pendingGuardPosts)?
    c.pendingGuardPosts.slice():mapFor(c.mapVersion).guardPosts.map(p=>p.id)):[],
   visitedRooms:c.mapVersion>=3?(Array.isArray(c.visitedRooms)?c.visitedRooms.slice():[mapFor(c.mapVersion).roomAt(c.player)]):[],
  id:c.id,status:'playing',paused:true,pausedAt:now,
  start:now-(c.mapVersion>=3?resumeElapsed:DURATION-c.remaining)*1000,
   duration:c.mapVersion>=4?FACILITY_DURATION:DURATION,
  player:{...c.player,invuln:0},
   area:MAP_PROFILES[c.area]?c.area:DEFAULT_AREA,
   stats:{...c.stats,weightLimit:Number.isFinite(c.stats.weightLimit)?c.stats.weightLimit:(c.stats.capacity>6?18:12),
    weapons:Array.isArray(c.stats.weapons)?c.stats.weapons.map(w=>({...w})):gearStats().weapons},
  enemies:c.enemies.map(v=>restoreEnemy(v,c.mapVersion)),chests:c.chests.map(v=>({...v,reward:{...v.reward}})),
  loot:c.loot.map((v,i)=>({...v,tid:v.tid||i+1})),tickets:c.tickets,kills:c.kills||0,
  // Legacy checkpoints began before equipment loss existed, so they remain grandfathered.
  riskUids:Array.isArray(c.riskUids)?c.riskUids.slice():[],
  safeIds:Array.isArray(c.safeIds)?c.safeIds.slice():[],
  lootSerial:Math.max(c.lootSerial||1,...c.loot.map((v,i)=>(v.tid||i+1)+1)),
  spawnAt:c.spawnAt,attackAt:c.attackAt,autoAttack:c.autoAttack!==false,
  hasKeycard:c.mapVersion===5?!!c.hasKeycard:false,
  vaultUnlocked:c.mapVersion===5?!!c.vaultUnlocked:false,
  vaultEntered:c.mapVersion===5?!!c.vaultEntered:false,
  vaultSealed:c.mapVersion===5?!!c.vaultSealed:false,
  vaultHatchUsed:c.mapVersion===5?!!c.vaultHatchUsed:false,
  vaultAlarm:c.mapVersion===5?!!c.vaultAlarm:false,
  escapeVariant:c.mapVersion===5?c.escapeVariant:'strict',
  manualAttack:false,dodgeCooldown:0,dodgeTime:0,facing:directionValid(c.facing)?{...c.facing}:{x:1,y:0},
  weaponSlot:c.weaponSlot,slash:null,damageTexts:[],joy:{x:0,y:0},steer:{x:0,y:0},
  message:'探索を復元しました。▶で再開してください',messageUntil:now+9000
 };
 // Migrate only actors whose former checkpoint position is obstructed by
 // the new corridor partitions. Preserve inventory, sealed loot and raid time.
 if(run.mapVersion>=4&&mapFor(run.mapVersion)?.nearestWalkablePoint){
  let moved=0;
  const playerPos=run.mapVersion===5&&run.vaultHatchUsed?
   mapFor(5).nearestEscapePoint(run.player,17,run.escapeVariant):mapFor(run.mapVersion).nearestWalkablePoint(run.player,17);
  if(Math.hypot(run.player.x-playerPos.x,run.player.y-playerPos.y)>.1){
   run.player.x=playerPos.x;run.player.y=playerPos.y;moved++;
  }
  for(const enemy of run.enemies){
   const radius=Math.min(21,enemyDefinition(enemy.kind).radius+2);
   const pos=run.mapVersion===5&&run.vaultHatchUsed&&
    mapFor(5).escapeBarrierSolid(enemy.x,enemy.y,radius,run.escapeVariant)?
    mapFor(5).nearestEscapePoint(enemy,radius,run.escapeVariant):mapFor(run.mapVersion).nearestWalkablePoint(enemy,radius);
   if(Math.hypot(pos.x-enemy.x,pos.y-enemy.y)>.1){
    enemy.x=pos.x;enemy.y=pos.y;
    enemy.homeX=pos.x;enemy.homeY=pos.y;
    enemy.targetX=pos.x;enemy.targetY=pos.y;
    enemy.lastX=pos.x;enemy.lastY=pos.y;
    enemy.mode='patrol';enemy.notice=0;moved++;
   }
  }
  if(moved){
   run.message='間仕切りの更新に合わせて安全な通路へ移動しました';
   run.messageUntil=now+9000;
  }
 }
 lastCheckpointAt=now;preload();
}
function endCheckpoint(){
 if(!storageReady)return;
 state.exploreRun=null;save();
}
function protectedLoot(){
 if(!run)return [];
 const ids=new Set(run.safeIds||[]);
 return run.loot.filter(v=>ids.has(v.tid));
}
function settlementSummary(result){
 const lost=result.lost||[],saved=result.saved||[];
 return (lost.length?'装備 '+lost.length+'点消失。':'装備ロストなし。')+
  (saved.length?' 保護した戦利品 '+saved.length+'点を回収。':'');
}
function settleRun(outcome,reason=''){
 if(!run||run.status!=='playing'||!storageReady||actionPersisting)return false;
 const endedRun=run,claimId=run.id,won=outcome==='escaped';
 const recovered=won?run.loot.slice():protectedLoot();
 const tickets=won?run.tickets:0;
 const exposed=new Set(won?[]:run.riskUids||[]);
 const lost=state.inv.filter(row=>exposed.has(row.uid)).map(row=>({
  uid:row.uid,id:row.id,q:row.q,name:item(row.id)?.name||'所持品'
 }));
 // The claim marker, inventory delta, protected loot and result are one atomic commit.
 endedRun.status='saving';
 document.body.classList.remove('exp-immersive');
 stopLoop();
 state.exploreRun={v:1,status:'claimed',id:claimId,outcome,claimedAt:Date.now()};
 state.exploreLastResult={
  id:claimId,status:outcome,at:Date.now(),
  saved:recovered.map(row=>({id:row.id,q:row.q})),
  lost:lost.map(row=>({uid:row.uid,id:row.id,q:row.q,name:row.name})),
  tickets
 };
 if(exposed.size){
  state.inv=state.inv.filter(row=>{
   if(!exposed.has(row.uid))return true;
   markDelete(row.uid);return false;
  });
  for(const slot of EQUIP_SLOTS)if(exposed.has(Number(state.exploreEquip?.[slot])))state.exploreEquip[slot]=0;
 }
 for(const reward of recovered){
  const it=item(reward.id);
  if(it)receive(it,reward.q,false,'explore');
 }
 state.bonusTickets=Math.min(1000000,(state.bonusTickets||0)+tickets);
 saveWithCommit(()=>{
  if(!run||run.id!==claimId)return;
  // The claim is already durable; this follow-up save merely removes its marker.
  state.exploreRun=null;save();
  endedRun.status=won?'escaped':'lost';
  endedRun.reason=reason;
  endedRun.banked=recovered;
  endedRun.bankedTickets=tickets;
  endedRun.lostItems=lost;
  if(outcome==='abandon'){run=null;render()}
  else render();
 });
 return true;
}
function startRun(){
 if(!storageReady||actionPersisting)return;
 if(indoorModeSelected&&!MallV5){const n=document.getElementById('exp-start-notice');if(n)n.textContent='新屋内マップを読み込めません。'+indoorLoadError+' 従来施設へ切り替えられます。';return}
 const gearUids=equippedUids();
 const locked=gearUids.map(uid=>state.inv.find(v=>v.uid===uid)).filter(row=>row&&row.locked);
 if(duplicateEquipmentUid(state.exploreEquip)||locked.length){
  const msg=locked.length?'🔒 保護中の財宝を出撃装備にできません。所持品で保護解除するか、装備を外してください。':'同じ財宝を複数枠に同時装備できません';
  const note=document.getElementById('exp-start-notice');if(note)note.textContent=msg;
  return;
 }
 if(gearUids.length&&typeof window.confirm==='function'&&!window.confirm(
  '出撃確認：装備中の'+gearUids.length+'点は、死亡・時間切れ・途中撤退で所持品から消失します。\\n安全ポーチは戦利品2点だけを守り、装備は守れません。\\n出撃しますか？'
 ))return;
 facilityPreviewOpen=false;
  stopLoop();preload();const stats=gearStats();
 const area=MAP_PROFILES[state.exploreArea]?state.exploreArea:DEFAULT_AREA;
 // The V4 complex is the shared venue for all NEW sorties; area only selects loot tables.
 const layout=indoorModeSelected?MallV5:(MallV4||(area==='mall'?(MallV3||Mall):null));
  if(indoorModeSelected&&!layout){const note=document.getElementById('exp-start-notice');if(note)note.textContent='屋内地形の読み込み中です。従来施設も選択できます。'+indoorLoadError;return}
 const mapVersion=layout?(layout===MallV5?5:layout===MallV4?4:layout===MallV3?3:2):1;useWorld(mapVersion);
 const selectedExit=mapVersion>=3?layout.pickExit():null;
 run={
  mapVersion,containers:layout?createMallContainers(layout):[],lootOpenId:null,showMap:false,mapDirect:false,
   pendingGuardPosts:mapVersion>=4?layout.guardPosts.map(p=>p.id):[],
  exitId:selectedExit?selectedExit.id:undefined,
  visitedRooms:mapVersion>=3?[layout.roomAt(layout.start)]:[],
  id:(window.crypto&&typeof window.crypto.randomUUID==='function'?window.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),
  status:'playing',paused:false,pausedAt:0,start:Date.now(),duration:mapVersion>=4?FACILITY_DURATION:DURATION,
   area,player:{x:layout?layout.start.x:88,y:layout?layout.start.y:100,hp:stats.maxHp,invuln:0},
  stats,enemies:[],chests:(layout?[]:CHEST_SPOTS.map(([x,y,type],i)=>({
    x,y,type,i,opened:false,reward:chooseLoot(type,area),ticket:Math.random()<.10
   }))),
  loot:[],safeIds:[],lootSerial:1,riskUids:gearUids,
  hasKeycard:false,vaultUnlocked:false,vaultEntered:false,vaultSealed:false,vaultHatchUsed:false,vaultAlarm:false,
  escapeVariant:mapVersion===5?(Math.random()<.5?'strict':'cover'):'strict',
  tickets:0,kills:0,spawnAt:mapVersion>=4?12:15,attackAt:0,autoAttack:mapVersion===5?false:true,manualAttack:false,dodgeCooldown:0,dodgeTime:0,facing:{x:1,y:0},weaponSlot:0,slash:null,damageTexts:[],joy:{x:0,y:0},steer:{x:0,y:0},message:mapVersion===5?'左上に高レア。右下の最上位金庫は警備室のカードキー必須・入場後は戻れません':mapVersion>=4?'5分以内に西側の固定脱出口へ帰還せよ':'施設を探索して脱出口を探せ',messageUntil:Date.now()+2500
 };
 if(mapVersion>=4)activateFacilityGuardPosts();
  if(mapVersion!==5){spawnEnemy('normal');spawnEnemy('normal')}
  saveRunCheckpoint(true);render();
}
function notify(s){
 if(!run)return;
 run.message=s;run.messageUntil=Date.now()+2300;
 const e=document.getElementById('exp-note');if(e)e.textContent=s;
 const feedback=document.getElementById('exp-action-toast');
 if(feedback){feedback.textContent=s;feedback.dataset.active='true'}
}
function stopLoop(){
 if(stickVisual.release)stickVisual.release();
 stickVisual.release=null;stickVisual.active=false;
 if(raf)cancelAnimationFrame(raf);
 raf=0;canvas=null;ctx=null;lastFrame=0;keys.clear();
 stickVisual.thumb=null;stickVisual.x=0;stickVisual.y=0;stickVisual.targetX=0;stickVisual.targetY=0;
 if(run){run.joy={x:0,y:0};run.steer={x:0,y:0}}
 pauseVisualDirty=true;perf.windowStart=0;perf.frames=0;perf.fps=0;perf.slow=0;perf.alarmFrames=0;perf.alarmSlow=0;
}
function leaveRun(){
 if(!run||run.status!=='playing'){stopLoop();run=null;return true}
 return settleRun('abandon','途中撤退のため装備と未保護の戦利品を失いました');
}
function confirmLeaveRun(){
 if(!run||run.status!=='playing')return true;
 const warning='探索を途中で放棄しますか？\\n出撃時・探索中に持ち込んだ装備が消失し、安全ポーチに保護した財宝以外は失います。';
 if(typeof window.confirm==='function'&&!window.confirm(warning))return false;
 return leaveRun();
}
function solid(x,y,r=12){
 if(run?.mapVersion===5){
  if(run.vaultHatchUsed&&vaultLayout()?.escapeBarrierSolid(x,y,r,run.escapeVariant))return true;
  const gate=vaultLayout()?.vaultGate;
  if(gate&&(!run.vaultUnlocked||run.vaultSealed)){
   const half=gate.tileSize/2;
   if(x+r>gate.x-half&&x-r<gate.x+half&&
    y+r>gate.y-half&&y-r<gate.y+half)return true;
  }
 }
 if(run?.mapVersion>=4&&mapFor(run.mapVersion))return mapFor(run.mapVersion).solid(x,y,r);
 if(x<r||y<r||x>WORLD.w-r||y>WORLD.h-r)return true;
 return WALLS.some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h);
}
function move(actor,vx,vy,dt,r=11){
 const x=actor.x+vx*dt,y=actor.y+vy*dt;
 if(!solid(x,actor.y,r))actor.x=x;
 if(!solid(actor.x,y,r))actor.y=y;
}
function restoreEnemy(e,sourceVersion=run?.mapVersion){
 // During checkpoint restore, run is not assigned yet: choose stats and patrol
 // data from the saved map version, not from the previous/default world.
 const kind=ENEMY_TYPES[e.kind]?e.kind:'normal';
 const def=sourceVersion===5?TILED_ENEMY_TYPES[kind]:sourceVersion>=4?FACILITY_ENEMY_TYPES[kind]:ENEMY_TYPES[kind];
 const safe=(v,fallback)=>Number.isFinite(v)?v:fallback;
 const restored={
  x:e.x,y:e.y,kind,mode:['patrol','alert','chase','windup','recover','search'].includes(e.mode)?e.mode:'patrol',
  hp:e.hp,maxHp:def.hp,
  homeX:clamp(safe(e.homeX,e.x),18,WORLD.w-18),homeY:clamp(safe(e.homeY,e.y),18,WORLD.h-18),
  targetX:clamp(safe(e.targetX,e.x),18,WORLD.w-18),targetY:clamp(safe(e.targetY,e.y),18,WORLD.h-18),
  lastX:clamp(safe(e.lastX,e.x),18,WORLD.w-18),lastY:clamp(safe(e.lastY,e.y),18,WORLD.h-18),
  lastSeen:safe(e.lastSeen,-999),phaseUntil:safe(e.phaseUntil,0),attackAt:safe(e.attackAt,0),
  patrolUntil:safe(e.patrolUntil,0),facingX:safe(e.facingX,1),facingY:safe(e.facingY,0),
  aimX:safe(e.aimX,1),aimY:safe(e.aimY,0),hitUntil:safe(e.hitUntil,0),
   notice:clamp(safe(e.notice,0),0,sourceVersion===5?TILED_BALANCE.noticeSeconds+.08:.45),staggerResistUntil:Math.max(0,safe(e.staggerResistUntil,0)),
   // R5.64: deterministic investigation state survives task-kill and legacy
   // V5 checkpoints which have no search fields still restore safely.
   searchStep:Math.max(0,Math.min(4,Math.trunc(safe(e.searchStep,0)))),
   searchUntil:safe(e.searchUntil,e.mode==='search'?safe(e.phaseUntil,0):0),
   searchPhaseUntil:safe(e.searchPhaseUntil,0),
   searchTargetX:clamp(safe(e.searchTargetX,e.lastX??e.x),18,WORLD.w-18),
   searchTargetY:clamp(safe(e.searchTargetY,e.lastY??e.y),18,WORLD.h-18),
   searchAxisX:safe(e.searchAxisX,1),searchAxisY:safe(e.searchAxisY,0)
 };
 if(sourceVersion===5){const post=mapFor(5)?.guardPosts?.find(p=>Math.hypot(p.x-restored.homeX,p.y-restored.homeY)<4);if(post?.route?.length){restored.guardRoute=post.route;restored.guardPause=post.pauses||[];restored.guardStep=Math.max(0,Math.min(post.route.length-1,Math.trunc(safe(e.guardStep,0))))}}
 return Combat.restoreEffects(e,restored);
}
function enemyKindForTime(elapsed){
 const r=Math.random();
 if(run?.mapVersion>=4){
  const level=facilityThreatLevel();
  if(level===0)return 'normal';
  if(level===1)return r<.72?'normal':'fast';
  if(level===2)return r<.54?'normal':r<.88?'fast':'heavy';
  return r<.39?'normal':r<.76?'fast':'heavy';
 }
 if(elapsed<35)return 'normal';
 if(elapsed<95)return r<.73?'normal':'fast';
 if(elapsed<170)return r<.57?'normal':r<.88?'fast':'heavy';
 return r<.45?'normal':r<.78?'fast':'heavy';
}
function spawnEnemy(forcedKind){
 if(run?.mapVersion===5)return false; // no surprise enemy spawns in stealth corridors
 if(!run||run.enemies.length>=Math.min(ENEMY_CAP,liveEnemyCap(raidElapsed())))return false;
 const elapsed=raidElapsed();
 let kind=forcedKind||enemyKindForTime(elapsed);
 // A late-run armored threat is guaranteed when there is still a free slot.
 if(!forcedKind&&(run.mapVersion>=4?facilityThreatLevel()>=3:elapsed>=105)&&
  !run.enemies.some(e=>e.kind==='heavy'))kind='heavy';
 if(kind==='heavy'&&run.enemies.filter(e=>e.kind==='heavy').length>=2)kind='normal';
 if(kind==='fast'&&run.enemies.filter(e=>e.kind==='fast').length>=4)kind='normal';
 const def=enemyDefinition(kind);
 for(let k=0;k<(run.mapVersion>=4?40:22);k++){
  const angle=Math.random()*Math.PI*2,radius=210+Math.random()*130;
  const x=clamp(run.player.x+Math.cos(angle)*radius,26,WORLD.w-26);
  const y=clamp(run.player.y+Math.sin(angle)*radius,26,WORLD.h-26);
  if(solid(x,y,def.radius+3)||distance({x,y},run.player)<195||distance({x,y},exitPoint())<128)continue;
  if(run.enemies.some(e=>distance(e,{x,y})<103))continue;
  run.enemies.push(restoreEnemy({x,y,kind,hp:def.hp,mode:'patrol',homeX:x,homeY:y,
   facingX:Math.cos(angle),facingY:Math.sin(angle),attackAt:elapsed+1}));
  return true;
 }
 return false;
}
// A fixed sentry post is reserved for every authored zone from the beginning.
// Wake nearby posts as the player approaches: prevents empty far-off wings while
// keeping only a few active enemy AI / radar cones on mobile devices.
function activateFacilityGuardPosts(){
 if(run?.mapVersion<4||!Array.isArray(run.pendingGuardPosts))return 0;
 const posts=mapFor(run.mapVersion)?.guardPosts||[],byId=new Map(posts.map(p=>[p.id,p]));
 const remaining=run.pendingGuardPosts.map(id=>byId.get(id)).filter(Boolean);
 const playerZone=mapFor(run.mapVersion).roomAt(run.player);
 const due=remaining.filter(p=>{
  if(run.mapVersion===5&&p.alarmOnly&&!run.vaultAlarm)return false;
  const d=distance(p,run.player);
  if(run.mapVersion===5&&p.alarmOnly&&run.vaultAlarm)return d>=90&&d<=650;
  return d>=170&&(d<=490||(p.zone===playerZone&&d<=650));
 }).sort((a,b)=>{
  // Escape alarm reinforcements take priority over ordinary background patrols.
  const alarmA=run.mapVersion===5&&run.vaultAlarm&&a.alarmOnly?0:1;
  const alarmB=run.mapVersion===5&&run.vaultAlarm&&b.alarmOnly?0:1;
  const az=a.zone===playerZone?0:1,bz=b.zone===playerZone?0:1;
  return alarmA-alarmB||az-bz||distance(a,run.player)-distance(b,run.player);
 });
 let activated=0;
 for(const post of due){
  const def=enemyDefinition(post.kind),d=distance(post,run.player);
  if(run.enemies.some(e=>distance(e,post)<def.radius+90))continue;
  if(run.enemies.length>=Math.min(ENEMY_CAP,liveEnemyCap(raidElapsed()))){
   // Replace only an offscreen/disengaged guard far behind the player,
   // never a pursuer or a guard who currently sees the player.
   const i=run.enemies.findIndex(e=>['patrol','search'].includes(e.mode)&&
    distance(e,run.player)>720&&!facilityVisionClear(e,run.player));
   if(i<0)continue;
   const removed=run.enemies.splice(i,1)[0];
   if(run.mapVersion===5){
    const previous=posts.find(p=>Math.hypot(p.x-removed.homeX,p.y-removed.homeY)<4);
    if(previous&&!run.pendingGuardPosts.includes(previous.id))run.pendingGuardPosts.push(previous.id);
   }
  }
  const elapsed=raidElapsed();
  run.enemies.push(restoreEnemy({
   x:post.x,y:post.y,kind:post.kind,hp:def.hp,mode:'patrol',
   homeX:post.x,homeY:post.y,
   // The sentry is already patrolling; give a player entering the area a
   // fair chance to see its cone before it can detect them.
   facingX:(post.x-run.player.x)/d,facingY:(post.y-run.player.y)/d,
   attackAt:elapsed+1.2
  }));
  run.pendingGuardPosts.splice(run.pendingGuardPosts.indexOf(post.id),1);
  activated++;
 }
 return activated;
}

// Live V4 sentries can fill the population cap while remaining far behind the
// player in an enormous facility. Recycle ONLY distant, disengaged patrols;
// a visible or actively pursuing enemy must never disappear to ease escape.
function recycleDistantFacilityGuards(){
 if(!run||run.mapVersion<4||run.mapVersion===5)return 0;
 let removed=0;
 for(let i=run.enemies.length-1;i>=0;i--){
  const e=run.enemies[i];
  if(!['patrol','search'].includes(e.mode)||distance(e,run.player)<=950||
   facilityVisionClear(e,run.player))continue;
  run.enemies.splice(i,1);removed++;
 }
 return removed;
}
// Sample along the segment: partitions obstruct detection instead of wall-hacking.
// Exact segment/rectangle intersection over 11 fixed walls; no per-ray sampling.
function canSeeBetween(a,b){
 if(run?.mapVersion>=4&&mapFor(run.mapVersion))return mapFor(run.mapVersion).lineClear(a,b,run.mapVersion===5&&run.vaultHatchUsed,run.escapeVariant);
 const dx=b.x-a.x,dy=b.y-a.y;
 for(const wall of WALLS){
  const left=wall.x-3,right=wall.x+wall.w+3,top=wall.y-3,bottom=wall.y+wall.h+3;
  if(Math.max(a.x,b.x)<left||Math.min(a.x,b.x)>right||
     Math.max(a.y,b.y)<top||Math.min(a.y,b.y)>bottom)continue;
  let near=0,far=1;
  if(Math.abs(dx)<1e-9){
   if(a.x<left||a.x>right)continue;
  }else{
   const t1=(left-a.x)/dx,t2=(right-a.x)/dx;
   near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));
  }
  if(Math.abs(dy)<1e-9){
   if(a.y<top||a.y>bottom)continue;
  }else{
   const t1=(top-a.y)/dy,t2=(bottom-a.y)/dy;
   near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));
  }
  if(near<=far&&far>0&&near<1)return false;
 }
 return true;
}
// Detection and painted radar must use the same unpadded optical geometry.
 // Physical navigation still uses padded body-collision lineClear().
 function facilityVisionClear(a,b){
  const layout=mapFor(run?.mapVersion);
   return layout?.visionClear?layout.visionClear(a,b,run?.mapVersion===5&&run.vaultHatchUsed,run?.escapeVariant):canSeeBetween(a,b);
 }
 function facilityCanSeePlayer(e,p,def,tracking=false){
 const d=distance(e,p),v5=run?.mapVersion===5;
 // R5.64: engaged V5 guards cannot see 360° behind themselves or across
 // an entire hall. Both first acquisition and pursuit need real line of sight.
 const range=tracking&&v5?Math.min(def.lose,def.detect*TILED_BALANCE.trackingRangeScale):
  tracking?def.lose:def.detect;
 if(d>range||!facilityVisionClear(e,p))return false;
 if(!v5&&tracking||d<=(v5?40:32))return true;
 const f=Math.hypot(e.facingX,e.facingY),faceX=f>.01?e.facingX/f:1,faceY=f>.01?e.facingY/f:0;
 const arc=v5&&tracking?Math.min(Math.PI*.86,def.visionHalfArc*TILED_BALANCE.trackingViewScale):def.visionHalfArc;
 return ((p.x-e.x)*faceX+(p.y-e.y)*faceY)/Math.max(d,.001)>=Math.cos(arc);
}
function facilityNoticeThreshold(){
 return run?.mapVersion===5?TILED_BALANCE.noticeSeconds:.32;
}
function facilityNoticeReady(e,dt,visible){
 // V5 allows a longer response to a brief glimpse, but remains dangerous up close.
 const v5=run?.mapVersion===5,dtSafe=Math.max(0,dt);
 e.notice=clamp((e.notice||0)+(visible?dtSafe:-dtSafe*(v5?TILED_BALANCE.noticeDecay:2)),
  0,v5?TILED_BALANCE.noticeSeconds+.08:.45);
 return visible&&e.notice>=facilityNoticeThreshold();
}
const visionConeCache=new WeakMap();
function facilityVisionContour(e,def,now){
 const last=visionConeCache.get(e),angle=Math.atan2(e.facingY,e.facingX);
 if(last&&now-last.at<120&&distance(e,last.pos)<3&&
  Math.abs(Math.atan2(Math.sin(angle-last.angle),Math.cos(angle-last.angle)))<.055)return last.points;
 const points=[];
 const engaged=run?.mapVersion===5&&['alert','chase','windup','recover'].includes(e.mode);
 const range=engaged?Math.min(def.lose,def.detect*TILED_BALANCE.trackingRangeScale):def.detect;
 const arc=engaged?Math.min(Math.PI*.86,def.visionHalfArc*TILED_BALANCE.trackingViewScale):def.visionHalfArc;
 for(let i=0;i<=12;i++){
  const ray=angle+(i/6-1)*arc,dx=Math.cos(ray),dy=Math.sin(ray);
  let reach=range;
  if(mapFor(run.mapVersion)?.visionRayDistance){
   // Narrow hallways: exact optical geometry, without the 17px actor padding.
   reach=mapFor(run.mapVersion).visionRayDistance(e,{x:dx,y:dy},range,run.mapVersion===5&&run.vaultHatchUsed,run.escapeVariant);
  }else if(!facilityVisionClear(e,{x:e.x+dx*reach,y:e.y+dy*reach})){
   let lo=0,hi=reach;
   for(let j=0;j<7;j++){
    const mid=(lo+hi)/2;
    if(facilityVisionClear(e,{x:e.x+dx*mid,y:e.y+dy*mid}))lo=mid;
    else hi=mid;
   }
   reach=lo;
  }
  points.push({x:e.x+dx*reach,y:e.y+dy*reach});
 }
 visionConeCache.set(e,{at:now,angle,pos:{x:e.x,y:e.y},points});
 return points;
}
function drawFacilityVision(ox,oy,w,h){
 if(run.mapVersion<4)return;
 const now=Date.now();
 for(const e of run.enemies){
  const def=enemyDefinition(e.kind),x=e.x-ox,y=e.y-oy;
  if(x< -def.detect||y< -def.detect||x>w+def.detect||y>h+def.detect)continue;
  const points=facilityVisionContour(e,def,now);
  const fighting=['alert','chase','windup','recover'].includes(e.mode);
  const color=e.kind==='fast'?'rgba(243,157,76,.15)':e.kind==='heavy'?'rgba(186,166,235,.15)':'rgba(243,214,102,.15)';
  const edge=e.kind==='fast'?'rgba(246,170,87,.64)':e.kind==='heavy'?'rgba(196,179,249,.65)':'rgba(245,215,120,.62)';
  ctx.beginPath();ctx.moveTo(x,y);
  for(const pt of points)ctx.lineTo(pt.x-ox,pt.y-oy);
  ctx.closePath();
  ctx.fillStyle=fighting?'rgba(255,108,81,.15)':e.mode==='search'?'rgba(255,185,92,.13)':color;
  ctx.fill();
  ctx.strokeStyle=fighting?'rgba(255,139,112,.70)':edge;
  ctx.lineWidth=1.3;ctx.stroke();
  // R5.37: V5 melee tell shows the actual locked strike direction and reach.
  if(run.mapVersion===5&&e.mode==='windup'){
   const reach=def.range+19,angle=Math.atan2(e.aimY||0,e.aimX||1);
   const pulse=.18+.13*Math.sin(now/75);
   ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,reach,angle-.68,angle+.68);ctx.closePath();
   ctx.fillStyle='rgba(255,65,61,'+Math.max(.12,pulse)+')';ctx.fill();
   ctx.strokeStyle='#ff6961';ctx.lineWidth=2.5;ctx.stroke();
   ctx.beginPath();ctx.arc(x,y,def.radius+7,0,Math.PI*2);
   ctx.strokeStyle='#fff0d8';ctx.lineWidth=2.5;ctx.stroke();
  }
  // Keep the sensing indicator legible at a tight doorway even when the
  // actual cone is reduced to a narrow sliver. This ring is not extra sight.
  ctx.beginPath();ctx.arc(x,y,32,0,Math.PI*2);
  ctx.strokeStyle=fighting?'rgba(255,139,112,.46)':edge;ctx.lineWidth=1.3;ctx.stroke();
  const angle=Math.atan2(e.facingY,e.facingX);
  ctx.beginPath();ctx.moveTo(x,y);
  ctx.lineTo(x+Math.cos(angle)*14,y+Math.sin(angle)*14);
  ctx.lineWidth=2.5;ctx.strokeStyle=fighting?'rgba(255,175,137,.85)':edge;ctx.stroke();
 }
}
// R5.26: an alerted guard sprints while it can see the fleeing player.
 // Cover cuts that sprint: pursuers still check last known positions but do
 // not run full speed through walls or indefinitely track a hidden player.
 function facilityPursuitSpeed(e,def,visible){
  if(run?.mapVersion<4)return def.speed;
  const slowed=def.speed/Math.max(.001,enemyDefinition(e.kind).speed);
  return (visible?def.chaseSpeed:Math.min(def.chaseSpeed,enemyDefinition(e.kind).speed*1.3))*slowed;
 }
 function enemyMoveTowards(e,x,y,speed,dt,radius){
 const d=Math.hypot(x-e.x,y-e.y);if(d<1)return false;
 if(run?.mapVersion>=3&&!canSeeBetween(e,{x,y})){
  const nav=mapFor(run.mapVersion);
  const next=nav?.nextWaypoint(e,{x,y},run.mapVersion===5&&run.vaultHatchUsed,run.escapeVariant);
  if(next){x=next.x;y=next.y}
 }
 const adjusted=Math.hypot(x-e.x,y-e.y);
 if(adjusted<1)return false;
 const dx=(x-e.x)/adjusted,dy=(y-e.y)/adjusted;
 const bx=e.x,by=e.y;
 e.facingX=dx;e.facingY=dy;move(e,dx*speed,dy*speed,dt,radius);
  if(run?.mapVersion>=4&&Math.hypot(e.x-bx,e.y-by)<.1){
   // A route waypoint can graze the edge of shelving. Try a short tangent
   // instead of freezing in place until the next full navigation update.
   const side=(Math.round(e.homeX/40)%2)?1:-1;
   for(const sign of [side,-side]){
    const angle=sign*Math.PI/3,c=Math.cos(angle),si=Math.sin(angle);
    const tx=dx*c-dy*si,ty=dx*si+dy*c;
    move(e,tx*speed*.7,ty*speed*.7,dt,radius);
    if(Math.hypot(e.x-bx,e.y-by)>.1){e.facingX=tx;e.facingY=ty;break}
   }
  }
 return Math.hypot(e.x-bx,e.y-by)>.1;
}
// Keep same-type (and mixed-type) enemies from visually merging and blocking
// each other's targeting. Zero-distance pairs use a deterministic split direction.
function separateOverlappingEnemies(dt){
 if(!run||run.enemies.length<2)return;
 const enemies=run.enemies;
 const step=Math.min(65*Math.max(0,dt),4);
 if(step<=0)return;
 for(let i=0;i<enemies.length;i++){
  const a=enemies[i],ar=enemyDefinition(a.kind).radius;
  for(let j=i+1;j<enemies.length;j++){
   const b=enemies[j],br=enemyDefinition(b.kind).radius;
   let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
   const spacing=ar+br+5;
   if(d>=spacing)continue;
   if(d<.001){
    // Stable across frames, including a restored raid with overlapping enemies.
    const angle=((i*7+j*11)%16)*Math.PI/8;
    dx=Math.cos(angle);dy=Math.sin(angle);d=1;
   }else{dx/=d;dy/=d}
   const push=Math.min(step,(spacing-d)*.5);
   // A wind-up may shift by at most 4px/frame, small enough to keep its tell legible.
   move(a,-dx*push,-dy*push,1,ar);
   move(b,dx*push,dy*push,1,br);
  }
 }
}
function enemyPatrol(e,def,elapsed,dt){
 if(run.mapVersion===5&&e.guardRoute){
  const route=e.guardRoute;
  if(elapsed<e.patrolUntil){
   // Predictable slow scan gives the player a readable window to slip past.
   const turn=dt*.38,co=Math.cos(turn),si=Math.sin(turn);
   const x=e.facingX,y=e.facingY;
   e.facingX=x*co-y*si;e.facingY=x*si+y*co;
   return;
  }
  const target=route[e.guardStep%route.length];
  if(distance(e,target)<16){
   const arrived=e.guardStep%route.length;
   e.guardStep=(arrived+1)%route.length;
   e.patrolUntil=elapsed+(e.guardPause?.[arrived]??1.1);
   return;
  }
  if(!enemyMoveTowards(e,target.x,target.y,def.speed*.55,dt,def.radius)){
   e.guardStep=(e.guardStep+1)%route.length;e.patrolUntil=elapsed+.8;
  }
  return;
 }

 if(elapsed<e.patrolUntil){
  if(run.mapVersion>=4){
   const turn=Math.max(0,dt)*.48,c=Math.cos(turn),s=Math.sin(turn);
   const x=e.facingX,y=e.facingY;
   e.facingX=x*c-y*s;e.facingY=x*s+y*c;
  }
  return;
 }
 if(Math.hypot(e.targetX-e.x,e.targetY-e.y)<10){
  e.targetX=e.x;e.targetY=e.y;e.patrolUntil=elapsed+.6+Math.random()*1.2;
  const a=Math.random()*Math.PI*2,r=run.mapVersion===5?(e.kind==='heavy'?14+Math.random()*24:20+Math.random()*34):25+Math.random()*56;
  const tx=clamp(e.homeX+Math.cos(a)*r,23,WORLD.w-23);
  const ty=clamp(e.homeY+Math.sin(a)*r,23,WORLD.h-23);
  if(!solid(tx,ty,def.radius+3)){e.targetX=tx;e.targetY=ty}
 }else if(!enemyMoveTowards(e,e.targetX,e.targetY,def.speed*.46,dt,def.radius)){
  e.targetX=e.x;e.targetY=e.y;e.patrolUntil=elapsed+.8;
 }
}
function enemyHitPlayer(e,def,p){
 // The direction is locked at telegraph start; moving behind/outside evades.
 const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy);
 if(d>def.range+(run.mapVersion===5?19:12)||p.invuln>0)return false;
 if(d>.001&&(dx*e.aimX+dy*e.aimY)/d<(run.mapVersion===5?.15:.55))return false;
  // Breaking line of sight behind facility cover avoids a telegraphed hit.
  // Historical maps retain their previous melee collision semantics.
  if(run.mapVersion>=4&&!(run.mapVersion===5?facilityVisionClear(e,p):canSeeBetween(e,p)))return false;
 // R5.40: V5 entry-level raid: no protective defense is lethal in one hit;
 // even basic protective gear normally survives the first clean strike.
 const raidDamage=run.mapVersion===5?(Number(run.stats.defense||0)>0?Math.max(def.damage,76):Math.max(def.damage,110)):def.damage;
 let applied;
 if(run.stats.combatRulesVersion===2){
  const defVal=Math.min(20,Math.max(0,Number(run.stats.defense)||0));
  const physical=defVal/(defVal+20);
  const f=run.facing||{x:1,y:0};
  const front=d>.001&&((e.x-p.x)*f.x+(e.y-p.y)*f.y)/d>=.25;
  const resists=run.stats.resists||{};
  const situational=Math.max(Number(resists.melee)||0,front?(Number(resists.frontal)||0):0)/100;
  const reduction=Math.min(.5,1-(1-physical)*(1-Math.min(.6,situational)));
  applied=Math.max(1,Math.round(raidDamage*(1-reduction)));
 }else applied=Math.max(1,raidDamage-Math.min(12,Math.max(0,run.stats.defense||0)));
 p.hp=Math.max(0,p.hp-applied);p.invuln=.85;
 if(p.hp<=0){lose('敵の攻撃を受け、戦利品を失いました');return true}
 notify(def.name+'型から '+applied+' ダメージ');
 return true;
}
// R5.64: V5-only finite search. An enemy remembers the last *seen* position,
// checks it, scans, then investigates nearby cover. No player-coordinate
// sampling happens after visual contact is lost, so cover really breaks pursuit.
function startV5Search(e,elapsed,def){
 e.mode='search';e.notice=0;e.searchStep=0;
 const d=Math.hypot(e.lastX-e.x,e.lastY-e.y);
 const axis=Math.hypot(e.facingX,e.facingY)||1;
 e.searchAxisX=e.facingX/axis;e.searchAxisY=e.facingY/axis;
 e.searchTargetX=e.lastX;e.searchTargetY=e.lastY;
 e.searchPhaseUntil=0;
 e.searchUntil=elapsed+Math.min(9,Math.max(TILED_BALANCE.searchDuration,d/Math.max(35,def.speed*.65)+3.5));
 e.phaseUntil=e.searchUntil;
}
function v5SearchProbe(e,sign){
 const sideX=-e.searchAxisY*sign,sideY=e.searchAxisX*sign;
 const radius=TILED_BALANCE.searchProbeDistance;
 const desired={x:e.lastX+sideX*radius,y:e.lastY+sideY*radius};
 const layout=mapFor(5);
 const target=run.vaultHatchUsed?layout?.nearestEscapePoint(desired,18,run.escapeVariant):
  layout?.nearestWalkablePoint(desired,18);
 const p=target||desired;
 e.searchTargetX=p.x;e.searchTargetY=p.y;
}
function updateV5Search(e,elapsed,dt,def){
 if(elapsed>=e.searchUntil){
  e.mode='patrol';e.targetX=e.x;e.targetY=e.y;
  e.patrolUntil=elapsed+.55;e.notice=0;e.searchStep=0;return;
 }
 if(e.searchStep===0){
  if(Math.hypot(e.x-e.lastX,e.y-e.lastY)>20){
   enemyMoveTowards(e,e.lastX,e.lastY,def.speed*.72,dt,def.radius);
  }else{
   e.searchStep=1;e.searchPhaseUntil=elapsed+1.1;
  }
  return;
 }
 if(e.searchStep===1||e.searchStep===4){
  // Stand still and sweep the cone. Scanning does not magically reveal
  // players through shelves or through the B-route's nine obstacles.
  const turn=dt*(e.searchStep===1?1.25:.65),c=Math.cos(turn),si=Math.sin(turn);
  const x=e.facingX,y=e.facingY;
  e.facingX=x*c-y*si;e.facingY=x*si+y*c;
  if(e.searchStep===1&&elapsed>=e.searchPhaseUntil){
   e.searchStep=2;v5SearchProbe(e,1);e.searchPhaseUntil=elapsed+1.9;
  }
  return;
 }
 if(e.searchStep===2||e.searchStep===3){
  const reached=Math.hypot(e.x-e.searchTargetX,e.y-e.searchTargetY)<24;
  if(reached||elapsed>=e.searchPhaseUntil){
   if(e.searchStep===2){
    e.searchStep=3;v5SearchProbe(e,-1);e.searchPhaseUntil=elapsed+2;
   }else e.searchStep=4;
  }else enemyMoveTowards(e,e.searchTargetX,e.searchTargetY,def.speed*.55,dt,def.radius);
 }
}
function updateEnemy(e,elapsed,dt){
 const rawDef=enemyDefinition(e.kind);
 const slow=Combat.speedFactor(e,elapsed);
 const def=slow===1?rawDef:{...rawDef,speed:rawDef.speed*slow};
 const p=run.player,d=distance(e,p);
 if(e.mode==='windup'){
  if(elapsed>=e.phaseUntil){
   enemyHitPlayer(e,def,p);
   e.mode='recover';e.phaseUntil=elapsed+def.recovery;e.attackAt=elapsed+def.cooldown;
  }
  return;
 }
 if(e.mode==='recover'){
  if(elapsed<e.phaseUntil)return;
  if(run.mapVersion>=4&&facilityCanSeePlayer(e,p,rawDef,true)){
   // An enemy that has already landed a strike remains engaged; forcing
   // search after every hit previously created long, harmless pauses.
   e.mode='chase';e.lastSeen=elapsed;e.lastX=p.x;e.lastY=p.y;
  }else{
   if(run.mapVersion===5)startV5Search(e,elapsed,rawDef);
   else{
    e.mode='search';
    if(run.mapVersion>=4)e.notice=0;
    e.phaseUntil=elapsed+(run.mapVersion>=4?3.6:1.2);
   }
  }
 }
 const facility=run.mapVersion>=4,scouting=e.mode==='patrol'||e.mode==='search';
 const sight=facility?facilityCanSeePlayer(e,p,rawDef,!scouting):d<=def.detect&&canSeeBetween(e,p);
 const tooFar=d>def.lose||distance(e,{x:e.homeX,y:e.homeY})>def.leash;
 if(sight){e.lastSeen=elapsed;e.lastX=p.x;e.lastY=p.y}
 if(e.mode==='patrol'){
  if(sight&&(!facility||(run.mapVersion===5&&d<=TILED_BALANCE.closeAlertDistance)||facilityNoticeReady(e,dt,true))){
   e.mode='alert';e.phaseUntil=elapsed+(run.mapVersion===5?.12:.28);
   e.facingX=(p.x-e.x)/Math.max(d,1);e.facingY=(p.y-e.y)/Math.max(d,1);
   if(facility)notify('敵に見つかった！遮蔽物に逃げろ');
  }else{
   if(facility&&!sight)facilityNoticeReady(e,dt,false);
   enemyPatrol(e,def,elapsed,dt);
  }
  return;
 }
 if(e.mode==='alert'){
  if(tooFar){
   if(run.mapVersion===5)startV5Search(e,elapsed,rawDef);
   else{e.mode='search';if(facility)e.notice=0;e.phaseUntil=elapsed+(facility?3.6:1.4)}
   return;
  }
  if(elapsed>=e.phaseUntil)e.mode='chase';
  else return;
 }
 if(e.mode==='search'){
  if(sight&&!tooFar&&(!facility||(run.mapVersion===5&&d<=TILED_BALANCE.closeAlertDistance)||facilityNoticeReady(e,dt,true))){
   e.mode='alert';e.phaseUntil=elapsed+.17;
   if(facility)notify('敵に再発見された！');
   return;
  }
  if(facility&&(!sight||tooFar))facilityNoticeReady(e,dt,false);
  if(run.mapVersion===5){updateV5Search(e,elapsed,dt,def);return}
  const reached=distance(e,{x:e.lastX,y:e.lastY})<12;
  if(elapsed>=e.phaseUntil||(!facility&&reached)){
   e.mode='patrol';e.targetX=e.x;e.targetY=e.y;return;
  }
  if(facility&&reached){
   // Inspect the last known location for a few seconds, rather than
   // immediately forgetting the player upon reaching their last position.
   const turn=dt*.85,c=Math.cos(turn),si=Math.sin(turn);
   const fx=e.facingX,fy=e.facingY;
   e.facingX=fx*c-fy*si;e.facingY=fx*si+fy*c;
  }else enemyMoveTowards(e,e.lastX,e.lastY,def.speed*.72,dt,def.radius);
  return;
 }
 if(e.mode==='chase'){
  if(tooFar||elapsed-e.lastSeen>(run.mapVersion===5?TILED_BALANCE.chaseMemory:facility?4.3:2.1)){
   if(run.mapVersion===5)startV5Search(e,elapsed,rawDef);
   else{
    e.mode='search';if(facility)e.notice=0;
    e.phaseUntil=elapsed+(facility?3.6:1.7);
   }
   return;
  }
  const warnings=run.enemies.reduce((n,enemy)=>n+(enemy.mode==='windup'?1:0),0);
  // R5.65: visible, facing-aware windups; a clear ray alone is not awareness.
  if(d<=def.range+(run.mapVersion===5?19:12)&&elapsed>=e.attackAt&&warnings<ENEMY_WINDUP_CAP&&
    (run.mapVersion===5?sight:canSeeBetween(e,p))){
   e.mode='windup';e.phaseUntil=elapsed+def.windup;
   // At point-blank overlap, normalize using the last valid facing vector.
   // Never store a (0,0) strike direction.
   if(d>.001){e.aimX=(p.x-e.x)/d;e.aimY=(p.y-e.y)/d}
   else{
    const fd=Math.hypot(e.facingX,e.facingY);
    e.aimX=fd>.001?e.facingX/fd:1;
    e.aimY=fd>.001?e.facingY/fd:0;
   }
   return;
  }
  if(d>def.range*.83){
   // Fast enemies briefly sidestep close to a visible player, but return to
   // direct pursuit. All movement still obeys the collision geometry.
   if(run.mapVersion>=4&&e.kind==='fast'&&sight&&d>def.range+24&&d<102&&elapsed%4<1.0){
    const side=Math.round(e.homeX/40)%2===0?1:-1;
    const tx=p.x+(e.y-p.y)/Math.max(d,1)*side*65;
    const ty=p.y+(p.x-e.x)/Math.max(d,1)*side*65;
    enemyMoveTowards(e,tx,ty,facilityPursuitSpeed(e,def,sight)*.86,dt,def.radius);
   }else{
    const target=sight?p:{x:e.lastX,y:e.lastY};
    const chaseBoost=1; // V5 no longer adds a hidden sprint multiplier on top of chaseSpeed.
    enemyMoveTowards(e,target.x,target.y,facilityPursuitSpeed(e,def,sight)*chaseBoost,dt,def.radius);
   }
  }
 }
}
function raidElapsed(){return run?Math.max(0,((run.paused?run.pausedAt:Date.now())-run.start)/1000):0}
function remaining(){return run?run.mapVersion===3?DURATION:Math.max(0,run.duration-raidElapsed()):0}
function lose(reason){
 if(!run||run.status!=='playing')return;
 settleRun('lost',reason);
}
function openContainer(){
 if(!run||run.status!=='playing'||run.paused||run.mapVersion<2)return;
 const c=nearContainer();
 if(!c){notify('棚やロッカーに近づいてください');return}
 // Do not allow an instant freeze while an enemy is attacking at point blank.
 const threatened=run.enemies.some(e=>distance(e,run.player)<115&&['chase','windup'].includes(e.mode));
 if(threatened){notify('敵に追われている間は調べられません');return}
 run.lootOpenId=c.id;
 togglePause();
}
function containerPanel(){
 const c=(run.containers||[]).find(v=>v.id===run.lootOpenId);
 if(!c){run.lootOpenId=null;return ''}
 const layout=mapFor(run.mapVersion),specs=layout.types[c.kind],room=layout.rooms.find(r=>r.id===c.room),name=room?.name||'店内';
 const tier=run.mapVersion>=4?mapFor(run.mapVersion).supplyTierForContainer(c):null;
 const expectation=tier==='ultra'?'最上位物資':tier==='high'?'高級物資':tier==='mid'?'中級物資':'一般物資';
 const chanceLine=run.mapVersion===5&&tier?
  'SSR以上の抽選確率：1点あたり約'+v5SsrPlusPercent(tier).toFixed(1)+'%。中身は出撃時に確定・結果の保証なし。':'';
 const before=run.mapVersion===5?v5ReturnRisk():null;
 const contents=c.contents.map((v,i)=>{
  const it=item(v.id);
  const proposed=run.mapVersion===5?[...run.loot,v]:null;
  const after=proposed?Math.round(carrySpeedFactor(proposed,run.stats.weightLimit)*100):null;
  const extra=proposed?' ／ 回収後 '+v5CargoRisk(proposed).text+
   (after<Math.round(carrySpeedFactor(run.loot,run.stats.weightLimit)*100)?'（減速）':''):'';
  // Straight distance is strictly a LOWER BOUND; corridor detours and combat
  // cannot be inferred from the distance, so never label it as an exit ETA.
  const projected=proposed?v5ReturnRisk(proposed):null;
  const added=projected?Math.max(0,projected.straightSeconds-before.straightSeconds):0;
  const density=lootBaseValue(v)*10/Math.max(1,weightTenths(v.id));
  const returnHint=projected?'<small class="exp-pickup-return" data-risk="'+(projected.urgent?'urgent':'normal')+'">'+
   '価値/kg '+lootCurrency(density)+' ／ 帰還の直線下限 '+projected.straightSeconds+'秒以上'+
   '（今より'+(added?'+':'')+added+'秒）'+(projected.urgent?' ・ 帰還優先':'')+'</small>':'';
  return '<div class="exp-container-line"><img src="'+it.image+'" alt=""><span><strong>'+escapeHTML(it.name)+'</strong><small>'+it.rarity+' ・ '+QNAME[v.q]+' ・ '+itemWeightLine(it)+extra+'</small>'+returnHint+'</span>'+
   '<button type="button" data-explore="loot-take" data-container="'+escapeHTML(c.id)+'" data-i="'+i+'" aria-label="'+escapeHTML(it.name)+'を回収">取る</button></div>';
 }).join('')||'<p class="exp-container-empty">中身はすべて回収済みです</p>';
 return '<div class="exp-pause-overlay exp-container-overlay" role="dialog" aria-modal="true" aria-label="回収品を選ぶ"><div class="exp-pause-card exp-container-card">'+
 '<small class="exp-container-location">'+escapeHTML(name)+(tier?' ／ '+expectation:'')+'</small><h2>'+escapeHTML(specs.name)+'</h2>'+
 '<p>選んでいる間は敵・戦闘・時間が完全停止。欲しいものだけ回収できます。</p>'+
 (run.mapVersion===5?'<p class="exp-container-risk">現在の荷重：'+v5CargoRisk().text+'。拾った後もバッグから捨てられます。</p>':'')+
 (run.mapVersion===5?'<p class="exp-container-return-note">帰還の直線下限は障害物・扉・敵・迂回を含みません。実際の脱出時間はもっと長くなります。</p>':'')+
 (chanceLine?'<p class="exp-container-odds">'+chanceLine+'</p>':'')+
 '<div class="exp-container-items">'+contents+'</div>'+
 '<div class="exp-container-footer"><strong>'+weightLabel().text+'</strong><span>バッグ '+run.loot.length+'点</span></div>'+
 '<button type="button" class="exp-resume" data-explore="loot-close">探索に戻る</button></div></div>';
}
function takeContainerItem(button){
 if(!run||run.mapVersion<2||!run.paused||!run.lootOpenId)return;
 const c=run.containers.find(v=>v.id===run.lootOpenId);
 if(!c||button.dataset.container!==c.id)return;
 const i=Number(button.dataset.i);if(!Number.isInteger(i)||i<0||i>=c.contents.length)return;
 const reward=c.contents[i];if(!rewardValid(reward))return;
 // Item removal and addition are checkpointed together, preserving the sealed outcome.
 c.contents.splice(i,1);c.opened=true;
 run.loot.push({...reward,tid:run.lootSerial++});
 stageRunCheckpoint();
 saveWithCommit(()=>{
  const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel();
  updateHUD(true);
 });
}
function closeContainer(){
 if(!run||!run.lootOpenId||!run.paused)return;
 run.lootOpenId=null;
 togglePause();
}
function interact(){
 if(!run||run.status!=='playing'||run.paused)return;
 if(useVaultInteraction())return;
 if(run.mapVersion>=2){openContainer();return}
 let near=run.chests.filter(c=>!c.opened&&distance(c,run.player)<INTERACT_RANGE).sort((a,b)=>distance(a,run.player)-distance(b,run.player))[0];
 if(!near){notify('宝箱に近づいてください');return}
 near.opened=true;
 const reward=near.reward; // Selected when the raid began, not during animation.
 run.loot.push({...reward,tid:run.lootSerial++});
 // R5.7 raids seal the ticket roll at sortie. Legacy checkpoints retain
 // their former single opening roll when the ticket field is absent.
 if(near.ticket===true||(near.ticket===undefined&&Math.random()<.10))run.tickets++;
 const tier=carryTier(run.loot,run.stats.weightLimit);
 notify('獲得：'+item(reward.id).name+(tier?' ⚠重量超過・速度'+Math.round(carrySpeedFactor(run.loot,run.stats.weightLimit)*100)+'%':''));
 saveRunCheckpoint(true);draw();updateHUD(true);
}
function bank(){
 if(!run||run.status!=='playing'||actionPersisting||!storageReady)return;
 if(run.mapVersion>=4&&remaining()<=0){
  lose('制限時間5分を過ぎたため戦利品を失いました');return;
 }
 if(distance(run.player,exitPoint())>58){notify('緑色の出口まで戻ってください');return}
 settleRun('escaped');
}
function performAttack(manual,elapsed){
 if(!run||run.status!=='playing'||run.paused||elapsed<run.attackAt)return false;
 const p=run.player,profile=weaponProfile(run.weaponSlot),style=profile.pattern?{...WEAPON_STYLES[profile.style],...profile.pattern}:WEAPON_STYLES[profile.style];
 const assistedManual=manual&&run.mapVersion>=4;
 const facing=directionValid(run.facing)?run.facing:{x:1,y:0};
 let closest=null,closestDist=Infinity;
 for(const e of run.enemies){
  const d=distance(e,p);
  if(d>style.range+enemyDefinition(e.kind).radius||!canSeeBetween(p,e))continue;
  const dot=d<.001?1:((e.x-p.x)*facing.x+(e.y-p.y)*facing.y)/d;
  if(manual&&!assistedManual&&dot<Math.cos(style.arc))continue;
  const score=manual&&!assistedManual?d-dot*14:d;
  if(score<closestDist){closest=e;closestDist=score}
 }
 if(!closest&&!manual)return false;
 // Manual attacks respect player facing. Auto attacks rotate towards the nearest visible enemy.
 const aim=(manual&&!assistedManual)||!closest||distance(closest,p)<.001?{x:facing.x,y:facing.y}:
  {x:(closest.x-p.x)/distance(closest,p),y:(closest.y-p.y)/distance(closest,p)};
 const hitList=Combat.attackTargets(p,run.enemies,aim,profile.style,canSeeBetween,
  run.mapVersion===5?TILED_ENEMY_TYPES:run.mapVersion>=4?FACILITY_ENEMY_TYPES:ENEMY_TYPES,profile.pattern);
 // Do not let weapon switching reset this cooldown.
 run.manualAttack=false;
 // V4 manual timing is the skill reward; AUTO stays convenient but fires
  // 20% fewer attacks per second than a player repeatedly tapping.
  run.attackAt=elapsed+style.cooldown*(run.mapVersion>=4&&!manual?1.25:1);
 const now=Date.now();
 run.slash={x:p.x,y:p.y,dx:aim.x,dy:aim.y,style:profile.style,range:style.range,arc:style.arc,until:now+style.animationMs};
 if(!Array.isArray(run.damageTexts))run.damageTexts=[];
 for(const target of hitList){
  const affinity=affinityMultiplier(profile.style,target.kind);
  const baseDamage=Combat.hitDamage(profile.attack,profile.style,target.kind);
  const damage=Combat.equipmentDamage(baseDamage,profile,target.kind,run.mapVersion);
  target.hp-=damage;target.hitUntil=elapsed+.22;
  if(target.hp>0){
   if(profile.effect&&profile.effect!=='none')Combat.applyEquipmentEffect(profile,target,elapsed,Math.random);
   else Combat.applyHitEffect(profile.style,target,elapsed,Math.random);
  }
  // A well-timed strike interrupts standard/fast windups, not heavy armor.
  if(run.mapVersion>=4&&target.mode==='windup'&&target.kind!=='heavy'&&target.hp>0&&elapsed>=(target.staggerResistUntil||0)){
   target.mode='recover';target.phaseUntil=elapsed+(run.mapVersion===5?.52:.36);
   target.attackAt=Math.max(target.attackAt,elapsed+(run.mapVersion===5?1.10:.85));
    target.staggerResistUntil=elapsed+2.4; // Cannot interrupt every consecutive attack.
  }
  if(target.mode==='patrol'||target.mode==='search'){
   const d=distance(target,p);
   target.mode='alert';target.phaseUntil=elapsed+.15;
   target.lastSeen=elapsed;target.lastX=p.x;target.lastY=p.y;
   target.facingX=(p.x-target.x)/Math.max(d,1);target.facingY=(p.y-target.y)/Math.max(d,1);
  }
  if(profile.style==='strike'&&target.kind!=='heavy'&&target.hp>0){
   const d=Math.max(1,distance(target,p));
   move(target,(target.x-p.x)/d*10,(target.y-p.y)/d*10,1,enemyDefinition(target.kind).radius);
  }
  run.damageTexts.push({x:target.x,y:target.y-22,value:damage,color:style.effect,advantage:affinity>1,until:now+560});
  if(target.hp<=0){run.enemies.splice(run.enemies.indexOf(target),1);run.kills++}
 }
 if(run.damageTexts.length>18)run.damageTexts=run.damageTexts.slice(-18);
 return true;
}
function swapWeapon(){
 if(!run||run.status!=='playing'||run.paused)return;
 run.weaponSlot=1-run.weaponSlot;
 run.manualAttack=false;
 const profile=weaponProfile(run.weaponSlot);
 notify((run.weaponSlot===0?'メイン':'サブ')+'：'+profile.name+'（'+WEAPON_STYLES[profile.style].name+'）');
 saveRunCheckpoint(true);updateHUD(true);
}
function requestManualAttack(){
 if(!run||run.status!=='playing'||run.paused)return;
 const elapsed=raidElapsed();
 if(!performAttack(true,elapsed)){
  // Queue a single press while the current strike is cooling down.
  run.manualAttack=true;
  notify('攻撃準備中…');
 }else notify('攻撃！');
}
function tick(dt){
 if(!run||run.status!=='playing'||run.paused)return;
 const elapsed=(Date.now()-run.start)/1000;
 if((run.mapVersion<3||run.mapVersion>=4)&&elapsed>=run.duration){
  lose('時間切れで戦利品を失いました');return;
 }
 const p=run.player;
 let vx=(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0)+run.joy.x;
 let vy=(keys.has('s')||keys.has('ArrowDown')?1:0)-(keys.has('w')||keys.has('ArrowUp')?1:0)+run.joy.y;
 // Analog joystick: partial tilt gives partial speed; keyboard still reaches full speed.
 const length=Math.hypot(vx,vy);
 if(length>1){vx/=length;vy/=length}
 // Fast, frame-rate-independent ease-in/out (about 40ms) removes abrupt velocity changes.
 const steer=run.steer||(run.steer={x:0,y:0});
 const follow=1-Math.exp(-dt*(length>.01?25:30));
 steer.x+=(vx-steer.x)*follow;steer.y+=(vy-steer.y)*follow;
 const steerLength=Math.hypot(steer.x,steer.y);
 if(steerLength>.008){
  run.facing={x:steer.x/steerLength,y:steer.y/steerLength};
  const speed=run.stats.speed*(run.mapVersion===5?TILED_BALANCE.playerSpeedFactor:1)*carrySpeedFactor(run.loot,run.stats.weightLimit);
   move(p,steer.x*speed,steer.y*speed,dt,12);
 }
 if(run.mapVersion===5)sealVaultOnEntry();
 if(run.mapVersion>=3){
  const zone=mapFor(run.mapVersion).roomAt(p);
  if(zone>=0&&!run.visitedRooms.includes(zone))run.visitedRooms.push(zone);
 }
 if(run.mapVersion>=4)activateFacilityGuardPosts();
 run.dodgeCooldown=Math.max(0,run.dodgeCooldown-dt);run.dodgeTime=Math.max(0,run.dodgeTime-dt);
 if(elapsed>=run.spawnAt){
  // Recycle abandoned guards beyond the encounter area, never active pursuers.
  if(run.mapVersion>=4)recycleDistantFacilityGuards();
  // Gradual pressure: one enemy per interval rather than instantaneous waves.
  spawnEnemy();
  // Faster periodic reinforcements, but no instantaneous wave or endless
  // mob: liveEnemyCap is still hard-bounded and all spawns require free floor.
  run.spawnAt=elapsed+(run.mapVersion>=4?(facilityThreatLevel()>=2?14:16):Math.max(11,20-elapsed/32));
 }
 p.invuln=Math.max(0,p.invuln-dt);
 // Status timers use active raid elapsed time, not wall-clock time.
 for(let i=run.enemies.length-1;i>=0;i--){
  const e=run.enemies[i],dot=Combat.advanceEffects(e,elapsed);
  if(dot>0){
   e.hp-=dot;e.hitUntil=elapsed+.16;
   run.damageTexts.push({x:e.x,y:e.y-22,value:dot,color:'#f6a6a3',advantage:false,until:Date.now()+560});
   if(e.hp<=0){run.enemies.splice(i,1);run.kills++}
  }
 }
 if(run.damageTexts.length>18)run.damageTexts=run.damageTexts.slice(-18);
 for(const enemy of run.enemies){
  updateEnemy(enemy,elapsed,dt);
  if(run.status!=='playing')return;
 }
 separateOverlappingEnemies(dt);
 if(run.manualAttack&&elapsed>=run.attackAt)performAttack(true,elapsed);
 else if(run.autoAttack&&elapsed>=run.attackAt)performAttack(false,elapsed);
}
function drawVaultMarkers(ox,oy,w,h){
 if(run?.mapVersion!==5)return;
 const layout=vaultLayout();
 const key=layout?.vaultKeycard,gate=layout?.vaultGate,hatch=layout?.vaultHatch;
 if(key&&!run.hasKeycard){
  const x=key.x-ox,y=key.y-oy;
  if(x>-40&&x<w+40&&y>-40&&y<h+40){
   ctx.fillStyle='rgba(54,216,219,.23)';ctx.fillRect(x-21,y-18,42,36);
   ctx.strokeStyle='#a2ffff';ctx.lineWidth=2;ctx.strokeRect(x-21,y-18,42,36);
   ctx.fillStyle='#e5ffff';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText('KEY',x,y+4);
  }
 }
 if(gate){
  const x=gate.x-ox,y=gate.y-oy;
  if(x>-60&&x<w+60&&y>-60&&y<h+60){
   const locked=run.vaultSealed||!run.vaultUnlocked;
   ctx.fillStyle=run.vaultSealed?'rgba(174,48,53,.93)':locked?'rgba(215,151,55,.90)':'rgba(67,166,110,.65)';
   ctx.fillRect(x-21,y-21,42,42);
   ctx.strokeStyle=run.vaultSealed?'#ffb4b4':'#fff4b2';ctx.lineWidth=3;ctx.strokeRect(x-21,y-21,42,42);
   ctx.fillStyle='#fff';ctx.font='bold 10px system-ui';ctx.textAlign='center';
   ctx.fillText(run.vaultSealed?'CLOSED':locked?'KEY':'OPEN',x,y+4);
  }
 }
 if(hatch&&!run.vaultHatchUsed){
  const x=hatch.x-ox,y=hatch.y-oy;
  if(x>-40&&x<w+40&&y>-40&&y<h+40){
   ctx.fillStyle='rgba(51,119,143,.72)';ctx.fillRect(x-20,y-20,40,40);
   ctx.strokeStyle='#c5fcfa';ctx.lineWidth=2;ctx.strokeRect(x-20,y-20,40,40);
   ctx.fillStyle='#d9ffff';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText('↗',x,y+4);
  }
 }
}
// R5.67: alarm lighting reads saved vaultAlarm; visual pulse is derived from
// active raid time and never written to a checkpoint. Motion-sensitive
// players see a steady warning lamp instead of a flashing effect.
function v5AlarmVisual(elapsed=raidElapsed(),reduced=!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){
 if(run?.mapVersion!==5||!run.vaultAlarm)return {alarm:false,pulse:0};
 return {alarm:true,pulse:reduced?.5:.5+.5*Math.sin(Math.max(0,elapsed)*Math.PI*2/2.8)};
}
function draw(){
 if(!ctx||!run||run.status!=='playing')return;
 const p=run.player,w=VIEW.w,h=VIEW.h;
 const ox=clamp(p.x-w/2,0,WORLD.w-w),oy=clamp(p.y-h/2,0,WORLD.h-h);
 ctx.clearRect(0,0,w,h);
 const area=areaProfile(run.area);
 if(run.mapVersion===5&&mapFor(5))mapFor(5).drawScene(ctx,ox,oy,v5AlarmVisual());
 else if(run.mapVersion>=3&&mapFor(run.mapVersion))mapFor(run.mapVersion).drawScene(ctx,ox,oy,w,h);
 else{
  ctx.fillStyle=area.floor;ctx.fillRect(0,0,w,h);
  ctx.lineWidth=1;ctx.strokeStyle=area.grid;
  for(let x=-ox%40;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
  for(let y=-oy%40;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  for(const b of WALLS){
   ctx.fillStyle='#111c21';ctx.fillRect(b.x-ox+5,b.y-oy+7,b.w,b.h);
   ctx.fillStyle=area.wall;ctx.fillRect(b.x-ox,b.y-oy,b.w,b.h);
   ctx.fillStyle='#74837b';ctx.fillRect(b.x-ox+5,b.y-oy+5,b.w-10,7);
  }
 }
 if(run.mapVersion===5&&run.vaultHatchUsed)vaultLayout()?.drawEscapeShutters(ctx,ox,oy,w,h,run.escapeVariant);
 drawVaultMarkers(ox,oy,w,h);
 drawFacilityVision(ox,oy,w,h);
 if(run.mapVersion>=2&&mapFor(run.mapVersion)){
  for(const room of (run.mapVersion>=3?[]:Mall.rooms)){
   const x=room.x-ox,y=room.y-oy;
   if(x+room.w<0||y+room.h<0||x>w||y>h)continue;
   ctx.fillStyle='rgba(65,88,80,.18)';ctx.fillRect(x+12,y+12,room.w-24,room.h-24);
   ctx.font='bold 11px system-ui';ctx.fillStyle='#b5c6bc';ctx.textAlign='center';
   ctx.fillText(room.name,x+room.w/2,y+28);
  }
  const colors={shelf:'#789d8c',locker:'#8aa6c8',crate:'#a48257',register:'#a8aaa5',
   wood:'#bc9459',iron:'#8798ac',safe:'#bd9cce'};
  const cacheColors={standard:'#e6c66b',mid:'#6bb9e5',high:'#bd91e8',ultra:'#ff856e'};
  for(const c of run.containers){
   const x=c.x-ox,y=c.y-oy;
   if(x<-25||x>w+25||y<-25||y>h+25)continue;
   const empty=c.contents.length===0;
   ctx.globalAlpha=empty?.32:1;
   ctx.fillStyle=colors[c.kind]||'#aaa';
   if(run.mapVersion>=4){
    const tier=mapFor(run.mapVersion).supplyTierForContainer(c);
    const shade=empty?'#69776e':cacheColors[tier];
    ctx.fillStyle=shade;
    if(tier==='high'||tier==='ultra'){
     // Diamond symbol: violet high loot, crimson-gold keycard vault loot.
     ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x+8,y);
     ctx.lineTo(x,y+8);ctx.lineTo(x-8,y);ctx.closePath();ctx.fill();
     if(!empty){ctx.strokeStyle=tier==='ultra'?'#ffe4a2':'#e6d5ff';ctx.lineWidth=tier==='ultra'?2:1.4;ctx.stroke()}
    }else if(tier==='mid'){
     ctx.fillRect(x-6,y-6,12,12);
     if(!empty){ctx.strokeStyle='#d2edff';ctx.lineWidth=1;ctx.strokeRect(x-6,y-6,12,12)}
    }else ctx.fillRect(x-5,y-5,10,10);
   }else if(['shelf','locker','register'].includes(c.kind)){ctx.fillRect(x-13,y-10,26,20);ctx.fillStyle='#293834';ctx.fillRect(x-8,y-6,16,3)}
   else{ctx.fillRect(x-11,y-11,22,22);ctx.strokeStyle='#dfddd0';ctx.lineWidth=1;ctx.strokeRect(x-11,y-11,22,22)}
   if(!empty&&distance(c,p)<INTERACT_RANGE){ctx.strokeStyle='#d8d4a0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,22,0,Math.PI*2);ctx.stroke()}
   ctx.globalAlpha=1;
  }
 }
 const exit=exitPoint();
 ctx.fillStyle='rgba(82,226,150,.13)';ctx.fillRect(exit.x-ox-38,exit.y-oy-35,76,70);
 ctx.strokeStyle='#55d39b';ctx.lineWidth=3;ctx.strokeRect(exit.x-ox-38,exit.y-oy-35,76,70);
 ctx.fillStyle='#a1f3c8';ctx.font='bold 10px system-ui';ctx.textAlign='center';
 ctx.fillText('EXIT',exit.x-ox,exit.y-oy-23);
 for(const c of run.chests){
  const x=c.x-ox,y=c.y-oy,src=chestAsset(c.type,c.opened),img=images[src];
  if(x<-50||x>w+50||y<-50||y>h+50)continue;
  if(!c.opened&&distance(c,p)<56){ctx.strokeStyle='rgba(244,210,125,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,29,0,Math.PI*2);ctx.stroke()}
  if(img&&img.complete&&img.naturalWidth>=CHEST_SPRITE_SIZE*2){
   // Same on-screen anchor for both opened/closed poses; preserve full lid height.
   const sourceX=c.type===3?CHEST_SPRITE_SIZE:0;
   const sourceY=c.opened?CHEST_SPRITE_SIZE:0;
   ctx.drawImage(img,sourceX,sourceY,CHEST_SPRITE_SIZE,CHEST_SPRITE_SIZE,
    x-30,y-40,60,60);
  }else{
   ctx.fillStyle=c.type===3?'#63737c':'#ad8457';
   ctx.fillRect(x-19,y-12,38,25);
  }
 }
 // Attack cones are painted under silhouettes so the player can sidestep them.
 const elapsed=raidElapsed();
 for(const e of run.enemies){
  const def=enemyDefinition(e.kind);
  if(e.mode!=='windup')continue;
  const x=e.x-ox,y=e.y-oy,angle=Math.atan2(e.aimY,e.aimX);
  if(x<-70||x>w+70||y<-70||y>h+70)continue;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,def.range+12,-.99,.99);ctx.closePath();
  ctx.fillStyle=e.kind==='heavy'?'rgba(255,65,51,.33)':'rgba(255,139,72,.27)';ctx.fill();
  ctx.strokeStyle=e.kind==='heavy'?'rgba(255,102,89,.92)':'rgba(255,187,117,.9)';
  ctx.lineWidth=2;ctx.stroke();
  // Countdown line shortens to the hit frame.
  const progress=clamp(1-(e.phaseUntil-elapsed)/def.windup,0,1);
  ctx.strokeStyle='#fff0c9';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(0,0,def.range+17,-.94,-.94+1.88*progress);ctx.stroke();
  ctx.restore();
 }
 for(const e of run.enemies){
  const x=e.x-ox,y=e.y-oy,kind=e.kind||'normal',def=enemyDefinition(kind);
  if(x<-50||x>w+50||y<-50||y>h+50)continue;
  ctx.save();
  ctx.translate(x,y);
  ctx.fillStyle='rgba(0,0,0,.32)';ctx.beginPath();ctx.ellipse(2,5,def.radius+3,def.radius*.64,0,0,Math.PI*2);ctx.fill();
  const hit=e.hitUntil>elapsed;
  if(kind==='fast'){
   // Angular orange predator: visually different from the regular round enemy.
   ctx.fillStyle=hit?'#fff2d1':'#e6a14d';
   ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(12,-1);ctx.lineTo(0,13);ctx.lineTo(-12,-1);ctx.closePath();ctx.fill();
   ctx.strokeStyle='#79432b';ctx.lineWidth=2;ctx.stroke();
   ctx.fillStyle='#422322';ctx.fillRect(-5,-2,3,3);ctx.fillRect(3,-2,3,3);
  }else if(kind==='heavy'){
   // Large, rectangular armored silhouette and plated shoulders.
   ctx.fillStyle=hit?'#f5eaff':'#6e668d';ctx.fillRect(-16,-17,32,33);
   ctx.fillStyle='#9891b3';ctx.fillRect(-20,-10,7,20);ctx.fillRect(13,-10,7,20);
   ctx.fillStyle='#443b60';ctx.fillRect(-10,-12,20,14);
   ctx.fillStyle='#d6bfdc';ctx.fillRect(-6,-8,4,4);ctx.fillRect(3,-8,4,4);
   ctx.strokeStyle='#b8a9c4';ctx.lineWidth=2;ctx.strokeRect(-16,-17,32,33);
  }else{
   ctx.fillStyle=hit?'#ffd5c5':'#b96b67';ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#d89a8c';
   ctx.beginPath();ctx.moveTo(-10,-7);ctx.lineTo(-11,-16);ctx.lineTo(-3,-11);ctx.fill();
   ctx.beginPath();ctx.moveTo(10,-7);ctx.lineTo(11,-16);ctx.lineTo(3,-11);ctx.fill();
   ctx.fillStyle='#281d22';ctx.fillRect(-6,-3,3,3);ctx.fillRect(3,-3,3,3);
  }
  // Compact warning icons only when the enemy changes state.
  if(e.mode==='alert'||e.mode==='windup'||e.mode==='search'){
   ctx.font='bold 14px system-ui';ctx.textAlign='center';
   ctx.fillStyle=e.mode==='windup'?'#ffe1b3':e.mode==='alert'?'#ffe07f':'#c4d1cb';
   ctx.fillText(e.mode==='search'?'?':'!',0,-def.radius-16);
  }
  if(e.hp<def.hp){
   const bar=kind==='heavy'?35:27;
   ctx.fillStyle='#171b1b';ctx.fillRect(-bar/2,-def.radius-11,bar,4);
   ctx.fillStyle='#dc8874';ctx.fillRect(-bar/2,-def.radius-11,bar*Math.max(0,e.hp/def.hp),4);
  }
  ctx.restore();
 }
 ctx.fillStyle=p.invuln>0?'#b8dafa':'#58a8df';
 ctx.beginPath();ctx.arc(p.x-ox,p.y-oy,13,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#ddf4ff';ctx.lineWidth=run.mapVersion===5?3.5:2;ctx.stroke();
 if(run.mapVersion===5){ctx.beginPath();ctx.arc(p.x-ox,p.y-oy,19,0,Math.PI*2);ctx.strokeStyle='rgba(84,193,255,.7)';ctx.lineWidth=2;ctx.stroke();}
 ctx.fillStyle='#e3f5ff';ctx.beginPath();ctx.moveTo(p.x-ox,p.y-oy-9);ctx.lineTo(p.x-ox-6,p.y-oy+6);ctx.lineTo(p.x-ox+6,p.y-oy+6);ctx.fill();
 if(run.slash&&Date.now()<run.slash.until){
  const v=run.slash,baseStyle=WEAPON_STYLES[v.style]||WEAPON_STYLES.unarmed;
  const style=v.range?{...baseStyle,range:v.range,arc:v.arc}:baseStyle;
  const remaining=(v.until-Date.now())/style.animationMs;
  const angle=Math.atan2(v.dy,v.dx),px=v.x-ox,py=v.y-oy;
  ctx.save();ctx.translate(px,py);ctx.rotate(angle);
  ctx.globalAlpha=clamp(remaining*.9,.06,.9);
  ctx.strokeStyle=style.effect;ctx.lineCap='round';
  if(v.style==='reach'||v.style==='ranged'){
   ctx.lineWidth=v.style==='ranged'?3:5;ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(style.range+7,0);ctx.stroke();
   ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(style.range-4,-7);ctx.lineTo(style.range+11,0);
   ctx.lineTo(style.range-4,7);ctx.stroke();
  }else if(v.style==='rapid'||v.style==='machine'){
   ctx.lineWidth=v.style==='machine'?5:3;
   ctx.beginPath();ctx.arc(0,0,style.range,-style.arc,style.arc);ctx.stroke();
   ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,style.range-10,-style.arc*.8,style.arc*.6);ctx.stroke();
  }else if(v.style==='slash'){
   ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,style.range,-style.arc,style.arc);ctx.stroke();
   ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,style.range-7,-style.arc*.5,style.arc*.8);ctx.stroke();
  }else if(v.style==='whip'){
   ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,style.range,-style.arc,style.arc);ctx.stroke();
   ctx.beginPath();ctx.arc(0,0,style.range-12,-style.arc*.7,style.arc*.9);ctx.stroke();
  }else if(v.style==='special'){
   ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,style.range,-style.arc,style.arc);ctx.stroke();
   ctx.lineWidth=2;ctx.beginPath();ctx.arc(style.range*.55,0,style.range*.26,0,Math.PI*2);ctx.stroke();
  }else{
   ctx.lineWidth=v.style==='strike'?7:4;
   ctx.beginPath();ctx.arc(0,0,style.range,-style.arc,style.arc);ctx.stroke();
  }
  ctx.restore();
 }
 if(Array.isArray(run.damageTexts)&&run.damageTexts.length){
  const now=Date.now();
  run.damageTexts=run.damageTexts.filter(v=>v.until>now);
  ctx.textAlign='center';ctx.font='bold 14px system-ui';
  for(const v of run.damageTexts){
   const t=clamp((v.until-now)/560,0,1);
   ctx.globalAlpha=Math.min(1,t*2);
   ctx.lineWidth=3;ctx.strokeStyle='rgba(22,24,27,.85)';
   ctx.strokeText('-'+v.value,v.x-ox,v.y-oy-(1-t)*20);
   ctx.fillStyle=v.color;ctx.fillText('-'+v.value,v.x-ox,v.y-oy-(1-t)*20);
   if(v.advantage){ctx.font='bold 9px system-ui';ctx.fillText('有利',v.x-ox,v.y-oy+10-(1-t)*20);ctx.font='bold 14px system-ui'}
  }
  ctx.globalAlpha=1;
 }
}
// R5.52: a single stable, readable stealth indicator; player awareness is
// derived from existing guard state, never a separate invisible detection rule.
// R5.73: a B-route nook is recognizable cover, not automatic invisibility.
function v5InHidingAlcove(){
 return !!(run?.mapVersion===5&&run.vaultHatchUsed&&run.escapeVariant==='cover'&&
  vaultLayout()?.escapeNiches?.some(n=>distance(n,run.player)<24));
}
function stealthSituation(){
 if(!run||run.mapVersion!==5)return {mode:'hidden',percent:0,label:'未発見'};
 const enemies=run.enemies||[],p=run.player,elapsed=raidElapsed();
 const engaged=enemies.filter(e=>['alert','chase','windup','recover'].includes(e.mode));
 // Actual optics, not just the state name: guards may remember our position
 // even after cover blocks the ray. Telegraphs still pose a danger while
 // their locked strike has an unobstructed path.
 if(engaged.some(e=>(e.mode==='windup'&&facilityVisionClear(e,p))||
  facilityCanSeePlayer(e,p,enemyDefinition(e.kind),true)))
  return {mode:'chase',percent:100,label:'発見中・遮蔽物へ'};
 if(engaged.length){
  const tracking=engaged.filter(e=>e.mode==='alert'||e.mode==='chase');
  const left=tracking.length?Math.max(0,...tracking.map(e=>
   TILED_BALANCE.chaseMemory-Math.max(0,elapsed-(Number(e.lastSeen)||0)))):0;
  return {mode:'evade',percent:0,label:tracking.length&&left>0?
   '視線切断・追跡残り'+Math.ceil(left)+'秒':'視線切断・まだ警戒中'};
 }
 const notice=enemies.reduce((max,e)=>Math.max(max,Math.max(0,Number(e.notice)||0)),0);
 if(notice>.025)return {mode:'notice',percent:Math.min(99,Math.round(notice/facilityNoticeThreshold()*100)),label:'視線注意・隠れよう'};
 const searching=enemies.filter(e=>e.mode==='search');
 if(searching.length){
  const left=Math.max(0,...searching.map(e=>Math.max(0,(Number(e.searchUntil)||elapsed)-elapsed)));
  return {mode:'search',percent:0,label:(v5InHidingAlcove()?'隠れ場所・':'捜索中・')+
   (left>0?'残り'+Math.ceil(left)+'秒':'捜索中')};
 }
 return {mode:'hidden',percent:0,label:v5InHidingAlcove()?'隠れ場所・敵の視線なし':'未発見'};
}
function updateHUD(force=false){
 if(!run||run.status!=='playing')return;
 if(!force&&Date.now()-lastHud<110)return;
 lastHud=Date.now();
 const txt=(id,value)=>{const e=document.getElementById(id);if(e&&e.textContent!==String(value))e.textContent=value};
 const m=remaining(),min=Math.floor(m/60),sec=Math.floor(m%60);
 txt('exp-clock',run.mapVersion===3?'無制限':String(min).padStart(2,'0')+':'+String(sec).padStart(2,'0'));
 // R5.70: warn inside the existing clock, never obstructing the map with banners.
 // Only timed facility raids use 90s/45s indicators; old endless mode remains neutral.
 const clock=document.getElementById('exp-clock');
 if(clock)clock.dataset.urgency=run.mapVersion>=4?(m<=45?'critical':m<=90?'soon':'normal'):'normal';
 txt('exp-health',run.player.hp+'/'+run.stats.maxHp);
 const burden=weightLabel();
 const stakes=run.mapVersion===5?v5ExtractionStakes():null;
 txt('exp-bag',run.loot.length+'点');
 if(run.mapVersion===5){
  const amounts=lootSummary();
  txt('exp-loot-base-total',lootCurrency(amounts.total));
  txt('exp-loot-base-protected',lootCurrency(amounts.secured));
  txt('exp-loot-exit-distance',v5ReturnRisk().text);
  // Live stakes are scoped above both the bag and objective HUD branches.
  const rareLine=stakes.unsecuredCount?
   '未保護SSR以上 '+stakes.unsecuredCount+'点・基準 '+lootCurrency(stakes.exposedValue)+
   ' ／ ポーチ空き '+stakes.pouchFree:'';
  txt('exp-extraction-stakes',rareLine);
  const riskBadge=document.getElementById('exp-extraction-stakes');
  if(riskBadge)riskBadge.dataset.risk=stakes.unsecuredCount?'exposed':'none';
  txt('exp-bag-rare-risk',rareLine);
  txt('exp-room-label',vaultLayout()?.themeAt(run.player)||'共用通路');
  const regionTag=document.getElementById('exp-room-label');
  if(regionTag)regionTag.dataset.theme=vaultLayout()?.themeStyleAt(run.player)||'corridor';
 }
 txt('exp-weight',burden.text);
 txt('exp-weight-status',run.mapVersion===5?v5CargoRisk().text:burden.tier?'重量超過・移動速度'+burden.pct+'%':'移動速度100%');
 const bar=document.getElementById('exp-weight-fill');
 if(bar)bar.style.width=Math.min(100,burden.weight/(burden.limit*10)*100).toFixed(1)+'%';
 const meter=document.getElementById('exp-weight-meter');
 if(meter){meter.dataset.tier=String(burden.tier);meter.setAttribute('aria-valuenow',formatWeight(burden.weight))}
 const bagButton=document.getElementById('exp-bag-button');
 if(bagButton){bagButton.dataset.tier=String(burden.tier);bagButton.textContent='バッグ '+formatWeight(burden.weight)+'kg'}
 txt('exp-safe-count',(run.safeIds||[]).length+'/'+SAFE_POUCH_CAP);
 txt('exp-enemies',run.enemies.length+'体');
 if(run.mapVersion===5){
  const stage=document.getElementById('exp-vault-stage');
  if(stage)stage.dataset.alarm=run.vaultAlarm?'true':'false';
  const escapeProgress=stakes.progress===null?'':' ・ 帰還路約'+stakes.progress+'%';
  txt('exp-vault-objective',run.vaultAlarm?'🚨警報中：北東脱出口へ'+escapeProgress:
   run.vaultSealed?'⛔入口封鎖：非常ハッチから帰還':
   run.vaultUnlocked?'🔓金庫扉解錠済み：入場で閉鎖':
   run.hasKeycard?'🔑カード所持：右下の扉へ':
   '🔑警備室でカードキーを探せ');
 }
 // Wider vision can start offscreen; provide a legible pre-detection hint.
  const pursued=run.enemies.some(e=>['alert','chase','windup','recover'].includes(e.mode));
  const watched=run.enemies.some(e=>run.mapVersion>=4&&['patrol','search'].includes(e.mode)&&(e.notice||0)>.05);
  txt('exp-danger-label',run.mapVersion>=4?
   '警戒'+(facilityThreatLevel()+1)+(pursued?'・発見中':watched?'・視線注意':'・未発見'):'敵');
 if(run.mapVersion===5){
  const stealth=stealthSituation();
  const panel=document.getElementById('exp-stealth-status');
  if(panel)panel.dataset.state=stealth.mode;
  txt('exp-stealth-label',stealth.label);
  const fill=document.getElementById('exp-stealth-fill');
  if(fill)fill.style.width=stealth.percent+'%';
  const meter=document.getElementById('exp-stealth-meter');
  if(meter)meter.setAttribute('aria-valuenow',String(stealth.percent));
 }
 const hp=document.getElementById('exp-hp-fill');if(hp)hp.style.width=(run.player.hp/run.stats.maxHp*100)+'%';
 const nearby=run.mapVersion>=2?nearContainer():null;
 const near=run.mapVersion>=2?!!nearby:run.chests.some(c=>!c.opened&&distance(c,run.player)<INTERACT_RANGE);
 const atExit=distance(run.player,exitPoint())<=58;
 const card=run.mapVersion===5?nearVaultKeycard():null;
 const gate=run.mapVersion===5?nearVaultGate():null;
 const hatch=run.mapVersion===5?nearVaultHatch():null;
 const btn=document.getElementById('exp-interact');
 if(btn){
  const canExit=atExit;
  btn.dataset.context=canExit?'exit':card?'keycard':hatch?'hatch':gate?'gate':near?(run.mapVersion>=2?'container':'chest'):'none';
  // Always receive the tap: out-of-range interactions show an explanation instead of appearing broken.
   btn.disabled=false;
  const label=canExit?'脱出する':card?'🔑拾う':hatch?'非常ハッチ':gate?(run.vaultSealed?'扉が閉鎖':run.vaultUnlocked?'扉通行可':'カード認証'):near?(run.mapVersion>=2?'調べる':'開ける'):'調べる';
  if(btn.textContent!==label)btn.textContent=label;
  btn.setAttribute('aria-label',canExit?'探索を終了して帰還する':card?'マスターカードキーを拾う':hatch?'非常ハッチから警備強化された別通路へ脱出する':gate?'カードキー扉を操作する':near?(run.mapVersion>=2?'近くの棚やロッカーを調べる':'近くの宝箱を開ける'):'近くに調べられるものはありません');
 }
 const list=document.getElementById('exp-loot');
 if(list){
  const signature=run.loot.map(v=>v.id+':'+v.q+':'+v.tid+':'+(run.safeIds||[]).includes(v.tid)).join(',')+
   (run.mapVersion===5?'|'+(run.lootSort||'value'):'');
  if(list.dataset.signature!==signature){
   list.dataset.signature=signature;
   list.innerHTML=run.mapVersion===5?lootRowsV5():run.loot.map((v,i)=>{
    const it=item(v.id),safe=(run.safeIds||[]).includes(v.tid);
    return '<div class="exp-loot-item'+(safe?' exp-protected':'')+'"><img src="'+it.image+'" alt=""><span><b>'+escapeHTML(it.name)+'</b><small>'+it.rarity+' ・ '+QNAME[v.q]+' ・ '+itemWeightLine(it)+(safe?' ・ 安全ポーチ':'')+'</small></span>'+
     '<button type="button" class="exp-safe-toggle" data-explore="protect" data-i="'+i+'" aria-pressed="'+safe+'" aria-label="'+escapeHTML(it.name)+(safe?'の保護解除':'を安全ポーチに保護')+'">'+(safe?'🔒':'保護')+'</button>'+
     '<button type="button" data-explore="drop" data-i="'+i+'" aria-label="'+escapeHTML(it.name)+'を捨てる">×</button></div>';
   }).join('')||'<p>まだ戦利品はありません</p>';
  }
 }
 txt('exp-note',Date.now()<run.messageUntil?run.message:'');
 const feedback=document.getElementById('exp-action-toast');
 if(feedback){const visible=Date.now()<run.messageUntil;feedback.dataset.active=String(visible);if(visible&&feedback.textContent!==run.message)feedback.textContent=run.message}
 const ab=document.getElementById('exp-auto');if(ab){
  const label=run.autoAttack?'AUTO ON':'AUTO OFF';
  if(ab.textContent!==label)ab.textContent=label;
  ab.setAttribute('aria-pressed',String(run.autoAttack));
 }
 const wb=document.getElementById('exp-swap');
 if(wb){
  const current=weaponProfile(run.weaponSlot),next=weaponProfile(1-run.weaponSlot);
  const label=(run.weaponSlot===0?'主':'副')+'·'+WEAPON_STYLES[current.style].name;
  if(wb.textContent!==label)wb.textContent=label;
  wb.setAttribute('aria-label','使用中：'+current.name+'（'+WEAPON_STYLES[current.style].name+'）。切替先：'+next.name);
  wb.title='武器切替：'+next.name;
 }
 const attack=document.getElementById('exp-attack');
 if(attack){
  const current=weaponProfile(run.weaponSlot);
  attack.setAttribute('aria-label','攻撃：'+current.name+'、'+WEAPON_STYLES[current.style].name);
  attack.title=current.name+'（'+WEAPON_STYLES[current.style].name+'）';
 }
}
function frame(ts){
 if(!run||run.status!=='playing'||!canvas||!canvas.isConnected){stopLoop();return}
 const rawMs=lastFrame?ts-lastFrame:16.67;
 const dt=clamp(rawMs/1000,0,.045);lastFrame=ts;
 sampleFrame(ts,rawMs);
 if(!run.paused)tick(dt);if(!run||run.status!=='playing')return;
 if(!run.paused)saveRunCheckpoint();
 updateStickFeedback(dt);
 // Pause mode is visually static. Skip redundant drawing behind the dialog.
 if(!run.paused||pauseVisualDirty){draw();pauseVisualDirty=false}
 if(!run.paused)updateHUD();
 raf=requestAnimationFrame(frame);
}
function updateStickFeedback(dt){
 const ui=stickVisual;
 if(!ui.active||!ui.thumb||!ui.thumb.isConnected)return;
 // The virtual stick gently follows the finger; there is no fixed control at rest.
 const k=1-Math.exp(-Math.min(dt,.05)*33);
 ui.x+=(ui.targetX-ui.x)*k;ui.y+=(ui.targetY-ui.y)*k;
 if(Math.abs(ui.x-ui.targetX)<.002)ui.x=ui.targetX;
 if(Math.abs(ui.y-ui.targetY)<.002)ui.y=ui.targetY;
 ui.thumb.style.transform='translate3d('+(ui.x*ui.range).toFixed(1)+'px,'+(ui.y*ui.range).toFixed(1)+'px,0)';
}
// R5.6a: an invisible, full bottom-left screen quadrant starts a joystick
// exactly where the finger first lands. Multi-touch on right action buttons
// remains independent because we capture only the initiating pointer ID.
function bindStick(){
 const zone=document.getElementById('exp-stick-zone');
 const stick=document.getElementById('exp-stick');
 const thumb=document.getElementById('exp-stick-thumb');
 if(!zone||!stick||!thumb||!run)return;
 let pointer=null,originX=0,originY=0,radius=33;
 stickVisual.thumb=thumb;
 stickVisual.active=false;
 stickVisual.x=0;stickVisual.y=0;
 stickVisual.targetX=0;stickVisual.targetY=0;
 thumb.style.transform='translate3d(0,0,0)';
 function reset(){
  const old=pointer;pointer=null;
  stickVisual.active=false;
  stickVisual.targetX=0;stickVisual.targetY=0;
  stickVisual.x=0;stickVisual.y=0;
  if(run)run.joy={x:0,y:0};
  zone.classList.remove('is-active');
  thumb.style.transform='translate3d(0,0,0)';
  if(old!==null&&zone.hasPointerCapture&&zone.hasPointerCapture(old)){
   try{zone.releasePointerCapture(old)}catch(_){}
  }
 }
 stickVisual.release=reset;
 function update(e){
  if(pointer!==e.pointerId||!run||run.paused)return;
  const dx=e.clientX-originX,dy=e.clientY-originY;
  const dist=Math.hypot(dx,dy),tilt=Math.min(1,dist/radius);
  const unitX=dist>.001?dx/dist:0,unitY=dist>.001?dy/dist:0;
  const strength=tilt<.10?0:Math.pow((tilt-.10)/.90,.85);
  run.joy.x=unitX*strength;run.joy.y=unitY*strength;
  stickVisual.targetX=unitX*tilt;stickVisual.targetY=unitY*tilt;
 }
 zone.addEventListener('pointerdown',e=>{
  if(pointer!==null||!run||run.status!=='playing'||run.paused||active!=='explore')return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const bag=document.getElementById('exp-backpack');
  if(bag&&bag.classList.contains('exp-bag-open'))return;
  pointer=e.pointerId;originX=e.clientX;originY=e.clientY;
  zone.classList.add('is-active');
  const zoneBox=zone.getBoundingClientRect();
  const shell=zone.closest('.exp-playing');
  const shellBox=shell?shell.getBoundingClientRect():zoneBox;
  // Keep the visual ring inside the display, even when a finger begins on an edge.
  const visualPad=(stick.offsetWidth||100)/2+4;
  const ringX=clamp(originX,shellBox.left+visualPad,shellBox.right-visualPad);
  const ringY=clamp(originY,shellBox.top+visualPad,shellBox.bottom-visualPad);
  stick.style.left=(ringX-zoneBox.left)+'px';
  stick.style.top=(ringY-zoneBox.top)+'px';
  radius=Math.max(24,((stick.offsetWidth||100)-(thumb.offsetWidth||34))/2);
  stickVisual.range=radius;
  stickVisual.active=true;
  try{zone.setPointerCapture(pointer)}catch(_){}
  update(e);e.preventDefault();
 });
 zone.addEventListener('pointermove',e=>{
  if(pointer!==e.pointerId)return;
  update(e);e.preventDefault();
 });
 zone.addEventListener('pointerup',e=>{if(pointer===e.pointerId){reset();e.preventDefault()}});
 zone.addEventListener('pointercancel',e=>{if(pointer===e.pointerId)reset()});
 zone.addEventListener('lostpointercapture',e=>{if(pointer===e.pointerId)reset()});
}
// R5.69: A steering finger can suppress WebKit's click for ANY right-hand
// control, not only Attack/Swap/Interact. Capture native touchstart on both
// the action grid and the Bag/AUTO row, without touching the joystick pointer.
// Suppress only the synthesized duplicate click; keyboard taps still delegate.
function bindMultiTouchActions(){
 const actions=document.querySelector('.exp-playing .exp-control-actions');
 if(!actions||actions.dataset.multitouchBound==='true')return;
 actions.dataset.multitouchBound='true';
 const touchActivation=new WeakMap();
 actions.addEventListener('touchstart',event=>{
  if(!run||run.status!=='playing'||run.paused||active!=='explore')return;
  const target=event.target;
  const button=target?.closest?.('button[data-explore]');
  if(!button||!actions.contains(button)||button.disabled)return;
  // Stop Safari treating the two-finger gameplay gesture as scrolling/zoom
  // or synthesizing a delayed click. Do not interrupt the joystick finger.
  if(event.cancelable)event.preventDefault();
  touchActivation.set(button,Date.now());
  window.explorationAction(button);
 },{passive:false});
 actions.addEventListener('click',event=>{
  const button=event.target?.closest?.('button[data-explore]');
  if(!button)return;
  // Some WebKit builds generate a click despite preventDefault on touchstart.
  // Suppress ONLY its duplicate. Mouse and keyboard clicks remain delegated.
  const activated=touchActivation.get(button);
  if(activated&&event.detail!==0&&Date.now()-activated<650){
   event.preventDefault();event.stopPropagation();touchActivation.delete(button);
  }
 });
}
function resizeField(){
 const el=document.getElementById('exp-field');if(!el)return;
 const bounds=el.getBoundingClientRect();
 const w=Math.max(280,Math.round(bounds.width)),h=Math.max(360,Math.round(bounds.height));
 if(VIEW.w===w&&VIEW.h===h)return;
 VIEW.w=w;VIEW.h=h;el.width=w;el.height=h;
 if(run&&run.status==='playing')draw();
}
function mount(){
 if(!run||run.status!=='playing'){stopLoop();return}
 document.body.classList.add('exp-immersive');
 const next=document.getElementById('exp-field');
 if(!next)return;
 if(canvas===next&&raf)return;
 stopLoop();canvas=next;ctx=next.getContext('2d');
 if(!ctx){notify('描画環境を使えません');return}
 resizeField();bindStick();bindMultiTouchActions();lastHud=0;updateHUD(true);raf=requestAnimationFrame(frame);
}

 // R5.61: shared Tiled-derived plan for both pre-mission and in-raid maps.
 // Everything placed/blocked in Tiled is part of this *one* blueprint;
 // player markers / unlocked gates / rolled loot are the only live overlays.
const V5_MAP_COLORS={standard:'#e6c66b',mid:'#6bb9e5',high:'#ba8bf5',ultra:'#ff856e'};
const V5_ROOM_COLORS={archive:'#a77b59',pharmacy:'#3f9a8f',control:'#759bac',
 security:'#337ca5',corridor:'#a7995a',storage:'#a57b4d',receiving:'#be975d',
 vault:'#ac7c90',checkpoint:'#4caba5'};
function v5FacilityPlanSvg(layout,live=null){
 const plan=layout.mapBlueprint;
 if(!plan)return '';
 const rects=(items,fill,alpha='1')=>items.map(r=>'<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+
  '" height="'+r.h+'" fill="'+fill+'" opacity="'+alpha+'"/>').join('');
 const labels=layout.themeZones.map(z=>'<text x="'+(z.x+z.w/2)+'" y="'+(z.y+z.h/2)+
  '" text-anchor="middle" font-size="24" font-weight="800" fill="#f3efdc" stroke="#17252c" stroke-width="7" paint-order="stroke">'+escapeHTML(z.name)+'</text>').join('');
 const themed=layout.themeZones.map(z=>'<rect x="'+z.x+'" y="'+z.y+'" width="'+z.w+'" height="'+z.h+
  '" fill="'+(V5_ROOM_COLORS[z.style]||'#526e67')+'" opacity=".53"/>').join('');
 const physicalCovers=(plan.covers||[]).map(c=>
  '<rect class="exp-map-physical-cover" x="'+c.x+'" y="'+c.y+'" width="'+c.w+'" height="'+c.h+
  '" fill="#b5bfb8" opacity=".88" stroke="#142428" stroke-width="4"/>').join('');
 const deco=plan.details.map(p=>{
  const char={medicine:'薬',exam:'診',monitor:'監',camera:'撮',gold:'金',laser:'警',
   books:'本',document:'書',power:'電',pipe:'管',switches:'盤',pallet:'荷',barcode:'品',
   loading:'搬',forklift:'車',crate:'箱',scan:'検',exit:'出',barrier:'止',cross:'医',arrows:'→'}[p.detail]||'·';
  const color=V5_ROOM_COLORS[p.style]||'#aebbb0';
  return '<rect x="'+(p.x-15)+'" y="'+(p.y-14)+'" width="30" height="28" rx="4" fill="#1b2e35" stroke="'+color+'" stroke-width="3"/>'+
   '<text x="'+p.x+'" y="'+(p.y+7)+'" font-size="19" font-weight="bold" text-anchor="middle" fill="#f5eee0">'+char+'</text>';
 }).join('');
 const fallback=layout.authoredContainers||[];
 const supplies=live?.containers||fallback;
 const loot=supplies.map(c=>{
  const color=V5_MAP_COLORS[c.tier]||V5_MAP_COLORS.standard,opened=!!c.opened;
  return '<circle cx="'+c.x+'" cy="'+c.y+'" r="'+(c.tier==='ultra'?19:15)+
   '" fill="'+(opened?'#20323a':color)+'" stroke="'+color+'" stroke-width="5"'+(opened?' opacity=".55"':'')+'/>'+
   (opened?'<path d="M'+(c.x-8)+' '+(c.y-8)+'l16 16m0 -16l-16 16" stroke="'+color+'" stroke-width="3"/>':'');
 }).join('');
 const alarm=!!live?.vaultHatchUsed;
 const route=layout.escapeRoute.length?
  '<polyline points="'+layout.escapeRoute.map(p=>p.x+','+p.y).join(' ')+'" fill="none" stroke="'+
   (alarm?'#f39a6d':'#deab66')+'" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"'+
   (alarm?'':' stroke-dasharray="16 13"')+' opacity=".88"/>':'';
 const shutterArray=alarm?(live.escapeVariant==='cover'?layout.escapeCoverShutters:layout.escapeShutters):[];
 const blocked=rects(shutterArray,'#b84446','.96');
 const hideouts=alarm&&live.escapeVariant==='cover'?
  layout.escapeNiches.map(n=>'<rect x="'+(n.x-23)+'" y="'+(n.y-23)+'" width="46" height="46" fill="#418a72" opacity=".82"/>'+
   '<circle cx="'+n.x+'" cy="'+n.y+'" r="12" fill="#b8efca"/>').join('')+
   layout.escapeCoverObjects.map(c=>'<rect class="exp-map-hiding-cover" x="'+c.x+'" y="'+c.y+
    '" width="'+c.w+'" height="'+c.h+'" fill="#a7b7a7" stroke="#2b4f47" stroke-width="3"/>').join(''):'';
 const wideCorridor=alarm&&live.escapeVariant==='cover'?
  layout.escapeCoverLaneCells.map(c=>'<rect class="exp-map-wide-corridor" x="'+(c.x-24)+
   '" y="'+(c.y-24)+'" width="48" height="48" fill="#5c9376" opacity=".63"/>').join(''):'';
 const laneBarriers=alarm&&live.escapeVariant==='cover'?
  layout.escapeLaneObjects.map(c=>'<rect class="exp-map-lane-obstacle" x="'+c.x+
   '" y="'+c.y+'" width="'+c.w+'" height="'+c.h+'" fill="'+
   (c.kind==='pallet'?'#ba995e':c.kind==='barrier'?'#aebcc3':'#8f9ea6')+
   '" stroke="#1e3338" stroke-width="4"/>').join(''):'';
 const guardPositions=layout.guardPosts.filter(g=>!g.alarmOnly).map(g=>'<circle cx="'+g.x+'" cy="'+g.y+
  '" r="14" fill="#ca6254" stroke="#ffe1cd" stroke-width="3" opacity=".85"/>').join('');
 const key=layout.vaultKeycard&&!live?.hasKeycard?
  '<circle cx="'+layout.vaultKeycard.x+'" cy="'+layout.vaultKeycard.y+
  '" r="20" fill="#56ced2" stroke="#e1ffff" stroke-width="5"/>'+
  '<text x="'+layout.vaultKeycard.x+'" y="'+(layout.vaultKeycard.y-29)+'" font-size="25" fill="#defbfa" text-anchor="middle">KEY</text>':'';
 const gate=layout.vaultGate?
  '<rect x="'+(layout.vaultGate.x-21)+'" y="'+(layout.vaultGate.y-21)+
  '" width="42" height="42" rx="4" fill="'+
  (live?.vaultSealed?'#ad3f45':live?.vaultUnlocked?'#4caa82':'#d09d4d')+
  '" stroke="#f9e2b4" stroke-width="5"/>':'';
 const hatch=layout.vaultHatch?
  '<rect x="'+(layout.vaultHatch.x-18)+'" y="'+(layout.vaultHatch.y-18)+
  '" width="36" height="36" fill="#479d9e" stroke="#d3f4f3" stroke-width="4"/>':'';
 const exit=live?.player?live.exit:null;
 const target=exit||layout.fixedExit;
 const markers='<circle cx="'+layout.start.x+'" cy="'+layout.start.y+'" r="23" fill="#a6b6ac" stroke="#f4f3dd" stroke-width="6"/>'+
  '<circle cx="'+target.x+'" cy="'+target.y+'" r="24" fill="#82d69e" stroke="#e2ffe7" stroke-width="8"/>'+
  '<text x="'+target.x+'" y="'+(target.y-34)+'" font-size="27" text-anchor="middle" fill="#d3ffe0" stroke="#1b3130" stroke-width="5" paint-order="stroke">EXIT</text>'+
  (live?.player?'<circle cx="'+live.player.x+'" cy="'+live.player.y+'" r="32" fill="#5cb4ff" stroke="white" stroke-width="10"/>'+
   '<circle cx="'+live.player.x+'" cy="'+live.player.y+'" r="10" fill="#eaf8ff"/>':'');
 return '<svg viewBox="0 0 '+layout.w+' '+layout.h+'" class="exp-map-sheet exp-map-v5-svg" role="img" aria-label="施設の床・壁・棚・部屋名・物資・ゲート・現在地を示す詳細地図">'+
  '<rect width="'+layout.w+'" height="'+layout.h+'" fill="#0e1b20"/>'+
  rects(plan.floors,'#314b4c')+themed+rects(plan.accents,'#597379','.23')+
  rects(plan.walls,'#a5a9a6')+rects(plan.fixtures,'#72848a')+
  rects(plan.dressing,'#a79271','.75')+physicalCovers+labels+deco+wideCorridor+route+hideouts+laneBarriers+blocked+
  guardPositions+loot+key+gate+hatch+markers+'</svg>';
}
function v5DetailedMapPanel(layout){
 const z=Math.max(1,Math.min(3,Number(run.mapZoom)||1));
 const live={player:run.player,exit:exitPoint(),containers:run.containers,
  hasKeycard:run.hasKeycard,vaultUnlocked:run.vaultUnlocked,vaultSealed:run.vaultSealed,
  vaultHatchUsed:run.vaultHatchUsed,escapeVariant:run.escapeVariant};
 const mode=live.vaultHatchUsed?(live.escapeVariant==='cover'?'広い一本道＋遮蔽物9個＋隠れ場所5か所':'完全一本道'):
  '非常ハッチ後に帰還ルート確定';
 const back='<button type="button" class="exp-resume" data-explore="map-back">'+
  (run.mapDirect?'▶ 探索に戻る':'← 一時停止メニューへ')+'</button>';
 return '<div class="exp-pause-overlay exp-map-v5-overlay" role="dialog" aria-modal="true" aria-label="屋内施設の詳細な探索地図">'+
  '<div class="exp-pause-card exp-map-v5-card"><div class="exp-map-v5-heading"><h2>施設詳細地図</h2>'+
  '<span>現在地：'+escapeHTML(layout.themeAt(run.player))+'</span></div>'+
  '<p class="exp-map-v5-description">実際の地形と同じ床・壁・家具の配置。青＝現在地、緑＝北東脱出口、赤＝警備地点・封鎖。'+
  '地図を開いている間は探索時間が止まります。</p>'+
  '<div class="exp-map-v5-tools"><strong>'+mode+'</strong>'+
  '<button type="button" data-explore="map-zoom-out" aria-label="地図を縮小"'+(z===1?' disabled':'')+'>−</button>'+
  '<span>'+Math.round(z*100)+'%</span>'+
  '<button type="button" data-explore="map-zoom-in" aria-label="地図を拡大"'+(z===3?' disabled':'')+'>＋</button></div>'+
  '<div id="exp-map-scroll" class="exp-map-v5-scroll" tabindex="0" role="region" aria-label="拡大できる施設の全体図。拡大後は指でスクロール">'+
  '<div class="exp-map-v5-zoom" style="width:'+Math.round(z*100)+'%">'+v5FacilityPlanSvg(layout,live)+'</div></div>'+
  '<div class="exp-map-v5-legend"><span>● 青：現在地</span><span>● 緑：脱出口</span><span>● 黄青紫赤金：物資</span>'+
  '<span>□ 水色：カードキー／ハッチ</span><span>■ 灰：遮蔽物</span><span>■ 緑：Bの拡幅通路</span><span>■ 赤：閉鎖シャッター</span><span>×：開封済み</span></div>'+
  back+'</div></div>';
}
function mapPanel(){
 const layout=mapFor(run.mapVersion);
 if(run.mapVersion===5)return v5DetailedMapPanel(layout);
 const p=run.player,exit=exitPoint(),detailed=hasDetailedMap();
 const loc=(x,y)=>({col:Math.max(0,Math.min(3,Math.floor(x/layout.w*4))),
   row:Math.max(0,Math.min(2,Math.floor(y/layout.h*3)))});
 const regionNames=['北西','北部西','北部東','北東','西部','中央西','中央東','東部','南西','南部西','南部東','南東'];
 const reg=loc(exit.x,exit.y),coarseIndex=reg.row*4+reg.col;
 const button='<button type="button" class="exp-resume" data-explore="map-back">'+
  (run.mapDirect?'探索に戻る':'一時停止メニューへ戻る')+'</button>';
 if(!detailed){
  const tiles=Array.from({length:12},(_,i)=>{
   const x=(i%4)*90,y=Math.floor(i/4)*90;
   return '<rect x="'+(x+3)+'" y="'+(y+3)+'" width="84" height="84" fill="'+
    (i===coarseIndex?'#596d55':'#25392e')+'" stroke="'+(i===coarseIndex?'#c9c087':'#697b6a')+
    '" stroke-width="'+(i===coarseIndex?'2.5':'1')+'"/>';
  }).join('');
  const current=loc(p.x,p.y);
  return '<div class="exp-pause-overlay" role="dialog" aria-modal="true" aria-label="出口のおおまかな地図"><div class="exp-pause-card exp-visited-map">'+
   '<h2>出口の方角</h2><p>'+(isFixedFacilityExit()?'固定脱出口の区域を表示中。':'脱出口の候補区域を表示中。')+'正確な位置・通路は施設案内図が必要です。</p>'+
   '<svg viewBox="0 0 360 270" class="exp-map-sheet exp-map-coarse" role="img" aria-label="脱出口は'+regionNames[coarseIndex]+'付近">'+
   tiles+'<circle cx="'+(current.col*90+45)+'" cy="'+(current.row*90+45)+'" r="10" fill="#b1d8f5" stroke="#e3f6ff" stroke-width="3"/>'+
   '<path d="M'+(reg.col*90+45)+' '+(reg.row*90+30)+'l15 26h-30Z" fill="#efd0a0" stroke="#fff0c5" stroke-width="2"/></svg>'+
   '<p class="exp-map-hint"><strong>脱出口：'+regionNames[coarseIndex]+'付近</strong>（範囲表示）</p>'+
   '<div class="exp-map-legend"><span>青：自分がいる区域</span><span>黄：'+(isFixedFacilityExit()?'固定脱出区域':'脱出候補区域')+'</span></div>'+
   '<p>物資の色：黄＝一般、青＝中級、紫＝高級の期待度。黄色からもレア品は出ます。</p>'+'<p>施設案内図を探索道具に装備するか、探索中に拾うと詳細地図に切り替わります。</p>'+button+'</div></div>';
 }
 const visited=new Set(run.visitedRooms||[]);
 const cells=run.mapVersion>=4
  ?layout.floorRects.map(r=>'<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.h+'" fill="#536a5f"/>').join('')
  :layout.rooms.map((r,i)=>'<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.h+
   '" fill="'+(visited.has(i)?'#536a5f':'#28362f')+'" stroke="#77877a" stroke-width="14"/>').join('');
 const roomTints=run.mapVersion===5&&layout.themeZones?layout.themeZones.map(z=>'<rect x="'+z.x+'" y="'+z.y+'" width="'+z.w+'" height="'+z.h+'" fill="'+({archive:'#ac785b',pharmacy:'#59b9ac',control:'#7cacc0',security:'#4789b8',corridor:'#c4ae68',storage:'#ad875d',receiving:'#caa86c',vault:'#c18d9d',checkpoint:'#80c8c8'}[z.style]||'#59726e')+'" opacity=".32"/>').join(''):'';
 const routes=run.mapVersion>=4
  ?layout.walls.map(b=>'<rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" fill="#17241f"/>').join('')+
   layout.fixtures.map(b=>'<rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" fill="#839183" opacity=".65"/>').join('')
  :layout.links.map(([a,b])=>{
   const A=layout.rooms[a],B=layout.rooms[b];
   return '<line x1="'+(A.x+A.w/2)+'" y1="'+(A.y+A.h/2)+'" x2="'+(B.x+B.w/2)+'" y2="'+(B.y+B.h/2)+
    '" stroke="#a3b9a8" stroke-width="31" opacity=".88"/>';
  }).join('');
 return '<div class="exp-pause-overlay" role="dialog" aria-modal="true" aria-label="施設案内図の詳細マップ"><div class="exp-pause-card exp-visited-map">'+
  '<h2>施設案内図</h2><p>全'+layout.rooms.length+'区画の接続と今回の脱出口を表示。'+(run.vaultHatchUsed?'赤いシャッターが通行禁止。'+(run.escapeVariant==='cover'?'隠れ場所がある一本道です。':'完全な一本道です。'):'戦利品の中身や敵の位置は表示しません。')+'物資の色は黄＝一般、青＝中級、紫＝高級の期待度です。</p>'+
  '<svg viewBox="0 0 '+layout.w+' '+layout.h+'" class="exp-map-sheet" role="img" aria-label="区画と通路、正確な脱出口、現在地">'+
  cells+roomTints+routes+(run.mapVersion===5&&run.vaultHatchUsed&&run.escapeVariant==='cover'?layout.escapeNiches.map(n=>'<rect x="'+(n.x-23)+'" y="'+(n.y-23)+'" width="46" height="46" fill="#547464"/>').join(''):'')+(run.mapVersion===5&&run.vaultHatchUsed?(run.escapeVariant==='cover'?layout.escapeCoverShutters:layout.escapeShutters).map(b=>'<rect x="'+b.x+'" y="'+b.y+'" width="'+b.w+'" height="'+b.h+'" fill="#b14d48"/>').join(''):'')+'<circle cx="'+layout.start.x+'" cy="'+layout.start.y+'" r="48" fill="#abb5a2" stroke="#f1f0d6" stroke-width="12"/>'+
  '<path d="M'+exit.x+' '+(exit.y-100)+'l83 140h-166Z" fill="#efd0a0" stroke="#fff3cd" stroke-width="17"/>'+
  '<circle cx="'+p.x+'" cy="'+p.y+'" r="59" fill="#b1d8f5" stroke="#e3f6ff" stroke-width="17"/></svg>'+
  '<div class="exp-map-legend"><span>青：現在地</span><span>黄：脱出口</span><span>灰：入口</span><span>踏査 '+visited.size+'/'+layout.rooms.length+'エリア</span></div>'+
  button+'</div></div>';
}
let facilityPreviewOpen=false;
let facilityPreviewVariant='overview'; // shows the exact physical escape route shutters
function facilityPreviewPanel(){
 const m=indoorModeSelected&&MallV5?MallV5:MallV4;
 if(!m)return '';
 if(m===MallV5){
  return '<div class="exp-map-preview" role="dialog" aria-modal="true" aria-label="屋内施設の出撃前詳細地図">'+
   '<div class="exp-map-preview-card exp-map-v5-preview"><h2>屋内施設 V5｜出撃前の施設図</h2>'+
   '<p>探索中の詳細地図と共通のTiledデータを使用。薬局、警備室、書庫、設備室、倉庫、搬入口、金庫、検問を色分け。'+
   '左上は高級物資、右下は警備室でカードキー入手後に開ける最上位金庫。'+
   'オレンジ点線はハッチ後の共通帰還ルート。下のボタンで実際の封鎖位置を確認できます。</p>'+
   '<div class="exp-map-variant-controls" role="group" aria-label="脱出経路を切り替え">'+
   '<button type="button" data-explore="preview-variant-overview" aria-pressed="'+(facilityPreviewVariant==='overview')+'">通常時</button>'+
   '<button type="button" data-explore="preview-variant-strict" aria-pressed="'+(facilityPreviewVariant==='strict')+'">A：完全一本道</button>'+
   '<button type="button" data-explore="preview-variant-cover" aria-pressed="'+(facilityPreviewVariant==='cover')+'">B：拡幅＋障害物</button></div>'+
   '<p class="exp-map-variant-note">'+(facilityPreviewVariant==='overview'?'出撃前：まだ封鎖されていません。':facilityPreviewVariant==='strict'?'A：ハッチ使用後。全ての分岐が封鎖された一本道。':'B：ハッチ使用後。中央は2〜3マス幅で、9個の遮蔽物を避けながら進みます。隠れ場所5か所は行き止まり。')+'</p>'+
   '<div class="exp-map-v5-scroll exp-map-v5-preview-scroll" role="region" aria-label="出撃前の施設詳細図">'+
   '<div class="exp-map-v5-zoom">'+v5FacilityPlanSvg(m,facilityPreviewVariant==='overview'?null:{vaultHatchUsed:true,escapeVariant:facilityPreviewVariant})+'</div></div>'+
   '<p class="exp-preview-rarity">SSR以上（1点あたり）：黄 '+v5SsrPlusPercent('standard').toFixed(1)+
   '% ／ 青 '+v5SsrPlusPercent('mid').toFixed(1)+'% ／ 紫 '+v5SsrPlusPercent('high').toFixed(1)+
   '% ／ 赤金 '+v5SsrPlusPercent('ultra').toFixed(1)+'%。レア度は確定ではありません。色は期待度を表します。</p>'+
   '<button type="button" class="exp-map-preview-close" data-explore="preview-close">地図を閉じる</button></div></div>';
 }
 const shapes=m.floorRects.map((r,i)=>'<rect x="'+r.x+'" y="'+r.y+'" width="'+r.w+'" height="'+r.h+
  '" fill="'+(['#34443b','#3e4740','#35463e','#3b4a42'][i%4])+'"/>').join('');
 const walls=m.walls.map(w=>'<rect x="'+w.x+'" y="'+w.y+'" width="'+w.w+'" height="'+w.h+'" fill="#a1a69a"/>').join('');
 const furniture=m.fixtures.map(o=>'<rect x="'+o.x+'" y="'+o.y+'" width="'+o.w+'" height="'+o.h+
  '" fill="'+(['shelf','locker'].includes(o.kind)?'#8b8f79':o.kind==='crate'?'#9a7859':'#b59b78')+'"/>').join('');
 const blockNames=m.floorRects.map(r=>'<text x="'+(r.x+r.w/2)+'" y="'+(r.y+r.h/2)+
  '" text-anchor="middle" fill="#dfd8bd" font-size="68" font-weight="700" stroke="#18241f" stroke-width="13" paint-order="stroke">'+
  escapeHTML(r.name)+'</text>').join('');
 return '<div class="exp-map-preview" role="dialog" aria-modal="true" aria-label="新しい一体型施設の下見"><div class="exp-map-preview-card">'+
 '<p class="exp-map-preview-eyebrow">NEW FACILITY / R5.30</p>'+
 '<h2>新施設の全体構造</h2>'+
 '<p>旧48区画のマップとは別の、全区域共通の新規出撃用地形。実際の床・壁・家具データを使った下見図です。閲覧しても現在の探索・持込装備・セーブは変更されません。</p>'+
 '<svg class="exp-map-preview-svg" viewBox="0 0 '+m.w+' '+m.h+'" role="img" aria-label="中央売場、北倉庫、管理室、搬入口をつないだ不規則な建物の全体図">'+
 '<rect width="'+m.w+'" height="'+m.h+'" fill="#121a17"/>'+
 shapes+furniture+walls+blockNames+
 '<circle cx="'+m.start.x+'" cy="'+m.start.y+'" r="80" fill="#9cd1f2" stroke="#fff" stroke-width="22"/>'+
 '</svg>'+
 '<p class="exp-map-preview-key">青い点＝入口　｜　灰色＝壁　｜　黄茶色＝棚・探索設備</p>'+
 '<p>'+(run?.mapVersion>=4&&!isFixedFacilityExit()?'復元中の旧探索では抽選された脱出口を維持します。':'新施設の脱出口は西サービス棟の固定地点です。正確な道順は探索用の施設案内図で確認できます。')+'</p>'+
 '<button type="button" class="exp-map-preview-close" data-explore="preview-close">下見を閉じる（セーブ維持）</button>'+
 '</div></div>';
}
function pausePanel(){
 if(!run||!run.paused)return '';
 if(facilityPreviewOpen)return facilityPreviewPanel();
 if(run.lootOpenId)return containerPanel();
 if(run.showMap&&run.mapVersion>=3)return mapPanel();
 return '<div class="exp-pause-overlay" role="dialog" aria-modal="true" aria-label="探索を一時停止"><div class="exp-pause-card">'+
 '<h2>⏸ 一時停止</h2><p>敵・攻撃・探索の進行を停止中</p>'+
 (run.mapVersion<4&&MallV4?'<p class="exp-old-map-notice"><strong>旧マップを復帰中</strong>：途中セーブの地形を維持しています。新マップは次の廃商業区への新規出撃から適用されます。</p>'+
 '<button type="button" class="exp-preview-open" data-explore="preview-map">新施設の全体図を下見（途中セーブ維持）</button>':'')+
 (run.mapVersion>=3?'<button type="button" class="exp-map-open" data-explore="map">'+(run.mapVersion===5?'施設の詳細地図を開く':'踏査した区画の地図を見る')+'</button>':'')+
 (run.mapVersion===5?'<p class="exp-pause-note">帰還判断：'+v5ReturnRisk().text+'。直線最短は経路・戦闘を含まない下限です。重すぎる場合は戦利品を捨てて速度を回復できます。</p>':'')+
 '<p class="exp-pause-note">描画計測：'+(perf.fps?perf.fps+' FPS':'計測中')+
 ' ／ 40ms以上のフレーム：'+perf.slow+'回（この探索セッション）'+
 (run.mapVersion===5&&run.vaultAlarm?' ／ 警報中40ms以上：'+perf.alarmSlow+'/'+perf.alarmFrames+'フレーム':'')+'</p>'+
 '<h3>戦利品 '+run.loot.length+'点 ・ '+weightLabel().text+' ・ 安全ポーチ '+(run.safeIds||[]).length+'/'+SAFE_POUCH_CAP+'</h3>'+
 (run.mapVersion===5?'<p class="exp-pause-note">売却基準合計 '+lootCurrency(lootSummary().total)+' ／ 保護済 '+lootCurrency(lootSummary().secured)+' ／ 荷重速度 '+weightLabel().pct+'%</p>'+
  lootSortControls()+lootAutoProtectButton():'')+
 '<div class="exp-pause-loot">'+(run.mapVersion===5?lootRowsV5():run.loot.length?run.loot.map((v,i)=>{
  const it=item(v.id),safe=(run.safeIds||[]).includes(v.tid);
  return '<div class="exp-loot-item'+(safe?' exp-protected':'')+'"><img src="'+it.image+'" alt=""><span><b>'+escapeHTML(it.name)+'</b><small>'+escapeHTML(it.rarity)+' / '+QNAME[v.q]+' / '+itemWeightLine(it)+(safe?' ・ 保護中':'')+'</small></span>'+
    '<button type="button" class="exp-safe-toggle" data-explore="protect" data-i="'+i+'" aria-pressed="'+safe+'">'+(safe?'🔒':'保護')+'</button>'+
    '<button type="button" data-explore="drop" data-i="'+i+'">捨てる</button></div>';
 }).join(''):'<p>まだ戦利品はありません</p>')+'</div>'+
 '<h3>装備変更（7枠・全てロスト対象）</h3><div class="exp-pause-gears">'+gearGrid()+'</div>'+
 '<p class="exp-pause-note">有利な武器：打撃→重装、連撃→高速、長射程→通常。武器切替は探索中も可能です。</p>'+
 '<p class="exp-pause-note">現在の移動速度：'+weightLabel().pct+'%。超過が気になる場合は重い戦利品を捨てられます。安全ポーチの中身も重量に含まれます。</p>'+
 '<p class="exp-pause-note">死亡・時間切れ・途中撤退では、持込装備が消失します。安全ポーチの最大2点は回収できます。</p>'+
 '<button type="button" class="exp-resume" data-explore="pause">▶ 探索を再開</button></div></div>';
}
function togglePause(){
 if(!run||run.status!=='playing')return;
 if(run.paused){run.start+=Date.now()-run.pausedAt;run.paused=false;run.pausedAt=0;run.showMap=false;run.joy={x:0,y:0};perf.windowStart=0;perf.frames=0;lastFrame=0;keys.clear();}
 else{if(stickVisual.release)stickVisual.release();run.paused=true;run.pausedAt=Date.now();run.joy={x:0,y:0};run.steer={x:0,y:0};stickVisual.targetX=0;stickVisual.targetY=0;keys.clear();}
 pauseVisualDirty=true;
 const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel();
 saveRunCheckpoint(true);
 const btn=document.getElementById('exp-pause-toggle');if(btn){btn.textContent=run.paused?'▶':'⏸';btn.setAttribute('aria-label',run.paused?'探索を再開':'探索を一時停止')}
 updateHUD(true);
}
function lastExploreReportHTML(){
 const report=state.exploreLastResult;
 if(!report||!['escaped','lost','abandon'].includes(report.status))return '';
 const won=report.status==='escaped',saved=Array.isArray(report.saved)?report.saved:[],
  lost=Array.isArray(report.lost)?report.lost:[];
 const safeSaved=saved.length;
 const detail=saved.map(v=>{
  const it=item(v.id);
  return it?'<span class="exp-report-chip">✓ '+escapeHTML(it.name)+'</span>':'';
 }).join('');
 const lostDetail=lost.map(v=>'<span class="exp-report-chip exp-report-lost">✕ '+escapeHTML(v.name||item(v.id)?.name||'財宝')+'</span>').join('');
 return '<div class="exp-report" role="status"><strong class="'+(won?'success':'failure')+'">'+
  (won?'帰還成功':report.status==='abandon'?'途中撤退':'探索失敗')+'</strong>'+
  '<p>'+(won?'戦利品を全て持ち帰りました。':'安全ポーチ以外の戦利品と持込装備がロスト対象です。')+'</p>'+
  '<p>回収した戦利品 '+safeSaved+'点 / 失った装備 '+lost.length+'点 / ガチャ券 '+(report.tickets||0)+'枚</p>'+
  (detail?'<div class="exp-report-chips">'+detail+'</div>':'')+
  (lostDetail?'<p class="exp-report-note">消失した装備</p><div class="exp-report-chips">'+lostDetail+'</div>':'')+
  '</div>';
}
function contents(){
 if(!run)restoreRunIfNeeded();
 if(!run&&state.exploreRun?.mapVersion===5&&!MallV5)return '<section class="exp-shell"><h1>屋内探索の復元準備中</h1><p>地形データを読み込んでいます。セーブは変更しません。'+escapeHTML(indoorLoadError)+'</p></section>';
 if(!run||run.status==='lost'||run.status==='escaped'){
  return '<section class="exp-shell"><div class="exp-hero"><div class="exp-eyebrow">EXTRACTION / PROTOTYPE</div><h1>財宝探索</h1>'+
   '<p>棚・ロッカー・宝箱を調べ、欲しい財宝を選んで帰還せよ。回収画面では時間が停止する。</p></div>'+
   lastExploreReportHTML()+
   '<div class="exp-intro"><h2>探索ルール</h2><p>'+
   (indoorModeSelected?'V5：左上の高レア書庫と右下の最上位金庫が目標。右下は警備室のマスターカードキーで扉を開け、入場後は入口が封鎖。非常ハッチから出ると警報で抜け道が封鎖。完全一本道か、途中に隠れられる行き止まりの脇スペース付き一本道がランダムで決まる。北東脱出口へ向かおう。敵を避けるか戦うかは自由。自動攻撃は初期OFF。':'V4：3,600×2,600pxの一体型施設で80物資を探索。中央売場と廊下を使って固定出口へ帰還する。')+
   '制限時間5分。敵3タイプ、手動/オート戦闘、装備、戦利品、地図、途中セーブ、ロスト、安全ポーチを共通利用。物資の黄/青/紫はレア度の期待値で、確定中身ではない。持込装備は失敗時に消失。重量が増えるほど移動速度が下がります。</p>'+
   '<div class="exp-checks"><span>1階：廊下・間仕切り・迂回路あり</span><span>物資：黄＝一般・青＝中級・紫＝高級・赤金＝最上位</span><span>V5：南西スタート・北東脱出口</span><span>V5：左上は高レア、右下はカードキー必須の最上位金庫</span><span>自動攻撃は切り替え可能（V5初期OFF）</span><span>移動：画面左下どこでもタッチ</span><span>重量超過：移動速度が低下</span><span>攻撃：自動／手動</span><span>敵：通常・高速・重装（後半）</span><span>警告範囲から離れて攻撃回避</span><span>宝箱：近づいて開封</span></div></div>'+
   areaPicker()+'<div class="exp-layout-choice" role="group" aria-label="出撃先の地形"><h3>出撃マップ</h3><button type="button" data-explore="layout-tiled" aria-pressed="'+indoorModeSelected+'">屋内ドット絵施設 V5 '+(MallV5?'（プレイ可能）':indoorLoadError?'（読込失敗）':'（読み込み中）')+'</button><button type="button" data-explore="layout-classic" aria-pressed="'+(!indoorModeSelected)+'">従来の一体型施設 V4</button></div>'+((indoorModeSelected?MallV5:MallV4)?'<button type="button" class="exp-preview-open" data-explore="preview-map">'+(indoorModeSelected?'🗺 出撃前に全体地図を見る':'新施設の全体図を下見する')+'</button>':'')+
   '<a class="exp-pilot-map-link" href="maps/indoor/demo.html">屋内マップの旧・独立試遊版 <small>R5.32 / 本編は上の切替から</small></a>'+
   '<div class="exp-loadout"><h2>7枠装備を選ぶ</h2>'+gearGrid()+'<p class="exp-caption">🔒保護中の財宝は出撃不可。同じ所持品を複数枠に装備できません。胴・脚の候補は今後の財宝追加に対応します。</p></div>'+
   '<p class="exp-risk-alert">⚠ 出撃装備は失敗・途中撤退で消失します。大切な財宝は装備せず保管してください。</p><p id="exp-start-notice" class="exp-start-notice" aria-live="polite"></p>'+ '<button class="exp-start" data-explore="start">リスクを確認して出撃 <span>→</span></button>'+
   '<p class="exp-caption">探索中は数秒おきに途中保存。再読み込み後は一時停止状態で再開可能。出撃装備は死亡・時間切れ・途中撤退で消失し、安全ポーチの2点は回収できます。</p>'+(facilityPreviewOpen?facilityPreviewPanel():'')+'</section>';
 }
 if(run.status==='saving')return '<section class="exp-shell"><h1>帰還処理中</h1><p>戦利品をセーブしています。保存完了後に結果を表示します。</p></section>';
 return '<section class="exp-shell exp-playing">'+(run.mapVersion>=3?'<button type="button" id="exp-map-toggle" class="exp-map-toggle" data-explore="field-map" aria-label="'+(run.mapVersion===5?'施設の詳細地図を表示':'マップを表示')+'">'+(run.mapVersion===5?'詳細地図':'地図')+'</button>':'')+'<button type="button" id="exp-pause-toggle" class="exp-pause-toggle" data-explore="pause" aria-label="'+(run.paused?'探索を再開':'探索を一時停止')+'">'+(run.paused?'▶':'⏸')+'</button><div class="exp-hud"><button type="button" class="exp-leave" data-explore="leave">← 拠点</button><div><small>探索タイマー</small><strong id="exp-clock">'+(run.mapVersion===3?'無制限':run.mapVersion>=4?'05:00':'04:00')+'</strong></div><div><small>体力</small><strong id="exp-health">'+run.player.hp+'/'+run.stats.maxHp+'</strong><span class="exp-health-track"><i id="exp-hp-fill" style="width:100%"></i></span></div><div><small id="exp-danger-label">敵</small><strong id="exp-enemies">'+run.enemies.length+'体</strong></div></div>'+
 (run.mapVersion===5?'<div id="exp-stealth-status" class="exp-stealth-status" data-state="hidden" role="status" aria-live="polite"><span id="exp-stealth-label">未発見</span><span id="exp-stealth-meter" class="exp-stealth-meter" role="progressbar" aria-label="発見警戒ゲージ" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="exp-stealth-fill"></i></span></div>'+
 '<div id="exp-vault-stage" class="exp-vault-stage" role="status" data-alarm="'+(run.vaultAlarm?'true':'false')+'"><span id="exp-vault-objective">🔑警備室でカードキーを探せ</span><small id="exp-extraction-stakes" class="exp-vault-risk" data-risk="none"></small></div>':'')+
 '<div class="exp-map-frame"><span class="exp-region-tag" id="exp-room-label" data-theme="'+(run.mapVersion===5?vaultLayout().themeStyleAt(run.player):'corridor')+'">'+escapeHTML(run.mapVersion===5?vaultLayout().themeAt(run.player):areaProfile(run.area).name)+'</span><span class="exp-terrain-tag '+(run.mapVersion>=4?'exp-terrain-new':'exp-terrain-old')+'">'+
 (run.mapVersion===5?'屋内ドット絵施設 V5':run.mapVersion===4?'新地形・一体型施設':run.mapVersion===3?'旧地形・48区画マップ':run.mapVersion===2?'旧地形・16室マップ':'旧試作マップ')+'</span><canvas id="exp-field" width="'+VIEW.w+'" height="'+VIEW.h+'" role="img" aria-label="見下ろし型の探索マップ。画面左下をタッチするかWASDキーで移動します"></canvas><span class="exp-map-brand">アプリ R5.73 / 実際の地形 V'+run.mapVersion+'</span></div>'+
 '<div id="exp-stick-zone" class="exp-stick-zone" aria-label="画面左下をタッチした位置に移動スティックを表示"><div id="exp-stick" class="exp-stick exp-stick-floating" aria-hidden="true"><div class="exp-stick-ring"></div><div id="exp-stick-thumb" class="exp-stick-thumb"></div></div></div>'+ 
 '<div class="exp-controls">'+
 '<div class="exp-control-actions"><div class="exp-action-grid"><button type="button" id="exp-attack" data-explore="attack">攻撃</button><button type="button" id="exp-swap" data-explore="swap">武器 1 ⇄</button><button type="button" id="exp-interact" data-explore="context" disabled>調べる</button></div><div class="exp-action-bottom"><button type="button" id="exp-bag-button" data-explore="bag">バッグ</button><button type="button" id="exp-auto" data-explore="auto" aria-pressed="'+run.autoAttack+'">'+(run.autoAttack?'AUTO ON':'AUTO OFF')+'</button></div></div></div>'+
 '<div id="exp-action-toast" class="exp-action-toast" role="status" aria-live="polite"></div>'+
 '<div id="exp-pause-layer" class="exp-pause-layer">'+pausePanel()+'</div><div class="exp-backpack" id="exp-backpack">'+
  '<div class="exp-bag-title"><strong>戦利品バッグ</strong><span><b id="exp-bag">0点</b> ・ 🔒 <b id="exp-safe-count">0/2</b></span></div>'+
  '<div id="exp-weight-meter" class="exp-weight-meter" data-tier="0" role="progressbar" aria-label="バッグの重量" aria-valuemin="0" aria-valuemax="'+run.stats.weightLimit+'" aria-valuenow="0">'+
  '<div class="exp-weight-numbers"><strong id="exp-weight">0.0 / '+run.stats.weightLimit.toFixed(1)+'kg</strong><span id="exp-weight-status">移動速度100%</span></div>'+
  '<div class="exp-weight-track"><div id="exp-weight-fill"></div></div></div>'+
  '<p class="exp-safe-note">'+(run.mapVersion===5?'容量の70%超から少しずつ速度低下。🔒保護品にも重量があります。価格は売却基準で、取引価格ではありません。':'重量超過で移動速度が低下します。重い品を捨てればすぐ回復。🔒保護品も重量に含まれます。')+'</p>'+
 (run.mapVersion===5?'<div class="exp-bag-overview"><div>売却基準合計 <b id="exp-loot-base-total">0</b></div><div>保護済 <b id="exp-loot-base-protected">0</b></div><small id="exp-loot-exit-distance">脱出まで直線距離を計算中</small><small id="exp-bag-rare-risk" class="exp-bag-rare-risk"></small></div>'+
  lootSortControls()+lootAutoProtectButton():'')+
 '<div id="exp-loot" class="exp-loot-grid"><p>まだ戦利品はありません</p></div><p class="exp-notification" id="exp-note"></p></div>'+
 '<p class="exp-caption">出口から手ぶらでも脱出可能。再読み込み後は一時停止状態で復帰します。途中撤退は持込装備ロスト対象です。</p></section>';
}
window.explorationScreen=contents;
window.explorationAfterRender=()=>{
 document.body.classList.toggle('exp-immersive',Boolean(active==='explore'&&run&&run.status==='playing'));
 if(active!=='explore'){if(run&&run.status==='playing')leaveRun();else stopLoop();return}
 Promise.resolve().then(()=>{if(active==='explore')mount()});
};
window.explorationLeave=confirmLeaveRun;
window.explorationAction=button=>{
 if(!storageReady||actionPersisting)return;
 const type=button.dataset.explore;
 if(type==='preview-map'&&(indoorModeSelected?MallV5:MallV4)&&(!run||run.paused)){
  facilityPreviewOpen=true;facilityPreviewVariant='overview';
  if(run){const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel()}
  else render();
  return;
 }
 if(['preview-variant-overview','preview-variant-strict','preview-variant-cover'].includes(type)&&facilityPreviewOpen){
  facilityPreviewVariant=type.replace('preview-variant-','');
  if(run?.paused){const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel()}
  else render();
  return;
 }
 if(type==='preview-close'){
  facilityPreviewOpen=false;
  if(run?.paused){const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel()}
  else render();
  return;
 }
 if(type==='layout-tiled'||type==='layout-classic'){if(run)return;indoorModeSelected=type==='layout-tiled';render();return}
 if(type==='start'){startRun();return}
 if(type==='leave'){if(!confirmLeaveRun())return;active='home';render();return}
 if(type==='loot-close'){closeContainer();return}
 if(type==='loot-take'){takeContainerItem(button);return}
 if(type==='field-map'&&run?.mapVersion>=3&&run.status==='playing'&&!run.lootOpenId){
  if(run.paused&&run.showMap){
   const direct=!!run.mapDirect;run.showMap=false;run.mapDirect=false;
   if(direct)togglePause();
   else{const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel()}
   return;
  }
  if(!run.paused){togglePause();run.mapDirect=true}else run.mapDirect=false;
  run.showMap=true;const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel();return;
 }
 if(type==='map'&&run?.mapVersion>=3&&run.paused&&!run.lootOpenId){
  run.mapDirect=false;run.showMap=true;const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel();return;
 }
 if((type==='map-zoom-in'||type==='map-zoom-out')&&run?.mapVersion===5&&run.paused&&run.showMap){
  const scroll=document.getElementById('exp-map-scroll');
  const x=scroll?scroll.scrollLeft:0,y=scroll?scroll.scrollTop:0;
  const old=Math.max(1,Math.min(3,Number(run.mapZoom)||1));
  run.mapZoom=Math.max(1,Math.min(3,old+(type==='map-zoom-in'?0.5:-0.5)));
  const layer=document.getElementById('exp-pause-layer');
  if(layer)layer.innerHTML=pausePanel();
  const fresh=document.getElementById('exp-map-scroll');
  if(fresh){const ratio=run.mapZoom/old;fresh.scrollLeft=x*ratio;fresh.scrollTop=y*ratio;}
  return;
 }
 if(type==='map-back'&&run?.mapVersion>=3&&run.paused){
  const direct=!!run.mapDirect;run.showMap=false;run.mapDirect=false;
  if(direct)togglePause();
  else{const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel()}
  return;
 }
 if(type==='pause'){if(run?.lootOpenId)closeContainer();else togglePause();return}
 if(run&&run.paused&&!['drop','protect','bag-sort','auto-protect'].includes(type))return;
 if(type==='bag-sort'&&run?.mapVersion===5&&run.status==='playing'){
  const sort=button.dataset.sort;
  if(!['value','weight','recent'].includes(sort))return;
  run.lootSort=sort;
  const bag=document.getElementById('exp-backpack');
  if(bag&&typeof bag.querySelectorAll==='function')for(const ctrl of bag.querySelectorAll('[data-explore="bag-sort"]'))
   ctrl.setAttribute('aria-pressed',String(ctrl.dataset.sort===sort));
  if(run.paused){const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel()}
  updateHUD(true);return;
 }
 if(type==='auto-protect'&&run?.mapVersion===5&&run.status==='playing'){
  if(!Array.isArray(run.safeIds))run.safeIds=[];
  let remaining=Math.max(0,SAFE_POUCH_CAP-run.safeIds.length);
  if(!remaining){notify('安全ポーチは満杯です');return}
  const secured=new Set(run.safeIds);
  const preferred=run.loot.filter(v=>!secured.has(v.tid)).sort((a,b)=>
   lootBaseValue(b)-lootBaseValue(a)||
   lootBaseValue(b)/Math.max(1,weightTenths(b.id))-lootBaseValue(a)/Math.max(1,weightTenths(a.id))||
   a.tid-b.tid);
  const newIds=preferred.slice(0,remaining).map(v=>v.tid);
  if(!newIds.length){notify('保護できる戦利品がありません');return}
  run.safeIds.push(...newIds);
  notify('高額品 '+newIds.length+'点を空きポーチに保護しました');
  saveRunCheckpoint(true);
  if(run.paused){const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel()}
  updateHUD(true);return;
 }
 if(type==='bag'){
  const bag=document.getElementById('exp-backpack');
  if(bag){if(stickVisual.release)stickVisual.release();bag.classList.toggle('exp-bag-open')}
  return;
 }
 if(run&&run.status==='playing'){
  if(type==='auto'){run.autoAttack=!run.autoAttack;saveRunCheckpoint(true);updateHUD(true);return}
  if(type==='attack'){requestManualAttack();return}
  if(type==='swap'){swapWeapon();return}
 }
 if(type==='context'){if(button.dataset.context==='exit')bank();else interact();return}
 if(type==='interact'){interact();return}
 if(type==='exit'){bank();return}
 if(type==='protect'&&run&&run.status==='playing'){
  const i=Number(button.dataset.i),loot=run.loot[i];
  if(!Number.isSafeInteger(i)||!loot)return;
  if(!Array.isArray(run.safeIds))run.safeIds=[];
  if(run.safeIds.includes(loot.tid)){
   run.safeIds=run.safeIds.filter(id=>id!==loot.tid);
   notify('安全ポーチから取り出しました');
  }else{
   if(run.safeIds.length>=SAFE_POUCH_CAP){notify('安全ポーチは最大'+SAFE_POUCH_CAP+'点です');return}
   run.safeIds.push(loot.tid);notify('安全ポーチへ保護しました');
  }
  saveRunCheckpoint(true);
  if(run.paused){const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel()}
  updateHUD(true);return;
 }
 if(type==='drop'&&run&&run.status==='playing'){
  const i=Number(button.dataset.i);
  if(Number.isInteger(i)&&i>=0&&i<run.loot.length){
   const selected=run.loot[i];
   if(run.mapVersion===5&&(run.safeIds||[]).includes(selected.tid)&&
    typeof window.confirm==='function'&&!window.confirm('🔒安全ポーチ内の財宝を捨てますか？一度捨てると戻せません。'))return;
   const removed=run.loot.splice(i,1)[0];
   run.safeIds=(run.safeIds||[]).filter(id=>id!==removed.tid);
   notify('戦利品をバッグから捨てた');saveRunCheckpoint(true);
   if(run.paused){const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel()}
   updateHUD(true);
  }
 }
};
document.body.addEventListener('change',e=>{
 const t=e.target;
 if(t.matches('[data-exp-area]')){
  if(!storageReady||actionPersisting||(run&&run.status==='playing'))return;
  if(!Object.prototype.hasOwnProperty.call(MAP_PROFILES,t.value))return;
  state.exploreArea=t.value;saveWithCommit(()=>render());return;
 }
 if(!t.matches('[data-exp-gear]')||!storageReady||actionPersisting||(run&&run.status==='playing'&&!run.paused))return;
 const kind=t.dataset.expGear;if(!GEAR_RULES[kind])return;
 const uid=Number(t.value),entry=state.inv.find(v=>v.uid===uid),it=entry&&item(entry.id);
 if(uid&&(!entry||!it||!GEAR_RULES[kind].match(it)||entry.locked)){
  t.value=String(state.exploreEquip?.[kind]||0);
  if(entry?.locked&&run)notify('🔒保護中の財宝は装備できません');
  return;
 }
 if(run&&run.paused){
  const previous=run.stats;
  const proposed={...(state.exploreEquip||{}),[kind]:uid||0};
  if(duplicateEquipmentUid(proposed)){
   t.value=String(state.exploreEquip?.[kind]||0);notify('同じ財宝は複数枠に装備できません');return;
  }
  const next=gearStats(proposed);
  // Switching away from a backpack increases encumbrance instead of blocking equipment changes.
  state.exploreEquip=proposed;
  run.stats=next;run.player.hp=Math.min(next.maxHp,Math.max(1,Math.round(run.player.hp/previous.maxHp*next.maxHp)));
  if(uid&&!(run.riskUids||[]).includes(uid))run.riskUids.push(uid);
  stageRunCheckpoint();
  saveWithCommit(()=>{const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel();updateHUD(true)});
  return;
 }
 const proposed={...(state.exploreEquip||{}),[kind]:uid||0};
 if(duplicateEquipmentUid(proposed)){
  t.value=String(state.exploreEquip?.[kind]||0);return;
 }
 state.exploreEquip=proposed;
 saveWithCommit(()=>render());
});
document.addEventListener('keydown',e=>{
 if(!run||run.status!=='playing'||active!=='explore'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
 if(run.paused){if(e.key==='Escape'||e.key==='p'){togglePause();e.preventDefault()}return}
 if(e.key==='Escape'||e.key==='p'){togglePause();e.preventDefault();return}
 if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keys.add(e.key);e.preventDefault()}
 if(e.key===' '||e.key==='e'){interact();e.preventDefault()}
 if(e.key==='j'){requestManualAttack();e.preventDefault()}
 if(e.key==='q'){swapWeapon();e.preventDefault()}
});
document.addEventListener('keyup',e=>keys.delete(e.key));
// R5.69b: WebKit can fire blur/pagehide before visibilitychange.
function suspendRaidForBackground(){
 keys.clear();
 if(stickVisual.release)stickVisual.release();
 stickVisual.targetX=0;stickVisual.targetY=0;
 if(run){run.joy={x:0,y:0};run.steer={x:0,y:0}}
 if(run&&run.status==='playing'&&!run.paused)togglePause();
}
window.addEventListener('blur',suspendRaidForBackground);
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendRaidForBackground()});
window.addEventListener('pagehide',()=>{
 suspendRaidForBackground();
 if(run&&run.status==='playing')saveRunCheckpoint(true);
});
window.addEventListener('resize',()=>{if(stickVisual.release)stickVisual.release();if(run&&run.status==='playing')resizeField()});
})();
