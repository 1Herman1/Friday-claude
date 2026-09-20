import path from "node:path";

export function resultExtension(url: string, contentType: string | undefined, category: string): string {
  const allowedExts: Record<string, string> = {
    image: "png",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    video: "mp4",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    audio: "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/mp4": "m4a",
  };

  // Try content-type first
  if (contentType && allowedExts[contentType]) {
    return `.${allowedExts[contentType]}`;
  }

  // Try category
  if (allowedExts[category]) {
    return `.${allowedExts[category]}`;
  }

  // Try URL pathname
  const urlPath = new URL(url).pathname;
  const ext = path.extname(urlPath).toLowerCase();
  if (ext && allowedExts[ext.slice(1)]) {
    return ext;
  }

  // Default to binary
  return ".bin";
}
