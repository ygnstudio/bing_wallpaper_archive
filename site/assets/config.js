/**
 * 站点常量配置
 * 修改此处即可统一调整缓存、分页、分辨率等全局参数。
 */

/** CSS/JS 缓存戳，每次发布前更新以强制浏览器拉新 */
export const CACHE_BUST = '20260820w';

/** 瀑布流每次渲染的卡片数量 */
export const PAGE_SIZE = 60;

/** 无限滚动预加载边距 */
export const ROOT_MARGIN = '600px';

/** 单次批量下载最大张数 */
export const BATCH_LIMIT = 50;

/** 批量下载并发数 */
export const BATCH_CONCURRENCY = 4;

/** 默认灯箱分辨率（首屏优先用 1080p，省流量） */
export const DEFAULT_LIGHTBOX_RES = '1920x1080';

/** Hero 首屏默认分辨率（桌面/移动均先用 1080p） */
export const DEFAULT_HERO_RES = '1920x1080';

/** 日期格式常量 */
export const DATE_FORMAT = {
  /** 输入框与 API 使用的 YYYY-MM */
  MONTH: 'YYYY-MM',
  /** 元数据中的 YYYYMMDD */
  DAY: 'YYYYMMDD',
  /** 显示用 YYYY.MM.DD */
  DISPLAY: 'YYYY.MM.DD'
};

/** 分类显示顺序 */
export const CATEGORY_ORDER = ['动物', '风景', '建筑', '植物', '人物', '太空', '交通', '美食', '抽象艺术', '其他'];

/** 颜色显示顺序 */
export const COLOR_ORDER = ['蓝', '绿', '红', '黄', '橙', '紫', '粉', '棕', '灰白', '多彩'];

/** 颜色对应样式 */
export const COLOR_HEX = {
  '蓝': '#4a9eff',
  '绿': '#46c46a',
  '红': '#ef5350',
  '黄': '#ffd54f',
  '橙': '#ff9f43',
  '紫': '#ab6bff',
  '粉': '#ff8fc7',
  '棕': '#a9794f',
  '灰白': '#bcc3cc',
  '多彩': 'linear-gradient(135deg,#ef5350,#ffd54f,#46c46a,#4a9eff,#ab6bff)'
};

/** 分辨率标签映射 */
export const RES_LABELS = {
  'UHD': 'UHD',
  '1920x1080': '1080p'
};
