# Changelog

All notable changes to LILYGO Spark since the Chinese New Year 2025 (Jan 29) release.

---

## [Unreleased] — 2025-01-29 ~ 2026-03-05

### New Features

- **Firmware Analyzer** — Analyze `.bin` firmware files: detect chip type, partition table, bootloader, app info, filesystem images (SPIFFS/LittleFS/FAT), and board name heuristics. Masonry layout UI with comprehensive ESP32 chip support. One-click analyze from firmware list.

- **OSS Firmware Mirror** — Alibaba Cloud OSS mirror for firmware downloads (mainland China acceleration). Download cache management with size tracking and one-click clear. Batch script for downloading, hashing, compressing, and uploading firmware to OSS.

- **Embedded Toolbox** — 12 offline tools: Resistor Color Code Calculator (4/5/6-band), SMD Resistor Calculator, LED Resistor Calculator, Ohm's Law Calculator, 555 Timer Calculator (astable & monostable), Battery Life Calculator, ESP32 Power Estimator, Series/Parallel Resistor Calculator, Circuit Schematic Viewer, Voltage Regulator Calculator, RC Time Constant Calculator, Image Converter (image → C array for embedded displays).

- **Spark Lab** — Sparkling List (feature roadmap and inspiration board) and Usage Guide (product introduction and quick-start guide), merged into a single sidebar item with tab navigation.

- **Feedback System** — Submit bug reports, feature requests, and suggestions with screenshot attachments and auto-collected device info. Integrated into Settings page as a tab.

- **Firmware Lab** — Merged "Firmware Burner" and "Firmware Toolbox" into a single sidebar item with tabs: Burner → Dumper → Analyzer → Partition Editor.

- **Auto-Rotating Accent Color** — 8 accent colors rotate every half day (noon 12:00 and midnight 0:00). Default mode is "rotating"; user can switch to "fixed". Sleep/wake recovery via `visibilitychange` listener. DEV-only polling for instant response to manual system time changes.

- **Sidebar Tooltips** — Hover over any nav item to see a description of the section. Full i18n support (EN/中文/繁體/日本語).

- **Serial Monitor** — Real-time serial port monitoring with baud rate selection. Extracted as standalone component.

- **Partition Table Editor** — Visual editor for ESP32 partition tables. Import from firmware analyzer, export to file.

- **Discovery Page** — Curated content and recommendations.

- **Glass Morphism Effect** — Toggleable glass morphism UI effect across the app.

- **Flash Celebration Styles** — 6 celebration styles: Fireworks, Hacker, Minimal, Neon, Terminal, Gradient.

- **Sound Effects** — Toggle sound effects for various app interactions.

- **Auto Updates** — Stable and Canary (nightly) dual update channels. Canary version format: `v{Version}-canary.{Date}.{Time}`.

- **GitHub OAuth Login** — Login with GitHub to upload firmware.

- **Windows Driver Detection** — Auto-detect USB serial drivers on Windows (pnputil).

### Bug Fixes

- Fix `Attempted to register a second handler for 'check-for-updates'` error on macOS window reopen
- Suppress update-not-found alert on automatic update checks (only show on manual check)
- Fix unused imports (`useMemo`, `Microscope`, `useRef`) causing tsc build failures
- Fix serial port display in BurnerModal flash dialog
- Fix firmware analyzer board name false positives
- Fix scientific accuracy issues in embedded tool calculators
- Fix Linux and Windows build issues
- Fix release page artifact naming
- Fix variable errors in build scripts
- Fix resistor calculator bugs
- Fix flash animation and burner issues
- Fix release image problems
- Exclude Windows-only fonts on other platforms
- Fix i18n and icon issues

### Refactoring

- **Major refactor of `FirmwareUtilities.tsx`** (1400+ lines → deleted): Extracted into dedicated components (`FirmwareAnalyzerTool`, `SerialMonitorTool`, `PartitionEditorTool`, `ImageConverterTool`, `RegulatorCalc`, `RcTimeConstantCalc`). Moved all electronic calculator components into `src/components/toolbox/` subfolder. Created `ToolboxPage` as container for offline tools.

- Merged sidebar items for cleaner navigation: "灵感火花" + "使用指引" → "Spark Lab"; "固件刷写工具" + "固件工具箱" → "Firmware Lab"; "产品反馈" → moved into Settings tab.

### CI/CD

- GitHub Actions automated build and release pipeline
- Dual-channel updates: Stable (tag-triggered) and Canary (push-triggered)
- Build matrix: macOS (arm64/x64/universal), Windows (x64), Linux (x64 AppImage/deb/rpm)
- Automated release cleanup and artifact management

---

# 更新日志

自 2025 年春节（1月29日）以来 LILYGO Spark 的所有重要更新。

---

## [未发布] — 2025-01-29 ~ 2026-03-05

### 新功能

- **固件分析器** — 分析 `.bin` 固件文件：检测芯片类型、分区表、引导程序、应用信息、文件系统镜像（SPIFFS/LittleFS/FAT）、开发板名称推断。瀑布流布局 UI，全面支持 ESP32 系列芯片。支持从固件列表一键跳转分析。

- **固件 OSS 镜像加速** — 阿里云 OSS 镜像加速固件下载（中国大陆用户）。下载缓存管理，支持大小统计和一键清除。批处理脚本自动下载、哈希计算、压缩并上传固件到 OSS。

- **哆啦A梦百宝箱（嵌入式工具箱）** — 12 个离线工具：电阻色环计算器（4/5/6 环）、贴片电阻计算器、LED 限流电阻计算器、欧姆定律计算器、555 定时器计算器（无稳态和单稳态）、电池续航计算器、ESP32 功耗估算器、串/并联电阻计算器、电路原理图查看器、稳压器计算器、RC 时间常数计算器、图片转换器（图片转 C 数组，用于嵌入式显示屏）。

- **Spark Lab** — 灵感火花（功能路线图和灵感看板）和使用指引（产品介绍和快速上手指南），合并为单个侧边栏项，内部使用 tab 切换。

- **产品反馈系统** — 提交 Bug 报告、功能需求和建议，支持截图附件和设备信息自动采集。已整合到设置页面作为 tab。

- **固件研究所** — 将「固件刷写工具」和「固件工具箱」合并为单个侧边栏项，内含四个 tab：烧录 → 提取 → 分析 → 分区编辑。

- **主题色自动轮换** — 8 种主题色每半天自动切换一次（中午 12:00 和午夜 0:00）。默认为「自动轮换」模式，用户可切换为「固定颜色」。支持休眠唤醒后自动校准（`visibilitychange` 监听）。开发模式下支持轮询检测手动修改系统时间。

- **侧边栏悬停提示** — 鼠标悬停在任意导航项上可查看该栏目的功能介绍。完整支持四语言国际化（中/英/繁/日）。

- **串口监视器** — 实时串口监视器，支持波特率选择。从原 FirmwareUtilities 中独立为单独组件。

- **分区表编辑器** — 可视化 ESP32 分区表编辑器，支持从固件分析器导入、导出到文件。

- **Discovery 页面** — 精选内容与推荐。

- **毛玻璃效果** — 全局可切换的毛玻璃 UI 效果。

- **烧录庆祝动画** — 6 种庆祝风格：烟花、黑客、极简、霓虹、终端、渐变。

- **音效** — 可切换的应用交互音效。

- **自动更新** — Stable（正式版）和 Canary（测试版）双更新频道。Canary 版本号格式：`v{版本}-canary.{日期}.{时间}`。

- **GitHub OAuth 登录** — 使用 GitHub 账号登录后可上传固件。

- **Windows 驱动检测** — 自动检测 Windows 上的 USB 串口驱动（pnputil）。

### Bug 修复

- 修复 macOS 关闭窗口后重新打开时 `Attempted to register a second handler for 'check-for-updates'` 错误
- 自动检测更新无新版本时不再弹窗提示（仅手动检查时弹出）
- 修复未使用的 import（`useMemo`、`Microscope`、`useRef`）导致 tsc 构建失败
- 修复 BurnerModal 烧录对话框中串口显示问题
- 修复固件分析器开发板名称误判
- 修复嵌入式工具计算器的科学准确性问题
- 修复 Linux 和 Windows 构建问题
- 修复发布页面构建产物命名
- 修复构建脚本中的变量错误
- 修复电阻计算器 Bug
- 修复烧录动画和烧录器问题
- 修复发布页面图片问题
- 非 Windows 平台排除 Windows 专用字体
- 修复国际化和图标问题

### 重构

- **`FirmwareUtilities.tsx` 大重构**（1400+ 行 → 已删除）：拆分为独立组件（`FirmwareAnalyzerTool`、`SerialMonitorTool`、`PartitionEditorTool`、`ImageConverterTool`、`RegulatorCalc`、`RcTimeConstantCalc`）。所有电子计算器组件移至 `src/components/toolbox/` 子文件夹。创建 `ToolboxPage` 作为离线工具容器。

- 合并侧边栏项以简化导航：「灵感火花」+「使用指引」→「Spark Lab」；「固件刷写工具」+「固件工具箱」→「固件研究所」；「产品反馈」→ 移入设置页 tab。

### CI/CD

- GitHub Actions 自动化构建和发布流水线
- 双频道更新：Stable（Tag 触发）和 Canary（Push 触发）
- 构建矩阵：macOS（arm64/x64/universal）、Windows（x64）、Linux（x64 AppImage/deb/rpm）
- 自动化发布清理和构建产物管理
