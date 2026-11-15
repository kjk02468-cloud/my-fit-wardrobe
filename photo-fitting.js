/* An owned-item fitting panel using prepared photographic previews. */
(function(){
 'use strict';
 const categories={outer:'아우터',top:'상의',bottom:'하의',shoes:'신발'};
 const key=item=>JSON.stringify([item.id,item.lookView||'']);
 const plainSelection=item=>({id:item.id,view:item.lookView||''});
 const same=(left,right)=>Boolean(left&&right&&left.id===right.id&&left.view===right.view);
 const pairKey=(top,bottom)=>JSON.stringify([top.id,bottom.id]);

 function mount(root,{getItems,variants,identity,image,name,existingPhoto,escape,announce}){
  let tab='top',selection={},available=new Map(),loaded=false;
  let activeItems=new Map(),photoFailed='',shown='';
  const stage=root.querySelector('[data-fitting-stage]');
  const picker=root.querySelector('[data-fitting-picker]');
  const status=root.querySelector('[data-fitting-status]');

  function setPreviews(data){
   if(data?.schemaVersion!==1||!Array.isArray(data.looks))return;
   for(const row of data.looks){
    if(row?.top?.cat!=='top'||row?.bottom?.cat!=='bottom'||typeof row.top.id!=='string'||typeof row.bottom.id!=='string')continue;
    if(!/^\.\/assets\/fitting\/[a-z0-9-]+\.webp$/.test(row.image||''))continue;
    available.set(pairKey(row.top,row.bottom),row);
   }
   const starting=getItems();
   const byId=new Map(starting.map(item=>[item.id,item]));
   const first=[...available.values()].find(row=>matches(row.top,byId.get(row.top.id))&&matches(row.bottom,byId.get(row.bottom.id)));
   if(first&&!Object.keys(selection).length){
    selection={top:plainSelection(first.top),bottom:plainSelection(first.bottom)};
   }
  }

  function matches(ref,item){
   if(!item)return false;
   const actual=identity(item);
   return Object.keys(actual).every(field=>actual[field]===ref[field]);
  }

  function preview(pieces){
   const top=pieces.find(item=>item.cat==='top'),bottom=pieces.find(item=>item.cat==='bottom');
   const existing=pieces.length>2&&existingPhoto(pieces);
   if(existing)return {src:existing,label:'선택한 아이템이 모두 포함된 기존 AI 착장'};
   if(!(top&&bottom))return {label:'상의와 하의를 고르면 준비된 모델컷을 볼 수 있어요.'};
   const ref=available.get(pairKey(top,bottom));
   if(ref&&matches(ref.top,top)&&matches(ref.bottom,bottom)){
    const extras=pieces.filter(item=>item.cat!=='top'&&item.cat!=='bottom');
    return {src:ref.image,label:extras.length?'현재 사진에 적용된 옷은 상의와 하의예요. '+extras.map(item=>categories[item.cat]).join(', ')+'까지 들어간 컷은 아직 없어요.':'상의·하의 AI 모델컷'};
   }
   return {label:loaded?'이 조합의 모델컷은 아직 없어요. 선택한 제품을 아래에서 확인할 수 있어요.':'준비된 모델컷을 불러오는 중이에요.'};
  }

  function hasPairPhoto(item,pieces){
   const top=item.cat==='top'?item:pieces.find(i=>i.cat==='top');
   const bottom=item.cat==='bottom'?item:pieces.find(i=>i.cat==='bottom');
   const row=top&&bottom&&available.get(pairKey(top,bottom));
   return Boolean(row&&matches(row.top,top)&&matches(row.bottom,bottom));
  }

  function render(focusSelector){
   const items=getItems().filter(item=>Object.hasOwn(categories,item.cat));
   const pieces=[];
   for(const cat of Object.keys(categories)){
    const choice=selection[cat];
    const item=choice&&items.find(item=>item.cat===cat&&item.id===choice.id);
    const resolved=item&&variants(item).find(v=>same(choice,plainSelection(v)));
    if(resolved)pieces.push(resolved);
    else if(choice)delete selection[cat];
   }
   const photo=preview(pieces);
   const stageKey=JSON.stringify([photo.src,photoFailed===photo.src]);
   if(stageKey!==shown){
    stage.innerHTML=photo.src&&photo.src!==photoFailed
     ?'<img src="'+escape(photo.src)+'" alt="선택한 옷으로 만든 AI 모델컷" width="600" height="900">'
     :'<div class="fitting-empty"><p>AI 모델컷</p></div>';
    shown=stageKey;
   }
   status.textContent=photo.src&&photo.src===photoFailed?'모델컷을 불러오지 못했어요.':photo.label;
   const options=items.filter(item=>item.cat===tab).flatMap(variants);
   activeItems=new Map(options.map((item,index)=>[index,item]));
   picker.innerHTML='<div class="fitting-tabs" role="group" aria-label="옷 분류">'+Object.entries(categories).map(([cat,label])=>
    '<button type="button" data-fit-category="'+cat+'" aria-pressed="'+(tab===cat)+'">'+label+(selection[cat]?' <span aria-label="선택됨">✓</span>':'')+'</button>').join('')+'</div>'+
    '<div class="fitting-selection"><p>선택한 옷 '+pieces.length+'개</p>'+
    pieces.map(item=>'<button type="button" data-fit-clear="'+item.cat+'" aria-label="'+escape(name(item)+' 선택 해제')+'">'+escape(name(item))+' <span aria-hidden="true">×</span></button>').join('')+'</div>'+
    (options.length?'<div class="fitting-items">'+options.map((item,index)=>{
     const src=image(item);
     const ready=(tab==='top'||tab==='bottom')&&hasPairPhoto(item,pieces);
     return '<button type="button" data-fit-choice="'+index+'" aria-pressed="'+same(selection[tab],plainSelection(item))+'">'+
      (src?'<img src="'+escape(src)+'" alt="" loading="lazy" decoding="async">':'<span class="fitting-no-photo">사진 준비 중</span>')+
      '<span>'+escape(name(item))+'</span>'+(ready?'<small class="fitting-ready">모델컷 있음</small>':'')+'</button>';
    }).join('')+'</div>':'<p class="fitting-no-items">이 분류에 등록된 옷이 없어요.</p>');
   if(focusSelector)picker.querySelector(focusSelector)?.focus();
  }

  root.addEventListener('click',event=>{
   const button=event.target.closest('button');
   if(!button)return;
   const {fitCategory,fitChoice,fitClear}=button.dataset;
   if(Object.hasOwn(categories,fitCategory)){
    tab=fitCategory;
    render('[data-fit-category="'+tab+'"]');
   }else if(fitChoice!==undefined){
    const item=activeItems.get(Number(fitChoice));
    if(!item)return;
    const next=plainSelection(item);
    if(same(selection[tab],next))delete selection[tab];
    else selection[tab]=next;
    render('[data-fit-choice="'+fitChoice+'"]');
   }else if(Object.hasOwn(categories,fitClear)){
    delete selection[fitClear];
    tab=fitClear;
    render('[data-fit-category="'+tab+'"]');
    announce(categories[tab]+' 선택을 해제했어요.');
   }
  });
  stage.addEventListener('error',event=>{
   if(event.target.tagName!=='IMG')return;
   photoFailed=event.target.getAttribute('src');
   render();
  },true);
  fetch('./fitting-photos.json?v=20261115-long52').then(res=>res.ok?res.json():null).then(setPreviews).catch(()=>{}).finally(()=>{
   loaded=true;
   if(!root.hidden)render();
  });

  return {render};
 }

 window.MyFitPhotoFitting={mount};
})();
