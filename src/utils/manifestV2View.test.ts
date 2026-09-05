import { describe, it, expect } from 'vitest';
import {
  v2VersionToFlat,
  v2FirmwareToGroup,
  flattenV2,
  groupsForProduct,
  productHasFirmwareV2,
} from './manifestV2View';
import type { ManifestV2, FirmwareV2 } from './manifestV2';

const fw: FirmwareV2 = {
  id: 'factory',
  name: 'Factory',
  description: 'Factory firmware',
  type: ['factory', 'stable'],
  supported_product_ids: ['t-deck', 't-deck-pro'],
  source: 'official',
  source_code_url: 'https://github.com/x/y',
  author: { name: 'LILYGO', link: 'https://lilygo.cc', email: 'a@b.com' },
  image_urls: ['http://img/1.png'],
  versions: [
    { version: '2025-10-01 12:00', filename: 'factory_202510011200.bin', sha256: 'aa', oss_url: 'http://o/aa', size: 100, md5: 'm1', published_at: '2025-10-01' },
    { version: '2025-09-01 12:00', filename: 'factory_202509011200.bin', sha256: 'bb', oss_url: 'http://o/bb', size: 90 },
  ],
  latest_sha256: 'aa',
};

const manifest: ManifestV2 = {
  schema_version: 2,
  generated_at: '',
  product_list: [],
  firmwares: [
    fw,
    {
      id: 'bruce',
      name: 'Bruce',
      description: '',
      type: [],
      supported_product_ids: ['t-embed'],
      source: 'community',
      author: {},
      versions: [{ version: 'v1', filename: 'bruce_v1.bin', sha256: 'cc' }],
    },
  ],
  collections: [],
};

describe('v2VersionToFlat', () => {
  it('merges firmware-level metadata with version-level binary fields', () => {
    const flat = v2VersionToFlat(fw, fw.versions[0]);
    expect(flat).toMatchObject({
      name: 'Factory',
      version: '2025-10-01 12:00',
      type: 'factory,stable',
      filename: 'factory_202510011200.bin',
      sha256: 'aa',
      oss_url: 'http://o/aa',
      size: 100,
      md5: 'm1',
      source_code_url: 'https://github.com/x/y',
      author_name: 'LILYGO',
      author_email: 'a@b.com',
      supported_product_ids: ['t-deck', 't-deck-pro'],
      image_urls: ['http://img/1.png'],
      firmware_id: 'factory',
    });
  });

  it('lets a version override the product list', () => {
    const flat = v2VersionToFlat(fw, { version: 'v3', filename: 'x.bin', supported_product_ids: ['only-this'] });
    expect(flat.supported_product_ids).toEqual(['only-this']);
  });

  it('leaves a missing download_url undefined instead of coercing it to ""', () => {
    // '' reads as a real value to anything treating the field as a key, which is
    // how unrelated community firmwares once shared one download-cache slot.
    const flat = v2VersionToFlat(fw, { version: 'v3', filename: 'x.bin', oss_url: 'http://o/x' });
    expect(flat.download_url).toBeUndefined();
  });

  it('keeps a real external origin', () => {
    const flat = v2VersionToFlat(fw, { version: 'v3', filename: 'x.bin', download_url: 'https://github.com/x/y/releases/x.zip' });
    expect(flat.download_url).toBe('https://github.com/x/y/releases/x.zip');
  });
});

describe('v2FirmwareToGroup', () => {
  it('produces a group preserving version order', () => {
    const g = v2FirmwareToGroup(fw);
    expect(g.groupName).toBe('Factory');
    expect(g.versions.map(v => v.sha256)).toEqual(['aa', 'bb']);
    expect(g.supportedProductIds).toEqual(['t-deck', 't-deck-pro']);
  });
});

describe('flattenV2', () => {
  it('flattens every version of every firmware', () => {
    expect(flattenV2(manifest).map(f => f.sha256)).toEqual(['aa', 'bb', 'cc']);
  });
  it('tolerates null', () => {
    expect(flattenV2(null)).toEqual([]);
  });
});

describe('groupsForProduct', () => {
  it('returns only firmwares targeting the product, as groups', () => {
    const groups = groupsForProduct(manifest, 't-deck');
    expect(groups.map(g => g.groupName)).toEqual(['Factory']);
    expect(groups[0].versions).toHaveLength(2);
  });
  it('returns [] for null product', () => {
    expect(groupsForProduct(manifest, null)).toEqual([]);
  });
  it('does NOT merge distinct firmwares into one card', () => {
    const groups = groupsForProduct(manifest, 't-embed');
    expect(groups).toHaveLength(1);
    expect(groups[0].groupName).toBe('Bruce');
  });
});

describe('productHasFirmwareV2', () => {
  it('detects presence/absence', () => {
    expect(productHasFirmwareV2(manifest, 't-deck')).toBe(true);
    expect(productHasFirmwareV2(manifest, 'nope')).toBe(false);
  });
});
