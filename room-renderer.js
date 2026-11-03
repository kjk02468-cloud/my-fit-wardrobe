/* Display-only product compositing. Source/catalog photos are never changed or saved. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MyFitRoomRenderer=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const cache=new Map(),MAX_CACHE=24;
 const isLocal=src=>/^\.\/assets\/[a-z0-9-]+\.webp$/i.test(src)||/^data:image\/(webp|jpeg|png);base64,/i.test(src);
 function matte(pixels,width,height,threshold=18){
  const count=width*height,rgba=new Uint8ClampedArray(pixels),seen=new Uint8Array(count),queue=new Int32Array(count),samples=[];
  const inset=Math.max(1,Math.floor(Math.min(width,height)*.025));
  for(const [x,y] of [[inset,inset],[width-1-inset,inset],[inset,height-1-inset],[width-1-inset,height-1-inset]]){const n=(y*width+x)*4;samples.push([rgba[n],rgba[n+1],rgba[n+2]])}
  const background=[0,1,2].map(c=>samples.map(s=>s[c]).sort((a,b)=>a-b)[1]);
  const distance=i=>Math.max(...[0,1,2].map(c=>Math.abs(rgba[i*4+c]-background[c])));
  const hasAlpha=[0,width-1,(height-1)*width,count-1].every(i=>pixels[i*4+3]<12);
  // Preserve authored alpha. For opaque studio photos, flood only edge-connected background.
  let head=0,tail=0;const visit=i=>{if(i<0||i>=count||seen[i])return;seen[i]=1;if(rgba[i*4+3]<12||(!hasAlpha&&distance(i)<=threshold)){queue[tail++]=i}};
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x)}for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1)}
  while(head<tail){const i=queue[head++],x=i%width;rgba[i*4+3]=0;if(x)visit(i-1);if(x<width-1)visit(i+1);visit(i-width);visit(i+width)}
  let x0=width,y0=height,x1=-1,y1=-1,area=0;
  for(let i=0;i<count;i++){if(!rgba[i*4+3])continue;const x=i%width,y=Math.floor(i/width);if(rgba[i*4+3]>40){area++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}}
  // If a photo isn't a plain studio image, retain it rather than erase the product.
  if(!hasAlpha&&area<count*.15&&threshold>3)return matte(pixels,width,height,3);
  if(area<count*.025||x1<x0)return {pixels:new Uint8ClampedArray(pixels),bounds:[0,0,width,height],fallback:true};
  return {pixels:rgba,bounds:[Math.max(0,x0-2),Math.max(0,y0-2),Math.min(width,x1+3)-Math.max(0,x0-2),Math.min(height,y1+3)-Math.max(0,y0-2)],fallback:tail<count*.08};
 }
 function prepare(source){
  if(!isLocal(source))return Promise.reject(Error('Local product photo required'));
  if(cache.has(source))return cache.get(source);
  const result=new Promise((resolve,reject)=>{const input=new Image();input.onload=()=>{try{const scale=Math.min(1,640/Math.max(input.naturalWidth,input.naturalHeight)),w=Math.max(1,Math.round(input.naturalWidth*scale)),h=Math.max(1,Math.round(input.naturalHeight*scale)),stage=document.createElement('canvas');stage.width=w;stage.height=h;const ctx=stage.getContext('2d',{willReadFrequently:true});ctx.drawImage(input,0,0,w,h);const image=ctx.getImageData(0,0,w,h),out=matte(image.data,w,h);image.data.set(out.pixels);ctx.putImageData(image,0,0);const [x,y,cw,ch]=out.bounds,crop=document.createElement('canvas');crop.width=cw;crop.height=ch;crop.getContext('2d').drawImage(stage,x,y,cw,ch,0,0,cw,ch);resolve({src:crop.toDataURL('image/webp',.88),aspect:cw/ch,fallback:out.fallback})}catch(error){reject(error)}};input.onerror=()=>reject(Error('Product photo unavailable'));input.src=source});
  cache.set(source,result);if(cache.size>MAX_CACHE)cache.delete(cache.keys().next().value);result.catch(()=>cache.delete(source));return result;
 }
 function fit(aspect,box,hanging,pants=false){
  const [w,h]=box,ratio=w*1672/(h*941),hook=hanging?.065:0;
  let imageWidth=Math.min(1,(1-hook)*aspect/ratio),imageHeight=imageWidth*ratio/aspect;
  const hangerWidth=hanging?imageWidth*(pants?.9:.72):0,hangerHeight=hangerWidth*ratio*.65,offset=hanging?hangerHeight*(pants?.79:.42):0;
  if(imageHeight+offset>1){const factor=1/(imageHeight+offset);imageWidth*=factor;imageHeight*=factor;return {width:imageWidth*100,height:imageHeight*100,top:offset*factor*100,hangerWidth:hangerWidth*factor*100,hangerHeight:hangerHeight*factor*100}}
  return {width:imageWidth*100,height:imageHeight*100,top:hanging?offset*100:(1-imageHeight)*100,hangerWidth:hangerWidth*100,hangerHeight:hangerHeight*100};
 }
 function render(button,source,{width,height,hanging=false,pants=false}){
  const photo=button.querySelector('.room-item-cutout');if(!photo)return;
  const cutouts={'./assets/november-white-shirt-ai-v1.webp':'./assets/wardrobe-white-shirt-cutout-v1.webp','./assets/november-batch2-matin-ai-v1.webp':'./assets/wardrobe-matin-cutout-v1.webp'},displaySource=cutouts[source]||source;
  prepare(displaySource).then(result=>{if(!button.isConnected)return;const layout=fit(result.aspect,[width,height],hanging,pants);photo.src=result.src;photo.style.width=layout.width+'%';photo.style.height=layout.height+'%';photo.style.top=layout.top+'%';button.style.setProperty('--hanger-width',layout.hangerWidth+'%');button.style.setProperty('--hanger-height',layout.hangerHeight+'%');button.classList.add('room-composed');button.classList.toggle('room-pants',pants);button.classList.toggle('room-photo-fallback',result.fallback);button.dataset.roomReady='true'}).catch(()=>{if(!button.isConnected)return;photo.src=source;button.classList.add('room-photo-fallback','room-composed');button.dataset.roomReady='fallback'});
 }
 return {matte,fit,render};
});
