"""Author, light-bake and export the supplied MY FIT room geometry in Blender.

blender -b -t 8 --python-exit-code 1 --python shop3d/build-architecture-blender.py -- STAGING PRODUCTION SOURCE_DIR
"""
from math import radians
from pathlib import Path
import json
import sys

import bpy
from mathutils import Vector

stage, production, source = map(Path, sys.argv[sys.argv.index("--") + 1:])
production.mkdir(parents=True, exist_ok=True)
source.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene.render.engine = 'CYCLES'
scene.cycles.samples = 20
scene.cycles.max_bounces = 4
scene.cycles.diffuse_bounces = 3
scene.cycles.use_denoising = True
scene.render.image_settings.color_mode = 'RGB'

parts = {}
canonical_materials = {}
for asset in sorted(stage.glob('mf_*.glb')):
    part = asset.stem
    old_objects = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(asset.resolve()))
    objects = set(bpy.data.objects) - old_objects
    if not objects:
        raise RuntimeError(f'Nothing imported for {asset}')
    collection = bpy.data.collections.new(part)
    scene.collection.children.link(collection)
    for obj in sorted(objects, key=lambda item: item.name):
        for current in list(obj.users_collection):
            current.objects.unlink(obj)
        collection.objects.link(obj)
        if obj.type != 'MESH':
            continue
        obj['MY FIT source'] = 'User layout + reproducible project geometry'
        for slot in obj.material_slots:
            if slot.material:
                name = slot.material.name.partition('.')[0]
                slot.material = canonical_materials.setdefault(name,slot.material)
    parts[part] = objects


def add_light(name, shape, color, watts, position, target=None, size=1):
    data = bpy.data.lights.new(name, shape)
    data.energy, data.color = watts, color
    if shape == 'AREA':
        data.shape, data.size = 'DISK', size
    if shape == 'SPOT':
        data.spot_size, data.spot_blend = radians(95), .7
        data.shadow_soft_size = size
    light = bpy.data.objects.new(name,data)
    scene.collection.objects.link(light)
    light.location=position
    if target:
        light.rotation_euler = (Vector(target)-light.location).to_track_quat('-Z','Y').to_euler()
    return light


scene.world = bpy.data.worlds.new('MY FIT exterior daylight')
scene.world.use_nodes = True
background = scene.world.node_tree.nodes.get('Background')
background.inputs['Color'].default_value=(.49,.59,.78,1)
background.inputs['Strength'].default_value=.46
add_light('Window key', 'AREA', (1,.86,.70), 560, (-2,-1.8,2.9), (0,4,.8), 3.6)
for north in [2.6,6.3,9.7]:
    for x in [-3.54,3.54]:
        add_light(f'Track washer {x}, {north}', 'SPOT',(1,.79,.60),92,(x,north,3.63),
                  (x*1.55,north,1.04),.13)
add_light('Island pool', 'AREA',(1,.85,.69),170,(0,6.4,3.61),(0,6.45,.1),1.7)
add_light('Soft ceiling bounce', 'AREA',(1,.91,.79),125,(0,5.9,1.7),(0,6.4,3.8),5.6)
add_light('Fragrance pool','AREA',(1,.74,.53),125,(4.52,10.20,3.53),(4.63,10.16,.55),1.3)
for x in [-4,0,4]:
    add_light(f'Rear task light {x}','AREA',(1,.79,.61),115,(x,16.1,3.61),(x,17.2,.31),1.45)

camera = bpy.data.cameras.new('Showroom camera')
camera.lens, camera.sensor_width = 22, 36
camera_object = bpy.data.objects.new('04 Showroom North', camera)
scene.collection.objects.link(camera_object)
camera_object.location=(0,1.28,1.61)
camera_object.rotation_euler=(Vector((0,9,1.61))-camera_object.location).to_track_quat('-Z','Y').to_euler()
scene.camera=camera_object
scene.render.resolution_x,scene.render.resolution_y=1440,900
scene.render.resolution_percentage=100


def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in sorted(objects,key=lambda item:item.name):
        obj.select_set(True)
        bpy.context.view_layer.objects.active=obj


scene.view_settings.view_transform='Standard'
# Join a bake-only copy of the static surfaces so Cycles solves one shared
# atlas. Original objects and material UVs remain separate and editable.
targets=[o for o in bpy.data.objects if o.type=='MESH' and
         not o.name.startswith(('door-','fragrance__','mf_fragrance_props'))]
targets.sort(key=lambda item:item.name)
positions, faces, materials, assignments, loop_ranges = [], [], [], [], []
for original in targets:
    offset=len(positions)
    start=len(faces)
    positions.extend(original.matrix_world @ v.co for v in original.data.vertices)
    for face in original.data.polygons:
        faces.append([offset+i for i in face.vertices])
        material=original.material_slots[face.material_index].material
        if material not in materials:
            materials.append(material)
        assignments.append((materials.index(material),face.use_smooth))
    loop_ranges.append((original,start,len(faces)))
mesh=bpy.data.meshes.new('Irradiance atlas geometry')
mesh.from_pydata(positions,[],faces)
mesh.update()
for material in materials:
    mesh.materials.append(material)
for face,(index,smooth) in zip(mesh.polygons,assignments):
    face.material_index=index
    face.use_smooth=smooth
joined=bpy.data.objects.new('Temporary joined light bake',mesh)
scene.collection.objects.link(joined)
select([joined])
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=radians(76),island_margin=.0014)
bpy.ops.object.mode_set(mode='OBJECT')
atlas=mesh.uv_layers.active
for original,start,end in loop_ranges:
    uv=original.data.uv_layers.new(name='BakeUV')
    for face, packed in zip(original.data.polygons,mesh.polygons[start:end]):
        for loop_index,packed_index in zip(face.loop_indices,packed.loop_indices):
            uv.data[loop_index].uv=atlas.data[packed_index].uv
    original.hide_render=True

bake=bpy.data.images.new('Static architecture irradiance atlas',width=2048,height=2048,
                        alpha=False,float_buffer=False)
bake_nodes=[]
for material in materials:
    node=material.node_tree.nodes.new('ShaderNodeTexImage')
    node.name='Irradiance Bake Target'
    node.image=bake
    material.node_tree.nodes.active=node
    bake_nodes.append((material,node))
scene.render.bake.use_pass_color=False
scene.render.bake.use_pass_direct=True
scene.render.bake.use_pass_indirect=True
scene.render.bake.margin=4
select([joined])
bpy.ops.object.bake(type='DIFFUSE')
bake.filepath_raw=str((production/'materials'/'architecture-diffuse-bake.png').resolve())
bake.file_format='PNG'
bake.save()
bake.pack()
bpy.data.objects.remove(joined,do_unlink=True)
bpy.data.meshes.remove(mesh)
for original in targets:
    original.hide_render=False
    original.data.uv_layers.active_index=0
    original.data.uv_layers[0].active_render=True

for part,objects in parts.items():
    select(objects)
    bpy.ops.export_scene.gltf(filepath=str((production/f'{part}.glb').resolve()),
        export_format='GLB',use_selection=True,export_texcoords=True,export_normals=True,
        export_materials='EXPORT',export_animations=False,export_cameras=False,export_lights=False,
        export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=13)

# The native deliverable keeps editable materials and a reusable lighting rig.
# Runtime GLBs share external PBR textures so the same image isn't embedded in
# each exported room. The authoring file keeps the texture images packed.
finishes = json.loads((production/'materials'/'finishes.json').read_text(encoding='utf-8'))
for name,material in canonical_materials.items():
    if name not in finishes:
        continue
    finish=finishes[name]
    for current in [material]:
        nodes,links=current.node_tree.nodes,current.node_tree.links
        shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
        uv_source=nodes.new('ShaderNodeUVMap')
        uv_source.uv_map='UVMap'
        scale=nodes.new('ShaderNodeVectorMath')
        scale.operation='SCALE'
        scale.inputs[3].default_value=1/finish['tileMetres']
        links.new(uv_source.outputs['UV'],scale.inputs[0])
        maps={}
        for kind in ['base','normal','orm']:
            texture=nodes.new('ShaderNodeTexImage')
            texture.label=f'{name} {kind}'
            texture.image=bpy.data.images.load(str((production/'materials'/finish[kind]).resolve()),check_existing=True)
            if kind!='base':
                texture.image.colorspace_settings.name='Non-Color'
            if not texture.image.packed_file:
                texture.image.pack()
            links.new(scale.outputs['Vector'],texture.inputs['Vector'])
            maps[kind]=texture
        links.new(maps['base'].outputs['Color'],shader.inputs['Base Color'])
        normal=nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value=.55
        links.new(maps['normal'].outputs['Color'],normal.inputs['Color'])
        links.new(normal.outputs['Normal'],shader.inputs['Normal'])
        orm=nodes.new('ShaderNodeSeparateColor')
        links.new(maps['orm'].outputs['Color'],orm.inputs['Color'])
        links.new(orm.outputs['Green'],shader.inputs['Roughness'])
        links.new(orm.outputs['Blue'],shader.inputs['Metallic'])

for material,node in bake_nodes:
    atlas_uv=material.node_tree.nodes.new('ShaderNodeUVMap')
    atlas_uv.uv_map='BakeUV'
    material.node_tree.links.new(atlas_uv.outputs['UV'],node.inputs['Vector'])
select([next(o for o in targets if o.name.startswith('baked-floor'))])
bpy.ops.wm.save_as_mainfile(filepath=str((source/'MY_FIT_Architecture.blend').resolve()),compress=True)
print('Saved native architecture, seven Blender GLBs, and 2048-square static Cycles irradiance atlas.')
