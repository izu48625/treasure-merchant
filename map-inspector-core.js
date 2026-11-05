/* R6.13 map-audit viewport math. Pure, read-only, shared by pointer/zoom controls. */
(function(root,factory){
 'use strict';
 const core=factory();
 if(typeof module==='object'&&module.exports)module.exports=core;
 else root.TreasureMapAuditCore=core;
})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 const finite=v=>Number.isFinite(v);
 function fitScale(worldW,worldH,viewW,viewH,padding=16){
  if(![worldW,worldH,viewW,viewH,padding].every(finite)||worldW<=0||worldH<=0||viewW<=0||viewH<=0)return 1;
  return Math.max(.001,Math.min((viewW-2*padding)/worldW,(viewH-2*padding)/worldH));
 }
 function clampCamera(camera,worldW,worldH,viewW,viewH){
  const scale=Math.max(.001,finite(camera.scale)?camera.scale:1);
  const offset=(value,size,viewport)=>{
   if(size*scale<=viewport)return (viewport-size*scale)/2;
   return Math.max(viewport-size*scale,Math.min(0,finite(value)?value:0));
  };
  return {scale,
   x:offset(camera.x,worldW,viewW),
   y:offset(camera.y,worldH,viewH)};
 }
 function fitCamera(worldW,worldH,viewW,viewH,padding=16){
  const scale=fitScale(worldW,worldH,viewW,viewH,padding);
  return clampCamera({scale,x:(viewW-worldW*scale)/2,y:(viewH-worldH*scale)/2},
   worldW,worldH,viewW,viewH);
 }
 function worldAt(camera,sx,sy){
  return {x:(sx-camera.x)/camera.scale,y:(sy-camera.y)/camera.scale};
 }
 function screenAt(camera,wx,wy){
  return {x:wx*camera.scale+camera.x,y:wy*camera.scale+camera.y};
 }
 function zoomAt(camera,nextScale,sx,sy,worldW,worldH,viewW,viewH,minScale,maxScale){
  const scale=Math.min(maxScale,Math.max(minScale,finite(nextScale)?nextScale:camera.scale));
  const anchor=worldAt(camera,sx,sy);
  return clampCamera({scale,x:sx-anchor.x*scale,y:sy-anchor.y*scale},
   worldW,worldH,viewW,viewH);
 }
 function panBy(camera,dx,dy,worldW,worldH,viewW,viewH){
  return clampCamera({scale:camera.scale,x:camera.x+dx,y:camera.y+dy},
   worldW,worldH,viewW,viewH);
 }
 function nearestMarker(markers,screenX,screenY,camera,tolerance=22){
  let choice=null,dmin=tolerance*tolerance;
  for(const marker of markers){
   const p=screenAt(camera,marker.x,marker.y),d=(p.x-screenX)**2+(p.y-screenY)**2;
   if(d<=dmin){choice=marker;dmin=d}
  }
  return choice;
 }
 return Object.freeze({fitScale,fitCamera,clampCamera,worldAt,screenAt,zoomAt,panBy,nearestMarker});
});
