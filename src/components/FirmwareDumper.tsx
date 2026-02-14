import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { ChevronDown, Usb, Cpu, Check, Download, RefreshCw, Trash2, Copy, ArrowDownCircle, Activity, Box, Settings } from 'lucide-react';

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

/** 格式化端口路径 */
function formatPortPath(portName: string): string {
  if (!portName) return portName;
  if (/^COM\d+/i.test(portName)) return portName; // Windows
  if (portName.startsWith('/')) return portName;  // 已是完整路径
  return `/dev/${portName}`;                      // macOS/Linux 补全路径
}

/** 将十六进制大小转为 KB/MB 显示 */
function hexToHumanSize(hexStr: string): string {
  const n = parseInt(hexStr, 16);
  if (isNaN(n) || n <= 0) return '';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

const FirmwareDumper: React.FC = () => {
  const { t } = useTranslation();
  
  // Dump Mode State
  const [port, setPort] = useState<SerialPort | null>(null);
  const [flashBaudRate, setFlashBaudRate] = useState(921600);
  const [progress, setProgress] = useState(0);
  const [dumpSpeedKbps, setDumpSpeedKbps] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('idle');
  
  // Chip Info
  const [detectedChip, setDetectedChip] = useState<string>('');
  const [detectedFlashId, setDetectedFlashId] = useState<string>('');
  const [detectedMac, setDetectedMac] = useState<string>('');
  const [detectedCrystalFreq, setDetectedCrystalFreq] = useState<number | null>(null);

  // Dump settings
  const [dumpSize, setDumpSize] = useState<string>('0x400000');
  const [dumpAddress, setDumpAddress] = useState<string>('0x000000');
  
  // Port Selection State
  const [availablePorts, setAvailablePorts] = useState<ElectronSerialPortInfo[]>([]);
  const [isSelectingPort, setIsSelectingPort] = useState(false);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  
  // Console State
  const [autoScroll, setAutoScroll] = useState(true);

  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const portSelectRef = useRef<HTMLDivElement>(null);
  const operationInProgressRef = useRef(false);

  useEffect(() => {
    // Initialize xterm
    if (terminalRef.current && !xtermRef.current) {
      const term = new Terminal({
        theme: {
          background: '#09090b', // zinc-950
          foreground: '#f4f4f5', // zinc-100
          cursor: '#ffffff',
          selectionBackground: 'rgba(255, 255, 255, 0.3)',
        },
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 12,
        lineHeight: 1.4,
        cursorBlink: true,
        convertEol: true,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      term.writeln('\x1b[38;5;244m' + t('dumper.terminal_init') + '\x1b[0m');
      term.writeln('\x1b[38;5;244m' + t('dumper.terminal_select_device') + '\x1b[0m');
    }
    
    const handleResize = () => fitAddonRef.current?.fit();
    window.addEventListener('resize', handleResize);

    if (window.ipcRenderer) {
        window.ipcRenderer.on('serial-ports-available', (_event, ports: ElectronSerialPortInfo[]) => {
          setAvailablePorts(ports);
          setIsSelectingPort(true);
        });
    }
    
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

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && xtermRef.current) {
        xtermRef.current.scrollToBottom();
    }
  }, [progress, status, autoScroll]); // Trigger on updates

  const handleSelectDeviceClick = async () => {
    try {
      const filters = [
        { usbVendorId: 0x303A }, // Espressif
        { usbVendorId: 0x10C4 }, // Silicon Labs
        { usbVendorId: 0x1A86 }, // WCH
        { usbVendorId: 0x0403 }, // FTDI
      ];
      const selectedPort = await (navigator as any).serial.requestPort({ filters });
      
      setPort(selectedPort);
      setStatus('ready');
      xtermRef.current?.writeln(`\x1b[32m${t('dumper.terminal_device_selected')}\x1b[0m`);
      handleDetect(selectedPort);
      
    } catch (error) {
      console.error('Error selecting port:', error);
      setIsSelectingPort(false);
    }
  };

  const handlePortSelect = (portId: string) => {
      setSelectedPortId(portId);
      window.ipcRenderer.send('serial-port-selected', portId);
      setIsSelectingPort(false);
  };

  const handleDetect = async (overridePort?: SerialPort | null) => {
    const portToUse = overridePort ?? port;
    if (!portToUse) {
      xtermRef.current?.writeln(`\x1b[31m${t('dumper.terminal_error_select_device')}\x1b[0m`);
      return;
    }
    if (operationInProgressRef.current) return;
    operationInProgressRef.current = true;

    setStatus('detecting');
    xtermRef.current?.writeln(`\n\x1b[36m${t('dumper.terminal_detecting')}\x1b[0m`);
    
    let transport: any = null;
    try {
        try { await (portToUse as any)?.close?.(); } catch (_) {}
        await new Promise(r => setTimeout(r, 400));
        if (window.ipcRenderer) {
          await window.ipcRenderer.invoke('disconnect-serial');
          await new Promise(r => setTimeout(r, 300));
        }
        const esptool = await import('esptool-js');
        const Transport = esptool.Transport;
        const ESPLoader = esptool.ESPLoader;
        
        transport = new Transport(portToUse as any, true);
        if (!(transport as any).getInfo) (transport as any).getInfo = () => "WebSerial Port";
        
        const espLoader = new (ESPLoader as any)({
            transport: transport,
            baudrate: flashBaudRate,
            terminal: {
                clean: () => {},
                writeLine: (text: string) => {
                    xtermRef.current?.writeln(text);
                    if(autoScroll) xtermRef.current?.scrollToBottom();
                },
                write: (text: string) => {
                    xtermRef.current?.write(text);
                    if(autoScroll) xtermRef.current?.scrollToBottom();
                },
            }
        });

        await espLoader.main();
        
        const chipName = espLoader.chip?.CHIP_NAME ?? 'Unknown';
        const flashId = await espLoader.readFlashId();
        
        let sizeHex = '0x400000'; 
        // @ts-ignore
        const sizeByte = flashId & 0xFF; 
        if (sizeByte === 0x16) sizeHex = '0x400000';
        else if (sizeByte === 0x17) sizeHex = '0x800000';
        else if (sizeByte === 0x18) sizeHex = '0x1000000';
        else if (sizeByte === 0x19) sizeHex = '0x2000000';
        
        setDetectedChip(chipName);
        setDetectedFlashId(`0x${flashId.toString(16).toUpperCase()}`);
        setDumpSize(sizeHex);

        let mac = '';
        let crystal: number | null = null;
        try {
          if (typeof espLoader.chip?.readMac === 'function') {
            mac = await espLoader.chip.readMac(espLoader);
          }
        } catch (_) {}
        try {
          if (typeof (espLoader.chip as any)?.getCrystalFreq === 'function') {
            crystal = await (espLoader.chip as any).getCrystalFreq(espLoader);
          }
        } catch (_) {}
        setDetectedMac(mac);
        setDetectedCrystalFreq(crystal);
        
        xtermRef.current?.writeln(`\x1b[32m${t('dumper.terminal_detected')}: ${chipName}\x1b[0m`);
        xtermRef.current?.writeln(`Flash ID: 0x${flashId.toString(16)} -> Size: ${sizeHex}`);
        
        await transport.setDTR(false);
        await transport.setRTS(true);
        await new Promise(r => setTimeout(r, 100));
        await transport.setRTS(false);
        
        setStatus('ready');
    } catch (e: any) {
        console.error('Detection Error:', e);
        setDetectedFlashId('');
        setDetectedMac('');
        setDetectedCrystalFreq(null);
        const msg = (e.message || e).toString();
        const hint = msg.toLowerCase().includes('open') || msg.includes('failed') 
          ? `\n${t('dumper.terminal_error_port_in_use')}` 
          : '';
        xtermRef.current?.writeln(`\x1b[31m${t('dumper.terminal_error')}: ${msg}${hint}\x1b[0m`);
        setStatus('error');
    } finally {
        try {
          if (transport && typeof transport.disconnect === 'function') await transport.disconnect();
          else await (portToUse as any)?.close?.();
        } catch (_) {}
        operationInProgressRef.current = false;
    }
  };

  const handleDump = async () => {
    if (!port) {
      xtermRef.current?.writeln(`\x1b[31m${t('dumper.terminal_error_select_device')}\x1b[0m`);
      return;
    }
    if (operationInProgressRef.current) return;
    operationInProgressRef.current = true;

    setStatus('dumping');
    setDumpSpeedKbps(null);
    xtermRef.current?.writeln(`\n\x1b[36m${t('dumper.terminal_starting_dump')}\x1b[0m`);
    
    const portPath = selectedPortId ? formatPortPath(availablePorts.find(p => p.portId === selectedPortId)?.portName || '') : '';
    const size = parseInt(dumpSize, 16);
    const address = parseInt(dumpAddress, 16);
    
    let nativeSucceeded = false;
    if (window.ipcRenderer && portPath) {
      const logHandler = (_e: any, msg: string) => {
        xtermRef.current?.write(msg);
        if (autoScroll) xtermRef.current?.scrollToBottom();
        
        const progressMatch = msg.match(/(\d+)\s*\(\s*(\d+)\s*%\s*\)/);
        if (progressMatch) {
          const pct = parseInt(progressMatch[2], 10);
          if (!isNaN(pct)) setProgress(Math.min(100, pct));
        }
        const doneMatch = msg.match(/Read\s+(\d+)\s+bytes.*?in\s+([\d.]+)\s+seconds(?:.*?([\d.]+)\s*kbit\/s)?/i);
        if (doneMatch) {
          setProgress(100);
          const kbps = doneMatch[3] ? parseFloat(doneMatch[3]) : null;
          if (kbps != null && !isNaN(kbps)) setDumpSpeedKbps(kbps);
        }
      };
      const progressHandler = (_e: any, data: { percent?: number; speedKbps?: number }) => {
        if (data.percent != null) setProgress(Math.min(100, data.percent));
        if (data.speedKbps != null) setDumpSpeedKbps(data.speedKbps);
      };
      window.ipcRenderer.on('dump-log', logHandler);
      window.ipcRenderer.on('dump-progress', progressHandler);
      try {
        xtermRef.current?.writeln(t('dumper.terminal_using_native'));
        const result = await window.ipcRenderer.invoke('dump-firmware-native', portPath, flashBaudRate, dumpAddress, dumpSize) as { success: boolean; filePath?: string };
        if (result.success && result.filePath) {
          xtermRef.current?.writeln(`\x1b[32m${t('dumper.terminal_file_saved')}\x1b[0m`);
          xtermRef.current?.writeln(`→ ${result.filePath}`);
          setStatus('success');
          nativeSucceeded = true;
        } else {
          throw new Error('Native dump failed');
        }
      } catch (e) {
        xtermRef.current?.writeln(`\x1b[33m${t('dumper.terminal_fallback_js')}\x1b[0m`);
      } finally {
        window.ipcRenderer.off('dump-log');
        // @ts-ignore
        window.ipcRenderer.off('dump-progress');
      }
    }

    if (nativeSucceeded) {
      operationInProgressRef.current = false;
      return;
    }

    let transport: any = null;
    try {
        try { await (port as any)?.close?.(); } catch (_) {}
        await new Promise(r => setTimeout(r, 400));
        if (window.ipcRenderer) {
          await window.ipcRenderer.invoke('disconnect-serial');
          await new Promise(r => setTimeout(r, 300));
        }
        const esptool = await import('esptool-js');
        const Transport = esptool.Transport;
        const ESPLoader = esptool.ESPLoader;
        
        transport = new Transport(port as any, true);
        if (!(transport as any).getInfo) (transport as any).getInfo = () => "WebSerial Port";
        
        const espLoader = new (ESPLoader as any)({
            transport: transport,
            baudrate: flashBaudRate,
            terminal: {
                clean: () => xtermRef.current?.clear(),
                writeLine: (text: string) => {
                    xtermRef.current?.writeln(text);
                    if(autoScroll) xtermRef.current?.scrollToBottom();
                },
                write: (text: string) => {
                    xtermRef.current?.write(text);
                    if(autoScroll) xtermRef.current?.scrollToBottom();
                },
            }
        });

        xtermRef.current?.writeln(t('dumper.terminal_syncing'));
        await espLoader.main();
        
        xtermRef.current?.writeln(`${t('dumper.terminal_reading_flash')} 0x${address.toString(16)} (${t('dumper.terminal_size')}: 0x${size.toString(16)})...`);
        
        const data = await espLoader.readFlash(
            address,
            size,
            (_packet: Uint8Array, written: number, total: number) => {
                const percent = Math.round((written / total) * 100);
                setProgress(percent);
            }
        );
        
        xtermRef.current?.writeln(`\x1b[32m${t('dumper.terminal_read_complete')}\x1b[0m`);
        
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
        
        await transport.setDTR(false);
        await transport.setRTS(true);
        await new Promise(r => setTimeout(r, 100));
        await transport.setRTS(false);
        
        setStatus('success');
        
    } catch (e: any) {
        console.error('Dump Error:', e);
        const msg = (e.message || e).toString();
        const hint = msg.toLowerCase().includes('open') || msg.includes('failed')
          ? `\n${t('dumper.terminal_error_port_in_use')}`
          : '';
        xtermRef.current?.writeln(`\x1b[31m${t('dumper.terminal_dump_error')}: ${msg}${hint}\x1b[0m`);
        setStatus('error');
    } finally {
        try {
          if (transport && typeof transport.disconnect === 'function') await transport.disconnect();
          else await (port as any)?.close?.();
        } catch (_) {}
        operationInProgressRef.current = false;
    }
  };

  const clearConsole = () => xtermRef.current?.clear();
  const copyConsole = () => {
    xtermRef.current?.selectAll();
    const text = xtermRef.current?.getSelection();
    if (text) navigator.clipboard.writeText(text);
    xtermRef.current?.clearSelection();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white p-4 sm:p-6 gap-4 overflow-hidden">
      
      {/* Top Section: Panels */}
      <div className="flex flex-col lg:flex-row gap-4 flex-shrink-0">
        
        {/* Left Panel: Device Info */}
        <div className="flex-1 lg:flex-[0_0_380px] lg:max-w-[420px] min-w-0 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2 bg-slate-50/50 dark:bg-zinc-900/50">
            <Box size={16} className="text-indigo-500" />
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{t('dumper.section_info')}</span>
            <div className={`ml-auto w-2 h-2 rounded-full ${port ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-300 dark:bg-zinc-700'}`} />
          </div>
          
          <div className="p-4 flex flex-col gap-4">
            {/* Port Selection Row */}
            <div className="flex gap-2 relative" ref={portSelectRef}>
              <div className="relative flex-1 min-w-0">
                <button 
                  onClick={handleSelectDeviceClick}
                  className={`w-full h-9 px-3 rounded-lg text-sm border flex items-center justify-between transition-all
                    ${port 
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' 
                      : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 text-slate-600 dark:text-slate-300'
                    }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Usb size={14} className={port ? 'text-indigo-500' : 'text-slate-400'} />
                    <span className="truncate font-mono">
                      {selectedPortId 
                        ? formatPortPath(availablePorts.find(p => p.portId === selectedPortId)?.portName || '') 
                        : t('dumper.btn_select_device')}
                    </span>
                  </div>
                  <ChevronDown size={14} className="opacity-50 flex-shrink-0" />
                </button>

                {isSelectingPort && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 max-h-[240px] overflow-y-auto">
                    {availablePorts.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">{t('dumper.no_devices_found')}</div>
                    ) : (
                      availablePorts.map(p => (
                        <button
                          key={p.portId}
                          onClick={() => handlePortSelect(p.portId)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-zinc-700 border-b border-slate-100 dark:border-zinc-700/50 last:border-0 flex items-center gap-2"
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${p.vendorId === '12346' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-slate-700 dark:text-slate-200 truncate">{formatPortPath(p.portName)}</div>
                            <div className="text-slate-400 truncate text-[10px]">{p.displayName}</div>
                          </div>
                          {selectedPortId === p.portId && <Check size={12} className="text-indigo-500" />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => handleDetect()}
                disabled={!port || status === 'detecting' || status === 'dumping'}
                className="h-9 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:dark:bg-zinc-800 disabled:text-slate-400 text-white rounded-lg text-xs font-medium transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap"
              >
                {status === 'detecting' ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
                {t('dumper.btn_detect_info')}
              </button>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-[80px_1fr] gap-y-2 text-sm border-t border-slate-100 dark:border-zinc-800 pt-4">
              <div className="text-slate-500 dark:text-slate-500 self-center">{t('dumper.label_detected_chip')}</div>
              <div className="font-mono text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded border border-slate-100 dark:border-zinc-800 truncate">
                {detectedChip || '—'}
              </div>

              <div className="text-slate-500 dark:text-slate-500 self-center">{t('dumper.table_flash_id')}</div>
              <div className="font-mono text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded border border-slate-100 dark:border-zinc-800 truncate">
                {detectedFlashId || '—'}
              </div>

              <div className="text-slate-500 dark:text-slate-500 self-center">{t('dumper.table_size')}</div>
              <div className="font-mono text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded border border-slate-100 dark:border-zinc-800 truncate">
                {dumpSize ? `${dumpSize} (${hexToHumanSize(dumpSize)})` : '—'}
              </div>

              {detectedMac && (
                <>
                  <div className="text-slate-500 dark:text-slate-500 self-center">MAC</div>
                  <div className="font-mono text-slate-800 dark:text-slate-200 text-xs bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded border border-slate-100 dark:border-zinc-800 truncate">
                    {detectedMac}
                  </div>
                </>
              )}
              
              {detectedCrystalFreq != null && (
                <>
                  <div className="text-slate-500 dark:text-slate-500 self-center">{t('dumper.table_crystal')}</div>
                  <div className="font-mono text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded border border-slate-100 dark:border-zinc-800 truncate">
                    {detectedCrystalFreq} MHz
                  </div>
                </>
              )}
            </div>

            {/* Progress Bar */}
            {progress > 0 && (
              <div className="mt-1">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-500">{t('dumper.table_progress')}</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">{progress}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                </div>
                {dumpSpeedKbps != null && (
                  <div className="text-right text-[10px] text-slate-400 mt-1 font-mono">
                    {dumpSpeedKbps.toFixed(1)} kbit/s
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Parameters */}
        <div className="flex-1 min-w-0 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2 bg-slate-50/50 dark:bg-zinc-900/50">
            <Settings size={16} className="text-emerald-500" />
            <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{t('dumper.section_params')}</span>
          </div>

          <div className="p-4 grid grid-cols-[120px_1fr] gap-x-4 gap-y-4 items-center">
            {/* Address */}
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400 text-right">{t('dumper.label_start_address')}</label>
            <input 
              type="text" 
              value={dumpAddress} 
              onChange={e => setDumpAddress(e.target.value)}
              className="w-full h-9 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
              placeholder="0x000000"
            />

            {/* Size */}
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400 text-right">{t('dumper.label_size')}</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={dumpSize} 
                onChange={e => setDumpSize(e.target.value)}
                className="flex-1 min-w-0 h-9 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                placeholder="0x400000"
              />
              <select 
                onChange={e => setDumpSize(e.target.value)}
                className="h-9 w-24 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg px-2 text-xs text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                value={dumpSize}
              >
                <option value="0x400000">4MB</option>
                <option value="0x800000">8MB</option>
                <option value="0x1000000">16MB</option>
              </select>
            </div>
            <div className="col-start-2 text-xs text-slate-400 -mt-2 pl-1">
              {dumpSize ? hexToHumanSize(dumpSize) : '—'}
            </div>

            {/* Baud Rate */}
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400 text-right">{t('dumper.label_baud_rate')}</label>
            <select 
              value={flashBaudRate} 
              onChange={e => setFlashBaudRate(Number(e.target.value))}
              className="w-full h-9 bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            >
              <option value={115200}>115200 (Safe)</option>
              <option value={460800}>460800 (Fast)</option>
              <option value={921600}>921600 (Very Fast)</option>
              <option value={1500000}>1500000 (Max)</option>
            </select>

            {/* Action Button */}
            <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-zinc-800 mt-2 flex justify-end">
              <button 
                onClick={handleDump}
                disabled={!port || status === 'dumping'}
                className={`h-10 px-6 rounded-lg font-semibold text-sm shadow-sm transition-all flex items-center gap-2
                  ${(!port || status === 'dumping') 
                      ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 border border-slate-200 dark:border-zinc-700 cursor-not-allowed' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20 shadow-lg'
                  }`}
              >
                {status === 'dumping' ? (
                    <RefreshCw size={18} className="animate-spin" />
                ) : (
                    <Download size={18} />
                )}
                {t('dumper.btn_dump_firmware')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Console */}
      <div className="flex-1 min-h-[200px] bg-black rounded-xl border border-slate-300 dark:border-zinc-700 overflow-hidden shadow-sm flex flex-col relative">
        {/* Console Toolbar */}
        <div className="h-8 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-3">
          <div className="text-xs text-zinc-500 font-mono flex items-center gap-2">
            <Activity size={12} />
            <span>CONSOLE Output</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
                onClick={() => setAutoScroll(!autoScroll)}
                className={`p-1 rounded hover:bg-zinc-800 transition-colors ${autoScroll ? 'text-emerald-500' : 'text-zinc-500'}`}
                title="Auto Scroll"
            >
                <ArrowDownCircle size={14} />
            </button>
            <button 
                onClick={copyConsole}
                className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                title="Copy All"
            >
                <Copy size={14} />
            </button>
            <button 
                onClick={clearConsole}
                className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                title="Clear Console"
            >
                <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 relative">
            <div ref={terminalRef} className="absolute inset-0" />
        </div>
      </div>
    </div>
  );
};

export default FirmwareDumper;
