'use strict';
const crypto = require('crypto');

// ---------- passwords (scrypt, built into Node) ----------
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const dk = crypto.scryptSync(String(pw), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${dk.toString('base64')}`;
}
function verifyPassword(pw, stored) {
  try {
    const [alg, N, r, p, saltB64, dkB64] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const dk = Buffer.from(dkB64, 'base64');
    const got = crypto.scryptSync(String(pw), Buffer.from(saltB64, 'base64'), dk.length, { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(dk, got);
  } catch { return false; }
}
// Used when the username doesn't exist, so response time doesn't reveal valid usernames.
const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString('hex'));

function passwordProblem(pw) {
  pw = String(pw || '');
  if (pw.length < 10) return 'Password must be at least 10 characters.';
  if (pw.length > 200) return 'Password is too long.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain letters and numbers.';
  return null;
}
function usernameProblem(u) {
  u = String(u || '').trim();
  if (!/^[A-Za-z0-9._@-]{3,40}$/.test(u)) return 'Username must be 3–40 characters: letters, numbers, . _ - @';
  return null;
}

// ---------- signed session tokens ----------
function b64u(buf) { return Buffer.from(buf).toString('base64url'); }
function sign(payload, secret) {
  const body = b64u(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function unsign(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expect = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p.exp || Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}

// ---------- secret encryption at rest (AES-256-GCM) ----------
function deriveKey(secret) {
  return crypto.createHash('sha256').update('nvo-settings-v1:' + secret).digest();
}
function encrypt(plain, secret) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return { v: 1, iv: b64u(iv), tag: b64u(c.getAuthTag()), ct: b64u(ct) };
}
function decrypt(box, secret) {
  const d = crypto.createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(box.iv, 'base64url'));
  d.setAuthTag(Buffer.from(box.tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(box.ct, 'base64url')), d.final()]).toString('utf8');
}

// ---------- login throttling (in memory) ----------
class Throttle {
  constructor({ max = 5, windowMs = 15 * 60e3, lockMs = 15 * 60e3 } = {}) {
    Object.assign(this, { max, windowMs, lockMs });
    this.map = new Map();
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.map) if (now - v.first > this.windowMs && (!v.lockUntil || now > v.lockUntil)) this.map.delete(k);
    }, 60e3).unref();
  }
  blockedFor(key) {
    const v = this.map.get(key);
    if (v?.lockUntil && Date.now() < v.lockUntil) return Math.ceil((v.lockUntil - Date.now()) / 1000);
    return 0;
  }
  fail(key) {
    const now = Date.now();
    let v = this.map.get(key);
    if (!v || now - v.first > this.windowMs) v = { first: now, n: 0 };
    v.n++;
    if (v.n >= this.max) { v.lockUntil = now + this.lockMs; v.n = 0; v.first = now; }
    this.map.set(key, v);
  }
  clear(key) { this.map.delete(key); }
}

module.exports = { hashPassword, verifyPassword, DUMMY_HASH, passwordProblem, usernameProblem, sign, unsign, encrypt, decrypt, Throttle };
