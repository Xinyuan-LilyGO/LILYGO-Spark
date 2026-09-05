/**
 * Firmware manifest schema — transition layer between the legacy flat shape (v1)
 * and the clean nested "firmware series + versions" shape (v2).
 *
 * Background: the legacy `firmware_list` is a flat array where each entry is a
 * single bin. Multiple versions of the same firmware become N separate entries
 * that repeat all shared metadata (name / author / source_code_url / ...). The
 * new UI wants a nested model (one firmware with many versions), but already
 * shipped clients still read the flat `firmware_list` directly from OSS.
 *
 * This module is the single, well-tested source of truth for converting between
 * the two shapes in both directions so that:
 *   - new clients can derive the nested view from any manifest, and
 *   - a v2 manifest can be flattened back to keep old clients working.
 *
 * All functions are pure and side-effect free.
 */

/** Legacy flat firmware entry (manifest schema v1). */
export interface LegacyFirmware {
  supported_product_ids: string[];
  name: string;
  version: string;
  type: string;
  filename: string;
  /**
   * Optional external origin (e.g. a GitHub release asset). Absent for
   * community uploads, whose binary lives at `oss_url`. Never an identity —
   * use `sha256`.
   */
  download_url?: string;
  description: string;
  release_note?: string;
  size?: number;
  compressed_size?: number;
  oss_url?: string;
  md5?: string;
  sha256?: string;
  source?: string;
  source_code_url?: string;
  published_at?: string;
  author_name?: string;
  author_link?: string;
  author_email?: string;
  image_url?: string;
  image_urls?: string[];
}

/**
 * A version inside a nested firmware is just a full legacy entry. Keeping the
 * full record on each version means existing rendering code (which reads
 * `version.sha256`, `version.oss_url`, ...) keeps working unchanged.
 */
export type FirmwareVersion = LegacyFirmware;

/**
 * Nested firmware group (manifest schema v2 view): one firmware program with
 * one or more versions. Generic over the concrete version entry type so callers
 * can preserve their own (structurally compatible) firmware type.
 */
export interface FirmwareGroupOf<T extends LegacyFirmware = LegacyFirmware> {
  /** Display name, shared across versions. */
  groupName: string;
  /** Versions belonging to this firmware, in source order. */
  versions: T[];
  hasMultipleVersions: boolean;
  /** Stable grouping key (derived). Optional so ad-hoc literals stay valid. */
  groupKey?: string;
  /** Union of every version's supported_product_ids, first-seen order. */
  supportedProductIds?: string[];
}

export type FirmwareGroup = FirmwareGroupOf<LegacyFirmware>;

/** Raw manifest as parsed from disk / network — either v1 or v2 (or partial). */
export interface RawManifest {
  schema_version?: number;
  product_list?: unknown[];
  firmware_list?: LegacyFirmware[];
  firmwares?: FirmwareGroup[];
  series_list?: unknown[];
  [key: string]: unknown;
}

/**
 * Canonical in-memory manifest: both the legacy flat list AND the nested view
 * are always present, whichever shape the input used.
 */
export interface NormalizedManifest {
  schema_version: number;
  product_list: unknown[];
  firmware_list: LegacyFirmware[];
  firmwares: FirmwareGroup[];
  series_list: unknown[];
}

/** Normalize a source-code URL for grouping: trim, lowercase, drop trailing slashes. */
function normalizeSourceUrl(url: string | undefined | null): string {
  return (url || '').trim().toLowerCase().replace(/\/+$/, '');
}

/**
 * Stable key used to decide whether two flat entries are versions of the same
 * firmware. We group by display name plus the source-code URL (when present) so
 * that two unrelated firmwares that happen to share a name but live in different
 * repos do NOT get merged. When no source URL is available this degrades to
 * grouping by name only (matching the historical UI behavior).
 *
 * The `\u0000` separator can never appear in either field.
 */
export function firmwareGroupKey(fw: Pick<LegacyFirmware, 'name' | 'source_code_url'>): string {
  const name = (fw.name || '').trim();
  const src = normalizeSourceUrl(fw.source_code_url);
  return src ? `${name}\u0000${src}` : name;
}

/**
 * Stricter key for GLOBAL grouping across the whole manifest (e.g. v1 -> v2
 * conversion). In the UI we group within a single already-selected product, so
 * name (+source) is enough; but globally, many unrelated firmwares share a
 * generic name (e.g. "Original Test", "Factory Firmware"). Including the sorted
 * supported-product set prevents merging firmwares that target different
 * products. Versions of a genuinely-same firmware share name + product set +
 * source repo, so they still group correctly.
 */
export function firmwareGroupKeyStrict(fw: Pick<LegacyFirmware, 'name' | 'source_code_url' | 'supported_product_ids'>): string {
  const name = (fw.name || '').trim();
  const src = normalizeSourceUrl(fw.source_code_url);
  const products = [...new Set((fw.supported_product_ids || []).map(p => (p || '').trim()).filter(Boolean))]
    .sort()
    .join(',');
  return `${name}\u0000${src}\u0000${products}`;
}

/**
 * Group a flat `firmware_list` (v1) into nested firmwares (v2 view).
 *
 * - Group order follows first appearance of each key in the input.
 * - Version order within a group follows the input order (so `versions[0]`
 *   stays the same "default" entry the old UI showed).
 * - `supportedProductIds` is the de-duplicated union of all versions'
 *   `supported_product_ids`, preserving first-seen order.
 */
export function groupFirmwares<T extends LegacyFirmware>(
  list: readonly T[] | null | undefined,
  keyFn: (fw: T) => string = firmwareGroupKey,
): FirmwareGroupOf<T>[] {
  const byKey = new Map<string, FirmwareGroupOf<T>>();
  for (const fw of list || []) {
    if (!fw) continue;
    const key = keyFn(fw);
    let group = byKey.get(key);
    if (!group) {
      group = {
        groupKey: key,
        groupName: (fw.name || '').trim(),
        versions: [],
        hasMultipleVersions: false,
        supportedProductIds: [],
      };
      byKey.set(key, group);
    }
    group.versions.push(fw);
  }

  const result: FirmwareGroupOf<T>[] = [];
  for (const group of byKey.values()) {
    group.hasMultipleVersions = group.versions.length > 1;
    const seen = new Set<string>();
    const union: string[] = [];
    for (const v of group.versions) {
      for (const pid of v.supported_product_ids || []) {
        if (!seen.has(pid)) {
          seen.add(pid);
          union.push(pid);
        }
      }
    }
    group.supportedProductIds = union;
    result.push(group);
  }
  return result;
}

/**
 * Flatten nested firmwares (v2) back into a legacy flat `firmware_list` (v1).
 * This is what lets a v2 manifest keep already-shipped clients working.
 *
 * `flattenFirmwares(groupFirmwares(list))` yields a permutation of `list`
 * (entries are re-ordered to be grouped contiguously, but none are lost or
 * duplicated).
 */
export function flattenFirmwares<T extends LegacyFirmware>(groups: readonly FirmwareGroupOf<T>[] | null | undefined): T[] {
  const out: T[] = [];
  for (const group of groups || []) {
    for (const v of group?.versions || []) {
      if (v) out.push(v);
    }
  }
  return out;
}

/**
 * Accept any manifest shape (v1 flat, v2 nested, or partial/empty) and produce a
 * canonical object where both `firmware_list` and `firmwares` are guaranteed to
 * be present and consistent.
 *
 * - If the input already has nested `firmwares`, that is treated as the source
 *   of truth and `firmware_list` is derived from it (unless an explicit flat
 *   list is also present, which is kept as-is for old-client fidelity).
 * - Otherwise the flat `firmware_list` is the source of truth and `firmwares`
 *   is derived from it.
 *
 * Never throws on malformed input — missing fields become empty arrays.
 */
export function normalizeManifest(raw: RawManifest | null | undefined): NormalizedManifest {
  const m = raw || {};
  const product_list = Array.isArray(m.product_list) ? m.product_list : [];
  const series_list = Array.isArray(m.series_list) ? m.series_list : [];
  const schema_version = typeof m.schema_version === 'number' ? m.schema_version : 1;

  const hasNested = Array.isArray(m.firmwares) && m.firmwares.length > 0;
  const hasFlat = Array.isArray(m.firmware_list) && m.firmware_list.length > 0;

  let firmware_list: LegacyFirmware[];
  let firmwares: FirmwareGroup[];

  if (hasNested) {
    firmwares = m.firmwares as FirmwareGroup[];
    firmware_list = hasFlat ? (m.firmware_list as LegacyFirmware[]) : flattenFirmwares(firmwares);
  } else {
    firmware_list = Array.isArray(m.firmware_list) ? (m.firmware_list as LegacyFirmware[]) : [];
    firmwares = groupFirmwares(firmware_list);
  }

  return { schema_version, product_list, firmware_list, firmwares, series_list };
}
