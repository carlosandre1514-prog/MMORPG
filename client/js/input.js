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
    canvas.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true; });
    canvas.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    canvas.addEventListener('mousedown', (e) => { this.mouse.down = true; this.emit('click', e.button, e); });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.emit('wheel', Math.sign(e.deltaY), e); e.preventDefault(); }, { passive: false });
    // toque: toque simples = clique
    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      this.mouse.x = t.clientX; this.mouse.y = t.clientY;
      this.emit('click', 0, e);
      e.preventDefault();
    }, { passive: false });
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
