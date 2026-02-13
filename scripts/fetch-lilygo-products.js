#!/usr/bin/env node
/**
 * Fetch LILYGO product list from lilygo.cc (Shopify), download images, update firmware_manifest.json
 * Run: node scripts/fetch-lilygo-products.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const BASE_URL = 'https://lilygo.cc/collections/all/products.json';
const PAGES = 8;
const CONCURRENCY = 20; // 并发下载数
const MANIFEST_PATH = path.join(__dirname, '..', 'firmware_manifest.json');
const DEVICES_DIR = path.join(__dirname, '..', 'public', 'devices');

// Known product metadata (handle -> github_repo, mcu) - preserve from existing manifest
const KNOWN_META = {
  't-deck': { mcu: 'ESP32-S3', github_repo: 'https://github.com/Xinyuan-LilyGO/T-Deck' },
  't-deck-pro': { mcu: 'ESP32-S3', github_repo: 'https://github.com/Xinyuan-LilyGO/T-Deck-Pro' },
  't-beam': { mcu: 'ESP32', github_repo: 'https://github.com/LilyGO/TTGO-T-Beam' },
  't-beam-supreme': { mcu: 'ESP32-S3', github_repo: 'https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series' },
  'lora3': { mcu: 'ESP32', github_repo: 'https://github.com/Xinyuan-LilyGO/TTGO-LoRa-Series' },
  't3s3-v1-0': { mcu: 'ESP32-S3', github_repo: 'https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series' },
  'ts-s3-epaper': { mcu: 'ESP32-S3', github_repo: 'https://github.com/Xinyuan-LilyGO/Lilygo-LoRa-Epaper-series' },
  't-watch-s3': { mcu: 'ESP32-S3', github_repo: 'https://github.com/Xinyuan-LilyGO/TTGO_TWatch_Library' },
  't-lora-pager': { mcu: 'ESP32-S3', github_repo: 'https://github.com/Xinyuan-LilyGO/LilyGoLib' },
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'LILYGO-Spark/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const protocol = u.protocol === 'https:' ? https : require('http');
    const file = fs.createWriteStream(destPath);
    protocol.get(url, { headers: { 'User-Agent': 'LILYGO-Spark/1.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function fetchAllProducts() {
  const all = [];
  for (let p = 1; p <= PAGES; p++) {
    const url = `${BASE_URL}?limit=50&page=${p}`;
    const json = await fetchJson(url);
    const count = json.products?.length ?? 0;
    console.log(`  Page ${p}/${PAGES}: ${count} products`);
    if (!json.products || count === 0) break;
    all.push(...json.products);
  }
  console.log(`  Total: ${all.length} products from ${all.length ? Math.ceil(all.length / 50) : 0} pages`);
  return all;
}

function toProductId(handle) {
  return handle.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

function getImageExt(url) {
  if (!url) return '.jpg';
  const m = url.match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i);
  return m ? '.' + m[1].toLowerCase().replace('jpeg', 'jpg') : '.jpg';
}

/** 并发执行任务，每批 CONCURRENCY 个 */
async function runConcurrent(tasks, fn, onBatchDone) {
  const results = [];
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
    if (onBatchDone) onBatchDone(i + batch.length, tasks.length);
  }
  return results;
}

async function buildProductList(products) {
  if (!fs.existsSync(DEVICES_DIR)) {
    fs.mkdirSync(DEVICES_DIR, { recursive: true });
  }

  const seen = new Set();
  const items = [];
  for (const p of products) {
    if (seen.has(p.handle)) continue;
    seen.add(p.handle);

    const productId = toProductId(p.handle);
    const meta = KNOWN_META[p.handle] || {};
    const imgSrc = p.images && p.images[0] ? p.images[0].src : null;

    const sku = p.variants?.[0]?.sku;
    const productType = p.product_type || '';
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const desc = productType || p.title;

    items.push({
      productId,
      name: p.title,
      handle: p.handle,
      desc: desc.trim() || p.title,
      meta,
      imgSrc,
      sku,
      product_type: productType,
      tags,
      variants: p.variants?.length > 1 ? p.variants.map((v) => ({
        title: v.title,
        sku: v.sku,
        available: v.available,
      })) : undefined,
    });
  }

  // 收集需要下载的任务
  const downloadTasks = items.filter((x) => x.imgSrc).map((x) => ({
    ...x,
    ext: getImageExt(x.imgSrc),
    localName: `${x.productId}${getImageExt(x.imgSrc)}`,
    destPath: path.join(DEVICES_DIR, `${x.productId}${getImageExt(x.imgSrc)}`),
  }));

  const total = downloadTasks.length;
  const startTime = Date.now();
  let completed = 0;

  console.log(`[1/3] 准备下载 ${total} 张图片，并发数 ${CONCURRENCY}...`);

  const downloadResults = await runConcurrent(
    downloadTasks,
    async (task) => {
      if (fs.existsSync(task.destPath)) {
        return { productId: task.productId, localName: task.localName, ok: true, skipped: true };
      }
      try {
        await downloadImage(task.imgSrc, task.destPath);
        completed++;
        return { productId: task.productId, localName: task.localName, ok: true };
      } catch (e) {
        console.warn(`  ✗ ${task.productId}: ${e.message}`);
        return { productId: task.productId, localName: null, ok: false, err: e.message };
      }
    },
    (done, total) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  [${done}/${total}] 批次完成 (${elapsed}s)`);
    }
  );

  const okResults = downloadResults.filter((r) => r.status === 'fulfilled' && r.value?.ok);
  const skippedCount = okResults.filter((r) => r.value?.skipped).length;
  const downloadedCount = okResults.filter((r) => !r.value?.skipped).length;
  const failCount = downloadResults.length - okResults.length;
  console.log(`[2/3] 下载完成: ${downloadedCount} 新下载, ${skippedCount} 已存在, ${failCount} 失败 (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);

  const resultMap = new Map();
  downloadResults.forEach((r) => {
    if (r.status === 'fulfilled' && r.value?.localName) {
      resultMap.set(r.value.productId, `/devices/${r.value.localName}`);
    }
  });

  const list = items.map((x) => {
    const o = {
      product_id: x.productId,
      name: x.name,
      description: x.desc,
      mcu: x.meta.mcu || '',
      github_repo: x.meta.github_repo || '',
      product_page: `https://lilygo.cc/products/${x.handle}`,
      image_url: resultMap.get(x.productId) || x.imgSrc || '',
      product_type: x.product_type || '',
      tags: x.tags || [],
    };
    if (x.sku) o.sku = x.sku;
    if (x.variants?.length) o.variants = x.variants;
    return o;
  });

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const products = await fetchAllProducts();
  console.log(`Fetched ${products.length} products`);

  console.log('Downloading product images...');
  const productList = await buildProductList(products);
  console.log(`Downloaded images to ${DEVICES_DIR}`);

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  manifest.product_list = productList;
  // Keep firmware_list unchanged
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`Updated ${MANIFEST_PATH} with ${productList.length} products`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
