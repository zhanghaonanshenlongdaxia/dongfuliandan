// ============================================================
// data/ingredients/2d/CodexPanel.js — 2D 药材图鉴(书样式 v2)
//
// 设计:
//   - 摊开的书,左页大图(原图自然比例),右页文字详情
//   - 顶部一行工具栏:[图鉴标题] [翻页] [页码] [关闭]
//   - 图片框:内边距 + 限最大尺寸 + object-fit contain 不裁切
// ============================================================

import { INGREDIENTS, GRADES, GRADE_MAP, TIERS } from '../index.js';
import { drawOnCanvas, setStyle as setCanvasStyle } from './canvasIcon.js';

export class CodexPanel {
  constructor({ onSelect, onClose, onRegen } = {}) {
    this.onSelect = onSelect;
    this.onClose = onClose;
    this.onRegen = onRegen;

    this._pageIndex = 0;
    this._totalPages = Math.max(INGREDIENTS.length, 1);

    this._build();
  }

  _build() {
    this.root = document.createElement('div');
    this.root.className = 'codex-panel hidden';
    this.root.innerHTML = `
      <div class="codex-mask"></div>
      <div class="codex-book">
        <header class="codex-header">
          <h2>📚 药材图鉴</h2>
          <div class="codex-header-right">
            <button class="codex-btn codex-btn-prev" type="button" title="上一页 (←)">◀</button>
            <span class="codex-page-no" id="codex-page-no">1 / 1</span>
            <button class="codex-btn codex-btn-next" type="button" title="下一页 (→)">▶</button>
            <button class="codex-close" type="button" title="关闭 (Esc)">✕</button>
          </div>
        </header>

        <div class="codex-page" id="codex-page"></div>
      </div>
    `;
    document.body.appendChild(this.root);

    // 事件
    this.root.querySelector('.codex-mask').addEventListener('click', () => this.hide());
    this.root.querySelector('.codex-close').addEventListener('click', () => this.hide());
    this.root.querySelector('.codex-btn-prev').addEventListener('click', () => this._flip(-1));
    this.root.querySelector('.codex-btn-next').addEventListener('click', () => this._flip(1));

    // 事件委托:点击图片或 3D 按钮 → 打开 3D 预览
    // 用委托避免 _renderPage 重新创建元素后丢失 handler
    this.root.querySelector('#codex-page').addEventListener('click', (e) => {
      // 检查点中的元素是否在 .page-image-wrap 或 .page-btn-3d 内
      const inImage = e.target.closest('.page-image-wrap');
      const in3dBtn = e.target.closest('.page-btn-3d');
      if (inImage || in3dBtn) {
        e.stopPropagation();
        const ing = INGREDIENTS[this._pageIndex];
        if (ing && this.onSelect) {
          console.log('[Codex] 打开 3D 预览:', ing.id);
          this.onSelect(ing.id);
        }
      }
    });

    // 键盘翻页
    this._keyHandler = (e) => {
      if (this.root.classList.contains('hidden')) return;
      if (e.key === 'ArrowLeft') this._flip(-1);
      if (e.key === 'ArrowRight') this._flip(1);
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this._keyHandler);

    this._renderPage();
  }

  _flip(direction) {
    const newIndex = this._pageIndex + direction;
    if (newIndex < 0 || newIndex >= this._totalPages) return;

    const pageEl = this.root.querySelector('#codex-page');
    pageEl.classList.add('flipping');
    setTimeout(() => {
      this._pageIndex = newIndex;
      this._renderPage();
      pageEl.classList.remove('flipping');
    }, 180);
  }

  _renderPage() {
    const ing = INGREDIENTS[this._pageIndex];
    if (!ing) {
      this.root.querySelector('#codex-page').innerHTML = '<div class="empty-page">图鉴暂无内容</div>';
      return;
    }
    const g = GRADE_MAP[ing.grade];
    const tierClass = `tier-${g.tier.key}`;

    // 图片(原图优先,否则 canvas 画)
    const imagePart = ing.image
      ? `<img class="page-image" src="${ing.image}" alt="${ing.name}" />`
      : `<canvas class="page-image-canvas" width="320" height="320"></canvas>`;

    const swatch = (hex) => {
      const c = '#' + hex.toString(16).padStart(6, '0');
      return `<span class="page-swatch" style="background:${c}; box-shadow: 0 0 8px ${c};"></span>`;
    };

    const gradeBar = Array.from({ length: 9 }, (_, i) =>
      `<span class="grade-mark ${i + 1 <= ing.grade ? 'on' : ''}"></span>`
    ).join('');

    const typeLabel = { plant: '植物', mineral: '矿物', liquid: '液体' }[ing.type];

    this.root.querySelector('#codex-page').innerHTML = `
      <div class="page-left ${tierClass}">
        <div class="page-image-frame">
          <div class="page-image-wrap">${imagePart}</div>
          <div class="page-image-hint">点击图片查看 3D 预览</div>
        </div>
        <div class="page-tier-badge">${g.tier.short}品 · ${g.tierName}</div>
      </div>
      <div class="page-spine"></div>
      <div class="page-right">
        <h3 class="page-name">${ing.name}</h3>
        <div class="page-meta">
          <div class="meta-row"><span class="meta-label">品阶</span><span class="meta-value">${g.name} · ${g.tierName}</span></div>
          <div class="meta-row"><span class="meta-label">类型</span><span class="meta-value">${typeLabel}</span></div>
          <div class="meta-row"><span class="meta-label">主色</span><span class="meta-value page-color-row">${swatch(ing.colorHex)}</span></div>
          <div class="meta-row"><span class="meta-label">副色</span><span class="meta-value page-color-row">${swatch(ing.accentHex)}</span></div>
        </div>
        <p class="page-desc">${ing.description}</p>
        <div class="page-grade-row">
          <span class="meta-label">品阶刻度</span>
          <div class="page-grade-bar">${gradeBar}</div>
        </div>
        <div class="page-actions">
          ${ing.image ? '' : '<button class="page-btn-regen" type="button">🎲 重画</button>'}
          <button class="page-btn-3d" type="button">👁 3D 预览</button>
        </div>
      </div>
    `;

    // 重画 canvas(对没有原图的)
    const canvas = this.root.querySelector('canvas.page-image-canvas');
    if (canvas) {
      drawOnCanvas(canvas, ing, Math.floor(Math.random() * 99999));
    }

    // 重画按钮(单独的 click,事件委托不会拦到)
    const regenBtn = this.root.querySelector('.page-btn-regen');
    if (regenBtn) {
      regenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const seed = Math.floor(Math.random() * 99999);
        drawOnCanvas(canvas, ing, seed);
        if (this.onRegen) this.onRegen(ing.id);
      });
    }

    // 更新页码
    this.root.querySelector('#codex-page-no').textContent =
      `${this._pageIndex + 1} / ${this._totalPages}`;

    // 翻页按钮禁用状态
    this.root.querySelector('.codex-btn-prev').disabled = (this._pageIndex === 0);
    this.root.querySelector('.codex-btn-next').disabled = (this._pageIndex === this._totalPages - 1);
  }

  show() { this.root.classList.remove('hidden'); this._renderPage(); }
  hide() { this.root.classList.add('hidden'); if (this.onClose) this.onClose(); }
  toggle() { this.root.classList.toggle('hidden'); this._renderPage(); }
}
