// ============================================================
// scene/TimeOfDay.js — 时段系统
//
// 控制:
//   1. 游戏内时间(小时)循环
//   2. 太阳位置(每帧给 Sky/Sun 用)
//   3. 天空/光照/雾色(给 Sky/Scene/Game 用)
//
// 时段划分:
//   0-5   夜深
//   5-8   黎明
//   8-11  上午
//   11-14 正午
//   14-17 午后
//   17-19 黄昏  ← 默认
//   19-20 傍晚
//   20-24 夜深
// ============================================================

import * as THREE from 'three';

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpHex(a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, t).getHex();
}

export class TimeOfDay {
  constructor() {
    this.hour = 17.5;   // 默认:黄昏
    this.speed = 30;    // 1 真实秒 = 30 游戏分钟 (24h 跑一圈 ~48 秒)
    this.paused = false;
  }

  setHour(h) { this.hour = ((h % 24) + 24) % 24; }
  pause()    { this.paused = true; }
  resume()   { this.paused = false; }
  togglePause() { this.paused = !this.paused; }

  tick(dt) {
    if (this.paused) return;
    this.hour = (this.hour + (dt * this.speed) / 60) % 24;
  }

  /** 太阳在天空中的角度(单位球上的位置)
   *  6:00 东方(0度),12:00 正上方,18:00 西方(180度) */
  getSunDirection() {
    const angle = ((this.hour - 6) / 12) * Math.PI;
    return new THREE.Vector3(
      Math.cos(angle),
      Math.sin(angle),
      0
    );
  }

  getPhase() {
    const h = this.hour;
    if (h < 5 || h >= 20) return 'night';
    if (h < 8)  return 'dawn';
    if (h < 11) return 'morning';
    if (h < 14) return 'noon';
    if (h < 17) return 'afternoon';
    if (h < 19) return 'sunset';
    return 'dusk';
  }

  getPhaseLabel() {
    const labels = {
      night: '夜深', dawn: '黎明', morning: '上午',
      noon: '正午', afternoon: '午后', sunset: '黄昏', dusk: '傍晚'
    };
    return labels[this.getPhase()] || this.hour.toFixed(1) + '时';
  }

  /** 一次性返回所有环境参数(给 Sky/Lighting/Scene 一起用) */
  getEnvironment() {
    const h = this.hour;
    const phase = this.getPhase();

    let zenith, horizon, sunColor, ambientIntensity, fogColor, fogDensity, sunIntensity;

    if (phase === 'night') {
      const t = (h < 5 ? h + 24 : h) - 20;  // 0-5
      const k = Math.min(1, t / 5);
      zenith = lerpHex(0x0a0a2a, 0x2a2a4a, k);
      horizon = lerpHex(0x1a1a3a, 0x3a3a5a, k);
      sunColor = 0x6677aa;
      sunIntensity = 0.1;
      ambientIntensity = 0.15;
      fogColor = lerpHex(0x1a1a3a, 0x2a2a4a, k);
      fogDensity = 0.04;
    } else if (phase === 'dawn') {
      const t = (h - 5) / 3;
      zenith = lerpHex(0x2a2a4a, 0x6a6aaa, t);
      horizon = lerpHex(0xff8866, 0xffaa88, t);
      sunColor = lerpHex(0xff7744, 0xffddaa, t);
      sunIntensity = lerp(0.4, 1.5, t);
      ambientIntensity = lerp(0.3, 0.55, t);
      fogColor = lerpHex(0xffaa88, 0xffd0a0, t);
      fogDensity = 0.02;
    } else if (phase === 'morning' || phase === 'noon' || phase === 'afternoon') {
      // 白天:中午最强
      zenith = 0x4488cc;
      horizon = 0xaaddff;
      sunColor = 0xffeecc;
      const noonBoost = phase === 'noon' ? 1.0 : 0.9;
      sunIntensity = 1.8 * noonBoost;
      ambientIntensity = 0.7;
      fogColor = 0xc8d8e8;
      fogDensity = 0.012;
    } else if (phase === 'sunset') {
      // 黄昏(17-19):最丰富的颜色
      const t = (h - 17) / 2;
      zenith = lerpHex(0x223366, 0x6a3a4a, t);
      horizon = lerpHex(0xff6644, 0xffaa44, t);
      sunColor = lerpHex(0xff8844, 0xffcc88, t);
      sunIntensity = lerp(2.0, 1.2, t);
      ambientIntensity = lerp(0.6, 0.4, t);
      fogColor = 0xff8866;
      fogDensity = 0.018;
    } else {
      // 傍晚(19-20)
      const t = (h - 19) / 1;
      zenith = lerpHex(0x6a3a4a, 0x1a1a3a, t);
      horizon = lerpHex(0xffaa44, 0x6a4a5a, t);
      sunColor = lerpHex(0xffcc88, 0xff6644, t);
      sunIntensity = lerp(1.2, 0.3, t);
      ambientIntensity = lerp(0.4, 0.2, t);
      fogColor = lerpHex(0xff8866, 0x3a2a3a, t);
      fogDensity = lerp(0.018, 0.03, t);
    }

    return {
      zenith: new THREE.Color(zenith),
      horizon: new THREE.Color(horizon),
      sunColor: new THREE.Color(sunColor),
      sunIntensity,
      ambientIntensity,
      fogColor: new THREE.Color(fogColor),
      fogDensity
    };
  }
}
