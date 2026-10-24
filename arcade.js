'use strict';
// R4.3: offline merchant arcade. These are virtual G and virtual items, with no cash-out.
const ARCADE_ROULETTE=[
 {w:4000,label:'ハズレ',kind:'miss'},
 {w:2700,label:'1倍G',kind:'cash',m:100},
 {w:1800,label:'1.5倍G',kind:'cash',m:150},
 {w:900,label:'2倍G',kind:'cash',m:200},
 {w:400,label:'3倍G',kind:'cash',m:300},
 {w:150,label:'ガチャ権利',kind:'ticket'},
 {w:50,label:'財宝1個（候補なしなら2倍G）',kind:'item'}
];
const ARCADE_BETS=[100,1000,10000,100000,1000000];
const ARCADE_SYMBOLS=['🪙','🎟️','🎁','💎','👑'];
let arcadeSpinToken=0;
let arcadeMode='challenge',arcadeTarget='',arcadeSelected=new Map(),arcadePage=1,arcadeBet=1000,arcadeResult=null,arcadeRarity='all',arcadeSort='rarity',arcadeVisual=null,arcadeRolling=false,arcadeWheelAngle=0;
function arcadeSlotOutcome(rolls){
 const kinds=new Set(rolls).size;
 if(kinds===3)return {kind:'miss',mult:0};
 if(kinds===2)return {kind:'cash',mult:125};
 return [{kind:'cash',mult:400},{kind:'ticket',mult:0},{kind:'item',mult:0},{kind:'cash',mult:800},{kind:'cash',mult:1500}][rolls[0]];
}
// Slot v3 stores future reels and prize. Only stopped reels are exposed on screen.
function arcadeValidPending(p){
 if(!p||typeof p!=='object'||Array.isArray(p)||!Array.isArray(p.rolls)||p.rolls.length!==3||
    !Array.isArray(p.stopped)||p.stopped.length!==3||p.stopped.some(x=>typeof x!=='boolean')||
    typeof p.bet!=='string'||!/^[1-9]\d*$/.test(p.bet)||!ARCADE_BETS.some(n=>String(n)===p.bet))return false;
 if(p.slotVersion===undefined)return p.rolls.every(n=>Number.isInteger(n)&&n>=0&&n<5);
 if(p.slotVersion===2)return p.rolls.every((n,i)=>p.stopped[i]?(Number.isInteger(n)&&n>=0&&n<5):n===null);
 if(p.slotVersion!==3||!Array.isArray(p.sealedRolls)||p.sealedRolls.length!==3||
    p.sealedRolls.some(n=>!Number.isInteger(n)||n<0||n>=5))return false;
 if(!p.rolls.every((n,i)=>p.stopped[i]?n===p.sealedRolls[i]:n===null))return false;
 return arcadeSealedRewardValid(p.reward,{kind:arcadeSlotOutcome(p.sealedRolls).kind});
}
function arcadeLegacySlotSeal(p,saved){
 // Migrate old partial slot without rerolling on every restart. Saved context is stable.
 const key=p.bet+'|'+(saved._savedAt||0)+'|'+(saved._saveRev||0)+'|'+(saved.seq||0)+'|'+p.rolls.join(',');
 const rolls=p.rolls.map((n,i)=>p.stopped[i]?n:seeded(hash(key+'|reel|'+i))%5);
 const result=arcadeSlotOutcome(rolls);
 let reward={kind:result.kind};
 if(result.kind==='item'){
  const bet=BigInt(p.bet);
  const pool=ITEMS.filter(x=>BigInt(x.base)<=bet*5n&&BigInt(x.base)>=bet/5n);
  const candidates=pool.length?pool:ITEMS.filter(x=>BigInt(x.base)<=bet*5n);
  if(!candidates.length)reward={kind:'cash',fallback:true};
  else{
   const it=candidates[seeded(hash(key+'|item'))%candidates.length],n=seeded(hash(key+'|quality'))%100;
   const q=['SSR','UR','EX'].includes(it.rarity)?(n<70?1:n<95?2:3):(n<30?0:n<80?1:n<97?2:3);
   reward={kind:'item',id:it.id,q};
  }
 }
 return {slotVersion:3,rolls:p.rolls.slice(),stopped:p.stopped.slice(),bet:p.bet,sealedRolls:rolls,reward};
}

function arcadeRand(max){
 if(!Number.isSafeInteger(max)||max<1)throw Error('invalid random range');
 if(window.crypto&&window.crypto.getRandomValues){
  const a=new Uint32Array(1),limit=Math.floor(4294967296/max)*max;
  do{window.crypto.getRandomValues(a)}while(a[0]>=limit);
  return a[0]%max;
 }
 return Math.floor(Math.random()*max);
}
function arcadeGroups(){
 const map=new Map();
 for(const x of state.inv){
  if(x.locked||state.favorites.includes(x.id))continue;
  const it=item(x.id);if(!it)continue;
  const key=x.id+'|'+x.q+'|'+(x.replica?1:0);
  if(!map.has(key))map.set(key,{key:key,it:it,q:x.q,replica:!!x.replica,uids:[]});
  map.get(key).uids.push(x.uid);
 }
 return [...map.values()].sort((a,b)=>RARITY.indexOf(a.it.rarity)-RARITY.indexOf(b.it.rarity)||a.it.id.localeCompare(b.it.id)||a.q-b.q);
}
function arcadeStake(groups){
 const rows=[],ids=[];let amount=0n,count=0;
 for(const g of groups){
  const n=Math.max(0,Math.min(g.uids.length,Number(arcadeSelected.get(g.key)||0)));
  if(!n)continue;
  count+=n;
  const oneValue=BigInt(g.it.base)*(g.replica?45n:100n)/100n;
  const subtotal=oneValue*BigInt(n);
  amount+=subtotal;rows.push({key:g.key,n:n,amount:subtotal});
  for(let i=0;i<n;i++)ids.push(g.uids[i]);
 }
 return {amount:amount,count:count,ids:ids,rows:rows};
}
function arcadeOdds(amount,base,cap){
 const value=BigInt(base);if(value<=0n)return 0;
 const n=amount*9000n/value,ceiling=BigInt(cap||9000);
 return Number(n>ceiling?ceiling:n);
}
function arcadeOptions(id){
 return ITEMS.slice().sort((a,b)=>b.base-a.base).map(x=>'<option value="'+esc(x.id)+'"'+(id===x.id?' selected':'')+'>'+esc(x.name)+' · '+x.rarity+' · '+x.base.toLocaleString('ja-JP')+'G</option>').join('');
}
function arcadeItemPrize(bet){
 // The 0.5% / 0.8% prize branch is additionally weighted by the existing item catalogue.
 const pool=ITEMS.filter(x=>BigInt(x.base)<=bet*5n&&BigInt(x.base)>=bet/5n);
 const fall=pool.length?pool:ITEMS.filter(x=>BigInt(x.base)<=bet*5n);
 return fall.length?fall[arcadeRand(fall.length)]:null;
}
function arcadePrize(kind,bet,mult,slot){
 if(kind==='cash'){
  const gain=bet*BigInt(mult)/100n;setCash(cash()+gain);
  return '現金 '+short(gain)+' を獲得';
 }
 if(kind==='ticket'){
  const qty=Math.min(50,Math.max(1,Number(bet/BigInt(slot?500:1000))));
  state.bonusTickets+=qty;return 'ガチャ権利 '+qty+'回分を獲得';
 }
 if(kind==='item'){
  const it=arcadeItemPrize(bet);
  if(!it)return arcadePrize('cash',bet,200,slot)+'（該当財宝がないため代替）';
  const q=quality(it.rarity);receive(it,q);
  return it.name+'（'+it.rarity+'／品質'+QNAME[q]+'）を獲得';
 }
 return 'ハズレ。投入したGを失いました';
}
function arcadeFinish(mode,success,message,detail,reels){
 arcadeResult={mode:mode,success:success,message:message,detail:detail||'',reels:reels||null};
 state.arcadeLastResult=arcadeResult;
 saveWithCommit(()=>{render();if(mode==='スロット'&&typeof slotUIAfterOutcome==='function'&&active==='arcade')slotUIAfterOutcome(arcadeResult)});
}
function arcadeChallenge(){
 if(!storageReady)return;
 const it=item(arcadeTarget);
 const stake=arcadeStake(arcadeGroups());
 if(!it||!stake.count)return toast('目標の財宝と投入アイテムを選択してください');
 const chance=arcadeOdds(stake.amount,it.base,9000);
 if(!chance)return toast('成功確率0.01%以上になるまで投入品を増やしてください');
 if(!confirm('財宝大勝負\n目標：'+it.name+'\n投入数：'+stake.count.toLocaleString('ja-JP')+'点\n基本金額合計：'+short(stake.amount)+'\n成功確率：'+(chance/100).toFixed(2)+'%\n\n成功・失敗のどちらも投入品は完全に消滅します。図鑑の発見履歴だけ残ります。実行しますか？'))return;
 const fresh=arcadeStake(arcadeGroups());
 if(fresh.count!==stake.count||fresh.amount!==stake.amount||fresh.ids.join(',')!==stake.ids.join(','))return toast('所持品が変化しました。選択を確認してください');
 const used=new Set(fresh.ids);
 if(used.size!==stake.count)return toast('投入数の検証に失敗しました');
 for(const uid of used){markDelete(uid);selected.delete(uid)}
 state.inv=state.inv.filter(x=>!used.has(x.uid));
 const won=arcadeRand(10000)<chance;
 let message='失敗。'+stake.count.toLocaleString('ja-JP')+'点を失いました';
 if(won){const q=quality(it.rarity);receive(it,q);message='成功！ '+it.name+'（品質'+QNAME[q]+'）を獲得'}
 arcadeSelected.clear();arcadePage=1;
 arcadeFinish('財宝大勝負',won,message,'投入：'+short(stake.amount)+'／成功確率：'+(chance/100).toFixed(2)+'%');
}
// R4.14: seal all roulette prize randomness before any animation/save.
// R4.8 records without reward stay compatible and settle using the legacy method.
function arcadeSealReward(picked,bet){
 if(picked.kind==='item'){
  const it=arcadeItemPrize(bet);
  if(it)return {kind:'item',id:it.id,q:quality(it.rarity)};
  return {kind:'cash',fallback:true};
 }
 return {kind:picked.kind};
}
function arcadeSealedRewardValid(r,picked){
 if(!r||typeof r!=='object'||Array.isArray(r))return false;
 if(picked.kind==='item'){
  if(r.kind==='cash')return r.fallback===true;
  return r.kind==='item'&&ITEM_BY_ID.has(r.id)&&Number.isInteger(r.q)&&r.q>=0&&r.q<4;
 }
 return r.kind===picked.kind;
}
// Existing R4.8-R4.13 pending roulettes did not contain sealed item details.
// Derive a stable fallback from their persisted bet + wheel angle so repeated restarts
// before settlement cannot pick different items/quality in migrated sessions.
function arcadeLegacyReward(p){
 const picked=ARCADE_ROULETTE[p.index];
 if(picked.kind!=='item')return {kind:picked.kind};
 const bet=BigInt(p.bet);
 const pool=ITEMS.filter(x=>BigInt(x.base)<=bet*5n&&BigInt(x.base)>=bet/5n);
 const fallback=pool.length?pool:ITEMS.filter(x=>BigInt(x.base)<=bet*5n);
 if(!fallback.length)return {kind:'cash',fallback:true};
 let h=2166136261;
 const text=p.bet+'|'+String(p.index)+'|'+Number(p.angle).toFixed(9);
 for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);
 const it=fallback[(h>>>0)%fallback.length];
 const qualitySeed=Math.imul(h^(h>>>16),0x7feb352d)>>>0;
 const n=qualitySeed%100;
 const q=['SSR','UR','EX'].includes(it.rarity)?(n<70?1:n<95?2:3):(n<30?0:n<80?1:n<97?2:3);
 return {kind:'item',id:it.id,q};
}
function arcadeAwardSealed(picked,bet,reward){
 if(reward.kind==='item'){
  const it=item(reward.id);
  receive(it,reward.q);
  return it.name+'（'+it.rarity+'／品質'+QNAME[reward.q]+'）を獲得';
 }
 if(reward.kind==='cash'&&reward.fallback)return arcadePrize('cash',bet,200,false)+'（該当財宝がないため代替）';
 return arcadePrize(picked.kind,bet,picked.m||0,false);
}
function arcadeRoulette(){
 if(!storageReady||actionPersisting||arcadeRolling||state.arcadeRoulettePending)return;
 const bet=BigInt(arcadeBet);
 if(cash()<bet)return toast('所持金が不足しています');
 if(!confirm('商会ルーレットに'+short(bet)+'を投入しますか？\nハズレはGを失います。'))return;
 if(cash()<bet)return toast('所持金が不足しています');
 let n=arcadeRand(10000),picked=null,index=0;
 for(const o of ARCADE_ROULETTE){if(n<o.w){picked=o;break}n-=o.w;index++}
 if(!picked)throw Error('Roulette table is incomplete');
 const begin=ARCADE_ROULETTE.slice(0,index).reduce((sum,x)=>sum+x.w,0),center=begin+picked.w/2;
 const target=(360-center*360/10000+360)%360,start=arcadeWheelAngle;
 const distance=(target-start+360)%360;
 // The wager is paid now, but no winnings are added until the wheel settles.
 // Persist this pending outcome so closing the browser cannot erase the bet or double-award.
 setCash(cash()-bet);
 state.arcadeRoulettePending={index:index,bet:bet.toString(),angle:target,reward:arcadeSealReward(picked,bet)};
 const spinToken=++arcadeSpinToken;
 arcadeRolling=true;arcadeVisual={mode:'roulette',start:start,stop:start+7920+distance};arcadeWheelAngle=target;
 arcadeResult=null;
 // The spinner becomes visible only after its wager + exact result are durable.
 saveWithCommit(()=>{
  if(spinToken!==arcadeSpinToken)return;
  render();
  setTimeout(()=>{
   if(spinToken!==arcadeSpinToken)return;
   arcadeRolling=false;arcadeVisual=null;
   if(storageReady)arcadeSettle();
  },8800);
 });
}
function arcadeSkipRoulette(){
 if(!storageReady||!arcadeRolling||!state.arcadeRoulettePending)return;
 ++arcadeSpinToken; // Cancel stale completion callback, also if a new spin begins.
 arcadeRolling=false;arcadeVisual=null;
 arcadeSettle();
}
function arcadeValidRoulettePending(p){
 return !!(p&&typeof p==='object'&&!Array.isArray(p)&&Number.isInteger(p.index)&&
  p.index>=0&&p.index<ARCADE_ROULETTE.length&&typeof p.bet==='string'&&
  ARCADE_BETS.some(x=>String(x)===p.bet)&&Number.isFinite(p.angle)&&p.angle>=0&&p.angle<360&&
  (p.reward===undefined||arcadeSealedRewardValid(p.reward,ARCADE_ROULETTE[p.index])));
}
function arcadeSettle(){
 if(!storageReady||arcadeRolling)return;
 const pending=state.arcadeRoulettePending;
 if(!pending||!arcadeValidRoulettePending(pending))return;
 const picked=ARCADE_ROULETTE[pending.index],bet=BigInt(pending.bet);
 arcadeWheelAngle=pending.angle;
 const message=arcadeAwardSealed(picked,bet,pending.reward||arcadeLegacyReward(pending));
 state.arcadeRoulettePending=null;
 arcadeFinish('ルーレット',picked.kind!=='miss',message,'投入：'+short(bet)+'／当選枠：'+picked.label);
}

function arcadeSlot(){
 if(!storageReady||actionPersisting||arcadeRolling)return;
 if(state.arcadeRoulettePending)return toast('ルーレットの結果を確認してください');
 if(state.arcadeSlotPending)return toast('回転中のスロットを先に止めてください');
 const bet=BigInt(arcadeBet);
 if(cash()<bet)return toast('所持金が不足しています');
 if(!confirm('商会スロットに'+short(bet)+'を投入しますか？\n3リールと賞品は開始時に確定・保存します。\nSTOPは結果の公開のみ。途中で終了しても変わりません。'))return;
 if(cash()<bet)return toast('所持金が不足しています');
 const sealedRolls=[arcadeRand(5),arcadeRand(5),arcadeRand(5)];
 const reward=arcadeSealReward(arcadeSlotOutcome(sealedRolls),bet);
 setCash(cash()-bet);
 state.arcadeSlotPending={slotVersion:3,sealedRolls,reward,rolls:[null,null,null],
   stopped:[false,false,false],bet:bet.toString()};
 arcadeMode='slot';arcadeResult=null;
 saveWithCommit(()=>{render();if(active==='arcade'&&typeof slotUIPlay==='function')slotUIPlay('spin')});
}

function arcadeStopReels(indexes){
 if(!storageReady||actionPersisting||arcadeRolling)return;
 const pending=state.arcadeSlotPending;
 if(!pending)return;
 let updated=false;
 for(const index of indexes){
  if(!Number.isInteger(index)||index<0||index>2||pending.stopped[index])continue;
  pending.rolls[index]=pending.slotVersion===3?pending.sealedRolls[index]:arcadeRand(5);
  pending.stopped[index]=true;updated=true;
 }
 if(!updated)return;
 if(pending.stopped.some(done=>!done)){saveWithCommit(()=>{if(state.arcadeSlotPending){render();if(active==='arcade'&&typeof slotUIFeedback==='function')slotUIFeedback('stop')}});return}
 const rolls=pending.rolls.slice(),bet=BigInt(pending.bet),result=arcadeSlotOutcome(rolls);
 let message;
 if(result.kind==='item'&&pending.slotVersion===3){
  if(pending.reward.kind==='item'){
   const it=item(pending.reward.id);
   receive(it,pending.reward.q);
   message=it.name+'（'+it.rarity+'／品質'+QNAME[pending.reward.q]+'）を獲得';
  }else message=arcadePrize('cash',bet,200,true)+'（該当財宝がないため代替）';
 }else message=arcadePrize(result.kind,bet,result.mult,true);
 state.arcadeSlotPending=null;
 if(active==='arcade'&&typeof slotUIPlay==='function')slotUIPlay('stop');
 arcadeFinish('スロット',result.kind!=='miss',message,'投入：'+short(bet),rolls.map(n=>ARCADE_SYMBOLS[n]));
}

function arcadeStopReel(index){arcadeStopReels([index])}

function arcadeAction(t){
 if(actionPersisting)return;
 const action=t.dataset.arcade;
 if(action==='slot-speed'||action==='slot-sound'){if(typeof slotUIOption==='function')slotUIOption(action==='slot-speed'?'fast':'sound');return}
 if(action==='roulette-skip'){arcadeSkipRoulette();return}
 if(arcadeRolling)return;
 if(action==='roulette-settle'){arcadeSettle();return}
 if(state.arcadeRoulettePending&&action==='mode'&&t.dataset.mode!=='roulette')return toast('ルーレットの結果を確認してください');
 if(action==='stop-reel'){arcadeStopReel(Number(t.dataset.reel));return}
 if(action==='stop-all'){arcadeStopReels([0,1,2]);return}
 if(state.arcadeSlotPending&&action==='slot')return toast('先に3つのリールを止めてください');
 if(state.arcadeSlotPending&&action==='mode'&&t.dataset.mode!=='slot')return toast('先に3つのリールを止めてください');
 if(action==='mode'){if(['challenge','roulette','slot'].includes(t.dataset.mode)){arcadeMode=t.dataset.mode;arcadeResult=null;render()}return}
 if(action==='bet'){const n=Number(t.dataset.bet);if(ARCADE_BETS.includes(n)){arcadeBet=n;render()}return}
 if(action==='change'){
  const g=arcadeGroups().find(x=>x.key===t.dataset.key);if(!g)return;
  const old=arcadeSelected.get(g.key)||0;
  const d=t.dataset.delta;
  const n=d==='all'?g.uids.length:d==='leave-one'?Math.max(0,g.uids.length-1):old+Number(d);
  if(n>0)arcadeSelected.set(g.key,Math.min(g.uids.length,n));else arcadeSelected.delete(g.key);
  render();return
 }
 if(action==='quick'||action==='quick-n'||action==='quick-c'){for(const g of arcadeGroups()){if(action==='quick'&&['N','C'].includes(g.it.rarity)||action==='quick-n'&&g.it.rarity==='N'||action==='quick-c'&&g.it.rarity==='C')arcadeSelected.set(g.key,g.uids.length)}render();return}
 if(action==='clear'){arcadeSelected.clear();render();return}
 if(action==='more'){arcadePage++;render();return}
 if(action==='challenge')return arcadeChallenge();
 if(action==='roulette')return arcadeRoulette();
 if(action==='slot')return arcadeSlot();
}
function arcadeTargetBox(it){
 return '<div class="arcade-target-box">'+img(it)+'<div><strong>'+esc(it.name)+' '+badge(it.rarity)+'</strong><div class="small">基本金額：'+short(BigInt(it.base))+'</div><div class="tiny">獲得時の品質は抽選</div></div></div>';
}
function arcadeChallengeView(){
 const target=item(arcadeTarget)||ITEMS.find(x=>x.rarity==='SSR')||ITEMS[0];
 arcadeTarget=target.id;
 const groups=arcadeGroups(),stake=arcadeStake(groups),chance=arcadeOdds(stake.amount,target.base,9000);
 const filtered=groups.filter(g=>arcadeRarity==='all'||g.it.rarity===arcadeRarity);
 if(arcadeSort==='owned')filtered.sort((a,b)=>b.uids.length-a.uids.length);
 if(arcadeSort==='base')filtered.sort((a,b)=>a.it.base-b.it.base);
 const shown=filtered.slice(0,arcadePage*50);
 for(const g of filtered)if(arcadeSelected.get(g.key)&&!shown.includes(g))shown.push(g);
 const row=g=>{
  const n=Math.min(g.uids.length,arcadeSelected.get(g.key)||0);
  const attrs=' data-arcade="change" data-key="'+esc(g.key)+'"';
  return '<div class="arcade-stake-row" role="row">'+
    '<div class="arcade-stake-info" role="cell">'+img(g.it)+'<div class="arcade-stake-name"><b title="'+esc(g.it.name)+'">'+esc(g.it.name)+'</b><small>'+g.it.rarity+' / '+QNAME[g.q]+(g.replica?' / 複製':'')+'</small></div></div>'+
    '<span class="arcade-stake-have" role="cell">'+g.uids.length+'</span>'+
    '<strong class="arcade-stake-count" role="cell">'+n+'</strong>'+
    '<div class="arcade-stake-buttons" role="cell">'+
    '<button class="btn smallbtn"'+attrs+' data-delta="-1" aria-label="'+esc(g.it.name)+'を1個減らす">−</button>'+
    '<button class="btn smallbtn"'+attrs+' data-delta="1" aria-label="'+esc(g.it.name)+'を1個増やす">＋</button>'+
    '<button class="btn smallbtn"'+attrs+' data-delta="all">全部</button>'+
    '<button class="btn smallbtn"'+attrs+' data-delta="leave-one">1個残し</button>'+
    '</div></div>';
 };
 return '<section class="panel"><div class="panelhead"><strong>⚔️ 財宝大勝負</strong><span class="tiny">アイテムを賭ける</span></div>'+
  '<p class="small">不要な財宝を何個でも投入可能。成功時は目標の財宝1個を獲得。失敗時は何も獲得できず、<b>成功・失敗のどちらでも投入品は完全消滅</b>。</p>'+
  '<label class="filter-label arcade-target">獲得したい財宝<select id="arcadeTarget">'+arcadeOptions(target.id)+'</select></label>'+arcadeTargetBox(target)+
  '<div class="arcade-summary"><div><small>投入数</small><strong>'+stake.count.toLocaleString()+'点</strong></div><div><small>投入基本金額</small><strong>'+short(stake.amount)+'</strong></div><div><small>成功確率</small><strong>'+(chance/100).toFixed(2)+'%</strong></div></div>'+
  '<div class="progress"><span style="width:'+(chance/100)+'%"></span></div>'+
  '<p class="tiny">確率＝投入品の基本金額合計／目標品の基本金額×90%（最大90%）。品質・相場変動は確率に無関係。複製品は45%換算。確率0.01%未満は挑戦不可。</p>'+
  '<div class="btns"><button class="btn smallbtn" data-arcade="quick-n">N全部</button><button class="btn smallbtn" data-arcade="quick-c">C全部</button><button class="btn smallbtn" data-arcade="quick">N/C全部</button><button class="btn smallbtn" data-arcade="clear">解除</button></div>'+ 
  '<div class="arcade-mini-filters"><label>レア度<select id="arcadeRarityFilter"><option value="all">すべて</option>'+RARITY.map(r=>'<option value="'+r+'"'+(arcadeRarity===r?' selected':'')+'>'+r+'</option>').join('')+'</select></label><label>並び順<select id="arcadeSort"><option value="rarity"'+(arcadeSort==='rarity'?' selected':'')+'>低レア順</option><option value="owned"'+(arcadeSort==='owned'?' selected':'')+'>所持数順</option><option value="base"'+(arcadeSort==='base'?' selected':'')+'>基本金額順</option></select></label></div>'+
  '<p class="tiny">保護品・お気に入りは投入対象から除外します。「1個残し」は同じ品質・複製区分の行から1個残します。</p><div class="arcade-stake-list" role="table" aria-label="財宝の投入一覧"><div class="arcade-stake-head" role="row"><span role="columnheader">財宝</span><span role="columnheader">所持</span><span role="columnheader">投入</span><span role="columnheader">操作</span></div>'+(shown.map(row).join('')||'<p class="small">投入可能な財宝がありません。ガチャで集めてください。</p>')+'</div>'+
  (filtered.length>shown.length?'<button class="btn full" data-arcade="more">さらに表示（残り'+(filtered.length-shown.length)+'組）</button>':'')+
  '<button class="btn primary full" data-arcade="challenge" '+(!stake.count||!chance?'disabled':'')+'>成功確率 '+(chance/100).toFixed(2)+'%で挑戦</button></section>';
}
function arcadeBetView(){
 const labels=['100','1千','1万','10万','100万'];
 return '<div class="arcade-bet-buttons">'+ARCADE_BETS.map((n,i)=>'<button class="btn smallbtn '+(n===arcadeBet?'primary':'')+'" data-arcade="bet" data-bet="'+n+'" aria-label="賭け金'+n.toLocaleString('ja-JP')+'G">'+labels[i]+'<small>G</small></button>').join('')+'</div>'+
  '<div class="spaced arcade-bet-summary"><span>選択：<b class="gold">'+short(BigInt(arcadeBet))+'</b></span><span>残高：'+short(cash())+'</span></div>';
}
function arcadeRouletteView(){
 const spin=arcadeVisual&&arcadeVisual.mode==='roulette',pending=state.arcadeRoulettePending;
 const wheel='<div class="arcade-wheel-wrap"><div class="arcade-wheel-marker">▼</div><div class="arcade-wheel '+(spin?'spinning':'')+'" style="--wheel-start:'+(spin?arcadeVisual.start:arcadeWheelAngle)+'deg;--wheel-stop:'+(spin?arcadeVisual.stop:arcadeWheelAngle)+'deg;transform:rotate('+(spin?arcadeVisual.start:arcadeWheelAngle)+'deg)"><div class="arcade-wheel-hub">G</div></div></div>';
 const controls=pending?
  (spin?'<div class="arcade-loop-actions"><button class="btn primary full" disabled>🎡 回転中…</button><button class="btn full arcade-loop-skip" data-arcade="roulette-skip">結果へ（演出を省略）</button></div>':
   '<button class="btn primary full arcade-loop-main" data-arcade="roulette-settle">🎉 結果を確認する</button>'):
  '<button class="btn primary full arcade-loop-main" data-arcade="roulette" '+(cash()<BigInt(arcadeBet)?'disabled':'')+'>'+(arcadeResult?.mode==='ルーレット'?'🔁 同じ賭け金でもう一度':'🎡 ルーレットを回す')+'</button>';
 const odds='<details class="arcade-loop-disclosure"><summary>当選確率とルールを見る</summary><div class="arcade-odds">'+ARCADE_ROULETTE.map(o=>'<div><span>'+o.label+'</span><b>'+(o.w/100).toFixed(2)+'%</b></div>').join('')+'</div><p class="tiny">ガチャ権利は1,000Gにつき1回分（最低1・最大50）。財宝は基本金額が投入額の5倍以下から抽選。候補がなければ2倍G。現在の無料ガチャ試作版では権利を消費しません。</p></details>';
 return '<section class="panel arcade-loop-panel"><div class="panelhead"><strong>🎡 商会ルーレット</strong><span class="tiny">約8.5秒・22回転以上</span></div>'+
  wheel+'<p class="tiny arcade-loop-message">'+(spin?'回転中です。そのまま停止を待つか、周回用に演出を省略できます。':'賭け金を選んで回そう。結果の後は同じ賭け金のまま続けられます。')+'</p>'+
  (!pending?arcadeBetView():'<p class="small arcade-loop-wager">投入済み：<b class="gold">'+short(BigInt(pending.bet))+'</b></p>')+
  controls+odds+'</section>';
}
function arcadeSlotView(){return typeof slotUIView==='function'?slotUIView():'<section class="panel">スロット画面を読み込めませんでした。再読み込みしてください。</section>';}
function arcade(){
 if(!['challenge','roulette','slot'].includes(arcadeMode))arcadeMode='challenge';
 if(state.arcadeSlotPending)arcadeMode='slot';
 else if(state.arcadeRoulettePending)arcadeMode='roulette';
 const modes=[['challenge','⚔️ 財宝勝負'],['roulette','🎡 ルーレット'],['slot','🎰 スロット']];
 const nav='<div class="arcade-modes arcade-compact-modes">'+modes.map(x=>'<button class="arcade-mode '+(arcadeMode===x[0]?'active':'')+'" data-arcade="mode" data-mode="'+x[0]+'" aria-pressed="'+(arcadeMode===x[0])+'">'+x[1]+'</button>').join('')+'</div>';
 const last=arcadeMode!=='slot'&&arcadeResult&&!arcadeVisual&&!state.arcadeRoulettePending&&!state.arcadeSlotPending?
  '<section class="arcade-compact-last '+(arcadeResult.success?'won':'lost')+'"><span><b>直前の結果 · '+esc(arcadeResult.mode)+'</b><strong>'+esc(arcadeResult.message)+'</strong></span><details><summary>内訳</summary><p>'+esc(arcadeResult.detail||'結果が確定しました')+'</p></details></section>':'';
 return '<div class="play-compact arcade-viewport"><div class="arcade-topline"><h1>🏦 商会遊技場</h1><span>💰 '+short(cash())+'</span></div>'+nav+last+
  (arcadeMode==='roulette'?arcadeRouletteView():arcadeMode==='slot'?arcadeSlotView():arcadeChallengeView())+
  '<p class="sheetnote">換金・譲渡できないゲーム内Gと財宝だけを使用。広告・課金・オンラインランキングは未接続です。</p></div>';
}