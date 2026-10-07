// One-time helper: creates the "Website" database in Notion with every property
// the sync expects, plus a draft example post showing what's supported.
//
// Usage: npm run notion:setup -- <link to a Notion page shared with your integration>

import { APIErrorCode, Client, isNotionClientError } from '@notionhq/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  // no .env
}

const token = process.env.NOTION_TOKEN?.trim();
const parentArg = process.argv[2];
const parentId = parentArg?.match(/([0-9a-f]{32})(?:[?#].*)?$/i)?.[1] ??
  parentArg?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];

if (!token) {
  console.error('Set NOTION_TOKEN in .env first (see README → "Connect Notion").');
  process.exit(1);
}
if (!parentId) {
  console.error('Usage: npm run notion:setup -- <link to the Notion page that should hold the database>');
  process.exit(1);
}

const notion = new Client({ auth: token });

function explain(error: unknown): never {
  if (isNotionClientError(error) && error.code === APIErrorCode.RestrictedResource) {
    console.error('✗ Your integration can only read. Creating the database needs write access for this one step:\n' +
      '  notion.so/profile/integrations → your integration → Capabilities → tick "Insert content" → Save.\n' +
      '  Re-run this command, then untick "Insert content" again — the site only ever needs read access.');
  } else if (isNotionClientError(error) && error.code === APIErrorCode.ObjectNotFound) {
    console.error('✗ Notion can\'t see that page. Open it → ••• → Connections → add your integration, then re-run.');
  } else {
    console.error(error);
  }
  process.exit(1);
}

const text = (content: string, extra: object = {}) => [{ type: 'text' as const, text: { content }, annotations: extra }];

try {
  const db = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentId },
    title: text('Website'),
    icon: { type: 'emoji', emoji: '🌐' },
    initial_data_source: {
      properties: {
        Name: { title: {} },
        Status: { select: { options: [{ name: 'Draft', color: 'gray' }, { name: 'Published', color: 'green' }] } },
        Type: {
          select: {
            options: [
              { name: 'Post', color: 'blue' },
              { name: 'Project', color: 'purple' },
              { name: 'Page', color: 'gray' },
              { name: 'Milestone', color: 'orange' },
            ],
          },
        },
        Date: { date: {} },
        Tags: { multi_select: { options: [] } },
        Summary: { rich_text: {} },
        Featured: { checkbox: {} },
        Slug: { rich_text: {} },
        Repo: { url: {} },
        Live: { url: {} },
      },
    },
  });

  const dataSourceId = 'data_sources' in db ? db.data_sources[0]?.id : undefined;
  if (!dataSourceId) throw new Error('Notion did not return a data source for the new database.');

  await notion.pages.create({
    parent: { type: 'data_source_id', data_source_id: dataSourceId },
    icon: { type: 'emoji', emoji: '👋' },
    properties: {
      Name: { title: text('Hello from Notion') },
      Status: { select: { name: 'Draft' } },
      Type: { select: { name: 'Post' } },
      Date: { date: { start: new Date().toISOString().slice(0, 10) } },
      Tags: { multi_select: [{ name: 'Meta' }] },
      Summary: { rich_text: text('My first post, written in Notion and published to my site.') },
    },
    children: [
      { paragraph: { rich_text: text('This page lives in Notion. Change Status to Published and it appears on the site after the next sync.') } },
      { callout: { icon: { type: 'emoji', emoji: '💡' }, color: 'blue_background', rich_text: text('Callouts, toggles, tables, code, images and embeds all carry over.') } },
      { heading_1: { rich_text: text('A heading') } },
      { bulleted_list_item: { rich_text: text('Bullet lists') } },
      { bulleted_list_item: { rich_text: text('with several items') } },
      { code: { language: 'typescript', rich_text: text('const greeting: string = "hello";\nconsole.log(greeting);') } },
      {
        table: {
          table_width: 2,
          has_column_header: true,
          has_row_header: false,
          children: [
            { table_row: { cells: [text('Skill'), text('Level')] } },
            { table_row: { cells: [text('TypeScript'), text('Daily driver')] } },
          ],
        },
      },
      { toggle: { rich_text: text('Click to expand'), children: [{ paragraph: { rich_text: text('Hidden details go here.') } }] } },
    ],
  });

  const dbId = db.id.replace(/-/g, '');
  console.log('✓ Created the "Website" database with an example draft post.\n');
  console.log('Add this to .env (and as a GitHub secret):\n');
  console.log(`NOTION_DATABASE_ID=${dbId}\n`);
} catch (error) {
  explain(error);
}
