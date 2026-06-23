// ============================================================
// data/ingredients/index.js — 汇总导出
// 用法: import { INGREDIENTS, getIngredient, getByGrade } from './data/ingredients/index.js';
// ============================================================

import { PLANTS } from './plants.js';
import { MINERALS } from './minerals.js';
import { LIQUIDS } from './liquids.js';
import { GRADES, GRADE_MAP, TIERS, tierOf } from './grades.js';

export { GRADES, GRADE_MAP, TIERS, tierOf };

// 全部 27 种药材
export const INGREDIENTS = [...PLANTS, ...MINERALS, ...LIQUIDS];

// 按 ID 查表
export const INGREDIENT_MAP = Object.fromEntries(
  INGREDIENTS.map(i => [i.id, i])
);

// 按品阶(grade 1-9)分组
export const BY_GRADE = {};
for (let g = 1; g <= 9; g++) {
  BY_GRADE[g] = INGREDIENTS.filter(i => i.grade === g);
}

// 按类型分组
export const BY_TYPE = {
  plant: PLANTS,
  mineral: MINERALS,
  liquid: LIQUIDS
};

// 工具:根据 id 取一种药材(找不到返回 null)
export function getIngredient(id) {
  return INGREDIENT_MAP[id] || null;
}

// 工具:根据品阶 id 取品阶元数据
export function getGrade(gradeId) {
  return GRADE_MAP[gradeId] || null;
}

// 工具:计算一组药材的平均品阶(用于预估丹药品质)
export function averageGrade(ingredientIds) {
  if (ingredientIds.length === 0) return 1;
  const sum = ingredientIds.reduce((acc, id) => {
    const ing = INGREDIENT_MAP[id];
    return acc + (ing ? ing.grade : 1);
  }, 0);
  return sum / ingredientIds.length;
}
