// Downloads images/files referenced by Notion pages into public/media.
//
// Notion-hosted file URLs are signed and expire after an hour, so they can't be
// linked to directly. Files are named by a hash of their URL (minus the
// signature), so re-running the sync re-uses what's already on disk.

import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const MAX_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1600;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'image/svg+xml': '.svg', 'image/avif': '.avif',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
  'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/mp4': '.m4a',
  'application/pdf': '.pdf', 'application/zip': '.zip',
};

/** Raster images we re-encode to resized WebP. GIFs keep their animation. */
const OPTIMIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

function stableKey(url: string): string {
  const u = new URL(url);
  const isNotionFile = u.hostname.endsWith('amazonaws.com') || u.hostname.endsWith('notion-static.com') ||
    u.hostname.endsWith('notionusercontent.com');
  // Signed Notion URLs change on every request; the path identifies the file.
  return isNotionFile ? `${u.origin}${u.pathname}` : u.toString();
}

export class MediaStore {
  private existing = new Map<string, string>(); // hash → filename
  private used = new Set<string>();
  private pending = new Map<string, Promise<string | null>>();

  constructor(private dir: string, private publicPrefix: string, private warn: (m: string) => void) {}

  async init(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    for (const name of await readdir(this.dir)) {
      if (name.startsWith('.')) continue;
      this.existing.set(name.replace(/\.[^.]+$/, ''), name);
    }
  }

  asset = (url: string): Promise<string | null> => {
    let key: string;
    try {
      key = stableKey(url);
    } catch {
      this.warn(`Skipped invalid media URL: ${url}`);
      return Promise.resolve(null);
    }
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 20);
    let job = this.pending.get(hash);
    if (!job) {
      job = this.fetch(url, hash);
      this.pending.set(hash, job);
    }
    return job;
  };

  private async fetch(url: string, hash: string): Promise<string | null> {
    const cached = this.existing.get(hash);
    if (cached) {
      this.used.add(cached);
      return `${this.publicPrefix}/${cached}`;
    }

    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      const length = Number(res.headers.get('content-length') ?? 0);
      if (length > MAX_BYTES) throw new Error(`file is larger than ${MAX_BYTES / 1024 / 1024} MB`);
      let body: Buffer = Buffer.from(await res.arrayBuffer());
      if (body.byteLength > MAX_BYTES) throw new Error(`file is larger than ${MAX_BYTES / 1024 / 1024} MB`);

      let ext = EXTENSIONS[type] ?? path.extname(new URL(url).pathname).toLowerCase();
      if (!ext || !/^\.[a-z0-9]{1,5}$/.test(ext)) ext = '.bin';

      if (OPTIMIZABLE.has(type)) {
        body = await sharp(body)
          .rotate()
          .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        ext = '.webp';
      }

      const name = `${hash}${ext}`;
      await writeFile(path.join(this.dir, name), body);
      this.existing.set(hash, name);
      this.used.add(name);
      return `${this.publicPrefix}/${name}`;
    } catch (error) {
      this.warn(`Couldn't download ${url.split('?')[0]}: ${(error as Error).message}`);
      return null;
    }
  }

  /** Deletes media no longer referenced by any published page. */
  async prune(): Promise<string[]> {
    const removed: string[] = [];
    for (const name of this.existing.values()) {
      if (!this.used.has(name)) {
        await rm(path.join(this.dir, name));
        removed.push(name);
      }
    }
    return removed;
  }
}
