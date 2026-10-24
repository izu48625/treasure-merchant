'use strict';
/* Exploration R1: additive, local-only extraction prototype.
   Only this module owns live enemy simulation and the temporary loot bag.
   Rewards enter the existing inventory only after reaching the exit; no arcade roll is changed. */
(function(){
 const MAP={w:740,h:620},VIEW={w:400,h:500},LIMIT=150000;
 const START={x:110,y:310},EXIT={x:48,y:310};
 const OBSTACLES=[
  {x:190,y:100,w:35,h:180},{x:418,y:78,w:45,h:185},
  {x:320,y:360,w:155,h:34},{x:102,y:466,w:44,h:82},
  {x:570,y:345,w:45,h:170}
 ];
 const PLACES=[
  [115,85,'normal'],[316,83,'historical'],[620,92,'premium'],
  [296,242,'modern'],[550,235,'normal'],[693,308,'premium'],
  [80,410,'modern'],[250,493,'historical'],[373,520,'normal'],
  [521,452,'premium'],[689,546,'modern'],[635,177,'historical']
 ];
 const chestSprites={};
 function ensureSprites(){for(const k of ['normal','historical','modern','premium']){
  if(chestSprites[k])continue;
  const im=new Image();im.src='assets/gacha/frames/chest_'+k+'_closed.webp';chestSprites[k]=im;
 }}
 let enemies=[],joy={x:0,y:0},keys=new Set(),frame=0,lastFrame=0,spawnAt=0,attackAt=0,hitAt=0,checkpointAt=0;
 let lastResult=null,lastHint='',runToken=null,canvas=null,ctx=null,flash=0;
 const hypot=(x,y)=>Math.hypot(x,y);
 const cap=(n,a,b)=>Math.min(b,Math.max(a,n));
 const enemyColors=['#c8756c','#b98d69','#c49376'];
 function run(){return state.exploreRun}
 function validRun(r){
  return !!(r&&r.v===1&&Number.isFinite(r.elapsed)&&r.elapsed>=0&&r.elapsed<=LIMIT+10000&&
   Number.isFinite(r.hp)&&r.hp>=0&&r.hp<=10&&r.p&&Number.isFinite(r.p.x)&&Number.isFinite(r.p.y)&&
   r.p.x>=12&&r.p.x<=MAP.w-12&&r.p.y>=12&&r.p.y<=MAP.h-12&&
   Array.isArray(r.chests)&&r.chests.length===PLACES.length&&
   r.chests.every((c,i)=>c&&c.x===PLACES[i][0]&&c.y===PLACES[i][1]&&
    c.kind===PLACES[i][2]&&ITEM_BY_ID.has(c.id)&&typeof c.ticket==='boolean'&&Number.isInteger(c.q)&&c.q>=0&&c.q<QNAME.length&&typeof c.opened==='boolean'));
 }
 function weaponList(){
  return state.inv.map(x=>({row:x,it:item(x.id)}))
   .filter(x=>x.it&&/武器|剣|刀|杖|スコップ|フライパン|弓|銃/.test(x.it.category+' '+x.it.name))
   .slice(0,70);
 }
 function weapon(){
  const row=state.inv.find(x=>x.uid===state.exploreWeaponUid);
  return row?{row:row,it:item(row.id)}:null;
 }
 function strength(){const w=weapon();return w?1.4+Math.min(5,RARITY.indexOf(w.it.rarity))*.6+w.row.q*.3:1}
 function bag(r){return r.chests.filter(c=>c.opened)}
 function bagValue(rows){return rows.reduce((v,c)=>v+price(item(c.id),c.q),0n)}
 function itemTiles(rows){
  return rows.map(c=>{const it=item(c.id);return '<div class="tm-exp-item"><img loading="lazy" src="'+esc(it.image)+'" alt="'+esc(it.name)+'"><span>'+esc(it.name)+(c.ticket?' +券':'')+'</span></div>'}).join('');
 }
 function page(){
  const r=run(),w=weapon(),wlist=weaponList();
  const equip=r?'':('<section class="tm-exp-equip"><strong>持ち込む装備 · 武器1枠</strong>'+
   '<select id="expEquip" aria-label="武器を選ぶ"><option value="">素手（標準攻撃）</option>'+
   wlist.map(x=>'<option value="'+x.row.uid+'"'+(w&&w.row.uid===x.row.uid?' selected':'')+'>'+esc(x.it.name)+' · '+x.it.rarity+' / '+esc(QNAME[x.row.q])+'</option>').join('')+
   '</select><small>手に入れた武器は所持品から装備可能。売却すると装備は解除されます。</small></section>');
  let stage='';
  if(r){
   const b=bag(r);
   stage='<div class="tm-exp-stage"><div class="tm-exp-status">'+
    '<div>残り時間<strong id="expClock">--:--</strong></div>'+
    '<div>体力<strong id="expHp">--</strong></div>'+
    '<div>戦利品<strong id="expBagCount">'+b.length+'点</strong></div></div>'+
    '<canvas id="expCanvas" width="'+VIEW.w+'" height="'+VIEW.h+'" aria-label="探索フィールド。移動して宝箱を探し出口へ戻る"></canvas>'+
    '<div class="tm-exp-controls"><div id="expPad" class="tm-exp-pad" aria-label="移動スティック" role="group"><span id="expStick" class="tm-exp-stick"></span></div>'+
    '<div class="tm-exp-actions"><button data-explore="open" id="expOpen" type="button" disabled>宝箱を開ける</button>'+
    '<button data-explore="exit" id="expExit" type="button" class="tm-exp-exit" disabled>脱出する</button></div></div>'+
    '<div class="tm-exp-hint" id="expHint" aria-live="polite">左スティック、またはWASD・矢印キーで移動</div>'+
    '<div class="tm-exp-bag"><div class="tm-exp-bag-head"><strong>未確定の戦利品</strong><span>失敗すると全てロスト</span></div>'+
    '<div id="expLoot" class="tm-exp-loot">'+(b.length?itemTiles(b):'<p class="tm-exp-note">まだ何も見つけていません</p>')+'</div></div></div>';
  }else{
   if(lastResult){
    stage='<section class="tm-exp-result '+(!lastResult.ok?'tm-exp-fail':'')+'"><strong>'+
      (lastResult.ok?'脱出成功 · 戦利品を確保':'探索失敗 · 戦利品ロスト')+'</strong>'+
      '<p>'+esc(lastResult.message)+'</p>'+
      (lastResult.ok?'<div class="tm-exp-result-items">'+lastResult.items.map(c=>'<img src="'+esc(item(c.id).image)+'" title="'+esc(item(c.id).name)+'" alt="'+esc(item(c.id).name)+'">').join('')+'</div>':'')+
     '</section>';
   }
   stage='<button class="tm-exp-start" data-explore="start" type="button">探索を開始する</button>'+stage;
  }
  return '<div class="tm-expedition"><h1>探索区域 · 試験フィールド</h1>'+
   '<p class="tm-explore-intro">宝箱を回収して時間内に出口へ。敵は次第に増加。戦利品は脱出して初めて所持品になります。</p>'+
   (r?'<div class="tm-exp-summary">残り時間内に左側の緑色の出口へ。'+(w?'装備：<b>'+esc(w.it.name)+'</b>':'装備：素手')+'</div>':'<div class="tm-exp-summary">制限時間 <b>2分30秒</b> · 宝箱12個 · 装備：'+(w?esc(w.it.name):'素手')+'</div>')+
   equip+stage+
   '<p class="tm-exp-help">初期試作：敵は丸型、攻撃は自動。宝箱付近で「開ける」、出口付近で「脱出」を押します。死亡・時間切れで未回収品を失います。既存のガチャ・市場・所持品はそのまま利用できます。タブ移動中は一時停止します。</p></div>';
 }
 function solid(x,y,radius){
  if(x<radius||y<radius||x>MAP.w-radius||y>MAP.h-radius)return true;
  return OBSTACLES.some(o=>x+radius>o.x&&x-radius<o.x+o.w&&y+radius>o.y&&y-radius<o.y+o.h);
 }
 function move(entity,vx,vy,dt,rad){
  const dx=vx*dt,dy=vy*dt;
  if(!solid(entity.x+dx,entity.y,rad))entity.x+=dx;
  if(!solid(entity.x,entity.y+dy,rad))entity.y+=dy;
 }
 function spawn(){
  const r=run();if(!r)return;
  for(let i=0;i<20;i++){
   const ang=Math.random()*Math.PI*2,dist=200+Math.random()*145;
   const x=cap(r.p.x+Math.cos(ang)*dist,20,MAP.w-20);
   const y=cap(r.p.y+Math.sin(ang)*dist,20,MAP.h-20);
   if(!solid(x,y,14)&&hypot(x-r.p.x,y-r.p.y)>130){
    enemies.push({x:x,y:y,hp:2.2+Math.floor(r.elapsed/35000)*.4,speed:33+Math.random()*14,col:enemyColors[i%3]});return;
   }
  }
 }
 function resetEnemies(){
  enemies=[];const r=run();if(!r)return;
  const n=2+Math.floor(r.elapsed/14000);
  for(let i=0;i<Math.min(18,n);i++)spawn();
  spawnAt=0;attackAt=0;hitAt=0;checkpointAt=0;
 }
 function begin(){
  if(!storageReady||actionPersisting||run())return;
  const chests=PLACES.map(p=>{
   const rarity=choose(BASE_WEIGHTS),type=p[2]==='historical'?'era':p[2]==='modern'?'modern':'normal';
   const it=pickItem(rarity,type);
   return {x:p[0],y:p[1],kind:p[2],id:it.id,q:quality(rarity),ticket:Math.random()<.08,opened:false};
  });
  state.exploreRun={v:1,elapsed:0,hp:6,p:{x:START.x,y:START.y},chests:chests};
  lastResult=null;saveWithCommit(()=>{active='explore';resetEnemies();render()});
 }
 function nearbyChest(){
  const r=run();if(!r)return null;
  let best=null,dist=Infinity;
  for(const c of r.chests){
   const d=hypot(r.p.x-c.x,r.p.y-c.y);
   if(!c.opened&&d<57&&d<dist){best=c;dist=d}
  }
  return best;
 }
 function nearExit(){
  const r=run();return !!(r&&hypot(r.p.x-EXIT.x,r.p.y-EXIT.y)<61);
 }
 function openChest(){
  const r=run(),c=nearbyChest();if(!r||!c||actionPersisting)return;
  c.opened=true;
  saveWithCommit(()=>{
   const it=item(c.id);
   toast('発見：'+it.name+' ['+it.rarity+']'+(c.ticket?' +ガチャ券':'') );
   updateBag();updateHud();draw();
  });
 }
 function finish(ok,reason){
  const r=run();if(!r||actionPersisting)return;
  const found=bag(r),items=found.map(c=>({id:c.id,q:c.q}));
  const total=bagValue(found),tickets=found.filter(c=>c.ticket).length;
  if(ok){
   state.bonusTickets=Math.min(9999,(state.bonusTickets||0)+tickets);
   for(const c of found){
    receive(item(c.id),c.q);
    const d=state.disc[c.id];d.gachaQty=Math.max(0,(d.gachaQty||0)-1);
    d.exploreQty=(d.exploreQty||0)+1;
   }
  }
  state.exploreRun=null;enemies=[];joy={x:0,y:0};
  saveWithCommit(()=>{
   lastResult={ok:ok,items:ok?items:[],message:ok?
    found.length+'点を所持品に保存しました。推定相場 '+short(total)+'。'+(tickets?' ガチャ券 +'+tickets+'枚。':''):
    reason+'　探索中の'+found.length+'点は持ち帰れませんでした。'};
   active='explore';render();
  });
 }
 function action(a){
  if(a==='start')begin();
  if(a==='open')openChest();
  if(a==='exit'&&nearExit())finish(true,'');
 }
 function bindPad(){
  const pad=document.getElementById('expPad'),stick=document.getElementById('expStick');
  if(!pad||!stick)return;
  let pointer=null;
  function update(e){
   const rect=pad.getBoundingClientRect(),dx=e.clientX-(rect.left+rect.width/2),dy=e.clientY-(rect.top+rect.height/2);
   const range=rect.width*.34,mag=Math.max(1,hypot(dx,dy)),len=Math.min(1,mag/range);
   joy={x:dx/mag*len,y:dy/mag*len};
   stick.style.transform='translate(calc(-50% + '+(joy.x*range)+'px),calc(-50% + '+(joy.y*range)+'px))';
  }
  pad.addEventListener('pointerdown',e=>{e.preventDefault();pointer=e.pointerId;pad.setPointerCapture(pointer);update(e)});
  pad.addEventListener('pointermove',e=>{if(pointer===e.pointerId){e.preventDefault();update(e)}});
  function release(e){if(pointer!==e.pointerId)return;pointer=null;joy={x:0,y:0};stick.style.transform='translate(-50%,-50%)'}
  pad.addEventListener('pointerup',release);pad.addEventListener('pointercancel',release);pad.addEventListener('lostpointercapture',()=>{pointer=null;joy={x:0,y:0};stick.style.transform='translate(-50%,-50%)'});
 }
 function mount(){
  canvas=document.getElementById('expCanvas');ctx=canvas?canvas.getContext('2d'):null;
  if(!canvas||!ctx)return;
  lastFrame=0;lastHint='';runToken=run();
  ensureSprites();resetEnemies();bindPad();updateBag();updateHud();
  if(!frame)frame=requestAnimationFrame(loop);
 }
 function updateBag(){
  const r=run(),el=document.getElementById('expLoot');if(!r||!el)return;
  const b=bag(r);el.innerHTML=b.length?itemTiles(b):'<p class="tm-exp-note">まだ何も見つけていません</p>';
  const count=document.getElementById('expBagCount');if(count)count.textContent=b.length+'点';
 }
 function updateHud(){
  const r=run();if(!r)return;
  const clock=document.getElementById('expClock'),hp=document.getElementById('expHp'),open=document.getElementById('expOpen'),exit=document.getElementById('expExit');
  const time=Math.max(0,Math.ceil((LIMIT-r.elapsed)/1000));
  if(clock){clock.textContent=String(Math.floor(time/60)).padStart(2,'0')+':'+String(time%60).padStart(2,'0');clock.classList.toggle('danger',time<30)}
  if(hp)hp.textContent='♥ '+r.hp+'/6';
  const chest=nearbyChest(),escape=nearExit();
  if(open)open.disabled=!chest||actionPersisting;
  if(exit)exit.disabled=!escape||actionPersisting;
  const hint=escape?'脱出地点です。戦利品を確定できます':chest?'宝箱を発見！ 開けるボタンで回収':'宝箱を探し、危険になる前に出口へ';
  if(hint!==lastHint){const el=document.getElementById('expHint');if(el)el.textContent=hint;lastHint=hint}
 }
 function draw(){
  const r=run();if(!r||!ctx)return;
  const g=ctx,p=r.p;
  const cx=cap(p.x-VIEW.w/2,0,MAP.w-VIEW.w),cy=cap(p.y-VIEW.h/2,0,MAP.h-VIEW.h);
  g.clearRect(0,0,VIEW.w,VIEW.h);g.save();g.translate(-cx,-cy);
  g.fillStyle='#2c3a32';g.fillRect(0,0,MAP.w,MAP.h);
  g.strokeStyle='#394b3e';g.lineWidth=1;g.beginPath();
  for(let x=0;x<=MAP.w;x+=40){g.moveTo(x,0);g.lineTo(x,MAP.h)}
  for(let y=0;y<=MAP.h;y+=40){g.moveTo(0,y);g.lineTo(MAP.w,y)}g.stroke();
  g.fillStyle='#465b4a';g.fillRect(16,16,MAP.w-32,14);g.fillRect(16,MAP.h-30,MAP.w-32,14);
  g.fillStyle='#173b2d';g.fillRect(13,EXIT.y-49,69,98);g.strokeStyle='#92e2b3';g.lineWidth=3;g.strokeRect(13,EXIT.y-49,69,98);
  g.fillStyle='#beefc9';g.font='bold 14px sans-serif';g.fillText('EXIT',25,EXIT.y-14);
  g.fillStyle='#9decb1';g.font='11px sans-serif';g.fillText('脱出',34,EXIT.y+7);
  for(const o of OBSTACLES){g.fillStyle='#44544a';g.fillRect(o.x+4,o.y+5,o.w,o.h);g.fillStyle='#7b8264';g.fillRect(o.x,o.y,o.w,o.h);g.strokeStyle='#353c34';g.strokeRect(o.x+3,o.y+3,o.w-6,o.h-6)}
  for(const c of r.chests){
   if(c.opened)continue;
   const img=chestSprites[c.kind];const near=hypot(c.x-p.x,c.y-p.y)<57;
   if(near){g.fillStyle='#f3d3822a';g.beginPath();g.arc(c.x,c.y,42,0,Math.PI*2);g.fill()}
   if(img&&img.complete&&img.naturalWidth)g.drawImage(img,c.x-30,c.y-29,60,51);
   else{g.fillStyle='#bc985b';g.fillRect(c.x-17,c.y-15,34,28);g.strokeStyle='#f9dfa1';g.strokeRect(c.x-17,c.y-15,34,28)}
  }
  for(const e of enemies){
   g.fillStyle='#1e2925';g.beginPath();g.ellipse(e.x,e.y+6,13,8,0,0,Math.PI*2);g.fill();
   g.fillStyle=e.col;g.beginPath();g.arc(e.x,e.y,12,0,Math.PI*2);g.fill();
   g.strokeStyle='#f2c9aa';g.lineWidth=1.5;g.stroke();
   g.fillStyle='#382922';g.beginPath();g.arc(e.x-4,e.y-2,2,0,Math.PI*2);g.arc(e.x+4,e.y-2,2,0,Math.PI*2);g.fill();
   g.strokeStyle='#d9b9a0';g.beginPath();g.moveTo(e.x-5,e.y+4);g.lineTo(e.x+5,e.y+4);g.stroke();
  }
  g.fillStyle='#111d20';g.beginPath();g.ellipse(p.x,p.y+9,14,8,0,0,Math.PI*2);g.fill();
  g.fillStyle=(hitAt>0&&Math.floor(hitAt*12)%2===0)?'#f4f1e7':'#589bc0';g.beginPath();g.arc(p.x,p.y,13,0,Math.PI*2);g.fill();
  g.strokeStyle='#d5f1fa';g.lineWidth=2.5;g.stroke();
  g.fillStyle='#e6f3f0';g.beginPath();g.arc(p.x-4,p.y-3,2,0,Math.PI*2);g.arc(p.x+4,p.y-3,2,0,Math.PI*2);g.fill();
  if(flash>0){g.strokeStyle='#f7df91';g.lineWidth=3;g.beginPath();g.arc(p.x,p.y,58,0,Math.PI*2);g.stroke()}
  g.restore();
 }
 function tick(dt){
  const r=run();if(!r||actionPersisting)return;
  r.elapsed+=dt*1000;
  if(r.elapsed>=LIMIT){r.elapsed=LIMIT;finish(false,'制限時間切れ。');return}
  const p=r.p;
  let vx=joy.x,vy=joy.y;
  if(keys.has('ArrowLeft')||keys.has('a'))vx-=1;
  if(keys.has('ArrowRight')||keys.has('d'))vx+=1;
  if(keys.has('ArrowUp')||keys.has('w'))vy-=1;
  if(keys.has('ArrowDown')||keys.has('s'))vy+=1;
  const len=hypot(vx,vy);if(len>1){vx/=len;vy/=len}
  move(p,vx*148,vy*148,dt,12);
  spawnAt+=dt;const interval=Math.max(.48,5.6-r.elapsed/30000);
  if(spawnAt>=interval&&enemies.length<24){spawnAt=0;spawn()}
  hitAt=Math.max(0,hitAt-dt);attackAt+=dt;flash=Math.max(0,flash-dt);
  for(const e of enemies){
   const dx=p.x-e.x,dy=p.y-e.y,d=hypot(dx,dy)||1;
   if(d>15)move(e,dx/d*e.speed,dy/d*e.speed,dt,11);
   if(d<25&&hitAt<=0){r.hp=Math.max(0,r.hp-1);hitAt=1.0;if(r.hp<=0){finish(false,'敵に倒されました。');return}}
  }
  if(attackAt>=.5){
   const near=enemies.filter(e=>hypot(e.x-p.x,e.y-p.y)<61).sort((a,b)=>hypot(a.x-p.x,a.y-p.y)-hypot(b.x-p.x,b.y-p.y))[0];
   if(near){near.hp-=strength();flash=.075;if(near.hp<=0)enemies.splice(enemies.indexOf(near),1);attackAt=0}
  }
  checkpointAt+=dt;if(checkpointAt>=7){checkpointAt=0;save()}
 }
 function loop(ts){
  frame=0;
  if(active!=='explore'||!run()||!canvas||!canvas.isConnected||!ctx){lastFrame=0;return}
  const dt=lastFrame?cap((ts-lastFrame)/1000,0,.055):0;lastFrame=ts;
  if(!document.hidden){tick(dt);updateHud();draw()}
  if(active==='explore'&&run())frame=requestAnimationFrame(loop);
 }
 document.addEventListener('keydown',e=>{
  if(active!=='explore'||!run()||/input|select|textarea/i.test(e.target.tagName))return;
  const k=e.key.length===1?e.key.toLowerCase():e.key;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d',' ','e'].includes(k)){e.preventDefault();keys.add(k)}
  if(!e.repeat&&k===' ')openChest();
  if(!e.repeat&&k==='e'&&nearExit())finish(true,'');
 });
 document.addEventListener('keyup',e=>{keys.delete(e.key.length===1?e.key.toLowerCase():e.key)});
 window.addEventListener('blur',()=>{keys.clear();joy={x:0,y:0}});
 document.body.addEventListener('change',e=>{
  if(e.target.id!=='expEquip'||active!=='explore'||run()||actionPersisting)return;
  const id=e.target.value===''?null:Number(e.target.value);
  if(id!==null&&!weaponList().some(w=>w.row.uid===id))return;
  state.exploreWeaponUid=id;saveWithCommit(()=>render());
 });
 window.TMExplore={page:page,mount:mount,action:action,validRun:validRun};
})();