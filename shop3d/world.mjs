import * as T from './vendor/three.module.min.js';
import {loadArchitecture} from './architecture.mjs';
import {FITTING_MARK} from './layout.mjs';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

function combineDisplayMeshes(group) {
  const buckets = new Map();
  group.updateWorldMatrix(true,true);
  group.traverse(mesh => {
    if (!mesh.isMesh || mesh.isSkinnedMesh || Array.isArray(mesh.material)) return;
    const key = mesh.material.uuid + ':' + Object.keys(mesh.geometry.attributes).sort().join(',');
    if (!buckets.has(key)) buckets.set(key,[]);
    buckets.get(key).push(mesh);
  });
  const inverse = group.matrixWorld.clone().invert();
  for (const pieces of buckets.values()) {
    if (pieces.length < 2) continue;
    const transformed = pieces.map(piece => {
      const geometry = piece.geometry.index ? piece.geometry.toNonIndexed() : piece.geometry.clone();
      geometry.applyMatrix4(inverse.clone().multiply(piece.matrixWorld));
      return geometry;
    });
    const combined = mergeGeometries(transformed);
    transformed.forEach(geometry => geometry.dispose());
    if (!combined) continue;
    const mesh = new T.Mesh(combined,pieces[0].material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    for (const piece of pieces) {
      piece.removeFromParent();
      piece.geometry.dispose();
    }
  }
}

function fittingContactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const fade = ctx.createRadialGradient(32,32,2,32,32,31);
  fade.addColorStop(0,'rgba(35,22,15,.48)');
  fade.addColorStop(.45,'rgba(35,22,15,.28)');
  fade.addColorStop(1,'rgba(35,22,15,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0,0,64,64);
  const map = new T.CanvasTexture(canvas);
  const shadow = new T.Mesh(new T.PlaneGeometry(.80,.63),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
  shadow.rotation.x = -Math.PI/2;
  shadow.position.set(FITTING_MARK[0],.025,FITTING_MARK[2]+.06);
  shadow.visible = false;
  return shadow;
}

export async function createWorld(renderer) {
  const scene = new T.Scene();
  const architecture = await loadArchitecture({renderer,onError:error => console.warn('MY FIT material fallback',error)});
  scene.environment = architecture.environment;
  scene.environmentIntensity = .44;
  const clothes = new T.Group();
  clothes.name = 'MY FIT owned display garments';
  const contactShadow = fittingContactShadow();
  scene.add(architecture.root, clothes, contactShadow);
  const fixtures = architecture.pickables || [];
  const pickables = [...fixtures];
  const garmentAnchors = architecture.garmentAnchors;
  let fabricNormal;
  architecture.root.traverse(mesh => {
    if (!fabricNormal && /^whiteWool/.test(mesh.material?.name || '')) {
      fabricNormal = mesh.material.normalMap;
    }
  });

  function setProducts(items) {
    const scents = items.filter(item => item.cat === 'fragrance');
    for (const mesh of fixtures) {
      const index = mesh.userData.fragranceIndex;
      if (Number.isInteger(index)) mesh.userData.fragranceId = scents[index]?.id;
    }
  }

  function setGarmentDisplays(items, build, dispose) {
    for (const group of [...clothes.children]) dispose(group);
    pickables.splice(fixtures.length);
    const hanging = [
      ...items.filter(item => item.cat === 'outer').slice(0, Math.ceil(garmentAnchors.hanging.length / 2)),
      ...items.filter(item => item.cat === 'top'),
    ];
    const shoes = items.filter(item => item.cat === 'shoes');
    function place(item, anchor) {
      if (!item) return;
      const group = build(item);
      combineDisplayMeshes(group);
      group.position.set(...anchor.position);
      group.rotation.y = anchor.rotationY || 0;
      group.scale.setScalar(anchor.scale || 1);
      group.updateWorldMatrix(true, true);
      const bounds = new T.Box3().setFromObject(group);
      if (Number.isFinite(anchor.top)) group.position.y += anchor.top - bounds.max.y;
      if (Number.isFinite(anchor.ground)) group.position.y += anchor.ground - bounds.min.y;
      clothes.add(group);
      group.traverse(mesh => {
        if (!mesh.isMesh) return;
        if (fabricNormal && item.cat !== 'shoes' && mesh.material?.name === 'fabric') {
          mesh.material.normalMap = fabricNormal;
          mesh.material.normalScale.setScalar(.38);
        }
        mesh.userData.itemId = item.id;
        pickables.push(mesh);
      });
    }
    garmentAnchors.hanging.forEach((anchor, index) => place(hanging[index], anchor));
    garmentAnchors.shoes.forEach((anchor, index) => place(shoes[index], anchor));
  }

  return {
    scene, pickables, setProducts, setGarmentDisplays,
    setDoor: value => architecture.setDoor(value),
    setReflection: value => architecture.setReflection?.(value),
    setCutaway: value => architecture.setCutaway?.(value),
    setNight(value) {
      scene.background = new T.Color(value ? '#171b25' : '#a5a29b');
      architecture.setNight(value);
    },
    setFitting(value) {
      clothes.visible = !value;
      contactShadow.visible = value;
    },
  };
}
