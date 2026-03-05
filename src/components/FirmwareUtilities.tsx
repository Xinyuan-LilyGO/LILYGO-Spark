import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, FileCode, AlertCircle, Cpu, Upload, Download, Plus, Trash2, Terminal, Activity, RefreshCw, Power, PowerOff, Image as ImageIcon, Calculator, Clock, Zap, Lightbulb, CircleDot, HardDrive } from 'lucide-react';
import { getPartitionTypeLabel, getPartitionSubtypeLabel } from '../utils/partitionTypes';
import { analyzeFirmwareBuffer, type FirmwareAnalysisResult } from '../utils/firmwareAnalyzer';
import SmdResistorCalc from './SmdResistorCalc';
import LedResistorCalc from './LedResistorCalc';
import ResistorColorCodeCalc from './ResistorColorCodeCalc';
import FullWindowDropZone from './FullWindowDropZone';

// Type definitions
interface AnalysisResult {
    chip?: string;
    chip_id?: number;
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
    file_type?: string;
    partition_table_offset?: string;
    entry_point?: string;
    segments?: number;
    extended_header?: {
        wp_pin: string;
        spi_pins: string;
        chip_id: number;
        min_rev: string;
        max_rev: string;
        append_digest: boolean;
    };
    app_desc?: {
        version: string;
        project_name: string;
        compile_time: string;
        compile_date: string;
        idf_version: string;
        elf_sha256: string;
        secure_version: number;
    };
    framework?: {
        name: string;
        version?: string;
        details?: string;
    };
    components?: {
        gcc_version?: string;
        arch?: string;
        newlib_version?: string;
        mbedtls_version?: string;
        lvgl_version?: string;
        mpy_platform?: string;
        mpy_board?: string;
        mpy_machine?: string;
        mpy_python_ver?: string;
        mpy_frozen_modules?: string[];
        has_wifi?: boolean;
        has_bluetooth?: boolean;
        has_nimble?: boolean;
        has_lvgl?: boolean;
        has_littlefs?: boolean;
        has_fatfs?: boolean;
        has_spiffs?: boolean;
        has_lora?: boolean;
        has_oled_ssd1306?: boolean;
        has_camera?: boolean;
        has_usb_host?: boolean;
        has_tinyusb?: boolean;
        tls_protocols?: string[];
        display_drivers?: string[];
        touch_drivers?: string[];
        camera_sensors?: string[];
        audio_codecs?: string[];
        imu_sensors?: string[];
        ai_features?: string[];
        protocols?: string[];
    };
}

type UtilityTool = 'analyzer' | 'editor' | 'monitor' | 'converter' | 'regulator' | 'rc_calc' | 'smd_resistor' | 'led_resistor' | 'resistor_color';
type UtilitiesMode = 'full' | 'serial' | 'offline' | 'analyzer' | 'editor' | 'converter' | 'regulator' | 'rc_calc' | 'smd_resistor' | 'led_resistor' | 'resistor_color';

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
    : mode === 'resistor_color' ? 'resistor_color'
    : mode === 'analyzer' ? 'analyzer'
    : mode === 'editor' ? 'editor'
    : 'analyzer';
  const [activeTool, setActiveTool] = useState<UtilityTool>(defaultTool);

  const visibleTabs: UtilityTool[] =
    mode === 'serial' ? ['monitor']
    : mode === 'offline' ? ['converter', 'regulator', 'rc_calc', 'smd_resistor', 'led_resistor', 'resistor_color']
    : mode === 'converter' ? ['converter']
    : mode === 'regulator' ? ['regulator']
    : mode === 'rc_calc' ? ['rc_calc']
    : mode === 'smd_resistor' ? ['smd_resistor']
    : mode === 'led_resistor' ? ['led_resistor']
    : mode === 'resistor_color' ? ['resistor_color']
    : mode === 'analyzer' ? ['analyzer']
    : mode === 'editor' ? ['editor']
    : ['analyzer', 'editor', 'monitor', 'converter', 'regulator', 'rc_calc', 'smd_resistor', 'led_resistor', 'resistor_color'];
  
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
  const [convertFormat, setConvertFormat] = useState<'rgb565' | 'gray'>('rgb565');
  const [convertByteOrder, setConvertByteOrder] = useState<'big' | 'little'>('big');
  const [convertCode, setConvertCode] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);

  // Analyzer State
  const [analysisFile, setAnalysisFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [analysisEngine, setAnalysisEngine] = useState<'js' | 'native'>('js');
  
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

  const handleConvertDrop = (files: FileList) => {
      const file = Array.from(files).find((f) => f.type.startsWith('image/'));
      if (file) {
          setConvertFile(file);
          setConvertPreview(URL.createObjectURL(file));
          setConvertCode('');
      }
  };

  const handleAnalyzerDrop = (files: FileList) => {
      const file = Array.from(files).find((f) => f.name.toLowerCase().endsWith('.bin'));
      if (file) {
          setAnalysisFile(file);
          setAnalysisResult(null);
          setLogs([]);
          handleAnalyze(file);
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
                  if (convertByteOrder === 'big') {
                      output.push((rgb >> 8) & 0xFF);
                      output.push(rgb & 0xFF);
                  } else {
                      output.push(rgb & 0xFF);
                      output.push((rgb >> 8) & 0xFF);
                  }
              }
          } else if (convertFormat === 'gray') {
               for (let i = 0; i < data.length; i += 4) {
                  // ITU-R BT.601 standard luminance
                  const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                  output.push(Math.round(y));
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

  const handleAnalyzeJS = async (fileToAnalyze: File) => {
      const timestamp = () => new Date().toLocaleTimeString();
      setLogs(prev => [...prev, `[${timestamp()}] Starting JS firmware analysis for: ${fileToAnalyze.name}`]);

      const arrayBuffer = await fileToAnalyze.arrayBuffer();
      setLogs(prev => [...prev, `[${timestamp()}] Read ${arrayBuffer.byteLength} bytes`]);

      const jsResult: FirmwareAnalysisResult = analyzeFirmwareBuffer(arrayBuffer);
      setLogs(prev => [...prev, `[${timestamp()}] Chip: ${jsResult.chip || jsResult.chip_guess || 'Unknown'}, Flash: ${jsResult.bootloader_flash_size || 'N/A'}`]);

      if (jsResult.partitions && jsResult.partitions.length > 0) {
          setLogs(prev => [...prev, `[${timestamp()}] Found ${jsResult.partitions!.length} partitions at ${jsResult.partition_table_offset}`]);
      }
      if (jsResult.app_desc) {
          const ad = jsResult.app_desc;
          setLogs(prev => [...prev, `[${timestamp()}] App: ${ad.project_name || '(unnamed)'} ${ad.version || ''} | IDF ${ad.idf_version} | Built ${ad.compile_date} ${ad.compile_time}`]);
      }
      if (jsResult.framework && jsResult.framework.name !== 'Unknown') {
          setLogs(prev => [...prev, `[${timestamp()}] Framework: ${jsResult.framework!.name}${jsResult.framework!.version ? ' ' + jsResult.framework!.version : ''}${jsResult.framework!.details ? ' — ' + jsResult.framework!.details : ''}`]);
      }
      if (jsResult.extended_header) {
          const eh = jsResult.extended_header;
          setLogs(prev => [...prev, `[${timestamp()}] Extended Header: chip_id=${eh.chip_id} wp=${eh.wp_pin} rev=${eh.min_rev}~${eh.max_rev} sha256=${eh.append_digest ? 'yes' : 'no'}`]);
      }

      setLogs(prev => [...prev, `[${timestamp()}] JS analysis completed.`]);
      return jsResult as AnalysisResult;
  };

  const handleAnalyzeNative = async (fileToAnalyze: File): Promise<AnalysisResult> => {
      // @ts-ignore
      let pathToAnalyze: string | undefined = (fileToAnalyze as any).path;

      if (!pathToAnalyze && window.electronUtils) {
          pathToAnalyze = window.electronUtils.getPathForFile(fileToAnalyze);
      }

      if (!pathToAnalyze && window.ipcRenderer) {
          const { canceled, filePath } = await window.ipcRenderer.invoke('show-open-firmware-for-analysis');
          if (canceled || !filePath) throw new Error('Cancelled');
          pathToAnalyze = filePath;
      }
      if (!pathToAnalyze) {
          throw new Error(t('utilities.analyzer_path_required'));
      }
      // @ts-ignore
      return await window.ipcRenderer.invoke('analyze-firmware', pathToAnalyze);
  };

  const handleAnalyze = async (fileToAnalyze: File | null = analysisFile) => {
      if (!fileToAnalyze) return;
      setIsAnalyzing(true);
      setAnalysisResult(null);
      setLogs([]);
      try {
          let result: AnalysisResult;
          if (analysisEngine === 'js') {
              result = await handleAnalyzeJS(fileToAnalyze);
          } else {
              result = await handleAnalyzeNative(fileToAnalyze);
          }
          setAnalysisResult(result);

          if (result.partitions) {
              setPartitions(result.partitions);
          }
      } catch (e: any) {
          console.error(e);
          if (e.message !== 'Cancelled') {
              setAnalysisResult({ error: e.message || String(e) });
          }
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
    { id: 'resistor_color', icon: CircleDot, label: t('utilities.resistor_color_code') },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-6 gap-6 transition-colors relative">
      <FullWindowDropZone
        active={activeTool === 'converter'}
        accept="image/*"
        onDrop={handleConvertDrop}
        hintKey="common.drop_image"
      />
      <FullWindowDropZone
        active={activeTool === 'analyzer'}
        accept=".bin"
        onDrop={handleAnalyzerDrop}
        hintKey="common.drop_firmware"
      />
      {/* Tool Switcher - only when multiple tabs visible */}
      {visibleTabs.length > 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 w-full max-w-4xl">
          {tabButtons
            .filter((tb) => visibleTabs.includes(tb.id))
            .map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTool(id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center sm:justify-start ${
                  activeTool === id
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50 border border-slate-300 dark:border-slate-700'
                }`}
              >
                <Icon size={16} className="mr-2 shrink-0" />
                <span className="truncate">{label}</span>
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
                            {convertFormat === 'rgb565' && (
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">{t('utilities.byte_order')}</label>
                                <select
                                    value={convertByteOrder}
                                    onChange={(e) => setConvertByteOrder(e.target.value as 'big' | 'little')}
                                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg p-2 text-sm"
                                >
                                    <option value="big">{t('utilities.byte_order_big')}</option>
                                    <option value="little">{t('utilities.byte_order_little')}</option>
                                </select>
                            </div>
                            )}
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
            <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-900/50 rounded-lg text-xs text-slate-600 dark:text-slate-400">
              <div className="font-mono">Vout = Vref × (1 + R2/R1) → R2 = R1 × (Vout/Vref − 1)</div>
              <div className="mt-1.5 text-slate-500 dark:text-slate-500">
                {t('utilities.regulator_iadj_note')}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTool === 'smd_resistor' && <SmdResistorCalc />}

      {activeTool === 'led_resistor' && <LedResistorCalc />}

      {activeTool === 'resistor_color' && <ResistorColorCodeCalc />}

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
                    const rVal = rcR * rMult;
                    const cVal = rcC * cMult;
                    if (rVal <= 0 || cVal <= 0) return '—';
                    const tauSec = rVal * cVal;
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
                    const rVal = rcR * rMult;
                    const cVal = rcC * cMult;
                    if (rVal <= 0 || cVal <= 0) return '—';
                    const fc = 1 / (2 * Math.PI * rVal * cVal);
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
        <div className="flex-1 flex flex-col gap-4 overflow-auto">
            {/* File picker + engine selector — compact bar when file is selected */}
            <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg transition-all duration-300 ease-in-out ${analysisFile && analysisResult ? 'p-3' : 'p-6'}`}>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".bin" />

                {analysisFile && analysisResult ? (
                    /* ── Compact bar after analysis ── */
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm transition-colors cursor-pointer"
                        >
                            <FileCode size={16} className="text-primary shrink-0" />
                            <span className="font-mono text-slate-800 dark:text-slate-200 truncate max-w-[260px]">{analysisFile.name}</span>
                            <span className="text-xs text-slate-500 whitespace-nowrap">{(analysisFile.size / 1024 / 1024).toFixed(2)} MB</span>
                        </button>
                        <div className="flex items-center gap-2 ml-auto">
                            <select
                                value={analysisEngine}
                                onChange={e => setAnalysisEngine(e.target.value as 'js' | 'native')}
                                className="bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                            >
                                <option value="js">JS ({t('utilities.engine_builtin')})</option>
                                <option value="native">esptool (Python)</option>
                            </select>
                        </div>
                    </div>
                ) : (
                    /* ── Full-size picker before analysis ── */
                    <>
                        <div className="flex gap-4 items-center mb-4">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">{t('utilities.analysis_engine')}</label>
                            <select
                                value={analysisEngine}
                                onChange={e => setAnalysisEngine(e.target.value as 'js' | 'native')}
                                className="bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                            >
                                <option value="js">JavaScript ({t('utilities.engine_builtin')})</option>
                                <option value="native">esptool (Native/Python)</option>
                            </select>
                            {analysisEngine === 'js' && (
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded">{t('utilities.engine_no_deps')}</span>
                            )}
                        </div>
                        <div
                            onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                            className={`w-full bg-slate-100 dark:bg-slate-700 border border-dashed border-slate-300 dark:border-slate-500 rounded-xl p-6 text-center cursor-pointer transition-all group relative overflow-hidden
                                ${isAnalyzing ? 'opacity-75 cursor-wait' : 'hover:bg-slate-200 dark:hover:bg-slate-600/50 hover:border-slate-400 dark:hover:border-slate-400'}`}
                        >
                            {isAnalyzing && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/90 dark:bg-slate-800/80 backdrop-blur-sm z-10 gap-3">
                                    <div className="relative h-10 w-10">
                                        <div className="absolute inset-0 rounded-full border-2 border-primary/20"></div>
                                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"></div>
                                    </div>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">{t('utilities.analyzing') || 'Analyzing...'}</span>
                                </div>
                            )}
                            <div className="flex flex-col items-center text-slate-600 dark:text-slate-400">
                                <FileCode size={32} className="mb-2 group-hover:text-primary transition-colors" />
                                <span>{t('utilities.select_firmware')}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Analysis Results */}
            {analysisResult && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg flex-1 overflow-auto">
                    {analysisResult.error ? (
                        analysisResult.file_type ? (
                            <div className="flex items-start p-4 bg-amber-500/10 dark:bg-amber-900/20 rounded-lg border border-amber-500/30 dark:border-amber-700/50">
                                <HardDrive size={24} className="mr-3 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-bold text-amber-600 dark:text-amber-400">{analysisResult.file_type}</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{analysisResult.error}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                                        {t('utilities.fs_hint') || 'This file is a data partition image used alongside firmware. It cannot be analyzed as a firmware binary.'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                        <div className="flex items-center text-red-400 p-4 bg-red-900/20 rounded-lg border border-red-900/50">
                            <AlertCircle size={24} className="mr-3" />
                            <div>
                                <h3 className="font-bold">{t('utilities.analysis_failed')}</h3>
                                <p className="text-sm opacity-80">{analysisResult.error}</p>
                            </div>
                        </div>
                        )
                    ) : (
                        <div>
                            {/* ── Masonry / Waterfall layout ── */}
                            {(() => {
                                const cardCls = "bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 break-inside-avoid mb-3";
                                const titleCls = "text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1.5";
                                const tagCls = "px-1.5 py-0.5 rounded text-[11px] font-mono leading-tight";
                                const kvCls = "flex text-xs font-mono";
                                const kCls = "text-slate-500 dark:text-slate-400 w-20 shrink-0";

                                return (
                                    <div className="columns-1 md:columns-2 gap-3">
                                        {/* ── Chip + Image Type ── */}
                                        <div className={cardCls}>
                                            <div className="flex gap-3">
                                                <div className="flex-1">
                                                    <h4 className={titleCls}>{t('utilities.detected_chip')}</h4>
                                                    <div className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                                                        <Cpu size={18} className="mr-1.5 text-primary shrink-0" />
                                                        {analysisResult.chip || analysisResult.chip_guess || 'Unknown'}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <h4 className={titleCls}>{t('utilities.image_type')}</h4>
                                                    <div className="text-lg font-medium text-slate-800 dark:text-slate-200">
                                                        {analysisResult.is_full_image ? t('utilities.full_image') : t('utilities.app_image')}
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Flash inline */}
                                            {analysisResult.bootloader_flash_size && (
                                                <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-slate-200 dark:border-slate-600/50">
                                                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{analysisResult.bootloader_flash_size}</span>
                                                    {analysisResult.flash_mode && <span className="bg-slate-300 dark:bg-slate-600 px-1.5 py-0.5 rounded text-xs font-mono">{analysisResult.flash_mode}</span>}
                                                    {analysisResult.flash_freq && <span className="bg-slate-300 dark:bg-slate-600 px-1.5 py-0.5 rounded text-xs font-mono">{analysisResult.flash_freq}</span>}
                                                </div>
                                            )}
                                        </div>

                                        {/* ── Framework ── */}
                                        {analysisResult.framework && analysisResult.framework.name !== 'Unknown' && (
                                            <div className={cardCls}>
                                                <h4 className={titleCls}>{t('utilities.framework')}</h4>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                        analysisResult.framework.name === 'Arduino' ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300' :
                                                        analysisResult.framework.name === 'MicroPython' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                                                        analysisResult.framework.name === 'ESP-IDF' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                                                        analysisResult.framework.name === 'Tasmota' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' :
                                                        analysisResult.framework.name === 'ESPHome' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                                                        'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                                                    }`}>{analysisResult.framework.name}</span>
                                                    {analysisResult.framework.version && <span className="text-xs font-mono text-slate-700 dark:text-slate-300">{analysisResult.framework.version}</span>}
                                                </div>
                                                {analysisResult.framework.details && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono truncate" title={analysisResult.framework.details}>{analysisResult.framework.details}</p>}
                                            </div>
                                        )}

                                        {/* ── Build Info ── */}
                                        {analysisResult.app_desc && (
                                            <div className={cardCls}>
                                                <h4 className={titleCls}>{t('utilities.build_info')}</h4>
                                                <div className="space-y-0.5">
                                                    {analysisResult.app_desc.project_name && <div className={kvCls}><span className={kCls}>Project</span><span className="text-primary font-bold">{analysisResult.app_desc.project_name}</span></div>}
                                                    {analysisResult.app_desc.version && <div className={kvCls}><span className={kCls}>Version</span><span className="text-slate-800 dark:text-slate-200">{analysisResult.app_desc.version}</span></div>}
                                                    <div className={kvCls}><span className={kCls}>IDF</span><span className="text-emerald-600 dark:text-emerald-400">{analysisResult.app_desc.idf_version}</span></div>
                                                    {analysisResult.app_desc.compile_date && <div className={kvCls}><span className={kCls}>Built</span><span className="text-slate-800 dark:text-slate-200">{analysisResult.app_desc.compile_date} {analysisResult.app_desc.compile_time}</span></div>}
                                                    {analysisResult.app_desc.elf_sha256 && analysisResult.app_desc.elf_sha256 !== '0'.repeat(64) && <div className={kvCls}><span className={kCls}>SHA256</span><span className="text-slate-600 dark:text-slate-400">{analysisResult.app_desc.elf_sha256.substring(0, 16)}...</span></div>}
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Extended Header ── */}
                                        {analysisResult.extended_header && (
                                            <div className={cardCls}>
                                                <h4 className={titleCls}>{t('utilities.ext_header')}</h4>
                                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs font-mono">
                                                    <div className={kvCls}><span className={kCls}>Chip ID</span><span className="text-primary">{analysisResult.extended_header.chip_id} (0x{analysisResult.extended_header.chip_id.toString(16).padStart(4, '0')})</span></div>
                                                    <div className={kvCls}><span className={kCls}>WP Pin</span><span className="text-slate-800 dark:text-slate-200">{analysisResult.extended_header.wp_pin}</span></div>
                                                    <div className={kvCls}><span className={kCls}>Rev</span><span className="text-slate-800 dark:text-slate-200">{analysisResult.extended_header.min_rev} ~ {analysisResult.extended_header.max_rev}</span></div>
                                                    <div className={kvCls}><span className={kCls}>SHA256</span><span className={analysisResult.extended_header.append_digest ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>{analysisResult.extended_header.append_digest ? 'Appended' : 'None'}</span></div>
                                                    <div className={kvCls}><span className={kCls}>SPI</span><span className="text-slate-800 dark:text-slate-200">{analysisResult.extended_header.spi_pins}</span></div>
                                                    {analysisResult.entry_point && <div className={kvCls}><span className={kCls}>Entry</span><span className="text-slate-800 dark:text-slate-200">{analysisResult.entry_point}</span></div>}
                                                    {analysisResult.segments !== undefined && <div className={kvCls}><span className={kCls}>Segments</span><span className="text-slate-800 dark:text-slate-200">{analysisResult.segments}</span></div>}
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Components ── */}
                                        {analysisResult.components && (() => {
                                            const c = analysisResult.components!;
                                            const rows: { label: string; tags: JSX.Element[] }[] = [];

                                            const toolchain: JSX.Element[] = [];
                                            if (c.arch) toolchain.push(<span key="arch" className={`${tagCls} bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold`}>{c.arch}</span>);
                                            if (c.gcc_version) toolchain.push(<span key="gcc" className={`${tagCls} bg-slate-200 dark:bg-slate-600`}>GCC {c.gcc_version}</span>);
                                            if (c.newlib_version) toolchain.push(<span key="nl" className={`${tagCls} bg-slate-200 dark:bg-slate-600`}>newlib {c.newlib_version}</span>);
                                            if (c.mbedtls_version) toolchain.push(<span key="tls" className={`${tagCls} bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300`}>Mbed TLS {c.mbedtls_version}</span>);
                                            c.tls_protocols?.forEach(p => toolchain.push(<span key={p} className={`${tagCls} bg-slate-200 dark:bg-slate-600`}>{p}</span>));
                                            if (toolchain.length > 0) rows.push({ label: 'Toolchain', tags: toolchain });

                                            const conn: JSX.Element[] = [];
                                            if (c.has_wifi) conn.push(<span key="wifi" className={`${tagCls} bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 font-bold`}>WiFi</span>);
                                            if (c.has_bluetooth) conn.push(<span key="bt" className={`${tagCls} bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold`}>Bluetooth</span>);
                                            if (c.has_nimble) conn.push(<span key="nimble" className={`${tagCls} bg-slate-200 dark:bg-slate-600`}>NimBLE</span>);
                                            if (c.has_lora) conn.push(<span key="lora" className={`${tagCls} bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-bold`}>LoRa</span>);
                                            if (conn.length > 0) rows.push({ label: 'Connect', tags: conn });

                                            const libs: JSX.Element[] = [];
                                            if (c.has_lvgl) libs.push(<span key="lvgl" className={`${tagCls} bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 font-bold`}>LVGL{c.lvgl_version ? ` v${c.lvgl_version}` : ''}</span>);
                                            if (c.has_camera) libs.push(<span key="cam" className={`${tagCls} bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 font-bold`}>Camera</span>);
                                            if (c.has_usb_host) libs.push(<span key="usbh" className={`${tagCls} bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300 font-bold`}>USB Host</span>);
                                            else if (c.has_tinyusb) libs.push(<span key="tusb" className={`${tagCls} bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300`}>TinyUSB</span>);
                                            if (c.has_littlefs) libs.push(<span key="lfs" className={`${tagCls} bg-slate-200 dark:bg-slate-600`}>LittleFS</span>);
                                            if (c.has_fatfs) libs.push(<span key="fat" className={`${tagCls} bg-slate-200 dark:bg-slate-600`}>FatFS</span>);
                                            if (c.has_spiffs) libs.push(<span key="spf" className={`${tagCls} bg-slate-200 dark:bg-slate-600`}>SPIFFS</span>);
                                            if (libs.length > 0) rows.push({ label: 'Features', tags: libs });

                                            const hw: JSX.Element[] = [];
                                            c.display_drivers?.forEach(d => hw.push(<span key={`d-${d}`} className={`${tagCls} bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300`}>{d}</span>));
                                            c.touch_drivers?.forEach(d => hw.push(<span key={`t-${d}`} className={`${tagCls} bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300`}>{d}</span>));
                                            c.camera_sensors?.forEach(d => hw.push(<span key={`c-${d}`} className={`${tagCls} bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300`}>{d}</span>));
                                            c.audio_codecs?.forEach(d => hw.push(<span key={`a-${d}`} className={`${tagCls} bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300`}>{d}</span>));
                                            c.imu_sensors?.forEach(d => hw.push(<span key={`i-${d}`} className={`${tagCls} bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300`}>{d}</span>));
                                            if (c.has_oled_ssd1306 && !c.display_drivers?.includes('SSD1306')) hw.push(<span key="oled" className={`${tagCls} bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300`}>SSD1306</span>);
                                            if (hw.length > 0) rows.push({ label: 'Peripherals', tags: hw });

                                            const extra: JSX.Element[] = [];
                                            c.ai_features?.forEach(d => extra.push(<span key={`ai-${d}`} className={`${tagCls} bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold`}>{d}</span>));
                                            c.protocols?.forEach(d => extra.push(<span key={`p-${d}`} className={`${tagCls} bg-slate-200 dark:bg-slate-600`}>{d}</span>));
                                            if (extra.length > 0) rows.push({ label: 'AI / Proto', tags: extra });

                                            const mpyInfo: JSX.Element[] = [];
                                            if (c.mpy_machine) mpyInfo.push(<span key="machine" className={`${tagCls} bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300`}>{c.mpy_machine}</span>);
                                            else if (c.mpy_board) mpyInfo.push(<span key="board" className={`${tagCls} bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300`}>{c.mpy_board}</span>);
                                            if (c.mpy_python_ver) mpyInfo.push(<span key="pyver" className={`${tagCls} bg-slate-200 dark:bg-slate-600`}>Python {c.mpy_python_ver}</span>);
                                            if (mpyInfo.length > 0) rows.push({ label: 'Board', tags: mpyInfo });

                                            if (rows.length === 0) return null;
                                            return (
                                                <div className={cardCls}>
                                                    <h4 className={titleCls}>{t('utilities.components')}</h4>
                                                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-start">
                                                        {rows.map(row => (
                                                            <React.Fragment key={row.label}>
                                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide pt-0.5 whitespace-nowrap">{row.label}</span>
                                                                <div className="flex flex-wrap gap-1">{row.tags}</div>
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                    {c.mpy_frozen_modules && c.mpy_frozen_modules.length > 0 && (
                                                        <details className="mt-2">
                                                            <summary className="cursor-pointer text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 select-none">Frozen Modules ({c.mpy_frozen_modules.length})</summary>
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {c.mpy_frozen_modules.map(m => (
                                                                    <span key={m} className="bg-slate-200 dark:bg-slate-600/60 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-700 dark:text-slate-300">{m.replace('.py', '')}</span>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* ── Partition Table ── */}
                                        {analysisResult.partitions && analysisResult.partitions.length > 0 && (
                                            <div className={`${cardCls} break-inside-avoid-column`}>
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <h4 className={titleCls + ' mb-0'}>
                                                        {t('utilities.partition_table')}
                                                        <span className="ml-2 text-[10px] font-normal bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded normal-case tracking-normal">
                                                            {analysisResult.partition_table_offset || '?'}
                                                        </span>
                                                    </h4>
                                                    <button onClick={() => { setPartitions(analysisResult.partitions || []); setActiveTool('editor'); }}
                                                        className="text-[10px] bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-800 dark:text-primary px-2 py-0.5 rounded transition-colors flex items-center">
                                                        <FileCode size={11} className="mr-1" /> Editor
                                                    </button>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-[10px] uppercase">
                                                                <th className="px-2 py-1">Name</th>
                                                                <th className="px-2 py-1">Type</th>
                                                                <th className="px-2 py-1 font-mono">Offset</th>
                                                                <th className="px-2 py-1 font-mono">Size</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="text-[11px] font-mono text-slate-700 dark:text-slate-300">
                                                            {analysisResult.partitions.map((p, idx) => (
                                                                <tr key={idx} className="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-200/50 dark:hover:bg-slate-600/30">
                                                                    <td className="px-2 py-1 font-sans font-medium text-slate-900 dark:text-white">{p.label}</td>
                                                                    <td className="px-2 py-1 text-slate-500 dark:text-slate-400">{getPartitionTypeLabel(p.type)}/{getPartitionSubtypeLabel(p.type, p.subtype)}</td>
                                                                    <td className="px-2 py-1 text-primary/80">{p.offset}</td>
                                                                    <td className="px-2 py-1 text-emerald-600 dark:text-green-300">{Math.round(p.size_dec/1024)}KB</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Logs ── */}
                                        {logs.length > 0 && (
                                            <div className={cardCls}>
                                                <details>
                                                    <summary className="cursor-pointer text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white select-none flex items-center">
                                                        <Terminal size={13} className="mr-1.5" />
                                                        {t('utilities.analysis_log') || 'Analysis Log'}
                                                    </summary>
                                                    <div className="mt-1.5 bg-black/80 rounded-lg p-2 font-mono text-[10px] overflow-auto border border-slate-700/50 select-text max-h-[160px]">
                                                        {logs.map((log, i) => <div key={i} className="whitespace-pre-wrap text-slate-300 mb-0.5">{log}</div>)}
                                                        <div ref={logsEndRef} />
                                                    </div>
                                                </details>
                                            </div>
                                        )}

                                        {/* ── Raw JSON ── */}
                                        <div className={cardCls}>
                                            <details>
                                                <summary className="cursor-pointer text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white select-none flex items-center">
                                                    <FileCode size={13} className="mr-1.5" />
                                                    {t('utilities.raw_data')}
                                                </summary>
                                                <pre className="mt-1.5 p-2 bg-black/50 rounded-lg text-[10px] text-green-400 overflow-auto max-h-40 border border-slate-800 select-text">
                                                    {JSON.stringify(analysisResult, null, 2)}
                                                </pre>
                                            </details>
                                        </div>
                                    </div>
                                );
                            })()}
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
                                    <td className="p-2"><input type="text" value={p.label} onChange={(e) => { const np = [...partitions]; np[idx] = { ...np[idx], label: e.target.value }; setPartitions(np); }} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                                    <td className="p-2"><input type="text" value={p.type} onChange={(e) => { const np = [...partitions]; np[idx] = { ...np[idx], type: e.target.value }; setPartitions(np); }} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                                    <td className="p-2"><input type="text" value={p.subtype} onChange={(e) => { const np = [...partitions]; np[idx] = { ...np[idx], subtype: e.target.value }; setPartitions(np); }} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                                    <td className="p-2 text-primary/80"><input type="text" value={p.offset} onChange={(e) => { const np = [...partitions]; np[idx] = { ...np[idx], offset: e.target.value }; setPartitions(np); }} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                                    <td className="p-2 text-emerald-600 dark:text-green-300"><input type="text" value={p.size} onChange={(e) => { const np = [...partitions]; np[idx] = { ...np[idx], size: e.target.value }; setPartitions(np); }} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                                    <td className="p-2"><input type="text" value={p.encrypted ? 'encrypted' : ''} onChange={(e) => { const np = [...partitions]; np[idx] = { ...np[idx], encrypted: e.target.value === 'encrypted' }; setPartitions(np); }} className="bg-transparent w-full outline-none focus:text-slate-900 dark:focus:text-white" /></td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => setPartitions(partitions.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-400 transition-colors">
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
