'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const js=read('exploration.js');
const css=read('exploration.css');
const html=read('index.html');
const marker='/* R6.34: keep pause inventory manageable';

function redrawFixture({oldAction='protect',oldTid='loot-2',newTid='loot-2',oldSort,gear}={}){
 const oldButton={dataset:{...(gear?{expGear:gear}:{explore:oldAction}),
  ...(oldTid===undefined?{}:{tid:oldTid}),
  ...(oldSort?{sort:oldSort}:{})}};
 let focused=0,focusOptions=null;
 const nextButton={dataset:{...(gear?{expGear:gear}:{explore:oldAction}),
  ...(newTid===undefined?{}:{tid:newTid}),
  ...(oldSort?{sort:oldSort}:{})},focus(options){focused++;focusOptions=options}};
 const oldList={scrollTop:118},newList={scrollTop:0};
 const oldCard={scrollTop:267,contains:el=>el===oldButton,
  querySelector:sel=>sel==='.exp-pause-loot'?oldList:null};
 const newCard={scrollTop:0,querySelector:sel=>sel==='.exp-pause-loot'?newList:null,
  querySelectorAll:()=>[nextButton]};
 let card=oldCard,writes=0;
 const layer={querySelector:sel=>sel==='.exp-pause-card'?card:null,
  set innerHTML(value){assert.match(value,/exp-pause-overlay/);writes++;card=newCard}};
 const document={activeElement:oldButton,getElementById:id=>id==='exp-pause-layer'?layer:null};
 const a=js.indexOf('function refreshV5PausePanel(){');
 const b=js.indexOf('function areaPicker(){',a);
 assert.ok(a>0&&b>a,'R6.34 redraw helper must exist');
 const redraw=new Function('document','pausePanel',js.slice(a,b)+'\nreturn refreshV5PausePanel;')
  (document,()=>'<div class="exp-pause-overlay"></div>');
 redraw();
 return {oldCard,newCard,oldList,newList,writes,focusCount:()=>focused,focusOptions:()=>focusOptions};
}

test('R6.34 protects an item without jumping the outer or nested loot scroll to the top',()=>{
 const r=redrawFixture({});
 assert.equal(r.writes,1);
 assert.equal(r.newCard.scrollTop,267);
 assert.equal(r.newList.scrollTop,118);
 assert.equal(r.focusCount(),1,'same loot token remains focused after redraw');
 assert.deepEqual(r.focusOptions(),{preventScroll:true});
});

test('R6.34 does not focus a different loot item when the selected token was discarded',()=>{
 const r=redrawFixture({oldTid:'discarded-2',newTid:'different-3'});
 assert.equal(r.newCard.scrollTop,267);
 assert.equal(r.newList.scrollTop,118);
 assert.equal(r.focusCount(),0,'never transfer focus to a different loot item');
});

test('R6.34 keeps sort and gear selections keyboard accessible after redraw',()=>{
 for(const r of [
  redrawFixture({oldAction:'bag-sort',oldTid:undefined,newTid:undefined,oldSort:'weight'}),
  redrawFixture({gear:'weapon',oldTid:undefined,newTid:undefined})
 ]){
  assert.equal(r.focusCount(),1);
  assert.equal(r.newCard.scrollTop,267);
 }
});

test('R6.34 inventory actions use scroll-preserving redraw, with 44px phone targets and new cache keys',()=>{
 const a=js.indexOf("if(type==='bag-sort'");
 const b=js.indexOf("document.body.addEventListener('change'",a);
 assert.ok(a>0&&b>a);
 const actions=js.slice(a,b);
 assert.equal((actions.match(/if\(run\.paused\)refreshV5PausePanel\(\)/g)||[]).length,4,
  'sort, auto-protect, protect and discard all preserve scroll');
 assert.match(js,/Treasure Merchant R6\.12 \/ 屋内施設 V5/);
 assert.ok(css.includes(marker));
 const block=css.slice(css.indexOf(marker));
 assert.match(block,/@media \(max-width:1100px\)/);
 assert.match(block,/\.exp-pause-loot \.exp-loot-item button\{[^}]*min-width:44px!important;min-height:44px!important/s);
 assert.match(block,/overscroll-behavior:contain/);
 assert.match(html,/exploration\.css\?v=R6\.28&amp;routes=R6\.33&amp;pause=R6\.34/);
 assert.match(html,/exploration\.js\?v=R6\.28&amp;balance=R6\.33&amp;pause=R6\.34/);
});
