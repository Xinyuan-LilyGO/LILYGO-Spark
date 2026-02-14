import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Zap, LayoutGrid, Download, Wrench, ExternalLink, Target, ArrowRight, Github } from 'lucide-react';

const GuidePage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-900 overflow-hidden">
      <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full flex-1 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
            <BookOpen size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('guide.title')}
            </h1>
            <p className="text-slate-500 dark:text-zinc-400 mt-0.5">
              {t('guide.subtitle')}
            </p>
          </div>
        </div>

        {/* Purpose */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
            <Target size={20} className="text-primary" />
            {t('guide.purpose_title')}
          </h2>
          <div className="bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm">
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {t('guide.purpose_text')}
            </p>
            <ul className="mt-4 space-y-2 text-slate-600 dark:text-slate-400 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{t('guide.purpose_1')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{t('guide.purpose_2')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{t('guide.purpose_3')}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Quick Start */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
            <Zap size={20} className="text-primary" />
            {t('guide.quick_start_title')}
          </h2>
          <div className="space-y-6">
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <LayoutGrid size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-1">
                  {t('guide.step1_title')}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t('guide.step1_desc')}
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <ArrowRight size={20} className="text-slate-400 rotate-90 sm:rotate-0" />
            </div>
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Zap size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-1">
                  {t('guide.step2_title')}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t('guide.step2_desc')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* All Features */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
            {t('guide.features_title')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 hover:border-primary/30 transition-colors">
              <LayoutGrid size={22} className="text-primary mb-2" />
              <h3 className="font-medium text-slate-800 dark:text-slate-200">{t('nav.firmware')}</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{t('guide.feature_firmware')}</p>
            </div>
            <div className="bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 hover:border-primary/30 transition-colors">
              <Zap size={22} className="text-primary mb-2" />
              <h3 className="font-medium text-slate-800 dark:text-slate-200">{t('nav.burner')}</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{t('guide.feature_burner')}</p>
            </div>
            <div className="bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 hover:border-primary/30 transition-colors">
              <Download size={22} className="text-primary mb-2" />
              <h3 className="font-medium text-slate-800 dark:text-slate-200">{t('nav.dumper')}</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{t('guide.feature_dumper')}</p>
            </div>
            <div className="bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 hover:border-primary/30 transition-colors">
              <Wrench size={22} className="text-primary mb-2" />
              <h3 className="font-medium text-slate-800 dark:text-slate-200">{t('nav.utilities')}</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{t('guide.feature_utilities')}</p>
            </div>
          </div>
        </section>

        {/* For Developers */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-4">
            <Github size={20} className="text-primary" />
            {t('guide.for_developers_title')}
          </h2>
          <div className="bg-slate-100 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-2xl p-5">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              {t('guide.for_developers_desc')}
            </p>
            <div className="flex flex-wrap gap-3 mb-4">
              <a
                href="https://github.com/Xinyuan-LilyGO/LILYGO-Spark"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 text-sm text-primary hover:bg-primary/10 transition-colors"
              >
                {t('guide.link_repo')} <ExternalLink size={14} />
              </a>
              <a
                href="https://github.com/Xinyuan-LilyGO/LILYGO-Spark/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 text-sm text-primary hover:bg-primary/10 transition-colors"
              >
                {t('guide.link_releases')} <ExternalLink size={14} />
              </a>
            </div>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>• {t('guide.for_developers_1')}</li>
              <li>• {t('guide.for_developers_2')}</li>
              <li>• {t('guide.for_developers_3')}</li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-zinc-700 text-center">
          <p className="text-sm text-slate-500 dark:text-zinc-500">
            {t('guide.open_source')}{' '}
            <a
              href="https://github.com/Xinyuan-LilyGO/LILYGO-Spark"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              {t('guide.open_source_link')} <ExternalLink size={12} />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default GuidePage;
