'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const Tiled=require('../maps/indoor/tiled-runtime.js');
const old=read('maps/indoor/indoor-r5.88.tmj'),now=read('maps/indoor/indoor.tmj');
const tiles=[read('maps/indoor/tiles/warehouse.tsj'),read('maps/indoor/tiles/kenney-interior.tsj'),read('maps/indoor/tiles/warehouse-industrial.tsj')];
const a=Tiled.createModel(old,tiles),b=Tiled.createModel(now,tiles);
const inside=(x,y)=>x>=19&&x<=31&&y>=18&&y<=28,idx=(x,y)=>y*48+x;
test('R5.89 changes only the actual central corridor Tiled tiles without altering authored objects',()=>{
 assert.equal(now.width,48);assert.equal(now.height,38);
 assert.deepEqual(now.tilesets,old.tilesets);
 const oldTiles=old.layers.filter(l=>l.type==='tilelayer'),newTiles=now.layers.filter(l=>l.type==='tilelayer');
 assert.deepEqual(oldTiles.map(l=>l.name),newTiles.map(l=>l.name));
 const diff={};
 for(let k=0;k<oldTiles.length;k++){
  const layer=oldTiles[k],target=newTiles[k];diff[layer.name]=0;
  for(let y=0;y<38;y++)for(let x=0;x<48;x++){
   const i=idx(x,y),p=layer.data[i],q=target.data[i];
   if(p!==q){diff[layer.name]++;assert.ok(inside(x,y),'out-of-corridor tile mutation '+layer.name+' '+x+','+y);}
   if(inside(x,y)&&layer.name==='Floor'&&p)assert.ok([583,584,585,586,587].includes(q),'unconverted corridor floor');
   if(inside(x,y)&&['Patina','Scars'].includes(layer.name)&&p)assert.equal(q,0,'legacy texture in corridor');
  }
 }
 assert.deepEqual(diff,{Floor:143,Patina:24,Scars:18,Walls:5,Furniture:4,SetDressing:2});
 assert.deepEqual(now.layers.filter(l=>l.type!=='tilelayer'),old.layers.filter(l=>l.type!=='tilelayer'));
});
test('R5.89 preserves all traversability, geometry, LOS and exact gameplay markers',()=>{
 for(let y=0;y<38;y++)for(let x=0;x<48;x++){
  for(const r of [0,2,4,6,10,12]){
   const px=(x+.5)*16,py=(y+.5)*16;
   assert.equal(b.solidAt(px,py,r),a.solidAt(px,py,r),'collision changed at '+x+','+y+' radius='+r);
  }
 }
 assert.deepEqual(b.coverRects,a.coverRects);
 assert.deepEqual(Array.from(b.reachable().seen),Array.from(a.reachable().seen));
 for(const type of ['spawn','extract','loot','enemy','keycard','gate','hatch'])
  assert.deepEqual(b.objects(type),a.objects(type));
 for(const [p,q] of [
  [{x:22*16,y:20*16},{x:30*16,y:20*16}],
  [{x:19*16,y:22*16},{x:30*16,y:26*16}],
  [{x:32*16,y:21*16},{x:34*16,y:21*16}],
  [b.spawn,b.extract]
 ])assert.equal(b.lineClear(p,q),a.lineClear(p,q));
});
test('R5.89 renders many industrial raster tiles in the playable original corridor',()=>{
 const img=[{id:'basic'},{id:'kenney'},{id:'industry'}],calls=[];
 const ctx=new Proxy({canvas:{width:624,height:528},drawImage(...xs){calls.push(xs)}},{
  get(t,k){return k in t?t[k]:(()=>{})}
 });
 b.draw(ctx,img,{x:19*16,y:18*16},3);
 const industrial=calls.filter(a=>a[0]===img[2]);
 assert.ok(industrial.length>=140,'corridor needs actual art, not overlay artwork');
 assert.ok(industrial.some(a=>a[2]===0),'concrete floor');
 assert.ok(industrial.some(a=>a[2]===16),'solid industrial wall');
 assert.ok(industrial.some(a=>a[2]===32),'solid industrial furniture');
});
