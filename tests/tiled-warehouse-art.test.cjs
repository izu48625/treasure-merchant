'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Tiled=require('../maps/indoor/tiled-runtime.js');
const map=JSON.parse(read('maps/indoor/indoor.tmj'));
const tiles=JSON.parse(read('maps/indoor/tiles/warehouse.tsj'));
function mockCanvas(width=300,height=250){
 const calls=[];
 const ctx=new Proxy({canvas:{width,height},drawImage(...args){calls.push(args)}},{
  get(target,prop){return prop in target?target[prop]:(()=>{});}
 });
 return {ctx,calls};
}
test('R5.80 Kenney warehouse art is optional; outside-storage pixels and Tiled collision remain unchanged',()=>{
 const model=Tiled.createModel(map,tiles);
 const original=Array.from({length:map.height},(_,y)=>
  Array.from({length:map.width},(_,x)=>model.solidAt((x+.5)*16,(y+.5)*16,2)));
 const atlas={complete:true,naturalWidth:458,naturalHeight:305};
 const base={complete:true,naturalWidth:128,naturalHeight:192};
 const inside={x:530,y:274};
 const before=mockCanvas(300,250);model.draw(before.ctx,base,inside,1);
 assert.equal(before.calls.some(args=>args[0]===atlas),false);
 model.setWarehouseAtlas(atlas);
 const after=mockCanvas(300,250);model.draw(after.ctx,base,inside,1);
 const sourceCalls=after.calls.filter(args=>args[0]===atlas);
 assert.ok(sourceCalls.length>20,'actual Kenney sprite tiles must render in warehouse room');
 assert.ok(sourceCalls.some(args=>args[1]%17===0&&args[2]%17===0),
  'use 16px sprite crops on the 17px atlas grid');
 const outside=mockCanvas(250,250);model.draw(outside.ctx,base,{x:0,y:0},1);
 assert.equal(outside.calls.some(args=>args[0]===atlas),false,'other rooms retain old appearance');
 const latest=Array.from({length:map.height},(_,y)=>
  Array.from({length:map.width},(_,x)=>model.solidAt((x+.5)*16,(y+.5)*16,2)));
 assert.deepEqual(latest,original,'warehouse art cannot alter route, movement or hiding collision');
});
test('R5.80 prevents an incomplete sprite image and preserves the explicit comparison URL',()=>{
 const model=Tiled.createModel(map,tiles),base={complete:true,naturalWidth:128,naturalHeight:192};
 const insufficient={complete:true,naturalWidth:192,naturalHeight:192};
 model.setWarehouseAtlas(insufficient);
 const screen=mockCanvas(300,250);model.draw(screen.ctx,base,{x:530,y:274},1);
 assert.equal(screen.calls.some(args=>args[0]===insufficient),false);
 const loader=read('exploration-layout-v5.js'),html=read('index.html');
 assert.match(loader,/warehouseArt/);
 assert.match(loader,/kenney-roguelike-interior\.png\?v=R5\.80/);
 assert.match(html,/tiled-runtime\.js\?v=R5\.80/);
 assert.match(html,/exploration-layout-v5\.js\?v=R5\.80/);
 assert.ok(fs.statSync(path.join(root,'maps/indoor/art/kenney-roguelike-interior.png')).size>5000);
});
