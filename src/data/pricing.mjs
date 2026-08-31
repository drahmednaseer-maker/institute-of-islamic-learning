/* Single source of truth for fee plans — consumed by build.mjs (static cards)
   and shipped to the browser as JSON for the live fee calculator. */
export const REGIONS = {
  us: { label: 'United States', symbol: '$', code: 'USD', rates: { 30: 16, 45: 20, 60: 30 } },
  uk: { label: 'United Kingdom', symbol: '£', code: 'GBP', rates: { 30: 13, 45: 16.5, 60: 24.5 } },
  eu: { label: 'Europe', symbol: '€', code: 'EUR', rates: { 30: 15.5, 45: 19.5, 60: 29 } },
  ca: { label: 'Canada', symbol: 'C$', code: 'CAD', rates: { 30: 22, 45: 27.5, 60: 41 } },
  au: { label: 'Australia', symbol: 'A$', code: 'AUD', rates: { 30: 24, 45: 30, 60: 45 } },
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

export const featuresFor = (per, duration) => {
  const base = [
    `${per} live classes every week`,
    `${per * 4} classes per month`,
    `${duration}-minute one-to-one session`,
    'Choose a male or female tutor',
  ];
  if (per >= 3) base.push('Monthly written progress report');
  if (per >= 4) base.push('Free make-up class each month');
  if (per >= 5) base.push('Priority scheduling &amp; tutor choice');
  base.push('3 free trial classes, no card needed');
  return base;
};
