// Utilitários de DOM e gerenciador de janelas arrastáveis.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let zTop = 100;

export class Win {
  constructor(root, id, title, opts = {}) {
    this.id = id;
    this.el = h('div', { class: 'win ' + (opts.cls || ''), id: 'win-' + id, style: { display: 'none', width: opts.w ? opts.w + 'px' : null } });
    this.head = h('div', { class: 'win-head' }, h('span', { class: 'win-title' }, title));
    this.titleEl = this.head.firstChild;
    const close = h('button', { class: 'win-close', title: 'Fechar (Esc)', onclick: () => this.close() }, '×');
    this.head.appendChild(close);
    this.body = h('div', { class: 'win-body' });
    this.el.append(this.head, this.body);
    root.appendChild(this.el);
    this.onOpen = opts.onOpen || null;
    this.onClose = opts.onClose || null;
    this.drag(opts);
    this.el.addEventListener('mousedown', () => this.front());
    const saved = loadPos(id);
    if (saved) { this.el.style.left = saved.x + 'px'; this.el.style.top = saved.y + 'px'; this.positioned = true; }
    else if (opts.pos) { this.defaultPos = opts.pos; }
    // mantém a janela dentro da tela quando o conteúdo muda de tamanho
    if (window.ResizeObserver) new ResizeObserver(() => this.fit()).observe(this.el);
  }

  fit() {
    if (!this.isOpen) return;
    const r = this.el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 4) this.el.style.top = Math.max(4, window.innerHeight - r.height - 4) + 'px';
    if (r.right > window.innerWidth - 4) this.el.style.left = Math.max(4, window.innerWidth - r.width - 4) + 'px';
  }

  setTitle(t) { this.titleEl.textContent = t; }

  drag() {
    let sx, sy, ox, oy, dragging = false;
    this.head.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      dragging = true;
      const r = this.el.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const x = Math.max(0, Math.min(window.innerWidth - 60, ox + e.clientX - sx));
      const y = Math.max(0, Math.min(window.innerHeight - 30, oy + e.clientY - sy));
      this.el.style.left = x + 'px'; this.el.style.top = y + 'px';
      this.positioned = true;
    });
    window.addEventListener('mouseup', () => {
      if (dragging) savePos(this.id, parseInt(this.el.style.left, 10), parseInt(this.el.style.top, 10));
      dragging = false;
    });
  }

  get isOpen() { return this.el.style.display !== 'none'; }

  open() {
    if (!this.isOpen) {
      this.el.style.display = 'flex';
      if (!this.positioned && this.defaultPos) {
        const p = typeof this.defaultPos === 'function' ? this.defaultPos() : this.defaultPos;
        this.el.style.left = p.x + 'px';
        this.el.style.top = p.y + 'px';
      } else if (!this.positioned) {
        const r = this.el.getBoundingClientRect();
        this.el.style.left = Math.max(10, (window.innerWidth - r.width) / 2 + (Math.random() - 0.5) * 60) + 'px';
        this.el.style.top = Math.max(10, (window.innerHeight - r.height) / 2.4) + 'px';
      }
      // garante que fica dentro da tela
      const r = this.el.getBoundingClientRect();
      if (r.right > window.innerWidth) this.el.style.left = Math.max(0, window.innerWidth - r.width - 8) + 'px';
      if (r.bottom > window.innerHeight) this.el.style.top = Math.max(0, window.innerHeight - r.height - 8) + 'px';
      if (this.onOpen) this.onOpen();
    }
    this.front();
  }

  close() {
    if (!this.isOpen) return;
    this.el.style.display = 'none';
    if (this.onClose) this.onClose();
  }

  toggle() { if (this.isOpen) this.close(); else this.open(); }

  front() { this.el.style.zIndex = ++zTop; }
}

function loadPos(id) {
  try { const v = localStorage.getItem('aethra_win_' + id); return v ? JSON.parse(v) : null; } catch { return null; }
}
function savePos(id, x, y) {
  try { localStorage.setItem('aethra_win_' + id, JSON.stringify({ x, y })); } catch { /* ignorado */ }
}

export function fmt(n) {
  return Math.round(n).toLocaleString('pt-BR');
}
