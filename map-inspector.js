/* R6.13: stand-alone, read-only inspector for the EXACT tactical map rendered in raids.
   No merchant state, random reward rolls, checkpoint or inventory access. */
(function(){
 'use strict';
 const source=window.TreasureIndoorLayoutV5,math=window.TreasureMapAuditCore;
 const canvas=document.getElementById('audit-canvas'),view=document.getElementById('audit-view');
 const status=document.getElementById('audit-loading');
 const zoomText=document.getElementById('audit-zoom-readout');
 const title=document.getElementById('audit-item-title'),detail=document.getElementById('audit-item-detail');
 const coords=document.getElementById('audit-coordinate');
 if(!source||!math||!canvas||!view)return;
 const ctx=canvas.getContext('2d');
 if(!ctx){status.textContent='Canvasが利用できません';return}
 const grades={standard:{color:'#e6c66b',name:'黄・一般'},mid:{color:'#6bb9e5',name:'青・中級'},
  high:{color:'#ba8bf5',name:'紫・高級'},ultra:{color:'#ff856e',name:'赤金・最上位'}};
 const floors={surface:{label:'1F 商業施設',layout:null,bitmap:null,error:null,markers:null},
  basement:{label:'B1 地下保管庫',layout:null,bitmap:null,error:null,markers:null}};
 const state={floor:new URLSearchParams(window.location.search).get('floor')==='b1'?'basement':'surface',
  camera:null,fit:1,width:0,height:0,selected:null,
  overlays:{loot:true,guards:true,zones:true}};
 const pointers=new Map();
 let tap=null,frame=0;
 const inFloor=()=>floors[state.floor];
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 const viewScale=()=>clamp(window.devicePixelRatio||1,1,2);
 function messages(heading,body){title.textContent=heading;detail.textContent=body}
 function showStatus(msg){status.hidden=!msg;if(msg)status.textContent=msg}
 function markerGroups(layout){
  const markers=[];
  const push=(kind,name,point,color,desc,extra={})=>{
   if(point&&Number.isFinite(point.x)&&Number.isFinite(point.y))
    markers.push({kind,name,x:point.x,y:point.y,color,desc,...extra});
  };
  push('start','出撃入口',layout.start,'#afbdb3',
   'ここからマップ内の移動を開始します。');
  push('exit','脱出口',layout.fixedExit,'#7bd49a',
   layout.isBasement?'地下B1専用の脱出口。地上へ戻る必要はありません。':'地上1Fの通常脱出口。');
  layout.authoredContainers.forEach((c,i)=>{
   const grade=grades[c.tier]||grades.standard;
   push('loot','物資 '+String(i+1).padStart(2,'0'),c,grade.color,
    grade.name+'／'+layout.themeAt(c)+'。公開等級のみ。中身は抽選前に表示しません。');
  });
  layout.guardPosts.forEach((g,i)=>{
   push('guard','警備 '+String(i+1).padStart(2,'0'),g,g.alarmOnly?'#dfa263':'#ec7773',
    '種別：'+({normal:'通常',fast:'高速',heavy:'重装'}[g.kind]||g.kind)+
    '／'+layout.themeAt(g)+(g.alarmOnly?'。警報後に出現する待機ポスト':'。出撃前の配置。巡回中の現在地ではありません')+
    (g.authoredPatrol?'。赤点線はこの警備兵のTiled巡回予定経路です。':''));
  });
  if(!layout.isBasement){
   push('key','地下保管庫の鍵',layout.basementKey,'#ffd88b',
    '地上で拾う地下B1の鍵。抽選や課金は不要です。');
   push('portal','地下B1への入口',layout.basementEntrance,'#7bdac8',
    '鍵を使って入る片道階段。入場時、残り時間+120秒。');
   push('key','最上位金庫カードキー',layout.vaultKeycard,'#9beaf4',
    '地上の最上位金庫を開ける専用カードキー。');
   push('gate','最上位金庫の扉',layout.vaultGate,'#caa7df',
    'カードキーで開く片道金庫。入場後は封鎖されます。');
   push('hatch','金庫の非常ハッチ',layout.vaultHatch,'#b2eaf2',
    '最上位金庫からの非常脱出。警報時には別の帰還ルートへ。');
  }
  return markers;
 }
 function buildBitmap(f){
  if(f.bitmap)return f.bitmap;
  const layout=f.layout;
  // Full-size offscreen raster: exactly the game's simplified drawScene,
  // not a hand-drawn overview or a second collision implementation.
  const buffer=document.createElement('canvas');
  buffer.width=layout.w;buffer.height=layout.h;
  const off=buffer.getContext('2d',{alpha:false});
  if(!off)throw Error('地形描画Canvasを作成できません');
  layout.drawScene(off,0,0);
  f.bitmap=buffer;
  return buffer;
 }
 function visibleMarkers(){
  const markers=inFloor().markers||[];
  return markers.filter(m=>
   m.kind==='loot'?state.overlays.loot:m.kind==='guard'?state.overlays.guards:true);
 }
 function roomOutlines(layout){
  const camera=state.camera;
  ctx.save();
  for(const z of layout.themeZones){
   const x=camera.x+z.x*camera.scale,y=camera.y+z.y*camera.scale;
   const w=z.w*camera.scale,h=z.h*camera.scale;
   if(x>state.width||y>state.height||x+w<0||y+h<0)continue;
   ctx.strokeStyle='rgba(177,216,191,.50)';ctx.lineWidth=1;
   ctx.setLineDash([5,5]);ctx.strokeRect(x,y,w,h);ctx.setLineDash([]);
   if(w>=85&&h>=36){
    const fontSize=clamp(w/11,10,13);
    ctx.font='bold '+fontSize+'px system-ui';ctx.textAlign='center';
    ctx.lineWidth=3;ctx.strokeStyle='#122020';ctx.strokeText(z.name,x+w/2,y+h/2);
    ctx.fillStyle='#e7eadc';ctx.fillText(z.name,x+w/2,y+h/2);
   }
  }
  ctx.restore();
 }
 // Only draw canonical, Tiled-authored B1 patrol circuits. Surface routes
 // may be chosen per raid ID, so never present a single predicted circuit there.
 function drawGuardRoutes(layout){
  if(!state.overlays.guards||!layout.isBasement)return;
  ctx.save();
  ctx.lineWidth=2;ctx.strokeStyle='rgba(255,151,117,.88)';
  ctx.setLineDash([6,6]);
  for(const guard of layout.guardPosts){
   if(!guard.authoredPatrol||!Array.isArray(guard.route)||guard.route.length<2)continue;
   ctx.beginPath();
   guard.route.forEach((point,i)=>{
    const p=math.screenAt(state.camera,point.x,point.y);
    if(i===0)ctx.moveTo(p.x,p.y);
    else ctx.lineTo(p.x,p.y);
   });
   ctx.closePath();ctx.stroke();
  }
  ctx.restore();
 }
 function drawMarker(m){
  const pos=math.screenAt(state.camera,m.x,m.y);
  if(pos.x< -35||pos.y< -35||pos.x>state.width+35||pos.y>state.height+35)return;
  const chosen=state.selected&&state.selected.kind===m.kind&&
   state.selected.x===m.x&&state.selected.y===m.y;
  const radius=m.kind==='loot'?9:m.kind==='guard'?10:12;
  ctx.beginPath();ctx.arc(pos.x,pos.y,radius,0,Math.PI*2);
  ctx.fillStyle='#101e20';ctx.fill();
  ctx.lineWidth=3;ctx.strokeStyle=m.color;ctx.stroke();
  ctx.fillStyle=m.color;ctx.beginPath();ctx.arc(pos.x,pos.y,3,0,Math.PI*2);ctx.fill();
  if(['exit','start','key','portal','gate','hatch'].includes(m.kind)){
   const mark={exit:'E',start:'S',key:'K',portal:'B1',gate:'V',hatch:'H'}[m.kind];
   ctx.fillStyle='#ffffff';ctx.font='bold 9px system-ui';ctx.textAlign='center';
   ctx.fillText(mark,pos.x,pos.y-15);
  }
  if(chosen){
   ctx.beginPath();ctx.arc(pos.x,pos.y,radius+5,0,Math.PI*2);
   ctx.lineWidth=2;ctx.strokeStyle='#f7f2df';ctx.stroke();
  }
 }
 function render(){
  frame=0;
  const floor=inFloor();
  if(!floor.layout||!state.camera||!state.width||!state.height)return;
  const dpr=viewScale();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,state.width,state.height);
  ctx.fillStyle='#0c1416';ctx.fillRect(0,0,state.width,state.height);
  ctx.imageSmoothingEnabled=false;
  const c=state.camera;
  ctx.drawImage(floor.bitmap,c.x,c.y,floor.layout.w*c.scale,floor.layout.h*c.scale);
  if(state.overlays.zones)roomOutlines(floor.layout);
  drawGuardRoutes(floor.layout);
  for(const marker of visibleMarkers())drawMarker(marker);
  zoomText.textContent=Math.round(c.scale/state.fit*100)+'%';
  document.querySelector('[data-action="zoom-out"]').disabled=c.scale<=state.fit*1.001;
  document.querySelector('[data-action="zoom-in"]').disabled=c.scale>=state.fit*15.999;
 }
 function invalidate(){if(!frame)frame=requestAnimationFrame(render)}
 function dimensions(){
  const rect=view.getBoundingClientRect();
  return {width:Math.max(1,rect.width),height:Math.max(1,rect.height)};
 }
 function resize(){
  const oldCamera=state.camera;
  const oldCenter=oldCamera&&math.worldAt(oldCamera,state.width/2,state.height/2);
  const size=dimensions(),dpr=viewScale();
  state.width=size.width;state.height=size.height;
  const nextWidth=Math.round(size.width*dpr),nextHeight=Math.round(size.height*dpr);
  if(canvas.width!==nextWidth)canvas.width=nextWidth;
  if(canvas.height!==nextHeight)canvas.height=nextHeight;
  const layout=inFloor().layout;
  if(layout){
   state.fit=math.fitScale(layout.w,layout.h,state.width,state.height);
   if(oldCenter){
    const scale=clamp(oldCamera.scale,state.fit,state.fit*16);
    state.camera=math.clampCamera({scale,x:state.width/2-oldCenter.x*scale,
     y:state.height/2-oldCenter.y*scale},layout.w,layout.h,state.width,state.height);
   }else state.camera=math.fitCamera(layout.w,layout.h,state.width,state.height);
  }
  invalidate();
 }
 function fit(){
  const layout=inFloor().layout;if(!layout)return;
  state.fit=math.fitScale(layout.w,layout.h,state.width,state.height);
  state.camera=math.fitCamera(layout.w,layout.h,state.width,state.height);
  invalidate();
 }
 function zoomTo(factor,sx=state.width/2,sy=state.height/2){
  const layout=inFloor().layout;
  if(!layout||!state.camera)return;
  state.camera=math.zoomAt(state.camera,state.camera.scale*factor,sx,sy,
   layout.w,layout.h,state.width,state.height,state.fit,state.fit*16);
  invalidate();
 }
 function pan(dx,dy){
  const layout=inFloor().layout;
  if(!layout||!state.camera)return;
  state.camera=math.panBy(state.camera,dx,dy,layout.w,layout.h,state.width,state.height);
  invalidate();
 }
 function floorSwitch(floor){
  const f=floors[floor];if(!f||!f.layout)return;
  try{buildBitmap(f)}catch(error){showStatus('描画失敗：'+error.message);return}
  state.floor=floor;state.selected=null;pointers.clear();tap=null;
  const u=new URL(window.location.href);u.searchParams.set('floor',floor==='basement'?'b1':'1f');
  if(window.history&&window.history.replaceState)window.history.replaceState(null,'',u.pathname+u.search);
  for(const btn of document.querySelectorAll('[data-floor]'))
   btn.setAttribute('aria-pressed',String(btn.dataset.floor===floor));
  for(const btn of document.querySelectorAll('[data-toggle]'))
   btn.setAttribute('aria-pressed',String(state.overlays[btn.dataset.toggle]));
  messages(f.label+'を表示中','地図上の物資・敵・鍵や通路をタップすると位置と属性を確認できます。');
  coords.textContent='監査対象：'+f.label+'／ '+f.layout.w/48+'×'+f.layout.h/48+'タイル';
  state.camera=null;
  resize();
  showStatus(null);
 }
 function inspect(sx,sy){
  const f=inFloor(),layout=f.layout;
  if(!layout||!state.camera)return;
  const p=math.worldAt(state.camera,sx,sy);
  if(p.x<0||p.y<0||p.x>=layout.w||p.y>=layout.h)return;
  const tx=Math.floor(p.x/48),ty=Math.floor(p.y/48);
  const hit=math.nearestMarker(visibleMarkers(),sx,sy,state.camera,24);
  const blocked=layout.solid(p.x,p.y,0);
  const bodyBlocked=layout.solid(p.x,p.y,12);
  state.selected=hit||null;
  messages(hit?hit.name:layout.themeAt(p),
   hit?hit.desc:(blocked?'地形上の壁・障害物・床なし領域です。':
    bodyBlocked?'中心は床ですが、近すぎる壁・遮蔽物があり体の幅では通れません。':'実際の衝突判定で通行可能な床です。'));
  coords.textContent='座標：'+Math.round(p.x)+','+Math.round(p.y)+' px ／ タイル('+tx+','+ty+
   ') ／ '+layout.themeAt(p)+' ／ '+(blocked?'通行不可':bodyBlocked?'体の幅に注意':'通行可能');
  invalidate();
 }
 function relative(x,y){
  const rect=canvas.getBoundingClientRect();
  return {x:x-rect.left,y:y-rect.top};
 }
 function pointDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
 function pairOf(pointerMap){return Array.from(pointerMap.values()).slice(0,2)}
 canvas.addEventListener('pointerdown',event=>{
  if(!inFloor().layout)return;
  event.preventDefault();
  const pos=relative(event.clientX,event.clientY);
  pointers.set(event.pointerId,pos);
  if(canvas.setPointerCapture)canvas.setPointerCapture(event.pointerId);
  if(pointers.size===1)tap={id:event.pointerId,at:pos,moved:false};
  else tap=null;
 });
 canvas.addEventListener('pointermove',event=>{
  if(!pointers.has(event.pointerId))return;
  event.preventDefault();
  const old=pointers.get(event.pointerId),pos=relative(event.clientX,event.clientY);
  const before=pairOf(pointers);
  pointers.set(event.pointerId,pos);
  const after=pairOf(pointers);
  if(tap&&tap.id===event.pointerId&&pointDistance(tap.at,pos)>7)tap.moved=true;
  if(pointers.size===1){pan(pos.x-old.x,pos.y-old.y);return}
  if(pointers.size===2){
   const oldCenter={x:(before[0].x+before[1].x)/2,y:(before[0].y+before[1].y)/2};
   const nowCenter={x:(after[0].x+after[1].x)/2,y:(after[0].y+after[1].y)/2};
   pan(nowCenter.x-oldCenter.x,nowCenter.y-oldCenter.y);
   const previousDist=pointDistance(before[0],before[1]),nextDist=pointDistance(after[0],after[1]);
   if(previousDist>4&&nextDist>4)zoomTo(nextDist/previousDist,nowCenter.x,nowCenter.y);
  }
 });
 function finishPointer(event,cancelled=false){
  if(!pointers.has(event.pointerId))return;
  const pos=relative(event.clientX,event.clientY);
  if(!cancelled&&tap&&tap.id===event.pointerId&&!tap.moved&&pointDistance(tap.at,pos)<=7)
   inspect(pos.x,pos.y);
  pointers.delete(event.pointerId);
  if(tap?.id===event.pointerId)tap=null;
  if(canvas.hasPointerCapture&&canvas.hasPointerCapture(event.pointerId))
   canvas.releasePointerCapture(event.pointerId);
 }
 canvas.addEventListener('pointerup',event=>finishPointer(event));
 canvas.addEventListener('pointercancel',event=>finishPointer(event,true));
 canvas.addEventListener('lostpointercapture',event=>{pointers.delete(event.pointerId);tap=null});
 canvas.addEventListener('wheel',event=>{
  if(!inFloor().layout)return;
  event.preventDefault();
  const p=relative(event.clientX,event.clientY);
  zoomTo(Math.exp(-clamp(event.deltaY,-240,240)*.002),p.x,p.y);
 },{passive:false});
 canvas.addEventListener('contextmenu',event=>event.preventDefault());
 document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.floor){floorSwitch(button.dataset.floor);return}
  if(button.dataset.action){
   if(button.dataset.action==='fit')fit();
   if(button.dataset.action==='zoom-in')zoomTo(1.5);
   if(button.dataset.action==='zoom-out')zoomTo(1/1.5);
   return;
  }
  if(button.dataset.toggle){
   const prop=button.dataset.toggle;
   state.overlays[prop]=!state.overlays[prop];
   button.setAttribute('aria-pressed',String(state.overlays[prop]));
   if(state.selected&&!visibleMarkers().includes(state.selected))state.selected=null;
   invalidate();
  }
 });
 document.addEventListener('keydown',event=>{
  if(event.target.closest('button,a,input,textarea,select'))return;
  if(event.key==='+'||event.key==='='){event.preventDefault();zoomTo(1.5)}
  else if(event.key==='-'){event.preventDefault();zoomTo(1/1.5)}
  else if(event.key==='0'){event.preventDefault();fit()}
  else if(event.key.startsWith('Arrow')){
   event.preventDefault();
   const d=72;
   pan(event.key==='ArrowLeft'?d:event.key==='ArrowRight'?-d:0,
    event.key==='ArrowUp'?d:event.key==='ArrowDown'?-d:0);
  }
 });
 window.addEventListener('resize',resize);
 if(typeof ResizeObserver==='function')new ResizeObserver(resize).observe(view);
 // Floor loads are independent. One failed source cannot suppress the other.
 Promise.allSettled([source.load(),source.loadBasement()]).then(results=>{
  for(const [i,key] of ['surface','basement'].entries()){
   const r=results[i];
   if(r.status==='fulfilled'){floors[key].layout=r.value;floors[key].markers=markerGroups(r.value)}
   else floors[key].error=String(r.reason?.message||r.reason||'不明なエラー');
  }
  for(const btn of document.querySelectorAll('[data-floor]')){
   btn.disabled=!floors[btn.dataset.floor]?.layout;
  }
  const desired=floors[state.floor].layout?state.floor:
   floors.surface.layout?'surface':floors.basement.layout?'basement':null;
  if(desired)floorSwitch(desired);
  else showStatus('地形を読み込めませんでした。'+
   [floors.surface.error,floors.basement.error].filter(Boolean).join('／'));
 });
})();
