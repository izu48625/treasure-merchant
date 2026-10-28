'use strict';
// Deterministic initial sample. Edit indoor.tmj directly in Tiled after creation.
const buildMap=function(){
 const width=48,height=38,tilewidth=16,tileheight=16,N=width*height;
 const props=(o)=>Object.entries(o).map(([name,value])=>({name,type:typeof value==='boolean'?'bool':typeof value==='number'?'int':'string',value}));
 const blank=()=>Array(N).fill(0),floor=blank(),architecture=blank(),debris=blank(),furniture=blank();
 const idx=(x,y)=>y*width+x,set=(layer,x,y,value)=>{if(x>=0&&y>=0&&x<width&&y<height)layer[idx(x,y)]=value};
 const hash=(x,y,seed=0)=>(Math.imul(x+23,2184373)^Math.imul(y+91,1103515245)^Math.imul(seed+17,69069))>>>0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(x<2||x>45||y<2||y>35)continue;
  const rnd=hash(x,y)%100;
  let base=1;
  if(x<=18&&y<=9)base=7;
  else if(x<=18&&y<=25&&y>=10)base=rnd<68?4:5;
  else if(x>=33&&y<=17)base=rnd<65?3:1;
  else if(x>=33&&y>=18)base=rnd<77?6:3;
  else if(y>=26)base=8;
  else base=rnd<40?1:2;
  if(rnd===3||rnd===7)base=9;
  set(floor,x,y,base);
  if(hash(x,y,41)%29===0)set(debris,x,y,18+(hash(x,y,13)%5));
  else if(hash(x,y,44)%23===0)set(debris,x,y,18);
 }
 // Building shell and full-height perimeter. Wall tile IDs are collision.
 function wallH(y,x1,x2,doors=[],variant=10){
  for(let x=x1;x<=x2;x++){
   if(doors.some(([a,b])=>x>=a&&x<=b)){set(debris,x,y,15);continue}
   set(architecture,x,y,variant);
  }
 }
 function wallV(x,y1,y2,doors=[],variant=11){
  for(let y=y1;y<=y2;y++){
   if(doors.some(([a,b])=>y>=a&&y<=b)){set(debris,x,y,15);continue}
   set(architecture,x,y,variant);
  }
 }
 wallH(1,1,46);wallH(36,1,46);wallV(1,1,36);wallV(46,1,36);
 // Distinct room wings. Every high-end room has deliberate doorways.
 wallH(9,2,45,[[9,12],[24,27],[37,40]],13);
 wallH(17,2,18,[[7,10]],10);
 wallH(17,33,45,[[36,39]],13);
 wallH(25,2,18,[[10,13]],10);
 wallH(25,33,45,[[37,40]],10);
 wallV(18,2,35,[[12,14],[21,24],[28,30]],11);
 wallV(32,2,35,[[5,8],[13,16],[22,24],[29,31]],11);
 wallV(27,2,9,[[6,7]],11);
 wallV(10,2,9,[[5,6]],11);
 wallV(39,2,9,[[5,6]],14);
 wallH(30,34,45,[[39,41]],14);
 wallV(25,19,30,[[22,24],[27,28]],11);
 wallH(29,19,31,[[21,23]],14);
 // Windows and hazard stripes are architectural details.
 for(let x=21;x<=24;x++)set(architecture,x,17,12);
 for(let x=5;x<=8;x++)set(architecture,x,17,12);
 for(let x=34;x<=37;x++)set(architecture,x,17,12);
 for(let x=33;x<45;x++)if(x%2===0)set(debris,x,34,17);
 for(let x=2;x<17;x++)if(x%3===0)set(debris,x,35,17);
 // Detailed room props: storage aisles, desks, pharmacy counters and machinery.
 const furnitureSpecs=[
  [5,4,28],[7,4,31],[14,4,27],[15,4,27],[22,5,31],[23,5,31],
  [5,12,24],[5,13,24],[5,14,24],[11,12,24],[11,13,24],[11,14,24],
  [14,20,24],[14,21,24],[5,20,29],[6,20,29],[13,23,27],[13,24,27],
  [21,11,27],[22,11,27],[26,11,31],[29,13,28],[22,15,29],
  [34,4,23],[35,4,23],[34,6,23],[35,6,23],[42,5,30],[43,5,30],
  [35,11,31],[35,12,31],[41,11,28],[42,11,28],[44,13,30],
  [36,20,23],[36,21,23],[36,22,23],[42,20,23],[42,21,23],[42,22,23],
  [35,28,25],[36,28,25],[36,29,25],[43,28,26],[44,29,26],
  [7,28,25],[8,28,25],[9,28,26],[14,30,28],[15,30,28],
  [21,22,25],[22,22,25],[28,22,31],[29,22,31],[28,32,25],
  [22,33,26],[24,34,27],[29,34,25]
 ];
 for(const [x,y,id] of furnitureSpecs)if(architecture[idx(x,y)]===0)set(furniture,x,y,id);
 // Sparse room-specific clutter. Protected gameplay corridors stay uncluttered.
 const regions=[
  ['搬入口',2,26,17,35],['薬局',2,10,17,24],['管理事務所',2,2,17,8],
  ['警備室',19,10,31,16],['整備通路',19,18,31,35],['設備室',19,2,31,8],
  ['保管室',33,10,45,16],['金庫区画',33,2,45,8],['資材倉庫',33,18,45,35]
 ];
 // Markers: map-editable points, never stored as arbitrary positions in JS.
 let nextId=1;
 const marker=(name,type,x,y,extra={})=>({
  id:nextId++,name,type,point:true,rotation:0,visible:true,x:x*tilewidth+8,
  y:y*tileheight+8,width:0,height:0,properties:props(extra)
 });
 const objects=[
  marker('南搬入口','spawn',22,33),
  marker('西側撤収地点','extract',4,33,{holdSeconds:2}),
  marker('薬局の薬品棚','loot',9,16,{grade:'mid',contents:'medical'}),
  marker('薬局レジ','loot',14,22,{grade:'standard',contents:'daily'}),
  marker('事務所の机','loot',14,7,{grade:'standard',contents:'office'}),
  marker('設備室キャビネット','loot',29,6,{grade:'mid',contents:'hardware'}),
  marker('警備端末','loot',29,15,{grade:'mid',contents:'electronics'}),
  marker('西側の資材箱','loot',8,32,{grade:'standard',contents:'supplies'}),
  marker('搬入用コンテナ','loot',28,27,{grade:'standard',contents:'tools'}),
  marker('資材倉庫の箱','loot',40,23,{grade:'mid',contents:'supplies'}),
  marker('資材倉庫の金庫','loot',43,32,{grade:'mid',contents:'tech'}),
  marker('隔離保管の宝箱','loot',43,7,{grade:'high',contents:'treasure'}),
  marker('隔離保管の金庫','loot',37,7,{grade:'high',contents:'rare'}),
  marker('通路巡回兵','enemy',25,20,{kind:'normal',range:115,angle:110}),
  marker('薬局の巡回兵','enemy',15,15,{kind:'fast',range:135,angle:150}),
  marker('警備室の護衛','enemy',25,14,{kind:'normal',range:125,angle:115}),
  marker('北倉庫の警備兵','enemy',42,15,{kind:'heavy',range:110,angle:85}),
  marker('金庫区画の護衛','enemy',42,4,{kind:'heavy',range:115,angle:90}),
  marker('中央通路の巡回兵','enemy',21,29,{kind:'fast',range:135,angle:160}),
  marker('警備ゲート','gate',40,9,{locked:true,key:'security-key'})
 ];
 const layer=(name,data,id)=>({id,name,type:'tilelayer',visible:true,opacity:1,width,height,x:0,y:0,data});
 const group={id:5,name:'Gameplay',type:'objectgroup',draworder:'topdown',opacity:1,visible:true,x:0,y:0,objects};
 const map={type:'map',version:'1.10',tiledversion:'1.11.2',orientation:'orthogonal',renderorder:'right-down',compressionlevel:-1,
  width,height,tilewidth,tileheight,infinite:false,backgroundcolor:'#10151a',
  nextlayerid:6,nextobjectid:nextId,properties:props({title:'夜間物流センター / テスト区画',pilot:true,timeLimit:300,version:'R5.31'}),
  layers:[layer('Floor',floor,1),layer('Scars',debris,2),layer('Walls',architecture,3),layer('Furniture',furniture,4),group],
  tilesets:[{firstgid:1,source:'tiles/warehouse.tsj'}]};
 const tileset={type:'tileset',version:'1.10',tiledversion:'1.11.2',name:'Warehouse Prototype 16',tilewidth:16,tileheight:16,
  image:'warehouse.png',imagewidth:128,imageheight:64,columns:8,tilecount:32,margin:0,spacing:0,
  tiles:[
   ...[9,10,11,12,13].map(id=>({id,properties:props({solid:true})})),
   ...Array.from({length:10},(_,i)=>({id:i+22,properties:props({solid:true})}))
  ]};
 return {map,tileset,summary:{size:[width,height],rooms:regions.map(x=>x[0]),objects:objects.length,spawn:objects[0],exit:objects[1],walls:architecture.filter(Boolean).length,furniture:furniture.filter(Boolean).length}};
};
if(typeof module!=='undefined')module.exports={buildMap};
