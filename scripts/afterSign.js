const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * electron-builder afterSign hook.
 *
 * Ensures esptool binary inside the .app bundle is properly signed with
 * hardened runtime and entitlements matching the parent app.
 *
 * electron-builder should have already signed it during its recursive
 * signing pass, but we verify and re-sign if needed to guarantee esptool
 * works correctly under Gatekeeper (no "unverified developer" errors
 * when flashing firmware).
 */
exports.default = async function afterSign(context) {
  if (process.platform !== 'darwin') return;

  const appOutDir = context.appOutDir;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const esptoolPath = path.join(appPath, 'Contents', 'Resources', 'tools', 'esptool');

  if (!fs.existsSync(esptoolPath)) {
    console.log('[afterSign] esptool not found, skipping');
    return;
  }

  const identity = context.packager.platformSpecificBuildOptions.identity
    || process.env.CSC_NAME;

  if (!identity) {
    console.log('[afterSign] No signing identity available, skipping');
    return;
  }

  // Check if esptool is already properly signed (not adhoc)
  try {
    const info = execSync(`codesign -dv "${esptoolPath}" 2>&1`, { encoding: 'utf-8' });
    if (info.includes('Authority=Developer ID') || info.includes(identity.split('(')[0].trim())) {
      console.log('[afterSign] esptool already signed with Developer ID, OK');
      return;
    }
    console.log('[afterSign] esptool signature info:', info.split('\n').slice(0, 5).join('\n'));
  } catch (e) {
    // codesign -dv may fail if not signed at all
  }

  const entitlements = path.resolve(__dirname, '..', 'resources', 'mac', 'entitlements.mac.plist');

  console.log(`[afterSign] Signing esptool with: ${identity}`);
  try {
    execSync(
      `codesign --force --options runtime --sign "${identity}" --entitlements "${entitlements}" "${esptoolPath}"`,
      { stdio: 'inherit' }
    );

    // Re-sign the app to update its seal (since we modified a nested binary)
    execSync(
      `codesign --force --options runtime --sign "${identity}" --entitlements "${entitlements}" "${appPath}"`,
      { stdio: 'inherit' }
    );

    console.log('[afterSign] esptool + app re-signed successfully');
  } catch (err) {
    console.error('[afterSign] Signing failed:', err.message);
    throw err;
  }
};
