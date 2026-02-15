import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleDot, Copy, Check } from 'lucide-react';

type BandCount = 4 | 5 | 6;
type ColorId = 'black' | 'brown' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'grey' | 'white' | 'gold' | 'silver';

const COLOR_MAP: Record<ColorId, { hex: string; digit?: number; mult?: number; tol?: number; ppm?: number; label: string }> = {
  black: { hex: '#262626', digit: 0, mult: 1, label: 'Black' },
  brown: { hex: '#783f04', digit: 1, mult: 10, tol: 1, ppm: 100, label: 'Brown' },
  red: { hex: '#ef4444', digit: 2, mult: 100, tol: 2, ppm: 50, label: 'Red' },
  orange: { hex: '#f97316', digit: 3, mult: 1000, tol: 0, ppm: 15, label: 'Orange' },
  yellow: { hex: '#eab308', digit: 4, mult: 10000, ppm: 25, label: 'Yellow' },
  green: { hex: '#22c55e', digit: 5, mult: 100000, tol: 0.5, ppm: 20, label: 'Green' },
  blue: { hex: '#3b82f6', digit: 6, mult: 1000000, tol: 0.25, ppm: 10, label: 'Blue' },
  violet: { hex: '#a855f7', digit: 7, mult: 10000000, tol: 0.1, ppm: 5, label: 'Violet' },
  grey: { hex: '#6b7280', digit: 8, mult: 100000000, tol: 0.05, ppm: 1, label: 'Grey' },
  white: { hex: '#f3f4f6', digit: 9, mult: 1000000000, label: 'White' },
  gold: { hex: '#eab308', mult: 0.1, tol: 5, label: 'Gold' },
  silver: { hex: '#94a3b8', mult: 0.01, tol: 10, label: 'Silver' },
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
  if (m >= 1e9) return 'x1G';
  if (m >= 1e6) return 'x1M';
  if (m >= 1e5) return 'x100k';
  if (m >= 1e4) return 'x10k';
  if (m >= 1e3) return 'x1k';
  if (m >= 100) return 'x100';
  if (m >= 10) return 'x10';
  if (m >= 1) return 'x1';
  if (m >= 0.1) return 'x0.1';
  return 'x0.01';
}

const ResistorColorCodeCalc: React.FC = () => {
  const { t } = useTranslation();
  const [bandCount, setBandCount] = useState<BandCount>(5);
  const [bands, setBands] = useState<ColorId[]>(() => DEFAULT_5);
  const [copied, setCopied] = useState(false);

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

  const { valueOhms, tolerance, ppm, labels, bandColorLabels, resultText } = useMemo(() => {
    const sigDigits = bandCount === 4 ? 2 : 3;
    let sig = 0;
    for (let i = 0; i < sigDigits; i++) {
      const d = COLOR_MAP[bands[i]]?.digit;
      if (d === undefined) return { valueOhms: 0, tolerance: 0, ppm: 0, labels: [], bandColorLabels: [], resultText: '' };
      sig = sig * 10 + d;
    }
    const multIdx = bandCount === 4 ? 2 : 3;
    const mult = COLOR_MAP[bands[multIdx]]?.mult ?? 1;
    const tolIdx = bandCount === 4 ? 3 : 4;
    const tol = COLOR_MAP[bands[tolIdx]]?.tol ?? 0;
    const val = sig * mult;
    
    const lab: string[] = [];
    const colorLab: string[] = [];
    for (let i = 0; i < sigDigits; i++) {
      lab.push(String(COLOR_MAP[bands[i]]?.digit ?? ''));
      colorLab.push(COLOR_MAP[bands[i]]?.label ?? '');
    }
    lab.push(formatMult(mult));
    colorLab.push(COLOR_MAP[bands[multIdx]]?.label ?? '');
    lab.push(`±${tol}%`);
    colorLab.push(COLOR_MAP[bands[tolIdx]]?.label ?? '');
    
    let result = `${formatOhms(val)} ±${tol}%`;
    let p = 0;
    if (bandCount === 6) {
      p = COLOR_MAP[bands[5]]?.ppm ?? 0;
      lab.push(`${p}ppm`);
      colorLab.push(COLOR_MAP[bands[5]]?.label ?? '');
      result += ` ${p}ppm`;
    }
    
    return { valueOhms: val, tolerance: tol, ppm: p, labels: lab, bandColorLabels: colorLab, resultText: result };
  }, [bandCount, bands]);

  const bandColors = bands.map((c) => COLOR_MAP[c]?.hex ?? '#333');

  const handleCopy = () => {
    navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderBandSelect = (idx: number, options: ColorId[], label: string, type: 'digit' | 'mult' | 'tol' | 'ppm') => {
    const selectedColor = bands[idx];
    const colorLabel = COLOR_MAP[selectedColor]?.label ?? '';
    let displayValue = '';
    if (type === 'digit') displayValue = String(COLOR_MAP[selectedColor]?.digit);
    else if (type === 'mult') displayValue = formatMult(COLOR_MAP[selectedColor]?.mult || 1);
    else if (type === 'tol') displayValue = `±${COLOR_MAP[selectedColor]?.tol}%`;
    else if (type === 'ppm') displayValue = `${COLOR_MAP[selectedColor]?.ppm}ppm`;

    return (
      <div key={idx} className="flex flex-col gap-2 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 overflow-visible">
        <div className="flex justify-between items-baseline">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{label}</label>
          <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            {displayValue}
            {colorLabel && <span className="ml-1.5 text-slate-500 dark:text-slate-400 font-normal">({colorLabel})</span>}
          </span>
        </div>
        <div className="flex-1 flex flex-nowrap gap-1.5 overflow-x-auto scrollbar-none py-1.5 px-1.5">
          {options.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => updateBand(idx, c)}
              className={`w-7 h-7 rounded-full border shadow-sm transition-all relative shrink-0 ${
                bands[idx] === c 
                  ? 'ring-2 ring-offset-1 ring-slate-400 dark:ring-slate-500 scale-110 z-10' 
                  : 'hover:scale-110 hover:z-10 opacity-90 hover:opacity-100'
              }`}
              style={{ backgroundColor: COLOR_MAP[c].hex, borderColor: 'rgba(0,0,0,0.1)' }}
              title={`${t(`resistor.color_${c}`)} (${c})`}
            >
              {bands[idx] === c && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-white/90 shadow-sm"></span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const sigCount = bandCount === 4 ? 2 : 3;
  const multIdx = bandCount === 4 ? 2 : 3;
  const tolIdx = bandCount === 4 ? 3 : 4;

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-hidden">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-6xl mx-auto w-full flex flex-col h-full max-h-full">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-500">
              <CircleDot size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {t('utilities.resistor_color_code')}
            </h3>
          </div>
          
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {([4, 5, 6] as const).map((n) => (
              <button
                key={n}
                onClick={() => setBandCount(n)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  bandCount === n
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {n} {t('resistor.bands')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-8 overflow-visible">
          {/* Left Column: Controls (Scrollable) */}
          <div className="flex flex-col gap-1 overflow-y-auto border-r border-slate-100 dark:border-slate-800 overflow-visible">
            {Array.from({ length: sigCount }, (_, i) =>
              renderBandSelect(i, DIGIT_COLORS, t('resistor.band_num', { n: i + 1 }), 'digit')
            )}
            {renderBandSelect(multIdx, MULTIPLIER_COLORS, t('resistor.multiplier'), 'mult')}
            {renderBandSelect(tolIdx, TOLERANCE_COLORS, t('resistor.tolerance'), 'tol')}
            {bandCount === 6 && renderBandSelect(5, PPM_COLORS, t('resistor.temp_coef'), 'ppm')}
          </div>

          {/* Right Column: Visual & Result (Sticky/Fixed) */}
          <div className="flex flex-col gap-6 justify-start pt-4">
            {/* Visual Representation */}
            <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 p-8 flex items-center justify-center min-h-[240px] relative overflow-visible shrink-0">
              <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" 
                   style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
              </div>
              <ResistorSvg bands={bandColors} bandCount={bandCount} labels={labels} bandColorLabels={bandColorLabels} />
            </div>

            {/* Result Box */}
            <div className="bg-slate-800 dark:bg-slate-950 rounded-xl p-8 text-center relative group border border-slate-700 shadow-xl shrink-0">
              <span className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">{t('resistor.result')}</span>
              <div className="text-4xl sm:text-5xl font-bold text-white font-mono tracking-tight flex items-center justify-center gap-3">
                {resultText}
              </div>
              <button 
                onClick={handleCopy}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                title="Copy Result"
              >
                {copied ? <Check size={20} className="text-emerald-400" /> : <Copy size={20} />}
              </button>
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
  bandColorLabels: string[];
}

const ResistorSvg: React.FC<ResistorSvgProps> = ({ bands, bandCount, labels, bandColorLabels }) => {
  const w = 500;
  const h = 160;
  
  // Dimensions
  const bodyW = 320;
  const bodyH = 90;
  const bodyX = (w - bodyW) / 2;
  const bodyY = (h - bodyH) / 2;
  const capW = 60; 
  const centerH = 80;
  const centerYOffset = (bodyH - centerH) / 2;
  
  // Calculate band positions
  // We want to center the group of bands on the resistor body.
  const positions: number[] = [];
  
  if (bandCount === 4) {
    // 4 Bands: [D1 D2 M] ...gap... [Tol]
    // Group 1 width approx: 3 bands * width + 2 spaces
    // Gap
    // Group 2 width: 1 band
    
    // Let's define centers relative to body center (w/2)
    // Total visual span approx 60% of body width
    const span = bodyW * 0.65;
    const start = bodyX + (bodyW - span) / 2;
    
    // Band 1, 2, 3
    positions.push(start);
    positions.push(start + 40);
    positions.push(start + 80);
    
    // Band 4 (Tolerance) - pushed to end
    positions.push(start + span);
  } else if (bandCount === 5) {
    // 5 Bands: [D1 D2 D3 M] ...gap... [Tol]
    const span = bodyW * 0.7;
    const start = bodyX + (bodyW - span) / 2;
    
    positions.push(start);
    positions.push(start + 35);
    positions.push(start + 70);
    positions.push(start + 105);
    
    positions.push(start + span);
  } else {
    // 6 Bands: Evenly distributed
    const span = bodyW * 0.75;
    const start = bodyX + (bodyW - span) / 2;
    const step = span / 5;
    
    for (let i = 0; i < 6; i++) {
      positions.push(start + i * step);
    }
  }

  // Path definition (Dogbone)
  const bodyPath = `
    M ${bodyX + 15},${bodyY} 
    H ${bodyX + capW} 
    Q ${bodyX + capW + 15},${bodyY} ${bodyX + capW + 15},${bodyY + centerYOffset}
    H ${bodyX + bodyW - capW - 15}
    Q ${bodyX + bodyW - capW},${bodyY} ${bodyX + bodyW - capW},${bodyY}
    H ${bodyX + bodyW - 15}
    Q ${bodyX + bodyW},${bodyY} ${bodyX + bodyW},${bodyY + bodyH / 2}
    Q ${bodyX + bodyW},${bodyY + bodyH} ${bodyX + bodyW - 15},${bodyY + bodyH}
    H ${bodyX + bodyW - capW}
    Q ${bodyX + bodyW - capW},${bodyY + bodyH} ${bodyX + bodyW - capW - 15},${bodyY + bodyH - centerYOffset}
    H ${bodyX + capW + 15}
    Q ${bodyX + capW + 15},${bodyY + bodyH} ${bodyX + capW},${bodyY + bodyH}
    H ${bodyX + 15}
    Q ${bodyX},${bodyY + bodyH} ${bodyX},${bodyY + bodyH / 2}
    Q ${bodyX},${bodyY} ${bodyX + 15},${bodyY}
    Z
  `;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[500px] drop-shadow-2xl" aria-label="Resistor Visual">
      <defs>
        <linearGradient id="resBody" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e6d5ac" />
          <stop offset="30%" stopColor="#fdf6e3" />
          <stop offset="50%" stopColor="#e6d5ac" />
          <stop offset="100%" stopColor="#c2b280" />
        </linearGradient>
        
        <linearGradient id="leadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="40%" stopColor="#cbd5e1" />
          <stop offset="60%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

        <linearGradient id="bandGloss" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.1" />
          <stop offset="30%" stopColor="white" stopOpacity="0.4" />
          <stop offset="50%" stopColor="white" stopOpacity="0.1" />
          <stop offset="100%" stopColor="black" stopOpacity="0.1" />
        </linearGradient>

        <clipPath id="bodyClip">
          <path d={bodyPath} />
        </clipPath>
        
        <filter id="bodyShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Resistor Body - draw first (bottom layer) */}
      <g filter="url(#bodyShadow)">
        <path d={bodyPath} fill="url(#resBody)" />
      </g>

      {/* Bands */}
      <g clipPath="url(#bodyClip)">
        {bands.map((color, i) => {
          const bx = positions[i];
          return (
            <g key={i}>
              <rect
                x={bx - 9}
                y={0}
                width={18}
                height={h}
                fill={color}
                style={{ mixBlendMode: 'multiply' }}
              />
              <rect
                x={bx - 9}
                y={0}
                width={18}
                height={h}
                fill="url(#bandGloss)"
              />
            </g>
          );
        })}
      </g>
      
      {/* Labels */}
      {labels.map((lb, i) => {
          const bx = positions[i];
          const colorName = bandColorLabels[i] ? ` (${bandColorLabels[i]})` : '';
          return (
            <g key={i} transform={`translate(${bx}, ${bodyY + bodyH + 15})`}>
              <line x1="0" y1="-10" x2="0" y2="0" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
              <rect x="-44" y="0" width="88" height="20" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" className="dark:fill-slate-800 dark:stroke-slate-700" />
              <text 
                x="0" 
                y="13" 
                textAnchor="middle" 
                fontSize="10" 
                className="font-mono font-bold fill-slate-600 dark:fill-slate-300"
              >
                {lb}{colorName}
              </text>
            </g>
          );
      })}

      {/* Leads - drawn last so on top, left and right wires */}
      <line x1="0" y1={h/2} x2={bodyX + 15} y2={h/2} stroke="url(#leadGrad)" strokeWidth="14" strokeLinecap="round" />
      <line x1={bodyX + bodyW - 15} y1={h/2} x2={w} y2={h/2} stroke="url(#leadGrad)" strokeWidth="14" strokeLinecap="round" />
    </svg>
  );
};

export default ResistorColorCodeCalc;