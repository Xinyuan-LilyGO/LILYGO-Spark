#!/usr/bin/env node
/**
 * macOS 构建时临时排除 @fontsource（约 137MB）
 * pre: 重命名为 .bak，构建时不会被打包
 * post: 恢复，以便后续 Win/Linux 构建或 dev 使用
 *
 * 用法: node scripts/exclude-fontsource-mac.js pre|post
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const fontsourceDir = path.join(projectRoot, 'node_modules/@fontsource');
const backupDir = path.join(projectRoot, 'node_modules/@fontsource.mac-build-bak');

const cmd = process.argv[2];

if (cmd === 'pre') {
  if (fs.existsSync(fontsourceDir)) {
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true });
    }
    fs.renameSync(fontsourceDir, backupDir);
    console.log('[exclude-fontsource-mac] Moved @fontsource -> @fontsource.mac-build-bak');
  }
} else if (cmd === 'post') {
  if (fs.existsSync(backupDir)) {
    if (fs.existsSync(fontsourceDir)) {
      fs.rmSync(fontsourceDir, { recursive: true });
    }
    fs.renameSync(backupDir, fontsourceDir);
    console.log('[exclude-fontsource-mac] Restored @fontsource');
  }
} else {
  console.error('Usage: node exclude-fontsource-mac.js pre|post');
  process.exit(1);
}
