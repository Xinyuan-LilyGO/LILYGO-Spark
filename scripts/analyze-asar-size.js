#!/usr/bin/env node
/**
 * Electron app.asar 体积分析脚本
 * 使用 @electron/asar 的 getRawHeader 读取 header 中的 size，无需解压即可统计
 *
 * 用法:
 *   node scripts/analyze-asar-size.js [path/to/app.asar]
 *   node scripts/analyze-asar-size.js release/mac/LILYGO\ Spark.app/Contents/Resources/app.asar
 *
 * 若未传参数，会尝试自动查找 release 目录下的 app.asar
 */

const path = require('path');
const fs = require('fs');

// 递归收集 asar header 中的文件及大小
function walkHeader(obj, prefix = '', result = []) {
  if (!obj || typeof obj !== 'object') return result;

  const files = obj.files || obj;
  if (typeof files !== 'object') return result;

  for (const [name, entry] of Object.entries(files)) {
    const fullPath = prefix ? `${prefix}/${name}` : name;

    if (entry.files) {
      // 目录
      walkHeader(entry, fullPath, result);
    } else if (typeof entry.size === 'number') {
      // 文件
      result.push({ path: fullPath, size: entry.size });
    }
    // link 等忽略
  }
  return result;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function findAppAsar(baseDir) {
  const candidates = [
    path.join(baseDir, 'release/mac/LILYGO Spark.app/Contents/Resources/app.asar'),
    path.join(baseDir, 'release/mac-arm64/LILYGO Spark.app/Contents/Resources/app.asar'),
    path.join(baseDir, 'release/mac-universal/LILYGO Spark.app/Contents/Resources/app.asar'),
    path.join(baseDir, 'release/win-unpacked/resources/app.asar'),
    path.join(baseDir, 'release/linux-unpacked/resources/app.asar'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function analyzeAsar(asarPath) {
  let asar;
  try {
    asar = require('@electron/asar');
  } catch (e) {
    console.error('需要安装 @electron/asar: npm install --save-dev @electron/asar');
    process.exit(1);
  }

  if (!fs.existsSync(asarPath)) {
    console.error('文件不存在:', asarPath);
    process.exit(1);
  }

  const stat = fs.statSync(asarPath);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Electron ASAR 体积分析');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('路径:', asarPath);
  console.log('asar 文件大小:', formatBytes(stat.size));
  console.log('');

  const { getRawHeader } = asar;
  const { header } = getRawHeader(asarPath);

  const entries = walkHeader(header);
  const totalSize = entries.reduce((sum, e) => sum + e.size, 0);
  console.log('内部文件总数:', entries.length);
  console.log('内部总大小:', formatBytes(totalSize));
  console.log('');

  // 按大小排序
  entries.sort((a, b) => b.size - a.size);

  // 按目录分组统计
  const dirSizes = new Map();
  for (const { path: p, size } of entries) {
    const parts = p.split('/');
    const topDir = parts[0] || '(root)';
    dirSizes.set(topDir, (dirSizes.get(topDir) || 0) + size);
  }
  const sortedDirs = [...dirSizes.entries()].sort((a, b) => b[1] - a[1]);

  console.log('── 按顶层目录 ──');
  for (const [dir, size] of sortedDirs) {
    const pct = totalSize > 0 ? ((size / totalSize) * 100).toFixed(1) : '0';
    console.log(`  ${dir.padEnd(20)} ${formatBytes(size).padStart(12)}  ${pct}%`);
  }
  console.log('');

  console.log('── Top 30 最大文件 ──');
  entries.slice(0, 30).forEach((e, i) => {
    const pct = totalSize > 0 ? ((e.size / totalSize) * 100).toFixed(2) : '0';
    const display = e.path.length > 55 ? '...' + e.path.slice(-52) : e.path;
    console.log(`  ${String(i + 1).padStart(2)}. ${display.padEnd(58)} ${formatBytes(e.size).padStart(10)}  ${pct}%`);
  });
  console.log('');

  // node_modules 相关统计
  const nodeModulesEntries = entries.filter((e) => e.path.startsWith('node_modules/'));
  const nmSize = nodeModulesEntries.reduce((s, e) => s + e.size, 0);
  if (nodeModulesEntries.length > 0) {
    console.log('── node_modules ──');
    console.log('  文件数:', nodeModulesEntries.length);
    console.log('  总大小:', formatBytes(nmSize), `(${totalSize > 0 ? ((nmSize / totalSize) * 100).toFixed(1) : 0}%)`);
    const nmByPackage = new Map();
    for (const { path: p, size } of nodeModulesEntries) {
      const pkg = p.split('/')[1] || 'unknown';
      nmByPackage.set(pkg, (nmByPackage.get(pkg) || 0) + size);
    }
    const topPkgs = [...nmByPackage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    console.log('  Top 15 包:');
    topPkgs.forEach(([pkg, size]) => {
      console.log(`    ${pkg.padEnd(35)} ${formatBytes(size)}`);
    });
  }
  console.log('═══════════════════════════════════════════════════════════');
}

const asarPath = process.argv[2];
const projectRoot = path.resolve(__dirname, '..');

if (asarPath) {
  const resolved = path.isAbsolute(asarPath) ? asarPath : path.resolve(projectRoot, asarPath);
  analyzeAsar(resolved);
} else {
  const found = findAppAsar(projectRoot);
  if (found) {
    analyzeAsar(found);
  } else {
    console.error('未找到 app.asar，请先执行构建或指定路径:');
    console.error('  node scripts/analyze-asar-size.js <path/to/app.asar>');
    process.exit(1);
  }
}
