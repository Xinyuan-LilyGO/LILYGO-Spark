/**
 * Pluggable theme packs.
 *
 * A "theme pack" is a cohesive aesthetic identity that bundles together:
 *   - a base color mode (light / dark / inherit-from-user-preference)
 *   - a full semantic color palette (background / surface / text / primary / accent)
 *   - a typography set (display / body / mono font families)
 *   - shape language (corner radius)
 *   - an ambient texture (grid / paper / dots / none)
 *
 * Following the 2026 standard approach, the runtime is driven by CSS custom
 * properties + a `data-theme` attribute on <html>. React (ThemeContext) only
 * orchestrates state and writes the variables; the browser does the rendering,
 * so switching packs is instant and never re-renders the component tree.
 *
 * Color values are stored as space-separated RGB triples ("r g b") so they
 * compose with Tailwind's `rgb(var(--x) / <alpha-value>)` color mapping.
 *
 * Typography intentionally uses widely-available OS font families (with robust
 * fallback stacks) so the packs look distinct OFFLINE without bundling any font
 * binaries. Bundling custom .woff2 faces per pack is a future enhancement; the
 * architecture already treats fonts as a swappable theme token.
 */

export type ThemePackId = 'classic' | 'terminal' | 'editorial' | 'brutalist';

/** Base light/dark behavior of a pack. */
export type ThemePackMode = 'light' | 'dark' | 'inherit';

/** Ambient background texture rendered behind the app surfaces. */
export type ThemeTexture = 'none' | 'grid' | 'paper' | 'dots';

/** Semantic color palette. Each value is an "r g b" triple. */
export interface ThemePalette {
  bgBase: string;
  bgSurface: string;
  bgSurfaceHover: string;
  textBase: string;
  primary: string;
  primaryHover: string;
  primaryMuted: string;
  primaryMutedBg: string;
  accent: string;
}

export interface ThemeFonts {
  /** Headings / display type. */
  display: string;
  /** Body / UI text. */
  body: string;
  /** Code, hashes, technical values. */
  mono: string;
}

export interface ThemePack {
  id: ThemePackId;
  /** Short display name (also used as an i18n key suffix: `settings.theme_packs.<id>`). */
  name: string;
  /** One-line description for the gallery card. */
  description: string;
  mode: ThemePackMode;
  fonts: ThemeFonts;
  /**
   * Color overrides for light and/or dark. `null` means "delegate to the
   * existing light/dark + accent system" (used by the Classic pack so upgrading
   * users keep their current look and accent rotation untouched).
   */
  palette: { light: ThemePalette; dark: ThemePalette } | null;
  /** Corner radius applied via the `--radius` token (CSS length). */
  radius: string;
  texture: ThemeTexture;
  /** Static preview swatch (hex) for the settings gallery — independent of mode. */
  preview: { bg: string; surface: string; text: string; primary: string; accent: string };
}

const SYSTEM_SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei UI", "Microsoft JhengHei UI", "Yu Gothic UI", "Malgun Gothic", "Helvetica Neue", sans-serif';

const MONO_STACK =
  '"SF Mono", "SFMono-Regular", "Menlo", "Consolas", "Cascadia Code", "JetBrains Mono", "DejaVu Sans Mono", "Courier New", monospace';

const SERIF_DISPLAY =
  '"Hoefler Text", "Baskerville", "Iowan Old Style", "Times New Roman", "Songti SC", "SimSun", serif';

const SERIF_BODY =
  '"Iowan Old Style", "Palatino Linotype", "Palatino", "Georgia", "Songti SC", "SimSun", serif';

const HEAVY_SANS =
  '"Arial Black", "Helvetica Neue", "Helvetica", "Inter", "PingFang SC", "Microsoft YaHei", sans-serif';

export const THEME_PACKS: Record<ThemePackId, ThemePack> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'The original Spark look — follows your light/dark and accent color settings.',
    mode: 'inherit',
    fonts: { display: SYSTEM_SANS, body: SYSTEM_SANS, mono: MONO_STACK },
    palette: null,
    radius: '0.75rem',
    texture: 'none',
    preview: { bg: '#f8fafc', surface: '#ffffff', text: '#0f172a', primary: '#6366f1', accent: '#10b981' },
  },

  terminal: {
    id: 'terminal',
    name: 'Terminal',
    description: 'Phosphor-green engineering console. Monospace everything, grid underlay, deep black.',
    mode: 'dark',
    fonts: { display: MONO_STACK, body: MONO_STACK, mono: MONO_STACK },
    palette: {
      // Terminal is a dark-only identity; light mirrors dark to stay coherent
      // if a user forces light mode.
      dark: {
        bgBase: '8 12 10',
        bgSurface: '15 22 18',
        bgSurfaceHover: '22 32 26',
        textBase: '198 234 205',
        primary: '74 222 128',
        primaryHover: '34 197 94',
        primaryMuted: '134 239 172',
        primaryMutedBg: '20 60 38',
        accent: '250 204 21',
      },
      light: {
        bgBase: '12 16 13',
        bgSurface: '18 26 21',
        bgSurfaceHover: '26 36 30',
        textBase: '198 234 205',
        primary: '74 222 128',
        primaryHover: '34 197 94',
        primaryMuted: '134 239 172',
        primaryMutedBg: '20 60 38',
        accent: '250 204 21',
      },
    },
    radius: '0.25rem',
    texture: 'grid',
    preview: { bg: '#080c0a', surface: '#0f1612', text: '#c6eacd', primary: '#4ade80', accent: '#facc15' },
  },

  editorial: {
    id: 'editorial',
    name: 'Editorial',
    description: 'Refined print magazine. Warm paper, serif headlines, ink-on-cream restraint.',
    mode: 'light',
    fonts: { display: SERIF_DISPLAY, body: SERIF_BODY, mono: MONO_STACK },
    palette: {
      light: {
        bgBase: '250 248 243',
        bgSurface: '255 255 255',
        bgSurfaceHover: '244 240 232',
        textBase: '28 25 23',
        primary: '159 18 57',
        primaryHover: '136 19 55',
        primaryMuted: '190 24 93',
        primaryMutedBg: '255 228 230',
        accent: '146 64 14',
      },
      dark: {
        bgBase: '26 22 20',
        bgSurface: '36 31 28',
        bgSurfaceHover: '46 40 36',
        textBase: '237 230 220',
        primary: '244 114 152',
        primaryHover: '236 72 110',
        primaryMuted: '249 168 192',
        primaryMutedBg: '80 24 44',
        accent: '217 159 86',
      },
    },
    radius: '0.375rem',
    texture: 'paper',
    preview: { bg: '#faf8f3', surface: '#ffffff', text: '#1c1917', primary: '#9f1239', accent: '#92400e' },
  },

  brutalist: {
    id: 'brutalist',
    name: 'Neo-Brutalist',
    description: 'Loud and raw. Hard edges, fat black borders, electric blocks, zero rounding.',
    mode: 'light',
    fonts: { display: HEAVY_SANS, body: SYSTEM_SANS, mono: MONO_STACK },
    palette: {
      light: {
        bgBase: '241 240 232',
        bgSurface: '255 255 255',
        bgSurfaceHover: '226 224 214',
        textBase: '12 12 12',
        primary: '255 90 31',
        primaryHover: '234 70 11',
        primaryMuted: '255 138 76',
        primaryMutedBg: '255 237 213',
        accent: '37 99 235',
      },
      dark: {
        bgBase: '17 17 17',
        bgSurface: '24 24 24',
        bgSurfaceHover: '36 36 36',
        textBase: '245 245 245',
        primary: '255 106 51',
        primaryHover: '249 80 30',
        primaryMuted: '255 154 102',
        primaryMutedBg: '70 30 10',
        accent: '96 165 250',
      },
    },
    radius: '0rem',
    texture: 'dots',
    preview: { bg: '#f1f0e8', surface: '#ffffff', text: '#0c0c0c', primary: '#ff5a1f', accent: '#2563eb' },
  },
};

export const THEME_PACK_IDS: ThemePackId[] = ['classic', 'terminal', 'editorial', 'brutalist'];

export const DEFAULT_THEME_PACK: ThemePackId = 'classic';

export function isThemePackId(value: unknown): value is ThemePackId {
  return typeof value === 'string' && (THEME_PACK_IDS as string[]).includes(value);
}

export function getThemePack(id: ThemePackId): ThemePack {
  return THEME_PACKS[id] ?? THEME_PACKS[DEFAULT_THEME_PACK];
}

/**
 * Resolve the concrete palette a pack should apply for a given resolved
 * light/dark mode. Returns `null` for packs that delegate to the legacy
 * accent system (Classic).
 */
export function resolvePackPalette(pack: ThemePack, resolvedMode: 'light' | 'dark'): ThemePalette | null {
  if (!pack.palette) return null;
  return resolvedMode === 'dark' ? pack.palette.dark : pack.palette.light;
}

/**
 * Compute the effective light/dark mode for a pack given the user's resolved
 * preference. Packs with a forced `mode` win; `inherit` follows the user.
 */
export function resolvePackMode(pack: ThemePack, userResolved: 'light' | 'dark'): 'light' | 'dark' {
  if (pack.mode === 'light') return 'light';
  if (pack.mode === 'dark') return 'dark';
  return userResolved;
}
