import { app, dialog, shell, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import https from 'https';

import { getCanaryUpdate } from './config-handler';

// GitHub Release API URL
const GITHUB_REPO = 'Xinyuan-LilyGO/LILYGO-Spark';
const GITHUB_LATEST_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=1`;

let updateWin: BrowserWindow | null = null;

export function setupUpdater(win: BrowserWindow) {
  updateWin = win;

  const canary = getCanaryUpdate();
  console.log('[Updater] Canary channel:', canary);

  // Configure electron-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = canary;

  // Listen for update events
  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    sendStatusToWindow('Update available.', info);
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Available',
      message: `A new version ${info.version} is available. Do you want to download it now?`,
      buttons: ['Update', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        if (process.platform === 'darwin') {
           // macOS: Manual download via browser
           shell.openExternal(`https://github.com/${GITHUB_REPO}/releases/latest`);
        } else {
           // Windows/Linux: Auto download
           autoUpdater.downloadUpdate();
        }
      }
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendStatusToWindow('Update not available.', info);
  });

  autoUpdater.on('error', (err) => {
    sendStatusToWindow('Error in auto-updater. ' + err);
    // Fallback for macOS if electron-updater fails (likely due to code signing)
    if (process.platform === 'darwin') {
        const isCanary = getCanaryUpdate();
        checkForUpdatesMacOS(win, isCanary);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    sendStatusToWindow(log_message, progressObj);
    win.webContents.send('update-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow('Update downloaded', info);
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. The application will restart to install the update.',
      buttons: ['Restart', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

// IPC handlers for manual check
  ipcMain.handle('check-for-updates', () => {
      const isCanary = getCanaryUpdate();
      // Update allowPrerelease in case it changed at runtime
      autoUpdater.allowPrerelease = isCanary;
      
      if (process.platform === 'darwin') {
          checkForUpdatesMacOS(win, isCanary);
      } else {
          autoUpdater.checkForUpdatesAndNotify();
      }
  });

  // Check for updates on startup
  // Delay slightly to ensure window is ready
  setTimeout(() => {
      const isCanary = getCanaryUpdate();
      // Update allowPrerelease in case it changed at runtime
      autoUpdater.allowPrerelease = isCanary;

      if (process.platform === 'darwin') {
          checkForUpdatesMacOS(win, isCanary);
      } else {
          autoUpdater.checkForUpdatesAndNotify();
      }
  }, 3000);
}

function sendStatusToWindow(text: string, data?: any) {
  console.log('[Updater]', text);
  updateWin?.webContents.send('update-message', { text, data });
}

// Custom macOS update check using GitHub API
function checkForUpdatesMacOS(win: BrowserWindow, canary: boolean) {
    console.log('[Updater] Checking for updates on macOS via GitHub API... Canary:', canary);
    
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

function fetchRelease(url: string, callback: (err: any, data?: any) => void) {
    const request = https.get(url, {
        headers: {
            'User-Agent': 'LILYGO-Spark-Updater'
        }
    }, (res) => {
        if (res.statusCode !== 200) {
            res.resume();
            callback({ message: `GitHub API returned ${res.statusCode}`, statusCode: res.statusCode });
            return;
        }

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                callback(null, json);
            } catch (e) {
                callback(e);
            }
        });
    });
    
    request.on('error', (e) => callback(e));
}

function processRelease(win: BrowserWindow, release: any) {
    if (!release || !release.tag_name) {
        console.error('[Updater] Invalid release data:', release);
        sendStatusToWindow('Error: Invalid release data received.');
        return;
    }

    const latestVersion = release.tag_name.replace(/^v/, '');
    const currentVersion = app.getVersion();

    console.log(`[Updater] Latest: ${latestVersion}, Current: ${currentVersion}`);
    console.log(`[Updater] Release URL: ${release.html_url}`);

    if (semverCompare(latestVersion, currentVersion) > 0) {
        // Send message so UI knows check is done
        sendStatusToWindow('Update available.', { version: latestVersion });
        
        dialog.showMessageBox(win, {
            type: 'info',
            title: 'Update Available',
            message: `A new version ${latestVersion} is available. Do you want to download it?`,
            detail: `Current version: ${currentVersion}\nLatest version: ${latestVersion}`,
            buttons: ['Download', 'Later'],
            defaultId: 0,
            cancelId: 1
        }).then((result) => {
            if (result.response === 0) {
                    shell.openExternal(release.html_url);
            }
        });
    } else {
        console.log('[Updater] App is up to date.');
        sendStatusToWindow('App is up to date.', { version: currentVersion });
    }
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
