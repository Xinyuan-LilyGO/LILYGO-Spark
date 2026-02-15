/**
 * macOS: play system sound when USB devices are plugged in or unplugged.
 * Similar to Windows default behavior.
 */
import { execFile } from 'node:child_process';
import { platform } from 'node:os';

const POLL_INTERVAL_MS = 1200;
const MACOS_SOUND_CONNECT = '/System/Library/Sounds/Ping.aiff';
const MACOS_SOUND_DISCONNECT = '/System/Library/Sounds/Pop.aiff';

function playSound(soundPath: string): void {
  execFile('afplay', [soundPath], (err) => {
    if (err) console.warn('[UsbHotplugSound] afplay failed:', err.message);
  });
}

/** Get device count from USB tree. Tries ioreg first (fast), falls back to system_profiler. */
async function getUsbState(): Promise<{ count: number; fingerprint: string } | null> {
  const tryIoreg = (): Promise<{ count: number; fingerprint: string } | null> =>
    new Promise((resolve) => {
      execFile('ioreg', ['-p', 'IOUSB', '-l', '-w0'], { maxBuffer: 4 * 1024 * 1024, timeout: 4000 }, (err, stdout) => {
        if (err) {
          console.warn('[UsbHotplugSound] ioreg failed:', err.message);
          resolve(null);
          return;
        }
        const out = stdout || '';
        const devices: string[] = [];
        // Split by line starting with optional whitespace/pipes and then "+-o "
        const blocks = out.split(/\n[ \t|]*\+-o /);
        for (const block of blocks) {
          const v = block.match(/"idVendor" = (0x[0-9a-fA-F]+|\d+)/);
          const p = block.match(/"idProduct" = (0x[0-9a-fA-F]+|\d+)/);
          if (v && p) {
            const vid = v[1].startsWith('0x') ? parseInt(v[1], 16) : parseInt(v[1], 10);
            const pid = p[1].startsWith('0x') ? parseInt(p[1], 16) : parseInt(p[1], 10);
            devices.push(`${vid.toString(16)}:${pid.toString(16)}`);
          }
        }
        const unique = [...new Set(devices)];
        resolve({ count: unique.length, fingerprint: unique.sort().join('|') });
      });
    });

  const trySystemProfiler = (): Promise<{ count: number; fingerprint: string } | null> =>
    new Promise((resolve) => {
      execFile('system_profiler', ['SPUSBDataType', '-detailLevel', 'mini'], { maxBuffer: 4 * 1024 * 1024, timeout: 10000 }, (err, stdout) => {
        if (err) {
          console.warn('[UsbHotplugSound] system_profiler failed:', err.message);
          resolve(null);
          return;
        }
        const out = stdout || '';
        const vendors = [...out.matchAll(/Vendor ID: (0x[0-9a-fA-F]+)/g)].map((m) => m[1]);
        const products = [...out.matchAll(/Product ID: (0x[0-9a-fA-F]+)/g)].map((m) => m[1]);
        const devices: string[] = [];
        for (let i = 0; i < Math.min(vendors.length, products.length); i++) {
          devices.push(`${vendors[i]}:${products[i]}`);
        }
        const fingerprint = devices.sort().join('|');
        resolve({ count: devices.length, fingerprint });
      });
    });

  const state = await tryIoreg();
  if (state) return state;
  console.warn('[UsbHotplugSound] ioreg failed, trying system_profiler...');
  return trySystemProfiler();
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastState: { count: number; fingerprint: string } = { count: 0, fingerprint: '' };

export function startUsbHotplugSound(): void {
  if (platform() !== 'darwin') return;
  if (pollTimer) return;

  const poll = async () => {
    const state = await getUsbState();
    if (!state) return; // Skip if both methods failed

    if (!lastState.fingerprint && lastState.count === 0) {
      lastState = state;
      return;
    }
    if (state.fingerprint !== lastState.fingerprint) {
      const oldSet = new Set((lastState.fingerprint || '').split('|').filter(Boolean));
      const newSet = new Set((state.fingerprint || '').split('|').filter(Boolean));
      const added = [...newSet].filter((id) => !oldSet.has(id));
      const removed = [...oldSet].filter((id) => !newSet.has(id));
      
      console.log(`[UsbHotplugSound] Change detected. Added: ${added.join(',')}, Removed: ${removed.join(',')}`);

      if (added.length > 0) {
        console.log('[UsbHotplugSound] USB device connected, playing sound');
        playSound(MACOS_SOUND_CONNECT);
      }
      if (removed.length > 0) {
        console.log('[UsbHotplugSound] USB device disconnected, playing sound');
        playSound(MACOS_SOUND_DISCONNECT);
      }
      lastState = state;
    }
  };

  getUsbState().then((state) => {
    if (state) lastState = state;
    pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  });
}

export function stopUsbHotplugSound(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
