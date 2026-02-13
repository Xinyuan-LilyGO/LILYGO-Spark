import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Moon, Palette, ExternalLink, Sparkles } from 'lucide-react';
import { useTheme, type AccentColor } from '../contexts/ThemeContext';

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

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { preference: themePreference, setPreference: setThemePreference, accent, setAccent, glassEnabled, setGlassEnabled } = useTheme();
  
  // Initialize state based on localStorage
  const [currentSelection, setCurrentSelection] = React.useState(() => {
      return localStorage.getItem('i18nextLng') || 'system';
  });

  const [linkOpenMode, setLinkOpenMode] = React.useState<'external' | 'internal'>(() => {
    return (localStorage.getItem(LINK_OPEN_STORAGE_KEY) as 'external' | 'internal') || 'internal';
  });

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
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">{t('settings.title')}</h2>
        
        <div className={`rounded-2xl p-6 max-w-2xl border space-y-6 transition-all duration-200 ${
          glassEnabled 
            ? 'bg-white/40 dark:bg-zinc-800/40 backdrop-blur-2xl backdrop-saturate-150 border-white/30 dark:border-white/10 shadow-xl ring-1 ring-white/20 inset-ring' 
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
                <div className="flex flex-wrap gap-2">
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
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                {t(`settings.accent_options.${accent}`)}
            </div>
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
        </div>
      </div>
  );
};

export default SettingsPage;
