// Camada 2D sobre a cena 3D: nomes, barras de vida, marcadores de missão, balões e números de dano.
import { F, RARITY } from '/shared/constants.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { NPCS } from '/shared/data/npcs.js';
import { ITEMS } from '/shared/data/items.js';
import { quality } from '../device.js';
import { drawIcon } from '../ui/icons.js';

export class Overlay {
  constructor(canvas, renderer, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.r = renderer;
    this.game = game;
  }

  resize(W, H) {
    const dpr = Math.min(quality().textDpr, window.devicePixelRatio || 1); // textos não precisam da resolução cheia nos perfis leves
    this.dpr = dpr;
    this.canvas.width = Math.floor(W * dpr);
    this.canvas.height = Math.floor(H * dpr);
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
  }

  draw(t) {
    const ctx = this.ctx;
    const g = this.game;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.r.W, this.r.H);
    // quanto mais perto, maiores os textos
    this.k = Math.max(0.8, Math.min(1.25, 15 / this.r.dist));
    const list = [];
    for (const e of g.entities.values()) {
      const a = this.r.actors.get(e.id);
      if (!a) continue;
      if (this.r.first && e.id === g.me.id) continue;
      const head = this.r.worldToScreen(e.rx, e.ry, a.height + (a.float || 0) + 0.15);
      if (head.behind || head.x < -80 || head.y < -80 || head.x > this.r.W + 80 || head.y > this.r.H + 80) continue;
      list.push({ e, a, head });
    }
    list.sort((p, q) => q.head.y - p.head.y);
    for (const it of list) {
      if (it.e.k === 'i') { if (it.e === g.hover || g.showItemNames || it.e.id === g.pickHint) this.itemLabel(it.e, it.head); }
      else this.entityLabel(it.e, it.head, t);
    }
    this.texts();
    this.guide();
  }

  // Destino da missão: rótulo com a distância sobre o raio de luz ou, fora da tela, uma seta na borda apontando o caminho
  guide() {
    const g = this.game;
    const gd = g.guide;
    if (!gd.active || !gd.wp) return;
    const ctx = this.ctx;
    const W = this.r.W, H = this.r.H;
    const col = gd.wp.portal ? '#5dade2' : '#ffd34d';
    const dist = Math.max(0, Math.round(gd.dist));
    const p = this.r.worldToScreen(gd.wp.x, gd.wp.y, 3.4);
    const margin = 34;
    const on = !p.behind && p.x > margin && p.x < W - margin && p.y > margin + 40 && p.y < H - margin - 70;
    ctx.save();
    ctx.textAlign = 'center';
    if (on) {
      label(ctx, gd.wp.label, p.x, p.y - 16, col, 12 * this.k, true);
      label(ctx, `${dist} m`, p.x, p.y, '#fff', 11 * this.k);
    } else {
      // direção na tela do ponto (se está atrás da câmera, inverte)
      let dx = p.x - W / 2, dy = p.y - H / 2;
      if (p.behind) { dx = -dx; dy = -dy; }
      const ang = Math.atan2(dy, dx);
      const ex = Math.cos(ang), ey = Math.sin(ang);
      const k = Math.min((W / 2 - margin) / Math.abs(ex || 1e-6), (H / 2 - margin - 60) / Math.abs(ey || 1e-6));
      const x = W / 2 + ex * k;
      let y = H / 2 + ey * k - 20;
      // no celular, a seta não fica escondida atrás dos botões de ação
      if (document.body.classList.contains('touch-ui') && x > W - 290 && y > H - 240) y = H - 240;
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, 11); ctx.lineTo(-4, 0); ctx.lineTo(-10, -11); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.rotate(-ang);
      label(ctx, `${dist} m`, 0, ey > 0 ? -20 : 22, '#fff', 12);
    }
    ctx.restore();
  }

  entityLabel(e, p, t) {
    const ctx = this.ctx;
    const g = this.game;
    const k = this.k;
    const isTarget = g.target === e.id, isHover = g.hover === e;
    const x = p.x, top = p.y;
    if (e.k === 'p') {
      const mine = e.id === g.me.id;
      const party = g.party && g.party.m.some((m) => m.id === e.id);
      const hostile = g.isHostile(e);
      const col = mine ? '#ffffff' : party ? '#82e0aa' : hostile ? '#ff6b6b' : '#aed6f1';
      let y = top - 6;
      if (!mine && (e.hp < e.mhp || isTarget)) { bar(ctx, x, y, 44 * k, 5, e.hp / e.mhp, hostile ? '#e74c3c' : '#2ecc71'); y -= 10; }
      if (e.g) { label(ctx, `<${e.g}>`, x, y, '#d2b4de', 10 * k); y -= 13 * k; }
      label(ctx, e.nm, x, y, col, 12 * k, true);
      if (e.ti) label(ctx, `« ${e.ti} »`, x, y - 13 * k, '#f7dc6f', 10 * k);
      if (mine && g.me.casting) {
        const c = g.me.casting;
        const foot = this.r.worldToScreen(e.rx, e.ry, 0);
        bar(ctx, x, foot.y + 10, 60, 6, Math.min(1, (performance.now() - c.start) / c.dur), '#5dade2');
      }
    } else if (e.k === 'm') {
      const d = MONSTERS[e.m];
      if (e.f & F.DEAD) return;
      const diff = e.lv - g.me.level;
      const col = d.boss ? '#ff9a1f' : diff >= 5 ? '#ff4d4d' : diff >= 3 ? '#ff9f43' : diff >= -2 ? '#f7f7f7' : diff >= -5 ? '#58d68d' : '#95a5a6';
      if (d.boss || isTarget || isHover || e.hp < e.mhp) {
        bar(ctx, x, top - 6, (d.boss ? 90 : 46) * k, d.boss ? 7 : 5, e.hp / e.mhp, '#e74c3c');
        label(ctx, `${d.name}  Nv ${e.lv}`, x, top - 17, col, (d.boss ? 13 : 11) * k, d.boss);
        if (d.boss) label(ctx, d.title, x, top - 31 * k, '#f5cba7', 10 * k);
      }
      if (e.f & F.CAST) drawIcon(ctx, 'warn', x + 22 * k, top - 30 * k, 16 * k, '#ff5252');
    } else if (e.k === 'n') {
      const n = NPCS[e.n];
      label(ctx, n.name, x, top - 4, '#f9e79f', 12 * k, true);
      if (n.title && (isHover || isTarget || n.look.type === 'human' || n.look.type === 'dwarf')) label(ctx, `<${n.title}>`, x, top + 9 * k, '#d5dbdb', 9 * k);
      const mark = g.questMarker(n.id);
      if (mark) {
        const bob = Math.sin(t * 3) * 3;
        ctx.save();
        ctx.font = `bold ${Math.round(26 * k)}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = '#000';
        ctx.strokeText(mark.s, x, top - 20 + bob);
        ctx.fillStyle = mark.c;
        ctx.shadowColor = mark.c; ctx.shadowBlur = 10;
        ctx.fillText(mark.s, x, top - 20 + bob);
        ctx.restore();
      }
    }
    if (e.bubble && performance.now() < e.bubble.until) bubble(ctx, e.bubble.text, x, top - 34 * k);
  }

  itemLabel(e, p) {
    const base = ITEMS[e.i];
    if (!base) return;
    const col = base.type === 'quest' ? '#f1c40f' : RARITY[e.r || 0].color;
    label(this.ctx, base.name + (e.q > 1 ? ` x${e.q}` : ''), p.x, p.y - 4, col, 11);
  }

  texts() {
    const ctx = this.ctx;
    const now = performance.now();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const tx of this.r.fx.texts) {
      const a = tx.anchor;
      let wx = a.x, wy = a.y, h = a.h ?? 1.5;
      if (a.id != null) {
        const e = this.game.entities.get(a.id);
        if (e) { wx = e.rx; wy = e.ry; h = this.r.entityHeight(e) + (a.dh || 0); }
      }
      const p = this.r.worldToScreen(wx, wy, h);
      if (p.behind) continue;
      const k = (now - tx.start) / tx.dur;
      const y = p.y + tx.vy * k * (tx.dur / 1000) + (a.oy || 0);
      const x = p.x + tx.dx * k + (a.ox || 0);
      const pop = tx.crit ? 1 + Math.max(0, 0.6 - k * 3) : 1;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `${tx.crit ? 'bold ' : ''}${Math.round(tx.size * pop * this.k)}px "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(tx.text, x, y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, x, y);
    }
    ctx.restore();
  }
}

function label(ctx, text, x, y, color, size = 11, bold = false) {
  ctx.save();
  ctx.font = `${bold ? 'bold ' : ''}${Math.round(size)}px "Trebuchet MS", Verdana, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function bar(ctx, x, y, w, h, pct, color) {
  pct = Math.max(0, Math.min(1, pct || 0));
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#3d0c0c';
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * pct, h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x - w / 2, y, w * pct, h / 3);
}

function bubble(ctx, text, x, y) {
  ctx.save();
  ctx.font = '12px "Trebuchet MS", sans-serif';
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if (ctx.measureText(line + ' ' + w).width > 170 && line) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 3);
  const w = Math.max(...shown.map((l) => ctx.measureText(l).width)) + 14;
  const h = shown.length * 15 + 8;
  ctx.fillStyle = 'rgba(255,255,255,0.93)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h, w, h, 6);
  ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x, y + 6); ctx.lineTo(x + 5, y); ctx.fill();
  ctx.fillStyle = '#1b1b1b'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  shown.forEach((l, i) => ctx.fillText(l, x, y - h + 4 + i * 15));
  ctx.restore();
}
