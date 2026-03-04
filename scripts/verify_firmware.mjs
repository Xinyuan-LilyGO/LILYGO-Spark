#!/usr/bin/env node

/**
 * Verify all firmware_oss/*.zip files:
 * - Unzip in memory
 * - Compute MD5 & SHA256 of the unzipped content
 * - Compare against the corresponding .json metadata
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OSS_DIR = path.resolve(PROJECT_ROOT, 'firmware_oss');
const TEMP_DIR = path.resolve(OSS_DIR, '.verify_temp');

const jsonFiles = fs.readdirSync(OSS_DIR).filter(f => f.endsWith('.json'));
console.log(`Found ${jsonFiles.length} JSON metadata files to verify.\n`);

let passed = 0;
let failed = 0;
let errors = [];

for (const jsonFile of jsonFiles) {
  const metaPath = path.join(OSS_DIR, jsonFile);
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  } catch (e) {
    errors.push({ file: jsonFile, error: `Failed to parse JSON: ${e.message}` });
    failed++;
    continue;
  }

  const zipPath = path.join(OSS_DIR, meta.filename);
  if (!fs.existsSync(zipPath)) {
    errors.push({ file: jsonFile, error: `ZIP file not found: ${meta.filename}` });
    failed++;
    continue;
  }

  // Unzip to temp dir, extract the original file
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  try {
    execSync(`unzip -o -q "${zipPath}" -d "${TEMP_DIR}"`, { stdio: 'pipe' });
  } catch (e) {
    errors.push({ file: jsonFile, error: `Unzip failed: ${e.message}` });
    failed++;
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    continue;
  }

  // Find the extracted file (should be meta.originalFilename)
  const extractedPath = path.join(TEMP_DIR, meta.originalFilename);
  if (!fs.existsSync(extractedPath)) {
    // Try to find any file
    const allFiles = fs.readdirSync(TEMP_DIR).filter(f => !f.startsWith('.'));
    if (allFiles.length === 0) {
      errors.push({ file: jsonFile, error: `No files extracted from ZIP` });
      failed++;
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
      continue;
    }
    // Use the first file found
    const actualFile = path.join(TEMP_DIR, allFiles[0]);
    const buffer = fs.readFileSync(actualFile);
    const md5 = crypto.createHash('md5').update(buffer).digest('hex');
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    if (md5 !== meta.md5 || sha256 !== meta.sha256) {
      errors.push({
        file: jsonFile,
        error: `Hash mismatch (extracted as ${allFiles[0]}): MD5 ${md5 === meta.md5 ? '✓' : `✗ got ${md5} expected ${meta.md5}`}, SHA256 ${sha256 === meta.sha256 ? '✓' : `✗ got ${sha256} expected ${meta.sha256}`}`
      });
      failed++;
    } else {
      passed++;
    }
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    continue;
  }

  const buffer = fs.readFileSync(extractedPath);
  const md5 = crypto.createHash('md5').update(buffer).digest('hex');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  const sizeMatch = buffer.length === meta.originalSize;
  const md5Match = md5 === meta.md5;
  const sha256Match = sha256 === meta.sha256;

  if (sizeMatch && md5Match && sha256Match) {
    passed++;
  } else {
    const parts = [];
    if (!sizeMatch) parts.push(`Size: got ${buffer.length}, expected ${meta.originalSize}`);
    if (!md5Match) parts.push(`MD5: got ${md5}, expected ${meta.md5}`);
    if (!sha256Match) parts.push(`SHA256: got ${sha256.slice(0,16)}..., expected ${meta.sha256.slice(0,16)}...`);
    errors.push({ file: jsonFile, error: parts.join('; ') });
    failed++;
  }

  fs.rmSync(TEMP_DIR, { recursive: true, force: true });

  if ((passed + failed) % 100 === 0) {
    console.log(`Progress: ${passed + failed}/${jsonFiles.length} checked (${passed} passed, ${failed} failed)`);
  }
}

// Cleanup
fs.rmSync(TEMP_DIR, { recursive: true, force: true });

console.log(`\n=== Verification Summary ===`);
console.log(`Total:  ${jsonFiles.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (errors.length > 0) {
  console.log(`\n--- Failures ---`);
  for (const e of errors) {
    console.log(`  ${e.file}: ${e.error}`);
  }
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} files verified successfully!`);
}
