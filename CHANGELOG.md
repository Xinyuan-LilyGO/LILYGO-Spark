# Changelog / 更新日志

All notable changes to LILYGO Spark since the Chinese New Year 2025 (Jan 29) release.

自 2025 年春节（1月29日）以来的所有重要更新。

---

## [Unreleased] — 2025-01-29 ~ 2026-03-05

### New Features / 新功能

- **Firmware Analyzer / 固件分析器**
  - Analyze `.bin` firmware files: detect chip type, partition table, bootloader, app info, filesystem images (SPIFFS/LittleFS/FAT), board name heuristics
  - Masonry layout UI with comprehensive ESP32 chip support
  - One-click analyze from firmware list (jump to analyzer with file pre-loaded)
  - Detect filesystem images and fix board name false positives

- **OSS Firmware Mirror / 固件 OSS 镜像加速**
  - Alibaba Cloud OSS mirror for firmware downloads (mainland China acceleration)
  - Download cache management with size tracking and one-click clear
  - Batch script for downloading, hashing, compressing, and uploading firmware to OSS

- **Embedded Toolbox / 嵌入式工具箱 (哆啦A梦百宝箱)**
  - Resistor Color Code Calculator (4/5/6-band)
  - SMD Resistor Calculator
  - LED Resistor Calculator
  - Ohm's Law Calculator
  - 555 Timer Calculator (astable & monostable)
  - Battery Life Calculator
  - ESP32 Power Estimator
  - Series/Parallel Resistor Calculator
  - Circuit Schematic Viewer
  - Voltage Regulator Calculator
  - RC Time Constant Calculator
  - Image Converter (image → C array for embedded displays)

- **Spark Lab**
  - Sparkling List — feature roadmap and inspiration board
  - Usage Guide — product introduction and quick-start guide
  - Merged into a single sidebar item with tab navigation

- **Feedback System / 产品反馈**
  - Submit bug reports, feature requests, and suggestions
  - Screenshot attachment support
  - Device info auto-collection
  - Moved into Settings page as a tab

- **Firmware Lab / 固件研究所**
  - Merged "Firmware Burner" and "Firmware Toolbox" into a single "固件研究所 / Firmware Lab" sidebar item
  - Tabs: Burner → Dumper → Analyzer → Partition Editor

- **Auto-Rotating Accent Color / 主题色自动轮换**
  - 8 accent colors rotate every half day (noon 12:00 and midnight 0:00)
  - Default mode is "rotating"; user can switch to "fixed"
  - Sleep/wake recovery via `visibilitychange` listener
  - DEV-only polling for instant response to manual system time changes

- **Sidebar Tooltips / 侧边栏悬停提示**
  - Hover over any nav item to see a description of the section
  - Full i18n support (EN/中文/繁體/日本語)

- **Serial Monitor / 串口监视器**
  - Extracted as standalone component from FirmwareUtilities
  - Real-time serial port monitoring with baud rate selection

- **Partition Table Editor / 分区表编辑器**
  - Visual editor for ESP32 partition tables
  - Import from firmware analyzer, export to file

- **Discovery Page**
  - Curated content and recommendations

- **Glass Morphism Effect / 毛玻璃效果**
  - Toggleable glass morphism UI effect across the app

- **Flash Celebration Styles / 烧录庆祝动画**
  - 6 celebration styles: Fireworks, Hacker, Minimal, Neon, Terminal, Gradient

- **Sound Effects / 音效**
  - Toggle sound effects for various app interactions

- **Auto Updates / 自动更新**
  - Stable and Canary (nightly) dual update channels
  - Canary version format: `v{Version}-canary.{Date}.{Time}`

- **GitHub OAuth Login**
  - Login with GitHub to upload firmware

- **Windows Driver Detection**
  - Auto-detect USB serial drivers on Windows (pnputil)

### Bug Fixes / 修复

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

### Refactoring / 重构

- **Major refactor of `FirmwareUtilities.tsx`** (1400+ lines → deleted)
  - Extracted into dedicated components: `FirmwareAnalyzerTool`, `SerialMonitorTool`, `PartitionEditorTool`, `ImageConverterTool`, `RegulatorCalc`, `RcTimeConstantCalc`
  - Moved all electronic calculator components into `src/components/toolbox/` subfolder
  - Created `ToolboxPage` as container for offline tools
  - `FirmwareUtilities.tsx` fully deleted

- Merged sidebar items for cleaner navigation:
  - "灵感火花" + "使用指引" → "Spark Lab"
  - "固件刷写工具" + "固件工具箱" → "固件研究所 / Firmware Lab"
  - "产品反馈" → moved into Settings tab

### CI/CD

- GitHub Actions automated build and release pipeline
- Dual-channel updates: Stable (tag-triggered) and Canary (push-triggered)
- Build matrix: macOS (arm64/x64/universal), Windows (x64), Linux (x64 AppImage/deb/rpm)
- Automated release cleanup and artifact management
