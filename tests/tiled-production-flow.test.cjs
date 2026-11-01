'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Tiled=require('../maps/indoor/tiled-runtime.js');
const Mall=require('../exploration-layout.js');
const MallV3=require('../exploration-layout-v3.js');
const MallV4=require('../exploration-layout-v4.js');
const Combat=require('../combat-rules.js');
const Equipment=require('../equipment-pilot.js');
const MapItem=require('../exploration-map-item.js');
const ITEMS=[
 {id:'ITM-00001',name:'古代の剣',rarity:'EX',category:'武具',group:'歴史・武具',base:400000,image:'data:mock'},
 {id:'ITM-00002',name:'家電製品',rarity:'N',category:'電化',group:'現代・生活',base:200,image:'data:mock'},
 {id:'ITM-00003',name:'宝石の首飾り',rarity:'UR',category:'宝石',group:'宝石・宝飾',base:10000,image:'data:mock'},
 {id:'ITM-00004',name:'古代の銀細工',rarity:'SSR',category:'宝石',group:'宝石・宝飾',base:3000,image:'data:mock'},
 {id:'ITM-09000',name:'テスト用汎用物資',rarity:'C',category:'現代・生活',group:'現代・生活',base:100,image:'data:mock'},
 ...Equipment.items,MapItem.item
];
const itemMap=new Map(ITEMS.map(it=>[it.id,it]));
async function harness(randomOverride=null,clock=null){
 const map=JSON.parse(read('maps/indoor/indoor.tmj'));
 const tiles=JSON.parse(read('maps/indoor/tiles/warehouse.tsj'));
 const source=read('exploration-layout-v5.js');
 const V5Window={TreasureTiledMap:Tiled};
 class Image{
  constructor(){this.complete=true;this.naturalWidth=192}
  set src(url){this.url=url;queueMicrotask(()=>this.onload?.())}
 }
 new Function('window','fetch','Image',source)(
  V5Window,async p=>({ok:true,json:async()=>p.startsWith('maps/indoor/indoor.tmj')?map:tiles}),Image);
 const layout=await V5Window.TreasureIndoorLayoutV5.load();
 const state={inv:[],exploreArea:'mall',exploreEquip:{},exploreRun:null,bonusTickets:0};
 const dom=new Map();
 const documentEvents=new Map(),windowEvents=new Map();
 const document={body:{classList:{add(){},remove(){},toggle(){}},addEventListener(){}},
  getElementById:id=>dom.get(id)||null,querySelector:selector=>dom.get(selector)||null,
  addEventListener:(name,handler)=>documentEvents.set(name,handler),hidden:false};
 const window={TreasureMallLayout:Mall,TreasureMallLayoutV3:MallV3,TreasureFacilityLayoutV4:MallV4,
  TreasureIndoorLayoutV5:{load:()=>Promise.resolve(layout)},TreasureCombatRules:Combat,
  TreasureEquipmentPilot:Equipment,TreasureMapItem:MapItem,
  crypto:{randomUUID:()=>String(Math.random()).slice(2)},confirm:()=>true,
  addEventListener:(name,handler)=>windowEvents.set(name,handler)};
 let sourceGame=read('exploration.js');
 const end=sourceGame.lastIndexOf('})();');
 assert.ok(end>0);
 sourceGame=sourceGame.slice(0,end)+
  'window.__v5test={startRun,runRef:()=>run,startV5Search,updateV5Search,v5SearchProbe,facilityVisionContour,resetRun:()=>{run=null},snapshotRun,restoreRunIfNeeded,validCheckpoint,openContainer,takeContainerItem,closeContainer,bank,lose,exitPoint,restoreEnemy,enemyDefinition,enemyPatrol,updateEnemy,enemyHitPlayer,performAttack,facilityCanSeePlayer,facilityVisionClear,stealthSituation,v5InHidingAlcove,updateHUD,contents,facilityNoticeReady,facilityNoticeThreshold,facilityPursuitSpeed,enemyMoveTowards,tick,advanceRaidFrame,V5_SUPPLY_WEIGHTS,v5SsrPlusPercent,v5CacheGrade,v5CacheReveal,containerReward,facilityPreviewPanel,setPreviewVariant:v=>facilityPreviewVariant=v,mapPanel,v5FacilityPlanSvg,hasDetailedMap,lootBaseValue,lootBaseTotal,lootSummary,lootOrder,lootRowsV5,lootSortControls,lootAutoProtectButton,weightLabel,carrySpeedFactor,v5CargoRisk,v5ReturnRisk,v5ExtractionStakes,pausePanel,v5SessionDiagnosticReport,lastExploreReportHTML,weightTenths,solid,useVaultInteraction,sealVaultOnEntry,nearVaultKeycard,nearVaultGate,nearVaultHatch,reconcileIndoorCheckpoint,activateFacilityGuardPosts,v5AlarmVisual,bindMultiTouchActions,remaining,togglePause,sampleFrame,perf,lastFrameRef:()=>lastFrame,setLastFrame:value=>{lastFrame=value}};'+sourceGame.slice(end);
 let nextUid=1000,received=[],renders=0;
 function receive(it,q){received.push({id:it.id,q});state.inv.push({id:it.id,q,uid:nextUid++,locked:false})}
 const deps=[
  window,document,state,ITEMS,itemMap,id=>itemMap.get(id),()=>1,
  ['N','C','R','SR','SSR','UR','EX'],['普通','良','優','特'],true,false,
  ()=>{},fn=>fn(),()=>{renders++},Image,
  s=>String(s).replace(/[&<>"]/g,''),()=>{},receive,()=>{}
 ];
 new Function('window','document','state','ITEMS','ITEM_BY_ID','item','quality','RARITY',
  'QNAME','storageReady','actionPersisting','save','saveWithCommit','render','Image',
  'esc','cancelAnimationFrame','receive','markDelete','Math','active','Date',sourceGame)(...deps,
  Object.assign(Object.create(Math),randomOverride?{random:randomOverride}:{}),'explore',clock||Date);
 await Promise.resolve();
 return {t:window.__v5test,layout,state,received,dom,document,documentEvents,windowEvents,
  gameWindow:window,itemRarity:id=>itemMap.get(id)?.rarity,renderCount:()=>renders};
}
// R5.79: report diagnostics only from local observation, with no save-shape change.
test('R5.79 copyable V5 diagnostics preserve raid/settlement and label partial recording',async()=>{
 const {t,state,dom,gameWindow}=await harness(()=>.1);
 t.startRun();const r=t.runRef();
 const originalSnapshot=t.snapshotRun();
 assert.equal(originalSnapshot.mapVersion,5);
 assert.equal(Object.hasOwn(originalSnapshot,'diagnostics'),false);
 r.enemies=[];r.player.invuln=999;
 t.tick(.04);
 assert.ok(t.perf.sampledSeconds>0);
 assert.equal(t.perf.hits,0);
 const beforeSeconds=t.perf.sampledSeconds;
 const savedFields=t.snapshotRun();
 t.togglePause();assert.equal(r.paused,true);
 const report=t.v5SessionDiagnosticReport();
 assert.match(report,/R5.80/);
 assert.match(report,/40ms以上/);
 assert.match(report,/ページ再読み込みでリセット/);
 assert.match(report,/物資開封/);
 assert.match(t.pausePanel(),/data-explore="copy-diagnostics"/);
 let focused=false,selected=false;
 dom.set('exp-diagnostics-text',{value:report,focus(){focused=true},select(){selected=true}});
 const button={dataset:{explore:'copy-diagnostics'},textContent:''};
 gameWindow.explorationAction(button);
 assert.equal(focused,true);assert.equal(selected,true);
 assert.equal(button.textContent,'テキストを選択しました','clipboard-unavailable fallback selects text');
 assert.equal(t.perf.sampledSeconds,beforeSeconds,'diagnostic copy never advances time');
 for(const key of ['containers','loot','safeIds','riskUids','tickets','kills','stats'])
  assert.deepEqual(t.snapshotRun()[key],savedFields[key],'diagnostic copy must not mutate '+key);
 t.togglePause();
 t.lose('テスト');
 assert.equal(state.exploreLastResult.status,'lost');
 assert.match(t.lastExploreReportHTML(),/実機テスト記録を表示・コピー/,'end screen retains local snapshot');
 assert.equal(state.exploreRun,null,'existing claim settlement remains atomic');
});
// R5.77: a scripted, active-time scenario audit. Teleporting between
// objectives deliberately isolates time, spawn policy and transaction safety;
// it is NOT a measured player route, win rate or real five-minute rendering.
test('R5.77 scripted full 300-second V5 raid preserves loot and fixed-guard caps in A/B',async()=>{
 for(const [random,variant] of [[.1,'strict'],[.9,'cover']]){
  let now=1_000_000;
  const {t,layout,state,received}=await harness(()=>random,{now:()=>now});
  t.startRun();const r=t.runRef();
  assert.equal(r.escapeVariant,variant);
  const sealed=JSON.stringify(r.containers.map(c=>c.contents));
  const cache=r.containers.find(c=>c.contents.length);
  r.enemies=[];r.player.x=cache.x;r.player.y=cache.y;
  t.openContainer();assert.equal(r.paused,true);
  t.takeContainerItem({dataset:{container:cache.id,i:'0'}});
  t.closeContainer();
  assert.equal(r.loot.length,1,'loot must be picked up from actual sealed contents');
  const secured={...r.loot[0]};r.safeIds=[secured.tid];
  r.player.x=layout.start.x;r.player.y=layout.start.y;
  let maxNormal=0,maxAlarm=0;
  for(let second=1;second<300;second++){
   now+=1000;r.player.invuln=1000; // Isolate countdown and sentry pressure from combat.
   if(second===150){
    r.player.x=layout.vaultKeycard.x;r.player.y=layout.vaultKeycard.y;
    assert.equal(t.useVaultInteraction(),true);assert.equal(r.hasKeycard,true);
    r.player.x=layout.vaultGate.x;r.player.y=layout.vaultGate.y;
    assert.equal(t.useVaultInteraction(),true);assert.equal(r.vaultUnlocked,true);
    r.player.x=layout.vaultGate.x+layout.vaultGate.tileSize/2+16;
    r.player.y=layout.vaultGate.y;t.sealVaultOnEntry();
    assert.equal(r.vaultSealed,true);
   }
   if(second===205){
    r.player.x=layout.vaultHatch.x;r.player.y=layout.vaultHatch.y;
    assert.equal(t.useVaultInteraction(),true);
    assert.equal(r.vaultHatchUsed,true);assert.equal(r.vaultAlarm,true);
   }
   if(second===290){r.player.x=layout.fixedExit.x;r.player.y=layout.fixedExit.y}
   t.tick(.045); // 1 synthetic second / 45ms physics: not a measured human run.
   assert.equal(r.status,'playing','time remains before 300 active seconds');
   assert.ok(r.enemies.length<=(r.vaultAlarm?7:5),'no uncontrolled surprise V5 horde');
   if(r.vaultAlarm)maxAlarm=Math.max(maxAlarm,r.enemies.length);
   else maxNormal=Math.max(maxNormal,r.enemies.length);
   if(second%60===0){
    assert.ok(t.validCheckpoint(t.snapshotRun()),'valid 60s checkpoint at '+second);
    assert.equal(JSON.stringify(r.containers.map(c=>c.contents)),
     JSON.stringify(JSON.parse(sealed).map((v,i)=>i===r.containers.indexOf(cache)?v.slice(1):v)),
     'sealed loot stays unchanged except for the one deliberately claimed item');
   }
  }
  assert.ok(maxNormal>=1,'at least one authored guard enters the active area');
  assert.ok(maxNormal<=5&&maxAlarm<=7);
  assert.ok(maxAlarm>=2,'the alarm segment actually includes sentries');
  console.log('R5.77 '+variant+' staged 300s: normal active peak='+maxNormal+', alarm active peak='+maxAlarm);
  assert.equal(t.remaining(),1);
  t.bank();
  assert.equal(r.status,'escaped','bank at 299 seconds succeeds');
  assert.equal(state.exploreLastResult.status,'escaped');
  assert.equal(received.length,1);assert.equal(received[0].id,secured.id);
  assert.deepEqual(state.exploreLastResult.saved,[{id:secured.id,q:secured.q}]);
  t.bank();assert.equal(received.length,1,'claim is idempotent');
 }
});

test('R5.77 time-out at exactly five minutes retains only actually protected loot',async()=>{
 let now=1_000_000;
 const {t,state,received}=await harness(null,{now:()=>now});t.startRun();
 const r=t.runRef();r.player.invuln=1000;
 // Use the real container/open/pickup flow, not invented inventory entries.
 const caches=r.containers.filter(c=>c.contents.length).slice(0,2);
 assert.equal(caches.length,2,'two authored sealed caches are present');
 r.enemies=[];
 for(const cache of caches){
  r.player.x=cache.x;r.player.y=cache.y;
  t.openContainer();assert.equal(r.paused,true);
  t.takeContainerItem({dataset:{container:cache.id,i:'0'}});t.closeContainer();
 }
 assert.equal(r.loot.length,2);
 const rewards=r.loot.map(row=>({...row}));
 r.safeIds=[r.loot[0].tid];
 for(let second=1;second<=300;second++){
  now+=1000;r.player.invuln=1000;t.tick(.045);
  if(second<300)assert.equal(r.status,'playing');
 }
 assert.equal(r.status,'lost');
 assert.equal(state.exploreLastResult.status,'lost');
 assert.deepEqual(state.exploreLastResult.saved,[{id:rewards[0].id,q:rewards[0].q}]);
 assert.equal(received.length,1,'unprotected second item is not duplicated or returned');
 assert.equal(state.exploreRun,null);
 const count=received.length;t.tick(.045);assert.equal(received.length,count);
});

test('R5.77 actual V5 melee applies one-hit unarmored / two-hit low-armor loss',async()=>{
 for(const [defense,expectedHits] of [[0,1],[8,2]]){
  const {t,layout,state,received}=await harness();t.startRun();
  const r=t.runRef();r.enemies=[];r.stats.defense=defense;
  const caches=r.containers.filter(c=>c.contents.length).slice(0,2);
  for(const c of caches){
   r.player.x=c.x;r.player.y=c.y;
   t.openContainer();assert.equal(r.paused,true);
   t.takeContainerItem({dataset:{container:c.id,i:'0'}});t.closeContainer();
  }
  assert.equal(r.loot.length,2);
  const protectedReward={...r.loot[0]};r.safeIds=[protectedReward.tid];
  r.player.x=layout.start.x;r.player.y=layout.start.y;
  r.player.hp=100;r.player.invuln=0;
  const guard=t.restoreEnemy({x:r.player.x+24,y:r.player.y,
   homeX:r.player.x+24,homeY:r.player.y,
   kind:'normal',hp:92,mode:'windup',aimX:-1,aimY:0,facingX:-1,facingY:0,attackAt:0});
  const def=t.enemyDefinition('normal');
  assert.equal(t.facilityVisionClear(guard,r.player),true,'test strike has real unobstructed LOS');
  assert.equal(t.solid(guard.x,guard.y,def.radius),false,'guard stands on a walkable tile');
  for(let n=1;n<=expectedHits;n++){
   assert.equal(t.enemyHitPlayer(guard,def,r.player),true,'the real melee strike connects');
   if(n<expectedHits){
    assert.equal(r.status,'playing','basic armor must survive the first direct hit');
    r.player.invuln=0; // Advance past the ordinary post-hit invulnerability.
   }
  }
  assert.equal(r.status,'lost','lethal impact must end the raid');
  assert.deepEqual(state.exploreLastResult.saved,[{id:protectedReward.id,q:protectedReward.q}]);
  assert.equal(received.length,1,'only the protected item remains after death');
  const paid=received.length;t.enemyHitPlayer(guard,def,r.player);
  assert.equal(received.length,paid,'already-settled run cannot pay twice');
 }
});

test('R5.77 physical joystick navigation from alarm hatch reaches real exit in A/B',async()=>{
 for(const [random,variant] of [[.1,'strict'],[.9,'cover']]){
  let now=1_000_000;
  const {t,layout,state}=await harness(()=>random,{now:()=>now});t.startRun();
  const r=t.runRef();
  assert.equal(r.escapeVariant,variant);
  r.hasKeycard=true;r.vaultUnlocked=true;r.vaultEntered=true;
  r.vaultSealed=true;r.vaultHatchUsed=true;r.vaultAlarm=true;
  r.enemies=[];r.pendingGuardPosts=[];r.spawnAt=999;
  r.player.x=layout.vaultHatch.landing.x;r.player.y=layout.vaultHatch.landing.y;
  r.player.invuln=1000; // Test actual movement/collisions, not guard difficulty.
  let closest=Infinity,frames=0;
  for(;frames<2500;frames++){
   const next=layout.nextWaypoint(r.player,layout.fixedExit,true,variant);
   const dx=next.x-r.player.x,dy=next.y-r.player.y,dist=Math.hypot(dx,dy);
   r.joy={x:dist>1?dx/dist:0,y:dist>1?dy/dist:0};
   now+=40;t.advanceRaidFrame(40);
   assert.equal(t.solid(r.player.x,r.player.y,12),false,
    'real V5 player cannot cross blockers');
   closest=Math.min(closest,Math.hypot(r.player.x-layout.fixedExit.x,r.player.y-layout.fixedExit.y));
   if(closest<50)break;
  }
  assert.ok(closest<50,variant+' route should be navigable by actual joystick physics');
  assert.ok(frames*0.04<100,'isolated return route should fit within 100 active seconds');
  console.log('R5.77 '+variant+' isolated joystick return: '+((frames+1)*0.04).toFixed(2)+' simulated seconds');
  assert.ok(t.validCheckpoint(t.snapshotRun()),'return position and alarm state remain resumable');
  t.bank();assert.equal(r.status,'escaped');
  assert.equal(state.exploreLastResult.status,'escaped');
 }
});

test('R5.76 100ms foreground frames preserve player movement rather than losing 55% of it',async()=>{
 async function moveFor(frameMs,count){
  let now=1_000_000;
  const {t}=await harness(null,{now:()=>now});
  t.startRun();const r=t.runRef();
  r.enemies=[];r.pendingGuardPosts=[];r.spawnAt=999;
  r.joy={x:1,y:0};r.steer={x:1,y:0};
  const startX=r.player.x,speed=r.stats.speed*1.08;
  for(let i=0;i<count;i++){now+=frameMs;t.advanceRaidFrame(frameMs)}
  return {distance:r.player.x-startX,speed,checkpoint:t.snapshotRun(),t};
 }
 const fast=await moveFor(20,5),slow=await moveFor(100,1);
 assert.ok(fast.distance>fast.speed*.08,'control moves on the authored indoor floor');
 assert.ok(slow.distance>slow.speed*.08,'low-FPS foreground time is no longer clipped to 45ms');
 assert.ok(Math.abs(fast.distance-slow.distance)<.4,
  '100ms frame must match five 20ms frames in open space');
 assert.ok(slow.t.validCheckpoint(slow.checkpoint),'substeps preserve standard checkpoint');
});
test('R5.76 pauses and delayed frames cannot cause a multi-second physics teleport',async()=>{
 let now=1_000_000;
 const {t}=await harness(null,{now:()=>now});t.startRun();
 const r=t.runRef();r.enemies=[];r.pendingGuardPosts=[];r.spawnAt=999;
 r.joy={x:1,y:0};r.steer={x:1,y:0};
 const original={x:r.player.x,y:r.player.y};
 now+=5000;
 assert.equal(t.advanceRaidFrame(5000),.12,'foreground recovery caps at 120ms in three steps');
 assert.ok(Math.hypot(r.player.x-original.x,r.player.y-original.y)<=r.stats.speed*1.08*.12+.001,
  'long callback gap cannot propel the character several seconds through the facility');
 t.togglePause();
 const paused={x:r.player.x,y:r.player.y},remaining=t.remaining();
 now+=60_000;t.advanceRaidFrame(60_000);
 assert.deepEqual({x:r.player.x,y:r.player.y},paused,'paused gameplay remains immobile');
 assert.ok(Math.abs(t.remaining()-remaining)<.05,'background time does not spend raid clock');
 t.togglePause();assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('R5.70 existing clock warns about the last 90 and 45 seconds without blinking',async()=>{
 let now=1_000_000;
 const {t,dom}=await harness(null,{now:()=>now});
 const clock={dataset:{},textContent:''};dom.set('exp-clock',clock);
 t.startRun();const r=t.runRef(),start=now;
 t.updateHUD(true);assert.equal(clock.dataset.urgency,'normal');
 now=start+210_000;t.updateHUD(true);
 assert.equal(clock.dataset.urgency,'soon');assert.equal(clock.textContent,'01:30');
 now=start+255_000;t.updateHUD(true);
 assert.equal(clock.dataset.urgency,'critical');assert.equal(clock.textContent,'00:45');
 r.mapVersion=3;t.updateHUD(true);
 assert.equal(clock.dataset.urgency,'normal','legacy endless mode must not turn urgent');
 assert.equal(clock.textContent,'無制限');
 const css=read('exploration.css');
 assert.ok(css.includes('#exp-clock[data-urgency="soon"]'));
 assert.ok(css.includes('#exp-clock[data-urgency="critical"]'));
 assert.ok(read('index.html').includes('exploration.js?v=R5.80'));
});
test('R5.70 synthetic 5-minute raid protects sealed loot and cannot claim twice',async()=>{
 let now=1_000_000;
 const {t,state}=await harness(null,{now:()=>now});
 t.startRun();let run=t.runRef();
 const originalId=run.id;
 // Only the exercise clock is accelerated; this is not an FPS or difficulty measurement.
 const sealed=JSON.stringify(run.containers.map(c=>c.contents));
 state.inv.push({uid:81,id:'ITM-00001',q:1,locked:false});
 run.riskUids=[81];
 run.loot=[{id:'ITM-00003',q:2,tid:11},{id:'ITM-00002',q:1,tid:12}];
 run.safeIds=[11];run.lootSerial=13;
 for(let activeSecond=1;activeSecond<300;activeSecond++){
  now+=1000;
  run.player.invuln=1000; // Isolate timer/spawn/settlement from combat balance.
  t.tick(.045);
  assert.equal(run.status,'playing','must remain active before 300 game seconds');
  assert.ok(run.enemies.length<=20,'live actor list stays bounded');
  assert.ok(run.damageTexts.length<=18,'damage HUD remains bounded');
  if(activeSecond%60===0)assert.ok(t.validCheckpoint(t.snapshotRun()),
   'checkpoint is valid after '+activeSecond+' active seconds');
  if(activeSecond===160){
   t.togglePause();
   const frozen=t.remaining(),checkpoint=t.snapshotRun();
   assert.ok(t.validCheckpoint(checkpoint));
   now+=600_000; // Ten minutes on another app must not use raid time.
   assert.ok(Math.abs(t.remaining()-frozen)<.05);
   state.exploreRun=checkpoint;t.resetRun();t.restoreRunIfNeeded();
   run=t.runRef();
   assert.equal(run.id,originalId);assert.equal(run.paused,true);
   assert.equal(JSON.stringify(run.containers.map(c=>c.contents)),sealed,
    'sealed loot must not re-roll on reload');
   assert.deepEqual(run.safeIds,[11]);
   t.togglePause();
   assert.ok(Math.abs(t.remaining()-frozen)<.05);
  }
 }
 now+=1000;run.player.invuln=1000;t.tick(.045);
 assert.equal(run.status,'lost','five-minute cutoff must settle only once');
 assert.equal(state.exploreLastResult.status,'lost');
 assert.deepEqual(state.exploreLastResult.saved,[{id:'ITM-00003',q:2}],
  'only safe-pouch loot comes back on timeout');
 assert.equal(state.exploreLastResult.lost.length,1);
 assert.equal(state.inv.some(v=>v.uid===81),false,'risky gear was removed');
 const count=state.inv.length,settlement=JSON.stringify(state.exploreLastResult);
 t.tick(.045);
 assert.equal(state.inv.length,count,'timeout must not duplicate protected loot');
 assert.equal(JSON.stringify(state.exploreLastResult),settlement,'claim must be idempotent');
});
test('R5.72 high-rarity extraction stakes expose only unprotected real rewards',async()=>{
 const {t,state}=await harness();t.startRun();const r=t.runRef();
 r.loot=[{id:'ITM-00001',q:0,tid:11},{id:'ITM-00003',q:1,tid:12},
  {id:'ITM-00002',q:0,tid:13}];
 r.lootSerial=14;r.safeIds=[12];
 const before=JSON.stringify({containers:r.containers,loot:r.loot,safeIds:r.safeIds,lootSerial:r.lootSerial}),a=t.v5ExtractionStakes();
 assert.equal(a.unsecuredCount,1,'only unprotected EX rarity is exposed');
 assert.equal(a.protectedRare,1);
 assert.equal(a.exposedValue,t.lootBaseValue(r.loot[0]));
 assert.equal(a.pouchFree,1);
 assert.equal(a.progress,null,'return progress is not shown before using the hatch');
 assert.equal(JSON.stringify({containers:r.containers,loot:r.loot,safeIds:r.safeIds,lootSerial:r.lootSerial}),before,'read-only HUD may not edit sealed loot or protection');
 r.safeIds=[11,12];
 const b=t.v5ExtractionStakes();
 assert.equal(b.unsecuredCount,0);assert.equal(b.exposedValue,0);assert.equal(b.pouchFree,0);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 state.exploreRun=t.snapshotRun();t.resetRun();t.restoreRunIfNeeded();
 assert.equal(t.v5ExtractionStakes().unsecuredCount,0,'protected rarity survives reload');
});
test('R5.72 escape progress uses the Tiled-authored route in either A/B lockdown',async()=>{
 for(const [random,variant] of [[.1,'strict'],[.9,'cover']]){
  const {t,layout,dom}=await harness(()=>random);t.startRun();
  const r=t.runRef(),route=layout.escapeRoute;
  assert.equal(r.escapeVariant,variant);
  r.hasKeycard=true;r.vaultUnlocked=true;r.vaultEntered=true;r.vaultSealed=true;
  r.vaultHatchUsed=true;r.vaultAlarm=true;
  r.player.x=route[0].x;r.player.y=route[0].y;
  assert.equal(t.v5ExtractionStakes().progress,0);
  const objective={textContent:''},stage={dataset:{}};dom.set('exp-vault-objective',objective);
  dom.set('exp-vault-stage',stage);
  t.updateHUD(true);assert.match(objective.textContent,/帰還路約0%/);
  assert.equal(stage.dataset.alarm,'true');
  r.player.x=route[route.length-1].x;r.player.y=route[route.length-1].y;
  assert.equal(t.v5ExtractionStakes().progress,100);
  t.updateHUD(true);assert.match(objective.textContent,/帰還路約100%/);
  assert.ok(t.validCheckpoint(t.snapshotRun()),'no new field is required for progress');
 }
});
test('R5.72 HUD exposes the rare loss risk without changing combat or map overlay',async()=>{
 const {t,dom}=await harness();t.startRun();const r=t.runRef();
 const banner={textContent:'',dataset:{}};const bag={textContent:''};
 dom.set('exp-extraction-stakes',banner);dom.set('exp-bag-rare-risk',bag);
 r.loot=[{id:'ITM-00001',q:0,tid:31}];r.lootSerial=32;r.safeIds=[];
 t.updateHUD(true);
 assert.match(banner.textContent,/未保護SSR以上 1点/);
 assert.match(bag.textContent,/ポーチ空き 2/);
 assert.equal(banner.dataset.risk,'exposed');
 r.safeIds=[31];t.updateHUD(true);
 assert.equal(banner.dataset.risk,'none');assert.equal(banner.textContent,'');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('R5.69 iPhone second-finger touch activates both AUTO and attack, never double-clicks',async()=>{
 const {t,dom,gameWindow}=await harness();t.startRun();
 const run=t.runRef();const listeners=new Map();
 const actionHost={dataset:{},addEventListener:(type,fn)=>listeners.set(type,fn),
  contains:button=>!!button&&['auto','attack','bag'].includes(button.dataset.explore)};
 dom.set('.exp-playing .exp-control-actions',actionHost);
 const mkButton=type=>({dataset:{explore:type},disabled:false,closest:selector=>
   selector==='button[data-explore]'?mkCache[type]:null});
 const mkCache=Object.fromEntries(['auto','attack','bag'].map(type=>[type,null]));
 for(const type of Object.keys(mkCache))mkCache[type]=mkButton(type);
 t.bindMultiTouchActions();t.bindMultiTouchActions();
 assert.equal(listeners.size,2,'touch/click listeners registered once on the parent of both rows');
 const sendTouch=type=>{
  let prevented=false;
  listeners.get('touchstart')({target:mkCache[type],cancelable:true,preventDefault(){prevented=true}});
  assert.ok(prevented,'second finger suppresses WebKit gesture while steering');
 };
 const duplicate=type=>{
  let prevented=false,stopped=false;
  listeners.get('click')({target:mkCache[type],detail:1,preventDefault(){prevented=true},
   stopPropagation(){stopped=true}});
  assert.ok(prevented&&stopped,'synthetic touch click is suppressed without a second action');
 };
 run.joy={x:.8,y:0};assert.equal(run.autoAttack,false);
 sendTouch('auto');assert.equal(run.autoAttack,true);
 assert.equal(run.joy.x,.8,'AUTO second finger leaves joystick state intact');
 duplicate('auto');assert.equal(run.autoAttack,true);
 run.attackAt=0;sendTouch('attack');
 assert.ok(run.attackAt>0,'touch Attack executes while virtual joystick is held');
 assert.equal(run.joy.x,.8);duplicate('attack');
 let keyboardPrevented=false;
 listeners.get('click')({target:mkCache.auto,detail:0,preventDefault(){keyboardPrevented=true},
  stopPropagation(){}});
 assert.equal(keyboardPrevented,false,'keyboard click remains delegated normally');
 // Opening the bag deliberately releases steering so the player can inspect loot.
 const bag={classList:{toggle(v){this.open=v}}};
 dom.set('exp-backpack',bag);sendTouch('bag');assert.equal(bag.classList.open,'exp-bag-open');
 duplicate('bag');
});
test('R5.69 final mobile CSS restores 44px auxiliary and loot tap targets',()=>{
 const css=read('exploration.css'),end=css.slice(css.lastIndexOf('/* R5.69 mobile audit:'));
 assert.match(end,/\.exp-action-bottom button\s*\{[^}]*height:44px!important;min-height:44px!important/);
 assert.match(end,/\.exp-loot-valued \.exp-safe-toggle,/);
 assert.match(end,/\.exp-loot-valued \[data-explore="drop"\],/);
 assert.match(end,/\.exp-loot-sort button,/);
 assert.match(end,/\.exp-auto-protect,/);
 const html=read('index.html');
 assert.match(html,/exploration\.css\?v=R5\.79/);
 assert.match(html,/exploration\.js\?v=R5\.80/);
 assert.match(html,/exploration-layout-v5\.js\?v=R5\.80/);
});
test('R5.69b blur and pagehide freeze raid once and save the exact remaining time',async()=>{
 const {t,state,windowEvents,documentEvents,document}=await harness();
 t.startRun();const r=t.runRef();
 r.start=Date.now()-60000;r.joy={x:.8,y:.2};r.steer={x:.8,y:.2};
 t.setLastFrame(99999);
 windowEvents.get('blur')();
 assert.equal(r.paused,true);
 assert.equal(r.joy.x,0);assert.equal(r.steer.x,0);
 const frozen=t.remaining(),id=r.id;
 assert.ok(frozen>235&&frozen<245);
 assert.equal(state.exploreRun.id,id);
 assert.ok(Math.abs(state.exploreRun.remaining-frozen)<.3);
 windowEvents.get('pagehide')();
 assert.equal(r.paused,true,'pagehide must not resume an already paused raid');
 assert.ok(Math.abs(t.remaining()-frozen)<.05);
 assert.ok(t.validCheckpoint(state.exploreRun));
 t.togglePause();
 assert.equal(r.paused,false);
 assert.equal(t.lastFrameRef(),0,'no synthetic huge frame gap after resuming');
 assert.ok(Math.abs(t.remaining()-frozen)<.1);
 document.hidden=true;documentEvents.get('visibilitychange')();
 assert.equal(r.paused,true);
});
test('R5.69b alarm-only performance diagnostics ignore background-sized frames',async()=>{
 const {t}=await harness();t.startRun();const r=t.runRef();
 t.sampleFrame(1000,16.7);
 t.sampleFrame(1040,45);
 assert.equal(t.perf.slow,1);
 assert.equal(t.perf.alarmFrames,0);
 r.vaultAlarm=true;
 t.sampleFrame(1080,45);
 t.sampleFrame(1110,16.7);
 t.sampleFrame(5000,4000);
 assert.equal(t.perf.alarmFrames,2);
 assert.equal(t.perf.alarmSlow,1);
 r.paused=true;r.pausedAt=Date.now();
 assert.match(t.pausePanel(),/警報中40ms以上：1\/2フレーム/);
});
test('R5.78 near-cache button reveals supply grade and odds, never sealed item identity',async()=>{
 const {t,layout,dom}=await harness(()=>.99);t.startRun();
 const r=t.runRef();r.enemies=[];
 const interact={dataset:{},textContent:'',attributes:{},setAttribute(name,v){this.attributes[name]=v}};
 dom.set('exp-interact',interact);
 const ultra=r.containers.find(c=>layout.supplyTierForContainer(c)==='ultra'&&c.contents.length);
 assert.ok(ultra,'authored ultra cache must be present');
 r.player.x=ultra.x;r.player.y=ultra.y;
 const before=JSON.stringify(ultra.contents);
 t.updateHUD(true);
 assert.equal(interact.dataset.context,'container');
 assert.equal(interact.textContent,'調べる 赤金');
 assert.ok(interact.attributes['aria-label'].includes('55.5%'));
 assert.doesNotMatch(interact.attributes['aria-label'],/古代の剣|宝石の首飾り/,'pre-open label hides sealed item');
 assert.equal(JSON.stringify(ultra.contents),before,'scouting is read-only');
 const ordinary=r.containers.find(c=>layout.supplyTierForContainer(c)==='standard'&&c.contents.length);
 assert.ok(ordinary);r.player.x=ordinary.x;r.player.y=ordinary.y;
 t.updateHUD(true);assert.equal(interact.textContent,'調べる 一般');
 assert.ok(interact.attributes['aria-label'].includes('1.3%'));
 assert.equal(t.v5SsrPlusPercent('high'),28);
 assert.equal(t.v5SsrPlusPercent('mid'),5.2);
});
test('R5.78 opening sealed cache reveals only remaining grade, real value and weight',async()=>{
 const {t,layout}=await harness(()=>.99);t.startRun();
 const r=t.runRef();r.enemies=[];
 const c=r.containers.find(c=>layout.supplyTierForContainer(c)==='ultra'&&c.contents.length);
 assert.ok(c);r.player.x=c.x;r.player.y=c.y;
 const sealed=JSON.stringify(c.contents);
 const expected=t.v5CacheReveal(c);
 const preview=t.facilityPreviewPanel();
 assert.doesNotMatch(preview,/高レア発見！/,'pre-raid map should not reveal jackpot');
 t.openContainer();assert.equal(r.paused,true);
 const html=t.pausePanel();
 assert.match(html,/class="exp-cache-reveal"/);
 assert.match(html,/data-reveal="rare"/);
 assert.match(html,/高レア発見！/);
 assert.match(html,new RegExp('SSR以上 '+expected.rareCount+'点'));
 assert.ok(expected.rareCount>0&&expected.value>0);
 assert.ok(html.includes(expected.value.toLocaleString('ja-JP')),'real sealed sum appears after opening');
 assert.ok(html.includes((expected.weight/10).toFixed(1)+'kg'));
 assert.equal(JSON.stringify(c.contents),sealed,'reveal cannot alter sealed contents');
 const snapshot=t.snapshotRun();assert.ok(t.validCheckpoint(snapshot));
 t.takeContainerItem({dataset:{container:c.id,i:'0'}});
 const remaining=t.v5CacheReveal(c);assert.equal(remaining.count,expected.count-1);
 assert.equal(remaining.value,expected.value-t.lootBaseValue(snapshot.containers.find(v=>v.id===c.id).contents[0]));
 assert.ok(t.validCheckpoint(t.snapshotRun()),'ordinary pickup still checkpoint-safe');
});
test('V5 full raid uses production containers and resumes exact sealed loot',async()=>{
 const {t,layout,state}=await harness();
 t.startRun();const run=t.runRef();
 assert.equal(run.mapVersion,5);
 assert.equal(run.duration,300);
 assert.equal(run.exitId,layout.fixedExit.id);
 assert.equal(run.containers.length,11);
 assert.equal(run.pendingGuardPosts.length<=9,true);
 assert.ok(t.validCheckpoint(t.snapshotRun()),'new V5 checkpoint should validate');
 const cache=run.containers.find(c=>c.contents.length);
 run.enemies=[];run.player.x=cache.x;run.player.y=cache.y;
 const first=JSON.stringify(cache.contents[0]);
 t.openContainer();assert.equal(run.paused,true);
 assert.equal(run.lootOpenId,cache.id);
 t.takeContainerItem({dataset:{container:cache.id,i:'0'}});
 assert.equal(JSON.stringify(run.loot[0]).includes(JSON.parse(first).id),true);
 assert.ok(t.validCheckpoint(t.snapshotRun()),'checkpoint after loot must validate');
 const saved=t.snapshotRun();
 state.exploreRun=saved;t.resetRun();t.restoreRunIfNeeded();
 const restored=t.runRef();
 assert.equal(restored.mapVersion,5);
 assert.equal(restored.paused,true);
 assert.equal(restored.loot.length,1);
 assert.equal(restored.containers.find(x=>x.id===cache.id).contents.length,cache.contents.length);
 assert.equal(restored.loot[0].id,JSON.parse(first).id);
});
test('V5 successful extraction commits retrieved item to merchant inventory once',async()=>{
 const {t,layout,state,received}=await harness();
 t.startRun();const run=t.runRef(),cache=run.containers[0];
 run.enemies=[];run.player.x=cache.x;run.player.y=cache.y;
 t.openContainer();
 t.takeContainerItem({dataset:{container:cache.id,i:'0'}});
 t.closeContainer();
 run.player.x=layout.fixedExit.x;run.player.y=layout.fixedExit.y;
 t.bank();
 assert.equal(run.status,'escaped');
 assert.equal(received.length,1);
 assert.equal(state.inv.length,1);
 assert.equal(state.exploreRun,null);
 assert.equal(state.exploreLastResult.status,'escaped');
 assert.equal(state.exploreLastResult.saved.length,1);
});
test('V5 death protects only safety pouch loot',async()=>{
 const {t,state,received}=await harness();
 t.startRun();const run=t.runRef();
 run.loot=[{id:'ITM-00002',q:1,tid:1},{id:'ITM-00003',q:2,tid:2}];
 run.safeIds=[2];run.lootSerial=3;
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 t.lose('test loss');
 assert.equal(received.length,1);
 assert.equal(received[0].id,'ITM-00003');
 assert.equal(state.exploreLastResult.status,'lost');
 assert.equal(state.exploreLastResult.saved.length,1);
 assert.equal(state.exploreRun,null);
});

test('R5.51 vault sentry steps aside so a stealth player can use the obligatory corridor',async()=>{
 const {t,layout}=await harness();t.startRun();
 const run=t.runRef(),post=layout.guardPosts.find(p=>p.id==='tiled-guard-15');
 assert.ok(post,'authored vault sentry');
 assert.equal(run.autoAttack,false,'stealth should not cause automatic attacks without player opt-in');
 assert.equal(post.route.length,4,'authored map patrol, not fallback wandering');
 assert.ok(post.pauses[1]>=2.5,'sentry waits at the alcove, making crossing timing readable');
 const parking=post.route[1];
 assert.ok(parking.x>post.x+70,'sentry vacates the central lane to the right');
 for(const waypoint of post.route)assert.ok(!layout.solid(waypoint.x,waypoint.y,17),'no patrol waypoint overlaps a wall');
 for(let y=post.y+240;y>=post.y-120;y-=4){
  assert.ok(!layout.solid(post.x,y,12),'the checkpoint corridor stays player-passable at '+Math.round(y));
  assert.ok(Math.hypot(parking.x-post.x,parking.y-y)>t.enemyDefinition('normal').radius+12,
   'the parked sentry does not physically seal the mandatory corridor');
 }
 const e=t.restoreEnemy({x:post.x,y:post.y,homeX:post.x,homeY:post.y,
  kind:'normal',hp:t.enemyDefinition('normal').hp,mode:'patrol',facingX:1,facingY:0,attackAt:99});
 run.enemies=[e];assert.equal(e.guardRoute.length,4);
 t.enemyPatrol(e,t.enemyDefinition(e.kind),0,.05);
 for(let n=1;n<=80;n++){
  t.enemyPatrol(e,t.enemyDefinition(e.kind),.3+n*.05,.05);
  assert.ok(!layout.solid(e.x,e.y,t.enemyDefinition(e.kind).radius),'patrol does not clip the alcove');
 }
 assert.ok(Math.hypot(e.x-parking.x,e.y-parking.y)<17,'sentry reaches and pauses in its alcove');
});

test('R5.51 stealth reacts to facing and walls, then abandons a hidden player',async()=>{
 const {t,layout}=await harness();t.startRun();
 const run=t.runRef(),post=layout.guardPosts.find(p=>p.id==='tiled-guard-15');
 const make=()=>t.restoreEnemy({x:post.x,y:post.y,homeX:post.x,homeY:post.y,
  kind:'normal',hp:t.enemyDefinition('normal').hp,mode:'patrol',facingX:0,facingY:1,attackAt:99});
 const guard=make();run.enemies=[guard];
 run.player.x=post.x;run.player.y=post.y+96;
 assert.equal(layout.visionClear(guard,run.player),true,'the guard can see straight down the hallway');
 guard.patrolUntil=100; // watch a fixed guard for a deterministic recognition window
 for(let i=0;i<2;i++)t.updateEnemy(guard,1+i*.1,.1);
 assert.equal(guard.mode,'patrol','a brief glimpse alone must not trigger pursuit');
 for(let i=2;i<5;i++)t.updateEnemy(guard,1+i*.1,.1);
 assert.equal(guard.mode,'alert','sustained exposed movement must be detected');
 const hidden={x:598*3,y:229*3};
 assert.equal(layout.solid(hidden.x,hidden.y,12),false,'cover position is walkable');
 assert.equal(layout.visionClear(guard,hidden),false,'wall blocks the enemy sight ray');
 run.player.x=hidden.x;run.player.y=hidden.y;
 guard.mode='chase';guard.lastSeen=0;
 t.updateEnemy(guard,4,.1);
 assert.equal(guard.mode,'search','cover breaks pursuit after its last-seen grace period');
 t.updateEnemy(guard,7.3,.1);
 assert.equal(guard.mode,'search','V5 now checks the last sighting and nearby covers rather than instantly giving up');
 t.updateEnemy(guard,guard.searchUntil+.1,.1);
 assert.equal(guard.mode,'patrol','guard eventually returns to normal patrol instead of tracking through cover');
 const parked=make();parked.x=post.route[1].x;parked.y=post.route[1].y;
 parked.facingX=1;parked.facingY=0;parked.patrolUntil=100;
 run.player.x=post.x;run.player.y=post.y;
 run.enemies=[parked];
 t.updateEnemy(parked,7,.4);
 assert.equal(parked.mode,'patrol','player crossing behind the guard in the side alcove is not spotted');
});

test('R5.52 V5 awareness HUD reflects real detection, search and pursuit states',async()=>{
 const {t,dom}=await harness();t.startRun();
 const run=t.runRef();run.enemies=[];
 const status={dataset:{}};
 const text={textContent:''};
 const fill={style:{width:''}};
 const meter={attributes:{},setAttribute(name,value){this.attributes[name]=value}};
 dom.set('exp-stealth-status',status);
 dom.set('exp-stealth-label',text);
 dom.set('exp-stealth-fill',fill);
 dom.set('exp-stealth-meter',meter);
 assert.equal(t.stealthSituation().mode,'hidden');
 t.updateHUD(true);
 assert.equal(status.dataset.state,'hidden');
 assert.equal(text.textContent,'未発見');
 assert.equal(meter.attributes['aria-valuenow'],'0');
 assert.equal(run.autoAttack,false,'the V5 player begins in stealth mode');
 const e=t.restoreEnemy({x:run.player.x+90,y:run.player.y,
  homeX:run.player.x+90,homeY:run.player.y,
  kind:'normal',hp:92,mode:'patrol',attackAt:10});
 run.enemies=[e];e.notice=.24;
 assert.equal(t.stealthSituation().mode,'notice');
 assert.equal(t.stealthSituation().percent,50,'half of the V5 .48s notice threshold');
 t.updateHUD(true);
 assert.equal(status.dataset.state,'notice');
 assert.equal(fill.style.width,'50%');
 e.mode='search';e.notice=0;
 assert.equal(t.stealthSituation().mode,'search');
 t.updateHUD(true);
 assert.match(text.textContent,/捜索中/);
 e.mode='chase';e.x=run.player.x;e.y=run.player.y;
 assert.equal(t.stealthSituation().percent,100);
 t.updateHUD(true);
 assert.equal(status.dataset.state,'chase');
 assert.match(text.textContent,/発見中/);
 e.mode='patrol';e.notice=0;
 e.x=run.player.x+250;e.y=run.player.y+250;
 t.updateHUD(true);
 assert.equal(status.dataset.state,'hidden');
 assert.equal(fill.style.width,'0%');
});

test('R5.52 actual V5 raid UI shows the new northeast briefing and stealth controls',async()=>{
 const {t}=await harness();t.startRun();
 const html=t.contents();
 assert.match(html,/id="exp-stealth-status"/);
 assert.match(html,/id="exp-stealth-label"/);
 assert.match(html,/id="exp-stealth-meter"/);
 assert.match(html,/屋内ドット絵施設 V5/);
 assert.match(html,/AUTO OFF/);
 const css=read('exploration.css');
 assert.match(css,/\.exp-playing \.exp-stealth-status\{/);
 assert.match(css,/pointer-events:none/);
});

test('R5.53 V5 exposure is forgiving briefly, but prolonged sight still triggers pursuit',async()=>{
 const {t,layout}=await harness();t.startRun();
 const run=t.runRef(),post=layout.guardPosts.find(p=>p.id==='tiled-guard-15');
 assert.equal(t.facilityNoticeThreshold(),.48);
 const guard=t.restoreEnemy({
  x:post.x,y:post.y,homeX:post.x,homeY:post.y,
  kind:'normal',hp:t.enemyDefinition('normal').hp,mode:'patrol',
  facingX:0,facingY:1,attackAt:99,patrolUntil:100
 });
 run.player.x=post.x;run.player.y=post.y+96;run.enemies=[guard];
 for(let i=0;i<4;i++)t.updateEnemy(guard,1+i*.1,.1);
 assert.equal(guard.mode,'patrol','four short frames do not instantly expose a distant player');
 assert.ok(guard.notice>.35&&guard.notice<.45);
 t.updateEnemy(guard,1.4,.1);
 assert.equal(guard.mode,'alert','five continuous visible frames exceed the new warning period');
 const reset=t.restoreEnemy({
  x:post.x,y:post.y,homeX:post.x,homeY:post.y,kind:'normal',
  hp:t.enemyDefinition('normal').hp,mode:'patrol',facingX:0,facingY:1,attackAt:99
 });
 assert.equal(t.facilityNoticeReady(reset,.2,true),false);
 assert.equal(t.facilityNoticeReady(reset,.1,false),false);
 assert.equal(reset.notice,0,'moving into cover clears brief exposure');
 assert.equal(t.facilityNoticeReady(reset,.48,true),true);
});

test('R5.53 V5 runs faster than a normal pursuer, while fast guards remain dangerous',async()=>{
 const {t}=await harness();t.startRun();const run=t.runRef();
 assert.equal(run.stats.speed,118,'saved player stats stay unchanged');
 const normal=t.enemyDefinition('normal'),fast=t.enemyDefinition('fast'),heavy=t.enemyDefinition('heavy');
 const escapeSpeed=run.stats.speed*1.08;
 assert.ok(escapeSpeed>normal.chaseSpeed,'unencumbered player can create distance from a normal sentry');
 assert.ok(fast.chaseSpeed>escapeSpeed,'the fast enemy remains capable of catching a straight runner');
 assert.ok(heavy.chaseSpeed<normal.chaseSpeed,'heavy sentries are dangerous at close range, not in sprints');
 for(const [kind,def] of [['normal',normal],['fast',fast],['heavy',heavy]]){
  const e={kind};
  assert.equal(t.facilityPursuitSpeed(e,def,true),def.chaseSpeed,'no hidden pursuit multiplier for '+kind);
  assert.ok(t.facilityPursuitSpeed(e,def,false)<def.chaseSpeed,'cover slows pursuit for '+kind);
 }
 const before=run.player.x;
 run.enemies=[];run.joy={x:1,y:0};run.steer={x:1,y:0};
 run.spawnAt=999;
 t.tick(.1);
 assert.ok(Math.abs(run.player.x-before-escapeSpeed*.1)<.3,'tick applies real movement factor in the live map');
 assert.ok(t.stealthSituation().mode==='hidden');
});

test('R5.53 V5 cover interrupts chase after a short but real grace interval',async()=>{
 const {t,layout}=await harness();t.startRun();
 const run=t.runRef(),post=layout.guardPosts.find(p=>p.id==='tiled-guard-15');
 const e=t.restoreEnemy({
  x:post.x,y:post.y,homeX:post.x,homeY:post.y,
  kind:'normal',hp:t.enemyDefinition('normal').hp,
  mode:'chase',lastSeen:0,lastX:post.x,lastY:post.y,attackAt:999
 });
 const hidden={x:598*3,y:229*3};
 assert.equal(layout.visionClear(e,hidden),false);
 run.player.x=hidden.x;run.player.y=hidden.y;run.enemies=[e];
 t.updateEnemy(e,2.3,.1);
 assert.equal(e.mode,'chase','guard still checks the last known location during short cover breaks');
 t.updateEnemy(e,2.5,.1);
 assert.equal(e.mode,'search','guard stops chasing after the V5 memory interval');
 t.updateEnemy(e,5.8,.1);
 assert.equal(e.mode,'search','new V5 search investigates nearby cover rather than instantly resetting');
 t.updateEnemy(e,e.searchUntil+.1,.1);
 assert.equal(e.mode,'patrol','bounded search eventually expires rather than locking enemies into pursuit');
});

test('R5.53 V5 save/resume retains sentry patrol, speed profile and warning progress',async()=>{
 const {t,layout,state}=await harness();t.startRun();
 const run=t.runRef(),post=layout.guardPosts.find(p=>p.id==='tiled-guard-15');
 assert.ok(post?.pauses?.length,'authored guard route includes pauses');
 run.pendingGuardPosts=run.pendingGuardPosts.filter(id=>id!==post.id);
 const guard=t.restoreEnemy({x:post.x,y:post.y,homeX:post.x,homeY:post.y,
  kind:'normal',hp:75,mode:'patrol',facingX:1,facingY:0,
  guardStep:2,notice:.51,patrolUntil:3,attackAt:99
 });
 run.enemies=[guard];assert.ok(t.validCheckpoint(t.snapshotRun()));
 state.exploreRun=t.snapshotRun();t.resetRun();t.restoreRunIfNeeded();
 const resumed=t.runRef();
 assert.equal(resumed.mapVersion,5);
 assert.equal(resumed.paused,true);
 assert.equal(resumed.enemies.length,1);
 const restored=resumed.enemies[0];
 assert.equal(restored.hp,75);
 assert.equal(restored.maxHp,92,'V5 enemy HP reference must survive run recreation');
 assert.equal(restored.notice,.51,'near-complete warning remains in the checkpoint');
 assert.equal(restored.guardStep,2);
 assert.deepEqual(Array.from(restored.guardRoute,x=>[x.x,x.y]),
  Array.from(post.route,x=>[x.x,x.y]),'the Tiled guard patrol must survive reloading');
 assert.deepEqual(Array.from(restored.guardPause),Array.from(post.pauses));
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R5.54 V5 reward tiers are normalized, distinct and contain a yellow jackpot',async()=>{
 const {t}=await harness();
 const w=t.V5_SUPPLY_WEIGHTS;
 assert.deepEqual(Array.from(w.standard),[490,310,150,37,11,2,0]);
 assert.deepEqual(Array.from(w.mid),[220,310,260,158,46,6,0]);
 assert.deepEqual(Array.from(w.high),[55,115,210,340,225,52,3]);
 for(const tier of ['standard','mid','high']){
  assert.equal(w[tier].length,7);
  assert.equal(w[tier].reduce((sum,v)=>sum+v,0),1000);
  assert.ok(w[tier].every(v=>v>=0),'no negative rarity weights');
 }
 assert.equal(t.v5SsrPlusPercent('standard'),1.3);
 assert.equal(t.v5SsrPlusPercent('mid'),5.2);
 assert.equal(t.v5SsrPlusPercent('high'),28);
 assert.ok(w.standard[5]>0,'yellow supplies retain a nonzero UR jackpot');
 assert.ok(w.high[6]>0,'vaults retain an exceptional EX chance');
});

test('R5.54 V5-only grade probability affects actual reward rolls without changing V4',async()=>{
 // .75 falls into SSR for the new violet table but SR in the historic V4 safe.
 const {t,itemRarity}=await harness(()=>.75);
 const high=t.containerReward('safe','jewelry','high',5);
 const old=t.containerReward('safe','jewelry','high',4);
 assert.equal(itemRarity(high.id),'SSR');
 assert.equal(itemRarity(old.id),'SR');
 const medium=t.containerReward('safe','jewelry','mid',5);
 const yellow=t.containerReward('safe','jewelry','standard',5);
 assert.ok(medium&&yellow,'all authored grades still produce actual inventory item IDs');
});

test('R5.54 seeded simulated draws confirm rare value increases with danger',async()=>{
 let seed=20261029;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const {t,itemRarity}=await harness(random);
 const n=1500,rates={};
 for(const tier of ['standard','mid','high']){
  let successes=0;
  for(let i=0;i<n;i++){
   const r=t.containerReward('safe','jewelry',tier,5);
   if(['SSR','UR','EX'].includes(itemRarity(r.id)))successes++;
  }
  rates[tier]=successes/n*100;
 }
 assert.ok(rates.standard>=.2&&rates.standard<3.3,'yellow SSR+ odds: '+rates.standard);
 assert.ok(rates.mid>3.3&&rates.mid<8,'blue SSR+ odds: '+rates.mid);
 assert.ok(rates.high>23&&rates.high<33,'violet SSR+ odds: '+rates.high);
 assert.ok(rates.high>rates.mid*3&&rates.mid>rates.standard,'risk premium should be pronounced');
});

test('R5.56 pre-raid map shows 3 yellow, 4 blue, 2 violet, 2 red-gold and the access card',async()=>{
 const {t,layout}=await harness();
 const preview=t.facilityPreviewPanel();
 assert.equal(layout.authoredContainers.length,11);
 assert.equal(layout.authoredContainers.filter(c=>c.tier==='standard').length,3);
 assert.equal(layout.authoredContainers.filter(c=>c.tier==='mid').length,4);
 assert.equal(layout.authoredContainers.filter(c=>c.tier==='high').length,2);
 assert.equal(layout.authoredContainers.filter(c=>c.tier==='ultra').length,2);
 for(const [color,count] of [['#e6c66b',3],['#6bb9e5',4],['#ba8bf5',2],['#ff856e',2]]){
  assert.equal(preview.split('fill="'+color+'"').length-1,count,'supply markers '+color);
 }
 assert.match(preview,/黄 1\.3%/);
 assert.match(preview,/青 5\.2%/);
 assert.match(preview,/紫 28\.0%/);
 assert.match(preview,/赤金 55\.5%/);
 assert.match(preview,/レア度は確定ではありません/);
 assert.match(preview,/カードキー入手/);
 const {t:live}=await harness();live.startRun();
 const run=live.runRef(),gold=run.containers.filter(c=>c.tier==='high');
 assert.equal(gold.length,2,'high-value contents are still sealed when sortie begins');
 assert.ok(gold.every(c=>c.contents.length>=2&&c.contents.length<=4));
 const snapshot=live.snapshotRun();
 assert.ok(live.validCheckpoint(snapshot),'new reward profiles do not break saved raid validation');
});

test('R5.55 valuable loot appears with consistent base totals, protected totals and sorted bag rows',async()=>{
 const {t}=await harness();t.startRun();
 const run=t.runRef();run.enemies=[];
 run.loot=[
  {id:'ITM-00002',q:0,tid:1},
  {id:'ITM-00003',q:2,tid:2},
  {id:'ITM-00001',q:1,tid:3}
 ];run.safeIds=[2];run.lootSerial=4;
 assert.deepEqual({...t.lootSummary()},{total:410200,secured:10000,weight:45,protectedCount:1});
 assert.deepEqual(Array.from(t.lootOrder(),v=>v.i),[2,1,0],'value per kg sorts display, not saved rows');
 assert.deepEqual(Array.from(run.loot,v=>v.tid),[1,2,3],'sorting must never mutate checkpoint item indices');
 const lines=t.lootRowsV5();
 assert.match(lines,/売却基準 400,000/);
 assert.match(lines,/価値\/kg/);
 assert.match(lines,/data-i="2"/,'click index must point to original saved loot row after sorting');
 assert.match(lines,/data-i="1"/);
 assert.match(lines,/aria-pressed="true"/);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 run.paused=true;run.pausedAt=Date.now();
 const paused=t.pausePanel();
 assert.match(paused,/売却基準合計 410,200/);
 assert.match(paused,/保護済 10,000/);
 assert.match(paused,/荷重速度/);
 assert.match(paused,/空き枠に高額品を保護/);
 assert.match(paused,/価値\/kg順/);
});

test('R5.55 sorting by weight or recency keeps real item identities and safe-pouch slots',async()=>{
 const {t,gameWindow}=await harness();t.startRun();
 const run=t.runRef();
 run.loot=[{id:'ITM-00002',q:0,tid:1},{id:'ITM-00003',q:1,tid:2},{id:'ITM-00001',q:2,tid:3}];
 run.safeIds=[1];run.lootSerial=4;
 const saved=JSON.stringify(run.loot);
 gameWindow.explorationAction({dataset:{explore:'bag-sort',sort:'recent'}});
 assert.equal(run.lootSort,'recent');
 assert.deepEqual(Array.from(t.lootOrder(),v=>v.i),[2,1,0]);
 gameWindow.explorationAction({dataset:{explore:'bag-sort',sort:'weight'}});
 assert.equal(run.lootSort,'weight');
 const weights=Array.from(t.lootOrder(),v=>v.v.id).map(id=>t.weightTenths(id));
 assert.ok(weights.every((v,i)=>i===0||weights[i-1]>=v));
 assert.equal(JSON.stringify(run.loot),saved);
 assert.deepEqual(Array.from(run.safeIds),[1]);
 gameWindow.explorationAction({dataset:{explore:'bag-sort',sort:'bad-value'}});
 assert.equal(run.lootSort,'weight','invalid sort input cannot change state');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R5.55 one-tap safe-pouch filling preserves chosen protection and survives reload',async()=>{
 const {t,gameWindow,state}=await harness();t.startRun();
 const run=t.runRef();
 run.loot=[{id:'ITM-00002',q:1,tid:1},{id:'ITM-00003',q:2,tid:2},{id:'ITM-00001',q:1,tid:3}];
 run.safeIds=[1];run.lootSerial=4;
 gameWindow.explorationAction({dataset:{explore:'auto-protect'}});
 assert.deepEqual(Array.from(run.safeIds),[1,3],'user protected item stays, highest-value unprotected fills the other slot');
 gameWindow.explorationAction({dataset:{explore:'auto-protect'}});
 assert.deepEqual(Array.from(run.safeIds),[1,3],'repeated tap never replaces protected inventory');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 state.exploreRun=t.snapshotRun();t.resetRun();t.restoreRunIfNeeded();
 assert.deepEqual(Array.from(t.runRef().safeIds),[1,3]);
 t.lose('test protected settlement');
 assert.deepEqual(Array.from(state.exploreLastResult.saved,v=>v.id),['ITM-00002','ITM-00001']);
});

test('R5.55 protected loot cannot be accidentally dropped; regular loot can be discarded',async()=>{
 const {t,gameWindow}=await harness();t.startRun();
 const run=t.runRef();
 run.loot=[{id:'ITM-00002',q:1,tid:1},{id:'ITM-00003',q:1,tid:2}];
 run.safeIds=[2];run.lootSerial=3;
 gameWindow.confirm=()=>false;
 gameWindow.explorationAction({dataset:{explore:'drop',i:'1'}});
 assert.equal(run.loot.length,2,'denied confirmation leaves protected item in the bag');
 assert.deepEqual(Array.from(run.safeIds),[2]);
 gameWindow.explorationAction({dataset:{explore:'drop',i:'0'}});
 assert.equal(run.loot.length,1,'ordinary items can still be dropped with one tap');
 gameWindow.confirm=()=>true;
 gameWindow.explorationAction({dataset:{explore:'drop',i:'0'}});
 assert.equal(run.loot.length,0);
 assert.equal(run.safeIds.length,0,'dropping a confirmed protected item clears its token');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R5.55 V5 progressive weight penalty begins at 70% capacity, V4 formula unchanged',async()=>{
 const {t}=await harness();t.startRun();
 const run=t.runRef();
 const reward={id:'ITM-09000',q:0},capacity=12;
 const make=n=>Array.from({length:n},(_,i)=>({...reward,tid:i+1}));
 assert.equal(t.carrySpeedFactor(make(8),capacity),1);
 const ten=t.carrySpeedFactor(make(10),capacity),twelve=t.carrySpeedFactor(make(12),capacity);
 const sixteen=t.carrySpeedFactor(make(16),capacity);
 assert.ok(ten<.94&&ten>.90,'70-100% load visibly slows movement');
 assert.ok(twelve<ten&&twelve>=.84-.001,'full load is still runnable but dangerous');
 assert.ok(sixteen<twelve&&sixteen<=.37&&sixteen>=.35,'heavy load is a serious extraction risk');
 run.loot=make(16);run.lootSerial=17;
 assert.equal(t.weightLabel().pct,Math.round(sixteen*100));
 run.mapVersion=4;
 assert.equal(t.carrySpeedFactor(make(10),capacity),1);
 assert.equal(t.carrySpeedFactor(make(12),capacity),1);
 assert.equal(t.carrySpeedFactor(make(16),capacity),.76,'historic V4 overweight balance remains untouched');
});

test('R5.56 guaranteed key pickup, card-lock and permanent one-way entrance are playable',async()=>{
 const {t,layout,gameWindow,state}=await harness();t.startRun();
 const run=t.runRef(),key=layout.vaultKeycard,gate=layout.vaultGate,hatch=layout.vaultHatch;
 assert.ok(key&&gate&&hatch,'Tiled objects are available to the actual game');
 assert.equal(run.hasKeycard,false);
 assert.equal(run.vaultUnlocked,false);
 assert.equal(t.solid(gate.x,gate.y,12),true,'entrance physically blocks keyless movement');
 run.enemies=[];run.spawnAt=999;
 run.player.x=gate.x-55;run.player.y=gate.y;
 assert.equal(t.nearVaultGate()?.id,gate.id);
 assert.equal(t.useVaultInteraction(),true);
 assert.equal(run.vaultUnlocked,false,'touching a gate without the card never unlocks it');
 run.player.x=key.x;run.player.y=key.y;
 assert.equal(t.nearVaultKeycard()?.id,key.id);
 assert.equal(t.useVaultInteraction(),true,'key can be collected without a random loot roll');
 assert.equal(run.hasKeycard,true);
 assert.equal(state.inv.length,0,'card is a raid key, not merchant sale inventory');
 run.player.x=gate.x-55;run.player.y=gate.y;
 assert.equal(t.useVaultInteraction(),true);
 assert.equal(run.vaultUnlocked,true);
 assert.equal(t.solid(gate.x,gate.y,12),false,'a valid card opens the physical gate');
 run.player.x=gate.x+gate.tileSize/2+16;run.player.y=gate.y;
 t.sealVaultOnEntry();
 assert.equal(run.vaultEntered,true);
 assert.equal(run.vaultSealed,true);
 assert.equal(t.solid(gate.x,gate.y,12),true,'gate physically reseals permanently');
 run.joy={x:-1,y:0};run.steer={x:-1,y:0};
 const before=run.player.x;
 for(let i=0;i<24;i++)t.tick(.09);
 assert.ok(run.player.x>=gate.x+gate.tileSize/2+11,'return toward original entrance cannot cross the sealed door');
 assert.ok(run.player.x<=before,'leftward movement still approaches the barred doorway');
 assert.ok(t.validCheckpoint(t.snapshotRun()),'one-way entry state can be saved');
});

test('R5.56 the only return from premium vault is a hatch triggering alarm-only guards',async()=>{
 const {t,layout,state}=await harness();t.startRun();
 const run=t.runRef(),gate=layout.vaultGate,key=layout.vaultKeycard,hatch=layout.vaultHatch;
 run.enemies=[];run.spawnAt=999;
 run.player.x=key.x;run.player.y=key.y;t.useVaultInteraction();
 run.player.x=gate.x-55;run.player.y=gate.y;t.useVaultInteraction();
 run.player.x=gate.x+gate.tileSize/2+17;run.player.y=gate.y;t.sealVaultOnEntry();
 assert.equal(run.vaultSealed,true);
 assert.equal(t.nearVaultHatch(),null);
 run.player.x=hatch.x;run.player.y=hatch.y;
 assert.equal(t.nearVaultHatch()?.id,hatch.id);
 assert.equal(t.useVaultInteraction(),true);
 assert.equal(run.vaultHatchUsed,true);
 assert.equal(run.vaultAlarm,true);
 assert.equal(run.vaultSealed,true);
 assert.equal(run.player.x,hatch.landing.x);
 assert.equal(run.player.y,hatch.landing.y);
 assert.equal(t.solid(run.player.x,run.player.y,12),false,'landing is safely walkable');
 const alarmPosts=layout.guardPosts.filter(p=>p.alarmOnly);
 assert.equal(alarmPosts.length,2);
 for(const post of alarmPosts)assert.ok(
  run.enemies.some(e=>Math.hypot(e.homeX-post.x,e.homeY-post.y)<4),
  'alarm must spawn both guard types immediately for a hard return route');
 assert.equal(t.nearVaultHatch(),null,'the one-way hatch cannot be reused from outside');
 const saved=t.snapshotRun();assert.ok(t.validCheckpoint(saved));
 state.exploreRun=saved;t.resetRun();t.restoreRunIfNeeded();
 const restored=t.runRef();
 assert.equal(restored.vaultHatchUsed,true);
 assert.equal(restored.vaultAlarm,true);
 assert.equal(restored.vaultSealed,true);
 assert.equal(restored.hasKeycard,true);
 assert.equal(restored.paused,true);
 assert.equal(t.solid(layout.vaultGate.x,layout.vaultGate.y,12),true);
});

test('R5.56 previous V5 raids migrate moved caches without rerolling sealed contents',async()=>{
 const {t,layout,state}=await harness();t.startRun();
 const run=t.runRef(),original=t.snapshotRun();
 const moved=original.containers.find(c=>c.id==='tiled-loot-12');
 const sealed=JSON.stringify(moved.contents);
 moved.x=696*3;moved.y=120*3;moved.tier='high';
 for(const name of ['hasKeycard','vaultUnlocked','vaultEntered','vaultSealed','vaultHatchUsed','vaultAlarm'])delete original[name];
 state.exploreRun=original;
 t.resetRun();t.restoreRunIfNeeded();
 const newRun=t.runRef();
 assert.ok(newRun,'the previous checkpoint must not be erased');
 const updated=newRun.containers.find(c=>c.id==='tiled-loot-12');
 const authored=layout.authoredContainers.find(c=>c.id==='tiled-loot-12');
 assert.equal(updated.x,authored.x);
 assert.equal(updated.y,authored.y);
 assert.equal(updated.tier,'ultra');
 assert.equal(JSON.stringify(updated.contents),sealed,'all sealed item rolls remain untouched');
 assert.equal(newRun.hasKeycard,false,'a migrated player outside vault must find the card');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R5.56 the southeast ultra cache odds beat the accessible northwest high caches',async()=>{
 const {t,layout}=await harness();
 assert.deepEqual(Array.from(t.V5_SUPPLY_WEIGHTS.ultra),[20,45,100,280,350,170,35]);
 assert.equal(t.v5SsrPlusPercent('ultra'),55.5);
 assert.ok(t.v5SsrPlusPercent('ultra')>t.v5SsrPlusPercent('high'));
 let seed=20261029,rr=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const {t:roll,itemRarity}=await harness(rr);
 let n=0;for(let i=0;i<1200;i++){
  const reward=roll.containerReward('safe','jewelry','ultra',5);
  if(['SSR','UR','EX'].includes(itemRarity(reward.id)))n++;
 }
 assert.ok(n>580&&n<750,'ultra should yield SSR+ around 55%, observed '+n/12+'%');
 assert.equal(layout.authoredContainers.filter(o=>o.tier==='high'&&o.x<layout.w/2).length,2);
 assert.equal(layout.authoredContainers.filter(o=>o.tier==='ultra'&&o.x>layout.w*.65).length,2);
});

test('R5.57 hatch lockdown blocks physical shortcuts and survives checkpoint restore',async()=>{
 const {t,layout,state}=await harness();
 t.startRun();
 const run=t.runRef(),hatch=layout.vaultHatch,shutter=layout.escapeShutters[0];
 const blocked={x:shutter.x+shutter.w/2,y:shutter.y+shutter.h/2};
 assert.equal(t.solid(blocked.x,blocked.y,12),false,'before hatch, the facility is still freely explorable');
 run.enemies=[];run.spawnAt=999;
 run.hasKeycard=true;run.vaultUnlocked=true;run.vaultEntered=true;run.vaultSealed=true;
 run.player.x=hatch.x;run.player.y=hatch.y;
 assert.equal(t.useVaultInteraction(),true);
 assert.equal(run.vaultHatchUsed,true);
 assert.equal(t.solid(blocked.x,blocked.y,12),true,
  'using the hatch physically locks each shortcut, not only on the map image');
 assert.equal(t.solid(hatch.landing.x,hatch.landing.y,12),false);
 assert.equal(t.solid(layout.fixedExit.x,layout.fixedExit.y,12),false);
 assert.match(t.facilityPreviewPanel(),/<polyline/,'pre-raid preview shows the same escape corridor');
 const checkpoint=t.snapshotRun();
 assert.ok(t.validCheckpoint(checkpoint));
 state.exploreRun=checkpoint;t.resetRun();t.restoreRunIfNeeded();
 assert.equal(t.runRef().vaultHatchUsed,true);
 assert.equal(t.solid(blocked.x,blocked.y,12),true,'sealed bypass remains blocked after reload');
});

test('R5.58 random evacuation layout is fixed per raid and survives reload',async()=>{
 for(const [random,expected] of [[.1,'strict'],[.9,'cover']]){
  const {t,layout,state}=await harness(()=>random);
  t.startRun();const run=t.runRef();
  assert.equal(run.escapeVariant,expected);
  const original=t.snapshotRun();assert.ok(t.validCheckpoint(original));
  assert.equal(original.escapeVariant,expected);
  run.hasKeycard=true;run.vaultUnlocked=true;run.vaultEntered=true;run.vaultSealed=true;
  run.player.x=layout.vaultHatch.x;run.player.y=layout.vaultHatch.y;
  assert.equal(t.useVaultInteraction(),true);
  assert.equal(run.vaultAlarm,true);
  const niche=layout.escapeNiches[0];
  assert.equal(t.solid(niche.x,niche.y,1),expected==='strict',
   'strict hatch closes hiding alcoves, cover hatch opens them');
  const checkpoint=t.snapshotRun();state.exploreRun=checkpoint;
  t.resetRun();t.restoreRunIfNeeded();
  const resumed=t.runRef();
  assert.equal(resumed.escapeVariant,expected);
  assert.equal(resumed.vaultHatchUsed,true);
  assert.equal(t.solid(niche.x,niche.y,1),expected==='strict');
 }
});

test('R5.61 full detailed map opens in V5 exploration without the map item and matches pre-raid Tiled plan',async()=>{
 const {t,layout}=await harness();t.startRun();
 const run=t.runRef();
 assert.equal(t.hasDetailedMap(),true,'V5 full map must not require equipping a paid/loot map item');
 const preview=t.facilityPreviewPanel(),live=t.mapPanel();
 assert.match(live,/施設詳細地図/);
 assert.match(live,/map-zoom-in/);
 assert.match(live,/map-zoom-out/);
 assert.match(live,/exp-map-scroll/);
 assert.match(live,/現在地/);
 assert.match(preview,/出撃前の施設図/);
 assert.match(preview,/v5/);
 assert.ok(layout.mapBlueprint.floors.length>10);
 assert.ok(layout.mapBlueprint.walls.length>10);
 assert.ok(layout.mapBlueprint.fixtures.length>10);
 assert.ok(layout.mapBlueprint.dressing.length>10);
 const exampleWall=layout.mapBlueprint.walls[0];
 const rect='<rect x="'+exampleWall.x+'" y="'+exampleWall.y+'" width="'+exampleWall.w+'" height="'+exampleWall.h+'"';
 assert.ok(preview.includes(rect),'pre-raid blueprint displays real Tiled walls');
 assert.ok(live.includes(rect),'in-raid blueprint displays exactly those same walls');
 for(const name of ['薬局','警備室','最上位金庫'])
  assert.ok(preview.includes(name)&&live.includes(name),'room label '+name+' is shared');
 assert.match(preview,/<polyline/,'preview retains the authored hatch escape route');
 assert.match(live,/<polyline/,'in-raid map retains the authored hatch escape route');
 assert.match(live,/map-back/,'back closes map without abandoning raid');
 run.paused=true;run.showMap=true;
 assert.match(t.pausePanel(),/施設詳細地図/,'pause overlay presents the full blueprint');
 assert.equal(run.status,'playing');
});
test('R5.61 in-raid plan reflects actual loot/gate/key and STRICT or COVER hatch shutters',async()=>{
 for(const [random,variant] of [[.1,'strict'],[.9,'cover']]){
  const {t,layout}=await harness(()=>random);t.startRun();
  const run=t.runRef();assert.equal(run.escapeVariant,variant);
  const before=t.mapPanel();
  assert.match(before,/KEY/,'key must be available on the planning map');
  const loot=run.containers[0];assert.ok(before.includes('cx="'+loot.x+'" cy="'+loot.y+'"'));
  loot.opened=true;let changed=t.mapPanel();
  assert.match(changed,/×：開封済み/);
  assert.notEqual(changed,before,'opening a cache changes the map marker');
  run.hasKeycard=true;run.vaultUnlocked=true;
  changed=t.mapPanel();
  assert.doesNotMatch(changed,/>KEY</,'key marker is hidden after collecting it');
  run.vaultEntered=true;run.vaultSealed=true;
  run.player.x=layout.vaultHatch.x;run.player.y=layout.vaultHatch.y;
  assert.equal(t.useVaultInteraction(),true);
  const after=t.mapPanel();
  assert.match(after,/シャッター/);
  const sealed=(variant==='cover'?layout.escapeCoverShutters:layout.escapeShutters)[0];
  const blocked='<rect x="'+sealed.x+'" y="'+sealed.y+'" width="'+sealed.w+'" height="'+sealed.h+'" fill="#b84446"';
  assert.ok(after.includes(blocked),'selected variant draws physically closed shutters');
  assert.match(after,variant==='cover'?/広い一本道＋遮蔽物9個＋隠れ場所5か所/:/完全一本道/);
  assert.ok(after.includes('cx="'+run.player.x+'" cy="'+run.player.y+'"'),'live blue marker follows hatch landing');
  const snapshot=t.snapshotRun();assert.ok(t.validCheckpoint(snapshot));
 }
});

test('R5.62 pre-raid displays both real shutter masks, five walkable hide pockets and furniture covers',async()=>{
 const {t,layout}=await harness();t.startRun();
 const covers=layout.mapBlueprint.covers;
 assert.equal(covers.length,7);
 const pre=t.facilityPreviewPanel(),raid=t.mapPanel();
 for(const c of covers){
  const spec='<rect class="exp-map-physical-cover" x="'+c.x+'" y="'+c.y+'" width="'+c.w+'" height="'+c.h+'"';
  assert.ok(pre.includes(spec),'pre-raid map shows collider '+c.name);
  assert.ok(raid.includes(spec),'live map shows same collider '+c.name);
 }
 assert.match(pre,/preview-variant-strict/);
 assert.match(pre,/preview-variant-cover/);
 t.setPreviewVariant('strict');
 const strict=t.facilityPreviewPanel();
 assert.match(strict,/A：完全一本道/);
 for(const c of layout.escapeShutters.slice(0,4))
  assert.ok(strict.includes('<rect x="'+c.x+'" y="'+c.y+'" width="'+c.w+'" height="'+c.h+'" fill="#b84446"'));
 assert.doesNotMatch(strict,/exp-map-hiding-cover/,'strict has no hide cover bays');
 t.setPreviewVariant('cover');
 const hidden=t.facilityPreviewPanel();
 assert.match(hidden,/B：拡幅＋障害物/);
 assert.match(hidden,/exp-map-hiding-cover/);
 assert.equal(layout.escapeCoverLaneCells.length,24);
 assert.equal(layout.escapeLaneObjects.length,9);
 assert.match(hidden,/exp-map-wide-corridor/,'preview shows increased corridor width');
 assert.match(hidden,/exp-map-lane-obstacle/,'preview shows physical obstruction placements');
 assert.doesNotMatch(strict,/exp-map-lane-obstacle/,'A route retains no new obstacles');
 for(const c of layout.escapeCoverObjects){
  assert.ok(hidden.includes('<rect class="exp-map-hiding-cover" x="'+c.x+'" y="'+c.y+'" width="'+c.w+'" height="'+c.h+'"'),
   'hide-cover bin placement on schematic matches physical collider');
 }
 const run=t.runRef();
 // Enter through the real hatch so its save-state and sealed gate match
 // the lockdown map, instead of inventing an impossible checkpoint.
 run.escapeVariant='cover';run.hasKeycard=true;run.vaultUnlocked=true;
 run.vaultEntered=true;run.vaultSealed=true;
 run.player.x=layout.vaultHatch.x;run.player.y=layout.vaultHatch.y;
 assert.equal(t.useVaultInteraction(),true);
 const map=t.mapPanel();
 assert.match(map,/広い一本道＋遮蔽物9個＋隠れ場所5か所/);
 assert.match(map,/exp-map-hiding-cover/);
 assert.match(map,/exp-map-wide-corridor/,'live map shows true widened B geometry');
 assert.match(map,/exp-map-lane-obstacle/,'live map shows actual B collision furniture');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R5.64 V5 pursuers respect facing, detection range, and hard cover instead of seeing 360 degrees',async()=>{
 const {t,layout}=await harness();t.startRun();
 const run=t.runRef(),post=layout.guardPosts.find(p=>p.id==='tiled-guard-15');
 const guard=t.restoreEnemy({
  x:post.x,y:post.y,homeX:post.x,homeY:post.y,
  kind:'normal',hp:92,mode:'chase',facingX:0,facingY:1,attackAt:99
 });
 run.enemies=[guard];
 const player={x:post.x,y:post.y+96};
 assert.equal(layout.visionClear(guard,player),true,'sight setup uses open corridor');
 assert.equal(t.facilityCanSeePlayer(guard,player,t.enemyDefinition('normal'),true),true,
  'guard tracks a visible player in front');
 guard.facingX=0;guard.facingY=-1;
 assert.equal(t.facilityCanSeePlayer(guard,player,t.enemyDefinition('normal'),true),false,
  'a guard must not track a player behind itself');
 guard.facingY=1;
 const far={x:post.x,y:post.y+290};
 assert.equal(t.facilityCanSeePlayer(guard,far,t.enemyDefinition('normal'),true),false,
  'V5 guards cannot track at the old extreme lose radius');
 const blocked={x:598*3,y:229*3};
 assert.equal(layout.visionClear(guard,blocked),false);
 assert.equal(t.facilityCanSeePlayer(guard,blocked,t.enemyDefinition('normal'),true),false,
  'vision cannot penetrate the authored furniture or steel walls');
 const beam=t.facilityVisionContour(guard,t.enemyDefinition('normal'),performance.now());
 assert.equal(beam.length,13,'rendered tracking cone matches actual perception logic');
});

test('R5.64 lost contact leads to a bounded last-seen investigation, probes and return to patrol',async()=>{
 const {t,layout}=await harness();t.startRun();
 const run=t.runRef(),post=layout.guardPosts.find(p=>p.id==='tiled-guard-15');
 const guard=t.restoreEnemy({
  x:post.x,y:post.y,homeX:post.x,homeY:post.y,
  kind:'normal',hp:92,mode:'chase',facingX:0,facingY:1,attackAt:99,
  lastX:post.x,lastY:post.y+96,lastSeen:0
 });
 run.enemies=[guard];
 run.player.x=598*3;run.player.y=229*3;
 assert.equal(layout.visionClear(guard,run.player),false,'the player is fully occluded');
 t.updateEnemy(guard,4,.1);
 assert.equal(guard.mode,'search','guard transitions to searching only after contact is lost');
 assert.equal(guard.searchStep,0);
 assert.ok(guard.searchUntil>=10&&guard.searchUntil<=13,'search is long enough to investigate but capped');
 const originalLast={x:guard.lastX,y:guard.lastY};
 const checkpoint=t.snapshotRun();assert.ok(t.validCheckpoint(checkpoint));
 const snapEnemy=checkpoint.enemies[0];
 assert.equal(snapEnemy.searchStep,0);
 assert.equal(snapEnemy.lastX,originalLast.x);
 assert.equal(snapEnemy.searchUntil,guard.searchUntil);
 const restored=t.restoreEnemy(snapEnemy,5);
 assert.equal(restored.searchUntil,guard.searchUntil);
 assert.equal(restored.searchTargetX,guard.searchTargetX);
 assert.equal(restored.searchStep,0);
 guard.x=guard.lastX;guard.y=guard.lastY;
 t.updateV5Search(guard,4.1,.1,t.enemyDefinition('normal'));
 assert.equal(guard.searchStep,1,'guard reaches the actual last-observed point and scans');
 t.updateV5Search(guard,5.3,.1,t.enemyDefinition('normal'));
 assert.equal(guard.searchStep,2,'guard picks first cover-probe target');
 assert.ok(Number.isFinite(guard.searchTargetX)&&Number.isFinite(guard.searchTargetY));
 guard.x=guard.searchTargetX;guard.y=guard.searchTargetY;
 t.updateV5Search(guard,5.4,.1,t.enemyDefinition('normal'));
 assert.equal(guard.searchStep,3,'guard checks the other side of the cover');
 guard.x=guard.searchTargetX;guard.y=guard.searchTargetY;
 t.updateV5Search(guard,5.5,.1,t.enemyDefinition('normal'));
 assert.equal(guard.searchStep,4,'guard scans a final time before patrolling');
 t.updateV5Search(guard,guard.searchUntil+.1,.1,t.enemyDefinition('normal'));
 assert.equal(guard.mode,'patrol','finite search cannot pin a hidden player forever');
});

test('R5.64 older V5 search checkpoint without the new fields restores safely',async()=>{
 const {t,state}=await harness();t.startRun();
 const run=t.runRef();
 const guard=t.restoreEnemy({
  x:run.player.x+100,y:run.player.y,homeX:run.player.x+100,homeY:run.player.y,
  kind:'normal',hp:92,mode:'search',phaseUntil:20,lastSeen:3
 });
 const old={...guard};for(const name of ['searchStep','searchUntil','searchPhaseUntil','searchTargetX','searchTargetY','searchAxisX','searchAxisY'])delete old[name];
 run.enemies=[guard];
 const c=t.snapshotRun();
 c.enemies=[old];
 assert.ok(t.validCheckpoint(c));
 state.exploreRun=c;t.resetRun();t.restoreRunIfNeeded();
 const enemy=t.runRef().enemies[0];
 assert.ok(enemy);
 assert.equal(enemy.searchStep,0);
 assert.equal(enemy.searchUntil,20);
 assert.ok(Number.isFinite(enemy.searchTargetX)&&Number.isFinite(enemy.searchTargetY));
});

test('R5.75 immutable B-layout obstacle queries preserve 9 cover props and all escape gates',async()=>{
 const {t,layout}=await harness(()=>.9);t.startRun();
 const r=t.runRef();r.vaultHatchUsed=true;r.vaultSealed=true;r.vaultAlarm=true;
 assert.equal(layout.escapeLaneObjects.length,9);
 assert.equal(layout.escapeNiches.length,5);
 const before=JSON.stringify({lane:layout.escapeLaneObjects,niches:layout.escapeNiches,route:layout.escapeRoute});
 const pallet=layout.escapeLaneObjects.find(o=>o.kind==='pallet');
 const p={x:pallet.x+pallet.w/2,y:pallet.y+pallet.h/2};
 for(let i=0;i<300;i++){
  assert.equal(layout.escapeBarrierSolid(p.x,p.y,12,'cover'),true);
  assert.equal(layout.escapeBarrierSolid(p.x,p.y,12,'strict'),true,'A closes this B-only detour with a shutter');
  layout.visionClear(layout.escapeRoute[0],layout.escapeRoute.at(-1),true,'cover');
  layout.nearestEscapePoint({x:p.x+120,y:p.y+80},17,'cover');
 }
 assert.equal(JSON.stringify({lane:layout.escapeLaneObjects,niches:layout.escapeNiches,route:layout.escapeRoute}),before,'reuse must not mutate layout');
 const source=read('exploration-layout-v5.js');
 assert.match(source,/const escapeCoverBlockers=escapeCoverObjects\.concat\(escapeLaneObjects\)/);
 assert.match(source,/return escapeCoverBlockers\.some/);
});
test('R5.75 heavy sentries can find the real escape corridor in both lockdown variants',async()=>{
 for(const [random,variant] of [[.1,'strict'],[.9,'cover']]){
  const {t,layout}=await harness(()=>random);t.startRun();const r=t.runRef();
  r.enemies=[];r.pendingGuardPosts=[];r.vaultHatchUsed=true;r.vaultSealed=true;r.vaultAlarm=true;
  const start=layout.escapeRoute[0],end=layout.escapeRoute.at(-1);
  const e={x:start.x,y:start.y,homeX:start.x,homeY:start.y,facingX:1,facingY:0};
  const radius=t.enemyDefinition('heavy').radius;
  assert.equal(t.solid(e.x,e.y,radius),false);
  let best=Infinity;
  for(let i=0;i<1900;i++){
   t.enemyMoveTowards(e,end.x,end.y,100,.045,radius);
   assert.equal(t.solid(e.x,e.y,radius),false,'heavy must not cross a shut escape wall');
   best=Math.min(best,Math.hypot(e.x-end.x,e.y-end.y));
   if(best<30)break;
  }
  assert.ok(best<30,variant+' heavy sentry became stuck '+best.toFixed(0)+'px from extraction');
 }
});
test('R5.75 sight-breaking pallet lets patrol route around without moving through cover',async()=>{
 const {t,layout}=await harness(()=>.9);t.startRun();const r=t.runRef();
 r.enemies=[];r.pendingGuardPosts=[];r.vaultHatchUsed=true;r.vaultSealed=true;r.vaultAlarm=true;
 const y=(24+.5)*48,from={x:(38+.5)*48,y},target={x:(40+.5)*48,y};
 assert.equal(layout.visionClear(from,target,true,'cover'),false);
 for(const kind of ['normal','fast','heavy']){
  const radius=t.enemyDefinition(kind).radius;
  const e={x:from.x,y:from.y,homeX:from.x,homeY:from.y,facingX:1,facingY:0};
  let reached=false;
  for(let i=0;i<180;i++){
   t.enemyMoveTowards(e,target.x,target.y,125,.045,radius);
   assert.equal(t.solid(e.x,e.y,radius),false,'AI must not cut through pallet');
   if(Math.hypot(e.x-target.x,e.y-target.y)<28){reached=true;break}
  }
  assert.ok(reached,kind+' must route around the visual/physical pallet');
 }
});
test('R5.74 A/B return path is physically traversable by a full-radius sentry',async()=>{
 for(const [random,variant] of [[.1,'strict'],[.9,'cover']]){
  const {t,layout}=await harness(()=>random);t.startRun();
  const run=t.runRef();run.enemies=[];run.pendingGuardPosts=[];
  run.vaultHatchUsed=true;run.vaultAlarm=true;run.vaultSealed=true;
  assert.equal(run.escapeVariant,variant);
  const route=layout.escapeRoute;
  const start=route[0],end=route.at(-1);
  assert.equal(t.solid(start.x,start.y,12),false);
  assert.equal(t.solid(end.x,end.y,12),false);
  const e={x:start.x,y:start.y,homeX:start.x,homeY:start.y,facingX:1,facingY:0};
  let closest=Infinity;
  for(let step=0;step<2400;step++){
   t.enemyMoveTowards(e,end.x,end.y,125,.045,12);
   assert.equal(t.solid(e.x,e.y,12),false,'navigation must not phase through A/B shutters or physical obstacles');
   closest=Math.min(closest,Math.hypot(e.x-end.x,e.y-end.y));
   if(closest<30)break;
  }
  assert.ok(closest<30,variant+' guard must be able to walk hatch-to-exit, remaining '+closest.toFixed(0)+'px');
 }
});
test('R5.74 B-route hide pockets stay physically accessible from trunk',async()=>{
 const {t,layout}=await harness(()=>.9);t.startRun();const run=t.runRef();
 run.enemies=[];run.pendingGuardPosts=[];run.vaultHatchUsed=true;run.vaultAlarm=true;run.vaultSealed=true;
 for(const niche of layout.escapeNiches){
  assert.equal(t.solid(niche.x,niche.y,12),false,'niche center must hold a full-radius player');
  const trunk={x:niche.x+48,y:niche.y};
  assert.equal(t.solid(trunk.x,trunk.y,12),false,'all five alcoves must have an open trunk entrance');
  const e={x:trunk.x,y:trunk.y,homeX:trunk.x,homeY:trunk.y,facingX:-1,facingY:0};
  for(let step=0;step<40;step++)t.enemyMoveTowards(e,niche.x,niche.y,120,.045,12);
  assert.ok(Math.hypot(e.x-niche.x,e.y-niche.y)<18,'alcove '+niche.cell+' must be entered from the corridor');
  assert.equal(t.solid(e.x,e.y,12),false);
 }
});
test('R5.64 B-only alternating obstacles can genuinely hide the player from a pursuing sentry',async()=>{
 const {t,layout,state}=await harness(()=>.9);
 t.startRun();const run=t.runRef();
 assert.equal(run.escapeVariant,'cover');
 run.enemies=[];run.pendingGuardPosts=[];
 run.hasKeycard=true;run.vaultUnlocked=true;run.vaultEntered=true;run.vaultSealed=true;
 run.player.x=layout.vaultHatch.x;run.player.y=layout.vaultHatch.y;
 assert.equal(t.useVaultInteraction(),true);
 run.enemies=[];run.pendingGuardPosts=[];
 const y=(24+.5)*48;
 const from={x:(38+.5)*48,y},hidden={x:(40+.5)*48,y};
 const obstacle=layout.escapeLaneObjects.find(o=>o.cell===24*48+39);
 assert.ok(obstacle,'central passing lane has an authored pallet blocker');
 assert.equal(layout.solid(from.x,from.y,12),false);
 assert.equal(layout.solid(hidden.x,hidden.y,12),false);
 assert.equal(layout.escapeBarrierSolid(from.x,from.y,12,'cover'),false);
 assert.equal(layout.escapeBarrierSolid(hidden.x,hidden.y,12,'cover'),false);
 assert.equal(layout.visionClear(from,hidden,false),true,'base Tiled corridor does not block sight');
 assert.equal(layout.visionClear(from,hidden,true,'cover'),false,
  'the added B-only physical pallet completely obscures the direct ray');
 run.player.x=hidden.x;run.player.y=hidden.y;
 const guard=t.restoreEnemy({x:from.x,y:from.y,homeX:from.x,homeY:from.y,
  lastX:from.x,lastY:from.y,lastSeen:0,
  kind:'normal',hp:92,mode:'chase',facingX:1,facingY:0,attackAt:999});
 run.enemies=[guard];
 assert.equal(t.facilityCanSeePlayer(guard,run.player,t.enemyDefinition('normal'),true),false,
  'cover blocks the live enemy vision implementation');
 t.updateEnemy(guard,2.7,.1);
 assert.equal(guard.mode,'search','enemy switches to investigating instead of tracking through cover');
 assert.equal(t.stealthSituation().mode,'search','player HUD reports searching, not full detection');
 const c=t.snapshotRun();
 assert.ok(t.validCheckpoint(c),'new search state and B variant are safe to save');
 state.exploreRun=c;t.resetRun();t.restoreRunIfNeeded();
 const resumed=t.runRef();
 assert.equal(resumed.escapeVariant,'cover');
 assert.equal(resumed.enemies[0].mode,'search');
 assert.equal(resumed.enemies[0].searchUntil,guard.searchUntil);
 assert.equal(resumed.vaultHatchUsed,true);
});

test('R5.73 B-route pallet cover distinguishes lost sight from a still-active pursuit',async()=>{
 const {t,layout,state,dom}=await harness(()=>.9);t.startRun();
 const r=t.runRef();r.enemies=[];r.pendingGuardPosts=[];
 r.hasKeycard=true;r.vaultUnlocked=true;r.vaultEntered=true;r.vaultSealed=true;
 r.vaultHatchUsed=true;r.vaultAlarm=true;
 assert.equal(r.escapeVariant,'cover');
 const y=(24+.5)*48,from={x:(38+.5)*48,y},hidden={x:(40+.5)*48,y};
 assert.equal(layout.visionClear(from,hidden,true,'cover'),false);
 const guard=t.restoreEnemy({x:from.x,y:from.y,homeX:from.x,homeY:from.y,
  kind:'normal',hp:92,mode:'chase',lastX:from.x,lastY:from.y,lastSeen:0,
  facingX:1,facingY:0,attackAt:99});
 r.enemies=[guard];r.player.x=from.x;r.player.y=from.y;
 guard.lastSeen=(Date.now()-r.start)/1000;
 assert.equal(t.stealthSituation().mode,'chase','close optical contact is still dangerous');
 r.player.x=hidden.x;r.player.y=hidden.y;
 assert.equal(t.facilityCanSeePlayer(guard,r.player,t.enemyDefinition('normal'),true),false);
 const status=t.stealthSituation();
 assert.equal(status.mode,'evade');assert.equal(status.percent,0);
 assert.match(status.label,/視線切断・追跡残り/);
 const pill={dataset:{}},label={textContent:''};
 dom.set('exp-stealth-status',pill);dom.set('exp-stealth-label',label);
 t.updateHUD(true);assert.equal(pill.dataset.state,'evade');
 assert.match(label.textContent,/視線切断/);
 t.updateEnemy(guard,guard.lastSeen+2.5,.1);
 assert.equal(guard.mode,'search','guard examines last-seen cover instead of tracking hidden player');
 assert.equal(t.stealthSituation().mode,'search');
 const saved=t.snapshotRun();assert.ok(t.validCheckpoint(saved));
 state.exploreRun=saved;t.resetRun();t.restoreRunIfNeeded();
 assert.equal(t.runRef().enemies[0].mode,'search','search persists through checkpoint');
});
test('R5.74 nook optics warn before notice accrues but respect hard pallet cover',async()=>{
 const {t,layout,dom}=await harness(()=>.9);t.startRun();const r=t.runRef();
 r.enemies=[];r.pendingGuardPosts=[];
 r.hasKeycard=true;r.vaultUnlocked=true;r.vaultEntered=true;
 r.vaultHatchUsed=true;r.vaultSealed=true;r.vaultAlarm=true;
 assert.equal(r.escapeVariant,'cover');
 const niche=layout.escapeNiches[0];r.player.x=niche.x;r.player.y=niche.y;
 const e=t.restoreEnemy({x:niche.x+48,y:niche.y,homeX:niche.x+48,homeY:niche.y,
  kind:'normal',hp:92,mode:'patrol',facingX:-1,facingY:0,attackAt:99});
 r.enemies=[e];e.notice=0;
 assert.equal(t.facilityCanSeePlayer(e,r.player,t.enemyDefinition('normal')),true);
 let status=t.stealthSituation();
 assert.equal(status.mode,'notice','nook must not claim clear sight while an enemy directly looks inside');
 assert.match(status.label,/隠れ場所・視線内/);assert.ok(status.percent>=1);
 const pill={dataset:{}},label={textContent:''};dom.set('exp-stealth-status',pill);dom.set('exp-stealth-label',label);
 t.updateHUD(true);assert.equal(pill.dataset.state,'notice');assert.match(label.textContent,/視線内/);
 const y=(24+.5)*48;
 e.x=(38+.5)*48;e.y=y;e.facingX=1;e.facingY=0;
 r.player.x=(40+.5)*48;r.player.y=y;
 assert.equal(t.facilityCanSeePlayer(e,r.player,t.enemyDefinition('normal')),false);
 status=t.stealthSituation();assert.equal(status.mode,'hidden','real pallet LOS break has no false exposure');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('R5.73 genuine B-route hiding nook reports a location, not free invisibility',async()=>{
 const {t,layout}=await harness(()=>.9);t.startRun();const r=t.runRef();
 r.enemies=[];r.hasKeycard=true;r.vaultUnlocked=true;r.vaultEntered=true;
 r.vaultHatchUsed=true;r.vaultSealed=true;r.vaultAlarm=true;
 r.player.x=layout.escapeNiches[0].x;r.player.y=layout.escapeNiches[0].y;
 assert.equal(t.v5InHidingAlcove(),true);
 assert.equal(t.stealthSituation().mode,'hidden');
 assert.match(t.stealthSituation().label,/隠れ場所・敵の視線なし/);
 const enemy=t.restoreEnemy({x:r.player.x,y:r.player.y,homeX:r.player.x,homeY:r.player.y,
  kind:'normal',hp:92,mode:'chase',facingX:1,facingY:0,attackAt:99});
 r.enemies=[enemy];
 assert.equal(t.stealthSituation().mode,'chase','a guard in the nook overrides the hiding label');
 enemy.mode='search';enemy.searchUntil=(Date.now()-r.start)/1000+4;
 assert.equal(t.stealthSituation().mode,'notice','a guard physically inside the nook can still see the player');
 enemy.x+=400; // Outside the V5 sight range: real last-seen investigation.
 assert.equal(t.stealthSituation().mode,'search');
 assert.match(t.stealthSituation().label,/隠れ場所・残り/);
 assert.ok(t.validCheckpoint(t.snapshotRun()),'hiding UI adds no save fields');
});
test('R5.65 V5 warnings become readable without retuning V3/V4, loot or player speed',async()=>{
 const {t}=await harness();t.startRun();const run=t.runRef();
 const normal=t.enemyDefinition('normal'),fast=t.enemyDefinition('fast'),heavy=t.enemyDefinition('heavy');
 assert.equal(normal.windup,.76);assert.equal(fast.windup,.57);assert.equal(heavy.windup,1.28);
 assert.equal(normal.cooldown,1.80);assert.equal(fast.cooldown,1.90);assert.equal(heavy.cooldown,3.00);
 assert.ok(normal.windup>fast.windup,'fast guards remain faster than standard ones');
 assert.ok(fast.windup>=.55,'fast lethal hit is visible long enough to react on mobile');
 assert.equal(run.duration,300,'five-minute time limit unchanged');
 assert.equal(t.carrySpeedFactor([],run.stats.weightLimit),1,'empty bag has no extra movement penalty');
 assert.equal(t.facilityNoticeThreshold(),.48,'existing hide/detect response preserved');
 run.mapVersion=4;
 assert.equal(t.enemyDefinition('normal').windup,.58);
 assert.equal(t.enemyDefinition('fast').windup,.43);
 assert.equal(t.enemyDefinition('heavy').windup,1.12);
});

test('R5.65 chasing sentry does not initiate a melee telegraph while looking away',async()=>{
 const {t,layout}=await harness();t.startRun();const run=t.runRef();
 const post=layout.guardPosts.find(g=>g.id==='tiled-guard-15');
 const enemy=t.restoreEnemy({x:post.x,y:post.y,homeX:post.x,homeY:post.y,kind:'normal',
  hp:92,mode:'chase',facingX:0,facingY:-1,lastX:post.x,lastY:post.y+46,lastSeen:0,attackAt:0});
 run.enemies=[enemy];run.player.x=post.x;run.player.y=post.y+46;
 assert.equal(layout.visionClear(enemy,run.player),true,'open mandatory corridor');
 assert.equal(t.facilityCanSeePlayer(enemy,run.player,t.enemyDefinition('normal'),true),false,
  'behind the guard and outside the very close 40px alert radius');
 t.updateEnemy(enemy,1,.08);
 assert.notEqual(enemy.mode,'windup','mere unoccluded proximity does not trigger unfair blindside');
 enemy.facingX=0;enemy.facingY=1;
 t.updateEnemy(enemy,1.1,.08);
 assert.equal(enemy.mode,'windup','guard facing a visible player enters warning state');
 assert.equal(enemy.phaseUntil,1.1+.76,'V5 normal telegraph lasts the full visible interval');
});

test('R5.65 an accurately timed manual hit interrupts a normal windup with meaningful recovery',async()=>{
 const {t,layout}=await harness();t.startRun();const run=t.runRef();
 const post=layout.guardPosts.find(g=>g.id==='tiled-guard-15');
 run.player.x=post.x;run.player.y=post.y+34;run.facing={x:0,y:-1};
 const guard=t.restoreEnemy({x:post.x,y:post.y,homeX:post.x,homeY:post.y,
  kind:'normal',hp:92,mode:'windup',phaseUntil:1.76,attackAt:0,staggerResistUntil:0,
  facingX:0,facingY:1,aimX:0,aimY:1});
 run.enemies=[guard];run.attackAt=0;
 assert.ok(layout.visionClear(run.player,guard));
 assert.equal(t.performAttack(true,1),true,'manual strike works during a warning');
 assert.equal(guard.mode,'recover','player interrupts standard enemy strike');
 assert.equal(guard.phaseUntil,1.52,'V5 recovery is longer than previous .36s');
 assert.ok(guard.attackAt>=2.10,'attack interruption grants a larger reposition window');
 assert.ok(guard.hp>0&&guard.hp<92,'damage actually applied');
 assert.ok(t.validCheckpoint(t.snapshotRun()),'interrupted attack persists in saved raid');
});

test('R5.65 two attacking guards are dangerous, but a third cannot start a simultaneous windup',async()=>{
 const {t,layout}=await harness();t.startRun();const run=t.runRef();
 const post=layout.guardPosts.find(g=>g.id==='tiled-guard-15');
 run.player.x=post.x;run.player.y=post.y+30;
 run.enemies=[-8,0,8].map(dx=>t.restoreEnemy({
  x:post.x+dx,y:post.y,homeX:post.x+dx,homeY:post.y,
  kind:'normal',hp:92,mode:'chase',lastSeen:0,lastX:run.player.x,
  lastY:run.player.y,facingX:0,facingY:1,attackAt:0
 }));
 for(const e of run.enemies)t.updateEnemy(e,1,.04);
 assert.equal(run.enemies.filter(e=>e.mode==='windup').length,2,
  'only two telegraphs can be active; third enemy waits/positions');
 assert.ok(t.validCheckpoint(t.snapshotRun()),'multiple engaged guards checkpoint safely');
});

test('R5.65 a dodged melee warning avoids damage, while armor preserves the two-hit rule',async()=>{
 const {t,layout}=await harness();t.startRun();const run=t.runRef();
 const post=layout.guardPosts.find(g=>g.id==='tiled-guard-15');
 const enemy=t.restoreEnemy({x:post.x,y:post.y,homeX:post.x,homeY:post.y,
  kind:'normal',hp:92,mode:'windup',aimX:0,aimY:1});
 run.enemies=[enemy];run.player.x=post.x;run.player.y=post.y+34;
 const maxHp=run.stats.maxHp;assert.equal(maxHp,100);
 assert.equal(t.enemyHitPlayer(enemy,t.enemyDefinition('normal'),run.player),true,
  'unarmored raider dies to a clean hit as originally intended');
 assert.equal(run.status,'lost');
 const {t:t2,layout:l2}=await harness();t2.startRun();const r2=t2.runRef();
 const p=l2.guardPosts.find(g=>g.id==='tiled-guard-15');
 const e=t2.restoreEnemy({x:p.x,y:p.y,homeX:p.x,homeY:p.y,
  kind:'normal',hp:92,mode:'windup',aimX:0,aimY:1});
 r2.enemies=[e];r2.player.x=p.x;r2.player.y=p.y+34;
 r2.stats.defense=8;
 assert.equal(t2.enemyHitPlayer(e,t2.enemyDefinition('normal'),r2.player),true);
 assert.equal(r2.status,'playing','basic armor survives first strike');
 assert.ok(r2.player.hp>0&&r2.player.hp<r2.stats.maxHp);
 r2.player.invuln=0;
 assert.equal(t2.enemyHitPlayer(e,t2.enemyDefinition('normal'),r2.player),true);
 assert.equal(r2.status,'lost','second clean strike remains fatal');
});

test('R5.68 V5 knife pierces heavy without replacing existing equipment UIDs or save format',async()=>{
 const {t,layout,state}=await harness();
 const knife=Equipment.items.find(x=>x.name==='投げナイフ');
 state.inv=[{uid:71,id:knife.id,q:1,locked:false}];
 state.exploreEquip={weapon:71};
 t.startRun();const run=t.runRef(),post=layout.guardPosts.find(g=>g.id==='tiled-guard-15');
 run.player.x=post.x;run.player.y=post.y+34;run.facing={x:0,y:-1};
 const enemy=t.restoreEnemy({x:post.x,y:post.y,homeX:post.x,homeY:post.y,
  kind:'heavy',hp:175,mode:'patrol',attackAt:99});
 run.enemies=[enemy];run.attackAt=0;
 assert.ok(layout.visionClear(run.player,enemy));
 const profile=run.stats.weapons[0],base=Combat.hitDamage(profile.attack,profile.style,'heavy');
 assert.equal(profile.effect,'pierce');
 assert.equal(t.performAttack(true,1),true);
 assert.equal(enemy.hp,175-Combat.equipmentDamage(base,profile,'heavy',5));
 const saved=t.snapshotRun();
 assert.ok(t.validCheckpoint(saved),'pierce needs no new save fields');
 assert.equal(saved.stats.weapons[0].uid,71);
});
test('R5.66 V5 cargo risk is measurable and progressively slows heavy valuables without touching V4',async()=>{
 const {t}=await harness();t.startRun();const run=t.runRef();
 const item={id:'ITM-09000',q:0},rows=n=>Array.from({length:n},(_,i)=>({...item,tid:i+1}));
 const factors=[0,8,10,12,13,14,16,20].map(n=>t.carrySpeedFactor(rows(n),12));
 assert.deepEqual(factors.map(v=>Math.round(v*100)),[100,100,93,84,72,60,36,35]);
 for(let i=1;i<factors.length;i++)assert.ok(factors[i]<=factors[i-1],'more kg never increases V5 speed');
 run.loot=rows(16);run.lootSerial=17;
 const risk=t.v5CargoRisk();
 assert.equal(risk.weight,160);assert.equal(risk.limit,120);assert.equal(risk.over,40);
 assert.equal(risk.pct,36);assert.equal(risk.grade,'危険な重量超過');
 assert.match(risk.text,/4\.0kg超過/);
 assert.ok(t.validCheckpoint(t.snapshotRun()),'overweight loot uses unchanged checkpoint format');
 const restored=t.snapshotRun();
 assert.equal(restored.loot.length,16);
 run.mapVersion=4;
 assert.equal(t.carrySpeedFactor(rows(16),12),.76,'V4 is not affected by new V5 curve');
});

test('R5.71 hypothetical loot preview shows true post-pickup lower bound without mutation',async()=>{
 const {t,layout}=await harness();t.startRun();const run=t.runRef();
 const rows=n=>Array.from({length:n},(_,i)=>({id:'ITM-09000',q:0,tid:i+1}));
 run.loot=rows(8);run.lootSerial=9;run.enemies=[];
 run.player.x=layout.start.x;run.player.y=layout.start.y;
 const sealed=JSON.stringify(run.containers),original=JSON.stringify(run.loot);
 const before=t.v5ReturnRisk(),projected=t.v5ReturnRisk(rows(16));
 assert.ok(projected.straightSeconds>before.straightSeconds,
  'carrying 16kg requires strictly more straight-line travel time than 8kg');
 assert.equal(projected.cargo.pct,36);
 assert.equal(JSON.stringify(run.containers),sealed,'preview must not re-roll sealed contents');
 assert.equal(JSON.stringify(run.loot),original,'preview must never collect loot or change risk UIDs');
 assert.ok(t.validCheckpoint(t.snapshotRun()),'hypothetical preview adds no save fields');
});
test('R5.71 cache preview explains value per kg, return time and urgency',async()=>{
 const {t}=await harness();t.startRun();const run=t.runRef();
 const c=run.containers.find(row=>row.contents.length);
 run.enemies=[];run.player.x=c.x;run.player.y=c.y;
 run.loot=Array.from({length:10},(_,i)=>({id:'ITM-09000',q:0,tid:i+1}));
 run.lootSerial=11;
 const sealed=JSON.stringify(c.contents);
 run.start=Date.now()-(run.duration-28)*1000;
 t.openContainer();assert.equal(run.paused,true);
 const panel=t.pausePanel();
 assert.match(panel,/価値\/kg/);
 assert.match(panel,/帰還の直線下限 \d+秒以上/);
 assert.match(panel,/今より\+?\d+秒/);
 assert.match(panel,/data-risk="urgent"/);
 assert.match(panel,/帰還優先/);
 assert.match(panel,/障害物・扉・敵・迂回を含みません/);
 assert.equal(JSON.stringify(c.contents),sealed,'decision aid does not alter secured loot');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('R5.66 pickup choices disclose post-pickup speed, capacity and real cargo risk without reroll',async()=>{
 const {t}=await harness();t.startRun();const run=t.runRef();
 const c=run.containers.find(c=>c.contents.length);assert.ok(c);
 run.enemies=[];run.loot=[];run.player.x=c.x;run.player.y=c.y;
 const locked=JSON.stringify(c.contents);
 t.openContainer();assert.equal(run.paused,true);
 const panel=t.pausePanel();
 assert.match(panel,/現在の荷重：軽量・移動100%/);
 assert.match(panel,/回収後.*残容量/);
 assert.equal(JSON.stringify(c.contents),locked,'opening preview must never reroll sealed item contents');
 const chosen=c.contents[0];
 t.takeContainerItem({dataset:{container:c.id,i:'0'}});
 assert.equal(run.loot.length,1);assert.equal(run.loot[0].id,chosen.id);
 assert.ok(t.validCheckpoint(t.snapshotRun()),'pickup remains atomic and resumable');
});

test('R5.66 retreat indicator identifies minimum straight-line time, not a false routed ETA',async()=>{
 const {t,layout}=await harness();t.startRun();const run=t.runRef();
 run.enemies=[];run.player.x=layout.start.x;run.player.y=layout.start.y;
 const initial=t.v5ReturnRisk();
 assert.ok(initial.straightSeconds>0);
 assert.equal(initial.urgent,false,'full raid starts with breathing room');
 assert.match(initial.text,/出口まで直線最短\d+秒以上/);
 run.loot=Array.from({length:16},(_,i)=>({id:'ITM-09000',q:0,tid:i+1}));
 run.lootSerial=17;
 const heavy=t.v5ReturnRisk();
 assert.ok(heavy.straightSeconds>initial.straightSeconds,'same distance takes longer under heavy load');
 // The game timer is authoritative; this estimate must not extend it.
 run.start=Date.now()-(run.duration-28)*1000;
 const urgent=t.v5ReturnRisk();
 assert.equal(urgent.urgent,true);
 assert.match(urgent.text,/帰還を優先/);
 run.paused=true;run.pausedAt=Date.now();
 assert.match(t.pausePanel(),/直線最短は経路・戦闘を含まない下限/);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R5.66 protecting or dropping loot does not fabricate extra inventory value or undo sealed reward IDs',async()=>{
 const {t,gameWindow}=await harness();t.startRun();const run=t.runRef();
 run.loot=[
  {id:'ITM-09000',q:0,tid:1},
  {id:'ITM-00001',q:1,tid:2},
  {id:'ITM-00002',q:0,tid:3}
 ];run.lootSerial=4;run.safeIds=[2];
 const before=t.lootSummary(),value=t.lootBaseValue(run.loot[1]);
 assert.equal(before.secured,value);
 assert.equal(t.v5CargoRisk().weight,t.lootSummary().weight);
 gameWindow.explorationAction({dataset:{explore:'drop',i:'0'}});
 assert.equal(run.loot.length,2);
 assert.deepEqual(run.loot.map(x=>x.tid),[2,3],'surviving loot IDs are not reassigned');
 assert.equal(t.lootSummary().secured,value);
 assert.ok(t.v5CargoRisk().weight<before.weight,'drop actually reduces burden');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R5.67 alarm visual depends only on the existing saved hatch state, not a new timer or random flag',async()=>{
 const {t,state,layout}=await harness(()=>.9);
 t.startRun();const run=t.runRef();
 assert.deepEqual(t.v5AlarmVisual(0,false),{alarm:false,pulse:0});
 assert.deepEqual(t.v5AlarmVisual(0,true),{alarm:false,pulse:0});
 const before=t.snapshotRun();
 assert.equal(before.vaultAlarm,false);
 run.hasKeycard=true;run.vaultUnlocked=true;run.vaultEntered=true;run.vaultSealed=true;
 run.player.x=layout.vaultHatch.x;run.player.y=layout.vaultHatch.y;
 assert.equal(t.useVaultInteraction(),true,'real authored hatch enables actual security lockdown');
 assert.equal(run.vaultAlarm,true);
 const first=t.v5AlarmVisual(.2,false),later=t.v5AlarmVisual(1.6,false);
 assert.equal(first.alarm,true);assert.equal(later.alarm,true);
 assert.ok(first.pulse>=0&&first.pulse<=1&&later.pulse>=0&&later.pulse<=1);
 assert.notEqual(first.pulse,later.pulse,'active raid time determines modest breathing effect');
 assert.deepEqual(t.v5AlarmVisual(.2,true),{alarm:true,pulse:.5});
 assert.deepEqual(t.v5AlarmVisual(1.6,true),{alarm:true,pulse:.5},
  'reduced motion uses steady alarm, no flashing');
 const saved=t.snapshotRun();
 assert.ok(t.validCheckpoint(saved));
 assert.equal(saved.vaultAlarm,true);
 assert.equal(saved.alarmPulse,undefined,'visual-only state does not pollute checkpoints');
 state.exploreRun=saved;t.resetRun();t.restoreRunIfNeeded();
 assert.equal(t.runRef().vaultAlarm,true,'restored raid retains its real alarm state');
 assert.equal(t.v5AlarmVisual(.5,true).pulse,.5);
});

test('R5.67 camera passes alarm lighting only to V5 map before sight cones and entities',async()=>{
 const source=read('exploration.js'),layout=read('exploration-layout-v5.js'),css=read('exploration.css');
 assert.match(source,/mapFor\(5\)\.drawScene\(ctx,ox,oy,v5AlarmVisual\(\)\)/,
  'V5 receives its actual alarm lighting state');
 assert.match(layout,/model\.drawAmbience\(ctx,cam,SCALE,false,visual\)/,
  'single actual Tiled lighting layer reads the state');
 assert.ok(source.indexOf('drawFacilityVision(ox,oy,w,h);')>source.indexOf('drawVaultMarkers(ox,oy,w,h);'));
 assert.match(css,/#exp-vault-stage\[data-alarm="true"\]/,
  'alarm state remains legible in HUD as an additional nonblocking signal');
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)[^{]*\{[^}]*animation:none/,
  'alarm warning respects reduced motion');
});
