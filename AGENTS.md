## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## This project

Personal site. Content is authored in Notion and synced by `npm run sync` (scripts/sync-notion.ts)
into `content/entries/*.json`; pages render the model in `src/lib/model.ts`. Never render Notion
content with `set:html`; pass URLs through `src/lib/safe-url.ts`. No inline scripts (strict CSP in
`src/layouts/Base.astro`). Run `npm test` and `npm run check` before committing.
