import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, BookOpen, FlaskConical } from 'lucide-react';
import SparklingList from './SparklingList';
import GuidePage from './GuidePage';

type LabTab = 'sparkling' | 'guide';

interface SparkLabProps {
  defaultTab?: LabTab;
}

const SparkLab: React.FC<SparkLabProps> = ({ defaultTab }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<LabTab>(defaultTab || 'sparkling');

  React.useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab);
  }, [defaultTab]);

  const tabs: { id: LabTab; icon: typeof Sparkles; labelKey: string }[] = [
    { id: 'sparkling', icon: Sparkles, labelKey: 'nav.sparkling_list' },
    { id: 'guide', icon: BookOpen, labelKey: 'nav.guide' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 border-b border-slate-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-1 p-2">
          <FlaskConical size={18} className="text-primary ml-2 mr-1" />
          <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mr-3">Spark Lab</span>
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
        {activeTab === 'sparkling' && <SparklingList />}
        {activeTab === 'guide' && <GuidePage />}
      </div>
    </div>
  );
};

export default SparkLab;
