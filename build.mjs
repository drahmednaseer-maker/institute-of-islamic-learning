#!/usr/bin/env node
/* Zero-dependency static site builder for Institute of Islamic Learning.
   Assembles src/pages/*.html into dist/ using src/layout.html + src/partials/*. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGIONS, DURATIONS, PLANS, monthly, featuresFor } from './src/data/pricing.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const SRC = join(root, 'src');
const OUT = join(root, 'dist');
const SITE = 'https://institute-of-islamic-learning.vercel.app';

const read = (p) => readFileSync(p, 'utf8');
const partial = (n) => read(join(SRC, 'partials', `${n}.html`));

const partials = Object.fromEntries(
  readdirSync(join(SRC, 'partials'))
    .filter((f) => f.endsWith('.html'))
    .map((f) => [f.replace(/\.html$/, ''), read(join(SRC, 'partials', f))])
);

/* Parse `<!--@ key: value -->` front-matter from the top of a page file. */
function parseMeta(src) {
  const meta = {};
  const body = src.replace(/^\s*<!--@([\s\S]*?)-->/, (_, block) => {
    for (const line of block.split('\n')) {
      const m = line.match(/^\s*([a-zA-Z][\w-]*)\s*:\s*(.*?)\s*$/);
      if (m) meta[m[1]] = m[2];
    }
    return '';
  });
  return { meta, body };
}

/* Expand {{> name}} partial includes, recursively. */
function expand(html, depth = 0) {
  if (depth > 6) return html;
  const next = html.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (m, name) => partials[name] ?? m);
  return next === html ? html : expand(next, depth + 1);
}

function fill(tpl, vars) {
  return tpl.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : ''));
}


const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.6 16.2 5.4 12l-1.4 1.4 5.6 5.6L20.4 8.2 19 6.8z"/></svg>';

/* Build every region x duration pricing panel plus the JSON the calculator reads. */
function renderPricing() {
  const regionTabs = Object.entries(REGIONS)
    .map(([k, r], i) => `<button type="button" class="tab" role="tab" data-value="${k}" aria-selected="${i === 0}">${r.label}</button>`)
    .join('');
  const durTabs = DURATIONS.map(
    (d, i) => `<button type="button" class="tab" role="tab" data-value="${d}" aria-selected="${i === 0}">${d} minutes</button>`
  ).join('');

  const panels = Object.keys(REGIONS)
    .flatMap((region) =>
      DURATIONS.map((duration) => {
        const cards = PLANS.map((plan) => {
          const amt = monthly(region, duration, plan.per);
          const feats = featuresFor(plan.per, duration).map((f) => `<li>${CHECK}<span>${f}</span></li>`).join('');
          return `<article class="price${plan.badge ? ' price--featured' : ''}">
            ${plan.badge ? `<span class="price__badge">${plan.badge}</span>` : ''}
            <h3 class="price__name">${plan.name}</h3>
            <p class="price__freq">${plan.blurb}</p>
            <p class="price__amt">${REGIONS[region].symbol}${amt}<small>/ month</small></p>
            <ul>${feats}</ul>
            <a class="btn ${plan.badge ? 'btn--gold' : 'btn--ghost'}" href="/contact#book" data-book>Start free trial</a>
          </article>`;
        }).join('');
        return `<div data-panel data-region="${region}" data-duration="${duration}" ${region === 'us' && duration === 30 ? '' : 'hidden'}>
          <div class="price-grid">${cards}</div>
        </div>`;
      })
    )
    .join('\n');

  const rateJson = JSON.stringify(
    Object.fromEntries(Object.entries(REGIONS).map(([k, r]) => [k, { symbol: r.symbol, code: r.code, rates: r.rates }]))
  );

  return `<div data-pricing>
    <div class="tabs" role="tablist" aria-label="Region" data-tabgroup="region">${regionTabs}</div>
    <div class="tabs tabs--sub" role="tablist" aria-label="Class length" data-tabgroup="duration">${durTabs}</div>
    ${panels}
  </div>
  <script type="application/json" id="rateData">${rateJson}</script>`;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const layout = read(join(SRC, 'layout.html'));
const pageFiles = readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.html'));
const pages = [];

for (const file of pageFiles) {
  const { meta, body } = parseMeta(read(join(SRC, 'pages', file)));
  const slug = file.replace(/\.html$/, '');
  const path = slug === 'index' ? '/' : `/${slug}`;
  const vars = {
    title: meta.title || 'Institute of Islamic Learning',
    description: meta.description || '',
    canonical: SITE + path,
    nav: meta.nav || slug,
    bodyClass: meta.bodyClass || '',
    schema: meta.schema ? read(join(SRC, 'schema', meta.schema)) : '',
    site: SITE,
    year: String(new Date().getFullYear()),
  };
  /* insert the page body first so partial includes inside it expand too */
  let html = layout.replace('{{content}}', () => body);
  html = expand(html);
  html = fill(html, vars);
  html = html.replace('<!--PRICING-->', renderPricing);
  /* mark the active nav item */
  html = html.replaceAll(`data-nav="${vars.nav}"`, `data-nav="${vars.nav}" aria-current="page"`);
  writeFileSync(join(OUT, file), html);
  if (!['404'].includes(slug)) pages.push({ path, priority: slug === 'index' ? '1.0' : '0.8' });
}

/* static assets */
cpSync(join(SRC, 'assets'), join(OUT, 'assets'), { recursive: true });
for (const f of ['robots.txt', 'site.webmanifest', 'favicon.svg']) {
  const p = join(SRC, 'static', f);
  if (existsSync(p)) cpSync(p, join(OUT, f));
}
const staticDir = join(SRC, 'static');
if (existsSync(staticDir)) cpSync(staticDir, OUT, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${p.priority}</priority></url>`)
    .join('\n')}\n</urlset>\n`
);

let bytes = 0;
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  statSync(p).isDirectory() ? walk(p) : (bytes += statSync(p).size);
});
walk(OUT);
console.log(`✓ built ${pageFiles.length} pages → dist/ (${(bytes / 1024).toFixed(1)} KB total)`);
