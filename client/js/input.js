// Teclado e mouse.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, inside: false };
    this.listeners = {};
    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      const k = normKey(e);
      if (!this.keys.has(k)) this.emit('press', k, e);
      this.keys.add(k);
      if (['Tab', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(normKey(e)); });
    window.addEventListener('blur', () => this.keys.clear());
    this.dragging = false;
    this.drag = null;
    canvas.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true; });
    canvas.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    canvas.addEventListener('mousedown', (e) => {
      this.mouse.down = true;
      // botão direito/do meio: arrastar gira a câmera; clique curto continua sendo clique
      if (e.button === 1 || e.button === 2) { this.drag = { button: e.button, x: e.clientX, y: e.clientY, moved: 0 }; e.preventDefault(); return; }
      this.emit('click', e.button, e);
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.drag.moved > 4) { this.dragging = true; this.emit('drag', dx, dy); }
    });
    window.addEventListener('mouseup', (e) => {
      this.mouse.down = false;
      if (this.drag && e.button === this.drag.button) {
        if (this.drag.moved <= 4) this.emit('click', this.drag.button, e);
        this.drag = null;
        this.dragging = false;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.emit('wheel', Math.sign(e.deltaY), e); e.preventDefault(); }, { passive: false });
    // toque: um toque curto = clique; arrastar com um dedo gira a câmera; pinça = zoom
    this.stick = { x: 0, y: 0 }; // direcional virtual (preenchido pelos controles de toque)
    const touches = new Map();
    let pinch = 0;
    const dist2 = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) touches.set(t.identifier, { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t0: performance.now(), moved: 0 });
      if (touches.size === 2) pinch = dist2();
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        const p = touches.get(t.identifier);
        if (!p) continue;
        const dx = t.clientX - p.x, dy = t.clientY - p.y;
        p.x = t.clientX; p.y = t.clientY;
        p.moved += Math.abs(dx) + Math.abs(dy);
        if (touches.size === 1 && p.moved > 12) { this.dragging = true; this.emit('drag', dx * 1.1, dy * 1.1); }
      }
      if (touches.size === 2) {
        const d = dist2();
        if (pinch > 0) this.emit('zoom', d / pinch);
        pinch = d;
        this.dragging = true;
      }
      e.preventDefault();
    }, { passive: false });
    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        const p = touches.get(t.identifier);
        if (!p) continue;
        touches.delete(t.identifier);
        if (e.type === 'touchend' && p.moved <= 12 && performance.now() - p.t0 < 400 && !this.dragging) {
          this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.inside = true;
          this.emit('click', 0, e);
        }
      }
      if (!touches.size) this.dragging = false;
      pinch = 0;
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...args) { for (const fn of this.listeners[ev] || []) fn(...args); }
  down(k) { return this.keys.has(k); }
}

function normKey(e) {
  if (e.key.length === 1) return e.key.toLowerCase();
  return e.key;
}

export function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
