import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, Power, PowerOff, Trash2, AlertCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600, 2000000];

const SerialMonitorTool: React.FC = () => {
  const [ports, setPorts] = useState<any[]>([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [baudRate, setBaudRate] = useState(115200);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const [command, setCommand] = useState('');
  const [warningsCollapsed, setWarningsCollapsed] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleData = (_event: any, data: string) => {
      setLogs(prev => {
        const next = [...prev, data];
        return next.length > 5000 ? next.slice(-5000) : next;
      });

      setWarnings(prev => {
        const next = new Set(prev);
        if (data.includes('PSRAM: not found') || data.includes('spiram: SPI RAM enabled but initialization failed')) {
          next.add('PSRAM Initialization Failed');
        }
        if (data.includes('Brownout detector was triggered')) {
          next.add('Brownout Detected (Check USB cable & power)');
        }
        if (data.includes('Guru Meditation Error')) {
          next.add('Guru Meditation Error (Crash/Panic)');
        }
        if (data.includes('rst:0x') && data.includes('WDT')) {
          next.add('Watchdog Timer Reset');
        }
        if (data.includes('invalid header: 0xffffffff')) {
          next.add('Blank/Corrupted Flash');
        }
        return next;
      });
    };

    const handleError = (_event: any, err: string) => {
      setLogs(prev => [...prev, `\x1b[31m[Error] ${err}\x1b[0m\n`]);
    };

    const handleClosed = () => {
      setLogs(prev => [...prev, '\n[Connection Closed]\n']);
      setConnected(false);
    };

    if (window.ipcRenderer) {
      window.ipcRenderer.on('serial-data', handleData);
      window.ipcRenderer.on('serial-error', handleError);
      window.ipcRenderer.on('serial-closed', handleClosed);
    }

    return () => {
      if (window.ipcRenderer) {
        window.ipcRenderer.off('serial-data', handleData);
        window.ipcRenderer.off('serial-error', handleError);
        window.ipcRenderer.off('serial-closed', handleClosed);
      }
    };
  }, []);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const refreshPorts = useCallback(async () => {
    try {
      const result = await window.ipcRenderer.invoke('list-ports');
      setPorts(result);
      if (result.length > 0 && !selectedPort) {
        setSelectedPort(result[0].path);
      }
    } catch (e) {
      console.error('Failed to list ports', e);
    }
  }, [selectedPort]);

  useEffect(() => { refreshPorts(); }, []);

  const toggleConnection = useCallback(async () => {
    if (connected) {
      try {
        await window.ipcRenderer.invoke('disconnect-serial');
        setConnected(false);
      } catch (e) {
        console.error(e);
      }
    } else {
      if (!selectedPort) return;
      try {
        setLogs([]);
        setWarnings(new Set());
        await window.ipcRenderer.invoke('connect-serial', selectedPort, baudRate);
        setConnected(true);
        inputRef.current?.focus();
      } catch (e: any) {
        setLogs([`[Error] Failed to connect: ${e.message || e}\n`]);
      }
    }
  }, [connected, selectedPort, baudRate]);

  const sendCommand = useCallback(() => {
    if (!connected || !command.trim()) return;
    window.ipcRenderer.invoke('write-serial', command + '\r\n');
    setCommand('');
    inputRef.current?.focus();
  }, [connected, command]);

  const clearOutput = useCallback(() => {
    setLogs([]);
    setWarnings(new Set());
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 p-3 gap-2">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <select
          value={selectedPort}
          onChange={(e) => setSelectedPort(e.target.value)}
          disabled={connected}
          className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-sm rounded-lg px-2.5 py-2 min-w-[180px] disabled:opacity-60"
        >
          <option value="">Select Port...</option>
          {ports.map((p: any) => (
            <option key={p.path} value={p.path}>
              {p.path}{p.manufacturer ? ` (${p.manufacturer})` : ''}
            </option>
          ))}
        </select>

        <button
          onClick={refreshPorts}
          disabled={connected}
          className="p-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors"
          title="Refresh Ports"
        >
          <RefreshCw size={16} />
        </button>

        <select
          value={baudRate}
          onChange={(e) => setBaudRate(Number(e.target.value))}
          disabled={connected}
          className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white text-sm rounded-lg px-2.5 py-2 w-[110px] disabled:opacity-60"
        >
          {BAUD_RATES.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <button
          onClick={toggleConnection}
          disabled={!selectedPort}
          className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            connected
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {connected ? <><PowerOff size={15} /> Disconnect</> : <><Power size={15} /> Connect</>}
        </button>

        <button
          onClick={clearOutput}
          className="p-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
          title="Clear Output"
        >
          <Trash2 size={16} />
        </button>

        <div className="flex-1" />

        <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="mr-1.5 accent-primary w-3.5 h-3.5 cursor-pointer"
          />
          Auto-scroll
        </label>
      </div>

      {/* ── Warnings (collapsible) ── */}
      {warnings.size > 0 && (
        <div className="shrink-0 bg-orange-500/10 dark:bg-orange-900/20 border border-orange-500/30 rounded-lg overflow-hidden">
          <button
            onClick={() => setWarningsCollapsed(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-orange-500 dark:text-orange-400 text-xs font-semibold uppercase hover:bg-orange-500/10 transition-colors"
          >
            <AlertCircle size={13} />
            Detected Issues ({warnings.size})
            {warningsCollapsed ? <ChevronDown size={13} className="ml-auto" /> : <ChevronUp size={13} className="ml-auto" />}
          </button>
          {!warningsCollapsed && (
            <ul className="px-3 pb-2 text-xs text-orange-300 dark:text-orange-300/80 list-disc list-inside space-y-0.5">
              {Array.from(warnings).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* ── Terminal Output ── */}
      <div
        ref={logsContainerRef}
        className="flex-1 min-h-0 bg-[#0d1117] rounded-lg border border-slate-700/50 font-mono text-[13px] leading-[1.4] overflow-auto select-text relative shadow-inner"
      >
        {!connected && logs.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 pointer-events-none gap-3">
            <Activity size={40} className="opacity-20" />
            <p className="text-sm">Select a serial port and click Connect to start monitoring.</p>
          </div>
        ) : (
          <div className="p-3 whitespace-pre-wrap break-all text-green-400/90">
            {logs.map((line, i) => <span key={i}>{line}</span>)}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* ── Command Input ── */}
      <div className="flex gap-2 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') sendCommand(); }}
          placeholder={connected ? 'Send command...' : 'Connect first...'}
          disabled={!connected}
          className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm font-mono focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 placeholder:text-slate-400 dark:placeholder:text-slate-600"
        />
        <button
          onClick={sendCommand}
          disabled={!connected || !command.trim()}
          className="px-3 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          <Send size={14} /> Send
        </button>
      </div>
    </div>
  );
};

export default SerialMonitorTool;
