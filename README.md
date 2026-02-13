# LILYGO Spark

A cross-platform firmware hub and flasher for LILYGO and other ESP devices.

## 配置文件 `lilygo_config.json`

应用依赖仓库内的 **`lilygo_config.json`**（已提交到 Git），用于配置 API 地址、固件清单地址和 OSS 域名。打包时该文件会随应用一起发布。

### 必填字段（缺一不可，否则启动报错）

| 字段 | 说明 |
|------|------|
| `api_base_url` | 服务端 API 根地址（如上传、登录等） |
| `firmware_manifest_url` | 默认固件清单的在线 URL |
| `oss_domain_prefix` | OSS 域名前缀（固件文件下载域名） |

### 配置加载顺序

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
  "oss_domain_prefix": "https://your-bucket.oss.region.aliyuncs.com"
}
```

## Firmware Configuration

The application uses a JSON manifest to list available devices and firmware. The manifest URL is read from `lilygo_config.json` (see above).

### Manifest and images

- **Local fallback**: If the remote manifest fails to load, the app falls back to a built-in `firmware_manifest.json`.
- **Images**: Stored in `public/devices/`; in manifest use `"image_url": "devices/t-deck.jpg"`. For remote manifests, `image_url` can be full URLs.

## Development

### Install Dependencies

```bash
npm install
```

### Run in Development Mode

```bash
npm run dev
```

### Build for Production（打包）

打包会包含仓库根目录的 `lilygo_config.json`，无需额外复制。若缺少该文件或必填字段为空，应用启动时会弹窗报错并退出。

```bash
npm run build          # 当前平台
npm run build:mac      # macOS
npm run build:win      # Windows
npm run build:linux    # Linux
npm run build:mac:universal  # macOS 通用包
```
