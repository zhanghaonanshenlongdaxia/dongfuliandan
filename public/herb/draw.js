// ============================================================
// public/herb/draw.js — 垂藤草 canvas 程序复刻
// 用确定性随机数(seeded)画出"飘下来的藤蔓"叶簇
//
// 关键技法:
//   - 贝塞尔曲线画弯曲藤蔓
//   - 多层透明叠加 = 水彩晕染感
//   - 同一片叶子用 2-3 个 ellipse 叠出厚度
//   - 颜色按"藤蔓位置"渐变:顶端深青 → 中段浅绿 → 末梢橙红
// ============================================================

const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ----- 种子随机数(确定性,同一 seed 同一结果) -----
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let SEED = 1;
let STYLE = 'watercolor';  // 'watercolor' | 'ink' | 'glow'

// ============================================================
// 主绘制
// ============================================================
function draw(rng) {
  // 清空 + 渐变背景(模拟原图深青)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#2d6868');
  bg.addColorStop(1, '#1a4a4a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 主藤:从顶部中心向下蜿蜒
  const mainVine = makeMainVine(rng);
  drawVinePath(ctx, mainVine, '#0d2828', 2.5);

  // 5-7 条分支藤
  const branchCount = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < branchCount; i++) {
    const t = 0.08 + (i / branchCount) * 0.7;  // 主藤上的归一化位置
    const startPoint = sampleCurve(mainVine, t);
    const branch = makeBranchVine(startPoint, rng);
    drawVinePath(ctx, branch, '#0d2828', 1.8);
    // 在分支上挂 2-4 片叶子
    const leafCount = 2 + Math.floor(rng() * 3);
    for (let j = 0; j < leafCount; j++) {
      const lt = 0.2 + (j / leafCount) * 0.7;
      const p = sampleCurve(branch, lt);
      const dir = branch.directionAt(lt);
      const colorT = (t + lt * 0.5);  // 决定颜色(越高越深)
      drawLeaf(ctx, p.x, p.y, dir, colorT, rng);
    }
    // 分支末端再挂一片
    const endP = sampleCurve(branch, 1);
    const endDir = branch.directionAt(1);
    drawLeaf(ctx, endP.x, endP.y, endDir, 0.8 + rng() * 0.4, rng);
  }

  // 顶部聚集叶(原图最上方深色叶团)
  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI / 2 + (rng() - 0.5) * 0.8;
    const r = 20 + rng() * 40;
    const x = W / 2 + Math.cos(angle) * r;
    const y = 10 + Math.sin(angle) * r * 0.3 + rng() * 30;
    drawLeaf(ctx, x, y, { x: rng() - 0.5, y: 1 }, 0, rng);
  }
}

// ============================================================
// 路径:贝塞尔曲线串成藤蔓
// ============================================================
function makeMainVine(rng) {
  const pts = [];
  const startX = W / 2;
  let curY = 0;
  let curX = startX;
  // 随机选择几个控制点,让藤蔓整体走"S"形
  const numControl = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < numControl; i++) {
    const nextY = curY + H / numControl * (0.6 + rng() * 0.6);
    const nextX = curX + (rng() - 0.5) * 80;
    pts.push({ x: nextX, y: nextY });
    curX = nextX;
    curY = nextY;
  }
  return makeBezierCurve(pts);
}

function makeBranchVine(start, rng) {
  // 从起点向一侧斜下方延伸
  const dir = rng() > 0.5 ? 1 : -1;
  const length = 50 + rng() * 80;
  const drop = length * (0.6 + rng() * 0.4);
  const pts = [
    { x: start.x + dir * 10, y: start.y + 10 },
    { x: start.x + dir * length * 0.5, y: start.y + drop * 0.5 + (rng() - 0.5) * 20 },
    { x: start.x + dir * length, y: start.y + drop }
  ];
  return makeBezierCurve(pts);
}

function makeBezierCurve(pts) {
  // 用 Catmull-Rom 风格的二次贝塞尔串
  const segments = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? i : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    // 计算控制点
    const cp1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const cp2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    segments.push({ p1, cp1, cp2, p2 });
  }
  return {
    segments,
    directionAt(t) {
      // 求 t 处的切向
      const segIdx = Math.min(Math.floor(t * segments.length), segments.length - 1);
      const localT = t * segments.length - segIdx;
      const s = segments[segIdx];
      // 二次贝塞尔切线
      const mt = 1 - localT;
      const dx = 2 * (mt * (s.cp1.x - s.p1.x) + localT * (s.p2.x - s.cp1.x));
      const dy = 2 * (mt * (s.cp1.y - s.p1.y) + localT * (s.p2.y - s.cp1.y));
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

// ============================================================
// 叶子:多椭圆叠加,水彩晕染
// ============================================================
function drawLeaf(ctx, x, y, dir, colorT, rng) {
  // 颜色按 colorT (0=顶端深青 → 1=末梢橙红)
  const colors = pickLeafColor(colorT, rng);
  const size = 14 + rng() * 14;
  // 椭圆旋转角度(垂直于藤蔓方向)
  const angle = Math.atan2(dir.y, dir.x) + Math.PI / 2;
  const tilt = (rng() - 0.5) * 0.5;  // 随机倾斜

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + tilt);
  ctx.scale(1, 1.6 + rng() * 0.4);  // 叶子比椭球更细长

  // 1. 半透明外圈(晕染)
  if (STYLE === 'watercolor' || STYLE === 'glow') {
    ctx.fillStyle = colors.outer;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 1.2, size * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. 主叶身
  ctx.fillStyle = colors.fill;
  ctx.globalAlpha = STYLE === 'ink' ? 0.9 : 0.85;
  ctx.beginPath();
  ctx.ellipse(0, 0, size, size * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3. 高光(水彩光泽)
  if (STYLE !== 'ink') {
    ctx.fillStyle = colors.highlight;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.ellipse(-size * 0.2, -size * 0.1, size * 0.5, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. 叶脉(细线)
  ctx.strokeStyle = colors.vein;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.7);
  ctx.lineTo(0, size * 0.7);
  ctx.stroke();

  // 5. 描边
  if (STYLE === 'ink') {
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

function pickLeafColor(t, rng) {
  // t=0 → 顶端深青
  // t=0.5 → 中段浅绿
  // t=1 → 末梢橙红
  if (t < 0.4) {
    // 深青 → 浅绿过渡
    const k = t / 0.4;
    return {
      fill: lerpColor('#1a5050', '#5a9060', k),
      outer: lerpColor('#0d3838', '#3a6038', k),
      highlight: lerpColor('#3a7878', '#8ac890', k),
      vein: '#0d2828'
    };
  } else {
    // 浅绿 → 橙红过渡
    const k = (t - 0.4) / 0.6;
    return {
      fill: lerpColor('#5a9060', '#d46038', k),
      outer: lerpColor('#3a6038', '#8a3a18', k),
      highlight: lerpColor('#8ac890', '#f0a878', k),
      vein: '#5a2a18'
    };
  }
}

function lerpColor(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

// ============================================================
// 初始化 + 按钮
// ============================================================
function regen() {
  SEED = Math.floor(Math.random() * 10000);
  document.getElementById('seed-display').textContent = `seed: ${SEED}`;
  draw(mulberry32(SEED));
}

document.getElementById('btn-regen').addEventListener('click', regen);
document.getElementById('btn-stylize').addEventListener('click', () => {
  STYLE = STYLE === 'watercolor' ? 'ink' : STYLE === 'ink' ? 'glow' : 'watercolor';
  document.getElementById('btn-stylize').textContent =
    STYLE === 'watercolor' ? '🎨 改风格' : STYLE === 'ink' ? '🖌 改水墨' : '✨ 改辉光';
  draw(mulberry32(SEED));
});

regen();
