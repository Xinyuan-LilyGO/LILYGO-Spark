import { ipcRenderer, contextBridge, webUtils } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('platform', process.platform as 'win32' | 'darwin' | 'linux')

contextBridge.exposeInMainWorld('electronUtils', {
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file);
    } catch (e) {
      console.warn('Failed to get path for file:', e);
      return undefined;
    }
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
})

const listenerMap = new Map<Function, Function>();

contextBridge.exposeInMainWorld('ipcRenderer', {
  on: (...args: Parameters<typeof ipcRenderer.on>) => {
    const [channel, listener] = args;
    const wrapper = (event: any, ...rest: any[]) => listener(event, ...rest);
    listenerMap.set(listener, wrapper);
    return ipcRenderer.on(channel, wrapper as any);
  },
  off: (...args: Parameters<typeof ipcRenderer.off>) => {
    const [channel, listener] = args;
    if (listener) {
      const wrapper = listenerMap.get(listener);
      if (wrapper) {
        listenerMap.delete(listener);
        return ipcRenderer.off(channel, wrapper as any);
      }
    }
    return ipcRenderer.removeAllListeners(channel);
  },
  send: (...args: Parameters<typeof ipcRenderer.send>) => {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke: (...args: Parameters<typeof ipcRenderer.invoke>) => {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },
})
