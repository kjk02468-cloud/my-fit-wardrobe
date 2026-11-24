import * as T from './vendor/three.module.min.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {DRACOLoader} from './vendor/DRACOLoader.js';
import {garmentAnchors} from './architecture-source.mjs';

const BASE=new URL('./production/',import.meta.url);
const CODECS=new URL('./vendor/',import.meta.url).href;
const PARTS=['mf_facade','mf_store_shell','mf_room_fitting','mf_room_consult',
  'mf_room_ootd','mf_fragrance_counter','mf_fragrance_props'];
const getURL=name=>{
  const url=new URL(name,BASE);
  url.searchParams.set('v','reference-materials-2');
  return url.href;
};

function environmentMap(){
  const w=192,h=96;
  const data=new Float32Array(w*h*4);
  const sources=[[-.76,.58,4.2,.10,.13],[.32,.65,2.4,.27,.16],[.74,.49,2.1,.045,.22]];
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const u=x/w*2-1,v=1-y/h;
    const lamps=sources.reduce((sum,[u0,v0,strength,width,height])=>sum+strength*Math.exp(-(((u-u0)/width)**2+((v-v0)/height)**2)),0);
    const ambient=.19+Math.max(0,(v-.36))*.27;
    const i=(x+y*w)*4;
    data.set([ambient+lamps,ambient*.9+lamps*.8,ambient*.8+lamps*.61,1],i);
  }
  const texture=new T.DataTexture(data,w,h,T.RGBAFormat,T.FloatType);
  texture.mapping=T.EquirectangularReflectionMapping;
  texture.colorSpace=T.LinearSRGBColorSpace;
  texture.needsUpdate=true;
  return texture;
}

function textSign(parent, {text,x,y,z,width,height,turn=0,ink='#f5d8ac',zone,spacing='7px'}){
  const canvas=document.createElement('canvas');
  canvas.width=1024;
  canvas.height=Math.round(1024*height/width);
  const ctx=canvas.getContext('2d');
  ctx.font=`${Math.round(canvas.height*.7)}px Georgia, serif`;
  ctx.letterSpacing=spacing;
  ctx.fillStyle=ink;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(text,canvas.width/2,canvas.height*.52,canvas.width*.96);
  const map=new T.CanvasTexture(canvas);
  map.colorSpace=T.SRGBColorSpace;
  const sign=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}));
  sign.position.set(x,y,z);sign.rotation.y=turn;
  if(zone)sign.userData.zone=zone;
  parent.add(sign);
  return sign;
}

function makeLighting(root, bakedArchitecture){
  const sky=new T.HemisphereLight(0xfff5ea,0x8c8176,.62);
  const sun=new T.DirectionalLight(0xffefdc,.82);
  sun.position.set(-5.8,7.8,6.8);
  sun.target.position.set(0,0,-6.1);
  sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-8,right:8,top:11,bottom:-10,near:.2,far:29});
  sun.shadow.bias=-.00038;sun.shadow.normalBias=.022;sun.shadow.intensity=.64;
  root.add(sky,sun,sun.target);
  const interiors=[];
  function spot(position,target,intensity,angle,cast=false){
    const light=new T.SpotLight(0xffe7cc,intensity,11,angle,.72,2);
    light.position.set(...position);light.target.position.set(...target);
    light.castShadow=cast;
    if(cast){light.shadow.mapSize.set(1024,1024);light.shadow.bias=-.00028;light.shadow.normalBias=.019;light.shadow.intensity=.72;}
    root.add(light,light.target);interiors.push([light,intensity]);
  }
  function area(position,color,intensity,distance){
    const light=new T.PointLight(color,intensity,distance,2);
    light.position.set(...position);root.add(light);interiors.push([light,intensity]);
  }
  // The baked scene keeps the warm pools and contact shadows. Real-time
  // lights mainly light the user-owned garments and the moving avatar.
  if (bakedArchitecture) {
    area([-4.54,2.55,-5.5],0xffebd2,13,7.5);
    area([-4.4,2.39,-9.45],0xffe3c2,8,5.4);
    area([0,2.65,-.89],0xffd2a3,9,6.6);
    spot([-4.16,3.61,-14.7],[-4,.98,-16.95],26,.75,true);
  } else {
    spot([-3.54,3.61,-3.9],[-5.65,1.48,-5.6],26,.84);
    spot([3.54,3.61,-8.6],[5.58,1.3,-9.4],25,.87);
    spot([-.35,3.64,-5.95],[.22,.46,-6.85],35,.83,true);
    spot([-4.2,3.62,-15.37],[-4,0,-17.25],30,.69);
    spot([.15,3.61,-15.17],[0,.37,-16.1],29,.83);
    spot([4,3.63,-16.30],[4,.55,-18.02],31,.84);
  }
  function setNight(night){
    sky.color.set(night?0x8d9cb8:0xfff5ea);
    sky.groundColor.set(night?0x504e51:0x8c8176);
    sky.intensity=bakedArchitecture?(night?.35:.64):(night?.64:1.03);
    sun.color.set(night?0x819ac6:0xffefdc);
    sun.intensity=bakedArchitecture?(night?.19:.74):(night?.38:1.6);
    sun.castShadow=!night&&!bakedArchitecture;
    for(const [light,brightness] of interiors)light.intensity=brightness*(night?1.28:1);
  }
  return setNight;
}

async function bindFinishes(root,renderer,onError){
  const manifestResponse=await fetch(getURL('materials/finishes.json'));
  if(!manifestResponse.ok)throw new Error('Architectural texture manifest could not be loaded');
  const finishes=await manifestResponse.json();
  const loader=new T.TextureLoader();
  const mobile = window.innerWidth <= 700;
  let compressed;
  const extensions=['WEBGL_compressed_texture_astc','EXT_texture_compression_bptc',
    'WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_etc','WEBGL_compressed_texture_etc1',
    'WEBGL_compressed_texture_pvrtc','WEBKIT_WEBGL_compressed_texture_pvrtc'];
  if(!mobile && renderer && Object.values(finishes).some(finish=>finish.ktx2) &&
      extensions.some(name=>renderer.extensions.has(name))){
    try {
      const {KTX2Loader}=await import('./vendor/KTX2Loader.js');
      compressed=new KTX2Loader().setTranscoderPath(CODECS).setWorkerLimit(2).detectSupport(renderer);
    } catch(error) { onError?.(error); }
  }
  const slots=new Map();
  const textileTints={whiteWool:0xf5ede2,fogWool:0x909894,oliveWool:0x8e9279,navyWool:0x697276};
  root.traverse(o=>{
    if(!o.isMesh)return;
    for(const material of [].concat(o.material)){
      const name=material.name.replace(/\.\d{3}$/,'');
      const finishKey=name==='ceiling'?'plaster':textileTints[name]?'linen':name;
      if(!finishes[finishKey])continue;
      if(!slots.has(finishKey))slots.set(finishKey,new Map());
      slots.get(finishKey).set(material,name);
    }
  });
  const jobs=[];
  for(const [name,materials] of slots){
    const finish=finishes[name];
    jobs.push((async()=>{
      const kinds=['base','normal','orm'];
      const maps=await Promise.all(kinds.map(async kind=>{
        if(compressed&&finish.ktx2?.[kind]){
          try{return await compressed.loadAsync(getURL(`materials/${finish.ktx2[kind]}`));}
          catch(error){onError?.(error);}
        }
        const webp = mobile ? (finish.mobile?.[kind] || finish[kind]) : finish[kind];
        return loader.loadAsync(getURL(`materials/${webp}`));
      }));
      for(const map of maps){
        map.wrapS=map.wrapT=T.RepeatWrapping;
        map.repeat.setScalar(1/finish.tileMetres);
        map.anisotropy=4;
        map.flipY=false;
      }
      maps[0].colorSpace=T.SRGBColorSpace;
      for(const [m,materialName] of materials){
        m.color.set(textileTints[materialName]||0xffffff);
        [m.map,m.normalMap,m.aoMap]=maps;
        m.roughnessMap=m.metalnessMap=m.aoMap;
        m.roughness=1;m.metalness=1;
        m.normalScale.setScalar(name==='oak'?.70:.54);
        m.aoMapIntensity=.85;
        m.needsUpdate=true;
      }
    })().catch(error=>onError?.(error)));
  }
  await Promise.all(jobs);
  compressed?.dispose();
  const bakeMaterials=new Set(), clones=new Map();
  const atlas=Boolean(finishes.oak?.architectureBake);
  const bakedRoot=atlas?root:root.getObjectByName('baked-floor');
  bakedRoot?.traverse(object=>{
    if(!object.isMesh||!object.geometry.hasAttribute('uv1'))return;
    const withLightMap=material=>{
      if(material.transparent||material.emissive?.getHex())return material;
      if(!clones.has(material)){
        const copy=material.clone();clones.set(material,copy);bakeMaterials.add(copy);
      }
      return clones.get(material);
    };
    object.material=Array.isArray(object.material)?object.material.map(withLightMap):withLightMap(object.material);
  });
  if(bakeMaterials.size){
    try {
      const bake=await loader.loadAsync(getURL(`materials/${atlas?finishes.oak.architectureBake:'store-diffuse-bake.webp'}`));
      bake.colorSpace=T.SRGBColorSpace;bake.channel=1;bake.flipY=false;
      for(const m of bakeMaterials){m.lightMap=bake;m.lightMapIntensity=atlas?1.5:.54;m.needsUpdate=true;}
      return {bakeMaterials,atlas};
    } catch(error) { onError?.(error); }
  }
  return {bakeMaterials:new Set(),atlas:false};
}

export async function loadArchitecture({renderer,onError}={}){
  const root=new T.Group();root.name='MY FIT connected architecture';
  const loader=new GLTFLoader();
  const draco=new DRACOLoader().setDecoderPath(CODECS).setDecoderConfig({type:'wasm'}).setWorkerLimit(2);
  loader.setDRACOLoader(draco);
  const parts=await Promise.all(PARTS.map(async name=>{
    const model=await loader.loadAsync(getURL(`${name}.glb`));
    model.scene.name=name;
    return model.scene;
  })).finally(()=>draco.dispose());
  root.add(...parts);
  const occluders=[], pickables=[], doors=[];
  const cutaway=[];
  root.traverse(o=>{
    const name=o.userData.name||o.name;
    if(name.startsWith('fitting-occlusion') || name==='zone__fitting')occluders.push(o);
    if(name.startsWith('cutaway-') || name==='mf_facade')cutaway.push(o);
    if(name==='door-left'||name==='door-right') doors.push({group:o,s:name.endsWith('right')?1:-1});
    if(o.isMesh){
      const materials=[].concat(o.material);
      o.castShadow=!materials.some(m=>m.transparent||m.emissive?.getHex());
      o.receiveShadow=!materials.some(m=>m.transparent);
      if(o.parent?.name==='cutaway-ceiling'||o.name.includes('cutaway-ceiling'))o.castShadow=false;
    }
  });
  root.traverse(o=>{
    const name=o.userData.name||o.name;
    const zone=name.match(/^zone__(fitting|concierge|ootd|fragrance)(?:\.\d{3})?$/)?.[1];
    const fragrance=name.match(/^fragrance__(\d+)(?:\.\d{3})?$/)?.[1];
    if(!zone && fragrance===undefined)return;
    o.traverse(mesh=>{
      if(!mesh.isMesh||pickables.includes(mesh))return;
      mesh.userData.zone=zone||'fragrance';
      if(fragrance!==undefined)mesh.userData.fragranceIndex=Number(fragrance);
      pickables.push(mesh);
    });
  });
  const facade=parts[0];
  const title=textSign(facade,{text:'M Y  F I T',x:0,y:3.635,z:.395,width:2.04,height:.31,ink:'#5e4a34',spacing:'13px'});
  textSign(facade,{text:'P E R S O N A L   S E L E C T   S H O P',x:0,y:3.437,z:.394,width:1.8,height:.084,ink:'#715e46'});
  for(const [zone,label,x] of [['fitting','FITTING ROOM',-4],['concierge','STYLE CONCIERGE',0],['ootd','OOTD STUDIO',4]]){
    const plaque=textSign(root,{text:label,x,y:2.94,z:-12.912,width:1.34,height:.128,zone});
    pickables.push(plaque);
    if(zone==='fitting')occluders.push(plaque);
  }
  pickables.push(textSign(root,{text:'FRAGRANCE BAR',x:5.574,y:3.055,z:-10.17,width:1.71,height:.148,turn:-Math.PI/2,zone:'fragrance'}));
  const environment=environmentMap();
  const {bakeMaterials,atlas}=await bindFinishes(root,renderer,onError).catch(error=>{
    onError?.(error);return {bakeMaterials:new Set(),atlas:false};
  });
  const lighting=makeLighting(root,atlas);
  let mirror;
  let cutawayActive=false;
  if(renderer && window.innerWidth>=1024 && renderer.extensions.has('EXT_color_buffer_float')){
    try {
      const {Reflector}=await import('./vendor/Reflector.js');
      mirror=new Reflector(new T.PlaneGeometry(1.758,2.686),{
        color:0xe0d5bf,textureWidth:320,textureHeight:480,multisample:0,clipBias:.002,
      });
      mirror.position.set(-4,1.575,-18.793);
      mirror.name='Fitting room planar mirror';
      mirror.visible=false;
      root.add(mirror);
    } catch(error) { onError?.(error); }
  }
  function setNight(night){
    lighting(night);
    title.material.color.set(night?0xe9cca8:0xffffff);
    for(const m of bakeMaterials)m.lightMapIntensity=atlas?(night?.72:1.5):(night?.36:.54);
  }
  setNight(false);
  return {root,pickables,doors,occluders,garmentAnchors,environment,
    setDoor(progress){for(const {group,s} of doors)group.rotation.y=-s*progress*Math.PI*.465;},
    setNight,
    setReflection(nearMirror){if(mirror)mirror.visible=nearMirror&&!cutawayActive;},
    setCutaway(enabled){
      cutawayActive=enabled;
      for(const node of [...cutaway,...occluders])node.visible=!enabled;
      if(mirror)mirror.visible=!enabled;
    },
  };
}
