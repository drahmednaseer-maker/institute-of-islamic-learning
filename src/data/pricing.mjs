import { TRIAL } from './site.mjs';

/* Single source of truth for fee plans — consumed by build.mjs (static cards)
   and shipped to the browser as JSON for the live fee calculator. */
export const REGIONS = {
  us: { label: 'United States', short: 'USA', symbol: '$', code: 'USD', rates: { 30: 16, 45: 20, 60: 30 } },
  uk: { label: 'United Kingdom', short: 'UK', symbol: '£', code: 'GBP', rates: { 30: 13, 45: 16.5, 60: 24.5 } },
  eu: { label: 'Europe', short: 'Europe', symbol: '€', code: 'EUR', rates: { 30: 15.5, 45: 19.5, 60: 29 } },
  ca: { label: 'Canada', short: 'Canada', symbol: 'C$', code: 'CAD', rates: { 30: 22, 45: 27.5, 60: 41 } },
  au: { label: 'Australia', short: 'Aus', symbol: 'A$', code: 'AUD', rates: { 30: 24, 45: 30, 60: 45 } },
};

export const DURATIONS = [30, 45, 60];

export const PLANS = [
  { per: 2, name: 'Starter', badge: '', blurb: 'Steady weekend progress' },
  { per: 3, name: 'Regular', badge: '', blurb: 'A comfortable weekly rhythm' },
  { per: 4, name: 'Standard', badge: 'Most popular', blurb: 'Our recommended pace' },
  { per: 5, name: 'Intensive', badge: 'Best value', blurb: 'Fastest route to fluency' },
];

export const discountFor = (per) => (per >= 5 ? 0.06 : per >= 4 ? 0.03 : 0);
export const monthly = (region, duration, per) =>
  Math.round(REGIONS[region].rates[duration] * per * (1 - discountFor(per)));

/* What separates one plan from the next — this is all a card needs to show. */
export const planExtras = (per) => {
  const list = [`${per} live classes every week`, `${per * 4} classes per month`];
  if (per >= 3) list.push('Monthly written progress report');
  if (per >= 4) list.push('Free make-up class each month');
  if (per >= 5) list.push('Priority scheduling &amp; tutor choice');
  return list;
};

/* True of every plan, so it is stated once below the grid rather than
   repeated on all four cards. */
export const sharedFeatures = (duration) => [
  `${duration}-minute one-to-one session`,
  'Choose a male or female tutor',
  'A tutor matched to your goal and timezone',
  'Free rescheduling, no contract',
  'Course materials included',
  `${TRIAL.classes} free trial classes, no card needed`,
];
