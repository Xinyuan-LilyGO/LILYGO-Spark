import { app, dialog, shell, BrowserWindow, ipcMain, net } from 'electron';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
import fs from 'fs';
import path from 'path';

import { getCanaryUpdate, getFakeOldVersion } from './config-handler';

// Lightweight main-process i18n for native dialog strings
type UpdaterI18nKey =
  | 'update_title' | 'update_msg' | 'update_detail'
  | 'btn_download' | 'btn_later' | 'btn_restart' | 'btn_cancel' | 'btn_open' | 'btn_close'
  | 'ready_title' | 'ready_msg' | 'ready_detail'
  | 'dl_complete_title' | 'dl_complete_msg'
  | 'all_mirrors_failed';

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

// GitHub download accelerator mirrors (for users in China)
const GITHUB_DOWNLOAD_MIRRORS = [
  (url: string) => url, // original
  (url: string) => url.replace('github.com', 'ghfast.top'),
  (url: string) => url.replace('github.com', 'gh-proxy.com'),
];

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
        autoUpdater.allowPrerelease = isCanary;
        if (process.platform === 'darwin') {
          checkForUpdatesViaAPI(win, isCanary);
        } else {
          autoUpdater.checkForUpdatesAndNotify();
        }
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

  const canary = getCanaryUpdate();
  console.log('[Updater] Canary channel:', canary);

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = canary;

  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for update...');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    sendStatusToWindow('Update available.', info);
    if (!updateWin || updateWin.isDestroyed()) return;
    detectLocale(updateWin);
    dialog.showMessageBox(updateWin, {
      type: 'info',
      title: ut('update_title'),
      message: ut('update_msg', { version: info.version }),
      buttons: [ut('btn_download'), ut('btn_later')]
    }).then((result) => {
      if (result.response === 0) {
        if (process.platform === 'darwin') {
           const isCanary = getCanaryUpdate();
           checkForUpdatesViaAPI(updateWin!, isCanary); 
        } else {
           autoUpdater.downloadUpdate();
        }
      }
    });
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    sendStatusToWindow('Update not available.', info);
  });

  autoUpdater.on('error', (err: Error) => {
    console.log('[Updater] electron-updater error, falling back to GitHub API check:', err.message);
    // Fallback: use our custom GitHub API check (uses net.fetch which respects system proxy)
    const isCanary = getCanaryUpdate();
    if (updateWin && !updateWin.isDestroyed()) {
      sendStatusToWindow('Built-in updater failed, trying alternative check...');
      checkForUpdatesViaAPI(updateWin, isCanary);
    }
  });

  autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    sendStatusToWindow(log_message, progressObj);
    updateWin?.webContents.send('update-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    sendStatusToWindow('Update downloaded', info);
    if (!updateWin || updateWin.isDestroyed()) return;
    detectLocale(updateWin);
    dialog.showMessageBox(updateWin, {
      type: 'info',
      title: ut('ready_title'),
      message: ut('ready_msg'),
      detail: ut('ready_detail'),
      buttons: [ut('btn_restart'), ut('btn_later')]
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  ipcMain.handle('check-for-updates', () => {
      const isCanary = getCanaryUpdate();
      autoUpdater.allowPrerelease = isCanary;
      
      if (process.platform === 'darwin') {
          if (updateWin && !updateWin.isDestroyed()) {
            checkForUpdatesViaAPI(updateWin, isCanary);
          }
      } else {
          autoUpdater.checkForUpdatesAndNotify();
      }
  });

  setTimeout(() => {
      const isCanary = getCanaryUpdate();
      autoUpdater.allowPrerelease = isCanary;

      if (process.platform === 'darwin') {
          checkForUpdatesViaAPI(win, isCanary);
      } else {
          autoUpdater.checkForUpdatesAndNotify();
      }
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
                // If latest not found (404), maybe only pre-releases exist?
                // But user didn't ask for canary, so we should probably report "no stable update"
                // Or we can be nice and say "No stable release found".
                if (err.statusCode === 404) {
                     console.log('[Updater] Latest release not found (404).');
                     sendStatusToWindow('App is up to date. (No stable release found)');
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
    try {
        // net.fetch uses Chromium's network stack which respects system proxy settings
        const response = await net.fetch(url, {
            headers: {
                'User-Agent': 'LILYGO-Spark-Updater',
                'Accept': 'application/vnd.github+json',
            },
        });

        if (!response.ok) {
            callback({ message: `GitHub API returned ${response.status}`, statusCode: response.status });
            return;
        }

        const json = await response.json();
        callback(null, json);
    } catch (e: any) {
        callback(e);
    }
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

                if (process.platform === 'darwin') {
                    const zipAsset = assets.find((a: any) => a.name.endsWith('.zip') && !isBlockmap(a));
                    const dmgAsset = assets.find((a: any) => a.name.endsWith('.dmg') && !isBlockmap(a));
                    if (zipAsset?.browser_download_url) {
                        installMacUpdate(win, zipAsset.browser_download_url, zipAsset.name);
                    } else if (dmgAsset?.browser_download_url) {
                        downloadToFolder(win, dmgAsset.browser_download_url, dmgAsset.name);
                    } else {
                        shell.openExternal(release.html_url);
                    }
                } else if (process.platform === 'win32') {
                    const exeAsset = assets.find((a: any) => a.name.endsWith('.exe') && !isBlockmap(a));
                    if (exeAsset?.browser_download_url) {
                        downloadToFolder(win, exeAsset.browser_download_url, exeAsset.name, true);
                    } else {
                        shell.openExternal(release.html_url);
                    }
                } else {
                    const appImage = assets.find((a: any) => a.name.endsWith('.AppImage') && !isBlockmap(a));
                    const debAsset = assets.find((a: any) => a.name.endsWith('.deb') && !isBlockmap(a));
                    const asset = appImage || debAsset;
                    if (asset?.browser_download_url) {
                        downloadToFolder(win, asset.browser_download_url, asset.name);
                    } else {
                        shell.openExternal(release.html_url);
                    }
                }
            }
        });
    } else {
        console.log('[Updater] App is up to date.');
        sendStatusToWindow('App is up to date.', { version: currentVersion });
    }
}

import { exec } from 'child_process';

async function installMacUpdate(win: BrowserWindow, url: string, filename: string) {
    const downloadPath = path.join(app.getPath('downloads'), filename);

    for (const mirrorFn of GITHUB_DOWNLOAD_MIRRORS) {
        const mirrorUrl = mirrorFn(url);
        sendStatusToWindow(`Downloading from ${new URL(mirrorUrl).host}...`);

        try {
            const response = await net.fetch(mirrorUrl, {
                headers: { 'User-Agent': 'LILYGO-Spark-Updater' },
            });

            if (!response.ok || !response.body) {
                sendStatusToWindow(`Mirror ${new URL(mirrorUrl).host} returned ${response.status}, trying next...`);
                continue;
            }

            const total = parseInt(response.headers.get('content-length') || '0', 10);
            let cur = 0;
            const chunks: Buffer[] = [];
            const reader = response.body.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(Buffer.from(value));
                cur += value.byteLength;
                if (total > 0) {
                    win.webContents.send('update-progress', {
                        percent: (cur / total) * 100,
                        transferred: cur,
                        total,
                        bytesPerSecond: 0,
                    });
                }
            }

            fs.writeFileSync(downloadPath, Buffer.concat(chunks));
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
                }).then((result) => {
                    if (result.response === 0) {
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

                        const child = require('child_process').spawn('/bin/bash', [scriptPath], {
                            detached: true,
                            stdio: 'ignore'
                        });
                        child.unref();
                        app.quit();
                    }
                });
            });
            return; // success
        } catch (e: any) {
            sendStatusToWindow(`Mirror ${new URL(mirrorUrl).host} failed: ${e.message}`);
            continue;
        }
    }

    sendStatusToWindow(ut('all_mirrors_failed'));
}

async function downloadToFolder(win: BrowserWindow, url: string, filename: string, autoOpen = false) {
    const downloadPath = path.join(app.getPath('downloads'), filename);

    for (const mirrorFn of GITHUB_DOWNLOAD_MIRRORS) {
        const mirrorUrl = mirrorFn(url);
        sendStatusToWindow(`Downloading from ${new URL(mirrorUrl).host}...`);

        try {
            const response = await net.fetch(mirrorUrl, {
                headers: { 'User-Agent': 'LILYGO-Spark-Updater' },
            });

            if (!response.ok || !response.body) {
                sendStatusToWindow(`Mirror ${new URL(mirrorUrl).host} returned ${response.status}, trying next...`);
                continue;
            }

            const total = parseInt(response.headers.get('content-length') || '0', 10);
            let cur = 0;
            const chunks: Buffer[] = [];
            const reader = response.body.getReader();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(Buffer.from(value));
                cur += value.byteLength;
                if (total > 0) {
                    win.webContents.send('update-progress', {
                        percent: (cur / total) * 100,
                        transferred: cur,
                        total,
                        bytesPerSecond: 0,
                    });
                }
            }

            fs.writeFileSync(downloadPath, Buffer.concat(chunks));
            sendStatusToWindow('Download complete.');

            detectLocale(win);
            dialog.showMessageBox(win, {
                type: 'info',
                title: ut('dl_complete_title'),
                message: ut('dl_complete_msg'),
                detail: `File: ${filename}`,
                buttons: [ut('btn_open'), ut('btn_close')]
            }).then((result) => {
                if (result.response === 0) {
                    if (autoOpen) {
                        shell.openPath(downloadPath);
                    } else {
                        shell.showItemInFolder(downloadPath);
                    }
                }
            });
            return;
        } catch (e: any) {
            sendStatusToWindow(`Mirror ${new URL(mirrorUrl).host} failed: ${e.message}`);
            continue;
        }
    }

    sendStatusToWindow(ut('all_mirrors_failed'));
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
