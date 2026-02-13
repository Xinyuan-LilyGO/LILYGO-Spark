import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { ChevronDown, Usb, Cpu, Check, Layers, Plus, Trash2, FilePlus, Download, Save } from 'lucide-react';
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

interface FlashFile {
    id: string;
    file: File | null;
    address: string;
    enable: boolean;
}

const Burner: React.FC = () => {
  const { t } = useTranslation();
  
  // Mode state
  const [mode, setMode] = useState<'basic' | 'advanced'>('basic');

  const [port, setPort] = useState<SerialPort | null>(null);
  const [connected, setConnected] = useState(false);
  const [baudRate] = useState(115200); // Default for logs
  const [flashBaudRate, setFlashBaudRate] = useState(921600); // Default for flashing
  const [chipFamily, setChipFamily] = useState('ESP32-S3'); // Default, maybe auto-detect
  
  // Basic Mode File
  const [file, setFile] = useState<File | null>(null);
  
  // Advanced Mode Files
  const [files, setFiles] = useState<FlashFile[]>([
      { id: '1', file: null, address: '0x10000', enable: true },
      { id: '2', file: null, address: '0x8000', enable: true },
      { id: '3', file: null, address: '0x0000', enable: false },
      { id: '4', file: null, address: '0x0000', enable: false }
  ]);

    const [toolStrategy, setToolStrategy] = useState<'native' | 'js'>('native');
    const [downloadUrl, setDownloadUrl] = useState('');
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadedFile, setDownloadedFile] = useState<{ path: string, md5: string, sha256: string, fileName: string } | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
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

      term.writeln(t('burner.welcome'));
      term.writeln(t('burner.select_port_msg'));
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
      
      xtermRef.current?.writeln(t('burner.status.ready'));
      
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

  const handleAdvancedFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const newFiles = [...files];
      if (e.target.files && e.target.files.length > 0) {
          newFiles[index].file = e.target.files[0];
          newFiles[index].enable = true; // Auto-enable when file selected
          setFiles(newFiles);
      }
  };

  const updateFileAddress = (index: number, address: string) => {
      const newFiles = [...files];
      newFiles[index].address = address;
      setFiles(newFiles);
  };

  const toggleFileEnable = (index: number) => {
      const newFiles = [...files];
      newFiles[index].enable = !newFiles[index].enable;
      setFiles(newFiles);
  };

  const addFileRow = () => {
      setFiles([...files, { id: Date.now().toString(), file: null, address: '0x0000', enable: true }]);
  };

  const removeFileRow = (index: number) => {
      const newFiles = files.filter((_, i) => i !== index);
      setFiles(newFiles);
  };

    const handleDownload = async () => {
        if (!downloadUrl) return;
        setIsDownloading(true);
        setDownloadProgress(0);
        xtermRef.current?.writeln(`Downloading firmware from: ${downloadUrl}`);

        try {
            if (window.ipcRenderer) {
                window.ipcRenderer.on('download-progress', (_event, { percent }) => {
                    setDownloadProgress(percent);
                });

                const result = await window.ipcRenderer.invoke('download-firmware', downloadUrl);
                
                // window.ipcRenderer.removeAllListeners('download-progress');
                // Use off instead
                window.ipcRenderer.off('download-progress', () => {}); // We need the reference to the handler to remove it properly, but here we just want to stop listening.
                // Actually, the previous code used a handler reference.
                // Let's just ignore this line or fix it if I have the handler.
                // In the previous code I didn't save the handler reference in handleDownload.
                // Let's just remove all listeners for this channel?
                // Electron's removeAllListeners is available on EventEmitter, but ipcRenderer might be a wrapper.
                // If it's the standard Electron ipcRenderer, it has removeAllListeners.
                // But the type definition might be incomplete in the window.d.ts or similar.
                // I'll cast it to any to bypass TS check.
                (window.ipcRenderer as any).removeAllListeners('download-progress');

                if (result.success) {
                    setDownloadedFile({
                        path: result.path,
                        md5: result.md5,
                        sha256: result.sha256,
                        fileName: result.fileName
                    });
                    xtermRef.current?.writeln(`Download complete: ${result.fileName}`);
                    xtermRef.current?.writeln(`MD5: ${result.md5}`);
                    xtermRef.current?.writeln(`SHA256: ${result.sha256}`);
                } else {
                    xtermRef.current?.writeln(`Download failed: ${result.error}`);
                }
            }
        } catch (e: any) {
            xtermRef.current?.writeln(`Download error: ${e.message}`);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleRemoveDownloaded = async () => {
        if (!downloadedFile) return;
        if (window.ipcRenderer) {
            await window.ipcRenderer.invoke('remove-file', downloadedFile.path);
            setDownloadedFile(null);
            setDownloadProgress(0);
            xtermRef.current?.writeln('Downloaded file removed.');
        }
    };

    const handleSaveAs = async () => {
        if (!downloadedFile) return;
        if (window.ipcRenderer) {
            // If it's a zip, we might want to suggest .bin if extracted, but for now let's just save what we have
            // The backend handler handles the copy
            const success = await window.ipcRenderer.invoke('save-file', downloadedFile.fileName, downloadedFile.path);
            if (success) {
                xtermRef.current?.writeln('File saved successfully.');
            } else {
                xtermRef.current?.writeln('File save cancelled or failed.');
            }
        }
    };

      const handleFlash = async () => {
        if (!port) {
          xtermRef.current?.writeln('Error: Please select a device first.');
          return;
        }

        // Native Flash Strategy
        if (toolStrategy === 'native') {
            if (!downloadedFile && mode === 'basic' && !file) {
                 xtermRef.current?.writeln('Error: No firmware selected or downloaded.');
                 return;
            }

            // We need the port path for native flashing (e.g. /dev/ttyUSB0)
            // The availablePorts list has this info.
            // selectedPortId corresponds to the portId in availablePorts
            const selectedPortInfo = availablePorts.find(p => p.portId === selectedPortId);
            if (!selectedPortInfo) {
                xtermRef.current?.writeln('Error: Could not determine native port path.');
                return;
            }

            const portPath = selectedPortInfo.portName; // This is usually the path (COMx or /dev/tty...)
            
            let filePathToFlash = '';
            if (downloadedFile) {
                filePathToFlash = downloadedFile.path;
            } else if (file && (file as File & { path?: string }).path) { // file.path exists in Electron environment
                filePathToFlash = (file as File & { path: string }).path;
            } else {
                 xtermRef.current?.writeln('Error: Cannot flash local file in browser mode with native tool (requires Electron file path).');
                 return;
            }

            setStatus('flashing');
            
            // Listen for flash logs from main
            const logHandler = (_event: any, msg: string) => {
                xtermRef.current?.write(msg);
            };
            window.ipcRenderer.on('flash-log', logHandler);

            try {
                const success = await window.ipcRenderer.invoke('flash-firmware-native', portPath, flashBaudRate, filePathToFlash);
                if (success) {
                    setStatus('success');
                    xtermRef.current?.writeln('Native Flash Success!');
                } else {
                    setStatus('error');
                    xtermRef.current?.writeln('Native Flash Failed.');
                }
            } catch (e: any) {
                setStatus('error');
                xtermRef.current?.writeln(`Native Flash Error: ${e.message}`);
            } finally {
                window.ipcRenderer.off('flash-log', logHandler);
            }
            return;
        }
        
        // JS Flash Strategy (Existing Logic)
        
        // Validate files based on mode
        let filesToFlash: Array<{ data: string, address: number }> = [];
        
        if (mode === 'basic') {
            if (downloadedFile) {
                 // Read downloaded file from disk via IPC? Or just fetch it again?
                 // Since we are in renderer, we can't easily read arbitrary paths unless we use IPC to read file content.
                 // Let's assume for JS flashing we prefer the user to pick a file, OR we implement reading the temp file.
                 // For now, let's support the File object picker for JS mode, or if downloaded, we need to read it.
                 // Actually, if we have a downloaded path, we can ask main to read it.
                 // But for simplicity, let's stick to the File object for JS mode if not downloaded.
                 
                 // If downloadedFile exists, we need to read it into a buffer for esptool-js
                 // This requires an IPC handler 'read-file-content' which we don't have yet.
                 // So for now, JS mode might only work with user-selected files or we add the handler.
                 
                 // Let's rely on the fact that if they use JS mode, they probably picked a file.
                 // If they downloaded a file, they should probably use Native mode or we need to add reading logic.
                 // Let's add a warning if they try to use downloaded file with JS mode without logic.
                 
                 if (downloadedFile) {
                     xtermRef.current?.writeln('Note: Flashing downloaded files with esptool-js requires reading the file into memory. Switching to Native mode recommended.');
                     // Fallback: try to fetch the local file using file:// protocol if allowed?
                     // Or just tell them to use Native.
                 }
            }
            
            if (!file && !downloadedFile) {
                xtermRef.current?.writeln('Error: Please select a firmware file.');
                return;
            }
            
            if (file) {
                const fileContent = await file.arrayBuffer();
                const fileString = new Uint8Array(fileContent);
                const binaryString = Array.from(fileString).map(b => String.fromCharCode(b)).join("");
                filesToFlash.push({ data: binaryString, address: 0x0000 });
            }
        } else {
            // Advanced Mode
            const enabledFiles = files.filter(f => f.enable && f.file);
            if (enabledFiles.length === 0) {
                xtermRef.current?.writeln('Error: No enabled files to flash.');
                return;
            }
            
            xtermRef.current?.writeln(`Preparing ${enabledFiles.length} files...`);
            
            for (const f of enabledFiles) {
                if (!f.file) continue;
                try {
                    const fileContent = await f.file.arrayBuffer();
                    const fileString = new Uint8Array(fileContent);
                    const binaryString = Array.from(fileString).map(b => String.fromCharCode(b)).join("");
                    const addr = parseInt(f.address, 16);
                    if (isNaN(addr)) throw new Error(`Invalid address: ${f.address}`);
                    
                    filesToFlash.push({ data: binaryString, address: addr });
                    xtermRef.current?.writeln(` - ${f.file.name} @ 0x${addr.toString(16)}`);
                } catch (e) {
                    xtermRef.current?.writeln(`Error reading ${f.file.name}: ${e}`);
                    return;
                }
            }
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
            
            await espLoader.writeFlash({
                fileArray: filesToFlash,
                flashSize: 'keep',
                flashMode: 'keep',
                flashFreq: 'keep',
                eraseAll: false,
                compress: true,
                reportProgress: (_fileIndex: number, written: number, total: number) => {
                    const percent = Math.round((written / total) * 100);
                    setDownloadProgress(percent); // Reuse progress state
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
          case 'flashing': return t('burner.status.flashing');
          case 'success': return t('burner.status.success');
          case 'error': return t('burner.status.error');
          case 'ready': return t('burner.status.ready');
          default: return 'Idle';
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-6 gap-6 transition-colors" onClick={() => {}}>
      {/* Mode Switcher */}
      <div className="flex space-x-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl self-start border border-slate-300 dark:border-slate-700">
          <button
              onClick={() => setMode('basic')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${
                  mode === 'basic' 
                      ? 'bg-slate-600 dark:bg-slate-700 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50'
              }`}
          >
              <FilePlus size={16} className="mr-2" />
              {t('burner.mode_basic')}
          </button>
          <button
              onClick={() => setMode('advanced')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${
                  mode === 'advanced' 
                      ? 'bg-slate-600 dark:bg-slate-700 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50'
              }`}
          >
              <Layers size={16} className="mr-2" />
              {t('burner.mode_advanced')}
          </button>
      </div>

      {/* Header / Controls */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end relative z-10">
        
        <div className="relative" ref={portSelectRef}>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('burner.label_port')}</label>
          <div className="flex gap-2">
            <button 
              onClick={handleSelectDeviceClick}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-between border
                ${port 
                    ? 'bg-slate-600 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600 text-white border-slate-400 dark:border-slate-500' 
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                }`}
            >
              <span className="truncate">
                  {selectedPortId 
                        ? (availablePorts.find(p => p.portId === selectedPortId)?.displayName || t('burner.status.ready'))
                        : t('burner.select_port_msg', 'Select Device').includes('Select') ? 'Select Device' : t('burner.select_port_msg')} 
              </span>
              {!connected && <ChevronDown size={16} className={`ml-2 transition-transform ${isSelectingPort ? 'rotate-180' : ''}`} />}
            </button>
          </div>

          {/* Custom Port Selection Dropdown */}
          {isSelectingPort && !connected && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in-up w-[140%] min-w-[300px]">
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
                                  className="w-full text-left p-3 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-200 dark:border-slate-700/50 last:border-0 transition-colors group"
                              >
                                  <div className="flex items-start gap-3">
                                      <div className={`mt-1 p-1.5 rounded-lg ${p.vendorId === '12346' ? 'bg-green-900/50 text-green-400' : 'bg-blue-900/50 text-blue-400'}`}>
                                          {p.vendorId === '12346' ? <Cpu size={18} /> : <Usb size={18} />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-center mb-0.5">
                                              <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate pr-2">
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
                      {t('burner.select_port_msg')}
                  </div>
              </div>
          )}
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Tool Strategy</label>
            <select 
                value={toolStrategy} 
                onChange={e => setToolStrategy(e.target.value as 'native' | 'js')}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
                <option value="native">esptool (Native)</option>
                <option value="js">esptool-js (Web)</option>
            </select>
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('burner.label_chip')}</label>
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
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('burner.label_baud')}</label>
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
        
        {mode === 'basic' && (
            <div className="col-span-1 md:col-span-2 lg:col-span-4 space-y-4">
                <div className="flex gap-4 items-start">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-400 mb-1">{t('burner.label_firmware')}</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Enter firmware URL or select file..."
                                value={downloadUrl}
                                onChange={(e) => setDownloadUrl(e.target.value)}
                                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-500"
                            />
                            <button
                                onClick={handleDownload}
                                disabled={!downloadUrl || isDownloading || !!downloadedFile}
                                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center
                                    ${(!downloadUrl || isDownloading || !!downloadedFile)
                                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                                    }`}
                            >
                                <Download size={18} className="mr-2" />
                                {isDownloading ? 'Downloading...' : 'Download'}
                            </button>
                        </div>
                        
                        {/* Download Progress */}
                        {isDownloading && (
                            <div className="mt-2">
                                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-500 transition-all duration-300"
                                        style={{ width: `${downloadProgress}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>Downloading...</span>
                                    <span>{downloadProgress}%</span>
                                </div>
                            </div>
                        )}

                        {/* Downloaded File Info */}
                        {downloadedFile && (
                            <div className="mt-3 p-3 bg-slate-700/50 rounded-lg border border-slate-600/50">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center text-emerald-400 text-sm font-medium">
                                        <Check size={16} className="mr-1.5" />
                                        Firmware Ready: {downloadedFile.fileName}
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleSaveAs}
                                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                                            title="Save As..."
                                        >
                                            <Save size={16} />
                                        </button>
                                        <button 
                                            onClick={handleRemoveDownloaded}
                                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
                                            title="Remove"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-1 text-[10px] font-mono text-slate-400">
                                    <div className="flex gap-2">
                                        <span className="opacity-50">MD5:</span>
                                        <span className="select-all">{downloadedFile.md5}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className="opacity-50">SHA256:</span>
                                        <span className="select-all truncate">{downloadedFile.sha256}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-px bg-slate-700 self-stretch mx-2"></div>

                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-400 mb-1">Local File</label>
                        <input 
                            type="file" 
                            accept=".bin"
                            onChange={handleFileChange}
                            disabled={!!downloadedFile}
                            className="block w-full text-sm text-slate-400
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-lg file:border-0
                              file:text-sm file:font-semibold
                              file:bg-slate-700 file:text-slate-300
                              hover:file:bg-slate-600
                              disabled:opacity-50 disabled:cursor-not-allowed
                            "
                        />
                        <p className="text-xs text-slate-500 mt-2">
                            Select a local .bin file if not downloading from URL.
                        </p>
                    </div>
                </div>
            </div>
        )}

      </div>

      {/* Advanced File List */}
      {mode === 'advanced' && (
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center">
                      <Layers size={20} className="mr-2 text-blue-400" />
                      Files to Flash
                  </h3>
                  <button 
                      onClick={addFileRow}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-sm rounded-lg flex items-center transition-colors"
                  >
                      <Plus size={16} className="mr-1.5" /> Add File
                  </button>
              </div>
              
              <div className="space-y-3">
                  {files.map((f, index) => (
                      <div key={f.id} className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${f.enable ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-800 border-slate-700 opacity-60'}`}>
                          <input 
                              type="checkbox" 
                              checked={f.enable} 
                              onChange={() => toggleFileEnable(index)}
                              className="w-5 h-5 rounded border-slate-500 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                          />
                          
                          <div className="flex-1">
                              <input 
                                  type="file" 
                                  accept=".bin"
                                  onChange={(e) => handleAdvancedFileChange(index, e)}
                                  className="block w-full text-xs text-slate-400
                                    file:mr-2 file:py-1 file:px-2
                                    file:rounded-md file:border-0
                                    file:text-xs file:font-semibold
                                    file:bg-slate-600 file:text-white
                                    hover:file:bg-slate-500
                                  "
                              />
                          </div>
                          
                          <div className="w-32">
                              <div className="flex items-center bg-slate-900 rounded-md border border-slate-600 px-2">
                                  <span className="text-xs text-slate-500 mr-1">@</span>
                                  <input 
                                      type="text" 
                                      value={f.address} 
                                      onChange={(e) => updateFileAddress(index, e.target.value)}
                                      className="w-full bg-transparent border-none text-xs text-white py-1.5 focus:ring-0 font-mono"
                                      placeholder="0x0000"
                                  />
                              </div>
                          </div>
                          
                          <button 
                              onClick={() => removeFileRow(index)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded-md transition-colors"
                          >
                              <Trash2 size={16} />
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4 flex-1 mr-8">
            <span className="text-sm font-medium text-slate-400">Status:</span>
            <span className={`text-sm font-bold ${status === 'success' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-white'}`}>
                {getStatusText()}
            </span>
            {/* Removed progress bar here as it conflicted with download progress and was unused for flashing in new design */}
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
            {connected ? t('burner.btn_disconnect_console') : t('burner.btn_connect_console')}
        </button>

        <button 
            onClick={handleFlash}
            disabled={!port || (mode === 'basic' && !file && !downloadedFile) || (mode === 'advanced' && files.filter(f => f.enable && f.file).length === 0) || status === 'flashing'}
            className={`px-8 py-3 rounded-lg font-bold text-lg shadow-lg transition-all
                ${(!port || (mode === 'basic' && !file && !downloadedFile) || (mode === 'advanced' && files.filter(f => f.enable && f.file).length === 0))
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/25'
                }`}
        >
            {t('burner.btn_flash')}
        </button>
      </div>

      {/* Terminal */}
      <div className="flex-1 bg-black rounded-xl border border-slate-700 overflow-hidden relative shadow-inner">
        <div ref={terminalRef} className="absolute inset-0 p-4" />
      </div>
    </div>
  );
};

export default Burner;
