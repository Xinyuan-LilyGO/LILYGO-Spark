import { app, ipcMain } from 'electron';
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

export function setupConfigHandler() {
  ipcMain.handle('get-firmware-manifest', async () => {
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
    console.error('所有 manifest 地址均失败，主地址及', mirrors.length, '个镜像，尝试本地 manifest...');

    const localPaths: string[] = [];
    if (app.isPackaged) {
      localPaths.push(path.join(process.resourcesPath, 'firmware_manifest.json'));
      localPaths.push(path.join(path.dirname(app.getPath('exe')), 'firmware_manifest.json'));
    } else {
      localPaths.push(path.join(app.getAppPath(), 'firmware_manifest.json'));
      localPaths.push(path.join(app.getAppPath(), '..', 'firmware_manifest.json'));
      localPaths.push(path.join(process.cwd(), 'firmware_manifest.json'));
      localPaths.push(path.join(process.cwd(), '..', 'firmware_manifest.json'));
    }

    for (const localManifestPath of localPaths) {
      if (fs.existsSync(localManifestPath)) {
        try {
          const data = fs.readFileSync(localManifestPath, 'utf-8');
          const parsed = JSON.parse(data);
          console.log('[Manifest] 使用本地 manifest:', localManifestPath);
          return parsed;
        } catch (e) {
          console.warn(`[Manifest] 解析本地文件失败 ${localManifestPath}:`, e);
        }
      }
    }

    console.error('Local manifest not found at any:', localPaths);
    return { product_list: [], firmware_list: [] };
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
