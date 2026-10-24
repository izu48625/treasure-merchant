'use strict';
/* R5.2.3: view-only navigation wrapper. Inventory, gallery and their saved data
   keep their original independent implementations. */
function tmCollectionTabs(selected){
 const catalog=selected==='gallery';
 return '<nav class="tm-collection-switch" aria-label="コレクション内の画面切り替え">'+
  '<button type="button" data-tab="inventory" class="tm-collection-switch-item '+(!catalog?'is-active':'')+
  '" aria-current="'+(!catalog?'page':'false')+'">所持品<span class="tm-collection-switch-sub">保管・売却</span></button>'+
  '<button type="button" data-tab="gallery" class="tm-collection-switch-item '+(catalog?'is-active':'')+
  '" aria-current="'+(catalog?'page':'false')+'">図鑑<span class="tm-collection-switch-sub">発見・収集</span></button>'+
 '</nav>';
}
