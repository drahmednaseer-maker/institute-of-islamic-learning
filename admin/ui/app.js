/* Admin UI — vanilla, no build step. */
const $ = (s, c = document) => c.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) n.append(kid.nodeType ? kid : String(kid));
  return n;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) { showLogin(); throw new Error('Not signed in'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg) {
  const t = el('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}
async function copy(text, label = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(label); }
  catch {
    const ta = el('textarea', { style: 'position:fixed;opacity:0' }); ta.value = text;
    document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast(label);
  }
}
const money = (n, c) => {
  const sym = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', PKR: 'Rs', SAR: 'SAR ', AED: 'AED ' }[c] || `${c} `;
  const v = Number(n || 0);
  /* the sign belongs outside the symbol: -$30.00, not $-30.00 */
  return `${v < 0 ? '-' : ''}${sym}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const dt = (v) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const chip = (v) => el('span', { class: `chip chip--${v}` }, v);
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

/* ---------------- drawer ---------------- */
function drawer(title, build) {
  const panel = el('div', { class: 'drawer__panel' });
  const wrap = el('div', { class: 'drawer', onclick: (e) => { if (e.target === wrap) close(); } }, panel);
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  panel.append(el('div', { class: 'drawer__head' },
    el('h2', {}, title),
    el('button', { class: 'x', onclick: close, 'aria-label': 'Close' }, '✕')));
  const body = el('div');
  panel.append(body);
  build(body, close);
  document.body.append(wrap);
  document.addEventListener('keydown', onKey);
  return { close, body };
}

/* ---------------- views ---------------- */
const VIEWS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'leads', label: 'Enquiries', badge: 'newLeads' },
  { id: 'tutors', label: 'Tutors' },
  { id: 'invoices', label: 'Invoices', badge: 'unpaid' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'pnl', label: 'Profit & Loss' },
  { id: 'settings', label: 'Settings' },
];
let summary = {};

function renderNav(active) {
  const nav = $('#nav');
  nav.replaceChildren(...VIEWS.map((v) => {
    const n = Number(summary[v.badge] || 0);
    return el('button', {
      class: `nav-btn${v.id === active ? ' on' : ''}`,
      onclick: () => { location.hash = v.id; },
    }, v.label, v.badge && n ? el('span', { class: 'pill' }, n) : null);
  }));
}

function head(title, subtitle, ...actions) {
  return el('div', { class: 'head' },
    el('div', {}, el('h1', {}, title), subtitle ? el('p', {}, subtitle) : null),
    actions.length ? el('div', { class: 'row' }, ...actions) : null);
}

/* ---------------- dashboard ---------------- */
async function viewDashboard(view) {
  const s = await api('/summary');
  summary = s; renderNav('dashboard');
  const pnl = await api(`/report/pnl?month=${s.month}`);
  view.replaceChildren(
    head('Dashboard', `Month of ${new Date(`${s.month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`),
    el('div', { class: 'stats' },
      stat(s.newLeads, 'New enquiries'),
      stat(s.leadsThisMonth, 'Enquiries this month'),
      stat(s.tutors, 'Active tutors'),
      stat(s.unpaid, 'Unpaid invoices'),
      stat(money(pnl.incomeBase, pnl.base), 'Income this month'),
      stat(money(pnl.expenseBase, pnl.base), 'Expenses this month'),
      stat(money(pnl.net, pnl.base), pnl.net >= 0 ? 'Profit this month' : 'Loss this month')),
    el('div', { class: 'card card--pad' },
      el('h3', { class: 'muted', style: 'margin-bottom:.6rem' }, 'Quick actions'),
      el('div', { class: 'row' },
        el('button', { class: 'btn btn--gold', onclick: () => { location.hash = 'leads'; setTimeout(newLeadForm, 60); } }, 'Add enquiry'),
        el('button', { class: 'btn btn--green', onclick: () => { location.hash = 'invoices'; setTimeout(() => invoiceForm(), 60); } }, 'New invoice'),
        el('button', { class: 'btn btn--ghost', onclick: () => { location.hash = 'expenses'; setTimeout(expenseForm, 60); } }, 'Record expense'),
        el('button', { class: 'btn btn--ghost', onclick: () => { location.hash = 'tutors'; setTimeout(tutorForm, 60); } }, 'Register tutor'))),
  );
}
const stat = (v, label) => el('div', { class: 'stat' }, el('b', {}, v), el('span', {}, label));

/* ---------------- leads ---------------- */
let leadFilter = 'all', leadQuery = '';
async function viewLeads(view) {
  const { leads, counts } = await api(`/leads?status=${leadFilter}&q=${encodeURIComponent(leadQuery)}`);
  const { tutors } = await api('/tutors');
  const total = counts.reduce((s, c) => s + c.n, 0);
  const countFor = (s) => (counts.find((c) => c.status === s) || { n: 0 }).n;

  const search = el('input', { type: 'search', placeholder: 'Search name, phone, course…', value: leadQuery, style: 'max-width:260px' });
  search.addEventListener('input', debounce(() => { leadQuery = search.value; viewLeads(view); }, 300));

  view.replaceChildren(
    head('Enquiries', `${total} total · every website booking lands here`,
      search,
      el('button', { class: 'btn btn--gold', onclick: newLeadForm }, 'Add manually')),
    el('div', { class: 'filters' }, ...['all', 'new', 'contacted', 'trial', 'enrolled', 'lost'].map((s) =>
      el('button', { class: leadFilter === s ? 'on' : '', onclick: () => { leadFilter = s; viewLeads(view); } },
        `${s[0].toUpperCase()}${s.slice(1)}${s === 'all' ? '' : ` (${countFor(s)})`}`))),
    leads.length
      ? el('div', { class: 'card scroll' }, el('table', { class: 'tbl' },
          el('thead', {}, el('tr', {}, ...['Student', 'Course', 'Schedule', 'Tutor', 'Status', 'Received'].map((h) => el('th', {}, h)))),
          el('tbody', {}, ...leads.map((l) => el('tr', { onclick: () => leadDrawer(l.id, tutors, view) },
            el('td', {}, el('b', {}, l.name), el('div', { class: 'muted' }, [l.phone, l.country].filter(Boolean).join(' · '))),
            el('td', {}, l.course || '—'),
            el('td', {}, el('div', {}, l.days || '—'), el('div', { class: 'muted' }, l.preferred_time || '')),
            el('td', {}, l.tutor_name || el('span', { class: 'muted' }, 'Unassigned')),
            el('td', {}, chip(l.status)),
            el('td', { class: 'muted' }, dt(l.created_at)))))))
      : el('div', { class: 'card empty' }, 'No enquiries yet. Website bookings appear here automatically once the site is pointed at this backend.'),
  );
}

async function leadDrawer(id, tutors, view) {
  const share = await api(`/leads/${id}/share`);
  const { leads } = await api(`/leads?status=all&q=`);
  const lead = leads.find((l) => l.id === id);
  drawer(lead.name, (body, close) => {
    const status = el('select', {}, ...['new', 'contacted', 'trial', 'enrolled', 'lost'].map((s) =>
      el('option', { value: s, selected: s === lead.status || null }, s)));
    const tutorSel = el('select', {}, el('option', { value: '' }, 'Unassigned'),
      ...tutors.map((t) => el('option', { value: t.id, selected: t.id === lead.tutor_id || null }, `${t.name} · ${t.phone}`)));
    const save = async () => {
      await api(`/leads/${id}`, { method: 'PATCH', body: { status: status.value, tutor_id: tutorSel.value || null } });
      toast('Saved'); close(); viewLeads(view);
    };
    status.addEventListener('change', save);
    tutorSel.addEventListener('change', save);

    body.append(
      el('div', { class: 'fields' },
        el('label', { class: 'f' }, el('span', {}, 'Status'), status),
        el('label', { class: 'f' }, el('span', {}, 'Assigned tutor'), tutorSel)),
      el('dl', { class: 'kv' },
        ...[['Course', lead.course], ['Level', lead.student], ['Schedule', lead.days], ['Preferred time', lead.preferred_time],
          ['Country', lead.country], ['Phone', lead.phone], ['Email', lead.email], ['Source', lead.source], ['Notes', lead.notes]]
          .filter(([, v]) => v).flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])),

      el('div', { class: 'sec' },
        el('h3', {}, 'Share with a tutor'),
        el('p', { class: 'muted' }, 'This is exactly what will be sent — WhatsApp shows the bold headings.'),
        el('pre', { class: 'preview' }, share.whatsapp),
        el('div', { class: 'row' },
          share.waTutor ? el('a', { class: 'btn btn--wa', href: share.waTutor, target: '_blank', rel: 'noopener' }, 'Send to assigned tutor') : null,
          el('a', { class: 'btn btn--ghost', href: share.waOpen, target: '_blank', rel: 'noopener' }, 'Open WhatsApp…'),
          el('button', { class: 'btn btn--ghost', onclick: () => copy(share.whatsapp, 'Copied with WhatsApp formatting') }, 'Copy for WhatsApp'),
          el('button', { class: 'btn btn--ghost', onclick: () => copy(share.plain, 'Copied as plain text') }, 'Copy plain text'),
          el('button', { class: 'btn btn--ghost', onclick: () => copy(share.oneLine, 'Copied one-line summary') }, 'Copy one line'))),

      el('div', { class: 'sec' },
        el('h3', {}, 'Contact the student'),
        el('div', { class: 'row' },
          share.waStudent ? el('a', { class: 'btn btn--wa', href: share.waStudent, target: '_blank', rel: 'noopener' }, 'WhatsApp student') : null,
          lead.phone ? el('a', { class: 'btn btn--ghost', href: `tel:${lead.phone}` }, 'Call') : null,
          lead.email ? el('a', { class: 'btn btn--ghost', href: `mailto:${lead.email}` }, 'Email') : null)),

      el('div', { class: 'sec' },
        el('button', {
          class: 'btn btn--danger btn--sm',
          onclick: async () => { if (confirm(`Delete the enquiry from ${lead.name}?`)) { await api(`/leads/${id}`, { method: 'DELETE' }); close(); viewLeads(view); } },
        }, 'Delete enquiry')),
    );
  });
}

function newLeadForm() {
  drawer('Add enquiry', (body, close) => {
    const f = formFields([
      ['name', 'Student name', 'text', true], ['phone', 'Phone / WhatsApp'], ['email', 'Email', 'email'],
      ['country', 'Country'], ['course', 'Course'], ['student', 'Level'],
      ['days', 'Classes per week'], ['time', 'Preferred time'],
    ]);
    const notes = el('textarea', { placeholder: 'Notes' });
    body.append(el('div', { class: 'fields' }, ...f.nodes), el('label', { class: 'f', style: 'margin-top:.7rem' }, el('span', {}, 'Notes'), notes),
      el('div', { class: 'row', style: 'margin-top:.9rem' },
        el('button', { class: 'btn btn--gold', onclick: async () => {
          const data = { ...f.values(), notes: notes.value, source: 'manual' };
          if (!data.name) return toast('Name is required');
          await api('/leads', { method: 'POST', body: data });
          close(); toast('Enquiry added'); viewLeads($('#view'));
        } }, 'Save enquiry')));
  });
}

function formFields(defs, values = {}) {
  const nodes = [], inputs = {};
  for (const [key, label, type = 'text', required = false] of defs) {
    const input = el('input', { type, value: values[key] ?? '', required: required || null });
    inputs[key] = input;
    nodes.push(el('label', { class: 'f' }, el('span', {}, label), input));
  }
  return { nodes, inputs, values: () => Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim()])) };
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ---------------- tutors ---------------- */
async function viewTutors(view) {
  const { tutors } = await api('/tutors');
  view.replaceChildren(
    head('Tutors', `${tutors.length} registered`, el('button', { class: 'btn btn--gold', onclick: () => tutorForm() }, 'Register tutor')),
    tutors.length
      ? el('div', { class: 'card scroll' }, el('table', { class: 'tbl' },
          el('thead', {}, el('tr', {}, ...['Name', 'Phone', 'Subjects', 'Languages', 'Timezone', 'Status'].map((h) => el('th', {}, h)))),
          el('tbody', {}, ...tutors.map((t) => el('tr', { onclick: () => tutorForm(t) },
            el('td', {}, el('b', {}, t.name), t.gender ? el('div', { class: 'muted' }, t.gender) : null),
            el('td', {}, t.phone),
            el('td', {}, t.subjects || '—'),
            el('td', {}, t.languages || '—'),
            el('td', {}, t.timezone || '—'),
            el('td', {}, chip(t.status)))))))
      : el('div', { class: 'card empty' }, 'No tutors yet. Register one with just a name and phone number.'),
  );
}

function tutorForm(t = null) {
  drawer(t ? t.name : 'Register tutor', (body, close) => {
    const f = formFields([
      ['name', 'Name', 'text', true], ['phone', 'Phone / WhatsApp', 'text', true], ['email', 'Email', 'email'],
      ['subjects', 'Subjects'], ['languages', 'Languages'], ['timezone', 'Timezone'],
    ], t || {});
    const gender = el('select', {}, ...['', 'male', 'female'].map((g) => el('option', { value: g, selected: t && t.gender === g || null }, g || '—')));
    const status = el('select', {}, ...['active', 'paused'].map((s) => el('option', { value: s, selected: t && t.status === s || null }, s)));
    const rate = el('input', { type: 'number', step: '0.01', value: t?.rate ?? '' });
    const cur = el('input', { value: t?.rate_currency ?? 'PKR' });
    const notes = el('textarea', {}, t?.notes || '');

    body.append(
      el('p', { class: 'muted' }, 'Only a name and phone number are required — everything else can wait.'),
      el('div', { class: 'fields', style: 'margin-top:.7rem' }, ...f.nodes,
        el('label', { class: 'f' }, el('span', {}, 'Gender'), gender),
        el('label', { class: 'f' }, el('span', {}, 'Status'), status),
        el('label', { class: 'f' }, el('span', {}, 'Pay rate / hour'), rate),
        el('label', { class: 'f' }, el('span', {}, 'Rate currency'), cur)),
      el('label', { class: 'f', style: 'margin-top:.7rem' }, el('span', {}, 'Notes'), notes),
      el('div', { class: 'row', style: 'margin-top:.9rem' },
        el('button', { class: 'btn btn--gold', onclick: async () => {
          const data = { ...f.values(), gender: gender.value, status: status.value, rate: rate.value || 0, rate_currency: cur.value, notes: notes.value };
          if (!data.name || !data.phone) return toast('Name and phone are required');
          if (t) await api(`/tutors/${t.id}`, { method: 'PATCH', body: data });
          else await api('/tutors', { method: 'POST', body: data });
          close(); toast(t ? 'Tutor updated' : 'Tutor registered'); viewTutors($('#view'));
        } }, t ? 'Save changes' : 'Register tutor'),
        t ? el('a', { class: 'btn btn--wa', href: `https://wa.me/${String(t.phone).replace(/\D/g, '')}`, target: '_blank', rel: 'noopener' }, 'WhatsApp') : null,
        t ? el('button', { class: 'btn btn--danger btn--sm', onclick: async () => {
          if (confirm(`Remove ${t.name}?`)) { await api(`/tutors/${t.id}`, { method: 'DELETE' }); close(); viewTutors($('#view')); }
        } }, 'Remove') : null));
  });
}

/* ---------------- invoices ---------------- */
let invFilter = 'all';
async function viewInvoices(view) {
  const { invoices, nextNumber } = await api(`/invoices?status=${invFilter}`);
  view.replaceChildren(
    head('Invoices', `Next number ${nextNumber}`, el('button', { class: 'btn btn--gold', onclick: () => invoiceForm() }, 'New invoice')),
    el('div', { class: 'filters' }, ...['all', 'draft', 'sent', 'paid'].map((s) =>
      el('button', { class: invFilter === s ? 'on' : '', onclick: () => { invFilter = s; viewInvoices(view); } }, s[0].toUpperCase() + s.slice(1)))),
    invoices.length
      ? el('div', { class: 'card scroll' }, el('table', { class: 'tbl' },
          el('thead', {}, el('tr', {}, ...['Number', 'Client', 'Issued', 'Due', 'Status', 'Total'].map((h) => el('th', { class: h === 'Total' ? 'num' : '' }, h)))),
          el('tbody', {}, ...invoices.map((i) => el('tr', { onclick: () => invoiceForm(i.id) },
            el('td', {}, el('b', {}, i.number)),
            el('td', {}, i.client_name, el('div', { class: 'muted' }, i.client_phone || '')),
            el('td', { class: 'muted' }, dt(i.issue_date)),
            el('td', { class: 'muted' }, dt(i.due_date)),
            el('td', {}, chip(i.status)),
            el('td', { class: 'num' }, money(i.totals.total, i.currency)))))))
      : el('div', { class: 'card empty' }, 'No invoices yet.'),
  );
}

async function invoiceForm(id = null) {
  const existing = id ? await api(`/invoices/${id}`) : null;
  const settings = await api('/settings');
  drawer(existing ? `Invoice ${existing.number}` : 'New invoice', (body, close) => {
    const f = formFields([
      ['client_name', 'Client name', 'text', true], ['client_phone', 'Client phone'], ['client_email', 'Client email', 'email'],
    ], existing || {});
    const currency = el('select', {}, ...['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'PKR', 'SAR', 'AED'].map((c) =>
      el('option', { value: c, selected: (existing?.currency || 'USD') === c || null }, c)));
    const issue = el('input', { type: 'date', value: existing?.issue_date || today() });
    const due = el('input', { type: 'date', value: existing?.due_date || '' });
    const status = el('select', {}, ...['draft', 'sent', 'paid'].map((s) => el('option', { value: s, selected: existing?.status === s || null }, s)));
    const discount = el('input', { type: 'number', step: '0.01', value: existing?.discount ?? 0 });
    const notes = el('textarea', { placeholder: 'Anything to add on the invoice' }, existing?.notes || '');

    const itemsWrap = el('div', { class: 'items' });
    const totalOut = el('b', {}, '—');
    const rows = [];
    const recalc = () => {
      let sub = 0;
      for (const r of rows) {
        const amt = Number(r.qty.value || 0) * Number(r.rate.value || 0);
        r.amount.textContent = money(amt, currency.value);
        sub += amt;
      }
      totalOut.textContent = money(Math.max(0, sub - Number(discount.value || 0)), currency.value);
    };
    const addRow = (it = {}) => {
      const desc = el('input', { value: it.description || '', placeholder: 'e.g. Quran Reading — September' });
      const qty = el('input', { type: 'number', step: '0.5', value: it.qty ?? 1 });
      const rate = el('input', { type: 'number', step: '0.01', value: it.rate ?? 0 });
      const amount = el('div', { class: 'num' }, '—');
      const row = { desc, qty, rate, amount };
      const node = el('div', { class: 'item' }, desc, qty, rate, amount,
        el('button', { class: 'x', title: 'Remove line', onclick: () => { node.remove(); rows.splice(rows.indexOf(row), 1); recalc(); } }, '✕'));
      [qty, rate].forEach((i) => i.addEventListener('input', recalc));
      rows.push(row); itemsWrap.append(node); recalc();
    };

    const plan = {
      region: el('select', {}, ...[['us', 'United States'], ['uk', 'United Kingdom'], ['eu', 'Europe'], ['ca', 'Canada'], ['au', 'Australia']]
        .map(([v, l]) => el('option', { value: v }, l))),
      duration: el('select', {}, ...['30', '45', '60'].map((d) => el('option', { value: d }, `${d} min`))),
      per: el('select', {}, ...['2', '3', '4', '5'].map((p) => el('option', { value: p, selected: p === '4' || null }, `${p} / week`))),
      course: el('input', { placeholder: 'Course', value: 'Quran Reading' }),
    };

    body.append(
      el('div', { class: 'fields' }, ...f.nodes,
        el('label', { class: 'f' }, el('span', {}, 'Currency'), currency),
        el('label', { class: 'f' }, el('span', {}, 'Issue date'), issue),
        el('label', { class: 'f' }, el('span', {}, 'Due date'), due),
        el('label', { class: 'f' }, el('span', {}, 'Status'), status),
        el('label', { class: 'f' }, el('span', {}, 'Discount'), discount)),

      el('div', { class: 'sec' },
        el('h3', {}, 'Build a line from your published rates'),
        el('div', { class: 'fields' },
          el('label', { class: 'f' }, el('span', {}, 'Region'), plan.region),
          el('label', { class: 'f' }, el('span', {}, 'Class length'), plan.duration),
          el('label', { class: 'f' }, el('span', {}, 'Classes'), plan.per),
          el('label', { class: 'f' }, el('span', {}, 'Course'), plan.course)),
        el('button', { class: 'btn btn--ghost btn--sm', style: 'margin-top:.5rem', onclick: async () => {
          const r = await api('/invoices/from-plan', { method: 'POST', body: {
            region: plan.region.value, duration: plan.duration.value, perweek: plan.per.value, course: plan.course.value } });
          currency.value = r.currency;
          r.items.forEach(addRow); recalc(); toast(r.hint);
        } }, 'Add priced line')),

      el('div', { class: 'sec' },
        el('h3', {}, 'Items'),
        el('div', { class: 'item item-head' }, el('div', {}, 'Description'), el('div', {}, 'Qty'), el('div', {}, 'Rate'), el('div', { class: 'num' }, 'Amount'), el('div')),
        itemsWrap,
        el('button', { class: 'btn btn--ghost btn--sm', style: 'margin-top:.5rem', onclick: () => addRow() }, '+ Add line'),
        el('div', { class: 'row', style: 'justify-content:flex-end;margin-top:.7rem;font-size:1.05rem' }, 'Total: ', totalOut)),

      el('label', { class: 'f', style: 'margin-top:.9rem' }, el('span', {}, 'Notes'), notes),

      el('div', { class: 'row', style: 'margin-top:1rem' },
        el('button', { class: 'btn btn--gold', onclick: async () => {
          const payload = {
            ...f.values(), currency: currency.value, issue_date: issue.value, due_date: due.value,
            status: status.value, discount: Number(discount.value || 0), notes: notes.value,
            items: rows.map((r) => ({ description: r.desc.value, qty: Number(r.qty.value || 0), rate: Number(r.rate.value || 0) })),
          };
          if (!payload.client_name) return toast('Client name is required');
          const saved = existing ? await api(`/invoices/${id}`, { method: 'PATCH', body: payload }) : await api('/invoices', { method: 'POST', body: payload });
          close(); toast(`Invoice ${saved.number} saved`); viewInvoices($('#view'));
          if (!existing) setTimeout(() => invoiceForm(saved.id), 120);
        } }, existing ? 'Save invoice' : 'Create invoice'),
        existing ? el('button', { class: 'btn btn--green', onclick: async () => {
          const share = await api(`/invoices/${id}/share`);
          shareSheet(`Invoice ${existing.number}`, share, share.wa);
        } }, 'Share') : null,
        existing ? el('button', { class: 'btn btn--danger btn--sm', onclick: async () => {
          if (confirm(`Delete invoice ${existing.number}?`)) { await api(`/invoices/${id}`, { method: 'DELETE' }); close(); viewInvoices($('#view')); }
        } }, 'Delete') : null),
      el('p', { class: 'muted', style: 'margin-top:.6rem' }, settings.invoice_terms || ''),
    );

    (existing?.items || []).forEach(addRow);
    if (!rows.length) addRow();
    currency.addEventListener('change', recalc);
    discount.addEventListener('input', recalc);
    recalc();
  });
}

function shareSheet(title, share, primaryWa) {
  drawer(title, (body) => {
    body.append(
      el('p', { class: 'muted' }, 'Exactly what the client or tutor will receive.'),
      el('pre', { class: 'preview' }, share.whatsapp),
      el('div', { class: 'row' },
        primaryWa ? el('a', { class: 'btn btn--wa', href: primaryWa, target: '_blank', rel: 'noopener' }, 'Send on WhatsApp') : null,
        share.waOpen ? el('a', { class: 'btn btn--ghost', href: share.waOpen, target: '_blank', rel: 'noopener' }, 'Open WhatsApp…') : null,
        el('button', { class: 'btn btn--ghost', onclick: () => copy(share.whatsapp, 'Copied with WhatsApp formatting') }, 'Copy for WhatsApp'),
        el('button', { class: 'btn btn--ghost', onclick: () => copy(share.plain, 'Copied as plain text') }, 'Copy plain text'),
        el('button', { class: 'btn btn--ghost', onclick: () => window.print() }, 'Print / PDF')));
  });
}

/* ---------------- expenses ---------------- */
let expMonth = thisMonth();
async function viewExpenses(view) {
  const { expenses, heads } = await api(`/expenses?month=${expMonth}`);
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byHead = {};
  for (const e of expenses) byHead[e.head] = (byHead[e.head] || 0) + Number(e.amount);
  const monthInput = el('input', { type: 'month', value: expMonth, style: 'max-width:170px' });
  monthInput.addEventListener('change', () => { expMonth = monthInput.value || thisMonth(); viewExpenses(view); });

  view.replaceChildren(
    head('Expenses', `${expenses.length} entries this month`, monthInput,
      el('button', { class: 'btn btn--gold', onclick: () => expenseForm(heads) }, 'Record expense')),
    el('div', { class: 'stats' }, ...Object.entries(byHead).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([h, v]) => stat(v.toLocaleString('en-US', { maximumFractionDigits: 0 }), h))),
    expenses.length
      ? el('div', { class: 'card scroll' }, el('table', { class: 'tbl' },
          el('thead', {}, el('tr', {}, ...['Date', 'Head', 'Description', 'Tutor', 'Amount'].map((h) => el('th', { class: h === 'Amount' ? 'num' : '' }, h)))),
          el('tbody', {}, ...expenses.map((e) => el('tr', { onclick: () => expenseForm(heads, e) },
            el('td', { class: 'muted' }, dt(e.date)),
            el('td', {}, el('b', {}, e.head)),
            el('td', {}, e.description || '—'),
            el('td', { class: 'muted' }, e.tutor_name || '—'),
            el('td', { class: 'num' }, money(e.amount, e.currency)))))))
      : el('div', { class: 'card empty' }, 'No expenses recorded for this month.'),
  );
}

async function expenseForm(heads = null, e = null) {
  if (!heads) ({ heads } = await api(`/expenses?month=${expMonth}`));
  const { tutors } = await api('/tutors');
  const settings = await api('/settings');
  drawer(e ? 'Edit expense' : 'Record expense', (body, close) => {
    const date = el('input', { type: 'date', value: e?.date || today() });
    const head_ = el('select', {}, ...heads.map((h) => el('option', { value: h, selected: e?.head === h || null }, h)));
    const desc = el('input', { value: e?.description || '', placeholder: 'What was it for?' });
    const amount = el('input', { type: 'number', step: '0.01', value: e?.amount ?? '', placeholder: '0.00' });
    const cur = el('select', {}, ...['PKR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'SAR', 'AED'].map((c) =>
      el('option', { value: c, selected: (e?.currency || settings.base_currency) === c || null }, c)));
    const tutor = el('select', {}, el('option', { value: '' }, '—'),
      ...tutors.map((t) => el('option', { value: t.id, selected: e?.tutor_id === t.id || null }, t.name)));

    body.append(
      el('div', { class: 'fields' },
        el('label', { class: 'f' }, el('span', {}, 'Date'), date),
        el('label', { class: 'f' }, el('span', {}, 'Head'), head_),
        el('label', { class: 'f' }, el('span', {}, 'Amount'), amount),
        el('label', { class: 'f' }, el('span', {}, 'Currency'), cur),
        el('label', { class: 'f' }, el('span', {}, 'Tutor (for payouts)'), tutor)),
      el('label', { class: 'f', style: 'margin-top:.7rem' }, el('span', {}, 'Description'), desc),
      el('p', { class: 'muted', style: 'margin-top:.5rem' }, 'Heads are editable under Settings.'),
      el('div', { class: 'row', style: 'margin-top:.9rem' },
        el('button', { class: 'btn btn--gold', onclick: async () => {
          const data = { date: date.value, head: head_.value, description: desc.value, amount: Number(amount.value || 0), currency: cur.value, tutor_id: tutor.value || null };
          if (!(data.amount > 0)) return toast('Enter an amount greater than zero');
          if (e) await api(`/expenses/${e.id}`, { method: 'PATCH', body: data });
          else await api('/expenses', { method: 'POST', body: data });
          close(); toast('Saved'); viewExpenses($('#view'));
        } }, 'Save'),
        e ? el('button', { class: 'btn btn--danger btn--sm', onclick: async () => {
          if (confirm('Delete this expense?')) { await api(`/expenses/${e.id}`, { method: 'DELETE' }); close(); viewExpenses($('#view')); }
        } }, 'Delete') : null));
  });
}

/* ---------------- profit & loss ---------------- */
let pnlMonth = thisMonth();
async function viewPnl(view) {
  const r = await api(`/report/pnl?month=${pnlMonth}`);
  const monthInput = el('input', { type: 'month', value: pnlMonth, style: 'max-width:170px' });
  monthInput.addEventListener('change', () => { pnlMonth = monthInput.value || thisMonth(); viewPnl(view); });
  const max = Math.max(1, ...r.expensesByHead.map((h) => h.base));

  view.replaceChildren(
    head('Profit & Loss', `Converted to ${r.base} using your rates`, monthInput,
      el('button', { class: 'btn btn--ghost', onclick: () => window.print() }, 'Print')),
    r.missingRates.length
      ? el('div', { class: 'warn' }, `No exchange rate set for ${r.missingRates.join(', ')} — those amounts are listed but not included in the ${r.base} totals. Add rates under Settings.`)
      : null,
    el('div', { class: 'pnl' },
      stat(money(r.incomeBase, r.base), `Income · ${r.paidCount} paid invoice${r.paidCount === 1 ? '' : 's'}`),
      stat(money(r.expenseBase, r.base), 'Expenses'),
      stat(money(r.net, r.base), r.net >= 0 ? 'Net profit' : 'Net loss')),
    el('div', { class: 'card card--pad' },
      el('h3', { style: 'font-size:.95rem;margin-bottom:.7rem' }, 'Expenses by head'),
      r.expensesByHead.length
        ? el('div', {}, ...r.expensesByHead.map((h) => el('div', { style: 'margin-bottom:.7rem' },
            el('div', { class: 'row', style: 'justify-content:space-between' },
              el('span', {}, h.head),
              el('b', {}, money(h.base, r.base))),
            el('div', { class: 'bar' }, el('i', { style: `width:${Math.round((h.base / max) * 100)}%` })),
            el('div', { class: 'muted', style: 'font-size:.76rem;margin-top:.15rem' },
              Object.entries(h.currencies).map(([c, v]) => money(v, c)).join(' · ')))))
        : el('p', { class: 'muted' }, 'No expenses this month.')),
    Object.keys(r.income).length
      ? el('div', { class: 'card card--pad', style: 'margin-top:.9rem' },
          el('h3', { style: 'font-size:.95rem;margin-bottom:.5rem' }, 'Income by currency'),
          ...Object.entries(r.income).map(([c, v]) => el('div', { class: 'row', style: 'justify-content:space-between' },
            el('span', {}, c), el('b', {}, money(v, c)))))
      : null,
  );
}

/* ---------------- settings ---------------- */
async function viewSettings(view) {
  const s = await api('/settings');
  const f = formFields([
    ['org_name', 'Institute name'], ['org_phone', 'Phone'], ['org_email', 'Email'], ['invoice_prefix', 'Invoice prefix'],
    ['base_currency', 'Base currency for P&L'],
  ], s);
  const heads = el('textarea', {}, s.expense_heads || '');
  const terms = el('textarea', {}, s.invoice_terms || '');
  const rates = el('textarea', {}, s.fx_rates || '{}');
  const pass = el('input', { type: 'password', placeholder: 'Leave blank to keep current', autocomplete: 'new-password' });

  view.replaceChildren(
    head('Settings'),
    el('div', { class: 'card card--pad' },
      el('div', { class: 'fields' }, ...f.nodes),
      el('label', { class: 'f', style: 'margin-top:.8rem' }, el('span', {}, 'Expense heads (comma separated)'), heads),
      el('label', { class: 'f', style: 'margin-top:.8rem' }, el('span', {}, 'Invoice terms'), terms),
      el('label', { class: 'f', style: 'margin-top:.8rem' },
        el('span', {}, `Exchange rates into ${s.base_currency} — JSON, e.g. {"PKR":1,"USD":280}`), rates),
      el('label', { class: 'f', style: 'margin-top:.8rem' }, el('span', {}, 'New admin password'), pass),
      el('div', { class: 'row', style: 'margin-top:1rem' },
        el('button', { class: 'btn btn--gold', onclick: async () => {
          try { JSON.parse(rates.value || '{}'); } catch { return toast('Exchange rates must be valid JSON'); }
          const body = { ...f.values(), expense_heads: heads.value, invoice_terms: terms.value, fx_rates: rates.value };
          if (pass.value) body.new_password = pass.value;
          await api('/settings', { method: 'PATCH', body });
          toast('Settings saved'); pass.value = '';
        } }, 'Save settings'))),
  );
}

/* ---------------- router ---------------- */
const RENDER = { dashboard: viewDashboard, leads: viewLeads, tutors: viewTutors, invoices: viewInvoices, expenses: viewExpenses, pnl: viewPnl, settings: viewSettings };

async function route() {
  document.querySelectorAll('.drawer').forEach((d) => d.remove());   /* never leave one open across views */
  const id = (location.hash.slice(1) || 'dashboard');
  const fn = RENDER[id] || viewDashboard;
  renderNav(id);
  const view = $('#view');
  view.replaceChildren(el('p', { class: 'muted' }, 'Loading…'));
  try {
    if (id !== 'dashboard') { try { summary = await api('/summary'); renderNav(id); } catch {} }
    await fn(view);
  } catch (err) {
    view.replaceChildren(el('div', { class: 'card empty' }, err.message));
  }
}

function showLogin() { $('#login').classList.remove('hide'); $('#app').classList.add('hide'); }
function showApp() { $('#login').classList.add('hide'); $('#app').classList.remove('hide'); route(); }

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#loginErr'); err.textContent = '';
  try {
    await api('/login', { method: 'POST', body: { password: e.target.password.value } });
    showApp();
  } catch (ex) { err.textContent = ex.message; }
});
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-logout]')) { await api('/logout', { method: 'POST' }); location.hash = ''; showLogin(); }
});
window.addEventListener('hashchange', route);

(async () => {
  const { authed } = await api('/session');
  authed ? showApp() : showLogin();
})();
