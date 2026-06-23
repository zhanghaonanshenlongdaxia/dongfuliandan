// ============================================================
// data/recipes.js — 丹方数据
// 集合完全匹配才判定为该方,按 successRate 最高的优先
// ============================================================

import { sameSet } from '../utils/rng.js';

export const RECIPES = [
  {
    id: 'qingxin',
    name: '清心丹',
    desc: '初阶丹药,清热宁神。',
    ingredients: ['lingcao', 'shuiyun'],   // 灵草 + 水云
    duration: 6.0,
    successRate: 0.95,
    pill: {
      id: 'pill_qingxin',
      name: '清心丹',
      color: 0x77ddff,
      size: 0.22,
      effect: '灵力 +10'
    }
  },
  {
    id: 'jiuhua',
    name: '九华丹',
    desc: '中阶丹药,温养经脉。',
    ingredients: ['lingcao', 'huoyun', 'taiyanghua'],
    duration: 10.0,
    successRate: 0.75,
    pill: {
      id: 'pill_jiuhua',
      name: '九华丹',
      color: 0xffd166,
      size: 0.28,
      effect: '气血 +30'
    }
  },
  {
    id: 'xuanyin',
    name: '玄阴丹',
    desc: '冷冽丹药,需寒性原料。',
    ingredients: ['shuiyun', 'hanbing', 'taiyanghua'],
    duration: 9.0,
    successRate: 0.65,
    pill: {
      id: 'pill_xuanyin',
      name: '玄阴丹',
      color: 0xbb88ff,
      size: 0.30,
      effect: '神识 +20'
    }
  },
  {
    id: 'wushen',
    name: '武神丹',
    desc: '高阶丹药,火性极强,容易炸炉。',
    ingredients: ['huoyun', 'hanbing', 'lingcao', 'shuiyun'],
    duration: 14.0,
    successRate: 0.40,
    pill: {
      id: 'pill_wushen',
      name: '武神丹',
      color: 0xff4444,
      size: 0.36,
      effect: '武力 +50'
    }
  }
];

// 用 id 查表
export const RECIPE_MAP = Object.fromEntries(RECIPES.map(r => [r.id, r]));

/**
 * 根据已加原料 id 列表,查找最匹配的丹方
 * 匹配规则:原料集合完全相同(顺序无关)
 * 多方匹配时取 successRate 最高的
 * @returns {Recipe|null} 匹配的丹方,无匹配返回 null
 */
export function matchRecipe(addedIds) {
  let best = null;
  for (const r of RECIPES) {
    if (sameSet(r.ingredients, addedIds)) {
      if (!best || r.successRate > best.successRate) {
        best = r;
      }
    }
  }
  return best;
}
