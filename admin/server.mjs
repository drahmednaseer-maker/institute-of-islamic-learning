/* Admin backend for the Institute of Islamic Learning.
   Plain node:http + node:sqlite — no dependencies. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { db, newId, nowISO, getSetting, setSetting, nextInvoiceNumber, getInvoice, invoiceTotals } from './lib/db.mjs';
import { isAuthed, issueCookie, clearCookie, checkPassword, setPassword, hasPassword } from './lib/auth.mjs';
import { formatLead, formatLeadOneLine, formatInvoice, formatTutor, waLink, money, prettyDate } from './lib/format.mjs';
import { invoiceHTML } from './lib/invoice-html.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const UI = join(here, 'ui');
const PORT = Number(process.env.PORT || 4400);

/* First boot: make sure there is a password rather than an open admin. */
if (!hasPassword()) {
  const initial = process.env.ADMIN_PASSWORD || randomBytes(6).toString('base64url');
  setPassword(initial);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('\n  No ADMIN_PASSWORD set — generated one for this install:\n');
    console.log(`      ${initial}\n`);
    console.log('  Sign in with it, then change it under Settings.\n');
  }
} else if (process.env.ADMIN_PASSWORD && process.env.RESET_PASSWORD === '1') {
  setPassword(process.env.ADMIN_PASSWORD);
  console.log('  Password reset from ADMIN_PASSWORD.');
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

const send = (res, status, body, headers = {}) => {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(payload);
};
const ok = (res, body = { ok: true }, headers = {}) => send(res, 200, body, headers);
const bad = (res, msg, status = 400) => send(res, status, { error: msg });

async function readBody(req, limit = 1e6) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error('payload too large');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new Error('invalid JSON'); }
}

const str = (v, max = 2000) => (v === undefined || v === null ? null : String(v).trim().slice(0, max) || null);
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const today = () => new Date().toISOString().slice(0, 10);

/* Simple per-IP throttle for the public intake endpoint. */
const hits = new Map();
function throttled(ip, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > windowMs) { hits.set(ip, { start: now, n: 1 }); return false; }
  rec.n += 1;
  if (hits.size > 5000) hits.clear();
  return rec.n > max;
}

const orgSettings = () => ({
  org_name: getSetting('org_name'),
  org_phone: getSetting('org_phone'),
  org_email: getSetting('org_email'),
  invoice_terms: getSetting('invoice_terms'),
  base_currency: getSetting('base_currency'),
  expense_heads: getSetting('expense_heads'),
  invoice_prefix: getSetting('invoice_prefix'),
  fx_rates: getSetting('fx_rates'),
});

/* ---------------- lead helpers ---------------- */
const LEAD_FIELDS = ['name', 'email', 'phone', 'country', 'course', 'student', 'days', 'preferred_time', 'notes'];

function insertLead(data, source = 'website') {
  const id = newId('lea');
  const at = nowISO();
  db.prepare(`INSERT INTO leads (id,created_at,updated_at,name,email,phone,country,course,student,days,preferred_time,notes,source,status)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'new')`)
    .run(id, at, at, str(data.name, 120) || 'Unnamed enquiry', str(data.email, 160), str(data.phone, 60),
      str(data.country, 80), str(data.course, 120), str(data.student, 80), str(data.days, 80),
      str(data.time ?? data.preferred_time, 120), str(data.notes, 2000), str(source, 40));
  return id;
}

const leadWithTutor = (id) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!lead) return null;
  const tutor = lead.tutor_id ? db.prepare('SELECT * FROM tutors WHERE id = ?').get(lead.tutor_id) : null;
  return { lead, tutor };
};

/* ---------------- routes ---------------- */
const routes = [];
const route = (method, pattern, handler, opts = {}) => routes.push({ method, pattern, handler, ...opts });

/* --- auth --- */
route('POST', /^\/api\/login$/, async (req, res) => {
  const body = await readBody(req);
  if (!checkPassword(body.password)) return bad(res, 'Incorrect password', 401);
  return ok(res, { ok: true }, { 'Set-Cookie': issueCookie() });
}, { open: true });

route('POST', /^\/api\/logout$/, async (_req, res) => ok(res, { ok: true }, { 'Set-Cookie': clearCookie() }), { open: true });
route('GET', /^\/api\/session$/, async (req, res) => ok(res, { authed: isAuthed(req) }), { open: true });

/* --- public intake: the website's booking form posts here --- */
route('POST', /^\/api\/public\/leads$/, async (req, res) => {
  const ip = req.socket.remoteAddress || 'unknown';
  if (throttled(ip)) return bad(res, 'Too many submissions, please try again shortly', 429);
  const body = await readBody(req, 50_000);
  if (!str(body.name) && !str(body.phone) && !str(body.email)) return bad(res, 'Name and a contact are required');
  if (str(body.company)) return ok(res, { ok: true });            /* honeypot */
  const id = insertLead(body, str(body.source, 40) || 'website');
  return ok(res, { ok: true, ref: id });
}, { open: true, cors: true });

/* --- leads --- */
route('GET', /^\/api\/leads$/, async (req, res, { url }) => {
  const status = url.searchParams.get('status');
  const q = url.searchParams.get('q');
  let sql = 'SELECT l.*, t.name AS tutor_name FROM leads l LEFT JOIN tutors t ON t.id = l.tutor_id';
  const where = [], args = [];
  if (status && status !== 'all') { where.push('l.status = ?'); args.push(status); }
  if (q) { where.push('(l.name LIKE ? OR l.phone LIKE ? OR l.email LIKE ? OR l.course LIKE ?)'); args.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY l.created_at DESC LIMIT 500';
  const rows = db.prepare(sql).all(...args);
  const counts = db.prepare('SELECT status, COUNT(*) n FROM leads GROUP BY status').all();
  return ok(res, { leads: rows, counts });
});

route('POST', /^\/api\/leads$/, async (req, res) => {
  const body = await readBody(req);
  if (!str(body.name)) return bad(res, 'Name is required');
  return ok(res, { id: insertLead(body, str(body.source, 40) || 'manual') });
});

route('PATCH', /^\/api\/leads\/([\w-]+)$/, async (req, res, { params }) => {
  const body = await readBody(req);
  const fields = [], args = [];
  for (const f of [...LEAD_FIELDS, 'status', 'tutor_id']) {
    if (f in body) { fields.push(`${f} = ?`); args.push(str(body[f])); }
  }
  if (!fields.length) return bad(res, 'Nothing to update');
  fields.push('updated_at = ?'); args.push(nowISO(), params[0]);
  db.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  return ok(res, leadWithTutor(params[0]));
});

route('DELETE', /^\/api\/leads\/([\w-]+)$/, async (_req, res, { params }) => {
  db.prepare('DELETE FROM leads WHERE id = ?').run(params[0]);
  return ok(res);
});

route('GET', /^\/api\/leads\/([\w-]+)\/share$/, async (_req, res, { params }) => {
  const found = leadWithTutor(params[0]);
  if (!found) return bad(res, 'Lead not found', 404);
  const org = orgSettings();
  const text = formatLead(found.lead, { tutor: found.tutor, orgName: org.org_name });
  return ok(res, {
    ...text,
    oneLine: formatLeadOneLine(found.lead),
    waTutor: found.tutor ? waLink(found.tutor.phone, text.whatsapp) : null,
    waStudent: found.lead.phone ? waLink(found.lead.phone, text.whatsapp) : null,
    waOpen: waLink('', text.whatsapp),
  });
});

/* --- tutors --- */
route('GET', /^\/api\/tutors$/, async (_req, res) =>
  ok(res, { tutors: db.prepare('SELECT * FROM tutors ORDER BY status, name').all() }));

route('POST', /^\/api\/tutors$/, async (req, res) => {
  const b = await readBody(req);
  if (!str(b.name) || !str(b.phone)) return bad(res, 'Name and phone are required');
  const id = newId('tut');
  db.prepare(`INSERT INTO tutors (id,created_at,name,phone,email,gender,subjects,languages,timezone,rate,rate_currency,status,notes)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, nowISO(), str(b.name, 120), str(b.phone, 60), str(b.email, 160), str(b.gender, 20),
      str(b.subjects, 300), str(b.languages, 200), str(b.timezone, 60), num(b.rate, 0),
      str(b.rate_currency, 8) || 'PKR', str(b.status, 20) || 'active', str(b.notes, 1000));
  return ok(res, { id });
});

route('PATCH', /^\/api\/tutors\/([\w-]+)$/, async (req, res, { params }) => {
  const b = await readBody(req);
  const cols = ['name', 'phone', 'email', 'gender', 'subjects', 'languages', 'timezone', 'rate_currency', 'status', 'notes'];
  const fields = [], args = [];
  for (const c of cols) if (c in b) { fields.push(`${c} = ?`); args.push(str(b[c])); }
  if ('rate' in b) { fields.push('rate = ?'); args.push(num(b.rate, 0)); }
  if (!fields.length) return bad(res, 'Nothing to update');
  args.push(params[0]);
  db.prepare(`UPDATE tutors SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  return ok(res);
});

route('DELETE', /^\/api\/tutors\/([\w-]+)$/, async (_req, res, { params }) => {
  db.prepare('DELETE FROM tutors WHERE id = ?').run(params[0]);
  return ok(res);
});

route('GET', /^\/api\/tutors\/([\w-]+)\/share$/, async (_req, res, { params }) => {
  const t = db.prepare('SELECT * FROM tutors WHERE id = ?').get(params[0]);
  if (!t) return bad(res, 'Tutor not found', 404);
  const text = formatTutor(t);
  return ok(res, { ...text, wa: waLink(t.phone, `Assalamu Alaikum ${t.name},`) });
});

/* --- clients --- */
route('GET', /^\/api\/clients$/, async (_req, res) =>
  ok(res, { clients: db.prepare('SELECT * FROM clients ORDER BY name').all() }));

route('POST', /^\/api\/clients$/, async (req, res) => {
  const b = await readBody(req);
  if (!str(b.name)) return bad(res, 'Name is required');
  const id = newId('cli');
  db.prepare('INSERT INTO clients (id,created_at,name,phone,email,country,currency,notes) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, nowISO(), str(b.name, 120), str(b.phone, 60), str(b.email, 160), str(b.country, 80), str(b.currency, 8) || 'USD', str(b.notes, 1000));
  return ok(res, { id });
});

route('DELETE', /^\/api\/clients\/([\w-]+)$/, async (_req, res, { params }) => {
  db.prepare('DELETE FROM clients WHERE id = ?').run(params[0]);
  return ok(res);
});

/* --- invoices --- */
function writeItems(invoiceId, items) {
  db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
  const stmt = db.prepare('INSERT INTO invoice_items (id,invoice_id,description,qty,rate,sort) VALUES (?,?,?,?,?,?)');
  (items || []).forEach((it, i) => {
    if (!str(it.description)) return;
    stmt.run(newId('itm'), invoiceId, str(it.description, 300), num(it.qty, 1), num(it.rate, 0), i);
  });
}

route('GET', /^\/api\/invoices$/, async (req, res, { url }) => {
  const status = url.searchParams.get('status');
  let sql = 'SELECT * FROM invoices';
  const args = [];
  if (status && status !== 'all') { sql += ' WHERE status = ?'; args.push(status); }
  sql += ' ORDER BY issue_date DESC, number DESC LIMIT 500';
  const rows = db.prepare(sql).all(...args).map((inv) => {
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id);
    return { ...inv, totals: invoiceTotals(inv, items), item_count: items.length };
  });
  return ok(res, { invoices: rows, nextNumber: nextInvoiceNumber() });
});

route('GET', /^\/api\/invoices\/([\w-]+)$/, async (_req, res, { params }) => {
  const inv = getInvoice(params[0]);
  return inv ? ok(res, inv) : bad(res, 'Invoice not found', 404);
});

route('POST', /^\/api\/invoices$/, async (req, res) => {
  const b = await readBody(req);
  if (!str(b.client_name)) return bad(res, 'Client name is required');
  const id = newId('inv');
  const issue = str(b.issue_date, 12) || today();
  const number = str(b.number, 40) || nextInvoiceNumber(new Date(`${issue}T00:00:00`).getFullYear());
  db.prepare(`INSERT INTO invoices (id,number,created_at,client_id,client_name,client_phone,client_email,currency,issue_date,due_date,status,discount,notes)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, number, nowISO(), str(b.client_id), str(b.client_name, 120), str(b.client_phone, 60), str(b.client_email, 160),
      str(b.currency, 8) || 'USD', issue, str(b.due_date, 12), str(b.status, 20) || 'draft', num(b.discount, 0), str(b.notes, 2000));
  writeItems(id, b.items);
  return ok(res, getInvoice(id));
});

route('PATCH', /^\/api\/invoices\/([\w-]+)$/, async (req, res, { params }) => {
  const b = await readBody(req);
  const cols = ['client_name', 'client_phone', 'client_email', 'currency', 'issue_date', 'due_date', 'status', 'notes', 'paid_date'];
  const fields = [], args = [];
  for (const c of cols) if (c in b) { fields.push(`${c} = ?`); args.push(str(b[c])); }
  if ('discount' in b) { fields.push('discount = ?'); args.push(num(b.discount, 0)); }
  /* marking paid stamps the date the P&L reports against */
  if (b.status === 'paid' && !('paid_date' in b)) { fields.push('paid_date = ?'); args.push(today()); }
  if (b.status && b.status !== 'paid') { fields.push('paid_date = ?'); args.push(null); }
  if (fields.length) { args.push(params[0]); db.prepare(`UPDATE invoices SET ${fields.join(', ')} WHERE id = ?`).run(...args); }
  if (Array.isArray(b.items)) writeItems(params[0], b.items);
  const inv = getInvoice(params[0]);
  return inv ? ok(res, inv) : bad(res, 'Invoice not found', 404);
});

route('DELETE', /^\/api\/invoices\/([\w-]+)$/, async (_req, res, { params }) => {
  db.prepare('DELETE FROM invoices WHERE id = ?').run(params[0]);
  return ok(res);
});

route('GET', /^\/api\/invoices\/([\w-]+)\/share$/, async (_req, res, { params }) => {
  const inv = getInvoice(params[0]);
  if (!inv) return bad(res, 'Invoice not found', 404);
  const org = orgSettings();
  const text = formatInvoice(inv, { org });
  return ok(res, { ...text, wa: waLink(inv.client_phone, text.whatsapp), waOpen: waLink('', text.whatsapp), printUrl: `/invoice/${inv.id}` });
});

/* Build an invoice from the same plan maths the public pricing page uses. */
route('POST', /^\/api\/invoices\/from-plan$/, async (req, res) => {
  const b = await readBody(req);
  const { REGIONS, monthly } = await import('../src/data/pricing.mjs');
  const region = String(b.region || 'us');
  const duration = String(b.duration || '30');
  const per = num(b.perweek, 4);
  const r = REGIONS[region];
  if (!r || !r.rates[duration]) return bad(res, 'Unknown region or class length');
  const amount = monthly(region, duration, per);
  const label = `${str(b.course, 120) || 'Quran classes'} — ${per} × ${duration} min per week${b.period ? ` (${str(b.period, 40)})` : ''}`;
  return ok(res, {
    currency: r.code,
    items: [{ description: label, qty: 1, rate: amount }],
    hint: `${per * 4} classes per month at ${r.label} rates`,
  });
});

/* --- expenses --- */
route('GET', /^\/api\/expenses$/, async (req, res, { url }) => {
  const month = url.searchParams.get('month');
  let sql = 'SELECT e.*, t.name AS tutor_name FROM expenses e LEFT JOIN tutors t ON t.id = e.tutor_id';
  const args = [];
  if (month) { sql += " WHERE substr(e.date,1,7) = ?"; args.push(month); }
  sql += ' ORDER BY e.date DESC, e.rowid DESC LIMIT 500';
  return ok(res, { expenses: db.prepare(sql).all(...args), heads: getSetting('expense_heads').split(',').map((s) => s.trim()) });
});

route('POST', /^\/api\/expenses$/, async (req, res) => {
  const b = await readBody(req);
  if (!str(b.head)) return bad(res, 'Expense head is required');
  if (!Number.isFinite(Number(b.amount)) || Number(b.amount) <= 0) return bad(res, 'Amount must be greater than zero');
  const id = newId('exp');
  db.prepare('INSERT INTO expenses (id,created_at,date,head,description,amount,currency,tutor_id,notes) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, nowISO(), str(b.date, 12) || today(), str(b.head, 60), str(b.description, 300), num(b.amount, 0),
      str(b.currency, 8) || getSetting('base_currency'), str(b.tutor_id), str(b.notes, 1000));
  return ok(res, { id });
});

route('PATCH', /^\/api\/expenses\/([\w-]+)$/, async (req, res, { params }) => {
  const b = await readBody(req);
  const cols = ['date', 'head', 'description', 'currency', 'tutor_id', 'notes'];
  const fields = [], args = [];
  for (const c of cols) if (c in b) { fields.push(`${c} = ?`); args.push(str(b[c])); }
  if ('amount' in b) { fields.push('amount = ?'); args.push(num(b.amount, 0)); }
  if (!fields.length) return bad(res, 'Nothing to update');
  args.push(params[0]);
  db.prepare(`UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`).run(...args);
  return ok(res);
});

route('DELETE', /^\/api\/expenses\/([\w-]+)$/, async (_req, res, { params }) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(params[0]);
  return ok(res);
});

/* --- profit & loss --- */
route('GET', /^\/api\/report\/pnl$/, async (req, res, { url }) => {
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const base = getSetting('base_currency');
  let rates = {};
  try { rates = JSON.parse(getSetting('fx_rates') || '{}'); } catch {}
  const rateFor = (c) => (c === base ? 1 : Number(rates[c]) || null);

  const paid = db.prepare("SELECT * FROM invoices WHERE status = 'paid' AND substr(COALESCE(paid_date, issue_date),1,7) = ?").all(month);
  const income = {};
  let incomeBase = 0, incomeUnconverted = [];
  for (const inv of paid) {
    const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(inv.id);
    const t = invoiceTotals(inv, items).total;
    income[inv.currency] = (income[inv.currency] || 0) + t;
  }
  for (const [c, v] of Object.entries(income)) {
    const r = rateFor(c);
    if (r === null) incomeUnconverted.push(c); else incomeBase += v * r;
  }

  const rows = db.prepare('SELECT head, currency, SUM(amount) total FROM expenses WHERE substr(date,1,7) = ? GROUP BY head, currency').all(month);
  const byHead = {};
  let expenseBase = 0; const expenseUnconverted = [];
  for (const r of rows) {
    byHead[r.head] = byHead[r.head] || { head: r.head, currencies: {}, base: 0 };
    byHead[r.head].currencies[r.currency] = (byHead[r.head].currencies[r.currency] || 0) + r.total;
    const rate = rateFor(r.currency);
    if (rate === null) { if (!expenseUnconverted.includes(r.currency)) expenseUnconverted.push(r.currency); }
    else { byHead[r.head].base += r.total * rate; expenseBase += r.total * rate; }
  }

  const outstanding = db.prepare("SELECT currency, COUNT(*) n FROM invoices WHERE status IN ('draft','sent') GROUP BY currency").all();

  return ok(res, {
    month, base,
    income, incomeBase, incomeUnconverted,
    expensesByHead: Object.values(byHead).sort((a, b) => b.base - a.base),
    expenseBase, expenseUnconverted,
    net: incomeBase - expenseBase,
    paidCount: paid.length,
    outstanding,
    missingRates: [...new Set([...incomeUnconverted, ...expenseUnconverted])],
  });
});

/* --- dashboard --- */
route('GET', /^\/api\/summary$/, async (_req, res) => {
  const month = new Date().toISOString().slice(0, 7);
  return ok(res, {
    newLeads: db.prepare("SELECT COUNT(*) n FROM leads WHERE status = 'new'").get().n,
    leadsThisMonth: db.prepare('SELECT COUNT(*) n FROM leads WHERE substr(created_at,1,7) = ?').get(month).n,
    tutors: db.prepare("SELECT COUNT(*) n FROM tutors WHERE status = 'active'").get().n,
    unpaid: db.prepare("SELECT COUNT(*) n FROM invoices WHERE status IN ('draft','sent')").get().n,
    month,
  });
});

/* --- settings --- */
route('GET', /^\/api\/settings$/, async (_req, res) => ok(res, orgSettings()));

route('PATCH', /^\/api\/settings$/, async (req, res) => {
  const b = await readBody(req);
  const allowed = ['org_name', 'org_phone', 'org_email', 'invoice_terms', 'base_currency', 'expense_heads', 'invoice_prefix', 'fx_rates'];
  for (const k of allowed) if (k in b) setSetting(k, str(b[k], 4000) ?? '');
  if (str(b.new_password)) {
    if (String(b.new_password).length < 8) return bad(res, 'Password must be at least 8 characters');
    setPassword(String(b.new_password));
  }
  return ok(res, orgSettings());
});

/* ---------------- http ---------------- */
/* SITE_ORIGIN may list several origins; the matching one is echoed back so
   the production site and a local build can both post enquiries. */
const ALLOWED = (process.env.SITE_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
const corsFor = (req) => {
  const origin = req.headers.origin;
  const allow = !ALLOWED.length ? '*' : (ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  return {
    'Access-Control-Allow-Origin': allow,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') { res.writeHead(204, corsFor(req)); return res.end(); }

  if (path.startsWith('/api/')) {
    const match = routes.find((r) => r.method === req.method && r.pattern.test(path));
    if (!match) return bad(res, 'Not found', 404);
    if (!match.open && !isAuthed(req)) return bad(res, 'Not signed in', 401);
    const params = path.match(match.pattern).slice(1);
    try {
      if (match.cors) for (const [k, v] of Object.entries(corsFor(req))) res.setHeader(k, v);
      return await match.handler(req, res, { url, params });
    } catch (err) {
      console.error(`${req.method} ${path}`, err);
      return bad(res, err.message || 'Server error', 500);
    }
  }

  /* printable invoice document */
  const printMatch = path.match(/^\/invoice\/([\w-]+)$/);
  if (printMatch) {
    if (!isAuthed(req)) { res.writeHead(302, { Location: '/' }); return res.end(); }
    const inv = getInvoice(printMatch[1]);
    if (!inv) return bad(res, 'Invoice not found', 404);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(invoiceHTML(inv, orgSettings()));
  }

  /* static admin UI */
  const rel = path === '/' ? 'index.html' : path.replace(/^\/+/, '');
  const file = join(UI, rel);
  if (!file.startsWith(UI)) return bad(res, 'Not found', 404);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    return res.end(body);
  } catch {
    try {
      const body = await readFile(join(UI, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(body);
    } catch { return bad(res, 'Not found', 404); }
  }
});

server.listen(PORT, () => console.log(`  Admin backend on http://localhost:${PORT}\n`));
