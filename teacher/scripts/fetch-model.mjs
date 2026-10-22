#!/usr/bin/env node
/**
 * Downloads MoveNet SinglePose Lightning INT8 (Apache-2.0, by Google) into assets/models.
 * Run once on a machine with internet; the model then ships inside the app (~3 MB).
 *
 *   npm run fetch-model
 *
 * If the download is blocked, fetch it manually from Kaggle Models:
 *   https://www.kaggle.com/models/google/movenet/tfLite/singlepose-lightning-tflite-int8
 * and save it as assets/models/movenet-singlepose-lightning-int8.tflite
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'models', 'movenet-singlepose-lightning-int8.tflite');
const sources = [
  'https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/int8/4?lite-format=tflite',
  'https://www.kaggle.com/api/v1/models/google/movenet/tfLite/singlepose-lightning-tflite-int8/1/download',
];

/** TFLite flatbuffers carry the "TFL3" identifier at byte offset 4. */
const isTflite = (bytes) => bytes.length > 1_000_000 && bytes.subarray(4, 8).toString('ascii') === 'TFL3';

/** Kaggle serves model downloads as .tar.gz: pull the first .tflite out of the archive. */
function extractTflite(bytes) {
  if (isTflite(bytes)) return bytes;
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return null;
  const tar = gunzipSync(bytes);
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const name = tar.subarray(offset, offset + 100).toString('utf8').replace(/\0.*$/s, '');
    if (!name) break;
    const size = parseInt(tar.subarray(offset + 124, offset + 136).toString('ascii').replace(/\0.*$/s, '').trim() || '0', 8);
    const body = tar.subarray(offset + 512, offset + 512 + size);
    if (name.endsWith('.tflite') && isTflite(body)) return Buffer.from(body);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return null;
}

async function alreadyPresent() {
  try {
    await stat(target);
    return isTflite(await readFile(target));
  } catch {
    return false;
  }
}

async function main() {
  if (await alreadyPresent()) {
    console.log(`✓ Model already present: ${target}`);
    return;
  }
  await mkdir(dirname(target), { recursive: true });
  for (const url of sources) {
    try {
      console.log(`↓ ${url}`);
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = extractTflite(Buffer.from(await response.arrayBuffer()));
      if (!bytes) throw new Error('response is neither a .tflite file nor a .tar.gz containing one');
      await writeFile(target, bytes);
      console.log(`✓ Saved ${(bytes.length / 1e6).toFixed(1)} MB to ${target}`);
      return;
    } catch (error) {
      console.warn(`  failed: ${error.message}`);
    }
  }
  console.error('✗ Could not download the model automatically. See the instructions at the top of this script.');
  process.exit(1);
}

await main();
