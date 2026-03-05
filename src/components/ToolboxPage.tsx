import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Calculator, Clock, Zap, Lightbulb, CircleDot, HardDrive, Battery, Timer, Cpu, GitBranch, CircuitBoard } from 'lucide-react';
import {
  ResistorColorCodeCalc,
  ImageConverterTool,
  RegulatorCalc,
  RcTimeConstantCalc,
  OhmsLawCalc,
  Timer555Calc,
  SmdResistorCalc,
  LedResistorCalc,
  BatteryLifeCalc,
  Esp32PowerCalc,
  SeriesParallelCalc,
  CircuitSchematic,
} from './toolbox';

type ToolId = 'resistor_color' | 'converter' | 'regulator' | 'rc_calc' | 'ohms_law' | 'timer_555' | 'smd_resistor' | 'led_resistor' | 'battery_life' | 'esp32_power' | 'series_parallel' | 'circuit_schematic';

const TABS: { id: ToolId; icon: React.ElementType; labelKey: string }[] = [
  { id: 'resistor_color', icon: CircleDot, labelKey: 'utilities.resistor_color_code' },
  { id: 'converter', icon: ImageIcon, labelKey: 'utilities.image_converter' },
  { id: 'regulator', icon: Calculator, labelKey: 'utilities.regulator_resistor' },
  { id: 'rc_calc', icon: Clock, labelKey: 'utilities.rc_time_constant' },
  { id: 'ohms_law', icon: Zap, labelKey: 'utilities.ohm_title' },
  { id: 'timer_555', icon: Timer, labelKey: 'utilities.t555_title' },
  { id: 'smd_resistor', icon: Cpu, labelKey: 'utilities.smd_resistor' },
  { id: 'led_resistor', icon: Lightbulb, labelKey: 'utilities.led_resistor' },
  { id: 'battery_life', icon: Battery, labelKey: 'utilities.bat_title' },
  { id: 'esp32_power', icon: HardDrive, labelKey: 'utilities.esp_pwr_title' },
  { id: 'series_parallel', icon: GitBranch, labelKey: 'utilities.sp_title' },
  { id: 'circuit_schematic', icon: CircuitBoard, labelKey: 'utilities.circuit_title' },
];

const TOOL_COMPONENTS: Record<ToolId, React.FC> = {
  resistor_color: ResistorColorCodeCalc,
  converter: ImageConverterTool,
  regulator: RegulatorCalc,
  rc_calc: RcTimeConstantCalc,
  ohms_law: OhmsLawCalc,
  timer_555: Timer555Calc,
  smd_resistor: SmdResistorCalc,
  led_resistor: LedResistorCalc,
  battery_life: BatteryLifeCalc,
  esp32_power: Esp32PowerCalc,
  series_parallel: SeriesParallelCalc,
  circuit_schematic: CircuitSchematic,
};

const ToolboxPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTool, setActiveTool] = useState<ToolId>('resistor_color');

  const ActiveComponent = TOOL_COMPONENTS[activeTool];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-6 gap-6 transition-colors relative">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 w-full max-w-4xl">
        {TABS.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            onClick={() => setActiveTool(id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center sm:justify-start ${
              activeTool === id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700/50 border border-slate-300 dark:border-slate-700'
            }`}
          >
            <Icon size={16} className="mr-2 shrink-0" />
            <span className="truncate">{t(labelKey)}</span>
          </button>
        ))}
      </div>

      <ActiveComponent />
    </div>
  );
};

export default ToolboxPage;
