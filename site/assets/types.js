/**
 * JSDoc 类型定义（仅类型，无运行时导出）
 * @file
 */

/**
 * @typedef {Object} WallpaperItem
 * @property {string} date - 日期，格式 YYYYMMDD
 * @property {string} title - 壁纸标题
 * @property {string} [copyright] - 版权说明
 * @property {string} [copyrightlink] - 版权链接
 * @property {string} url - 1080p 原图直链
 * @property {string} urlbase - Bing urlbase
 * @property {string} [thumbnail] - 缩略图相对路径
 * @property {string} [category] - 分类
 * @property {string} [color] - 颜色
 * @property {boolean|null} [uhd] - 是否支持 4K（null 表示未探测）
 */

/**
 * @typedef {Object} ResOption
 * @property {string} v - 分辨率值，如 'UHD' 或 '1920x1080'
 * @property {string} label - 显示标签
 */

/**
 * @typedef {Object} ZipEntry
 * @property {string} name - 文件名
 * @property {Uint8Array} data - 文件数据
 */

export {}; // 让文件成为 ES 模块，但不导出运行时内容
