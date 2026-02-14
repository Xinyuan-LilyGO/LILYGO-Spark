import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Settings, Zap, LayoutGrid, Github, LogOut, Upload, Compass, Users, BookOpen, Terminal, FileCode } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

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
    { id: 'discovery', icon: Compass, label: 'Discovery' }, // TODO: i18n
    { id: 'firmware', icon: LayoutGrid, label: t('nav.firmware') },
    { id: 'community', icon: Users, label: t('nav.lilygo_related') },
    { id: 'tools', icon: Zap, label: t('nav.firmware_toolbox') },
    { id: 'serial_tools', icon: Terminal, label: t('nav.serial_tools') },
    { id: 'offline_tools', icon: FileCode, label: t('nav.convert_tools') },
    { id: 'guide', icon: BookOpen, label: t('nav.guide') },
    { id: 'settings', icon: Settings, label: t('nav.settings') },
  ];

  return (
    <div className={`w-[220px] h-full flex-none z-50 flex flex-col min-h-0 border-r transition-all duration-200 overflow-hidden ${
      glassEnabled 
        ? 'bg-white/40 dark:bg-zinc-900/40 backdrop-blur-2xl backdrop-saturate-150 border-white/20 dark:border-white/10 shadow-[4px_0_24px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_24px_-4px_rgba(0,0,0,0.3)] ring-1 ring-white/10' 
        : 'bg-surface border-slate-200 dark:border-zinc-700'
    }`}>
      
      {/* Header / Logo */}
      <div className="flex items-center justify-center h-20 overflow-hidden relative select-none shrink-0">
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
              </div>
              
              {/* Text Label - Always Visible */}
              <span className={`ml-3 font-medium whitespace-nowrap text-left overflow-hidden text-ellipsis ${isActive ? 'text-primary' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

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
        <div className="text-[11px] text-slate-400 dark:text-zinc-500 text-center">v0.1.0-alpha</div>
      </div>
    </div>
  );
};

export default Sidebar;
