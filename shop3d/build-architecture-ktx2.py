"""Encode the generated 2K textures to KTX2 and build a low-memory WebP fallback.

Run after build-architecture-blender.py. Usage:
    python build-architecture-ktx2.py MATERIAL_DIRECTORY BASISU_EXE
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import subprocess
import sys

from PIL import Image, ImageFilter


directory = Path(sys.argv[1]).resolve()
encoder = Path(sys.argv[2]).resolve()
manifest_path = directory / 'finishes.json'
finishes = json.loads(manifest_path.read_text(encoding='utf-8'))


def encode(kind, filename, staging, resolution):
    original = directory / filename
    with Image.open(original) as opened:
        image = opened.convert('RGB')
    staged = staging / (original.stem + '.png')
    encode_image=image.copy()
    encode_image.thumbnail((resolution,resolution),Image.Resampling.LANCZOS)
    encode_image.save(staged, compress_level=1)
    destination = original.with_suffix('.ktx2')
    options = ['-mipmap', '-ktx2', '-comp_level', '0', '-q', '136']
    if kind == 'normal':
        options += ['-normal_map', '-linear']
    elif kind == 'orm':
        options += ['-linear']
    command = [str(encoder), *options, '-file', str(staged), '-output_file', str(destination)]
    result = subprocess.run(command, check=False, capture_output=True, text=True)
    if result.returncode or not destination.is_file():
        raise RuntimeError(f'{filename}: {result.stdout}\n{result.stderr}')
    # Preserve sharper diffuse detail but bound the uncompressed fallback GPU memory.
    image.thumbnail((1024, 1024) if kind == 'base' else (512, 512), Image.Resampling.LANCZOS)
    image.save(original, 'WEBP', method=5, quality=83, lossless=kind!='base')
    print(f'{destination.name}: {destination.stat().st_size:,} bytes', flush=True)
    return destination.name


with TemporaryDirectory(prefix='myfit-architecture-maps-') as temp:
    def runtime_resolution(material,kind,finish):
        # The supplied plates contain about 500px of original information.
        # Reserve 2K runtime albedo for the largest contiguous finishes.
        if not finish.get('referencePlate'):
            return 2048
        return 2048 if kind=='base' and material in {'oak','walnut','limestone','plaster'} else 1024
    tasks = [(material, kind, finish[kind],runtime_resolution(material,kind,finish))
             for material, finish in finishes.items() for kind in ['base', 'normal', 'orm']]
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(encode,kind,name,Path(temp),resolution) for _,kind,name,resolution in tasks]
        for (material,kind,_,resolution), future in zip(tasks, futures):
            finishes[material].setdefault('ktx2', {})[kind] = future.result()
            finishes[material].setdefault('ktx2Resolution', {})[kind] = resolution

bake_source = directory / 'store-diffuse-bake.png'
if bake_source.exists():
    with Image.open(bake_source) as source:
        clean = source.convert('RGB').resize((512, 512), Image.Resampling.LANCZOS)
        clean.filter(ImageFilter.GaussianBlur(.66)).save(directory / 'store-diffuse-bake.webp', 'WEBP', method=6, quality=89)

atlas = directory / 'architecture-diffuse-bake.png'
if atlas.exists():
    with Image.open(atlas) as source:
        clean=source.convert('RGB').resize((1536,1536),Image.Resampling.LANCZOS)
        clean.filter(ImageFilter.GaussianBlur(.52)).save(directory / 'architecture-diffuse-bake.webp', 'WEBP', method=4, quality=91)
    finishes['oak']['architectureBake']='architecture-diffuse-bake.webp'

manifest_path.write_text(json.dumps(finishes, indent=2), encoding='utf-8')
