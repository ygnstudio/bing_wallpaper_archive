/**
 * Worker 筛选封装
 * 优先使用 Web Worker 进行筛选/计数，加载失败时回退到主线程同步计算。
 */

import { CACHE_BUST } from './config.js';
import { getFiltered as localGetFiltered, countBy as localCountBy } from './filter.js';

let worker = null;
let ready = false;
let messageId = 0;
/** @type {Map<number, {resolve: Function, reject: Function}>} */
const pending = new Map();

/**
 * 初始化 Worker
 * @returns {Promise<boolean>}
 */
export async function initWorker() {
  if (!('Worker' in window)) return false;
  if (worker) return ready;
  try {
    worker = new Worker('./assets/worker.js');
    worker.onmessage = (e) => {
      const { type, id, result, error } = e.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (type === 'error') p.reject(new Error(error));
      else p.resolve(result);
    };
    worker.onerror = (err) => {
      console.warn('Worker error:', err);
      ready = false;
    };
    await post('load', { url: './data/index.json', cacheBust: CACHE_BUST });
    ready = true;
    return true;
  } catch (err) {
    console.warn('Worker init failed, fallback to main thread:', err);
    ready = false;
    return false;
  }
}

function post(type, payload) {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pending.set(id, { resolve, reject });
    worker.postMessage({ type, payload, id });
  });
}

/**
 * 获取筛选结果
 * @param {Object} params
 * @returns {Promise<Array<WallpaperItem>>}
 */
export async function getFiltered(params) {
  if (ready) return post('filter', params);
  return localGetFiltered(params.q, params.dateFrom, params.dateTo).filter(i => {
    if (params.activeCat && i.category !== params.activeCat) return false;
    if (params.activeColor && i.color !== params.activeColor) return false;
    return true;
  });
}

/**
 * 统计维度数量
 * @param {Object} params
 * @returns {Promise<number>}
 */
export async function countBy(params) {
  if (ready) return post('count', params);
  return localCountBy(params.dim, params.value, params.q, params.dateFrom, params.dateTo);
}

/**
 * 销毁 Worker
 */
export function terminateWorker() {
  if (worker) { worker.terminate(); worker = null; ready = false; }
}
