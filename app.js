/* MY FIT — a privacy-first men's wardrobe MVP.
   Public wardrobe loads from GitHub Pages; local edits and outfit logs stay in IndexedDB. */
(() => {
 'use strict';
 const $ = (selector, root=document) => root.querySelector(selector);
 const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
 const S = (value='') => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const categories = {all:'전체', top:'상의', bottom:'하의', outer:'아우터', shoes:'신발', bag:'가방', accessory:'액세서리'};
 const colors = {black:'블랙', brown:'브라운', beige:'베이지', cream:'크림', charcoal:'차콜', navy:'네이비', blue:'블루', white:'화이트', green:'그린', other:'기타'};
 const cityCoords = {'서울':[37.5665,126.9780],'성남':[37.4201,127.1266],'장성':[35.3018,126.7852],'부산':[35.1796,129.0756],'대전':[36.3504,127.3845]};
 const styleLabels = {casual:'데일리', date:'데이트', office:'비즈니스 캐주얼', formal:'포멀', travel:'주말 나들이'};
 const ownedItems = list => list.filter(item=>!item.isDemo);
 let database = null, items = [], logs = [], recommendations = [], weather = null;
 let activeHomeFilter = 'all', activeClosetFilter = 'all', activeFeature = 0, tempItemImage = null, tempLogImage = null, preselectedIds = [], lastRoute = 'home';
 let toastTimeout, detailItemId = null, detailPhotoIndex = 0, tempItemAdditionalImages = [], tempItemPhotoLabels = [];
 const $today = () => {const d = new Date();return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
 const id = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
 const itemById = itemId => items.find(item=>item.id===itemId);
 const safeImg = (source='') => (/^\.\/assets\/[a-z0-9-]+\.webp$/i.test(source) || /^data:image\/(webp|jpeg|png);base64,[a-z0-9+/=]+$/i.test(source)) ? source : '';
 const formatDate = value => {if(!value) return ''; const d=new Date(value+'T12:00:00'); return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',weekday:'short'}).format(d):S(value)};
 function toast(message){const el=$('#toast'); el.textContent=message;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),3500)}
 function openDb(){return new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(new Error('IndexedDB unsupported'));return}const r=indexedDB.open('myfit-closet-db',1);r.onupgradeneeded=()=>{const d=r.result;['items','logs','meta'].forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'})})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 function dbReq(store,method,argument){if(!database)return Promise.resolve(method==='getAll'?[]:undefined);return new Promise((resolve,reject)=>{const tx=database.transaction(store,method==='get'||method==='getAll'?'readonly':'readwrite');const req=argument===undefined?tx.objectStore(store)[method]():tx.objectStore(store)[method](argument);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
 async function loadData(){try{database=await openDb();items=sortItems(ownedItems(await dbReq('items','getAll')));logs=await dbReq('logs','getAll')}catch(error){console.warn('Local database unavailable',error);items=[];logs=[];toast('옷장 저장소를 열지 못했어요. 페이지를 다시 열거나 백업을 불러와주세요.')}}
 const sortItems = list => [...list].sort((a,b)=>{if(Boolean(a.isDemo)!==Boolean(b.isDemo))return a.isDemo?1:-1;if(a.isDemo){const an=Number(a.id.split('-').pop()),bn=Number(b.id.split('-').pop());return an-bn}return String(b.id).localeCompare(String(a.id))});
 const wearCount = itemId => logs.filter(log=>Array.isArray(log.itemIds)&&log.itemIds.includes(itemId)).length;
 const itemImage = item => safeImg(item?.image)||'';
 const additionalImages = item => Array.isArray(item?.additionalImages) ? item.additionalImages.map(safeImg).filter(Boolean).slice(0,8) : [];
 const photoLabel=(item,index)=>String(item?.photoLabels?.[index]||(index===0?'대표':`상세 ${index}`)).slice(0,24);
 const sourceUrl=value=>{try{const u=new URL(String(value||''));return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
 function itemPhotos(item){return [itemImage(item)?{src:itemImage(item),label:photoLabel(item,0)}:null,...additionalImages(item).map((src,index)=>({src,label:photoLabel(item,index+1)}))].filter(Boolean)}
 function openItemDetail(itemId){if(!itemById(itemId))return;detailItemId=itemId;detailPhotoIndex=0;renderItemDetail();openModal('item-detail-modal')}
 function renderItemDetail(){
  const item=itemById(detailItemId);if(!item)return;
  const photos=itemPhotos(item), selected=photos[detailPhotoIndex];
  $('#item-detail-title').textContent=item.name;
  $('#item-detail-brand').textContent=item.brand||'MY WARDROBE';
  const source=$('#item-detail-source');const url=sourceUrl(item.sourceUrl);source.hidden=!url;source.textContent=`${item.photoSourceName||'사진 · 상품 출처'} 보기 ↗`;if(url)source.href=url;else source.removeAttribute('href');$('#item-detail-photo-note').textContent=item.photoNote||'';$('#item-detail-photo-note').hidden=!item.photoNote;$('#item-detail-provenance').textContent=item.photoStatus==='pending'?'공식 이미지 확인 필요 · 기존 개인 판매 사진은 제외했어요.':item.photoSourceName||'사진 출처 미확인';$('#item-detail-empty').textContent=item.photoStatus==='pending'?'정확한 모델의 공식 사진을 확인하지 못했어요.':'아직 등록된 사진이 없어요.';
  $('#item-detail-meta').textContent=[categories[item.cat],colors[item.color],{all:'사계절',spring:'봄',summer:'여름',fall:'가을',winter:'겨울'}[item.season],{casual:'캐주얼',smart:'스마트 캐주얼',formal:'포멀 / 비즈니스'}[item.formality]].filter(Boolean).join(' · ');
  const image=$('#item-detail-image');image.hidden=!selected;if(selected){image.src=selected.src;image.alt=`${item.name} · ${selected.label}`}else image.removeAttribute('src');
  $('#item-detail-empty').hidden=Boolean(selected);
  $('#item-photo-caption').textContent=selected?`${selected.label} · ${detailPhotoIndex+1} / ${photos.length}`:item.photoStatus==='pending'?'공식 이미지 확인 필요':'등록된 사진이 없어요.';
  $('#item-photo-tabs').innerHTML=photos.map((photo,index)=>`<button type="button" data-item-photo="${index}" aria-label="${S(photo.label)} 사진 보기" aria-current="${index===detailPhotoIndex?'true':'false'}"><img src="${S(photo.src)}" alt=""/><span>${S(photo.label)}</span></button>`).join('');
  $('#item-photo-prev').hidden=photos.length<2;$('#item-photo-next').hidden=photos.length<2;
  $('#item-detail-hint').hidden=additionalImages(item).length>0||item.photoStatus==='pending';
 }
 function changeItemPhoto(index){const photos=itemPhotos(itemById(detailItemId));if(!photos.length)return;const restoreTabFocus=document.activeElement?.hasAttribute('data-item-photo');detailPhotoIndex=(index+photos.length)%photos.length;renderItemDetail();if(restoreTabFocus)$(`[data-item-photo="${detailPhotoIndex}"]`)?.focus()}
 function renderAdditionalPhotos(){
  $('#item-additional-previews').innerHTML=tempItemAdditionalImages.map((src,index)=>`<div class="extra-photo"><img src="${S(src)}" alt="${S(tempItemPhotoLabels[index+1]||`상세 ${index+1}`)} 사진"/><span>${S(tempItemPhotoLabels[index+1]||`상세 ${index+1}`)}</span><button type="button" data-remove-item-photo="${index}" aria-label="${S(tempItemPhotoLabels[index+1]||`상세 ${index+1}`)} 사진 제외">×</button></div>`).join('');
  $('#item-additional-count').textContent=`${tempItemAdditionalImages.length} / 8`;
 }
 function itemCard(item){const src=itemImage(item);const count=wearCount(item.id);return `<article class="product-card"><button class="product-media" type="button" data-view-item="${S(item.id)}" aria-label="${S(item.name)} 사진 보기">${src?`<img loading="lazy" src="${S(src)}" alt="${S(item.name)}"/>`:`<div class="product-placeholder">${item.photoStatus==='pending'?'<span>공식 이미지<br>확인 필요</span>':'◈'}</div>`}</button><button type="button" class="card-action" data-edit-item="${S(item.id)}" aria-label="${S(item.name)} 편집">⋯</button><div class="product-text"><button type="button" class="product-title" data-view-item="${S(item.id)}">${S(item.name)}</button><p class="product-meta">${item.photoStatus==='pending'?'공식 이미지 확인 필요 · ':item.photoStatus==='brand'?'브랜드 공식 · ':item.photoStatus==='retailer'?'공식 판매처 · ':item.photoStatus==='reference'?'대체 상품 사진 · ':''}${count}회 착용</p></div></article>`}
 function renderFilters(rootId,active){const parent=document.getElementById(rootId);if(!parent)return;const rows=Object.entries(categories).map(([key,label])=>`<button type="button" class="filter-chip ${active===key?'active':''}" data-filter="${key}" data-filter-scope="${rootId}">${label}</button>`).join('');parent.innerHTML=rows}
 function renderCloset(){renderFilters('home-filters',activeHomeFilter);renderFilters('closet-filters',activeClosetFilter);const filteredHome=items.filter(item=>activeHomeFilter==='all'||item.cat===activeHomeFilter);$('#home-items').innerHTML=filteredHome.slice(0,4).map(itemCard).join('')||`<div class="empty-card" style="grid-column:1/-1"><p>해당 카테고리에 등록된 옷이 없어요.</p><button type="button" data-add-item>등록하기 →</button></div>`;const keyword=$('#closet-search').value.trim().toLowerCase();const filtered=items.filter(item=>(activeClosetFilter==='all'||item.cat===activeClosetFilter)&&(!keyword||`${item.name} ${item.brand||''} ${colors[item.color]||''}`.toLowerCase().includes(keyword)));$('#catalog-grid').innerHTML=filtered.map(itemCard).join('')||`<div class="empty-card" style="grid-column:1/-1"><span>＋</span><p>아직 등록된 아이템이 없습니다.<br>내 옷 사진을 올려보세요.</p><button type="button" data-add-item>옷 등록하기 →</button></div>`;$('#photo-policy-summary').textContent=`사진 출처 · 브랜드 공식 ${items.filter(i=>i.photoStatus==='brand').length} · 공식 판매처 ${items.filter(i=>i.photoStatus==='retailer').length} · 대체 상품 사진 ${items.filter(i=>i.photoStatus==='reference').length}${items.some(i=>i.photoStatus==='pending')?` · 확인 필요 ${items.filter(i=>i.photoStatus==='pending').length}`:''}`;$('#closet-count').textContent=`${filtered.length.toString().padStart(2,'0')} ITEMS · ${items.filter(i=>!i.isDemo).length} MY OWN`;}
 function renderFeatured(){
  const looks=makeRecommendations();activeFeature=looks.length?activeFeature%looks.length:0;const look=looks[activeFeature];
  $('#feature-page').textContent=looks.length?`0${activeFeature+1} / 0${looks.length}`:'00 / 00';
  $('#feature-title').textContent=look?.title||'내 옷으로 시작하는 코디';
  $('#feature-subtitle').textContent=look?.description||'옷을 등록하면 내 옷장 안에서 조합을 찾아드려요.';
  $('#hero-own-board').innerHTML=look?outfitBoard(look):'<div class="board-empty">내 옷을 등록해 주세요.</div>';
  $('#feature-items').innerHTML=(look?.items||[]).filter(item=>itemImage(item)).map(item=>`<img loading="lazy" src="${S(itemImage(item))}" title="${S(item.name)}" alt="${S(item.name)}"/>`).join('');
  const reasons=look?[`내 옷 ${ownedItems(items).length}개에서 선택`,look.missing.length?`${look.missing.map(cat=>categories[cat]).join(' · ')} 미등록 · 있는 옷만 조합`:'상의·하의·신발이 모두 있는 조합',`목적지 ${look.context.destination} · ${styleLabels[look.context.purpose]}`,'사진 속 제품은 모두 내 옷장 등록품']:['첫 옷을 추가해 보세요.'];
  $('#feature-reasons').innerHTML=reasons.map((reason,index)=>`<div><span>${['◈','＋','⌖','♡'][index]}</span><p>${S(reason)}</p></div>`).join('');
  $('#feature-prev').disabled=!look;$('#feature-next').disabled=!look;$('#feature-like').disabled=!look;
  const saved=JSON.parse(localStorage.getItem('myfit-favourites')||'[]');const on=saved.includes(activeFeature);$('#feature-like').textContent=on?'♥':'♡';$('#feature-like').classList.toggle('saved',on);
 }
 function renderLogs(){const recent=[...logs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);$('#home-logs').innerHTML=recent.length?recent.map(log=>{const src=safeImg(log.photo)||getLogFallback(log);return `<article class="log-card"><button type="button" class="log-photo" data-view-log="${S(log.id)}" aria-label="${S(log.destination||'착장 기록')} 확인">${src?`<img loading="lazy" src="${S(src)}" alt="${S(log.destination||'나의 착장 기록')}" />`:'<div class="log-fallback">MY OOTD</div>'}</button><span class="log-date">${S(formatDate(log.date))}</span><span class="log-location">${S(log.destination||'나의 하루')}</span></article>`}).join(''):`<div class="empty-card"><span>✎</span><p>아직 남긴 착장 기록이 없어요.<br>내 옷으로 첫 기록을 남겨보세요.</p><button type="button" data-add-log>첫 착장 기록하기 →</button></div>`;renderArchive()}
 function getLogFallback(log){return (log.itemIds||[]).map(itemById).filter(Boolean).map(itemImage).find(Boolean)||''}
 function renderArchive(){const total=logs.length;$('#diary-total').textContent=String(total).padStart(2,'0');const scores=items.map(item=>({...item,count:wearCount(item.id)})).sort((a,b)=>b.count-a.count);$('#diary-top-item').textContent=scores[0]?.count?scores[0].name:'—';const archive=$('#archive-grid');if(!logs.length){archive.innerHTML=`<div class="empty-card"><span>✎</span><p>아직 남긴 착장 기록이 없어요.<br>오늘 입은 옷부터 시작해보세요.</p><button type="button" data-add-log>첫 착장 기록하기 →</button></div>`;return}const ordered=[...logs].sort((a,b)=>$('#diary-sort').value==='new'?b.date.localeCompare(a.date):a.date.localeCompare(b.date));archive.innerHTML=ordered.map(log=>{const photo=safeImg(log.photo)||getLogFallback(log);const used=(log.itemIds||[]).map(itemById).filter(Boolean);return `<article class="archive-card"><div class="archive-photo">${photo?`<img loading="lazy" src="${S(photo)}" alt="${S(log.destination||'착장 이미지')}" />`:'<div class="log-fallback">MY OOTD</div>'}<span class="date-stamp">${S(formatDate(log.date))}</span></div><div class="archive-details"><h3>${S(log.destination||'일상의 한 장면')}</h3><p>${S(log.note||'나만의 스타일을 기록했어요.')}</p><div class="archive-used">${used.filter(item=>itemImage(item)).slice(0,4).map(i=>`<img src="${S(itemImage(i))}" title="${S(i.name)}" alt="${S(i.name)}"/>`).join('')}</div><button type="button" data-delete-log="${S(log.id)}">기록 삭제</button></div></article>`}).join('')}
 function openModal(name){document.getElementById(name).hidden=false;document.body.classList.add('modal-open');const first=$('#'+name+' .icon-dismiss');first?.focus()}
 function closeModal(name){document.getElementById(name).hidden=true;if(!$$('.overlay:not([hidden])').length)document.body.classList.remove('modal-open')}
 function openItemModal(itemId=null){const item=itemId?itemById(itemId):null;$('#item-form').reset();$('#item-id').value=item?.id||'';$('#item-dialog-title').textContent=item?'아이템 수정':'새 아이템 등록';$('#item-name').value=item?.name||'';$('#item-brand').value=item?.brand||'';$('#item-category').value=item?.cat||'outer';$('#item-color').value=item?.color||'black';$('#item-season').value=item?.season||'all';$('#item-formality').value=item?.formality||'casual';tempItemImage=null;tempItemAdditionalImages=additionalImages(item);tempItemPhotoLabels=Array.from({length:tempItemAdditionalImages.length+1},(_,index)=>photoLabel(item,index));renderAdditionalPhotos();$('#item-photos-status').textContent='뒷면·소재·로고·착용 사진을 자유롭게 추가하세요.';const src=item?itemImage(item):'';$('#item-preview').innerHTML=src?`<img src="${S(src)}" alt="아이템 사진 미리보기" /><span style="position:absolute;bottom:5px;background:#fff9;padding:3px 9px;font-size:11px">사진 변경하기 ↗</span>`:'<strong>＋</strong><span>옷 사진을 추가하세요</span><small>JPG, PNG, WEBP · 최대 12MB</small>';const submit=$('#item-form [type="submit"]');submit.textContent=item?'변경사항 저장 →':'아이템 저장하기 →';let deleteButton=$('#item-delete');if(deleteButton)deleteButton.remove();if(item){deleteButton=document.createElement('button');deleteButton.id='item-delete';deleteButton.type='button';deleteButton.className='button-outline';deleteButton.textContent='삭제';deleteButton.addEventListener('click',()=>deleteItem(item.id));$('#item-form .dialog-actions').prepend(deleteButton)}openModal('item-modal')}
 async function imageFromFile(file){if(!file)return null;if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPG, PNG, WEBP 형식의 이미지만 등록할 수 있어요.');if(file.size>12*1024*1024)throw new Error('12MB 이하의 이미지를 선택해주세요.');return new Promise((resolve,reject)=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{try{const scale=Math.min(1,1150/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#f8f7f3';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const result=canvas.toDataURL('image/webp',.79);URL.revokeObjectURL(url);resolve(result)}catch(e){URL.revokeObjectURL(url);reject(e)}};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('이미지를 읽지 못했습니다.'))};img.src=url})}
 async function saveItem(event){event.preventDefault();const current=itemById($('#item-id').value);const name=$('#item-name').value.trim();if(!name){toast('아이템 이름을 입력해주세요.');return}const photosChanged=Boolean(tempItemImage)||tempItemAdditionalImages.some(src=>!additionalImages(current).includes(src));const item={id:current?.id||id('item'),name,brand:$('#item-brand').value.trim(),cat:$('#item-category').value,color:$('#item-color').value,season:$('#item-season').value,formality:$('#item-formality').value,image:tempItemImage||current?.image||'',additionalImages:[...tempItemAdditionalImages],photoLabels:[...tempItemPhotoLabels],sourceUrl:photosChanged?'':sourceUrl(current?.sourceUrl),photoStatus:photosChanged?'unverified':current?.photoStatus||'unverified',photoSourceName:photosChanged?'직접 추가한 사진 · 출처 미확인':current?.photoSourceName||'',photoNote:photosChanged?'':current?.photoNote||'',isDemo:false};try{await dbReq('items','put',item)}catch(e){console.warn(e);toast('저장소 공간을 확인해주세요.');return}if(current){items=items.map(i=>i.id===item.id?item:i)}else{items.unshift(item)}renderCloset();renderFeatured();renderRecommendations(true);renderLogs();closeModal('item-modal');toast(current?'아이템 정보를 수정했어요.':'새 옷이 내 옷장에 추가됐어요.');}
 async function deleteItem(itemId){const item=itemById(itemId);if(!item||!confirm(`“${item.name}” 아이템을 삭제할까요?\n기존 착장 기록은 유지되지만 제품 연결은 사라집니다.`))return;await hidePublishedItem(itemId);await dbReq('items','delete',itemId);items=items.filter(i=>i.id!==itemId);closeModal('item-modal');renderCloset();renderFeatured();renderRecommendations(true);renderLogs();toast('아이템을 삭제했어요.')}
 function openLogModal(ids=[]){preselectedIds=ids;tempLogImage=null;$('#log-form').reset();$('#log-id').value='';$('#log-date').value=$today();$('#log-destination').value=$('#stylist-destination').selectedOptions?.[0]?.textContent||'';$('#log-photo-preview').innerHTML='<span>＋ 착장 사진 올리기</span><small>사진이 없으면 사용한 옷의 이미지가 표시됩니다.</small>';$('#log-item-choices').innerHTML=items.map(item=>`<label class="${preselectedIds.includes(item.id)?'selected':''}"><input type="checkbox" value="${S(item.id)}" ${preselectedIds.includes(item.id)?'checked':''} aria-label="${S(item.name)}"/>${itemImage(item)?`<img loading="lazy" src="${S(itemImage(item))}" alt="${S(item.name)}"/>`:'<span class="board-photo-pending">공식 이미지 확인 필요</span>'}<span>${S(item.name)}</span></label>`).join('');openModal('log-modal')}
 async function buildOutfitBoard(itemIds){
  const c=document.createElement('canvas'); c.width=720;c.height=900;const g=c.getContext('2d');
  g.fillStyle='#eee9e1';g.fillRect(0,0,720,900);g.fillStyle='#2c2925';g.font='36px Georgia,serif';g.fillText('MY FIT.',36,62);
  g.font='12px Arial,sans-serif';g.fillStyle='#897e72';g.fillText('TODAY\'S OUTFIT BOARD',38,88);
  const boxes=[[28,118,321,345],[370,118,321,345],[28,484,321,345],[370,484,321,345]];
  const chosen=itemIds.map(itemById).filter(Boolean).slice(0,4);
  const load=src=>new Promise(resolve=>{if(!src){resolve(null);return}const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=src});
  const photos=await Promise.all(chosen.map(i=>load(itemImage(i))));
  for(let i=0;i<boxes.length;i++){const [x,y,w,h]=boxes[i];g.fillStyle='#f9f6f0';g.fillRect(x,y,w,h);const photo=photos[i];if(photo){const margin=15;const sf=Math.min((w-2*margin)/photo.naturalWidth,(h-70)/photo.naturalHeight);const tw=photo.naturalWidth*sf,th=photo.naturalHeight*sf;g.drawImage(photo,x+(w-tw)/2,y+10+(h-70-th)/2,tw,th)}g.fillStyle='#443b33';g.font='14px Arial,sans-serif';g.fillText((chosen[i]?.name||'').slice(0,19),x+13,y+h-18)}
  g.font='12px Arial,sans-serif';g.fillStyle='#8b8074';g.fillText('YOUR CLOTHES, YOUR STORY.',35,870);
  try{return c.toDataURL('image/webp',.77)}catch(e){return ''}
 }
 async function saveLog(event){event.preventDefault();const itemIds=$$('#log-item-choices input:checked').map(el=>el.value);if(!$('#log-date').value){toast('날짜를 선택해주세요.');return}if(!itemIds.length&&!tempLogImage){toast('착장 사진을 올리거나 착용한 아이템을 선택해주세요.');return}const board=!tempLogImage&&itemIds.length?await buildOutfitBoard(itemIds):'';const log={id:id('log'),date:$('#log-date').value,destination:$('#log-destination').value.trim(),note:$('#log-note').value.trim(),itemIds,photo:tempLogImage||board,type:tempLogImage?'photo':'board'};try{await dbReq('logs','put',log)}catch(e){console.warn(e);toast('저장 공간이 부족할 수 있어요.');return}logs.unshift(log);renderCloset();renderLogs();closeModal('log-modal');toast('오늘의 착장을 기록했어요. ✦');navigate('diary')}
 async function deleteLog(logId){if(!confirm('이 착장 기록을 삭제할까요?'))return;await dbReq('logs','delete',logId);logs=logs.filter(i=>i.id!==logId);renderCloset();renderLogs();toast('착장 기록을 삭제했어요.')}
 function showRoute(route){const view=['home','closet','stylist','diary'].includes(route)?route:'home';lastRoute=view;$$('[data-view]').forEach(panel=>panel.hidden=panel.dataset.view!==view);$$('.nav-item').forEach(btn=>btn.classList.toggle('active',btn.dataset.route===view));$('#mobile-nav').hidden=true;$('#mobile-toggle').setAttribute('aria-expanded','false');window.scrollTo({top:0,behavior:'instant'});if(view==='stylist')renderRecommendations(false);if(view==='diary')renderLogs();}
 function navigate(route){const next=['home','closet','stylist','diary'].includes(route)?route:'home';if(location.hash.slice(1)!==next){location.hash=next}else showRoute(next)}
 function toStylist(){const homeDestination=$('#home-destination').value;const homePurpose=$('#home-purpose').value;const mapping={'도심':'도심','카페':'카페','사무실':'사무실','야외':'야외','행사장':'행사장'};$('#stylist-destination').value=mapping[homeDestination]||'도심';$('#stylist-purpose').value=homePurpose;navigate('stylist');setTimeout(()=>renderRecommendations(true),20)}
 function monthSeason(){const m=new Date().getMonth()+1;return m>=3&&m<=5?'spring':m>=6&&m<=8?'summer':m>=9&&m<=11?'fall':'winter'}
 function itemRules(item,c){
  const rules=[],add=(label,points)=>rules.push({label,points});
  const target=['office','formal'].includes(c.purpose)?'formal':c.purpose==='date'?'smart':'casual';
  if(item.season==='all')add('사계절 아이템',2);
  else if(item.season===c.season)add('현재 계절에 등록된 옷',5);
  else if(c.season==='spring'&&item.season==='fall')add('간절기 아이템',2);
  if(item.formality===target)add(`${styleLabels[c.purpose]} 목적과 등록 스타일 일치`,5);
  if(c.mood==='minimal'&&['black','white','cream','beige','brown','charcoal','navy'].includes(item.color))add('미니멀 선택 · 차분한 색',3);
  if(c.mood==='classic'&&['smart','formal'].includes(item.formality))add('클래식 선택 · 단정한 스타일',3);
  if(c.mood==='casual'&&item.formality==='casual')add('캐주얼 선택과 일치',3);
  if(c.destination==='사무실'&&['smart','formal'].includes(item.formality))add('사무실에 맞는 등록 스타일',3);
  if(c.destination==='행사장'&&item.formality==='formal')add('행사장 · 포멀 아이템',5);
  if(c.destination==='야외'&&['shoes','outer','bottom'].includes(item.cat)&&item.formality==='casual')add('야외 · 캐주얼 아이템',4);
  if(c.destination==='카페'&&item.formality==='smart')add('카페 · 스마트 캐주얼',3);
  if(c.purpose==='travel'&&item.cat==='shoes'&&item.formality==='casual')add('나들이 · 캐주얼 신발',4);
  if(c.temperature!==null&&c.temperature>=24&&item.season==='winter')add('더운 날의 겨울옷',-7);
  if(c.temperature!==null&&c.temperature<9&&item.cat==='outer'&&item.season==='winter')add('낮은 기온 · 겨울 아우터',6);
  if(c.code!==null&&[51,53,55,61,63,65,66,67,80,81,82,95,96,99].includes(c.code)&&item.name.includes('스웨이드'))add('비 예보 · 스웨이드 관리 주의',-8);
  return rules;
 }
 function itemScore(item,c){return itemRules(item,c).reduce((sum,rule)=>sum+rule.points,0)}
 function getContext(){const purpose=$('#stylist-purpose').value;const city=$('#city').value;const season=monthSeason();const mood=$('input[name=mood]:checked')?.value||'minimal';return {purpose,destination:$('#stylist-destination').value,city,mood,season,temperature:weather&&weather.city===city?weather.temp:null,code:weather&&weather.city===city?weather.code:null}}
 function combinationRules(chosen){
  const rules=[],clothes=chosen.filter(i=>i.cat!=='accessory'&&i.cat!=='bag');const outer=chosen.find(i=>i.cat==='outer'),shoe=chosen.find(i=>i.cat==='shoes');
  if(outer&&shoe&&['smart','formal'].includes(outer.formality)&&['smart','formal'].includes(shoe.formality))rules.push({label:'아우터와 신발을 단정한 스타일로 연결',points:outer.formality===shoe.formality?6:4});
  const palette=[...new Set(clothes.map(i=>i.color))];
  if(palette.length<=2&&clothes.length>1)rules.push({label:'주요 색을 두 가지 이내로 연결',points:3});
  if(palette.includes('brown')&&palette.includes('beige'))rules.push({label:'브라운과 베이지의 가까운 색 연결',points:3});
  if(clothes.length>1&&new Set(clothes.map(i=>i.formality)).size===1)rules.push({label:'옷과 신발의 등록 스타일 일치',points:3});
  return rules;
 }
 function makeRecommendations(){
  const c=getContext(),own=ownedItems(items);if(!own.length)return [];
  const cool=c.temperature===null?c.season!=='summer':c.temperature<=22;
  const cats=[...(cool||['formal','office'].includes(c.purpose)?['outer']:[]),'top','bottom','shoes','bag','accessory'];
  let candidates=[{items:[],score:0}];
  for(const cat of cats){
   const pool=own.filter(i=>i.cat===cat).map(item=>({item,score:itemScore(item,c)})).sort((a,b)=>b.score-a.score||a.item.name.localeCompare(b.item.name)).slice(0,6);
   if(!pool.length)continue;
   candidates=candidates.flatMap(base=>pool.map(p=>({items:[...base.items,p.item],score:base.score+p.score}))).sort((a,b)=>b.score-a.score).slice(0,96);
  }
  candidates=candidates.filter(r=>r.items.length).map(r=>({...r,score:r.score+combinationRules(r.items).reduce((s,x)=>s+x.points,0)}));
  const selected=[];
  while(candidates.length&&selected.length<3){
   const adjusted=r=>r.score-(selected.length?Math.max(...selected.map(prev=>r.items.filter(i=>prev.items.some(p=>p.id===i.id)).length))*4:0);
   candidates.sort((a,b)=>adjusted(b)-adjusted(a)||b.score-a.score);
   const usedOuters=new Set(selected.map(r=>r.items.find(i=>i.cat==='outer')?.id).filter(Boolean));
   const freshOuterIndex=selected.length?candidates.findIndex(r=>{const outer=r.items.find(i=>i.cat==='outer');return outer&&!usedOuters.has(outer.id)}):-1;
   selected.push(candidates.splice(freshOuterIndex>=0?freshOuterIndex:0,1)[0]);
  }
  return selected.map((r,index)=>{
   const chosen=r.items,missing=['top','bottom','shoes'].filter(cat=>!chosen.some(item=>item.cat===cat));
   const outer=chosen.find(i=>i.cat==='outer'),shoe=chosen.find(i=>i.cat==='shoes');
   const title=outer?.name.includes('MA-1')?'블랙 봄버 캐주얼':outer?.color==='navy'&&shoe?.color==='black'?'네이비 레더와 블랙 슈즈':outer?.color==='beige'&&shoe?.color==='brown'?'베이지 코트와 브라운 로퍼':outer?`${colors[outer.color]} 아우터 조합`:shoe?`${colors[shoe.color]} 슈즈 조합`:'보유 아이템 조합';
   const note=missing.length?`${missing.map(cat=>categories[cat]).join(' · ')}가 아직 등록되지 않아, 보유한 제품으로만 구성한 부분 코디예요.`:'등록한 상의·하의·신발을 함께 구성했어요.';
   const purposeNote=['office','formal'].includes(c.purpose)&&chosen.some(item=>item.cat==='top'&&item.formality==='casual')?' 현재 상의는 캐주얼해서 격식 있는 자리에는 추가 상의가 필요해요.':'';
   const temp=c.temperature!==null?`${Math.round(c.temperature)}°C 기준`:'기온 미조회 · 계절 기준';
   return {id:'rec-'+index,number:index+1,title,description:note+purposeNote,items:chosen,missing,context:c,score:r.score,explain:`${temp} · 목적지 ${c.destination} · ${styleLabels[c.purpose]} · 내 옷만 사용`,combinationRules:combinationRules(chosen)};
  });
 }
 function stylingSummary(rec){
  const outer=rec.items.find(i=>i.cat==='outer'),shoe=rec.items.find(i=>i.cat==='shoes'),top=rec.items.find(i=>i.cat==='top');
  const reasons=[];
  if(outer?.color==='beige'&&shoe?.color==='brown')reasons.push('베이지 코트와 브라운 로퍼를 따뜻한 계열로 연결하고, 블랙 후드가 가운데를 잡아줘요.');
  else if(outer?.color==='navy'&&shoe?.color==='black')reasons.push('네이비와 블랙의 어두운 톤을 이어 차분하게 입는 조합이에요. 가죽 자켓의 질감이 포인트가 돼요.');
  else if(outer?.name.includes('MA-1')&&shoe?.formality==='casual')reasons.push('MA-1·후드·스니커즈의 캐주얼한 성격을 맞췄어요. 짧고 볼륨 있는 아우터와 두툼한 신발이 이어져요.');
  else if(outer?.name.includes('블레이저')&&top?.name.includes('후드'))reasons.push('블레이저에 후드를 겹쳐 편한 스마트 캐주얼로 입는 조합이에요. 두 옷을 겹쳤을 때 어깨와 팔의 여유를 확인해 주세요.');
  else if(outer&&shoe)reasons.push(`${colors[outer.color]} 아우터와 ${colors[shoe.color]} 신발의 색·등록 스타일을 함께 비교했어요.`);
  if(outer&&shoe&&['smart','formal'].includes(outer.formality)&&['smart','formal'].includes(shoe.formality))reasons.push('아우터와 가죽 신발을 단정한 쪽으로 연결했어요. 후드와 볼캡은 캐주얼한 분위기를 더해줘요.');
  else if(top?.color==='black'&&shoe?.color==='black')reasons.push('블랙 상의와 블랙 신발을 반복해 여러 아이템을 입어도 색이 흩어지지 않아요.');
  else reasons.push(rec.context.mood==='minimal'?'선택한 미니멀 분위기에 맞춰 차분한 색 위주로 골랐어요.':'선택한 외출 목적과 옷에 등록된 스타일을 우선했어요.');
  return reasons.slice(0,2);
 }
 const stylingReferences=[
  {match:rec=>rec.items.some(i=>i.id.endsWith('-ma1')),src:'./assets/reference-ma1-look.webp',kind:'보유 제품 · 스튜디오 착용 컷',name:'WOOYOUNGMI MA-1',source:'https://blog.naver.com/takutaku9/222188934892',reason:'같은 MA-1의 짧은 기장과 소매 볼륨을 참고하세요. 판매 자료에 실린 사진이며 공식 원본은 미확인이에요.'},
  {match:rec=>rec.items.some(i=>i.id.endsWith('-leather')),src:'./assets/reference-navy-leather-look.webp',kind:'보유 제품 · 브랜드 컬렉션 컷',name:'WOOYOUNGMI 21FW',source:'https://hypebeast.com/2021/1/wooyoungmi-paris-fashion-week-fall-winter-2021-runway-collection',reason:'네이비 가죽 자켓을 어두운 팬츠와 연결한 컬렉션 착장이에요. 사진 속 니트와 하의는 보유품으로 등록하지 않았어요.'},
  {match:rec=>rec.items.some(i=>i.cat==='outer'&&i.color==='beige')&&rec.items.some(i=>i.id.endsWith('-loafers')),src:'./assets/reference-coat-loafers-look.webp',kind:'유사 스타일 · STU 공식 착장',name:'긴 코트 + 브라운 로퍼',source:'https://stuoffice.com/product/suede-penny-loafers-brown/2548/',reason:'긴 코트와 로퍼의 비율을 참고하는 사진이에요. 로퍼는 보유 제품이고, 사진 속 코트는 다른 모델이에요.'},
  {match:rec=>rec.items.some(i=>i.id.endsWith('-loafers')&&i.photoStatus==='brand'),src:'./assets/official-loafers-look.webp',kind:'보유 제품 · STU 공식 착장',name:'브라운 로퍼 + 베이지 팬츠',source:'https://stuoffice.com/product/suede-penny-loafers-brown/2548/',reason:'브라운 로퍼에 베이지 팬츠를 연결한 색 조합 참고예요. 사진 속 상의와 팬츠는 미등록 제품이에요.'},
  {match:rec=>rec.items.some(i=>i.id.endsWith('-drmartens')&&i.photoStatus==='brand'),src:'./assets/official-drmartens-look.webp',kind:'보유 제품 · Dr. Martens 공식 착장',name:'1461 + 데님',source:'https://www.drmartens.co.kr/products/1461-napa-mugwang',reason:'블랙 1461을 캐주얼한 데님과 연결한 공식 스타일링이에요. 사진 속 팬츠는 미등록 제품이에요.'},
  {match:rec=>rec.items.some(i=>i.cat==='top'&&i.photoStatus==='brand'&&i.sourceUrl?.includes('/2371/')),src:'./assets/official-hoodie-look.webp',kind:'보유 제품 · WOOYOUNGMI 공식 착장',name:'블랙 후드 + 밝은 팬츠',source:'https://wooyoungmi.com/product/black/2371/',reason:'보유 후드와 밝은 팬츠의 대비를 참고하세요. 사진 속 하의와 신발은 보유품으로 추가하지 않았어요.'}
 ];
 function recommendationEvidence(rec){
  const refs=stylingReferences.filter(ref=>ref.match(rec)).slice(0,2);
  return `<section class="styling-summary"><h4>이렇게 입어보세요</h4><ul>${stylingSummary(rec).map(reason=>`<li>${S(reason)}</li>`).join('')}</ul></section><details class="recommendation-reasons"><summary>선택 기준 자세히 보기 <small>규칙 점수 ${rec.score}</small></summary><p class="reason-method">등록한 계절·스타일·색상과 선택한 목적·분위기를 비교했어요. 점수는 취향 만족 확률이 아니에요.</p><ul>${rec.items.map(item=>`<li><strong>${S(item.name)}</strong><span>${itemRules(item,rec.context).map(rule=>`${S(rule.label)} (${rule.points>0?'+':''}${rule.points})`).join(' · ')||'보유한 같은 카테고리에서 선택'}</span></li>`).join('')}${rec.combinationRules.map(rule=>`<li>${S(rule.label)} (+${rule.points})</li>`).join('')}</ul><p class="fine-print">${rec.number>1?'가능하면 다른 아우터를 골라 분위기를 나눴고, 앞선 추천과 겹치는 옷은 조합당 점수를 낮춰 골랐어요. ':''}체형·실제 핏·소재 두께는 분석하지 않았어요. ${rec.context.temperature===null?'날씨는 아직 조회하지 않았어요.':''}</p></details>${refs.length?`<section class="outfit-references" aria-label="착장 참고 사진"><h4>착장 참고 사진</h4><p>추천 조합 전체를 그대로 입은 사진은 아니에요. 보유 제품과 유사 스타일을 구분했으며, 사진 속 다른 옷은 내 옷장 등록품이 아닐 수 있어요.</p><div class="reference-grid">${refs.map(ref=>`<figure><span class="reference-kind">${S(ref.kind)}</span><a href="${S(ref.source)}" target="_blank" rel="noopener noreferrer"><img src="${S(ref.src)}" loading="lazy" alt="${S(ref.kind+' · '+ref.name)}"/><figcaption>${S(ref.name)} · 출처 보기 ↗</figcaption></a><p>${S(ref.reason)}</p></figure>`).join('')}</div></section>`:'<p class="fine-print">이 조합의 착장 참고 사진은 아직 확인하지 못했어요.</p>'}`;
 }

 function outfitBoard(rec){
  const pieces=['outer','top','bottom','shoes'].map(cat=>{
   const item=rec.items.find(item=>item.cat===cat);
   if(!item)return cat==='outer'?'':`<div class="board-tile board-missing"><span>＋</span><strong>${categories[cat]} 미등록</strong><small>등록한 옷만 사용해요</small></div>`;
   const image=itemImage(item);return `<button type="button" class="board-tile" data-view-item="${S(item.id)}" aria-label="${S(item.name)} 사진 보기">${image?`<img src="${S(image)}" alt="${S(item.name)}"/>`:`<span class="board-photo-pending">${item.photoStatus==='pending'?'공식 이미지 확인 필요':'사진 미등록'}</span>`}<small>${S(categories[item.cat])}</small><strong>${S(item.name)}</strong></button>`;
  });
  for(const item of rec.items.filter(item=>['bag','accessory'].includes(item.cat))){pieces.push(`<button type="button" class="board-tile board-addon" data-view-item="${S(item.id)}" aria-label="${S(item.name)} 사진 보기">${itemImage(item)?`<img src="${S(itemImage(item))}" alt="${S(item.name)}"/>`:'<span class="board-photo-pending">사진 확인 필요</span>'}<small>${S(categories[item.cat])}</small><strong>${S(item.name)}</strong></button>`)}
  return `<div class="own-outfit-board" aria-label="등록한 내 옷으로 구성한 코디">${pieces.join('')}</div>`;
 }
 function renderRecommendations(rebuild=true){
  if(rebuild||!recommendations.length)recommendations=makeRecommendations();
  $('#results-count').textContent=`${String(recommendations.length).padStart(2,'0')} LOOKS`;
  const c=getContext(),missing=['top','bottom','shoes'].filter(cat=>!ownedItems(items).some(item=>item.cat===cat));
  $('#results-desc').textContent=`${c.temperature!==null?`${c.city} ${Math.round(c.temperature)}°C 실시간 조회 기준`:'기온 미조회 · 현재 계절 기준'} · 내 옷 ${ownedItems(items).length}개로만 추천합니다.${missing.length?` ${missing.map(cat=>categories[cat]).join(' · ')} 미등록으로 부분 코디를 보여드려요.`:''}`;
  $('#outfit-results').innerHTML=recommendations.length?recommendations.map((rec,index)=>`<article class="outfit-card own-outfit-card"><div class="own-outfit-header"><span>LOOK 0${rec.number}</span><span>${rec.missing.length?'부분 코디':'내 옷 코디'}</span></div>${outfitBoard(rec)}<div class="outfit-card-body"><h3>${S(rec.title)}</h3><p>${S(rec.description)}</p><div class="outfit-item-names">${rec.items.map(item=>S(item.name)).join(' · ')}</div><div class="outfit-action-row"><button type="button" data-save-outfit="${index}">${rec.missing.length?'이 조합으로 기록하기':'이 착장으로 기록하기'} ↗</button></div><div class="fine-print">${S(rec.explain)}</div>${recommendationEvidence(rec)}</div></article>`).join(''):`<div class="outfit-empty"><strong>YOUR STYLE STARTS HERE.</strong><p>내 옷을 등록하면 날씨와 목적에 맞춰 조합을 제안할게요.</p><button type="button" class="button-primary" data-add-item>첫 옷 등록하기 →</button></div>`;
  renderFeatured();
 }
 async function refreshWeather(){const city=$('#city').value;const coords=cityCoords[city];const btn=$('#weather-refresh');btn.disabled=true;btn.textContent='조회 중…';$('#weather-source').textContent='확인 중';try{const uri=`https://api.open-meteo.com/v1/forecast?latitude=${coords[0]}&longitude=${coords[1]}&current=temperature_2m,apparent_temperature,precipitation,weather_code&timezone=Asia%2FSeoul&forecast_days=1`;const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),12000);let response;try{response=await fetch(uri,{signal:ctrl.signal})}finally{clearTimeout(timeout)}if(!response.ok)throw new Error('Forecast service unavailable');const data=await response.json();if(typeof data.current?.temperature_2m!=='number')throw new Error('No current temperature');weather={city,temp:data.current.temperature_2m,apparent:data.current.apparent_temperature,code:data.current.weather_code,rain:data.current.precipitation,observed:data.current.time};const rainy=[51,53,55,61,63,65,66,67,80,81,82,95,96,99].includes(weather.code);const cloudy=weather.code>=2;const icon=rainy?'☂':cloudy?'☁':'☼';const description=rainy?'비':cloudy?'구름':'맑음';$('#weather-big-icon').textContent=icon;$('#weather-main').textContent=`${city} ${Math.round(weather.temp)}°C · ${description}`;$('#weather-sub').textContent=`체감 ${Math.round(weather.apparent)}°C · 강수 ${weather.rain}mm` ;$('#weather-source').textContent='실시간';$('#weather-header-label').textContent=`${city} · ${Math.round(weather.temp)}°C · ${description}`;$('#hero-weather-label').textContent=`${city} · ${Math.round(weather.temp)}°C · ${description}`;toast(`${city}의 현재 날씨를 반영했어요.`);renderRecommendations(true)}catch(error){console.warn('Weather lookup failed',error);$('#weather-main').textContent='날씨 조회 실패';$('#weather-sub').textContent='인터넷 연결을 확인하고 다시 시도해주세요.';$('#weather-source').textContent='조회 실패';toast('날씨 데이터를 가져오지 못했어요. 계절 기준 추천은 계속 이용할 수 있어요.')}finally{btn.disabled=false;btn.textContent='날씨 조회 ↗'}}
 async function exportBackup(){const json=JSON.stringify({version:2,createdAt:new Date().toISOString(),app:'MY FIT',imagePolicy:'official_or_catalog_quality',items:ownedItems(items),logs},null,2);const blob=new Blob([json],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`myfit-backup-${$today()}.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('옷장과 기록을 JSON 파일로 백업했어요.')}
 async function importBackup(file){if(!file)return;if(file.size>35*1024*1024){toast('백업 파일이 너무 큽니다.');return}try{const data=JSON.parse(await file.text());if(data.app!=='MY FIT'||!Array.isArray(data.items)||!Array.isArray(data.logs))throw new Error('올바른 MY FIT 백업이 아닙니다.');if(!confirm(`옷 ${data.items.length}개, 착장 기록 ${data.logs.length}개를 가져올까요? 현재 같은 ID의 항목은 덮어씁니다.`))return;for(const o of data.items){if(!o.id||!o.name||!categories[o.cat]||Boolean(o.isDemo))continue;hiddenPublishedIds.delete(String(o.id));const entry={id:String(o.id).slice(0,90),name:String(o.name).slice(0,50),brand:String(o.brand||'').slice(0,40),cat:o.cat,color:colors[o.color]?o.color:'other',season:['all','spring','summer','fall','winter'].includes(o.season)?o.season:'all',formality:['casual','smart','formal'].includes(o.formality)?o.formality:'casual',image:safeImg(o.image),additionalImages:additionalImages(o),photoLabels:Array.isArray(o.photoLabels)?o.photoLabels.slice(0,9).map(label=>String(label).slice(0,24)):[],sourceUrl:sourceUrl(o.sourceUrl),photoStatus:['brand','retailer','reference','pending'].includes(o.photoStatus)?o.photoStatus:'unverified',photoSourceName:String(o.photoSourceName||'').slice(0,90),photoNote:String(o.photoNote||'').slice(0,300),isDemo:Boolean(o.isDemo)};await dbReq('items','put',entry)}await dbReq('meta','put',{id:'published-closet-hidden',itemIds:[...hiddenPublishedIds]});for(const o of data.logs){if(!o.id||!/^\d{4}-\d{2}-\d{2}$/.test(o.date||''))continue;await dbReq('logs','put',{id:String(o.id).slice(0,90),date:o.date,destination:String(o.destination||'').slice(0,50),note:String(o.note||'').slice(0,240),itemIds:Array.isArray(o.itemIds)?o.itemIds.filter(x=>typeof x==='string').slice(0,20):[],photo:safeImg(o.photo)})}items=mergePublishedItems(await dbReq('items','getAll'));logs=await dbReq('logs','getAll');renderEverything();toast('백업 데이터를 가져왔어요.')}catch(error){console.warn('Import error',error);toast(`가져오기 실패: ${error.message||'파일 형식을 확인하세요.'}`)}}
 let publishedItems = [], hiddenPublishedIds = new Set(), publishedStatus = 'loading';
 function normalizeItem(o){
  if(!o||!o.id||!o.name||!categories[o.cat]||o.cat==='all'||o.isDemo)return null;
  return {id:String(o.id).slice(0,90),name:String(o.name).slice(0,50),brand:String(o.brand||'').slice(0,40),cat:o.cat,color:colors[o.color]?o.color:'other',season:['all','spring','summer','fall','winter'].includes(o.season)?o.season:'all',formality:['casual','smart','formal'].includes(o.formality)?o.formality:'casual',image:safeImg(o.image),additionalImages:additionalImages(o),photoLabels:Array.isArray(o.photoLabels)?o.photoLabels.slice(0,9).map(label=>String(label).slice(0,24)):[],sourceUrl:sourceUrl(o.sourceUrl),photoStatus:['brand','retailer','reference','pending'].includes(o.photoStatus)?o.photoStatus:'unverified',photoSourceName:String(o.photoSourceName||'').slice(0,90),photoNote:String(o.photoNote||'').slice(0,300),isDemo:false};
 }
 function mergePublishedItems(localItems){
  const merged=new Map(publishedItems.filter(item=>!hiddenPublishedIds.has(item.id)).map(item=>[item.id,item]));
  for(const item of ownedItems(localItems))if(!hiddenPublishedIds.has(item.id))merged.set(item.id,item);
  return sortItems([...merged.values()]);
 }
 async function publishedJson(path,timeoutMs=15000){
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{const response=await fetch(path,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('Published wardrobe unavailable');return await response.json()}finally{clearTimeout(timer)}
 }
 async function loadPublishedCloset(){
  let cache=null;
  try{cache=await dbReq('meta','get','published-closet-cache');const hidden=await dbReq('meta','get','published-closet-hidden');hiddenPublishedIds=new Set(Array.isArray(hidden?.itemIds)?hidden.itemIds:[])}catch(error){console.warn('Published wardrobe cache unavailable')}
  try{
   const manifest=await publishedJson('./published-closet.json');
   if(manifest.schemaVersion!==1||!/^\d{4}-[a-f0-9]{16}$/.test(manifest.revision||'')||!/^\.\/data\/wardrobe-[a-f0-9]{16}\.json$/.test(manifest.dataFile||''))throw new Error('Invalid published wardrobe manifest');
   const payload=cache?.revision===manifest.revision?cache:await publishedJson(manifest.dataFile,45000);
   if(payload.revision!==manifest.revision||!Array.isArray(payload.items)||payload.items.length>500)throw new Error('Invalid published wardrobe collection');
   publishedItems=payload.items.map(normalizeItem).filter(Boolean);publishedStatus='live';
   if(cache?.revision!==manifest.revision){try{await dbReq('meta','put',{id:'published-closet-cache',revision:manifest.revision,items:publishedItems})}catch(error){console.warn('Published wardrobe could not be cached')}}
  }catch(error){
   if(Array.isArray(cache?.items)){publishedItems=cache.items.map(normalizeItem).filter(Boolean);publishedStatus='cached'}else{publishedItems=[];publishedStatus='unavailable'}
   console.warn('Published wardrobe refresh unavailable');
  }
  items=mergePublishedItems(items);
  renderPublishedStatus();
 }
 function renderPublishedStatus(){
  const element=$('#published-closet-status');if(!element)return;
  element.textContent=publishedStatus==='live'?`공개 옷장 ${publishedItems.length}개 · 폰과 PC에서 같은 옷을 자동으로 불러와요.`:publishedStatus==='cached'?'오프라인 · 이 기기에 저장된 공개 옷장을 보여드려요.':publishedStatus==='unavailable'?'공개 옷장을 불러오지 못했어요. 인터넷 연결 후 새로고침해 주세요.':'공개 옷장을 불러오는 중이에요…';
 }
 async function hidePublishedItem(itemId){
  hiddenPublishedIds.add(itemId);
  await dbReq('meta','put',{id:'published-closet-hidden',itemIds:[...hiddenPublishedIds]});
 }

 function renderEverything(){renderCloset();renderFeatured();renderLogs();renderRecommendations(true)}
 function registerActions(){
  document.addEventListener('click',event=>{
   const route=event.target.closest('[data-route]');if(route){navigate(route.dataset.route);return}
   const filter=event.target.closest('[data-filter]');if(filter){if(filter.dataset.filterScope==='home-filters')activeHomeFilter=filter.dataset.filter;else activeClosetFilter=filter.dataset.filter;renderCloset();return}
   const viewItem=event.target.closest('[data-view-item]');if(viewItem){openItemDetail(viewItem.dataset.viewItem);return}
   const photo=event.target.closest('[data-item-photo]');if(photo){changeItemPhoto(Number(photo.dataset.itemPhoto));return}
   const removePhoto=event.target.closest('[data-remove-item-photo]');if(removePhoto){const index=Number(removePhoto.dataset.removeItemPhoto);tempItemAdditionalImages.splice(index,1);tempItemPhotoLabels.splice(index+1,1);renderAdditionalPhotos();return}
   const edit=event.target.closest('[data-edit-item]');if(edit){openItemModal(edit.dataset.editItem);return}
   if(event.target.closest('[data-add-item]')){openItemModal();return}
   if(event.target.closest('[data-add-log]')){openLogModal();return}
   const save=event.target.closest('[data-save-outfit]');if(save){const rec=recommendations[Number(save.dataset.saveOutfit)];if(rec){openLogModal(rec.items.map(i=>i.id));$('#log-note').value=`${rec.title} · ${rec.explain}`;}return}
   const close=event.target.closest('[data-close]');if(close){closeModal(close.dataset.close);return}
   const del=event.target.closest('[data-delete-log]');if(del){deleteLog(del.dataset.deleteLog);return}
   if(event.target.matches('.overlay'))closeModal(event.target.id);
   const viewLog=event.target.closest('[data-view-log]');if(viewLog){navigate('diary');return}
  });
  window.addEventListener('keydown',event=>{if(event.key==='Escape')$$('.overlay:not([hidden])').forEach(el=>closeModal(el.id))});
  window.addEventListener('keydown',event=>{if($('#item-detail-modal').hidden)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();changeItemPhoto(detailPhotoIndex+(event.key==='ArrowRight'?1:-1))}});
  $('#item-photo-prev').addEventListener('click',()=>changeItemPhoto(detailPhotoIndex-1));
  $('#item-photo-next').addEventListener('click',()=>changeItemPhoto(detailPhotoIndex+1));
  $('#item-detail-edit').addEventListener('click',()=>{closeModal('item-detail-modal');openItemModal(detailItemId)});
  $('#item-additional-trigger').addEventListener('click',()=>$('#item-additional-photos').click());
  $('#item-additional-photos').addEventListener('change',async event=>{
   const files=[...event.target.files||[]];event.target.value='';if(!files.length)return;
   if(tempItemAdditionalImages.length+files.length>8){toast('뒷면·상세 사진은 최대 8장까지 추가할 수 있어요.');return}
   const submit=$('#item-form [type="submit"]');submit.disabled=true;$('#item-photos-status').textContent='사진을 준비하고 있어요…';
   try{const photos=[];for(const file of files)photos.push(await imageFromFile(file));tempItemAdditionalImages.push(...photos);renderAdditionalPhotos();$('#item-photos-status').textContent='사진을 추가했어요. 저장하면 반영됩니다.'}catch(error){$('#item-photos-status').textContent=error.message;toast(error.message)}finally{submit.disabled=false}
  });
  window.addEventListener('hashchange',()=>showRoute(location.hash.slice(1)||'home'));
  $('#mobile-toggle').addEventListener('click',()=>{const menu=$('#mobile-nav');menu.hidden=!menu.hidden;$('#mobile-toggle').setAttribute('aria-expanded',String(!menu.hidden))});
  $('#feature-next').addEventListener('click',()=>{activeFeature=(activeFeature+1)%Math.max(1,makeRecommendations().length);renderFeatured()});
  $('#feature-prev').addEventListener('click',()=>{activeFeature=(activeFeature+Math.max(1,makeRecommendations().length)-1)%Math.max(1,makeRecommendations().length);renderFeatured()});
  $('#feature-like').addEventListener('click',()=>{const saved=JSON.parse(localStorage.getItem('myfit-favourites')||'[]');const next=saved.includes(activeFeature)?saved.filter(n=>n!==activeFeature):[...saved,activeFeature];localStorage.setItem('myfit-favourites',JSON.stringify(next));renderFeatured();toast(next.includes(activeFeature)?'스타일을 관심 목록에 저장했어요.':'관심 목록에서 제거했어요.')});
  $('#feature-use').addEventListener('click',()=>navigate('stylist'));
  $('#hero-recommend').addEventListener('click',toStylist);
  $('#home-add-item').addEventListener('click',()=>openItemModal());
  $('#closet-add').addEventListener('click',()=>openItemModal());
  $('#diary-add').addEventListener('click',()=>openLogModal());
  $('#open-about').addEventListener('click',()=>openModal('about-modal'));
  $('#closet-search').addEventListener('input',renderCloset);
  $('#diary-sort').addEventListener('change',renderArchive);
  $('#item-form').addEventListener('submit',saveItem);
  $('#log-form').addEventListener('submit',saveLog);
  $('#item-photo').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{tempItemImage=await imageFromFile(file);$('#item-preview').innerHTML=`<img src="${tempItemImage}" alt="선택한 의류 사진 미리보기" /><span style="position:absolute;bottom:5px;background:#fff9;padding:3px 9px;font-size:11px">사진 변경하기 ↗</span>`}catch(e){toast(e.message)}});
  $('#log-photo').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{tempLogImage=await imageFromFile(file);$('#log-photo-preview').innerHTML=`<img src="${tempLogImage}" alt="착장 사진 미리보기" /><small>클릭해서 사진 변경</small>`}catch(e){toast(e.message)}});
  $('#log-item-choices').addEventListener('change',event=>{const label=event.target.closest('label');if(label)label.classList.toggle('selected',event.target.checked)});
  $('#generate-looks').addEventListener('click',()=>{renderRecommendations(true);toast(`내 옷에서 ${recommendations.length}가지 조합을 골랐어요.`);});
  $('#weather-refresh').addEventListener('click',refreshWeather);
  $('#header-weather').addEventListener('click',()=>{navigate('stylist');refreshWeather()});
  $('#hero-weather').addEventListener('click',()=>{navigate('stylist');refreshWeather()});
  $('#stylist-purpose').addEventListener('change',()=>renderRecommendations(true));
  $('#stylist-destination').addEventListener('change',()=>renderRecommendations(true));
  $('#city').addEventListener('change',()=>{weather=null;$('#weather-source').textContent='다시 조회 필요';$('#weather-main').textContent='새 지역의 날씨를 조회해주세요.';$('#weather-header-label').textContent=`${$('#city').value} · 날씨 조회`;$('#hero-weather-label').textContent=`${$('#city').value} · 날씨 조회`;$('#weather-sub').textContent='기존 날씨는 추천에 사용하지 않습니다.';renderRecommendations(true)});
  $$('#mood-options input').forEach(el=>el.addEventListener('change',()=>renderRecommendations(true)));
  $('#export-data').addEventListener('click',exportBackup);
  const importButton=document.createElement('button');importButton.id='import-data';importButton.type='button';importButton.textContent='↥ 백업 불러오기';const importInput=document.createElement('input');importInput.type='file';importInput.accept='.json,application/json';importInput.hidden=true;$('#export-data').before(importButton,importInput);importButton.addEventListener('click',()=>importInput.click());importInput.addEventListener('change',e=>{importBackup(e.target.files?.[0]);e.target.value=''});
 }
 async function init(){registerActions();await loadData();await loadPublishedCloset();renderEverything();showRoute(location.hash.slice(1)||'home');}
 init().catch(error=>{console.error(error);toast('화면을 준비하는 중 문제가 발생했어요. 페이지를 다시 열어주세요.')});
})();
