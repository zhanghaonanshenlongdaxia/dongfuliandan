// ============================================================
// scene/Fire.js — 炉内火焰
// 用 4 个 ConeGeometry 叠加,每帧抖动 + 缩放制造燃烧感
// 用 MeshBasicMaterial 而非 Standard — 火焰本身不参与光照计算
// ============================================================

import * as THREE from 'three';

export class Fire {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Fire';
    this.group.position.y = 0.95;  // 炉口高度

    // 火焰强度系数(0..1),由外部在 REFINING 时调高
    this.intensity = 0.3;
    this._targetIntensity = 0.3;
    this._t = 0;

    this._build();
  }

  _build() {
    // 内焰(最亮、偏黄白)
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 0.95
    });
    this.innerCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.7, 6),
      innerMat
    );
    this.innerCone.position.y = 0.35;
    this.group.add(this.innerCone);

    // 中焰(主色)
    const midMat = new THREE.MeshBasicMaterial({
      color: 0xff8822,
      transparent: true,
      opacity: 0.85
    });
    this.midCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.9, 6),
      midMat
    );
    this.midCone.position.y = 0.3;
    this.group.add(this.midCone);

    // 外焰(红、透明)
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.55
    });
    this.outerCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 1.1, 6),
      outerMat
    );
    this.outerCone.position.y = 0.2;
    this.group.add(this.outerCone);

    // 最外层(暗红、大)
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xaa2200,
      transparent: true,
      opacity: 0.3
    });
    this.haloCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.6, 1.3, 6),
      haloMat
    );
    this.haloCone.position.y = 0.15;
    this.group.add(this.haloCone);
  }

  /** 0..1,REFINING 时调高,IDLE 时调低 */
  setIntensity(v) {
    this._targetIntensity = Math.max(0.1, Math.min(1.5, v));
  }

  update(dt) {
    this._t += dt;
    // intensity 平滑趋近目标
    const k = 1 - Math.exp(-dt * 3);
    this.intensity += (this._targetIntensity - this.intensity) * k;

    // 整体缩放(由强度驱动)
    const baseScale = 0.4 + this.intensity * 0.6;
    const flicker1 = 1 + Math.sin(this._t * 10) * 0.15;
    const flicker2 = 1 + Math.sin(this._t * 14 + 1) * 0.12;

    this.innerCone.scale.set(
      baseScale * flicker1,
      baseScale * (0.8 + Math.sin(this._t * 8) * 0.2),
      baseScale * flicker1
    );
    this.midCone.scale.set(
      baseScale * flicker2,
      baseScale * (0.7 + Math.sin(this._t * 7 + 2) * 0.3),
      baseScale * flicker2
    );
    this.outerCone.scale.set(
      baseScale * 0.9,
      baseScale * (0.6 + Math.sin(this._t * 6 + 1) * 0.25),
      baseScale * 0.9
    );
    this.haloCone.scale.set(
      baseScale * 0.8,
      baseScale * (0.5 + Math.sin(this._t * 5 + 3) * 0.2),
      baseScale * 0.8
    );

    // 颜色微微脉动(REFINING 时更剧烈)
    const heat = Math.min(1, this.intensity);
    const t = this._t * (4 + heat * 8);
    const r = 1.0;
    const g = 0.4 + 0.4 * Math.sin(t) * (0.5 + heat * 0.5);
    const b = 0.1;
    this.midCone.material.color.setRGB(r, Math.max(0, g), b);
  }
}
