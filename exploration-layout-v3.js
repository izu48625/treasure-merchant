/* R5.13: single-theme, maze-like 3600x2600 abandoned mall.
 * Authored deterministic rooms, door network, grungy-floor Canvas art.
 * Old R5.12 layout remains in exploration-layout.js for checkpoint recovery.
 */
(function(root){
'use strict';
const cols=[420,420,430,390,440,420,420,420],rows=[395,390,400,395,390,390];
const OFFSET=120,W=3600,H=2600,C=cols.length,R=rows.length;
const rooms=[], walls=[],links=[],candidates=[];
const rng=(seed)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const rand=rng(131301);
const xPos=[OFFSET],yPos=[OFFSET];
for(const w of cols)xPos.push(xPos[xPos.length-1]+w);
for(const h of rows)yPos.push(yPos[yPos.length-1]+h);
for(let y=0;y<R;y++)for(let x=0;x<C;x++){
 const i=y*C+x,rect={x:xPos[x],y:yPos[y],w:cols[x],h:rows[y]};
 rooms.push({...rect,id:'sector-'+String(i+1).padStart(2,'0'),
  name:'封鎖区画 '+String(i+1).padStart(2,'0'),col:x,row:y,
  style:i%4,depth:0});
}
const graph=Array.from({length:rooms.length},()=>[]);
const has=(a,b)=>graph[a].includes(b);
const link=(a,b)=>{if(a===b||has(a,b))return;graph[a].push(b);graph[b].push(a);links.push([a,b])};
const neighbors=i=>{
 const x=i%C,y=Math.floor(i/C),out=[];
 if(x>0)out.push(i-1);if(x<C-1)out.push(i+1);
 if(y>0)out.push(i-C);if(y<R-1)out.push(i+C);
 return out;
};
const START=5*C; // south-west wing
const visited=new Set([START]),stack=[START];
while(stack.length){
 const here=stack[stack.length-1],options=neighbors(here).filter(n=>!visited.has(n));
 if(!options.length){stack.pop();continue}
 const next=options[Math.floor(rand()*options.length)];
 link(here,next);visited.add(next);stack.push(next);
}
function distancesFrom(start){
 const result=Array(rooms.length).fill(-1),q=[start];result[start]=0;
 for(let i=0;i<q.length;i++)for(const n of graph[q[i]])if(result[n]<0){result[n]=result[q[i]]+1;q.push(n)}
 return result;
}
// Short local cross-connections create route choice without erasing the long return.
let ds=distancesFrom(START);
const spare=[];
for(let i=0;i<rooms.length;i++)for(const n of neighbors(i)){
 if(i<n&&!has(i,n)&&Math.abs(ds[i]-ds[n])<=5)spare.push([i,n]);
}
for(let i=spare.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[spare[i],spare[j]]=[spare[j],spare[i]]}
for(const [a,b] of spare.slice(0,7))link(a,b);
ds=distancesFrom(START);
rooms.forEach((r,i)=>{r.depth=ds[i]});
const maxDepth=Math.max(...ds);
function wall(x,y,w,h){
 if(w>=1&&h>=1)walls.push({x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)});
}
const T=15,GAP=112;
for(const r of rooms){
 const x=r.x,y=r.y,w=r.w,h=r.h,i=r.row*C+r.col;
 if(r.col===0)wall(x-T/2,y,T,h);
 if(r.row===0)wall(x,y-T/2,w,T);
 if(r.col===C-1)wall(x+w-T/2,y,T,h);
 else{
  const next=i+1;const midpoint=y+h*(.44+((i*7)%5)*.025);
  if(has(i,next)){
   wall(x+w-T/2,y,T,midpoint-y-GAP/2);
   wall(x+w-T/2,midpoint+GAP/2,T,y+h-midpoint-GAP/2);
  }else wall(x+w-T/2,y,T,h);
 }
 if(r.row===R-1)wall(x,y+h-T/2,w,T);
 else{
  const next=i+C,midpoint=x+w*(.45+((i*11)%5)*.025);
  if(has(i,next)){
   wall(x,y+h-T/2,midpoint-x-GAP/2,T);
   wall(midpoint+GAP/2,y+h-T/2,x+w-midpoint-GAP/2,T);
  }else wall(x,y+h-T/2,w,T);
 }
 for(let j=0;j<3;j++){
  const spots=[[.23,.26],[.76,.34],[.53,.74]];
  const [u,v]=spots[j],p={id:r.id+'-'+j,x:Math.round(x+w*u),y:Math.round(y+h*v),
    room:r.id,theme:'storage',depth:r.depth};
  candidates.push(p);
 }
}
const types=Object.freeze({
 shelf:{name:'陳列棚',count:28,candidates:46,min:1,max:2},
 locker:{name:'ロッカー',count:18,candidates:31,min:2,max:3},
 crate:{name:'資材箱',count:14,candidates:25,min:1,max:3},
 register:{name:'作業台',count:7,candidates:18,min:1,max:2},
 wood:{name:'木製宝箱',count:7,candidates:12,min:2,max:3},
 iron:{name:'鉄製宝箱',count:4,candidates:7,min:2,max:3},
 safe:{name:'金庫',count:2,candidates:5,min:1,max:2}
});
const totalCandidates=Object.values(types).reduce((n,v)=>n+v.candidates,0);
if(totalCandidates!==candidates.length)throw new Error('Container capacity mismatch');
const sorted=candidates.slice().sort((a,b)=>b.depth-a.depth||(a.id<b.id?-1:1));
const assigned=new Map();
let r=0;
for(const [kind,spec] of [['safe',types.safe],['iron',types.iron],['wood',types.wood]]){
 for(let j=0;j<spec.candidates;j++)assigned.set(sorted[r++].id,kind);
}
const rest=Object.entries(types).filter(([k])=>!['safe','iron','wood'].includes(k))
 .flatMap(([k,spec])=>Array(spec.candidates).fill(k));
const others=candidates.filter(p=>!assigned.has(p.id));
const assignRand=rng(17385);
for(let i=rest.length-1;i>0;i--){const j=Math.floor(assignRand()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]]}
others.forEach((c,i)=>assigned.set(c.id,rest[i]));
candidates.forEach(c=>{c.kind=assigned.get(c.id)});
function rollContainers(random=Math.random){
 const result=[];
 for(const [kind,spec] of Object.entries(types)){
  const pool=candidates.filter(c=>c.kind===kind);
  for(let i=0;i<spec.count;i++){
   const j=i+Math.min(pool.length-i-1,Math.floor(random()*(pool.length-i)));
   [pool[i],pool[j]]=[pool[j],pool[i]];
   const p=pool[i];
   result.push({id:p.id,x:p.x,y:p.y,room:p.room,theme:p.theme,kind,contents:[],opened:false});
  }
 }
 return result;
}
const candidateById=new Map(candidates.map(c=>[c.id,c]));
function validContainers(items,rewardValid){
 if(!Array.isArray(items)||items.length!==80)return false;
 const used=new Set(),counts={};
 for(const item of items){
  const base=candidateById.get(item?.id),spec=types[item?.kind];
  if(!base||!spec||used.has(item.id)||base.kind!==item.kind||
    item.x!==base.x||item.y!==base.y||!Array.isArray(item.contents)||
    item.contents.length>spec.max||typeof item.opened!=='boolean'||
    !item.contents.every(rewardValid))return false;
  used.add(item.id);counts[item.kind]=(counts[item.kind]||0)+1;
 }
 return Object.entries(types).every(([k,t])=>counts[k]===t.count);
}
function roomAt(pos){
 for(let i=0;i<rooms.length;i++){
  const r=rooms[i];if(pos.x>=r.x&&pos.x<r.x+r.w&&pos.y>=r.y&&pos.y<r.y+r.h)return i;
 }
 return -1;
}
// Route around partitions: head to an adjacent open doorway instead of walking at a wall.
function nextWaypoint(from,to){
 const a=roomAt(from),b=roomAt(to);
 if(a<0||b<0||a===b||has(a,b)&&Math.hypot(to.x-from.x,to.y-from.y)<210)return to;
 const parents=Array(rooms.length).fill(-1),queue=[b];parents[b]=b;
 for(let i=0;i<queue.length&&parents[a]<0;i++){
  const node=queue[i];for(const n of graph[node])if(parents[n]<0){parents[n]=node;queue.push(n)}
 }
 if(parents[a]<0)return to;
 const next=parents[a],r=rooms[a];
 if(next===a)return to;
 const xNext=next%C,yNext=Math.floor(next/C);
 const x=a%C,y=Math.floor(a/C);
 if(xNext!==x){
  const midpoint=r.y+r.h*(.44+((Math.min(a,next)*7)%5)*.025);
  return {x:xNext>x?r.x+r.w+35:r.x-35,y:midpoint};
 }
 const boundaryTop=Math.min(a,next),topRoom=rooms[boundaryTop];
 const midpoint=topRoom.x+topRoom.w*(.45+((boundaryTop*11)%5)*.025);
 return {x:midpoint,y:yNext>y?r.y+r.h+35:r.y-35};
}
// R5.14: extraction is seeded per sortie at a distant, physically reachable room.
const exitCandidates=Object.freeze(rooms.map(r=>r.depth>=Math.max(12,Math.ceil(maxDepth*.46))?Object.freeze({
 id:r.id,x:Math.round(r.x+r.w*.54),y:Math.round(r.y+r.h*.53),depth:r.depth,roomIndex:r.row*C+r.col
}):null).filter(Boolean));
const exitById=id=>exitCandidates.find(c=>c.id===id)||null;
const pickExit=(random=Math.random)=>exitCandidates[Math.min(exitCandidates.length-1,Math.max(0,Math.floor(random()*exitCandidates.length)))];
const COLORS=['#273430','#2a3733','#2b3934','#29362f'];
function visible(r,ox,oy,w,h){return r.x+r.w>=ox-30&&r.y+r.h>=oy-30&&r.x<=ox+w+30&&r.y<=oy+h+30}
function drawScene(ctx,ox,oy,w,h){
 ctx.fillStyle='#1a2626';ctx.fillRect(0,0,w,h);
 for(const room of rooms){
  if(!visible(room,ox,oy,w,h))continue;
  const x=room.x-ox,y=room.y-oy;
  ctx.fillStyle=COLORS[room.style];ctx.fillRect(x,y,room.w,room.h);
  ctx.strokeStyle='rgba(143,162,143,.12)';ctx.lineWidth=1;
  for(let px=32;px<room.w;px+=48){ctx.beginPath();ctx.moveTo(x+px,y);ctx.lineTo(x+px,y+room.h);ctx.stroke()}
  for(let py=22;py<room.h;py+=48){ctx.beginPath();ctx.moveTo(x,y+py);ctx.lineTo(x+room.w,y+py);ctx.stroke()}
  // Muted maintenance paths and subtle floor wear, deterministic (no per-frame RNG).
  ctx.fillStyle='rgba(139,158,137,.045)';ctx.fillRect(x+room.w*.40,y+15,room.w*.16,room.h-30);
  ctx.strokeStyle='rgba(187,171,127,.19)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x+room.w*.40,y+78);ctx.lineTo(x+room.w*.40,y+room.h-35);
  ctx.moveTo(x+room.w*.56,y+78);ctx.lineTo(x+room.w*.56,y+room.h-35);ctx.stroke();
  for(let k=0;k<6;k++){
   const salt=room.col*57+room.row*83+k*37;
   const px=x+36+salt%(room.w-80),py=y+94+(salt*11)%(room.h-165);
   ctx.fillStyle=k%2?'rgba(9,17,16,.11)':'rgba(141,161,131,.055)';
   ctx.fillRect(px,py,16+k%3*13,7+k%2*8);
   ctx.strokeStyle='rgba(176,172,142,.17)';ctx.lineWidth=1;
   ctx.beginPath();ctx.moveTo(px+1,py+4);ctx.lineTo(px-9,py+10);ctx.lineTo(px-14,py+11);ctx.stroke();
  }
  // Only the deepest wing receives aged restricted-access markings.
  if(room.depth>maxDepth*.7){
   ctx.fillStyle='rgba(132,58,51,.14)';ctx.fillRect(x+room.w*.39,y+room.h*.30,room.w*.18,12);
   ctx.fillStyle='#ac7364';ctx.fillRect(x+room.w*.41,y+room.h*.31,12,7);
   ctx.font='bold 10px system-ui';ctx.fillText('RESTRICTED',x+room.w*.45,y+room.h*.31+8);
  }
  // One repeated architectural kit: steel wall panels, service labels, pallets and scuffed tiles.
  ctx.fillStyle='rgba(0,0,0,.15)';ctx.fillRect(x+28,y+32,room.w-56,26);
  ctx.fillStyle='#657b6b';ctx.fillRect(x+35,y+39,22,12);
  ctx.font='bold 10px system-ui';ctx.fillStyle='#a7baa9';ctx.textAlign='left';
  ctx.fillText('BLOCK '+String(room.col+1).padStart(2,'0')+' / '+String(room.row+1).padStart(2,'0'),x+65,y+49);
  // Stationary surfaces; not walk blockers until detailed collision is approved.
  for(let j=0;j<4;j++){
   const px=x+26+(j%2)*(room.w-84),py=y+88+Math.floor(j/2)*(room.h-145);
   ctx.fillStyle=j%2?'#566556':'#52564b';ctx.fillRect(px,py,43,25);
   ctx.strokeStyle='#829080';ctx.strokeRect(px+.5,py+.5,42,24);
   ctx.strokeStyle='rgba(220,226,184,.18)';ctx.beginPath();
   ctx.moveTo(px+4,py+5);ctx.lineTo(px+37,py+19);ctx.stroke();
  }
  const bx=x+room.w*.45,by=y+room.h*.49;
  ctx.strokeStyle='rgba(213,171,99,.13)';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(bx-30,by-13);ctx.lineTo(bx+18,by+15);ctx.stroke();
  ctx.lineWidth=1;
 }
 for(const b of walls){
  if(b.x+b.w<ox-15||b.x>ox+w+15||b.y+b.h<oy-15||b.y>oy+h+15)continue;
  const x=b.x-ox,y=b.y-oy;
  ctx.fillStyle='#121b1b';ctx.fillRect(x+4,y+5,b.w,b.h);
  ctx.fillStyle='#596c66';ctx.fillRect(x,y,b.w,b.h);
  ctx.fillStyle='#8b9c91';
  if(b.w>=b.h)ctx.fillRect(x,y,b.w,3);
  else ctx.fillRect(x,y,3,b.h);
 }
}
const api=Object.freeze({w:W,h:H,start:{x:rooms[START].x+150,y:rooms[START].y+180},
 exit:{x:rooms[START].x+150,y:rooms[START].y+180},
 rooms:Object.freeze(rooms),walls:Object.freeze(walls),
 exitCandidates,pickExit,exitById,
 candidates:Object.freeze(candidates),types,links:Object.freeze(links),
 maxDepth,graph,roomAt,nextWaypoint,drawScene,rollContainers,validContainers});
root.TreasureMallLayoutV3=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
