'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8')),Tiled=require('../maps/indoor/tiled-runtime.js');
const old=read('maps/indoor/indoor-r5.92.tmj'),now=read('maps/indoor/indoor-r5.93.tmj');
const sheets=[read('maps/indoor/tiles/warehouse.tsj'),read('maps/indoor/tiles/kenney-interior.tsj'),read('maps/indoor/tiles/warehouse-industrial.tsj')];
const a=Tiled.createModel(old,sheets),b=Tiled.createModel(now,sheets);
const inside=(x,y)=>x>=2&&x<=17&&y>=10&&y<=24;
test('R5.93 alters only existing V5 pharmacy art while retaining its unique medical objects and light',()=>{
 assert.equal(now.width,48);assert.equal(now.height,38);assert.deepEqual(now.tilesets,old.tilesets);
 const p=Object.fromEntries(old.layers.filter(l=>l.type==='tilelayer').map(l=>[l.name,l.data]));
 const q=Object.fromEntries(now.layers.filter(l=>l.type==='tilelayer').map(l=>[l.name,l.data])),diff={};
 for(const name of Object.keys(p)){
  diff[name]=0;
  for(let y=0;y<38;y++)for(let x=0;x<48;x++){
   const i=y*48+x,v=p[name][i],u=q[name][i];
   if(v!==u){diff[name]++;assert.ok(inside(x,y),'outside pharmacy '+name+' '+x+','+y)}
   if(inside(x,y)&&name==='Floor'&&v)assert.ok([583,584,585,586,587].includes(u));
   if(inside(x,y)&&(name==='Patina'||name==='Scars')&&v)assert.equal(u,0);
  }
 }
 assert.deepEqual(diff,{Floor:240,Patina:42,Scars:23,Walls:14,Furniture:12,SetDressing:20});
 assert.deepEqual(now.layers.filter(l=>l.type!=='tilelayer'),old.layers.filter(l=>l.type!=='tilelayer'));
 const props=b.objects('theme-prop');
 assert.ok(props.some(x=>b.prop(x,'style')==='pharmacy'&&b.prop(x,'detail')==='medicine'));
 assert.ok(b.objects('light').some(x=>x.name==='薬局の蛍光灯'));
});
test('R5.93 exact V5 collision, all reachable cells, LOS and pickup/extraction markers are unchanged',()=>{
 for(let y=0;y<38;y++)for(let x=0;x<48;x++){
  for(const r of [0,2,4,6,10,12]){
   const px=(x+.5)*16,py=(y+.5)*16;
   assert.equal(b.solidAt(px,py,r),a.solidAt(px,py,r),'physical change '+x+','+y+' radius '+r);
  }
 }
 assert.deepEqual(b.coverRects,a.coverRects);
 assert.deepEqual(Array.from(b.reachable().seen),Array.from(a.reachable().seen));
 for(const type of ['spawn','extract','loot','enemy','keycard','gate','hatch'])
  assert.deepEqual(b.objects(type),a.objects(type));
 for(const [p,q] of [
  [{x:4*16,y:14*16},{x:15*16,y:14*16}],
  [{x:8*16,y:21*16},{x:16*16,y:23*16}],
  [b.spawn,b.extract]
 ])assert.equal(b.lineClear(p,q),a.lineClear(p,q));
});
test('R5.93 paints original pharmacy floor, walls and solid cabinets using industrial raster',()=>{
 const imgs=[{id:'base'},{id:'kenney'},{id:'industrial'}],calls=[];
 const ctx=new Proxy({canvas:{width:768,height:720},drawImage(...xs){calls.push(xs)}},{get(t,k){return k in t?t[k]:(()=>{})}});
 b.draw(ctx,imgs,{x:2*16,y:10*16},3);
 const art=calls.filter(c=>c[0]===imgs[2]);
 assert.ok(art.length>=240,'industrial tiles must be painted rather than overlay-only');
 assert.ok(art.some(c=>c[2]===0),'industrial floor');
 assert.ok(art.some(c=>c[2]===16),'industrial wall');
 assert.ok(art.some(c=>c[2]===32),'solid industrial cabinets');
});
