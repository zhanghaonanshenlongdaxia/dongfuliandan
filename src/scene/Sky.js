// ============================================================
// scene/Sky.js — 天空圆顶
//
// 倒置大球,用顶点着色器画"地平线→天顶"渐变
// 每帧从 TimeOfDay.getEnvironment() 取色
// ============================================================

import * as THREE from 'three';

const SKY_VERT = `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAG = `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  varying vec3 vWorldPos;

  void main() {
    vec3 dir = normalize(vWorldPos);
    float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    float t = pow(h, 0.6);
    vec3 col = mix(uHorizon, uZenith, t);

    // 太阳附近暖色光晕
    float sunAlign = max(0.0, dot(dir, uSunDir));
    float halo = pow(sunAlign, 4.0) * 0.5;
    float glow = pow(sunAlign, 1.5) * 0.15;
    col = mix(col, uSunColor, halo);
    col += uSunColor * glow;

    // ============ 关键修复:看向下时,渐变到地面色 ============
    // 否则下半球也画天空色,会看到一面"橙色曲面"飘在空中
    // smoothstep(0, -0.3, dir.y) 在地平线=0,往下 = 1
    float below = smoothstep(0.0, -0.3, dir.y);
    // 地面色:与院子石头/土一系的暗棕
    vec3 groundCol = vec3(0.22, 0.18, 0.15);
    col = mix(col, groundCol, below);

    // 地平线下方(太阳周围)染暖 — 弱化避免抢戏
    float belowSun = max(0.0, -dir.y) * pow(max(0.0, dot(normalize(vec3(dir.x, 0.0, dir.z)), uSunDir)), 2.0);
    col = mix(col, uSunColor, belowSun * 0.25 * (1.0 - below));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Sky {
  constructor(radius = 250) {
    this.group = new THREE.Group();
    this.group.name = 'Sky';

    const geo = new THREE.SphereGeometry(radius, 32, 16);
    this.material = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        uZenith:   { value: new THREE.Color(0x223366) },
        uHorizon:  { value: new THREE.Color(0xff6644) },
        uSunDir:   { value: new THREE.Vector3(1, 0.3, 0) },
        uSunColor: { value: new THREE.Color(0xff8844) }
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = -1000;
    this.group.add(this.mesh);
  }

  update(timeOfDay) {
    const env = timeOfDay.getEnvironment();
    const sunDir = timeOfDay.getSunDirection();
    this.material.uniforms.uZenith.value.copy(env.zenith);
    this.material.uniforms.uHorizon.value.copy(env.horizon);
    this.material.uniforms.uSunDir.value.copy(sunDir);
    this.material.uniforms.uSunColor.value.copy(env.sunColor);
  }
}
