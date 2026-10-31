/* Original Tiled map runtime for Treasure Merchant's optional indoor pilot.
   Read-only: never mutates merchant inventory or the production exploration save. */
(function(root,factory){
 const exported=factory();
 if(typeof module==='object'&&module.exports)module.exports=exported;
 else root.TreasureTiledMap=exported;
})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 const FLIP_H=0x80000000,FLIP_V=0x40000000,FLIP_D=0x20000000,BASE_MASK=0x0fffffff;
 function layer(map,name){return map.layers.find(v=>v.type==='tilelayer'&&v.name===name)}
 function objects(map,type){const groups=map.layers.filter(x=>x.type==='objectgroup');
  return groups.flatMap(g=>g.objects).filter(o=>!type||o.type===type)}
 function prop(obj,name,fallback=null){
  const p=(obj.properties||[]).find(p=>p.name===name);
  return p?p.value:fallback;
 }
 function createModel(map,tileset){
  if(!map||map.type!=='map'||map.orientation!=='orthogonal'||
   !Number.isInteger(map.width)||!Number.isInteger(map.height)||map.width<1||
   map.height<1||map.width>500||map.height>500||
   map.tilewidth!==tileset.tilewidth||map.tileheight!==tileset.tileheight)
   throw Error('Unsupported Tiled map geometry');
  if(!Array.isArray(map.tilesets)||map.tilesets.length!==1||
   map.tilesets[0].firstgid!==1||map.infinite)throw Error('Expected single external tileset, finite layers');
  const size=map.width*map.height;
  const layers=map.layers.filter(l=>l.type==='tilelayer');
  if(!layers.length||layers.some(l=>l.width!==map.width||l.height!==map.height||
   !Array.isArray(l.data)||l.data.length!==size))throw Error('Invalid Tiled tile layer');
  const blocked=new Set(tileset.tiles.filter(t=>prop(t,'solid',false)).map(t=>t.id+1));
  const walls=layer(map,'Walls'),furniture=layer(map,'Furniture'),floor=layer(map,'Floor');
  if(!walls||!furniture||!floor)throw Error('Missing gameplay tile layers');
  // R5.32 added solid shelving and equipment on a separate editable layer.
  // Keep every collidable layer as one source of truth for player and enemy vision.
  const solidLayers=layers.filter(l=>['Walls','Furniture','SetDressing'].includes(l.name));
  // R5.62: furniture covers are authored beside each original Tiled prop.
  // Contact rectangles protect the central/low part only, so players can
  // manoeuvre around the sprite and enemies lose line of sight behind it.
  const coverRects=objects(map,'theme-prop').filter(o=>Number(prop(o,'coverW',0))>0&&Number(prop(o,'coverH',0))>0)
   .map(o=>{
    const w=Math.max(2,Math.min(30,Number(prop(o,'coverW',0))));
    const h=Math.max(2,Math.min(24,Number(prop(o,'coverH',0))));
    return {x:o.x-w/2,y:o.y-h/2+Number(prop(o,'coverOffsetY',0)),w,h,name:o.name,
     detail:prop(o,'detail','')};
   });
  const coverHits=(x,y,r)=>coverRects.some(c=>
   x+r>c.x&&x-r<c.x+c.w&&y+r>c.y&&y-r<c.y+c.h);
  const get=(l,x,y)=>x<0||y<0||x>=map.width||y>=map.height?0:(l.data[y*map.width+x]>>>0)&BASE_MASK;
  function solidAt(x,y,r=0){
   const checks=r>0?[[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r],[x,y]]:[[x,y]];
   return checks.some(([px,py])=>{
    const tx=Math.floor(px/map.tilewidth),ty=Math.floor(py/map.tileheight);
    return tx<0||ty<0||tx>=map.width||ty>=map.height||
     !get(floor,tx,ty)||solidLayers.some(l=>blocked.has(get(l,tx,ty)));
   })||coverHits(x,y,r);
  }
  function lineClear(a,b){
   const d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(d/5));
   for(let i=1;i<n;i++)if(solidAt(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,1))return false;
   return true;
  }
  const spawn=objects(map,'spawn')[0],extract=objects(map,'extract')[0];
  if(!spawn||!extract||solidAt(spawn.x,spawn.y,3)||solidAt(extract.x,extract.y,3))
   throw Error('Missing accessible spawn/extraction');
  // This is a pilot map, so do not make global economy assumptions here.
  function reachable(){
   const w=map.width,h=map.height,start=Math.floor(spawn.y/map.tileheight)*w+Math.floor(spawn.x/map.tilewidth);
   const seen=new Uint8Array(w*h),q=[start];seen[start]=1;
   for(let i=0;i<q.length;i++){const c=q[i],x=c%w,y=c/w|0;
    for(const t of [x?c-1:-1,x<w-1?c+1:-1,y?c-w:-1,y<h-1?c+w:-1]){
     if(t<0||seen[t])continue;
     const px=(t%w+.5)*map.tilewidth,py=((t/w|0)+.5)*map.tileheight;
     if(solidAt(px,py,2))continue;
     seen[t]=1;q.push(t);
    }
   }
   return {seen,count:q.length};
  }

  // R5.58: interior styles authored in the Tiled InteriorThemes object layer.
  // Purely visual room markings: original Tiled solid tiles and AI paths stay canonical.
  const themeZones=objects(map,'theme-zone'),themeProps=objects(map,'theme-prop');
  // One externally-authored 3x3 pixel atlas, not per-frame generated rectangles.
  // Keep the vector fallback when the optional asset cannot load (offline Safari).
  let roomAtlas=null;
  function setRoomAtlas(image){
   if(image&&image.complete!==false&&(image.naturalWidth===undefined||image.naturalWidth>=192))
    roomAtlas=image;
  }
  const artTile={monitor:0,camera:1,medicine:2,exam:3,gold:4,laser:5};
  const wallArt=[
   {x:56,y:164,style:'pharmacy',tile:6},{x:170,y:164,style:'pharmacy',tile:6},
   {x:328,y:164,style:'security',tile:7},{x:433,y:164,style:'security',tile:7},
   {x:567,y:483,style:'vault',tile:8},{x:669,y:483,style:'vault',tile:8}
  ];
  function drawAtlasTile(ctx,index,x,y,scale,w=32,h=24){
   if(!roomAtlas)return false;
   const col=index%3,row=Math.floor(index/3);
   ctx.drawImage(roomAtlas,col*64,row*48,64,48,
    Math.round(x*scale),Math.round(y*scale),Math.round(w*scale),Math.round(h*scale));
   return true;
  }
  const palettes={
   archive:['#765b54','#d1ad7c'],pharmacy:['#397d79','#a8e4d1'],
   control:['#536879','#a6c7d2'],security:['#244e72','#79bddf'],
   corridor:['#6b6e54','#ddbc68'],storage:['#7b634d','#d9b481'],
   receiving:['#86694c','#f2c05b'],vault:['#755269','#e9b66e'],
   checkpoint:['#416d7b','#95d9e0']
  };
  function themeFloor(ctx,cam,scale){
   if(!themeZones.length||typeof ctx.strokeRect!=='function')return;
   const t=map.tilewidth;
   const right=cam.x+ctx.canvas.width/scale,bottom=cam.y+ctx.canvas.height/scale;
   ctx.save();ctx.imageSmoothingEnabled=false;
   for(const z of themeZones){
    if(z.x>right||z.y>bottom||z.x+z.width<cam.x||z.y+z.height<cam.y)continue;
    const theme=prop(z,'style',''),colors=palettes[theme];if(!colors)continue;
    const fromX=Math.max(0,Math.floor(z.x/t)),toX=Math.min(map.width-1,Math.ceil((z.x+z.width)/t)-1);
    const fromY=Math.max(0,Math.floor(z.y/t)),toY=Math.min(map.height-1,Math.ceil((z.y+z.height)/t)-1);
    for(let y=fromY;y<=toY;y++)for(let x=fromX;x<=toX;x++){
     const wx=(x+.5)*t,wy=(y+.5)*t;
     if(wx<cam.x-t||wx>right+t||wy<cam.y-t||wy>bottom+t||!get(floor,x,y))continue;
     // Do not recolor solid walls or their fixtures as though they were a floor.
     if(solidLayers.some(l=>blocked.has(get(l,x,y))))continue;
     const px=Math.floor((x*t-cam.x)*scale),py=Math.floor((y*t-cam.y)*scale),size=Math.ceil(t*scale);
     ctx.globalAlpha=.40;ctx.fillStyle=colors[0];ctx.fillRect(px,py,size,size);
     ctx.globalAlpha=.4;ctx.strokeStyle=colors[1];ctx.lineWidth=1;
     if(theme==='pharmacy'){
      ctx.strokeRect(px+2,py+2,size-4,size-4);
      if((x+y)%7===0){ctx.fillStyle='#d9f7eb';ctx.fillRect(px+size/2-2,py+size/2-9,4,18);ctx.fillRect(px+size/2-9,py+size/2-2,18,4)}
     }else if(theme==='archive'){
      ctx.fillStyle=colors[1];if(y%2===0)ctx.fillRect(px,py+size-5,size,2);
      if(x%3===0)ctx.fillRect(px+4,py+5,2,size-10);
     }else if(theme==='security'){
      ctx.strokeRect(px+3,py+3,size-6,size-6);if((x+y)%4===0){ctx.fillStyle='#80c5ea';ctx.fillRect(px+size/2-3,py+size/2-3,6,6)}
     }else if(theme==='control'){
      for(let k=6;k<size;k+=13){ctx.fillStyle=colors[1];ctx.fillRect(px+k,py+3,2,size-6)}
     }else if(theme==='receiving'||theme==='corridor'){
      if((x+y)%4===0){ctx.fillStyle=colors[1];ctx.fillRect(px+3,py+size-8,size-6,4)}
     }else if(theme==='storage'){
      if((x+y)%3===0){ctx.strokeRect(px+6,py+6,size-12,size-12)}
     }else if(theme==='vault'){
      ctx.strokeRect(px+4,py+4,size-8,size-8);
      if((x+y)%3===0){ctx.fillStyle=colors[1];ctx.fillRect(px+size/2-5,py+size/2-5,10,10)}
     }else if(theme==='checkpoint'){
      if((x+y)%4===0){ctx.fillStyle=colors[1];ctx.fillRect(px+size/2-5,py+5,10,size-10)}
     }
    }
   }
   ctx.restore();
  }
  // R5.59: oversized floor stencils and door thresholds give every section
  // a recognisable silhouette at a phone-scale camera zoom. Cosmetic only.
  // No random texture or extra colliders: gameplay remains driven by Tiled.
  const siteMarkings={
   archive:{word:'RECORDS / A-01',index:'01',shade:'#c99c69'},
   pharmacy:{word:'MEDICAL / P-02',index:'02',shade:'#a2e9d5'},
   control:{word:'POWER / E-03',index:'03',shade:'#b1c4d3'},
   security:{word:'SURVEILLANCE / S-04',index:'04',shade:'#88d6f0'},
   corridor:{word:'TRANSFER / C-05',index:'05',shade:'#e5ca78'},
   storage:{word:'INVENTORY / W-06',index:'06',shade:'#d3b27f'},
   receiving:{word:'DOCK / D-07',index:'07',shade:'#eec27a'},
   vault:{word:'RESTRICTED / V-08',index:'08',shade:'#edc189'},
   checkpoint:{word:'EGRESS / X-09',index:'09',shade:'#a4e5d4'}
  };
  const zoneAtCell=(x,y)=>{
   const px=(x+.5)*map.tilewidth,py=(y+.5)*map.tileheight;
   for(const z of themeZones)if(px>=z.x&&px<z.x+z.width&&py>=z.y&&py<z.y+z.height)
    return prop(z,'style','');
   return '';
  };
  const thresholds=[];
  if(themeZones.length)for(let y=1;y<map.height-1;y++)for(let x=1;x<map.width-1;x++){
   const own=zoneAtCell(x,y);
   if(!siteMarkings[own]||!get(floor,x,y)||solidLayers.some(l=>blocked.has(get(l,x,y))))continue;
   const west=zoneAtCell(x-1,y),north=zoneAtCell(x,y-1);
   if(west&&west!==own&&get(floor,x-1,y)&&!solidLayers.some(l=>blocked.has(get(l,x-1,y))))
    thresholds.push({x:x*map.tilewidth,y:y*map.tileheight,vertical:true,shade:siteMarkings[own].shade});
   if(north&&north!==own&&get(floor,x,y-1)&&!solidLayers.some(l=>blocked.has(get(l,x,y-1))))
    thresholds.push({x:x*map.tilewidth,y:y*map.tileheight,vertical:false,shade:siteMarkings[own].shade});
  }
  function drawSiteIdentity(ctx,cam,scale){
   if(!themeZones.length||typeof ctx.fillText!=='function'||typeof ctx.strokeRect!=='function')return;
   const right=cam.x+ctx.canvas.width/scale,bottom=cam.y+ctx.canvas.height/scale;
   ctx.save();ctx.imageSmoothingEnabled=false;
   for(const t of thresholds){
    if(t.x<cam.x-20||t.y<cam.y-20||t.x>right+20||t.y>bottom+20)continue;
    const x=Math.round((t.x-cam.x)*scale),y=Math.round((t.y-cam.y)*scale);
    ctx.fillStyle=t.shade;ctx.globalAlpha=.55;
    if(t.vertical){ctx.fillRect(x-2,y+5,4,map.tileheight*scale-10);
     ctx.fillRect(x+4,y+9,2,map.tileheight*scale-18);}
    else{ctx.fillRect(x+5,y-2,map.tilewidth*scale-10,4);
     ctx.fillRect(x+9,y+4,map.tilewidth*scale-18,2);}
   }
   ctx.globalAlpha=1;
   for(const z of themeZones){
    if(z.x>right+90||z.y>bottom+90||z.x+z.width<cam.x-90||z.y+z.height<cam.y-90)continue;
    const style=prop(z,'style',''),sign=siteMarkings[style];if(!sign)continue;
    const mx=z.x+z.width*.5,my=z.y+z.height*.52;
    const x=(mx-cam.x)*scale,y=(my-cam.y)*scale;
    // These sit under actual wall and furniture sprites; they never suggest
    // that a new barrier or a shortcut is present.
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);
    const f=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h)};
    ctx.globalAlpha=.24;ctx.fillStyle='#101b22';ctx.fillRect(-51,-30,102,57);
    ctx.strokeStyle=sign.shade;ctx.lineWidth=1;ctx.strokeRect(-49,-28,98,53);
    ctx.fillStyle=sign.shade;ctx.font='bold 12px monospace';ctx.textAlign='center';
    ctx.fillText(sign.index,0,-2);
    ctx.font='bold 5px monospace';ctx.fillText(sign.word,0,13);
    ctx.globalAlpha=.42;
    if(style==='pharmacy'){
     f(-36,-13,12,28,'#e7f4e9');f(-44,-5,28,12,'#e7f4e9');
     f(24,-13,12,28,'#e7f4e9');f(16,-5,28,12,'#e7f4e9');
    }else if(style==='archive'){
     for(let yy=-18;yy<=18;yy+=12){f(-43,yy,16,3,'#bc865c');f(27,yy,16,3,'#bc865c');}
    }else if(style==='control'){
     for(let n=0;n<3;n++){f(-46+n*6,-18+n*5,3,27,'#c2cdd1');f(34+n*6,-18+n*5,3,27,'#c2cdd1');}
    }else if(style==='security'){
     for(let n=0;n<3;n++){f(-44+n*12,-17,9,9,'#6fb8d8');f(20+n*12,-17,9,9,'#6fb8d8');}
    }else if(style==='storage'){
     f(-43,-16,25,31,'#ae854b');f(18,-16,25,31,'#ae854b');
     for(let n=-9;n<17;n+=9){f(-40,n,18,3,'#e6be8c');f(22,n,18,3,'#e6be8c');}
    }else if(style==='receiving'){
     for(let yy=-20;yy<=15;yy+=11){f(-43,yy,14,5,'#e3ac4c');f(29,yy,14,5,'#e3ac4c');}
    }else if(style==='vault'){
     ctx.strokeStyle='#e0bf88';ctx.lineWidth=3;ctx.strokeRect(-41,-23,82,47);
     ctx.strokeRect(-34,-16,68,33);f(-45,-4,11,8,'#d35f52');f(34,-4,11,8,'#d35f52');
    }else if(style==='checkpoint'){
     f(-45,-21,8,42,'#7bd4c8');f(37,-21,8,42,'#7bd4c8');
     f(-33,-3,12,6,'#b7e6dc');f(21,-3,12,6,'#b7e6dc');
    }else if(style==='corridor'){
     f(-44,-20,24,4,'#d4b858');f(20,-20,24,4,'#d4b858');
     f(-44,20,24,4,'#d4b858');f(20,20,24,4,'#d4b858');
    }
    ctx.restore();
   }
   ctx.restore();
  }
  function themeDetails(ctx,cam,scale){
   if(!themeProps.length||typeof ctx.strokeRect!=='function'||typeof ctx.fillText!=='function')return;
   ctx.save();ctx.imageSmoothingEnabled=false;
   // Wall-fitted details are non-interactive. The existing Tiled wall/furniture
   // collision layers remain authoritative (we never create invisible barriers).
   if(roomAtlas)for(const wall of wallArt){
    if(wall.x+32<cam.x||wall.y+24<cam.y||wall.x>cam.x+ctx.canvas.width/scale||
       wall.y>cam.y+ctx.canvas.height/scale)continue;
    drawAtlasTile(ctx,wall.tile,wall.x-cam.x,wall.y-cam.y,scale);
   }
   const colors={archive:'#d2a879',pharmacy:'#a0e2ce',control:'#b8c9ce',
    security:'#82d7f1',corridor:'#f6c979',storage:'#d8b58b',
    receiving:'#f7c36e',vault:'#f5cb75',checkpoint:'#b7e9eb'};
   for(const o of themeProps){
    if(o.x<cam.x-50||o.y<cam.y-40||o.x>cam.x+ctx.canvas.width/scale+50||
       o.y>cam.y+ctx.canvas.height/scale+40)continue;
    const style=prop(o,'style',''),detail=prop(o,'detail','');
    const accent=colors[style]||'#bac4c8';
    // Replace the previous symbolic 2-D boxes with dedicated sprite artwork
    // for the priority security, medical and high-security vault furniture.
    if(roomAtlas&&Object.prototype.hasOwnProperty.call(artTile,detail)){
     drawAtlasTile(ctx,artTile[detail],o.x-cam.x-16,o.y-cam.y-12,scale);
     continue;
    }
    ctx.save();ctx.translate(Math.round((o.x-cam.x)*scale),Math.round((o.y-cam.y)*scale));ctx.scale(scale*.7,scale*.7);
    const fill=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h)};
    const stroke=(x,y,w,h,c)=>{ctx.strokeStyle=c;ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1)};
    const label=(str,x,y,c=accent,sz=7)=>{ctx.fillStyle=c;ctx.font='bold '+sz+'px monospace';ctx.textAlign='center';ctx.fillText(str,x,y)};
    // Anchored contact shadow adds depth without making decorative objects collide.
    ctx.fillStyle='rgba(5,13,19,.32)';ctx.fillRect(-27,12,55,8);

    if(detail==='books'){
     fill(-24,-10,48,25,'#342f34');stroke(-24,-10,48,25,accent);
     for(let x=-20;x<21;x+=5){fill(x,-7,3,18,['#c7795d','#a8a6c4','#d4bd82','#7c9e8e'][Math.floor((x+20)/5)%4]);}
     fill(-24,4,48,3,'#d1a77b');label('ARCHIVE',0,-13);
    }else if(detail==='document'){
     fill(-22,-13,44,28,'#4d4540');stroke(-22,-13,44,28,accent);
     for(let y=-8;y<12;y+=5){fill(-15,y,30,2,'#d6c4a2')}label('DOC',0,-16);
    }else if(detail==='medicine'){
     fill(-24,-13,48,31,'#42616a');stroke(-24,-13,48,31,'#a7ede3');
     for(let k=0;k<5;k++){let x=-18+k*8;fill(x,-7,5,12,k%2?'#83b8bf':'#d6e9d8');fill(x,-9,5,3,'#e9e1dc');}
     fill(-24,6,48,3,'#e3e7d9');label('MED',0,-16);
    }else if(detail==='cross'){
     fill(-13,-13,26,26,'#eff5ef');fill(-3,-10,6,20,'#d4575d');fill(-10,-3,20,6,'#d4575d');stroke(-13,-13,26,26,'#cee8d8');
    }else if(detail==='exam'){
     fill(-25,-9,50,21,'#e8efec');stroke(-25,-9,50,21,'#86b7b6');fill(-23,-7,14,17,'#94c8c7');fill(-25,12,50,4,'#62767c');
    }else if(detail==='monitor'){
     fill(-25,-14,50,30,'#192a35');stroke(-25,-14,50,30,accent);
     for(let k=0;k<3;k++){fill(-19+k*14,-8,11,15,k%2?'#396b82':'#305d70');fill(-17+k*14,0,7,2,'#7cdfac')}
     fill(-22,12,44,2,'#9ab0ae');label('CAM',0,-17);
    }else if(detail==='camera'){
     fill(-15,-8,30,15,'#4e6574');fill(5,-6,11,9,'#243c49');fill(-5,8,3,10,'#bac8c9');stroke(-15,-8,30,15,accent);
    }else if(detail==='power'){
     fill(-22,-15,44,31,'#4c555c');stroke(-22,-15,44,31,accent);fill(-17,-9,34,20,'#82909b');
     label('⚡',0,7,'#f8d373',16);label('GEN',0,-18);
    }else if(detail==='pipe'){
     for(const y of [-8,2,12]){fill(-24,y,48,5,'#9aa7b0');fill(-24,y,48,1,'#e5e6d4')}label('STEAM',0,-14);
    }else if(detail==='switches'){
     fill(-23,-11,46,25,'#455565');stroke(-23,-11,46,25,accent);
     for(let k=0;k<6;k++){fill(-18+k*7,-5,4,5,k%3?'#82cb9b':'#f3b970');fill(-17+k*7,4,2,6,'#d3d6cc')}
     label('CTRL',0,-15);
    }else if(detail==='arrows'){
     fill(-15,-2,21,5,'#d1a955');fill(4,-8,6,17,'#d1a955');
     fill(9,-11,12,11,'#f2c56f');fill(9,1,12,11,'#f2c56f');
    }else if(detail==='pallet'||detail==='crate'){
     fill(-22,-12,44,27,'#6f5541');stroke(-22,-12,44,27,accent);
     for(let k=-16;k<17;k+=11){fill(k,-7,7,15,k%2?'#b38d62':'#c9a77a')}
     fill(-22,12,44,4,'#4f4439');label(detail==='pallet'?'PALLET':'CARGO',0,-17);
    }else if(detail==='barcode'){
     fill(-23,-12,46,24,'#dfded0');for(let x=-18;x<18;x+=4)fill(x,-8,x%3?1:2,12,'#35464f');
     label('B-094',0,18,'#e4e5d5');
    }else if(detail==='loading'){
     fill(-28,-15,56,29,'rgba(211,159,66,.25)');stroke(-28,-15,56,29,'#e8b75c');
     for(let x=-25;x<28;x+=10){fill(x,-15,5,5,'#f4d076');fill(x,9,5,5,'#f4d076')}
     label('LOADING',0,2);
    }else if(detail==='forklift'){
     fill(-23,-3,31,16,'#c48c48');fill(5,-17,4,28,'#dcb15d');fill(9,5,16,3,'#dcb15d');
     for(const x of [-14,5]){fill(x,10,7,7,'#303b45')}label('LIFT',0,-9);
    }else if(detail==='gold'){
     for(let i=0;i<3;i++){fill(-22+i*7,-10+i*7,38,8,'#b68135');fill(-18+i*7,-9+i*7,29,4,'#f7da85');}
     label('VAULT',0,-16);
    }else if(detail==='laser'){
     for(let k=-18;k<=18;k+=12){fill(k,-12,2,31,'#e06e65');fill(k+2,-12,2,31,'rgba(251,142,105,.25)')}
     label('SECURE',0,-18,'#ffc2b2');
    }else if(detail==='scan'){
     fill(-22,-14,44,30,'#426879');stroke(-22,-14,44,30,accent);
     fill(-13,-8,26,18,'#1c3744');fill(-8,-4,16,11,'#69bccc');label('SCAN',0,-17);
    }else if(detail==='exit'){
     fill(-25,-12,50,22,'#2c785b');stroke(-25,-12,50,22,'#a9e7ca');label('EXIT →',0,3,'#e2fff1',11);
    }else if(detail==='barrier'){
     fill(-22,-8,44,20,'#59636b');for(let x=-18;x<17;x+=10)fill(x,-5,5,14,'#d9ad5e');
     stroke(-22,-8,44,20,'#aab9c3');
    }
    ctx.restore();
   }
   ctx.restore();
  }
  function draw(ctx,image,cam,scale=2){
   const w=ctx.canvas.width,h=ctx.canvas.height,t=map.tilewidth;
   ctx.imageSmoothingEnabled=false;
   ctx.fillStyle=map.backgroundcolor||'#10151a';ctx.fillRect(0,0,w,h);
   const minX=Math.max(0,Math.floor(cam.x/t)),minY=Math.max(0,Math.floor(cam.y/t));
   const maxX=Math.min(map.width-1,Math.ceil((cam.x+w/scale)/t));
   const maxY=Math.min(map.height-1,Math.ceil((cam.y+h/scale)/t));
   const cols=tileset.columns;
   for(const l of layers){if(l.visible===false)continue;
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
     const raw=l.data[y*map.width+x]>>>0,gid=raw&BASE_MASK;
     if(gid<1||gid>tileset.tilecount)continue;
     const sx=((gid-1)%cols)*t,sy=Math.floor((gid-1)/cols)*t;
     const dx=Math.floor((x*t-cam.x)*scale),dy=Math.floor((y*t-cam.y)*scale),dw=Math.ceil(t*scale);
     // Tiled flipping flags. Diagonal flips are handled in the canvas transform.
     const fx=Boolean(raw&FLIP_H),fy=Boolean(raw&FLIP_V),fd=Boolean(raw&FLIP_D);
     if(fx||fy||fd){
      ctx.save();ctx.translate(dx+dw/2,dy+dw/2);
      if(fd)ctx.rotate(Math.PI/2);
      ctx.scale(fx?-1:1,fy?-1:1);ctx.drawImage(image,sx,sy,t,t,-dw/2,-dw/2,dw,dw);ctx.restore();
     }else ctx.drawImage(image,sx,sy,t,t,dx,dy,dw,dw);
    }
    if(l.name==='Scars')themeFloor(ctx,cam,scale);
    if(l.name==='Scars')drawSiteIdentity(ctx,cam,scale);
    if(l.name==='SetDressing')themeDetails(ctx,cam,scale);
   }
  }
  // R5.67: Environmental lighting is anchored to the authored Tiled 'light'
  // layer. Do not place imaginary lamps or obscure tactical overlays.
  // Alarm pulses are visual-only: no collision, AI, loot or save changes.
  const ambientLights=objects(map,'light'),ambientSigns=objects(map,'sign');
  const lightingRadius=p=>Math.max(0,Math.min(320,Number(prop(p,'radius',80))||80));
  const tint=raw=>/^#[0-9a-fA-F]{6}$/.test(String(raw))?String(raw):'#b5bba9';
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',');
  const emergencyLamp=p=>/非常灯|警告灯|監視モニター|東通路/.test(String(p.name||''));
  function drawAmbience(ctx,cam,scale=2,overview=false,visual={}){
   const width=ctx.canvas.width,height=ctx.canvas.height;
   const alarm=!!visual?.alarm;
   const pulse=Number.isFinite(visual?.pulse)?Math.max(0,Math.min(1,visual.pulse)):.50;
   if(!overview){
    // Keep the floor legible on 360px phones; lighting happens *before*
    // loot, objective markers, guard sight cones, attacks and actors.
    ctx.fillStyle='rgba(6,11,16,.13)';
    ctx.fillRect(0,0,width,height);
    for(const light of ambientLights){
     const x=(light.x-cam.x)*scale,y=(light.y-cam.y)*scale;
     const r=lightingRadius(light)*scale;
     if(x+r<0||x-r>width||y+r<0||y-r>height)continue;
     const color=tint(prop(light,'color','#b5bba9'));
     if(typeof ctx.createRadialGradient==='function'){
      const gradient=ctx.createRadialGradient(x,y,0,x,y,r);
      const channel=rgb(color);
      gradient.addColorStop(0,'rgba('+channel+',.27)');
      gradient.addColorStop(.34,'rgba('+channel+',.11)');
      gradient.addColorStop(1,'rgba('+channel+',0)');
      ctx.save();ctx.globalCompositeOperation='screen';
      ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
     }
     // Small ceiling luminaire with a visible rim; same Tiled coordinates as
     // the light field, so the room has a physical-looking source.
     if(x>=-12&&y>=-12&&x<=width+12&&y<=height+12){
      const litColor=alarm&&emergencyLamp(light)?'#ff9b83':color;
      ctx.fillStyle='rgba(8,17,22,.78)';ctx.fillRect(Math.round(x-8),Math.round(y-5),16,10);
      ctx.fillStyle='#687c80';ctx.fillRect(Math.round(x-7),Math.round(y-4),14,8);
      ctx.fillStyle=litColor;ctx.fillRect(Math.round(x-5),Math.round(y-2),10,4);
     }
     if(alarm&&emergencyLamp(light)&&typeof ctx.createRadialGradient==='function'){
      // The controlled 2.8-second breathing lamp changes intensity, not
      // opacity of the entire screen. Player/guard graphics draw over it.
      const a=.12+.14*pulse,ar=Math.min(r,152*scale);
      const red=ctx.createRadialGradient(x,y,0,x,y,ar);
      red.addColorStop(0,'rgba(246,67,48,'+a.toFixed(3)+')');
      red.addColorStop(.5,'rgba(246,67,48,'+(a*.3).toFixed(3)+')');
      red.addColorStop(1,'rgba(246,67,48,0)');
      ctx.save();ctx.globalCompositeOperation='screen';
      ctx.fillStyle=red;ctx.fillRect(x-ar,y-ar,ar*2,ar*2);ctx.restore();
     }
    }
   }
   for(const sign of ambientSigns){
    const x=(sign.x-cam.x)*scale,y=(sign.y-cam.y)*scale;
    if(x<-160||y<-30||x>width+160||y>height+30)continue;
    const caption=String(prop(sign,'caption','')).slice(0,22);
    const color=String(prop(sign,'color','#c8d2c4'));
    const fontSize=Math.max(7,Math.round(scale*6));
    ctx.save();ctx.font='bold '+fontSize+'px monospace';
    const labelWidth=Math.min(180,ctx.measureText(caption).width+12);
    ctx.fillStyle='rgba(15,27,32,.86)';
    ctx.fillRect(x-labelWidth/2,y-fontSize-6,labelWidth,fontSize+9);
    ctx.fillStyle=tint(color);
    ctx.textAlign='center';ctx.fillText(caption,x,y-4);
    ctx.restore();
   }
  }
  return {map,tileset,layers,blocked,get,solidAt,lineClear,coverRects,drawAmbience,setRoomAtlas,objects:(type)=>objects(map,type),
   prop,draw,reachable,spawn,extract,worldWidth:map.width*map.tilewidth,
   worldHeight:map.height*map.tileheight};
 }
 return {createModel,layer,objects,prop,BASE_MASK};
});