'use strict';
/* R5.1: display-only appraisal room. RNG, pity, costs, awards, commits stay in index.html. */
const GACHA_ART={
 normal:{file:'normal',name:'通常鑑定',subtitle:'STANDARD / 鉄装の宝箱',subtitleShort:'無銘の封印箱',description:'時代もジャンルも問わず、商会の保管庫から鑑定。'},
 era:{file:'era',name:'歴史鑑定',subtitle:'ARCHIVE / 古代の封印',subtitleShort:'古代の封印箱',description:'古い時代の財宝に出会うための特別な鑑定台。'},
 modern:{file:'modern',name:'現代鑑定',subtitle:'MODERN / 精密保管庫',subtitleShort:'現代の保管箱',description:'現代の工芸品・生活品を優先的に鑑定。'},
 lux:{file:'lux',name:'高級鑑定',subtitle:'PRESTIGE / 王家の金庫',subtitleShort:'王家の封印金庫',description:'10連専用。最後の一枠はUR以上確定。'}
};
const GACHA_UI_KEY='treasure-appraisal-ui-v1';
let gachaSoundEnabled=false;
try{gachaSoundEnabled=JSON.parse(localStorage.getItem(GACHA_UI_KEY)||'{}').sound===true}catch(_){}
let gachaSoundCtx=null;
function gachaUIOption(option){
 if(option!=='sound')return;
 gachaSoundEnabled=!gachaSoundEnabled;
 try{localStorage.setItem(GACHA_UI_KEY,JSON.stringify({sound:gachaSoundEnabled}))}catch(_){}
 if(gachaSoundEnabled)gachaUIPlay('select');
 render();
}
function gachaUIPlay(kind){
 if(!gachaSoundEnabled||typeof window==='undefined')return;
 try{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
  if(!gachaSoundCtx)gachaSoundCtx=new C();
  const ctx=gachaSoundCtx;if(ctx.state==='suspended')void ctx.resume().catch(()=>{});
  const notes={select:[[520,0,.05],[760,.06,.06]],open:[[265,0,.10],[345,.09,.13],[630,.22,.13]],unveil:[[570,0,.11],[830,.13,.18]],rare:[[410,0,.17],[650,.18,.17],[1000,.37,.27]]}[kind]||[[450,0,.06]];
  notes.forEach(([freq,offset,dur])=>{
   const at=ctx.currentTime+offset,osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type=kind==='open'?'triangle':'sine';
   osc.frequency.setValueAtTime(freq,at);
   gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.032,at+.012);
   gain.gain.exponentialRampToValueAtTime(.0001,at+dur);
   osc.connect(gain);gain.connect(ctx.destination);osc.start(at);osc.stop(at+dur+.01);
  });
 }catch(_){}
}
/* Only visual frames are animated; the gacha result and reveal step were saved before this runs. */
const GACHA_CHEST_FILES={era:'historical',modern:'modern',lux:'premium'};
function gachaChestPath(type,stage){
 const key=GACHA_CHEST_FILES[type];return key?'assets/gacha/frames/chest_'+key+'_'+stage+'.webp':'assets/gacha/chest-normal.svg';
}
function gachaUIPreload(type){
 if(!GACHA_CHEST_FILES[type]||typeof Image==='undefined')return;
 for(const stage of ['opening','open']){
  const image=new Image();image.src=gachaChestPath(type,stage);
 }
}
function gachaUIStageTransition(type){
 if(!GACHA_CHEST_FILES[type]||typeof document==='undefined')return;
 const modal=document.querySelector('.tm-gacha-modal');
 if(!modal)return;
 const cover=document.createElement('div');
 cover.className='tm-unseal-cover';
 cover.innerHTML='<div class="tm-unseal-eyebrow">SEAL RELEASED</div>'+gachaVaultHTML(type,'animation')+
  '<strong class="tm-unseal-message">封印解除中</strong>';
 modal.appendChild(cover);
 const art=cover.querySelector('.tm-vault-art');
 if(!art){cover.remove();return}
 const reduce=typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const stages=reduce?[['open',180]]:[['opening',210],['open',510]];
 let i=0;
 function next(){
  if(!cover.isConnected)return;
  if(i>=stages.length){cover.remove();return}
  const [phase,duration]=stages[i++];
  cover.dataset.phase=phase;
  art.src=gachaChestPath(type,phase);
  setTimeout(next,duration);
 }
 setTimeout(next,reduce?0:100);
}
function gachaUIAfterReveal(step,previous){
 if(step<0||step>=lastPull.length)return;
 const rarity=lastPull[step]?.it?.rarity;
 gachaUIPlay(['SSR','UR','EX'].includes(rarity)?'rare':'unveil');
 if(previous<0&&!gachaQuickMode){
  const type=pullModal?.repeat?.type||gachaSelectedType;
  gachaUIStageTransition(type);
 }
}
function gachaVaultHTML(type,version='display'){
 const name=GACHA_ART[type]?type:'normal';
 return '<div class="tm-vault tm-vault-'+name+' tm-vault-'+version+'" aria-hidden="true">'+
  '<div class="tm-vault-radiance"></div>'+
  '<div class="tm-vault-inner"><div class="tm-vault-rays"></div><img class="tm-vault-art tm-vault-illustration" src="'+gachaChestPath(name,'closed')+'" alt="" draggable="false" loading="eager" decoding="async"></div>'+
  '<div class="tm-vault-plinth"><span>◆</span><span>THE TREASURE EXCHANGE</span><span>◆</span></div>'+
  '</div>';
}
function gachaUIView(){
 syncTickets();
 if(!GACHA_ART[gachaSelectedType])gachaSelectedType='normal';
 const type=gachaSelectedType,choice=buyChoice(type),lux=type==='lux',a=GACHA_ART[type];
 const tickets=state.tickets+state.bonusTickets;
 const counts=lux?[10]:[1,10,50];
 const controls=counts.map(n=>{
  const amount=BigInt(choice.price)*BigInt(n);
  const enabled=TEST_FREE_GACHA||(tickets>=n&&cash()>=amount);
  const label=lux?'10回鑑定':n===1?'1回鑑定':n+'回鑑定';
  return '<button class="tm-gacha-draw '+(n===10?'tm-main-pull':'')+'" data-gacha="'+type+'" data-count="'+n+'" data-mode="'+(TEST_FREE_GACHA?'test':'coin')+
   '" '+(enabled?'':'disabled')+' aria-label="'+label+'">'+
   '<strong>'+label+'</strong><small>'+(TEST_FREE_GACHA?'FREE TEST':short(amount))+'</small></button>';
 }).join('');
 const last=lastPull.length?'<details class="tm-gacha-history"><summary>直近の鑑定品 '+lastPull.length+'点を見る</summary><div class="loot">'+
  lastPull.slice(0,50).map(x=>tile(x.it,x.q)).join('')+'</div></details>':'';
 return '<div class="play-compact gacha-viewport tm-gacha-page">'+
  '<div class="tm-gacha-top"><div><small>THE TREASURE EXCHANGE</small><h1>財宝鑑定室</h1></div>'+
   '<button class="tm-gacha-sound" data-gacha-ui="sound" aria-pressed="'+gachaSoundEnabled+'">'+(gachaSoundEnabled?'SOUND ON':'SOUND OFF')+'</button></div>'+
  '<div class="tm-gacha-ticketbar"><span><small>鑑定権利</small><strong>'+(TEST_FREE_GACHA?'試作モード：無制限':tickets+'回')+'</strong></span>'+
  '<span><small>BALANCE</small><strong>'+short(cash())+'</strong></span></div>'+
  '<div class="tm-gacha-kinds" role="group" aria-label="鑑定種類">'+Object.entries(GACHA_ART).map(([k,v])=>
   '<button data-gacha-type="'+k+'" class="tm-gacha-kind '+(k===type?'is-active':'')+'" aria-pressed="'+(k===type)+'"><span class="tm-tab-mark" aria-hidden="true">'+
    ['normal','era','modern','lux'].indexOf(k)+1+'</span><b>'+v.name+'</b></button>').join('')+'</div>'+
  '<section class="tm-appraisal-room tm-appraisal-'+type+'">'+
  '<header class="tm-room-heading"><div><small>APPRAISAL NO. '+(['normal','era','modern','lux'].indexOf(type)+1)+'</small><strong>'+a.subtitleShort+'</strong></div>'+
  '<div class="tm-room-stamp">'+(lux?'PRESTIGE':'SEALED')+'</div></header>'+
  gachaVaultHTML(type)+
  '<p class="tm-room-caption">'+a.description+'</p>'+
  '<div class="tm-gacha-actions '+(lux?'is-lux':'')+'">'+controls+'</div>'+
  (!state.freeUsed?'<button class="tm-first-pull" data-gacha="normal" data-count="10" data-mode="intro"><span>WELCOME GIFT</span><strong>初回限定・無料10連</strong></button>':'')+
  '<div class="tm-gacha-pity"><div><span>SR以上保証まで</span><strong>'+(50-state.draws%50)+'回</strong></div><div><span>SSR以上保証まで</span><strong>'+(100-state.draws%100)+'回</strong></div></div>'+
  '</section>'+
  '<div class="tm-gacha-options"><button class="tm-gacha-quick" data-gacha-quick="1" aria-pressed="'+gachaQuickMode+'">'+(gachaQuickMode?'結果即表示：ON':'結果即表示：OFF')+'</button><span>演出省略・まとめて開封に対応</span></div>'+
  last+
  '<details class="tm-gacha-rates"><summary>排出率・鑑定権利・ルール</summary>'+ticketMeter()+
  '<p class="small">'+(TEST_FREE_GACHA?'現在は無料テスト中。正式版でのガチャ権利の取得方法は開発中。':'鑑定権利とGを使用します。')+'</p>'+
  '<div class="rate-grid">'+RARITY.map((r,i)=>'<div class="rate-item"><span>'+badge(r)+'</span><strong>'+(BASE_WEIGHTS[i]/10000).toFixed(1)+'%</strong></div>').join('')+'</div>'+
  '<p class="small">通常・歴史・現代はレアリティ内で対象ジャンルを優先します。累計50回目はSR以上、100回目はSSR以上を保証。高級10連は9個の通常枠とUR以上確定枠1つ（UR99%・EX1%）。</p></details>'+
  '<div class="page-context-actions"><button class="btn" data-tab="gallery">図鑑を開く</button></div>'+
  '</div>';
}
function gachaPullHTML(){
 if(!lastPull.length){pullModal=null;return ''}
 const step=pullModal.step,count=lastPull.length,opened=step>=0&&step<count,shown=opened?lastPull[step]:null;
 const best=lastPull.reduce((a,b)=>RARITY.indexOf(a.it.rarity)>RARITY.indexOf(b.it.rarity)?a:b);
 const type=GACHA_ART[pullModal.repeat?.type]?pullModal.repeat.type:gachaSelectedType;
 const bestLevel=RARITY.indexOf(best.it.rarity);
 const rare=shown?RARITY.indexOf(shown.it.rarity)>=4:false;
 const emblem=rare?'<span class="tm-found-flare" aria-hidden="true">✦</span>':'';
 const modalHeader='<div class="tm-dossier-heading"><small>THE TREASURE EXCHANGE / APPRAISAL</small><h2>鑑定記録</h2></div>';
 let body='';
 if(step<0){
  body='<div class="tm-opening-preview"><div class="tm-opening-counter">'+count+'個の封印が待機中</div>'+
   gachaVaultHTML(type,'intro')+'<p>封印を解いて、財宝の鑑定結果を公開する</p>'+
   '<div class="tm-reveal-actions"><button class="tm-reveal-primary" data-reveal="next">封印を解く</button>'+
   '<button class="tm-reveal-secondary" data-reveal="skip">結果をまとめて見る</button></div></div>';
 }else if(opened){
  body='<div class="tm-reveal-item" data-rarity="'+shown.it.rarity+'">'+
   '<div class="tm-item-progress"><b>鑑定 '+(step+1)+' / '+count+'</b><span>'+ (rare?'希少な財宝を発見':'鑑定完了')+'</span></div>'+
   '<div class="tm-item-stage tm-item-stage-'+shown.it.rarity+'">'+emblem+
   '<div class="tm-item-frame">'+img(shown.it)+'</div>'+
   '<div class="tm-item-name">'+badge(shown.it.rarity)+'<h3>'+esc(shown.it.name)+'</h3></div>'+
   '<div class="tm-item-value"><span>QUALITY '+esc(QNAME[shown.q])+'</span><strong>'+short(price(shown.it,shown.q))+'</strong></div>'+
   '</div><div class="tm-reveal-actions"><button class="tm-reveal-primary" data-reveal="next">'+
   (step+1===count?'鑑定結果一覧へ':'次の財宝へ')+'</button><button class="tm-reveal-secondary" data-reveal="skip">残りをまとめる</button></div></div>';
 }else{
  const counts=RARITY.map(r=>lastPull.filter(x=>x.it.rarity===r).length),top=RARITY.map((r,i)=>({r,n:counts[i]})).filter(x=>x.n&&RARITY.indexOf(x.r)>=4).reverse();
  body='<div class="tm-dossier-summary"><span>鑑定完了　'+count+'点</span><strong>最高 '+best.it.rarity+'</strong></div>'+
   (top.length?'<div class="tm-gacha-highlights">'+top.map(x=>'<span>'+x.r+' '+x.n+'点</span>').join('')+'</div>':'')+
   '<div class="tm-gacha-result-grid '+(count>10?'is-bulk':'')+'">'+lastPull.map(x=>
   '<div class="tm-gacha-result-item" data-rarity="'+x.it.rarity+'"><div class="tm-result-art">'+img(x.it)+'</div>'+
   '<div class="tm-result-rarity">'+badge(x.it.rarity)+'</div><strong title="'+esc(x.it.name)+'">'+esc(x.it.name)+'</strong>'+
   '<small>品質 '+esc(QNAME[x.q])+'</small></div>').join('')+'</div>'+
   '<div class="tm-reveal-actions tm-results-actions">'+(pullModal.repeat?
    '<button class="tm-reveal-primary" data-gacha-repeat="1">同じ'+pullModal.repeat.count+'連でもう一度</button>':'')+
   '<button class="tm-reveal-secondary" data-overlay-close="1">鑑定室に戻る</button></div>';
 }
 return '<div class="modalbackdrop tm-gacha-backdrop"><section class="modal gacha-reveal-modal tm-gacha-modal '+(step>=count?'tm-reveal-complete':'')+
  '" role="dialog" aria-modal="true" aria-label="ガチャ鑑定結果">'+
  '<button class="modal-close" data-overlay-close="1" aria-label="閉じる">×</button>'+
  modalHeader+body+'</section></div>';
}