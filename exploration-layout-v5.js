/* R5.33: authored Tiled R5.32 indoor map as a production exploration layout.
   Keeps Tiled artwork/data separate from the merchant save and the old V4 map. */
(function(root){
'use strict';
const SCALE=3;
const base='maps/indoor/';
const TYPES=Object.freeze({
 shelf:{name:'物資棚',min:1,max:2},
 locker:{name:'保管ロッカー',min:1,max:3},
 crate:{name:'資材箱',min:1,max:2},
 iron:{name:'鉄製保管箱',min:2,max:3},
 safe:{name:'高級金庫',min:2,max:4}
});
function property(o,name,fallback){const p=(o.properties||[]).find(p=>p.name===name);return p?p.value:fallback}
function createLayout(model,image){
 const w=model.worldWidth*SCALE,h=model.worldHeight*SCALE,tile=model.map.tilewidth;
 const cv=o=>({x:o.x*SCALE,y:o.y*SCALE});
 const start=cv(model.spawn);
 const fixedExit=Object.freeze({id:'indoor-exit-01',...cv(model.extract)});
 // The security key is a guaranteed map pickup rather than random loot.
 // Vault entry is physically locked; its emergency hatch is an alternate,
 // one-way return route that becomes dangerous when triggered.
 const keyObject=model.objects('keycard')[0];
 const gateObject=model.objects('gate')[0];
 const hatchObject=model.objects('hatch')[0];
 const vaultKeycard=keyObject?Object.freeze({id:keyObject.id,name:keyObject.name,...cv(keyObject)}):null;
 const vaultGate=gateObject?Object.freeze({id:gateObject.id,name:gateObject.name,...cv(gateObject),
  key:property(gateObject,'key','vault-key'),tileSize:tile*SCALE}):null;
 const vaultHatch=hatchObject?Object.freeze({id:hatchObject.id,name:hatchObject.name,...cv(hatchObject),
  landing:{x:Number(property(hatchObject,'targetX',hatchObject.x))*SCALE,
   y:Number(property(hatchObject,'targetY',hatchObject.y))*SCALE}}):null;
 const signs=model.objects('sign');
 const themeZones=model.objects('theme-zone').map(o=>Object.freeze({
  name:o.name,style:property(o,'style','warehouse'),x:o.x*SCALE,y:o.y*SCALE,
  w:o.width*SCALE,h:o.height*SCALE
 }));
 const themeZoneAt=p=>themeZones.find(z=>p.x>=z.x&&p.x<z.x+z.w&&p.y>=z.y&&p.y<z.y+z.h);
 const themeAt=p=>themeZoneAt(p)?.name||'共用通路';
 const themeStyleAt=p=>themeZoneAt(p)?.style||'corridor';
 // R5.61: the SAME authored tile-layer geometry is used for pre-raid
 // planning and the in-raid full map. Never draw an alternate schematic.
 // A row-run compression keeps the 48x38 Tiled drawing compact on iPhones.
 function planRuns(name,filter){
  const lyr=model.map.layers.find(l=>l.name===name&&l.type==='tilelayer');
  const out=[];if(!lyr)return out;
  for(let y=0;y<model.map.height;y++){
   let start=-1;
   for(let x=0;x<=model.map.width;x++){
    const value=x<model.map.width?model.get(lyr,x,y):0;
    const filled=!!value&&(!filter||filter(value));
    if(filled&&start===-1)start=x;
    else if(!filled&&start!==-1){
     out.push({x:start*tile*SCALE,y:y*tile*SCALE,w:(x-start)*tile*SCALE,h:tile*SCALE});
     start=-1;
    }
   }
  }
  return out;
 }
 const mapBlueprint=Object.freeze({
  floors:planRuns('Floor'),walls:planRuns('Walls',id=>model.blocked.has(id)),
  fixtures:planRuns('Furniture'),dressing:planRuns('SetDressing'),
  accents:planRuns('Scars'),
  covers:model.coverRects.map(c=>Object.freeze({x:c.x*SCALE,y:c.y*SCALE,w:c.w*SCALE,h:c.h*SCALE,name:c.name})),
  details:model.objects('theme-prop').map(o=>Object.freeze({x:o.x*SCALE,y:o.y*SCALE,
   style:property(o,'style',''),detail:property(o,'detail','')}))
 });
 const roomNames={PHARMACY:'薬局',SECURITY:'警備室',STORAGE:'資材倉庫',RECEIVING:'搬入口',CONTROL:'設備室','VAULT 03':'金庫室','ULTRA VAULT':'最上位金庫室'};
 const rooms=signs.map((o,id)=>({id,name:roomNames[property(o,'caption','')]||o.name||'施設区画',...cv(o)}));
 if(!rooms.length)rooms.push({id:0,name:'屋内施設',...start});
 const roomAt=p=>{
  let best=0,d=Infinity;
  for(let i=0;i<rooms.length;i++){const v=rooms[i],s=(p.x-v.x)**2+(p.y-v.y)**2;if(s<d){d=s;best=i}}
  return best;
 };
 const grade=o=>property(o,'grade','standard');
 const objectKind=o=>{
  const name=o.name||'';
  if(['high','ultra'].includes(grade(o)))return 'safe';
  if(/金庫|鉄/.test(name))return 'iron';
  if(grade(o)==='mid')return 'locker';
  if(/箱|コンテナ/.test(name))return 'crate';
  return 'shelf';
 };
 const themes={medical:'clinic',daily:'storage',office:'office',hardware:'hardware',electronics:'appliance',
  supplies:'storage',tools:'hardware',tech:'appliance',treasure:'jewelry',rare:'jewelry'};
 const authored=model.objects('loot').map(o=>({
  id:'tiled-loot-'+o.id,...cv(o),kind:objectKind(o),
  room:roomAt(cv(o)),theme:themes[property(o,'contents','')]||'storage',tier:grade(o)
 }));
 const byId=new Map(authored.map(o=>[o.id,o]));
 const types={};
 for(const [k,v] of Object.entries(TYPES))
  types[k]={...v,count:authored.filter(a=>a.kind===k).length};
 // Keep movement rays clear for an actor's body, not only a one-pixel sight ray.
 // This prevents direct steering from clipping a shelf at the end of a corridor.
 function bodyLineClear(a,b,radius=4){
  const ax=a.x/SCALE,ay=a.y/SCALE,bx=b.x/SCALE,by=b.y/SCALE;
  const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/4));
  for(let i=0;i<=steps;i++){
   const t=i/steps;
   if(model.solidAt(ax+(bx-ax)*t,ay+(by-ay)*t,radius))return false;
  }
  return true;
 }
 // Tiled-authored checkpoint patrols can deliberately step into side alcoves.
 // Validate all segments against body collision so invalid map edits cannot strand a sentry.
 function patrolFor(o){
  const center=cv(o),raw=String(property(o,'patrolPath',''));
  const path=raw.split(';').map(pair=>{
   const parts=pair.split(',').map(v=>Number(v.trim()));
   return parts.length===2&&parts.every(Number.isFinite)?{x:parts[0]*SCALE,y:parts[1]*SCALE}:null;
  });
  const valid=path.length>=2&&path.every(p=>p&&p.x>24&&p.y>24&&p.x<w-24&&p.y<h-24&&!model.solidAt(p.x/SCALE,p.y/SCALE,7))&&
   path.every((p,i)=>bodyLineClear(p,path[(i+1)%path.length],7));
  if(valid){
   const supplied=String(property(o,'patrolPause','')).split(';').map(v=>Number(v.trim()));
   const pauses=path.map((_,i)=>Number.isFinite(supplied[i])?Math.max(.2,Math.min(4,supplied[i])):1.1);
   return {route:path,pauses};
  }
  const points=[center];
  for(const [dx,dy] of [[-90,0],[90,0],[0,-90],[0,90]]){
   const p={x:center.x+dx,y:center.y+dy};
   if(p.x>24&&p.y>24&&p.x<w-24&&p.y<h-24&&!model.solidAt(p.x/SCALE,p.y/SCALE,7)&&bodyLineClear(center,p,7))points.push(p);
  }
  return {route:points.length>1?[center,points[1],center,...points.slice(2,3)]:[center],pauses:[]};
 }
 const guardPosts=model.objects('enemy').map(o=>{
  const {route,pauses}=patrolFor(o);
  return {
   id:'tiled-guard-'+o.id,...cv(o),
   kind:['normal','fast','heavy'].includes(property(o,'kind','normal'))?property(o,'kind','normal'):'normal',
   zone:roomAt(cv(o)),route,pauses,alarmOnly:property(o,'alarmOnly',false)===true
  };
 });
 // Merge consecutive impassable cells into horizontal spans for the map overlay.
 const walls=[];
 const tileSize=tile*SCALE;
 const cols=model.map.width,rows=model.map.height;
 const passable=new Uint8Array(cols*rows);
 for(let y=0;y<rows;y++){
  let from=-1;
  for(let x=0;x<=cols;x++){
   const blocked=x===cols||model.solidAt((x+.5)*tile,(y+.5)*tile,3);
   if(x<cols)passable[y*cols+x]=blocked?0:1;
   if(blocked&&from>=0){walls.push({x:from*tileSize,y:y*tileSize,w:(x-from)*tileSize,h:tileSize});from=-1}
   if(!blocked&&from<0)from=x;
  }
 }
 function solid(x,y,r=12){return model.solidAt(x/SCALE,y/SCALE,r/SCALE)}
 function lineClear(a,b,lockdown=false,variant='strict'){return bodyLineClear(a,b,4)&&(!lockdown||escapeLineClear(a,b,variant))}
 function visionClear(a,b,lockdown=false,variant='strict'){
  return model.lineClear({x:a.x/SCALE,y:a.y/SCALE},{x:b.x/SCALE,y:b.y/SCALE})&&
   (!lockdown||escapeLineClear(a,b,variant));
 }
 function visionRayDistance(origin,dir,length,lockdown=false,variant='strict'){
  const mag=Math.hypot(dir.x,dir.y)||1;
  const step=9;
  for(let d=step;d<=length+step;d+=step){
   const reach=Math.min(length,d);
   if(solid(origin.x+dir.x/mag*reach,origin.y+dir.y/mag*reach,1)||
    (lockdown&&escapeBarrierSolid(origin.x+dir.x/mag*reach,origin.y+dir.y/mag*reach,1,variant)))return Math.max(0,reach-step);
   if(reach===length)break;
  }
  return length;
 }
 const cellAt=p=>{
  const x=Math.max(0,Math.min(cols-1,Math.floor(p.x/tileSize)));
  const y=Math.max(0,Math.min(rows-1,Math.floor(p.y/tileSize)));
  return y*cols+x;
 };
 const centerOf=i=>({x:((i%cols)+.5)*tileSize,y:((Math.floor(i/cols))+.5)*tileSize});

 // R5.58: two authored evacuation variants are chosen once per raid.
 // STRICT = no branches. COVER = same trunk plus five *dead-end* alcoves.
 // Both seal every bypass to the rest of the facility after hatch use.
 const escapeRouteMask=new Uint8Array(cols*rows);
 const escapeShutterMask=new Uint8Array(cols*rows);
 const escapeCoverRouteMask=new Uint8Array(cols*rows);
 const escapeCoverShutterMask=new Uint8Array(cols*rows);
 const escapeRoute=[],escapeShutters=[],escapeCoverShutters=[],escapeNiches=[],escapeCoverObjects=[],escapeCoverLaneCells=[],escapeLaneObjects=[];
 const neighbors=i=>{
  const x=i%cols,y=Math.floor(i/cols);
  return [x>0?i-1:-1,x<cols-1?i+1:-1,y>0?i-cols:-1,y<rows-1?i+cols:-1].filter(n=>n>=0);
 };
 const maskRects=(mask,out)=>{for(let i=0;i<mask.length;i++)if(mask[i])out.push({
  x:(i%cols)*tileSize,y:Math.floor(i/cols)*tileSize,w:tileSize,h:tileSize
 });};
 if(vaultHatch){
  const from=cellAt(vaultHatch.landing),to=cellAt(fixedExit);
  const previous=new Int32Array(cols*rows);previous.fill(-1);
  const queue=new Int32Array(cols*rows);let head=0,tail=0;
  if(!passable[from]||!passable[to])throw Error('Emergency hatch landing or exit is obstructed');
  queue[tail++]=from;previous[from]=from;
  while(head<tail&&previous[to]<0){
   for(const n of neighbors(queue[head++]))if(passable[n]&&previous[n]<0){
    previous[n]=queue[head-1];queue[tail++]=n;
   }
  }
  if(previous[to]<0)throw Error('Hatch has no walkable route to extraction');
  const reverse=[];
  for(let i=to;;i=previous[i]){reverse.push(i);if(i===from)break;}
  reverse.reverse();
  for(const i of reverse){escapeRouteMask[i]=1;escapeCoverRouteMask[i]=1;escapeRoute.push(centerOf(i));}
  // Tiled tile coordinates. Each alcove touches exactly one trunk tile,
  // is isolated from every other alcove, and never connects to an alternate exit.
  const niches=[[37,25],[37,20],[37,16],[37,12],[37,8]];
  for(const [cx,cy] of niches){
   const id=cy*cols+cx;
   const links=neighbors(id).filter(n=>escapeRouteMask[n]).length;
   if(!passable[id]||links!==1||escapeCoverRouteMask[id])throw Error('Invalid hiding alcove: '+cx+','+cy);
   escapeCoverRouteMask[id]=1;
   const p=centerOf(id);
   escapeNiches.push({...p,cell:id});
   // Small bin stack in the far corner leaves the middle of the alcove
   // accessible to a full-size player (12px body radius). It provides visual
   // cover without physically sealing the only entrance to the hiding nook.
   escapeCoverObjects.push({x:p.x-23,y:p.y-23,w:11,h:23});
  }
  // R5.63: B route adds a 2-tile central lane (x38-39) and
  // 3-tile passing pockets (x38-40). These never join rooms or external
  // bypasses: every non-designated adjacent tile becomes a steel shutter.
  // Route A keeps the original one-tile mask and original 35-cell path.
  const widthCells=[];
  for(let y=10;y<=26;y++)widthCells.push([39,y]);
  for(let y=18;y<=24;y++)widthCells.push([40,y]);
  for(const [x,y] of widthCells){
   const id=y*cols+x;
   if(!passable[id]||escapeRouteMask[id]||escapeCoverRouteMask[id])
    throw Error('B-route widening touches blocked/duplicate terrain: '+x+','+y);
   escapeCoverRouteMask[id]=1;
   escapeCoverLaneCells.push(centerOf(id));
  }
  // Alternating physical steel crates, pallets and barrier racks. Every
  // object is near a cell centre so an adjacent full 48px lane stays free
  // for a 12px-radius character; covers really block enemy sight too.
  const laneObjects=[
   [38,26,'crate'],[39,24,'pallet'],[38,22,'barrier'],
   [40,20,'crate'],[38,18,'pallet'],[39,16,'barrier'],
   [38,14,'crate'],[39,12,'pallet'],[39,10,'barrier']
  ];
  for(const [x,y,kind] of laneObjects){
   const id=y*cols+x;
   if(!escapeCoverRouteMask[id])throw Error('Obstacle outside B route: '+x+','+y);
   const p=centerOf(id);
   const w=kind==='barrier'?22:kind==='pallet'?24:20,h=kind==='barrier'?26:kind==='pallet'?24:27;
   const c={x:p.x-w/2,y:p.y-h/2,w,h,kind,cell:id};
   // Do not block the main hatch landing, fixed exit or guard home.
   if([vaultHatch.landing,fixedExit,...guardPosts.filter(g=>g.alarmOnly)].some(g=>
    g.x+12>c.x&&g.x-12<c.x+c.w&&g.y+12>c.y&&g.y-12<c.y+c.h))
    throw Error('Obstacle intersects spawn/exit: '+x+','+y);
   escapeLaneObjects.push(c);
  }
  for(const id of reverse){
   for(const n of neighbors(id))if(passable[n]&&!escapeRouteMask[n])escapeShutterMask[n]=1;
  }
  for(let i=0;i<escapeCoverRouteMask.length;i++)if(escapeCoverRouteMask[i]){
   for(const n of neighbors(i))if(passable[n]&&!escapeCoverRouteMask[n])escapeCoverShutterMask[n]=1;
  }
  maskRects(escapeShutterMask,escapeShutters);
  maskRects(escapeCoverShutterMask,escapeCoverShutters);
 }
 const coverMode=v=>v==='cover';
 const shutterMask=v=>coverMode(v)?escapeCoverShutterMask:escapeShutterMask;
 const routeMask=v=>coverMode(v)?escapeCoverRouteMask:escapeRouteMask;
 const activeShutters=v=>coverMode(v)?escapeCoverShutters:escapeShutters;
 function escapeShutterSolid(x,y,r=12,variant='strict'){
  const mask=shutterMask(variant);
  const left=Math.max(0,Math.floor((x-r)/tileSize)),right=Math.min(cols-1,Math.floor((x+r)/tileSize));
  const top=Math.max(0,Math.floor((y-r)/tileSize)),bottom=Math.min(rows-1,Math.floor((y+r)/tileSize));
  for(let cy=top;cy<=bottom;cy++)for(let cx=left;cx<=right;cx++)if(mask[cy*cols+cx])return true;
  return false;
 }
 function escapeCoverSolid(x,y,r=12,variant='strict'){
  if(!coverMode(variant))return false;
  return escapeCoverObjects.concat(escapeLaneObjects).some(c=>x+r>c.x&&x-r<c.x+c.w&&y+r>c.y&&y-r<c.y+c.h);
 }
 function escapeBarrierSolid(x,y,r=12,variant='strict'){
  return escapeShutterSolid(x,y,r,variant)||escapeCoverSolid(x,y,r,variant);
 }
 function escapeLineClear(a,b,variant='strict'){
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/5));
  for(let i=0;i<=steps;i++){
   const t=i/steps;
   if(escapeBarrierSolid(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,1,variant))return false;
  }
  return true;
 }
 function nearestEscapePoint(p,r=17,variant='strict'){
  const mask=routeMask(variant);
  if(mask[cellAt(p)]&&!escapeBarrierSolid(p.x,p.y,r,variant)&&!solid(p.x,p.y,r))return {x:p.x,y:p.y};
  let nearest=null,dist=Infinity;
  const candidates=coverMode(variant)?escapeRoute.concat(escapeNiches,escapeCoverLaneCells):escapeRoute;
  for(const point of candidates){
   if(solid(point.x,point.y,r)||escapeBarrierSolid(point.x,point.y,r,variant))continue;
   const d=(point.x-p.x)**2+(point.y-p.y)**2;
   if(d<dist){dist=d;nearest=point;}
  }
  return nearest||{...vaultHatch.landing};
 }
 function drawEscapeShutters(ctx,ox,oy,w,h,variant='strict'){
  for(const b of activeShutters(variant)){
   const x=b.x-ox,y=b.y-oy;
   if(x+b.w<0||y+b.h<0||x>w||y>h)continue;
   ctx.fillStyle='rgba(35,44,52,.96)';ctx.fillRect(x,y,b.w,b.h);
   ctx.strokeStyle='#8e9aa2';ctx.lineWidth=3;ctx.strokeRect(x+3,y+3,b.w-6,b.h-6);
   ctx.strokeStyle='rgba(154,174,185,.6)';ctx.lineWidth=2;
   for(let yy=12;yy<b.h-4;yy+=11){ctx.beginPath();ctx.moveTo(x+5,y+yy);ctx.lineTo(x+b.w-5,y+yy);ctx.stroke();}
   ctx.fillStyle='#da5c4d';ctx.fillRect(x+b.w/2-4,y+5,8,5);
  }
  if(coverMode(variant))for(const c of escapeCoverObjects.concat(escapeLaneObjects)){
   const x=c.x-ox,y=c.y-oy;
   if(x+c.w<0||y+c.h<0||x>w||y>h)continue;
   const palette=c.kind==='pallet'?['#756249','#c7a373','#4c4034']:
    c.kind==='barrier'?['#464d57','#97a7b2','#344151']:['#384a57','#889ba0','#546b73'];
   ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(x+3,y+4,c.w,c.h);
   ctx.fillStyle=palette[0];ctx.fillRect(x,y,c.w,c.h);
   ctx.fillStyle=palette[1];ctx.fillRect(x+2,y+2,c.w-4,Math.min(6,c.h-4));
   ctx.fillStyle=palette[2];ctx.fillRect(x+2,y+11,c.w-4,Math.max(3,c.h-14));
   ctx.strokeStyle=c.kind==='barrier'?'#e4b55a':'#bb9a61';
   ctx.lineWidth=2;ctx.strokeRect(x,y,c.w,c.h);
  }
 }
 function nearestWalkablePoint(point,r=17){
  if(!solid(point.x,point.y,r))return {x:point.x,y:point.y};
  const startCell=cellAt(point),sx=startCell%cols,sy=Math.floor(startCell/cols);
  for(let rad=0;rad<Math.max(cols,rows);rad++){
   let best=null,dist=Infinity;
   for(let dy=-rad;dy<=rad;dy++)for(let dx=-rad;dx<=rad;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dy))!==rad)continue;
    const x=sx+dx,y=sy+dy;if(x<0||x>=cols||y<0||y>=rows)continue;
    const p=centerOf(y*cols+x),d=(p.x-point.x)**2+(p.y-point.y)**2;
    if(d<dist&&!solid(p.x,p.y,r)){dist=d;best=p}
   }
   if(best)return best;
  }
  return {x:start.x,y:start.y};
 }
 const routeCache=new WeakMap();
 function nextWaypoint(actor,target,lockdown=false,variant='strict'){
  const from=cellAt(actor),to=cellAt(target);
  if(from===to)return {x:target.x,y:target.y};
  const now=Date.now(),cached=routeCache.get(actor);
  if(cached&&cached.from===from&&cached.to===to&&cached.lockdown===lockdown&&cached.variant===variant&&now-cached.at<190)return cached.point;
  const seen=new Int32Array(cols*rows);seen.fill(-1);
  const queue=new Int32Array(cols*rows);let head=0,tail=0;
  queue[tail++]=from;seen[from]=from;
  while(head<tail&&seen[to]<0){
   const i=queue[head++],x=i%cols,y=Math.floor(i/cols);
   const next=[x>0?i-1:-1,x<cols-1?i+1:-1,y>0?i-cols:-1,y<rows-1?i+cols:-1];
   for(const n of next)if(n>=0&&seen[n]<0&&passable[n]&&
    (!lockdown||(routeMask(variant)[n]&&
      !escapeCoverSolid(centerOf(n).x,centerOf(n).y,12,variant)))){
    seen[n]=i;queue[tail++]=n;
   }
  }
  if(seen[to]<0)return nearestWalkablePoint(actor,12);
  let step=to;
  while(seen[step]!==from&&seen[step]!==step)step=seen[step];
  const point=centerOf(step);
  routeCache.set(actor,{from,to,lockdown,variant,at:now,point});
  return point;
 }
 function supplyTierForContainer(c){return byId.get(c?.id)?.tier||'standard'}
 function rollContainers(){return authored.map(c=>({...c,contents:[],opened:false}))}
 function validContainers(items,rewardValid){
  if(!Array.isArray(items)||items.length!==authored.length)return false;
  const ids=new Set();
  for(const c of items){
   const original=byId.get(c?.id),type=types[c?.kind];
   if(!original||!type||ids.has(c.id)||c.x!==original.x||c.y!==original.y||
    c.kind!==original.kind||c.room!==original.room||c.tier!==original.tier||
    !Array.isArray(c.contents)||c.contents.length>type.max||
    !c.contents.every(rewardValid)||typeof c.opened!=='boolean')return false;
   ids.add(c.id);
  }
  return true;
 }
 function drawScene(ctx,ox,oy){
  const cam={x:ox/SCALE,y:oy/SCALE};
  model.draw(ctx,image,cam,SCALE);
  model.drawAmbience(ctx,cam,SCALE,false);
 }
 return Object.freeze({
  w,h,start,exit:fixedExit,fixedExit,rooms,areas:rooms,authoredContainers:authored,
  floorRects:[{x:0,y:0,w,h}],walls,fixtures:[],types,
  guardPosts,mapBlueprint,themeZones,themeAt,themeStyleAt,vaultKeycard,vaultGate,vaultHatch,escapeRoute,escapeShutters,escapeCoverShutters,escapeNiches,escapeCoverObjects,escapeCoverLaneCells,escapeLaneObjects,escapeShutterSolid,escapeBarrierSolid,nearestEscapePoint,drawEscapeShutters,rollContainers,validContainers,supplyTierForContainer,
  pickExit:()=>fixedExit,exitById:id=>id===fixedExit.id?fixedExit:null,
  roomAt,solid,lineClear,visionClear,visionRayDistance,
  nextWaypoint,nearestWalkablePoint,drawScene
 });
}
let pending=null;
root.TreasureIndoorLayoutV5={
 load(){
  if(pending)return pending;
  pending=(async()=>{
   if(!root.TreasureTiledMap)throw Error('Tiled runtime not loaded');
   const [m,t]=await Promise.all([
    fetch(base+'indoor.tmj?v=R5.62'),fetch(base+'tiles/warehouse.tsj?v=R5.46')]);
   if(!m.ok||!t.ok)throw Error('Tiled files could not be loaded');
   const model=root.TreasureTiledMap.createModel(await m.json(),await t.json());
   const image=new Image();image.decoding='async';
   const loaded=new Promise((resolve,reject)=>{
    image.onload=resolve;image.onerror=()=>reject(Error('Tiled artwork could not be loaded'));
   });
   image.src=base+'tiles/warehouse.png?v=R5.32';
   // R5.60 is optional art, never an excuse to lose the player's saved raid.
   // Wait for either success or failure before creating the playable layout.
   const atlas=new Image();atlas.decoding='async';
   const atlasLoaded=new Promise(resolve=>{
    atlas.onload=()=>{model.setRoomAtlas(atlas);resolve()};
    atlas.onerror=()=>resolve();
   });
   atlas.src=base+'art/room-details.svg?v=R5.60';
   await Promise.all([loaded,atlasLoaded]);
   return createLayout(model,image);
  })();
  return pending;
 }
};
})(window);
