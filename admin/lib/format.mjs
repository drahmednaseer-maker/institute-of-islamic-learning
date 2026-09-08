/* Text builders for sharing records over WhatsApp or pasting anywhere else.
   WhatsApp renders *bold* and _italic_ but has no tables and a proportional
   font, so nothing here relies on column alignment. */

/* Short, human-quotable reference — no underscores, which would otherwise
   open an italic run inside WhatsApp's markup. */
export const refOf = (id) => String(id).replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();

const SYMBOLS = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', PKR: 'Rs', SAR: 'SAR ', AED: 'AED ' };
export const symbolFor = (code) => SYMBOLS[code] || `${code} `;

export function money(amount, currency = 'USD') {
  const n = Number(amount || 0);
  /* the sign belongs outside the symbol: -$30.00, not $-30.00 */
  const body = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '-' : ''}${symbolFor(currency)}${body}`;
}

export function prettyDate(value) {
  if (!value) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function prettyDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${prettyDate(value)}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/* Drops empty values so a share never contains "Email: —". */
const block = (title, rows) => {
  const kept = rows.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');
  if (!kept.length) return null;
  return [title ? `*${title}*` : null, ...kept.map(([k, v]) => (k ? `${k}: ${v}` : String(v)))]
    .filter(Boolean)
    .join('\n');
};

const join = (parts) => parts.filter(Boolean).join('\n\n');
const stripMarkup = (s) => s.replace(/\*(.+?)\*/g, '$1').replace(/_(.+?)_/g, '$1');

/* ---------------- leads ---------------- */
export function formatLead(lead, { tutor = null, orgName = 'Institute of Islamic Learning' } = {}) {
  const whatsapp = join([
    `*New trial enquiry — ${orgName}*`,
    block('Student', [
      ['Name', lead.name],
      ['Level', lead.student],
      ['Course', lead.course],
    ]),
    block('Schedule', [
      ['Classes', lead.days],
      ['Preferred time', lead.preferred_time],
      ['Country', lead.country],
    ]),
    block('Contact', [
      ['Phone', lead.phone],
      ['Email', lead.email],
    ]),
    lead.notes ? block('Notes', [[null, lead.notes]]) : null,
    tutor ? block('Assigned tutor', [['Tutor', tutor.name], ['Tutor phone', tutor.phone]]) : null,
    `_Received ${prettyDateTime(lead.created_at)} · Ref ${refOf(lead.id)}_`,
  ]);
  return { whatsapp, plain: stripMarkup(whatsapp) };
}

/* A short line for pasting into a tutor group chat. */
export function formatLeadOneLine(lead) {
  return [lead.name, lead.course, lead.days, lead.preferred_time, lead.country, lead.phone]
    .filter((v) => v && String(v).trim())
    .join(' · ');
}

/* ---------------- invoices ---------------- */
export function formatInvoice(inv, { org = {} } = {}) {
  const c = inv.currency;
  const lines = inv.items.map((it, i) => {
    const qty = Number(it.qty);
    const amount = money(qty * Number(it.rate), c);
    const detail = qty === 1 ? '' : ` (${qty} × ${money(it.rate, c)})`;
    return `${i + 1}. ${it.description}${detail} — ${amount}`;
  });

  const totals = [
    ['Subtotal', money(inv.totals.subtotal, c)],
    inv.totals.discount ? ['Discount', `−${money(inv.totals.discount, c)}`] : null,
  ].filter(Boolean);

  const whatsapp = join([
    `*Invoice ${inv.number}*\n${org.org_name || 'Institute of Islamic Learning'}`,
    block('Billed to', [
      [null, inv.client_name],
      ['Phone', inv.client_phone],
      ['Email', inv.client_email],
    ]),
    block(null, [
      ['Issued', prettyDate(inv.issue_date)],
      ['Due', prettyDate(inv.due_date)],
      inv.status === 'paid' ? ['Paid', prettyDate(inv.paid_date)] : null,
    ].filter(Boolean)),
    lines.length ? `*Items*\n${lines.join('\n')}` : null,
    `${totals.map(([k, v]) => `${k}: ${v}`).join('\n')}\n*Total ${inv.status === 'paid' ? 'paid' : 'due'}: ${money(inv.totals.total, c)}*`,
    inv.notes || null,
    org.invoice_terms || null,
    org.org_phone ? `_${org.org_name || ''} · ${org.org_phone}_` : null,
  ]);
  return { whatsapp, plain: stripMarkup(whatsapp) };
}

/* ---------------- tutors ---------------- */
export function formatTutor(t) {
  const whatsapp = join([
    `*Tutor — ${t.name}*`,
    block(null, [
      ['Phone', t.phone],
      ['Email', t.email],
      ['Gender', t.gender],
      ['Subjects', t.subjects],
      ['Languages', t.languages],
      ['Timezone', t.timezone],
      ['Status', t.status],
    ]),
    t.notes || null,
  ]);
  return { whatsapp, plain: stripMarkup(whatsapp) };
}

/* wa.me needs the text percent-encoded and the number digits-only. */
export const waLink = (phone, text) => {
  const digits = String(phone || '').replace(/\D/g, '');
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
};
