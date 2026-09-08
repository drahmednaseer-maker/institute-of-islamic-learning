/* Password login with an HMAC-signed session cookie. No dependencies. */
import { createHmac, randomBytes, timingSafeEqual, scryptSync } from 'node:crypto';
import { getSetting, setSetting } from './db.mjs';

const COOKIE = 'iil_session';
const MAX_AGE = 60 * 60 * 12; /* 12 hours */

function secret() {
  let s = process.env.SESSION_SECRET || getSetting('session_secret');
  if (!s) { s = randomBytes(32).toString('hex'); setSetting('session_secret', s); }
  return s;
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => createHmac('sha256', secret()).update(data).digest('base64url');

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

/* Password is stored as scrypt(salt) so the plain value never sits on disk. */
export function setPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  setSetting('admin_password', `${salt}:${hash}`);
}

export function checkPassword(plain) {
  const stored = getSetting('admin_password');
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  return safeEqual(hash, scryptSync(String(plain), salt, 64).toString('hex'));
}

export const hasPassword = () => Boolean(getSetting('admin_password'));

export function issueCookie() {
  const payload = b64u(JSON.stringify({ exp: Date.now() + MAX_AGE * 1000 }));
  const token = `${payload}.${sign(payload)}`;
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export function isAuthed(req) {
  const raw = req.headers.cookie || '';
  const hit = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`));
  if (!hit) return false;
  const [payload, mac] = hit.slice(COOKIE.length + 1).split('.');
  if (!payload || !mac || !safeEqual(mac, sign(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > Date.now();
  } catch { return false; }
}
