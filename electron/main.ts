import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
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
let activeSerialPort: SerialPort | null = null;

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

  // Create custom menu to hide DevTools while keeping other functionality
  if (process.platform === 'darwin') {
    const template: any[] = [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
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
          // { role: 'toggleDevTools' }, // Excluded to hide developer tools
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


// Analyze firmware using standalone esptool executable if available
async function analyzeFirmwareWithEsptool(filePath: string, logToUI: (msg: string) => void): Promise<any> {
    let esptoolName = '';
    let platformDir = '';

    if (process.platform === 'darwin') {
        platformDir = 'mac';
        if (process.arch === 'arm64') {
            esptoolName = 'esptool-arm64';
        } else {
            esptoolName = 'esptool-x64';
        }
    } else if (process.platform === 'win32') {
        platformDir = 'win';
        esptoolName = 'esptool.exe';
    } else if (process.platform === 'linux') {
        platformDir = 'linux';
        esptoolName = 'esptool'; // Assuming linux binary is named esptool and put in linux folder
    } else {
        logToUI(`Unsupported platform for native esptool: ${process.platform}`);
        return null;
    }

    let esptoolPath = '';
    if (app.isPackaged) {
        // In packaged app, extraResources map resources/tools/{platform} -> tools/
        // So binaries are directly in process.resourcesPath/tools/
        esptoolPath = path.join(process.resourcesPath, 'tools', esptoolName);
    } else {
        // In dev, we are in dist-electron/, resources is in ../resources/
        // But we need to use the full path to the specific binary we just copied
        esptoolPath = path.join(__dirname, '../resources/tools', platformDir, esptoolName);
    }
    
    logToUI(`Checking for esptool binary at: ${esptoolPath}`);

    // check if file exists and is executable
    try {
        await fs.access(esptoolPath, fs.constants.X_OK);
    } catch (e) {
        logToUI(`esptool binary not found or not executable: ${e}`);
        return null;
    }

    // Helper to run esptool on a specific file
    const runEsptool = (targetPath: string, description: string): Promise<any> => {
        return new Promise((resolve) => {
            const cmdArgs = ['image_info', targetPath];
            logToUI(`Running command: ${esptoolPath} ${cmdArgs.join(' ')}`);
            logToUI(`Context: ${description}`);

            execFile(esptoolPath, cmdArgs, (error, stdout, stderr) => {
                if (error) {
                    logToUI(`Command failed with error: ${error.message}`);
                    if (stderr) logToUI(`Stderr: ${stderr}`);
                    // Still try to parse stdout if available, as esptool might return error code but still output info
                    // But usually error means failure.
                    resolve(null);
                    return;
                }
                
                logToUI(`Command success. Output:\n${stdout}`);
                
                const result: any = { 
                    source: 'esptool-binary',
                    is_full_image: false // Default, might need adjustment logic
                };
                
                // Parse output
                const matchSize = stdout.match(/Flash size: (\w+)/);
                if (matchSize) result.flash_size = matchSize[1];
                
                const matchFreq = stdout.match(/Flash freq: (\w+)/);
                if (matchFreq) result.flash_freq = matchFreq[1];
                
                const matchMode = stdout.match(/Flash mode: (\w+)/);
                if (matchMode) result.flash_mode = matchMode[1];

                const matchEntry = stdout.match(/Entry point: (0x[0-9a-fA-F]+)/);
                if (matchEntry) result.entry_point = matchEntry[1];
                
                const matchSegments = stdout.match(/Segments: (\d+)/);
                if (matchSegments) result.segments = parseInt(matchSegments[1]);

                const matchChipId = stdout.match(/Chip ID: (0x[0-9a-fA-F]+)/);
                if (matchChipId) result.chip_id = matchChipId[1];
                
                // Try to detect chip type from text or ID
                if (stdout.includes('esp32s3')) result.chip = 'ESP32-S3';
                else if (stdout.includes('esp32c3')) result.chip = 'ESP32-C3';
                else if (stdout.includes('esp32c6')) result.chip = 'ESP32-C6';
                else if (stdout.includes('esp32p4')) result.chip = 'ESP32-P4';
                else if (stdout.includes('esp32')) result.chip = 'ESP32';
                else if (result.chip_id) result.chip = `Unknown (ID: ${result.chip_id})`;
                else result.chip = 'Unknown';
                
                logToUI(`Parsed Chip: ${result.chip}, Flash: ${result.flash_size}, Segments: ${result.segments}`);

                if (result.flash_size || result.entry_point) {
                    resolve(result);
                } else {
                    logToUI(`Failed to parse useful information from stdout.`);
                    resolve(null);
                }
            });
        });
    };

    // 1. Try direct analysis
    logToUI('Attempt 1: Direct analysis of the file...');
    let result = await runEsptool(filePath, 'Direct file analysis');
    if (result) {
        logToUI('Direct analysis successful.');
        return result;
    }
    logToUI('Direct analysis failed or returned insufficient data.');

    // 2. If failed, it might be an ESP32 merged bin (bootloader at 0x1000)
    // We check if file is large enough and has magic at 0x1000
    try {
        logToUI('Attempt 2: Checking for ESP32 bootloader at offset 0x1000...');
        const fd = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(32 * 1024); // Read first 32KB
        const { bytesRead } = await fd.read(buffer, 0, 32 * 1024, 0);
        await fd.close();

        if (bytesRead > 0x1000 + 4) {
             // Check magic at 0x1000 (ESP32 Bootloader offset)
             if (buffer[0x1000] === 0xE9) {
                 logToUI('Detected 0xE9 magic at 0x1000. Extracting 16KB bootloader header...');
                 // Extract 16KB from 0x1000 to temp file
                 const tempPath = path.join(app.getPath('temp'), `bootloader_extract_${Date.now()}.bin`);
                 const bootloaderData = buffer.subarray(0x1000, 0x1000 + 16384); // 16KB should be enough for header
                 await fs.writeFile(tempPath, bootloaderData);
                 
                 result = await runEsptool(tempPath, 'Extracted bootloader analysis');
                 
                 // Cleanup
                 await fs.unlink(tempPath).catch(() => {});
                 
                 if (result) {
                     result.is_full_image = true; // Since we found it at offset
                     if (result.chip === 'Unknown') result.chip = 'ESP32'; // 0x1000 is characteristic of ESP32
                     logToUI(`Offset analysis successful. Chip detected as: ${result.chip}`);
                     return result;
                 } else {
                     logToUI('Offset analysis failed to produce valid result.');
                 }
             } else {
                 logToUI('No 0xE9 magic found at 0x1000.');
             }
        } else {
            logToUI('File too small for offset analysis.');
        }
    } catch (e) {
        logToUI(`Failed to perform offset analysis: ${e}`);
    }

    return null;
}

// Handle firmware analysis request
ipcMain.handle('analyze-firmware', async (_event, filePath: string) => {
    // Helper to send logs to UI
    const webContents = _event.sender;
    const logToUI = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[Analysis] ${msg}`);
        webContents.send('analysis-log', `[${timestamp}] ${msg}`);
    };

    logToUI(`Starting firmware analysis for: ${filePath}`);

    // Try native esptool binary first
    const esptoolResult = await analyzeFirmwareWithEsptool(filePath, logToUI);
    if (esptoolResult) {
        logToUI('Analysis completed successfully using esptool binary.');
        return esptoolResult;
    }

    logToUI('esptool binary analysis failed. Falling back to legacy Python script...');

    return new Promise((resolve, reject) => {
        let scriptPath = '';
        if (app.isPackaged) {
            scriptPath = path.join(process.resourcesPath, 'tools', 'analyze_firmware.py');
        } else {
            // In dev, __dirname is dist-electron. resources is in root.
            scriptPath = path.join(__dirname, '../resources/tools/common/analyze_firmware.py');
        }

        logToUI(`Using Python script: ${scriptPath}`);

        execFile('python3', [scriptPath, filePath], (error, stdout, stderr) => {
            if (error) {
                logToUI(`Python script error: ${error.message}`);
                if (stderr) logToUI(`Python stderr: ${stderr}`);
                reject(stderr || error.message);
                return;
            }

            try {
                logToUI('Python script executed successfully. Parsing JSON...');
                const result = JSON.parse(stdout);
                logToUI('Analysis completed successfully using Python script.');
                resolve(result);
            } catch (e) {
                logToUI(`Failed to parse Python script output: ${stdout}`);
                reject('Failed to parse analysis result');
            }
        });
    });
});

// ------------------------------
// Custom Serial Console Handlers
// ------------------------------

// 1. List Ports (Manual request)
ipcMain.handle('list-ports', async () => {
    try {
        const ports = await SerialPort.list();
        return ports;
    } catch (e: any) {
        console.error('Failed to list ports:', e);
        return { error: e.message };
    }
});

// 2. Connect to Serial Port
ipcMain.handle('connect-serial', async (_event, portPath: string, baudRate: number = 115200) => {
    if (activeSerialPort && activeSerialPort.isOpen) {
        try {
            await new Promise<void>((resolve, reject) => {
                activeSerialPort?.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        } catch (e) {
            console.error('Error closing existing port:', e);
        }
    }
    
    activeSerialPort = null;

    return new Promise((resolve, reject) => {
        const port = new SerialPort({
            path: portPath,
            baudRate: baudRate,
            autoOpen: false,
        });

        port.open((err) => {
            if (err) {
                console.error('Error opening port:', err);
                reject(err.message);
                return;
            }

            activeSerialPort = port;
            
            // Set up data listener
            port.on('data', (data) => {
                if (_event.sender) {
                    _event.sender.send('serial-data', data.toString());
                }
            });

            port.on('error', (err) => {
                console.error('Serial port error:', err);
                if (_event.sender) {
                    _event.sender.send('serial-error', err.message);
                }
            });

            port.on('close', () => {
                console.log('Serial port closed');
                if (_event.sender) {
                    _event.sender.send('serial-closed');
                }
                activeSerialPort = null;
            });

            resolve({ success: true });
        });
    });
});

// 3. Disconnect
ipcMain.handle('disconnect-serial', async () => {
    if (activeSerialPort && activeSerialPort.isOpen) {
        return new Promise<void>((resolve, reject) => {
            activeSerialPort?.close((err) => {
                if (err) reject(err.message);
                else {
                    activeSerialPort = null;
                    resolve();
                }
            });
        });
    }
    return { success: true }; // Already closed
});

// 4. Write to Serial
ipcMain.handle('write-serial', async (_event, data: string) => {
    if (activeSerialPort && activeSerialPort.isOpen) {
        return new Promise<void>((resolve, reject) => {
            activeSerialPort?.write(data, (err) => {
                if (err) reject(err.message);
                else resolve();
            });
        });
    } else {
        throw new Error('Serial port not open');
    }
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
