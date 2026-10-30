const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const text=p=>fs.readFileSync(path.join(root,p),'utf8');
const map=JSON.parse(text('maps/indoor/indoor.tmj'));
const tiles=JSON.parse(text('maps/indoor/tiles/warehouse.tsj'));
const {createModel}=require('../maps/indoor/tiled-runtime.js');
async function load(){
 const sandbox={window:{TreasureTiledMap:{createModel}}};
 sandbox.fetch=async resource=>({
  ok:true,json:async()=>JSON.parse(text(resource.replace(/\?.*$/,'')))
 });
 sandbox.Image=class {
  set src(value){this.source=value;queueMicrotask(()=>this.onload?.())}
 };
 vm.runInNewContext(text('exploration-layout-v5.js'),sandbox,{filename:'exploration-layout-v5.js'});
 return sandbox.window.TreasureIndoorLayoutV5.load();
}
test('R5.33 production adapter loads R5.32 artwork and uses a separate terrain version',async()=>{
 const layout=await load();
 assert.equal(layout.w,2304);assert.equal(layout.h,1824);
 assert.equal(layout.rooms.length,6);
 assert.equal(layout.fixedExit.id,'indoor-exit-01');
 assert.ok(!layout.solid(layout.start.x,layout.start.y,12));
 assert.ok(!layout.solid(layout.fixedExit.x,layout.fixedExit.y,12));
 assert.notDeepEqual(layout.start,layout.fixedExit);
});
test('R5.33 original loot markers become 11 sealed production caches',async()=>{
 const layout=await load(),cache=layout.rollContainers();
 assert.equal(cache.length,11);
 assert.equal(cache.filter(x=>x.tier==='standard').length,3);
 assert.equal(cache.filter(x=>x.tier==='mid').length,4);
 assert.equal(cache.filter(x=>x.tier==='high').length,2);
 assert.equal(cache.filter(x=>x.tier==='ultra').length,2);
 assert.ok(layout.vaultGate&&layout.vaultKeycard&&layout.vaultHatch);
 assert.ok(cache.every(x=>!layout.solid(x.x,x.y,12)));
 assert.ok(layout.validContainers(cache,()=>true));
 assert.equal(layout.validContainers(cache.map((x,i)=>i===0?{...x,x:x.x+3}:x),()=>true),false);
 assert.equal(layout.validContainers(cache.map((x,i)=>i===0?{...x,contents:[{id:'not-an-item'}]}:x),v=>v?.id!=='not-an-item'),false);
 assert.equal(layout.validContainers(cache.slice(1),()=>true),false);
});
test('R5.56 nine sentries, including alarm-only return guards, use existing enemy types',async()=>{
 const layout=await load(),posts=layout.guardPosts;
 assert.equal(posts.length,9);
 assert.equal(new Set(posts.map(p=>p.id)).size,9);
 assert.equal(posts.filter(p=>p.alarmOnly).length,2);
 assert.ok(posts.every(p=>['normal','fast','heavy'].includes(p.kind)));
 assert.ok(posts.every(p=>!layout.solid(p.x,p.y,12)));
});
test('R5.33 all caches and fixed extraction have collision-safe walking routes',async()=>{
 const layout=await load(),targets=[layout.fixedExit,...layout.rollContainers()];
 function travel(target){
  const p={...layout.start};
  for(let i=0;i<900;i++){
   if(Math.hypot(p.x-target.x,p.y-target.y)<30)return true;
   const next=layout.lineClear(p,target)?target:layout.nextWaypoint(p,target);
   const d=Math.hypot(next.x-p.x,next.y-p.y);
   if(d<.01)return false;
   const dx=(next.x-p.x)/d*Math.min(d,8),dy=(next.y-p.y)/d*Math.min(d,8);
   if(!layout.solid(p.x+dx,p.y,12))p.x+=dx;
   if(!layout.solid(p.x,p.y+dy,12))p.y+=dy;
  }
  return false;
 }
 for(const c of targets)assert.ok(travel(c),'inaccessible: '+(c.id||'target'));
});
test('R5.33 core loads V5 before gameplay and guards V5 checkpoints until loading finishes',()=>{
 const html=text('index.html'),main=text('exploration.js');
 assert.ok(html.indexOf('tiled-runtime.js')<html.indexOf('exploration-layout-v5.js'));
 const coreScript=html.search(/exploration\.js\?v=R[\d.]+/);
 assert.ok(coreScript>=0&&html.indexOf('exploration-layout-v5.js')<coreScript,'V5 adapter must precede current exploration script');
 assert.match(main,/c\.mapVersion===5&&!MallV5/);
 assert.match(main,/layout===MallV5\?5:/);
 assert.match(main,/data-explore="layout-tiled"/);
 assert.match(main,/layout\.validContainers\(c\.containers,rewardValid\)/);
 assert.match(main,/saveWithCommit\(/);
 assert.match(main,/settleRun\('escaped'\)/);
 assert.doesNotMatch(text('maps/indoor/indoor-demo.js'),/saveWithCommit|state\.inv/);
});

test('R5.57 evacuation shutters leave exactly one branch-free escape route',async()=>{
 const m=createModel(map,tiles),layout=await load(),size=m.map.width*m.map.height,w=m.map.width;
 const tile=m.map.tilewidth,worldTile=tile*3;
 const cell=p=>Math.floor(p.y/worldTile)*w+Math.floor(p.x/worldTile);
 const route=layout.escapeRoute.map(cell);
 const allowed=new Set(route);
 assert.equal(route.length,35,'a deliberate walkable route reaches the northeast exit');
 assert.equal(route[0],cell(layout.vaultHatch.landing));
 assert.equal(route.at(-1),cell(layout.fixedExit));
 assert.equal(allowed.size,route.length,'the forced escape route cannot loop');
 const neighbors=i=>{
  const x=i%w,y=Math.floor(i/w);
  return [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<m.map.height-1?i+w:-1]
   .filter(n=>n>=0);
 };
 for(let i=0;i<route.length;i++){
  const links=neighbors(route[i]).filter(n=>allowed.has(n));
  assert.equal(links.length,i===0||i===route.length-1?1:2,
   'no shortcuts, forks or cycles at escape step '+i);
  const p=layout.escapeRoute[i];
  assert.equal(layout.escapeShutterSolid(p.x,p.y,12),false);
  assert.equal(layout.solid(p.x,p.y,12),false);
 }
 const shutters=new Set(layout.escapeShutters.map(b=>cell(b)));
 assert.ok(shutters.size>=30,'branch approaches receive visible metal shutters');
 assert.equal([...shutters].some(i=>allowed.has(i)),false);
 const queue=[route[0]],reachable=new Set(queue);
 for(let j=0;j<queue.length;j++){
  for(const next of neighbors(queue[j])){
   const x=next%w,y=Math.floor(next/w);
   if(reachable.has(next)||shutters.has(next)||
    m.solidAt((x+.5)*tile,(y+.5)*tile,3))continue;
   reachable.add(next);queue.push(next);
  }
 }
 assert.equal(reachable.size,route.length,
  'the player cannot leave the corridor through unsealed side passages');
 for(const post of layout.guardPosts.filter(p=>p.alarmOnly)){
  assert.ok(allowed.has(cell(post)),post.id+' must intercept the forced passage');
  assert.ok(post.route.length>=2,'alarm sentry patrol is valid');
  assert.ok(post.route.every(p=>allowed.has(cell(p))),
   post.id+' guard patrol remains on the forced route');
 }
 const blocked=layout.escapeShutters[0];
 const center={x:blocked.x+worldTile/2,y:blocked.y+worldTile/2};
 assert.equal(layout.solid(center.x,center.y,12),false,
  'shutters do not permanently modify the original facility');
 assert.equal(layout.escapeShutterSolid(center.x,center.y,12),true);
 const recovered=layout.nearestEscapePoint(center,17);
 assert.ok(allowed.has(cell(recovered)),
  'old checkpoint positions blocked by new shutters migrate to the route');
 const oldDetour=layout.nearestEscapePoint(layout.start,17);
 assert.ok(allowed.has(cell(oldDetour)),
  'a post-hatch checkpoint in a previously accessible wing must also snap to the forced corridor');
});

test('R5.58 sheltered escape variant has five dead-end hideouts and no bypass loops',async()=>{
 const m=createModel(map,tiles),layout=await load(),w=m.map.width,tile=m.map.tilewidth*3;
 const cell=p=>Math.floor(p.y/tile)*w+Math.floor(p.x/tile);
 const trunk=new Set(layout.escapeRoute.map(cell));
 const alcoves=new Set(layout.escapeNiches.map(cell));
 const expanded=new Set(layout.escapeCoverLaneCells.map(cell));
 const allowed=new Set([...trunk,...alcoves,...expanded]);
 assert.equal(alcoves.size,5);
 assert.equal(layout.escapeCoverObjects.length,5);
 assert.equal(expanded.size,24,'B corridor expands by 24 cells without opening extra rooms');
 assert.equal(layout.escapeLaneObjects.length,9,'nine alternating physical cover obstacles');
 assert.ok(layout.escapeCoverShutters.length<layout.escapeShutters.length);
 const adj=i=>{const x=i%w,y=Math.floor(i/w);return [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<37?i+w:-1].filter(j=>j>=0)};
 for(const i of alcoves){
  assert.equal(adj(i).filter(j=>trunk.has(j)).length,1,'every hiding niche touches one trunk cell');
  assert.equal(adj(i).filter(j=>allowed.has(j)).length,1,'hideouts are dead ends, not shortcuts');
  const point={x:((i%w)+.5)*tile,y:(Math.floor(i/w)+.5)*tile};
  assert.equal(layout.escapeShutterSolid(point.x,point.y,1,'strict'),true);
  assert.equal(layout.escapeShutterSolid(point.x,point.y,1,'cover'),false);
 }
 const closed=new Set(layout.escapeCoverShutters.map(cell)),visited=new Set([cell(layout.vaultHatch.landing)]),queue=[cell(layout.vaultHatch.landing)];
 for(let j=0;j<queue.length;j++)for(const next of adj(queue[j])){
  const pos={x:((next%w)+.5)*tile/3,y:(Math.floor(next/w)+.5)*tile/3};
  if(visited.has(next)||closed.has(next)||m.solidAt(pos.x,pos.y,3))continue;
  visited.add(next);queue.push(next);
 }
 assert.equal(visited.size,allowed.size,'B route stays inside its widened corridor and five hideouts');
 assert.ok([...visited].every(i=>allowed.has(i)));
 assert.equal(layout.themeZones.length,9);
 assert.equal(layout.themeAt({x:120*3,y:210*3}),'薬局');
 assert.equal(layout.themeAt({x:450*3,y:205*3}),'警備室');
});

test('R5.58 every optional hiding bay admits a full-size player from the main corridor',async()=>{
 const layout=await load();
 for(const niche of layout.escapeNiches){
  const p={x:niche.x,y:niche.y};
  // Bodies have a 12px radius in the real exploration controller.
  assert.equal(layout.solid(p.x,p.y,12),false,'original themed floor is walkable');
  assert.equal(layout.escapeBarrierSolid(p.x,p.y,12,'cover'),false,
   'cover furniture must not block the alcove center');
  for(let dx=48;dx>=0;dx-=4){
   assert.equal(layout.solid(p.x+dx,p.y,12),false,
    'wall collision blocks entrance to hiding bay');
   assert.equal(layout.escapeBarrierSolid(p.x+dx,p.y,12,'cover'),false,
    'shutter or cover blocks entrance to hiding bay');
  }
  assert.equal(layout.escapeShutterSolid(p.x,p.y,12,'strict'),true,
   'strict evacuation must seal the optional hiding bay');
 }
});

test('R5.63 widened B corridor provides traversable 2-3-cell lanes, real physical cover and strict A unchanged',async()=>{
 const m=createModel(map,tiles),layout=await load(),size=map.tilewidth*3,cols=map.width;
 const cell=(x,y)=>({x:(x+.5)*size,y:(y+.5)*size});
 const floor=(p)=>!layout.solid(p.x,p.y,12);
 const accessible=(p,variant)=>floor(p)&&!layout.escapeBarrierSolid(p.x,p.y,12,variant);
 assert.equal(layout.escapeRoute.length,35,'A original fixed single-tile trunk');
 assert.equal(layout.escapeCoverLaneCells.length,24);
 assert.equal(layout.escapeLaneObjects.length,9);
 for(const y of [11,13,15,17,25]){
  const c=cell(39,y);
  assert.ok(accessible(c,'cover'),'second lane walkable at row '+y);
  assert.equal(layout.escapeShutterSolid(c.x,c.y,1,'strict'),true,'A remains closed at row '+y);
 }
 for(const y of [19,21,23]){
  const c=cell(40,y);
  assert.ok(accessible(c,'cover'),'third passing lane open at row '+y);
 }
 for(const o of layout.escapeLaneObjects){
  const p={x:o.x+o.w/2,y:o.y+o.h/2};
  assert.equal(layout.escapeBarrierSolid(p.x,p.y,1,'cover'),true,'physical cover obstructs '+o.kind);
  assert.equal(layout.escapeBarrierSolid(p.x,p.y,1,'strict'),false,'A contains no B-only furniture');
  const rayA={x:o.x-18,y:p.y},rayB={x:o.x+o.w+18,y:p.y};
  assert.equal(layout.visionClear(rayA,rayB,true,'cover'),false,'enemy cannot see through '+o.kind);
 }
 // Use the production actor radius and the route's exact physical mask,
 // not an illustrative simplified graph. BFS must reach the real northeast exit.
 const from=layout.vaultHatch.landing,to=layout.fixedExit;
 const toCell=p=>Math.floor(p.y/size)*cols+Math.floor(p.x/size);
 const start=toCell(from),finish=toCell(to),q=[start],visited=new Set([start]);
 const dirs=[[-1,0],[1,0],[0,-1],[0,1]];
 for(let h=0;h<q.length&& !visited.has(finish);h++){
  const i=q[h],x=i%cols,y=Math.floor(i/cols);
  for(const [dx,dy] of dirs){
   const nx=x+dx,ny=y+dy;if(nx<0||nx>=cols||ny<0||ny>=map.height)continue;
   const n=ny*cols+nx,p=cell(nx,ny);
   if(visited.has(n)||!accessible(p,'cover'))continue;
   visited.add(n);q.push(n);
  }
 }
 assert.ok(visited.has(finish),'full-radius actor can navigate B from hatch to extraction');
 for(const niche of layout.escapeNiches)assert.ok(visited.has(toCell(niche)),
  'all five original hiding bays remain reachable');
 const aCenter=cell(38,22),bCenter=cell(39,22);
 assert.equal(accessible(aCenter,'cover'),false,'alternating prop forces actual detour');
 assert.equal(accessible(bCenter,'cover'),true,'adjacent broadened lane permits detour');
});
