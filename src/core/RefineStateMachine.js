// ============================================================
// core/RefineStateMachine.js — 炼丹状态机
//
// 状态:
//   IDLE      - 待开炉(可点原料开始)
//   ADDING    - 加料中(等待开炉)
//   REFINING  - 炼制中(倒计时)
//   SUCCESS   - 成丹(等待收取)
//   FAIL      - 炸炉(展示失败,自动回 IDLE)
//
// 事件订阅:on('stateChange'|'progress'|'success'|'fail', cb)
// UI 与场景只订阅事件,不互相 import,避免循环依赖
// ============================================================

import { matchRecipe, RECIPES } from '../data/recipes.js';
import { chance } from '../utils/rng.js';

export const STATES = Object.freeze({
  IDLE: 'IDLE',
  ADDING: 'ADDING',
  REFINING: 'REFINING',
  SUCCESS: 'SUCCESS',
  FAIL: 'FAIL'
});

export const EVENTS = Object.freeze({
  STATE_CHANGE: 'stateChange',
  PROGRESS: 'progress',
  SUCCESS: 'success',
  FAIL: 'fail',
  INGREDIENT_ADDED: 'ingredientAdded'   // 单独事件:加了一料(跟状态变化解耦)
});

export class RefineStateMachine {
  constructor() {
    this.state = STATES.IDLE;
    this.addedIngredients = [];   // 已加入的原料 id 列表
    this.targetRecipe = null;     // 玩家选定的丹方(可空)
    this.timeLeft = 0;            // REFINING 剩余秒数
    this.totalTime = 0;           // REFINING 总秒数(用于算进度)
    this.lastResult = null;       // 最近一次结果(recipe 或 null)
    this._listeners = new Map();  // event -> Set<callback>
  }

  // ---------- 事件订阅 ----------
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return this;
  }

  off(event, callback) {
    this._listeners.get(event)?.delete(callback);
    return this;
  }

  _emit(event, payload) {
    this._listeners.get(event)?.forEach(cb => {
      try { cb(payload); } catch (e) { console.error(`[SM] event ${event} error:`, e); }
    });
  }

  // ---------- 状态切换 ----------
  _setState(newState) {
    if (this.state === newState) return;
    const prev = this.state;
    this.state = newState;
    console.log(`[SM] ${prev} → ${newState}`);
    this._emit(EVENTS.STATE_CHANGE, { from: prev, to: newState });
  }

  // ---------- 玩家动作 ----------

  /** 加入一个原料(由 UI 按钮触发,需先校验库存) */
  addIngredient(ingredientId) {
    if (this.state !== STATES.IDLE && this.state !== STATES.ADDING) {
      console.warn(`[SM] 当前状态 ${this.state} 不允许加料`);
      return false;
    }
    if (this.addedIngredients.length >= 6) {
      console.warn('[SM] 原料已满');
      return false;
    }
    this.addedIngredients.push(ingredientId);
    if (this.state === STATES.IDLE) this._setState(STATES.ADDING);
    // 单独发加料事件,不要用 STATE_CHANGE(那个事件必须带 to/from)
    this._emit(EVENTS.INGREDIENT_ADDED, { id: ingredientId, total: this.addedIngredients.length });
    return true;
  }

  /** 移除最后一个加入的原料 */
  undoLastIngredient() {
    if (this.state !== STATES.ADDING) return false;
    if (this.addedIngredients.length === 0) return false;
    this.addedIngredients.pop();
    if (this.addedIngredients.length === 0) this._setState(STATES.IDLE);
    return true;
  }

  /** 玩家选定一个丹方(在 ADDING 状态下可点) */
  selectTargetRecipe(recipeId) {
    if (this.state === STATES.REFINING) return false;
    this.targetRecipe = RECIPES.find(r => r.id === recipeId) || null;
    return true;
  }

  /** 开炉炼制 */
  startRefining() {
    if (this.state !== STATES.ADDING) {
      console.warn(`[SM] 当前状态 ${this.state} 不能开炉`);
      return false;
    }
    if (this.addedIngredients.length === 0) {
      console.warn('[SM] 炉中无料');
      return false;
    }
    // 确定炼制时长:有 targetRecipe 用其时长,否则用默认 8s
    this.totalTime = this.targetRecipe?.duration ?? 8.0;
    this.timeLeft = this.totalTime;
    this._setState(STATES.REFINING);
    return true;
  }

  /** 主循环每帧调用 */
  tick(dt) {
    if (this.state !== STATES.REFINING) return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this._emit(EVENTS.PROGRESS, {
      timeLeft: this.timeLeft,
      totalTime: this.totalTime,
      progress: 1 - this.timeLeft / this.totalTime
    });
    if (this.timeLeft <= 0) {
      this._evaluate();
    }
  }

  /** 时间到,判定成败 */
  _evaluate() {
    const recipe = matchRecipe(this.addedIngredients);
    this.lastResult = recipe;

    if (recipe && chance(recipe.successRate)) {
      this._setState(STATES.SUCCESS);
      this._emit(EVENTS.SUCCESS, { recipe });
    } else {
      this._setState(STATES.FAIL);
      const reason = recipe ? '运气不佳' : '配方不合';
      this._emit(EVENTS.FAIL, { recipe, reason });
    }
  }

  /** 玩家收取丹药 */
  collectPill() {
    if (this.state !== STATES.SUCCESS) return null;
    const result = this.lastResult;
    this._reset();
    return result;
  }

  /** 重置回 IDLE(炸炉 1.5s 后自动调用,或玩家主动清空) */
  _reset() {
    this.addedIngredients = [];
    this.targetRecipe = null;
    this.timeLeft = 0;
    this.totalTime = 0;
    this.lastResult = null;
    this._setState(STATES.IDLE);
  }

  /** 玩家点「清空」按钮(任意状态都能调,REFINING 中无效) */
  reset() {
    if (this.state === STATES.REFINING) return false;
    this._reset();
    return true;
  }

  // ---------- 查询接口 ----------

  is(state) { return this.state === state; }

  canAddIngredient() {
    return (this.state === STATES.IDLE || this.state === STATES.ADDING)
      && this.addedIngredients.length < 6;
  }

  canStart() {
    return this.state === STATES.ADDING && this.addedIngredients.length > 0;
  }

  /** 预测当前原料能匹配的丹方(用于 UI 提示) */
  predictRecipe() {
    return matchRecipe(this.addedIngredients);
  }
}
