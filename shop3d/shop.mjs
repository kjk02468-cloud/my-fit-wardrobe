import * as T from './vendor/three.module.min.js';
import {createWorld} from './world.mjs';
import {FITTING_MARK, SPACE_ENTRIES, applyCameraLens, tourPose} from './layout.mjs';
import {prepareScrollTrigger, bindEntryScroll} from './scroll-entry.mjs';
import {photoPreview} from './ai-preview.mjs';
import {ZONES,STATES,introPose,mapping,selectionFor,signature,reconcile,snapshot,SaveStore,LatestSelection,clamp,fragranceMatches} from './core.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slots={top:'이너 상의',middle:'셔츠·니트·베스트',outer:'아우터',bottom:'하의',shoes:'신발',bag:'가방',accessory:'모자'};
const cats={all:'전체',outer:'아우터',top:'상의',bottom:'하의',shoes:'신발',bag:'가방',accessory:'액세서리',eyewear:'아이웨어',fragrance:'향수'};
const zoneLabels = {
 showroom: {number:'01', title:'메인 쇼룸', description:'보유 의류와 액세서리'},
 fitting: {number:'02', title:'독립 피팅룸', description:'3D 착용과 코디 편집'},
 fragrance: {number:'03', title:'향수 바', description:'등록 향조와 코디 연결'},
 concierge: {number:'04', title:'스타일 상담', description:'계절과 목적에 맞는 조합'},
 ootd: {number:'05', title:'OOTD 스튜디오', description:'코디 촬영과 착장 기록'},
};
const fittingCategories = {top:'상의', outer:'아우터', bottom:'하의', shoes:'신발', extras:'소품'};
const fitCategoryFor = item => ['bag','accessory'].includes(item.cat) ? 'extras' : item.cat;
const zoneOrder = Object.keys(zoneLabels);
export async function mountShop(root,bridge){
 let entryScroll = null;
 let fitViewport;
 let previousLocation;
 let roomReturn = null;
 let travelProgress = 0;
 const lookOffset = {yaw:0,pitch:0};
 let sceneDirty = true;
 let drawnView = '';
 let state='CLASSIC_2D',active=false,frame=0,last=0,pointer=null,pose=introPose(0),fitReturn=null,orbit={yaw:0,pitch:.08,radius:2.6};
 let fit={},fragrance=null,avatar=null,garments=null,avatarLoading=null,parts={},ab=null,query='',category='all',panelMode='',previousState='',metrics={frames:0,ms:0},contextLost=false,introDone=false;
 let fitGeneration=0;
 let drawerTrigger=null, navigationGeneration=0, fittingCategory='top';
 const store=new SaveStore({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)}),latest=new LatestSelection(),own=()=>bridge.getItems(),get=id=>own().find(i=>i.id===id),selectCache=new Map();
 root.innerHTML=`<canvas id="shop-canvas" tabindex="0" aria-label="MY FIT 3D 공간"></canvas>
 <div id="shop-tour" class="shop-tour" hidden tabindex="0" aria-label="스크롤해서 쇼룸 둘러보기"><div class="shop-tour-track"></div></div>
 <div id="shop-hotspots" role="group" aria-label="현재 보이는 매장 구역과 상품"></div>
 <header id="shop-top">
  <div class="shop-brand"><strong>MY FIT</strong><small>PRIVATE MENSWEAR STUDIO</small></div>
  <div class="shop-top-tools">
   <button data-act="zones" aria-controls="shop-panel" aria-expanded="false">구역</button>
   <button data-act="list" aria-label="전체 상품"><span class="shop-wide-label">전체 </span>상품</button>
   <button id="shop-edit" data-act="edit-fit" aria-controls="shop-panel" aria-expanded="false">룩 편집</button>
   <a href="#closet" aria-label="일반 2D 보기"><span class="shop-wide-label">일반 </span>2D<span class="shop-wide-label"> 보기</span> ↗</a>
  </div>
 </header>
 <div id="shop-status" role="status"><small></small><strong></strong><span></span></div>
 <div id="shop-notice" role="status" aria-live="polite"></div><button id="shop-near" data-act="near">보유품 둘러보기</button>
 <aside id="shop-panel" hidden aria-label="매장 도구"></aside>
 <nav class="shop-nav" aria-label="구역 바로 이동">
  <span class="shop-dock-note">MY FIT <i>/</i> 3D EDIT SHOP</span>
  <div>${zoneOrder.map(id=>`<button data-zone="${id}"><small>${zoneLabels[id].number}</small>${esc(ZONES[id].label)}</button>`).join('')}</div>
  <span class="shop-dock-tip">스크롤로 이동 · 좌우로 둘러보기</span>
 </nav>
 <details class="shop-help"><summary>둘러보기 안내</summary><p>휠을 굴리거나 위아래로 밀어 이동하세요.<br>좌우로 드래그하면 시점이 돌아갑니다.<br>공간 이름이나 상품을 누르면 열립니다.<br>Esc로 패널을 닫습니다.</p><div class="shop-help-actions"><button data-act="reset">위치 초기화</button><button data-act="previous-location">이전 위치</button><button data-act="replay">입장 다시 보기</button><button data-act="quality">그림자 켜기/끄기</button></div><p id="shop-position"></p><p id="shop-performance"></p></details>
 <div id="shop-turn" role="group" aria-label="아바타 시점">
  <button data-fit-view="front" aria-pressed="true">정면</button><button data-fit-view="side" aria-pressed="false">측면</button><button data-fit-view="back" aria-pressed="false">후면</button>
  <button data-fit-view="rotate" aria-label="45도씩 360도 둘러보기">360°</button><button data-fit-view="in" aria-label="확대">＋</button><button data-fit-view="out" aria-label="축소">−</button><button data-fit-view="reset" aria-label="기본 시점">복귀</button>
 </div>
 <button id="shop-fit-exit" data-act="exit-fit">매장으로 ↗</button>
 <div id="shop-intro" class="shop-intro" hidden tabindex="0" aria-label="스크롤로 매장에 입장">
  <div class="shop-intro-track"><div class="shop-intro-copy"><span>PRIVATE MENSWEAR STUDIO / 01</span><h1>Your personal<br>select shop.</h1><p>내 옷으로 채운 편집샵.<br>스크롤해서 매장 안으로 들어오세요.</p></div></div>
 </div>
 <button id="shop-skip" data-act="skip" hidden>바로 입장하기 <span aria-hidden="true">↗</span></button><div id="shop-progress" hidden></div>`;
 const $=s=>root.querySelector(s),canvas=$('#shop-canvas'),panel=$('#shop-panel'),intro=$('#shop-intro');
 const tour=$('#shop-tour'),hotspots=$('#shop-hotspots');
 const renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=innerWidth>700;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 renderer.shadowMap.autoUpdate = false;
 renderer.shadowMap.needsUpdate = true;
 $('#shop-status strong').textContent = '매장을 준비하고 있어요';
 let world, ScrollTrigger;
 try {
  [world,ScrollTrigger] = await Promise.all([createWorld(renderer),prepareScrollTrigger()]);
 } catch (error) {
  renderer.dispose();
  throw error;
 }
 world.setNight(false);
 const camera = new T.PerspectiveCamera(58,1,.06,75);
 const fitCamera = new T.PerspectiveCamera(44,1,.045,40);
 const fitTarget = new T.Vector3(...FITTING_MARK).add(new T.Vector3(0,.94,0));
 const ray = new T.Raycaster();
 world.setProducts(own());
 let noticeTimer;function notice(text){clearTimeout(noticeTimer);$('#shop-notice').textContent=text;if(text&&!/실패|못했|오류|끊겼/.test(text))noticeTimer=setTimeout(()=>$('#shop-notice').textContent='',6500);}
 function clearInput(){pointer=null;}
 function setState(next){
  if(!STATES.includes(next))throw Error('Invalid state');
  clearInput();
  state=next;
  root.dataset.state=state;
  root.dataset.rendererCount='1';
  tour.hidden=state!=='STORE_EXPLORE';
  hotspots.hidden=tour.hidden;
  if(!tour.hidden) tour.scrollTop=travelProgress*(tour.scrollHeight-tour.clientHeight);
  updateStatus();
 }
 function updateStatus(){
  const zone = ({FITTING:'fitting',CONCIERGE:'concierge',FRAGRANCE:'fragrance',OOTD:'ootd'})[state] || (zoneLabels[panelMode] ? panelMode : 'showroom');
  const label = zoneLabels[zone];
  $('#shop-status small').textContent = `${label.number} / ${ZONES[zone].name}`;
  $('#shop-status strong').textContent = zone === 'fitting' ? '내 피팅룸' : label.title;
  const count = Object.keys(fit).length;
  $('#shop-status span').textContent = count || fragrance ? `선택 ${count}개${fragrance?' + 향수':''}` : '';
  for (const button of root.querySelectorAll('.shop-nav [data-zone]')) {
   if (button.dataset.zone === zone) button.setAttribute('aria-current','location');
   else button.removeAttribute('aria-current');
  }
 }
 // CSS pixels, top-left origin. Shared by the projection, renderer and image export.
 function getFittingViewport(){
  const bounds = root.getBoundingClientRect();
  const narrow = bounds.width <= 700;
  const drawer = panel.hidden ? null : panel.getBoundingClientRect();
  const header = $('#shop-top').getBoundingClientRect();
  const controls = $('#shop-turn').getBoundingClientRect();
  return {
   x:0, y:header.bottom-bounds.top,
   width:Math.max(1,drawer&&!narrow?drawer.left-bounds.left:bounds.width),
   height:Math.max(1,controls.top-header.bottom-4),
  };
 }
 function resize(){
  const width = root.clientWidth || innerWidth;
  const height = root.clientHeight || innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio,width<=700?1.0:1.25));
  renderer.setSize(width,height,false);
  camera.aspect = width/height;
  applyCameraLens(camera, pose.focalLengthMm ? pose : introPose(1));
  fitViewport = getFittingViewport();
  fitCamera.aspect = fitViewport.width/fitViewport.height;
  fitCamera.updateProjectionMatrix();
  sceneDirty = true;
 }
 function start(){if(!frame&&active&&!document.hidden&&!contextLost){sceneDirty=true;last=performance.now();frame=requestAnimationFrame(tick);}}
 function tick(now){
  frame=0;
  if(!active||document.hidden||contextLost)return;
  const elapsed=Math.max(0,now-last);
  last=now;
  const fitting = state === 'FITTING' || (state === 'ITEM_DETAIL' && previousState === 'FITTING');
  world.setFitting(fitting);
  world.setReflection(!fitting && widthAllowsMirror() && pose.x < -2 && pose.z < -13.3);
  const width = root.clientWidth;
  const height = root.clientHeight;
  const view = fitting
   ? `fit/${orbit.yaw}/${orbit.pitch}/${orbit.radius}/${fitViewport.width}/${fitViewport.height}`
   : `walk/${pose.x}/${pose.y}/${pose.z}/${pose.yaw}/${pose.pitch}/${pose.focalLengthMm}/${pose.door}`;
  const viewKey = view + '/' + renderer.shadowMap.enabled;
  if (!sceneDirty && drawnView === viewKey) {
   if (elapsed > 150) metrics = {frames:0,ms:0};
   frame = requestAnimationFrame(tick);
   return;
  }
  sceneDirty = false;
  drawnView = viewKey;
  if (avatar) avatar.rotation.y = fitting ? -orbit.yaw : 0;
  if (fitting) {
   fitCamera.position.set(fitTarget.x, fitTarget.y + Math.sin(orbit.pitch)*orbit.radius, fitTarget.z + Math.cos(orbit.pitch)*orbit.radius);
   fitCamera.lookAt(fitTarget);
   const {x,y,width:fitWidth,height:fitHeight} = fitViewport;
   renderer.setViewport(0,0,width,height);
   renderer.clear();
   renderer.setViewport(x,height-y-fitHeight,fitWidth,fitHeight);
   renderer.setScissor(x,height-y-fitHeight,fitWidth,fitHeight);
   renderer.setScissorTest(true);
   renderer.render(world.scene,fitCamera);
   renderer.setScissorTest(false);
  } else {
   camera.position.set(pose.x,pose.y,pose.z);
   camera.rotation.order = 'YXZ';
   camera.rotation.set(pose.pitch || 0,pose.yaw,0);
   applyCameraLens(camera,pose.focalLengthMm ? pose : introPose(1));
   camera.updateMatrixWorld();
   if(state==='STORE_EXPLORE') positionHotspots(width,height);
   renderer.setViewport(0,0,width,height);
   renderer.render(world.scene,camera);
  }
  metrics.frames++;metrics.ms+=elapsed;if(metrics.ms>1000){$('#shop-position').textContent=`위치 ${pose.x.toFixed(2)}, ${pose.z.toFixed(2)} · 방향 ${pose.yaw.toFixed(2)} · ${state}`;$('#shop-performance').textContent=`${Math.round(metrics.frames*1000/metrics.ms)} fps · ${renderer.info.render.calls} draw calls · ${renderer.info.render.triangles.toLocaleString()} triangles · DPR ${renderer.getPixelRatio()}`;metrics={frames:0,ms:0};if(state==='STORE_EXPLORE')$('#shop-near').textContent=ZONES[nearest()].label+' 이용하기';}
  frame=requestAnimationFrame(tick);
 }
 function widthAllowsMirror(){return root.clientWidth >= 1024;}
 const spatialButtons=Object.entries(SPACE_ENTRIES).map(([zone,anchor])=>{
  const button=document.createElement('button');
  button.type='button';button.className='shop-spatial-entry';button.dataset.zone=zone;
  button.textContent=ZONES[zone].label+' ↗';button.hidden=true;
  hotspots.append(button);
  return {button,anchor:new T.Vector3(...anchor)};
 });
 const viewPoint=new T.Vector3();
 function positionHotspots(width,height){
  for(const {button,anchor} of spatialButtons){
   const p=viewPoint.copy(anchor).project(camera);
   const distance=camera.position.distanceTo(anchor);
   button.hidden = distance>9 || p.z<0 || p.z>1 || Math.abs(p.x)>.80 || p.y<-.64 || p.y>.69;
   if(button.hidden) continue;
   button.style.left=(p.x*.5+.5)*width+'px';
   button.style.top=(.5-p.y*.5)*height+'px';
  }
 }
 function drawTour(){
  pose=tourPose(travelProgress);
  pose.yaw+=lookOffset.yaw;
  pose.pitch+=lookOffset.pitch;
  sceneDirty=true;
 }
 function resetTour(){
  travelProgress=0;
  lookOffset.yaw=lookOffset.pitch=0;
  tour.scrollTop=0;
  drawTour();
 }
 function restoreRoomView(){
  if(!roomReturn) return;
  pose=roomReturn;
  roomReturn=null;
  sceneDirty=true;
 }
 tour.addEventListener('scroll',()=>{
  if(state!=='STORE_EXPLORE'||tour.inert)return;
  const extent=Math.max(1,tour.scrollHeight-tour.clientHeight);
  const progress=clamp(tour.scrollTop/extent,0,1);
  if(Math.abs(progress-travelProgress)<.00001)return;
  travelProgress=progress;
  drawTour();
 },{passive:true});
 hotspots.addEventListener('wheel',event=>{
  if(state!=='STORE_EXPLORE'||tour.inert)return;
  event.preventDefault();
  tour.scrollTop+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?tour.clientHeight:1);
 },{passive:false});
 function nearest(){return Object.keys(ZONES).sort((a,b)=>Math.hypot(pose.x-ZONES[a].position[0],pose.z-ZONES[a].position[2])-Math.hypot(pose.x-ZONES[b].position[0],pose.z-ZONES[b].position[2]))[0];}
 let displayVersion = 0;
 async function updateDisplays(){
  const version = ++displayVersion;
  try {
   const models = await import('./garments.mjs');
   if (version !== displayVersion) return;
   world.setGarmentDisplays(own(),item => models.garment(item, undefined, {display:true}),models.disposeGroup);
   sceneDirty = true;
   renderer.shadowMap.needsUpdate = true;
  } catch(error) {
   console.warn(error);
   notice('대표 전시 모델 준비에 실패했어요. 상품 목록은 이용할 수 있어요.');
  }
 }
 function drawIntro(progress){
  pose = introPose(progress);
  world.setDoor(pose.door);
  renderer.shadowMap.needsUpdate = true;
  $('#shop-progress').textContent = Math.round(progress*100)+'% · SCROLL TO ENTER';
 }
 function clearEntryScroll(){entryScroll?.kill();entryScroll = null;}
 function finishIntro(){
  clearEntryScroll();
  introDone = true;
  drawIntro(1);
  resetTour();
  intro.hidden = true;
  $('#shop-skip').hidden = true;
  $('#shop-progress').hidden = true;
  setState('STORE_EXPLORE');
  tour.focus({preventScroll:true});
 }
 function replay(){
  clearEntryScroll();
  closePanel();
  introDone = false;
  intro.hidden = false;
  $('#shop-skip').hidden = false;
  $('#shop-progress').hidden = false;
  intro.scrollTop = 0;
  setState('INTRO_SCROLL');
  drawIntro(0);
  entryScroll = bindEntryScroll(ScrollTrigger,intro,drawIntro,finishIntro);
  intro.focus();
 }
 function panelHead(title){
  const section=zoneLabels[panelMode];
  const eyebrow=section?`${section.number} / ${ZONES[panelMode].name}`:'MY FIT / PERSONAL SPACE';
  return `<div class="shop-panel-head"><div><small>${esc(eyebrow)}</small><h2 id="shop-drawer-title">${esc(title)}</h2></div><button data-act="close" aria-label="패널 닫기">×</button></div>`;
 }
 function updateDrawerState(){
  root.dataset.panel=panel.hidden?'':panelMode;
  root.dataset.panelOpen=String(!panel.hidden);
  tour.inert=!panel.hidden;
  $('[data-act="zones"]').setAttribute('aria-expanded',String(!panel.hidden&&panelMode==='zones'));
  $('#shop-edit').setAttribute('aria-expanded',String(!panel.hidden&&panelMode==='fitting'));
 }
 function showPanel(title,html){
  const focused=document.activeElement;
  const refresh=!panel.hidden&&root.dataset.panel===panelMode;
  const scroll=refresh?panel.scrollTop:0;
  const selectedAction=refresh&&panel.contains(focused)?{...focused.dataset}:null;
  const selectedId=refresh&&panel.contains(focused)?focused.id:'';
  if(!refresh&&!panel.contains(focused))drawerTrigger=focused;
  panel.setAttribute('aria-labelledby','shop-drawer-title');
  panel.innerHTML=panelHead(title)+html;
  panel.hidden=false;
  updateDrawerState();
  panel.scrollTop=scroll;
  let focusTarget=selectedId?document.getElementById(selectedId):null;
  if(!focusTarget&&selectedAction&&Object.keys(selectedAction).length){
   focusTarget=[...panel.querySelectorAll('button')].find(button=>Object.entries(selectedAction).every(([key,value])=>button.dataset[key]===value));
  }
  if(focusTarget)focusTarget.focus({preventScroll:true});
  else if(!refresh||selectedAction)panel.querySelector('[data-act="close"]')?.focus({preventScroll:true});
  resize();
 }
 function hidePanel(){
  panelMode='';
  panel.hidden=true;
  updateDrawerState();
 }
 function dismissPanel(){
  const trigger=drawerTrigger;
  drawerTrigger=null;
  hidePanel();
  if(state!=='FITTING'&&active){restoreRoomView();setState('STORE_EXPLORE');}
  resize();
  const fallback=state==='FITTING'?$('#shop-edit'):tour;
  (trigger?.isConnected&&trigger.getClientRects().length?trigger:fallback).focus({preventScroll:true});
 }
 function closePanel(){
  navigationGeneration++;
  drawerTrigger=null;
  hidePanel();
  if(fitReturn){pose={...fitReturn};fitReturn=null;}
  restoreRoomView();
  if(active){setState('STORE_EXPLORE');tour.focus({preventScroll:true});}
  resize();
 }
 function renderZones(){
  if(!introDone)finishIntro();
  panelMode='zones';
  clearInput();
  showPanel('공간 둘러보기',`<p class="shop-lead">원하는 구역을 선택해 이동하세요.</p><div class="shop-zone-list">${zoneOrder.map(id=>{
   const zone=zoneLabels[id];
   return `<button data-zone="${id}"><small>${zone.number}</small><span><strong>${zone.title}</strong><em>${zone.description}</em></span><span aria-hidden="true">›</span></button>`;
  }).join('')}</div><div class="shop-buttons"><button data-act="reset">위치 초기화</button><button data-act="replay">입장 다시 보기</button></div>`);
 }
 async function ensureAvatar(){
  if (avatar) return;
  if (!avatarLoading) avatarLoading = (async () => {
   garments = await import('./garments.mjs');
   await garments.prepareFittingAssets(renderer);
   avatar = garments.mannequin();
   avatar.position.set(...FITTING_MARK);
   world.scene.add(avatar);
   sceneDirty = true;
  })();
  try { await avatarLoading; } finally { avatarLoading = null; }
 }
 function syncLayers(){
  if (avatar) garments.syncFittingLayers(avatar,parts);
  sceneDirty = true;
 }
 async function wear(itemId,side){fitGeneration++;const item=get(itemId);if(!item)return notice('삭제된 품목이에요. 상품 목록을 새로 확인해주세요.');let sel;try{sel=selectionFor(item,side);}catch(e){notice(e.message);return;}const slot=sel.slot;
  try {
   notice('의상을 준비하고 있어요…');
   await latest.run(slot, async () => {
    await ensureAvatar();
    await garments.prepareGarment(item,sel.side);
    return garments.garment(item,sel.side,{avatar});
   }, group => {
    const current = get(itemId);
    if (!current || signature(current) !== sel.signature) {
     garments.disposeGroup(group);
     return;
    }
    if (parts[slot]) garments.disposeGroup(parts[slot]);
    parts[slot] = group;
    avatar.add(group);
    fit[slot] = sel;
    syncLayers();
    notice('3D 착용을 적용했어요.');
    if (panelMode === 'fitting') renderFitting();
    updateStatus();
   },garmentsResult => garments.disposeGroup(garmentsResult));
  }
  catch(e){notice('의상을 불러오지 못했어요. 직전 조합을 유지했어요. 상품의 피팅 버튼으로 다시 시도해주세요.');console.warn(e);}
 }
 function strip(slot){latest.tokens[slot]=(latest.tokens[slot]||0)+1;if(parts[slot]){garments.disposeGroup(parts[slot]);delete parts[slot];}delete fit[slot];syncLayers();updateStatus();}
 async function applyFit(next){
  const generation = ++fitGeneration;
  latest.cancel();
  await ensureAvatar();
  const requested = reconcile(next,own());
  await Promise.all(Object.values(requested.fit).map(ref => garments.prepareGarment(get(ref.itemId),ref.side)));
  if (generation !== fitGeneration) return;
  const clean = reconcile(requested.fit,own());
  const built = {};
  try {
   for (const [slot,ref] of Object.entries(clean.fit)) {
    built[slot] = garments.garment(get(ref.itemId),ref.side,{avatar});
   }
  } catch(error) {
   Object.values(built).forEach(garments.disposeGroup);
   throw error;
  }
  for (const slot of Object.keys(parts)) strip(slot);
  for (const [slot,group] of Object.entries(built)) {
   avatar.add(group);
   parts[slot] = group;
  }
  fit = clean.fit;
  syncLayers();
  const adjusted = requested.removed.length || requested.changed.length || clean.removed.length || clean.changed.length;
  notice(adjusted ? '변경·삭제된 품목을 정리했어요. 현재 상품 정보로 다시 확인해주세요.' : '코디를 불러왔어요.');
  updateStatus();
 }
 function selectedHTML(){
  return Object.entries(fit).map(([slot,p])=>`<div class="shop-selected">
   <div><small>${esc(slots[slot])} · ${esc(p.side)}</small><p>${esc(get(p.itemId)?.name||'삭제된 아이템')}</p></div>
   <button class="shop-action" data-remove="${slot}">벗기</button>
  </div>`).join('')||'<p>선택한 옷이 없어요. 기본 복장 상태입니다.</p>';
 }
 function fittingCard(item,model){
  const current=fit[model.slot];
  const applied=side=>current?.itemId===item.id&&current.side===side;
  const detail=model.level==='PRODUCT_BASED'?'제품 기반 모델':'유사 실루엣';
  const photo=item.image?`<img src="${esc(item.image)}" alt="" loading="lazy" decoding="async">`:'<span class="shop-fit-placeholder" aria-hidden="true">MY FIT</span>';
  const text=`<span class="shop-fit-caption"><strong>${esc(item.name)}</strong><small>${esc(detail)}</small></span>`;
  const first=model.sides[0];
  if(model.sides.length===1){
   return `<button class="shop-fit-card" data-wear="${esc(item.id)}" data-side="${esc(first)}" aria-pressed="${applied(first)}">${photo}${text}</button>`;
  }
  return `<article class="shop-fit-card shop-fit-card-reversible">${photo}${text}<div>${model.sides.map(side=>`<button data-wear="${esc(item.id)}" data-side="${esc(side)}" aria-pressed="${applied(side)}">${esc(side)}</button>`).join('')}</div></article>`;
 }
 function renderFitting(){
  const currentTab=fittingCategory;
  const models=own().filter(item=>fitCategoryFor(item)===currentTab)
   .map(item=>({item,model:mapping(item)})).filter(({model})=>model.level!=='UNSUPPORTED');
  const activeNames=Object.values(fit).map(p=>get(p.itemId)?.name).filter(Boolean);
  const selectedOpen=$('#shop-selected-detail')?.open||false;
  const previousCatalog=$('.shop-fit-catalog');
  const previousTab=$('.shop-fit-tabs [aria-pressed="true"]')?.dataset.fitCategory;
  const scrollLeft=previousTab===currentTab?(previousCatalog?.scrollLeft||0):0;
  const scrollTop=previousTab===currentTab?(previousCatalog?.scrollTop||0):0;
  panelMode='fitting';
  showPanel('룩 편집',`
   <p class="shop-lead">내 옷을 골라 전신 실루엣을 비교하세요.</p>
   <div class="shop-fit-tabs" role="group" aria-label="피팅 의류 분류">${Object.entries(fittingCategories).map(([key,label])=>`<button data-fit-category="${key}" aria-pressed="${currentTab===key}">${label}</button>`).join('')}</div>
   <div class="shop-fit-catalog" aria-label="착용할 보유품">${models.map(({item,model})=>fittingCard(item,model)).join('')||'<p>이 분류에 3D 착용 가능한 보유품이 없어요.</p>'}</div>
   <p class="shop-fit-summary"><span>${activeNames.length?'적용된 룩':'기본 복장'}</span> ${esc(activeNames.join(' · '))}</p>
   <div class="shop-fit-primary"><button data-act="${ab?'ab-swap':'ab-store'}">${ab?'A/B 비교':'A로 보관'}</button><button class="shop-action primary" data-act="save">룩 저장</button></div>
   <details id="shop-selected-detail" ${selectedOpen?'open':''}><summary>현재 조합 · 착용 해제</summary>${selectedHTML()}<p>향수 · ${esc(get(fragrance)?.name||'선택 안 함')}</p>
   <div class="shop-buttons"><button data-zone="fragrance">향수 고르기</button><button data-act="reset-fit">조합 초기화</button><button data-act="capture">가상 착장 이미지 저장</button>${ab?'<button data-act="ab-store">현재 룩을 A로 보관</button>':''}</div></details>
   <details><summary>3D 피팅 안내</summary><p>고정 포즈의 기준 아바타로 스타일·색상·실루엣을 확인해요. 개인 실측이나 제품별 실제 착용감을 보장하지 않아요.</p><p>실사 AI 피팅 · ${esc(photoPreview.status)}</p></details>
  `);
  $('.shop-fit-catalog').scrollTo(scrollLeft,scrollTop);
 }
 function productsHTML(list){return list.map(i=>{const m=mapping(i);return `<article class="shop-product"><img src="${esc(i.image||'')}" alt="${esc(i.name)}" loading="lazy"><div><strong>${esc(i.name)}</strong><small class="shop-support">${m.level==='APPROXIMATE'?'유사 실루엣':i.cat==='fragrance'?'향수 정보로 연결':'3D 착용 미지원'} · ${i.aiEdited?'AI 보정 대표 사진':'원본/등록 사진'}</small><div class="shop-buttons"><button data-detail="${esc(i.id)}">상세·사진</button>${m.level!=='UNSUPPORTED'?m.sides.map(s=>`<button data-wear="${esc(i.id)}" data-side="${s}">${s==='기본'?'피팅에 담기':s}</button>`).join(''):''}</div></div></article>`;}).join('');}
 function renderList(){const counts=own().reduce((r,i)=>(r[mapping(i).level]++,r),{PRODUCT_BASED:0,APPROXIMATE:0,UNSUPPORTED:0});showPanel('전체 상품',`<p class="shop-lead">보유품 ${own().length}개 · 제품 기반 ${counts.PRODUCT_BASED} · 유사 실루엣 ${counts.APPROXIMATE} · 착용 미지원 ${counts.UNSUPPORTED}</p><div class="shop-list-filters"><label class="shop-field">상품 검색<input id="shop-search" type="search" value="${esc(query)}" placeholder="브랜드 또는 이름"></label><label class="shop-field">분류<select id="shop-category">${Object.entries(cats).map(([k,v])=>`<option value="${k}" ${category===k?'selected':''}>${v}</option>`).join('')}</select></label></div><button class="shop-action primary" data-act="fit">선택한 옷으로 피팅룸 →</button><div id="shop-products" class="shop-products"></div>`);filterProducts();}
 function filterProducts(){const list=own().filter(i=>(category==='all'||i.cat===category)&&(`${i.name} ${i.brand}`.toLowerCase().includes(query.toLowerCase())));$('#shop-products').innerHTML=productsHTML(list)||'<p>조건에 맞는 보유품이 없어요.</p>';}
 async function openCollection(){
  if(state!=='FITTING'){await enter('showroom');return;}
  panelMode='showroom';
  renderList();
 }
 function renderConcierge(){
  const pinned=own().filter(i=>mapping(i).level!=='UNSUPPORTED')
   .map(i=>`<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('');
  showPanel('스타일 상담',`
   <p class="shop-lead">날씨와 외출 목적에 맞춰 기존 보유품 컬렉션에서 조합을 고릅니다.</p>
   <div class="shop-form-pair">
    <label class="shop-field">기온 °C<input id="shop-temp" type="number" min="-30" max="50" placeholder="계절 기준" value="${bridge.getWeather()?.temp??''}"></label>
    <label class="shop-field">계절<select id="shop-season"><option value="fall">가을</option><option value="spring">봄</option><option value="summer">여름</option><option value="winter">겨울</option></select></label>
    <label class="shop-field">목적지<select id="shop-destination"><option>도심</option><option>카페</option><option>사무실</option><option>야외</option><option>행사장</option></select></label>
    <label class="shop-field">외출 목적<select id="shop-purpose"><option value="casual">일상</option><option value="date">데이트</option><option value="office">출근</option><option value="formal">격식</option><option value="travel">여행</option></select></label>
   </div>
   <label class="shop-field">분위기<select id="shop-mood"><option value="minimal">미니멀</option><option value="casual">캐주얼</option><option value="classic">클래식</option></select></label>
   <label class="shop-field">반드시 입을 아이템<select id="shop-pin"><option value="">선택 안 함</option>${pinned}</select></label>
   <div class="shop-buttons"><button class="shop-action primary" data-act="recommend">추천 조합 보기</button><button data-act="weather">기존 날씨 조회</button></div>
   <div id="shop-recommendations"></div>
   <div class="shop-buttons"><button data-act="classic-stylist">기존 AI 코디 전체</button></div>
  `);
 }
 function recommend(){const temp=$('#shop-temp').value;const rows=bridge.recommend({temperature:temp===''?null:clamp(Number(temp),-30,50),season:$('#shop-season').value,purpose:$('#shop-purpose').value,destination:$('#shop-destination').value,mood:$('#shop-mood').value,pin:$('#shop-pin').value});selectCache.clear();rows.forEach((r,i)=>selectCache.set(String(i),r));$('#shop-recommendations').innerHTML=rows.map((r,i)=>`<div class="shop-look"><strong>${esc(r.title)}</strong><p>${esc(r.reason||r.description)}</p><p>${esc(r.conditions.join(' · '))}</p><small>${r.items.map(i=>esc(i.name)).join(' / ')}</small><div class="shop-buttons"><button data-recommend="${i}">이 조합 피팅하기</button><button data-rec-save="${i}">코디 저장</button></div></div>`).join('')||'<p>해당 필수 아이템을 포함한 기존 컬렉션이 없어요. 상품 목록에서 직접 조합해주세요.</p>';}
 let fragranceContext={season:'fall',occasion:'casual',tag:''};
 function renderFragrance(){const list=own().filter(i=>i.cat==='fragrance').map(item=>({item,...fragranceMatches(item,fragranceContext)})).sort((a,b)=>b.score-a.score);showPanel('Fragrance bar.',`<p>향수는 코디 정보로 저장돼요. 병은 일반형 전시 모델입니다. 아래 추천은 기존 옷장에 등록된 분류·메모를 비교해요. 향의 성능이나 실제 취향을 판정하지 않아요.</p><label class="shop-field">계절<select id="fragrance-season">${[['spring','봄'],['summer','여름'],['fall','가을'],['winter','겨울']].map(([k,v])=>`<option value="${k}" ${fragranceContext.season===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="shop-field">상황<select id="fragrance-occasion">${[['casual','일상'],['date','데이트'],['office','출근'],['formal','격식']].map(([k,v])=>`<option value="${k}" ${fragranceContext.occasion===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="shop-field">찾고 싶은 등록 태그·메모<input id="fragrance-tag" value="${esc(fragranceContext.tag)}" maxlength="60" placeholder="예: 여행"></label><button class="shop-action" data-act="fragrance-rank">조건 적용</button><p>현재: ${esc(get(fragrance)?.name||'선택 안 함')}</p><div class="shop-buttons"><button data-act="remove-fragrance">향수 제거</button><button data-act="fit">피팅룸으로</button><button data-act="save">코디 저장</button></div>${list.map(({item:i,reasons,hasNotes})=>`<article class="shop-product"><img src="${esc(i.image)}" alt="${esc(i.name)}" loading="lazy"><div><strong>${esc(i.name)}</strong><p>${esc(i.brand||'')}<br>${esc(i.notes||i.userNote||'등록된 사용자 메모 없음')}</p><small>${esc(reasons.join(' · ')||'조건에 대응하는 등록 정보 없음')}<br>${hasNotes?'확인된 향조: '+esc(i.scentNotes):'향조 정보 부족 · 향조·지속력은 추정하지 않아요.'}</small><div class="shop-buttons"><button data-detail="${esc(i.id)}">상세</button><button data-fragrance="${esc(i.id)}">이 향수 선택</button></div></div></article>`).join('')}`);}

 function readSaves(){try{return store.read();}catch(e){notice('저장된 코디를 읽지 못했어요. 원본 저장값을 유지했어요. '+e.message);return [];}}
 function renderOOTD(){
  const looks=readSaves().map(row=>{
   const checked=reconcile(row.fit,own());
   const stale=checked.changed.length||checked.removed.length;
   return `<article class="shop-look"><strong>${esc(row.name)}</strong>
    <p>가상 코디 · ${esc(row.createdAt?.slice(0,10))} · ${Object.keys(row.fit).length}개${stale?' · 수정/삭제된 품목 있음':''}</p>
    <small>향수 ${esc(get(row.fragrance)?.name||'없음 또는 삭제됨')}</small>
    <div class="shop-buttons"><button data-load="${esc(row.id)}">불러오기</button><button data-log="${esc(row.id)}">실제로 입은 날 기록</button></div>
   </article>`;
  }).join('');
  showPanel('코디와 착장 기록',`
   <p class="shop-lead">가상 코디를 저장하고, 실제로 입은 날에는 착장 기록에 연결하세요.</p>
   <label class="shop-field">코디 이름<input id="shop-save-name" maxlength="80" placeholder="나의 가상 코디"></label>
   <div class="shop-buttons"><button class="shop-action primary" data-act="save">현재 코디 저장</button><button data-act="capture">3D 이미지 저장</button><button data-act="fit">피팅룸</button><button data-act="diary">기존 착장 기록</button></div>
   <h3>저장한 룩</h3>
   <div id="shop-saves">${looks||'<p>저장한 가상 코디가 아직 없어요.</p>'}</div>
   <details><summary>가상 코디 백업과 복원</summary><div class="shop-buttons"><button data-act="export">3D 코디 백업</button><button data-act="import">3D 코디 복원</button></div>
   <small>이 백업에는 품목 ID·착용 면·향수·모델 버전을 담아요. 사진과 착장 기록은 기존 옷장 백업을 사용하세요.</small></details>
   <input id="shop-import" type="file" accept="application/json" hidden>
  `);
 }
 function save(){try{const row=snapshot(fit,fragrance,own(),$('#shop-save-name')?.value||'나의 가상 코디');store.save(row);notice('가상 코디를 이 브라우저에 저장했어요. 실제 착용 횟수는 변하지 않았어요.');if(panelMode==='ootd')renderOOTD();}catch(e){notice('저장하지 못했어요. '+e.message);}}
 async function enter(zone,jump=false){
  if(!introDone)finishIntro();
  const generation=++navigationGeneration;
  if(fitReturn){pose={...fitReturn};fitReturn=null;}
  restoreRoomView();
  const beforeJump={...pose};
  if(jump){
   if (zone !== 'fitting' && zone !== 'showroom') roomReturn = beforeJump;
   if (zone === 'showroom') previousLocation = {progress:travelProgress,...lookOffset};
   const z=ZONES[zone];
   pose={x:z.position[0],y:z.position[1],z:z.position[2],yaw:z.yaw,pitch:0};
  }
  hidePanel();
  if(zone==='fitting'){
   fitReturn=beforeJump;
   setState('FITTING');
   resize();
   try{
    await ensureAvatar();
    if(generation===navigationGeneration&&panel.hidden)$('#shop-edit').focus({preventScroll:true});
   }catch(e){
    if(generation!==navigationGeneration)return;
    notice('아바타를 불러오지 못했어요. 다시 피팅룸을 눌러주세요.');
    closePanel();
   }
   return;
  }
  if(zone==='showroom'&&jump){setState('STORE_EXPLORE');resetTour();tour.focus({preventScroll:true});return;}
  panelMode=zone;
  setState(({concierge:'CONCIERGE',fragrance:'FRAGRANCE',ootd:'OOTD'})[zone]||'ITEM_DETAIL');
  ({showroom:renderList,concierge:renderConcierge,fragrance:renderFragrance,ootd:renderOOTD})[zone]();
 }
 async function useRecommendation(key,saveOnly=false){const r=selectCache.get(key);if(!r)return;const next={};let missing=[];for(const i of r.items){const item=get(i.id);if(!item)continue;const m=mapping(item);if(m.level==='UNSUPPORTED'){missing.push(item.name);continue;}next[m.slot]=selectionFor(item,i.lookSide);}await applyFit(next);if(r.fragrance?.id)fragrance=r.fragrance.id;if(saveOnly)save();else await enter('fitting');if(missing.length)notice('3D 착용 미지원: '+missing.join(', ')+' · 해당 품목은 모델에 포함하지 않았어요.');}
 function download(data,name){const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 async function capture(){
  await ensureAvatar();
  if (state !== 'FITTING') await enter('fitting');
  await new Promise(resolve => requestAnimationFrame(resolve));
  const image = document.createElement('canvas');
  image.width = 800;
  image.height = 1100;
  const ctx = image.getContext('2d');
  const ratio = renderer.getPixelRatio();
  const {x,y,width,height} = fitViewport;
  const scale = Math.min(800/width,1050/height);
  ctx.fillStyle = '#e6dfd2';
  ctx.fillRect(0,0,800,1100);
  ctx.drawImage(canvas,x*ratio,y*ratio,width*ratio,height*ratio,(800-width*scale)/2,(1050-height*scale)/2,width*scale,height*scale);
  ctx.fillStyle = '#333';
  ctx.font = '19px sans-serif';
  ctx.fillText('MY FIT · VIRTUAL 3D / APPROXIMATE SILHOUETTE',30,1080);
  image.toBlob(blob => blob && download(blob,'my-fit-virtual-3d.jpg'),'image/jpeg',.86);
 }
 root.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{
  if(b.dataset.zone){await enter(b.dataset.zone,true);return;}if(b.dataset.wear){await wear(b.dataset.wear,b.dataset.side);return;}if(b.dataset.remove){strip(b.dataset.remove);renderFitting();return;}
  if(b.dataset.fitCategory){fittingCategory=b.dataset.fitCategory;renderFitting();return;}
  if(b.dataset.detail){previousState=state;setState('ITEM_DETAIL');bridge.openItem(b.dataset.detail);return;}
  if(b.dataset.fragrance){fragrance=b.dataset.fragrance;renderFragrance();updateStatus();return;}
  if(b.dataset.recommend!==undefined){await useRecommendation(b.dataset.recommend);return;}if(b.dataset.recSave!==undefined){await useRecommendation(b.dataset.recSave,true);return;}
  if(b.dataset.load){const row=readSaves().find(r=>r.id===b.dataset.load);if(row){await applyFit(row.fit);fragrance=get(row.fragrance)?.cat==='fragrance'?row.fragrance:null;await enter('fitting');}return;}
  if(b.dataset.log){const row=readSaves().find(r=>r.id===b.dataset.log);if(row)bridge.openLog([...Object.values(row.fit).map(p=>p.itemId),...(row.fragrance?[row.fragrance]:[])],`가상 코디 “${row.name}” 참고. 실제로 입은 아이템과 날짜를 확인해주세요.`);return;}
  if(b.dataset.fitView){const v=b.dataset.fitView;if(v==='front')orbit.yaw=0;if(v==='side')orbit.yaw=Math.PI/2;if(v==='back')orbit.yaw=Math.PI;if(v==='rotate')orbit.yaw+=Math.PI/4;if(v==='in')orbit.radius=clamp(orbit.radius-.2,1.8,3.8);if(v==='out')orbit.radius=clamp(orbit.radius+.2,1.8,3.8);if(v==='reset')orbit={yaw:0,pitch:.08,radius:2.6};setViewPressed(v);return;}
  const a=b.dataset.act;if(a==='fragrance-rank'){fragranceContext={season:$('#fragrance-season').value,occasion:$('#fragrance-occasion').value,tag:$('#fragrance-tag').value};renderFragrance();}if(a==='skip')finishIntro();if(a==='replay')replay();if(a==='close')dismissPanel();if(a==='list')await openCollection();if(a==='near')await enter(nearest(),nearest()!=='showroom');if(a==='fit')await enter('fitting');if(a==='reset'){closePanel();previousLocation={progress:travelProgress,...lookOffset};resetTour();}if(a==='previous-location'&&previousLocation){closePanel();const current={progress:travelProgress,...lookOffset};travelProgress=previousLocation.progress;lookOffset.yaw=previousLocation.yaw;lookOffset.pitch=previousLocation.pitch;previousLocation=current;tour.scrollTop=travelProgress*(tour.scrollHeight-tour.clientHeight);drawTour();}
  if(a==='zones'){if(panelMode==='zones')dismissPanel();else renderZones();}
  if(a==='edit-fit'){if(panelMode==='fitting')dismissPanel();else renderFitting();}
  if(a==='exit-fit')closePanel();
  if(a==='reset-fit'){fitGeneration++;latest.cancel();for(const slot of Object.keys(fit))strip(slot);fragrance=null;renderFitting();}
  if(a==='ab-store'){ab={fit:structuredClone(fit),fragrance};renderFitting();notice('현재 조합을 A로 보관했어요.');}if(a==='ab-swap'&&ab){const b={fit:structuredClone(fit),fragrance};await applyFit(ab.fit);fragrance=ab.fragrance;ab=b;renderFitting();}
  if(a==='save')save();if(a==='capture')await capture();if(a==='remove-fragrance'){fragrance=null;renderFragrance();updateStatus();}if(a==='recommend')recommend();if(a==='weather'){await bridge.refreshWeather();const input=$('#shop-temp');if(panelMode==='concierge'&&input)input.value=bridge.getWeather()?.temp??'';}
  if(a==='classic-stylist')bridge.navigate('stylist');if(a==='diary')bridge.navigate('diary');if(a==='quality'){renderer.shadowMap.enabled=!renderer.shadowMap.enabled;renderer.shadowMap.needsUpdate=true;}
  if(a==='export')download(new Blob([JSON.stringify({schema:1,looks:store.read()},null,2)],{type:'application/json'}),'my-fit-3d-outfits.json');if(a==='import')$('#shop-import').click();
 }catch(error){notice(error.message||'작업을 완료하지 못했어요. 다시 시도해주세요.');}});
 function setViewPressed(view){
  if(['in','out'].includes(view))return;
  const angle=view==='reset'?'front':view;
  for(const button of root.querySelectorAll('#shop-turn button[aria-pressed]')){
   button.setAttribute('aria-pressed',String(button.dataset.fitView===angle));
  }
 }
 root.addEventListener('input',e=>{if(e.target.id==='shop-search'){query=e.target.value;filterProducts();}});
 root.addEventListener('change',async e=>{if(e.target.id==='shop-category'){category=e.target.value;filterProducts();}if(e.target.id==='shop-import'){try{const file=e.target.files?.[0];if(!file)return;if(file.size>512000)throw Error('백업 파일이 너무 커요.');store.import(await file.text());renderOOTD();notice('기존 코디를 보존하며 백업을 합쳤어요.');}catch(err){notice('복원 실패: '+err.message);}}});
 function bindViewPointer(surface,fitting){
  surface.addEventListener('pointerdown',event=>{
   if((fitting&&state!=='FITTING')||(!fitting&&(state!=='STORE_EXPLORE'||tour.inert)))return;
   pointer={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,scroll:tour.scrollTop};
   surface.setPointerCapture(event.pointerId);
   surface.focus({preventScroll:true});
  });
  surface.addEventListener('pointermove',event=>{
   if(!pointer||pointer.id!==event.pointerId)return;
   const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
   pointer.x=event.clientX;pointer.y=event.clientY;
   if(fitting){
    orbit.yaw-=dx*.006;
    orbit.pitch=clamp(orbit.pitch+dy*.003,-.12,.6);
    if(dx||dy)setViewPressed('orbit');
   }else if(event.pointerType==='mouse'||Math.abs(event.clientX-pointer.startX)>Math.abs(event.clientY-pointer.startY)){
    lookOffset.yaw=clamp(lookOffset.yaw-dx*.004,-1.8,1.8);
    if(event.pointerType==='mouse')lookOffset.pitch=clamp(lookOffset.pitch-dy*.003,-.45,.45);
    drawTour();
   }
  });
  surface.addEventListener('pointerup',event=>{
   const completed=pointer;pointer=null;
   if(fitting||state!=='STORE_EXPLORE'||!completed||completed.id!==event.pointerId)return;
   if(Math.hypot(event.clientX-completed.startX,event.clientY-completed.startY)>6||Math.abs(tour.scrollTop-completed.scroll)>4)return;
   const bounds=canvas.getBoundingClientRect();
   ray.setFromCamera(new T.Vector2((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1),camera);
   const data=ray.intersectObjects(world.pickables,false)[0]?.object.userData;
   if(data?.itemId){
    previousState=state;setState('ITEM_DETAIL');bridge.openItem(data.itemId);
   } else if(data?.fragranceId){
    fragrance=data.fragranceId;enter('fragrance',true);
   } else if(data?.zone) enter(data.zone,true);
  });
  surface.addEventListener('pointercancel',clearInput);
  surface.addEventListener('lostpointercapture',clearInput);
 }
 bindViewPointer(tour,false);
 bindViewPointer(canvas,true);
 canvas.addEventListener('wheel',event=>{
  if(state!=='FITTING')return;
  event.preventDefault();
  orbit.radius=clamp(orbit.radius+event.deltaY*.001,1.8,3.8);
 },{passive:false});
 window.addEventListener('keydown',event=>{
  if(!active||event.key!=='Escape')return;
  clearInput();
  if(state==='INTRO_SCROLL'||(state==='ITEM_DETAIL'&&previousState))return;
  if(!panel.hidden)dismissPanel();else if(state==='FITTING')closePanel();
 });
 window.addEventListener('blur',clearInput);
 document.addEventListener('visibilitychange',()=>{clearInput();if(document.hidden){cancelAnimationFrame(frame);frame=0;}else start();});
 window.addEventListener('resize',resize);
 const modals=new MutationObserver(()=>{if(!active)return;const open=!!document.querySelector('.overlay:not([hidden])');if(open&&state!=='ITEM_DETAIL'){previousState=state;setState('ITEM_DETAIL');}else if(!open&&state==='ITEM_DETAIL'&&previousState){setState(previousState);previousState='';}});document.querySelectorAll('.overlay').forEach(el=>modals.observe(el,{attributes:true,attributeFilter:['hidden']}));
 window.addEventListener('myfit-items-changed',()=>{const c=reconcile(fit,own());for(const slot of Object.keys(fit))if(!c.fit[slot]||c.changed.includes(fit[slot].itemId))strip(slot);if(fragrance&&!get(fragrance))fragrance=null;world.setProducts(own());updateDisplays();if(active){notice(c.removed.length||c.changed.length?'변경된 품목의 오래된 피팅을 해제했어요.':'' );if(panelMode==='fitting')renderFitting();if(panelMode==='showroom')renderList();updateStatus();}});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;cancelAnimationFrame(frame);frame=0;clearInput();notice('3D 화면 연결이 끊겼어요. 일반 2D 보기로 계속하거나 페이지를 새로고침해주세요.');});canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;notice('3D 화면을 복구했어요.');start();});
 resize();
 updateDisplays();
 return {activate(){if(active)return;active=true;document.querySelector('.site-header').inert=true;document.querySelector('footer').inert=true;resize();if(introDone){setState('STORE_EXPLORE');}else if(matchMedia('(prefers-reduced-motion: reduce)').matches){finishIntro();}else replay();start();},deactivate(){clearEntryScroll();fitGeneration++;active=false;document.querySelector('.site-header').inert=false;document.querySelector('footer').inert=false;clearInput();latest.cancel();cancelAnimationFrame(frame);frame=0;panel.hidden=true;setState('CLASSIC_2D');}};
}
