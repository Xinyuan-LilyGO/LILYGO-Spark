import { app, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';

interface Config {
  firmware_manifest_url?: string;
  auth_api_base_url?: string;
}

export function setupConfigHandler() {
  ipcMain.handle('get-firmware-manifest', async () => {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'lilygo_config.json');
    let manifestUrl = '';

    // 1. Try to read config file
    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf-8');
        const config: Config = JSON.parse(configData);
        if (config.firmware_manifest_url) {
            manifestUrl = config.firmware_manifest_url;
            console.log('Using remote manifest URL:', manifestUrl);
        }
      }
    } catch (error) {
      console.error('Error reading config:', error);
    }

    // 2. If URL exists, try to fetch it
    if (manifestUrl) {
      try {
        const response = await fetch(manifestUrl);
        if (response.ok) {
          const data = await response.json();
          console.log('Fetched remote manifest successfully');
          return data;
        } else {
            console.warn(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error fetching remote manifest:', error);
      }
    }

    // 3. Fallback to local file
    console.log('Falling back to local manifest');
    try {
      // In dev, it's in the project root. In prod, we'd need to adjust this.
      // Assuming dev for now or bundled in resources.
      // app.getAppPath() points to the bundle source.
      
      let localManifestPath = '';
      if (app.isPackaged) {
          // In production, assume it's in resources or similar
          localManifestPath = path.join(process.resourcesPath, 'firmware_manifest.json');
          // If not found there, try next to the executable (portable)
          if (!fs.existsSync(localManifestPath)) {
             localManifestPath = path.join(path.dirname(app.getPath('exe')), 'firmware_manifest.json');
          }
      } else {
          // In dev: root of the project
          localManifestPath = path.join(app.getAppPath(), '..', 'firmware_manifest.json'); // ".." because app.getAppPath() might be dist-electron
          // Fix for specific dev structure if needed:
          if (!fs.existsSync(localManifestPath)) {
             localManifestPath = path.join(process.cwd(), 'firmware_manifest.json');
          }
      }
      
      if (fs.existsSync(localManifestPath)) {
        const data = fs.readFileSync(localManifestPath, 'utf-8');
        return JSON.parse(data);
      } else {
        console.error('Local manifest not found at:', localManifestPath);
        return { product_list: [], firmware_list: [] }; // Return empty structure
      }
    } catch (error) {
      console.error('Error reading local manifest:', error);
      return { product_list: [], firmware_list: [] };
    }
  });

  // 获取 GitHub 登录 URL（用于在浏览器中打开）
  ipcMain.handle('get-auth-login-url', async () => {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'lilygo_config.json');
    const defaultBase = 'https://lilygo-api.bytecode.fun';

    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf-8');
        const config: Config = JSON.parse(configData);
        if (config.auth_api_base_url) {
          return `${config.auth_api_base_url.replace(/\/$/, '')}/auth/github/start`;
        }
      }
    } catch (error) {
      console.error('Error reading config for auth:', error);
    }
    return `${defaultBase}/auth/github/start`;
  });

  // 获取 API 基础 URL
  ipcMain.handle('get-api-base-url', async () => {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'lilygo_config.json');
    const defaultBase = 'https://lilygo-api.bytecode.fun';

    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf-8');
        const config: Config = JSON.parse(configData);
        if (config.auth_api_base_url) {
          return config.auth_api_base_url.replace(/\/$/, '');
        }
      }
    } catch (error) {
      console.error('Error reading config for api base:', error);
    }
    return defaultBase;
  });
}
