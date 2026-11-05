'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const Tiled=require('../maps/indoor/tiled-runtime.js');
const raw=read('maps/basement/basement.tmj');
const sheets=['warehouse.tsj','kenney-interior.tsj','warehouse-industrial.tsj'].map(p=>read('maps/indoor/tiles/'+p));
const model=Tiled.createModel(raw,sheets);
const W=raw.width,H=raw.height,S=raw.tilewidth,idx=(x,y)=>y*W+x,at=o=>[Math.floor(o.x/S),Math.floor(o.y/S)];
const objects=model.objects();
const get=(type,fragment)=>objects.find(o=>o.type===type&&(fragment===undefined||o.name.includes(fragment)));
const tiles=Array.from({length:W*H},(_,i)=>!model.solidAt(((i%W)+.5)*S,((Math.floor(i/W))+.5)*S,4));
function shortest(from,blocked=new Set()){
 const distances=new Int32Array(W*H);distances.fill(-1);
 const [x,y]=Array.isArray(from)?from:at(from);
 const start=idx(x,y);if(!tiles[start]||blocked.has(start))return distances;
 const queue=[start];distances[start]=0;
 for(let n=0;n<queue.length;n++){
  const i=queue[n],x=i%W,y=Math.floor(i/W);
  for(const [ax,ay] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
   if(ax<0||ay<0||ax>=W||ay>=H)continue;
   const a=idx(ax,ay);
   if(tiles[a]&&!blocked.has(a)&&distances[a]<0){distances[a]=distances[i]+1;queue.push(a)}
  }
 }
 return distances;
}
const metric=(d,o)=>d[idx(...at(o))];
test('R6.14 B1 Tiled physics has two-cell gate, no premium emergency exit shortcut',()=>{
 assert.equal(W,40);assert.equal(H,36);
 assert.equal(model.objects('loot').length,9);
 assert.equal(model.objects('enemy').length,9);
 assert.equal(model.objects('theme-zone').length,6);
 const entrance=get('spawn'),exit=get('extract'),mid=get('loot','U09');
 assert.deepEqual(at(entrance),[4,5]);
 assert.deepEqual(at(exit),[19,33]);
 assert.deepEqual(at(mid),[19,31]);
 for(const y of [23,24]){
  for(const x of [15,16,19,20])assert.equal(tiles[idx(x,y)],false,'closed checkpoint x'+x+',y'+y);
  for(const x of [17,18])assert.equal(tiles[idx(x,y)],true,'two-tile passage x'+x+',y'+y);
 }
 const back=shortest(exit);
 for(const name of ['U07','U08']){
  const o=get('loot',name);
  assert.ok(metric(back,o)>=28,'rare loot must require a real return trip: '+name);
 }
 assert.equal(model.objects('gate').length,0,'B1 must not inherit ground vault gate');
});
test('R6.14 both routes remain physically walkable for a real 12px-radius player',()=>{
 const origin=get('spawn'),exit=get('extract'),vault=get('loot','U08');
 for(const o of objects.filter(o=>['spawn','extract','loot','enemy'].includes(o.type))){
  assert.equal(model.solidAt(o.x,o.y,4),false,'marker overlaps collision: '+o.name);
  assert.ok(metric(shortest(origin),o)>=0,'unreachable marker: '+o.name);
 }
 const standard=metric(shortest(vault),exit);
 const fastLane=new Set([[17,23],[18,23],[17,24],[18,24]].map(p=>idx(...p)));
 const slow=metric(shortest(vault,fastLane),exit);
 assert.ok(standard>=28,'valuable item must be farther than original 9 tiles');
 assert.ok(slow>=standard+8,'western route must be meaningfully longer than guarded center');
 assert.ok(slow>0,'the alternate route must still lead to the same extraction');
});
test('R6.14 premium vault has a single physical two-cell airlock; supplies remain accessible',()=>{
 const entrance=get('spawn');
 const cut=new Set([[22,20],[22,21]].map(p=>idx(...p)));
 const closed=shortest(entrance,cut);
 for(const id of ['U06','U07','U08']){
  assert.equal(metric(closed,get('loot',id)),-1,id+' must not be accessible via upper stores or exit');
 }
 for(const id of ['U01','U02','U03','U04','U05','U09']){
  assert.ok(metric(closed,get('loot',id))>=0,id+' must remain reachable');
 }
 assert.ok(metric(closed,get('extract'))>=0,'ground-independent exit remains reachable');
});
test('R6.14 difficulty changes topology and patrol location, never makes stronger foes',()=>{
 const enemy=model.objects('enemy');
 assert.equal(enemy.length,9);
 assert.equal(model.prop(get('enemy','G02'),'kind'),'fast');
 assert.equal(model.prop(get('enemy','G08'),'kind'),'heavy');
 assert.deepEqual(at(get('enemy','G02')),[18,26]);
 assert.deepEqual(at(get('enemy','G09')),[18,31]);
 assert.equal(model.prop(get('extract'),'destination'),'settlement');
 assert.equal(model.prop(get('spawn'),'bonusSecondsOnEnter'),120);
 const exitZone=model.objects('theme-zone').find(x=>x.name==='地下脱出区画');
 assert.ok(exitZone,'there must be a real exit-zone label in the same Tiled source');
 const [cx,cy]=[get('extract').x,get('extract').y];
 assert.ok(cx>=exitZone.x&&cx<exitZone.x+exitZone.width);
 assert.ok(cy>=exitZone.y&&cy<exitZone.y+exitZone.height);
 const layout=fs.readFileSync(path.join(root,'exploration-layout-v5.js'),'utf8');
 const viewer=fs.readFileSync(path.join(root,'map-inspector.js'),'utf8');
 assert.match(layout,/maps\/basement\/basement\.tmj\?v=R6\.14/);
 assert.match(viewer,/layout\.drawScene\(off,0,0\)/,'audit viewer uses same Tiled drawing as raid');
 assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/exploration-layout-v5\.js\?v=R6\.14/);
 assert.match(fs.readFileSync(path.join(root,'map-inspector.html'),'utf8'),/exploration-layout-v5\.js\?v=R6\.14/);
});
