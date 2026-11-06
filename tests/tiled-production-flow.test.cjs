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
 const basementMap=JSON.parse(read('maps/basement/basement.tmj'));
 const tiles=JSON.parse(read('maps/indoor/tiles/warehouse.tsj'));
 const kenney=JSON.parse(read('maps/indoor/tiles/kenney-interior.tsj'));
 const industrial=JSON.parse(read('maps/indoor/tiles/warehouse-industrial.tsj'));
 const source=read('exploration-layout-v5.js');
 const V5Window={TreasureTiledMap:Tiled};
 class Image{
  constructor(){this.complete=true;this.naturalWidth=192}
  set src(url){this.url=url;queueMicrotask(()=>this.onload?.())}
 }
 new Function('window','fetch','Image',source)(
  V5Window,async p=>({ok:true,json:async()=>p.startsWith('maps/indoor/indoor.tmj')?map:p.startsWith('maps/basement/basement.tmj')?basementMap:p.includes('kenney-interior.tsj')?kenney:p.includes('warehouse-industrial.tsj')?industrial:tiles}),Image);
 const layout=await V5Window.TreasureIndoorLayoutV5.load();
 const basementLayout=await V5Window.TreasureIndoorLayoutV5.loadBasement();
 const state={inv:[],exploreArea:'mall',exploreEquip:{},exploreRun:null,bonusTickets:0};
 const dom=new Map();
 const documentEvents=new Map(),windowEvents=new Map();
 const document={body:{classList:{add(){},remove(){},toggle(){}},addEventListener:(name,handler)=>documentEvents.set('body:'+name,handler)},
  getElementById:id=>dom.get(id)||null,querySelector:selector=>dom.get(selector)||null,
  addEventListener:(name,handler)=>documentEvents.set(name,handler),hidden:false};
 const window={TreasureMallLayout:Mall,TreasureMallLayoutV3:MallV3,TreasureFacilityLayoutV4:MallV4,
  TreasureIndoorLayoutV5:{load:()=>Promise.resolve(layout),loadBasement:()=>Promise.resolve(basementLayout)},TreasureCombatRules:Combat,
  TreasureEquipmentPilot:Equipment,TreasureMapItem:MapItem,
  crypto:{randomUUID:()=>String(Math.random()).slice(2)},confirm:()=>true,
  addEventListener:(name,handler)=>windowEvents.set(name,handler)};
 let sourceGame=read('exploration.js');
 const end=sourceGame.lastIndexOf('})();');
 assert.ok(end>0);
 sourceGame=sourceGame.slice(0,end)+
  'window.__v5test={startRun,runRef:()=>run,v5BagLossPreview,v5BagLossNote,v5GearPanelHTML,v5RestrictedCachePressure,v5RoomSupplyLedger,v5RoomLedgerHTML,v5ApproachPlans,v5ApproachChoicesHTML,nearBasementKey,nearBasementDoor,enterBasement,useBasementInteraction,takeAllContainerItems,startV5Search,updateV5Search,v5SearchProbe,facilityVisionContour,resetRun:()=>{run=null},snapshotRun,restoreRunIfNeeded,validCheckpoint,openContainer,takeContainerItem,closeContainer,bank,lose,exitPoint,restoreEnemy,enemyDefinition,enemyPatrol,updateEnemy,enemyHitPlayer,performAttack,facilityCanSeePlayer,facilityVisionClear,stealthSituation,v5InHidingAlcove,updateHUD,contents,facilityNoticeReady,facilityNoticeThreshold,facilityPursuitSpeed,enemyMoveTowards,tick,advanceRaidFrame,V5_SUPPLY_WEIGHTS,v5SsrPlusPercent,v5CacheGrade,v5CacheReveal,containerReward,facilityPreviewPanel,setPreviewVariant:v=>facilityPreviewVariant=v,mapPanel,v5FacilityPlanSvg,hasDetailedMap,lootBaseValue,lootBaseTotal,lootSummary,lootOrder,lootRowsV5,lootSortControls,lootAutoProtectButton,weightLabel,carrySpeedFactor,v5CargoRisk,v5ReturnRisk,v5JettisonAdvice,v5JettisonAdviceHTML,v5ExtractionStakes,pausePanel,v5SessionDiagnosticReport,lastExploreReportHTML,weightTenths,solid,useVaultInteraction,sealVaultOnEntry,nearVaultKeycard,nearVaultGate,nearVaultHatch,reconcileIndoorCheckpoint,activateFacilityGuardPosts,v5AlarmVisual,bindStick,bindMultiTouchActions,syncV5Chrome,resizeField,viewSize:()=>({...VIEW}),remaining,togglePause,sampleFrame,perf,lastFrameRef:()=>lastFrame,setLastFrame:value=>{lastFrame=value}};'+sourceGame.slice(end);
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
 return {t:window.__v5test,layout,basementLayout,state,received,dom,document,documentEvents,windowEvents,
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
 assert.match(report,/R6.12/);
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
 assert.ok(read('index.html').includes('exploration.js?v=R6.21'));
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
 assert.equal(listeners.size,4,'touchstart/end/cancel and click listeners registered once for action buttons');
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
 assert.match(html,/exploration\.css\?v=R6\.21/);
 assert.match(html,/exploration\.js\?v=R6\.21/);
 assert.match(html,/exploration-layout-v5\.js\?v=R6\.18/);
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
 assert.match(html,/商業施設 1F/);
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
 const groundSvg=t.v5FacilityPlanSvg(layout,null);
 assert.equal(layout.authoredContainers.length,11);
 assert.equal(layout.authoredContainers.filter(c=>c.tier==='standard').length,3);
 assert.equal(layout.authoredContainers.filter(c=>c.tier==='mid').length,4);
 assert.equal(layout.authoredContainers.filter(c=>c.tier==='high').length,2);
 assert.equal(layout.authoredContainers.filter(c=>c.tier==='ultra').length,2);
 for(const [color,count] of [['#e6c66b',3],['#6bb9e5',4],['#ba8bf5',2],['#ff856e',2]]){
  assert.equal(groundSvg.split('fill="'+color+'"').length-1,count,'ground supply markers '+color);
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
 const ordinaryDrop={dataset:{explore:'drop',i:'0'}};
 gameWindow.explorationAction(ordinaryDrop);
 assert.equal(run.loot.length,2,'first tap must not discard ordinary items');
 gameWindow.explorationAction(ordinaryDrop);
 assert.equal(run.loot.length,1,'second timely tap discards ordinary loot');
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
 const ordinaryDrop={dataset:{explore:'drop',i:'0'}};
 gameWindow.explorationAction(ordinaryDrop);
 assert.equal(run.loot.length,3,'confirmation prompt has no inventory effect');
 gameWindow.explorationAction(ordinaryDrop);
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
 assert.ok(layout.includes('model.drawAmbience(ctx,cam,SCALE,false,{...visual,hideZoneBanners:true});'),
  'single actual Tiled lighting layer reads the state');
 assert.ok(source.indexOf('drawFacilityVision(ox,oy,w,h);')>source.indexOf('drawVaultMarkers(ox,oy,w,h);'));
 assert.match(css,/#exp-vault-stage\[data-alarm="true"\]/,
  'alarm state remains legible in HUD as an additional nonblocking signal');
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)[^{]*\{[^}]*animation:none/,
  'alarm warning respects reduced motion');
});


test('R6.00 V5 confirmed detection alerts only the nearest visible idle ally to search',async()=>{
 const {t,layout}=await harness();t.startRun();
 const run=t.runRef(),post=layout.guardPosts.find(p=>p.id==='tiled-guard-15');
 const make=(dy,facingY=1)=>t.restoreEnemy({
  x:post.x,y:post.y+dy,homeX:post.x,y:post.y+dy,
  kind:'normal',hp:t.enemyDefinition('normal').hp,mode:'patrol',
  facingX:0,facingY,patrolUntil:100,attackAt:99
 });
 const spotter=make(0,1),first=make(32,-1),second=make(64,-1);
 const target={x:post.x,y:post.y+96};
 for(const e of [spotter,first,second]){
  assert.equal(layout.solid(e.x,e.y,12),false,'guard is on real passable floor');
 }
 assert.equal(layout.visionClear(spotter,target),true,'spotter has optical contact');
 assert.equal(layout.visionClear(spotter,first),true,'ally is in the same open corridor');
 run.enemies=[spotter,first,second];
 run.player.x=target.x;run.player.y=target.y;
 // Recognition still needs the ORIGINAL 0.48s of sustained visual contact.
 for(let i=0;i<4;i++)t.updateEnemy(spotter,1+i*.1,.1);
 assert.equal(spotter.mode,'patrol','a brief glimpse cannot activate backup');
 assert.equal(first.mode,'patrol','no relay before confirmed sighting');
 t.updateEnemy(spotter,1.4,.1);
 assert.equal(spotter.mode,'alert','confirmed spotting has the original state transition');
 assert.equal(first.mode,'search','nearest ally investigates instead of magically chasing');
 assert.equal(second.mode,'patrol','one detection does not mobilize a whole squad');
 assert.equal(first.searchStep,0);
 assert.equal(first.lastX,target.x);assert.equal(first.lastY,target.y);
 assert.ok(first.searchUntil>1.4&&first.searchUntil<=10.4,'search has a finite deadline');
 assert.ok(t.validCheckpoint(t.snapshotRun()),'existing checkpoint contract is unchanged');
 // Sharing cannot happen again for the same already-alerted spotter.
 t.updateEnemy(spotter,1.5,.1);
 assert.equal(second.mode,'patrol');
});

test('R6.00 V5 guards cannot relay sightings through walls or beyond the local range',async()=>{
 const {t,layout}=await harness();t.startRun();
 const run=t.runRef(),post=layout.guardPosts.find(p=>p.id==='tiled-guard-15');
 const make=(point)=>t.restoreEnemy({
  ...point,homeX:point.x,homeY:point.y,
  kind:'normal',hp:t.enemyDefinition('normal').hp,
  mode:'patrol',facingX:0,facingY:1,patrolUntil:100,attackAt:99
 });
 const spotter=make({x:post.x,y:post.y});
 const player={x:post.x,y:post.y+96};
 assert.equal(layout.visionClear(spotter,player),true);
 let blocked=null;
 for(let dy=-168;dy<=168&&!blocked;dy+=12)for(let dx=-168;dx<=168;dx+=12){
  const point={x:post.x+dx,y:post.y+dy};
  const d=Math.hypot(dx,dy);
  if(d<38||d>180||layout.solid(point.x,point.y,12))continue;
  if(!layout.visionClear(spotter,point)){blocked=point;break}
 }
 assert.ok(blocked,'real Tiled facility has a nearby walkable area behind a wall');
 const hiddenAlly=make(blocked);
 const distantAlly=make({x:post.x,y:post.y+228});
 assert.ok(!layout.solid(distantAlly.x,distantAlly.y,12),'distant ally stands in an actual hallway');
 assert.equal(layout.visionClear(spotter,distantAlly),true);
 run.enemies=[spotter,hiddenAlly,distantAlly];
 run.player.x=player.x;run.player.y=player.y;
 for(let i=0;i<5;i++)t.updateEnemy(spotter,1+i*.1,.1);
 assert.equal(spotter.mode,'alert');
 assert.equal(hiddenAlly.mode,'patrol','wall prevents transmitting the sighting');
 assert.equal(distantAlly.mode,'patrol','local support cannot turn into map-wide alarm');
});

test('R6.01 V5 manual misses show feedback without inventing hits, loot or save fields',async()=>{
 const {t}=await harness();t.startRun();
 const r=t.runRef(),before=t.snapshotRun();
 r.enemies=[];r.attackAt=0;r.damageTexts=[];r.facing={x:1,y:0};
 assert.equal(t.performAttack(true,1),true,'manual attack is valid even if no target is present');
 assert.equal(r.lastAttackHits,0);
 assert.equal(r.damageTexts.length,1);
 assert.equal(r.damageTexts[0].miss,true);
 assert.equal(r.damageTexts[0].color,'#c4c9be');
 assert.equal(r.attackAt,1+Combat.styleFor('unarmed').cooldown,'miss still consumes cooldown');
 assert.equal(r.attackCycle,Combat.styleFor('unarmed').cooldown);
 const saved=t.snapshotRun();
 assert.ok(t.validCheckpoint(saved));
 assert.equal(saved.loot.length,before.loot.length);
 assert.equal(saved.kills,before.kills);
 assert.equal('damageTexts' in saved,false,'transient hit feedback never becomes save data');
 assert.equal('attackCycle' in saved,false,'readiness indicator does not alter checkpoints');
 r.mapVersion=4;r.attackAt=0;r.damageTexts=[];
 assert.equal(t.performAttack(true,2),true);
 assert.equal(r.damageTexts.length,0,'V4 has no new miss text');
});

test('R6.01 V5 weapon families show real status, advantage and defeat without changing combat formula',async()=>{
 const {t,layout}=await harness();t.startRun();
 const r=t.runRef(),post=layout.guardPosts.find(g=>g.id==='tiled-guard-15');
 r.player.x=post.x;r.player.y=post.y+40;r.facing={x:0,y:-1};
 const make=(kind,hp)=>t.restoreEnemy({
  x:post.x,y:post.y,homeX:post.x,homeY:post.y,
  kind,hp,mode:'patrol',attackAt:99
 });
 assert.equal(layout.visionClear({x:r.player.x,y:r.player.y},{x:post.x,y:post.y}),true);
 r.stats.weapons[0]={uid:0,name:'チェーン',style:'whip',attack:20};
 const normal=make('normal',92);r.enemies=[normal];r.attackAt=0;
 assert.equal(t.performAttack(true,1),true);
 const expected=Combat.hitDamage(20,'whip','normal');
 assert.equal(normal.hp,92-expected,'damage matches the established weapon calculation');
 assert.equal(r.damageTexts.at(-1).value,expected);
 assert.equal(r.damageTexts.at(-1).impactStyle,'whip');
 assert.equal(r.damageTexts.at(-1).statusText,'鈍足','the true applied status is shown');
 assert.equal(r.damageTexts.at(-1).finisher,false);
 assert.ok(normal.slowUntil>1,'the visual label describes a real gameplay effect');
 r.stats.weapons[0]={uid:0,name:'釘バット',style:'strike',attack:20};
 const heavy=make('heavy',175);r.enemies=[heavy];r.attackAt=0;
 assert.equal(t.performAttack(true,2),true);
 assert.equal(heavy.hp,175-Combat.hitDamage(20,'strike','heavy'));
 assert.equal(r.damageTexts.at(-1).advantage,true,'heavy affinity uses actual damage advantage');
 assert.equal(r.damageTexts.at(-1).impactStyle,'strike');
 const doomed=make('normal',8);r.enemies=[doomed];r.attackAt=0;
 const kills=r.kills;
 assert.equal(t.performAttack(true,3),true);
 assert.equal(r.damageTexts.at(-1).finisher,true);
 assert.equal(r.kills,kills+1);
 assert.equal(r.enemies.length,0);
 assert.ok(t.validCheckpoint(t.snapshotRun()),'all combat changes fit existing save format');
});

test('R6.01 V5 attack button shows weapon identity and real cooldown while remaining tappable',async()=>{
 const {t,dom}=await harness();t.startRun();const r=t.runRef();
 const attack={dataset:{},style:{setProperty(name,value){this[name]=value}},
  setAttribute(name,value){this[name]=value},title:''};
 dom.set('exp-attack',attack);
 r.stats.weapons[0]={uid:0,name:'竹刀',style:'rapid',attack:15};
 r.attackAt=2;r.attackCycle=.30;r.manualAttack=true;
 t.updateHUD(true);
 assert.equal(attack.dataset.weaponStyle,'rapid');
 assert.equal(attack.dataset.recharging,'true');
 assert.equal(attack.dataset.queued,'true','the pending manual strike is shown');
 assert.equal(attack.style['--exp-attack-charge'],'0%');
 assert.match(attack.title,/射程49px・1体・間隔0\.30秒/);
 r.attackAt=0;r.manualAttack=false;
 t.updateHUD(true);
 assert.equal(attack.dataset.recharging,'false');
 assert.equal(attack.dataset.queued,'false');
 assert.equal(attack.style['--exp-attack-charge'],'100%');
 const css=read('exploration.css');
 assert.match(css,/R6\.01 V5 weapon feedback/);
 assert.match(css,/\.exp-v5-bottomdock \.exp-action-grid #exp-attack::after/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.ok(!css.includes('#exp-attack:disabled{'),'the feedback does not disable queued attacks');
 assert.ok(read('index.html').includes('exploration.js?v=R6.21'));
 assert.ok(read('index.html').includes('exploration.css?v=R6.21'));
});

test('R6.02 authored room ledger exposes only grade/location, stays read-only, and updates after pickup',async()=>{
 const {t,layout}=await harness(()=>.99);t.startRun();
 const run=t.runRef();run.enemies=[];
 const before=JSON.stringify(run.containers),rows=t.v5RoomSupplyLedger(layout);
 assert.equal(rows.length,layout.themeZones.length,'all nine authored zones are represented');
 assert.equal(rows.length,9);
 assert.equal(rows.reduce((n,v)=>n+v.unopened,0),11,'all eleven caches start unsearched');
 assert.equal(rows.find(v=>v.name==='北西書庫').tierCounts.high,2);
 assert.equal(rows.find(v=>v.name==='最上位金庫').tierCounts.ultra,2);
 assert.equal(rows.find(v=>v.name==='脱出検問').unopened,0);
 const info=t.v5RoomLedgerHTML(layout);
 assert.match(info,/区画別の探索台帳/);
 assert.match(info,/未調査 11か所/);
 assert.match(info,/未開封の中身やレア確定数は分かりません/);
 assert.doesNotMatch(info,/ITM-\d{5}/,'ledger does not leak sealed item IDs');
 assert.equal(JSON.stringify(run.containers),before,'scouting cannot change the sealed inventory');
 assert.match(t.mapPanel(),/exp-v5-room-ledger/,'actual in-raid detailed map carries the ledger');
 const cache=run.containers.find(c=>c.contents.length>=2);
 assert.ok(cache,'authored map has a multi-item cache');
 const room=layout.themeAt(cache),previous=t.v5RoomSupplyLedger(layout).find(v=>v.name===room);
 run.player.x=cache.x;run.player.y=cache.y;
 t.openContainer();assert.equal(run.paused,true);
 assert.match(t.pausePanel(),/この区画：未調査/,'the cache dialog shows area progress');
 t.takeContainerItem({dataset:{container:cache.id,i:'0'}});
 const next=t.v5RoomSupplyLedger(layout).find(v=>v.name===room);
 assert.equal(next.unopened,previous.unopened-1);
 assert.equal(next.openedWithLoot,previous.openedWithLoot+1);
 assert.equal(next.tierCounts[layout.supplyTierForContainer(cache)],
  previous.tierCounts[layout.supplyTierForContainer(cache)]-1);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.02 batch pickup previews burden, preserves all sealed outcomes and cannot collect twice',async()=>{
 const {t,layout,state}=await harness(()=>.99);t.startRun();
 const run=t.runRef();run.enemies=[];
 const cache=run.containers.find(c=>c.contents.length>=2);
 assert.ok(cache);run.player.x=cache.x;run.player.y=cache.y;
 const beforeRewards=cache.contents.map(v=>({...v}));
 const count=beforeRewards.length,oldSerial=run.lootSerial,oldLoot=run.loot.length;
 const allSealed=JSON.stringify(run.containers);
 t.openContainer();assert.equal(run.paused,true);
 const modal=t.pausePanel();
 assert.match(modal,/data-explore="loot-take-all"/);
 assert.match(modal,/まとめて取る/);
 assert.match(modal,/出口まで直線下限/);
 assert.match(modal,/移動速度/);
 assert.equal(JSON.stringify(run.containers),allSealed,'preview cannot reroll sealed rewards');
 t.takeAllContainerItems({dataset:{container:cache.id}});
 assert.equal(cache.contents.length,0);
 assert.equal(cache.opened,true);
 assert.deepEqual(run.loot.slice(oldLoot).map(v=>({id:v.id,q:v.q})),beforeRewards.map(v=>({id:v.id,q:v.q})));
 assert.deepEqual(run.loot.slice(oldLoot).map(v=>v.tid),Array.from({length:count},(_,i)=>oldSerial+i));
 assert.equal(run.lootSerial,oldSerial+count);
 assert.equal(run.paused,true,'the cache dialog stays paused until the user closes it');
 assert.equal(run.safeIds.length,0,'bulk collection does not silently protect items');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 t.takeAllContainerItems({dataset:{container:cache.id}});
 assert.equal(run.loot.length,oldLoot+count,'repeat taps cannot duplicate rewards');
 t.closeContainer();
 const saved=t.snapshotRun();assert.ok(t.validCheckpoint(saved));
 state.exploreRun=saved;t.resetRun();t.restoreRunIfNeeded();
 const restored=t.runRef();
 assert.deepEqual(restored.loot.map(v=>({id:v.id,q:v.q,tid:v.tid})),
  run.loot.map(v=>({id:v.id,q:v.q,tid:v.tid})), 'reload preserves the exact set of collected items');
 assert.equal(restored.containers.find(v=>v.id===cache.id).contents.length,0);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.02 take-all ignores wrong cache, unpaused state and legacy maps',async()=>{
 const {t}=await harness(()=>.99);t.startRun();
 const run=t.runRef();run.enemies=[];
 const cache=run.containers.find(c=>c.contents.length>=2);
 assert.ok(cache);run.player.x=cache.x;run.player.y=cache.y;
 const before=JSON.stringify(run.containers),lootBefore=JSON.stringify(run.loot);
 t.takeAllContainerItems({dataset:{container:cache.id}});
 assert.equal(JSON.stringify(run.containers),before,'cannot loot without opening the box');
 t.openContainer();assert.equal(run.paused,true);
 t.takeAllContainerItems({dataset:{container:'wrong-cache'}});
 assert.equal(JSON.stringify(run.containers),before,'cannot loot an unrelated box');
 run.mapVersion=4;
 t.takeAllContainerItems({dataset:{container:cache.id}});
 assert.equal(JSON.stringify(run.containers),before,'V4 cannot use the V5 batch action');
 assert.equal(JSON.stringify(run.loot),lootBefore);
 run.mapVersion=5;
 const css=read('exploration.css'),html=read('index.html');
 assert.match(css,/exp-v5-room-ledger-list/);
 assert.match(css,/exp-container-batch button/);
 assert.match(html,/exploration\.js\?v=R6\.21/);
 assert.match(html,/exploration\.css\?v=R6\.21/);
 assert.match(read('exploration.js'),/if\(type==='loot-take-all'\)/,'the real UI action is routed');
});

test('R6.02 room ledger reads only authored grades, never the sealed reward identity',async()=>{
 const {t,layout}=await harness(()=>.99);t.startRun();
 const r=t.runRef(),before=JSON.stringify(r.containers);
 const ledger=t.v5RoomSupplyLedger();
 assert.equal(ledger.length,9,'all nine Tiled themes are represented, even with no loot');
 assert.equal(ledger.reduce((sum,zone)=>sum+zone.unopened,0),11,'11 authored unopened caches');
 const archive=ledger.find(row=>row.name==='北西書庫');
 const vault=ledger.find(row=>row.name==='最上位金庫');
 const checkpoint=ledger.find(row=>row.name==='脱出検問');
 assert.equal(archive.unopened,2);
 assert.equal(archive.tierCounts.high,2);
 assert.equal(vault.unopened,2);
 assert.equal(vault.tierCounts.ultra,2);
 assert.equal(checkpoint.unopened,0,'empty extraction checkpoint remains shown');
 assert.ok(!JSON.stringify(ledger).includes('ITM-'));
 assert.ok(!t.v5RoomLedgerHTML(layout).includes('古代の剣'));
 assert.equal(JSON.stringify(r.containers),before,'scouting is read-only');
 const map=t.mapPanel();
 assert.match(map,/区画別の探索台帳/);
 assert.match(map,/未調査 11か所/);
 assert.match(map,/紫 2/);
 assert.match(map,/赤金 2/);
 const originalContents=r.containers[0].contents;
 r.containers[0].contents=[{id:'ITM-00001',q:0}];
 assert.deepEqual(t.v5RoomSupplyLedger(),ledger,'grade ledger cannot reveal sealed identity');
 r.containers[0].contents=originalContents;
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.02 one-tap collection uses sealed cache exactly once, then resumes without duplicate loot',async()=>{
 const {t,layout,state}=await harness(()=>.99);t.startRun();
 const r=t.runRef();r.enemies=[];
 const c=r.containers.find(v=>v.contents.length>=2);
 assert.ok(c,'a real authored cache has multiple sealed items');
 const contents=JSON.parse(JSON.stringify(c.contents));
 const initialSerial=r.lootSerial;
 const initialCount=r.loot.length;
 r.player.x=c.x;r.player.y=c.y;
 t.openContainer();
 assert.equal(r.paused,true);
 const popup=t.pausePanel();
 assert.match(popup,/data-explore="loot-take-all"/);
 assert.match(popup,/回収後/);
 assert.match(popup,/出口まで直線下限/);
 assert.match(popup,/詳細地図の探索台帳/);
 assert.deepEqual(c.contents,contents,'opening still does not reroll any rewards');
 t.takeAllContainerItems({dataset:{container:c.id}});
 assert.equal(c.contents.length,0,'all remaining sealed contents removed together');
 assert.equal(c.opened,true);
 assert.equal(r.loot.length,initialCount+contents.length);
 assert.equal(r.lootSerial,initialSerial+contents.length);
 assert.deepEqual(r.loot.slice(initialCount).map(({id,q})=>({id,q})),contents.map(({id,q})=>({id,q})));
 assert.deepEqual(r.loot.slice(initialCount).map(v=>v.tid),contents.map((_,i)=>initialSerial+i));
 assert.ok(t.validCheckpoint(t.snapshotRun()),'batch pickup preserves existing checkpoint schema');
 const after=JSON.stringify({loot:r.loot,containers:r.containers,serial:r.lootSerial});
 t.takeAllContainerItems({dataset:{container:c.id}});
 t.takeAllContainerItems({dataset:{container:'wrong-id'}});
 assert.equal(JSON.stringify({loot:r.loot,containers:r.containers,serial:r.lootSerial}),after,
  'double tap and forged ID never duplicate a reward');
 const ledger=t.v5RoomSupplyLedger();
 assert.ok(ledger.some(zone=>zone.cleared>=1));
 const saved=t.snapshotRun();
 assert.ok(saved.containers.some(v=>v.id===c.id&&v.opened&&!v.contents.length));
 state.exploreRun=saved;t.resetRun();t.restoreRunIfNeeded();
 const restored=t.runRef();
 assert.deepEqual(restored.loot,r.loot,'all reward IDs and tokens survive resume');
 assert.deepEqual(restored.containers.find(v=>v.id===c.id).contents,[]);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.ok(t.v5RoomSupplyLedger().some(zone=>zone.cleared>=1));
 assert.equal(t.v5RoomSupplyLedger().reduce((n,v)=>n+v.unopened+v.openedWithLoot+v.cleared,0),11);
});

test('R6.02 partially looted cache retains correct room progress and shows only remaining items',async()=>{
 const {t,layout}=await harness(()=>.99);t.startRun();
 const r=t.runRef();r.enemies=[];
 const c=r.containers.find(v=>v.contents.length>=2);
 assert.ok(c);
 r.player.x=c.x;r.player.y=c.y;
 const before=JSON.stringify(r.containers);
 t.openContainer();assert.equal(r.paused,true);
 const pick=c.contents[0],oldCount=c.contents.length;
 t.takeContainerItem({dataset:{container:c.id,i:'0'}});
 assert.equal(c.contents.length,oldCount-1);
 assert.ok(c.opened);
 const room=t.v5RoomSupplyLedger().find(v=>v.name===layout.themeAt(c));
 assert.equal(room.openedWithLoot,1);
 const html=t.pausePanel();
 assert.match(html,/開封済・回収途中 1か所/);
 if(oldCount>=3)assert.match(html,/まとめて取る/);
 else assert.doesNotMatch(html,/data-explore="loot-take-all"/,'single remaining item uses ordinary pickup');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.notEqual(JSON.stringify(r.containers),before);
 assert.ok(r.loot.some(v=>v.id===pick.id&&v.q===pick.q));
});

test('R6.02 bulk pickup remains V5-only and honors pause, capacity and token guards',async()=>{
 const {t}=await harness(()=>.99);t.startRun();
 const r=t.runRef();r.enemies=[];
 const c=r.containers.find(v=>v.contents.length>=2);
 assert.ok(c);const button={dataset:{container:c.id}};
 const before=JSON.stringify(r.containers);
 t.takeAllContainerItems(button);
 assert.equal(JSON.stringify(r.containers),before,'unpaused button cannot claim');
 r.player.x=c.x;r.player.y=c.y;t.openContainer();
 assert.equal(r.paused,true);
 r.lootSerial=1000;
 const saved=JSON.stringify(r.containers);
 t.takeAllContainerItems(button);
 assert.equal(JSON.stringify(r.containers),saved,'token overflow leaves cache intact');
 r.lootSerial=1;
 r.mapVersion=4;
 t.takeAllContainerItems(button);
 assert.equal(JSON.stringify(r.containers),saved,'V4 cannot trigger new V5 behavior');
 r.mapVersion=5;
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.03 restricted-cache pressure starts only AFTER a confirmed high-grade pickup, and restores from existing checkpoint',async()=>{
 const {t,layout,state}=await harness(()=>.9);t.startRun();
 const r=t.runRef();r.enemies=[];
 const initial=t.v5RestrictedCachePressure();
 assert.deepEqual(initial,{tier:'none',extraRange:0,label:''},'unopened high caches must not increase threat');
 const high=r.containers.find(c=>layout.supplyTierForContainer(c)==='high'&&c.contents.length);
 assert.ok(high);
 r.player.x=high.x;r.player.y=high.y;
 const sealed=JSON.stringify(high.contents);
 t.openContainer();assert.equal(r.paused,true);
 const popup=t.pausePanel();
 assert.match(popup,/制限区画：物資を回収すると/,'player is warned before any pickup');
 assert.match(popup,/敵の総数上限・攻撃力は変わりません/);
 assert.equal(JSON.stringify(high.contents),sealed,'warning does not reseal or reroll contents');
 assert.deepEqual(t.v5RestrictedCachePressure(),initial,'opening a dialog is not a pickup');
 t.takeContainerItem({dataset:{container:high.id,i:'0'}});
 assert.equal(t.v5RestrictedCachePressure().tier,'high');
 assert.equal(t.v5RestrictedCachePressure().extraRange,90);
 assert.match(t.v5ReturnRisk().text,/紫物資回収・巡回警備強化/);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 const saved=t.snapshotRun();
 assert.equal(saved.securityPressure,undefined,'no new save fields');
 state.exploreRun=saved;t.resetRun();t.restoreRunIfNeeded();
 assert.equal(t.v5RestrictedCachePressure().tier,'high','restored opened cache recreates same guard pressure');
 assert.equal(t.v5RestrictedCachePressure().extraRange,90);
 const restored=t.runRef();
 restored.vaultAlarm=true;
 assert.deepEqual(t.v5RestrictedCachePressure(),initial,'hatch alarm supersedes pre-alarm security');
 restored.mapVersion=4;
 assert.deepEqual(t.v5RestrictedCachePressure(),initial,'V4 remains unaffected');
});

test('R6.03 ultra cache has stronger bounded pressure but never adds new enemy spawns or a seventh guard',async()=>{
 const {t,layout}=await harness(()=>.9);t.startRun();
 const r=t.runRef();
 assert.ok(layout.guardPosts.filter(p=>!p.alarmOnly).length>=5,'authored facility has fixed patrol posts');
 const high=r.containers.find(c=>layout.supplyTierForContainer(c)==='high');
 const ultra=r.containers.find(c=>layout.supplyTierForContainer(c)==='ultra');
 assert.ok(high&&ultra);
 high.opened=true;
 assert.equal(t.v5RestrictedCachePressure().extraRange,90);
 ultra.opened=true;
 assert.equal(t.v5RestrictedCachePressure().extraRange,120);
 assert.equal(t.v5RestrictedCachePressure().tier,'ultra');
 assert.match(t.v5ReturnRisk().text,/赤金物資回収・巡回警備強化/);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.match(read('exploration.js'),/if\(run\?\.mapVersion===5\)return false; \/\/ no surprise enemy spawns/);
 assert.match(read('exploration.js'),/if\(run\?\.mapVersion===5\)return run\.vaultAlarm\?7:5/);
 assert.equal(r.vaultAlarm,false);
});

test('R6.03 collected restricted cache wakes one existing nearby sentry earlier, without instant detection',async()=>{
 const {t,layout}=await harness(()=>.9);t.startRun();
 const r=t.runRef();r.enemies=[];
 let candidate=null;
 for(const post of layout.guardPosts){
  if(post.alarmOnly)continue;
  for(let y=24;y<layout.h&&!candidate;y+=48)for(let x=24;x<layout.w;x+=48){
   const player={x,y},d=Math.hypot(x-post.x,y-post.y);
   if(d<510||d>575||layout.solid(x,y,12)||layout.roomAt(player)===post.zone)continue;
   candidate={post,player,d};break;
  }
  if(candidate)break;
 }
 assert.ok(candidate,'actual V5 floor has a post 510–575px away across zone boundaries');
 r.player.x=candidate.player.x;r.player.y=candidate.player.y;
 r.pendingGuardPosts=[candidate.post.id];
 assert.equal(t.v5RestrictedCachePressure().extraRange,0);
 assert.equal(t.activateFacilityGuardPosts(),0,'the unalerted post stays asleep beyond 490px');
 assert.equal(r.enemies.length,0);
 const high=r.containers.find(c=>layout.supplyTierForContainer(c)==='high');
 high.opened=true;
 assert.equal(t.activateFacilityGuardPosts(),1,'after restricted pickup this pre-authored patrol becomes active');
 assert.equal(r.enemies.length,1,'no swarm or extra enemy is invented');
 assert.equal(r.enemies[0].homeX,candidate.post.x);
 assert.equal(r.enemies[0].homeY,candidate.post.y);
 assert.equal(r.enemies[0].mode,'patrol','patrol wakes without a wallhack alert');
 assert.equal(r.enemies[0].notice,0);
 assert.ok(r.enemies[0].attackAt>0,'newly active patrol gets a grace period before attack');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.03 restricted pressure is bounded and reportable without changing damage, loot or V3/V4',async()=>{
 const {t,layout}=await harness(()=>.9);t.startRun();
 const r=t.runRef();const before=JSON.stringify(r.containers);
 const report=t.v5SessionDiagnosticReport();
 assert.match(report,/Treasure Merchant R6\.12/);
 assert.match(report,/警戒配置 通常/);
 const ultra=r.containers.find(c=>layout.supplyTierForContainer(c)==='ultra');
 ultra.opened=true;
 assert.match(t.v5SessionDiagnosticReport(),/警戒配置 赤金物資回収・巡回警備強化/);
 assert.ok(t.v5RestrictedCachePressure().extraRange<=120);
 const current=JSON.stringify(r.containers);
 assert.notEqual(current,before,'only test setup changes the cache opened flag');
 assert.equal(r.stats.maxHp,100);
 assert.equal(r.kills,0);
 assert.equal(r.loot.length,0);
 const snap=t.snapshotRun();
 assert.ok(t.validCheckpoint(snap));
 assert.equal(snap.securityPressure,undefined);
 assert.match(read('exploration.css'),/R6\.03: restricted supply warning/);
 assert.match(read('index.html'),/exploration\.js\?v=R6\.21/);
 assert.match(read('index.html'),/exploration\.css\?v=R6\.21/);
});

test('R6.04 bag preview calculates protected and exposed value without changing loot, RNG or checkpoints',async()=>{
 const {t,dom,gameWindow}=await harness(()=>.9);t.startRun();
 const r=t.runRef();r.loot=[
  {id:'ITM-00001',q:0,tid:1},{id:'ITM-00003',q:1,tid:2},
  {id:'ITM-00002',q:0,tid:3}
 ];r.safeIds=[2];r.lootSerial=4;
 const before=JSON.stringify({loot:r.loot,safeIds:r.safeIds});
 assert.deepEqual(t.v5BagLossPreview(),{
  total:410200,secured:10000,exposed:400200,exposedCount:2,protectedCount:1
 });
 assert.match(t.v5BagLossNote(),/失敗時の未保護ロスト：2点・売却基準 400,200/);
 const exposure={textContent:''},exposureCount={textContent:''};
 dom.set('exp-loot-base-exposed',exposure);
 dom.set('exp-loot-exposed-count',exposureCount);
 t.updateHUD(true);
 assert.equal(exposure.textContent,'400,200');
 assert.equal(exposureCount.textContent,'2点');
 const html=t.contents();
 assert.match(html,/id="exp-loot-base-exposed"/);
 assert.match(html,/id="exp-loot-exposed-count"/);
 assert.match(html,/data-explore="bag-close"/);
 assert.equal(JSON.stringify({loot:r.loot,safeIds:r.safeIds}),before,'display must never mutate inventory');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 const bag={classList:{removed:null,remove(c){this.removed=c}}};
 dom.set('exp-backpack',bag);
 gameWindow.explorationAction({dataset:{explore:'bag-close'}});
 assert.equal(bag.classList.removed,'exp-bag-open');
});

test('R6.04 seven-slot loadout expands on demand and stays open through actual paused equipment changes',async()=>{
 const {t,state,documentEvents,gameWindow,dom}=await harness(()=>.9);
 state.inv.push({uid:77,id:'ITM-00001',q:2,locked:false});
 t.startRun();const r=t.runRef();t.togglePause();
 assert.equal(r.paused,true);
 assert.match(t.pausePanel(),/data-explore="gear-toggle"/);
 assert.match(t.pausePanel(),/aria-expanded="false"/);
 assert.doesNotMatch(t.v5GearPanelHTML(),/data-exp-gear="weapon"/,'no selectors clutter the collapsed menu');
 const card={scrollTop:68};
 const layer={innerHTML:'',querySelector(){return card}};
 dom.set('exp-pause-layer',layer);
 gameWindow.explorationAction({dataset:{explore:'gear-toggle'}});
 assert.equal(r.gearPanelOpen,true);
 assert.match(layer.innerHTML,/aria-expanded="true"/);
 assert.match(layer.innerHTML,/data-exp-gear="weapon"/);
 assert.match(layer.innerHTML,/data-exp-gear="tool"/);
 assert.equal(card.scrollTop,68,'gear expansion keeps vertical position');
 const change=documentEvents.get('body:change');
 assert.equal(typeof change,'function');
 const select={dataset:{expGear:'weapon'},value:'77',
  matches:sel=>sel==='[data-exp-gear]'};
 change({target:select});
 assert.equal(state.exploreEquip.weapon,77);
 assert.equal(r.stats.weapons[0].name,'古代の剣');
 assert.equal(r.gearPanelOpen,true,'selector stays visible after change and save');
 assert.match(layer.innerHTML,/主 古代の剣/);
 assert.ok(r.riskUids.includes(77),'newly equipped item is still at risk of loss');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.equal(t.snapshotRun().gearPanelOpen,undefined,'expanded state does not alter saved run schema');
 gameWindow.explorationAction({dataset:{explore:'gear-toggle'}});
 assert.equal(r.gearPanelOpen,false);
 assert.doesNotMatch(layer.innerHTML,/data-exp-gear="tool"/);
});

test('R6.04 failed raid receipt distinguishes actually recovered loot, uninsured loss and lost gear',async()=>{
 const {t,state,received}=await harness(()=>.9);t.startRun();
 const r=t.runRef();r.enemies=[];
 state.inv.push({uid:88,id:'ITM-00002',q:0,locked:false});
 r.riskUids=[88];
 r.loot=[
  {id:'ITM-00001',q:0,tid:1},{id:'ITM-00003',q:2,tid:2},
  {id:'ITM-00002',q:0,tid:3}
 ];r.lootSerial=4;r.safeIds=[2];
 const before=t.snapshotRun();assert.ok(t.validCheckpoint(before));
 assert.equal(before.receipt,undefined);
 t.lose('test settlement');
 const report=state.exploreLastResult;
 assert.equal(report.status,'lost');
 assert.equal(report.receipt.savedCount,1);
 assert.equal(report.receipt.savedBase,10000);
 assert.equal(report.receipt.lostLootCount,2);
 assert.equal(report.receipt.lostLootBase,400200);
 assert.equal(report.receipt.lostGearCount,1);
 assert.equal(report.receipt.lostGearBase,200);
 assert.deepEqual(report.receipt.lostTop.map(row=>row.id),['ITM-00001','ITM-00002']);
 assert.equal(received.length,1,'receipt has no authority to award extra goods');
 assert.equal(state.inv.some(v=>v.uid===88),false,'existing gear-loss transaction remains authoritative');
 const end=t.lastExploreReportHTML();
 assert.match(end,/持ち帰った戦利品/);
 assert.match(end,/未保護で失った戦利品/);
 assert.match(end,/失った持込装備/);
 assert.match(end,/売却基準 400,200/);
 assert.match(end,/古代の剣、家電製品/);
 assert.match(end,/実際の売却収入ではありません/);
 const count=state.inv.length;
 t.lose('duplicate');
 assert.equal(state.inv.length,count,'repeat settlement cannot pay twice');
});

test('R6.04 victory receipt and pre-R6.04 saved reports render without fabricated loss',async()=>{
 const {t,state,received}=await harness(()=>.9);t.startRun();
 const r=t.runRef();r.enemies=[];
 r.loot=[{id:'ITM-00003',q:1,tid:1},{id:'ITM-00002',q:0,tid:2}];
 r.safeIds=[];r.lootSerial=3;
 const exit=t.exitPoint();r.player.x=exit.x;r.player.y=exit.y;
 t.bank();
 assert.equal(state.exploreLastResult.status,'escaped');
 assert.equal(state.exploreLastResult.receipt.savedCount,2);
 assert.equal(state.exploreLastResult.receipt.savedBase,10200);
 assert.equal(state.exploreLastResult.receipt.lostLootCount,0);
 assert.equal(state.exploreLastResult.receipt.lostLootBase,0);
 assert.equal(state.exploreLastResult.receipt.lostGearBase,0);
 assert.equal(received.length,2);
 const won=t.lastExploreReportHTML();
 assert.match(won,/帰還成功/);
 assert.match(won,/売却基準 10,200/);
 assert.match(won,/未保護で失った戦利品.*0点/);
 state.exploreLastResult={
  id:'pre-r604',status:'lost',at:Date.now(),saved:[],lost:[],tickets:0
 };
 const old=t.lastExploreReportHTML();
 assert.match(old,/探索失敗/);
 assert.doesNotMatch(old,/exp-v5-settlement-ledger/,'old reports remain readable');
 const css=read('exploration.css');
 assert.match(css,/R6\.04: V5 inventory and settlement docket/);
 assert.match(css,/\.exp-v5-loadout-panel>button\s*\{[^}]*min-height:46px/);
 assert.match(css,/\.exp-bag-close\s*\{[^}]*min-height:44px/);
 assert.match(read('index.html'),/exploration\.js\?v=R6\.21/);
 assert.match(read('index.html'),/exploration\.css\?v=R6\.21/);
});


test('R6.05 manual chest pickup respects existing 250-item and 1000-token checkpoint bounds',async()=>{
 const {t}=await harness(()=>.9);t.startRun();
 const run=t.runRef();run.enemies=[];
 const c=run.containers.find(v=>v.contents.length>=2);
 assert.ok(c,'real V5 authored chest still has a sealed reward');
 run.player.x=c.x;run.player.y=c.y;
 run.loot=Array.from({length:250},(_,i)=>({id:'ITM-09000',q:0,tid:i+1}));
 run.lootSerial=251;
 assert.ok(t.validCheckpoint(t.snapshotRun()),'250/250 is a valid saved state');
 const sealed=JSON.stringify(c.contents),prior=JSON.stringify(run.loot);
 t.openContainer();
 assert.equal(run.paused,true);
 const panel=t.pausePanel();
 assert.match(panel,/バッグの保存上限です/);
 assert.match(panel,/data-explore="loot-take"[^>]*disabled/,'full capacity disables individual pickup');
 assert.doesNotMatch(panel,/data-explore="loot-take-all"/,'bulk option is hidden at cap');
 t.takeContainerItem({dataset:{container:c.id,i:'0'}});
 t.takeAllContainerItems({dataset:{container:c.id}});
 assert.equal(JSON.stringify(run.loot),prior);
 assert.equal(JSON.stringify(c.contents),sealed,'failed capacity attempt never destroys sealed loot');
 assert.equal(run.lootSerial,251);
 assert.ok(t.validCheckpoint(t.snapshotRun()),'no invalid save after over-cap tap');
 // Even when the bag itself is not full, the checkpoint token must fit.
 run.loot=[];run.lootSerial=1000;
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.match(t.pausePanel(),/バッグの保存上限です/);
 t.takeContainerItem({dataset:{container:c.id,i:'0'}});
 t.takeAllContainerItems({dataset:{container:c.id}});
 assert.equal(run.loot.length,0);
 assert.equal(run.lootSerial,1000);
 assert.equal(JSON.stringify(c.contents),sealed);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.05 stale V5 single-item touch is rejected after the modal has re-rendered',async()=>{
 const {t}=await harness(()=>.9);t.startRun();
 const run=t.runRef();run.enemies=[];
 const c=run.containers.find(v=>v.contents.length>=2);
 assert.ok(c,'at least one authored chest has multiple sealed items');
 run.player.x=c.x;run.player.y=c.y;t.openContainer();
 const firstRevision=String(run.lootOpenRevision);
 const panel=t.pausePanel();
 assert.match(panel,new RegExp('data-explore="loot-take"[^>]+data-revision="'+firstRevision+'"'));
 const old={dataset:{container:c.id,i:'0',revision:firstRevision}};
 const initial=c.contents.map(v=>({id:v.id,q:v.q}));
 t.takeContainerItem(old);
 assert.equal(run.loot.length,1);
 assert.deepEqual(run.loot.map(({id,q})=>({id,q})),initial.slice(0,1));
 const count=c.contents.length;
 t.takeContainerItem(old);
 assert.equal(c.contents.length,count,'stale second click does not take the next item');
 assert.equal(run.loot.length,1);
 assert.notEqual(String(run.lootOpenRevision),firstRevision);
 const secondRevision=String(run.lootOpenRevision);
 t.takeAllContainerItems({dataset:{container:c.id,revision:firstRevision}});
 assert.equal(c.contents.length,count,'stale one-tap collect-all cannot bypass revision');
 t.takeAllContainerItems({dataset:{container:c.id,revision:secondRevision}});
 assert.equal(c.contents.length,0,'fresh button collects exactly the sealed remainder');
 assert.deepEqual(run.loot.map(({id,q})=>({id,q})),initial);
 assert.equal(run.lootSerial,initial.length+1);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.equal('lootOpenRevision' in t.snapshotRun(),false,'volatile touch revision not saved');
});

test('R6.05 bag protects and drops by identity, not the stale sorted row index',async()=>{
 const {t,gameWindow}=await harness(()=>.9);t.startRun();
 const run=t.runRef();run.loot=[
  {id:'ITM-00002',q:0,tid:1},
  {id:'ITM-00003',q:1,tid:2},
  {id:'ITM-00001',q:0,tid:3}
 ];run.safeIds=[];run.lootSerial=4;
 const html=t.lootRowsV5();
 assert.match(html,/data-explore="protect" data-i="2" data-tid="3"/);
 assert.match(html,/data-explore="drop" data-i="2" data-tid="3"/);
 gameWindow.explorationAction({dataset:{explore:'protect',i:'0',tid:'999'}});
 assert.deepEqual(run.safeIds,[],'stale protection cannot protect a different item');
 gameWindow.explorationAction({dataset:{explore:'drop',i:'1',tid:'999'}});
 assert.equal(run.loot.length,3,'stale drop cannot discard a different item');
 gameWindow.explorationAction({dataset:{explore:'protect',i:'1',tid:'2'}});
 assert.deepEqual(run.safeIds,[2]);
 const ordinaryDrop={dataset:{explore:'drop',i:'0',tid:'1'}};
 gameWindow.explorationAction(ordinaryDrop);
 assert.equal(run.loot.length,3,'first tap only confirms requested token');
 gameWindow.explorationAction(ordinaryDrop);
 assert.equal(run.loot.length,2);
 assert.deepEqual(run.loot.map(row=>row.tid),[2,3]);
 // A formerly valid second-row button would now refer to a different token.
 gameWindow.explorationAction({dataset:{explore:'drop',i:'1',tid:'2'}});
 assert.deepEqual(run.loot.map(row=>row.tid),[2,3]);
 assert.deepEqual(run.safeIds,[2]);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.05 keyboard Escape closes the active cache and map instead of retaining hidden pause state',async()=>{
 const {t,layout,documentEvents,gameWindow}=await harness(()=>.9);t.startRun();
 const run=t.runRef();run.enemies=[];
 const c=run.containers.find(v=>v.contents.length);assert.ok(c);
 run.player.x=c.x;run.player.y=c.y;t.openContainer();
 assert.equal(run.paused,true);
 assert.equal(run.lootOpenId,c.id);
 const onKey=documentEvents.get('keydown');
 assert.equal(typeof onKey,'function');
 let prevented=0;
 const key=k=>onKey({key:k,target:{tagName:'DIV'},preventDefault(){prevented++}});
 key('Escape');
 assert.equal(run.paused,false,'closing a chest resumes the game');
 assert.equal(run.lootOpenId,null,'closing via keyboard clears the selected chest');
 t.togglePause();
 assert.equal(run.paused,true);
 assert.doesNotMatch(t.pausePanel(),/回収品を選ぶ/,'next pause shows the normal pause menu');
 key('p');assert.equal(run.paused,false);
 gameWindow.explorationAction({dataset:{explore:'field-map'}});
 assert.equal(run.paused,true);
 assert.equal(run.showMap,true);
 assert.equal(run.mapDirect,true);
 key('Escape');
 assert.equal(run.paused,false,'direct map exits back to gameplay');
 assert.equal(run.showMap,false);
 assert.equal(run.mapDirect,false);
 t.togglePause();assert.equal(run.paused,true);
 gameWindow.explorationAction({dataset:{explore:'map'}});
 assert.equal(run.showMap,true);
 assert.equal(run.mapDirect,false);
 key('Escape');
 assert.equal(run.paused,true,'map opened from pause goes back one level');
 assert.equal(run.showMap,false);
 assert.match(t.pausePanel(),/探索を再開/);
 assert.ok(prevented>=4);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.05 V5 loot edge-case protections preserve R6.04 report and old map layout',async()=>{
 const {t,state}=await harness(()=>.9);t.startRun();
 const run=t.runRef();
 assert.equal(run.mapVersion,5);
 assert.match(t.v5SessionDiagnosticReport(),/Treasure Merchant R6\.12/);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 const source=read('exploration.js'),css=read('exploration.css'),html=read('index.html');
 assert.match(source,/function canStoreContainerRewards\(count=1\)/);
 assert.match(source,/if\(run\.mapVersion===5\)run\.lootOpenRevision=/);
 assert.match(css,/R6\.05: preserve checkpoint integrity/);
 assert.match(html,/exploration\.js\?v=R6\.21/);
 assert.match(html,/exploration\.css\?v=R6\.21/);
 state.exploreLastResult={id:'legacy',status:'lost',at:Date.now(),saved:[],lost:[],tickets:0};
 assert.doesNotMatch(t.lastExploreReportHTML(),/exp-v5-settlement-ledger/,'pre-receipt report remains supported');
});

test('R6.06 Safari long-press touchend prevents a second synthesized action',async()=>{
 let now=1_000_000;
 const {t,dom}=await harness(()=>.9,{now:()=>now});
 t.startRun();const run=t.runRef();
 const events=new Map();
 const buttons={};
 for(const type of ['attack','auto','bag'])buttons[type]={
  disabled:false,dataset:{explore:type},
  closest(selector){return selector==='button[data-explore]'?this:null}
 };
 const actions={dataset:{},addEventListener:(name,fn)=>events.set(name,fn),
  contains(button){return Object.values(buttons).includes(button)}};
 dom.set('.exp-playing .exp-control-actions',actions);
 t.bindMultiTouchActions();
 t.bindMultiTouchActions();
 assert.deepEqual([...events.keys()],['touchstart','touchend','touchcancel','click'],
  'exactly one set of mobile handlers even if mount retries');
 const target=buttons.auto;
 let prevented=0,stopped=0;
 const touch=(type)=>events.get(type)({target,cancelable:true,preventDefault(){prevented++}});
 assert.equal(run.autoAttack,false);
 touch('touchstart');assert.equal(run.autoAttack,true);
 assert.equal(prevented,1);
 now+=1900;
 touch('touchend');
 events.get('click')({target,detail:1,preventDefault(){prevented++},stopPropagation(){stopped++}});
 assert.equal(prevented,2,'a 1.9-second press still blocks the duplicate Safari click');
 assert.equal(stopped,1);
 assert.equal(run.autoAttack,true,'only one toggle is possible');
 // Browser hardware keyboard clicks are detail=0 and are not suppressed.
 now+=10;
 let keyboardSuppressed=false;
 events.get('click')({target,detail:0,preventDefault(){keyboardSuppressed=true},stopPropagation(){}});
 assert.equal(keyboardSuppressed,false);
 now+=1000;
 touch('touchstart');assert.equal(run.autoAttack,false);
 now+=2500;touch('touchcancel');
 events.get('click')({target,detail:1,preventDefault(){prevented++},stopPropagation(){stopped++}});
 assert.equal(run.autoAttack,false,'cancelled long touch does not execute a second action');
 assert.equal(stopped,2);
});

test('R6.06 iPhone bag closes on pause and Escape, without a hidden overlay after resume',async()=>{
 const {t,dom,gameWindow,documentEvents}=await harness(()=>.9);
 t.startRun();const run=t.runRef();
 const bag={classList:{
  open:false,contains(key){return key==='exp-bag-open'&&this.open},
  toggle(key){if(key==='exp-bag-open')this.open=!this.open;return this.open},
  remove(key){if(key==='exp-bag-open')this.open=false}
 }};
 dom.set('exp-backpack',bag);
 gameWindow.explorationAction({dataset:{explore:'bag'}});
 assert.equal(bag.classList.open,true);
 t.togglePause();
 assert.equal(run.paused,true);
 assert.equal(bag.classList.open,false,'pause must dismiss the unpaused bag');
 t.togglePause();
 assert.equal(run.paused,false);
 assert.equal(bag.classList.open,false);
 gameWindow.explorationAction({dataset:{explore:'bag'}});
 assert.equal(bag.classList.open,true);
 const keyDown=documentEvents.get('keydown');let prevented=0;
 keyDown({key:'Escape',target:{tagName:'DIV'},preventDefault(){prevented++}});
 assert.equal(bag.classList.open,false,'Escape closes bag');
 assert.equal(run.paused,false,'Escape does not unexpectedly pause while closing bag');
 assert.equal(prevented,1);
 keyDown({key:'Escape',target:{tagName:'DIV'},preventDefault(){prevented++}});
 assert.equal(run.paused,true,'another Escape after bag close opens pause');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.06 viewport rail measurements keep a positive native canvas at common phone sizes',async()=>{
 const {t,dom}=await harness(()=>.9);t.startRun();
 let viewport={w:360,h:740,top:188,bottom:135};
 const vars={};
 const shell={
  querySelector(sel){return sel==='.exp-v5-toprail'?rail:sel==='.exp-v5-bottomdock'?dock:null},
  getBoundingClientRect(){return {top:0,bottom:viewport.h}},
  style:{getPropertyValue(key){return vars[key]||''},setProperty(key,val){vars[key]=val}}
 };
 const rail={getBoundingClientRect(){return {bottom:viewport.top}}};
 const dock={getBoundingClientRect(){return {top:viewport.h-viewport.bottom}}};
 dom.set('.exp-shell.exp-playing.exp-v5-layout',shell);
 const field={
  getBoundingClientRect(){return {width:viewport.w,height:viewport.h-viewport.top-viewport.bottom}},
  width:0,height:0
 };
 dom.set('exp-field',field);
 for(const [w,h,top,bottom] of [[360,740,188,135],[390,844,210,142],[430,932,212,145],[360,620,180,124]]){
  viewport={w,h,top,bottom};
  t.resizeField();
  assert.equal(vars['--v5-canvas-top'],top+'px');
  assert.equal(vars['--v5-action-dock'],bottom+'px');
  assert.equal(field.width,w,'native backing canvas matches CSS width');
  assert.equal(field.height,h-top-bottom,'native backing canvas matches visible height');
  assert.ok(t.viewSize().h>=300,'portrait screen still has a meaningful playable viewport');
 }
 assert.ok(t.validCheckpoint(t.snapshotRun()),'geometry recalculation is view-only');
 assert.match(read('exploration.js'),/if\(v5ChromeObserver\)\{v5ChromeObserver\.disconnect\(\);v5ChromeObserver=null\}/,
  'old observer is disconnected with old playfield DOM');
 assert.match(read('exploration.js'),/window\.visualViewport\.addEventListener\('resize'/,
  'Safari viewport resize is handled separately from window resize');
});

test('R6.07 pre-raid and paused detailed maps show the same actual physical obstacles, not fake decorative furniture',async()=>{
 const {t,layout}=await harness(()=>.9);t.startRun();
 const run=t.runRef();run.enemies=[];
 const before=JSON.stringify({containers:run.containers,loot:run.loot,player:run.player,
  stats:run.stats,guards:run.pendingGuardPosts,keys:run.hasKeycard});
 const preview=t.facilityPreviewPanel(),live=t.mapPanel();
 assert.ok(layout.mapBlueprint.blockingFurniture.length>0);
 assert.ok(layout.mapBlueprint.walls.length>0);
 assert.ok(layout.mapBlueprint.covers.length>0);
 const proof=layout.mapBlueprint.blockingFurniture[0];
 const tag='<rect x="'+proof.x+'" y="'+proof.y+'" width="'+proof.w+'" height="'+proof.h+'"';
 assert.ok(preview.includes(tag),'same blocking furniture in pre-raid plan');
 assert.ok(live.includes(tag),'same blocking furniture in paused tactical plan');
 assert.match(preview,/exp-map-physical-cover/);
 assert.match(live,/exp-map-physical-cover/);
 assert.doesNotMatch(preview,/font-size="19" font-weight="bold" text-anchor="middle"/,
  'decorative prop glyphs are removed');
 assert.doesNotMatch(live,/font-size="19" font-weight="bold" text-anchor="middle"/);
 const names=['北西書庫','薬局','警備室','最上位金庫','脱出検問'];
 for(const name of names){assert.ok(preview.includes(name));assert.ok(live.includes(name))}
 assert.equal(JSON.stringify({containers:run.containers,loot:run.loot,player:run.player,
  stats:run.stats,guards:run.pendingGuardPosts,keys:run.hasKeycard}),before,
  'opening either map does not change any gameplay field');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 for(const route of ['strict','cover']){
  run.vaultUnlocked=true;run.vaultEntered=true;run.vaultSealed=true;
  run.vaultHatchUsed=true;run.vaultAlarm=true;run.escapeVariant=route;
  assert.match(t.mapPanel(),/exp-map-v5-svg/,'A and B maps continue to render');
  assert.match(t.mapPanel(),/fill="#b84446"/,'the actual shutter rectangles remain on the live plan');
  assert.ok(t.validCheckpoint(t.snapshotRun()));
 }
});

test('R6.08 floating joystick starts at the actual touch point and keeps right-hand actions independent',async()=>{
 const {t,dom,gameWindow}=await harness(()=>.9);
 t.startRun();const run=t.runRef();
 const listeners=new Map(),activeClasses=new Set();
 const shell={getBoundingClientRect(){return {left:0,top:0,right:390,bottom:844}}};
 let captured=null;
 const zone={
  addEventListener:(name,handler)=>listeners.set(name,handler),
  classList:{add:name=>activeClasses.add(name),remove:name=>activeClasses.delete(name)},
  getBoundingClientRect(){return {left:0,top:422,right:195,bottom:844}},
  closest:selector=>selector==='.exp-playing'?shell:null,
  setPointerCapture:id=>{captured=id},
  hasPointerCapture:id=>captured===id,
  releasePointerCapture:id=>{if(captured===id)captured=null}
 };
 const stick={style:{},offsetWidth:108},thumb={style:{},offsetWidth:34};
 dom.set('exp-stick-zone',zone);
 dom.set('exp-stick',stick);
 dom.set('exp-stick-thumb',thumb);
 t.bindStick();
 let prevented=0;
 const finger=(id,x,y)=>({
  pointerType:'touch',pointerId:id,clientX:x,clientY:y,
  preventDefault(){prevented++}
 });
 listeners.get('pointerdown')(finger(7,78,640));
 assert.ok(activeClasses.has('is-active'));
 assert.equal(captured,7);
 assert.equal(stick.style.left,'78px');
 assert.equal(stick.style.top,'218px');
 listeners.get('pointermove')(finger(7,130,640));
 assert.ok(run.joy.x>.9,'dragging from touch origin moves right');
 assert.ok(Math.abs(run.joy.y)<.01);
 gameWindow.explorationAction({dataset:{explore:'auto'}});
 assert.equal(run.autoAttack,true,'right thumb can toggle AUTO while left finger is steering');
 assert.ok(run.joy.x>.9,'right action must not reset movement finger');
 listeners.get('pointerup')(finger(7,130,640));
 assert.equal(run.joy.x,0);assert.equal(run.joy.y,0);
 assert.equal(captured,null);
 assert.equal(activeClasses.has('is-active'),false);
 assert.ok(prevented>=3);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.08 full-viewport V5 native backing canvas matches phone display, not the gap between HUD rails',async()=>{
 const {t,dom}=await harness(()=>.9);t.startRun();
 const bounds={width:390,height:844};
 const canvas={width:0,height:0,getBoundingClientRect(){return {...bounds}}};
 dom.set('exp-field',canvas);
 for(const [width,height] of [[360,740],[390,844],[430,932],[360,620]]){
  bounds.width=width;bounds.height=height;
  t.resizeField();
  assert.equal(canvas.width,width,'full-screen canvas width follows viewport');
  assert.equal(canvas.height,height,'full-screen canvas height follows viewport, including behind controls');
  assert.equal(t.viewSize().w,width);
  assert.equal(t.viewSize().h,height);
 }
 assert.ok(t.validCheckpoint(t.snapshotRun()),'resizing view does not alter checkpoint invariants');
});

test('R6.09 V5 exactly four fixed, three area and two cross-zone patrols retain all authored posts',async()=>{
 const {t,layout}=await harness(()=>.85);t.startRun();
 const posts=layout.guardPosts,modes=Object.groupBy(posts,p=>p.patrolMode);
 assert.equal(posts.length,9);
 assert.equal(modes.fixed.length,4);
 assert.equal(modes.area.length,3);
 assert.equal(modes.wide.length,2);
 assert.deepEqual(modes.fixed.map(p=>p.id).sort(),['tiled-guard-15','tiled-guard-40','tiled-guard-41','tiled-guard-42']);
 assert.deepEqual(modes.area.map(p=>p.id).sort(),['tiled-guard-16','tiled-guard-17','tiled-guard-18']);
 assert.deepEqual(modes.wide.map(p=>p.id).sort(),['tiled-guard-14','tiled-guard-19']);
 for(const post of posts){
  assert.equal(post.routeVariants.length,post.patrolMode==='fixed'?1:2);
  for(const route of post.routeVariants){
   assert.ok(route.length>=2);
   assert.deepEqual([route[0].x,route[0].y],[post.x,post.y]);
   for(const pt of route)assert.equal(layout.solid(pt.x,pt.y,t.enemyDefinition(post.kind).radius),false,
    post.id+' route anchor must not be inside a wall or prop');
  }
 }
 assert.equal(posts.filter(p=>p.alarmOnly).length,2);
 assert.equal(posts.filter(p=>p.alarmOnly).every(p=>p.patrolMode==='fixed'),true,
  'the two guarded one-way escape routes retain their authored patrol timing');
 assert.equal(t.runRef().pendingGuardPosts.length,9,'no new active enemies at the start');
 assert.equal(t.validCheckpoint(t.snapshotRun()),true);
});

test('R6.09 patrol routes are raid-specific, stable and do not reroll on save/resume',async()=>{
 const {t,layout,state}=await harness(()=>.9);t.startRun();const run=t.runRef();
 const post=layout.guardPosts.find(p=>p.id==='tiled-guard-19');
 const make=(id,oldRoute=null)=>t.restoreEnemy({
  x:post.x,y:post.y,homeX:post.x,homeY:post.y,kind:post.kind,
  hp:t.enemyDefinition(post.kind).hp,mode:'patrol',
  ...(oldRoute?{guardRoute:oldRoute}:{}),guardStep:2
 },5,id);
 let a=null,b=null,firstId=null,secondId=null;
 for(let i=0;i<100;i++){
  const candidate=make('raid-'+i);
  if(!a){a=candidate;firstId='raid-'+i}
  else if(JSON.stringify(candidate.guardRoute)!==JSON.stringify(a.guardRoute)){
   b=candidate;secondId='raid-'+i;break;
  }
 }
 assert.ok(b,'different raids must sometimes choose different wide patrol circuits');
 assert.equal(a.guardMode,'wide');
 assert.equal(b.guardMode,'wide');
 assert.deepEqual(make(firstId).guardRoute,a.guardRoute,'same raid ID must always select identical loop');
 assert.deepEqual(make(secondId).guardRoute,b.guardRoute);
 assert.equal(make(firstId).guardStep,2,'patrol progress survives route selection');
 // A checkpoint from R6.08 includes the former compact patrol route.
 const old=make(firstId,post.route);
 assert.deepEqual(old.guardRoute,post.route,'older raid patrol remains intact instead of teleporting to a new circuit');
 run.id=secondId;
 run.pendingGuardPosts=run.pendingGuardPosts.filter(id=>id!==post.id);
 run.enemies=[b];
 const checkpoint=t.snapshotRun();
 assert.equal(t.validCheckpoint(checkpoint),true);
 state.exploreRun=checkpoint;t.resetRun();t.restoreRunIfNeeded();
 const restored=t.runRef();
 assert.equal(restored.paused,true);
 assert.equal(restored.id,secondId);
 assert.equal(restored.enemies.length,1);
 assert.deepEqual(restored.enemies[0].guardRoute,b.guardRoute,'save/resume never rerolls an active enemy circuit');
 assert.equal(restored.enemies[0].guardStep,2);
 assert.equal(t.validCheckpoint(t.snapshotRun()),true);
});

test('R6.09 local and cross-zone patrols walk between actual Tiled rooms without clipping walls',async()=>{
 const {t,layout}=await harness(()=>.85);t.startRun();const run=t.runRef();
 const roaming=layout.guardPosts.filter(p=>p.patrolMode!=='fixed');
 for(const post of roaming){
  for(const candidate of post.routeVariants){
   const guard=t.restoreEnemy({
    x:post.x,y:post.y,homeX:post.x,homeY:post.y,kind:post.kind,
    hp:t.enemyDefinition(post.kind).hp,mode:'patrol',guardRoute:candidate,
    facingX:1,facingY:0,attackAt:999
   },5,'route-test');
   assert.deepEqual(guard.guardRoute,candidate);
   const seen=new Set([guard.guardStep]);
   const zones=new Set([layout.themeAt(guard)]);
   let distanceMoved=0;
   for(let i=0;i<850;i++){
    const x=guard.x,y=guard.y;
    t.enemyPatrol(guard,t.enemyDefinition(guard.kind),i*.1,.1);
    distanceMoved+=Math.hypot(guard.x-x,guard.y-y);
    assert.equal(layout.solid(guard.x,guard.y,t.enemyDefinition(guard.kind).radius),false,
     post.id+' '+post.patrolMode+' guard crossed an impassable Tiled wall');
    seen.add(guard.guardStep);
    zones.add(layout.themeAt(guard));
   }
   assert.ok(seen.size>=3,post.id+' must traverse more than one route leg: '+[...seen]);
   assert.ok(distanceMoved>220,post.id+' must actually roam instead of camping');
   if(post.patrolMode==='wide')
    assert.ok(zones.size>=2,post.id+' must cross between named map zones');
  }
 }
 assert.equal(run.enemies.length,0,'route simulation does not spawn or mutate other enemies');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.09 pre-sighting route variation does not alter combat, loot, geometry or phone controls',async()=>{
 const {t,layout}=await harness(()=>.85);t.startRun();const run=t.runRef();
 const old=t.snapshotRun();
 assert.equal(run.mapVersion,5);
 assert.equal(layout.authoredContainers.length,11);
 assert.equal(layout.mapBlueprint.walls.length>10,true);
 assert.equal(run.containers.length,11);
 assert.equal(run.enemies.length,0);
 assert.equal(t.spawnEnemy?.(),undefined,'normal V5 random enemy spawns remain disabled');
 assert.ok(t.validCheckpoint(old));
 const code=read('exploration.js'),html=read('index.html'),css=read('exploration.css');
 assert.match(code,/function v5GuardRouteChoice/);
 assert.match(code,/enemies:c.enemies.map\(v=>restoreEnemy\(v,c.mapVersion,c.id,c.undergroundEntered\?MallBasement:null\)\)/);
 assert.match(html,/exploration\.js\?v=R6\.21/);
 assert.match(html,/exploration-layout-v5\.js\?v=R6\.18/);
 assert.match(html,/exploration\.css\?v=R6\.21/);
 assert.match(css,/R6\.08: return V5 to a full-viewport tactical field/);
});

test('R6.10 V5 discard advice compares real speed recovery and never removes or exposes protected loot',async()=>{
 const {t}=await harness(()=>.1);
 t.startRun();const r=t.runRef();
 assert.equal(r.mapVersion,5);
 assert.equal(t.v5JettisonAdvice(),null,'no loot means no suggested discard');
 r.loot=Array.from({length:6},(_,i)=>({id:'ITM-00001',q:1,tid:100+i}));
 r.loot.push({id:'ITM-00002',q:1,tid:200});
 r.safeIds=[100,101];
 const original=JSON.stringify({loot:r.loot,safeIds:r.safeIds,stats:r.stats});
 const choice=t.v5JettisonAdvice();
 assert.ok(choice,'an overloaded backpack has a meaningful tradeoff');
 assert.equal(choice.tid,102,'protected items are excluded');
 assert.equal(choice.lostBase,400000,'displayed loss is base value, not sale price');
 assert.equal(choice.lostWeight,30,'weight uses existing tenths-of-kilogram data');
 assert.ok(choice.gain>=2 && choice.afterPct>choice.beforePct);
 assert.match(t.v5JettisonAdviceHTML(),/重量調整の候補/);
 r.paused=true;r.pausedAt=Date.now();
 assert.match(t.pausePanel(),/重量調整の候補/,'decision is visible while paused');
 assert.equal(JSON.stringify({loot:r.loot,safeIds:r.safeIds,stats:r.stats}),original,
  'hypothetical discard must not mutate live loot, protection or capacity');
 r.mapVersion=4;
 assert.equal(t.v5JettisonAdvice(),null,'legacy maps do not inherit V5 balance UI');
});

test('R6.11 three risk/reward choices match authored grades, show only public odds and remain save-neutral',async()=>{
 const {t,layout}=await harness(()=>.1);
 const base=t.v5ApproachPlans(layout,null);
 assert.deepEqual(base.map(p=>[p.id,p.total]),[
  ['ordinary',7],['archive',2],['vault',2]]);
 assert.deepEqual(base[0].grades.map(g=>[g.amount,g.ssrPlus]),[[3,1.3],[4,5.2]]);
 assert.equal(base[1].grades[0].ssrPlus,28);
 assert.equal(base[2].grades[0].ssrPlus,55.5);
 const pre=t.facilityPreviewPanel();
 assert.match(pre,/3つの探索方針/);
 assert.match(pre,/南東金庫/);
 t.startRun();
 const r=t.runRef();
 const initial=JSON.stringify({containers:r.containers,loot:r.loot,safeIds:r.safeIds});
 const view=t.v5ApproachPlans(layout);
 assert.equal(view[0].unopened,7);
 assert.equal(view[1].unopened,2);
 assert.equal(view[2].unopened,2);
 assert.match(t.mapPanel(),/3つの探索方針/);
 assert.equal(JSON.stringify({containers:r.containers,loot:r.loot,safeIds:r.safeIds}),initial,
  'map UI must not mutate sealed rewards, loot or protection; wall clock advances normally');
 const high=r.containers.find(c=>layout.supplyTierForContainer(c)==='high');
 assert.ok(high);
 high.opened=true;high.contents=[];
 const updated=t.v5ApproachPlans(layout);
 assert.equal(updated[1].unopened,1);
 assert.equal(updated[1].cleared,1);
 assert.equal(updated[2].unopened,2,'unrelated vault remains untouched');
 assert.ok(t.v5ApproachChoicesHTML(layout).includes('未開封 1 ／ 開封・残あり 0 ／ 回収済 1'));
 assert.match(t.v5ApproachChoicesHTML(layout),/カードキー未取得/);
 r.hasKeycard=true;
 assert.match(t.v5ApproachChoicesHTML(layout),/カードキー所持/);
 r.vaultSealed=true;
 assert.match(t.v5ApproachChoicesHTML(layout),/非常ハッチへ/);
 r.vaultHatchUsed=true;
 assert.match(t.v5ApproachChoicesHTML(layout),/警報帰還中：寄り道できません/);
});

test('R6.12 B1 floor is real Tiled geometry with nine caches, nine guards and its own exit',async()=>{
 const {t,layout,basementLayout}=await harness(()=>.1);
 assert.equal(basementLayout.isBasement,true);
 assert.equal(basementLayout.w,40*16*3);
 assert.equal(basementLayout.h,36*16*3);
 assert.equal(basementLayout.authoredContainers.length,9);
 assert.equal(basementLayout.guardPosts.length,9);
 assert.equal(basementLayout.rooms.length,6);
 assert.equal(layout.authoredContainers.length,11,'existing ground keeps all prior caches');
 assert.ok(!basementLayout.solid(basementLayout.start.x,basementLayout.start.y,12));
 assert.ok(!basementLayout.solid(basementLayout.fixedExit.x,basementLayout.fixedExit.y,12));
 const floorMap=t.facilityPreviewPanel();
 assert.match(floorMap,/B1｜地下保管庫の地図を見る/);
 assert.match(floorMap,/地下専用脱出口/);
 assert.match(floorMap,/B1 KEY/,'ground planning map marks entry key');
});
test('R6.12 basement key and door add +120 seconds exactly once, keep loot and save on B1',async()=>{
 const {t,layout,basementLayout,state}=await harness(()=>.2);
 t.startRun();const r=t.runRef();
 const before=t.snapshotRun();
 assert.equal(before.undergroundEntered,false);
 const gate={x:(24.5*16*3),y:(27.5*16*3)};
 const key={x:(27.5*16*3),y:(17.5*16*3)};
 r.player.x=gate.x;r.player.y=gate.y;
 assert.equal(t.nearBasementDoor(),true);
 t.useBasementInteraction();
 assert.equal(r.undergroundEntered,false,'locked door cannot enter');
 r.player.x=key.x;r.player.y=key.y;
 assert.equal(t.nearBasementKey(),true);
 t.useBasementInteraction();
 assert.equal(r.basementKeyTaken,true);
 const seized={id:'ITM-00001',q:1,tid:1};
 r.loot.push(seized);r.safeIds.push(1);r.lootSerial=2;
 r.player.x=gate.x;r.player.y=gate.y;
 assert.equal(t.useBasementInteraction(),true);
 assert.equal(r.undergroundEntered,true);
 assert.equal(r.duration,420);
 assert.equal(r.containers.length,9);
 assert.equal(r.pendingGuardPosts.length,9);
 assert.equal(r.exitId,basementLayout.fixedExit.id);
 assert.equal(r.loot[0].id,seized.id);
 assert.equal(r.safeIds[0],1);
 assert.equal(r.player.x,basementLayout.start.x);
 assert.match(t.mapPanel(),/B1 地下保管庫/);
 assert.match(t.mapPanel(),/地下脱出区画/);
 assert.ok(t.validCheckpoint(t.snapshotRun()),'valid one-way B1 checkpoint');
 const sealed=JSON.stringify(r.containers.map(c=>c.contents));
 assert.equal(t.enterBasement(),false,'second entry is refused');
 assert.equal(r.duration,420,'time bonus cannot stack');
 const checkpoint=t.snapshotRun();
 t.resetRun();state.exploreRun=checkpoint;
 t.restoreRunIfNeeded();
 const restored=t.runRef();
 assert.ok(restored,'restores B1 without erasing raid');
 assert.equal(restored.undergroundEntered,true);
 assert.equal(restored.duration,420);
 assert.equal(restored.exitId,basementLayout.fixedExit.id);
 assert.equal(JSON.stringify(restored.containers.map(c=>c.contents)),sealed,'same sealed items after reload');
 assert.equal(restored.safeIds[0],1);
 assert.equal(restored.loot[0].id,seized.id);
 assert.equal(t.nearBasementDoor(),false,'cannot return upstairs');
});
test('R6.12 basement extraction pays ground and B1 loot only once, with original pouch policy',async()=>{
 const {t,basementLayout,state,received}=await harness(()=>.3);
 t.startRun();const r=t.runRef();
 r.basementKeyTaken=true;
 r.player.x=24.5*48;r.player.y=27.5*48;
 assert.equal(t.enterBasement(),true);
 r.loot=[{id:'ITM-00001',q:1,tid:1},{id:'ITM-00002',q:1,tid:2}];
 r.safeIds=[1];r.lootSerial=3;
 r.player.x=basementLayout.fixedExit.x;r.player.y=basementLayout.fixedExit.y;
 t.bank();
 assert.equal(received.length,2,'both loot items were brought home');
 assert.equal(state.exploreLastResult.status,'escaped');
 t.bank();assert.equal(received.length,2,'no double claim');
});

test('R6.14 previously saved B1 sortie survives room-layout change, with sealed items and 120s bonus intact',async()=>{
 const {t,state,basementLayout}=await harness(()=>.2);
 t.startRun();
 const player=t.runRef().player;
 const entrance=t.runRef().mapVersion===5?{x:24.5*48,y:27.5*48}:null;
 assert.ok(entrance);
 t.runRef().basementKeyTaken=true;
 player.x=entrance.x;player.y=entrance.y;
 assert.equal(t.enterBasement(),true);
 const active=t.runRef();
 const unchanged=active.containers.map(c=>({id:c.id,contents:JSON.stringify(c.contents),opened:c.opened}));
 const token=active.id;
 active.loot.push({id:'ITM-00002',q:1,tid:1});active.lootSerial=2;active.safeIds=[1];
 const old=t.snapshotRun();
 assert.equal(old.undergroundEntered,true);
 assert.equal(old.remaining<=420,true);
 // Simulate a pre-R6.14 checkpoint with the prior room centres; this must
 // not invalidate sealed items, reset the floor/time, or discard a live sortie.
 old.containers.forEach(c=>{c.room=(c.room+1)%basementLayout.rooms.length});
 assert.equal(t.validCheckpoint(old),false,'old room metadata differs from new Tiled source');
 old.player.x=(29.5)*48;old.player.y=(20.5)*48; // newly partitioned wall
 state.exploreRun=old;t.resetRun();t.restoreRunIfNeeded();
 const resumed=t.runRef();
 assert.ok(resumed,'old underground sortie migrated without loss');
 assert.equal(resumed.id,token);
 assert.equal(resumed.undergroundEntered,true);
 assert.equal(resumed.duration,420);
 assert.equal(resumed.safeIds[0],1);
 assert.equal(resumed.loot[0].id,'ITM-00002');
 assert.equal(basementLayout.solid(resumed.player.x,resumed.player.y,17),false,'player relocated to traversable floor');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.deepEqual(resumed.containers.map(c=>({id:c.id,contents:JSON.stringify(c.contents),opened:c.opened})),unchanged,
  'no extra roll or cache reset during old floor migration');
});


// R6.17: synthetic WALKTHROUGH using actual V5 movement, Tiled collision,
// map switching, cache collection, checkpoint restore, and settlement.
// Enemies are deliberately isolated for the geometry/transaction smoke test;
// this is NOT an estimate of survival rate or combat difficulty.
const ReturnRoutesR617=require('../map-return-routes.js');
const R617_TILE=48;
function r617Path(layout,origin,destination){
 const cols=layout.w/R617_TILE,rows=layout.h/R617_TILE;
 const index=(x,y)=>y*cols+x,cell=p=>index(Math.floor(p.x/R617_TILE),Math.floor(p.y/R617_TILE));
 const start=cell(origin),end=cell(destination),prev=new Int32Array(cols*rows).fill(-1),queue=[start];
 prev[start]=start;
 for(let i=0;i<queue.length&&prev[end]<0;i++){
  const pos=queue[i],x=pos%cols,y=Math.floor(pos/cols);
  for(const n of [x>0?pos-1:-1,x<cols-1?pos+1:-1,y>0?pos-cols:-1,y<rows-1?pos+cols:-1]){
   if(n<0||prev[n]>=0)continue;
   const px=((n%cols)+.5)*R617_TILE,py=(Math.floor(n/cols)+.5)*R617_TILE;
   if(layout.solid(px,py,12))continue;
   prev[n]=pos;queue.push(n);
  }
 }
 assert.ok(prev[end]>=0,'B1 spawn must connect to final red-gold loot');
 const route=[];
 for(let at=end;;at=prev[at]){
  route.push({x:((at%cols)+.5)*R617_TILE,y:(Math.floor(at/cols)+.5)*R617_TILE});
  if(at===start)break;
 }
 return route.reverse();
}
function r617Drive(t,layout,waypoints,advance){
 const run=t.runRef(),dt=.04;
 let frames=0;
 // Isolate the geometry/transactions; previous R6.15 tests separately check guard patrols.
 run.enemies=[];run.pendingGuardPosts=[];run.spawnAt=1000000;
 for(let i=1;i<waypoints.length;i++){
  const destination=waypoints[i];let localFrames=0;
  while(Math.hypot(run.player.x-destination.x,run.player.y-destination.y)>3.8){
   const dx=destination.x-run.player.x,dy=destination.y-run.player.y;
   run.joy=Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)};
   advance(40);t.tick(dt);frames++;localFrames++;
   assert.equal(run.status,'playing','unexpected settlement before B1 exit');
   assert.equal(layout.solid(run.player.x,run.player.y,12),false,
    'actual player collision entered solid geometry');
   assert.ok(localFrames<600,'stuck trying to reach B1 tile '+i);
   assert.ok(frames<14000,'B1 navigation exceeded synthetic frame budget');
  }
 }
 run.joy={x:0,y:0};run.steer={x:0,y:0};
 return frames*dt;
}
for(const routeName of ['central','northern']){
 test('R6.17 full B1 ' + routeName + ' waypoint walkthrough banks only once after reload',async()=>{
  let now=1_000_000;
  const {t,layout,basementLayout,state,received}=await harness(()=>.3,{now:()=>now});
  const advance=milliseconds=>{now+=milliseconds};
  t.startRun();
  let r=t.runRef();
  const raidId=r.id;
  r.player.x=layout.basementKey.x;r.player.y=layout.basementKey.y;
  assert.equal(t.useBasementInteraction(),true,'grab authored surface key');
  assert.equal(r.basementKeyTaken,true);
  r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
  assert.equal(t.useBasementInteraction(),true,'enter authored B1 staircase');
  assert.equal(r.undergroundEntered,true);
  assert.equal(r.duration,420);
  const rare=basementLayout.authoredContainers.filter(c=>c.tier==='ultra')
   .sort((a,b)=>b.y-a.y)[0];
  const inwards=r617Path(basementLayout,basementLayout.start,rare);
  const outward=ReturnRoutesR617.plan(basementLayout).routes.find(v=>v.id===routeName);
  assert.ok(outward);
  const inwardSeconds=r617Drive(t,basementLayout,inwards,advance);
  assert.ok(Math.hypot(r.player.x-rare.x,r.player.y-rare.y)<6);
  t.openContainer();
  const cache=r.containers.find(c=>c.id===r.lootOpenId);
  assert.ok(cache&&r.paused,'loot must open in reachable map location');
  const quantity=cache.contents.length;
  assert.ok(quantity>0,'fixed scenario includes loot to extract');
  t.takeAllContainerItems({dataset:{container:cache.id,revision:String(r.lootOpenRevision||0)}});
  assert.equal(cache.contents.length,0);
  assert.equal(r.loot.length,quantity);
  t.closeContainer();
  assert.equal(r.paused,false);
  const afterLoot=t.snapshotRun();
  assert.ok(t.validCheckpoint(afterLoot));
  const remainingAtSave=t.remaining();
  state.exploreRun=afterLoot;t.resetRun();t.restoreRunIfNeeded();
  r=t.runRef();
  assert.ok(r&&r.paused,'restored B1 sortie waits for resume');
  assert.equal(r.id,raidId);
  assert.equal(r.undergroundEntered,true);
  assert.equal(r.duration,420);
  assert.equal(r.loot.length,quantity);
  assert.equal(r.containers.find(c=>c.id===cache.id).contents.length,0,
   'opened cache cannot refill after reload');
  assert.ok(Math.abs(t.remaining()-remainingAtSave)<.01);
  t.togglePause();
  const outwardSeconds=r617Drive(t,basementLayout,outward.points,advance);
  assert.ok(Math.hypot(r.player.x-basementLayout.fixedExit.x,
   r.player.y-basementLayout.fixedExit.y)<8,'actual joystick reaches the B1 extraction');
  assert.ok(inwardSeconds+outwardSeconds<90,
   'no-combat walkthrough should fit well inside the 120s B1 time bonus');
  assert.ok(t.remaining()>0);
  assert.equal(t.validCheckpoint(t.snapshotRun()),true);
  t.bank();
  assert.equal(state.exploreLastResult.status,'escaped');
  assert.equal(received.length,quantity,'all B1 cache items banked');
  t.bank();
  assert.equal(received.length,quantity,'no duplicate reward on repeated exit');
 });
}



// R6.18: Unlike R6.17 movement-only smoke tests, this comparison keeps
// authored patrols, visual detection, chasing and attack logic ON.
// It is a controlled straight-running bot, not real-player survival data.
function r618LiveWalk(t,layout,waypoints,advance){
 const run=t.runRef(),dt=.04;
 let frames=0,alertFrames=0,nearFrames=0,hits=0,maxGuards=0;
 let previousHp=run.player.hp;
 for(let i=1;i<waypoints.length;i++){
  const waypoint=waypoints[i];let local=0;
  while(Math.hypot(run.player.x-waypoint.x,run.player.y-waypoint.y)>3.8){
   const dx=waypoint.x-run.player.x,dy=waypoint.y-run.player.y;
   run.joy=Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)};
   advance(40);t.tick(dt);frames++;local++;
   assert.equal(layout.solid(run.player.x,run.player.y,12),false,
    'B1 live-AI movement may not cross a wall');
   if(run.enemies.some(e=>['alert','chase','windup','recover'].includes(e.mode)))
    alertFrames++;
   if(run.enemies.some(e=>Math.hypot(e.x-run.player.x,e.y-run.player.y)<180))
    nearFrames++;
   if(run.player.hp<previousHp)hits++;
   previousHp=run.player.hp;
   maxGuards=Math.max(maxGuards,run.enemies.length);
   assert.ok(local<600,'live enemy benchmark got stuck at waypoint '+i);
   assert.ok(frames<15000,'live enemy benchmark exceeded finite frame budget');
   assert.equal(run.status,'playing','the particular fixed-seed sprint died before returning');
  }
 }
 run.joy={x:0,y:0};run.steer={x:0,y:0};
 return {seconds:+(frames*dt).toFixed(2),alertSeconds:+(alertFrames*dt).toFixed(2),
  nearSeconds:+(nearFrames*dt).toFixed(2),hits,maxGuards};
}
for(const routeName of ['central','northern']){
 test('R6.18 live B1 guards are simulated on '+routeName+' return without duplicating loot',async tctx=>{
  let now=1_000_000;
  const {t,layout,basementLayout,state,received}=await harness(()=>.3,{now:()=>now});
  const advance=ms=>{now+=ms};
  t.startRun();const run=t.runRef();
  run.player.x=layout.basementKey.x;run.player.y=layout.basementKey.y;
  assert.equal(t.useBasementInteraction(),true);
  run.player.x=layout.basementEntrance.x;run.player.y=layout.basementEntrance.y;
  assert.equal(t.useBasementInteraction(),true);
  assert.equal(run.undergroundEntered,true);
  assert.equal(run.pendingGuardPosts.length,9);
  const rare=basementLayout.authoredContainers.filter(c=>c.tier==='ultra')
   .sort((a,b)=>b.y-a.y)[0];
  const inbound=r618LiveWalk(t,basementLayout,
   r617Path(basementLayout,basementLayout.start,rare),advance);
  t.openContainer();
  const cache=run.containers.find(c=>c.id===run.lootOpenId);
  assert.ok(cache&&run.paused,'the heavy sentry must allow a timed opening window');
  const count=cache.contents.length;
  assert.ok(count>0);
  t.takeAllContainerItems({dataset:{container:cache.id,revision:String(run.lootOpenRevision||0)}});
  t.closeContainer();
  const route=ReturnRoutesR617.plan(basementLayout).routes.find(r=>r.id===routeName);
  assert.ok(route);
  const outbound=r618LiveWalk(t,basementLayout,route.points,advance);
  assert.ok(outbound.maxGuards>=1,'guard AI must remain active rather than being removed');
  assert.ok(outbound.alertSeconds>1,'the new heavy patrol must register actual combat attention');
  assert.ok(outbound.seconds>inbound.seconds*.7,'return path must be traversed, not teleported');
  assert.ok(t.remaining()>0);
  assert.equal(t.validCheckpoint(t.snapshotRun()),true);
  t.bank();assert.equal(state.exploreLastResult.status,'escaped');
  assert.equal(received.length,count);
  t.bank();assert.equal(received.length,count);
  tctx.diagnostic('B1 enemy-ON '+routeName+': '+JSON.stringify({inbound,outbound,
   routeTiles:route.steps,remainingSeconds:+t.remaining().toFixed(2)}));
 });
}


// R6.19: reproduce the exact movement/AI under cargo and differing guard phases.
// The synthetic cargo exists only in the test run, not in the shipped loot pool.
function r619MeasureReturn(t,layout,points,advance){
 const r=t.runRef(),dt=.04;
 let frames=0,alert=0,near=0,hits=0,lastHp=r.player.hp;
 let reached=0;
 for(let i=1;i<points.length;i++){
  let local=0;
  while(Math.hypot(points[i].x-r.player.x,points[i].y-r.player.y)>3.8){
   const dx=points[i].x-r.player.x,dy=points[i].y-r.player.y;
   r.joy=Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)};
   advance(40);t.tick(dt);frames++;local++;
   if(r.enemies.some(e=>['alert','chase','windup','recover'].includes(e.mode)))alert++;
   if(r.enemies.some(e=>Math.hypot(e.x-r.player.x,e.y-r.player.y)<180))near++;
   if(r.player.hp<lastHp)hits++;
   lastHp=r.player.hp;
   assert.equal(layout.solid(r.player.x,r.player.y,12),false,'R6.19 cargo route crosses wall');
   assert.ok(local<1100&&frames<15000,'R6.19 route stuck at waypoint '+i);
   if(r.status!=='playing'){
    r.joy={x:0,y:0};
    return {completed:false,seconds:+(frames*dt).toFixed(2),alertSeconds:+(alert*dt).toFixed(2),
     nearSeconds:+(near*dt).toFixed(2),hits,reached,reason:r.status};
   }
  }
  reached=i;
 }
 r.joy={x:0,y:0};r.steer={x:0,y:0};
 return {completed:true,seconds:+(frames*dt).toFixed(2),alertSeconds:+(alert*dt).toFixed(2),
  nearSeconds:+(near*dt).toFixed(2),hits,reached};
}
test('R6.19 cargo and guard-phase matrix uses live B1 AI and preserves cargo speed',async tctx=>{
 const matrix=[];
 for(const phase of [0,12]){
  for(const load of ['light','heavy']){
   for(const routeName of ['central','northern']){
    let now=1_000_000;
    const {t,layout,basementLayout}=await harness(()=>.3,{now:()=>now});
    const advance=ms=>{now+=ms};
    t.startRun();const r=t.runRef();
    r.player.x=layout.basementKey.x;r.player.y=layout.basementKey.y;
    assert.equal(t.useBasementInteraction(),true);
    r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
    assert.equal(t.useBasementInteraction(),true);
    const rare=basementLayout.authoredContainers.filter(c=>c.tier==='ultra')
     .sort((a,b)=>b.y-a.y)[0];
    // Controlled route start: keep all authored posts available, and advance AI
    // in place before setting the return waypoint to sample different patrol phases.
    r.player.x=rare.x;r.player.y=rare.y;
    for(let j=0;j<phase*25;j++){advance(40);t.tick(.04);if(r.status!=='playing')break;}
    assert.equal(r.status,'playing','pre-return guard phase killed stationary benchmark');
    if(load==='heavy'){
     const id='ITM-00002',weight=t.weightTenths(id),limit=Math.round(r.stats.weightLimit*10);
     assert.ok(weight>0);
     r.loot=Array.from({length:Math.ceil((limit+30)/weight)},(_,i)=>({id,q:0,tid:'r619-'+i}));
     assert.ok(t.v5CargoRisk().over>0,'heavy scenario exceeds actual carrying limit');
    }
    const factor=t.carrySpeedFactor(r.loot,r.stats.weightLimit);
    const route=ReturnRoutesR617.plan(basementLayout).routes.find(v=>v.id===routeName);
    const result=r619MeasureReturn(t,basementLayout,route.points,advance);
    matrix.push({phase,load,route:routeName,speedFactor:+factor.toFixed(3),...result});
    assert.ok(result.seconds>0);
    assert.ok(result.reached>0);
   }
  }
 }
 for(const phase of [0,12]){
  for(const route of ['central','northern']){
   const light=matrix.find(m=>m.phase===phase&&m.route===route&&m.load==='light');
   const heavy=matrix.find(m=>m.phase===phase&&m.route===route&&m.load==='heavy');
   assert.ok(heavy.speedFactor<light.speedFactor,'cargo must actually reduce movement speed');
   if(light.completed&&heavy.completed)assert.ok(heavy.seconds>light.seconds,
    'same route with heavier cargo must take longer');
  }
 }
 tctx.diagnostic('R6.19 B1 cargo x patrol-phase (synthetic): '+JSON.stringify(matrix));
});


// R6.20: actual sealed U08 rewards, no synthetic preloaded inventory.
// The pause-menu discard must change speed, preserve the protected item and
// survive a checkpoint restore before an AI-on northern extraction.
test('R6.20 sealed B1 cache loot -> manual discard -> restored northern escape',async tctx=>{
 let now=1_000_000;
 const {t,layout,basementLayout,state,received,gameWindow}=await harness(()=>.3,{now:()=>now});
 const advance=ms=>{now+=ms};
 t.startRun();const r=t.runRef();
 r.player.x=layout.basementKey.x;r.player.y=layout.basementKey.y;
 assert.equal(t.useBasementInteraction(),true);
 r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.useBasementInteraction(),true);
 const rare=basementLayout.authoredContainers.filter(c=>c.tier==='ultra')
  .sort((a,b)=>b.y-a.y)[0];
 r.player.x=rare.x;r.player.y=rare.y;
 t.openContainer();
 const cache=r.containers.find(c=>c.id===r.lootOpenId);
 assert.ok(cache&&cache.contents.length>0&&r.paused);
 const sealed=cache.contents.map(c=>({...c}));
 t.takeAllContainerItems({dataset:{container:cache.id,revision:String(r.lootOpenRevision||0)}});
 assert.equal(cache.contents.length,0);
 assert.equal(r.loot.length,sealed.length);
 t.closeContainer();
 const original=r.loot.map(v=>({...v}));
 const initial=t.v5CargoRisk();
 const keep=original.reduce((a,b)=>t.lootBaseValue(a)>=t.lootBaseValue(b)?a:b);
 gameWindow.explorationAction({dataset:{explore:'protect',i:String(r.loot.findIndex(v=>v.tid===keep.tid)),tid:String(keep.tid)}});
 assert.ok(r.safeIds.includes(keep.tid));
 // Reduce carrying capacity only in the test; rewards and item weights remain real.
 r.stats.weightLimit=Math.max(1,initial.weight/10-1);
 const before=t.v5CargoRisk();
 assert.ok(before.over>0,'actual cache must be overweight under test-only capacity');
 const candidates=r.loot.filter(v=>v.tid!==keep.tid).map(v=>({
  tid:v.tid,id:v.id,weight:t.weightTenths(v.id),value:t.lootBaseValue(v)
 })).sort((a,b)=>b.weight-a.weight);
 assert.ok(candidates.length>0,'need an unprotected actual reward to discard');
 const dropped=candidates[0],i=r.loot.findIndex(v=>v.tid===dropped.tid);
 const dropButton={dataset:{explore:'drop',i:String(i),tid:String(dropped.tid)}};
 gameWindow.explorationAction(dropButton);
 assert.ok(r.loot.some(v=>v.tid===dropped.tid),'first tap cannot lose real B1 reward');
 gameWindow.explorationAction(dropButton);
 assert.ok(!r.loot.some(v=>v.tid===dropped.tid));
 assert.ok(r.loot.some(v=>v.tid===keep.tid));
 assert.ok(r.safeIds.includes(keep.tid),'protected valuable item remains protected');
 const after=t.v5CargoRisk();
 assert.ok(after.weight<before.weight);
 assert.ok(after.pct>=before.pct,'discard must not slow the player');
 assert.equal(t.validCheckpoint(t.snapshotRun()),true);
 const snap=t.snapshotRun();
 state.exploreRun=snap;t.resetRun();t.restoreRunIfNeeded();
 const restored=t.runRef();
 assert.ok(restored&&restored.paused);
 assert.equal(restored.loot.length,original.length-1);
 assert.ok(restored.safeIds.includes(keep.tid));
 assert.equal(restored.containers.find(c=>c.id===cache.id).contents.length,0);
 t.togglePause();
 const route=ReturnRoutesR617.plan(basementLayout).routes.find(v=>v.id==='northern');
 const outcome=r619MeasureReturn(t,basementLayout,route.points,advance);
 assert.ok(outcome.reached>0);
 if(outcome.completed){
  t.bank();assert.equal(state.exploreLastResult.status,'escaped');
  assert.equal(received.length,original.length-1);
  t.bank();assert.equal(received.length,original.length-1);
 }
 tctx.diagnostic('R6.20 actual sealed loot discard: '+JSON.stringify({
  original:original.length,initialWeight:initial.weight,before,after,
  discardedId:dropped.id,keptProtected:keep.id,outcome
 }));
});


// R6.21: ordinary V5 loot is not destroyed by a stray mobile thumb press.
// Confirmation expires, is item-bound, and does not change the raid format.
test('R6.21 V5 bag discard needs two taps on the same item within four seconds',async()=>{
 let now=1_000_000;
 const {t,gameWindow}=await harness(()=>.5,{now:()=>now});
 t.startRun();const r=t.runRef();
 r.loot=[{id:'ITM-00002',q:0,tid:1},{id:'ITM-00003',q:1,tid:2}];
 r.lootSerial=3;r.safeIds=[];
 assert.match(t.lootRowsV5(),/aria-label="家電製品を捨てる（確認が必要）">捨てる/);
 const button={dataset:{explore:'drop',i:'0',tid:'1'},textContent:'捨てる',setAttribute(){}};
 gameWindow.explorationAction(button);
 assert.equal(r.loot.length,2,'first tap must never discard');
 assert.equal(button.textContent,'確認');
 assert.equal(button.dataset.confirm,'true');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 now+=4100;
 gameWindow.explorationAction(button);
 assert.equal(r.loot.length,2,'expired confirmation cannot discard');
 gameWindow.explorationAction(button);
 assert.deepEqual(r.loot.map(v=>v.tid),[2],'second timely tap discards only that item');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('R6.21 stale V5 bag token cannot arm another item; protected item stays confirmed',async()=>{
 let now=2_000_000;
 const {t,gameWindow}=await harness(()=>.5,{now:()=>now});
 t.startRun();const r=t.runRef();
 r.loot=[{id:'ITM-00003',q:1,tid:5},{id:'ITM-00002',q:0,tid:6}];
 r.lootSerial=7;r.safeIds=[5];
 const stale={dataset:{explore:'drop',i:'1',tid:'5'},textContent:'捨てる'};
 gameWindow.explorationAction(stale);
 assert.equal(stale.dataset.confirm,undefined);
 assert.deepEqual(r.loot.map(v=>v.tid),[5,6]);
 const protectedButton={dataset:{explore:'drop',i:'0',tid:'5'}};
 gameWindow.explorationAction(protectedButton);
 assert.deepEqual(r.loot.map(v=>v.tid),[6],
  'existing protected-item native confirmation remains unchanged');
 assert.deepEqual(r.safeIds,[]);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
