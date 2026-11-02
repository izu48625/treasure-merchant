'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const Tiled=require('../maps/indoor/tiled-runtime.js');
const source=read('maps/indoor/indoor-r5.95.tmj');
const current=read('maps/indoor/indoor.tmj');
const sheets=[
 read('maps/indoor/tiles/warehouse.tsj'),
 read('maps/indoor/tiles/kenney-interior.tsj'),
 read('maps/indoor/tiles/warehouse-industrial.tsj')
];
const old=Tiled.createModel(source,sheets),modern=Tiled.createModel(current,sheets);
const solidWall=(x,y)=>modern.blocked.has(modern.get(current.layers.find(l=>l.name==='Walls'),x,y));
const walkingFloor=(x,y)=>{
 if(x<0||y<0||x>=48||y>=38)return false;
 const f=current.layers.find(l=>l.name==='Floor');
 return modern.get(f,x,y)>0&&!modern.solidAt((x+.5)*16,(y+.5)*16,0);
};
const zones=current.layers.find(l=>l.name==='InteriorThemes').objects.filter(o=>o.type==='theme-zone');
const zoneAt=(x,y)=>zones.find(z=>{
 const px=(x+.5)*16,py=(y+.5)*16;
 return px>=z.x&&py>=z.y&&px<z.x+z.width&&py<z.y+z.height;
});
const themeOf=z=>z?.properties.find(p=>p.name==='style')?.value;
test('R5.97 wall finish uses ONLY actual authored floor beside real solid wall tiles, with no invented barriers',()=>{
 assert.equal(modern.visualFinish.enabled,true);
 assert.equal(old.visualFinish.enabled,false,'historical art never receives R5.97 new overlays');
 const marks=modern.visualFinish.contacts;
 assert.ok(marks.length>=400&&marks.length<=1000,'boundary shadow density is bounded and meaningful');
 for(const mark of marks){
  assert.ok(walkingFloor(mark.x,mark.y),'shadow is not on wall or blocked furniture '+mark.x+','+mark.y);
  const d={top:[0,-1],bottom:[0,1],left:[-1,0],right:[1,0]}[mark.edge];
  assert.ok(d,'unknown edge '+mark.edge);
  assert.ok(solidWall(mark.x+d[0],mark.y+d[1]),'shadow is not grounded in a real metal wall');
 }
});
test('R5.97 subtle themed finish represents all nine authored zones without adding props or affecting historical version',()=>{
 const marks=modern.visualFinish.waymarks;
 const styles=new Set(marks.map(x=>x.style));
 assert.deepEqual([...styles].sort(),[
  'archive','checkpoint','control','corridor','pharmacy','receiving','security','storage','vault'
 ].sort());
 assert.ok(marks.length<150,'trim should be sparse, not a second painted grid');
 const contacts=new Set(modern.visualFinish.contacts.map(x=>x.x+','+x.y+','+x.edge));
 for(const mark of marks){
  assert.ok(contacts.has(mark.x+','+mark.y+','+mark.edge),'trim is not grounded on wall contact');
  assert.equal(themeOf(zoneAt(mark.x,mark.y)),mark.style,'theme mark is placed outside its room');
  assert.match(mark.color,/^#[0-9a-fA-F]{6}$/);
 }
});
test('R5.97 drawing remains cheap in a cropped phone-sized viewport and actually adds shadow plus colored wall trim',()=>{
 const imgs=[{id:'original'},{id:'Kenney'},{id:'industrial'}];
 const fillStyles=[],sourceImages=[];
 const ctx=new Proxy({canvas:{width:390,height:844},_fillStyle:'',
  fillRect(){fillStyles.push(this.fillStyle)},
  drawImage(image){sourceImages.push(image)},
  set fillStyle(v){this._fillStyle=v},get fillStyle(){return this._fillStyle}
 },{get(t,k){return k in t?t[k]:(()=>{})}});
 // A camera spanning security and the common corridor includes both shadows and waymarks.
 modern.draw(ctx,imgs,{x:288,y:155},2);
 assert.ok(fillStyles.includes('rgba(4,12,17,.23)'),'wall-foot shadow pass not rendered');
 assert.ok(sourceImages.filter(x=>x===imgs[2]).length>80,'modern industrial map raster must still render');
 const tinted=fillStyles.filter(x=>['#88d6f0','#e5ca78','#a2e9d5','#b1c4d3'].includes(x));
 assert.ok(tinted.length>=1,'zone-specific wall identification is not visible');
 assert.ok(fillStyles.length<1600,'overlay must be clipped to viewport and suitable for phone rendering');
});
test('R5.97 shelf-foot shadows come from existing solid cabinets beside actual walkable Tiled cells',()=>{
 const feet=modern.visualFinish.fixtureFeet;
 assert.ok(feet.length>=15&&feet.length<80,'fixed warehouse furniture shadows are subtle and bounded');
 const furniture=current.layers.find(l=>l.name==='Furniture');
 const floor=current.layers.find(l=>l.name==='Floor');
 const walls=current.layers.find(l=>l.name==='Walls');
 const dressing=current.layers.find(l=>l.name==='SetDressing');
 for(const e of feet){
  assert.ok(modern.blocked.has(modern.get(furniture,e.x,e.y-1)),'no actual solid shelf above contact');
  assert.ok(modern.get(floor,e.x,e.y)>0,'fixture foot not on floor');
  assert.ok(!modern.blocked.has(modern.get(walls,e.x,e.y)),'fixture shadow inside wall');
  assert.ok(!modern.blocked.has(modern.get(furniture,e.x,e.y)),'fixture shadow inside solid furniture');
  assert.ok(!modern.blocked.has(modern.get(dressing,e.x,e.y)),'fixture shadow inside solid dressing');
 }
});
test('R5.97 can compare the same exact map with visual finishing off/on without changing layout',()=>{
 const images=[{id:0},{id:1},{id:2}];
 const mock=()=>{
  let foot=0,furniture=0;
  const ctx=new Proxy({canvas:{width:768,height:608},drawImage(){},fillRect(){
   if(this.fillStyle==='rgba(4,12,17,.23)')foot++;
   if(this.fillStyle==='rgba(7,15,20,.26)')furniture++;
  }},{get(t,k){return k in t?t[k]:(()=>{})}});
  return {ctx,counts:()=>({foot,furniture})};
 };
 modern.setVisualFinishMode(false);
 const before=mock();modern.draw(before.ctx,images,{x:0,y:0},1);
 modern.setVisualFinishMode(true);
 const after=mock();modern.draw(after.ctx,images,{x:0,y:0},1);
 assert.deepEqual(before.counts(),{foot:0,furniture:0});
 assert.ok(after.counts().foot>0,'real wall-foot finishing shown when enabled');
 assert.ok(after.counts().furniture>0,'real shelf depth shown when enabled');
 assert.equal(modern.reachable().count,old.reachable().count,'purely visual mode cannot create a route');
});
test('R5.97 art-only change keeps 5-minute V5 geography, LOS, hazards, loot, goals and saved layouts intact',()=>{
 for(let y=0;y<38;y++)for(let x=0;x<48;x++){
  const px=(x+.5)*16,py=(y+.5)*16;
  for(const r of [0,2,4,6,10,12]){
   assert.equal(modern.solidAt(px,py,r),old.solidAt(px,py,r),'collision '+x+','+y+' r='+r);
  }
 }
 assert.deepEqual(modern.coverRects,old.coverRects);
 assert.deepEqual(Array.from(modern.reachable().seen),Array.from(old.reachable().seen));
 for(const type of ['spawn','extract','loot','enemy','keycard','gate','hatch','theme-zone','theme-prop','sign','light'])
  assert.deepEqual(modern.objects(type),old.objects(type));
});
