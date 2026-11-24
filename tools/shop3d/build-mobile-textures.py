"""Resize authored PBR maps for the narrow-screen WebGL tier."""
import json
import sys
from pathlib import Path

from PIL import Image

root = Path(sys.argv[1])
manifest = root / "finishes.json"
finishes = json.loads(manifest.read_text(encoding="utf-8"))
for finish in finishes.values():
    mobile = {}
    for kind in ("base", "normal", "orm"):
        source = root / finish[kind]
        limit = 768 if kind == "base" else 512 if kind == "normal" else 256
        target = source.with_name(f"{source.stem}-mobile.webp")
        with Image.open(source) as image:
            image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
            image.save(target, "WEBP", quality=91 if kind == "normal" else 84,
                       method=5, lossless=kind == "orm")
        mobile[kind] = target.name
    finish["mobile"] = mobile
manifest.write_text(json.dumps(finishes, indent=2) + "\n", encoding="utf-8")
