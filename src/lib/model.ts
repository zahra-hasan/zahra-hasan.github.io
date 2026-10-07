// The site's own content model.
//
// Notion is only the editor: `scripts/sync-notion.ts` converts Notion pages into
// these types and writes them to `content/entries/*.json`. Everything the site
// renders comes from this model, so the website never talks to Notion directly
// and could swap editors without touching a single page.

export type Kind = 'post' | 'project' | 'page' | 'milestone';

export type TextColor =
  | 'default' | 'gray' | 'brown' | 'orange' | 'yellow'
  | 'green' | 'blue' | 'purple' | 'pink' | 'red';

export interface RichText {
  text: string;
  href?: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  code?: boolean;
  color?: TextColor;
  /** Background highlight rather than text colour. */
  highlight?: boolean;
}

export interface ListItem {
  text: RichText[];
  checked?: boolean;
  children: Block[];
}

export type EmbedProvider =
  | 'youtube' | 'vimeo' | 'loom' | 'figma' | 'codepen'
  | 'codesandbox' | 'stackblitz' | 'google-maps' | 'spotify';

export type Block =
  | { type: 'paragraph'; text: RichText[]; children?: Block[] }
  | { type: 'heading'; level: 2 | 3 | 4; text: RichText[]; anchor: string; children?: Block[] }
  | { type: 'bulleted_list'; items: ListItem[] }
  | { type: 'numbered_list'; items: ListItem[] }
  | { type: 'todo_list'; items: ListItem[] }
  | { type: 'quote'; text: RichText[]; children?: Block[] }
  | { type: 'callout'; icon?: string; color: TextColor; text: RichText[]; children?: Block[] }
  | { type: 'toggle'; summary: RichText[]; children: Block[] }
  | { type: 'code'; language: string; code: string; caption?: RichText[] }
  | { type: 'divider' }
  | { type: 'image'; src: string; caption?: RichText[] }
  | { type: 'video'; src: string; caption?: RichText[] }
  | { type: 'embed'; provider: EmbedProvider; src: string; caption?: RichText[] }
  | { type: 'bookmark'; url: string; caption?: RichText[] }
  | { type: 'file'; src: string; name: string; caption?: RichText[] }
  | { type: 'table'; columnHeader: boolean; rowHeader: boolean; /** rows → cells → text spans */ rows: RichText[][][] }
  | { type: 'columns'; columns: Block[][] }
  | { type: 'equation'; expression: string }
  | { type: 'toc' };

export interface EntryMeta {
  kind: Kind;
  slug: string;
  title: string;
  summary: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** ISO timestamp of the last edit. */
  updated: string;
  tags: string[];
  featured: boolean;
  cover?: string;
  /** Emoji icon of the Notion page, if any. */
  icon?: string;
  /** Projects: public links. */
  repoUrl?: string;
  liveUrl?: string;
}

export interface Entry extends EntryMeta {
  blocks: Block[];
}
