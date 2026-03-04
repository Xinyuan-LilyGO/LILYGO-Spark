import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export interface DownloadedFile {
  url: string;
  path: string;
  md5: string;
  sha256: string;
  fileName: string;
  fileSize?: number;
}

export interface DownloadTask {
  url: string;
  downloading: boolean;
  progress: number;
  error?: string;
  file?: DownloadedFile;
}

interface DownloadOptions {
  expectedMd5?: string;
  ossUrl?: string;
  originalFilename?: string;
}

interface CacheStats {
  fileCount: number;
  totalBytes: number;
}

interface DownloadContextType {
  tasks: Record<string, DownloadTask>;
  startDownload: (url: string, options?: DownloadOptions) => Promise<void>;
  removeDownload: (url: string) => Promise<void>;
  clearAll: () => Promise<void>;
  getCacheStats: () => CacheStats;
  saveAs: (url: string) => Promise<boolean>;
  getTask: (url: string) => DownloadTask | undefined;
}

const STORAGE_KEY = 'lilygo_download_cache';

const DownloadContext = createContext<DownloadContextType | null>(null);

export const useDownload = () => {
  const ctx = useContext(DownloadContext);
  if (!ctx) throw new Error('useDownload must be used within DownloadProvider');
  return ctx;
};

function loadCachedTasks(): Record<string, DownloadTask> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: Record<string, DownloadTask> = JSON.parse(raw);
    const restored: Record<string, DownloadTask> = {};
    for (const [url, task] of Object.entries(parsed)) {
      if (!task.file) continue;
      restored[url] = { ...task, downloading: false, progress: 100, error: undefined };
    }
    return restored;
  } catch {
    return {};
  }
}

function persistTasks(tasks: Record<string, DownloadTask>) {
  try {
    const toSave: Record<string, DownloadTask> = {};
    for (const [url, task] of Object.entries(tasks)) {
      if (task.file) {
        toSave[url] = { url: task.url, downloading: false, progress: 100, file: task.file };
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* ignore */ }
}

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Record<string, DownloadTask>>(loadCachedTasks);
  const listenerRegistered = useRef(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Validate cached files still exist on disk at startup
  useEffect(() => {
    const filePaths = Object.values(tasks)
      .filter(t => t.file)
      .map(t => t.file!.path);
    if (filePaths.length === 0 || !window.ipcRenderer) return;

    window.ipcRenderer.invoke('check-files-exist', filePaths).then((result: Record<string, boolean>) => {
      setTasks(prev => {
        let changed = false;
        const next = { ...prev };
        for (const [url, task] of Object.entries(next)) {
          if (task.file && result[task.file.path] === false) {
            delete next[url];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }).catch(() => {});
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist completed downloads whenever tasks change
  useEffect(() => {
    persistTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    if (!window.ipcRenderer || listenerRegistered.current) return;
    listenerRegistered.current = true;

    const handler = (_event: any, data: { downloadId: string; percent: number; receivedBytes?: number; totalBytes?: number }) => {
      setTasks(prev => {
        const task = prev[data.downloadId];
        if (!task || !task.downloading) return prev;
        return { ...prev, [data.downloadId]: { ...task, progress: data.percent } };
      });
    };

    window.ipcRenderer.on('download-progress', handler);

    return () => {
      window.ipcRenderer.off('download-progress', handler);
      listenerRegistered.current = false;
    };
  }, []);

  const startDownload = useCallback(async (url: string, options?: DownloadOptions) => {
    setTasks(prev => {
      if (prev[url]?.downloading) return prev;
      return { ...prev, [url]: { url, downloading: true, progress: 0 } };
    });

    try {
      const result = await window.ipcRenderer.invoke(
        'download-firmware',
        url,
        options?.ossUrl,
        options?.originalFilename
      );

      if (result.success) {
        if (options?.expectedMd5 && result.md5.toLowerCase() !== options.expectedMd5.toLowerCase()) {
          setTasks(prev => ({
            ...prev,
            [url]: { url, downloading: false, progress: 100, error: `Hash mismatch! Expected: ${options.expectedMd5}, Got: ${result.md5}` }
          }));
          return;
        }
        setTasks(prev => ({
          ...prev,
          [url]: {
            url,
            downloading: false,
            progress: 100,
            file: { url, path: result.path, md5: result.md5, sha256: result.sha256, fileName: result.fileName, fileSize: result.fileSize }
          }
        }));
      } else {
        setTasks(prev => ({
          ...prev,
          [url]: { url, downloading: false, progress: 0, error: result.error }
        }));
      }
    } catch (e: any) {
      setTasks(prev => ({
        ...prev,
        [url]: { url, downloading: false, progress: 0, error: e.message }
      }));
    }
  }, []);

  const removeDownload = useCallback(async (url: string) => {
    const task = tasksRef.current[url];
    if (task?.file) {
      await window.ipcRenderer.invoke('remove-file', task.file.path);
    }
    setTasks(prev => {
      const next = { ...prev };
      delete next[url];
      return next;
    });
  }, []);

  const clearAll = useCallback(async () => {
    const current = tasksRef.current;
    const removePromises = Object.values(current)
      .filter(t => t.file)
      .map(t => window.ipcRenderer.invoke('remove-file', t.file!.path).catch(() => {}));
    await Promise.all(removePromises);
    setTasks({});
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getCacheStats = useCallback((): CacheStats => {
    const current = tasksRef.current;
    let fileCount = 0;
    let totalBytes = 0;
    for (const task of Object.values(current)) {
      if (task.file) {
        fileCount++;
        totalBytes += task.file.fileSize || 0;
      }
    }
    return { fileCount, totalBytes };
  }, []);

  const saveAs = useCallback(async (url: string): Promise<boolean> => {
    const task = tasksRef.current[url];
    if (!task?.file) return false;
    return await window.ipcRenderer.invoke('save-file', task.file.fileName, task.file.path);
  }, []);

  const getTask = useCallback((url: string) => tasks[url], [tasks]);

  return (
    <DownloadContext.Provider value={{ tasks, startDownload, removeDownload, clearAll, getCacheStats, saveAs, getTask }}>
      {children}
    </DownloadContext.Provider>
  );
};
