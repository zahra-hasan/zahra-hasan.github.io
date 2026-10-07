# zahra-hasan.github.io

My personal site: writing, projects and milestones from my journey in software and forward-deployed engineering.

**I write in Notion. The site publishes itself.**

```
Notion "Website" database ──▶ GitHub Action (every 30 min, or on demand) ──▶ GitHub Pages
  Status = Published           • pulls published pages                      static site:
                               • downloads + optimises images               no login, no DB,
                               • commits a Markdown backup to content/      no comments
```

## Day to day

| I want to…            | In Notion                                                     |
| --------------------- | ------------------------------------------------------------- |
| Publish a post        | New page in **Website**, Type = Post, Status = **Published**  |
| Edit                  | Just edit the page                                            |
| Unpublish / delete    | Set Status = Draft, or delete the page                        |
| Add a project         | Type = Project (optional: Repo, Live, Featured, cover image)  |
| Add a milestone       | Type = Milestone, with Date and Summary (shows on the timeline) |
| Edit my About page    | Type = Page, Slug = `about`                                   |
| Add another page      | Type = Page, Slug = e.g. `uses` → `/uses/`                    |

Changes go live on the next sync (within ~30 minutes). To publish **now**: GitHub → Actions →
"Sync from Notion & deploy" → **Run workflow** (works from the GitHub mobile app too).

### Database properties

| Property  | Type         | Notes                                                    |
| --------- | ------------ | -------------------------------------------------------- |
| Name      | Title        |                                                          |
| Status    | Select       | Only `Published` pages go live                           |
| Type      | Select       | `Post` (default), `Project`, `Page`, `Milestone`         |
| Date      | Date         | Defaults to the page's creation date                     |
| Tags      | Multi-select |                                                          |
| Summary   | Text         | Shown in lists, under the title, and in LinkedIn previews |
| Featured  | Checkbox     | Featured projects show first on the home page            |
| Slug      | Text         | Optional custom URL, otherwise made from the title       |
| Repo/Live | URL          | Project links                                            |

Page **icon** (emoji) and **cover** image are used too.

### Supported Notion blocks

Paragraphs and all text formatting/colours, headings (incl. toggle headings), bulleted/numbered/to-do
lists, quotes, callouts, toggles, code (syntax highlighted), tables, columns, dividers, images, videos,
files/PDFs, bookmarks, table of contents, equations (shown as code), synced blocks, and embeds from
YouTube, Vimeo, Loom, Figma, CodePen, CodeSandbox, StackBlitz, Google Maps and Spotify. Other embeds
become link cards. Child pages, linked databases and @-mentions of people are never published.

## One-time setup

1. **Create a Notion integration**: <https://www.notion.so/profile/integrations> → *New integration*
   → type *Internal*, capabilities: **Read content** only. Copy the secret.
2. **Pick a home for the database**: create a page in Notion (e.g. "Website"), then on that page
   ••• → *Connections* → add your integration.
3. **Create the database** (or build it by hand from the table above):
   ```sh
   cp .env.example .env              # paste the secret into NOTION_TOKEN
   npm install
   npm run notion:setup -- "<link to the page from step 2>"
   ```
   It prints `NOTION_DATABASE_ID=…`. Put that in `.env`.
4. **Add GitHub secrets**: repo → Settings → Secrets and variables → Actions → add `NOTION_TOKEN`
   and `NOTION_DATABASE_ID`. Or:
   ```sh
   gh secret set NOTION_TOKEN && gh secret set NOTION_DATABASE_ID
   ```
5. Run the workflow once (Actions → Run workflow). Done.

## Working locally

```sh
npm run dev               # http://localhost:4321, shows sample content until you've synced
npm run sync              # pull from Notion into content/ (needs .env)
npm test                  # converter + URL-safety tests
npm run check             # type-check
```

Edit your name, intro, headline and social links in [`src/site.config.ts`](src/site.config.ts).

## How it's put together

- `scripts/sync-notion.ts`: fetches published pages and writes `content/entries/*.json`,
  `content/markdown/**.md` (backup) and `public/media/*`.
- `scripts/notion/convert.ts`: Notion blocks → the site's own model (`src/lib/model.ts`).
  The website never talks to Notion, so the editor could be swapped later.
- `src/components/blocks/`: renders the model.
- `src/pages/og/[key].png.ts`: generates a branded preview image for every page (LinkedIn cards).
- `content/fixtures/`: sample content for local preview only. Never deployed.

## Security notes

- The live site is static HTML: no server, database, login or forms to attack.
- The Notion token lives only in GitHub Actions secrets / your local `.env` and is never shipped to the browser.
  Give the integration **read-only** access, and only to the Website page.
- Content is always rendered as escaped text. Links are limited to http(s)/mailto, links into your private
  Notion workspace are stripped, and iframes are only allowed from the providers listed above.
- A strict Content-Security-Policy allows only this site's own scripts.
- Protect your GitHub and Notion accounts with 2FA. They're the real "admin login".
