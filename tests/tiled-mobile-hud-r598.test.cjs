'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('exploration.css'),js=read('exploration.js'),
 layout=read('exploration-layout-v5.js'),runtime=read('maps/indoor/tiled-runtime.js'),
 html=read('index.html');
const Tiled=require('../maps/indoor/tiled-runtime.js');
const map=JSON.parse(read('maps/indoor/indoor.tmj'));
const tiles=['warehouse.tsj','kenney-interior.tsj','warehouse-industrial.tsj'].map(n=>JSON.parse(read('maps/indoor/tiles/'+n)));

test('R5.98 V5-specific layout separates permanent HUD, playable canvas and bottom actions on iPhone',()=>{
 const block=css.slice(css.lastIndexOf('/* R5.98 iPhone Safari bugfix:'));
 assert.ok(block.length>5000,'the new V5-only CSS override must be the final cascade block');
 assert.match(block,/exp-playing\.exp-v5-layout \.exp-map-frame\s*\{[^}]*inset:var\(--v5-canvas-top\) 0 var\(--v5-action-dock\) 0!important/);
 assert.match(block,/exp-playing\.exp-v5-layout \.exp-controls\s*\{[^}]*height:var\(--v5-action-dock\)!important/);
 assert.match(block,/exp-playing\.exp-v5-layout #exp-stick-zone\s*\{[^}]*height:108px!important/);
 assert.match(block,/exp-playing\.exp-v5-layout>\.exp-map-toggle\s*\{[^}]*top:var\(--v5-room-row\)!important/);
 assert.match(block,/exp-playing\.exp-v5-layout>#exp-room-label\s*\{[^}]*top:var\(--v5-room-row\)!important/);
 assert.match(block,/exp-playing\.exp-v5-layout \.exp-action-bottom button\s*\{[^}]*min-height:44px!important/);
 assert.match(block,/exp-playing\.exp-v5-layout \.exp-action-grid button\s*\{[^}]*min-height:46px!important/);
 assert.match(block,/env\(safe-area-inset-top\)/);
 assert.match(block,/env\(safe-area-inset-bottom\)/);
 // iPhone Safari's reduced visual viewport must not squash a minimum 360px backing canvas.
 assert.match(js,/run\?\.mapVersion===5\?Math\.max\(1,Math\.round\(bounds\.height\)\)/);
 assert.ok(js.includes("run.mapVersion===5?' exp-v5-layout':''"),'V5 shell must have separated UI layout class');
});

test('R5.98 room name and map button live OUTSIDE the actual playable canvas, without duplicate IDs',()=>{
 const mapFrame=js.indexOf('<div class="exp-map-frame">');
 // In the string template the region badge must come before the canvas wrapper.
 const region=js.indexOf("'<span class=\"exp-region-tag\"");
 assert.ok(region>=0&&mapFrame>region);
 assert.ok(js.includes("'</span>'+(run.mapVersion===5?'</div>':'')+'<div class=\"exp-map-frame\""),'V5 room badge closes its info rail before entering the game canvas');
 assert.ok(js.includes("'exp-map-toggle'")||js.includes('id=\"exp-map-toggle\"'));
 assert.match(js,/id=\"exp-field\"/);
 assert.match(css,/\.exp-map-frame\{position:relative/,'non-raid map frame remains available');
});

test('R5.98 suppresses redundant world billboards only while running V5, preserving authored light/sign data',()=>{
 assert.match(layout,/drawAmbience\(ctx,cam,SCALE,false,\{\.\.\.visual,hideZoneBanners:true\}\)/);
 assert.match(runtime,/visual\?\.hideZoneBanners/);
 const model=Tiled.createModel(map,tiles);
 const seen=()=>{const captions=[];const ctx={
  canvas:{width:768,height:608},save(){},restore(){},fillRect(){},
  measureText(x){return {width:x.length*7}},fillText(caption){captions.push(caption)}
 };return {ctx,captions}};
 const original=seen();
 model.drawAmbience(original.ctx,{x:0,y:0},.85,true,{});
 assert.ok(original.captions.includes('SECURITY'));
 assert.ok(original.captions.includes('CONTROL'));
 const raid=seen();
 model.drawAmbience(raid.ctx,{x:0,y:0},.85,true,{hideZoneBanners:true});
 assert.ok(!raid.captions.includes('SECURITY'));
 assert.ok(!raid.captions.includes('CONTROL'));
 assert.equal(model.objects('sign').length,6,'all physical authored signs retained for previews');
});

test('R5.98 browser resources and older map modes remain intact',()=>{
 assert.match(html,/exploration\.css\?v=R6\.03/);
 assert.match(html,/exploration\.js\?v=R6\.03/);
 assert.match(html,/exploration-layout-v5\.js\?v=R5\.99/);
 assert.match(html,/maps\/indoor\/tiled-runtime\.js\?v=R5\.99/);
 assert.ok(js.includes("run.mapVersion===5?' exp-v5-layout':''"),'R5.97 older V3/V4 immersive modes must not receive the V5 dock');
 assert.match(css,/\.exp-pause-layer:not\(:empty\)/);
 assert.match(css,/#exp-stick-zone\.is-active/,'existing dynamic joystick remains functional');
});
