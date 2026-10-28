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
 ...Equipment.items,MapItem.item
];
const itemMap=new Map(ITEMS.map(it=>[it.id,it]));
async function harness(){
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
  'window.__v5test={startRun,runRef:()=>run,resetRun:()=>{run=null},snapshotRun,restoreRunIfNeeded,validCheckpoint,openContainer,takeContainerItem,closeContainer,bank,lose,exitPoint,restoreEnemy,enemyDefinition,enemyPatrol,updateEnemy,facilityCanSeePlayer,facilityVisionClear,stealthSituation,updateHUD,contents,facilityNoticeReady,facilityNoticeThreshold,facilityPursuitSpeed,tick};'+sourceGame.slice(end);
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
  'esc','cancelAnimationFrame','receive','markDelete',sourceGame)(...deps);
 await Promise.resolve();
 return {t:window.__v5test,layout,state,received,dom,renderCount:()=>renders};
}
test('V5 full raid uses production containers and resumes exact sealed loot',async()=>{
 const {t,layout,state}=await harness();
 t.startRun();const run=t.runRef();
 assert.equal(run.mapVersion,5);
 assert.equal(run.duration,300);
 assert.equal(run.exitId,layout.fixedExit.id);
 assert.equal(run.containers.length,11);
 assert.equal(run.pendingGuardPosts.length<=6,true);
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
