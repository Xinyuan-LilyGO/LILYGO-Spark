import { app, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

const REQUIRED_KEYS = ['api_base_url', 'firmware_manifest_url', 'oss_domain_prefix'] as const;

export interface LilygoConfig {
  api_base_url: string;
  firmware_manifest_url: string;
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
  return result;
}

let cachedConfig: LilygoConfig | null = null;

function getConfig(): LilygoConfig {
  if (cachedConfig) return cachedConfig;
  cachedConfig = loadMergedConfig();
  return cachedConfig;
}

export function setupConfigHandler() {
  ipcMain.handle('get-firmware-manifest', async () => {
    const config = getConfig();
    const manifestUrl = config.firmware_manifest_url.trim();

    try {
      const response = await fetch(manifestUrl);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
      console.warn(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.error('Error fetching remote manifest:', error);
    }

    let localManifestPath = '';
    if (app.isPackaged) {
      localManifestPath = path.join(process.resourcesPath, 'firmware_manifest.json');
      if (!fs.existsSync(localManifestPath)) {
        localManifestPath = path.join(path.dirname(app.getPath('exe')), 'firmware_manifest.json');
      }
    } else {
      localManifestPath = path.join(app.getAppPath(), '..', 'firmware_manifest.json');
      if (!fs.existsSync(localManifestPath)) {
        localManifestPath = path.join(process.cwd(), 'firmware_manifest.json');
      }
    }

    if (fs.existsSync(localManifestPath)) {
      const data = fs.readFileSync(localManifestPath, 'utf-8');
      return JSON.parse(data);
    }

    console.error('Local manifest not found at:', localManifestPath);
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
