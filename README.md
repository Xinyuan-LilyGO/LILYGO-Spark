# LILYGO Spark

A cross-platform firmware hub and flasher for LILYGO and other ESP devices.

## Firmware Configuration

The application uses a JSON manifest to list available devices and firmware.

### Configuration Methods

1.  **Local Manifest (Default)**
    *   The application includes a built-in `firmware_manifest.json` file.
    *   Images are stored locally in the `public/devices/` directory.
    *   Example image path in JSON: `"image_url": "devices/t-deck.jpg"` (Relative to public root).

2.  **Remote Manifest (Custom)**
    *   You can override the default manifest by creating a `lilygo_config.json` file in your user data directory.
    *   **Config File Path**:
        *   **macOS**: `~/Library/Application Support/LILYGO-Spark/lilygo_config.json`
        *   **Windows**: `%APPDATA%\LILYGO-Spark\lilygo_config.json`
        *   **Linux**: `~/.config/LILYGO-Spark/lilygo_config.json`
    *   **Config Content**:
        ```json
        {
          "firmware_manifest_url": "https://raw.githubusercontent.com/your-repo/manifest.json"
        }
        ```
    *   **Remote Image URLs**: When using a remote manifest, `image_url` fields should be full URLs (e.g., `"https://example.com/images/t-deck.jpg"`).

## Development

### Install Dependencies

```bash
npm install
```

### Run in Development Mode

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```
