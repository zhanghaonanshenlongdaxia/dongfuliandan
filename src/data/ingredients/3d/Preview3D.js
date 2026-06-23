// ============================================================
// data/ingredients/3d/Preview3D.js — 3D 预览弹窗
// 弹出一个独立的小 three.js 场景,展示选中的药材 3D 形态
// 自动旋转 + 呼吸光晕,玩家可以拖动看
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Ingredient3D } from './Ingredient3D.js';
import { GRADE_MAP } from '../index.js';

export class Preview3D {
  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'codex-3d-preview hidden';
    this.root.innerHTML = `
      <header class="preview-header">
        <h3 id="preview-title">预览</h3>
        <button class="codex-close" type="button">✕</button>
      </header>
      <div class="preview-canvas-container">
        <canvas id="preview-canvas"></canvas>
      </div>
      <div class="preview-info" id="preview-info">点击拖动旋转</div>
    `;
    document.body.appendChild(this.root);

    this.canvas = this.root.querySelector('#preview-canvas');
    this.titleEl = this.root.querySelector('#preview-title');
    this.infoEl = this.root.querySelector('#preview-info');

    this.root.querySelector('.codex-close').addEventListener('click', () => this.hide());
    this._scene = null;
    this._clock = null;
    this._raf = null;
  }

  show(ingredient) {
    this.titleEl.textContent = `${ingredient.name} · ${GRADE_MAP[ingredient.grade].tierName}`;
    this.infoEl.textContent = `品阶 ${ingredient.grade} | 类型 ${ingredient.type} | ${ingredient.description}`;

    // 销毁旧的
    if (this._scene) {
      this._disposeScene();
    }

    this.root.classList.remove('hidden');

    // 初始化场景(同步)→ 启动循环 → 异步加载 GLB
    this._initScene(ingredient);
    this._startLoop();

    // GLB / OBJ 模型:在背景异步加载
    const isGlb = ingredient.geomShape === 'glb-model' && ingredient.modelFile;
    const isObj = ingredient.geomShape === 'obj-model' && ingredient.modelFile;
    if (isGlb || isObj) {
      this.infoEl.textContent = `品阶 ${ingredient.grade} | 类型 ${ingredient.type} | 加载中...`;
      const loader = isGlb
        ? Ingredient3D.loadGlbModelAsync(this._ingredientMesh, ingredient.modelFile)
        : Ingredient3D.loadObjModelAsync(this._ingredientMesh, ingredient.modelFile, ingredient.pbrTextures || {});
      loader
        .then(() => {
          // 加载完成:重新计算包围盒,更新相机/控制
          if (!this._scene || !this._ingredientMesh) return;
          const newBox = new THREE.Box3().setFromObject(this._ingredientMesh);
          const newCenter = newBox.getCenter(new THREE.Vector3());
          const newSize = newBox.getSize(new THREE.Vector3());
          const newMaxDim = Math.max(newSize.x, newSize.y, newSize.z);
          this._refitCamera(newCenter, newMaxDim);
          this.infoEl.textContent = `品阶 ${ingredient.grade} | 类型 ${ingredient.type} | ${ingredient.description}`;
        })
        .catch(err => {
          console.error('[Preview3D] model load error:', err);
          this.infoEl.textContent = `品阶 ${ingredient.grade} | 类型 ${ingredient.type} | 模型加载失败`;
        });
    }
  }

  /** 重新调整相机和控制器以适配新模型(GLB 加载完后调用) */
  _refitCamera(center, maxDim) {
    const fitRatio = 2.8;
    const dist = maxDim * fitRatio;
    this._camera.position.set(
      center.x + dist * 0.5,
      center.y + maxDim * 0.2,
      center.z + dist * 0.9
    );
    this._camera.lookAt(center);
    this._controls.target.copy(center);
    this._controls.minDistance = dist * 0.4;
    this._controls.maxDistance = dist * 3.0;
    this._controls.update();
  }

  hide() {
    this.root.classList.add('hidden');
    if (this._raf) cancelAnimationFrame(this._raf);
    this._disposeScene();
  }

  _initScene(ingredient) {
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 500;

    this._renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this._renderer.setPixelRatio(window.devicePixelRatio);
    this._renderer.setSize(w, h);
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.1;

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x0a0604);

    // 1. 先建模型(拿到它的包围盒才能算相机位置)
    this._ingredientMesh = Ingredient3D.build(ingredient);
    this._scene.add(this._ingredientMesh);

    // 2. 计算包围盒,让相机**自动适配**模型大小
    const box = new THREE.Box3().setFromObject(this._ingredientMesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // 相机距离 = 模型最大尺寸 × 系数
    // 系数越大镜头越远(留更多边距)
    const fitRatio = 2.8;
    const dist = maxDim * fitRatio;

    this._camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this._camera.position.set(
      center.x + dist * 0.5,
      center.y + maxDim * 0.2,
      center.z + dist * 0.9
    );
    this._camera.lookAt(center);

    this._controls = new OrbitControls(this._camera, this.canvas);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.1;
    this._controls.target.copy(center);
    this._controls.minDistance = dist * 0.4;
    this._controls.maxDistance = dist * 3.0;

    // 光照 — 4 灯布光(让模型清晰可见)
    // 1. 环境光(暖色,稍亮)
    const ambient = new THREE.AmbientLight(0xfff5e0, 1.5);
    this._scene.add(ambient);

    // 2. 主光:扇形窗光(右上方)
    const key = new THREE.SpotLight(0xfff0d0, 18.0, 12, Math.PI / 3.5, 0.5, 1.0);
    key.position.set(2.5, 2.2, 0.8);
    key.target.position.set(-0.2, 0, 0);
    this._scene.add(key);
    this._scene.add(key.target);

    // 3. 边缘冷光(轮廓对比)
    const rim = new THREE.DirectionalLight(0x88aaff, 2.4);
    rim.position.set(-3, 1, -1.5);
    this._scene.add(rim);

    // 4. 底部暖光(药材主色,提亮暗面)
    const fill = new THREE.PointLight(
      new THREE.Color(ingredient.colorHex),
      1.8, 3, 1.5
    );
    fill.position.set(0, -0.3, 0);
    this._scene.add(fill);

    // 5. 前方补光(让人物正面也亮)
    const front = new THREE.DirectionalLight(0xffeedd, 2.4);
    front.position.set(0, 0.5, 4);
    this._scene.add(front);

    // ===== 舞台 =====
    this._buildStage(ingredient);

    // ===== 灰尘粒子 =====
    this._buildDust();

    // 3D 药材已经在前面创建(用包围盒算相机),这里不重复

    // 底座(让物件有"放"的感觉)
    const padGeo = new THREE.CircleGeometry(0.35, 24);
    const padMat = new THREE.MeshStandardMaterial({
      color: GRADE_MAP[ingredient.grade].colorCss || 0x444444,
      roughness: 0.5,
      metalness: 0.3,
      transparent: true,
      opacity: 0.4
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = -0.02;
    this._scene.add(pad);

    this._clock = new THREE.Clock();
  }

  /**
   * 舞台:圆盘底座 + 半反光地面
   * 让模型"有地方放",更有展柜感
   */
  _buildStage(ingredient) {
    // ===== 古风舞台:深色木面 + 石板地 =====
    // 主底座(模型站的地方)— 古风木质感
    const podiumGeo = new THREE.CylinderGeometry(0.65, 0.75, 0.08, 32);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x3a2418,        // 深木色
      roughness: 0.92,         // 非常粗糙(无光泽)
      metalness: 0.0           // 不金属
    });
    const podium = new THREE.Mesh(podiumGeo, podiumMat);
    podium.position.y = -0.04;
    this._scene.add(podium);

    // 底座顶面的小细节(内嵌一圈薄环,像古风家具的描边)
    const trimGeo = new THREE.TorusGeometry(0.55, 0.008, 6, 48);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x6b4a30,        // 浅一点的木色
      roughness: 0.85,
      metalness: 0.05
    });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.y = 0.005;
    trim.rotation.x = Math.PI / 2;
    this._scene.add(trim);

    // 大地面 — 旧石板质感(粗糙、不反光)
    const floorGeo = new THREE.CircleGeometry(3, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a140e,        // 暗石色
      roughness: 0.95,
      metalness: 0.0
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.085;
    this._scene.add(floor);

    // 底座边缘亮线(Grade 色发光环)— 古风金属镶边
    const g = GRADE_MAP[ingredient.grade];
    const ringColor = new THREE.Color(g.color);
    const ringGeo = new THREE.TorusGeometry(0.7, 0.008, 6, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: ringColor,
      emissive: ringColor,
      emissiveIntensity: 0.6,
      roughness: 0.4,
      metalness: 0.2
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.005;
    ring.rotation.x = Math.PI / 2;
    this._scene.add(ring);
  }

  /**
   * 灰尘粒子:50 颗加色混合小光点,慢飘
   * 配 SpotLight 会让它们在光柱里特别亮
   */
  _buildDust() {
    const count = 50;
    this._dust = [];
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // 在模型周围 1.5 单位圆柱内分布
      const theta = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 1.2;
      const y = -0.5 + Math.random() * 2.5;
      this._dust.push({
        pos: new THREE.Vector3(
          Math.cos(theta) * r,
          y,
          Math.sin(theta) * r
        ),
        // 慢速随机方向(主要向上飘)
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.05,
          Math.random() * 0.05 + 0.02,
          (Math.random() - 0.5) * 0.05
        ),
        phase: Math.random() * Math.PI * 2
      });
      positions[i * 3] = this._dust[i].pos.x;
      positions[i * 3 + 1] = this._dust[i].pos.y;
      positions[i * 3 + 2] = this._dust[i].pos.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // 圆形光斑贴图
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const cx = c.getContext('2d');
    const grad = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 245, 220, 1)');
    grad.addColorStop(0.4, 'rgba(255, 220, 150, 0.5)');
    grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    this._dustMaterial = new THREE.PointsMaterial({
      size: 0.05,
      map: tex,
      transparent: true,
      opacity: 0.75,
      color: 0xfff5d0,            // PointsMaterial 不支持 emissive,color 本身就够亮
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
        this._dustPoints = new THREE.Points(geo, this._dustMaterial);
    this._scene.add(this._dustPoints);

    // ===== 透明光柱(简易版:Canvas 渐变 + Cylinder) =====
    this._addLightBeam();
  }

  /** 透明光柱:Canvas 画渐变 → 贴 Cylinder → 加色混合 */
  _addLightBeam() {
    // 1. 画一张渐变贴图(从亮到透明)
    const c = document.createElement('canvas');
    c.width = 8; c.height = 256;
    const cx = c.getContext('2d');
    const grad = cx.createLinearGradient(0, 0, 0, 256);
    // 顶部(光源端)亮,向下渐淡
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');  // 顶部纯白亮
    grad.addColorStop(0.3, 'rgba(255, 240, 200, 0.55)');
    grad.addColorStop(0.7, 'rgba(255, 210, 140, 0.15)');
    grad.addColorStop(1.0, 'rgba(255, 180, 100, 0.00)');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 8, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    // 2. Cylinder 几何
    //    top 细(光源端)+ bottom 粗(照射端), 自然形成锥形
    const length = 3;
    const radiusTop = 0.05;
    const radiusBottom = 0.7;
    const geo = new THREE.CylinderGeometry(
      radiusTop, radiusBottom, length, 32, 1, true
    );

    // 3. 材质(透明 + 加色)
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      color: 0xffeec0
    });

    // 4. 摆位 + 朝向
    const beam = new THREE.Mesh(geo, mat);
    const lightPos = new THREE.Vector3(2.5, 2.2, 0.8);
    const target = new THREE.Vector3(-0.2, 0, 0);
    beam.position.copy(lightPos);
    // 让 cylinder 的 -Y(粗端/照射处)指向 target
    const dir = target.clone().sub(lightPos).normalize();
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    this._scene.add(beam);
  }

/** 主循环:灰尘飘动 */
  _updateDust(dt, t) {
    if (!this._dust) return;
    const arr = this._dustPoints.geometry.attributes.position.array;
    for (let i = 0; i < this._dust.length; i++) {
      const p = this._dust[i];
      p.pos.addScaledVector(p.vel, dt);
      // 飘出范围就从下方回弹
      if (p.pos.y > 2.5) {
        p.pos.y = -0.5;
        p.pos.x = (Math.random() - 0.5) * 1.5;
        p.pos.z = (Math.random() - 0.5) * 1.5;
      }
      // 微微横向扰动
      const wob = Math.sin(t * 1.5 + p.phase) * dt * 0.05;
      p.pos.x += wob;
      arr[i * 3] = p.pos.x;
      arr[i * 3 + 1] = p.pos.y;
      arr[i * 3 + 2] = p.pos.z;
    }
    this._dustPoints.geometry.attributes.position.needsUpdate = true;
  }

  _startLoop() {
    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      if (!this._scene) return;
      const dt = this._clock.getDelta();
      const t = this._clock.getElapsedTime();
      this._controls.update();
      Ingredient3D.update(this._ingredientMesh, dt, t);
      this._updateDust(dt, t);
      this._renderer.render(this._scene, this._camera);
    };
    tick();
  }

  _disposeScene() {
    if (this._renderer) this._renderer.dispose();
    if (this._scene) {
      this._scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    this._scene = null;
    this._renderer = null;
    this._camera = null;
    this._controls = null;
    this._ingredientMesh = null;
  }
}
