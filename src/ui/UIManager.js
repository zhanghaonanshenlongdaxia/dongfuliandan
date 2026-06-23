// ============================================================
// ui/UIManager.js — DOM 面板管理
// 职责:
//   1. 渲染 4 个面板(丹方簿/原料栏/炉况/收丹)
//   2. 绑定按钮事件 -> 调用状态机 + 库存
//   3. 订阅状态机事件 -> 更新 DOM
// ============================================================

import { RECIPES } from '../data/recipes.js';
import { INGREDIENTS, INGREDIENT_MAP } from '../data/ingredients.js';
import { EVENTS, STATES } from '../core/RefineStateMachine.js';

export class UIManager {
  /**
   * @param {RefineStateMachine} sm
   * @param {Inventory} inventory
   */
  constructor(sm, inventory) {
    this.sm = sm;
    this.inv = inventory;
    this.selectedRecipeId = null;

    // 缓存 DOM 引用
    this.$ = {
      recipeList: document.getElementById('recipe-list'),
      ingGrid: document.getElementById('ingredients-grid'),
      stateText: document.getElementById('state-text'),
      progressWrap: document.getElementById('progress-wrap'),
      progressFill: document.getElementById('progress-fill'),
      progressTime: document.getElementById('progress-time'),
      addedChips: document.getElementById('added-chips'),
      btnStart: document.getElementById('btn-start'),
      btnReset: document.getElementById('btn-reset'),
      resultPanel: document.getElementById('result-panel'),
      resultTitle: document.getElementById('result-title'),
      resultBody: document.getElementById('result-body'),
      btnCollect: document.getElementById('btn-collect'),
      pillsList: document.getElementById('pills-list')
    };

    this._renderRecipes();
    this._renderIngredients();
    this._bindEvents();
    this._bindStateMachine();
    this._updateAddedChips();
    this._updatePillsBar();
  }

  // ---------- 渲染 ----------

  _renderRecipes() {
    this.$.recipeList.innerHTML = RECIPES.map(r => `
      <div class="recipe-card" data-recipe-id="${r.id}">
        <div class="recipe-name">
          ${r.name}
          <span class="recipe-pill-swatch" style="color:#${r.pill.color.toString(16).padStart(6, '0')}; background:#${r.pill.color.toString(16).padStart(6, '0')};"></span>
        </div>
        <div class="recipe-desc">${r.desc}</div>
        <div class="recipe-meta">
          配方: ${r.ingredients.map(id => INGREDIENT_MAP[id]?.name ?? id).join(' + ')}
          · ${r.duration}s · 成功率 ${(r.successRate * 100).toFixed(0)}%
        </div>
      </div>
    `).join('');

    // 点击丹方卡 = 选定 targetRecipe
    this.$.recipeList.querySelectorAll('.recipe-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.recipeId;
        if (this.sm.state === STATES.REFINING) return;
        this.selectedRecipeId = id;
        this.sm.selectTargetRecipe(id);
        this.$.recipeList.querySelectorAll('.recipe-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });
  }

  _renderIngredients() {
    this.$.ingGrid.innerHTML = INGREDIENTS.map(i => {
      const colorHex = '#' + i.color.toString(16).padStart(6, '0');
      return `
        <button class="ingredient-btn" data-ing-id="${i.id}" title="${i.desc}">
          <span class="ingredient-swatch" style="color:${colorHex}; background:${colorHex};"></span>
          <span>${i.name}</span>
          <span class="ingredient-count" id="count-${i.id}">${this.inv.count(i.id)}</span>
        </button>
      `;
    }).join('');

    this.$.ingGrid.querySelectorAll('.ingredient-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.ingId;
        // 校验:状态 + 库存
        if (!this.sm.canAddIngredient()) return;
        if (this.inv.count(id) <= 0) return;
        // 消耗库存
        this.inv.take(id);
        // 加入炉中
        this.sm.addIngredient(id);
        // 刷新库存数字
        this._updateIngredientCount(id);
        this._updateAddedChips();
        this._updateStartButton();
      });
    });
  }

  _updateIngredientCount(id) {
    const el = document.getElementById(`count-${id}`);
    if (el) el.textContent = this.inv.count(id);
  }

  _updateAllIngredientCounts() {
    INGREDIENTS.forEach(i => this._updateIngredientCount(i.id));
  }

  _updateAddedChips() {
    const ids = this.sm.addedIngredients;
    this.$.addedChips.innerHTML = ids.map(id => {
      const ing = INGREDIENT_MAP[id];
      if (!ing) return '';
      const c = '#' + ing.color.toString(16).padStart(6, '0');
      return `<span class="chip"><span class="chip-swatch" style="color:${c}; background:${c};"></span>${ing.name}</span>`;
    }).join('');
  }

  _updateStartButton() {
    this.$.btnStart.disabled = !this.sm.canStart();
  }

  _updatePillsBar() {
    if (this.inv.pills.length === 0) {
      this.$.pillsList.innerHTML = '<span style="color: var(--text-dim); font-size: 12px;">尚无</span>';
      return;
    }
    this.$.pillsList.innerHTML = this.inv.pills.map(p => {
      const c = '#' + p.color.toString(16).padStart(6, '0');
      return `<span class="chip" title="${p.effect}"><span class="chip-swatch" style="color:${c}; background:${c};"></span>${p.name}</span>`;
    }).join('');
  }

  // ---------- 事件绑定 ----------

  _bindEvents() {
    this.$.btnStart.addEventListener('click', () => {
      this.sm.startRefining();
    });

    this.$.btnReset.addEventListener('click', () => {
      // 把已消耗的原料退回库存
      this.sm.addedIngredients.forEach(id => this.inv.add(id));
      this.sm.reset();
      this._updateAllIngredientCounts();
      this._updateAddedChips();
      this._updateStartButton();
    });

    this.$.btnCollect.addEventListener('click', () => {
      // 在状态机重置 lastResult 之前先把丹药收进库存
      const result = this.sm.lastResult;
      if (result) {
        this.inv.collectPill({
          recipeId: result.id,
          name: result.pill.name,
          color: result.pill.color,
          effect: result.pill.effect
        });
      }
      this.sm.collectPill();
      this._updatePillsBar();
    });
  }

  // ---------- 订阅状态机 ----------

  _bindStateMachine() {
    this.sm.on(EVENTS.STATE_CHANGE, ({ to }) => {
      this._onStateChange(to);
    });

    this.sm.on(EVENTS.PROGRESS, ({ timeLeft, totalTime, progress }) => {
      this.$.progressFill.style.width = (progress * 100).toFixed(1) + '%';
      this.$.progressTime.textContent = `${timeLeft.toFixed(1)}s / ${totalTime.toFixed(1)}s`;
    });

    this.sm.on(EVENTS.SUCCESS, ({ recipe }) => {
      this._showResult(recipe, true);
    });

    this.sm.on(EVENTS.FAIL, ({ recipe, reason }) => {
      this._showResult(recipe, false, reason);
    });
  }

  _onStateChange(to) {
    // 状态文字
    const textMap = {
      [STATES.IDLE]: '待开炉',
      [STATES.ADDING]: '加料中',
      [STATES.REFINING]: '炼制中',
      [STATES.SUCCESS]: '已成丹',
      [STATES.FAIL]: '炸炉'
    };
    this.$.stateText.textContent = textMap[to] || to;
    this.$.stateText.className = '';
    this.$.stateText.classList.add('state-' + to.toLowerCase());

    // 进度条显隐
    if (to === STATES.REFINING) {
      this.$.progressWrap.classList.remove('hidden');
    } else {
      this.$.progressWrap.classList.add('hidden');
    }

    // 收丹结果显隐
    if (to === STATES.SUCCESS || to === STATES.FAIL) {
      // 由 _showResult 控制
    } else {
      this.$.resultPanel.classList.add('hidden');
    }

    // 按钮状态
    this._updateStartButton();
    this.$.btnReset.disabled = (to === STATES.REFINING);

    // 收丹 / 炸炉 重置后,清空已加原料 chips
    if (to === STATES.IDLE) {
      this._updateAddedChips();
      this._updateAllIngredientCounts();
    }

    // 原料按钮启用/禁用
    this.$.ingGrid.querySelectorAll('.ingredient-btn').forEach(btn => {
      btn.disabled = !this.sm.canAddIngredient();
    });
  }

  _showResult(recipe, isSuccess, reason) {
    this.$.resultPanel.classList.remove('hidden');
    if (isSuccess && recipe) {
      this.$.resultTitle.textContent = '成丹 · ' + recipe.pill.name;
      const c = '#' + recipe.pill.color.toString(16).padStart(6, '0');
      this.$.resultBody.innerHTML = `
        <div>
          <span class="pill-swatch" style="color:${c}; background:${c};"></span>
          <strong style="color: var(--gold);">${recipe.pill.name}</strong>
        </div>
        <div style="color: var(--text-dim); margin-top: 4px;">效果: ${recipe.pill.effect}</div>
      `;
      this.$.btnCollect.classList.remove('hidden');
    } else {
      this.$.resultTitle.textContent = '炸炉';
      this.$.resultBody.innerHTML = `
        <div style="color: var(--danger); font-weight: bold;">炉火失控!</div>
        <div style="color: var(--text-dim); margin-top: 4px;">原因: ${reason ?? '未知'}</div>
        <div style="color: var(--text-dim); margin-top: 4px;">原料已损耗,请重新配伍。</div>
      `;
      // 1.5s 后自动隐藏 + 回 IDLE
      this.$.btnCollect.classList.add('hidden');
      setTimeout(() => {
        this.$.resultPanel.classList.add('hidden');
        // 自动重置(已损耗的原料不退回)
        this.sm.reset();
        this._updateAddedChips();
        this._updateStartButton();
        this._updatePillsBar();
      }, 1500);
    }
  }

  // 供 main.js 在 SUCCESS 后实际收取时调用
  onPillCollected() {
    this._updatePillsBar();
  }
}
