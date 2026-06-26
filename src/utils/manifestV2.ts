/**
 * Firmware manifest schema v2 — the clean, nested "firmware series + versions"
 * format that the new desktop client consumes DIRECTLY (no compatibility shim).
 *
 * v2 is generated from the legacy flat v1 manifest by `convertV1ToV2`, which is
 * pure and unit-tested. The generator script (`scripts/generate-v2-manifest.ts`)
 * and the server-side dual-write both call this same function, so there is a
 * single source of truth for the v1 -> v2 transformation.
 *
 * Old clients keep reading `firmware_manifest.json` (v1). New clients read a
 * separate `firmware_manifest_v2.json` (this shape). The two files are produced
 * from the same data, so neither side needs to know about the other.
 */

import { groupFirmwares, firmwareGroupKeyStrict, type LegacyFirmware } from './manifestSchema.ts';

/** A single flashable binary (one version of a firmware). */
export interface FirmwareVersionV2 {
  version: string;
  release_note?: string;
  filename: string;
  flash_address?: string;
  download_url?: string;
  oss_url?: string;
  size?: number;
  compressed_size?: number;
  md5?: string;
  sha256?: string;
  published_at?: string;
  /** Override the firmware-level product list for this specific version only. */
  supported_product_ids?: string[];
}

/** A firmware "program" / series carrying all shared metadata once. */
export interface FirmwareV2 {
  /** Stable slug, unique within the manifest. */
  id: string;
  name: string;
  description: string;
  /** Normalized tag list (v1 stored this as a comma-joined string). */
  type: string[];
  /** Union of every version's supported products (default for all versions). */
  supported_product_ids: string[];
  source: string;
  source_code_url?: string;
  homepage?: string;
  author: { name?: string; link?: string; email?: string };
  image_urls?: string[];
  tags?: string[];
  versions: FirmwareVersionV2[];
  /** sha256 of the recommended/newest version (defaults to the first one). */
  latest_sha256?: string;
}

/** A curated cross-firmware collection (was `series_list` in v1). */
export interface CollectionV2 {
  id: string;
  name: string;
  description: string;
  icon?: string;
  cover_image?: string;
  homepage?: string;
  tags?: string[];
  /** References `FirmwareV2.id` (v1 referenced per-version sha256 prefixes). */
  firmware_ids: string[];
  admin_emails: string[];
  order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ManifestV2 {
  schema_version: 2;
  generated_at: string;
  product_list: unknown[];
  firmwares: FirmwareV2[];
  collections: CollectionV2[];
}

/** Minimal shape of the v1 manifest this converter reads. */
export interface ManifestV1Input {
  product_list?: unknown[];
  firmware_list?: LegacyFirmware[];
  series_list?: RawSeriesV1[];
}

interface RawSeriesV1 {
  id: string;
  name?: string;
  description?: string;
  icon?: string;
  cover_image?: string;
  homepage?: string;
  tags?: string[];
  firmware_ids?: string[];
  admin_emails?: string[];
  order?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Derive a firmware's identity + version from its filename.
 *
 * In this dataset the human `name` field is unreliable (most entries are
 * auto-named "Repository (main)" by the GitHub bin fetcher). The REAL identity
 * lives in the filename, which follows LILYGO's bracket convention, e.g.
 *   `[T-Display-P4-Keyboard][lvgl_9_ui][hi8561][ov2710]_firmware_202509101652.bin`
 * where the bracket segments are the firmware identity and the trailing
 * `_firmware_<timestamp>` (or `_V1.0.0`, `_20260319`) is the version.
 *
 * Returns the version-stripped `stem` (identity) and the extracted `version`
 * token (raw, unformatted) when one was found.
 */
export function deriveFirmwareIdentity(filename: string): { stem: string; version: string | null } {
  let stem = (filename || '').replace(/\.bin$/i, '');
  let version: string | null = null;

  // 1) Build-timestamp version: `_firmware_202509101652`
  const tsMatch = stem.match(/_firmware_(\d{6,14})/);
  if (tsMatch) version = tsMatch[1];
  stem = stem.replace(/_firmware_\d{6,14}/g, '');

  // 2) Trailing bare timestamp/date: `_20260319`
  let m = stem.match(/[_\-](\d{8,14})$/);
  if (m && typeof m.index === 'number') {
    if (!version) version = m[1];
    stem = stem.slice(0, m.index);
  }

  // 3) Trailing semantic version: `_v1.4`, `_V1.0.0`, `-1.0.0`
  m = stem.match(/[_\-]([vV]?\d+(?:[._]\d+)*)$/);
  if (m && typeof m.index === 'number') {
    if (!version) version = m[1];
    stem = stem.slice(0, m.index);
  }

  // 4) Leftover `_firmware` tail and trailing separators
  stem = stem.replace(/[_\-]?firmware$/i, '').replace(/[_\-\s]+$/, '');

  return { stem: stem || filename, version };
}

/** Format a raw version token into something human-friendly. */
export function formatDerivedVersion(raw: string | null): string {
  if (!raw) return '';
  if (/^\d{12,14}$/.test(raw)) {
    // YYYYMMDDHHMM[SS] build timestamp
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)} ${raw.slice(8, 10)}:${raw.slice(10, 12)}`;
  }
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

/** Turn a filename stem into a readable firmware name. */
export function stemToDisplayName(stem: string): string {
  let s = (stem || '').trim();
  if (s.includes('][') || /^\[.*\]$/.test(s)) {
    s = s.replace(/^\[/, '').replace(/\]$/, '').split('][').join(' · ');
  }
  s = s.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s || stem;
}

/** The auto-generated GitHub-fetcher names that should be replaced by the stem. */
function isGenericName(name: string | undefined): boolean {
  return !name || /^repository\b/i.test(name.trim());
}

/** Turn a firmware display name into a URL/id-safe slug. */
export function slugifyFirmwareName(name: string): string {
  const slug = (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'firmware';
}

/** v1 `type` was a comma-joined string; v2 uses a clean string array. */
export function normalizeTypeToArray(type: unknown): string[] {
  if (Array.isArray(type)) return type.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof type === 'string') return type.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function sha16(sha256: string | undefined | null): string | null {
  const s = (sha256 || '').toLowerCase();
  return s.length >= 16 ? s.slice(0, 16) : null;
}

/**
 * Convert a legacy v1 manifest into the clean nested v2 shape.
 *
 * - Flat `firmware_list` entries are grouped into nested firmwares using the
 *   shared, tested grouping rule (name + source repo).
 * - Each firmware gets a stable, collision-free slug `id`.
 * - `series_list` becomes `collections`, with per-version sha256 references
 *   remapped to the owning firmware `id`.
 *
 * Pure: does not mutate the input and does not touch the filesystem.
 */
export function convertV1ToV2(v1: ManifestV1Input | null | undefined): ManifestV2 {
  const input = v1 || {};
  const list = Array.isArray(input.firmware_list) ? input.firmware_list : [];

  // Group by the REAL identity: version-stripped filename stem + source repo +
  // product set. (The `name` field is unreliable in this dataset.) The strict
  // product+source key from manifestSchema is combined with the filename stem.
  const groupKey = (fw: LegacyFirmware): string => {
    const { stem } = deriveFirmwareIdentity(fw.filename || '');
    return `${stem}\u0001${firmwareGroupKeyStrict(fw)}`;
  };
  const groups = groupFirmwares(list, groupKey);

  const usedIds = new Set<string>();
  const shaToFirmwareId = new Map<string, string>();

  const firmwares: FirmwareV2[] = groups.map(group => {
    const rep = group.versions[0] || ({} as LegacyFirmware);
    const { stem } = deriveFirmwareIdentity(rep.filename || '');

    // Prefer a meaningful human name; fall back to the readable filename stem.
    const displayName = isGenericName(rep.name) ? stemToDisplayName(stem) : rep.name;

    // Allocate a unique slug id.
    let id = slugifyFirmwareName(displayName);
    if (usedIds.has(id)) {
      const firstProduct = rep.supported_product_ids?.[0];
      let candidate = firstProduct ? `${id}-${slugifyFirmwareName(firstProduct)}` : id;
      let n = 2;
      while (usedIds.has(candidate)) candidate = `${id}-${n++}`;
      id = candidate;
    }
    usedIds.add(id);

    const versions: FirmwareVersionV2[] = group.versions.map(v => {
      const derived = deriveFirmwareIdentity(v.filename || '');
      const label = v.version || formatDerivedVersion(derived.version) || (v.published_at ? String(v.published_at).slice(0, 10) : '') || 'build';
      const version: FirmwareVersionV2 = {
        version: label,
        filename: v.filename || '',
      };
      if (v.release_note) version.release_note = v.release_note;
      const flash = (v as { path?: string }).path;
      if (flash) version.flash_address = flash;
      if (v.download_url) version.download_url = v.download_url;
      if (v.oss_url) version.oss_url = v.oss_url;
      if (typeof v.size === 'number') version.size = v.size;
      if (typeof v.compressed_size === 'number') version.compressed_size = v.compressed_size;
      if (v.md5) version.md5 = v.md5;
      if (v.sha256) version.sha256 = v.sha256;
      if (v.published_at) version.published_at = v.published_at;
      return version;
    });

    // Newest first: sort by published date, then by any numeric build token.
    const sortKey = (v: FirmwareVersionV2): number => {
      if (v.published_at) {
        const t = Date.parse(v.published_at);
        if (!Number.isNaN(t)) return t;
      }
      const d = deriveFirmwareIdentity(v.filename || '').version;
      if (d && /^\d{8,14}$/.test(d)) return Number(d.padEnd(14, '0'));
      return 0;
    };
    versions.sort((a, b) => sortKey(b) - sortKey(a));

    for (const v of group.versions) {
      const id16 = sha16(v.sha256);
      if (id16) shaToFirmwareId.set(id16, id);
    }

    const firmware: FirmwareV2 = {
      id,
      name: displayName,
      description: rep.description || '',
      type: normalizeTypeToArray(rep.type),
      supported_product_ids: group.supportedProductIds || [],
      source: rep.source || '',
      author: {
        name: rep.author_name || undefined,
        link: rep.author_link || undefined,
        email: rep.author_email || undefined,
      },
      versions,
    };
    if (rep.source_code_url) firmware.source_code_url = rep.source_code_url;
    if (rep.image_urls && rep.image_urls.length > 0) firmware.image_urls = rep.image_urls;
    const latest = versions.find(v => v.sha256)?.sha256;
    if (latest) firmware.latest_sha256 = latest;
    return firmware;
  });

  const seriesList = Array.isArray(input.series_list) ? input.series_list : [];
  const collections: CollectionV2[] = seriesList.map(s => {
    const mappedIds: string[] = [];
    const seen = new Set<string>();
    for (const fid of s.firmware_ids || []) {
      const fwId = shaToFirmwareId.get(String(fid).toLowerCase().slice(0, 16));
      if (fwId && !seen.has(fwId)) {
        seen.add(fwId);
        mappedIds.push(fwId);
      }
    }
    const collection: CollectionV2 = {
      id: s.id,
      name: s.name || '',
      description: s.description || '',
      firmware_ids: mappedIds,
      admin_emails: Array.isArray(s.admin_emails) ? s.admin_emails : [],
    };
    if (s.icon) collection.icon = s.icon;
    if (s.cover_image) collection.cover_image = s.cover_image;
    if (s.homepage) collection.homepage = s.homepage;
    if (s.tags && s.tags.length) collection.tags = s.tags;
    if (typeof s.order === 'number') collection.order = s.order;
    if (s.created_at) collection.created_at = s.created_at;
    if (s.updated_at) collection.updated_at = s.updated_at;
    return collection;
  });

  return {
    schema_version: 2,
    generated_at: new Date().toISOString(),
    product_list: Array.isArray(input.product_list) ? input.product_list : [],
    firmwares,
    collections,
  };
}
