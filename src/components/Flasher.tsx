import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { ChevronDown, Usb, Cpu, Check } from 'lucide-react';
import SparkMD5 from 'spark-md5';

// Type definitions for Web Serial API
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream;
  writable: WritableStream;
}

interface ElectronSerialPortInfo {
  portId: string;
  portName: string;
  displayName?: string;
  vendorId?: string;
  productId?: string;
  manufacturer?: string;
  serialNumber?: string;
  usbDriverName?: string;
}

const Flasher: React.FC = () => {
  const { t } = useTranslation();
  const [port, setPort] = useState<SerialPort | null>(null);
  const [connected, setConnected] = useState(false);
  const [baudRate] = useState(115200); // Default for logs
  const [flashBaudRate, setFlashBaudRate] = useState(921600); // Default for flashing
  const [chipFamily, setChipFamily] = useState('ESP32-S3'); // Default, maybe auto-detect
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  // Status key: 'idle', 'ready', 'flashing', 'success', 'error'
  const [status, setStatus] = useState<string>('idle');
  
  // Port Selection State
  const [availablePorts, setAvailablePorts] = useState<ElectronSerialPortInfo[]>([]);
  const [isSelectingPort, setIsSelectingPort] = useState(false);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const portSelectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize xterm
    if (terminalRef.current && !xtermRef.current) {
      const term = new Terminal({
        theme: {
          background: '#0f172a',
          foreground: '#f8fafc',
          cursor: '#ffffff',
        },
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 12,
        convertEol: true, // Handle \n as \r\n
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      term.writeln(t('flasher.welcome'));
      term.writeln(t('flasher.select_port_msg'));
    }
    
    // Handle resize
    const handleResize = () => {
      fitAddonRef.current?.fit();
    };
    window.addEventListener('resize', handleResize);

    // Listen for port selection from Main process
    if (window.ipcRenderer) {
        window.ipcRenderer.on('serial-ports-available', (_event, ports: ElectronSerialPortInfo[]) => {
          console.log('Ports from main:', ports);
          setAvailablePorts(ports);
          setIsSelectingPort(true); // Open the custom selector
        });
    }
    
    // Click outside to close port selector
    const handleClickOutside = (event: MouseEvent) => {
      if (portSelectRef.current && !portSelectRef.current.contains(event.target as Node)) {
        setIsSelectingPort(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
      if (window.ipcRenderer) {
          window.ipcRenderer.off('serial-ports-available');
      }
    };
  }, [t]);

  const handleSelectDeviceClick = async () => {
    try {
      // Define filters for common ESP32 USB-Serial chips
      const filters = [
        { usbVendorId: 0x303A }, // Espressif
        { usbVendorId: 0x10C4 }, // Silicon Labs (CP210x)
        { usbVendorId: 0x1A86 }, // WCH (CH340/CH9102)
        { usbVendorId: 0x0403 }, // FTDI
      ];

      // Request a port (triggers Electron's select-serial-port)
      const selectedPort = await (navigator as any).serial.requestPort({ filters });
      
      // Just set the port, don't open it yet
      setPort(selectedPort);
      setStatus('ready');
      
      xtermRef.current?.writeln(t('flasher.status.ready'));
      
    } catch (error) {
      console.error('Error selecting port:', error);
      if (String(error).includes('No port selected')) {
         xtermRef.current?.writeln('Port selection cancelled.');
      } else {
         xtermRef.current?.writeln(`Error: ${error}`);
      }
      setIsSelectingPort(false);
    }
  };

  const handlePortSelect = (portId: string) => {
      setSelectedPortId(portId);
      // Tell main process which port we selected
      window.ipcRenderer.send('serial-port-selected', portId);
      setIsSelectingPort(false);
  };

  const handleToggleConnect = async () => {
    if (!port) return;

    if (connected) {
      // Disconnect
      try {
        if (readerRef.current) {
            await readerRef.current.cancel();
            readerRef.current = null;
        }
        await port.close();
        setConnected(false);
        xtermRef.current?.writeln('Disconnected.');
      } catch (e) {
        console.error('Error disconnecting:', e);
        xtermRef.current?.writeln(`Error disconnecting: ${e}`);
        // Force state update anyway
        setConnected(false);
      }
    } else {
      // Connect (Monitor Mode)
      try {
        await port.open({ baudRate });
        setConnected(true);
        xtermRef.current?.writeln(`Connected to port @ ${baudRate} baud.`);
        readLoop(port);
      } catch (e) {
        console.error('Error connecting:', e);
        xtermRef.current?.writeln(`Error connecting: ${e}`);
      }
    }
  };

  const readLoop = async (port: any) => {
    if (!port.readable) return;
    const reader = port.readable.getReader();
    readerRef.current = reader;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          reader.releaseLock();
          break;
        }
        if (value) {
            xtermRef.current?.write(value);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
        // reader.releaseLock(); // Handled by cancel() usually, or done
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      xtermRef.current?.writeln(`Selected firmware: ${e.target.files[0].name} (${e.target.files[0].size} bytes)`);
    }
  };

  const handleFlash = async () => {
    if (!port) {
      xtermRef.current?.writeln('Error: Please select a device first.');
      return;
    }
    if (!file) {
        xtermRef.current?.writeln('Error: Please select a firmware file.');
        return;
    }

    // If connected (monitoring), we must disconnect first to let esptool take over
    if (connected) {
        xtermRef.current?.writeln('Closing monitor for flashing...');
        try {
            if (readerRef.current) {
                await readerRef.current.cancel();
                readerRef.current = null;
            }
            await port.close();
            setConnected(false);
        } catch (e) {
            console.error('Error closing monitor:', e);
            xtermRef.current?.writeln('Error closing monitor. Please try again.');
            return;
        }
    }

    setStatus('flashing');
    xtermRef.current?.writeln('Starting flash process...');
    
    try {
        // Dynamic import esptool-js
        const esptool = await import('esptool-js');
        const Transport = esptool.Transport;
        const ESPLoader = esptool.ESPLoader;
        
        if (!Transport || !ESPLoader) {
            throw new Error('Failed to load esptool-js classes');
        }

        const transport = new Transport(port as any, true);
        
        // Monkey-patch getInfo if missing to satisfy ESPLoader constructor
        if (!(transport as any).getInfo) {
            (transport as any).getInfo = () => "WebSerial Port";
        }
        
        const espLoader = new (ESPLoader as any)({
            transport: transport,
            baudrate: flashBaudRate,
            terminal: {
                clean: () => xtermRef.current?.clear(),
                writeLine: (text: string) => xtermRef.current?.writeln(text),
                write: (text: string) => xtermRef.current?.write(text),
            }
        });

        xtermRef.current?.writeln('Syncing...');
        await espLoader.main(); // Sync and detect chip
        
        // Read file
        const fileContent = await file.arrayBuffer();
        const fileString = new Uint8Array(fileContent);
        // Convert Uint8Array to binary string for esptool-js v0.5.4
        const binaryString = Array.from(fileString).map(b => String.fromCharCode(b)).join("");
        
        xtermRef.current?.writeln(`Flashing ${file.name} (${file.size} bytes)...`);
        
        await espLoader.writeFlash({
            fileArray: [{ data: binaryString, address: 0x0000 }],
            flashSize: 'keep',
            flashMode: 'keep',
            flashFreq: 'keep',
            eraseAll: false,
            compress: true,
            reportProgress: (_fileIndex: number, written: number, total: number) => {
                const percent = Math.round((written / total) * 100);
                setProgress(percent);
            },
            calculateMD5Hash: (image: string) => {
                const hash = SparkMD5.hashBinary(image);
                return hash;
            }
        });
        
        xtermRef.current?.writeln('Flash complete! Resetting...');
        
        // Reset
        await transport.setDTR(false);
        await transport.setRTS(true);
        await new Promise(r => setTimeout(r, 100));
        await transport.setRTS(false);
        
        setStatus('success');
        
    } catch (e: any) {
        console.error('Flash Error:', e);
        xtermRef.current?.writeln(`Flash Error: ${e.message || e}`);
        setStatus('error');
    }
  };

  // Helper to format vendor/product IDs
  const formatId = (id?: string) => id ? `0x${parseInt(id).toString(16).toUpperCase().padStart(4, '0')}` : 'Unknown';
  
  // Helper for status text
  const getStatusText = () => {
      switch(status) {
          case 'flashing': return t('flasher.status.flashing');
          case 'success': return t('flasher.status.success');
          case 'error': return t('flasher.status.error');
          case 'ready': return t('flasher.status.ready');
          default: return 'Idle';
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white p-6 gap-6" onClick={() => {}}>
      {/* Header / Controls */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end relative z-10">
        
        <div className="relative" ref={portSelectRef}>
          <label className="block text-sm font-medium text-slate-400 mb-1">{t('flasher.label_port')}</label>
          <div className="flex gap-2">
            <button 
              onClick={handleSelectDeviceClick}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-between border
                ${port 
                    ? 'bg-slate-700 hover:bg-slate-600 text-white border-slate-500' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
                }`}
            >
              <span className="truncate">
                  {selectedPortId 
                        ? (availablePorts.find(p => p.portId === selectedPortId)?.displayName || t('flasher.status.ready'))
                        : t('flasher.select_port_msg', 'Select Device').includes('Select') ? 'Select Device' : t('flasher.select_port_msg')} 
              </span>
              {!connected && <ChevronDown size={16} className={`ml-2 transition-transform ${isSelectingPort ? 'rotate-180' : ''}`} />}
            </button>
          </div>

          {/* Custom Port Selection Dropdown */}
          {isSelectingPort && !connected && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in-up w-[140%] min-w-[300px]">
                  <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600">
                      {availablePorts.length === 0 ? (
                          <div className="p-4 text-center text-slate-500 text-sm">
                              No compatible devices found.<br/>Check connections.
                          </div>
                      ) : (
                          availablePorts.map((p) => (
                              <button
                                  key={p.portId}
                                  onClick={() => handlePortSelect(p.portId)}
                                  className="w-full text-left p-3 hover:bg-slate-700 border-b border-slate-700/50 last:border-0 transition-colors group"
                              >
                                  <div className="flex items-start gap-3">
                                      <div className={`mt-1 p-1.5 rounded-lg ${p.vendorId === '12346' ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/50 text-blue-400'}`}>
                                          {p.vendorId === '12346' ? <Cpu size={18} /> : <Usb size={18} />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-center mb-0.5">
                                              <span className="font-semibold text-sm text-slate-200 truncate pr-2">
                                                  {p.displayName || p.portName}
                                              </span>
                                              {p.vendorId === '12346' && (
                                                  <span className="text-[10px] bg-green-900 text-green-300 px-1.5 py-0.5 rounded font-medium border border-green-800">
                                                      ESP32
                                                  </span>
                                              )}
                                          </div>
                                          <div className="text-xs text-slate-400 font-mono mb-1 truncate">
                                              {p.portName}
                                          </div>
                                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                                              {p.manufacturer && <span>{t('device_toast.manufacturer')}: {p.manufacturer}</span>}
                                              {(p.vendorId || p.productId) && (
                                                  <span className="font-mono opacity-75">
                                                      {formatId(p.vendorId)}:{formatId(p.productId)}
                                                  </span>
                                              )}
                                          </div>
                                      </div>
                                      {selectedPortId === p.portId && (
                                          <div className="mt-2 text-blue-400">
                                              <Check size={16} />
                                          </div>
                                      )}
                                  </div>
                              </button>
                          ))
                      )}
                  </div>
                  <div className="p-2 bg-slate-900/50 border-t border-slate-700 text-[10px] text-center text-slate-500">
                      {t('flasher.select_port_msg')}
                  </div>
              </div>
          )}
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('flasher.label_chip')}</label>
            <select 
                value={chipFamily} 
                onChange={e => setChipFamily(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
                <option value="ESP32">ESP32</option>
                <option value="ESP32-S3">ESP32-S3</option>
                <option value="ESP32-C3">ESP32-C3</option>
                <option value="ESP32-C6">ESP32-C6</option>
            </select>
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('flasher.label_baud')}</label>
            <select 
                value={flashBaudRate} 
                onChange={e => setFlashBaudRate(Number(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
                <option value={115200}>115200</option>
                <option value={460800}>460800</option>
                <option value={921600}>921600</option>
                <option value={1500000}>1500000</option>
            </select>
        </div>
        
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('flasher.label_firmware')}</label>
             <input 
                type="file" 
                accept=".bin"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-600 file:text-white
                  hover:file:bg-blue-700
                "
              />
        </div>

      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="flex items-center gap-4 flex-1 mr-8">
            <span className="text-sm font-medium text-slate-400">Status:</span>
            <span className={`text-sm font-bold ${status === 'success' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-white'}`}>
                {getStatusText()}
            </span>
            {progress > 0 && (
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite] shadow-[0_0_10px_rgba(56,189,248,0.6)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
            {progress > 0 && <span className="text-xs text-slate-400">{progress}%</span>}
        </div>
        
        <button 
            onClick={handleToggleConnect}
            disabled={!port || status === 'flashing'}
            className={`px-6 py-3 rounded-lg font-bold text-sm shadow-lg transition-all mr-4
                ${(!port || status === 'flashing')
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : connected
                        ? 'bg-red-600 hover:bg-red-500 text-white hover:shadow-red-500/25'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/25'
                }`}
        >
            {connected ? t('flasher.btn_disconnect_console') : t('flasher.btn_connect_console')}
        </button>

        <button 
            onClick={handleFlash}
            disabled={!port || !file || status === 'flashing'}
            className={`px-8 py-3 rounded-lg font-bold text-lg shadow-lg transition-all
                ${(!port || !file) 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/25'
                }`}
        >
            {t('flasher.btn_flash')}
        </button>
      </div>

      {/* Terminal */}
      <div className="flex-1 bg-black rounded-xl border border-slate-700 overflow-hidden relative shadow-inner">
        <div ref={terminalRef} className="absolute inset-0 p-4" />
      </div>
    </div>
  );
};

export default Flasher;
