// Generates the 1200×630 preview image LinkedIn (and others) show when a link is shared.
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { site } from '../../site.config';
import { entriesOf } from '../../lib/entries';
import type { Entry } from '../../lib/model';

const require = createRequire(import.meta.url);
const font = (weight: number) => readFile(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));
const fontsPromise = Promise.all([font(400), font(600), font(700)]);

interface Card { title: string; label: string; summary?: string }

export const getStaticPaths = (async () => {
  const entries: Entry[] = [
    ...(await entriesOf('post')),
    ...(await entriesOf('project')),
    ...(await entriesOf('page')),
  ];
  return [
    { params: { key: 'home' }, props: { title: site.name, label: site.role, summary: site.headline } satisfies Card },
    ...entries.map((e) => ({
      params: { key: `${e.kind}-${e.slug}` },
      props: {
        title: e.title,
        label: e.kind === 'post' ? 'Writing' : e.kind === 'project' ? 'Project' : site.role,
        summary: e.summary,
      } satisfies Card,
    })),
  ];
}) satisfies GetStaticPaths;

// Minimal element helper so we don't need JSX in a .ts file.
const h = (type: string, style: Record<string, unknown>, children?: unknown) => ({ type, props: { style, children } });

export const GET: APIRoute = async ({ props }) => {
  const { title, label, summary } = props as Card;
  const [regular, semibold, bold] = await fontsPromise;
  const titleSize = title.length > 70 ? 56 : title.length > 40 ? 66 : 78;
  const host = new URL(site.url).host;

  const svg = await satori(
    h('div', {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '72px 80px', background: '#faf9f6', color: '#17161c', fontFamily: 'Inter', position: 'relative',
      backgroundImage: 'radial-gradient(circle at 100% 0%, #c7d2fe 0%, rgba(199,210,254,0) 45%), radial-gradient(circle at 78% 22%, #fde68a 0%, rgba(253,230,138,0) 30%)',
    }, [
      h('div', { display: 'flex', alignItems: 'center', gap: '18px' }, [
        h('div', {
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px',
          borderRadius: '14px', background: '#17161c', color: '#faf9f6', fontSize: '22px', fontWeight: 700,
        }, 'ZH'),
        h('div', { display: 'flex', fontSize: '28px', fontWeight: 600 }, site.name),
      ]),
      h('div', { display: 'flex', flexDirection: 'column', gap: '22px' }, [
        h('div', { display: 'flex', fontSize: '24px', fontWeight: 600, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.06em' }, label),
        h('div', { display: 'flex', fontSize: `${titleSize}px`, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.035em', maxWidth: '1000px' }, title),
        summary ? h('div', { display: 'flex', fontSize: '28px', color: '#47454f', lineHeight: 1.4, maxWidth: '960px' }, summary.length > 140 ? summary.slice(0, 137) + '…' : summary) : null,
      ].filter(Boolean)),
      h('div', { display: 'flex', fontSize: '22px', color: '#75727e' }, host),
    ]),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: semibold, weight: 600, style: 'normal' },
        { name: 'Inter', data: bold, weight: 700, style: 'normal' },
      ],
    },
  );

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
