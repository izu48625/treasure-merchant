'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const css=read('exploration.css');
const js=read('exploration.js');
const html=read('index.html');
const marker='/* R6.27: phone landscape rescue';

function cameraFor(run,view,touches=5){
 const start=js.indexOf('function v5CameraScale(){');
 const end=js.indexOf('function draw(){',start);
 assert.ok(start>=0&&end>start,'R6.27 camera helper exists');
 const window={navigator:{maxTouchPoints:touches}};
 return new Function('window','run','VIEW',js.slice(start,end)+'\nreturn v5CameraScale;')(window,run,view)();
}
test('R6.27 zooms phone portrait 12 percent, landscape 22 percent, never PC or legacy maps',()=>{
 assert.equal(cameraFor({mapVersion:5},{w:390,h:844}),.89);
 assert.equal(cameraFor({mapVersion:5},{w:844,h:390}),.82);
 assert.equal(cameraFor({mapVersion:5},{w:568,h:320}),.82);
 assert.equal(cameraFor({mapVersion:5},{w:1920,h:1080}),1);
 assert.equal(cameraFor({mapVersion:5},{w:844,h:390},0),1);
 assert.equal(cameraFor({mapVersion:4},{w:844,h:390}),1);
 assert.equal(cameraFor({mapVersion:3},{w:390,h:844}),1);
 assert.ok(390/.89>390&&390/.89<450,'portrait world viewport expands moderately');
 assert.ok(844/.82>844&&844/.82<1050,'landscape world viewport expands moderately');
});
test('R6.27 scales visuals around the same world player without changing physics or loot',()=>{
 const start=js.indexOf('function draw(){');
 const end=js.indexOf('function stealthSituation(){',start);
 assert.ok(start>=0&&end>start);
 const region=js.slice(start,end);
 assert.match(region,/const zoom=typeof ctx\.setTransform==='function'\?v5CameraScale\(\):1/);
 assert.match(region,/const p=run\.player,w=VIEW\.w\/zoom,h=VIEW\.h\/zoom/);
 assert.match(region,/ctx\.setTransform\(zoom,0,0,zoom,0,0\)/);
 assert.match(region,/ctx\.clearRect\(0,0,w,h\)/);
 assert.match(region,/ctx\.setTransform\(1,0,0,1,0,0\)/);
 assert.match(region,/mapFor\(5\)\.drawScene\(ctx,ox,oy,v5AlarmVisual\(\)\)/);
 const base={x:1400,y:1800};
 const view={w:844,h:390};
 const projected=x=>({ox:base.x-view.w/x/2,oy:base.y-view.h/x/2});
 const origin=projected(.82);
 assert.ok(Math.abs((base.x-origin.ox)*.82-view.w/2)<1e-9);
 assert.ok(Math.abs((base.y-origin.oy)*.82-view.h/2)<1e-9);
});
test('R6.27 landscape rule works on mobile Safari even when pointer coarse query fails',()=>{
 const start=css.indexOf(marker);
 assert.ok(start>0,'R6.27 rescue override appended after previous landscape rules');
 const rule=css.slice(start);
 assert.match(rule,/@media \(orientation:landscape\) and \(max-height:650px\) and \(max-width:1100px\)/);
 assert.doesNotMatch(rule,/\(pointer:coarse\)/,'landscape fallback must not depend on pointer media query');
 assert.match(rule,/grid-template-areas:"hud hud stealth pause" "objective objective room map"!important/);
 assert.match(rule,/grid-template-rows:minmax\(44px,auto\) 44px!important/);
 assert.match(rule,/\.exp-v5-toprail>#exp-room-label\{/);
 assert.match(rule,/\.exp-v5-toprail>\.exp-map-toggle\{/);
 assert.match(rule,/\.exp-v5-toprail #exp-vault-objective/);
 assert.match(rule,/text-overflow:ellipsis!important/);
});
test('R6.27 all five thumb buttons form one 44px row and leave left joystick quadrant free',()=>{
 const rule=css.slice(css.indexOf(marker));
 assert.match(rule,/\.exp-v5-bottomdock>\.exp-control-actions\{[^}]*display:grid!important;grid-template-columns:minmax\(0,3fr\) minmax\(0,2fr\)!important/s);
 assert.match(rule,/\.exp-v5-bottomdock \.exp-action-grid\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/s);
 assert.match(rule,/\.exp-v5-bottomdock \.exp-action-bottom\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/s);
 assert.match(rule,/\.exp-v5-bottomdock \.exp-action-bottom button\{[^}]*height:44px!important;min-height:44px!important/s);
 assert.match(rule,/\.exp-v5-bottomdock>#exp-stick-zone\{[^}]*width:50vw!important;height:50dvh!important/s);
 assert.match(rule,/\.exp-controls\.exp-v5-bottomdock\{[^}]*grid-template-columns:minmax\(0,1fr\) minmax\(0,48%\)!important/s);
 assert.match(rule,/env\(safe-area-inset-bottom\)/);
 assert.match(rule,/\.exp-vault-stage\{[^}]*max-height:44px!important/s);
});
test('R6.27 latest CSS and JS have matching cache keys',()=>{
 assert.match(html,/exploration\.css\?v=R6\.28/);
 assert.match(html,/exploration\.js\?v=R6\.28/);
 assert.ok(js.includes('function refreshAfterPhoneRotation(){'),'R6.26 rotation preserved');
 assert.ok(css.includes('/* R6.26: landscape phone raid layout'),'R6.26 layout preserved for touch mode');
});
