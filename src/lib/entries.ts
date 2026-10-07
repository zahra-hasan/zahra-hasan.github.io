import { getCollection } from 'astro:content';
import type { Entry, Kind } from './model';
import { tagSlug } from './paths';

// Sample content is for local preview only, and only until real content exists.
const showFixtures = import.meta.env.DEV || process.env.SHOW_FIXTURES === '1';

async function all(): Promise<Entry[]> {
  const items = await getCollection('entries');
  const real = items.filter((item) => item.id.startsWith('entries/'));
  const chosen = real.length === 0 && showFixtures ? items : real;
  return chosen
    .map((item) => item.data as Entry)
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export async function entriesOf(kind: Kind): Promise<Entry[]> {
  return (await all()).filter((e) => e.kind === kind);
}

export async function pageBySlug(slug: string): Promise<Entry | undefined> {
  return (await entriesOf('page')).find((e) => e.slug === slug);
}

/** Featured projects first, then the rest by date. */
export async function projectsForShowcase(): Promise<Entry[]> {
  const projects = await entriesOf('project');
  return [...projects.filter((p) => p.featured), ...projects.filter((p) => !p.featured)];
}

/** Tags used by posts/projects. Tags that differ only in case are merged. */
export async function tagsWithCounts(): Promise<{ tag: string; count: number }[]> {
  const counts = new Map<string, { tag: string; count: number }>();
  for (const e of await all()) {
    if (e.kind !== 'post' && e.kind !== 'project') continue;
    for (const tag of new Set(e.tags.map((t) => tagSlug(t)))) {
      const original = e.tags.find((t) => tagSlug(t) === tag)!;
      const current = counts.get(tag) ?? { tag: original, count: 0 };
      current.count++;
      counts.set(tag, current);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export async function withTag(tag: string): Promise<Entry[]> {
  const wanted = tagSlug(tag);
  return (await all()).filter((e) => (e.kind === 'post' || e.kind === 'project') && e.tags.some((t) => tagSlug(t) === wanted));
}

export function formatDate(iso: string, style: 'long' | 'short' = 'long'): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return date.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: style === 'long' ? 'numeric' : undefined,
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
  });
}

export function readingMinutes(entry: Entry): number {
  const words = JSON.stringify(entry.blocks).match(/"text":"([^"]*)"/g)?.join(' ').split(/\s+/).length ?? 0;
  return Math.max(1, Math.round(words / 220));
}
