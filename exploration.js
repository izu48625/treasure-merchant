(function explorationModule(){
'use strict';
// Independent, single-player extraction prototype. No gacha/arcade draw results are changed.
const WORLD={w:920,h:720}, VIEW={w:360,h:416}, DURATION=240;
const TYPES=['normal','historical','modern','premium'];
// Enemy states are clocked by elapsed active-raid time; pause freezes AI and attacks.
const ENEMY_TYPES={
 normal:{name:'通常',hp:35,speed:46,detect:155,lose:245,leash:290,windup:.62,cooldown:1.50,recovery:.34,damage:9,range:26,radius:11},
 fast:{name:'高速',hp:23,speed:86,detect:175,lose:285,leash:350,windup:.38,cooldown:1.45,recovery:.55,damage:7,range:24,radius:10},
 heavy:{name:'重装',hp:94,speed:31,detect:145,lose:210,leash:220,windup:1.00,cooldown:2.35,recovery:.78,damage:20,range:39,radius:17}
};
const ENEMY_CAP=12;
// Semi-open layout: broad sightlines with scattered cover and two short partitions.
const WALLS=[
{x:228,y:92,w:85,h:45},{x:490,y:68,w:65,h:94},{x:735,y:122,w:90,h:42},
{x:135,y:313,w:88,h:45},{x:386,y:265,w:105,h:57},{x:670,y:330,w:75,h:85},
{x:255,y:531,w:80,h:42},{x:495,y:509,w:90,h:48},{x:764,y:557,w:83,h:49},
{x:330,y:174,w:12,h:90},{x:574,y:382,w:13,h:94}
];
const CHEST_SPOTS=[
[178,193,0],[369,191,1],[556,165,2],[838,202,3],
[270,390,1],[544,371,0],[776,405,2],[99,505,0],
[366,599,2],[592,606,3],[820,633,1],[62,653,3]
];
const GEAR_RULES={
weapon:{name:'武器',match:it=>/武器|剣|杖|フライパン|スコップ|村正|エクスカリバー/.test(it.category+' '+it.name)},
tool:{name:'探索道具',match:it=>/リュック|ロープ|方位磁石|ランタン|望遠鏡|道具・探検|道具・旅行/.test(it.category+' '+it.name)},
charm:{name:'護符・防具',match:it=>/ペンダント|聖杯|黄金冠|装甲|鎧|盾|お守り|護符/.test(it.category+' '+it.name)}
};
let run=null,raf=0,canvas=null,ctx=null,lastFrame=0,lastHud=0,lastCheckpointAt=0;
const keys=new Set(),images={};
const stickVisual={thumb:null,x:0,y:0,targetX:0,targetY:0,range:32};
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
function gearStats(equip=state.exploreEquip){
 const weapon=gearItem('weapon',equip),tool=gearItem('tool',equip),charm=gearItem('charm',equip);
 const bonus=g=>g?RARITY.indexOf(g.it.rarity)*3+g.entry.q*2+4:0;
 return {attack:18+bonus(weapon),speed:118+bonus(tool)*.6,maxHp:100+bonus(charm)*3,capacity:6+(tool&&/リュック/.test(tool.it.name)?2:0)};
}
function escapeHTML(s){return esc(String(s))}
function gearSelect(kind){
 const chosen=gearItem(kind),opts=gearCandidates(kind);
 return '<label class="exp-equip"><span>'+GEAR_RULES[kind].name+'</span><select data-exp-gear="'+kind+'" aria-label="'+GEAR_RULES[kind].name+'">'+
 '<option value="0">装備なし</option>'+
 opts.map(row=>{const it=item(row.id);return '<option value="'+row.uid+'"'+(chosen&&chosen.entry.uid===row.uid?' selected':'')+'>'+escapeHTML(it.name)+' / '+escapeHTML(it.rarity)+' / '+QNAME[row.q]+'</option>'}).join('')+
 '</select></label>';
}
function chestAsset(type,opened){
 const t=TYPES[type]||'normal';
 return 'assets/gacha/frames/chest_'+t+'_'+(opened?'open':'closed')+'.webp';
}
function preload(){
 for(let t=0;t<4;t++)for(let phase=0;phase<=1;phase++){
  const src=chestAsset(t,phase);
  if(images[src])continue;
  const img=new Image();img.src=src;images[src]=img;
 }
}
function chooseLoot(type){
 const weights=[4300,2800,1700,900,245,50,5];
 let k=Math.random()*weights.reduce((a,b)=>a+b,0),tier=0;
 for(let i=0;i<weights.length;i++){k-=weights[i];if(k<0){tier=i;break}}
 const rarity=RARITY[clamp(tier+(type===3?1:0),0,RARITY.length-1)];
 const subsets={
 1:it=>it.group==='歴史・武具'||it.group==='骨董・道具',
 2:it=>it.group==='現代・生活'
 };
 let pool=ITEMS.filter(it=>it.rarity===rarity&&(subsets[type]?subsets[type](it):true));
 if(!pool.length)pool=ITEMS.filter(it=>it.rarity===rarity);
 if(!pool.length)pool=ITEMS;
 const it=pool[Math.floor(Math.random()*pool.length)];
 return {id:it.id,q:quality(it.rarity)};
}
// R5.4: a small checkpoint is stored in the same IndexedDB metadata as the merchant save.
// The final claim and the claim marker are committed atomically in bank().
const CHECKPOINT_INTERVAL_MS=3000;
function rewardValid(v){
 return !!(v&&ITEM_BY_ID.has(v.id)&&Number.isInteger(v.q)&&v.q>=0&&v.q<QNAME.length);
}
function pointValid(v){
 return !!(v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&v.x>=0&&v.y>=0&&v.x<=WORLD.w&&v.y<=WORLD.h);
}
function directionValid(v){return !!(v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Math.hypot(v.x,v.y)>.01&&Math.hypot(v.x,v.y)<1.1)}
function validCheckpoint(c){
 if(!c||c.v!==1||c.status!=='playing'||typeof c.id!=='string'||c.id.length>96||!c.id)return false;
 if(!Number.isFinite(c.remaining)||c.remaining<0||c.remaining>DURATION)return false;
 if(!pointValid(c.player)||!Number.isFinite(c.player.hp)||c.player.hp<=0||!c.stats||c.stats.maxHp<1||c.stats.maxHp>5000)return false;
 if(!['attack','speed','capacity'].every(k=>Number.isFinite(c.stats[k])&&c.stats[k]>=0)||c.stats.capacity>50)return false;
 if(!Array.isArray(c.chests)||c.chests.length!==CHEST_SPOTS.length||!c.chests.every((v,i)=>v&&v.i===i&&v.x===CHEST_SPOTS[i][0]&&v.y===CHEST_SPOTS[i][1]&&v.type===CHEST_SPOTS[i][2]&&typeof v.opened==='boolean'&&rewardValid(v.reward)))return false;
 if(!Array.isArray(c.enemies)||c.enemies.length>20||!c.enemies.every(v=>pointValid(v)&&Number.isFinite(v.hp)&&v.hp>0&&v.hp<=1000&&(!v.kind||Object.prototype.hasOwnProperty.call(ENEMY_TYPES,v.kind))))return false;
 if(!Array.isArray(c.loot)||c.loot.length>c.stats.capacity||!c.loot.every(rewardValid))return false;
 if(!Number.isInteger(c.tickets)||c.tickets<0||c.tickets>1000)return false;
 if(!Number.isFinite(c.spawnAt)||!Number.isFinite(c.attackAt)||!Number.isInteger(c.weaponSlot)||![0,1].includes(c.weaponSlot))return false;
 return true;
}
function snapshotRun(){
 if(!run||run.status!=='playing')return null;
 return {
  v:1,status:'playing',id:run.id,savedAt:Date.now(),remaining:remaining(),
  player:{...run.player},stats:{...run.stats},
  chests:run.chests.map(c=>({...c,reward:{...c.reward}})),
  enemies:run.enemies.map(e=>({...e})),loot:run.loot.map(v=>({...v})),
  tickets:run.tickets,kills:run.kills,spawnAt:run.spawnAt,attackAt:run.attackAt,
  autoAttack:run.autoAttack,weaponSlot:run.weaponSlot,facing:{...run.facing}
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
 run={
  id:c.id,status:'playing',paused:true,pausedAt:now,start:now-(DURATION-c.remaining)*1000,duration:DURATION,
  player:{...c.player,invuln:0},stats:{...c.stats},
  enemies:c.enemies.map(restoreEnemy),chests:c.chests.map(v=>({...v,reward:{...v.reward}})),
  loot:c.loot.map(v=>({...v})),tickets:c.tickets,kills:c.kills||0,
  spawnAt:c.spawnAt,attackAt:c.attackAt,autoAttack:c.autoAttack!==false,
  manualAttack:false,dodgeCooldown:0,dodgeTime:0,facing:directionValid(c.facing)?{...c.facing}:{x:1,y:0},
  weaponSlot:c.weaponSlot,slash:null,joy:{x:0,y:0},steer:{x:0,y:0},
  message:'探索を復元しました。▶で再開してください',messageUntil:now+9000
 };
 lastCheckpointAt=now;preload();
}
function endCheckpoint(){
 if(!storageReady)return;
 state.exploreRun=null;save();
}
function startRun(){
 if(!storageReady||actionPersisting)return;
 stopLoop();preload();const stats=gearStats();
 run={
  id:(window.crypto&&typeof window.crypto.randomUUID==='function'?window.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),
  status:'playing',paused:false,pausedAt:0,start:Date.now(),duration:DURATION,player:{x:88,y:100,hp:stats.maxHp,invuln:0},
  stats,enemies:[],chests:CHEST_SPOTS.map(([x,y,type],i)=>({x,y,type,i,opened:false,reward:chooseLoot(type)})),
  loot:[],tickets:0,kills:0,spawnAt:15,attackAt:0,autoAttack:true,manualAttack:false,dodgeCooldown:0,dodgeTime:0,facing:{x:1,y:0},weaponSlot:0,slash:null,joy:{x:0,y:0},steer:{x:0,y:0},message:'宝箱を探して出口へ戻れ',messageUntil:Date.now()+2500
 };
 spawnEnemy('normal');spawnEnemy('normal');saveRunCheckpoint(true);render();
}
function notify(s){
 if(!run)return;
 run.message=s;run.messageUntil=Date.now()+2300;
 const e=document.getElementById('exp-note');if(e)e.textContent=s;
}
function stopLoop(){
 if(raf)cancelAnimationFrame(raf);
 raf=0;canvas=null;ctx=null;lastFrame=0;keys.clear();
 stickVisual.thumb=null;stickVisual.x=0;stickVisual.y=0;stickVisual.targetX=0;stickVisual.targetY=0;
 if(run){run.joy={x:0,y:0};run.steer={x:0,y:0}}
}
function leaveRun(){
 document.body.classList.remove('exp-immersive');
 stopLoop();
 // Explicitly leaving the raid forfeits unsaved loot. Reloads instead restore checkpoints.
 if(run&&run.status==='playing')endCheckpoint();
 run=null;
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
 // Legacy R5.4 checkpoints contain plain x/y/hp enemies; upgrade them on load.
 const kind=ENEMY_TYPES[e.kind]?e.kind:'normal',def=ENEMY_TYPES[kind];
 const safe=(v,fallback)=>Number.isFinite(v)?v:fallback;
 return {
  x:e.x,y:e.y,kind,mode:['patrol','alert','chase','windup','recover','search'].includes(e.mode)?e.mode:'patrol',
  hp:e.hp,maxHp:def.hp,
  homeX:clamp(safe(e.homeX,e.x),18,WORLD.w-18),homeY:clamp(safe(e.homeY,e.y),18,WORLD.h-18),
  targetX:clamp(safe(e.targetX,e.x),18,WORLD.w-18),targetY:clamp(safe(e.targetY,e.y),18,WORLD.h-18),
  lastX:clamp(safe(e.lastX,e.x),18,WORLD.w-18),lastY:clamp(safe(e.lastY,e.y),18,WORLD.h-18),
  lastSeen:safe(e.lastSeen,-999),phaseUntil:safe(e.phaseUntil,0),attackAt:safe(e.attackAt,0),
  patrolUntil:safe(e.patrolUntil,0),facingX:safe(e.facingX,1),facingY:safe(e.facingY,0),
  aimX:safe(e.aimX,1),aimY:safe(e.aimY,0),hitUntil:safe(e.hitUntil,0)
 };
}
function enemyKindForTime(elapsed){
 const r=Math.random();
 if(elapsed<35)return 'normal';
 if(elapsed<95)return r<.73?'normal':'fast';
 if(elapsed<170)return r<.57?'normal':r<.88?'fast':'heavy';
 return r<.45?'normal':r<.78?'fast':'heavy';
}
function spawnEnemy(forcedKind){
 if(!run||run.enemies.length>=ENEMY_CAP)return false;
 const elapsed=run.duration-remaining();
 let kind=forcedKind||enemyKindForTime(elapsed);
 if(kind==='heavy'&&run.enemies.filter(e=>e.kind==='heavy').length>=2)kind='normal';
 if(kind==='fast'&&run.enemies.filter(e=>e.kind==='fast').length>=4)kind='normal';
 const def=ENEMY_TYPES[kind];
 for(let k=0;k<22;k++){
  const angle=Math.random()*Math.PI*2,radius=210+Math.random()*130;
  const x=clamp(run.player.x+Math.cos(angle)*radius,26,WORLD.w-26);
  const y=clamp(run.player.y+Math.sin(angle)*radius,26,WORLD.h-26);
  if(solid(x,y,def.radius+3)||distance({x,y},run.player)<195||distance({x,y},{x:88,y:100})<128)continue;
  if(run.enemies.some(e=>distance(e,{x,y})<103))continue;
  run.enemies.push(restoreEnemy({x,y,kind,hp:def.hp,mode:'patrol',homeX:x,homeY:y,attackAt:elapsed+1}));
  return true;
 }
 return false;
}
// Sample along the segment: partitions obstruct detection instead of wall-hacking.
function canSeeBetween(a,b){
 const d=distance(a,b),steps=Math.ceil(d/17);
 if(!steps)return true;
 for(let i=1;i<steps;i++){
  const x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps;
  if(WALLS.some(w=>x>=w.x-3&&x<=w.x+w.w+3&&y>=w.y-3&&y<=w.y+w.h+3))return false;
 }
 return true;
}
function enemyMoveTowards(e,x,y,speed,dt,radius){
 const d=Math.hypot(x-e.x,y-e.y);if(d<1)return false;
 const dx=(x-e.x)/d,dy=(y-e.y)/d;
 const bx=e.x,by=e.y;
 e.facingX=dx;e.facingY=dy;move(e,dx*speed,dy*speed,dt,radius);
 return Math.hypot(e.x-bx,e.y-by)>.1;
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
 if(d>def.range+12||d<.001||p.invuln>0)return false;
 if((dx*e.aimX+dy*e.aimY)/d<.55)return false;
 p.hp=Math.max(0,p.hp-def.damage);p.invuln=.85;
 if(p.hp<=0){lose('敵の攻撃を受け、戦利品を失いました');return true}
 notify(def.name+'型から '+def.damage+' ダメージ');
 return true;
}
function updateEnemy(e,elapsed,dt){
 const def=ENEMY_TYPES[e.kind]||ENEMY_TYPES.normal,p=run.player,d=distance(e,p);
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
  if(d<=def.range+12&&elapsed>=e.attackAt&&canSeeBetween(e,p)){
   e.mode='windup';e.phaseUntil=elapsed+def.windup;
   e.aimX=(p.x-e.x)/Math.max(d,1);e.aimY=(p.y-e.y)/Math.max(d,1);
   return;
  }
  if(d>def.range*.83){
   // Last seen position is pursued while line of sight is blocked.
   const target=sight?p:{x:e.lastX,y:e.lastY};
   enemyMoveTowards(e,target.x,target.y,def.speed,dt,def.radius);
  }
 }
}
function remaining(){return run?Math.max(0,run.duration-((run.paused?run.pausedAt:Date.now())-run.start)/1000):0}
function lose(reason){
 if(!run||run.status!=='playing')return;
 document.body.classList.remove('exp-immersive');
 run.status='lost';run.reason=reason;run.loot=[];run.tickets=0;
 endCheckpoint();stopLoop();render();
}
function interact(){
 if(!run||run.status!=='playing')return;
 if(run.loot.length>=run.stats.capacity){notify('バッグが満杯。戦利品を捨ててください');return}
 let near=run.chests.filter(c=>!c.opened&&distance(c,run.player)<58).sort((a,b)=>distance(a,run.player)-distance(b,run.player))[0];
 if(!near){notify('宝箱に近づいてください');return}
 near.opened=true;
 const reward=near.reward; // Selected when the raid began, not during animation.
 run.loot.push(reward);
 if(Math.random()<.10)run.tickets++;
 notify('獲得：'+item(reward.id).name);
 saveRunCheckpoint(true);draw();updateHUD(true);
}
function bank(){
 if(!run||run.status!=='playing'||actionPersisting||!storageReady)return;
 if(distance(run.player,{x:88,y:100})>58){notify('緑色の出口まで戻ってください');return}
 run.status='saving';document.body.classList.remove('exp-immersive');stopLoop();
 const rewards=run.loot.slice(),tickets=run.tickets,claimId=run.id;
 // A claimed checkpoint and the rewards use the SAME merchant save transaction.
 // A crash after this commit cannot replay the exploration rewards.
 state.exploreRun={v:1,status:'claimed',id:claimId,claimedAt:Date.now()};
 for(const reward of rewards){
  const it=item(reward.id);
  if(it)receive(it,reward.q,false,'explore');
 }
 state.bonusTickets=Math.min(1000000,(state.bonusTickets||0)+tickets);
 saveWithCommit(()=>{
  if(!run||run.id!==claimId)return;
  state.exploreRun=null;save();
  run.status='escaped';run.banked=rewards;run.bankedTickets=tickets;render();
 });
}
function performAttack(manual,elapsed){
 if(!run||run.status!=='playing'||run.paused||elapsed<run.attackAt)return false;
 const p=run.player,reach=run.weaponSlot===0?144:112;
 let target=null,best=Infinity;
 const facing=run.facing||{x:1,y:0};
 for(const enemy of run.enemies){
  const d=distance(enemy,p);
  if(d>reach||d<.001)continue;
  const alignment=((enemy.x-p.x)*facing.x+(enemy.y-p.y)*facing.y)/d;
  // Manual attacks favour where the player is aiming; automatic attacks pick the nearest foe.
  if(manual&&alignment<.10)continue;
  const score=manual?d-alignment*28:d;
  if(score<best){best=score;target=enemy}
 }
 if(!target&&!manual)return false;
 run.manualAttack=false;
 run.attackAt=elapsed+(run.weaponSlot===0?.55:.82);
 if(target){
  target.hp-=run.stats.attack*(run.weaponSlot===0?1:1.3);
  target.hitUntil=elapsed+.20;
  if(target.mode==='patrol'||target.mode==='search'){
   const dist=distance(target,p);
   target.mode='alert';target.phaseUntil=elapsed+.15;
   target.lastSeen=elapsed;target.lastX=p.x;target.lastY=p.y;
   target.facingX=(p.x-target.x)/Math.max(1,dist);target.facingY=(p.y-target.y)/Math.max(1,dist);
  }
  run.slash={x:target.x,y:target.y,until:Date.now()+180};
  if(target.hp<=0){run.enemies.splice(run.enemies.indexOf(target),1);run.kills++}
 }else{
  // Even a missed button press plays the swing immediately instead of feeling unresponsive.
  run.slash={x:p.x+facing.x*33,y:p.y+facing.y*33,until:Date.now()+180};
 }
 return true;
}
function requestManualAttack(){
 if(!run||run.status!=='playing'||run.paused)return;
 const elapsed=run.duration-remaining();
 if(!performAttack(true,elapsed)){
  // Queue a single press while the current strike is cooling down.
  run.manualAttack=true;
 }
}
function tick(dt){
 if(!run||run.status!=='playing'||run.paused)return;
 const elapsed=(Date.now()-run.start)/1000;
 if(elapsed>=run.duration){lose('時間切れで戦利品を失いました');return}
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
  move(p,steer.x*run.stats.speed,steer.y*run.stats.speed,dt,12);
 }
 run.dodgeCooldown=Math.max(0,run.dodgeCooldown-dt);run.dodgeTime=Math.max(0,run.dodgeTime-dt);
 if(elapsed>=run.spawnAt){
  const wave=Math.floor(elapsed/75);
  for(let i=0;i<Math.min(1+wave,2);i++)spawnEnemy();
  run.spawnAt=elapsed+Math.max(10,19-elapsed/33);
 }
 p.invuln=Math.max(0,p.invuln-dt);
 for(const enemy of run.enemies){
  updateEnemy(enemy,elapsed,dt);
  if(run.status!=='playing')return;
 }
 if(run.manualAttack&&elapsed>=run.attackAt)performAttack(true,elapsed);
 else if(run.autoAttack&&elapsed>=run.attackAt)performAttack(false,elapsed);
}
function draw(){
 if(!ctx||!run||run.status!=='playing')return;
 const p=run.player,w=VIEW.w,h=VIEW.h;
 const ox=clamp(p.x-w/2,0,WORLD.w-w),oy=clamp(p.y-h/2,0,WORLD.h-h);
 ctx.clearRect(0,0,w,h);
 ctx.fillStyle='#202d2c';ctx.fillRect(0,0,w,h);
 ctx.lineWidth=1;ctx.strokeStyle='#344640';
 for(let x=-ox%40;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
 for(let y=-oy%40;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
 for(const b of WALLS){
  ctx.fillStyle='#111c21';ctx.fillRect(b.x-ox+5,b.y-oy+7,b.w,b.h);
  ctx.fillStyle='#52605f';ctx.fillRect(b.x-ox,b.y-oy,b.w,b.h);
  ctx.fillStyle='#74837b';ctx.fillRect(b.x-ox+5,b.y-oy+5,b.w-10,7);
 }
 const exit={x:88,y:100};
 ctx.fillStyle='rgba(82,226,150,.13)';ctx.fillRect(exit.x-ox-38,exit.y-oy-35,76,70);
 ctx.strokeStyle='#55d39b';ctx.lineWidth=3;ctx.strokeRect(exit.x-ox-38,exit.y-oy-35,76,70);
 ctx.fillStyle='#a1f3c8';ctx.font='bold 10px system-ui';ctx.textAlign='center';
 ctx.fillText('EXIT',exit.x-ox,exit.y-oy-23);
 for(const c of run.chests){
  const x=c.x-ox,y=c.y-oy,src=chestAsset(c.type,c.opened),img=images[src];
  if(x<-50||x>w+50||y<-50||y>h+50)continue;
  if(!c.opened&&distance(c,p)<56){ctx.strokeStyle='rgba(244,210,125,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,29,0,Math.PI*2);ctx.stroke()}
  if(img&&img.complete&&img.naturalWidth){ctx.drawImage(img,x-29,y-24,58,45)}
  else {ctx.fillStyle=c.opened?'#5a5343':'#b59257';ctx.fillRect(x-15,y-10,30,20)}
 }
 for(const e of run.enemies){
  const x=e.x-ox,y=e.y-oy;
  ctx.fillStyle='#1b2023';ctx.beginPath();ctx.arc(x+2,y+4,15,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#b96b67';ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#d89a8c';ctx.beginPath();ctx.moveTo(x-10,y-7);ctx.lineTo(x-11,y-16);ctx.lineTo(x-3,y-11);ctx.fill();
  ctx.beginPath();ctx.moveTo(x+10,y-7);ctx.lineTo(x+11,y-16);ctx.lineTo(x+3,y-11);ctx.fill();
  ctx.fillStyle='#281d22';ctx.fillRect(x-6,y-3,3,3);ctx.fillRect(x+3,y-3,3,3);
 }
 ctx.fillStyle=p.invuln>0?'#b8dafa':'#58a8df';
 ctx.beginPath();ctx.arc(p.x-ox,p.y-oy,13,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#ddf4ff';ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle='#e3f5ff';ctx.beginPath();ctx.moveTo(p.x-ox,p.y-oy-9);ctx.lineTo(p.x-ox-6,p.y-oy+6);ctx.lineTo(p.x-ox+6,p.y-oy+6);ctx.fill();
 if(run.slash&&Date.now()<run.slash.until){
  ctx.strokeStyle='#f6d28a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(run.slash.x-ox,run.slash.y-oy,19,0,Math.PI*2);ctx.stroke();
 }
}
function updateHUD(force=false){
 if(!run||run.status!=='playing')return;
 if(!force&&Date.now()-lastHud<110)return;
 lastHud=Date.now();
 const txt=(id,value)=>{const e=document.getElementById(id);if(e)e.textContent=value};
 const m=remaining(),min=Math.floor(m/60),sec=Math.floor(m%60);
 txt('exp-clock',String(min).padStart(2,'0')+':'+String(sec).padStart(2,'0'));
 txt('exp-health',run.player.hp+'/'+run.stats.maxHp);
 txt('exp-bag',run.loot.length+'/'+run.stats.capacity);
 txt('exp-enemies',run.enemies.length+'体');
 const hp=document.getElementById('exp-hp-fill');if(hp)hp.style.width=(run.player.hp/run.stats.maxHp*100)+'%';
 const near=run.chests.some(c=>!c.opened&&distance(c,run.player)<58);
 const atExit=distance(run.player,{x:88,y:100})<=58;
 const btn=document.getElementById('exp-interact');
 if(btn){
  const canExit=atExit;
  btn.dataset.context=canExit?'exit':near?'chest':'none';
  btn.disabled=!(canExit||(near&&run.loot.length<run.stats.capacity));
  btn.textContent=canExit?'脱出する':near?'開ける':'調べる';
  btn.setAttribute('aria-label',canExit?'探索を終了して帰還する':near?'近くの宝箱を開ける':'近くに調べられるものはありません');
 }
 const list=document.getElementById('exp-loot');
 if(list){
  const signature=run.loot.map(v=>v.id+':'+v.q).join(',');
  if(list.dataset.signature!==signature){
   list.dataset.signature=signature;
   list.innerHTML=run.loot.map((v,i)=>{
    const it=item(v.id);
    return '<div class="exp-loot-item"><img src="'+it.image+'" alt=""><span><b>'+escapeHTML(it.name)+'</b><small>'+it.rarity+' ・ '+QNAME[v.q]+'</small></span><button type="button" data-explore="drop" data-i="'+i+'" aria-label="'+escapeHTML(it.name)+'を捨てる">×</button></div>';
   }).join('')||'<p>まだ戦利品はありません</p>';
  }
 }
 txt('exp-note',Date.now()<run.messageUntil?run.message:'');
 const ab=document.getElementById('exp-auto');if(ab){ab.textContent=run.autoAttack?'AUTO ON':'AUTO OFF';ab.setAttribute('aria-pressed',String(run.autoAttack))}
 const wb=document.getElementById('exp-swap');if(wb)wb.textContent=run.weaponSlot===0?'武器 1 ⇄':'武器 2 ⇄';
}
function frame(ts){
 if(!run||run.status!=='playing'||!canvas||!canvas.isConnected){stopLoop();return}
 const dt=clamp((ts-(lastFrame||ts))/1000,0,.045);lastFrame=ts;
 if(!run.paused)tick(dt);if(!run||run.status!=='playing')return;
 if(!run.paused)saveRunCheckpoint();
 updateStickFeedback(dt);
 draw();updateHUD();raf=requestAnimationFrame(frame);
}
function updateStickFeedback(dt){
 const ui=stickVisual;
 if(!ui.thumb||!ui.thumb.isConnected)return;
 // Visual thumb follows input within ~30ms; returning to center is equally smooth.
 const k=1-Math.exp(-Math.min(dt,.05)*33);
 ui.x+=(ui.targetX-ui.x)*k;ui.y+=(ui.targetY-ui.y)*k;
 if(Math.abs(ui.x-ui.targetX)<.002)ui.x=ui.targetX;
 if(Math.abs(ui.y-ui.targetY)<.002)ui.y=ui.targetY;
 ui.thumb.style.transform='translate3d('+(ui.x*ui.range).toFixed(1)+'px,'+(ui.y*ui.range).toFixed(1)+'px,0)';
}
function bindStick(){
 const el=document.getElementById('exp-stick'),thumb=document.getElementById('exp-stick-thumb');
 if(!el||!run)return;
 let pointer=null,box=null,radius=33;
 stickVisual.thumb=thumb;
 stickVisual.x=0;stickVisual.y=0;stickVisual.targetX=0;stickVisual.targetY=0;
 thumb.style.transform='translate3d(0,0,0)';
 const update=e=>{
  if(!run||run.paused||!box)return;
  const dx=e.clientX-(box.left+box.width/2),dy=e.clientY-(box.top+box.height/2);
  const dist=Math.hypot(dx,dy);
  const unitX=dist>0?dx/dist:0,unitY=dist>0?dy/dist:0;
  const tilt=Math.min(1,dist/radius);
  // Dead zone prevents unwanted drifting; progressive range permits careful movement.
  const strength=tilt<.10?0:Math.pow((tilt-.10)/.90,.85);
  run.joy.x=unitX*strength;run.joy.y=unitY*strength;
  stickVisual.targetX=unitX*tilt;stickVisual.targetY=unitY*tilt;
 };
 el.addEventListener('pointerdown',e=>{
  if(pointer!==null||!run||run.paused)return;
  pointer=e.pointerId;
  box=el.getBoundingClientRect(); // Cached for the entire drag: no layout read on every move.
  radius=Math.max(24,(box.width-thumb.offsetWidth)/2);
  stickVisual.range=radius;
  el.setPointerCapture(pointer);
  update(e);e.preventDefault();
 });
 el.addEventListener('pointermove',e=>{if(pointer===e.pointerId){update(e);e.preventDefault()}});
 const release=e=>{
  if(pointer!==e.pointerId)return;
  pointer=null;box=null;
  if(run)run.joy={x:0,y:0};
  stickVisual.targetX=0;stickVisual.targetY=0;
 };
 el.addEventListener('pointerup',release);
 el.addEventListener('pointercancel',release);
 el.addEventListener('lostpointercapture',release);
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
 return '<div class="exp-pause-overlay" role="dialog" aria-modal="true" aria-label="探索を一時停止"><div class="exp-pause-card">'+
 '<h2>⏸ 一時停止</h2><p>敵・攻撃・制限時間を停止中</p>'+
 '<h3>持ち帰るアイテム（'+run.loot.length+'/'+run.stats.capacity+'）</h3><div class="exp-pause-loot">'+(run.loot.length?run.loot.map((v,i)=>{const it=item(v.id);return '<div class="exp-loot-item"><img src="'+it.image+'" alt=""><span><b>'+escapeHTML(it.name)+'</b><small>'+escapeHTML(it.rarity)+' / '+QNAME[v.q]+'</small></span><button type="button" data-explore="drop" data-i="'+i+'">捨てる</button></div>'}).join(''):'<p>まだ戦利品はありません</p>')+'</div>'+
 '<h3>装備変更（試作版・3枠）</h3><div class="exp-pause-gears">'+gearSelect('weapon')+gearSelect('tool')+gearSelect('charm')+'</div>'+
 '<p class="exp-pause-note">装備変更は再開時から反映。現在の試作では武器・道具・お守りの3枠に対応しています。</p>'+
 '<button type="button" class="exp-resume" data-explore="pause">▶ 探索を再開</button></div></div>';
}
function togglePause(){
 if(!run||run.status!=='playing')return;
 if(run.paused){run.start+=Date.now()-run.pausedAt;run.paused=false;run.pausedAt=0;run.joy={x:0,y:0};keys.clear();}
 else{run.paused=true;run.pausedAt=Date.now();run.joy={x:0,y:0};run.steer={x:0,y:0};stickVisual.targetX=0;stickVisual.targetY=0;keys.clear();}
 const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel();
 saveRunCheckpoint(true);
 const btn=document.getElementById('exp-pause-toggle');if(btn){btn.textContent=run.paused?'▶':'⏸';btn.setAttribute('aria-label',run.paused?'探索を再開':'探索を一時停止')}
 updateHUD(true);
}
function contents(){
 if(!run)restoreRunIfNeeded();
 if(!run||run.status==='lost'||run.status==='escaped'){
  const ended=run&&run.status!=='playing',won=ended&&run.status==='escaped';
  const earned=won?(run.banked||[]):[];
  return '<section class="exp-shell"><div class="exp-hero"><div class="exp-eyebrow">EXTRACTION / PROTOTYPE</div><h1>財宝探索</h1>'+
   '<p>宝箱を探し、敵を避けて、制限時間内に生還せよ。</p></div>'+
   (ended?'<div class="exp-report"><strong class="'+(won?'success':'failure')+'">'+(won?'帰還成功':'探索失敗')+'</strong><p>'+(won?(earned.length?'獲得した財宝を所持品へ保存しました。':run.bankedTickets?'ガチャ券を持ち帰りました。':'手ぶらで無事に帰還しました。'):escapeHTML(run.reason||'戦利品は失われました'))+'</p>'+
     (won?'<div class="exp-report-items">'+earned.map(v=>{const it=item(v.id);return '<img src="'+it.image+'" title="'+escapeHTML(it.name)+'" alt="'+escapeHTML(it.name)+'">'}).join('')+'</div><p>財宝 '+earned.length+'点 ／ ガチャ券 '+(run.bankedTickets||0)+'枚</p>':'')+'</div>':'')+
   '<div class="exp-intro"><h2>探索ルール</h2><p>4分以内に緑色の出口へ。時間切れ・体力0・途中離脱では、その探索で集めた物だけを失います。装備品は失いません。</p>'+
    '<div class="exp-checks"><span>移動：左スティック</span><span>攻撃：自動／手動</span><span>武器切替：右ボタン</span><span>宝箱：近づいて開封</span></div></div>'+
   '<div class="exp-loadout"><h2>装備を選ぶ</h2>'+gearSelect('weapon')+gearSelect('tool')+gearSelect('charm')+'</div>'+
   '<button class="exp-start" data-explore="start">探索を開始する <span>→</span></button>'+
   '<p class="exp-caption">探索中は数秒おきに途中保存します。再読み込み後は探索タブから一時停止状態で再開可能。拠点への途中離脱では戦利品を失います。</p></section>';
 }
 if(run.status==='saving')return '<section class="exp-shell"><h1>帰還処理中</h1><p>戦利品をセーブしています。保存完了後に結果を表示します。</p></section>';
 return '<section class="exp-shell exp-playing"><button type="button" id="exp-pause-toggle" class="exp-pause-toggle" data-explore="pause" aria-label="'+(run.paused?'探索を再開':'探索を一時停止')+'">'+(run.paused?'▶':'⏸')+'</button><div class="exp-hud"><button type="button" class="exp-leave" data-explore="leave">← 拠点</button><div><small>残り時間</small><strong id="exp-clock">04:00</strong></div><div><small>体力</small><strong id="exp-health">'+run.player.hp+'/'+run.stats.maxHp+'</strong><span class="exp-health-track"><i id="exp-hp-fill" style="width:100%"></i></span></div><div><small>敵</small><strong id="exp-enemies">2体</strong></div></div>'+
 '<div class="exp-map-frame"><canvas id="exp-field" width="'+VIEW.w+'" height="'+VIEW.h+'" role="img" aria-label="見下ろし型の探索マップ。左のスティックかWASDキーで移動します"></canvas><span class="exp-map-brand">探索UI R5.4a · 安定化</span></div>'+
 '<div class="exp-controls"><div id="exp-stick" class="exp-stick" aria-label="移動スティック"><div class="exp-stick-ring"></div><div id="exp-stick-thumb" class="exp-stick-thumb"></div></div>'+
 '<div class="exp-control-actions"><div class="exp-action-grid"><button type="button" id="exp-attack" data-explore="attack">攻撃</button><button type="button" id="exp-swap" data-explore="swap">武器 1 ⇄</button><button type="button" id="exp-interact" data-explore="context" disabled>調べる</button></div><div class="exp-action-bottom"><button type="button" data-explore="bag">バッグ</button><button type="button" id="exp-auto" data-explore="auto" aria-pressed="true">AUTO ON</button></div></div></div>'+
 '<div id="exp-pause-layer" class="exp-pause-layer">'+pausePanel()+'</div><div class="exp-backpack" id="exp-backpack"><div class="exp-bag-title"><strong>戦利品バッグ</strong><span id="exp-bag">0/'+run.stats.capacity+'</span></div><div id="exp-loot" class="exp-loot-grid"><p>まだ戦利品はありません</p></div><p class="exp-notification" id="exp-note"></p></div>'+
 '<p class="exp-caption">緑色の出口から手ぶらでも脱出可能。再読み込み後は一時停止状態で復帰し、途中で拠点へ戻ると戦利品を放棄します。</p></section>';
}
window.explorationScreen=contents;
window.explorationAfterRender=()=>{
 document.body.classList.toggle('exp-immersive',Boolean(active==='explore'&&run&&run.status==='playing'));
 if(active!=='explore'){if(run&&run.status==='playing')leaveRun();else stopLoop();return}
 Promise.resolve().then(()=>{if(active==='explore')mount()});
};
window.explorationLeave=leaveRun;
window.explorationAction=button=>{
 if(!storageReady||actionPersisting)return;
 const type=button.dataset.explore;
 if(type==='start'){startRun();return}
 if(type==='leave'){leaveRun();active='home';render();return}
 if(type==='pause'){togglePause();return}
 if(run&&run.paused&&type!=='drop')return;
 if(type==='bag'){const bag=document.getElementById('exp-backpack');if(bag)bag.classList.toggle('exp-bag-open');return}
 if(run&&run.status==='playing'){
  if(type==='auto'){run.autoAttack=!run.autoAttack;saveRunCheckpoint(true);updateHUD(true);return}
  if(type==='attack'){requestManualAttack();return}
  if(type==='swap'){run.weaponSlot=1-run.weaponSlot;notify('武器スロット '+(run.weaponSlot+1)+'（操作試作）');saveRunCheckpoint(true);updateHUD(true);return}
 }
 if(type==='context'){if(button.dataset.context==='exit')bank();else if(button.dataset.context==='chest')interact();return}
 if(type==='interact'){interact();return}
 if(type==='exit'){bank();return}
 if(type==='drop'&&run&&run.status==='playing'){
  const i=Number(button.dataset.i);
  if(Number.isInteger(i)&&i>=0&&i<run.loot.length){run.loot.splice(i,1);notify('戦利品をバッグから捨てた');saveRunCheckpoint(true);if(run.paused){const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel()}updateHUD(true)}
 }
};
document.body.addEventListener('change',e=>{
 const t=e.target;if(!t.matches('[data-exp-gear]')||!storageReady||actionPersisting||(run&&run.status==='playing'&&!run.paused))return;
 const kind=t.dataset.expGear;if(!GEAR_RULES[kind])return;
 const uid=Number(t.value),entry=state.inv.find(v=>v.uid===uid),it=entry&&item(entry.id);
 if(uid&&(!entry||!it||!GEAR_RULES[kind].match(it)))return;
 if(run&&run.paused){
  const previous=run.stats;
  const proposed={...(state.exploreEquip||{}),[kind]:uid||0};
  const next=gearStats(proposed);
  if(run.loot.length>next.capacity){t.value=String(state.exploreEquip?.[kind]||0);notify('バッグ容量を下回る装備には変更できません');return}
  state.exploreEquip=proposed;
  run.stats=next;run.player.hp=Math.min(next.maxHp,Math.max(1,Math.round(run.player.hp/previous.maxHp*next.maxHp)));
  stageRunCheckpoint();
  saveWithCommit(()=>{const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel();updateHUD(true)});
  return;
 }
 state.exploreEquip={...(state.exploreEquip||{}),[kind]:uid||0};
 saveWithCommit(()=>render());
});
document.addEventListener('keydown',e=>{
 if(!run||run.status!=='playing'||active!=='explore'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
 if(run.paused){if(e.key==='Escape'||e.key==='p'){togglePause();e.preventDefault()}return}
 if(e.key==='Escape'||e.key==='p'){togglePause();e.preventDefault();return}
 if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keys.add(e.key);e.preventDefault()}
 if(e.key===' '||e.key==='e'){interact();e.preventDefault()}
 if(e.key==='j'){requestManualAttack();e.preventDefault()}
 if(e.key==='q'){run.weaponSlot=1-run.weaponSlot;e.preventDefault()}
});
document.addEventListener('keyup',e=>keys.delete(e.key));
window.addEventListener('blur',()=>{keys.clear();stickVisual.targetX=0;stickVisual.targetY=0;if(run){run.joy={x:0,y:0};run.steer={x:0,y:0}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&run&&run.status==='playing'&&!run.paused)togglePause()});
window.addEventListener('pagehide',()=>{if(run&&run.status==='playing')saveRunCheckpoint(true)});
window.addEventListener('resize',()=>{if(run&&run.status==='playing')resizeField()});
})();
