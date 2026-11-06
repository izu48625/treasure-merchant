'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const css=read('exploration.css');
const script=read('exploration.js');
const runtime=read('maps/indoor/tiled-runtime.js');
const layout=read('exploration-layout-v5.js');
const html=read('index.html');
const Tiled=require('../maps/indoor/tiled-runtime.js');
const map=JSON.parse(read('maps/indoor/indoor.tmj'));
const tiles=['warehouse.tsj','kenney-interior.tsj','warehouse-industrial.tsj']
 .map(name=>JSON.parse(read('maps/indoor/tiles/'+name)));

test('R5.99 V5 has a structural info rail and joystick/action dock outside the map canvas',()=>{
 assert.match(script,/exp-v5-toprail/);
 assert.match(script,/exp-controls exp-v5-bottomdock/);
 assert.match(script,/run\.mapVersion===5\?'<div class="exp-v5-toprail">':'/);
 assert.match(script,/run\.mapVersion===5\?'<div class="exp-controls exp-v5-bottomdock">':'/);
 assert.match(script,/run\.mapVersion===5\?'<\/div>':'/);
 assert.match(css,/grid-template-areas:"hud pause" "stealth stealth" "objective objective" "room map"/);
 assert.match(css,/\.exp-v5-bottomdock>#exp-stick-zone\s*\{[^}]*position:relative!important/);
 assert.match(css,/\.exp-v5-toprail>\.exp-map-toggle\s*\{[^}]*grid-area:map!important/);
 assert.match(css,/\.exp-v5-toprail>#exp-room-label\s*\{[^}]*grid-area:room!important/);
 assert.ok(script.includes("run.mapVersion===5?' exp-v5-layout':''"),'V3/V4 styling stays separate');
});

test('R5.99 Safari resize uses actual dock and information rail heights, never a 160/360px V5 canvas floor',()=>{
 assert.match(script,/function syncV5Chrome\(\)/);
 assert.match(script,/rail\.getBoundingClientRect\(\)\.bottom-frame\.top/);
 assert.match(script,/frame\.bottom-dock\.getBoundingClientRect\(\)\.top/);
 assert.match(script,/shell\.style\.setProperty\('--v5-canvas-top'/);
 assert.match(script,/shell\.style\.setProperty\('--v5-action-dock'/);
 assert.match(script,/function observeV5Chrome\(\)/);
 assert.match(script,/new ResizeObserver\(\(\)=>resizeField\(\)\)/);
 assert.match(script,/window\.visualViewport\.addEventListener\('resize'/);
 assert.match(script,/run\?\.mapVersion===5\?Math\.max\(1,Math\.round\(bounds\.height\)\)/);
 assert.doesNotMatch(script,/run\?\.mapVersion===5\?160:360/);
});

function drawingContext(){
 const labels=[];
 const ctx=new Proxy({canvas:{width:2000,height:1600},fillText(value){labels.push(String(value))},measureText(value){return {width:String(value).length*7}}},{
  get(target,key){if(key in target)return target[key];return ()=>{}},
  set(target,key,value){target[key]=value;return true}
 });
 return {ctx,labels};
}

test('R5.99 suppresses signboards, floor lettering, fixture abbreviations in raids but keeps authoring previews',()=>{
 const model=Tiled.createModel(map,tiles);
 const overview=drawingContext(),playing=drawingContext();
 model.draw(overview.ctx,[],{x:0,y:0},.85);
 model.draw(playing.ctx,[],{x:0,y:0},.85,{hideDecorativeLabels:true});
 assert.ok(overview.labels.includes('SURVEILLANCE / S-04'),'overview should retain authored room engraving');
 assert.ok(!playing.labels.includes('SURVEILLANCE / S-04'),'raid must hide floor engravings');
 assert.ok(!playing.labels.includes('GEN')&&!playing.labels.includes('CTRL'),'raid must hide equipment abbreviations');
 assert.ok(playing.labels.length<=overview.labels.length,'raid cannot add extra decorative labels');
 const previous=drawingContext(),raid=drawingContext();
 model.drawAmbience(previous.ctx,{x:0,y:0},.85,true,{});
 model.drawAmbience(raid.ctx,{x:0,y:0},.85,true,{hideZoneBanners:true});
 assert.ok(previous.labels.includes('SECURITY'));
 assert.ok(!raid.labels.includes('SECURITY'));
 assert.match(layout,/model\.draw\(ctx,image,cam,SCALE,\{hideDecorativeLabels:true\}\)/);
 assert.match(layout,/hideZoneBanners:true/);
 assert.equal(model.objects('sign').length,6,'no Tiled sign removed');
});

test('R5.99 updates Safari caches and preserves 44px buttons',()=>{
 for(const p of ['exploration.css','exploration.js','exploration-layout-v5.js','maps/indoor/tiled-runtime.js']){
  assert.ok(html.includes(p+'?v='+(p==='exploration.js'?'R6.26':p==='exploration-layout-v5.js'?'R6.18':p==='maps/indoor/tiled-runtime.js'?'R6.07':p==='exploration.css'?'R6.26':'R5.99')),p+' cached version must advance');
 }
 assert.match(css,/\.exp-v5-bottomdock \.exp-action-grid button\s*\{[^}]*min-height:46px!important/);
 assert.match(css,/\.exp-v5-bottomdock \.exp-action-bottom button\s*\{[^}]*min-height:44px!important/);
 assert.match(html,/exp-playing:not\(\.exp-v5-layout\)/,'old transparent button style is not applied to V5');
});
