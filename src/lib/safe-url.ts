import type { EmbedProvider } from './model';

/**
 * Returns the URL only if it is safe to put in an `href`: http(s), mailto, or a
 * site-relative path. Anything else (javascript:, data:, notion internal links
 * that weren't mapped to a published page…) is dropped.
 */
export function safeHref(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (value.startsWith('#')) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:') {
      // Never leak links into the private Notion workspace.
      if (isNotionHost(url.hostname)) return undefined;
      return url.toString();
    }
  } catch {
    // not a URL
  }
  return undefined;
}

export function isNotionHost(hostname: string): boolean {
  return hostname === 'notion.so' || hostname.endsWith('.notion.so') ||
    hostname === 'notion.site' || hostname.endsWith('.notion.site');
}

/** Hosts whose iframes we allow. Everything else is shown as a link card. */
export const EMBED_FRAME_ORIGINS = [
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://www.loom.com',
  'https://www.figma.com',
  'https://embed.figma.com',
  'https://codepen.io',
  'https://codesandbox.io',
  'https://stackblitz.com',
  'https://www.google.com',
  'https://open.spotify.com',
];

/**
 * Turns a URL pasted into Notion as an embed/video into an embeddable iframe
 * URL for an allowlisted provider, or null if it isn't one we trust.
 */
export function toEmbed(raw: string): { provider: EmbedProvider; src: string } | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^www\./, '');

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.slice(1);
    else if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
      id = m?.[1] ?? null;
    }
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return { provider: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` };
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = url.pathname.match(/(\d{5,})/)?.[1];
    return id ? { provider: 'vimeo', src: `https://player.vimeo.com/video/${id}?dnt=1` } : null;
  }

  if (host === 'loom.com') {
    const id = url.pathname.match(/^\/(?:share|embed)\/([a-f0-9]+)/)?.[1];
    return id ? { provider: 'loom', src: `https://www.loom.com/embed/${id}` } : null;
  }

  if (host === 'figma.com' && /^\/(file|design|proto|board)\//.test(url.pathname)) {
    return {
      provider: 'figma',
      src: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url.toString())}`,
    };
  }

  if (host === 'codepen.io') {
    const m = url.pathname.match(/^\/([\w-]+)\/(?:pen|embed)\/([\w-]+)/);
    return m ? { provider: 'codepen', src: `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result` } : null;
  }

  if (host === 'codesandbox.io') {
    const id = url.pathname.match(/^\/(?:s|embed|p\/sandbox)\/([\w-]+)/)?.[1];
    return id ? { provider: 'codesandbox', src: `https://codesandbox.io/embed/${id}` } : null;
  }

  if (host === 'stackblitz.com') {
    const path = url.pathname.match(/^\/(edit|github)\/[\w./-]+/)?.[0];
    return path ? { provider: 'stackblitz', src: `https://stackblitz.com${path}?embed=1` } : null;
  }

  if (host === 'google.com' && url.pathname.startsWith('/maps/embed')) {
    return { provider: 'google-maps', src: url.toString() };
  }

  if (host === 'open.spotify.com') {
    const m = url.pathname.match(/^\/(?:embed\/)?(track|album|playlist|episode|show)\/(\w+)/);
    return m ? { provider: 'spotify', src: `https://open.spotify.com/embed/${m[1]}/${m[2]}` } : null;
  }

  return null;
}
