import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Settings, Zap, LayoutGrid, Github, LogOut, Upload, Compass, Users, Terminal, FileCode, Wrench, FlaskConical, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useDownload } from '../contexts/DownloadContext';

interface AuthUser {
  login: string;
  name?: string;
  avatar_url?: string;
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: AuthUser | null;
  onLogout: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const LoginButtonWithTooltip: React.FC<{ onLogin: () => void; tooltipText: string; loginLabel: string }> = ({ onLogin, tooltipText, loginLabel }) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleMouseEnter = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setTooltip({ x: rect.left + rect.width / 2, y: rect.top });
    }
  };
  const handleMouseLeave = () => setTooltip(null);

  return (
    <>
      <button
        ref={btnRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={onLogin}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-surface-hover dark:hover:bg-zinc-600 dark:text-zinc-200 transition-colors border border-slate-200 dark:border-zinc-600"
      >
        <Github size={18} className="shrink-0" />
        <span className="font-medium">{loginLabel}</span>
      </button>
      {tooltip && document.body &&
        createPortal(
          <div
            className="fixed px-2 py-1.5 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-[11px] rounded border border-slate-200 dark:border-zinc-600 shadow-lg leading-relaxed z-[9999]"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: 'translate(-50%, -100%)',
              width: 'max-content',
              maxWidth: 220,
            }}
          >
            {tooltipText}
          </div>,
          document.body
        )}
    </>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, user, onLogout }) => {
  const { t } = useTranslation();
  const { glassEnabled } = useTheme();
  const { tasks } = useDownload();
  const [hoveredTooltip, setHoveredTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{ percent: number; transferred: number; total: number; bytesPerSecond: number } | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'downloading' | 'verifying' | 'ready' | null>(null);

  useEffect(() => {
    if (window.electronUtils?.getAppVersion) {
      window.electronUtils.getAppVersion().then((v: string) => setAppVersion(v));
    }
    if (window.ipcRenderer) {
      const progressHandler = (_event: any, progress: { percent: number; transferred: number; total: number; bytesPerSecond: number }) => {
        setUpdateProgress(progress);
        setUpdateStatus('downloading');
      };
      const messageHandler = (_event: any, message: { text: string; data?: any }) => {
        if (message.data?.devMode) {
          setCheckingUpdate(false);
        } else if (message.text.includes('App is up to date') || message.text.includes('Update not available')) {
          setCheckingUpdate(false);
        } else if (message.text.includes('Update available')) {
          setCheckingUpdate(false);
        } else if (message.text.includes('Error') || message.text.includes('failed')) {
          setCheckingUpdate(false);
          setUpdateProgress(null);
          setUpdateStatus(null);
        } else if (message.text.includes('Verifying')) {
          setUpdateStatus('verifying');
        } else if (message.text.includes('Download complete') || message.text.includes('Update downloaded')) {
          setUpdateStatus('ready');
        } else if (message.text.includes('Racing') || message.text.includes('Installing')) {
          setUpdateStatus('downloading');
        }
      };
      window.ipcRenderer.on('update-progress', progressHandler);
      window.ipcRenderer.on('update-message', messageHandler);
      return () => {
        window.ipcRenderer.off('update-progress', progressHandler);
        window.ipcRenderer.off('update-message', messageHandler);
      };
    }
  }, []);

  const handleVersionClick = useCallback(() => {
    if (checkingUpdate) return;
    if (import.meta.env.DEV) {
      alert(t('settings.update_dev_mode'));
      return;
    }
    if (!window.ipcRenderer) return;
    setCheckingUpdate(true);
    window.ipcRenderer.invoke('check-for-updates');
    setTimeout(() => setCheckingUpdate(false), 10000);
  }, [checkingUpdate, t]);

  const activeDownloads = useMemo(() => {
    return Object.values(tasks).filter(t => t.downloading);
  }, [tasks]);

  const handleNavMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, tooltip: string) => {
    const target = e.currentTarget;
    hoverTimerRef.current = setTimeout(() => {
      const rect = target.getBoundingClientRect();
      setHoveredTooltip({ text: tooltip, x: rect.right + 8, y: rect.top + rect.height / 2 });
    }, 400);
  };

  const handleNavMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredTooltip(null);
  };

  const handleLogin = async () => {
    try {
      if (window.ipcRenderer) {
          const apiBaseUrl = await window.ipcRenderer.invoke('get-api-base-url');
          const url = `${apiBaseUrl}/auth/github/start`;
          await window.ipcRenderer.invoke('open-external', url);
      } else {
          console.warn('Not in Electron environment');
      }
    } catch (e) {
      console.error('Login failed:', e);
    }
  };

  const navItems = [
    { id: 'discovery', icon: Compass, label: 'Discovery', tooltip: t('nav_tooltip.discovery') },
    { id: 'firmware', icon: LayoutGrid, label: t('nav.firmware'), tooltip: t('nav_tooltip.firmware') },
    { id: 'tools', icon: Wrench, label: t('nav.firmware_lab'), tooltip: t('nav_tooltip.firmware_lab') },
    { id: 'serial_tools', icon: Terminal, label: t('nav.serial_tools'), tooltip: t('nav_tooltip.serial_tools') },
    { id: 'offline_tools', icon: FileCode, label: t('nav.convert_tools'), tooltip: t('nav_tooltip.offline_tools') },
    { id: 'community', icon: Users, label: t('nav.lilygo_related'), tooltip: t('nav_tooltip.community') },
    { id: 'spark_lab', icon: FlaskConical, label: t('nav.spark_lab'), tooltip: t('nav_tooltip.spark_lab') },
    { id: 'settings', icon: Settings, label: t('nav.settings'), tooltip: t('nav_tooltip.settings') },
  ];

  return (
    <div className={`w-[220px] h-full flex-none z-50 flex flex-col min-h-0 border-r transition-all duration-200 overflow-hidden ${
      glassEnabled 
        ? 'bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl backdrop-saturate-150 border-white/20 dark:border-white/10 shadow-[4px_0_24px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_24px_-4px_rgba(0,0,0,0.3)] ring-1 ring-white/10' 
        : 'bg-surface border-slate-200 dark:border-zinc-700'
    }`}>
      
      {/* Header / Logo */}
      <div className="flex flex-col items-center pt-3 justify-center h-24 overflow-hidden relative select-none shrink-0">
        <div className="flex items-center">
             <div className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
                <Zap size={24} className="text-white fill-white" />
             </div>
             
             <div className="ml-3">
                <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:to-slate-400 whitespace-nowrap">
                   LILYGO Spark
                </h1>
             </div>
        </div>
        <p className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500 whitespace-nowrap mt-1.5">
           Made with <span className="text-[11px] leading-none">🤖</span> AI & <span className="text-[13px] leading-none">❤️</span> Love
        </p>
      </div>

      {/* Nav Items - List Style */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 space-y-4 mt-3 flex flex-col items-center custom-scrollbar">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              onMouseEnter={(e) => handleNavMouseEnter(e, item.tooltip)}
              onMouseLeave={handleNavMouseLeave}
              className={`w-full flex items-center rounded-2xl transition-all duration-200 group relative px-3 py-3 ${
                isActive 
                  ? 'bg-primary/10 text-primary shadow-[0_0_15px_-3px_rgba(var(--color-primary),0.3)]' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-surface-hover dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {/* Active Indicator (Left Bar) */}
              <div className={`absolute left-0 w-1 rounded-full bg-primary transition-all duration-200 ${
                  isActive ? 'h-8 opacity-100' : 'h-0 opacity-0'
              } -ml-2`} />

              {/* Icon Container */}
              <div className={`relative transition-transform duration-200 ${
                  isActive ? 'scale-105' : 'group-hover:scale-105'
              }`}>
                  <Icon size={24} className={`relative z-10 ${isActive ? 'text-primary' : ''}`} />
                  {item.id === 'firmware' && activeDownloads.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center text-[8px] font-bold text-white z-20 animate-pulse shadow-lg shadow-primary/40">
                      {activeDownloads.length}
                    </span>
                  )}
              </div>
              
              {/* Text Label - Always Visible */}
              <span className={`ml-3 font-medium whitespace-nowrap text-left overflow-hidden text-ellipsis flex-1 ${isActive ? 'text-primary' : ''}`}>
                {item.label}
              </span>
              {item.id === 'firmware' && activeDownloads.length > 0 && (
                <div className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shrink-0">
                  <div className="h-full bg-primary rounded-full transition-all duration-300 animate-pulse" 
                    style={{ width: `${Math.round(activeDownloads.reduce((s, d) => s + d.progress, 0) / activeDownloads.length)}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Nav Tooltip */}
      {hoveredTooltip && document.body &&
        createPortal(
          <div
            className="fixed px-3 py-2 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-xs rounded-lg border border-slate-200 dark:border-zinc-600 shadow-xl leading-relaxed z-[9999] pointer-events-none"
            style={{
              left: hoveredTooltip.x,
              top: hoveredTooltip.y,
              transform: 'translateY(-50%)',
              width: 'max-content',
              maxWidth: 260,
            }}
          >
            {hoveredTooltip.text}
          </div>,
          document.body
        )}

      {/* Footer: Login / User + Upload Entry */}
      <div className="p-3 border-t border-slate-200 dark:border-zinc-700/30 space-y-2.5 shrink-0">
        {user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {user.avatar_url && (
                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full shrink-0 ring-2 ring-slate-200 dark:ring-zinc-600" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{user.name || user.login}</div>
                <div className="text-xs text-slate-500 truncate">@{user.login}</div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-700 transition-colors shrink-0"
                title={t('sidebar.logout')}
              >
                <LogOut size={15} />
              </button>
            </div>
            <button
              onClick={() => setActiveTab('upload')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 dark:border-primary/40 transition-colors text-sm font-medium"
              title={t('nav.upload')}
            >
              <Upload size={16} />
              <span>{t('nav.upload')}</span>
            </button>
          </div>
        ) : (
          <LoginButtonWithTooltip onLogin={handleLogin} tooltipText={t('sidebar.login_to_upload_tooltip')} loginLabel={t('sidebar.login_with_github')} />
        )}
        {/* Version + update progress */}
        <div className="space-y-1.5">
          <button
            onClick={handleVersionClick}
            disabled={checkingUpdate}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500 hover:text-primary dark:hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
            title={t('settings.check_update')}
          >
            {checkingUpdate && <RefreshCw size={10} className="animate-spin" />}
            <span>{appVersion ? `v${appVersion}` : '...'}</span>
          </button>
          {(updateProgress && updateProgress.total > 0) || updateStatus ? (
            <div className="px-1">
              {updateProgress && updateProgress.total > 0 && (
                <>
                  <div className="h-1 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, updateProgress.percent)}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-slate-400 dark:text-zinc-500 text-center mt-0.5">
                    {Math.round(updateProgress.percent)}% · {formatBytes(updateProgress.transferred)} / {formatBytes(updateProgress.total)}
                    {updateProgress.bytesPerSecond > 0 && ` · ${formatBytes(updateProgress.bytesPerSecond)}/s`}
                  </div>
                </>
              )}
              {updateStatus === 'verifying' && (
                <div className="text-[9px] text-amber-500 text-center mt-0.5 flex items-center justify-center gap-1">
                  <RefreshCw size={8} className="animate-spin" />
                  {t('sidebar.verifying_update')}
                </div>
              )}
              {updateStatus === 'ready' && (
                <div className="text-[9px] text-emerald-500 text-center mt-0.5">
                  {t('sidebar.update_ready')}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
