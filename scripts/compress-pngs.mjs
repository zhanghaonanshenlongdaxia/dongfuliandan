#!/usr/bin/env node
// ============================================================
// scripts/compress-pngs.mjs — 压缩 public/herb/ 下的所有 PNG
//
// 选项:
//   --webp       转 WebP(质量 80,体积最小,browsers 全支持)
//                注意:输出文件会改后缀为 .webp,需更新 plants.js 里的 image 路径
//   --quality N  压缩质量 1-100(默认 80,越低越小但越糊)
//
// 不传 --webp 时:保留 PNG 格式,用 sharp 重压缩(无损+有损混合)
//
// 流程: 备份到 .original_png/ → 就地覆盖 → 报告前后大小
// ============================================================

import sharp from 'sharp';
import { readdir, stat, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';

const TARGET_DIRS = ['public/herb', 'public/models'];  // 可加更多目录
const BACKUP_DIR = 'public/.original_png';
const USE_WEBP = process.argv.includes('--webp');
const qualityArg = process.argv.indexOf('--quality');
const QUALITY = qualityArg !== -1 ? parseInt(process.argv[qualityArg + 1]) : 80;

function fmtSize(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function findPngs(dirs) {
  const out = [];
  for (const dir of dirs) {
    let files;
    try { files = await readdir(dir); } catch { continue; }
    for (const f of files) {
      if (f.toLowerCase().endsWith('.png') && !f.startsWith('.')) {
        out.push(join(dir, f));
      }
    }
  }
  return out;
}

async function compressOne(srcPath) {
  const ext = extname(srcPath).slice(1).toLowerCase();

  if (USE_WEBP) {
    // 转 WebP
    const buf = await sharp(srcPath, { failOn: 'none' })
      .webp({ quality: QUALITY, effort: 4 })
      .toBuffer();
    // 注意:basename 第二个参数需要带前导点,不然 strip 不了扩展名
    const base = basename(srcPath, '.' + ext);
    const newPath = join(join(srcPath, '..'), base + '.webp');
    await writeFile(newPath, buf);
    // 删原 PNG
    const { unlink } = await import('node:fs/promises');
    await unlink(srcPath);
    return { outPath: newPath, size: buf.length };
  } else {
    // 保留 PNG,但重压缩(quality 80 + 最高压缩级别)
    const buf = await sharp(srcPath, { failOn: 'none' })
      .png({
        quality: QUALITY,
        compressionLevel: 9,
        palette: undefined,        // 允许真彩色
        effort: 10
      })
      .toBuffer();
    await writeFile(srcPath, buf);
    return { outPath: srcPath, size: buf.length };
  }
}

async function main() {
  console.log(`模式: ${USE_WEBP ? 'WebP' : 'PNG 优化'}  质量: ${QUALITY}`);
  console.log(`扫描目录: ${TARGET_DIRS.join(', ')}\n`);

  await mkdir(BACKUP_DIR, { recursive: true });

  const files = await findPngs(TARGET_DIRS);
  console.log(`找到 ${files.length} 个 PNG\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  const results = [];

  for (const src of files) {
    const name = basename(src);
    const before = (await stat(src)).size;
    totalBefore += before;

    // 备份(已存在不覆盖)
    const backupPath = join(BACKUP_DIR, name);
    try {
      await stat(backupPath);
    } catch {
      await copyFile(src, backupPath);
    }

    process.stdout.write(`  ${name.padEnd(30)}  ${fmtSize(before).padStart(10)}  →  `);
    try {
      const { outPath, size } = await compressOne(src);
      totalAfter += size;
      const ratio = ((1 - size / before) * 100).toFixed(1);
      const newName = basename(outPath);
      console.log(`${fmtSize(size).padStart(10)}  (-${ratio}%)  ${USE_WEBP ? '→ ' + newName : ''}`);
      results.push({ before, after: size, name });
    } catch (e) {
      console.log(`✗ 失败: ${e.message.slice(0, 80)}`);
      totalAfter += before;
    }
  }

  console.log(`\n========== 汇总 ==========`);
  console.log(`压缩前: ${fmtSize(totalBefore)}`);
  console.log(`压缩后: ${fmtSize(totalAfter)}`);
  const ratio = ((1 - totalAfter / totalBefore) * 100).toFixed(1);
  console.log(`节省:   ${fmtSize(totalBefore - totalAfter)} (-${ratio}%)`);
  console.log(`\n备份在 ${BACKUP_DIR}/`);

  if (USE_WEBP) {
    console.log(`\n⚠  注意:文件后缀变成 .webp 了,需要更新:`);
    console.log(`   src/data/ingredients/plants.js 里 image 字段:`);
    console.log(`     image: '/herb/xxx.png'  →  image: '/herb/xxx.webp'`);
  }
}

main().catch(e => { console.error('错误:', e); process.exit(1); });
