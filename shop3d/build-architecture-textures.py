"""Write original, seamless metric-scale architectural material textures."""
from pathlib import Path
import json
import sys

import numpy as np
from PIL import Image, ImageFilter


SIZE = 2048
OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
REFERENCE = Path(sys.argv[2]) if len(sys.argv) > 2 else None
RNG = np.random.default_rng(170829)
AXIS = np.arange(SIZE, dtype=np.float32) / SIZE
X, Y = np.meshgrid(AXIS, AXIS)


def noise(res_x, res_y):
    # Duplicate at the boundary before interpolation for seamless repeat.
    low = RNG.random((res_y, res_x), dtype=np.float32)
    low = np.pad(low, ((1, 1), (1, 1)), mode="wrap")
    image = Image.fromarray(low).resize(
        (SIZE, SIZE), Image.Resampling.BICUBIC,
        box=(.5, .5, res_x + .5, res_y + .5),
    )
    return np.asarray(image, dtype=np.float32) - .5


def encoded(array):
    return Image.fromarray(np.uint8(np.clip(array, 0, 255) + .5), "RGB")


def write(name, base, height, rough, metallic, tile_metres, ao=1.0):
    # All textures share texel boundaries. Normal differences wrap between
    # tiles and follow the glTF +Y tangent-space convention.
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 1.5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * -1.5
    length = np.sqrt(dx * dx + dy * dy + 1)
    normal = np.stack((-dx / length, -dy / length, 1 / length), axis=-1)
    rough = np.broadcast_to(rough, height.shape)
    metallic = np.broadcast_to(metallic, height.shape)
    ao = np.broadcast_to(ao, height.shape)
    orm = np.stack((ao, rough, metallic), axis=-1)
    settings = {"base": (base, 80), "normal": ((normal * .5 + .5) * 255, 82), "orm": (orm * 255, 83)}
    files = {"tileMetres": tile_metres, "resolution": SIZE}
    for suffix, (pixels, quality) in settings.items():
        file = f"{name}-{suffix}.webp"
        # Lossless maps retain a neutral 128,128,255 normal and exact ORM channels.
        encoded(pixels).save(OUT / file, "WEBP", method=3, quality=quality, lossless=suffix != "base")
        files[suffix] = file
    return files


def color(rgb, value):
    return np.array(rgb, dtype=np.float32) + value[..., None]


def herringbone():
    # A 4:1 parquet pattern in a periodic diagonal coordinate system.
    u, v = (X + Y) * 8, (Y - X) * 8
    cell_x, cell_y = np.floor(u).astype(np.int32), np.floor(v).astype(np.int32)
    diagonal = (cell_x - cell_y) % 8
    horizontal = diagonal < 4
    start_x = np.where(horizontal, cell_x - diagonal, cell_x)
    start_y = np.where(horizontal, cell_y, cell_y - (7 - diagonal))
    a = np.where(horizontal, (u - start_x) / 4, (v - start_y) / 4)
    b = np.where(horizontal, v - start_y, u - start_x)
    seam = np.minimum(np.minimum(a * 4, (1 - a) * 4), np.minimum(b, 1 - b))
    edge = np.clip(seam / .017, 0, 1)
    plank_hash = (start_x % 8) * 71 + (start_y % 8) * 37
    tone = np.sin(plank_hash * 1.734) * 13 + np.cos(plank_hash * 2.61) * 6
    grain = np.sin(115*b + 4*np.sin(9*a+plank_hash)) * 2.4
    grain += np.sin(244*b+np.sin(19*a+plank_hash)*3) * 2.7
    grain += np.sin(39*b + 2*np.sin(6*a)) * 3.3
    pores = noise(128, 128) * 3
    base = color((120, 88, 65), tone + grain + pores - (1-edge) * 25)
    return write("oak",base,edge*.38 + grain*.012,.53 + grain*.002,0,1.52,.82+edge*.17)


def walnut():
    warp = noise(17, 4) * .044 + noise(41, 7) * .009
    wave = 2 * np.pi * (X + warp)
    heart = np.sin(29*wave + np.sin(Y*2*np.pi)*2.7) * 4
    fibers = np.sin(86*wave+np.sin(2*np.pi*Y)*2.9) * 4
    pores = np.sin(181*wave + np.sin(2*np.pi*Y)*3) * 2
    tone = noise(16, 3) * 27 + noise(6, 4) * 11
    return write("walnut",color((104, 67, 45),tone+heart+fibers+pores),
                 heart*.014+fibers*.009+pores*.008,.49+fibers*.004,.015,.77,.97)


def stone(name, rgb, tile, roughness, bump):
    mineral = noise(4,4)*9 + noise(9,8)*7 + noise(32,26)*8 + noise(97,81)*6
    freckles = np.maximum(0, noise(187,167)-.18) * 13
    polish = np.sin(2*np.pi*(4*X+2*Y) + noise(4,4)*3) * 2
    return write(name,color(rgb,mineral + polish - freckles),
                 (mineral - freckles)*bump,roughness+mineral*.002,0,tile,.975)


def bronze():
    brush = noise(100,4)*5 + noise(190,11)*3 + noise(6,3)*8
    return write("bronze",color((167, 125, 85),brush), brush*.006,
                 .36 + brush*.005,.77,.43,.995)


def leather():
    cells = noise(137,146)
    pores = np.cos(np.pi*2*(X*249 + noise(38,42)*.4)) * np.cos(np.pi*2*(Y*241 + noise(39,40)*.4))
    value = noise(9,9)*8 + cells*4 + pores*.53
    return write("olive",color((83, 88, 58),value),cells*.05 + pores*.011,.53+cells*.019,0,.55,.98)


def linen():
    thread = np.sin(2*np.pi*(192*X + noise(32,32)*.025)) * np.sin(2*np.pi*(180*Y))
    fiber = noise(116,118)*4
    return write("linen",color((178, 162, 134),thread*3 + fiber),
                 thread*.05,.9+thread*.018,0,.44,.985)


def seamless(pixels, edge=28):
    # Opposing pixels share a smooth average exactly at the repeat boundary.
    # This keeps grain from the source plate rather than duplicating it as a mirror tile.
    for axis in (0, 1):
        data = np.swapaxes(pixels, axis, 0)
        mix = .5 * (np.cos(np.linspace(0, np.pi, edge, dtype=np.float32))*.5+.5)
        mix = mix[:, None, None]
        left, right = data[:edge].copy(), data[-1:-edge-1:-1].copy()
        data[:edge] = left*(1-mix) + right*mix
        data[-1:-edge-1:-1] = right*(1-mix) + left*mix
    return pixels


def photograph(name, source, center_color, tile, rough, metal, relief):
    path = REFERENCE / source
    with Image.open(path) as file:
        plate = file.convert('RGB')
    # A central square crop leaves fabric borders and presentation framing outside the texture.
    span=min(plate.size)-8
    left=(plate.width-span)//2
    top=(plate.height-span)//2
    crop=plate.crop((left,top,left+span,top+span)).resize((512,512),Image.Resampling.LANCZOS)
    rgb=np.asarray(crop,dtype=np.float32)
    light=np.asarray(crop.convert('L').filter(ImageFilter.GaussianBlur(61)),dtype=np.float32)
    # Only a soft illumination estimate is removed. Local wood and fabric detail is preserved.
    rgb=(rgb / np.maximum(light[...,None],18)**.76)
    rgb*=np.array(center_color,dtype=np.float32)/np.median(rgb.reshape(-1,3),axis=0)
    rgb=seamless(rgb)
    base=np.asarray(encoded(rgb).resize((SIZE,SIZE),Image.Resampling.LANCZOS),dtype=np.float32)
    brightness=np.asarray(encoded(rgb).convert('L'),dtype=np.float32)
    blur=np.asarray(Image.fromarray(np.uint8(np.clip(brightness,0,255))).filter(ImageFilter.GaussianBlur(3.8)),dtype=np.float32)
    height=(brightness-blur)*relief
    height=np.asarray(Image.fromarray(height).resize((SIZE,SIZE),Image.Resampling.BICUBIC),dtype=np.float32)
    texture_roughness=np.clip(rough-height*.045,.15,.96)
    cavity=np.clip(.98+height*.19,.78,1)
    record=write(name,base,height,texture_roughness,metal,tile,cavity)
    record['referencePlate']=f'11_material/{source}'
    record['referenceProcessing']='center crop, broad light removal, color normalization, seamless edges, inferred normal/ORM'
    return record


if REFERENCE:
    manifest = {
        'oak': photograph('oak','mf_11_oak_herringbone.png',(85,64,47),1.42,.49,.01,.055),
        'walnut': photograph('walnut','mf_11_walnut.png',(90,66,49),1.07,.49,.015,.043),
        'limestone': photograph('limestone','mf_11_limestone.png',(191,177,154),1.52,.76,0,.037),
        'plaster': photograph('plaster','mf_11_plaster.png',(184,169,146),2.29,.86,0,.026),
        'pavement': photograph('pavement','mf_11_limestone.png',(131,125,116),1.38,.86,0,.04),
        'bronze': photograph('bronze','mf_11_bronze.png',(160,120,79),.61,.40,.75,.028),
        'olive': photograph('olive','mf_11_olive_leather.png',(75,74,50),.54,.56,0,.043),
        'linen': photograph('linen','mf_11_merino.png',(172,155,129),.26,.88,0,.040),
    }
else:
    manifest = {
        "oak": herringbone(),
        "walnut": walnut(),
        "limestone": stone("limestone",(214, 201, 180),1.52,.78,.013),
        "plaster": stone("plaster",(218, 209, 192),1.72,.88,.008),
        "pavement": stone("pavement",(157, 152, 142),1.38,.83,.015),
        "bronze": bronze(),
        "olive": leather(),
        "linen": linen(),
    }
(OUT / "finishes.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
