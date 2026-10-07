import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// content/entries  — written by `npm run sync` from Notion (what goes live)
// content/fixtures — sample content, shown only in local preview until Notion is connected
const entries = defineCollection({
  loader: glob({
    pattern: ['entries/*.json', 'fixtures/*.json'],
    base: './content',
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  }),
  schema: z.object({
    kind: z.enum(['post', 'project', 'page', 'milestone']),
    slug: z.string(),
    title: z.string(),
    summary: z.string(),
    date: z.string(),
    updated: z.string(),
    tags: z.array(z.string()),
    featured: z.boolean(),
    cover: z.string().optional(),
    icon: z.string().optional(),
    repoUrl: z.string().optional(),
    liveUrl: z.string().optional(),
    // Shape is guaranteed by the sync script's types; see src/lib/model.ts.
    blocks: z.array(z.any()),
  }),
});

export const collections = { entries };
