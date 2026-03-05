# LILYGO Spark

A cross-platform firmware hub and flash tool for LILYGO and other ESP devices. Built with Electron + React + TypeScript.

一款面向 LILYGO 及其他 ESP 设备的跨平台固件中心与烧录工具。基于 Electron + React + TypeScript 构建。

---

## English

### Features

#### Firmware Center
- Browse, search, and download official & community firmware for LILYGO devices
- Product filtering with device images, chip type badges, and firmware version info
- One-click download with progress tracking and multi-task support
- OSS mirror acceleration for users in mainland China (Alibaba Cloud CDN)
- Source code links and firmware origin tracing

#### Firmware Lab (固件研究所)
- **Firmware Burner** — Flash firmware to ESP32 devices via Web Serial API with auto chip detection
- **Firmware Dumper** — Read and dump firmware from connected devices
- **Firmware Analyzer** — Analyze `.bin` files: detect chip type, partition table, bootloader, app info, filesystem images (SPIFFS/LittleFS/FAT), and board name heuristics
- **Partition Table Editor** — Visual editor for ESP32 partition tables with import/export

#### Serial Monitor
- Real-time serial port monitor with baud rate selection
- Device log output viewing and filtering

#### Embedded Toolbox (哆啦A梦百宝箱)
- **Resistor Color Code Calculator** — 4/5/6-band resistor decoder with visual color bands
- **SMD Resistor Calculator** — 3/4-digit SMD code decoder
- **LED Resistor Calculator** — Calculate current-limiting resistor for LEDs
- **Ohm's Law Calculator** — Voltage / Current / Resistance / Power calculator
- **555 Timer Calculator** — Astable & monostable mode frequency/duty cycle calculator
- **Battery Life Calculator** — Estimate battery runtime from capacity and load
- **ESP32 Power Estimator** — Estimate power consumption for ESP32 projects
- **Series/Parallel Resistor Calculator** — Calculate equivalent resistance
- **Circuit Schematic Viewer** — Basic circuit diagram reference
- **Voltage Regulator Calculator** — LDO/switching regulator output calculator
- **RC Time Constant Calculator** — RC circuit charge/discharge timing
- **Image Converter** — Convert images to C arrays for embedded displays (drag & drop)

#### Spark Lab
- **Sparkling List** — Feature roadmap and inspiration board
- **Usage Guide** — Product introduction and quick-start guide

#### Discovery
- Curated content and recommendations

#### LILYGO Community
- Links to official community resources, documentation, and related projects

#### Settings & Feedback
- **Settings**: Language (EN/中文/繁體/日本語), theme (light/dark/system), auto-rotating accent color (8 colors, changes every half day), glass morphism effect toggle, sound effects, flash celebration style (6 styles), link open mode, cache management, custom firmware manifest, canary update channel, developer mode
- **Feedback**: Submit bug reports, feature requests, and suggestions with screenshots

#### Other Highlights
- **i18n**: Full internationalization in English, Simplified Chinese, Traditional Chinese, and Japanese
- **Auto Updates**: Stable and Canary (nightly) update channels via electron-updater
- **Sidebar Tooltips**: Hover over any nav item for a description of what's inside
- **Easter Eggs**: Konami code, flash celebration, device detection badge
- **Cross-platform**: macOS, Windows, Linux
- **GitHub Login**: OAuth login for firmware upload

---

### Release & Update Strategy

The project uses a dual-channel update strategy managed by GitHub Actions.

#### 1. Stable Release
*   **Trigger**: Push a git tag starting with `v` (e.g., `v0.1.0`).
*   **Process**:
    *   GitHub Actions builds the app.
    *   Sets the package version to match the tag (e.g., `0.1.0`).
    *   Creates a GitHub Release with the tag name.
    *   Uploads artifacts (dmg, exe, AppImage, etc.).
*   **Update Check**: Users on the default channel will receive this update.

#### 2. Canary (Nightly) Release
*   **Trigger**: Push to the `main` branch or manually trigger the `Build/release` workflow via GitHub Actions UI.
*   **Process**:
    *   GitHub Actions builds the app.
    *   Generates a version number: `v{BaseVersion}-canary.{YYYYMMDD}.{HHMMSS}` (e.g., `v0.1.0-canary.20260215.120000`).
    *   Creates a Pre-release on GitHub.
*   **Update Check**: Users who enabled "Canary Channel" in Settings will receive this update.

### Configuration File `lilygo_config.json`

The app relies on **`lilygo_config.json`** (committed to the repo) for API base URL, firmware manifest URL, and OSS domain. This file is bundled with the app when building.

#### Required Fields (all required; missing any will cause startup error)

| Field | Description |
|-------|-------------|
| `api_base_url` | Server API root URL (e.g. upload, login) |
| `firmware_manifest_url` | Default firmware manifest URL |
| `firmware_manifest_mirrors` | Optional. Array of OSS mirror URLs for other regions. Tried in order when primary fails (e.g. mainland China mirror when Hong Kong OSS times out) |
| `oss_domain_prefix` | OSS domain prefix for firmware downloads |

#### Config Loading Order

1. **Built-in config**: Read from `lilygo_config.json` bundled in the app.
2. **User override**: If `lilygo_config.json` exists in the user data directory, it overrides fields with the same name.

User config paths:
- **macOS**: `~/Library/Application Support/LILYGO Spark/lilygo_config.json`
- **Windows**: `%APPDATA%\LILYGO Spark\lilygo_config.json`
- **Linux**: `~/.config/LILYGO Spark/lilygo_config.json`

Example (user override only needs fields to change; merges with built-in config):
```json
{
  "api_base_url": "https://your-api.example.com",
  "firmware_manifest_url": "https://your-api.example.com/manifest/firmware_manifest.json",
  "firmware_manifest_mirrors": [
    "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/firmware_manifest.json"
  ],
  "oss_domain_prefix": "https://your-bucket.oss.region.aliyuncs.com"
}
```

### Firmware Configuration

The app uses a JSON manifest to list available devices and firmware. The manifest URL is read from `lilygo_config.json` (see above).

- **Multi-region mirrors**: Configure `firmware_manifest_mirrors` in `lilygo_config.json` to add OSS URLs in other regions (e.g. mainland China). When the primary Hong Kong OSS times out (e.g. on some mobile carriers), the app will try mirrors in order.
- **Local fallback**: If all remote URLs fail, the app falls back to a built-in `firmware_manifest.json`.
- **Images**: Stored in `public/devices/`; in manifest use `"image_url": "devices/t-deck.jpg"`. For remote manifests, `image_url` can be full URLs.

### Development

#### Install Dependencies

```bash
npm install
```

#### Run in Development Mode

```bash
npm run dev
```

#### Build for Production

The build includes `lilygo_config.json` from the repo root. No extra copy needed. If the file or required fields are missing, the app will show an error dialog and exit on startup.

```bash
npm run build              # Current platform
npm run build:mac          # macOS
npm run build:win          # Windows
npm run build:linux        # Linux
npm run build:mac:universal  # macOS universal binary
```

### Release & Updates

This project uses GitHub Actions for CI/CD, supporting **Stable** and **Canary** update channels.

#### 1. Release Stable Version

Stable releases follow strict SemVer (e.g., `v0.1.0`). Triggered only by pushing a `v*` Git Tag.

**Steps:**

1. Update `version` in `package.json` (e.g., `0.1.0`).
2. Commit and Tag:
   ```bash
   git commit -am "release: v0.1.0"
   git tag v0.1.0
   git push origin main --tags
   ```
3. GitHub Actions will build and publish to "Latest" release. Users on default settings will see the update.

#### 2. Release Canary Version

Canary builds are for testing latest changes. Version format: `v{Version}-canary.{Date}.{Time}`.

**Triggers:**

*   **Auto**: Push to `main` branch.
*   **Manual**: Run `Build/release` workflow in GitHub Actions.

**How to Update:**

Users must enable "Canary Channel" in "Settings -> Advanced" to receive these updates.

---

### Firmware OSS Mirror Specification

To solve firmware download issues for users in mainland China, all firmware files from `firmware_manifest.json` are mirrored to Alibaba Cloud OSS. A batch script handles downloading, hashing, compressing, and generating metadata.

#### File Naming Convention

Each firmware file is processed into two files:

| Type | Format | Example |
|------|--------|---------|
| **Compressed firmware** | `{sha256_prefix}_{original_filename}.zip` | `6e18ad12aff4ce43_ESP32_GENERIC_S3.bin.zip` |
| **Metadata** | `{sha256_prefix}_{original_filename}.json` | `6e18ad12aff4ce43_ESP32_GENERIC_S3.bin.json` |

- `sha256_prefix`: First 16 hex characters of the original file's SHA256 hash (64-bit space, collision-free for this scale)
- `original_filename`: The original filename from the source URL
- Compression: ZIP with maximum deflate (level 9)

#### Metadata JSON Format

```json
{
  "filename": "6e18ad12aff4ce43_ESP32_GENERIC_S3.bin.zip",
  "originalFilename": "ESP32_GENERIC_S3.bin",
  "originalSize": 1676624,
  "compressedSize": 1234567,
  "md5": "6d54a855ebe2bd4684ff77035ed40f80",
  "sha256": "6e18ad12aff4ce431a6c8b6edf958daec5e3903ef7015a5aa6fb56e2b7a6290d",
  "sourceUrl": "https://raw.githubusercontent.com/...",
  "uploadedAt": "2026-03-04T12:00:00.000Z",
  "downloadUrl": "https://lilygo.oss-accelerate.aliyuncs.com/firmware/6e18ad12aff4ce43_ESP32_GENERIC_S3.bin.zip",
  "compression": "zip"
}
```

| Field | Description |
|-------|-------------|
| `filename` | Final filename on OSS (with hash prefix) |
| `originalFilename` | Original filename from source |
| `originalSize` | Original file size in bytes |
| `compressedSize` | Compressed ZIP size in bytes |
| `md5` | MD5 hash of the original (uncompressed) file |
| `sha256` | SHA256 hash of the original (uncompressed) file |
| `sourceUrl` | Original download URL (GitHub, etc.) |
| `uploadedAt` | ISO 8601 timestamp of when the file was processed |
| `downloadUrl` | Full OSS download URL |
| `compression` | Compression format (`zip`) |

#### Batch Script Usage

```bash
# Download all firmware, compress, and generate metadata (10 concurrent downloads)
node scripts/download_firmware.mjs

# Custom concurrency and output directory
node scripts/download_firmware.mjs --concurrency 5 --output my_firmware

# Re-running is safe — existing files are skipped (idempotent)
```

Output directory structure:
```
firmware_oss/
  6e18ad12aff4ce43_ESP32_GENERIC_S3.bin.zip
  6e18ad12aff4ce43_ESP32_GENERIC_S3.bin.json
  a1b2c3d4e5f67890_firmware-t-deck-tft.bin.zip
  a1b2c3d4e5f67890_firmware-t-deck-tft.bin.json
  ...
```

---

### Easter Eggs & Effects

For hackers and makers who enjoy a bit of fun:

| Trigger | Effect |
|---------|--------|
| **Konami Code** | Press `↑ ↑ ↓ ↓ ← → ← → B A` anywhere in the app → "ACCESS GRANTED" overlay |
| **Flash Success** | When firmware flashing completes successfully → "FLASH COMPLETE ✓" celebration |
| **Device Detected** | When an ESP32 device is detected → "// TARGET ACQUIRED" badge |

---

### ESP32 Chip Support Matrix

| Chip | Architecture | Wi-Fi | Bluetooth | 802.15.4 | Espressif Status | esptool (bundled v4.x) | esptool (latest v5.2) | Spark UI | LILYGO Products |
|------|-------------|-------|-----------|----------|-----------------|----------------------|---------------------|----------|-----------------|
| **ESP32** | Xtensa LX6 Dual-core 240MHz | Wi-Fi 4 | BT 4.2 + BLE | - | Mass Production | ✅ | ✅ | ✅ | T-Display, T-Beam, T-ETH-Lite, T-SIM7600, T-CAN485, T-PCIE, T3 LoRa32 |
| **ESP32-S2** | Xtensa LX7 Single-core 240MHz | Wi-Fi 4 | - | - | Mass Production | ✅ | ✅ | ✅ | T-Dongle S2, ESP32-S2 |
| **ESP32-S3** | Xtensa LX7 Dual-core 240MHz | Wi-Fi 4 | BLE 5 | - | Mass Production | ✅ | ✅ | ✅ | T-Display S3, T-Display S3 AMOLED, T-Deck, T-Deck Plus, T-Dongle S3, T-Watch S3, T3 S3, T4 S3, T-Beam SUPREME, T-Embed, T-Embed CC1101 |
| **ESP32-C2** | RISC-V Single-core 120MHz | Wi-Fi 4 | BLE 5 | - | Mass Production | ✅ | ✅ | ✅ | - |
| **ESP32-C3** | RISC-V Single-core 160MHz | Wi-Fi 4 | BLE 5 | - | Mass Production | ✅ | ✅ | ✅ | T8-C3, T-Zigbee (C3+TLSR8258) |
| **ESP32-C5** | RISC-V Dual-core 240+48MHz | Wi-Fi 6 (2.4+5GHz) | BLE 5 | 802.15.4 | Mass Production | - | ✅ | ✅ | - |
| **ESP32-C6** | RISC-V 160+20MHz | Wi-Fi 6 | BLE 5 | 802.15.4 | Mass Production | ✅ | ✅ | ✅ | T-Display P4 (as secondary MCU) |
| **ESP32-C61** | RISC-V Single-core 160MHz | Wi-Fi 6 | BLE 5 | - | Mass Production | - | ✅ | ✅ | - |
| **ESP32-H2** | RISC-V Single-core 96MHz | - | BLE 5 | 802.15.4 | Mass Production | ✅ | ✅ | ✅ | - |
| **ESP32-H4** | RISC-V | - | BLE 5 | 802.15.4 | Preview | - | ✅ | ✅ | - |
| **ESP32-P4** | RISC-V Dual-core 400MHz | - (needs companion) | - | - | Mass Production | - | ✅ | ✅ | T-Display P4 |

> **Note**: ESP32-P4 is a compute-only SoC without built-in wireless; it typically pairs with an ESP32-C6 for connectivity. The bundled esptool (v4.x) in Spark supports auto-detection for most chips. For the newest chips (C5, C61, H4, P4), updating to esptool v5.2+ is recommended.

---

## 中文

### 功能一览

#### 固件中心
- 浏览、搜索和下载 LILYGO 官方及社区固件
- 产品筛选，含设备图片、芯片类型标签、固件版本信息
- 一键下载，支持进度追踪和多任务并行
- 阿里云 OSS 镜像加速（中国大陆用户）
- 源码链接和固件来源追溯

#### 固件研究所
- **固件烧录** — 通过 Web Serial API 烧录固件到 ESP32 设备，自动检测芯片类型
- **固件提取** — 从已连接设备读取和导出固件
- **固件分析** — 分析 `.bin` 文件：检测芯片类型、分区表、引导程序、应用信息、文件系统镜像（SPIFFS/LittleFS/FAT）、开发板名称推断
- **分区表编辑器** — 可视化 ESP32 分区表编辑器，支持导入/导出

#### 串口工具
- 实时串口监视器，支持波特率选择
- 设备日志输出查看和过滤

#### 哆啦A梦百宝箱（嵌入式工具箱）
- **电阻色环计算器** — 4/5/6 环电阻解码，可视化色环显示
- **贴片电阻计算器** — 3/4 位贴片电阻代码解码
- **LED 限流电阻计算器** — 计算 LED 所需限流电阻
- **欧姆定律计算器** — 电压/电流/电阻/功率计算
- **555 定时器计算器** — 无稳态和单稳态模式频率/占空比计算
- **电池续航计算器** — 根据电池容量和负载估算续航时间
- **ESP32 功耗估算器** — 估算 ESP32 项目功耗
- **串/并联电阻计算器** — 计算等效电阻
- **电路原理图查看器** — 基础电路图参考
- **稳压器计算器** — LDO/开关稳压器输出计算
- **RC 时间常数计算器** — RC 电路充放电时间计算
- **图片转换器** — 将图片转换为嵌入式显示屏用 C 数组（支持拖放）

#### Spark Lab
- **灵感火花** — 功能路线图和灵感看板
- **使用指引** — 产品介绍和快速上手指南

#### Discovery
- 精选内容与推荐

#### LILYGO 社区
- 官方社区资源、文档和相关项目链接

#### 设置与反馈
- **设置**：语言（中/英/繁/日）、主题（浅色/深色/跟随系统）、主题色自动轮换（8 种颜色每半天切换）、毛玻璃效果、音效、烧录庆祝动画（6 种风格）、链接打开方式、缓存管理、自定义固件清单、Canary 更新频道、开发者模式
- **产品反馈**：提交 Bug 报告、功能需求和建议，支持截图

#### 其他亮点
- **国际化**：完整支持英文、简体中文、繁体中文、日文
- **自动更新**：Stable（正式版）和 Canary（测试版）双更新频道
- **侧边栏悬停提示**：鼠标悬停在导航项上可查看栏目介绍
- **彩蛋**：Konami 代码、烧录庆祝动画、设备检测标识
- **跨平台**：macOS、Windows、Linux
- **GitHub 登录**：OAuth 登录后可上传固件

---

### 版本发布与更新策略

本项目采用 GitHub Actions 管理的双通道更新策略。

#### 1. 正式版 (Stable Release)
*   **触发方式**: 推送以 `v` 开头的 Git Tag（例如 `v0.1.0`）。
*   **流程**:
    *   GitHub Actions 自动构建应用。
    *   将应用内部版本号修改为与 Tag 一致（如 `0.1.0`）。
    *   创建 GitHub Release 并上传构建产物（dmg, exe, AppImage 等）。
*   **更新检测**: 默认通道的用户会收到此更新推送。

#### 2. 金丝雀版 (Canary Release)
*   **触发方式**: 推送代码到 `main` 分支，或在 GitHub Actions 页面手动触发 `Build/release` 工作流。
*   **流程**:
    *   GitHub Actions 自动构建应用。
    *   生成带时间戳的版本号：`v{基础版本}-canary.{年月日}.{时分秒}`（例如 `v0.1.0-canary.20260215.120000`）。
    *   创建一个 Pre-release（预发布版本）。
*   **更新检测**: 在设置中开启「Canary 更新频道」的用户会收到此更新推送。

### 配置文件 `lilygo_config.json`

应用依赖仓库内的 **`lilygo_config.json`**（已提交到 Git），用于配置 API 地址、固件清单地址和 OSS 域名。打包时该文件会随应用一起发布。

#### 必填字段（缺一不可，否则启动报错）

| 字段 | 说明 |
|------|------|
| `api_base_url` | 服务端 API 根地址（如上传、登录等） |
| `firmware_manifest_url` | 默认固件清单的在线 URL |
| `firmware_manifest_mirrors` | 可选，多地区 OSS 镜像 URL 数组，主地址失败时按序尝试（如联通网络访问香港 OSS 超时时可回退到大陆镜像） |
| `oss_domain_prefix` | OSS 域名前缀（固件文件下载域名） |

#### 配置加载顺序

1. **内置配置**：从应用包内读取仓库中的 `lilygo_config.json`。
2. **用户覆盖**：若用户数据目录下存在 `lilygo_config.json`，则覆盖同名字段。

用户配置路径：
- **macOS**: `~/Library/Application Support/LILYGO Spark/lilygo_config.json`
- **Windows**: `%APPDATA%\LILYGO Spark\lilygo_config.json`
- **Linux**: `~/.config/LILYGO Spark/lilygo_config.json`

示例（用户覆盖时只需写要改的字段，可与内置配置合并）：
```json
{
  "api_base_url": "https://your-api.example.com",
  "firmware_manifest_url": "https://your-api.example.com/manifest/firmware_manifest.json",
  "firmware_manifest_mirrors": [
    "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/firmware_manifest.json"
  ],
  "oss_domain_prefix": "https://your-bucket.oss.region.aliyuncs.com"
}
```

### 固件配置

应用通过 JSON 清单列出可用设备和固件，清单 URL 从 `lilygo_config.json` 读取（见上文）。

- **多地区镜像**：在 `lilygo_config.json` 中配置 `firmware_manifest_mirrors` 可添加其他地区（如中国大陆）的 OSS 地址。当主香港 OSS 超时（如部分运营商网络）时，应用会按序尝试镜像。
- **本地回退**：若所有远程 URL 均失败，应用会回退到内置的 `firmware_manifest.json`。
- **图片**：存放在 `public/devices/`；清单中使用 `"image_url": "devices/t-deck.jpg"`。远程清单中 `image_url` 可为完整 URL。

### 开发

#### 安装依赖

```bash
npm install
```

#### 开发模式运行

```bash
npm run dev
```

#### 打包发布

打包会包含仓库根目录的 `lilygo_config.json`，无需额外复制。若缺少该文件或必填字段为空，应用启动时会弹窗报错并退出。

```bash
npm run build              # 当前平台
npm run build:mac          # macOS
npm run build:win          # Windows
npm run build:linux        # Linux
npm run build:mac:universal  # macOS 通用包
```

### 发布与更新

本项目采用自动化 CI/CD 流程（GitHub Actions）进行构建和发布，支持 **Stable（正式版）** 和 **Canary（测试版）** 两个更新频道。

#### 1. 发布 Stable 正式版

正式版版本号严格遵循 SemVer 规范（如 `v0.1.0`）。只有打上 `v*` 格式的 Git Tag 才会触发正式版构建。

**操作步骤：**

1. 修改 `package.json` 中的 `version` 字段（如 `0.1.0`）。
2. 提交代码并打 Tag：
   ```bash
   git commit -am "release: v0.1.0"
   git tag v0.1.0
   git push origin main --tags
   ```
3. GitHub Actions 会自动构建，并发布到 GitHub Releases 的 `Latest` 标记下。用户在默认设置下即可检测到更新。

#### 2. 发布 Canary 测试版

测试版用于快速迭代，包含最新的功能修复。版本号格式为 `v{版本}-canary.{日期}.{时间}`（如 `v0.1.0-canary.20260215.120000`）。

**触发方式：**

*   **自动触发**：每次向 `main` 分支推送代码（Push）或合并 PR 时，会自动构建 Canary 版本。
*   **手动触发**：在 GitHub Actions 页面手动运行 `Build/release` workflow。

**用户如何获取：**

用户需在「设置 -> 高级模式」中开启「Canary 更新频道」，即可检测并更新到最新的 Canary 版本。

#### 3. 版本号比较规则

应用内置的更新检测遵循 SemVer 优先原则：
*   `0.1.0` (正式版) > `0.1.0-canary...` (测试版)
*   `0.1.0-canary.20260216...` (新测试版) > `0.1.0-canary.20260215...` (旧测试版)

---

### 固件 OSS 镜像规范

为解决中国大陆用户从 GitHub 下载固件困难的问题，所有 `firmware_manifest.json` 中的固件文件会镜像到阿里云 OSS。批处理脚本负责下载、哈希计算、压缩和生成元数据。

#### 文件命名规范

每个固件文件生成两个文件：

| 类型 | 格式 | 示例 |
|------|------|------|
| **压缩固件** | `{sha256前缀}_{原始文件名}.zip` | `6e18ad12aff4ce43_ESP32_GENERIC_S3.bin.zip` |
| **元数据** | `{sha256前缀}_{原始文件名}.json` | `6e18ad12aff4ce43_ESP32_GENERIC_S3.bin.json` |

- `sha256前缀`：原始文件 SHA256 哈希的前 16 位十六进制字符（64-bit 空间，此规模下不会碰撞）
- `原始文件名`：源 URL 中的原始文件名
- 压缩方式：ZIP 最大压缩（deflate level 9）

#### 元数据 JSON 格式

```json
{
  "filename": "6e18ad12aff4ce43_ESP32_GENERIC_S3.bin.zip",
  "originalFilename": "ESP32_GENERIC_S3.bin",
  "originalSize": 1676624,
  "compressedSize": 1234567,
  "md5": "6d54a855ebe2bd4684ff77035ed40f80",
  "sha256": "6e18ad12aff4ce431a6c8b6edf958daec5e3903ef7015a5aa6fb56e2b7a6290d",
  "sourceUrl": "https://raw.githubusercontent.com/...",
  "uploadedAt": "2026-03-04T12:00:00.000Z",
  "downloadUrl": "https://lilygo.oss-accelerate.aliyuncs.com/firmware/6e18ad12aff4ce43_ESP32_GENERIC_S3.bin.zip",
  "compression": "zip"
}
```

| 字段 | 说明 |
|------|------|
| `filename` | OSS 上的最终文件名（含哈希前缀） |
| `originalFilename` | 源文件原始名称 |
| `originalSize` | 原始文件大小（字节） |
| `compressedSize` | ZIP 压缩后大小（字节） |
| `md5` | 原始（未压缩）文件的 MD5 哈希 |
| `sha256` | 原始（未压缩）文件的 SHA256 哈希 |
| `sourceUrl` | 原始下载 URL（GitHub 等） |
| `uploadedAt` | 处理时间（ISO 8601） |
| `downloadUrl` | 完整的 OSS 下载地址 |
| `compression` | 压缩格式（`zip`） |

#### 批处理脚本用法

```bash
# 下载全部固件、压缩并生成元数据（10 路并发）
node scripts/download_firmware.mjs

# 自定义并发数和输出目录
node scripts/download_firmware.mjs --concurrency 5 --output my_firmware

# 重复运行是安全的 —— 已存在的文件会跳过（幂等）
```

输出目录结构：
```
firmware_oss/
  6e18ad12aff4ce43_ESP32_GENERIC_S3.bin.zip
  6e18ad12aff4ce43_ESP32_GENERIC_S3.bin.json
  a1b2c3d4e5f67890_firmware-t-deck-tft.bin.zip
  a1b2c3d4e5f67890_firmware-t-deck-tft.bin.json
  ...
```

---

### 彩蛋与特效

为喜欢小惊喜的极客和创客准备：

| 触发条件 | 效果 |
|----------|------|
| **Konami 彩蛋** | 在应用任意位置按 `↑ ↑ ↓ ↓ ← → ← → B A` → 显示「ACCESS GRANTED」弹窗 |
| **烧录成功** | 固件烧录完成时 → 显示「FLASH COMPLETE ✓」庆祝 |
| **设备检测** | 检测到 ESP32 设备时 → 显示「// TARGET ACQUIRED」标识 |

---

### ESP32 芯片支持矩阵

| 芯片 | 架构 | Wi-Fi | 蓝牙 | 802.15.4 | 乐鑫状态 | esptool (内置 v4.x) | esptool (最新 v5.2) | Spark UI | LILYGO 产品 |
|------|------|-------|------|----------|---------|--------------------|--------------------|----------|------------|
| **ESP32** | Xtensa LX6 双核 240MHz | Wi-Fi 4 | BT 4.2 + BLE | - | 量产中 | ✅ | ✅ | ✅ | T-Display, T-Beam, T-ETH-Lite, T-SIM7600, T-CAN485, T-PCIE, T3 LoRa32 |
| **ESP32-S2** | Xtensa LX7 单核 240MHz | Wi-Fi 4 | - | - | 量产中 | ✅ | ✅ | ✅ | T-Dongle S2, ESP32-S2 |
| **ESP32-S3** | Xtensa LX7 双核 240MHz | Wi-Fi 4 | BLE 5 | - | 量产中 | ✅ | ✅ | ✅ | T-Display S3, T-Display S3 AMOLED, T-Deck, T-Deck Plus, T-Dongle S3, T-Watch S3, T3 S3, T4 S3, T-Beam SUPREME, T-Embed, T-Embed CC1101 |
| **ESP32-C2** | RISC-V 单核 120MHz | Wi-Fi 4 | BLE 5 | - | 量产中 | ✅ | ✅ | ✅ | - |
| **ESP32-C3** | RISC-V 单核 160MHz | Wi-Fi 4 | BLE 5 | - | 量产中 | ✅ | ✅ | ✅ | T8-C3, T-Zigbee (C3+TLSR8258) |
| **ESP32-C5** | RISC-V 双核 240+48MHz | Wi-Fi 6 (2.4+5GHz) | BLE 5 | 802.15.4 | 量产中 | - | ✅ | ✅ | - |
| **ESP32-C6** | RISC-V 160+20MHz | Wi-Fi 6 | BLE 5 | 802.15.4 | 量产中 | ✅ | ✅ | ✅ | T-Display P4（作为副 MCU） |
| **ESP32-C61** | RISC-V 单核 160MHz | Wi-Fi 6 | BLE 5 | - | 量产中 | - | ✅ | ✅ | - |
| **ESP32-H2** | RISC-V 单核 96MHz | - | BLE 5 | 802.15.4 | 量产中 | ✅ | ✅ | ✅ | - |
| **ESP32-H4** | RISC-V | - | BLE 5 | 802.15.4 | 预览阶段 | - | ✅ | ✅ | - |
| **ESP32-P4** | RISC-V 双核 400MHz | -（需搭配副芯片） | - | - | 量产中 | - | ✅ | ✅ | T-Display P4 |

> **说明**：ESP32-P4 是纯计算 SoC，不内置无线功能，通常搭配 ESP32-C6 提供连接能力。Spark 内置的 esptool (v4.x) 支持大部分芯片的自动检测。对于最新芯片（C5、C61、H4、P4），建议升级 esptool 至 v5.2+。
