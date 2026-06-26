#!/usr/bin/env node
/**
 * Generate firmware_manifest_v2.json (nested v2 schema) from the legacy flat
 * firmware_manifest.json (v1).
 *
 * Old desktop clients keep reading firmware_manifest.json; new clients read the
 * v2 file. Both are produced from the same source data via the shared, unit-
 * tested `convertV1ToV2`, so there is a single source of truth for the
 * transformation.
 *
 * Run: `npm run generate-v2-manifest` (executed via tsx so it works on the
 * CI Node version, which cannot run .ts files natively).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertV1ToV2 } from '../src/utils/manifestV2.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const V1_PATH = path.resolve(PROJECT_ROOT, 'firmware_manifest.json');
const V2_PATH = path.resolve(PROJECT_ROOT, 'firmware_manifest_v2.json');

function main(): void {
  if (!fs.existsSync(V1_PATH)) {
    console.error(`[v2] Source manifest not found: ${V1_PATH}`);
    process.exit(1);
  }

  const v1 = JSON.parse(fs.readFileSync(V1_PATH, 'utf-8'));
  const v2 = convertV1ToV2(v1);

  fs.writeFileSync(V2_PATH, JSON.stringify(v2, null, 2) + '\n', 'utf-8');

  const firmwareCount = v2.firmwares.length;
  const versionCount = v2.firmwares.reduce((sum, f) => sum + f.versions.length, 0);
  const multiVersion = v2.firmwares.filter(f => f.versions.length > 1).length;
  console.log(`[v2] Wrote ${path.basename(V2_PATH)}`);
  console.log(`[v2]   firmwares: ${firmwareCount} (with multiple versions: ${multiVersion})`);
  console.log(`[v2]   total versions (bins): ${versionCount}`);
  console.log(`[v2]   collections: ${v2.collections.length}`);
  console.log(`[v2]   products: ${v2.product_list.length}`);
}

main();
