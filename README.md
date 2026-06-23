# 洞府炼丹

一个用 **Three.js** 做的修仙炼丹小游戏,纯前端、零依赖模型。

> 这是为初学者准备的教学项目,代码注释密集,适合刚接触 three.js 的同学读。

## 功能

- 3D 洞府场景:岩石洞穴、丹炉、火焰、烟雾
- 完整的炼丹流程:**看丹方 → 加药材 → 开炉炼制 → 出丹 / 炸炉**
- 4 个丹方(清心丹 / 九华丹 / 玄阴丹 / 武神丹),6 种药材
- 鼠标拖动视角,OrbitControls 锁定安全区(不会穿墙 / 出洞)
- DOM 侧边栏 UI(深棕金边,修仙风)

## 运行

需要 **Node.js 18+**(推荐 LTS)。

```powershell
# 1. 安装依赖(首次运行)
npm install

# 2. 启动开发服务器
npm run dev

# 浏览器会自动打开 http://127.0.0.1:5173
```

打包构建:

```powershell
npm run build    # 产物在 dist/
npm run preview  # 本地预览构建结果
```

## 玩法

1. **拖动鼠标** — 围绕丹炉旋转视角
2. **点丹方卡** — 选定一个目标丹方(可选)
3. **点原料按钮** — 把药材投进丹炉(每次 -1 库存)
4. **点「开炉炼制」** — 等待倒计时结束
   - 配方正确 + 通过概率判定 → **出丹**,点「收取」入库
   - 配方错误 / 运气差 → **炸炉**,原料损耗,自动重置
5. **点「清空」** — 撤销已加的原料(REFINING 中无效)

## 控制台调试

游戏启动后,`window.__game` 暴露了核心对象:

```js
// 直接加入原料(绕过 UI)
window.__game.sm.addIngredient('lingcao')

// 强制开炉
window.__game.sm.startRefining()

// 看当前状态
window.__game.sm.state
```

## 项目结构

```
洞府炼丹/
├── package.json
├── vite.config.js
├── index.html              # HTML 入口
├── README.md
└── src/
    ├── main.js             # 启动入口
    ├── style.css           # UI 样式
    ├── core/
    │   ├── Game.js              # 主类:串联所有模块
    │   └── RefineStateMachine.js# 状态机
    ├── scene/
    │   ├── Cave.js              # 洞府几何
    │   ├── Furnace.js           # 丹炉
    │   ├── Fire.js              # 火焰
    │   ├── Smoke.js             # 烟雾
    │   └── Lighting.js          # 灯光
    ├── data/
    │   ├── recipes.js           # 4 个丹方
    │   └── ingredients.js       # 6 种药材
    ├── ui/
    │   ├── UIManager.js         # DOM 面板管理
    │   └── inventory.js         # 玩家库存
    └── utils/
        └── rng.js               # 随机工具
```

## 学习路径

如果你想从这份代码入手学 three.js,建议顺序:

1. `src/main.js` + `src/core/Game.js` — 理解 Scene/Camera/Renderer 的基本套路
2. `src/scene/Cave.js` — 看怎么用基础几何拼场景
3. `src/scene/Furnace.js` — Group 容器的用法
4. `src/scene/Fire.js` — 每帧 update 做动画
5. `src/scene/Smoke.js` — 对象池 + SpriteMaterial + CanvasTexture
6. `src/core/RefineStateMachine.js` — 状态机模式
7. `src/ui/UIManager.js` — DOM 与 3D 解耦

## 已知限制

- 不开阴影(`castShadow`/`receiveShadow`)— 留作后续优化
- 不加载外部模型(全程程序化几何)
- 字体走 DOM(不用 `TextGeometry`)
- 窗口宽度 < 1024px 时侧边栏会重叠画布(移动端不友好)

## 许可

学习项目,可自由复制修改。
