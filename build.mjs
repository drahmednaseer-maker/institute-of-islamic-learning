#!/usr/bin/env node
/* Zero-dependency static site builder for Institute of Islamic Learning.
   Assembles src/pages/*.html into dist/ using src/layout.html + src/partials/*. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync, existsSync, statSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGIONS, DURATIONS, PLANS, monthly, planExtras, sharedFeatures } from './src/data/pricing.mjs';
import { CONTACT, SOCIAL, TRIAL, LEADS_ENDPOINT } from './src/data/site.mjs';
import { COURSES, iconPath } from './src/data/courses.mjs';
import { TEAM } from './src/data/team.mjs';

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/* the headline price and the range of class frequencies are quoted in the page
   title, the meta description and the structured data; deriving them means a
   plan added or dropped in the backend cannot leave a stale number behind */
const US_PRICES = PLANS.map((p) => monthly('us', DURATIONS[0], p.per)).filter(Boolean);
const PRICE_LOW = String(Math.min(...US_PRICES, Infinity));
const PRICE_HIGH = String(Math.max(...PLANS.map((p) => monthly('us', DURATIONS[DURATIONS.length - 1], p.per)), 0));
const DUR_LIST = DURATIONS.length > 1
  ? `${DURATIONS.slice(0, -1).join(', ')} or ${DURATIONS[DURATIONS.length - 1]}-minute lessons`
  : `${DURATIONS[0]}-minute lessons`;
const PLAN_PERS = PLANS.map((p) => p.per).sort((a, z) => a - z);
const PER_WEEK_RANGE = PLAN_PERS.length > 1 ? `${PLAN_PERS[0]} to ${PLAN_PERS[PLAN_PERS.length - 1]}` : String(PLAN_PERS[0] ?? 0);
const OFFER_COUNT = String(PLANS.length * DURATIONS.length * Object.keys(REGIONS).length);

/* so that "all eight courses" can never become a lie after an edit */
const COURSE_COUNT = NUMBER_WORDS[COURSES.length] || String(COURSES.length);
const COURSE_LIST = COURSES.map((c) => c.name).reduce((acc, n, i, all) =>
  (i === 0 ? n : i === all.length - 1 ? `${acc} and ${n}` : `${acc}, ${n}`), '');
const root = dirname(fileURLToPath(import.meta.url));
const SRC = join(root, 'src');
/* the admin panel builds into a staging folder and swaps it in, so a rebuild
   never leaves the live site missing for a moment */
const OUT = process.env.OUT_DIR ? join(root, process.env.OUT_DIR) : join(root, 'dist');
/* Set SITE_URL in the deploy environment; it drives canonical links, OG tags
   and the sitemap. Change it once a custom domain is attached. */
const SITE = (process.env.SITE_URL || 'https://institute-of-islamic-learning.vercel.app').replace(/\/$/, '');

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

/* {{#key}}…{{/key}} keeps a block only when `key` has a value;
   {{^key}}…{{/key}} is the inverse. Used for optional contact details. */
function sections(html, vars, depth = 0) {
  if (depth > 4) return html;
  const next = html.replace(/\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/g,
    (_, kind, key, body) => {
      const has = Boolean(vars[key]);
      return (kind === '#' ? has : !has) ? body : '';
    });
  return next === html ? html : sections(next, vars, depth + 1);
}

function fill(tpl, vars) {
  return tpl.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : ''));
}


function renderSocials() {
  return SOCIAL.filter((s) => s.url).map((s) =>
    `<a href="${s.url}" aria-label="${s.name}" rel="noopener" target="_blank"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${s.path}"/></svg></a>`
  ).join('\n        ');
}

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.6 16.2 5.4 12l-1.4 1.4 5.6 5.6L20.4 8.2 19 6.8z"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14.2l-4.6-4.6L15 6l7 6-7 6-1.4-1.4 4.6-4.6H4z"/></svg>';

/* Courses are stored as plain text so the admin panel can edit them as prose;
   everything that reaches HTML is escaped here. */
const escHTML = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const courseIcon = (name) => `<span class="course__ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPath(name)}"/></svg></span>`;
const tagRow = (tags) => (tags || []).map((t) => `<span class="tag">${escHTML(t)}</span>`).join('');

const renderCourseIndex = () => COURSES.map((c) => `<a href="#${c.id}">${escHTML(c.short)}</a>`).join('\n  ');

const renderCourseCards = () => COURSES.map((c, i) => `<article class="card course reveal"${i % 2 ? ' data-delay="60"' : ''} id="${c.id}">
      <div class="course__top">
        ${courseIcon(c.icon)}
        <div><h2 class="h3">${escHTML(c.name)}</h2><p class="course__ar">${escHTML(c.arabic)}</p></div>
      </div>
      <p>${escHTML(c.intro)}</p>${(c.covers || []).length ? `
      <details class="course__more" open>
        <summary>What you&rsquo;ll cover</summary>
        <ul class="ticklist">
        ${c.covers.map((f) => `<li>${CHECK}<span>${escHTML(f)}</span></li>`).join('\n        ')}
      </ul>
      </details>` : ''}
      <div class="course__meta">${tagRow(c.tags)}</div>
      <a class="btn btn--gold btn--sm" href="/contact#book" data-book>${escHTML(c.cta)}</a>
    </article>`).join('\n\n    ');

const renderCourseHome = () => COURSES.filter((c) => c.onHome).map((c, i) => `<article class="card course reveal"${i % 3 ? ` data-delay="${(i % 3) * 60}"` : ''}>
        <div class="course__top">
          ${courseIcon(c.icon)}
          <div><h3 class="h3">${escHTML(c.name)}</h3><p class="course__ar">${escHTML(c.arabic)}</p></div>
        </div>
        <p>${escHTML(c.summary)}</p>
        <div class="course__meta">${tagRow(c.tags)}</div>
        <a class="course__link" href="/courses#${c.id}">Course details ${ARROW}</a>
      </article>`).join('\n\n      ');

const renderCourseMenu = () => COURSES.map((c) =>
  `<li><a href="/courses#${c.id}"><span class="mm__t">${escHTML(c.name)}</span><span class="mm__d">${escHTML(c.menuBlurb)}</span></a></li>`).join('\n              ');

const renderCourseMenuMobile = () => COURSES.map((c) =>
  `<li><a href="/courses#${c.id}">${escHTML(c.short)}</a></li>`).join('\n            ');

const renderCourseFooter = () => COURSES.filter((c) => c.inFooter).map((c) =>
  `<li><a href="/courses#${c.id}">${escHTML(c.name)}</a></li>`).join('\n        ');

const renderCourseOptions = () => COURSES.map((c) => `<option>${escHTML(c.formLabel)}</option>`).join('');

const renderTeachers = () => `<header class="section-head reveal">
      <p class="eyebrow"><span aria-hidden="true">✦</span> ${escHTML(TEAM.eyebrow)}</p>
      <h2 class="h2">${escHTML(TEAM.heading)}</h2>
      <p class="lead">${escHTML(TEAM.lead)}</p>
    </header>
    <div class="grid grid--4">
      ${TEAM.members.map((m, i) => `<div class="card teacher reveal"${i ? ` data-delay="${i * 60}"` : ''}>
        <div class="teacher__ava" aria-hidden="true">${escHTML(m.initial)}</div>
        <b>${escHTML(m.name)}</b>
        <p class="role">${escHTML(m.role)}</p>
        <p>${escHTML(m.bio)}</p>
      </div>`).join('\n      ')}
    </div>${TEAM.cta ? `
    <p class="center" style="margin-top:2.25rem"><a class="btn btn--gold btn--lg" href="/contact#book" data-book>${escHTML(TEAM.cta)}</a></p>` : ''}`;

/* Google reads this; it takes the text raw, not HTML-escaped. */
const renderCourseSchema = () => COURSES.map((c, i) => JSON.stringify({
  '@type': 'ListItem', position: i + 1,
  item: {
    '@type': 'Course', name: c.name, description: c.seo || c.summary,
    provider: { '@type': 'EducationalOrganization', name: 'Institute of Islamic Learning' },
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', courseWorkload: 'PT2H' },
  },
})).join(',\n');

/* Build every region x duration pricing panel. */
function renderPricing() {
  const regionTabs = Object.entries(REGIONS)
    .map(([k, r], i) => `<button type="button" class="tab" role="tab" data-value="${k}" aria-selected="${i === 0}">` +
      `<span class="tab__long">${r.label}</span><span class="tab__short">${r.short}</span></button>`)
    .join('');
  const durTabs = DURATIONS.length > 1 ? `<div class="tabs tabs--sub" role="tablist" aria-label="Class length" data-tabgroup="duration">${
    DURATIONS.map((d, i) => `<button type="button" class="tab" role="tab" data-value="${d}" aria-selected="${i === 0}">${d} minutes</button>`).join('')
  }</div>` : '';

  const panels = Object.keys(REGIONS)
    .flatMap((region) =>
      DURATIONS.map((duration) => {
        const cards = PLANS.map((plan) => {
          const amt = monthly(region, duration, plan.per);
          const feats = planExtras(plan.per).map((f) => `<li>${CHECK}<span>${f}</span></li>`).join('');
          return `<article class="price${plan.badge ? ' price--featured' : ''}">
            ${plan.badge ? `<span class="price__badge">${plan.badge}</span>` : ''}
            <div class="price__head">
              <div class="price__id">
                <h3 class="price__name">${plan.name}</h3>
                <p class="price__freq">${plan.blurb}</p>
              </div>
              <p class="price__amt">${REGIONS[region].symbol}${amt}<small>/ month</small></p>
            </div>
            <ul>${feats}</ul>
            <a class="btn ${plan.badge ? 'btn--gold' : 'btn--ghost'}" href="/contact#book" data-book>Start free trial</a>
          </article>`;
        }).join('');
        const shared = sharedFeatures(duration).map((f) => `<li>${CHECK}<span>${f}</span></li>`).join('');
        return `<div data-panel data-region="${region}" data-duration="${duration}" ${region === 'us' && duration === 30 ? '' : 'hidden'}>
          <div class="price-grid">${cards}</div>
          <div class="price-includes">
            <h3>Every plan includes</h3>
            <ul>${shared}</ul>
          </div>
        </div>`;
      })
    )
    .join('\n');

  return `<div data-pricing>
    <div class="tabs" role="tablist" aria-label="Region" data-tabgroup="region">${regionTabs}</div>
    ${durTabs}
    ${panels}
  </div>`;
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
  /* trial tokens resolve inside title/description too, which are inserted by
     fill() and so are never rescanned */
  const trial = {
    trialDays: String(TRIAL.days),
    trialClasses: String(TRIAL.classes),
    trialWord: TRIAL.word,
    TrialWord: TRIAL.Word,
    courseCount: COURSE_COUNT,
    CourseCount: COURSE_COUNT[0].toUpperCase() + COURSE_COUNT.slice(1),
    courseList: COURSE_LIST,
    priceLow: PRICE_LOW,
    priceHigh: PRICE_HIGH,
    perWeekRange: PER_WEEK_RANGE,
    durationList: DUR_LIST,
    planHeading: DURATIONS.length > 1 ? 'Pick your region and class length' : 'Pick your region',
    offerCount: OFFER_COUNT,
  };
  const vars = {
    ...trial,
    title: fill(meta.title || 'Institute of Islamic Learning', trial),
    description: fill(meta.description || '', trial),
    canonical: SITE + path,
    nav: meta.nav || slug,
    bodyClass: meta.bodyClass || '',
    schema: meta.schema ? read(join(SRC, 'schema', meta.schema)) : '',
    site: SITE,
    year: String(new Date().getFullYear()),
    phone: CONTACT.phoneDisplay,
    phoneHref: CONTACT.phoneHref,
    whatsapp: CONTACT.whatsapp,
    email: CONTACT.email,
    address: CONTACT.address,
    areaLine: CONTACT.areaLine,
  };
  /* insert the page body first so partial includes inside it expand too */
  let html = layout.replace('{{content}}', () => body).replace('{{schema}}', () => vars.schema);
  html = expand(html);
  html = html.replaceAll('<!--SOCIALS-->', renderSocials);
  html = sections(html, vars);
  html = fill(html, vars);
  html = html.replaceAll('<!--PRICING-->', renderPricing);
  html = html.replaceAll('<!--COURSE_INDEX-->', renderCourseIndex);
  html = html.replaceAll('<!--COURSE_CARDS-->', renderCourseCards);
  html = html.replaceAll('<!--COURSE_HOME-->', renderCourseHome);
  html = html.replaceAll('<!--COURSE_MENU-->', renderCourseMenu);
  html = html.replaceAll('<!--COURSE_MENU_MOBILE-->', renderCourseMenuMobile);
  html = html.replaceAll('<!--COURSE_FOOTER-->', renderCourseFooter);
  html = html.replaceAll('<!--COURSE_OPTIONS-->', renderCourseOptions);
  html = html.replaceAll('<!--COURSE_SCHEMA-->', renderCourseSchema);
  html = html.replaceAll('<!--TEACHERS-->', renderTeachers);
  html = html.replaceAll('<!--PLAN_DAYS-->', () => {
    const pick = PLANS.find((p) => p.badge) || PLANS[Math.floor(PLANS.length / 2)];
    return PLANS.map((p) => `<option${p === pick ? ' selected' : ''}>${p.per} classes per week</option>`).join('');
  });
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

/* ------------------------------------------------------------------
   Fingerprint every asset so `immutable` caching is actually safe.
   Leaf assets (fonts, images) are hashed first, their new paths are
   written into the css/js that reference them, then css/js themselves
   are hashed, and finally every path is rewritten across the pages.
   ------------------------------------------------------------------ */
function fingerprintAssets() {
  const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 8);
  const map = new Map();

  const collect = (dir, out = []) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      entry.isDirectory() ? collect(full, out) : out.push(full);
    }
    return out;
  };

  const rename = (file) => {
    const buf = readFileSync(file);
    const dot = file.lastIndexOf('.');
    const next = `${file.slice(0, dot)}.${hash(buf)}${file.slice(dot)}`;
    renameSync(file, next);
    map.set(file.slice(OUT.length).replace(/\\/g, '/'), next.slice(OUT.length).replace(/\\/g, '/'));
  };

  const rewrite = (file) => {
    let text = readFileSync(file, 'utf8');
    for (const [from, to] of map) text = text.split(from).join(to);
    writeFileSync(file, text);
  };

  const assetsDir = join(OUT, 'assets');
  if (!existsSync(assetsDir)) return map;
  const all = collect(assetsDir);
  const isCode = (f) => /\.(css|js)$/.test(f);

  all.filter((f) => !isCode(f)).forEach(rename);
  all.filter(isCode).forEach((f) => rewrite(f));          /* still at their original paths */
  collect(assetsDir).filter(isCode).forEach(rename);

  for (const f of collect(OUT)) {
    if (/\.(html|webmanifest|xml|txt)$/.test(f)) rewrite(f);
  }
  return map;
}

/* the booking script needs the same contact details — bake them in */
const jsDir = join(OUT, 'assets', 'js');
if (existsSync(jsDir)) {
  for (const f of readdirSync(jsDir).filter((n) => n.endsWith('.js'))) {
    const file = join(jsDir, f);
    writeFileSync(
      file,
      readFileSync(file, 'utf8')
        .replaceAll('__WHATSAPP__', CONTACT.whatsapp)
        .replaceAll('__EMAIL__', CONTACT.email)
        .replaceAll('__LEADS_ENDPOINT__', LEADS_ENDPOINT || '')
    );
  }
}

const fingerprinted = fingerprintAssets();

/* robots.txt carries an absolute sitemap URL, so it has to follow SITE_URL too */
writeFileSync(
  join(OUT, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /invoice/\n\nSitemap: ${SITE}/sitemap.xml\n`
);

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
console.log(`✓ built ${pageFiles.length} pages, ${fingerprinted.size} fingerprinted assets → dist/ (${(bytes / 1024).toFixed(1)} KB total)`);
