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
const GACHA_CHEST_FILES={normal:'normal',era:'historical',modern:'modern',lux:'premium'};
function gachaChestPath(type,stage){
 const key=GACHA_CHEST_FILES[type];return key?'assets/gacha/frames/chest_'+key+'_'+stage+'.webp':'assets/gacha/chest-normal.svg';
}
function gachaUIPreload(type){
 if(!GACHA_CHEST_FILES[type]||typeof Image==='undefined')return;
 for(const stage of ['opening','open']){
  const image=new Image();image.src=gachaChestPath(type,stage);
 }
}
function gachaUIStageTransition(type,loot){
 if(!GACHA_CHEST_FILES[type]||typeof document==='undefined')return;
 const modal=document.querySelector('.tm-gacha-modal');
 if(!modal)return;
 const cover=document.createElement('div');
 cover.className='tm-unseal-cover';
 cover.innerHTML='<div class="tm-unseal-eyebrow">SEAL RELEASED</div>'+gachaVaultHTML(type,'animation')+
  '<div class="tm-unseal-prize" aria-hidden="true">'+(loot&&loot.it?img(loot.it):'')+'</div>'+
  '<strong class="tm-unseal-message">封印解除中</strong>';
 modal.appendChild(cover);
 const art=cover.querySelector('.tm-vault-art');
 if(!art){cover.remove();return}
 const reduce=typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduce){cover.remove();return;}
 const stages=[['opening',220],['open',350],['reveal',400]];
 let i=0;
 function next(){
  if(!cover.isConnected)return;
  if(i>=stages.length){cover.classList.add('is-ending');setTimeout(()=>cover.remove(),200);return}
  const [phase,duration]=stages[i++];
  cover.dataset.phase=phase;
  if(phase==='reveal'){
   const reward=cover.querySelector('.tm-unseal-prize');
   if(reward)reward.classList.add('is-revealed');
   cover.querySelector('.tm-unseal-message').textContent='鑑定完了';
  }else art.src=gachaChestPath(type,phase);
  setTimeout(next,duration);
 }
 setTimeout(next,100);
}
function gachaUIAfterReveal(step,previous){
 if(step<0||step>=lastPull.length)return;
 const rarity=lastPull[step]?.it?.rarity;
 gachaUIPlay(['SSR','UR','EX'].includes(rarity)?'rare':'unveil');
 if(previous<0&&!gachaQuickMode){
  const type=pullModal?.repeat?.type||gachaSelectedType;
  gachaUIStageTransition(type,lastPull[step]);
 }
}
/* The actual individually exported three-frame WebP art stays separate from state.
   Lost images fall back to the original vector art; no reroll or saved-state edits. */
function gachaVaultHTML(type,version='display'){
 const name=GACHA_ART[type]?type:'normal',art=GACHA_ART[name];
 const custom=!!GACHA_CHEST_FILES[name];
 const src=custom?gachaChestPath(name,'closed'):'assets/gacha/chest-'+art.file+'.svg';
 return '<div class="tm-vault tm-vault-'+name+' tm-vault-'+version+'" aria-hidden="true">'+
  '<div class="tm-vault-radiance"></div>'+
  '<div class="tm-vault-inner"><div class="tm-vault-rays"></div>'+
  '<img class="tm-vault-art '+(custom?'tm-vault-illustration':'')+'" src="'+src+'" alt="" draggable="false" loading="eager" '+
  (custom?'onerror="this.onerror=null;this.src=\'assets/gacha/chest-'+art.file+'.svg\'"':'')+'></div>'+
  '<div class="tm-vault-plinth"><span>◆</span><span>APPRAISAL VAULT</span><span>◆</span></div>'+
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
   '<strong>'+label+'</strong>'+(TEST_FREE_GACHA?'':'<small>'+short(amount)+'</small>')+'</button>';
 }).join('');
 const last=lastPull.length?'<details class="tm-gacha-history"><summary>直近の鑑定品 '+lastPull.length+'点を見る</summary><div class="loot">'+
  lastPull.slice(0,50).map(x=>tile(x.it,x.q)).join('')+'</div></details>':'';
 return '<div class="play-compact gacha-viewport tm-gacha-page">'+
  '<div class="tm-gacha-top"><div><h1>財宝鑑定室</h1></div>'+
   '<button class="tm-gacha-sound" data-gacha-ui="sound" aria-pressed="'+gachaSoundEnabled+'">'+(gachaSoundEnabled?'SOUND ON':'SOUND OFF')+'</button></div>'+
  '<div class="tm-gacha-ticketbar"><span><small>鑑定権利</small><strong>'+(TEST_FREE_GACHA?'無料テスト・無制限':tickets+'回')+'</strong></span>'+
  '<span><small>BALANCE</small><strong>'+short(cash())+'</strong></span></div>'+
  '<div class="tm-gacha-kinds" role="group" aria-label="鑑定種類">'+Object.entries(GACHA_ART).map(([k,v])=>
   '<button data-gacha-type="'+k+'" class="tm-gacha-kind '+(k===type?'is-active':'')+'" aria-pressed="'+(k===type)+'"><span class="tm-tab-mark" aria-hidden="true">'+
    String(['normal','era','modern','lux'].indexOf(k)+1).padStart(2,'0')+'</span><b>'+v.name+'</b></button>').join('')+'</div>'+
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
/* R5.2.2 — display-only, static catalog dossier. Every reward comes from saved lastPull.
   A detail-source is used ONLY if explicitly registered, never speculative 404 fetches. */
const TREASURE_DETAIL_ASSETS=Object.freeze({
 // Register verified, newly authored high-resolution paths here in a future art pass:
 // 'ITM-00004':'assets/treasures/large/ITM-00004.webp'
});
let gachaInspectIndex=null;
function gachaDossierImage(it,large){
 const path=large?TREASURE_DETAIL_ASSETS[it.id]:null;
 const fallback=it.image;
 const source=path||fallback;
 // There is intentionally no CSS pixel enlargement: the current catalog is 256x256.
 return '<img class="tm-dossier-art-image '+(path?'has-detail-art':'is-catalog-art')+
  '" src="'+esc(source)+'" alt="'+esc(it.name)+'" loading="eager" decoding="async"'+
  (path?' onerror="this.onerror=null;this.src='+String.fromCharCode(39)+esc(fallback)+String.fromCharCode(39)+'"':'')+'>';
}
function gachaDossierCard(x,index){
 if(!x||!x.it)return '';
 const it=x.it,r=RARITY.includes(it.rarity)?it.rarity:'N';
 const no=String(it.id||'').replace(/[^0-9]/g,'').slice(-5).padStart(5,'0');
 const high=['SSR','UR','EX'].includes(r);
 const rankLabel={N:'BASIC RECORD',C:'BRONZE RECORD',R:'SILVER RECORD',
   SR:'DISTINGUISHED',SSR:'SPECIAL COLLECTION',UR:'MASTER COLLECTION',EX:'LEGENDARY ARCHIVE'}[r];
 return '<article class="tm-dossier-card tm-dossier-r-'+r+'" aria-label="'+esc(r)+' '+esc(it.name)+'の鑑定カード">'+
  '<div class="tm-dossier-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div>'+
  '<header class="tm-dossier-card-head"><div class="tm-dossier-rank"><span>'+esc(r)+'</span><small>'+rankLabel+'</small></div>'+
   '<div class="tm-dossier-serial">NO. '+no+'</div></header>'+
  '<div class="tm-dossier-title">'+esc(it.name)+'</div>'+
  '<div class="tm-dossier-art-stage"><div class="tm-dossier-seal" aria-hidden="true"></div>'+
  '<div class="tm-dossier-art-image-wrap">'+gachaDossierImage(it,true)+'</div>'+
  (high?'<div class="tm-dossier-medal" aria-hidden="true">'+(r==='EX'?'✧':r==='UR'?'◆':'✦')+'</div>':'')+
  '</div>'+
  '<div class="tm-dossier-provenance"><span>'+esc(it.group||'収蔵品')+'</span><span>'+esc(it.category||'鑑定品')+'</span></div>'+
  '<div class="tm-dossier-facts"><div><small>QUALITY / 品質</small><b>'+esc(QNAME[x.q]||'—')+'</b></div>'+
    '<div><small>APPRAISED VALUE / 推定価値</small><strong>'+short(price(it,x.q))+'</strong></div></div>'+
  '<div class="tm-dossier-foot"><span>THE TREASURE EXCHANGE</span><span>AUTHENTICATED · '+no+'</span></div>'+
 '</article>';
}
function gachaDossierListItem(x,i){
 const it=x.it,r=RARITY.includes(it.rarity)?it.rarity:'N';
 return '<button class="tm-gacha-result-item tm-rarity-'+r+'" data-gacha-preview="'+i+
  '" aria-label="'+esc(it.name)+' '+r+' の詳細カードを見る"><span class="tm-result-art">'+gachaDossierImage(it,false)+'</span>'+
  '<span class="tm-result-rarity">'+badge(r)+'</span>'+
  '<strong title="'+esc(it.name)+'">'+esc(it.name)+'</strong>'+
  '<small>品質 '+esc(QNAME[x.q])+'</small></button>';
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
   '<div class="tm-item-progress"><b>鑑定 '+(step+1)+' / '+count+'</b><span>'+ (rare?'希少な収蔵品':'鑑定完了')+'</span></div>'+
   gachaDossierCard(shown,step)+
   '<div class="tm-reveal-actions"><button class="tm-reveal-primary" data-reveal="next">'+
   (step+1===count?'鑑定結果一覧へ':'次の財宝へ')+'</button>'+
   '<button class="tm-reveal-secondary" data-reveal="skip">残りをまとめる</button></div></div>';
 }else{
  const counts=RARITY.map(r=>lastPull.filter(x=>x.it.rarity===r).length),top=RARITY.map((r,i)=>({r,n:counts[i]})).filter(x=>x.n&&RARITY.indexOf(x.r)>=4).reverse();
  body='<div class="tm-dossier-summary"><span>鑑定完了　'+count+'点</span><strong>最高 '+best.it.rarity+'</strong></div>'+
   (top.length?'<div class="tm-gacha-highlights">'+top.map(x=>'<span>'+x.r+' '+x.n+'点</span>').join('')+'</div>':'')+
   (gachaInspectIndex!==null&&gachaInspectIndex>=0&&gachaInspectIndex<count?
     '<div class="tm-inline-preview"><div class="tm-inline-preview-head"><strong>収蔵品の詳細鑑定</strong>'+
      '<button data-gacha-preview-close="1" aria-label="一覧に戻る">一覧に戻る ×</button></div>'+
      gachaDossierCard(lastPull[gachaInspectIndex],gachaInspectIndex)+'</div>':'')+
   '<div class="tm-gacha-result-grid '+(count>10?'is-bulk':'')+'">'+
    lastPull.map((x,i)=>gachaDossierListItem(x,i)).join('')+'</div>'+
   '<div class="tm-reveal-actions tm-results-actions">'+(pullModal.repeat?
    '<button class="tm-reveal-primary" data-gacha-repeat="1">同じ'+pullModal.repeat.count+'連でもう一度</button>':'')+
   '<button class="tm-reveal-secondary" data-overlay-close="1">鑑定室に戻る</button></div>';
 }
 return '<div class="modalbackdrop tm-gacha-backdrop"><section class="modal gacha-reveal-modal tm-gacha-modal '+(step>=count?'tm-reveal-complete':'')+
  '" role="dialog" aria-modal="true" aria-label="ガチャ鑑定結果">'+
  '<button class="modal-close" data-overlay-close="1" aria-label="閉じる">×</button>'+
  modalHeader+body+'</section></div>';
}