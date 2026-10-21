// Conexão WebSocket com o servidor.
export class Net {
  constructor() {
    this.ws = null;
    this.handlers = new Set();
    this.onClose = null;
    this.connected = false;
    this.latency = 0;
    this.pingTimer = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      this.ws = ws;
      ws.onopen = () => {
        this.connected = true;
        this.pingTimer = setInterval(() => this.send({ t: 'ping', c: performance.now() }), 3000);
        resolve();
      };
      ws.onerror = () => { if (!this.connected) reject(new Error('Não foi possível conectar ao servidor.')); };
      ws.onclose = () => {
        const was = this.connected;
        this.connected = false;
        clearInterval(this.pingTimer);
        if (was && this.onClose) this.onClose();
      };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.t === 'pong') this.latency = Math.round(performance.now() - m.c);
        for (const h of [...this.handlers]) h(m);
      };
    });
  }

  on(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }

  send(obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  request(obj, pred, ms = 8000) {
    return new Promise((resolve, reject) => {
      const off = this.on((m) => {
        if (pred(m)) { off(); clearTimeout(timer); resolve(m); }
      });
      const timer = setTimeout(() => { off(); reject(new Error('Tempo esgotado.')); }, ms);
      this.send(obj);
    });
  }
}
