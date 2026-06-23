// ============================================================
// main.js — 应用入口
// 拿到 canvas,启动 Game,就这样 :)
//
// three.js 心智模型对照 Godot:
//   Scene        ≈ Node (场景根)
//   Camera       ≈ Camera3D
//   WebGLRenderer≈ 不需要对应,Godot 自动渲染
//   Mesh         ≈ MeshInstance3D
//   Group        ≈ Node3D (用作容器)
//   Light        ≈ OmniLight3D / DirectionalLight3D
// ============================================================

import { Game } from './core/Game.js';
import { CodexPanel } from './data/ingredients/2d/CodexPanel.js';
import { Preview3D } from './data/ingredients/3d/Preview3D.js';

// 等待 DOM 就绪(其实在 module 加载时 DOM 已经好了,但双保险)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}

function start() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) {
    console.error('[main] 找不到 #three-canvas');
    return;
  }

  // 把游戏实例挂在 window 上,方便控制台调试
  // 例如:window.__game.sm.addIngredient('lingcao')
  window.__game = new Game(canvas);
  window.__game.start();

  // 药材图鉴(2D + 3D 预览)
  const preview3D = new Preview3D();
  const codex = new CodexPanel({
    onSelect: (id) => {
      // 点卡片 → 弹出 3D 预览
      const ing = window.__game.ingredients?.get?.(id) || { id, name: id, grade: 1, type: 'plant' };
      // 用我们刚写的数据查表
      import('./data/ingredients/index.js').then(({ INGREDIENT_MAP }) => {
        const data = INGREDIENT_MAP[id];
        if (data) preview3D.show(data);
      });
    },
    onClose: () => {}
  });
  document.getElementById('btn-codex').addEventListener('click', () => {
    codex.toggle();
  });

  // 暴露给控制台
  window.__codex = codex;
  window.__preview3D = preview3D;

  console.log('%c洞府炼丹 v0.1.0',
    'color: #d4af37; font-size: 16px; font-weight: bold; text-shadow: 0 0 6px #b8860b;');
  console.log('%c控制台调试: window.__game',
    'color: #8a7a5a; font-size: 12px;');
  console.log('%c示例: window.__game.sm.addIngredient("lingcao")',
    'color: #8a7a5a; font-size: 12px;');
  console.log('%c图鉴: window.__codex.toggle() | 3D 预览: window.__preview3D',
    'color: #6abe6a; font-size: 12px;');
}
