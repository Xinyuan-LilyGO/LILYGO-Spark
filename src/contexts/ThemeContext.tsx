import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'lilygo_theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {}
  return 'system';
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return getSystemTheme();
}

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getStoredPreference);
  const [systemDark, setSystemDark] = useState(getSystemTheme);

  const resolved = resolveTheme(preference);
  const effectiveResolved = preference === 'system' ? systemDark : resolved;

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    localStorage.setItem(STORAGE_KEY, p);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (effectiveResolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    // Sync to main process for About window
    if (typeof window !== 'undefined' && (window as any).ipcRenderer) {
      (window as any).ipcRenderer.send('theme-changed', effectiveResolved);
    }
  }, [effectiveResolved]);

  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setSystemDark(mq.matches ? 'dark' : 'light');
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  return (
    <ThemeContext.Provider value={{ preference, resolved: effectiveResolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
