// Renders an entry as a portable Markdown file. These are committed to the repo
// as a human-readable backup, so your writing is never locked into Notion.

import type { Block, Entry, ListItem, RichText } from '../../src/lib/model.ts';

function inline(text: RichText[]): string {
  return text.map((t) => {
    let s = t.code ? `\`${t.text}\`` : t.text.replace(/([*_`[\]])/g, '\\$1');
    if (t.bold) s = `**${s}**`;
    if (t.italic) s = `*${s}*`;
    if (t.strike) s = `~~${s}~~`;
    if (t.href) s = `[${s}](${t.href})`;
    return s;
  }).join('');
}

function indent(text: string, prefix: string): string {
  return text.split('\n').map((line) => (line ? prefix + line : line)).join('\n');
}

function list(items: ListItem[], marker: (i: number, item: ListItem) => string): string {
  return items.map((item, i) => {
    const head = `${marker(i, item)}${inline(item.text)}`;
    const body = item.children.length ? '\n' + indent(blocks(item.children), '    ') : '';
    return head + body;
  }).join('\n');
}

function caption(c?: RichText[]): string {
  return c ? `\n*${inline(c)}*` : '';
}

function block(b: Block): string {
  switch (b.type) {
    case 'paragraph':
      return inline(b.text) + (b.children ? '\n\n' + indent(blocks(b.children), '    ') : '');
    case 'heading':
      return `${'#'.repeat(b.level)} ${inline(b.text)}` + (b.children ? '\n\n' + blocks(b.children) : '');
    case 'bulleted_list':
      return list(b.items, () => '- ');
    case 'numbered_list':
      return list(b.items, (i) => `${i + 1}. `);
    case 'todo_list':
      return list(b.items, (_, item) => `- [${item.checked ? 'x' : ' '}] `);
    case 'quote':
      return indent(inline(b.text) + (b.children ? '\n\n' + blocks(b.children) : ''), '> ');
    case 'callout':
      return indent(`${b.icon ? b.icon + ' ' : ''}${inline(b.text)}` + (b.children ? '\n\n' + blocks(b.children) : ''), '> ');
    case 'toggle':
      return `<details>\n<summary>${inline(b.summary)}</summary>\n\n${blocks(b.children)}\n\n</details>`;
    case 'code':
      return '```' + b.language + '\n' + b.code + '\n```' + caption(b.caption);
    case 'divider':
      return '---';
    case 'equation':
      return `$$\n${b.expression}\n$$`;
    case 'toc':
      return '';
    case 'image':
      return `![${b.caption ? inline(b.caption) : ''}](${b.src})`;
    case 'video':
    case 'embed':
      return `[${b.type}: ${b.src}](${b.src})${caption(b.caption)}`;
    case 'bookmark':
      return `<${b.url}>${caption(b.caption)}`;
    case 'file':
      return `[${b.name}](${b.src})${caption(b.caption)}`;
    case 'columns':
      return b.columns.map(blocks).join('\n\n');
    case 'table': {
      if (!b.rows.length) return '';
      const cells = (row: RichText[][]) => '| ' + row.map((c) => inline(c).replace(/\|/g, '\\|')).join(' | ') + ' |';
      const [first, ...rest] = b.rows;
      const sep = '| ' + first.map(() => '---').join(' | ') + ' |';
      // Markdown tables need a header row; use an empty one if Notion had none.
      return b.columnHeader
        ? [cells(first), sep, ...rest.map(cells)].join('\n')
        : ['| ' + first.map(() => ' ').join(' | ') + ' |', sep, ...b.rows.map(cells)].join('\n');
    }
  }
}

function blocks(bs: Block[]): string {
  return bs.map(block).filter(Boolean).join('\n\n');
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function toMarkdown(entry: Entry): string {
  const front = [
    '---',
    `title: ${yamlString(entry.title)}`,
    `kind: ${entry.kind}`,
    `slug: ${entry.slug}`,
    `date: ${entry.date}`,
    `updated: ${entry.updated}`,
    entry.summary && `summary: ${yamlString(entry.summary)}`,
    entry.tags.length && `tags: [${entry.tags.map(yamlString).join(', ')}]`,
    entry.featured && 'featured: true',
    entry.cover && `cover: ${entry.cover}`,
    entry.repoUrl && `repo: ${entry.repoUrl}`,
    entry.liveUrl && `live: ${entry.liveUrl}`,
    '---',
  ].filter(Boolean).join('\n');
  return `${front}\n\n# ${entry.title}\n\n${blocks(entry.blocks)}\n`;
}
