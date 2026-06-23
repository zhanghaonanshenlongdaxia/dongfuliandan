// ============================================================
// scene/AnimatedActor.js — 骨骼动画封装
//
// 包装 THREE.AnimationMixer,提供简单接口:
//   play('idle')           — 循环播放
//   play('add', { once: true }) — 播放一次
//
// 配合 GLTFLoader 使用:
//   const gltf = await loader.loadAsync('/models/monk.glb');
//   const actor = new AnimatedActor(gltf.scene, gltf.animations);
//   scene.add(gltf.scene);   // 别忘了加进场景
//   actor.play('idle');
//   // 主循环:
//   actor.update(dt);
//
// Mixamo 下载的 .glb 里,clip.name 通常是大写("Idle" / "Walking")
// 这里统一转小写,方便查找。改名:在 Blender 里改,或调用时传小写名
// ============================================================

import * as THREE from 'three';

export class AnimatedActor {
  /**
   * @param {THREE.Object3D} model - 加载的 .glb 根节点
   * @param {THREE.AnimationClip[]} animations
   */
  constructor(model, animations = []) {
    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = new Map();   // 小写名 -> AnimationAction
    this.current = null;

    for (const clip of animations) {
      this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
    }
  }

  /**
   * 播放指定名称的动画
   * @param {string} name - 动画名(小写,如 "idle" / "throw" / "wave")
   * @param {object} [opts]
   * @param {boolean} [opts.loop=true]  - 是否循环
   * @param {boolean} [opts.once=false] - 单次播放后保持最后一帧
   * @param {number}  [opts.fadeIn=0.3] - 淡入时间(秒)
   */
  play(name, { loop = true, once = false, fadeIn = 0.3 } = {}) {
    const action = this.actions.get(name);
    if (!action) {
      // 静默失败 — 让用户能调通"模型没动画"的情况
      return false;
    }
    if (this.current === action) return true;

    if (this.current) this.current.fadeOut(fadeIn);
    action.reset().fadeIn(fadeIn).play();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    this.current = action;
    return true;
  }

  /** 列出所有可用的动画名(调试用) */
  listAnimations() {
    return [...this.actions.keys()];
  }

  /** 主循环调用 */
  update(dt) {
    this.mixer.update(dt);
  }
}
