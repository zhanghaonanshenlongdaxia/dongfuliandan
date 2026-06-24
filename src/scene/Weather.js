// ============================================================
// scene/Weather.js — 天气系统
//
// 4 种天气:
//   - clear  晴(无粒子)
//   - snow   下雪(白粒子下落 + 风力)
//   - rain   下雨(细线 + 风力)
//   - fog    雾(调 scene.fog)
//
// 用 Points 渲染粒子,InstancedMesh 不需要因为粒子小
// ============================================================

import * as THREE from 'three';

const PARTICLE_VERT = `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSize;
  attribute float aSeed;
  varying float vAlpha;

  void main() {
    vec3 p = position;

    // 雪:缓慢下落 + 水平摆动
    p.y -= mod(uTime * uSpeed + aSeed * 7.0, 30.0);
    p.x += sin(uTime * 0.5 + aSeed * 12.0) * 0.4;
    p.z += cos(uTime * 0.4 + aSeed * 9.0) * 0.3;

    // wrap 到范围内
    p.y = mod(p.y + 30.0, 30.0) - 15.0;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (300.0 / -mv.z);
    vAlpha = 0.7;
  }
`;

const PARTICLE_FRAG = `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.2, d) * vAlpha;
    gl_FragColor = vec4(uColor, a);
  }
`;

export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.type = 'snow';
    this.intensity = 1.0;  // 0-1

    this._time = 0;
    this._material = null;
    this._points = null;
    this._originalFog = scene.fog ? { ...scene.fog } : null;
  }

  setType(t) {
    if (this._points) {
      this.scene.remove(this._points);
      this._points.geometry.dispose();
      this._points = null;
    }
    this.type = t;
    if (t === 'snow' || t === 'rain') {
      this._buildParticles();
    }
  }

  _buildParticles() {
    const count = this.type === 'snow' ? 800 : 1500;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i*3]   = (Math.random() - 0.5) * 60;
      positions[i*3+1] = Math.random() * 30 - 10;
      positions[i*3+2] = (Math.random() - 0.5) * 60;
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      uniforms: {
        uTime:  { value: 0 },
        uSpeed: { value: this.type === 'snow' ? 2.0 : 8.0 },
        uSize:  { value: this.type === 'snow' ? 1.0 : 0.3 },
        uColor: { value: new THREE.Color(this.type === 'snow' ? 0xffffff : 0x8899bb) }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    this._material = mat;
    this._points = new THREE.Points(geo, mat);
    this.scene.add(this._points);
  }

  /** 风的强度(0=无风,1=暴风) */
  setWind(w) { this.intensity = w; }

  /** 每帧调用 */
  tick(dt) {
    this._time += dt;
    if (this._material) {
      this._material.uniforms.uTime.value = this._time;
    }
  }

  /** 同步雾色(给 Game.js 一起调) */
  applyFog(scene, timeOfDay) {
    const env = timeOfDay.getEnvironment();
    if (this.type === 'fog') {
      scene.fog.color.copy(env.fogColor);
      scene.fog.density = env.fogDensity * 1.5;
    } else if (this.type === 'snow') {
      scene.fog.color.copy(env.fogColor);
      scene.fog.density = env.fogDensity * 1.2;
    } else if (this.type === 'rain') {
      scene.fog.color.copy(env.fogColor);
      scene.fog.density = env.fogDensity * 1.4;
    } else {
      // clear
      scene.fog.color.copy(env.fogColor);
      scene.fog.density = env.fogDensity;
    }
  }

  getLabel() {
    const labels = { clear: '晴', snow: '雪', rain: '雨', fog: '雾' };
    return labels[this.type] || this.type;
  }
}
