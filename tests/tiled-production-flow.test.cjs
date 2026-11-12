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
 const documentEvents=new Map(),windowEvents=new Map(),rafQueue=[];
 const document={body:{classList:{add(){},remove(){},toggle(){}},addEventListener:(name,handler)=>documentEvents.set('body:'+name,handler)},
  getElementById:id=>dom.get(id)||null,querySelector:selector=>dom.get(selector)||null,
  addEventListener:(name,handler)=>documentEvents.set(name,handler),hidden:false};
 const window={TreasureMallLayout:Mall,TreasureMallLayoutV3:MallV3,TreasureFacilityLayoutV4:MallV4,
  TreasureIndoorLayoutV5:{load:()=>Promise.resolve(layout),loadBasement:()=>Promise.resolve(basementLayout)},TreasureReturnRoutes:require('../map-return-routes.js'),TreasureCombatRules:Combat,
  TreasureEquipmentPilot:Equipment,TreasureMapItem:MapItem,
  crypto:{randomUUID:()=>String(Math.random()).slice(2)},confirm:()=>true,
  addEventListener:(name,handler)=>windowEvents.set(name,handler),
  visualViewport:{addEventListener:(name,handler)=>windowEvents.set('visualViewport:'+name,handler)}};
 let sourceGame=read('exploration.js');
 const end=sourceGame.lastIndexOf('})();');
 assert.ok(end>0);
 sourceGame=sourceGame.slice(0,end)+
  'window.__v5test={startRun,runRef:()=>run,v5ExitDirection,v5BasementReturnChoices,v5BasementCurrentRoute,v5ExtractionDecision,v5ExtractionDecisionHTML,setB1RouteView:mode=>{v5B1RouteView=mode},v5ObjectiveText,v5IntroCoachHint,v5BagLossPreview,v5BagLossNote,v5GearPanelHTML,v5RestrictedCachePressure,v5RoomSupplyLedger,v5RoomLedgerHTML,v5ApproachPlans,v5ApproachChoicesHTML,nearBasementKey,nearBasementDoor,enterBasement,useBasementInteraction,takeAllContainerItems,startV5Search,updateV5Search,v5SearchProbe,facilityVisionContour,resetRun:()=>{run=null},snapshotRun,restoreRunIfNeeded,validCheckpoint,openContainer,takeContainerItem,closeContainer,bank,lose,exitPoint,restoreEnemy,enemyDefinition,enemyPatrol,updateEnemy,enemyHitPlayer,performAttack,facilityCanSeePlayer,facilityVisionClear,stealthSituation,v5InHidingAlcove,updateHUD,contents,facilityNoticeReady,facilityNoticeThreshold,facilityPursuitSpeed,enemyMoveTowards,tick,advanceRaidFrame,V5_SUPPLY_WEIGHTS,v5SsrPlusPercent,v5CacheGrade,v5CacheReveal,containerReward,facilityPreviewPanel,setPreviewVariant:v=>facilityPreviewVariant=v,mapPanel,v5FacilityPlanSvg,hasDetailedMap,lootBaseValue,lootBaseTotal,lootSummary,lootOrder,lootRowsV5,lootSortControls,lootAutoProtectButton,weightLabel,carrySpeedFactor,v5CargoRisk,v5ReturnRisk,v5JettisonAdvice,v5JettisonAdviceHTML,v5JettisonReturnDistance,v5PickupReturnImpact,v5ExtractionStakes,pausePanel,v5SessionDiagnosticReport,lastExploreReportHTML,weightTenths,solid,useVaultInteraction,sealVaultOnEntry,nearVaultKeycard,nearVaultGate,nearVaultHatch,reconcileIndoorCheckpoint,activateFacilityGuardPosts,v5AlarmVisual,bindStick,bindMultiTouchActions,syncV5Chrome,resizeField,viewSize:()=>({...VIEW}),remaining,togglePause,sampleFrame,perf,lastFrameRef:()=>lastFrame,setLastFrame:value=>{lastFrame=value},settleV5OverlayAfterViewportChange,refreshAfterPhoneRotation};'+sourceGame.slice(end);
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
  'esc','cancelAnimationFrame','receive','markDelete','Math','active','Date','requestAnimationFrame',sourceGame)(...deps,
  Object.assign(Object.create(Math),randomOverride?{random:randomOverride}:{}),'explore',clock||Date,
  callback=>{rafQueue.push(callback);return rafQueue.length});
 await Promise.resolve();
 return {t:window.__v5test,layout,basementLayout,state,received,dom,document,documentEvents,windowEvents,
  gameWindow:window,rafQueue,itemRarity:id=>itemMap.get(id)?.rarity,renderCount:()=>renders};
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
 assert.ok(read('index.html').includes('exploration.js?v=R6.28'));
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
 assert.equal(banner.dataset.risk,'none');
 assert.match(banner.textContent,/出口の直線方向/);
 assert.equal(banner.dataset.direction,'true');
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
 assert.match(html,/exploration\.css\?v=R6\.28/);
 assert.match(html,/exploration\.js\?v=R6\.28/);
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
 assert.match(panel,/1Fの帰還下限は出口までの直線距離/);
 assert.match(panel,/敵の巡回・戦闘・曲がり角での操作時間は含みません/);
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
 assert.ok(read('index.html').includes('exploration.js?v=R6.28'));
 assert.ok(read('index.html').includes('exploration.css?v=R6.28'));
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
 assert.match(html,/exploration\.js\?v=R6\.28/);
 assert.match(html,/exploration\.css\?v=R6\.28/);
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
 assert.match(read('index.html'),/exploration\.js\?v=R6\.28/);
 assert.match(read('index.html'),/exploration\.css\?v=R6\.28/);
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
 assert.match(read('index.html'),/exploration\.js\?v=R6\.28/);
 assert.match(read('index.html'),/exploration\.css\?v=R6\.28/);
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
 assert.match(html,/exploration\.js\?v=R6\.28/);
 assert.match(html,/exploration\.css\?v=R6\.28/);
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
 assert.match(html,/exploration\.js\?v=R6\.28/);
 assert.match(html,/exploration-layout-v5\.js\?v=R6\.18/);
 assert.match(html,/exploration\.css\?v=R6\.28/);
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
function r619MeasureReturn(t,layout,points,advance,onFrame=null){
 const r=t.runRef(),dt=.04;
 let frames=0,alert=0,near=0,hits=0,lastHp=r.player.hp;
 let reached=0;
 for(let i=1;i<points.length;i++){
  let local=0;
  while(Math.hypot(points[i].x-r.player.x,points[i].y-r.player.y)>3.8){
   const dx=points[i].x-r.player.x,dy=points[i].y-r.player.y;
   r.joy=Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx),y:0}:{x:0,y:Math.sign(dy)};
   advance(40);t.tick(dt);frames++;local++;
   if(onFrame&&r.status==='playing')onFrame(r,frames);
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


// R6.22: briefing is part of the ordinary pre-sortie render, never a
// blocking tutorial or a new saved raid field. V4 keeps its old presentation.
test('R6.22 V5 new player sees three clear actions without blocking sortie',async()=>{
 const {t,gameWindow,state}=await harness(()=>.4);
 const before=JSON.stringify({equip:state.exploreEquip,inv:state.inv,save:state.exploreRun});
 const html=t.contents();
 assert.match(html,/class="exp-sortie-guide"/);
 assert.match(html,/id="exp-sortie-guide-title"/);
 assert.match(html,/装備なしでも出撃できます/);
 assert.match(html,/左下をタッチして移動/);
 assert.match(html,/右下の「調べる」/);
 assert.match(html,/バッグで大切な財宝を最大2点保護/);
 assert.match(html,/地下は任意の高リスクエリア/);
 assert.match(html,/<details class="exp-rules-details"><summary>/);
 assert.match(html,/<details class="exp-guide-tools"><summary>/);
 assert.ok(html.indexOf('exp-sortie-guide')<html.indexOf('exp-loadout'),
  'the first instructions must appear before 7 equipment slots');
 assert.match(html,/data-explore="preview-map"/);
 assert.match(html,/data-explore="start"/);
 assert.equal(JSON.stringify({equip:state.exploreEquip,inv:state.inv,save:state.exploreRun}),before,
  'reading the guide may not mutate saves or equipment');
 gameWindow.explorationAction({dataset:{explore:'start'}});
 assert.equal(t.runRef().mapVersion,5,'no equipment or tutorial completion required');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.equal(Object.hasOwn(t.snapshotRun(),'tutorial'),false);
});
test('R6.22 V4 old sortie remains guide-free while V5 advanced links stay accessible',async()=>{
 const {t,gameWindow}=await harness(()=>.4);
 gameWindow.explorationAction({dataset:{explore:'layout-classic'}});
 const old=t.contents();
 assert.doesNotMatch(old,/class="exp-sortie-guide"/);
 assert.doesNotMatch(old,/class="exp-rules-details"/);
 assert.match(old,/7枠装備を選ぶ/);
 gameWindow.explorationAction({dataset:{explore:'layout-tiled'}});
 const v5=t.contents();
 assert.match(v5,/class="exp-sortie-guide"/);
 assert.match(v5,/href="map-inspector.html\?floor=1f"/);
 assert.match(v5,/href="maps\/indoor\/demo.html"/);
 assert.ok(v5.indexOf('exp-sortie-guide')<v5.indexOf('exp-guide-tools'));
 assert.ok(v5.indexOf('exp-guide-tools')<v5.indexOf('exp-loadout'));
 const css=read('exploration.css');
 assert.match(css,/R6\.22: briefing first/);
 assert.match(css,/\.exp-rules-details>summary,.exp-guide-tools>summary\{[^}]*min-height:44px/);
});


// R6.23: inspect real new-run state and HUD without assuming actual device taps.
test('R6.23 new V5 sortie teaches movement, nearby loot and extraction without extra HUD',async()=>{
 let now=1_000_000;
 const {t,layout,dom}=await harness(()=>.3,{now:()=>now});
 const toast={dataset:{},textContent:''};
 dom.set('exp-action-toast',toast);
 t.startRun();const r=t.runRef();
 assert.equal(r.mapVersion,5);
 assert.ok(r.introCoach);
 assert.match(t.v5IntroCoachHint(),/左下をタッチして移動/);
 const before=t.snapshotRun();
 assert.equal(Object.hasOwn(before,'introCoach'),false,'coaching cannot change checkpoint format');
 now+=3000;t.updateHUD(true);
 assert.equal(toast.dataset.active,'true');
 assert.equal(toast.dataset.guide,'true');
 assert.match(toast.textContent,/左下をタッチして移動/);
 const cache=r.containers.find(c=>c.contents.length);
 assert.ok(cache);
 r.player.x=cache.x;r.player.y=cache.y;
 t.updateHUD(true);
 assert.match(toast.textContent,/右下「調べる」で開封/);
 assert.equal(r.loot.length,0,'guidance must never collect or create loot');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 r.player.x=layout.start.x;r.player.y=layout.start.y;
 now+=18000;t.updateHUD(true);
 assert.equal(t.v5IntroCoachHint(),'','intro hints expire after 20 active seconds');
 assert.equal(toast.dataset.active,'false');
 assert.equal(toast.dataset.guide,'false');
});
test('R6.23 first loot guidance respects notifications, combat, bag, pause and restore',async()=>{
 let now=2_000_000;
 const {t,dom,state,gameWindow}=await harness(()=>.4,{now:()=>now});
 const toast={dataset:{},textContent:''};
 dom.set('exp-action-toast',toast);
 t.startRun();const r=t.runRef();
 r.enemies=[];r.pendingGuardPosts=[];
 const cache=r.containers.find(c=>c.contents.length);
 r.player.x=cache.x;r.player.y=cache.y;
 t.openContainer();assert.ok(r.paused);
 t.takeContainerItem({dataset:{container:cache.id,i:'0'}});
 assert.ok(r.loot.length>0);
 assert.equal(t.v5IntroCoachHint(),'','no hints while container is open');
 t.closeContainer();assert.equal(r.paused,false);
 t.updateHUD(true);
 assert.match(t.v5IntroCoachHint(),/バッグで最大2点保護/);
 now+=3000;t.updateHUD(true);
 assert.equal(toast.dataset.guide,'true');
 assert.match(toast.textContent,/出口で「脱出する」/);
 // A normal notice is more important than onboarding.
 r.message='実際の操作通知';r.messageUntil=now+2000;t.updateHUD(true);
 assert.equal(toast.dataset.guide,'false');
 assert.equal(toast.textContent,'実際の操作通知');
 // Even after notification, an open backpack hides the guide.
 r.messageUntil=0;
 const bag={classList:{open:false,toggle(v){this.open=!this.open;return this.open},
  contains(v){return this.open},remove(v){this.open=false}}};
 dom.set('exp-backpack',bag);
 gameWindow.explorationAction({dataset:{explore:'bag'}});
 assert.equal(bag.classList.open,true);
 assert.equal(toast.dataset.active,'false');
 gameWindow.explorationAction({dataset:{explore:'bag-close'}});
 assert.equal(toast.dataset.guide,'true');
 r.enemies=[{mode:'chase'}];t.updateHUD(true);
 assert.equal(toast.dataset.active,'false','combat takes priority over tips');
 r.enemies=[];t.togglePause();assert.equal(toast.dataset.active,'false');
 t.togglePause();
 now+=10000;t.updateHUD(true);
 assert.equal(toast.dataset.active,'false','first loot tip expires');
 const saved=t.snapshotRun();
 assert.equal(Object.hasOwn(saved,'introCoach'),false);
 state.exploreRun=saved;t.resetRun();t.restoreRunIfNeeded();
 const restored=t.runRef();
 assert.ok(restored.paused);
 assert.equal(restored.introCoach,undefined);
 t.togglePause();assert.equal(t.v5IntroCoachHint(),'','restore never restarts onboarding');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('R6.23 old V4 uses no first-sortie coach and CSS keeps thumb controls clear',async()=>{
 const {t,gameWindow}=await harness(()=>.7);
 gameWindow.explorationAction({dataset:{explore:'layout-classic'}});
 t.startRun();assert.equal(t.runRef().mapVersion,4);
 assert.equal(t.v5IntroCoachHint(),'');
 assert.equal(Object.hasOwn(t.snapshotRun(),'introCoach'),false);
 const css=read('exploration.css');
 assert.match(css,/R6\.23: short, touch-transparent coaching/);
 assert.match(css,/\.exp-action-toast\[data-guide="true"\]\{[^}]*pointer-events:none!important/);
 const html=t.contents();assert.doesNotMatch(html,/data-guide="true"/);
});


// R6.24: return orientation is derived from the actual current-floor exit,
// never a guessed route through walls, patrols or hatch shutters.
test('R6.24 1F exit hint uses the real Tiled exit and prioritizes final interaction',async()=>{
 let now=1_000_000;
 const {t,layout,dom,state}=await harness(()=>.3,{now:()=>now});
 const objective={textContent:''},risk={textContent:'',dataset:{}};
 dom.set('exp-vault-objective',objective);dom.set('exp-extraction-stakes',risk);
 t.startRun();const run=t.runRef();
 const initial=t.v5ExitDirection();
 assert.equal(initial.floor,'1F出口');
 assert.equal(initial.near,false);
 assert.ok(initial.distancePx>58);
 assert.match(initial.detail,/直線/);
 assert.match(initial.detail,/壁・シャッター・警備を考慮しない/);
 assert.match(t.mapPanel(),/exp-map-exit-guide/);
 assert.match(t.mapPanel(),/緑の印がこの階の実際の出口/);
 run.loot=[{id:'ITM-00002',q:0,tid:99}];run.lootSerial=100;
 t.updateHUD(true);
 assert.match(risk.textContent,/出口の直線方向：1F出口/);
 assert.equal(risk.dataset.risk,'none');
 assert.equal(risk.dataset.direction,'true');
 run.player.x=layout.fixedExit.x;run.player.y=layout.fixedExit.y;
 t.updateHUD(true);
 assert.equal(t.v5ExitDirection().near,true);
 assert.match(objective.textContent,/脱出口に到着：右下「脱出する」/);
 assert.match(risk.textContent,/脱出口に到着/);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.equal(Object.hasOwn(t.snapshotRun(),'exitDirection'),false);
 now=run.start+270000;run.player.x=layout.start.x;run.player.y=layout.start.y;
 t.updateHUD(true);
 assert.match(objective.textContent,/帰還優先/);
 assert.match(objective.textContent,/経路は詳細地図/);
 assert.equal(state.exploreRun?.mapVersion,5);
});
test('R6.24 sealed vault warns of hatch before exit; alarm keeps route progress',async()=>{
 const {t,layout,dom}=await harness(()=>.1);
 const objective={textContent:''};dom.set('exp-vault-objective',objective);
 t.startRun();const run=t.runRef();
 run.vaultSealed=true;run.vaultEntered=true;
 run.player.x=layout.vaultHatch.x;run.player.y=layout.vaultHatch.y;
 assert.equal(t.v5ExitDirection().blocked,true);
 assert.match(t.v5ExitDirection().detail,/非常ハッチ/);
 assert.match(t.mapPanel(),/非常ハッチから警報下の帰路/);
 t.updateHUD(true);
 assert.match(objective.textContent,/入口封鎖：非常ハッチ/);
 run.vaultHatchUsed=true;run.vaultAlarm=true;
 const route=layout.escapeRoute;
 run.player.x=route[0].x;run.player.y=route[0].y;
 t.updateHUD(true);
 assert.match(objective.textContent,/帰還路約0%/);
 run.player.x=route[route.length-1].x;run.player.y=route[route.length-1].y;
 t.updateHUD(true);
 assert.match(objective.textContent,/帰還路約100%/);
 assert.match(objective.textContent,/脱出口に到着/);
});
test('R6.24 B1 direction targets underground exit; legacy V4 and saves stay untouched',async()=>{
 const {t,layout,basementLayout,gameWindow,state}=await harness(()=>.2);
 t.startRun();const r=t.runRef();
 r.player.x=layout.basementKey.x;r.player.y=layout.basementKey.y;
 assert.equal(t.useBasementInteraction(),true);
 r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.useBasementInteraction(),true);
 assert.equal(r.undergroundEntered,true);
 const guide=t.v5ExitDirection();
 assert.equal(guide.floor,'B1専用出口');
 assert.equal(guide.near,false);
 assert.ok(Math.abs(guide.distancePx-Math.hypot(basementLayout.fixedExit.x-r.player.x,
  basementLayout.fixedExit.y-r.player.y))<.01);
 const map=t.mapPanel();
 assert.match(map,/exp-map-exit-guide/);
 assert.match(map,/B1専用出口/);
 assert.ok(map.includes('cx="'+basementLayout.fixedExit.x+'" cy="'+basementLayout.fixedExit.y+'"'),
  'underground map must mark the real basement exit');
 const before=t.snapshotRun();
 assert.equal(Object.hasOwn(before,'exitDirection'),false);
 state.exploreRun=before;t.resetRun();t.restoreRunIfNeeded();
 assert.equal(t.v5ExitDirection().floor,'B1専用出口');
 assert.equal(t.validCheckpoint(t.snapshotRun()),true);
 const legacy=await harness(()=>.2);
 legacy.gameWindow.explorationAction({dataset:{explore:'layout-classic'}});
 legacy.t.startRun();
 assert.equal(legacy.t.runRef().mapVersion,4);
 assert.equal(legacy.t.v5ExitDirection(),null);
 assert.equal(legacy.t.v5ObjectiveText(),'');
 assert.doesNotMatch(legacy.t.mapPanel(),/exp-map-exit-guide/);
});


// R6.30: audible cache inspection is finite, uses only authored high/ultra
// cache coordinates, and survives checkpoints via existing enemy search fields.
function r630PatrolNear(t,layout,cache,offset){
 const x=cache.x+offset<=layout.w-24?cache.x+offset:cache.x-offset;
 const y=cache.y;
 const def=t.enemyDefinition('normal');
 return t.restoreEnemy({x,y,kind:'normal',hp:def.hp,mode:'patrol',
  homeX:x,homeY:y,facingX:1,facingY:0,attackAt:99,lastSeen:-999});
}
test('R6.30 high cache pickup draws one nearby idle guard to cache, never live player, and restores safely',async()=>{
 const {t,layout,state}=await harness(()=>.9);
 t.startRun();const r=t.runRef();
 const cache=r.containers.find(c=>layout.supplyTierForContainer(c)==='high'&&c.contents.length);
 assert.ok(cache,'actual purple Tiled cache has sealed reward');
 const near=r630PatrolNear(t,layout,cache,72);
 const far=t.restoreEnemy({x:cache.x<layout.w/2?layout.w-24:24,
  y:cache.y<layout.h/2?layout.h-24:24,kind:'normal',
  hp:t.enemyDefinition('normal').hp,mode:'patrol',homeX:24,homeY:24,
  facingX:1,facingY:0,attackAt:99,lastSeen:-999});
 assert.ok(Math.hypot(far.x-cache.x,far.y-cache.y)>340);
 r.enemies=[near,far];r.pendingGuardPosts=[];r.player.x=cache.x;r.player.y=cache.y;
 const initialEnemies=r.enemies.length,initialContents=cache.contents.length;
 t.openContainer();assert.equal(r.lootOpenId,cache.id);
 assert.equal(r.paused,true,'inspection begins only upon successful pickup, not opening menu');
 assert.equal(near.mode,'patrol');
 assert.match(t.pausePanel(),/回収地点を調査する場合があります/);
 t.takeContainerItem({dataset:{container:cache.id,i:'0'}});
 assert.equal(cache.contents.length,initialContents-1);
 assert.equal(r.loot.length,1);
 assert.equal(r.enemies.length,initialEnemies,'no spawned guards');
 assert.equal(near.mode,'search','idle guard must investigate physical noise');
 assert.equal(near.lastX,cache.x);
 assert.equal(near.lastY,cache.y);
 assert.equal(near.lastSeen,-999,'audible noise is NOT visual player detection');
 assert.equal(near.notice,0);
 assert.equal(near.attackAt,99,'no instant attack permission');
 assert.equal(far.mode,'patrol','out-of-earshot patrol keeps original route');
 assert.equal(r.player.x,cache.x);
 assert.equal(r.player.y,cache.y);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.equal(Object.hasOwn(t.snapshotRun(),'cacheNoiseNote'),false);
 const frozenEnd=near.searchUntil;
 t.closeContainer();
 assert.equal(r.paused,false);
 assert.match(r.message,/回収音に反応/);
 assert.equal(near.searchUntil,frozenEnd,'resuming does not duplicate search');
 const saved=t.snapshotRun();
 state.exploreRun=saved;t.resetRun();t.restoreRunIfNeeded();
 const restored=t.runRef();
 assert.ok(restored.paused);
 const scout=restored.enemies.find(e=>e.mode==='search');
 assert.ok(scout);
 assert.equal(scout.lastX,cache.x);
 assert.equal(scout.lastY,cache.y);
 assert.equal(scout.searchUntil,frozenEnd,'bounded search survives checkpoint');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('R6.30 normal pickup and already-open high cache never cause a second noise investigation',async()=>{
 const {t,layout}=await harness(()=>.9);
 t.startRun();const r=t.runRef();
 const ordinary=r.containers.find(c=>!['high','ultra'].includes(layout.supplyTierForContainer(c))&&c.contents.length);
 const high=r.containers.find(c=>layout.supplyTierForContainer(c)==='high'&&c.contents.length);
 assert.ok(ordinary&&high);
 const guard=r630PatrolNear(t,layout,ordinary,70);
 r.enemies=[guard];r.pendingGuardPosts=[];
 r.player.x=ordinary.x;r.player.y=ordinary.y;
 t.openContainer();assert.equal(r.lootOpenId,ordinary.id);
 t.takeContainerItem({dataset:{container:ordinary.id,i:'0'}});
 assert.equal(guard.mode,'patrol','ordinary items are quiet');
 t.closeContainer();
 assert.doesNotMatch(r.message,/回収音に反応/);
 // A cache can be opened yet retain sealed contents; subsequent pickup is quiet.
 high.opened=true;
 guard.x=high.x+60<=layout.w-24?high.x+60:high.x-60;
 guard.y=high.y;guard.homeX=guard.x;guard.homeY=guard.y;
 r.player.x=high.x;r.player.y=high.y;
 t.openContainer();assert.equal(r.lootOpenId,high.id);
 t.takeContainerItem({dataset:{container:high.id,i:'0'}});
 assert.equal(guard.mode,'patrol','only first actual pickup may cause inspection');
 assert.equal(r.cacheNoiseNote,undefined);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
test('R6.30 red-gold batch pickup has longer 340px hearing radius but no extra spawns',async()=>{
 const {t,layout}=await harness(()=>.9);
 t.startRun();const r=t.runRef();
 const ultra=r.containers.find(c=>layout.supplyTierForContainer(c)==='ultra'&&c.contents.length);
 assert.ok(ultra,'actual ultra Tiled cache must contain sealed loot');
 const guard=r630PatrolNear(t,layout,ultra,310);
 assert.ok(Math.hypot(guard.x-ultra.x,guard.y-ultra.y)<=340);
 assert.ok(Math.hypot(guard.x-ultra.x,guard.y-ultra.y)>270);
 r.enemies=[guard];r.pendingGuardPosts=[];
 r.player.x=ultra.x;r.player.y=ultra.y;
 const sealed=ultra.contents.map(c=>({...c}));
 t.openContainer();assert.equal(r.lootOpenId,ultra.id);
 t.takeAllContainerItems({dataset:{container:ultra.id}});
 assert.equal(ultra.contents.length,0);
 assert.equal(r.loot.length,sealed.length,'all loot is preserved without rerolls');
 assert.equal(guard.mode,'search','nearby patrol hears red-gold cache');
 assert.equal(r.enemies.length,1);
 assert.equal(guard.lastX,ultra.x);
 assert.equal(guard.lastY,ultra.y);
 assert.equal(guard.lastSeen,-999);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 t.closeContainer();
 assert.match(r.message,/回収音に反応/);
 assert.equal(r.enemies.length,1);
});


// R6.31: the preview follows the SAME B1 Tiled passability as the audit
// routes; its travel seconds are theoretical movement bounds, NOT a live ETA.
test('R6.31 underground detailed map compares two real Tiled return routes without overlaying controls',async()=>{
 const {t,layout,basementLayout}=await harness(()=>.31);
 t.startRun();const r=t.runRef();
 assert.equal(t.v5BasementReturnChoices(),null,'surface map has no B1-only overlay');
 assert.doesNotMatch(t.mapPanel(),/exp-b1-return-guide/);
 assert.doesNotMatch(t.v5FacilityPlanSvg(basementLayout,null),/data-b1-route/,'pre-sortie map stays unchanged');
 r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 assert.equal(r.undergroundEntered,true);
 const choices=t.v5BasementReturnChoices();
 assert.ok(choices);
 const plan=ReturnRoutesR617.plan(basementLayout);
 assert.equal(plan.complete,true);
 assert.deepEqual(choices.routes.map(q=>[q.id,q.steps]),plan.routes.map(q=>[q.id,q.steps]));
 assert.deepEqual(choices.routes.map(q=>q.steps),[41,63],'central is shorter than northern by actual passability');
 for(const route of choices.routes){
  assert.ok(route.secondsAtCurrentLoad>0);
  assert.ok(Number.isInteger(route.nearbyPosts)&&route.nearbyPosts>=0&&route.nearbyPosts<=basementLayout.guardPosts.length);
  assert.deepEqual(route.points,plan.routes.find(q=>q.id===route.id).points);
 }
 t.setB1RouteView('compare'); // R6.31's original two-branch comparison now lives behind a map-only switch.
 const html=t.mapPanel();
 assert.match(html,/exp-b1-return-guide/);
 assert.match(html,/41タイル/);
 assert.match(html,/63タイル/);
 assert.match(html,/data-b1-route="central"/);
 assert.match(html,/data-b1-route="northern"/);
 assert.match(html,/赤金保管地点/);
 assert.match(html,/現在地からの最短案内ではありません/);
 assert.match(html,/敵の巡回位置・索敵/);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 const snapshot=t.snapshotRun();
 assert.equal(Object.hasOwn(snapshot,'returnRoute'),false,'route comparison is display only');
 assert.equal(Object.hasOwn(snapshot,'routeEstimate'),false);
});

test('R6.31 heavier recovered cargo lengthens both route lower bounds and survives checkpoint reload',async()=>{
 const {t,layout,basementLayout,state}=await harness(()=>.31);
 t.startRun();const r=t.runRef();
 r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 const before=t.v5BasementReturnChoices(),baseSpeed=before.cargo.pct;
 const rare=basementLayout.authoredContainers.filter(c=>c.tier==='ultra').sort((a,b)=>b.y-a.y)[0];
 r.player.x=rare.x;r.player.y=rare.y;
 t.openContainer();
 assert.equal(r.paused,true);
 const chest=r.containers.find(c=>c.id===r.lootOpenId);
 assert.ok(chest&&chest.contents.length);
 const original=chest.contents.map(v=>({...v}));
 t.takeAllContainerItems({dataset:{container:chest.id,revision:String(r.lootOpenRevision||0)}});
 assert.equal(r.loot.length,original.length);
 t.closeContainer();
 r.stats.weightLimit=Math.max(1,t.v5CargoRisk().weight/10-2.5); // test-only heavy load
 const heavier=t.v5BasementReturnChoices();
 assert.ok(heavier.cargo.pct<baseSpeed,'actual sealed B1 loot and test-only smaller bag limit affect speed');
 for(let i=0;i<2;i++)assert.ok(heavier.routes[i].secondsAtCurrentLoad>before.routes[i].secondsAtCurrentLoad,
  'both branches must become slower under increased load');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 const saved=t.snapshotRun();
 state.exploreRun=saved;t.resetRun();t.restoreRunIfNeeded();
 assert.ok(t.runRef().paused);
 const restored=t.v5BasementReturnChoices();
 assert.deepEqual(restored.routes.map(v=>v.secondsAtCurrentLoad),heavier.routes.map(v=>v.secondsAtCurrentLoad));
 assert.deepEqual(restored.routes.map(v=>v.nearbyPosts),heavier.routes.map(v=>v.nearbyPosts));
 assert.equal(t.runRef().loot.length,original.length);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.31 multiple sealed-loot seeds compare B1 patrol-on escapes for both cargo loads',async tctx=>{
 const readings=[];
 for(const seed of [.23,.73]){
  for(const load of ['normal','heavy']){
   for(const routeId of ['central','northern']){
    let now=1_000_000;
    const {t,layout,basementLayout}=await harness(()=>seed,{now:()=>now});
    const advance=ms=>{now+=ms};
    t.startRun();const r=t.runRef();
    r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
    assert.equal(t.enterBasement(),true);
    const rare=basementLayout.authoredContainers.filter(c=>c.tier==='ultra').sort((a,b)=>b.y-a.y)[0];
    r.player.x=rare.x;r.player.y=rare.y;
    t.activateFacilityGuardPosts(); // retain live, Tiled-authored patrols
    t.openContainer();
    assert.equal(r.paused,true,'controlled cache must be reachable before return test');
    const chest=r.containers.find(c=>c.id===r.lootOpenId);
    assert.ok(chest&&chest.contents.length);
    t.takeAllContainerItems({dataset:{container:chest.id,revision:String(r.lootOpenRevision||0)}});
    t.closeContainer();
    assert.ok(r.loot.length>=2,'use actual sealed U08 items, not synthetic earnings');
    if(load==='heavy')r.stats.weightLimit=Math.max(1,t.v5CargoRisk().weight/10-2.5);
    const factor=t.carrySpeedFactor(r.loot,r.stats.weightLimit);
    const route=ReturnRoutesR617.plan(basementLayout).routes.find(x=>x.id===routeId);
    assert.ok(route);
    const result=r619MeasureReturn(t,basementLayout,route.points,advance);
    readings.push({seed,load,route:routeId,weightKg:t.v5CargoRisk().weight/10,
     speedFactor:Number(factor.toFixed(3)),guardsAtEnd:r.enemies.length,...result});
    assert.ok(result.seconds>0,'real AI and collision must be simulated for some duration');
    assert.ok(result.reached>0,'player must make progress');
   }
  }
 }
 for(const seed of [.23,.73])for(const routeId of ['central','northern']){
  const normal=readings.find(v=>v.seed===seed&&v.route===routeId&&v.load==='normal');
  const heavy=readings.find(v=>v.seed===seed&&v.route===routeId&&v.load==='heavy');
  assert.ok(heavy.speedFactor<normal.speedFactor,'more cargo cannot be faster');
  if(normal.completed&&heavy.completed)assert.ok(heavy.seconds>normal.seconds,
   'same route with heavier load must take longer');
 }
 tctx.diagnostic('R6.31 B1 real sealed loot / cargo / patrol AI matrix: '+JSON.stringify(readings));
});


// R6.32 adds an ACTUAL current-player-tile shortest path, separate from
// R6.31's two historical red-gold-origin routes. It never sees live guards.
test('R6.32 current-position B1 path uses only real Tiled walkable four-neighbour cells',async()=>{
 const {layout,basementLayout}=await harness(()=>.21);
 const routes=require('../map-return-routes.js');
 assert.equal(routes.planFrom(layout,layout.start),null,'1F cannot ask the B1 planner');
 const rare=basementLayout.authoredContainers.filter(c=>c.tier==='ultra').sort((a,b)=>b.y-a.y)[0];
 const live=routes.planFrom(basementLayout,{x:rare.x,y:rare.y});
 assert.ok(live);
 assert.equal(live.steps,41,'shortest red-gold-origin path equals the 41-tile central option');
 assert.equal(live.points.length,live.steps+1);
 assert.equal(live.cells.length,live.points.length);
 assert.equal(live.points[0].x,Math.floor(rare.x/48)*48+24);
 assert.equal(live.points[0].y,Math.floor(rare.y/48)*48+24);
 assert.deepEqual(live.exit,{x:basementLayout.fixedExit.x,y:basementLayout.fixedExit.y});
 for(let i=0;i<live.points.length;i++){
  const p=live.points[i];
  assert.equal(basementLayout.solid(p.x,p.y,12),false,'each path tile must be traversable');
  if(i>0)assert.equal(Math.abs(p.x-live.points[i-1].x)+Math.abs(p.y-live.points[i-1].y),48,
   'no diagonal wall-cutting or teleportation');
 }
 const exitPath=routes.planFrom(basementLayout,basementLayout.fixedExit);
 assert.equal(exitPath.steps,0,'standing on exit should show zero travel tiles');
 assert.equal(routes.planFrom(basementLayout,{x:-1,y:24}),null);
 assert.equal(routes.planFrom(basementLayout,{x:Infinity,y:24}),null);
 assert.equal(routes.planFrom(basementLayout,{x:24,y:basementLayout.h+1}),null);
 const w=basementLayout.w/48,h=basementLayout.h/48;
 let wall=null;
 for(let y=0;y<h&&!wall;y++)for(let x=0;x<w;x++){
  const p={x:(x+.5)*48,y:(y+.5)*48};
  if(basementLayout.solid(p.x,p.y,12)){wall=p;break}
 }
 assert.ok(wall);
 assert.equal(routes.planFrom(basementLayout,wall),null,'player inside blocked tile has no valid route');
});

test('R6.32 B1 map defaults to clean white current-position path, with a large-tap two-route switch',async()=>{
 let now=1_000_000;
 const {t,layout,basementLayout,gameWindow,dom}=await harness(()=>.61,{now:()=>now});
 t.startRun();const r=t.runRef();
 assert.equal(t.v5BasementCurrentRoute(),null);
 assert.doesNotMatch(t.mapPanel(),/data-b1-route="current"/);
 assert.doesNotMatch(t.v5FacilityPlanSvg(basementLayout,null),/data-b1-route="current"/);
 r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 const current=t.v5BasementCurrentRoute();
 assert.ok(current);
 let screen=t.mapPanel();
 assert.match(screen,/現在地からの経路/);
 assert.match(screen,/data-b1-route="current"/);
 assert.doesNotMatch(screen,/data-b1-route="central"/,'default shows one route, not 3 overlapping paths');
 assert.match(screen,/aria-pressed="true">現在地からの経路/);
 assert.match(screen,/敵の巡回・視線・戦闘/);
 // Actual touch handler: only allows switch inside a paused B1 map.
 const layer={innerHTML:''};dom.set('exp-pause-layer',layer);
 const scroll={scrollLeft:34,scrollTop:72};
 dom.set('exp-map-scroll',scroll);
 r.showMap=true;r.paused=true;r.pausedAt=now;
 const snap=JSON.stringify(t.snapshotRun());
 gameWindow.explorationAction({dataset:{explore:'map-b1-route',routeMode:'compare'}});
 assert.match(layer.innerHTML,/data-b1-route="central"/);
 assert.match(layer.innerHTML,/data-b1-route="northern"/);
 assert.doesNotMatch(layer.innerHTML,/data-b1-route="current"/);
 assert.deepEqual([scroll.scrollLeft,scroll.scrollTop],[34,72],'preserves map pan position');
 assert.match(layer.innerHTML,/aria-pressed="true">中央・北側を比較/);
 assert.equal(JSON.stringify(t.snapshotRun()),snap,'map toggle never changes gameplay checkpoint');
 gameWindow.explorationAction({dataset:{explore:'map-b1-route',routeMode:'current'}});
 assert.match(layer.innerHTML,/data-b1-route="current"/);
 assert.doesNotMatch(layer.innerHTML,/data-b1-route="central"/);
 assert.equal(JSON.stringify(t.snapshotRun()),snap);
 assert.match(read('exploration.css'),/\.exp-b1-route-switch button\{min-height:44px/);
 assert.match(read('index.html'),/map-return-routes\.js\?v=R6\.32/);
 assert.match(read('index.html'),/exploration\.js\?v=R6\.28&amp;balance=R6\.\d+/);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.32 live shortest route updates after player movement, cargo speed and checkpoint restore',async()=>{
 const {t,layout,basementLayout,state}=await harness(()=>.27);
 t.startRun();const r=t.runRef();
 r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 const atEntry=t.v5BasementCurrentRoute();
 assert.ok(atEntry);
 const rare=basementLayout.authoredContainers.filter(c=>c.tier==='ultra').sort((a,b)=>b.y-a.y)[0];
 r.player.x=rare.x;r.player.y=rare.y;
 const atRare=t.v5BasementCurrentRoute();
 assert.equal(atRare.steps,41);
 assert.notEqual(atEntry.steps,atRare.steps,'different player tiles must change real exit distance');
 t.openContainer();const cache=r.containers.find(c=>c.id===r.lootOpenId);
 assert.ok(cache&&cache.contents.length>0);
 t.takeAllContainerItems({dataset:{container:cache.id,revision:String(r.lootOpenRevision||0)}});
 t.closeContainer();
 const withLoot=t.v5BasementCurrentRoute();
 assert.equal(withLoot.steps,41,'loot affects travel speed, not real geometry');
 // Test-only capacity reduction to force a clearly heavier movement penalty.
 r.stats.weightLimit=Math.max(1,t.v5CargoRisk().weight/10-2.5);
 const heavy=t.v5BasementCurrentRoute();
 assert.ok(heavy.secondsAtCurrentLoad>withLoot.secondsAtCurrentLoad);
 assert.ok(heavy.cargo.pct<withLoot.cargo.pct);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 const old=t.snapshotRun();
 state.exploreRun=old;t.resetRun();t.restoreRunIfNeeded();
 const after=t.v5BasementCurrentRoute();
 assert.ok(t.runRef().paused);
 assert.equal(after.steps,heavy.steps);
 assert.equal(after.secondsAtCurrentLoad,heavy.secondsAtCurrentLoad);
 assert.deepEqual(after.cells,heavy.cells);
 assert.equal(Object.hasOwn(t.snapshotRun(),'routeView'),false);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});


// R6.33: Pause-only extraction decision integrates existing sealed loot
// stakes and the theoretical return floor WITHOUT mutating a checkpoint.
test('R6.33 1F extraction decision is readable, conservative and pause-only',async()=>{
 const {t,layout}=await harness(()=>.21);
 t.startRun();const r=t.runRef();
 r.player.x=layout.start.x;r.player.y=layout.start.y;
 const d=t.v5ExtractionDecision();
 assert.ok(d);
 assert.equal(d.floor,'1F');
 assert.equal(d.routeBasis,'1F直線距離のみ');
 assert.equal(d.lowerBound,t.v5ReturnRisk().straightSeconds);
 assert.equal(d.planningWindow,Math.ceil(d.lowerBound*3+30));
 assert.equal(d.difference,d.timeLeft-d.planningWindow);
 assert.equal(d.stakes.total,0);
 assert.equal(d.stakes.exposed,0);
 assert.equal(d.pouchFree,2);
 assert.ok(['explore','consider','return'].includes(d.phase));
 assert.doesNotMatch(t.contents(),/exp-raid-decision/,'no extra HUD overlay while moving');
 r.paused=true;r.pausedAt=Date.now();
 const stableCheckpoint=()=>{const saved=t.snapshotRun();delete saved.savedAt;return JSON.stringify(saved)};
 const before=stableCheckpoint(),sealed=JSON.stringify(r.containers);
 const html=t.pausePanel();
 assert.match(html,/今帰る？ もう少し探索？/);
 assert.match(html,/判断用の仮の帰還枠/);
 assert.match(html,/直線最短は経路・戦闘を含まない下限/);
 assert.match(html,/敵の位置や戦利品の将来価値は予測しません/);
 assert.match(html,/失敗時に失う未保護 0点/);
 assert.doesNotMatch(html,/直線下限は絶対安全/);
 assert.equal(stableCheckpoint(),before,'read-only decision cannot modify checkpoint apart from wall-clock savedAt');
 assert.equal(JSON.stringify(r.containers),sealed,'no sealed loot reroll');
 assert.equal(t.pausePanel(),html,'pure display stable while paused');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.33 pressing on near time and sealed vault warns return/hatch instead of promising safety',async()=>{
 const {t,layout}=await harness(()=>.27);
 t.startRun();const r=t.runRef();
 r.player.x=layout.start.x;r.player.y=layout.start.y;
 r.loot=[{id:'ITM-00001',q:0,tid:1},{id:'ITM-00002',q:0,tid:2}];
 r.lootSerial=3;
 r.safeIds=[1];
 r.start=Date.now()-(r.duration-16)*1000;
 r.paused=true;r.pausedAt=Date.now();
 let d=t.v5ExtractionDecision();
 assert.equal(d.phase,'return');
 assert.equal(d.stakes.total,400200);
 assert.equal(d.stakes.secured,400000);
 assert.equal(d.stakes.exposed,200);
 assert.equal(d.stakes.exposedCount,1);
 assert.equal(d.pouchFree,1);
 assert.equal(d.label,'帰還を優先');
 let html=t.pausePanel();
 assert.match(html,/失敗時に失う未保護 1点・200/);
 assert.match(html,/ポーチ空き 1枠/);
 assert.match(html,/荷重速度/);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 r.vaultSealed=true;r.vaultHatchUsed=false;
 d=t.v5ExtractionDecision();
 assert.equal(d.phase,'hatch');
 assert.equal(d.lowerBound,null,'sealed hatch cannot pretend straight-line extraction is available');
 assert.equal(d.planningWindow,null);
 assert.match(t.v5ExtractionDecisionHTML(),/まず非常ハッチ/);
 assert.doesNotMatch(t.v5ExtractionDecisionHTML(),/判断用の仮の帰還枠/);
});

test('R6.33 B1 extraction decision uses live Tiled walkable route, slows with cargo, and restores',async()=>{
 const {t,layout,basementLayout,state}=await harness(()=>.34);
 t.startRun();const r=t.runRef();
 r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 const origin=t.v5ExtractionDecision(),route=t.v5BasementCurrentRoute();
 assert.equal(origin.floor,'B1');
 assert.equal(origin.routeBasis,'B1実地形の最短セル');
 assert.equal(origin.lowerBound,route.secondsAtCurrentLoad);
 assert.ok(route.steps>0);
 // The sealed surface vault state must NOT block B1's independent exit.
 r.vaultSealed=true;r.vaultHatchUsed=false;
 assert.notEqual(t.v5ExtractionDecision().phase,'hatch');
 // Restore a normal B1 checkpoint before testing save/reload. A sealed
 // surface vault with no hatch is intentionally an inconsistent test fixture.
 r.vaultSealed=false;
 r.loot=Array.from({length:16},(_,i)=>({id:'ITM-09000',q:0,tid:i+1}));
 r.lootSerial=17;
 const heavy=t.v5ExtractionDecision();
 assert.ok(heavy.lowerBound>origin.lowerBound);
 assert.ok(heavy.cargo.pct<origin.cargo.pct);
 assert.equal(heavy.lowerBound,t.v5BasementCurrentRoute().secondsAtCurrentLoad);
 r.paused=true;r.pausedAt=Date.now();
 const before=t.snapshotRun();
 const html=t.pausePanel();
 assert.match(html,/B1実地形の最短セル/);
 assert.match(html,/売却基準合計 1,600/);
 const after=t.snapshotRun();
 // The snapshot's savedAt timestamp naturally changes while wall clock runs.
 // Compare immutable gameplay state rather than a volatile save timestamp.
 delete before.savedAt;delete after.savedAt;
 assert.deepEqual(after,before);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 state.exploreRun=t.snapshotRun();
 t.resetRun();t.restoreRunIfNeeded();
 assert.ok(t.runRef().paused);
 const restored=t.v5ExtractionDecision();
 assert.equal(restored.floor,'B1');
 assert.equal(restored.lowerBound,heavy.lowerBound);
 assert.equal(restored.stakes.total,heavy.stakes.total);
 assert.equal(restored.pouchFree,heavy.pouchFree);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 // Test-only impossible tile: do not fabricate a safety/ETA estimate.
 t.runRef().player.x=-100;
 const unknown=t.v5ExtractionDecision();
 assert.equal(unknown.phase,'unknown');
 assert.equal(unknown.lowerBound,null);
 assert.match(t.v5ExtractionDecisionHTML(),/経路を計算できません/);
});

test('R6.33 legacy modes never inherit extraction decision or snapshot fields',async()=>{
 const {t}=await harness(()=>.44);t.startRun();const r=t.runRef();
 assert.equal(Object.hasOwn(t.snapshotRun(),'extractionDecision'),false);
 assert.equal(Object.hasOwn(t.snapshotRun(),'planningWindow'),false);
 r.mapVersion=4;
 assert.equal(t.v5ExtractionDecision(),null);
 assert.equal(t.v5ExtractionDecisionHTML(),'');
 assert.doesNotMatch(t.contents(),/exp-raid-decision/);
 assert.match(read('exploration.css'),/\.exp-raid-decision-heading/);
});


// R6.35: compare route exposure to the real authored B1 patrol circuits.
// This is a spatial planning audit, never a live-guard tracker or win rate.
test('R6.35 B1 patrol-lane proximity compares real Tiled routes without changing guards or checkpoints',async tctx=>{
 const {t,layout,basementLayout}=await harness(()=>.31);
 t.startRun();const r=t.runRef();
 assert.equal(t.v5BasementCurrentRoute(),null,'ground floor never inherits B1 patrol guide');
 r.basementKeyTaken=true;
 r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 assert.equal(basementLayout.guardPosts.length,9);
 t.togglePause();
 const snapshot=()=>{
  const c=t.snapshotRun();delete c.savedAt;return JSON.stringify(c);
 };
 const before=snapshot();
 const guardBefore=JSON.stringify(r.enemies),pendingBefore=JSON.stringify(r.pendingGuardPosts);
 const current=t.v5BasementCurrentRoute(),choices=t.v5BasementReturnChoices();
 assert.ok(current&&current.patrolExposure);
 assert.equal(current.patrolExposure.totalPoints,current.steps+1);
 assert.ok(current.patrolExposure.nearPoints<=current.patrolExposure.totalPoints);
 assert.equal(choices.routes.length,2);
 for(const choice of choices.routes){
  assert.ok(choice.patrolExposure);
  assert.equal(choice.patrolExposure.totalPoints,choice.steps+1);
  assert.ok(choice.patrolExposure.nearPoints<=choice.patrolExposure.totalPoints);
  assert.ok(choice.patrolExposure.nearbyPatrols<=9);
 }
 t.setB1RouteView('current');
 const currentHTML=t.mapPanel();
 assert.match(currentHTML,/固定巡回経路との近接（120px以内）/);
 assert.match(currentHTML,/初期巡回計画に基づく参考値/);
 assert.doesNotMatch(currentHTML,/data-route="central"/,'current route remains uncluttered');
 t.setB1RouteView('compare');
 const compared=t.mapPanel();
 assert.match(compared,/固定巡回経路120px以内/);
 assert.match(compared,/現在の敵位置や発見確率ではありません/);
 assert.match(compared,/警備初期配置の近接/,'R6.31 comparison remains intact');
 assert.equal(snapshot(),before,'map-only audit cannot mutate checkpoint, excluding savedAt drift');
 assert.equal(JSON.stringify(r.enemies),guardBefore,'route audit never moves or reveals active guards');
 assert.equal(JSON.stringify(r.pendingGuardPosts),pendingBefore,'route audit cannot wake sentries');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 tctx.diagnostic('R6.35 authored B1 patrol geometry (not survival odds): '+
  JSON.stringify(choices.routes.map(q=>({route:q.id,steps:q.steps,patrol:q.patrolExposure}))));
});


// R6.36: money/time trade-offs from the CURRENT exit-distance basis, but
// decisions are still the player's. These audits never discard sealed loot.
test('R6.36 1F discard weighs the actual forfeited reference value against straight-line travel seconds',async()=>{
 const {t,layout}=await harness(()=>.24);
 t.startRun();const r=t.runRef();
 r.loot=Array.from({length:6},(_,i)=>({id:'ITM-00001',q:1,tid:i+1}));
 r.lootSerial=7;r.safeIds=[1,2];
 r.player.x=layout.start.x;r.player.y=layout.start.y;
 const original=JSON.stringify({loot:r.loot,safeIds:r.safeIds,stats:r.stats,containers:r.containers});
 const choice=t.v5JettisonAdvice();
 assert.ok(choice&&choice.savedSeconds>0,'the heavy pack should have a measurable distance-based return trade-off');
 assert.equal(choice.routeBasis,'1F出口までの直線');
 assert.ok(!r.safeIds.includes(choice.tid),'insured treasure must never be recommended for discard');
 assert.equal(choice.lostBase,400000);
 assert.equal(choice.beforeSeconds,t.v5ReturnRisk().straightSeconds);
 const hypothetical=r.loot.filter((_,i)=>i!==choice.index);
 assert.equal(choice.afterSeconds,t.v5ReturnRisk(hypothetical).straightSeconds);
 assert.equal(choice.savedSeconds,choice.beforeSeconds-choice.afterSeconds);
 assert.ok(choice.afterSeconds<choice.beforeSeconds);
 assert.match(t.v5JettisonAdviceHTML(),/移動だけの理論下限は約/);
 assert.match(t.v5JettisonAdviceHTML(),/1F出口までの直線/);
 assert.match(t.v5JettisonAdviceHTML(),/捨てた財宝は戻せず/);
 assert.equal(JSON.stringify({loot:r.loot,safeIds:r.safeIds,stats:r.stats,containers:r.containers}),original,
  'the suggestion cannot mutate real loot, protection, capacity or sealed rewards');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.36 B1 discard uses real current-position walkable route and preserves alarm, map and save',async()=>{
 const {t,layout,basementLayout}=await harness(()=>.34);
 t.startRun();const r=t.runRef();
 r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 const ultra=basementLayout.authoredContainers.filter(c=>c.tier==='ultra').sort((a,b)=>b.y-a.y)[0];
 r.player.x=ultra.x;r.player.y=ultra.y;
 r.loot=Array.from({length:6},(_,i)=>({id:'ITM-00001',q:0,tid:i+1}));
 r.lootSerial=7;r.safeIds=[1,2];
 r.paused=true;r.pausedAt=Date.now(); // freeze active raid time during read-only comparison
 const route=t.v5BasementCurrentRoute();
 assert.ok(route&&route.steps>10);
 const before=t.snapshotRun();delete before.savedAt;
 const choice=t.v5JettisonAdvice();
 assert.ok(choice&&choice.savedSeconds>0);
 assert.equal(choice.routeBasis,'B1実地形の最短セル');
 assert.equal(choice.beforeSeconds,route.secondsAtCurrentLoad);
 const original=r.loot;
 r.loot=r.loot.filter((_,i)=>i!==choice.index); // only this test's hypothetical control
 const after=t.v5BasementCurrentRoute();
 r.loot=original;
 assert.equal(choice.afterSeconds,after.secondsAtCurrentLoad);
 assert.match(t.v5JettisonAdviceHTML(),/B1実地形の最短セル/);
 const restored=t.snapshotRun();delete restored.savedAt;
 assert.deepEqual(restored,before,'the actual advice must not touch map, guards, loot, time or checkpoint data');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.36 locked hatch and unreachable map never invent an extraction time saving',async()=>{
 const {t,layout}=await harness(()=>.44);
 t.startRun();const r=t.runRef();
 r.loot=Array.from({length:6},(_,i)=>({id:'ITM-00001',q:0,tid:i+1}));
 r.lootSerial=7;
 r.vaultSealed=true;r.vaultHatchUsed=false;
 const sealed=t.v5JettisonAdvice();
 assert.ok(sealed);
 assert.equal(sealed.routeBasis,null);
 assert.equal(sealed.savedSeconds,null);
 assert.equal(sealed.beforeSeconds,null);
 assert.match(t.v5JettisonAdviceHTML(),/現在の出口経路を計算できない/);
 assert.doesNotMatch(t.v5JettisonAdviceHTML(),/秒短縮/);
 r.vaultSealed=false;
 r.player.x=layout.fixedExit.x;r.player.y=layout.fixedExit.y;
 const atExit=t.v5JettisonAdvice();
 assert.ok(atExit);
 assert.equal(atExit.savedSeconds,0,'at exit a speed recovery does not shorten travel');
 assert.match(t.v5JettisonAdviceHTML(),/秒単位で短縮しません/);
 r.mapVersion=4;
 assert.equal(t.v5JettisonAdvice(),null,'V4 saved sorties stay unaffected');
});

test('R6.36 sorts the one-item loss by reference value per recoverable second, never discards automatically',async()=>{
 const {t,layout}=await harness(()=>.13);t.startRun();const r=t.runRef();
 // Four very valuable 3kg relics plus one less valuable 1.4kg jewel.
 r.loot=[
  ...Array.from({length:4},(_,i)=>({id:'ITM-00001',q:0,tid:i+1})),
  {id:'ITM-00003',q:0,tid:5}
 ];
 r.lootSerial=6;r.player.x=layout.start.x;r.player.y=layout.start.y;
 const before=JSON.stringify(r.loot);
 const advice=t.v5JettisonAdvice();
 assert.ok(advice&&advice.savedSeconds>0);
 assert.equal(advice.name,'宝石の首飾り','smaller sacrificed base value beats expensive relics when saving travel time');
 assert.equal(advice.lostBase,10000);
 assert.equal(advice.tid,5,'only the lower-value jewel beats the costly relics');
 assert.equal(JSON.stringify(r.loot),before);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});


// R6.37: the open-cache decision is calculated only from contents ALREADY
// revealed on this paused panel. No preview of other sealed caches or RNG.
test('R6.37 B1 opened cache previews movement cost along real Tiled route, singly and in batch',async()=>{
 const {t,layout,basementLayout}=await harness(()=>.39);
 t.startRun();const r=t.runRef();
 r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 const ultra=basementLayout.authoredContainers.filter(c=>c.tier==='ultra').sort((a,b)=>b.y-a.y)[0];
 r.player.x=ultra.x;r.player.y=ultra.y;
 assert.equal(t.openContainer(),undefined);
 assert.ok(r.paused&&r.lootOpenId);
 const c=r.containers.find(v=>v.id===r.lootOpenId);
 assert.ok(c&&c.contents.length>=2);
 // Test only: add six existing weight-bearing treasures, enough that another
 // pickup changes the encumbrance and thus the theoretical travel time.
 r.loot=Array.from({length:6},(_,i)=>({id:'ITM-00001',q:0,tid:i+1}));
 r.lootSerial=7;
 const original=JSON.stringify({loot:r.loot,containers:r.containers,safe:r.safeIds,guards:r.enemies});
 const distance=t.v5JettisonReturnDistance();
 const live=t.v5BasementCurrentRoute();
 assert.equal(distance.basis,'B1実地形の最短セル');
 assert.equal(distance.distancePx,live.steps*48);
 const impact=t.v5PickupReturnImpact([...r.loot,c.contents[0]],distance);
 assert.ok(impact&&impact.afterSeconds>=impact.beforeSeconds);
 assert.equal(impact.beforeSeconds,live.secondsAtCurrentLoad);
 const batch=t.v5PickupReturnImpact([...r.loot,...c.contents],distance);
 assert.ok(batch&&batch.afterSeconds>=batch.beforeSeconds);
 const panel=t.pausePanel();
 assert.match(panel,/B1の帰還下限は実地形で通れる最短セル経路/);
 assert.match(panel,new RegExp('帰還のB1実地形下限 '+impact.afterSeconds+'秒以上'));
 assert.match(panel,new RegExp('出口までB1実地形下限'+batch.afterSeconds+'秒以上'));
 assert.match(panel,/data-explore="loot-take-all"/);
 assert.doesNotMatch(panel,/帰還の直線下限/);
 assert.doesNotMatch(panel,/出口まで直線下限/);
 assert.equal(JSON.stringify({loot:r.loot,containers:r.containers,safe:r.safeIds,guards:r.enemies}),original,
  'reading a revealed cache cannot take loot, reroll, or wake guards');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.37 surface cache keeps conservative straight bound and never invents a routed ETA',async()=>{
 const {t}=await harness(()=>.11);
 t.startRun();const r=t.runRef();
 const c=r.containers.find(c=>c.contents.length>=2);
 assert.ok(c);
 r.player.x=c.x;r.player.y=c.y;
 t.openContainer();
 assert.ok(r.paused);
 const route=t.v5JettisonReturnDistance(),v=c.contents[0];
 assert.equal(route.basis,'1F出口までの直線');
 const impact=t.v5PickupReturnImpact([...r.loot,v],route);
 assert.ok(impact);
 assert.equal(impact.afterSeconds,t.v5ReturnRisk([...r.loot,v]).straightSeconds);
 assert.equal(impact.beforeSeconds,t.v5ReturnRisk().straightSeconds);
 const panel=t.pausePanel();
 assert.match(panel,new RegExp('帰還の直線下限 '+impact.afterSeconds+'秒以上'));
 assert.match(panel,/1Fの帰還下限は出口までの直線距離/);
 assert.doesNotMatch(panel,/B1実地形下限/);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.37 sealed vault and invalid B1 route suppress imaginary return seconds in the open cache',async()=>{
 const {t,layout,basementLayout}=await harness(()=>.41);
 t.startRun();const r=t.runRef();
 const box=r.containers.find(c=>c.contents.length>=2);
 r.player.x=box.x;r.player.y=box.y;
 t.openContainer();
 assert.ok(r.paused);
 r.vaultSealed=true;r.vaultHatchUsed=false;
 const sealed=t.pausePanel();
 assert.equal(t.v5JettisonReturnDistance(),null);
 assert.match(sealed,/出口への経路未確定（非常ハッチ利用後に帰還経路を確認）/);
 assert.match(sealed,/帰還経路未確定（非常ハッチ利用後に帰還経路を確認）/);
 assert.doesNotMatch(sealed,/出口まで直線下限/);
 assert.doesNotMatch(sealed,/帰還の直線下限/);
 assert.doesNotMatch(sealed,/秒以上（今より/);
 r.vaultSealed=false;
 t.closeContainer();
 r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 const ultra=basementLayout.authoredContainers.filter(c=>c.tier==='ultra').sort((a,b)=>b.y-a.y)[0];
 r.player.x=ultra.x;r.player.y=ultra.y;t.openContainer();
 assert.ok(r.paused);
 r.player.x=-100; // deliberately invalid tile; no plausible path can be computed
 assert.equal(t.v5JettisonReturnDistance(),null);
 const invalid=t.pausePanel();
 assert.match(invalid,/帰還経路未確定（詳細地図で帰還経路を確認）/);
 assert.doesNotMatch(invalid,/帰還のB1実地形下限/);
 assert.doesNotMatch(invalid,/出口までB1実地形下限/);
});

test('R6.37 pickup preview is V5-only and read-only without new checkpoint fields',async()=>{
 const {t}=await harness(()=>.18);
 t.startRun();const r=t.runRef();
 const c=r.containers.find(c=>c.contents.length>=2);
 r.player.x=c.x;r.player.y=c.y;t.openContainer();
 assert.ok(r.paused);
 r.loot=Array.from({length:6},(_,i)=>({id:'ITM-00001',q:0,tid:i+1}));
 r.lootSerial=7;
 const before=t.snapshotRun();delete before.savedAt;
 const route=t.v5JettisonReturnDistance();
 const impact=t.v5PickupReturnImpact([...r.loot,c.contents[0]],route);
 assert.ok(impact&&impact.addedSeconds>=0);
 const panel=t.pausePanel();
 assert.match(panel,/価値\/kg/);
 assert.match(panel,/data-explore="loot-take"/);
 const after=t.snapshotRun();delete after.savedAt;
 assert.deepEqual(after,before);
 assert.equal(Object.hasOwn(after,'pickupReturnImpact'),false);
 assert.equal(Object.hasOwn(after,'returnDistance'),false);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 r.mapVersion=4;
 assert.equal(t.v5JettisonReturnDistance(),null);
 assert.equal(t.v5PickupReturnImpact(r.loot,route),null);
});


// R6.38: exact Tiled-derived cache accessibility, not a made-up danger score.
// All data is available from the authored grade and geometry before opening.
test('R6.38 real B1 risk/reward audit covers all nine authored caches and stays save-neutral',async tctx=>{
 const {t,layout,basementLayout,state}=await harness(()=>.24);
 const audit=ReturnRoutesR617.auditCacheAccess(basementLayout);
 assert.ok(audit);
 assert.equal(audit.tileSize,48);
 assert.equal(audit.rows.length,9);
 assert.deepEqual(['mid','high','ultra'].map(tier=>audit.rows.filter(row=>row.tier===tier).length),[3,4,2]);
 const authored=new Map(basementLayout.authoredContainers.map(c=>[c.id,c]));
 for(const row of audit.rows){
  const cache=authored.get(row.id);
  assert.ok(cache);
  assert.ok(Number.isInteger(row.entrySteps)&&row.entrySteps>=0,
   row.id+' must have a valid walkable path from the B1 entry');
  assert.ok(Number.isInteger(row.exitSteps)&&row.exitSteps>=0,
   row.id+' must have a valid walkable path to the B1 extraction');
  assert.equal(row.entrySteps,ReturnRoutesR617.planFrom(
   {...basementLayout,fixedExit:cache},basementLayout.start).steps,
   row.id+' entry cost must agree with R6.32 Tiled pathfinding');
  assert.equal(row.exitSteps,ReturnRoutesR617.planFrom(basementLayout,cache).steps,
   row.id+' return cost must agree with R6.32 Tiled pathfinding');
  const seen=ReturnRoutesR617.auditPatrolProximity(basementLayout,{points:[cache]});
  assert.equal(row.nearbyPatrols,seen.nearbyPatrols,
   row.id+' static patrol exposure must agree with R6.35');
  assert.ok(row.nearbyPatrols>=0&&row.nearbyPatrols<=9);
 }
 assert.equal(ReturnRoutesR617.auditCacheAccess(layout),null,
  'surface layout must never inherit B1-only audit');
 const pre=t.v5ApproachPlans(basementLayout,null);
 assert.deepEqual(pre.map(x=>[x.id,x.total]),[['ordinary',3],['archive',4],['vault',2]]);
 assert.ok(pre.every(x=>x.spatial&&x.spatial.cacheCount===x.total));
 const preHTML=t.v5ApproachChoicesHTML(basementLayout,null);
 assert.equal((preHTML.match(/class="exp-v5-risk-lane"/g)||[]).length,3);
 assert.match(preHTML,/入口→物資：/);
 assert.match(preHTML,/物資→出口：/);
 assert.match(preHTML,/固定巡回120px以内/);
 assert.match(preHTML,/発見率ではありません/);
 assert.doesNotMatch(t.v5ApproachChoicesHTML(layout,null),/class="exp-v5-risk-lane"/,
  '1F uses special gate/hatch progression and cannot claim these B1 metrics');
 t.startRun();const r=t.runRef();
 r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 t.togglePause();
 const snap=()=>{const c=t.snapshotRun();delete c.savedAt;return c};
 const before=snap();
 const guardBefore=JSON.stringify(r.enemies),pendingBefore=JSON.stringify(r.pendingGuardPosts);
 const live=t.v5ApproachPlans(basementLayout);
 assert.deepEqual(live.map(v=>v.spatial),pre.map(v=>v.spatial));
 const map=t.mapPanel();
 assert.equal((map.match(/class="exp-v5-risk-lane"/g)||[]).length,3,
  'in-raid B1 detailed map shows identical static accessibility stats');
 assert.deepEqual(snap(),before,'read-only planning cannot touch treasure, gameplay or checkpoint');
 assert.equal(JSON.stringify(r.enemies),guardBefore);
 assert.equal(JSON.stringify(r.pendingGuardPosts),pendingBefore);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 tctx.diagnostic('R6.38 B1 authored placement audit: '+JSON.stringify(audit.rows));
});


test('R6.39 U09 is an optional mid-grade extraction-area detour, not a free pickup or distant vault',async()=>{
 const {t,layout,basementLayout}=await harness(()=>.22);
 const b1Map=JSON.parse(read('maps/basement/basement.tmj'));
 const authored=b1Map.layers.filter(l=>l.type==='objectgroup')
  .flatMap(l=>l.objects||[]).find(o=>o.id===11&&o.type==='loot');
 assert.equal(authored.name,'U09 脱出前の補助物資');
 assert.deepEqual([authored.x,authored.y],[56,424],
  'the Tiled source, not an alternate drawing, owns the new exit-side cache position');
 assert.equal(authored.properties.find(p=>p.name==='grade')?.value,'mid');
 const cache=basementLayout.authoredContainers.find(c=>c.id==='tiled-loot-11');
 assert.ok(cache);
 assert.deepEqual([cache.x,cache.y],[168,1272],'scaled gameplay and map overlay follow the source');
 assert.equal(basementLayout.themeAt(cache),'地下脱出区画');
 assert.equal(basementLayout.solid(cache.x,cache.y,12),false,'full actor can reach the cache');
 const access=ReturnRoutesR617.auditCacheAccess(basementLayout);
 const metrics=access.rows.find(x=>x.id===cache.id);
 assert.equal(metrics.exitSteps,5,'support cache is five walkable cells from the B1 exit alcove');
 assert.ok(metrics.entrySteps>=30,'not an early-zone reward reachable for free at entry');
 const ultras=access.rows.filter(x=>x.tier==='ultra');
 assert.ok(ultras.every(x=>x.exitSteps>metrics.exitSteps+20),
  'high reward still requires the long return from the deeper special storage');
 assert.ok(basementLayout.authoredContainers.filter(c=>c.id!==cache.id)
  .every(c=>Math.hypot(c.x-cache.x,c.y-cache.y)>200),
  'reserve cache must not overlap or crowd the other loot prompts');
 assert.match(t.v5FacilityPlanSvg(basementLayout,null),/cx="168" cy="1272"/,
  'shared pre-raid and in-raid map use the migrated Tiled marker');
 assert.equal(layout.authoredContainers.length,11,'surface map remains untouched');
});

test('R6.38 resumes a pre-move B1 checkpoint without rerolling U09, protected loot or time',async()=>{
 const {t,layout,basementLayout,state}=await harness(()=>.28);
 t.startRun();const r=t.runRef();
 r.basementKeyTaken=true;
 r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 const u09=r.containers.find(c=>c.id==='tiled-loot-11');
 assert.ok(u09&&u09.contents.length);
 const recovered={...u09.contents.shift(),tid:1};
 u09.opened=true;r.loot=[recovered];r.safeIds=[1];r.lootSerial=2;
 const original=t.snapshotRun();
 assert.ok(t.validCheckpoint(original));
 const old=structuredClone(original);
 const savedCache=old.containers.find(c=>c.id==='tiled-loot-11');
 savedCache.x=424*3;savedCache.y=520*3; // R6.37 and earlier Tiled position
 const pending=JSON.stringify(savedCache.contents),remaining=old.remaining;
 state.exploreRun=old;t.resetRun();t.restoreRunIfNeeded();
 const restored=t.runRef();
 assert.ok(restored&&restored.paused,'old B1 run must remain resumeable');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 const migrated=restored.containers.find(c=>c.id==='tiled-loot-11');
 const authored=basementLayout.authoredContainers.find(c=>c.id==='tiled-loot-11');
 assert.deepEqual([migrated.x,migrated.y],[authored.x,authored.y]);
 assert.equal(JSON.stringify(migrated.contents),pending,'uncollected sealed rewards remain unchanged');
 assert.equal(migrated.opened,true);
 assert.deepEqual(restored.loot.map(v=>v.id),[recovered.id]);
 assert.deepEqual(restored.safeIds,[1],'protected pickup must not be lost');
 assert.ok(Math.abs(t.remaining()-remaining)<2,'migrating metadata must not reset the raid timer');
 assert.equal(restored.undergroundEntered,true);
 assert.equal(restored.duration,420);
});


// R6.39: actual source-map movement + active patrol/detection + sealed loot
// pickup + extraction, not an inferred win-rate or imaginary return ETA.
// Compare direct U08 with the U09 reserve on the final approach, and U09-only.
test('R6.39 B1 full-route enemy-on extraction benchmark covers low/deep/detour loot decisions',async tctx=>{
 const readings=[];
 for(const seed of [.23,.73]){
  for(const objective of ['reserve','deep','deep+reserve']){
   for(const load of ['normal','overweight']){
    let now=1_000_000;
    const {t,layout,basementLayout,state,received}=await harness(()=>seed,{now:()=>now});
    const advance=ms=>{now+=ms};
    t.startRun();const r=t.runRef();
    r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
    assert.equal(t.enterBasement(),true,'the real one-way underground transition runs');
    assert.equal(r.duration,420,'B1 gives its one-time 120s extension');
    const byId=new Map(basementLayout.authoredContainers.map(c=>[c.id,c]));
    const reserve=byId.get('tiled-loot-11'),deep=byId.get('tiled-loot-10');
    assert.ok(reserve&&deep&&reserve.tier==='mid'&&deep.tier==='ultra');
    const stops=objective==='reserve'?[reserve]:
     objective==='deep'?[deep]:[deep,reserve];
    const log={seed,objective,load,legs:[],looted:[],state:'moving',remaining:null};
    let cursor=basementLayout.start,expectedLoot=0;
    for(const target of [...stops,basementLayout.fixedExit]){
     if(r.status!=='playing'){log.state='dead-before-next-leg';break}
     const waypoints=r617Path(basementLayout,cursor,target);
     const result=r619MeasureReturn(t,basementLayout,waypoints,advance);
     log.legs.push({target:target.id||'exit',tiles:waypoints.length-1,...result});
     if(!result.completed){
      log.state='failed-route';break;
     }
     cursor=target;
     if(target===basementLayout.fixedExit){
      log.remaining=+t.remaining().toFixed(2);
      t.bank();log.state=state.exploreLastResult?.status||'unsettled';
      assert.equal(log.state,'escaped','arrival at B1 exit should settle once');
      assert.equal(received.length,expectedLoot,'only already-sealed pickup rewards are banked');
      t.bank();assert.equal(received.length,expectedLoot,'double exit never duplicates rewards');
      break;
     }
     t.openContainer();
     const opened=r.containers.find(c=>c.id===r.lootOpenId);
     if(!r.paused||!opened||opened.id!==target.id){
      log.state='cache-blocked-by-live-guard';break;
     }
     const sealed=opened.contents.map(v=>({id:v.id,q:v.q}));
     assert.ok(sealed.length>0,'the authored cache contains pre-rolled loot');
     const oldCount=r.loot.length;
     t.takeAllContainerItems({dataset:{container:opened.id,revision:String(r.lootOpenRevision||0)}});
     assert.deepEqual(r.loot.slice(oldCount).map(v=>({id:v.id,q:v.q})),sealed,
      'the route benchmark may take sealed items only, never reroll');
     assert.equal(opened.contents.length,0);
     expectedLoot+=sealed.length;
     log.looted.push({id:target.id,items:sealed.length,tier:target.tier});
     t.closeContainer();
     if(load==='overweight'&&log.looted.length===1){
      const total=t.v5CargoRisk().weight/10;
      // Test-only smaller bag capacity: no shipped balance or item definitions change.
      r.stats.weightLimit=Math.max(1,total-2.5);
     }
    }
    if(log.remaining===null)log.remaining=+(r.status==='playing'?t.remaining():0).toFixed(2);
    log.maxAlertSeconds=+log.legs.reduce((sum,l)=>sum+l.alertSeconds,0).toFixed(2);
    log.totalSeconds=+log.legs.reduce((sum,l)=>sum+l.seconds,0).toFixed(2);
    log.totalHits=log.legs.reduce((sum,l)=>sum+l.hits,0);
    log.progressTiles=log.legs.reduce((sum,l)=>sum+l.reached,0);
    if(r.status==='playing')assert.ok(t.validCheckpoint(t.snapshotRun()));
    assert.ok(log.legs.length>0&&log.progressTiles>0,
     'real guards and player physics must advance for each scenario');
    readings.push(log);
   }
  }
 }
 assert.equal(readings.length,12);
 for(const seed of [.23,.73]){
  const normal=readings.filter(r=>r.seed===seed&&r.load==='normal');
  assert.deepEqual(normal.map(r=>r.objective),['reserve','deep','deep+reserve']);
  assert.ok(normal.some(r=>r.maxAlertSeconds>0),
   'AI-on routes must activate authentic patrol detection');
 }
 const {basementLayout}=await harness(()=>.3);
 const deep=basementLayout.authoredContainers.find(c=>c.id==='tiled-loot-10');
 const reserve=basementLayout.authoredContainers.find(c=>c.id==='tiled-loot-11');
 const direct=r617Path(basementLayout,deep,basementLayout.fixedExit).length-1;
 const via=r617Path(basementLayout,deep,reserve).length-1+
  r617Path(basementLayout,reserve,basementLayout.fixedExit).length-1;
 assert.ok(via-direct>=6&&via-direct<=12,
  'U09 must need a meaningful optional side-alcove detour, not a near-free 2-cell bonus');
 tctx.diagnostic('R6.39 actual AI-on B1 full sortie matrix: '+JSON.stringify({
  directU08ExitTiles:direct,viaU09ExitTiles:via,additionalTiles:via-direct,
  readings
 }));
});


test('R6.39 R6.38-era U09 save migrates intact to the optional exit-side alcove',async()=>{
 let now=1_000_000;
 const {t,layout,basementLayout,state}=await harness(()=>.41,{now:()=>now});
 t.startRun();const r=t.runRef();
 r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 const authored=basementLayout.authoredContainers.find(c=>c.id==='tiled-loot-11');
 assert.deepEqual([authored.x,authored.y],[168,1272]);
 const original=r.containers.find(c=>c.id===authored.id);
 assert.ok(original&&original.contents.length>=1);
 const sealed=JSON.stringify(original.contents);
 const previous=t.snapshotRun(),remaining=t.remaining();
 assert.ok(t.validCheckpoint(previous));
 const stale=previous.containers.find(c=>c.id===authored.id);
 stale.x=104*3;stale.y=472*3; // Published R6.38 location, prior to R6.39
 state.exploreRun=previous;t.resetRun();t.restoreRunIfNeeded();
 const restored=t.runRef();
 assert.ok(restored&&restored.paused);
 const migrated=restored.containers.find(c=>c.id===authored.id);
 assert.deepEqual([migrated.x,migrated.y],[authored.x,authored.y]);
 assert.equal(JSON.stringify(migrated.contents),sealed,'pre-rolled loot must not be re-drawn');
 assert.equal(migrated.opened,false);
 assert.equal(restored.duration,420);
 assert.ok(Math.abs(t.remaining()-remaining)<.01);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 t.togglePause();
 restored.player.x=authored.x;restored.player.y=authored.y;
 t.openContainer();
 assert.equal(restored.paused,true);
 assert.equal(restored.lootOpenId,authored.id,
  'migrated cache remains physically pickable, not a ghost at the old location');
 t.takeAllContainerItems({dataset:{container:authored.id,revision:String(restored.lootOpenRevision||0)}});
 assert.equal(migrated.contents.length,0);
 assert.ok(restored.loot.length>=1);
 assert.ok(t.validCheckpoint(t.snapshotRun()),'post-migration collection remains checkpointable');
});


// R6.40: the R6.39 benchmark began INSIDE B1 after teleporting to the
// staircase. Here we actually walk from the 1F spawn to the key and stair,
// then collect in B1 and extract, with both floors' Tiled collision and live
// AI enabled. This is one scripted no-evasion bot, not a player win-rate.
test('R6.40 surface-to-B1 enemy-on complete raid measures real key/stair bottlenecks and shared clock',async tctx=>{
 const readings=[];
 for(const seed of [.23,.73]){
  for(const objective of ['reserve','ultra']){
   let now=1_000_000;
   const {t,layout,basementLayout,state,received}=await harness(()=>seed,{now:()=>now});
   const advance=ms=>{now+=ms};
   t.startRun();const r=t.runRef();
   const row={seed,objective,legs:[],state:'started',surfaceSeconds:0,b1Seconds:0,
    keysTaken:0,lootCount:0,clockBeforeB1:null,clockAfterB1:null};
   const walk=(world,from,to,label)=>{
    const path=r617Path(world,from,to),out=r619MeasureReturn(t,world,path,advance);
    row.legs.push({label,steps:path.length-1,...out,guardsAfter:r.enemies.length,hpAfter:r.player.hp});
    return out;
   };
   const key=layout.basementKey,door=layout.basementEntrance;
   assert.ok(key&&door&&layout.start);
   const toKey=walk(layout,layout.start,key,'1F key');
   if(!toKey.completed){row.state='failed-to-reach-key';readings.push(row);continue}
   assert.equal(t.nearBasementKey(),true,'arrived by walking, no teleport to key');
   assert.equal(t.useBasementInteraction(),true);
   row.keysTaken=+(r.basementKeyTaken===true);
   assert.equal(row.keysTaken,1);
   const toDoor=walk(layout,key,door,'1F stair');
   if(!toDoor.completed){row.state='failed-to-reach-stair';readings.push(row);continue}
   assert.equal(t.nearBasementDoor(),true,'arrived by walking, no teleport to B1');
   row.surfaceSeconds=+(row.legs.reduce((a,l)=>a+l.seconds,0)).toFixed(2);
   row.clockBeforeB1=+t.remaining().toFixed(2);
   assert.equal(t.useBasementInteraction(),true);
   assert.equal(r.undergroundEntered,true,'the actual one-way basement interaction fires');
   row.clockAfterB1=+t.remaining().toFixed(2);
   assert.ok(Math.abs(row.clockAfterB1-row.clockBeforeB1-120)<.1,
    'B1 must add exactly 120 seconds to the SAME elapsed sortie clock');
   assert.equal(r.duration,420);
   const cache=basementLayout.authoredContainers.find(c=>c.id===
    (objective==='reserve'?'tiled-loot-11':'tiled-loot-10'));
   assert.ok(cache);
   const inbound=walk(basementLayout,basementLayout.start,cache,'B1 cache');
   if(!inbound.completed){row.state='failed-before-B1-loot';readings.push(row);continue}
   t.openContainer();
   assert.equal(r.paused,true);
   const opened=r.containers.find(c=>c.id===r.lootOpenId);
   assert.equal(opened?.id,cache.id);
   const sealed=opened.contents.map(v=>({id:v.id,q:v.q}));
   t.takeAllContainerItems({dataset:{container:opened.id,revision:String(r.lootOpenRevision||0)}});
   assert.deepEqual(r.loot.map(v=>({id:v.id,q:v.q})),sealed,'sealed B1 rewards not rerolled');
   row.lootCount=sealed.length;
   t.closeContainer();
   const toExit=walk(basementLayout,cache,basementLayout.fixedExit,'B1 exit');
   row.b1Seconds=+(row.legs.slice(2).reduce((a,l)=>a+l.seconds,0)).toFixed(2);
   if(!toExit.completed){row.state='failed-during-B1-exit';readings.push(row);continue}
   row.remainingBeforeBank=+t.remaining().toFixed(2);
   t.bank();row.state=state.exploreLastResult?.status||'unsettled';
   assert.equal(row.state,'escaped');
   assert.equal(received.length,sealed.length);
   t.bank();assert.equal(received.length,sealed.length,'idempotent bank with both floors traversed');
   readings.push(row);
  }
 }
 tctx.diagnostic('R6.40 full 1F key/stair → B1 pickup/exit (no-evasion live AI): '+JSON.stringify(readings));
 assert.equal(readings.length,4);
 for(const r of readings){
  assert.ok(r.legs.length>=1);
  assert.ok(r.legs.every(l=>l.steps>0&&l.reached>=0));
  assert.ok(r.legs.some(l=>l.guardsAfter>0),'at least one authored guard must be present after reaching a real movement leg');
 }
});


test('R6.40 remote basement transition cannot bypass surface guards, time or sealed loot',async()=>{
 let now=1_000_000;
 const {t,layout,basementLayout}=await harness(()=>.34,{now:()=>now});
 t.startRun();const r=t.runRef();
 const firstId=r.id,firstDuration=r.duration,firstContainers=JSON.stringify(r.containers);
 const firstGuards=JSON.stringify(r.enemies),firstPending=JSON.stringify(r.pendingGuardPosts);
 assert.equal(r.mapVersion,5);assert.equal(r.undergroundEntered,false);
 assert.equal(t.nearBasementDoor(),false);
 r.basementKeyTaken=true; // legitimate key already collected elsewhere
 const original=t.snapshotRun();
 assert.ok(t.validCheckpoint(original));
 assert.equal(t.enterBasement(),false,'direct helper call from spawn cannot teleport to B1');
 assert.equal(r.undergroundEntered,false);
 assert.equal(r.id,firstId);assert.equal(r.duration,firstDuration);
 assert.equal(JSON.stringify(r.containers),firstContainers,'remote action must not reseal/re-roll rewards');
 assert.equal(JSON.stringify(r.enemies),firstGuards,'no security patrol reset from remote action');
 assert.equal(JSON.stringify(r.pendingGuardPosts),firstPending);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 now+=1500; // elapsed surface time is still payable, even after rejected entry
 r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.nearBasementDoor(),true);
 const remaining=t.remaining();
 assert.equal(t.enterBasement(),true,'same key grants a real one-way entry only at the stairs');
 assert.equal(r.undergroundEntered,true);
 assert.equal(r.id,firstId);
 assert.equal(r.duration,420);
 assert.ok(Math.abs(t.remaining()-remaining-120)<.01);
 assert.equal(r.containers.length,basementLayout.authoredContainers.length);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.equal(t.enterBasement(),false,'cannot re-enter to stack the bonus');
});


// R6.41: Actual sealed ground-floor loot is carried through the locked,
// one-way B1 transition and out again. Unlike synthetic overweight tests,
// this matrix never alters capacity, item weights, rewards or enemy AI.
test('R6.41 sealed 1F cargo → key/stair → B1 U08 → real AI-on extraction, with 0/1/2 ground pickups',async tctx=>{
 const matrix=[];
 for(const seed of [.23,.73]){
  for(const surfaceCount of [0,1,2]){
   let now=1_000_000;
   const {t,layout,basementLayout,state,received}=await harness(()=>seed,{now:()=>now});
   const advance=ms=>{now+=ms};
   t.startRun();const r=t.runRef(),initialId=r.id;
   const sources=['tiled-loot-8','tiled-loot-3'].slice(0,surfaceCount)
    .map(id=>layout.authoredContainers.find(c=>c.id===id));
   assert.equal(sources.length,surfaceCount);
   assert.ok(sources.every(Boolean));
   const row={seed,surfaceCount,status:'started',legs:[],surfaceLoot:[],basementLoot:[],
    cargoBeforeStair:null,cargoAfterStair:null,cargoAtExit:null,pendingAtStair:0};
   let cursor=layout.start,planned=0;
   const walk=(world,target,label)=>{
    const path=r617Path(world,cursor,target),out=r619MeasureReturn(t,world,path,advance);
    row.legs.push({label,tiles:path.length-1,...out});
    if(out.completed)cursor=target;
    return out.completed;
   };
   const collect=(target,floor)=>{
    t.openContainer();
    const box=r.containers.find(c=>c.id===r.lootOpenId);
    if(!r.paused||box?.id!==target.id)return false; // live guard can block interaction
    const sealed=box.contents.map(v=>({id:v.id,q:v.q}));
    assert.ok(sealed.length>0);
    const before=r.loot.length;
    t.takeAllContainerItems({dataset:{container:box.id,revision:String(r.lootOpenRevision||0)}});
    assert.deepEqual(r.loot.slice(before).map(v=>({id:v.id,q:v.q})),sealed,
     'real cache pickup must not change the pre-sealed ID/quality');
    assert.equal(box.contents.length,0);
    row[floor].push({cache:box.id,items:sealed.length});
    planned+=sealed.length;
    t.closeContainer();
    assert.equal(r.paused,false);
    return true;
   };
   let failed=false;
   for(const surface of sources){
    if(!walk(layout,surface,'1F '+surface.id)||!collect(surface,'surfaceLoot')){
     row.status='1F loot blocked/lost';failed=true;break;
    }
   }
   if(failed){matrix.push(row);continue}
   if(!walk(layout,layout.basementKey,'1F key')){
    row.status='lost before key';matrix.push(row);continue;
   }
   assert.equal(t.nearBasementKey(),true);
   assert.equal(t.useBasementInteraction(),true);
   assert.equal(r.basementKeyTaken,true);
   if(!walk(layout,layout.basementEntrance,'1F stair')){
    row.status='lost before stair';matrix.push(row);continue;
   }
   assert.equal(t.nearBasementDoor(),true);
   const groundPicked=r.loot.map(v=>({...v}));
   row.cargoBeforeStair=t.v5CargoRisk();
   const beforeTime=t.remaining(),beforeId=r.id;
   assert.ok(t.validCheckpoint(t.snapshotRun()));
   assert.equal(t.useBasementInteraction(),true);
   assert.equal(r.undergroundEntered,true);
   assert.equal(r.id,initialId);
   assert.equal(r.id,beforeId);
   assert.equal(r.duration,420);
   assert.ok(Math.abs(t.remaining()-beforeTime-120)<.05,
    'the full ground raid has already consumed real in-game time');
   assert.deepEqual(r.loot,groundPicked,
    'ground treasures cannot disappear or re-roll at one-way B1 entry');
   row.cargoAfterStair=t.v5CargoRisk();
   assert.deepEqual(row.cargoAfterStair,row.cargoBeforeStair,
    'the same carried loot and bag capacity must maintain the exact speed penalty');
   row.pendingAtStair=r.pendingGuardPosts.length;
   assert.equal(r.containers.length,9);
   assert.equal(t.validCheckpoint(t.snapshotRun()),true);
   cursor=basementLayout.start;
   const ultra=basementLayout.authoredContainers.find(c=>c.id==='tiled-loot-10');
   assert.ok(ultra&&ultra.tier==='ultra');
   if(!walk(basementLayout,ultra,'B1 red-gold')){
    row.status='lost before red-gold';matrix.push(row);continue;
   }
   if(!collect(ultra,'basementLoot')){
    row.status='B1 pickup blocked';matrix.push(row);continue;
   }
   row.cargoAtExit=t.v5CargoRisk();
   assert.ok(row.cargoAtExit.weight>=row.cargoAfterStair.weight,
    'new B1 loot cannot reduce the load from 1F');
   if(!walk(basementLayout,basementLayout.fixedExit,'B1 exit')){
    row.status='lost on B1 return';matrix.push(row);continue;
   }
   row.remaining=+t.remaining().toFixed(2);
   assert.ok(t.validCheckpoint(t.snapshotRun()));
   t.bank();
   row.status=state.exploreLastResult?.status||'unknown';
   assert.equal(row.status,'escaped');
   assert.equal(received.length,planned,
    'ground and B1 loot must be credited once, not merely B1 loot');
   t.bank();assert.equal(received.length,planned,'repeated exit cannot grant duplicate cargo');
   matrix.push(row);
  }
 }
 assert.equal(matrix.length,6);
 for(const seed of [.23,.73]){
  const same=matrix.filter(r=>r.seed===seed);
  assert.deepEqual(same.map(v=>v.surfaceCount),[0,1,2]);
  assert.equal(same[0].status,'escaped','empty bag baseline should match R6.40');
  const reached=same.filter(v=>v.cargoBeforeStair);
  for(const scenario of reached){
   assert.equal(scenario.surfaceLoot.length,scenario.surfaceCount);
   assert.ok(scenario.cargoAfterStair.pct<=100);
   assert.ok(scenario.legs.some(l=>l.alertSeconds>0),
    'live patrols should detect the player on at least one leg');
  }
  for(let i=1;i<reached.length;i++){
   assert.ok(reached[i].cargoAfterStair.weight>=reached[i-1].cargoAfterStair.weight,
    'additional actually-recovered 1F items increase or maintain cargo weight');
   assert.ok(reached[i].cargoAfterStair.pct<=reached[i-1].cargoAfterStair.pct,
    'real cargo never makes the player run faster');
  }
 }
 tctx.diagnostic('R6.41 real sealed 1F cargo / B1 enemy-on 0-1-2 pickup matrix: '+JSON.stringify(matrix));
});


test('R6.41 overweight surface bag can cancel B1 entry without losing sealed 1F loot, patrol state or raid time',async()=>{
 let now=1_000_000;
 const {t,layout,basementLayout,state,gameWindow,dom}=await harness(()=>.73,{now:()=>now});
 t.startRun();const r=t.runRef();
 for(const id of ['tiled-loot-8','tiled-loot-3']){
  const authored=layout.authoredContainers.find(c=>c.id===id);
  assert.ok(authored);
  r.player.x=authored.x;r.player.y=authored.y; // focused gate fixture, full walking covered above
  t.openContainer();
  assert.equal(r.lootOpenId,id);
  const cache=r.containers.find(c=>c.id===id),sealed=cache.contents.map(v=>({id:v.id,q:v.q}));
  assert.ok(sealed.length);
  t.takeAllContainerItems({dataset:{container:id,revision:String(r.lootOpenRevision||0)}});
  assert.equal(cache.contents.length,0);
  assert.deepEqual(r.loot.slice(-sealed.length).map(v=>({id:v.id,q:v.q})),sealed);
  t.closeContainer();
 }
 r.safeIds=[r.loot[0].tid]; // one actual surface pickup is pouch-protected
 const cargo=t.v5CargoRisk();
 assert.ok(cargo.over>0,'fixed real rewards produce an overloaded bag with no synthetic loot');
 assert.ok(cargo.pct<100);
 r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.nearBasementDoor(),true);
 const btn={dataset:{},textContent:'',setAttribute(key,value){this[key]=value}};
 dom.set('exp-interact',btn);
 t.updateHUD(true);
 assert.match(btn.textContent,/B1へ入る ⚠/);
 assert.match(btn['aria-label'],/kg超過、移動速度/);
 const original=t.snapshotRun(),id=r.id,guards=JSON.stringify(r.enemies),
  pending=JSON.stringify(r.pendingGuardPosts),containers=JSON.stringify(r.containers);
 const confirmations=[],timeBeforeQuestion=t.remaining();
 gameWindow.confirm=message=>{confirmations.push(message);now+=30_000;return false};
 assert.equal(t.useBasementInteraction(),true,'cancelled gate action is consumed');
 assert.ok(Math.abs(t.remaining()-timeBeforeQuestion)<.01,
  '30 seconds of native confirmation wall time must be excluded from the active raid');
 assert.equal(confirmations.length,1);
 assert.match(confirmations[0],/地下は一方通行/);
 assert.match(confirmations[0],/さらに減速/);
 assert.match(confirmations[0],/未保護の戦利品を失います/);
 assert.match(confirmations[0],/移動速度/);
 assert.equal(r.undergroundEntered,false);
 assert.equal(r.id,id);assert.equal(r.duration,300);
 assert.equal(JSON.stringify(r.enemies),guards);
 assert.equal(JSON.stringify(r.pendingGuardPosts),pending);
 assert.equal(JSON.stringify(r.containers),containers);
 assert.deepEqual(t.v5CargoRisk(),cargo,'cancellation must not silently discard treasures');
 const after=t.snapshotRun();delete after.savedAt;delete original.savedAt;
 assert.deepEqual(after,original,'no sealed reward, timer, loot, pouch or checkpoint fields change');
 assert.equal(state.exploreLastResult?.status,undefined);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 const timeBeforeAcceptance=t.remaining();
 gameWindow.confirm=()=>{now+=12_000;return true};
 assert.equal(t.useBasementInteraction(),true,'explicit acceptance now permits entry');
 assert.ok(Math.abs(t.remaining()-timeBeforeAcceptance-120)<.01,
  'accepting after a 12s blocking dialog adds only the real B1 +120s bonus');
 assert.equal(r.undergroundEntered,true);
 assert.equal(r.id,id);assert.equal(r.duration,420);
 assert.deepEqual(t.v5CargoRisk(),cargo,'one-way entry keeps the actual overloaded surface bag');
 assert.equal(r.containers.length,basementLayout.authoredContainers.length);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.41 light surface bag enters B1 without a disruptive extra confirmation',async()=>{
 const {t,layout,gameWindow,dom}=await harness(()=>.23);
 t.startRun();const r=t.runRef();
 const authored=layout.authoredContainers.find(c=>c.id==='tiled-loot-8');
 assert.ok(authored);r.player.x=authored.x;r.player.y=authored.y;
 t.openContainer();assert.equal(r.lootOpenId,authored.id);
 t.takeAllContainerItems({dataset:{container:authored.id,revision:String(r.lootOpenRevision||0)}});
 t.closeContainer();
 assert.equal(t.v5CargoRisk().over,0);
 r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 const btn={dataset:{},textContent:'',setAttribute(key,value){this[key]=value}};
 dom.set('exp-interact',btn);t.updateHUD(true);
 assert.equal(btn.textContent,'B1へ入る');
 assert.doesNotMatch(btn['aria-label'],/kg超過/);
 gameWindow.confirm=()=>{throw Error('a normal-weight user must not be interrupted by an entry dialog')};
 const saved=r.loot.map(v=>({...v}));
 assert.equal(t.useBasementInteraction(),true);
 assert.equal(r.undergroundEntered,true);
 assert.deepEqual(r.loot,saved);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});


// R6.42: Revisit the R6.41 .73 seed that died with 18.6 kg after U08.
// Unlike the earlier test-only reduced-capacity benchmark, every piece of
// cargo is picked up from its real sealed 1F/B1 container, with actual V5
// weight, authored AI and walking collision. No enemy or loot is fabricated.
test('R6.42 full 1F cargo -> B1 U08 -> two-tap discard -> checkpoint -> live-AI extraction',async tctx=>{
 let now=1_000_000;
 const {t,layout,basementLayout,state,received,gameWindow}=await harness(()=>.73,{now:()=>now});
 const advance=ms=>{now+=ms};
 t.startRun();let r=t.runRef();
 const sortieId=r.id,legs=[],recovered=[];
 let cursor=layout.start;
 const walk=(world,target,label)=>{
  const path=r617Path(world,cursor,target);
  const result=r619MeasureReturn(t,world,path,advance);
  legs.push({label,tiles:path.length-1,...result});
  assert.equal(result.completed,true,label+' must be reached through live Tiled collisions and real guards');
  cursor=target;
 };
 const collect=target=>{
  t.openContainer();
  assert.equal(r.paused,true,'opened real authored cache at '+target.id);
  const box=r.containers.find(c=>c.id===r.lootOpenId);
  assert.equal(box?.id,target.id);
  const sealed=box.contents.map(v=>({id:v.id,q:v.q}));
  assert.ok(sealed.length>0,'real source needs sealed loot');
  const before=r.loot.length;
  t.takeAllContainerItems({dataset:{container:box.id,revision:String(r.lootOpenRevision||0)}});
  assert.deepEqual(r.loot.slice(before).map(v=>({id:v.id,q:v.q})),sealed,
   'collecting cannot reroll sealed items');
  assert.equal(box.contents.length,0);
  recovered.push(...r.loot.slice(before).map(v=>({...v})));
  t.closeContainer();
  assert.equal(r.paused,false);
 };
 for(const id of ['tiled-loot-8','tiled-loot-3']){
  const cache=layout.authoredContainers.find(c=>c.id===id);
  assert.ok(cache);
  walk(layout,cache,'1F '+id);
  collect(cache);
 }
 walk(layout,layout.basementKey,'1F basement key');
 assert.equal(t.nearBasementKey(),true);
 assert.equal(t.useBasementInteraction(),true);
 walk(layout,layout.basementEntrance,'1F basement stair');
 assert.equal(t.nearBasementDoor(),true);
 assert.ok(t.v5CargoRisk().over>0,'real 1F pickups should exceed the normal 12 kg capacity');
 const clockAtStair=t.remaining();
 assert.equal(t.useBasementInteraction(),true);
 assert.equal(r.undergroundEntered,true);
 assert.equal(r.id,sortieId);
 assert.ok(Math.abs(t.remaining()-clockAtStair-120)<.05,'B1 adds time only once');
 cursor=basementLayout.start;
 const ultra=basementLayout.authoredContainers.find(c=>c.id==='tiled-loot-10');
 assert.ok(ultra&&ultra.tier==='ultra');
 walk(basementLayout,ultra,'B1 red-gold U08');
 collect(ultra);
 const heavy=t.v5CargoRisk();
 assert.ok(heavy.over>0&&heavy.pct<50,'the real U08 return starts severely overloaded');
 assert.ok(heavy.weight>=180,'actual seed should carry about 18.6 kg, not test-injected ballast');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 const sealedOtherCaches=JSON.stringify(r.containers.map(c=>({id:c.id,contents:c.contents})));
 const activeGuards=r.enemies.length,pending=r.pendingGuardPosts.length;
 // Protect ONE real pickup. The player can jettison other valuables but must
 // never accidentally throw away the pouch-protected item.
 const protectedItem=r.loot.reduce((a,b)=>t.weightTenths(a.id)<=t.weightTenths(b.id)?a:b);
 t.togglePause();
 assert.equal(r.paused,true);
 const protectIndex=r.loot.findIndex(v=>v.tid===protectedItem.tid);
 gameWindow.explorationAction({dataset:{explore:'protect',i:String(protectIndex),tid:String(protectedItem.tid)}});
 assert.ok(r.safeIds.includes(protectedItem.tid));
 const dropped=[];
 // Real item selection by weight, not synthetic entries or test-only changes
 // to carrying capacity; use the actual paused-bag two-tap action.
 while(t.v5CargoRisk().pct<84){
  const candidates=r.loot.filter(v=>!r.safeIds.includes(v.tid))
   .sort((a,b)=>t.weightTenths(b.id)-t.weightTenths(a.id));
  assert.ok(candidates.length,'sufficient real unprotected cargo must be available to regain speed');
  const chosen=candidates[0],i=r.loot.findIndex(v=>v.tid===chosen.tid);
  const button={dataset:{explore:'drop',i:String(i),tid:String(chosen.tid)},
   textContent:'捨てる',setAttribute(){}};
  const quantity=r.loot.length,clock=t.remaining();
  gameWindow.explorationAction(button);
  assert.equal(r.loot.length,quantity,'first tap must not drop valuable loot');
  assert.equal(button.dataset.dropConfirmTid,String(chosen.tid));
  gameWindow.explorationAction(button);
  assert.equal(r.loot.length,quantity-1,'second tap drops exactly the selected identity');
  assert.ok(!r.loot.some(v=>v.tid===chosen.tid));
  assert.ok(r.safeIds.includes(protectedItem.tid),'protected cargo survives each drop');
  assert.ok(Math.abs(t.remaining()-clock)<.01,'inventory management while paused cannot drain raid time');
  dropped.push({...chosen});
  assert.ok(dropped.length<=recovered.length,'discard loop must terminate');
 }
 const light=t.v5CargoRisk();
 assert.ok(dropped.length>0);
 assert.ok(light.weight<heavy.weight&&light.pct>heavy.pct,
  'giving up real loot must recover actual movement speed');
 assert.equal(r.stats.weightLimit,12,'do not cheat by changing the carrying capacity');
 assert.equal(JSON.stringify(r.containers.map(c=>({id:c.id,contents:c.contents}))),sealedOtherCaches,
  'manual discard may not reseal or reroll any cache');
 assert.equal(r.enemies.length,activeGuards,'pausing and dropping do not create enemies');
 assert.equal(r.pendingGuardPosts.length,pending,'patrol activation state stays intact');
 const expected=r.loot.map(v=>({...v}));
 const checkpoint=t.snapshotRun();
 assert.equal(t.validCheckpoint(checkpoint),true);
 state.exploreRun=checkpoint;
 t.resetRun();t.restoreRunIfNeeded();
 r=t.runRef();
 assert.ok(r&&r.paused,'checkpoint resumes safely paused at the same spot');
 assert.equal(r.id,sortieId);
 assert.deepEqual(r.loot,expected,'dropped items must not return after checkpoint restoration');
 assert.deepEqual(r.safeIds,[protectedItem.tid],'protected pouch must preserve exact token');
 assert.deepEqual(t.v5CargoRisk(),light,'speed recovery persists after restoration');
 assert.equal(r.containers.find(c=>c.id===ultra.id).contents.length,0);
 assert.ok(Math.hypot(r.player.x-ultra.x,r.player.y-ultra.y)<30);
 t.togglePause();
 assert.equal(r.paused,false);
 walk(basementLayout,basementLayout.fixedExit,'B1 extraction after actual discard');
 assert.ok(legs.some(v=>v.alertSeconds>0),'patrol detection must actually run in the full route');
 assert.ok(r.enemies.length>0,'B1 extraction cannot silently turn off enemies');
 assert.ok(t.remaining()>0);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 t.bank();
 assert.equal(state.exploreLastResult?.status,'escaped','reduced cargo should reach B1 exit alive');
 assert.equal(received.length,expected.length,'only retained cargo is paid out');
 assert.deepEqual(received.map(v=>({id:v.id,q:v.q})),
  expected.map(v=>({id:v.id,q:v.q})),'claimed cargo matches retained sealed rewards');
 for(const gone of dropped)assert.ok(!expected.some(v=>v.tid===gone.tid));
 const credits=received.length;
 t.bank();assert.equal(received.length,credits,'repeated settlement cannot duplicate rewards');
 tctx.diagnostic('R6.42 real cargo jettison and AI-on extraction: '+JSON.stringify({
  seed:.73,heavy,light,protectedId:protectedItem.id,
  discarded:dropped.map(v=>({id:v.id,tid:v.tid})),
  retained:expected.length,legs:legs.map(v=>({label:v.label,seconds:v.seconds,
   alertSeconds:v.alertSeconds,hits:v.hits,maxGuards:v.maxGuards})),
  result:state.exploreLastResult.status
 }));
});


// R6.43: Simulate two mobile screen edges on the real pointer handler.
// The rendered ring should never cross from the joystick's left safe-area
// box into the action buttons or the home gesture strip. Movement input
// remains free to reach full strength without relying on visual position.
test('R6.43 floating joystick ring stays within the safe thumb zone at screen edges',async()=>{
 const {t,dom}=await harness(()=>.23);
 t.startRun();
 const r=t.runRef(),events=new Map();
 const area={left:49,top:245,right:390,bottom:620,width:341,height:375};
 const classes=new Set();
 const zone={
  addEventListener:(name,handler)=>events.set(name,handler),
  getBoundingClientRect:()=>area,
  closest:()=>({getBoundingClientRect:()=>({left:0,top:0,right:780,bottom:650})}),
  classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},
  setPointerCapture(){},hasPointerCapture:()=>false
 };
 const stick={offsetWidth:112,style:{}},thumb={offsetWidth:36,style:{}};
 dom.set('exp-stick-zone',zone);dom.set('exp-stick',stick);dom.set('exp-stick-thumb',thumb);
 t.bindStick();
 const assertRingInZone=label=>{
  const cx=area.left+parseFloat(stick.style.left);
  const cy=area.top+parseFloat(stick.style.top);
  const radius=stick.offsetWidth/2;
  assert.ok(cx-radius>=area.left-0.01,label+' ring crosses left safe inset');
  assert.ok(cx+radius<=area.right+0.01,label+' ring crosses the action-button half');
  assert.ok(cy-radius>=area.top-0.01,label+' ring crosses top of left touch quadrant');
  assert.ok(cy+radius<=area.bottom+0.01,label+' ring crosses the home gesture inset');
 };
 const send=(name,point)=>events.get(name)({pointerId:7,pointerType:'touch',
  clientX:point[0],clientY:point[1],preventDefault(){}});
 send('pointerdown',[area.right-1,area.bottom-1]);
 assert.ok(classes.has('is-active'));assertRingInZone('bottom/right');
 send('pointermove',[area.right+36,area.bottom+25]);
 assert.ok(r.joy.x>0&&r.joy.y>0,'dragging beyond hitbox continues to steer via pointer capture');
 send('pointerup',[area.right+36,area.bottom+25]);
 assert.ok(!classes.has('is-active'));
 assert.deepEqual(r.joy,{x:0,y:0},'finger release must stop movement');
 send('pointerdown',[area.left+1,area.top+1]);
 assertRingInZone('top/left');
 send('pointercancel',[area.left+1,area.top+1]);
 assert.deepEqual(r.joy,{x:0,y:0},'cancelled gesture must stop movement');
 // Simulate a narrow portrait phone with the 34px home gesture strip excluded.
 Object.assign(area,{left:0,top:422,right:195,bottom:810,width:195,height:388});
 send('pointerdown',[area.right-1,area.bottom-1]);
 assertRingInZone('portrait bottom/right');
 send('pointerup',[area.right-1,area.bottom-1]);
 send('pointerdown',[area.left+1,area.top+1]);
 assertRingInZone('portrait top/left');
 send('pointerup',[area.left+1,area.top+1]);
 assert.deepEqual(r.joy,{x:0,y:0});
 const css=read('exploration.css');
 assert.match(css,/R6\.43: The floating joystick/);
 assert.match(css,/width:calc\(50vw - env\(safe-area-inset-left\)\)!important/);
 assert.match(css,/height:calc\(50dvh - env\(safe-area-inset-bottom\)\)!important/);
});


// R6.44: On a phone the pause dialog can contain many loot rows, and the
// detailed Tiled map contains legends and extra route information below the
// image. A back/resume action must remain at the TOP of each scrollable panel.
// The existing footer action remains for desktop and screen readers. These
// buttons reuse known actions; no new raid, timer or save state is introduced.
test('R6.44 mobile overlays keep reachable top actions without changing map/pause transitions',async()=>{
 const {t,gameWindow,state}=await harness(()=>.31);
 t.startRun();
 const r=t.runRef(),raidId=r.id,originalEnemies=JSON.stringify(r.enemies);
 assert.equal(r.paused,false);
 gameWindow.explorationAction({dataset:{explore:'field-map'}});
 assert.equal(r.paused,true);
 assert.equal(r.showMap,true);
 assert.equal(r.mapDirect,true);
 const direct=t.pausePanel();
 assert.match(direct,/class="exp-overlay-close exp-map-close" data-explore="map-back" aria-label="探索へ戻る"/);
 assert.match(direct,/class="exp-resume" data-explore="map-back"/,'existing bottom back remains');
 assert.equal((direct.match(/data-explore="map-back"/g)||[]).length,2);
 gameWindow.explorationAction({dataset:{explore:'map-back'}});
 assert.equal(r.paused,false,'top map action returns to active exploration when directly opened');
 assert.equal(r.showMap,false);
 assert.equal(r.mapDirect,false);
 t.togglePause();
 assert.equal(r.paused,true);
 const paused=t.pausePanel();
 assert.match(paused,/class="exp-pause-heading"/);
 assert.match(paused,/class="exp-overlay-close exp-pause-close" data-explore="pause" aria-label="探索を再開"/);
 assert.match(paused,/class="exp-resume" data-explore="pause"/,'existing resume remains');
 gameWindow.explorationAction({dataset:{explore:'map'}});
 assert.equal(r.paused,true);
 assert.equal(r.showMap,true);
 assert.equal(r.mapDirect,false);
 const nested=t.pausePanel();
 assert.match(nested,/class="exp-overlay-close exp-map-close" data-explore="map-back" aria-label="一時停止メニューへ戻る"/);
 gameWindow.explorationAction({dataset:{explore:'map-back'}});
 assert.equal(r.paused,true,'top map back returns to pause when opened from pause');
 assert.equal(r.showMap,false);
 gameWindow.explorationAction({dataset:{explore:'pause'}});
 assert.equal(r.paused,false,'top pause resume closes the dialog');
 assert.equal(r.id,raidId);
 assert.equal(JSON.stringify(r.enemies),originalEnemies);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.equal(state.exploreLastResult?.status,undefined,'opening overlays never settles the raid');
});

test('R6.44 bag, pause and map scrolling retain sticky 44px exits and small-landscape map',async()=>{
 const css=read('exploration.css');
 const patch=css.slice(css.indexOf('/* R6.44: The mobile bag'));
 assert.ok(patch.startsWith('/* R6.44:'),'mobile overlay rules are present');
 assert.match(patch,/\.exp-backpack\.exp-bag-open \.exp-bag-title\{\s*position:sticky;top:0;z-index:3/);
 assert.match(patch,/\.exp-pause-card \.exp-pause-heading,[\s\S]*?\.exp-map-v5-heading\{\s*position:sticky;top:0/);
 assert.match(patch,/\.exp-pause-card \.exp-overlay-close\{[\s\S]*?min-height:44px/);
 assert.match(patch,/@media \(orientation:landscape\) and \(max-height:650px\) and \(max-width:1100px\)/);
 assert.match(patch,/\.exp-map-v5-card \.exp-map-v5-scroll\{\s*min-height:116px;max-height:min\(40dvh,210px\)/);
 const html=read('index.html');
 assert.equal((html.match(/overlay=R6\.44/g)||[]).length,2,
  'Safari must refresh both the CSS and JS layout when using cached PWA assets');
 // Legacy V3/V4 markup remains untouched: every new sticky rule is V5-scoped.
 assert.doesNotMatch(patch,/body\.exp-immersive \.exp-playing(?!\.exp-v5-layout) \.exp-pause-card/);
});


// R6.45: Safari fires resize/orientationchange while an open V5 bag or
// detailed map scrolls, sometimes followed by a second visualViewport resize.
// The same run/clock/save continues; only invalid DOM scroll offsets clamp.
test('R6.45 portrait to landscape bag rotation clamps scroll without pausing or losing cargo',async()=>{
 let now=1_000_000;
 const {t,dom,gameWindow,windowEvents,rafQueue,state}=await harness(()=>.31,{now:()=>now});
 t.startRun();const r=t.runRef();
 const runId=r.id,original=t.snapshotRun(),originalPlayer={...r.player};
 let viewport={w:390,h:844,top:50,bottom:110};
 const shell={
  querySelector(sel){return sel==='.exp-v5-toprail'?rail:sel==='.exp-v5-bottomdock'?dock:null},
  getBoundingClientRect(){return {top:0,bottom:viewport.h}},
  style:{getPropertyValue(){return ''},setProperty(){}}
 };
 const rail={getBoundingClientRect(){return {bottom:viewport.top}}};
 const dock={getBoundingClientRect(){return {top:viewport.h-viewport.bottom}}};
 const canvas={getBoundingClientRect(){return {width:viewport.w,height:viewport.h}},width:0,height:0};
 dom.set('.exp-shell.exp-playing.exp-v5-layout',shell);
 dom.set('exp-field',canvas);
 const bag={
  classList:{open:false,contains(x){return x==='exp-bag-open'&&this.open},
   toggle(x){if(x==='exp-bag-open')this.open=!this.open;return this.open},
   remove(x){if(x==='exp-bag-open')this.open=false}},
  scrollWidth:340,clientWidth:340,scrollLeft:0,
  scrollHeight:1400,clientHeight:480,scrollTop:875
 };
 dom.set('exp-backpack',bag);
 gameWindow.explorationAction({dataset:{explore:'bag'}});
 assert.equal(bag.classList.open,true);
 viewport={w:844,h:390,top:48,bottom:75};
 bag.scrollHeight=1060;bag.clientHeight=350;
 assert.equal(windowEvents.has('orientationchange'),true);
 windowEvents.get('orientationchange')();
 assert.equal(canvas.width,844);
 assert.equal(canvas.height,390);
 assert.equal(bag.scrollTop,710,'out-of-bounds portrait bag scroll clamps to landscape view');
 assert.equal(rafQueue.length,1,'delayed Safari geometry pass is scheduled');
 bag.clientHeight=480; // Safari toolbar/visual viewport settles one frame later
 rafQueue.shift()();
 assert.equal(bag.scrollTop,580,'second pass clamps to final Safari viewport');
 assert.equal(r.paused,false);
 assert.equal(r.showMap,false);
 assert.equal(r.id,runId);
 assert.deepEqual(r.player,originalPlayer);
 const final=t.snapshotRun();delete final.savedAt;delete original.savedAt;
 assert.deepEqual(final,original,'rotation may not change loot, enemy state, raid time or checkpoint');
 assert.equal(state.exploreLastResult?.status,undefined);
 assert.equal(windowEvents.has('visualViewport:resize'),true);
 windowEvents.get('visualViewport:resize')();
 assert.equal(rafQueue.length,1);
 rafQueue.shift()();
 assert.equal(bag.classList.open,true,'visual viewport reflow must not dismiss the bag');
});

test('R6.45 zoomed detailed map stays open on rotation and clamps both scroll axes',async()=>{
 let now=1_000_000;
 const {t,dom,gameWindow,windowEvents,rafQueue}=await harness(()=>.31,{now:()=>now});
 t.startRun();const r=t.runRef();
 let viewport={w:844,h:390};
 const rail={getBoundingClientRect(){return {bottom:50}}};
 const dock={getBoundingClientRect(){return {top:viewport.h-80}}};
 const shell={querySelector(sel){return sel==='.exp-v5-toprail'?rail:sel==='.exp-v5-bottomdock'?dock:null},
  getBoundingClientRect(){return {top:0,bottom:viewport.h}},
  style:{getPropertyValue(){return ''},setProperty(){}}};
 const canvas={getBoundingClientRect(){return {width:viewport.w,height:viewport.h}},width:0,height:0};
 dom.set('.exp-shell.exp-playing.exp-v5-layout',shell);dom.set('exp-field',canvas);
 const panel={scrollTop:670,scrollLeft:0,scrollWidth:700,clientWidth:700,
  scrollHeight:1900,clientHeight:800};
 dom.set('exp-pause-layer',{innerHTML:'',querySelector:()=>panel});
 const map={scrollLeft:1600,scrollTop:1300,scrollWidth:2250,scrollHeight:1700,
  clientWidth:650,clientHeight:400};
 dom.set('exp-map-scroll',map);
 gameWindow.explorationAction({dataset:{explore:'field-map'}});
 assert.equal(r.paused,true);assert.equal(r.showMap,true);assert.equal(r.mapDirect,true);
 r.mapZoom=2.5;
 const snapshot=t.snapshotRun();
 viewport={w:390,h:844};
 panel.clientHeight=1200;map.clientWidth=1080;map.clientHeight=800;
 windowEvents.get('resize')();
 assert.equal(canvas.width,390);
 assert.equal(canvas.height,844);
 assert.equal(panel.scrollTop,670,'valid scroll is preserved until Safari finishes resizing');
 assert.equal(map.scrollLeft,1170,'horizontal zoom pan clamps to new viewport');
 assert.equal(map.scrollTop,900,'vertical zoom pan clamps to new viewport');
 panel.clientHeight=1400;map.clientWidth=1300;map.clientHeight=900;
 rafQueue.shift()();
 assert.equal(panel.scrollTop,500,'pause/map pane scroll follows final viewport');
 assert.equal(map.scrollLeft,950);assert.equal(map.scrollTop,800);
 assert.equal(r.mapZoom,2.5);
 assert.equal(r.paused,true);assert.equal(r.showMap,true);assert.equal(r.mapDirect,true);
 const restored=t.snapshotRun();delete restored.savedAt;delete snapshot.savedAt;
 assert.deepEqual(restored,snapshot,'map rotation changes no persistent run fields');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.45 short portrait phone bag can use whole safe visible area without affecting V3/V4',()=>{
 const css=read('exploration.css'),part=css.slice(css.indexOf('/* R6.45: On very short'));
 assert.ok(part.startsWith('/* R6.45:'),'short portrait fallback is defined');
 assert.match(part,/@media \(orientation:portrait\) and \(max-height:650px\) and \(max-width:1100px\)/);
 assert.match(part,/body\.exp-immersive \.exp-shell\.exp-playing\.exp-v5-layout \.exp-backpack/);
 assert.match(part,/top:calc\(env\(safe-area-inset-top\) \+ 5px\)!important/);
 assert.match(part,/bottom:calc\(env\(safe-area-inset-bottom\) \+ 5px\)!important/);
 assert.match(read('exploration.js'),/if\(run\.showMap\)clampScroll\(document\.getElementById\('exp-map-scroll'\)\)/);
 assert.match(read('exploration.js'),/requestAnimationFrame\(\(\)=>\{[\s\S]*?settleV5OverlayAfterViewportChange\(\)/);
});


// R6.46: Real Safari touchstart may arrive again for a second finger (or an
// already-held touch identifier). One physical button hold must activate at
// most once, and the delayed click can be delivered AFTER the target changes.
test('R6.46 held action fingers never toggle AUTO twice or leak synthetic clicks',async()=>{
 let now=1_000_000;
 const {t,dom,gameWindow}=await harness(()=>.31,{now:()=>now});
 t.startRun();const r=t.runRef(),listeners=new Map();
 const mk=type=>({disabled:false,dataset:{explore:type},
  closest(sel){return sel==='button[data-explore]'?this:null}});
 const buttons={auto:mk('auto'),attack:mk('attack'),bag:mk('bag')};
 const actions={dataset:{},addEventListener:(name,fn)=>listeners.set(name,fn),
  contains:b=>Object.values(buttons).includes(b)};
 dom.set('.exp-playing .exp-control-actions',actions);
 t.bindMultiTouchActions();t.bindMultiTouchActions();
 assert.deepEqual([...listeners.keys()],['touchstart','touchend','touchcancel','click']);
 let prevented=0,stopped=0;
 const start=(button,id)=>listeners.get('touchstart')({target:button,cancelable:true,
  changedTouches:[{identifier:id}],preventDefault(){prevented++}});
 const end=(id,target)=>listeners.get('touchend')({target:target||buttons.auto,
  changedTouches:[{identifier:id}]});
 const cancel=(id,target)=>listeners.get('touchcancel')({target:target||buttons.auto,
  changedTouches:[{identifier:id}]});
 const click=(button,detail=1)=>listeners.get('click')({target:button,detail,
  preventDefault(){prevented++},stopPropagation(){stopped++}});
 assert.equal(r.autoAttack,false);
 start(buttons.auto,21);assert.equal(r.autoAttack,true);
 start(buttons.auto,21); // duplicated touch identifier
 start(buttons.auto,22); // another finger while original is still held
 assert.equal(r.autoAttack,true,'held AUTO must not toggle twice');
 assert.equal(prevented,3,'all redundant touchscreen gestures still prevent Safari scroll');
 end(21,{closest:()=>null}); // bag/modal replacement may alter touchend.target
 click(buttons.auto);click(buttons.auto);
 assert.equal(stopped,2,'both synthetic clicks are suppressed, not just the first');
 assert.equal(r.autoAttack,true);
 click(buttons.auto,0);
 assert.equal(stopped,2,'keyboard synthesized click detail=0 must remain accessible');
 // Ignored secondary finger does not own the button, and can release safely.
 end(22,{closest:()=>null});
 now+=651;click(buttons.auto);
 assert.equal(stopped,2,'suppression expires after the native click window');
 start(buttons.auto,23);assert.equal(r.autoAttack,false,'fresh physical tap works');
 now+=1900;
 cancel(23,{closest:()=>null});
 click(buttons.auto);
 assert.equal(stopped,3,'long-press cancellation suppresses late synthetic click');
 assert.equal(r.autoAttack,false);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.46 left joystick stays independent of Attack/AUTO and stops on Bag touch',async()=>{
 let now=1_000_000;
 const {t,dom}=await harness(()=>.31,{now:()=>now});
 t.startRun();const r=t.runRef(),joystick=new Map(),actionsEvents=new Map();
 const area={left:0,top:410,right:195,bottom:810,width:195,height:400};
 const classes=new Set(),captured=new Set();
 const zone={addEventListener:(name,fn)=>joystick.set(name,fn),
  getBoundingClientRect:()=>area,
  classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},
  setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),
  releasePointerCapture:id=>captured.delete(id)};
 const stick={offsetWidth:100,style:{}},thumb={offsetWidth:36,style:{}};
 const buttons=Object.fromEntries(['attack','auto','bag'].map(type=>
  [type,{disabled:false,dataset:{explore:type},
   closest(sel){return sel==='button[data-explore]'?this:null}}]));
 const actions={dataset:{},addEventListener:(name,fn)=>actionsEvents.set(name,fn),
  contains:b=>Object.values(buttons).includes(b)};
 const bag={classList:{open:false,contains(v){return v==='exp-bag-open'&&this.open},
  toggle(v){this.open=!this.open;return this.open},
  remove(){this.open=false}}};
 dom.set('exp-stick-zone',zone);dom.set('exp-stick',stick);dom.set('exp-stick-thumb',thumb);
 dom.set('.exp-playing .exp-control-actions',actions);
 dom.set('exp-backpack',bag);
 t.bindStick();t.bindMultiTouchActions();
 let prevented=0;
 const sendJoy=(name,x,y,id=1)=>joystick.get(name)({
  pointerId:id,pointerType:'touch',clientX:x,clientY:y,
  preventDefault(){prevented++}});
 const touch=(type,id)=>actionsEvents.get('touchstart')({
  target:buttons[type],changedTouches:[{identifier:id}],cancelable:true,
  preventDefault(){prevented++}});
 sendJoy('pointerdown',70,710);
 sendJoy('pointermove',100,690);
 assert.ok(r.joy.x>.4&&r.joy.y<-.3,'first finger steers the real joystick');
 const before={...r.joy};
 touch('auto',44);
 assert.equal(r.autoAttack,true,'AUTO is toggled by the second finger');
 assert.deepEqual(r.joy,before,'AUTO does not interrupt steering');
 r.attackAt=0;touch('attack',45);
 assert.ok(r.attackAt>0,'attack fires while the first finger keeps steering');
 assert.deepEqual(r.joy,before,'manual Attack preserves the original joystick vector');
 actionsEvents.get('touchend')({target:buttons.attack,changedTouches:[{identifier:45}]});
 actionsEvents.get('touchend')({target:buttons.auto,changedTouches:[{identifier:44}]});
 touch('bag',46);
 assert.equal(bag.classList.open,true);
 assert.deepEqual(r.joy,{x:0,y:0},'opening the bag explicitly stops movement');
 assert.equal(classes.has('is-active'),false,'joystick ring is hidden on bag open');
 assert.equal(captured.size,0,'old pointer capture released when bag opens');
 sendJoy('pointerdown',70,710,2);
 assert.deepEqual(r.joy,{x:0,y:0},'bag disallows starting a new joystick gesture');
 // Duplicate Safari click cannot close the newly opened bag.
 actionsEvents.get('touchend')({target:{closest:()=>null},
  changedTouches:[{identifier:46}]});
 let stopped=0;
 actionsEvents.get('click')({target:buttons.bag,detail:1,preventDefault(){},
  stopPropagation(){stopped++}});
 assert.equal(stopped,1);
 assert.equal(bag.classList.open,true);
 sendJoy('pointerup',100,690);
 assert.deepEqual(r.joy,{x:0,y:0});
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});


test('R6.46 second-finger Interact opens one real cache while releasing the first joystick finger',async()=>{
 let now=1_000_000;
 const {t,dom}=await harness(()=>.31,{now:()=>now});
 t.startRun();const r=t.runRef(),zoneEvents=new Map(),actionEvents=new Map();
 const cache=r.containers.find(c=>!c.opened);
 assert.ok(cache,'a sealed physical Tiled cache exists');
 r.player.x=cache.x;r.player.y=cache.y;
 const zone={addEventListener:(name,fn)=>zoneEvents.set(name,fn),
  getBoundingClientRect:()=>({left:0,top:400,right:195,bottom:820}),
  classList:{add(){},remove(){}},setPointerCapture(){},hasPointerCapture:()=>false};
 const stick={offsetWidth:100,style:{}},thumb={offsetWidth:36,style:{}};
 const button={disabled:false,dataset:{explore:'context',context:'container'},
  closest(sel){return sel==='button[data-explore]'?this:null}};
 const actions={dataset:{},addEventListener:(name,fn)=>actionEvents.set(name,fn),
  contains:b=>b===button};
 dom.set('exp-stick-zone',zone);dom.set('exp-stick',stick);dom.set('exp-stick-thumb',thumb);
 dom.set('.exp-playing .exp-control-actions',actions);
 t.bindStick();t.bindMultiTouchActions();
 const move=(name,x,y)=>zoneEvents.get(name)({pointerId:8,pointerType:'touch',
  clientX:x,clientY:y,preventDefault(){}});
 move('pointerdown',70,700);move('pointermove',100,700);
 assert.ok(r.joy.x>.4,'the left finger is actively walking before Interact');
 const beforeId=r.id,originalContents=JSON.stringify(cache.contents);
 let stopped=0;
 actionEvents.get('touchstart')({target:button,changedTouches:[{identifier:77}],
  cancelable:true,preventDefault(){}});
 assert.equal(r.paused,true,'real Interact opens the existing loot pause dialog');
 assert.equal(r.lootOpenId,cache.id,'the selected physical cache is the one opened');
 assert.deepEqual(r.joy,{x:0,y:0},'loot modal releases the first moving finger');
 actionEvents.get('touchend')({target:{closest:()=>null},
  changedTouches:[{identifier:77}]});
 for(let i=0;i<2;i++)actionEvents.get('click')({target:button,detail:1,
  preventDefault(){},stopPropagation(){stopped++}});
 assert.equal(stopped,2,'duplicate click events cannot activate Interact again');
 assert.equal(r.paused,true);
 assert.equal(r.lootOpenId,cache.id);
 assert.equal(JSON.stringify(cache.contents),originalContents,'open alone does not reroll or collect sealed rewards');
 assert.equal(r.id,beforeId);
 t.closeContainer();
 assert.equal(r.paused,false);
 assert.equal(r.lootOpenId,null);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});


// R6.47: An unpaused bag is *not* a combat control. Previously it released
// run.joy but retained eased run.steer and any held keyboard keys; those could
// move the player while the inventory covered the world. Hidden controls
// beneath the overlay could also still respond to dispatched actions.
test('R6.47 opening the V5 bag stops all movement and blocks hidden combat controls',async()=>{
 const {t,dom,gameWindow,documentEvents}=await harness(()=>.31);
 t.startRun();const r=t.runRef();
 r.enemies=[];
 const bag={classList:{
  open:false,contains(v){return v==='exp-bag-open'&&this.open},
  toggle(){this.open=!this.open;return this.open},
  remove(){this.open=false}
 }};
 dom.set('exp-backpack',bag);
 const onKey=documentEvents.get('keydown');
 onKey({key:'w',target:{tagName:'DIV'},preventDefault(){}});
 r.joy={x:0.8,y:-0.3};
 r.steer={x:0.87,y:-0.35};
 gameWindow.explorationAction({dataset:{explore:'bag'}});
 assert.equal(bag.classList.open,true);
 assert.deepEqual(r.joy,{x:0,y:0},'bag clears virtual movement');
 assert.deepEqual(r.steer,{x:0,y:0},'bag stops eased movement inertia');
 const x=r.player.x,y=r.player.y,auto=r.autoAttack,attack=r.attackAt;
 t.tick(.05);
 assert.equal(r.player.x,x,'bag does not drift sideways after joystick release');
 assert.equal(r.player.y,y,'held w key must not continue moving behind the bag');
 gameWindow.explorationAction({dataset:{explore:'auto'}});
 gameWindow.explorationAction({dataset:{explore:'attack'}});
 gameWindow.explorationAction({dataset:{explore:'swap'}});
 gameWindow.explorationAction({dataset:{explore:'context',context:'exit'}});
 assert.equal(r.autoAttack,auto,'AUTO cannot toggle through inventory');
 assert.equal(r.attackAt,attack,'attack cannot fire through inventory');
 assert.equal(r.status,'playing','hidden exit interaction cannot bank loot');
 onKey({key:'j',target:{tagName:'DIV'},preventDefault(){}});
 onKey({key:'w',target:{tagName:'DIV'},preventDefault(){}});
 t.tick(.05);
 assert.equal(r.player.x,x,'keyboard w remains blocked while bag open');
 assert.equal(r.player.y,y);
 assert.equal(r.attackAt,attack,'keyboard attack remains blocked');
 gameWindow.explorationAction({dataset:{explore:'bag-close'}});
 assert.equal(bag.classList.open,false);
 gameWindow.explorationAction({dataset:{explore:'auto'}});
 assert.equal(r.autoAttack,!auto,'normal AUTO works immediately after closing the bag');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.47 stale touch hold retires across bag and pause but keeps late click protection',async()=>{
 let now=1_000_000;
 const {t,dom,gameWindow}=await harness(()=>.31,{now:()=>now});
 t.startRun();const r=t.runRef();
 const listeners=new Map();
 const buttons=Object.fromEntries(['bag','auto'].map(type=>[type,{
  disabled:false,dataset:{explore:type},closest(sel){return sel==='button[data-explore]'?this:null}
 }]));
 const actions={dataset:{},addEventListener:(name,fn)=>listeners.set(name,fn),
  contains:b=>Object.values(buttons).includes(b)};
 const bag={classList:{open:false,
  contains(v){return v==='exp-bag-open'&&this.open},
  toggle(){this.open=!this.open;return this.open},
  remove(){this.open=false}}};
 dom.set('.exp-playing .exp-control-actions',actions);dom.set('exp-backpack',bag);
 t.bindMultiTouchActions();
 let syntheticBlocked=0;
 const touch=(type,id)=>listeners.get('touchstart')({target:buttons[type],
  changedTouches:[{identifier:id}],cancelable:true,preventDefault(){}});
 const finish=(type,id,target={closest:()=>null})=>listeners.get(type)({
  target,changedTouches:[{identifier:id}]});
 const click=type=>listeners.get('click')({target:buttons[type],detail:1,
  preventDefault(){},stopPropagation(){syntheticBlocked++}});
 touch('bag',9);assert.equal(bag.classList.open,true);
 // The old touchend was dispatched to a detached modal target after a long hold.
 now+=1900;finish('touchend',9);click('bag');click('bag');
 assert.equal(syntheticBlocked,2,'long hold ending elsewhere still blocks click burst');
 assert.equal(bag.classList.open,true,'stale Safari click cannot close the inventory');
 gameWindow.explorationAction({dataset:{explore:'bag-close'}});
 assert.equal(bag.classList.open,false);
 const autoBefore=r.autoAttack;
 touch('auto',9);assert.equal(r.autoAttack,!autoBefore,'recycled touch ID works after bag');
 gameWindow.explorationAction({dataset:{explore:'field-map'}});
 assert.equal(r.paused,true);assert.equal(r.showMap,true);
 gameWindow.explorationAction({dataset:{explore:'map-back'}});
 assert.equal(r.paused,false);assert.equal(r.showMap,false);
 now+=1900;finish('touchcancel',9);click('auto');
 assert.equal(syntheticBlocked,3,'touch cancelled after leaving map still blocks late synthetic click');
 assert.equal(r.autoAttack,!autoBefore);
 // Even if WebKit never sent touchcancel, pause clears the hold ID before a new press.
 touch('auto',23);assert.equal(r.autoAttack,autoBefore);
 t.togglePause();assert.equal(r.paused,true);
 t.togglePause();assert.equal(r.paused,false);
 touch('auto',23);
 assert.equal(r.autoAttack,!autoBefore,'no stale hold survives pause/resume');
 finish('touchend',23);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});


// R6.48: Reproduce Safari's third finger: pointer 1 keeps moving while
// two independent changedTouches target AUTO and Attack. Duplicate touch
// starts/long holds/click bursts must never change the AUTO state twice.
test('R6.48 three-finger steering plus AUTO and Attack tolerates long holds and rapid taps',async()=>{
 let now=1_000_000;
 const {t,dom}=await harness(()=>.31,{now:()=>now});
 t.startRun();const r=t.runRef();
 const pointerEvents=new Map(),actionEvents=new Map(),captures=new Set();
 const zone={addEventListener:(k,v)=>pointerEvents.set(k,v),
  getBoundingClientRect:()=>({left:0,top:410,right:195,bottom:810}),
  classList:{add(){},remove(){}},setPointerCapture:id=>captures.add(id),
  hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
 const stick={style:{},offsetWidth:100},thumb={style:{},offsetWidth:36};
 const buttons=Object.fromEntries(['auto','attack'].map(type=>[type,{
  dataset:{explore:type},disabled:false,
  closest(sel){return sel==='button[data-explore]'?this:null}
 }]));
 const actions={dataset:{},addEventListener:(k,v)=>actionEvents.set(k,v),
  contains:b=>Object.values(buttons).includes(b)};
 dom.set('exp-stick-zone',zone);dom.set('exp-stick',stick);dom.set('exp-stick-thumb',thumb);
 dom.set('.exp-playing .exp-control-actions',actions);
 t.bindStick();t.bindMultiTouchActions();
 const point=(name,x,y,id=1)=>pointerEvents.get(name)({pointerType:'touch',pointerId:id,
  clientX:x,clientY:y,preventDefault(){}});
 let prevented=0,blocked=0;
 const start=(type,id)=>actionEvents.get('touchstart')({target:buttons[type],
  changedTouches:[{identifier:id}],cancelable:true,preventDefault(){prevented++}});
 const finish=(name,type,id)=>actionEvents.get(name)({target:buttons[type],
  changedTouches:[{identifier:id}]});
 const click=type=>actionEvents.get('click')({target:buttons[type],detail:1,
  preventDefault(){},stopPropagation(){blocked++}});
 point('pointerdown',70,710);point('pointermove',104,684);
 assert.ok(r.joy.x>.5&&r.joy.y<-.4);
 const direction={...r.joy};
 start('auto',12);assert.equal(r.autoAttack,true);
 r.attackAt=0;start('attack',13);
 assert.ok(r.attackAt>0,'third finger attacks while AUTO finger remains down');
 assert.deepEqual(r.joy,direction,'neither right-hand finger can move the left joystick');
 start('auto',14);start('attack',13);
 assert.equal(r.autoAttack,true,'another finger on held AUTO cannot toggle');
 now+=2200;
 finish('touchend','attack',13);
 finish('touchcancel','auto',12);
 click('auto');click('auto');click('attack');
 assert.equal(blocked,3,'all delayed Safari synthetic clicks are discarded');
 assert.equal(r.autoAttack,true);
 assert.deepEqual(r.joy,direction,'long holds do not release the moving finger');
 // An ignored third touch was never registered as a held AUTO action.
 finish('touchend','auto',14);
 now+=50;start('auto',15);assert.equal(r.autoAttack,false,'first rapid fresh tap works');
 finish('touchend','auto',15);
 now+=50;start('auto',16);assert.equal(r.autoAttack,true,'second rapid fresh tap works');
 finish('touchend','auto',16);click('auto');
 assert.equal(blocked,4);
 point('pointerup',104,684);
 assert.deepEqual(r.joy,{x:0,y:0});
 assert.equal(captures.size,0,'left thumb pointer capture is released');
 assert.ok(prevented>=6);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.48 covered action touches do not poison the next tap after closing the bag',async()=>{
 let now=1_000_000;
 const {t,dom,gameWindow}=await harness(()=>.31,{now:()=>now});
 t.startRun();const r=t.runRef(),events=new Map();
 const buttons=Object.fromEntries(['auto','bag','attack'].map(type=>[type,{
  disabled:false,dataset:{explore:type},
  closest(sel){return sel==='button[data-explore]'?this:null}
 }]));
 const actions={dataset:{},addEventListener:(k,v)=>events.set(k,v),
  contains:b=>Object.values(buttons).includes(b)};
 const bag={classList:{open:false,contains(v){return v==='exp-bag-open'&&this.open},
  toggle(){this.open=!this.open;return this.open},
  remove(){this.open=false}}};
 dom.set('.exp-playing .exp-control-actions',actions);dom.set('exp-backpack',bag);
 t.bindMultiTouchActions();
 let prevented=0,blocked=0;
 const touch=(type,id)=>events.get('touchstart')({target:buttons[type],
  changedTouches:[{identifier:id}],cancelable:true,preventDefault(){prevented++}});
 const end=(type,id)=>events.get('touchend')({target:buttons[type],
  changedTouches:[{identifier:id}]});
 const click=type=>events.get('click')({target:buttons[type],detail:1,
  preventDefault(){},stopPropagation(){blocked++}});
 touch('bag',31);assert.equal(bag.classList.open,true);
 end('bag',31);
 const autoBefore=r.autoAttack,attackBefore=r.attackAt;
 touch('auto',54);touch('attack',55);
 assert.equal(r.autoAttack,autoBefore,'AUTO hidden under inventory must stay unchanged');
 assert.equal(r.attackAt,attackBefore,'Attack hidden under inventory cannot fire');
 assert.ok(prevented>=3,'hidden third-finger gestures are cancelled');
 // WebKit never sent either touchend. Those IDs must not be reserved.
 gameWindow.explorationAction({dataset:{explore:'bag-close'}});
 assert.equal(bag.classList.open,false);
 touch('auto',54);assert.equal(r.autoAttack,!autoBefore,'same fresh ID works outside the bag');
 end('auto',54);click('auto');
 assert.equal(blocked,1,'fresh tap still suppresses its delayed synthetic click');
 r.attackAt=0;touch('attack',55);
 assert.ok(r.attackAt>0,'previously covered attack ID is now available');
 end('attack',55);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});

test('R6.48 blur visibilitychange pagehide freeze timer and permit a clean 3-finger restart',async()=>{
 let now=1_000_000;
 const {t,dom,state,document,documentEvents,windowEvents}=await harness(()=>.31,{now:()=>now});
 t.startRun();const r=t.runRef(),startId=r.id;
 const actionEvents=new Map(),pointerEvents=new Map(),captured=new Set();
 const buttons={auto:{dataset:{explore:'auto'},disabled:false,
  closest(sel){return sel==='button[data-explore]'?this:null}}};
 dom.set('.exp-playing .exp-control-actions',{dataset:{},
  addEventListener:(k,v)=>actionEvents.set(k,v),contains:b=>b===buttons.auto});
 dom.set('exp-stick-zone',{addEventListener:(k,v)=>pointerEvents.set(k,v),
  getBoundingClientRect:()=>({left:0,top:420,right:195,bottom:810}),
  classList:{add(){},remove(){}},setPointerCapture:id=>captured.add(id),
  hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)});
 dom.set('exp-stick',{style:{},offsetWidth:100});
 dom.set('exp-stick-thumb',{style:{},offsetWidth:36});
 t.bindStick();t.bindMultiTouchActions();
 const p=(name,id,x,y)=>pointerEvents.get(name)({pointerId:id,pointerType:'touch',
  clientX:x,clientY:y,preventDefault(){}});
 const touch=id=>actionEvents.get('touchstart')({target:buttons.auto,
  changedTouches:[{identifier:id}],cancelable:true,preventDefault(){}});
 p('pointerdown',1,80,700);p('pointermove',1,120,700);
 assert.ok(r.joy.x>.6);
 touch(40);assert.equal(r.autoAttack,true);
 const beforeTime=t.remaining();
 windowEvents.get('blur')();
 assert.equal(r.paused,true,'app blur freezes the current raid');
 assert.deepEqual(r.joy,{x:0,y:0});
 assert.deepEqual(r.steer,{x:0,y:0});
 assert.equal(captured.size,0);
 now+=120000; // app was in background for two minutes
 document.hidden=true;documentEvents.get('visibilitychange')();
 windowEvents.get('pagehide')();
 assert.equal(r.paused,true,'repeated iOS background events must not unpause');
 assert.equal(t.remaining(),beforeTime,'pause timer excludes all background time');
 assert.equal(r.id,startId);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.equal(state.exploreRun?.id,startId,'pagehide retains the same raid checkpoint');
 document.hidden=false;documentEvents.get('visibilitychange')();
 t.togglePause();assert.equal(r.paused,false);
 assert.equal(t.remaining(),beforeTime,'resuming advances start to exclude background time');
 touch(40);
 assert.equal(r.autoAttack,false,'finger identifier can be reused after background resume');
 actionEvents.get('touchend')({target:buttons.auto,changedTouches:[{identifier:40}]});
 p('pointerdown',2,80,700);p('pointermove',2,120,700);
 assert.ok(r.joy.x>.6,'fresh left thumb steers after foreground resume');
 p('pointerup',2,120,700);
 assert.deepEqual(r.joy,{x:0,y:0});
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});


// R6.49: Compare an early extraction with a near-deadline one using the SAME
// actual 1F Tiled cache, sealed rewards, real movement collisions and live AI.
// Only the decision-only elapsed clock is advanced artificially in the late
// branch; movement and enemy simulation on both legs remain unmodified.
// A scripted no-evasion bot is not evidence of a human win rate.
test('R6.49 on-foot early versus two-second 1F return tests the real 300s deadline',async tctx=>{
 const outcomes=[];
 for(const deadline of ['early','two-seconds']){
  let now=1_000_000;
  const {t,layout,state,received,gameWindow}=await harness(()=>.23,{now:()=>now});
  const advance=ms=>{now+=ms};
  t.startRun();const r=t.runRef(),raidId=r.id;
  assert.equal(r.duration,300,'1F must start with exactly five active minutes');
  const cache=layout.authoredContainers.find(c=>c.id==='tiled-loot-8');
  assert.ok(cache&&layout.fixedExit);
  const outboundPath=r617Path(layout,layout.start,cache);
  const outbound=r619MeasureReturn(t,layout,outboundPath,advance);
  assert.equal(outbound.completed,true,'real guards and Tiled collision must permit first cache');
  t.openContainer();assert.equal(r.paused,true);
  const opened=r.containers.find(c=>c.id===r.lootOpenId);
  assert.equal(opened?.id,cache.id);
  const sealed=opened.contents.map(v=>({id:v.id,q:v.q}));
  assert.ok(sealed.length>0);
  t.takeAllContainerItems({dataset:{container:opened.id,revision:String(r.lootOpenRevision||0)}});
  assert.deepEqual(r.loot.map(v=>({id:v.id,q:v.q})),sealed,'actual 1F rewards must be sealed');
  const keep=r.loot.reduce((a,b)=>t.lootBaseValue(a)>=t.lootBaseValue(b)?a:b);
  const i=r.loot.findIndex(v=>v.tid===keep.tid);
  gameWindow.explorationAction({dataset:{explore:'protect',i:String(i),tid:String(keep.tid)}});
  assert.ok(r.safeIds.includes(keep.tid));
  const protectedRow={id:keep.id,q:keep.q};
  const pauseRemaining=t.remaining();
  now+=30_000;t.tick(.04);
  assert.equal(t.remaining(),pauseRemaining,'deciding which loot to protect is a real pause');
  t.closeContainer();
  assert.equal(r.paused,false);
  assert.ok(t.validCheckpoint(t.snapshotRun()));
  const initial=t.v5ExtractionDecision();
  assert.equal(initial.floor,'1F');
  assert.equal(initial.routeBasis,'1F直線距離のみ');
  assert.equal(initial.planningWindow,Math.ceil(initial.lowerBound*3+30));
  assert.ok(initial.planningWindow>0);
  if(deadline==='two-seconds'){
   now+=Math.max(0,Math.round((t.remaining()-2)*1000));
   assert.ok(t.remaining()>1.9&&t.remaining()<2.1);
  }
  const choice=t.v5ExtractionDecision();
  if(deadline==='two-seconds'){
   assert.equal(choice.phase,'return','the displayed decision must warn when only two seconds remain');
   assert.ok(choice.lowerBound>choice.timeLeft,'real cache must be too far to escape in two seconds');
  }else{
   assert.ok(choice.timeLeft>choice.planningWindow,'early sortie should have spare time');
  }
  const returnPath=r617Path(layout,cache,t.exitPoint());
  assert.ok(returnPath.length>=3);
  const inbound=r619MeasureReturn(t,layout,returnPath,advance);
  const row={deadline,initial,choice,
   traveledTiles:outboundPath.length-1+returnPath.length-1,
   outbound,inbound,alerts:+(outbound.alertSeconds+inbound.alertSeconds).toFixed(2),
   actualLoot:sealed.length,finalStatus:null,
   remainingAfterReturn:+t.remaining().toFixed(2)};
  assert.equal(r.id,raidId);
  if(deadline==='early'){
   assert.equal(inbound.completed,true,'early on-foot return should reach the real 1F exit');
   assert.ok(t.remaining()>0);
   t.bank();
   assert.equal(state.exploreLastResult?.status,'escaped');
   assert.equal(received.length,sealed.length,'only authentic sealed cargo is banked');
   t.bank();assert.equal(received.length,sealed.length,'bank remains idempotent');
  }else{
   assert.equal(inbound.completed,false,'two seconds cannot cover the real return route');
   assert.equal(state.exploreLastResult?.status,'lost');
   assert.equal(r.reason,'時間切れで戦利品を失いました');
   assert.deepEqual(received.map(v=>({id:v.id,q:v.q})),[protectedRow],
    'only the protected authentic treasure is returned on timeout');
   assert.equal(state.exploreLastResult.receipt.lostLootCount,sealed.length-1);
   t.bank();assert.equal(received.length,1,'late bank cannot grant a second payout');
  }
  row.finalStatus=state.exploreLastResult.status;
  outcomes.push(row);
 }
 assert.deepEqual(outcomes.map(r=>r.finalStatus),['escaped','lost']);
 assert.ok(outcomes.every(r=>r.traveledTiles>0&&r.outbound.seconds>0));
 tctx.diagnostic('R6.49 fixed-seed AI-on 1F early/late return (only late clock is advanced): '+
  JSON.stringify(outcomes));
});

// Timer and failure settlements must work after a REAL sealed Tiled pickup.
// To see the full 300-second clock instead of an early death from waiting
// beside an alerted guard, only this clock-isolation section removes guards;
// the R6.49 return comparison above keeps live AI enabled.
test('R6.49 full 300 active seconds end once, preserve pouch and never reward forfeited cache loot',async tctx=>{
 let now=1_000_000;
 const {t,layout,state,received,gameWindow}=await harness(()=>.73,{now:()=>now});
 const advance=ms=>{now+=ms};
 t.startRun();const r=t.runRef(),raidId=r.id;
 const cache=layout.authoredContainers.find(c=>c.id==='tiled-loot-8');
 const route=r617Path(layout,layout.start,cache);
 const leg=r619MeasureReturn(t,layout,route,advance);
 assert.equal(leg.completed,true);
 t.openContainer();assert.equal(r.paused,true);
 const opened=r.containers.find(c=>c.id===r.lootOpenId);
 assert.equal(opened?.id,cache.id);
 const sealed=opened.contents.map(v=>({id:v.id,q:v.q}));
 assert.ok(sealed.length>0);
 t.takeAllContainerItems({dataset:{container:opened.id,revision:String(r.lootOpenRevision||0)}});
 const retained=r.loot.reduce((a,b)=>t.lootBaseValue(a)>=t.lootBaseValue(b)?a:b);
 const i=r.loot.findIndex(v=>v.tid===retained.tid);
 gameWindow.explorationAction({dataset:{explore:'protect',i:String(i),tid:String(retained.tid)}});
 assert.equal(r.safeIds.length,1);
 const duringPause=t.remaining(),snapshot=t.snapshotRun();
 assert.equal(t.validCheckpoint(snapshot),true);
 now+=120_000;t.tick(.04);
 assert.equal(t.remaining(),duringPause,'2 minutes in the paused menu are not consumed');
 t.closeContainer();
 assert.equal(r.id,raidId);
 // Clock-isolation fixture only; the first real cache walk above used AI.
 // V5 has no randomized ambush spawns, so clearing outstanding posts allows
 // a stationary, unarmed subject to reach the five-minute clock boundary.
 r.enemies=[];r.pendingGuardPosts=[];
 const sampled=[];
 let steps=0,finalDecision=null;
 while(r.status==='playing'&&steps<8000){
  now+=40;t.tick(.04);steps++;
  if(steps%750===0&&r.status==='playing'){
   const dec=t.v5ExtractionDecision();
   sampled.push({elapsed:+((now-r.start)/1000).toFixed(2),phase:dec.phase,
    secondsLeft:dec.timeLeft,unprotected:dec.stakes.exposedCount});
  }
  if(r.status==='playing'&&t.remaining()<=2.04)finalDecision=t.v5ExtractionDecision();
 }
 assert.equal(r.status,'lost','an uninterrupted 1F five-minute clock must settle to lost');
 assert.equal(r.reason,'時間切れで戦利品を失いました');
 assert.ok(steps>4000,'the clock fixture actually advanced thousands of 40ms frames');
 assert.ok(finalDecision&&finalDecision.phase==='return',
  'the risk notice warns to return as the actual time expires');
 assert.equal(state.exploreLastResult?.status,'lost');
 assert.deepEqual(received.map(v=>({id:v.id,q:v.q})),[{id:retained.id,q:retained.q}]);
 assert.equal(state.exploreLastResult.receipt.savedCount,1);
 assert.equal(state.exploreLastResult.receipt.lostLootCount,sealed.length-1);
 assert.equal(state.exploreLastResult.receipt.savedBase,t.lootBaseValue(retained));
 assert.equal(state.exploreRun,null,'claim marker is cleared once after settlement');
 t.lose('late second timeout');
 t.bank();
 assert.equal(received.length,1,'repeated failed settlement cannot duplicate protected rewards');
 assert.ok(sampled.length>=5,'decision phases were sampled across several active minutes');
 tctx.diagnostic('R6.49 actual 300s 1F clock with isolated guards AFTER authentic pickup: '+
  JSON.stringify({pickupSeconds:leg.seconds,frames:steps,pausedWallSeconds:120,
   totalActiveSeconds:+((now-r.start)/1000).toFixed(2),sampled,finalDecision,
   sealedCount:sealed.length,paid:received.length,reason:r.reason}));
});

test('R6.49 entering B1 with one second left extends one raid once; expired entry never buys time',async tctx=>{
 let now=1_000_000;
 const {t,layout,state}=await harness(()=>.23,{now:()=>now});
 const advance=ms=>{now+=ms};
 t.startRun();const r=t.runRef(),raidId=r.id;
 const key=layout.basementKey,door=layout.basementEntrance;
 const toKey=r619MeasureReturn(t,layout,r617Path(layout,layout.start,key),advance);
 assert.equal(toKey.completed,true);
 assert.equal(t.nearBasementKey(),true);assert.equal(t.useBasementInteraction(),true);
 const toDoor=r619MeasureReturn(t,layout,r617Path(layout,key,door),advance);
 assert.equal(toDoor.completed,true);
 assert.equal(t.nearBasementDoor(),true);
 assert.equal(r.duration,300);
 now+=Math.round((t.remaining()-1)*1000);
 assert.ok(t.remaining()>.9&&t.remaining()<1.1);
 const before=t.remaining(),savedLoot=JSON.stringify(r.loot);
 assert.equal(t.useBasementInteraction(),true);
 assert.equal(r.undergroundEntered,true);
 assert.equal(r.duration,420,'the single B1 bonus is 120 seconds, not a new 5-minute raid');
 assert.ok(Math.abs(t.remaining()-before-120)<.02);
 assert.equal(r.id,raidId);
 assert.equal(JSON.stringify(r.loot),savedLoot);
 assert.equal(t.enterBasement(),false,'a second tap cannot stack more time');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 const firstResult={keySeconds:toKey.seconds,doorSeconds:toDoor.seconds,
  lastSurfaceSeconds:before,firstB1Seconds:t.remaining(),idPreserved:r.id===raidId};
 // Boundary isolation: position at the authored stair with a previously
 // acquired key. Do not claim this second scenario walked through the guards.
 let lateNow=2_000_000;
 const other=await harness(()=>.23,{now:()=>lateNow});
 other.t.startRun();const late=other.t.runRef();
 late.basementKeyTaken=true;late.player.x=other.layout.basementEntrance.x;
 late.player.y=other.layout.basementEntrance.y;
 assert.equal(other.t.nearBasementDoor(),true);
 lateNow+=300_000;
 assert.equal(other.t.remaining(),0);
 assert.equal(other.t.enterBasement(),false,'an expired run cannot obtain B1 bonus before ticking');
 assert.equal(late.undergroundEntered,false);assert.equal(late.duration,300);
 other.t.tick(.04);
 assert.equal(other.state.exploreLastResult?.status,'lost');
 assert.equal(late.reason,'時間切れで戦利品を失いました');
 tctx.diagnostic('R6.49 last-second underground entry vs expired entry: '+JSON.stringify(firstResult));
});


// R6.50: The guard-pressure label is based on actual live Tiled AI
// encounters, not predicted hidden routes or a fabricated enemy fixture.
// This fixed-seed scripted bot does not represent human success rates.
test('R6.50 real 1F patrol alert changes extra-room advice while live walking home',async tctx=>{
 let now=1_000_000;
 const {t,layout,state,received}=await harness(()=>.23,{now:()=>now});
 const advance=ms=>{now+=ms};
 t.startRun();const r=t.runRef(),cache=layout.authoredContainers.find(c=>c.id==='tiled-loot-8');
 assert.ok(cache);
 const outbound=r619MeasureReturn(t,layout,r617Path(layout,layout.start,cache),advance);
 assert.equal(outbound.completed,true,'real cache reached through Tiled collision');
 t.openContainer();assert.equal(r.paused,true);
 const box=r.containers.find(c=>c.id===r.lootOpenId);
 assert.equal(box?.id,cache.id);
 const sealed=box.contents.map(v=>({id:v.id,q:v.q}));
 t.takeAllContainerItems({dataset:{container:box.id,revision:String(r.lootOpenRevision||0)}});
 t.closeContainer();assert.equal(r.paused,false);
 const quiet=t.v5ExtractionDecision();
 assert.equal(quiet.observed.engaged,false,'real early path begins outside close alert');
 assert.equal(quiet.slowed,false);
 assert.equal(quiet.timePhase,'explore');
 assert.equal(quiet.phase,'explore');
 let alertSample=null;
 const inbound=r619MeasureReturn(t,layout,r617Path(layout,cache,layout.fixedExit),advance,()=>{
  if(alertSample)return;
  const decision=t.v5ExtractionDecision();
  if(!decision.observed.engaged)return;
  alertSample={decision,html:t.v5ExtractionDecisionHTML(),
   nearbyModes:r.enemies.filter(e=>Math.hypot(e.x-r.player.x,e.y-r.player.y)<=360)
    .map(e=>e.mode)};
 });
 assert.equal(inbound.completed,true,'same real AI-on return can be walked');
 assert.ok(inbound.alertSeconds>0,'authored security noticed the scripted walker');
 assert.ok(alertSample,'a live alert/chase within 360px must be observable');
 assert.equal(alertSample.decision.timePhase,'explore','the time-only plan still has room');
 assert.equal(alertSample.decision.phase,'consider','live guard pressure discourages a detour');
 assert.equal(alertSample.decision.observed.engaged,true);
 assert.match(alertSample.html,/data-phase="consider"/);
 assert.match(alertSample.html,/data-alert="engaged"/);
 assert.match(alertSample.html,/近くで警備が警戒・追跡中/);
 assert.doesNotMatch(alertSample.html,/生還確率|安全を保証します/);
 assert.ok(t.remaining()>0);
 t.bank();assert.equal(state.exploreLastResult?.status,'escaped');
 assert.equal(received.length,sealed.length);
 t.bank();assert.equal(received.length,sealed.length,'observed danger must not duplicate any reward');
 tctx.diagnostic('R6.50 live 1F guard observation: '+JSON.stringify({
  inboundSeconds:inbound.seconds,alertSeconds:inbound.alertSeconds,
  nearSeconds:inbound.nearSeconds,hits:inbound.hits,
  phaseWithoutAlert:quiet.phase,alertPhase:alertSample.decision.phase,
  modes:alertSample.nearbyModes
 }));
});

test('R6.50 authentic 1F plus B1 heavy loot raises caution; dropping cargo restores time margin',async tctx=>{
 let now=1_000_000;
 const {t,layout,basementLayout,gameWindow,state}=await harness(()=>.73,{now:()=>now});
 const advance=ms=>{now+=ms};
 t.startRun();const r=t.runRef(),raidId=r.id;
 let cursor=layout.start;
 const walk=(world,target)=>{
  const result=r619MeasureReturn(t,world,r617Path(world,cursor,target),advance);
  assert.equal(result.completed,true,'real Tiled route must be traversable with guards enabled');
  cursor=target;
  return result;
 };
 const collect=cache=>{
  t.openContainer();
  assert.equal(r.paused,true,'authored cache can be opened during live raid');
  const opened=r.containers.find(c=>c.id===r.lootOpenId);
  assert.equal(opened?.id,cache.id);
  const sealed=opened.contents.map(v=>({id:v.id,q:v.q}));
  assert.ok(sealed.length>0);
  const start=r.loot.length;
  t.takeAllContainerItems({dataset:{container:opened.id,revision:String(r.lootOpenRevision||0)}});
  assert.deepEqual(r.loot.slice(start).map(v=>({id:v.id,q:v.q})),sealed);
  t.closeContainer();assert.equal(r.paused,false);
 };
 for(const id of ['tiled-loot-8','tiled-loot-3']){
  const source=layout.authoredContainers.find(c=>c.id===id);
  assert.ok(source);walk(layout,source);collect(source);
 }
 walk(layout,layout.basementKey);
 assert.equal(t.useBasementInteraction(),true,'actual ground-floor key');
 walk(layout,layout.basementEntrance);
 assert.equal(t.useBasementInteraction(),true,'real one-way B1 entry');
 assert.equal(r.undergroundEntered,true);
 assert.equal(r.id,raidId);
 cursor=basementLayout.start;
 const ultra=basementLayout.authoredContainers.find(c=>c.id==='tiled-loot-10');
 assert.ok(ultra&&ultra.tier==='ultra');
 walk(basementLayout,ultra);collect(ultra);
 const heavy=t.v5ExtractionDecision(),timeBefore=t.remaining();
 assert.ok(heavy.cargo.over>0&&heavy.cargo.pct<70,'authentic 1F+B1 cargo must be badly overweight');
 assert.equal(heavy.slowed,true);
 assert.equal(heavy.lowerBound,t.v5BasementCurrentRoute().secondsAtCurrentLoad);
 assert.ok(['explore','consider','return'].includes(heavy.timePhase));
 if(heavy.timePhase==='explore')assert.equal(heavy.phase,'consider');
 assert.match(t.v5ExtractionDecisionHTML(),/荷物で速度/);
 const sealedCaches=JSON.stringify(r.containers.map(c=>({id:c.id,contents:c.contents})));
 const beforeSnapshot=t.snapshotRun(),beforeHtml=t.v5ExtractionDecisionHTML();
 const afterSnapshot=t.snapshotRun();delete beforeSnapshot.savedAt;delete afterSnapshot.savedAt;
 assert.deepEqual(afterSnapshot,beforeSnapshot,'live advice is read-only and cannot mutate raid state');
 assert.ok(beforeHtml.includes('参考の帰還枠はゲームの安全判定ではありません'));
 t.togglePause();
 assert.equal(r.paused,true);
 const protectedItem=r.loot.reduce((a,b)=>t.weightTenths(a.id)<=t.weightTenths(b.id)?a:b);
 gameWindow.explorationAction({dataset:{explore:'protect',
  i:String(r.loot.findIndex(v=>v.tid===protectedItem.tid)),tid:String(protectedItem.tid)}});
 assert.ok(r.safeIds.includes(protectedItem.tid));
 let drops=0;
 while(t.v5CargoRisk().pct<85){
  const item=r.loot.filter(v=>!r.safeIds.includes(v.tid))
   .sort((a,b)=>t.weightTenths(b.id)-t.weightTenths(a.id))[0];
  assert.ok(item,'enough real unprotected cargo to regain speed');
  const i=r.loot.findIndex(v=>v.tid===item.tid);
  const button={dataset:{explore:'drop',i:String(i),tid:String(item.tid)},
   textContent:'捨てる',setAttribute(){}};
  gameWindow.explorationAction(button);
  assert.ok(r.loot.some(v=>v.tid===item.tid),'first tap is a confirmation only');
  gameWindow.explorationAction(button);
  assert.ok(!r.loot.some(v=>v.tid===item.tid));
  drops++;
  assert.ok(drops<8);
 }
 const light=t.v5ExtractionDecision();
 assert.equal(light.slowed,false);
 assert.ok(light.cargo.pct>=85);
 assert.ok(light.lowerBound<heavy.lowerBound,'walking-only return lower bound must shrink');
 assert.ok(light.planningWindow<heavy.planningWindow,'decision buffer improves with real discard');
 assert.equal(light.timeLeft,heavy.timeLeft,'planning and paused dropping may not drain clock');
 assert.deepEqual(light.observed,heavy.observed,'paused inventory changes cannot move guards');
 assert.equal(JSON.stringify(r.containers.map(c=>({id:c.id,contents:c.contents}))),sealedCaches);
 assert.ok(r.safeIds.includes(protectedItem.tid));
 assert.equal(r.stats.weightLimit,12,'normal capacity may not be changed for the benchmark');
 const order={explore:0,consider:1,return:2};
 assert.ok(order[light.phase]<=order[heavy.phase],
  'less cargo may not make the same observed return scenario more urgent');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 t.togglePause();assert.equal(r.paused,false);
 assert.equal(r.id,raidId);
 assert.ok(Math.abs(t.remaining()-timeBefore)<.01);
 tctx.diagnostic('R6.50 real sealed cargo advice before/after voluntary jettison: '+
  JSON.stringify({heavy:{speed:heavy.cargo.pct,phase:heavy.phase,clock:heavy.timeLeft,
   theoreticalSeconds:heavy.lowerBound,window:heavy.planningWindow},
   light:{speed:light.cargo.pct,phase:light.phase,clock:light.timeLeft,
    theoreticalSeconds:light.lowerBound,window:light.planningWindow},
   retained:r.loot.length,dropped:drops,liveThreat:light.observed}));
});

test('R6.50 nearby search gives caution, unreachable exits keep priority, legacy V4 stays unchanged',async()=>{
 const {t,layout}=await harness(()=>.23);
 t.startRun();const r=t.runRef();
 r.player.x=layout.start.x;r.player.y=layout.start.y;
 const clear=t.v5ExtractionDecision();
 assert.equal(clear.timePhase,clear.phase);
 assert.equal(clear.observed.engaged,false);
 assert.equal(clear.slowed,false);
 assert.equal(Object.hasOwn(t.snapshotRun(),'observed'),false);
 // Isolated mode/display fixture only: 1F's live alert was tested separately.
 // A nearby searching enemy is NOT an active pursuer.
 const genuine=r.enemies[0];
 const virtual={...(genuine||{}),x:r.player.x+60,y:r.player.y,mode:'search'};
 r.enemies.push(virtual);
 let d=t.v5ExtractionDecision();
 assert.equal(d.observed.searching,true);
 assert.equal(d.observed.engaged,false);
 assert.equal(d.phase,d.timePhase);
 assert.match(t.v5ExtractionDecisionHTML(),/近くに捜索中の警備/);
 virtual.mode='chase';
 d=t.v5ExtractionDecision();
 assert.equal(d.observed.engaged,true);
 assert.equal(d.phase,'consider');
 virtual.x+=600;
 d=t.v5ExtractionDecision();
 assert.equal(d.observed.engaged,false,'distant guard is not claimed as immediate pressure');
 assert.equal(d.phase,d.timePhase);
 r.vaultSealed=true;r.vaultHatchUsed=false;
 d=t.v5ExtractionDecision();
 assert.equal(d.phase,'hatch','sealed vault escape takes priority over patrol hints');
 assert.equal(d.lowerBound,null);
 r.mapVersion=4;
 assert.equal(t.v5ExtractionDecision(),null);
 assert.equal(t.v5ExtractionDecisionHTML(),'');
 assert.doesNotMatch(t.contents(),/exp-raid-decision-live/);
});


// R6.51: Compare CENTRAL/NORTHERN return corridors with the same actual
// sealed 1F+B1 loot seed, active patrols and genuine weight. The two light
// branches voluntarily discard the heaviest unprotected treasure. The bot
// follows tile-center waypoints and does not play like a human: these are
// observed fixed-seed outcomes, never a prediction of safe extraction.
test('R6.51 real B1 cargo matrix compares central/northern live-guard return after U08',async tctx=>{
 const report=[];
 const seed=.73;
 for(const cargoMode of ['heavy','after-discard']){
  for(const routeId of ['central','northern']){
   let now=1_000_000;
   const {t,layout,basementLayout,gameWindow,state,received}=await harness(()=>seed,{now:()=>now});
   const advance=ms=>{now+=ms};
   t.startRun();const run=t.runRef(),raidId=run.id;
   let cursor=layout.start;
   const walk=(world,target,label)=>{
    const path=r617Path(world,cursor,target);
    const result=r619MeasureReturn(t,world,path,advance);
    assert.equal(result.completed,true,'live Tiled '+label+' reaches its waypoint');
    cursor=target;
    return result;
   };
   const collect=source=>{
    t.openContainer();
    assert.equal(run.paused,true,'real cache has an interactive loot panel');
    const cache=run.containers.find(c=>c.id===run.lootOpenId);
    assert.equal(cache?.id,source.id);
    const sealed=cache.contents.map(v=>({id:v.id,q:v.q}));
    assert.ok(sealed.length>0,'cache really rolled sealed loot');
    const start=run.loot.length;
    t.takeAllContainerItems({dataset:{container:cache.id,revision:String(run.lootOpenRevision||0)}});
    assert.deepEqual(run.loot.slice(start).map(v=>({id:v.id,q:v.q})),sealed);
    t.closeContainer();
    return sealed.length;
   };
   for(const id of ['tiled-loot-8','tiled-loot-3']){
    const source=layout.authoredContainers.find(c=>c.id===id);
    assert.ok(source);walk(layout,source,'1F '+id);collect(source);
   }
   walk(layout,layout.basementKey,'key');
   assert.equal(t.useBasementInteraction(),true);
   walk(layout,layout.basementEntrance,'stairs');
   assert.equal(t.useBasementInteraction(),true,'same sortie enters B1 and gains 120 seconds');
   assert.equal(run.undergroundEntered,true);
   assert.equal(run.duration,420);
   cursor=basementLayout.start;
   const ultra=basementLayout.authoredContainers.find(c=>c.id==='tiled-loot-10');
   assert.ok(ultra&&ultra.tier==='ultra');
   walk(basementLayout,ultra,'B1 U08');
   collect(ultra);
   const sourceCount=run.loot.length,original=t.v5CargoRisk();
   assert.ok(original.over>0&&original.pct<50,'real cargo must severely burden the runner');
   assert.equal(run.stats.weightLimit,12,'normal 12kg limit must be used');
   t.togglePause();assert.equal(run.paused,true);
   const saved=run.loot.reduce((a,b)=>t.weightTenths(a.id)<=t.weightTenths(b.id)?a:b);
   gameWindow.explorationAction({dataset:{explore:'protect',
    i:String(run.loot.findIndex(v=>v.tid===saved.tid)),tid:String(saved.tid)}});
   assert.ok(run.safeIds.includes(saved.tid));
   const containersBefore=JSON.stringify(run.containers.map(c=>({id:c.id,contents:c.contents})));
   const clockBefore=t.remaining();
   let dropped=0;
   if(cargoMode==='after-discard'){
    while(t.v5CargoRisk().pct<85){
     const candidate=run.loot.filter(v=>!run.safeIds.includes(v.tid))
      .sort((a,b)=>t.weightTenths(b.id)-t.weightTenths(a.id))[0];
     assert.ok(candidate,'must use authentic unprotected items only');
     const i=run.loot.findIndex(v=>v.tid===candidate.tid);
     const button={dataset:{explore:'drop',i:String(i),tid:String(candidate.tid)},
      textContent:'捨てる',setAttribute(){}};
     gameWindow.explorationAction(button);
     assert.ok(run.loot.some(v=>v.tid===candidate.tid),'first tap only confirms');
     gameWindow.explorationAction(button);
     assert.ok(!run.loot.some(v=>v.tid===candidate.tid),'second tap drops exactly one real item');
     dropped++;assert.ok(dropped<=sourceCount);
    }
   }
   const cargo=t.v5CargoRisk(),retained=run.loot.map(v=>({id:v.id,q:v.q}));
   assert.equal(JSON.stringify(run.containers.map(c=>({id:c.id,contents:c.contents}))),containersBefore);
   assert.ok(Math.abs(t.remaining()-clockBefore)<.01,'route planning and inventory must not consume paused time');
   assert.equal(t.validCheckpoint(t.snapshotRun()),true);
   const choices=t.v5BasementReturnChoices();
   assert.ok(choices&&choices.routes.length===2);
   t.setB1RouteView('compare');
   const before=t.snapshotRun();delete before.savedAt;
   const html=t.mapPanel();
   const after=t.snapshotRun();delete after.savedAt;
   assert.deepEqual(after,before,'viewing route tradeoffs cannot alter saved raid data');
   assert.match(html,/class="exp-b1-return-tradeoff"/);
   assert.match(html,/移動距離：/);
   assert.match(html,/初期巡回との近接：/);
   assert.match(html,/距離と近接は別指標/);
   assert.match(html,/現在の敵位置・発見確率・生還率を表しません/);
   assert.doesNotMatch(html,/一番安全|必ず生還|推奨ルート/);
   const choice=choices.routes.find(x=>x.id===routeId);
   assert.ok(choice&&choice.patrolExposure&&choice.steps>0);
   t.togglePause();assert.equal(run.paused,false);
   const activeBefore=run.enemies.length,pendingBefore=run.pendingGuardPosts.length;
   const activeClock=t.remaining();
   const result=r619MeasureReturn(t,basementLayout,choice.points,advance);
   assert.ok(result.seconds>0&&result.reached>0,'scripted player really moved in live level');
   const mode=run.status;
   if(result.completed){
    assert.equal(mode,'playing');
    assert.ok(t.remaining()>0,'arrived in time');
    t.bank();
    assert.equal(state.exploreLastResult?.status,'escaped');
    assert.deepEqual(received.map(v=>({id:v.id,q:v.q})),retained);
   }else{
    assert.equal(mode,'lost','failed route must have died or reached real timeout');
    assert.equal(state.exploreLastResult?.status,'lost');
    assert.deepEqual(received.map(v=>({id:v.id,q:v.q})),[{id:saved.id,q:saved.q}],
     'failure can return only the one protected real reward');
   }
   const receivedCount=received.length;
   t.bank();assert.equal(received.length,receivedCount,'no duplicate settlement');
   assert.equal(run.id,raidId);
   report.push({route:routeId,cargoMode,from:{weight:original.weight,pct:original.pct},
    cargo:{weight:cargo.weight,pct:cargo.pct,retained:retained.length,dropped},
    approachGuards:activeBefore,pendingGuards:pendingBefore,
    routeSteps:choice.steps,plannedSeconds:choice.secondsAtCurrentLoad,
    patrolNearby:choice.patrolExposure.nearPoints,
    patrolCells:choice.patrolExposure.totalPoints,
    activeClock:+activeClock.toFixed(2),...result,
    settlement:state.exploreLastResult.status});
  }
 }
 assert.equal(report.length,4);
 assert.deepEqual(report.map(x=>x.route),['central','northern','central','northern']);
 for(const routeId of ['central','northern']){
  const heavy=report.find(x=>x.route===routeId&&x.cargoMode==='heavy');
  const light=report.find(x=>x.route===routeId&&x.cargoMode==='after-discard');
  assert.ok(light.cargo.pct>heavy.cargo.pct);
  assert.ok(light.cargo.dropped>0);
  assert.ok(light.plannedSeconds<heavy.plannedSeconds,
   'same Tiled route has a smaller movement-only lower bound after real discard');
  assert.equal(light.routeSteps,heavy.routeSteps);
  assert.equal(light.patrolNearby,heavy.patrolNearby,
   'discarding cannot rewrite authored guard paths');
  if(light.completed&&heavy.completed)assert.ok(light.seconds<heavy.seconds,
   'lighter real cargo must improve same-route movement time');
 }
 tctx.diagnostic('R6.51 real sealed 1F+B1 route x weight live-AI comparison: '+JSON.stringify(report));
});

test('R6.51 authored route tradeoff compares only steps and patrol share, not live guard snapshots',async()=>{
 const now=1_000_000;
 const {t,layout}=await harness(()=>.37,{now:()=>now});
 t.startRun();const r=t.runRef();
 r.basementKeyTaken=true;r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 const snapshot=()=>{const s=t.snapshotRun();delete s.savedAt;return JSON.stringify(s)};
 const before=snapshot(),guards=JSON.stringify(r.enemies),pending=JSON.stringify(r.pendingGuardPosts);
 const choices=t.v5BasementReturnChoices();
 assert.equal(choices?.routes.length,2);
 t.setB1RouteView('compare');
 const html=t.mapPanel();
 assert.match(html,/class="exp-b1-return-tradeoff"/);
 const [a,b]=choices.routes;
 const shorter=a.steps===b.steps?'移動距離は同じ':
  (a.steps<b.steps?a.label:b.label)+'の方が'+Math.abs(a.steps-b.steps)+'タイル短い';
 assert.ok(html.includes(shorter),'distance claim must use actual Tiled route steps');
 const ratio=r=>r.patrolExposure.nearPoints/r.patrolExposure.totalPoints;
 const near=Math.abs(ratio(a)-ratio(b))<.005?'巡回軌道120px以内の地点割合はほぼ同じ':
  (ratio(a)<ratio(b)?a.label:b.label)+'の方が固定巡回軌道120px以内の地点割合が少ない';
 assert.ok(html.includes(near),'patrol claim must compare normalized authored proximity');
 assert.equal(snapshot(),before,'route panel must not change raid/checkpoint contents');
 assert.equal(JSON.stringify(r.enemies),guards,'must not reveal or move active enemy locations');
 assert.equal(JSON.stringify(r.pendingGuardPosts),pending,'must not activate sleeping guards');
 t.setB1RouteView('current');assert.doesNotMatch(t.mapPanel(),/exp-b1-return-tradeoff/);
 r.mapVersion=4;
 assert.doesNotMatch(t.mapPanel(),/exp-b1-return-tradeoff/,'legacy panel stays as before');
});


// R6.52: Run the same genuine 1F -> B1 U08 -> escape mission at three
// departure times. Unlike R6.19, weight and rewards come from real sealed
// caches, the normal 12kg limit, and deliberate two-tap discards. Waiting
// is active in-game time: it can attract guards or kill the player BEFORE
// the chosen corridor is even entered. The fixed bot never dodges/attacks;
// these observations are not survival probabilities or route advice.
test('R6.52 real 1F+B1 cargo compares 0/1/12s active B1 departure with live patrols',async tctx=>{
 const matrix=[];
 for(const waitSeconds of [0,1,12]){
  for(const routeId of ['central','northern']){
   let now=1_000_000;
   const {t,layout,basementLayout,gameWindow,state,received}=await harness(()=>.73,{now:()=>now});
   const advance=ms=>{now+=ms};
   t.startRun();const r=t.runRef(),raidId=r.id;
   let cursor=layout.start;
   const walk=(world,target,label)=>{
    const path=r617Path(world,cursor,target);
    const result=r619MeasureReturn(t,world,path,advance);
    assert.equal(result.completed,true,'real AI and collision: '+label);
    cursor=target;
   };
   const collect=source=>{
    t.openContainer();
    assert.equal(r.paused,true,'pickup must open the real container');
    const c=r.containers.find(x=>x.id===r.lootOpenId);
    assert.equal(c?.id,source.id);
    const sealed=c.contents.map(x=>({id:x.id,q:x.q}));
    assert.ok(sealed.length>0,'actual sealed items required');
    const count=r.loot.length;
    t.takeAllContainerItems({dataset:{container:c.id,revision:String(r.lootOpenRevision||0)}});
    assert.deepEqual(r.loot.slice(count).map(x=>({id:x.id,q:x.q})),sealed);
    t.closeContainer();
   };
   for(const id of ['tiled-loot-8','tiled-loot-3']){
    const source=layout.authoredContainers.find(x=>x.id===id);
    assert.ok(source);walk(layout,source,'1F '+id);collect(source);
   }
   walk(layout,layout.basementKey,'1F basement key');
   assert.equal(t.useBasementInteraction(),true);
   walk(layout,layout.basementEntrance,'1F stairs');
   assert.equal(t.useBasementInteraction(),true);
   assert.equal(r.undergroundEntered,true);
   assert.equal(r.duration,420);
   cursor=basementLayout.start;
   const ultra=basementLayout.authoredContainers.find(x=>x.id==='tiled-loot-10');
   assert.ok(ultra&&ultra.tier==='ultra');
   walk(basementLayout,ultra,'B1 U08');
   collect(ultra);
   const original=t.v5CargoRisk(),sealedContainers=JSON.stringify(r.containers.map(x=>({id:x.id,contents:x.contents})));
   assert.equal(r.stats.weightLimit,12,'never alter production carrying capacity');
   assert.ok(original.over>0&&original.pct<50,'real collected cargo must be heavy');
   t.togglePause();assert.equal(r.paused,true);
   const protectedItem=r.loot.reduce((a,b)=>t.weightTenths(a.id)<=t.weightTenths(b.id)?a:b);
   gameWindow.explorationAction({dataset:{explore:'protect',
    i:String(r.loot.findIndex(x=>x.tid===protectedItem.tid)),tid:String(protectedItem.tid)}});
   assert.ok(r.safeIds.includes(protectedItem.tid));
   let dropped=0;
   while(t.v5CargoRisk().pct<85){
    const candidate=r.loot.filter(x=>!r.safeIds.includes(x.tid))
     .sort((a,b)=>t.weightTenths(b.id)-t.weightTenths(a.id))[0];
    assert.ok(candidate,'no synthetic items may be inserted');
    const i=r.loot.findIndex(x=>x.tid===candidate.tid);
    const button={dataset:{explore:'drop',i:String(i),tid:String(candidate.tid)},
     textContent:'捨てる',setAttribute(){}};
    gameWindow.explorationAction(button);
    assert.ok(r.loot.some(x=>x.tid===candidate.tid),'first tap confirms only');
    gameWindow.explorationAction(button);
    assert.ok(!r.loot.some(x=>x.tid===candidate.tid),'second tap discards');
    dropped++;
    assert.ok(dropped<=10);
   }
   const cargo=t.v5CargoRisk();
   assert.ok(cargo.pct>=85&&cargo.pct>original.pct&&dropped>0);
   const retained=r.loot.map(x=>({id:x.id,q:x.q}));
   assert.equal(JSON.stringify(r.containers.map(x=>({id:x.id,contents:x.contents}))),sealedContainers);
   assert.equal(t.validCheckpoint(t.snapshotRun()),true);
   const choice=t.v5BasementReturnChoices().routes.find(x=>x.id===routeId);
   assert.ok(choice&&choice.points.length>1,'use real Tiled central/northern routes');
   const clockBefore=t.remaining();
   t.togglePause();assert.equal(r.paused,false);
   let waitedFrames=0,waitAlerts=0,waitNear=0,maxGuards=r.enemies.length;
   while(waitedFrames<waitSeconds*25&&r.status==='playing'){
    r.joy={x:0,y:0};r.steer={x:0,y:0};
    advance(40);t.tick(.04);waitedFrames++;
    maxGuards=Math.max(maxGuards,r.enemies.length);
    if(r.enemies.some(x=>['alert','chase','windup','recover'].includes(x.mode)))waitAlerts++;
    if(r.enemies.some(x=>Math.hypot(x.x-r.player.x,x.y-r.player.y)<180))waitNear++;
   }
   assert.equal(waitSeconds===0,waitedFrames===0,'no hidden delay in immediate case');
   const diedWhileWaiting=r.status!=='playing';
   let routeResult=null;
   if(!diedWhileWaiting){
    assert.ok(Math.abs((clockBefore-t.remaining())-waitedFrames*.04)<.15,
     'active waiting costs only actual elapsed raid time');
    routeResult=r619MeasureReturn(t,basementLayout,choice.points,advance);
    assert.ok(routeResult.seconds>0&&routeResult.reached>0,'actual return traversal required');
    if(routeResult.completed){
     assert.ok(t.remaining()>0);
     t.bank();
     assert.equal(state.exploreLastResult?.status,'escaped');
     assert.deepEqual(received.map(x=>({id:x.id,q:x.q})),retained,
      'successful sortie banks only the still-carried original loot');
    }
   }
   if(diedWhileWaiting||!routeResult.completed){
    assert.equal(r.status,'lost','waiting/return failure must really settle a loss');
    assert.equal(state.exploreLastResult?.status,'lost');
    assert.deepEqual(received.map(x=>({id:x.id,q:x.q})),
     [{id:protectedItem.id,q:protectedItem.q}],'only the protected real item survives');
   }
   const settledCount=received.length;
   t.bank();assert.equal(received.length,settledCount,'settlement is idempotent');
   assert.equal(r.id,raidId);
   assert.equal(JSON.stringify(r.containers.map(x=>({id:x.id,contents:x.contents}))),sealedContainers);
   matrix.push({waitSeconds,route:routeId,realWeightKg:original.weight/10,
    carriedKg:cargo.weight/10,speedPct:cargo.pct,dropped,
    routeSteps:choice.steps,patrolNearby:choice.patrolExposure.nearPoints,
    waitElapsed:+(waitedFrames*.04).toFixed(2),
    waitAlertSeconds:+(waitAlerts*.04).toFixed(2),
    waitNearSeconds:+(waitNear*.04).toFixed(2),
    maxGuards,diedWhileWaiting,routeResult,settlement:state.exploreLastResult.status});
  }
 }
 assert.deepEqual(matrix.map(x=>[x.waitSeconds,x.route]),
  [[0,'central'],[0,'northern'],[1,'central'],[1,'northern'],[12,'central'],[12,'northern']]);
 for(const routeId of ['central','northern']){
  const immediate=matrix.find(x=>x.waitSeconds===0&&x.route===routeId);
  const shortWait=matrix.find(x=>x.waitSeconds===1&&x.route===routeId);
  const delayed=matrix.find(x=>x.waitSeconds===12&&x.route===routeId);
  assert.equal(immediate.carriedKg,delayed.carriedKg,'same sealed loot and manual discard');
  assert.equal(immediate.carriedKg,shortWait.carriedKg,'one-second wait carries same loot');
  assert.equal(immediate.speedPct,delayed.speedPct,'departure speed is controlled');
  assert.equal(immediate.speedPct,shortWait.speedPct,'one-second departure has identical load');
  assert.equal(immediate.routeSteps,delayed.routeSteps,'same real corridor geometry');
  assert.equal(immediate.routeSteps,shortWait.routeSteps,'one-second wait keeps route geometry');
  assert.equal(immediate.patrolNearby,delayed.patrolNearby,'authored proximity is static');
  assert.ok(shortWait.waitElapsed>0&&shortWait.waitElapsed<=1);
  assert.ok(delayed.waitElapsed>0&&delayed.waitElapsed<=12);
  assert.ok(['escaped','lost'].includes(delayed.settlement));
 }
 tctx.diagnostic('R6.52 authentic cargo x active 0/1/12s patrol-phase departure (fixed seed, no dodge): '+
  JSON.stringify(matrix));
});

test('R6.52 pause is not a twelve-second patrol phase advance or loot mutation',async()=>{
 let now=1_000_000;
 const {t,layout}=await harness(()=>.73,{now:()=>now});
 t.startRun();const r=t.runRef();
 r.player.x=layout.basementKey.x;r.player.y=layout.basementKey.y;
 assert.equal(t.useBasementInteraction(),true);
 r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.useBasementInteraction(),true);
 const guardsBefore=JSON.stringify(r.enemies),pendingBefore=JSON.stringify(r.pendingGuardPosts);
 const sealedBefore=JSON.stringify(r.containers),lootBefore=JSON.stringify(r.loot);
 const left=t.remaining(),raidId=r.id;
 t.togglePause();assert.equal(r.paused,true);
 for(let i=0;i<300;i++){now+=40;t.tick(.04);}
 assert.equal(t.remaining(),left,'clock must stay frozen for 12 seconds of paused wall time');
 assert.equal(JSON.stringify(r.enemies),guardsBefore,'pause must not advance active patrols');
 assert.equal(JSON.stringify(r.pendingGuardPosts),pendingBefore,'pause must not spawn guards');
 assert.equal(JSON.stringify(r.containers),sealedBefore,'pause must not reroll real loot');
 assert.equal(JSON.stringify(r.loot),lootBefore,'pause must not grant/lose items');
 assert.equal(r.id,raidId);
 t.togglePause();assert.equal(r.paused,false);
 assert.equal(t.validCheckpoint(t.snapshotRun()),true);
});


// R6.53: Test whether leaving the exposed U08 pickup tile for a physically
// reachable corridor waypoint can create a different waiting opportunity.
// "Cover" is strictly a LOS check against the AUTHORED heavy guard origin
// using the actual Tiled blockers, not a promise of concealment from any
// live moving guard. Each attempt obtains genuine sealed 1F+B1 loot and
// voluntarily lightens it under the unchanged 12 kg carrying limit.
// Fixed-waypoint bots do not dodge or fight; no rate or safety inference.
test('R6.53 real U08 cover-retreat x active patrol, two loot seeds and both B1 corridors',async tctx=>{
 const scenarios=['immediate','exposed-1s','retreat-1s','retreat-8s'];
 const results=[];
 for(const seed of [.23,.73]){
  for(const routeId of ['central','northern']){
   for(const strategy of scenarios){
    let now=1_000_000;
    const {t,layout,basementLayout,gameWindow,state,received}=await harness(()=>seed,{now:()=>now});
    const advance=ms=>{now+=ms};
    t.startRun();const r=t.runRef(),raidId=r.id;
    let cursor=layout.start;
    const walk=(world,destination,label)=>{
     const route=r617Path(world,cursor,destination);
     const moved=r619MeasureReturn(t,world,route,advance);
     assert.equal(moved.completed,true,'real AI must permit approach to '+label);
     cursor=destination;
    };
    const collect=source=>{
     t.openContainer();
     assert.equal(r.paused,true,'real container opens at its physical position');
     const cache=r.containers.find(c=>c.id===r.lootOpenId);
     assert.equal(cache?.id,source.id);
     const sealed=cache.contents.map(x=>({id:x.id,q:x.q}));
     assert.ok(sealed.length>0,'no artificial cargo or empty container');
     const oldCount=r.loot.length;
     t.takeAllContainerItems({dataset:{container:cache.id,revision:String(r.lootOpenRevision||0)}});
     assert.deepEqual(r.loot.slice(oldCount).map(x=>({id:x.id,q:x.q})),sealed);
     t.closeContainer();
    };
    for(const id of ['tiled-loot-8','tiled-loot-3']){
     const source=layout.authoredContainers.find(x=>x.id===id);
     assert.ok(source);walk(layout,source,'surface '+id);collect(source);
    }
    walk(layout,layout.basementKey,'basement key');
    assert.equal(t.useBasementInteraction(),true);
    walk(layout,layout.basementEntrance,'basement stairs');
    assert.equal(t.useBasementInteraction(),true);
    assert.equal(r.undergroundEntered,true);
    assert.equal(r.duration,420,'one fixed clock plus basement bonus');
    cursor=basementLayout.start;
    const ultra=basementLayout.authoredContainers.find(x=>x.id==='tiled-loot-10');
    assert.ok(ultra&&ultra.tier==='ultra');
    walk(basementLayout,ultra,'B1 U08');
    collect(ultra);
    assert.equal(r.stats.weightLimit,12,'production weight limit is unchanged');
    const initial=t.v5CargoRisk();
    assert.ok(r.loot.length>=2,'real haul includes multiple items');

    t.togglePause();assert.equal(r.paused,true);
    const keep=r.loot.reduce((a,b)=>t.weightTenths(a.id)<=t.weightTenths(b.id)?a:b);
    gameWindow.explorationAction({dataset:{explore:'protect',
     i:String(r.loot.findIndex(x=>x.tid===keep.tid)),tid:String(keep.tid)}});
    assert.ok(r.safeIds.includes(keep.tid));
    let discarded=0;
    while(t.v5CargoRisk().pct<85){
     const candidate=r.loot.filter(x=>!r.safeIds.includes(x.tid))
      .sort((a,b)=>t.weightTenths(b.id)-t.weightTenths(a.id))[0];
     assert.ok(candidate,'must lighten genuine unprotected loot, not edit load stats');
     const i=r.loot.findIndex(x=>x.tid===candidate.tid);
     const button={dataset:{explore:'drop',i:String(i),tid:String(candidate.tid)},
      textContent:'捨てる',setAttribute(){}};
     gameWindow.explorationAction(button);
     assert.ok(r.loot.some(x=>x.tid===candidate.tid),'first tap only confirms');
     gameWindow.explorationAction(button);
     assert.ok(!r.loot.some(x=>x.tid===candidate.tid),'second tap actually discards');
     discarded++;assert.ok(discarded<12);
    }
    const cargo=t.v5CargoRisk();
    assert.ok(cargo.pct>=85&&cargo.pct>=initial.pct);
    const actualLoot=r.loot.map(x=>({id:x.id,q:x.q}));
    const protectedLoot={id:keep.id,q:keep.q};
    const sealedBefore=JSON.stringify(r.containers.map(c=>({id:c.id,contents:c.contents})));
    assert.equal(t.validCheckpoint(t.snapshotRun()),true);

    const choice=t.v5BasementReturnChoices().routes.find(x=>x.id===routeId);
    assert.ok(choice&&choice.points.length>16,'real route has enough waypoints for a fallback');
    const heavy=basementLayout.guardPosts.find(g=>g.kind==='heavy');
    assert.ok(heavy,'use real authored G08 heavy guard, never spawn a fake one');
    const firstHidden=choice.points.findIndex((p,i)=>
     i>=3&&i<=Math.min(16,choice.points.length-2)&&
     !basementLayout.visionClear(heavy,p));
    const spotIndex=firstHidden>=3?firstHidden:8;
    const spot=choice.points[spotIndex];
    const occludedFromHeavyHome=!basementLayout.visionClear(heavy,spot);
    assert.equal(occludedFromHeavyHome,true,
     'retreat point must actually sit behind a blocking Tiled obstacle from G08 home');
    assert.equal(basementLayout.solid(spot.x,spot.y,12),false,'retreat tile is physically walkable');
    assert.ok(spotIndex>=3,'relocation really leaves U08 behind');
    const planSnapshot=t.snapshotRun();delete planSnapshot.savedAt;
    const same=t.snapshotRun();delete same.savedAt;
    assert.deepEqual(same,planSnapshot,'planning must be read-only');

    const clockBefore=t.remaining();
    t.togglePause();assert.equal(r.paused,false);
    let relocation=null,waitingFrames=0,waitAlerts=0,waitNear=0;
    const wantsRetreat=strategy.startsWith('retreat-');
    const plannedWait=strategy==='immediate'?0:strategy.endsWith('8s')?8:1;
    if(wantsRetreat){
     relocation=r619MeasureReturn(t,basementLayout,choice.points.slice(0,spotIndex+1),advance);
    }
    const reachedSpot=wantsRetreat&&relocation?.completed===true;
    if(!wantsRetreat||reachedSpot){
     while(waitingFrames<Math.round(plannedWait/.04)&&r.status==='playing'){
      r.joy={x:0,y:0};r.steer={x:0,y:0};
      advance(40);t.tick(.04);waitingFrames++;
      if(r.enemies.some(e=>['alert','chase','windup','recover'].includes(e.mode)))waitAlerts++;
      if(r.enemies.some(e=>Math.hypot(e.x-r.player.x,e.y-r.player.y)<180))waitNear++;
     }
    }
    const waitSeconds=+(waitingFrames*.04).toFixed(2);
    const diedBeforeReturn=r.status!=='playing';
    let outbound=null;
    if(!diedBeforeReturn){
     const rest=wantsRetreat?choice.points.slice(spotIndex):choice.points;
     outbound=r619MeasureReturn(t,basementLayout,rest,advance);
     assert.ok(outbound.seconds>0,'the player actually attempts real return steps');
     if(outbound.completed){
      assert.equal(r.status,'playing');
      assert.ok(t.remaining()>0);
      t.bank();
      assert.equal(state.exploreLastResult?.status,'escaped');
      assert.deepEqual(received.map(x=>({id:x.id,q:x.q})),actualLoot,
       'bank only remaining genuine loot on successful extraction');
     }
    }
    if(diedBeforeReturn||!outbound.completed){
     assert.equal(r.status,'lost','interrupted retreat/wait/return must really fail');
     assert.equal(state.exploreLastResult?.status,'lost');
     assert.deepEqual(received.map(x=>({id:x.id,q:x.q})),[protectedLoot],
      'only the genuinely protected treasure survives a loss');
    }
    const receivedCount=received.length;
    t.bank();assert.equal(received.length,receivedCount,'no duplicate settlement');
    assert.equal(r.id,raidId);
    assert.equal(JSON.stringify(r.containers.map(c=>({id:c.id,contents:c.contents}))),sealedBefore);
    const elapsed=+(clockBefore-t.remaining()).toFixed(2);
    const expectedWalk=(relocation?.seconds||0)+(outbound?.seconds||0)+waitSeconds;
    assert.ok(Math.abs(elapsed-expectedWalk)<.20,'only real active walking/waiting costs raid time');
    results.push({seed,route:routeId,strategy,
     initialKg:initial.weight/10,retainedKg:cargo.weight/10,movePct:cargo.pct,discarded,
     spotIndex,spot:{x:spot.x,y:spot.y},occludedFromHeavyHome,
     relocation,plannedWait,waitSeconds,waitAlertSeconds:+(waitAlerts*.04).toFixed(2),
     waitNearSeconds:+(waitNear*.04).toFixed(2),
     diedBeforeReturn,outbound,settlement:state.exploreLastResult.status,
     actualWalkAndWait:elapsed});
   }
  }
 }
 assert.equal(results.length,16,'2 real loot seeds x 2 corridors x 4 strategies');
 for(const seed of [.23,.73]){
  for(const routeId of ['central','northern']){
   const four=results.filter(x=>x.seed===seed&&x.route===routeId);
   assert.deepEqual(four.map(x=>x.strategy),scenarios);
   assert.equal(new Set(four.map(x=>x.retainedKg)).size,1,'same-seed loot load stays controlled');
   assert.equal(new Set(four.map(x=>x.movePct)).size,1,'same-seed speed stays controlled');
   assert.equal(new Set(four.map(x=>x.spotIndex)).size,1,'same static candidate per route');
   const immediate=four[0];
   assert.equal(immediate.plannedWait,0);
   assert.equal(immediate.waitSeconds,0);
   assert.equal(four[1].plannedWait,1);
   assert.equal(four[2].plannedWait,1);
   assert.equal(four[3].plannedWait,8);
   for(const row of four)assert.ok(['escaped','lost'].includes(row.settlement));
  }
 }
 tctx.diagnostic('R6.53 exposed/retreated waiting under real B1 guards, two fixed loot seeds (not human survival probabilities): '+
  JSON.stringify(results));
});


// R6.54: On a narrow phone, show the actual Tiled map (not a wall of route
// statistics) immediately after the route/zoom controls. Long static patrol
// estimates remain available below it. No alleged live guard position or
// R6.53 one-second success rate is displayed as navigation guidance.
test('R6.54 paused B1 map shows toggles and live Tiled floor before long audit notes',async()=>{
 let now=1_000_000;
 const {t,layout,basementLayout}=await harness(()=>.73,{now:()=>now});
 t.startRun();const r=t.runRef();
 r.basementKeyTaken=true;
 r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 r.player.x=basementLayout.authoredContainers.find(x=>x.id==='tiled-loot-10').x;
 r.player.y=basementLayout.authoredContainers.find(x=>x.id==='tiled-loot-10').y;
 const html=t.mapPanel();
 const where=(x)=>{const p=html.indexOf(x);assert.ok(p>=0,'missing map feature '+x);return p;};
 assert.ok(where('class="exp-map-v5-heading"')<where('class="exp-b1-route-switch"'));
 assert.ok(where('class="exp-b1-route-switch"')<where('class="exp-map-v5-tools"'));
 assert.ok(where('class="exp-map-v5-tools"')<where('id="exp-map-scroll"'));
 assert.ok(where('id="exp-map-scroll"')<where('class="exp-b1-return-guide"'),
  'route report goes below the actual navigable floor plan');
 assert.ok(where('id="exp-map-scroll"')<where('class="exp-map-inspect-link"'),
  'optional map inspector link must not hide the map on short landscape');
 assert.match(html,/data-b1-route="current"/);
 assert.match(html,/初期巡回計画に基づく参考値/);
 assert.match(html,/安全とは限りません/);
 assert.doesNotMatch(html,/退避地点を推奨|1秒なら安全|必ず帰還/);
 const oldVersion=r.mapVersion;
 r.mapVersion=4;
 const old=t.mapPanel();
 assert.doesNotMatch(old,/class="exp-b1-route-switch"/);
 assert.doesNotMatch(old,/class="exp-b1-return-guide"/);
 r.mapVersion=oldVersion;
 assert.equal(t.validCheckpoint(t.snapshotRun()),true);
});

// Short landscape can scroll the OUTER modal as well as its zoomed floor
// separately. Simulate re-created DOM nodes on innerHTML assignment, as
// actual Safari does. Route changes preserve both scroll offsets; zoom keeps
// the same floorplan point under the centre of the map viewport.
test('R6.54 route toggle and zoom keep both scrolling layers and the map centre',async()=>{
 let now=1_000_000;
 const {t,layout,gameWindow,dom}=await harness(()=>.37,{now:()=>now});
 t.startRun();const r=t.runRef(),id=r.id;
 r.basementKeyTaken=true;
 r.player.x=layout.basementEntrance.x;r.player.y=layout.basementEntrance.y;
 assert.equal(t.enterBasement(),true);
 r.paused=true;r.pausedAt=now;r.showMap=true;r.mapDirect=true;
 let card={scrollTop:320},map={scrollLeft:150,scrollTop:110,clientWidth:300,clientHeight:180};
 let html='',renders=0;
 const layer={
  get innerHTML(){return html;},
  set innerHTML(v){
   html=v;renders++;
   card={scrollTop:0};
   map={scrollLeft:0,scrollTop:0,clientWidth:300,clientHeight:180};
   dom.set('exp-map-scroll',map);
  },
  querySelector(selector){return selector==='.exp-map-v5-card'?card:null}
 };
 dom.set('exp-pause-layer',layer);
 dom.set('exp-map-scroll',map);
 const before=t.snapshotRun();
 const clock=t.remaining();
 gameWindow.explorationAction({dataset:{explore:'map-b1-route',routeMode:'compare'}});
 assert.ok(renders===1);
 assert.match(html,/aria-pressed="true">中央・北側を比較/);
 assert.deepEqual([card.scrollTop,map.scrollLeft,map.scrollTop],[320,150,110]);
 assert.equal(t.remaining(),clock);
 const unchanged=t.snapshotRun();
 delete before.savedAt;delete unchanged.savedAt;
 assert.deepEqual(unchanged,before,'route view is strictly presentation-only');
 gameWindow.explorationAction({dataset:{explore:'map-zoom-in'}});
 assert.ok(renders===2);
 assert.equal(r.mapZoom,1.5);
 assert.equal(card.scrollTop,320);
 assert.ok(Math.abs(map.scrollLeft-300)<.01,
  'zoom retains world-coordinate centre instead of multiplying its top-left offset');
 assert.ok(Math.abs(map.scrollTop-210)<.01);
 assert.equal(t.remaining(),clock);
 gameWindow.explorationAction({dataset:{explore:'map-b1-route',routeMode:'current'}});
 assert.ok(renders===3);
 assert.match(html,/aria-pressed="true">現在地からの経路/);
 assert.deepEqual([card.scrollTop,map.scrollLeft,map.scrollTop],[320,300,210]);
 gameWindow.explorationAction({dataset:{explore:'map-zoom-out'}});
 assert.ok(renders===4);
 assert.equal(r.mapZoom,1);
 assert.equal(card.scrollTop,320);
 assert.ok(Math.abs(map.scrollLeft-150)<.01&&Math.abs(map.scrollTop-110)<.01);
 assert.equal(r.id,id);
 assert.equal(r.status,'playing');
 assert.equal(r.paused,true);
 assert.equal(r.showMap,true);
 assert.equal(t.validCheckpoint(t.snapshotRun()),true);
 const css=read('exploration.css');
 assert.match(css,/R6\.54: the paused V5 map is now above/);
 assert.match(css,/\.exp-b1-route-switch button\{\s*min-height:44px/);
 const index=read('index.html');
 assert.equal((index.match(/mobilemap=R6\.54/g)||[]).length,2,
  'CSS and JS must both bypass cached iPhone PWA responses');
});


// R6.55: Safari may cancel the joystick pointer during a layout reflow but
// never dispatch a matching touchend for held right-hand controls. A new tap
// on the SAME button must remain possible immediately after rotating.
// Do not swallow native keyboard clicks, replay action taps, or change the
// ongoing raid's saved inventory, clock, AI or loot.
test('R6.55 viewport rotation retires held multi-touch actions without cancelling gameplay',async()=>{
 let now=1_000_000;
 const {t,dom,windowEvents,gameWindow}=await harness(()=>.31,{now:()=>now});
 t.startRun();const r=t.runRef(),raidId=r.id;
 const a=new Map(),p=new Map(),captures=new Set();
 const buttons=Object.fromEntries(['auto','attack','bag'].map(type=>[type,{
  dataset:{explore:type},disabled:false,
  closest(selector){return selector==='button[data-explore]'?this:null}
 }]));
 const actions={dataset:{},addEventListener:(k,fn)=>a.set(k,fn),
  contains:b=>Object.values(buttons).includes(b)};
 const zone={addEventListener:(k,fn)=>p.set(k,fn),
  getBoundingClientRect:()=>({left:0,top:420,right:195,bottom:810}),
  classList:{add(){},remove(){}},
  setPointerCapture:id=>captures.add(id),
  hasPointerCapture:id=>captures.has(id),
  releasePointerCapture:id=>captures.delete(id)};
 dom.set('.exp-playing .exp-control-actions',actions);
 dom.set('exp-stick-zone',zone);
 dom.set('exp-stick',{style:{},offsetWidth:100});
 dom.set('exp-stick-thumb',{style:{},offsetWidth:36});
 t.bindStick();t.bindMultiTouchActions();
 const pointer=(kind,id,x,y)=>p.get(kind)({pointerId:id,pointerType:'touch',
  clientX:x,clientY:y,preventDefault(){}});
 let prevented=0,blocked=0;
 const touch=(type,id)=>a.get('touchstart')({target:buttons[type],
  changedTouches:[{identifier:id}],cancelable:true,preventDefault(){prevented++}});
 const click=(type,detail=1)=>a.get('click')({target:buttons[type],detail,
  preventDefault(){prevented++},stopPropagation(){blocked++}});
 pointer('pointerdown',1,70,710);pointer('pointermove',1,109,680);
 assert.ok(r.joy.x>.5&&r.joy.y<-.3);
 touch('auto',41);
 assert.equal(r.autoAttack,true);
 r.attackAt=0;touch('attack',42);
 assert.ok(r.attackAt>0,'third finger fires while steering and AUTO is held');
 const clock=t.remaining(),saved=t.snapshotRun(),ai=JSON.stringify(r.enemies);
 // Safari reflows portrait/landscape while neither 41 nor 42 has ended.
 windowEvents.get('orientationchange')();
 assert.deepEqual(r.joy,{x:0,y:0},'original steering finger is retired');
 assert.deepEqual(r.steer,{x:0,y:0},'no leftover movement inertia');
 assert.equal(captures.size,0);
 assert.equal(r.autoAttack,true,'rotation must not synthesize a button press');
 assert.equal(r.paused,false,'rotation is not a pause');
 // WebKit can deliver a resize after orientationchange with no touchend.
 windowEvents.get('visualViewport:resize')();
 touch('auto',43);
 assert.equal(r.autoAttack,false,'new physical AUTO tap cannot be blocked by held ID 41');
 // A new Attack tap must also work after ID 42 was stranded.
 r.attackAt=0;touch('attack',44);
 assert.ok(r.attackAt>0,'new Attack tap is available after rotation');
 a.get('touchend')({target:{closest:()=>null},changedTouches:[{identifier:41},{identifier:42}]});
 click('auto');click('attack');
 assert.equal(blocked,2,'late synthesized clicks do not replay the old actions');
 click('auto',0);
 assert.equal(blocked,2,'keyboard click remains available');
 a.get('touchend')({target:buttons.auto,changedTouches:[{identifier:43}]});
 a.get('touchend')({target:buttons.attack,changedTouches:[{identifier:44}]});
 assert.equal(r.id,raidId);assert.equal(r.paused,false);
 assert.equal(t.remaining(),clock,'rotation does not spend the raid timer');
 assert.equal(JSON.stringify(r.enemies),ai,'rotation does not step any guard AI');
 const after=t.snapshotRun();
 // The only intended persisted change was AUTO state and manual attack time.
 assert.deepEqual(after.containers,saved.containers);
 assert.deepEqual(after.loot,saved.loot);
 assert.deepEqual(after.safeIds,saved.safeIds);
 assert.ok(t.validCheckpoint(after));
 assert.ok(prevented>=4);
});

test('R6.55 opening a live-time V5 bag suppresses transient HUD brief and restores it on close',async()=>{
 let now=1_000_000;
 const {t,dom,gameWindow}=await harness(()=>.61,{now:()=>now});
 t.startRun();const r=t.runRef(),raidId=r.id;
 r.enemies=[];
 const exit=t.exitPoint();
 r.player.x=exit.x;r.player.y=exit.y;
 const brief={textContent:'',dataset:{active:'',level:''}};
 const bag={classList:{open:false,
  contains(v){return v==='exp-bag-open'&&this.open},
  toggle(v){this.open=!this.open;return this.open},
  remove(){this.open=false}
 }};
 dom.set('exp-backpack',bag);dom.set('exp-v5-brief',brief);
 t.updateHUD(true);
 assert.match(brief.textContent,/出口に到着/,'main HUD shows real exit brief when visible');
 assert.equal(brief.dataset.active,'true');
 const before=t.snapshotRun(),remaining=t.remaining();
 gameWindow.explorationAction({dataset:{explore:'bag'}});
 assert.equal(bag.classList.open,true);
 assert.equal(brief.textContent,'','transient gameplay toast must not cover inventory');
 assert.equal(brief.dataset.active,'false');
 t.updateHUD(true);
 assert.equal(brief.textContent,'','forced HUD refresh must not resurrect brief over bag');
 gameWindow.explorationAction({dataset:{explore:'bag-close'}});
 assert.equal(bag.classList.open,false);
 assert.match(brief.textContent,/出口に到着/,'brief returns based on actual live state');
 assert.equal(brief.dataset.active,'true');
 assert.equal(r.paused,false,'bag remains live-time, not a hidden pause');
 assert.equal(r.id,raidId);
 assert.equal(t.remaining(),remaining);
 const after=t.snapshotRun();delete before.savedAt;delete after.savedAt;
 assert.deepEqual(after,before,'opening and closing bag changes no persistent raid state');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 const html=read('index.html');
 assert.equal((html.match(/touchguard=R6\.55/g)||[]).length,1,
  'new exploration.js reaches old Safari/PWA caches without changing CSS');
});


// R6.56: V5's visible inventory toggle must disclose the actual overlay state
// to VoiceOver/screen readers. In particular, closing from the inventory's
// own close button or an unrelated pause must not leave aria-expanded="true".
// This audit changes no touch hit targets, save schema, or enemy behaviour.
test('R6.56 bag expanded state is exposed on the V5 trigger and stays in sync across close/pause',async()=>{
 let now=1_000_000;
 const {t,dom,gameWindow}=await harness(()=>.31,{now:()=>now});
 t.startRun();const r=t.runRef(),id=r.id;
 let focused=0,focusOptions=null;
 const attrs={};
 const opener={setAttribute(k,v){attrs[k]=v},
  focus(options){focused++;focusOptions=options}};
 const bag={classList:{open:false,
  contains(k){return k==='exp-bag-open'&&this.open},
  toggle(){this.open=!this.open;return this.open},
  remove(){this.open=false}
 }};
 dom.set('exp-bag-button',opener);
 dom.set('exp-backpack',bag);
 const markup=t.contents();
 assert.match(markup,/id="exp-bag-button" data-explore="bag" aria-controls="exp-backpack" aria-expanded="false"/,
  'assistive tech identifies which inventory region will expand');
 assert.match(markup,/id="exp-backpack" role="region" aria-label="戦利品バッグ"/);
 t.updateHUD(true);
 assert.equal(attrs['aria-expanded'],'false');
 const before=t.snapshotRun(),time=t.remaining();
 gameWindow.explorationAction({dataset:{explore:'bag'}});
 assert.equal(bag.classList.open,true);
 assert.equal(attrs['aria-expanded'],'true');
 gameWindow.explorationAction({dataset:{explore:'bag-close'}});
 assert.equal(bag.classList.open,false);
 assert.equal(attrs['aria-expanded'],'false','explicit close updates expanded flag');
 assert.equal(focused,1,'assistive focus returns to the original toggle');
 assert.deepEqual(focusOptions,{preventScroll:true});
 gameWindow.explorationAction({dataset:{explore:'bag'}});
 assert.equal(attrs['aria-expanded'],'true');
 t.togglePause();assert.equal(r.paused,true);
 assert.equal(bag.classList.open,false,'pause closes a live inventory');
 assert.equal(attrs['aria-expanded'],'false','pause also retires expanded state');
 t.togglePause();assert.equal(r.paused,false);
 assert.equal(attrs['aria-expanded'],'false','resume cannot revive hidden inventory');
 assert.equal(r.id,id);
 assert.equal(t.remaining(),time,'reading or opening the bag itself consumes no synthetic time');
 const after=t.snapshotRun();
 for(const key of ['loot','containers','safeIds','riskUids','stats'])
  assert.deepEqual(after[key],before[key],'inventory accessibility does not change '+key);
 assert.ok(t.validCheckpoint(after));
});

test('R6.56 Escape closes inventory immediately with focus and live HUD restored, without unpausing',async()=>{
 let now=1_000_000;
 const {t,dom,documentEvents,gameWindow}=await harness(()=>.61,{now:()=>now});
 t.startRun();const r=t.runRef(),id=r.id;
 r.enemies=[];const exit=t.exitPoint();r.player.x=exit.x;r.player.y=exit.y;
 let focusCount=0,prevented=0;
 const attributes={};
 const opener={setAttribute(k,v){attributes[k]=v},focus(){focusCount++}};
 const bag={classList:{open:false,
  contains(k){return k==='exp-bag-open'&&this.open},
  toggle(){this.open=!this.open;return this.open},
  remove(){this.open=false}
 }};
 const brief={textContent:'',dataset:{active:'',level:''}};
 dom.set('exp-bag-button',opener);dom.set('exp-backpack',bag);dom.set('exp-v5-brief',brief);
 const key=documentEvents.get('keydown');
 t.updateHUD(true);
 assert.match(brief.textContent,/出口に到着/);
 const saved=t.snapshotRun(),time=t.remaining();
 gameWindow.explorationAction({dataset:{explore:'bag'}});
 assert.equal(brief.textContent,'');
 assert.equal(attributes['aria-expanded'],'true');
 const onEscape={key:'Escape',target:{tagName:'DIV'},preventDefault(){prevented++}};
 key(onEscape);
 assert.equal(prevented,1);
 assert.equal(bag.classList.open,false,'Escape dismisses the inventory only');
 assert.equal(attributes['aria-expanded'],'false','screen-reader state changes immediately');
 assert.match(brief.textContent,/出口に到着/,'live HUD returns without needing another frame');
 assert.equal(brief.dataset.active,'true');
 assert.equal(focusCount,1);
 assert.equal(r.paused,false,'Escape on an open inventory must not pause or resume the raid');
 assert.equal(r.id,id);
 assert.equal(t.remaining(),time);
 const after=t.snapshotRun();delete after.savedAt;delete saved.savedAt;
 assert.deepEqual(after,saved,'keyboard dismissal does not mutate gameplay or sealed loot');
 assert.ok(t.validCheckpoint(t.snapshotRun()));
 assert.equal((read('index.html').match(/bagaccess=R6\.56/g)||[]).length,1,
  'Safari must fetch the updated exploration.js without needing a CSS cache bust');
});
