import { app, ipcMain, dialog, type BrowserWindow } from 'electron';
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
  return path.join(app.getAppPath(), 'lilygo_config.json');
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

export function setupConfigHandler(mainWindow?: BrowserWindow | null) {
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
    return { product_list: [], firmware_list: [] };
  });

  ipcMain.handle('get-custom-manifest-path', async () => getCustomManifestPath());

  ipcMain.handle('select-firmware-manifest-file', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Firmware Manifest (JSON)',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths?.[0]) return null;
    const filePath = result.filePaths[0];
    const data = loadManifestFromFile(filePath);
    if (data == null) throw new Error('Invalid or empty JSON file');
    setCustomManifestPath(filePath);
    mainWindow?.webContents?.send('manifest-source-changed');
    return filePath;
  });

  ipcMain.handle('clear-custom-manifest', async () => {
    setCustomManifestPath(null);
    mainWindow?.webContents?.send('manifest-source-changed');
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

  try {
    getConfig();
  } catch (err) {
    console.error('Invalid or missing lilygo_config.json:', err);
    throw err;
  }
}
