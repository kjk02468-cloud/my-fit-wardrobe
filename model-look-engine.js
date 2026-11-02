/* Prepared AI model photos. Selection never calls an image generation service. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MyFitModels=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const MAX_BYTES=32*1024,MAX_LOOKS=12,cats=['outer','top','bottom','shoes'];
 const fingerprints=new Map();
 function imageKey(source=''){
  if(fingerprints.has(source))return fingerprints.get(source);
  let hash=2166136261;for(let i=0;i<source.length;i++)hash=Math.imul(hash^source.charCodeAt(i),16777619);
  const key=(hash>>>0).toString(16).padStart(8,'0');if(fingerprints.size>=48)fingerprints.clear();fingerprints.set(source,key);return key;
 }
 function identity(item){return {id:item.id,name:item.name,brand:item.brand||'',cat:item.cat,color:item.color,imageKey:imageKey(item.image)}}
 function variants(item){
  if(item.cat!=='outer'||!item.name.includes('리버서블'))return [item];
  const photos=[item.image,...item.additionalImages||[]];
  const views=(item.photoLabels||[]).flatMap((label,index)=>/^AI 보정 · (데님|바람막이) 면$/.test(label)&&photos[index]?[{...item,lookView:label,lookSide:label.replace('AI 보정 · ',''),lookImage:photos[index],lookColor:label.includes('바람막이')?'black':item.color}]:[]);
  return views.length===2?views:[item];
 }
 function parseLibrary(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('Model library too large');
  const data=JSON.parse(text),ids=new Set();if(data.schemaVersion!==1||!Array.isArray(data.looks)||data.looks.length>MAX_LOOKS)throw Error('Invalid model library');
  return data.looks.map(row=>{
   if(!/^[a-z0-9-]{1,60}$/.test(row.id||'')||ids.has(row.id)||!/^\.\/assets\/model-look-[a-z0-9-]+\.webp$/.test(row.image||'')||!Array.isArray(row.pieces)||row.pieces.length!==4)throw Error('Invalid model look');
   ids.add(row.id);const pieceIds=new Set(),pieceCats=new Set();
   const pieces=row.pieces.map(p=>{if(typeof p.id!=='string'||!p.id||!cats.includes(p.cat)||pieceIds.has(p.id)||pieceCats.has(p.cat)||!/^[a-f0-9]{8}$/.test(p.imageKey||''))throw Error('Invalid model garment');pieceIds.add(p.id);pieceCats.add(p.cat);const piece={id:p.id,name:String(p.name||''),brand:String(p.brand||''),cat:p.cat,color:String(p.color||''),imageKey:p.imageKey};if(p.viewLabel){if(!/^AI 보정 · (데님|바람막이) 면$/.test(p.viewLabel)||!/^[a-f0-9]{8}$/.test(p.viewImageKey||''))throw Error('Invalid reversible view');piece.viewLabel=p.viewLabel;piece.viewImageKey=p.viewImageKey}return piece});
   return {id:row.id,image:row.image,title:String(row.title||'내 옷 모델컷').slice(0,70),note:String(row.note||'').slice(0,200),pieces,purposes:(row.purposes||[]).filter(p=>['casual','date','office','formal','travel'].includes(p))};
  });
 }
 function resolve(look,items){
  const owned=new Map(items.filter(i=>!i.isDemo).map(i=>[i.id,i])),found=[];
  for(const piece of look.pieces){const item=owned.get(piece.id);if(!item)return null;const actual=identity(item);if(Object.keys(actual).some(k=>piece[k]!==actual[k]))return null;let chosen=item;if(piece.viewLabel){chosen=variants(item).find(v=>v.lookView===piece.viewLabel);if(!chosen||imageKey(chosen.lookImage)!==piece.viewImageKey)return null}found.push(chosen)}
  return found;
 }
 function eligible(look,items,context){
  if(!look.purposes.includes(context.purpose))return false;
  if(context.temperature===null){if(!['spring','fall'].includes(context.season))return false}
  else if(context.temperature<9||context.temperature>22)return false;
  if([51,53,55,61,63,65,66,67,80,81,82,95,96,99].includes(context.code)&&items.some(i=>/스웨이드/.test(i.name)))return false;
  return true;
 }
 function candidates(library,items,context){return library.flatMap(model=>{const found=resolve(model,items);return found&&eligible(model,found,context)?[{model,items:found}]:[]})}
 function match(library,items){return library.find(model=>items.length===model.pieces.length&&model.pieces.every(p=>(p.viewLabel||'')===(items.find(i=>i.id===p.id)?.lookView||''))&&resolve(model,items))||null}
 return {MAX_BYTES,MAX_LOOKS,imageKey,identity,variants,parseLibrary,resolve,eligible,candidates,match};
});
