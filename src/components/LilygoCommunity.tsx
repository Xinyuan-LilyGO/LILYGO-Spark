import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, ExternalLink, Globe, ShoppingBag, Store, Github, BookOpen } from 'lucide-react';

const LINKS = [
  { id: 'official', url: 'https://lilygo.cc/', icon: Globe, accent: 'from-emerald-500 to-teal-600' },
  { id: 'github', url: 'https://github.com/Xinyuan-LilyGO', icon: Github, accent: 'from-slate-700 to-slate-900 dark:from-slate-600 dark:to-slate-800' },
  { id: 'wiki', url: 'https://wiki.lilygo.cc/', icon: BookOpen, accent: 'from-amber-500 to-orange-600' },
  { id: 'taobao', url: 'https://shop140839766.taobao.com/', icon: ShoppingBag, accent: 'from-orange-400 to-rose-500' },
  { id: 'aliexpress', url: 'https://lilygo.aliexpress.com/', icon: Store, accent: 'from-red-500 to-rose-600' },
  { id: 'community', url: 'https://community.lilygo.cc/', icon: Users, accent: 'from-violet-500 to-purple-600' },
];

const LilygoCommunity: React.FC = () => {
  const { t } = useTranslation();

  const openLink = (url: string) => {
    const mode = localStorage.getItem('lilygo_link_open_mode') || 'internal';
    if (window.ipcRenderer) {
      window.ipcRenderer.invoke('open-url', url, mode);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 via-slate-50 to-primary/5 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="relative p-6 sm:p-8 shrink-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/5 dark:from-primary/20 dark:to-primary/10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30">
              <Users className="text-white" size={22} />
            </span>
            {t('community.title')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm sm:text-base">
            {t('community.subtitle')}
          </p>
        </div>
      </div>

      {/* Link Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openLink(item.url)}
                className="group relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl bg-white/80 dark:bg-zinc-800/80 backdrop-blur border border-slate-200/80 dark:border-zinc-700/80 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 text-left overflow-hidden"
              >
                {/* Accent bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${item.accent} opacity-80 group-hover:opacity-100 transition-opacity`} />
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.accent} flex items-center justify-center shrink-0 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                  <Icon size={22} className="text-white" />
                </div>
                <div className="flex-1 min-w-0 pl-1">
                  <div className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                    {t(`community.links.${item.id}`)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">
                    {item.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </div>
                </div>
                <ExternalLink size={18} className="text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LilygoCommunity;
