// Uma conexão de cliente: autenticação, seleção de personagem e repasse ao mundo.
import { CLASSES, SKIN_TONES, HAIR_COLORS } from '../shared/data/classes.js';
import { MAX_CHARS, PROTOCOL_VERSION, GAME_NAME } from '../shared/constants.js';

const USER_RE = /^[A-Za-z0-9_]{3,16}$/;
const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9]{2,13}$/;
const RESERVED = ['admin', 'gm', 'sistema', 'system', 'morvath', 'thalric', 'moderador'];

export class Session {
  constructor(world, conn) {
    this.world = world;
    this.conn = conn;
    this.state = 'auth';
    this.account = null;
    this.player = null;
    this.busy = false;
    this.windowStart = Date.now();
    this.msgCount = 0;
    this.authFails = 0;
    conn.on('message', (m) => this.onMessage(m));
    conn.on('close', () => this.onClose());
  }

  send(obj) {
    if (!this.conn.open) return;
    if (this.conn.bufferedAmount > 8 * 1024 * 1024) { this.conn.close(1008); return; }
    this.conn.send(JSON.stringify(obj));
  }

  err(m) { this.send({ t: 'err', m }); }

  async onMessage(raw) {
    if (typeof raw !== 'string') return;
    const now = Date.now();
    if (now - this.windowStart > 1000) { this.windowStart = now; this.msgCount = 0; }
    if (++this.msgCount > 120) { this.conn.close(1008); return; }
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    try {
      if (this.state === 'game' && this.player) {
        if (msg.t === 'logout') this.logoutChar();
        else this.world.handle(this.player, msg);
      }
      else if (!this.busy) {
        this.busy = true;
        try { await this.handleMenu(msg); } finally { this.busy = false; }
      }
    } catch (e) {
      console.error('[session] erro ao tratar', msg.t, e);
    }
  }

  async handleMenu(msg) {
    const db = this.world.db;
    switch (msg.t) {
      case 'hello':
        return this.send({ t: 'hello', v: PROTOCOL_VERSION, name: GAME_NAME, online: this.world.players.size, dev: this.world.dev, fb: !!this.world.firebase, durable: this.world.durable !== false });
      case 'register': {
        // com o Firebase ligado, contas novas nascem pelo e-mail ou pelo Google; o cadastro por usuário e senha fica só no modo DEV (testes)
        if (this.world.firebase && !this.world.dev) return this.err('Para criar uma conta, use o e-mail ou o Google.');
        const user = String(msg.user || ''), pass = String(msg.pass || '');
        if (!USER_RE.test(user)) return this.err('Usuário deve ter de 3 a 16 caracteres (letras, números ou _).');
        if (pass.length < 4 || pass.length > 64) return this.err('A senha deve ter de 4 a 64 caracteres.');
        const acc = await db.createAccount(user, pass);
        if (!acc) return this.err('Este usuário já existe.');
        db.save();
        return this.loggedIn(acc);
      }
      case 'fblogin': {
        // login pelo Firebase Authentication: o cliente manda o token e o servidor confere a assinatura (server/firebase.js)
        if (this.authFails >= 8) return this.err('Muitas tentativas. Reconecte e tente novamente.');
        if (!this.world.firebase) return this.err('O login por e-mail e Google não está disponível neste servidor.');
        let who;
        try { who = await this.world.firebase.verify(msg.token); } catch (e) {
          if (e && e.code !== 'unavailable') this.authFails++;
          return this.err(e && e.code ? e.message : 'Não foi possível conferir o login.');
        }
        if (this.world.requireVerifiedEmail && who.provider === 'password' && !who.emailVerified) {
          return this.err('Confirme seu e-mail: enviamos um link para a sua caixa de entrada. Depois é só entrar de novo.');
        }
        const acc = db.getOrCreateFirebaseAccount(who);
        db.save();
        return this.loggedIn(acc);
      }
      case 'login': {
        if (this.authFails >= 8) return this.err('Muitas tentativas. Reconecte e tente novamente.');
        const acc = db.getAccount(String(msg.user || ''));
        if (!acc || !(await db.verifyPassword(acc, String(msg.pass || '')))) {
          this.authFails++;
          return this.err('Usuário ou senha incorretos.');
        }
        return this.loggedIn(acc);
      }
      default: break;
    }
    if (this.state !== 'select' || !this.account) return;
    switch (msg.t) {
      case 'chars': return this.sendChars();
      case 'create': {
        const name = String(msg.name || '').trim();
        if (!NAME_RE.test(name)) return this.err('Nome inválido: 3 a 14 letras ou números, começando com letra.');
        if (RESERVED.includes(name.toLowerCase())) return this.err('Este nome é reservado.');
        if (!CLASSES[msg.cls]) return this.err('Classe inválida.');
        if (this.account.chars.length >= MAX_CHARS) return this.err(`Limite de ${MAX_CHARS} personagens por conta.`);
        if (db.charByName(name)) return this.err('Já existe um personagem com esse nome.');
        const skin = Math.max(0, Math.min(SKIN_TONES.length - 1, msg.skin | 0));
        const hair = Math.max(0, Math.min(HAIR_COLORS.length - 1, msg.hair | 0));
        const ch = this.world.newCharacter(name, msg.cls, skin, hair);
        db.addChar(this.account, ch);
        db.save();
        return this.sendChars(ch.id);
      }
      case 'delete': {
        const ch = db.getChar(msg.id);
        if (!ch || ch.account !== this.account.username.toLowerCase()) return;
        if (String(msg.confirm || '').toLowerCase() !== ch.name.toLowerCase()) return this.err('Digite o nome do personagem para confirmar.');
        if (ch.guild) {
          const g = db.guilds[ch.guild.toLowerCase()];
          if (g) {
            g.members = g.members.filter((n) => n !== ch.name);
            if (!g.members.length) delete db.guilds[ch.guild.toLowerCase()];
            else if (g.leader === ch.name) g.leader = g.members[0];
          }
        }
        db.deleteChar(this.account, msg.id);
        db.save();
        return this.sendChars();
      }
      case 'enter': {
        const ch = db.getChar(msg.id);
        if (!ch || ch.account !== this.account.username.toLowerCase()) return this.err('Personagem inválido.');
        if (this.world.byName.has(ch.name.toLowerCase())) return this.err('Este personagem já está no jogo.');
        this.state = 'game';
        this.player = this.world.enterWorld(this, ch);
        return;
      }
      default: return;
    }
  }

  loggedIn(acc) {
    const key = acc.username.toLowerCase();
    const old = this.world.sessionsByAccount.get(key);
    if (old && old !== this) {
      old.send({ t: 'kick', m: 'Sua conta foi conectada em outro lugar.' });
      old.conn.close(1000);
      old.onClose();
    }
    this.world.sessionsByAccount.set(key, this);
    this.account = acc;
    this.state = 'select';
    this.sendChars();
  }

  sendChars(created = null) {
    const db = this.world.db;
    const list = this.account.chars.map((id) => db.getChar(id)).filter(Boolean).map((c) => ({
      id: c.id, name: c.name, cls: c.cls, level: c.level, zone: c.zone, skin: c.skin, hair: c.hair,
      equip: c.equip, title: c.title || null, guild: c.guild || null, last: c.lastSeen,
    }));
    this.send({ t: 'chars', list, max: MAX_CHARS, user: this.account.display || this.account.username, created });
  }

  // volta para a seleção de personagens sem desconectar
  logoutChar() {
    if (this.player) {
      this.world.leaveWorld(this.player);
      this.player = null;
    }
    this.state = 'select';
    this.world.db.save();
    this.sendChars();
  }

  onClose() {
    if (this.closed) return;
    this.closed = true;
    if (this.player) {
      this.world.leaveWorld(this.player);
      this.player = null;
      try { this.world.db.save(); } catch (e) { console.error(e); }
    }
    if (this.account) {
      const key = this.account.username.toLowerCase();
      if (this.world.sessionsByAccount.get(key) === this) this.world.sessionsByAccount.delete(key);
    }
  }
}
