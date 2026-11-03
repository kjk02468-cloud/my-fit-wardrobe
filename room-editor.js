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
 function read(raw,items){try{if(typeof raw!=='string'||raw.length>16384)throw Error();const data=JSON.parse(raw);if(!Array.isArray(data.slots)||!((data.version===1&&data.slots.length===12)||(data.version===2&&data.slots.length===COUNT)))throw Error();const migrated=data.version===1?[...data.slots,defaultSlots()[12]]:data.slots;return {mode:data.mode==='custom'?'custom':'original',slots:normalize(migrated,items),...(['warm','dark'].includes(data.lastScene)?{lastScene:data.lastScene}:{})}}catch{return {mode:'original',slots:normalize(defaultSlots(),items)}}}
 function assign(slots,index,entry){if(!Number.isInteger(index)||index<0||index>=COUNT)throw Error('Invalid slot');const next=Array.from({length:COUNT},(_,n)=>cleanEntry(slots[n])),clean=cleanEntry(entry);const previous=clean?next.findIndex((s,n)=>n!==index&&s?.id===clean.id):-1;if(previous>=0)next[previous]=next[index];next[index]=clean;return next}
 function swap(slots,a,b){if(![a,b].every(n=>Number.isInteger(n)&&n>=0&&n<COUNT))throw Error('Invalid slot');const next=Array.from({length:COUNT},(_,n)=>cleanEntry(slots[n]));[next[a],next[b]]=[next[b],next[a]];return next}
 function resolve(entry,items,variants){const item=items.find(i=>!i.isDemo&&i.id===entry?.id);if(!item)return null;return (entry.view&&variants(item).find(v=>v.lookView===entry.view))||item}
 function mount(options){
  const {getItems,image,variants,photos,notify}=options,$=s=>document.querySelector(s),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const scenes=window.MyFitRoomScenes,models=window.MyFitModels;
  const img=item=>item?.lookImage||image(item),name=item=>item.name+(item.lookSide?' · '+item.lookSide:'');
  let stored;try{stored=localStorage.getItem(KEY)}catch{}
  let saved=read(stored,getItems()),mode=saved.mode,draft=null,pickIndex=0,filter='all',query='',dragIndex=null,previousScene=saved.lastScene||'warm';
  const currentSlots=()=>normalize(draft||saved.slots,getItems());
  const currentItem=n=>resolve(currentSlots()[n],getItems(),variants);
  function persist(next){try{const matched=scenes.find(next.mode==='custom'?next.slots:defaultSlots(),getItems(),models);if(matched)previousScene=matched.id;next={...next,lastScene:previousScene};localStorage.setItem(KEY,JSON.stringify({version:2,...next}));saved=next;mode=next.mode;return true}catch{notify('진열을 저장하지 못했어요. 브라우저 저장 공간을 확인해주세요.');return false}}
  function photoIndex(item){return Math.max(0,photos(item).findIndex(p=>p.src===img(item)))}
  function sceneState(){
   const selected=currentSlots(),requested=mode==='custom'||Boolean(draft),match=scenes.find(requested?selected:defaultSlots(),getItems(),models),fallback=scenes.scenes.find(s=>s.id===previousScene&&scenes.current(s,getItems(),models))||scenes.scenes.find(s=>scenes.current(s,getItems(),models));if(match)previousScene=match.id;
   return {selected,scene:match||fallback||null,pending:requested&&!match};
  }
  function requestText(){return 'MY FIT 옷장 완성 사진 제작 요청\n'+currentSlots().map((e,n)=>{const i=resolve(e,getItems(),variants);return slotName(n)+': '+(i?name(i)+' ['+i.id+']':'비움')}).join('\n')+'\n이 배치를 기존 원목 옷장과 같은 조명·옷걸이·접지 그림자로 자연스럽게 연출해주세요.'}
  function render(){
   const editing=Boolean(draft),own=getItems(),slots=currentSlots(),{scene,pending}=sceneState();
   $('#room-inventory-count').textContent=own.length+' OWNED ITEMS';
   const background=$('#room-scene-image');background.hidden=!scene;if(scene)background.src=scene.image;
   background.alt='옷과 옷걸이·선반·그림자를 함께 연출한 실사풍 AI 옷장 완성 사진';
   $('#room-scene').classList.toggle('editing-room',editing);$('#room-scene').classList.toggle('room-finished',true);
   $('#room-edit-bar').hidden=!editing;$('#room-selected-list').hidden=!editing&&!(mode==='custom'&&pending);
   $('#room-edit-start').hidden=editing;$('#room-view-modes').hidden=editing;
   $('#room-view-modes').querySelectorAll('[data-room-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.roomView===mode)));
   $('#room-request-copy').hidden=!(pending||editing);
   $('#room-caption').textContent=editing?'완성 사진을 참고하며 아래 목록에서 새 배치를 골라주세요.':pending?'저장한 배치의 완성 사진 제작을 기다리고 있어요.':'완성 사진 · '+(scene?.title||'등록된 전시 없음')+' · 아이템을 누르면 상세가 열려요.';
   $('#room-caption-note').textContent=pending||editing?'현재 사진은 '+(scene?.title||'기존 완성 장면')+'예요. 새 배치는 저장 후 요청 내용을 복사해 이 채팅에 보내주세요.':'옷·옷걸이·그림자를 함께 연출한 AI 사진 · 새로운 배치는 여기서 요청해 반영해요.';
   $('#room-badge').textContent=pending?'FINISHED SCENE · PREVIOUS':'AI FINISHED SCENE';
   $('#room-hotspots').innerHTML=scene?scene.slots.map((entry,n)=>{const display=resolve(entry,own,variants),chosen=resolve(slots[n],own,variants),[x,y]=scenes.points[n];if(!display&&!editing)return '';return '<button type="button" class="room-dot" style="left:'+x+'%;top:'+y+'%" '+(editing?'data-room-pick="'+n+'"':display?'data-view-item="'+esc(display.id)+'" data-view-photo="'+photoIndex(display)+'"':'')+' aria-label="'+slotName(n)+' · '+esc(editing?(chosen?name(chosen):'빈 자리'):name(display))+(editing?' 교체':' 상세 보기')+'"><span>＋</span><b>'+esc(editing?(chosen?name(chosen):'빈 자리'):name(display))+'</b></button>'}).join(''):'<p class="room-photo-missing">보유품 정보가 바뀌었어요. 새 완성 사진을 요청해주세요.</p>';
   $('#room-categories').innerHTML=Object.entries(categories).filter(([cat])=>cat!=='all').map(([cat,label])=>'<button type="button" data-room-category="'+cat+'">'+label+' <small>'+own.filter(i=>i.cat===cat).length+'</small></button>').join('');
   if(editing||(mode==='custom'&&pending))$('#room-selected-list').innerHTML=slots.map((entry,n)=>{const item=resolve(entry,own,variants);return '<div class="room-slot-card" draggable="true" data-room-slot="'+n+'"><button class="room-slot-select" type="button" data-room-pick="'+n+'"><small>'+String(n+1).padStart(2,'0')+'</small>'+(item&&img(item)?'<img src="'+esc(img(item))+'" alt="" draggable="false"/>':'<span>＋</span>')+'<strong>'+(n===9||n===12?'<span class="room-slot-zone">향수 선반 · '+(n===9?'왼쪽':'오른쪽')+'</span>':'')+esc(item?name(item):'빈 자리 · 아이템 고르기')+'</strong></button><div class="room-slot-actions"><button type="button" data-room-shift="'+n+'" data-offset="-1" '+(n===0?'disabled':'')+' aria-label="'+(n+1)+'번 아이템 이전 자리로">←</button><button type="button" data-room-shift="'+n+'" data-offset="1" '+(n===COUNT-1?'disabled':'')+' aria-label="'+(n+1)+'번 아이템 다음 자리로">→</button><button type="button" data-room-clear="'+n+'" '+(!item?'disabled':'')+' aria-label="'+(n+1)+'번 자리 비우기">비우기</button></div></div>'}).join('');
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
   if(target.closest('#room-edit-save')){if(persist({mode:'custom',slots:currentSlots()})){draft=null;render();notify(sceneState().pending?'배치를 저장했어요. 완성 사진 요청을 복사해 채팅에 보내주세요.':'이 배치의 완성 사진을 적용했어요.')}return}
   if(target.closest('#room-request-copy')){const text=$('#room-request-text');text.value=requestText();$('#room-request-modal').hidden=false;document.body.classList.add('modal-open');text.focus();text.select();return}
   if(target.closest('#room-request-copy-confirm')){const text=$('#room-request-text');text.focus();text.select();navigator.clipboard.writeText(text.value).then(()=>notify('요청 내용을 복사했어요. 이 채팅에 붙여넣어 주세요.')).catch(()=>notify('선택된 요청 내용을 직접 복사해 채팅에 붙여넣어 주세요.'));return}
   const preset=target.closest('[data-room-scene]');if(preset&&!draft){const scene=scenes.scenes.find(s=>s.id===preset.dataset.roomScene);if(scene&&persist({mode:'custom',slots:normalize(scene.slots,getItems())}))render();return}
   const view=target.closest('[data-room-view]');if(view&&!draft){if(persist({mode:view.dataset.roomView==='custom'?'custom':'original',slots:currentSlots()}))render();return}
   const pick=target.closest('[data-room-pick]');if(pick){if(!draft)start();openPicker(Number(pick.dataset.roomPick));return}
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
