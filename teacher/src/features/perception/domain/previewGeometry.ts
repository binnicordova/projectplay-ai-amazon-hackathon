/**
 * Where camera space (the frames the model and the calibration see) appears on screen.
 *
 * The preview is shown with resizeMode "contain": the whole preview image is visible,
 * with bars on two sides. The preview and the frames are separate camera streams and may
 * not share an aspect ratio: Android (CameraX) shows a 4:3 preview by default, and a 16:9
 * frame stream is a centred crop of it. Overlays must be drawn on that crop, or every
 * box and corner drifts away from what it marks (bigger, and off-centre towards the edges).
 */
import type { Point2 } from './pose';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function containRect(viewWidth: number, viewHeight: number, imageAspect: number): Rect {
  if (viewWidth <= 0 || viewHeight <= 0 || imageAspect <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  const viewAspect = viewWidth / viewHeight;
  if (viewAspect > imageAspect) {
    const width = viewHeight * imageAspect;
    return { x: (viewWidth - width) / 2, y: 0, width, height: viewHeight };
  }
  const height = viewWidth / imageAspect;
  return { x: 0, y: (viewHeight - height) / 2, width: viewWidth, height };
}

/** Aspect ratio of the preview stream (CameraX default when no resolution is requested). */
export const PREVIEW_ASPECT = 4 / 3;

/**
 * The rectangle, in view pixels, showing the frames' field of view: the preview's
 * letterboxed image, narrowed to the centred crop the frame stream sees.
 */
export function frameRect(viewWidth: number, viewHeight: number, frameAspect: number, previewAspect = PREVIEW_ASPECT): Rect {
  const preview = containRect(viewWidth, viewHeight, previewAspect);
  if (preview.width <= 0 || frameAspect <= 0 || Math.abs(frameAspect - previewAspect) < 0.01) return preview;
  if (frameAspect > previewAspect) {
    // Wider frames: full width, top and bottom of the preview cropped away.
    const height = preview.width / frameAspect;
    return { x: preview.x, y: preview.y + (preview.height - height) / 2, width: preview.width, height };
  }
  // Narrower frames: full height, left and right cropped away.
  const width = preview.height * frameAspect;
  return { x: preview.x + (preview.width - width) / 2, y: preview.y, width, height: preview.height };
}

/** View pixels → camera space, or null if the tap landed outside what the frames see. */
export function viewToCamera(point: Point2, image: Rect): Point2 | null {
  if (image.width <= 0 || image.height <= 0) return null;
  const x = (point.x - image.x) / image.width;
  const y = (point.y - image.y) / image.height;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

export function cameraToView(point: Point2, image: Rect): Point2 {
  return { x: image.x + point.x * image.width, y: image.y + point.y * image.height };
}
