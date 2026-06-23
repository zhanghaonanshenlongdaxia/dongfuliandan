// ============================================================
// utils/rng.js — 随机工具
// 提供:基础随机数 + 加权判定 + 集合比较
// ============================================================

/**
 * 返回 [0, 1) 的随机浮点数
 * 用原生 Math.random,新手无需理解种子
 */
export function random() {
  return Math.random();
}

/**
 * 在 [min, max) 区间内取随机浮点
 */
export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * 在 [min, max] 区间内取随机整数
 */
export function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/**
 * 概率判定:probability 为 0-1 之间的成功概率
 * @returns {boolean}
 */
export function chance(probability) {
  return Math.random() < probability;
}

/**
 * 判断两个字符串数组(原料 id)是否是相同集合
 * 不关心顺序,只关心"放了什么"
 */
export function sameSet(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  const sorted1 = [...arr1].sort();
  const sorted2 = [...arr2].sort();
  return sorted1.every((v, i) => v === sorted2[i]);
}
