// ============================================================
// scene/Distant.js — 远景(山轮廓 + 大雁群)
//
// 两层远山(用 noise 生成 silhouette 环,空气透视:近暗远淡)
// 几群大雁(V 字编队,绕场景慢慢飞)
//
// 完全程序化,无外部资源
// ============================================================

import * as THREE from 'three';

// 简易 1D 噪声(基于 sin 叠加,够用) — 用 pow 做"圆滑"
function ridgeNoise(x, seed, octaves = 4) {
  let v = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    v += Math.sin(x * freq * 0.15 + seed * 7.3 + i * 11.7) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return v / max;  // -1 ~ 1
}

/**
 * 生成一层山的 silhouette 几何
 * @param {number} radius 离场景中心的距离
 * @param {number} segments 山的数量
 * @param {number} peakHeight 最高峰高度(降低一些,避免看起来像尖三角)
 * @param {number} seed 随机种子
 * @param {THREE.Color} color 山色
 */
function buildMountainRing(radius, segments, peakHeight, seed, color) {
  const verts = [];
  const indices = [];
  const colors = [];  // 顶点色(底部透明渐变,让山"扎进雾里")

  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    // 用 noise 算山脊高度 + 加一点 baseOffset 让山底"凸起"一些(像丘陵)
    const noiseVal = ridgeNoise(a, seed) * 0.5 + 0.5;
    const baseH = 1.5;  // 山底基础高度(避免完全贴着地)
    const h = baseH + noiseVal * peakHeight;
    // 底点(y=0)和顶点(y=h)之间插一个中间点
    // 这样山的轮廓是"3 段",不是尖三角
    const midY = h * 0.4;
    const midX = x * 1.02;  // 稍微外扩一点
    const midZ = z * 1.02;
    // 底
    verts.push(x, 0, z);
    // 中
    verts.push(midX, midY, midZ);
    // 顶
    verts.push(x, h, z);

    // 顶点色 alpha 渐变:底=0(透明), 顶=1(不透明)
    // 用 vertex color 配合 material.vertexColors 和 transparent
    colors.push(0, 0, 0, 0);              // 底点:完全透明
    colors.push(0.5, 0.5, 0.5, 0.5);      // 中点:半透明
    colors.push(1, 1, 1, 1);              // 顶点:不透明
  }
  // 索引:每个段画两个三角形
  for (let i = 0; i < segments; i++) {
    const b0 = i * 3, m0 = i * 3 + 1, t0 = i * 3 + 2;
    const b1 = (i+1) * 3, m1 = (i+1) * 3 + 1, t1 = (i+1) * 3 + 2;
    // 下三角(底-中-中1)
    indices.push(b0, m0, m1);
    indices.push(b0, m1, b1);
    // 上三角(中-顶-顶1)
    indices.push(m0, t0, t1);
    indices.push(m0, t1, m1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    side: THREE.DoubleSide,
    fog: true,
    depthWrite: false   // 半透明物体不写深度,避免排序问题
  });
  return new THREE.Mesh(geo, mat);
}

/**
 * 大雁:V 字编队
 * 简单的三角形 mesh(用扁平 plane),慢飞
 */
function buildGoose() {
  // 用 BufferGeometry 画一个 V 字(两只翅膀)
  const geo = new THREE.BufferGeometry();
  const v = [
    -0.4, 0,  0,    0,  0, -0.2,    0, 0, -0.2,    0, 0,  0.2,    0.4, 0,  0
  ];
  // 上面:简化为 2 个三角形
  const positions = new Float32Array([
    -0.4,  0.0,  0.0,    // 左翼尖
     0.0,  0.0, -0.15,    // 尾
     0.0,  0.0,  0.0,    // 中(共用)
     0.0,  0.0,  0.15,    // 尾另一侧
     0.4,  0.0,  0.0,    // 右翼尖
  ]);
  const indices = [0, 1, 2,  2, 3, 4];
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    color: 0x1a1a1a,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85
  });
  return new THREE.Mesh(geo, mat);
}

function buildGooseFlock(count = 7, spacing = 0.6) {
  // 领头 + 两排 V 字
  const group = new THREE.Group();
  const goose = buildGoose();

  // 头雁
  const leader = goose.clone();
  group.add(leader);

  // V 字左右两列
  for (let i = 1; i < count; i++) {
    const side = (i % 2 === 0) ? 1 : -1;
    const row = Math.ceil(i / 2);
    const g = goose.clone();
    g.position.set(
      -side * row * spacing,
      -row * spacing * 0.4,
      0
    );
    group.add(g);
  }
  return group;
}

export class Distant {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Distant';
    this._t = 0;

    // 两层远山(近暗远淡,模拟空气透视)
    // 峰高降低(从 12/18 降到 7/11) + 加 baseH 让山底凸起
    this.mountainNear = buildMountainRing(80, 48, 7, 1.0, new THREE.Color(0x2a3540));
    this.mountainFar  = buildMountainRing(140, 64, 11, 2.5, new THREE.Color(0x4a5a70));
    this.group.add(this.mountainNear);
    this.group.add(this.mountainFar);

    // 大雁群(2 群,飞在不同高度)
    this.geese1 = buildGooseFlock(9, 0.5);
    this.geese1.position.set(40, 18, 30);
    this.group.add(this.geese1);

    this.geese2 = buildGooseFlock(7, 0.4);
    this.geese2.position.set(-60, 22, 50);
    this.geese2.scale.setScalar(0.7);  // 远一点,小一点
    this.group.add(this.geese2);

    // 保存大雁初始位置(用于循环飞行)
    this._goose1Base = this.geese1.position.clone();
    this._goose2Base = this.geese2.position.clone();
  }

  tick(dt) {
    this._t += dt;

    // 大雁 1:绕场景上方转大圈(逆时针)
    const a1 = this._t * 0.06;
    const r1 = 50;
    this.geese1.position.set(
      Math.cos(a1) * r1,
      this._goose1Base.y + Math.sin(this._t * 0.4) * 0.5,
      Math.sin(a1) * r1
    );
    // 头雁朝运动方向
    this.geese1.rotation.y = -a1 + Math.PI / 2;

    // 大雁 2:另一圈(顺时针),更慢
    const a2 = -this._t * 0.04 + Math.PI;
    const r2 = 70;
    this.geese2.position.set(
      Math.cos(a2) * r2,
      this._goose2Base.y + Math.sin(this._t * 0.3 + 1) * 0.4,
      Math.sin(a2) * r2
    );
    this.geese2.rotation.y = -a2 - Math.PI / 2;

    // 翅膀拍动(简化为缩放 Y)
    const flap = Math.sin(this._t * 6) * 0.15 + 1.0;
    this.geese1.scale.set(1, flap, 1);
    this.geese2.scale.setScalar(0.7 * flap);

    // 远山不动(雾会让它看起来"远")
  }
}
