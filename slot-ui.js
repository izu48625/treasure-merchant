'use strict';
/* R5.0 — Treasure Slot presentation. Game rules, sealed rewards and saves remain in arcade.js. */
const SLOT_ART=[
 {file:'coin.svg',name:'古金貨',short:'金貨'},
 {file:'ticket.svg',name:'ガチャ引換券',short:'引換券'},
 {file:'chest.svg',name:'財宝箱',short:'財宝'},
 {file:'gem.svg',name:'大宝石',short:'宝石'},
 {file:'crown.svg',name:'王冠',short:'王冠'}
];
const SLOT_UI_STORAGE='treasure-slot-ui-v1';
let slotSoundOn=false,slotFastMode=false,slotAudioContext=null;
try{
 const setting=JSON.parse(localStorage.getItem(SLOT_UI_STORAGE)||'{}');
 slotSoundOn=setting.sound===true;
 slotFastMode=setting.fast===true;
}catch(_){}
function slotUIPersist(){
 try{localStorage.setItem(SLOT_UI_STORAGE,JSON.stringify({sound:slotSoundOn,fast:slotFastMode}))}catch(_){}
}
function slotUIOption(kind){
 if(kind==='sound'){slotSoundOn=!slotSoundOn;slotUIPersist();if(slotSoundOn)slotUIPlay('select');}
 if(kind==='fast'){slotFastMode=!slotFastMode;slotUIPersist();slotUIPlay('select');}
 if(typeof render==='function')render();
}
function slotSymbolHTML(id){
 const o=SLOT_ART[id];
 if(!o)return '<span class="tm-symbol-fallback">?</span>';
 return '<img class="tm-slot-symbol" src="assets/slot/'+o.file+'" alt="" draggable="false" loading="eager" decoding="async">';
}
function slotUIResultRolls(result){
 if(!result||result.mode!=='スロット'||!Array.isArray(result.reels)||result.reels.length!==3)return null;
 const ids=result.reels.map(x=>ARCADE_SYMBOLS.indexOf(x));
 return ids.every(n=>n>=0)?ids:null;
}
function slotUIOutcomeData(result){
 const rolls=slotUIResultRolls(result);
 if(!rolls)return null;
 const resolved=arcadeSlotOutcome(rolls),same=new Set(rolls).size;
 const kind=resolved.kind,mult=resolved.mult;
 const band=kind==='miss'?'miss':same===2?'pair':rolls[0]===4?'grand':rolls[0]===3?'major':rolls[0]===2?'treasure':'win';
 return {band:band,kind:kind,mult:mult,rolls:rolls,
  title:band==='miss'?'NO MATCH':band==='pair'?'SMALL WIN':band==='grand'?'ROYAL JACKPOT':band==='major'?'GEM JACKPOT':band==='treasure'?'TREASURE FOUND':'TRIPLE MATCH'};
}
function slotUIReel(id,pending,base){
 const active=!!pending,stopped=!pending||pending.stopped[id],shown=active?pending.rolls[id]:base[id];
 const symbols=stopped?[shown===null?2:shown]:[0,1,2,3,4,0,1,2,3,4];
 return '<div class="tm-reel-unit '+(stopped?'is-stopped':'is-spinning')+'" data-reel-unit="'+id+'">' +
  '<div class="tm-reel-window" role="img" aria-label="リール'+(id+1)+'：'+(stopped?SLOT_ART[shown===null?2:shown].name:'回転中')+'">' +
  '<div class="tm-reel-strip '+(stopped?'':'tm-reel-motion')+'">'+symbols.map(n=>'<span class="tm-symbol-cell">'+slotSymbolHTML(n)+'</span>').join('')+'</div></div>'+
  '<button class="tm-stop" data-arcade="stop-reel" data-reel="'+id+'"'+(stopped?' disabled':'')+' aria-label="リール'+(id+1)+'を停止"><small>REEL 0'+(id+1)+'</small><b>'+(stopped?'LOCK':'STOP')+'</b></button>'+
  '</div>';
}
function slotUIView(){
 const pending=state.arcadeSlotPending;
 const result=!pending&&arcadeResult&&arcadeResult.mode==='スロット'?arcadeResult:null;
 const data=slotUIOutcomeData(result),preview=data?data.rolls:[0,2,4];
 const isPlaying=!!pending,bet=isPlaying?BigInt(pending.bet):BigInt(arcadeBet);
 const canSpin=!isPlaying&&!arcadeRolling&&!actionPersisting&&cash()>=bet;
 const betLabels=['100','1千','1万','10万','100万'];
 const betControls=ARCADE_BETS.map((n,i)=>'<button class="tm-bet '+(!isPlaying&&arcadeBet===n?'is-selected':'')+
  '" data-arcade="bet" data-bet="'+n+'"'+(isPlaying?' disabled':'')+' aria-pressed="'+(!isPlaying&&arcadeBet===n)+
  '" aria-label="賭け金'+n.toLocaleString('ja-JP')+'G">'+betLabels[i]+'<small>G</small></button>').join('');
 const lit=!!data&&data.kind!=='miss',award=!!data&&data.kind==='item';
 const message=isPlaying?'STOPを押してリールを止めよう':result?result.message:'賭け金を選んで挑戦';
 const center=isPlaying?'SPINNING':data?data.title:'TREASURE SLOT';
 const headline=isPlaying?'回転中':data?(data.kind==='miss'?'ハズレ':data.kind==='item'?'財宝獲得':data.kind==='ticket'?'ガチャ権利獲得':data.mult/100+'倍 獲得'):'READY';
 const remaining=isPlaying?pending.stopped.filter(x=>!x).length:0;
 const note=isPlaying?'投入済み '+short(bet)+' ／ 残り'+remaining+'リール':result?esc(result.detail||'結果が確定しました'):'各リールは5種類から等確率';
 const rows=[['すべて異なる','48%','ハズレ'],['2絵柄一致','48%','1.25倍G'],['金貨×3','0.8%','4倍G'],
  ['引換券×3','0.8%','ガチャ権利'],['財宝箱×3','0.8%','財宝1個'],['宝石×3','0.8%','8倍G'],['王冠×3','0.8%','15倍G']];
 const returnMessage='<div class="tm-slot-result '+(lit?'is-win':'is-quiet')+'" role="status" aria-live="polite">' +
  '<div class="tm-result-caption">'+(result?(lit?'PAYOUT CONFIRMED':'ROUND COMPLETE'):'THE HOUSE OF TREASURES')+'</div>'+
  '<strong>'+esc(message)+'</strong>'+(data&&data.kind==='cash'?'<span class="tm-result-balance">'+
   (data.kind==='cash'&&data.mult?('払い戻し倍率 '+(data.mult/100).toString()+'×'):'')+'</span>':'')+'</div>';
 return '<section class="tm-slot '+(slotFastMode?'tm-fast ':'')+(isPlaying?'tm-running ':'')+(data?'tm-band-'+data.band:'tm-ready')+'" aria-label="商会スロット">' +
  '<div class="tm-slot-top"><div class="tm-pocket"><small>BALANCE</small><b>'+short(cash())+'</b></div>'+
  '<div class="tm-slot-switches"><button data-arcade="slot-speed" aria-pressed="'+slotFastMode+'" aria-label="高速演出切替">'+(slotFastMode?'高速 ON':'高速 OFF')+'</button>'+
  '<button data-arcade="slot-sound" aria-pressed="'+slotSoundOn+'" aria-label="効果音切替">'+(slotSoundOn?'音 ON':'音 OFF')+'</button></div></div>'+
  '<div class="tm-machine '+(lit?'tm-is-winning':'')+'">' +
   '<div class="tm-machine-crown"><span class="tm-lamp" aria-hidden="true"></span><span class="tm-lamp" aria-hidden="true"></span>'+
    '<div class="tm-machine-name"><small>THE TREASURE EXCHANGE</small><strong>TREASURE <em>SLOT</em></strong></div>'+
    '<span class="tm-lamp" aria-hidden="true"></span><span class="tm-lamp" aria-hidden="true"></span></div>'+
   '<div class="tm-machine-display"><small>'+center+'</small><strong>'+headline+'</strong></div>'+
   '<div class="tm-machine-reels"><div class="tm-payline" aria-hidden="true"></div>'+[0,1,2].map(i=>slotUIReel(i,pending,preview)).join('')+'</div>'+
   '<div class="tm-machine-base"><span>◆　VINTAGE ISSUE 05　◆</span><span>LUCK FAVORS THE CURIOUS</span></div>'+
  '</div>'+
  '<div class="tm-slot-statusline">'+note+'</div>'+
  (!isPlaying?'<div class="tm-slot-bet"><div class="tm-bet-heading"><b>BET</b><span>選択 '+short(bet)+'</span></div><div class="tm-bet-row">'+betControls+'</div></div>':
   '<div class="tm-slot-bet is-locked"><b>BET LOCKED</b><span>'+short(bet)+' · 停止するまで賭け金は変更できません</span></div>')+
  '<div class="tm-slot-action">'+(isPlaying?
   '<button class="tm-spin tm-stop-all" data-arcade="stop-all"><span>STOP ALL</span><small>残りのリールをまとめて停止</small></button>':
   '<button class="tm-spin" data-arcade="slot"'+(canSpin?'':' disabled')+' aria-label="'+short(bet)+'を賭けて回す"><span>'+(result?'SPIN AGAIN':'SPIN')+'</span><small>'+short(bet)+'を投入して回す</small></button>')+'</div>'+
  returnMessage+
  '<details class="tm-slot-rules"><summary>当選確率・遊び方</summary><div class="tm-rule-grid">'+
   rows.map(x=>'<div><span>'+x[0]+'</span><b>'+x[1]+'</b><span>'+x[2]+'</span></div>').join('')+'</div>'+
   '<p>投入したGは開始時に差し引かれ、ハズレでは戻りません。リールは開始時に確定して保存します。STOPの順番やタイミングでは抽選結果が変わりません。ガチャ権利は500Gあたり1回分（最低1・最大50）。財宝は賭け金の5倍以下の候補から抽選。3つ停止した後、同じ賭け金で続けられます。</p></details>'+
  '</section>';
}
function slotUIPlay(kind){
 if(!slotSoundOn||typeof window==='undefined')return;
 try{
  const C=window.AudioContext||window.webkitAudioContext;
  if(!C)return;
  if(!slotAudioContext)slotAudioContext=new C();
  const ctx=slotAudioContext;
  if(ctx.state==='suspended')void ctx.resume().catch(()=>{});
  const sequences={
   select:[[640,0,.04,'square'],[890,.055,.05,'triangle']],
   spin:[[150,0,.12,'sawtooth'],[260,.10,.09,'triangle']],
   stop:[[235,0,.04,'square'],[125,.04,.08,'triangle']],
   pair:[[460,0,.09,'triangle'],[610,.10,.10,'triangle']],
   win:[[520,0,.10,'triangle'],[660,.12,.11,'triangle'],[880,.25,.16,'triangle']],
   jackpot:[[500,0,.12,'triangle'],[630,.14,.12,'triangle'],[790,.29,.12,'triangle'],[1100,.44,.21,'triangle']],
   miss:[[150,0,.075,'sine']]
  };
  const notes=sequences[kind]||sequences.select;
  for(const [freq,offset,dur,wave] of notes){
   const osc=ctx.createOscillator(),gain=ctx.createGain(),at=ctx.currentTime+offset;
   osc.type=wave;osc.frequency.setValueAtTime(freq,at);
   gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.038,at+.008);
   gain.gain.exponentialRampToValueAtTime(.0001,at+dur);
   osc.connect(gain);gain.connect(ctx.destination);osc.start(at);osc.stop(at+dur+.025);
  }
 }catch(_){}
}
function slotUIFeedback(kind){
 slotUIPlay(kind);
 if(kind==='stop'&&typeof navigator!=='undefined'&&typeof navigator.vibrate==='function'){
  try{navigator.vibrate(13)}catch(_){}
 }
 const box=document.querySelector('.tm-slot');
 if(box&&kind==='stop'){
  box.classList.remove('tm-stop-impact');void box.offsetWidth;box.classList.add('tm-stop-impact');
 }
}
function slotUIAfterOutcome(result){
 if(!result||result.mode!=='スロット')return;
 const d=slotUIOutcomeData(result),box=document.querySelector('.tm-slot');
 if(box){box.classList.remove('tm-payout-burst');void box.offsetWidth;box.classList.add('tm-payout-burst');}
 slotUIPlay(!d||d.kind==='miss'?'miss':d.band==='grand'||d.band==='major'||d.band==='treasure'?'jackpot':d.band==='pair'?'pair':'win');
}
