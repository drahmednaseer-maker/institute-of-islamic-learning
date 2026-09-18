/* Admin UI — vanilla, no build step. */
const $ = (s, c = document) => c.querySelector(s);
const on = (node, ev, fn, opts) => node && node.addEventListener(ev, fn, opts);
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
  const data401 = res.status === 401;
  if (data401 && !path.startsWith('/recovery/reset') && !path.startsWith('/login')) { showLogin(); throw new Error('Not signed in'); }
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
const SYMBOLS = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$', PKR: 'Rs',
  SAR: 'SAR ', AED: 'AED ', QAR: 'QAR ', KWD: 'KWD ', OMR: 'OMR ', BHD: 'BHD ' };
/* the Gulf dinars and the Omani rial are quoted to three decimals */
const DECIMALS = { KWD: 3, OMR: 3, BHD: 3 };
const money = (n, c) => {
  const sym = SYMBOLS[c] || `${c} `;
  const v = Number(n || 0);
  const d = DECIMALS[c] ?? 2;
  /* the sign belongs outside the symbol: -$30.00, not $-30.00 */
  return `${v < 0 ? '-' : ''}${sym}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
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
  { id: 'courses', label: 'Courses' },
  { id: 'pricing', label: 'Fees & Plans' },
  { id: 'security', label: 'Password' },
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
const ICONS = {
  income: 'M12 2 3 7v10l9 5 9-5V7zm0 4.2 5.2 2.9L12 12l-5.2-2.9zM5 9.8l6 3.4v5.9l-6-3.3zm8 9.3v-5.9l6-3.4v6z',
  expense: 'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 4H4V6h16zm0 10H4v-6h16z',
  profit: 'M3.5 18.5l6-6 4 4L22 6.9 20.6 5.5l-7.1 8.1-4-4L2 17z',
  people: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10m0 2c-4.4 0-8 2.2-8 5v3h16v-3c0-2.8-3.6-5-8-5',
  inbox: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m0 12h-4a3 3 0 0 1-6 0H5V5h14z',
  calendar: 'M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m0 18H5V9h14z',
  invoice: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm-1 7V3.5L18.5 9zM8 13h8v2H8zm0 4h8v2H8z',
};
const icon = (name, cls = '') => el('span', { class: `tile__icon ${cls}`,
  html: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>` });

const tile = (name, value, label, tone = '') =>
  el('div', { class: `tile ${tone}` }, icon(name), el('div', {}, el('b', {}, value), el('span', {}, label)));

async function viewDashboard(view) {
  const s = await api('/summary');
  summary = s; renderNav('dashboard');
  const [pnl, recent, tutorList] = await Promise.all([
    api(`/report/pnl?month=${s.month}`),
    api('/leads?status=all&q='),
    api('/tutors'),
  ]);
  const monthName = new Date(`${s.month}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const leads = recent.leads.slice(0, 6);

  /* income against expenses, as a proportion of whichever is larger */
  const peak = Math.max(pnl.incomeBase, pnl.expenseBase, 1);
  const meter = (label, amount, cls) => el('div', { class: 'meter' },
    el('div', { class: 'meter__top' }, el('span', {}, label), el('b', {}, money(amount, pnl.base))),
    el('div', { class: 'bar' }, el('i', { class: cls, style: `width:${Math.round((amount / peak) * 100)}%` })));

  view.replaceChildren(
    el('div', { class: 'head' },
      el('div', {},
        el('h1', {}, 'Dashboard'),
        el('p', {}, `${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · showing ${monthName}`)),
      el('div', { class: 'row' },
        el('button', { class: 'btn btn--gold', onclick: () => { location.hash = 'leads'; setTimeout(newLeadForm, 60); } }, 'Add enquiry'),
        el('button', { class: 'btn btn--green', onclick: () => { location.hash = 'invoices'; setTimeout(() => invoiceForm(), 60); } }, 'New invoice'),
        el('button', { class: 'btn btn--ghost', onclick: () => { location.hash = 'expenses'; setTimeout(expenseForm, 60); } }, 'Record expense'))),

    el('p', { class: 'sec-label' }, 'This month'),
    el('div', { class: 'tiles tiles--money' },
      tile('income', money(pnl.incomeBase, pnl.base), `Income · ${pnl.paidCount} paid invoice${pnl.paidCount === 1 ? '' : 's'}`, 'tile--good'),
      tile('expense', money(pnl.expenseBase, pnl.base), 'Expenses', 'tile--warn'),
      tile('profit', money(pnl.net, pnl.base), pnl.net >= 0 ? 'Net profit' : 'Net loss', pnl.net >= 0 ? 'tile--good' : 'tile--bad')),

    el('p', { class: 'sec-label' }, 'Activity'),
    el('div', { class: 'tiles' },
      tile('inbox', s.newLeads, 'New enquiries'),
      tile('calendar', s.leadsThisMonth, 'Enquiries this month'),
      tile('people', s.tutors, 'Active tutors'),
      tile('invoice', s.unpaid, 'Unpaid invoices')),

    el('div', { class: 'panels' },
      el('div', { class: 'card card--pad' },
        el('div', { class: 'panel__head' },
          el('h3', {}, 'Latest enquiries'),
          el('button', { class: 'linkish', onclick: () => { location.hash = 'leads'; } }, 'See all')),
        leads.length
          ? el('ul', { class: 'feed' }, ...leads.map((l) => el('li', { onclick: () => leadDrawer(l.id, tutorList.tutors, view) },
              el('span', { class: 'feed__avatar' }, (l.name || '?').trim()[0].toUpperCase()),
              el('div', { class: 'feed__body' },
                el('b', {}, l.name),
                el('span', {}, [l.course, l.country].filter(Boolean).join(' · ') || '—')),
              el('div', { class: 'feed__meta' }, chip(l.status), el('span', {}, dt(l.created_at))))))
          : el('p', { class: 'muted' }, 'Nothing yet — website bookings appear here the moment they are submitted.')),

      el('div', { class: 'card card--pad' },
        el('div', { class: 'panel__head' },
          el('h3', {}, 'Money this month'),
          el('button', { class: 'linkish', onclick: () => { location.hash = 'pnl'; } }, 'Full report')),
        meter('Income', pnl.incomeBase, 'bar--good'),
        meter('Expenses', pnl.expenseBase, 'bar--warn'),
        pnl.expensesByHead.length
          ? el('div', { class: 'heads' },
              el('p', { class: 'muted', style: 'margin-bottom:.35rem' }, 'Biggest costs'),
              ...pnl.expensesByHead.slice(0, 4).map((h) => el('div', { class: 'heads__row' },
                el('span', {}, h.head), el('b', {}, money(h.base, pnl.base)))))
          : el('p', { class: 'muted', style: 'margin-top:.8rem' }, 'No expenses recorded this month.'),
        pnl.missingRates.length
          ? el('p', { class: 'note', style: 'margin-top:.8rem' }, `${pnl.missingRates.join(', ')} has no exchange rate, so it is left out of these totals.`)
          : null)),
  );
}
const stat = (v, label) => el('div', { class: 'stat' }, el('b', {}, v), el('span', {}, label));

/* ---------------- leads ---------------- */
let leadFilter = 'all', leadQuery = '';
let leadPicked = new Set();
async function viewLeads(view) {
  const { leads, counts } = await api(`/leads?status=${leadFilter}&q=${encodeURIComponent(leadQuery)}`);
  const { tutors } = await api('/tutors');
  const total = counts.reduce((s, c) => s + c.n, 0);
  const countFor = (s) => (counts.find((c) => c.status === s) || { n: 0 }).n;

  /* a row that has scrolled out of the current filter is no longer selectable */
  const onScreen = new Set(leads.map((l) => l.id));
  leadPicked = new Set([...leadPicked].filter((id) => onScreen.has(id)));

  const search = el('input', { type: 'search', placeholder: 'Search name, phone, course…', value: leadQuery, style: 'max-width:260px' });
  search.addEventListener('input', debounce(() => { leadQuery = search.value; viewLeads(view); }, 300));

  const stop = (fn) => (e) => { e.stopPropagation(); fn(e); };
  const pick = (id, want) => { if (want) leadPicked.add(id); else leadPicked.delete(id); viewLeads(view); };
  const removing = (ids) => deleteLeads(ids, leads.filter((l) => ids.includes(l.id)).map((l) => l.name), () => viewLeads(view));

  const allOn = leads.length > 0 && leadPicked.size === leads.length;
  const box = (checked, onchange) => el('input', { type: 'checkbox', checked: checked || null, onclick: stop(() => {}), onchange });

  /* replaceChildren is a raw DOM call — a null child would print as "null" */
  const parts = [
    head('Enquiries', `${total} total · every website booking lands here`,
      search,
      el('button', { class: 'btn btn--gold', onclick: newLeadForm }, 'Add manually')),
    el('div', { class: 'filters' }, ...['all', 'new', 'contacted', 'trial', 'enrolled', 'lost'].map((s) =>
      el('button', { class: leadFilter === s ? 'on' : '', onclick: () => { leadFilter = s; leadPicked.clear(); viewLeads(view); } },
        `${s[0].toUpperCase()}${s.slice(1)}${s === 'all' ? '' : ` (${countFor(s)})`}`))),
    leadPicked.size
      ? el('div', { class: 'pickbar' },
          el('b', {}, `${leadPicked.size} selected`),
          el('button', { class: 'btn btn--danger btn--sm', onclick: () => removing([...leadPicked]) }, 'Delete selected'),
          el('button', { class: 'btn btn--ghost btn--sm', onclick: () => { leadPicked.clear(); viewLeads(view); } }, 'Clear'))
      : null,
    leads.length
      ? el('div', { class: 'card scroll' }, el('table', { class: 'tbl' },
          el('thead', {}, el('tr', {},
            el('th', { class: 'pickcol' }, box(allOn, () => { if (allOn) leadPicked.clear(); else leads.forEach((l) => leadPicked.add(l.id)); viewLeads(view); })),
            el('th', { class: 'sn' }, '#'),
            ...['Student', 'Contact number', 'Country', 'Course', 'Schedule', 'Tutor', 'Status', 'Received'].map((h) => el('th', {}, h)),
            el('th', { class: 'acts' }, ''))),
          el('tbody', {}, ...leads.map((l, i) => el('tr', { class: leadPicked.has(l.id) ? 'picked' : '', onclick: () => leadDrawer(l.id, tutors, view) },
            el('td', { class: 'pickcol' }, box(leadPicked.has(l.id), (e) => pick(l.id, e.target.checked))),
            el('td', { class: 'sn' }, i + 1),
            el('td', { class: 'nm' }, el('b', {}, l.name), l.student ? el('div', { class: 'muted' }, l.student) : null),
            el('td', { class: 'tel' }, l.phone || '—'),
            el('td', {}, l.country || '—'),
            el('td', {}, l.course || '—'),
            el('td', {}, el('div', {}, l.days || '—'), el('div', { class: 'muted' }, l.preferred_time || '')),
            el('td', {}, l.tutor_name || el('span', { class: 'muted' }, 'Unassigned')),
            el('td', {}, chip(l.status)),
            el('td', { class: 'muted when' }, dt(l.created_at)),
            el('td', { class: 'acts' },
              el('button', { class: 'btn btn--ghost btn--sm', onclick: stop(() => leadDrawer(l.id, tutors, view)) }, 'View'),
              el('button', { class: 'btn btn--danger btn--sm', onclick: stop(() => removing([l.id])) }, 'Delete')))))))
      : el('div', { class: 'card empty' }, 'No enquiries yet. Website bookings appear here automatically once the site is pointed at this backend.'),
  ];
  view.replaceChildren(...parts.filter(Boolean));
}

/* Deleting cannot be undone, so it asks for the master password every time. */
function deleteLeads(ids, names, after) {
  const many = ids.length > 1;
  drawer(many ? `Delete ${ids.length} enquiries` : 'Delete enquiry', (body, close) => {
    const pw = pwField('Master password', { autocomplete: 'current-password' });
    const msg = el('p', { class: 'err' });
    const go = async () => {
      msg.textContent = '';
      if (!pw.input.value) { msg.textContent = 'Enter your password to confirm.'; return; }
      try {
        const r = await api('/leads/delete', { method: 'POST', body: { ids, password: pw.input.value } });
        leadPicked.clear();
        close();
        toast(r.deleted === 1 ? 'Enquiry deleted' : `${r.deleted} enquiries deleted`);
        after();
      } catch (err) { msg.textContent = err.message; pw.input.select(); }
    };
    body.append(
      el('p', { class: 'muted' }, `${many ? 'These records' : 'This record'} will be removed permanently — there is no undo.`),
      el('ul', { class: 'dellist' },
        ...names.slice(0, 8).map((n) => el('li', {}, n)),
        names.length > 8 ? el('li', { class: 'muted' }, `and ${names.length - 8} more`) : null),
      el('div', { class: 'fields' }, pw.node),
      msg,
      el('div', { class: 'row', style: 'margin-top:.4rem' },
        el('button', { class: 'btn btn--danger', onclick: go }, many ? `Delete ${ids.length} enquiries` : 'Delete enquiry'),
        el('button', { class: 'btn btn--ghost', onclick: close }, 'Cancel')));
    on(pw.input, 'keydown', (e) => { if (e.key === 'Enter') go(); });
    setTimeout(() => pw.input.focus(), 60);
  });
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
          onclick: () => { close(); deleteLeads([id], [lead.name], () => viewLeads(view)); },
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
let tutorTab = 'registry';
async function viewTutors(view) {
  const tabs = el('div', { class: 'filters' },
    el('button', { class: tutorTab === 'registry' ? 'on' : '', onclick: () => { tutorTab = 'registry'; viewTutors(view); } }, 'Our tutors'),
    el('button', { class: tutorTab === 'public' ? 'on' : '', onclick: () => { tutorTab = 'public'; viewTutors(view); } }, 'Shown on the website'));
  if (tutorTab === 'public') return teamEditor(view, tabs);

  const { tutors } = await api('/tutors');
  view.replaceChildren(
    head('Tutors', `${tutors.length} registered · private to you`, el('button', { class: 'btn btn--gold', onclick: () => tutorForm() }, 'Register tutor')),
    tabs,
    tutors.length
      ? el('div', { class: 'card scroll' }, el('table', { class: 'tbl' },
          el('thead', {}, el('tr', {}, el('th', { class: 'sn' }, '#'), ...['Name', 'Phone', 'Subjects', 'Languages', 'Timezone', 'Status'].map((h) => el('th', {}, h)))),
          el('tbody', {}, ...tutors.map((t, i) => el('tr', { onclick: () => tutorForm(t) },
            el('td', { class: 'sn' }, i + 1),
            el('td', {}, el('b', {}, t.name), t.gender ? el('div', { class: 'muted' }, t.gender) : null),
            el('td', { class: 'tel' }, t.phone),
            el('td', {}, t.subjects || '—'),
            el('td', {}, t.languages || '—'),
            el('td', {}, t.timezone || '—'),
            el('td', {}, chip(t.status)))))))
      : el('div', { class: 'card empty' }, 'No tutors yet. Register one with just a name and phone number.'),
  );
}

/* The profiles visitors see on the about page. Separate from the registry
   above, which holds phone numbers and rates that must not be published. */
async function teamEditor(view, tabs) {
  const T = await api('/team');
  const { tutors } = await api('/tutors').catch(() => ({ tutors: [] }));

  const labelled = (text, node, hint) => el('label', { class: 'f' }, el('span', {}, text), node,
    hint ? el('small', { class: 'hint' }, hint) : null);
  const bind = (obj, key, attrs = {}, after) => {
    const node = attrs.rows ? el('textarea', { rows: attrs.rows }) : el('input', { value: obj[key] ?? '', ...attrs });
    if (attrs.rows) node.value = obj[key] ?? '';
    on(node, 'input', () => { obj[key] = node.value; if (after) after(); });
    return node;
  };

  const listBox = el('div', { class: 'plan-list' });
  const draw = () => {
    listBox.replaceChildren(...T.members.map((m, i) => {
      const ava = el('div', { class: 'ava' }, m.initial || (m.name || '?').trim()[0] || '?');
      return el('div', { class: 'plan-edit' },
        el('div', { class: 'plan-edit__head' },
          el('b', {}, `${i + 1}. ${m.name || 'New teacher'}`),
          el('div', { class: 'row' },
            el('button', { class: 'btn btn--ghost btn--sm', disabled: i === 0 || null,
              onclick: () => { T.members.splice(i - 1, 0, T.members.splice(i, 1)[0]); draw(); } }, 'Move up'),
            el('button', { class: 'btn btn--ghost btn--sm', disabled: i === T.members.length - 1 || null,
              onclick: () => { T.members.splice(i + 1, 0, T.members.splice(i, 1)[0]); draw(); } }, 'Move down'),
            el('button', { class: 'btn btn--danger btn--sm', onclick: () => {
              if (T.members.length < 2) return toast('Keep at least one teacher');
              if (!confirm(`Remove ${m.name} from the website?`)) return;
              T.members.splice(i, 1); draw();
            } }, 'Remove'))),
        el('div', { class: 'teamrow' },
          ava,
          el('div', { class: 'fields', style: 'flex:1' },
            labelled('Name shown', bind(m, 'name', { maxlength: 60 }, () => { ava.textContent = m.initial || (m.name || '?').trim()[0] || '?'; })),
            labelled('Specialism', bind(m, 'role', { maxlength: 60, placeholder: 'Tajweed & Ijazah' })),
            labelled('Avatar letter', bind(m, 'initial', { maxlength: 2, dir: 'rtl' }, () => { ava.textContent = m.initial || (m.name || '?').trim()[0] || '?'; }), 'Blank uses the first letter'))),
        labelled('Short profile', bind(m, 'bio', { rows: 2 })));
    }));
  };

  const msg = el('p', { class: 'err' });
  const publish = el('button', { class: 'btn btn--gold' }, 'Publish to the website');
  on(publish, 'click', async () => {
    msg.textContent = ''; publish.disabled = true; publish.textContent = 'Publishing…';
    try {
      const saved = await api('/team', { method: 'PUT', body: T });
      toast(saved.published ? 'Published — the website is updated' : 'Saved, but the website did not rebuild');
      if (!saved.published) msg.textContent = `The site could not be rebuilt: ${saved.log || 'unknown error'}`;
      else viewTutors(view);
    } catch (err) { msg.textContent = err.message; }
    finally { publish.disabled = false; publish.textContent = 'Publish to the website'; }
  });

  const reset = el('button', { class: 'btn btn--ghost' }, 'Restore original profiles');
  on(reset, 'click', async () => {
    if (!confirm('Put the teacher profiles back to the ones the site launched with?')) return;
    try { const r = await api('/team/reset', { method: 'POST' }); toast(r.published ? 'Restored and published' : 'Restored'); viewTutors(view); }
    catch (err) { msg.textContent = err.message; }
  });

  const addMember = (from) => {
    T.members.push({ name: from?.name || '', role: from?.subjects || '', initial: '', bio: '' });
    draw();
    listBox.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const fromRegistry = el('select', { style: 'max-width:240px' },
    el('option', { value: '' }, 'Add from your tutors…'),
    ...tutors.map((t) => el('option', { value: t.id }, t.name)));
  on(fromRegistry, 'change', () => {
    const t = tutors.find((x) => x.id === fromRegistry.value);
    fromRegistry.value = '';
    if (!t) return;
    addMember(t);
    toast('Added — only the name and subjects come across');
  });

  draw();

  view.replaceChildren(
    head('Teachers on the website',
      T.custom ? `Your own profiles · last published ${dt(T.updated_at)}` : 'Showing the profiles the site launched with',
      reset, publish),
    tabs,
    msg,
    el('div', { class: 'card' },
      el('div', { class: 'sec-label' }, 'Section heading'),
      el('div', { class: 'fields' },
        labelled('Small label above', bind(T, 'eyebrow', { maxlength: 40 })),
        labelled('Heading', bind(T, 'heading', { maxlength: 100 })),
        labelled('Button under the cards', bind(T, 'cta', { maxlength: 40 }), 'Leave empty to hide it')),
      labelled('Introduction', bind(T, 'lead', { rows: 2 })),
      el('p', { class: 'muted', style: 'margin-top:.7rem' },
        'These profiles appear under “Our teachers” on the about page. Phone numbers, rates and notes from your tutor list are never published.')),
    listBox,
    el('div', { class: 'row', style: 'margin-top:.9rem' },
      el('button', { class: 'btn btn--ghost', onclick: () => addMember(null) }, 'Add a teacher'),
      fromRegistry),
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
          el('thead', {}, el('tr', {}, el('th', { class: 'sn' }, '#'), ...['Number', 'Client', 'Issued', 'Due', 'Status', 'Total'].map((h) => el('th', { class: h === 'Total' ? 'num' : '' }, h)))),
          el('tbody', {}, ...invoices.map((inv, i) => el('tr', { onclick: () => invoiceForm(inv.id) },
            el('td', { class: 'sn' }, i + 1),
            el('td', {}, el('b', {}, inv.number)),
            el('td', {}, inv.client_name, el('div', { class: 'muted' }, inv.client_phone || '')),
            el('td', { class: 'muted' }, dt(inv.issue_date)),
            el('td', { class: 'muted' }, dt(inv.due_date)),
            el('td', {}, chip(inv.status)),
            el('td', { class: 'num' }, money(inv.totals.total, inv.currency)))))))
      : el('div', { class: 'card empty' }, 'No invoices yet.'),
  );
}

async function invoiceForm(id = null) {
  const existing = id ? await api(`/invoices/${id}`) : null;
  const settings = await api('/settings');
  const pricing = await api('/pricing/regions');
  drawer(existing ? `Invoice ${existing.number}` : 'New invoice', (body, close) => {
    const f = formFields([
      ['client_name', 'Client name', 'text', true], ['client_phone', 'Client phone'], ['client_email', 'Client email', 'email'],
    ], existing || {});
    const currency = el('select', {}, ...pricing.currencies.map((c) =>
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
      /* straight from the published rates, so this list cannot drift */
      region: el('select', {}, ...pricing.regions.map((r) => el('option', { value: r.key }, `${r.label} (${r.code})`))),
      duration: el('select', {}, ...pricing.durations.map((d) => el('option', { value: String(d) }, `${d} min`))),
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
        existing ? el('a', { class: 'btn btn--ghost', href: `/invoice/${id}`, target: '_blank', rel: 'noopener' }, 'Print / PDF') : null,
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
        share.printUrl ? el('a', { class: 'btn btn--ghost', href: share.printUrl, target: '_blank', rel: 'noopener' }, 'Print / PDF') : null));
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
          el('thead', {}, el('tr', {}, el('th', { class: 'sn' }, '#'), ...['Date', 'Head', 'Description', 'Tutor', 'Amount'].map((h) => el('th', { class: h === 'Amount' ? 'num' : '' }, h)))),
          el('tbody', {}, ...expenses.map((e, i) => el('tr', { onclick: () => expenseForm(heads, e) },
            el('td', { class: 'sn' }, i + 1),
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
  const { currencies } = await api('/pricing/regions');
  drawer(e ? 'Edit expense' : 'Record expense', (body, close) => {
    const date = el('input', { type: 'date', value: e?.date || today() });
    const head_ = el('select', {}, ...heads.map((h) => el('option', { value: h, selected: e?.head === h || null }, h)));
    const desc = el('input', { value: e?.description || '', placeholder: 'What was it for?' });
    const amount = el('input', { type: 'number', step: '0.01', value: e?.amount ?? '', placeholder: '0.00' });
    const cur = el('select', {}, ...currencies.map((c) =>
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


/* a password input paired with a reveal button */
function pwField(label, attrs = {}) {
  const input = el('input', { type: 'password', autocomplete: 'off', ...attrs });
  const eye = el('button', {
    type: 'button', class: 'pw__eye', 'data-reveal': '', 'aria-label': 'Show password',
    html: '<svg viewBox="0 0 24 24"><path d="M12 5c-5 0-9 4.5-9 7s4 7 9 7 9-4.5 9-7-4-7-9-7m0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9m0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"/></svg>',
  });
  const node = el('label', { class: 'f' }, el('span', {}, label), el('span', { class: 'pw' }, input, eye));
  return { node, input };
}

/* ---------------- password & recovery ---------------- */
async function viewSecurity(view) {
  const recovery = await api('/recovery');
  const current = pwField('Current password', { autocomplete: 'current-password' });
  const next = pwField('New password', { autocomplete: 'new-password', minlength: 8 });
  const again = pwField('Repeat new password', { autocomplete: 'new-password' });
  const msg = el('p', { class: 'err' });
  const keyBox = el('div', { class: 'keybox' }, recovery.key);

  const submit = async () => {
    msg.textContent = ''; msg.classList.add('err');
    if (next.input.value !== again.input.value) { msg.textContent = 'The two new passwords do not match.'; return; }
    if (next.input.value.length < 8) { msg.textContent = 'Use at least 8 characters.'; return; }
    try {
      const r = await api('/password', { method: 'POST', body: { current: current.input.value, password: next.input.value } });
      keyBox.textContent = r.recovery_key;
      [current, next, again].forEach((f) => { f.input.value = ''; });
      msg.classList.remove('err');
      msg.textContent = 'Password changed. Your recovery key below has been replaced — save the new one.';
      toast('Password changed');
    } catch (ex) { msg.textContent = ex.message; }
  };

  view.replaceChildren(
    head('Password', 'Change your sign-in password and keep your recovery key safe'),
    el('div', { class: 'card card--pad', style: 'max-width:520px' },
      el('h3', { style: 'font-size:1rem;margin-bottom:.8rem' }, 'Change password'),
      current.node,
      el('div', { style: 'margin-top:.7rem' }, next.node),
      el('div', { style: 'margin-top:.7rem' }, again.node),
      msg,
      el('button', { class: 'btn btn--gold', style: 'margin-top:.8rem', onclick: submit }, 'Change password')),

    el('div', { class: 'card card--pad', style: 'max-width:520px;margin-top:1rem' },
      el('h3', { style: 'font-size:1rem;margin-bottom:.6rem' }, 'Recovery key'),
      el('p', { class: 'note' }, 'If the password is ever lost, this key resets it from the sign-in screen. Keep a copy somewhere safe — it is replaced every time the password changes.'),
      keyBox,
      el('button', { class: 'btn btn--ghost btn--sm', onclick: () => copy(keyBox.textContent, 'Recovery key copied') }, 'Copy recovery key')),
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

  const mail = s.mail || {};
  const mailStatus = el('p', { class: mail.ready ? 'muted' : 'note' }, mail.ready
    ? `Enquiry emails are sent from ${mail.from} to ${mail.to} via ${mail.host}.`
    : `Email notifications are off — still to set on the server: ${(mail.missing || []).join(', ')}. Enquiries arrive in this panel either way.`);

  view.replaceChildren(
    head('Settings'),
    el('div', { class: 'card card--pad', style: 'margin-bottom:1rem' },
      el('h3', { style: 'font-size:1rem;margin-bottom:.5rem' }, 'Notifications'),
      mailStatus,
      el('div', { class: 'row', style: 'margin-top:.7rem' },
        mail.ready ? el('button', { class: 'btn btn--ghost btn--sm', onclick: async (e) => {
          e.target.textContent = 'Sending…';
          try { await api('/settings/test-email', { method: 'POST' }); toast('Test email sent'); }
          catch (ex) { toast(ex.message); }
          e.target.textContent = 'Send a test email';
        } }, 'Send a test email') : null,
        (window.Notification && Notification.permission !== 'granted')
          ? el('button', { class: 'btn btn--ghost btn--sm', onclick: async () => {
              const p = await Notification.requestPermission();
              toast(p === 'granted' ? 'Desktop alerts on' : 'Desktop alerts not allowed');
            } }, 'Enable desktop alerts')
          : el('span', { class: 'muted' }, 'Desktop alerts are on'))),
    el('div', { class: 'card card--pad' },
      el('div', { class: 'fields' }, ...f.nodes),
      el('label', { class: 'f', style: 'margin-top:.8rem' }, el('span', {}, 'Expense heads (comma separated)'), heads),
      el('label', { class: 'f', style: 'margin-top:.8rem' }, el('span', {}, 'Invoice terms'), terms),
      el('label', { class: 'f', style: 'margin-top:.8rem' },
        el('span', {}, `Exchange rates into ${s.base_currency} — JSON, e.g. {"PKR":1,"USD":280}`), rates),
      el('div', { class: 'row', style: 'margin-top:1rem' },
        el('button', { class: 'btn btn--gold', onclick: async () => {
          try { JSON.parse(rates.value || '{}'); } catch { return toast('Exchange rates must be valid JSON'); }
          const body = { ...f.values(), expense_heads: heads.value, invoice_terms: terms.value, fx_rates: rates.value };
          await api('/settings', { method: 'PATCH', body });
          toast('Settings saved');
        } }, 'Save settings'))),
  );
}


/* ---------------- new enquiry watcher ----------------
   Polls quietly while the admin is open so a new booking announces itself
   instead of waiting to be noticed on the next page load. */
let lastSeenLeads = null;
let watchTimer = null;

function notify(count) {
  const word = count === 1 ? 'enquiry' : 'enquiries';
  toast(`${count} new ${word} just came in`);
  const bar = el('button', {
    class: 'newbar',
    onclick: (e) => { e.currentTarget.remove(); location.hash = 'leads'; },
  }, `${count} new ${word} — open`);
  document.querySelectorAll('.newbar').forEach((n) => n.remove());
  document.body.append(bar);
  if (window.Notification && Notification.permission === 'granted') {
    try { new Notification('Institute of Islamic Learning', { body: `${count} new ${word}`, tag: 'iil-lead' }); } catch {}
  }
}

async function pollEnquiries() {
  try {
    const s = await api('/summary');
    summary = s;
    renderNav((location.hash.slice(1) || 'dashboard'));
    if (lastSeenLeads !== null && s.newLeads > lastSeenLeads) notify(s.newLeads - lastSeenLeads);
    lastSeenLeads = s.newLeads;
  } catch { /* signed out or offline; the next tick retries */ }
}

function startWatching() {
  clearInterval(watchTimer);
  lastSeenLeads = null;
  pollEnquiries();
  watchTimer = setInterval(() => { if (!document.hidden) pollEnquiries(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollEnquiries(); });
}

/* ---------------- courses ---------------- */
/* One course is described once here and appears on the courses page, the home
   grid, both menus, the footer, the booking form and the fee calculator. */
const COURSE_ICONS = {
  book: 'M21 5c-1.9-.9-4-1.4-6-1.4S11 4.1 9 5v14c2-.9 4-1.4 6-1.4s4.1.5 6 1.4zM3 5v14c1.9-.9 3-1.4 5-1.4V3.6C6 3.6 4.9 4.1 3 5',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3m7 9a7 7 0 0 1-6 6.9V22h-2v-3.1A7 7 0 0 1 5 12h2a5 5 0 0 0 10 0z',
  shield: 'M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6zm3.5 7.6-4.3 4.3a1 1 0 0 1-1.4 0L7.6 11.7 9 10.3l1.5 1.5 3.6-3.6z',
  cube: 'M12 2 3 7v10l9 5 9-5V7zm0 4.2 5.2 2.9L12 12l-5.2-2.9zM5 9.8l6 3.4v5.9l-6-3.3zm8 9.3v-5.9l6-3.4v6z',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M4.3 13h3.2c.1 1.9.5 3.7 1.1 5.2A8 8 0 0 1 4.3 13m3.2-2H4.3a8 8 0 0 1 4.3-5.2c-.6 1.5-1 3.3-1.1 5.2m8.9 0c-.1-1.9-.5-3.7-1.1-5.2A8 8 0 0 1 19.7 11zm-2 0H9.6c.1-2.1.6-4 1.4-5.3.3-.5.7-.7 1-.7s.7.2 1 .7c.8 1.3 1.3 3.2 1.4 5.3m0 2c-.1 2.1-.6 4-1.4 5.3-.3.5-.7.7-1 .7s-.7-.2-1-.7c-.8-1.3-1.3-3.2-1.4-5.3zm2 0h3.3a8 8 0 0 1-4.4 5.2c.6-1.5 1-3.3 1.1-5.2',
  chat: 'M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l-4 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m3 4v2h10V8zm0 4v2h7v-2z',
  star: 'M12 2 9.5 8.5 3 9.6l4.8 4.4-1.3 6.6L12 17.4l5.5 3.2-1.3-6.6L21 9.6l-6.5-1.1z',
  badge: 'M12 2 4 5.5v5.9c0 4.6 3.4 8.9 8 10.1 4.6-1.2 8-5.5 8-10.1V5.5zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 8c2.2 0 4 1.1 4 2.4V18H8v-1.6c0-1.3 1.8-2.4 4-2.4',
  pen: 'M3 17.2V21h3.8L17.8 10 14 6.2zm17.7-10.5a1 1 0 0 0 0-1.4l-2-2a1 1 0 0 0-1.4 0l-1.8 1.8L19.3 8.9z',
  heart: 'M12 21s-7.5-4.6-9.3-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.3 12c-1.8 4.4-9.3 9-9.3 9',
};
const courseIcon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${COURSE_ICONS[name] || COURSE_ICONS.book}"/></svg>`;

async function viewCourses(view) {
  const data = await api('/courses');
  const C = data.courses;

  const bind = (obj, key, attrs = {}, after) => {
    const node = attrs.tag === 'textarea'
      ? el('textarea', { rows: attrs.rows || 3, placeholder: attrs.placeholder || '' })
      : el('input', { value: obj[key] ?? '', ...attrs });
    if (attrs.tag === 'textarea') node.value = obj[key] ?? '';
    on(node, 'input', () => { obj[key] = node.value; if (after) after(); });
    return node;
  };
  const labelled = (text, node, hint) => el('label', { class: 'f' }, el('span', {}, text), node,
    hint ? el('small', { class: 'hint' }, hint) : null);
  const listField = (obj, key, label, hint) => {
    const ta = el('textarea', { rows: 3 });
    ta.value = (obj[key] || []).join('\n');
    on(ta, 'input', () => { obj[key] = ta.value.split('\n').map((l) => l.trim()).filter(Boolean); });
    return labelled(label, ta, hint);
  };
  const check = (obj, key, text) => {
    const box = el('input', { type: 'checkbox', checked: obj[key] ? '' : null });
    on(box, 'change', () => { obj[key] = box.checked; });
    return el('label', { class: 'chk' }, box, el('span', {}, text));
  };

  const listBox = el('div', { class: 'plan-list' });
  const draw = () => {
    listBox.replaceChildren(...C.map((c, i) => {
      const iconWrap = el('div', { class: 'iconpick__art', html: courseIcon(c.icon) });
      const iconSel = el('select', {}, ...data.icons.map((n) =>
        el('option', { value: n, selected: n === c.icon || null }, n)));
      on(iconSel, 'change', () => { c.icon = iconSel.value; iconWrap.innerHTML = courseIcon(c.icon); });

      return el('div', { class: 'plan-edit' },
        el('div', { class: 'plan-edit__head' },
          el('b', {}, `${i + 1}. ${c.name || 'New course'}`),
          el('div', { class: 'row' },
            el('button', { class: 'btn btn--ghost btn--sm', disabled: i === 0 || null,
              onclick: () => { C.splice(i - 1, 0, C.splice(i, 1)[0]); draw(); } }, 'Move up'),
            el('button', { class: 'btn btn--ghost btn--sm', disabled: i === C.length - 1 || null,
              onclick: () => { C.splice(i + 1, 0, C.splice(i, 1)[0]); draw(); } }, 'Move down'),
            el('button', { class: 'btn btn--danger btn--sm', onclick: () => {
              if (C.length < 2) return toast('Keep at least one course');
              if (!confirm(`Remove ${c.name} from the website?`)) return;
              C.splice(i, 1); draw();
            } }, 'Remove'))),

        el('div', { class: 'fields' },
          labelled('Course name', bind(c, 'name', { maxlength: 80 })),
          labelled('Arabic name', bind(c, 'arabic', { maxlength: 80, dir: 'rtl' })),
          labelled('Short label', bind(c, 'short', { maxlength: 40 }), 'Used in the menus'),
          labelled('Icon', el('div', { class: 'iconpick' }, iconWrap, iconSel))),

        labelled('One line for the Courses menu', bind(c, 'menuBlurb', { maxlength: 80, placeholder: 'Letters, sounds & the first steps' })),
        labelled('Short description (home page card)', bind(c, 'summary', { tag: 'textarea', rows: 2 })),
        labelled('Full description (courses page)', bind(c, 'intro', { tag: 'textarea', rows: 3 })),

        el('div', { class: 'fields' },
          listField(c, 'covers', 'What you’ll cover', 'One per line'),
          listField(c, 'tags', 'Tags', 'One per line')),

        el('div', { class: 'fields' },
          labelled('Button label', bind(c, 'cta', { maxlength: 40 })),
          labelled('Name in the booking form', bind(c, 'formLabel', { maxlength: 80 })),
          labelled('Description for search engines', bind(c, 'seo', { maxlength: 200 }))),

        el('div', { class: 'row' }, check(c, 'onHome', 'Show on the home page'), check(c, 'inFooter', 'Show in the footer')));
    }));
  };

  const msg = el('p', { class: 'err' });
  const publish = el('button', { class: 'btn btn--gold' }, 'Publish to the website');
  on(publish, 'click', async () => {
    msg.textContent = ''; publish.disabled = true; publish.textContent = 'Publishing…';
    try {
      const saved = await api('/courses', { method: 'PUT', body: { courses: C } });
      toast(saved.published ? 'Published — the website is updated' : 'Saved, but the website did not rebuild');
      if (!saved.published) msg.textContent = `The site could not be rebuilt: ${saved.log || 'unknown error'}`;
      else viewCourses(view);
    } catch (err) { msg.textContent = err.message; }
    finally { publish.disabled = false; publish.textContent = 'Publish to the website'; }
  });

  const reset = el('button', { class: 'btn btn--ghost' }, 'Restore original courses');
  on(reset, 'click', async () => {
    if (!confirm('Put every course back to the one the site launched with?')) return;
    try { const r = await api('/courses/reset', { method: 'POST' }); toast(r.published ? 'Restored and published' : 'Restored'); viewCourses(view); }
    catch (err) { msg.textContent = err.message; }
  });

  draw();

  view.replaceChildren(
    head('Courses',
      data.custom ? `Your own courses · last published ${dt(data.updated_at)}` : 'Showing the courses the site launched with',
      reset, publish),
    msg,
    el('div', { class: 'card' },
      el('p', { class: 'muted', style: 'margin:0' },
        'Each course below fills the courses page, the home grid, the Courses menu, the footer list, the booking form and the fee calculator. Nothing changes on the website until you publish.')),
    listBox,
    el('div', { class: 'row', style: 'margin-top:.9rem' },
      el('button', { class: 'btn btn--ghost', onclick: () => {
        C.push({ id: '', icon: 'book', name: '', arabic: '', short: '', menuBlurb: '', summary: '', intro: '',
          covers: [], tags: [], cta: 'Start free trial', formLabel: '', seo: '', onHome: true, inFooter: true });
        draw();
        listBox.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } }, 'Add a course')),
  );
}

/* ---------------- fees & plans ---------------- */
/* Everything the public pricing page shows, editable here. Saving writes the
   figures next to the database and rebuilds the site, so the change is live. */
async function viewPricing(view) {
  const P = await api('/pricing');
  P.durations = P.durations.map(Number);

  const priceOf = (key, duration, per) => {
    const rate = Number(P.regions[key]?.rates?.[duration] || 0);
    const plan = P.plans.find((p) => Number(p.per) === Number(per));
    return Math.round(rate * per * (1 - Number(plan?.discount || 0) / 100));
  };

  const bind = (obj, key, attrs = {}, after) => {
    const input = el('input', { value: obj[key] ?? '', ...attrs });
    on(input, 'input', () => {
      obj[key] = attrs.type === 'number' ? (input.value === '' ? 0 : Number(input.value)) : input.value;
      if (after) after();
    });
    return input;
  };
  const labelled = (text, node, hint) => el('label', { class: 'f' }, el('span', {}, text), node,
    hint ? el('small', { class: 'hint' }, hint) : null);

  /* --- live preview of one country, exactly as a visitor would see it --- */
  let pvRegion = Object.keys(P.regions)[0];
  let pvDuration = P.durations[0];
  const pvBox = el('div', { class: 'pv' });
  const drawPreview = () => {
    const r = P.regions[pvRegion];
    if (!r) { pvBox.replaceChildren(el('p', { class: 'muted' }, 'Add a country to see the preview.')); return; }
    pvBox.replaceChildren(...P.plans.map((p) => el('div', { class: `pv__card${p.badge ? ' on' : ''}` },
      p.badge ? el('span', { class: 'pv__badge' }, p.badge) : null,
      el('b', {}, p.name || 'Untitled'),
      el('span', { class: 'muted' }, p.blurb || ''),
      el('div', { class: 'pv__amt' }, `${r.symbol || ''}${priceOf(pvRegion, pvDuration, p.per)}`, el('small', {}, '/ month')),
      el('span', { class: 'muted' }, `${p.per} × ${pvDuration} min a week${Number(p.discount) ? ` · ${p.discount}% off` : ''}`))));
  };

  /* --- plans --- */
  const plansBox = el('div', { class: 'plan-list' });
  const drawPlans = () => {
    plansBox.replaceChildren(...P.plans.map((p, i) => el('div', { class: 'plan-edit' },
      el('div', { class: 'plan-edit__head' },
        el('b', {}, `Plan ${i + 1}`),
        el('button', { class: 'btn btn--danger btn--sm', onclick: () => {
          if (P.plans.length < 2) return toast('Keep at least one plan');
          P.plans.splice(i, 1); drawPlans(); drawPreview();
        } }, 'Remove')),
      el('div', { class: 'fields' },
        labelled('Plan name', bind(p, 'name', { maxlength: 40 }, drawPreview)),
        labelled('Classes a week', bind(p, 'per', { type: 'number', min: 1, max: 14, step: 1 }, drawPreview)),
        labelled('Multi-class discount', bind(p, 'discount', { type: 'number', min: 0, max: 90, step: 0.5 }, drawPreview), '% off this plan'),
        labelled('Badge', bind(p, 'badge', { maxlength: 30, placeholder: 'e.g. Most popular' }, drawPreview), 'Leave empty for no ribbon')),
      labelled('Tagline', bind(p, 'blurb', { maxlength: 120, placeholder: 'Our recommended pace' }, drawPreview)),
      (() => {
        const ta = el('textarea', { rows: 3, placeholder: 'Leave empty to list the classes automatically' });
        ta.value = (p.features || []).join('\n');
        on(ta, 'input', () => { p.features = ta.value.split('\n').map((l) => l.trim()).filter(Boolean); });
        return labelled('Bullet points on the card', ta, 'One per line');
      })())));
  };

  /* --- countries and rates --- */
  const ratesBox = el('div', { class: 'scroll' });
  const drawRates = () => {
    const keys = Object.keys(P.regions);
    ratesBox.replaceChildren(el('table', { class: 'tbl tbl--edit' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Country'), el('th', {}, 'Tab label'), el('th', {}, 'Symbol'), el('th', {}, 'Currency'),
        ...P.durations.map((d) => el('th', { class: 'num' }, `${d} min`)),
        el('th', {}, ''))),
      el('tbody', {}, ...keys.map((k) => {
        const r = P.regions[k];
        return el('tr', {},
          el('td', {}, bind(r, 'label', { maxlength: 60 }, () => { drawPreview(); drawRegionPicker(); })),
          el('td', {}, bind(r, 'short', { maxlength: 20, style: 'width:6rem' })),
          el('td', {}, bind(r, 'symbol', { maxlength: 6, style: 'width:4.5rem' }, drawPreview)),
          el('td', {}, bind(r, 'code', { maxlength: 6, style: 'width:5rem' })),
          ...P.durations.map((d) => el('td', { class: 'num' },
            bind(r.rates, d, { type: 'number', min: 0, step: 0.05, style: 'width:6rem;text-align:right' }, drawPreview))),
          el('td', {}, el('button', { class: 'btn btn--danger btn--sm', onclick: () => {
            if (keys.length < 2) return toast('Keep at least one country');
            delete P.regions[k];
            if (pvRegion === k) pvRegion = Object.keys(P.regions)[0];
            drawRates(); drawRegionPicker(); drawPreview();
          } }, 'Remove')));
      }))));
  };

  const addRegion = () => {
    const name = prompt('Country name, e.g. Malaysia');
    if (!name) return;
    let key = name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8) || 'xx';
    while (P.regions[key]) key += 'x';
    P.regions[key] = { label: name.trim(), short: name.trim().slice(0, 12), symbol: '$', code: 'USD',
      rates: Object.fromEntries(P.durations.map((d) => [d, 0])) };
    drawRates(); drawRegionPicker(); drawPreview();
  };

  /* --- class lengths --- */
  const durInput = el('input', { value: P.durations.join(', '), style: 'max-width:200px' });
  on(durInput, 'change', () => {
    const next = durInput.value.split(/[,\s]+/).map(Number).filter((d) => Number.isInteger(d) && d > 0 && d <= 240);
    if (!next.length) { durInput.value = P.durations.join(', '); return toast('Keep at least one class length'); }
    P.durations = [...new Set(next)].sort((a, z) => a - z);
    durInput.value = P.durations.join(', ');
    for (const r of Object.values(P.regions)) {
      const rates = {};
      for (const d of P.durations) rates[d] = Number(r.rates[d] || 0);
      r.rates = rates;
    }
    if (!P.durations.includes(pvDuration)) pvDuration = P.durations[0];
    drawRates(); drawDurationPicker(); drawPreview();
  });

  /* --- preview pickers --- */
  const regionPick = el('select', { style: 'max-width:220px' });
  const durationPick = el('select', { style: 'max-width:160px' });
  const drawRegionPicker = () => {
    regionPick.replaceChildren(...Object.entries(P.regions).map(([k, r]) =>
      el('option', { value: k, selected: k === pvRegion || null }, r.label || k)));
  };
  const drawDurationPicker = () => {
    durationPick.replaceChildren(...P.durations.map((d) =>
      el('option', { value: d, selected: d === pvDuration || null }, `${d} minutes`)));
  };
  on(regionPick, 'change', () => { pvRegion = regionPick.value; drawPreview(); });
  on(durationPick, 'change', () => { pvDuration = Number(durationPick.value); drawPreview(); });

  /* --- publishing --- */
  const msg = el('p', { class: 'err' });
  const publish = el('button', { class: 'btn btn--gold' }, 'Publish to the website');
  on(publish, 'click', async () => {
    msg.textContent = ''; publish.disabled = true; publish.textContent = 'Publishing…';
    try {
      const saved = await api('/pricing', { method: 'PUT', body: { regions: P.regions, durations: P.durations, plans: P.plans } });
      toast(saved.published ? 'Published — the website is updated' : 'Saved, but the website did not rebuild');
      if (!saved.published) msg.textContent = `The site could not be rebuilt: ${saved.log || 'unknown error'}`;
      else viewPricing(view);
    } catch (err) { msg.textContent = err.message; }
    finally { publish.disabled = false; publish.textContent = 'Publish to the website'; }
  });

  const reset = el('button', { class: 'btn btn--ghost' }, 'Restore original prices');
  on(reset, 'click', async () => {
    if (!confirm('Put every plan and price back to the ones the site launched with?')) return;
    try { const r = await api('/pricing/reset', { method: 'POST' }); toast(r.published ? 'Restored and published' : 'Restored'); viewPricing(view); }
    catch (err) { msg.textContent = err.message; }
  });

  drawPlans(); drawRates(); drawRegionPicker(); drawDurationPicker(); drawPreview();

  view.replaceChildren(
    head('Fees & Plans',
      P.custom ? `Your own prices · last published ${dt(P.updated_at)}` : 'Showing the prices the site launched with',
      reset, publish),
    msg,
    el('div', { class: 'card' },
      el('div', { class: 'sec-label' }, 'Preview'),
      el('div', { class: 'row', style: 'margin-bottom:.8rem' }, regionPick, durationPick),
      pvBox,
      el('p', { class: 'muted', style: 'margin-top:.7rem' },
        'This is what the pricing page will show once you publish. Nothing changes on the website until then.')),
    el('div', { class: 'card' },
      el('div', { class: 'sec-label' }, 'Plans'),
      plansBox,
      el('div', { class: 'row', style: 'margin-top:.8rem' },
        el('button', { class: 'btn btn--ghost btn--sm', onclick: () => {
          const last = P.plans[P.plans.length - 1];
          P.plans.push({ per: Number(last?.per || 0) + 1, name: '', blurb: '', badge: '', discount: 0, features: [] });
          drawPlans(); drawPreview();
        } }, 'Add a plan'))),
    el('div', { class: 'card' },
      el('div', { class: 'sec-label' }, 'Countries & rates'),
      el('p', { class: 'muted', style: 'margin:-.3rem 0 .8rem' },
        'Each rate is the monthly fee for one class a week. A plan multiplies it by its classes a week, then takes off that plan’s discount.'),
      el('div', { class: 'row', style: 'margin-bottom:.9rem' }, labelled('Class lengths in minutes', durInput, 'Separate with commas')),
      ratesBox,
      el('div', { class: 'row', style: 'margin-top:.8rem' },
        el('button', { class: 'btn btn--ghost btn--sm', onclick: addRegion }, 'Add a country'))),
  );
}

/* ---------------- router ---------------- */
const RENDER = { dashboard: viewDashboard, leads: viewLeads, tutors: viewTutors, invoices: viewInvoices, expenses: viewExpenses, pnl: viewPnl, courses: viewCourses, pricing: viewPricing, security: viewSecurity, settings: viewSettings };

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
function showApp() { $('#login').classList.add('hide'); $('#app').classList.remove('hide'); route(); startWatching(); }

/* show/hide for any password field marked with a reveal button */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-reveal]');
  if (!btn) return;
  const input = btn.parentElement.querySelector('input');
  if (!input) return;
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  btn.setAttribute('aria-pressed', String(!showing));
  btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  btn.title = showing ? 'Show password' : 'Hide password';
});

/* --- lost password: recovery key -> new password --- */
const show = (id) => ['loginForm', 'resetForm', 'resetDone'].forEach((n) => $('#' + n).classList.toggle('hide', n !== id));
on($('#forgotBtn'), 'click', () => { $('#resetErr').textContent = ''; show('resetForm'); $('#resetForm').key.focus(); });
on($('#backBtn'), 'click', () => show('loginForm'));
on($('#doneBtn'), 'click', () => showApp());

on($('#resetForm'), 'submit', async (e) => {
  e.preventDefault();
  const err = $('#resetErr'); err.textContent = '';
  try {
    const r = await api('/recovery/reset', { method: 'POST', body: { key: e.target.key.value, password: e.target.password.value } });
    $('#newKey').textContent = r.recovery_key;
    show('resetDone');
  } catch (ex) { err.textContent = ex.message; }
});
on($('#copyKey'), 'click', () => copy($('#newKey').textContent, 'Recovery key copied'));

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#loginErr'); err.textContent = '';
  try {
    await api('/login', { method: 'POST', body: { password: e.target.password.value } });
    showApp();
  } catch (ex) { err.textContent = ex.message; }
});
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-logout]')) { clearInterval(watchTimer); await api('/logout', { method: 'POST' }); location.hash = ''; showLogin(); }
});
window.addEventListener('hashchange', route);

(async () => {
  const { authed } = await api('/session');
  authed ? showApp() : showLogin();
})();
