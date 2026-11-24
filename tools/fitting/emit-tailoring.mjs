// Converts the project's cloth patterns to an intermediate Blender mesh file.
// The file is temporary. Blender binds, authors material slots, and exports GLB.
import { writeFile } from 'node:fs/promises';
import { buildGarment } from '../../shop3d/tailoring.mjs';

const output = process.argv[2];
if (!output) throw Error('Pass an output path for the intermediate mesh data.');

const definitions = {
  mf_garment_tee_01: { garmentType: 'tee', color: '#ded7c8', material: 'woven' },
  mf_garment_coat_01: { garmentType: 'coat', color: '#594235', material: 'knit' },
  mf_garment_knit_01: { garmentType: 'knit', color: '#b8a384', material: 'knit' },
  mf_garment_shirt_01: { garmentType: 'shirt', color: '#c8c4b5', material: 'woven' },
  mf_garment_trouser_01: { garmentType: 'straight', color: '#46433d', material: 'woven' },
  mf_shoe_derby_01: { garmentType: 'derby', color: '#49362b', material: 'leather' },
};

function serializeMesh(mesh) {
  const geometry = mesh.geometry;
  const material = mesh.material;
  return {
    region: mesh.name,
    position: Array.from(geometry.attributes.position.array),
    indices: Array.from(geometry.index.array),
    normal: Array.from(geometry.attributes.normal.array),
    uv: Array.from(geometry.attributes.uv.array),
    tone: Array.from(geometry.attributes.color.array).filter((_, index) => index % 3 === 0),
    material: {
      name: material.name,
      color: material.color.toArray(),
      roughness: material.roughness,
      metalness: material.metalness,
    },
  };
}

const garments = Object.fromEntries(Object.entries(definitions).map(([name, definition]) => [
  name, buildGarment(definition).children.map(serializeMesh),
]));

await writeFile(output, JSON.stringify(garments));
