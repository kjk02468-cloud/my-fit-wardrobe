"""Blender authoring and export for the MY FIT apparel fitting library."""

import argparse
from collections import defaultdict
import json
import math
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
import numpy as np


def options():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', required=True, type=Path)
    parser.add_argument('--patterns', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--blend', required=True, type=Path)
    parser.add_argument('--draco', action='store_true')
    parser.add_argument('--swatches', type=Path)
    parser.add_argument('--skin-diffuse', type=Path)
    parser.add_argument('--skin-normal', type=Path)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def from_gltf(x, y, z):
    return Vector((x, -z, y))


def aim(rig, joint_name, endpoint_name, direction):
    joint = rig.pose.bones[joint_name]
    endpoint = rig.pose.bones[endpoint_name]
    source = (endpoint.head - joint.head).normalized()
    delta = source.rotation_difference(direction.normalized()).to_matrix().to_4x4()
    origin = joint.head.copy()
    joint.matrix = Matrix.Translation(origin) @ delta @ Matrix.Translation(-origin) @ joint.matrix
    bpy.context.view_layer.update()


def prepare_fit_pose(rig, bodies):
    # A shallow A pose keeps both sleeves and side views readable.
    for side, sign in (('L', 1), ('R', -1)):
        aim(rig, f'upperarm01.{side}', f'lowerarm01.{side}', from_gltf(sign * .145, -.989, .012))
        aim(rig, f'lowerarm01.{side}', f'wrist.{side}', from_gltf(sign * .096, -.994, .065))
        foot = rig.pose.bones[f'foot.{side}']
        foot_orientation = foot.matrix.to_quaternion()
        aim(rig, f'upperleg01.{side}', f'foot.{side}', from_gltf(sign * .007, -.999, .022))
        foot.matrix = Matrix.Translation(foot.head) @ foot_orientation.to_matrix().to_4x4()
        bpy.context.view_layer.update()

    for body in bodies:
        activate(body)
        modifier = next(modifier for modifier in body.modifiers if modifier.type == 'ARMATURE')
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    activate(rig)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()


def create_material(name, color, roughness, metalness=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*color, 1)
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metalness
    return material, bsdf


def vertex_color(mesh, name, colors):
    layer = mesh.color_attributes.new(name=name, type='FLOAT_COLOR', domain='POINT')
    layer.data.foreach_set('color', [value for color in colors for value in (*color, 1)])
    mesh.color_attributes.active_color = layer


def connect_skin_colors(material):
    nodes = material.node_tree.nodes
    color = nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Tint'
    material.node_tree.links.new(color.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])


def new_image(name, rgb, space):
    size = rgb.shape[0]
    image = bpy.data.images.new(name, width=size, height=size, alpha=False)
    image.colorspace_settings.name = space
    rgba = np.concatenate((rgb, np.ones((size, size, 1), dtype=np.float32)), axis=-1)
    image.pixels.foreach_set(rgba.astype(np.float32).flatten())
    image.pack()
    return image


def image_node(material, image):
    texture = material.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image = image
    return texture


def normal_node(material, bsdf, image, strength):
    texture = image_node(material, image)
    normal = material.node_tree.nodes.new('ShaderNodeNormalMap')
    normal.inputs['Strength'].default_value = strength
    material.node_tree.links.new(texture.outputs['Color'], normal.inputs['Color'])
    material.node_tree.links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])


def bind(obj, rig, weights):
    groups = {}
    for index, per_vertex in enumerate(weights):
        for bone, value in per_vertex:
            if value <= 1e-6 or bone not in rig.data.bones:
                continue
            if bone not in groups:
                groups[bone] = obj.vertex_groups.new(name=bone)
            groups[bone].add([index], value, 'REPLACE')
    obj.parent = rig
    skin = obj.modifiers.new('MY FIT common bind', 'ARMATURE')
    skin.object = rig


def make_mesh(name, points, faces, material, collection, colors=None, uv=None, normals=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], faces)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    mesh.materials.append(material)
    mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
    if normals is not None:
        mesh.normals_split_custom_set_from_vertices(normals)
    if colors is not None:
        vertex_color(mesh, 'Tint', colors)
    if uv is not None:
        layer = mesh.uv_layers.new(name='UVMap')
        for loop in mesh.loops:
            layer.data[loop.index].uv = uv[loop.vertex_index]
    return obj


def collection(name):
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def clamp(value, start=0.0, end=1.0):
    return min(end, max(start, value))


def smooth(value, start, end):
    t = clamp((value - start) / (end - start))
    return t * t * (3 - 2 * t)


def skin_tint(point):
    x, depth, y = point
    front = -depth
    brow = math.exp(-((abs(x) - .033) / .018) ** 4 - ((y - 1.700 + .08 * abs(x)) / .0045) ** 2)
    brow *= smooth(front, .123, .145)
    lips = math.exp(-(x / .027) ** 4 - ((y - 1.604) / .0065) ** 2) * smooth(front, .140, .158)
    cheek = math.exp(-((abs(x) - .055) / .026) ** 2 - ((y - 1.635) / .020) ** 2) * smooth(front, .082, .121)
    return (.58 * (1 - .73 * brow) + .038 * lips + .026 * cheek,
            .385 * (1 - .79 * brow) - .122 * lips - .038 * cheek,
            .288 * (1 - .81 * brow) - .077 * lips - .020 * cheek)


def segment_body(source, rig, destination, diffuse_path, normal_path):
    source_groups = {group.index: group.name for group in source.vertex_groups}
    positions = [source.matrix_world @ vertex.co for vertex in source.data.vertices]
    weighted = [[(source_groups[group.group], group.weight) for group in vertex.groups]
                for vertex in source.data.vertices]
    segment_faces = defaultdict(list)
    source_uv = source.data.uv_layers.active

    for face in source.data.polygons:
        vertex_ids = list(face.vertices)
        center = sum((positions[index] for index in vertex_ids), Vector()) / len(vertex_ids)
        x, _, y = center
        if y > 1.474 and abs(x) < (.119 if y > 1.56 else .077):
            segment_faces['Skin_head'].append((vertex_ids, list(face.loop_indices)))
        elif abs(x) > .198 and .662 < y < .965:
            segment_faces['Skin_hands'].append((vertex_ids, list(face.loop_indices)))
        elif abs(x) > .197 and .965 <= y < 1.49:
            weight = sum(value for index in vertex_ids for bone, value in weighted[index]
                         if bone.startswith(('upperarm', 'lowerarm', 'wrist', 'finger')))
            if weight / len(vertex_ids) > .45:
                name = 'Skin_forearms' if y < 1.275 else 'Skin_upperarms'
                segment_faces[name].append((vertex_ids, list(face.loop_indices)))
        elif .088 < y < .59:
            segment_faces['Skin_calves'].append((vertex_ids, list(face.loop_indices)))

    # Exposed skin only. The delivered GLB contains no unclothed body underneath.
    surface, bsdf = create_material('skin diffuse', (1, 1, 1), .66)
    use_atlas = source_uv is not None and diffuse_path is not None
    bsdf.inputs['Specular IOR Level'].default_value = .29
    if use_atlas:
        image = cropped_atlas(diffuse_path, source_uv, segment_faces, positions, 1024, 'sRGB', (.50,.34,.26))
        tex = image_node(surface, image)
        surface.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
        if normal_path:
            normal_node(surface, bsdf, cropped_atlas(normal_path, source_uv, segment_faces, positions, 1024,
                        'Non-Color', (.50,.50,1.0)), .35)
    else:
        connect_skin_colors(surface)
    result = []
    lod = {'Skin_head': .63, 'Skin_hands': .57, 'Skin_forearms': .61,
           'Skin_upperarms': .55, 'Skin_calves': .42}
    for name, faces in segment_faces.items():
        used = sorted({vertex for face, _ in faces for vertex in face})
        index_by_source = {vertex: index for index, vertex in enumerate(used)}
        points = [positions[index] for index in used]
        tint = None if use_atlas else [skin_tint(point) for point in points]
        mesh = make_mesh(name, points, [[index_by_source[i] for i in face] for face, _ in faces],
                         surface, destination, tint)
        if use_atlas:
            target_uv = mesh.data.uv_layers.new(name='Skin UV')
            for face, (_, corner_ids) in zip(mesh.data.polygons, faces):
                for local, original in zip(face.loop_indices, corner_ids):
                    target_uv.data[local].uv = source_uv.data[original].uv
        activate(mesh)
        bind(mesh, rig, [weighted[index] for index in used])
        modifier = mesh.modifiers.new('Retain silhouette and exposed details', 'DECIMATE')
        modifier.ratio = lod[name]
        mesh.modifiers.move(len(mesh.modifiers) - 1, 0)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        result.append(mesh)
    return result


def cropped_atlas(path, uv, segments, positions, size, space, padding_color):
    source = bpy.data.images.load(str(path), check_existing=False)
    source.colorspace_settings.name = space
    source.scale(size, size)
    pixels = np.empty(size * size * 4, dtype=np.float32)
    source.pixels.foreach_get(pixels)
    rgb = pixels.reshape(size, size, 4)[:, :, :3].copy()
    mask = np.zeros((size, size), dtype=np.bool_)
    eyes = np.zeros((size, size), dtype=np.float32)
    eye_patch = np.zeros((size, size), dtype=np.float32)
    for name, faces in segments.items():
        for vertices, corners in faces:
            points = [uv.data[corner].uv for corner in corners]
            xx = [p.x * size for p in points]
            yy = [p.y * size for p in points]
            left, right = max(0, int(min(xx)) - 6), min(size, int(max(xx)) + 7)
            bottom, top = max(0, int(min(yy)) - 6), min(size, int(max(yy)) + 7)
            mask[bottom:top, left:right] = True
            if name == 'Skin_head':
                x, depth, y = sum((positions[i] for i in vertices), Vector()) / len(vertices)
                if depth < -.113 and 1.636 < y < 1.714 and .005 < abs(x) < .078:
                    strength = math.exp(-((abs(x)-.032)/.018)**2-((y-1.676)/.017)**2)
                    eyes[bottom:top, left:right] = np.maximum(eyes[bottom:top, left:right], strength)
                    if x > 0:
                        spread = (1-smooth(abs(x-.036),.023,.040)) * (1-smooth(abs(y-1.674),.019,.036))
                        eye_patch[bottom:top, left:right] = np.maximum(eye_patch[bottom:top, left:right], spread)
    rgb[~mask] = padding_color
    eyes = sum(np.roll(eyes, shift, axis=0) for shift in (-3, -1, 0, 1, 3)) / 5
    eyes = sum(np.roll(eyes, shift, axis=1) for shift in (-3, -1, 0, 1, 3)) / 5
    if space == 'sRGB':
        # This stock texture includes an asymmetric painted eye mark. The source
        # head UV has a rotated face island and a distinct mirrored lid island.
        # Sample the unmarked side on each island and blend at the orbit edge.
        eye_patch = sum(np.roll(eye_patch, shift, axis=0) for shift in (-3,-1,0,1,3)) / 5
        eye_patch = sum(np.roll(eye_patch, shift, axis=1) for shift in (-3,-1,0,1,3)) / 5
        v, u = np.indices((size,size))
        main_island = u > .65 * size
        mirrored_v = np.where(main_island, np.round(.96633*size-1-v), v).astype(int).clip(0,size-1)
        mirrored_u = np.where(main_island, u, np.round(.16297*size-1-u)).astype(int).clip(0,size-1)
        flipped = rgb[mirrored_v,mirrored_u]
        rgb = rgb * (1-eye_patch[:,:,None]) + flipped * eye_patch[:,:,None]
        rgb += np.maximum(0, np.array((.43,.273,.219)) - rgb) * (.77 * eyes[:,:,None])
    else:
        rgb = rgb * (1-.28*eyes[:,:,None]) + np.array((.50,.50,1.0)) * (.28*eyes[:,:,None])
    result = new_image(path.stem + ' | M01 exposed UV islands', rgb, space)
    bpy.data.images.remove(source)
    return result


def model_eye_shell(source, rig, destination):
    groups = {group.index: group.name for group in source.vertex_groups}
    points = [source.matrix_world @ vertex.co for vertex in source.data.vertices]
    white, _ = create_material('warm sclera and iris', (1, 1, 1), .29)
    connect_skin_colors(white)

    def tint(point):
        x, depth, y = point
        distance = math.hypot(abs(x) - .031, y - 1.677)
        iris = (1 - smooth(distance, .0062, .0077)) * smooth(-depth, .134, .140)
        pupil = (1 - smooth(distance, .0029, .0037)) * iris
        return (.57 - .51 * iris - .043 * pupil,
                .53 - .49 * iris - .025 * pupil,
                .49 - .462 * iris - .015 * pupil)

    obj = make_mesh('Skin_eyes', points, [tuple(face.vertices) for face in source.data.polygons],
                    white, destination, [tint(point) for point in points])
    bind(obj, rig, [[(groups[group.group], group.weight) for group in vertex.groups] for vertex in source.data.vertices])
    return obj


def scalp_tree(body):
    points = [body.matrix_world @ vertex.co for vertex in body.data.vertices]
    scalp = [tuple(face.vertices) for face in body.data.polygons
             if all(points[index].z > 1.600 for index in face.vertices)]
    return BVHTree.FromPolygons(points, scalp, all_triangles=True, epsilon=.00002)


def sit_above_scalp(tree, point, row):
    center = Vector((0, -.051, point.z))
    radial = point - center
    current = radial.length
    if current < .0001:
        return point
    direction = radial / current
    outside = center + .24 * direction
    contact, _, _, _ = tree.ray_cast(outside, -direction, .24)
    if contact is None:
        return point
    # Leave the protruding ear uncovered at the hairline. Higher rows follow
    # the skull even where its true cross-section differs from the loft.
    if point.z < 1.680 and abs(contact.x) > .080 and abs(direction.x) > .72:
        return point
    clearance = .0025 + .0035 * math.sin(row * math.pi)
    minimum = (contact - center).length + clearance
    tapered = minimum + max(0, current - minimum) * smooth(row, 0, .18)
    return center + direction * tapered


def sculpt_hair(rig, destination, body):
    points, colors, faces, uv = [], [], [], []
    rows, columns = 28, 88
    scalp = scalp_tree(body)
    for row in range(rows + 1):
        for col in range(columns + 1):
            v, u = row / rows, col / columns
            a = 2 * math.pi * u
            front = max(0, math.cos(a))
            fringe_angle = (a + math.pi) % (2 * math.pi) - math.pi
            sweep = math.exp(-((fringe_angle + .47) / .41) ** 2)
            side_part = math.exp(-((fringe_angle - .24) / .20) ** 2)
            nape = max(0, -math.cos(a))
            scalp_edge = 1.620 + .102 * front ** .62 + .023*nape - .019 * sweep + .015 * side_part
            scalp_edge += .020 * abs(math.sin(a)) * (1 - front)
            phi = (math.pi / 2) * min(v, .9998)
            radius = math.cos(phi)
            groove = .0016 * math.cos(25 * a - 8.1 * v + 1.2 * math.sin(a + 2 * v)) * math.sin(math.pi * v * .86)
            crest = .011 * math.exp(-((fringe_angle + .47) / .86) ** 2) * math.sin(v * math.pi)
            x = (.082 + groove) * math.sin(a + .38 * v) * radius - .008 * math.sin(v * math.pi)
            z = .051 + (.109 + groove + crest) * math.cos(a + .35 * v) * radius
            y = scalp_edge + (1.808 - scalp_edge) * math.sin(phi) + crest
            points.append(sit_above_scalp(scalp, from_gltf(x, y, z), v))
            uv.append((u, v))
            tone = .76 + .18 * math.sin(a * 25 - v * 8.1) ** 2 + .04 * math.cos(a * 5 + v * 12)
            colors.append((.024 * tone, .0155 * tone, .011 * tone))
    for row in range(rows):
        for col in range(columns):
            a = row * (columns + 1) + col
            b = a + columns + 1
            faces.extend(((a, a + 1, b), (b, a + 1, b + 1)))
    material, bsdf = create_material('shaped brushed hair', (1, 1, 1), .68)
    connect_skin_colors(material)
    x, y = np.meshgrid(np.arange(512) / 512, np.arange(512) / 512)
    flow = x + .065 * y + .007 * np.sin(11 * y + 6.28 * x)
    field = .00028 * np.sin(flow * 2 * np.pi * 156) + .00020 * np.sin(flow * 2 * np.pi * 89)
    normal_node(material, bsdf, normal_image('Combed fine fibres', field), .48)
    hair = make_mesh('Hair_sculpt', points, faces, material, destination, colors, uv)
    bind(hair, rig, [[('head', 1)]] * len(points))
    return hair


def normal_image(name, field):
    size = field.shape[0]
    nx = (np.roll(field, 1, axis=1) - np.roll(field, -1, axis=1)) * size * .5
    ny = (np.roll(field, 1, axis=0) - np.roll(field, -1, axis=0)) * size * .5
    norm = np.sqrt(nx**2 + ny**2 + 1)
    rgb = np.stack((.5 + .5 * nx / norm, .5 + .5 * ny / norm, .5 + .5 / norm), axis=-1)
    return new_image(name, rgb, 'Non-Color')


def cloth_normal(name):
    # Tileable analytic threads. UV repeat is applied at garment authoring scale.
    size = 256
    x, y = np.meshgrid(np.arange(size) / size, np.arange(size) / size)
    if name == 'wool':
        field = .0027 * np.cos(10 * 2 * np.pi * x + .45 * np.sin(8 * 2 * np.pi * y))
        field *= .55 + .45 * np.cos(8 * 2 * np.pi * y) ** 2
    elif name == 'leather':
        field = .0024 * np.sin(5 * 2 * np.pi * x + 2 * np.sin(3 * 2 * np.pi * y))
        field += .0012 * np.cos(11 * 2 * np.pi * y + 3 * 2 * np.pi * x)
    else:
        field = .004 * np.cos(7 * 2 * np.pi * x) * np.sin(7 * 2 * np.pi * y)
    return normal_image(f'MF {name} tile normal', field)


swatch_paths = {
    'melton': 'mf_11_wool_melton.png', 'merino': 'mf_11_merino.png',
    'oxford': 'mf_11_oxford.png', 'jersey': 'mf_11_cotton_jersey.png',
    'twill': 'mf_11_twill.png', 'leather': 'mf_11_calfskin.png',
}


def texture_tiles(directory, textile):
    if directory is None:
        return {'normal': cloth_normal('wool' if textile in ('melton', 'merino') else textile)}
    source = bpy.data.images.load(str(directory / swatch_paths[textile]), check_existing=False)
    width, height = source.size[:]
    buffer = np.empty(width * height * 4, dtype=np.float32)
    source.pixels.foreach_get(buffer)
    source_rgb = buffer.reshape(height, width, 4)[:, :, :3]
    size = 256
    half = int(min(width, height) * .44)
    xx = np.round(np.linspace(width // 2 - half, width // 2 + half, size)).astype(int)
    yy = np.round(np.linspace(height // 2 - half, height // 2 + half, size)).astype(int)
    crop = source_rgb[np.ix_(yy, xx)]
    luma = crop @ np.array((.2126,.7152,.0722))
    bpy.data.images.remove(source)

    # Remove local photographic lighting. Crossfade the opposing edges so the
    # tile preserves the pictured fibres without imposing a baked highlight.
    local = sum(np.roll(luma, k, axis=0) for k in (-8,-4,0,4,8)) / 5
    local = sum(np.roll(local, k, axis=1) for k in (-8,-4,0,4,8)) / 5
    detail = np.clip((luma - local) / (np.std(luma-local) * 2.9 + .001), -.95, .95)
    for axis in (0,1):
        tile = np.swapaxes(detail,0,axis).copy()
        for offset in range(14):
            edge = .5 * (tile[offset] + tile[-1-offset])
            strength = 1 - smooth(offset,0,14)
            tile[offset] = tile[offset] * (1-strength) + edge * strength
            tile[-1-offset] = tile[-1-offset] * (1-strength) + edge * strength
        detail = np.swapaxes(tile,0,axis)

    color = np.clip(.91 + (.15 if textile == 'merino' else .095) * detail, 0, 1)
    base = new_image(f'{textile} albedo detail', np.repeat(color[:,:,None],3,axis=-1), 'sRGB')
    roughness = (.67 if textile == 'leather' else .91) - .095 * detail
    orm = new_image(f'{textile} linear ORM', np.stack((.94+.055*detail, roughness, np.zeros_like(detail)),axis=-1), 'Non-Color')
    normal = normal_image(f'{textile} fibre normal', detail * (.006 if textile == 'merino' else .0032))
    return {'base': base, 'orm': orm, 'normal': normal}


def material_for_cloth(spec, images, textile):
    material, bsdf = create_material(spec['name'], spec['color'], spec['roughness'], spec['metalness'])
    if spec['name'] in ('fabric', 'facing'):
        nodes, links = material.node_tree.nodes, material.node_tree.links
        maps = images[textile]
        normal_node(material, bsdf, maps['normal'], .33 if textile == 'leather' else .48)
        if 'base' in maps:
            base = image_node(material, maps['base'])
            tint = nodes.new('ShaderNodeMixRGB')
            tint.blend_type = 'MULTIPLY'
            tint.inputs[0].default_value = 1
            tint.inputs[1].default_value = (*spec['color'],1)
            links.new(base.outputs['Color'], tint.inputs[2])
            links.new(tint.outputs['Color'], bsdf.inputs['Base Color'])
            orm = image_node(material, maps['orm'])
            split = nodes.new('ShaderNodeSeparateColor')
            links.new(orm.outputs['Color'], split.inputs['Color'])
            links.new(split.outputs['Green'], bsdf.inputs['Roughness'])
            links.new(split.outputs['Blue'], bsdf.inputs['Metallic'])
            output_group = bpy.data.node_groups.get('glTF Material Output')
            if output_group is None:
                output_group = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
                output_group.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
            output_node = nodes.new('ShaderNodeGroup')
            output_node.node_tree = output_group
            links.new(split.outputs['Red'], output_node.inputs['Occlusion'])
    return material


def garment_weights(region, point):
    x, _, y = point
    side = region[-1]
    if region.startswith('sleeve'):
        elbow = 1 - smooth(y, 1.10, 1.25)
        clavicle = smooth(y, 1.37, 1.466) * .28
        return [(f'upperarm01.{side}', 1 - elbow - clavicle),
                (f'lowerarm01.{side}', elbow), (f'clavicle.{side}', clavicle)]
    if region.startswith('leg'):
        knee = 1 - smooth(y, .44, .61)
        hip = smooth(y, .85, 1.06) * .66
        return [(f'upperleg01.{side}', 1 - knee - hip), (f'lowerleg01.{side}', knee), ('spine05', hip)]
    if region.startswith('foot'):
        return [(f'foot.{side}', 1)]
    if region == 'head':
        return [('head', 1)]
    chest = smooth(y, 1.05, 1.36)
    return [('spine05', 1 - chest), ('spine01', chest)]


def build_garment(name, parts, rig, images):
    destination = collection(name)
    textile = next(kind for key, kind in (('derby','leather'),('coat','melton'),('knit','merino'),
                   ('shirt','oxford'),('trouser','twill'),('tee','jersey')) if key in name)
    mats, result = {}, []
    for index, part in enumerate(parts):
        indices = part['indices']
        used = sorted(set(indices))
        back_map = {vertex: new for new, vertex in enumerate(used)}
        faces = [[back_map[v] for v in indices[start:start + 3]] for start in range(0, len(indices), 3)]
        points = [from_gltf(*part['position'][3*v:3*v+3]) for v in used]
        normals = [from_gltf(*part['normal'][3*v:3*v+3]).normalized() for v in used]
        uv = [(part['uv'][2*v] * 12, (1 - part['uv'][2*v+1]) * 9) for v in used]
        tone = [(part['tone'][v],) * 3 for v in used]
        material_spec = part['material']
        key = material_spec['name']
        if key not in mats:
            mats[key] = material_for_cloth(material_spec, images, textile)
        obj = make_mesh(f'{name}__{part["region"]}_{index:02}', points, faces, mats[key], destination, tone, uv, normals)
        bind(obj, rig, [garment_weights(part['region'], point) for point in points])
        result.append(obj)

    # Merge matching material slots into one skinned object to minimize draw calls.
    activate(result[0])
    for obj in result:
        obj.select_set(True)
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    return joined


def export(path, rig, objects, compress):
    activate(rig)
    for obj in objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                             export_animations=False, export_skins=True, export_def_bones=False,
                             export_yup=True, export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                             export_tangents=True, export_image_format='AUTO',
                             export_draco_mesh_compression_enable=compress, export_draco_mesh_compression_level=5,
                             export_draco_position_quantization=15, export_draco_normal_quantization=11,
                             export_draco_texcoord_quantization=14, export_draco_color_quantization=10,
                             export_draco_generic_quantization=13)
    root_skin_nodes(path)


def root_skin_nodes(path):
    # Blender parents meshes to an identity rig wrapper. The GLB validator
    # recommends root-level skinned meshes, which is equivalent for this rig.
    raw = path.read_bytes()
    json_length, = struct.unpack_from('<I', raw, 12)
    contents = json.loads(raw[20:20 + json_length])
    scene = contents['scenes'][contents.get('scene', 0)]
    rig = next(node for node in contents['nodes'] if node.get('name') == 'MF_M01_common_bind')
    if any(key in rig for key in ('matrix', 'translation', 'rotation', 'scale')):
        raise RuntimeError('Skin rig wrapper is expected to be identity.')
    skinned = [child for child in rig['children'] if 'skin' in contents['nodes'][child]]
    rig['children'] = [child for child in rig['children'] if child not in skinned]
    scene['nodes'].extend(skinned)
    if path.name == 'mf_avatar_m01.glb':
        contents['asset']['copyright'] = 'Derived from Innerscene and MakeHuman CC0 1.0 assets, including Mindfront Aksel skin maps where configured; fitted and retargeted for MY FIT.'
    else:
        for material in contents['materials']:
            pbr = material.get('pbrMetallicRoughness', {})
            if 'baseColorTexture' in pbr:
                pbr['baseColorFactor'] = list(bpy.data.materials[material['name']].diffuse_color)
    contents['asset']['extras'] = {'bind': 'M01 shared shallow A pose, 163 joints', 'scale': '1 unit = 1 meter'}
    json_bytes = json.dumps(contents, separators=(',', ':')).encode()
    json_bytes += b' ' * ((-len(json_bytes)) % 4)
    binary = raw[20 + json_length:]
    header = struct.pack('<4sIIII', b'glTF', 2, 20 + len(json_bytes) + len(binary), len(json_bytes), 0x4E4F534A)
    path.write_bytes(header + json_bytes + binary)


def main():
    args = options()
    args.output.mkdir(parents=True, exist_ok=True)
    args.blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(args.base), merge_vertices=True)
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
    rig.name = 'MF_M01_common_bind'
    bodies = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.parent == rig]
    main_body = max(bodies, key=lambda body: len(body.data.vertices))
    eyes = min(bodies, key=lambda body: len(body.data.vertices))
    prepare_fit_pose(rig, bodies)
    skin_collection = collection('mf_avatar_m01')
    skin = segment_body(main_body, rig, skin_collection, args.skin_diffuse, args.skin_normal)
    skin.append(model_eye_shell(eyes, rig, skin_collection))
    skin.append(sculpt_hair(rig, skin_collection, main_body))
    for obj in bodies:
        bpy.data.objects.remove(obj, do_unlink=True)
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith('Icosphere'):
            bpy.data.objects.remove(obj, do_unlink=True)
    export(args.output / 'mf_avatar_m01.glb', rig, skin, args.draco)

    images = {kind: texture_tiles(args.swatches, kind) for kind in swatch_paths}
    garments = json.loads(args.patterns.read_text(encoding='utf-8'))
    for name, parts in garments.items():
        obj = build_garment(name, parts, rig, images)
        export(args.output / f'{name}.glb', rig, [obj], args.draco)

    activate(rig)
    # Blender source includes all editable collections. View the selected look
    # independently through the Outliner to avoid layering every garment at once.
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(args.blend))


if __name__ == '__main__':
    main()
