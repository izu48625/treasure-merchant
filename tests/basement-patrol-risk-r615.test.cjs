'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const Tiled=require('../maps/indoor/tiled-runtime.js');
const B1=json('maps/basement/basement.tmj');
const floorSheets=[
 json('maps/indoor/tiles/warehouse.tsj'),
 json('maps/indoor/tiles/kenney-interior.tsj'),
 json('maps/indoor/tiles/warehouse-industrial.tsj')
];
const model=Tiled.createModel(B1,floorSheets);
const obj=name=>model.objects('enemy').find(o=>o.name.startsWith(name));
const tile=(x,y)=>({x:(x+.5)*16,y:(y+.5)*16});
const coord=o=>[Math.floor(o.x/16),Math.floor(o.y/16)];
const grid=(x,y)=>y*B1.width+x;
const steps=(a,b,r=7)=>{
 const length=Math.hypot(b.x-a.x,b.y-a.y),count=Math.max(1,Math.ceil(length/4));
 for(let i=0;i<=count;i++){
  const s=i/count;
  if(model.solidAt(a.x+(b.x-a.x)*s,a.y+(b.y-a.y)*s,r))return false;
 }
 return true;
};
function distances(start,closed=new Set()){
 const d=new Int32Array(B1.width*B1.height);d.fill(-1);
 const [x,y]=Array.isArray(start)?start:coord(start);
 const id=grid(x,y),queue=[id];d[id]=0;
 for(let i=0;i<queue.length;i++){
  const k=queue[i],x=k%B1.width,y=Math.floor(k/B1.width);
  for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
   if(nx<0||ny<0||nx>=B1.width||ny>=B1.height)continue;
   const z=grid(nx,ny),p=tile(nx,ny);
   if(d[z]>=0||closed.has(z)||model.solidAt(p.x,p.y,4))continue;
   d[z]=d[k]+1;queue.push(z);
  }
 }
 return d;
}
async function basementLayout(){
 const src=read('exploration-layout-v5.js');
 const window={TreasureTiledMap:Tiled};
 const asJson={
  'maps/basement/basement.tmj':B1,
  'maps/indoor/tiles/warehouse.tsj':floorSheets[0],
  'maps/indoor/tiles/kenney-interior.tsj':floorSheets[1],
  'maps/indoor/tiles/warehouse-industrial.tsj':floorSheets[2]
 };
 function fetchFile(raw){
  const path=String(raw).split('?')[0];
  if(!asJson[path])throw Error('Unknown Tiled request '+path);
  return Promise.resolve({ok:true,json:async()=>asJson[path]});
 }
 class Image{
  constructor(){this.complete=true;this.naturalWidth=192}
  set src(x){queueMicrotask(()=>this.onload?.())}
 }
 new Function('window','fetch','Image',src)(window,fetchFile,Image);
 return window.TreasureIndoorLayoutV5.loadBasement();
}
test('R6.15 real B1 Tiled map creates cover that blocks northern guard sight but not northern detour',()=>{
 const tiles=json('maps/basement/basement.tmj').layers;
 const furniture=tiles.find(l=>l.name==='Furniture').data;
 for(const [x,y] of [[27,7],[26,11],[33,11]])
  assert.ok(furniture[grid(x,y)]!==0,'authored cover missing at '+x+','+y);
 const west=tile(24,7),sentry=tile(30,7);
 assert.equal(model.lineClear(west,sentry),false,'northern shelf should obstruct direct enemy sight');
 const entry=model.objects('spawn')[0],exit=model.objects('extract')[0];
 const from=distances(entry);
 for(const marker of model.objects().filter(o=>['loot','enemy','spawn','extract'].includes(o.type))){
  const [x,y]=coord(marker);
  assert.equal(model.solidAt(marker.x,marker.y,4),false,'physical object on wall: '+marker.name);
  assert.ok(from[grid(x,y)]>=0,'inaccessible marker '+marker.name);
 }
 assert.ok(from[grid(...coord(exit))]>0,'exit accessible');
 const gateCut=new Set([[22,20],[22,21]].map(([x,y])=>grid(x,y)));
 assert.ok(distances(model.objects('loot').find(o=>o.name.startsWith('U08')),gateCut)[grid(...coord(exit))]>0,
  'detour remains connected even when direct checkpoint is blocked');
});
test('R6.15 checkpoint sentry walks the real central bottleneck, with a readable inspection pause',async()=>{
 const layout=await basementLayout();
 const posts=layout.guardPosts;
 assert.equal(posts.length,9,'number of guards unchanged');
 const fast=posts.find(p=>p.id==='tiled-guard-'+obj('G02').id);
 assert.ok(fast.authoredPatrol);
 assert.equal(fast.kind,'fast');
 assert.equal(fast.patrolMode,'area');
 assert.equal(fast.route.length,5,'central checkpoint loop has five real points');
 assert.equal(fast.pauses[2],2.5,'at checkpoint sentry pauses before return');
 assert.ok(fast.route.some(p=>Math.floor(p.x/48)>=21),'fast guard reaches gate approach');
 for(let i=0;i<fast.route.length;i++){
  const a=fast.route[i],b=fast.route[(i+1)%fast.route.length];
  assert.ok(steps({x:a.x/3,y:a.y/3},{x:b.x/3,y:b.y/3},7),
   'authored patrol crosses physical wall segment '+i);
 }
});
test('R6.15 northern sentry patrol stays inside obstacle geometry, with no surprise buffs or spawns',async()=>{
 const layout=await basementLayout();
 const g06=layout.guardPosts.find(p=>p.id==='tiled-guard-'+obj('G06').id);
 assert.ok(g06.authoredPatrol);
 assert.equal(g06.kind,'normal');
 assert.equal(g06.route.length,4);
 for(let i=0;i<g06.route.length;i++){
  const a=g06.route[i],b=g06.route[(i+1)%g06.route.length];
  assert.ok(steps({x:a.x/3,y:a.y/3},{x:b.x/3,y:b.y/3},7),
   'service-area patrol must not get stuck on shelf '+i);
 }
 assert.equal(model.objects('enemy').length,9);
 assert.equal(model.objects('loot').length,9);
 const entry=model.objects('spawn')[0];
 assert.equal(model.prop(entry,'bonusSecondsOnEnter'),120,'entry timer is unchanged');
 assert.equal(model.objects('extract').length,1);
});
test('R6.15 game honors authored B1 pauses only, and the read-only audit viewer draws the patrol circuits',()=>{
 const game=read('exploration.js'),layout=read('exploration-layout-v5.js');
 const inspector=read('map-inspector.js'),index=read('index.html'),auditHtml=read('map-inspector.html');
 assert.match(layout,/authoredPatrol:!!options\.basement/);
 assert.match(game,/post\.authoredPatrol&&post\.pauses\?\.length===route\.length/);
 assert.match(inspector,/function drawGuardRoutes\(layout\)/);
 assert.match(inspector,/if\(!guard\.authoredPatrol/);
 assert.match(inspector,/drawGuardRoutes\(floor\.layout\)/);
 assert.match(index,/exploration-layout-v5\.js\?v=R6\.15/);
 assert.match(auditHtml,/exploration-layout-v5\.js\?v=R6\.15/);
 assert.match(auditHtml,/map-inspector\.js\?v=R6\.16/);
 assert.equal(read('exploration-layout-v5.js').includes('maps/basement/basement.tmj?v=R6.15'),true);
});
