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

Placeholder contact details ship with the site. Replace them in three places:

1. `src/assets/js/main.js` — the `CFG` object at the top (drives the booking form's WhatsApp handoff)
2. `src/partials/header.html` and `src/partials/footer.html` — the visible `tel:`, `mailto:` and `wa.me` links
3. `src/pages/contact.html` and `src/partials/bookingfields.html` — the contact cards and fallback buttons

A quick way to find every occurrence:

```bash
grep -rn "923004080290\|instituteofislamiclearning.com" src/
```

## How the booking form works

There is no backend. On submit the form validates in the browser, composes a formatted message and opens WhatsApp with it pre-filled, with a `mailto:` fallback shown in the success state. To switch to a hosted form service later, replace the submit handler in `src/assets/js/main.js`.

## Performance notes

- No JavaScript framework — roughly 12 KB of hand-written JS, deferred
- Fonts self-hosted and subset; Latin preloaded, Arabic loaded only when needed
- Every graphic is inline SVG or a CSS gradient — no raster images in the critical path
- `content-visibility: auto` on below-the-fold sections
- Immutable one-year caching on `/assets/*` via `vercel.json`
- Full dark mode, keyboard navigation, reduced-motion support and skip links
