import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles, Wifi, Layers, GitCompare, RotateCcw, Database,
  LineChart, Cpu, Search, Bluetooth, MessageSquare,
  Calculator, Zap, Battery, Timer, CircuitBoard, Lightbulb,
  Ruler, Radio, PcCase,
  Box, Bot, Star, ShieldCheck, FolderCog,
  Send, ChevronDown, ChevronUp, CheckCircle2, Clock, Flame
} from 'lucide-react';

type Status = 'done' | 'planned' | 'idea';

interface SparkItem {
  icon: React.ReactNode;
  nameEn: string;
  nameZh: string;
  descEn: string;
  descZh: string;
  status: Status;
}

interface SparkCategory {
  icon: string;
  titleEn: string;
  titleZh: string;
  gradient: string;
  borderColor: string;
  items: SparkItem[];
}

const statusConfig: Record<Status, { label: string; labelZh: string; emoji: string; className: string }> = {
  done: { label: 'Shipped', labelZh: '已实现', emoji: '✅', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  planned: { label: 'Planned', labelZh: '计划中', emoji: '🔜', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  idea: { label: 'Spark', labelZh: '灵感', emoji: '💡', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
};

const categories: SparkCategory[] = [
  {
    icon: '🔧',
    titleEn: 'Flash & Firmware Management',
    titleZh: '刷写 & 固件管理',
    gradient: 'from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20',
    borderColor: 'border-violet-200/60 dark:border-violet-700/40',
    items: [
      { icon: <Wifi size={16} />, nameEn: 'WiFi OTA Wireless Flash', nameZh: 'WiFi OTA 无线刷写', descEn: 'Flash firmware over WiFi without USB cable', descZh: '通过 WiFi 无线刷写固件，无需 USB 连接', status: 'planned' },
      { icon: <Layers size={16} />, nameEn: 'Multi-Device Batch Flash', nameZh: '多设备批量刷写', descEn: 'Flash multiple boards simultaneously', descZh: '同时为多个开发板批量刷写固件', status: 'idea' },
      { icon: <GitCompare size={16} />, nameEn: 'Firmware Diff Compare', nameZh: '固件版本差异对比', descEn: 'Visual diff between firmware versions', descZh: '可视化对比不同固件版本的差异', status: 'idea' },
      { icon: <RotateCcw size={16} />, nameEn: 'Firmware Rollback & Backup', nameZh: '固件回滚/备份管理', descEn: 'Backup current firmware and rollback anytime', descZh: '备份当前固件，随时回滚到之前的版本', status: 'planned' },
      { icon: <Database size={16} />, nameEn: 'Custom Firmware Repository', nameZh: '自定义固件仓库源', descEn: 'Add your own firmware repository sources', descZh: '添加自定义的固件仓库源', status: 'idea' },
    ],
  },
  {
    icon: '🔌',
    titleEn: 'Device Interaction',
    titleZh: '设备交互',
    gradient: 'from-cyan-500/10 to-teal-500/10 dark:from-cyan-500/20 dark:to-teal-500/20',
    borderColor: 'border-cyan-200/60 dark:border-cyan-700/40',
    items: [
      { icon: <LineChart size={16} />, nameEn: 'Serial Plotter', nameZh: '串口数据绘图器', descEn: 'Real-time serial data visualization', descZh: '实时可视化串口数据波形', status: 'planned' },
      { icon: <Cpu size={16} />, nameEn: 'GPIO Live Monitor', nameZh: 'GPIO 实时监控面板', descEn: 'Monitor GPIO pin states in real-time', descZh: '实时监控 GPIO 引脚状态', status: 'idea' },
      { icon: <Search size={16} />, nameEn: 'I2C/SPI Device Scanner', nameZh: 'I2C/SPI 设备扫描器', descEn: 'Scan and identify connected peripherals', descZh: '扫描并识别已连接的外设', status: 'idea' },
      { icon: <Bluetooth size={16} />, nameEn: 'Bluetooth Debug Assistant', nameZh: '蓝牙调试助手', descEn: 'BLE/Classic Bluetooth debugging tool', descZh: 'BLE/经典蓝牙调试工具', status: 'idea' },
      { icon: <MessageSquare size={16} />, nameEn: 'MQTT Test Client', nameZh: 'MQTT 测试客户端', descEn: 'Built-in MQTT client for IoT testing', descZh: '内置 MQTT 客户端用于物联网测试', status: 'idea' },
    ],
  },
  {
    icon: '📐',
    titleEn: 'Embedded Calculators',
    titleZh: '嵌入式计算器',
    gradient: 'from-rose-500/10 to-pink-500/10 dark:from-rose-500/20 dark:to-pink-500/20',
    borderColor: 'border-rose-200/60 dark:border-rose-700/40',
    items: [
      { icon: <Zap size={16} />, nameEn: "Ohm's Law Calculator", nameZh: '欧姆定律计算器', descEn: 'Calculate voltage, current, resistance', descZh: '计算电压、电流、电阻', status: 'done' },
      { icon: <Timer size={16} />, nameEn: '555 Timer Calculator', nameZh: '555 定时器计算器', descEn: 'Design 555 timer circuits', descZh: '设计 555 定时器电路', status: 'done' },
      { icon: <Battery size={16} />, nameEn: 'Battery Life Calculator', nameZh: '电池续航计算器', descEn: 'Estimate battery runtime', descZh: '估算电池续航时间', status: 'done' },
      { icon: <Cpu size={16} />, nameEn: 'ESP32 Power Mode Calculator', nameZh: 'ESP32 功耗模式计算器', descEn: 'Calculate ESP32 power consumption', descZh: '计算 ESP32 各模式功耗', status: 'done' },
      { icon: <CircuitBoard size={16} />, nameEn: 'Series/Parallel R/C Calculator', nameZh: '串并联电阻/电容计算器', descEn: 'Calculate series & parallel combinations', descZh: '计算串并联电阻/电容组合值', status: 'done' },
      { icon: <CircuitBoard size={16} />, nameEn: 'Interactive Circuit Schematic', nameZh: '交互式电路原理图', descEn: 'Interactive circuit diagram viewer', descZh: '交互式电路原理图查看器', status: 'done' },
      { icon: <Lightbulb size={16} />, nameEn: 'LED Current Limiting Resistor', nameZh: 'LED 限流电阻计算器', descEn: 'Calculate LED resistor values', descZh: '计算 LED 限流电阻值', status: 'done' },
      { icon: <Calculator size={16} />, nameEn: 'SMD Resistor Calculator', nameZh: 'SMD 贴片电阻计算器', descEn: 'Decode SMD resistor markings', descZh: '解码 SMD 贴片电阻标识', status: 'done' },
      { icon: <Calculator size={16} />, nameEn: 'Resistor Color Code Calculator', nameZh: '电阻色环计算器', descEn: 'Read resistor color bands', descZh: '读取电阻色环值', status: 'done' },
      { icon: <Clock size={16} />, nameEn: 'RC Time Constant Calculator', nameZh: 'RC 时间常数计算器', descEn: 'Calculate RC circuit timing', descZh: '计算 RC 电路时间常数', status: 'done' },
      { icon: <Ruler size={16} />, nameEn: 'Voltage Divider Calculator', nameZh: '分压电阻计算器', descEn: 'Design voltage divider circuits', descZh: '设计分压电阻电路', status: 'done' },
      { icon: <Radio size={16} />, nameEn: 'Power/dBm Converter', nameZh: '功率/dBm 转换器', descEn: 'Convert between Watts and dBm', descZh: '瓦特与 dBm 之间互转', status: 'planned' },
      { icon: <Radio size={16} />, nameEn: 'Antenna Impedance Matching', nameZh: '天线阻抗匹配计算器', descEn: 'Smith chart & impedance matching', descZh: '史密斯圆图与阻抗匹配', status: 'idea' },
      { icon: <PcCase size={16} />, nameEn: 'PCB Trace Width Calculator', nameZh: 'PCB 走线宽度计算器', descEn: 'Calculate trace width for current capacity', descZh: '根据电流容量计算走线宽度', status: 'idea' },
    ],
  },
  {
    icon: '🎨',
    titleEn: 'Creative & Differentiation',
    titleZh: '创意 & 差异化',
    gradient: 'from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20',
    borderColor: 'border-amber-200/60 dark:border-amber-700/40',
    items: [
      { icon: <Box size={16} />, nameEn: '3D Board Preview (Three.js)', nameZh: '3D 板卡预览 (Three.js)', descEn: 'Interactive 3D preview of dev boards', descZh: '开发板的交互式 3D 预览', status: 'idea' },
      { icon: <Bot size={16} />, nameEn: 'AI Firmware Recommender', nameZh: 'AI 固件推荐助手', descEn: 'AI-powered firmware suggestions', descZh: 'AI 驱动的固件智能推荐', status: 'idea' },
      { icon: <Star size={16} />, nameEn: 'Community Firmware Ratings', nameZh: '社区固件评分系统', descEn: 'Rate and review community firmware', descZh: '社区固件评分与评价', status: 'idea' },
      { icon: <ShieldCheck size={16} />, nameEn: 'Hardware Compatibility Check', nameZh: '硬件兼容性检测', descEn: 'Verify firmware-hardware compatibility', descZh: '验证固件与硬件的兼容性', status: 'planned' },
      { icon: <FolderCog size={16} />, nameEn: 'Project Template Generator', nameZh: '项目模板生成器', descEn: 'Generate project boilerplate code', descZh: '生成项目脚手架代码', status: 'idea' },
    ],
  },
];

const SparklingList: React.FC<{ onNavigateToFeedback?: () => void }> = ({ onNavigateToFeedback }) => {
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');
  const [expandedCategories, setExpandedCategories] = useState<Record<number, boolean>>(
    Object.fromEntries(categories.map((_, i) => [i, true]))
  );

  const toggleCategory = (index: number) => {
    setExpandedCategories(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0);
  const doneItems = categories.reduce((sum, cat) => sum + cat.items.filter(i => i.status === 'done').length, 0);
  const plannedItems = categories.reduce((sum, cat) => sum + cat.items.filter(i => i.status === 'planned').length, 0);
  const ideaItems = totalItems - doneItems - plannedItems;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-3 mb-4">
          <span className="text-4xl">✨</span>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 via-pink-500 to-amber-500 bg-clip-text text-transparent">
            Sparkling List
          </h1>
          <span className="text-4xl">✨</span>
        </div>
        <p className="text-lg text-slate-600 dark:text-slate-300 font-medium">
          {isZh ? '灵感火花清单' : 'Sparkling Ideas Collection'}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto">
          {isZh
            ? '收集 LILYGO Spark 未来的功能创意与路线图，每一个灵感都可能成为下一个闪亮的功能'
            : 'A collection of future feature ideas and roadmap for LILYGO Spark — every spark could become the next shining feature'}
        </p>

        {/* Stats */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/60 dark:border-emerald-700/40">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{doneItems} {isZh ? '已实现' : 'Shipped'}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200/60 dark:border-blue-700/40">
            <Clock size={14} className="text-blue-500" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{plannedItems} {isZh ? '计划中' : 'Planned'}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-700/40">
            <Flame size={14} className="text-amber-500" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{ideaItems} {isZh ? '灵感' : 'Sparks'}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-5 max-w-md mx-auto">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>{isZh ? '总体进度' : 'Overall Progress'}</span>
            <span>{Math.round((doneItems / totalItems) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
              style={{ width: `${(doneItems / totalItems) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-6">
        {categories.map((cat, catIndex) => {
          const expanded = expandedCategories[catIndex] ?? true;
          const catDone = cat.items.filter(i => i.status === 'done').length;
          return (
            <div
              key={catIndex}
              className={`rounded-2xl border ${cat.borderColor} bg-gradient-to-br ${cat.gradient} backdrop-blur-sm overflow-hidden transition-shadow hover:shadow-lg`}
            >
              {/* Category header */}
              <button
                onClick={() => toggleCategory(catIndex)}
                className="w-full flex items-center justify-between px-5 py-4 text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      {isZh ? cat.titleZh : cat.titleEn}
                    </h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {catDone}/{cat.items.length} {isZh ? '已完成' : 'completed'}
                    </span>
                  </div>
                </div>
                <div className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors">
                  {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </button>

              {/* Items */}
              {expanded && (
                <div className="px-5 pb-4 space-y-2">
                  {cat.items.map((item, itemIndex) => {
                    const sc = statusConfig[item.status];
                    return (
                      <div
                        key={itemIndex}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                          item.status === 'done'
                            ? 'bg-white/60 dark:bg-slate-800/40'
                            : 'bg-white/80 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800/80 hover:shadow-md'
                        }`}
                      >
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                          item.status === 'done'
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400'
                            : item.status === 'planned'
                              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                              : 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'
                        }`}>
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-semibold ${
                            item.status === 'done'
                              ? 'text-slate-500 dark:text-slate-400 line-through decoration-emerald-400/50'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}>
                            {isZh ? item.nameZh : item.nameEn}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {isZh ? item.descZh : item.descEn}
                          </div>
                        </div>
                        <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${sc.className}`}>
                          <span>{sc.emoji}</span>
                          <span className="hidden sm:inline">{isZh ? sc.labelZh : sc.label}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit idea CTA */}
      <div className="mt-10 text-center">
        <div className="inline-block p-[2px] rounded-2xl bg-gradient-to-r from-violet-500 via-pink-500 to-amber-500">
          <div className="rounded-2xl bg-white dark:bg-slate-900 px-8 py-6">
            <Sparkles className="mx-auto mb-3 text-pink-500" size={28} />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
              {isZh ? '有新的灵感火花？' : 'Got a Sparkling Idea?'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
              {isZh
                ? '我们期待听到你的创意！每一个好点子都可能出现在未来的版本中'
                : "We'd love to hear your ideas! Every great suggestion could make it into a future release"}
            </p>
            <button
              onClick={() => onNavigateToFeedback?.()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 via-pink-500 to-amber-500 text-white font-semibold text-sm shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 hover:scale-105 transition-all duration-200 active:scale-95"
            >
              <Send size={16} />
              {isZh ? '提交你的创意' : 'Submit Your Idea'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SparklingList;
