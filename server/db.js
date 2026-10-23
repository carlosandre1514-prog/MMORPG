// Persistência simples em JSON com escrita atômica.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Armazenamento remoto opcional (Supabase/PostgREST). O arquivo local continua sendo o cache de trabalho; o remoto
// é a cópia durável para hospedagens com disco efêmero (como o plano gratuito do Render).
//   SUPABASE_URL=https://xxxx.supabase.co  SUPABASE_KEY=<service_role key>  [SUPABASE_TABLE=game_state]
export function remoteConfig(opts = {}) {
  const url = opts.url ?? process.env.SUPABASE_URL;
  const key = opts.key ?? process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ''), key, table: opts.table ?? process.env.SUPABASE_TABLE ?? 'game_state', id: opts.id ?? 'world' };
}

const remoteHeaders = (cfg) => ({ apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' });

// Baixa o estado salvo e grava em dir/world.json (chamar antes de criar o Database). Devolve true se restaurou.
export async function restoreRemote(dir, cfg) {
  if (!cfg) return false;
  const res = await fetch(`${cfg.url}/rest/v1/${cfg.table}?id=eq.${encodeURIComponent(cfg.id)}&select=data`, { headers: remoteHeaders(cfg) });
  if (!res.ok) throw new Error(`Supabase respondeu ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  if (!rows.length || !rows[0].data) return false;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'world.json'), JSON.stringify(rows[0].data));
  return true;
}

export class Database {
  constructor(dir, remote = null) {
    this.remote = remote;
    this.pending = null; // último estado aguardando envio
    this.sending = null; // promessa do envio em andamento
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
    if (this.remote) this.pushRemote();
  }

  // Envia o estado ao Supabase sem bloquear o jogo: só um envio por vez e, enquanto ele roda, só o mais recente vale
  pushRemote() {
    this.pending = this.data;
    if (this.sending) return;
    this.sending = (async () => {
      while (this.pending) {
        const state = this.pending;
        this.pending = null;
        try {
          const res = await fetch(`${this.remote.url}/rest/v1/${this.remote.table}?on_conflict=id`, {
            method: 'POST',
            headers: { ...remoteHeaders(this.remote), Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify([{ id: this.remote.id, data: state, updated_at: new Date().toISOString() }]),
          });
          if (!res.ok) console.error('[db] falha ao salvar no Supabase:', res.status, await res.text());
        } catch (e) {
          console.error('[db] falha ao salvar no Supabase:', e.message);
        }
      }
      this.sending = null;
    })();
  }

  // Espera o envio remoto terminar (usado ao encerrar o servidor)
  async flushRemote() {
    if (this.remote) { this.pushRemote(); while (this.sending) await this.sending; }
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

  // Conta ligada a um login do Firebase (sem senha aqui): a chave é um resumo do uid, em minúsculas e com "fb:", que nunca
  // coincide com um usuário antigo (letras, números e _). Cria na primeira vez e mantém e-mail e provedor atualizados.
  getOrCreateFirebaseAccount({ uid, email, name, provider, emailVerified }) {
    const key = 'fb:' + crypto.createHash('sha256').update(uid).digest('hex').slice(0, 32);
    let acc = this.data.accounts[key];
    if (!acc) {
      acc = { username: key, fb: { uid }, chars: [], created: Date.now() };
      this.data.accounts[key] = acc;
      this.markDirty();
    }
    const display = (email || name || 'Conta Firebase').slice(0, 80);
    if (acc.display !== display || acc.fb.provider !== provider || acc.fb.emailVerified !== !!emailVerified) {
      acc.display = display;
      acc.fb = { uid, email: email || null, provider: provider || null, emailVerified: !!emailVerified };
      this.markDirty();
    }
    return acc;
  }

  async verifyPassword(acc, password) {
    if (!acc.hash || !acc.salt) return false; // conta do Firebase: não tem senha local
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
