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

// 检测是否有签名证书（CI 通过 apple-actions/import-codesign-certs 导入）
const hasSigningCert = !!process.env.MAC_CERTS_P12;

const macOverrides = { ...base.mac };
if (!hasSigningCert) {
  macOverrides.identity = null;
  console.log('[electron-builder config] Signing SKIPPED (no MAC_CERTS_P12)');
} else {
  console.log('[electron-builder config] Signing ENABLED');
}
// 公证由 CI 独立 step 处理（xcrun notarytool），不在 electron-builder 内执行
macOverrides.notarize = false;
console.log('[electron-builder config] Notarization handled externally (not by electron-builder)');

module.exports = {
  ...base,
  files: mergedFiles,
  mac: macOverrides,
};
