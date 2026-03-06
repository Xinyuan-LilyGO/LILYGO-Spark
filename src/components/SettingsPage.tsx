import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Moon, Palette, ExternalLink, Sparkles, Zap, Volume2, CheckCircle, ChevronDown, ChevronRight, FileJson, FolderOpen, X, SlidersHorizontal, RefreshCw, HardDrive, Trash2, MessageSquare, Settings, Wifi, WifiOff, Shield, Activity, Download, Terminal } from 'lucide-react';
import { useTheme, type AccentColor, type AccentMode, type FlashCelebrationStyle } from '../contexts/ThemeContext';
import { useDownload } from '../contexts/DownloadContext';
import FeedbackPage, { type FeedbackData } from './FeedbackPage';

const ACCENT_COLORS: { id: AccentColor; bg: string }[] = [
  { id: 'blue', bg: 'bg-blue-500' },
  { id: 'orange', bg: 'bg-orange-500' },
  { id: 'amber', bg: 'bg-amber-500' },
  { id: 'emerald', bg: 'bg-emerald-500' },
  { id: 'cyan', bg: 'bg-cyan-500' },
  { id: 'sky', bg: 'bg-sky-500' },
  { id: 'violet', bg: 'bg-violet-500' },
  { id: 'rose', bg: 'bg-rose-500' },
];

const LINK_OPEN_STORAGE_KEY = 'lilygo_link_open_mode';

function formatCacheSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { preference: themePreference, setPreference: setThemePreference, accent, accentMode, setAccent, setAccentMode, glassEnabled, setGlassEnabled, soundEnabled, setSoundEnabled, flashCelebrationStyle, setFlashCelebrationStyle } = useTheme();
  const { getCacheStats, clearAll, tasks } = useDownload();

  const [cacheClearing, setCacheClearing] = React.useState(false);
  const cacheStats = React.useMemo(() => getCacheStats(), [tasks]);
  const [activeTab, setActiveTab] = React.useState<'settings' | 'feedback'>('settings');

  // Proxy settings
  type ProxyMode = 'system' | 'direct' | 'custom';
  type ProxyProtocol = 'http' | 'socks5';
  const [proxyMode, setProxyMode] = React.useState<ProxyMode>('system');
  const [proxyProtocol, setProxyProtocol] = React.useState<ProxyProtocol>('http');
  const [proxyHost, setProxyHost] = React.useState('127.0.0.1');
  const [proxyPort, setProxyPort] = React.useState('7890');
  const [proxySaving, setProxySaving] = React.useState(false);
  const [proxyTestResult, setProxyTestResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const [proxyTesting, setProxyTesting] = React.useState(false);

  const handleFeedbackSubmit = async (data: FeedbackData) => {
    const apiBaseUrl = window.ipcRenderer
      ? await window.ipcRenderer.invoke('get-api-base-url')
      : 'https://lilygo-api.bytecode.fun';
    const resp = await fetch(`${apiBaseUrl}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error(`Submit failed: ${resp.status}`);
  };

  const handleClearCache = async () => {
    setCacheClearing(true);
    try {
      await clearAll();
    } finally {
      setCacheClearing(false);
    }
  };

  // Initialize state based on localStorage
  const [currentSelection, setCurrentSelection] = React.useState(() => {
      return localStorage.getItem('i18nextLng') || 'system';
  });

  const [linkOpenMode, setLinkOpenMode] = React.useState<'external' | 'internal'>(() => {
    return (localStorage.getItem(LINK_OPEN_STORAGE_KEY) as 'external' | 'internal') || 'internal';
  });

  const [advancedExpanded, setAdvancedExpanded] = React.useState(false);
  const [customManifestPath, setCustomManifestPath] = React.useState<string | null>(null);
  const [manifestLoading, setManifestLoading] = React.useState(false);
  const [developerMode, setDeveloperMode] = React.useState(false);
  const [canaryUpdate, setCanaryUpdate] = React.useState(false);
  const [fakeOldVersion, setFakeOldVersion] = React.useState(false);
  const [simulateGithubDown, setSimulateGithubDown] = React.useState(false);
  const [checkingUpdate, setCheckingUpdate] = React.useState(false);
  const [appVersion, setAppVersion] = React.useState('0.0.0');
  const manualCheckRef = React.useRef(false);

  React.useEffect(() => {
    if (window.ipcRenderer) {
      window.ipcRenderer.invoke('get-custom-manifest-path').then((p: string | null) => setCustomManifestPath(p));
      window.ipcRenderer.invoke('get-developer-mode').then((enabled: boolean) => setDeveloperMode(enabled));
      window.ipcRenderer.invoke('get-canary-update').then((enabled: boolean) => setCanaryUpdate(enabled));
      window.ipcRenderer.invoke('get-fake-old-version').then((enabled: boolean) => setFakeOldVersion(enabled));
      window.ipcRenderer.invoke('get-simulate-github-down').then((enabled: boolean) => setSimulateGithubDown(enabled));
      window.ipcRenderer.invoke('get-proxy-config').then((cfg: any) => {
        if (cfg) {
          setProxyMode(cfg.mode || 'system');
          setProxyProtocol(cfg.protocol || 'http');
          setProxyHost(cfg.host || '127.0.0.1');
          setProxyPort(String(cfg.port || '7890'));
        }
      });
      if (window.electronUtils?.getAppVersion) {
          window.electronUtils.getAppVersion().then((v: string) => setAppVersion(v));
      }
      
      // Listen for update messages — only show alert when user manually triggered the check
      const updateHandler = (_event: any, message: { text: string, data?: any }) => {
          console.log('[Updater]', message.text);
          if (message.data?.devMode) {
             if (manualCheckRef.current) {
               alert(t('settings.update_dev_mode'));
             }
             setCheckingUpdate(false);
             manualCheckRef.current = false;
          } else if (message.text.includes('App is up to date')) {
             if (manualCheckRef.current) {
               alert(t('settings.update_not_found'));
             }
             setCheckingUpdate(false);
             manualCheckRef.current = false;
          } else if (message.text.includes('Update available')) {
             setCheckingUpdate(false);
             manualCheckRef.current = false;
          } else if (message.text.includes('Error')) {
             if (manualCheckRef.current) {
               alert(t('settings.update_error') + ': ' + message.text);
             }
             setCheckingUpdate(false);
             manualCheckRef.current = false;
          }
      };
      window.ipcRenderer.on('update-message', updateHandler);
      return () => { window.ipcRenderer.off('update-message', updateHandler); };
    }
  }, []);

  const handleCheckUpdate = async () => {
      if (!window.ipcRenderer) return;
      manualCheckRef.current = true;
      setCheckingUpdate(true);
      try {
          await window.ipcRenderer.invoke('check-for-updates');
          // Timeout to reset state if no response
          setTimeout(() => setCheckingUpdate(false), 10000);
      } catch (e) {
          console.error('Check update failed:', e);
          setCheckingUpdate(false);
      }
  };

  React.useEffect(() => {
    if (!window.ipcRenderer) return;
    const handler = () => {
      window.ipcRenderer.invoke('get-custom-manifest-path').then((p: string | null) => setCustomManifestPath(p));
    };
    window.ipcRenderer.on('manifest-source-changed', handler);
    return () => { window.ipcRenderer.off('manifest-source-changed'); };
  }, []);

  const handleSelectManifestFile = async () => {
    if (!window.ipcRenderer) return;
    setManifestLoading(true);
    try {
      const path = await window.ipcRenderer.invoke('select-firmware-manifest-file');
      if (path) setCustomManifestPath(path);
    } catch (e) {
      console.error('Select manifest failed:', e);
    } finally {
      setManifestLoading(false);
    }
  };

  const handleClearManifest = async () => {
    if (!window.ipcRenderer) return;
    setManifestLoading(true);
    try {
      await window.ipcRenderer.invoke('clear-custom-manifest');
      setCustomManifestPath(null);
    } finally {
      setManifestLoading(false);
    }
  };

  const handleProxySave = async (mode: ProxyMode) => {
    if (!window.ipcRenderer) return;
    setProxySaving(true);
    setProxyTestResult(null);
    try {
      const config: any = { mode };
      if (mode === 'custom') {
        config.protocol = proxyProtocol;
        config.host = proxyHost.trim() || '127.0.0.1';
        config.port = parseInt(proxyPort) || 7890;
      }
      await window.ipcRenderer.invoke('set-proxy-config', config);
      setProxyMode(mode);
    } finally {
      setProxySaving(false);
    }
  };

  const handleProxyTest = async () => {
    if (!window.ipcRenderer) return;
    setProxyTesting(true);
    setProxyTestResult(null);
    try {
      const result = await window.ipcRenderer.invoke('test-proxy');
      setProxyTestResult({
        success: result.success,
        message: result.success ? (result.message || 'OK') : (result.error || 'Failed'),
      });
    } catch (e: any) {
      setProxyTestResult({ success: false, message: e.message || 'Error' });
    } finally {
      setProxyTesting(false);
    }
  };

  const handleDeveloperModeChange = async (enabled: boolean) => {
    setDeveloperMode(enabled);
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('set-developer-mode', enabled);
    }
  };

  const handleCanaryUpdateChange = async (enabled: boolean) => {
    setCanaryUpdate(enabled);
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('set-canary-update', enabled);
    }
  };

  const handleFakeOldVersionChange = async (enabled: boolean) => {
    setFakeOldVersion(enabled);
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('set-fake-old-version', enabled);
    }
  };

  const handleSimulateGithubDownChange = async (enabled: boolean) => {
    setSimulateGithubDown(enabled);
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke('set-simulate-github-down', enabled);
    }
  };

  // Network probe
  interface ProbeNodeResult {
    id: string;
    label: string;
    type: 'api' | 'download';
    url: string;
    status: 'pending' | 'testing' | 'success' | 'error' | 'timeout';
    httpCode?: number;
    error?: string;
    bytesDownloaded?: number;
    durationMs?: number;
    speedBps?: number;
  }
  const [probeResults, setProbeResults] = React.useState<ProbeNodeResult[]>([]);
  const [probing, setProbing] = React.useState(false);

  // Log viewer
  interface LogEntry { timestamp: string; level: string; source: string; message: string; }
  const [logExpanded, setLogExpanded] = React.useState(false);
  const [logEntries, setLogEntries] = React.useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = React.useState<'all' | 'main' | 'renderer'>('all');
  const [logLevelFilter, setLogLevelFilter] = React.useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [logAutoScroll, setLogAutoScroll] = React.useState(true);
  const logContainerRef = React.useRef<HTMLDivElement>(null);
  const [logExporting, setLogExporting] = React.useState(false);

  React.useEffect(() => {
    if (!window.ipcRenderer || !logExpanded) return;
    window.ipcRenderer.invoke('logger-get-entries').then((entries: LogEntry[]) => {
      setLogEntries(entries);
    });
    const handler = (_event: any, entry: LogEntry) => {
      setLogEntries(prev => {
        const next = [...prev, entry];
        return next.length > 2000 ? next.slice(-2000) : next;
      });
    };
    window.ipcRenderer.on('log-entry', handler);
    return () => { window.ipcRenderer.off('log-entry', handler); };
  }, [logExpanded]);

  React.useEffect(() => {
    if (logAutoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logEntries, logAutoScroll, logExpanded]);

  const handleExportLog = async () => {
    if (!window.ipcRenderer) return;
    setLogExporting(true);
    try {
      await window.ipcRenderer.invoke('logger-export');
    } finally {
      setLogExporting(false);
    }
  };

  const handleNetworkProbe = async () => {
    if (!window.ipcRenderer || probing) return;
    setProbing(true);
    setProbeResults([]);
    try {
      const results: ProbeNodeResult[] = await window.ipcRenderer.invoke('network-probe');
      const dlResults = results.filter(r => r.type === 'download' && r.status === 'success');
      dlResults.sort((a, b) => (b.speedBps || 0) - (a.speedBps || 0));
      const apiResults = results.filter(r => r.type === 'api');
      const dlOther = results.filter(r => r.type === 'download' && r.status !== 'success');
      setProbeResults([...apiResults, ...dlResults, ...dlOther]);
    } catch (e: any) {
      console.error('Network probe failed:', e);
    } finally {
      setProbing(false);
    }
  };

  const formatSpeed = (bps?: number) => {
    if (!bps || bps <= 0) return '-';
    if (bps < 1024) return `${bps} B/s`;
    if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
    return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const handleLinkOpenModeChange = (mode: 'external' | 'internal') => {
    setLinkOpenMode(mode);
    localStorage.setItem(LINK_OPEN_STORAGE_KEY, mode);
  };

  const changeLanguage = async (lng: string) => {
    if (lng === 'system') {
       // Switch to system language (navigator)
       // We use a small timeout to ensure the change happens, 
       // then clear localStorage because i18n might write to it.
       const sysLang = navigator.language;
       await i18n.changeLanguage(sysLang);
       localStorage.removeItem('i18nextLng');
       setCurrentSelection('system');
    } else {
      await i18n.changeLanguage(lng);
      setCurrentSelection(lng);
    }
  };

  return (
      <div className="h-full flex flex-col">
        <div className="shrink-0 border-b border-slate-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
          <div className="flex gap-1 p-2">
            {([
              { id: 'settings' as const, icon: Settings, labelKey: 'settings.title' },
              { id: 'feedback' as const, icon: MessageSquare, labelKey: 'nav.feedback' },
            ]).map(({ id, icon: Icon, labelKey }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === id
                    ? 'bg-primary/15 text-primary shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800'
                }`}
              >
                <Icon size={18} />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'feedback' && (
          <div className="flex-1 min-h-0 overflow-auto">
            <FeedbackPage onSubmit={handleFeedbackSubmit} />
          </div>
        )}

        {activeTab === 'settings' && (
        <div className="flex-1 min-h-0 overflow-auto p-8">
        
        <div className={`rounded-2xl p-6 max-w-2xl border space-y-6 transition-all duration-200 ${
          glassEnabled 
            ? 'bg-white/40 dark:bg-zinc-800/40 backdrop-blur-2xl backdrop-saturate-150 border-white/30 dark:border-white/10 shadow-xl ring-1 ring-white/20' 
            : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700'
        }`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Globe className="text-primary" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{t('settings.language')}</span>
                </div>
                
                <select 
                    value={currentSelection}
                    onChange={(e) => changeLanguage(e.target.value)}
                    className="bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="system">{t('settings.language_options.system')}</option>
                    <option value="en">{t('settings.language_options.en')}</option>
                    <option value="zh-CN">{t('settings.language_options.zh-CN')}</option>
                    <option value="zh-TW">{t('settings.language_options.zh-TW')}</option>
                    <option value="ja">{t('settings.language_options.ja')}</option>
                </select>
            </div>
            <div className="text-xs text-slate-500 mt-2">
                Current active language: {i18n.language} ({currentSelection === 'system' ? 'System' : 'Manual'})
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Moon className="text-primary" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{t('settings.theme')}</span>
                </div>
                
                <select 
                    value={themePreference}
                    onChange={(e) => setThemePreference(e.target.value as 'system' | 'light' | 'dark')}
                    className="bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="system">{t('settings.theme_options.system')}</option>
                    <option value="light">{t('settings.theme_options.light')}</option>
                    <option value="dark">{t('settings.theme_options.dark')}</option>
                </select>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                {themePreference === 'system' ? t('settings.theme_options.system') : themePreference === 'light' ? t('settings.theme_options.light') : t('settings.theme_options.dark')}
            </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Palette className="text-primary" />
                    <span className="font-medium text-slate-800 dark:text-zinc-200">{t('settings.accent')}</span>
                </div>
                <div className="flex items-center gap-2">
                    {accentMode === 'rotating' && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-zinc-700/50">
                        <div className={`w-4 h-4 rounded-full ${ACCENT_COLORS.find(c => c.id === accent)?.bg || 'bg-blue-500'}`} />
                        <span className="text-xs text-slate-500 dark:text-zinc-400">{t(`settings.accent_options.${accent}`)}</span>
                      </div>
                    )}
                    <select
                        value={accentMode}
                        onChange={(e) => setAccentMode(e.target.value as AccentMode)}
                        className="bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="rotating">{t('settings.accent_mode_rotating')}</option>
                        <option value="fixed">{t('settings.accent_mode_fixed')}</option>
                    </select>
                </div>
            </div>
            {accentMode === 'rotating' ? (
              <div className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                {t('settings.accent_rotating_hint')}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mt-3">
                    {ACCENT_COLORS.map(({ id, bg }) => (
                        <button
                            key={id}
                            onClick={() => setAccent(id)}
                            title={t(`settings.accent_options.${id}`)}
                            className={`w-8 h-8 rounded-full ${bg} transition-all ring-2 ring-offset-2 ring-offset-slate-100 dark:ring-offset-zinc-800 ${
                                accent === id ? 'ring-primary scale-110' : 'ring-transparent hover:scale-105'
                            }`}
                        />
                    ))}
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                    {t(`settings.accent_options.${accent}`)}
                </div>
              </>
            )}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <ExternalLink className="text-primary" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{t('settings.link_open')}</span>
                </div>
                <select 
                    value={linkOpenMode}
                    onChange={(e) => handleLinkOpenModeChange(e.target.value as 'external' | 'internal')}
                    className="bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="internal">{t('settings.link_open_options.internal')}</option>
                    <option value="external">{t('settings.link_open_options.external')}</option>
                </select>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                {t('settings.link_open_hint')}
            </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Sparkles className="text-primary" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{t('settings.glass')}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={glassEnabled}
                        onChange={(e) => setGlassEnabled(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-600 peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:border after:border-slate-300 dark:after:border-zinc-500 peer-checked:bg-primary"></div>
                    <span className="ml-3 text-sm text-slate-600 dark:text-slate-300">{glassEnabled ? t('settings.glass_on') : t('settings.glass_off')}</span>
                </label>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                {t('settings.glass_hint')}
            </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <Volume2 className="text-primary" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{t('settings.sound')}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={soundEnabled}
                        onChange={(e) => setSoundEnabled(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-600 peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:border after:border-slate-300 dark:after:border-zinc-500 peer-checked:bg-primary"></div>
                    <span className="ml-3 text-sm text-slate-600 dark:text-slate-300">{soundEnabled ? t('settings.sound_on') : t('settings.sound_off')}</span>
                </label>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                {t('settings.sound_hint')}
            </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <CheckCircle className="text-primary" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{t('settings.flash_celebration_style')}</span>
                </div>
                <select 
                    value={flashCelebrationStyle}
                    onChange={(e) => setFlashCelebrationStyle(e.target.value as FlashCelebrationStyle)}
                    className="bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="fireworks">{t('settings.flash_style_fireworks')}</option>
                    <option value="hacker">{t('settings.flash_style_hacker')}</option>
                    <option value="minimal">{t('settings.flash_style_minimal')}</option>
                    <option value="neon">{t('settings.flash_style_neon')}</option>
                    <option value="terminal">{t('settings.flash_style_terminal')}</option>
                    <option value="gradient">{t('settings.flash_style_gradient')}</option>
                </select>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                {t('settings.flash_celebration_style_hint')}
            </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
            <div className="flex items-center space-x-3">
                <Zap className="text-primary" />
                <span className="font-medium text-slate-800 dark:text-slate-200">{t('settings.easter_eggs')}</span>
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-start gap-2">
                    <code className="shrink-0 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 font-mono text-xs">↑↑↓↓←→←→BA</code>
                    <span>{t('settings.easter_eggs_konami')}</span>
                </div>
                <div className="flex items-start gap-2">
                    <span className="shrink-0 font-medium text-emerald-600 dark:text-emerald-400">{t('settings.easter_eggs_flash')}</span>
                    <span>{t('settings.easter_eggs_flash_hint')}</span>
                </div>
                <div className="flex items-start gap-2">
                    <span className="shrink-0 font-medium text-emerald-600 dark:text-emerald-400">{t('settings.easter_eggs_device')}</span>
                    <span>{t('settings.easter_eggs_device_hint')}</span>
                </div>
            </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <RefreshCw className={`text-primary ${checkingUpdate ? 'animate-spin' : ''}`} />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{t('settings.check_update')}</span>
                </div>
                <button
                    onClick={handleCheckUpdate}
                    disabled={checkingUpdate}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                    {checkingUpdate ? t('settings.checking_update') : t('settings.check_update_btn')}
                </button>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                v{appVersion}
            </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <HardDrive className="text-primary" />
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{t('settings.cache_management')}</span>
                      <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        {cacheStats.fileCount > 0
                          ? `${cacheStats.fileCount} ${t('settings.cache_files')} · ${formatCacheSize(cacheStats.totalBytes)}`
                          : t('settings.cache_empty')
                        }
                      </div>
                    </div>
                </div>
                <button
                    onClick={handleClearCache}
                    disabled={cacheClearing || cacheStats.fileCount === 0}
                    className="px-4 py-2 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-1.5"
                >
                    <Trash2 size={14} />
                    {cacheClearing ? t('settings.cache_clearing') : t('settings.cache_clear_btn')}
                </button>
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                {t('settings.cache_hint')}
            </div>
            </div>

            {/* ── Proxy Settings ── */}
            <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
              <div className="flex items-center space-x-3 mb-3">
                <Shield className="text-primary" size={20} />
                <span className="font-medium text-slate-800 dark:text-slate-200">{t('settings.proxy_title')}</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {(['system', 'direct', 'custom'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { if (mode !== 'custom') handleProxySave(mode); else setProxyMode('custom'); }}
                    disabled={proxySaving}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5
                      ${proxyMode === mode
                        ? 'bg-primary/15 text-primary border border-primary/40'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-transparent hover:bg-slate-200 dark:hover:bg-zinc-700'
                      }`}
                  >
                    {mode === 'system' && <><Wifi size={14} /> {t('settings.proxy_system')}</>}
                    {mode === 'direct' && <><WifiOff size={14} /> {t('settings.proxy_direct')}</>}
                    {mode === 'custom' && <><Globe size={14} /> {t('settings.proxy_custom')}</>}
                  </button>
                ))}
              </div>

              {proxyMode === 'custom' && (
                <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-lg p-3 space-y-3 border border-slate-200 dark:border-zinc-700">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="w-24">
                      <label className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">{t('settings.proxy_protocol')}</label>
                      <select
                        value={proxyProtocol}
                        onChange={(e) => setProxyProtocol(e.target.value as ProxyProtocol)}
                        className="w-full bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md px-2 py-1.5 text-sm text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="http">HTTP</option>
                        <option value="socks5">SOCKS5</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">{t('settings.proxy_host')}</label>
                      <input
                        type="text"
                        value={proxyHost}
                        onChange={(e) => setProxyHost(e.target.value)}
                        placeholder="127.0.0.1"
                        className="w-full bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md px-2 py-1.5 text-sm text-slate-800 dark:text-white font-mono outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="w-20">
                      <label className="block text-[11px] text-slate-500 dark:text-zinc-400 mb-1">{t('settings.proxy_port')}</label>
                      <input
                        type="text"
                        value={proxyPort}
                        onChange={(e) => setProxyPort(e.target.value.replace(/\D/g, ''))}
                        placeholder="7890"
                        className="w-full bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md px-2 py-1.5 text-sm text-slate-800 dark:text-white font-mono outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleProxySave('custom')}
                      disabled={proxySaving}
                      className="px-3 py-1.5 bg-primary/10 text-primary rounded-md text-sm font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
                    >
                      {proxySaving ? '...' : t('settings.proxy_save')}
                    </button>
                    <button
                      onClick={handleProxyTest}
                      disabled={proxyTesting}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-md text-sm font-medium hover:bg-slate-200 dark:hover:bg-zinc-600 disabled:opacity-50 transition-colors"
                    >
                      {proxyTesting ? '...' : t('settings.proxy_test')}
                    </button>
                    {proxyTestResult && (
                      <span className={`text-xs ${proxyTestResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {proxyTestResult.success ? '✓ ' : '✗ '}{proxyTestResult.message}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">{t('settings.proxy_hint')}</p>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setAdvancedExpanded((v) => !v)}
              className="flex items-center gap-2 w-full text-left rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700/50 -mx-2 px-2 py-2 transition-colors"
            >
              {advancedExpanded ? <ChevronDown className="text-primary shrink-0" size={20} /> : <ChevronRight className="text-primary shrink-0" size={20} />}
              <SlidersHorizontal className="text-primary" size={20} />
              <span className="font-medium text-slate-800 dark:text-slate-200">{t('settings.advanced_mode')}</span>
            </button>
            {advancedExpanded && (
              <div className="mt-4 pl-8 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileJson className="text-primary" size={18} />
                    <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">{t('settings.firmware_manifest_file')}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">{t('settings.firmware_manifest_file_hint')}</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={handleSelectManifestFile}
                      disabled={manifestLoading}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                    >
                      <FolderOpen size={16} />
                      {t('settings.firmware_manifest_select')}
                    </button>
                    {customManifestPath && (
                      <>
                        <span className="text-sm text-slate-600 dark:text-slate-400 truncate sm:max-w-[200px]" title={customManifestPath}>{customManifestPath.split(/[/\\]/).pop() || customManifestPath}</span>
                        <button
                          type="button"
                          onClick={handleClearManifest}
                          disabled={manifestLoading}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <X size={16} />
                          {t('settings.firmware_manifest_clear')}
                        </button>
                      </>
                    )}
                  </div>
                  {customManifestPath && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">{t('settings.firmware_manifest_active')}</p>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-zinc-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="text-primary" size={18} />
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">{t('settings.canary_update')}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">{t('settings.canary_update_hint')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={canaryUpdate}
                            onChange={(e) => handleCanaryUpdateChange(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-600 peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:border after:border-slate-300 dark:after:border-zinc-500 peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-zinc-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="text-primary" size={18} />
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">{t('settings.developer_mode')}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">{t('settings.developer_mode_hint')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={developerMode}
                            onChange={(e) => handleDeveloperModeChange(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-600 peer-focus:ring-2 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:border after:border-slate-300 dark:after:border-zinc-500 peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>

                {developerMode && (<>
                <div className="pt-4 border-t border-slate-200 dark:border-zinc-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <RefreshCw className="text-amber-500" size={18} />
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">{t('settings.fake_old_version')}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">{t('settings.fake_old_version_hint')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={fakeOldVersion}
                            onChange={(e) => handleFakeOldVersionChange(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-600 peer-focus:ring-2 peer-focus:ring-amber-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:border after:border-slate-300 dark:after:border-zinc-500 peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                  {fakeOldVersion && (
                    <div className="mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg">
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {t('settings.fake_old_version_active', { realVersion: appVersion, fakeVersion: '0.0.1' })}
                      </p>
                    </div>
                  )}
                </div>

                <hr className="my-4 border-slate-200 dark:border-zinc-700/50" />

                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <WifiOff className="text-red-500" size={18} />
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">{t('settings.simulate_github_down')}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">{t('settings.simulate_github_down_hint')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={simulateGithubDown}
                            onChange={(e) => handleSimulateGithubDownChange(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 dark:bg-zinc-600 peer-focus:ring-2 peer-focus:ring-red-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:border after:border-slate-300 dark:after:border-zinc-500 peer-checked:bg-red-500"></div>
                    </label>
                  </div>
                  {simulateGithubDown && (
                    <div className="mt-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg">
                      <p className="text-xs text-red-700 dark:text-red-300">
                        {t('settings.simulate_github_down_active')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Network Probe */}
                <div className="pt-4 border-t border-slate-200 dark:border-zinc-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="text-cyan-500" size={18} />
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">{t('settings.network_probe')}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">{t('settings.network_probe_hint')}</p>
                    </div>
                    <button
                      onClick={handleNetworkProbe}
                      disabled={probing}
                      className="px-3 py-1.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-1.5"
                    >
                      <Activity size={14} className={probing ? 'animate-pulse' : ''} />
                      {probing ? t('settings.network_probing') : t('settings.network_probe_btn')}
                    </button>
                  </div>

                  {(probing || probeResults.length > 0) && (
                    <div className="mt-3 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-zinc-800/70 text-slate-500 dark:text-zinc-400">
                            <th className="px-3 py-2 text-left font-medium">{t('settings.probe_node')}</th>
                            <th className="px-3 py-2 text-left font-medium">{t('settings.probe_status')}</th>
                            <th className="px-3 py-2 text-right font-medium">{t('settings.probe_latency')}</th>
                            <th className="px-3 py-2 text-right font-medium">{t('settings.probe_speed')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {probing && probeResults.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-3 py-4 text-center text-slate-400 dark:text-zinc-500">
                                <div className="flex items-center justify-center gap-2">
                                  <Activity size={14} className="animate-pulse" />
                                  <span>{t('settings.network_probing')}</span>
                                </div>
                              </td>
                            </tr>
                          )}
                          {probeResults.map((node) => (
                            <tr key={node.id} className="border-t border-slate-100 dark:border-zinc-700/50 hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                              <td className="px-3 py-2">
                                <div className="font-medium text-slate-700 dark:text-zinc-300">{node.label}</div>
                                <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate max-w-[200px]" title={node.url}>{node.url}</div>
                              </td>
                              <td className="px-3 py-2">
                                {node.status === 'success' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                    <CheckCircle size={10} /> OK{node.httpCode ? ` (${node.httpCode})` : ''}
                                  </span>
                                )}
                                {node.status === 'error' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" title={node.error}>
                                    <X size={10} /> {node.error || 'Error'}
                                  </span>
                                )}
                                {node.status === 'timeout' && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                    <WifiOff size={10} /> {node.error || 'Timeout'}
                                  </span>
                                )}
                                {(node.status === 'pending' || node.status === 'testing') && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400">
                                    <Activity size={10} className="animate-pulse" /> Testing...
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600 dark:text-zinc-400 font-mono">
                                {node.durationMs != null ? `${node.durationMs}ms` : '-'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {node.type === 'download' ? (
                                  <span className={node.speedBps && node.speedBps > 0 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-400'}>
                                    {formatSpeed(node.speedBps)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Log Viewer */}
                <div className="pt-4 border-t border-slate-200 dark:border-zinc-700/50">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-2 cursor-pointer select-none"
                      onClick={() => setLogExpanded(!logExpanded)}
                    >
                      <Terminal className="text-emerald-500" size={18} />
                      <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">{t('settings.log_viewer')}</span>
                      {logExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportLog}
                        disabled={logExporting}
                        className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-1.5"
                      >
                        <Download size={14} />
                        {t('settings.log_export')}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{t('settings.log_viewer_hint')}</p>

                  {logExpanded && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 text-xs">
                          {(['all', 'main', 'renderer'] as const).map(src => (
                            <button
                              key={src}
                              onClick={() => setLogFilter(src)}
                              className={`px-2.5 py-1 transition-colors ${logFilter === src ? 'bg-emerald-500 text-white' : 'bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700'}`}
                            >
                              {src === 'all' ? t('settings.log_all') : src}
                            </button>
                          ))}
                        </div>
                        <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 text-xs">
                          {(['all', 'info', 'warn', 'error'] as const).map(lvl => (
                            <button
                              key={lvl}
                              onClick={() => setLogLevelFilter(lvl)}
                              className={`px-2.5 py-1 transition-colors ${logLevelFilter === lvl ? 'bg-emerald-500 text-white' : 'bg-slate-50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-700'}`}
                            >
                              {lvl === 'all' ? t('settings.log_all') : lvl.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 ml-auto cursor-pointer select-none">
                          <input type="checkbox" checked={logAutoScroll} onChange={e => setLogAutoScroll(e.target.checked)} className="rounded" />
                          {t('settings.log_auto_scroll')}
                        </label>
                      </div>
                      <div
                        ref={logContainerRef}
                        className="h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-950 font-mono text-[11px] leading-relaxed p-2"
                      >
                        {logEntries
                          .filter(e => logFilter === 'all' || e.source === logFilter)
                          .filter(e => logLevelFilter === 'all' || e.level === logLevelFilter)
                          .map((entry, i) => {
                            const lvlColor = entry.level === 'error' ? 'text-red-400'
                              : entry.level === 'warn' ? 'text-amber-400'
                              : entry.level === 'verbose' ? 'text-slate-500'
                              : 'text-slate-300';
                            const srcColor = entry.source === 'renderer' ? 'text-cyan-400' : 'text-emerald-400';
                            const ts = entry.timestamp.slice(11, 23);
                            return (
                              <div key={i} className="flex gap-1 hover:bg-slate-900 px-1 rounded">
                                <span className="text-slate-600 shrink-0">{ts}</span>
                                <span className={`${srcColor} shrink-0 w-[4.5rem]`}>[{entry.source}]</span>
                                <span className={`${lvlColor} shrink-0 w-14`}>{entry.level.toUpperCase().padEnd(7)}</span>
                                <span className={lvlColor}>{entry.message}</span>
                              </div>
                            );
                          })}
                        {logEntries.length === 0 && (
                          <div className="text-slate-600 text-center py-8">{t('settings.log_empty')}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                </>)}
              </div>
            )}
            </div>
        </div>
        </div>
        )}
      </div>
  );
};

export default SettingsPage;
