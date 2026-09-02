/* Single source of truth for contact details and social links.
   Every page, partial, schema block and the booking script read from here —
   change a value once and it updates everywhere. */

export const CONTACT = {
  /* Shown to visitors */
  phoneDisplay: '+92 335 8076339',
  /* Used in tel: links — digits and a leading +, nothing else */
  phoneHref: '+923358076339',
  /* Used in wa.me links — digits only, country code first, no + or spaces */
  whatsapp: '923358076339',
  /* Leave empty until a real inbox exists — the email link, footer entry,
     contact card, JSON-LD property and mail fallback all disappear. */
  email: '',
  /* Optional street address; leave empty to omit it from the footer */
  address: '',
  areaLine: 'Serving students in the USA, UK, Canada, Australia &amp; Europe',
};

/* Leave a url empty to drop that icon from the footer entirely. */
export const SOCIAL = [
  { name: 'WhatsApp', url: `https://wa.me/${CONTACT.whatsapp}`, path: 'M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2m0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20m4.4-5.8c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5.2-.4v-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3A3 3 0 0 0 7.3 10a5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4 7.6 7.6 0 0 0 1.5.5 3.6 3.6 0 0 0 1.7.1 2.8 2.8 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3z' },
  { name: 'Facebook', url: '', path: 'M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.6A21 21 0 0 0 14.3 3.5c-2.4 0-4 1.45-4 4.12V9.9H7.6V13h2.7v8z' },
  { name: 'Instagram', url: '', path: 'M12 2.2c3.2 0 3.6 0 4.9.1 1.2 0 1.8.2 2.2.4.6.2 1 .5 1.4.9s.7.8.9 1.4c.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.2 1.8-.4 2.2a3.9 3.9 0 0 1-2.3 2.3c-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.2-2.2-.4a3.9 3.9 0 0 1-2.3-2.3c-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4s.8-.7 1.4-.9c.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.8-.1m0 3.8a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 9.9a3.9 3.9 0 1 1 0-7.8 3.9 3.9 0 0 1 0 7.8m7.6-10.1a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 0 1 2.8 0' },
  { name: 'YouTube', url: '', path: 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8M10 15V9l5.2 3z' },
  { name: 'TikTok', url: '', path: 'M16.6 5.8a4.3 4.3 0 0 1-1-2.8h-3.1v11.6a2.6 2.6 0 1 1-1.9-2.5V8.9a5.7 5.7 0 1 0 5 5.6V8.9a7.3 7.3 0 0 0 4.3 1.4V7.2a4.3 4.3 0 0 1-3.3-1.4' },
];

/* The free-trial promise. It appears in about two dozen places across the
   pages, the JSON-LD and the plan features, so it lives here. */
export const TRIAL = {
  days: 5,
  classes: 5,
  word: 'five',
  Word: 'Five',
};
