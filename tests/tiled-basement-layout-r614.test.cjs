'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const Tiled=require('../maps/indoor/tiled-runtime.js');
const floor=read('maps/basement/basement.tmj');
const tiles=[read('maps/indoor/tiles/warehouse.tsj'),
 read('maps/indoor/tiles/kenney-interior.tsj'),
 read('maps/indoor/tiles/warehouse-industrial.tsj')];
const model=Tiled.createModel(floor,tiles),W=floor.width,H=floor.height;
const tile=16,cell=p=>Math.floor(p.y/tile)*W+Math.floor(p.x/tile);
const at=(x,y)=>({x:(x+.5)*tile,y:(y+.5)*tile});
const obj=type=>model.objects(type);
const bonus=obj('loot');
const byName=s=>bonus.find(v=>v.name.startsWith(s));
function shortest(start,target,forbidden=[]){
 const stop=cell(target),begin=cell(start),ban=new Set(forbidden.map(([x,y])=>y*W+x));
 const seen=new Int32Array(W*H).fill(-1),q=[];
 if(!model.solidAt(start.x,start.y,4)&&!ban.has(begin)){
  q.push(begin);seen[begin]=0;
 }
 for(let k=0;k<q.length;k++){
  const i=q[k],x=i%W,y=Math.floor(i/W);
  if(i===stop)return seen[i];
  for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
   if(nx<0||ny<0||nx>=W||ny>=H)continue;
   const n=ny*W+nx;
   if(seen[n]>=0||ban.has(n)||model.solidAt((nx+.5)*tile,(ny+.5)*tile,4))continue;
   seen[n]=seen[i]+1;q.push(n);
  }
 }
 return -1;
}
test('R6.14 basement keeps existing markers and all locations reachable for a 12px-radius actor',()=>{
 assert.equal(W,40);assert.equal(H,36);
 assert.equal(obj('spawn').length,1);
 assert.equal(obj('extract').length,1);
 assert.equal(obj('loot').length,9);
 assert.equal(obj('enemy').length,9);
 assert.equal(obj('theme-zone').length,6);
 const start=obj('spawn')[0];
 assert.ok(model.reachable().count>=790,'most map must remain open to exploration');
 for(const o of [obj('extract')[0],...obj('loot'),...obj('enemy')]){
  assert.equal(model.solidAt(o.x,o.y,4),false,'marker accessible: '+o.name);
  assert.ok(shortest(start,o)>=0,'marker connected to starting room: '+o.name);
 }
});
test('R6.14 profitable U07/U08 caches are a retraced cul-de-sac, not a door beside extraction',()=>{
 const exit=obj('extract')[0],u7=byName('U07'),u8=byName('U08');
 assert.deepEqual([exit.x,exit.y],[104,424],'B1 extraction is now west/southwest');
 for(const premium of [u7,u8]){
  const direct=shortest(premium,exit);
  assert.ok(direct>=35,'premium loot must require a meaningful return: '+premium.name+' = '+direct);
  assert.equal(shortest(premium,exit,[[29,21],[29,22]]),-1,
   'premium vault has only one two-tile entrance; no bottom/north escape');
 }
 assert.equal(model.solidAt(at(29,20).x,at(29,20).y,3),true,'vault south/north flank is sealed');
 assert.equal(model.solidAt(at(29,23).x,at(29,23).y,3),true,'vault lower flank is sealed');
 for(const y of [21,22])assert.equal(model.solidAt(at(29,y).x,at(29,y).y,3),false,'vault doorway open');
});
test('R6.14 central checkpoint is a narrow short route, northern maintenance an independent long route',()=>{
 const u8=byName('U08'),exit=obj('extract')[0];
 const quick=shortest(u8,exit,[[22,7],[22,8]]);
 const detour=shortest(u8,exit,[[22,20],[22,21]]);
 assert.ok(quick>=35,'choke route should be a real return trip');
 assert.ok(detour>=quick+15,'maintenance route costs meaningful extra time');
 assert.equal(shortest(u8,exit,[[22,7],[22,8],[22,20],[22,21]]),-1,
  'each of the exactly two crossings is necessary; no accidental third bypass');
 for(const y of [7,8,20,21])assert.equal(model.solidAt(at(22,y).x,at(22,y).y,4),false,
  'checkpoint crossing cell is open y='+y);
 for(const y of [6,9,22,31,32])assert.equal(model.solidAt(at(22,y).x,at(22,y).y,4),true,
  'unintended shortcut is physically blocked y='+y);
});
test('R6.14 paired service connectors are passable but keep tight route walls',()=>{
 for(const y of [14,15,16,28,29])for(const x of [24,25]){
  assert.equal(model.solidAt(at(x,y).x,at(x,y).y,4),false,'2-cell service corridor '+x+','+y);
 }
 const y=16;
 assert.equal(model.solidAt(at(35,y).x,at(35,y).y,3),true,
  'north end of special reserve must not bypass its locked corridor');
 assert.equal(model.solidAt(at(35,28).x,at(35,28).y,3),true,
  'bottom end of special reserve must not offer a free escape');
});
test('R6.14 map inspector reads same Tiled map; display and collision agree after changes',()=>{
 const inspector=fs.readFileSync(path.join(__dirname,'..','map-inspector.js'),'utf8');
 const loader=fs.readFileSync(path.join(__dirname,'..','exploration-layout-v5.js'),'utf8');
 assert.match(inspector,/layout\.drawScene\(off,0,0\)/);
 assert.match(loader,/model\.drawTactical\(ctx,cam,SCALE,visual\)/);
 assert.match(loader,/fetch\('maps\/basement\/basement\.tmj\?v=R6\.18&b1=R6\.38&flow=R6\.39'\)/);
 const names=obj('theme-zone').map(o=>o.name);
 assert.ok(names.some(n=>/検問/.test(n)));
 assert.ok(names.some(n=>/袋小路/.test(n)));
 assert.ok(names.some(n=>/迂回路/.test(n)));
 const exit=obj('extract')[0];
 assert.ok(obj('theme-zone').some(z=>z.name==='地下脱出区画'&&
  exit.x>=z.x&&exit.x<z.x+z.width&&exit.y>=z.y&&exit.y<z.y+z.height),
  'map label on west exit must match physical exit');
});
