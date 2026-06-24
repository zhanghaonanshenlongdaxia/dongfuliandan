// ============================================================
// scene/SnowAccumulation.js — 雪累积系统
//
// 雪越下越厚(基于实时累加,不是真物理模拟):
//   ① 平台雪层:高度从 0 → 0.6(逐步加厚,看起来"积雪")
//   ② 门顶雪:横梁上的雪从薄 → 厚
//   ③ 雪墙(堵路的):从 2.2m 高涨到 3.8m
//   ④ 随机雪堆:每跨过 0.05 level 就在平台撒一个小雪堆
//
// setLevel(0~1) 可以从外部直接设置(比如读档/调试)
// 默认每真实秒 += 0.005,跑满约 3.3 分钟
// ============================================================

import * as THREE from 'three';

const SNOW_MAT = () => new THREE.MeshStandardMaterial({
  color: 0xeef0ff,
  roughness: 0.6,
  metalness: 0.05,
  flatShading: true
});

export class SnowAccumulation {
  /**
   * @param {Object} opts
   * @param {THREE.Scene} opts.scene
   * @param {THREE.Mesh}  opts.platform    院落地基(雪层长在这上面)
   * @param {THREE.Mesh}  opts.snowWall    堵路的雪墙(会被加高)
   * @param {THREE.Group} opts.caveDoorGroup  山门 group(雪加在横梁上)
   * @param {Array<{x,z}>} opts.pillarPositions 院子上矮柱的 (x,z)
   * @param {number} [opts.speed=0.005] 累加速度
   */
  constructor({ scene, platform, snowWall, caveDoorGroup, pillarPositions, speed = 0.005 }) {
    this.scene = scene;
    this.platform = platform;
    this.snowWall = snowWall;
    this.caveDoorGroup = caveDoorGroup;
    this.pillarPositions = pillarPositions || [];

    this.level = 0;          // 0-1
    this.maxLevel = 1.0;
    this.speed = speed;

    this._piles = [];        // 动态生成的雪堆
    this._maxPiles = 30;     // 平台最多撒 30 个
    this._lastSpawnLevel = 0;

    this._buildPlatformSnow();
    this._buildDoorCap();
    this._buildPillarCaps();
    this._growWall(0);
  }

  // ===== 构建雪基(圆形,匹配圆形平台) =====
  _buildPlatformSnow() {
    const radius = 7;  // 和 _buildCourtyard 的 platformRadius 一致
    const geo = new THREE.CylinderGeometry(radius - 0.1, radius - 0.1, 0.1, 48);
    this.snowBase = new THREE.Mesh(geo, SNOW_MAT());
    this.snowBase.position.set(12, 0.18, 0);
    this.scene.add(this.snowBase);
  }

  _buildDoorCap() {
    if (!this.caveDoorGroup) return;
    // 门顶横梁上的雪(增厚,scale.y 跟着 level 走)
    this.doorCap = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.3, 1.2),
      SNOW_MAT()
    );
    this.doorCap.position.set(0, 4.85, 7.4);
    this.caveDoorGroup.add(this.doorCap);
  }

  _buildPillarCaps() {
    for (const p of this.pillarPositions) {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
        SNOW_MAT()
      );
      cap.position.set(p.x, 1.1, p.z);
      this.scene.add(cap);
    }
  }

  // ===== 雪墙增高(从 2.2m 到 3.8m) =====
  _growWall(level) {
    if (!this.snowWall) return;
    const baseH = 2.2;
    const newH = baseH + level * 1.6;
    this.snowWall.scale.y = newH / baseH;
    // 雪墙是 BoxGeometry 中心在 (0,0,0),position.y 决定底面位置
    // 让底面保持 y=0(不陷进地),所以位置往上抬 scale.y 倍
    this.snowWall.position.y = newH / 2;
  }

  // ===== 外部控制 =====
  setLevel(l) {
    this.level = Math.max(0, Math.min(this.maxLevel, l));
    this._updateVisuals();
    // 补撒 pile
    const target = Math.floor(this.level * 20) * 0.05;
    while (this._lastSpawnLevel < target && this._piles.length < this._maxPiles) {
      this._lastSpawnLevel += 0.05;
      this._spawnPile();
    }
  }

  reset() {
    for (const p of this._piles) this.scene.remove(p);
    this._piles = [];
    this._lastSpawnLevel = 0;
    this.level = 0;
    this._updateVisuals();
  }

  setSpeed(s) { this.speed = s; }
  getLevel() { return this.level; }

  // ===== 每帧调用 =====
  update(dt) {
    if (this.level >= this.maxLevel) return;
    this.level = Math.min(this.maxLevel, this.level + this.speed * dt);
    this._updateVisuals();
    // 每跨过 0.05 level 撒一个雪堆
    const target = Math.floor(this.level * 20) * 0.05;
    while (this._lastSpawnLevel < target && this._piles.length < this._maxPiles) {
      this._lastSpawnLevel += 0.05;
      this._spawnPile();
    }
  }

  _updateVisuals() {
    // 平台雪层:从 0.1 高涨到 0.6
    const baseH = 0.1;
    const h = baseH + this.level * 0.5;
    this.snowBase.scale.y = h / baseH;
    this.snowBase.position.y = 0.18 + (h - baseH) / 2;
    // 门顶雪增厚
    if (this.doorCap) this.doorCap.scale.y = 1 + this.level * 1.5;
    // 雪墙
    this._growWall(this.level);
  }

  _spawnPile() {
    // 平台范围:x [7.5, 16.5], z [-5.5, 5.5]
    const x = 7.8 + Math.random() * 8.4;
    const z = -5.0 + Math.random() * 10.0;
    // 放在当前雪层顶部
    const baseY = 0.18 + 0.1 + this.level * 0.5;
    const size = 0.2 + Math.random() * 0.4;
    const pile = new THREE.Mesh(
      new THREE.SphereGeometry(size, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
      SNOW_MAT()
    );
    pile.position.set(x, baseY + size * 0.25, z);
    pile.scale.y = 0.4 + Math.random() * 0.3;
    this.scene.add(pile);
    this._piles.push(pile);
  }
}
