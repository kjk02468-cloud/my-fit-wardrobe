// List exact browser assets and their provenance. Run from any directory.
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';

const shop = fileURLToPath(new URL('../../shop3d/',import.meta.url));
function filesIn(directory) {
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry => {
    const path = join(directory,entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}
const files = ['production','assets/fitting'].flatMap(folder => filesIn(join(shop,folder)));
const rows = files.filter(file => /\.(glb|ktx2|webp|png)$/i.test(file)).sort().map(file => {
  const bytes = readFileSync(file);
  const path = relative(shop,file).replaceAll('\\','/');
  const type = path.split('.').pop();
  const row = {path,type,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  if (type === 'glb') {
    if (bytes.toString('ascii',0,4) !== 'glTF' || bytes.readUInt32LE(8) !== bytes.length) throw Error('Invalid GLB: '+path);
    const json = JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
    row.generator = json.asset.generator;
    row.triangles = (json.meshes || []).flatMap(mesh => mesh.primitives).reduce((sum,primitive) => {
      return primitive.mode === undefined || primitive.mode === 4
        ? sum + json.accessors[primitive.indices ?? primitive.attributes.POSITION].count/3
        : sum;
    },0);
    row.skins = json.skins?.length || 0;
    row.extensions = json.extensionsUsed || [];
  }
  if (type === 'ktx2') {
    row.width = bytes.readUInt32LE(20);
    row.height = bytes.readUInt32LE(24);
    row.mips = bytes.readUInt32LE(40);
  }
  return row;
});
const manifest = {
  version: 2,
  coordinateSystem: 'Metres, design east/north/up maps to GLB x/y/z as X/Z/-Y',
  licenses: {
    storeAndTailoring:'Project-authored Blender geometry and materials derived from supplied MY FIT design references',
    avatarBase:'Innerscene MakeHuman-derived base, CC0. See tools/fitting/README.md',
  },
  totalBytes: rows.reduce((sum,asset) => sum+asset.bytes,0),
  assetCount: rows.length,
  assets: rows,
};
writeFileSync(join(shop,'production/mf_asset_manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({assets:manifest.assetCount,bytes:manifest.totalBytes,glbs:rows.filter(row => row.type === 'glb').length}));
