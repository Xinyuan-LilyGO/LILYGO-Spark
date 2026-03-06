import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

export type LogLevel = 'verbose' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: 'main' | 'renderer';
  message: string;
}

const MAX_LOG_FILES = 7;
const MAX_RING_SIZE = 2000;

let logStream: fs.WriteStream | null = null;
let logFilePath = '';
let logDir = '';
let ringBuffer: LogEntry[] = [];
let initialized = false;

function getLogDir(): string {
  return path.join(app.getPath('userData'), 'logs');
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatLine(entry: LogEntry): string {
  const lvl = entry.level.toUpperCase().padEnd(7);
  return `[${entry.timestamp}] [${lvl}] [${entry.source}] ${entry.message}`;
}

function rotateOldLogs() {
  try {
    const files = fs.readdirSync(logDir)
      .filter(f => f.startsWith('spark-') && f.endsWith('.log'))
      .sort()
      .reverse();

    while (files.length >= MAX_LOG_FILES) {
      const old = files.pop()!;
      fs.unlinkSync(path.join(logDir, old));
    }
  } catch { /* ignore */ }
}

function broadcastToRenderers(entry: LogEntry) {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      if (!win.isDestroyed()) {
        win.webContents.send('log-entry', entry);
      }
    } catch { /* ignore */ }
  }
}

export function initLogger() {
  if (initialized) return;
  initialized = true;

  logDir = getLogDir();
  fs.mkdirSync(logDir, { recursive: true });
  rotateOldLogs();

  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  logFilePath = path.join(logDir, `spark-${dateStr}.log`);
  logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

  interceptConsole();
  registerIPC();

  writeEntry({
    timestamp: formatTimestamp(),
    level: 'info',
    source: 'main',
    message: `Logger initialized. Log file: ${logFilePath}`,
  });
}

function writeEntry(entry: LogEntry) {
  ringBuffer.push(entry);
  if (ringBuffer.length > MAX_RING_SIZE) {
    ringBuffer = ringBuffer.slice(-MAX_RING_SIZE);
  }

  logStream?.write(formatLine(entry) + '\n');
  broadcastToRenderers(entry);
}

const _origConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function argsToString(args: any[]): string {
  return args.map(a => {
    if (typeof a === 'string') return a;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ');
}

function interceptConsole() {
  console.log = (...args: any[]) => {
    _origConsole.log(...args);
    writeEntry({ timestamp: formatTimestamp(), level: 'info', source: 'main', message: argsToString(args) });
  };
  console.warn = (...args: any[]) => {
    _origConsole.warn(...args);
    writeEntry({ timestamp: formatTimestamp(), level: 'warn', source: 'main', message: argsToString(args) });
  };
  console.error = (...args: any[]) => {
    _origConsole.error(...args);
    writeEntry({ timestamp: formatTimestamp(), level: 'error', source: 'main', message: argsToString(args) });
  };
}

export function logRenderer(level: LogLevel, message: string) {
  const entry: LogEntry = { timestamp: formatTimestamp(), level, source: 'renderer', message };
  _origConsole.log(formatLine(entry));
  writeEntry(entry);
}

function registerIPC() {
  ipcMain.handle('logger-get-entries', () => {
    return ringBuffer;
  });

  ipcMain.handle('logger-get-log-path', () => {
    return logFilePath;
  });

  ipcMain.handle('logger-get-log-dir', () => {
    return logDir;
  });

  ipcMain.handle('logger-export', async () => {
    const { dialog: dlg } = await import('electron');
    const defaultName = path.basename(logFilePath);
    const result = await dlg.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'Log Files', extensions: ['log'] }],
    });
    if (!result.canceled && result.filePath) {
      fs.copyFileSync(logFilePath, result.filePath);
      return result.filePath;
    }
    return null;
  });
}

export function getLogFilePath() {
  return logFilePath;
}
