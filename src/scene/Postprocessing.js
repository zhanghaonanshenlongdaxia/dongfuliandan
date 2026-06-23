// ============================================================
// scene/Postprocessing.js — 后期处理(EffectComposer + Bloom)
//
// 渲染管线:
//   RenderPass(scene, camera)  → 把场景渲染到纹理
//   UnrealBloomPass(...)        → 提取亮的部分并向外发光
//   OutputPass()                → 色调映射 + 颜色空间转换
//
// 调参指南:
//   strength  - 光的强度(0~3),越大越梦幻
//   radius    - 光的扩散范围(0~1)
//   threshold - 超过这个亮度的像素才会发光(0~1)
//
// 重点:bloom 只对**亮的东西**生效,所以火光、丹药、白色高光会发光
//      暗的洞壁、地面不会发亮 —— 这就是"梦幻感"的来源
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class Postprocessing {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(window.devicePixelRatio);
    this.composer.setSize(window.innerWidth - 340, window.innerHeight);

    this.composer.addPass(new RenderPass(scene, camera));

    // 重要:threshold 设高一点(0.85)避免整个场景都发光
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth - 340, window.innerHeight),
      0.7,    // strength  — 光的强度
      0.5,    // radius    — 光的扩散半径
      0.85    // threshold — 超过这个亮度的像素才发光
    );
    this.composer.addPass(this.bloomPass);

    // 必须在最后 —— 负责色调映射 + sRGB 转换
    this.composer.addPass(new OutputPass());
  }

  /** 窗口大小变化时调用 */
  setSize(w, h) {
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);
  }

  /** 替代 renderer.render() */
  render() {
    this.composer.render();
  }
}
