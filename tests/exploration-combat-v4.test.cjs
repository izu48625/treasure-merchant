'use strict';
// R5.20: combat and movement balance for the integrated facility only.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const V2=require('../exploration-layout.js'),V3=require('../exploration-layout-v3.js'),V4=require('../exploration-layout-v4.js');
const Pilot=require('../equipment-pilot.js'),Combat=require('../combat-rules.js'),MapItem=require('../exploration-map-item.js');
const ITEMS=[
 {id:'ITM-00001',name:'エクスカリバー',rarity:'EX',category:'神話・武器',group:'神話・伝説',base:3000000,image:'data:mock'},
 {id:'ITM-00002',name:'ダイヤ',rarity:'UR',category:'宝石',group:'宝石・宝飾',base:500,image:'data:mock'},
 ...Pilot.items,MapItem.item
],ITEM_BY_ID=new Map(ITEMS.map(x=>[x.id,x]));
function harness(v4=true,facilityLayout=V4){
 const nodes=new Map();
 const state={inv:[],exploreArea:'mall',exploreEquip:{weapon:0,weapon2:0,head:0,body:0,legs:0,accessory:0,tool:0},exploreRun:null};
 const document={body:{classList:{toggle(){},add(){},remove(){}},addEventListener(){}},
  addEventListener(){},querySelector(){return null},getElementById(id){return nodes.get(id)||null},hidden:false};
 const window={TreasureMallLayout:V2,TreasureMallLayoutV3:V3,TreasureFacilityLayoutV4:v4?facilityLayout:undefined,
  TreasureEquipmentPilot:Pilot,TreasureCombatRules:Combat,TreasureMapItem:MapItem,
  addEventListener(){},crypto:{randomUUID(){return 'combat-test'}},confirm(){return true}};
 const source=fs.readFileSync(path.join(__dirname,'../exploration.js'),'utf8'),at=source.lastIndexOf('})();');
 assert.ok(at>0);
 const patched=source.slice(0,at)+
  'window.__combatTest={startRun,runRef:()=>run,enemyDefinition,restoreEnemy,performAttack,updateEnemy,gearStats,solid,canSeeBetween,snapshotRun,validCheckpoint,facilityThreatLevel,liveEnemyCap,enemyKindForTime,enemyHitPlayer,carrySpeedFactor,weightLabel,facilityCanSeePlayer,facilityNoticeReady,facilityVisionContour,drawFacilityVision,setRadarCtx:value=>{ctx=value},recycleDistantFacilityGuards,activateFacilityGuardPosts,facilityPursuitSpeed,enemyMoveTowards,updateHUD};'+source.slice(at);
 new Function('window','document','state','ITEMS','ITEM_BY_ID','item','quality','RARITY','QNAME',
 'storageReady','actionPersisting','save','saveWithCommit','render','Image','esc','cancelAnimationFrame',patched)(
 window,document,state,ITEMS,ITEM_BY_ID,id=>ITEM_BY_ID.get(id),()=>1,
 ['N','C','R','SR','SSR','UR','EX'],['低','中','高','最高'],true,false,()=>{},fn=>fn(),()=>{},
 function(){this.complete=true;this.naturalWidth=0;this.src=''},String,()=>{});
 return {t:window.__combatTest,state,nodes};
}
function target(h,kind='normal',offset=-35,mode='chase'){
 const run=h.t.runRef(),p=run.player;
 return h.t.restoreEnemy({
  x:p.x+offset,y:p.y,kind,hp:h.t.enemyDefinition(kind).hp,mode,
  homeX:p.x+offset,homeY:p.y,attackAt:99,
  lastSeen:0,lastX:p.x,lastY:p.y
 });
}
test('facility enemies have deliberately differentiated roles',()=>{
 const h=harness();h.t.startRun();
 const normal=h.t.enemyDefinition('normal'),fast=h.t.enemyDefinition('fast'),heavy=h.t.enemyDefinition('heavy');
 assert.equal(normal.hp,68);assert.equal(fast.hp,46);assert.equal(heavy.hp,125);
 assert.ok(fast.speed>normal.speed&&normal.speed>heavy.speed);
 assert.ok(h.t.gearStats().speed>fast.speed,'unencumbered player can run away');
 assert.ok(heavy.windup>normal.windup&&normal.windup>fast.windup);
 assert.ok(heavy.recovery>fast.recovery&&fast.recovery>normal.recovery);
});
test('facilities only: restored prior V3 enemies retain original stats',()=>{
 const h=harness(false);h.t.startRun();
 assert.equal(h.t.runRef().mapVersion,3);
 assert.equal(h.t.enemyDefinition('normal').hp,35);
 assert.equal(h.t.enemyDefinition('fast').speed,86);
 assert.equal(h.t.enemyDefinition('heavy').damage,20);
});
test('mobile manual attack locks onto a nearby enemy while retreating',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef(),e=target(h,'normal',-35);
 r.enemies=[e];r.facing={x:1,y:0};r.attackAt=0;
 assert.equal(h.t.canSeeBetween(r.player,e),true);
 assert.equal(h.t.performAttack(true,.1),true);
 assert.ok(e.hp<68,'manual tap should damage a visible threat behind movement direction');
 assert.ok(r.slash.dx<0,'attack animation points to actual enemy');
});
test('empty manual taps still swing in the actual movement direction',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef();
 r.enemies=[];r.facing={x:1,y:0};r.attackAt=0;
 h.t.performAttack(true,.2);
 assert.ok(r.slash.dx>0);
});
test('a manual hit interrupts regular/fast windup but not heavy windup',()=>{
 for(const kind of ['normal','fast','heavy']){
  const h=harness();h.t.startRun();const r=h.t.runRef(),e=target(h,kind,-35,'windup');
  e.phaseUntil=1.4;e.attackAt=0;r.enemies=[e];r.facing={x:1,y:0};
  h.t.performAttack(true,.2);
  assert.equal(e.mode,kind==='heavy'?'windup':'recover',kind);
 }
});
test('fast target briefly moves laterally in open corridor instead of only charging',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef(),e=target(h,'fast',75,'chase');
 e.lastSeen=.1;e.attackAt=100;r.enemies=[e];
 const before={x:e.x,y:e.y};
 assert.equal(h.t.canSeeBetween(e,r.player),true);
 h.t.updateEnemy(e,.5,.12);
 assert.ok(Math.abs(e.y-before.y)>0.1,'fast enemy should sidestep');
 assert.ok(!h.t.solid(e.x,e.y,10),'lateral movement must remain physical');
});
test('save and restore preserve enemy mode, health and loot',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef(),e=target(h,'fast',75,'chase');
 r.enemies=[e];e.hp=9;e.lastSeen=2;
 const saved=h.t.snapshotRun();
 assert.ok(h.t.validCheckpoint(saved));
 assert.equal(saved.enemies[0].hp,9);
 assert.equal(saved.enemies[0].mode,'chase');
});

test('R5.25 time slowly adds sentries without changing facility danger tier',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef();
 assert.equal(h.t.facilityThreatLevel(),0);
 assert.equal(h.t.liveEnemyCap(20),4);
 assert.equal(h.t.liveEnemyCap(89),4);
 assert.equal(h.t.liveEnemyCap(90),5);
 assert.equal(h.t.liveEnemyCap(210),6);
 assert.equal(h.t.enemyKindForTime(500),'normal');
 r.start=Date.now()-500000;
 assert.equal(h.t.facilityThreatLevel(),0,'time never changes type or map-depth danger');
});
test('going deeper or carrying more treasure increases the encounter threat',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef();
 const far=V4.exitCandidates.reduce((best,p)=>Math.hypot(p.x-V4.start.x,p.y-V4.start.y)>Math.hypot(best.x-V4.start.x,best.y-V4.start.y)?p:best,V4.exitCandidates[0]);
 r.player.x=far.x;r.player.y=far.y;
 assert.equal(h.t.facilityThreatLevel(),3);
 assert.equal(h.t.liveEnemyCap(40),10);
 r.player.x=V4.start.x;r.player.y=V4.start.y;
 r.loot=Array.from({length:8},(_,i)=>({id:'ITM-00002',q:1,tid:i+1}));
 assert.equal(h.t.facilityThreatLevel(),2);
 assert.equal(h.t.liveEnemyCap(40),8);
});
test('legacy enemy population cap still ramps on active time',()=>{
 const h=harness(false);h.t.startRun();
 assert.equal(h.t.liveEnemyCap(10),4);
 assert.equal(h.t.liveEnemyCap(110),8);
 assert.equal(h.t.liveEnemyCap(180),10);
});

test('R5.21 V4 overload slows progressively, HUD agrees, legacy penalties remain unchanged',()=>{
 const loot=n=>Array.from({length:n},(_,i)=>({id:'ITM-00002',q:1,tid:i+1})); // 0.1 kg each
 const h=harness();h.t.startRun();const r=h.t.runRef();
 r.loot=loot(120);
 assert.equal(h.t.carrySpeedFactor(r.loot,12),1);
 r.loot=loot(121);
 const slight=h.t.carrySpeedFactor(r.loot,12);
 assert.ok(slight>.98&&slight<1,'0.1 kg excess should not abruptly cut movement to 40%');
 assert.equal(h.t.weightLabel().pct,Math.round(slight*100));
 r.loot=loot(150);
 const medium=h.t.carrySpeedFactor(r.loot,12);
 assert.ok(medium>.8&&medium<.9,'3 kg excess should be risky without trapping player');
 r.loot=loot(200);
 assert.equal(h.t.carrySpeedFactor(r.loot,12),.6,'heaviest bags retain a playable speed floor');
 const old=harness(false);old.t.startRun();const original=old.t.runRef();
 original.loot=loot(121);
 assert.equal(old.t.carrySpeedFactor(original.loot,12),.4);
 original.loot=loot(150);
 assert.equal(old.t.carrySpeedFactor(original.loot,12),.2);
});
test('R5.21 taking cover during a V4 windup prevents an otherwise valid melee hit',()=>{
 const blockedLayout={...V4,lineClear:()=>false};
 const blocked=harness(true,blockedLayout);blocked.t.startRun();
 const rb=blocked.t.runRef(),eb=target(blocked,'heavy',-35,'windup');
 eb.aimX=1;eb.aimY=0;
 assert.equal(blocked.t.enemyHitPlayer(eb,blocked.t.enemyDefinition('heavy'),rb.player),false);
 assert.equal(rb.player.hp,rb.stats.maxHp);
 const open=harness();open.t.startRun();
 const ro=open.t.runRef(),eo=target(open,'heavy',-35,'windup');
 eo.aimX=1;eo.aimY=0;
 assert.equal(open.t.canSeeBetween(eo,ro.player),true);
 assert.equal(open.t.enemyHitPlayer(eo,open.t.enemyDefinition('heavy'),ro.player),true);
 assert.ok(ro.player.hp<ro.stats.maxHp);
});
test('R5.21 manual V4 taps reward timing over AUTO without altering strike damage',()=>{
 function cooldown(manual){
  const h=harness();h.t.startRun();const r=h.t.runRef();
  const e=target(h,'normal',-35,'chase');r.enemies=[e];r.attackAt=0;
  assert.equal(h.t.performAttack(manual,1),true);
  assert.ok(e.hp<68);
  return {cooldown:r.attackAt-1,damage:68-e.hp};
 }
 const hand=cooldown(true),auto=cooldown(false);
 assert.ok(Math.abs(auto.cooldown-hand.cooldown*1.25)<1e-8);
 assert.equal(hand.damage,auto.damage);
});

test('R5.22 forward radar sees the player, but not an ordinary approach from behind',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef(),e=target(h,'normal',110,'patrol');
 assert.equal(h.t.canSeeBetween(e,r.player),true);
 e.facingX=1;e.facingY=0;
 assert.equal(h.t.facilityCanSeePlayer(e,r.player,h.t.enemyDefinition('normal')),false);
 e.facingX=-1;
 assert.equal(h.t.facilityCanSeePlayer(e,r.player,h.t.enemyDefinition('normal')),true);
 e.x=r.player.x+28;e.facingX=1;
 assert.equal(h.t.facilityCanSeePlayer(e,r.player,h.t.enemyDefinition('normal')),true,
  'point-blank sound/awareness must deter exploiting the blind spot');
});
test('R5.22 furniture occludes actual vision and the drawn radar contour',()=>{
 const blind={...V4,lineClear:()=>false,visionClear:()=>false,visionRayDistance:()=>0};
 const h=harness(true,blind);h.t.startRun();const r=h.t.runRef(),e=target(h,'normal',105,'patrol');
 e.facingX=-1;e.facingY=0;
 assert.equal(h.t.facilityCanSeePlayer(e,r.player,h.t.enemyDefinition('normal')),false);
 const contour=h.t.facilityVisionContour(e,h.t.enemyDefinition('normal'),Date.now());
 assert.equal(contour.length,13);
 assert.ok(contour.every(p=>Math.hypot(p.x-e.x,p.y-e.y)<1),
  'do not draw vision through an opaque wall');
});
test('R5.22 brief exposure is forgivable, but sustained visibility triggers pursuit',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef(),e=target(h,'normal',110,'patrol');
 r.enemies=[e];e.facingX=-1;e.facingY=0;
 e.patrolUntil=100;e.lastSeen=-999;
 h.t.updateEnemy(e,.1,.1);
 assert.equal(e.mode,'patrol');assert.ok(e.notice>0);
 e.facingX=1;h.t.updateEnemy(e,.2,.1);
 assert.equal(e.mode,'patrol');assert.ok(e.notice<.1,'hiding rapidly resets suspicion');
 e.facingX=-1;
 h.t.updateEnemy(e,.3,.14);h.t.updateEnemy(e,.5,.20);
 assert.equal(e.mode,'alert');
 h.t.updateEnemy(e,.9,.1);
 assert.equal(e.mode,'chase');
});
test('R5.22 once spotted, guards track and then search when line-of-sight is lost',()=>{
 const hidden={...V4,lineClear:()=>false,visionClear:()=>false,visionRayDistance:()=>0};
 const h=harness(true,hidden);h.t.startRun();const r=h.t.runRef(),e=target(h,'normal',105,'chase');
 r.enemies=[e];e.lastSeen=0;e.facingX=1;e.notice=.45;
 h.t.updateEnemy(e,3,.1);
 assert.equal(e.mode,'chase','detected player remains the objective during 4.3s memory');
 h.t.updateEnemy(e,4.5,.1);
 assert.equal(e.mode,'search','sentry eventually searches rather than wall-hacking forever');
 assert.equal(e.notice,0,'breaking contact should reset suspicion and permit hiding');
 const legacy=harness(false);legacy.t.startRun();
 assert.equal(legacy.t.enemyDefinition('normal').damage,9,'old maps keep previous combat tuning');
});
test('R5.22 a direct unarmored encounter costs roughly half HP after two solid hits',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef(),e=target(h,'normal',-35,'windup');
 e.aimX=1;e.aimY=0;r.enemies=[e];
 const def=h.t.enemyDefinition('normal');
 assert.equal(def.damage,28);
 assert.equal(h.t.enemyHitPlayer(e,def,r.player),true);
 r.player.invuln=0;
 assert.equal(h.t.enemyHitPlayer(e,def,r.player),true);
 assert.equal(r.player.hp,44,'two normal hits from 100HP leave 44HP');
 assert.equal(h.t.enemyDefinition('fast').damage,23);
 assert.equal(h.t.enemyDefinition('heavy').damage,36);
});
test('R5.22 consecutive hits cannot permanently stagger a spotted enemy',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef(),e=target(h,'normal',-35,'windup');
 r.enemies=[e];r.attackAt=0;e.phaseUntil=4;
 h.t.performAttack(true,.2);
 assert.equal(e.mode,'recover');assert.ok(e.staggerResistUntil>2);
 e.mode='windup';e.phaseUntil=4;
 h.t.performAttack(true,1);
 assert.equal(e.mode,'windup','second strike inside resistance must not interrupt');
 e.mode='windup';e.phaseUntil=5;
 h.t.performAttack(true,3.2);
 assert.equal(e.mode,'recover','after resistance expires an accurate hit can interrupt again');
 const snapshot=h.t.snapshotRun();
 assert.ok(h.t.validCheckpoint(snapshot));
 assert.equal(snapshot.enemies[0].staggerResistUntil,e.staggerResistUntil);
});

test('R5.23 patrol sight reaches farther while the rear remains a blind spot',()=>{
 const clear={...V4,lineClear:()=>true,visionClear:()=>true,visionRayDistance:(e,d,max)=>max};
 const h=harness(true,clear);h.t.startRun();const r=h.t.runRef();
 for(const [kind,range] of [['normal',245],['fast',270],['heavy',205]]){
  const def=h.t.enemyDefinition(kind);
  const e=target(h,kind,range-4,'patrol');e.facingX=-1;e.facingY=0;
  assert.equal(def.detect,range);
  assert.equal(h.t.facilityCanSeePlayer(e,r.player,def),true,kind+' sees inside the expanded cone');
  e.x=r.player.x+range+4;
  assert.equal(h.t.facilityCanSeePlayer(e,r.player,def),false,kind+' cannot detect beyond its true range');
  e.x=r.player.x+range-4;e.facingX=1;
  assert.equal(h.t.facilityCanSeePlayer(e,r.player,def),false,kind+' still cannot see behind');
 }
});
test('R5.23 riskier foes need additional unarmed hits, but remain survivable',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef();
 const strikeDamage=Combat.hitDamage(h.t.gearStats().weapons[0].attack,'unarmed','normal');
 assert.equal(strikeDamage,12);
 assert.equal(Math.ceil(h.t.enemyDefinition('normal').hp/strikeDamage),6);
 assert.equal(Math.ceil(h.t.enemyDefinition('fast').hp/strikeDamage),4);
 assert.equal(Math.ceil(h.t.enemyDefinition('heavy').hp/strikeDamage),11);
 assert.equal(h.t.enemyDefinition('normal').damage*2,56,'two hits are dangerous but not fatal at 100HP');
 assert.equal(h.t.enemyDefinition('fast').damage*2,46);
 assert.equal(h.t.enemyDefinition('heavy').damage*2,72);
});
test('R5.23 the HUD warns before patrol vision escalates into pursuit',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef();
 const label={textContent:''};h.nodes.set('exp-danger-label',label);
 const e=target(h,'normal',70,'patrol');r.enemies=[e];e.notice=0;
 h.t.updateHUD(true);assert.equal(label.textContent,'警戒1・未発見');
 e.notice=.10;h.t.updateHUD(true);assert.equal(label.textContent,'警戒1・視線注意');
 e.mode='chase';h.t.updateHUD(true);assert.equal(label.textContent,'警戒1・発見中');
});
test('R5.23 V1–V3 retained their previous vision and combat values',()=>{
 const h=harness(false);h.t.startRun();
 assert.equal(h.t.enemyDefinition('normal').detect,155);
 assert.equal(h.t.enemyDefinition('normal').hp,35);
 assert.equal(h.t.enemyDefinition('fast').damage,7);
 assert.equal(h.t.enemyDefinition('heavy').damage,20);
});

test('R5.24 optical ray does not collapse in a legitimate 13px-wide shelf-side lane',()=>{
 const e={x:1721.5,y:640};const view={x:e.x,y:e.y+90};
 assert.equal(V4.solid(e.x,e.y,10),false,'enemy center has room to stand');
 assert.equal(V4.lineClear(e,view),false,'old padded collision ray incorrectly blocks the corridor');
 assert.equal(V4.visionClear(e,view),true,'un-padded optical test sees through the free aisle');
 assert.ok(V4.visionRayDistance(e,{x:0,y:1},160)>=150,'sight wedge must extend down the corridor');
 const h=harness();h.t.startRun();
 const sentry=h.t.restoreEnemy({...e,kind:'normal',hp:68,mode:'patrol',homeX:e.x,homeY:e.y,facingX:0,facingY:1});
 const points=h.t.facilityVisionContour(sentry,h.t.enemyDefinition('normal'),Date.now());
 assert.ok(Math.hypot(points[6].x-e.x,points[6].y-e.y)>=150,'forward view stays visible');
});
test('R5.24 enemy types have substantially distinct field-of-view widths',()=>{
 const h=harness();h.t.startRun();
 const a=['normal','fast','heavy'].map(k=>h.t.enemyDefinition(k).visionHalfArc*360/Math.PI);
 assert.ok(Math.abs(a[0]-120)<.01);
 assert.ok(Math.abs(a[1]-165)<.01);
 assert.ok(Math.abs(a[2]-75)<.01);
 assert.ok(a[1]>a[0]+35 && a[0]>a[2]+35);
 assert.equal(h.t.enemyDefinition('normal').detect,245,'distance unchanged');
 assert.equal(h.t.enemyDefinition('fast').detect,270);
 assert.equal(h.t.enemyDefinition('heavy').detect,205);
});
test('R5.24 radar is painted during chase, windup and recovery as well as patrol',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef(),p=r.player;
 let shapes=0,arcs=0;
 const ctx={beginPath(){shapes++},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},arc(){arcs++}};
 h.t.setRadarCtx(ctx);
 const e=h.t.restoreEnemy({x:p.x+65,y:p.y,kind:'normal',hp:68,mode:'patrol',
  homeX:p.x+65,homeY:p.y,facingX:-1,facingY:0});r.enemies=[e];
 for(const mode of ['patrol','search','alert','chase','windup','recover']){
  e.mode=mode;
  const before=shapes;h.t.drawFacilityVision(p.x-180,p.y-200,360,416);
  assert.ok(shapes>=before+3,'radar cone/ring/heading should render in '+mode);
 }
 assert.ok(arcs>=6);
});
test('R5.24 actual blocked rays stay blocked (no radar seeing through stock)',()=>{
 const prop=V4.fixtures.find(p=>p.kind==='shelf');
 const a={x:prop.x-30,y:prop.y+prop.h/2},b={x:prop.x+prop.w+30,y:prop.y+prop.h/2};
 assert.equal(V4.visionClear(a,b),false);
 assert.ok(V4.visionRayDistance(a,{x:1,y:0},prop.w+60)<prop.w+45);
});

test('R5.25 persistent pursuit recognizes a fleeing player beyond former chase radius',()=>{
 const open={...V4,visionClear:()=>true,lineClear:()=>true};
 const h=harness(true,open);h.t.startRun();const r=h.t.runRef();
 const e=target(h,'normal',425,'chase');e.lastSeen=0;e.attackAt=99;
 r.enemies=[e];const x=e.x;
 assert.equal(h.t.enemyDefinition('normal').detect,245,'no wider unspotted radar');
 assert.equal(h.t.enemyDefinition('normal').lose,520,'tracking distance expands only after spotting');
 assert.ok(h.t.enemyDefinition('normal').leash>650);
 h.t.updateEnemy(e,3,.1);
 assert.equal(e.mode,'chase','previous 320px lose distance would have broken chase');
 assert.equal(e.lastSeen,3,'visual contact refreshes memory');
 assert.ok(e.x<x,'guard closes gap rather than giving up');
});
test('R5.25 once a guard attacks it resumes chasing while the target remains visible',()=>{
 const open={...V4,visionClear:()=>true,lineClear:()=>true};
 const h=harness(true,open);h.t.startRun();const r=h.t.runRef();
 const e=target(h,'normal',-35,'recover');e.phaseUntil=.1;e.attackAt=99;
 r.enemies=[e];h.t.updateEnemy(e,.2,.1);
 assert.equal(e.mode,'chase','recover should not forget a visible player');
 assert.equal(e.lastSeen,.2);
 const blocked={...V4,visionClear:()=>false,lineClear:()=>false};
 const hb=harness(true,blocked);hb.t.startRun();const rb=hb.t.runRef();
 const eb=target(hb,'normal',-35,'recover');eb.phaseUntil=.1;rb.enemies=[eb];
 hb.t.updateEnemy(eb,.2,.1);
 assert.equal(eb.mode,'search','cover still permits escaping pursuit');
});
test('R5.25 a guard investigates the last seen position before standing down',()=>{
 const blocked={...V4,visionClear:()=>false,lineClear:()=>false};
 const h=harness(true,blocked);h.t.startRun();const r=h.t.runRef();
 const e=target(h,'normal',-35,'search');
 e.lastX=e.x;e.lastY=e.y;e.phaseUntil=5;e.facingX=1;e.facingY=0;
 r.enemies=[e];h.t.updateEnemy(e,1,.1);
 assert.equal(e.mode,'search','arriving at last seen spot does not immediately erase memory');
 assert.ok(e.facingY>0,'sentry scans at last known location');
 h.t.updateEnemy(e,5.1,.1);
 assert.equal(e.mode,'patrol','search ultimately expires, preventing infinite pursuit');
});
test('R5.25 first reinforcement and live caps are higher but bounded',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef();
 assert.equal(r.spawnAt,12);
 assert.equal(h.t.liveEnemyCap(0),4);
 assert.equal(h.t.liveEnemyCap(90),5);
 assert.equal(h.t.liveEnemyCap(210),6);
 const far=V4.exitCandidates.reduce((best,p)=>Math.hypot(p.x-V4.start.x,p.y-V4.start.y)>Math.hypot(best.x-V4.start.x,best.y-V4.start.y)?p:best,V4.exitCandidates[0]);
 r.player.x=far.x;r.player.y=far.y;
 assert.equal(h.t.liveEnemyCap(250),11,'even the longest hard raid never exceeds 11 guards');
 const old=harness(false);old.t.startRun();assert.equal(old.t.runRef().spawnAt,15);
});

test('R5.25 stale patrols are recycled but a pursuing guard is never despawned',()=>{
 const blind={...V4,visionClear:()=>false,lineClear:()=>false};
 const h=harness(true,blind);h.t.startRun();const r=h.t.runRef();
 const far=h.t.restoreEnemy({x:r.player.x+1030,y:r.player.y,kind:'normal',
  hp:68,mode:'patrol',homeX:r.player.x+1030,homeY:r.player.y});
 const fleeing=h.t.restoreEnemy({x:r.player.x+1040,y:r.player.y,kind:'fast',
  hp:46,mode:'chase',homeX:r.player.x+1040,homeY:r.player.y});
 const searching=h.t.restoreEnemy({x:r.player.x+1060,y:r.player.y,kind:'normal',
  hp:68,mode:'search',homeX:r.player.x+1060,homeY:r.player.y});
 const nearby=h.t.restoreEnemy({x:r.player.x+120,y:r.player.y,kind:'normal',
  hp:68,mode:'patrol',homeX:r.player.x+120,homeY:r.player.y});
 r.enemies=[far,fleeing,searching,nearby];
 assert.equal(h.t.recycleDistantFacilityGuards(),2);
 assert.deepEqual(r.enemies,[fleeing,nearby],'only remote idle/searching enemies recycle');
 const old=harness(false);old.t.startRun();
 assert.equal(old.t.recycleDistantFacilityGuards(),0,'V3 never recycles legacy guards');
});

test('R5.26 spotted normal and fast guards can catch an unencumbered player in open ground',()=>{
 const open={...V4,solid:()=>false,lineClear:()=>true,visionClear:()=>true};
 for(const [kind,initial,seconds] of [['normal',94,3.6],['fast',130,3.3]]){
  const h=harness(true,open);h.t.startRun();const r=h.t.runRef();
  const playerSpeed=h.t.gearStats().speed;
  const e=target(h,kind,-initial,'chase');e.attackAt=99;e.lastSeen=0;
  r.enemies=[e];
  assert.ok(h.t.enemyDefinition(kind).chaseSpeed>playerSpeed,
   kind+' must run faster than the 118px/s unarmed player');
  const start=Math.hypot(e.x-r.player.x,e.y-r.player.y);
  for(let step=1;step<=seconds*10;step++){
   r.player.x+=playerSpeed*.1;
   h.t.updateEnemy(e,step*.1,.1);
  }
  const gap=Math.hypot(e.x-r.player.x,e.y-r.player.y);
  assert.ok(gap<start*.6,
   kind+' should close a fleeing target instead of losing ground, actual gap '+gap);
  assert.equal(e.mode,'chase');
 }
});
test('R5.26 chasing speed drops if cover breaks vision; patrol speeds stay the same',()=>{
 const visible={...V4,solid:()=>false,lineClear:()=>true,visionClear:()=>true};
 const hidden={...V4,solid:()=>false,lineClear:()=>true,visionClear:()=>false};
 function pursuit(layout){
  const h=harness(true,layout);h.t.startRun();const r=h.t.runRef();
  const e=target(h,'normal',-125,'chase');r.enemies=[e];e.lastSeen=0;e.attackAt=99;
  const start=e.x;h.t.updateEnemy(e,.5,.1);
  return {distance:e.x-start,h};
 }
 const a=pursuit(visible),b=pursuit(hidden);
 assert.ok(a.distance>b.distance*1.4,'the clear-sight sprint should materially exceed covered pursuit');
 assert.ok(b.distance>0,'an alerted guard still heads toward the last known position');
 assert.equal(a.h.t.enemyDefinition('normal').speed,68,'normal patrol pace unchanged');
 const old=harness(false);old.t.startRun();
 assert.equal(old.t.enemyDefinition('normal').speed,46,'legacy pace unchanged');
 assert.equal(old.t.facilityPursuitSpeed(null,old.t.enemyDefinition('normal'),true),46);
});
test('R5.26 stuck guard attempts to slip sideways instead of standing at a wall',()=>{
 let blockX=0,blockY=0;
 const tight={...V4,lineClear:()=>true,visionClear:()=>true,
  solid(x,y){return x>blockX+.1&&x<blockX+70&&Math.abs(y-blockY)<24;}};
 const h=harness(true,tight);h.t.startRun();const r=h.t.runRef(),p=r.player;
 const e=target(h,'normal',-130,'chase');
 blockX=e.x;blockY=e.y;
 r.enemies=[e];e.lastSeen=0;e.attackAt=99;
 const before={x:e.x,y:e.y};
 h.t.updateEnemy(e,.2,.1);
 assert.ok(Math.hypot(e.x-before.x,e.y-before.y)>.5,'pursuer must attempt a lateral detour');
 assert.ok(!tight.solid(e.x,e.y));
});
test('R5.26 tracking leash extends but escaping by losing sight remains possible',()=>{
 const dark={...V4,visionClear:()=>false,lineClear:()=>false};
 const h=harness(true,dark);h.t.startRun();const r=h.t.runRef();
 const e=target(h,'normal',-110,'chase');r.enemies=[e];e.lastSeen=0;
 assert.ok(h.t.enemyDefinition('normal').leash>1000);
 h.t.updateEnemy(e,5,.1);
 assert.equal(e.mode,'search','guards must eventually give up when player hides');
 h.t.updateEnemy(e,9,.1);
 assert.equal(e.mode,'patrol','they must return to patrol after investigating');
});

test('R5.27 all fourteen authored zones have valid preassigned guard posts',()=>{
 const zones=new Set(),all=V4.guardPosts;
 assert.equal(all.length,18);
 assert.equal(new Set(all.map(p=>p.id)).size,all.length);
 for(const post of all){
  zones.add(post.zone);
  assert.equal(V4.roomAt(post),post.zone,'post belongs to target zone '+post.id);
  assert.ok(!V4.solid(post.x,post.y,21),'enemy should fit outside fixtures '+post.id);
  assert.ok(Math.hypot(post.x-V4.start.x,post.y-V4.start.y)>=215,
   'starting shelter remains safe');
  assert.ok(V4.exitCandidates.every(exit=>Math.hypot(post.x-exit.x,post.y-exit.y)>=130));
 }
 assert.equal(zones.size,V4.rooms.length,'all zones covered');
});
test('R5.27 entering any distant wing can awaken a locally stationed guard immediately',()=>{
 for(const post of V4.guardPosts){
  const h=harness();h.t.startRun();const r=h.t.runRef();
  if(!r.pendingGuardPosts.includes(post.id))continue; // the entrance post already activated
  r.enemies=[];
  r.pendingGuardPosts=[post.id];
  // Teleport to the approach side to emulate an early rush through the map;
  // the nearby post is already reserved independently of the timer.
  r.player.x=post.x+250;r.player.y=post.y;
  assert.ok(h.t.activateFacilityGuardPosts()>0,post.id+' should awaken');
  assert.ok(r.enemies.some(e=>Math.hypot(e.x-post.x,e.y-post.y)<1),
   post.id+' must be occupied on arrival');
  assert.equal(r.pendingGuardPosts.length,0);
 }
});
test('R5.27 posted guards do not double-spawn after being killed or reactivated',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef();
 const post=V4.guardPosts.find(p=>r.pendingGuardPosts.includes(p.id));
 r.enemies=[];r.pendingGuardPosts=[post.id];
 r.player.x=post.x+240;r.player.y=post.y;
 assert.equal(h.t.activateFacilityGuardPosts(),1);
 r.enemies=[];
 assert.equal(h.t.activateFacilityGuardPosts(),0,'consumed post does not resurrect');
 const saved=h.t.snapshotRun();
 assert.ok(h.t.validCheckpoint(saved));
 assert.deepEqual(saved.pendingGuardPosts,[]);
 assert.equal(saved.enemies.length,0);
});
test('R5.27 cannot delete visible pursuers to make room for a regional post',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef();
 const post=V4.guardPosts.find(p=>r.pendingGuardPosts.includes(p.id));
 r.player.x=post.x+240;r.player.y=post.y;
 r.pendingGuardPosts=[post.id];
 const cap=h.t.liveEnemyCap(0);
 r.enemies=Array.from({length:cap},(_,i)=>h.t.restoreEnemy({
  x:post.x+700+i*20,y:post.y,kind:'normal',hp:68,
  mode:'chase',homeX:post.x+700+i*20,homeY:post.y
 }));
 assert.equal(h.t.activateFacilityGuardPosts(),0,'chased player should not erase enemies');
 assert.equal(r.enemies.length,cap);
 assert.deepEqual(r.pendingGuardPosts,[post.id]);
});
test('R5.27 regional posts survive a checkpoint and reject invalid or duplicate IDs',()=>{
 const h=harness();h.t.startRun();const r=h.t.runRef();
 assert.ok(r.enemies.length<=h.t.liveEnemyCap(0));
 assert.equal(r.pendingGuardPosts.length+r.enemies.filter(e=>V4.guardPosts.some(p=>p.x===e.x&&p.y===e.y)).length,
  V4.guardPosts.length,'each post remains reserved or active on start');
 const saved=h.t.snapshotRun();
 assert.ok(h.t.validCheckpoint(saved));
 assert.ok(!h.t.validCheckpoint({...saved,pendingGuardPosts:['unknown-zone']}));
 assert.ok(!h.t.validCheckpoint({...saved,pendingGuardPosts:[saved.pendingGuardPosts[0],saved.pendingGuardPosts[0]]}));
 const old=harness(false);old.t.startRun();
 assert.equal(old.t.runRef().pendingGuardPosts.length,0,'legacy maps unchanged');
});
