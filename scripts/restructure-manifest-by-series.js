#!/usr/bin/env node
/**
 * Restructure firmware_manifest.json: group products by series (hierarchical)
 * - Series: id, name, description, image_url, products (array of products)
 * - Product in products: product_id, name, description, mcu, github_repo, product_page, image_url (no sku/variants)
 * Run: node scripts/restructure-manifest-by-series.js
 */
const fs = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(__dirname, '..', 'firmware_manifest.json');

// Series definition: id, name, description, product_ids (alphabetically sorted)
const SERIES = [
  { id: 't-beam-series', name: 'T-Beam Series', description: 'LoRa/GPS boards', productIds: ['t-beam', 't-beam-1w', 't-beam-bpf', 'helium-t-beam', 't-beam-meshtastic', 't-beam-softrf', 't-beam-shiled-v1-0', 't-beam-supreme', 't-beam-supreme-meshtastic'] },
  { id: 't-camera-series', name: 'T-Camera Series', description: 'Camera development boards', productIds: ['t-camera-plus-s3', 't-camera-s3'] },
  { id: 't-connect-series', name: 'T-Connect Series', description: 'Connect series', productIds: ['t-connect', 't-connect-pro'] },
  { id: 't-deck-series', name: 'T-Deck Series', description: 'Portable LoRaWAN devices with keyboard', productIds: ['t-deck', 't-deck-meshtastic', 't-deck-plus-1', 't-deck-plus-meshtastic', 't-deck-pro', 't-deck-pro-meshtastic'] },
  { id: 't-display-series', name: 'T-Display Series', description: 'Display development boards', productIds: ['t-display', 't-display-amoled-lite', 't-display-bar', 't-display-k230', 't-display-keyboard', 't-display-p4', 't-display-s3', 't-display-s3-amoled', 't-display-s3-amoled-1-64', 't-display-s3-amoled-plus', 't-display-s3-long', 't-display-s3-pro', 't-display-s3-pro-external', 't-display-s3-pro-lr1121'] },
  { id: 't-dongle-series', name: 'T-Dongle Series', description: 'U-dongle form factor', productIds: ['t-dongle-esp32-s2-1-14-inch-lcd-board', 't-dongle-c5', 't-dongle-s3'] },
  { id: 't-echo-series', name: 'T-Echo Series', description: 'LoRa walkie-talkie', productIds: ['t-echo-lilygo', 't-echo-lite', 't-echo-meshtastic', 't-echo-plus', 't-echo-softrf-firmware'] },
  { id: 't-embed-series', name: 'T-Embed Series', description: 'Embedded development boards', productIds: ['t-embed', 't-embed-cc1101', 't-embed-cc1101-plus', 't-embed-si4732'] },
  { id: 't-encoder-series', name: 'T-Encoder Series', description: 'Encoder boards', productIds: ['t-encoder-esp32', 't-encoder-pro'] },
  { id: 't-eth-series', name: 'T-ETH Series', description: 'Ethernet boards', productIds: ['t-eth-elite-1', 't-eth-lite'] },
  { id: 't-lora-series', name: 'T-Lora Series', description: 'LoRa modules', productIds: ['t-lora-c6', 't-lora-dual', 't-lora-pager', 't-lora-pager-meshtastic'] },
  { id: 't-relay-series', name: 'T-Relay Series', description: 'Relay boards', productIds: ['t-relay', 't-relay-5v-8-channel-relay', 't-relay-s3'] },
  { id: 't-sim-series', name: 'T-SIM / T-PCIE Series', description: 'Cellular modem boards', productIds: ['a-t-pcie', 't-sim-a7670e', 't-sim7600e', 't-sim7000g', 't-sim7070g', 't-sim7080-s3', 't-sim7600e-l1', 't-sim7600', 't-sim-7670g-s3', 't-simcam', 'lilygo--t-simhat-can-rs485-relay-5v'] },
  { id: 't-twr-series', name: 'T-TWR Series', description: 'Walkie-talkie boards', productIds: ['t-twr', 't-twr-plus', 't-twr-rev2-1'] },
  { id: 't-watch-series', name: 'T-Watch Series', description: 'Smartwatch boards', productIds: ['t-watch-2021', 't-watch-s3', 't-watch-s3-plus', 't-watch-ultra'] },
  { id: 't3-series', name: 'T3 (LoRa) Series', description: 'Classic LoRa development boards', productIds: ['lora3', 't3s3-v1-0', 'ts-s3-epaper', 't3-s3-lr1121', 't3-s3-meshtastic', 't3-s3-v1-3', 't3-s3-mvsr', 't3-stm32', 't3-tcxo'] },
  { id: 't4-series', name: 'T4 Series', description: 'T4 S3 display', productIds: ['t4-s3'] },
  { id: 't5-series', name: 'T5 Series', description: 'E-Paper boards', productIds: ['t5-4-7-inch-e-paper-v2-3', 't5-e-paper-s3-pro', 't5-v2-3-1', 't5-2-13inch-e-paper', 't5s-2-7inch-e-paper'] },
  { id: 't7-series', name: 'T7 Series', description: 'T7 development boards', productIds: ['t7-s3', 't7-v1-3-mini-32-esp32', 't7-c5', 't7-c6'] },
  { id: 't8-series', name: 'T8 Series', description: 'T8 boards', productIds: ['t8-c3'] },
  { id: 'other-t-series', name: 'Other T- Products', description: 'Other T-prefix products', productIds: ['t-0-99-inch-lcd', 't-01c3', 't-2can', 't-a7608e-h', 't-bao', 't-bat', 't-bhi260ap', 't-call-v1-4', 't-can485', 't-circle-s3', 't-energy-s3', 't-fpga', 't-glass', 't-higrow', 't-hmi', 't-icm-20948', 't-internet-com', 't-journal', 't-keyboard-s3-pro', 't-knob', 't-lion', 't-lite-w5500', 't-micro32-s3', 't-mini-epaper-s3', 't-panel-s3', 't-pico', 't-poe-pro', 't-qt-c6', 't-qt-pro', 't-radar', 't-rgb', 't-rs-s3', 't-touch-bar', 't-track', 't-tv', 't-vending', 't-weigh', 't-wrist-e-paper-1-54-inch-display', 't-zigbee-esp32-c3-tlsr8258'] },
  { id: 'other-products', name: 'Other Products', description: 'Non-T prefix products', productIds: ['esp32-oled-v3-0', 'esp32-s2', 'esp32-s2-woor', 'fs2112-speaker', 'lora-v1-3', 'lora-v1-0-kit', 'mini-e-paper-core', 'module17-revision-0-1e', 'to-esp8266-oled-sh1106', 'watch-keyboard-c3-v1-0'] },
];

function toProduct(p) {
  const img = p.image_url || `/devices/${p.product_id}.jpg`;
  return {
    product_id: p.product_id,
    name: p.name,
    description: p.description || '',
    mcu: p.mcu || '',
    github_repo: p.github_repo || '',
    product_page: p.product_page || '',
    image_url: img,
  };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const productMap = new Map();
  for (const p of manifest.product_list || []) {
    productMap.set(p.product_id, p);
  }

  const newProductList = [];
  const usedIds = new Set();

  for (const series of SERIES) {
    const products = [];
    for (const pid of series.productIds) {
      const p = productMap.get(pid);
      if (p) {
        products.push(toProduct(p));
        usedIds.add(pid);
      }
    }
    if (products.length === 0) continue;

    const firstImg = products[0]?.image_url || `/devices/${series.productIds[0]}.jpg`;
    newProductList.push({
      id: series.id,
      name: series.name,
      description: series.description,
      image_url: firstImg,
      products,
    });
  }

  // Check for any products in manifest not in any series
  for (const p of manifest.product_list || []) {
    if (!usedIds.has(p.product_id)) {
      console.warn(`Product not in any series: ${p.product_id} (${p.name})`);
    }
  }

  manifest.product_list = newProductList;
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`Restructured: ${newProductList.length} series, ${manifest.product_list.reduce((n, s) => n + (s.products?.length || 0), 0)} total products`);
}

main();
