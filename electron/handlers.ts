import { app, shell, dialog, BrowserWindow, IpcMainInvokeEvent, IpcMainEvent } from 'electron';
import { SerialPort } from 'serialport';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';

// State variables moved from main.ts
let activeSerialPort: SerialPort | null = null;
let serialPortCallback: ((portId: string) => void) | null = null;

// --- Helper Functions ---

export function setSerialPortCallback(cb: ((portId: string) => void) | null) {
    serialPortCallback = cb;
}

export async function getEnhancedPortList(portList: Electron.SerialPort[]): Promise<any[]> {
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
    return portList.map((electronPort) => {
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
}

export function checkBluetoothPermission(win: BrowserWindow) {
    if (process.platform === 'darwin') {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
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
}

// Analyze firmware using standalone esptool executable if available
async function analyzeFirmwareWithEsptool(filePath: string, logToUI: (msg: string) => void): Promise<any> {
    let esptoolName = '';
    let platformDir = '';

    if (process.platform === 'darwin') {
        platformDir = 'mac';
        // In packaged app, we use 'esptool' (merged universal binary or renamed single arch)
        // In dev, we use the specific arch file
        if (app.isPackaged) {
             esptoolName = 'esptool';
        } else {
            if (process.arch === 'arm64') {
                esptoolName = 'esptool-arm64';
            } else {
                esptoolName = 'esptool-x64';
            }
        }
    } else if (process.platform === 'win32') {
        platformDir = 'win';
        esptoolName = 'esptool.exe';
    } else if (process.platform === 'linux') {
        platformDir = 'linux';
        esptoolName = 'esptool';
    } else {
        logToUI(`Unsupported platform for native esptool: ${process.platform}`);
        return null;
    }

    let esptoolPath = '';
    if (app.isPackaged) {
        esptoolPath = path.join(process.resourcesPath, 'tools', esptoolName);
    } else {
        esptoolPath = path.join(__dirname, '../resources/tools', platformDir, esptoolName);
    }
    
    logToUI(`Checking for esptool binary at: ${esptoolPath}`);

    try {
        await fs.access(esptoolPath, fs.constants.X_OK);
    } catch (e) {
        logToUI(`esptool binary not found or not executable: ${e}`);
        return null;
    }

    const runEsptool = (targetPath: string, description: string): Promise<any> => {
        return new Promise((resolve) => {
            const cmdArgs = ['image_info', targetPath];
            logToUI(`Running command: ${esptoolPath} ${cmdArgs.join(' ')}`);
            logToUI(`Context: ${description}`);

            execFile(esptoolPath, cmdArgs, (error, stdout, stderr) => {
                if (error) {
                    logToUI(`Command failed with error: ${error.message}`);
                    if (stderr) logToUI(`Stderr: ${stderr}`);
                    resolve(null);
                    return;
                }
                
                logToUI(`Command success. Output:\n${stdout}`);
                
                const result: any = { 
                    source: 'esptool-binary',
                    is_full_image: false 
                };
                
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

    logToUI('Attempt 1: Direct analysis of the file...');
    let result = await runEsptool(filePath, 'Direct file analysis');
    if (result) {
        logToUI('Direct analysis successful.');
        return result;
    }
    logToUI('Direct analysis failed or returned insufficient data.');

    try {
        logToUI('Attempt 2: Checking for ESP32 bootloader at offset 0x1000...');
        const fd = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(32 * 1024);
        const { bytesRead } = await fd.read(buffer, 0, 32 * 1024, 0);
        await fd.close();

        if (bytesRead > 0x1000 + 4) {
             if (buffer[0x1000] === 0xE9) {
                 logToUI('Detected 0xE9 magic at 0x1000. Extracting 16KB bootloader header...');
                 const tempPath = path.join(app.getPath('temp'), `bootloader_extract_${Date.now()}.bin`);
                 const bootloaderData = buffer.subarray(0x1000, 0x1000 + 16384);
                 await fs.writeFile(tempPath, bootloaderData);
                 
                 result = await runEsptool(tempPath, 'Extracted bootloader analysis');
                 
                 await fs.unlink(tempPath).catch(() => {});
                 
                 if (result) {
                     result.is_full_image = true;
                     if (result.chip === 'Unknown') result.chip = 'ESP32';
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

// --- IPC Handlers ---

export async function handleAnalyzeFirmware(event: IpcMainInvokeEvent, filePath: string) {
    const webContents = event.sender;
    const logToUI = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[Analysis] ${msg}`);
        webContents.send('analysis-log', `[${timestamp}] ${msg}`);
    };

    logToUI(`Starting firmware analysis for: ${filePath}`);

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
}

export async function handleListPorts() {
    try {
        const ports = await SerialPort.list();
        return ports;
    } catch (e: any) {
        console.error('Failed to list ports:', e);
        return { error: e.message };
    }
}

export async function handleConnectSerial(event: IpcMainInvokeEvent, portPath: string, baudRate: number = 115200) {
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
            
            port.on('data', (data) => {
                if (event.sender) {
                    event.sender.send('serial-data', data.toString());
                }
            });

            port.on('error', (err) => {
                console.error('Serial port error:', err);
                if (event.sender) {
                    event.sender.send('serial-error', err.message);
                }
            });

            port.on('close', () => {
                console.log('Serial port closed');
                if (event.sender) {
                    event.sender.send('serial-closed');
                }
                activeSerialPort = null;
            });

            resolve({ success: true });
        });
    });
}

export async function handleDisconnectSerial() {
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
    return { success: true };
}

export async function handleWriteSerial(_event: IpcMainInvokeEvent, data: string) {
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
}

export async function handleOpenExternal(_event: IpcMainInvokeEvent, url: string) {
    await shell.openExternal(url);
}

export function handleSerialPortSelected(_event: IpcMainEvent, portId: string) {
    if (serialPortCallback) {
        serialPortCallback(portId);
        serialPortCallback = null;
    }
}

export function handleSerialPortCancelled() {
    if (serialPortCallback) {
        serialPortCallback('');
        serialPortCallback = null;
    }
}
