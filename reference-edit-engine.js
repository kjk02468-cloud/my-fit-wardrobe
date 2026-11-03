/* A finite, source-backed outfit edit. Only metadata is stored for external reference photographs. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MyFitReferenceEdit=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const MAX_BYTES=96*1024;
 const sourceHosts=new Set(['www.tenasia.co.kr','www.gqkorea.co.kr','www.wkorea.com','www.teenvogue.com']);
 const imageHosts=new Set(['img.tenasia.co.kr','img.gqkorea.co.kr','img.wkorea.com','assets.teenvogue.com']);
 const profileHosts=new Set(['www.instagram.com','instagram.com']);
 const kinds={all:'전체',sns:'SNS 사복',airport:'공항',show:'패션위크'};
 function validUrl(value,hosts){try{if(typeof value!=='string'||value.length>1800)return '';const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&hosts.has(u.hostname)?u.href:''}catch{return ''}}
 function text(value,max){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Invalid reference text');return value;}
 function parseLibrary(raw){
  if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('Reference edit exceeds budget');
  const data=JSON.parse(raw),ids=new Set(),photos=new Set();
  if(data.schemaVersion!==1||data.figureView!=='neck-down'||!Array.isArray(data.looks)||data.looks.length>10)throw Error('Invalid reference edit');
  return data.looks.map(row=>{
   if(!/^ref-edit-\d{2}$/.test(row.id)||ids.has(row.id)||!/^\.\/assets\/reference-edit-\d{2}-v1\.webp$/.test(row.image)||!Array.isArray(row.pieces)||row.pieces.length<3||row.pieces.length>7)throw Error('Invalid edited look');
   ids.add(row.id);const pieceIds=new Set();
   for(const p of row.pieces){if(!p.id||pieceIds.has(p.id)||!['top','outer','bottom','shoes','bag','accessory','eyewear'].includes(p.cat)||!/^[a-f0-9]{8}$/.test(p.imageKey)||p.viewLabel&&!/^AI 보정 · (데님|바람막이) 면$/.test(p.viewLabel)||p.viewLabel&&!/^[a-f0-9]{8}$/.test(p.viewImageKey))throw Error('Invalid owned item');pieceIds.add(p.id)}
   if(!['top','bottom','shoes'].every(cat=>row.pieces.some(p=>p.cat===cat)))throw Error('Incomplete edited outfit');
   const r=row.reference,sourceUrl=validUrl(r?.sourceUrl,sourceHosts),imageUrl=validUrl(r?.imageUrl,imageHosts),profileUrl=r?.profileUrl?validUrl(r.profileUrl,profileHosts):'';
   if(!sourceUrl||!imageUrl||photos.has(imageUrl)||!['sns','airport','show'].includes(r?.kind)||!/^\d{4}-\d{2}-\d{2}$/.test(r.publishedAt)||r.profileUrl&&!profileUrl)throw Error('Invalid source provenance');photos.add(imageUrl);
   if(!Array.isArray(row.anchors)||row.anchors.length<2||row.anchors.length>5)throw Error('Missing styling analysis');
   return {...row,title:text(row.title,100),reason:text(row.reason,700),tip:text(row.tip,700),season:text(row.season,80),observation:text(row.observation,600),differences:text(row.differences,700),anchors:row.anchors.map(a=>text(a,200)),reference:{...r,person:text(r.person,100),publisher:text(r.publisher,80),credit:text(r.credit,250),framing:text(r.framing,80),sourceUrl,imageUrl,profileUrl}};
  });
 }
 function resolve(row,items,models,curated){const found=curated.resolve(row,items,models);return found&&!found.items.some(i=>i.photoStatus==='pending')?found:null;}
 const select=(library,kind='all')=>library.filter(r=>kind==='all'||r.reference.kind===kind);
 return {MAX_BYTES,kinds,parseLibrary,resolve,select,validUrl};
});
