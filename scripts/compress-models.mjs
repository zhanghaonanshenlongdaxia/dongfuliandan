#!/usr/bin/env node
// ============================================================
// scripts/compress-models.mjs — 一键压缩所有 .glb 模型
//
// 优化项:
//   ① 减三角形面数(默认保留 15%,误差 0.001)
//   ② 贴图缩放到 1024×1024
//   ③ 贴图转 WebP(质量 80)
//   ④ Draco 压缩几何数据
//
// 流程:
//   1. 备份原文件到 public/models/.original/
//   2. 就地覆盖为压缩版
//   3. 报告前后体积
// ============================================================

import { NodeIO } from '@gltf-transform/core';
import {
  prune,
  dedup,
  resample,
  simplify,
  textureCompress,
  draco
} from '@gltf-transform/functions';
import { readdir, copyFile, stat, mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const MODELS_DIR = 'public/models';
const BACKUP_DIR = join(MODELS_DIR, '.original');

// 压缩参数(极限版 — 对标手游模型大小)
const CONFIG = {
  simplify: {
    enabled: true,
    error: 0.002,           // 略放大允许误差,换更小体积
    targetRatio: 0.03       // 保留 3% 的面(原 0.08,更激进)
  },
  textureSize: 512,         // 512 = 0.5K(原 768)
  webp: {
    enabled: true,
    quality: 50             // 质量 50(原 65)
  },
  draco: {
    enabled: true,
    method: 'edgebreaker',
    encodeSpeed: 1,         // 最慢最紧
    decodeSpeed: 1
  }
};

function fmtSize(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

/**
 * 用 sharp 把纹理转 WebP
 * gltf-transform 的 textureCompress 需要一个 encoder 函数,
 * 签名: (image: {mimeType, buffer}) => Promise<{mimeType, buffer}>
 */
function sharpWebPEncoder(quality) {
  return async (image) => {
    // 已经在 WebP 就不转
    if (image.mimeType === 'image/webp') return image;
    const sharp = (await import('sharp')).default;
    // image.buffer 是 Uint8Array,sharp 接受但保险起见包成 Buffer
    const buf = Buffer.from(image.buffer);
    const out = await sharp(buf, { failOn: 'none' })
      .webp({ quality, effort: 4 })
      .toBuffer();
    return { mimeType: 'image/webp', buffer: new Uint8Array(out) };
  };
}

async function listGlbFiles(dir) {
  const files = await readdir(dir);
  return files
    .filter(f => f.toLowerCase().endsWith('.glb'))
    .map(f => join(dir, f));
}

async function compressOne(io, srcPath) {
  const doc = await io.read(srcPath);

  // 构建 pipeline
  const transforms = [
    dedup(),         // 删重复 accessor / mesh
    prune(),         // 删未引用的资源
  ];
  if (CONFIG.simplify.enabled) {
    const { MeshoptSimplifier } = await import('meshoptimizer');
    transforms.push(simplify({
      simplifier: MeshoptSimplifier,
      error: CONFIG.simplify.error,
      ratio: CONFIG.simplify.targetRatio
    }));
  }
  if (CONFIG.webp.enabled) {
    // encoder 直接传 sharp 模块,glTF-Transform 内部用 sharp(buf).toFormat(targetFormat)
    const sharp = (await import('sharp')).default;
    transforms.push(textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      quality: CONFIG.webp.quality
    }));
  }
  if (CONFIG.draco.enabled) {
    transforms.push(draco({
      method: CONFIG.draco.method,
      encodeSpeed: 5,
      decodeSpeed: 5
    }));
  }

  // texture size 缩放(resample)
  if (CONFIG.textureSize) {
    transforms.push(resample({ textureSize: CONFIG.textureSize }));
  }

  await doc.transform(...transforms);

  const outBuf = await io.writeBinary(doc);
  return Buffer.from(outBuf);
}

async function main() {
  console.log('配置:', JSON.stringify(CONFIG, null, 2));
  console.log('\n备份目录:', BACKUP_DIR);
  await mkdir(BACKUP_DIR, { recursive: true });

  const files = await listGlbFiles(MODELS_DIR);
  console.log(`\n找到 ${files.length} 个 GLB:\n`);

  const io = new NodeIO();
  let totalBefore = 0;
  let totalAfter = 0;
  const results = [];

  for (const src of files) {
    const name = basename(src);
    const statBefore = await stat(src);
    const beforeSize = statBefore.size;
    totalBefore += beforeSize;

    // 备份(如果 .original 里已有同名文件,跳过 — 避免被压过的版本覆盖原版)
    const backupPath = join(BACKUP_DIR, name);
    try {
      await stat(backupPath);
      // 已存在,不覆盖
    } catch {
      await copyFile(src, backupPath);
    }

    process.stdout.write(`  ${name.padEnd(28)}  ${fmtSize(beforeSize).padStart(10)}  →  `);
    try {
      const compressed = await compressOne(io, src);
      await writeFile(src, compressed);
      const afterSize = compressed.length;
      totalAfter += afterSize;
      const ratio = ((1 - afterSize / beforeSize) * 100).toFixed(1);
      console.log(`${fmtSize(afterSize).padStart(10)}  (-${ratio}%)`);
      results.push({ name, before: beforeSize, after: afterSize });
    } catch (e) {
      console.log(`✗ 失败: ${e.message.slice(0, 80)}`);
      // 失败时恢复备份
      await copyFile(backupPath, src);
      totalAfter += beforeSize;
    }
  }

  console.log(`\n========== 汇总 ==========`);
  console.log(`压缩前: ${fmtSize(totalBefore)}`);
  console.log(`压缩后: ${fmtSize(totalAfter)}`);
  const saved = totalBefore - totalAfter;
  const ratio = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
  console.log(`节省:   ${fmtSize(saved)} (-${ratio}%)`);
  console.log(`\n备份在 ${BACKUP_DIR},确认效果 OK 后可以删掉:`);
  console.log(`  rm -rf ${BACKUP_DIR}`);

  // 按大小排序
  results.sort((a, b) => b.before - a.before);
  console.log(`\n单个文件(从大到小):`);
  for (const r of results) {
    const pct = ((1 - r.after / r.before) * 100).toFixed(0);
    console.log(`  ${r.name.padEnd(28)}  ${fmtSize(r.before).padStart(10)} → ${fmtSize(r.after).padStart(10)}  (-${pct}%)`);
  }
}

main().catch(e => {
  console.error('错误:', e);
  process.exit(1);
});
