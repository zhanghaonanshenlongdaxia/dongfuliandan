// ============================================================
// scene/Monk.js — 道士角色
//
// 两种模式:
//   1) 过程化模式(默认):用基础几何手绘一个低多边形道士
//   2) 模型模式:用 /models/monk.glb 替换过程化身体 + 骨骼动画
//
// 调用 swapToModel(gltf.scene, gltf.animations) 切换到模型模式
// 调用 setGesture(name) 控制姿态 — 两种模式都支持同一套接口
// ============================================================

import * as THREE from 'three';
import { AnimatedActor } from './AnimatedActor.js';

// 过程化模式下:状态 -> 手写动画参数
// 模型模式下:状态 -> 候选动画名(按优先级匹配,找不到就降级)
const GESTURE_MAP = {
  procedural: {
    idle:    { rArm: 'idle',    lArm: 'idle',    bodyTilt: 0,   once: false },
    add:     { rArm: 'add',     lArm: 'idle',    bodyTilt: 0.15, once: true  },
    fan:     { rArm: 'fan',     lArm: 'fan',     bodyTilt: 0,   once: false },
    success: { rArm: 'success', lArm: 'success', bodyTilt: 0.12, once: true  },
    fail:    { rArm: 'fail',    lArm: 'fail',    bodyTilt: -0.25, once: true }
  },
  model: {
    // 候选列表 — 按顺序查找,首个匹配的胜出
    // Soldier.glb 有: idle / run / tpose / walk
    // Mixamo 标准动画名: idle / throw / wave / victory / falling
    idle:    ['idle'],
    add:     ['throw', 'toss', 'idle'],
    fan:     ['wave', 'run', 'walk', 'idle'],   // Soldier 没有 wave,降级到 run
    success: ['victory', 'cheer', 'idle'],
    fail:    ['falling', 'fall', 'idle']
  }
};

export class Monk {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Monk';

    this._t = 0;
    this._gestureT = 0;
    this._gesture = 'idle';
    this._useModel = false;
    this._actor = null;

    this._build();
  }

  _build() {
    // 过程化身体(放进子组,方便整体隐藏)
    this._proceduralGroup = new THREE.Group();
    this._proceduralGroup.name = 'ProceduralBody';
    this._buildProceduralBody();
    this.group.add(this._proceduralGroup);

    // 模型占位(默认隐藏)
    this._modelHolder = new THREE.Group();
    this._modelHolder.name = 'ModelHolder';
    this._modelHolder.visible = false;
    this.group.add(this._modelHolder);
  }

  _buildProceduralBody() {
    const robeMat = new THREE.MeshStandardMaterial({
      color: 0x7a5a3a, roughness: 0.85, flatShading: true
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xeebb99, roughness: 0.7, flatShading: true
    });
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a10, roughness: 0.7, flatShading: true
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x222222, roughness: 0.9, flatShading: true
    });
    const beardMat = new THREE.MeshStandardMaterial({
      color: 0xddd8c8, roughness: 0.9, flatShading: true
    });
    const beltMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, roughness: 0.5, metalness: 0.5
    });

    // 衣身
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.5, 1.2, 8), robeMat
    );
    body.position.y = 0.6;
    this._proceduralGroup.add(body);

    // 腰带
    const belt = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.06, 6, 12), beltMat
    );
    belt.position.y = 0.4;
    belt.rotation.x = Math.PI / 2;
    this._proceduralGroup.add(belt);

    // 头
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 8), skinMat
    );
    head.position.y = 1.4;
    this._proceduralGroup.add(head);

    // 头发
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMat
    );
    hair.position.y = 1.4;
    this._proceduralGroup.add(hair);

    // 道士帽
    const hatBrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.05, 8), hatMat
    );
    hatBrim.position.y = 1.62;
    this._proceduralGroup.add(hatBrim);

    const hatCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.25, 0.5, 8), hatMat
    );
    hatCone.position.y = 1.9;
    this._proceduralGroup.add(hatCone);

    // 胡须
    const beard = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.55, 6), beardMat
    );
    beard.position.set(0, 1.15, 0.18);
    beard.rotation.x = Math.PI * 0.85;
    this._proceduralGroup.add(beard);

    // 双臂
    this.rightArm = this._buildArm(robeMat);
    this.rightArm.position.set(0.42, 1.05, 0);
    this._proceduralGroup.add(this.rightArm);

    this.leftArm = this._buildArm(robeMat);
    this.leftArm.position.set(-0.42, 1.05, 0);
    this._proceduralGroup.add(this.leftArm);
  }

  _buildArm(robeMat) {
    const arm = new THREE.Group();
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.18, 0.55, 6), robeMat
    );
    sleeve.position.y = -0.28;
    arm.add(sleeve);
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xeebb99, roughness: 0.7 })
    );
    hand.position.y = -0.6;
    arm.add(hand);
    return arm;
  }

  // ============================================================
  // 公开接口
  // ============================================================

  /**
   * 用加载的 .glb 替换过程化身体,启用骨骼动画
   * @param {THREE.Object3D} model
   * @param {THREE.AnimationClip[]} animations
   * @param {object} [opts]
   * @param {number} [opts.scale=1]   - 模型缩放(多数 Mixamo 模型用 1.0)
   * @param {number} [opts.yOffset=0] - Y 偏移(对齐脚底到地面)
   */
  swapToModel(model, animations = [], { scale = 1, yOffset = 0 } = {}) {
    // 隐藏过程化身体
    this._proceduralGroup.visible = false;
    this._useModel = true;

    // 挂载模型
    this._modelHolder.visible = true;
    model.scale.setScalar(scale);
    model.position.y = yOffset;
    this._modelHolder.add(model);

    // 动画
    this._actor = new AnimatedActor(model, animations);
    console.log('%c[Monk] 模型已挂载,动画:', 'color: #6abe6a', this._actor.listAnimations());

    // 默认播放 idle
    this.setGesture('idle');
  }

  /** 切换姿态(过程化和模型模式通用) */
  setGesture(name) {
    if (this._gesture === name) return;
    this._gesture = name;
    this._gestureT = 0;

    if (this._useModel && this._actor) {
      // 模型模式:从候选列表里选第一个可用的动画
      const candidates = GESTURE_MAP.model[name] || GESTURE_MAP.model.idle;
      const once = name === 'add' || name === 'success' || name === 'fail';
      const picked = this._pickAnimation(candidates);
      if (picked) {
        this._actor.play(picked, { once, loop: !once });
      } else {
        console.warn(
          `[Monk] 模型没有任何可用动画(候选: ${candidates.join(', ')}),可用:`,
          this._actor.listAnimations()
        );
      }
    }
  }

  /** 从候选名列表里挑第一个 actor 实际有的 */
  _pickAnimation(candidates) {
    for (const name of candidates) {
      if (this._actor.actions.has(name)) return name;
    }
    return null;
  }

  /** 主循环调用 */
  update(dt) {
    this._t += dt;
    this._gestureT += dt;

    // 模型模式:只更新 mixer
    if (this._useModel && this._actor) {
      this._actor.update(dt);
      return;
    }

    // 过程化模式:手写动画
    this._updateProcedural(dt);
  }

  _updateProcedural(dt) {
    // 整体呼吸 + 摆头
    this.group.position.y = Math.sin(this._t * 1.5) * 0.03;
    this.group.rotation.y = Math.sin(this._t * 0.6) * 0.06;
    this.group.rotation.z = Math.sin(this._t * 0.4) * 0.02;

    let rArm = Math.sin(this._t * 1.2) * 0.08;
    let lArm = -Math.sin(this._t * 1.2) * 0.08;
    let tilt = 0;

    switch (this._gesture) {
      case 'idle':
        rArm = Math.sin(this._t * 1.2) * 0.08;
        lArm = -Math.sin(this._t * 1.2) * 0.08;
        break;

      case 'add': {
        const t = this._gestureT;
        if (t < 0.25)        rArm = -t * 4.0;
        else if (t < 0.55) { rArm = -1.0; tilt = 0.15; }
        else if (t < 0.85)   rArm = -1.0 + (t - 0.55) * 4.0;
        else                 this._gesture = 'idle';
        break;
      }

      case 'fan': {
        const f = Math.sin(this._t * 6);
        rArm = -0.4 + f * 0.5;
        lArm = -0.4 - f * 0.5;
        tilt = Math.sin(this._t * 6) * 0.04;
        break;
      }

      case 'success':
        rArm = -1.2; lArm = -1.0; tilt = 0.12; break;

      case 'fail':
        rArm = -0.2; lArm = -0.2; tilt = -0.25;
        this.group.rotation.z = -0.18;
        break;
    }

    this.rightArm.rotation.x = rArm;
    this.leftArm.rotation.x = lArm;
    this.group.rotation.x = tilt;
  }
}
