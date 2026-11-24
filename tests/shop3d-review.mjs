// Local, read-only evidence fixture. It never mounts the app or opens its storage.
const canvas = document.querySelector('#review-canvas');
const panel = document.querySelector('#review-panel');
const views = document.querySelector('#review-views');
const status = document.querySelector('#review-status');
const errorMessage = document.querySelector('#review-error');
const metrics = document.querySelector('#review-metrics');
const params = new URLSearchParams(location.search);

function fail(error) {
  document.body.dataset.ready = 'error';
  errorMessage.textContent = error.message;
  errorMessage.hidden = false;
  console.error(error);
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`검수 자료를 열 수 없어요: ${url.pathname}`);
  return response.json();
}

async function loadWardrobe() {
  const manifestURL = new URL('../published-closet.json', import.meta.url);
  const manifest = await readJson(manifestURL);
  const files = await Promise.all(manifest.dataFiles.map(file => readJson(new URL(file.path, manifestURL))));
  return files.flatMap(file => file.items);
}

async function runReview() {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname)) {
    throw new Error('이 장면 검수 도구는 localhost에서만 실행할 수 있어요.');
  }

  const [T, layout, wardrobe, {createWorld}, garments, {mapping}] = await Promise.all([
    import('../shop3d/vendor/three.module.min.js'),
    import('../shop3d/layout.mjs'),
    loadWardrobe(),
    import('../shop3d/world.mjs'),
    import('../shop3d/garments.mjs'),
    import('../shop3d/core.mjs'),
  ]);
  const {CAMERAS, ENTRY_KEYS, FITTING_MARK, applyCameraLens, introPose, toWorld} = layout;
  const renderer = new T.WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = params.has('shadows') ? params.get('shadows') !== '0' : innerWidth > 700;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const world = await createWorld(renderer);
  world.setProducts(wardrobe);
  await world.setGarmentDisplays(wardrobe, item => garments.garment(item, '기본', {display:true}), garments.disposeGroup);

  const titles = {
    '01_exterior_day':'외관 · 낮', '01_exterior_night':'외관 · 밤',
    '02_entry_01':'입장 00%', '02_entry_02':'입장 32%', '02_entry_03':'입장 64%', '02_entry_04':'입장 100%',
    '03_aerial':'매장 컷어웨이', '04_showroom_north':'쇼룸 · 북', '04_showroom_south':'쇼룸 · 남',
    '04_showroom_west':'쇼룸 · 서', '04_showroom_east':'쇼룸 · 동',
    '05_fitting_front':'피팅룸 · 입구', '05_fitting_side':'피팅룸 · 측면',
    '06_bar_wide':'향수 바', '06_bar_detail':'향수 진열 상세',
    '07_style_consult':'스타일 상담실', '08_ootd_studio':'OOTD 스튜디오',
  };
  const shots = Object.entries(titles).map(([id, title]) => ({
    id, title, specification:CAMERAS[id], entry:ENTRY_KEYS.find(key => key.cameraId === id),
  }));
  const slacks = 'item-20261102-gray-slacks';
  const derby = 'item-20261025-09-drmartens';
  const knit = 'item-20261103-margiela';
  const coat = 'item-20261029-11-balmacaan';
  const shirt = 'item-20261103-ceindre-shirt';
  const loafer = 'item-20261025-07-loafers';
  const knitLook = [knit, slacks, derby];
  shots.push(
    {id:'fit-base',title:'기본 티셔츠·팬츠·더비',fit:[],yaw:0},
    {id:'fit-knit',title:'니트 · 정면',fit:knitLook,yaw:0},
    {id:'fit-knit-side',title:'니트 · 측면',fit:knitLook,yaw:Math.PI/2},
    {id:'fit-knit-back',title:'니트 · 후면',fit:knitLook,yaw:Math.PI},
    {id:'fit-coat',title:'니트 + 코트',fit:[...knitLook,coat],yaw:0},
    {id:'fit-shirt',title:'코트 탈의 · 셔츠 교체',fit:[shirt,slacks,derby],yaw:0},
    {id:'fit-shoes',title:'셔츠 + 로퍼 교체',fit:[shirt,slacks,loafer],yaw:0},
  );

  let avatar, parts = {}, lastFit = '', selected, navigation = 0, runningBenchmark = false;
  const perspective = new T.PerspectiveCamera(58, 1, .06, 75);
  const orthographic = new T.OrthographicCamera(-1, 1, 1, -1, .05, 100);
  const fitCamera = new T.PerspectiveCamera(44, 1, .045, 40);
  const fitTarget = new T.Vector3(...FITTING_MARK).add(new T.Vector3(0, .94, 0));

  function frameCamera(shot) {
    const aspect = canvas.clientWidth / canvas.clientHeight;
    if (shot.fit) {
      const radius = Math.max(2.6, 1.14 / (Math.tan(T.MathUtils.degToRad(fitCamera.fov / 2)) * Math.min(1, aspect / .55)));
      fitCamera.aspect = aspect;
      fitCamera.position.set(fitTarget.x, fitTarget.y + Math.sin(.08) * radius, fitTarget.z + Math.cos(.08) * radius);
      fitCamera.lookAt(fitTarget);
      fitCamera.updateProjectionMatrix();
      return fitCamera;
    }
    const specification = shot.specification;
    if (specification.projection === 'orthographic') {
      const halfWidth = specification.orthoScale / 2;
      const halfHeight = halfWidth / aspect;
      const shift = (specification.shiftY || 0) * specification.orthoScale;
      Object.assign(orthographic,{left:-halfWidth,right:halfWidth,top:halfHeight+shift,bottom:-halfHeight+shift});
      orthographic.position.set(...toWorld(specification.position));
      orthographic.lookAt(new T.Vector3(...toWorld(specification.target)));
      orthographic.updateProjectionMatrix();
      return orthographic;
    }
    perspective.aspect = aspect;
    if (shot.entry) {
      const pose = introPose(shot.entry.progress);
      perspective.position.set(pose.x, pose.y, pose.z);
      perspective.rotation.order = 'YXZ';
      perspective.rotation.set(pose.pitch, pose.yaw, 0);
      applyCameraLens(perspective, pose);
    } else {
      perspective.position.set(...toWorld(specification.position));
      perspective.lookAt(new T.Vector3(...toWorld(specification.target)));
      applyCameraLens(perspective, specification);
    }
    return perspective;
  }

  async function prepareFit(shot, generation) {
    const items = shot.fit.map(id => {
      const item = wardrobe.find(candidate => candidate.id === id);
      if (!item) throw new Error(`검수용 보유품 ID가 현재 옷장에 없어요: ${id}`);
      return item;
    });
    await garments.prepareFittingAssets(renderer);
    await Promise.all(items.map(item => garments.prepareGarment(item, '기본')));
    if (generation !== navigation) return false;
    if (!avatar) {
      avatar = garments.mannequin();
      let rigged = false;
      avatar.traverse(node => { if (node.isSkinnedMesh && node.skeleton) rigged = true; });
      if (!rigged) throw new Error('검수용 아바타에 스킨과 본이 연결되지 않았어요.');
      avatar.position.set(...FITTING_MARK);
      world.scene.add(avatar);
    }
    const combination = shot.fit.join(',');
    if (combination !== lastFit) {
      for (const part of Object.values(parts)) garments.disposeGroup(part);
      parts = {};
      for (const item of items) {
        const part = garments.garment(item, '기본', {avatar});
        parts[mapping(item).slot] = part;
        avatar.add(part);
      }
      garments.syncFittingLayers(avatar, parts);
      lastFit = combination;
    }
    avatar.rotation.y = -shot.yaw;
    return true;
  }

  function applyScene(shot) {
    world.setCutaway(shot.specification?.sceneVariant === 'ortho');
    world.setReflection(!shot.fit && shot.id === '05_fitting_front');
    world.setNight(shot.specification?.sceneVariant === 'night');
    world.setDoor(shot.entry ? introPose(shot.entry.progress).door : Number(!shot.id.startsWith('01_')));
    world.setFitting(Boolean(shot.fit));
    if (avatar) avatar.visible = Boolean(shot.fit);
  }

  function draw() {
    if (!selected) return;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.render(world.scene, frameCamera(selected));
  }

  function markReady() {
    const {calls, triangles} = renderer.info.render;
    document.body.dataset.shot = selected.id;
    document.body.dataset.triangles = String(triangles);
    document.body.dataset.drawCalls = String(calls);
    document.body.dataset.ready = 'true';
    status.textContent = `${selected.title} · 삼각형 ${triangles.toLocaleString()} · draw calls ${calls}`;
    metrics.textContent = status.textContent;
  }

  async function show(id, clean) {
    if (runningBenchmark) return;
    const shot = shots.find(candidate => candidate.id === id);
    if (!shot) throw new Error(`알 수 없는 검수 장면: ${id}`);
    const generation = ++navigation;
    document.body.dataset.ready = 'false';
    errorMessage.hidden = true;
    if (clean) panel.hidden = true;
    if (shot.fit && !(await prepareFit(shot, generation))) return;
    if (generation !== navigation) return;
    selected = shot;
    applyScene(shot);
    draw();
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (generation !== navigation) return;
    markReady();
    for (const button of views.children) {
      if (button.dataset.reviewView === id) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
    const url = new URL(location.href);
    url.searchParams.set('shot', id);
    history.replaceState(null, '', url);
  }

  function showNext(offset) {
    const index = shots.indexOf(selected);
    show(shots[(index + offset + shots.length) % shots.length].id, true).catch(fail);
  }

  async function benchmark() {
    if (runningBenchmark || !selected || document.body.dataset.ready !== 'true') return;
    runningBenchmark = true;
    const camera = frameCamera(selected);
    const frames = [];
    let start = 0;
    let last = 0;
    try {
      await new Promise(resolve => {
        const step = time => {
          if (document.hidden || (start && time - start >= 2200)) {
            resolve();
            return;
          }
          renderer.render(world.scene, camera);
          if (!start) start = time;
          if (last && time - start > 200) frames.push(time - last);
          last = time;
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      const resource = performance.getEntriesByType('resource').filter(entry => entry.name.includes('/shop3d/'));
      const transferred = resource.reduce((sum, entry) => sum + entry.encodedBodySize, 0);
      const fps = frames.length ? (1000 * frames.length / frames.reduce((sum, duration) => sum + duration, 0)).toFixed(1) : '측정 중단';
      const lines = [
        `장면 ${selected.id}`,
        `뷰포트 ${canvas.clientWidth}×${canvas.clientHeight} · DPR ${renderer.getPixelRatio()} · 그림자 ${renderer.shadowMap.enabled?'ON':'OFF'}`,
        `2초 정지 카메라 평균 ${fps}fps · ${frames.length} 프레임 간격`,
        `${renderer.info.render.triangles.toLocaleString()} 삼각형 · ${renderer.info.render.calls} draw calls`,
        `검수 페이지 누적 3D 응답 본문 ${transferred.toLocaleString()} bytes`,
      ];
      metrics.textContent = lines.join('\n');
      document.body.dataset.benchmark = 'done';
    } finally {
      runningBenchmark = false;
    }
  }

  for (const shot of shots) {
    const button = document.createElement('button');
    button.dataset.reviewView = shot.id;
    button.textContent = shot.title;
    views.append(button);
  }
  views.addEventListener('click', event => {
    const id = event.target.closest('[data-review-view]')?.dataset.reviewView;
    if (id) show(id, true).catch(fail);
  });
  document.querySelector('#review-hide').onclick = () => { panel.hidden = true; canvas.focus(); };
  document.querySelector('#review-benchmark').onclick = () => {
    if (runningBenchmark || document.body.dataset.ready !== 'true') return;
    document.body.dataset.benchmark = 'running';
    benchmark().catch(fail);
  };
  window.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === 'm') panel.hidden = !panel.hidden;
    if (key === 'n') showNext(1);
    if (key === 'p') showNext(-1);
  });
  window.addEventListener('resize', () => {
    if (document.body.dataset.ready !== 'true' || runningBenchmark) return;
    draw();
    markReady();
  });
  await show(params.get('shot') || '01_exterior_day', params.has('shot'));
  if (!params.has('shot')) panel.hidden = false;
}

runReview().catch(fail);
