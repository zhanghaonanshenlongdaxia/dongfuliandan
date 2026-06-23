// ============================================================
// scene/Environment.js — 环境贴图(HDRI / RoomEnvironment)
//
// 给 PBR 材质(MeshStandardMaterial 等)提供**真实反射**。
// 没有这个,金属、玻璃、皮肤都会看起来像纸片。
//
// 默认:three.js 内置的 RoomEnvironment(一个虚拟的"白房间")
//       立刻可用,不用下载任何东西。
//
// 升级:把 .hdr 文件放到 /public/hdri/cave.hdr 即可自动加载
//       推荐下载源:https://polyhaven.com/hdris
// ============================================================

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export class Environment {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Scene} scene
   */
  constructor(renderer, scene) {
    this.scene = scene;
    this._setupRoomEnv(renderer);
    this._tryLoadHDRI();
  }

  /** 用 RoomEnvironment 给 PBR 材质一个"摄影棚"反射 */
  _setupRoomEnv(renderer) {
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    this._roomEnvTexture = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = this._roomEnvTexture;
    // 关键:洞穴氛围下,环境光强度不能拉满(否则就成"摄影棚"了)
    this.scene.environmentIntensity = 0.15;
    pmrem.dispose();
  }

  /** 尝试加载 /hdri/cave.hdr;失败则保留 RoomEnvironment */
  async _tryLoadHDRI() {
    const loader = new RGBELoader();
    try {
      const texture = await loader.loadAsync('/hdri/cave.hdr');
      texture.mapping = THREE.EquirectangularReflectionMapping;
      // 同时作为背景(天空盒)和环境反射
      this.scene.background = texture;
      this.scene.environment = texture;
      console.log('%c[HDRI] /hdri/cave.hdr 已加载', 'color: #6abe6a');
    } catch (e) {
      console.log(
        '%c[HDRI] 未找到 /hdri/cave.hdr,使用 RoomEnvironment(从 polyhaven.com 下载 .hdr 放入即可启用真实光照)',
        'color: #d4af37'
      );
    }
  }
}
