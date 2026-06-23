// ============================================================
// core/Game.js — 游戏主类
// 串联 Scene/Camera/Renderer/场景模块/状态机/UI
// 管理主循环:每帧 update 所有动画 + 状态机 tick
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { Cave } from '../scene/Cave.js';
import { Furnace } from '../scene/Furnace.js';
import { Fire } from '../scene/Fire.js';
import { Smoke } from '../scene/Smoke.js';
import { Lighting } from '../scene/Lighting.js';
import { Monk } from '../scene/Monk.js';
import { Decor } from '../scene/Decor.js';
import { Environment } from '../scene/Environment.js';
import { Postprocessing } from '../scene/Postprocessing.js';
import { HangingVine } from '../scene/HangingVine.js';
import { Pollen } from '../scene/Pollen.js';

import { RefineStateMachine, EVENTS, STATES } from './RefineStateMachine.js';
import { Inventory } from '../ui/inventory.js';
import { UIManager } from '../ui/UIManager.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this._clock = new THREE.Clock();

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initControls();
    this._initWorld();
    this._initPostprocessing();
    this._initLogic();
    this._initEvents();
  }

  // ---------- 初始化 ----------

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth - 340, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // ACES 色调映射:让 bloom 看起来更自然
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a0e08);
    this.scene.fog = new THREE.Fog(0x1a0e08, 10, 32);
  }

  _initCamera() {
    const aspect = (window.innerWidth - 340) / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 100);
    this.camera.position.set(3.8, 2.6, 4.6);
    this.camera.lookAt(0, 1.2, 0);
  }

  _initControls() {
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, 1.2, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.8;
    this.controls.maxDistance = 6.5;
    this.controls.minPolarAngle = Math.PI * 0.28;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.minAzimuthAngle = -Math.PI * 0.7;
    this.controls.maxAzimuthAngle = Math.PI * 0.7;
  }

  _initWorld() {
    this.cave = new Cave();
    this.scene.add(this.cave.group);

    this.lighting = new Lighting();
    this.scene.add(this.lighting.group);

    this.furnace = new Furnace();
    this.scene.add(this.furnace.group);

    this.fire = new Fire();
    this.scene.add(this.fire.group);

    this.smoke = new Smoke();
    this.scene.add(this.smoke.group);

    // 道士(默认用过程化身体,如果有 .glb 模型会被替换)
    this.monk = new Monk();
    this.monk.group.position.set(2.0, 0, 0.4);
    this.monk.group.rotation.y = Math.PI / 2;   // 过程化身体面朝 -X(丹炉方向)
    this.scene.add(this.monk.group);

    // 洞府装饰(家具、烛台、葫芦、书架、魔法阵)
    this.decor = new Decor();
    this.scene.add(this.decor.group);

    // 垂藤草:挂在洞府后方高处,垂直垂下(叶子会摆动)
    this.hangingVine = new HangingVine({
      length: 2.5,
      origin: new THREE.Vector3(-1.8, 4.5, -2.5)
    });
    this.scene.add(this.hangingVine.group);

    // 飘浮粒子(在垂藤草周围发光漂浮)
    this.pollen = new Pollen({
      center: new THREE.Vector3(-1.8, 3.0, -2.5),
      count: 45,
      radius: 2.5,
      height: 3.0
    });
    this.scene.add(this.pollen.group);
  }

  _initPostprocessing() {
    // 1. 环境贴图(HDRI / RoomEnvironment)给 PBR 材质真实反射
    this.environment = new Environment(this.renderer, this.scene);

    // 2. 后期处理(bloom)
    this.post = new Postprocessing(this.renderer, this.scene, this.camera);
  }

  _initLogic() {
    this.sm = new RefineStateMachine();
    this.inventory = new Inventory();
    this.ui = new UIManager(this.sm, this.inventory);
    this._bindStateMachineToScene();
    this._tryLoadCharacterModel();
  }

  /** 加载 /models/character.glb 作为人物(带骨骼动画) */
  async _tryLoadCharacterModel() {
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync('/models/character.glb');
      // 自动算 yOffset:让脚底贴在 y=0(很多模型脚底不在原点)
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const minY = box.min.y;
      // 也算 scale:若模型太大/太小,等比缩放到 ~1.8 米身高
      const height = box.max.y - box.min.y;
      const targetHeight = 1.8;
      const autoScale = height > 0 ? targetHeight / height : 1;
      this.monk.swapToModel(gltf.scene, gltf.animations, {
        yOffset: -minY,
        scale: autoScale
      });
      this.monk.group.rotation.y = -Math.PI / 2;
      console.log(
        `%c[Character] /models/character.glb 已加载,scale=${autoScale.toFixed(2)}, yOffset=${(-minY).toFixed(2)}`,
        'color: #6abe6a'
      );
    } catch (e) {
      // 没找到就用过程化 Monk
      console.log(
        '%c[Character] /models/character.glb 未找到,使用过程化 Monk',
        'color: #d4af37'
      );
    }
  }

  /** 加载 /models/scene.glb 作为整个洞府场景(替换过程化) */
  async _tryLoadSceneModel() {
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync('/models/scene.glb');
      this._swapToSceneModel(gltf.scene);
      console.log('%c[Scene] /models/scene.glb 已加载,隐藏过程化洞府/装饰/丹炉', 'color: #6abe6a');
    } catch (e) {
      console.log(
        '%c[Scene] /models/scene.glb 未找到,使用过程化洞府',
        'color: #d4af37'
      );
    }
  }

  /**
   * 把过程化洞府换成 Meshy 场景模型
   * 隐藏:cave / decor / furnace / fire / smoke(都是过程化几何)
   * 保留:monk(人物) / lighting / 灯光仍然作用于场景模型)
   */
  _swapToSceneModel(model) {
    // 隐藏过程化部分
    this.cave.group.visible = false;
    this.decor.group.visible = false;
    this.furnace.group.visible = false;
    this.fire.group.visible = false;
    this.smoke.group.visible = false;

    // 场景不再缩小(原样 1.0),让洞穴显得大气
    model.scale.setScalar(1.0);
    this.sceneModel = model;
    this.scene.add(model);

    // 让相机的 OrbitControls 看向模型中心(包围盒)
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    this.controls.target.copy(center);
    // 相机距离:远一些,留足空间
    const dist = maxDim * 2.2;
    this.camera.position.set(
      center.x + dist * 0.6,
      center.y + maxDim * 0.45,
      center.z + dist * 0.9
    );
    this.camera.lookAt(center);
    this.controls.update();

    // 调整相机距离限制
    this.controls.minDistance = dist * 0.6;
    this.controls.maxDistance = dist * 3.0;

    // 把 Monk 摆到场景右前方,远离丹炉
    this.monk.group.position.set(
      center.x + maxDim * 0.9,
      center.y,
      center.z - maxDim * 0.4
    );
    // 角色朝向场景中心
    const dx = center.x - this.monk.group.position.x;
    const dz = center.z - this.monk.group.position.z;
    this.monk.group.rotation.y = Math.atan2(dx, dz);

    // 极角:不能完全俯视/完全仰视
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = Math.PI * 0.55;

    // 加程序化暗墙 + 灯光
    this._addSceneFrameWalls(center, maxDim);
    this._addSceneLights(center, maxDim);
  }

  /** 程序化暗墙 — 12 根岩柱围住场景,提供"洞里"的感觉 */
  _addSceneFrameWalls(center, maxDim) {
    if (this._sceneFrameWalls) this.scene.remove(this._sceneFrameWalls);

    const wallGroup = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2a2018, roughness: 1.0, flatShading: true
    });
    // 墙放更远,留出空间
    const radius = maxDim * 2.0;

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const h = maxDim * 1.8 + Math.random() * 0.5;
      const w = 0.8 + Math.random() * 0.3;
      // 顶点扰动的 Box
      const geo = new THREE.BoxGeometry(w, h, w, 1, 5, 1);
      const pos = geo.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        pos.setX(j, pos.getX(j) + (Math.random() - 0.5) * 0.4);
        pos.setZ(j, pos.getZ(j) + (Math.random() - 0.5) * 0.4);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, wallMat);
      m.position.set(
        center.x + Math.cos(angle) * radius,
        h / 2,
        center.z + Math.sin(angle) * radius
      );
      m.rotation.y = Math.random() * Math.PI;
      wallGroup.add(m);
    }

    // 顶部钟乳石
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.3;
      const r = radius * 0.85;
      const len = 0.5 + Math.random() * 0.8;
      const geo = new THREE.ConeGeometry(0.18, len, 5);
      geo.rotateX(Math.PI);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x3a2e22, roughness: 0.9, flatShading: true
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(
        center.x + Math.cos(angle) * r,
        maxDim * 1.5 - len / 2,
        center.z + Math.sin(angle) * r
      );
      wallGroup.add(m);
    }

    this.scene.add(wallGroup);
    this._sceneFrameWalls = wallGroup;
  }

  /** 程序化灯光 — 给 Meshy 场景补光 */
  _addSceneLights(center, maxDim) {
    if (this._sceneLights) {
      this._sceneLights.forEach(l => this.scene.remove(l));
    }

    const lights = [];

    // 1. 暖色主光(模拟丹炉火光,从场景中心向上)
    const mainLight = new THREE.PointLight(0xff7733, 2.0, maxDim * 3.0, 1.3);
    mainLight.position.set(center.x, center.y + 0.3, center.z);
    this.scene.add(mainLight);
    lights.push(mainLight);

    // 2. 副光(冷色,模拟天光)
    const fillLight = new THREE.PointLight(0x6688aa, 0.7, maxDim * 4, 1.4);
    fillLight.position.set(center.x + maxDim * 1.5, center.y + maxDim * 1.2, center.z);
    this.scene.add(fillLight);
    lights.push(fillLight);

    // 3. 6 盏烛光(围场景一圈)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const radius = maxDim * 1.5;
      const candle = new THREE.PointLight(0xffaa55, 0.4, maxDim * 1.5, 1.8);
      candle.position.set(
        center.x + Math.cos(angle) * radius,
        center.y + 0.5,
        center.z + Math.sin(angle) * radius
      );
      this.scene.add(candle);
      lights.push(candle);
    }

    this._sceneLights = lights;
  }

  _bindStateMachineToScene() {
    this.sm.on(EVENTS.STATE_CHANGE, ({ to, from, detail }) => {
      this._onSceneStateChange(to, from, detail);
      this._onMonkGesture(to);
    });

    // 单独的加料事件 — 投料单次动作
    this.sm.on(EVENTS.INGREDIENT_ADDED, () => {
      this.monk.setGesture('add');
    });

    this.sm.on(EVENTS.PROGRESS, ({ progress }) => {
      if (progress > 0.5 && Math.random() < 0.05) {
        this.smoke.emit(0.8);
      }
    });

    this.sm.on(EVENTS.SUCCESS, ({ recipe }) => {
      this.furnace.showPill(recipe.pill.color);
      this.fire.setIntensity(1.5);
    });

    this.sm.on(EVENTS.FAIL, () => {
      this.smoke.setTint(0xff4422);
      for (let i = 0; i < 8; i++) this.smoke.emit(1.2);
      this.furnace.slamLid();
    });
  }

  _onMonkGesture(to) {
    if (to === STATES.IDLE)     this.monk.setGesture('idle');
    if (to === STATES.REFINING) this.monk.setGesture('fan');
    if (to === STATES.SUCCESS)  this.monk.setGesture('success');
    if (to === STATES.FAIL)     this.monk.setGesture('fail');
  }

  _onSceneStateChange(to, from, detail) {
    switch (to) {
      case STATES.IDLE:
        this.furnace.idleLid();      // 半开,露火光
        this.fire.setIntensity(0.4);
        this.lighting.setRefining(false);
        this.smoke.setTint(0xddccaa);
        this.furnace.hidePill();
        break;
      case STATES.ADDING:
        this.furnace.openLid();
        this.fire.setIntensity(0.6);
        break;
      case STATES.REFINING:
        this.furnace.openLid();
        this.fire.setIntensity(1.2);
        this.lighting.setRefining(true);
        this.smoke.setTint(0xddccaa);
        break;
      case STATES.SUCCESS:
        this.furnace.openLid();
        break;
      case STATES.FAIL:
        this.lighting.setRefining(false);
        break;
    }
  }

  _initEvents() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth - 340;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.post.setSize(w, h);
    });
  }

  // ---------- 主循环 ----------

  start() {
    const tick = () => {
      const dt = Math.min(this._clock.getDelta(), 0.1);

      this.sm.tick(dt);

      this.controls.update();
      // 相机 Y 硬限:防止飘到洞壁以上
      if (this.camera.position.y > 3.5) {
        this.camera.position.y = 3.5;
      }
      this.furnace.update(dt);
      this.fire.update(dt);
      this.lighting.update(dt);
      this.smoke.update(dt);
      this.monk.update(dt);
      this.decor.update(dt);
      this.cave.update(dt);
      this.hangingVine.update(dt);
      this.pollen.update(dt);

      // 用 composer 替代 renderer.render(),让 bloom 生效
      this.post.render();

      requestAnimationFrame(tick);
    };
    tick();
  }
}
