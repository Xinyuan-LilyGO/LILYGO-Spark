export const PARTITION_TYPES: Record<number, string> = {
  0x00: 'app',
  0x01: 'data',
};

export const PARTITION_SUBTYPES: Record<number, Record<number, string>> = {
  // APP_TYPE (0x00)
  0x00: {
    0x00: 'factory',
    0x20: 'test',
    0x10: 'ota_0', 0x11: 'ota_1', 0x12: 'ota_2', 0x13: 'ota_3',
    0x14: 'ota_4', 0x15: 'ota_5', 0x16: 'ota_6', 0x17: 'ota_7',
    0x18: 'ota_8', 0x19: 'ota_9', 0x1A: 'ota_10', 0x1B: 'ota_11',
    0x1C: 'ota_12', 0x1D: 'ota_13', 0x1E: 'ota_14', 0x1F: 'ota_15',
  },
  // DATA_TYPE (0x01)
  0x01: {
    0x00: 'ota',
    0x01: 'phy',
    0x02: 'nvs',
    0x03: 'coredump',
    0x04: 'nvs_keys',
    0x05: 'efuse',
    0x06: 'undefined',
    0x80: 'esphttpd',
    0x81: 'fat',
    0x82: 'spiffs',
  }
};

export function getPartitionTypeLabel(type: number): string {
  return PARTITION_TYPES[type] || `0x${type.toString(16)}`;
}

export function getPartitionSubtypeLabel(type: number, subtype: number): string {
  const subtypes = PARTITION_SUBTYPES[type];
  if (subtypes && subtypes[subtype]) {
    return subtypes[subtype];
  }
  return `0x${subtype.toString(16)}`;
}
