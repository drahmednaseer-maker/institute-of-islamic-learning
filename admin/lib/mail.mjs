/* Minimal SMTP sender — no dependencies.
   Configure with SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO.
   Without those it reports itself as unconfigured and sends nothing. */
import net from 'node:net';
import tls from 'node:tls';

export const mailConfig = () => ({
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT || 587),
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.MAIL_FROM || process.env.SMTP_USER || '',
  to: process.env.MAIL_TO || '',
  secure: String(process.env.SMTP_SECURE || '') === '1' || Number(process.env.SMTP_PORT) === 465,
});

export const mailReady = () => {
  const c = mailConfig();
  return Boolean(c.host && c.user && c.pass && c.from && c.to);
};

/* Wraps a socket in a line-oriented request/response conversation. */
function conversation(socket) {
  let buffer = '';
  let waiting = null;
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    /* a reply ends with "250 text\r\n"; continuation lines use "250-text" */
    const m = buffer.match(/^(?:\d{3}-[^\n]*\n)*(\d{3}) [^\n]*\r?\n$/);
    if (m && waiting) {
      const { resolve, reject, expect } = waiting;
      const code = Number(m[1]);
      const text = buffer.trim();
      buffer = ''; waiting = null;
      expect.includes(code) ? resolve({ code, text }) : reject(new Error(`SMTP ${code}: ${text}`));
    }
  });
  return {
    send(line, expect = [250]) {
      return new Promise((resolve, reject) => {
        waiting = { resolve, reject, expect };
        if (line !== null) socket.write(`${line}\r\n`);
      });
    },
  };
}

const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');
/* non-ASCII subjects have to be encoded for the header */
const encodeHeader = (s) => (/^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

export async function sendMail({ subject, text, replyTo }) {
  const c = mailConfig();
  if (!mailReady()) return { ok: false, skipped: true, reason: 'SMTP is not configured' };

  const connect = () => new Promise((resolve, reject) => {
    const socket = c.secure
      ? tls.connect({ host: c.host, port: c.port, servername: c.host }, () => resolve(socket))
      : net.connect({ host: c.host, port: c.port }, () => resolve(socket));
    socket.setTimeout(15000, () => { socket.destroy(); reject(new Error('SMTP timed out')); });
    socket.on('error', reject);
  });

  let socket = await connect();
  let chat = conversation(socket);
  try {
    await chat.send(null, [220]);
    await chat.send(`EHLO ${c.host}`);

    if (!c.secure) {
      await chat.send('STARTTLS', [220]);
      socket = tls.connect({ socket, servername: c.host });
      await new Promise((res, rej) => { socket.once('secureConnect', res); socket.once('error', rej); });
      chat = conversation(socket);
      await chat.send(`EHLO ${c.host}`);
    }

    await chat.send('AUTH LOGIN', [334]);
    await chat.send(b64(c.user), [334]);
    await chat.send(b64(c.pass), [235]);

    await chat.send(`MAIL FROM:<${c.from}>`);
    for (const rcpt of c.to.split(',').map((s) => s.trim()).filter(Boolean)) {
      await chat.send(`RCPT TO:<${rcpt}>`, [250, 251]);
    }
    await chat.send('DATA', [354]);

    const headers = [
      `From: Institute of Islamic Learning <${c.from}>`,
      `To: ${c.to}`,
      replyTo ? `Reply-To: ${replyTo}` : null,
      `Subject: ${encodeHeader(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
    ].filter(Boolean).join('\r\n');

    const body = b64(text).replace(/(.{76})/g, '$1\r\n');
    await chat.send(`${headers}\r\n\r\n${body}\r\n.`);
    await chat.send('QUIT', [221]).catch(() => {});
    socket.end();
    return { ok: true };
  } catch (err) {
    try { socket.destroy(); } catch {}
    return { ok: false, error: err.message };
  }
}
