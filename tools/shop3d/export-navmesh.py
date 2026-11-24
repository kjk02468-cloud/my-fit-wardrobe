import bpy
import json
import sys
from pathlib import Path

mesh_input, output, source = map(Path, sys.argv[sys.argv.index("--") + 1:])
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
data = json.loads(mesh_input.read_text(encoding="utf-8"))
mesh = bpy.data.meshes.new("MY FIT walkable floor")
mesh.from_pydata(data["vertices"], [], data["faces"])
mesh.update()
model = bpy.data.objects.new("MF_NAVMESH", mesh)
model["gridMetres"] = 0.1
model["walkerRadiusMetres"] = 0.22
bpy.context.collection.objects.link(model)
bpy.context.view_layer.objects.active = model
model.select_set(True)
source.parent.mkdir(parents=True, exist_ok=True)
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", export_extras=True)
