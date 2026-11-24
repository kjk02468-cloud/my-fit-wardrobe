import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import * as T from './vendor/three.module.min.js';
import {assetBuilders} from './architecture-source.mjs';

// The intermediate glTF files are imported into the native Blender scene by
// build-architecture-blender.py. Units and pivots are preserved through export.
const output=process.argv[2];
if(!output) throw new Error('Usage: node shop3d/build-architecture.mjs <intermediate directory>');
await mkdir(output,{recursive:true});

function encode(root){
  const document={asset:{version:'2.0',generator:'MY FIT geometry source'},scene:0,
    scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[],accessors:[],bufferViews:[],buffers:[{}]};
  const binary=[];
  let binaryLength=0;
  function accessor(values,type,components,target,range=false){
    const bytes=Buffer.from(values.buffer,values.byteOffset,values.byteLength);
    const index=document.bufferViews.length;
    document.bufferViews.push({buffer:0,byteOffset:binaryLength,byteLength:bytes.length,target});
    binary.push(bytes); binaryLength+=bytes.length;
    const pad=(4-binaryLength%4)%4;
    if(pad){binary.push(Buffer.alloc(pad));binaryLength+=pad;}
    const record={bufferView:index,componentType:values instanceof Float32Array?5126:5125,
      count:values.length/components,type};
    if(range){
      record.min=Array(components).fill(Infinity);record.max=Array(components).fill(-Infinity);
      for(let i=0;i<values.length;i++){
        const c=i%components;record.min[c]=Math.min(record.min[c],values[i]);record.max[c]=Math.max(record.max[c],values[i]);
      }
    }
    return document.accessors.push(record)-1;
  }
  const materialIds=new Map();
  function convertMaterial(m){
    if(materialIds.has(m))return materialIds.get(m);
    const result={name:m.name,pbrMetallicRoughness:{baseColorFactor:[...m.color.toArray(),m.opacity],
      metallicFactor:m.metalness,roughnessFactor:m.roughness}};
    if(m.transparent){result.alphaMode='BLEND';result.doubleSided=true;}
    if(m.emissive.getHex()) result.emissiveFactor=m.emissive.toArray();
    const index=document.materials.push(result)-1;
    materialIds.set(m,index);return index;
  }
  const segregated=/^(door-|zone__|fragrance__|cutaway-|fitting-occlusion|baked-floor)/;
  function addGroup(source, matrix, sceneNodes){
    const node={name:source.name,children:[]};
    const index=document.nodes.push(node)-1;sceneNodes.push(index);
    if(source.position.lengthSq()) node.translation=source.position.toArray();
    if(source.quaternion.x||source.quaternion.y||source.quaternion.z)node.rotation=source.quaternion.toArray();
    if(!source.scale.equals(new T.Vector3(1,1,1)))node.scale=source.scale.toArray();
    const materials=new Map();
    const point=new T.Vector3(), direction=new T.Vector3();
    function appendMesh(m,transform){
      const {position,normal,uv}=m.geometry.attributes;
      const {index:geometryIndices}=m.geometry;
      const normalMatrix=new T.Matrix3().getNormalMatrix(transform);
      let bucket=materials.get(m.material);
      if(!bucket){bucket={points:[],directions:[],uvs:[],indices:[],vertices:new Map()};materials.set(m.material,bucket);}
      const local=[];
      for(let i=0;i<position.count;i++){
        point.fromBufferAttribute(position,i).applyMatrix4(transform);
        direction.fromBufferAttribute(normal,i).applyNormalMatrix(normalMatrix);
        const values=[...point.toArray(),...direction.toArray(),uv?.getX(i)??0,uv?.getY(i)??0];
        const key=values.map(n=>Math.round(n*100000)).join(',');
        let vertex=bucket.vertices.get(key);
        if(vertex===undefined){
          vertex=bucket.vertices.size;bucket.vertices.set(key,vertex);
          bucket.points.push(...values.slice(0,3));bucket.directions.push(...values.slice(3,6));bucket.uvs.push(...values.slice(6));
        }
        local.push(vertex);
      }
      const count=geometryIndices?.count??local.length;
      for(let i=0;i<count;i++) bucket.indices.push(local[geometryIndices?.getX(i)??i]);
    }
    function walk(object, transform){
      object.updateMatrix();
      if(object.isMesh){appendMesh(object,transform.clone().multiply(object.matrix));return;}
      if(segregated.test(object.name)) {
        const child=addGroup(object,new T.Matrix4(),node.children);
        const placement=transform.clone().multiply(object.matrix);
        const pos=new T.Vector3(), rot=new T.Quaternion(), scale=new T.Vector3();
        placement.decompose(pos,rot,scale);
        Object.assign(child,{translation:pos.toArray(),rotation:rot.toArray(),scale:scale.toArray()});
        return;
      }
      const next=transform.clone().multiply(object.matrix);
      object.children.forEach(c=>walk(c,next));
    }
    source.children.forEach(c=>walk(c,matrix));
    if(materials.size){
      const primitives=[];
      for(const [m,b] of materials){
        // Ignore degenerate lathe poles. Some importers retain these as zero-area faces.
        const valid=[];
        for(let i=0;i<b.indices.length;i+=3){
          const [a,c,d]=b.indices.slice(i,i+3);
          if(a!==c&&c!==d&&a!==d)valid.push(a,c,d);
        }
        if(!valid.length)continue;
        primitives.push({material:convertMaterial(m),attributes:{
          POSITION:accessor(Float32Array.from(b.points),'VEC3',3,34962,true),
          NORMAL:accessor(Float32Array.from(b.directions),'VEC3',3,34962),
          TEXCOORD_0:accessor(Float32Array.from(b.uvs),'VEC2',2,34962),
        },indices:accessor(Uint32Array.from(valid),'SCALAR',1,34963)});
      }
      node.mesh=document.meshes.push({name:source.name,primitives})-1;
    }
    if(!node.children.length)delete node.children;
    return node;
  }
  addGroup(root,new T.Matrix4(),document.scenes[0].nodes);
  document.buffers[0].byteLength=binaryLength;
  const json=Buffer.from(JSON.stringify(document));
  const padding=Buffer.alloc((4-json.length%4)%4,0x20);
  const header=Buffer.alloc(12);header.write('glTF');header.writeUInt32LE(2,4);
  header.writeUInt32LE(12+8+json.length+padding.length+8+binaryLength,8);
  const chunk=(length,name)=>{const b=Buffer.alloc(8);b.writeUInt32LE(length);b.write(name,4,'binary');return b;};
  return Buffer.concat([header,chunk(json.length+padding.length,'JSON'),json,padding,chunk(binaryLength,'BIN\0'),...binary]);
}

for(const [name,build] of Object.entries(assetBuilders)){
  const bytes=encode(build());
  await writeFile(resolve(output,`${name}.glb`),bytes);
  console.log(`${name}: ${bytes.length.toLocaleString('en')} bytes`);
}
