#!/usr/bin/env node
// ============================================================
// scripts/fetch-model.mjs — 一行命令下载免费 .glb 模型
//
// 用法:
//   npm run fetch-model               # 下载默认 Soldier
//   npm run fetch-model -- robot      # 下载 RobotExpressive
//   npm run fetch-model -- <URL> <输出名>   # 下载任意 URL
//
// 下载完会保存到 public/models/<name>.glb
// 然后刷新浏览器,游戏会自动加载并替换过程化方块人
// ============================================================

import { writeFile, mkdir } from 'node:fs/promises';
import { basename, extname } from 'node:path';

const PRESETS = {
  soldier: {
    url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/Soldier.glb',
    desc: 'Three.js 官方 Soldier(士兵)— 低多边形 + Idle/Run/TPose 动画',
    size: '~1.5MB',
    note: '只有 Idle/Run/TPose 三个动画,所以游戏中只有 IDLE 和 FAN 状态能播。'
  },
  robot: {
    url: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/models/gltf/RobotExpressive.glb',
    desc: 'Three.js 官方 RobotExpressive(机器人)— 多个舞蹈/动作',
    size: '~4MB',
    note: '动画名是 Dance/Death/Idle/Jump/Run/Sit/Throw/Walk/Yes/No,只匹配部分状态。'
  }
};

async function main() {
  const args = process.argv.slice(2);
  let url, outputName, presetNote;

  if (args[0] && PRESETS[args[0]]) {
    // 预设名
    const p = PRESETS[args[0]];
    url = p.url;
    outputName = 'monk';
    presetNote = p.note;
    console.log(`\n预设: ${args[0]}`);
    console.log(`说明: ${p.desc} (${p.size})`);
  } else if (args[0] && args[0].startsWith('http')) {
    // 直接 URL
    url = args[0];
    outputName = (args[1] || 'monk').replace(/\.glb$/i, '');
    presetNote = null;
  } else {
    console.log('可用预设:');
    for (const [key, p] of Object.entries(PRESETS)) {
      console.log(`  ${key.padEnd(10)} ${p.desc}`);
    }
    console.log('\n用法:');
    console.log('  npm run fetch-model               # 默认 soldier');
    console.log('  npm run fetch-model -- robot      # robot');
    console.log('  npm run fetch-model -- <URL> [name]');
    process.exit(0);
  }

  if (!extname(outputName)) outputName += '.glb';
  const dest = `public/models/${outputName}`;
  await mkdir('public/models', { recursive: true });

  console.log(`\n下载: ${url}`);
  console.log(`保存: ${dest}`);

  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    console.error(`\n✗ 网络错误: ${e.message}`);
    console.error('  检查网络,或用代理 / VPN');
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`\n✗ 下载失败: ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buffer);

  console.log(`\n✓ 保存成功: ${dest} (${(buffer.length / 1024).toFixed(1)} KB)`);

  if (presetNote) {
    console.log(`\n提示: ${presetNote}`);
  }
  console.log('\n现在刷新浏览器 (F5),游戏会自动加载这个模型替换过程化方块人。');
  console.log('控制台会显示:');
  console.log('  [Model] /models/monk.glb 已加载');
  console.log('  [Monk] 模型已挂载,动画: [...]');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
