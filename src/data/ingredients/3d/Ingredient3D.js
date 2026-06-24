// ============================================================
// data/ingredients/3d/Ingredient3D.js — 3D 药材生成器
//
// 根据 ingredient 数据(grade/type/shape)程序化生成 3D 物件
// 视觉差异由品阶(凡/灵/仙)决定:
//
//   凡品: 简单几何 + matte 材质,无发光
//   灵品: 多面体 + emissive + 弱光晕
//   仙品: 复杂晶簇 + 强 emissive + 3 圈旋转光点
//
// 几何形状来自 ingredient.geomShape 字段
//
// 异步支持:
//   - geomShape === 'glb-model' 时,build() 返回占位 group
//   - 用 loadGlbModelAsync(ingredient) 加载真实 .glb 替换
// ============================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { HangingVine } from '../../../scene/HangingVine.js';

// 共享 DRACO + GLTF Loader(支持被 scripts/compress-models.mjs 压缩过的 GLB)
const _dracoLoader = new DRACOLoader();
_dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const _gltfLoader = new GLTFLoader();
_gltfLoader.setDRACOLoader(_dracoLoader);

const COLOR_CACHE = new Map();
function color(hex) {
  if (!COLOR_CACHE.has(hex)) COLOR_CACHE.set(hex, new THREE.Color(hex));
  return COLOR_CACHE.get(hex);
}

// 共享的 Loader 实例
const _objLoader = new OBJLoader();
const _mtlLoader = new MTLLoader();

export class Ingredient3D {
  /**
   * @param {Object} ingredient 来自 plants/minerals/liquids
   * @returns {THREE.Group}
   */
  static build(ingredient) {
    const group = new THREE.Group();
    group.name = `Ingredient_${ingredient.id}`;

    const baseColor = color(ingredient.colorHex);
    const accentColor = color(ingredient.accentHex);
    const tier = ingredient.grade <= 3 ? 'fan' :
                 ingredient.grade <= 6 ? 'ling' : 'xian';

    // 主几何
    const main = this._buildGeometry(ingredient, baseColor, accentColor, tier);
    if (main instanceof HangingVine) {
      // 整株挂藤作为一个 group 挂到外层 group
      main.group.position.y = 0;
      group.add(main.group);
      group.userData._isHangingVine = true;
      group.userData._hangingVineInstance = main;
    } else if (main) {
      group.add(main);
    }

    // 灵品及以上:加光晕
    if (tier === 'ling' || tier === 'xian') {
      this._addHalo(group, ingredient, tier);
    }

    // 仙品:全套花哨粒子(多环轨道 + 上升光柱 + 扩散能量环 + 随机闪光 + aura)
    if (tier === 'xian') {
      this._addXianFx(group, ingredient);
    }

    return group;
  }

  // ===== 几何生成(按 type + shape) =====

  static _buildGeometry(ing, baseColor, accentColor, tier) {
    const type = ing.type;
    const shape = ing.geomShape;

    // 特殊形状:挂藤(直接返回 HangingVine 实例,跳过其他判断)
    if (shape === 'hanging-vine') {
      return new HangingVine({
        length: 1.5,
        origin: new THREE.Vector3(0, 1.5, 0)
      });
    }

    // GLB 模型:build() 阶段返回占位(loading 球),异步加载后替换
    if (shape === 'glb-model') {
      return this._buildGlbPlaceholder(baseColor, tier);
    }

    // OBJ 模型:build() 阶段返回占位,异步加载后替换
    if (shape === 'obj-model') {
      return this._buildGlbPlaceholder(baseColor, tier);
    }

    if (type === 'plant') {
      if (shape === 'cluster') return this._plantCluster(baseColor, accentColor, tier, 0.15);
      if (shape === 'sprout') return this._plantSprout(baseColor, accentColor, tier);
      if (shape === 'mushroom') return this._mushroom(baseColor, accentColor, tier);
      if (shape === 'root') return this._root(baseColor, accentColor, tier);
      if (shape === 'crystal-plant') return this._crystalPlant(baseColor, accentColor, tier);
      if (shape === 'fruit') return this._peach(baseColor, accentColor, tier);
      if (shape === 'lotus') return this._lotus(baseColor, accentColor, tier);
      if (shape === 'lotus-mythic') return this._lotus(baseColor, accentColor, tier, true);
    }

    if (type === 'mineral') {
      if (shape === 'rock') return this._rock(baseColor, accentColor, tier);
      if (shape === 'shard') return this._shard(baseColor, accentColor, tier);
      if (shape === 'octahedron') return this._crystal(baseColor, accentColor, tier, 0);
      if (shape === 'icosahedron') return this._crystal(baseColor, accentColor, tier, 1);
      if (shape === 'crystal-cluster') return this._crystalCluster(baseColor, accentColor, tier, 4);
      if (shape === 'stardust') return this._stardust(baseColor, accentColor, tier);
      if (shape === 'mythic-crystal') return this._crystalCluster(baseColor, accentColor, tier, 8);
    }

    if (type === 'liquid') {
      if (shape === 'blob') return this._blob(baseColor, accentColor, tier);
      if (shape === 'sphere') return this._liquidSphere(baseColor, accentColor, tier, false);
      if (shape === 'orb') return this._liquidSphere(baseColor, accentColor, tier, false);
      if (shape === 'orb-mythic') return this._liquidSphere(baseColor, accentColor, tier, true);
    }

    // fallback
    return this._crystal(baseColor, accentColor, tier, 0);
  }

  // ===== GLB 模型支持 =====

  /**
   * GLB 占位:在加载完成前显示一个旋转的环+品阶色光晕
   * build() 同步返回它,Preview3D 拿到后异步加载真实模型
   */
  static _buildGlbPlaceholder(baseColor, tier) {
    const grp = new THREE.Group();
    grp.name = 'GlbPlaceholder';
    grp.userData._isGlbPlaceholder = true;

    // 中心晶体(品阶色,半透明,作为占位)
    const main = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: tier === 'xian' ? 0.8 : 0.4,
        transparent: true,
        opacity: 0.6,
        roughness: 0.3,
        metalness: 0.4
      })
    );
    grp.add(main);
    grp.userData._mainMesh = main;

    // 旋转环
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.012, 4, 32),
      new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.7
      })
    );
    ring.rotation.x = Math.PI / 2;
    grp.add(ring);
    grp.userData._ring = ring;

    return grp;
  }

  /**
   * 异步加载 .glb 模型
   * 成功后自动居中、归一化尺寸(~1.2 米)、关闭阴影
   * @param {THREE.Group} group  Ingredient3D.build() 返回的 group
   * @param {string} modelFile  模型路径(以 / 开头)
   * @returns {Promise<THREE.Group>}
   */
  static async loadGlbModelAsync(group, modelFile) {
    try {
      const gltf = await _gltfLoader.loadAsync(modelFile);
      const model = gltf.scene;

      // 1. 计算包围盒 → 归一化到 ~1.2 米
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = maxDim > 0 ? 1.2 / maxDim : 1;
      model.scale.setScalar(scale);

      // 2. 居中(把模型中心挪到 group 原点,底部贴 y=0)
      const center = box.getCenter(new THREE.Vector3());
      model.position.x = -center.x * scale;
      model.position.y = -box.min.y * scale;
      model.position.z = -center.z * scale;

      // 3. 关闭阴影
      model.traverse(obj => {
        if (obj.isMesh) {
          obj.castShadow = false;
          obj.receiveShadow = false;
        }
      });

      // 4. 替换占位:删除所有子,加上真实模型
      //    保留 group.userData(光晕、旋转粒子等装饰)
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
      group.add(model);
      group.userData._isGlbPlaceholder = false;
      group.userData._glbModel = model;

      console.log(`[Ingredient3D] GLB 加载成功: ${modelFile} (scale=${scale.toFixed(3)})`);
      return group;
    } catch (err) {
      console.error(`[Ingredient3D] GLB 加载失败: ${modelFile}`, err);
      return group;  // 失败时保留占位
    }
  }

  /**
   * 异步加载 OBJ 模型(配 MTL 材质 + PBR 贴图)
   * MTLLoader 默认不认识 map_Pm/map_Pr,所以我们手动读 metallic/roughness/normal
   * @param {THREE.Group} group  Ingredient3D.build() 返回的 group
   * @param {string} modelFile  OBJ 路径(以 / 开头)
   * @param {Object} [pbrTextures]  PBR 贴图(可选)
   * @param {string} [pbrTextures.metallic]   metallic 贴图路径
   * @param {string} [pbrTextures.roughness]  roughness 贴图路径
   * @param {string} [pbrTextures.normal]     normal 贴图路径
   * @returns {Promise<THREE.Group>}
   */
  static async loadObjModelAsync(group, modelFile, pbrTextures = {}) {
    const objUrl = modelFile;
    // MTL 路径:把 .obj 替换为 .mtl
    const mtlUrl = modelFile.replace(/\.obj$/i, '.mtl');

    try {
      // 1. 加载 MTL(材质 + 贴图引用)
      let mtlMaterials = null;
      try {
        mtlMaterials = await _mtlLoader.loadAsync(mtlUrl);
        mtlMaterials.preload();
        _objLoader.setMaterials(mtlMaterials);
      } catch (e) {
        console.warn(`[Ingredient3D] MTL 加载失败 ${mtlUrl},继续无材质加载`, e);
      }

      // 2. 加载 OBJ
      const model = await _objLoader.loadAsync(objUrl);

      // 3. 应用 PBR 贴图(MTLLoader 不识别 map_Pm/map_Pr)
      //    遍历所有子 mesh,如果它们有 material(map_Kd 的 diffuse),增强为 PBR
      const [metallicTex, roughnessTex, normalTex] = await Promise.all([
        pbrTextures.metallic ? new THREE.TextureLoader().loadAsync(pbrTextures.metallic) : Promise.resolve(null),
        pbrTextures.roughness ? new THREE.TextureLoader().loadAsync(pbrTextures.roughness) : Promise.resolve(null),
        pbrTextures.normal ? new THREE.TextureLoader().loadAsync(pbrTextures.normal) : Promise.resolve(null)
      ]);

      model.traverse(obj => {
        if (obj.isMesh && obj.material) {
          const oldMat = obj.material;
          // 把 MTL 的 MeshPhongMaterial 转成 MeshStandardMaterial 以支持 PBR
          if (oldMat.isMeshPhongMaterial || oldMat.isMeshLambertMaterial || oldMat.isMeshBasicMaterial) {
            const newMat = new THREE.MeshStandardMaterial({
              map: oldMat.map || null,
              color: oldMat.color || 0xffffff,
              transparent: oldMat.transparent,
              opacity: oldMat.opacity ?? 1.0,
              side: oldMat.side || THREE.FrontSide
            });
            if (metallicTex) {
              newMat.metalnessMap = metallicTex;
              newMat.metalness = 1.0;  // 用贴图控制
            } else {
              newMat.metalness = 0.3;
            }
            if (roughnessTex) {
              newMat.roughnessMap = roughnessTex;
              newMat.roughness = 1.0;  // 用贴图控制
            } else {
              newMat.roughness = 0.6;
            }
            if (normalTex) {
              newMat.normalMap = normalTex;
              newMat.normalScale = new THREE.Vector2(1, 1);
            }
            obj.material = newMat;
          }
          obj.castShadow = false;
          obj.receiveShadow = false;
        }
      });

      // 4. 归一化尺寸到 ~1.2 米
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = maxDim > 0 ? 1.2 / maxDim : 1;
      model.scale.setScalar(scale);

      // 5. 居中(底部贴 y=0)
      const center = box.getCenter(new THREE.Vector3());
      model.position.x = -center.x * scale;
      model.position.y = -box.min.y * scale;
      model.position.z = -center.z * scale;

      // 6. 替换占位
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
      group.add(model);
      group.userData._isGlbPlaceholder = false;
      group.userData._glbModel = model;

      console.log(`[Ingredient3D] OBJ 加载成功: ${modelFile} (scale=${scale.toFixed(3)})`);
      return group;
    } catch (err) {
      console.error(`[Ingredient3D] OBJ 加载失败: ${modelFile}`, err);
      return group;  // 失败时保留占位
    }
  }

  // ===== 植物类 =====

  static _plantCluster(color, accent, tier, size) {
    const grp = new THREE.Group();
    const mat = this._makeMaterial(color, tier, 0.3);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 4), mat);
      m.position.set((Math.random() - 0.5) * 0.3, Math.random() * 0.2, (Math.random() - 0.5) * 0.3);
      grp.add(m);
    }
    return grp;
  }

  static _plantSprout(color, accent, tier) {
    const grp = new THREE.Group();
    // 茎
    const stemMat = this._makeMaterial(accent, tier, 0.2);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.4, 6), stemMat);
    stem.position.y = 0.2;
    grp.add(stem);
    // 叶
    const leafMat = this._makeMaterial(color, tier, 0.5);
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), leafMat);
      leaf.scale.set(1, 0.4, 1.5);
      leaf.position.set(Math.cos(angle) * 0.1, 0.35, Math.sin(angle) * 0.1);
      leaf.rotation.y = angle;
      grp.add(leaf);
    }
    return grp;
  }

  static _mushroom(color, accent, tier) {
    const grp = new THREE.Group();
    // 柄
    const stemMat = this._makeMaterial(accent, tier, 0.2);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.3, 8), stemMat);
    stem.position.y = 0.15;
    grp.add(stem);
    // 伞盖(半球)
    const capMat = this._makeMaterial(color, tier, 0.6);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
      capMat
    );
    cap.position.y = 0.3;
    cap.scale.y = 0.7;
    grp.add(cap);
    return grp;
  }

  static _root(color, accent, tier) {
    // 人形根(简化版)
    const grp = new THREE.Group();
    const mat = this._makeMaterial(color, tier, 0.4);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 8), mat);
    body.position.y = 0.25;
    grp.add(body);
    // 头部
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat);
    head.position.y = 0.5;
    grp.add(head);
    // 四肢
    for (const [x, y, z] of [[0.13, 0.2, 0], [-0.13, 0.2, 0], [0.08, 0.05, 0], [-0.08, 0.05, 0]]) {
      const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.2, 6), mat);
      limb.position.set(x, y, z);
      limb.rotation.z = x > 0 ? -0.4 : 0.4;
      grp.add(limb);
    }
    return grp;
  }

  static _crystalPlant(color, accent, tier) {
    // 半透明叶状
    const grp = new THREE.Group();
    const mat = this._makeMaterial(color, tier, 0.8, true);
    // 主体多面晶体
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mat);
    body.position.y = 0.3;
    grp.add(body);
    // 几个小叶
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), mat);
      leaf.position.set(Math.cos(angle) * 0.18, 0.5, Math.sin(angle) * 0.18);
      leaf.rotation.z = -angle + Math.PI / 2;
      grp.add(leaf);
    }
    return grp;
  }

  static _peach(color, accent, tier) {
    const grp = new THREE.Group();
    const mat = this._makeMaterial(color, tier, 0.7);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), mat);
    body.scale.set(1, 0.9, 1);
    body.position.y = 0.22;
    grp.add(body);
    // 桃尖
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 6), mat);
    tip.position.set(0.1, 0.18, 0.1);
    tip.rotation.set(0.5, 0.5, 0);
    grp.add(tip);
    // 叶子
    const leafMat = this._makeMaterial(color('#5a8030'), tier, 0.3);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), leafMat);
    leaf.scale.set(0.5, 1.5, 0.3);
    leaf.position.set(-0.1, 0.4, 0.05);
    grp.add(leaf);
    return grp;
  }

  static _lotus(color, accent, tier, mythic = false) {
    const grp = new THREE.Group();
    const mat = this._makeMaterial(color, tier, 0.8, true);
    // 中心花蕊
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), mat);
    center.position.y = 0.05;
    grp.add(center);
    // 8 片花瓣
    const count = mythic ? 9 : 8;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 5),
        mat
      );
      petal.scale.set(0.5, 0.3, 1.2);
      petal.position.set(Math.cos(angle) * 0.2, 0.05, Math.sin(angle) * 0.2);
      petal.rotation.y = -angle;
      grp.add(petal);
    }
    return grp;
  }

  // ===== 矿物类 =====

  static _rock(color, accent, tier) {
    const geo = new THREE.DodecahedronGeometry(0.2, 0);
    const mat = this._makeMaterial(color, tier, 0.3);
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(1.2, 0.8, 1);
    return m;
  }

  static _shard(color, accent, tier) {
    const geo = new THREE.ConeGeometry(0.15, 0.4, 5);
    const mat = this._makeMaterial(color, tier, 0.4);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.z = Math.PI;  // 尖端朝下
    return m;
  }

  static _crystal(color, accent, tier, detail) {
    const geo = new THREE.OctahedronGeometry(0.22, detail);
    const mat = this._makeMaterial(color, tier, 0.6, tier !== 'fan');
    return new THREE.Mesh(geo, mat);
  }

  static _crystalCluster(color, accent, tier, count = 4) {
    const grp = new THREE.Group();
    const mat = this._makeMaterial(color, tier, 0.7, true);
    // 中心大晶体
    const main = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), mat);
    grp.add(main);
    // 周围小晶体
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 0.2;
      const small = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.1 + Math.random() * 0.05, 0),
        mat
      );
      small.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      small.scale.y = 1.5;
      grp.add(small);
    }
    return grp;
  }

  static _stardust(color, accent, tier) {
    const grp = new THREE.Group();
    const mat = this._makeMaterial(color, tier, 0.9, true);
    // 一簇小星点
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.15 + Math.random() * 0.15;
      const star = new THREE.Mesh(
        new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 6, 4),
        mat
      );
      star.position.set(
        Math.cos(angle) * r,
        (Math.random() - 0.5) * 0.2,
        Math.sin(angle) * r
      );
      grp.add(star);
    }
    return grp;
  }

  // ===== 液体类 =====

  static _blob(color, accent, tier) {
    const geo = new THREE.SphereGeometry(0.2, 8, 6);
    const mat = this._makeMaterial(color, tier, 0.3, true);
    mat.transparent = true;
    mat.opacity = 0.85;
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(1.2, 0.8, 1);
    return m;
  }

  static _liquidSphere(color, accent, tier, mythic = false) {
    const grp = new THREE.Group();
    const mat = this._makeMaterial(color, tier, 0.9, true);
    mat.transparent = true;
    mat.opacity = 0.9;
    const r = mythic ? 0.28 : 0.22;
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat);
    grp.add(body);
    // 内部小核
    const coreMat = this._makeMaterial(accent, tier, 1.2, true);
    coreMat.transparent = true;
    coreMat.opacity = 0.6;
    const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.4, 12, 8), coreMat);
    grp.add(core);
    return grp;
  }

  // ===== 装饰:光晕 =====

  static _addHalo(group, ingredient, tier) {
    const intensity = tier === 'xian' ? 1.5 : 0.6;
    const dist = tier === 'xian' ? 0.8 : 0.5;
    const light = new THREE.PointLight(
      new THREE.Color(ingredient.colorHex),
      intensity,
      dist,
      1.5
    );
    light.position.y = 0.2;
    group.add(light);
    group.userData._haloLight = light;
  }

  // ===== 仙品专属:全套粒子特效 =====

  /**
   * 仙品(7-9品)药材的全套花哨特效:
   *   ① Aura 能量球(大范围,呼吸效果)
   *   ② 3 层轨道粒子(更大半径)
   *   ③ 上升光柱(更高更广)
   *   ④ 扩散能量环(更大,更频繁,双环)
   *   ⑤ 十字闪光(代替小球)
   *   ⑥ 顶冠光环(模型上方反向旋转)
   *   ⑦ 基座光晕盘(底部发光圆盘)
   *   ⑧ 闪电特效(从天空随机劈下)
   *   ⑨ 能量球升起(慢动作从底到顶)
   *
   * 全部存在 group.userData._xianFx 中,update() 里逐个推进
   */
  static _addXianFx(group, ingredient) {
    const fx = {};
    // 调色板:从 ingredient.fxColors 读(没给就用 colorHex/accentHex)
    const palette = (ingredient.fxColors && ingredient.fxColors.length >= 3)
      ? ingredient.fxColors.map(c => new THREE.Color(c))
      : [new THREE.Color(ingredient.colorHex), new THREE.Color(ingredient.accentHex), new THREE.Color(ingredient.colorHex)];
    const c0 = palette[0];  // 主色
    const c1 = palette[1];  // 副色
    const c2 = palette[2 % palette.length];  // 第三色
    const c3 = palette[3 % palette.length];  // 第四色
    const c4 = palette[4 % palette.length];  // 第五色(高光)
    const c5 = palette[5 % palette.length];  // 第六色(深色)
    fx.palette = palette;  // 给 spawn 函数用
    fx._sparkleTex = this._makeSparkleTexture();

    // ===== ① Aura 能量球(双层,大范围) =====
    const auraOuter = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 32, 20),
      new THREE.MeshBasicMaterial({
        color: c0,
        transparent: true,
        opacity: 0.06,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    auraOuter.position.y = 0.6;
    group.add(auraOuter);
    fx.auraOuter = auraOuter;

    const auraInner = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 24, 16),
      new THREE.MeshBasicMaterial({
        color: c1,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    auraInner.position.y = 0.6;
    group.add(auraInner);
    fx.auraInner = auraInner;

    // ===== ② 4 层轨道粒子(更大范围,每层不同色) =====
    const ringConfigs = [
      { count: 10, radius: 0.7,  size: 0.04,  speed: 1.8, y: 0.25, opacity: 0.95, tilt: 0,                color: c0 },
      { count: 12, radius: 1.05, size: 0.032, speed: 1.3, y: 0.55, opacity: 0.85, tilt: Math.PI * 0.18, color: c2 },
      { count: 14, radius: 1.4,  size: 0.025, speed: 0.9, y: 0.95, opacity: 0.70, tilt: -Math.PI * 0.22, color: c1 },
      { count: 8,  radius: 1.8,  size: 0.020, speed: 0.5, y: 1.4,  opacity: 0.55, tilt: Math.PI * 0.10, color: c3 }
    ];
    fx.rings = [];
    for (const cfg of ringConfigs) {
      const mat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ring = { particles: [], mat, cfg, group: new THREE.Group() };
      ring.group.rotation.x = cfg.tilt;
      group.add(ring.group);

      for (let i = 0; i < cfg.count; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(cfg.size, 6, 4), mat);
        const angle = (i / cfg.count) * Math.PI * 2;
        p.userData = {
          angle,
          baseY: cfg.y,
          yWobble: Math.random() * Math.PI * 2
        };
        p.position.set(
          Math.cos(angle) * cfg.radius,
          cfg.y,
          Math.sin(angle) * cfg.radius
        );
        ring.group.add(p);
        ring.particles.push(p);
      }
      fx.rings.push(ring);
    }

    // ===== ③ 上升光柱(更高更广,多色循环) =====
    const streamCount = 40;
    fx.stream = { particles: [] };
    for (let i = 0; i < streamCount; i++) {
      const size = 0.02 + Math.random() * 0.018;
      // 每颗粒子有自己的颜色(从调色板里取)
      const col = palette[i % palette.length];
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const p = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 4), mat);
      p.userData = {
        progress: Math.random(),
        speed: 0.3 + Math.random() * 0.4,
        radius: 0.4 + Math.random() * 1.3,   // 更宽的散布
        angle: Math.random() * Math.PI * 2,
        yJitter: Math.random() * 0.2
      };
      p.position.y = p.userData.progress * 2.6;
      group.add(p);
      fx.stream.particles.push(p);
    }

    // ===== ④ 扩散能量环 =====
    fx.expandRings = [];
    fx.expandRingTimer = 0;

    // ===== ⑤ 十字闪光(Sprite 形式) =====
    fx.sparkles = [];
    fx.sparkleTimer = 0;

    // ===== ⑥ 顶冠光环(三层,多色,反向旋转) =====
    const crownConfigs = [
      { radius: 0.8,  thickness: 0.015, y: 1.4, color: c0, opacity: 0.7, speed:  0.8 },
      { radius: 0.55, thickness: 0.010, y: 1.65, color: c1, opacity: 0.8, speed: -1.4 },
      { radius: 0.4,  thickness: 0.006, y: 1.9, color: c2, opacity: 0.6, speed:  2.0 }
    ];
    fx.crownRings = [];
    for (const cfg of crownConfigs) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.radius, cfg.thickness, 6, 64),
        new THREE.MeshBasicMaterial({
          color: cfg.color,
          transparent: true,
          opacity: cfg.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = cfg.y;
      ring.userData = { speed: cfg.speed, baseY: cfg.y, baseOpacity: cfg.opacity };
      group.add(ring);
      fx.crownRings.push(ring);
    }

    // ===== ⑦ 基座光晕盘(双层,多色) =====
    const baseDisc = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 1.4, 64),
      new THREE.MeshBasicMaterial({
        color: c0,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    baseDisc.rotation.x = -Math.PI / 2;
    baseDisc.position.y = 0.02;
    group.add(baseDisc);
    fx.baseDisc = baseDisc;

    const baseDisc2 = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 1.7, 64),
      new THREE.MeshBasicMaterial({
        color: c2,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    baseDisc2.rotation.x = -Math.PI / 2;
    baseDisc2.position.y = 0.018;
    group.add(baseDisc2);
    fx.baseDisc2 = baseDisc2;

    const baseSpot = new THREE.Mesh(
      new THREE.CircleGeometry(0.4, 32),
      new THREE.MeshBasicMaterial({
        color: c4,  // 高光色
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    baseSpot.rotation.x = -Math.PI / 2;
    baseSpot.position.y = 0.015;
    group.add(baseSpot);
    fx.baseSpot = baseSpot;

    // ===== ⑧ 闪电(随机从天空劈下) =====
    fx.lightnings = [];
    fx.lightningTimer = 0;

    // ===== ⑨ 能量球升起 =====
    fx.energyOrbs = [];
    fx.energyOrbTimer = 0;

    group.userData._xianFx = fx;
  }

  /**
   * 生成十字闪光 sprite 贴图(用 Canvas 画)
   * 返回一个带光晕的十字,加色混合后很亮
   */
  static _makeSparkleTexture() {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const cx = size / 2, cy = size / 2;
    // 中心亮斑
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.3);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, size, size);
    // 横线
    const hline = ctx.createLinearGradient(0, cy, size, cy);
    hline.addColorStop(0, 'rgba(255,255,255,0)');
    hline.addColorStop(0.4, 'rgba(255,255,255,0.9)');
    hline.addColorStop(0.5, 'rgba(255,255,255,1)');
    hline.addColorStop(0.6, 'rgba(255,255,255,0.9)');
    hline.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hline;
    ctx.fillRect(0, cy - 1, size, 2);
    // 竖线
    const vline = ctx.createLinearGradient(cx, 0, cx, size);
    vline.addColorStop(0, 'rgba(255,255,255,0)');
    vline.addColorStop(0.4, 'rgba(255,255,255,0.9)');
    vline.addColorStop(0.5, 'rgba(255,255,255,1)');
    vline.addColorStop(0.6, 'rgba(255,255,255,0.9)');
    vline.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = vline;
    ctx.fillRect(cx - 1, 0, 2, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * 创建一个扩散能量环(双环,一大一小)
   */
  static _spawnExpandRing(group, color) {
    const fx = group.userData._xianFx;
    for (const cfg of [
      { startR: 0.25, endR: 2.0,  thickness: 0.012, opacity: 0.85, life: 1.6 },
      { startR: 0.25, endR: 2.4,  thickness: 0.006, opacity: 0.55, life: 2.0 }
    ]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(cfg.startR, cfg.thickness, 4, 64),
        new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: cfg.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.3;
      group.add(ring);
      fx.expandRings.push({
        mesh: ring,
        age: 0,
        life: cfg.life,
        startR: cfg.startR,
        endR: cfg.endR
      });
    }
  }

  /**
   * 创建一个十字闪光(在模型周围随机位置,颜色从调色板随机取)
   */
  static _spawnSparkle(group, sparkleTex) {
    const fx = group.userData._xianFx;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.7;
    const r = 0.6 + Math.random() * 1.5;  // 范围更大
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = 0.2 + r * Math.cos(phi) * 0.7;
    const z = r * Math.sin(phi) * Math.sin(theta);

    // 随机从调色板取色(高亮色更常出现)
    const color = fx.palette[Math.floor(Math.random() * fx.palette.length)];

    const mat = new THREE.SpriteMaterial({
      map: sparkleTex,
      color: color,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(0.3);
    group.add(sprite);
    fx.sparkles.push({
      mesh: sprite,
      mat: mat,
      age: 0,
      life: 0.7
    });
  }

  /**
   * 创建一道闪电(白色本体+调色板色光晕)
   */
  static _spawnLightning(group) {
    const fx = group.userData._xianFx;
    const haloColor = fx.palette[Math.floor(Math.random() * fx.palette.length)];
    // 构造 5-8 个折点的折线
    const segments = 6 + Math.floor(Math.random() * 3);
    const startY = 3.0 + Math.random() * 0.6;  // 起得更高
    const endY = 0.3;
    const offsetX = (Math.random() - 0.5) * 0.5;
    const offsetZ = (Math.random() - 0.5) * 0.5;
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = startY + (endY - startY) * t;
      const x = offsetX * t + (Math.random() - 0.5) * 0.2 * t;
      const z = offsetZ * t + (Math.random() - 0.5) * 0.2 * t;
      points.push(new THREE.Vector3(x, y, z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,  // 本体白色
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const line = new THREE.Line(geo, mat);
    group.add(line);

    // 彩色光晕
    const haloMat = new THREE.LineBasicMaterial({
      color: haloColor,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const halo = new THREE.Line(geo.clone(), haloMat);
    group.add(halo);

    fx.lightnings.push({
      line, halo, mat: mat, haloMat: haloMat,
      age: 0,
      life: 0.4
    });
  }

  /**
   * 创建一个能量球(从底升到顶,内/外双色)
   */
  static _spawnEnergyOrb(group) {
    const fx = group.userData._xianFx;
    const coreColor = fx.palette[Math.floor(Math.random() * fx.palette.length)];
    const haloColor = fx.palette[Math.floor(Math.random() * fx.palette.length)];
    const radius = 0.07 + Math.random() * 0.06;
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 12, 8),
      new THREE.MeshBasicMaterial({
        color: coreColor,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    // 外层光晕(更大)
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 3.0, 12, 8),
      new THREE.MeshBasicMaterial({
        color: haloColor,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    orb.add(halo);
    orb.userData = { halo };
    orb.position.set(
      (Math.random() - 0.5) * 0.8,
      0.05,
      (Math.random() - 0.5) * 0.8
    );
    group.add(orb);
    fx.energyOrbs.push({
      mesh: orb,
      halo: halo,
      mat: orb.material,
      haloMat: halo.material,
      age: 0,
      life: 2.8
    });
  }

  // ===== 工具:构造材质 =====

  static _makeMaterial(color, tier, brightness = 0.5, transparent = false) {
    const opts = {
      color: color,
      roughness: tier === 'xian' ? 0.2 : tier === 'ling' ? 0.4 : 0.85,
      metalness: tier === 'xian' ? 0.6 : tier === 'ling' ? 0.3 : 0.0,
      flatShading: true
    };
    if (tier !== 'fan') {
      opts.emissive = color;
      opts.emissiveIntensity = tier === 'xian' ? 1.2 * brightness : 0.6 * brightness;
    }
    if (transparent) {
      opts.transparent = true;
      opts.opacity = 0.85;
    }
    return new THREE.MeshStandardMaterial(opts);
  }

  // ===== 主循环:仙品粒子旋转 =====

  static update(group, dt, t) {
    // 挂藤:调自身的 update(叶子摆动)
    if (group.userData._isHangingVine && group.userData._hangingVineInstance) {
      group.userData._hangingVineInstance.update(dt);
      // 整体缓慢旋转(让玩家看清多面)
      group.rotation.y += dt * 0.3;
      return;
    }

    // GLB 占位:旋转中心 + 环,作为加载提示
    if (group.userData._isGlbPlaceholder) {
      if (group.userData._mainMesh) {
        group.userData._mainMesh.rotation.y += dt * 1.2;
        group.userData._mainMesh.rotation.x += dt * 0.5;
      }
      if (group.userData._ring) {
        group.userData._ring.rotation.z += dt * 0.8;
      }
      return;
    }

    // 旋转光晕
    if (group.userData._haloLight) {
      const light = group.userData._haloLight;
      const base = light.userData._base || light.intensity;
      light.userData._base = base;
      light.intensity = base * (0.9 + Math.sin(t * 3) * 0.15);
    }
    // 仙品全套粒子
    if (group.userData._xianFx) {
      this._updateXianFx(group, dt, t);
    }
    // 整体缓慢旋转(让玩家看清多面体)
    group.rotation.y += dt * 0.4;
  }

  /**
   * 仙品药材特效动画:每帧推进所有粒子系统
   *   ① Aura 双层(大范围,呼吸)
   *   ② 四层倾斜轨道(更大半径,每层不同色)
   *   ③ 上升光柱(更高更广,每颗不同色)
   *   ④ 扩散双环(更频繁更大)
   *   ⑤ 十字 Sprite 闪光(调色板随机色)
   *   ⑥ 三层顶冠光环(反向旋转,多色)
   *   ⑦ 双基座光晕盘 + 高光中心(脉动)
   *   ⑧ 闪电(随机劈下,持续 0.4s,白+调色板色)
   *   ⑨ 能量球升起(2.8s 慢动作,内+外双色)
   */
  static _updateXianFx(group, dt, t) {
    const fx = group.userData._xianFx;
    const palette = fx.palette;
    const c0 = palette[0];
    const c1 = palette[1 % palette.length];
    const c2 = palette[2 % palette.length];

    // ① Aura 双层 — 不同节奏呼吸
    if (fx.auraOuter) {
      fx.auraOuter.material.opacity = 0.05 + Math.sin(t * 0.8) * 0.03;
      fx.auraOuter.scale.setScalar(1 + Math.sin(t * 0.7) * 0.06);
    }
    if (fx.auraInner) {
      fx.auraInner.material.opacity = 0.10 + Math.sin(t * 1.5 + 1) * 0.05;
      fx.auraInner.scale.setScalar(1 + Math.sin(t * 1.2) * 0.04);
    }

    // ② 四层轨道 — group 整体旋转,各层独立角度和颜色
    for (const ring of fx.rings) {
      const { particles, cfg } = ring;
      ring.group.rotation.y += dt * cfg.speed;
      for (const p of particles) {
        const yWobble = Math.sin(t * 2 + p.userData.yWobble) * 0.08;
        p.position.y = cfg.y + yWobble;
      }
    }

    // ③ 上升光柱(每颗自己颜色,不动)
    for (const p of fx.stream.particles) {
      const d = p.userData;
      d.progress += dt * d.speed;
      if (d.progress >= 1) d.progress -= 1;
      const y = d.progress * 2.6;
      const swirl = d.progress * Math.PI * 3;
      p.position.set(
        Math.cos(d.angle + swirl) * d.radius,
        y + d.yJitter,
        Math.sin(d.angle + swirl) * d.radius
      );
      p.material.opacity = Math.sin(d.progress * Math.PI) * 0.8;
    }

    // ④ 扩散能量环 — 每 1.0 秒生成一组双环(主色+副色)
    fx.expandRingTimer += dt;
    if (fx.expandRingTimer >= 1.0) {
      fx.expandRingTimer = 0;
      this._spawnExpandRing(group, c0);
    }
    for (let i = fx.expandRings.length - 1; i >= 0; i--) {
      const r = fx.expandRings[i];
      r.age += dt;
      const t01 = r.age / r.life;
      const r2 = r.startR + (r.endR - r.startR) * t01;
      r.mesh.scale.setScalar(r2 / r.startR);
      r.mesh.material.opacity = (1 - t01) * (r.mesh.material.opacity > 0.7 ? 0.85 : 0.55);
      if (r.age >= r.life) {
        group.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        fx.expandRings.splice(i, 1);
      }
    }

    // ⑤ 十字闪光 — 每 0.1 秒 50% 概率(更高频)
    fx.sparkleTimer += dt;
    if (fx.sparkleTimer >= 0.1) {
      fx.sparkleTimer = 0;
      if (Math.random() < 0.5) {
        this._spawnSparkle(group, fx._sparkleTex);
      }
    }
    for (let i = fx.sparkles.length - 1; i >= 0; i--) {
      const s = fx.sparkles[i];
      s.age += dt;
      const t01 = s.age / s.life;
      s.mat.opacity = Math.sin(t01 * Math.PI) * 1.0;
      const scale = 0.3 + Math.sin(t01 * Math.PI) * 0.7;
      s.mesh.scale.setScalar(scale);
      if (s.age >= s.life) {
        group.remove(s.mesh);
        s.mat.dispose();
        fx.sparkles.splice(i, 1);
      }
    }

    // ⑥ 顶冠光环(三层,多色,各自独立旋转方向)
    for (const ring of fx.crownRings) {
      ring.rotation.z += dt * ring.userData.speed;
      ring.position.y = ring.userData.baseY + Math.sin(t * 1.2 + ring.userData.speed) * 0.04;
      ring.material.opacity = ring.userData.baseOpacity * (0.85 + Math.sin(t * 2 + ring.userData.speed) * 0.15);
    }

    // ⑦ 基座光晕盘 — 双层脉动
    if (fx.baseDisc) {
      fx.baseDisc.material.opacity = 0.4 + Math.sin(t * 2) * 0.2;
      fx.baseDisc.scale.setScalar(1 + Math.sin(t * 1.5) * 0.06);
    }
    if (fx.baseDisc2) {
      fx.baseDisc2.material.opacity = 0.25 + Math.sin(t * 1.5 + 1) * 0.15;
      fx.baseDisc2.scale.setScalar(1 + Math.sin(t * 1.2 + 0.5) * 0.05);
    }
    if (fx.baseSpot) {
      fx.baseSpot.material.opacity = 0.3 + Math.sin(t * 2.5) * 0.15;
    }

    // ⑧ 闪电 — 每 1.2-2.5 秒随机一次
    fx.lightningTimer += dt;
    if (fx.lightningTimer >= 1.2 + Math.random() * 1.3) {
      fx.lightningTimer = 0;
      this._spawnLightning(group);
    }
    for (let i = fx.lightnings.length - 1; i >= 0; i--) {
      const l = fx.lightnings[i];
      l.age += dt;
      const t01 = l.age / l.life;
      l.mat.opacity = t01 < 0.2 ? 1.0 : (1 - (t01 - 0.2) / 0.8);
      l.haloMat.opacity = t01 < 0.2 ? 0.7 : (1 - (t01 - 0.2) / 0.8) * 0.7;
      if (l.age >= l.life) {
        group.remove(l.line);
        group.remove(l.halo);
        l.line.geometry.dispose();
        l.mat.dispose();
        l.haloMat.dispose();
        fx.lightnings.splice(i, 1);
      }
    }

    // ⑨ 能量球升起 — 每 0.7 秒 65% 概率
    fx.energyOrbTimer += dt;
    if (fx.energyOrbTimer >= 0.7) {
      fx.energyOrbTimer = 0;
      if (Math.random() < 0.65) {
        this._spawnEnergyOrb(group);
      }
    }
    for (let i = fx.energyOrbs.length - 1; i >= 0; i--) {
      const o = fx.energyOrbs[i];
      o.age += dt;
      const t01 = o.age / o.life;
      o.mesh.position.y = 0.05 + t01 * 2.4;  // 升得更高
      o.mat.opacity = t01 < 0.7 ? 0.9 : (1 - (t01 - 0.7) / 0.3) * 0.9;
      o.haloMat.opacity = t01 < 0.7 ? 0.5 : (1 - (t01 - 0.7) / 0.3) * 0.5;
      if (o.age >= o.life) {
        group.remove(o.mesh);
        o.mat.dispose();
        o.haloMat.dispose();
        fx.energyOrbs.splice(i, 1);
      }
    }
  }
}
