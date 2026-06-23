// ============================================================
// scene/Lighting.js — 灯光
// 只用两盏灯,新手最不容易卡住的方案:
//   1. AmbientLight  — 弱暖色环境光,避免洞里全黑
//   2. PointLight    — 炉口火光,REFINING 时脉动
// ============================================================

import * as THREE from 'three';

export class Lighting {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Lighting';

    // 环境光(很弱,只兜个底不让全黑)
    this.ambient = new THREE.AmbientLight(0x554433, 0.35);
    this.group.add(this.ambient);

    // 炉口点光 — 主角:火光
    this.furnaceLight = new THREE.PointLight(0xff7733, 2.2, 14, 1.5);
    this.furnaceLight.position.set(0, 1.6, 0);
    this.group.add(this.furnaceLight);

    // 半球光(顶部冷、底部暖 — 给场景一点冷暖对比)
    this.hemi = new THREE.HemisphereLight(0x334466, 0x331a0e, 0.25);
    this.group.add(this.hemi);

    // 第二盏点光:洞壁外圈的低强度补光(让道士和洞壁都看得见)
    this.fillLight = new THREE.PointLight(0xffaa66, 0.6, 10, 1.8);
    this.fillLight.position.set(2.5, 2.0, 1.5);
    this.group.add(this.fillLight);

    this._baseIntensity = 2.2;
    this._t = 0;
    this._refining = false;
  }

  /** REFINING 期间调用,光会脉动 */
  setRefining(on) {
    this._refining = on;
  }

  update(dt) {
    this._t += dt;
    if (this._refining) {
      // 4Hz 脉动 + 一点随机抖动
      const pulse = Math.sin(this._t * 8) * 0.5;
      const jitter = (Math.random() - 0.5) * 0.25;
      this.furnaceLight.intensity = this._baseIntensity + pulse + jitter;
    } else {
      // IDLE 时也有微小呼吸感的火光
      this.furnaceLight.intensity = this._baseIntensity + Math.sin(this._t * 1.5) * 0.2;
    }
  }
}
