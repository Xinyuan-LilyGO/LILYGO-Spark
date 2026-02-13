import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type AccentColor = 'blue' | 'orange' | 'emerald' | 'violet' | 'rose';

const THEME_STORAGE_KEY = 'lilygo_theme';
const ACCENT_STORAGE_KEY = 'lilygo_accent';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {}
  return 'system';
}

function getStoredAccent(): AccentColor {
  try {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (['blue', 'orange', 'emerald', 'violet', 'rose'].includes(stored || '')) return stored as AccentColor;
  } catch {}
  return 'blue';
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'light') return 'light';
  if (pref === 'dark') return 'dark';
  return getSystemTheme();
}

// RGB values for Tailwind rgb(var(--x) / <alpha>)
export const ACCENT_PALETTES: Record<AccentColor, { main: string; hover: string; muted: string; mutedBg: string }> = {
  blue:    { main: '59 130 246',   hover: '37 99 235',   muted: '96 165 250',   mutedBg: '59 130 246' },
  orange:  { main: '249 115 22',   hover: '234 88 12',   muted: '251 146 60',   mutedBg: '249 115 22' },
  emerald: { main: '16 185 129',   hover: '5 150 105',   muted: '52 211 153',   mutedBg: '16 185 129' },
  violet:  { main: '139 92 246',   hover: '124 58 237', muted: '167 139 250',  mutedBg: '139 92 246' },
  rose:    { main: '244 63 94',    hover: '225 29 72',  muted: '251 113 133',  mutedBg: '244 63 94' },
};

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  accent: AccentColor;
  setPreference: (p: ThemePreference) => void;
  setAccent: (a: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getStoredPreference);
  const [accent, setAccentState] = useState<AccentColor>(getStoredAccent);
  const [systemDark, setSystemDark] = useState(getSystemTheme);

  const resolved = resolveTheme(preference);
  const effectiveResolved = preference === 'system' ? systemDark : resolved;

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    localStorage.setItem(THEME_STORAGE_KEY, p);
  };

  const setAccent = (a: AccentColor) => {
    setAccentState(a);
    localStorage.setItem(ACCENT_STORAGE_KEY, a);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (effectiveResolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-accent', accent);
  }, [effectiveResolved, accent]);

  useEffect(() => {
    const palette = ACCENT_PALETTES[accent];
    const root = document.documentElement;
    root.style.setProperty('--color-primary', palette.main);
    root.style.setProperty('--color-primary-hover', palette.hover);
    root.style.setProperty('--color-primary-muted', palette.muted);
    root.style.setProperty('--color-primary-muted-bg', palette.mutedBg);
  }, [accent]);

  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setSystemDark(mq.matches ? 'dark' : 'light');
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ipcRenderer) {
      (window as any).ipcRenderer.send('theme-changed', effectiveResolved);
    }
  }, [effectiveResolved]);

  return (
    <ThemeContext.Provider value={{ preference, resolved: effectiveResolved, accent, setPreference, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
