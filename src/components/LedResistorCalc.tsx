import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lightbulb } from 'lucide-react';

// Forward current presets (mA): value, range label
const IF_PRESETS: { id: string; value: number; range: string }[] = [
  { id: 'dim', value: 0.2, range: '0.1~0.3' },
  { id: 'weak', value: 0.75, range: '0.5~1' },
  { id: 'medium', value: 5, range: '3~8' },
  { id: 'bright', value: 12.5, range: '10~15' },
  { id: 'max', value: 20, range: '20' },
];

// Typical Vf range by LED color (V) + bg color for table row
const LED_VF_TABLE: { color: string; vfMin: number; vfMax: number; bg: string; text: string; border?: string }[] = [
  { color: 'red', vfMin: 1.8, vfMax: 2.1, bg: 'rgba(239,68,68,0.35)', text: 'rgb(127,29,29)' },
  { color: 'amber', vfMin: 2.0, vfMax: 2.2, bg: 'rgba(245,158,11,0.4)', text: 'rgb(120,53,15)' },
  { color: 'orange', vfMin: 1.9, vfMax: 2.2, bg: 'rgba(249,115,22,0.4)', text: 'rgb(124,45,18)' },
  { color: 'yellow', vfMin: 1.9, vfMax: 2.2, bg: 'rgba(234,179,8,0.45)', text: 'rgb(113,63,18)' },
  { color: 'green', vfMin: 2.0, vfMax: 3.1, bg: 'rgba(34,197,94,0.35)', text: 'rgb(20,83,45)' },
  { color: 'blue', vfMin: 3.0, vfMax: 3.7, bg: 'rgba(59,130,246,0.4)', text: 'rgb(30,58,138)' },
  { color: 'white', vfMin: 3.0, vfMax: 3.4, bg: 'rgba(248,250,252,0.95)', text: 'rgb(30,41,59)', border: 'rgba(148,163,184,0.5)' },
];

const LedResistorCalc: React.FC = () => {
  const { t } = useTranslation();
  const [vs, setVs] = useState<string>('5');
  const [vf, setVf] = useState<string>('2.0');
  const [ifmA, setIfmA] = useState<string>('20');
  const [count, setCount] = useState<string>('1');

  const vsNum = parseFloat(vs) || 0;
  const vfNum = parseFloat(vf) || 0;
  const ifNum = parseFloat(ifmA) || 0;
  const n = Math.max(1, parseInt(count, 10) || 1);

  let resistorOhms: number | null = null;
  let powerWatts: number | null = null;

  if (vsNum > 0 && vfNum >= 0 && ifNum > 0) {
    const vfTotal = n * vfNum;
    if (vsNum > vfTotal) {
      resistorOhms = (vsNum - vfTotal) / (ifNum / 1000);
      powerWatts = (ifNum / 1000) ** 2 * resistorOhms;
    }
  }

  const formatResistance = (r: number): string => {
    if (r >= 1e6) return `${(r / 1e6).toFixed(2)} MΩ`;
    if (r >= 1e3) return `${(r / 1e3).toFixed(2)} kΩ`;
    return `${Math.round(r)} Ω`;
  };

  const formatPower = (p: number): string => {
    if (p >= 1) return `${p.toFixed(2)} W`;
    if (p >= 0.001) return `${(p * 1000).toFixed(2)} mW`;
    return `${(p * 1e6).toFixed(2)} µW`;
  };

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto">
      <div className="bg-gradient-to-br from-cyan-50 to-emerald-50 dark:from-cyan-950/30 dark:to-emerald-950/30 p-6 rounded-2xl border-2 border-cyan-200/60 dark:border-cyan-800/50 shadow-lg max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center shadow-md">
            <Lightbulb size={22} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            {t('utilities.led_resistor')}
          </h3>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
          {t('utilities.led_resistor_desc')}
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400/90 mb-4">
          {t('utilities.led_resistor_hint')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t('utilities.led_vs')} (V)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={vs}
              onChange={(e) => setVs(e.target.value)}
              placeholder="5"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-400/50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t('utilities.led_vf')} (V)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={vf}
              onChange={(e) => setVf(e.target.value)}
              placeholder="2.0"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-400/50"
            />
            <div className="flex flex-wrap gap-1 mt-1.5">
              {LED_VF_TABLE.map(({ color, vfMin, vfMax }) => (
                <button
                  key={color}
                  onClick={() => setVf(((vfMin + vfMax) / 2).toFixed(1))}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors"
                >
                  {t(`utilities.led_color_${color}`)} {vfMin}-{vfMax}V
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t('utilities.led_if')} (mA)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="number"
                step="0.1"
                min="0.05"
                value={ifmA}
                onChange={(e) => setIfmA(e.target.value)}
                placeholder="20"
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-400/50"
              />
              <span className="flex items-center text-sm text-slate-500">mA</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {IF_PRESETS.map(({ id, value, range }) => {
                const isActive = Math.abs((parseFloat(ifmA) || 0) - value) < 0.02;
                return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setIfmA(value <= 1 ? value.toFixed(2) : value % 1 === 0 ? String(value) : value.toFixed(1))}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    isActive
                      ? 'bg-cyan-400 text-white border-cyan-500 dark:bg-cyan-500 dark:border-cyan-400'
                      : 'bg-white/80 dark:bg-slate-700/80 border-slate-200 dark:border-slate-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30'
                  }`}
                  title={t(`utilities.led_if_${id}_desc`)}
                >
                  <span className="font-medium">{t(`utilities.led_if_${id}`)}</span>
                  <span className="opacity-80 ml-1">({range})</span>
                </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              {t('utilities.led_count')}
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="1"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-400/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-slate-800/60 dark:bg-slate-900/80 border border-slate-300/50 dark:border-slate-600">
            <span className="text-xs text-slate-400 block mb-1">
              {t('utilities.led_r_result')}
            </span>
            <div className="text-xl font-bold text-cyan-500 dark:text-cyan-400 font-mono">
              = {resistorOhms != null ? formatResistance(resistorOhms) : '—'}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/60 dark:bg-slate-900/80 border border-slate-300/50 dark:border-slate-600">
            <span className="text-xs text-slate-400 block mb-1">
              {t('utilities.led_p_result')}
            </span>
            <div className="text-xl font-bold text-emerald-500 dark:text-emerald-400 font-mono">
              = {powerWatts != null ? formatPower(powerWatts) : '—'}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-cyan-200/50 dark:border-cyan-800/30 flex-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-2 font-medium">
              {t('utilities.led_formula')}
            </span>
            <code className="text-sm text-slate-700 dark:text-slate-300 block font-mono">
              R = (Vs − n×Vf) / If
            </code>
            <code className="text-xs text-slate-500 dark:text-slate-400 block mt-1 font-mono">
              P = I² × R
            </code>
          </div>
          <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-cyan-200/50 dark:border-cyan-800/30 flex-1 min-w-0 flex flex-col items-center justify-center">
            <span className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
              {t('utilities.led_circuit')}
            </span>
            <img
              src="/images/led-resistor-circuit.png"
              alt={t('utilities.led_circuit')}
              className="w-full max-w-[200px] h-auto object-contain"
            />
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-600/50">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-2">
            {t('utilities.led_vf_table')}
          </span>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-600">
                  <th className="text-left py-1.5 px-2">{t('utilities.led_table_color')}</th>
                  <th className="text-left py-1.5 px-2">{t('utilities.led_table_vf')}</th>
                </tr>
              </thead>
              <tbody>
                {LED_VF_TABLE.map(({ color, vfMin, vfMax, bg, text, border }) => (
                  <tr
                    key={color}
                    className="border-b border-slate-200/50 dark:border-slate-600/30 cursor-pointer transition-opacity hover:opacity-90"
                    style={{ backgroundColor: bg, color: text, ...(border && { borderLeft: `3px solid ${border}` }) }}
                    onClick={() => setVf(((vfMin + vfMax) / 2).toFixed(1))}
                  >
                    <td className="py-2 px-3 font-medium">{t(`utilities.led_color_${color}`)}</td>
                    <td className="py-2 px-3 font-mono">
                      {vfMin} ~ {vfMax} V
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LedResistorCalc;
