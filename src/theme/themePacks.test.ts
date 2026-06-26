import { describe, it, expect } from 'vitest';
import {
  THEME_PACKS,
  THEME_PACK_IDS,
  DEFAULT_THEME_PACK,
  getThemePack,
  isThemePackId,
  resolvePackMode,
  resolvePackPalette,
  type ThemePalette,
} from './themePacks';

const RGB_TRIPLE = /^\d{1,3} \d{1,3} \d{1,3}$/;
const PALETTE_KEYS: (keyof ThemePalette)[] = [
  'bgBase', 'bgSurface', 'bgSurfaceHover', 'textBase',
  'primary', 'primaryHover', 'primaryMuted', 'primaryMutedBg', 'accent',
];

describe('theme pack registry', () => {
  it('exposes every registered id in THEME_PACK_IDS exactly once', () => {
    const keys = Object.keys(THEME_PACKS).sort();
    expect([...THEME_PACK_IDS].sort()).toEqual(keys);
    expect(new Set(THEME_PACK_IDS).size).toBe(THEME_PACK_IDS.length);
  });

  it('has a valid default pack', () => {
    expect(THEME_PACK_IDS).toContain(DEFAULT_THEME_PACK);
    expect(THEME_PACKS[DEFAULT_THEME_PACK].palette).toBeNull(); // classic delegates
  });

  it('every pack has non-empty fonts and a radius', () => {
    for (const id of THEME_PACK_IDS) {
      const p = THEME_PACKS[id];
      expect(p.id).toBe(id);
      expect(p.fonts.display.length).toBeGreaterThan(0);
      expect(p.fonts.body.length).toBeGreaterThan(0);
      expect(p.fonts.mono.length).toBeGreaterThan(0);
      expect(typeof p.radius).toBe('string');
    }
  });

  it('themed packs (non-classic) provide complete light + dark palettes as RGB triples', () => {
    for (const id of THEME_PACK_IDS) {
      const p = THEME_PACKS[id];
      if (!p.palette) continue;
      for (const mode of ['light', 'dark'] as const) {
        for (const key of PALETTE_KEYS) {
          expect(p.palette[mode][key], `${id}.${mode}.${key}`).toMatch(RGB_TRIPLE);
        }
      }
    }
  });

  it('preview swatches are hex colors', () => {
    for (const id of THEME_PACK_IDS) {
      const p = THEME_PACKS[id];
      for (const v of Object.values(p.preview)) {
        expect(v).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });
});

describe('isThemePackId', () => {
  it('accepts known ids and rejects everything else', () => {
    expect(isThemePackId('terminal')).toBe(true);
    expect(isThemePackId('classic')).toBe(true);
    expect(isThemePackId('nope')).toBe(false);
    expect(isThemePackId('')).toBe(false);
    expect(isThemePackId(null)).toBe(false);
    expect(isThemePackId(42)).toBe(false);
  });
});

describe('getThemePack', () => {
  it('returns the requested pack', () => {
    expect(getThemePack('terminal').id).toBe('terminal');
  });
});

describe('resolvePackMode', () => {
  it('forces the packs declared mode and inherits otherwise', () => {
    expect(resolvePackMode(THEME_PACKS.terminal, 'light')).toBe('dark'); // dark-only
    expect(resolvePackMode(THEME_PACKS.editorial, 'dark')).toBe('light'); // light-only
    expect(resolvePackMode(THEME_PACKS.classic, 'dark')).toBe('dark'); // inherit
    expect(resolvePackMode(THEME_PACKS.classic, 'light')).toBe('light'); // inherit
  });
});

describe('resolvePackPalette', () => {
  it('returns null for classic (delegates to accent system)', () => {
    expect(resolvePackPalette(THEME_PACKS.classic, 'dark')).toBeNull();
    expect(resolvePackPalette(THEME_PACKS.classic, 'light')).toBeNull();
  });

  it('returns the mode-specific palette for themed packs', () => {
    const darkPal = resolvePackPalette(THEME_PACKS.editorial, 'dark');
    const lightPal = resolvePackPalette(THEME_PACKS.editorial, 'light');
    expect(darkPal).toBe(THEME_PACKS.editorial.palette!.dark);
    expect(lightPal).toBe(THEME_PACKS.editorial.palette!.light);
  });
});
