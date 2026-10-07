import type { Block, RichText } from './model';

export interface Heading { level: number; text: string; anchor: string }

const plain = (text: RichText[]) => text.map((t) => t.text).join('');

/** All headings in document order, including those nested in toggles/columns. */
export function collectHeadings(blocks: Block[], out: Heading[] = []): Heading[] {
  for (const b of blocks) {
    if (b.type === 'heading') {
      out.push({ level: b.level, text: plain(b.text), anchor: b.anchor });
      if (b.children) collectHeadings(b.children, out);
    } else if (b.type === 'columns') {
      b.columns.forEach((c) => collectHeadings(c, out));
    } else if (b.type === 'toggle' || ((b.type === 'callout' || b.type === 'quote' || b.type === 'paragraph') && b.children)) {
      collectHeadings(b.children ?? [], out);
    }
  }
  return out;
}
