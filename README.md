# Institute of Islamic Learning

Marketing site for the Institute of Islamic Learning — live one-to-one online Quran, Tajweed, Hifz and Arabic classes.

Built as a **zero-dependency static site**: no framework, no client-side router, no runtime libraries. Pages are assembled at build time by a small Node script and served as plain HTML from Vercel's edge.

## Commands

```bash
npm run build   # assemble src/ -> dist/
npm run dev     # build, then serve dist/ on http://localhost:4321
```

## Structure

```
build.mjs               # ~90-line static site generator (no dependencies)
src/
  layout.html           # page shell: <head>, header, footer, modal
  partials/             # header, footer, booking modal, shared form fields
  pages/                # one file per route, with `<!--@ ... -->` front-matter
  data/pricing.mjs      # single source of truth for all fee plans
  schema/               # JSON-LD blocks, referenced per page
  assets/               # css, js, fonts, svg — copied verbatim
  static/               # robots.txt, manifest, favicon — copied to the root
dist/                   # build output (git-ignored, deployed to Vercel)
```

Pages declare their metadata in a comment block at the top:

```html
<!--@
title: Page title
description: Meta description
nav: pricing          # highlights the matching nav item
schema: pricing.html  # optional JSON-LD file from src/schema/
-->
```

## Editing content

| I want to change… | Edit |
| --- | --- |
| Prices, currencies, plan features | `src/data/pricing.mjs` — the cards *and* the live calculator both read from it |
| Phone / WhatsApp / email | See "Contact details" below |
| Navigation or footer links | `src/partials/header.html`, `src/partials/footer.html` |
| Colours, spacing, typography | The `:root` custom properties at the top of `src/assets/css/style.css` |
| A page's copy | The matching file in `src/pages/` |

### Contact details

All of them live in one file: **`src/data/site.mjs`**.

```js
export const CONTACT = {
  phoneDisplay: '+92 300 408 0290',   // what visitors see
  phoneHref:    '+923004080290',      // tel: links — digits and a leading +
  whatsapp:     '923004080290',       // wa.me links — digits only, no + or spaces
  email:        '',                   // empty removes every email link from the site
  address:      '',                   // optional, omitted from the footer when empty
  areaLine:     'Serving students in ...',
};
```

Pages and partials reference them as `{{phone}}`, `{{phoneHref}}`, `{{whatsapp}}`, `{{email}}`,
`{{address}}` and `{{areaLine}}`; the booking script has `whatsapp` and `email` baked in at build
time. Change a value once and it updates across the pages, the JSON-LD and the WhatsApp handoff.

Templates support `{{#email}}…{{/email}}` (render only when the value is set) and
`{{^email}}…{{/email}}` (render only when it is empty). That is how the site currently ships
with no email at all: the top-bar link, footer entry, contact card and JSON-LD property are
dropped, and the booking form offers "Call us instead" in place of the mail fallback. Fill in
`email` and all of it reappears.

`SOCIAL` in the same file drives the footer icons — **a social entry with an empty `url` is dropped
entirely**, so there are never dead links to placeholder profiles.

## Logo assets

`brand/logo-original.jpg` is the original 1080px seal (kept in the repo, not deployed). Everything else is derived from it:

| File | Size | Used by |
| --- | --- | --- |
| `logo.webp` / `logo.jpg` | 800px | hero medallion (`<picture>`, WebP with JPEG fallback) |
| `logo-sm.webp` / `logo-sm.jpg` | 176px | header and footer marks |
| `apple-touch-icon.png` | 180px | iOS home screen |
| `favicon-32.png`, `favicon-96.png` | 32 / 96px | browser tab |
| `og.jpg` | 1200×630 | social share card |

All of them are cropped square to the seal's true bounds with a small margin, so a
`border-radius: 50%` mask lands exactly on the outer ring. If the logo is ever replaced,
swap `brand/logo-original.jpg` and regenerate the derived sizes at the same crop.

## How the booking form works

There is no backend. On submit the form validates in the browser, composes a formatted message and opens WhatsApp with it pre-filled, with a `mailto:` fallback shown in the success state. To switch to a hosted form service later, replace the submit handler in `src/assets/js/main.js`.

## Performance notes

- No JavaScript framework — roughly 12 KB of hand-written JS, deferred
- Fonts self-hosted and subset; Latin preloaded, Arabic loaded only when needed
- Every graphic is inline SVG or a CSS gradient — no raster images in the critical path
- `content-visibility: auto` on below-the-fold sections
- Assets are content-hashed at build time (`style.<hash>.css`), so the one-year `immutable` cache in `vercel.json` is safe — a changed file gets a new URL and reaches returning visitors immediately. Pages themselves always revalidate.
- Full dark mode, keyboard navigation, reduced-motion support and skip links
