import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleDot } from 'lucide-react';

type BandCount = 4 | 5 | 6;
type ColorId = 'black' | 'brown' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'grey' | 'white' | 'gold' | 'silver';

const COLOR_MAP: Record<ColorId, { hex: string; digit?: number; mult?: number; tol?: number; ppm?: number }> = {
  black: { hex: '#1a1a1a', digit: 0, mult: 1 },
  brown: { hex: '#8B4513', digit: 1, mult: 10, tol: 1, ppm: 100 },
  red: { hex: '#DC143C', digit: 2, mult: 100, tol: 2, ppm: 50 },
  orange: { hex: '#FF8C00', digit: 3, mult: 1000, tol: 0, ppm: 15 },
  yellow: { hex: '#F4C430', digit: 4, mult: 10000, ppm: 25 },
  green: { hex: '#228B22', digit: 5, mult: 100000, tol: 0.5, ppm: 20 },
  blue: { hex: '#1E90FF', digit: 6, mult: 1000000, tol: 0.25, ppm: 10 },
  violet: { hex: '#9400D3', digit: 7, mult: 10000000, tol: 0.1, ppm: 5 },
  grey: { hex: '#808080', digit: 8, mult: 100000000, tol: 0.05, ppm: 1 },
  white: { hex: '#F5F5F5', digit: 9, mult: 1000000000 },
  gold: { hex: '#D4AF37', mult: 0.1, tol: 5 },
  silver: { hex: '#C0C0C0', mult: 0.01, tol: 10 },
};

const DIGIT_COLORS: ColorId[] = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'];
const MULTIPLIER_COLORS: ColorId[] = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white', 'gold', 'silver'];
const TOLERANCE_COLORS: ColorId[] = ['brown', 'red', 'green', 'blue', 'violet', 'grey', 'gold', 'silver'];
const PPM_COLORS: ColorId[] = ['brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey'];

const DEFAULT_4: ColorId[] = ['brown', 'black', 'red', 'gold'];
const DEFAULT_5: ColorId[] = ['brown', 'black', 'black', 'red', 'brown'];
const DEFAULT_6: ColorId[] = ['brown', 'black', 'black', 'red', 'brown', 'brown'];

function formatOhms(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} GΩ`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} MΩ`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)} kΩ`;
  return `${v.toFixed(2)} Ω`;
}

function formatMult(m: number): string {
  if (m >= 1e9) return '×1 GΩ';
  if (m >= 1e6) return '×1 MΩ';
  if (m >= 1e5) return '×100 kΩ';
  if (m >= 1e4) return '×10 kΩ';
  if (m >= 1e3) return '×1 kΩ';
  if (m >= 100) return '×100 Ω';
  if (m >= 10) return '×10 Ω';
  if (m >= 1) return '×1 Ω';
  if (m >= 0.1) return '×0.1 Ω';
  return '×0.01 Ω';
}

const ResistorColorCodeCalc: React.FC = () => {
  const { t } = useTranslation();
  const [bandCount, setBandCount] = useState<BandCount>(5);
  const [bands, setBands] = useState<ColorId[]>(() => DEFAULT_5);

  const updateBand = (idx: number, c: ColorId) => {
    setBands((b) => {
      const n = [...b];
      n[idx] = c;
      return n;
    });
  };

  React.useEffect(() => {
    if (bandCount === 4) setBands(DEFAULT_4);
    else if (bandCount === 5) setBands(DEFAULT_5);
    else setBands(DEFAULT_6);
  }, [bandCount]);

  const { valueOhms, tolerance, ppm, labels } = useMemo((): {
    valueOhms: number;
    tolerance: number;
    ppm: number;
    labels: string[];
  } => {
    const sigDigits = bandCount === 4 ? 2 : 3;
    let sig = 0;
    for (let i = 0; i < sigDigits; i++) {
      const d = COLOR_MAP[bands[i]]?.digit;
      if (d === undefined) return { valueOhms: 0, tolerance: 0, ppm: 0, labels: [] };
      sig = sig * 10 + d;
    }
    const multIdx = bandCount === 4 ? 2 : 3;
    const mult = COLOR_MAP[bands[multIdx]]?.mult ?? 1;
    const tolIdx = bandCount === 4 ? 3 : 4;
    const tol = COLOR_MAP[bands[tolIdx]]?.tol ?? 0;
    const val = sig * mult;
    const lab: string[] = [];
    for (let i = 0; i < sigDigits; i++) lab.push(String(COLOR_MAP[bands[i]]?.digit ?? ''));
    lab.push(formatMult(mult));
    lab.push(`±${tol}%`);
    if (bandCount === 6) {
      const p = COLOR_MAP[bands[5]]?.ppm ?? 0;
      lab.push(`${p} ppm/K`);
      return { valueOhms: val, tolerance: tol, ppm: p, labels: lab };
    }
    return { valueOhms: val, tolerance: tol, ppm: 0, labels: lab };
  }, [bandCount, bands]);

  const bandColors = bands.map((c) => COLOR_MAP[c]?.hex ?? '#333');

  const renderBandSelect = (idx: number, options: ColorId[], label: string) => (
    <div key={idx}>
      <label className="block text-[10px] text-slate-500 dark:text-slate-400 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => updateBand(idx, c)}
            className={`w-6 h-6 rounded-full border-2 transition-all ${
              bands[idx] === c ? 'border-cyan-500 scale-110 ring-2 ring-cyan-200' : 'border-slate-300 dark:border-slate-600 hover:scale-105'
            }`}
            style={{ backgroundColor: COLOR_MAP[c].hex }}
            title={t(`resistor.color_${c}`)}
          />
        ))}
      </div>
    </div>
  );

  const sigCount = bandCount === 4 ? 2 : 3;
  const multIdx = bandCount === 4 ? 2 : 3;
  const tolIdx = bandCount === 4 ? 3 : 4;

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto">
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 p-6 rounded-2xl border-2 border-violet-200/60 dark:border-violet-800/50 shadow-lg max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-indigo-400 flex items-center justify-center shadow-md">
            <CircleDot size={22} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            {t('utilities.resistor_color_code')}
          </h3>
        </div>

        <div className="flex gap-2 mb-4 p-1.5 bg-white/60 dark:bg-slate-800/60 rounded-xl">
          {([4, 5, 6] as const).map((n) => (
            <button
              key={n}
              onClick={() => setBandCount(n)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                bandCount === n
                  ? 'bg-violet-400 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-violet-100 dark:hover:bg-violet-900/30'
              }`}
            >
              {n} {t('resistor.bands')}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex-1 space-y-4">
            {Array.from({ length: sigCount }, (_, i) =>
              renderBandSelect(i, DIGIT_COLORS, t('resistor.band_num', { n: i + 1 }))
            )}
            {renderBandSelect(multIdx, MULTIPLIER_COLORS, t('resistor.multiplier'))}
            {renderBandSelect(tolIdx, TOLERANCE_COLORS, t('resistor.tolerance'))}
            {bandCount === 6 && renderBandSelect(5, PPM_COLORS, t('resistor.temp_coef'))}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center">
            <ResistorSvg bands={bandColors} bandCount={bandCount} labels={labels} />
            <div className="mt-4 p-4 rounded-xl bg-slate-800/60 dark:bg-slate-900/80 border border-violet-200/50 dark:border-violet-800/30 w-full text-center">
              <span className="text-xs text-slate-400 block mb-1">{t('resistor.result')}</span>
              <div className="text-xl font-bold text-violet-600 dark:text-violet-400 font-mono">
                {formatOhms(valueOhms)} ±{tolerance}%
                {bandCount === 6 && ppm > 0 && ` (${ppm} ppm/K)`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ResistorSvgProps {
  bands: string[];
  bandCount: number;
  labels: string[];
}

const ResistorSvg: React.FC<ResistorSvgProps> = ({ bands, bandCount, labels }) => {
  const w = 280;
  const h = 100;
  const bodyY = 35;
  const bodyH = 30;
  const bodyR = 15;
  const leadW = 25;
  const bodyW = w - 2 * leadW;
  const bandW = bodyW / bandCount;
  const bandGap = 1;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[320px] h-auto" aria-label="Resistor">
      <defs>
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#d4a574" />
          <stop offset="50%" stopColor="#c4956a" />
          <stop offset="100%" stopColor="#a67c52" />
        </linearGradient>
        <filter id="bodyShadow" x="-2" y="-2" width="104%" height="104%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.2" />
        </filter>
      </defs>
      <g transform={`translate(${leadW}, ${bodyY})`}>
        <rect
          x={0}
          y={0}
          width={bodyW}
          height={bodyH}
          rx={bodyR}
          ry={bodyR}
          fill="url(#bodyGrad)"
          filter="url(#bodyShadow)"
          stroke="#8b6914"
          strokeWidth="0.5"
        />
        {bands.map((color, i) => (
          <rect
            key={i}
            x={i * bandW + bandGap / 2}
            y={-2}
            width={bandW - bandGap}
            height={bodyH + 4}
            rx={2}
            ry={2}
            fill={color}
            stroke={color === '#F5F5F5' || color === '#C0C0C0' ? '#ccc' : 'none'}
            strokeWidth="0.5"
          />
        ))}
      </g>
      <line x1={0} y1={h / 2} x2={leadW} y2={h / 2} stroke="#8b6914" strokeWidth="4" strokeLinecap="round" />
      <line x1={w - leadW} y1={h / 2} x2={w} y2={h / 2} stroke="#8b6914" strokeWidth="4" strokeLinecap="round" />
      {labels.map((lb, i) => (
        <g key={i}>
          <line
            x1={leadW + (i + 0.5) * bandW}
            y1={bodyY + bodyH}
            x2={leadW + (i + 0.5) * bandW}
            y2={bodyY + bodyH + 18}
            stroke="#666"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
          <text
            x={leadW + (i + 0.5) * bandW}
            y={bodyY + bodyH + 28}
            textAnchor="middle"
            fontSize="9"
            fill="currentColor"
            className="text-slate-600 dark:text-slate-400"
          >
            {lb}
          </text>
        </g>
      ))}
    </svg>
  );
};

export default ResistorColorCodeCalc;
