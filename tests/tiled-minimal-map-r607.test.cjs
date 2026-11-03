'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const Tiled=require('../maps/indoor/tiled-runtime.js');
const map=JSON.parse(read('maps/indoor/indoor.tmj'));
const tileFiles=['warehouse.tsj','kenney-interior.tsj','warehouse-industrial.tsj'];
const tiles=tileFiles.map(name=>JSON.parse(read('maps/indoor/tiles/'+name)));
function canvas(width=768,height=608){
 const rects=[],images=[],texts=[],gradients=[];
 const base={canvas:{width,height},fillStyle:'#000',
  fillRect(x,y,w,h){rects.push({x,y,w,h,color:this.fillStyle})},
  drawImage(...args){images.push(args)},
  fillText(...args){texts.push(args)},
  createRadialGradient(...args){gradients.push(args);return {addColorStop(){}}}
 };
 const ctx=new Proxy(base,{get(target,key){return key in target?target[key]:()=>{}},
  set(target,key,val){target[key]=val;return true}});
 return {ctx,rects,images,texts,gradients};
}
function blockedCells(model){
 const floor=model.map.layers.find(l=>l.name==='Floor');
 const data=[];
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
  const px=(x+.5)*map.tilewidth,py=(y+.5)*map.tileheight;
  data.push(model.solidAt(px,py,1));
 }
 return data;
}
test('R6.07 tactical map is real simplified geometry, not a screen-sized decorative redraw',()=>{
 const model=Tiled.createModel(map,tiles);
 const before=blockedCells(model),state=JSON.stringify(map.layers);
 const screen=canvas();
 model.drawTactical(screen.ctx,{x:0,y:0},1);
 assert.equal(screen.images.length,0,'no sprites or tile art at all');
 assert.equal(screen.texts.length,0,'no decorative floor lettering');
 assert.equal(screen.gradients.length,0,'no per-frame light gradients');
 assert.ok(screen.rects.some(r=>r.color==='#697c76'),'real solid walls are visible');
 assert.ok(screen.rects.some(r=>r.color==='#82745f'),'real furniture collisions are visible');
 assert.ok(screen.rects.some(r=>r.color==='#a28b6d'),'real cover rectangles are visible');
 assert.ok(screen.rects.some(r=>r.color==='#30443e'),'pharmacy floor has subdued distinct tint');
 assert.ok(screen.rects.some(r=>r.color==='#3d393c'),'vault floor has subdued distinct tint');
 assert.deepEqual(blockedCells(model),before,'no movement or line-of-sight geometry changed');
 assert.equal(JSON.stringify(map.layers),state,'rendering does not rewrite any Tiled layer');
 const realCover=model.coverRects[0];
 assert.ok(realCover);
 assert.ok(screen.rects.some(r=>r.x===Math.round(realCover.x)&&r.y===Math.round(realCover.y)&&
  r.w===Math.round(realCover.w)&&r.h===Math.round(realCover.h)&&r.color==='#a28b6d'),
  'drawn obstacle has the same rectangle as the authoritative hitbox');
});
test('R6.07 minimalist draw excludes all non-solid furniture and renders alarm without blocking cover',()=>{
 const model=Tiled.createModel(map,tiles);
 const screen=canvas();
 model.drawTactical(screen.ctx,{x:0,y:0},1,{alarm:true,pulse:1});
 assert.equal(screen.images.length,0);
 assert.equal(screen.texts.length,0);
 assert.equal(screen.rects.filter(r=>r.color==='rgba(205,80,67,.35)').length,2,
  'warning is an edge indication only, not a full-screen red occluder');
 const originals=canvas();
 const sources=[{width:128,height:192},{width:458,height:305},{width:300,height:300}];
 model.draw(originals.ctx,sources,{x:0,y:0},1);
 assert.ok(originals.images.length>0,'original sprites remain available for visual comparison');
 assert.equal(map.width,48);assert.equal(map.height,38);
 const all=map.layers.flatMap(l=>l.objects||[]);
 assert.equal(all.filter(o=>o.type==='theme-zone').length,9);
 assert.equal(all.filter(o=>o.type==='loot').length,11);
 assert.equal(all.filter(o=>o.type==='enemy').length,9);
 assert.equal(all.filter(o=>o.type==='spawn').length,1);
 assert.equal(all.filter(o=>o.type==='extract').length,1);
 assert.equal(all.filter(o=>o.type==='keycard').length,1);
 assert.equal(all.filter(o=>o.type==='gate').length,1);
 assert.equal(all.filter(o=>o.type==='hatch').length,1);
});
test('R6.07 default Tiled loader skips textures but preserves geometry and exact loot blueprint',async()=>{
 const sources={
  'maps/indoor/indoor.tmj':map,
  'maps/indoor/tiles/warehouse.tsj':tiles[0],
  'maps/indoor/tiles/kenney-interior.tsj':tiles[1],
  'maps/indoor/tiles/warehouse-industrial.tsj':tiles[2]
 };
 let imageLoads=0;
 const win={TreasureTiledMap:Tiled,location:{search:''},URLSearchParams};
 class ImageMock{constructor(){imageLoads++}set src(_){throw Error('tactical mode requested a forbidden texture')}}
 const fakeFetch=async url=>{const payload=sources[String(url).split('?')[0]];
  return {ok:!!payload,json:async()=>payload}};
 vm.runInNewContext(read('exploration-layout-v5.js'),{
  window:win,URLSearchParams,Image:ImageMock,fetch:fakeFetch,Promise,Math,Set,Map,
  Uint8Array,Number,Array,Object,Float32Array,Int32Array
 });
 const layout=await win.TreasureIndoorLayoutV5.load();
 assert.equal(imageLoads,0,'default mode must not request unused sprite and atlas images');
 assert.equal(layout.themeZones.length,9);
 assert.equal(layout.authoredContainers.length,11);
 assert.equal(layout.guardPosts.length,9);
 assert.ok(layout.mapBlueprint.blockingFurniture.length>0);
 assert.ok(layout.mapBlueprint.blockingDressing.length>0);
 assert.deepEqual(layout.mapBlueprint.covers.map(x=>[x.x,x.y,x.w,x.h]),
  Tiled.createModel(map,tiles).coverRects.map(x=>[x.x*3,x.y*3,x.w*3,x.h*3]));
 const scene=canvas(390,600);
 layout.drawScene(scene.ctx,0,0,{alarm:true,pulse:.6});
 assert.equal(scene.images.length,0,'production V5 scene is tactical by default');
 assert.equal(scene.texts.length,0);
 assert.ok(scene.rects.length>0);
 assert.ok(layout.solid(layout.start.x-20,layout.start.y,1)===true||
  layout.solid(layout.start.x-20,layout.start.y,1)===false,'collision API remains callable');
 assert.match(read('exploration-layout-v5.js'),/get\('mapVisual'\)==='original'/,
  'opt-in comparison to original map remains available without changing authored Tiled data');
});
