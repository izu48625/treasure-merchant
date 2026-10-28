/* R5.32 detailed indoor pilot: independent, no production save integration. */
(async function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const canvas=$('field'),ctx=canvas.getContext('2d',{alpha:false});
 const status=$('status'),clock=$('clock'),health=$('health'),count=$('count');
 const btnInteract=$('interact'),btnOverview=$('overview'),stick=$('stick');
 const keys=new Set();let map,model,atlas,player,enemies,loot,last=0,elapsed=0,done=false,full=false,playing=false;
 let pointer=null,joy={x:0,y:0},cam={x:0,y:0},message='施設へ侵入せよ',noticeUntil=0;
 const SCALE=2,viewW=canvas.width/SCALE,viewH=canvas.height/SCALE;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function notice(msg){message=msg;noticeUntil=performance.now()+2400;status.textContent=msg}
 function property(obj,key,defaultValue){return model.prop(obj,key,defaultValue)}
 const gradeColor={standard:'#e8c568',mid:'#6fbae3',high:'#cba6f5'};
 function objectPosition(o){return {x:o.x,y:o.y}}
 function reset(){
  if(!model)return;
  player={x:model.spawn.x,y:model.spawn.y,hp:100};
  loot=model.objects('loot').map(o=>({...o,opened:false}));
  enemies=model.objects('enemy').map((o,i)=>({
   ...objectPosition(o),homeX:o.x,homeY:o.y,kind:property(o,'kind','normal'),
   range:property(o,'range',110),angle:property(o,'angle',120)*Math.PI/180,
   facing:i%2?0:Math.PI/2,mode:'patrol',lastSeen:-999,
   notice:0,attackAt:0,phase:i*1.19,anchor:o.name
  }));
  elapsed=0;done=false;playing=true;full=false;last=0;
  notice('左の移動スティックかWASDで移動。物資に近づいて調べる。');
 }
 function blocked(x,y,r=4){return model.solidAt(x,y,r)}
 function move(o,dx,dy,r=4){
  if(!blocked(o.x+dx,o.y,r))o.x+=dx;
  if(!blocked(o.x,o.y+dy,r))o.y+=dy;
 }
 function getInput(){
  let x=(keys.has('d')||keys.has('ArrowRight')?1:0)-(keys.has('a')||keys.has('ArrowLeft')?1:0)+joy.x;
  let y=(keys.has('s')||keys.has('ArrowDown')?1:0)-(keys.has('w')||keys.has('ArrowUp')?1:0)+joy.y;
  const l=Math.hypot(x,y);if(l>1){x/=l;y/=l}
  return {x,y};
 }
 function canSee(e){
  const d=dist(e,player);if(d>e.range)return false;
  const angle=Math.atan2(player.y-e.y,player.x-e.x),err=Math.atan2(Math.sin(angle-e.facing),Math.cos(angle-e.facing));
  return Math.abs(err)<e.angle/2&&model.lineClear(e,player);
 }
 function chaseVisible(e){return dist(e,player)<e.range*1.35&&model.lineClear(e,player)}
 function advance(dt){
  if(!playing||done||full)return;
  elapsed+=dt;
  if(elapsed>=300){done=true;notice('5分経過。今回は試験用のため、本編の財宝は失われません。');return}
  const d=getInput(),rate=64;
  move(player,d.x*dt*rate,d.y*dt*rate,4);
  for(const e of enemies){
   const d=dist(e,player),sight=e.mode==='chase'?chaseVisible(e):canSee(e);
   if(sight){e.notice=Math.min(1,e.notice+dt*1.7);e.lastSeen=elapsed}
   else e.notice=Math.max(0,e.notice-dt*1.15);
   if(e.notice>.52&&e.mode==='patrol'){e.mode='chase';notice('敵に発見された！ 壁の裏へ逃げろ')}
   if(e.mode==='chase'&&(elapsed-e.lastSeen>3.2||d>270)){e.mode='patrol';e.notice=0}
   if(e.mode==='chase'){
    const a=Math.atan2(player.y-e.y,player.x-e.x);
    const v=e.kind==='fast'?79:e.kind==='heavy'?37:68;
    const step=sight?v:v*.65;
    if(d>15)move(e,Math.cos(a)*step*dt,Math.sin(a)*step*dt,5);
    e.facing=a;
    if(d<21&&elapsed>=e.attackAt){
     player.hp=Math.max(0,player.hp-(e.kind==='heavy'?34:e.kind==='fast'?17:25));
     e.attackAt=elapsed+1.65;
     notice('被弾！ HP '+player.hp);
     if(player.hp<=0){done=true;notice('探索失敗。リセットで再挑戦できる。')}
    }
   }else{
    // Local patrol arc around each authored post. Furniture collisions remain.
    const t=elapsed*.63+e.phase;
    const ax=Math.cos(t),ay=Math.sin(t*.71)*.6;
    if(dist(e,{x:e.homeX,y:e.homeY})>31){
     const a=Math.atan2(e.homeY-e.y,e.homeX-e.x);
     move(e,Math.cos(a)*14*dt,Math.sin(a)*14*dt,5);
     e.facing=a;
    }else{move(e,ax*12*dt,ay*12*dt,5);e.facing=Math.atan2(ay,ax)}
   }
  }
 }
 function rayDistance(e,a,r){
  for(let d=5;d<=r;d+=5){
   const px=e.x+Math.cos(a)*d,py=e.y+Math.sin(a)*d;
   if(blocked(px,py,1))return Math.max(0,d-5);
  }
  return r;
 }
 function screen(p){return {x:(p.x-cam.x)*(full?Math.min(canvas.width/model.worldWidth,canvas.height/model.worldHeight):SCALE),
  y:(p.y-cam.y)*(full?Math.min(canvas.width/model.worldWidth,canvas.height/model.worldHeight):SCALE)}}
 function paint(){
  if(!model||!atlas)return;
  const scale=full?Math.min(canvas.width/model.worldWidth,canvas.height/model.worldHeight):SCALE;
  if(full){cam.x=0;cam.y=0}
  else{
   cam.x=clamp(player.x-viewW/2,0,model.worldWidth-viewW);
   cam.y=clamp(player.y-viewH/2,0,model.worldHeight-viewH);
  }
  model.draw(ctx,atlas,cam,scale);
  model.drawAmbience(ctx,cam,scale,full);
  for(const e of enemies){
   const c=screen(e),r=e.range*scale;
   if(c.x+r<0||c.x-r>canvas.width||c.y+r<0||c.y-r>canvas.height)continue;
   ctx.beginPath();ctx.moveTo(c.x,c.y);
   const rayCount=15;
   for(let i=0;i<=rayCount;i++){
    const a=e.facing-e.angle/2+e.angle*i/rayCount;
    const d=rayDistance(e,a,e.range)*scale;
    ctx.lineTo(c.x+Math.cos(a)*d,c.y+Math.sin(a)*d);
   }
   ctx.closePath();ctx.fillStyle=e.mode==='chase'?'rgba(240,89,80,.20)':'rgba(240,207,119,.13)';ctx.fill();
   ctx.strokeStyle=e.mode==='chase'?'rgba(250,112,92,.75)':'rgba(247,212,137,.45)';
   ctx.lineWidth=1.5;ctx.stroke();
  }
  for(const o of loot){
   const c=screen(o),v=gradeColor[property(o,'grade','standard')];
   ctx.fillStyle=o.opened?'#5f6569':v;
   const size=o.opened?3:6;
   ctx.fillRect(Math.floor(c.x-size/2),Math.floor(c.y-size/2),size,size);
   if(!o.opened&&dist(o,player)<36){
    ctx.strokeStyle='#f6f1df';ctx.lineWidth=1.5;ctx.strokeRect(c.x-8,c.y-8,16,16);
   }
  }
  const ext=screen(model.extract);ctx.strokeStyle='#9fe7ba';ctx.lineWidth=2;ctx.strokeRect(ext.x-9,ext.y-9,18,18);
  ctx.fillStyle='rgba(105,223,167,.26)';ctx.fillRect(ext.x-7,ext.y-7,14,14);
  for(const e of enemies){const c=screen(e);ctx.fillStyle=e.kind==='heavy'?'#a5a4bb':e.kind==='fast'?'#c58459':'#d8a27d';ctx.fillRect(c.x-4,c.y-4,8,8);ctx.fillStyle='#202b30';ctx.fillRect(c.x+Math.cos(e.facing)*3-1,c.y+Math.sin(e.facing)*3-1,3,3)}
  const p=screen(player);ctx.fillStyle='#f1e7be';ctx.fillRect(p.x-5,p.y-6,10,12);ctx.fillStyle='#395c5b';ctx.fillRect(p.x-4,p.y+1,8,4);
  ctx.strokeStyle='#d7ecd2';ctx.lineWidth=1;ctx.strokeRect(p.x-6,p.y-7,12,14);
  if(full){ctx.fillStyle='rgba(15,21,27,.8)';ctx.fillRect(6,6,174,29);ctx.fillStyle='#e9dcc2';ctx.font='bold 15px monospace';ctx.fillText('MAP / ZONE 01',14,25)}
  const remain=Math.max(0,300-Math.floor(elapsed));
  clock.textContent=String(Math.floor(remain/60)).padStart(2,'0')+':'+String(remain%60).padStart(2,'0');
  health.textContent=player.hp+'/100';
  count.textContent=loot.filter(o=>o.opened).length+'/'+loot.length;
  if(performance.now()>noticeUntil)status.textContent=full?'全体図：マップボタンで戻る':'黄色＝一般、青＝中級、紫＝高級。すべて試験用の戦利品。';
 }
 function interact(){
  if(!model||done)return;
  const item=loot.filter(o=>!o.opened&&dist(o,player)<35).sort((a,b)=>dist(a,player)-dist(b))[0];
  if(item){item.opened=true;notice(item.name+' を調べた（'+property(item,'grade','standard')+'）');return}
  if(dist(player,model.extract)<30){done=true;notice('脱出成功！ '+loot.filter(o=>o.opened).length+'か所を探索。本編の所持品には反映されません。');return}
  notice('物資・緑の脱出口に近づいてから調べる');
 }
 function updateStick(){
  if(!pointer){stick.style.opacity='0';return}
  stick.style.opacity='1';
  stick.style.left=pointer.x+'px';stick.style.top=pointer.y+'px';
  const t=$('stick-thumb');t.style.transform='translate('+Math.round(joy.x*28)+'px,'+Math.round(joy.y*28)+'px)';
 }
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  e.preventDefault();canvas.setPointerCapture(e.pointerId);
  pointer={id:e.pointerId,x:e.offsetX,y:e.offsetY,originX:e.clientX,originY:e.clientY};
  updateStick();
 });
 canvas.addEventListener('pointermove',e=>{
  if(!pointer||pointer.id!==e.pointerId)return;
  e.preventDefault();const dX=e.clientX-pointer.originX,dY=e.clientY-pointer.originY;
  const k=Math.max(32,canvas.getBoundingClientRect().width/11);
  joy={x:clamp(dX/k,-1,1),y:clamp(dY/k,-1,1)};
  const len=Math.hypot(joy.x,joy.y);if(len>1){joy.x/=len;joy.y/=len}
  updateStick();
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(pointer&&pointer.id===e.pointerId){pointer=null;joy={x:0,y:0};updateStick()}});
 window.addEventListener('keydown',e=>{if(['w','a','s','d','ArrowUp','ArrowLeft','ArrowRight','ArrowDown',' ','e'].includes(e.key)){e.preventDefault();keys.add(e.key);if(e.key==='e'||e.key===' ')interact()}});
 window.addEventListener('keyup',e=>keys.delete(e.key));
 window.addEventListener('blur',()=>{keys.clear();joy={x:0,y:0};pointer=null;updateStick()});
 btnInteract.addEventListener('click',interact);
 btnOverview.addEventListener('click',()=>{full=!full;btnOverview.textContent=full?'探索画面':'全体地図'});
 $('restart').addEventListener('click',()=>{reset()});
 function frame(now){
  const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
  if(document.visibilityState==='visible'){advance(dt);paint()}
  requestAnimationFrame(frame);
 }
 try{
  status.textContent='Tiledマップとドット絵素材を読み込み中…';
  const [mr,tr]=await Promise.all([fetch('indoor.tmj'),fetch('tiles/warehouse.tsj')]);
  if(!mr.ok||!tr.ok)throw Error('Tiled JSON HTTP '+mr.status+'/'+tr.status);
  const mapData=await mr.json(),tileData=await tr.json();
  model=window.TreasureTiledMap.createModel(mapData,tileData);map=mapData;
  const image=new Image();image.decoding='async';image.src='tiles/warehouse.png';
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Tileset PNG image failed to load'))});
  atlas=image;reset();requestAnimationFrame(frame);
 }catch(e){
  status.textContent='マップ読み込み失敗: '+String(e.message||e);
  console.error(e);
 }
})();