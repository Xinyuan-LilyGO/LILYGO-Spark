/**
 * electron-builder 配置文件
 * macOS 构建时排除 @fontsource 字体包（约 137MB），macOS 使用系统字体即可正确显示中文
 */
const base = require('./package.json').build;

const isMac = process.argv.includes('--mac') || process.env.EXCLUDE_MAC_FONTS === '1';

const macFileExcludes = [
  '!**/node_modules/@fontsource/**',     // 排除 @fontsource 下所有文件
  '!**/node_modules/@fontsource',       // 排除目录本身（避免空目录）
];

const mergedFiles = isMac
  ? [...(base.files || []), ...macFileExcludes]
  : base.files;

module.exports = {
  ...base,
  files: mergedFiles,
};
