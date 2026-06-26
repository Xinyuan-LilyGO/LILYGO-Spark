import { describe, it, expect } from 'vitest';
import {
  firmwareGroupKey,
  firmwareGroupKeyStrict,
  groupFirmwares,
  flattenFirmwares,
  normalizeManifest,
  type LegacyFirmware,
  type FirmwareGroup,
} from './manifestSchema';

/** Minimal helper to build a legacy flat firmware entry with sensible defaults. */
function fw(partial: Partial<LegacyFirmware> & { name: string; version: string }): LegacyFirmware {
  return {
    supported_product_ids: ['t-display'],
    type: 'community',
    filename: `${partial.name}-${partial.version}.bin`,
    download_url: '',
    description: '',
    ...partial,
  };
}

/** Sort a list of entries into a stable order for multiset comparison. */
function bySha(list: LegacyFirmware[]): LegacyFirmware[] {
  return [...list].sort((a, b) =>
    `${a.name}|${a.version}|${a.sha256 ?? ''}`.localeCompare(`${b.name}|${b.version}|${b.sha256 ?? ''}`)
  );
}

describe('firmwareGroupKey', () => {
  it('groups by name when no source url is present', () => {
    expect(firmwareGroupKey({ name: 'Factory', source_code_url: '' })).toBe('Factory');
    expect(firmwareGroupKey({ name: 'Factory' })).toBe('Factory');
  });

  it('includes normalized source url when present', () => {
    const a = firmwareGroupKey({ name: 'Factory', source_code_url: 'https://github.com/x/Y/' });
    const b = firmwareGroupKey({ name: 'Factory', source_code_url: 'https://github.com/x/Y' });
    const c = firmwareGroupKey({ name: 'Factory', source_code_url: 'HTTPS://GITHUB.COM/x/Y' });
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(a).not.toBe('Factory');
  });

  it('separates same-named firmwares from different repos', () => {
    const a = firmwareGroupKey({ name: 'Factory', source_code_url: 'https://github.com/a/repo' });
    const b = firmwareGroupKey({ name: 'Factory', source_code_url: 'https://github.com/b/repo' });
    expect(a).not.toBe(b);
  });

  it('trims surrounding whitespace in the name', () => {
    expect(firmwareGroupKey({ name: '  Factory  ' })).toBe('Factory');
  });
});

describe('firmwareGroupKeyStrict', () => {
  it('includes the sorted product set so same-named different-product firmwares differ', () => {
    const a = firmwareGroupKeyStrict({ name: 'Test', supported_product_ids: ['b', 'a'] });
    const b = firmwareGroupKeyStrict({ name: 'Test', supported_product_ids: ['a', 'b'] });
    const c = firmwareGroupKeyStrict({ name: 'Test', supported_product_ids: ['c'] });
    expect(a).toBe(b); // order-independent
    expect(a).not.toBe(c);
  });
});

describe('groupFirmwares with a custom key function', () => {
  it('uses the strict key to keep different-product firmwares separate', () => {
    const list = [
      { name: 'T', version: 'v1', type: 'x', filename: 'a', download_url: '', description: '', supported_product_ids: ['p1'] },
      { name: 'T', version: 'v1', type: 'x', filename: 'b', download_url: '', description: '', supported_product_ids: ['p2'] },
    ] as LegacyFirmware[];
    expect(groupFirmwares(list)).toHaveLength(1); // default (name) merges
    expect(groupFirmwares(list, firmwareGroupKeyStrict)).toHaveLength(2); // strict splits
  });
});

describe('groupFirmwares (legacy v1 -> nested v2)', () => {
  it('returns an empty array for empty / nullish input', () => {
    expect(groupFirmwares([])).toEqual([]);
    expect(groupFirmwares(null)).toEqual([]);
    expect(groupFirmwares(undefined)).toEqual([]);
  });

  it('collapses multiple versions of the same firmware into one group', () => {
    const list = [
      fw({ name: 'Factory', version: 'v1.0', sha256: 'aaa' }),
      fw({ name: 'Factory', version: 'v2.0', sha256: 'bbb' }),
    ];
    const groups = groupFirmwares(list);
    expect(groups).toHaveLength(1);
    expect(groups[0].groupName).toBe('Factory');
    expect(groups[0].hasMultipleVersions).toBe(true);
    expect(groups[0].versions.map(v => v.version)).toEqual(['v1.0', 'v2.0']);
  });

  it('keeps a single-version firmware as one group with hasMultipleVersions=false', () => {
    const groups = groupFirmwares([fw({ name: 'Bruce', version: '1.10.3' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].hasMultipleVersions).toBe(false);
  });

  it('does NOT merge same-named firmwares from different source repos', () => {
    const list = [
      fw({ name: 'Factory', version: 'v1', source_code_url: 'https://github.com/a/x' }),
      fw({ name: 'Factory', version: 'v1', source_code_url: 'https://github.com/b/y' }),
    ];
    const groups = groupFirmwares(list);
    expect(groups).toHaveLength(2);
  });

  it('preserves first-seen group order and version order', () => {
    const list = [
      fw({ name: 'Bravo', version: 'v1' }),
      fw({ name: 'Alpha', version: 'v1' }),
      fw({ name: 'Bravo', version: 'v2' }),
      fw({ name: 'Alpha', version: 'v2' }),
    ];
    const groups = groupFirmwares(list);
    expect(groups.map(g => g.groupName)).toEqual(['Bravo', 'Alpha']);
    expect(groups[0].versions.map(v => v.version)).toEqual(['v1', 'v2']);
  });

  it('computes the de-duplicated union of supported product ids in first-seen order', () => {
    const list = [
      fw({ name: 'Factory', version: 'v1', supported_product_ids: ['t-display', 't-deck'] }),
      fw({ name: 'Factory', version: 'v2', supported_product_ids: ['t-deck', 't-watch-s3'] }),
    ];
    const groups = groupFirmwares(list);
    expect(groups[0].supportedProductIds).toEqual(['t-display', 't-deck', 't-watch-s3']);
  });

  it('tolerates entries missing supported_product_ids', () => {
    const broken = { name: 'X', version: 'v1' } as unknown as LegacyFirmware;
    const groups = groupFirmwares([broken]);
    expect(groups).toHaveLength(1);
    expect(groups[0].supportedProductIds).toEqual([]);
  });

  it('skips null entries inside the list', () => {
    const list = [fw({ name: 'A', version: 'v1' }), null as unknown as LegacyFirmware];
    const groups = groupFirmwares(list);
    expect(groups).toHaveLength(1);
    expect(groups[0].versions).toHaveLength(1);
  });

  it('preserves the concrete version object identity (generic passthrough)', () => {
    const entry = fw({ name: 'A', version: 'v1', sha256: 'deadbeef' });
    const groups = groupFirmwares([entry]);
    expect(groups[0].versions[0]).toBe(entry);
  });
});

describe('flattenFirmwares (nested v2 -> legacy v1)', () => {
  it('returns empty for nullish input', () => {
    expect(flattenFirmwares(null)).toEqual([]);
    expect(flattenFirmwares(undefined)).toEqual([]);
    expect(flattenFirmwares([])).toEqual([]);
  });

  it('emits every version across groups', () => {
    const groups: FirmwareGroup[] = [
      { groupName: 'A', hasMultipleVersions: true, versions: [fw({ name: 'A', version: 'v1' }), fw({ name: 'A', version: 'v2' })] },
      { groupName: 'B', hasMultipleVersions: false, versions: [fw({ name: 'B', version: 'v1' })] },
    ];
    const flat = flattenFirmwares(groups);
    expect(flat.map(f => `${f.name}-${f.version}`)).toEqual(['A-v1', 'A-v2', 'B-v1']);
  });

  it('tolerates a group with a missing versions array', () => {
    const groups = [{ groupName: 'A', hasMultipleVersions: false } as unknown as FirmwareGroup];
    expect(flattenFirmwares(groups)).toEqual([]);
  });
});

describe('round-trip stability', () => {
  const sample: LegacyFirmware[] = [
    fw({ name: 'Factory', version: 'v1.0', sha256: 'a1', supported_product_ids: ['t-deck'] }),
    fw({ name: 'Bruce', version: '1.0', sha256: 'b1', supported_product_ids: ['t-embed'] }),
    fw({ name: 'Factory', version: 'v2.0', sha256: 'a2', supported_product_ids: ['t-deck'] }),
  ];

  it('flatten(group(x)) is a permutation of x (no loss, no duplication)', () => {
    const round = flattenFirmwares(groupFirmwares(sample));
    expect(round).toHaveLength(sample.length);
    expect(bySha(round)).toEqual(bySha(sample));
  });

  it('grouping is idempotent: group(flatten(group(x))) equals group(x)', () => {
    const once = groupFirmwares(sample);
    const twice = groupFirmwares(flattenFirmwares(once));
    expect(twice).toEqual(once);
  });

  it('group counts: 3 flat entries with one duplicate name -> 2 groups', () => {
    expect(groupFirmwares(sample)).toHaveLength(2);
  });
});

describe('normalizeManifest', () => {
  it('returns safe empty defaults for null / undefined / {}', () => {
    for (const input of [null, undefined, {}]) {
      const n = normalizeManifest(input as never);
      expect(n.product_list).toEqual([]);
      expect(n.firmware_list).toEqual([]);
      expect(n.firmwares).toEqual([]);
      expect(n.series_list).toEqual([]);
      expect(n.schema_version).toBe(1);
    }
  });

  it('derives nested firmwares from a v1 flat manifest', () => {
    const n = normalizeManifest({
      product_list: [{ product_id: 't-deck' }],
      firmware_list: [
        fw({ name: 'Factory', version: 'v1', sha256: 'a' }),
        fw({ name: 'Factory', version: 'v2', sha256: 'b' }),
      ],
      series_list: [{ id: 's1' }],
    });
    expect(n.firmwares).toHaveLength(1);
    expect(n.firmwares[0].versions).toHaveLength(2);
    expect(n.firmware_list).toHaveLength(2);
    expect(n.product_list).toHaveLength(1);
    expect(n.series_list).toHaveLength(1);
  });

  it('derives flat firmware_list from a v2 nested manifest (old-client fidelity)', () => {
    const n = normalizeManifest({
      schema_version: 2,
      firmwares: [
        {
          groupName: 'Factory',
          hasMultipleVersions: true,
          versions: [fw({ name: 'Factory', version: 'v1' }), fw({ name: 'Factory', version: 'v2' })],
        },
      ],
    });
    expect(n.schema_version).toBe(2);
    expect(n.firmware_list).toHaveLength(2);
    expect(n.firmware_list.map(f => f.version)).toEqual(['v1', 'v2']);
  });

  it('keeps an explicit flat list as-is even when nested firmwares are also present', () => {
    const explicitFlat = [fw({ name: 'Legacy', version: 'v9', sha256: 'keepme' })];
    const n = normalizeManifest({
      schema_version: 2,
      firmware_list: explicitFlat,
      firmwares: [
        { groupName: 'Factory', hasMultipleVersions: false, versions: [fw({ name: 'Factory', version: 'v1' })] },
      ],
    });
    // flat list is preserved verbatim for already-shipped clients
    expect(n.firmware_list).toBe(explicitFlat);
    // nested view is the v2 source of truth
    expect(n.firmwares[0].groupName).toBe('Factory');
  });

  it('treats an empty firmwares array as "no nested data" and falls back to flat', () => {
    const n = normalizeManifest({
      firmwares: [],
      firmware_list: [fw({ name: 'A', version: 'v1' })],
    });
    expect(n.firmwares).toHaveLength(1);
    expect(n.firmwares[0].groupName).toBe('A');
  });

  it('coerces non-array fields to empty arrays without throwing', () => {
    const n = normalizeManifest({
      product_list: 'nope' as unknown as unknown[],
      firmware_list: 42 as unknown as LegacyFirmware[],
      series_list: { not: 'array' } as unknown as unknown[],
    });
    expect(n.product_list).toEqual([]);
    expect(n.firmware_list).toEqual([]);
    expect(n.firmwares).toEqual([]);
    expect(n.series_list).toEqual([]);
  });

  it('round-trips a v1 manifest through normalize without losing firmware entries', () => {
    const list = [
      fw({ name: 'Factory', version: 'v1', sha256: 'a' }),
      fw({ name: 'Bruce', version: '1.0', sha256: 'b' }),
      fw({ name: 'Factory', version: 'v2', sha256: 'c' }),
    ];
    const n = normalizeManifest({ firmware_list: list });
    const flattenedAgain = flattenFirmwares(n.firmwares);
    expect(bySha(flattenedAgain)).toEqual(bySha(list));
  });
});
