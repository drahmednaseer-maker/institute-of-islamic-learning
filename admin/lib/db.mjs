/* Storage for the admin backend — node:sqlite, no dependencies.
   One file on disk, transactional, and portable to any Node host. */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.IIL_DATA_DIR || join(here, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, 'iil.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  country TEXT,
  course TEXT,
  student TEXT,
  days TEXT,
  preferred_time TEXT,
  notes TEXT,
  source TEXT DEFAULT 'website',
  status TEXT NOT NULL DEFAULT 'new',
  tutor_id TEXT REFERENCES tutors(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);

CREATE TABLE IF NOT EXISTS tutors (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  gender TEXT,
  subjects TEXT,
  languages TEXT,
  timezone TEXT,
  rate REAL,
  rate_currency TEXT DEFAULT 'PKR',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  country TEXT,
  currency TEXT DEFAULT 'USD',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  client_email TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  issue_date TEXT NOT NULL,
  due_date TEXT,
  paid_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  discount REAL NOT NULL DEFAULT 0,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 1,
  rate REAL NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_items_invoice ON invoice_items(invoice_id);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  date TEXT NOT NULL,
  head TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PKR',
  tutor_id TEXT REFERENCES tutors(id) ON DELETE SET NULL,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

/* ---------- helpers ---------- */
export const nowISO = () => new Date().toISOString();
export const newId = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
/* Short, human-quotable reference for a record — safe inside WhatsApp markup. */
export const refOf = (id) => String(id).replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();

export const getSetting = (key, fallback = null) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
};
export const setSetting = (key, value) => {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, String(value));
};

const DEFAULTS = {
  org_name: 'Institute of Islamic Learning',
  org_phone: '+92 335 8076339',
  org_email: '',
  base_currency: 'PKR',
  expense_heads: 'Tutor payouts,Salaries,Marketing,Software & tools,Bank charges,Office,Other',
  fx_rates: JSON.stringify({ PKR: 1 }),
  invoice_prefix: 'IIL',
  invoice_terms: 'Fees are billed monthly. Payment is due within 7 days of the invoice date.',
};
for (const [k, v] of Object.entries(DEFAULTS)) if (getSetting(k) === null) setSetting(k, v);

/* Sequential invoice numbers: IIL-2026-001, per calendar year. */
export function nextInvoiceNumber(year = new Date().getFullYear()) {
  const prefix = getSetting('invoice_prefix', 'IIL');
  const like = `${prefix}-${year}-%`;
  const row = db.prepare('SELECT number FROM invoices WHERE number LIKE ? ORDER BY number DESC LIMIT 1').get(like);
  const last = row ? Number(String(row.number).split('-').pop()) : 0;
  return `${prefix}-${year}-${String(last + 1).padStart(3, '0')}`;
}

export function invoiceTotals(invoice, items) {
  const subtotal = items.reduce((s, i) => s + Number(i.qty) * Number(i.rate), 0);
  const discount = Number(invoice.discount || 0);
  const total = Math.max(0, subtotal - discount);
  return { subtotal, discount, total };
}

export function getInvoice(id) {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!inv) return null;
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort, rowid').all(id);
  return { ...inv, items, totals: invoiceTotals(inv, items) };
}
