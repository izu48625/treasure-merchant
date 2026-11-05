'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const json=p=>JSON.parse(read(p));
const Tiled=require('../maps/indoor/tiled-runtime.js');
const Routes=require('../map-return-routes.js');
const map=json('maps/basement/basement.tmj');
const sets=['warehouse.tsj','kenney-interior.tsj','warehouse-industrial.tsj']
 .map(n=>json('maps/indoor/tiles/'+n));
async function b1(){
 const w={TreasureTiledMap:Tiled};
 new Function('window','fetch','Image',read('exploration-layout-v5.js'))(w,
  async url=>({ok:true,json:async()=>String(url).includes('basement.tmj')?map:
   String(url).includes('kenney-interior')?sets[1]:
   String(url).includes('warehouse-industrial')?sets[2]:sets[0]}),
  class Image{constructor(){this.complete=true;this.naturalWidth=192}});
 return w.TreasureIndoorLayoutV5.loadBasement();
}
test('R6.16 real B1 has 41-step checkpoint and 63-step northern return routes',async()=>{
 const layout=await b1(),planned=Routes.plan(layout);
 assert.equal(planned.complete,true);
 assert.deepEqual(planned.routes.map(r=>[r.id,r.steps]),[['central',41],['northern',63]]);
 for(const route of planned.routes){
  assert.equal(route.points.length,route.steps+1);
  for(const p of route.points)assert.equal(layout.solid(p.x,p.y,12),false);
  for(let i=1;i<route.cells.length;i++){
   const a=route.cells[i-1],b=route.cells[i];
   assert.equal(Math.abs(a.x-b.x)+Math.abs(a.y-b.y),1);
  }
 }
 assert.ok(planned.routes[0].cells.some(p=>p.x===22&&(p.y===20||p.y===21)));
 assert.ok(planned.routes[1].cells.some(p=>p.x===22&&(p.y===7||p.y===8)));
});
test('R6.16 invalid floor, impassable map, or invalid exit cannot invent a route',async()=>{
 const layout=await b1();
 assert.equal(Routes.plan({...layout,isBasement:false}),null);
 assert.equal(Routes.plan({...layout,solid:()=>true}),null);
 assert.equal(Routes.plan({...layout,fixedExit:{x:-1,y:100}}),null);
});
test('R6.16 inspector overlays are audit-only, zoom aware and independently toggleable',()=>{
 const route=read('map-return-routes.js'),viewer=read('map-inspector.js'),html=read('map-inspector.html');
 assert.match(route,/layout\.solid/);
 assert.doesNotMatch(route,/Math\.random|localStorage|indexedDB|sealedRolls|rollContainers/);
 assert.match(viewer,/drawReturnRoutes\(floor\.layout\)/);
 assert.match(viewer,/math\.screenAt\(state\.camera/);
 assert.match(viewer,/state\.overlays\.routes/);
 assert.match(viewer,/routing\?\.plan\(r\.value\)/);
 assert.match(html,/data-toggle="routes"/);
 assert.match(html,/map-return-routes\.js\?v=R6\.16/);
 assert.match(html,/map-inspector\.js\?v=R6\.16/);
});
