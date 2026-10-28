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
test('R5.32 authored map is native Tiled JSON with external editable 16px tileset',()=>{
 assert.equal(map.type,'map');assert.equal(map.orientation,'orthogonal');
 assert.equal(map.width,48);assert.equal(map.height,38);
 assert.equal(map.tilewidth,16);assert.equal(map.tileheight,16);
 assert.equal(map.tilesets[0].source,'tiles/warehouse.tsj');
 assert.equal(tileset.image,'warehouse.png');
 assert.equal(tileset.tilecount,96);assert.equal(tileset.imagewidth,128);
 assert.equal(tileset.imageheight,192);
 assert.equal(map.layers.filter(l=>l.type==='tilelayer').length,6);
 assert.equal(map.layers.find(l=>l.type==='objectgroup').objects.length,25);
});
test('R5.32 tile layers and object IDs remain unique and valid',()=>{
 const layers=map.layers.filter(x=>x.type==='tilelayer');
 for(const l of layers){assert.equal(l.data.length,map.width*map.height);
  assert.ok(l.data.every(v=>Number.isInteger(v)&&v>=0&&v<=96));}
 assert.equal(new Set(map.layers.map(l=>l.id)).size,map.layers.length);
 const objs=map.layers.filter(l=>l.type==='objectgroup').flatMap(l=>l.objects);
 assert.equal(new Set(objs.map(o=>o.id)).size,objs.length);
});
test('R5.32 all loot, patrol and extraction markers are reachable from the entrance',()=>{
 const m=setup(),reachable=m.reachable();
 assert.ok(reachable.count>900,'most play area connected');
 for(const o of m.objects().filter(o=>['spawn','extract','loot','enemy','gate','keycard','hatch'].includes(o.type))){
  assert.ok(!m.solidAt(o.x,o.y,3),o.name+' marker must not overlap architecture or furniture');
  assert.ok(reachable.seen[cell(m,o)],o.name+' must be accessible from spawn');
 }
 assert.equal(m.objects('loot').length,11);
 assert.equal(m.objects('enemy').length,9);
 assert.equal(m.objects('extract').length,1);
});
test('R5.32 blue, yellow and purple caches coexist without revealing sealed contents',()=>{
 const m=setup(),grades=m.objects('loot').map(o=>m.prop(o,'grade'));
 assert.ok(grades.includes('standard'));
 assert.ok(grades.includes('mid'));
 assert.ok(grades.includes('high'));assert.ok(grades.includes('ultra'));
 assert.equal(m.objects('loot').filter(o=>m.prop(o,'grade')==='high').length,2);
 assert.equal(m.objects('loot').filter(o=>m.prop(o,'grade')==='ultra').length,2);
 assert.ok(m.objects('loot').every(o=>!m.prop(o,'contents').includes('paid')));
});
test('R5.32 actual walls and shelves are blocking, door gaps are traversable',()=>{
 const m=setup();
 assert.equal(m.solidAt(18*16+8,19*16+8,1),true,'central dividing wall');
 assert.equal(m.solidAt(5*16+8,12*16+8,1),true,'pharmacy rack');
 assert.equal(m.solidAt(18*16+8,22*16+8,1),false,'central double doorway');
 assert.equal(m.solidAt(m.extract.x,m.extract.y,3),false);
});
test('R5.32 vision rays cannot penetrate a solid partition',()=>{
 const m=setup(),left={x:17*16+8,y:19*16+8},right={x:20*16+8,y:19*16+8};
 assert.equal(m.lineClear(left,right),false);
 const good={x:19*16+8,y:21*16+8},next={x:19*16+8,y:22*16+8};
 assert.equal(m.lineClear(good,next),true);
});
test('R5.32 tile renderer uses Tiled layer data and supports viewport cropping',()=>{
 const m=setup(),canvas={width:736,height:528};
 let images=0;const ctx={canvas,fillRect(){},drawImage(){images++},
  save(){},restore(){},translate(){},rotate(){},scale(){}};
 m.draw(ctx,{}, {x:120,y:120},2);
 assert.ok(images>90,'draws tiled floor and furniture tiles');
});
test('R5.32 unsafe Tiled geometry fails early before navigation',()=>{
 const a={...map,width:5000};
 assert.throws(()=>createModel(a,tileset));
 const b={...map,layers:map.layers.filter(l=>l.name!=='Walls')};
 assert.throws(()=>createModel(b,tileset));
});
test('R5.32 preview keeps merchant save separate and opens from the original exploration page',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','maps','indoor','demo.html'),'utf8');
 const pilot=fs.readFileSync(path.join(__dirname,'..','maps','indoor','indoor-demo.js'),'utf8');
 const main=fs.readFileSync(path.join(__dirname,'..','exploration.js'),'utf8');
 assert.match(html,/tiled-runtime.js/);
 assert.match(html,/indoor-demo.js/);
 assert.match(pilot,/fetch\('indoor.tmj'\)/);
 assert.doesNotMatch(pilot,/saveWithCommit|state\.inv|localStorage|IndexedDB/);
 assert.match(main,/href="maps\/indoor\/demo.html"/);
});

test('R5.32 authored art pass keeps existing tile layers and introduces nonblocking patina',()=>{
 const m=setup(),order=m.map.layers.map(l=>l.name);
 assert.deepEqual(order,['Floor','Patina','Scars','Walls','Furniture','SetDressing','Gameplay','InteriorThemes','Atmosphere']);
 const patina=m.map.layers.find(l=>l.name==='Patina').data;
 const dressing=m.map.layers.find(l=>l.name==='SetDressing').data;
 assert.ok(patina.filter(Boolean).length>=180,'meaningful damaged-floor dressing');
 assert.ok(dressing.filter(Boolean).length>=80,'additional props and scenic clutter');
 assert.ok(m.map.layers.find(l=>l.name==='Floor').data.some(v=>v>=33&&v<=40));
 assert.ok(m.map.layers.find(l=>l.name==='Patina').data.every(v=>v===0||(v>=41&&v<=64)));
 assert.ok(dressing.every(v=>v===0||(v>=65&&v<=96)));
});
test('R5.32 new cabinets collide but scattered debris remains traversable',()=>{
 const m=setup(),props=m.map.layers.find(l=>l.name==='SetDressing').data;
 const W=m.map.width,patina=m.map.layers.find(l=>l.name==='Patina').data;
 const first=props.findIndex(v=>v>=65&&v<=92),x=first%W,y=Math.floor(first/W);
 assert.ok(first>=0);
 assert.ok(m.solidAt(x*16+8,y*16+8,1),'Tiled solid property blocks prop, not just walls');
 assert.ok(m.blocked.has(props[first]),'new furniture tile references TSJ solid=true');
 const free=props.findIndex((v,i)=>v>=93&&v<=96&&
  m.map.layers.find(l=>l.name==='Walls').data[i]===0&&
  m.map.layers.find(l=>l.name==='Furniture').data[i]===0);
 assert.ok(free>=0,'nonblocking floor clutter exists');
 const fx=free%W,fy=Math.floor(free/W);
 assert.equal(m.solidAt(fx*16+8,fy*16+8,1),false);
 assert.ok(patina.some(Boolean));
});
test('R5.32 room decoration keeps 11 lights and 6 editable room signs',()=>{
 const m=setup();
 assert.equal(m.objects('light').length,11);
 assert.equal(m.objects('sign').length,6);
 assert.ok(m.objects('light').every(o=>m.prop(o,'radius')>=60&&m.prop(o,'radius')<=130));
 assert.ok(m.objects('sign').some(o=>m.prop(o,'caption')==='PHARMACY'));
 assert.ok(m.objects('sign').some(o=>m.prop(o,'caption')==='SECURITY'));
 let labels=0,gradients=0;
 const ctx={canvas:{width:736,height:528},save(){},restore(){},fillRect(){},
  measureText(s){return {width:s.length*7}},fillText(){labels++},
  createRadialGradient(){gradients++;return {addColorStop(){}}}};
 m.drawAmbience(ctx,{x:0,y:0},.85,true);
 assert.equal(labels,6,'all zone signage uses Tiled object data');
 m.drawAmbience(ctx,{x:0,y:0},.85,false);
 assert.ok(gradients>=5,'several room light gradients appear in viewport');
});
test('R5.32 art pass has thematic materials in major rooms without touching loot grades',()=>{
 const m=setup(),floor=m.map.layers.find(l=>l.name==='Floor').data,W=m.map.width;
 const room=(x1,y1,x2,y2)=>{const s=new Set();for(let y=y1;y<=y2;y++)for(let x=x1;x<=x2;x++)s.add(floor[y*W+x]);return s};
 assert.ok(room(2,10,17,24).has(35),'pharmacy has marked ceramic');
 assert.ok(room(33,2,45,8).has(39),'vault has industrial flooring');
 assert.ok(room(33,18,45,35).has(40),'warehouse has grated flooring');
 const grades=m.objects('loot').map(o=>m.prop(o,'grade'));
 assert.ok(grades.includes('standard')&&grades.includes('mid')&&grades.includes('high'));
});

test('R5.56 northwest high-value caches stay reachable but southeast ultra vault has only one physical entry',()=>{
 const m=setup(),width=m.map.width,height=m.map.height,tile=m.map.tilewidth;
 const gate=m.objects('gate')[0],key=m.objects('keycard')[0],
  hatch=m.objects('hatch')[0],start=m.spawn;
 assert.ok(gate&&key&&hatch,'authored key, one-way entry and escape hatch');
 assert.equal(m.prop(gate,'key'),'vault-key');
 assert.equal(m.prop(gate,'oneWay'),true);
 assert.equal(m.prop(hatch,'oneWay'),true);
 const index=o=>Math.floor(o.y/tile)*width+Math.floor(o.x/tile);
 const locked=index(gate),initial=index(start);
 const flood=avoidGate=>{
  const queue=[initial],seen=new Set(queue);
  for(let i=0;i<queue.length;i++){
   const from=queue[i],x=from%width,y=Math.floor(from/width);
   for(const n of [x?from-1:-1,x<width-1?from+1:-1,y?from-width:-1,y<height-1?from+width:-1]){
    if(n<0||seen.has(n)||(avoidGate&&n===locked))continue;
    if(m.solidAt(((n%width)+.5)*tile,(Math.floor(n/width)+.5)*tile,2))continue;
    seen.add(n);queue.push(n);
   }
  }
  return seen;
 };
 const unlocked=flood(false),withoutKey=flood(true);
 const high=m.objects('loot').filter(o=>m.prop(o,'grade')==='high');
 const ultra=m.objects('loot').filter(o=>m.prop(o,'grade')==='ultra');
 assert.equal(high.length,2);assert.equal(ultra.length,2);
 assert.ok(high.every(o=>o.x<m.worldWidth*.5&&o.y<m.worldHeight*.5),
  'regular high-value caches are located northwest');
 assert.ok(ultra.every(o=>o.x>m.worldWidth*.65&&o.y>m.worldHeight*.75),
  'premium caches are located southeast');
 for(const marker of [m.extract,key,...high]){
  assert.ok(withoutKey.has(index(marker)),marker.name+' remains reachable without key');
 }
 for(const marker of [hatch,...ultra]){
  assert.ok(unlocked.has(index(marker)),marker.name+' reachable after unlocking');
  assert.ok(!withoutKey.has(index(marker)),marker.name+' cannot be entered via a bypass');
 }
 assert.ok(m.solidAt(hatch.x,hatch.y,7)===false);
 const landing={x:m.prop(hatch,'targetX'),y:m.prop(hatch,'targetY')};
 assert.ok(!m.solidAt(landing.x,landing.y,7),'escape hatch landing is walkable');
 assert.ok(withoutKey.has(index(landing)),
  'separate one-way hatch deposits the player on an exterior return corridor');
 for(const enemy of m.objects('enemy')){
  assert.ok(!m.solidAt(enemy.x,enemy.y,7),enemy.name+' fits its corridor');
  assert.ok(unlocked.has(index(enemy)),enemy.name+' must patrol reachable geometry');
 }
});

test('R5.58 authored interiors have distinct equipment and room identity',()=>{
 const zones=map.layers.find(l=>l.name==='InteriorThemes')?.objects||[];
 const rooms=zones.filter(x=>x.type==='theme-zone'),details=zones.filter(x=>x.type==='theme-prop');
 assert.equal(rooms.length,9);assert.equal(new Set(rooms.map(x=>x.name)).size,9);
 assert.ok(details.length>=25);
 const prop=(o,name)=>o.properties.find(p=>p.name===name)?.value;
 for(const tag of ['archive','pharmacy','security','control','storage','receiving','vault','checkpoint']){
  assert.ok(rooms.some(o=>prop(o,'style')===tag),'missing themed room '+tag);
  assert.ok(details.some(o=>prop(o,'style')===tag),'missing corresponding art '+tag);
 }
 assert.ok(details.some(o=>prop(o,'detail')==='monitor'));
 assert.ok(details.some(o=>prop(o,'detail')==='medicine'));
 assert.ok(details.some(o=>prop(o,'detail')==='gold'));
});

test('R5.59 room art renders distinct site insignia without changing tile collision',()=>{
 const m=setup();
 const buildCanvas=()=>({
  canvas:{width:720,height:580},labels:[],fills:0,
  save(){},restore(){},translate(){},scale(){},rotate(){},
  fillRect(){this.fills++},strokeRect(){},
  drawImage(){},fillText(label){this.labels.push(label)}
 });
 const security=buildCanvas(),pharmacy=buildCanvas();
 const before=[m.solidAt(100,210,5),m.solidAt(450,210,5),m.reachable().count];
 m.draw(pharmacy,{}, {x:50,y:185},3);
 m.draw(security,{}, {x:305,y:155},3);
 assert.ok(pharmacy.labels.includes('MEDICAL / P-02'),'pharmacy floor stencil visible');
 assert.ok(security.labels.includes('SURVEILLANCE / S-04'),'security monitor room stencil visible');
 assert.ok(security.fills>0&&pharmacy.fills>0);
 assert.deepEqual([m.solidAt(100,210,5),m.solidAt(450,210,5),m.reachable().count],before,
  'visual-only changes preserve walking and walls');
});
