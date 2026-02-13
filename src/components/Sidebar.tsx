import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Zap, LayoutGrid, Download, Wrench, Github, LogOut, Upload } from 'lucide-react';

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

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, user, onLogout }) => {
  const { t } = useTranslation();

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
    { id: 'firmware', icon: LayoutGrid, label: t('nav.firmware') },
    { id: 'burner', icon: Zap, label: t('nav.burner') },
    { id: 'upload', icon: Upload, label: t('nav.upload') },
    { id: 'dumper', icon: Download, label: t('nav.dumper') },
    { id: 'utilities', icon: Wrench, label: t('nav.utilities') },
    { id: 'settings', icon: Settings, label: t('nav.settings') },
  ];

  return (
    <div className="w-[220px] mt-1.5 h-full flex-none z-50 flex flex-col bg-slate-50 border-r border-slate-200 dark:bg-slate-900 dark:border-slate-700 transition-colors">
      
      {/* Header / Logo */}
      <div className="flex items-center justify-center h-20 overflow-hidden relative select-none">
        <div className="flex items-center">
             <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
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
      <nav className="flex-1 px-3 space-y-4 mt-8 flex flex-col items-center">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center rounded-2xl transition-colors duration-200 group relative px-3 py-3 ${
                isActive 
                  ? 'bg-blue-600/10 text-blue-500 dark:text-blue-400' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
              }`}
            >
              {/* Active Indicator (Left Bar) */}
              <div className={`absolute left-0 w-1 rounded-full bg-blue-500 transition-all duration-200 ${
                  isActive ? 'h-8 opacity-100' : 'h-0 opacity-0'
              } -ml-2`} />

              {/* Icon Container */}
              <div className={`relative transition-transform duration-200 ${
                  isActive ? 'scale-105' : 'group-hover:scale-105'
              }`}>
                  <Icon size={24} className={`relative z-10 ${isActive ? 'text-blue-400' : ''}`} />
              </div>
              
              {/* Text Label - Always Visible */}
              <span className={`ml-3 font-medium whitespace-nowrap text-left overflow-hidden text-ellipsis ${isActive ? 'text-blue-700 dark:text-blue-100' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer: Login / User */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700/30 space-y-3">
        {user ? (
          <div className="flex items-center gap-3 px-2">
            {user.avatar_url && (
              <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{user.name || user.login}</div>
              <div className="text-xs text-slate-500 dark:text-slate-500 truncate">@{user.login}</div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
              title="退出登录"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:hover:text-white transition-colors border border-slate-300 dark:border-slate-600/50"
          >
            <Github size={18} />
            <span>使用 GitHub 登录</span>
          </button>
        )}
        <div className="text-xs text-slate-500 dark:text-slate-500 text-center">v0.1.0-alpha</div>
      </div>
    </div>
  );
};

export default Sidebar;
