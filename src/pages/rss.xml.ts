import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '../site.config';
import { entriesOf } from '../lib/entries';
import { entryPath } from '../lib/paths';

export async function GET(context: APIContext) {
  const posts = await entriesOf('post');
  return rss({
    title: `${site.name} — Writing`,
    description: site.description,
    site: context.site ?? site.url,
    items: posts.map((p) => ({
      title: p.title,
      description: p.summary,
      pubDate: new Date(p.date),
      link: entryPath(p),
      categories: p.tags,
    })),
  });
}
