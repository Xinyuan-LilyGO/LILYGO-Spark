import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator } from 'lucide-react';

const RegulatorCalc: React.FC = () => {
  const { t } = useTranslation();
  const [vref, setVref] = useState(1.25);
  const [vout, setVout] = useState(3.3);
  const [r1, setR1] = useState(240);

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg max-w-2xl">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <Calculator size={20} />
          {t('utilities.regulator_resistor')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {t('utilities.regulator_desc')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('utilities.regulator_vref')}</label>
            <input
              type="number"
              step="0.01"
              value={vref}
              onChange={(e) => setVref(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('utilities.regulator_vout')}</label>
            <input
              type="number"
              step="0.01"
              value={vout}
              onChange={(e) => setVout(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('utilities.regulator_r1')}</label>
            <input
              type="number"
              value={r1}
              onChange={(e) => setR1(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('utilities.regulator_r2')}</label>
            <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-primary">
              {vref > 0 && r1 > 0 && vout >= vref
                ? (() => {
                    const r2 = r1 * (vout / vref - 1);
                    return r2 > 0 ? `${r2.toFixed(1)} Ω` : '—';
                  })()
                : '—'}
            </div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-900/50 rounded-lg text-xs text-slate-600 dark:text-slate-400">
          <div className="font-mono">Vout = Vref × (1 + R2/R1) → R2 = R1 × (Vout/Vref − 1)</div>
          <div className="mt-1.5 text-slate-500 dark:text-slate-500">
            {t('utilities.regulator_iadj_note')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegulatorCalc;
