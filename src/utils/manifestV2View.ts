/**
 * Adapt the clean nested v2 manifest into the flat records and firmware groups
 * the firmware-center UI renders.
 *
 * The UI's handlers (flash / download / like / share / admin-edit / comments)
 * all operate on a single flat firmware record keyed by sha256. Rather than
 * rewrite ~1500 lines of proven flashing logic, we keep that flat record shape
 * (`FlatFirmware`) and synthesize it from v2: a v2 firmware becomes one group,
 * and each of its versions becomes one flat record. Because v2 already carries
 * clean per-firmware identities (derived from the binary filename), grouping is
 * correct here — unlike the old path that re-grouped a product-filtered flat
 * list by display name and merged unrelated, generically-named firmwares.
 *
 * This is NOT v1<->v2 compatibility logic: it never reconstructs v1, it only
 * projects v2 into render props.
 */

import type { ManifestV2, FirmwareV2, FirmwareVersionV2 } from './manifestV2';
import type { FirmwareGroupOf } from './manifestSchema';

/** Flat per-version firmware record consumed by the UI and its handlers. */
export interface FlatFirmware {
  supported_product_ids: string[];
  name: string;
  version: string;
  type: string;
  filename: string;
  download_url: string;
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
  /** Firmware-level id from v2 (stable slug), useful for keys/collections. */
  firmware_id?: string;
}

export type FlatFirmwareGroup = FirmwareGroupOf<FlatFirmware>;

/** Project one v2 (firmware, version) pair into a flat UI record. */
export function v2VersionToFlat(fw: FirmwareV2, v: FirmwareVersionV2): FlatFirmware {
  return {
    supported_product_ids: v.supported_product_ids ?? fw.supported_product_ids ?? [],
    name: fw.name,
    version: v.version,
    type: (fw.type ?? []).join(','),
    filename: v.filename,
    download_url: v.download_url ?? '',
    description: fw.description ?? '',
    release_note: v.release_note,
    size: v.size,
    compressed_size: v.compressed_size,
    oss_url: v.oss_url,
    md5: v.md5,
    sha256: v.sha256,
    source: fw.source,
    source_code_url: fw.source_code_url,
    published_at: v.published_at,
    author_name: fw.author?.name,
    author_link: fw.author?.link,
    author_email: fw.author?.email,
    image_urls: fw.image_urls,
    firmware_id: fw.id,
  };
}

/** A v2 firmware (with all its versions) as a UI group. */
export function v2FirmwareToGroup(fw: FirmwareV2): FlatFirmwareGroup {
  const versions = (fw.versions ?? []).map(v => v2VersionToFlat(fw, v));
  return {
    groupName: fw.name,
    versions,
    hasMultipleVersions: versions.length > 1,
    groupKey: fw.id,
    supportedProductIds: fw.supported_product_ids ?? [],
  };
}

/** Flatten every version of every firmware into a single flat list. */
export function flattenV2(v2: ManifestV2 | null | undefined): FlatFirmware[] {
  const out: FlatFirmware[] = [];
  for (const fw of v2?.firmwares ?? []) {
    for (const v of fw.versions ?? []) out.push(v2VersionToFlat(fw, v));
  }
  return out;
}

/** Groups for a product view: v2 firmwares that target `productId`. */
export function groupsForProduct(v2: ManifestV2 | null | undefined, productId: string | null): FlatFirmwareGroup[] {
  if (!productId) return [];
  return (v2?.firmwares ?? [])
    .filter(fw => (fw.supported_product_ids ?? []).includes(productId))
    .map(v2FirmwareToGroup);
}

/** True if any firmware targets the product. */
export function productHasFirmwareV2(v2: ManifestV2 | null | undefined, productId: string): boolean {
  return (v2?.firmwares ?? []).some(fw => (fw.supported_product_ids ?? []).includes(productId));
}
