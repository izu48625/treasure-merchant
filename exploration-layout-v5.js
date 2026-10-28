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
 const signs=model.objects('sign');
 const roomNames={PHARMACY:'薬局',SECURITY:'警備室',STORAGE:'資材倉庫',RECEIVING:'搬入口',CONTROL:'設備室','VAULT 03':'金庫室'};
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
  if(grade(o)==='high')return 'safe';
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
 const guardPosts=model.objects('enemy').map(o=>({
  id:'tiled-guard-'+o.id,...cv(o),
  kind:['normal','fast','heavy'].includes(property(o,'kind','normal'))?property(o,'kind','normal'):'normal',
  zone:roomAt(cv(o)),
  // Guard posts stay in the existing natural facility; patrol only on clear floor.
  route:(()=>{const center=cv(o),points=[center];for(const [dx,dy] of [[-90,0],[90,0],[0,-90],[0,90]]){const p={x:center.x+dx,y:center.y+dy};if(p.x>24&&p.y>24&&p.x<w-24&&p.y<h-24&&!model.solidAt(p.x/SCALE,p.y/SCALE,7)&&model.lineClear({x:o.x,y:o.y},{x:p.x/SCALE,y:p.y/SCALE}))points.push(p)}return points.length>1?[center,points[1],center,...points.slice(2,3)]:[center]})()
 }));
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
 function lineClear(a,b){
  return model.lineClear({x:a.x/SCALE,y:a.y/SCALE},{x:b.x/SCALE,y:b.y/SCALE});
 }
 function visionRayDistance(origin,dir,length){
  const mag=Math.hypot(dir.x,dir.y)||1;
  const step=9;
  for(let d=step;d<=length+step;d+=step){
   const reach=Math.min(length,d);
   if(solid(origin.x+dir.x/mag*reach,origin.y+dir.y/mag*reach,1))return Math.max(0,reach-step);
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
 function nextWaypoint(actor,target){
  const from=cellAt(actor),to=cellAt(target);
  if(from===to)return {x:target.x,y:target.y};
  const now=Date.now(),cached=routeCache.get(actor);
  if(cached&&cached.from===from&&cached.to===to&&now-cached.at<190)return cached.point;
  const seen=new Int32Array(cols*rows);seen.fill(-1);
  const queue=new Int32Array(cols*rows);let head=0,tail=0;
  queue[tail++]=from;seen[from]=from;
  while(head<tail&&seen[to]<0){
   const i=queue[head++],x=i%cols,y=Math.floor(i/cols);
   const next=[x>0?i-1:-1,x<cols-1?i+1:-1,y>0?i-cols:-1,y<rows-1?i+cols:-1];
   for(const n of next)if(n>=0&&seen[n]<0&&passable[n]){seen[n]=i;queue[tail++]=n}
  }
  if(seen[to]<0)return nearestWalkablePoint(actor,12);
  let step=to;
  while(seen[step]!==from&&seen[step]!==step)step=seen[step];
  const point=centerOf(step);
  routeCache.set(actor,{from,to,at:now,point});
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
  guardPosts,rollContainers,validContainers,supplyTierForContainer,
  pickExit:()=>fixedExit,exitById:id=>id===fixedExit.id?fixedExit:null,
  roomAt,solid,lineClear,visionClear:lineClear,visionRayDistance,
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
    fetch(base+'indoor.tmj?v=R5.46'),fetch(base+'tiles/warehouse.tsj?v=R5.46')]);
   if(!m.ok||!t.ok)throw Error('Tiled files could not be loaded');
   const model=root.TreasureTiledMap.createModel(await m.json(),await t.json());
   const image=new Image();image.decoding='async';
   const loaded=new Promise((resolve,reject)=>{
    image.onload=resolve;image.onerror=()=>reject(Error('Tiled artwork could not be loaded'));
   });
   image.src=base+'tiles/warehouse.png?v=R5.32';
   await loaded;
   return createLayout(model,image);
  })();
  return pending;
 }
};
})(window);
