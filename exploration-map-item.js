/* R5.14: equipment-slot map for revealing the detailed raid floorplan. */
(function(root){
'use strict';
const MAP_ID='ITM-00901';
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">'+
'<rect width="256" height="256" rx="8" fill="#28302b"/>'+
'<path d="M48 34L99 45L158 30L207 46L207 215L157 200L104 219L48 204Z" fill="#c8bb8d" stroke="#7d6848" stroke-width="5"/>'+
'<path d="M99 45L103 219M158 30L157 200" stroke="#8d8059" stroke-width="3"/>'+
'<path d="M65 85H87V111H65ZM119 70H145V93H119ZM171 98H191V119H171ZM121 142H144V169H121Z" fill="none" stroke="#5f715d" stroke-width="5"/>'+
'<path d="M75 170L132 116L181 168" fill="none" stroke="#6b846f" stroke-width="6" stroke-dasharray="9 6"/>'+
'<circle cx="181" cy="168" r="9" fill="#af6048" stroke="#643d35" stroke-width="3"/>'+
'<text x="128" y="246" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="bold" fill="#e2d7b3">施設案内図</text></svg>';
const item=Object.freeze({
 id:MAP_ID,name:'施設案内図',rarity:'C',category:'道具・旅行',group:'現代・生活',
 equipmentSlot:'tool',base:850,image:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg)
});
root.TreasureMapItem=Object.freeze({id:MAP_ID,item});
if(typeof module!=='undefined'&&module.exports)module.exports=root.TreasureMapItem;
})(typeof globalThis!=='undefined'?globalThis:this);
