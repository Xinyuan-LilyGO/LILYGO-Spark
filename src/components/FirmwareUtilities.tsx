import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, FileCode, AlertCircle, Cpu, Upload, Download, Plus, Trash2, Terminal, Activity, RefreshCw, Power, PowerOff, Image as ImageIcon, Calculator, Clock, Zap, Lightbulb } from 'lucide-react';
import SmdResistorCalc from './SmdResistorCalc';
import LedResistorCalc from './LedResistorCalc';

// Type definitions
interface AnalysisResult {
    chip?: string;
    flash_size_raw?: number;
    flash_mode?: string;
    flash_freq?: string;
    partitions?: Array<{
        label: string;
        type: number;
        subtype: number;
        offset: string;
        size: string;
        size_dec: number;
        encrypted: boolean;
    }>;
    bootloader_flash_size?: string;
    is_full_image?: boolean;
    error?: string;
    header_error?: string;
    chip_guess?: string;
    partition_table_offset?: string;
}

type UtilityTool = 'analyzer' | 'editor' | 'monitor' | 'converter' | 'regulator' | 'rc_calc' | 'smd_resistor' | 'led_resistor';
type UtilitiesMode = 'full' | 'serial' | 'offline' | 'analyzer' | 'editor' | 'converter' | 'regulator' | 'rc_calc' | 'smd_resistor' | 'led_resistor';

interface FirmwareUtilitiesProps {
  mode?: UtilitiesMode;
}

const FirmwareUtilities: React.FC<FirmwareUtilitiesProps> = ({ mode = 'full' }) => {
  const { t } = useTranslation();
  const defaultTool: UtilityTool =
    mode === 'serial' ? 'monitor'
    : mode === 'offline' || mode === 'converter' ? 'converter'
    : mode === 'regulator' ? 'regulator'
    : mode === 'rc_calc' ? 'rc_calc'
    : mode === 'smd_resistor' ? 'smd_resistor'
    : mode === 'led_resistor' ? 'led_resistor'
    : mode === 'analyzer' ? 'analyzer'
    : mode === 'editor' ? 'editor'
    : 'analyzer';
  const [activeTool, setActiveTool] = useState<UtilityTool>(defaultTool);

  const visibleTabs: UtilityTool[] =
    mode === 'serial' ? ['monitor']
    : mode === 'offline' ? ['converter', 'regulator', 'rc_calc', 'smd_resistor', 'led_resistor']
    : mode === 'converter' ? ['converter']
    : mode === 'regulator' ? ['regulator']
    : mode === 'rc_calc' ? ['rc_calc']
    : mode === 'smd_resistor' ? ['smd_resistor']
    : mode === 'led_resistor' ? ['led_resistor']
    : mode === 'analyzer' ? ['analyzer']
    : mode === 'editor' ? ['editor']
    : ['analyzer', 'editor', 'monitor', 'converter', 'regulator', 'rc_calc', 'smd_resistor', 'led_resistor'];
  
  // RC Time Constant State (τ = R×C, fc = 1/(2πRC))
  const [rcR, setRcR] = useState(10);
  const [rcROhm, setRcROhm] = useState<'ohm' | 'kohm' | 'Mohm'>('kohm');
  const [rcC, setRcC] = useState(0.1);
  const [rcCF, setRcCF] = useState<'pF' | 'nF' | 'uF' | 'mF' | 'F'>('uF');

  // Regulator State (voltage divider: Vout = Vref * (1 + R2/R1))
  const [regulatorVref, setRegulatorVref] = useState(1.25);
  const [regulatorVout, setRegulatorVout] = useState(3.3);
  const [regulatorR1, setRegulatorR1] = useState(240);

  // Converter State
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [convertPreview, setConvertPreview] = useState<string | null>(null);
  const [convertFormat, setConvertFormat] = useState<'rgb565' | 'gray' | 'mono'>('rgb565');
  const [convertCode, setConvertCode] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);

  // Analyzer State
  const [analysisFile, setAnalysisFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Editor State
  const [partitions, setPartitions] = useState<any[]>([]); // Placeholder for partitions
  
  // Monitor State
  const [monitorPorts, setMonitorPorts] = useState<any[]>([]);
  const [selectedMonitorPort, setSelectedMonitorPort] = useState<string>('');
  const [monitorBaudRate, setMonitorBaudRate] = useState<number>(115200);
  const [isMonitorConnected, setIsMonitorConnected] = useState(false);
  const [monitorLogs, setMonitorLogs] = useState<string[]>([]);
  const [monitorWarnings, setMonitorWarnings] = useState<Set<string>>(new Set());
  const monitorLogsEndRef = useRef<HTMLDivElement>(null);
  const [autoScrollMonitor, setAutoScrollMonitor] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          setAnalysisFile(file);
          setAnalysisResult(null);
          setLogs([]);
          handleAnalyze(file);
      }
  };

  const handleConvertFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          setConvertFile(file);
          const url = URL.createObjectURL(file);
          setConvertPreview(url);
          setConvertCode('');
      }
  };

  const processImage = async () => {
      if (!convertFile || !convertPreview) return;
      setIsConverting(true);
      
      try {
          const img = new Image();
          img.src = convertPreview;
          await new Promise((resolve) => { img.onload = resolve; });
          
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context failed');
          
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          let output: number[] = [];
          
          if (convertFormat === 'rgb565') {
              for (let i = 0; i < data.length; i += 4) {
                  const r = data[i];
                  const g = data[i + 1];
                  const b = data[i + 2];
                  // RGB565: RRRRRGGG GGGBBBBB
                  const rgb = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
                  output.push((rgb >> 8) & 0xFF);
                  output.push(rgb & 0xFF);
              }
          } else if (convertFormat === 'gray') {
               for (let i = 0; i < data.length; i += 4) {
                  const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                  output.push(Math.floor(avg));
              }
          }
          
          // Generate C Array
          const varName = convertFile.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
          let cCode = `// Generated by LILYGO Spark\n`;
          cCode += `// Size: ${canvas.width}x${canvas.height}, Format: ${convertFormat.toUpperCase()}\n`;
          cCode += `const uint8_t ${varName}[] = {\n`;
          
          for (let i = 0; i < output.length; i++) {
              if (i % 12 === 0) cCode += '    ';
              cCode += `0x${output[i].toString(16).padStart(2, '0').toUpperCase()}`;
              if (i < output.length - 1) cCode += ', ';
              if ((i + 1) % 12 === 0) cCode += '\n';
          }
          cCode += '\n};\n';
          
          setConvertCode(cCode);
      } catch (e) {
          console.error(e);
          alert('Conversion failed');
      } finally {
          setIsConverting(false);
      }
  };

  useEffect(() => {
    // Listen for logs
    const handleLog = (_event: any, msg: string) => {
        setLogs(prev => [...prev, msg]);
    };

    // @ts-ignore
    if (window.ipcRenderer) {
        // @ts-ignore
        window.ipcRenderer.on('analysis-log', handleLog);
    }

    return () => {
        // @ts-ignore
        if (window.ipcRenderer) {
            // @ts-ignore
            window.ipcRenderer.off('analysis-log', handleLog);
        }
    };
  }, []);

  useEffect(() => {
      // Auto-scroll logs
      if (logsEndRef.current) {
          logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [logs]);

  // Monitor Effects & Logic
  useEffect(() => {
      // @ts-ignore
      const handleSerialData = (_event, data) => {
          setMonitorLogs(prev => {
              // Limit log size to prevent memory issues
              const newLogs = [...prev, data];
              return newLogs.length > 2000 ? newLogs.slice(-2000) : newLogs;
          });
          
          // Simple Heuristic Analysis
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
                  // Only flag if it seems repetitive? For now flag WDT.
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
      if (activeTool === 'monitor') {
          refreshPorts();
      }
  }, [activeTool]);

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

  const handleAnalyze = async (fileToAnalyze: File | null = analysisFile) => {
      if (!fileToAnalyze) return;
      setIsAnalyzing(true);
      setAnalysisResult(null);
      try {
          // @ts-ignore
          const result = await window.ipcRenderer.invoke('analyze-firmware', fileToAnalyze.path);
          setAnalysisResult(result);
          
          // Auto-populate editor if partitions found
          if (result.partitions) {
              setPartitions(result.partitions);
          }
      } catch (e: any) {
          console.error(e);
          setAnalysisResult({ error: e.message || String(e) });
      } finally {
          setIsAnalyzing(false);
      }
  };

  const tabButtons: { id: UtilityTool; icon: typeof Search; label: string }[] = [
    { id: 'analyzer', icon: Search, label: t('utilities.analyzer') },
    { id: 'monitor', icon: Activity, label: 'Serial Monitor' },
    { id: 'editor', icon: FileCode, label: t('utilities.partition_editor') },
    { id: 'converter', icon: ImageIcon, label: t('utilities.image_converter') },
    { id: 'regulator', icon: Calculator, label: t('utilities.regulator_resistor') },
    { id: 'rc_calc', icon: Clock, label: t('utilities.rc_time_constant') },
    { id: 'smd_resistor', icon: Zap, label: t('utilities.smd_resistor') },
    { id: 'led_resistor', icon: Lightbulb, label: t('utilities.led_resistor') },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-6 gap-6 transition-colors">
      {/* Tool Switcher - only when multiple tabs visible */}
      {visibleTabs.length > 1 && (
        <div className="flex space-x-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl self-start border border-slate-300 dark:border-slate-700">
          {tabButtons
            .filter((tb) => visibleTabs.includes(tb.id))
            .map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTool(id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center ${
                  activeTool === id
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50'
                }`}
              >
                <Icon size={16} className="mr-2" />
                {label}
              </button>
            ))}
        </div>
      )}

      {activeTool === 'converter' && (
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg flex-1 flex flex-col min-h-0">
                <div className="flex gap-6 h-full">
                    {/* Left: Input & Preview */}
                    <div className="w-1/3 flex flex-col gap-4">
                        <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700 flex-1 flex flex-col items-center justify-center relative overflow-hidden">
                            {convertPreview ? (
                                <img src={convertPreview} alt="Preview" className="max-w-full max-h-full object-contain" />
                            ) : (
                                <div className="text-slate-500 flex flex-col items-center">
                                    <ImageIcon size={48} className="mb-2 opacity-50" />
                                    <span>No Image Selected</span>
                                </div>
                            )}
                            <input 
                                type="file" 
                                onChange={handleConvertFileSelect} 
                                className="absolute inset-0 opacity-0 cursor-pointer" 
                                accept="image/*"
                            />
                        </div>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Output Format</label>
                                <select 
                                    value={convertFormat}
                                    onChange={(e) => setConvertFormat(e.target.value as any)}
                                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg p-2 text-sm"
                                >
                                    <option value="rgb565">RGB565 (16-bit Color)</option>
                                    <option value="gray">Grayscale (8-bit)</option>
                                </select>
                            </div>
                            <button 
                                onClick={processImage}
                                disabled={!convertFile || isConverting}
                                className="w-full py-2 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                {isConverting ? 'Converting...' : 'Generate Code'}
                            </button>
                        </div>
                    </div>

                    {/* Right: Output Code */}
                    <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Generated C Code</h3>
                            <button 
                                onClick={() => navigator.clipboard.writeText(convertCode)}
                                disabled={!convertCode}
                                className="text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white px-3 py-1 rounded transition-colors"
                            >
                                Copy
                            </button>
                        </div>
                        <textarea 
                            value={convertCode}
                            readOnly
                            className="flex-1 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 font-mono text-xs text-emerald-600 dark:text-green-400 resize-none focus:outline-none"
                            placeholder="// Code will appear here..."
                        />
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeTool === 'regulator' && (
        <div className="flex-1 flex flex-col gap-6 overflow-auto">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg max-w-2xl">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Calculator size={20} />
              {t('utilities.regulator_resistor')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {t('utilities.regulator_desc')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('utilities.regulator_vref')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={regulatorVref}
                  onChange={(e) => setRegulatorVref(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('utilities.regulator_vout')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={regulatorVout}
                  onChange={(e) => setRegulatorVout(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('utilities.regulator_r1')}</label>
                <input
                  type="number"
                  value={regulatorR1}
                  onChange={(e) => setRegulatorR1(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('utilities.regulator_r2')}</label>
                <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-primary">
                  {regulatorVref > 0 && regulatorR1 > 0 && regulatorVout >= regulatorVref
                    ? (() => {
                        const r2 = regulatorR1 * (regulatorVout / regulatorVref - 1);
                        return r2 > 0 ? `${r2.toFixed(1)} Ω` : '—';
                      })()
                    : '—'}
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-900/50 rounded-lg text-xs text-slate-600 dark:text-slate-400 font-mono">
              Vout = Vref × (1 + R2/R1) → R2 = R1 × (Vout/Vref − 1)
            </div>
          </div>
        </div>
      )}

      {activeTool === 'smd_resistor' && <SmdResistorCalc />}

      {activeTool === 'led_resistor' && <LedResistorCalc />}

      {activeTool === 'rc_calc' && (
        <div className="flex-1 flex flex-col gap-6 overflow-auto">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg max-w-2xl">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Clock size={20} />
              {t('utilities.rc_time_constant')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {t('utilities.rc_desc')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('utilities.rc_r')}</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    value={rcR}
                    onChange={(e) => setRcR(parseFloat(e.target.value) || 0)}
                    className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
                  />
                  <select
                    value={rcROhm}
                    onChange={(e) => setRcROhm(e.target.value as any)}
                    className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm w-20"
                  >
                    <option value="ohm">Ω</option>
                    <option value="kohm">kΩ</option>
                    <option value="Mohm">MΩ</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('utilities.rc_c')}</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    value={rcC}
                    onChange={(e) => setRcC(parseFloat(e.target.value) || 0)}
                    className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
                  />
                  <select
                    value={rcCF}
                    onChange={(e) => setRcCF(e.target.value as any)}
                    className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm w-20"
                  >
                    <option value="pF">pF</option>
                    <option value="nF">nF</option>
                    <option value="uF">µF</option>
                    <option value="mF">mF</option>
                    <option value="F">F</option>
                  </select>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">τ (tau)</label>
                <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-primary">
                  {(() => {
                    const rMult = rcROhm === 'ohm' ? 1 : rcROhm === 'kohm' ? 1e3 : 1e6;
                    const cMult = rcCF === 'pF' ? 1e-12 : rcCF === 'nF' ? 1e-9 : rcCF === 'uF' ? 1e-6 : rcCF === 'mF' ? 1e-3 : 1;
                    const tauSec = rcR * rMult * rcC * cMult;
                    if (tauSec >= 1) return `${tauSec.toFixed(4)} s`;
                    if (tauSec >= 1e-3) return `${(tauSec * 1e3).toFixed(4)} ms`;
                    if (tauSec >= 1e-6) return `${(tauSec * 1e6).toFixed(4)} µs`;
                    return `${(tauSec * 1e9).toFixed(4)} ns`;
                  })()}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">fc (-3dB)</label>
                <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-primary">
                  {(() => {
                    const rMult = rcROhm === 'ohm' ? 1 : rcROhm === 'kohm' ? 1e3 : 1e6;
                    const cMult = rcCF === 'pF' ? 1e-12 : rcCF === 'nF' ? 1e-9 : rcCF === 'uF' ? 1e-6 : rcCF === 'mF' ? 1e-3 : 1;
                    const fc = 1 / (2 * Math.PI * rcR * rMult * rcC * cMult);
                    if (fc >= 1e6) return `${(fc / 1e6).toFixed(4)} MHz`;
                    if (fc >= 1e3) return `${(fc / 1e3).toFixed(4)} kHz`;
                    return `${fc.toFixed(4)} Hz`;
                  })()}
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-900/50 rounded-lg text-xs text-slate-600 dark:text-slate-400 font-mono">
              τ = R × C · fc = 1/(2πRC)
            </div>
          </div>
        </div>
      )}

      {activeTool === 'analyzer' && (
        <div className="flex-1 flex flex-col gap-6 overflow-auto">
            {/* Analysis Controls */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg">
                <div className="flex gap-4 items-center">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        className="hidden" 
                        accept=".bin"
                    />
                    <div className="flex-1">
                        <div 
                            onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                            className={`w-full bg-slate-100 dark:bg-slate-700 border border-dashed border-slate-300 dark:border-slate-500 rounded-xl p-6 text-center cursor-pointer transition-all group relative overflow-hidden
                                ${isAnalyzing ? 'opacity-75 cursor-wait' : 'hover:bg-slate-200 dark:hover:bg-slate-600/50 hover:border-slate-400 dark:hover:border-slate-400'}`}
                        >
                            {isAnalyzing && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 dark:bg-slate-800/50 backdrop-blur-sm z-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            )}
                            {analysisFile ? (
                                <div className="flex flex-col items-center">
                                    <FileCode size={32} className="text-primary mb-2" />
                                    <span className="font-mono text-slate-800 dark:text-slate-200">{analysisFile.name}</span>
                                    <span className="text-xs text-slate-500 mt-1">{(analysisFile.size / 1024 / 1024).toFixed(2)} MB</span>
                                    {!isAnalyzing && <span className="text-xs text-primary mt-2">Click to select another file</span>}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-slate-600 dark:text-slate-400">
                                    <FileCode size={32} className="mb-2 group-hover:text-primary transition-colors" />
                                    <span>{t('utilities.select_firmware')}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Analysis Results */}
            {analysisResult && (
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg flex-1 overflow-auto">
                    {analysisResult.error ? (
                        <div className="flex items-center text-red-400 p-4 bg-red-900/20 rounded-lg border border-red-900/50">
                            <AlertCircle size={24} className="mr-3" />
                            <div>
                                <h3 className="font-bold">{t('utilities.analysis_failed')}</h3>
                                <p className="text-sm opacity-80">{analysisResult.error}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Chip Info */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <h4 className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('utilities.detected_chip')}</h4>
                                    <div className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
                                        <Cpu size={20} className="mr-2 text-primary" />
                                        {analysisResult.chip || analysisResult.chip_guess || 'Unknown'}
                                    </div>
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <h4 className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('utilities.flash_info')}</h4>
                                    <div className="text-lg font-mono text-slate-800 dark:text-slate-200">
                                        {analysisResult.bootloader_flash_size && <span className="mr-2">{analysisResult.bootloader_flash_size} (Header)</span>}
                                        {analysisResult.flash_mode && <span className="bg-slate-300 dark:bg-slate-600 px-1.5 rounded text-xs ml-1">{analysisResult.flash_mode}</span>}
                                        {analysisResult.flash_freq && <span className="bg-slate-300 dark:bg-slate-600 px-1.5 rounded text-xs ml-1">{analysisResult.flash_freq}</span>}
                                    </div>
                                </div>
                                <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <h4 className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{t('utilities.image_type')}</h4>
                                    <div className="text-lg font-medium text-slate-800 dark:text-slate-200">
                                        {analysisResult.is_full_image ? t('utilities.full_image') : t('utilities.app_image')}
                                    </div>
                                </div>
                            </div>

                            {/* Partition Table */}
                            {analysisResult.partitions && analysisResult.partitions.length > 0 ? (
                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                                            {t('utilities.partition_table')}
                                            <span className="ml-3 text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                                                Offset: {analysisResult.partition_table_offset || 'Unknown'}
                                            </span>
                                        </h3>
                                        <button 
                                            onClick={() => {
                                                setPartitions(analysisResult.partitions || []);
                                                setActiveTool('editor');
                                            }}
                                            className="text-xs bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-primary px-3 py-1.5 rounded-lg transition-colors flex items-center"
                                        >
                                            <FileCode size={14} className="mr-1.5" /> Open in Editor
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase">
                                                    <th className="p-3">Name</th>
                                                    <th className="p-3">Type</th>
                                                    <th className="p-3">SubType</th>
                                                    <th className="p-3 font-mono">Offset</th>
                                                    <th className="p-3 font-mono">Size</th>
                                                    <th className="p-3">Encrypted</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm font-mono text-slate-700 dark:text-slate-300">
                                                {analysisResult.partitions.map((p, idx) => (
                                                    <tr key={idx} className="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700/30">
                                                        <td className="p-3 font-sans font-medium text-slate-900 dark:text-white">{p.label}</td>
                                                        <td className="p-3">{p.type}</td>
                                                        <td className="p-3">{p.subtype}</td>
                                                        <td className="p-3 text-primary/80">{p.offset}</td>
                                                        <td className="p-3 text-emerald-600 dark:text-green-300">{p.size} ({Math.round(p.size_dec/1024)}KB)</td>
                                                        <td className="p-3">{p.encrypted ? 'Yes' : '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center border border-dashed border-slate-700 rounded-xl text-slate-500">
                                    {t('utilities.no_partitions')}
                                </div>
                            )}
                            
                            {/* Raw JSON Debug & Analysis Logs (Collapsible) */}
                            <div className="mt-4 space-y-4">
                                {/* Analysis Logs (Default Open if Logs Exist) */}
                                {logs.length > 0 && (
                                    <details className="group" open>
                                        <summary className="cursor-pointer text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white select-none flex items-center bg-slate-200 dark:bg-slate-700/30 p-2 rounded-lg mb-2">
                                            <Terminal size={16} className="mr-2" />
                                            {t('utilities.analysis_log') || 'Analysis Log'}
                                        </summary>
                                        <div className="bg-black/80 rounded-lg p-4 font-mono text-xs overflow-auto border border-slate-700/50 select-text max-h-[300px]">
                                            {logs.map((log, i) => (
                                                <div key={i} className="whitespace-pre-wrap mb-1 text-slate-300 border-b border-slate-800/50 pb-1 last:border-0 last:pb-0">
                                                    {log}
                                                </div>
                                            ))}
                                            <div ref={logsEndRef} />
                                        </div>
                                    </details>
                                )}

                                {/* Raw JSON Data (Default Closed) */}
                                <details className="group">
                                    <summary className="cursor-pointer text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white select-none flex items-center bg-slate-200 dark:bg-slate-700/30 p-2 rounded-lg mb-2">
                                        <FileCode size={16} className="mr-2" />
                                        {t('utilities.raw_data')}
                                    </summary>
                                    <pre className="p-4 bg-black/50 rounded-lg text-xs text-green-400 overflow-auto max-h-60 border border-slate-800 select-text">
                                        {JSON.stringify(analysisResult, null, 2)}
                                    </pre>
                                </details>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      )}

      {activeTool === 'monitor' && (
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
      )}

      {activeTool === 'editor' && (
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            {/* Partition Table Editor (Placeholder / Basic UI) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center">
                        <FileCode className="mr-3 text-primary" />
                        Partition Table Editor
                    </h2>
                    <div className="flex space-x-2">
                        <button className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-sm flex items-center text-slate-700 dark:text-slate-200">
                            <Upload size={16} className="mr-2" /> Import CSV
                        </button>
                        <button className="px-3 py-2 bg-primary hover:bg-primary-hover rounded-lg text-sm flex items-center">
                            <Download size={16} className="mr-2" /> Export .bin
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-10">
                            <tr className="text-slate-500 dark:text-slate-400 text-xs uppercase">
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Name</th>
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Type</th>
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700">SubType</th>
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Offset</th>
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Size</th>
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700">Flags</th>
                                <th className="p-3 border-b border-slate-200 dark:border-slate-700 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50">
                            {partitions.length > 0 ? partitions.map((p, idx) => (
                                <tr key={idx} className="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700/30">
                                    <td className="p-2"><input type="text" defaultValue={p.label} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                                    <td className="p-2"><input type="text" defaultValue={p.type} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                                    <td className="p-2"><input type="text" defaultValue={p.subtype} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                                    <td className="p-2 text-primary/80"><input type="text" defaultValue={p.offset} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                                    <td className="p-2 text-emerald-600 dark:text-green-300"><input type="text" defaultValue={p.size} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                                    <td className="p-2"><input type="text" defaultValue={p.encrypted ? 'encrypted' : ''} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                                    <td className="p-2 text-center">
                                        <button className="text-slate-500 hover:text-red-400 transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                                        No partitions loaded. Analyze a firmware file or import a CSV.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                <div className="mt-4">
                    <button 
                        onClick={() => setPartitions([...partitions, { label: 'new_part', type: 'data', subtype: 'nvs', offset: '', size: '0x1000', encrypted: false }])}
                        className="w-full py-2 border border-dashed border-slate-400 dark:border-slate-600 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:border-slate-500 transition-all flex items-center justify-center"
                    >
                        <Plus size={16} className="mr-2" /> Add Partition
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default FirmwareUtilities;
