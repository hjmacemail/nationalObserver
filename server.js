'use strict';
/*
 * National Vitality Observatory — platform server
 * - username/password login (scrypt hashes, signed HttpOnly session cookie)
 * - users & roles (admin / viewer)
 * - platform settings: Anthropic API key stored encrypted (AES-256-GCM), never sent to browsers
 * - AI proxy used by the Improvement Advisor
 * Designed for Railway (PORT, volume at RAILWAY_VOLUME_MOUNT_PATH), runs anywhere with Node 20+.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Store } = require('./lib/store');
const sec = require('./lib/security');

// ---------------- configuration ----------------
const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE = 'nvo_session';
const SESSION_HOURS = +process.env.SESSION_HOURS || 12;
const REMEMBER_DAYS = 30;
const ANTHROPIC_BASE = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const AI_MAX_TOKENS = +process.env.AI_MAX_TOKENS || 4000;
const AI_PER_HOUR = +process.env.AI_REQUESTS_PER_HOUR || 30;

const store = new Store(DATA_DIR);
if (process.env.RAILWAY_ENVIRONMENT_NAME && !process.env.RAILWAY_VOLUME_MOUNT_PATH && !process.env.DATA_DIR) {
  console.warn('[nvo] WARNING: no Railway volume attached — users and settings will be lost on every redeploy. Add a volume to this service.');
}

function loadSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) return process.env.SESSION_SECRET;
  if (process.env.SESSION_SECRET) console.warn('[nvo] SESSION_SECRET is shorter than 32 characters — ignoring it.');
  const f = path.join(DATA_DIR, '.session_secret');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  const s = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(f, s, { mode: 0o600 });
  console.warn('[nvo] No SESSION_SECRET set — generated one and stored it in the data directory. Set SESSION_SECRET in Railway variables for best security.');
  return s;
}
const SESSION_SECRET = loadSecret();
const ENC_SECRET = process.env.ENCRYPTION_KEY || SESSION_SECRET;

// ---------------- bootstrap admin ----------------
let setupCode = null;
(async () => {
  const u = process.env.ADMIN_USERNAME, p = process.env.ADMIN_PASSWORD;
  if (u && p) {
    const existing = store.userByName(u);
    if (!existing) {
      const prob = sec.usernameProblem(u) || sec.passwordProblem(p);
      if (prob) console.error('[nvo] ADMIN_USERNAME/ADMIN_PASSWORD rejected: ' + prob);
      else { await store.addUser({ username: u, hash: sec.hashPassword(p), role: 'admin' }); console.log(`[nvo] Created admin user "${u}" from environment.`); }
    } else if (process.env.ADMIN_PASSWORD_RESET === 'true') {
      await store.updateUser(existing.id, { hash: sec.hashPassword(p), role: 'admin', sv: (existing.sv || 1) + 1 });
      console.log(`[nvo] Reset password for "${u}" from environment (remove ADMIN_PASSWORD_RESET now).`);
    }
  }
  if (!store.users().length) {
    setupCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    console.log('================================================================');
    console.log(`[nvo] No users yet. Open /setup and enter this one-time setup code: ${setupCode}`);
    console.log('================================================================');
  }
})().catch(e => { console.error(e); process.exit(1); });

// ---------------- app ----------------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway terminates TLS in front of us

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://api.worldbank.org",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// --- cookies & session ---
function readCookie(req, name) {
  const h = req.headers.cookie || '';
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
function setSession(req, res, user, remember) {
  const ms = remember ? REMEMBER_DAYS * 864e5 : SESSION_HOURS * 3600e3;
  const token = sec.sign({ u: user.id, sv: user.sv || 1, exp: Date.now() + ms, r: !!remember }, SESSION_SECRET);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure || IS_PROD, path: '/', maxAge: remember ? ms : undefined });
}
function clearSession(req, res) { res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: req.secure || IS_PROD, path: '/' }); }

app.use((req, res, next) => {
  const p = sec.unsign(readCookie(req, COOKIE), SESSION_SECRET);
  const u = p && store.userById(p.u);
  req.user = u && (u.sv || 1) === p.sv ? u : null;
  next();
});

// --- CSRF: state-changing requests must come from our own origin ---
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin') || req.get('referer');
  const site = req.get('sec-fetch-site');
  let ok = true;
  if (origin) { try { ok = new URL(origin).host === req.get('host'); } catch { ok = false; } }
  else if (site) ok = site === 'same-origin' || site === 'none';
  if (!ok) return res.status(403).json({ error: 'Cross-site request blocked.' });
  next();
});

const publicUser = u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt });
const wantsHtml = req => req.method === 'GET' && (req.get('accept') || '').includes('text/html');
function requireAuth(req, res, next) {
  if (req.user) return next();
  if (wantsHtml(req)) return res.redirect(store.users().length ? '/login' : '/setup');
  res.status(401).json({ error: 'Please sign in.' });
}
function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ error: 'Administrator access required.' });
}
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------------- AI key helpers ----------------
function aiKey() {
  const box = store.settings.anthropicKey;
  if (box) {
    try { return { key: sec.decrypt(box, ENC_SECRET), source: 'settings' }; }
    catch { return { key: null, source: 'settings', broken: true }; }
  }
  if (process.env.ANTHROPIC_API_KEY) return { key: process.env.ANTHROPIC_API_KEY, source: 'env' };
  return { key: null, source: null };
}
function aiStatus() {
  const k = aiKey(), s = store.settings;
  return {
    configured: !!k.key,
    source: k.source,
    broken: !!k.broken,
    keyHint: k.key ? '…' + k.key.slice(-4) : null,
    model: s.anthropicModel || 'auto',
    resolvedModel: modelCache.id || null,
    updatedAt: s.anthropicKeyUpdatedAt || null,
    updatedBy: s.anthropicKeyUpdatedBy || null,
  };
}
const modelCache = { id: null, at: 0, key: null };
async function anthropic(pathname, key, init = {}) {
  const r = await fetch(ANTHROPIC_BASE + pathname, {
    ...init,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(init.timeout || 120e3),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j?.error?.message || `Anthropic API returned HTTP ${r.status}`); e.status = r.status; throw e; }
  return j;
}
async function listModels(key) {
  const j = await anthropic('/v1/models?limit=100', key, { timeout: 20e3 });
  return (j.data || []).map(m => ({ id: m.id, name: m.display_name || m.id, created: m.created_at }));
}
async function resolveModel(key) {
  const chosen = store.settings.anthropicModel;
  if (chosen && chosen !== 'auto') return chosen;
  const fp = crypto.createHash('sha256').update(key).digest('hex');
  if (modelCache.id && modelCache.key === fp && Date.now() - modelCache.at < 3600e3) return modelCache.id;
  const ids = (await listModels(key)).map(m => m.id);
  const id = ids.find(x => /sonnet/i.test(x)) || ids.find(x => /opus/i.test(x)) || ids[0];
  if (!id) throw new Error('No models available for this API key.');
  Object.assign(modelCache, { id, at: Date.now(), key: fp });
  return id;
}

// ---------------- pages ----------------
const PUB = path.join(__dirname, 'public');
const sendPage = name => (req, res) => { res.set('Cache-Control', 'no-store'); res.sendFile(path.join(PUB, name)); };

app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/manifest.webmanifest', (req, res) => { res.type('application/manifest+json').set('Cache-Control', 'public, max-age=3600'); res.sendFile(path.join(PUB, 'manifest.webmanifest')); });
app.get('/favicon.ico', (req, res) => res.redirect(301, '/assets/icon-192.png'));
app.use('/assets', express.static(path.join(PUB, 'assets'), { maxAge: '1h' }));

app.get('/login', (req, res, next) => {
  if (!store.users().length) return res.redirect('/setup');
  if (req.user) return res.redirect('/');
  sendPage('login.html')(req, res, next);
});
app.get('/setup', (req, res, next) => {
  if (store.users().length) return res.redirect('/login');
  sendPage('setup.html')(req, res, next);
});
app.get('/settings', requireAuth, sendPage('settings.html'));

let APP_HTML = null;
function appHtml() {
  if (!APP_HTML || !IS_PROD) APP_HTML = fs.readFileSync(path.join(__dirname, 'app', 'nvo.html'), 'utf8');
  return APP_HTML;
}
app.get(['/', '/index.html'], requireAuth, (req, res) => {
  const cfg = { user: publicUser(req.user), ai: (({ configured, model, resolvedModel }) => ({ configured, model: model === 'auto' ? resolvedModel : model }))(aiStatus()) };
  const inject = `<script>window.NVO_PLATFORM=${JSON.stringify(cfg).replace(/</g, '\\u003c')};</script>\n`;
  const headLinks = '<link rel="manifest" href="/manifest.webmanifest">\n<link rel="icon" type="image/png" href="/assets/icon-192.png">\n<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">\n';
  let html = appHtml();
  html = html.replace('</head>', headLinks + '</head>');
  const i = html.indexOf('<script>');
  res.set('Cache-Control', 'no-store').type('html').send(html.slice(0, i) + inject + html.slice(i));
});

// ---------------- auth API ----------------
const throttle = new sec.Throttle({ max: 5, windowMs: 15 * 60e3, lockMs: 15 * 60e3 });
const ipThrottle = new sec.Throttle({ max: 30, windowMs: 15 * 60e3, lockMs: 15 * 60e3 });
app.post('/api/login', wrap(async (req, res) => {
  const { username = '', password = '', remember = false } = req.body || {};
  const key = `${req.ip}|${String(username).toLowerCase()}`;
  const wait = throttle.blockedFor(key) || ipThrottle.blockedFor(req.ip);
  if (wait) return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} min.`, code: 'locked', wait });
  const u = store.userByName(username);
  const ok = sec.verifyPassword(password, u ? u.hash : sec.DUMMY_HASH) && !!u;
  if (!ok) {
    throttle.fail(key); ipThrottle.fail(req.ip);
    return res.status(401).json({ error: 'Incorrect username or password.', code: 'bad' });
  }
  throttle.clear(key);
  await store.updateUser(u.id, { lastLoginAt: new Date().toISOString() });
  setSession(req, res, u, !!remember);
  res.json({ ok: true, user: publicUser(u) });
}));
// setup code throttle (reuse throttle class)
const setupThrottle = new sec.Throttle({ max: 5, windowMs: 15 * 60e3, lockMs: 30 * 60e3 });
app.post('/api/setup', wrap(async (req, res) => {
  if (store.users().length) return res.status(409).json({ error: 'Setup has already been completed.' });
  if (setupThrottle.blockedFor(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  const { code = '', username = '', password = '' } = req.body || {};
  const a = Buffer.from(String(code).trim().toUpperCase()), b = Buffer.from(String(setupCode || ''));
  if (!setupCode || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    setupThrottle.fail(req.ip);
    return res.status(401).json({ error: 'Setup code is not correct. Find it in the server logs.', code: 'badcode' });
  }
  const prob = sec.usernameProblem(username) || sec.passwordProblem(password);
  if (prob) return res.status(400).json({ error: prob });
  const u = await store.addUser({ username, hash: sec.hashPassword(password), role: 'admin' });
  setupCode = null;
  setSession(req, res, u, false);
  res.json({ ok: true });
}));
app.post('/logout', (req, res) => { clearSession(req, res); res.redirect('/login'); });
app.post('/api/logout', (req, res) => { clearSession(req, res); res.json({ ok: true }); });

app.get('/api/me', requireAuth, (req, res) => {
  const s = aiStatus();
  res.json({ user: publicUser(req.user), ai: req.user.role === 'admin' ? s : { configured: s.configured } });
});
app.post('/api/me/password', requireAuth, wrap(async (req, res) => {
  const { current = '', next: nextPw = '' } = req.body || {};
  if (!sec.verifyPassword(current, req.user.hash)) return res.status(400).json({ error: 'Current password is not correct.', code: 'badcurrent' });
  const prob = sec.passwordProblem(nextPw);
  if (prob) return res.status(400).json({ error: prob });
  const u = await store.updateUser(req.user.id, { hash: sec.hashPassword(nextPw), sv: (req.user.sv || 1) + 1 });
  setSession(req, res, u, false); // other sessions are signed out, this one stays
  res.json({ ok: true });
}));

// ---------------- admin: AI settings ----------------
app.get('/api/settings/ai', requireAuth, requireAdmin, (req, res) => res.json(aiStatus()));
app.put('/api/settings/ai', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { apiKey, model } = req.body || {};
  const patch = {};
  if (typeof apiKey === 'string' && apiKey.trim()) {
    const k = apiKey.trim();
    if (!/^sk-ant-[A-Za-z0-9_\-]{20,}$/.test(k)) return res.status(400).json({ error: 'That does not look like an Anthropic API key (it should start with sk-ant-).', code: 'format' });
    patch.anthropicKey = sec.encrypt(k, ENC_SECRET);
    patch.anthropicKeyUpdatedAt = new Date().toISOString();
    patch.anthropicKeyUpdatedBy = req.user.username;
    modelCache.id = null;
  }
  if (typeof model === 'string') {
    if (model !== 'auto' && !/^[a-z0-9][a-z0-9.\-_:@]{2,80}$/i.test(model)) return res.status(400).json({ error: 'Invalid model id.' });
    patch.anthropicModel = model;
  }
  await store.setSettings(patch);
  res.json(aiStatus());
}));
app.delete('/api/settings/ai/key', requireAuth, requireAdmin, wrap(async (req, res) => {
  delete store.settings.anthropicKey;
  await store.setSettings({ anthropicKeyUpdatedAt: new Date().toISOString(), anthropicKeyUpdatedBy: req.user.username });
  modelCache.id = null;
  res.json(aiStatus());
}));
app.post('/api/settings/ai/test', requireAuth, requireAdmin, wrap(async (req, res) => {
  const typed = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  const key = typed || aiKey().key;
  if (!key) return res.status(400).json({ error: 'No API key to test.', code: 'nokey' });
  try {
    const models = await listModels(key);
    res.json({ ok: true, models });
  } catch (e) {
    res.status(e.status === 401 ? 400 : 502).json({ error: e.message, code: e.status === 401 ? 'invalid' : 'upstream' });
  }
}));

// ---------------- admin: users ----------------
app.get('/api/users', requireAuth, requireAdmin, (req, res) => res.json(store.users().map(publicUser)));
app.post('/api/users', requireAuth, requireAdmin, wrap(async (req, res) => {
  const { username = '', password = '', role = 'viewer' } = req.body || {};
  const prob = sec.usernameProblem(username) || sec.passwordProblem(password);
  if (prob) return res.status(400).json({ error: prob });
  if (!['admin', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
  if (store.userByName(username)) return res.status(409).json({ error: 'That username is already taken.', code: 'taken' });
  const u = await store.addUser({ username, hash: sec.hashPassword(password), role });
  res.json(publicUser(u));
}));
const adminCount = () => store.users().filter(u => u.role === 'admin').length;
app.patch('/api/users/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const u = store.userById(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  const { role, password } = req.body || {};
  const patch = {};
  if (role !== undefined) {
    if (!['admin', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    if (u.role === 'admin' && role !== 'admin' && adminCount() <= 1) return res.status(400).json({ error: 'At least one administrator is required.', code: 'lastadmin' });
    patch.role = role;
  }
  if (password !== undefined) {
    const prob = sec.passwordProblem(password);
    if (prob) return res.status(400).json({ error: prob });
    patch.hash = sec.hashPassword(password);
    patch.sv = (u.sv || 1) + 1;
  }
  const nu = await store.updateUser(u.id, patch);
  if (nu.id === req.user.id && patch.sv) setSession(req, res, nu, false);
  res.json(publicUser(nu));
}));
app.delete('/api/users/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const u = store.userById(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.', code: 'self' });
  if (u.role === 'admin' && adminCount() <= 1) return res.status(400).json({ error: 'At least one administrator is required.', code: 'lastadmin' });
  await store.deleteUser(u.id);
  res.json({ ok: true });
}));

// ---------------- AI proxy for the Improvement Advisor ----------------
const aiUsage = new Map();
app.post('/api/ai/advise', requireAuth, wrap(async (req, res) => {
  const prompt = req.body?.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Missing prompt.' });
  if (prompt.length > 40000) return res.status(413).json({ error: 'Prompt is too long.' });
  const now = Date.now();
  const hist = (aiUsage.get(req.user.id) || []).filter(t => now - t < 3600e3);
  if (hist.length >= AI_PER_HOUR) return res.status(429).json({ error: `AI limit reached (${AI_PER_HOUR} requests per hour). Try again later.` });
  const { key, broken } = aiKey();
  if (!key) return res.status(503).json({ error: broken ? 'The saved API key cannot be decrypted (the secret changed). An administrator must re-enter it in Settings.' : 'No Anthropic API key is configured. An administrator can add one in Settings.', code: 'nokey' });
  hist.push(now); aiUsage.set(req.user.id, hist);
  try {
    let model = await resolveModel(key);
    let j;
    try {
      j = await anthropic('/v1/messages', key, { method: 'POST', body: JSON.stringify({ model, max_tokens: AI_MAX_TOKENS, messages: [{ role: 'user', content: prompt }] }) });
    } catch (e) {
      // an auto-picked model may have been retired: refresh once
      if (e.status === 404 && (store.settings.anthropicModel || 'auto') === 'auto') {
        modelCache.id = null; model = await resolveModel(key);
        j = await anthropic('/v1/messages', key, { method: 'POST', body: JSON.stringify({ model, max_tokens: AI_MAX_TOKENS, messages: [{ role: 'user', content: prompt }] }) });
      } else throw e;
    }
    const text = (j.content || []).map(c => c.text || '').join('');
    res.json({ model: j.model || model, text, usage: j.usage || null });
  } catch (e) {
    console.error('[nvo] AI request failed:', e.message);
    res.status(502).json({ error: e.message });
  }
}));

// ---------------- errors ----------------
app.use((req, res) => res.status(404).type('text').send('Not found'));
app.use((err, req, res, next) => {
  console.error('[nvo]', err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
  res.status(500).json({ error: 'Internal error.' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`[nvo] Observatory platform listening on :${PORT} (data: ${DATA_DIR})`));
}
module.exports = app;
