'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const js=read('exploration.js');
const css=read('exploration.css');
const html=read('index.html');
const marker='/* R6.26: landscape phone raid layout';
const landscape=css.slice(css.indexOf(marker));
const box=(left,top,right,bottom)=>({left,top,right,bottom,width:right-left,height:bottom-top});

test('R6.26 phone landscape CSS is scoped to coarse touch and V5, portrait and desktop stay unchanged',()=>{
 assert.ok(css.includes(marker),'landscape block exists');
 assert.match(landscape,/@media \(orientation:landscape\) and \(max-height:650px\) and \(pointer:coarse\)/);
 assert.match(landscape,/grid-template-areas:"hud hud stealth pause" "objective objective room map"!important/);
 assert.match(landscape,/grid-template-columns:minmax\(0,1fr\) 76px 100px 106px!important/);
 assert.match(landscape,/grid-template-columns:minmax\(0,1fr\) 194px!important/);
 assert.match(landscape,/width:50vw!important;height:50dvh!important/);
 assert.match(landscape,/env\(safe-area-inset-left\)/);
 assert.match(landscape,/env\(safe-area-inset-right\)/);
 assert.match(landscape,/\.exp-backpack\.exp-bag-open\{/);
 assert.match(landscape,/max-height:none!important/);
 for(const line of landscape.split('\n')){
  if(line.trim().startsWith('body.exp-immersive')){
   assert.ok(line.includes('.exp-v5-layout'),line);
  }
 }
 assert.match(html,/exploration\.css\?v=R6\.26/);
 assert.match(html,/exploration\.js\?v=R6\.26/);
});
test('R6.26 rotation recomputes actual canvas dimensions without restarting or altering saved raid state',()=>{
 const a=js.indexOf('function resizeField(){'),b=js.indexOf('function mount(){',a);
 assert.ok(a>=0&&b>a);
 let rect=box(0,0,390,844);
 const canvas={width:0,height:0,getBoundingClientRect:()=>rect};
 let draws=0,chrome=0;
 const document={getElementById:id=>id==='exp-field'?canvas:null};
 const VIEW={w:360,h:416};
 const run={mapVersion:5,status:'playing',paused:false,start:42,loot:[{id:'sealed'}]};
 const resize=new Function('document','run','VIEW','syncV5Chrome','draw',
  js.slice(a,b)+'\nreturn resizeField;'
 )(document,run,VIEW,()=>chrome++,()=>draws++);
 resize();
 assert.deepEqual({w:VIEW.w,h:VIEW.h},{w:390,h:844});
 assert.deepEqual({w:canvas.width,h:canvas.height},{w:390,h:844});
 rect=box(0,0,844,390);
 resize();
 assert.deepEqual({w:VIEW.w,h:VIEW.h},{w:844,h:390});
 assert.deepEqual({w:canvas.width,h:canvas.height},{w:844,h:390});
 rect=box(0,0,390,844);
 resize();
 assert.deepEqual({w:VIEW.w,h:VIEW.h},{w:390,h:844});
 assert.equal(draws,3);
 assert.equal(chrome,3);
 assert.equal(run.start,42);
 assert.equal(run.loot[0].id,'sealed');
 assert.equal(run.paused,false);
});
test('R6.26 orientation event releases held joystick and refreshes after the next frame',()=>{
 const a=js.indexOf('function refreshAfterPhoneRotation(){'),b=js.indexOf("window.addEventListener('resize',refreshAfterPhoneRotation)",a);
 assert.ok(a>=0&&b>a);
 let released=0,resizes=0,late;
 const run={status:'playing',joy:{x:1,y:0.7},steer:{x:0.3,y:0.2},paused:false,start:1234,loot:[{id:'rare'}]};
 const stickVisual={release:()=>released++};
 const rotate=new Function('stickVisual','run','resizeField','requestAnimationFrame',
  js.slice(a,b)+'\nreturn refreshAfterPhoneRotation;'
 )(stickVisual,run,()=>resizes++,callback=>{late=callback;});
 rotate();
 assert.equal(released,1);
 assert.equal(resizes,1);
 assert.deepEqual(run.joy,{x:0,y:0});
 assert.deepEqual(run.steer,{x:0,y:0});
 assert.equal(run.start,1234);
 assert.equal(run.paused,false);
 assert.equal(run.loot[0].id,'rare');
 late();
 assert.equal(resizes,2);
 assert.match(js,/window.addEventListener\('orientationchange',refreshAfterPhoneRotation\)/);
 assert.match(js,/window.visualViewport.addEventListener\('resize',refreshAfterPhoneRotation\)/);
});
test('R6.26 landscape diagnostics measure full map and non-overlapping action quadrants',()=>{
 const a=js.indexOf('function v5ViewportAuditLines(){'),b=js.indexOf('function v5SessionDiagnosticReport(){',a);
 assert.ok(a>=0&&b>a);
 const rects={
  shell:box(0,0,844,390),
  '.exp-v5-toprail':box(0,0,844,108),
  '.exp-v5-bottomdock':box(0,276,844,390),
  '.exp-map-frame':box(0,0,844,390),
  '#exp-stick-zone':box(0,195,422,390),
  '.exp-control-actions':box(630,280,824,380)
 };
 const shell={getBoundingClientRect:()=>rects.shell,querySelector:k=>rects[k]?{getBoundingClientRect:()=>rects[k]}:null};
 const document={querySelector:()=>shell};
 const audit=new Function('document',js.slice(a,b)+'\nreturn v5ViewportAuditLines;')(document);
 const lines=audit();
 assert.match(lines[0],/844×390px \/ 描画 844×390px/);
 assert.match(lines[1],/その間 168px/);
 assert.match(lines[2],/0px² \/ 全画面マップ 維持/);
 assert.match(lines[3],/未検出/);
});
