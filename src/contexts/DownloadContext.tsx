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
  /** Cache key this task is filed under (see `firmwareCacheKey`). */
  key: string;
  /** Source URL the binary was fetched from — for display only. */
  url: string;
  downloading: boolean;
  progress: number;
  error?: string;
  file?: DownloadedFile;
}

interface DownloadOptions {
  /** Firmware `download_url`; absent for community uploads served from OSS. */
  url?: string;
  expectedMd5?: string;
  ossUrl?: string;
  originalFilename?: string;
}

/**
 * Stable per-firmware cache key.
 *
 * `download_url` is NOT an identity — it is the optional external origin of a
 * binary. Community-uploaded firmware has none (its binary lives at `oss_url`),
 * and a few GitHub firmwares share one release zip while extracting different
 * binaries from it. Keying the cache on it made unrelated firmwares share a
 * single task, so downloading one made every other one look downloaded and hand
 * the wrong file to the burner. sha256 is unique per firmware, so prefer it.
 */
export function firmwareCacheKey(fw: { sha256?: string; oss_url?: string; download_url?: string }): string {
  if (fw.sha256) return `sha256:${fw.sha256}`;
  if (fw.oss_url) return `oss:${fw.oss_url}`;
  return `url:${fw.download_url ?? ''}`;
}

interface CacheStats {
  fileCount: number;
  totalBytes: number;
}

interface DownloadContextType {
  /** Keyed by `firmwareCacheKey(fw)`. */
  tasks: Record<string, DownloadTask>;
  startDownload: (key: string, options?: DownloadOptions) => Promise<void>;
  removeDownload: (key: string) => Promise<void>;
  clearAll: () => Promise<void>;
  getCacheStats: () => CacheStats;
  saveAs: (key: string) => Promise<boolean>;
  getTask: (key: string) => DownloadTask | undefined;
}

// v2: entries cached under the old download_url keys are ambiguous (everything
// community-uploaded shared the '' key), so they are dropped rather than migrated.
const STORAGE_KEY = 'lilygo_download_cache_v2';
const LEGACY_STORAGE_KEY = 'lilygo_download_cache';

const DownloadContext = createContext<DownloadContextType | null>(null);

export const useDownload = () => {
  const ctx = useContext(DownloadContext);
  if (!ctx) throw new Error('useDownload must be used within DownloadProvider');
  return ctx;
};

function loadCachedTasks(): Record<string, DownloadTask> {
  try {
    // Drop the pre-fix index; its temp files are reclaimed by the OS.
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: Record<string, DownloadTask> = JSON.parse(raw);
    const restored: Record<string, DownloadTask> = {};
    for (const [key, task] of Object.entries(parsed)) {
      if (!task.file) continue;
      restored[key] = { ...task, key, downloading: false, progress: 100, error: undefined };
    }
    return restored;
  } catch {
    return {};
  }
}

function persistTasks(tasks: Record<string, DownloadTask>) {
  try {
    const toSave: Record<string, DownloadTask> = {};
    for (const [key, task] of Object.entries(tasks)) {
      if (task.file) {
        toSave[key] = { key, url: task.url, downloading: false, progress: 100, file: task.file };
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
        for (const [key, task] of Object.entries(next)) {
          if (task.file && result[task.file.path] === false) {
            delete next[key];
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

  const startDownload = useCallback(async (key: string, options?: DownloadOptions) => {
    const url = options?.url ?? '';
    setTasks(prev => {
      if (prev[key]?.downloading) return prev;
      return { ...prev, [key]: { key, url, downloading: true, progress: 0 } };
    });

    try {
      const result = await window.ipcRenderer.invoke(
        'download-firmware',
        url,
        options?.ossUrl,
        options?.originalFilename,
        key
      );

      if (result.success) {
        if (options?.expectedMd5 && result.md5.toLowerCase() !== options.expectedMd5.toLowerCase()) {
          setTasks(prev => ({
            ...prev,
            [key]: { key, url, downloading: false, progress: 100, error: `Hash mismatch! Expected: ${options.expectedMd5}, Got: ${result.md5}` }
          }));
          return;
        }
        setTasks(prev => ({
          ...prev,
          [key]: {
            key,
            url,
            downloading: false,
            progress: 100,
            file: { url, path: result.path, md5: result.md5, sha256: result.sha256, fileName: result.fileName, fileSize: result.fileSize }
          }
        }));
      } else {
        setTasks(prev => ({
          ...prev,
          [key]: { key, url, downloading: false, progress: 0, error: result.error }
        }));
      }
    } catch (e: any) {
      setTasks(prev => ({
        ...prev,
        [key]: { key, url, downloading: false, progress: 0, error: e.message }
      }));
    }
  }, []);

  const removeDownload = useCallback(async (key: string) => {
    const task = tasksRef.current[key];
    if (task?.file) {
      await window.ipcRenderer.invoke('remove-file', task.file.path);
    }
    setTasks(prev => {
      const next = { ...prev };
      delete next[key];
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

  const saveAs = useCallback(async (key: string): Promise<boolean> => {
    const task = tasksRef.current[key];
    if (!task?.file) return false;
    return await window.ipcRenderer.invoke('save-file', task.file.fileName, task.file.path);
  }, []);

  const getTask = useCallback((key: string) => tasks[key], [tasks]);

  return (
    <DownloadContext.Provider value={{ tasks, startDownload, removeDownload, clearAll, getCacheStats, saveAs, getTask }}>
      {children}
    </DownloadContext.Provider>
  );
};
