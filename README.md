# LILYGO Spark

A cross-platform firmware hub and burner for LILYGO and other ESP devices.

---

## English

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

### Easter Eggs & Effects

For hackers and makers who enjoy a bit of fun:

| Trigger | Effect |
|---------|--------|
| **Konami Code** | Press `↑ ↑ ↓ ↓ ← → ← → B A` anywhere in the app → "ACCESS GRANTED" overlay |
| **Flash Success** | When firmware flashing completes successfully → "FLASH COMPLETE ✓" celebration |
| **Device Detected** | When an ESP32 device is detected → "// TARGET ACQUIRED" badge |

---

## 中文

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

### 彩蛋与特效

为喜欢小惊喜的极客和创客准备：

| 触发条件 | 效果 |
|----------|------|
| **Konami 彩蛋** | 在应用任意位置按 `↑ ↑ ↓ ↓ ← → ← → B A` → 显示「ACCESS GRANTED」弹窗 |
| **烧录成功** | 固件烧录完成时 → 显示「FLASH COMPLETE ✓」庆祝 |
| **设备检测** | 检测到 ESP32 设备时 → 显示「// TARGET ACQUIRED」标识 |
