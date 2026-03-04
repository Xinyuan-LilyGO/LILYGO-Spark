/**
 * Pure JS/TS firmware analyzer for ESP32 .bin files.
 * Parses image headers, extended headers, and partition tables
 * without requiring Python or native esptool binaries.
 *
 * References:
 *   - esptool/bin_image.py (image format)
 *   - esptool/targets/*.py (IMAGE_CHIP_ID values)
 *   - ESP-IDF partition table format (0xAA50 magic)
 */

// ─── Chip ID table (from esptool v5.2 + latest master) ─────────────────────

export const ESP_IMAGE_MAGIC = 0xE9;
export const PARTITION_TABLE_MAGIC = 0x50AA; // little-endian of 0xAA50

export interface ChipInfo {
  name: string;
  bootloaderOffset: number;
}

export const CHIP_ID_TABLE: Record<number, ChipInfo> = {
  0x0000: { name: 'ESP32',        bootloaderOffset: 0x1000 },
  0x0002: { name: 'ESP32-S2',     bootloaderOffset: 0x1000 },
  0x0004: { name: 'ESP32-S3β2',   bootloaderOffset: 0x0000 },
  0x0005: { name: 'ESP32-C3',     bootloaderOffset: 0x0000 },
  0x0007: { name: 'ESP32-C6β',    bootloaderOffset: 0x0000 },
  0x0009: { name: 'ESP32-S3',     bootloaderOffset: 0x0000 },
  0x000A: { name: 'ESP32-H2β1',   bootloaderOffset: 0x0000 },
  0x000C: { name: 'ESP32-C2',     bootloaderOffset: 0x0000 },
  0x000D: { name: 'ESP32-C6',     bootloaderOffset: 0x0000 },
  0x000E: { name: 'ESP32-H2β2',   bootloaderOffset: 0x0000 },
  0x0010: { name: 'ESP32-H2',     bootloaderOffset: 0x0000 },
  0x0012: { name: 'ESP32-P4',     bootloaderOffset: 0x2000 },
  0x0014: { name: 'ESP32-C61',    bootloaderOffset: 0x0000 },
  0x0017: { name: 'ESP32-C5',     bootloaderOffset: 0x2000 },
  0x001C: { name: 'ESP32-H4',     bootloaderOffset: 0x2000 },
  0x001F: { name: 'ESP32-E22',    bootloaderOffset: 0x0000 },
  0x0020: { name: 'ESP32-S31',    bootloaderOffset: 0x2000 },
};

// ─── Flash size / freq / mode lookup tables ─────────────────────────────────

const FLASH_SIZES: Record<number, string> = {
  0x00: '1MB',
  0x10: '2MB',
  0x20: '4MB',
  0x30: '8MB',
  0x40: '16MB',
  0x50: '32MB',
  0x60: '64MB',
  0x70: '128MB',
};

const FLASH_FREQS: Record<number, string> = {
  0x0F: '80MHz',
  0x00: '40MHz',
  0x01: '26MHz',
  0x02: '20MHz',
};

const FLASH_MODES: Record<number, string> = {
  0x00: 'QIO',
  0x01: 'QOUT',
  0x02: 'DIO',
  0x03: 'DOUT',
};

// ─── Result interfaces ──────────────────────────────────────────────────────

export interface PartitionEntry {
  label: string;
  type: number;
  subtype: number;
  offset: string;
  size: string;
  size_dec: number;
  encrypted: boolean;
}

export interface ExtendedHeaderInfo {
  wp_pin: string;
  spi_pins: string;
  chip_id: number;
  min_rev: string;
  max_rev: string;
  append_digest: boolean;
}

export interface AppDescription {
  version: string;
  project_name: string;
  compile_time: string;
  compile_date: string;
  idf_version: string;
  elf_sha256: string;
  secure_version: number;
}

export interface FrameworkInfo {
  name: 'ESP-IDF' | 'Arduino' | 'MicroPython' | 'CircuitPython' | 'Tasmota' | 'ESPHome' | 'Rust' | 'Unknown';
  version?: string;
  details?: string;
}

export interface ComponentFingerprints {
  gcc_version?: string;
  arch?: string;
  newlib_version?: string;
  mbedtls_version?: string;
  lvgl_version?: string;
  mpy_platform?: string;
  mpy_board?: string;
  mpy_machine?: string;
  mpy_python_ver?: string;
  mpy_frozen_modules?: string[];
  has_wifi?: boolean;
  has_bluetooth?: boolean;
  has_nimble?: boolean;
  has_lvgl?: boolean;
  has_littlefs?: boolean;
  has_fatfs?: boolean;
  has_spiffs?: boolean;
  has_lora?: boolean;
  has_oled_ssd1306?: boolean;
  has_camera?: boolean;
  has_usb_host?: boolean;
  has_tinyusb?: boolean;
  tls_protocols?: string[];
  display_drivers?: string[];
  touch_drivers?: string[];
  camera_sensors?: string[];
  audio_codecs?: string[];
  imu_sensors?: string[];
  ai_features?: string[];     // wakenet, multinet, esp_tts
  protocols?: string[];       // mqtt, opus, websocket, mdns
}

export interface FirmwareAnalysisResult {
  chip?: string;
  chip_id?: number;
  flash_mode?: string;
  flash_freq?: string;
  flash_size_raw?: number;
  bootloader_flash_size?: string;
  entry_point?: string;
  segments?: number;
  is_full_image?: boolean;
  partition_table_offset?: string;
  partitions?: PartitionEntry[];
  chip_guess?: string;
  error?: string;
  header_error?: string;
  extended_header?: ExtendedHeaderInfo;
  app_desc?: AppDescription;
  framework?: FrameworkInfo;
  components?: ComponentFingerprints;
}

// ─── Core analysis function ─────────────────────────────────────────────────

export function analyzeFirmwareBuffer(data: ArrayBuffer): FirmwareAnalysisResult {
  const buf = new Uint8Array(data);
  const view = new DataView(data);
  const result: FirmwareAnalysisResult = {};

  if (buf.length < 24) {
    return { error: 'File too small to be a valid firmware image' };
  }

  // ── 1. Scan all known bootloader offsets for chip + header info ─────────
  //    0x0000 — ESP32-S3/C3/C6/H2/C2/S2 (app-only images also start here)
  //    0x1000 — ESP32 (classic)
  //    0x2000 — ESP32-P4/C5/H4/S31/E22
  const bootloaderOffsets = [0x0000, 0x1000, 0x2000];

  for (const offset of bootloaderOffsets) {
    if (buf.length <= offset + 24) continue;
    if (buf[offset] !== ESP_IMAGE_MAGIC) continue;

    const chipHere = detectChipAt(buf, view, offset);
    if (chipHere && !result.chip) {
      result.chip = chipHere.name;
      result.chip_id = chipHere.chipId;
    }

    try {
      const header = parseCommonHeader(buf, view, offset);
      if (!result.bootloader_flash_size) {
        result.segments = header.segments;
        result.flash_mode = header.flashMode;
        result.flash_freq = header.flashFreq;
        result.bootloader_flash_size = header.flashSize;
        result.flash_size_raw = header.flashSizeRaw;
        result.entry_point = header.entryPoint;
      }
    } catch { /* ignore */ }

    if (result.chip && result.bootloader_flash_size) break;
  }

  // ── 2. Scan for partition table ────────────────────────────────────────
  const ptOffsets = [0x8000, 0x9000, 0x10000, 0x20000];
  for (const offset of ptOffsets) {
    if (buf.length > offset + 2) {
      const magic = view.getUint16(offset, true);
      if (magic === PARTITION_TABLE_MAGIC) {
        const partitions = parsePartitionTable(buf, view, offset);
        if (partitions.length > 0) {
          result.partitions = partitions;
          result.is_full_image = true;
          result.partition_table_offset = `0x${offset.toString(16)}`;
          break;
        }
      }
    }
  }

  // ── 3. Heuristic chip guess from partition table offset ────────────────
  if (!result.chip && result.partition_table_offset) {
    if (result.partition_table_offset === '0x8000') {
      result.chip_guess = 'ESP32';
    } else if (result.partition_table_offset === '0x9000') {
      result.chip_guess = 'ESP32-S3/C3/S2';
    }
  }

  if (!result.chip && !result.chip_guess) {
    const hasAnyMagic = bootloaderOffsets.some(
      off => buf.length > off && buf[off] === ESP_IMAGE_MAGIC
    );
    if (!hasAnyMagic) {
      result.error = 'Not a valid ESP firmware image (missing 0xE9 magic)';
    }
  }

  // ── 4. Parse extended header ───────────────────────────────────────────
  for (const offset of bootloaderOffsets) {
    if (buf.length <= offset + 24) continue;
    if (buf[offset] !== ESP_IMAGE_MAGIC) continue;
    result.extended_header = parseExtendedHeader(view, offset + 8);
    break;
  }

  // ── 5. Find esp_app_desc_t (magic 0xABCD5432) ─────────────────────────
  result.app_desc = findAppDescription(buf, view);

  // ── 6. Detect build framework ──────────────────────────────────────────
  result.framework = detectFramework(buf, result.app_desc);

  // ── 7. Scan component fingerprints ─────────────────────────────────────
  result.components = scanComponentFingerprints(buf);

  return result;
}

// ─── Quick chip detection (for Burner auto-detect) ──────────────────────────

export function detectChipFromBuffer(data: ArrayBuffer): string | null {
  const buf = new Uint8Array(data);
  const view = new DataView(data);

  if (buf.length < 24) return null;

  for (const offset of [0x0000, 0x1000, 0x2000]) {
    if (buf.length > offset + 24 && buf[offset] === ESP_IMAGE_MAGIC) {
      const r = detectChipAt(buf, view, offset);
      if (r) return r.name;
    }
  }

  return null;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function detectChipAt(
  buf: Uint8Array,
  view: DataView,
  offset: number
): { name: string; chipId: number } | null {
  if (buf.length < offset + 24) return null;
  if (buf[offset] !== ESP_IMAGE_MAGIC) return null;

  // Extended header starts at offset+8, chip_id is at bytes 4-5 (uint16 LE)
  const extHeaderStart = offset + 8;
  if (buf.length < extHeaderStart + 16) return null;

  const chipId = view.getUint16(extHeaderStart + 4, true);
  const info = CHIP_ID_TABLE[chipId];
  if (info) {
    return { name: info.name, chipId };
  }

  return null;
}

interface ParsedHeader {
  segments: number;
  flashMode: string;
  flashFreq: string;
  flashSize: string;
  flashSizeRaw: number;
  entryPoint: string;
}

function parseCommonHeader(
  _buf: Uint8Array,
  view: DataView,
  offset: number
): ParsedHeader {
  const segments = view.getUint8(offset + 1);
  const flashModeRaw = view.getUint8(offset + 2);
  const flashSizeFreq = view.getUint8(offset + 3);
  const entryPoint = view.getUint32(offset + 4, true);

  const flashSizeBits = flashSizeFreq & 0xF0;
  const flashFreqBits = flashSizeFreq & 0x0F;

  return {
    segments,
    flashMode: FLASH_MODES[flashModeRaw] ?? `0x${flashModeRaw.toString(16)}`,
    flashFreq: FLASH_FREQS[flashFreqBits] ?? `0x${flashFreqBits.toString(16)}`,
    flashSize: FLASH_SIZES[flashSizeBits] ?? `Unknown(0x${flashSizeBits.toString(16)})`,
    flashSizeRaw: flashSizeBits >> 4,
    entryPoint: `0x${entryPoint.toString(16).padStart(8, '0')}`,
  };
}

/**
 * Parse ESP-IDF partition table from binary data.
 * Each entry is 32 bytes. Magic = 0xAA50 (LE: 0x50AA at bytes 0-1).
 * Table ends when magic is not found or entry is all 0xFF.
 */
function parsePartitionTable(
  buf: Uint8Array,
  view: DataView,
  tableOffset: number
): PartitionEntry[] {
  const entries: PartitionEntry[] = [];
  const maxEntries = 96; // ESP-IDF max
  const entrySize = 32;

  for (let i = 0; i < maxEntries; i++) {
    const entryOffset = tableOffset + i * entrySize;
    if (buf.length < entryOffset + entrySize) break;

    const magic = view.getUint16(entryOffset, true);
    if (magic !== PARTITION_TABLE_MAGIC) break;

    const type = view.getUint8(entryOffset + 2);
    const subtype = view.getUint8(entryOffset + 3);
    const partOffset = view.getUint32(entryOffset + 4, true);
    const partSize = view.getUint32(entryOffset + 8, true);

    // Label: 16 bytes at offset 12, null-terminated
    const labelBytes = buf.slice(entryOffset + 12, entryOffset + 28);
    const nullIdx = labelBytes.indexOf(0);
    const label = new TextDecoder().decode(
      labelBytes.slice(0, nullIdx >= 0 ? nullIdx : labelBytes.length)
    );

    const flags = view.getUint32(entryOffset + 28, true);
    const encrypted = (flags & 0x01) !== 0;

    entries.push({
      label,
      type,
      subtype,
      offset: `0x${partOffset.toString(16)}`,
      size: `0x${partSize.toString(16)}`,
      size_dec: partSize,
      encrypted,
    });
  }

  return entries;
}

// ─── Extended header parser ─────────────────────────────────────────────────

function parseExtendedHeader(view: DataView, offset: number): ExtendedHeaderInfo {
  const wpPin = view.getUint8(offset);
  const spiDrv0 = view.getUint8(offset + 1);
  const spiDrv1 = view.getUint8(offset + 2);
  const spiDrv2 = view.getUint8(offset + 3);
  const chipId = view.getUint16(offset + 4, true);
  const minRev = view.getUint8(offset + 6);
  const minRevFull = view.getUint16(offset + 7, true);
  const maxRevFull = view.getUint16(offset + 9, true);
  const appendDigest = view.getUint8(offset + 15);

  return {
    wp_pin: wpPin === 0xEE ? '0xEE (disabled)' : `GPIO ${wpPin}`,
    spi_pins: `clk/q=0x${spiDrv0.toString(16).padStart(2, '0')} d/cs=0x${spiDrv1.toString(16).padStart(2, '0')} hd/wp=0x${spiDrv2.toString(16).padStart(2, '0')}`,
    chip_id: chipId,
    min_rev: minRev > 0 || minRevFull > 0
      ? `${Math.floor(minRevFull / 100)}.${minRevFull % 100}`
      : '0.0',
    max_rev: maxRevFull === 0xFFFF || maxRevFull === 0
      ? 'any'
      : `${Math.floor(maxRevFull / 100)}.${maxRevFull % 100}`,
    append_digest: appendDigest === 1,
  };
}

// ─── esp_app_desc_t finder ──────────────────────────────────────────────────
// ESP-IDF embeds this struct in every app binary.
// Layout (256 bytes total):
//   0x00: magic (4B) = 0xABCD5432
//   0x04: secure_version (4B)
//   0x08: reserv1 (8B)
//   0x10: version (32B, null-terminated)
//   0x30: project_name (32B, null-terminated)
//   0x50: time (16B, null-terminated)
//   0x60: date (16B, null-terminated)
//   0x70: idf_ver (32B, null-terminated)
//   0x90: app_elf_sha256 (32B)

const APP_DESC_MAGIC = 0xABCD5432;

function readNullTermString(buf: Uint8Array, offset: number, maxLen: number): string {
  const slice = buf.slice(offset, offset + maxLen);
  const nullIdx = slice.indexOf(0);
  return new TextDecoder().decode(slice.slice(0, nullIdx >= 0 ? nullIdx : maxLen));
}

function findAppDescription(buf: Uint8Array, view: DataView): AppDescription | undefined {
  // Typically at app_offset + 0x20. Common app offsets: 0x10000, 0x20000, 0x0
  // Also scan linearly in first 2MB for the magic
  const searchLimit = Math.min(buf.length - 256, 0x200000);

  for (let i = 0; i <= searchLimit; i += 4) {
    if (view.getUint32(i, true) !== APP_DESC_MAGIC) continue;

    const secureVersion = view.getUint32(i + 4, true);
    const version = readNullTermString(buf, i + 0x10, 32);
    const projectName = readNullTermString(buf, i + 0x30, 32);
    const compileTime = readNullTermString(buf, i + 0x50, 16);
    const compileDate = readNullTermString(buf, i + 0x60, 16);
    const idfVersion = readNullTermString(buf, i + 0x70, 32);

    const sha256Bytes = buf.slice(i + 0x90, i + 0xB0);
    const elfSha256 = Array.from(sha256Bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      version,
      project_name: projectName,
      compile_time: compileTime,
      compile_date: compileDate,
      idf_version: idfVersion,
      elf_sha256: elfSha256,
      secure_version: secureVersion,
    };
  }

  return undefined;
}

// ─── Framework detection ────────────────────────────────────────────────────
// Heuristic: scan for known strings embedded by each framework

function bufferContains(buf: Uint8Array, needle: string, maxScan = 0x400000): boolean {
  const encoded = new TextEncoder().encode(needle);
  const len = encoded.length;
  const limit = Math.min(buf.length - len, maxScan);
  outer:
  for (let i = 0; i <= limit; i++) {
    for (let j = 0; j < len; j++) {
      if (buf[i + j] !== encoded[j]) continue outer;
    }
    return true;
  }
  return false;
}

function extractStringNear(buf: Uint8Array, needle: string, maxScan = 0x400000): string | undefined {
  const encoded = new TextEncoder().encode(needle);
  const len = encoded.length;
  const limit = Math.min(buf.length - len, maxScan);
  outer:
  for (let i = 0; i <= limit; i++) {
    for (let j = 0; j < len; j++) {
      if (buf[i + j] !== encoded[j]) continue outer;
    }
    // Found — read the full null-terminated string starting at i
    const end = Math.min(i + 256, buf.length);
    const slice = buf.slice(i, end);
    const nullIdx = slice.indexOf(0);
    return new TextDecoder().decode(slice.slice(0, nullIdx >= 0 ? nullIdx : 256));
  }
  return undefined;
}

function detectFramework(buf: Uint8Array, appDesc?: AppDescription): FrameworkInfo {
  const idfVer = appDesc?.idf_version;

  // MicroPython
  const mpyMatch = extractStringNear(buf, 'MicroPython v');
  if (mpyMatch) {
    const verMatch = mpyMatch.match(/MicroPython v([\d.]+)/);
    const parts: string[] = [];
    if (verMatch?.[1]) parts.push(`MicroPython ${verMatch[1]}`);
    if (idfVer) parts.push(`ESP-IDF ${idfVer}`);
    return {
      name: 'MicroPython',
      version: parts.join(' + ') || verMatch?.[1],
      details: mpyMatch,
    };
  }

  // CircuitPython
  if (bufferContains(buf, 'CircuitPython')) {
    const cpMatch = extractStringNear(buf, 'Adafruit CircuitPython');
    const verMatch = cpMatch?.match(/CircuitPython ([\d.]+)/);
    const parts: string[] = [];
    if (verMatch?.[1]) parts.push(`CircuitPython ${verMatch[1]}`);
    if (idfVer) parts.push(`ESP-IDF ${idfVer}`);
    return {
      name: 'CircuitPython',
      version: parts.join(' + ') || undefined,
      details: cpMatch,
    };
  }

  // Tasmota
  if (bufferContains(buf, 'Tasmota')) {
    const tasMatch = extractStringNear(buf, 'Tasmota v') || extractStringNear(buf, 'Tasmota ');
    const verMatch = tasMatch?.match(/Tasmota v?([\d.]+)/);
    return {
      name: 'Tasmota',
      version: verMatch?.[1],
      details: tasMatch,
    };
  }

  // ESPHome
  if (bufferContains(buf, 'esphome')) {
    return { name: 'ESPHome', version: idfVer ? `ESP-IDF ${idfVer}` : undefined };
  }

  // Arduino
  if (
    bufferContains(buf, 'arduino_running_core') ||
    bufferContains(buf, 'arduino_event') ||
    bufferContains(buf, 'Arduino.h') ||
    bufferContains(buf, 'ArduinoOTA')
  ) {
    return {
      name: 'Arduino',
      version: idfVer ? `ESP-IDF ${idfVer}` : undefined,
      details: 'ESP32 Arduino Framework',
    };
  }

  // Rust (esp-rs / esp-hal)
  if (bufferContains(buf, 'esp-hal') || bufferContains(buf, 'esp_idf_svc')) {
    return { name: 'Rust', version: idfVer ? `ESP-IDF ${idfVer}` : undefined, details: 'esp-rs / esp-hal' };
  }

  // Plain ESP-IDF
  if (idfVer) {
    return { name: 'ESP-IDF', version: idfVer };
  }

  return { name: 'Unknown' };
}

// ─── Component fingerprint scanner ──────────────────────────────────────────

function extractVersionString(buf: Uint8Array, prefix: string, maxScan = 0x400000): string | undefined {
  const raw = extractStringNear(buf, prefix, maxScan);
  return raw?.trim();
}

function scanFrozenModules(buf: Uint8Array): string[] {
  const modules: string[] = [];
  const seen = new Set<string>();
  const limit = Math.min(buf.length - 3, 0x400000);

  for (let i = 0; i <= limit; i++) {
    if (buf[i] !== 0x2E || buf[i + 1] !== 0x70 || buf[i + 2] !== 0x79) continue; // ".py"
    if (i + 3 < buf.length && buf[i + 3] !== 0x00 && buf[i + 3] !== 0x0A && buf[i + 3] !== 0x20) continue;

    let start = i - 1;
    while (start >= 0 && buf[start] >= 0x20 && buf[start] < 0x7F && buf[start] !== 0x2F) start--;
    start++;

    const name = new TextDecoder().decode(buf.slice(start, i + 3));
    if (/^[a-z_][a-z0-9_]*\.py$/.test(name) && !name.startsWith('_boot') && !seen.has(name)) {
      seen.add(name);
      modules.push(name);
    }
  }
  return modules.sort();
}

function scanComponentFingerprints(buf: Uint8Array): ComponentFingerprints {
  const fp: ComponentFingerprints = {};

  // GCC version
  const gccStr = extractVersionString(buf, 'GCC ');
  if (gccStr) {
    const m = gccStr.match(/GCC (\d+\.\d+\.\d+)/);
    if (m) fp.gcc_version = m[1];
  }

  // Architecture
  if (bufferContains(buf, 'xtensa-esp-elf')) {
    fp.arch = 'xtensa';
  } else if (bufferContains(buf, 'riscv32-esp-elf')) {
    fp.arch = 'riscv32';
  }

  // MicroPython platform string + board + Machine
  const mpyPlatform = extractStringNear(buf, 'MicroPython-');
  if (mpyPlatform) {
    fp.mpy_platform = mpyPlatform;
    const nlMatch = mpyPlatform.match(/newlib([\d.]+)/);
    if (nlMatch) fp.newlib_version = nlMatch[1];
  }

  // Board name: search common prefixes
  const boardPrefixes = ['ESP32_GENERIC', 'LILYGO_', 'TTGO_', 'UM_'];
  for (const prefix of boardPrefixes) {
    const boardStr = extractStringNear(buf, prefix);
    if (boardStr) {
      fp.mpy_board = boardStr.split(/[\x00\n\r ]/)[0];
      break;
    }
  }

  // Machine string: "Machine     : LILYGO TTGO LoRa32 with ESP32"
  const machineStr = extractStringNear(buf, 'Machine');
  if (machineStr) {
    const m = machineStr.match(/Machine\s*:\s*(.+)/);
    if (m) fp.mpy_machine = m[1].split(/[\x00\n]/)[0].trim();
  }

  // Python version: "3.4.0; MicroPython v1.27.0 on 2025-12-09"
  const pyVerStr = extractStringNear(buf, '3.4.');
  if (pyVerStr) {
    const pyMatch = pyVerStr.match(/^(3\.\d+\.\d+); MicroPython/);
    if (pyMatch) fp.mpy_python_ver = pyMatch[1];
  }

  // Frozen modules
  if (mpyPlatform) {
    const modules = scanFrozenModules(buf);
    if (modules.length > 0) fp.mpy_frozen_modules = modules;
  }

  // Mbed TLS version
  const tlsStr = extractVersionString(buf, 'Mbed TLS ');
  if (tlsStr) {
    const m = tlsStr.match(/Mbed TLS ([\d.]+)/);
    if (m) fp.mbedtls_version = m[1];
  }

  // LVGL version: "LVGL v8" or "LVGL v9"
  const lvglStr = extractStringNear(buf, 'LVGL v');
  if (lvglStr) {
    const m = lvglStr.match(/LVGL v(\d+[\d.]*)/);
    if (m) fp.lvgl_version = m[1];
  }

  // TLS protocols
  const protos: string[] = [];
  if (bufferContains(buf, 'TLSv1.3')) protos.push('TLSv1.3');
  if (bufferContains(buf, 'TLSv1.2')) protos.push('TLSv1.2');
  if (bufferContains(buf, 'DTLSv1.2')) protos.push('DTLSv1.2');
  if (protos.length > 0) fp.tls_protocols = protos;

  // Connectivity
  fp.has_wifi = bufferContains(buf, 'wifi firmware version') || bufferContains(buf, 'esp_wifi');
  fp.has_bluetooth = bufferContains(buf, 'BT controller compile version') || bufferContains(buf, 'Bluetooth MAC');
  fp.has_nimble = bufferContains(buf, 'NimBLE') || bufferContains(buf, 'nimble_host');

  // Filesystem
  fp.has_littlefs = bufferContains(buf, 'littlefs') || bufferContains(buf, 'littlefsX_');
  fp.has_fatfs = bufferContains(buf, 'FATFS') || bufferContains(buf, 'fatfs');
  fp.has_spiffs = bufferContains(buf, 'SPIFFS') || bufferContains(buf, 'spiffs');

  // LVGL
  fp.has_lvgl = bufferContains(buf, 'lv_obj_create') || bufferContains(buf, 'lv_disp_');

  // LoRa
  fp.has_lora = bufferContains(buf, 'LORA_CS') || bufferContains(buf, 'sx127') || bufferContains(buf, 'sx126');

  // OLED SSD1306
  fp.has_oled_ssd1306 = bufferContains(buf, 'SSD1306') || bufferContains(buf, 'ssd1306');

  // Camera
  fp.has_camera = bufferContains(buf, 'esp_camera') || bufferContains(buf, 'cam_hal');

  // USB
  fp.has_usb_host = bufferContains(buf, 'usb_host');
  fp.has_tinyusb = bufferContains(buf, 'tinyusb') || bufferContains(buf, 'tusb_');

  // Display drivers
  const displays: string[] = [];
  if (bufferContains(buf, 'st7789')) displays.push('ST7789');
  if (bufferContains(buf, 'st7735')) displays.push('ST7735');
  if (bufferContains(buf, 'gc9a01')) displays.push('GC9A01');
  if (bufferContains(buf, 'ili9341')) displays.push('ILI9341');
  if (bufferContains(buf, 'ili9488')) displays.push('ILI9488');
  if (bufferContains(buf, 'ssd1306')) displays.push('SSD1306');
  if (bufferContains(buf, 'sh1106')) displays.push('SH1106');
  if (displays.length > 0) fp.display_drivers = displays;

  // Touch controllers
  const touch: string[] = [];
  if (bufferContains(buf, 'cst816')) touch.push('CST816');
  if (bufferContains(buf, 'gt911')) touch.push('GT911');
  if (bufferContains(buf, 'ft5x06')) touch.push('FT5x06');
  if (bufferContains(buf, 'ft6x36')) touch.push('FT6x36');
  if (touch.length > 0) fp.touch_drivers = touch;

  // Camera sensors
  const cameras: string[] = [];
  if (bufferContains(buf, 'ov2640')) cameras.push('OV2640');
  if (bufferContains(buf, 'ov5640')) cameras.push('OV5640');
  if (bufferContains(buf, 'gc0308')) cameras.push('GC0308');
  if (bufferContains(buf, 'gc032a')) cameras.push('GC032A');
  if (cameras.length > 0) fp.camera_sensors = cameras;

  // Audio codecs
  const codecs: string[] = [];
  if (bufferContains(buf, 'es8311')) codecs.push('ES8311');
  if (bufferContains(buf, 'es8388')) codecs.push('ES8388');
  if (bufferContains(buf, 'es7210')) codecs.push('ES7210');
  if (bufferContains(buf, 'max98357')) codecs.push('MAX98357');
  if (bufferContains(buf, 'wm8960')) codecs.push('WM8960');
  if (bufferContains(buf, 'tas5805')) codecs.push('TAS5805');
  if (codecs.length > 0) fp.audio_codecs = codecs;

  // IMU / sensors
  const imus: string[] = [];
  if (bufferContains(buf, 'mpu6050')) imus.push('MPU6050');
  if (bufferContains(buf, 'icm20')) imus.push('ICM20x');
  if (bufferContains(buf, 'bmi270')) imus.push('BMI270');
  if (bufferContains(buf, 'bmp280')) imus.push('BMP280');
  if (bufferContains(buf, 'bme280')) imus.push('BME280');
  if (bufferContains(buf, 'qmc5883')) imus.push('QMC5883');
  if (imus.length > 0) fp.imu_sensors = imus;

  // AI / Voice features
  const ai: string[] = [];
  if (bufferContains(buf, 'wakenet')) ai.push('WakeNet');
  if (bufferContains(buf, 'multinet')) ai.push('MultiNet');
  if (bufferContains(buf, 'esp_tts')) ai.push('ESP-TTS');
  if (bufferContains(buf, 'esp_sr')) ai.push('ESP-SR');
  if (ai.length > 0) fp.ai_features = ai;

  // Network protocols
  const netProtos: string[] = [];
  if (bufferContains(buf, 'mqtt')) netProtos.push('MQTT');
  if (bufferContains(buf, 'opus')) netProtos.push('Opus');
  if (bufferContains(buf, 'websocket')) netProtos.push('WebSocket');
  if (bufferContains(buf, 'http_server')) netProtos.push('HTTP Server');
  if (bufferContains(buf, 'mdns')) netProtos.push('mDNS');
  if (bufferContains(buf, 'uac_host')) netProtos.push('UAC Host');
  if (netProtos.length > 0) fp.protocols = netProtos;

  return fp;
}
