import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Lock, Unlock, RotateCcw } from 'lucide-react';

type ParamKey = 'V' | 'I' | 'R' | 'P';

interface ParamConfig {
  key: ParamKey;
  label: string;
  units: { label: string; factor: number }[];
  color: string;
  bgColor: string;
  borderColor: string;
}

const PARAMS: ParamConfig[] = [
  {
    key: 'V',
    label: 'ohm_voltage',
    units: [
      { label: 'mV', factor: 1e-3 },
      { label: 'V', factor: 1 },
      { label: 'kV', factor: 1e3 },
    ],
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-300 dark:border-amber-700',
  },
  {
    key: 'I',
    label: 'ohm_current',
    units: [
      { label: 'μA', factor: 1e-6 },
      { label: 'mA', factor: 1e-3 },
      { label: 'A', factor: 1 },
    ],
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-300 dark:border-blue-700',
  },
  {
    key: 'R',
    label: 'ohm_resistance',
    units: [
      { label: 'Ω', factor: 1 },
      { label: 'kΩ', factor: 1e3 },
      { label: 'MΩ', factor: 1e6 },
    ],
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-300 dark:border-green-700',
  },
  {
    key: 'P',
    label: 'ohm_power',
    units: [
      { label: 'μW', factor: 1e-6 },
      { label: 'mW', factor: 1e-3 },
      { label: 'W', factor: 1 },
      { label: 'kW', factor: 1e3 },
    ],
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-300 dark:border-red-700',
  },
];

function solveOhmsLaw(
  locked: [ParamKey, ParamKey],
  values: Record<ParamKey, number>
): Record<ParamKey, number | null> {
  const [a, b] = locked;
  const va = values[a];
  const vb = values[b];
  const result: Record<ParamKey, number | null> = { V: null, I: null, R: null, P: null };
  result[a] = va;
  result[b] = vb;

  if (va <= 0 || vb <= 0) return result;

  const pair = [a, b].sort().join('');

  switch (pair) {
    case 'IV': {
      const V = values.V, I = values.I;
      result.R = V / I;
      result.P = V * I;
      break;
    }
    case 'RV': {
      const V = values.V, R = values.R;
      result.I = V / R;
      result.P = (V * V) / R;
      break;
    }
    case 'PV': {
      const V = values.V, P = values.P;
      result.I = P / V;
      result.R = (V * V) / P;
      break;
    }
    case 'IR': {
      const I = values.I, R = values.R;
      result.V = I * R;
      result.P = I * I * R;
      break;
    }
    case 'IP': {
      const I = values.I, P = values.P;
      result.V = P / I;
      result.R = P / (I * I);
      break;
    }
    case 'PR': {
      const R = values.R, P = values.P;
      result.V = Math.sqrt(P * R);
      result.I = Math.sqrt(P / R);
      break;
    }
  }

  for (const k of ['V', 'I', 'R', 'P'] as ParamKey[]) {
    if (result[k] !== null && (!isFinite(result[k]!) || isNaN(result[k]!))) {
      result[k] = null;
    }
  }

  return result;
}

function formatSI(value: number, baseUnit: string): string {
  if (value === 0) return `0 ${baseUnit}`;
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toPrecision(4)} G${baseUnit}`;
  if (abs >= 1e6) return `${(value / 1e6).toPrecision(4)} M${baseUnit}`;
  if (abs >= 1e3) return `${(value / 1e3).toPrecision(4)} k${baseUnit}`;
  if (abs >= 1) return `${value.toPrecision(4)} ${baseUnit}`;
  if (abs >= 1e-3) return `${(value * 1e3).toPrecision(4)} m${baseUnit}`;
  if (abs >= 1e-6) return `${(value * 1e6).toPrecision(4)} μ${baseUnit}`;
  return `${value.toExponential(3)} ${baseUnit}`;
}

const BASE_UNITS: Record<ParamKey, string> = { V: 'V', I: 'A', R: 'Ω', P: 'W' };

const OhmsLawCalc: React.FC = () => {
  const { t } = useTranslation();
  const [locked, setLocked] = useState<ParamKey[]>(['V', 'I']);
  const [inputStrings, setInputStrings] = useState<Record<ParamKey, string>>({ V: '12', I: '100', R: '', P: '' });
  const [unitIndices, setUnitIndices] = useState<Record<ParamKey, number>>({ V: 1, I: 1, R: 0, P: 2 });

  const rawValues = useMemo(() => {
    const vals: Record<ParamKey, number> = { V: 0, I: 0, R: 0, P: 0 };
    for (const p of PARAMS) {
      const num = parseFloat(inputStrings[p.key]);
      if (!isNaN(num)) {
        vals[p.key] = num * p.units[unitIndices[p.key]].factor;
      }
    }
    return vals;
  }, [inputStrings, unitIndices]);

  const computed = useMemo(() => {
    if (locked.length !== 2) return { V: null, I: null, R: null, P: null };
    return solveOhmsLaw([locked[0], locked[1]], rawValues);
  }, [locked, rawValues]);

  const toggleLock = useCallback((key: ParamKey) => {
    setLocked((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      if (prev.length >= 2) {
        return [prev[1], key];
      }
      return [...prev, key];
    });
  }, []);

  const handleInputChange = (key: ParamKey, value: string) => {
    setInputStrings((prev) => ({ ...prev, [key]: value }));
  };

  const handleUnitChange = (key: ParamKey, idx: number) => {
    setUnitIndices((prev) => ({ ...prev, [key]: idx }));
  };

  const handleReset = () => {
    setInputStrings({ V: '', I: '', R: '', P: '' });
    setLocked(['V', 'I']);
    setUnitIndices({ V: 1, I: 1, R: 0, P: 2 });
  };

  const getDisplayValue = (key: ParamKey): string => {
    if (locked.includes(key)) return inputStrings[key];
    const val = computed[key];
    if (val === null || val === undefined) return '';
    const unit = PARAMS.find((p) => p.key === key)!.units[unitIndices[key]];
    const displayed = val / unit.factor;
    if (Math.abs(displayed) < 1e-10) return '0';
    if (Math.abs(displayed) >= 1e9) return displayed.toExponential(3);
    return parseFloat(displayed.toPrecision(6)).toString();
  };

  const DIAGRAM_COLORS: Record<ParamKey, { fill: string; stroke: string; text: string }> = {
    V: { fill: '#fef3c7', stroke: '#f59e0b', text: '#92400e' },
    I: { fill: '#dbeafe', stroke: '#3b82f6', text: '#1e40af' },
    R: { fill: '#dcfce7', stroke: '#22c55e', text: '#166534' },
    P: { fill: '#fee2e2', stroke: '#ef4444', text: '#991b1b' },
  };

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto">
      <div className="bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 p-6 rounded-2xl border-2 border-violet-200/60 dark:border-violet-800/50 shadow-lg max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center shadow-md">
              <Zap size={22} className="text-white" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {t('utilities.ohm_title')}
            </h3>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all"
          >
            <RotateCcw size={14} />
            {t('utilities.ohm_reset')}
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          {t('utilities.ohm_description')}
        </p>

        {/* Input Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {PARAMS.map((param) => {
            const isLocked = locked.includes(param.key);
            const displayVal = getDisplayValue(param.key);

            return (
              <div
                key={param.key}
                className={`relative flex flex-col gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  isLocked
                    ? `${param.bgColor} ${param.borderColor} shadow-sm`
                    : 'bg-white/50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-bold uppercase tracking-wider ${isLocked ? param.color : 'text-slate-400 dark:text-slate-500'}`}>
                    {t(`utilities.${param.label}`)}
                  </label>
                  <button
                    onClick={() => toggleLock(param.key)}
                    className={`p-1 rounded-md transition-all ${
                      isLocked
                        ? `${param.color} bg-white/60 dark:bg-slate-800/40 shadow-sm`
                        : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400'
                    }`}
                    title={isLocked ? t('utilities.ohm_unlock') : t('utilities.ohm_lock')}
                  >
                    {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={isLocked ? inputStrings[param.key] : displayVal}
                    onChange={(e) => handleInputChange(param.key, e.target.value)}
                    readOnly={!isLocked}
                    className={`flex-1 font-mono text-sm px-3 py-2 rounded-lg border transition-all ${
                      isLocked
                        ? `border-${param.borderColor.split('-')[1]}-200 dark:border-${param.borderColor.split('-')[1]}-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500`
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-default'
                    }`}
                    placeholder={isLocked ? '0' : '—'}
                  />
                  <select
                    value={unitIndices[param.key]}
                    onChange={(e) => handleUnitChange(param.key, Number(e.target.value))}
                    className="font-mono text-sm px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-w-[60px]"
                  >
                    {param.units.map((u, i) => (
                      <option key={u.label} value={i}>{u.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {/* Results Summary */}
        {locked.length === 2 && (
          <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-violet-200/50 dark:border-violet-800/30 mb-6">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-2 font-medium">
              {t('utilities.ohm_results')}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PARAMS.map((param) => {
                const val = locked.includes(param.key) ? rawValues[param.key] : computed[param.key];
                return (
                  <div key={param.key} className="text-center">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${param.color}`}>
                      {param.key}
                    </span>
                    <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {val !== null && val !== undefined && isFinite(val)
                        ? formatSI(val, BASE_UNITS[param.key])
                        : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ohm's Law Diagram */}
        <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-violet-200/30 dark:border-violet-800/20">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-3 font-medium">
            {t('utilities.ohm_diagram')}
          </span>
          <div className="flex justify-center">
            <svg viewBox="0 0 300 300" className="w-full max-w-[280px]">
              <defs>
                <filter id="ohmShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
                </filter>
              </defs>

              {/* Outer circle */}
              <circle cx="150" cy="150" r="140" fill="none" stroke="#e2e8f0" strokeWidth="2" className="dark:stroke-slate-700" />

              {/* Dividing lines */}
              <line x1="150" y1="10" x2="150" y2="290" stroke="#e2e8f0" strokeWidth="1.5" className="dark:stroke-slate-700" />
              <line x1="10" y1="150" x2="290" y2="150" stroke="#e2e8f0" strokeWidth="1.5" className="dark:stroke-slate-700" />

              {/* V - top left */}
              <g filter="url(#ohmShadow)">
                <circle cx="80" cy="80" r="42" fill={DIAGRAM_COLORS.V.fill} stroke={locked.includes('V') ? DIAGRAM_COLORS.V.stroke : '#cbd5e1'} strokeWidth={locked.includes('V') ? 3 : 1.5} />
                <text x="80" y="74" textAnchor="middle" fontSize="22" fontWeight="bold" fill={DIAGRAM_COLORS.V.text} className="font-mono">V</text>
                <text x="80" y="93" textAnchor="middle" fontSize="10" fill={DIAGRAM_COLORS.V.text} opacity="0.7">{t('utilities.ohm_voltage')}</text>
              </g>

              {/* I - top right */}
              <g filter="url(#ohmShadow)">
                <circle cx="220" cy="80" r="42" fill={DIAGRAM_COLORS.I.fill} stroke={locked.includes('I') ? DIAGRAM_COLORS.I.stroke : '#cbd5e1'} strokeWidth={locked.includes('I') ? 3 : 1.5} />
                <text x="220" y="74" textAnchor="middle" fontSize="22" fontWeight="bold" fill={DIAGRAM_COLORS.I.text} className="font-mono">I</text>
                <text x="220" y="93" textAnchor="middle" fontSize="10" fill={DIAGRAM_COLORS.I.text} opacity="0.7">{t('utilities.ohm_current')}</text>
              </g>

              {/* R - bottom left */}
              <g filter="url(#ohmShadow)">
                <circle cx="80" cy="220" r="42" fill={DIAGRAM_COLORS.R.fill} stroke={locked.includes('R') ? DIAGRAM_COLORS.R.stroke : '#cbd5e1'} strokeWidth={locked.includes('R') ? 3 : 1.5} />
                <text x="80" y="214" textAnchor="middle" fontSize="22" fontWeight="bold" fill={DIAGRAM_COLORS.R.text} className="font-mono">R</text>
                <text x="80" y="233" textAnchor="middle" fontSize="10" fill={DIAGRAM_COLORS.R.text} opacity="0.7">{t('utilities.ohm_resistance')}</text>
              </g>

              {/* P - bottom right */}
              <g filter="url(#ohmShadow)">
                <circle cx="220" cy="220" r="42" fill={DIAGRAM_COLORS.P.fill} stroke={locked.includes('P') ? DIAGRAM_COLORS.P.stroke : '#cbd5e1'} strokeWidth={locked.includes('P') ? 3 : 1.5} />
                <text x="220" y="214" textAnchor="middle" fontSize="22" fontWeight="bold" fill={DIAGRAM_COLORS.P.text} className="font-mono">P</text>
                <text x="220" y="233" textAnchor="middle" fontSize="10" fill={DIAGRAM_COLORS.P.text} opacity="0.7">{t('utilities.ohm_power')}</text>
              </g>

              {/* Center formulas */}
              <text x="150" y="138" textAnchor="middle" fontSize="11" fill="#64748b" className="font-mono dark:fill-slate-400">V = I × R</text>
              <text x="150" y="155" textAnchor="middle" fontSize="11" fill="#64748b" className="font-mono dark:fill-slate-400">P = V × I</text>
              <text x="150" y="172" textAnchor="middle" fontSize="11" fill="#64748b" className="font-mono dark:fill-slate-400">P = I² × R</text>
            </svg>
          </div>
        </div>

        {/* Formulas Reference */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { formula: 'V = I × R', desc: 'ohm_formula_vir' },
            { formula: 'I = V / R', desc: 'ohm_formula_ivr' },
            { formula: 'R = V / I', desc: 'ohm_formula_rvi' },
            { formula: 'P = V × I', desc: 'ohm_formula_pvi' },
            { formula: 'P = I² × R', desc: 'ohm_formula_pir' },
            { formula: 'P = V² / R', desc: 'ohm_formula_pvr' },
          ].map(({ formula, desc }) => (
            <div key={desc} className="px-3 py-2 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-slate-200/40 dark:border-slate-700/40">
              <div className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{formula}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{t(`utilities.${desc}`)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OhmsLawCalc;
