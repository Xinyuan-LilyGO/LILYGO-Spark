import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Download, Search, FileCode } from 'lucide-react';
import Burner from './Burner';
import FirmwareDumper from './FirmwareDumper';
import FirmwareUtilities from './FirmwareUtilities';

type ToolTab = 'burner' | 'dumper' | 'analyzer' | 'editor';

const FirmwareToolsPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ToolTab>('burner');

  const tabs: { id: ToolTab; icon: typeof Zap; labelKey: string }[] = [
    { id: 'burner', icon: Zap, labelKey: 'nav.burner' },
    { id: 'dumper', icon: Download, labelKey: 'nav.dumper' },
    { id: 'analyzer', icon: Search, labelKey: 'utilities.analyzer' },
    { id: 'editor', icon: FileCode, labelKey: 'utilities.partition_editor' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 border-b border-slate-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex gap-1 p-2">
          {tabs.map(({ id, icon: Icon, labelKey }) => (
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
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'burner' && <Burner />}
        {activeTab === 'dumper' && <FirmwareDumper />}
        {activeTab === 'analyzer' && <FirmwareUtilities mode="analyzer" />}
        {activeTab === 'editor' && <FirmwareUtilities mode="editor" />}
      </div>
    </div>
  );
};

export default FirmwareToolsPage;
