// ============================================================
// scene/Cave.js — 洞府几何
// 全部用 three.js 内置基础几何拼装,无外部模型
//
// 组成:
//   1. 地面     : PlaneGeometry,顶点 y 扰动造起伏
//   2. 洞壁     : 14 个 BoxGeometry 围成环
//   3. 洞顶     : 倒置 ConeGeometry
//   4. 散落石块 : 8 个小 BoxGeometry
//   5. 钟乳石   : 顶部垂下的圆锥(ConeGeometry,翻转)
//   6. 石笋     : 地面长出的圆锥
//   7. 发光水晶 : 嵌在洞壁/地面的小晶簇(emissive → bloom)
// ============================================================

import * as THREE from 'three';

function jitter(x, z, amp = 0.3) {
  return Math.sin(x * 0.3) * 0.5 + Math.cos(z * 0.3) * 0.5 * amp;
}

export class Cave {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Cave';

    this._lights = [];   // 收集发光水晶里的点光,稍后微调
    this._buildFloor();
    this._buildWalls();
    this._buildCeiling();
    this._buildScatterRocks();
    this._buildStalactites();   // 顶部钟乳石
    this._buildStalagmites();   // 地面石笋
    this._buildGlowingCrystals(); // 发光水晶
  }

  /** 地面:起伏的低多边形地形 */
  _buildFloor() {
    const geo = new THREE.PlaneGeometry(40, 40, 24, 24);
    geo.rotateX(-Math.PI / 2);  // 平躺

    // 扰动每个顶点的 y
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // 中心区域留平(放丹炉),边缘抬高
      const distFromCenter = Math.sqrt(x * x + z * z);
      const edge = Math.max(0, (distFromCenter - 3) * 0.15);
      pos.setY(i, jitter(x, z, 0.4) + edge);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x7a604a,
      roughness: 0.95,
      flatShading: true   // 低多边形质感的关键
    });
    const floor = new THREE.Mesh(geo, mat);
    floor.receiveShadow = false;  // 本项目暂不开阴影
    this.group.add(floor);
  }

  /** 洞壁:14 个岩柱围成环,每个做扰动 */
  _buildWalls() {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x8a7460,
      roughness: 0.9,
      flatShading: true
    });
    const count = 14;
    const radius = 7.5;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      // 每根柱子:2x4x2 的盒子,做顶点扰动
      const geo = new THREE.BoxGeometry(2, 4, 2, 2, 3, 2);
      const pos = geo.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const x = pos.getX(j);
        const y = pos.getY(j);
        const z = pos.getZ(j);
        pos.setX(j, x + jitter(y, z, 0.3));
        pos.setZ(j, z + jitter(y, x, 0.3));
      }
      geo.computeVertexNormals();

      const pillar = new THREE.Mesh(geo, wallMat);
      pillar.position.set(
        Math.cos(angle) * radius,
        2 + Math.random() * 0.4,
        Math.sin(angle) * radius
      );
      pillar.rotation.y = Math.random() * Math.PI;
      pillar.scale.x = 0.9 + Math.random() * 0.5;
      pillar.scale.z = 0.9 + Math.random() * 0.5;
      this.group.add(pillar);
    }

    // 外层一圈更矮的岩柱(增加层次)
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2 + Math.random() * 0.2;
      const r = 9 + Math.random() * 1.5;
      const h = 1.5 + Math.random() * 2;
      const geo = new THREE.BoxGeometry(1.5, h, 1.5);
      const m = new THREE.Mesh(geo, wallMat);
      m.position.set(Math.cos(angle) * r, h / 2, Math.sin(angle) * r);
      m.rotation.y = Math.random() * Math.PI;
      this.group.add(m);
    }
  }

  /** 洞顶:高高挂起的圆顶,藏在雾里不挡视线 */
  _buildCeiling() {
    const geo = new THREE.ConeGeometry(6, 4, 8, 3);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a2018,   // 很深,跟雾色融在一起
      roughness: 1.0,
      flatShading: true,
      side: THREE.BackSide
    });
    const ceiling = new THREE.Mesh(geo, mat);
    ceiling.position.y = 14;  // 抬高,默认视角看不到
    this.group.add(ceiling);
  }

  /** 散落的碎石(装饰) */
  _buildScatterRocks() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6e5a48,
      roughness: 0.95,
      flatShading: true
    });
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 2.5 + Math.random() * 3.5;
      const s = 0.2 + Math.random() * 0.3;
      const geo = new THREE.BoxGeometry(s, s, s);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(Math.cos(angle) * r, s / 2, Math.sin(angle) * r);
      m.rotation.set(Math.random(), Math.random(), Math.random());
      this.group.add(m);
    }
  }

  /** 钟乳石(顶部垂下) */
  _buildStalactites() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8a7460, roughness: 0.9, flatShading: true
    });
    // 中心区域不放(避丹炉和玩家),从半径 2.5 开始
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 2.5 + Math.random() * 4.5;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      // 长度变化 0.3 ~ 1.2 米
      const len = 0.3 + Math.random() * 0.9;
      // 锥(尖端朝下)
      const geo = new THREE.ConeGeometry(0.12 + Math.random() * 0.1, len, 6);
      // 锥默认尖端朝 +y,我们让它朝 -y
      geo.rotateX(Math.PI);
      const m = new THREE.Mesh(geo, mat);
      // 顶部 y 在 6(洞顶),从那垂下 len 米
      m.position.set(x, 6 - len / 2, z);
      m.rotation.y = Math.random() * Math.PI;
      this.group.add(m);
    }
  }

  /** 石笋(地面长出) */
  _buildStalagmites() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x7a604a, roughness: 0.9, flatShading: true
    });
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 2.5 + Math.random() * 4.5;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const len = 0.4 + Math.random() * 0.8;
      const geo = new THREE.ConeGeometry(0.15 + Math.random() * 0.1, len, 6);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, len / 2, z);
      m.rotation.y = Math.random() * Math.PI;
      this.group.add(m);
    }
  }

  /** 发光水晶簇(嵌在洞壁/地面,emissive → bloom 强光) */
  _buildGlowingCrystals() {
    // 3 种水晶颜色,分布在洞壁和地面
    const colors = [
      { hex: 0x66ccff, light: 0x66aaff, name: '冰蓝' },
      { hex: 0xff66cc, light: 0xff88aa, name: '紫红' },
      { hex: 0x88ff66, light: 0xaaff88, name: '碧绿' }
    ];

    // 嵌在洞壁的 4-5 个簇
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
      const r = 6.5 + Math.random() * 0.8;   // 嵌在洞壁内圈
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = 1.0 + Math.random() * 3.0;
      const c = colors[i % colors.length];
      this._buildCrystalCluster(x, y, z, angle, c, true);
    }

    // 地面上的 2 个小簇
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 3.5 + Math.random() * 2.0;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const c = colors[(i + 1) % colors.length];
      this._buildCrystalCluster(x, 0.05, z, angle, c, false);
    }
  }

  /** 一个水晶簇:几根尖锥 + 内嵌点光 */
  _buildCrystalCluster(x, y, z, facingAngle, c, onWall) {
    const group = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({
      color: c.hex,
      emissive: c.hex,
      emissiveIntensity: 1.2,   // 高 → bloom 让它发光
      roughness: 0.2,
      metalness: 0.3,
      flatShading: true
    });

    // 3-5 根尖锥
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const len = 0.2 + Math.random() * 0.4;
      const radius = 0.05 + Math.random() * 0.06;
      const geo = new THREE.ConeGeometry(radius, len, 5);
      const m = new THREE.Mesh(geo, mat);
      // 随机偏移
      m.position.set(
        (Math.random() - 0.5) * 0.15,
        onWall ? len / 2 : len / 2,
        (Math.random() - 0.5) * 0.15
      );
      m.rotation.set(
        (Math.random() - 0.5) * 0.3,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.3
      );
      group.add(m);
    }

    group.position.set(x, y, z);
    if (onWall) {
      // 让水晶朝向洞内
      group.rotation.y = -facingAngle + Math.PI;
    }
    this.group.add(group);

    // 内嵌小点光(微调位置到水晶中心)
    const light = new THREE.PointLight(c.light, 0.5, 4, 2);
    light.position.copy(group.position);
    this.group.add(light);
    this._lights.push({ light, baseIntensity: 0.5, phase: Math.random() * 10 });
  }

  /** 主循环:水晶微闪 */
  update(dt) {
    const t = (this._t = (this._t || 0) + dt);
    for (const item of this._lights) {
      const flicker = Math.sin(t * 3 + item.phase) * 0.15;
      item.light.intensity = item.baseIntensity + flicker;
    }
  }
}
