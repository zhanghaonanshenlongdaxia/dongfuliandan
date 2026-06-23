// ============================================================
// ui/inventory.js — 玩家库存(原料 + 丹药)
// 简单 Map 结构,提供 take/add/collectPill
// ============================================================

import { INGREDIENTS, INITIAL_STOCK } from '../data/ingredients.js';

export class Inventory {
  constructor() {
    // 原料库存:id -> 数量
    this.ingredients = new Map();
    INGREDIENTS.forEach(i => this.ingredients.set(i.id, INITIAL_STOCK));

    // 丹药库存:Array<{ recipeId, name, color, effect, collectedAt }>
    this.pills = [];
  }

  /** 拿取一个原料(返回 true 表示成功) */
  take(ingredientId) {
    const cur = this.ingredients.get(ingredientId) ?? 0;
    if (cur <= 0) return false;
    this.ingredients.set(ingredientId, cur - 1);
    return true;
  }

  /** 添加一个原料(用于回滚) */
  add(ingredientId, n = 1) {
    const cur = this.ingredients.get(ingredientId) ?? 0;
    this.ingredients.set(ingredientId, cur + n);
  }

  /** 查询原料数量 */
  count(ingredientId) {
    return this.ingredients.get(ingredientId) ?? 0;
  }

  /** 收取一颗丹药 */
  collectPill(pill) {
    this.pills.push({
      ...pill,
      collectedAt: Date.now()
    });
  }
}
