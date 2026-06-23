# 放 .glb 模型到这里

把你的 `monk.glb` 拖到这个目录,游戏启动时会自动加载,替换过程化的方块人。

## 推荐的免费模型源

| 站点 | 类型 | 备注 |
|---|---|---|
| [Quaternius](https://quaternius.com) | 低多边形角色 | 风格统一,可商用 |
| [Mixamo](https://mixamo.com) | 角色 + 骨骼动画 | Adobe 免费账号;可下载带动画的 .fbx,再用 [mixamo-converter](https://github.com/isaac-mason/mixamo-glb) 转 .glb |
| [Sketchfab](https://sketchfab.com) | 巨型模型库 | 过滤 "Downloadable" |

## 期望的动画名(状态机会按小写匹配)

如果你用 Mixamo,下载时给每个动画起这样的名字(小写):

| 游戏状态 | 期望动画名 |
|---|---|
| IDLE (待机) | `idle` |
| ADD (投料) | `throw` |
| FAN (扇火) | `wave` |
| SUCCESS (成丹) | `victory` |
| FAIL (炸炉) | `falling` |

**改名方法**:用 [Blender](https://www.blender.org)(免费)打开 .glb,选中骨骼 / 动画,在右侧属性面板改 name。

## 调位置 / 缩放

如果模型加载后位置 / 缩放不对,改 [Game.js](../../src/core/Game.js) 里 `_tryLoadMonkModel()`:

```js
this.monk.swapToModel(gltf.scene, gltf.animations, {
  scale: 1.0,    // 缩放(默认 1.0;Mixamo 模型常用 0.01)
  yOffset: 0     // Y 偏移,把脚底对齐到地面
});
```

## 朝向

Mixamo 模型默认面朝 +Z 方向。如果朝向不对,改 [Game.js](../../src/core/Game.js):

```js
this.monk.group.rotation.y = -Math.PI / 2;  // 改成你想要的角度
```
