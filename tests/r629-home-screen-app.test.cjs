'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html');
const manifest=JSON.parse(read('manifest.webmanifest'));
const icon=read('assets/app-icon.svg');
const pngPaths=[[180,'assets/app-icon-180.png'],[192,'assets/app-icon-192.png'],[512,'assets/app-icon-512.png']];
test('R6.29 Home Screen metadata enables standalone without changing viewport sizing',()=>{
 assert.match(html,/<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/);
 assert.match(html,/<meta name="apple-mobile-web-app-capable" content="yes">/);
 assert.match(html,/<meta name="apple-mobile-web-app-title" content="財宝商会">/);
 assert.match(html,/<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">/);
 assert.match(html,/<meta name="theme-color" content="#102420">/);
 assert.match(html,/<link rel="manifest" href="\.\/manifest\.webmanifest">/);
 assert.match(html,/<link rel="icon" href="\.\/assets\/app-icon\.svg" type="image\/svg\+xml">/);
 assert.match(html,/<link rel="apple-touch-icon" sizes="180x180" href="\.\/assets\/app-icon-180\.png">/);
});
test('R6.29 manifest opens repository root, not a different game, and supports both rotations',()=>{
 assert.equal(manifest.id,'/treasure-merchant/');
 assert.equal(manifest.start_url,'/treasure-merchant/');
 assert.equal(manifest.scope,'/treasure-merchant/');
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.orientation,'any');
 assert.match(manifest.name,/財宝商会/);
 assert.equal(manifest.lang,'ja');
 assert.deepEqual(manifest.icons.map(i=>i.src),[
  '/treasure-merchant/assets/app-icon-192.png',
  '/treasure-merchant/assets/app-icon-512.png',
  '/treasure-merchant/assets/app-icon.svg'
 ]);
 assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512','any']);
 assert.deepEqual(manifest.icons.map(i=>i.type),['image/png','image/png','image/svg+xml']);
});
test('R6.29 icon is self-contained SVG and retains generous maskable padding',()=>{
 assert.match(icon,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 512 512"/);
 assert.match(icon,/<rect width="512" height="512" rx="112"/);
 assert.match(icon,/<title id="title">時空の財宝商会<\/title>/);
 assert.doesNotMatch(icon,/<(?:image|script)\b/i);
 assert.doesNotMatch(icon,/(?:href|src)=["']https?:\/\//i);
});
test('R6.29 remains online-first: no new offline caching or game-state migration',()=>{
 assert.doesNotMatch(html,/navigator\.serviceWorker\.register/);
 const game=read('exploration.js');
 assert.ok(game.includes('function refreshAfterPhoneRotation(){'));
 assert.ok(game.includes('function v5CameraScale(){'));
 assert.ok(game.includes('function v5CompactHudBrief('));
 assert.match(html,/exploration\.css\?v=R6\.28/);
 assert.match(html,/exploration\.js\?v=R6\.28/);
});

test('R6.29 PNG assets are real PNG files at declared dimensions',()=>{
 for(const [size,p] of pngPaths){
  const image=fs.readFileSync(path.join(root,p));
  assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a',p);
  assert.equal(image.readUInt32BE(16),size,p+' width');
  assert.equal(image.readUInt32BE(20),size,p+' height');
 }
});
