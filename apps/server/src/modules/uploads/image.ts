import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';

/** Directory uploaded images are written to (mounted volume in production). */
export const IMAGES_DIR = process.env.IMAGES_DIR ?? path.resolve(process.cwd(), 'images');

// Ensure the upload directory exists (the prod volume mount does, but local /
// CI runs and first-boot may not) so disk writes never fail with ENOENT.
mkdirSync(IMAGES_DIR, { recursive: true });

/**
 * Allowed image types mapped to the extension we assign on disk. The stored
 * extension is derived from this map — never from the client-supplied filename —
 * so a file named `evil.html` can't be written as `.html` and later served as
 * text/html (stored XSS). `image/svg+xml` is intentionally excluded (SVGs can
 * carry script).
 */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, IMAGES_DIR),
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] ?? '.bin';
    cb(null, `${randomUUID()}${ext}`);
  },
});

/**
 * Multer middleware for single-image uploads. Rejects non-image types (by the
 * declared MIME type) and caps size at 8 MB. The stored path (relative URL
 * under /images) is persisted by the caller onto the owning entity.
 */
export const uploadImage = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, Object.prototype.hasOwnProperty.call(MIME_TO_EXT, file.mimetype));
  },
});

/** Public URL path for a stored image filename. */
export function imageUrl(filename: string): string {
  return `/images/${filename}`;
}

/** Cap on downloaded images, matching the upload limit. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Download a remote image into IMAGES_DIR and return its `/images/...` URL, so a
 * cover is self-hosted (same-origin, no external hotlink) rather than pointing at
 * a third-party CDN. The stored extension is derived from the response's
 * Content-Type via the same allowlist as uploads — never from the URL — and
 * non-image types, non-2xx responses, and oversized bodies are rejected. Callers
 * that want a hotlink fallback should `.catch()` and keep the original URL.
 */
export async function fetchAndStoreImage(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  const ext = MIME_TO_EXT[contentType];
  if (!ext) throw new Error(`Unsupported image type: ${contentType || 'unknown'}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Image exceeds size limit');
  const filename = `${randomUUID()}${ext}`;
  writeFileSync(path.join(IMAGES_DIR, filename), buffer);
  return imageUrl(filename);
}
