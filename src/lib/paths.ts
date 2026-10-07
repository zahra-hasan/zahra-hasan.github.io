import type { EntryMeta } from './model';
import { slugify } from './slug';

/** Public URL path of an entry. Milestones have no page of their own. */
export function entryPath(entry: Pick<EntryMeta, 'kind' | 'slug'>): string {
  switch (entry.kind) {
    case 'post': return `/writing/${entry.slug}/`;
    case 'project': return `/projects/${entry.slug}/`;
    case 'page': return `/${entry.slug}/`;
    case 'milestone': return `/about/#journey`;
  }
}

/** URL-safe tag, keeping "C#" and "C++" distinct from "C". */
export function tagSlug(tag: string): string {
  return slugify(tag.replace(/#/g, ' sharp').replace(/\+/g, ' plus')) || 'tag';
}

export function tagPath(tag: string): string {
  return `/tags/${tagSlug(tag)}/`;
}
