/* A printable invoice document — A4, letterhead, itemised table, totals.
   Rendered server-side so "Print / PDF" produces a real document rather
   than a screenshot of the admin UI. */
import { money, prettyDate } from './format.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');

export function invoiceHTML(inv, org = {}) {
  const c = inv.currency;
  const rows = inv.items.map((it, i) => `
      <tr>
        <td class="idx">${i + 1}</td>
        <td>${esc(it.description)}</td>
        <td class="n">${Number(it.qty) % 1 === 0 ? Number(it.qty) : Number(it.qty).toFixed(2)}</td>
        <td class="n">${money(it.rate, c)}</td>
        <td class="n">${money(Number(it.qty) * Number(it.rate), c)}</td>
      </tr>`).join('');

  const overdue = inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date(new Date().toDateString());

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(inv.number)} · ${esc(org.org_name || 'Invoice')}</title>
<style>
@font-face{font-family:Amiri;src:url(/fonts/amiri-400-latin.woff2) format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:Amiri;src:url(/fonts/amiri-700-latin.woff2) format("woff2");font-weight:700;font-display:swap}
:root{--ink:#16130F;--dim:#6A645A;--line:#E2DCD0;--green:#0B3B2E;--gold:#B27F2C;--paid:#1E7A4D;--red:#C0392B}
*,*::before,*::after{box-sizing:border-box}*{margin:0}
body{font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:#EDEAE3;padding:24px}
.sheet{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:18mm 16mm;box-shadow:0 8px 30px rgba(0,0,0,.12);position:relative}

.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding-bottom:14px;border-bottom:2px solid var(--green)}
.brand{display:flex;gap:12px;align-items:center}
.brand img{width:60px;height:60px;border-radius:50%;box-shadow:0 0 0 1px var(--line)}
.brand h1{font-family:Amiri,Georgia,serif;font-size:19px;line-height:1.2;color:var(--green)}
.brand .sub{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
.brand .meta{font-size:11.5px;color:var(--dim);margin-top:5px}
.title{text-align:right}
.title h2{font-family:Amiri,Georgia,serif;font-size:30px;letter-spacing:.06em;color:var(--green);line-height:1}
.title .num{font-size:13px;font-weight:700;margin-top:4px}
.badge{display:inline-block;margin-top:7px;padding:3px 11px;border-radius:99px;font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
.b-paid{background:#DDF0E6;color:var(--paid)}.b-sent{background:#E3EEFA;color:#2F6FB0}
.b-draft{background:#EDEAE3;color:var(--dim)}.b-overdue{background:#F7E3E0;color:var(--red)}

.cols{display:flex;justify-content:space-between;gap:26px;margin:20px 0 18px}
.lbl{font-size:9.5px;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:5px}
.cols b{font-size:15px}
.cols .line{font-size:12.5px;color:var(--dim)}
.dates{text-align:right;font-size:12.5px;min-width:190px}
.dates div{display:flex;justify-content:space-between;gap:16px;padding:1.5px 0}
.dates span{color:var(--dim)}

table{width:100%;border-collapse:collapse;margin-top:4px}
thead th{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#fff;background:var(--green);padding:8px 10px;text-align:left;font-weight:700}
thead th.n{text-align:right}
tbody td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top;font-size:13px}
tbody td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tbody td.idx{color:var(--dim);width:26px}
tbody tr:nth-child(even){background:#FBF9F5}

.sum{display:flex;justify-content:flex-end;margin-top:14px}
.sum table{width:275px}
.sum td{padding:5px 10px;font-size:13px}
.sum td.n{text-align:right;font-variant-numeric:tabular-nums}
.sum tr.total td{border-top:2px solid var(--green);font-size:16px;font-weight:800;padding-top:9px;color:var(--green)}

.note{margin-top:22px;padding-top:12px;border-top:1px solid var(--line);font-size:12px;color:var(--dim)}
.note .lbl{color:var(--gold)}
.foot{position:absolute;left:16mm;right:16mm;bottom:12mm;padding-top:9px;border-top:1px solid var(--line);
  display:flex;justify-content:space-between;gap:14px;font-size:10.5px;color:var(--dim)}
/* sits in the whitespace below the terms, clear of the items table */
.stamp{position:absolute;right:30mm;bottom:52mm;font-family:Amiri,Georgia,serif;font-size:58px;font-weight:700;
  letter-spacing:.1em;color:rgba(30,122,77,.16);border:5px solid rgba(30,122,77,.16);padding:6px 24px;border-radius:10px;
  transform:rotate(-14deg);pointer-events:none;z-index:2}

.bar{position:sticky;top:0;display:flex;gap:8px;justify-content:center;padding:0 0 16px}
.bar button,.bar a{font:inherit;font-size:13px;font-weight:650;padding:8px 16px;border-radius:99px;border:1.5px solid var(--line);background:#fff;cursor:pointer;text-decoration:none;color:var(--ink)}
.bar .go{background:var(--green);border-color:var(--green);color:#fff}
@media print{
  @page{size:A4;margin:0}
  body{background:#fff;padding:0}
  .sheet{width:auto;min-height:auto;box-shadow:none;padding:16mm 15mm}
  .bar{display:none}
}
</style></head>
<body>
<div class="bar">
  <button class="go" onclick="window.print()">Print / Save as PDF</button>
  <a href="/#invoices">Back to invoices</a>
</div>

<div class="sheet">
  <div class="top">
    <div class="brand">
      <img src="/logo.jpg" alt="">
      <div>
        <div class="sub">Institute of</div>
        <h1>${esc((org.org_name || 'Islamic Learning').replace(/^Institute of\s*/i, ''))}</h1>
        <div class="meta">${[org.org_phone, org.org_email].filter(Boolean).map(esc).join(' · ')}</div>
      </div>
    </div>
    <div class="title">
      <h2>INVOICE</h2>
      <div class="num">${esc(inv.number)}</div>
      <span class="badge ${overdue ? 'b-overdue' : `b-${esc(inv.status)}`}">${overdue ? 'Overdue' : esc(inv.status)}</span>
    </div>
  </div>

  <div class="cols">
    <div>
      <div class="lbl">Billed to</div>
      <b>${esc(inv.client_name)}</b>
      ${inv.client_phone ? `<div class="line">${esc(inv.client_phone)}</div>` : ''}
      ${inv.client_email ? `<div class="line">${esc(inv.client_email)}</div>` : ''}
    </div>
    <div class="dates">
      <div><span>Issued</span><b>${prettyDate(inv.issue_date)}</b></div>
      ${inv.due_date ? `<div><span>Due</span><b>${prettyDate(inv.due_date)}</b></div>` : ''}
      ${inv.paid_date ? `<div><span>Paid</span><b>${prettyDate(inv.paid_date)}</b></div>` : ''}
      <div><span>Currency</span><b>${esc(c)}</b></div>
    </div>
  </div>

  <table>
    <thead><tr><th></th><th>Description</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5" style="color:#6A645A">No items on this invoice.</td></tr>'}</tbody>
  </table>

  <div class="sum"><table>
    <tr><td>Subtotal</td><td class="n">${money(inv.totals.subtotal, c)}</td></tr>
    ${inv.totals.discount ? `<tr><td>Discount</td><td class="n">−${money(inv.totals.discount, c)}</td></tr>` : ''}
    <tr class="total"><td>${inv.status === 'paid' ? 'Total paid' : 'Total due'}</td><td class="n">${money(inv.totals.total, c)}</td></tr>
  </table></div>

  ${inv.notes ? `<div class="note"><div class="lbl">Notes</div>${nl2br(inv.notes)}</div>` : ''}
  ${org.invoice_terms ? `<div class="note"><div class="lbl">Payment terms</div>${nl2br(org.invoice_terms)}</div>` : ''}

  ${inv.status === 'paid' ? '<div class="stamp">PAID</div>' : ''}

  <div class="foot">
    <span>${esc(org.org_name || '')}${org.org_phone ? ` · ${esc(org.org_phone)}` : ''}</span>
    <span>${esc(inv.number)}</span>
  </div>
</div>
</body></html>`;
}
