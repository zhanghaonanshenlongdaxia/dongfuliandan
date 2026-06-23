// ============================================================
// scene/Smoke.js — 烟雾(对象池 + SpriteMaterial)
// 做法:
//   1. CanvasTexture 画软圆,作为 Sprite 的贴图
//   2. 预创建 20 个 Sprite,默认 visible=false
//   3. emit() 取一个可用 sprite,从炉口出发,向上飘
//   4. 每帧 update() 推进所有 active sprite 的位置/不透明度
// ============================================================

import * as THREE from 'three';

export class Smoke {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Smoke';
    this.group.position.set(0, 1.1, 0);

    this.pool = [];           // 所有 sprite
    this.active = [];         // 正在飘的 sprite
    this._emitCooldown = 0;
    this._tint = 0xddccaa;    // 当前烟色(FAIL 时可改红)

    this._buildPool();
  }

  _buildPool() {
    const texture = this._makeSoftCircleTexture();

    for (let i = 0; i < 20; i++) {
      const mat = new THREE.SpriteMaterial({
        map: texture,
        color: 0xddccaa,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.5, 0.5, 0.5);
      sprite.visible = false;
      sprite.userData = {
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 0,
        startOpacity: 0
      };
      this.group.add(sprite);
      this.pool.push(sprite);
    }
  }

  /** 在 64x64 canvas 上画径向渐变软圆,作为烟的纹理 */
  _makeSoftCircleTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** 烟雾颜色(可被外部改) */
  setTint(hex) {
    this._tint = hex;
  }

  /** 喷发一口烟 */
  emit(intensity = 1) {
    const sprite = this.pool.find(s => !s.visible);
    if (!sprite) return;
    sprite.visible = true;
    sprite.position.set(
      (Math.random() - 0.5) * 0.3,
      Math.random() * 0.2,
      (Math.random() - 0.5) * 0.3
    );
    sprite.scale.set(0.4, 0.4, 0.4);
    sprite.material.color.setHex(this._tint);
    sprite.material.opacity = 0.6 * intensity;

    sprite.userData.vx = (Math.random() - 0.5) * 0.2;
    sprite.userData.vy = 0.6 + Math.random() * 0.3;
    sprite.userData.vz = (Math.random() - 0.5) * 0.2;
    sprite.userData.life = 0;
    sprite.userData.maxLife = 2.5 + Math.random();
    sprite.userData.startOpacity = 0.6 * intensity;

    this.active.push(sprite);
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      const d = s.userData;
      d.life += dt;

      s.position.x += d.vx * dt;
      s.position.y += d.vy * dt;
      s.position.z += d.vz * dt;
      // 慢慢扩散
      const grow = 1 + dt * 0.5;
      s.scale.multiplyScalar(grow);
      // 越来越淡
      s.material.opacity = d.startOpacity * (1 - d.life / d.maxLife);

      if (d.life >= d.maxLife || s.material.opacity <= 0.01) {
        s.visible = false;
        s.material.opacity = 0;
        this.active.splice(i, 1);
      }
    }
  }

  /** 强制清除所有活动烟(状态切换时用) */
  clear() {
    this.active.forEach(s => {
      s.visible = false;
      s.material.opacity = 0;
    });
    this.active.length = 0;
  }
}
