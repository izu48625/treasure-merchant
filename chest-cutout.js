'use strict';
/* R5.2.3g — conservative pixel-edge cleanup for alpha-matted chest WebPs.
 * This does not change the treasure image, gacha drawing, or saved outcomes.
 * The original source asset remains intact and is used as a fail-safe.
 */
(() => {
 const cache = new Map();
 const WIDTH_LIMIT = 1024, MAX_PIXELS = 1024*1024;

 function refineChestCutout(img){
  if (!img || !img.matches('.tm-vault-art.tm-vault-illustration')) return;
  if (!img.isConnected) return;
  const path=img.getAttribute('src')||'';
  if (!/assets\/gacha\/frames\/chest_(?:normal|historical|modern|premium)_(?:closed|opening|open)\.webp(?:\?.*)?$/.test(path)) return;
  if (img.dataset.cutoutSource===path) return;
  img.dataset.cutoutSource=path;
  if (cache.has(path)){img.src=cache.get(path);return;}
  const w=img.naturalWidth,h=img.naturalHeight;
  if (!w || !h || w>WIDTH_LIMIT || h>WIDTH_LIMIT || w*h>MAX_PIXELS) return;
  try{
   const canvas=document.createElement('canvas');
   canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if (!ctx) return;
   ctx.drawImage(img,0,0,w,h);
   const frame=ctx.getImageData(0,0,w,h),p=frame.data;
   const count=w*h;
   const original=new Uint8Array(count);
   let occupied=0;
   for (let k=0,j=3;k<count;k++,j+=4){
    original[k]=p[j];
    if (p[j]>=48)occupied++;
   }
   // Skip files with no alpha, or a virtually empty image.
   if (occupied<200 || occupied>count*.94) return;
   // Preserve the main connected treasure body; remove truly separate tiny
   // matte flecks (the red/cyan single-pixel debris visible around WebP rims).
   const visited=new Uint8Array(count),component=new Uint8Array(count);
   const queue=new Int32Array(count);
   let largest=0,mainStart=-1;
   for (let seed=0;seed<count;seed++){
    if (visited[seed]||original[seed]<48)continue;
    let head=0,tail=1;queue[0]=seed;visited[seed]=1;
    while(head<tail){
     const px=queue[head++],x=px%w,y=(px/w)|0;
     // Use 8-connectivity to protect diagonal gold clasps and thin handles.
     for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=w||ny>=h)continue;
      const next=ny*w+nx;
      if(visited[next]||original[next]<48)continue;
      visited[next]=1;queue[tail++]=next;
     }
    }
    if(tail>largest){largest=tail;mainStart=seed;}
   }
   if (mainStart<0 || largest<occupied*.65) return;
   // Mark dominant shape using one additional BFS, without storing all blobs.
   let head=0,tail=1;queue[0]=mainStart;component[mainStart]=1;
   while(head<tail){
    const px=queue[head++],x=px%w,y=(px/w)|0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     if(!dx&&!dy)continue;
     const nx=x+dx,ny=y+dy;
     if(nx<0||ny<0||nx>=w||ny>=h)continue;
     const j=ny*w+nx;
     if(!component[j]&&original[j]>=48){component[j]=1;queue[tail++]=j;}
    }
   }
   let edits=0;
   const nextAlpha=new Uint8Array(original);
   for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const k=y*w+x,a=original[k];
    if(a===0)continue;
    let neighbors=0,opaque=0,connected=false;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     const n=(y+dy)*w+(x+dx);
     if (original[n]>=48)neighbors++;
     if (original[n]>=215)opaque++;
     if(component[n])connected=true;
    }
    // Only truly isolated fragments are removed; adjacent soft edges survive.
    if(!connected && neighbors<=2){nextAlpha[k]=0;edits++;continue;}
    if(a<18 && neighbors<=3){nextAlpha[k]=0;edits++;continue;}
    // Restore tiny accidental one-pixel cuts INSIDE the solid object.
    if(a<215 && opaque>=8){nextAlpha[k]=215;edits++;}
   }
   // Fix single-pixel transparent holes without damaging open locks/handles.
   for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const k=y*w+x;
    if(original[k]>=18||nextAlpha[k]>0)continue;
    let solid=0,r=0,g=0,b=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     if(!dx&&!dy)continue;
     const n=(y+dy)*w+(x+dx);
     if(original[n]<240)continue;
     solid++;r+=p[n*4];g+=p[n*4+1];b+=p[n*4+2];
    }
    if(solid===8){
     nextAlpha[k]=205;
     p[k*4]=Math.round(r/8);p[k*4+1]=Math.round(g/8);p[k*4+2]=Math.round(b/8);
     edits++;
    }
   }
   // Unmix colored/black matte only at semitransparent silhouette edges.
   // Source RGB within the solid body is intentionally never changed.
   for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
    const k=y*w+x,a=nextAlpha[k];
    if(a<18||a>=175||!component[k])continue;
    let nearest=-1,best=99;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
     const n=(y+dy)*w+(x+dx);
     if(original[n]<245)continue;
     const dist=dx*dx+dy*dy;
     if(dist<best){best=dist;nearest=n;}
    }
    if(nearest<0)continue;
    const weight=a<65?.55:.25;
    const off=k*4,near=nearest*4;
    for(let c=0;c<3;c++){
     const originalChannel=p[off+c];
     const neighboringChannel=p[near+c];
     const mixed=Math.round(originalChannel*(1-weight)+neighboringChannel*weight);
     if(mixed!==originalChannel){p[off+c]=mixed;edits++;}
    }
   }
   if(!edits)return;
   for(let k=0,j=3;k<count;k++,j+=4)p[j]=nextAlpha[k];
   // No chroma-key deletion, so dark timber and metal remain intact.
   ctx.putImageData(frame,0,0);
   const cleaned=canvas.toDataURL('image/webp',.98);
   if(!cleaned.startsWith('data:image/'))return;
   if(cache.size>=12)cache.clear();
   cache.set(path,cleaned);
   // Never override the subsequent animation frame if the source has changed.
   if(img.isConnected && img.getAttribute('src')===path)img.src=cleaned;
  }catch(_){/* Canvas unsupported, blocked or memory pressure: original art wins. */}
 }
 document.addEventListener('load',e=>{
  const t=e.target;
  if(t&&t.tagName==='IMG'&&t.classList.contains('tm-vault-illustration'))refineChestCutout(t);
 },true);
 // Browsers sometimes complete memory-cached images synchronously.
 function sweep(){
  for(const img of document.querySelectorAll('.tm-vault-illustration')){
   if(img.complete&&img.naturalWidth)refineChestCutout(img);
  }
 }
 document.addEventListener('DOMContentLoaded',sweep,{once:true});
})();
