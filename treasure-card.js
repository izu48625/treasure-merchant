'use strict';
/* R5.2.3: shared, read-only treasure appraisal card used in gacha, inventory and gallery.
   No RNG, mutation of game state, payouts or inventory logic belongs in this file. */
const TM_CARD_RANK={
 N:'STANDARD ARCHIVE',C:'BRONZE ARCHIVE',R:'SILVER ARCHIVE',
 SR:'RARE COLLECTION',SSR:'SPECIAL COLLECTION',UR:'MASTER COLLECTION',EX:'LEGENDARY ARCHIVE'
};
function treasureCardImage(it,detail){
 const manifest=typeof TREASURE_DETAIL_ASSETS!=='undefined'?TREASURE_DETAIL_ASSETS:{};
 const high=detail&&Object.prototype.hasOwnProperty.call(manifest,it.id)?manifest[it.id]:null;
 const fallback=it.image,source=high||fallback;
 // A verified high-res file is optional. Never request made-up image paths.
 return '<img class="tm-card-item-art '+(high?'tm-card-high-res':'tm-card-catalog-art')+'" src="'+esc(source)+
  '" alt="'+esc(it.name)+'" loading="'+(detail?'eager':'lazy')+'" decoding="async"'+
  (high?' onerror="this.onerror=null;this.src='+String.fromCharCode(39)+esc(fallback)+String.fromCharCode(39)+'"':'')+'/>';
}
function treasureCard(it,q,options={}){
 if(!it)return '';
 const rarity=RARITY.includes(it.rarity)?it.rarity:'N';
 const quality=Number.isInteger(q)&&q>=0&&q<QNAME.length?q:1;
 const cost=options.value===undefined?price(it,quality,!!options.replica):options.value;
 // Identical DOM and image window for every rank, inventory and gacha.
 return '<article class="tm-dossier-card tm-dossier-r-'+rarity+' tm-treasure-card" aria-label="'+
  esc(rarity+' '+it.name+'の鑑定カード')+'">'+
  '<img class="tm-card-fixed-frame" src="assets/cards/frame-'+rarity.toLowerCase()+'.svg?v=R5.2.3b" alt="" aria-hidden="true" draggable="false" decoding="async"/>'+
  '<header class="tm-card-head"><span class="tm-card-rarity">'+rarity+'</span>'+
    '<strong class="tm-card-title" title="'+esc(it.name)+'">'+esc(it.name)+'</strong></header>'+
  '<div class="tm-card-art-window"><div class="tm-card-art-glow" aria-hidden="true"></div>'+
    treasureCardImage(it,true)+'</div>'+
  '<div class="tm-card-category"><span>'+esc(it.group||'収蔵品')+'</span><span>'+esc(it.category||'鑑定品')+'</span></div>'+
  '<div class="tm-card-stats"><div><small>品質</small><b>'+esc(QNAME[quality]||'—')+'</b></div>'+
    '<div><small>推定価値</small><strong>'+short(cost)+'</strong></div></div>'+
  
 '</article>';
}
function treasureCollectionHero(it,q,options={}){
 return '<div class="tm-detail-card-stage">'+treasureCard(it,q,options)+'</div>';
}
