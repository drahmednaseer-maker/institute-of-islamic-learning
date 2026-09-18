/* The fee plans the backend can edit.

   src/data/pricing.mjs reads the override once, at import — right for the build,
   wrong for a long-running server that has just saved a change. So everything
   here reads the file afresh and falls back to the shipped defaults. */
import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PRICING_FILE, DEFAULTS } from '../../src/data/pricing.mjs';


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

