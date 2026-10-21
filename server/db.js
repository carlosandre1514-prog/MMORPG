// Persistência simples em JSON com escrita atômica.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class Database {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'world.json');
    fs.mkdirSync(dir, { recursive: true });
    this.data = { version: 1, accounts: {}, chars: {}, guilds: {}, nextCharId: 1 };
    if (fs.existsSync(this.file)) {
      try {
        this.data = { ...this.data, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
      } catch (e) {
        const bak = this.file + '.corrupt-' + Date.now();
        fs.copyFileSync(this.file, bak);
        console.error('[db] arquivo corrompido, cópia salva em', bak, e.message);
      }
    }
    this.dirty = false;
  }

  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
    this.dirty = false;
  }

  markDirty() { this.dirty = true; }

  // ---------- contas ----------
  getAccount(username) {
    return this.data.accounts[username.toLowerCase()] || null;
  }

  async createAccount(username, password) {
    const key = username.toLowerCase();
    if (this.data.accounts[key]) return null;
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await scrypt(password, salt);
    const acc = { username, salt, hash, chars: [], created: Date.now() };
    this.data.accounts[key] = acc;
    this.markDirty();
    return acc;
  }

  async verifyPassword(acc, password) {
    const hash = await scrypt(password, acc.salt);
    const a = Buffer.from(hash, 'hex'), b = Buffer.from(acc.hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  // ---------- personagens ----------
  charByName(name) {
    const n = name.toLowerCase();
    for (const c of Object.values(this.data.chars)) if (c.name.toLowerCase() === n) return c;
    return null;
  }

  addChar(acc, ch) {
    ch.id = 'c' + this.data.nextCharId++;
    ch.account = acc.username.toLowerCase();
    this.data.chars[ch.id] = ch;
    acc.chars.push(ch.id);
    this.markDirty();
    return ch;
  }

  getChar(id) { return this.data.chars[id] || null; }

  deleteChar(acc, id) {
    const ch = this.data.chars[id];
    if (!ch || ch.account !== acc.username.toLowerCase()) return false;
    delete this.data.chars[id];
    acc.chars = acc.chars.filter((c) => c !== id);
    this.markDirty();
    return true;
  }

  allChars() { return Object.values(this.data.chars); }

  // ---------- clãs ----------
  get guilds() { return this.data.guilds; }
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key.toString('hex'))));
  });
}
