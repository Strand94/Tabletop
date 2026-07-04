import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// IMAGES_DIR is read at module load, so point it at a temp dir before importing.
const dir = mkdtempSync(path.join(tmpdir(), 'tabletop-img-'));
process.env.IMAGES_DIR = dir;

const { fetchAndStoreImage } = await import('../src/modules/uploads/image.js');

/** Minimal Response stand-in for the fields fetchAndStoreImage reads. */
function fakeResponse(opts: {
  ok?: boolean;
  status?: number;
  contentType?: string;
  bytes?: Buffer;
}): Response {
  const bytes = opts.bytes ?? Buffer.from('img-bytes');
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: new Headers(opts.contentType ? { 'content-type': opts.contentType } : {}),
    arrayBuffer: () =>
      Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  } as unknown as Response;
}

describe('fetchAndStoreImage', () => {
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('downloads and stores an allowed image, returning its /images URL', async () => {
    const url = await fetchAndStoreImage('https://cf.geekdo-images.com/x.jpg', () =>
      Promise.resolve(fakeResponse({ contentType: 'image/jpeg' })),
    );
    expect(url).toMatch(/^\/images\/[0-9a-f-]+\.jpg$/);
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
  });

  it('derives the extension from the response content-type, not the URL', async () => {
    const url = await fetchAndStoreImage('https://cf.geekdo-images.com/pic.jpg', () =>
      Promise.resolve(fakeResponse({ contentType: 'image/png' })),
    );
    expect(url).toMatch(/\.png$/);
  });

  it('rejects a non-image content-type', async () => {
    await expect(
      fetchAndStoreImage('https://evil/x', () =>
        Promise.resolve(fakeResponse({ contentType: 'text/html' })),
      ),
    ).rejects.toThrow();
  });

  it('rejects a non-ok response', async () => {
    await expect(
      fetchAndStoreImage('https://cf.geekdo-images.com/missing.jpg', () =>
        Promise.resolve(fakeResponse({ ok: false, status: 404 })),
      ),
    ).rejects.toThrow();
  });

  it('rejects an image over the size cap', async () => {
    await expect(
      fetchAndStoreImage('https://cf.geekdo-images.com/huge.jpg', () =>
        Promise.resolve(
          fakeResponse({ contentType: 'image/jpeg', bytes: Buffer.alloc(9 * 1024 * 1024) }),
        ),
      ),
    ).rejects.toThrow();
  });
});
