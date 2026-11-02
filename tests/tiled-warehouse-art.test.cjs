'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Tiled=require('../maps/indoor/tiled-runtime.js');
const map=JSON.parse(read('maps/indoor/indoor-r5.84.tmj'));
const tiles=JSON.parse(read('maps/indoor/tiles/warehouse.tsj'));
const kenney=JSON.parse(read('maps/indoor/tiles/kenney-interior.tsj'));
const tileSets=[tiles,kenney];
const base={complete:true,naturalWidth:128,naturalHeight:192};
const atlas={complete:true,naturalWidth:458,naturalHeight:305};
const inside={x:530,y:274};
function mockCanvas(width=300,height=250){
 const calls=[],labels=[],rects=[];
 const ctx=new Proxy({canvas:{width,height},drawImage(...args){calls.push(args)},
  fillText(...args){labels.push(args[0])},fillRect(...args){rects.push(args)}},{
  get(target,prop){return prop in target?target[prop]:(()=>{});}
 });
 return {ctx,calls,labels,rects};
}
function solidGrid(model){
 return Array.from({length:map.height},(_,y)=>
  Array.from({length:map.width},(_,x)=>model.solidAt((x+.5)*16,(y+.5)*16,2)));
}
test('R5.81 defaults to clean Tiled warehouse despite loaded CC0 image; legacy comparison restores R5.80 art',()=>{
 const model=Tiled.createModel(map,tileSets);
 const plain=mockCanvas();model.draw(plain.ctx,base,inside,1);
 assert.equal(plain.calls.some(c=>c[0]===atlas),false);
 assert.equal(plain.labels.includes('INVENTORY / W-06'),false);
 model.setWarehouseAtlas(atlas);
 const cleaned=mockCanvas();model.draw(cleaned.ctx,base,inside,1);
 assert.deepEqual(cleaned.calls,plain.calls,'optional Kenney atlas must never leak into clean mode');
 assert.deepEqual(cleaned.labels,plain.labels,'no warehouse stencils on the default view');
 model.setWarehouseArtMode('legacy');
 const legacy=mockCanvas();model.draw(legacy.ctx,base,inside,1);
 const sourceCalls=legacy.calls.filter(args=>args[0]===atlas);
 assert.ok(sourceCalls.length>20,'previous Kenney tiles stay available for explicit comparison');
 assert.ok(sourceCalls.some(args=>args[1]%17===0&&args[2]%17===0));
 assert.ok(legacy.labels.includes('INVENTORY / W-06'),'legacy restores floor stencil only on request');
 assert.ok(legacy.labels.includes('PALLET'),'legacy restores procedural pallet labels');
 model.setWarehouseArtMode('clean');
 const reCleaned=mockCanvas();model.draw(reCleaned.ctx,base,inside,1);
 assert.deepEqual(reCleaned.calls,cleaned.calls,'clean mode must be reversible without changing map data');
});
test('R5.81 warehouse-only cleanup never changes solid cells, map data, saves or neighboring zones',()=>{
 const model=Tiled.createModel(map,tileSets),before=solidGrid(model);
 model.setWarehouseAtlas(atlas);
 const outside={x:0,y:0},screen=mockCanvas(250,250);
 model.draw(screen.ctx,base,outside,1);
 model.setWarehouseArtMode('legacy');
 const other=mockCanvas(250,250);model.draw(other.ctx,base,outside,1);
 assert.deepEqual(other.calls,screen.calls,'non-storage sprite tile placements do not change');
 assert.deepEqual(other.labels,screen.labels,'non-storage labels remain as before');
 assert.equal(other.calls.some(args=>args[0]===atlas),false);
 assert.deepEqual(solidGrid(model),before,'no changes to Tiled collision geometry');
 assert.equal(map.width,48);assert.equal(map.height,38);
 assert.equal(map.layers.find(l=>l.name==='Gameplay').objects.filter(x=>x.type==='loot').length,11);
});
test('R5.81 caches and comparison flags keep the preserved CC0 binary available without loading it by default',()=>{
 const model=Tiled.createModel(map,tileSets),invalid={complete:true,naturalWidth:192,naturalHeight:192};
 model.setWarehouseArtMode('legacy');model.setWarehouseAtlas(invalid);
 const invalidScreen=mockCanvas();model.draw(invalidScreen.ctx,base,inside,1);
 assert.equal(invalidScreen.calls.some(args=>args[0]===invalid),false,'broken asset keeps base tiles');
 const loader=read('exploration-layout-v5.js'),html=read('index.html');
 assert.match(loader,/get\('mapArt'\)==='legacy'/);
 assert.match(loader,/hasAdditionalTiles\|\|\(warehouseLegacy&&!warehouseArtDisabled\)/);
 assert.match(loader,/kenney-roguelike-interior\.png\?v=R5\.80/);
 assert.match(html,/tiled-runtime\.js\?v=R5\.90/);
 assert.match(html,/exploration-layout-v5\.js\?v=R5\.90/);
 assert.ok(fs.statSync(path.join(root,'maps/indoor/art/kenney-roguelike-interior.png')).size>5000);
});
