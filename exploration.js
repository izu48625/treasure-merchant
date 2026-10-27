(function explorationModule(){
'use strict';
// Independent, single-player extraction prototype. No gacha/arcade draw results are changed.
const WORLD={w:920,h:720}, VIEW={w:360,h:416}, DURATION=240;
const ORIGINAL_WORLD={w:920,h:720},Mall=window.TreasureMallLayout,MallV3=window.TreasureMallLayoutV3;
function mapFor(v){return v===3?MallV3:v===2?Mall:null}
function useWorld(v){
 const m=mapFor(v);
 WORLD.w=m?m.w:ORIGINAL_WORLD.w;WORLD.h=m?m.h:ORIGINAL_WORLD.h;
 WALLS.splice(0,WALLS.length,...(m?m.walls:ORIGINAL_WALLS));
}
function exitPoint(){return mapFor(run?.mapVersion)?.exit||{x:88,y:100}}
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
 'ITM-00017':17,'ITM-00018':45,'ITM-00019':35,'ITM-00020':22
};
const weightTenths=id=>ITEM_WEIGHT_TENTHS[id]??Math.round((window.TreasureEquipmentPilot?.forItem(id)?.weight??1)*10);
const formatWeight=tenth=>(tenth/10).toFixed(1);
const BASE_WEIGHT_KG=12,BACKPACK_BONUS_KG=6;
function lootWeightTenths(loot){return (loot||[]).reduce((sum,row)=>sum+weightTenths(row.id),0)}
function carryTier(loot,limitKg){
 const overweight=lootWeightTenths(loot)-Math.round(limitKg*10);
 return overweight<=0?0:overweight<=20?1:2;
}
function carrySpeedFactor(loot,limitKg){return [1,.4,.2][carryTier(loot,limitKg)]}
function areaProfile(id){return MAP_PROFILES[id]||MAP_PROFILES[DEFAULT_AREA]}

// Enemy states are clocked by elapsed active-raid time; pause freezes AI and attacks.
const ENEMY_TYPES={
 normal:{name:'通常',hp:35,speed:46,detect:155,lose:245,leash:290,windup:.62,cooldown:1.50,recovery:.34,damage:9,range:26,radius:11},
 fast:{name:'高速',hp:23,speed:86,detect:175,lose:285,leash:350,windup:.38,cooldown:1.45,recovery:.55,damage:7,range:24,radius:10},
 heavy:{name:'重装',hp:94,speed:31,detect:145,lose:210,leash:220,windup:1.00,cooldown:2.35,recovery:.78,damage:20,range:39,radius:17}
};
const ENEMY_CAP=12;
const ENEMY_WINDUP_CAP=2;
// R5.5c: a gentle early game and visible late danger, without guaranteed swarms.
function liveEnemyCap(elapsed){return elapsed<45?4:elapsed<105?6:elapsed<170?8:10}
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
const perf={windowStart:0,frames:0,fps:0,slow:0};
function sampleFrame(ts,rawMs){
 if(!run||run.paused)return;
 if(!perf.windowStart)perf.windowStart=ts;
 perf.frames++;
 if(rawMs>=40)perf.slow++;
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
 const legacy=g=>pilotDefinition(g)?0:bonus(g);
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
  if(!p)return '';
  const info=p.slot==='weapon'
   ?'威力 '+p.attack+' · 間隔 '+p.interval.toFixed(2)+'秒 · 射程 '+p.range+'px · '+p.targets+'体'
   :'防御 +'+p.defense+' · HP +'+p.hp+' · 速度 '+(p.speed>=0?'+':'')+p.speed+
     (p.carry?' · 運搬 +'+p.carry+'kg':'');
  return '<small class="exp-equip-stats">'+escapeHTML(info)+'</small>';
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
  '<p>廃商業区は大型の閉鎖施設マップ。制限時間なしで試験中。廃工場・旧遺構は旧試作地形のままです。</p></div>';
}
function itemWeightLine(it){
 return formatWeight(weightTenths(it.id))+'kg ・ 売却基準 '+(Number(it.base)||0).toLocaleString('ja-JP');
}
function weightLabel(){
 const weight=lootWeightTenths(run.loot),limit=run.stats.weightLimit;
 const tier=carryTier(run.loot,limit),pct=[100,40,20][tier];
 return {weight,limit,tier,pct,text:formatWeight(weight)+' / '+limit.toFixed(1)+'kg'};
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
// New mall loot is sealed before the sortie checkpoint, never on opening.
function containerReward(kind,theme){
 const weights={
  shelf:[480,320,170,27,3,0,0],locker:[360,320,240,65,13,2,0],
  crate:[400,330,200,58,10,2,0],register:[420,310,210,52,7,1,0],
  wood:[240,270,310,140,35,5,0],iron:[100,160,290,335,95,19,1],
  safe:[65,130,255,365,145,38,2]
 }[kind];
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
 return layout.rollContainers().map(c=>{
  const spec=layout.types[c.kind],n=spec.min+Math.floor(Math.random()*(spec.max-spec.min+1));
  return {...c,contents:Array.from({length:n},()=>containerReward(c.kind,c.theme))};
 });
}
function nearContainer(){return (run?.containers||[]).filter(c=>c.contents.length&&distance(c,run.player)<58).sort((a,b)=>distance(a,run.player)-distance(b,run.player))[0]||null}
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
 if(!Number.isFinite(c.remaining)||c.remaining<0||c.remaining>DURATION)return false;
 const layout=mapFor(c.mapVersion),indoor=c.mapVersion===2||c.mapVersion===3;
 if(c.mapVersion!==undefined&&c.mapVersion!==2&&c.mapVersion!==3)return false;
 if(indoor&&(!layout||!layout.validContainers(c.containers,rewardValid)))return false;
 if(c.mapVersion===3&&(!Number.isFinite(c.elapsedSeconds)||c.elapsedSeconds<0||c.elapsedSeconds>86400))return false;
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
   elapsedSeconds:run.mapVersion===3?elapsed():undefined,
   savedAt:Date.now(),remaining:remaining(),
  player:{...run.player},stats:{...run.stats},
  chests:run.chests.map(c=>({...c,reward:{...c.reward}})),
  enemies:run.enemies.map(e=>({...e})),loot:run.loot.map(v=>({...v})),
  tickets:run.tickets,kills:run.kills,spawnAt:run.spawnAt,attackAt:run.attackAt,
  autoAttack:run.autoAttack,weaponSlot:run.weaponSlot,facing:{...run.facing},
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
function restoreRunIfNeeded(){
 if(run||!storageReady)return;
 const c=state.exploreRun;
 if(!c)return;
 if(!validCheckpoint(c)){
  // Invalid or already claimed checkpoints are never credited or resumed.
  state.exploreRun=null;save();return;
 }
 const now=Date.now();
 useWorld(c.mapVersion||1);
 run={
  mapVersion:c.mapVersion||1,containers:c.mapVersion>=2?c.containers.map(v=>({...v,contents:v.contents.map(p=>({...p}))})):[],lootOpenId:null,
  id:c.id,status:'playing',paused:true,pausedAt:now,
  start:now-(c.mapVersion===3?c.elapsedSeconds:DURATION-c.remaining)*1000,duration:DURATION,
  player:{...c.player,invuln:0},
   area:MAP_PROFILES[c.area]?c.area:DEFAULT_AREA,
   stats:{...c.stats,weightLimit:Number.isFinite(c.stats.weightLimit)?c.stats.weightLimit:(c.stats.capacity>6?18:12),
    weapons:Array.isArray(c.stats.weapons)?c.stats.weapons.map(w=>({...w})):gearStats().weapons},
  enemies:c.enemies.map(restoreEnemy),chests:c.chests.map(v=>({...v,reward:{...v.reward}})),
  loot:c.loot.map((v,i)=>({...v,tid:v.tid||i+1})),tickets:c.tickets,kills:c.kills||0,
  // Legacy checkpoints began before equipment loss existed, so they remain grandfathered.
  riskUids:Array.isArray(c.riskUids)?c.riskUids.slice():[],
  safeIds:Array.isArray(c.safeIds)?c.safeIds.slice():[],
  lootSerial:Math.max(c.lootSerial||1,...c.loot.map((v,i)=>(v.tid||i+1)+1)),
  spawnAt:c.spawnAt,attackAt:c.attackAt,autoAttack:c.autoAttack!==false,
  manualAttack:false,dodgeCooldown:0,dodgeTime:0,facing:directionValid(c.facing)?{...c.facing}:{x:1,y:0},
  weaponSlot:c.weaponSlot,slash:null,damageTexts:[],joy:{x:0,y:0},steer:{x:0,y:0},
  message:'探索を復元しました。▶で再開してください',messageUntil:now+9000
 };
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
 stopLoop();preload();const stats=gearStats();
 const area=MAP_PROFILES[state.exploreArea]?state.exploreArea:DEFAULT_AREA;
 const layout=area==='mall'?(MallV3||Mall):null;
 const mapVersion=layout?(layout===MallV3?3:2):1;useWorld(mapVersion);
 run={
  mapVersion,containers:layout?createMallContainers(layout):[],lootOpenId:null,
  id:(window.crypto&&typeof window.crypto.randomUUID==='function'?window.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),
  status:'playing',paused:false,pausedAt:0,start:Date.now(),duration:DURATION,
   area,player:{x:layout?layout.start.x:88,y:layout?layout.start.y:100,hp:stats.maxHp,invuln:0},
  stats,enemies:[],chests:(layout?[]:CHEST_SPOTS.map(([x,y,type],i)=>({
    x,y,type,i,opened:false,reward:chooseLoot(type,area),ticket:Math.random()<.10
   }))),
  loot:[],safeIds:[],lootSerial:1,riskUids:gearUids,
  tickets:0,kills:0,spawnAt:15,attackAt:0,autoAttack:true,manualAttack:false,dodgeCooldown:0,dodgeTime:0,facing:{x:1,y:0},weaponSlot:0,slash:null,damageTexts:[],joy:{x:0,y:0},steer:{x:0,y:0},message:'宝箱を探して出口へ戻れ',messageUntil:Date.now()+2500
 };
 spawnEnemy('normal');spawnEnemy('normal');saveRunCheckpoint(true);render();
}
function notify(s){
 if(!run)return;
 run.message=s;run.messageUntil=Date.now()+2300;
 const e=document.getElementById('exp-note');if(e)e.textContent=s;
}
function stopLoop(){
 if(stickVisual.release)stickVisual.release();
 stickVisual.release=null;stickVisual.active=false;
 if(raf)cancelAnimationFrame(raf);
 raf=0;canvas=null;ctx=null;lastFrame=0;keys.clear();
 stickVisual.thumb=null;stickVisual.x=0;stickVisual.y=0;stickVisual.targetX=0;stickVisual.targetY=0;
 if(run){run.joy={x:0,y:0};run.steer={x:0,y:0}}
 pauseVisualDirty=true;perf.windowStart=0;perf.frames=0;perf.fps=0;perf.slow=0;
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
 if(x<r||y<r||x>WORLD.w-r||y>WORLD.h-r)return true;
 return WALLS.some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h);
}
function move(actor,vx,vy,dt,r=11){
 const x=actor.x+vx*dt,y=actor.y+vy*dt;
 if(!solid(x,actor.y,r))actor.x=x;
 if(!solid(actor.x,y,r))actor.y=y;
}
function restoreEnemy(e){
 // Existing checkpoints omit new combat effects; normalize missing/invalid values.
 const kind=ENEMY_TYPES[e.kind]?e.kind:'normal',def=ENEMY_TYPES[kind];
 const safe=(v,fallback)=>Number.isFinite(v)?v:fallback;
 const restored={
  x:e.x,y:e.y,kind,mode:['patrol','alert','chase','windup','recover','search'].includes(e.mode)?e.mode:'patrol',
  hp:e.hp,maxHp:def.hp,
  homeX:clamp(safe(e.homeX,e.x),18,WORLD.w-18),homeY:clamp(safe(e.homeY,e.y),18,WORLD.h-18),
  targetX:clamp(safe(e.targetX,e.x),18,WORLD.w-18),targetY:clamp(safe(e.targetY,e.y),18,WORLD.h-18),
  lastX:clamp(safe(e.lastX,e.x),18,WORLD.w-18),lastY:clamp(safe(e.lastY,e.y),18,WORLD.h-18),
  lastSeen:safe(e.lastSeen,-999),phaseUntil:safe(e.phaseUntil,0),attackAt:safe(e.attackAt,0),
  patrolUntil:safe(e.patrolUntil,0),facingX:safe(e.facingX,1),facingY:safe(e.facingY,0),
  aimX:safe(e.aimX,1),aimY:safe(e.aimY,0),hitUntil:safe(e.hitUntil,0)
 };
 return Combat.restoreEffects(e,restored);
}
function enemyKindForTime(elapsed){
 const r=Math.random();
 if(elapsed<35)return 'normal';
 if(elapsed<95)return r<.73?'normal':'fast';
 if(elapsed<170)return r<.57?'normal':r<.88?'fast':'heavy';
 return r<.45?'normal':r<.78?'fast':'heavy';
}
function spawnEnemy(forcedKind){
 if(!run||run.enemies.length>=Math.min(ENEMY_CAP,liveEnemyCap(elapsed())))return false;
 const elapsed=elapsed();
 let kind=forcedKind||enemyKindForTime(elapsed);
 // A late-run armored threat is guaranteed when there is still a free slot.
 if(!forcedKind&&elapsed>=105&&!run.enemies.some(e=>e.kind==='heavy'))kind='heavy';
 if(kind==='heavy'&&run.enemies.filter(e=>e.kind==='heavy').length>=2)kind='normal';
 if(kind==='fast'&&run.enemies.filter(e=>e.kind==='fast').length>=4)kind='normal';
 const def=ENEMY_TYPES[kind];
 for(let k=0;k<22;k++){
  const angle=Math.random()*Math.PI*2,radius=210+Math.random()*130;
  const x=clamp(run.player.x+Math.cos(angle)*radius,26,WORLD.w-26);
  const y=clamp(run.player.y+Math.sin(angle)*radius,26,WORLD.h-26);
  if(solid(x,y,def.radius+3)||distance({x,y},run.player)<195||distance({x,y},exitPoint())<128)continue;
  if(run.enemies.some(e=>distance(e,{x,y})<103))continue;
  run.enemies.push(restoreEnemy({x,y,kind,hp:def.hp,mode:'patrol',homeX:x,homeY:y,attackAt:elapsed+1}));
  return true;
 }
 return false;
}
// Sample along the segment: partitions obstruct detection instead of wall-hacking.
// Exact segment/rectangle intersection over 11 fixed walls; no per-ray sampling.
function canSeeBetween(a,b){
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
function enemyMoveTowards(e,x,y,speed,dt,radius){
 const d=Math.hypot(x-e.x,y-e.y);if(d<1)return false;
 if(run?.mapVersion===3&&MallV3&&!canSeeBetween(e,{x,y})){
  const next=MallV3.nextWaypoint(e,{x,y});x=next.x;y=next.y;
 }
 const adjusted=Math.hypot(x-e.x,y-e.y);
 if(adjusted<1)return false;
 const dx=(x-e.x)/adjusted,dy=(y-e.y)/adjusted;
 const bx=e.x,by=e.y;
 e.facingX=dx;e.facingY=dy;move(e,dx*speed,dy*speed,dt,radius);
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
  const a=enemies[i],ar=(ENEMY_TYPES[a.kind]||ENEMY_TYPES.normal).radius;
  for(let j=i+1;j<enemies.length;j++){
   const b=enemies[j],br=(ENEMY_TYPES[b.kind]||ENEMY_TYPES.normal).radius;
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
 if(elapsed<e.patrolUntil)return;
 if(Math.hypot(e.targetX-e.x,e.targetY-e.y)<10){
  e.targetX=e.x;e.targetY=e.y;e.patrolUntil=elapsed+.6+Math.random()*1.2;
  const a=Math.random()*Math.PI*2,r=25+Math.random()*56;
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
 if(d>def.range+12||p.invuln>0)return false;
 if(d>.001&&(dx*e.aimX+dy*e.aimY)/d<.55)return false;
 let applied;
 if(run.stats.combatRulesVersion===2){
  const defVal=Math.min(20,Math.max(0,Number(run.stats.defense)||0));
  const physical=defVal/(defVal+20);
  const f=run.facing||{x:1,y:0};
  const front=d>.001&&((e.x-p.x)*f.x+(e.y-p.y)*f.y)/d>=.25;
  const resists=run.stats.resists||{};
  const situational=Math.max(Number(resists.melee)||0,front?(Number(resists.frontal)||0):0)/100;
  const reduction=Math.min(.5,1-(1-physical)*(1-Math.min(.6,situational)));
  applied=Math.max(1,Math.round(def.damage*(1-reduction)));
 }else applied=Math.max(1,def.damage-Math.min(12,Math.max(0,run.stats.defense||0)));
 p.hp=Math.max(0,p.hp-applied);p.invuln=.85;
 if(p.hp<=0){lose('敵の攻撃を受け、戦利品を失いました');return true}
 notify(def.name+'型から '+applied+' ダメージ');
 return true;
}
function updateEnemy(e,elapsed,dt){
 const rawDef=ENEMY_TYPES[e.kind]||ENEMY_TYPES.normal;
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
 if(e.mode==='recover'){if(elapsed<e.phaseUntil)return;e.mode='search';e.phaseUntil=elapsed+1.2}
 const sight=d<=def.detect&&canSeeBetween(e,p);
 const tooFar=d>def.lose||distance(e,{x:e.homeX,y:e.homeY})>def.leash;
 if(sight){e.lastSeen=elapsed;e.lastX=p.x;e.lastY=p.y}
 if(e.mode==='patrol'){
  if(sight){
   e.mode='alert';e.phaseUntil=elapsed+.28;
   e.facingX=(p.x-e.x)/Math.max(d,1);e.facingY=(p.y-e.y)/Math.max(d,1);
  }else enemyPatrol(e,def,elapsed,dt);
  return;
 }
 if(e.mode==='alert'){
  if(tooFar){e.mode='search';e.phaseUntil=elapsed+1.4;return}
  if(elapsed>=e.phaseUntil)e.mode='chase';
  else return;
 }
 if(e.mode==='search'){
  if(sight&&!tooFar){e.mode='alert';e.phaseUntil=elapsed+.17;return}
  if(elapsed>=e.phaseUntil||distance(e,{x:e.lastX,y:e.lastY})<12){
   e.mode='patrol';e.targetX=e.x;e.targetY=e.y;return;
  }
  enemyMoveTowards(e,e.lastX,e.lastY,def.speed*.72,dt,def.radius);
  return;
 }
 if(e.mode==='chase'){
  if(tooFar||elapsed-e.lastSeen>2.1){e.mode='search';e.phaseUntil=elapsed+1.7;return}
  const warnings=run.enemies.reduce((n,enemy)=>n+(enemy.mode==='windup'?1:0),0);
  if(d<=def.range+12&&elapsed>=e.attackAt&&warnings<ENEMY_WINDUP_CAP&&canSeeBetween(e,p)){
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
   // Last seen position is pursued while line of sight is blocked.
   const target=sight?p:{x:e.lastX,y:e.lastY};
   enemyMoveTowards(e,target.x,target.y,def.speed,dt,def.radius);
  }
 }
}
function elapsed(){return run?Math.max(0,((run.paused?run.pausedAt:Date.now())-run.start)/1000):0}
function remaining(){return run?run.mapVersion===3?DURATION:Math.max(0,run.duration-elapsed()):0}
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
 const contents=c.contents.map((v,i)=>{
  const it=item(v.id);
  return '<div class="exp-container-line"><img src="'+it.image+'" alt=""><span><strong>'+escapeHTML(it.name)+'</strong><small>'+it.rarity+' ・ '+QNAME[v.q]+' ・ '+itemWeightLine(it)+'</small></span>'+
   '<button type="button" data-explore="loot-take" data-container="'+escapeHTML(c.id)+'" data-i="'+i+'" aria-label="'+escapeHTML(it.name)+'を回収">取る</button></div>';
 }).join('')||'<p class="exp-container-empty">中身はすべて回収済みです</p>';
 return '<div class="exp-pause-overlay exp-container-overlay" role="dialog" aria-modal="true" aria-label="回収品を選ぶ"><div class="exp-pause-card exp-container-card">'+
 '<small class="exp-container-location">'+escapeHTML(name)+'</small><h2>'+escapeHTML(specs.name)+'</h2>'+
 '<p>選んでいる間は敵・戦闘・時間が完全停止。欲しいものだけ回収できます。</p>'+
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
 if(run.mapVersion>=2){openContainer();return}
 let near=run.chests.filter(c=>!c.opened&&distance(c,run.player)<58).sort((a,b)=>distance(a,run.player)-distance(b,run.player))[0];
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
 if(distance(run.player,exitPoint())>58){notify('緑色の出口まで戻ってください');return}
 settleRun('escaped');
}
function performAttack(manual,elapsed){
 if(!run||run.status!=='playing'||run.paused||elapsed<run.attackAt)return false;
 const p=run.player,profile=weaponProfile(run.weaponSlot),style=profile.pattern?{...WEAPON_STYLES[profile.style],...profile.pattern}:WEAPON_STYLES[profile.style];
 const facing=directionValid(run.facing)?run.facing:{x:1,y:0};
 let closest=null,closestDist=Infinity;
 for(const e of run.enemies){
  const d=distance(e,p);
  if(d>style.range+(ENEMY_TYPES[e.kind]||ENEMY_TYPES.normal).radius||!canSeeBetween(p,e))continue;
  const dot=d<.001?1:((e.x-p.x)*facing.x+(e.y-p.y)*facing.y)/d;
  if(manual&&dot<Math.cos(style.arc))continue;
  const score=manual?d-dot*14:d;
  if(score<closestDist){closest=e;closestDist=score}
 }
 if(!closest&&!manual)return false;
 // Manual attacks respect player facing. Auto attacks rotate towards the nearest visible enemy.
 const aim=manual||!closest||distance(closest,p)<.001?{x:facing.x,y:facing.y}:
  {x:(closest.x-p.x)/distance(closest,p),y:(closest.y-p.y)/distance(closest,p)};
 const hitList=Combat.attackTargets(p,run.enemies,aim,profile.style,canSeeBetween,ENEMY_TYPES,profile.pattern);
 // Do not let weapon switching reset this cooldown.
 run.manualAttack=false;
 run.attackAt=elapsed+style.cooldown;
 const now=Date.now();
 run.slash={x:p.x,y:p.y,dx:aim.x,dy:aim.y,style:profile.style,range:style.range,arc:style.arc,until:now+style.animationMs};
 if(!Array.isArray(run.damageTexts))run.damageTexts=[];
 for(const target of hitList){
  const affinity=affinityMultiplier(profile.style,target.kind);
  const baseDamage=Combat.hitDamage(profile.attack,profile.style,target.kind);
  const damage=target.kind==='heavy'&&profile.effect==='armor_bonus'?Math.round(baseDamage*(1+profile.effectAmount)):baseDamage;
  target.hp-=damage;target.hitUntil=elapsed+.22;
  if(target.hp>0){
   if(profile.effect&&profile.effect!=='none')Combat.applyEquipmentEffect(profile,target,elapsed,Math.random);
   else Combat.applyHitEffect(profile.style,target,elapsed,Math.random);
  }
  if(target.mode==='patrol'||target.mode==='search'){
   const d=distance(target,p);
   target.mode='alert';target.phaseUntil=elapsed+.15;
   target.lastSeen=elapsed;target.lastX=p.x;target.lastY=p.y;
   target.facingX=(p.x-target.x)/Math.max(d,1);target.facingY=(p.y-target.y)/Math.max(d,1);
  }
  if(profile.style==='strike'&&target.kind!=='heavy'&&target.hp>0){
   const d=Math.max(1,distance(target,p));
   move(target,(target.x-p.x)/d*10,(target.y-p.y)/d*10,1,(ENEMY_TYPES[target.kind]||ENEMY_TYPES.normal).radius);
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
 const elapsed=elapsed();
 if(!performAttack(true,elapsed)){
  // Queue a single press while the current strike is cooling down.
  run.manualAttack=true;
 }
}
function tick(dt){
 if(!run||run.status!=='playing'||run.paused)return;
 const elapsed=(Date.now()-run.start)/1000;
 if(run.mapVersion!==3&&elapsed>=run.duration){lose('時間切れで戦利品を失いました');return}
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
  const speed=run.stats.speed*carrySpeedFactor(run.loot,run.stats.weightLimit);
   move(p,steer.x*speed,steer.y*speed,dt,12);
 }
 run.dodgeCooldown=Math.max(0,run.dodgeCooldown-dt);run.dodgeTime=Math.max(0,run.dodgeTime-dt);
 if(elapsed>=run.spawnAt){
  // Gradual pressure: one enemy per interval rather than instantaneous waves.
  spawnEnemy();
  run.spawnAt=elapsed+Math.max(11,20-elapsed/32);
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
function draw(){
 if(!ctx||!run||run.status!=='playing')return;
 const p=run.player,w=VIEW.w,h=VIEW.h;
 const ox=clamp(p.x-w/2,0,WORLD.w-w),oy=clamp(p.y-h/2,0,WORLD.h-h);
 ctx.clearRect(0,0,w,h);
 const area=areaProfile(run.area);
 if(run.mapVersion===3&&MallV3)MallV3.drawScene(ctx,ox,oy,w,h);
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
 if(run.mapVersion>=2&&mapFor(run.mapVersion)){
  for(const room of (run.mapVersion===3?[]:Mall.rooms)){
   const x=room.x-ox,y=room.y-oy;
   if(x+room.w<0||y+room.h<0||x>w||y>h)continue;
   ctx.fillStyle='rgba(65,88,80,.18)';ctx.fillRect(x+12,y+12,room.w-24,room.h-24);
   ctx.font='bold 11px system-ui';ctx.fillStyle='#b5c6bc';ctx.textAlign='center';
   ctx.fillText(room.name,x+room.w/2,y+28);
  }
  const colors={shelf:'#789d8c',locker:'#8aa6c8',crate:'#a48257',register:'#a8aaa5',
   wood:'#bc9459',iron:'#8798ac',safe:'#bd9cce'};
  for(const c of run.containers){
   const x=c.x-ox,y=c.y-oy;
   if(x<-25||x>w+25||y<-25||y>h+25)continue;
   const empty=c.contents.length===0;
   ctx.globalAlpha=empty?.32:1;
   ctx.fillStyle=colors[c.kind]||'#aaa';
   if(['shelf','locker','register'].includes(c.kind)){ctx.fillRect(x-13,y-10,26,20);ctx.fillStyle='#293834';ctx.fillRect(x-8,y-6,16,3)}
   else{ctx.fillRect(x-11,y-11,22,22);ctx.strokeStyle='#dfddd0';ctx.lineWidth=1;ctx.strokeRect(x-11,y-11,22,22)}
   if(!empty&&distance(c,p)<58){ctx.strokeStyle='#d8d4a0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,22,0,Math.PI*2);ctx.stroke()}
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
 const elapsed=elapsed();
 for(const e of run.enemies){
  const def=ENEMY_TYPES[e.kind]||ENEMY_TYPES.normal;
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
  const x=e.x-ox,y=e.y-oy,kind=e.kind||'normal',def=ENEMY_TYPES[kind]||ENEMY_TYPES.normal;
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
 ctx.strokeStyle='#ddf4ff';ctx.lineWidth=2;ctx.stroke();
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
function updateHUD(force=false){
 if(!run||run.status!=='playing')return;
 if(!force&&Date.now()-lastHud<110)return;
 lastHud=Date.now();
 const txt=(id,value)=>{const e=document.getElementById(id);if(e&&e.textContent!==String(value))e.textContent=value};
 const m=remaining(),min=Math.floor(m/60),sec=Math.floor(m%60);
 txt('exp-clock',run.mapVersion===3?'無制限':String(min).padStart(2,'0')+':'+String(sec).padStart(2,'0'));
 txt('exp-health',run.player.hp+'/'+run.stats.maxHp);
 const burden=weightLabel();
 txt('exp-bag',run.loot.length+'点');
 txt('exp-weight',burden.text);
 txt('exp-weight-status',burden.tier?'重量超過・移動速度'+burden.pct+'%':'移動速度100%');
 const bar=document.getElementById('exp-weight-fill');
 if(bar)bar.style.width=Math.min(100,burden.weight/(burden.limit*10)*100).toFixed(1)+'%';
 const meter=document.getElementById('exp-weight-meter');
 if(meter){meter.dataset.tier=String(burden.tier);meter.setAttribute('aria-valuenow',formatWeight(burden.weight))}
 const bagButton=document.getElementById('exp-bag-button');
 if(bagButton){bagButton.dataset.tier=String(burden.tier);bagButton.textContent='バッグ '+formatWeight(burden.weight)+'kg'}
 txt('exp-safe-count',(run.safeIds||[]).length+'/'+SAFE_POUCH_CAP);
 txt('exp-enemies',run.enemies.length+'体');
 const hp=document.getElementById('exp-hp-fill');if(hp)hp.style.width=(run.player.hp/run.stats.maxHp*100)+'%';
 const nearby=run.mapVersion>=2?nearContainer():null;
 const near=run.mapVersion>=2?!!nearby:run.chests.some(c=>!c.opened&&distance(c,run.player)<58);
 const atExit=distance(run.player,exitPoint())<=58;
 const btn=document.getElementById('exp-interact');
 if(btn){
  const canExit=atExit;
  btn.dataset.context=canExit?'exit':near?(run.mapVersion>=2?'container':'chest'):'none';
  btn.disabled=!(canExit||near);
  const label=canExit?'脱出する':near?(run.mapVersion>=2?'調べる':'開ける'):'調べる';
  if(btn.textContent!==label)btn.textContent=label;
  btn.setAttribute('aria-label',canExit?'探索を終了して帰還する':near?(run.mapVersion>=2?'近くの棚やロッカーを調べる':'近くの宝箱を開ける'):'近くに調べられるものはありません');
 }
 const list=document.getElementById('exp-loot');
 if(list){
  const signature=run.loot.map(v=>v.id+':'+v.q+':'+v.tid+':'+(run.safeIds||[]).includes(v.tid)).join(',');
  if(list.dataset.signature!==signature){
   list.dataset.signature=signature;
   list.innerHTML=run.loot.map((v,i)=>{
    const it=item(v.id);
    const safe=(run.safeIds||[]).includes(v.tid);
    return '<div class="exp-loot-item'+(safe?' exp-protected':'')+'"><img src="'+it.image+'" alt=""><span><b>'+escapeHTML(it.name)+'</b><small>'+it.rarity+' ・ '+QNAME[v.q]+' ・ '+itemWeightLine(it)+(safe?' ・ 安全ポーチ':'')+'</small></span>'+
     '<button type="button" class="exp-safe-toggle" data-explore="protect" data-i="'+i+'" aria-pressed="'+safe+'" aria-label="'+escapeHTML(it.name)+(safe?'の保護解除':'を安全ポーチに保護')+'">'+(safe?'🔒':'保護')+'</button>'+
     '<button type="button" data-explore="drop" data-i="'+i+'" aria-label="'+escapeHTML(it.name)+'を捨てる">×</button></div>';
   }).join('')||'<p>まだ戦利品はありません</p>';
  }
 }
 txt('exp-note',Date.now()<run.messageUntil?run.message:'');
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
 resizeField();bindStick();lastHud=0;updateHUD(true);raf=requestAnimationFrame(frame);
}
function pausePanel(){
 if(!run||!run.paused)return '';
 if(run.lootOpenId)return containerPanel();
 return '<div class="exp-pause-overlay" role="dialog" aria-modal="true" aria-label="探索を一時停止"><div class="exp-pause-card">'+
 '<h2>⏸ 一時停止</h2><p>敵・攻撃・制限時間を停止中</p>'+
 '<p class="exp-pause-note">描画計測：'+(perf.fps?perf.fps+' FPS':'計測中')+
 ' ／ 40ms以上のフレーム：'+perf.slow+'回（この探索セッション）</p>'+
 '<h3>戦利品 '+run.loot.length+'点 ・ '+weightLabel().text+' ・ 安全ポーチ '+(run.safeIds||[]).length+'/'+SAFE_POUCH_CAP+'</h3><div class="exp-pause-loot">'+(run.loot.length?run.loot.map((v,i)=>{
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
 if(run.paused){run.start+=Date.now()-run.pausedAt;run.paused=false;run.pausedAt=0;run.joy={x:0,y:0};perf.windowStart=0;perf.frames=0;keys.clear();}
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
 if(!run||run.status==='lost'||run.status==='escaped'){
  return '<section class="exp-shell"><div class="exp-hero"><div class="exp-eyebrow">EXTRACTION / PROTOTYPE</div><h1>財宝探索</h1>'+
   '<p>棚・ロッカー・宝箱を調べ、欲しい財宝を選んで帰還せよ。回収画面では時間が停止する。</p></div>'+
   lastExploreReportHTML()+
   '<div class="exp-intro"><h2>探索ルール</h2><p>廃商業区は3,600×2,600pxの入り組んだ施設で80か所を探索（制限時間は保留）。他区域は旧マップと暫定4分制限。重くても拾えますが、基本12kg（リュックの種類で増加）を超えると移動速度40%、さらに2kgを超えると20%。不要品を捨てて軽くできます。死亡・時間切れ・途中撤退で持込装備とポーチ外戦利品が消失します。</p>'+
    '<div class="exp-checks"><span>移動：画面左下どこでもタッチ</span><span>重量超過：移動速度が低下</span><span>攻撃：自動／手動</span><span>敵：通常・高速・重装（後半）</span><span>警告範囲から離れて攻撃回避</span><span>宝箱：近づいて開封</span></div></div>'+
   areaPicker()+'<div class="exp-loadout"><h2>7枠装備を選ぶ</h2>'+gearGrid()+'<p class="exp-caption">🔒保護中の財宝は出撃不可。同じ所持品を複数枠に装備できません。胴・脚の候補は今後の財宝追加に対応します。</p></div>'+
   '<p class="exp-risk-alert">⚠ 出撃装備は失敗・途中撤退で消失します。大切な財宝は装備せず保管してください。</p><p id="exp-start-notice" class="exp-start-notice" aria-live="polite"></p>'+ '<button class="exp-start" data-explore="start">リスクを確認して出撃 <span>→</span></button>'+
   '<p class="exp-caption">探索中は数秒おきに途中保存。再読み込み後は一時停止状態で再開可能。出撃装備は死亡・時間切れ・途中撤退で消失し、安全ポーチの2点は回収できます。</p></section>';
 }
 if(run.status==='saving')return '<section class="exp-shell"><h1>帰還処理中</h1><p>戦利品をセーブしています。保存完了後に結果を表示します。</p></section>';
 return '<section class="exp-shell exp-playing"><button type="button" id="exp-pause-toggle" class="exp-pause-toggle" data-explore="pause" aria-label="'+(run.paused?'探索を再開':'探索を一時停止')+'">'+(run.paused?'▶':'⏸')+'</button><div class="exp-hud"><button type="button" class="exp-leave" data-explore="leave">← 拠点</button><div><small>探索タイマー</small><strong id="exp-clock">04:00</strong></div><div><small>体力</small><strong id="exp-health">'+run.player.hp+'/'+run.stats.maxHp+'</strong><span class="exp-health-track"><i id="exp-hp-fill" style="width:100%"></i></span></div><div><small>敵</small><strong id="exp-enemies">2体</strong></div></div>'+
 '<div class="exp-map-frame"><span class="exp-region-tag">'+escapeHTML(areaProfile(run.area).name)+'</span><canvas id="exp-field" width="'+VIEW.w+'" height="'+VIEW.h+'" role="img" aria-label="見下ろし型の探索マップ。画面左下をタッチするかWASDキーで移動します"></canvas><span class="exp-map-brand">探索UI R5.13 · 大型迷路マップ</span></div>'+
 '<div id="exp-stick-zone" class="exp-stick-zone" aria-label="画面左下をタッチした位置に移動スティックを表示"><div id="exp-stick" class="exp-stick exp-stick-floating" aria-hidden="true"><div class="exp-stick-ring"></div><div id="exp-stick-thumb" class="exp-stick-thumb"></div></div></div>'+ 
 '<div class="exp-controls">'+
 '<div class="exp-control-actions"><div class="exp-action-grid"><button type="button" id="exp-attack" data-explore="attack">攻撃</button><button type="button" id="exp-swap" data-explore="swap">武器 1 ⇄</button><button type="button" id="exp-interact" data-explore="context" disabled>調べる</button></div><div class="exp-action-bottom"><button type="button" id="exp-bag-button" data-explore="bag">バッグ</button><button type="button" id="exp-auto" data-explore="auto" aria-pressed="true">AUTO ON</button></div></div></div>'+
 '<div id="exp-pause-layer" class="exp-pause-layer">'+pausePanel()+'</div><div class="exp-backpack" id="exp-backpack">'+
  '<div class="exp-bag-title"><strong>戦利品バッグ</strong><span><b id="exp-bag">0点</b> ・ 🔒 <b id="exp-safe-count">0/2</b></span></div>'+
  '<div id="exp-weight-meter" class="exp-weight-meter" data-tier="0" role="progressbar" aria-label="バッグの重量" aria-valuemin="0" aria-valuemax="'+run.stats.weightLimit+'" aria-valuenow="0">'+
  '<div class="exp-weight-numbers"><strong id="exp-weight">0.0 / '+run.stats.weightLimit.toFixed(1)+'kg</strong><span id="exp-weight-status">移動速度100%</span></div>'+
  '<div class="exp-weight-track"><div id="exp-weight-fill"></div></div></div>'+
  '<p class="exp-safe-note">超過+2kgまでは速度40%、それ以上は20%。重い品を捨てればすぐ回復。🔒保護品も重量に含まれます。</p><div id="exp-loot" class="exp-loot-grid"><p>まだ戦利品はありません</p></div><p class="exp-notification" id="exp-note"></p></div>'+
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
 if(type==='start'){startRun();return}
 if(type==='leave'){if(!confirmLeaveRun())return;active='home';render();return}
 if(type==='loot-close'){closeContainer();return}
 if(type==='loot-take'){takeContainerItem(button);return}
 if(type==='pause'){if(run?.lootOpenId)closeContainer();else togglePause();return}
 if(run&&run.paused&&type!=='drop'&&type!=='protect')return;
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
 if(type==='context'){if(button.dataset.context==='exit')bank();else if(['chest','container'].includes(button.dataset.context))interact();return}
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
window.addEventListener('blur',()=>{keys.clear();if(stickVisual.release)stickVisual.release();stickVisual.targetX=0;stickVisual.targetY=0;if(run){run.joy={x:0,y:0};run.steer={x:0,y:0}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&run&&run.status==='playing'&&!run.paused)togglePause()});
window.addEventListener('pagehide',()=>{if(run&&run.status==='playing')saveRunCheckpoint(true)});
window.addEventListener('resize',()=>{if(stickVisual.release)stickVisual.release();if(run&&run.status==='playing')resizeField()});
})();
