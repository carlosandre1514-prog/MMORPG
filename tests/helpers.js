// Utilitários de teste: sobe um servidor temporário e cria bots WebSocket.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server/main.js';
import { findPath } from '../shared/pathfinding.js';
import { buildMap, decodeLayer } from '../shared/tiles.js';

export async function bootServer(opts = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aethra-test-'));
  const srv = await startServer({ port: 0, dataDir, dev: true, quiet: true, host: '127.0.0.1', ...opts });
  const origClose = srv.close;
  srv.close = async () => {
    await origClose();
    fs.rmSync(dataDir, { recursive: true, force: true });
  };
  return srv;
}

export class Bot {
  constructor(port) {
    this.port = port;
    this.msgs = [];
    this.waiters = [];
    this.entities = new Map();
    this.state = {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${this.port}/ws`);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (ev) => this.onMsg(JSON.parse(ev.data));
    });
  }

  onMsg(m) {
    this.msgs.push(m);
    if (m.t === 's') {
      for (const e of m.n) this.entities.set(e.id, { ...e });
      for (const u of m.u) {
        const e = this.entities.get(u[0]);
        if (e) { e.x = u[1] / 100; e.y = u[2] / 100; e.hp = u[3]; e.mhp = u[4]; e.f = u[6]; }
      }
      for (const id of m.r) this.entities.delete(id);
    }
    if (m.t === 'world') {
      this.entities.clear();
      this.you = m.you;
      this.zone = m.zone.id;
      this.x = m.you.x; this.y = m.you.y; this.posSeq = m.you.s;
      const z = m.zone;
      this.map = buildMap(z.w, z.h, decodeLayer(z.t), decodeLayer(z.o), z.st);
    }
    if (m.t === 'pos') { this.x = m.x; this.y = m.y; this.posSeq = m.s; }
    if (m.t === 'me') this.state.me = m;
    if (m.t === 'inv') this.state.inv = m.l;
    if (m.t === 'quests') this.state.quests = m;
    if (m.t === 'stats') this.state.stats = m.s;
    for (const w of [...this.waiters]) {
      if (w.pred(m)) {
        this.waiters.splice(this.waiters.indexOf(w), 1);
        clearTimeout(w.timer);
        const i = this.msgs.lastIndexOf(m);
        if (i >= 0) this.msgs.splice(i, 1);
        w.resolve(m);
        break;
      }
    }
  }

  send(obj) { this.ws.send(JSON.stringify(obj)); }

  wait(pred, ms = 4000) {
    const found = this.msgs.find(pred);
    if (found) { this.msgs.splice(this.msgs.indexOf(found), 1); return Promise.resolve(found); }
    return new Promise((resolve, reject) => {
      const w = { pred, resolve, timer: setTimeout(() => { this.waiters.splice(this.waiters.indexOf(w), 1); reject(new Error('timeout esperando mensagem')); }, ms) };
      this.waiters.push(w);
    });
  }

  waitType(t, ms) { return this.wait((m) => m.t === t, ms); }

  clear() { this.msgs = []; }

  async login(user, pass = 'senha123', register = true) {
    this.send({ t: register ? 'register' : 'login', user, pass });
    return this.wait((m) => m.t === 'chars' || m.t === 'err');
  }

  async createAndEnter(name, cls = 'warrior') {
    this.send({ t: 'create', name, cls, skin: 1, hair: 2 });
    const c = await this.wait((m) => (m.t === 'chars' && m.created) || m.t === 'err');
    if (c.t === 'err') throw new Error(c.m);
    this.send({ t: 'enter', id: c.created });
    await this.waitType('world');
    return c.created;
  }

  // anda pelo caminho encontrado com A*, respeitando a velocidade do servidor
  async walkTo(x, y, speed = 4.4) {
    const path = findPath(this.map, this.x, this.y, x, y, 20000) || [{ x, y }];
    for (const pt of path) if (!(await this.walkStraight(pt.x, pt.y, speed))) return false;
    return Math.hypot(x - this.x, y - this.y) < 0.6;
  }

  async walkStraight(x, y, speed = 4.4) {
    for (let i = 0; i < 400; i++) {
      const dx = x - this.x, dy = y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.1) return true;
      const step = Math.min(d, speed * 0.05);
      this.x += (dx / d) * step; this.y += (dy / d) * step;
      this.send({ t: 'mv', x: this.x, y: this.y, d: 0, s: this.posSeq });
      await sleep(50);
    }
    return false;
  }

  chat(m) { this.send({ t: 'chat', m }); }

  close() { this.ws.close(); }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
