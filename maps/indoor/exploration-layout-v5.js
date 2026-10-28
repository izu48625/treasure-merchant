/* R5.33: Tiled-powered V5 layout adapter for the real extraction engine.
 * This file integrates, rather than forks, the existing equipment, combat,
 * saved loot, extraction and fail-state logic in exploration.js.
 * Tiled indoor.tmj is authoritative; build-v5.cjs compiles it for synchronous use.
 */
(function(root){
'use strict';
const compiled=root.TreasureIndoorCompiledV5,engine=root.TreasureTiledMap;
if(!compiled||!engine)return;
const SCALE=2.5,TILE=40;
const model=engine.createModel(compiled.map,compiled.tileset);
const {map,tileset}=compiled,W=map.width*TILE,H=map.height*TILE;
const prop=(o,k,fallback=null)=>model.prop(o,k,fallback);
const fromObject=o=>({x:o.x*SCALE,y:o.y*SCALE});
const start=Object.freeze(fromObject(model.spawn));
const fixedExit=Object.freeze({id:'indoor-exit-01',...fromObject(model.extract)});
const rooms=[
 {id:'office',name:'旧管理事務所',x:2*TILE,y:2*TILE,w:16*TILE,h:7*TILE},
 {id:'pharmacy',name:'荒廃した薬局',x:2*TILE,y:10*TILE,w:16*TILE,h:15*TILE},
 {id:'loading',name:'南荷受け区',x:2*TILE,y:26*TILE,w:16*TILE,h:10*TILE},
 {id:'utility',name:'設備管理室',x:19*TILE,y:2*TILE,w:13*TILE,h:7*TILE},
 {id:'security',name:'中央警備室',x:19*TILE,y:10*TILE,w:13*TILE,h:7*TILE},
 {id:'hall',name:'中央連絡廊下',x:19*TILE,y:18*TILE,w:13*TILE,h:18*TILE},
 {id:'vault',name:'隔離金庫区画',x:33*TILE,y:2*TILE,w:13*TILE,h:7*TILE},
 {id:'storage',name:'東側保管倉庫',x:33*TILE,y:10*TILE,w:13*TILE,h:7*TILE},
 {id:'depot',name:'資材倉庫',x:33*TILE,y:18*TILE,w:13*TILE,h:18*TILE}
].map(Object.freeze);
function roomAt(p){
 const i=rooms.findIndex(r=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h);
 return i>=0?i:Math.min(rooms.length-1,Math.max(0,Math.floor(p.x/W*3)*3+Math.floor(p.y/H*3)));
}
function solid(x,y,r=12){return model.solidAt(x/SCALE,y/SCALE,r/SCALE)}
function inFloor(x,y){return !solid(x,y,0)}
function lineClear(a,b){return model.lineClear({x:a.x/SCALE,y:a.y/SCALE},{x:b.x/SCALE,y:b.y/SCALE})}
const visionClear=lineClear;
function visionRayDistance(from,dir,length){
 // Cast against the exact same tile geometry as actor sight and movement.
 const norm=Math.max(.00001,Math.hypot(dir.x,dir.y)),ux=dir.x/norm,uy=dir.y/norm;
 for(let step=3;step<=length;step+=3){
  if(solid(from.x+ux*step,from.y+uy*step,0))return Math.max(0,step-3);
 }
 return length;
}
const candidates=Object.freeze(model.objects('loot').map(o=>{
 const grade=prop(o,'grade','standard'),kind=grade==='high'?'safe':grade==='mid'?'locker':'shelf';
 const p=fromObject(o);
 return Object.freeze({id:'indoor-cache-'+o.id,room:roomAt(p),theme:
  prop(o,'contents','storage')==='medical'?'clinic':
  prop(o,'contents','storage')==='hardware'?'hardware':
  prop(o,'contents','storage')==='rare'?'jewelry':
  prop(o,'contents','storage')==='electronics'?'appliance':'storage',
  grade,kind,...p});
}));
const counts=Object.fromEntries(['shelf','locker','safe'].map(kind=>[kind,candidates.filter(c=>c.kind===kind).length]));
const types=Object.freeze({
 shelf:Object.freeze({name:'物資棚',count:counts.shelf,min:1,max:2}),
 locker:Object.freeze({name:'補給物資',count:counts.locker,min:1,max:3}),
 safe:Object.freeze({name:'高級金庫',count:counts.safe,min:2,max:3})
});
const guardPosts=Object.freeze(model.objects('enemy').map(o=>{
 const p=fromObject(o);
 return Object.freeze({id:'indoor-guard-'+o.id,zone:roomAt(p),kind:prop(o,'kind','normal'),...p});
}));
function supplyTierForContainer(c){return c?.grade||'standard'}
function rollContainers(){
 // The position and rarity level come from editable Tiled point objects.
 // Rewards are sealed once by createMallContainers() and never re-rolled.
 return candidates.map(c=>({...c,contents:[],opened:false}));
}
const byId=new Map(candidates.map(c=>[c.id,c]));
function validContainers(rows,rewardValid){
 if(!Array.isArray(rows)||rows.length!==candidates.length)return false;
 const ids=new Set();
 return rows.every(c=>{
  const base=byId.get(c?.id),spec=types[c?.kind];
  if(!base||!spec||ids.has(c.id)||c.x!==base.x||c.y!==base.y||
   c.kind!==base.kind||c.grade!==base.grade||
   !Array.isArray(c.contents)||c.contents.length>spec.max||
   typeof c.opened!=='boolean'||!c.contents.every(rewardValid))return false;
  ids.add(c.id);return true;
 });
}
function pickExit(){return fixedExit}
function exitById(id){return id===fixedExit.id?fixedExit:null}
const NC=map.width,NR=map.height,walkCells=new Uint8Array(NC*NR);
for(let y=0;y<NR;y++)for(let x=0;x<NC;x++){
 const px=(x+.5)*TILE,py=(y+.5)*TILE;
 walkCells[y*NC+x]=solid(px,py,17)?0:1;
}
function cellAt(p){return Math.min(NR-1,Math.max(0,Math.floor(p.y/TILE)))*NC+
 Math.min(NC-1,Math.max(0,Math.floor(p.x/TILE)))}
function pointFor(cell){return {x:(cell%NC+.5)*TILE,y:(Math.floor(cell/NC)+.5)*TILE}}
const reachableCells=new Uint8Array(NC*NR),startCell=cellAt(start),flood=[startCell];reachableCells[startCell]=1;
for(let i=0;i<flood.length;i++){
 const c=flood[i],x=c%NC,y=Math.floor(c/NC);
 for(const n of [x?c-1:-1,x<NC-1?c+1:-1,y?c-NC:-1,y<NR-1?c+NC:-1]){
  if(n<0||!walkCells[n]||reachableCells[n])continue;
  reachableCells[n]=1;flood.push(n);
 }
}
function nearestWalkablePoint(p,r=12){
 const i=cellAt(p);
 if(!solid(p.x,p.y,r)&&reachableCells[i])return {x:p.x,y:p.y};
 const col=i%NC,row=Math.floor(i/NC);
 let best=null,min=Infinity;
 for(let dy=-9;dy<=9;dy++)for(let dx=-9;dx<=9;dx++){
  const x=col+dx,y=row+dy,n=y*NC+x;
  if(x<0||y<0||x>=NC||y>=NR||!reachableCells[n])continue;
  const at=pointFor(n),dist=Math.hypot(at.x-p.x,at.y-p.y);
  if(!solid(at.x,at.y,r)&&dist<min){best=at;min=dist}
 }
 return best||{...start};
}
const routeCache=new WeakMap();
function nextWaypoint(actor,to){
 if(lineClear(actor,to))return to;
 const a=cellAt(actor),b=cellAt(to),now=Date.now();
 const old=routeCache.get(actor);
 if(old&&old.to===b&&old.until>now&&old.path.length){
  while(old.path.length>1&&Math.hypot(actor.x-pointFor(old.path[0]).x,actor.y-pointFor(old.path[0]).y)<14)old.path.shift();
  return pointFor(old.path[0]);
 }
 const from=walkCells[a]?a:cellAt(nearestWalkablePoint(actor)),target=walkCells[b]?b:cellAt(nearestWalkablePoint(to));
 const parents=new Int32Array(NC*NR).fill(-1),queue=new Int32Array(NC*NR);
 let head=0,tail=0;queue[tail++]=target;parents[target]=target;
 while(head<tail&&parents[from]===-1){
  const n=queue[head++],x=n%NC,y=Math.floor(n/NC);
  for(const j of [x?n-1:-1,x<NC-1?n+1:-1,y?n-NC:-1,y<NR-1?n+NC:-1]){
   if(j<0||!walkCells[j]||parents[j]>=0)continue;
   parents[j]=n;queue[tail++]=j;
  }
 }
 if(parents[from]<0)return to;
 const path=[];for(let p=from;p!==target&&path.length<NC*NR;p=parents[p])path.push(p);
 path.push(target);if(path.length>1)path.shift();
 routeCache.set(actor,{to:b,path,until:now+650});
 return pointFor(path[0]);
}
// Existing UI and the older wall debug preview can use a coarse rectangle
// for every solid wall tile; the game collision always consults the Tiled TSJ.
const wallRects=[];
const wallLayer=map.layers.find(l=>l.name==='Walls'),furnitureLayer=map.layers.find(l=>l.name==='Furniture');
for(let y=0;y<NR;y++)for(let x=0;x<NC;x++){
 const idx=y*NC+x;
 if(model.blocked.has(wallLayer.data[idx]))wallRects.push(Object.freeze({x:x*TILE,y:y*TILE,w:TILE,h:TILE}));
}
const floorRects=rooms.map(r=>({x:r.x,y:r.y,w:r.w,h:r.h,name:r.name}));
const image=new Image();image.decoding='async';image.src='maps/indoor/tiles/warehouse.png';
function drawScene(ctx,ox,oy,w,h){
 ctx.imageSmoothingEnabled=false;
 if(image.complete&&image.naturalWidth>=128){
  model.draw(ctx,image,{x:ox/SCALE,y:oy/SCALE},SCALE);
  model.drawAmbience(ctx,{x:ox/SCALE,y:oy/SCALE},SCALE,false);
 }else{
  ctx.fillStyle='#242c2d';ctx.fillRect(0,0,w,h);
  for(let y=0;y<NR;y++)for(let x=0;x<NC;x++)if(walkCells[y*NC+x]){
   const px=x*TILE-ox,py=y*TILE-oy;
   if(px+w<TILE||px>=w||py+h<TILE||py>=h)continue;
   ctx.fillStyle='#535f5b';ctx.fillRect(px,py,TILE,TILE);
  }
 }
}
const api=Object.freeze({
 w:W,h:H,rooms:Object.freeze(rooms),areas:Object.freeze(rooms),floorRects:Object.freeze(floorRects),
 walls:Object.freeze(wallRects),fixtures:Object.freeze([]),start,exit:fixedExit,fixedExit,
 exitCandidates:Object.freeze([fixedExit]),pickExit,exitById,types,candidates,
 rollContainers,validContainers,supplyTierForContainer,guardPosts,roomAt,
 solid,inFloor,lineClear,visionClear,visionRayDistance,nextWaypoint,nearestWalkablePoint,
 drawScene,walkCells,gridWidth:NC,gridHeight:NR,model
});
root.TreasureFacilityLayoutV5=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:this);
