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
let arcadeMode='challenge',arcadeTarget='',arcadeFreeTarget='',arcadeSelected=new Map(),arcadePage=1,arcadeBet=1000,arcadeResult=null,arcadeRarity='all',arcadeSort='rarity',arcadeVisual=null,arcadeRolling=false,arcadeWheelAngle=0;
function arcadeToday(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
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
 save();render();
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
 for(const uid of used)markDelete(uid);
 state.inv=state.inv.filter(x=>!used.has(x.uid));
 const won=arcadeRand(10000)<chance;
 let message='失敗。'+stake.count.toLocaleString('ja-JP')+'点を失いました';
 if(won){const q=quality(it.rarity);receive(it,q);message='成功！ '+it.name+'（品質'+QNAME[q]+'）を獲得'}
 arcadeSelected.clear();arcadePage=1;
 arcadeFinish('財宝大勝負',won,message,'投入：'+short(stake.amount)+'／成功確率：'+(chance/100).toFixed(2)+'%');
}
function arcadeFree(){
 if(!storageReady)return;
 if(state.arcadeFreeDay===arcadeToday())return toast('今日は無料抽選に挑戦済みです');
 const it=item(arcadeFreeTarget);if(!it)return;
 const chance=arcadeOdds(1000n,it.base,3000);
 if(!chance)return toast('確率が0.01%未満です。別の財宝を選択してください');
 if(!confirm('無料で「'+it.name+'」を狙いますか？\n成功確率：'+(chance/100).toFixed(2)+'%\n1日1回。G・アイテム消費なし'))return;
 state.arcadeFreeDay=arcadeToday();
 const won=arcadeRand(10000)<chance;
 if(won){const q=quality(it.rarity);receive(it,q)}
 arcadeFinish('無料チャレンジ',won,won?it.name+'を獲得！':'残念、ハズレ。また明日挑戦しよう','挑戦費用なし／成功確率：'+(chance/100).toFixed(2)+'%');
}
function arcadeRoulette(){
 if(!storageReady||arcadeRolling)return;
 const bet=BigInt(arcadeBet);
 if(cash()<bet)return toast('所持金が不足しています');
 if(!confirm('商会ルーレットに'+short(bet)+'を投入しますか？\nハズレはGを失います。'))return;
 if(cash()<bet)return toast('所持金が不足しています');
 setCash(cash()-bet);
 let n=arcadeRand(10000),picked=null,index=0;
 for(const o of ARCADE_ROULETTE){if(n<o.w){picked=o;break}n-=o.w;index++}
 if(!picked)throw Error('Roulette table is incomplete');
 const message=arcadePrize(picked.kind,bet,picked.m||0,false);
 const begin=ARCADE_ROULETTE.slice(0,index).reduce((sum,x)=>sum+x.w,0),center=begin+picked.w/2;
 const target=(360-center*360/10000+360)%360,start=arcadeWheelAngle;
 const distance=(target-start+360)%360;
 arcadeRolling=true;arcadeVisual={mode:'roulette',start:start,stop:start+1080+distance};arcadeWheelAngle=target;
 arcadeFinish('ルーレット',picked.kind!=='miss',message,'投入：'+short(bet)+'／当選枠：'+picked.label);
 setTimeout(()=>{arcadeRolling=false;arcadeVisual=null;render()},1600);
}
function arcadeSlot(){
 if(!storageReady||arcadeRolling)return;
 const bet=BigInt(arcadeBet);
 if(cash()<bet)return toast('所持金が不足しています');
 if(!confirm('商会スロットに'+short(bet)+'を投入しますか？\n不一致ではGを失います。'))return;
 if(cash()<bet)return toast('所持金が不足しています');
 setCash(cash()-bet);
 const rolls=[arcadeRand(5),arcadeRand(5),arcadeRand(5)];
 const kinds=new Set(rolls).size;
 let message;
 if(kinds===3)message=arcadePrize('miss',bet);
 else if(kinds===2)message=arcadePrize('cash',bet,125,true);
 else if(rolls[0]===0)message=arcadePrize('cash',bet,400,true);
 else if(rolls[0]===1)message=arcadePrize('ticket',bet,0,true);
 else if(rolls[0]===2)message=arcadePrize('item',bet,0,true);
 else if(rolls[0]===3)message=arcadePrize('cash',bet,800,true);
 else message=arcadePrize('cash',bet,1500,true);
 arcadeRolling=true;arcadeVisual={mode:'slot',reels:rolls.map(x=>ARCADE_SYMBOLS[x])};
 arcadeFinish('スロット',kinds!==3,message,'投入：'+short(bet),arcadeVisual.reels);
 setTimeout(()=>{arcadeRolling=false;arcadeVisual=null;render()},1900);
}
function arcadeAction(t){
 if(arcadeRolling)return;
 const action=t.dataset.arcade;
 if(action==='mode'){if(['challenge','free','roulette','slot'].includes(t.dataset.mode)){arcadeMode=t.dataset.mode;arcadeResult=null;render()}return}
 if(action==='bet'){const n=Number(t.dataset.bet);if(ARCADE_BETS.includes(n)){arcadeBet=n;render()}return}
 if(action==='change'){
  const g=arcadeGroups().find(x=>x.key===t.dataset.key);if(!g)return;
  const old=arcadeSelected.get(g.key)||0;
  const d=t.dataset.delta;
  const n=d==='all'?g.uids.length:old+Number(d);
  if(n>0)arcadeSelected.set(g.key,Math.min(g.uids.length,n));else arcadeSelected.delete(g.key);
  render();return
 }
 if(action==='quick'||action==='quick-n'||action==='quick-c'){for(const g of arcadeGroups()){if(action==='quick'&&['N','C'].includes(g.it.rarity)||action==='quick-n'&&g.it.rarity==='N'||action==='quick-c'&&g.it.rarity==='C')arcadeSelected.set(g.key,g.uids.length)}render();return}
 if(action==='clear'){arcadeSelected.clear();render();return}
 if(action==='more'){arcadePage++;render();return}
 if(action==='challenge')return arcadeChallenge();
 if(action==='free')return arcadeFree();
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
  return '<div class="arcade-stake-row"><div class="arcade-stake-info">'+img(g.it)+'<div class="arcade-stake-name"><b>'+esc(g.it.name)+'</b><small>'+g.it.rarity+'／'+QNAME[g.q]+(g.replica?'／複製':'')+'<br>所持'+g.uids.length+'点</small></div></div><div class="arcade-stake-buttons">'+
  '<button class="btn smallbtn" data-arcade="change" data-key="'+esc(g.key)+'" data-delta="-1">−</button><b>'+n+'</b>'+
  '<button class="btn smallbtn" data-arcade="change" data-key="'+esc(g.key)+'" data-delta="1">＋</button>'+
  '<button class="btn smallbtn" data-arcade="change" data-key="'+esc(g.key)+'" data-delta="all">全</button></div></div>';
 };
 return '<section class="panel"><div class="panelhead"><strong>⚔️ 財宝大勝負</strong><span class="tiny">アイテムを賭ける</span></div>'+
  '<p class="small">不要な財宝を何個でも投入可能。成功時は目標の財宝1個を獲得。失敗時は何も獲得できず、<b>成功・失敗のどちらでも投入品は完全消滅</b>。</p>'+
  '<label class="filter-label arcade-target">獲得したい財宝<select id="arcadeTarget">'+arcadeOptions(target.id)+'</select></label>'+arcadeTargetBox(target)+
  '<div class="arcade-summary"><div><small>投入数</small><strong>'+stake.count.toLocaleString()+'点</strong></div><div><small>投入基本金額</small><strong>'+short(stake.amount)+'</strong></div><div><small>成功確率</small><strong>'+(chance/100).toFixed(2)+'%</strong></div></div>'+
  '<div class="progress"><span style="width:'+(chance/100)+'%"></span></div>'+
  '<p class="tiny">確率＝投入品の基本金額合計／目標品の基本金額×90%（最大90%）。品質・相場変動は確率に無関係。複製品は45%換算。確率0.01%未満は挑戦不可。</p>'+
  '<div class="btns"><button class="btn smallbtn" data-arcade="quick-n">N全部</button><button class="btn smallbtn" data-arcade="quick-c">C全部</button><button class="btn smallbtn" data-arcade="quick">N/C全部</button><button class="btn smallbtn" data-arcade="clear">解除</button></div>'+ 
  '<div class="arcade-mini-filters"><label>レア度<select id="arcadeRarityFilter"><option value="all">すべて</option>'+RARITY.map(r=>'<option value="'+r+'"'+(arcadeRarity===r?' selected':'')+'>'+r+'</option>').join('')+'</select></label><label>並び順<select id="arcadeSort"><option value="rarity"'+(arcadeSort==='rarity'?' selected':'')+'>低レア順</option><option value="owned"'+(arcadeSort==='owned'?' selected':'')+'>所持数順</option><option value="base"'+(arcadeSort==='base'?' selected':'')+'>基本金額順</option></select></label></div>'+
  '<p class="tiny">保護品・お気に入りは投入対象から除外します。</p><div class="arcade-stake-list">'+(shown.map(row).join('')||'<p class="small">投入可能な財宝がありません。ガチャで集めてください。</p>')+'</div>'+
  (filtered.length>shown.length?'<button class="btn full" data-arcade="more">さらに表示（残り'+(filtered.length-shown.length)+'組）</button>':'')+
  '<button class="btn primary full" data-arcade="challenge" '+(!stake.count||!chance?'disabled':'')+'>成功確率 '+(chance/100).toFixed(2)+'%で挑戦</button></section>';
}
function arcadeFreeView(){
 const target=item(arcadeFreeTarget)||ITEMS.find(x=>x.rarity==='R')||ITEMS[0];arcadeFreeTarget=target.id;
 const chance=arcadeOdds(1000n,target.base,3000),used=state.arcadeFreeDay===arcadeToday();
 return '<section class="panel"><div class="panelhead"><strong>🎁 無料財宝チャレンジ</strong><span class="tiny">1日1回</span></div>'+
  '<p class="small">消費なしで狙った財宝を抽選。基本金額1,000G相当の成功率、最大30%。</p>'+
  '<label class="filter-label arcade-target">欲しい財宝<select id="arcadeFreeTarget">'+arcadeOptions(target.id)+'</select></label>'+arcadeTargetBox(target)+
  '<div class="arcade-summary"><div><small>投入額</small><strong>0 G</strong></div><div><small>当選確率</small><strong>'+(chance/100).toFixed(2)+'%</strong></div><div><small>残り</small><strong>'+(used?0:1)+'回</strong></div></div>'+
  '<button class="btn primary full" data-arcade="free" '+(used||!chance?'disabled':'')+'>'+(used?'今日は挑戦済み':!chance?'確率不足（0.01%未満）':'無料で挑戦する')+'</button></section>';
}
function arcadeBetView(){
 return '<div class="arcade-bet-buttons">'+ARCADE_BETS.map(n=>'<button class="btn smallbtn '+(n===arcadeBet?'primary':'')+'" data-arcade="bet" data-bet="'+n+'">'+n.toLocaleString()+'G</button>').join('')+'</div>'+
  '<div class="spaced"><span class="small">投入：<b class="gold">'+short(BigInt(arcadeBet))+'</b></span><span class="small">残高：'+short(cash())+'</span></div>';
}
function arcadeRouletteView(){
 const spin=arcadeVisual&&arcadeVisual.mode==='roulette';
 const wheel='<div class="arcade-wheel-wrap"><div class="arcade-wheel-marker">▼</div><div class="arcade-wheel '+(spin?'spinning':'')+'" style="--wheel-start:'+(spin?arcadeVisual.start:arcadeWheelAngle)+'deg;--wheel-stop:'+(spin?arcadeVisual.stop:arcadeWheelAngle)+'deg;transform:rotate('+(spin?arcadeVisual.start:arcadeWheelAngle)+'deg)"><div class="arcade-wheel-hub">G</div></div></div><p class="tiny" style="text-align:center">'+(spin?'抽選中…ルーレットが回転しています':'円盤の色は各当選枠の比率を表します')+'</p>';
 return '<section class="panel"><div class="panelhead"><strong>🎡 商会ルーレット</strong><span class="tiny">Gを賭ける</span></div>'+wheel+
  '<p class="small">ゲーム内Gを投入してG・ガチャ権利・財宝を抽選。結果は下記の確率で決まります。</p>'+arcadeBetView()+
  '<div class="arcade-odds">'+ARCADE_ROULETTE.map(o=>'<div><span>'+o.label+'</span><b>'+(o.w/100).toFixed(2)+'%</b></div>').join('')+'</div>'+
  '<p class="tiny">ガチャ権利は1,000Gにつき1回分（最低1・最大50）。財宝は基本金額が投入額の5倍以下から抽選。候補なしなら2倍G。現在のガチャ無料テストモードでは獲得権利を消費しません。</p>'+
  '<button class="btn primary full" data-arcade="roulette" '+(arcadeRolling||cash()<BigInt(arcadeBet)?'disabled':'')+'>'+(spin?'抽選中…':'ルーレットを回す')+'</button></section>';
}
function arcadeSlotView(){
 const spinning=arcadeVisual&&arcadeVisual.mode==='slot',reels=spinning?arcadeVisual.reels:(arcadeResult?.mode==='スロット'&&arcadeResult.reels?arcadeResult.reels:['🪙','🎟️','👑']);
 const visual='<div class="arcade-reels arcade-visual-reels">'+reels.map((symbol,i)=>'<div class="arcade-reel-window"><div class="arcade-reel-strip '+(spinning?'rolling':'')+'" style="--reel-delay:'+(i*250)+'ms">'+(spinning?['🪙','💎','🎁','🎟️','👑',symbol]:[symbol]).map(x=>'<span>'+x+'</span>').join('')+'</div></div>').join('')+'</div>';
 const rows=[['3つ異なる（ハズレ）','48%'],['2つ一致（1.25倍G）','48%'],['🪙3つ（4倍G）','0.8%'],['🎟️3つ（ガチャ権利）','0.8%'],['🎁3つ（財宝1個）','0.8%'],['💎3つ（8倍G）','0.8%'],['👑3つ（15倍G）','0.8%']];
 return '<section class="panel"><div class="panelhead"><strong>🎰 商会スロット</strong><span class="tiny">5絵柄・3リール</span></div>'+
  visual+'<p class="small">各リールは5絵柄が等確率。3つ揃えば特別報酬。2つ一致ならGが1.25倍になります。</p>'+arcadeBetView()+
  '<div class="arcade-odds">'+rows.map(x=>'<div><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('')+'</div>'+
  '<p class="tiny">権利は500Gにつき1回分（最低1・最大50）。財宝は投入額5倍以下の候補から抽選、候補なしなら2倍G。</p>'+
  '<button class="btn primary full" data-arcade="slot" '+(arcadeRolling||cash()<BigInt(arcadeBet)?'disabled':'')+'>'+(spinning?'抽選中…':'スロットを回す')+'</button></section>';
}
function arcade(){
 const modes=[['challenge','⚔️ 財宝勝負'],['free','🎁 無料'],['roulette','🎡 ルーレット'],['slot','🎰 スロット']];
 const nav='<div class="arcade-modes">'+modes.map(x=>'<button class="arcade-mode '+(arcadeMode===x[0]?'active':'')+'" data-arcade="mode" data-mode="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>';
 const last=arcadeResult&&!arcadeVisual?'<section class="panel arcade-result"><b>'+esc(arcadeResult.mode)+'の結果</b>'+
  (arcadeResult.reels?'<div class="arcade-reels">'+arcadeResult.reels.map(x=>'<span>'+x+'</span>').join('')+'</div>':'')+
  '<div>'+esc(arcadeResult.message)+'</div><p class="tiny">'+esc(arcadeResult.detail)+'</p></section>':'';
 return title('🏦 商会遊技場','財宝を集めて勝負するか、ゲーム内Gで運試ししよう。')+nav+last+
  (arcadeMode==='free'?arcadeFreeView():arcadeMode==='roulette'?arcadeRouletteView():arcadeMode==='slot'?arcadeSlotView():arcadeChallengeView())+
  '<p class="sheetnote">現金換金・譲渡できないゲーム内Gと財宝のみ。抽選はこの端末内の試作処理で、課金・広告・オンライン順位とは未接続です。</p>';
}
