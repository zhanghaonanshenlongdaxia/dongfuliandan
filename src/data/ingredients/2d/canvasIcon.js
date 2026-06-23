// ============================================================
// data/ingredients/2d/canvasIcon.js — 画 canvas 图标
// 把 2D 复刻算法抽出来,供 codex 卡 / 图鉴 / 预览 复用
//
// 注意:九转还魂草/龙血神木/太乙金莲/星辰圣果 四个九品药材
// 用的是 AI 生成的真实图片和 GLB 模型,不需要 canvas 绘制
//
// 用法:
//   const canvas = document.querySelector('#icon');
//   drawOnCanvas(canvas, ingredient, seed);
// ============================================================

// 种子随机数
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 颜色插值
function lerpColor(c1, c2, t) {
  return '#' + [0, 1, 2].map(i => {
    const v = Math.round(c1[i] + (c2[i] - c1[i]) * t);
    return v.toString(16).padStart(2, '0');
  }).join('');
}
function hex2rgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

let CURRENT_STYLE = 'watercolor';  // 'watercolor' | 'ink' | 'glow'

export function setStyle(style) {
  CURRENT_STYLE = style;
}

// ============================================================
// 主调度
// ============================================================
export function drawOnCanvas(canvas, ingredient, seed = 1) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const id = ingredient.id || '';
  if (id === 'chui_teng_cao') {
    drawChuiTengCao(ctx, W, H, seed);
  } else {
    // fallback: 品阶色渐变背景 + 药材名
    const colorHex = ingredient.colorHex || '#5a9060';
    const grade = ingredient.grade || 1;
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
    bg.addColorStop(0, colorHex + '22');
    bg.addColorStop(0.5, grade <= 3 ? '#1a1a14' : grade <= 6 ? '#1a1420' : '#141020');
    bg.addColorStop(1, '#080808');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // 品阶标签
    ctx.fillStyle = colorHex;
    ctx.globalAlpha = 0.5;
    ctx.font = `${W * 0.06}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText(ingredient.name, W / 2, H * 0.55);
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// 垂藤草(canvas 主绘制)
// ============================================================
function drawChuiTengCao(ctx, W, H, seed) {
  const rng = mulberry32(seed);

  // 背景:深青渐变
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2d6868');
  bg.addColorStop(1, '#1a4a4a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 主藤
  const mainVine = makeMainVine(rng, W, H);
  drawVinePath(ctx, mainVine, '#0d2828', Math.max(1.5, W * 0.004));

  // 5-7 条分支
  const branchCount = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < branchCount; i++) {
    const t = 0.08 + (i / branchCount) * 0.7;
    const startPoint = sampleCurve(mainVine, t);
    const branch = makeBranchVine(startPoint, rng, W, H);
    drawVinePath(ctx, branch, '#0d2828', Math.max(1.2, W * 0.003));
    const leafCount = 3 + Math.floor(rng() * 3);
    for (let j = 0; j < leafCount; j++) {
      const lt = 0.2 + (j / leafCount) * 0.7;
      const p = sampleCurve(branch, lt);
      const dir = branch.directionAt(lt);
      const colorT = (t + lt * 0.5);
      drawLeaf(ctx, p.x, p.y, dir, colorT, rng, W);
    }
    const endP = sampleCurve(branch, 1);
    const endDir = branch.directionAt(1);
    drawLeaf(ctx, endP.x, endP.y, endDir, 0.8 + rng() * 0.3, rng, W);
  }

  // 顶部聚集叶
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (rng() - 0.5) * 0.8;
    const r = W * 0.06 + rng() * W * 0.12;
    const x = W / 2 + Math.cos(angle) * r;
    const y = W * 0.03 + Math.sin(angle) * r * 0.3 + rng() * H * 0.05;
    drawLeaf(ctx, x, y, { x: rng() - 0.5, y: 1 }, 0, rng, W);
  }
}

function makeMainVine(rng, W, H) {
  const pts = [];
  const startX = W / 2;
  let curY = 0;
  let curX = startX;
  const numControl = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < numControl; i++) {
    const nextY = curY + H / numControl * (0.6 + rng() * 0.6);
    const nextX = curX + (rng() - 0.5) * W * 0.25;
    pts.push({ x: nextX, y: nextY });
    curX = nextX;
    curY = nextY;
  }
  return makeBezierCurve(pts);
}

function makeBranchVine(start, rng, W, H) {
  const dir = rng() > 0.5 ? 1 : -1;
  const length = W * 0.15 + rng() * W * 0.25;
  const drop = length * (0.6 + rng() * 0.4);
  const pts = [
    { x: start.x + dir * W * 0.03, y: start.y + H * 0.015 },
    { x: start.x + dir * length * 0.5, y: start.y + drop * 0.5 + (rng() - 0.5) * H * 0.03 },
    { x: start.x + dir * length, y: start.y + drop }
  ];
  return makeBezierCurve(pts);
}

function makeBezierCurve(pts) {
  const segments = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? i : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const cp2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    segments.push({ p1, cp1, cp2, p2 });
  }
  return {
    segments,
    directionAt(t) {
      const segIdx = Math.min(Math.floor(t * segments.length), segments.length - 1);
      const localT = t * segments.length - segIdx;
      const s = segments[segIdx];
      const mt = 1 - localT;
      const dx = 2 * (mt * (s.cp1.x - s.p1.x) + localT * (s.cp2.x - s.cp1.x));
      const dy = 2 * (mt * (s.cp1.y - s.p1.y) + localT * (s.cp2.y - s.cp1.y));
      return { x: dx, y: dy };
    }
  };
}

function sampleCurve(curve, t) {
  const segIdx = Math.min(Math.floor(t * curve.segments.length), curve.segments.length - 1);
  const localT = t * curve.segments.length - segIdx;
  const s = curve.segments[segIdx];
  const mt = 1 - localT;
  const x = mt * mt * s.p1.x + 2 * mt * localT * s.cp1.x + localT * localT * s.p2.x;
  const y = mt * mt * s.p1.y + 2 * mt * localT * s.cp1.y + localT * localT * s.p2.y;
  return { x, y };
}

function drawVinePath(ctx, curve, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let t = 0; t <= 1; t += 0.02) {
    const p = sampleCurve(curve, t);
    if (t === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

function drawLeaf(ctx, x, y, dir, colorT, rng, W) {
  const colors = pickLeafColor(colorT);
  const size = W * 0.04 + rng() * W * 0.04;
  const angle = Math.atan2(dir.y, dir.x) + Math.PI / 2;
  const tilt = (rng() - 0.5) * 0.5;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + tilt);
  ctx.scale(1, 1.6 + rng() * 0.4);

  if (CURRENT_STYLE === 'watercolor' || CURRENT_STYLE === 'glow') {
    ctx.fillStyle = colors.outer;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.2, size * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = colors.fill;
  ctx.globalAlpha = CURRENT_STYLE === 'ink' ? 0.9 : 0.85;
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  if (CURRENT_STYLE !== 'ink') {
    ctx.fillStyle = colors.highlight;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(-size * 0.2, -size * 0.1, size * 0.5, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = colors.vein;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.7);
  ctx.lineTo(0, size * 0.7);
  ctx.stroke();

  if (CURRENT_STYLE === 'ink') {
    ctx.strokeStyle = '#0d2828';
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function pickLeafColor(t) {
  const top = hex2rgb('#1a5050');
  const mid = hex2rgb('#5a9060');
  const end = hex2rgb('#d46038');
  if (t < 0.5) {
    return {
      fill: lerpColor(top, mid, t * 2),
      outer: lerpColor(hex2rgb('#0d3838'), hex2rgb('#3a6038'), t * 2),
      highlight: lerpColor(hex2rgb('#3a7878'), hex2rgb('#8ac890'), t * 2),
      vein: '#0d2828'
    };
  } else {
    return {
      fill: lerpColor(mid, end, (t - 0.5) * 2),
      outer: lerpColor(hex2rgb('#3a6038'), hex2rgb('#8a3a18'), (t - 0.5) * 2),
      highlight: lerpColor(hex2rgb('#8ac890'), hex2rgb('#f0a878'), (t - 0.5) * 2),
      vein: '#5a2a18'
    };
  }
}
