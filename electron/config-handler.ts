import { app, ipcMain, dialog, session, net, type BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';

const REQUIRED_KEYS = ['api_base_url', 'firmware_manifest_url', 'oss_domain_prefix'] as const;

export interface LilygoConfig {
  api_base_url: string;
  firmware_manifest_url: string;
  /** 可选：多地区 OSS 镜像 URL 列表，主地址失败时按序尝试 */
  firmware_manifest_mirrors?: string[];
  oss_domain_prefix: string;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function loadJsonIfExists(filePath: string): Record<string, unknown> | null {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : null;
    }
  } catch (e) {
    console.error('Error reading config file:', filePath, e);
  }
  return null;
}

function getBundledConfigPath(): string {
  if (app.isPackaged) {
    return path.join(app.getAppPath(), 'lilygo_config.json');
  }
  
  // In dev mode, try multiple locations
  const candidates = [
    path.join(app.getAppPath(), 'lilygo_config.json'),
    path.join(process.cwd(), 'lilygo_config.json'),
    path.join(__dirname, '../../lilygo_config.json'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log('[Config] Found config at:', p);
      return p;
    }
  }
  
  console.warn('[Config] Config file not found in candidates, defaulting to:', candidates[0]);
  return candidates[0];
}

function loadMergedConfig(): LilygoConfig {
  const bundledPath = getBundledConfigPath();
  let merged: Record<string, unknown> = {};

  const bundled = loadJsonIfExists(bundledPath);
  if (bundled) {
    merged = { ...bundled };
  }

  const userDataPath = app.getPath('userData');
  const userConfigPath = path.join(userDataPath, 'lilygo_config.json');
  const userConfig = loadJsonIfExists(userConfigPath);
  if (userConfig) {
    merged = { ...merged, ...userConfig };
  }

  const result: LilygoConfig = {
    api_base_url: '',
    firmware_manifest_url: '',
    oss_domain_prefix: '',
  };
  for (const key of REQUIRED_KEYS) {
    if (!isNonEmptyString(merged[key])) {
      throw new Error(
        `lilygo_config.json 缺少必填字段或值为空: "${key}"。请确保仓库中的 lilygo_config.json 或用户目录下的配置文件包含 api_base_url、firmware_manifest_url、oss_domain_prefix。`
      );
    }
    result[key] = merged[key] as string;
  }
  // 可选：多地区 manifest 镜像
  const mirrorsRaw = merged.firmware_manifest_mirrors;
  if (Array.isArray(mirrorsRaw)) {
    result.firmware_manifest_mirrors = mirrorsRaw.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  }
  return result;
}

let cachedConfig: LilygoConfig | null = null;

function getConfig(): LilygoConfig {
  if (cachedConfig) return cachedConfig;
  cachedConfig = loadMergedConfig();
  return cachedConfig;
}

const FETCH_TIMEOUT_MS = 30000; // 30 秒，应对慢速网络/跨境访问
const FETCH_RETRIES = 3;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function tryFetchManifest(url: string, label: string): Promise<unknown | null> {
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
      if (response.ok) {
        return await response.json();
      }
      console.warn(`[${label}] HTTP ${response.status} (attempt ${attempt}/${FETCH_RETRIES})`);
    } catch (error) {
      const err = error as Error & { code?: string; cause?: { code?: string } };
      const isTimeout = err?.name === 'AbortError' || err?.code === 'UND_ERR_CONNECT_TIMEOUT' || err?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';
      console.warn(`[${label}] ${isTimeout ? '连接超时' : '请求失败'} (attempt ${attempt}/${FETCH_RETRIES})`);
      if (attempt < FETCH_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  return null;
}

const CUSTOM_MANIFEST_STORAGE_KEY = 'custom_firmware_manifest_path';
const DEVELOPER_MODE_STORAGE_KEY = 'developer_mode';
const CANARY_UPDATE_STORAGE_KEY = 'canary_update';
const PROXY_CONFIG_STORAGE_KEY = 'proxy_config';
const FAKE_OLD_VERSION_STORAGE_KEY = 'fake_old_version';
const SIMULATE_GITHUB_DOWN_KEY = 'simulate_github_down';

export interface ProxyConfig {
  mode: 'system' | 'direct' | 'custom';
  protocol?: 'http' | 'socks5';
  host?: string;
  port?: number;
}

function readSettingsFile(): Record<string, unknown> {
  const storePath = path.join(app.getPath('userData'), 'lilygo_spark_settings.json');
  try {
    if (fs.existsSync(storePath)) {
      return JSON.parse(fs.readFileSync(storePath, 'utf-8')) || {};
    }
  } catch { /* ignore */ }
  return {};
}

function writeSettingsFile(data: Record<string, unknown>): void {
  const storePath = path.join(app.getPath('userData'), 'lilygo_spark_settings.json');
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function getProxyConfig(): ProxyConfig {
  try {
    const data = readSettingsFile();
    const cfg = data[PROXY_CONFIG_STORAGE_KEY] as ProxyConfig | undefined;
    if (cfg && typeof cfg === 'object' && ['system', 'direct', 'custom'].includes(cfg.mode)) {
      return cfg;
    }
  } catch { /* ignore */ }
  return { mode: 'system' };
}

function setProxyConfig(config: ProxyConfig): void {
  const data = readSettingsFile();
  data[PROXY_CONFIG_STORAGE_KEY] = config;
  writeSettingsFile(data);
}

export async function applyProxyConfig(config?: ProxyConfig): Promise<void> {
  const cfg = config || getProxyConfig();
  const ses = session.defaultSession;

  switch (cfg.mode) {
    case 'direct':
      await ses.setProxy({ mode: 'direct' });
      console.log('[Proxy] Mode: direct (no proxy)');
      break;
    case 'custom': {
      const proto = cfg.protocol || 'http';
      const host = cfg.host || '127.0.0.1';
      const port = cfg.port || (proto === 'socks5' ? 1080 : 7890);
      const proxyRules = `${proto}://${host}:${port}`;
      await ses.setProxy({ proxyRules });
      console.log(`[Proxy] Mode: custom (${proxyRules})`);
      break;
    }
    default:
      await ses.setProxy({ mode: 'system' });
      console.log('[Proxy] Mode: system');
      break;
  }
}

export function getFakeOldVersion(): boolean {
  try {
    const data = readSettingsFile();
    return !!data[FAKE_OLD_VERSION_STORAGE_KEY];
  } catch { return false; }
}

function setFakeOldVersion(enabled: boolean): void {
  const data = readSettingsFile();
  data[FAKE_OLD_VERSION_STORAGE_KEY] = enabled;
  writeSettingsFile(data);
}

export function getSimulateGithubDown(): boolean {
  try {
    const data = readSettingsFile();
    return !!data[SIMULATE_GITHUB_DOWN_KEY];
  } catch { return false; }
}

function setSimulateGithubDown(enabled: boolean): void {
  const data = readSettingsFile();
  data[SIMULATE_GITHUB_DOWN_KEY] = enabled;
  writeSettingsFile(data);
}

export function getCanaryUpdate(): boolean {
  const userDataPath = app.getPath('userData');
  const storePath = path.join(userDataPath, 'lilygo_spark_settings.json');
  try {
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf-8');
      const data = JSON.parse(raw);
      return !!data?.[CANARY_UPDATE_STORAGE_KEY];
    }
  } catch (e) {
    console.warn('[Config] 读取Canary更新设置失败:', e);
  }
  return false;
}

export function setCanaryUpdate(enabled: boolean): void {
  const userDataPath = app.getPath('userData');
  const storePath = path.join(userDataPath, 'lilygo_spark_settings.json');
  try {
    let data: Record<string, unknown> = {};
    if (fs.existsSync(storePath)) {
      data = JSON.parse(fs.readFileSync(storePath, 'utf-8')) || {};
    }
    data[CANARY_UPDATE_STORAGE_KEY] = enabled;
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Config] 保存Canary更新设置失败:', e);
    throw e;
  }
}

export function getDeveloperMode(): boolean {
  const userDataPath = app.getPath('userData');
  const storePath = path.join(userDataPath, 'lilygo_spark_settings.json');
  try {
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf-8');
      const data = JSON.parse(raw);
      return !!data?.[DEVELOPER_MODE_STORAGE_KEY];
    }
  } catch (e) {
    console.warn('[Config] 读取开发者模式失败:', e);
  }
  return false;
}

function setDeveloperMode(enabled: boolean): void {
  const userDataPath = app.getPath('userData');
  const storePath = path.join(userDataPath, 'lilygo_spark_settings.json');
  try {
    let data: Record<string, unknown> = {};
    if (fs.existsSync(storePath)) {
      data = JSON.parse(fs.readFileSync(storePath, 'utf-8')) || {};
    }
    data[DEVELOPER_MODE_STORAGE_KEY] = enabled;
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Config] 保存开发者模式失败:', e);
    throw e;
  }
}

function getCustomManifestPath(): string | null {
  const userDataPath = app.getPath('userData');
  const storePath = path.join(userDataPath, 'lilygo_spark_settings.json');
  try {
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf-8');
      const data = JSON.parse(raw);
      const p = data?.[CUSTOM_MANIFEST_STORAGE_KEY];
      return typeof p === 'string' && p.trim() ? p.trim() : null;
    }
  } catch (e) {
    console.warn('[Manifest] 读取自定义路径失败:', e);
  }
  return null;
}

function setCustomManifestPath(filePath: string | null): void {
  const userDataPath = app.getPath('userData');
  const storePath = path.join(userDataPath, 'lilygo_spark_settings.json');
  try {
    let data: Record<string, unknown> = {};
    if (fs.existsSync(storePath)) {
      data = JSON.parse(fs.readFileSync(storePath, 'utf-8')) || {};
    }
    if (filePath) {
      data[CUSTOM_MANIFEST_STORAGE_KEY] = filePath;
    } else {
      delete data[CUSTOM_MANIFEST_STORAGE_KEY];
    }
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Manifest] 保存自定义路径失败:', e);
    throw e;
  }
}

function loadManifestFromFile(filePath: string): unknown | null {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('[Manifest] 解析文件失败:', filePath, e);
  }
  return null;
}

function getBundledManifestPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'firmware_manifest.json');
  }
  return path.join(app.getAppPath(), 'firmware_manifest.json');
}


let _mainWindow: BrowserWindow | null = null;
let _onSettingsChanged: (() => void) | null = null;
let _isRegistered = false;

export function setupConfigHandler(mainWindow?: BrowserWindow | null, onSettingsChanged?: () => void) {
  _mainWindow = mainWindow || null;
  if (onSettingsChanged) _onSettingsChanged = onSettingsChanged;

  if (_isRegistered) return;
  _isRegistered = true;

  // 1. 自定义路径（高级模式选择）> 2. 网络 > 3. 内置包内 manifest
  ipcMain.handle('get-firmware-manifest', async () => {
    const customPath = getCustomManifestPath();
    if (customPath) {
      const data = loadManifestFromFile(customPath);
      if (data != null) {
        console.log('[Manifest] 使用高级模式自定义清单:', customPath);
        return data;
      }
      console.warn('[Manifest] 自定义路径文件无效或不存在，回退到网络');
    }

    const config = getConfig();
    const primaryUrl = config.firmware_manifest_url.trim();
    const mirrors = config.firmware_manifest_mirrors ?? [];

    const urlsToTry = [primaryUrl, ...mirrors];
    for (let i = 0; i < urlsToTry.length; i++) {
      const url = urlsToTry[i].trim();
      if (!url) continue;
      const label = i === 0 ? '主地址' : `镜像${i}`;
      const data = await tryFetchManifest(url, label);
      if (data != null) {
        if (i > 0) console.log(`[Manifest] 使用 ${label} 成功: ${url}`);
        return data;
      }
    }
    console.warn('所有 manifest 地址均失败，主地址及', mirrors.length, '个镜像，尝试内置 manifest...');

    const bundledPath = getBundledManifestPath();
    const bundled = loadManifestFromFile(bundledPath);
    if (bundled != null) {
      console.log('[Manifest] 使用内置清单:', bundledPath);
      return bundled;
    }

    const localPaths = app.isPackaged
      ? [path.join(path.dirname(app.getPath('exe')), 'firmware_manifest.json')]
      : [
          path.join(app.getAppPath(), '..', 'firmware_manifest.json'),
          path.join(process.cwd(), 'firmware_manifest.json'),
        ];
    for (const p of localPaths) {
      const data = loadManifestFromFile(p);
      if (data != null) {
        console.log('[Manifest] 使用本地 manifest:', p);
        return data;
      }
    }

    console.error('Local manifest not found at any:', [bundledPath, ...localPaths]);
    return { product_list: [], firmware_list: [], series_list: [] };
  });

  ipcMain.handle('get-custom-manifest-path', async () => getCustomManifestPath());

  ipcMain.handle('get-developer-mode', async () => getDeveloperMode());

  ipcMain.handle('set-developer-mode', async (_event, enabled: boolean) => {
    setDeveloperMode(enabled);
    if (_onSettingsChanged) _onSettingsChanged();
    return true;
  });

  ipcMain.handle('get-canary-update', async () => getCanaryUpdate());

  ipcMain.handle('set-canary-update', async (_event, enabled: boolean) => {
    setCanaryUpdate(enabled);
    return true;
  });

  ipcMain.handle('get-fake-old-version', async () => getFakeOldVersion());
  ipcMain.handle('set-fake-old-version', async (_event, enabled: boolean) => {
    setFakeOldVersion(enabled);
    return true;
  });

  ipcMain.handle('get-simulate-github-down', async () => getSimulateGithubDown());
  ipcMain.handle('set-simulate-github-down', async (_event, enabled: boolean) => {
    setSimulateGithubDown(enabled);
    return true;
  });

  ipcMain.handle('select-firmware-manifest-file', async () => {
    if (!_mainWindow || _mainWindow.isDestroyed()) return null;
    const result = await dialog.showOpenDialog(_mainWindow, {
      title: 'Select Firmware Manifest (JSON)',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths?.[0]) return null;
    const filePath = result.filePaths[0];
    const data = loadManifestFromFile(filePath);
    if (data == null) throw new Error('Invalid or empty JSON file');
    setCustomManifestPath(filePath);
    if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send('manifest-source-changed');
    }
    return filePath;
  });

  ipcMain.handle('clear-custom-manifest', async () => {
    setCustomManifestPath(null);
    if (_mainWindow && !_mainWindow.isDestroyed()) {
      _mainWindow.webContents.send('manifest-source-changed');
    }
    return true;
  });

  ipcMain.handle('get-api-base-url', async () => {
    const config = getConfig();
    return config.api_base_url.replace(/\/$/, '');
  });

  ipcMain.handle('get-oss-domain-prefix', async () => {
    const config = getConfig();
    return config.oss_domain_prefix.replace(/\/$/, '');
  });

  // ── Proxy settings ──
  ipcMain.handle('get-proxy-config', async () => getProxyConfig());

  ipcMain.handle('set-proxy-config', async (_event, config: ProxyConfig) => {
    setProxyConfig(config);
    await applyProxyConfig(config);
    return true;
  });

  ipcMain.handle('test-proxy', async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await net.fetch('https://api.github.com/zen', {
        signal: controller.signal,
        headers: { 'User-Agent': 'LILYGO-Spark-Proxy-Test' },
      });
      clearTimeout(timeout);
      if (!resp.ok) return { success: false, error: `HTTP ${resp.status}` };
      const text = await resp.text();
      return { success: true, message: text.trim() };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  });

  // Apply saved proxy config on startup
  applyProxyConfig().catch(e => console.warn('[Proxy] Failed to apply saved config:', e));

  try {
    getConfig();
  } catch (err) {
    console.error('Invalid or missing lilygo_config.json:', err);
    throw err;
  }
}
