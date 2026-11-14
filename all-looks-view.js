/* Browse all owned combinations and save a shortlist in this browser. */
(function(){
 'use strict';
 const PAGE_SIZE=12;
 const STORAGE_KEY='myfit-selected-outfits-v1';
 const typeLabels={base:'아우터 없이',short:'숏 아우터',long:'롱 아우터',layered:'롱 + 숏 아우터'};
 const slotLabels={short:'숏 아우터',long:'롱 아우터',top:'상의',bottom:'하의',shoes:'신발',accessory:'액세서리',bag:'가방'};
 const format=new Intl.NumberFormat('ko-KR');
 const choiceKey=item=>JSON.stringify([item.id,item.lookView||'']);
 const lookKey=(type,pieces)=>JSON.stringify([type,...pieces.map(choiceKey)]);

 function mount(root,{getItems,outerLength,variants,image,name,photoIndex,escape,notify}){
  const engine=window.MyFitAllLooks;
  const {types}=engine;
  const number=n=>format.format(n);
  const filters=new Map();
  let type='base',page=1,showSaved=false,visible=new Map();
  let selected=new Set();
  try{
   const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
   if(Array.isArray(saved))selected=new Set(saved.filter(key=>typeof key==='string'));
  }catch{}

  function findSaved(pools){
   const bySlot=Object.fromEntries(Object.entries(pools).map(([slot,list])=>[slot,new Map(list.map(item=>[choiceKey(item),item]))]));
   const resolved=[];
   for(const key of selected){
    try{
     const [kind,...choices]=JSON.parse(key);
     const slots=Object.hasOwn(types,kind)?types[kind]:null;
     if(!slots||slots.length!==choices.length)continue;
     const pieces=slots.map((slot,i)=>bySlot[slot].get(choices[i]));
     if(pieces.every(Boolean))resolved.push({key,kind,pieces});
    }catch{}
   }
   return resolved;
  }

  function pieceTile(slot,item){
   const src=image(item);
   return '<button type="button" class="all-looks-piece" data-view-item="'+escape(item.id)+'" data-view-photo="'+photoIndex(item)+'" aria-label="'+escape(slotLabels[slot]+' · '+name(item)+' 상세 보기')+'">'+
    (src?'<img src="'+escape(src)+'" alt="" loading="lazy" decoding="async">':'<span class="all-looks-placeholder" aria-hidden="true">사진 준비 중</span>')+
    '<small>'+slotLabels[slot]+'</small><span>'+escape(name(item))+'</span></button>';
  }

  function card(row,index){
   const {key,kind,pieces}=row;
   const chosen=selected.has(key);
   visible.set(index,key);
   return '<article class="all-looks-card"><header class="all-looks-card-head"><strong>'+
    (showSaved?typeLabels[kind]:'조합 '+number(index+1))+'</strong><span>'+pieces.length+'개 아이템</span></header>'+
    '<div class="all-looks-pieces">'+pieces.map((item,i)=>pieceTile(types[kind][i],item)).join('')+'</div>'+
    '<div class="all-looks-actions"><button type="button" data-combo-pick="'+index+'" aria-pressed="'+chosen+'">'+(chosen?'선택 해제':'이 조합 선택')+'</button></div></article>';
  }

  function pagination(pageCount){
   return '<div class="all-looks-page">'+
    '<button type="button" data-combo-page="-1" '+(page<=1?'disabled':'')+'>이전</button>'+
    '<form data-combo-jump><label>페이지 <input name="page" type="number" min="1" max="'+pageCount+'" value="'+page+'" inputmode="numeric" required> / '+number(pageCount)+'</label><button type="submit">이동</button></form>'+
    '<button type="button" data-combo-page="1" '+(page>=pageCount?'disabled':'')+'>다음</button></div>';
  }

  function render(focusSelector){
   const pools=engine.buildPools(getItems(),outerLength,variants);
   const saved=findSaved(pools);
   const slots=types[type];
   const subset={...pools};
   for(const slot of slots){
    const value=filters.get(slot);
    if(!value)continue;
    const match=pools[slot].find(item=>choiceKey(item)===value);
    if(match)subset[slot]=[match];
    else filters.delete(slot);
   }
   const total=showSaved?saved.length:engine.total(subset,slots);
   const pageCount=Math.max(1,Math.ceil(total/PAGE_SIZE));
   page=Math.min(page,pageCount);
   const start=(page-1)*PAGE_SIZE,end=Math.min(start+PAGE_SIZE,total);
   visible=new Map();
   const cards=[];
   for(let i=start;i<end;i++){
    if(showSaved)cards.push(card(saved[i],i));
    else{
     const pieces=engine.at(subset,slots,i);
     cards.push(card({key:lookKey(type,pieces),kind:type,pieces},i));
    }
   }
   const summary=total?number(total)+'개 중 '+number(start+1)+'–'+number(end)+'개':'0개';
   const missing=slots.filter(slot=>!pools[slot].length).map(slot=>slotLabels[slot]);
   const empty=showSaved?'선택한 조합이 여기에 모여요.':missing.length?'옷장에 '+missing.join(' · ')+'을 등록하면 이 구성을 볼 수 있어요.':'조건에 맞는 조합이 없어요.';
   const totalAll=Object.values(types).reduce((sum,required)=>sum+engine.total(pools,required),0);
   root.innerHTML='<header class="all-looks-header"><div class="all-looks-intro"><h3>보유품으로 가능한 '+number(totalAll)+'개 조합</h3>'+
    '<p>카테고리마다 한 아이템씩 조합했어요. 상품 사진으로 비교하고, 고른 조합은 이 기기에 저장돼요.</p></div>'+
    '<div class="all-looks-saved"><button type="button" data-combo-saved aria-pressed="'+showSaved+'">내가 고른 코디 '+number(saved.length)+'</button>'+
    (showSaved&&saved.length?'<button type="button" data-combo-copy>AI 착장 요청 복사</button>':'')+'</div></header>'+
    '<div class="all-looks-tabs" role="group" aria-label="조합 구성">'+Object.entries(types).map(([kind,required])=>
     '<button type="button" data-combo-type="'+kind+'" aria-pressed="'+(!showSaved&&type===kind)+'">'+typeLabels[kind]+'<small>'+number(engine.total(pools,required))+'개</small></button>').join('')+'</div>'+
    (showSaved?'':'<div class="all-looks-filters" role="group" aria-label="아이템 고정">'+slots.map(slot=>
     '<label>'+slotLabels[slot]+'<select data-combo-filter="'+slot+'"><option value="">전체</option>'+pools[slot].map(item=>{
      const key=choiceKey(item);
      return '<option value="'+escape(key)+'" '+(filters.get(slot)===key?'selected':'')+'>'+escape(name(item))+'</option>';
     }).join('')+'</select></label>').join('')+'</div>')+
    '<div class="all-looks-controls"><p class="all-looks-summary" role="status" tabindex="-1">'+summary+'</p>'+
    (!showSaved&&slots.some(slot=>filters.has(slot))?'<div class="all-looks-actions"><button type="button" data-combo-reset>아이템 고정 해제</button></div>':'')+
    (pageCount>1?pagination(pageCount):'')+'</div>'+
    (cards.length?'<div class="all-looks-grid">'+cards.join('')+'</div>':'<p class="all-looks-empty">'+escape(empty)+'</p>')+
    (pageCount>1?'<div class="all-looks-controls">'+pagination(pageCount)+'</div>':'');
   if(focusSelector)root.querySelector(focusSelector)?.focus();
   return {total,saved};
  }

  root.addEventListener('click',event=>{
   const button=event.target.closest('button');
   if(!button)return;
   if(button.hasAttribute('data-combo-type')){
    type=button.dataset.comboType;
    page=1;
    showSaved=false;
    render('[data-combo-type="'+type+'"]');
   }else if(button.hasAttribute('data-combo-saved')){
    showSaved=!showSaved;
    page=1;
    render('[data-combo-saved]');
   }else if(button.hasAttribute('data-combo-reset')){
    filters.clear();
    page=1;
    render('[data-combo-filter]');
   }else if(button.hasAttribute('data-combo-page')){
    page=Math.max(1,page+Number(button.dataset.comboPage));
    render('.all-looks-summary');
   }else if(button.hasAttribute('data-combo-pick')){
    const index=button.dataset.comboPick;
    const key=visible.get(Number(index));
    if(!key)return;
    const next=new Set(selected);
    if(next.has(key))next.delete(key);
    else next.add(key);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify([...next]));}
    catch{notify('이 브라우저에 선택을 저장할 수 없어요.');return;}
    selected=next;
    render(showSaved?'[data-combo-saved]':'[data-combo-pick="'+index+'"]');
   }else if(button.hasAttribute('data-combo-copy')){
    const {saved}=render();
    const text=['MY FIT · 아래 보유품 조합으로 얼굴이 나오지 않는 AI 착장 사진을 제작해주세요.',
     ...saved.map(({kind,pieces},i)=>'\n'+(i+1)+'. '+typeLabels[kind]+'\n'+pieces.map((item,index)=>'• '+slotLabels[types[kind][index]]+' · '+name(item)+' ['+item.id+']').join('\n'))
    ].join('\n');
    const field=document.createElement('textarea');
    field.className='all-looks-copy-text';
    field.setAttribute('aria-label','AI 착장 제작 요청');
    field.readOnly=true;
    field.value=text;
    root.append(field);
    field.focus();
    field.select();
    if(navigator.clipboard)navigator.clipboard.writeText(text).then(
     ()=>notify('제작 요청을 복사했어요. 이 채팅에 붙여넣어 주세요.'),
     ()=>notify('선택된 요청 문구를 복사해 주세요.')
    );
    else notify('선택된 요청 문구를 복사해 주세요.');
   }
  });
  root.addEventListener('change',event=>{
   const slot=event.target.dataset.comboFilter;
   if(!slot)return;
   if(event.target.value)filters.set(slot,event.target.value);
   else filters.delete(slot);
   page=1;
   render('[data-combo-filter="'+slot+'"]');
  });
  root.addEventListener('submit',event=>{
   if(!event.target.hasAttribute('data-combo-jump'))return;
   event.preventDefault();
   const value=Number(event.target.elements.page.value);
   if(!Number.isSafeInteger(value)||value<1)return;
   page=value;
   render('.all-looks-summary');
  });
  return {render};
 }
 window.MyFitAllLooksView={mount};
})();
