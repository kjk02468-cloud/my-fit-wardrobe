"""Pack fitting diffuse, normal and ORM textures into KTX2 inside the GLBs."""

import argparse
from hashlib import sha256
import json
from pathlib import Path
import struct
import subprocess
from tempfile import TemporaryDirectory


def encode(source, basis, staging, kind):
    name = sha256(source).hexdigest()[:20] + kind
    staged = staging / f'{name}.png'
    target = staged.with_suffix('.ktx2')
    if not target.exists():
        staged.write_bytes(source)
        options = ['-ktx2', '-mipmap', '-comp_level', '1', '-q', '175']
        if kind != 'color':
            options += ['-linear']
        if kind == 'normal':
            options += ['-normal_map']
        subprocess.run([str(basis), '-file', str(staged), '-output_file', str(target), *options],
                       check=True, capture_output=True)
    return target.read_bytes()


def pad(data, char):
    return data + char * ((-len(data)) % 4)


def update(path, basis, staging):
    raw = path.read_bytes()
    json_length, = struct.unpack_from('<I', raw, 12)
    model = json.loads(raw[20:20 + json_length])
    if not model.get('images'):
        return
    binary = raw[28 + json_length:]
    views = model['bufferViews']
    compressed = {}
    kind_by_image = {}
    for material in model['materials']:
        pbr = material.get('pbrMetallicRoughness', {})
        slots = {'color': pbr.get('baseColorTexture'), 'normal': material.get('normalTexture'),
                 'orm': pbr.get('metallicRoughnessTexture') or material.get('occlusionTexture')}
        for kind, slot in slots.items():
            if slot:
                kind_by_image[model['textures'][slot['index']]['source']] = kind
    for index, image in enumerate(model['images']):
        view_index = image['bufferView']
        view = views[view_index]
        start = view.get('byteOffset', 0)
        source = binary[start:start + view['byteLength']]
        compressed[view_index] = encode(source, basis, staging, kind_by_image.get(index, 'color'))
        image['mimeType'] = 'image/ktx2'

    packed = bytearray()
    for index, view in enumerate(views):
        offset = view.get('byteOffset', 0)
        data = compressed.get(index, binary[offset:offset + view['byteLength']])
        view['byteOffset'] = len(packed)
        view['byteLength'] = len(data)
        packed.extend(pad(data, b'\0'))
    model['buffers'][0]['byteLength'] = len(packed)
    for texture in model['textures']:
        texture.setdefault('extensions', {})['KHR_texture_basisu'] = {'source': texture.pop('source')}
    for key in ('extensionsUsed', 'extensionsRequired'):
        model.setdefault(key, []).append('KHR_texture_basisu')

    json_bytes = pad(json.dumps(model, separators=(',', ':')).encode(), b' ')
    header = struct.pack('<4sIIII', b'glTF', 2, 28 + len(json_bytes) + len(packed), len(json_bytes), 0x4E4F534A)
    path.write_bytes(header + json_bytes + struct.pack('<II', len(packed), 0x004E4942) + packed)
    print(f'{path.name} {len(raw):,} → {path.stat().st_size:,} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', type=Path)
    parser.add_argument('basis', type=Path)
    args = parser.parse_args()
    with TemporaryDirectory(prefix='myfit-fitting-basis-') as temp:
        for path in sorted(args.directory.glob('*.glb')):
            update(path, args.basis.resolve(), Path(temp))
