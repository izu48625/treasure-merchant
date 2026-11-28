'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Campaign=require('../campaign.js');
const Combat=require('../combat-rules.js');
const weak={maxHp:100,defense:0,weapons:[{style:'unarmed',attack:14}]};
const strong={maxHp:180,defense:15,weapons:[{style:'rapid',attack:90},{style:'strike',attack:70}]};
test('R6.92 old saves initialize locked later areas and malformed progression is bounded',()=>{
 assert.deepEqual(Campaign.normalize(undefined),{cleared:0,last:null});
 assert.deepEqual(Campaign.normalize({cleared:999,last:{stage:90,won:true}}),{cleared:3,last:null});
 assert.equal(Campaign.canChallenge(undefined,0),true);
 assert.equal(Campaign.canChallenge(undefined,1),false);
 assert.equal(Campaign.canChallenge(undefined,2),false);
});
test('R6.92 equipment changes outcome; deterministic boss battle and monotonic unlock',()=>{
 const p={cleared:0,last:null},before=JSON.stringify(p);
 const loss=Campaign.challenge(p,0,weak,Combat);
 assert.equal(loss.result.won,false);
 assert.equal(loss.progress.cleared,0);
 const win=Campaign.challenge(p,0,strong,Combat);
 assert.equal(win.result.won,true);
 assert.equal(win.progress.cleared,1);
 assert.deepEqual(Campaign.challenge(p,0,strong,Combat),win);
 assert.deepEqual(Campaign.normalize(win.progress),win.progress);
 assert.equal(JSON.stringify(p),before);
 assert.equal(Campaign.challenge(win.progress,1,strong,Combat),null,'unbuilt map is not playable');
 assert.equal(Campaign.challenge(win.progress,0,weak,Combat).progress.cleared,1,'replay loss cannot revoke a cleared area');
 assert.ok(win.result.log.every(x=>x.ms<=30000));
});
test('R6.92 weapon attack interval and defense affect battle without random rolls',()=>{
 const fast=Campaign.simulate(0,{...strong,weapons:[{style:'rapid',attack:40,pattern:{cooldown:.25}}]},Combat);
 const slow=Campaign.simulate(0,{...strong,weapons:[{style:'rapid',attack:40,pattern:{cooldown:3}}]},Combat);
 assert.ok(fast.won);
 assert.ok(!slow.won||fast.ms<slow.ms);
 const armored=Campaign.simulate(0,{...weak,defense:20},Combat);
 const unarmored=Campaign.simulate(0,weak,Combat);
 assert.ok(armored.ms>unarmored.ms);
});
