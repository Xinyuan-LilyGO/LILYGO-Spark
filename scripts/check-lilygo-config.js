#!/usr/bin/env node
/**
 * 打包前校验：确保 lilygo_config.json 存在且包含必填字段。
 * 在 npm run prebuild 中调用，缺字段时直接报错退出。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'lilygo_config.json');
const REQUIRED_KEYS = ['api_base_url', 'firmware_manifest_url', 'oss_domain_prefix'];

function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('错误: 未找到 lilygo_config.json，请确保仓库根目录存在该文件。');
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (e) {
    console.error('错误: lilygo_config.json 不是合法 JSON:', e.message);
    process.exit(1);
  }
  if (!data || typeof data !== 'object') {
    console.error('错误: lilygo_config.json 必须是一个 JSON 对象。');
    process.exit(1);
  }
  const missing = REQUIRED_KEYS.filter(k => !(typeof data[k] === 'string' && data[k].trim().length > 0));
  if (missing.length) {
    console.error('错误: lilygo_config.json 缺少必填字段或值为空:', missing.join(', '));
    process.exit(1);
  }
  console.log('lilygo_config.json 校验通过');
}

main();
