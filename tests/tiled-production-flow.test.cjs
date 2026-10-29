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
async function harness(randomOverride=null){
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
 const document={body:{classList:{add(){},remove(){},toggle(){}},addEventListener(){}},
  getElementById:id=>dom.get(id)||null,querySelector:()=>null,addEventListener(){},hidden:false};
 const window={TreasureMallLayout:Mall,TreasureMallLayoutV3:MallV3,TreasureFacilityLayoutV4:MallV4,
  TreasureIndoorLayoutV5:{load:()=>Promise.resolve(layout)},TreasureCombatRules:Combat,
  TreasureEquipmentPilot:Equipment,TreasureMapItem:MapItem,
  crypto:{randomUUID:()=>String(Math.random()).slice(2)},confirm:()=>true,addEventListener(){}};
 let sourceGame=read('exploration.js');
 const end=sourceGame.lastIndexOf('})();');
 assert.ok(end>0);
 sourceGame=sourceGame.slice(0,end)+
  'window.__v5test={startRun,runRef:()=>run,resetRun:()=>{run=null},snapshotRun,restoreRunIfNeeded,validCheckpoint,openContainer,takeContainerItem,closeContainer,bank,lose,exitPoint,restoreEnemy,enemyDefinition,enemyPatrol,updateEnemy,facilityCanSeePlayer,facilityVisionClear,stealthSituation,updateHUD,contents,facilityNoticeReady,facilityNoticeThreshold,facilityPursuitSpeed,tick,V5_SUPPLY_WEIGHTS,v5SsrPlusPercent,containerReward,facilityPreviewPanel,setPreviewVariant:v=>facilityPreviewVariant=v,mapPanel,v5FacilityPlanSvg,hasDetailedMap,lootBaseValue,lootBaseTotal,lootSummary,lootOrder,lootRowsV5,lootSortControls,lootAutoProtectButton,weightLabel,carrySpeedFactor,pausePanel,weightTenths,solid,useVaultInteraction,sealVaultOnEntry,nearVaultKeycard,nearVaultGate,nearVaultHatch,reconcileIndoorCheckpoint,activateFacilityGuardPosts};'+sourceGame.slice(end);
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
  'esc','cancelAnimationFrame','receive','markDelete','Math',sourceGame)(...deps,
  Object.assign(Object.create(Math),randomOverride?{random:randomOverride}:{}));
 await Promise.resolve();
 return {t:window.__v5test,layout,state,received,dom,gameWindow:window,itemRarity:id=>itemMap.get(id)?.rarity,renderCount:()=>renders};
}
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
 assert.equal(guard.mode,'patrol','guard returns to normal patrol instead of permanently tracking through cover');
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
 e.mode='chase';
 assert.equal(t.stealthSituation().percent,100);
 t.updateHUD(true);
 assert.equal(status.dataset.state,'chase');
 assert.match(text.textContent,/発見中/);
 e.mode='patrol';e.notice=0;
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
 assert.equal(e.mode,'patrol','search eventually expires rather than locking enemies into pursuit');
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
 assert.ok(ten<1&&ten>.95,'moderately loaded players slow a little');
 assert.ok(twelve<ten&&twelve>.93,'full load is still runnable');
 assert.ok(sixteen<twelve&&sixteen>.6,'heavy load creates a meaningful extraction risk');
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
  assert.match(after,variant==='cover'?/一本道＋隠れ場所5か所/:/完全一本道/);
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
 assert.match(hidden,/B：隠れ場所5か所/);
 assert.match(hidden,/exp-map-hiding-cover/);
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
 assert.match(map,/一本道＋隠れ場所5か所/);
 assert.match(map,/exp-map-hiding-cover/);
 assert.ok(t.validCheckpoint(t.snapshotRun()));
});
