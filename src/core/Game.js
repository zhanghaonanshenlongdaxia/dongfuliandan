// ============================================================
// core/Game.js — 游戏主类
// 串联 Scene/Camera/Renderer/场景模块/状态机/UI
// 管理主循环:每帧 update 所有动画 + 状态机 tick
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// DRACOLoader 共享实例(用 Google CDN 托管的 decoder)
// 加载压缩过的 GLB(被 scripts/compress-models.mjs 处理)需要它
const _dracoLoader = new DRACOLoader();
_dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const _gltfLoader = new GLTFLoader();
_gltfLoader.setDRACOLoader(_dracoLoader);

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
import { TimeOfDay } from '../scene/TimeOfDay.js';
import { Sky } from '../scene/Sky.js';
import { Sun } from '../scene/Sun.js';
import { Weather } from '../scene/Weather.js';
import { Distant } from '../scene/Distant.js';
import { CaveDoor } from '../scene/CaveDoor.js';
import { SnowAccumulation } from '../scene/SnowAccumulation.js';
import { Mountain } from '../scene/Mountain.js';
import { EnvControl } from '../ui/EnvControl.js';

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
    // 不再设 background,由 Sky 接管
    // 雾:用 FogExp2(指数雾),颜色和密度由 TimeOfDay + Weather 实时更新
    this.scene.fog = new THREE.FogExp2(0xffd0a0, 0.012);
  }

  _initCamera() {
    const aspect = (window.innerWidth - 340) / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 500);
    // 位置在 _initWorld 里 Monk 创建后再设置(monk 此时还不存在)
    this.camera.position.set(0, 5, 10);
  }

  _initControls() {
    this.controls = new OrbitControls(this.camera, this.canvas);
    // target 先设到 (0,0,0),等 Monk 创建后再跟随(在 _initWorld 里)
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;   // 禁止平移(永远跟着 Monk)
    this.controls.minDistance = 2;
    this.controls.maxDistance = 30;
    // 极角:第三人称,不能完全俯视/仰视
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    // 方位角:全 360°
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
  }

  _initWorld() {
    // ============== 时段系统(其他模块的颜色都来自这里) ==============
    this.timeOfDay = new TimeOfDay();
    // 默认:黄昏(波洛雪夜山庄那种)
    this.timeOfDay.setHour(17.3);
    this.timeOfDay.pause();   // 暂停循环,玩家想快进再开

    // ============== 天空 + 太阳(基于时段) ==============
    this.sky = new Sky(250);
    this.scene.add(this.sky.group);

    this.sun = new Sun(120);
    this.scene.add(this.sun.group);

    // ============== 远景:山轮廓 + 大雁 ==============
    this.distant = new Distant();
    this.scene.add(this.distant.group);
    // 藏掉近层山(被下面的真实 Mountain 替代)
    if (this.distant.mountainNear) this.distant.mountainNear.visible = false;

    // ============== 天气(默认下雪) ==============
    this.weather = new Weather(this.scene);
    this.weather.setType('snow');
    // 第一次同步雾色
    this.weather.applyFog(this.scene, this.timeOfDay);

    // ============== 洞府(在原点,门口朝 +X) ==============
    this.cave = new Cave();
    this.scene.add(this.cave.group);

    // 洞口大山门(在 +X 方向,门口朝 +X,默认半开)
    this.caveDoor = new CaveDoor({
      position: new THREE.Vector3(7.0, 0, 0),
      lookOut: new THREE.Vector3(1, 0, 0),
      openAngle: 0.7   // 半开
    });
    this.scene.add(this.caveDoor.group);

    // ============== 仙山(Blender 导出的程序化山体) ==============
    this.mountain = new Mountain();
    this.scene.add(this.mountain.group);

    // ============== 院落地面(洞口外的石板地) ==============
    const courtyardRefs = this._buildCourtyard();

    // ============== 雪累积系统(平台/门/墙/堆雪) ==============
    this.snowAccum = new SnowAccumulation({
      scene: this.scene,
      platform: courtyardRefs.platform,
      snowWall: null,
      caveDoorGroup: this.caveDoor.group,
      pillarPositions: courtyardRefs.pillars,
      speed: 0.005
    });

    // ============== 灯光(基于时段调强度) ==============
    this.lighting = new Lighting();
    this.scene.add(this.lighting.group);

    // ============== 洞内物件(在原点的洞里) ==============
    this.furnace = new Furnace();
    this.scene.add(this.furnace.group);

    this.fire = new Fire();
    this.scene.add(this.fire.group);

    this.smoke = new Smoke();
    this.scene.add(this.smoke.group);

    // 道士
    this.monk = new Monk();
    this.monk.group.position.set(-2.0, 0, 0.4);
    this.monk.group.rotation.y = -Math.PI / 2;  // 面向 +X(洞口方向)
    this.scene.add(this.monk.group);

    // ===== 相机拉到 Monk 背后(第三人称) =====
    // Monk 在 (-2, 0, 0.4),面朝 +X,相机放在 -X 方向
    this.camera.position.set(
      this.monk.group.position.x - 5,
      this.monk.group.position.y + 3,
      this.monk.group.position.z + 0.5
    );
    this.camera.lookAt(this.monk.group.position);
    // 让 OrbitControls target 指向 Monk(target 跟随)
    if (this.controls) this.controls.target.copy(this.monk.group.position);
    // 控制提示(右下角小窗)
    this._initControlHint();

    // 洞府装饰
    this.decor = new Decor();
    this.scene.add(this.decor.group);

    // 垂藤草
    this.hangingVine = new HangingVine({
      length: 2.5,
      origin: new THREE.Vector3(-1.8, 4.5, -2.5)
    });
    this.scene.add(this.hangingVine.group);

    this.pollen = new Pollen({
      center: new THREE.Vector3(-1.8, 3.0, -2.5),
      count: 45,
      radius: 2.5,
      height: 3.0
    });
    this.scene.add(this.pollen.group);

    // ============== 第一次同步时段 → 灯光/天空/太阳/雾 ==============
    this._applyTimeOfDay();

    // ============== 右上角时段 + 天气控制面板 ==============
    this.envControl = new EnvControl({
      timeOfDay: this.timeOfDay,
      weather: this.weather,
      scene: this.scene,
      snowAccum: this.snowAccum
    });
  }

  /** 简单的控制提示 */
  _initControlHint() {
    const hint = document.createElement('div');
    hint.className = 'control-hint';
    hint.innerHTML = `
      <div class="ch-row"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>移动人物</span></div>
      <div class="ch-row"><span class="ch-mouse">🖱</span><span>拖动旋转 · 滚轮缩放</span></div>
    `;
    document.body.appendChild(hint);
  }

  /** 院落:洞口外的石板平台 + 雪堆 + 装饰石 + 下山小径(被雪堵)
   *  返回 { platform, snowWall, pillars } 给 SnowAccumulation 用 */
  _buildCourtyard() {
    const group = new THREE.Group();
    group.name = 'Courtyard';

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x7a7060, roughness: 0.95, flatShading: true
    });
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeff, roughness: 0.6, metalness: 0.05,
      flatShading: true
    });

    // 石板地(圆形,匹配山顶平台) — 用 CylinderGeometry 替代 BoxGeometry
    const platformRadius = 7;  // 山的平台 radius=6,扩 1 单位做院子
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(platformRadius, platformRadius, 0.3, 48),
      stoneMat
    );
    platform.position.set(12, -0.15, 0);  // 洞口在 x=7.5,平台往 +X
    platform.receiveShadow = false;
    group.add(platform);

    // 平台上的薄雪(很薄,贴平台顶面)
    const snowLayer = new THREE.Mesh(
      new THREE.CylinderGeometry(platformRadius - 0.1, platformRadius - 0.1, 0.04, 48),
      snowMat
    );
    snowLayer.position.set(12, 0.005, 0);  // 几乎贴平台顶面(y=0)
    group.add(snowLayer);

    // 平台边缘的栏杆/矮柱(装饰)
    const pillars = [];
    for (const z of [-5, 5]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 1.0, 6),
        stoneMat
      );
      post.position.set(17, 0.5, z);
      group.add(post);
      pillars.push({ x: 17, z });
      // 柱顶雪
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
        snowMat
      );
      cap.position.set(17, 1.05, z);
      group.add(cap);
    }

    // 几个大石块(点缀)
    for (let i = 0; i < 4; i++) {
      const stone = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.3, 0),
        stoneMat
      );
      const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
      const r = 4 + Math.random() * 1.5;
      stone.position.set(12 + r, 0.3, Math.sin(angle) * r * 0.7);
      stone.rotation.set(Math.random(), Math.random(), Math.random());
      group.add(stone);
    }

    // =========== 下山小径 + 大雪墙 — 山的表面就是路,都不要了 ===========

    // 平台边缘的积雪堆
    for (let i = 0; i < 6; i++) {
      const drift = new THREE.Mesh(
        new THREE.SphereGeometry(0.4 + Math.random() * 0.3, 6, 5),
        snowMat
      );
      drift.position.set(
        8 + i * 1.5 + Math.random() * 0.5,
        0.2 + Math.random() * 0.3,
        -6 + Math.random() * 12
      );
      drift.scale.y = 0.5;
      group.add(drift);
    }

    this.scene.add(group);
    this.courtyard = group;

    // 返回引用给 SnowAccumulation(snowWall 改成 null,山的表面是路)
    return { platform, snowWall: null, pillars };
  }

  /** 把 TimeOfDay 的环境参数应用到天空/太阳/雾 */
  _applyTimeOfDay() {
    const env = this.timeOfDay.getEnvironment();
    // 雾
    this.scene.fog.color.copy(env.fogColor);
    this.scene.fog.density = env.fogDensity;
    // 太阳强度
    if (this.sun) {
      // Sun 自己在 update() 里调位置,这里给光强
      this.sun.disk.material.opacity = 1.0;
    }
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
    // 用共享的 _gltfLoader(已配 DRACOLoader),支持压缩 GLB
    const loader = _gltfLoader;
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

    // ===== 人物控制:WASD =====
    this._keys = { w: false, a: false, s: false, d: false };
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k in this._keys) this._keys[k] = true;
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k in this._keys) this._keys[k] = false;
    });
    // 失去焦点时松开所有键
    window.addEventListener('blur', () => {
      for (const k in this._keys) this._keys[k] = false;
    });
  }

  /**
   * 人物控制:WASD 移动 Monk(相对相机方向)
   * OrbitControls target 跟随 Monk,鼠标拖动可以环视
   * 边界:不能走出山外(距原点 < 35)
   */
  _updateCharacterControl(dt) {
    const speed = 4.0;  // 单位/秒
    const move = new THREE.Vector3();

    // 相机前方向(XZ 平面投影)
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    // 相机右方向
    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    if (this._keys.w) move.add(forward);
    if (this._keys.s) move.sub(forward);
    if (this._keys.d) move.add(right);
    if (this._keys.a) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      const newPos = this.monk.group.position.clone().add(move);

      // 边界:不能走出山(距原点 < 35)
      const distFromCenter = Math.sqrt(newPos.x * newPos.x + newPos.z * newPos.z);
      if (distFromCenter < 35) {
        this.monk.group.position.add(move);
        // 人物朝向移动方向
        this.monk.group.rotation.y = Math.atan2(move.x, move.z);
        // 走路动画(fan 表示扇火,idle 是默认;可以复用 fan 表达"走")
        this.monk.setGesture('fan');
      }
    } else {
      // 静止时回 idle
      this.monk.setGesture('idle');
    }

    // 相机和 OrbitControls 跟着 Monk
    this.controls.target.copy(this.monk.group.position);
  }

  // ---------- 主循环 ----------

  start() {
    const tick = () => {
      const dt = Math.min(this._clock.getDelta(), 0.1);

      this.sm.tick(dt);

      // ============ 时段 / 天气 / 环境 ============
      this.timeOfDay.tick(dt);
      this.weather.tick(dt);
      this.sky.update(this.timeOfDay);
      this.sun.update(this.timeOfDay);
      this.weather.applyFog(this.scene, this.timeOfDay);
      this.distant.tick(dt);
      this.caveDoor.tick(dt);
      this.snowAccum.update(dt);
      this.envControl.update();

      // ============ 人物控制(WASD + 相机跟随) ============
      this._updateCharacterControl(dt);

      // ============ OrbitControls + 相机约束 ============
      this.controls.update();
      // 相机 Y 软上限:不让视角漂到地面下太多
      if (this.camera.position.y < 0.5) this.camera.position.y = 0.5;

      // ============ 场景物件 ============
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
