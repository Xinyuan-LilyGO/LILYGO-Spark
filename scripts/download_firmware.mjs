#!/usr/bin/env node

/**
 * Batch download all firmware from firmware_manifest.json,
 * compute SHA256 hash, compress to ZIP (level 9), and generate JSON metadata.
 *
 * Usage: node scripts/download_firmware.mjs [--concurrency 10] [--output firmware_oss]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { createWriteStream, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';
import { createRequire } from 'node:module';

// --------------- Proxy support ---------------
const PROXY_URL = process.env.https_proxy || process.env.http_proxy || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
let proxyDispatcher = undefined;
if (PROXY_URL) {
  try {
    const { ProxyAgent } = await import('undici');
    proxyDispatcher = new ProxyAgent(PROXY_URL.replace(/^socks5:/, 'http:'));
    console.log(`🌐 Using proxy: ${PROXY_URL}`);
  } catch (e) {
    console.warn(`⚠ Proxy configured (${PROXY_URL}) but undici ProxyAgent unavailable: ${e.message}`);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// --------------- CLI args ---------------
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}
const CONCURRENCY = parseInt(getArg('concurrency', '10'), 10);
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, getArg('output', 'firmware_oss'));
const TEMP_DIR = path.resolve(OUTPUT_DIR, '.temp_downloads');
const MANIFEST_PATH = path.resolve(PROJECT_ROOT, 'firmware_manifest.json');
const CONFIG_PATH = path.resolve(PROJECT_ROOT, 'lilygo_config.json');
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 2000;
const HASH_PREFIX_LEN = 16;

// --------------- Load config ---------------
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
const OSS_FIRMWARE_PREFIX = (config.oss_domain_prefix || 'https://lilygo.oss-accelerate.aliyuncs.com') + '/firmware/';

// --------------- Extract unique URLs ---------------
function extractUrls(manifest) {
  const urlSet = new Set();

  // product_list -> products -> bin_files -> url
  if (manifest.product_list) {
    for (const series of manifest.product_list) {
      if (!series.products) continue;
      for (const product of series.products) {
        if (!product.bin_files) continue;
        for (const bin of product.bin_files) {
          if (bin.url) urlSet.add(bin.url);
        }
      }
    }
  }

  // firmware_list -> download_url
  if (manifest.firmware_list) {
    for (const fw of manifest.firmware_list) {
      if (fw.download_url) urlSet.add(fw.download_url);
    }
  }

  return [...urlSet];
}

// --------------- HTTP download with redirect following ---------------
async function downloadBuffer(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const fetchOpts = {
        redirect: 'follow',
        headers: { 'User-Agent': 'LILYGO-Spark-Firmware-Downloader/1.0' },
      };
      if (proxyDispatcher) fetchOpts.dispatcher = proxyDispatcher;
      const resp = await fetch(url, fetchOpts);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }
      const arrayBuf = await resp.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = RETRY_DELAY_BASE_MS * attempt;
      console.warn(`  ⚠ Attempt ${attempt} failed for ${path.basename(url)}: ${err.message}, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --------------- Hash computation ---------------
function computeHashes(buffer) {
  const md5 = crypto.createHash('md5').update(buffer).digest('hex');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  return { md5, sha256 };
}

// --------------- ZIP creation ---------------
async function createMaxZip(inputPath, entryName, outputPath) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(archive.pointer()));
    archive.on('error', reject);

    archive.pipe(output);
    archive.file(inputPath, { name: entryName });
    archive.finalize();
  });
}

// --------------- Unzip helper (for .zip source files) ---------------
async function unzipToDir(zipBuffer, destDir) {
  // Use Node.js built-in to write zip to temp, then use system unzip
  const tmpZipPath = path.join(destDir, '_temp_source.zip');
  fs.writeFileSync(tmpZipPath, zipBuffer);

  const { execSync } = await import('node:child_process');
  try {
    execSync(`unzip -o -q "${tmpZipPath}" -d "${destDir}"`, { stdio: 'pipe' });
  } catch (e) {
    throw new Error(`Failed to unzip: ${e.message}`);
  } finally {
    fs.rmSync(tmpZipPath, { force: true });
  }

  // Collect all files recursively
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
    }
  }
  walk(destDir);
  return files;
}

// --------------- Filename helpers ---------------
function urlToFilename(url) {
  const urlObj = new URL(url);
  return decodeURIComponent(path.basename(urlObj.pathname));
}

function makeOssFilename(sha256, originalName) {
  const prefix = sha256.slice(0, HASH_PREFIX_LEN);
  return `${prefix}_${originalName}.zip`;
}

function makeMetadataFilename(sha256, originalName) {
  const prefix = sha256.slice(0, HASH_PREFIX_LEN);
  return `${prefix}_${originalName}.json`;
}

// --------------- Process a single file ---------------
async function processFile(buffer, originalName, sourceUrl, outputDir) {
  const { md5, sha256 } = computeHashes(buffer);
  const ossFilename = makeOssFilename(sha256, originalName);
  const metaFilename = makeMetadataFilename(sha256, originalName);
  const zipPath = path.join(outputDir, ossFilename);
  const metaPath = path.join(outputDir, metaFilename);

  // Skip if both zip and json already exist
  if (fs.existsSync(zipPath) && fs.existsSync(metaPath)) {
    return { skipped: true, ossFilename, originalName };
  }

  // Write raw file to temp for archiver
  const tempRaw = path.join(TEMP_DIR, `${sha256.slice(0, 16)}_${originalName}`);
  fs.writeFileSync(tempRaw, buffer);

  // Create zip
  const compressedSize = await createMaxZip(tempRaw, originalName, zipPath);

  // Remove temp raw
  fs.rmSync(tempRaw, { force: true });

  // Write metadata JSON
  const metadata = {
    filename: ossFilename,
    originalFilename: originalName,
    originalSize: buffer.length,
    compressedSize,
    md5,
    sha256,
    sourceUrl,
    uploadedAt: new Date().toISOString(),
    downloadUrl: OSS_FIRMWARE_PREFIX + ossFilename,
    compression: 'zip',
  };
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + '\n');

  return { skipped: false, ossFilename, originalName, metadata };
}

// --------------- Process a URL ---------------
async function processUrl(url, index, total, outputDir) {
  const originalName = urlToFilename(url);
  const isZipSource = originalName.toLowerCase().endsWith('.zip');
  const label = `[${String(index + 1).padStart(String(total).length, ' ')}/${total}]`;

  try {
    console.log(`${label} Downloading ${originalName}...`);
    const buffer = await downloadBuffer(url);
    console.log(`${label} Downloaded ${originalName} (${(buffer.length / 1024).toFixed(1)} KB)`);

    if (isZipSource) {
      // Unzip and process each file inside
      const unzipDir = path.join(TEMP_DIR, `unzip_${crypto.randomBytes(4).toString('hex')}`);
      fs.mkdirSync(unzipDir, { recursive: true });
      const innerFiles = await unzipToDir(buffer, unzipDir);

      const results = [];
      for (const filePath of innerFiles) {
        const innerName = path.basename(filePath);
        const innerBuffer = fs.readFileSync(filePath);
        const result = await processFile(innerBuffer, innerName, url, outputDir);
        if (result.skipped) {
          console.log(`${label}   ⏭ Skipped (exists): ${result.ossFilename}`);
        } else {
          console.log(`${label}   ✓ Packed: ${result.ossFilename} (${(result.metadata.compressedSize / 1024).toFixed(1)} KB)`);
        }
        results.push(result);
      }

      // Cleanup
      fs.rmSync(unzipDir, { recursive: true, force: true });
      return { url, originalName, results, error: null };
    } else {
      const result = await processFile(buffer, originalName, url, outputDir);
      if (result.skipped) {
        console.log(`${label} ⏭ Skipped (exists): ${result.ossFilename}`);
      } else {
        console.log(`${label} ✓ Packed: ${result.ossFilename} (${(result.metadata.compressedSize / 1024).toFixed(1)} KB)`);
      }
      return { url, originalName, results: [result], error: null };
    }
  } catch (err) {
    console.error(`${label} ✗ FAILED: ${originalName} — ${err.message}`);
    return { url, originalName, results: [], error: err.message };
  }
}

// --------------- Concurrent pool ---------------
async function runPool(tasks, concurrency) {
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// --------------- Main ---------------
async function main() {
  console.log('=== LILYGO Firmware Batch Download & Compress ===\n');

  // Load manifest
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  const urls = extractUrls(manifest);
  console.log(`Found ${urls.length} unique firmware URLs in manifest.\n`);

  // Ensure output dirs
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  // Build tasks
  const tasks = urls.map((url, i) => () => processUrl(url, i, urls.length, OUTPUT_DIR));

  // Run with concurrency
  console.log(`Starting download with concurrency=${CONCURRENCY}...\n`);
  const startTime = Date.now();
  const results = await runPool(tasks, CONCURRENCY);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Cleanup temp
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });

  // Summary
  let totalFiles = 0;
  let skippedFiles = 0;
  let failedUrls = 0;
  let totalOriginalBytes = 0;
  let totalCompressedBytes = 0;

  for (const r of results) {
    if (r.error) {
      failedUrls++;
      continue;
    }
    for (const f of r.results) {
      totalFiles++;
      if (f.skipped) {
        skippedFiles++;
      } else if (f.metadata) {
        totalOriginalBytes += f.metadata.originalSize;
        totalCompressedBytes += f.metadata.compressedSize;
      }
    }
  }

  const newFiles = totalFiles - skippedFiles;
  console.log('\n=== Summary ===');
  console.log(`Total URLs:       ${urls.length}`);
  console.log(`Total files:      ${totalFiles} (from ${urls.length} URLs, some .zip contain multiple files)`);
  console.log(`New files:        ${newFiles}`);
  console.log(`Skipped (cached): ${skippedFiles}`);
  console.log(`Failed URLs:      ${failedUrls}`);
  if (newFiles > 0) {
    const ratio = ((1 - totalCompressedBytes / totalOriginalBytes) * 100).toFixed(1);
    console.log(`Compression:      ${(totalOriginalBytes / 1024 / 1024).toFixed(1)} MB → ${(totalCompressedBytes / 1024 / 1024).toFixed(1)} MB (${ratio}% saved)`);
  }
  console.log(`Time:             ${elapsed}s`);
  console.log(`Output:           ${OUTPUT_DIR}`);

  if (failedUrls > 0) {
    console.log('\n--- Failed URLs ---');
    for (const r of results) {
      if (r.error) console.log(`  ${r.url}  →  ${r.error}`);
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
