// ============================================================
// scene/Mountain.js — 仙山(Blender 导出的程序化山体)
//
// 加载 shanxian.glb,自动定位:
//   - 用包围盒算出 plateau 顶的高度
//   - 把整个山向下移,让 plateau 顶 = y=0(和 cave 地面齐平)
//
// 效果:洞在山顶平台上,院子、洞门在 y=0,山从 y=0 向下延伸
// ============================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// 共享 Loader(复用 Game.js / Ingredient3D.js 的同一个)
const _dracoLoader = new DRACOLoader();
_dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const _gltfLoader = new GLTFLoader();
_gltfLoader.setDRACOLoader(_dracoLoader);

export class Mountain {
  /**
   * @param {string} [modelFile='/models/shanxian.glb']  GLB 路径
   * @param {number} [scale=1] 整体缩放(1 = 80x80 单位)
   */
  constructor(modelFile = '/models/shanxian.glb', scale = 1) {
    this.group = new THREE.Group();
    this.group.name = 'Mountain';
    this.modelFile = modelFile;
    this.scale = scale;
    this.model = null;
    this._loadPromise = this._load(modelFile, scale);
  }

  /** 异步加载 + 自动定位 plateau */
  async _load(modelFile, scale) {
    try {
      const gltf = await _gltfLoader.loadAsync(modelFile);
      this.model = gltf.scene;

      // 算包围盒
      this.model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(this.model);
      const size = box.getSize(new THREE.Vector3());
      const maxY = box.max.y;  // plateau 顶的高度

      // 关键:把山向下移,让 plateau 顶 = y=0
      // 这样游戏里 y=0 是山顶,cavity/院子在 y=0 山就在脚下
      this.model.position.y = -maxY;
      this.model.scale.setScalar(scale);

      this.group.add(this.model);

      console.log(
        `%c[Mountain] ${modelFile} 已加载,` +
        `plateau 在 y=0,尺寸 ${(size.x * scale).toFixed(1)}x${(size.z * scale).toFixed(1)},` +
        `高度 ${(maxY * scale).toFixed(1)} 单位`,
        'color: #6abe6a'
      );
    } catch (e) {
      console.error(`[Mountain] 加载失败: ${modelFile}`, e);
    }
  }

  /** 等加载完成(可选) */
  async ready() { return this._loadPromise; }

  update(dt) { /* 暂无动画 */ }
}
