import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu } from 'lucide-react';

type ChipId = 'ESP32' | 'ESP32-S2' | 'ESP32-S3' | 'ESP32-C3' | 'ESP32-C6' | 'ESP32-H2';

interface PowerMode {
  name: string;
  currentMa: number;
}

interface ChipData {
  modes: PowerMode[];
}

const CHIP_DATA: Record<ChipId, ChipData> = {
  'ESP32': {
    modes: [
      { name: 'Active (WiFi TX)', currentMa: 240 },
      { name: 'Active (BLE)', currentMa: 130 },
      { name: 'Modem-sleep', currentMa: 20 },
      { name: 'Light-sleep', currentMa: 0.8 },
      { name: 'Deep-sleep', currentMa: 0.01 },
    ],
  },
  'ESP32-S2': {
    modes: [
      { name: 'Active (WiFi TX)', currentMa: 310 },
      { name: 'Modem-sleep', currentMa: 12 },
      { name: 'Light-sleep', currentMa: 0.75 },
      { name: 'Deep-sleep', currentMa: 0.022 },
    ],
  },
  'ESP32-S3': {
    modes: [
      { name: 'Active (WiFi TX)', currentMa: 355 },
      { name: 'Active (BLE)', currentMa: 130 },
      { name: 'Modem-sleep', currentMa: 25 },
      { name: 'Light-sleep', currentMa: 0.24 },
      { name: 'Deep-sleep', currentMa: 0.007 },
    ],
  },
  'ESP32-C3': {
    modes: [
      { name: 'Active (WiFi TX)', currentMa: 335 },
      { name: 'Active (BLE)', currentMa: 100 },
      { name: 'Modem-sleep', currentMa: 15 },
      { name: 'Light-sleep', currentMa: 0.13 },
      { name: 'Deep-sleep', currentMa: 0.005 },
    ],
  },
  'ESP32-C6': {
    modes: [
      { name: 'Active (WiFi TX)', currentMa: 310 },
      { name: 'Active (BLE)', currentMa: 100 },
      { name: 'Modem-sleep', currentMa: 17 },
      { name: 'Light-sleep', currentMa: 0.12 },
      { name: 'Deep-sleep', currentMa: 0.007 },
    ],
  },
  'ESP32-H2': {
    modes: [
      { name: 'Active (BLE)', currentMa: 82 },
      { name: 'Active (802.15.4)', currentMa: 85 },
      { name: 'Modem-sleep', currentMa: 12 },
      { name: 'Light-sleep', currentMa: 0.11 },
      { name: 'Deep-sleep', currentMa: 0.008 },
    ],
  },
};

const CHIPS: ChipId[] = ['ESP32', 'ESP32-S2', 'ESP32-S3', 'ESP32-C3', 'ESP32-C6', 'ESP32-H2'];

interface Peripheral {
  id: string;
  labelKey: string;
  currentMa: number;
}

const PERIPHERALS: Peripheral[] = [
  { id: 'wifi', labelKey: 'esp_pwr_peri_wifi', currentMa: 0 },
  { id: 'ble', labelKey: 'esp_pwr_peri_ble', currentMa: 0 },
  { id: 'psram', labelKey: 'esp_pwr_peri_psram', currentMa: 2 },
  { id: 'sdcard', labelKey: 'esp_pwr_peri_sdcard', currentMa: 10 },
  { id: 'display', labelKey: 'esp_pwr_peri_display', currentMa: 20 },
  { id: 'camera', labelKey: 'esp_pwr_peri_camera', currentMa: 50 },
  { id: 'gps', labelKey: 'esp_pwr_peri_gps', currentMa: 25 },
  { id: 'lora', labelKey: 'esp_pwr_peri_lora', currentMa: 15 },
];

function formatDuration(hours: number, t: (k: string) => string): string {
  if (!isFinite(hours) || hours <= 0) return '—';
  if (hours < 1) return `${(hours * 60).toFixed(1)} ${t('utilities.esp_pwr_unit_min')}`;
  if (hours < 48) return `${hours.toFixed(1)} ${t('utilities.esp_pwr_unit_hours')}`;
  const days = hours / 24;
  if (days < 60) return `${days.toFixed(1)} ${t('utilities.esp_pwr_unit_days')}`;
  const months = days / 30;
  if (months < 24) return `${months.toFixed(1)} ${t('utilities.esp_pwr_unit_months')}`;
  return `${(days / 365).toFixed(1)} ${t('utilities.esp_pwr_unit_years')}`;
}

function formatCurrent(ma: number): string {
  if (ma < 0.1) return `${(ma * 1000).toFixed(0)} µA`;
  if (ma < 1) return `${ma.toFixed(2)} mA`;
  return `${ma.toFixed(1)} mA`;
}

const Esp32PowerCalc: React.FC = () => {
  const { t } = useTranslation();
  const [chip, setChip] = useState<ChipId>('ESP32');
  const [battery, setBattery] = useState<string>('1000');
  const [enabledPeripherals, setEnabledPeripherals] = useState<Set<string>>(new Set());

  const batteryVal = parseFloat(battery) || 0;
  const chipData = CHIP_DATA[chip];

  const peripheralCurrent = useMemo(() => {
    let total = 0;
    enabledPeripherals.forEach((id) => {
      const p = PERIPHERALS.find((pp) => pp.id === id);
      if (p) total += p.currentMa;
    });
    return total;
  }, [enabledPeripherals]);

  const togglePeripheral = (id: string) => {
    setEnabledPeripherals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isActiveMode = (modeName: string) => modeName.startsWith('Active');

  const modeRows = useMemo(() => {
    return chipData.modes.map((mode) => {
      const extraCurrent = isActiveMode(mode.name) ? peripheralCurrent : 0;
      const totalCurrent = mode.currentMa + extraCurrent;
      const lifeHours = batteryVal > 0 && totalCurrent > 0 ? batteryVal / totalCurrent : 0;
      return {
        name: mode.name,
        baseCurrent: mode.currentMa,
        totalCurrent,
        lifeHours,
        isActive: isActiveMode(mode.name),
      };
    });
  }, [chipData, peripheralCurrent, batteryVal]);

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-auto">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6 rounded-2xl border-2 border-blue-200/60 dark:border-blue-800/50 shadow-lg max-w-3xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center shadow-md">
            <Cpu size={22} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {t('utilities.esp_pwr_title')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('utilities.esp_pwr_desc')}</p>
          </div>
        </div>

        {/* Chip Selection */}
        <div className="mb-4">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-2">
            {t('utilities.esp_pwr_chip')}
          </span>
          <div className="flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setChip(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  chip === c
                    ? 'bg-blue-500 text-white border-blue-500 shadow-md'
                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Battery Input */}
        <div className="mb-4">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
            {t('utilities.esp_pwr_battery')}
          </label>
          <input
            type="number"
            value={battery}
            onChange={(e) => setBattery(e.target.value)}
            min="0"
            className="w-48 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>

        {/* Peripherals */}
        <div className="mb-4 p-3 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-blue-200/40 dark:border-blue-800/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('utilities.esp_pwr_peripherals')}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {t('utilities.esp_pwr_peri_active_only')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIPHERALS.map((p) => (
              <button
                key={p.id}
                onClick={() => togglePeripheral(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5 ${
                  enabledPeripherals.has(p.id)
                    ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
              >
                <span className={`w-3 h-3 rounded border-2 flex items-center justify-center ${
                  enabledPeripherals.has(p.id)
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-slate-300 dark:border-slate-500'
                }`}>
                  {enabledPeripherals.has(p.id) && (
                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                    </svg>
                  )}
                </span>
                {t(`utilities.${p.labelKey}`)}
                {p.currentMa > 0 && (
                  <span className="text-[10px] opacity-60">+{p.currentMa}mA</span>
                )}
              </button>
            ))}
          </div>
          {peripheralCurrent > 0 && (
            <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-mono">
              {t('utilities.esp_pwr_peri_total')}: +{peripheralCurrent} mA
            </div>
          )}
        </div>

        {/* Power Mode Table */}
        <div className="rounded-xl overflow-hidden border border-blue-200/50 dark:border-blue-800/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-100/80 dark:bg-blue-900/40">
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t('utilities.esp_pwr_mode')}
                </th>
                <th className="text-right px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t('utilities.esp_pwr_base_current')}
                </th>
                <th className="text-right px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t('utilities.esp_pwr_total_current')}
                </th>
                <th className="text-right px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t('utilities.esp_pwr_battery_life')}
                </th>
              </tr>
            </thead>
            <tbody>
              {modeRows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-t border-blue-100/50 dark:border-blue-800/20 ${
                    row.isActive
                      ? 'bg-white/80 dark:bg-slate-800/60'
                      : 'bg-blue-50/40 dark:bg-blue-950/20'
                  }`}
                >
                  <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          row.isActive
                            ? 'bg-red-400'
                            : row.name.includes('Deep')
                              ? 'bg-green-400'
                              : row.name.includes('Light')
                                ? 'bg-yellow-400'
                                : 'bg-blue-400'
                        }`}
                      />
                      {row.name}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                    {formatCurrent(row.baseCurrent)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300 font-medium">
                    {formatCurrent(row.totalCurrent)}
                    {row.isActive && peripheralCurrent > 0 && (
                      <span className="text-[10px] text-blue-500 ml-1">+{peripheralCurrent}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`font-mono font-bold ${
                        row.lifeHours > 24 * 365
                          ? 'text-green-600 dark:text-green-400'
                          : row.lifeHours > 24 * 30
                            ? 'text-teal-600 dark:text-teal-400'
                            : row.lifeHours > 24
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-orange-600 dark:text-orange-400'
                      }`}
                    >
                      {formatDuration(row.lifeHours, t)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">
          {t('utilities.esp_pwr_disclaimer')}
        </p>
      </div>
    </div>
  );
};

export default Esp32PowerCalc;
