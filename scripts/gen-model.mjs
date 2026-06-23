#!/usr/bin/env node
// ============================================================
// scripts/gen-model.mjs — 调混元生 3D API 生成 .glb 模型
//
// 用法:
//   HUNYUAN_API_KEY=sk-xxx node scripts/gen-model.mjs "七星灵根"
//   HUNYUAN_API_KEY=sk-xxx node scripts/gen-model.mjs "玄铁精" 3.0 xuan_tie_jing
//   HUNYUAN_API_KEY=sk-xxx node scripts/gen-model.mjs --image data:image/jpeg;base64,xxx "九转还魂草"
//
// 流程:
//   1. POST /v1/ai3d/submit  (Prompt + 可选 ImageUrl + Model)
//   2. 拿 JobId,轮询 POST /v1/ai3d/query 直到 DONE
//   3. 下载返回的 .glb URL 到 public/models/<输出名>.glb
// ============================================================

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const BASE = 'https://api.ai3d.cloud.tencent.com';
const SUBMIT_URL = `${BASE}/v1/ai3d/submit`;
const QUERY_URL  = `${BASE}/v1/ai3d/query`;

/** 把图片路径/URL/data URI 统一转成 data URI(API 接受 URL 或 base64) */
async function normalizeImage(input) {
  if (!input) return null;
  if (input.startsWith('data:') || input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }
  // 当成本地文件路径
  const buf = await readFile(resolve(process.cwd(), input));
  const ext = extname(input).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' :
               ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
               ext === 'webp' ? 'image/webp' : 'application/octet-stream';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// API key 优先:命令行 --key > 环境变量 HUNYUAN_API_KEY
function getApiKey() {
  const idx = process.argv.indexOf('--key');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.HUNYUAN_API_KEY || '';
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { prompt: '', model: '3.0', output: '', imageUrl: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--key') { i++; continue; }
    if (args[i] === '--image' || args[i] === '-i') {
      opts.imageUrl = args[++i];
    } else if (args[i] === '--model' || args[i] === '-m') {
      opts.model = args[++i];
    } else if (args[i] === '--output' || args[i] === '-o') {
      opts.output = args[++i];
    } else if (!opts.prompt) {
      opts.prompt = args[i];
    } else if (!opts.output) {
      opts.output = args[i];
    }
  }
  return opts;
}

async function submitJob(apiKey, prompt, model, imageUrl) {
  // 重要:API 实际接受的是 "Image" 字段(不是文档写的 ImageUrl)
  // Prompt + Image 可同时存在
  const body = { Model: model };
  if (imageUrl) {
    body.Image = imageUrl;
    if (prompt) body.Prompt = prompt;
  } else if (prompt) {
    body.Prompt = prompt;
  }

  const res = await fetch(SUBMIT_URL, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`submit 失败: ${res.status} ${res.statusText}\n${text}`);
  }
  const data = await res.json();
  // 兼容:Response.JobId / JobId / job_id / jobId
  return data.Response?.JobId || data.JobId || data.job_id || data.jobId || data.JobID;
}

async function queryJob(apiKey, jobId) {
  const res = await fetch(QUERY_URL, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ JobId: jobId })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`query 失败: ${res.status} ${res.statusText}\n${text}`);
  }
  return res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** 轮询直到任务结束(最多 waitSeconds 秒) */
async function pollUntilDone(apiKey, jobId, waitSeconds = 300) {
  const start = Date.now();
  let attempt = 0;
  while ((Date.now() - start) / 1000 < waitSeconds) {
    attempt++;
    const data = await queryJob(apiKey, jobId);
    // 响应都包在 data.Response 里
    const resp = data.Response || data;
    const status = (resp.Status || resp.status || '').toUpperCase();
    // 打印进度(避免太密,只在变化时打)
    if (attempt === 1 || attempt % 4 === 0) {
      console.log(`  [${attempt}] JobId=${jobId}  Status=${status}  credit=${resp.ResultCreditConsumed || '?'}`);
      if (resp.ErrorCode || resp.ErrorMessage) {
        console.log(`  Error: ${resp.ErrorCode} - ${resp.ErrorMessage}`);
      }
    }
    if (status === 'DONE' || status === 'SUCCESS' || status === 'SUCCEED' || status === 'COMPLETED') {
      return resp;
    }
    if (status === 'FAILED' || status === 'FAIL' || status === 'ERROR') {
      throw new Error(`任务失败: ${JSON.stringify(resp)}`);
    }
    await sleep(3000);
  }
  throw new Error(`任务超时(>${waitSeconds}s),JobId=${jobId}`);
}

function extractGlbUrl(queryResult) {
  // 优先取 Type === 'GLB' 的
  const file3Ds = queryResult.ResultFile3Ds || queryResult.ResultFile3D;
  if (Array.isArray(file3Ds)) {
    const glb = file3Ds.find(f => f.Type === 'GLB');
    if (glb) return glb.Url;
    // 没 GLB 就取第一个
    return file3Ds[0]?.Url;
  }
  // 其他可能的字段(老格式)
  return queryResult.ResultUrl || queryResult.ModelUrl || queryResult.FileUrl || queryResult.Url;
}

async function downloadTo(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
  return buf.length;
}

async function main() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('✗ 需要 API key,设置环境变量 HUNYUAN_API_KEY 或 --key sk-xxx');
    console.error('  key 在腾讯云控制台 → API KEY 管理 创建');
    process.exit(1);
  }
  const opts = parseArgs();
  if (!opts.prompt) {
    console.log('用法:');
    console.log('  HUNYUAN_API_KEY=sk-xxx node scripts/gen-model.mjs "提示词" [输出名]');
    console.log('  HUNYUAN_API_KEY=sk-xxx node scripts/gen-model.mjs --image <base64 或 URL> "提示词" [输出名]');
    console.log('  HUNYUAN_API_KEY=sk-xxx node scripts/gen-model.mjs --model 3.1 "提示词" [输出名]');
    console.log('输出名不填:用 prompt 的拼音/英文简化');
    process.exit(0);
  }

  const outputName = opts.output || opts.prompt
    .replace(/[^一-龥a-zA-Z0-9]/g, '_')
    .toLowerCase();
  const dest = resolve(process.cwd(), `public/models/${outputName}.glb`);

  console.log(`\n[1/3] 提交任务`);
  console.log(`  Prompt: ${opts.prompt}`);
  console.log(`  Model: ${opts.model}`);
  if (opts.imageUrl) {
    const normalized = await normalizeImage(opts.imageUrl);
    console.log(`  Image: ${opts.imageUrl} → data URI (${(normalized.length / 1024 / 1024).toFixed(2)} MB)`);
    opts.imageUrl = normalized;
  }

  const jobId = await submitJob(apiKey, opts.prompt, opts.model, opts.imageUrl);
  console.log(`  JobId: ${jobId}`);

  console.log(`\n[2/3] 轮询结果(每 3 秒一次,最多 5 分钟)`);
  const result = await pollUntilDone(apiKey, jobId);
  const modelUrl = extractGlbUrl(result);
  console.log(`  模型 URL: ${modelUrl}`);

  console.log(`\n[3/3] 下载`);
  await mkdir('public/models', { recursive: true });
  const size = await downloadTo(modelUrl, dest);
  console.log(`  ✓ 保存: ${dest} (${(size / 1024 / 1024).toFixed(2)} MB)`);

  console.log(`\n现在刷新浏览器,新模型就位。`);
  console.log(`提示:把这个新药材加到 src/data/ingredients/plants.js:`);
  console.log(`  { id: '${outputName}', name: '${opts.prompt}', modelFile: '/models/${outputName}.glb', ... }`);
}

main().catch(e => {
  console.error('\n✗ 错误:', e.message);
  if (e.cause) console.error('  原因:', e.cause.message);
  process.exit(1);
});
