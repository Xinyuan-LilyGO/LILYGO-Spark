#!/usr/bin/env node
/**
 * 直接读取 asar 并列出大文件 / 字体相关文件
 * 用法: node scripts/inspect-asar.js [path/to/app.asar]
 */
const path = require('path');
const fs = require('fs');

const DEFAULT_ASAR = path.join(
  __dirname,
  '../release/mac-arm64/LILYGO Spark.app/Contents/Resources/app.asar'
);

const asarPath = process.argv[2] || DEFAULT_ASAR;

if (!fs.existsSync(asarPath)) {
  console.error('文件不存在:', asarPath);
  process.exit(1);
}

const asar = require('@electron/asar');
const { getRawHeader } = asar;

function walkHeader(obj, prefix = '', result = []) {
  if (!obj || typeof obj !== 'object') return result;
  const files = obj.files || obj;
  if (typeof files !== 'object') return result;
  for (const [name, entry] of Object.entries(files)) {
    const fullPath = prefix ? `${prefix}/${name}` : name;
    if (entry.files) {
      walkHeader(entry, fullPath, result);
    } else if (typeof entry.size === 'number') {
      result.push({ path: fullPath, size: entry.size });
    }
  }
  return result;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const { header } = getRawHeader(asarPath);
const entries = walkHeader(header);

// 字体相关
const fontKeywords = ['font', 'woff', 'woff2', 'ttf', 'noto-sans', '@fontsource'];
const fontEntries = entries.filter((e) =>
  fontKeywords.some((k) => e.path.toLowerCase().includes(k))
);
const fontTotal = fontEntries.reduce((s, e) => s + e.size, 0);

// @fontsource 目录
const fontsourceEntries = entries.filter((e) => e.path.startsWith('node_modules/@fontsource'));
const fontsourceTotal = fontsourceEntries.reduce((s, e) => s + e.size, 0);

console.log('════════════════════════════════════════════════');
console.log('  ASAR 直接检查:', asarPath);
console.log('════════════════════════════════════════════════');
console.log('总文件数:', entries.length);
console.log('内部总大小:', formatBytes(entries.reduce((s, e) => s + e.size, 0)));
console.log('');
console.log('── 字体相关文件 (含 font/woff/noto/@fontsource) ──');
console.log('  文件数:', fontEntries.length);
console.log('  总大小:', formatBytes(fontTotal));
if (fontEntries.length > 0) {
  fontEntries
    .sort((a, b) => b.size - a.size)
    .slice(0, 40)
    .forEach((e) => console.log('    ', formatBytes(e.size).padStart(10), e.path));
}
console.log('');
console.log('── node_modules/@fontsource ──');
console.log('  文件数:', fontsourceEntries.length);
console.log('  总大小:', formatBytes(fontsourceTotal));
if (fontsourceEntries.length > 0) {
  console.log('  (存在！排除规则可能未生效，需重新构建)');
} else {
  console.log('  (已排除 ✓)');
}
console.log('');
console.log('── Top 20 最大文件 ──');
entries
  .sort((a, b) => b.size - a.size)
  .slice(0, 20)
  .forEach((e, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${formatBytes(e.size).padStart(10)}  ${e.path}`);
  });
console.log('════════════════════════════════════════════════');
