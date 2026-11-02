'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8')),Tiled=require('../maps/indoor/tiled-runtime.js');
const old=read('maps/indoor/indoor-r5.91.tmj'),now=read('maps/indoor/indoor-r5.92.tmj');
const tiles=[read('maps/indoor/tiles/warehouse.tsj'),read('maps/indoor/tiles/kenney-interior.tsj'),read('maps/indoor/tiles/warehouse-industrial.tsj')];
const a=Tiled.createModel(old,tiles),b=Tiled.createModel(now,tiles);
const inside=(x,y)=>x>=2&&x<=17&&y>=2&&y<=8;
test('R5.92 reskins only the authentic northwest ARCHIVE room',()=>{
 assert.equal(now.width,48);assert.equal(now.height,38);assert.deepEqual(now.tilesets,old.tilesets);
 const p=Object.fromEntries(old.layers.filter(l=>l.type==='tilelayer').map(l=>[l.name,l.data]));
 const q=Object.fromEntries(now.layers.filter(l=>l.type==='tilelayer').map(l=>[l.name,l.data])),diff={};
 for(const name of Object.keys(p)){
  diff[name]=0;
  for(let y=0;y<38;y++)for(let x=0;x<48;x++){
   const i=y*48+x,v=p[name][i],u=q[name][i];
   if(v!==u){diff[name]++;assert.ok(inside(x,y),'unrelated region: '+name+' '+x+','+y)}
   if(inside(x,y)&&name==='Floor'&&v)assert.ok([583,584,585,586,587].includes(u));
   if(inside(x,y)&&(name==='Patina'||name==='Scars')&&v)assert.equal(u,0);
  }
 }
 assert.deepEqual(diff,{Floor:112,Patina:20,Scars:8,Walls:5,Furniture:4,SetDressing:10});
 assert.deepEqual(now.layers.filter(l=>l.type!=='tilelayer'),old.layers.filter(l=>l.type!=='tilelayer'));
});
test('R5.92 keeps all V5 wall/shelf collision, LOS, loot, guards and escape geometry',()=>{
 for(let y=0;y<38;y++)for(let x=0;x<48;x++){
  const px=(x+.5)*16,py=(y+.5)*16;
  for(const r of [0,2,4,6,10,12])
   assert.equal(b.solidAt(px,py,r),a.solidAt(px,py,r),'collision at '+x+','+y+' radius '+r);
 }
 assert.deepEqual(b.coverRects,a.coverRects);
 assert.deepEqual(Array.from(b.reachable().seen),Array.from(a.reachable().seen));
 for(const type of ['spawn','extract','loot','enemy','keycard','gate','hatch'])
  assert.deepEqual(b.objects(type),a.objects(type));
 for(const [p,q] of [
  [{x:5*16,y:5*16},{x:16*16,y:7*16}],
  [{x:4*16,y:6*16},{x:8*16,y:6*16}],
  [b.spawn,b.extract]
 ])assert.equal(b.lineClear(p,q),a.lineClear(p,q));
});
test('R5.92 industrial archive floor, solid metal walls and cabinets are rendered as real tiles',()=>{
 const images=[{id:'original'},{id:'Kenney'},{id:'industrial'}],calls=[];
 const ctx=new Proxy({canvas:{width:768,height:336},drawImage(...xs){calls.push(xs)}},{get(t,k){return k in t?t[k]:(()=>{})}});
 b.draw(ctx,images,{x:2*16,y:2*16},3);
 const art=calls.filter(x=>x[0]===images[2]);
 assert.ok(art.length>=112);
 assert.ok(art.some(x=>x[2]===0),'concrete floor');
 assert.ok(art.some(x=>x[2]===16),'metal walls');
 assert.ok(art.some(x=>x[2]===32),'storage cabinets');
});
