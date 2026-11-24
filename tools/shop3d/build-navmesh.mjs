// Run from the repository: node tools/shop3d/build-navmesh.mjs <blender.exe> <source.blend>
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {canStand, INTERIOR} from '../../shop3d/layout.mjs';

const [blender, source] = process.argv.slice(2);
if (!blender || !source) throw new Error('Supply Blender and a destination for the native .blend source');
const step = .1;
const vertices = [], faces = [], indices = new Map();
function point(column, row) {
  const key = column + ',' + row;
  if (!indices.has(key)) {
    indices.set(key, vertices.length);
    vertices.push([column*step-INTERIOR.width/2,row*step,.012]);
  }
  return indices.get(key);
}
for (let row = 0; row < INTERIOR.depth/step; row++) {
  for (let column = 0; column < INTERIOR.width/step; column++) {
    const corners = [[column,row],[column+1,row],[column+1,row+1],[column,row+1]];
    if (corners.every(([x,y]) => canStand(x*step-INTERIOR.width/2,-y*step))) {
      faces.push(corners.map(([x,y]) => point(x,y)));
    }
  }
}
const temp = mkdtempSync(join(tmpdir(),'my-fit-nav-'));
const meshData = join(temp,'mesh.json');
writeFileSync(meshData,JSON.stringify({vertices,faces}));
const script = fileURLToPath(new URL('./export-navmesh.py',import.meta.url));
const output = fileURLToPath(new URL('../../shop3d/production/mf_navmesh.glb',import.meta.url));
const result = spawnSync(blender,['--background','--factory-startup','--python-exit-code','1',
  '--python',script,'--',meshData,output,resolve(source)],{stdio:'inherit'});
if (result.error || result.status) throw result.error || new Error('Blender navmesh export failed');
