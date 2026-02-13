#!/usr/bin/env node
/**
 * Filter firmware_manifest.json: keep only flashable ESP32 products, remove price
 * Run: node scripts/filter-flashable-products.js
 */
const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, '..', 'firmware_manifest.json');

// MCU patterns that indicate flashable firmware (ESP32 series, ESP8266, STM32 for some boards)
const FLASHABLE_MCU = /^(ESP32|ESP32-S3|ESP32-C3|ESP32-C6|ESP32-S2|ESP8266|STM32)/i;

// product_id patterns that are pure accessories (cannot flash firmware)
const ACCESSORY_PATTERNS = [
  /cable$/i, /antenna$/i, /shell$/i, /strap$/i, /case$/i, /lens$/i,
  /accessories$/i, /block$/i, /seat$/i, /card$/i, /gift/i,
  /0-96-inch-oled$/i,  // small OLED accessory
  /display-accessories/i, /dupont-cable/i, /expansion-cable/i,
  /gsm-gprs-antenna/i, /gift-card/i, /grove-interface-cable/i,
  /4pin-cable/i, /regular-fisheye-lens/i, /sma-antenna/i,
  /t-deck-accessories/i, /t-beam-accessories/i, /t-display-case/i,
  /t-display-tf-shied/i, /t-display-s3-shell/i, /t-echo-accessories/i,
  /t-embed-shell/i, /t-encoder-shield/i, /t-u2t/i,
  /t-watch-2020-transparent-silicone-strap/i, /t-watch-2020-strap/i,
  /terminal-block/i, /usb-a-sd-tf-card-seat/i,
  /t-micro32-plus/i, /t-micro32-v2-0/i, /t-thruster/i,
  /t-encoder-shield-v1-0/i,  // shield only, not main board
  /fabgl-vga32/i,      // FabGL VGA - different architecture
  /t-relay-w5500-shield/i,  // shield only
];

// Tags that indicate flashable development board
const FLASHABLE_TAGS = [
  'Basic Module', 'LCD / OLED', 'LoRa or GPS Series', 'e-Paper',
  'Wearable Kit', 'T-SIM / T-PCIE Series', 'Meshtastic', 'T-Camera Series',
];

function isAccessory(productId, name, tags, productType) {
  if (ACCESSORY_PATTERNS.some(p => p.test(productId))) return true;
  const tagsStr = (tags || []).join(' ');
  const nameLower = (name || '').toLowerCase();
  if (tagsStr === 'Accessories' && (
    nameLower.includes('cable') || nameLower.includes('antenna') ||
    nameLower.includes('shell') || nameLower.includes('strap') ||
    nameLower.includes('case') || nameLower.includes('lens') ||
    nameLower.includes('gift') || nameLower.includes('block')
  )) return true;
  if (productType === 'Accessories' && (
    nameLower.includes('cable') || nameLower.includes('antenna') ||
    nameLower.includes('shell') || nameLower.includes('strap')
  )) return true;
  return false;
}

function isFlashable(product, supportedProductIds) {
  const { product_id, name, mcu, github_repo, tags, product_type } = product;

  if (supportedProductIds.has(product_id)) return true;
  if (mcu && FLASHABLE_MCU.test(mcu)) return true;
  if (github_repo) return true;  // has firmware repo usually means flashable

  const hasFlashableTag = (tags || []).some(t => FLASHABLE_TAGS.includes(t));
  if (hasFlashableTag && product_type && product_type !== 'Accessories') return true;

  return false;
}

function stripPrice(obj) {
  const out = { ...obj };
  delete out.price;
  if (out.variants && Array.isArray(out.variants)) {
    out.variants = out.variants.map(v => {
      const vv = { ...v };
      delete vv.price;
      return vv;
    });
  }
  return out;
}

function cleanDescription(desc) {
  if (!desc || typeof desc !== 'string') return desc || '';
  return desc.replace(/\s*\.?\s*From\s+\$[\d.]+$/i, '').replace(/\s*\.\s*$/i, '').trim() || desc;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const supportedProductIds = new Set();
  for (const fw of manifest.firmware_list || []) {
    for (const id of fw.supported_product_ids || []) {
      supportedProductIds.add(id);
    }
  }

  const original = manifest.product_list || [];
  const filtered = original.filter(p => {
    if (isAccessory(p.product_id, p.name, p.tags, p.product_type)) return false;
    return isFlashable(p, supportedProductIds);
  });

  const cleaned = filtered.map(p => {
    const stripped = stripPrice(p);
    stripped.description = cleanDescription(stripped.description);
    return stripped;
  });

  manifest.product_list = cleaned;
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`Filtered: ${original.length} -> ${cleaned.length} products (removed ${original.length - cleaned.length} non-flashable)`);
  console.log(`Removed price from all products`);
}

main();
