(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MyFitRoom=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const KEY='myfit-room-selection-v1',COUNT=13;
 const defaults=['item-20261025-04-trench','item-20261029-14-beigejacket','item-20261025-06-ma1','item-20261102-balenciaga-reversible','item-20261102-white-shirt','item-20261103-vest','item-20261102-gray-slacks','item-20261102-photo-denim','item-20261103-matin','item-20261103-wood-salt','item-20261025-09-drmartens','item-20261103-nike','item-20261103-le-labo'];
 const positions=[[9,17.2,14,53],[18.5,17.2,14,53],[28,17.2,14,53],[36.5,17.2,13,53],[50.3,10.2,12.5,31.5],[63,10.2,12.5,31.5],[51.5,45.2,11,42],[64,45.2,11,42],[81,10,13,21],[81,40,6.5,10.5],[80,55,15,13],[80,72,15,14],[88,40,6.5,10.5]];
 const slotName=n=>n===9?'10번 · 향수 선반 왼쪽':n===12?'13번 · 향수 선반 오른쪽':(n+1)+'번 자리';
 const categories={all:'전체',outer:'아우터',top:'상의',bottom:'하의',shoes:'신발',bag:'가방',eyewear:'아이웨어',accessory:'액세서리',fragrance:'향수'};
 const cleanEntry=entry=>entry&&typeof entry.id==='string'&&entry.id.length>0&&entry.id.length<=90?{id:entry.id,view:/^AI 보정 · (데님|바람막이) 면$/.test(entry.view||'')?entry.view:''}:null;
 const defaultSlots=()=>defaults.map(id=>({id,view:''}));
 function normalize(slots,items){const own=new Set(items.filter(i=>!i.isDemo).map(i=>i.id)),seen=new Set();return Array.from({length:COUNT},(_,n)=>{const e=cleanEntry(slots?.[n]);if(!e||!own.has(e.id)||seen.has(e.id))return null;seen.add(e.id);return e})}
 function read(raw,items){try{if(typeof raw!=='string'||raw.length>16384)throw Error();const data=JSON.parse(raw);if(!Array.isArray(data.slots)||!((data.version===1&&data.slots.length===12)||(data.version===2&&data.slots.length===COUNT)))throw Error();const migrated=data.version===1?[...data.slots,defaultSlots()[12]]:data.slots;return {mode:data.mode==='custom'?'custom':'original',slots:normalize(migrated,items)}}catch{return {mode:'original',slots:normalize(defaultSlots(),items)}}}
 function assign(slots,index,entry){if(!Number.isInteger(index)||index<0||index>=COUNT)throw Error('Invalid slot');const next=Array.from({length:COUNT},(_,n)=>cleanEntry(slots[n])),clean=cleanEntry(entry);const previous=clean?next.findIndex((s,n)=>n!==index&&s?.id===clean.id):-1;if(previous>=0)next[previous]=next[index];next[index]=clean;return next}
 function swap(slots,a,b){if(![a,b].every(n=>Number.isInteger(n)&&n>=0&&n<COUNT))throw Error('Invalid slot');const next=Array.from({length:COUNT},(_,n)=>cleanEntry(slots[n]));[next[a],next[b]]=[next[b],next[a]];return next}
 function resolve(entry,items,variants){const item=items.find(i=>!i.isDemo&&i.id===entry?.id);if(!item)return null;return (entry.view&&variants(item).find(v=>v.lookView===entry.view))||item}
 function mount(options){
  const {getItems,image,variants,photos,notify}=options,$=s=>document.querySelector(s),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const img=item=>item?.lookImage||image(item),name=item=>item.name+(item.lookSide?' · '+item.lookSide:'');
  let stored;try{stored=localStorage.getItem(KEY)}catch{}
  let saved=read(stored,getItems()),mode=saved.mode,draft=null,pickIndex=0,filter='all',query='',dragIndex=null;
  const currentSlots=()=>normalize(draft||saved.slots,getItems());
  const currentItem=n=>resolve(currentSlots()[n],getItems(),variants);
  function persist(next){try{localStorage.setItem(KEY,JSON.stringify({version:2,...next}));saved=next;mode=next.mode;return true}catch{notify('진열을 저장하지 못했어요. 브라우저 저장 공간을 확인해주세요.');return false}}
  function photoIndex(item){return Math.max(0,photos(item).findIndex(p=>p.src===img(item)))}
  function render(){
   const editing=Boolean(draft),custom=editing||mode==='custom',own=getItems(),slots=custom?currentSlots():normalize(defaultSlots(),own);
   $('#room-inventory-count').textContent=own.length+' OWNED ITEMS';
   $('#room-scene-image').src='./assets/wardrobe-hanging-v2.webp';
   $('#room-scene-image').alt='봉과 원목 선반이 있는 실사풍 옷장 · 보유품을 옷걸이에 진열';
   $('#room-scene').classList.toggle('editing-room',editing);
   $('#room-edit-bar').hidden=!editing;$('#room-selected-list').hidden=!editing;
   $('#room-edit-start').hidden=editing;
   $('#room-view-modes').hidden=editing;
   $('#room-view-modes').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.roomView===mode)));
   $('#room-caption').textContent=editing?'자리나 아래 아이템을 눌러 교체하세요. 끌어서 옮기거나 좌우 버튼으로 자리를 바꿀 수 있어요.':custom?'직접 고른 '+slots.filter(Boolean).length+'개 아이템 · 누르면 실제 보유품 상세가 열려요.':'옷걸이에 걸린 옷과 선반의 보유품을 눌러 자세히 볼 수 있어요.';
   $('#room-caption-note').textContent=custom?'선택 진열은 현재 기기에 저장돼요. PC·폰 간 자동 동기화되지 않아요.':'기본 보유품 진열 · 향수 선반에는 두 병을 나란히 놓을 수 있어요.';
   $('#room-badge').textContent=custom?'MY SELECTION':'MY WARDROBE';
   $('#room-hotspots').innerHTML=slots.map((entry,n)=>{const item=resolve(entry,own,variants),[x,y,w,h]=positions[n],label=item?name(item):'빈 자리',hanging=n<8&&item&&['outer','top','bottom'].includes(item.cat);return '<button type="button" class="room-product '+(!item?'room-product-empty':'')+(hanging?' room-hanging':'')+'" style="left:'+x+'%;top:'+y+'%;width:'+w+'%;height:'+h+'%" '+(editing?'data-room-pick="'+n+'" draggable="true" data-room-slot="'+n+'"':item?'data-view-item="'+esc(item.id)+'" data-view-photo="'+photoIndex(item)+'"':'data-room-edit-empty')+' aria-label="'+slotName(n)+' · '+esc(label)+(editing?' 교체':' 상세 보기')+'">'+(item&&img(item)?(hanging?'<span class="room-hanger" aria-hidden="true"></span>':'')+'<img class="room-item-cutout" alt="" draggable="false"/>':'<span class="room-empty-mark">'+(item?'사진 준비 중':'＋')+'</span>')+(editing?'<i>'+(n+1)+'</i>':'')+'<b>'+esc(label)+'</b></button>'}).join('');
   $('#room-hotspots').querySelectorAll('.room-product').forEach((button,n)=>{const item=resolve(slots[n],own,variants);if(!item||!img(item))return;window.MyFitRoomRenderer.render(button,img(item),{width:positions[n][2],height:positions[n][3],hanging:n<8&&['outer','top','bottom'].includes(item.cat),pants:item.cat==='bottom'})});
   $('#room-categories').innerHTML=Object.entries(categories).filter(([cat])=>cat!=='all').map(([cat,label])=>'<button type="button" data-room-category="'+cat+'">'+label+' <small>'+own.filter(i=>i.cat===cat).length+'</small></button>').join('');
   if(editing)$('#room-selected-list').innerHTML=slots.map((entry,n)=>{const item=resolve(entry,own,variants);return '<div class="room-slot-card" draggable="true" data-room-slot="'+n+'"><button class="room-slot-select" type="button" data-room-pick="'+n+'"><small>'+String(n+1).padStart(2,'0')+'</small>'+(item&&img(item)?'<img src="'+esc(img(item))+'" alt="" draggable="false"/>':'<span>＋</span>')+'<strong>'+(n===9||n===12?'<span class="room-slot-zone">향수 선반 · '+(n===9?'왼쪽':'오른쪽')+'</span>':'')+esc(item?name(item):'빈 자리 · 아이템 고르기')+'</strong></button><div class="room-slot-actions"><button type="button" data-room-shift="'+n+'" data-offset="-1" '+(n===0?'disabled':'')+' aria-label="'+(n+1)+'번 아이템 이전 자리로">←</button><button type="button" data-room-shift="'+n+'" data-offset="1" '+(n===COUNT-1?'disabled':'')+' aria-label="'+(n+1)+'번 아이템 다음 자리로">→</button><button type="button" data-room-clear="'+n+'" '+(!item?'disabled':'')+' aria-label="'+(n+1)+'번 자리 비우기">비우기</button></div></div>'}).join('');
  }
  function start(){draft=currentSlots().map(cleanEntry);render()}
  function renderPicker(){
   $('#room-picker-title').textContent=slotName(pickIndex)+'에 진열할 아이템';
   $('#room-picker-filters').innerHTML=Object.entries(categories).map(([key,label])=>'<button type="button" data-room-filter="'+key+'" aria-pressed="'+(filter===key)+'">'+label+'</button>').join('');
   const candidates=getItems().filter(i=>(filter==='all'||i.cat===filter)&&(!query||(i.name+' '+(i.brand||'')).toLowerCase().includes(query))).flatMap(i=>variants(i));
   const slots=currentSlots();
   $('#room-picker-count').textContent=candidates.length+'개 선택 가능';
   $('#room-picker-grid').innerHTML=candidates.map(item=>{const position=slots.findIndex(s=>s?.id===item.id),active=position===pickIndex&&(slots[position]?.view||'')===(item.lookView||'');return '<button type="button" class="room-choice" data-room-choose="'+esc(item.id)+'" data-room-face="'+esc(item.lookView||'')+'" aria-pressed="'+active+'">'+(img(item)?'<img loading="lazy" src="'+esc(img(item))+'" alt=""/>':'<span class="room-no-photo">사진 준비 중</span>')+'<strong>'+esc(name(item))+'</strong><small>'+(position>=0?(position+1)+'번에 진열 중'+(position!==pickIndex?' · 선택하면 자리 교환':''):'이 자리에 진열')+'</small></button>'}).join('')||'<p class="room-search-empty">찾는 아이템이 없어요. 다른 이름이나 분류를 선택해주세요.</p>';
  }
  function openPicker(n){if(!draft||!Number.isInteger(n)||n<0||n>=COUNT)return;pickIndex=n;filter=(n===9||n===12)?'fragrance':currentItem(n)?.cat||'all';query='';$('#room-picker-search').value='';renderPicker();$('#room-picker-modal').hidden=false;document.body.classList.add('modal-open');$('#room-picker-search').focus()}
  function closePicker(){options.closeModal('room-picker-modal');$('#room-selected-list [data-room-pick="'+pickIndex+'"]')?.focus()}
  function click(event){
   const target=event.target;
   if(target.closest('#room-edit-start')||target.closest('[data-room-edit-empty]')){start();return}
   if(target.closest('#room-edit-cancel')){draft=null;render();return}
   if(target.closest('#room-edit-defaults')){draft=normalize(defaultSlots(),getItems());render();return}
   if(target.closest('#room-edit-save')){if(persist({mode:'custom',slots:currentSlots()})){draft=null;render();notify('대표 아이템 진열을 이 기기에 저장했어요.')}return}
   const view=target.closest('[data-room-view]');if(view&&!draft){if(persist({mode:view.dataset.roomView==='custom'?'custom':'original',slots:currentSlots()}))render();return}
   const pick=target.closest('[data-room-pick]');if(pick){openPicker(Number(pick.dataset.roomPick));return}
   const clear=target.closest('[data-room-clear]');if(clear&&draft){draft=assign(currentSlots(),Number(clear.dataset.roomClear),null);render();return}
   const shift=target.closest('[data-room-shift]');if(shift&&draft){const n=Number(shift.dataset.roomShift);draft=swap(currentSlots(),n,n+Number(shift.dataset.offset));render();return}
   const cat=target.closest('[data-room-filter]');if(cat){filter=cat.dataset.roomFilter;renderPicker();return}
   const choice=target.closest('[data-room-choose]');if(choice&&draft){draft=assign(currentSlots(),pickIndex,{id:choice.dataset.roomChoose,view:choice.dataset.roomFace});render();closePicker();return}
   if(target.closest('[data-room-picker-close]'))closePicker();
  }
  document.addEventListener('click',click);
  document.addEventListener('keydown',event=>{const modal=$('#room-picker-modal');if(modal.hidden)return;if(event.key==='Escape'){event.stopPropagation();closePicker();return}if(event.key!=='Tab')return;const focusable=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(el=>el.getClientRects().length),first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}});
  $('#room-picker-search').addEventListener('input',event=>{query=event.target.value.trim().toLowerCase();renderPicker()});
  $('#wardrobe-room').addEventListener('dragstart',event=>{const slot=event.target.closest('[data-room-slot]');if(!draft||!slot)return;dragIndex=Number(slot.dataset.roomSlot);event.dataTransfer.setData('text/plain','myfit-room:'+dragIndex);event.dataTransfer.effectAllowed='move'});
  $('#wardrobe-room').addEventListener('dragover',event=>{if(draft&&dragIndex!==null&&event.target.closest('[data-room-slot]')){event.preventDefault();event.dataTransfer.dropEffect='move'}});
  $('#wardrobe-room').addEventListener('drop',event=>{const slot=event.target.closest('[data-room-slot]');if(!draft||dragIndex===null||!slot)return;event.preventDefault();draft=swap(currentSlots(),dragIndex,Number(slot.dataset.roomSlot));dragIndex=null;render()});
  $('#wardrobe-room').addEventListener('dragend',()=>{dragIndex=null});
  return {render};
 }
 return {COUNT,KEY,positions,defaultSlots,normalize,read,assign,swap,resolve,mount};
});
