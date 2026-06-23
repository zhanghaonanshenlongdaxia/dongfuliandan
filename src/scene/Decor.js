// ============================================================
// scene/Decor.js — 洞府装饰
// 全过程化几何拼一个"修仙洞府"的工作室氛围
//
// 物品清单:
//   1. 地面上的金色魔法阵(bloom 让它发光,主要视觉焦点)
//   2. 悬挂的红灯笼(顶部暖色点光)
//   3. 几束从"洞顶"挂下来的干草药
//   4. 木桌 + 桌面的竹简 + 葫芦(工作台)
//   5. 书架 + 几本"书" + 葫芦(背景)
//   6. 3 个角落的陶罐
//   7. 2 盏烛台(烛光摇曳)
//
// 全部用基础几何,代码量小,主题集中
// ============================================================

import * as THREE from 'three';

// 共享材质(避免重复创建)
function makeWoodMaterial(light = 0x6b4a2a, dark = 0x4a2f1a, isLight = true) {
  return new THREE.MeshStandardMaterial({
    color: isLight ? light : dark,
    roughness: 0.85,
    flatShading: true
  });
}

export class Decor {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Decor';

    // 收集所有动态光源(烛光摇曳)
    this._lights = [];
    this._t = 0;

    this._buildMagicCircle();
    this._buildHangingLantern();
    this._buildHangingHerbs();
    this._buildTable();
    this._buildShelf();
    this._buildPots();
    this._buildCandleStands();
  }

  // ============================================================
  // 1. 地面魔法阵(炼丹阵)
  // ============================================================
  _buildMagicCircle() {
    const circle = new THREE.Group();

    // 外环(粗)
    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.06, 8, 64),
      new THREE.MeshStandardMaterial({
        color: 0xd4af37, emissive: 0xd4af37, emissiveIntensity: 0.7,
        roughness: 0.4, metalness: 0.8
      })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = 0.02;
    circle.add(outer);

    // 内环(细)
    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(1.75, 0.035, 6, 64),
      new THREE.MeshStandardMaterial({
        color: 0xd4af37, emissive: 0xd4af37, emissiveIntensity: 0.5,
        roughness: 0.5, metalness: 0.7
      })
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.02;
    circle.add(inner);

    // 8 道 trigram(八卦符号)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.02, 0.04),
        new THREE.MeshStandardMaterial({
          color: 0xd4af37, emissive: 0xd4af37, emissiveIntensity: 0.6,
          roughness: 0.4, metalness: 0.7
        })
      );
      bar.position.set(Math.cos(angle) * 1.97, 0.025, Math.sin(angle) * 1.97);
      bar.rotation.y = -angle + Math.PI / 2;
      circle.add(bar);
    }

    // 中心红珠
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0xff4444, emissive: 0xff2222, emissiveIntensity: 1.0,
        roughness: 0.3, metalness: 0.4
      })
    );
    center.position.y = 0.05;
    circle.add(center);

    this.group.add(circle);
  }

  // ============================================================
  // 2. 悬挂红灯笼
  // ============================================================
  _buildHangingLantern() {
    const lantern = new THREE.Group();

    // 吊绳(长,从上面垂下来)
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 2.0, 4),
      new THREE.MeshStandardMaterial({ color: 0x2a1a0a })
    );
    rope.position.y = 1.0;
    lantern.add(rope);

    // 顶盖
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.11, 0.06, 6),
      new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.8 })
    );
    cap.position.y = 0.05;
    lantern.add(cap);

    // 灯笼体(发光红)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xc8462e, emissive: 0xff4422, emissiveIntensity: 0.7,
      roughness: 0.8, flatShading: true
    });
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8), bodyMat
    );
    body.position.y = -0.12;
    body.scale.set(1, 1.35, 1);
    lantern.add(body);

    // 底座
    const bottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.06, 0.05, 6),
      new THREE.MeshStandardMaterial({ color: 0x3a2410, roughness: 0.8 })
    );
    bottom.position.y = -0.32;
    lantern.add(bottom);

    // 流苏(细绳)
    for (let i = 0; i < 3; i++) {
      const tassel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4),
        new THREE.MeshStandardMaterial({ color: 0xd4af37 })
      );
      tassel.position.set(
        Math.cos(i / 3 * Math.PI * 2) * 0.05,
        -0.4, Math.sin(i / 3 * Math.PI * 2) * 0.05
      );
      lantern.add(tassel);
    }

    // 点光源(灯笼里)
    const light = new THREE.PointLight(0xff8844, 0.7, 6, 1.6);
    light.position.y = -0.12;
    lantern.add(light);

    // 挂在场景前方偏左
    lantern.position.set(-1.2, 3.0, 1.8);
    this.group.add(lantern);

    this._lights.push({ light, baseIntensity: 0.7, phase: 0 });
  }

  // ============================================================
  // 3. 悬挂的干草药
  // ============================================================
  _buildHangingHerbs() {
    const positions = [
      { x: 1.5, z: -1.0 },
      { x: -2.0, z: -1.5 },
      { x: 2.5, z: 1.5 },
      { x: -1.0, z: 2.5 }
    ];
    const herbMat = new THREE.MeshStandardMaterial({
      color: 0x4a5a2a, roughness: 0.95, flatShading: true
    });

    for (const p of positions) {
      const bunch = new THREE.Group();

      // 绳子
      const rope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 1.8, 4),
        new THREE.MeshStandardMaterial({ color: 0x3a2818 })
      );
      rope.position.y = 0.9;
      bunch.add(rope);

      // 干草(几个细 Box 捆在一起)
      for (let i = 0; i < 10; i++) {
        const herb = new THREE.Mesh(
          new THREE.BoxGeometry(0.025, 0.4 + Math.random() * 0.15, 0.025),
          herbMat
        );
        herb.position.set(
          (Math.random() - 0.5) * 0.08,
          Math.random() * 0.1,
          (Math.random() - 0.5) * 0.08
        );
        herb.rotation.set(
          (Math.random() - 0.5) * 0.3,
          Math.random() * Math.PI,
          (Math.random() - 0.5) * 0.3
        );
        bunch.add(herb);
      }

      // 顶部扎绳
      const tie = new THREE.Mesh(
        new THREE.TorusGeometry(0.06, 0.012, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a1a0a })
      );
      tie.position.y = 0.0;
      tie.rotation.x = Math.PI / 2;
      bunch.add(tie);

      bunch.position.set(p.x, 2.0, p.z);
      this.group.add(bunch);
    }
  }

  // ============================================================
  // 4. 木桌(工作台)
  // ============================================================
  _buildTable() {
    const table = new THREE.Group();
    const woodMat = makeWoodMaterial();
    const darkWoodMat = makeWoodMaterial(0x6b4a2a, 0x4a2f1a, false);

    // 桌面
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.08, 0.7), woodMat
    );
    top.position.y = 0.8;
    table.add(top);

    // 4 条腿
    for (let i = 0; i < 4; i++) {
      const x = (i % 2 === 0 ? -1 : 1) * 0.6;
      const z = (i < 2 ? -1 : 1) * 0.28;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.8, 6), darkWoodMat
      );
      leg.position.set(x, 0.4, z);
      table.add(leg);
    }

    // 横梁(2 根,稳固)
    for (const z of [-0.28, 0.28]) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.04, 0.04), darkWoodMat
      );
      beam.position.set(0, 0.3, z);
      table.add(beam);
    }

    // 桌上一卷竹简
    const scroll = this._makeScroll();
    scroll.position.set(-0.35, 0.88, 0.05);
    scroll.rotation.set(0, 0.3, Math.PI / 2);
    table.add(scroll);

    // 桌上一个葫芦
    const gourd = this._makeGourd(1.2);
    gourd.position.set(0.3, 0.86, -0.15);
    table.add(gourd);

    // 桌上一个小碗(放药的碗)
    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6),
      new THREE.MeshStandardMaterial({
        color: 0x4a3a2a, roughness: 0.5, side: THREE.DoubleSide
      })
    );
    bowl.position.set(0.05, 0.84, 0.18);
    bowl.rotation.x = Math.PI;
    table.add(bowl);

    // 位置:丹炉左前方(从相机看是右侧)
    table.position.set(-2.5, 0, 1.5);
    table.rotation.y = Math.PI / 2;
    this.group.add(table);
  }

  /** 竹简(细长圆柱 + 红色封条) */
  _makeScroll() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.4, 10),
      new THREE.MeshStandardMaterial({ color: 0xd4c89a, roughness: 0.95 })
    );
    body.rotation.z = Math.PI / 2;
    g.add(body);

    // 两端封条
    for (const x of [-0.21, 0.21]) {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10),
        new THREE.MeshStandardMaterial({ color: 0x8b2a1a, roughness: 0.7 })
      );
      cap.rotation.z = Math.PI / 2;
      cap.position.x = x;
      g.add(cap);
    }
    return g;
  }

  /** 葫芦(经典修仙容器) */
  _makeGourd(scale = 1) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9a6a3a, roughness: 0.6, flatShading: true
    });
    // 上半(小)
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat);
    top.position.y = 0.10;
    g.add(top);
    // 下半(大)
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), mat);
    bottom.position.y = -0.06;
    g.add(bottom);
    // 收腰
    const waist = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.04, 10),
      mat
    );
    waist.position.y = 0.02;
    g.add(waist);
    // 顶上藤
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.015, 0.1, 4),
      new THREE.MeshStandardMaterial({ color: 0x3a2a18 })
    );
    stem.position.y = 0.22;
    g.add(stem);

    g.scale.setScalar(scale);
    return g;
  }

  // ============================================================
  // 5. 书架
  // ============================================================
  _buildShelf() {
    const shelf = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x4a2f1a, roughness: 0.9, flatShading: true
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a0a, roughness: 0.95
    });

    // 主体 Box(实心)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 2.0, 0.4), woodMat
    );
    body.position.y = 1.0;
    shelf.add(body);

    // 3 层隔板(亮色细条,贴前面)
    for (let i = 0; i < 3; i++) {
      const divider = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.05, 0.42),
        darkMat
      );
      divider.position.y = 0.35 + i * 0.65;
      shelf.add(divider);
    }

    // 几本"书"(立着)
    const bookColors = [0x6b3020, 0x3a4a2a, 0x5a3a18, 0x2a3a4a, 0x6a4a2a];
    for (let row = 0; row < 3; row++) {
      const y = 0.45 + row * 0.65;
      const xStart = -0.6;
      let xCur = xStart;
      while (xCur < 0.6) {
        if (Math.random() < 0.3) {
          xCur += 0.1;  // 跳过(空格)
          continue;
        }
        const w = 0.06 + Math.random() * 0.04;
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(w, 0.24, 0.18),
          new THREE.MeshStandardMaterial({
            color: bookColors[Math.floor(Math.random() * bookColors.length)],
            roughness: 0.85
          })
        );
        book.position.set(xCur + w / 2, y, 0.05);
        book.rotation.y = (Math.random() - 0.5) * 0.15;
        shelf.add(book);
        xCur += w + 0.02;
      }
    }

    // 顶层放几个葫芦
    for (let i = 0; i < 2; i++) {
      const g = this._makeGourd(1.3);
      g.position.set(-0.4 + i * 0.7, 1.85, 0.1);
      shelf.add(g);
    }

    // 挂一张符箓(红色纸)
    const talisman = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.28),
      new THREE.MeshStandardMaterial({
        color: 0xc8462e, roughness: 0.9, side: THREE.DoubleSide
      })
    );
    talisman.position.set(0.7, 1.6, 0.21);
    shelf.add(talisman);
    // 符文线条
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 0.012),
        new THREE.MeshStandardMaterial({
          color: 0x1a0a0a, side: THREE.DoubleSide
        })
      );
      line.position.set(0.7, 1.65 - i * 0.045, 0.22);
      shelf.add(line);
    }

    // 位置:丹炉后方靠墙
    shelf.position.set(0, 0, -3.5);
    this.group.add(shelf);
  }

  // ============================================================
  // 6. 陶罐(3 个角落)
  // ============================================================
  _buildPots() {
    const configs = [
      { x: -3.0, z: 2.5, scale: 1.2, color: 0x6b4020 },
      { x: 3.0, z: -2.5, scale: 0.9, color: 0x5a3a1a },
      { x: -3.5, z: -1.5, scale: 1.0, color: 0x7a5028 }
    ];

    for (const cfg of configs) {
      const pot = this._makePot(cfg.color, cfg.scale);
      pot.position.set(cfg.x, 0, cfg.z);
      this.group.add(pot);
    }
  }

  _makePot(color, scale) {
    const pot = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.85, flatShading: true
    });

    // 罐底
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.04, 8), mat
    );
    base.position.y = 0.02;
    pot.add(base);

    // 罐身(中间鼓)
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.7),
      mat
    );
    body.position.y = 0.16;
    pot.add(body);

    // 罐口
    const mouth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.20, 0.05, 8), mat
    );
    mouth.position.y = 0.34;
    pot.add(mouth);

    pot.scale.setScalar(scale);
    return pot;
  }

  // ============================================================
  // 7. 烛台(2 盏,发暖色点光)
  // ============================================================
  _buildCandleStands() {
    const positions = [
      { x: -2.0, z: -0.5 },
      { x: 1.5, z: 2.0 }
    ];

    for (let i = 0; i < positions.length; i++) {
      const cfg = positions[i];
      const candle = this._makeCandle();
      candle.group.position.set(cfg.x, 0, cfg.z);
      this.group.add(candle.group);
      this._lights.push({
        light: candle.light,
        flameMat: candle.flameMat,
        baseIntensity: 0.4,
        phase: i * 2.0
      });
    }
  }

  _makeCandle() {
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x8a6a3a, roughness: 0.4, metalness: 0.7
    });

    // 底座
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.18, 0.05, 6), metalMat
    );
    base.position.y = 0.025;
    group.add(base);

    // 杆
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6), metalMat
    );
    pole.position.y = 0.25;
    group.add(pole);

    // 顶盘
    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.06, 0.02, 8), metalMat
    );
    dish.position.y = 0.46;
    group.add(dish);

    // 蜡烛
    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.18, 8),
      new THREE.MeshStandardMaterial({ color: 0xeed8a8, roughness: 0.9 })
    );
    candle.position.y = 0.56;
    group.add(candle);

    // 烛焰
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffaa44, transparent: true, opacity: 0.9
    });
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 6), flameMat
    );
    flame.position.y = 0.68;
    flame.scale.set(1, 1.6, 1);
    group.add(flame);

    // 烛光点光源
    const light = new THREE.PointLight(0xffaa55, 0.4, 4.5, 1.8);
    light.position.y = 0.68;
    group.add(light);

    return { group, light, flameMat };
  }

  // ============================================================
  // 主循环:烛光摇曳
  // ============================================================
  update(dt) {
    this._t += dt;
    for (const item of this._lights) {
      const flicker = Math.sin(this._t * 8 + item.phase) * 0.15;
      const jitter = (Math.random() - 0.5) * 0.1;
      item.light.intensity = item.baseIntensity + flicker + jitter;
      if (item.flameMat) {
        item.flameMat.opacity = 0.85 + Math.sin(this._t * 12 + item.phase) * 0.1;
      }
    }
  }
}
