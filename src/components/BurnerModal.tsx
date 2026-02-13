import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { ChevronDown, Usb, Cpu, Check, X, Zap } from 'lucide-react';
// import SparkMD5 from 'spark-md5';

interface DownloadedFile {
    url: string;
    path: string;
    md5: string;
    sha256: string;
    fileName: string;
}

interface BurnerModalProps {
    file: DownloadedFile;
    onClose: () => void;
}

interface ElectronSerialPortInfo {
    portId: string;
    portName: string;
    displayName?: string;
    vendorId?: string;
    productId?: string;
    manufacturer?: string;
}

const BurnerModal: React.FC<BurnerModalProps> = ({ file, onClose }) => {
    const { t: _t } = useTranslation();
    const [toolStrategy, setToolStrategy] = useState<'native' | 'js'>('native');
    const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
    const [availablePorts, setAvailablePorts] = useState<ElectronSerialPortInfo[]>([]);
    const [isSelectingPort, setIsSelectingPort] = useState(false);
    const [status, setStatus] = useState<'idle' | 'flashing' | 'success' | 'error'>('idle');
    const [_progress, setProgress] = useState(0);
    const [flashBaudRate, _setFlashBaudRate] = useState(921600);
    
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const portSelectRef = useRef<HTMLDivElement>(null);

    // Initialize Terminal
    useEffect(() => {
        if (terminalRef.current && !xtermRef.current) {
            const term = new Terminal({
                theme: {
                    background: '#0f172a',
                    foreground: '#f8fafc',
                    cursor: '#ffffff',
                },
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                fontSize: 12,
                convertEol: true,
                rows: 15,
            });
            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(terminalRef.current);
            fitAddon.fit();
            
            xtermRef.current = term;
            fitAddonRef.current = fitAddon;
            
            term.writeln(`Ready to flash: ${file.fileName}`);
        }
        
        // Handle resize
        const handleResize = () => fitAddonRef.current?.fit();
        window.addEventListener('resize', handleResize);
        
        // Listen for ports
        if (window.ipcRenderer) {
            window.ipcRenderer.on('serial-ports-available', (_event, ports: ElectronSerialPortInfo[]) => {
                setAvailablePorts(ports);
                setIsSelectingPort(true);
            });
            
            // Listen for flash logs
            const logHandler = (_event: any, msg: string) => {
                xtermRef.current?.write(msg);
            };
            window.ipcRenderer.on('flash-log', logHandler);
            
            return () => {
                window.removeEventListener('resize', handleResize);
                window.ipcRenderer.off('serial-ports-available');
                window.ipcRenderer.off('flash-log', logHandler);
            };
        }
        
        return () => window.removeEventListener('resize', handleResize);
    }, [file]);

    // Click outside handler for port selector
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (portSelectRef.current && !portSelectRef.current.contains(event.target as Node)) {
                setIsSelectingPort(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectDeviceClick = async () => {
        try {
            const filters = [
                { usbVendorId: 0x303A }, // Espressif
                { usbVendorId: 0x10C4 }, // Silicon Labs
                { usbVendorId: 0x1A86 }, // WCH
                { usbVendorId: 0x0403 }, // FTDI
            ];
            await (navigator as any).serial.requestPort({ filters });
            // Electron will trigger 'select-serial-port' and send back 'serial-ports-available'
        } catch (error) {
            console.error('Error selecting port:', error);
        }
    };

    const handlePortSelect = (portId: string) => {
        setSelectedPortId(portId);
        window.ipcRenderer.send('serial-port-selected', portId);
        setIsSelectingPort(false);
    };

    const formatId = (id?: string) => id ? `0x${parseInt(id).toString(16).toUpperCase().padStart(4, '0')}` : 'Unknown';

    const handleBurn = async () => {
        if (!selectedPortId) {
            xtermRef.current?.writeln('Error: Please select a device first.');
            return;
        }

        setStatus('flashing');
        setProgress(0);
        xtermRef.current?.writeln('Starting flash process...');

        if (toolStrategy === 'native') {
            const selectedPortInfo = availablePorts.find(p => p.portId === selectedPortId);
            if (!selectedPortInfo) {
                xtermRef.current?.writeln('Error: Could not determine native port path.');
                setStatus('error');
                return;
            }

            try {
                const success = await window.ipcRenderer.invoke(
                    'flash-firmware-native', 
                    selectedPortInfo.portName, 
                    flashBaudRate, 
                    file.path
                );
                
                if (success) {
                    setStatus('success');
                    xtermRef.current?.writeln('Flash Complete!');
                } else {
                    setStatus('error');
                    xtermRef.current?.writeln('Flash Failed.');
                }
            } catch (e: any) {
                setStatus('error');
                xtermRef.current?.writeln(`Error: ${e.message}`);
            }
        } else {
            // JS Strategy
            try {
                // For JS strategy with downloaded file, we need to read it first?
                // Or we can try to use the port directly if we have the file content.
                // Since file is on disk (temp), we can't easily read it in renderer without IPC.
                // But wait, we are in renderer.
                // Let's assume Native is preferred for downloaded files.
                // If user selects JS, we warn them or try to read via IPC?
                // For now, let's just support Native for downloaded files as per previous discussion.
                xtermRef.current?.writeln('Error: esptool-js strategy not yet supported for downloaded files. Please use Native.');
                setStatus('error');
            } catch (e: any) {
                setStatus('error');
                xtermRef.current?.writeln(`Error: ${e.message}`);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-100 dark:bg-slate-900/50 rounded-t-xl">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                        <Zap className="mr-2 text-emerald-400" size={20} />
                        Flash Firmware
                    </h3>
                    <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* File Info */}
                    <div className="bg-slate-100 dark:bg-slate-700/30 p-3 rounded-lg border border-slate-200 dark:border-slate-600/50">
                        <div className="text-sm text-slate-700 dark:text-slate-300 font-medium mb-1">Target Firmware:</div>
                        <div className="text-xs font-mono text-slate-600 dark:text-slate-400 break-all">{file.fileName}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-1">SHA256: {file.sha256}</div>
                    </div>

                    {/* Settings Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Port Selection */}
                        <div className="relative" ref={portSelectRef}>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Device Port</label>
                            <button 
                                onClick={handleSelectDeviceClick}
                                disabled={status === 'flashing'}
                                className={`w-full px-3 py-2 rounded-lg font-medium transition-colors flex items-center justify-between border text-sm
                                    ${selectedPortId 
                                        ? 'bg-slate-700 text-white border-slate-500' 
                                        : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
                                    } ${status === 'flashing' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <span className="truncate">
                                    {selectedPortId 
                                        ? (availablePorts.find(p => p.portId === selectedPortId)?.displayName || 'Selected Port')
                                        : 'Select Device...'}
                                </span>
                                <ChevronDown size={16} />
                            </button>

                            {/* Dropdown */}
                            {isSelectingPort && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                    {availablePorts.length === 0 ? (
                                        <div className="p-3 text-center text-xs text-slate-500">No devices found</div>
                                    ) : (
                                        availablePorts.map(p => (
                                            <button
                                                key={p.portId}
                                                onClick={() => handlePortSelect(p.portId)}
                                                className="w-full text-left p-2 hover:bg-slate-700 border-b border-slate-700/50 last:border-0 flex items-center gap-2"
                                            >
                                                <div className={`p-1 rounded ${p.vendorId === '12346' ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'}`}>
                                                    {p.vendorId === '12346' ? <Cpu size={14} /> : <Usb size={14} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-slate-200 truncate">{p.displayName || p.portName}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono">
                                                        {(p.vendorId || p.productId) && `${formatId(p.vendorId)}:${formatId(p.productId)}`}
                                                    </div>
                                                </div>
                                                {selectedPortId === p.portId && <Check size={14} className="text-blue-400" />}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Tool Strategy */}
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Tool Strategy</label>
                            <select 
                                value={toolStrategy}
                                onChange={(e) => setToolStrategy(e.target.value as 'native' | 'js')}
                                disabled={status === 'flashing'}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="native">esptool (Native) - Recommended</option>
                                <option value="js">esptool-js (Web)</option>
                            </select>
                        </div>
                    </div>

                    {/* Terminal */}
                    <div className="bg-black rounded-lg border border-slate-700 overflow-hidden h-48 relative">
                        <div ref={terminalRef} className="absolute inset-0 p-2" />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 bg-slate-900/50 rounded-b-xl flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        disabled={status === 'flashing'}
                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleBurn}
                        disabled={!selectedPortId || status === 'flashing'}
                        className={`px-6 py-2 rounded-lg font-bold text-sm shadow-lg transition-all flex items-center
                            ${(!selectedPortId || status === 'flashing')
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/25'
                            }`}
                    >
                        <Zap size={18} className="mr-2" />
                        {status === 'flashing' ? 'Flashing...' : 'Start Flash'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BurnerModal;
