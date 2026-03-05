import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Battery } from 'lucide-react';

interface BatteryPreset {
  name: string;
  capacity: number;
}

const BATTERY_PRESETS: BatteryPreset[] = [
  { name: 'CR2032', capacity: 220 },
  { name: '18650', capacity: 2600 },
  { name: 'LiPo 3.7V 1000mAh', capacity: 1000 },
  { name: 'AA (2500mAh)', capacity: 2500 },
];

function formatDuration(hours: number, t: (k: string) => string): string {
  if (!isFinite(hours) || hours <= 0) return '—';
  if (hours < 1) return `${(hours * 60).toFixed(1)} ${t('utilities.bat_unit_min')}`;
  if (hours < 48) return `${hours.toFixed(1)} ${t('utilities.bat_unit_hours')}`;
  const days = hours / 24;
  if (days < 60) return `${days.toFixed(1)} ${t('utilities.bat_unit_days')}`;
  const months = days / 30;
  if (months < 24) return `${months.toFixed(1)} ${t('utilities.bat_unit_months')}`;
  return `${(days / 365).toFixed(1)} ${t('utilities.bat_unit_years')}`;
}

const BatteryLifeCalc: React.FC = () => {
  const { t } = useTranslation();
  const [capacity, setCapacity] = useState<string>('1000');
  const [current, setCurrent] = useState<string>('20');
  const [efficiency, setEfficiency] = useState<string>('85');
  const [selfDischarge, setSelfDischarge] = useState<string>('3');

  const capVal = parseFloat(capacity) || 0;
  const curVal = parseFloat(current) || 0;
  const effVal = Math.min(100, Math.max(0, parseFloat(efficiency) || 0)) / 100;
  const sdVal = Math.min(100, Math.max(0, parseFloat(selfDischarge) || 0)) / 100;

  const results = useMemo(() => {
    if (capVal <= 0 || curVal <= 0) return null;
    const theoretical = capVal / curVal;
    const actual = theoretical * effVal;

    let adjusted = actual;
    if (sdVal > 0) {
      const monthlyRetention = 1 - sdVal;
      const hourlyRetention = Math.pow(monthlyRetention, 1 / (30 * 24));
      const effectiveCapacity = capVal * effVal;
      let remaining = effectiveCapacity;
      let h = 0;
      while (remaining > 0 && h < 1e6) {
        const step = Math.min(24, remaining / curVal);
        if (step <= 0) break;
        remaining -= curVal * step;
        remaining *= Math.pow(hourlyRetention, step);
        h += step;
        if (remaining < 0.01) break;
      }
      adjusted = h;
    }

    return { theoretical, actual, adjusted };
  }, [capVal, curVal, effVal, sdVal]);

  const timelineData = useMemo(() => {
    if (!results || capVal <= 0 || curVal <= 0) return [];
    const totalHours = results.adjusted;
    const steps = 20;
    const stepSize = totalHours / steps;
    const monthlyRetention = 1 - sdVal;
    const hourlyRetention = sdVal > 0 ? Math.pow(monthlyRetention, 1 / (30 * 24)) : 1;
    const effectiveCapacity = capVal * effVal;

    const points: { pct: number; hour: number }[] = [{ pct: 100, hour: 0 }];
    let remaining = effectiveCapacity;

    for (let i = 1; i <= steps; i++) {
      const dt = stepSize;
      remaining -= curVal * dt;
      remaining *= Math.pow(hourlyRetention, dt);
      const pct = Math.max(0, (remaining / effectiveCapacity) * 100);
      points.push({ pct, hour: i * stepSize });
    }
    return points;
  }, [results, capVal, curVal, effVal, sdVal]);

  const applyPreset = (preset: BatteryPreset) => {
    setCapacity(String(preset.capacity));
  };

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto">
      <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950/30 dark:to-teal-950/30 p-6 rounded-2xl border-2 border-green-200/60 dark:border-green-800/50 shadow-lg max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-teal-400 flex items-center justify-center shadow-md">
            <Battery size={22} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {t('utilities.bat_title')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('utilities.bat_desc')}</p>
          </div>
        </div>

        {/* Presets */}
        <div className="mb-4">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-2">
            {t('utilities.bat_presets')}
          </span>
          <div className="flex flex-wrap gap-2">
            {BATTERY_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  capacity === String(p.capacity)
                    ? 'bg-green-500 text-white border-green-500 shadow-md'
                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20'
                }`}
              >
                {p.name} ({p.capacity}mAh)
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
              {t('utilities.bat_capacity')} (mAh)
            </label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              min="0"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
              {t('utilities.bat_current')} (mA)
            </label>
            <input
              type="number"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              min="0"
              step="0.1"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
              {t('utilities.bat_efficiency')} (%)
            </label>
            <input
              type="number"
              value={efficiency}
              onChange={(e) => setEfficiency(e.target.value)}
              min="0"
              max="100"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
              {t('utilities.bat_self_discharge')} (%/{t('utilities.bat_per_month')})
            </label>
            <input
              type="number"
              value={selfDischarge}
              onChange={(e) => setSelfDischarge(e.target.value)}
              min="0"
              max="100"
              step="0.1"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-green-500/50 focus:border-green-500"
            />
          </div>
        </div>

        {/* Formula */}
        <div className="mb-4 p-3 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-green-200/40 dark:border-green-800/30">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">
            {t('utilities.bat_formula')}
          </span>
          <div className="text-xs font-mono text-slate-600 dark:text-slate-400 space-y-0.5">
            <div>{t('utilities.bat_formula_theoretical')} = {t('utilities.bat_capacity')} / {t('utilities.bat_current')}</div>
            <div>{t('utilities.bat_formula_actual')} = {t('utilities.bat_formula_theoretical')} × {t('utilities.bat_efficiency')}</div>
          </div>
        </div>

        {/* Results */}
        {results && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-green-200/50 dark:border-green-800/30 text-center">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
                {t('utilities.bat_theoretical')}
              </span>
              <div className="text-lg font-bold text-green-600 dark:text-green-400 font-mono">
                {formatDuration(results.theoretical, t)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-green-200/50 dark:border-green-800/30 text-center">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
                {t('utilities.bat_actual')}
              </span>
              <div className="text-lg font-bold text-teal-600 dark:text-teal-400 font-mono">
                {formatDuration(results.actual, t)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-green-200/50 dark:border-green-800/30 text-center">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
                {t('utilities.bat_adjusted')}
              </span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {formatDuration(results.adjusted, t)}
              </div>
            </div>
          </div>
        )}

        {/* Battery Timeline Visualization */}
        {timelineData.length > 1 && results && (
          <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-green-200/50 dark:border-green-800/30">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-3">
              {t('utilities.bat_timeline')}
            </span>
            <div className="flex items-end gap-[2px] h-24">
              {timelineData.map((pt, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all"
                  style={{
                    height: `${Math.max(2, pt.pct)}%`,
                    background: pt.pct > 50
                      ? `linear-gradient(to top, #22c55e, #4ade80)`
                      : pt.pct > 20
                        ? `linear-gradient(to top, #eab308, #facc15)`
                        : `linear-gradient(to top, #ef4444, #f87171)`,
                    opacity: 0.7 + (pt.pct / 100) * 0.3,
                  }}
                  title={`${formatDuration(pt.hour, t)}: ${pt.pct.toFixed(0)}%`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-slate-400">0</span>
              <span className="text-[10px] text-slate-400">
                {formatDuration(results.adjusted, t)}
              </span>
            </div>
            {/* Battery icon visualization */}
            <div className="flex items-center justify-center mt-3 gap-2">
              <div className="relative w-48 h-8 rounded-md border-2 border-slate-400 dark:border-slate-500 bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-[6px] h-3 rounded-r bg-slate-400 dark:bg-slate-500" />
                <div
                  className="h-full rounded-sm transition-all duration-500"
                  style={{
                    width: `${Math.max(2, timelineData[timelineData.length - 1]?.pct ?? 0)}%`,
                    background:
                      (timelineData[timelineData.length - 1]?.pct ?? 0) > 50
                        ? '#22c55e'
                        : (timelineData[timelineData.length - 1]?.pct ?? 0) > 20
                          ? '#eab308'
                          : '#ef4444',
                  }}
                />
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                → 0%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatteryLifeCalc;
