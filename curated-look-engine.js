/* A small, prepared edit of owned outfits. No runtime AI or image download. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MyFitCurated=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const MAX_BYTES=240*1024,groups=['office','date','daily','street'],seasons=['spring-fall','summer','winter'];
 function parseLibrary(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Curated library too large');
  const data=JSON.parse(text),ids=new Set();if(data.schemaVersion!==1||!Array.isArray(data.looks)||data.looks.length>90)throw Error('Invalid curated library');
  return data.looks.map(row=>{
   if(!/^edit-\d{2}$/.test(row.id)||ids.has(row.id)||!groups.includes(row.group)||!seasons.includes(row.seasonKey)||!Array.isArray(row.pieces)||row.pieces.length<3||row.pieces.length>6||new Set(row.pieces.map(p=>p.id)).size!==row.pieces.length)throw Error('Invalid curated look');
   ids.add(row.id);if(row.image&&!/^\.\/assets\/curated-look-\d{2}-v1\.webp$/.test(row.image))throw Error('Invalid curated image');
   for(const p of row.pieces)if(typeof p.id!=='string'||!p.id||!/^[a-f0-9]{8}$/.test(p.imageKey)||!['outer','top','bottom','shoes','accessory'].includes(p.cat)||p.viewLabel&&!/^AI 보정 · (데님|바람막이) 면$/.test(p.viewLabel))throw Error('Invalid piece');
   if(!['top','bottom','shoes'].every(cat=>row.pieces.some(p=>p.cat===cat)))throw Error('Incomplete outfit');
   if(!Array.isArray(row.addons)||row.addons.length>4||row.addons.some(id=>typeof id!=='string')||typeof row.fragrance!=='string')throw Error('Invalid extras');
   return {...row,title:String(row.title).slice(0,90),reason:String(row.reason).slice(0,600),tip:String(row.tip).slice(0,600),season:String(row.season).slice(0,40)};
  });
 }
 function resolve(row,items,models){
  const owned=new Map(items.filter(i=>!i.isDemo).map(i=>[i.id,i]));let same=true;const chosen=[];
  for(const p of row.pieces){const item=owned.get(p.id);if(!item)return null;const actual=models.identity(item);if(Object.keys(actual).some(k=>actual[k]!==p[k]))same=false;const view=p.viewLabel?models.variants(item).find(v=>v.lookView===p.viewLabel):item;if(!view)return null;if(p.viewLabel&&models.imageKey(view.lookImage)!==p.viewImageKey)same=false;chosen.push(view)}
  const addons=row.addons.map(id=>owned.get(id)).filter(i=>i&&['bag','eyewear','accessory'].includes(i.cat));const fragrance=owned.get(row.fragrance);
  return {...row,items:chosen,addons,fragrance:fragrance?.cat==='fragrance'?fragrance:null,image:same?row.image:'',photoMatches:same};
 }
 function select(library,season,group='all'){return library.filter(row=>(season==='all'||row.seasonKey===season)&&(group==='all'||row.group===group))}
 return {MAX_BYTES,seasons,parseLibrary,resolve,select};
});
