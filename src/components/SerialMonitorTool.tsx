import React, { useState, useRef, useEffect } from 'react';
import { Activity, RefreshCw, Power, PowerOff, Trash2, AlertCircle } from 'lucide-react';

const SerialMonitorTool: React.FC = () => {
  const [monitorPorts, setMonitorPorts] = useState<any[]>([]);
  const [selectedMonitorPort, setSelectedMonitorPort] = useState<string>('');
  const [monitorBaudRate, setMonitorBaudRate] = useState<number>(115200);
  const [isMonitorConnected, setIsMonitorConnected] = useState(false);
  const [monitorLogs, setMonitorLogs] = useState<string[]>([]);
  const [monitorWarnings, setMonitorWarnings] = useState<Set<string>>(new Set());
  const monitorLogsEndRef = useRef<HTMLDivElement>(null);
  const [autoScrollMonitor, setAutoScrollMonitor] = useState(true);

  useEffect(() => {
    // @ts-ignore
    const handleSerialData = (_event, data) => {
      setMonitorLogs(prev => {
        const newLogs = [...prev, data];
        return newLogs.length > 2000 ? newLogs.slice(-2000) : newLogs;
      });

      setMonitorWarnings(prev => {
        const newWarnings = new Set(prev);
        if (data.includes('PSRAM: not found') || data.includes('spiram: SPI RAM enabled but initialization failed')) {
          newWarnings.add('PSRAM Initialization Failed (Check if board has PSRAM or firmware config)');
        }
        if (data.includes('Brownout detector was triggered')) {
          newWarnings.add('Brownout Detected (Check USB cable & power supply)');
        }
        if (data.includes('Guru Meditation Error')) {
          newWarnings.add('Guru Meditation Error (Crash/Panic)');
        }
        if (data.includes('rst:0x') && (data.includes('Reason:SW_CPU_RESET') || data.includes('Reason:WDT'))) {
          if (data.includes('WDT')) newWarnings.add('Watchdog Timer Reset (Loop/Hang)');
        }
        if (data.includes('Flash Status: 0x0000') || data.includes('Invalid chip id')) {
          newWarnings.add('Flash/Chip Connection Failed (Check strapping pins or soldering)');
        }
        if (data.includes('invalid header: 0xffffffff')) {
          newWarnings.add('Blank/Corrupted Flash (Invalid Header)');
        }
        return newWarnings;
      });
    };

    // @ts-ignore
    const handleSerialError = (_event, err) => {
      setMonitorLogs(prev => [...prev, `\n[Error] ${err}\n`]);
    };

    // @ts-ignore
    const handleSerialClosed = () => {
      setMonitorLogs(prev => [...prev, `\n[Connection Closed]\n`]);
      setIsMonitorConnected(false);
    };

    // @ts-ignore
    if (window.ipcRenderer) {
      // @ts-ignore
      window.ipcRenderer.on('serial-data', handleSerialData);
      // @ts-ignore
      window.ipcRenderer.on('serial-error', handleSerialError);
      // @ts-ignore
      window.ipcRenderer.on('serial-closed', handleSerialClosed);
    }

    return () => {
      // @ts-ignore
      if (window.ipcRenderer) {
        // @ts-ignore
        window.ipcRenderer.off('serial-data', handleSerialData);
        // @ts-ignore
        window.ipcRenderer.off('serial-error', handleSerialError);
        // @ts-ignore
        window.ipcRenderer.off('serial-closed', handleSerialClosed);
      }
    };
  }, []);

  useEffect(() => {
    if (autoScrollMonitor && monitorLogsEndRef.current) {
      monitorLogsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [monitorLogs, autoScrollMonitor]);

  const refreshPorts = async () => {
    try {
      // @ts-ignore
      const ports = await window.ipcRenderer.invoke('list-ports');
      setMonitorPorts(ports);
      if (ports.length > 0 && !selectedMonitorPort) {
        setSelectedMonitorPort(ports[0].path);
      }
    } catch (e) {
      console.error('Failed to list ports', e);
    }
  };

  useEffect(() => {
    refreshPorts();
  }, []);

  const toggleMonitorConnection = async () => {
    if (isMonitorConnected) {
      try {
        // @ts-ignore
        await window.ipcRenderer.invoke('disconnect-serial');
        setIsMonitorConnected(false);
      } catch (e) {
        console.error(e);
      }
    } else {
      if (!selectedMonitorPort) return;
      try {
        setMonitorLogs([]);
        setMonitorWarnings(new Set());
        // @ts-ignore
        await window.ipcRenderer.invoke('connect-serial', selectedMonitorPort, Number(monitorBaudRate));
        setIsMonitorConnected(true);
      } catch (e: any) {
        alert(`Failed to connect: ${e.message || e}`);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-hidden">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg flex-1 flex flex-col min-h-0">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <select
              value={selectedMonitorPort}
              onChange={(e) => setSelectedMonitorPort(e.target.value)}
              disabled={isMonitorConnected}
              className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg p-2.5 min-w-[200px]"
            >
              <option value="">Select Port...</option>
              {monitorPorts.map((port: any) => (
                <option key={port.path} value={port.path}>
                  {port.path} {port.manufacturer ? `(${port.manufacturer})` : ''}
                </option>
              ))}
            </select>
            <button
              onClick={refreshPorts}
              disabled={isMonitorConnected}
              className="p-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-300 disabled:opacity-50 transition-colors"
              title="Refresh Ports"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          <select
            value={monitorBaudRate}
            onChange={(e) => setMonitorBaudRate(Number(e.target.value))}
            disabled={isMonitorConnected}
            className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-lg p-2.5 w-[120px]"
          >
            <option value={9600}>9600</option>
            <option value={115200}>115200</option>
            <option value={460800}>460800</option>
            <option value={921600}>921600</option>
            <option value={2000000}>2000000</option>
          </select>

          <button
            onClick={toggleMonitorConnection}
            disabled={!selectedMonitorPort}
            className={`px-4 py-2.5 rounded-lg text-sm font-bold flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isMonitorConnected
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isMonitorConnected ? (
              <><PowerOff size={18} className="mr-2" /> Disconnect</>
            ) : (
              <><Power size={18} className="mr-2" /> Connect</>
            )}
          </button>

          <button
            onClick={() => { setMonitorLogs([]); setMonitorWarnings(new Set()); }}
            className="p-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
            title="Clear Output"
          >
            <Trash2 size={18} />
          </button>

          <div className="flex-1 text-right">
            <label className="text-sm text-slate-500 dark:text-slate-400 flex items-center justify-end cursor-pointer hover:text-slate-900 dark:hover:text-white select-none">
              <input
                type="checkbox"
                checked={autoScrollMonitor}
                onChange={(e) => setAutoScrollMonitor(e.target.checked)}
                className="mr-2 accent-blue-500 w-4 h-4 cursor-pointer"
              />
              Auto-scroll
            </label>
          </div>
        </div>

        {monitorWarnings.size > 0 && (
          <div className="mb-4 bg-orange-900/20 border border-orange-500/30 rounded-lg p-3 animate-pulse">
            <h4 className="text-orange-400 text-xs font-bold uppercase mb-2 flex items-center">
              <AlertCircle size={14} className="mr-2" /> Detected Issues
            </h4>
            <ul className="text-sm text-orange-200 list-disc list-inside space-y-1">
              {Array.from(monitorWarnings).map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex-1 bg-black/90 rounded-lg border border-slate-700/50 p-4 font-mono text-xs overflow-auto select-text relative shadow-inner">
          {!isMonitorConnected && monitorLogs.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 pointer-events-none">
              <Activity size={48} className="mb-4 opacity-20" />
              <p>Select a serial port and click Connect to start monitoring.</p>
            </div>
          )}
          <div className="whitespace-pre-wrap break-all">
            {monitorLogs.map((line, i) => (
              <span key={i}>{line}</span>
            ))}
          </div>
          <div ref={monitorLogsEndRef} />
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="text"
            placeholder="Send command..."
            className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-4 py-2 text-sm font-mono focus:border-blue-500 outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isMonitorConnected) {
                const target = e.target as HTMLInputElement;
                // @ts-ignore
                window.ipcRenderer.invoke('write-serial', target.value + '\r\n');
                target.value = '';
              }
            }}
            disabled={!isMonitorConnected}
          />
          <button
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 disabled:opacity-50"
            onClick={() => {
              const input = document.querySelector('input[placeholder="Send command..."]') as HTMLInputElement;
              if (input && isMonitorConnected) {
                // @ts-ignore
                window.ipcRenderer.invoke('write-serial', input.value + '\r\n');
                input.value = '';
              }
            }}
            disabled={!isMonitorConnected}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default SerialMonitorTool;
