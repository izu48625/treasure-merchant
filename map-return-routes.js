/* R6.16: audit-only B1 escape routes derived from real V5 collision. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.TreasureReturnRoutes=api;
})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 const TILE=48;
 function plan(layout){
  if(!layout||!layout.isBasement||typeof layout.solid!=='function')return null;
  const cols=Math.round(layout.w/TILE),rows=Math.round(layout.h/TILE);
  if(cols<2||rows<2||cols*rows>20000)return null;
  const source=(layout.authoredContainers||[]).filter(c=>c.tier==='ultra').sort((a,b)=>b.y-a.y)[0];
  const exit=layout.fixedExit;
  if(!source||!exit)return null;
  const id=(x,y)=>y*cols+x;
  const cell=p=>{
   if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return -1;
   const x=Math.floor(p.x/TILE),y=Math.floor(p.y/TILE);
   return x<0||x>=cols||y<0||y>=rows?-1:id(x,y);
  };
  const start=cell(source),target=cell(exit);
  if(start<0||target<0)return null;
  const passable=new Uint8Array(cols*rows);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)
   passable[id(x,y)]=layout.solid((x+.5)*TILE,(y+.5)*TILE,12)?0:1;
  if(!passable[start]||!passable[target])return null;
  function find(key,label,color,closedGate,requiredGate){
   const closed=new Set(closedGate.map(([x,y])=>id(x,y)));
   const prev=new Int32Array(cols*rows);prev.fill(-1);
   const queue=new Int32Array(cols*rows);
   let front=0,back=1;queue[0]=start;prev[start]=start;
   while(front<back&&prev[target]<0){
    const current=queue[front++],x=current%cols,y=Math.floor(current/cols);
    const next=[x>0?current-1:-1,x<cols-1?current+1:-1,
     y>0?current-cols:-1,y<rows-1?current+cols:-1];
    for(const n of next)if(n>=0&&passable[n]&&!closed.has(n)&&prev[n]<0){
     prev[n]=current;queue[back++]=n;
    }
   }
   if(prev[target]<0)return null;
   const route=[];
   for(let i=target;;i=prev[i]){route.push(i);if(i===start)break}
   route.reverse();
   if(!requiredGate.some(([x,y])=>route.includes(id(x,y))))return null;
   return {id:key,label,color,steps:route.length-1,
    points:route.map(i=>({x:((i%cols)+.5)*TILE,y:(Math.floor(i/cols)+.5)*TILE})),
    cells:route.map(i=>({x:i%cols,y:Math.floor(i/cols)}))};
  }
  const central=find('central','中央検問','#ffcf7e',[[22,7],[22,8]],[[22,20],[22,21]]);
  const northern=find('northern','北側迂回','#7bdceb',[[22,20],[22,21]],[[22,7],[22,8]]);
  return {source:{id:source.id,x:source.x,y:source.y},exit:{x:exit.x,y:exit.y},
   complete:!!central&&!!northern,routes:[central,northern].filter(Boolean)};
 }
 // R6.32: On-demand shortest WALKABLE route from a LIVE player tile to the
 // basement exit. This is not a safe route recommendation: it deliberately
 // knows nothing about guards or patrol phases and cannot change the map.
 // Four-connected tile centres match the audit route planner above.
 function planFrom(layout,source){
  if(!layout||!layout.isBasement||typeof layout.solid!=='function'||!source||!layout.fixedExit)return null;
  const cols=Math.round(layout.w/TILE),rows=Math.round(layout.h/TILE);
  if(cols<2||rows<2||cols*rows>20000)return null;
  const valid=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&
   p.x<layout.w&&p.y<layout.h;
  const exit=layout.fixedExit;
  if(!valid(source)||!valid(exit)||layout.solid(source.x,source.y,12))return null;
  const index=(x,y)=>y*cols+x;
  const cell=p=>index(Math.floor(p.x/TILE),Math.floor(p.y/TILE));
  const start=cell(source),target=cell(exit);
  const open=new Uint8Array(cols*rows);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)
   open[index(x,y)]=layout.solid((x+.5)*TILE,(y+.5)*TILE,12)?0:1;
  if(!open[start]||!open[target])return null;
  const prev=new Int32Array(cols*rows).fill(-1);
  const queue=new Int32Array(cols*rows);
  prev[start]=start;queue[0]=start;
  let front=0,back=1;
  while(front<back&&prev[target]<0){
   const current=queue[front++],x=current%cols,y=Math.floor(current/cols);
   for(const next of [x>0?current-1:-1,x<cols-1?current+1:-1,
    y>0?current-cols:-1,y<rows-1?current+cols:-1]){
    if(next<0||!open[next]||prev[next]>=0)continue;
    prev[next]=current;queue[back++]=next;
   }
  }
  if(prev[target]<0)return null;
  const route=[];
  for(let cursor=target;;cursor=prev[cursor]){
   route.push(cursor);
   if(cursor===start)break;
  }
  route.reverse();
  return {source:{x:source.x,y:source.y},exit:{x:exit.x,y:exit.y},
   steps:route.length-1,points:route.map(i=>({
    x:((i%cols)+.5)*TILE,y:(Math.floor(i/cols)+.5)*TILE
   })),cells:route.map(i=>({x:i%cols,y:Math.floor(i/cols)}))};
 }

 // R6.35: read-only B1 patrol-lane proximity audit for the PAUSED map.
 // Count route sample centres near authored sentry circuits (not live guards).
 // This measures spatial overlap, never detection probability or safe passage.
 function auditPatrolProximity(layout,route,radius=120){
  if(!layout?.isBasement||!Array.isArray(layout.guardPosts)||
   !Array.isArray(route?.points)||!route.points.length||
   !Number.isFinite(radius)||radius<0||radius>600)return null;
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  if(!route.points.every(valid))return null;
  const limit=radius*radius;
  const segmentDist=(p,a,b)=>{
   const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
   const t=den>0?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;
   const x=a.x+t*dx,y=a.y+t*dy;
   return (p.x-x)**2+(p.y-y)**2;
  };
  const circuits=layout.guardPosts.filter(post=>!post.alarmOnly&&valid(post)).map(post=>{
   const supplied=Array.isArray(post.route)?post.route.filter(valid):[];
   // Always include the Tiled guard post even if an authored patrol route
   // omits its exact centre, and close the loop back to the start.
   return [post,...supplied];
  });
  const near=(point,circuit)=>{
   for(let i=1;i<circuit.length;i++){
    if(segmentDist(point,circuit[i-1],circuit[i])<=limit)return true;
   }
   if(circuit.length>2&&segmentDist(point,circuit[circuit.length-1],circuit[0])<=limit)return true;
   return segmentDist(point,circuit[0],circuit[0])<=limit;
  };
  let nearPoints=0;
  for(const point of route.points)if(circuits.some(path=>near(point,path)))nearPoints++;
  const nearbyPatrols=circuits.filter(path=>route.points.some(p=>near(p,path))).length;
  return {nearPoints,totalPoints:route.points.length,nearbyPatrols,radius};
 }
 return Object.freeze({plan,planFrom,auditPatrolProximity});
});
