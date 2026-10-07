// Pulls every page marked Status = "Published" from your Notion database and
// writes it into the repo:
//
//   content/entries/*.json   what the website renders
//   content/markdown/**.md   a readable Markdown backup of every entry
//   public/media/*           images and files, downloaded and optimised
//
// Unpublishing or deleting a page in Notion removes it on the next sync.
//
// Usage: npm run sync   (needs NOTION_TOKEN and NOTION_DATABASE_ID, see README)

import { Client, collectPaginatedAPI, isFullBlock, isFullPage, APIErrorCode, isNotionClientError } from '@notionhq/client';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Entry } from '../src/lib/model.ts';
import { entryPath } from '../src/lib/paths.ts';
import { convertBlocks, convertMeta, coverUrl, isPublished, normalizeId, pageTitle, type NotionNode } from './notion/convert.ts';
import { toMarkdown } from './notion/markdown.ts';
import { MediaStore } from './notion/media.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRIES_DIR = path.join(root, 'content/entries');
const MARKDOWN_DIR = path.join(root, 'content/markdown');
const MEDIA_DIR = path.join(root, 'public/media');

try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  // no .env file — fine in CI, where secrets come from the environment
}

const token = process.env.NOTION_TOKEN?.trim();
const databaseId = process.env.NOTION_DATABASE_ID?.trim();

if (!token || !databaseId) {
  console.log('ℹ NOTION_TOKEN / NOTION_DATABASE_ID not set — skipping Notion sync and keeping existing content.');
  process.exit(0);
}

const warnings: string[] = [];
const warn = (message: string) => {
  warnings.push(message);
  console.warn(`  ⚠ ${message}`);
};

const notion = new Client({ auth: token });

async function fetchChildren(blockId: string): Promise<NotionNode[]> {
  const results = await collectPaginatedAPI(notion.blocks.children.list, { block_id: blockId });
  const nodes: NotionNode[] = [];
  for (const block of results) {
    if (!isFullBlock(block)) continue;
    const node: NotionNode = block;
    // Child pages/databases are separate documents; never pull them in.
    if (block.has_children && block.type !== 'child_page' && block.type !== 'child_database') {
      node.children = await fetchChildren(block.id);
    }
    nodes.push(node);
  }
  return nodes;
}

async function resolveDataSourceId(id: string): Promise<string> {
  try {
    const db = await notion.databases.retrieve({ database_id: id });
    if ('data_sources' in db && db.data_sources.length) return db.data_sources[0].id;
  } catch (error) {
    if (!isNotionClientError(error) || error.code !== APIErrorCode.ObjectNotFound) throw error;
  }
  // Maybe the id is already a data source id.
  try {
    await notion.dataSources.retrieve({ data_source_id: id });
    return id;
  } catch {
    throw new Error(
      `Couldn't open Notion database ${id}. Check NOTION_DATABASE_ID, and that the database is ` +
      `shared with your integration (••• menu → Connections → add your integration).`,
    );
  }
}

async function main() {
  console.log('→ Reading Notion database…');
  const dataSourceId = await resolveDataSourceId(databaseId!);
  const rows = await collectPaginatedAPI(notion.dataSources.query, { data_source_id: dataSourceId });
  const pages = rows.filter(isFullPage).filter((page) => !page.in_trash);
  const published = pages.filter(isPublished);
  console.log(`  ${published.length} published of ${pages.length} pages`);

  // Work out every page's URL first so links between pages resolve.
  const metas = new Map<string, ReturnType<typeof convertMeta>>();
  const taken = new Set<string>();
  const pageLinks = new Map<string, string>();
  for (const page of published) {
    const meta = convertMeta(page);
    let key = `${meta.kind}/${meta.slug}`;
    if (taken.has(key)) {
      warn(`Two ${meta.kind}s share the slug "${meta.slug}" — "${pageTitle(page)}" gets a suffix. Set a unique Slug in Notion.`);
      meta.slug = `${meta.slug}-${normalizeId(page.id).slice(0, 6)}`;
      key = `${meta.kind}/${meta.slug}`;
    }
    taken.add(key);
    metas.set(page.id, meta);
    pageLinks.set(normalizeId(page.id), entryPath(meta));
  }

  const media = new MediaStore(MEDIA_DIR, '/media', warn);
  await media.init();

  const entries: Entry[] = [];
  for (const page of published) {
    const meta = metas.get(page.id)!;
    console.log(`→ ${meta.kind}: ${meta.title}`);
    const ctx = { asset: media.asset, pageLinks, warn: (m: string) => warn(`[${meta.title}] ${m}`) };
    const blocks = meta.kind === 'milestone' ? [] : await convertBlocks(await fetchChildren(page.id), ctx);
    const coverSource = coverUrl(page);
    const cover = coverSource ? await media.asset(coverSource) : null;
    entries.push({ ...meta, ...(cover && { cover }), blocks });
  }

  // Everything fetched successfully — now replace the old content in one go.
  await rm(ENTRIES_DIR, { recursive: true, force: true });
  await rm(MARKDOWN_DIR, { recursive: true, force: true });
  await mkdir(ENTRIES_DIR, { recursive: true });
  for (const entry of entries) {
    const file = `${entry.kind}-${entry.slug}`;
    await writeFile(path.join(ENTRIES_DIR, `${file}.json`), JSON.stringify(entry, null, 2) + '\n');
    if (entry.kind !== 'milestone') {
      const dir = path.join(MARKDOWN_DIR, `${entry.kind}s`);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${entry.slug}.md`), toMarkdown(entry));
    }
  }
  const removed = await media.prune();

  console.log(`✓ Synced ${entries.length} entries${removed.length ? `, removed ${removed.length} unused media files` : ''}.`);
  if (warnings.length) console.log(`  ${warnings.length} warning(s) — see above.`);
  if (process.env.GITHUB_STEP_SUMMARY && warnings.length) {
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `### Notion sync warnings\n\n${warnings.map((w) => `- ${w}`).join('\n')}\n`, { flag: 'a' });
  }
  // Keep the directory present for Astro even when nothing is published.
  if (!(await readdir(ENTRIES_DIR)).length) await writeFile(path.join(ENTRIES_DIR, '.gitkeep'), '');
}

main().catch((error) => {
  console.error(`✗ Notion sync failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
