'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const Tiled=require('../maps/indoor/tiled-runtime.js');
const previous=read('maps/indoor/indoor-r5.95.tmj'),current=read('maps/indoor/indoor.tmj');
const sets=[read('maps/indoor/tiles/warehouse.tsj'),read('maps/indoor/tiles/kenney-interior.tsj'),read('maps/indoor/tiles/warehouse-industrial.tsj')];
const a=Tiled.createModel(previous,sets),b=Tiled.createModel(current,sets);
const zones=previous.layers.find(l=>l.name==='InteriorThemes').objects.filter(o=>o.type==='theme-zone');
const inNamedZone=(x,y)=>{
 const px=(x+.5)*16,py=(y+.5)*16;
 return zones.some(z=>px>=z.x&&px<z.x+z.width&&py>=z.y&&py<z.y+z.height);
};
test('R5.96 replaces the exact 575 residual non-room Tiled cells; original nine themed rooms untouched',()=>{
 assert.equal(previous.width,48);assert.equal(previous.height,38);
 assert.deepEqual(previous.tilesets,current.tilesets);
 const prior=previous.layers.filter(l=>l.type==='tilelayer'),later=current.layers.filter(l=>l.type==='tilelayer');
 assert.deepEqual(prior.map(x=>x.name),later.map(x=>x.name));
 const count={};
 for(let i=0;i<prior.length;i++){
  const old=prior[i],newer=later[i];count[old.name]=0;
  for(let y=0;y<38;y++)for(let x=0;x<48;x++){
   const index=y*48+x,p=old.data[index],n=newer.data[index];
   if(p!==n){
    count[old.name]++;
    assert.ok(!inNamedZone(x,y),'changed original themed room '+old.name+' '+x+','+y);
    assert.ok(p>0&&p<583,'changed an already unified or empty cell '+old.name+' '+x+','+y);
    if(old.name==='Patina'||old.name==='Scars')assert.equal(n,0);
    else assert.ok(n>=583&&n<=630,'not an industrial Tiled GID '+old.name+' '+x+','+y);
   }
   if(n>0)assert.ok(n>=583&&n<=630,'legacy Tiled art remains in '+old.name+' '+x+','+y+': '+n);
   assert.equal(Boolean(p),Boolean(n),'cell occupancy must not change '+old.name+' '+x+','+y);
  }
 }
 assert.deepEqual(count,{Floor:260,Patina:18,Scars:60,Walls:226,Furniture:4,SetDressing:7});
 assert.deepEqual(current.layers.filter(l=>l.type!=='tilelayer'),previous.layers.filter(l=>l.type!=='tilelayer'));
 const floor=current.layers.find(l=>l.name==='Floor').data;
 assert.equal(floor.filter(Boolean).length,1502,'all walkable floor cells remain drawn');
 assert.equal(floor.filter(g=>g>=583&&g<=630).length,1502,'all floor now uses one original industrial sheet');
 assert.equal(current.layers.find(l=>l.name==='Walls').data.filter(g=>g>0&&g<583).length,0,'no old boundary wall skins');
});
test('R5.96 preserves all 48x38 movement / LOS / real map route / objects without changing raid logic',()=>{
 for(let y=0;y<38;y++)for(let x=0;x<48;x++){
  const px=(x+.5)*16,py=(y+.5)*16;
  for(const radius of [0,2,4,6,10,12]){
   assert.equal(b.solidAt(px,py,radius),a.solidAt(px,py,radius),
    'physical geometry changed at '+x+','+y+' r='+radius);
  }
  for(const [dx,dy] of [[0,0],[1,1],[-1,-1],[6,-6]])
   assert.equal(b.solidAt(px+dx,py+dy,0),a.solidAt(px+dx,py+dy,0),
    'off-center solid changed at '+x+','+y);
 }
 assert.deepEqual(b.coverRects,a.coverRects);
 assert.deepEqual(Array.from(b.reachable().seen),Array.from(a.reachable().seen));
 for(const type of ['spawn','extract','loot','enemy','keycard','gate','hatch','light','sign','theme-zone','theme-prop']){
  assert.deepEqual(b.objects(type),a.objects(type),'authored objects changed '+type);
 }
 assert.equal(b.prop(b.objects('gate')[0],'oneWay'),true);
 assert.equal(b.prop(b.objects('hatch')[0],'oneWay'),true);
 assert.equal(b.prop(b.objects('gate')[0],'key'),'vault-key');
 for(let i=0;i<120;i++){
  const p={x:(2+(i*17)%44+.5)*16,y:(2+(i*11)%33+.5)*16};
  const q={x:(2+(i*7)%44+.5)*16,y:(2+(i*19)%33+.5)*16};
  assert.equal(b.lineClear(p,q),a.lineClear(p,q),'line-of-sight changed for sample '+i);
 }
});
test('R5.96 draws actual new industrial Tiled floor and boundary walls in off-room connectors',()=>{
 const imgs=[{id:'old'},{id:'kenney'},{id:'industrial'}],calls=[];
 const ctx=new Proxy({canvas:{width:1536,height:1216},drawImage(...xs){calls.push(xs)}},{
  get(t,k){return k in t?t[k]:(()=>{})}
 });
 b.draw(ctx,imgs,{x:0,y:0},2);
 const art=calls.filter(x=>x[0]===imgs[2]);
 assert.ok(art.length>=1502,'all floor tiles should draw from third industrial sprite sheet');
 assert.ok(art.some(x=>x[2]===0),'concrete floor');
 assert.ok(art.some(x=>x[2]===16),'metal wall');
 assert.ok(art.some(x=>x[2]===32),'solid furniture');
 const oldImages=calls.filter(x=>x[0]===imgs[0]||x[0]===imgs[1]);
 assert.equal(oldImages.length,0,'the base map no longer uses legacy raster tiles');
});
