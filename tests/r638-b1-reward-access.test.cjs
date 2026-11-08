'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const planner=require('../map-return-routes.js');
const p=(x,y)=>({x,y});

test('R6.38 B1 cache access is a real four-neighbor route and excludes sealed rewards',()=>{
 const loot=[
  {id:'early',tier:'mid',...p(72,24)},
  {id:'deep',tier:'ultra',...p(216,216)}
 ];
 Object.defineProperty(loot[0],'contents',{get(){throw Error('sealed rewards must not be read')}});
 Object.defineProperty(loot[1],'contents',{get(){throw Error('sealed rewards must not be read')}});
 const layout={isBasement:true,w:288,h:288,start:p(24,24),fixedExit:p(264,264),
  solid:()=>false,authoredContainers:loot,
  guardPosts:[{x:216,y:216,route:[p(216,216)]},{x:72,y:24,alarmOnly:true,route:[p(72,24)]}]
 };
 const before=JSON.stringify({start:layout.start,exit:layout.fixedExit,
  grades:loot.map(({id,tier,x,y})=>({id,tier,x,y}))});
 const audit=planner.auditCacheAccess(layout);
 assert.equal(audit.tileSize,48);
 assert.equal(audit.radius,120);
 assert.deepEqual(audit.rows,[
  {id:'early',tier:'mid',entrySteps:1,exitSteps:9,nearbyPatrols:0},
  {id:'deep',tier:'ultra',entrySteps:8,exitSteps:2,nearbyPatrols:1}
 ]);
 assert.strictEqual(planner.auditCacheAccess(layout),audit,'same canonical layout is audited only once');
 assert.equal(JSON.stringify({start:layout.start,exit:layout.fixedExit,
  grades:loot.map(({id,tier,x,y})=>({id,tier,x,y}))}),before);
});

test('R6.38 collision is authoritative; unreachable caches display no fabricated route steps',()=>{
 const layout={isBasement:true,w:240,h:240,start:p(24,24),fixedExit:p(216,216),
  authoredContainers:[{id:'blocked',tier:'high',...p(120,120)}],
  guardPosts:[],solid:(x,y,r)=>Math.floor(x/48)===2&&Math.floor(y/48)===2
 };
 const result=planner.auditCacheAccess(layout);
 assert.equal(result.rows[0].entrySteps,null);
 assert.equal(result.rows[0].exitSteps,null);
 assert.equal(result.rows[0].nearbyPatrols,0);
 assert.equal(planner.auditCacheAccess({...layout,isBasement:false}),null);
 assert.equal(planner.auditCacheAccess({...layout,start:p(-1,24)}),null);
 assert.equal(planner.auditCacheAccess({...layout,fixedExit:p(24,500)}),null);
 assert.equal(planner.auditCacheAccess({...layout,solid:null}),null);
 assert.equal(planner.auditCacheAccess(layout,-1),null);
 assert.equal(planner.auditCacheAccess(layout,Infinity),null);
});

test('R6.38 shorter ingress is not confused with extraction or danger',()=>{
 const layout={isBasement:true,w:240,h:240,start:p(24,24),fixedExit:p(216,216),
  authoredContainers:[{id:'near-spawn',tier:'high',...p(72,24)},
   {id:'near-exit',tier:'mid',...p(168,216)}],
  guardPosts:[{x:168,y:216,route:[p(168,216)]}],
  solid:()=>false
 };
 const r=planner.auditCacheAccess(layout,0);
 assert.equal(r.rows[0].entrySteps,1);
 assert.equal(r.rows[0].exitSteps,7);
 assert.equal(r.rows[0].nearbyPatrols,0);
 assert.equal(r.rows[1].entrySteps,7);
 assert.equal(r.rows[1].exitSteps,1);
 assert.equal(r.rows[1].nearbyPatrols,1);
 assert.equal(planner.auditCacheAccess(layout,0)===r,false,
  'non-default radii use fresh independent read-only audits');
});

test('R6.38 pre-raid map assets refresh and measurements stay out of the live HUD',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
 const js=read('exploration.js'),html=read('index.html'),css=read('exploration.css');
 assert.match(js,/TreasureReturnRoutes\?\.auditCacheAccess\?\.\(layout\)/);
 assert.match(js,/p\.spatial\?'<small class="exp-v5-risk-lane">/);
 assert.match(js,/敵の現在位置・発見率ではありません/);
 assert.match(css,/R6\.38: B1 authored cache access/);
 assert.match(css,/\.exp-v5-plan-row \.exp-v5-risk-lane/);
 assert.match(html,/map-return-routes\.js\?v=R6\.32&amp;patrol=R6\.35&amp;reward=R6\.38/);
 assert.match(html,/exploration\.js\?v=R6\.28[^"]*&amp;reward=R6\.38/);
 assert.match(html,/exploration\.css\?v=R6\.28[^"]*&amp;reward=R6\.38/);
 assert.doesNotMatch(js.slice(js.indexOf('function drawFacilityVision('),
  js.indexOf('function enemyPatrol(')),/exp-v5-risk-lane/,
 'measurement is only in pause/map planning, never attached to live sight cones');
});
