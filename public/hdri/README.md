# 放 .hdr 环境贴图到这里

把你的 `cave.hdr` 拖到这个目录,游戏启动时会自动加载,作为场景背景 + 反射环境。

## 推荐下载源

**[Poly Haven](https://polyhaven.com/hdris)** — 全免费、可商用、画质好

适合洞府氛围的推荐(按修仙风挑):
- `kiara_1_dawn.hdr` — 黄昏山景
- `qwantani_dusk.hdr` — 沙漠黄昏
- `spruit_sunrise.hdr` — 简单日出色调
- `cave_4k.hdr` — 直接就是洞穴!推荐
- `abandoned_church_02_4k.hdr` — 室内古旧感

下载格式选 **HDR**(不要选 EXR,three.js RGBELoader 不支持 EXR 的某些压缩)。

## 怎么用

文件命名必须叫 `cave.hdr`,路径对应 `/hdri/cave.hdr`。

启动游戏,控制台看到:
```
[HDRI] /hdri/cave.hdr 已加载
```
就成功了。

## 没放 .hdr 怎么办?

代码默认会启用 three.js 内置的 `RoomEnvironment`(一个虚拟白房间),反射效果有,但没有真实背景。**不放 .hdr 也能跑**,只是没那么好看。
