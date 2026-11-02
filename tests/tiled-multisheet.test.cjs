'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Tiled=require('../maps/indoor/tiled-runtime.js');
const map=JSON.parse(read('maps/indoor/indoor.tmj'));
const base=JSON.parse(read('maps/indoor/tiles/warehouse.tsj'));
const kenney=JSON.parse(read('maps/indoor/tiles/kenney-interior.tsj'));
const sheets=[base,kenney],clone=o=>JSON.parse(JSON.stringify(o));
const drawContext=()=>{
 const calls=[],ctx=new Proxy({canvas:{width:120,height:120},drawImage(...a){calls.push(a)}},{
  get(t,p){return p in t?t[p]:(()=>{})}
 });
 return {calls,ctx};
};
test('R5.82 registers a Tiled-editable, 1px-spaced CC0 sheet without changing any painted GIDs',()=>{
 assert.deepEqual(map.tilesets,[
  {firstgid:1,source:'tiles/warehouse.tsj'},
  {firstgid:97,source:'tiles/kenney-interior.tsj'}
 ]);
 assert.equal(base.tilecount,96);assert.equal(kenney.columns,27);
 assert.equal(kenney.tilewidth,16);assert.equal(kenney.tileheight,16);
 assert.equal(kenney.spacing,1);assert.equal(kenney.tilecount,486);
 assert.equal(kenney.imagewidth,458);assert.equal(kenney.imageheight,305);
 assert.equal(kenney.properties.find(p=>p.name==='license').value,'CC0-1.0');
 assert.ok(fs.statSync(path.join(root,'maps/indoor/art/kenney-roguelike-interior.png')).size>5000);
 const values=map.layers.filter(l=>l.type==='tilelayer').flatMap(l=>l.data.map(v=>(v>>>0)&Tiled.BASE_MASK));
 assert.ok(values.every(id=>id<=96),'no new art painted until a reviewed Tiled room pass');
 const m=Tiled.createModel(map,sheets);
 assert.equal(m.tileForGid(96).index,0);assert.equal(m.tileForGid(97).index,1);
 assert.equal(m.tileForGid(582).index,1);assert.equal(m.tileForGid(583),null);
});
test('R5.82 renderer crops spaced secondary sprites by each tileset firstgid',()=>{
 const altered=clone(map);
 const ix=23*altered.width+40;
 altered.layers.find(l=>l.name==='Floor').data[ix]=97+28;
 const m=Tiled.createModel(altered,sheets);
 const oldImg={tag:'warehouse'},newImg={tag:'kenney'};
 const {ctx,calls}=drawContext();
 m.draw(ctx,[oldImg,newImg],{x:38*16,y:22*16},2);
 const matches=calls.filter(a=>a[0]===newImg);
 assert.equal(matches.length,1,'exactly one additional Kenney sprite is authored');
 assert.deepEqual(matches[0].slice(1,5),[17,17,16,16],
  '1px gutters are cropped away; no accidental neighbor bleeding');
 assert.ok(calls.some(a=>a[0]===oldImg),'unchanged Tiled map sprites still render');
});
test('R5.82 secondary GIDs can be independently declared solid for future Tiled furniture',()=>{
 const changed=clone(map),newSheet=clone(kenney);
 const oldModel=Tiled.createModel(map,sheets);
 const floor=changed.layers.find(l=>l.name==='Floor').data;
 const furniture=changed.layers.find(l=>l.name==='Furniture').data;
 let cell=-1;
 for(let y=18;y<=28&&cell<0;y++)for(let x=34;x<=46;x++){
  const i=y*48+x,px=(x+.5)*16,py=(y+.5)*16;
  if(floor[i]&&!furniture[i]&&!oldModel.solidAt(px,py,2)){cell=i;break}
 }
 assert.notEqual(cell,-1,'warehouse has a walkable Tiled test cell');
 newSheet.tiles=[{id:28,properties:[{name:'solid',type:'bool',value:true}]}];
 furniture[cell]=97+28;
 const withFurniture=Tiled.createModel(changed,[base,newSheet]);
 const px=(cell%48+.5)*16,py=(Math.floor(cell/48)+.5)*16;
 assert.equal(oldModel.solidAt(px,py,2),false);
 assert.equal(withFurniture.solidAt(px,py,2),true);
 assert.equal(withFurniture.blocked.has(97+28),true);
 assert.equal(oldModel.blocked.has(97+28),false);
});
test('R5.82 refuses overlap or mismatched atlas geometry instead of silently corrupting collisions',()=>{
 const overlap=clone(map);overlap.tilesets[1].firstgid=96;
 assert.throws(()=>Tiled.createModel(overlap,sheets),/firstgid/);
 const damaged=clone(kenney);damaged.spacing=3;
 assert.throws(()=>Tiled.createModel(map,[base,damaged]),/geometry|sheet/);
 assert.throws(()=>Tiled.createModel(map,[base]),/tileset list/);
});
test('R5.82 loader skips the unused Kenney PNG but can load it for legacy comparison',async()=>{
 const files=read('exploration-layout-v5.js');
 const run=async search=>{
  const fetched=[],src=[];
  const sandbox={window:{TreasureTiledMap:Tiled,location:{search},URLSearchParams}};
  sandbox.fetch=async url=>{
   fetched.push(url);
   const clean=url.split('?')[0];
   const value=clean.endsWith('indoor.tmj')?map:clean.endsWith('warehouse.tsj')?base:kenney;
   return {ok:true,json:async()=>value};
  };
  sandbox.Image=class{set src(url){src.push(url);queueMicrotask(()=>this.onload?.())}};
  vm.runInNewContext(files,sandbox);
  const layout=await sandbox.window.TreasureIndoorLayoutV5.load();
  return {src,fetched,layout};
 };
 const standard=await run('');
 assert.ok(standard.fetched.some(url=>url.includes('kenney-interior.tsj')));
 assert.ok(!standard.src.some(url=>url.includes('kenney-roguelike-interior.png')),
  'unpainted second sheet must not burden iPhone with extra PNG decode');
 const legacy=await run('?mapArt=legacy');
 assert.ok(legacy.src.some(url=>url.includes('kenney-roguelike-interior.png')));
 assert.equal(standard.layout.w,legacy.layout.w);
 assert.equal(standard.layout.h,legacy.layout.h);
});
