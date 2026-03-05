import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GitBranch, Plus, Trash2 } from 'lucide-react';

type ComponentType = 'resistor' | 'capacitor';
type ConnectionMode = 'series' | 'parallel';

interface ComponentEntry {
  id: number;
  value: string;
  unit: number;
}

const R_UNITS = [
  { label: 'Ω', factor: 1 },
  { label: 'kΩ', factor: 1e3 },
  { label: 'MΩ', factor: 1e6 },
];

const C_UNITS = [
  { label: 'pF', factor: 1e-12 },
  { label: 'nF', factor: 1e-9 },
  { label: 'µF', factor: 1e-6 },
  { label: 'mF', factor: 1e-3 },
];

function formatResistance(v: number): string {
  if (!isFinite(v) || v <= 0) return '—';
  if (v >= 1e6) return `${(v / 1e6).toPrecision(4)} MΩ`;
  if (v >= 1e3) return `${(v / 1e3).toPrecision(4)} kΩ`;
  return `${v.toPrecision(4)} Ω`;
}

function formatCapacitance(v: number): string {
  if (!isFinite(v) || v <= 0) return '—';
  if (v >= 1e-3) return `${(v / 1e-3).toPrecision(4)} mF`;
  if (v >= 1e-6) return `${(v / 1e-6).toPrecision(4)} µF`;
  if (v >= 1e-9) return `${(v / 1e-9).toPrecision(4)} nF`;
  return `${(v / 1e-12).toPrecision(4)} pF`;
}

let nextId = 1;
function makeEntry(unitIdx: number): ComponentEntry {
  return { id: nextId++, value: '', unit: unitIdx };
}

const SeriesParallelCalc: React.FC = () => {
  const { t } = useTranslation();
  const [compType, setCompType] = useState<ComponentType>('resistor');
  const [mode, setMode] = useState<ConnectionMode>('series');
  const [entries, setEntries] = useState<ComponentEntry[]>(() => [makeEntry(1), makeEntry(1)]);

  const units = compType === 'resistor' ? R_UNITS : C_UNITS;

  const handleTypeChange = (type: ComponentType) => {
    setCompType(type);
    const defaultUnit = type === 'resistor' ? 1 : 2;
    setEntries([makeEntry(defaultUnit), makeEntry(defaultUnit)]);
  };

  const updateEntry = (id: number, field: 'value' | 'unit', val: string | number) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: val } : e))
    );
  };

  const addEntry = () => {
    if (entries.length >= 10) return;
    const defaultUnit = compType === 'resistor' ? 1 : 2;
    setEntries((prev) => [...prev, makeEntry(defaultUnit)]);
  };

  const removeEntry = (id: number) => {
    if (entries.length <= 2) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const parsedValues = useMemo(() => {
    return entries.map((e) => {
      const num = parseFloat(e.value);
      if (isNaN(num) || num <= 0) return null;
      return num * units[e.unit].factor;
    });
  }, [entries, units]);

  const result = useMemo(() => {
    const valid = parsedValues.filter((v): v is number => v !== null && v > 0);
    if (valid.length < 2) return null;

    if (compType === 'resistor') {
      if (mode === 'series') {
        return valid.reduce((a, b) => a + b, 0);
      } else {
        const sum = valid.reduce((a, b) => a + 1 / b, 0);
        return sum > 0 ? 1 / sum : null;
      }
    } else {
      if (mode === 'series') {
        const sum = valid.reduce((a, b) => a + 1 / b, 0);
        return sum > 0 ? 1 / sum : null;
      } else {
        return valid.reduce((a, b) => a + b, 0);
      }
    }
  }, [parsedValues, compType, mode]);

  const formulaText = useMemo(() => {
    const sym = compType === 'resistor' ? 'R' : 'C';
    const isInverse =
      (compType === 'resistor' && mode === 'parallel') ||
      (compType === 'capacitor' && mode === 'series');
    if (isInverse) {
      return `1/${sym}_total = ${entries.map((_, i) => `1/${sym}${i + 1}`).join(' + ')}`;
    }
    return `${sym}_total = ${entries.map((_, i) => `${sym}${i + 1}`).join(' + ')}`;
  }, [compType, mode, entries.length]);

  const formatResult = compType === 'resistor' ? formatResistance : formatCapacitance;

  const validCount = parsedValues.filter((v) => v !== null && v > 0).length;

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto">
      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 p-6 rounded-2xl border-2 border-amber-200/60 dark:border-amber-800/50 shadow-lg max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md">
            <GitBranch size={22} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            {t('utilities.sp_title')}
          </h3>
        </div>

        {/* Component type tabs */}
        <div className="flex gap-2 mb-3 p-1.5 bg-white/60 dark:bg-slate-800/60 rounded-xl">
          {(['resistor', 'capacitor'] as const).map((tp) => (
            <button
              key={tp}
              onClick={() => handleTypeChange(tp)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                compType === tp
                  ? 'bg-amber-400 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
              }`}
            >
              {t(`utilities.sp_type_${tp}`)}
            </button>
          ))}
        </div>

        {/* Series / Parallel mode */}
        <div className="flex gap-2 mb-4 p-1.5 bg-white/60 dark:bg-slate-800/60 rounded-xl">
          {(['series', 'parallel'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                mode === m
                  ? 'bg-yellow-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
              }`}
            >
              {t(`utilities.sp_mode_${m}`)}
            </button>
          ))}
        </div>

        {/* Component entries */}
        <div className="flex flex-col gap-2 mb-4">
          {entries.map((entry, idx) => (
            <div key={entry.id} className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500 w-6 text-right">
                {compType === 'resistor' ? 'R' : 'C'}{idx + 1}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={entry.value}
                onChange={(e) => updateEntry(entry.id, 'value', e.target.value)}
                placeholder="0"
                className="flex-1 font-mono text-sm px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400"
              />
              <select
                value={entry.unit}
                onChange={(e) => updateEntry(entry.id, 'unit', Number(e.target.value))}
                className="font-mono text-sm px-2 py-2 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-w-[64px]"
              >
                {units.map((u, i) => (
                  <option key={u.label} value={i}>{u.label}</option>
                ))}
              </select>
              <button
                onClick={() => removeEntry(entry.id)}
                disabled={entries.length <= 2}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addEntry}
          disabled={entries.length >= 10}
          className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 disabled:opacity-40 disabled:cursor-not-allowed mb-4 transition-all"
        >
          <Plus size={16} />
          {t('utilities.sp_add')}
          <span className="text-xs text-slate-400 ml-1">({entries.length}/10)</span>
        </button>

        {/* SVG schematic */}
        <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl border border-amber-200/50 dark:border-amber-800/30 p-4 mb-4">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-2">{t('utilities.sp_schematic')}</span>
          <SchematicSvg mode={mode} count={validCount >= 2 ? validCount : entries.length} compType={compType} />
        </div>

        {/* Formula */}
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mb-2 px-1">
          {formulaText}
        </div>

        {/* Result */}
        <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-amber-200/50 dark:border-amber-800/30">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">{t('utilities.sp_result')}</span>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
            {result !== null ? formatResult(result) : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

interface SchematicSvgProps {
  mode: ConnectionMode;
  count: number;
  compType: ComponentType;
}

const SchematicSvg: React.FC<SchematicSvgProps> = ({ mode, count, compType }) => {
  const sym = compType === 'resistor' ? 'R' : 'C';
  const n = Math.max(2, Math.min(count, 10));

  if (mode === 'series') {
    const boxW = 50;
    const gap = 30;
    const totalW = n * boxW + (n - 1) * gap + 80;
    const h = 60;
    const y = 20;
    const boxH = 24;

    return (
      <svg viewBox={`0 0 ${totalW} ${h}`} className="w-full max-w-full" style={{ maxHeight: 80 }}>
        <line x1={0} y1={y + boxH / 2} x2={40} y2={y + boxH / 2} stroke="#94a3b8" strokeWidth={2} />
        {Array.from({ length: n }, (_, i) => {
          const x = 40 + i * (boxW + gap);
          return (
            <g key={i}>
              <rect x={x} y={y} width={boxW} height={boxH} rx={4} fill="#fbbf24" stroke="#d97706" strokeWidth={1.5} />
              <text x={x + boxW / 2} y={y + boxH / 2 + 4} textAnchor="middle" fontSize={11} fill="#78350f" fontWeight="bold">
                {sym}{i + 1}
              </text>
              {i < n - 1 && (
                <line x1={x + boxW} y1={y + boxH / 2} x2={x + boxW + gap} y2={y + boxH / 2} stroke="#94a3b8" strokeWidth={2} />
              )}
            </g>
          );
        })}
        <line x1={40 + (n - 1) * (boxW + gap) + boxW} y1={y + boxH / 2} x2={totalW} y2={y + boxH / 2} stroke="#94a3b8" strokeWidth={2} />
        <circle cx={4} cy={y + boxH / 2} r={4} fill="#94a3b8" />
        <circle cx={totalW - 4} cy={y + boxH / 2} r={4} fill="#94a3b8" />
      </svg>
    );
  }

  // Parallel
  const boxW = 50;
  const boxH = 24;
  const rowGap = 12;
  const totalH = n * (boxH + rowGap) - rowGap + 40;
  const totalW = 220;
  const busX1 = 50;
  const busX2 = 170;
  const startY = 20;

  return (
    <svg viewBox={`0 0 ${totalW} ${totalH}`} className="w-full max-w-full" style={{ maxHeight: 300 }}>
      <line x1={0} y1={startY + (totalH - 40) / 2} x2={busX1} y2={startY + (totalH - 40) / 2} stroke="#94a3b8" strokeWidth={2} />
      <line x1={busX2} y1={startY + (totalH - 40) / 2} x2={totalW} y2={startY + (totalH - 40) / 2} stroke="#94a3b8" strokeWidth={2} />
      <line x1={busX1} y1={startY} x2={busX1} y2={startY + n * (boxH + rowGap) - rowGap} stroke="#94a3b8" strokeWidth={2} />
      <line x1={busX2} y1={startY} x2={busX2} y2={startY + n * (boxH + rowGap) - rowGap} stroke="#94a3b8" strokeWidth={2} />
      {Array.from({ length: n }, (_, i) => {
        const cy = startY + i * (boxH + rowGap) + boxH / 2;
        const bx = (busX1 + busX2) / 2 - boxW / 2;
        return (
          <g key={i}>
            <line x1={busX1} y1={cy} x2={bx} y2={cy} stroke="#94a3b8" strokeWidth={2} />
            <rect x={bx} y={cy - boxH / 2} width={boxW} height={boxH} rx={4} fill="#fbbf24" stroke="#d97706" strokeWidth={1.5} />
            <text x={bx + boxW / 2} y={cy + 4} textAnchor="middle" fontSize={11} fill="#78350f" fontWeight="bold">
              {sym}{i + 1}
            </text>
            <line x1={bx + boxW} y1={cy} x2={busX2} y2={cy} stroke="#94a3b8" strokeWidth={2} />
          </g>
        );
      })}
      <circle cx={4} cy={startY + (totalH - 40) / 2} r={4} fill="#94a3b8" />
      <circle cx={totalW - 4} cy={startY + (totalH - 40) / 2} r={4} fill="#94a3b8" />
    </svg>
  );
};

export default SeriesParallelCalc;
