import { describe, it, expect } from 'vitest';
import { formatPortPath, hexToHumanSize } from './formatters';

describe('formatPortPath', () => {
  it('should return empty string for empty input', () => {
    expect(formatPortPath('')).toBe('');
  });

  it('should return COM port as is', () => {
    expect(formatPortPath('COM1')).toBe('COM1');
    expect(formatPortPath('com12')).toBe('com12');
  });

  it('should return path starting with / as is', () => {
    expect(formatPortPath('/dev/ttyUSB0')).toBe('/dev/ttyUSB0');
  });

  it('should prepend /dev/ for other paths', () => {
    expect(formatPortPath('ttyUSB0')).toBe('/dev/ttyUSB0');
    expect(formatPortPath('cu.usbmodem123')).toBe('/dev/cu.usbmodem123');
  });
});

describe('hexToHumanSize', () => {
  it('should return empty string for invalid input', () => {
    expect(hexToHumanSize('')).toBe('');
    expect(hexToHumanSize('invalid')).toBe('');
    expect(hexToHumanSize('0')).toBe(''); // implementation returns empty for <= 0
  });

  it('should format bytes', () => {
    expect(hexToHumanSize('0x100')).toBe('256 B');
    expect(hexToHumanSize('0x3FF')).toBe('1023 B');
  });

  it('should format KB', () => {
    expect(hexToHumanSize('0x400')).toBe('1 KB'); // 1024
    expect(hexToHumanSize('0x800')).toBe('2 KB'); // 2048
  });

  it('should format MB', () => {
    expect(hexToHumanSize('0x100000')).toBe('1.0 MB'); // 1024*1024
    expect(hexToHumanSize('0x400000')).toBe('4.0 MB'); // 4MB
    expect(hexToHumanSize('0x1000000')).toBe('16.0 MB'); // 16MB
  });
});
