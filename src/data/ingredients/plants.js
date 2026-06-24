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
    image: '/herb/九转还魂草.webp',
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
    image: '/herb/太乙金莲.webp',
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
    image: '/herb/龙血神木.webp',
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
    image: '/herb/星辰圣果.webp',
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
    image: '/herb/混沌灵芝.webp',
    colorHex: '#7B2CBF',
    accentHex: '#3C1361',
    fxColors: ['#7B2CBF', '#9D4EDD', '#D0A040', '#E0AAFF', '#FFFFFF', '#3C1361'],
    imageNatural: { w: 800, h: 600 }
  },

  // === 七品药材(混元3D 生成) ===
  {
    id: 'qixing_lingen',
    name: '七星灵根',
    grade: 7,
    type: 'plant',
    description: '北斗七星之精所化灵根,通体晶莹,七星环列,食之可通神识、窥天象。',
    iconShape: 'root',
    geomShape: 'glb-model',
    modelFile: '/models/七星灵根.glb',
    image: '/herb/七星灵根.webp',
    colorHex: '#4FC3F7',
    accentHex: '#1A237E',
    fxColors: ['#4FC3F7', '#7FDBFF', '#FFD700', '#FFFFFF', '#B3E5FC', '#1A237E'],
    imageNatural: { w: 800, h: 600 }
  },

  // === 八品药材(混元3D 生成) ===
  {
    id: 'fenghuang_cao',
    name: '凤凰草',
    grade: 8,
    type: 'plant',
    description: '形如凤凰展翅,叶尖带火,生于南方火山,食之可浴火重生。',
    iconShape: 'grass',
    geomShape: 'glb-model',
    modelFile: '/models/凤凰草.glb',
    image: '/herb/凤凰草.webp',
    colorHex: '#FF4500',
    accentHex: '#8B0000',
    fxColors: ['#FF4500', '#FF6B35', '#FFD700', '#FF8C00', '#FFFFFF', '#8B0000'],
    imageNatural: { w: 800, h: 600 }
  },
  {
    id: 'xuanbing_lan',
    name: '玄冰兰',
    grade: 8,
    type: 'plant',
    description: '千年寒冰所化之兰,叶如冰晶,触之彻骨,食之可御万古寒气。',
    iconShape: 'lotus',
    geomShape: 'glb-model',
    modelFile: '/models/玄冰兰.glb',
    image: '/herb/玄冰兰.webp',
    colorHex: '#5BC0EB',
    accentHex: '#0A4A6B',
    fxColors: ['#5BC0EB', '#A0E0FF', '#FFFFFF', '#7FDBFF', '#C8E8FF', '#0A4A6B'],
    imageNatural: { w: 800, h: 600 }
  },
  {
    id: 'jiuqu_yulu',
    name: '九曲玉露',
    grade: 8,
    type: 'plant',
    description: '九转回环的玉露灵草,通体碧透,叶间凝露,饮之可增百年修为。',
    iconShape: 'vine',
    geomShape: 'glb-model',
    modelFile: '/models/九曲玉露.glb',
    image: '/herb/九曲玉露.webp',
    colorHex: '#2EC4B6',
    accentHex: '#0A6B5E',
    fxColors: ['#2EC4B6', '#7FDBDA', '#A8E6CF', '#FFFFFF', '#9FE2BF', '#0A6B5E'],
    imageNatural: { w: 800, h: 600 }
  },
  {
    id: 'qiannian_xuelian',
    name: '千年雪莲',
    grade: 8,
    type: 'plant',
    description: '生于千年雪峰之巅,通体雪白,瓣如冰雕,食之可解百毒、净凡胎。',
    iconShape: 'lotus',
    geomShape: 'glb-model',
    modelFile: '/models/千年雪莲.glb',
    image: '/herb/千年雪莲.webp',
    colorHex: '#E8F4F8',
    accentHex: '#A8C0C8',
    fxColors: ['#E8F4F8', '#C8D8E8', '#88A8C8', '#FFFFFF', '#DDEEFF', '#A8C0C8'],
    imageNatural: { w: 800, h: 600 }
  },
  {
    id: 'ziyang_shen',
    name: '紫阳参',
    grade: 8,
    type: 'plant',
    description: '紫气东来所化之人参,通体紫金,根须如丝,食之可窥天机、增寿元。',
    iconShape: 'root',
    geomShape: 'glb-model',
    modelFile: '/models/紫阳参.glb',
    image: '/herb/紫阳参.webp',
    colorHex: '#9D4EDD',
    accentHex: '#5A189A',
    fxColors: ['#9D4EDD', '#7B2CBF', '#D0A040', '#E0AAFF', '#FFFFFF', '#5A189A'],
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
    image: '/herb/垂藤草_clean.webp',
    colorHex: '#5a9060',
    accentHex: '#1a5050',
    imageNatural: { w: 483, h: 602 }
  }
];
