/**
 * Regression test for the "download A, burn B, A gets flashed" bug.
 *
 * Community-uploaded firmware is published with `download_url: ''` (the binary
 * lives at `oss_url` instead), so every community firmware used to map onto the
 * same `tasks['']` entry. Downloading one of them made every other community
 * firmware render as "already downloaded" and hand the wrong file to the burner.
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DownloadProvider, useDownload, firmwareCacheKey } from './DownloadContext';

// Two real entries from the T5 E-Paper S3 Pro page — both `download_url: ''`.
const FW_A = {
  filename: 'EDC Book-2.0.0.bin',
  download_url: '',
  oss_url: 'https://lilygo.oss-accelerate.aliyuncs.com/firmware/cb0c9ed7_EDC Book-2.0.0.bin.zip',
  md5: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  sha256: 'cb0c9ed7ccbe7004c6ad0b9f0dcfb07d11dc80af0c39094d4ba1db2e47f5c8cf',
};
const FW_B = {
  filename: 'firmware-t5s3-epaper-v2-2.8.0.f8e4f55.factory.bin',
  download_url: '',
  oss_url: 'https://lilygo.oss-accelerate.aliyuncs.com/firmware/2bc51382_firmware-t5s3-epaper.bin.zip',
  md5: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  sha256: '2bc513822d01ec49b08db78294a477c0dcb9dc198a00aa92c0b10d50829db564',
};

type Fw = typeof FW_A;

function mockIpc() {
  const invoke = vi.fn(async (channel: string, ...args: any[]) => {
    if (channel === 'check-files-exist') return {};
    if (channel === 'download-firmware') {
      const [, ossUrl] = args as [string, string, string];
      const fw = [FW_A, FW_B].find(f => f.oss_url === ossUrl)!;
      return {
        success: true,
        path: `/tmp/${fw.filename}`,
        md5: fw.md5,
        sha256: fw.sha256,
        fileName: fw.filename,
        fileSize: 1024,
      };
    }
    return { success: false, error: `unexpected channel ${channel}` };
  });
  (window as any).ipcRenderer = { invoke, on: vi.fn(), off: vi.fn(), send: vi.fn() };
  return invoke;
}

/** Mirrors FirmwareCommunity's handleDownload / handleBurnClick. */
function harness() {
  const api: { download: (fw: Fw) => Promise<void>; burnTarget: (fw: Fw) => string | undefined } = {
    download: async () => {},
    burnTarget: () => undefined,
  };
  const Probe: React.FC = () => {
    const { tasks, startDownload } = useDownload();
    api.download = fw =>
      startDownload(firmwareCacheKey(fw), {
        url: fw.download_url,
        ossUrl: fw.oss_url,
        originalFilename: fw.filename,
        expectedMd5: fw.md5,
      });
    api.burnTarget = fw => tasks[firmwareCacheKey(fw)]?.file?.fileName;
    return null;
  };
  render(
    <DownloadProvider>
      <Probe />
    </DownloadProvider>
  );
  return api;
}

describe('download cache keying', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
      },
    });
    mockIpc();
  });

  it('gives each community firmware its own cache slot', () => {
    expect(firmwareCacheKey(FW_A)).not.toBe(firmwareCacheKey(FW_B));
  });

  it('does not offer firmware A when only firmware B was downloaded', async () => {
    const api = harness();

    await act(async () => {
      await api.download(FW_A);
    });

    expect(api.burnTarget(FW_A)).toBe(FW_A.filename);
    // The bug: B reported A's file as its own cached download.
    expect(api.burnTarget(FW_B)).toBeUndefined();
  });

  it('burns the firmware whose button was clicked when both are cached', async () => {
    const api = harness();

    await act(async () => {
      await api.download(FW_A);
      await api.download(FW_B);
    });

    expect(api.burnTarget(FW_A)).toBe(FW_A.filename);
    expect(api.burnTarget(FW_B)).toBe(FW_B.filename);
  });
});
