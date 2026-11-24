import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as C from '../shop3d/core.mjs';
import {garment,mannequin,disposeGroup} from '../shop3d/garments.mjs';
import * as T from '../shop3d/vendor/three.module.min.js';
import {photoPreview} from '../shop3d/ai-preview.mjs';
import {CAMERAS,ENTRY_KEYS,toWorld,canStand,tourPose} from '../shop3d/layout.mjs';
const base=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,base),'utf8');
const manifest=JSON.parse(read('published-closet.json'));
const items=manifest.dataFiles.flatMap(f=>JSON.parse(read(f.path)).items);
const counts={PRODUCT_BASED:0,APPROXIMATE:0,UNSUPPORTED:0};
let checked=0;const test=async(name,fn)=>{await fn();checked++;console.log('PASS '+name);};
await test('fitting controls never collide with the legacy data-view route selector',()=>{
 assert(!read('shop3d/shop.mjs').includes('data-view='));assert(read('shop3d/shop.mjs').includes('data-fit-view='));
});
await test('owned items retain their IDs and explicit support levels',()=>{
 assert.equal(items.length,manifest.itemCount);for(const i of items){const m=C.mapping(i);counts[m.level]++;assert.equal(m.itemId,i.id);assert(m.source&&m.license&&m.limitation);}
 assert.deepEqual(counts,{PRODUCT_BASED:0,APPROXIMATE:64,UNSUPPORTED:16});
});
await test('every supported item builds finite volumetric geometry, both reversible faces',()=>{
 for(const i of items){const m=C.mapping(i);if(m.level==='UNSUPPORTED'){assert.throws(()=>garment(i));continue;}
 for(const side of m.sides){const g=garment(i,side);assert.equal(g.userData.itemId,i.id);assert.equal(g.userData.side,side);
 const size=new T.Box3().setFromObject(g).getSize(new T.Vector3());assert(size.x>0&&size.y>0&&size.z>.05);
 g.traverse(o=>{if(o.geometry)for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));});disposeGroup(g);}}
});
await test('at least two owned items in each mandatory group and genuinely different silhouettes',()=>{
 const size=i=>new T.Box3().setFromObject(garment(i)).getSize(new T.Vector3());
 for(const cat of ['top','bottom','outer','shoes'])assert(items.filter(i=>i.cat===cat).length>=2);
 const find=t=>items.find(i=>C.mapping(i).garmentType===t);
 assert(size(find('coat')).y>size(find('bomber')).y+.4);
 assert(size(find('balloon')).x>size(find('straight')).x+.03);
 assert(size(find('longtee')||find('hoodie')).y>size(find('tee')).y);
 assert(size(find('chunky')).z>size(find('derby')).z);
});
await test('neutral mannequin stays present when independent garment layers are removed',()=>{
 const avatar=mannequin(),baseCount=avatar.children.length;
 const picks=['top','middle','outer','bottom','shoes'].map(slot=>items.find(i=>C.mapping(i).slot===slot&&C.mapping(i).templateId));
 const meshes=picks.map(i=>garment(i));meshes.forEach(g=>avatar.add(g));assert.equal(avatar.children.length,baseCount+5);disposeGroup(meshes[2]);assert.equal(avatar.children.length,baseCount+4);assert(avatar.children.includes(meshes[0]));disposeGroup(avatar);
});
await test('intro matches all four authored positions, lenses and door states',()=>{
 for (const key of ENTRY_KEYS) {
  const pose=C.introPose(key.progress), camera=CAMERAS[key.cameraId];
  assert.deepEqual([pose.x,pose.y,pose.z],toWorld(camera.position));
  assert.equal(pose.focalLengthMm,camera.focalLengthMm);
  assert.equal(pose.door,Number(key.doorState==='open'));
 }
 assert.equal(C.introPose(-1).z,9.6);
 assert(Math.abs(C.introPose(.9999).z-C.introPose(1).z)<.002);
 assert(canStand(C.introPose(1).x,C.introPose(1).z));
 assert.deepEqual(C.walk(C.introPose(1),0,0),C.introPose(1));
});
await test('swept collisions prevent delayed frames tunneling through furniture, walls and door',()=>{
 assert(C.walk({x:0,z:-2},0,-100).z>-4);
 assert(C.walk({x:0,z:-2},100,0).x<5.78);
 assert(C.walk({x:0,z:-1},0,2,[],false).z<=-.52);
 assert(C.walk({x:3,z:-12},0,-3).z>-13);
 for (const x of [-4,0,4]) assert(C.walk({x,z:-12},0,-2).z<=-14, 'the rear portal is walkable');
 const q=C.walk({x:0,z:-2},2,-2);
 assert(q.x>1.9&&q.z<-3.9,'free movement is not limited to zone anchors');
 for (const zone of Object.values(C.ZONES)) assert(canStand(zone.position[0],zone.position[2]));
});
await test('scroll tour hands off without a jump and stays in the showroom aisle',()=>{
 assert.deepEqual(tourPose(0),C.introPose(1));
 for (let step=0;step<=1000;step++){
  const {x,z}=tourPose(step/1000);
  assert(canStand(x,z),`blocked tour at ${x}, ${z}`);
 }
 assert(Math.abs(tourPose(1).z+12.17)<.00001);
});
await test('last selected garment wins even if the previous request resolves late',async()=>{
 const l=new C.LatestSelection(),applied=[],discarded=[];let resolveOld;
 const old=l.run('outer',()=>new Promise(r=>resolveOld=r),v=>applied.push(v),v=>discarded.push(v));
 await l.run('outer',async()=>'new',v=>applied.push(v));resolveOld('old');await old;
 assert.deepEqual(applied,['new']);assert.deepEqual(discarded,['old']);
 await assert.rejects(()=>l.run('outer',async()=>{throw Error('404');},v=>applied.push(v)));assert.deepEqual(applied,['new']);
 let end;const stale=l.run('top',()=>new Promise(r=>end=r),v=>applied.push(v));l.cancel();end('cancelled');assert.equal(await stale,false);
});
const chosen=items.filter(i=>C.mapping(i).templateId).slice(0,4),fit={};chosen.forEach(i=>fit[C.mapping(i).slot]=C.selectionFor(i));
const fragrance=items.find(i=>i.cat==='fragrance').id;
await test('virtual save/restore uses a separate key and references, never images or actual wear counters',()=>{
 const data=new Map([['existing-records','untouched']]),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},s=new C.SaveStore(storage);
 const look=C.snapshot(fit,fragrance,items,'local test');s.save(look);assert.equal(s.read()[0].fragrance,fragrance);assert.equal(data.get('existing-records'),'untouched');
 const raw=data.get(s.key);assert(!raw.includes('data:image'));assert(!raw.includes('wearCount'));assert.equal(s.import(raw).length,1);
 const legacy={...look,modelVersion:'template-1'};
 assert.deepEqual(C.parseSaves(JSON.stringify({schema:1,looks:[legacy]})),[legacy]);
 const second=C.snapshot(fit,null,items,'second');s.import(JSON.stringify({schema:1,looks:[second]}));assert.equal(s.read().length,2);
 const bad={...look,fit:{evil:{itemId:'x'}}};assert.throws(()=>s.import(JSON.stringify({schema:1,looks:[bad]})));assert.equal(s.read().length,2);
});
await test('storage quota, malformed backups and invalid fragrance never report success',()=>{
 const s=new C.SaveStore({getItem:()=>null,setItem:()=>{throw Error('QuotaExceededError');}});
 assert.throws(()=>s.save(C.snapshot(fit,fragrance,items)));
 for(const bad of ['{','null',' '.repeat(512001),JSON.stringify({schema:1,looks:[{}]})])assert.throws(()=>C.parseSaves(bad));
 assert.throws(()=>C.snapshot(fit,'missing',items));assert.throws(()=>C.snapshot({},null,items));
});
await test('deleted and edited item references are reconciled without altering originals',()=>{
 const id=Object.values(fit)[0].itemId,clean=C.reconcile(fit,items.filter(i=>i.id!==id));assert(clean.removed.includes(id));
 const changed=items.map(i=>i.id===id?{...i,color:'pink'}:i);assert(C.reconcile(fit,changed).changed.includes(id));assert.throws(()=>C.snapshot(fit,null,changed));
 const i=items[0];assert.notEqual(C.signature(i),C.signature({...i,image:'changed'+i.image}));
 const r=items.find(i=>i.name.includes('リバーシブル')||i.name.includes('리버서블'));assert.equal(C.selectionFor(r,'바람막이 면').side,'바람막이 면');
});
await test('fragrance ranking uses registered metadata and explicitly signals missing scent notes',()=>{
 const f={season:'fall',formality:'smart',tags:['여행']};const a=C.fragranceMatches(f,{season:'fall',occasion:'office',tag:'여행'});
 assert.equal(a.score,6);assert.equal(a.hasNotes,false);assert.equal(C.fragranceMatches({},{}).score,0);
});
await test('optional photo AI stays disconnected and cannot report a fake generated result',async()=>{
 assert.equal(photoPreview.enabled,false);assert.equal(photoPreview.provider,null);await assert.rejects(()=>photoPreview.generate(),/전송하지 않았/);
 assert(!read('shop3d/ai-preview.mjs').includes('fetch('));
});
console.log(JSON.stringify({tests:checked,items:items.length,support:counts}));
