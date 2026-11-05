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
 return Object.freeze({plan});
});
