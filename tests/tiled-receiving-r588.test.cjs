'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const Tiled=require('../maps/indoor/tiled-runtime.js');
const old=read('maps/indoor/indoor-r5.87.tmj'),now=read('maps/indoor/indoor.tmj');
const tiles=[read('maps/indoor/tiles/warehouse.tsj'),read('maps/indoor/tiles/kenney-interior.tsj'),read('maps/indoor/tiles/warehouse-industrial.tsj')];
const before=Tiled.createModel(old,tiles),after=Tiled.createModel(now,tiles);
const inside=(x,y)=>x>=2&&x<=17&&y>=26&&y<=35;
const index=(x,y)=>y*old.width+x;
test('R5.88 uses real industrial Tiled tiles ONLY inside the original receiving dock',()=>{
 assert.equal(now.width,48);assert.equal(now.height,38);
 assert.deepEqual(now.tilesets,old.tilesets);
 const tileLayers=m=>Object.fromEntries(m.layers.filter(l=>l.type==='tilelayer').map(l=>[l.name,l.data]));
 const a=tileLayers(old),b=tileLayers(now);
 assert.deepEqual(Object.keys(b),Object.keys(a));
 const changed=Object.fromEntries(Object.keys(a).map(k=>[k,0]));
 for(const name of Object.keys(a)){
  for(let y=0;y<old.height;y++)for(let x=0;x<old.width;x++){
   const i=index(x,y),p=a[name][i],q=b[name][i];
   if(p!==q){changed[name]++;assert.ok(inside(x,y),'out-of-room tile edit '+name+' '+x+','+y)}
   if(inside(x,y)&&name==='Floor'&&p)assert.ok([583,584,585,586,587].includes(q),'industrial floor missing '+x+','+y);
   if(inside(x,y)&&name==='Patina'&&p)assert.equal(q,0,'old random noise remains');
   if(inside(x,y)&&name==='Scars'&&p)assert.equal(q,0,'old legacy scratch remains');
  }
 }
 assert.deepEqual(changed,{Floor:160,Patina:29,Scars:17,Walls:12,Furniture:5,SetDressing:8});
 assert.deepEqual(now.layers.filter(l=>l.type!=='tilelayer'),old.layers.filter(l=>l.type!=='tilelayer'),
  'all authored door details, gameplay objects, theme props and lights must be preserved');
});
test('R5.88 receiving-room reskin does not change collision, LOS or extraction accessibility',()=>{
 for(let y=0;y<old.height;y++)for(let x=0;x<old.width;x++){
  const px=(x+.5)*16,py=(y+.5)*16;
  for(const r of [0,2,4,6,10,12])assert.equal(after.solidAt(px,py,r),before.solidAt(px,py,r),
   'collision differs at '+x+','+y+' radius '+r);
 }
 assert.deepEqual(after.coverRects,before.coverRects);
 assert.deepEqual(Array.from(after.reachable().seen),Array.from(before.reachable().seen));
 for(const type of ['spawn','extract','loot','enemy','gate','keycard','hatch'])
  assert.deepEqual(after.objects(type),before.objects(type));
 for(const [a,b] of [
  [{x:4.5*16,y:33.5*16},{x:8.5*16,y:32.5*16}],
  [{x:9.5*16,y:29.5*16},{x:13.5*16,y:29.5*16}],
  [{x:2.5*16,y:26.5*16},{x:17.5*16,y:35.5*16}],
  [after.spawn,after.extract]
 ])assert.equal(after.lineClear(a,b),before.lineClear(a,b));
});
test('R5.88 industrial receiving floor, shelves and cargo are actually rendered',()=>{
 const images=[{id:'base'},{id:'kenney'},{id:'industrial'}],draws=[];
 const ctx=new Proxy({canvas:{width:768,height:480},drawImage(...args){draws.push(args)}},{
  get(t,k){return k in t?t[k]:(()=>{})}
 });
 after.draw(ctx,images,{x:2*16,y:26*16},3);
 const industrial=draws.filter(d=>d[0]===images[2]);
 assert.ok(industrial.length>=160,'receiving must use many genuine industrial sprites');
 assert.ok(industrial.some(d=>d[2]===0),'industrial concrete floor drawn');
 assert.ok(industrial.some(d=>d[2]===16),'industrial solid walls drawn');
 assert.ok(industrial.some(d=>d[2]===32),'industrial cargo shelving drawn');
});
