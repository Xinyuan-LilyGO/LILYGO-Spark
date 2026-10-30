import { describe, it, expect } from 'vitest';
import { convertV1ToV2 } from './manifestV2';
import { flattenV2 } from './manifestV2View';
import { extractedImagePath, isSf32Firmware, isSf32Mcu, sftoolWriteCommand, type Sf32PackageInfo } from './sf32';

const pkg: Sf32PackageInfo = {
  layout: 'cairn',
  installer: true,
  images: [
    { role: 'ftab', path: 'Cairn/firmware/ftab.bin', addr: '0x12000000', size: 11288, sha256: 'a'.repeat(64) },
    { role: 'bootloader', path: 'Cairn/firmware/bootloader.bin', addr: '0x12010000', size: 58616, sha256: 'b'.repeat(64) },
    { role: 'main', path: 'Cairn/firmware/main.bin', addr: '0x12020000', size: 2287024, sha256: 'c'.repeat(64) },
  ],
};

describe('SF32 packages in the manifest', () => {
  it('carry chip and sf32_package from v1 through v2 to the flat UI record', () => {
    const v2 = convertV1ToV2({
      product_list: [],
      firmware_list: [{
        supported_product_ids: ['t-display-sf32'],
        name: 'Cairn',
        version: '',
        type: 'third_party',
        filename: 'MeshCore-TDisplaySF32-Cairn125-2026-10-29-install.zip',
        description: '',
        sha256: 'd'.repeat(64),
        chip: 'SF32LB52',
        sf32_package: pkg,
      }],
    });
    const [flat] = flattenV2(v2);
    expect(flat.chip).toBe('SF32LB52');
    expect(flat.sf32_package).toEqual(pkg);
    expect(isSf32Firmware(flat)).toBe(true);
  });

  it('leave ESP32 firmware untouched', () => {
    const v2 = convertV1ToV2({
      product_list: [],
      firmware_list: [{ supported_product_ids: ['t-deck'], name: 'Bruce', version: 'v1', type: 'community', filename: 'bruce.bin', description: '' }],
    });
    const [flat] = flattenV2(v2);
    expect(flat.chip).toBeUndefined();
    expect(isSf32Firmware(flat)).toBe(false);
  });
});

describe('isSf32Mcu', () => {
  it('matches SF32 parts only', () => {
    expect(isSf32Mcu('SF32LB52')).toBe(true);
    expect(isSf32Mcu(' sf32lb52 ')).toBe(true);
    expect(isSf32Mcu('ESP32-S3')).toBe(false);
    expect(isSf32Mcu(undefined)).toBe(false);
  });
});

describe('sftoolWriteCommand', () => {
  it('writes every image at its address, from the folder the zip was unwrapped into', () => {
    expect(sftoolWriteCommand(pkg, { path: '/Users/me/Cairn', strip: 'Cairn', sep: '/' }, 'COM5')).toBe(
      'sftool -c SF32LB52 -p COM5 write_flash "/Users/me/Cairn/firmware/ftab.bin@0x12000000" '
      + '"/Users/me/Cairn/firmware/bootloader.bin@0x12010000" "/Users/me/Cairn/firmware/main.bin@0x12020000"'
    );
  });

  it('keeps zip paths when nothing was unwrapped, with Windows separators', () => {
    expect(extractedImagePath({ path: 'C:\\fw\\pkg', strip: null, sep: '\\' }, 'Cairn/firmware/main.bin'))
      .toBe('C:\\fw\\pkg\\Cairn\\firmware\\main.bin');
  });
});
