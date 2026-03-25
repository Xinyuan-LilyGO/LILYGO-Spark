#!/usr/bin/env node

/**
 * Update firmware_manifest.json with OSS metadata from firmware_oss/*.json files.
 * For each firmware entry, match by source URL and add oss_url, compressed_size, md5, sha256.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.resolve(PROJECT_ROOT, 'firmware_manifest.json');
const OSS_DIR = path.resolve(PROJECT_ROOT, 'firmware_oss');

// Build lookup: sourceUrl -> metadata (and originalFilename -> metadata for zip sources)
const metaBySourceUrl = new Map();
const metaByOriginalName = new Map();

const jsonFiles = fs.readdirSync(OSS_DIR).filter(f => f.endsWith('.json'));
console.log(`Loading ${jsonFiles.length} OSS metadata files...`);

for (const jf of jsonFiles) {
  const meta = JSON.parse(fs.readFileSync(path.join(OSS_DIR, jf), 'utf-8'));

  // Index by sourceUrl
  if (meta.sourceUrl) {
    if (!metaBySourceUrl.has(meta.sourceUrl)) {
      metaBySourceUrl.set(meta.sourceUrl, []);
    }
    metaBySourceUrl.get(meta.sourceUrl).push(meta);
  }

  // Index by originalFilename for zip-source lookups
  if (meta.originalFilename) {
    metaByOriginalName.set(meta.originalFilename, meta);
  }
}

console.log(`Indexed ${metaBySourceUrl.size} unique source URLs, ${metaByOriginalName.size} unique original filenames.`);

// Load manifest
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

let updatedFirmwares = 0;
let missedFirmwares = 0;

// Update firmware_list
if (manifest.firmware_list) {
  for (const fw of manifest.firmware_list) {
    if (!fw.download_url) continue;
    const metas = metaBySourceUrl.get(fw.download_url);
    if (metas && metas.length === 1) {
      const m = metas[0];
      fw.oss_url = m.downloadUrl;
      fw.compressed_size = m.compressedSize;
      if (!fw.size || fw.size === 0) fw.size = m.originalSize;
      fw.md5 = m.md5;
      fw.sha256 = m.sha256;
      updatedFirmwares++;
    } else if (metas && metas.length > 1) {
      const m = metas.find(x => x.originalFilename === fw.filename);
      if (m) {
        fw.oss_url = m.downloadUrl;
        fw.compressed_size = m.compressedSize;
        if (!fw.size || fw.size === 0) fw.size = m.originalSize;
        fw.md5 = m.md5;
        fw.sha256 = m.sha256;
        updatedFirmwares++;
      } else {
        missedFirmwares++;
      }
    } else {
      const m = metaByOriginalName.get(fw.filename);
      if (m) {
        fw.oss_url = m.downloadUrl;
        fw.compressed_size = m.compressedSize;
        if (!fw.size || fw.size === 0) fw.size = m.originalSize;
        fw.md5 = m.md5;
        fw.sha256 = m.sha256;
        updatedFirmwares++;
      } else {
        missedFirmwares++;
      }
    }
  }
}

// Write updated manifest
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

console.log('\n=== Update Summary ===');
console.log(`firmware_list updated: ${updatedFirmwares} (missed: ${missedFirmwares})`);
console.log(`Manifest written to: ${MANIFEST_PATH}`);
