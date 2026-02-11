import { BrowserWindow } from 'electron';
import { SerialPort } from 'serialport';

// ESP32-S3 and other common USB-Serial chips
const ESP_VID_PID_LIST = [
  { vid: '303A', pid: '1001', name: 'ESP32-S3 USB Serial/JTAG' },
  { vid: '10C4', pid: 'EA60', name: 'CP210x UART Bridge' },
  { vid: '1A86', pid: '7523', name: 'CH340 Serial' },
  { vid: '1A86', pid: '55D4', name: 'CH9102 Serial' },
  { vid: '0403', pid: '6001', name: 'FTDI Serial' },
];

export interface DeviceDetectionConfig {
  serialport_enable: boolean;
  usb_detection_enable: boolean;
  pollInterval?: number;
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

export class DeviceDetector {
  private window: BrowserWindow;
  private config: DeviceDetectionConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private lastPortList: string[] = [];

  constructor(window: BrowserWindow, config: DeviceDetectionConfig) {
    this.window = window;
    this.config = config;
  }

  updateConfig(newConfig: Partial<DeviceDetectionConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.stop();
    this.start();
  }

  start() {
    if (this.config.serialport_enable) {
      this.startSerialPolling();
    }
    if (this.config.usb_detection_enable) {
      this.startUsbDetection();
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Stop USB detection if implemented
  }

  private async startSerialPolling() {
    const poll = async () => {
      try {
        const ports = await SerialPort.list();
        const currentPortIds = ports.map(p => p.path);
        
        // Find new ports (present in current but not in last)
        const newPorts = ports.filter(p => !this.lastPortList.includes(p.path));
        
        if (newPorts.length > 0) {
          newPorts.forEach(port => {
            const isEsp = this.isEspDevice(port);
            
            // Try to enhance manufacturer if missing
            let manufacturer = port.manufacturer;
            if (!manufacturer && port.vendorId) {
                const vid = port.vendorId.toLowerCase();
                manufacturer = vendorMap[vid];
            }

            console.log('[DeviceDetector] New device detected:', port.path);
            this.window.webContents.send('device-detected', {
              type: 'serialport',
              port: port.path,
              vendorId: port.vendorId,
              productId: port.productId,
              manufacturer: manufacturer,
              isEsp,
            });
          });
        }

        this.lastPortList = currentPortIds;
      } catch (err) {
        console.error('[DeviceDetector] Error polling serial ports:', err);
      }
    };

    // Initial scan to populate list without triggering notifications
    try {
      const initialPorts = await SerialPort.list();
      this.lastPortList = initialPorts.map(p => p.path);
    } catch (e) {
      console.error('[DeviceDetector] Initial scan failed:', e);
    }

    this.intervalId = setInterval(poll, this.config.pollInterval || 2000);
  }

  private startUsbDetection() {
    try {
      // Dynamic import to avoid crash if not installed
      const usbDetect = require('usb-detection');
      usbDetect.startMonitoring();
      
      usbDetect.on('add', (device: any) => {
        console.log('[DeviceDetector] USB device added:', device);
        this.window.webContents.send('device-detected', {
            type: 'usb-detection',
            ...device
        });
      });
    } catch (e) {
      console.warn('[DeviceDetector] usb-detection module not found or failed to load. Skipping USB detection.');
    }
  }

  private isEspDevice(port: any): boolean {
    if (!port.vendorId || !port.productId) return false;
    const vid = port.vendorId.toUpperCase();
    const pid = port.productId.toUpperCase();
    return ESP_VID_PID_LIST.some(d => d.vid === vid && d.pid === pid) || ESP_VID_PID_LIST.some(d => d.vid === vid);
  }
}
