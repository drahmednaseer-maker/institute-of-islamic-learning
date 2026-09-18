/* The fee plans the backend can edit.

   src/data/pricing.mjs reads the override once, at import — right for the build,
   wrong for a long-running server that has just saved a change. So everything
   here reads the file afresh and falls back to the shipped defaults. */
import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRICING_FILE, DEFAULTS } from '../../src/data/pricing.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const livePricing = () => {
  let saved = null;
  try { saved = JSON.parse(readFileSync(PRICING_FILE, 'utf8')); } catch { /* nothing saved yet */ }
  const has = (v) => v && typeof v === 'object' && Object.keys(v).length;
  return {
    regions: has(saved?.regions) ? saved.regions : DEFAULTS.regions,
    durations: Array.isArray(saved?.durations) && saved.durations.length ? saved.durations.map(Number) : DEFAULTS.durations,
    plans: (Array.isArray(saved?.plans) && saved.plans.length ? saved.plans : DEFAULTS.plans)
      .map((p) => ({ discount: 0, features: [], badge: '', blurb: '', ...p, per: Number(p.per) || 1 })),
    custom: !!saved,
    updated_at: saved?.updated_at || null,
  };
};

export const priceOf = (pricing, region, duration, per) => {
  const rate = Number(pricing.regions[region]?.rates?.[duration] || 0);
  const plan = pricing.plans.find((p) => Number(p.per) === Number(per));
  return Math.round(rate * per * (1 - Number(plan?.discount || 0) / 100));
};

export const savePricing = (data) => {
  mkdirSync(dirname(PRICING_FILE), { recursive: true });
  writeFileSync(PRICING_FILE, JSON.stringify({ ...data, updated_at: new Date().toISOString() }, null, 2));
};

export const clearPricing = () => { if (existsSync(PRICING_FILE)) rmSync(PRICING_FILE); };

export const hasPricingOverride = () => existsSync(PRICING_FILE);

/* Rebuild the public site in a child process: the parent has already imported
   the old figures, and an ES module cannot be un-imported. It builds into a
   staging folder and swaps that in, so visitors never meet a half-built site. */
const STAGE = 'dist.next', OLD = 'dist.old';
export const rebuildSite = () => new Promise((resolve) => {
  const child = spawn(process.execPath, [join(ROOT, 'build.mjs')], {
    cwd: ROOT, env: { ...process.env, OUT_DIR: STAGE },
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('error', (e) => resolve({ ok: false, log: e.message }));
  child.on('close', (code) => {
    if (code !== 0) { rmSync(join(ROOT, STAGE), { recursive: true, force: true }); return resolve({ ok: false, log: out.trim() }); }
    try {
      rmSync(join(ROOT, OLD), { recursive: true, force: true });
      if (existsSync(join(ROOT, 'dist'))) renameSync(join(ROOT, 'dist'), join(ROOT, OLD));
      renameSync(join(ROOT, STAGE), join(ROOT, 'dist'));
      rmSync(join(ROOT, OLD), { recursive: true, force: true });
      return resolve({ ok: true, log: out.trim() });
    } catch (e) { return resolve({ ok: false, log: `${out.trim()}\n${e.message}` }); }
  });
});
