// ============================================================
// data/ingredients/plants.js — 植物药材
// 含 5 种混元3D 生成的 .glb 模型(9品为主)
// ============================================================

export const PLANTS = [
  // === 混元3D 生成的 9 品药材 ===
  {
    id: 'jiuzhuanhuihuncao',
    name: '九转还魂草',
    grade: 9,
    type: 'plant',
    description: '传说中能令白骨生肉的仙草,九转方可入药,采自九幽深处。',
    iconShape: 'grass',
    geomShape: 'glb-model',
    modelFile: '/models/jiuzhuanhuihuncao.glb',
    image: '/herb/九转还魂草.png',
    colorHex: '#EF4444',
    accentHex: '#B91C1C',
    fxColors: ['#FF2266', '#FF69B4', '#DC143C', '#FFAA88', '#FFFFFF', '#7A0020'],
    imageNatural: { w: 800, h: 600 }
  },
  {
    id: 'longxueshenmu',
    name: '龙血神木',
    grade: 9,
    type: 'plant',
    description: '上古神龙血滴所化的奇木,木质如骨,纹理殷红,据传可炼不死药。',
    iconShape: 'tree',
    geomShape: 'glb-model',
    modelFile: '/models/longxueshenmu.glb',
    image: '/herb/太乙金莲.png',
    colorHex: '#8B0000',
    accentHex: '#4A0000',
    fxColors: ['#FF2222', '#FF4500', '#8B0000', '#FF6B6B', '#FFAA55', '#4A0000'],
    imageNatural: { w: 800, h: 600 }
  },
  {
    id: 'taiyijinlian',
    name: '太乙金莲',
    grade: 9,
    type: 'plant',
    description: '太乙真人所育的金莲,花开三瓣,瓣上有先天道纹,食之可悟道。',
    iconShape: 'lotus',
    geomShape: 'glb-model',
    modelFile: '/models/taiyijinlian.glb',
    image: '/herb/龙血神木.png',
    colorHex: '#FFD700',
    accentHex: '#B8860B',
    fxColors: ['#FFD700', '#FFEB3B', '#FFA500', '#FFF8C0', '#FFFFFF', '#B8860B'],
    imageNatural: { w: 800, h: 600 }
  },
  {
    id: 'xingchenshengguo',
    name: '星辰圣果',
    grade: 9,
    type: 'plant',
    description: '九天之上星辰所化之果,服之可窥天机,得窥未来一瞬。',
    iconShape: 'fruit',
    geomShape: 'glb-model',
    modelFile: '/models/xingchenshengguo.glb',
    image: '/herb/星辰圣果.png',
    colorHex: '#5BA3E7',
    accentHex: '#2A4A6B',
    fxColors: ['#8A4AAA', '#5BA3E7', '#C8D8E8', '#E0AAFF', '#FFFFFF', '#2A4A6B'],
    imageNatural: { w: 800, h: 600 }
  },
  {
    id: 'hundunlingzhi',
    name: '混沌灵芝',
    grade: 9,
    type: 'plant',
    description: '生于混沌之气的仙灵芝,一株九叶,食之可证道长生,与天地同寿。',
    iconShape: 'mushroom',
    geomShape: 'glb-model',
    modelFile: '/models/hundunlingzhi.glb',
    image: '/herb/混沌灵芝.png',
    colorHex: '#7B2CBF',
    accentHex: '#3C1361',
    fxColors: ['#7B2CBF', '#9D4EDD', '#D0A040', '#E0AAFF', '#FFFFFF', '#3C1361'],
    imageNatural: { w: 800, h: 600 }
  },

  // === 旧的 3 品垂藤草(混元3D 生成) ===
  {
    id: 'chui_teng_cao',
    name: '垂藤草',
    grade: 3,
    type: 'plant',
    description: '自山崖垂下的藤蔓,叶色随高度变化:顶深青,中浅绿,末橙红。',
    iconShape: 'vine',
    geomShape: 'glb-model',
    modelFile: '/models/chuitengcao.glb',
    image: '/herb/垂藤草_clean.png',
    colorHex: '#5a9060',
    accentHex: '#1a5050',
    imageNatural: { w: 483, h: 602 }
  }
];
