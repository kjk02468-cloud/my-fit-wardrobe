import * as T from './vendor/three.module.min.js';
import {ZONES} from './core.mjs';
export function createWorld(){
 const scene=new T.Scene();scene.background=new T.Color('#aca99f');scene.fog=new T.Fog('#aca99f',24,65);
 const materials={},textures=[],pickables=[],displays=new T.Group(),clothes=new T.Group(),occluders=[];scene.add(displays,clothes);
 const material=(name,color,rough=.8,metal=0)=>materials[name]||(materials[name]=new T.MeshStandardMaterial({color,roughness:rough,metalness:metal}));
 const cream=material('cream','#c9c2b4'),dark=material('dark','#292b2a'),wood=material('wood','#5c4332'),metal=material('metal','#a5a39b',.3,.7),floor=material('floor','#b7b0a1',.75),soft=material('soft','#e2dac9');
 const c=document.createElement('canvas');c.width=64;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#69503b';ctx.fillRect(0,0,64,256);for(let i=0;i<90;i++){ctx.fillStyle=`rgba(19,10,3,${.04+(i%7)*.012})`;ctx.fillRect((i*17)%64,0,1,256);}const wt=new T.CanvasTexture(c);wt.wrapS=wt.wrapT=T.RepeatWrapping;wt.repeat.set(2,2);wt.colorSpace=T.SRGBColorSpace;wood.map=wt;textures.push(wt);
 const box=(x,y,z,w,h,d,m,parent=scene)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const tube=(a,b,r,m)=>{const v=new T.Vector3(...b).sub(new T.Vector3(...a));const o=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),12),m);o.position.copy(new T.Vector3(...a).add(new T.Vector3(...b)).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());scene.add(o);return o;};
 function sign(text,x,y,z,w=3,h=.42,rotation=0,parent=scene){const c=document.createElement('canvas');c.width=1024;c.height=256;const g=c.getContext('2d');g.fillStyle='#292b29';g.fillRect(0,0,1024,256);g.fillStyle='#ece5d5';g.font='110px Georgia';g.textAlign='center';g.textBaseline='middle';g.fillText(text,512,128,950);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;textures.push(t);const o=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:t,side:T.DoubleSide}));o.position.set(x,y,z);o.rotation.y=rotation;parent.add(o);occluders.push(o);return o;}
 box(0,-.15,8,36,.3,42,floor);box(0,-.02,0,16,.09,16,floor);
 occluders.push(box(-7.9,2,0,.2,4,16,cream),box(7.9,2,0,.2,4,16,cream),box(0,2,-8,16,4,.2,wood));
 box(0,4.05,0,16,.12,16,cream).castShadow=false;
 for(const x of [-4.8,4.8]){box(x,.22,8,6.3,.44,.3,dark);box(x,3.65,8,6.3,.7,.3,dark);box(x,1.85,8,6.1,2.85,.04,new T.MeshPhysicalMaterial({color:'#c4c8bd',transparent:true,opacity:.12,roughness:.1}));for(const s of [-1,1])box(x+s*3.08,2,8,.14,4,.3,dark);}box(0,3.65,8,3.6,.7,.4,dark);
 sign('MY FIT.',0,3.7,8.23,3.3,.57);sign('YOUR PERSONAL SELECT SHOP',0,3.13,8.23,3,.23);
 const glass=new T.MeshPhysicalMaterial({color:'#a9bbb7',transparent:true,opacity:.20,roughness:.15,metalness:.1});
 const doors=[];for(const s of [-1,1]){const group=new T.Group();group.position.set(s*1.65,0,8);scene.add(group);box(-s*.80,1.5,0,1.6,3,.06,glass,group);box(-s*1.53,1.5,.05,.045,3,.06,metal,group);box(-s*.8,2.98,0,1.6,.035,.08,metal,group);box(-s*1.35,1.15,.12,.025,.44,.03,metal,group);doors.push({group,s});}
 // Thin brass floor seams and rhythm of timber on the rear wall.
 for(let i=-6;i<=6;i+=2){box(i,.04,0,.012,.005,16,metal);box(0,.04,i,16,.005,.012,metal);}
 const slatGeometry=new T.BoxGeometry(.045,3.4,.07),slats=new T.InstancedMesh(slatGeometry,wood,64),dummy=new T.Object3D();for(let i=0;i<64;i++){dummy.position.set(-7.7+i*.245,1.9,-7.84);dummy.updateMatrix();slats.setMatrixAt(i,dummy.matrix);}scene.add(slats);occluders.push(slats);
 // Ceiling light ribbons create a warm, quiet gallery instead of a game HUD.
 const glow=new T.MeshBasicMaterial({color:'#ffe2af'});for(const x of [-6,-3,0,3,6]){box(x,3.8,0,.04,.025,13,glow);box(x,3.87,0,.14,.08,13,dark);}
 scene.add(new T.HemisphereLight('#fff3dc','#776f62',2.5));const sunlight=new T.DirectionalLight('#ffedd5',3.2);sunlight.position.set(-5,9,8);sunlight.castShadow=true;sunlight.shadow.mapSize.set(1024,1024);Object.assign(sunlight.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.5,far:32});sunlight.shadow.bias=-.001;scene.add(sunlight);
 box(0,.37,0,3,.74,2,wood);box(0,.77,0,3.1,.08,2.1,soft);
 box(-5.7,.55,2.65,2,1.1,1.3,wood);box(-5.7,1.12,2.65,2.1,.08,1.4,soft);
 const concierge=sign('STYLE CONCIERGE',-5.7,1.6,2.9,2.2,.35);concierge.userData.zone='concierge';pickables.push(concierge);
 box(6.2,.65,0,1.2,1.3,5.3,wood);box(6.2,1.33,0,1.3,.08,5.4,soft);
 const perfume=sign('FRAGRANCE BAR',7.75,2.65,0,3.2,.4,-Math.PI/2);perfume.userData.zone='fragrance';pickables.push(perfume);
 for(let j=0;j<6;j++){const bottle=new T.Mesh(new T.BoxGeometry(.14,.25,.10),new T.MeshStandardMaterial({color:'#a8ad89',roughness:.25,transparent:true,opacity:.85}));bottle.position.set(6.2,1.51,-2+j*.8);scene.add(bottle);box(6.2,1.68,-2+j*.8,.095,.09,.08,dark);}
 sign('GENERAL DISPLAY BOTTLES',6.2,1.2,2.71,1.2,.12);
 occluders.push(box(-4.5,1.45,-3,5,2.9,.16,cream),box(-2.1,1.45,-6.5,.16,2.9,2.2,cream));
 box(-4.5,.02,-5.4,4.6,.045,4.3,wood);box(-4.5,.08,-5.8,2.2,.13,1.8,soft);
 const fitting=sign('FITTING ROOM',-4.5,2.5,-2.90,3,.42);fitting.userData.zone='fitting';pickables.push(fitting);occluders.push(fitting);
 occluders.push(box(-4.5,1.58,-7.7,1.6,2.7,.04,metal));sign('STYLE / SILHOUETTE',-4.5,2.9,-7.65,2.1,.22);
 box(4.4,1.45,-3,4.8,2.9,.16,cream);box(4.5,.025,-5.4,4.7,.06,4.4,soft);
 const studio=sign('OOTD STUDIO',4.4,2.5,-2.90,3,.42);studio.userData.zone='ootd';pickables.push(studio);
 box(4.5,1.7,-7.6,3.6,3.4,.10,soft);sign('A RECORD OF YOUR DAY',4.5,2.8,-7.51,3,.2);
 sign('MAIN SHOWROOM',0,3,-7.72,3.6,.45);
 for(const x of [-6,6])for(const z of [4.8,-1.1]){tube([x-1,0,z],[x-1,2.3,z],.025,metal);tube([x+1,0,z],[x+1,2.3,z],.025,metal);tube([x-1,2.3,z],[x+1,2.3,z],.024,metal);}
 let generation=0;
 function setProducts(items){generation++;const epoch=generation;for(const o of [...displays.children]){o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();displays.remove(o);}for(let i=pickables.length-1;i>=0;i--)if(pickables[i].userData.itemId)pickables.splice(i,1);
  const chosen=[];for(const cat of ['outer','top','bottom','shoes','bag','accessory'])chosen.push(...items.filter(i=>i.cat===cat).slice(0,2));
  chosen.forEach((item,i)=>{const x=i<6?-7.72:7.72,z=6.5-(i%6)*1.6,rot=i<6?Math.PI/2:-Math.PI/2;
   const board=new T.Mesh(new T.PlaneGeometry(1.06,1.20),new T.MeshStandardMaterial({color:'#eee8dd',side:T.DoubleSide,roughness:.85}));board.position.set(x,1.7,z);board.rotation.y=rot;board.userData.itemId=item.id;displays.add(board);pickables.push(board);
   if(item.image){new T.TextureLoader().load(item.image,tex=>{if(generation!==epoch){tex.dispose();return;}const c=document.createElement('canvas');c.width=384;c.height=440;const ctx=c.getContext('2d');ctx.fillStyle='#eee8dd';ctx.fillRect(0,0,384,440);const im=tex.image,scale=Math.min(370/im.width,420/im.height);ctx.drawImage(im,(384-im.width*scale)/2,(440-im.height*scale)/2,im.width*scale,im.height*scale);const small=new T.CanvasTexture(c);small.colorSpace=T.SRGBColorSpace;tex.dispose();board.material.map=small;board.material.needsUpdate=true;},undefined,()=>{});}
  });
 }
 function setGarmentDisplays(items,build,dispose){
  for(const o of [...clothes.children])dispose(o);
  for(let i=pickables.length-1;i>=0;i--)if(pickables[i].userData.displayModel)pickables.splice(i,1);
  const selected=[...items.filter(i=>i.cat==='outer').slice(0,4),...items.filter(i=>i.cat==='top').slice(0,4)];
  selected.forEach((item,i)=>{const row=Math.floor(i/2),x=[-6,6,-6,6][row]+(i%2? .43:-.43),z=row<2?4.8:-1.1,g=build(item);g.position.set(x,.57,z);g.rotation.y=row%2?-.22:.22;clothes.add(g);g.traverse(o=>{if(o.isMesh){o.userData.itemId=item.id;o.userData.displayModel=true;pickables.push(o);}});
   const hanger=new T.Group();clothes.add(hanger);hanger.position.set(x,2.19,z);for(const s of [-1,1]){const bar=new T.Mesh(new T.BoxGeometry(.27,.035,.025),new T.MeshStandardMaterial({color:'#a0835c'}));bar.position.set(s*.12,-.06,0);bar.rotation.z=-s*.4;hanger.add(bar);}const hook=new T.Mesh(new T.TorusGeometry(.055,.008,6,16,Math.PI*1.6),new T.MeshStandardMaterial({color:'#a5a39b',metalness:.7,roughness:.3}));hook.position.y=.06;hanger.add(hook);
  });
  items.filter(i=>i.cat==='shoes').slice(0,3).forEach((item,i)=>{const g=build(item);g.position.set(-.9+i*.9,.82,0);g.rotation.y=.3;clothes.add(g);g.traverse(o=>{if(o.isMesh){o.userData.itemId=item.id;o.userData.displayModel=true;pickables.push(o);}});});
 }
 return {scene,pickables,doors,setProducts,setGarmentDisplays,setFitting(value){occluders.forEach(o=>o.visible=!value);},setDoor(t){for(const {group,s}of doors)group.rotation.y=s*t*Math.PI*.48;},dispose(){scene.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});textures.forEach(t=>t.dispose());}};
}
