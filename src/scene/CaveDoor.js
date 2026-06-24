// ============================================================
// scene/CaveDoor.js — 山洞大门
//
// 双扇木门 + 装饰门框 + 门钉 + 门环
// 默认:半开(可以走进走出)
// 可以用 open()/close() 切换
// ============================================================

import * as THREE from 'three';

const DOOR_W = 1.5;    // 单扇门宽
const DOOR_H = 3.2;    // 门高
const DOOR_T = 0.12;   // 门厚
const FRAME_T = 0.25;  // 门框厚

export class CaveDoor {
  /**
   * @param {Object} opts
   * @param {THREE.Vector3} opts.position 门框中心点
   * @param {THREE.Vector3} opts.lookOut  朝外的方向(单位向量)
   * @param {number} [opts.openAngle=0.6] 默认打开角度(弧度)
   */
  constructor({ position, lookOut, openAngle = 0.6 } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'CaveDoor';

    position = position || new THREE.Vector3(0, 0, 0);
    lookOut = (lookOut || new THREE.Vector3(0, 0, 1)).normalize();

    this.openAngle = openAngle;
    this._targetAngle = openAngle;
    this._currentAngle = openAngle;

    this.group.position.copy(position);

    // 让整组朝向门外
    const yaw = Math.atan2(lookOut.x, lookOut.z);
    this.group.rotation.y = yaw;

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x3a2418,
      roughness: 0.85,
      metalness: 0.1
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
      color: 0x1a0e08,
      roughness: 0.9
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x9a7a3a,
      roughness: 0.4,
      metalness: 0.85
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x6a5a48,
      roughness: 0.95
    });

    // ============= 门框(石质) =============
    // 顶梁
    const topBeam = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_W * 2 + FRAME_T * 2, 0.4, FRAME_T),
      stoneMat
    );
    topBeam.position.set(0, DOOR_H + 0.2, 0);
    this.group.add(topBeam);

    // 左右门柱
    for (const sign of [-1, 1]) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(FRAME_T, DOOR_H + 0.4, FRAME_T),
        stoneMat
      );
      pillar.position.set(sign * (DOOR_W + FRAME_T / 2), (DOOR_H + 0.4) / 2, 0);
      this.group.add(pillar);
    }

    // 门框装饰(顶部横匾)
    const plaque = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_W * 1.6, 0.25, 0.05),
      new THREE.MeshStandardMaterial({
        color: 0x1a0e08,
        roughness: 0.7,
        metalness: 0.2,
        emissive: 0x3a1a08,
        emissiveIntensity: 0.3
      })
    );
    plaque.position.set(0, DOOR_H + 0.42, 0.08);
    this.group.add(plaque);

    // 匾额上的字(用细线表示)
    for (let i = 0; i < 2; i++) {
      const char = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.01),
        new THREE.MeshBasicMaterial({ color: 0xd4af37 })
      );
      char.position.set(-0.2 + i * 0.4, DOOR_H + 0.42, 0.12);
      this.group.add(char);
    }

    // ============= 门扇(双开) =============
    this.leftDoor = this._buildDoorPanel(woodMat, darkWoodMat, metalMat, -1);
    this.rightDoor = this._buildDoorPanel(woodMat, darkWoodMat, metalMat, 1);
    this.group.add(this.leftDoor);
    this.group.add(this.rightDoor);

    // 门轴位置(在门框边缘)
    // 左门轴 x = -DOOR_W, 右门轴 x = +DOOR_W
    // 默认:两扇门向外开
    this.leftDoor.position.set(-DOOR_W, DOOR_H / 2, 0);
    this.rightDoor.position.set(DOOR_W, DOOR_H / 2, 0);

    // 门内可看到的一点光(从门内透出)
    const innerGlow = new THREE.PointLight(0xffaa66, 1.5, 8, 1.8);
    innerGlow.position.set(0, DOOR_H / 2, -0.5);
    this.group.add(innerGlow);
  }

  _buildDoorPanel(woodMat, darkWoodMat, metalMat, sign) {
    // 门板本体
    const panel = new THREE.Group();

    // 主体
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_W, DOOR_H, DOOR_T),
      woodMat
    );
    panel.add(body);

    // 上下两条横档(深色)
    for (const ySign of [-1, 1]) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(DOOR_W * 0.95, 0.12, DOOR_T * 1.1),
        darkWoodMat
      );
      bar.position.set(0, ySign * (DOOR_H / 2 - 0.15), 0);
      panel.add(bar);
    }

    // 门钉(横 4 排,每排 3 个)
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const stud = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 6, 4),
          metalMat
        );
        const yPos = (row - 1.5) * (DOOR_H / 5);
        const xPos = (col - 1) * (DOOR_W * 0.35);
        stud.position.set(xPos, yPos, DOOR_T / 2 + 0.02);
        panel.add(stud);
      }
    }

    // 门环(两个)
    for (const ySign of [-1, 1]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.04, 6, 16),
        metalMat
      );
      ring.position.set(sign * 0.2, ySign * 0.5, DOOR_T / 2 + 0.06);
      panel.add(ring);
    }

    return panel;
  }

  open(angle = 1.2) { this._targetAngle = angle; }
  close() { this._targetAngle = 0; }

  tick(dt) {
    // 平滑插值到目标角度
    const k = 1 - Math.exp(-dt * 3);
    this._currentAngle += (this._targetAngle - this._currentAngle) * k;
    // 左门往 -Z(内)开,右门往 +Z(内)开
    // 但用 lookOut 方向:门向内开
    this.leftDoor.rotation.y =  this._currentAngle;   // 左门向外旋转
    this.rightDoor.rotation.y = -this._currentAngle;
  }
}
