'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Tiled=require('../maps/indoor/tiled-runtime.js');
const prev=JSON.parse(read('maps/indoor/indoor-r5.86.tmj'));
const cur=JSON.parse(read('maps/indoor/indoor-r5.87.tmj'));
const sheets=[
 JSON.parse(read('maps/indoor/tiles/warehouse.tsj')),
 JSON.parse(read('maps/indoor/tiles/kenney-interior.tsj')),
 JSON.parse(read('maps/indoor/tiles/warehouse-industrial.tsj'))
];
const old=Tiled.createModel(prev,sheets),now=Tiled.createModel(cur,sheets);
test('R5.87 only adds small editable Tiled cosmetics to the SAME V5 warehouse',()=>{
 assert.equal(cur.width,48);assert.equal(cur.height,38);
 assert.deepEqual(cur.tilesets,prev.tilesets);
 const prevTiles=prev.layers.filter(l=>l.type==='tilelayer');
 const nextTiles=cur.layers.filter(l=>l.type==='tilelayer');
 assert.deepEqual(nextTiles,prevTiles,'floor/walls/furniture and their real collision remain unchanged');
 for(const layer of prev.layers.filter(l=>l.type==='objectgroup'))
  assert.deepEqual(cur.layers.find(l=>l.name===layer.name),layer,
   'existing gameplay, lights, room zones and cosmetic groups must not change: '+layer.name);
 const transitions=cur.layers.find(l=>l.name==='StorageTransitions');
 assert.equal(transitions.type,'objectgroup');
 assert.equal(transitions.objects.length,9);
 assert.deepEqual(transitions.objects.map(o=>o.type).sort(),
  ['wall-foot','wall-foot','wall-foot','wall-foot','wall-foot',
   'floor-sill','floor-sill','door-marker','door-marker'].sort());
 assert.equal(cur.nextobjectid,100);assert.equal(cur.nextlayerid,13);
 const order=cur.layers.map(l=>l.name);
 assert.ok(order.indexOf('StorageDepth')<order.indexOf('StorageTransitions'));
 assert.ok(order.indexOf('StorageTransitions')<order.indexOf('Walls'));
 for(const o of transitions.objects){
  assert.ok(o.x>=544&&o.x+o.width<=752&&o.y>=288&&o.y+o.height<=464,
   'Tiled finishing object is outside the existing storage zone: '+o.name);
  assert.ok(o.width>0&&o.height>0&&o.width<=96&&o.height<=176);
  assert.equal(o.visible,true);
 }
 const [north,center]=transitions.objects.filter(o=>o.type==='floor-sill');
 assert.equal(north.x,608);assert.equal(north.width,32);
 assert.equal(center.x,592);assert.equal(center.width,64);
 const walls=cur.layers.find(l=>l.name==='Walls').data;
 // Align highlights with the TWO actual door holes, not arbitrary walkable floor.
 for(const x of [38,39])assert.equal(walls[17*48+x],0,'north gap must remain walkable');
 for(const x of [37,38,39,40])assert.equal(walls[25*48+x],0,'central gap must remain walkable');
 assert.equal(cur.layers.filter(l=>l.type==='tilelayer').length,6);
});
test('R5.87 keeps every collision radius, sight line, loot and extraction object intact',()=>{
 for(let y=0;y<38;y++)for(let x=0;x<48;x++){
  const px=(x+.5)*16,py=(y+.5)*16;
  for(const radius of [0,2,4,6,10,12])
   assert.equal(now.solidAt(px,py,radius),old.solidAt(px,py,radius),
    'collision changed at cell '+x+','+y+' radius '+radius);
 }
 assert.deepEqual(now.coverRects,old.coverRects);
 assert.deepEqual(Array.from(now.reachable().seen),Array.from(old.reachable().seen));
 for(const type of ['spawn','extract','loot','enemy','gate','keycard','hatch'])
  assert.deepEqual(now.objects(type),old.objects(type));
 const rays=[
  [{x:616,y:344},{x:696,y:344}],
  [{x:600,y:352},{x:640,y:384}],
  [{x:600,y:408},{x:700,y:408}],
  [now.spawn,now.extract]
 ];
 for(const [a,b] of rays)assert.equal(now.lineClear(a,b),old.lineClear(a,b));
});
test('R5.87 actual Tiled doorway highlights render without inventing a wall or sign',()=>{
 const make=()=>{
  const fills=[],images=[],labels=[];
  const canvas={width:624,height:528};
  const ctx=new Proxy({
   canvas,fillRect(...args){fills.push([this.fillStyle,...args])},
   drawImage(...args){images.push(args)},fillText(text){labels.push(text)}
  },{get(t,k){return k in t?t[k]:(()=>{})}});
  return {ctx,fills,images,labels};
 };
 const oldCtx=make(),newCtx=make(),images=[{id:'base'},{id:'kenney'},{id:'industrial'}];
 old.draw(oldCtx.ctx,images,{x:34*16,y:18*16},3);
 now.draw(newCtx.ctx,images,{x:34*16,y:18*16},3);
 assert.equal(newCtx.images.length,oldCtx.images.length,'no new raster/tile paint: Tiled map cells unchanged');
 assert.ok(newCtx.fills.length>oldCtx.fills.length,'small Tiled details must actually paint');
 const byColor=c=>newCtx.fills.filter(f=>f[0]===c).length;
 assert.equal(byColor('rgba(8,20,26,.24)'),5);
 assert.equal(byColor('rgba(112,136,140,.48)'),2);
 assert.ok(byColor('rgba(192,161,88,.5)')>=2);
 assert.ok(!newCtx.labels.includes('INVENTORY / W-06'));
 assert.ok(!newCtx.labels.includes('STORAGE'));
});
