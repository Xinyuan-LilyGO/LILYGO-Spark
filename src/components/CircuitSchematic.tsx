import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircuitBoard } from 'lucide-react';

type CircuitTemplate = 'level_shift' | 'i2c_pullup' | 'decoupling' | 'led_driver' | 'debounce';

const CircuitSchematic: React.FC = () => {
  const { t } = useTranslation();
  const [template, setTemplate] = useState<CircuitTemplate>('level_shift');

  const tabs: { key: CircuitTemplate; labelKey: string }[] = [
    { key: 'level_shift', labelKey: 'utilities.circuit_tab_level_shift' },
    { key: 'i2c_pullup', labelKey: 'utilities.circuit_tab_i2c_pullup' },
    { key: 'decoupling', labelKey: 'utilities.circuit_tab_decoupling' },
    { key: 'led_driver', labelKey: 'utilities.circuit_tab_led_driver' },
    { key: 'debounce', labelKey: 'utilities.circuit_tab_debounce' },
  ];

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto">
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-6 rounded-2xl border-2 border-purple-200/60 dark:border-purple-800/50 shadow-lg max-w-4xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-md">
            <CircuitBoard size={22} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            {t('utilities.circuit_title')}
          </h3>
        </div>

        <div className="flex gap-1.5 mb-4 p-1.5 bg-white/60 dark:bg-slate-800/60 rounded-xl flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTemplate(tab.key)}
              className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                template === tab.key
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-purple-100 dark:hover:bg-purple-900/30'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {template === 'level_shift' && <LevelShiftCircuit />}
        {template === 'i2c_pullup' && <I2CPullupCircuit />}
        {template === 'decoupling' && <DecouplingCircuit />}
        {template === 'led_driver' && <LedDriverCircuit />}
        {template === 'debounce' && <DebounceCircuit />}
      </div>
    </div>
  );
};

/* ─── Level Shift (MOSFET bidirectional) ─── */
const LevelShiftCircuit: React.FC = () => {
  const { t } = useTranslation();
  const [vLow, setVLow] = useState('3.3');
  const [vHigh, setVHigh] = useState('5');
  const [rPull, setRPull] = useState('10');

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl border border-purple-200/50 dark:border-purple-800/30 p-4">
        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-3">{t('utilities.circuit_params')}</span>
        <div className="flex gap-4 flex-wrap">
          <ParamInput label={t('utilities.circuit_ls_vlow')} value={vLow} onChange={setVLow} unit="V" />
          <ParamInput label={t('utilities.circuit_ls_vhigh')} value={vHigh} onChange={setVHigh} unit="V" />
          <ParamInput label={t('utilities.circuit_ls_rpull')} value={rPull} onChange={setRPull} unit="kΩ" />
        </div>
      </div>

      <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl border border-purple-200/50 dark:border-purple-800/30 p-4">
        <svg viewBox="0 0 480 220" className="w-full" style={{ maxHeight: 240 }}>
          {/* Low-voltage side */}
          <text x={20} y={20} fontSize={12} fill="#7c3aed" fontWeight="bold">{vLow}V</text>
          <line x1={35} y1={28} x2={35} y2={60} stroke="#7c3aed" strokeWidth={2} />
          <rect x={25} y={60} width={20} height={40} rx={3} fill="#e9d5ff" stroke="#7c3aed" strokeWidth={1.5} />
          <text x={35} y={84} textAnchor="middle" fontSize={9} fill="#7c3aed">{rPull}k</text>
          <line x1={35} y1={100} x2={35} y2={120} stroke="#7c3aed" strokeWidth={2} />

          {/* SDA/SCL line */}
          <line x1={35} y1={120} x2={180} y2={120} stroke="#64748b" strokeWidth={2} />
          <text x={100} y={115} textAnchor="middle" fontSize={10} fill="#64748b">SDA/SCL</text>

          {/* MOSFET */}
          <rect x={180} y={100} width={60} height={40} rx={4} fill="#faf5ff" stroke="#7c3aed" strokeWidth={1.5} />
          <text x={210} y={118} textAnchor="middle" fontSize={9} fill="#7c3aed" fontWeight="bold">BSS138</text>
          <text x={210} y={132} textAnchor="middle" fontSize={8} fill="#a78bfa">N-MOSFET</text>
          <text x={185} y={98} fontSize={8} fill="#64748b">G</text>
          <text x={175} y={125} fontSize={8} fill="#64748b">S</text>
          <text x={240} y={125} fontSize={8} fill="#64748b">D</text>

          {/* Gate to low-voltage rail */}
          <line x1={195} y1={100} x2={195} y2={50} stroke="#7c3aed" strokeWidth={1.5} strokeDasharray="4 2" />
          <text x={200} y={45} fontSize={9} fill="#7c3aed">{vLow}V</text>

          {/* High-voltage side */}
          <line x1={240} y1={120} x2={400} y2={120} stroke="#64748b" strokeWidth={2} />
          <text x={340} y={115} textAnchor="middle" fontSize={10} fill="#64748b">SDA/SCL</text>

          <line x1={400} y1={120} x2={400} y2={100} stroke="#ec4899" strokeWidth={2} />
          <rect x={390} y={60} width={20} height={40} rx={3} fill="#fce7f3" stroke="#ec4899" strokeWidth={1.5} />
          <text x={400} y={84} textAnchor="middle" fontSize={9} fill="#ec4899">{rPull}k</text>
          <line x1={400} y1={60} x2={400} y2={28} stroke="#ec4899" strokeWidth={2} />
          <text x={385} y={20} fontSize={12} fill="#ec4899" fontWeight="bold">{vHigh}V</text>

          {/* GND */}
          <line x1={210} y1={140} x2={210} y2={180} stroke="#64748b" strokeWidth={2} />
          <line x1={195} y1={180} x2={225} y2={180} stroke="#64748b" strokeWidth={2.5} />
          <line x1={200} y1={185} x2={220} y2={185} stroke="#64748b" strokeWidth={2} />
          <line x1={205} y1={190} x2={215} y2={190} stroke="#64748b" strokeWidth={1.5} />
          <text x={210} y={205} textAnchor="middle" fontSize={10} fill="#64748b">GND</text>

          {/* Labels */}
          <text x={35} y={155} textAnchor="middle" fontSize={10} fill="#7c3aed" fontWeight="bold">{t('utilities.circuit_ls_low_side')}</text>
          <text x={400} y={155} textAnchor="middle" fontSize={10} fill="#ec4899" fontWeight="bold">{t('utilities.circuit_ls_high_side')}</text>
        </svg>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/40 rounded-lg p-3 leading-relaxed">
        {t('utilities.circuit_ls_desc')}
      </div>
    </div>
  );
};

/* ─── I2C Pull-up ─── */
const I2CPullupCircuit: React.FC = () => {
  const { t } = useTranslation();
  const [vcc, setVcc] = useState('3.3');
  const [rPull, setRPull] = useState('4.7');

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl border border-purple-200/50 dark:border-purple-800/30 p-4">
        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-3">{t('utilities.circuit_params')}</span>
        <div className="flex gap-4 flex-wrap">
          <ParamInput label="VCC" value={vcc} onChange={setVcc} unit="V" />
          <ParamInput label={t('utilities.circuit_i2c_rpull')} value={rPull} onChange={setRPull} unit="kΩ" />
        </div>
      </div>

      <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl border border-purple-200/50 dark:border-purple-800/30 p-4">
        <svg viewBox="0 0 400 200" className="w-full" style={{ maxHeight: 220 }}>
          {/* VCC rail */}
          <line x1={80} y1={15} x2={280} y2={15} stroke="#7c3aed" strokeWidth={2} />
          <text x={180} y={12} textAnchor="middle" fontSize={12} fill="#7c3aed" fontWeight="bold">VCC ({vcc}V)</text>

          {/* SDA pull-up */}
          <line x1={120} y1={15} x2={120} y2={35} stroke="#7c3aed" strokeWidth={2} />
          <rect x={110} y={35} width={20} height={40} rx={3} fill="#e9d5ff" stroke="#7c3aed" strokeWidth={1.5} />
          <text x={120} y={59} textAnchor="middle" fontSize={9} fill="#7c3aed">{rPull}k</text>
          <line x1={120} y1={75} x2={120} y2={100} stroke="#7c3aed" strokeWidth={2} />
          <text x={120} y={115} textAnchor="middle" fontSize={10} fill="#64748b" fontWeight="bold">SDA</text>

          {/* SCL pull-up */}
          <line x1={240} y1={15} x2={240} y2={35} stroke="#ec4899" strokeWidth={2} />
          <rect x={230} y={35} width={20} height={40} rx={3} fill="#fce7f3" stroke="#ec4899" strokeWidth={1.5} />
          <text x={240} y={59} textAnchor="middle" fontSize={9} fill="#ec4899">{rPull}k</text>
          <line x1={240} y1={75} x2={240} y2={100} stroke="#ec4899" strokeWidth={2} />
          <text x={240} y={115} textAnchor="middle" fontSize={10} fill="#64748b" fontWeight="bold">SCL</text>

          {/* I2C bus line */}
          <line x1={40} y1={100} x2={340} y2={100} stroke="#64748b" strokeWidth={2} strokeDasharray="6 3" />

          {/* ESP32 */}
          <rect x={20} y={130} width={80} height={40} rx={6} fill="#f0fdf4" stroke="#22c55e" strokeWidth={1.5} />
          <text x={60} y={154} textAnchor="middle" fontSize={10} fill="#166534" fontWeight="bold">ESP32</text>
          <line x1={60} y1={130} x2={60} y2={100} stroke="#22c55e" strokeWidth={1.5} />

          {/* Sensor */}
          <rect x={280} y={130} width={80} height={40} rx={6} fill="#eff6ff" stroke="#3b82f6" strokeWidth={1.5} />
          <text x={320} y={154} textAnchor="middle" fontSize={10} fill="#1e40af" fontWeight="bold">{t('utilities.circuit_i2c_sensor')}</text>
          <line x1={320} y1={130} x2={320} y2={100} stroke="#3b82f6" strokeWidth={1.5} />
        </svg>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/40 rounded-lg p-3 leading-relaxed">
        {t('utilities.circuit_i2c_desc')}
      </div>
    </div>
  );
};

/* ─── Decoupling ─── */
const DecouplingCircuit: React.FC = () => {
  const { t } = useTranslation();
  const [cSmall, setCSmall] = useState('100');
  const [cBig, setCBig] = useState('10');

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl border border-purple-200/50 dark:border-purple-800/30 p-4">
        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-3">{t('utilities.circuit_params')}</span>
        <div className="flex gap-4 flex-wrap">
          <ParamInput label={t('utilities.circuit_dc_csmall')} value={cSmall} onChange={setCSmall} unit="nF" />
          <ParamInput label={t('utilities.circuit_dc_cbig')} value={cBig} onChange={setCBig} unit="µF" />
        </div>
      </div>

      <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl border border-purple-200/50 dark:border-purple-800/30 p-4">
        <svg viewBox="0 0 420 200" className="w-full" style={{ maxHeight: 220 }}>
          {/* VCC rail */}
          <line x1={30} y1={30} x2={380} y2={30} stroke="#ef4444" strokeWidth={2} />
          <text x={20} y={25} fontSize={11} fill="#ef4444" fontWeight="bold">VCC</text>

          {/* GND rail */}
          <line x1={30} y1={160} x2={380} y2={160} stroke="#64748b" strokeWidth={2} />
          <text x={20} y={175} fontSize={11} fill="#64748b" fontWeight="bold">GND</text>

          {/* C1 (small, ceramic) */}
          <line x1={120} y1={30} x2={120} y2={70} stroke="#ef4444" strokeWidth={1.5} />
          <line x1={105} y1={70} x2={135} y2={70} stroke="#7c3aed" strokeWidth={3} />
          <line x1={105} y1={80} x2={135} y2={80} stroke="#7c3aed" strokeWidth={3} />
          <line x1={120} y1={80} x2={120} y2={160} stroke="#64748b" strokeWidth={1.5} />
          <text x={120} y={100} textAnchor="middle" fontSize={10} fill="#7c3aed" fontWeight="bold">{cSmall}nF</text>
          <text x={120} y={112} textAnchor="middle" fontSize={8} fill="#a78bfa">{t('utilities.circuit_dc_ceramic')}</text>

          {/* C2 (big, electrolytic) */}
          <line x1={220} y1={30} x2={220} y2={70} stroke="#ef4444" strokeWidth={1.5} />
          <line x1={205} y1={70} x2={235} y2={70} stroke="#ec4899" strokeWidth={3} />
          <text x={238} y={68} fontSize={9} fill="#ec4899" fontWeight="bold">+</text>
          <line x1={205} y1={80} x2={235} y2={80} stroke="#ec4899" strokeWidth={3} />
          <line x1={220} y1={80} x2={220} y2={160} stroke="#64748b" strokeWidth={1.5} />
          <text x={220} y={100} textAnchor="middle" fontSize={10} fill="#ec4899" fontWeight="bold">{cBig}µF</text>
          <text x={220} y={112} textAnchor="middle" fontSize={8} fill="#f9a8d4">{t('utilities.circuit_dc_electrolytic')}</text>

          {/* ESP32 chip */}
          <rect x={300} y={55} width={70} height={60} rx={6} fill="#f0fdf4" stroke="#22c55e" strokeWidth={1.5} />
          <text x={335} y={82} textAnchor="middle" fontSize={10} fill="#166534" fontWeight="bold">ESP32</text>
          <text x={335} y={94} textAnchor="middle" fontSize={8} fill="#4ade80">VDD</text>
          <line x1={335} y1={55} x2={335} y2={30} stroke="#ef4444" strokeWidth={1.5} />
          <line x1={335} y1={115} x2={335} y2={160} stroke="#64748b" strokeWidth={1.5} />
          <text x={340} y={48} fontSize={8} fill="#ef4444">VDD</text>
          <text x={340} y={128} fontSize={8} fill="#64748b">GND</text>
        </svg>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/40 rounded-lg p-3 leading-relaxed">
        {t('utilities.circuit_dc_desc')}
      </div>
    </div>
  );
};

/* ─── LED Driver ─── */
const LedDriverCircuit: React.FC = () => {
  const { t } = useTranslation();
  const [vcc, setVcc] = useState('3.3');
  const [vf, setVf] = useState('2.0');
  const [iF, setIF] = useState('10');

  const vccN = parseFloat(vcc) || 3.3;
  const vfN = parseFloat(vf) || 2.0;
  const ifN = parseFloat(iF) || 10;
  const rCalc = ifN > 0 ? (vccN - vfN) / (ifN / 1000) : 0;
  const rDisplay = rCalc > 0 ? (rCalc >= 1000 ? `${(rCalc / 1000).toFixed(1)}kΩ` : `${Math.round(rCalc)}Ω`) : '—';

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl border border-purple-200/50 dark:border-purple-800/30 p-4">
        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-3">{t('utilities.circuit_params')}</span>
        <div className="flex gap-4 flex-wrap">
          <ParamInput label={t('utilities.circuit_led_vcc')} value={vcc} onChange={setVcc} unit="V" />
          <ParamInput label={t('utilities.circuit_led_vf')} value={vf} onChange={setVf} unit="V" />
          <ParamInput label={t('utilities.circuit_led_if')} value={iF} onChange={setIF} unit="mA" />
        </div>
      </div>

      <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl border border-purple-200/50 dark:border-purple-800/30 p-4">
        <svg viewBox="0 0 420 160" className="w-full" style={{ maxHeight: 180 }}>
          {/* GPIO */}
          <rect x={20} y={55} width={60} height={30} rx={6} fill="#f0fdf4" stroke="#22c55e" strokeWidth={1.5} />
          <text x={50} y={74} textAnchor="middle" fontSize={9} fill="#166534" fontWeight="bold">GPIO</text>

          {/* Wire to resistor */}
          <line x1={80} y1={70} x2={130} y2={70} stroke="#64748b" strokeWidth={2} />

          {/* Resistor */}
          <rect x={130} y={58} width={60} height={24} rx={4} fill="#e9d5ff" stroke="#7c3aed" strokeWidth={1.5} />
          <text x={160} y={74} textAnchor="middle" fontSize={10} fill="#7c3aed" fontWeight="bold">R</text>
          <text x={160} y={50} textAnchor="middle" fontSize={10} fill="#7c3aed" fontWeight="bold">{rDisplay}</text>

          {/* Wire to LED */}
          <line x1={190} y1={70} x2={240} y2={70} stroke="#64748b" strokeWidth={2} />

          {/* LED (triangle + line) */}
          <polygon points="240,55 240,85 270,70" fill="#fbbf24" stroke="#d97706" strokeWidth={1.5} />
          <line x1={270} y1={55} x2={270} y2={85} stroke="#d97706" strokeWidth={2} />
          {/* LED glow arrows */}
          <line x1={255} y1={50} x2={265} y2={40} stroke="#eab308" strokeWidth={1} markerEnd="url(#arrowLed)" />
          <line x1={262} y1={52} x2={272} y2={42} stroke="#eab308" strokeWidth={1} markerEnd="url(#arrowLed)" />
          <defs>
            <marker id="arrowLed" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
              <path d="M0,0 L6,3 L0,6" fill="#eab308" />
            </marker>
          </defs>
          <text x={255} y={105} textAnchor="middle" fontSize={9} fill="#d97706">Vf={vf}V</text>

          {/* Wire to GND */}
          <line x1={270} y1={70} x2={340} y2={70} stroke="#64748b" strokeWidth={2} />
          <line x1={340} y1={70} x2={340} y2={100} stroke="#64748b" strokeWidth={2} />
          <line x1={325} y1={100} x2={355} y2={100} stroke="#64748b" strokeWidth={2.5} />
          <line x1={330} y1={105} x2={350} y2={105} stroke="#64748b" strokeWidth={2} />
          <line x1={335} y1={110} x2={345} y2={110} stroke="#64748b" strokeWidth={1.5} />
          <text x={340} y={125} textAnchor="middle" fontSize={10} fill="#64748b">GND</text>

          {/* Current label */}
          <text x={210} y={95} textAnchor="middle" fontSize={9} fill="#64748b">I = {iF}mA →</text>
        </svg>
      </div>

      <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-purple-200/50 dark:border-purple-800/30">
        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">{t('utilities.circuit_led_result')}</span>
        <div className="text-lg font-bold text-purple-600 dark:text-purple-400 font-mono">
          R = (VCC - Vf) / I = ({vcc} - {vf}) / {iF}mA = {rDisplay}
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/40 rounded-lg p-3 leading-relaxed">
        {t('utilities.circuit_led_desc')}
      </div>
    </div>
  );
};

/* ─── Button Debounce (RC) ─── */
const DebounceCircuit: React.FC = () => {
  const { t } = useTranslation();
  const [rVal, setRVal] = useState('10');
  const [cVal, setCVal] = useState('100');
  const [pullMode, setPullMode] = useState<'up' | 'down'>('up');

  const rN = parseFloat(rVal) || 10;
  const cN = parseFloat(cVal) || 100;
  const tau = rN * 1e3 * cN * 1e-9 * 1000; // ms

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl border border-purple-200/50 dark:border-purple-800/30 p-4">
        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-3">{t('utilities.circuit_params')}</span>
        <div className="flex gap-4 flex-wrap items-end">
          <ParamInput label="R" value={rVal} onChange={setRVal} unit="kΩ" />
          <ParamInput label="C" value={cVal} onChange={setCVal} unit="nF" />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400">{t('utilities.circuit_db_pull_mode')}</span>
            <div className="flex gap-1">
              {(['up', 'down'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPullMode(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    pullMode === m
                      ? 'bg-purple-500 text-white'
                      : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {t(`utilities.circuit_db_pull_${m}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl border border-purple-200/50 dark:border-purple-800/30 p-4">
        <svg viewBox="0 0 420 220" className="w-full" style={{ maxHeight: 240 }}>
          {pullMode === 'up' ? (
            <>
              {/* Pull-up: VCC → R_pull → node → button → GND, node → R → C → GPIO */}
              <text x={60} y={15} fontSize={11} fill="#ef4444" fontWeight="bold">VCC (3.3V)</text>
              <line x1={80} y1={20} x2={80} y2={40} stroke="#ef4444" strokeWidth={2} />
              <rect x={70} y={40} width={20} height={35} rx={3} fill="#fce7f3" stroke="#ec4899" strokeWidth={1.5} />
              <text x={80} y={62} textAnchor="middle" fontSize={8} fill="#ec4899">{rVal}k</text>
              <text x={95} y={55} fontSize={7} fill="#a78bfa">Pull-up</text>
              <line x1={80} y1={75} x2={80} y2={100} stroke="#64748b" strokeWidth={2} />

              {/* Node */}
              <circle cx={80} cy={100} r={3} fill="#7c3aed" />

              {/* Button to GND */}
              <line x1={80} y1={100} x2={80} y2={130} stroke="#64748b" strokeWidth={2} />
              <line x1={65} y1={130} x2={80} y2={130} stroke="#64748b" strokeWidth={2} />
              <line x1={80} y1={130} x2={95} y2={120} stroke="#64748b" strokeWidth={2} />
              <circle cx={65} cy={130} r={3} fill="#64748b" />
              <circle cx={95} cy={130} r={3} fill="none" stroke="#64748b" strokeWidth={1.5} />
              <text x={80} y={148} textAnchor="middle" fontSize={9} fill="#64748b" fontWeight="bold">SW</text>
              <line x1={65} y1={130} x2={65} y2={180} stroke="#64748b" strokeWidth={2} />
              <line x1={50} y1={180} x2={80} y2={180} stroke="#64748b" strokeWidth={2.5} />
              <line x1={55} y1={185} x2={75} y2={185} stroke="#64748b" strokeWidth={2} />
              <line x1={60} y1={190} x2={70} y2={190} stroke="#64748b" strokeWidth={1.5} />
              <text x={65} y={205} textAnchor="middle" fontSize={9} fill="#64748b">GND</text>

              {/* RC filter: node → R → C → GPIO */}
              <line x1={80} y1={100} x2={160} y2={100} stroke="#64748b" strokeWidth={2} />
              <rect x={160} y={88} width={50} height={24} rx={4} fill="#e9d5ff" stroke="#7c3aed" strokeWidth={1.5} />
              <text x={185} y={104} textAnchor="middle" fontSize={9} fill="#7c3aed">{rVal}kΩ</text>
              <line x1={210} y1={100} x2={260} y2={100} stroke="#64748b" strokeWidth={2} />

              {/* Capacitor */}
              <line x1={260} y1={100} x2={260} y2={120} stroke="#64748b" strokeWidth={2} />
              <line x1={248} y1={120} x2={272} y2={120} stroke="#7c3aed" strokeWidth={3} />
              <line x1={248} y1={128} x2={272} y2={128} stroke="#7c3aed" strokeWidth={3} />
              <line x1={260} y1={128} x2={260} y2={180} stroke="#64748b" strokeWidth={1.5} />
              <line x1={245} y1={180} x2={275} y2={180} stroke="#64748b" strokeWidth={2.5} />
              <line x1={250} y1={185} x2={270} y2={185} stroke="#64748b" strokeWidth={2} />
              <line x1={255} y1={190} x2={265} y2={190} stroke="#64748b" strokeWidth={1.5} />
              <text x={260} y={150} textAnchor="middle" fontSize={9} fill="#7c3aed">{cVal}nF</text>

              {/* To GPIO */}
              <line x1={260} y1={100} x2={340} y2={100} stroke="#64748b" strokeWidth={2} />
              <rect x={340} y={80} width={60} height={40} rx={6} fill="#f0fdf4" stroke="#22c55e" strokeWidth={1.5} />
              <text x={370} y={104} textAnchor="middle" fontSize={9} fill="#166534" fontWeight="bold">GPIO</text>
            </>
          ) : (
            <>
              {/* Pull-down: GND → R_pull → node → button → VCC, node → R → C → GPIO */}
              <text x={55} y={205} fontSize={11} fill="#64748b" fontWeight="bold">GND</text>
              <line x1={80} y1={195} x2={80} y2={175} stroke="#64748b" strokeWidth={2} />
              <rect x={70} y={140} width={20} height={35} rx={3} fill="#fce7f3" stroke="#ec4899" strokeWidth={1.5} />
              <text x={80} y={162} textAnchor="middle" fontSize={8} fill="#ec4899">{rVal}k</text>
              <text x={95} y={155} fontSize={7} fill="#a78bfa">Pull-dn</text>
              <line x1={80} y1={140} x2={80} y2={100} stroke="#64748b" strokeWidth={2} />

              {/* Node */}
              <circle cx={80} cy={100} r={3} fill="#7c3aed" />

              {/* Button to VCC */}
              <line x1={80} y1={100} x2={80} y2={70} stroke="#64748b" strokeWidth={2} />
              <line x1={65} y1={70} x2={80} y2={70} stroke="#64748b" strokeWidth={2} />
              <line x1={80} y1={70} x2={95} y2={60} stroke="#64748b" strokeWidth={2} />
              <circle cx={65} cy={70} r={3} fill="#64748b" />
              <circle cx={95} cy={70} r={3} fill="none" stroke="#64748b" strokeWidth={1.5} />
              <text x={80} y={55} textAnchor="middle" fontSize={9} fill="#64748b" fontWeight="bold">SW</text>
              <line x1={65} y1={70} x2={65} y2={25} stroke="#ef4444" strokeWidth={2} />
              <text x={60} y={18} fontSize={11} fill="#ef4444" fontWeight="bold">VCC (3.3V)</text>

              {/* RC filter */}
              <line x1={80} y1={100} x2={160} y2={100} stroke="#64748b" strokeWidth={2} />
              <rect x={160} y={88} width={50} height={24} rx={4} fill="#e9d5ff" stroke="#7c3aed" strokeWidth={1.5} />
              <text x={185} y={104} textAnchor="middle" fontSize={9} fill="#7c3aed">{rVal}kΩ</text>
              <line x1={210} y1={100} x2={260} y2={100} stroke="#64748b" strokeWidth={2} />

              {/* Capacitor */}
              <line x1={260} y1={100} x2={260} y2={120} stroke="#64748b" strokeWidth={2} />
              <line x1={248} y1={120} x2={272} y2={120} stroke="#7c3aed" strokeWidth={3} />
              <line x1={248} y1={128} x2={272} y2={128} stroke="#7c3aed" strokeWidth={3} />
              <line x1={260} y1={128} x2={260} y2={180} stroke="#64748b" strokeWidth={1.5} />
              <line x1={245} y1={180} x2={275} y2={180} stroke="#64748b" strokeWidth={2.5} />
              <line x1={250} y1={185} x2={270} y2={185} stroke="#64748b" strokeWidth={2} />
              <line x1={255} y1={190} x2={265} y2={190} stroke="#64748b" strokeWidth={1.5} />
              <text x={260} y={150} textAnchor="middle" fontSize={9} fill="#7c3aed">{cVal}nF</text>

              {/* To GPIO */}
              <line x1={260} y1={100} x2={340} y2={100} stroke="#64748b" strokeWidth={2} />
              <rect x={340} y={80} width={60} height={40} rx={6} fill="#f0fdf4" stroke="#22c55e" strokeWidth={1.5} />
              <text x={370} y={104} textAnchor="middle" fontSize={9} fill="#166534" fontWeight="bold">GPIO</text>
            </>
          )}
        </svg>
      </div>

      <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-purple-200/50 dark:border-purple-800/30">
        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">{t('utilities.circuit_db_tau')}</span>
        <div className="text-lg font-bold text-purple-600 dark:text-purple-400 font-mono">
          τ = R × C = {rVal}kΩ × {cVal}nF = {tau.toFixed(2)} ms
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/40 rounded-lg p-3 leading-relaxed">
        {t('utilities.circuit_db_desc')}
      </div>
    </div>
  );
};

/* ─── Shared param input ─── */
interface ParamInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
}

const ParamInput: React.FC<ParamInputProps> = ({ label, value, onChange, unit }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] text-slate-400">{label}</span>
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 font-mono text-sm px-2 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/50 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400"
      />
      <span className="text-xs text-slate-500 font-mono">{unit}</span>
    </div>
  </div>
);

export default CircuitSchematic;
