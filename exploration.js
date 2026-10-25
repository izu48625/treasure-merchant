(function explorationModule(){
'use strict';
// Independent, single-player extraction prototype. No gacha/arcade draw results are changed.
const WORLD={w:920,h:720}, VIEW={w:360,h:416}, DURATION=240;
const TYPES=['normal','historical','modern','premium'];
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
let run=null,raf=0,canvas=null,ctx=null,lastFrame=0,lastHud=0;
const keys=new Set(),images={};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function gearItem(kind){
 const uid=state.exploreEquip&&state.exploreEquip[kind];
 const entry=state.inv.find(v=>v.uid===uid);
 const it=entry?item(entry.id):null;
 return entry&&it&&GEAR_RULES[kind].match(it)?{it,entry}:null;
}
function gearCandidates(kind){
 return state.inv.filter(row=>{const it=item(row.id);return it&&GEAR_RULES[kind].match(it)}).slice(-120).reverse();
}
function gearStats(){
 const weapon=gearItem('weapon'),tool=gearItem('tool'),charm=gearItem('charm');
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
function startRun(){
 if(!storageReady||actionPersisting)return;
 stopLoop();preload();const stats=gearStats();
 run={
  status:'playing',paused:false,pausedAt:0,start:Date.now(),duration:DURATION,player:{x:88,y:100,hp:stats.maxHp,invuln:0},
  stats,enemies:[],chests:CHEST_SPOTS.map(([x,y,type],i)=>({x,y,type,i,opened:false,reward:chooseLoot(type)})),
  loot:[],tickets:0,kills:0,spawnAt:0,attackAt:0,autoAttack:true,manualAttack:false,dodgeCooldown:0,dodgeTime:0,facing:{x:1,y:0},weaponSlot:0,slash:null,joy:{x:0,y:0},message:'宝箱を探して出口へ戻れ',messageUntil:Date.now()+2500
 };
 spawnEnemy();spawnEnemy();render();
}
function notify(s){
 if(!run)return;
 run.message=s;run.messageUntil=Date.now()+2300;
 const e=document.getElementById('exp-note');if(e)e.textContent=s;
}
function stopLoop(){if(raf)cancelAnimationFrame(raf);raf=0;canvas=null;ctx=null;lastFrame=0;keys.clear()}
function leaveRun(){
 document.body.classList.remove('exp-immersive');
 stopLoop();
 // The raid has no durable state. Unsaved loot is forfeited on navigation/reload.
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
function spawnEnemy(){
 if(!run||run.enemies.length>=20)return;
 for(let k=0;k<16;k++){
  const angle=Math.random()*Math.PI*2, radius=165+Math.random()*150;
  const x=clamp(run.player.x+Math.cos(angle)*radius,22,WORLD.w-22);
  const y=clamp(run.player.y+Math.sin(angle)*radius,22,WORLD.h-22);
  if(!solid(x,y,15)&&distance({x,y},run.player)>170){
   run.enemies.push({x,y,hp:30,attackAt:0,wobble:Math.random()*6,slow:0});return;
  }
 }
}
function remaining(){return run?Math.max(0,run.duration-((run.paused?run.pausedAt:Date.now())-run.start)/1000):0}
function lose(reason){
 if(!run||run.status!=='playing')return;
 document.body.classList.remove('exp-immersive');
 run.status='lost';run.reason=reason;run.loot=[];run.tickets=0;
 stopLoop();render();
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
 draw();updateHUD(true);
}
function bank(){
 if(!run||run.status!=='playing'||actionPersisting||!storageReady)return;
 if(distance(run.player,{x:88,y:100})>58){notify('緑色の出口まで戻ってください');return}
 if(!run.loot.length&&!run.tickets){notify('戦利品を集めてから脱出できます');return}
 run.status='saving';document.body.classList.remove('exp-immersive');stopLoop();
 const rewards=run.loot.slice(),tickets=run.tickets;
 // Inventory and discovery are committed using the existing durable save path.
 for(const reward of rewards){
  const it=item(reward.id);
  if(it)receive(it,reward.q,false,'explore');
 }
 state.bonusTickets=Math.min(1000000,(state.bonusTickets||0)+tickets);
 saveWithCommit(()=>{
  if(!run)return;
  run.status='escaped';run.banked=rewards;run.bankedTickets=tickets;render();
 });
}
function tick(dt){
 if(!run||run.status!=='playing'||run.paused)return;
 const elapsed=(Date.now()-run.start)/1000;
 if(elapsed>=run.duration){lose('時間切れで戦利品を失いました');return}
 const p=run.player;
 let vx=(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0)+run.joy.x;
 let vy=(keys.has('s')||keys.has('ArrowDown')?1:0)-(keys.has('w')||keys.has('ArrowUp')?1:0)+run.joy.y;
 const length=Math.hypot(vx,vy);
 if(length>0){vx/=length;vy/=length;run.facing={x:vx,y:vy};move(p,vx*run.stats.speed*(run.dodgeTime>0?2.6:1),vy*run.stats.speed*(run.dodgeTime>0?2.6:1),dt,12)}
 run.dodgeCooldown=Math.max(0,run.dodgeCooldown-dt);run.dodgeTime=Math.max(0,run.dodgeTime-dt);
 if(elapsed>=run.spawnAt){
  const wave=Math.floor(elapsed/55);
  for(let i=0;i<Math.min(1+wave,4);i++)spawnEnemy();
  run.spawnAt=elapsed+Math.max(4.5,15-elapsed/30);
 }
 p.invuln=Math.max(0,p.invuln-dt);
 for(const enemy of run.enemies){
  const d=distance(enemy,p);
  if(d>18){const v=46+elapsed/24;const alert=d<210;enemy.alert=alert;if(alert)enemy.lastSeen=elapsed;if(alert||elapsed-(enemy.lastSeen||-999)<2.2)move(enemy,(p.x-enemy.x)/Math.max(d,1)*v,(p.y-enemy.y)/Math.max(d,1)*v,dt,10)}
  else if(p.invuln<=0){
   p.hp=Math.max(0,p.hp-10);
   p.invuln=.95;
   if(p.hp<=0){lose('敵に倒され、戦利品を失いました');return}
  }
 }
 if(elapsed>=run.attackAt&&(run.autoAttack||run.manualAttack)){
  run.manualAttack=false;
  let target=null,best=run.weaponSlot===0?144:112;
  for(const e of run.enemies){const d=distance(e,p);if(d<best){target=e;best=d}}
  if(target){
   target.hp-=run.stats.attack*(run.weaponSlot===0?1:1.3);run.slash={x:target.x,y:target.y,until:Date.now()+180};
   run.attackAt=elapsed+(run.weaponSlot===0?.55:.82);
   if(target.hp<=0){run.enemies.splice(run.enemies.indexOf(target),1);run.kills++}
  }
 }
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
  const canExit=atExit&&(run.loot.length>0||run.tickets>0);
  btn.dataset.context=canExit?'exit':near?'chest':'none';
  btn.disabled=!(canExit||(near&&run.loot.length<run.stats.capacity));
  btn.textContent=canExit?'脱出する':near?'開ける':'調べる';
  btn.setAttribute('aria-label',canExit?'探索を終了して戦利品を持ち帰る':near?'近くの宝箱を開ける':'近くに調べられるものはありません');
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
 draw();updateHUD();raf=requestAnimationFrame(frame);
}
function bindStick(){
 const el=document.getElementById('exp-stick'),thumb=document.getElementById('exp-stick-thumb');
 if(!el||!run)return;
 let pointer=null;
 const update=e=>{
  const box=el.getBoundingClientRect();
  let x=(e.clientX-(box.left+box.width/2))/(box.width*.32),y=(e.clientY-(box.top+box.height/2))/(box.height*.32);
  const mag=Math.max(1,Math.hypot(x,y));x/=mag;y/=mag;
  run.joy.x=x;run.joy.y=y;
  thumb.style.transform='translate('+Math.round(x*35)+'px,'+Math.round(y*35)+'px)';
 };
 el.addEventListener('pointerdown',e=>{if(pointer!==null)return;pointer=e.pointerId;el.setPointerCapture(pointer);update(e);e.preventDefault()});
 el.addEventListener('pointermove',e=>{if(pointer===e.pointerId){update(e);e.preventDefault()}});
 const release=e=>{if(pointer!==e.pointerId)return;pointer=null;if(run)run.joy={x:0,y:0};thumb.style.transform='translate(0,0)'};
 el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);
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
 else{run.paused=true;run.pausedAt=Date.now();run.joy={x:0,y:0};keys.clear();}
 const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel();
 const btn=document.getElementById('exp-pause-toggle');if(btn){btn.textContent=run.paused?'▶':'⏸';btn.setAttribute('aria-label',run.paused?'探索を再開':'探索を一時停止')}
 updateHUD(true);
}
function contents(){
 if(!run||run.status==='lost'||run.status==='escaped'){
  const ended=run&&run.status!=='playing',won=ended&&run.status==='escaped';
  const earned=won?(run.banked||[]):[];
  return '<section class="exp-shell"><div class="exp-hero"><div class="exp-eyebrow">EXTRACTION / PROTOTYPE</div><h1>財宝探索</h1>'+
   '<p>宝箱を探し、敵を避けて、制限時間内に生還せよ。</p></div>'+
   (ended?'<div class="exp-report"><strong class="'+(won?'success':'failure')+'">'+(won?'帰還成功':'探索失敗')+'</strong><p>'+(won?'獲得した財宝を所持品へ保存しました。':escapeHTML(run.reason||'戦利品は失われました'))+'</p>'+
     (won?'<div class="exp-report-items">'+earned.map(v=>{const it=item(v.id);return '<img src="'+it.image+'" title="'+escapeHTML(it.name)+'" alt="'+escapeHTML(it.name)+'">'}).join('')+'</div><p>財宝 '+earned.length+'点 ／ ガチャ券 '+(run.bankedTickets||0)+'枚</p>':'')+'</div>':'')+
   '<div class="exp-intro"><h2>探索ルール</h2><p>4分以内に緑色の出口へ。時間切れ・体力0・途中離脱では、その探索で集めた物だけを失います。装備品は失いません。</p>'+
    '<div class="exp-checks"><span>移動：左スティック</span><span>攻撃：自動／手動</span><span>武器切替：右ボタン</span><span>宝箱：近づいて開封</span></div></div>'+
   '<div class="exp-loadout"><h2>装備を選ぶ</h2>'+gearSelect('weapon')+gearSelect('tool')+gearSelect('charm')+'</div>'+
   '<button class="exp-start" data-explore="start">探索を開始する <span>→</span></button>'+
   '<p class="exp-caption">試作モード：探索途中の進捗は保存されず、アプリを閉じた場合も戦利品はロストします。現金とガチャの抽選仕様は変更しません。</p></section>';
 }
 if(run.status==='saving')return '<section class="exp-shell"><h1>帰還処理中</h1><p>戦利品をセーブしています。保存完了後に結果を表示します。</p></section>';
 return '<section class="exp-shell exp-playing"><button type="button" id="exp-pause-toggle" class="exp-pause-toggle" data-explore="pause" aria-label="探索を一時停止">⏸</button><div class="exp-hud"><button type="button" class="exp-leave" data-explore="leave">← 拠点</button><div><small>残り時間</small><strong id="exp-clock">04:00</strong></div><div><small>体力</small><strong id="exp-health">'+run.player.hp+'/'+run.stats.maxHp+'</strong><span class="exp-health-track"><i id="exp-hp-fill" style="width:100%"></i></span></div><div><small>敵</small><strong id="exp-enemies">2体</strong></div></div>'+
 '<div class="exp-map-frame"><canvas id="exp-field" width="'+VIEW.w+'" height="'+VIEW.h+'" role="img" aria-label="見下ろし型の探索マップ。左のスティックかWASDキーで移動します"></canvas><span class="exp-map-brand">探索UI R5.3j · 透過ボタン</span></div>'+
 '<div class="exp-controls"><div id="exp-stick" class="exp-stick" aria-label="移動スティック"><div class="exp-stick-ring"></div><div id="exp-stick-thumb" class="exp-stick-thumb"></div></div>'+
 '<div class="exp-control-actions"><div class="exp-action-grid"><button type="button" id="exp-attack" data-explore="attack">攻撃</button><button type="button" id="exp-swap" data-explore="swap">武器 1 ⇄</button><button type="button" id="exp-interact" data-explore="context" disabled>調べる</button></div><div class="exp-action-bottom"><button type="button" data-explore="bag">バッグ</button><button type="button" id="exp-auto" data-explore="auto" aria-pressed="true">AUTO ON</button></div></div></div>'+
 '<div id="exp-pause-layer" class="exp-pause-layer"></div><div class="exp-backpack" id="exp-backpack"><div class="exp-bag-title"><strong>戦利品バッグ</strong><span id="exp-bag">0/'+run.stats.capacity+'</span></div><div id="exp-loot" class="exp-loot-grid"><p>まだ戦利品はありません</p></div><p class="exp-notification" id="exp-note"></p></div>'+
 '<p class="exp-caption">緑色の出口に戻るとアクションボタンが「脱出する」に変わります。別画面への移動・再読み込みは探索放棄になります。</p></section>';
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
  if(type==='auto'){run.autoAttack=!run.autoAttack;updateHUD(true);return}
  if(type==='attack'){run.manualAttack=true;return}
  if(type==='swap'){run.weaponSlot=1-run.weaponSlot;notify('武器スロット '+(run.weaponSlot+1)+'（操作試作）');updateHUD(true);return}
 }
 if(type==='context'){if(button.dataset.context==='exit')bank();else if(button.dataset.context==='chest')interact();return}
 if(type==='interact'){interact();return}
 if(type==='exit'){bank();return}
 if(type==='drop'&&run&&run.status==='playing'){
  const i=Number(button.dataset.i);
  if(Number.isInteger(i)&&i>=0&&i<run.loot.length){run.loot.splice(i,1);notify('戦利品をバッグから捨てた');if(run.paused){const layer=document.getElementById('exp-pause-layer');if(layer)layer.innerHTML=pausePanel()}updateHUD(true)}
 }
};
document.body.addEventListener('change',e=>{
 const t=e.target;if(!t.matches('[data-exp-gear]')||!storageReady||actionPersisting||(run&&run.status==='playing'&&!run.paused))return;
 const kind=t.dataset.expGear;if(!GEAR_RULES[kind])return;
 const uid=Number(t.value),entry=state.inv.find(v=>v.uid===uid),it=entry&&item(entry.id);
 if(uid&&(!entry||!it||!GEAR_RULES[kind].match(it)))return;
 if(run&&run.paused){
  const previous=run.stats,next=gearStats();
  if(run.loot.length>next.capacity){t.value=String(state.exploreEquip?.[kind]||0);notify('バッグ容量を下回る装備には変更できません');return}
  state.exploreEquip={...(state.exploreEquip||{}),[kind]:uid||0};
  run.stats=next;run.player.hp=Math.min(next.maxHp,Math.max(1,Math.round(run.player.hp/previous.maxHp*next.maxHp)));
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
 if(e.key==='j'){run.manualAttack=true;e.preventDefault()}
 if(e.key==='q'){run.weaponSlot=1-run.weaponSlot;e.preventDefault()}
});
document.addEventListener('keyup',e=>keys.delete(e.key));
window.addEventListener('blur',()=>{keys.clear();if(run)run.joy={x:0,y:0}});
window.addEventListener('resize',()=>{if(run&&run.status==='playing')resizeField()});
})();
