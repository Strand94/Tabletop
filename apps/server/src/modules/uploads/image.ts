import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';

/** Directory uploaded images are written to (mounted volume in production). */
export const IMAGES_DIR = process.env.IMAGES_DIR ?? path.resolve(process.cwd(), 'images');

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, IMAGES_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.img';
    cb(null, `${randomUUID()}${ext}`);
  },
});

/**
 * Multer middleware for single-image uploads. Rejects non-image types and caps
 * size at 8 MB. The stored path (relative URL under /images) is persisted by the
 * caller onto the owning entity.
 */
export const uploadImage = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED.has(file.mimetype));
  },
});

/** Public URL path for a stored image filename. */
export function imageUrl(filename: string): string {
  return `/images/${filename}`;
}
