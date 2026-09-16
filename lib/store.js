'use strict';
// Tiny JSON-file store (users + settings). Writes are atomic (tmp file + rename)
// and serialised, so a crash never leaves a half-written file.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'store.json');
    fs.mkdirSync(dir, { recursive: true });
    this.data = { version: 1, users: [], settings: {}, meta: {} };
    if (fs.existsSync(this.file)) {
      this.data = Object.assign(this.data, JSON.parse(fs.readFileSync(this.file, 'utf8')));
    }
    this._chain = Promise.resolve();
  }
  save() {
    const snapshot = JSON.stringify(this.data, null, 2);
    this._chain = this._chain.then(() => new Promise((res, rej) => {
      const tmp = this.file + '.' + process.pid + '.tmp';
      fs.writeFile(tmp, snapshot, { mode: 0o600 }, err => {
        if (err) return rej(err);
        fs.rename(tmp, this.file, e => (e ? rej(e) : res()));
      });
    }));
    return this._chain;
  }
  // ---- users ----
  users() { return this.data.users; }
  userById(id) { return this.data.users.find(u => u.id === id) || null; }
  userByName(name) {
    const n = String(name || '').trim().toLowerCase();
    return this.data.users.find(u => u.username.toLowerCase() === n) || null;
  }
  async addUser({ username, hash, role }) {
    const u = { id: crypto.randomUUID(), username: username.trim(), hash, role, sv: 1, createdAt: new Date().toISOString(), lastLoginAt: null };
    this.data.users.push(u);
    await this.save();
    return u;
  }
  async updateUser(id, patch) {
    const u = this.userById(id);
    if (!u) return null;
    Object.assign(u, patch);
    await this.save();
    return u;
  }
  async deleteUser(id) {
    this.data.users = this.data.users.filter(u => u.id !== id);
    await this.save();
  }
  // ---- settings ----
  get settings() { return this.data.settings; }
  async setSettings(patch) {
    Object.assign(this.data.settings, patch);
    await this.save();
  }
  get meta() { return this.data.meta; }
}

module.exports = { Store };
