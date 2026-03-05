import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';

const RcTimeConstantCalc: React.FC = () => {
  const { t } = useTranslation();
  const [rcR, setRcR] = useState(10);
  const [rcROhm, setRcROhm] = useState<'ohm' | 'kohm' | 'Mohm'>('kohm');
  const [rcC, setRcC] = useState(0.1);
  const [rcCF, setRcCF] = useState<'pF' | 'nF' | 'uF' | 'mF' | 'F'>('uF');

  const rMult = rcROhm === 'ohm' ? 1 : rcROhm === 'kohm' ? 1e3 : 1e6;
  const cMult = rcCF === 'pF' ? 1e-12 : rcCF === 'nF' ? 1e-9 : rcCF === 'uF' ? 1e-6 : rcCF === 'mF' ? 1e-3 : 1;
  const rVal = rcR * rMult;
  const cVal = rcC * cMult;

  const formatTau = () => {
    if (rVal <= 0 || cVal <= 0) return '—';
    const tauSec = rVal * cVal;
    if (tauSec >= 1) return `${tauSec.toFixed(4)} s`;
    if (tauSec >= 1e-3) return `${(tauSec * 1e3).toFixed(4)} ms`;
    if (tauSec >= 1e-6) return `${(tauSec * 1e6).toFixed(4)} µs`;
    return `${(tauSec * 1e9).toFixed(4)} ns`;
  };

  const formatFc = () => {
    if (rVal <= 0 || cVal <= 0) return '—';
    const fc = 1 / (2 * Math.PI * rVal * cVal);
    if (fc >= 1e6) return `${(fc / 1e6).toFixed(4)} MHz`;
    if (fc >= 1e3) return `${(fc / 1e3).toFixed(4)} kHz`;
    return `${fc.toFixed(4)} Hz`;
  };

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg max-w-2xl">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
          <Clock size={20} />
          {t('utilities.rc_time_constant')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {t('utilities.rc_desc')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('utilities.rc_r')}</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                value={rcR}
                onChange={(e) => setRcR(parseFloat(e.target.value) || 0)}
                className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={rcROhm}
                onChange={(e) => setRcROhm(e.target.value as any)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm w-20"
              >
                <option value="ohm">Ω</option>
                <option value="kohm">kΩ</option>
                <option value="Mohm">MΩ</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{t('utilities.rc_c')}</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                value={rcC}
                onChange={(e) => setRcC(parseFloat(e.target.value) || 0)}
                className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={rcCF}
                onChange={(e) => setRcCF(e.target.value as any)}
                className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm w-20"
              >
                <option value="pF">pF</option>
                <option value="nF">nF</option>
                <option value="uF">µF</option>
                <option value="mF">mF</option>
                <option value="F">F</option>
              </select>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">τ (tau)</label>
            <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-primary">
              {formatTau()}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">fc (-3dB)</label>
            <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-primary">
              {formatFc()}
            </div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-900/50 rounded-lg text-xs text-slate-600 dark:text-slate-400 font-mono">
          τ = R × C · fc = 1/(2πRC)
        </div>
      </div>
    </div>
  );
};

export default RcTimeConstantCalc;
