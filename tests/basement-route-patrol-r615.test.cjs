'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const load=p=>JSON.parse(read(p));
const Tiled=require('../maps/indoor/tiled-runtime.js');
const map=load('maps/basement/basement.tmj');
const sheets=['warehouse.tsj','kenney-interior.tsj','warehouse-industrial.tsj']
 .map(f=>load('maps/indoor/tiles/'+f));
const model=Tiled.createModel(map,sheets);
const p=(x,y)=>({x:(x+.5)*16,y:(y+.5)*16});
const prop=(o,n)=>model.prop(o,n);
function authored(o){
 return String(prop(o,'patrolPath')||'').split(';').map(pair=>{
  const [x,y]=pair.split(',').map(Number);return {x,y};
 });
}
function clear(a,b,r=7){
 const steps=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/4));
 for(let i=0;i<=steps;i++){
  const t=i/steps;
  if(model.solidAt(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,r))return false;
 }
 return true;
}
async function layout(){
 const w={TreasureTiledMap:Tiled,location:{search:''}};
 class Image{constructor(){this.complete=true;this.naturalWidth=192}set src(v){queueMicrotask(()=>this.onload?.())}}
 const original=load('maps/indoor/indoor.tmj');
 const fakeFetch=async uri=>({
  ok:true,json:async()=>uri.includes('maps/basement/')?map:
   uri.includes('indoor.tmj')?original:
   uri.includes('kenney-interior.tsj')?sheets[1]:
   uri.includes('warehouse-industrial.tsj')?sheets[2]:sheets[0]
 });
 new Function('window','fetch','Image',read('exploration-layout-v5.js'))(w,fakeFetch,Image);
 return await w.TreasureIndoorLayoutV5.loadBasement();
}
test('R6.15 guards at the central checkpoint and north detour have physical, looped authored patrols',()=>{
 const posts=model.objects('enemy');
 assert.equal(posts.length,9,'do not alter enemy count');
 for(const [id,len] of [['G02',5],['G06',4]]){
  const o=posts.find(x=>x.name.startsWith(id+' '));
  assert.ok(o);
  const route=authored(o);
  assert.equal(route.length,len);
  for(const pt of route)assert.equal(model.solidAt(pt.x,pt.y,7),false,id+' waypoint blocked');
  for(let i=0;i<route.length;i++)assert.equal(clear(route[i],route[(i+1)%route.length]),true,
   id+' segment '+i+' crosses a wall');
  assert.equal(String(prop(o,'patrolPause')).split(';').length,len);
 }
 assert.equal(posts.filter(o=>prop(o,'patrolPath')).length,2,'only two routes changed');
});
test('R6.15 loaded B1 layout retains authored patrol and 2.5s readable inspection pause',async()=>{
 const b=await layout();
 const g02=b.guardPosts.find(o=>o.id==='tiled-guard-13');
 const g06=b.guardPosts.find(o=>o.id==='tiled-guard-17');
 assert.ok(g02&&g06);
 assert.equal(b.isBasement,true);
 assert.equal(g02.kind,'fast');assert.equal(g06.kind,'normal');
 assert.equal(g02.authoredPatrol,true);assert.equal(g06.authoredPatrol,true);
 assert.equal(g02.route.length,5);
 assert.equal(g06.route.length,4);
 assert.equal(g02.pauses[2],2.5);
 assert.equal(g06.pauses[2],1.5);
 const markers=model.objects('enemy').filter(o=>model.solidAt(o.x,o.y,7));
 assert.deepEqual(markers,[],'guard posts must not be trapped inside new cover');
});
test('R6.15 north cover blocks actual movement and sight but keeps adjacent passage open',()=>{
 for(const [x,y] of [[27,7],[26,11],[33,11]]){
  const pt=p(x,y);
  assert.equal(model.solidAt(pt.x,pt.y,2),true,'real obstacle '+x+','+y);
  assert.equal(model.solidAt(pt.x-16,pt.y,2),false,'nearby alternative lane '+x+','+y);
 }
 assert.equal(model.objects('loot').length,9);
 assert.equal(model.objects('enemy').length,9);
 assert.equal(model.reachable().seen[Math.floor(model.extract.y/16)*40+Math.floor(model.extract.x/16)],1,
 'subterranean extraction remains available');
});
test('R6.15 map audits use unchanged game Tiled source, no leaked randomized loot',()=>{
 const viewer=read('map-inspector.js'),v5=read('exploration-layout-v5.js');
 assert.match(viewer,/drawGuardRoutes\(floor\.layout\)/);
 assert.match(viewer,/guard\.authoredPatrol/);
 assert.match(viewer,/state\.overlays\.guards/);
 assert.match(v5,/maps\/basement\/basement\.tmj\?v=R6\.15/);
 assert.match(read('index.html'),/exploration-layout-v5\.js\?v=R6\.15/);
 assert.match(read('map-inspector.html'),/map-inspector\.js\?v=R6\.15/);
 assert.match(read('map-inspector.html'),/exploration-layout-v5\.js\?v=R6\.15/);
 assert.doesNotMatch(viewer,/sealedRolls|state\.exploreRun/);
});
