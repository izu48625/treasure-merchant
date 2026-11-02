'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Tiled=require('../maps/indoor/tiled-runtime.js');
const old=JSON.parse(read('maps/indoor/indoor-r5.82.tmj'));
const fresh=JSON.parse(read('maps/indoor/indoor.tmj'));
const sheets=[JSON.parse(read('maps/indoor/tiles/warehouse.tsj')),JSON.parse(read('maps/indoor/tiles/kenney-interior.tsj'))];
const baseline=Tiled.createModel(old,sheets),model=Tiled.createModel(fresh,sheets);
const tileLayers=m=>Object.fromEntries(m.layers.filter(l=>l.type==='tilelayer').map(l=>[l.name,l.data]));
const objects=m=>m.layers.filter(l=>l.type==='objectgroup');
const i=(x,y)=>y*48+x,inRoom=(x,y)=>x>=34&&x<=45&&y>=18&&y<=28;
test('R5.83 freezes exact pre-remodel Tiled source and changes only storage cell artwork',()=>{
 assert.equal(old.width,48);assert.equal(fresh.width,48);assert.equal(old.height,38);
 assert.deepEqual(old.tilesets,fresh.tilesets,'firstgid and source paths must remain stable');
 assert.deepEqual(objects(old),objects(fresh),'every loot/guard, lamp, sign, room and vault object is unchanged');
 const a=tileLayers(old),b=tileLayers(fresh),names=Object.keys(a);
 assert.deepEqual(names,Object.keys(b));
 const changed={};
 for(const name of names){
  let count=0;
  for(let y=0;y<38;y++)for(let x=0;x<48;x++){
   if(a[name][i(x,y)]===b[name][i(x,y)])continue;
   assert.ok(inRoom(x,y),'art edit leaked into '+name+' tile '+x+','+y);
   count++;
  }
  changed[name]=count;
 }
 assert.deepEqual(changed,{Floor:71,Patina:16,Scars:8,Walls:0,Furniture:9,SetDressing:5});
});
test('R5.83 actual warehouse tile sprites are opaque-location furniture at exactly the old solid shelves',()=>{
 const a=tileLayers(old),b=tileLayers(fresh);
 const expected=new Map([['36,20',475],['36,21',477],['36,22',479],
  ['42,20',475],['42,21',477],['42,22',479],
  ['35,28',482],['36,28',482],['43,28',482]]);
 let total=0;
 for(let y=0;y<38;y++)for(let x=0;x<48;x++){
  const gid=b.Furniture[i(x,y)];
  if(gid<97)continue;
  total++;
  assert.equal(gid,expected.get(x+','+y));
  assert.equal(baseline.blocked.has(a.Furniture[i(x,y)]),true,
   'replace only a truly solid old furniture cell');
  assert.equal(model.blocked.has(gid),true,'new Kenney sprite must remain collidable');
 }
 assert.equal(total,9);
 for(const gid of new Set(expected.values()))assert.ok(model.tileForGid(gid));
 const fsGids=fresh.layers.filter(l=>l.type==='tilelayer').flatMap(l=>l.data.filter(v=>v>=97));
 assert.equal(fsGids.length,9);
});
test('R5.83 all world collision, line-of-sight samples and original key/exit reachability remain identical',()=>{
 for(let y=0;y<38;y++)for(let x=0;x<48;x++){
  for(const r of [0,2,4,6]){
   const px=(x+.5)*16,py=(y+.5)*16;
   assert.equal(model.solidAt(px,py,r),baseline.solidAt(px,py,r),
    'collision changed at '+x+','+y+' radius '+r);
  }
 }
 const positions=[model.spawn,model.extract,...model.objects('loot'),...model.objects('enemy'),
  ...model.objects('gate'),...model.objects('keycard'),...model.objects('hatch')];
 for(const pos of positions)assert.equal(model.solidAt(pos.x,pos.y,3),false,pos.name);
 assert.deepEqual(Array.from(model.reachable().seen),Array.from(baseline.reachable().seen));
 const rays=[
  [{x:616,y:344},{x:696,y:344}],
  [{x:600,y:352},{x:640,y:384}],
  [{x:600,y:408},{x:700,y:408}],
  [model.spawn,model.extract]
 ];
 for(const [a,b] of rays)assert.equal(model.lineClear(a,b),baseline.lineClear(a,b),
  'line of sight changed for existing gameplay checkpoints');
});
test('R5.83 the two maps render independently, with nine actual Kenney tiles and no old giant warehouse stencil',()=>{
 const canvas={width:624,height:528};
 const render=target=>{
  const calls=[],labels=[];
  const ctx=new Proxy({canvas,drawImage(...args){calls.push(args)},fillText(text){labels.push(text)}},{
   get(obj,key){return key in obj?obj[key]:(()=>{})}
  });
  const baseImg={type:'base'},extraImg={type:'kenney'};
  target.draw(ctx,[baseImg,extraImg],{x:34*16,y:18*16},3);
  return {calls,labels,baseImg,extraImg};
 };
 const before=render(baseline),after=render(model);
 assert.equal(before.calls.filter(c=>c[0]===before.extraImg).length,0);
 const extras=after.calls.filter(c=>c[0]===after.extraImg);
 assert.equal(extras.length,9,'new warehouse furniture is now true Tiled graphics, not JS overlays');
 for(const draw of extras)assert.equal(draw[3],16);
 assert.ok(!after.labels.includes('INVENTORY / W-06'),'giant floor lettering remains off');
});
