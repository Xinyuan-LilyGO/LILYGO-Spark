import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer } from 'lucide-react';

type Mode = 'astable' | 'monostable';
type RUnit = 'Ω' | 'kΩ' | 'MΩ';
type CUnit = 'pF' | 'nF' | 'µF' | 'mF' | 'F';

const R_MULTIPLIERS: Record<RUnit, number> = { 'Ω': 1, 'kΩ': 1e3, 'MΩ': 1e6 };
const C_MULTIPLIERS: Record<CUnit, number> = { 'pF': 1e-12, 'nF': 1e-9, 'µF': 1e-6, 'mF': 1e-3, 'F': 1 };

function formatFrequency(hz: number): string {
  if (!isFinite(hz) || hz <= 0) return '—';
  if (hz >= 1e6) return `${(hz / 1e6).toPrecision(4)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toPrecision(4)} kHz`;
  return `${hz.toPrecision(4)} Hz`;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 1e-6) return `${(seconds * 1e9).toPrecision(4)} ns`;
  if (seconds < 1e-3) return `${(seconds * 1e6).toPrecision(4)} µs`;
  if (seconds < 1) return `${(seconds * 1e3).toPrecision(4)} ms`;
  return `${seconds.toPrecision(4)} s`;
}

function UnitSelect<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: T[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="bg-white dark:bg-slate-700 border border-orange-200 dark:border-orange-700 rounded-lg px-2 py-1.5 text-sm font-medium min-w-[64px] focus:outline-none focus:ring-2 focus:ring-orange-400"
    >
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function ValueInput({ label, value, onChange, unit, onUnitChange, unitOptions }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  onUnitChange: (v: string) => void;
  unitOptions: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</label>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-white dark:bg-slate-700 border border-orange-200 dark:border-orange-700 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-0"
          placeholder="0"
        />
        <UnitSelect value={unit as never} onChange={onUnitChange as never} options={unitOptions as never} />
      </div>
    </div>
  );
}

function AstableSchematic() {
  return (
    <svg viewBox="0 0 320 280" className="w-full max-w-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Vcc line */}
      <line x1="160" y1="10" x2="160" y2="30" stroke="currentColor" strokeWidth="1.5" />
      <text x="170" y="18" fontSize="11" fill="currentColor" fontWeight="bold">Vcc</text>

      {/* R1 */}
      <line x1="160" y1="30" x2="160" y2="40" stroke="currentColor" strokeWidth="1.5" />
      <rect x="145" y="40" width="30" height="50" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <text x="135" y="70" fontSize="11" fill="currentColor" fontWeight="bold" textAnchor="end">R1</text>

      {/* Junction A (between R1 and R2) → pin 7 */}
      <line x1="160" y1="90" x2="160" y2="100" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="160" cy="100" r="2.5" fill="currentColor" />
      <line x1="160" y1="100" x2="220" y2="100" stroke="currentColor" strokeWidth="1.5" />
      <text x="225" y="104" fontSize="10" fill="currentColor">Pin 7 (DIS)</text>

      {/* R2 */}
      <line x1="160" y1="100" x2="160" y2="110" stroke="currentColor" strokeWidth="1.5" />
      <rect x="145" y="110" width="30" height="50" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <text x="135" y="140" fontSize="11" fill="currentColor" fontWeight="bold" textAnchor="end">R2</text>

      {/* Junction B (between R2 and C) → pins 2,6 */}
      <line x1="160" y1="160" x2="160" y2="175" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="160" cy="175" r="2.5" fill="currentColor" />
      <line x1="160" y1="175" x2="220" y2="175" stroke="currentColor" strokeWidth="1.5" />
      <text x="225" y="170" fontSize="10" fill="currentColor">Pin 6 (THR)</text>
      <text x="225" y="183" fontSize="10" fill="currentColor">Pin 2 (TRI)</text>

      {/* C */}
      <line x1="160" y1="175" x2="160" y2="200" stroke="currentColor" strokeWidth="1.5" />
      <line x1="148" y1="200" x2="172" y2="200" stroke="currentColor" strokeWidth="2" />
      <line x1="148" y1="208" x2="172" y2="208" stroke="currentColor" strokeWidth="2" />
      <text x="135" y="208" fontSize="11" fill="currentColor" fontWeight="bold" textAnchor="end">C</text>

      {/* GND */}
      <line x1="160" y1="208" x2="160" y2="235" stroke="currentColor" strokeWidth="1.5" />
      <line x1="145" y1="235" x2="175" y2="235" stroke="currentColor" strokeWidth="1.5" />
      <line x1="150" y1="240" x2="170" y2="240" stroke="currentColor" strokeWidth="1.5" />
      <line x1="155" y1="245" x2="165" y2="245" stroke="currentColor" strokeWidth="1.5" />

      {/* 555 block */}
      <rect x="40" y="85" width="80" height="120" rx="6" stroke="currentColor" strokeWidth="2" fill="none" />
      <text x="80" y="152" fontSize="14" fill="currentColor" fontWeight="bold" textAnchor="middle">555</text>

      {/* Pin 8 Vcc */}
      <line x1="80" y1="85" x2="80" y2="30" stroke="currentColor" strokeWidth="1.5" />
      <line x1="80" y1="30" x2="160" y2="30" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="80" cy="30" r="0" fill="currentColor" />
      <text x="75" y="82" fontSize="9" fill="currentColor" textAnchor="end">8 Vcc</text>

      {/* Pin 4 Reset → Vcc */}
      <line x1="60" y1="85" x2="60" y2="30" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
      <line x1="60" y1="30" x2="80" y2="30" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x="55" y="82" fontSize="9" fill="currentColor" textAnchor="end">4 RST</text>

      {/* Pin 1 GND */}
      <line x1="80" y1="205" x2="80" y2="235" stroke="currentColor" strokeWidth="1.5" />
      <line x1="80" y1="235" x2="160" y2="235" stroke="currentColor" strokeWidth="1.5" />
      <text x="75" y="215" fontSize="9" fill="currentColor" textAnchor="end">1 GND</text>

      {/* Pin 3 Output */}
      <line x1="40" y1="130" x2="10" y2="130" stroke="currentColor" strokeWidth="1.5" />
      <text x="35" y="128" fontSize="9" fill="currentColor" textAnchor="end">3 OUT</text>
      <text x="8" y="125" fontSize="10" fill="currentColor" fontWeight="bold" textAnchor="end">OUT</text>

      {/* Pin 5 Control → 0.01µF to GND */}
      <line x1="40" y1="170" x2="20" y2="170" stroke="currentColor" strokeWidth="1.5" />
      <text x="35" y="168" fontSize="9" fill="currentColor" textAnchor="end">5 CV</text>
      <line x1="12" y1="170" x2="12" y2="200" stroke="currentColor" strokeWidth="1" />
      <line x1="6" y1="200" x2="18" y2="200" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6" y1="205" x2="18" y2="205" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12" y1="205" x2="12" y2="220" stroke="currentColor" strokeWidth="1" />
      <line x1="5" y1="220" x2="19" y2="220" stroke="currentColor" strokeWidth="1" />
      <line x1="8" y1="224" x2="16" y2="224" stroke="currentColor" strokeWidth="1" />
      <text x="22" y="200" fontSize="8" fill="currentColor">0.01µF</text>

      {/* Connect pin 7 */}
      <line x1="120" y1="100" x2="160" y2="100" stroke="currentColor" strokeWidth="1.5" />
      <text x="125" y="98" fontSize="9" fill="currentColor">7 DIS</text>

      {/* Connect pins 6,2 */}
      <line x1="120" y1="175" x2="160" y2="175" stroke="currentColor" strokeWidth="1.5" />
      <text x="125" y="168" fontSize="9" fill="currentColor">6 THR</text>
      <text x="125" y="183" fontSize="9" fill="currentColor">2 TRI</text>
    </svg>
  );
}

function MonostableSchematic() {
  return (
    <svg viewBox="0 0 320 280" className="w-full max-w-xs" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Vcc line */}
      <line x1="160" y1="10" x2="160" y2="30" stroke="currentColor" strokeWidth="1.5" />
      <text x="170" y="18" fontSize="11" fill="currentColor" fontWeight="bold">Vcc</text>

      {/* R */}
      <line x1="160" y1="30" x2="160" y2="40" stroke="currentColor" strokeWidth="1.5" />
      <rect x="145" y="40" width="30" height="50" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <text x="135" y="70" fontSize="11" fill="currentColor" fontWeight="bold" textAnchor="end">R</text>

      {/* Junction → pin 6,7 */}
      <line x1="160" y1="90" x2="160" y2="110" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="160" cy="110" r="2.5" fill="currentColor" />
      <line x1="160" y1="110" x2="220" y2="110" stroke="currentColor" strokeWidth="1.5" />
      <text x="225" y="107" fontSize="10" fill="currentColor">Pin 7 (DIS)</text>
      <text x="225" y="120" fontSize="10" fill="currentColor">Pin 6 (THR)</text>

      {/* C */}
      <line x1="160" y1="110" x2="160" y2="155" stroke="currentColor" strokeWidth="1.5" />
      <line x1="148" y1="155" x2="172" y2="155" stroke="currentColor" strokeWidth="2" />
      <line x1="148" y1="163" x2="172" y2="163" stroke="currentColor" strokeWidth="2" />
      <text x="135" y="163" fontSize="11" fill="currentColor" fontWeight="bold" textAnchor="end">C</text>

      {/* GND */}
      <line x1="160" y1="163" x2="160" y2="195" stroke="currentColor" strokeWidth="1.5" />
      <line x1="145" y1="195" x2="175" y2="195" stroke="currentColor" strokeWidth="1.5" />
      <line x1="150" y1="200" x2="170" y2="200" stroke="currentColor" strokeWidth="1.5" />
      <line x1="155" y1="205" x2="165" y2="205" stroke="currentColor" strokeWidth="1.5" />

      {/* 555 block */}
      <rect x="40" y="65" width="80" height="120" rx="6" stroke="currentColor" strokeWidth="2" fill="none" />
      <text x="80" y="132" fontSize="14" fill="currentColor" fontWeight="bold" textAnchor="middle">555</text>

      {/* Pin 8 Vcc */}
      <line x1="80" y1="65" x2="80" y2="30" stroke="currentColor" strokeWidth="1.5" />
      <line x1="80" y1="30" x2="160" y2="30" stroke="currentColor" strokeWidth="1.5" />
      <text x="75" y="62" fontSize="9" fill="currentColor" textAnchor="end">8 Vcc</text>

      {/* Pin 4 Reset → Vcc */}
      <line x1="60" y1="65" x2="60" y2="30" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
      <line x1="60" y1="30" x2="80" y2="30" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
      <text x="55" y="62" fontSize="9" fill="currentColor" textAnchor="end">4 RST</text>

      {/* Pin 1 GND */}
      <line x1="80" y1="185" x2="80" y2="195" stroke="currentColor" strokeWidth="1.5" />
      <line x1="80" y1="195" x2="160" y2="195" stroke="currentColor" strokeWidth="1.5" />
      <text x="75" y="192" fontSize="9" fill="currentColor" textAnchor="end">1 GND</text>

      {/* Pin 3 Output */}
      <line x1="40" y1="110" x2="10" y2="110" stroke="currentColor" strokeWidth="1.5" />
      <text x="35" y="108" fontSize="9" fill="currentColor" textAnchor="end">3 OUT</text>
      <text x="8" y="105" fontSize="10" fill="currentColor" fontWeight="bold" textAnchor="end">OUT</text>

      {/* Pin 2 Trigger */}
      <line x1="40" y1="150" x2="10" y2="150" stroke="currentColor" strokeWidth="1.5" />
      <text x="35" y="148" fontSize="9" fill="currentColor" textAnchor="end">2 TRI</text>
      <text x="8" y="145" fontSize="10" fill="currentColor" fontWeight="bold" textAnchor="end">TRI</text>

      {/* Pin 5 Control → 0.01µF to GND */}
      <line x1="40" y1="130" x2="20" y2="130" stroke="currentColor" strokeWidth="1.5" />
      <text x="35" y="128" fontSize="9" fill="currentColor" textAnchor="end">5 CV</text>
      <line x1="12" y1="130" x2="12" y2="155" stroke="currentColor" strokeWidth="1" />
      <line x1="6" y1="155" x2="18" y2="155" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6" y1="160" x2="18" y2="160" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12" y1="160" x2="12" y2="175" stroke="currentColor" strokeWidth="1" />
      <line x1="5" y1="175" x2="19" y2="175" stroke="currentColor" strokeWidth="1" />
      <line x1="8" y1="179" x2="16" y2="179" stroke="currentColor" strokeWidth="1" />
      <text x="22" y="158" fontSize="8" fill="currentColor">0.01µF</text>

      {/* Connect pin 7, 6 */}
      <line x1="120" y1="90" x2="160" y2="90" stroke="currentColor" strokeWidth="1.5" />
      <line x1="160" y1="90" x2="160" y2="110" stroke="currentColor" strokeWidth="1.5" />
      <text x="125" y="88" fontSize="9" fill="currentColor">7 DIS</text>
      <line x1="120" y1="110" x2="160" y2="110" stroke="currentColor" strokeWidth="1.5" />
      <text x="125" y="108" fontSize="9" fill="currentColor">6 THR</text>
    </svg>
  );
}

const R_UNITS: RUnit[] = ['Ω', 'kΩ', 'MΩ'];
const C_UNITS: CUnit[] = ['pF', 'nF', 'µF', 'mF', 'F'];

const Timer555Calc: React.FC = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('astable');

  const [r1Val, setR1Val] = useState('10');
  const [r1Unit, setR1Unit] = useState<RUnit>('kΩ');
  const [r2Val, setR2Val] = useState('10');
  const [r2Unit, setR2Unit] = useState<RUnit>('kΩ');
  const [cVal, setCVal] = useState('100');
  const [cUnit, setCUnit] = useState<CUnit>('nF');

  const [monoRVal, setMonoRVal] = useState('10');
  const [monoRUnit, setMonoRUnit] = useState<RUnit>('kΩ');
  const [monoCVal, setMonoCVal] = useState('100');
  const [monoCUnit, setMonoCUnit] = useState<CUnit>('µF');

  const astableResults = useMemo(() => {
    const r1 = parseFloat(r1Val) * R_MULTIPLIERS[r1Unit];
    const r2 = parseFloat(r2Val) * R_MULTIPLIERS[r2Unit];
    const c = parseFloat(cVal) * C_MULTIPLIERS[cUnit];
    if (!r1 || !r2 || !c || r1 <= 0 || r2 <= 0 || c <= 0) return null;
    const freq = 1.44 / ((r1 + 2 * r2) * c);
    const duty = ((r1 + r2) / (r1 + 2 * r2)) * 100;
    const tHigh = 0.693 * (r1 + r2) * c;
    const tLow = 0.693 * r2 * c;
    return { freq, duty, tHigh, tLow };
  }, [r1Val, r1Unit, r2Val, r2Unit, cVal, cUnit]);

  const monostableResults = useMemo(() => {
    const r = parseFloat(monoRVal) * R_MULTIPLIERS[monoRUnit];
    const c = parseFloat(monoCVal) * C_MULTIPLIERS[monoCUnit];
    if (!r || !c || r <= 0 || c <= 0) return null;
    const pulseWidth = 1.1 * r * c;
    return { pulseWidth };
  }, [monoRVal, monoRUnit, monoCVal, monoCUnit]);

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto">
      <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 p-6 rounded-2xl border-2 border-orange-200/60 dark:border-orange-800/50 shadow-lg max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-400 flex items-center justify-center shadow-md">
            <Timer size={22} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            {t('utilities.t555_title')}
          </h3>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-4 p-1.5 bg-white/60 dark:bg-slate-800/60 rounded-xl">
          {(['astable', 'monostable'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                mode === m
                  ? 'bg-orange-400 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-orange-100 dark:hover:bg-orange-900/30'
              }`}
            >
              {t(`utilities.t555_mode_${m}`)}
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          {t(`utilities.t555_desc_${mode}`)}
        </p>

        <div className="flex gap-6 flex-wrap">
          {/* Input Section */}
          <div className="flex-1 min-w-[240px] flex flex-col gap-4">
            {mode === 'astable' ? (
              <>
                <ValueInput
                  label="R1"
                  value={r1Val}
                  onChange={setR1Val}
                  unit={r1Unit}
                  onUnitChange={(v) => setR1Unit(v as RUnit)}
                  unitOptions={R_UNITS}
                />
                <ValueInput
                  label="R2"
                  value={r2Val}
                  onChange={setR2Val}
                  unit={r2Unit}
                  onUnitChange={(v) => setR2Unit(v as RUnit)}
                  unitOptions={R_UNITS}
                />
                <ValueInput
                  label="C"
                  value={cVal}
                  onChange={setCVal}
                  unit={cUnit}
                  onUnitChange={(v) => setCUnit(v as CUnit)}
                  unitOptions={C_UNITS}
                />
              </>
            ) : (
              <>
                <ValueInput
                  label="R"
                  value={monoRVal}
                  onChange={setMonoRVal}
                  unit={monoRUnit}
                  onUnitChange={(v) => setMonoRUnit(v as RUnit)}
                  unitOptions={R_UNITS}
                />
                <ValueInput
                  label="C"
                  value={monoCVal}
                  onChange={setMonoCVal}
                  unit={monoCUnit}
                  onUnitChange={(v) => setMonoCUnit(v as CUnit)}
                  unitOptions={C_UNITS}
                />
              </>
            )}
          </div>

          {/* Schematic */}
          <div className="flex flex-col items-center min-w-[200px]">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              {t('utilities.t555_schematic')}
            </span>
            <div className="text-slate-600 dark:text-slate-300">
              {mode === 'astable' ? <AstableSchematic /> : <MonostableSchematic />}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mt-6 p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-orange-200/50 dark:border-orange-800/30">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-3">
            {t('utilities.t555_results')}
          </span>

          {mode === 'astable' ? (
            astableResults ? (
              <div className="grid grid-cols-2 gap-3">
                <ResultItem label={t('utilities.t555_frequency')} value={formatFrequency(astableResults.freq)} />
                <ResultItem label={t('utilities.t555_duty_cycle')} value={`${astableResults.duty.toFixed(2)}%`} />
                <ResultItem label={t('utilities.t555_t_high')} value={formatTime(astableResults.tHigh)} />
                <ResultItem label={t('utilities.t555_t_low')} value={formatTime(astableResults.tLow)} />
              </div>
            ) : (
              <p className="text-slate-400 text-sm">—</p>
            )
          ) : monostableResults ? (
            <div className="grid grid-cols-1 gap-3">
              <ResultItem label={t('utilities.t555_pulse_width')} value={formatTime(monostableResults.pulseWidth)} />
            </div>
          ) : (
            <p className="text-slate-400 text-sm">—</p>
          )}
        </div>

        {/* Formulas */}
        <div className="mt-4 p-3 rounded-xl bg-white/50 dark:bg-slate-800/40 border border-orange-100/50 dark:border-orange-900/20">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
            {t('utilities.t555_formulas')}
          </span>
          {mode === 'astable' ? (
            <div className="text-xs font-mono text-slate-600 dark:text-slate-400 space-y-1">
              <p>f = 1.44 / ((R1 + 2·R2) × C)</p>
              <p>Duty = (R1 + R2) / (R1 + 2·R2) × 100%</p>
              <p>tH = 0.693 × (R1 + R2) × C</p>
              <p>tL = 0.693 × R2 × C</p>
            </div>
          ) : (
            <div className="text-xs font-mono text-slate-600 dark:text-slate-400 space-y-1">
              <p>t = 1.1 × R × C</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function ResultItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-orange-50/60 dark:bg-orange-950/20 border border-orange-100/50 dark:border-orange-900/20">
      <span className="text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-lg font-bold text-orange-600 dark:text-orange-400 font-mono">{value}</span>
    </div>
  );
}

export default Timer555Calc;
