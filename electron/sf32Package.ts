/**
 * SiFli SF32 (T-Display SF32, SF32LB52) release packages, main-process side:
 *   - inspect a .zip before upload, with the same checks the server runs
 *     (keep in sync with LILYGO-Spark-Server/src/utils/sf32Package.ts);
 *   - extract a downloaded package into a folder the user picks, so they can run
 *     the release's own installer or sftool from it.
 */
import { dialog, shell, IpcMainInvokeEvent } from 'electron';
import AdmZip from 'adm-zip';
import crypto from 'node:crypto';
import path from 'node:path';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';

type Sf32Role = 'ftab' | 'bootloader' | 'main';

interface Sf32Image {
    role: Sf32Role;
    path: string;
    addr: string;
    size: number;
    sha256: string;
}

interface Sf32PackageInfo {
    layout: 'cairn' | 'imgburnlist' | 'plain';
    installer: boolean;
    images: Sf32Image[];
}

class Sf32PackageError extends Error {}

const DEFAULT_ADDR: Record<Sf32Role, number> = {
    ftab: 0x12000000,
    bootloader: 0x12010000,
    main: 0x12020000,
};
const ROLES: Sf32Role[] = ['ftab', 'bootloader', 'main'];
const INSTALLER_NAMES = new Set(['install on mac.command', 'install on windows.bat', 'install-linux.sh']);

const MAX_ENTRIES = 1024;
const FLASH_BASE = 0x12000000;
const FLASH_SIZE = 16 * 1024 * 1024; // T-Display SF32: 16 MB NOR

const FTAB_MAGIC = Buffer.from('FCES', 'ascii');

function isRam(addr: number): boolean {
    return addr >= 0x20000000 && addr < 0x20200000;
}

function isCode(addr: number): boolean {
    return (addr >= 0x10000000 && addr < 0x14000000) || isRam(addr);
}

/** Cortex-M vector table: initial SP in RAM, Thumb reset handler in RAM or flash. */
function hasVectorTable(buf: Buffer): boolean {
    if (buf.length < 8) return false;
    const sp = buf.readUInt32LE(0);
    const reset = buf.readUInt32LE(4);
    return isRam(sp) && (reset & 1) === 1 && isCode(reset & ~1);
}

function checkImage(role: Sf32Role, buf: Buffer, where: string): void {
    if (buf.length === 0) throw new Sf32PackageError(`${where} is empty`);
    if (role === 'ftab') {
        if (!buf.subarray(0, 4).equals(FTAB_MAGIC)) {
            throw new Sf32PackageError(`${where} is not an SF32 flash table (no "FCES" header)`);
        }
        return;
    }
    if (!hasVectorTable(buf)) {
        throw new Sf32PackageError(`${where} is not an SF32 ${role} image (no Cortex-M vector table)`);
    }
}

function hex(n: number): string {
    return '0x' + n.toString(16).padStart(8, '0');
}

function roleOf(file: string): Sf32Role | null {
    const base = path.posix.basename(file).toLowerCase();
    if (base === 'ftab.bin') return 'ftab';
    if (base === 'bootloader.bin') return 'bootloader';
    if (base === 'main.bin') return 'main';
    return null;
}

function isJunk(name: string): boolean {
    return name.split('/').some(seg => seg === '__MACOSX' || seg.startsWith('._'));
}

/** ImgBurnList.ini: FILE0=bootloader\bootloader.bin / ADDR0=0x12010000 / ... / NUM=3 */
function parseImgBurnList(text: string): { file: string; addr: number }[] {
    const kv = new Map<string, string>();
    for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z]+\d*)\s*=\s*(.*?)\s*$/);
        if (m) kv.set(m[1].toUpperCase(), m[2]);
    }
    const num = parseInt(kv.get('NUM') || '', 10);
    if (!Number.isFinite(num) || num < 1 || num > 16) {
        throw new Sf32PackageError('ImgBurnList.ini has no valid NUM entry');
    }
    const out: { file: string; addr: number }[] = [];
    for (let i = 0; i < num; i++) {
        const file = kv.get(`FILE${i}`);
        const addrText = kv.get(`ADDR${i}`);
        const addr = addrText ? Number(addrText) : NaN;
        if (!file || !Number.isInteger(addr)) {
            throw new Sf32PackageError(`ImgBurnList.ini: FILE${i} / ADDR${i} missing or invalid`);
        }
        out.push({ file: file.replace(/\\/g, '/'), addr });
    }
    return out;
}

function inspect(zipBuffer: Buffer): Sf32PackageInfo {
    let zip: AdmZip;
    try {
        zip = new AdmZip(zipBuffer);
    } catch {
        throw new Sf32PackageError('Not a valid zip file');
    }
    const all = zip.getEntries();
    if (all.length > MAX_ENTRIES) throw new Sf32PackageError(`Zip has too many entries (${all.length})`);

    const entries = all.filter(e => !e.isDirectory && !isJunk(e.entryName.replace(/\\/g, '/')));
    const byName = new Map(entries.map(e => [e.entryName.replace(/\\/g, '/'), e]));

    const read = (name: string): Buffer => {
        const entry = byName.get(name)!;
        // Check the declared size before inflating, so a zip bomb never expands.
        if (entry.header.size > FLASH_SIZE) throw new Sf32PackageError(`${name} is larger than the 16 MB flash`);
        const data = entry.getData();
        if (data.length !== entry.header.size) throw new Sf32PackageError(`${name} is corrupt in the zip`);
        return data;
    };

    const installer = entries.some(e => INSTALLER_NAMES.has(path.posix.basename(e.entryName.replace(/\\/g, '/')).toLowerCase()));

    let layout: Sf32PackageInfo['layout'];
    let found: { role: Sf32Role; name: string; addr: number }[];

    const inis = [...byName.keys()].filter(n => path.posix.basename(n).toLowerCase() === 'imgburnlist.ini');
    if (inis.length > 1) {
        throw new Sf32PackageError('Zip holds more than one firmware (several ImgBurnList.ini): zip one firmware folder');
    }
    if (inis.length === 1) {
        layout = 'imgburnlist';
        const dir = path.posix.dirname(inis[0]);
        found = [];
        for (const { file, addr } of parseImgBurnList(read(inis[0]).toString('utf-8'))) {
            const name = path.posix.normalize(dir === '.' ? file : `${dir}/${file}`);
            if (!byName.has(name)) throw new Sf32PackageError(`ImgBurnList.ini names ${file}, which is not in the zip`);
            const role = roleOf(name);
            if (!role) throw new Sf32PackageError(`ImgBurnList.ini names ${file}: Spark supports ftab, bootloader and main images only`);
            if (found.some(f => f.role === role)) throw new Sf32PackageError(`ImgBurnList.ini names two ${role} images`);
            found.push({ role, name, addr });
        }
    } else {
        found = [];
        for (const role of ROLES) {
            // Cairn ships pre-escaped copies for its own installer; the real images are the others.
            const candidates = [...byName.keys()].filter(n => roleOf(n) === role && !n.split('/').includes('escaped'));
            if (candidates.length > 1) {
                throw new Sf32PackageError(`Zip holds more than one ${role}.bin: zip one firmware folder`);
            }
            if (candidates.length === 1) found.push({ role, name: candidates[0], addr: DEFAULT_ADDR[role] });
        }
        const cairn = installer || [...byName.keys()].some(n => path.posix.basename(n) === 'restore.txt');
        layout = cairn ? 'cairn' : 'plain';
    }

    const missing = ROLES.filter(r => !found.some(f => f.role === r));
    if (missing.length > 0) {
        throw new Sf32PackageError(
            `SF32 firmware needs ftab.bin, bootloader.bin and main.bin together; missing: ${missing.join(', ')}. ` +
            'Upload the release package (for Cairn, the -install.zip), not the -update.bin.'
        );
    }

    const images: Sf32Image[] = found
        .map(f => {
            const data = read(f.name);
            checkImage(f.role, data, f.name);
            if (f.addr < FLASH_BASE || f.addr + data.length > FLASH_BASE + FLASH_SIZE) {
                throw new Sf32PackageError(`${f.name} at ${hex(f.addr)} does not fit in the SF32 flash`);
            }
            return {
                role: f.role,
                path: f.name,
                addr: hex(f.addr),
                size: data.length,
                sha256: crypto.createHash('sha256').update(data).digest('hex'),
            };
        })
        .sort((a, b) => Number(a.addr) - Number(b.addr));

    for (let i = 1; i < images.length; i++) {
        const prev = images[i - 1];
        if (Number(prev.addr) + prev.size > Number(images[i].addr)) {
            throw new Sf32PackageError(`${prev.path} overlaps ${images[i].path} in flash`);
        }
    }

    return { layout, installer, images };
}

/** IPC 'inspect-sf32-package': the zip's bytes in, its images (or why it is not an SF32 package) out. */
export async function handleInspectSf32Package(_event: IpcMainInvokeEvent, data: ArrayBuffer | Uint8Array) {
    try {
        const buf = Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
        return { success: true, info: inspect(buf) };
    } catch (e: any) {
        return { success: false, error: e instanceof Sf32PackageError ? e.message : `Could not read the zip: ${e.message}` };
    }
}

/**
 * IPC 'extract-sf32-package': unzip a downloaded package into a new folder
 * inside a directory the user picks, keeping file modes (the installers are
 * executable), then reveal it. Returns the folder, or null if cancelled.
 */
export async function handleExtractSf32Package(_event: IpcMainInvokeEvent, zipPath: string) {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory'],
            buttonLabel: 'Extract here',
        });
        if (canceled || filePaths.length === 0) return { success: true, path: null };

        const zip = new AdmZip(zipPath);
        const names = zip.getEntries().map(e => e.entryName.replace(/\\/g, '/')).filter(n => !isJunk(n));
        // A zip whose files all sit in one top folder (Cairn's does) is unwrapped,
        // so the installer is right inside the folder we reveal.
        const tops = new Set(names.map(n => n.split('/')[0]));
        const top = tops.size === 1 && names.every(n => n.includes('/')) ? [...tops][0] : null;

        const base = top || path.basename(zipPath).replace(/\.zip$/i, '');
        let target = path.join(filePaths[0], base);
        for (let n = 2; existsSync(target); n++) target = path.join(filePaths[0], `${base} (${n})`);

        // Extract into a scratch folder next to the target, then move into place.
        const staging = await fs.mkdtemp(path.join(filePaths[0], '.spark-extract-'));
        try {
            // Refuse entries that would land outside the folder.
            for (const name of names) {
                const dest = path.resolve(staging, name);
                if (dest !== staging && !dest.startsWith(staging + path.sep)) {
                    throw new Error(`Unsafe path in zip: ${name}`);
                }
            }
            zip.extractAllTo(staging, false, true);
            await fs.rename(top ? path.join(staging, top) : staging, target);
            if (!top) await fs.chmod(target, 0o755); // mkdtemp made it private
        } finally {
            await fs.rm(staging, { recursive: true, force: true });
        }
        shell.showItemInFolder(target);
        // `strip`: the top folder removed from every zip path (null if none)
        return { success: true, path: target, strip: top, sep: path.sep };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
