# LILYGO Spark — Feature Roadmap & M5Burner Comparison

## Current LILYGO Spark Features

### Pages
| Page | Description |
|------|-------------|
| Discovery | RSS news feed (Hackaday, CNX, Adafruit) |
| Firmware Center | Browse products, download/burn firmware from OSS |
| Firmware Lab | Burner, Dumper, Analyzer, Partition Editor |
| Serial Tools | Serial monitor |
| Embedded Tools | 12 hardware calculators (see below) |
| LILYGO Community | Link cards to external resources |
| Spark Lab | Sparkling list, Guide |
| Settings | Language, theme, accent color, developer mode, auto-update |

### Firmware Lab (4 tabs)
- **Burner** — Flash .bin firmware to ESP32 via serial (esptool-js)
- **Dumper** — Read flash contents from device
- **Analyzer** — Parse .bin header, show chip type, segments, entry point
- **Partition Editor** — View/edit ESP32 partition tables

### Embedded Tools (12 calculators)
1. Resistor Color Code
2. Image Converter (BMP/PNG to C array)
3. Voltage Regulator Resistor (LDO divider)
4. RC Time Constant
5. Ohm's Law
6. 555 Timer
7. SMD Resistor Code
8. LED Resistor
9. Battery Life Estimator
10. ESP32 Power Estimator
11. Series/Parallel Resistor & Capacitor
12. Circuit Schematic Reference

### Other
- GitHub OAuth login
- Firmware upload with admin review
- Multi-mirror download racing
- Auto-update (Windows/macOS/Linux)
- i18n (en, zh-CN, zh-TW, ja)
- Dark/Light theme, accent colors

---

## M5Burner Feature Analysis

M5Burner is M5Stack's official firmware flashing tool for ESP32 devices. Key features:

### Core Features (M5Burner has, Spark also has)
| Feature | M5Burner | Spark | Notes |
|---------|----------|-------|-------|
| Firmware catalog browsing | Yes | Yes | Both browse cloud firmware list |
| Firmware burning (flash) | Yes | Yes | Both use esptool |
| Serial monitor | Yes | Yes | Spark has dedicated Serial Tools page |
| Auto-update | Yes | Yes | |
| Multi-platform (Win/Mac/Linux) | Yes | Yes | |

### Features M5Burner Has That Spark Does NOT Have Yet

#### 1. Share Code / Firmware Sharing
- M5Burner generates a short **share code** (e.g. `m5f-xxxx`) for any firmware
- Users paste the code to instantly jump to that specific firmware
- Great for tutorials, classroom teaching, tech support
- **Priority: HIGH** — already planned for Spark

#### 2. WiFi Credential Configuration (before/after burn)
- Configure WiFi SSID/password before flashing
- Writes credentials to NVS partition so device connects on first boot
- Eliminates manual WiFi setup after flashing
- **Priority: HIGH** — very useful for batch provisioning

#### 3. NVS (Non-Volatile Storage) Editor
- Read/write NVS key-value pairs on device
- Configure device parameters without reflashing
- View current NVS contents
- **Priority: MEDIUM**

#### 4. Firmware Version Management
- Show currently installed firmware version on connected device
- Compare with latest available version
- One-click upgrade to newest version
- **Priority: MEDIUM**

#### 5. Erase Flash
- Full chip erase button
- Erase specific regions (NVS only, app only, full)
- **Priority: LOW** — can be added to Burner tab easily

#### 6. Firmware Search & Filter by Device
- Auto-detect connected device and filter compatible firmware
- Show only firmware matching the connected chip type
- **Priority: MEDIUM** — Spark has manual product selection

#### 7. Batch Burning / Queue
- Queue multiple devices for sequential flashing
- Useful for production line / classroom setup
- **Priority: LOW**

#### 8. Console Log Export
- Export serial monitor output to file
- **Priority: LOW**

---

## Proposed New Features for Spark

### Tier 1 — High Value, Should Do Next

#### A. Share Code (Firmware Deep Link)
**Concept**: Generate a short code (e.g. `spark://fw/a3b8c2`) that links directly to a specific firmware entry.

**Implementation ideas**:
- Code = base62-encoded sha256 prefix (6-8 chars)
- URL scheme: `lilygo-spark://fw/<code>` (deep link) or paste code in search bar
- Server endpoint: `GET /share/<code>` returns firmware metadata
- UI: "Share" button on each firmware card → copy code to clipboard
- UI: Paste code in search bar or dedicated "Enter share code" input → jump to firmware
- QR code generation for the share link

**Use cases**:
- Teacher shares code with students: "Enter `LGS-a3b8c2` to flash today's lab firmware"
- Support: "Please flash firmware code `LGS-xyz123`"
- Blog/tutorial embeds a share code

#### B. WiFi Credential Pre-Configuration
**Concept**: Set WiFi SSID/password before or after flashing, written to NVS.

**Implementation ideas**:
- Add "WiFi Config" section in Burner tab (collapsible)
- After burn completes, optionally write WiFi credentials to NVS partition
- Use esptool to write NVS blob at the correct offset
- Save frequently used WiFi profiles locally

#### C. Erase Flash
**Concept**: Add erase options to Burner tab.

- Full chip erase
- Erase NVS only (reset device config without reflashing)
- Erase OTA partition (force factory reset)
- Simple button group in Burner tab toolbar

### Tier 2 — Medium Value

#### D. Connected Device Detection + Auto-Filter
- When a device is connected, auto-detect chip type (ESP32/S3/C3/etc.)
- Auto-filter firmware list to show only compatible firmware
- Show device info: chip, flash size, MAC address, current firmware (if readable)

#### E. NVS Editor
- Read NVS partition from device
- Display key-value pairs in a table
- Edit values and write back
- Useful for changing WiFi, API keys, device config without reflashing

#### F. Serial Log Export
- "Save to file" button in Serial Monitor
- Export as .txt or .log with timestamps
- Auto-save option (append to rolling log file)

### Tier 3 — Nice to Have

#### G. Batch / Queue Burning
- Add multiple firmware to a burn queue
- Flash sequentially when devices are connected
- Progress tracking per device

#### H. Firmware Diff / Changelog
- Show changelog between firmware versions
- Compare binary sizes, partition layouts

#### I. OTA Update Server
- Spark acts as a local OTA server
- ESP32 devices on the same network can pull updates via HTTP OTA
- Useful for field updates without USB

---

## Hardware Engineer Utility Ideas (Beyond M5Burner)

These are features M5Burner doesn't have but would be valuable for hardware engineers:

| Feature | Description |
|---------|-------------|
| **I2C Scanner** | Scan I2C bus, list detected addresses, identify common chips |
| **GPIO Monitor** | Real-time GPIO pin state viewer (via serial protocol) |
| **Logic Analyzer** (basic) | Capture digital signals via ESP32 GPIO, display waveform |
| **UART Bridge** | Bridge two serial ports (e.g. PC ↔ module via ESP32) |
| **Baud Rate Detector** | Auto-detect baud rate of incoming serial data |
| **Hex Viewer** | View/edit raw flash dump in hex |
| **Checksum Calculator** | MD5/SHA256/CRC32 for local files |
| **Pin Map Reference** | Interactive ESP32 pinout diagrams (by chip variant) |
| **Register Viewer** | Read/write ESP32 peripheral registers for debugging |
| **Flash Size Detector** | Detect actual flash chip size and type |
| **MAC Address Reader** | Read/display all MAC addresses (WiFi, BT, Ethernet) |
| **eFuse Reader** | Read eFuse values (chip revision, flash encryption status, etc.) |
