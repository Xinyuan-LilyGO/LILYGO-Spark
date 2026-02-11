import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Zap, Users, Download } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { t } = useTranslation();

  const navItems = [
    { id: 'firmware', icon: Users, label: '固件社区' }, // Firmware Community
    { id: 'flasher', icon: Zap, label: '刷写工具' },   // Flash Tool
    { id: 'dumper', icon: Download, label: '固件提取' }, // Firmware Dumper
    { id: 'settings', icon: Settings, label: '设置' },   // Settings
  ];

  return (
    // Fixed width container, no hovering expansion
    <div className="w-64 h-full flex-none z-50 flex flex-col bg-slate-900 border-r border-slate-700">
      
      {/* Header / Logo */}
      <div className="p-4 flex items-center h-20 overflow-hidden relative select-none">
        <div className="w-full flex items-center px-4">
             <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                <Zap size={24} className="text-white fill-white" />
             </div>
             
             <div className="ml-3">
                <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 whitespace-nowrap">
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
              className={`w-full flex items-center rounded-2xl transition-colors duration-200 group relative px-4 py-3 ${
                isActive 
                  ? 'bg-blue-600/10 text-blue-400' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {/* Active Indicator (Left Bar) */}
              <div className={`absolute left-0 w-1 rounded-r-full bg-blue-500 transition-all duration-200 ${
                  isActive ? 'h-8 opacity-100' : 'h-0 opacity-0'
              } -ml-3`} />

              {/* Icon Container */}
              <div className={`relative transition-transform duration-200 ${
                  isActive ? 'scale-105' : 'group-hover:scale-105'
              }`}>
                  {/* Glow Effect using Shadow instead of Blur Filter for performance */}
                  <div className={`absolute inset-0 rounded-full transition-opacity duration-200 ${
                      isActive ? 'opacity-100 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'opacity-0'
                  }`} />
                  <Icon size={24} className={`relative z-10 ${isActive ? 'text-blue-400' : ''}`} />
              </div>
              
              {/* Text Label - Always Visible */}
              <span className={`ml-4 font-medium whitespace-nowrap text-left ${isActive ? 'text-blue-100' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Footer / Version */}
      <div className="p-6 border-t border-slate-700/30">
          <div className="text-xs text-slate-500 text-center">
              v0.1.0-alpha
          </div>
      </div>
    </div>
  );
};

export default Sidebar;
