// ============================================================
// data/ingredients/grades.js — 9 个品阶定义
// 涵盖 1-9 品,提供颜色/加成/描述等元数据
// 1-3 = 凡品,4-6 = 灵品,7-9 = 仙品
// ============================================================

export const TIERS = {
  FAN:  { key: 'fan',   name: '凡品', short: '凡' },
  LING: { key: 'ling',  name: '灵品', short: '灵' },
  XIAN: { key: 'xian',  name: '仙品', short: '仙' }
};

// 根据品阶 ID 算出所属档位
export function tierOf(grade) {
  if (grade <= 3) return TIERS.FAN;
  if (grade <= 6) return TIERS.LING;
  return TIERS.XIAN;
}

export const GRADES = [
  // ====== 凡品 (1-3) ======
  {
    id: 1,
    name: '一品',
    short: '一',
    tier: TIERS.FAN,
    tierName: '凡下品',
    color: 0x6b6457,        // 灰褐
    accent: 0x3a3530,
    colorCss: '#6b6457',
    accentCss: '#3a3530',
    description: '杂质丛生,品质极低',
    successRateBonus: 0.00,
    pillQualityMin: 0
  },
  {
    id: 2,
    name: '二品',
    short: '二',
    tier: TIERS.FAN,
    tierName: '凡中品',
    color: 0x9a8a55,        // 枯黄
    accent: 0x5a4a30,
    colorCss: '#9a8a55',
    accentCss: '#5a4a30',
    description: '普通药材,聊胜于无',
    successRateBonus: 0.05,
    pillQualityMin: 0
  },
  {
    id: 3,
    name: '三品',
    short: '三',
    tier: TIERS.FAN,
    tierName: '凡上品',
    color: 0x6b8a3a,        // 黄绿
    accent: 0x3a5a20,
    colorCss: '#6b8a3a',
    accentCss: '#3a5a20',
    description: '山里挖的,稍有药性',
    successRateBonus: 0.10,
    pillQualityMin: 1
  },

  // ====== 灵品 (4-6) ======
  {
    id: 4,
    name: '四品',
    short: '四',
    tier: TIERS.LING,
    tierName: '灵下品',
    color: 0x7a4a8a,        // 蓝紫
    accent: 0x4a2a5a,
    colorCss: '#7a4a8a',
    accentCss: '#4a2a5a',
    description: '初染灵气的天材地宝',
    successRateBonus: 0.15,
    pillQualityMin: 2
  },
  {
    id: 5,
    name: '五品',
    short: '五',
    tier: TIERS.LING,
    tierName: '灵中品',
    color: 0x8a4aaa,        // 紫晶
    accent: 0x5a2a7a,
    colorCss: '#8a4aaa',
    accentCss: '#5a2a7a',
    description: '千年灵物,非凡间可得',
    successRateBonus: 0.20,
    pillQualityMin: 3
  },
  {
    id: 6,
    name: '六品',
    short: '六',
    tier: TIERS.LING,
    tierName: '灵上品',
    color: 0xaa6ad0,        // 七彩(略偏紫)
    accent: 0xd0aa40,
    colorCss: '#aa6ad0',
    accentCss: '#d0aa40',
    description: '灵山之巅,稀世之珍',
    successRateBonus: 0.30,
    pillQualityMin: 4
  },

  // ====== 仙品 (7-9) ======
  {
    id: 7,
    name: '七品',
    short: '七',
    tier: TIERS.XIAN,
    tierName: '仙下品',
    color: 0xeec870,        // 金白
    accent: 0xb8995a,
    colorCss: '#eec870',
    accentCss: '#b8995a',
    description: '仙家之物,不可亵玩',
    successRateBonus: 0.40,
    pillQualityMin: 5
  },
  {
    id: 8,
    name: '八品',
    short: '八',
    tier: TIERS.XIAN,
    tierName: '仙中品',
    color: 0xc8d8e8,        // 银辉
    accent: 0x88a8c8,
    colorCss: '#c8d8e8',
    accentCss: '#88a8c8',
    description: '仙界奇珍,凡间罕见',
    successRateBonus: 0.55,
    pillQualityMin: 6
  },
  {
    id: 9,
    name: '九品',
    short: '九',
    tier: TIERS.XIAN,
    tierName: '仙上品',
    color: 0xd0a040,        // 紫金
    accent: 0x8030a0,
    colorCss: '#d0a040',
    accentCss: '#8030a0',
    description: '传说神物,开天辟地',
    successRateBonus: 0.75,
    pillQualityMin: 7
  }
];

// 按 ID 查表
export const GRADE_MAP = Object.fromEntries(GRADES.map(g => [g.id, g]));
