// Implementação mínima de servidor WebSocket (RFC 6455) sem dependências externas.
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_MESSAGE = 256 * 1024;

export class WSConnection extends EventEmitter {
  constructor(socket, req) {
    super();
    this.socket = socket;
    this.req = req;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.fragOpcode = 0;
    this.open = true;
    this.lastPong = Date.now();
    this.ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || socket.remoteAddress;
    socket.setNoDelay(true);
    socket.on('data', (d) => this._onData(d));
    socket.on('close', () => this._closed());
    socket.on('error', () => this._closed());
  }

  _onData(data) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, data]) : data;
    while (this.open) {
      const buf = this.buffer;
      if (buf.length < 2) return;
      const b0 = buf[0], b1 = buf[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2); off = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        const hi = buf.readUInt32BE(2), lo = buf.readUInt32BE(6);
        if (hi !== 0) return this.close(1009);
        len = lo; off = 10;
      }
      if (len > MAX_MESSAGE) return this.close(1009);
      if (!masked) return this.close(1002); // clientes devem mascarar
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4);
      off += 4;
      const payload = Buffer.from(buf.subarray(off, off + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buffer = buf.subarray(off + len);
      this._onFrame(fin, opcode, payload);
    }
  }

  _onFrame(fin, opcode, payload) {
    if (opcode === 0x8) { this.close(1000); return; }
    if (opcode === 0x9) { this._send(0xa, payload); return; }
    if (opcode === 0xa) { this.lastPong = Date.now(); return; }
    if (opcode === 0x1 || opcode === 0x2) {
      if (fin) { this._deliver(opcode, payload); return; }
      this.fragOpcode = opcode;
      this.fragments = [payload];
      return;
    }
    if (opcode === 0x0) {
      this.fragments.push(payload);
      const total = this.fragments.reduce((a, b) => a + b.length, 0);
      if (total > MAX_MESSAGE) return this.close(1009);
      if (fin) {
        const data = Buffer.concat(this.fragments);
        this.fragments = [];
        this._deliver(this.fragOpcode, data);
      }
    }
  }

  _deliver(opcode, data) {
    this.lastPong = Date.now();
    this.emit('message', opcode === 0x1 ? data.toString('utf8') : data);
  }

  _send(opcode, payload) {
    if (!this.open || this.socket.destroyed) return;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(len, 6);
    }
    header[0] = 0x80 | opcode;
    this.socket.write(Buffer.concat([header, payload]));
  }

  send(text) {
    this._send(0x1, Buffer.from(text, 'utf8'));
  }

  get bufferedAmount() {
    return this.socket.writableLength;
  }

  ping() {
    this._send(0x9, Buffer.alloc(0));
  }

  close(code = 1000) {
    if (!this.open) return;
    const p = Buffer.alloc(2);
    p.writeUInt16BE(code, 0);
    try { this._send(0x8, p); } catch { /* ignorado */ }
    this.open = false;
    this.socket.end();
    setTimeout(() => this.socket.destroy(), 1000).unref();
    this.emit('close');
  }

  _closed() {
    if (!this.open) return;
    this.open = false;
    this.emit('close');
  }
}

export class WSServer extends EventEmitter {
  constructor(httpServer, { path = '/ws' } = {}) {
    super();
    this.clients = new Set();
    httpServer.on('upgrade', (req, socket) => {
      const url = req.url.split('?')[0];
      const key = req.headers['sec-websocket-key'];
      if (url !== path || !key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }
      const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );
      const conn = new WSConnection(socket, req);
      this.clients.add(conn);
      conn.on('close', () => this.clients.delete(conn));
      this.emit('connection', conn);
    });
    // keepalive: derruba conexões mortas
    this.pingTimer = setInterval(() => {
      const now = Date.now();
      for (const c of this.clients) {
        if (now - c.lastPong > 60000) c.close(1001);
        else c.ping();
      }
    }, 20000);
    this.pingTimer.unref();
  }

  close() {
    clearInterval(this.pingTimer);
    for (const c of this.clients) c.close(1001);
  }
}
