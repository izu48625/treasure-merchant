'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const Tiled=require('../maps/indoor/tiled-runtime.js');
const old=read('maps/indoor/indoor-r5.89.tmj'),now=read('maps/indoor/indoor.tmj');
const sets=[read('maps/indoor/tiles/warehouse.tsj'),read('maps/indoor/tiles/kenney-interior.tsj'),read('maps/indoor/tiles/warehouse-industrial.tsj')];
const before=Tiled.createModel(old,sets),after=Tiled.createModel(now,sets);
const inside=(x,y)=>x>=19&&x<=31&&y>=10&&y<=16,idx=(x,y)=>y*48+x;
test('R5.90 reskins only original V5 SECURITY room without moving story or gameplay objects',()=>{
 assert.equal(now.width,48);assert.equal(now.height,38);
 assert.deepEqual(now.tilesets,old.tilesets);
 const a=old.layers.filter(l=>l.type==='tilelayer'),b=now.layers.filter(l=>l.type==='tilelayer');
 assert.deepEqual(a.map(l=>l.name),b.map(l=>l.name));
 const diff={};
 for(let k=0;k<a.length;k++){
  const name=a[k].name;diff[name]=0;
  for(let y=0;y<38;y++)for(let x=0;x<48;x++){
   const i=idx(x,y),p=a[k].data[i],q=b[k].data[i];
   if(p!==q){diff[name]++;assert.ok(inside(x,y),'out-of-security change '+name+' '+x+','+y)}
   if(inside(x,y)&&name==='Floor'&&p)assert.ok([583,584,585,586,587].includes(q),'security floor must be real industrial tile');
   if(inside(x,y)&&(name==='Patina'||name==='Scars')&&p)assert.equal(q,0,'random old noise remains');
  }
 }
 assert.deepEqual(diff,{Floor:91,Patina:16,Scars:6,Walls:0,Furniture:5,SetDressing:6});
 assert.deepEqual(now.layers.filter(l=>l.type!=='tilelayer'),old.layers.filter(l=>l.type!=='tilelayer'),
  'keycard, guard, vault gate, lights and thematic authoring must not move');
});
test('R5.90 preserves all V5 collision radii, LOS, reachability and checkpoint objects',()=>{
 for(let y=0;y<38;y++)for(let x=0;x<48;x++){
  const px=(x+.5)*16,py=(y+.5)*16;
  for(const r of [0,2,4,6,10,12])
   assert.equal(after.solidAt(px,py,r),before.solidAt(px,py,r),'solid changed '+x+','+y+' radius '+r);
 }
 assert.deepEqual(after.coverRects,before.coverRects);
 assert.deepEqual(Array.from(after.reachable().seen),Array.from(before.reachable().seen));
 for(const type of ['spawn','extract','loot','enemy','keycard','gate','hatch'])
  assert.deepEqual(after.objects(type),before.objects(type));
 for(const [a,b] of [
  [{x:22*16,y:13*16},{x:30*16,y:15*16}],
  [{x:28*16,y:14*16},{x:29*16,y:15*16}],
  [{x:24*16,y:12*16},{x:27*16,y:14*16}],
  [after.spawn,after.extract]
 ])assert.equal(after.lineClear(a,b),before.lineClear(a,b));
});
test('R5.90 paints actual industrial floor and real furniture within original security office',()=>{
 const imgs=[{id:'base'},{id:'kenney'},{id:'industrial'}],calls=[];
 const ctx=new Proxy({canvas:{width:624,height:336},drawImage(...xs){calls.push(xs)}},{
  get(t,k){return k in t?t[k]:(()=>{})}
 });
 after.draw(ctx,imgs,{x:19*16,y:10*16},3);
 const industrial=calls.filter(c=>c[0]===imgs[2]);
 assert.ok(industrial.length>=90,'real industrial tiles must render');
 assert.ok(industrial.some(c=>c[2]===0),'steel-concrete floor');
 assert.ok(industrial.some(c=>c[2]===32),'solid warehouse-styled furniture');
});
