import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  // Initialize state based on localStorage
  const [currentSelection, setCurrentSelection] = React.useState(() => {
      return localStorage.getItem('i18nextLng') || 'system';
  });

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
        <h2 className="text-2xl font-bold mb-6">{t('settings.title')}</h2>
        
        <div className="bg-slate-800 rounded-lg p-6 max-w-2xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <Globe className="text-blue-400" />
                    <span className="font-medium">{t('settings.language')}</span>
                </div>
                
                <select 
                    value={currentSelection}
                    onChange={(e) => changeLanguage(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        </div>
      </div>
  );
};

export default SettingsPage;
