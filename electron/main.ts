import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { SerialPort } from 'serialport'
import { DeviceDetector, DeviceDetectionConfig } from './device-detector'
import { setupConfigHandler } from './config-handler'

// Configuration for device detection strategies
const deviceDetectionConfig: DeviceDetectionConfig = {
  serialport_enable: true,      // Strategy 1: Node.js SerialPort polling (Recommended)
  usb_detection_enable: false,  // Strategy 3: usb-detection (Requires native build)
  pollInterval: 1000,
};

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

let win: BrowserWindow | null
let deviceDetector: DeviceDetector | null = null;
// Store the callback for serial port selection
let serialPortCallback: ((portId: string) => void) | null = null;

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
    
    // Get detailed info from serialport node module to enhance Electron's list
    let detailedPorts: any[] = [];
    try {
        detailedPorts = await SerialPort.list();
        console.log('Detailed ports from SerialPort.list():', detailedPorts);
    } catch (e) {
        console.error('Failed to list serial ports:', e);
    }

    // Fallback Vendor Map (VID is usually hex, but Electron might return decimal string)
    const vendorMap: Record<string, string> = {
        '303a': 'Espressif Systems',
        '12346': 'Espressif Systems', // Decimal for 0x303A
        '1a86': 'WCH (WinChipHead)',
        '6790': 'WCH (WinChipHead)',  // Decimal for 0x1A86
        '10c4': 'Silicon Labs',
        '4292': 'Silicon Labs',       // Decimal for 0x10C4
        '0403': 'FTDI',
        '1027': 'FTDI',               // Decimal for 0x0403
    };

    // Merge info
    const enhancedPortList = portList.map((electronPort) => {
        // Try to find matching port in detailedPorts
        // Matching by path/portName is usually best, but Electron gives 'cu.usbmodem...' or 'COM1'
        // serialport might give '/dev/tty.usbmodem...'
        
        const matched = detailedPorts.find(p => {
            // Check if paths end with the same string (handles /dev/tty vs cu. differences)
            const pPath = p.path.toLowerCase();
            const ePath = electronPort.portName.toLowerCase();
            
            return pPath === ePath || 
                   pPath.endsWith(ePath) || 
                   ePath.endsWith(pPath) ||
                   // Fallback to VID/PID match if path fails
                   (p.vendorId?.toLowerCase() === electronPort.vendorId?.toLowerCase() && 
                    p.productId?.toLowerCase() === electronPort.productId?.toLowerCase() && 
                    p.serialNumber === electronPort.serialNumber);
        });

        let manufacturer = matched?.manufacturer || (electronPort as any).manufacturer;
        
        // If still no manufacturer, try to look up by Vendor ID
        if (!manufacturer && electronPort.vendorId) {
            const vid = electronPort.vendorId.toLowerCase();
            manufacturer = vendorMap[vid];
        }

        return {
            ...electronPort,
            // Prefer serialport's manufacturer if available, as Electron's list often misses it on macOS
            manufacturer, 
        };
    });

    console.log('Available serial ports (enhanced):', enhancedPortList);
    
    // Store the callback to be called later
    serialPortCallback = callback;
    
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
  if (process.platform === 'darwin') {
    try {
        const { getAuthStatus } = require('electron-mac-permissions');
        const status = getAuthStatus('bluetooth');
        console.log('Bluetooth permission status:', status);

        if (status === 'denied') {
            dialog.showMessageBox(win, {
                type: 'warning',
                title: 'Bluetooth Permission Required',
                message: 'LILYGO Spark requires Bluetooth access to detect devices.',
                detail: 'Please enable Bluetooth in System Settings -> Privacy & Security -> Bluetooth.',
                buttons: ['Open Settings', 'Ignore'],
                defaultId: 0,
                cancelId: 1,
            }).then(({ response }) => {
                if (response === 0) {
                    // Try to open Privacy settings
                    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Bluetooth');
                }
            });
        }
    } catch (error) {
        console.error('Failed to check Bluetooth permission:', error);
    }
  }

  // Initialize Device Detector
  setupConfigHandler();
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
ipcMain.on('serial-port-selected', (_event, portId) => {
  if (serialPortCallback) {
    serialPortCallback(portId);
    serialPortCallback = null; // Clear the callback
  }
});

// Handle cancellation
ipcMain.on('serial-port-cancelled', () => {
  if (serialPortCallback) {
    serialPortCallback(''); // Empty string means cancel
    serialPortCallback = null;
  }
});


// Handle firmware analysis request
ipcMain.handle('analyze-firmware', async (_event, filePath: string) => {
    return new Promise((resolve, reject) => {
        let scriptPath = '';
        if (app.isPackaged) {
            scriptPath = path.join(process.resourcesPath, 'tools', 'analyze_firmware.py');
        } else {
            // In dev, __dirname is dist-electron. resources is in root.
            scriptPath = path.join(__dirname, '../resources/tools/common/analyze_firmware.py');
        }

        console.log(`Analyzing firmware: ${filePath} using script: ${scriptPath}`);

        execFile('python3', [scriptPath, filePath], (error, stdout, stderr) => {
            if (error) {
                console.error('Error executing analyze_firmware.py:', error);
                console.error('stderr:', stderr);
                reject(stderr || error.message);
                return;
            }

            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (e) {
                console.error('Failed to parse JSON output:', stdout);
                reject('Failed to parse analysis result');
            }
        });
    });
});

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
