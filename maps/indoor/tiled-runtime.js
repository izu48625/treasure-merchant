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
  const get=(l,x,y)=>x<0||y<0||x>=map.width||y>=map.height?0:(l.data[y*map.width+x]>>>0)&BASE_MASK;
  function solidAt(x,y,r=0){
   const checks=r>0?[[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r],[x,y]]:[[x,y]];
   return checks.some(([px,py])=>{
    const tx=Math.floor(px/map.tilewidth),ty=Math.floor(py/map.tileheight);
    return tx<0||ty<0||tx>=map.width||ty>=map.height||
     !get(floor,tx,ty)||solidLayers.some(l=>blocked.has(get(l,tx,ty)));
   });
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
  function themeDetails(ctx,cam,scale){
   if(!themeProps.length||typeof ctx.strokeRect!=='function'||typeof ctx.fillText!=='function')return;
   ctx.save();ctx.imageSmoothingEnabled=false;
   const colors={archive:'#d2a879',pharmacy:'#a0e2ce',control:'#b8c9ce',
    security:'#82d7f1',corridor:'#f6c979',storage:'#d8b58b',
    receiving:'#f7c36e',vault:'#f5cb75',checkpoint:'#b7e9eb'};
   for(const o of themeProps){
    if(o.x<cam.x-50||o.y<cam.y-40||o.x>cam.x+ctx.canvas.width/scale+50||
       o.y>cam.y+ctx.canvas.height/scale+40)continue;
    const style=prop(o,'style',''),detail=prop(o,'detail','');
    const accent=colors[style]||'#bac4c8';
    ctx.save();ctx.translate(Math.round((o.x-cam.x)*scale),Math.round((o.y-cam.y)*scale));ctx.scale(scale,scale);
    const fill=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h)};
    const stroke=(x,y,w,h,c)=>{ctx.strokeStyle=c;ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1)};
    const label=(str,x,y,c=accent,sz=7)=>{ctx.fillStyle=c;ctx.font='bold '+sz+'px monospace';ctx.textAlign='center';ctx.fillText(str,x,y)};
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
    if(l.name==='SetDressing')themeDetails(ctx,cam,scale);
   }
  }
  // Architectural ambience: all light sources and labels live in a Tiled
  // object layer; nothing about their placement is hardcoded in the renderer.
  function drawAmbience(ctx,cam,scale=2,overview=false){
   const lights=objects(map,'light'),signs=objects(map,'sign');
   const width=ctx.canvas.width,height=ctx.canvas.height;
   const radius=p=>Math.max(0,Math.min(320,Number(prop(p,'radius',80))||80));
   if(!overview){
    ctx.fillStyle='rgba(6,11,16,.17)';
    ctx.fillRect(0,0,width,height);
    if(typeof ctx.createRadialGradient==='function'){
     for(const light of lights){
      const x=(light.x-cam.x)*scale,y=(light.y-cam.y)*scale,r=radius(light)*scale;
      if(x+r<0||x-r>width||y+r<0||y-r>height)continue;
      const raw=String(prop(light,'color','#b5bba9'));
      const color=/^#[0-9a-fA-F]{6}$/.test(raw)?raw:'#b5bba9';
      const red=parseInt(color.slice(1,3),16),
       green=parseInt(color.slice(3,5),16),blue=parseInt(color.slice(5,7),16);
      const gradient=ctx.createRadialGradient(x,y,0,x,y,r);
      gradient.addColorStop(0,'rgba('+red+','+green+','+blue+',.24)');
      gradient.addColorStop(.34,'rgba('+red+','+green+','+blue+',.095)');
      gradient.addColorStop(1,'rgba('+red+','+green+','+blue+',0)');
      ctx.save();ctx.globalCompositeOperation='screen';
      ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
     }
    }
   }
   for(const sign of signs){
    const x=(sign.x-cam.x)*scale,y=(sign.y-cam.y)*scale;
    if(x<-160||y<-30||x>width+160||y>height+30)continue;
    const caption=String(prop(sign,'caption','')).slice(0,22);
    const color=String(prop(sign,'color','#c8d2c4'));
    const fontSize=Math.max(7,Math.round(scale*6));
    ctx.save();ctx.font='bold '+fontSize+'px monospace';
    const labelWidth=Math.min(180,ctx.measureText(caption).width+12);
    ctx.fillStyle='rgba(15,27,32,.86)';
    ctx.fillRect(x-labelWidth/2,y-fontSize-6,labelWidth,fontSize+9);
    ctx.fillStyle=/^#[0-9a-fA-F]{6}$/.test(color)?color:'#c8d2c4';
    ctx.textAlign='center';ctx.fillText(caption,x,y-4);
    ctx.restore();
   }
  }
  return {map,tileset,layers,blocked,get,solidAt,lineClear,drawAmbience,objects:(type)=>objects(map,type),
   prop,draw,reachable,spawn,extract,worldWidth:map.width*map.tilewidth,
   worldHeight:map.height*map.tileheight};
 }
 return {createModel,layer,objects,prop,BASE_MASK};
});