import fs from "node:fs";
import path from "node:path";
import { Jimp } from "jimp";
import { NullumeError } from "../../core/errors.js";

const MAX_PIXELS = 40_000_000;
const DEFAULT_MAX_SIDE = 512;
const DEFAULT_QUALITY = 82;

export class IngestError extends NullumeError {
  code: string;

  constructor(code: string, message?: string) {
    super(message || code, 1);
    this.name = "IngestError";
    this.code = code;
  }
}

export interface PreviewResult {
  width: number;
  height: number;
}

/**
 * Create a JPEG preview from an image file
 * @param srcPath Source image path
 * @param destPath Destination JPEG path
 * @param maxSide Maximum side length (default 512)
 * @param quality JPEG quality 1-100 (default 82)
 * @returns Original image dimensions {width, height}
 * @throws IngestError('too-large') if width * height > MAX_PIXELS
 */
export async function makePreview(
  srcPath: string,
  destPath: string,
  maxSide: number = DEFAULT_MAX_SIDE,
  quality: number = DEFAULT_QUALITY
): Promise<PreviewResult> {
  const image = await Jimp.read(srcPath);
  const origWidth = image.width;
  const origHeight = image.height;

  // Check pixel limit
  if (origWidth * origHeight > MAX_PIXELS) {
    throw new IngestError("too-large", `Image too large: ${origWidth}×${origHeight}`);
  }

  // Compute scale factor to fit within maxSide
  const scale = Math.min(1, maxSide / Math.max(origWidth, origHeight));

  if (scale < 1) {
    const newWidth = Math.round(origWidth * scale);
    const newHeight = Math.round(origHeight * scale);
    image.resize({ w: newWidth, h: newHeight });
  }

  // Ensure destination directory exists
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true, mode: 0o700 });

  // Get JPEG buffer and write to file
  const buffer = await image.getBuffer("image/jpeg", { quality });
  await fs.promises.writeFile(destPath, buffer);

  return { width: origWidth, height: origHeight };
}
