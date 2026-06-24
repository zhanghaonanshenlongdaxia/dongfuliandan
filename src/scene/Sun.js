// ============================================================
// scene/Sun.js — 太阳/月亮 圆盘
//
// 在天空上画一个发光圆盘,位置跟随时段
// 白天=太阳(暖色),晚上=月亮(冷色)
// 加光晕 Sprite 让它更"大"
// ============================================================

import * as THREE from 'three';

// 软光晕贴图(Canvas 画)
function makeGlowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Sun {
  /**
   * @param {number} distance 太阳到原点距离(默认 100)
   */
  constructor(distance = 100) {
    this.group = new THREE.Group();
    this.group.name = 'Sun';
    this.distance = distance;
    this._glowTex = makeGlowTexture();

    // 太阳本体(球)
    this.disk = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffddaa,
        transparent: true,
        depthWrite: false,
        depthTest: false
      })
    );
    this.disk.renderOrder = -990;
    this.group.add(this.disk);

    // 光晕 Sprite(更大更柔)
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._glowTex,
      color: 0xffddaa,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    }));
    this.glow.scale.setScalar(20);
    this.glow.renderOrder = -989;
    this.group.add(this.glow);

    // 内部小光球(让中心更亮)
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, depthTest: false })
    );
    this.core.renderOrder = -988;
    this.group.add(this.core);

    this.setVisible(true);
  }

  setVisible(v) { this.group.visible = v; }

  update(timeOfDay) {
    const dir = timeOfDay.getSunDirection();
    const env = timeOfDay.getEnvironment();
    const phase = timeOfDay.getPhase();

    // 位置:跟太阳方向
    this.disk.position.copy(dir).multiplyScalar(this.distance);
    this.glow.position.copy(this.disk.position);
    this.core.position.copy(this.disk.position);

    // 颜色:晚上=月亮(冷色),白天=太阳(暖色)
    if (phase === 'night') {
      this.disk.material.color.setHex(0xaabbdd);
      this.glow.material.color.setHex(0xaabbdd);
      this.core.material.color.setHex(0xffffff);
      this.disk.scale.setScalar(0.7);  // 月亮看起来小一点
    } else {
      this.disk.material.color.copy(env.sunColor);
      this.glow.material.color.copy(env.sunColor);
      this.core.material.color.setHex(0xffffff);
      this.disk.scale.setScalar(1.0);
    }

    // 高度低于地平线时,圆盘藏到雾里看不见
    const visible = dir.y > -0.05;
    this.disk.visible = visible;
    this.glow.visible = visible;
    this.core.visible = visible;
  }
}
