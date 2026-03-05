import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type AccentColor = 'blue' | 'orange' | 'amber' | 'emerald' | 'cyan' | 'violet' | 'rose' | 'sky';
export type AccentMode = 'rotating' | 'fixed';

const THEME_STORAGE_KEY = 'lilygo_theme';
const ACCENT_STORAGE_KEY = 'lilygo_accent';
const ACCENT_MODE_STORAGE_KEY = 'lilygo_accent_mode';
const GLASS_STORAGE_KEY = 'lilygo_glass_effect';
const SOUND_STORAGE_KEY = 'lilygo_sound_enabled';
const FLASH_STYLE_STORAGE_KEY = 'lilygo_flash_celebration_style';

const ACCENT_ROTATION_ORDER: AccentColor[] = ['blue', 'orange', 'amber', 'emerald', 'cyan', 'violet', 'rose', 'sky'];

export type FlashCelebrationStyle = 'fireworks' | 'hacker' | 'minimal' | 'neon' | 'terminal' | 'gradient';

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
    const valid: AccentColor[] = ['blue', 'orange', 'amber', 'emerald', 'cyan', 'violet', 'rose', 'sky'];
    if (valid.includes(stored as AccentColor)) return stored as AccentColor;
  } catch {}
  return 'blue';
}

function getStoredAccentMode(): AccentMode {
  try {
    const stored = localStorage.getItem(ACCENT_MODE_STORAGE_KEY);
    if (stored === 'rotating' || stored === 'fixed') return stored;
  } catch {}
  return 'rotating';
}

function getRotatingAccent(): AccentColor {
  const now = new Date();
  const epoch = new Date(2025, 0, 1);
  const msPerHalfDay = 12 * 60 * 60 * 1000;
  const halfDaysSinceEpoch = Math.floor((now.getTime() - epoch.getTime()) / msPerHalfDay);
  return ACCENT_ROTATION_ORDER[halfDaysSinceEpoch % ACCENT_ROTATION_ORDER.length];
}

function msUntilNextHalfDay(): number {
  const now = new Date();
  const next = new Date(now);
  if (now.getHours() < 12) {
    next.setHours(12, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  }
  return next.getTime() - now.getTime();
}

function getStoredGlass(): boolean {
  try {
    const stored = localStorage.getItem(GLASS_STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {}
  return true;
}

function getStoredSoundEnabled(): boolean {
  try {
    const stored = localStorage.getItem(SOUND_STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {}
  return true;
}

function getStoredFlashStyle(): FlashCelebrationStyle {
  try {
    const stored = localStorage.getItem(FLASH_STYLE_STORAGE_KEY);
    const valid: FlashCelebrationStyle[] = ['fireworks', 'hacker', 'minimal', 'neon', 'terminal', 'gradient'];
    if (stored && valid.includes(stored as FlashCelebrationStyle)) return stored as FlashCelebrationStyle;
  } catch {}
  return 'fireworks';
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
  amber:   { main: '245 158 11',   hover: '217 119 6',   muted: '251 191 36',   mutedBg: '245 158 11' },
  emerald: { main: '16 185 129',   hover: '5 150 105',   muted: '52 211 153',   mutedBg: '16 185 129' },
  cyan:    { main: '6 182 212',    hover: '8 145 178',   muted: '34 211 238',   mutedBg: '6 182 212' },
  violet:  { main: '139 92 246',   hover: '124 58 237', muted: '167 139 250',  mutedBg: '139 92 246' },
  rose:    { main: '244 63 94',    hover: '225 29 72',  muted: '251 113 133',  mutedBg: '244 63 94' },
  sky:    { main: '14 165 233',   hover: '2 132 199',   muted: '56 189 248',   mutedBg: '14 165 233' },
};

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  accent: AccentColor;
  accentMode: AccentMode;
  glassEnabled: boolean;
  soundEnabled: boolean;
  flashCelebrationStyle: FlashCelebrationStyle;
  setPreference: (p: ThemePreference) => void;
  setAccent: (a: AccentColor) => void;
  setAccentMode: (m: AccentMode) => void;
  setGlassEnabled: (v: boolean) => void;
  setSoundEnabled: (v: boolean) => void;
  setFlashCelebrationStyle: (s: FlashCelebrationStyle) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getStoredPreference);
  const [accentMode, setAccentModeState] = useState<AccentMode>(getStoredAccentMode);
  const [fixedAccent, setFixedAccentState] = useState<AccentColor>(getStoredAccent);
  const [rotatingAccent, setRotatingAccent] = useState<AccentColor>(getRotatingAccent);
  const [glassEnabled, setGlassEnabledState] = useState(getStoredGlass);
  const [soundEnabled, setSoundEnabledState] = useState(getStoredSoundEnabled);
  const [flashCelebrationStyle, setFlashCelebrationStyleState] = useState<FlashCelebrationStyle>(getStoredFlashStyle);
  const [systemDark, setSystemDark] = useState(getSystemTheme);
  const rotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent = accentMode === 'rotating' ? rotatingAccent : fixedAccent;

  const resolved = resolveTheme(preference);
  const effectiveResolved = preference === 'system' ? systemDark : resolved;

  const scheduleNextRotation = useCallback(() => {
    if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
    const ms = msUntilNextHalfDay();
    rotationTimerRef.current = setTimeout(() => {
      setRotatingAccent(getRotatingAccent());
      scheduleNextRotation();
    }, ms);
  }, []);

  useEffect(() => {
    if (accentMode !== 'rotating') return;

    setRotatingAccent(getRotatingAccent());
    scheduleNextRotation();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setRotatingAccent(getRotatingAccent());
        scheduleNextRotation();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // DEV only: poll every 5s to detect manual system time changes
    let devPollTimer: ReturnType<typeof setInterval> | null = null;
    if (import.meta.env.DEV) {
      let lastAccent = getRotatingAccent();
      devPollTimer = setInterval(() => {
        const current = getRotatingAccent();
        if (current !== lastAccent) {
          lastAccent = current;
          setRotatingAccent(current);
          scheduleNextRotation();
        }
      }, 5000);
    }

    return () => {
      if (rotationTimerRef.current) clearTimeout(rotationTimerRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (devPollTimer) clearInterval(devPollTimer);
    };
  }, [accentMode, scheduleNextRotation]);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    localStorage.setItem(THEME_STORAGE_KEY, p);
  };

  const setAccent = (a: AccentColor) => {
    setFixedAccentState(a);
    localStorage.setItem(ACCENT_STORAGE_KEY, a);
    if (accentMode === 'rotating') {
      setAccentModeState('fixed');
      localStorage.setItem(ACCENT_MODE_STORAGE_KEY, 'fixed');
    }
  };

  const setAccentMode = (m: AccentMode) => {
    setAccentModeState(m);
    localStorage.setItem(ACCENT_MODE_STORAGE_KEY, m);
    if (m === 'rotating') {
      setRotatingAccent(getRotatingAccent());
    }
  };

  const setGlassEnabled = (v: boolean) => {
    setGlassEnabledState(v);
    localStorage.setItem(GLASS_STORAGE_KEY, String(v));
  };

  const setSoundEnabled = (v: boolean) => {
    setSoundEnabledState(v);
    localStorage.setItem(SOUND_STORAGE_KEY, String(v));
  };

  const setFlashCelebrationStyle = (s: FlashCelebrationStyle) => {
    setFlashCelebrationStyleState(s);
    localStorage.setItem(FLASH_STYLE_STORAGE_KEY, s);
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
    <ThemeContext.Provider value={{ preference, resolved: effectiveResolved, accent, accentMode, glassEnabled, soundEnabled, flashCelebrationStyle, setPreference, setAccent, setAccentMode, setGlassEnabled, setSoundEnabled, setFlashCelebrationStyle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
