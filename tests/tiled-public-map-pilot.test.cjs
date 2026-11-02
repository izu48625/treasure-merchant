'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),vm=require('node:vm');
const root=path.join(__dirname,'..'),dir=path.join(root,'maps/public-map-pilot');
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');
const original=read('sample-original.tmx'),adapted=read('sample-industrial-adapted.tmx');
const layerXml=xml=>Array.from(xml.matchAll(/<layer\b[^>]*name="([^"]+)"[^>]*>[\s\S]*?<\/layer>/g),m=>({name:m[1],xml:m[0]}));
test('R5.85 imports the real 50x50 Kenney CC0 Tiled source without rewriting its original layers',()=>{
 assert.match(original,/<map [^>]*width="50" height="50" tilewidth="16" tileheight="16"/);
 const a=layerXml(original),b=layerXml(adapted);
 assert.equal(a.length,5);assert.equal(b.length,6);
 for(const o of a){
  const match=b.find(x=>x.name===o.name);
  assert.ok(match,'missing original '+o.name);
  assert.equal(match.xml,o.xml,'original map layer modified: '+o.name);
  const raw=o.xml.match(/<data encoding="base64" compression="zlib">([\s\S]*?)<\/data>/)[1].trim();
  const buf=zlib.inflateSync(Buffer.from(raw,'base64'));
  assert.equal(buf.byteLength,50*50*4,'sample layer must contain 2500 GIDs');
 }
 assert.match(adapted,/<tileset firstgid="1171" source="roguelikeIndoor_transparent.tsx"\/>/);
 assert.match(adapted,/<tileset firstgid="1639" source="roguelikeSheet_transparent.tsx"\/>/);
});
test('R5.85 modifies only a clearly isolated new industrial floor layer and 10 furniture objects',()=>{
 const x=layerXml(adapted).find(x=>x.name==='Treasure Industrial Floor (sandbox)');
 assert.ok(x);
 const raw=x.xml.match(/<data encoding="csv">([\s\S]*?)<\/data>/)[1];
 const values=raw.split(',').map(Number);
 assert.equal(values.length,2500);
 assert.equal(values.filter(v=>v!==0).length,132);
 const allowed=new Set([2558,2559,2616]);
 for(let i=0;i<values.length;i++){
  if(!values[i])continue;
  const px=i%50,py=Math.floor(i/50);
  assert.ok(px>=34&&px<46&&py>=30&&py<41,'tile spills outside edit area');
  assert.ok(allowed.has(values[i]),'non-source tile inserted');
 }
 const group=adapted.match(/<objectgroup name="Treasure Industrial Props \(sandbox\)"[\s\S]*?<\/objectgroup>/);
 assert.ok(group);
 const gids=Array.from(group[0].matchAll(/<object id="(\d+)" name="([^"]+)" type="facility-prop" gid="(\d+)" x="(\d+)" y="(\d+)" width="16" height="16"/g));
 assert.equal(gids.length,10);
 assert.equal(new Set(gids.map(x=>x[1])).size,10);
 for(const [,id,name,gid,x,y] of gids){
  assert.ok(+gid>=1171&&+gid<1639);
  assert.ok(+x>=34*16&&+x<46*16&&+y>=30*16&&+y<42*16);
 }
 assert.match(original,/nextobjectid="1"/);
 assert.match(adapted,/nextobjectid="111"/);
});
test('R5.85 retains the editable source tilesets, PNG binaries, CC0 license and working comparison-script syntax',()=>{
 for(const name of ['roguelikeChar','roguelikeDungeon','roguelikeIndoor','roguelikeSheet']){
  const tsx=read(name+'_transparent.tsx');
  assert.match(tsx,/<tileset/);
  assert.match(tsx,new RegExp(name+'_transparent\\.png'));
  const png=fs.readFileSync(path.join(dir,name+'_transparent.png'));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.ok(png.length>10000);
 }
 assert.match(read('KENNEY_CC0_SOURCE_LICENSE.txt'),/Creative Commons Zero|CC0/);
 const html=read('index.html');
 assert.match(html,/sample-original\.tmx/);
 assert.match(html,/sample-industrial-adapted\.tmx/);
 assert.match(html,/DecompressionStream\('deflate'\)/);
 assert.match(html,/Treasure Industrial/);
 const js=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(js);assert.doesNotThrow(()=>new vm.Script(js[1]));
});
