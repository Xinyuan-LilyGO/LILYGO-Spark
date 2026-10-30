/**
 * SiFli SF32 (T-Display SF32, SF32LB52) firmware packages, as the manifest
 * describes them. An SF32 firmware is a release .zip holding three images
 * (flash table, bootloader, main) that are written together; Spark lists and
 * downloads it, and the user flashes it with the release's own installer or
 * SiFli's sftool. See LILYGO-Spark-Server/src/utils/sf32Package.ts.
 */

export type Sf32Role = 'ftab' | 'bootloader' | 'main';

export interface Sf32Image {
  role: Sf32Role;
  /** Path of the image inside the zip. */
  path: string;
  /** Flash address, e.g. "0x12020000". */
  addr: string;
  size: number;
  sha256: string;
}

export interface Sf32PackageInfo {
  /** cairn: Cairn's -install.zip; imgburnlist: LilyGO SDK output; plain: three loose .bin files */
  layout: 'cairn' | 'imgburnlist' | 'plain';
  /** The zip carries a one-click installer (Install on Mac.command / Windows.bat / install-linux.sh). */
  installer: boolean;
  images: Sf32Image[];
}

export function isSf32Firmware(fw: { sf32_package?: Sf32PackageInfo | null } | null | undefined): boolean {
  return !!fw?.sf32_package?.images?.length;
}

/** True for an SF32 product, from its `mcu` field (e.g. "SF32LB52"). */
export function isSf32Mcu(mcu: string | undefined | null): boolean {
  return /^sf32/i.test((mcu || '').trim());
}

/** Where Spark's extract step put a package (see electron/sf32Package.ts). */
export interface Sf32Extracted {
  /** Folder the package was extracted into. */
  path: string;
  /** Top folder of the zip that extraction removed from every path, or null. */
  strip: string | null;
  /** Path separator of the user's system. */
  sep: string;
}

/** Absolute path of one image of an extracted package. */
export function extractedImagePath(dir: Sf32Extracted, zipPath: string): string {
  const rel = dir.strip && zipPath.startsWith(dir.strip + '/') ? zipPath.slice(dir.strip.length + 1) : zipPath;
  return dir.path + dir.sep + rel.split('/').join(dir.sep);
}

/**
 * The sftool command that writes the package's images from the folder Spark
 * extracted them into. `sftool` is SiFli's flasher (github.com/OpenSiFli/sftool).
 */
export function sftoolWriteCommand(pkg: Sf32PackageInfo, dir: Sf32Extracted, port = '<PORT>'): string {
  const args = pkg.images.map(i => `"${extractedImagePath(dir, i.path)}@${i.addr}"`).join(' ');
  return `sftool -c SF32LB52 -p ${port} write_flash ${args}`;
}
