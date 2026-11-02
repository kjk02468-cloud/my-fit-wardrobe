/* Small, deterministic retrieval index. No model calls, crawling, image storage or tracking. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MyFitReferences=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const MAX_BYTES=96*1024,MAX_LOOKS=80;
 const sourceHosts=new Set(['www.gq.com','www.mrporter.com','prd.harrods.com','www.uniqlo.com','www.cos.com','hypebeast.com']);
 const imageHosts=new Set(['media.gq.com','cache.mrporter.com','www.mrporter.com','d1l7zeynh7e3dn.cloudfront.net','www.uniqlo.com','media.cos.com','image-cdn.hypb.st']);
 const catNames={outer:'아우터',top:'상의',bottom:'하의',shoes:'신발'};
 const colorNames={black:'블랙',charcoal:'차콜',navy:'네이비',brown:'브라운',beige:'베이지',cream:'크림',white:'화이트',green:'그린',blue:'블루',purple:'퍼플',pink:'핑크',orange:'오렌지',red:'레드',other:'기타'};
 const typeNames={coat:'긴 코트',blazer:'블레이저',bomber:'봄버',leather:'레더 재킷',suede:'스웨이드 재킷',denimjacket:'데님 재킷',shell:'가벼운 재킷',jacket:'재킷',shirt:'셔츠',hoodie:'후드',knit:'니트',tee:'티셔츠',pants:'팬츠',tailored:'테일러드 팬츠',technical:'테크 팬츠',jeans:'데님',loafer:'로퍼',derby:'더비',sneaker:'스니커즈',boot:'부츠'};
 const families={coat:'long',blazer:'tailoring',bomber:'jacket',leather:'jacket',suede:'jacket',denimjacket:'jacket',shell:'jacket',jacket:'jacket',shirt:'shirt',hoodie:'softtop',knit:'softtop',tee:'softtop',pants:'pants',tailored:'pants',technical:'pants',jeans:'pants',loafer:'leathershoe',derby:'leathershoe',boot:'boot',sneaker:'sneaker'};
 function validUrl(value,hosts){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&hosts.has(u.hostname)&&value.length<1800?u.href:''}catch{return ''}}
 function parseLibrary(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw new Error('Reference index exceeds budget');
  const data=JSON.parse(text);if(data.schemaVersion!==1||!Array.isArray(data.looks)||data.looks.length>MAX_LOOKS)throw new Error('Invalid reference index');
  const ids=new Set(),images=new Set();
  return data.looks.map(row=>{
   const source=validUrl(row.source,sourceHosts),imageUrl=validUrl(row.imageUrl,imageHosts);
   if(!source||!imageUrl||!/^[a-z0-9-]{1,70}$/i.test(row.id||'')||ids.has(row.id)||images.has(imageUrl)||!Array.isArray(row.pieces)||row.pieces.length<2||row.pieces.length>4)throw new Error('Invalid reference record');
   ids.add(row.id);images.add(imageUrl);
   const cats=new Set();const pieces=row.pieces.map(p=>{if(!catNames[p.cat]||!typeNames[p.type]||!colorNames[p.color]||cats.has(p.cat))throw new Error('Invalid reference piece');cats.add(p.cat);return {cat:p.cat,type:p.type,color:p.color,fit:['wide','regular','relaxed'].includes(p.fit)?p.fit:''}});
   return {id:row.id,name:String(row.name||'착장 참고').slice(0,85),publisher:String(row.publisher||'').slice(0,55),collection:String(row.collection||'').slice(0,85),credit:String(row.credit||row.publisher||'').slice(0,110),framing:row.framing==='partial'?'부분 착장':row.framing==='flatlay'?'에디터 조합 제안':'착장 사진',source,imageUrl,pieces};
  });
 }
 function profile(item){
  const name=String(item.name||''),cat=item.cat;let type='';
  if(cat==='outer')type=/블레이저|더블 재킷/.test(name)?'blazer':/코트|트렌치|발마칸/.test(name)?'coat':/MA-?1|봄버/i.test(name)?'bomber':/스웨이드/.test(name)?'suede':/가죽|레더/.test(name)?'leather':/데님/.test(name)?'denimjacket':/코치|테이프 심|바람막이/.test(name)?'shell':'jacket';
  if(cat==='top')type=/후드/.test(name)?'hoodie':/니트|스웨터/.test(name)?'knit':/셔츠/.test(name)&&!/티셔츠/.test(name)?'shirt':'tee';
  if(cat==='bottom')type=/데님|청바지|흑청/.test(name)?'jeans':/트위스트|테이핑|나일론|조거/.test(name)?'technical':/셋업|슬랙스/.test(name)?'tailored':'pants';
  if(cat==='shoes')type=/로퍼/.test(name)?'loafer':/1461|더비/.test(name)?'derby':/부츠/.test(name)?'boot':'sneaker';
  return {cat,type,color:item.color,fit:/와이드|벌룬/.test(name)?'wide':/오버사이즈|릴렉스드/.test(name)?'relaxed':'',name};
 }
 function colorSimilarity(a,b){if(a===b)return 1;if([a,b].every(c=>['black','charcoal','navy'].includes(c)))return .78;if([a,b].every(c=>['beige','cream','white'].includes(c)))return .75;if([a,b].every(c=>['brown','beige','green'].includes(c)))return .45;return 0}
 function typeSimilarity(a,b){if(a===b)return 1;if(families[a]===families[b])return a==='pants'||b==='pants'?.75:.65;return 0}
 function compare(items,reference){
  const targets=items.filter(i=>!i.isDemo&&catNames[i.cat]).map(profile);let points=0,total=0;const matched=[],differences=[];
  for(const own of targets){const weight=own.cat==='outer'||own.cat==='bottom'?3:2;total+=weight;const other=reference.pieces.find(p=>p.cat===own.cat);if(!other){differences.push(`${catNames[own.cat]}는 사진에서 확인할 수 없어요.`);continue}
   const t=typeSimilarity(own.type,other.type),c=colorSimilarity(own.color,other.color),knownFit=own.fit&&other.fit;
   points+=weight*(t*.55+c*.35+(knownFit?(own.fit===other.fit?1:.35):(t+c)/2)*.1);
   if(t>=.65&&c>=.75)matched.push({cat:own.cat,label:`${catNames[own.cat]} · ${colorNames[own.color]||'기타'} ${typeNames[own.type]}`});
   if(own.type!==other.type||c<1)differences.push(`${catNames[own.cat]}: 사진은 ${colorNames[other.color]} ${typeNames[other.type]}, 내 옷은 ${colorNames[own.color]||'기타'} ${typeNames[own.type]}입니다.`);
   else if(knownFit&&own.fit!==other.fit)differences.push(`${catNames[own.cat]}의 등록된 실루엣과 사진 속 통이 달라요.`);
  }
  const score=total?Math.round(points/total*100):0;
  return {reference,score,matched,differences,total:targets.length,eligible:matched.length>=2&&score>=50};
 }
 const rank=(items,library)=>library.map(r=>compare(items,r)).filter(r=>r.eligible).sort((a,b)=>b.score-a.score||b.matched.length-a.matched.length||a.reference.id.localeCompare(b.reference.id));
 const bonus=matches=>matches.length?Math.min(6,Math.round(matches[0].score/100*6)):0;
 function distribute(groups){const used=new Set(),publishers=new Map();return groups.map(matches=>{
  const available=matches.filter(m=>!used.has(m.reference.imageUrl));if(!available.length)return [];
  available.sort((a,b)=>(b.score-(publishers.get(b.reference.publisher)||0)*8)-(a.score-(publishers.get(a.reference.publisher)||0)*8));
  const first=available[0];used.add(first.reference.imageUrl);publishers.set(first.reference.publisher,(publishers.get(first.reference.publisher)||0)+1);
  return [first,...matches.filter(m=>m.reference.id!==first.reference.id)].slice(0,3);
 })}
 return {MAX_BYTES,MAX_LOOKS,parseLibrary,profile,compare,rank,bonus,distribute,validUrl};
});
