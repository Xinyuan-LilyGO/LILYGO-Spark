import { app, BrowserWindow, ipcMain, Menu, dialog, nativeImage, nativeTheme } from 'electron'
import path from 'node:path'

// Set app name for "Open with" dialog when handling lilygo-spark:// deep links
if (process.defaultApp) app.name = 'LILYGO Spark'
import { DeviceDetector, DeviceDetectionConfig } from './device-detector'
import { setupConfigHandler } from './config-handler'
import { 
    handleAnalyzeFirmware, 
    handleConnectSerial, 
    handleDisconnectSerial, 
    handleListPorts, 
    handleOpenExternal, 
    handleSerialPortCancelled, 
    handleSerialPortSelected, 
    handleWriteSerial,
    handleDownloadFirmware,
    handleRemoveFile,
    handleFlashFirmwareNative,
    handleSaveFile,
    getEnhancedPortList,
    setSerialPortCallback,
    checkBluetoothPermission
} from './handlers'

let win: BrowserWindow | null
let deviceDetector: DeviceDetector | null = null;

// Configuration for device detection strategies
const deviceDetectionConfig: DeviceDetectionConfig = {
  serialport_enable: true,      // Strategy 1: Node.js SerialPort polling (Recommended)
  usb_detection_enable: false,  // Strategy 3: usb-detection (Requires native build)
  pollInterval: 1000,
};

// --- Deep Link Protocol Setup ---
const PROTOCOL = 'lilygo-spark';

// In dev (defaultApp), register with current app path so lilygo-spark:// opens this app, not another Electron (e.g. LilyGo-Flasher)
function registerProtocol() {
  if (process.defaultApp) {
    const appPath = app.getAppPath()
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [appPath])
    if (process.env.VITE_DEV_SERVER_URL) console.log('[Protocol] Registered lilygo-spark:// for dev, appPath:', appPath)
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
}
registerProtocol()

// Use native macOS About panel in production
app.setAboutPanelOptions({
  applicationName: app.name,
  applicationVersion: app.getVersion(),
  copyright: 'LilyGo Community',
  credits: 'A cross-platform firmware hub and burner for LILYGO and other ESP devices.'
})

/** Dev-only: custom About window with LILYGO logo (native About shows Electron icon in dev) */
function showAboutWindow(parent: BrowserWindow, publicPath: string) {
  const isDark = nativeTheme.shouldUseDarkColors
  const logoPath = path.join(publicPath, 'LILYGO.png')
  const icon = nativeImage.createFromPath(logoPath)
  const iconDataUrl = icon.isEmpty() ? '' : icon.resize({ width: 128, height: 128 }).toDataURL()
  const lightStyles = 'body{background:#d1d1d6;}h1,.version,p{color:#1c1c1e;}.version,p{color:#636366;}button{color:#0a84ff;}button:hover{background:rgba(10,132,255,0.15);}'
  const darkStyles = 'body{background:#1e293b;}h1{color:#f1f5f9;}.version,p{color:#94a3b8;}button{color:#60a5fa;}button:hover{background:rgba(96,165,250,0.2);}'
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-app-region:drag;padding:44px 36px 40px;text-align:center;min-width:320px;display:flex;flex-direction:column;align-items:center}
  img{width:80px;height:80px;margin-bottom:10px;-webkit-app-region:no-drag}h1{font-size:18px;font-weight:600;margin-bottom:2px}.version{font-size:12px;margin-bottom:8px}p{font-size:11px;line-height:1.4;margin-bottom:12px}
  button{-webkit-app-region:no-drag;padding:6px 24px;font-size:13px;font-weight:500;background:transparent;border:none;cursor:pointer;border-radius:4px}
  ${isDark ? darkStyles : lightStyles}
</style></head><body>
  <img src="${iconDataUrl}" alt="LILYGO Spark" />
  <h1>${app.name}</h1>
  <div class="version">Version ${app.getVersion()}</div>
  <p>A cross-platform firmware hub and burner for LILYGO and other ESP devices.</p>
  <button onclick="window.close()">OK</button>
</body></html>`
  const aboutWin = new BrowserWindow({
    parent, modal: true, width: 340, height: 300, resizable: false,
    minimizable: false, maximizable: false, show: false, titleBarStyle: 'hidden',
    backgroundColor: isDark ? '#1e293b' : '#d1d1d6',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  aboutWin.setMenu(null)
  aboutWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  aboutWin.once('ready-to-show', () => aboutWin.show())
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine, _workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
    
    // Windows/Linux protocol handler
    const url = commandLine.find(arg => arg.startsWith(`${PROTOCOL}://`))
    if (url) handleDeepLink(url)
  })
}

// macOS protocol handler
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

function handleDeepLink(url: string) {
  console.log('Deep link received:', url)
  // Defer if window not ready
  if (!win) {
      console.warn('Window not ready for deep link');
      return;
  }
  
  if (win.webContents) {
      try {
          const urlObj = new URL(url);
          const token = urlObj.searchParams.get('token');
          const userStr = urlObj.searchParams.get('user');
          
          if (token) {
              win.webContents.send('login-success', {
                  token,
                  user: userStr ? JSON.parse(decodeURIComponent(userStr)) : null
              });
              // Show window if hidden
              win.show();
          }
      } catch (e) {
          console.error('Failed to parse deep link:', e);
      }
  }
}
// --------------------------------

// Handle potential issues with device detection during startup
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// The built directory structure
//
// ├─┬─ dist
// │ ├─ index.html
// │ ├─ assets
// │ └─ ...
// ├─┬─ dist-electron
// │ ├─ main.js
// │ └─ preload.js
//

function createWindow() {
  // Electron official way to detect dev vs production
  // app.isPackaged is the recommended way (not env vars)
  const isDev = !app.isPackaged && process.env.VITE_DEV_SERVER_URL !== undefined
  
  // Get paths
  // In dev: __dirname is project/dist-electron
  // In prod: __dirname is app.asar/dist-electron
  const distPath = path.join(__dirname, '../dist')
  const publicPath = isDev 
    ? path.join(__dirname, '../public')
    : distPath
  
  // Preload script path
  const preloadPath = path.join(__dirname, 'preload.js')
  
  // Debug logging (remove in production if needed)
  if (isDev) {
    console.log('Development mode')
    console.log('__dirname:', __dirname)
    console.log('distPath:', distPath)
    // Set custom icon for Dock & About panel in dev (macOS)
    if (process.platform === 'darwin') {
      const iconPath = path.join(publicPath, 'LILYGO.png')
      const icon = nativeImage.createFromPath(iconPath)
      if (!icon.isEmpty()) app.dock?.setIcon(icon)
    }
  }

  // Create custom menu to hide DevTools while keeping other functionality
  if (process.platform === 'darwin') {
    const template: any[] = [
      {
        label: app.name,
        submenu: [
          ...(isDev
            ? [{ label: `About ${app.name}`, click: () => { if (win && !win.isDestroyed()) showAboutWindow(win, publicPath) } }]
            : [{ role: 'about' as const }]),
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ]
      }
    ]
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  } else {
    // For Windows and Linux, remove the menu entirely
    Menu.setApplicationMenu(null)
  }

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    // Temporarily use vite logo as icon
    icon: path.join(publicPath, 'LILYGO.png'),
    backgroundColor: '#0f172a', // Matches Tailwind slate-900
    show: false, // Don't show until ready-to-show to avoid white flash
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true, // Recommended for security
    },
  })

  // Prevent white flash by showing window only when ready
  win.once('ready-to-show', () => {
    win?.show()
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // Forward console logs from Renderer to Main process terminal
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      const levels = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'];
      const levelName = levels[level] || 'INFO';
      const location = sourceId ? `${sourceId}:${line}` : (line ? `line ${line}` : '');
      console.log(`[Renderer-${levelName}] ${message}${location ? ` (${location})` : ''}`);
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    // Development: load from Vite dev server
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    // Production: load from dist folder
    // Use app.getAppPath() which handles asar correctly
    const appPath = app.getAppPath()
    const indexPath = app.isPackaged
      ? path.join(appPath, 'dist', 'index.html')
      : path.join(distPath, 'index.html')
    
    console.log('Loading index.html')
    console.log('app.getAppPath():', appPath)
    console.log('indexPath:', indexPath)
    console.log('app.isPackaged:', app.isPackaged)
    
    win.loadFile(indexPath).catch((err) => {
      console.error('Failed to load index.html:', err)
      console.error('Tried path:', indexPath)
      // Fallback: try with loadURL
      const fileUrl = `file://${indexPath}`
      console.log('Trying fallback URL:', fileUrl)
      win?.loadURL(fileUrl).catch((fallbackErr) => {
        console.error('Fallback also failed:', fallbackErr)
      })
    })
  }
  
  // Handle serial port selection
  win.webContents.session.on('select-serial-port', async (event, portList, _webContents, callback) => {
    event.preventDefault();
    
    const enhancedPortList = await getEnhancedPortList(portList);

    console.log('Available serial ports (enhanced):', enhancedPortList);
    
    // Store the callback to be called later
    setSerialPortCallback(callback);
    
    // Send the port list to the renderer
    win?.webContents.send('serial-ports-available', enhancedPortList);
  });

  win.webContents.session.setPermissionCheckHandler((_webContents, permission, _requestingOrigin, _details) => {
    if (permission === 'serial') {
      return true;
    }
    return false;
  });

  win.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'serial') {
      return true;
    }
    return false;
  });

  // Check Bluetooth Permission on macOS
  checkBluetoothPermission(win);

  try {
    setupConfigHandler();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    dialog.showErrorBox('读取配置文件错误', msg);
    app.quit();
    return;
  }

  // Initialize Device Detector
  deviceDetector = new DeviceDetector(win, deviceDetectionConfig);
  deviceDetector.start();
  
  // Send the config to renderer so it knows whether to enable its own Web Serial listener
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('device-detection-config', {
       web_serial_enable: true // Strategy 2: Browser Web Serial API (Passive)
    });
  });
}

// Handle port selection from renderer
ipcMain.on('serial-port-selected', handleSerialPortSelected);

// Handle cancellation
ipcMain.on('serial-port-cancelled', handleSerialPortCancelled);

// Sync theme from renderer (kept for potential future use)
ipcMain.on('theme-changed', (_event, _theme: 'light' | 'dark') => {});

// Handle firmware analysis request
ipcMain.handle('analyze-firmware', handleAnalyzeFirmware);

// Handle firmware download
ipcMain.handle('download-firmware', handleDownloadFirmware);

// Handle file remove
ipcMain.handle('remove-file', handleRemoveFile);

// Handle native firmware flashing
ipcMain.handle('flash-firmware-native', handleFlashFirmwareNative);

// Handle file save
ipcMain.handle('save-file', handleSaveFile);

// ------------------------------
// Custom Serial Console Handlers
// ------------------------------

// 1. List Ports (Manual request)
ipcMain.handle('list-ports', handleListPorts);

// 2. Connect to Serial Port
ipcMain.handle('connect-serial', handleConnectSerial);

// 3. Disconnect
ipcMain.handle('disconnect-serial', handleDisconnectSerial);

// 4. Write to Serial
ipcMain.handle('write-serial', handleWriteSerial);

// 5. Open External URL
ipcMain.handle('open-external', handleOpenExternal);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
