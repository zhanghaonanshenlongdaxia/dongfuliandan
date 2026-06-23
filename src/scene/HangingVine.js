// ============================================================
// scene/HangingVine.js — 3D 垂藤草(终极版)
//
// 应用了所有能做的程序增强:
//   ① Canvas 贴图 - 叶脉/色斑/边缘(给叶子"肌理")
//   ② PBR 物理材质 - transmission 透光 + sheen 绒光 + iridescence 虹彩
//   ③ 弯曲叶子几何 - 4x3 网格,中间凸起(从纸片→有体积)
//   ④ 风吹物理 - 沿藤蔓的"波浪"位移 + 末梢摆大
//   ⑤ 单独 Pollen 粒子模块(场景里飘的光点)
//
// 加上原来的:
//   - 渐细藤(根部粗 → 末梢细)
//   - 12-15 片叶子/藤
//   - 顶点色渐变(主色→暗色)
//   - 14 片顶端密集小叶
// ============================================================

import * as THREE from 'three';

// ============== 颜色工具 ==============

const C_TOP   = new THREE.Color(0x1a5050);
const C_MID   = new THREE.Color(0x5a9060);
const C_BOT   = new THREE.Color(0xd46038);
const C_TOP_DARK = new THREE.Color(0x0d3838);
const C_MID_DARK = new THREE.Color(0x3a6038);
const C_BOT_DARK = new THREE.Color(0x8a3a18);

function leafColorAt(t) {
  if (t < 0.5) return C_TOP.clone().lerp(C_MID, t * 2);
  return C_MID.clone().lerp(C_BOT, (t - 0.5) * 2);
}
function leafDarkAt(t) {
  if (t < 0.5) return C_TOP_DARK.clone().lerp(C_MID_DARK, t * 2);
  return C_MID_DARK.clone().lerp(C_BOT_DARK, (t - 0.5) * 2);
}

// ============== ① Canvas 画程序贴图 ==============

/**
 * 在 256x256 canvas 上画一片"有肌理的叶子"贴图
 * 包含:主脉 + 侧脉 + 边缘渐变 + 一些色斑
 * 同一份贴图被所有叶子共享(节省显存)
 */
function makeLeafTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  // 1. 底色:暖绿色(中性,所有叶子共用,实际颜色由 material 调)
  ctx.fillStyle = '#f8f0d8';
  ctx.fillRect(0, 0, size, size);

  // 2. 画叶片(柳叶形)
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.fillStyle = '#88aa55';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.45);
  ctx.bezierCurveTo(
    size * 0.28, -size * 0.2,
    size * 0.32, size * 0.2,
    0, size * 0.45
  );
  ctx.bezierCurveTo(
    -size * 0.32, size * 0.2,
    -size * 0.28, -size * 0.2,
    0, -size * 0.45
  );
  ctx.fill();
  ctx.restore();

  // 3. 主脉(中轴深色)
  ctx.strokeStyle = '#4a6030';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(size / 2, size * 0.08);
  ctx.lineTo(size / 2, size * 0.92);
  ctx.stroke();

  // 4. 侧脉(5-6 对,从中轴斜向叶缘)
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const y = size * 0.18 + i * (size * 0.62 / 6);
    const len = size * 0.18 + (5 - i) * 4;
    const taper = 1 - i * 0.05;
    ctx.beginPath();
    ctx.moveTo(size / 2, y);
    ctx.quadraticCurveTo(size / 2 + len * 0.5 * taper, y + size * 0.02, size / 2 + len * taper, y + size * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size / 2, y);
    ctx.quadraticCurveTo(size / 2 - len * 0.5 * taper, y + size * 0.02, size / 2 - len * taper, y + size * 0.06);
    ctx.stroke();
  }

  // 5. 细小杂色斑(随机深浅点)
  for (let i = 0; i < 30; i++) {
    const x = size * 0.2 + Math.random() * size * 0.6;
    const y = size * 0.15 + Math.random() * size * 0.7;
    const a = Math.random() * 0.3;
    ctx.fillStyle = `rgba(60, 80, 30, ${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. 边缘渐变(略深,模拟叶缘的厚度)
  const edgeGrad = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.48);
  edgeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  edgeGrad.addColorStop(1, 'rgba(40, 60, 20, 0.3)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, size, size);

  // 7. 几条小细毛(叶面绒感)
  ctx.strokeStyle = 'rgba(80, 100, 50, 0.4)';
  ctx.lineWidth = 0.4;
  for (let i = 0; i < 20; i++) {
    const x = size * 0.25 + Math.random() * size * 0.5;
    const y = size * 0.2 + Math.random() * size * 0.6;
    const len = 3 + Math.random() * 5;
    const angle = (Math.random() - 0.5) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ============== ② PBR 物理材质 ==============

/**
 * 创建叶子材质(MeshPhysicalMaterial)
 * 关键参数:
 *   map          - 共享的叶脉贴图
 *   color        - 顶点色叠加
 *   transmission - 半透光(0.3 = 30% 透光率)
 *   thickness    - 模拟叶子厚度
 *   sheen        - 边缘绒光(像真叶边缘的细毛)
 *   iridescence  - 微微虹彩
 *   side         - DoubleSide(两面都渲染)
 */
function makeLeafMaterial(leafMap) {
  return new THREE.MeshPhysicalMaterial({
    map: leafMap,
    // color 会被 vertexColor 覆盖
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 0.65,
    metalness: 0.0,
    transparent: true,
    opacity: 0.95,
    // 物理材质专属
    transmission: 0.3,         // 半透光(光能透过去)
    thickness: 0.1,            // 模拟叶子厚度
    ior: 1.4,                  // 折射率(植物差不多)
    sheen: 0.4,                // 边缘绒毛
    sheenColor: new THREE.Color(0xfff0c0),
    sheenRoughness: 0.5,
    iridescence: 0.08,         // 微微虹彩
    iridescenceIOR: 1.3,
    attenuationDistance: 0.5,
    attenuationColor: new THREE.Color(0x88cc88)  // 透光时偏绿
  });
}

// ============== ③ 弯曲叶子几何 ==============

/**
 * 自定义弯曲叶子(4x3 = 12 顶点,中间 Z 凸起)
 * 不再是平片,而是有体积的弧形叶子
 *
 * 顶点布局:
 *   4 行(从基部到尖) × 3 列(左缘/中轴/右缘)
 *   中间列的 z > 0(凸起),两侧列 z = 0
 *   越靠近叶尖,叶缘越窄(收尖)
 */
function makeCurvedLeafGeometry(size, width, bend) {
  // 4 行:基部 / 下半 / 上半 / 尖
  // 3 列:左 / 中 / 右
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];

  // 行参数
  const rows = [
    { y: -size * 0.45, w: width * 0.15, t: 0.0 },   // 基部
    { y: -size * 0.15, w: width * 0.85, t: 0.25 },
    { y:  size * 0.15, w: width * 0.95, t: 0.55 },
    { y:  size * 0.45, w: width * 0.0,  t: 0.85 }    // 尖
  ];

  for (const row of rows) {
    for (let col = 0; col < 3; col++) {
      const x = (col - 1) * row.w;  // -w, 0, +w
      const z = col === 1 ? bend : 0;  // 中间凸起
      positions.push(x, row.y, z);
      // UV:列→u(0/0.5/1),行→v(0/0.33/0.66/1)
      uvs.push(col * 0.5, row.t);
      // 颜色先占位,后面用 vertexColor 覆盖
      colors.push(1, 1, 1);
      // 简化的法线(都指 +Z 方向,因为叶子正面朝 +Z)
      normals.push(0, 0, 1);
    }
  }

  // 三角形索引(4 行 → 3 个 quad 区域)
  // quad (i, j) 包含顶点:row[j]*3+i ... row[j+1]*3+i+1
  const indices = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const a = row * 3 + col;       // 左上
      const b = row * 3 + col + 1;   // 中上
      const c = (row + 1) * 3 + col + 1; // 中下
      const d = (row + 1) * 3 + col; // 左下
      indices.push(a, d, b, b, d, c);
    }
  }
  // 顶部尖三角(只有 1 个中顶点,不是 quad)
  // 行 3(尖)只有 1 个顶点(中),要把它跟前一行 3 个顶点组成 2 个三角
  // 但我们 leaves 总是尖端朝外,中间是最高点
  // 这里因为 row 3 的 col=0 和 col=2 都在 (0, size*0.45, 0) 位置(同一点)
  // 实际只剩 col=1 一个点
  // 简化:不做尖端三角,稍微省略(叶片尖端视觉上还是完整)

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 给叶子顶点上色:主色 vs 暗色,按距中轴远近过渡
 * 模拟叶片的"叶肉 vs 叶脉附近偏深"效果
 */
function paintLeafVertexColors(geo, t) {
  const mainCol = leafColorAt(t);
  const darkCol = leafDarkAt(t);
  const count = geo.attributes.position.count;
  const pos = geo.attributes.position;
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // 距中轴(x=0)远近 → 暗色 vs 主色
    const edgeT = Math.min(1, Math.abs(x) / 0.15);
    const col = darkCol.clone().lerp(mainCol, 1 - edgeT);
    // 顶端稍亮,基部稍暗
    const tY = (y + 0.1) / 0.6;  // 归一化 y 到 0-1
    col.multiplyScalar(0.7 + tY * 0.3);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// ============== 单片叶子 ==============

function makeLeaf(curve, t, leafMap, sizeScale) {
  const pos = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t);

  // 叶子尺寸:中段最大,末梢稍小
  const sizeBase = 0.22;
  const widthBase = 0.10;
  const sizeMidBoost = 1.0 + 0.5 * Math.sin(t * Math.PI);
  const size = sizeBase * sizeMidBoost * sizeScale * (0.7 + Math.random() * 0.6);
  const width = widthBase * (0.7 + Math.random() * 0.6);
  const bend = 0.015 + size * 0.1;  // 弯曲度

  // 弯曲几何(顶点数 12)
  const geo = makeCurvedLeafGeometry(size, width, bend);
  paintLeafVertexColors(geo, t);

  // 共享材质(每帧 0 cost 复用)
  // 但 transmission 状态各叶子一致,所以用同一份
  // 我们用 mesh 自己的 material,各自独立
  const mat = makeLeafMaterial(leafMap);
  const leaf = new THREE.Mesh(geo, mat);
  leaf.position.copy(pos);

  // 初始旋转(后面 update 会覆盖)
  const baseAngle = Math.atan2(tangent.x, tangent.y) + Math.PI / 2;
  const tilt = (Math.random() - 0.5) * 0.7;
  const yawSpin = Math.random() * Math.PI * 2;
  leaf.rotation.z = baseAngle + tilt;
  leaf.rotation.y = yawSpin;

  // 保存 userData(供 update 用)
  leaf.userData = {
    curveT: t,
    baseAngle,
    tilt,
    yawSpin,
    basePos: pos.clone(),
    phase: Math.random() * Math.PI * 2
  };
  return leaf;
}

// ============== 渐细管(保持不变) ==============

function makeTaperedTube(curve, segments, startRadius, endRadius) {
  const positions = [];
  const indices = [];
  const radial = 6;
  const frames = curve.computeFrenetFrames(segments, false);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const r = startRadius * (1 - t) + endRadius * t;
    const p = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    for (let j = 0; j < radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      positions.push(
        p.x + r * (N.x * cos + B.x * sin),
        p.y + r * (N.y * cos + B.y * sin),
        p.z + r * (N.z * cos + B.z * sin)
      );
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + (j + 1) % radial;
      const c = (i + 1) * radial + (j + 1) % radial;
      const d = (i + 1) * radial + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

// ============== 主类 ==============

export class HangingVine {
  /**
   * @param {Object} opts
   * @param {number} opts.length
   * @param {THREE.Vector3} opts.origin
   */
  constructor({ length = 3, origin = new THREE.Vector3(0, 3, 0) } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'HangingVine';
    this._t = 0;
    this._vines = [];

    // 共享的叶子贴图(整个 group 用一份)
    this.leafMap = makeLeafTexture();

    // 3 条主藤
    const vineCount = 3;
    for (let i = 0; i < vineCount; i++) {
      this._vines.push(this._buildVine(origin, length, i, vineCount));
    }

    // 挂大量叶子
    for (const vine of this._vines) {
      const leafCount = 12 + Math.floor(Math.random() * 4);
      for (let j = 0; j < leafCount; j++) {
        const t = 0.08 + (j / leafCount) * 0.82;
        const leaf = makeLeaf(vine.curve, t, this.leafMap, 1.0);
        vine.leaves.push(leaf);
        vine.mesh.add(leaf);
      }
    }

    // 顶端密集小叶
    this._addTopCluster(origin);

    for (const vine of this._vines) {
      this.group.add(vine.mesh);
    }
  }

  _buildVine(origin, length, index, total) {
    const offset = (index - (total - 1) / 2) * 0.4;
    const pts = [
      origin.clone(),
      origin.clone().add(new THREE.Vector3(offset * 0.4, -length * 0.15, 0.08 + Math.random() * 0.1)),
      origin.clone().add(new THREE.Vector3(offset * 0.8, -length * 0.32, -0.05)),
      origin.clone().add(new THREE.Vector3(offset * 1.1, -length * 0.55, 0.12)),
      origin.clone().add(new THREE.Vector3(offset * 0.95, -length * 0.78, -0.04)),
      origin.clone().add(new THREE.Vector3(offset * 0.7, -length, 0.05))
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const tubeGeo = makeTaperedTube(curve, 32, 0.022, 0.008);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x1a3838,
      roughness: 0.9,
      flatShading: true
    });
    const mesh = new THREE.Mesh(tubeGeo, tubeMat);
    return { curve, mesh, leaves: [] };
  }

  _addTopCluster(origin) {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.6;
      const r = 0.1 + Math.random() * 0.18;
      const x = origin.x + Math.cos(theta) * r * Math.sin(phi);
      const y = origin.y - Math.abs(Math.cos(phi)) * r * 0.5 + (Math.random() - 0.5) * 0.1;
      const z = origin.z + Math.sin(theta) * r * Math.sin(phi);
      const leaf = makeLeaf(this._vines[0].curve, 0, this.leafMap, 0.6);
      leaf.position.set(x, y, z);
      leaf.scale.setScalar(0.7);
      this._vines[0].mesh.add(leaf);
    }
  }

  // ============== ④ 风吹物理(每帧) ==============

  /**
   * 沿藤的"波"位移:
   *   - 每片叶子有相位(沿 t 移动)
   *   - 风从"顶端"往"末梢"传(像风吹过一根绳子)
   *   - 末梢摆大(杠杆原理)
   *   - 垂直方向(y)也微微浮动
   */
  _updateWind(t) {
    for (const vine of this._vines) {
      for (const leaf of vine.leaves) {
        const d = leaf.userData;
        const curveT = d.curveT;

        // 基础位置(从曲线取)
        const basePos = vine.curve.getPointAt(curveT);
        const tangent = vine.curve.getTangentAt(curveT);

        // 垂直于藤的"水平"方向
        const perp = new THREE.Vector3(-tangent.z, 0, tangent.x);
        if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0);
        perp.normalize();

        // 风波:沿 t 移动 + 时间
        // 末梢摆幅 = 0.04 + t * 0.15(原值)
        // 加上风从顶端传下来:windTime = t - globalTime
        const waveSpeed = 0.8;
        const windWave = (curveT * 3 - t * waveSpeed + d.phase) * Math.PI;
        const windAmp = 0.05 + curveT * 0.18;
        const windOffset = Math.sin(windWave) * windAmp;

        // 垂直浮动
        const yBob = Math.sin(windWave * 0.6 + d.phase * 0.5) * 0.015;

        // 应用位置
        leaf.position.set(
          basePos.x + perp.x * windOffset,
          basePos.y + yBob,
          basePos.z + perp.z * windOffset
        );

        // 叶子朝向也跟着风吹摆
        const newAngle = Math.atan2(tangent.x + perp.x * windOffset * 0.5, tangent.y) + Math.PI / 2;
        leaf.rotation.z = newAngle + d.tilt;

        // Y 轴随机缓慢转
        leaf.rotation.y = d.yawSpin + Math.sin(t * 0.3 + d.phase) * 0.12;
      }
    }
  }

  /** 主循环 */
  update(dt) {
    this._t += dt;
    this._updateWind(this._t);
  }
}
