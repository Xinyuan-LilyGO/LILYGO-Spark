const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * electron-builder afterPack hook.
 *
 * When cross-compiling (e.g. building linux-arm64 on an x86_64 runner),
 * electron-builder rebuilds native modules for the HOST architecture,
 * producing an x86_64 bindings.node in build/Release/.
 *
 * node-gyp-build loads build/Release/ FIRST — if the file exists but is
 * the wrong arch, dlopen crashes with no fallback to prebuilds/.
 *
 * This hook deletes the build/Release directory from the unpacked asar
 * when the target arch differs from the host, so node-gyp-build falls
 * through to the correct prebuild binary.
 */
exports.default = async function afterPack(context) {
  const targetArch = context.arch === 1 ? 'x64' : context.arch === 3 ? 'arm64' : String(context.arch);
  const hostArch = os.arch();

  console.log(`afterPack: host=${hostArch}, target=${targetArch}`);

  if (targetArch === hostArch) {
    console.log('afterPack: same arch, skipping cleanup');
    return;
  }

  const appOutDir = context.appOutDir;
  const bindingsBuildDir = path.join(
    appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    '@serialport',
    'bindings-cpp',
    'build'
  );

  if (fs.existsSync(bindingsBuildDir)) {
    console.log(`afterPack: removing wrong-arch native build at ${bindingsBuildDir}`);
    fs.rmSync(bindingsBuildDir, { recursive: true, force: true });
  } else {
    console.log('afterPack: no build/ directory found, nothing to clean');
  }
};
