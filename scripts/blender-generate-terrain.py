# ============================================================
# scripts/blender-generate-terrain.py
# Blender Python 脚本:程序化生成"仙山 + 顶部平台 + 下山小径"
#
# 用法:
#   1. Blender 5.1.2 → Scripting 标签 → 文本编辑器 → + 新建
#   2. 粘贴本脚本
#   3. 点 ▶ 运行
#   4. 等几秒,场景里出现山
#   5. 文件 → 导出 → glTF 2.0 (.glb)
#      - 勾选 "Apply Modifiers"
#      - 格式: glTF Separate (.glb)
# ============================================================

import bpy
import bmesh
from mathutils import Vector, noise
import random
import math

# ============================================================
# 参数(你可以改)
# ============================================================
PARAMS = {
    # 山体大小
    'size_x': 80,
    'size_z': 80,
    # 细分(用 2 的幂次:64 → 2^6 = 6 次细分)
    'subdivisions_pow2': 6,    # 2^6 = 64 per side,4096 个方格,8192 三角面
    'max_height': 32,
    'min_height': 0,

    # 噪声
    'noise_scale': 0.04,        # 周期 = 1/0.04 = 25 单位
    'noise_octaves': 4,
    'noise_persistence': 0.5,
    'seed': 42,

    # 顶部平台(放洞府院子)
    'plateau_radius': 6,
    'plateau_height': 30,
    'plateau_falloff': 3,

    # 下山小径
    'path_enabled': True,
    'path_angle': 0,           # 0=+X, π/2=+Y
    'path_width': 1.5,
    'path_depth': 0.4,
    'path_length': 50,

    # 雪线
    'snow_line': 22,

    # 雪堆
    'add_drift_piles': True,
    'drift_count': 15,

    'output_name': 'ShanXian',
}

# ============================================================
# 工具函数
# ============================================================
def fbm(x, z, octaves, persistence, scale, seed):
    """分形布朗运动(FBM)"""
    total = 0
    amplitude = 1.0
    frequency = scale
    max_value = 0
    for i in range(octaves):
        v = noise.noise(Vector((x * frequency + seed, z * frequency, i * 7.3)))
        n = v * 0.5 + 0.5  # [-1,1] → [0,1]
        total += n * amplitude
        max_value += amplitude
        amplitude *= persistence
        frequency *= 2.0
    return total / max_value

def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)

def get_principled_bsdf(mat):
    for node in mat.node_tree.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            return node
    return None

def set_input_safe(bsdf, name, value):
    if bsdf and name in bsdf.inputs:
        bsdf.inputs[name].default_value = value
        return True
    return False

def create_snow_material():
    mat = bpy.data.materials.new(name="Snow")
    mat.use_nodes = True
    bsdf = get_principled_bsdf(mat)
    if bsdf:
        set_input_safe(bsdf, 'Base Color', (0.95, 0.96, 0.99, 1.0))
        set_input_safe(bsdf, 'Roughness', 0.6)
        if not set_input_safe(bsdf, 'Specular IOR Level', 0.2):
            set_input_safe(bsdf, 'Specular', 0.2)
    else:
        mat.diffuse_color = (0.95, 0.96, 0.99, 1.0)
        mat.roughness = 0.6
    return mat

def create_rock_material():
    mat = bpy.data.materials.new(name="Rock")
    mat.use_nodes = True
    bsdf = get_principled_bsdf(mat)
    if bsdf:
        set_input_safe(bsdf, 'Base Color', (0.32, 0.28, 0.25, 1.0))
        set_input_safe(bsdf, 'Roughness', 0.95)
        if not set_input_safe(bsdf, 'Specular IOR Level', 0.1):
            set_input_safe(bsdf, 'Specular', 0.1)
    else:
        mat.diffuse_color = (0.32, 0.28, 0.25, 1.0)
        mat.roughness = 0.95
    return mat

# ============================================================
# 主程序
# ============================================================
def generate_terrain(p):
    # 1. 清理场景
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # 2. 创建平面(2x2,顶点 [-1, 1])
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = p['output_name']

    # 3. 细分(用 operator,可靠)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    for _ in range(p['subdivisions_pow2']):
        bpy.ops.mesh.subdivide(number_cuts=1)
    bpy.ops.object.mode_set(mode='OBJECT')
    n_verts = len(obj.data.vertices)
    print(f"[terrain] 细分后顶点数: {n_verts}")

    # 4. 应用噪声位移(用世界坐标算)
    sx, sz = p['size_x'], p['size_z']
    pr = p['plateau_radius']
    ph = p['plateau_height']
    fo = p['plateau_falloff']
    pe = p['path_enabled']
    pa = p['path_angle']
    pw = p['path_width']
    pd_ = p['path_depth']
    pl = p['path_length']
    snow_line = p['snow_line']

    path_dir = Vector((math.cos(pa), 0, math.sin(pa)))
    path_perp = Vector((-path_dir.z, 0, path_dir.x))

    for v in obj.data.vertices:
        # 局部坐标 [-1, 1] → 世界坐标 [-sx/2, sx/2]
        world_x = v.co.x * sx / 2
        world_z = v.co.y * sz / 2

        dist_center = math.sqrt(world_x**2 + world_z**2)
        dist_to_path = abs(world_x * path_perp.x + world_z * path_perp.z)
        path_progress = (world_x * path_dir.x + world_z * path_dir.z) / (pl / 2)

        # 基础高度:FBM 噪声(基于世界坐标)
        h = fbm(world_x, world_z, p['noise_octaves'], p['noise_persistence'],
                p['noise_scale'], p['seed'])
        # 边缘衰减
        edge_falloff = 1.0 - smoothstep(sx * 0.35, sx * 0.5, dist_center)
        h = h * edge_falloff
        height = p['min_height'] + h * (p['max_height'] - p['min_height'])

        # 平台
        if dist_center < pr:
            height = ph
        elif dist_center < pr + fo:
            t = (dist_center - pr) / fo
            height = ph + (height - ph) * smoothstep(0, 1, t)

        # 小径
        if pe and dist_to_path < pw and 0 < path_progress < 1:
            t = 1.0 - dist_to_path / pw
            height -= pd_ * t * smoothstep(0, 0.2, path_progress) * smoothstep(0, 0.2, 1 - path_progress)

        v.co.z = height

    # 5. 重算法线
    obj.data.update(calc_edges=True)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()

    # 6. 缩放到实际尺寸(之前 size=2,顶点 [-1,1],所以 scale = (sx/2, sz/2, 1))
    obj.scale = (sx / 2, sz / 2, 1)

    # 7. 材质:雪线以上 = 雪,以下 = 岩石
    mat_snow = create_snow_material()
    mat_rock = create_rock_material()
    obj.data.materials.append(mat_snow)
    obj.data.materials.append(mat_rock)
    for poly in obj.data.polygons:
        center_z = sum(obj.data.vertices[v].co.z for v in poly.vertices) / len(poly.vertices)
        poly.material_index = 0 if center_z > snow_line else 1

    # 8. 雪堆(平台边缘)
    if p['add_drift_piles']:
        for i in range(p['drift_count']):
            angle = random.random() * math.pi * 2
            r = pr * (0.9 + random.random() * 0.5)
            x = math.cos(angle) * r
            z = math.sin(angle) * r
            y = ph + 0.3
            size = 0.3 + random.random() * 0.4
            bpy.ops.mesh.primitive_ico_sphere_add(
                radius=size,
                subdivisions=2,
                location=(x, y, z),
                scale=(1, 0.5, 1)
            )
            bpy.context.active_object.data.materials.append(mat_snow)

    print(f"[terrain] 完成! 顶点 {n_verts}, 三角面 {len(obj.data.polygons)}")
    print(f"          尺寸 {sx}x{sz}, 顶高 {ph}")

generate_terrain(PARAMS)
