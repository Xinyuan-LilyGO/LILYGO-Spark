import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap } from 'lucide-react';

// EIA-96 base values (codes 01-96)
const EIA96_VALUES: number[] = [
  100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143,
  147, 150, 154, 158, 162, 165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210,
  215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280, 287, 294, 301, 309,
  316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453,
  464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665,
  681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976,
];

const EIA96_MULT: Record<string, number> = {
  Y: 0.01, X: 0.1, A: 1, B: 10, C: 100, D: 1000, E: 10000, F: 100000,
};

function formatOhms(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} MΩ`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)} kΩ`;
  return `${v.toFixed(2)} Ω`;
}

type SmdMode = '3digit' | '4digit' | 'eia96';

const SmdResistorCalc: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<SmdMode>('3digit');
  const [digit3, setDigit3] = useState<string[]>(['', '', '']);
  const [digit4, setDigit4] = useState<string[]>(['', '', '', '']);
  const [eia96Code, setEia96Code] = useState<string>('');
  const [eia96Letter, setEia96Letter] = useState<string>('');

  const setD3 = (i: number, v: string) => {
    const d = [...digit3];
    d[i] = v === 'R' ? 'R' : v;
    setDigit3(d);
  };
  const setD4 = (i: number, v: string) => {
    const d = [...digit4];
    d[i] = v === 'R' ? 'R' : v;
    setDigit4(d);
  };

  let resistance: number | null = null;
  let displayCode = '';

  if (mode === '3digit') {
    const [a, b, c] = digit3;
    const hasR = digit3.indexOf('R') >= 0;
    if (hasR) {
      const rIdx = digit3.indexOf('R');
      const before = digit3.slice(0, rIdx).join('');
      const after = digit3.slice(rIdx + 1).join('');
      const numStr = before + '.' + (after || '0');
      const n = parseFloat(numStr);
      if (!isNaN(n)) resistance = n;
      displayCode = digit3.join('');
    } else if (a !== '' && b !== '' && c !== '') {
      const sig = parseInt(a + b, 10);
      const mult = parseInt(c, 10);
      if (!isNaN(sig) && !isNaN(mult)) {
        resistance = sig * Math.pow(10, mult);
        displayCode = a + b + c;
      }
    }
  } else if (mode === '4digit') {
    const [a, b, c, d] = digit4;
    const hasR = digit4.indexOf('R') >= 0;
    if (hasR) {
      const rIdx = digit4.indexOf('R');
      const before = digit4.slice(0, rIdx).join('');
      const after = digit4.slice(rIdx + 1).join('');
      const numStr = before + '.' + (after || '0');
      const n = parseFloat(numStr);
      if (!isNaN(n)) resistance = n;
      displayCode = digit4.join('');
    } else if (a !== '' && b !== '' && c !== '' && d !== '') {
      const sig = parseInt(a + b + c, 10);
      const mult = parseInt(d, 10);
      if (!isNaN(sig) && !isNaN(mult)) {
        resistance = sig * Math.pow(10, mult);
        displayCode = a + b + c + d;
      }
    }
  } else if (mode === 'eia96') {
    const code = eia96Code.trim();
    const letter = eia96Letter.toUpperCase();
    if (code.length >= 2 && letter && EIA96_MULT[letter]) {
      const num = parseInt(code.slice(0, 2), 10);
      if (num >= 1 && num <= 96) {
        resistance = EIA96_VALUES[num - 1] * EIA96_MULT[letter];
        displayCode = code.slice(0, 2) + letter;
      }
    }
  }

  const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const EIA96_LETTERS = ['Y', 'X', 'A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto">
      <div className="bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/30 p-6 rounded-2xl border-2 border-rose-200/60 dark:border-rose-800/50 shadow-lg max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-amber-400 flex items-center justify-center shadow-md">
            <Zap size={22} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            {t('utilities.smd_resistor')}
          </h3>
        </div>

        <div className="flex gap-2 mb-4 p-1.5 bg-white/60 dark:bg-slate-800/60 rounded-xl">
          {(['3digit', '4digit', 'eia96'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                mode === m
                  ? 'bg-rose-400 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-rose-100 dark:hover:bg-rose-900/30'
              }`}
            >
              {t(`utilities.smd_mode_${m}`)}
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          {t(`utilities.smd_desc_${mode}`)}
        </p>

        <div className="flex gap-6 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            {mode === '3digit' && (
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((pos) => (
                  <div key={pos} className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400">{pos === 0 ? t('utilities.smd_d1') : pos === 1 ? t('utilities.smd_d2') : t('utilities.smd_mult')}</span>
                    <div className="flex flex-wrap gap-1">
                      {DIGITS.map((d) => (
                        <button
                          key={d}
                          onClick={() => setD3(pos, d)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                            digit3[pos] === d
                              ? 'bg-rose-400 text-white'
                              : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                      <button
                        onClick={() => setD3(pos, 'R')}
                        className={`w-8 h-8 rounded-lg text-xs font-bold ${
                          digit3[pos] === 'R'
                            ? 'bg-rose-400 text-white'
                            : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-rose-50'
                        }`}
                      >
                        R
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {mode === '4digit' && (
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((pos) => (
                  <div key={pos} className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400">{pos < 3 ? t('utilities.smd_d' + (pos + 1)) : t('utilities.smd_mult')}</span>
                    <div className="flex flex-wrap gap-1">
                      {DIGITS.map((d) => (
                        <button
                          key={d}
                          onClick={() => setD4(pos, d)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                            digit4[pos] === d
                              ? 'bg-rose-400 text-white'
                              : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-rose-50'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                      <button
                          onClick={() => setD4(pos, 'R')}
                          className={`w-8 h-8 rounded-lg text-xs font-bold ${
                            digit4[pos] === 'R'
                              ? 'bg-rose-400 text-white'
                              : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-rose-50'
                          }`}
                        >
                          R
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {mode === 'eia96' && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-4 flex-wrap">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">{t('utilities.smd_eia96_code')}</span>
                    <select
                      value={eia96Code}
                      onChange={(e) => setEia96Code(e.target.value)}
                      className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm min-w-[80px]"
                    >
                      <option value="">--</option>
                      {Array.from({ length: 96 }, (_, i) => {
                        const n = (i + 1).toString().padStart(2, '0');
                        return (
                          <option key={n} value={n}>{n} ({EIA96_VALUES[i]})</option>
                        );
                      })}
                    </select>
                  </div>
                <div>
                    <span className="text-[10px] text-slate-400 block mb-1">{t('utilities.smd_eia96_mult')}</span>
                    <div className="flex flex-wrap gap-1">
                      {EIA96_LETTERS.map((L) => (
                      <button
                          key={L}
                          onClick={() => setEia96Letter(L)}
                          className={`w-10 h-9 rounded-lg text-sm font-bold ${
                            eia96Letter === L
                              ? 'bg-rose-400 text-white'
                              : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-rose-50'
                          }`}
                        >
                          {L}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center justify-center min-w-[140px]">
            <div className="w-24 h-10 rounded-lg bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center shadow-inner border-2 border-slate-400/50 dark:border-slate-500/50">
              <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100 tracking-wider">
                {displayCode || '____'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">{t('utilities.smd_preview')}</p>
          </div>
        </div>

        <div className="mt-6 p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-rose-200/50 dark:border-rose-800/30">
          <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">{t('utilities.smd_result')}</span>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">
            {resistance != null ? formatOhms(resistance) : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmdResistorCalc;
