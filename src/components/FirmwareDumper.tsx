import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { ChevronDown, Usb, Cpu, Check, Download } from 'lucide-react';

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

const FirmwareDumper: React.FC = () => {
  const { t } = useTranslation();
  
  // Dump Mode State
  const [port, setPort] = useState<SerialPort | null>(null);
  const [flashBaudRate, setFlashBaudRate] = useState(921600); // Default for dumping
  const [progress, setProgress] = useState(0);
  // Status key: 'idle', 'ready', 'dumping', 'success', 'error'
  const [status, setStatus] = useState<string>('idle');
  
  // Chip Info
  const [detectedChip, setDetectedChip] = useState<string>('');
  const [detectedFlashSize, setDetectedFlashSize] = useState<string>('');

  // Dump settings
  const [dumpSize, setDumpSize] = useState<string>('0x400000'); // Default 4MB
  const [dumpAddress, setDumpAddress] = useState<string>('0x000000');
  
  // Port Selection State
  const [availablePorts, setAvailablePorts] = useState<ElectronSerialPortInfo[]>([]);
  const [isSelectingPort, setIsSelectingPort] = useState(false);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  
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

      term.writeln(t('dumper.terminal_init'));
      term.writeln(t('dumper.terminal_select_device'));
    }
    
    // Handle resize
    const handleResize = () => {
      fitAddonRef.current?.fit();
    };
    window.addEventListener('resize', handleResize);

    // Listen for port selection from Main process
    if (window.ipcRenderer) {
        window.ipcRenderer.on('serial-ports-available', (_event, ports: ElectronSerialPortInfo[]) => {
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
      const filters = [
        { usbVendorId: 0x303A }, // Espressif
        { usbVendorId: 0x10C4 }, // Silicon Labs (CP210x)
        { usbVendorId: 0x1A86 }, // WCH (CH340/CH9102)
        { usbVendorId: 0x0403 }, // FTDI
      ];

      // Request a port (triggers Electron's select-serial-port)
      const selectedPort = await (navigator as any).serial.requestPort({ filters });
      
      setPort(selectedPort);
      setStatus('ready');
      xtermRef.current?.writeln(t('dumper.terminal_device_selected'));
      
    } catch (error) {
      console.error('Error selecting port:', error);
      xtermRef.current?.writeln(`${t('dumper.terminal_port_selection_error')}: ${error}`);
      setIsSelectingPort(false);
    }
  };

  const handlePortSelect = (portId: string) => {
      setSelectedPortId(portId);
      window.ipcRenderer.send('serial-port-selected', portId);
      setIsSelectingPort(false);
  };

  const handleDetect = async () => {
    if (!port) {
      xtermRef.current?.writeln(t('dumper.terminal_error_select_device'));
      return;
    }

    setStatus('detecting');
    xtermRef.current?.writeln(t('dumper.terminal_detecting'));
    
    try {
        const esptool = await import('esptool-js');
        const Transport = esptool.Transport;
        const ESPLoader = esptool.ESPLoader;
        
        const transport = new Transport(port as any, true);
        if (!(transport as any).getInfo) (transport as any).getInfo = () => "WebSerial Port";
        
        const espLoader = new (ESPLoader as any)({
            transport: transport,
            baudrate: flashBaudRate,
            terminal: {
                clean: () => {},
                writeLine: (text: string) => xtermRef.current?.writeln(text),
                write: (text: string) => xtermRef.current?.write(text),
            }
        });

        await espLoader.main();
        
        const chipName = await espLoader.chipName();
        const flashId = await espLoader.readFlashId();
        
        // Map common flash sizes from ID (simplified)
        // Flash ID structure usually: Manufacturer (1 byte) + Device ID (2 bytes)
        // e.g., 0x4016 -> 4MB, 0x4017 -> 8MB, 0x4018 -> 16MB
        // This is a rough heuristic, esptool.py has a full table
        let sizeHex = '0x400000'; // Default 4MB
        // @ts-ignore - flashId might be number or object depending on version
        const sizeByte = flashId & 0xFF; 
        
        if (sizeByte === 0x16) sizeHex = '0x400000'; // 4MB
        else if (sizeByte === 0x17) sizeHex = '0x800000'; // 8MB
        else if (sizeByte === 0x18) sizeHex = '0x1000000'; // 16MB
        else if (sizeByte === 0x19) sizeHex = '0x2000000'; // 32MB
        
        setDetectedChip(chipName);
        setDetectedFlashSize(sizeHex);
        setDumpSize(sizeHex); // Auto-set dump size
        
        xtermRef.current?.writeln(`${t('dumper.terminal_detected')}: ${chipName}`);
        xtermRef.current?.writeln(`${t('dumper.terminal_flash_id')}: 0x${flashId.toString(16)} -> ${t('dumper.terminal_size')}: ${sizeHex}`);
        
        // Reset
        await transport.setDTR(false);
        await transport.setRTS(true);
        await new Promise(r => setTimeout(r, 100));
        await transport.setRTS(false);
        
        setStatus('ready');
    } catch (e: any) {
        console.error('Detection Error:', e);
        xtermRef.current?.writeln(`${t('dumper.terminal_error')}: ${e.message || e}`);
        setStatus('error');
    }
  };

  const handleDump = async () => {
    if (!port) {
      xtermRef.current?.writeln(t('dumper.terminal_error_select_device'));
      return;
    }

    setStatus('dumping');
    xtermRef.current?.writeln(t('dumper.terminal_starting_dump'));
    
    try {
        // Dynamic import esptool-js
        const esptool = await import('esptool-js');
        const Transport = esptool.Transport;
        const ESPLoader = esptool.ESPLoader;
        
        if (!Transport || !ESPLoader) {
            throw new Error(t('dumper.terminal_error_esptool_load'));
        }

        const transport = new Transport(port as any, true);
        
        // Monkey-patch getInfo if missing
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

        xtermRef.current?.writeln(t('dumper.terminal_syncing'));
        await espLoader.main(); // Sync and detect chip
        
        const size = parseInt(dumpSize, 16);
        const address = parseInt(dumpAddress, 16);
        
        xtermRef.current?.writeln(`${t('dumper.terminal_reading_flash')} 0x${address.toString(16)} (${t('dumper.terminal_size')}: 0x${size.toString(16)})...`);
        
        // Use readFlash
        const data = await espLoader.readFlash({
            address: address,
            size: size,
            reportProgress: (_fileIndex: number, written: number, total: number) => {
                const percent = Math.round((written / total) * 100);
                setProgress(percent);
            }
        });
        
        xtermRef.current?.writeln(t('dumper.terminal_read_complete'));
        
        // Create Blob and download
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `firmware_dump_${new Date().toISOString().slice(0,19).replace(/[:T]/g, '-')}.bin`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        xtermRef.current?.writeln(t('dumper.terminal_file_saved'));
        
        // Reset
        await transport.setDTR(false);
        await transport.setRTS(true);
        await new Promise(r => setTimeout(r, 100));
        await transport.setRTS(false);
        
        setStatus('success');
        
    } catch (e: any) {
        console.error('Dump Error:', e);
        xtermRef.current?.writeln(`${t('dumper.terminal_dump_error')}: ${e.message || e}`);
        setStatus('error');
    }
  };



  return (
    <div className="flex flex-col h-full bg-slate-900 text-white p-6 gap-6">
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
                        ? (availablePorts.find(p => p.portId === selectedPortId)?.displayName || t('dumper.status_ready'))
                        : t('dumper.btn_select_device')} 
              </span>
              <ChevronDown size={16} className={`ml-2 transition-transform ${isSelectingPort ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Custom Port Selection Dropdown */}
          {isSelectingPort && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden z-50 w-[140%] min-w-[300px]">
                  <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600">
                      {availablePorts.length === 0 ? (
                          <div className="p-4 text-center text-slate-500 text-sm">
                              {t('dumper.no_devices_found')}<br/>{t('dumper.check_connections')}
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
                                          </div>
                                          <div className="text-xs text-slate-400 font-mono mb-1 truncate">
                                              {p.portName}
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
              </div>
          )}
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('dumper.label_start_address')}</label>
            <input 
                type="text" 
                value={dumpAddress} 
                onChange={e => setDumpAddress(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                placeholder="0x000000"
            />
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('dumper.label_size')}</label>
            <div className="flex gap-2">
                <input 
                    type="text" 
                    value={dumpSize} 
                    onChange={e => setDumpSize(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    placeholder="0x400000"
                />
                <select 
                    onChange={e => setDumpSize(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-2 text-white focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                    defaultValue=""
                >
                    <option value="" disabled>{t('dumper.presets')}</option>
                    <option value="0x400000">4MB</option>
                    <option value="0x800000">8MB</option>
                    <option value="0x1000000">16MB</option>
                </select>
            </div>
        </div>
        
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('dumper.label_baud_rate')}</label>
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

        <div className="col-span-1 md:col-span-2 lg:col-span-4 flex gap-4 border-t border-slate-700 pt-4 mt-2">
             <div className="flex-1 flex gap-2 items-end">
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-400 mb-1">{t('dumper.label_detected_chip')}</label>
                    <input 
                        type="text" 
                        value={detectedChip} 
                        readOnly
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 outline-none"
                        placeholder={t('dumper.unknown')}
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-400 mb-1">{t('dumper.label_detected_size')}</label>
                    <input 
                        type="text" 
                        value={detectedFlashSize} 
                        readOnly
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 outline-none font-mono"
                        placeholder={t('dumper.unknown')}
                    />
                </div>
                <button 
                    onClick={handleDetect}
                    disabled={!port || status === 'detecting' || status === 'dumping'}
                    className={`px-4 py-2 rounded-lg font-bold text-sm shadow-lg transition-all h-[42px]
                        ${(!port || status === 'detecting' || status === 'dumping') 
                            ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/25'
                        }`}
                >
                    {t('dumper.btn_detect_info')}
                </button>
             </div>
        </div>

      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="flex items-center gap-4 flex-1 mr-8">
            <span className="text-sm font-medium text-slate-400">{t('dumper.label_status')}:</span>
            <span className={`text-sm font-bold ${status === 'success' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-white'}`}>
                {status.toUpperCase()}
            </span>
            {progress > 0 && (
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
            {progress > 0 && <span className="text-xs text-slate-400">{progress}%</span>}
        </div>
        
        <button 
            onClick={handleDump}
            disabled={!port || status === 'dumping'}
            className={`px-8 py-3 rounded-lg font-bold text-lg shadow-lg transition-all flex items-center
                ${(!port || status === 'dumping') 
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/25'
                }`}
        >
            <Download className="mr-2" size={20} />
            {t('dumper.btn_dump_firmware')}
        </button>
      </div>

      {/* Terminal */}
      <div className="flex-1 bg-black rounded-xl border border-slate-700 overflow-hidden relative shadow-inner">
        <div ref={terminalRef} className="absolute inset-0 p-4" />
      </div>
    </div>
  );
};

export default FirmwareDumper;
