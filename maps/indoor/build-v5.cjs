'use strict';
// Run: node maps/indoor/build-v5.cjs, then commit indoor-compiled-v5.js.
// The Tiled .tmj and .tsj files remain the edit-authoritative source.
const fs=require('node:fs');const path=require('node:path');
const dir=__dirname;
const original=JSON.parse(fs.readFileSync(path.join(dir,'indoor.tmj'),'utf8'));
const tileset=JSON.parse(fs.readFileSync(path.join(dir,'tiles','warehouse.tsj'),'utf8'));
const map={type:'map',orientation:original.orientation,width:original.width,height:original.height,tilewidth:original.tilewidth,tileheight:original.tileheight,infinite:false,backgroundcolor:original.backgroundcolor,tilesets:[{firstgid:1,source:'tiles/warehouse.tsj'}],layers:original.layers.map(l=>l.type==='tilelayer'?{type:l.type,name:l.name,width:l.width,height:l.height,visible:l.visible,data:l.data}:{type:l.type,name:l.name,objects:l.objects.map(o=>({id:o.id,name:o.name,type:o.type,point:o.point,x:o.x,y:o.y,visible:o.visible,properties:o.properties}))})};
const ts={tilewidth:tileset.tilewidth,tileheight:tileset.tileheight,columns:tileset.columns,tilecount:tileset.tilecount,tiles:tileset.tiles};
const compiled=`/* AUTO-GENERATED from indoor.tmj and tiles/warehouse.tsj. Do not hand-edit. */\n(function(root){root.TreasureIndoorCompiledV5={map:${JSON.stringify(map)},tileset:${JSON.stringify(ts)}};\n})(typeof globalThis!=='undefined'?globalThis:this);\n`;
fs.writeFileSync(path.join(dir,'indoor-compiled-v5.js'),compiled,'utf8');
