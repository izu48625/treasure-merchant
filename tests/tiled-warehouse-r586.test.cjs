'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const Tiled=require('../maps/indoor/tiled-runtime.js');
const old=JSON.parse(read('maps/indoor/indoor-r5.84.tmj'));
const fresh=JSON.parse(read('maps/indoor/indoor.tmj'));
const one=JSON.parse(read('maps/indoor/tiles/warehouse.tsj'));
const two=JSON.parse(read('maps/indoor/tiles/kenney-interior.tsj'));
const three=JSON.parse(read('maps/indoor/tiles/warehouse-industrial.tsj'));
const before=Tiled.createModel(old,[one,two]),after=Tiled.createModel(fresh,[one,two,three]);
const index=(x,y)=>y*48+x;
const mapLayers=m=>Object.fromEntries(m.layers.filter(l=>l.type==='tilelayer').map(l=>[l.name,l.data]));
test('R5.86 upgrades the SAME V5 storage map with a Tiled-editable unified industrial sheet',()=>{
 assert.equal(old.width,fresh.width);assert.equal(old.height,fresh.height);
 assert.deepEqual(fresh.tilesets,[
  {firstgid:1,source:'tiles/warehouse.tsj'},
  {firstgid:97,source:'tiles/kenney-interior.tsj'},
  {firstgid:583,source:'tiles/warehouse-industrial.tsj'}]);
 assert.equal(three.tilewidth,16);assert.equal(three.tileheight,16);
 assert.equal(three.imagewidth,128);assert.equal(three.imageheight,96);
 assert.equal(three.tilecount,48);
 const file=fs.readFileSync(path.join(root,'maps/indoor/art/warehouse-industrial.png'));
 assert.equal(file.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.ok(file.length>10000,'a real raster tileset, not a decorative overlay');
 assert.ok(three.tiles.filter(z=>z.properties?.some(p=>p.name==='solid'&&p.value)).length>=24);
 const a=mapLayers(old),b=mapLayers(fresh);assert.deepEqual(Object.keys(a),Object.keys(b));
 const diff={};for(const [name,values] of Object.entries(a)){
  diff[name]=0;
  for(let y=0;y<38;y++)for(let x=0;x<48;x++){
   const i=index(x,y);if(values[i]===b[name][i])continue;
   diff[name]++;
   const inside=x>=34&&x<=45&&y>=18&&y<=28;
   const border=name==='Walls'&&((x===46&&y>=17&&y<=29)||
    ((y===17||y===29)&&x>=34&&x<=45));
   assert.ok(inside||border,'warehouse edit escaped into neighboring area: '+name+' '+x+','+y);
  }
 }
 assert.deepEqual(diff,{Floor:132,Patina:4,Scars:6,Walls:43,
  Furniture:9,SetDressing:6});
 const oldGroups=old.layers.filter(l=>l.type==='objectgroup');
 const newGroups=fresh.layers.filter(l=>l.type==='objectgroup');
 assert.deepEqual(newGroups,oldGroups,'all enemy/loot/room/lighting and authored shelf accents remain intact');
});
test('R5.86 preserves every collision, LOS, supply, enemy position and escape route checkpoint',()=>{
 for(let y=0;y<38;y++)for(let x=0;x<48;x++){
  for(const radius of [0,2,4,6,10]){
   const point={x:(x+.5)*16,y:(y+.5)*16};
   assert.equal(after.solidAt(point.x,point.y,radius),before.solidAt(point.x,point.y,radius),
    'physical collision changed '+x+','+y+' radius '+radius);
  }
 }
 assert.deepEqual(after.coverRects,before.coverRects);
 assert.deepEqual(Array.from(after.reachable().seen),Array.from(before.reachable().seen));
 for(const type of ['spawn','extract','loot','enemy','gate','keycard','hatch'])
  assert.deepEqual(after.objects(type),before.objects(type));
 for(const [a,b] of [
  [{x:616,y:344},{x:696,y:344}],[{x:600,y:352},{x:640,y:384}],
  [{x:600,y:408},{x:700,y:408}],[after.spawn,after.extract]
 ])assert.equal(after.lineClear(a,b),before.lineClear(a,b));
});
test('R5.86 renders the actual new room using the third raster image, with no giant labels',()=>{
 const source0={name:'original'},source1={name:'kenney'},source2={name:'industrial'};
 const draws=[],texts=[];
 const canvas={width:624,height:528};
 const ctx=new Proxy({canvas,drawImage(...args){draws.push(args)},fillText(label){texts.push(label)}},{
  get(target,key){return key in target?target[key]:(()=>{})}
 });
 after.draw(ctx,[source0,source1,source2],{x:34*16,y:18*16},3);
 const art=draws.filter(args=>args[0]===source2);
 assert.ok(art.length>=150,'the entire old warehouse is being graphically reskinned in Tiled');
 assert.ok(art.some(args=>args[1]===0&&args[2]===0),'new slate floor tiles are rendered');
 assert.ok(art.some(args=>args[1]===0&&args[2]===16),'actual steel wall tiles are rendered');
 assert.ok(art.some(args=>args[1]===0&&args[2]===32),'warehouse shelves are real tiles, not floating sprites');
 assert.ok(!texts.includes('INVENTORY / W-06'));
 assert.ok(!texts.includes('STORAGE'));
});
