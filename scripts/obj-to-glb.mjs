// ============================================================
// scripts/obj-to-glb.mjs — OBJ + MTL + PBR 贴图 → GLB 转换器
//
// 用法:
//   node scripts/obj-to-glb.mjs <目录> <obj文件名> [输出名]
// 例:
//   node scripts/obj-to-glb.mjs public/models/hundunlingzhi hundunlingzhi.obj
//
// 原理:Node 里 fetch 不支持 file://,所以用 Loader.parse(text) 避开
//      PBR 贴图读成 data URI 喂给 TextureLoader
// ============================================================

import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { join, basename, extname } from 'path';
import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { Blob } from 'buffer';

// ---------- Node polyfills ----------
globalThis.Blob = Blob;
globalThis.File = class File extends Blob {
  constructor(parts, name, opts) { super(parts, opts); this.name = name; }
};
globalThis.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
globalThis.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
globalThis.Image = class Image {
  set src(_) {} addEventListener() {} removeEventListener() {}
};
// mock document.createElementNS(three.js ImageLoader 需要)
globalThis.document = {
  createElementNS(_, name) {
    return {
      // TextureLoader 会设置 src,然后等 onload 触发
      style: {},
      getContext() { return null; },
      addEventListener(ev, cb) { this['on' + ev] = cb; },
      removeEventListener() {},
      get src() { return this._src; },
      set src(v) {
        this._src = v;
        // 同步触发 onload,假装图片已加载(实际 TextureLoader 会用 _image 字段)
        // three 的 ImageLoader 看的是 image._data(data URI) 或 image.complete
        if (this.onload) setTimeout(() => this.onload(), 0);
      }
    };
  }
};

// ---------- 参数 ----------
const dir = process.argv[2];
const objName = process.argv[3];
const outName = process.argv[4] || (objName || '').replace(/\.obj$/i, '');

if (!dir || !objName) {
  console.error('用法: node scripts/obj-to-glb.mjs <目录> <obj文件名> [输出名]');
  process.exit(1);
}

const dirAbs = join(process.cwd(), dir);
const objPath = join(dirAbs, objName);
const mtlPath = objPath.replace(/\.obj$/i, '.mtl');
const outPath = join(dirAbs, outName + '.glb');

if (!existsSync(objPath)) {
  console.error(`OBJ 文件不存在: ${objPath}`);
  process.exit(1);
}

// ---------- 工具 ----------
function fileToDataURI(p) {
  if (!p || !existsSync(p)) return null;
  const buf = readFileSync(p);
  const ext = extname(p).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' :
               ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
               ext === 'webp' ? 'image/webp' : 'application/octet-stream';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// 按模糊匹配找 PBR 贴图(项目里命名是 texture_pbr_20250901_metallic.png 等)
function findPBR(d) {
  const out = { metallic: null, roughness: null, normal: null };
  const files = readdirSync(d).filter(f => f.toLowerCase().endsWith('.png'));
  for (const f of files) {
    if (!out.metallic  && /metallic|metalness/i.test(f))  out.metallic  = join(d, f);
    if (!out.roughness && /roughness/i.test(f))           out.roughness = join(d, f);
    if (!out.normal    && /normal/i.test(f))              out.normal    = join(d, f);
  }
  return out;
}

const pbr = findPBR(dirAbs);
console.log(`[obj-to-glb] 目录: ${dirAbs}`);
console.log(`[obj-to-glb] OBJ: ${objName}  MTL: ${existsSync(mtlPath) ? basename(mtlPath) : '无'}`);
console.log(`[obj-to-glb] PBR: metallic=${pbr.metallic ? '✓' : '✗'}  roughness=${pbr.roughness ? '✓' : '✗'}  normal=${pbr.normal ? '✓' : '✗'}`);

// ---------- 1. 加载 MTL(用 parse 避开 fetch) ----------
const mtlLoader = new MTLLoader();
let mtlMaterials = null;
if (existsSync(mtlPath)) {
  const mtlText = readFileSync(mtlPath, 'utf-8');
  mtlMaterials = mtlLoader.parse(mtlText, dirAbs + '/');
  mtlMaterials.preload();

  // MTLLoader 内部还是会去 fetch 贴图(如果 .mtl 里写了 map_Kd 等)
  // 我们手动把所有贴图引用替换成 data URI
  for (const name of Object.keys(mtlMaterials.materials || {})) {
    const m = mtlMaterials.materials[name];
    if (!m) continue;
    // 把所有 *_Map 引用替换
    const mapKeys = ['map', 'normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap',
                     'emissiveMap', 'aoMap', 'alphaMap', 'displacementMap', 'lightMap'];
    for (const k of mapKeys) {
      if (m[k] && m[k].image && m[k].image.src) {
        const src = m[k].image.src;
        if (!src.startsWith('data:')) {
          const fname = src.split('/').pop();
          const uri = fileToDataURI(join(dirAbs, fname));
          if (uri) m[k].image.src = uri;
        }
      }
    }
  }
}

// ---------- 2. 加载 OBJ ----------
const objLoader = new OBJLoader();
if (mtlMaterials) objLoader.setMaterials(mtlMaterials);
const objText = readFileSync(objPath, 'utf-8');
const model = objLoader.parse(objText);
console.log('[obj-to-glb] OBJ 解析成功');

// ---------- 3. 把 MTL 里的 MeshPhongMaterial 转 MeshStandardMaterial,挂 PBR 贴图 ----------
const [metallicMap, roughnessMap, normalMap] = await Promise.all([
  pbr.metallic  ? new THREE.TextureLoader().loadAsync(fileToDataURI(pbr.metallic))  : Promise.resolve(null),
  pbr.roughness ? new THREE.TextureLoader().loadAsync(fileToDataURI(pbr.roughness)) : Promise.resolve(null),
  pbr.normal    ? new THREE.TextureLoader().loadAsync(fileToDataURI(pbr.normal))    : Promise.resolve(null)
]);

let matCount = 0;
model.traverse(obj => {
  if (!obj.isMesh || !obj.material) return;
  const old = obj.material;
  const newMat = new THREE.MeshStandardMaterial({
    map: old.map || null,
    color: old.color || 0xffffff,
    transparent: old.transparent,
    opacity: old.opacity ?? 1.0,
    side: old.side || THREE.FrontSide,
    emissive: old.emissive || 0x000000,
    emissiveIntensity: old.emissiveIntensity ?? 0,
    metalness:  metallicMap  ? 1.0 : 0.3,
    roughness: roughnessMap ? 1.0 : 0.6
  });
  if (metallicMap)  newMat.metalnessMap  = metallicMap;
  if (roughnessMap) newMat.roughnessMap = roughnessMap;
  if (normalMap) {
    newMat.normalMap = normalMap;
    newMat.normalScale = new THREE.Vector2(1, 1);
  }
  obj.material = newMat;
  matCount++;
});
console.log(`[obj-to-glb] 转换了 ${matCount} 个材质`);

// ---------- 4. 导出 GLB ----------
const exporter = new GLTFExporter();
const result = await new Promise((res, rej) => {
  exporter.parse(
    model,
    (gltf) => res(gltf),
    (err) => rej(err),
    { binary: true, embedImages: true, onlyVisible: true }
  );
});

writeFileSync(outPath, Buffer.from(result));
const sizeMB = (result.byteLength / 1024 / 1024).toFixed(2);
console.log(`[obj-to-glb] ✅ 输出: ${outPath} (${sizeMB} MB)`);
