'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8')),Tiled=require('../maps/indoor/tiled-runtime.js');
const old=read('maps/indoor/indoor-r5.90.tmj'),now=read('maps/indoor/indoor.tmj');
const sheets=[read('maps/indoor/tiles/warehouse.tsj'),read('maps/indoor/tiles/kenney-interior.tsj'),read('maps/indoor/tiles/warehouse-industrial.tsj')];
const a=Tiled.createModel(old,sheets),b=Tiled.createModel(now,sheets);
const inside=(x,y)=>x>=19&&x<=31&&y>=2&&y<=8;
test('R5.91 electrical control room edits only its own original V5 Tiled cells',()=>{
 assert.equal(now.width,48);assert.equal(now.height,38);assert.deepEqual(now.tilesets,old.tilesets);
 const layers=m=>Object.fromEntries(m.layers.filter(l=>l.type==='tilelayer').map(l=>[l.name,l.data]));
 const p=layers(old),q=layers(now),diff={};
 for(const name of Object.keys(p)){
  diff[name]=0;
  for(let y=0;y<38;y++)for(let x=0;x<48;x++){
   const i=y*48+x,v=p[name][i],u=q[name][i];
   if(v!==u){diff[name]++;assert.ok(inside(x,y),'unrelated zone modified '+name+' '+x+','+y)}
   if(inside(x,y)&&name==='Floor'&&v)assert.ok([583,584,585,586,587].includes(u));
   if(inside(x,y)&&(name==='Patina'||name==='Scars')&&v)assert.equal(u,0);
  }
 }
 assert.deepEqual(diff,{Floor:91,Patina:14,Scars:7,Walls:5,Furniture:2,SetDressing:8});
 assert.deepEqual(now.layers.filter(l=>l.type!=='tilelayer'),old.layers.filter(l=>l.type!=='tilelayer'));
});
test('R5.91 does not alter V5 collision, sightlines, all gameplay objects or reachability',()=>{
 for(let y=0;y<38;y++)for(let x=0;x<48;x++){
  for(const r of [0,2,4,6,10,12]){
   const px=(x+.5)*16,py=(y+.5)*16;
   assert.equal(b.solidAt(px,py,r),a.solidAt(px,py,r),'collision '+x+','+y+' radius '+r);
  }
 }
 assert.deepEqual(b.coverRects,a.coverRects);
 assert.deepEqual(Array.from(b.reachable().seen),Array.from(a.reachable().seen));
 for(const t of ['spawn','extract','loot','enemy','keycard','gate','hatch'])
  assert.deepEqual(b.objects(t),a.objects(t));
 for(const [p,q] of [
  [{x:22*16,y:5*16},{x:30*16,y:5*16}],
  [{x:23*16,y:7*16},{x:29*16,y:6*16}],
  [b.spawn,b.extract]
 ])assert.equal(b.lineClear(p,q),a.lineClear(p,q));
});
test('R5.91 paints real industrial tiles in the existing electrical room',()=>{
 const imgs=[{id:'base'},{id:'kenney'},{id:'industrial'}],draws=[];
 const ctx=new Proxy({canvas:{width:624,height:336},drawImage(...xs){draws.push(xs)}},{get(t,k){return k in t?t[k]:(()=>{})}});
 b.draw(ctx,imgs,{x:19*16,y:2*16},3);
 const art=draws.filter(x=>x[0]===imgs[2]);
 assert.ok(art.length>=90);
 assert.ok(art.some(x=>x[2]===0),'real floor');
 assert.ok(art.some(x=>x[2]===16),'real solid metal walls');
 assert.ok(art.some(x=>x[2]===32),'real solid equipment');
});
