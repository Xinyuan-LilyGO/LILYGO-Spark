import { describe, it, expect } from 'vitest';
import { convertV1ToV2, slugifyFirmwareName, normalizeTypeToArray } from './manifestV2';
import type { LegacyFirmware } from './manifestSchema';

function fw(p: Partial<LegacyFirmware> & { name: string; version: string }): LegacyFirmware {
  return {
    supported_product_ids: ['t-display'],
    type: 'community',
    filename: `${p.name}-${p.version}.bin`,
    download_url: '',
    description: '',
    ...p,
  };
}

describe('slugifyFirmwareName', () => {
  it('lowercases and dashes non-alphanumerics', () => {
    expect(slugifyFirmwareName('Factory Firmware v1.4')).toBe('factory-firmware-v1-4');
    expect(slugifyFirmwareName('  Bruce!! ')).toBe('bruce');
  });
  it('falls back to "firmware" for empty/garbage', () => {
    expect(slugifyFirmwareName('')).toBe('firmware');
    expect(slugifyFirmwareName('---')).toBe('firmware');
  });
});

describe('normalizeTypeToArray', () => {
  it('splits comma strings and trims', () => {
    expect(normalizeTypeToArray('factory, beta ,stable')).toEqual(['factory', 'beta', 'stable']);
  });
  it('passes arrays through, dropping empties', () => {
    expect(normalizeTypeToArray(['a', '', 'b'])).toEqual(['a', 'b']);
  });
  it('returns [] for nullish/other', () => {
    expect(normalizeTypeToArray(undefined)).toEqual([]);
    expect(normalizeTypeToArray(42)).toEqual([]);
  });
});

describe('convertV1ToV2', () => {
  it('produces an empty but valid v2 manifest for empty input', () => {
    const v2 = convertV1ToV2({});
    expect(v2.schema_version).toBe(2);
    expect(v2.firmwares).toEqual([]);
    expect(v2.collections).toEqual([]);
    expect(v2.product_list).toEqual([]);
    expect(typeof v2.generated_at).toBe('string');
  });

  it('nests multiple versions of one firmware and lifts shared metadata once', () => {
    const v2 = convertV1ToV2({
      firmware_list: [
        fw({ name: 'Factory', version: 'v1', sha256: 'aa11', source_code_url: 'https://github.com/x/y', author_name: 'LILYGO', type: 'factory,stable' }),
        fw({ name: 'Factory', version: 'v2', sha256: 'bb22', source_code_url: 'https://github.com/x/y', author_name: 'LILYGO' }),
      ],
    });
    expect(v2.firmwares).toHaveLength(1);
    const f = v2.firmwares[0];
    expect(f.id).toBe('factory');
    expect(f.versions.map(v => v.version)).toEqual(['v1', 'v2']);
    expect(f.type).toEqual(['factory', 'stable']);
    expect(f.author.name).toBe('LILYGO');
    expect(f.source_code_url).toBe('https://github.com/x/y');
    expect(f.latest_sha256).toBe('aa11');
  });

  it('assigns unique ids when two different firmwares share a name', () => {
    const v2 = convertV1ToV2({
      firmware_list: [
        fw({ name: 'Factory', version: 'v1', sha256: 'a', source_code_url: 'https://github.com/a/x', supported_product_ids: ['t-deck'] }),
        fw({ name: 'Factory', version: 'v1', sha256: 'b', source_code_url: 'https://github.com/b/y', supported_product_ids: ['t-embed'] }),
      ],
    });
    expect(v2.firmwares).toHaveLength(2);
    const ids = v2.firmwares.map(f => f.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids[0]).toBe('factory');
    expect(ids[1]).toMatch(/^factory-/); // disambiguated
  });

  it('groups versions that share name + product set + source, exposing that product set', () => {
    const v2 = convertV1ToV2({
      firmware_list: [
        fw({ name: 'X', version: 'v1', supported_product_ids: ['a', 'b'] }),
        fw({ name: 'X', version: 'v2', supported_product_ids: ['a', 'b'] }),
      ],
    });
    expect(v2.firmwares).toHaveLength(1);
    expect(v2.firmwares[0].versions).toHaveLength(2);
    expect(v2.firmwares[0].supported_product_ids).toEqual(['a', 'b']);
  });

  it('does NOT merge same-named firmwares that target different product sets (global strict key)', () => {
    const v2 = convertV1ToV2({
      firmware_list: [
        fw({ name: 'Original Test', version: 'v1', supported_product_ids: ['t-deck'] }),
        fw({ name: 'Original Test', version: 'v1', supported_product_ids: ['t-circle'] }),
      ],
    });
    expect(v2.firmwares).toHaveLength(2);
  });

  it('remaps collection (series) sha256 references to firmware ids', () => {
    const v2 = convertV1ToV2({
      firmware_list: [
        fw({ name: 'Meshtastic', version: 'v1', sha256: '1234567890abcdef0000', supported_product_ids: ['t-deck'] }),
        fw({ name: 'Bruce', version: 'v1', sha256: 'fedcba09876543210000', supported_product_ids: ['t-embed'] }),
      ],
      series_list: [
        {
          id: 'mesh-eco',
          name: 'Mesh Ecosystem',
          firmware_ids: ['1234567890abcdef', 'fedcba0987654321'],
          admin_emails: ['a@b.com'],
        },
      ],
    });
    expect(v2.collections).toHaveLength(1);
    const c = v2.collections[0];
    expect(c.id).toBe('mesh-eco');
    expect(c.firmware_ids.sort()).toEqual(['bruce', 'meshtastic']);
    expect(c.admin_emails).toEqual(['a@b.com']);
  });

  it('drops dangling collection references that match no firmware', () => {
    const v2 = convertV1ToV2({
      firmware_list: [fw({ name: 'X', version: 'v1', sha256: 'aaaaaaaaaaaaaaaa0000' })],
      series_list: [{ id: 's', name: 'S', firmware_ids: ['ffffffffffffffff', 'aaaaaaaaaaaaaaaa'], admin_emails: [] }],
    });
    expect(v2.collections[0].firmware_ids).toEqual(['x']);
  });

  it('carries version-level binary metadata onto the nested version', () => {
    const v2 = convertV1ToV2({
      firmware_list: [
        fw({ name: 'X', version: 'v1', sha256: 'abc', md5: 'm', oss_url: 'http://o', size: 123, compressed_size: 45, published_at: '2026-01-01' }),
      ],
    });
    const v = v2.firmwares[0].versions[0];
    expect(v).toMatchObject({ version: 'v1', sha256: 'abc', md5: 'm', oss_url: 'http://o', size: 123, compressed_size: 45, published_at: '2026-01-01' });
  });

  it('does not mutate the input manifest', () => {
    const input = { firmware_list: [fw({ name: 'X', version: 'v1' })] };
    const snapshot = JSON.stringify(input);
    convertV1ToV2(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
