import { describe, it, expect } from 'vitest';
import { getPartitionTypeLabel, getPartitionSubtypeLabel } from './partitionTypes';

describe('partitionTypes', () => {
  describe('getPartitionTypeLabel', () => {
    it('should return label for known types', () => {
      expect(getPartitionTypeLabel(0x00)).toBe('app');
      expect(getPartitionTypeLabel(0x01)).toBe('data');
    });

    it('should return hex string for unknown types', () => {
      expect(getPartitionTypeLabel(0x40)).toBe('0x40');
      expect(getPartitionTypeLabel(0xFF)).toBe('0xff');
    });
  });

  describe('getPartitionSubtypeLabel', () => {
    it('should return label for known app subtypes', () => {
      expect(getPartitionSubtypeLabel(0x00, 0x00)).toBe('factory');
      expect(getPartitionSubtypeLabel(0x00, 0x10)).toBe('ota_0');
      expect(getPartitionSubtypeLabel(0x00, 0x20)).toBe('test');
    });

    it('should return label for known data subtypes', () => {
      expect(getPartitionSubtypeLabel(0x01, 0x00)).toBe('ota');
      expect(getPartitionSubtypeLabel(0x01, 0x02)).toBe('nvs');
      expect(getPartitionSubtypeLabel(0x01, 0x82)).toBe('spiffs');
    });

    it('should return hex string for unknown subtypes', () => {
      expect(getPartitionSubtypeLabel(0x00, 0x99)).toBe('0x99');
      expect(getPartitionSubtypeLabel(0x01, 0xFF)).toBe('0xff');
    });

    it('should return hex string for unknown types', () => {
      expect(getPartitionSubtypeLabel(0x99, 0x00)).toBe('0x0');
    });
  });
});
