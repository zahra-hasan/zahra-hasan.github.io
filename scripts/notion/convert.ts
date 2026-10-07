// Converts Notion API objects into the site's content model (src/lib/model.ts).
//
// Pure apart from the `assets` callback, which the sync script uses to download
// Notion-hosted files (their URLs expire after an hour) into public/media.

import type {
  BlockObjectResponse,
  PageObjectResponse,
  RichTextItemResponse,
} from '@notionhq/client';
import type { Block, EntryMeta, Kind, ListItem, RichText, TextColor } from '../../src/lib/model.ts';
import { safeHref, toEmbed } from '../../src/lib/safe-url.ts';
import { slugify } from '../../src/lib/slug.ts';

/** A Notion block with its children already fetched. */
export type NotionNode = BlockObjectResponse & { children?: NotionNode[] };

export interface ConvertContext {
  /**
   * Downloads a Notion file/external URL and returns the public path to use
   * instead, or null if it couldn't be fetched (the block is then skipped).
   */
  asset(url: string): Promise<string | null>;
  /** Notion page id (no dashes) → site path, for pages that are published. */
  pageLinks: Map<string, string>;
  warn(message: string): void;
}

const COLORS: readonly TextColor[] = [
  'default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red',
];

export function normalizeId(id: string): string {
  return id.replace(/-/g, '').toLowerCase();
}

function parseColor(raw: string | undefined): { color?: TextColor; highlight?: boolean } {
  if (!raw || raw === 'default') return {};
  const highlight = raw.endsWith('_background');
  const base = raw.replace(/_background$/, '') as TextColor;
  if (!COLORS.includes(base)) return {};
  return highlight ? { color: base, highlight } : { color: base };
}

/** Rewrites links to other Notion pages to their site path, or drops them. */
function resolveLink(raw: string | null | undefined, ctx: ConvertContext): string | undefined {
  if (!raw) return undefined;
  const notionId = raw.match(/([0-9a-f]{32})(?:[?#].*)?$/i)?.[1] ??
    raw.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1];
  if (notionId && (raw.startsWith('/') || raw.includes('notion.'))) {
    return ctx.pageLinks.get(normalizeId(notionId));
  }
  return safeHref(raw);
}

export function convertRichText(items: RichTextItemResponse[], ctx: ConvertContext): RichText[] {
  const out: RichText[] = [];
  for (const item of items) {
    const a = item.annotations;
    const span: RichText = { text: item.plain_text };
    let href: string | undefined;

    if (item.type === 'mention' && item.mention.type === 'page') {
      href = ctx.pageLinks.get(normalizeId(item.mention.page.id));
    } else if (item.type === 'mention' && item.mention.type === 'link_preview') {
      href = safeHref(item.mention.link_preview.url);
    } else if (item.type === 'mention' && item.mention.type === 'user') {
      // Don't publish workspace member names by accident.
      continue;
    } else {
      href = resolveLink(item.href, ctx);
    }

    if (href) span.href = href;
    if (a.bold) span.bold = true;
    if (a.italic) span.italic = true;
    if (a.strikethrough) span.strike = true;
    if (a.underline) span.underline = true;
    if (a.code || item.type === 'equation') span.code = true;
    Object.assign(span, parseColor(a.color));
    if (span.text) out.push(span);
  }
  return out;
}

export function plainText(text: RichText[]): string {
  return text.map((t) => t.text).join('');
}

const LANGUAGE_ALIASES: Record<string, string> = {
  'plain text': 'text',
  'c++': 'cpp',
  'c#': 'csharp',
  'f#': 'fsharp',
  'objective-c': 'objc',
  'vb.net': 'vb',
  shell: 'bash',
  'java/c/c++/c#': 'java',
  markup: 'html',
  'webassembly': 'wasm',
};

export function normalizeLanguage(lang: string): string {
  const lower = lang.toLowerCase();
  return LANGUAGE_ALIASES[lower] ?? lower;
}

function fileUrl(media: { type: 'external'; external: { url: string } } | { type: 'file'; file: { url: string } } | { type: string }): string | undefined {
  if (media.type === 'external' && 'external' in media) return media.external.url;
  if (media.type === 'file' && 'file' in media) return media.file.url;
  return undefined;
}

function captionOf(caption: RichTextItemResponse[], ctx: ConvertContext): RichText[] | undefined {
  const text = convertRichText(caption, ctx);
  return text.length ? text : undefined;
}

type ListType = 'bulleted_list' | 'numbered_list' | 'todo_list';

/** Converts sibling blocks, grouping consecutive list items into one list. */
export async function convertBlocks(nodes: NotionNode[], ctx: ConvertContext, anchors = new Set<string>()): Promise<Block[]> {
  const out: Block[] = [];
  for (const node of nodes) {
    const listType: ListType | null =
      node.type === 'bulleted_list_item' ? 'bulleted_list'
      : node.type === 'numbered_list_item' ? 'numbered_list'
      : node.type === 'to_do' ? 'todo_list'
      : null;

    if (listType) {
      const item = await convertListItem(node, ctx, anchors);
      const last = out[out.length - 1];
      if (last && last.type === listType) last.items.push(item);
      else out.push({ type: listType, items: [item] } as Block);
      continue;
    }

    const converted = await convertBlock(node, ctx, anchors);
    out.push(...converted);
  }
  return out;
}

async function convertListItem(node: NotionNode, ctx: ConvertContext, anchors: Set<string>): Promise<ListItem> {
  const children = await convertBlocks(node.children ?? [], ctx, anchors);
  if (node.type === 'bulleted_list_item') return { text: convertRichText(node.bulleted_list_item.rich_text, ctx), children };
  if (node.type === 'numbered_list_item') return { text: convertRichText(node.numbered_list_item.rich_text, ctx), children };
  if (node.type === 'to_do') return { text: convertRichText(node.to_do.rich_text, ctx), checked: node.to_do.checked, children };
  throw new Error(`not a list item: ${node.type}`);
}

function uniqueAnchor(text: string, anchors: Set<string>): string {
  const base = slugify(text) || 'section';
  let anchor = base;
  for (let i = 2; anchors.has(anchor); i++) anchor = `${base}-${i}`;
  anchors.add(anchor);
  return anchor;
}

async function convertBlock(node: NotionNode, ctx: ConvertContext, anchors: Set<string>): Promise<Block[]> {
  const kids = async () => {
    const blocks = await convertBlocks(node.children ?? [], ctx, anchors);
    return blocks.length ? blocks : undefined;
  };

  switch (node.type) {
    case 'paragraph': {
      const text = convertRichText(node.paragraph.rich_text, ctx);
      const children = await kids();
      if (!text.length && !children) return [];
      return [{ type: 'paragraph', text, ...(children && { children }) }];
    }

    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
    case 'heading_4': {
      // The page title is the <h1>, so Notion's H1 becomes <h2> and so on.
      const data =
        node.type === 'heading_1' ? node.heading_1
        : node.type === 'heading_2' ? node.heading_2
        : node.type === 'heading_3' ? node.heading_3
        : node.heading_4;
      const level = node.type === 'heading_1' ? 2 : node.type === 'heading_2' ? 3 : 4;
      const text = convertRichText(data.rich_text, ctx);
      if (!text.length) return [];
      const children = await kids();
      return [{ type: 'heading', level, text, anchor: uniqueAnchor(plainText(text), anchors), ...(children && { children }) }];
    }

    case 'quote': {
      const children = await kids();
      return [{ type: 'quote', text: convertRichText(node.quote.rich_text, ctx), ...(children && { children }) }];
    }

    case 'callout': {
      const icon = node.callout.icon?.type === 'emoji' ? node.callout.icon.emoji : undefined;
      const children = await kids();
      return [{
        type: 'callout',
        ...(icon && { icon }),
        color: parseColor(node.callout.color).color ?? 'gray',
        text: convertRichText(node.callout.rich_text, ctx),
        ...(children && { children }),
      }];
    }

    case 'toggle':
      return [{
        type: 'toggle',
        summary: convertRichText(node.toggle.rich_text, ctx),
        children: (await kids()) ?? [],
      }];

    case 'code': {
      const caption = captionOf(node.code.caption, ctx);
      return [{
        type: 'code',
        language: normalizeLanguage(node.code.language),
        code: node.code.rich_text.map((t) => t.plain_text).join(''),
        ...(caption && { caption }),
      }];
    }

    case 'divider':
      return [{ type: 'divider' }];

    case 'equation':
      return [{ type: 'equation', expression: node.equation.expression }];

    case 'table_of_contents':
      return [{ type: 'toc' }];

    case 'image': {
      const url = fileUrl(node.image);
      if (!url) return [];
      const src = await ctx.asset(url);
      if (!src) return [];
      const caption = captionOf(node.image.caption, ctx);
      return [{ type: 'image', src, ...(caption && { caption }) }];
    }

    case 'video': {
      const caption = captionOf(node.video.caption, ctx);
      if (node.video.type === 'file') {
        const src = await ctx.asset(node.video.file.url);
        return src ? [{ type: 'video', src, ...(caption && { caption }) }] : [];
      }
      const url = fileUrl(node.video);
      if (!url) return [];
      const embed = toEmbed(url);
      if (embed) return [{ type: 'embed', ...embed, ...(caption && { caption }) }];
      const href = safeHref(url);
      return href ? [{ type: 'bookmark', url: href, ...(caption && { caption }) }] : [];
    }

    case 'embed': {
      const caption = captionOf(node.embed.caption, ctx);
      const embed = toEmbed(node.embed.url);
      if (embed) return [{ type: 'embed', ...embed, ...(caption && { caption }) }];
      const href = safeHref(node.embed.url);
      if (!href) {
        ctx.warn(`Skipped embed that isn't a public link: ${node.embed.url}`);
        return [];
      }
      return [{ type: 'bookmark', url: href, ...(caption && { caption }) }];
    }

    case 'bookmark':
    case 'link_preview': {
      const url = node.type === 'bookmark' ? node.bookmark.url : node.link_preview.url;
      const caption = node.type === 'bookmark' ? captionOf(node.bookmark.caption, ctx) : undefined;
      const href = safeHref(url);
      return href ? [{ type: 'bookmark', url: href, ...(caption && { caption }) }] : [];
    }

    case 'pdf':
    case 'file':
    case 'audio': {
      const data = node.type === 'pdf' ? node.pdf : node.type === 'file' ? node.file : node.audio;
      const url = fileUrl(data);
      if (!url) return [];
      const name = ('name' in data && typeof data.name === 'string' && data.name) ||
        decodeURIComponent(new URL(url).pathname.split('/').pop() ?? 'file');
      const src = await ctx.asset(url);
      if (!src) return [];
      const caption = captionOf(data.caption, ctx);
      return [{ type: 'file', src, name, ...(caption && { caption }) }];
    }

    case 'table': {
      const rows = (node.children ?? [])
        .filter((row): row is NotionNode & { type: 'table_row' } => row.type === 'table_row')
        .map((row) => row.table_row.cells.map((cell) => convertRichText(cell, ctx)));
      return [{
        type: 'table',
        columnHeader: node.table.has_column_header,
        rowHeader: node.table.has_row_header,
        rows,
      }];
    }

    case 'column_list': {
      const columns: Block[][] = [];
      for (const column of node.children ?? []) {
        columns.push(await convertBlocks(column.children ?? [], ctx, anchors));
      }
      return [{ type: 'columns', columns: columns.filter((c) => c.length) }];
    }

    case 'link_to_page': {
      const id = node.link_to_page.type === 'page_id' ? node.link_to_page.page_id : undefined;
      const href = id ? ctx.pageLinks.get(normalizeId(id)) : undefined;
      return href ? [{ type: 'bookmark', url: href }] : [];
    }

    // Containers whose children are the real content.
    case 'synced_block':
    case 'tab':
    case 'column':
      return convertBlocks(node.children ?? [], ctx, anchors);

    // Private or structural blocks that don't belong on a public page.
    case 'child_page':
    case 'child_database':
    case 'breadcrumb':
    case 'template':
    case 'meeting_notes':
    case 'transcription':
    case 'table_row':
      return [];

    default:
      ctx.warn(`Skipped unsupported Notion block type "${node.type}"`);
      return [];
  }
}

// ---------------------------------------------------------------------------
// Page properties
// ---------------------------------------------------------------------------

type Property = PageObjectResponse['properties'][string];

function findProperty(page: PageObjectResponse, name: string): Property | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(page.properties)) {
    if (key.trim().toLowerCase() === wanted) return value;
  }
  return undefined;
}

function propText(prop: Property | undefined): string {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title.map((t) => t.plain_text).join('').trim();
  if (prop.type === 'rich_text') return prop.rich_text.map((t) => t.plain_text).join('').trim();
  if (prop.type === 'select') return prop.select?.name ?? '';
  if (prop.type === 'status') return prop.status?.name ?? '';
  if (prop.type === 'url') return prop.url ?? '';
  return '';
}

export function pageTitle(page: PageObjectResponse): string {
  const title = Object.values(page.properties).find((p) => p.type === 'title');
  return propText(title) || 'Untitled';
}

export function isPublished(page: PageObjectResponse): boolean {
  return propText(findProperty(page, 'Status')).toLowerCase() === 'published';
}

const KINDS: Record<string, Kind> = {
  post: 'post', writing: 'post', blog: 'post',
  project: 'project',
  page: 'page',
  milestone: 'milestone',
};

/** Reads the page's properties. Cover image is resolved separately (needs download). */
export function convertMeta(page: PageObjectResponse): Omit<EntryMeta, 'cover'> {
  const title = pageTitle(page);
  const kind = KINDS[propText(findProperty(page, 'Type')).toLowerCase()] ?? 'post';
  const slug = slugify(propText(findProperty(page, 'Slug')) || title) || normalizeId(page.id).slice(0, 8);

  const dateProp = findProperty(page, 'Date');
  const date = (dateProp?.type === 'date' && dateProp.date?.start) || page.created_time;

  const tagsProp = findProperty(page, 'Tags');
  const tags = tagsProp?.type === 'multi_select' ? tagsProp.multi_select.map((t) => t.name) : [];

  const featuredProp = findProperty(page, 'Featured');
  const featured = featuredProp?.type === 'checkbox' ? featuredProp.checkbox : false;

  const repoUrl = safeHref(propText(findProperty(page, 'Repo')));
  const liveUrl = safeHref(propText(findProperty(page, 'Live')));
  const icon = page.icon?.type === 'emoji' ? page.icon.emoji : undefined;

  return {
    kind,
    slug,
    title,
    summary: propText(findProperty(page, 'Summary')),
    date: date.slice(0, 10),
    updated: page.last_edited_time,
    tags,
    featured,
    ...(icon && { icon }),
    ...(repoUrl && { repoUrl }),
    ...(liveUrl && { liveUrl }),
  };
}

export function coverUrl(page: PageObjectResponse): string | undefined {
  return page.cover ? fileUrl(page.cover) : undefined;
}
