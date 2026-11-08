'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const planner=require('../map-return-routes.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const pt=(x,y)=>({x,y});

test('R6.35 counts actual patrol segments, not only guard starting positions',()=>{
 const route={points:[pt(0,0),pt(40,0),pt(80,0)]};
 const layout={isBasement:true,guardPosts:[
  {id:'move',x:40,y:100,route:[pt(40,100),pt(40,0)]},
  {id:'far',x:400,y:400,route:[pt(400,400),pt(450,400)]},
  {id:'alarm',x:0,y:0,alarmOnly:true,route:[pt(0,0)]}
 ]};
 const before=JSON.stringify({route,layout});
 const audit=planner.auditPatrolProximity(layout,route,15);
 assert.deepEqual(audit,{nearPoints:1,totalPoints:3,nearbyPatrols:1,radius:15});
 assert.equal(JSON.stringify({route,layout}),before,'read-only audit must not mutate authored paths');
});

test('R6.35 guard post alone is a valid patrol lane and absent guards produce zero exposure',()=>{
 const route={points:[pt(0,0),pt(48,0),pt(96,0)]};
 const fixed={isBasement:true,guardPosts:[{x:48,y:0,route:[pt(48,0)]}]};
 assert.deepEqual(planner.auditPatrolProximity(fixed,route,0),
  {nearPoints:1,totalPoints:3,nearbyPatrols:1,radius:0});
 const empty={isBasement:true,guardPosts:[]};
 assert.deepEqual(planner.auditPatrolProximity(empty,route),
  {nearPoints:0,totalPoints:3,nearbyPatrols:0,radius:120});
});

test('R6.35 rejects non-basement, corrupted route geometry and invalid distance',()=>{
 const route={points:[pt(0,0)]};
 const valid={isBasement:true,guardPosts:[]};
 assert.equal(planner.auditPatrolProximity({...valid,isBasement:false},route),null);
 assert.equal(planner.auditPatrolProximity(valid,{points:[]}),null);
 assert.equal(planner.auditPatrolProximity(valid,{points:[{x:NaN,y:0}]}),null);
 assert.equal(planner.auditPatrolProximity(valid,route,-1),null);
 assert.equal(planner.auditPatrolProximity(valid,route,Infinity),null);
});

test('R6.35 only the paused detailed map displays patrol proximity, with cache busting',()=>{
 const js=read('exploration.js'),css=read('exploration.css'),html=read('index.html');
 assert.match(js,/function v5BasementCurrentRoute\(\)/);
 assert.match(js,/auditPatrolProximity\?\.\(MallBasement,planned\)/);
 assert.match(js,/固定巡回経路との近接/);
 assert.match(js,/固定巡回経路120px以内/);
 assert.match(js,/現在の敵位置や発見確率ではありません/);
 const a=js.indexOf('function v5BasementRouteGuide(){');
 const b=js.indexOf('function v5FacilityPlanSvg(',a);
 const rest=js.slice(b,js.indexOf('function v5DetailedMapPanel(',b));
 assert.ok(a>0&&b>a,'route UI is within detailed pause-map helpers');
 assert.doesNotMatch(rest,/exp-b1-patrol-proximity/,'main map drawing has no extra live HUD');
 assert.match(css,/\/\* R6\.35: B1-only route audit/);
 assert.match(css,/\.exp-map-v5-card \.exp-b1-patrol-proximity/);
 assert.match(html,/map-return-routes\.js\?v=R6\.32&amp;patrol=R6\.35/);
 assert.match(html,/exploration\.css\?v=R6\.28&amp;routes=R6\.33&amp;pause=R6\.34&amp;patrol=R6\.35/);
 assert.match(html,/exploration\.js\?v=R6\.28&amp;balance=R6\.33&amp;pause=R6\.34&amp;patrol=R6\.35/);
});
