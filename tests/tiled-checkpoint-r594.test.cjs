'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8')),Tiled=require('../maps/indoor/tiled-runtime.js');
const old=read('maps/indoor/indoor-r5.93.tmj'),now=read('maps/indoor/indoor.tmj');
const sets=[read('maps/indoor/tiles/warehouse.tsj'),read('maps/indoor/tiles/kenney-interior.tsj'),read('maps/indoor/tiles/warehouse-industrial.tsj')];
const a=Tiled.createModel(old,sets),b=Tiled.createModel(now,sets);
const inside=(x,y)=>x>=33&&x<=46&&y>=2&&y<=16;
test('R5.94 only changes northeast checkpoint tile art, not the escape marker or its authored security equipment',()=>{
 assert.equal(now.width,48);assert.equal(now.height,38);assert.deepEqual(now.tilesets,old.tilesets);
 const p=Object.fromEntries(old.layers.filter(l=>l.type==='tilelayer').map(l=>[l.name,l.data]));
 const q=Object.fromEntries(now.layers.filter(l=>l.type==='tilelayer').map(l=>[l.name,l.data])),diff={};
 for(const n of Object.keys(p)){
  diff[n]=0;
  for(let y=0;y<38;y++)for(let x=0;x<48;x++){
   const k=y*48+x,v=p[n][k],u=q[n][k];
   if(v!==u){diff[n]++;assert.ok(inside(x,y),'outside checkpoint '+n+' '+x+','+y)}
   if(inside(x,y)&&n==='Floor'&&v)assert.ok([583,584,585,586,587].includes(u));
   if(inside(x,y)&&(n==='Patina'||n==='Scars')&&v)assert.equal(u,0);
  }
 }
 assert.deepEqual(diff,{Floor:195,Patina:25,Scars:23,Walls:69,Furniture:7,SetDressing:17});
 assert.deepEqual(now.layers.filter(l=>l.type!=='tilelayer'),old.layers.filter(l=>l.type!=='tilelayer'));
 assert.ok(b.objects('theme-prop').some(o=>b.prop(o,'detail')==='scan'&&b.prop(o,'style')==='checkpoint'));
});
test('R5.94 preserves all movement, sight lines, enemy and escape reachability',()=>{
 for(let y=0;y<38;y++)for(let x=0;x<48;x++){
  const px=(x+.5)*16,py=(y+.5)*16;
  for(const r of [0,2,4,6,10,12])
   assert.equal(b.solidAt(px,py,r),a.solidAt(px,py,r),'collision '+x+','+y+' r='+r);
 }
 assert.deepEqual(b.coverRects,a.coverRects);
 assert.deepEqual(Array.from(b.reachable().seen),Array.from(a.reachable().seen));
 for(const t of ['spawn','extract','loot','enemy','keycard','gate','hatch'])
  assert.deepEqual(b.objects(t),a.objects(t));
 for(const [p,q] of [
  [{x:38*16,y:11*16},{x:44*16,y:11*16}],
  [{x:39*16,y:4*16},{x:44*16,y:4*16}],
  [b.spawn,b.extract]
 ])assert.equal(b.lineClear(p,q),a.lineClear(p,q));
 assert.equal(b.extract.x,a.extract.x);assert.equal(b.extract.y,a.extract.y);
});
test('R5.94 draws actual industrial checkpoint floor, steel walls and equipment',()=>{
 const imgs=[{id:'base'},{id:'kenney'},{id:'industrial'}],draws=[];
 const ctx=new Proxy({canvas:{width:672,height:720},drawImage(...xs){draws.push(xs)}},{get(t,k){return k in t?t[k]:(()=>{})}});
 b.draw(ctx,imgs,{x:33*16,y:2*16},3);
 const art=draws.filter(x=>x[0]===imgs[2]);
 assert.ok(art.length>=195);
 assert.ok(art.some(x=>x[2]===0));
 assert.ok(art.some(x=>x[2]===16));
 assert.ok(art.some(x=>x[2]===32));
});
