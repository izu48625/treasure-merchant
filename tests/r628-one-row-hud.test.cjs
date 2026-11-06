'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const css=read('exploration.css');
const js=read('exploration.js');
const html=read('index.html');
const marker='/* R6.28: phone V5 one-row HUD';

function makeBrief(){
 const start=js.indexOf('const v5BriefState=');
 const end=js.indexOf('function updateHUD(force=false){',start);
 assert.ok(start>=0&&end>start);
 const run={
  mapVersion:5,status:'playing',paused:false,showMap:false,lootOpenId:null,
  undergroundEntered:false,hasKeycard:false,basementKeyTaken:false,vaultUnlocked:false,
  vaultSealed:false,vaultHatchUsed:false,vaultAlarm:false,loot:[],player:{x:50,y:50}
 };
 let room='資材倉庫',exit={near:false,blocked:false,short:'1F出口 北↑'},urgent=false;
 const brief=new Function('run','vaultLayout','v5ExitDirection','v5ReturnRisk','v5ObjectiveText',
  js.slice(start,end)+'\nreturn v5CompactHudBrief;'
 )(run,()=>({themeAt:()=>room}),()=>exit,()=>({urgent}),()=> '警備室でカードキーを探す');
 return {run,brief,setRoom:x=>room=x,setExit:x=>exit=x,setUrgent:x=>urgent=x};
}
test('R6.28 one row in narrow portrait and landscape, with small 44px map and pause',()=>{
 assert.ok(css.includes(marker));
 const css28=css.slice(css.indexOf(marker));
 assert.match(css28,/@media \(max-width:1100px\)/);
 assert.match(css28,/grid-template-areas:"hud map pause"!important/);
 assert.match(css28,/grid-template-rows:44px!important/);
 assert.match(css28,/grid-template-columns:minmax\(0,1fr\) 44px 44px!important/);
 assert.match(css28,/>.exp-map-toggle\{[^}]*width:44px!important;height:44px!important/s);
 assert.match(css28,/>.exp-pause-toggle\{[^}]*width:44px!important;height:44px!important/s);
 assert.match(css28,/\.exp-hud \.exp-leave\{[^}]*min-width:44px!important;min-height:44px!important/s);
 assert.match(css28,/\.exp-hud small\{[^}]*display:none!important/s);
});
test('R6.28 hides redundant legacy banners without deleting their live model data',()=>{
 const css28=css.slice(css.indexOf(marker));
 assert.match(css28,/>.exp-stealth-status,[\s\S]*?>.exp-vault-stage,[\s\S]*?>#exp-room-label\{\s*display:none!important/s);
 assert.match(css28,/>.exp-v5-brief\[data-active="true"\]/);
 assert.match(css28,/pointer-events:none!important/);
 assert.match(css28,/data-level="urgent"/);
 assert.match(js,/id="exp-v5-brief" class="exp-v5-brief"/);
 assert.match(js,/aria-live="polite"/);
 assert.match(js,/txt\('exp-room-label',vaultLayout\(\)\?\.themeAt/);
 assert.match(js,/txt\('exp-vault-objective',v5ObjectiveText\(stakes\)\)/);
 assert.match(js,/briefEl\.dataset\.active=String\(Boolean\(brief\.text\)\)/);
});
test('R6.28 room and goal appear briefly and clear instead of persisting',()=>{
 const {brief,setRoom,run}=makeBrief();
 assert.deepEqual(brief({},null,1000),{text:'資材倉庫',level:'room'});
 assert.deepEqual(brief({},null,2600),{text:'警備室でカードキーを探す',level:'goal'});
 assert.deepEqual(brief({},null,3600),{text:'',level:'none'});
 setRoom('警備室');
 assert.deepEqual(brief({},null,4000),{text:'警備室',level:'room'});
 assert.deepEqual(brief({},null,6000),{text:'',level:'none'});
 run.hasKeycard=true;
 assert.deepEqual(brief({},null,6500),{text:'警備室でカードキーを探す',level:'goal'});
 assert.deepEqual(brief({},null,9100),{text:'',level:'none'});
});
test('R6.28 life-critical warnings override any room hint and use one status only',()=>{
 const {run,brief,setRoom,setExit,setUrgent}=makeBrief();
 brief({},null,1000);
 setRoom('中央通路');
 assert.deepEqual(brief({}, {mode:'chase',label:'発見中・遮蔽物へ'},1100),
  {text:'発見中・遮蔽物へ',level:'danger'});
 assert.deepEqual(brief({}, {mode:'notice',label:'敵の視線内・隠れよう'},1200),
  {text:'敵の視線内・隠れよう',level:'warning'});
 setUrgent(true);
 assert.deepEqual(brief({}, {mode:'hidden',label:'未発見'},1400),
  {text:'帰還優先：1F出口 北↑',level:'urgent'});
 setExit({near:true,blocked:false,short:'出口に到着'});
 assert.deepEqual(brief({}, {mode:'chase',label:'発見中'},1500),
  {text:'出口に到着：右下「脱出する」',level:'exit'});
 setExit({near:false,blocked:true,short:'非常ハッチが先'});
 assert.deepEqual(brief({},null,1600),
  {text:'入口封鎖：非常ハッチから帰還',level:'urgent'});
 run.paused=true;
 assert.deepEqual(brief({},null,1800),{text:'',level:'none'});
});
test('R6.28 high-rarity loss risk appears briefly; UI state is not saved to raid',()=>{
 const {run,brief}=makeBrief();
 const original=JSON.stringify(run);
 brief({unsecuredCount:0},null,1000);
 assert.deepEqual(brief({unsecuredCount:2},null,1200),
  {text:'未保護の高レア財宝 2点：バッグで保護を確認',level:'warning'});
 assert.deepEqual(brief({unsecuredCount:2},null,4250),
  {text:'',level:'none'});
 assert.equal(JSON.stringify(run),original);
 assert.doesNotMatch(js,/snapshotRun\(\)[\s\S]{0,200}v5BriefState/);
});
test('R6.28 asset cache rotates while portrait/landscape camera and buttons stay unchanged',()=>{
 assert.match(html,/exploration\.css\?v=R6\.28/);
 assert.match(html,/exploration\.js\?v=R6\.28/);
 assert.ok(js.includes('function v5CameraScale(){'));
 assert.ok(js.includes('function refreshAfterPhoneRotation(){'));
 assert.ok(css.includes('/* R6.27: phone landscape rescue'));
 assert.ok(css.includes('.exp-v5-bottomdock .exp-action-bottom button'));
});
