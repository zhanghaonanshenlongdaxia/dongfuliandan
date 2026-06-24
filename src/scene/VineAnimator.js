// ============================================================
// scene/VineAnimator.js — 挂藤的物理感摆动
//
// 之前的版本太"假",原因:
//   1. 缩放呼吸(植物不会脉动放大缩小)— 删除
//   2. hangDepth 用绝对 Y,但 GLB 模型朝向不一(不一定根在上)— 改用包围盒
//   3. 摆动幅度太小看不出
//
// 现在按"倒挂的钟摆链"建模:
//   - 锚点 = 模型最高点(自动算包围盒)
//   - 离锚越远:摆幅越大、频率越慢(物理公式)
//   - 阵风:慢速 + 快速两层 sin 叠加
//   - 叶尖高频颤动
//   - 顶点间相位差 → 形成"波动"沿藤蔓传播
//   - 整体扭转 → 叶子翻面
// ============================================================

import * as THREE from 'three';

export class VineAnimator {
  constructor(group, { swayStrength = 0.6 } = {}) {
    this.group = group;
    this.swayStrength = swayStrength;
    this._t = 0;
    this.windDir = new THREE.Vector2(1, 0);
    this._emissiveMats = [];
    this.leafParticles = null;
    this._particlesParent = group;   // 粒子挂在 group 里(随模型一起变换)

    // ===== 自动找锚点:模型最高点 =====
    this._computeAnchor();

    this._applySwayShader();
    this._buildFallingLeaves();
  }

  /** 算模型的最高点 Y 坐标(锚点) */
  _computeAnchor() {
    const bbox = new THREE.Box3().setFromObject(this.group);
    this.anchorY = bbox.max.y;
    const range = bbox.max.y - bbox.min.y;
    this.range = Math.max(range, 0.01);  // 防 0 除
  }

  /** 注入 vertex shader */
  _applySwayShader() {
    this.group.traverse(obj => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(mat => {
        if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) return;

        if (mat.emissive) {
          this._emissiveMats.push({
            mat, baseIntensity: mat.emissiveIntensity ?? 1.0
          });
        }

        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uTime        = { value: 0 };
          shader.uniforms.uWindDir     = { value: this.windDir };
          shader.uniforms.uSwayStrength = { value: this.swayStrength };
          shader.uniforms.uAnchorY     = { value: this.anchorY };
          shader.uniforms.uRange       = { value: this.range };

          shader.vertexShader = `
            uniform float uTime;
            uniform vec2  uWindDir;
            uniform float uSwayStrength;
            uniform float uAnchorY;
            uniform float uRange;
          ` + shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>

            // ===== 核心:离锚点的归一化深度 =====
            // 0 = 锚点(不动) → 1 = 最远(摆最大)
            float depth = clamp((uAnchorY - position.y) / uRange, 0.0, 1.0);
            // 用 pow 让"根部"几乎不动,只有远端大幅摆
            float amp = pow(depth, 1.5);

            // ===== 物理摆动:钟摆 =====
            // 频率随长度增加而减小(真物理:ω ∝ 1/√L)
            float freq = 2.0 - depth * 0.8;   // 远端 1.2 Hz,近端 2.0 Hz
            // 沿藤蔓的相位差(波动传播)
            float phaseShift = depth * 2.5;    // 远端相位滞后 → 形成波浪
            // 主摆动
            float mainSway = sin(uTime * freq - phaseShift) * uSwayStrength * amp;

            // ===== 阵风:两层 sin 叠加,模拟不规则风 =====
            float gust = (
              sin(uTime * 0.4) * 0.5 + 0.5
            ) * (
              sin(uTime * 1.3 + 0.7) * 0.3 + 0.7
            );
            // 阵风放大摆动(0.3~1.6 倍)
            mainSway *= 0.3 + 1.3 * gust;

            // 顶点自身相位(让同深度不同位置的叶子摆得不一样)
            float perVert = sin(uTime * 1.5 + position.x * 1.3 + position.z * 0.7);

            // ===== 应用 XZ 位移 =====
            float dx = uWindDir.x * mainSway + perVert * 0.08 * amp;
            float dz = uWindDir.y * mainSway + cos(uTime * 1.7 + position.x) * 0.08 * amp;
            transformed.x += dx;
            transformed.z += dz;

            // ===== Y 方向也有微微"弹" =====
            transformed.y += sin(uTime * freq * 1.3 - phaseShift) * 0.06 * amp;

            // ===== 叶尖高频颤动(短周期小幅) =====
            float flutter = sin(uTime * 6.0 + position.x * 4.0) * 0.06 * amp;
            transformed.x += flutter;
            transformed.z += cos(uTime * 7.0 + position.z * 4.0) * 0.06 * amp;

            // ===== 扭转(让叶面有点翻动感) =====
            float twist = sin(uTime * 1.2 + position.x * 0.3) * 0.2 * amp;
            float c = cos(twist);
            float s = sin(twist);
            vec2 rotXZ = vec2(
              transformed.x * c - transformed.z * s,
              transformed.x * s + transformed.z * c
            );
            transformed.x = rotXZ.x;
            transformed.z = rotXZ.y;
            `
          );
          mat.userData.shader = shader;
        };
        mat.needsUpdate = true;
      });
    });
  }

  /** 飘落的叶子(22 片绿色 Points,自下而上循环) */
  _buildFallingLeaves() {
    const count = 25;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // 在模型下方区域生成(用 anchorY + range 算范围)
      const a = Math.random() * Math.PI * 2;
      const r = 0.2 + Math.random() * 0.7;
      positions[i * 3]     = Math.cos(a) * r;
      positions[i * 3 + 1] = this.anchorY - 0.5 - Math.random() * 1.5;
      positions[i * 3 + 2] = Math.sin(a) * r;
      seeds[i]  = Math.random();
      speeds[i] = 0.4 + Math.random() * 0.4;   // 飘落速度
      sizes[i]  = 0.07 + Math.random() * 0.06;  // 略大
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed',   new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aSpeed',  new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aSize',   new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        uniform float uTime;
        attribute float aSeed;
        attribute float aSpeed;
        attribute float aSize;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          // 下落 2.5s 一个循环
          float fall = mod(uTime * aSpeed + aSeed * 6.0, 2.5);
          p.y -= fall;
          // 摆动
          p.x += sin(uTime * 1.3 + aSeed * 8.0) * 0.25;
          p.z += cos(uTime * 1.0 + aSeed * 5.0) * 0.25;
          // 旋转翻面
          p.y -= sin(uTime * 2.0 + aSeed * 10.0) * 0.02;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * (300.0 / -mv.z);
          vAlpha = (1.0 - fall / 2.5) * 0.85;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          // 椭圆(叶子形状,不是圆)
          float d = length(vec2(c.x, c.y * 0.45));
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.1, d) * vAlpha;
          gl_FragColor = vec4(0.35, 0.55, 0.2, a);
        }
      `,
      transparent: true,
      depthWrite: false
    });

    this.leafParticles = new THREE.Points(geo, mat);
    this._particlesParent.add(this.leafParticles);
  }

  /** 每帧 */
  update(dt) {
    this._t += dt;

    // 风向缓慢变(模拟自然风)
    this._windPhase += dt * 0.25;
    if (!this._windPhase_init) { this._windPhase = 0; this._windPhase_init = true; }
    this.windDir.x = Math.cos(this._windPhase);
    this.windDir.y = Math.sin(this._windPhase * 0.7);

    // 更新所有 mesh 的 shader uniform
    this.group.traverse(obj => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(mat => {
          const shader = mat.userData?.shader;
          if (shader) {
            shader.uniforms.uTime.value = this._t;
            shader.uniforms.uWindDir.value.copy(this.windDir);
          }
        });
      }
    });

    // 粒子
    if (this.leafParticles?.material?.uniforms?.uTime) {
      this.leafParticles.material.uniforms.uTime.value = this._t;
    }

    // ⚠ 删了"呼吸缩放" — 假

    // emissive:不再做"呼吸",做"风强度关联"
    // 风强时叶子更亮(像阳光透过去),风弱时暗
    const windStrength = 0.5 + 0.5 * Math.sin(this._t * 0.4);
    for (const item of this._emissiveMats) {
      if (item.mat.emissive) {
        item.mat.emissiveIntensity = item.baseIntensity * (0.5 + 0.5 * windStrength);
      }
    }
  }

  /** 关掉时清理 */
  dispose() {
    if (this.leafParticles) {
      this.leafParticles.geometry.dispose();
      this.leafParticles.material.dispose();
      this._particlesParent.remove(this.leafParticles);
    }
    for (const item of this._emissiveMats) {
      if (item.mat.emissive) item.mat.emissiveIntensity = item.baseIntensity;
    }
  }
}
