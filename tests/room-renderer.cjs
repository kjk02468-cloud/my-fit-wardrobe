const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),R=require('../room-renderer.js');
function pixels(w,h,color){return Uint8ClampedArray.from(Array.from({length:w*h},()=>color).flat())}
function rect(data,w,x,y,cw,ch,color){for(let py=y;py<y+ch;py++)for(let px=x;px<x+cw;px++)data.set(color,(py*w+px)*4)}
const w=40,h=50,photo=pixels(w,h,[245,245,245,255]);
rect(photo,w,10,10,20,30,[30,25,20,255]);rect(photo,w,14,14,12,22,[245,245,245,255]);
const original=new Uint8ClampedArray(photo),out=R.matte(photo,w,h);
assert.equal(out.pixels[3],0);assert.equal(out.pixels[(20*w+20)*4+3],255,'enclosed light fabric stays opaque');assert.deepEqual(photo,original,'never mutate catalog image pixels');assert.deepEqual(out.bounds,[8,8,24,34]);
const alpha=pixels(w,h,[0,0,0,0]);rect(alpha,w,10,10,20,30,[0,0,0,255]);
const black=R.matte(alpha,w,h);assert.equal(black.pixels[(20*w+20)*4+3],255,'keep black product inside a transparent source');
const light=pixels(w,h,[245,244,240,255]);rect(light,w,10,10,20,30,[237,240,242,255]);
assert.equal(R.matte(light,w,h).pixels[(20*w+20)*4+3],255,'retry conservatively before erasing a light garment');
for(const aspect of [.35,.8,1.5,3])for(const hanging of [true,false])for(const pants of [true,false]){const box=[12,42],f=R.fit(aspect,box,hanging,pants);assert(f.width<=100&&f.height+f.top<=100.00001&&f.top>=0);assert(Math.abs((f.width*12*1672)/(f.height*42*941)-aspect)<1e-8,'preserve product proportions');if(!hanging)assert(Math.abs(f.top+f.height-100)<1e-8,'shelf items stand on the same baseline')}
console.log('PASS: alpha preservation, light-fabric safety, immutable originals, proportional hangers and shared shelf baseline.');
const assets=['wardrobe-hanging-v2.webp','wardrobe-hanger-coat-v1.webp','wardrobe-hanger-pants-v1.webp','wardrobe-white-shirt-cutout-v1.webp','wardrobe-matin-cutout-v1.webp'];
assert(assets.reduce((sum,file)=>sum+fs.statSync(path.join(__dirname,'../assets',file)).size,0)<200000,'scene, hangers and product cutouts stay under 200 KB combined');
