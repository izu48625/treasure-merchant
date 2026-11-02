'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8')),Tiled=require('../maps/indoor/tiled-runtime.js');
const old=read('maps/indoor/indoor-r5.94.tmj'),now=read('maps/indoor/indoor-r5.95.tmj');
const sheets=[read('maps/indoor/tiles/warehouse.tsj'),read('maps/indoor/tiles/kenney-interior.tsj'),read('maps/indoor/tiles/warehouse-industrial.tsj')];
const a=Tiled.createModel(old,sheets),b=Tiled.createModel(now,sheets);
const inside=(x,y)=>x>=34&&x<=46&&y>=30&&y<=35;
test('R5.95 modifies only the actual ultra-vault floor and walls while keeping gold objects and alarm objects unchanged',()=>{
 assert.equal(now.width,48);assert.equal(now.height,38);assert.deepEqual(now.tilesets,old.tilesets);
 const p=Object.fromEntries(old.layers.filter(l=>l.type==='tilelayer').map(l=>[l.name,l.data]));
 const q=Object.fromEntries(now.layers.filter(l=>l.type==='tilelayer').map(l=>[l.name,l.data])),diff={};
 for(const name of Object.keys(p)){
  diff[name]=0;
  for(let y=0;y<38;y++)for(let x=0;x<48;x++){
   const i=y*48+x,v=p[name][i],u=q[name][i];
   if(v!==u){diff[name]++;assert.ok(inside(x,y),'outside vault '+name+' '+x+','+y)}
   if(inside(x,y)&&name==='Floor'&&v)assert.ok([583,584,585,586,587].includes(u));
   if(inside(x,y)&&(name==='Patina'||name==='Scars')&&v)assert.equal(u,0);
  }
 }
 assert.deepEqual(diff,{Floor:78,Patina:13,Scars:12,Walls:12,Furniture:0,SetDressing:0});
 assert.deepEqual(now.layers.filter(l=>l.type!=='tilelayer'),old.layers.filter(l=>l.type!=='tilelayer'));
 const props=b.objects('theme-prop');
 assert.ok(props.some(o=>b.prop(o,'style')==='vault'&&b.prop(o,'detail')==='gold'));
 assert.ok(props.some(o=>b.prop(o,'style')==='vault'&&b.prop(o,'detail')==='laser'));
 assert.ok(b.objects('loot').filter(o=>b.prop(o,'grade')==='ultra').length===2);
});
test('R5.95 protects the one-way key gate and hatch, LOS, collision and full pathing invariants',()=>{
 for(let y=0;y<38;y++)for(let x=0;x<48;x++){
  const px=(x+.5)*16,py=(y+.5)*16;
  for(const r of [0,2,4,6,10,12])
   assert.equal(b.solidAt(px,py,r),a.solidAt(px,py,r),'collision '+x+','+y+' radius='+r);
 }
 assert.deepEqual(b.coverRects,a.coverRects);
 assert.deepEqual(Array.from(b.reachable().seen),Array.from(a.reachable().seen));
 for(const t of ['spawn','extract','loot','enemy','keycard','gate','hatch'])
  assert.deepEqual(b.objects(t),a.objects(t));
 assert.equal(b.prop(b.objects('gate')[0],'oneWay'),true);
 assert.equal(b.prop(b.objects('hatch')[0],'oneWay'),true);
 assert.equal(b.prop(b.objects('gate')[0],'key'),'vault-key');
 for(const [p,q] of [
  [{x:36*16,y:34*16},{x:43*16,y:34*16}],
  [{x:40*16,y:31*16},{x:45*16,y:34*16}],
  [b.spawn,b.extract]
 ])assert.equal(b.lineClear(p,q),a.lineClear(p,q));
});
test('R5.95 paints industrial tiles in the actual guarded ultra vault, with no invented furniture',()=>{
 const imgs=[{id:'base'},{id:'kenney'},{id:'industrial'}],calls=[];
 const ctx=new Proxy({canvas:{width:624,height:288},drawImage(...xs){calls.push(xs)}},{get(t,k){return k in t?t[k]:(()=>{})}});
 b.draw(ctx,imgs,{x:34*16,y:30*16},3);
 const art=calls.filter(x=>x[0]===imgs[2]);
 assert.ok(art.length>=78,'rendered Tiled floor is not a cosmetic overlay');
 assert.ok(art.some(x=>x[2]===0),'floor art');
 assert.ok(art.some(x=>x[2]===16),'steel wall art');
});
