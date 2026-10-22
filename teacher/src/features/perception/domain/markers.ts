/**
 * Finding the projected calibration markers in camera frames.
 *
 * Works on small greyscale (luma) frames. The trick is *differencing*: a frame of the
 * pattern minus a frame of plain black leaves only what the projector changed, so the
 * room (posters, windows, children standing still) cancels out. What remains are bright
 * blobs; their intensity-weighted centroids locate the markers to a fraction of a pixel.
 */
import { SOURCE_HEIGHT, SOURCE_WIDTH } from './moveNet';
import type { Point2 } from './pose';

/** Luma frames are the resizer buffer subsampled 3× (320 × 240): plenty for markers, cheap to move. */
export const LUMA_STEP = 3;
export const LUMA_WIDTH = SOURCE_WIDTH / LUMA_STEP;
export const LUMA_HEIGHT = SOURCE_HEIGHT / LUMA_STEP;
export const LUMA_BYTES = LUMA_WIDTH * LUMA_HEIGHT;

/** Brightness change (0..255) below which the camera is not really seeing the projection. */
export const MIN_CONTRAST = 25;
/** Smallest blob that can be a marker (pixels in the luma frame). */
const MIN_BLOB_AREA = 6;
/** The peak used for thresholding ignores the brightest pixels (sensor hot spots). */
const PEAK_FRACTION = 0.0005;
/** Pixels brighter than this share of the peak change belong to a marker. */
const THRESHOLD_SHARE = 0.4;

/** Greyscale from the SOURCE_WIDTH × SOURCE_HEIGHT RGB resizer buffer, one sample per 3×3 block. */
export function lumaFromRgb(rgb: Uint8Array, target: Uint8Array): void {
  'worklet';
  let t = 0;
  for (let y = 0; y < LUMA_HEIGHT; y++) {
    let s = y * LUMA_STEP * SOURCE_WIDTH * 3;
    for (let x = 0; x < LUMA_WIDTH; x++) {
      target[t++] = (rgb[s]! + 2 * rgb[s + 1]! + rgb[s + 2]!) >> 2;
      s += LUMA_STEP * 3;
    }
  }
}

/**
 * Packs a luma frame into a string to hand it from the camera thread to the JS thread.
 * Strings are the one value every worklet runtime copies reliably and fast. Each byte
 * becomes one character offset by 256, so there are no NUL or multi-byte surprises.
 */
export function encodeLuma(luma: Uint8Array): string {
  'worklet';
  const CHUNK = 2048;
  const codes = new Array<number>(CHUNK);
  let out = '';
  for (let i = 0; i < luma.length; i += CHUNK) {
    const n = Math.min(CHUNK, luma.length - i);
    codes.length = n;
    for (let k = 0; k < n; k++) codes[k] = luma[i + k]! + 256;
    out += String.fromCharCode.apply(null, codes);
  }
  return out;
}

export function decodeLuma(text: string): Uint8Array {
  const luma = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) luma[i] = text.charCodeAt(i) - 256;
  return luma;
}

/** Mean of several frames: averaging beats camera noise in a dark room. */
export class FrameAverager {
  private sum: Float32Array | null = null;
  private frames = 0;

  get count(): number {
    return this.frames;
  }

  add(frame: Uint8Array): void {
    if (!this.sum || this.sum.length !== frame.length) {
      this.sum = new Float32Array(frame.length);
      this.frames = 0;
    }
    const sum = this.sum;
    for (let i = 0; i < frame.length; i++) sum[i] = sum[i]! + frame[i]!;
    this.frames++;
  }

  mean(): Float32Array {
    const out = new Float32Array(this.sum?.length ?? 0);
    if (!this.sum || this.frames === 0) return out;
    for (let i = 0; i < out.length; i++) out[i] = this.sum[i]! / this.frames;
    return out;
  }
}

export interface Blob {
  /** Centroid in normalised camera space. */
  readonly center: Point2;
  /** Size in luma pixels. */
  readonly area: number;
}

export interface BlobSearch {
  /** Largest first. */
  readonly blobs: readonly Blob[];
  /** Brightness change of the brightest region (0..255): how well the camera sees the projection. */
  readonly contrast: number;
}

/** Bright regions that appear in `after` but not in `before` (same size frames). */
export function findBlobs(after: Float32Array, before: Float32Array, width: number, height: number): BlobSearch {
  const n = width * height;
  const diff = new Float32Array(n);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const d = after[i]! - before[i]!;
    const v = d > 0 ? d : 0;
    diff[i] = v;
    histogram[Math.min(255, v | 0)]!++;
  }

  let remaining = Math.max(1, Math.floor(n * PEAK_FRACTION));
  let contrast = 0;
  for (let v = 255; v >= 0; v--) {
    remaining -= histogram[v]!;
    if (remaining <= 0) {
      contrast = v;
      break;
    }
  }
  if (contrast < MIN_CONTRAST) return { blobs: [], contrast };

  const threshold = Math.max(MIN_CONTRAST * 0.6, contrast * THRESHOLD_SHARE);
  const visited = new Uint8Array(n);
  const stack = new Int32Array(n);
  const blobs: Blob[] = [];
  for (let start = 0; start < n; start++) {
    if (visited[start] || diff[start]! < threshold) continue;
    // Flood fill (4-connected) with an explicit stack: no recursion limits.
    let top = 0;
    stack[top++] = start;
    visited[start] = 1;
    let area = 0;
    let weight = 0;
    let sx = 0;
    let sy = 0;
    while (top > 0) {
      const i = stack[--top]!;
      const x = i % width;
      const y = (i - x) / width;
      const w = diff[i]!;
      area++;
      weight += w;
      sx += w * x;
      sy += w * y;
      const push = (j: number) => {
        if (!visited[j] && diff[j]! >= threshold) {
          visited[j] = 1;
          stack[top++] = j;
        }
      };
      if (x > 0) push(i - 1);
      if (x < width - 1) push(i + 1);
      if (y > 0) push(i - width);
      if (y < height - 1) push(i + width);
    }
    if (area >= MIN_BLOB_AREA) blobs.push({ center: { x: (sx / weight + 0.5) / width, y: (sy / weight + 0.5) / height }, area });
  }
  blobs.sort((a, b) => b.area - a.area);
  return { blobs, contrast };
}

/**
 * Orders four points clockwise on screen starting at the top-left (TL, TR, BR, BL).
 * Sorting by angle around the centroid keeps the cyclic order under any perspective.
 */
export function orderClockwise(points: readonly Point2[]): Point2[] {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  // Image y grows downwards, so increasing atan2 runs clockwise on screen.
  const sorted = [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let first = 0;
  sorted.forEach((p, i) => {
    if (p.x + p.y < sorted[first]!.x + sorted[first]!.y) first = i;
  });
  return [...sorted.slice(first), ...sorted.slice(0, first)];
}
