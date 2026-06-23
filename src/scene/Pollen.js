// ============================================================
// scene/Pollen.js — 飘浮粒子(花粉/光尘/仙气)
//
// 30-50 颗带加色混合的小光点,在场景里缓慢随机飘动
// 配 bloom 后期:看起来像"会发光的尘埃 / 仙气"
//
// 用 THREE.Points + 加色混合,性能极好(1 个 draw call)
// ============================================================

import * as THREE from 'three';

export class Pollen {
  /**
   * @param {Object} opts
   * @param {THREE.Vector3} opts.center - 粒子群中心
   * @param {number} opts.count - 粒子数(默认 40)
   * @param {number} opts.radius - 范围半径(默认 3)
   * @param {number} opts.height - 高度范围(默认 2.5)
   */
  constructor({ center, count = 40, radius = 3, height = 2.5 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'Pollen';
    this._t = 0;

    const c = center || new THREE.Vector3(0, 2, 0);

    this._particles = [];
    for (let i = 0; i < count; i++) {
      this._particles.push({
        pos: new THREE.Vector3(
          c.x + (Math.random() - 0.5) * radius * 2,
          c.y + (Math.random() - 0.5) * height,
          c.z + (Math.random() - 0.5) * radius * 2
        ),
        // 慢速随机速度
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.08,
          Math.random() * 0.04 + 0.01,  // 微微上升
          (Math.random() - 0.5) * 0.08
        ),
        // 每粒自己的"扰动频率",避免同步运动
        wobbleFreq: 0.5 + Math.random() * 1.5,
        wobblePhase: Math.random() * Math.PI * 2,
        size: 0.018 + Math.random() * 0.025
      });
    }

    // 用 Points + 自定义圆形贴图
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = this._particles[i];
      positions[i * 3] = p.pos.x;
      positions[i * 3 + 1] = p.pos.y;
      positions[i * 3 + 2] = p.pos.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // 圆形渐变光斑贴图
    const dotTex = this._makeDotTexture();

    this.material = new THREE.PointsMaterial({
      size: 0.08,
      map: dotTex,
      transparent: true,
      opacity: 0.85,
      color: 0xfff5d0,
      emissive: 0xffeebb,
      emissiveIntensity: 1.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(geo, this.material);
    this.group.add(this.points);
  }

  /** 自发光圆形贴图(径向渐变,中心亮,边缘透明) */
  _makeDotTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 220, 1)');
    grad.addColorStop(0.3, 'rgba(255, 230, 150, 0.6)');
    grad.addColorStop(0.7, 'rgba(255, 200, 100, 0.2)');
    grad.addColorStop(1, 'rgba(255, 150, 50, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** 主循环:每粒随机飘动 + 周期回弹 */
  update(dt) {
    this._t += dt;
    const positions = this.points.geometry.attributes.position;
    const arr = positions.array;
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      // 自由飘动
      p.pos.addScaledVector(p.vel, dt);
      // 微微扰动(像空气流动)
      const wobbleX = Math.sin(this._t * p.wobbleFreq + p.wobblePhase) * dt * 0.05;
      const wobbleY = Math.cos(this._t * p.wobbleFreq * 0.7 + p.wobblePhase) * dt * 0.03;
      p.pos.x += wobbleX;
      p.pos.y += wobbleY;

      // 飘太远就回弹(从另一侧回来)
      if (p.pos.y < p.pos.y - 2) p.vel.y = Math.abs(p.vel.y) * 0.5;
      if (Math.abs(p.pos.x) > 4) p.vel.x *= -0.8;
      if (Math.abs(p.pos.z) > 4) p.vel.z *= -0.8;

      arr[i * 3] = p.pos.x;
      arr[i * 3 + 1] = p.pos.y;
      arr[i * 3 + 2] = p.pos.z;
    }
    positions.needsUpdate = true;
  }
}
