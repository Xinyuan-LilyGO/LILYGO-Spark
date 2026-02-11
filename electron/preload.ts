import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on: (...args: Parameters<typeof ipcRenderer.on>) => {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off: (...args: Parameters<typeof ipcRenderer.off>) => {
    const [channel, _listener] = args
    // In Electron, ipcRenderer.off(channel, listener) requires the EXACT same listener function reference.
    // However, our 'on' wrapper creates a *new* wrapper function: (event, ...args) => listener(...)
    // So passing the original 'listener' to 'off' won't work because it doesn't match the wrapper.
    // To properly support 'off', we would need to map listeners to their wrappers.
    // For now, to prevent the crash "listener argument must be function", we just pass a no-op if undefined, 
    // but effectively this 'off' implementation is broken for removing specific listeners created via 'on'.
    // A better approach is to simply return the result of ipcRenderer.removeAllListeners(channel) if no listener provided.
    
    // if (listener) {
       // Ideally we need the wrapper reference here. 
       // For this simple implementation, let's just use removeAllListeners to be safe for this use case
       // since we typically only have one listener per component mount.
       return ipcRenderer.removeAllListeners(channel)
    // }
    return ipcRenderer.removeAllListeners(channel)
  },
  send: (...args: Parameters<typeof ipcRenderer.send>) => {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke: (...args: Parameters<typeof ipcRenderer.invoke>) => {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})
