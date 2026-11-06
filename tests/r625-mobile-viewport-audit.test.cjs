'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

function viewportAuditWith(rects){
 const src=read('exploration.js');
 const start=src.indexOf('function v5ViewportAuditLines(){');
 const end=src.indexOf('function v5SessionDiagnosticReport(){',start);
 assert.ok(start>=0&&end>start,'R6.25 read-only audit helper must exist');
 const shell={
  getBoundingClientRect:()=>rects.shell,
  querySelector:selector=>rects[selector]?{getBoundingClientRect:()=>rects[selector]}:null
 };
 const document={
  querySelector:selector=>selector==='.exp-shell.exp-playing.exp-v5-layout'?shell:null
 };
 return new Function('document',src.slice(start,end)+'\nreturn v5ViewportAuditLines;')(document)();
}
const box=(left,top,right,bottom)=>({
 left,top,right,bottom,width:right-left,height:bottom-top
});
test('R6.25 normal iPhone portrait: full field and separated action quadrants',()=>{
 const lines=viewportAuditWith({
  shell:box(0,0,390,844),
  '.exp-v5-toprail':box(0,0,390,210),
  '.exp-v5-bottomdock':box(0,700,390,844),
  '.exp-map-frame':box(0,0,390,844),
  '#exp-stick-zone':box(0,422,195,844),
  '.exp-control-actions':box(195,710,390,830)
 });
 assert.match(lines[0],/390×844px/);
 assert.match(lines[1],/490px/);
 assert.match(lines[2],/0px² \/ 全画面マップ 維持/);
 assert.match(lines[3],/未検出/);
});
test('R6.25 cramped viewport flags rail and touch overlap instead of claiming usability',()=>{
 const lines=viewportAuditWith({
  shell:box(0,0,390,330),
  '.exp-v5-toprail':box(0,0,390,220),
  '.exp-v5-bottomdock':box(0,200,390,330),
  '.exp-map-frame':box(0,100,390,330),
  '#exp-stick-zone':box(0,165,210,330),
  '.exp-control-actions':box(190,210,390,330)
 });
 assert.match(lines[1],/その間 -20px/);
 assert.match(lines[2],/全画面マップ 要確認/);
 assert.match(lines[3],/可能性があります/);
});
test('R6.25 missing viewport elements are reported safely',()=>{
 const lines=viewportAuditWith({shell:box(0,0,390,844)});
 assert.equal(lines.length,1);
 assert.match(lines[0],/測定不可/);
});
test('R6.25 mobile direction cue wraps and cache-busted assets load',()=>{
 const css=read('exploration.css');
 const rule=css.slice(css.indexOf('/* R6.25: allow the R6.24'));
 assert.match(rule,/\.exp-vault-risk\[data-direction="true"\]/);
 assert.match(rule,/white-space:normal!important/);
 assert.match(rule,/overflow:visible!important/);
 const html=read('index.html');
 assert.match(html,/exploration\.css\?v=R6\.25/);
 assert.match(html,/exploration\.js\?v=R6\.25/);
 const js=read('exploration.js');
 assert.match(js,/\.\.\.v5ViewportAuditLines\(\)/);
});
