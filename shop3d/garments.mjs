import * as T from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { mapping } from './core.mjs';
import { buildGarment } from './tailoring.mjs';

const fittedModels = {
  tee: 'mf_garment_tee_01',
  coat: 'mf_garment_coat_01',
  knit: 'mf_garment_knit_01',
  shirt: 'mf_garment_shirt_01',
  straight: 'mf_garment_trouser_01',
  derby: 'mf_shoe_derby_01',
};
const textileModels = {
  longtee: 'tee', hoodie: 'tee', vest: 'knit', jacket: 'shirt', bomber: 'shirt',
  blazer: 'coat', wide: 'straight', balloon: 'straight', shorts: 'straight',
  loafer: 'derby', sneaker: 'derby', chunky: 'derby', cap: 'tee', tote: 'derby', backpack: 'tee',
};
const starter = {
  top: { garmentType: 'tee', color: '#ded7c8', material: 'woven' },
  bottom: { garmentType: 'straight', color: '#46433d', material: 'woven' },
  shoes: { garmentType: 'derby', color: '#49362b', material: 'leather' },
};
const loader = new GLTFLoader();
const loaded = new Map();
const pending = new Map();
const avatars = new WeakMap();
let decoderReady;

function loadModel(name) {
  if (loaded.has(name)) return Promise.resolve(loaded.get(name));
  if (!pending.has(name)) {
    const url = new URL(`./assets/fitting/${name}.glb`, import.meta.url).href;
    pending.set(name, loader.loadAsync(url).then(({ scene }) => {
      scene.updateMatrixWorld(true);
      loaded.set(name, scene);
      return scene;
    }).finally(() => pending.delete(name)));
  }
  return pending.get(name);
}

export async function prepareFittingAssets(renderer) {
  if (!decoderReady) {
    decoderReady = Promise.all([import('./vendor/DRACOLoader.js'), import('./vendor/KTX2Loader.js')])
      .then(([{ DRACOLoader }, { KTX2Loader }]) => {
        const vendor = new URL('./vendor/', import.meta.url).href;
        const draco = new DRACOLoader().setDecoderPath(vendor).setWorkerLimit(2);
        const textures = new KTX2Loader().setTranscoderPath(vendor).setWorkerLimit(2).detectSupport(renderer);
        loader.setDRACOLoader(draco).setKTX2Loader(textures);
      }).catch(error => { decoderReady = undefined; throw error; });
  }
  await decoderReady;
  await Promise.all([
    loadModel('mf_avatar_m01'),
    ...Object.values(starter).map(spec => loadModel(fittedModels[spec.garmentType])),
  ]);
}

export async function prepareGarment(item) {
  const type = mapping(item).garmentType;
  const name = fittedModels[type] ?? fittedModels[textileModels[type]];
  if (name) await loadModel(name);
}

// The scene graph clone needs a new set of bones. Geometry and textures remain
// immutable in the asset cache; independent materials can be released per look.
function cloneAvatar(source) {
  const result = source.clone(true);
  const originals = [], copies = [];
  source.traverse(object => originals.push(object));
  result.traverse(object => copies.push(object));
  const lookup = new Map(originals.map((original, index) => [original, copies[index]]));
  const skeletons = new Map();
  for (const original of originals) {
    if (!original.isSkinnedMesh) continue;
    const clone = lookup.get(original);
    let skeleton = skeletons.get(original.skeleton);
    if (!skeleton) {
      skeleton = new T.Skeleton(original.skeleton.bones.map(bone => lookup.get(bone)), original.skeleton.boneInverses);
      skeletons.set(original.skeleton, skeleton);
    }
    clone.bind(skeleton, original.bindMatrix);
    clone.material = original.material.clone();
    clone.castShadow = true;
    clone.receiveShadow = true;
    clone.userData.cachedGeometry = true;
  }
  result.updateMatrixWorld(true);
  return { result, skeleton: skeletons.values().next().value };
}

function tintedMaterial(source, spec) {
  const next = source.clone();
  const role = source.name.split('.')[0];
  const color = new T.Color(spec.color);
  if (role === 'fabric') next.color.copy(color);
  if (role === 'seam') next.color.copy(color).multiplyScalar(spec.material === 'denim' ? 1.18 : .70);
  if (role === 'facing' && spec.garmentType !== 'derby') next.color.copy(color).multiplyScalar(.80);
  if (role === 'fabric' && spec.material === 'leather') next.roughness = .54;
  next.side = T.DoubleSide;
  return next;
}

function fittedModel(source, spec, avatarData) {
  const group = new T.Group();
  source.traverse(original => {
    if (!original.isSkinnedMesh) return;
    const surface = tintedMaterial(original.material, spec);
    let mesh = new T.Mesh(original.geometry, surface);
    if (avatarData?.skeleton) {
      const skeleton = avatarData.skeleton;
      if (original.skeleton.bones.some((bone, index) => bone.name !== skeleton.bones[index]?.name)) {
        throw new Error('피팅 모델의 공용 바인드가 일치하지 않아요.');
      }
      mesh = new T.SkinnedMesh(original.geometry, surface);
      mesh.bind(skeleton, original.bindMatrix);
      mesh.frustumCulled = false;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.cachedGeometry = true;
    group.add(mesh);
  });
  return group;
}

function weights(region, height) {
  const smooth = T.MathUtils.smoothstep;
  const side = region.at(-1);
  if (region.startsWith('sleeve')) {
    const elbow = 1 - smooth(height, 1.10, 1.25);
    const clavicle = smooth(height, 1.37, 1.466) * .28;
    return [[`upperarm01${side}`, 1 - elbow - clavicle], [`lowerarm01${side}`, elbow], [`clavicle${side}`, clavicle]];
  }
  if (region.startsWith('leg')) {
    const knee = 1 - smooth(height, .44, .61);
    const hip = smooth(height, .85, 1.06) * .66;
    return [[`upperleg01${side}`, 1 - knee - hip], [`lowerleg01${side}`, knee], ['spine05', hip]];
  }
  if (region.startsWith('foot')) return [[`foot${side}`, 1]];
  if (region === 'head') return [['head', 1]];
  const chest = smooth(height, 1.05, 1.36);
  return [['spine05', 1 - chest], ['spine01', chest]];
}

function bindProcedural(group, data) {
  if (!data?.skeleton) return group;
  const skeleton = data.skeleton;
  const bindMatrix = new T.Matrix4();
  for (const mesh of [...group.children]) {
    const position = mesh.geometry.attributes.position;
    const joints = new Uint16Array(position.count * 4);
    const blend = new Float32Array(position.count * 4);
    for (let index = 0; index < position.count; index++) {
      weights(mesh.name, position.getY(index)).forEach(([bone, weight], slot) => {
        joints[index * 4 + slot] = data.joints.get(bone) ?? 0;
        blend[index * 4 + slot] = weight;
      });
    }
    mesh.geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(joints, 4));
    mesh.geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(blend, 4));
    const skinned = new T.SkinnedMesh(mesh.geometry, mesh.material);
    skinned.bind(skeleton, bindMatrix);
    skinned.castShadow = true;
    skinned.receiveShadow = true;
    skinned.frustumCulled = false;
    group.remove(mesh);
    group.add(skinned);
  }
  return group;
}

function applyTextile(group, spec) {
  const reference = loaded.get(fittedModels[textileModels[spec.garmentType]]);
  if (!reference) return;
  const materials = new Map();
  reference.traverse(object => {
    if (object.isMesh) materials.set(object.material.name.split('.')[0], object.material);
  });
  for (const mesh of group.children) {
    const material = mesh.material;
    const source = materials.get(material.name);
    if (!source?.map) continue;
    for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) material[key] = source[key];
    material.normalScale.copy(source.normalScale);
    material.roughness = source.roughness;
    material.aoMapIntensity = source.aoMapIntensity;
    const uv = mesh.geometry.attributes.uv;
    for (let index = 0; index < uv.count; index++) uv.setXY(index, uv.getX(index) * 12, uv.getY(index) * 9);
  }
}

function buildPiece(spec, side, data, display = false) {
  const source = !display && side !== '바람막이 면' && loaded.get(fittedModels[spec.garmentType]);
  if (source) return fittedModel(source, spec, data);
  const pattern = buildGarment(spec, side, { display });
  if (!display) applyTextile(pattern, spec);
  return bindProcedural(pattern, data);
}

export function mannequin() {
  const avatar = new T.Group();
  avatar.name = 'MY FIT M01 · 기준 아바타';
  const source = loaded.get('mf_avatar_m01');
  const data = { defaults: {}, skeleton: null, skin: {}, joints: new Map() };
  avatars.set(avatar, data);
  if (source) {
    const { result, skeleton } = cloneAvatar(source);
    data.skeleton = skeleton;
    data.joints = new Map(skeleton.bones.map((bone, index) => [bone.name, index]));
    result.traverse(object => {
      if (object.name.startsWith('Skin_')) data.skin[object.name] = object;
    });
    avatar.add(result);
  }
  for (const [slot, spec] of Object.entries(starter)) {
    data.defaults[slot] = buildPiece(spec, '기본', data);
    data.defaults[slot].name = `M01 starter ${slot}`;
    avatar.add(data.defaults[slot]);
  }
  syncFittingLayers(avatar, {});
  return avatar;
}

export function garment(item, side = '기본', { avatar, display = false } = {}) {
  const spec = mapping(item);
  if (!spec.templateId) throw new Error('이 품목은 모델이 준비되지 않았어요.');
  const group = buildPiece(spec, side, avatars.get(avatar), display);
  group.userData = { itemId: item.id, type: spec.garmentType, side, level: spec.level };
  return group;
}

export function syncFittingLayers(avatar, pieces) {
  const data = avatars.get(avatar);
  if (!data) return;
  const middle = pieces.middle?.userData.type;
  const coversArms = Boolean(pieces.outer || (middle && middle !== 'vest') ||
    ['longtee', 'hoodie'].includes(pieces.top?.userData.type));
  data.defaults.top.visible = !pieces.top && (!middle || middle === 'vest');
  data.defaults.bottom.visible = !pieces.bottom;
  data.defaults.shoes.visible = !pieces.shoes;
  if (data.skin.Skin_upperarms) data.skin.Skin_upperarms.visible = false;
  if (data.skin.Skin_forearms) data.skin.Skin_forearms.visible = !coversArms;
  if (data.skin.Skin_calves) data.skin.Skin_calves.visible = pieces.bottom?.userData.type === 'shorts';
}

export function disposeGroup(group) {
  const geometries = new Set();
  const materials = new Set();
  group.traverse(object => {
    if (object.geometry && !object.userData.cachedGeometry) geometries.add(object.geometry);
    if (object.material) for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  avatars.get(group)?.skeleton?.dispose();
  group.removeFromParent();
}
