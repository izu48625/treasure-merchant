const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..','maps','indoor');
const map=JSON.parse(fs.readFileSync(path.join(root,'indoor.tmj'),'utf8'));
const tileset=JSON.parse(fs.readFileSync(path.join(root,'tiles','warehouse.tsj'),'utf8'));
const {createModel}=require('../maps/indoor/tiled-runtime.js');
function setup(){return createModel(map,tileset)}
const cell=(M,o)=>Math.floor(o.y/M.map.tileheight)*M.map.width+Math.floor(o.x/M.map.tilewidth);
test('R5.31 authored map is native Tiled JSON with external editable 16px tileset',()=>{
 assert.equal(map.type,'map');assert.equal(map.orientation,'orthogonal');
 assert.equal(map.width,48);assert.equal(map.height,38);
 assert.equal(map.tilewidth,16);assert.equal(map.tileheight,16);
 assert.equal(map.tilesets[0].source,'tiles/warehouse.tsj');
 assert.equal(tileset.image,'warehouse.png');
 assert.equal(tileset.tilecount,32);assert.equal(tileset.imagewidth,128);
 assert.equal(tileset.imageheight,64);
 assert.equal(map.layers.filter(l=>l.type==='tilelayer').length,4);
 assert.equal(map.layers.find(l=>l.type==='objectgroup').objects.length,20);
});
test('R5.31 tile layers and object IDs remain unique and valid',()=>{
 const layers=map.layers.filter(x=>x.type==='tilelayer');
 for(const l of layers){assert.equal(l.data.length,map.width*map.height);
  assert.ok(l.data.every(v=>Number.isInteger(v)&&v>=0&&v<=32));}
 assert.equal(new Set(map.layers.map(l=>l.id)).size,map.layers.length);
 const objs=map.layers.find(l=>l.type==='objectgroup').objects;
 assert.equal(new Set(objs.map(o=>o.id)).size,objs.length);
});
test('R5.31 all loot, patrol and extraction markers are reachable from the entrance',()=>{
 const m=setup(),reachable=m.reachable();
 assert.ok(reachable.count>900,'most play area connected');
 for(const o of m.objects()){
  assert.ok(!m.solidAt(o.x,o.y,3),o.name+' marker must not overlap architecture or furniture');
  assert.ok(reachable.seen[cell(m,o)],o.name+' must be accessible from spawn');
 }
 assert.equal(m.objects('loot').length,12);
 assert.equal(m.objects('enemy').length,6);
 assert.equal(m.objects('extract').length,1);
});
test('R5.31 blue, yellow and purple caches coexist without revealing sealed contents',()=>{
 const m=setup(),grades=m.objects('loot').map(o=>m.prop(o,'grade'));
 assert.ok(grades.includes('standard'));
 assert.ok(grades.includes('mid'));
 assert.ok(grades.includes('high'));
 assert.ok(m.objects('loot').filter(o=>m.prop(o,'grade')==='high').length>=2);
 assert.ok(m.objects('loot').every(o=>!m.prop(o,'contents').includes('paid')));
});
test('R5.31 actual walls and shelves are blocking, door gaps are traversable',()=>{
 const m=setup();
 assert.equal(m.solidAt(18*16+8,19*16+8,1),true,'central dividing wall');
 assert.equal(m.solidAt(5*16+8,12*16+8,1),true,'pharmacy rack');
 assert.equal(m.solidAt(18*16+8,22*16+8,1),false,'central double doorway');
 assert.equal(m.solidAt(m.extract.x,m.extract.y,3),false);
});
test('R5.31 vision rays cannot penetrate a solid partition',()=>{
 const m=setup(),left={x:17*16+8,y:19*16+8},right={x:20*16+8,y:19*16+8};
 assert.equal(m.lineClear(left,right),false);
 const good={x:19*16+8,y:21*16+8},next={x:19*16+8,y:22*16+8};
 assert.equal(m.lineClear(good,next),true);
});
test('R5.31 tile renderer uses Tiled layer data and supports viewport cropping',()=>{
 const m=setup(),canvas={width:736,height:528};
 let images=0;const ctx={canvas,fillRect(){},drawImage(){images++},
  save(){},restore(){},translate(){},rotate(){},scale(){}};
 m.draw(ctx,{}, {x:120,y:120},2);
 assert.ok(images>90,'draws tiled floor and furniture tiles');
});
test('R5.31 unsafe Tiled geometry fails early before navigation',()=>{
 const a={...map,width:5000};
 assert.throws(()=>createModel(a,tileset));
 const b={...map,layers:map.layers.filter(l=>l.name!=='Walls')};
 assert.throws(()=>createModel(b,tileset));
});
test('R5.31 preview keeps merchant save separate and opens from the original exploration page',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','maps','indoor','demo.html'),'utf8');
 const pilot=fs.readFileSync(path.join(__dirname,'..','maps','indoor','indoor-demo.js'),'utf8');
 const main=fs.readFileSync(path.join(__dirname,'..','exploration.js'),'utf8');
 assert.match(html,/tiled-runtime.js/);
 assert.match(html,/indoor-demo.js/);
 assert.match(pilot,/fetch\('indoor.tmj'\)/);
 assert.doesNotMatch(pilot,/saveWithCommit|state\.inv|localStorage|IndexedDB/);
 assert.match(main,/href="maps\/indoor\/demo.html"/);
});
