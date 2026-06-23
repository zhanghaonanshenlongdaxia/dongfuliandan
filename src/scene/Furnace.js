// ============================================================
// scene/Furnace.js — 丹炉
// 部件:
//   - 炉身(略呈倒梯形)
//   - 3 只炉足
//   - 4 圈纹饰(腰部装饰)
//   - 炉口火圈(emissive 发光)
//   - 炉盖(可掀开/落下,有简易 tween 动画)
// ============================================================

import * as THREE from 'three';

export class Furnace {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Furnace';
    this.group.position.set(0, 0, 0);

    // 炉盖 Y 位置(用于开盖动画)
    this.lidClosedY = 1.0;    // 关盖时的 Y
    this.lidOpenY = 1.6;      // 开盖时的 Y
    this.lidIdleY = 1.35;     // IDLE 半开,露出火光
    this.lidTargetY = this.lidIdleY;
    this.lidCurrentY = this.lidIdleY;

    // 火圈引用(用于状态化时改发光)
    this.fireRing = null;

    this._build();
  }

  _build() {
    // --- 炉身 ---
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x4a2a1c,
      roughness: 0.85,
      flatShading: true
    });
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.4, 2.0, 8),
      bodyMat
    );
    body.position.y = 0.0;   // 中心在 y=0,底部在 y=-1
    this.group.add(body);

    // --- 4 圈纹饰(腰部装饰) ---
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x8a6a3a,
      roughness: 0.6,
      metalness: 0.4
    });
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.22, 0.05, 4, 16),
        ringMat
      );
      ring.position.y = -0.6 + i * 0.4;
      ring.rotation.x = Math.PI / 2;
      this.group.add(ring);
    }

    // --- 炉口火圈(发光) ---
    this.fireRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.12, 6, 16),
      new THREE.MeshStandardMaterial({
        color: 0xff6622,
        emissive: 0xff4400,
        emissiveIntensity: 0.6,
        roughness: 0.4
      })
    );
    this.fireRing.position.y = 1.0;
    this.fireRing.rotation.x = Math.PI / 2;
    this.group.add(this.fireRing);

    // --- 3 只炉足 ---
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.22, 0.5, 6),
        bodyMat
      );
      leg.position.set(
        Math.cos(angle) * 1.1,
        -1.25,
        Math.sin(angle) * 1.1
      );
      this.group.add(leg);
    }

    // --- 炉盖 ---
    this.lid = new THREE.Group();
    this.lid.name = 'FurnaceLid';

    const lidHandle = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      ringMat
    );
    lidHandle.position.y = 0.25;
    this.lid.add(lidHandle);

    const lidBody = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.25, 0.25, 8),
      new THREE.MeshStandardMaterial({
        color: 0x6a4a2a,
        roughness: 0.7,
        metalness: 0.3,
        flatShading: true
      })
    );
    this.lid.add(lidBody);

    this.lid.position.y = this.lidClosedY;
    this.group.add(this.lid);

    // --- 出丹口(隐藏的小球,SUCCESS 时弹出) ---
    this.pill = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.8,
        roughness: 0.3,
        metalness: 0.2
      })
    );
    this.pill.position.y = 0.8;
    this.pill.visible = false;
    this.group.add(this.pill);
  }

  // ---------- 外部接口 ----------

  /** 掀开炉盖(进入 ADDING / SUCCESS 时) */
  openLid() {
    this.lidTargetY = this.lidOpenY;
  }

  /** 盖上炉盖(关盖动作,目前不直接用) */
  closeLid() {
    this.lidTargetY = this.lidClosedY;
  }

  /** IDLE 半开,露出火光(让画面始终有视觉焦点) */
  idleLid() {
    this.lidTargetY = this.lidIdleY;
  }

  /** 设置火圈发光强度 0..1 */
  setGlow(intensity) {
    if (this.fireRing) {
      this.fireRing.material.emissiveIntensity = 0.4 + intensity * 1.2;
    }
  }

  /** 显示一颗丹药(传入颜色),弹起动画由 update 推进 */
  showPill(color) {
    this.pill.material.color.setHex(color);
    this.pill.material.emissive.setHex(color);
    this.pill.position.y = 0.8;
    this.pill.scale.setScalar(0.01);
    this.pill.visible = true;
    this._pillAnimT = 0;  // 动画计时器
  }

  hidePill() {
    this.pill.visible = false;
  }

  /** 盖子落下砸下(FAIL 时) */
  slamLid() {
    this.lidTargetY = this.lidClosedY;
    this.lidCurrentY = this.lidOpenY + 0.2;  // 略高于开盖位置再落下
  }

  // ---------- 每帧更新 ----------

  update(dt) {
    // 炉盖 Y 位置 lerp 趋向目标
    const k = 1 - Math.exp(-dt * 6);
    this.lidCurrentY += (this.lidTargetY - this.lidCurrentY) * k;
    this.lid.position.y = this.lidCurrentY;

    // 丹药弹出动画
    if (this.pill.visible && this._pillAnimT !== undefined) {
      this._pillAnimT += dt;
      const t = this._pillAnimT;
      if (t < 0.5) {
        // 弹出 + 缩放
        this.pill.scale.setScalar(t / 0.5);
        this.pill.position.y = 0.8 + Math.sin((t / 0.5) * Math.PI) * 0.8;
      } else if (t < 1.2) {
        // 悬停 + 旋转
        this.pill.position.y = 0.8;
        this.pill.rotation.y += dt * 4;
      } else {
        // 慢慢淡出
        const fade = Math.max(0, 1 - (t - 1.2) / 0.8);
        this.pill.material.opacity = fade;
        this.pill.material.transparent = true;
      }
    }
  }
}
