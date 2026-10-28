/* R5.17: authored single-world abandoned hypermarket / logistics depot.
 * Irregular overlapping floorplates and service wings, not a grid of rooms.
 * Static plan, repeatable furniture, walkable collision, cover and routed enemies.
 * V2/V3 layouts remain separate so checkpoint coordinates never silently migrate.
 */
(function(root){
'use strict';
const W=3600,H=2600,TILE=40,GW=W/TILE,GH=H/TILE;
const areas=[
 {id:'loading',name:'南搬入口',x:140,y:2100,w:880,h:340,kind:'dock'},
 {id:'southpass',name:'荷捌き通路',x:770,y:1960,w:1510,h:260,kind:'service'},
 {id:'workshop',name:'整備・搬出区',x:1790,y:1960,w:1170,h:420,kind:'work'},
 {id:'west',name:'西サービス棟',x:225,y:1390,w:640,h:790,kind:'service'},
 {id:'hall',name:'中央大型売場',x:680,y:990,w:1720,h:1050,kind:'sales'},
 {id:'admin',name:'旧管理棟',x:220,y:530,w:660,h:980,kind:'office'},
 {id:'utility',name:'旧設備室',x:260,y:220,w:990,h:520,kind:'service'},
 {id:'storage',name:'北側資材倉庫',x:1090,y:330,w:930,h:800,kind:'storage'},
 {id:'north',name:'北物流棟',x:1900,y:210,w:1130,h:810,kind:'storage'},
 {id:'east',name:'東側大型売場',x:2290,y:900,w:1100,h:1050,kind:'sales'},
 {id:'southeast',name:'旧搬送ヤード',x:2740,y:1770,w:590,h:650,kind:'dock'},
 {id:'backlane',name:'東裏通路',x:3150,y:540,w:170,h:430,kind:'service'},
 {id:'bridge',name:'荷運搬渡り廊下',x:1490,y:610,w:1020,h:310,kind:'service'},
 {id:'vault',name:'隔離保管区',x:2960,y:260,w:440,h:520,kind:'storage'}
];
const start=Object.freeze({x:340,y:2270});
const randSeed=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const rng=randSeed(573190);
const inRect=(x,y,r)=>x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h;
const zoneAt=(p)=>{for(let i=areas.length-1;i>=0;i--)if(inRect(p.x,p.y,areas[i]))return i;return -1};
const floor=new Uint8Array(GW*GH);
const inFloor=(x,y)=>{
 if(x<0||y<0||x>=W||y>=H)return false;
 return floor[Math.floor(y/TILE)*GW+Math.floor(x/TILE)]===1;
};
for(let row=0;row<GH;row++)for(let col=0;col<GW;col++){
 const px=col*TILE+TILE/2,py=row*TILE+TILE/2;
 floor[row*GW+col]=areas.some(a=>inRect(px,py,a))?1:0;
}
const walls=[],interiorWalls=[];
function wall(x,y,w,h,inside=false){
 const o={x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)};
 if(o.w<=0||o.h<=0)return;
 walls.push(o);if(inside)interiorWalls.push(o);
}
// Outer shell follows the authored union, merging straight boundary runs.
for(let row=0;row<GH;row++){
 let top=-1,bottom=-1;
 for(let col=0;col<=GW;col++){
  const active=col<GW&&floor[row*GW+col]===1;
  const up=col<GW&&row>0&&floor[(row-1)*GW+col]===1;
  const down=col<GW&&row<GH-1&&floor[(row+1)*GW+col]===1;
  const topOn=active&&!up,bottomOn=active&&!down;
  if(topOn&&top<0)top=col;
  if(!topOn&&top>=0){wall(top*TILE-6,row*TILE-8,(col-top)*TILE+12,16);top=-1}
  if(bottomOn&&bottom<0)bottom=col;
  if(!bottomOn&&bottom>=0){wall(bottom*TILE-6,(row+1)*TILE-8,(col-bottom)*TILE+12,16);bottom=-1}
 }
}
for(let col=0;col<GW;col++){
 let left=-1,right=-1;
 for(let row=0;row<=GH;row++){
  const active=row<GH&&floor[row*GW+col]===1;
  const prev=row<GH&&col>0&&floor[row*GW+col-1]===1;
  const next=row<GH&&col<GW-1&&floor[row*GW+col+1]===1;
  const leftOn=active&&!prev,rightOn=active&&!next;
  if(leftOn&&left<0)left=row;
  if(!leftOn&&left>=0){wall(col*TILE-8,left*TILE-6,16,(row-left)*TILE+12);left=-1}
  if(rightOn&&right<0)right=row;
  if(!rightOn&&right>=0){wall((col+1)*TILE-8,right*TILE-6,16,(row-right)*TILE+12);right=-1}
 }
}
// Internal boundaries: fragmented walls, open double doorways, broken sections.
// Placement is authored rather than a repeated grid of enclosed rooms.
[
 [620,275,16,130],[620,535,16,170],
 [225,1040,235,16],[568,1040,240,16],
 [1040,340,16,260],[1040,730,16,240],
 [1290,390,16,245],[1290,765,16,200],
 [1710,560,235,16],[2050,560,220,16],
 [2075,320,16,300],[2075,735,16,230],
 [2600,260,16,250],[2600,635,16,210],
 [880,1290,330,18],[1365,1290,350,18],
 [1830,1170,16,270],[1830,1550,16,285],
 [1080,1775,435,18],[1655,1775,465,18],
 [2590,1000,18,350],[2590,1490,18,360],
 [2850,1275,360,18],
 [2820,2050,165,18],[3120,2050,170,18],
 [1990,2170,16,85],[1990,2340,16,60],
 [430,1760,220,16],
 [3290,660,16,90]
].forEach(q=>wall(...q,true));
const exitPoints=[
 [2940,390],[3220,590],[2700,590],[2250,410],[1640,470],
 [820,350],[410,860],[400,1550],[2520,1140],[3200,1170],
 [3100,1660],[3130,2260],[2640,2220],[2180,2190],[2840,1880],
 [1200,1180],[1840,1140],[2280,800]
].map((p,i)=>({id:'gate-'+String(i+1).padStart(2,'0'),x:p[0],y:p[1]}));
const nearRect=(x,y,radius,obj)=>x+radius>obj.x&&x-radius<obj.x+obj.w&&y+radius>obj.y&&y-radius<obj.y+obj.h;
function floorFree(x,y,r=14){
 return inFloor(x-r,y-r)&&inFloor(x+r,y-r)&&inFloor(x-r,y+r)&&inFloor(x+r,y+r);
}
function wallFree(x,y,r=14){return !walls.some(o=>nearRect(x,y,r,o))}
function freeOfGeometry(x,y,r=14){return floorFree(x,y,r)&&wallFree(x,y,r)}
// Reproducible furniture, the same materials throughout the facility.
// Each searchable fixture stays visible whether or not it contains loot.
const types=Object.freeze({
 shelf:{name:'陳列棚',count:28,candidates:46,min:1,max:2},
 locker:{name:'ロッカー',count:18,candidates:31,min:2,max:3},
 crate:{name:'資材箱',count:14,candidates:25,min:1,max:3},
 register:{name:'作業台',count:7,candidates:18,min:1,max:2},
 wood:{name:'木製宝箱',count:7,candidates:12,min:2,max:3},
 iron:{name:'鉄製宝箱',count:4,candidates:7,min:2,max:3},
 safe:{name:'金庫',count:2,candidates:5,min:1,max:2}
});
const candidates=[],fixtures=[],count=144;
const posRand=randSeed(998231);
const candidatesKind=Object.entries(types).flatMap(([k,v])=>Array(v.candidates).fill(k));
for(let i=candidatesKind.length-1;i>0;i--){const j=Math.floor(posRand()*(i+1));[candidatesKind[i],candidatesKind[j]]=[candidatesKind[j],candidatesKind[i]]}
// Split placement among organically shaped facility wings, not 48 same-sized rooms.
let attempts=0;
while(candidates.length<count&&attempts++<80000){
 const a=areas[Math.floor(posRand()*areas.length)];
 const x=Math.round((a.x+65+posRand()*(a.w-130))/TILE)*TILE;
 const y=Math.round((a.y+65+posRand()*(a.h-130))/TILE)*TILE;
 if(!freeOfGeometry(x,y,47)||Math.hypot(x-start.x,y-start.y)<180||
  exitPoints.some(p=>Math.hypot(x-p.x,y-p.y)<104)||
  candidates.some(p=>Math.hypot(x-p.x,y-p.y)<124))continue;
 const kind=candidatesKind[candidates.length],dims={
  shelf:[82,30],locker:[39,42],crate:[51,43],register:[71,38],
  wood:[42,33],iron:[43,33],safe:[44,47]
 }[kind];
 const w=dims[0],h=dims[1],id='fixture-'+String(candidates.length+1).padStart(3,'0');
 const prop={id,x:x-w/2,y:y-h/2,w,h,kind};
 fixtures.push(prop);
 candidates.push({id,x,y,room:areas[zoneAt({x,y})]?.id||'facility',theme:'storage',kind});
}
if(candidates.length!==count)throw new Error('Missing fixtures: '+candidates.length);
// Extra non-searchable clutter: barrels, pallets, broken tables, but never cover loot.
const clutter=[];
for(let i=0,tries=0;i<62&&tries<12000;tries++){
 const a=areas[Math.floor(posRand()*areas.length)];
 const x=Math.round(a.x+40+posRand()*(a.w-80)),y=Math.round(a.y+40+posRand()*(a.h-80));
 const w=25+Math.floor(posRand()*35),h=23+Math.floor(posRand()*28);
 if(!freeOfGeometry(x,y,55)||Math.hypot(x-start.x,y-start.y)<150||
  exitPoints.some(p=>Math.hypot(x-p.x,y-p.y)<105)||
  fixtures.some(o=>nearRect(x,y,65,o))||
  clutter.some(o=>nearRect(x,y,70,o)))continue;
 clutter.push({x:x-w/2,y:y-h/2,w,h,kind:i%4?'pallet':'barrel'});i++;
}
const scenery=[...fixtures,...clutter];
const obstacles=[...walls,...scenery];
function solid(x,y,r=12){
 return !floorFree(x,y,r)||obstacles.some(o=>nearRect(x,y,r,o));
}
function lineClear(a,b){
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
 // Trace uncovered floor only at a coarse interval; furniture and walls use
 // exact line-vs-rectangle clipping instead of costly 22px stepped collisions.
 const steps=Math.ceil(len/52);
 for(let i=1;i<steps;i++){
  const t=i/steps;if(!inFloor(a.x+dx*t,a.y+dy*t))return false;
 }
 for(const o of obstacles){
  const left=o.x-17,right=o.x+o.w+17,top=o.y-17,bottom=o.y+o.h+17;
  if(Math.max(a.x,b.x)<left||Math.min(a.x,b.x)>right||
     Math.max(a.y,b.y)<top||Math.min(a.y,b.y)>bottom)continue;
  let near=0,far=1;
  if(Math.abs(dx)<1e-9){if(a.x<left||a.x>right)continue}
  else{
   const p=(left-a.x)/dx,q=(right-a.x)/dx;
   near=Math.max(near,Math.min(p,q));far=Math.min(far,Math.max(p,q));
  }
  if(Math.abs(dy)<1e-9){if(a.y<top||a.y>bottom)continue}
  else{
   const p=(top-a.y)/dy,q=(bottom-a.y)/dy;
   near=Math.max(near,Math.min(p,q));far=Math.min(far,Math.max(p,q));
  }
  if(near<=far&&far>0&&near<1)return false;
 }
 return true;
}

// R5.24: collision-size padding is appropriate for body movement but not sight.
// A 17px expansion made nearby walls/shelves swallow the entire radar wedge.
// Cast against actual obstacle bounds; use the same ray for sight and rendering.
function visionRayDistance(origin,dir,maxRange){
 const length=Math.hypot(dir.x,dir.y);
 if(!Number.isFinite(length)||length<.001||!Number.isFinite(maxRange)||maxRange<=0)return 0;
 const ux=dir.x/length,uy=dir.y/length;
 let reach=maxRange;
 for(const o of obstacles){
  // A tiny optical clearance prevents flicker at the exact edge of a shelf.
  const left=o.x-1,right=o.x+o.w+1,top=o.y-1,bottom=o.y+o.h+1;
  let near=0,far=reach;
  if(Math.abs(ux)<1e-9){if(origin.x<left||origin.x>right)continue}
  else{
   const t1=(left-origin.x)/ux,t2=(right-origin.x)/ux;
   near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));
  }
  if(Math.abs(uy)<1e-9){if(origin.y<top||origin.y>bottom)continue}
  else{
   const t1=(top-origin.y)/uy,t2=(bottom-origin.y)/uy;
   near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));
  }
  if(near<=far&&far>=0&&near<=reach)reach=Math.min(reach,Math.max(0,near));
 }
 // Outer floor boundary is also opaque; regular cells are only 40px wide.
 // Test every 8px so a narrow gap in the facility outline isn't skipped.
 const limit=reach;
 for(let d=0;d<=limit;d+=8){
  if(!inFloor(origin.x+ux*d,origin.y+uy*d))return Math.max(0,d-8);
 }
 if(!inFloor(origin.x+ux*limit,origin.y+uy*limit)){
  let low=Math.max(0,limit-8),high=limit;
  for(let i=0;i<5;i++){
   const mid=(low+high)/2;
   if(inFloor(origin.x+ux*mid,origin.y+uy*mid))low=mid;
   else high=mid;
  }
  return low;
 }
 return reach;
}
function visionClear(a,b){
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
 if(d<.001)return true;
 // Small tolerance for touching a wall endpoint, never through a full wall.
 return visionRayDistance(a,{x:dx,y:dy},d)>=d-1;
}

function pickExit(random=Math.random){
 const r=Math.max(0,Math.min(.999999999,random()));
 return exitPoints[Math.floor(r*exitPoints.length)];
}
function exitById(id){return exitPoints.find(p=>p.id===id)||null}
function rollContainers(random=Math.random){
 const result=[];
 for(const [kind,spec] of Object.entries(types)){
  const pool=candidates.filter(c=>c.kind===kind);
  for(let i=0;i<spec.count;i++){
   const j=i+Math.min(pool.length-i-1,Math.floor(random()*(pool.length-i)));
   [pool[i],pool[j]]=[pool[j],pool[i]];
   const c=pool[i];
   result.push({id:c.id,x:c.x,y:c.y,room:c.room,theme:c.theme,kind,contents:[],opened:false});
  }
 }
 return result;
}
const byId=new Map(candidates.map(x=>[x.id,x]));
function validContainers(rows,rewardValid){
 if(!Array.isArray(rows)||rows.length!==80)return false;
 const seen=new Set(),n={};
 for(const c of rows){
  const base=byId.get(c?.id),spec=types[c?.kind];
  if(!base||!spec||seen.has(c.id)||base.kind!==c.kind||base.x!==c.x||base.y!==c.y||
   !Array.isArray(c.contents)||c.contents.length>spec.max||typeof c.opened!=='boolean'||
   !c.contents.every(rewardValid))return false;
  seen.add(c.id);n[c.kind]=(n[c.kind]||0)+1;
 }
 return Object.entries(types).every(([k,v])=>n[k]===v.count);
}
// Grid navigation routes through halls and around physical furniture.
// Cache enemy plans briefly; keep ray checks and scenery collision identical.
const NAV=40,NC=W/NAV,NR=H/NAV,walkCells=new Uint8Array(NC*NR);
for(let y=0;y<NR;y++)for(let x=0;x<NC;x++)
 walkCells[y*NC+x]=solid(x*NAV+NAV/2,y*NAV+NAV/2,17)?0:1;
function cellAt(p){return Math.min(NR-1,Math.max(0,Math.floor(p.y/NAV)))*NC+
 Math.min(NC-1,Math.max(0,Math.floor(p.x/NAV)))}
function pointFor(cell){return {x:(cell%NC)*NAV+NAV/2,y:Math.floor(cell/NC)*NAV+NAV/2}}
const cache=new WeakMap();
function nextWaypoint(actor,to){
 if(lineClear(actor,to))return to;
 const now=Date.now(),a=cellAt(actor),b=cellAt(to);
 const old=cache.get(actor);
 if(old&&old.goal===b&&old.until>now&&old.path.length){
  while(old.path.length>1&&Math.hypot(actor.x-pointFor(old.path[0]).x,actor.y-pointFor(old.path[0]).y)<27)old.path.shift();
  return pointFor(old.path[0]);
 }
 const parents=new Int32Array(NC*NR).fill(-1),queue=new Int32Array(NC*NR);
 // If an enemy is standing on a grid center adjacent to an obstacle, it can
 // still seek the nearest open grid cell rather than simply freezing.
 if(!walkCells[b])return to;
 let head=0,tail=0;queue[tail++]=b;parents[b]=b;
 while(head<tail&&parents[a]===-1){
  const cur=queue[head++],cx=cur%NC,cy=Math.floor(cur/NC);
  for(const n of [cx?cur-1:-1,cx<NC-1?cur+1:-1,cy?cur-NC:-1,cy<NR-1?cur+NC:-1]){
   if(n<0||!walkCells[n]||parents[n]>=0)continue;
   parents[n]=cur;queue[tail++]=n;
  }
 }
 if(parents[a]<0)return to;
 const path=[];for(let at=a;at!==b&&path.length<NC*NR;at=parents[at])path.push(at);
 path.push(b);
 // Skip the actor's current cell. Visible next nodes guide around obstructions.
 if(path.length>1)path.shift();
 const c={goal:b,until:now+650,path};cache.set(actor,c);
 return pointFor(path[0]);
}
function tileHash(x,y){let k=(Math.imul(x+21,374761393)^Math.imul(y+89,668265263))>>>0;
 k=Math.imul(k^(k>>>13),1274126177);return (k^(k>>>16))>>>0}
function drawScene(ctx,ox,oy,w,h){
 const left=Math.max(0,Math.floor(ox/TILE)),right=Math.min(GW-1,Math.ceil((ox+w)/TILE));
 const top=Math.max(0,Math.floor(oy/TILE)),bottom=Math.min(GH-1,Math.ceil((oy+h)/TILE));
 ctx.fillStyle='#101816';ctx.fillRect(0,0,w,h);
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
  if(!floor[y*GW+x])continue;
  const hsh=tileHash(x,y),px=x*TILE-ox,py=y*TILE-oy,shade=hsh%5;
  const areaIndex=zoneAt({x:x*TILE+20,y:y*TILE+20});
  const kind=areas[areaIndex]?.kind||'service';
  const palettes={
   sales:['#4a5048','#424b43','#485048','#444b43','#4c5149'],
   storage:['#3a403d','#3d423e','#414642','#373f3a','#3e4640'],
   office:['#495148','#4b5549','#434e46','#4b5047','#465148'],
   dock:['#303633','#343c37','#323a35','#353d37','#323a37'],
   work:['#3f433e','#3c413a','#42433d','#3c403d','#444640'],
   service:['#374039','#383d39','#39413b','#384039','#3c423a']
  };
  ctx.fillStyle=palettes[kind][shade];ctx.fillRect(px,py,TILE,TILE);
  // Worn concrete, asphalt and enamel floor tile are visually distinct.
  if(kind==='sales'||kind==='office'){
   ctx.strokeStyle='rgba(17,24,21,.35)';ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,TILE,TILE);
   ctx.fillStyle='rgba(205,204,174,.04)';ctx.fillRect(px+2,py+2,35,4);
  }else if(kind==='dock'){
   if(hsh%13===0){ctx.fillStyle='rgba(11,14,12,.34)';ctx.fillRect(px+3,py+9,31,20)}
   if(y%5===0&&hsh%4<3){ctx.fillStyle='rgba(209,161,67,.4)';ctx.fillRect(px+8,py+18,25,4)}
  }else{
   if(x%4===0&&y%3===0){ctx.strokeStyle='rgba(123,133,121,.11)';ctx.strokeRect(px+1,py+1,38,38)}
  }
  // Deterministic scratches, stains and rubble. No new RNG during drawing.
  if(hsh%7===0){
   ctx.fillStyle='rgba(15,20,17,.22)';ctx.fillRect(px+6+(hsh%17),py+5,12,8);
  }
  if(hsh%11===0){
   ctx.strokeStyle='rgba(8,13,11,.48)';ctx.lineWidth=1;ctx.beginPath();
   ctx.moveTo(px+5,py+2);ctx.lineTo(px+18,py+14);ctx.lineTo(px+11,py+31);ctx.lineTo(px+25,py+36);ctx.stroke();
  }
  if(hsh%17===0){
   ctx.fillStyle='rgba(144,126,98,.25)';ctx.fillRect(px+9,py+23,4,3);
   ctx.fillRect(px+14,py+20,8,2);ctx.fillRect(px+23,py+26,3,5);
  }
  if(hsh%19===0){
   ctx.strokeStyle='rgba(21,27,23,.20)';ctx.lineWidth=5;ctx.beginPath();
   ctx.arc(px+18,py+19,10,0,Math.PI*2);ctx.stroke();
  }
 }
 // A visible arrival landmark: the loading bay actually looks different
 // from the old block maze the moment the player enters the new facility.
 if(start.x+540>=ox&&start.x-180<=ox+w&&start.y+210>=oy&&start.y-220<=oy+h){
  const gx=start.x-ox,gy=start.y-oy;
  ctx.fillStyle='rgba(18,28,24,.30)';ctx.fillRect(gx-132,gy-100,264,195);
  ctx.strokeStyle='#b5a26a';ctx.lineWidth=5;
  for(let k=-120;k<=100;k+=36){
   ctx.beginPath();ctx.moveTo(gx+k,gy+66);ctx.lineTo(gx+k+28,gy+96);ctx.stroke();
  }
  ctx.fillStyle='#b8aa76';ctx.fillRect(gx+70,gy-52,5,96);
  ctx.fillStyle='#28372d';ctx.fillRect(gx+99,gy-90,177,51);
  ctx.strokeStyle='#909a7f';ctx.lineWidth=3;ctx.strokeRect(gx+99,gy-90,177,51);
  ctx.fillStyle='#e6deb9';ctx.font='bold 13px system-ui';ctx.textAlign='left';
  ctx.fillText('搬入口 BAY 01',gx+112,gy-69);
  ctx.font='bold 10px system-ui';ctx.fillStyle='#b9cbb5';
  ctx.fillText('搬送区域 / 立入注意',gx+111,gy-52);
  ctx.strokeStyle='#d2bc77';ctx.lineWidth=4;
  ctx.strokeRect(gx-52,gy-50,102,102);
 }
 // Unified architectural language: worn aisle borders and zone wayfinding.
 for(const area of areas){
  if(area.x+area.w<ox||area.y+area.h<oy||area.x>ox+w||area.y>oy+h)continue;
  ctx.strokeStyle='rgba(200,184,131,.16)';ctx.lineWidth=2;
  if(area.kind==='sales'){
   // Long repainted aisle guides make the hall read as one shopping floor.
   ctx.strokeStyle='rgba(197,172,88,.25)';ctx.lineWidth=5;
   for(let stripe=0;stripe<3;stripe++){
    const x=area.x-ox+160+stripe*Math.min(360,(area.w-260)/3);
    ctx.beginPath();ctx.moveTo(x,area.y-oy+180);ctx.lineTo(x,area.y-oy+area.h-100);ctx.stroke();
   }
  }else if(area.kind==='dock'){
   ctx.strokeStyle='rgba(206,162,82,.40)';ctx.lineWidth=7;
   ctx.beginPath();ctx.moveTo(area.x-ox+100,area.y-oy+92);
   ctx.lineTo(area.x-ox+area.w-100,area.y-oy+92);ctx.stroke();
  }else if(area.kind==='storage'){
   ctx.strokeStyle='rgba(120,147,131,.22)';ctx.lineWidth=4;
   ctx.beginPath();ctx.moveTo(area.x-ox+92,area.y-oy+135);
   ctx.lineTo(area.x-ox+area.w-92,area.y-oy+135);ctx.stroke();
  }
  ctx.fillStyle='#aab6a6';ctx.textAlign='left';ctx.font='bold 13px system-ui';
  ctx.fillText(area.name,area.x-ox+42,area.y-oy+58);
 }
 for(const prop of scenery){
  if(prop.x+prop.w<ox-10||prop.y+prop.h<oy-10||prop.x>ox+w+10||prop.y>oy+h+10)continue;
  const x=prop.x-ox,y=prop.y-oy;
  ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(x+7,y+9,prop.w+2,prop.h+2);
  ctx.fillStyle='rgba(212,214,193,.09)';ctx.fillRect(x+3,y+3,prop.w,prop.h);
  ctx.fillStyle=prop.kind==='shelf'?'#596760':prop.kind==='locker'?'#64706c':
   prop.kind==='iron'?'#697074':prop.kind==='safe'?'#6c6760':
   prop.kind==='wood'||prop.kind==='pallet'?'#655744':'#555b50';
  ctx.fillRect(x,y,prop.w,prop.h);
  ctx.strokeStyle='#899187';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,prop.w-2,prop.h-2);
  ctx.fillStyle='rgba(219,224,194,.13)';ctx.fillRect(x+3,y+3,prop.w-6,4);
  ctx.fillStyle='rgba(20,28,25,.3)';ctx.fillRect(x+3,y+prop.h-7,prop.w-6,4);
  if(prop.kind==='shelf'||prop.kind==='locker'){
   ctx.strokeStyle='#303934';ctx.lineWidth=3;
   for(let j=1;j<=2;j++){ctx.beginPath();ctx.moveTo(x+7,y+prop.h*j/3);ctx.lineTo(x+prop.w-7,y+prop.h*j/3);ctx.stroke()}
  }else if(prop.kind==='crate'||prop.kind==='wood'||prop.kind==='pallet'){
   ctx.strokeStyle='#948a70';ctx.beginPath();ctx.moveTo(x+6,y+5);ctx.lineTo(x+prop.w-6,y+prop.h-5);ctx.moveTo(x+prop.w-6,y+5);ctx.lineTo(x+6,y+prop.h-5);ctx.stroke();
  }else if(prop.kind==='safe'||prop.kind==='iron'){
   ctx.strokeStyle='#b6ad8f';ctx.beginPath();ctx.arc(x+prop.w/2,y+prop.h/2,Math.min(prop.w,prop.h)*.19,0,Math.PI*2);ctx.stroke();
  }
 }
 for(const b of walls){
  if(b.x+b.w<ox-16||b.y+b.h<oy-16||b.x>ox+w+16||b.y>oy+h+16)continue;
  const x=b.x-ox,y=b.y-oy;
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(x+6,y+9,b.w,b.h);
  ctx.fillStyle='#535d56';ctx.fillRect(x,y,b.w,b.h);
  ctx.fillStyle='#8a9386';
  if(b.w>b.h){
   ctx.fillRect(x,y,b.w,3);
   ctx.fillStyle='#29332e';ctx.fillRect(x,y+b.h-4,b.w,4);
   for(let k=24;k<b.w-8;k+=54){ctx.fillStyle='#9b9888';ctx.fillRect(x+k,y+5,4,3)}
  }else{
   ctx.fillRect(x,y,3,b.h);
   ctx.fillStyle='#28342e';ctx.fillRect(x+b.w-4,y,4,b.h);
   for(let k=24;k<b.h-8;k+=54){ctx.fillStyle='#9b9888';ctx.fillRect(x+5,y+k,3,4)}
  }
 }
}
const api=Object.freeze({
 w:W,h:H,rooms:Object.freeze(areas),areas:Object.freeze(areas),floorRects:Object.freeze(areas),
 walls:Object.freeze(walls),interiorWalls:Object.freeze(interiorWalls),fixtures:Object.freeze(fixtures),
 clutter:Object.freeze(clutter),start,exit:start,exitCandidates:Object.freeze(exitPoints),
 pickExit,exitById,candidates:Object.freeze(candidates),types,rollContainers,validContainers,
 roomAt:zoneAt,solid,lineClear,visionClear,visionRayDistance,nextWaypoint,drawScene,inFloor,
 floorData:floor,gridWidth:GW,gridHeight:GH,walkCells
});
root.TreasureFacilityLayoutV4=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
