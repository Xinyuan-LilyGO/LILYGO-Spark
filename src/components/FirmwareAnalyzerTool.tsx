import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCode, AlertCircle, Cpu, Terminal, HardDrive, Microscope } from 'lucide-react';
import { getPartitionTypeLabel, getPartitionSubtypeLabel } from '../utils/partitionTypes';
import { analyzeFirmwareBuffer, type FirmwareAnalysisResult } from '../utils/firmwareAnalyzer';
import FullWindowDropZone from './FullWindowDropZone';

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

interface FirmwareAnalyzerToolProps {
  pendingAnalysisFile?: { path: string; fileName: string } | null;
  onAnalysisFileConsumed?: () => void;
  onOpenEditor?: (partitions: any[]) => void;
}

const FirmwareAnalyzerTool: React.FC<FirmwareAnalyzerToolProps> = ({ pendingAnalysisFile, onAnalysisFileConsumed, onOpenEditor }) => {
  const { t } = useTranslation();
  const [analysisFile, setAnalysisFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [analysisEngine, setAnalysisEngine] = useState<'js' | 'native'>('js');
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

  const handleAnalyzerDrop = (files: FileList) => {
    const file = Array.from(files).find((f) => f.name.toLowerCase().endsWith('.bin'));
    if (file) {
      setAnalysisFile(file);
      setAnalysisResult(null);
      setLogs([]);
      handleAnalyze(file);
    }
  };

  useEffect(() => {
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
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

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
    } catch (e: any) {
      console.error(e);
      if (e.message !== 'Cancelled') {
        setAnalysisResult({ error: e.message || String(e) });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (!pendingAnalysisFile) return;
    const { path: filePath, fileName } = pendingAnalysisFile;
    onAnalysisFileConsumed?.();

    (async () => {
      try {
        const buffer: ArrayBuffer = await window.ipcRenderer.invoke('read-file-as-buffer', filePath);
        const file = new File([buffer], fileName, { type: 'application/octet-stream' });
        Object.defineProperty(file, 'path', { value: filePath, writable: false });
        setAnalysisFile(file);
        setAnalysisResult(null);
        setLogs([]);
        setAnalysisEngine('js');
        handleAnalyze(file);
      } catch (e: any) {
        console.error('Failed to load file for analysis:', e);
        setAnalysisResult({ error: e.message || String(e) });
      }
    })();
  }, [pendingAnalysisFile]);

  return (
    <>
      <FullWindowDropZone
        active={true}
        accept=".bin"
        onDrop={handleAnalyzerDrop}
        hintKey="common.drop_firmware"
      />
      <div className="flex-1 flex flex-col gap-4 overflow-auto">
        {/* File picker + engine selector */}
        <div className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg transition-all duration-300 ease-in-out ${analysisFile && analysisResult ? 'p-3' : 'p-6'}`}>
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".bin" />

          {analysisFile && analysisResult ? (
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
                {(() => {
                  const cardCls = "bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 break-inside-avoid mb-3";
                  const titleCls = "text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1.5";
                  const tagCls = "px-1.5 py-0.5 rounded text-[11px] font-mono leading-tight";
                  const kvCls = "flex text-xs font-mono";
                  const kCls = "text-slate-500 dark:text-slate-400 w-20 shrink-0";

                  return (
                    <div className="columns-1 md:columns-2 gap-3">
                      {/* Chip + Image Type */}
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
                        {analysisResult.bootloader_flash_size && (
                          <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-slate-200 dark:border-slate-600/50">
                            <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{analysisResult.bootloader_flash_size}</span>
                            {analysisResult.flash_mode && <span className="bg-slate-300 dark:bg-slate-600 px-1.5 py-0.5 rounded text-xs font-mono">{analysisResult.flash_mode}</span>}
                            {analysisResult.flash_freq && <span className="bg-slate-300 dark:bg-slate-600 px-1.5 py-0.5 rounded text-xs font-mono">{analysisResult.flash_freq}</span>}
                          </div>
                        )}
                      </div>

                      {/* Framework */}
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

                      {/* Build Info */}
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

                      {/* Extended Header */}
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

                      {/* Components */}
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

                      {/* Partition Table */}
                      {analysisResult.partitions && analysisResult.partitions.length > 0 && (
                        <div className={`${cardCls} break-inside-avoid-column`}>
                          <div className="flex justify-between items-center mb-1.5">
                            <h4 className={titleCls + ' mb-0'}>
                              {t('utilities.partition_table')}
                              <span className="ml-2 text-[10px] font-normal bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded normal-case tracking-normal">
                                {analysisResult.partition_table_offset || '?'}
                              </span>
                            </h4>
                            {onOpenEditor && (
                              <button onClick={() => onOpenEditor(analysisResult.partitions || [])}
                                className="text-[10px] bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-800 dark:text-primary px-2 py-0.5 rounded transition-colors flex items-center">
                                <FileCode size={11} className="mr-1" /> Editor
                              </button>
                            )}
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
                                    <td className="px-2 py-1 text-emerald-600 dark:text-green-300">{Math.round(p.size_dec / 1024)}KB</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Logs */}
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

                      {/* Raw JSON */}
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
    </>
  );
};

export default FirmwareAnalyzerTool;
