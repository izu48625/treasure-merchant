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
