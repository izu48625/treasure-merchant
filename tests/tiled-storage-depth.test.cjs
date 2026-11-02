'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const Tiled=require('../maps/indoor/tiled-runtime.js');
const previous=JSON.parse(read('maps/indoor/indoor-r5.83.tmj'));
const current=JSON.parse(read('maps/indoor/indoor-r5.84.tmj'));
const sheets=[JSON.parse(read('maps/indoor/tiles/warehouse.tsj')),JSON.parse(read('maps/indoor/tiles/kenney-interior.tsj'))];
const a=Tiled.createModel(previous,sheets),b=Tiled.createModel(current,sheets);
const byName=name=>current.layers.find(l=>l.name===name);
test('R5.84 warehouse rim, ground-contact and aisle guides exist as small editable Tiled objects',()=>{
 const shadows=byName('StorageDepth'),rims=byName('StorageRims');
 assert.equal(shadows.type,'objectgroup');assert.equal(rims.type,'objectgroup');
 assert.deepEqual(shadows.objects.map(o=>o.type).sort(),
  ['aisle-guide','aisle-guide',...Array(6).fill('contact-shadow')].sort());
 assert.equal(rims.objects.length,4);
 assert.ok(rims.objects.every(o=>o.type==='shelf-rim'));
 const order=current.layers.map(l=>l.name);
 assert.ok(order.indexOf('Scars')<order.indexOf('StorageDepth'));
 assert.ok(order.indexOf('StorageDepth')<order.indexOf('Walls'));
 assert.ok(order.indexOf('Furniture')<order.indexOf('StorageRims'));
 assert.ok(order.indexOf('StorageRims')<order.indexOf('SetDressing'));
 const all=shadows.objects.concat(rims.objects);
 assert.equal(new Set(all.map(o=>o.id)).size,12);
 for(const o of all){
  assert.ok(o.x>=544&&o.x+o.width<=752&&o.y>=288&&o.y+o.height<=464,o.name+' is outside STORAGE');
  assert.ok(o.width>0&&o.width<=32&&o.height>0&&o.height<=41,
   'oversized object could hide the corridor: '+o.name);
  assert.ok(o.visible!==false);
 }
 assert.equal(current.nextobjectid,91);assert.equal(current.nextlayerid,12);
});
test('R5.84 keeps exact Tiled sprites, physics, cover rectangles and gameplay markers',()=>{
 const prevLayers=previous.layers.filter(l=>l.type==='tilelayer');
 const newLayers=current.layers.filter(l=>l.type==='tilelayer');
 assert.deepEqual(newLayers,prevLayers,'no sprites or base geometry changed');
 for(const n of ['Gameplay','InteriorThemes','Atmosphere'])
  assert.deepEqual(byName(n),previous.layers.find(l=>l.name===n));
 assert.deepEqual(b.coverRects,a.coverRects,'no imaginary shadow collider/vision blocker');
 for(let y=0;y<current.height;y++)for(let x=0;x<current.width;x++){
  for(const r of [0,2,4,6]){
   const px=(x+.5)*16,py=(y+.5)*16;
   assert.equal(b.solidAt(px,py,r),a.solidAt(px,py,r),'collision changed '+x+','+y+' r'+r);
  }
 }
 assert.deepEqual(Array.from(b.reachable().seen),Array.from(a.reachable().seen));
 for(const type of ['loot','enemy','keycard','gate','hatch','extract','spawn'])
  assert.deepEqual(b.objects(type),a.objects(type));
 for(const [p,q] of [[{x:600,y:353},{x:696,y:353}],[{x:608,y:392},{x:700,y:392}],[a.spawn,a.extract]])
  assert.equal(b.lineClear(p,q),a.lineClear(p,q));
});
test('R5.84 draws only the new small Tiled details; preview and old map have no extra graphics',()=>{
 const makeCtx=()=>{
  const actions=[],canvas={width:624,height:528};
  const c=new Proxy({canvas,drawImage(...args){actions.push({type:'image',args})},
   fillRect(...args){actions.push({type:'fill',color:c.fillStyle,args})},
   fillText(...args){actions.push({type:'text',args})}},{
    get(target,key){return key in target?target[key]:(()=>{});}
   });
  return {c,actions};
 };
 const base={id:'base'},kenney={id:'kenney'},cam={x:34*16,y:18*16};
 const oldView=makeCtx(),newView=makeCtx();
 a.draw(oldView.c,[base,kenney],cam,3);
 b.draw(newView.c,[base,kenney],cam,3);
 const oldImages=oldView.actions.filter(o=>o.type==='image').map(o=>o.args);
 const newImages=newView.actions.filter(o=>o.type==='image').map(o=>o.args);
 assert.deepEqual(newImages,oldImages,'shelf tiles must remain the same');
 const colors=newView.actions.map(o=>o.color);
 assert.ok(colors.includes('rgba(7,15,20,.28)'),'contact shadow drawn');
 assert.ok(colors.includes('rgba(196,168,107,.38)'),'subtle aisle marks drawn');
 assert.ok(colors.includes('rgba(211,198,168,.48)'),'shelf rim highlight drawn');
 const lastRack=newView.actions.map((o,i)=>o.type==='image'&&o.args[0]===kenney?i:-1).reduce((a,b)=>Math.max(a,b),-1);
 const firstRim=newView.actions.findIndex(o=>o.color==='rgba(211,198,168,.48)');
 assert.ok(firstRim>lastRack,'rim must be rendered on top of the actual rack sprites');
 const far=makeCtx();
 b.draw(far.c,[base,kenney],{x:0,y:0},2);
 assert.ok(!far.actions.some(o=>['rgba(7,15,20,.28)','rgba(196,168,107,.38)','rgba(211,198,168,.48)'].includes(o.color)),
  'do not add warehouse decoration to other rooms');
});
