'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const json=p=>JSON.parse(read(p));
const M=require('../map-inspector-core.js');
const Tiled=require('../maps/indoor/tiled-runtime.js');
const sets=[
 json('maps/indoor/tiles/warehouse.tsj'),
 json('maps/indoor/tiles/kenney-interior.tsj'),
 json('maps/indoor/tiles/warehouse-industrial.tsj')
];
const ground=json('maps/indoor/indoor.tmj');
const basement=json('maps/basement/basement.tmj');
test('R6.13 stand-alone inspector is linked from both prep and paused map without changing game state',()=>{
 const html=read('map-inspector.html'),game=read('exploration.js'),styles=read('exploration.css');
 assert.match(html,/map-inspector-core\.js\?v=R6\.13/);
 assert.match(html,/map-inspector\.js\?v=R6\.16/);
 assert.match(html,/exploration-layout-v5\.js\?v=R6\.18/);
 assert.match(html,/maps\/indoor\/tiled-runtime\.js\?v=R6\.07/);
 assert.match(html,/data-floor="surface"/);
 assert.match(html,/data-floor="basement"/);
 assert.match(html,/data-action="zoom-in"/);
 assert.match(html,/data-action="zoom-out"/);
 assert.match(html,/data-action="fit"/);
 for(const label of ['loot','guards','zones'])assert.match(html,new RegExp('data-toggle="'+label+'"'));
 assert.match(game,/map-inspector\.html\?floor=1f/);
 assert.match(game,/map-inspector\.html\?floor='\+\(run\.undergroundEntered/);
 assert.match(game,/target="_blank" rel="noopener"/);
 assert.match(styles,/\.exp-map-inspect-link/);
});
test('R6.13 inspector draws the real game tactical scene, not an alternative hand-crafted schematic',()=>{
 const js=read('map-inspector.js'),layout=read('exploration-layout-v5.js');
 assert.match(js,/layout\.drawScene\(off,0,0\)/);
 assert.match(layout,/model\.drawTactical\(ctx,cam,SCALE,visual\)/);
 assert.match(js,/source\.load\(\),source\.loadBasement\(\)/);
 assert.match(js,/layout\.authoredContainers\.forEach/);
 assert.match(js,/layout\.guardPosts\.forEach/);
 assert.match(js,/layout\.solid\(p\.x,p\.y,0\)/);
 assert.match(js,/layout\.solid\(p\.x,p\.y,12\)/);
 assert.doesNotMatch(js,/Math\.random\(|localStorage\.|indexedDB\./);
 assert.doesNotMatch(js,/sealedRolls|rewardValid|state\.exploreRun/);
 assert.equal(ground.width,48);assert.equal(ground.height,38);
 assert.equal(basement.width,40);assert.equal(basement.height,36);
 const a=Tiled.createModel(ground,sets),b=Tiled.createModel(basement,sets);
 assert.ok(a.reachable().count>900);
 assert.ok(b.reachable().count>0);
 assert.equal(a.objects('loot').length,11);
 assert.equal(b.objects('loot').length,9);
 assert.equal(b.objects('enemy').length,9);
 assert.equal(a.objects('basement-key').length,1);
 assert.equal(a.objects('basement-entrance').length,1);
});
test('R6.13 fit shows the entire 1F map at iPhone 360/390/430px widths',()=>{
 const world=[48*16*3,38*16*3];
 for(const width of [360,390,430]){
  const height=410;
  const c=M.fitCamera(...world,width,height);
  assert.ok(c.scale>0);
  const ul=M.screenAt(c,0,0),lr=M.screenAt(c,...world);
  assert.ok(ul.x>=0&&ul.y>=0);
  assert.ok(lr.x<=width&&lr.y<=height);
  assert.equal(M.clampCamera(c,...world,width,height).scale,c.scale);
 }
});
test('R6.13 cursor-centred zoom preserves the selected tile and reversible pan',()=>{
 const w=2304,h=1824,vw=390,vh=520;
 const camera=M.fitCamera(w,h,vw,vh);
 const anchor={x:173,y:260}; // interior point: can remain anchored without violating map-edge limits
 const before=M.worldAt(camera,anchor.x,anchor.y);
 const twice=M.zoomAt(camera,camera.scale*2,anchor.x,anchor.y,w,h,vw,vh,camera.scale,camera.scale*16);
 const after=M.worldAt(twice,anchor.x,anchor.y);
 assert.ok(Math.abs(before.x-after.x)<1e-7);
 assert.ok(Math.abs(before.y-after.y)<1e-7);
 const panned=M.panBy(twice,-35,-48,w,h,vw,vh);
 assert.ok(panned.x<twice.x&&panned.y<twice.y);
 const max=M.zoomAt(panned,panned.scale*100,200,250,w,h,vw,vh,camera.scale,camera.scale*16);
 assert.equal(max.scale,camera.scale*16);
 const min=M.zoomAt(max,0,200,250,w,h,vw,vh,camera.scale,camera.scale*16);
 assert.equal(min.scale,camera.scale);
});
test('R6.13 drag clamps map boundaries, and touch target nearest object uses only displayed markers',()=>{
 const w=1920,h=1728,vw=390,vh=550;
 const base=M.fitCamera(w,h,vw,vh),c=M.zoomAt(base,base.scale*5,190,280,w,h,vw,vh,base.scale,base.scale*16);
 const left=M.panBy(c,-1e6,-1e6,w,h,vw,vh);
 const right=M.panBy(c,1e6,1e6,w,h,vw,vh);
 assert.equal(left.x,vw-w*left.scale);
 assert.equal(left.y,vh-h*left.scale);
 assert.equal(right.x,0);assert.equal(right.y,0);
 const m1={name:'key',x:600,y:520},m2={name:'guard',x:700,y:520};
 const p=M.screenAt(c,600,520);
 assert.equal(M.nearestMarker([m1,m2],p.x+4,p.y,c,22)?.name,'key');
 assert.equal(M.nearestMarker([m1,m2],p.x+45,p.y,c,22),null);
});
test('R6.13 inspector has touch drag/pinch, wheel, keyboard movement, room and reward toggles',()=>{
 const js=read('map-inspector.js'),css=read('map-inspector.css');
 for(const word of ['pointerdown','pointermove','pointerup','pointercancel','wheel','zoomTo','pan(','fit()','nearestMarker','keydown','ResizeObserver','data-toggle'])assert.ok(js.includes(word),word);
 assert.match(css,/touch-action:none/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/100dvh/);
 assert.match(read('index.html'),/exploration\.css\?v=R6\.22/);
 assert.match(read('index.html'),/exploration\.js\?v=R6\.22/);
});
