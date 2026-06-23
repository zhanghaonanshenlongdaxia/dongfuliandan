// ============================================================
// data/ingredients.js — 原料数据
// 6 种药材,玩家各有 5 个库存
// color 用于 UI 按钮上的色块和 3D 投入炉中时的视觉
// ============================================================

export const INGREDIENTS = [
  {
    id: 'lingcao',
    name: '灵草',
    color: 0x4cb84c,         // 草绿
    desc: '蕴含天地灵气的草药'
  },
  {
    id: 'shuiyun',
    name: '水云',
    color: 0x4ca8d4,         // 水蓝
    desc: '采集自云海的水汽精华'
  },
  {
    id: 'huoyun',
    name: '火云',
    color: 0xd45c3c,         // 火红
    desc: '火山口的炽热云团'
  },
  {
    id: 'hanbing',
    name: '寒冰',
    color: 0x88ccff,         // 冰蓝
    desc: '千年不化的玄冰'
  },
  {
    id: 'taiyanghua',
    name: '太阳花',
    color: 0xffd24c,         // 金黄
    desc: '向阳而生的灵花'
  },
  {
    id: 'youming',
    name: '幽冥',
    color: 0x8855cc,         // 幽紫
    desc: '幽冥界的气息凝聚'
  }
];

// 用 id 快速查表的小工具
export const INGREDIENT_MAP = Object.fromEntries(
  INGREDIENTS.map(i => [i.id, i])
);

// 每种原料的初始库存
export const INITIAL_STOCK = 5;
