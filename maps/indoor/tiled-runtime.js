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
  const get=(l,x,y)=>x<0||y<0||x>=map.width||y>=map.height?0:(l.data[y*map.width+x]>>>0)&BASE_MASK;
  function solidAt(x,y,r=0){
   const checks=r>0?[[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r],[x,y]]:[[x,y]];
   return checks.some(([px,py])=>{
    const tx=Math.floor(px/map.tilewidth),ty=Math.floor(py/map.tileheight);
    return tx<0||ty<0||tx>=map.width||ty>=map.height||
     !get(floor,tx,ty)||blocked.has(get(walls,tx,ty))||blocked.has(get(furniture,tx,ty));
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
   }
  }
  return {map,tileset,layers,blocked,get,solidAt,lineClear,objects:(type)=>objects(map,type),
   prop,draw,reachable,spawn,extract,worldWidth:map.width*map.tilewidth,
   worldHeight:map.height*map.tileheight};
 }
 return {createModel,layer,objects,prop,BASE_MASK};
});