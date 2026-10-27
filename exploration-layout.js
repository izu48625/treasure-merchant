/* R5.12: optional 2000x1600 mall. Existing R5.11 saves use the legacy layout. */
(function(root){
'use strict';
const columns=[60,465,1160,1565],rowsY=[75,385,1000,1310],ws=[375,375,375,375],hs=[275,275,240,240];
const names=[
['スポーツ用品店','sports'],['衣料品店','market'],['日用品店','market'],['宝飾店','jewelry'],
['ホームセンター','hardware'],['ドラッグストア','clinic'],['書店','market'],['電器店','appliance'],
['飲食店','food'],['事務室','office'],['工具倉庫','hardware'],['宝石保管室','jewelry'],
['厨房','food'],['従業員室','office'],['資材倉庫','storage'],['旧金庫室','jewelry']
];
const rooms=[],walls=[],positions=[],t=12,door=76;
function addWall(x,y,w,h){walls.push({x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)})}
for(let r=0;r<4;r++)for(let c=0;c<4;c++){
 const x=columns[c],y=rowsY[r],w=ws[c],h=hs[r],idx=r*4+c,mid=x+w/2;
 const id='m'+String(idx+1).padStart(2,'0');
 rooms.push({id,name:names[idx][0],theme:names[idx][1],x,y,w,h});
 addWall(x,y,t,h);addWall(x+w-t,y,t,h);
 if(r<2){
  addWall(x,y,w,t);
  addWall(x,y+h-t,(w-door)/2,t);addWall(mid+door/2,y+h-t,(w-door)/2,t);
 }else{
  addWall(x,y,(w-door)/2,t);addWall(mid+door/2,y,(w-door)/2,t);
  addWall(x,y+h-t,w,t);
 }
 for(const [u,v] of [[.22,.29],[.74,.29],[.22,.72],[.74,.72]]){
  positions.push({id:id+'-'+positions.length,x:Math.round(x+w*u),y:Math.round(y+h*v),room:id,theme:names[idx][1]});
 }
}
const types=Object.freeze({
 shelf:{name:'商品棚',count:14,candidates:20,min:1,max:2},
 locker:{name:'ロッカー',count:10,candidates:13,min:2,max:3},
 crate:{name:'資材箱',count:8,candidates:11,min:1,max:3},
 register:{name:'レジ・引き出し',count:5,candidates:7,min:1,max:2},
 wood:{name:'木製宝箱',count:4,candidates:5,min:2,max:3},
 iron:{name:'鉄製宝箱',count:2,candidates:2,min:2,max:3},
 safe:{name:'金庫',count:2,candidates:2,min:1,max:2}
});
const assigned=Object.entries(types).flatMap(([kind,v])=>Array(v.candidates).fill(kind));
const candidates=positions.slice(0,60).map((p,i)=>({...p,kind:assigned[i]}));
function rollContainers(random=Math.random){
 const result=[];
 for(const [kind,settings] of Object.entries(types)){
  const pool=candidates.filter(x=>x.kind===kind);
  for(let i=0;i<settings.count;i++){
   const j=i+Math.min(pool.length-i-1,Math.floor(random()*(pool.length-i)));
   [pool[i],pool[j]]=[pool[j],pool[i]];
   const c=pool[i];
   result.push({id:c.id,x:c.x,y:c.y,room:c.room,theme:c.theme,kind,contents:[],opened:false});
  }
 }
 return result;
}
function validContainers(items,isValidReward){
 if(!Array.isArray(items)||items.length!==45)return false;
 const seen=new Set(),counts={};
 for(const c of items){
  const spec=types[c?.kind],base=candidates.find(x=>x.id===c?.id);
  if(!spec||!base||c.kind!==base.kind||c.x!==base.x||c.y!==base.y||
    seen.has(c.id)||!Array.isArray(c.contents)||c.contents.length>spec.max||
    typeof c.opened!=='boolean'||!c.contents.every(isValidReward))return false;
  seen.add(c.id);counts[c.kind]=(counts[c.kind]||0)+1;
 }
 return Object.entries(types).every(([kind,spec])=>counts[kind]===spec.count);
}
const api=Object.freeze({w:2000,h:1600,start:{x:1000,y:820},exit:{x:1000,y:820},
 rooms:Object.freeze(rooms),walls:Object.freeze(walls),candidates:Object.freeze(candidates),
 types,rollContainers,validContainers});
root.TreasureMallLayout=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
