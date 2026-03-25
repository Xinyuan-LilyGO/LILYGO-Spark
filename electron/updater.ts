import { app, dialog, shell, BrowserWindow, ipcMain, net } from 'electron';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { getCanaryUpdate, getFakeOldVersion, getSimulateGithubDown } from './config-handler';

// Lightweight main-process i18n for native dialog strings
type UpdaterI18nKey =
  | 'update_title' | 'update_msg' | 'update_detail'
  | 'btn_download' | 'btn_later' | 'btn_restart' | 'btn_cancel' | 'btn_open' | 'btn_close'
  | 'ready_title' | 'ready_msg' | 'ready_detail'
  | 'dl_complete_title' | 'dl_complete_msg'
  | 'all_mirrors_failed'
  | 'hash_verify_failed' | 'win_setup_ready' | 'win_setup_detail'
  | 'win_portable_ready' | 'win_portable_detail'
  | 'linux_appimage_ready' | 'linux_appimage_detail'
  | 'linux_pkg_ready' | 'linux_pkg_detail'
  | 'installing';

const updaterI18n: Record<string, Record<UpdaterI18nKey, string>> = {
  en: {
    update_title: 'Update Available',
    update_msg: 'A new version {{version}} is available. Download now?',
    update_detail: 'Current: {{current}}\nLatest: {{latest}}',
    btn_download: 'Download',
    btn_later: 'Later',
    btn_restart: 'Restart and Update',
    btn_cancel: 'Cancel',
    btn_open: 'Open',
    btn_close: 'Close',
    ready_title: 'Update Ready',
    ready_msg: 'Update downloaded and extracted.',
    ready_detail: 'The application will restart to complete the update.',
    dl_complete_title: 'Download Complete',
    dl_complete_msg: 'Update downloaded to your Downloads folder.',
    all_mirrors_failed: 'All download mirrors failed. Please check your network or use a VPN.',
    hash_verify_failed: 'File integrity check failed. The downloaded file may be corrupted. Please try again.',
    win_setup_ready: 'The installer has been downloaded.',
    win_setup_detail: 'The app will quit and launch the installer. Please follow the setup wizard to complete the update.',
    win_portable_ready: 'The new portable version has been downloaded.',
    win_portable_detail: 'Saved to Downloads folder. Please close this app and replace the current executable with the new one.',
    linux_appimage_ready: 'The new AppImage has been downloaded.',
    linux_appimage_detail: 'The app will quit and replace the current AppImage automatically.',
    linux_pkg_ready: 'The package has been downloaded.',
    linux_pkg_detail: 'Saved to Downloads folder. Please install it manually.',
    installing: 'Installing...',
  },
  'zh-CN': {
    update_title: '发现新版本',
    update_msg: '新版本 {{version}} 已发布，是否立即下载？',
    update_detail: '当前版本：{{current}}\n最新版本：{{latest}}',
    btn_download: '下载',
    btn_later: '稍后',
    btn_restart: '重启并更新',
    btn_cancel: '取消',
    btn_open: '打开',
    btn_close: '关闭',
    ready_title: '更新就绪',
    ready_msg: '更新已下载并解压完成。',
    ready_detail: '应用将重启以完成更新。',
    dl_complete_title: '下载完成',
    dl_complete_msg: '更新已下载到"下载"文件夹。',
    all_mirrors_failed: '所有下载镜像均失败，请检查网络或使用 VPN。',
    hash_verify_failed: '文件完整性校验失败，下载的文件可能已损坏，请重试。',
    win_setup_ready: '安装程序已下载完成。',
    win_setup_detail: '应用将退出并启动安装向导，请按照提示完成更新。',
    win_portable_ready: '新版便携版已下载完成。',
    win_portable_detail: '已保存到"下载"文件夹，请关闭当前应用后用新文件替换旧文件。',
    linux_appimage_ready: '新版 AppImage 已下载完成。',
    linux_appimage_detail: '应用将退出并自动替换当前 AppImage。',
    linux_pkg_ready: '安装包已下载完成。',
    linux_pkg_detail: '已保存到"下载"文件夹，请手动安装。',
    installing: '安装中...',
  },
  'zh-TW': {
    update_title: '發現新版本',
    update_msg: '新版本 {{version}} 已發佈，是否立即下載？',
    update_detail: '當前版本：{{current}}\n最新版本：{{latest}}',
    btn_download: '下載',
    btn_later: '稍後',
    btn_restart: '重啟並更新',
    btn_cancel: '取消',
    btn_open: '開啟',
    btn_close: '關閉',
    ready_title: '更新就緒',
    ready_msg: '更新已下載並解壓完成。',
    ready_detail: '應用將重啟以完成更新。',
    dl_complete_title: '下載完成',
    dl_complete_msg: '更新已下載到「下載」資料夾。',
    all_mirrors_failed: '所有下載鏡像均失敗，請檢查網路或使用 VPN。',
    hash_verify_failed: '檔案完整性驗證失敗，下載的檔案可能已損毀，請重試。',
    win_setup_ready: '安裝程式已下載完成。',
    win_setup_detail: '應用將退出並啟動安裝精靈，請按照提示完成更新。',
    win_portable_ready: '新版可攜式版本已下載完成。',
    win_portable_detail: '已儲存至「下載」資料夾，請關閉目前應用後用新檔案替換舊檔案。',
    linux_appimage_ready: '新版 AppImage 已下載完成。',
    linux_appimage_detail: '應用將退出並自動替換目前的 AppImage。',
    linux_pkg_ready: '安裝套件已下載完成。',
    linux_pkg_detail: '已儲存至「下載」資料夾，請手動安裝。',
    installing: '安裝中...',
  },
  ja: {
    update_title: 'アップデートがあります',
    update_msg: '新しいバージョン {{version}} が利用可能です。ダウンロードしますか？',
    update_detail: '現在のバージョン：{{current}}\n最新バージョン：{{latest}}',
    btn_download: 'ダウンロード',
    btn_later: '後で',
    btn_restart: '再起動して更新',
    btn_cancel: 'キャンセル',
    btn_open: '開く',
    btn_close: '閉じる',
    ready_title: 'アップデート準備完了',
    ready_msg: 'アップデートのダウンロードと展開が完了しました。',
    ready_detail: 'アプリケーションは更新を完了するために再起動します。',
    dl_complete_title: 'ダウンロード完了',
    dl_complete_msg: 'アップデートがダウンロードフォルダに保存されました。',
    all_mirrors_failed: 'すべてのダウンロードミラーが失敗しました。ネットワークを確認するか、VPN を使用してください。',
    hash_verify_failed: 'ファイルの整合性チェックに失敗しました。ダウンロードファイルが破損している可能性があります。再試行してください。',
    win_setup_ready: 'インストーラーのダウンロードが完了しました。',
    win_setup_detail: 'アプリを終了してインストーラーを起動します。セットアップウィザードに従って更新を完了してください。',
    win_portable_ready: '新しいポータブル版のダウンロードが完了しました。',
    win_portable_detail: 'ダウンロードフォルダに保存されました。このアプリを閉じて、新しいファイルで置き換えてください。',
    linux_appimage_ready: '新しい AppImage のダウンロードが完了しました。',
    linux_appimage_detail: 'アプリを終了し、現在の AppImage を自動的に置き換えます。',
    linux_pkg_ready: 'パッケージのダウンロードが完了しました。',
    linux_pkg_detail: 'ダウンロードフォルダに保存されました。手動でインストールしてください。',
    installing: 'インストール中...',
  },
};

let _currentLocale = 'en';
let _localeFromRenderer = '';

function detectLocale(win?: BrowserWindow | null) {
  if (_localeFromRenderer) {
    _currentLocale = _localeFromRenderer;
    return;
  }
  if (win && !win.isDestroyed()) {
    win.webContents.executeJavaScript('localStorage.getItem("i18nextLng")')
      .then((lng: string | null) => {
        if (lng) {
          _localeFromRenderer = lng;
          _currentLocale = lng;
        }
      })
      .catch(() => {});
  }
  // Synchronous fallback from system locale (used until async read completes)
  const sysLocale = app.getLocale();
  if (sysLocale.startsWith('zh-TW') || sysLocale.startsWith('zh-Hant')) _currentLocale = 'zh-TW';
  else if (sysLocale.startsWith('zh')) _currentLocale = 'zh-CN';
  else if (sysLocale.startsWith('ja')) _currentLocale = 'ja';
}

function ut(key: UpdaterI18nKey, vars?: Record<string, string>): string {
  const table = updaterI18n[_currentLocale] || updaterI18n['en'];
  let text = table[key] || updaterI18n['en'][key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{{${k}}}`, v);
    }
  }
  return text;
}

// GitHub Release API URL
const GITHUB_REPO = 'Xinyuan-LilyGO/LILYGO-Spark';
const GITHUB_LATEST_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=1`;

// Cloud function API relay (China-friendly, 10s server-side cache)
const CF_API_BASE = 'https://lilygo-api.bytecode.fun/github-proxy';

// ── Download Mirrors ──
// All mirrors use the "prefix" pattern: MIRROR_PREFIX/https://github.com/...
interface MirrorDef {
  id: string;
  prefix: string; // empty string for origin (no prefix)
}

const DOWNLOAD_MIRRORS: MirrorDef[] = [
  { id: 'origin',      prefix: '' },
  { id: 'ghfast',      prefix: 'https://ghfast.top' },
  { id: 'ghproxy',     prefix: 'https://gh-proxy.com' },
  { id: 'ghproxynet',  prefix: 'https://ghproxy.net' },
];

function applyMirror(mirror: MirrorDef, originalUrl: string): string {
  if (!mirror.prefix) return originalUrl;
  return `${mirror.prefix}/${originalUrl}`;
}

let updateWin: BrowserWindow | null = null;
let _updaterRegistered = false;

export function setupUpdater(win: BrowserWindow) {
  updateWin = win;
  detectLocale(win);

  const isDev = !app.isPackaged;

  if (_updaterRegistered) {
    if (!isDev) {
      setTimeout(() => {
        const isCanary = getCanaryUpdate();
        checkForUpdatesViaAPI(win, isCanary);
      }, 3000);
    }
    return;
  }
  _updaterRegistered = true;

  if (isDev) {
    console.log('[Updater] Development mode — auto-update disabled.');
    ipcMain.handle('check-for-updates', () => {
      sendStatusToWindow('Dev mode: update check disabled.', { devMode: true });
    });
    return;
  }

  ipcMain.handle('check-for-updates', () => {
      const isCanary = getCanaryUpdate();
      if (updateWin && !updateWin.isDestroyed()) {
        checkForUpdatesViaAPI(updateWin, isCanary);
      }
  });

  setTimeout(() => {
      const isCanary = getCanaryUpdate();
      checkForUpdatesViaAPI(win, isCanary);
  }, 3000);
}

function sendStatusToWindow(text: string, data?: any) {
  console.log('[Updater]', text);
  updateWin?.webContents.send('update-message', { text, data });
}

// Custom update check using GitHub API + net.fetch (respects system proxy)
function checkForUpdatesViaAPI(win: BrowserWindow, canary: boolean) {
    console.log('[Updater] Checking for updates via GitHub API (net.fetch)... Canary:', canary);
    
    // If canary is enabled, we check the list of releases (which includes pre-releases)
    // If canary is disabled, we check 'latest' (stable only)
    
    if (canary) {
        fetchRelease(GITHUB_RELEASES_URL, (err, releases) => {
            if (err) {
                 sendStatusToWindow(`Error: ${err.message}`);
                 return;
            }
            if (Array.isArray(releases) && releases.length > 0) {
                processRelease(win, releases[0]);
            } else {
                sendStatusToWindow('Update not available. (No releases found)');
            }
        });
    } else {
        fetchRelease(GITHUB_LATEST_URL, (err, release) => {
            if (err) {
                if (err.statusCode === 404) {
                     console.log('[Updater] Latest release not found (404). Only pre-releases exist.');
                     sendStatusToWindow('App is up to date.');
                } else {
                     sendStatusToWindow(`Error: ${err.message}`);
                }
                return;
            }
            processRelease(win, release);
        });
    }
}

async function fetchRelease(url: string, callback: (err: any, data?: any) => void) {
    const simulateDown = getSimulateGithubDown();
    const API_TIMEOUT = 8000;

    // Determine whether to hit /releases/latest or /releases
    const isLatest = url.includes('/releases/latest');
    const cfUrl = isLatest
        ? `${CF_API_BASE}/releases/latest`
        : `${CF_API_BASE}/releases`;

    // Step 1: Try cloud function API relay (China-friendly)
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), API_TIMEOUT);
        console.log(`[Updater] Fetching release from cloud function: ${cfUrl}`);
        const response = await net.fetch(cfUrl, {
            headers: { 'User-Agent': 'LILYGO-Spark-Updater', 'Accept': 'application/json' },
            signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.status === 404) {
            console.log('[Updater] Cloud function returned 404 — no release found');
            callback({ message: 'Not found', statusCode: 404 });
            return;
        }
        if (response.ok) {
            const json = await response.json();
            console.log('[Updater] Successfully fetched release via cloud function');
            callback(null, json);
            return;
        }
        console.log(`[Updater] Cloud function returned ${response.status}, falling back to GitHub direct`);
    } catch (e: any) {
        console.log(`[Updater] Cloud function failed: ${e.message}, falling back to GitHub direct`);
    }

    // Step 2: Fallback — direct GitHub API
    if (simulateDown) {
        callback({ message: 'All API sources failed (GitHub simulated down)' });
        return;
    }
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), API_TIMEOUT);
        console.log(`[Updater] Fetching release from GitHub direct: ${url}`);
        const response = await net.fetch(url, {
            headers: {
                'User-Agent': 'LILYGO-Spark-Updater',
                'Accept': 'application/vnd.github+json',
            },
            signal: controller.signal,
        });
        clearTimeout(timer);

        if (response.status === 404) {
            console.log('[Updater] GitHub returned 404 — no release found');
            callback({ message: 'Not found', statusCode: 404 });
            return;
        }
        if (response.ok) {
            const json = await response.json();
            console.log('[Updater] Successfully fetched release via GitHub direct');
            callback(null, json);
            return;
        }
        console.log(`[Updater] GitHub returned ${response.status}`);
    } catch (e: any) {
        console.log(`[Updater] GitHub direct failed: ${e.message}`);
    }

    callback({ message: 'All API sources failed' });
}

function processRelease(win: BrowserWindow, release: any) {
    if (!release || !release.tag_name) {
        console.error('[Updater] Invalid release data:', release);
        sendStatusToWindow('Error: Invalid release data received.');
        return;
    }

    const latestVersion = release.tag_name.replace(/^v/, '');
    const realVersion = app.getVersion();
    const fakeOld = getFakeOldVersion();
    const currentVersion = fakeOld ? '0.0.1' : realVersion;

    console.log(`[Updater] Latest: ${latestVersion}, Current: ${currentVersion}${fakeOld ? ' (faked from ' + realVersion + ')' : ''}`);
    console.log(`[Updater] Release URL: ${release.html_url}`);

    if (semverCompare(latestVersion, currentVersion) > 0) {
        sendStatusToWindow('Update available.', { version: latestVersion });
        detectLocale(win);
        
        dialog.showMessageBox(win, {
            type: 'info',
            title: ut('update_title'),
            message: ut('update_msg', { version: latestVersion }),
            detail: ut('update_detail', { current: currentVersion, latest: latestVersion }),
            buttons: [ut('btn_download'), ut('btn_later')],
            defaultId: 0,
            cancelId: 1
        }).then((result) => {
            if (result.response === 0) {
                const assets = release.assets || [];
                const isBlockmap = (a: any) => a.name.includes('blockmap');
                const arch = process.arch; // x64 or arm64

                if (process.platform === 'darwin') {
                    const findMacAsset = (ext: string) => {
                        const matchArch = (name: string, a: string) =>
                            name.includes(`-${a}.`) || name.includes(`-${a}-`);
                        const exact = assets.find((a: any) =>
                            a.name.endsWith(ext) && !isBlockmap(a) && matchArch(a.name, arch));
                        if (exact) return exact;
                        const universal = assets.find((a: any) =>
                            a.name.endsWith(ext) && !isBlockmap(a) && matchArch(a.name, 'universal'));
                        if (universal) return universal;
                        return assets.find((a: any) => a.name.endsWith(ext) && !isBlockmap(a));
                    };
                    const zipAsset = findMacAsset('.zip');
                    const dmgAsset = findMacAsset('.dmg');
                    console.log(`[Updater] macOS arch: ${arch}, zip: ${zipAsset?.name || 'none'}, dmg: ${dmgAsset?.name || 'none'}`);
                    if (zipAsset?.browser_download_url) {
                        installMacUpdate(win, zipAsset.browser_download_url, zipAsset.name, assets);
                    } else if (dmgAsset?.browser_download_url) {
                        downloadToFolder(win, dmgAsset.browser_download_url, dmgAsset.name);
                    } else {
                        shell.openExternal(release.html_url);
                    }
                } else if (process.platform === 'win32') {
                    const exePath = app.getPath('exe').toLowerCase();
                    const isPortable = exePath.includes('portable') || !exePath.includes('appdata');
                    console.log(`[Updater] Windows mode: ${isPortable ? 'portable' : 'setup'}, arch: ${arch}`);

                    const archFilter = (a: any) => a.name.includes(arch);
                    const setupAsset = assets.find((a: any) =>
                        a.name.endsWith('.exe') && !isBlockmap(a) &&
                        a.name.includes('-setup') && archFilter(a));
                    const portableAsset = assets.find((a: any) =>
                        a.name.endsWith('.exe') && !isBlockmap(a) &&
                        a.name.includes('-portable') && archFilter(a));
                    const anyExe = assets.find((a: any) =>
                        a.name.endsWith('.exe') && !isBlockmap(a) && archFilter(a));

                    if (isPortable) {
                        const asset = portableAsset || anyExe;
                        if (asset?.browser_download_url) {
                            installWindowsPortable(win, asset.browser_download_url, asset.name, assets);
                        } else {
                            shell.openExternal(release.html_url);
                        }
                    } else {
                        const asset = setupAsset || anyExe;
                        if (asset?.browser_download_url) {
                            installWindowsSetup(win, asset.browser_download_url, asset.name, assets);
                        } else {
                            shell.openExternal(release.html_url);
                        }
                    }
                } else {
                    const archFilter = (a: any) => a.name.includes(arch);
                    const appImageAsset = assets.find((a: any) =>
                        a.name.endsWith('.AppImage') && !isBlockmap(a) && archFilter(a));
                    const debAsset = assets.find((a: any) =>
                        a.name.endsWith('.deb') && !isBlockmap(a) && archFilter(a));
                    const rpmAsset = assets.find((a: any) =>
                        a.name.endsWith('.rpm') && !isBlockmap(a) && archFilter(a));

                    const currentExe = app.getPath('exe');
                    const isAppImage = currentExe.endsWith('.AppImage') || !!process.env.APPIMAGE;

                    if (isAppImage && appImageAsset?.browser_download_url) {
                        installLinuxAppImage(win, appImageAsset.browser_download_url, appImageAsset.name, assets);
                    } else {
                        const asset = debAsset || rpmAsset || appImageAsset;
                        if (asset?.browser_download_url) {
                            installLinuxPackage(win, asset.browser_download_url, asset.name, assets);
                        } else {
                            shell.openExternal(release.html_url);
                        }
                    }
                }
            }
        });
    } else {
        console.log('[Updater] App is up to date.');
        sendStatusToWindow('App is up to date.', { version: currentVersion });
    }
}

import { exec, spawn } from 'child_process';

// ── Hash Verification ──

async function fetchExpectedHash(assets: any[], targetFilename: string): Promise<string | null> {
    const ymlNames = ['latest.yml', 'latest-mac.yml', 'latest-linux.yml'];
    const ymlAsset = assets.find((a: any) => ymlNames.includes(a.name));
    if (!ymlAsset?.browser_download_url) return null;

    try {
        const resp = await net.fetch(ymlAsset.browser_download_url, {
            headers: { 'User-Agent': 'LILYGO-Spark-Updater' },
        });
        if (!resp.ok) return null;
        const text = await resp.text();

        // Parse simple YAML to find sha512 for the target file
        // Format: path: filename\n  sha512: BASE64HASH\n  size: NUMBER
        const lines = text.split('\n');
        let foundFile = false;
        for (const line of lines) {
            if (line.trim().startsWith('path:') && line.includes(targetFilename)) {
                foundFile = true;
            }
            if (foundFile && line.trim().startsWith('sha512:')) {
                return line.trim().replace('sha512:', '').trim();
            }
            if (foundFile && line.trim().startsWith('path:') && !line.includes(targetFilename)) {
                foundFile = false;
            }
        }
    } catch (e: any) {
        console.log(`[Updater] Failed to fetch hash from yml: ${e.message}`);
    }
    return null;
}

function verifySha512(buffer: Buffer, expectedBase64: string): boolean {
    const actual = crypto.createHash('sha512').update(buffer).digest('base64');
    return actual === expectedBase64;
}

async function downloadAndVerify(
    win: BrowserWindow,
    url: string,
    filename: string,
    assets: any[],
): Promise<{ buffer: Buffer; downloadPath: string } | null> {
    const result = await downloadWithMirrors(win, url);
    if (!result) {
        sendStatusToWindow(ut('all_mirrors_failed'));
        return null;
    }

    const expectedHash = await fetchExpectedHash(assets, filename);
    if (expectedHash) {
        sendStatusToWindow('Verifying file integrity...');
        if (!verifySha512(result.buffer, expectedHash)) {
            console.error('[Updater] SHA-512 verification FAILED');
            sendStatusToWindow(ut('hash_verify_failed'));
            detectLocale(win);
            dialog.showMessageBox(win, {
                type: 'error',
                title: ut('update_title'),
                message: ut('hash_verify_failed'),
                buttons: [ut('btn_close')],
            });
            return null;
        }
        console.log('[Updater] SHA-512 verification passed');
    } else {
        console.log('[Updater] No hash available for verification, skipping');
    }

    const downloadPath = path.join(app.getPath('downloads'), filename);
    fs.writeFileSync(downloadPath, result.buffer);
    return { buffer: result.buffer, downloadPath };
}

// ── Windows: NSIS Setup Install ──

async function installWindowsSetup(win: BrowserWindow, url: string, filename: string, assets: any[]) {
    sendStatusToWindow(ut('installing'));
    const result = await downloadAndVerify(win, url, filename, assets);
    if (!result) return;

    sendStatusToWindow('Download complete. Ready to install.');

    detectLocale(win);
    dialog.showMessageBox(win, {
        type: 'info',
        title: ut('ready_title'),
        message: ut('win_setup_ready'),
        detail: ut('win_setup_detail'),
        buttons: [ut('btn_restart'), ut('btn_later')],
        defaultId: 0,
        cancelId: 1,
    }).then((res) => {
        if (res.response === 0) {
            const child = spawn(result.downloadPath, ['/S', '--force-run'], {
                detached: true,
                stdio: 'ignore',
            });
            child.unref();
            app.quit();
        }
    });
}

// ── Windows: Portable Update ──

async function installWindowsPortable(win: BrowserWindow, url: string, filename: string, assets: any[]) {
    sendStatusToWindow(ut('installing'));
    const result = await downloadAndVerify(win, url, filename, assets);
    if (!result) return;

    sendStatusToWindow('Download complete.');

    detectLocale(win);
    dialog.showMessageBox(win, {
        type: 'info',
        title: ut('dl_complete_title'),
        message: ut('win_portable_ready'),
        detail: ut('win_portable_detail'),
        buttons: [ut('btn_open'), ut('btn_close')],
    }).then((res) => {
        if (res.response === 0) {
            shell.showItemInFolder(result.downloadPath);
        }
    });
}

// ── Linux: AppImage Auto-Replace ──

async function installLinuxAppImage(win: BrowserWindow, url: string, filename: string, assets: any[]) {
    sendStatusToWindow(ut('installing'));
    const result = await downloadAndVerify(win, url, filename, assets);
    if (!result) return;

    sendStatusToWindow('Download complete. Ready to install.');
    const appImagePath = process.env.APPIMAGE || app.getPath('exe');

    detectLocale(win);
    dialog.showMessageBox(win, {
        type: 'info',
        title: ut('ready_title'),
        message: ut('linux_appimage_ready'),
        detail: ut('linux_appimage_detail'),
        buttons: [ut('btn_restart'), ut('btn_later')],
        defaultId: 0,
        cancelId: 1,
    }).then((res) => {
        if (res.response === 0) {
            const tempDir = path.join(app.getPath('temp'), 'spark-update-' + Date.now());
            fs.mkdirSync(tempDir, { recursive: true });
            const scriptPath = path.join(tempDir, 'swap.sh');
            const script = `#!/bin/bash
sleep 1
cp "${result.downloadPath}" "${appImagePath}"
chmod +x "${appImagePath}"
"${appImagePath}" &
`;
            fs.writeFileSync(scriptPath, script, { mode: 0o755 });
            const child = spawn('/bin/bash', [scriptPath], {
                detached: true,
                stdio: 'ignore',
            });
            child.unref();
            app.quit();
        }
    });
}

// ── Linux: deb/rpm Package Download ──

async function installLinuxPackage(win: BrowserWindow, url: string, filename: string, assets: any[]) {
    sendStatusToWindow(ut('installing'));
    const result = await downloadAndVerify(win, url, filename, assets);
    if (!result) return;

    sendStatusToWindow('Download complete.');

    detectLocale(win);
    dialog.showMessageBox(win, {
        type: 'info',
        title: ut('dl_complete_title'),
        message: ut('linux_pkg_ready'),
        detail: ut('linux_pkg_detail'),
        buttons: [ut('btn_open'), ut('btn_close')],
    }).then((res) => {
        if (res.response === 0) {
            shell.showItemInFolder(result.downloadPath);
        }
    });
}

const RACE_WINDOW_MS = 3000;

interface RaceCandidate {
  mirror: MirrorDef;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  total: number;
  received: number;
  chunks: Buffer[];
  abortController: AbortController;
  speed: number;
  lastTime: number;
  lastBytes: number;
}

async function downloadWithMirrors(
    win: BrowserWindow,
    originalUrl: string,
): Promise<{ buffer: Buffer; mirrorId: string } | null> {
    const simulateDown = getSimulateGithubDown();
    const mirrors = simulateDown
        ? DOWNLOAD_MIRRORS.filter(m => m.id !== 'origin')
        : DOWNLOAD_MIRRORS;

    sendStatusToWindow(`Racing ${mirrors.length} mirrors...`);

    // Phase 1: Start all downloads concurrently
    const candidates: RaceCandidate[] = [];
    const startPromises = mirrors.map(async (mirror) => {
        const mirrorUrl = applyMirror(mirror, originalUrl);
        const ac = new AbortController();
        try {
            const response = await net.fetch(mirrorUrl, {
                headers: { 'User-Agent': 'LILYGO-Spark-Updater' },
                signal: ac.signal,
            });
            if (!response.ok || !response.body) {
                console.log(`[Race] ${mirror.id} returned ${response.status}`);
                return null;
            }
            const total = parseInt(response.headers.get('content-length') || '0', 10);
            const reader = response.body.getReader();
            const c: RaceCandidate = {
                mirror, reader, total,
                received: 0, chunks: [],
                abortController: ac,
                speed: 0, lastTime: Date.now(), lastBytes: 0,
            };
            candidates.push(c);
            return c;
        } catch (e: any) {
            console.log(`[Race] ${mirror.id} connect failed: ${e.message}`);
            return null;
        }
    });

    await Promise.allSettled(startPromises);

    if (candidates.length === 0) {
        sendStatusToWindow(ut('all_mirrors_failed'));
        return null;
    }

    // Phase 2: Read data from all candidates for RACE_WINDOW_MS, then pick winner
    const raceDeadline = Date.now() + RACE_WINDOW_MS;

    async function readChunk(c: RaceCandidate): Promise<boolean> {
        try {
            const { done, value } = await c.reader.read();
            if (done) return true;
            c.chunks.push(Buffer.from(value));
            c.received += value.byteLength;
            const now = Date.now();
            const elapsed = now - c.lastTime;
            if (elapsed >= 400) {
                c.speed = Math.round(((c.received - c.lastBytes) / elapsed) * 1000);
                c.lastTime = now;
                c.lastBytes = c.received;
            }
            return false;
        } catch {
            return true;
        }
    }

    // Read in round-robin until race window expires
    while (Date.now() < raceDeadline && candidates.length > 0) {
        const readPromises = candidates.map(async (c) => {
            const done = await readChunk(c);
            return { c, done };
        });
        const results = await Promise.allSettled(readPromises);
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value.done) {
                // This candidate finished the entire download during the race window
                const winner = r.value.c;
                // Abort all others
                for (const other of candidates) {
                    if (other !== winner) {
                        try { other.abortController.abort(); } catch {}
                    }
                }
                console.log(`[Race] ${winner.mirror.id} completed during race window (${winner.received} bytes)`);
                return { buffer: Buffer.concat(winner.chunks), mirrorId: winner.mirror.id };
            }
        }
    }

    // Pick the mirror that downloaded the most bytes
    candidates.sort((a, b) => b.received - a.received);
    const winner = candidates[0];
    console.log(`[Race] Winner: ${winner.mirror.id} with ${winner.received} bytes in race window (speed ~${winner.speed} B/s)`);
    sendStatusToWindow(`Selected mirror: ${winner.mirror.id} (fastest)`);

    // Abort losers
    for (let i = 1; i < candidates.length; i++) {
        try { candidates[i].abortController.abort(); } catch {}
    }

    // Phase 3: Continue downloading from winner
    while (true) {
        const done = await readChunk(winner);
        if (done) break;
        if (winner.total > 0) {
            win.webContents.send('update-progress', {
                percent: (winner.received / winner.total) * 100,
                transferred: winner.received,
                total: winner.total,
                bytesPerSecond: winner.speed,
            });
        }
    }

    console.log(`[Race] Download complete via ${winner.mirror.id} (${winner.received} bytes total)`);
    return { buffer: Buffer.concat(winner.chunks), mirrorId: winner.mirror.id };
}

async function installMacUpdate(win: BrowserWindow, url: string, filename: string, assets: any[]) {
    sendStatusToWindow(ut('installing'));
    const verified = await downloadAndVerify(win, url, filename, assets);
    if (!verified) return;
    const downloadPath = verified.downloadPath;

    sendStatusToWindow('Download complete. Preparing to install...');

    const tempDir = path.join(app.getPath('temp'), 'spark-update-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    exec(`unzip -o "${downloadPath}" -d "${tempDir}"`, (err) => {
        if (err) {
            sendStatusToWindow(`Unzip error: ${err.message}`);
            return;
        }

        const files = fs.readdirSync(tempDir);
        const appName = files.find(f => f.endsWith('.app'));
        if (!appName) {
            sendStatusToWindow('Error: No .app found in update');
            return;
        }

        const newAppPath = path.join(tempDir, appName);
        const currentAppPath = app.getPath('exe').split('.app')[0] + '.app';

        sendStatusToWindow(`Ready to replace ${currentAppPath} with ${newAppPath}`);

        detectLocale(win);
        dialog.showMessageBox(win, {
            type: 'info',
            title: ut('ready_title'),
            message: ut('ready_msg'),
            detail: ut('ready_detail'),
            buttons: [ut('btn_restart'), ut('btn_cancel')]
        }).then((res) => {
            if (res.response === 0) {
                const scriptPath = path.join(tempDir, 'swap.sh');
                const script = `#!/bin/bash
sleep 1
echo "Replacing app..."
rm -rf "${currentAppPath}"
mv "${newAppPath}" "${currentAppPath}"
xattr -cr "${currentAppPath}"
open "${currentAppPath}"
`;
                fs.writeFileSync(scriptPath, script, { mode: 0o755 });

                const child = spawn('/bin/bash', [scriptPath], {
                    detached: true,
                    stdio: 'ignore',
                });
                child.unref();
                app.quit();
            }
        });
    });
}

async function downloadToFolder(win: BrowserWindow, url: string, filename: string) {
    const downloadPath = path.join(app.getPath('downloads'), filename);
    const result = await downloadWithMirrors(win, url);

    if (!result) {
        sendStatusToWindow(ut('all_mirrors_failed'));
        return;
    }

    fs.writeFileSync(downloadPath, result.buffer);
    sendStatusToWindow('Download complete.');

    detectLocale(win);
    dialog.showMessageBox(win, {
        type: 'info',
        title: ut('dl_complete_title'),
        message: ut('dl_complete_msg'),
        detail: `File: ${filename}`,
        buttons: [ut('btn_open'), ut('btn_close')]
    }).then((res) => {
        if (res.response === 0) {
            shell.showItemInFolder(downloadPath);
        }
    });
}


/**
 * Compare two SemVer strings.
 * Returns:
 * - 1 if a > b
 * - -1 if a < b
 * - 0 if a == b
 */
function semverCompare(a: string, b: string): number {
    // Helper to parse version string into [major, minor, patch, prerelease]
    const parse = (v: string) => {
        // Strip 'v' prefix
        v = v.replace(/^v/, '');
        // Split into [core, prerelease]
        const [core, pre] = v.split('-');
        const [major, minor, patch] = core.split('.').map(Number);
        return { 
            major: isNaN(major) ? 0 : major, 
            minor: isNaN(minor) ? 0 : minor, 
            patch: isNaN(patch) ? 0 : patch, 
            pre: pre ? pre.split('.') : [] 
        };
    };

    const va = parse(a);
    const vb = parse(b);

    // 1. Compare Major, Minor, Patch
    if (va.major !== vb.major) return va.major > vb.major ? 1 : -1;
    if (va.minor !== vb.minor) return va.minor > vb.minor ? 1 : -1;
    if (va.patch !== vb.patch) return va.patch > vb.patch ? 1 : -1;

    // 2. Compare Pre-release
    // If one has pre-release and the other doesn't, the one WITHOUT is newer (Stable > Pre-release)
    if (va.pre.length === 0 && vb.pre.length > 0) return 1;
    if (va.pre.length > 0 && vb.pre.length === 0) return -1;
    if (va.pre.length === 0 && vb.pre.length === 0) return 0;

    // 3. Compare Pre-release identifiers
    let i = 0;
    while (i < va.pre.length && i < vb.pre.length) {
        const partA = va.pre[i];
        const partB = vb.pre[i];
        
        // Check if parts are numeric
        const isNumA = /^\d+$/.test(partA);
        const isNumB = /^\d+$/.test(partB);

        if (isNumA && isNumB) {
            // Both numeric: compare numerically
            const numA = Number(partA);
            const numB = Number(partB);
            if (numA !== numB) return numA > numB ? 1 : -1;
        } else if (!isNumA && !isNumB) {
            // Both string: compare lexically
            if (partA !== partB) return partA.localeCompare(partB);
        } else {
            // One numeric, one string: Numeric has lower precedence
            return isNumA ? -1 : 1;
        }
        i++;
    }

    // 4. Larger set of pre-release fields has higher precedence
    if (va.pre.length !== vb.pre.length) {
        return va.pre.length > vb.pre.length ? 1 : -1;
    }

    return 0;
}

// ── Network Probe ──
export interface ProbeNodeResult {
  id: string;
  label: string;
  type: 'api' | 'download';
  url: string;
  status: 'pending' | 'testing' | 'success' | 'error' | 'timeout';
  httpCode?: number;
  error?: string;
  bytesDownloaded?: number;
  durationMs?: number;
  speedBps?: number;
}

const PROBE_DURATION_MS = 5000;

export function registerNetworkProbeIPC() {
  ipcMain.handle('network-probe', async (_event): Promise<ProbeNodeResult[]> => {
    const simulateDown = getSimulateGithubDown();
    const isCanary = getCanaryUpdate();
    const apiUrl = isCanary ? GITHUB_RELEASES_URL : GITHUB_LATEST_URL;

    // Build probe list
    const nodes: ProbeNodeResult[] = [
      {
        id: 'cf-api', label: 'Cloud Function API', type: 'api',
        url: isCanary ? `${CF_API_BASE}/releases` : `${CF_API_BASE}/releases/latest`,
        status: 'pending',
      },
      {
        id: 'github-api', label: 'GitHub API (direct)', type: 'api',
        url: apiUrl,
        status: 'pending',
      },
    ];

    // Add download mirrors
    for (const m of DOWNLOAD_MIRRORS) {
      nodes.push({
        id: `dl-${m.id}`, label: `Download: ${m.id}`, type: 'download',
        url: '', // filled later once we know the asset URL
        status: 'pending',
      });
    }

    // Step 1: Probe API endpoints to get a test asset URL
    let testAssetUrl = '';

    for (const apiNode of nodes.filter(n => n.type === 'api')) {
      apiNode.status = 'testing';
      const start = Date.now();
      try {
        if (simulateDown && apiNode.id === 'github-api') {
          throw new Error('Simulated GitHub down');
        }
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 8000);
        const resp = await net.fetch(apiNode.url, {
          headers: { 'User-Agent': 'LILYGO-Spark-Updater', 'Accept': 'application/json' },
          signal: ac.signal,
        });
        clearTimeout(timer);
        apiNode.durationMs = Date.now() - start;
        apiNode.httpCode = resp.status;

        if (resp.ok) {
          apiNode.status = 'success';
          if (!testAssetUrl) {
            const json = await resp.json();
            const release = Array.isArray(json) ? json[0] : json;
            if (release?.assets) {
              testAssetUrl = pickTestAsset(release.assets);
            }
          }
        } else {
          apiNode.status = 'error';
          apiNode.error = `HTTP ${resp.status}`;
        }
      } catch (e: any) {
        apiNode.durationMs = Date.now() - start;
        if (e.name === 'AbortError') {
          apiNode.status = 'timeout';
          apiNode.error = 'Timeout (8s)';
        } else {
          apiNode.status = 'error';
          apiNode.error = e.message;
        }
      }
    }

    // Step 2: Probe download mirrors concurrently
    if (!testAssetUrl) {
      for (const dlNode of nodes.filter(n => n.type === 'download')) {
        dlNode.status = 'error';
        dlNode.error = 'No release asset URL available for testing';
      }
      return nodes;
    }

    const dlNodes = nodes.filter(n => n.type === 'download');
    const dlPromises = dlNodes.map(async (node, idx) => {
      const mirror = DOWNLOAD_MIRRORS[idx];
      if (simulateDown && mirror.id === 'origin') {
        node.status = 'error';
        node.error = 'Simulated GitHub down';
        return;
      }

      const mirrorUrl = applyMirror(mirror, testAssetUrl);
      node.url = mirrorUrl;
      node.status = 'testing';

      const start = Date.now();
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), PROBE_DURATION_MS + 2000);

      try {
        const resp = await net.fetch(mirrorUrl, {
          headers: { 'User-Agent': 'LILYGO-Spark-Updater' },
          signal: ac.signal,
        });

        if (!resp.ok || !resp.body) {
          clearTimeout(timer);
          node.durationMs = Date.now() - start;
          node.httpCode = resp.status;
          node.status = 'error';
          node.error = `HTTP ${resp.status}`;
          return;
        }

        node.httpCode = resp.status;
        const reader = resp.body.getReader();
        let bytes = 0;
        const deadline = Date.now() + PROBE_DURATION_MS;

        while (Date.now() < deadline) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
        }

        clearTimeout(timer);
        try { ac.abort(); } catch {}

        const elapsed = Date.now() - start;
        node.bytesDownloaded = bytes;
        node.durationMs = elapsed;
        node.speedBps = elapsed > 0 ? Math.round((bytes / elapsed) * 1000) : 0;
        node.status = 'success';
      } catch (e: any) {
        clearTimeout(timer);
        node.durationMs = Date.now() - start;
        if (e.name === 'AbortError') {
          // Likely hit our deadline abort — still calculate speed from whatever we got
          if (node.bytesDownloaded && node.bytesDownloaded > 0) {
            node.speedBps = Math.round((node.bytesDownloaded / (node.durationMs || 1)) * 1000);
            node.status = 'success';
          } else {
            node.status = 'timeout';
            node.error = `Timeout (${PROBE_DURATION_MS / 1000}s)`;
          }
        } else {
          node.status = 'error';
          node.error = e.message;
        }
      }
    });

    await Promise.allSettled(dlPromises);
    return nodes;
  });
}

function pickTestAsset(assets: any[]): string {
  const platform = process.platform;
  const isBlockmap = (a: any) => a.name?.includes('blockmap');
  const isYml = (a: any) => a.name?.endsWith('.yml') || a.name?.endsWith('.yaml');

  let candidates = assets.filter((a: any) => !isBlockmap(a) && !isYml(a) && a.browser_download_url);

  if (platform === 'darwin') {
    const mac = candidates.find((a: any) => a.name?.endsWith('.zip') || a.name?.endsWith('.dmg'));
    if (mac) return mac.browser_download_url;
  } else if (platform === 'win32') {
    const win = candidates.find((a: any) => a.name?.endsWith('.exe'));
    if (win) return win.browser_download_url;
  } else {
    const linux = candidates.find((a: any) => a.name?.endsWith('.AppImage') || a.name?.endsWith('.deb'));
    if (linux) return linux.browser_download_url;
  }

  if (candidates.length > 0) return candidates[0].browser_download_url;
  return '';
}
