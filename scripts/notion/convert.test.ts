import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertBlocks, convertMeta, convertRichText, isPublished, type ConvertContext, type NotionNode } from './convert.ts';
import { safeHref, toEmbed } from '../../src/lib/safe-url.ts';
import { toMarkdown } from './markdown.ts';

const annotations = { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' };

function rt(content: string, extra: Partial<typeof annotations> = {}, href: string | null = null) {
  return { type: 'text', text: { content, link: href ? { url: href } : null }, plain_text: content, href, annotations: { ...annotations, ...extra } } as any;
}

function block(type: string, data: object, children?: NotionNode[]): NotionNode {
  return { object: 'block', id: Math.random().toString(16).slice(2), type, [type]: data, has_children: !!children, children } as any;
}

function ctx(overrides: Partial<ConvertContext> = {}): ConvertContext & { warnings: string[] } {
  const warnings: string[] = [];
  return {
    asset: async (url) => `/media/${url.split('/').pop()}`,
    pageLinks: new Map(),
    warn: (m) => warnings.push(m),
    warnings,
    ...overrides,
  };
}

test('safeHref only allows web, mail and relative links', () => {
  assert.equal(safeHref('https://example.com/a'), 'https://example.com/a');
  assert.equal(safeHref('mailto:me@example.com'), 'mailto:me@example.com');
  assert.equal(safeHref('/writing/x/'), '/writing/x/');
  assert.equal(safeHref('javascript:alert(1)'), undefined);
  assert.equal(safeHref('JAVASCRIPT:alert(1)'), undefined);
  assert.equal(safeHref('data:text/html,<script>'), undefined);
  assert.equal(safeHref('//evil.com'), undefined);
  assert.equal(safeHref('https://www.notion.so/private-abc'), undefined);
  assert.equal(safeHref('https://me.notion.site/page'), undefined);
});

test('toEmbed allowlists providers and rewrites to privacy-friendly players', () => {
  assert.deepEqual(toEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), {
    provider: 'youtube', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  });
  assert.deepEqual(toEmbed('https://youtu.be/dQw4w9WgXcQ'), {
    provider: 'youtube', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  });
  assert.equal(toEmbed('https://www.youtube.com/watch?v="><script>')?.src, undefined);
  assert.equal(toEmbed('https://evil.example/embed'), null);
  assert.equal(toEmbed('http://www.youtube.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(toEmbed('https://vimeo.com/123456789')?.src, 'https://player.vimeo.com/video/123456789?dnt=1');
});

test('rich text keeps formatting and strips unsafe links', () => {
  const out = convertRichText([
    rt('bold', { bold: true }),
    rt('link', {}, 'https://example.com'),
    rt('bad', {}, 'javascript:alert(1)'),
    rt('hi', { color: 'blue_background' }),
  ], ctx());
  assert.deepEqual(out, [
    { text: 'bold', bold: true },
    { text: 'link', href: 'https://example.com/' },
    { text: 'bad' },
    { text: 'hi', color: 'blue', highlight: true },
  ]);
});

test('links to other Notion pages become site links, or are dropped if unpublished', () => {
  const id = 'a'.repeat(32);
  const c = ctx({ pageLinks: new Map([[id, '/writing/other/']]) });
  const out = convertRichText([
    rt('published', {}, `/${id}`),
    rt('private', {}, `https://www.notion.so/Secret-${'b'.repeat(32)}`),
  ], c);
  assert.deepEqual(out, [{ text: 'published', href: '/writing/other/' }, { text: 'private' }]);
});

test('user mentions are never published', () => {
  const mention = { type: 'mention', mention: { type: 'user', user: { id: 'u' } }, plain_text: '@Someone', href: null, annotations };
  assert.deepEqual(convertRichText([mention as any], ctx()), []);
});

test('consecutive list items are grouped into one list with nested children', async () => {
  const blocks = await convertBlocks([
    block('bulleted_list_item', { rich_text: [rt('one')] }),
    block('bulleted_list_item', { rich_text: [rt('two')] }, [block('paragraph', { rich_text: [rt('nested')] })]),
    block('paragraph', { rich_text: [rt('between')] }),
    block('numbered_list_item', { rich_text: [rt('first')] }),
  ], ctx());
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, 'bulleted_list');
  assert.equal(blocks[0].type === 'bulleted_list' && blocks[0].items.length, 2);
  assert.equal(blocks[0].type === 'bulleted_list' && blocks[0].items[1].children[0].type, 'paragraph');
  assert.equal(blocks[2].type, 'numbered_list');
});

test('headings shift down a level and get unique anchors', async () => {
  const blocks = await convertBlocks([
    block('heading_1', { rich_text: [rt('Intro')] }),
    block('heading_2', { rich_text: [rt('Intro')] }),
  ], ctx());
  assert.deepEqual(blocks.map((b) => b.type === 'heading' && [b.level, b.anchor]), [[2, 'intro'], [3, 'intro-2']]);
});

test('tables, embeds and private blocks', async () => {
  const c = ctx();
  const blocks = await convertBlocks([
    block('table', { has_column_header: true, has_row_header: false, table_width: 2 }, [
      block('table_row', { cells: [[rt('a')], [rt('b')]] }),
    ]),
    block('embed', { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', caption: [] }),
    block('embed', { url: 'https://random.example/widget', caption: [] }),
    block('child_page', { title: 'Private notes' }),
    block('image', { type: 'file', file: { url: 'https://s3.amazonaws.com/x/pic.png?sig=1' }, caption: [] }),
  ], c);
  assert.deepEqual(blocks.map((b) => b.type), ['table', 'embed', 'bookmark', 'image']);
  assert.equal(blocks[3].type === 'image' && blocks[3].src, '/media/pic.png?sig=1');
});

test('media that fails to download is skipped', async () => {
  const blocks = await convertBlocks([
    block('image', { type: 'external', external: { url: 'https://example.com/a.png' }, caption: [] }),
  ], ctx({ asset: async () => null }));
  assert.deepEqual(blocks, []);
});

test('page properties', () => {
  const page = {
    id: '1234abcd-0000-0000-0000-000000000000',
    created_time: '2026-01-02T10:00:00.000Z',
    last_edited_time: '2026-01-03T10:00:00.000Z',
    icon: null,
    cover: null,
    properties: {
      Name: { type: 'title', title: [rt('My First Month as an FDE!')] },
      status: { type: 'select', select: { name: 'Published' } },
      Type: { type: 'select', select: { name: 'Project' } },
      Tags: { type: 'multi_select', multi_select: [{ name: 'Python' }] },
      Repo: { type: 'url', url: 'javascript:alert(1)' },
    },
  } as any;
  assert.equal(isPublished(page), true);
  const meta = convertMeta(page);
  assert.equal(meta.kind, 'project');
  assert.equal(meta.slug, 'my-first-month-as-an-fde');
  assert.equal(meta.date, '2026-01-02');
  assert.deepEqual(meta.tags, ['Python']);
  assert.equal(meta.repoUrl, undefined);
});

test('markdown backup', () => {
  const md = toMarkdown({
    kind: 'post', slug: 's', title: 'T', summary: 'Sum', date: '2026-01-01', updated: '2026-01-01T00:00:00Z',
    tags: ['a'], featured: false,
    blocks: [
      { type: 'heading', level: 2, text: [{ text: 'H' }], anchor: 'h' },
      { type: 'table', columnHeader: true, rowHeader: false, rows: [[[{ text: 'x' }], [{ text: 'y' }]], [[{ text: '1' }], [{ text: '2' }]]] },
    ],
  });
  assert.match(md, /^---\ntitle: "T"/);
  assert.match(md, /## H/);
  assert.match(md, /\| x \| y \|\n\| --- \| --- \|\n\| 1 \| 2 \|/);
});
