'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const css=fs.readFileSync(path.join(root,'exploration.css'),'utf8');
const script=fs.readFileSync(path.join(root,'exploration.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const marker='/* R6.08: return V5 to a full-viewport tactical field';
const override=css.slice(css.lastIndexOf(marker));
function decl(selector){
 const start=override.indexOf(selector+'{');
 assert.ok(start>=0,'R6.08 final override includes '+selector);
 const brace=override.indexOf('{',start),end=override.indexOf('}',brace);
 return override.slice(brace+1,end);
}
const prefix='body.exp-immersive .exp-shell.exp-playing.exp-v5-layout ';
test('R6.08 V5 map canvas covers the entire immersive device viewport, including behind overlay rails',()=>{
 assert.ok(override.length>1800);
 assert.ok(css.lastIndexOf(marker)>css.lastIndexOf('/* R6.04: V5 inventory'));
 const map=decl(prefix+'.exp-map-frame');
 assert.match(map,/position:absolute!important/);
 assert.match(map,/inset:0!important/);
 assert.match(map,/top:0!important/);
 assert.match(map,/bottom:0!important/);
 assert.match(map,/width:100%!important/);
 assert.match(map,/height:100%!important/);
 assert.match(map,/z-index:0!important/);
 assert.doesNotMatch(map,/inset:var\(--v5-canvas-top\)/,
  'later fallback must not shrink gameplay back between rails');
 const field=decl(prefix+'#exp-field');
 assert.match(field,/width:100%!important/);
 assert.match(field,/height:100%!important/);
 assert.match(field,/touch-action:none!important/);
 assert.ok(script.includes('const bounds=el.getBoundingClientRect()'));
 assert.ok(script.includes('Math.max(1,Math.round(bounds.height))'));
 assert.ok(html.includes('exploration.css?v=R6.12'),
  'Safari receives a fresh cache key for the changed layout');
});
test('R6.08 transparent top and bottom HUD layers do not reserve non-map strips',()=>{
 const top=decl(prefix+'.exp-v5-toprail');
 const bottom=decl(prefix+'.exp-controls.exp-v5-bottomdock');
 assert.match(top,/linear-gradient\(/);
 assert.match(top,/pointer-events:none!important/);
 assert.match(top,/border-bottom:0!important/);
 assert.match(bottom,/background:transparent!important/);
 assert.match(bottom,/border-top:0!important/);
 assert.match(bottom,/pointer-events:none!important/);
 assert.match(bottom,/grid-template-columns:minmax\(0,1fr\) minmax\(0,50%\)!important/);
 const actions=decl(prefix+'.exp-v5-bottomdock>.exp-control-actions');
 assert.match(actions,/grid-column:2!important/);
 assert.match(actions,/pointer-events:auto!important/);
 assert.match(css,/\.exp-v5-bottomdock \.exp-action-grid button\s*\{[^}]*min-height:46px!important/);
 assert.match(css,/\.exp-v5-bottomdock \.exp-action-bottom button\s*\{[^}]*min-height:44px!important/);
});
test('R6.08 floating joystick starts anywhere in lower-left quarter, never preoccupies a static button',()=>{
 const zone=decl(prefix+'.exp-v5-bottomdock>#exp-stick-zone');
 assert.match(zone,/position:fixed!important/);
 assert.match(zone,/left:0!important/);
 assert.match(zone,/bottom:0!important/);
 assert.match(zone,/width:50vw!important/);
 assert.match(zone,/height:50dvh!important/);
 assert.match(zone,/touch-action:none!important/);
 assert.match(zone,/pointer-events:auto!important/);
 const cue=decl(prefix+'.exp-v5-bottomdock>#exp-stick-zone:not(.is-active)::before');
 assert.match(cue,/content:none!important/);
 const idle=decl(prefix+'#exp-stick-zone:not(.is-active) #exp-stick.exp-stick-floating');
 const active=decl(prefix+'#exp-stick-zone.is-active #exp-stick.exp-stick-floating');
 assert.match(idle,/display:none!important/);
 assert.match(active,/display:block!important/);
 assert.match(script,/pointer=e.pointerId;originX=e.clientX;originY=e.clientY/);
 assert.match(script,/zone.setPointerCapture\(pointer\)/);
 assert.match(script,/pointermove/);
 assert.match(script,/lostpointercapture/);
});
test('R6.08 is an isolated V5 CSS override, leaving V3/V4 joystick and layout unchanged',()=>{
 const rules=override.split('}').filter(x=>x.includes('{'));
 for(const rule of rules){
  const selector=rule.slice(0,rule.lastIndexOf('{')).trim();
  if(!selector.startsWith('@media')&&!selector.startsWith('/*')){
   assert.ok(selector.includes('exp-v5-layout')||selector.includes('.exp-v5-bottomdock'),
    'V5-only selector '+selector.slice(0,160));
  }
 }
 assert.ok(script.includes("run.mapVersion===5?' exp-v5-layout':''"));
 assert.ok(html.includes('exploration-layout-v5.js?v=R6.12'));
});
