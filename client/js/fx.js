// Efeitos visuais: projéteis, explosões, áreas, avisos de ataque, partículas e textos flutuantes.
import { TILE } from '/shared/constants.js';
import { circle, ellipse } from './sprites.js';

const STYLE_COLORS = {
  fire: ['#ff9f1a', '#ff5722'], frost: ['#d6f3ff', '#5dade2'], arcane: ['#d2b4de', '#8e44ad'],
  arrow: ['#d5d8dc', '#8b5a2b'], arrow_big: ['#f7dc6f', '#8b5a2b'], poison: ['#a3e635', '#3f6212'],
  holy: ['#fff8c4', '#f4d03f'], shadow: ['#bb8fce', '#4a235a'], ash: ['#ffb74d', '#5d4037'],
  heal: ['#abebc6', '#27ae60'], web: ['#ffffff', '#bdc3c7'], roots: ['#a1887f', '#4e342e'],
  void: ['#bb8fce', '#2e0f3a'], meteor: ['#ffcc80', '#e65100'], stomp: ['#d7ccc8', '#6d4c41'],
  rock: ['#bcaaa4', '#5d4037'], charge: ['#ffab91', '#bf360c'], shout: ['#ffe082', '#ff8f00'],
  whirl: ['#eceff1', '#90a4ae'], frostnova: ['#e1f5fe', '#4fc3f7'], grace: ['#fffde7', '#ffd54f'],
  consec: ['#fff59d', '#f9a825'], arrows: ['#d7ccc8', '#6d4c41'], blink: ['#e1bee7', '#8e24aa'],
  roll: ['#fff9c4', '#c0a000'], fury: ['#ff8a65', '#c62828'], bless: ['#fff3e0', '#ef6c00'],
  faith: ['#fffde7', '#fbc02d'], hawk: ['#fff59d', '#f9a825'], elixir: ['#f8bbd0', '#ad1457'],
  enrage: ['#ff5252', '#b71c1c'], harden: ['#b39ddb', '#4527a0'],
};

export class Effects {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.particles = [];
    this.texts = [];
  }

  now() { return performance.now(); }

  add(e) {
    e.start = e.start ?? this.now();
    this.list.push(e);
    return e;
  }

  text(x, y, text, color, opts = {}) {
    this.texts.push({ x, y, text, color, start: this.now(), dur: opts.dur || 1100, size: opts.size || 14, vy: opts.vy ?? -38, crit: opts.crit, dx: (Math.random() - 0.5) * 14 });
  }

  burst(x, y, n, opts = {}) {
    const [c1, c2] = STYLE_COLORS[opts.style] || [opts.color || '#fff', opts.color2 || '#aaa'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed || 60) * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - (opts.up || 0), life: (opts.life || 600) * (0.6 + Math.random() * 0.6),
        age: 0, size: (opts.size || 2.5) * (0.6 + Math.random() * 0.8), color: Math.random() < 0.5 ? c1 : c2, grav: opts.grav ?? 30, glow: opts.glow,
      });
    }
  }

  update(dt) {
    const now = this.now();
    this.list = this.list.filter((e) => now - e.start < e.dur);
    for (const p of this.particles) {
      p.age += dt * 1000;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.vx *= 0.98;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
    this.texts = this.texts.filter((t) => now - t.start < t.dur);
    // trilhas de projéteis
    for (const e of this.list) {
      if (e.kind === 'proj') {
        const pos = this.projPos(e, now);
        if (pos && (e.style === 'fire' || e.style === 'ash' || e.style === 'meteor') && Math.random() < 0.8) {
          this.particles.push({ x: pos.x, y: pos.y, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 20, life: 350, age: 0, size: 2.5, color: Math.random() < 0.5 ? '#ffb74d' : '#ff5722', grav: -20, glow: true });
        }
        if (pos && (e.style === 'frost' || e.style === 'holy' || e.style === 'arcane' || e.style === 'shadow' || e.style === 'heal') && Math.random() < 0.5) {
          const [c1] = STYLE_COLORS[e.style];
          this.particles.push({ x: pos.x, y: pos.y, vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15, life: 300, age: 0, size: 2, color: c1, grav: 0, glow: true });
        }
      }
      if (e.kind === 'area' && e.style === 'consec' && Math.random() < 0.4) {
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * e.r * TILE;
        this.particles.push({ x: e.x * TILE + Math.cos(a) * d, y: e.y * TILE + Math.sin(a) * d * 0.7, vx: 0, vy: -25, life: 700, age: 0, size: 2, color: '#fff59d', grav: -5, glow: true });
      }
    }
  }

  // posição atual de um projétil (pixels de mundo)
  projPos(e, now) {
    const g = this.game;
    const t = Math.min(1, (now - e.start) / e.dur);
    const a = e.fromPos;
    let b = e.toPos;
    if (e.to != null) {
      const ent = g.entities.get(e.to);
      if (ent) b = { x: ent.rx * TILE, y: ent.ry * TILE - 16 };
    }
    if (!a || !b) return null;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: Math.atan2(b.y - a.y, b.x - a.x), t };
  }

  // ------------------------------------------------------------ desenho (camada do chão)
  drawGround(ctx) {
    const now = this.now();
    for (const e of this.list) {
      const t = (now - e.start) / e.dur;
      const x = e.x * TILE, y = e.y * TILE, r = (e.r || 1) * TILE;
      if (e.kind === 'tele') {
        ctx.save();
        const col = e.friendly ? '255,170,60' : '230,40,40';
        ctx.fillStyle = `rgba(${col},${0.12 + t * 0.15})`;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${col},${0.25 + t * 0.2})`;
        ctx.beginPath(); ctx.ellipse(x, y, r * t, r * 0.75 * t, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(${col},0.85)`; ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]); ctx.lineDashOffset = -now / 40;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'area') {
        const [c1, c2] = STYLE_COLORS[e.style] || ['#fff', '#aaa'];
        const fade = Math.min(1, (1 - t) * 4, t * 8);
        ctx.save();
        ctx.globalAlpha = 0.45 * fade;
        const g = ctx.createRadialGradient(x, y, 2, x, y, r);
        g.addColorStop(0, c1); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.8 * fade;
        ctx.strokeStyle = c2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); ctx.stroke();
        if (e.style === 'consec') {
          ctx.strokeStyle = c1; ctx.lineWidth = 1.5;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + now / 1200;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75); ctx.stroke();
          }
        }
        ctx.restore();
      } else if (e.kind === 'aoe' && e.ground) {
        const [c1] = STYLE_COLORS[e.style] || ['#fff'];
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.5;
        ctx.fillStyle = c1;
        ctx.beginPath(); ctx.ellipse(x, y, r * (0.4 + t * 0.6), r * 0.75 * (0.4 + t * 0.6), 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
  }

  // ------------------------------------------------------------ desenho (camada superior)
  drawTop(ctx) {
    const now = this.now();
    const g = this.game;
    for (const e of this.list) {
      const t = (now - e.start) / e.dur;
      if (e.kind === 'proj') {
        const p = this.projPos(e, now);
        if (!p) continue;
        drawProjectile(ctx, e.style, p.x, p.y, p.ang, now);
      } else if (e.kind === 'aoe') {
        const x = e.x * TILE, y = e.y * TILE, r = e.r * TILE;
        const [c1, c2] = STYLE_COLORS[e.style] || ['#fff', '#aaa'];
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = c1; ctx.lineWidth = 4 * (1 - t) + 1;
        ctx.beginPath(); ctx.ellipse(x, y, r * (0.3 + t * 0.7), r * 0.75 * (0.3 + t * 0.7), 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = c2; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y, r * t, r * 0.75 * t, 0, 0, Math.PI * 2); ctx.stroke();
        if (e.style === 'whirl' && e.id != null) {
          const ent = g.entities.get(e.id);
          if (ent) {
            ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(ent.rx * TILE, ent.ry * TILE - 14, r * 0.7, now / 60, now / 60 + 4.2); ctx.stroke();
          }
        }
        if (e.style === 'meteor' && t < 0.3) {
          ctx.globalAlpha = 1 - t / 0.3;
          circle(ctx, x, y - 10, r * 0.6 * (t / 0.3 + 0.3), 'rgba(255,200,80,0.7)');
        }
        ctx.restore();
      } else if (e.kind === 'falling') {
        // meteoros caindo antes do impacto
        const ft = Math.min(1, t);
        const x = e.x * TILE + (1 - ft) * 60, y = e.y * TILE - (1 - ft) * 220;
        drawProjectile(ctx, 'meteor', x, y, Math.PI * 0.6, now, 1.6);
      } else if (e.kind === 'swing') {
        const ent = g.entities.get(e.id);
        if (!ent) continue;
        const tg = e.target != null ? g.entities.get(e.target) : null;
        const ang = tg ? Math.atan2(tg.ry - ent.ry, tg.rx - ent.rx) : 0;
        const cx = ent.rx * TILE + Math.cos(ang) * 14, cy = ent.ry * TILE - 14 + Math.sin(ang) * 10;
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = e.style === 'heavy' || e.style === 'exec' ? '#ffcc80' : e.style === 'claw' ? '#ff8a80' : '#ffffff';
        ctx.lineWidth = e.style === 'heavy' || e.style === 'exec' ? 4 : 2.5;
        ctx.beginPath(); ctx.arc(cx, cy, 14 + t * 6, ang - 1.1 + t * 0.6, ang + 1.1 + t * 0.6); ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'buff') {
        const ent = g.entities.get(e.id);
        if (!ent) continue;
        const [c1, c2] = STYLE_COLORS[e.style] || ['#fff', '#ff0'];
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = c1; ctx.lineWidth = 2;
        const x = ent.rx * TILE, y = ent.ry * TILE;
        ctx.beginPath(); ctx.ellipse(x, y - 2, 14 + t * 10, 6 + t * 4, 0, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + t * 4;
          circle(ctx, x + Math.cos(a) * 12, y - 10 - t * 30 + Math.sin(a) * 4, 2, c2);
        }
        ctx.restore();
      } else if (e.kind === 'dash') {
        ctx.save();
        const [c1] = STYLE_COLORS[e.style] || ['#fff'];
        ctx.globalAlpha = (1 - t) * 0.6;
        ctx.strokeStyle = c1; ctx.lineWidth = 10 * (1 - t);
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(e.x0 * TILE, e.y0 * TILE - 14); ctx.lineTo(e.x * TILE, e.y * TILE - 14); ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'lvl' || e.kind === 'rv' || e.kind === 'sp') {
        const ent = g.entities.get(e.id);
        const x = ent ? ent.rx * TILE : e.x * TILE, y = ent ? ent.ry * TILE : e.y * TILE;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.sin(t * Math.PI) * 0.8;
        const col = e.kind === 'sp' ? 'rgba(160,80,220,' : 'rgba(255,215,90,';
        const grd = ctx.createLinearGradient(x, y - 120, x, y);
        grd.addColorStop(0, col + '0)'); grd.addColorStop(1, col + '0.8)');
        ctx.fillStyle = grd;
        ctx.fillRect(x - 14, y - 120, 28, 120);
        ctx.restore();
      }
    }
    // partículas
    ctx.save();
    for (const p of this.particles) {
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = a;
      if (p.glow) ctx.globalCompositeOperation = 'lighter'; else ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  }

  drawTexts(ctx) {
    const now = this.now();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = (now - t.start) / t.dur;
      const y = t.y + t.vy * k * (t.dur / 1000);
      const x = t.x + t.dx * k;
      const pop = t.crit ? 1 + Math.max(0, 0.6 - k * 3) : 1;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `${t.crit ? 'bold ' : ''}${Math.round(t.size * pop)}px "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(t.text, x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, x, y);
    }
    ctx.restore();
  }

  // fontes de luz dinâmicas para a noite
  lights(out) {
    const now = this.now();
    for (const e of this.list) {
      if (e.kind === 'proj') {
        const p = this.projPos(e, now);
        if (p && ['fire', 'holy', 'arcane', 'frost', 'ash', 'shadow', 'meteor'].includes(e.style)) out.push({ px: p.x, py: p.y, r: 70, c: STYLE_COLORS[e.style][0] });
      } else if (e.kind === 'aoe' || e.kind === 'area') {
        out.push({ px: e.x * TILE, py: e.y * TILE, r: (e.r || 2) * TILE * 1.4, c: (STYLE_COLORS[e.style] || ['#fff'])[0] });
      }
    }
  }
}

function drawProjectile(ctx, style, x, y, ang, now, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const [c1, c2] = STYLE_COLORS[style] || ['#fff', '#aaa'];
  switch (style) {
    case 'arrow':
    case 'arrow_big':
    case 'poison': {
      ctx.rotate(ang);
      const len = style === 'arrow_big' ? 18 : 14;
      ctx.strokeStyle = style === 'poison' ? '#7cb342' : '#8b5a2b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
      ctx.fillStyle = c1;
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-2, -3); ctx.lineTo(-2, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ecf0f1'; ctx.fillRect(-len, -2.5, 4, 1.5); ctx.fillRect(-len, 1, 4, 1.5);
      if (style !== 'arrow') { ctx.shadowColor = c1; ctx.shadowBlur = 8; ctx.fillRect(-len, -0.5, len, 1); }
      break;
    }
    case 'frost':
      ctx.rotate(ang);
      ctx.shadowColor = c2; ctx.shadowBlur = 10;
      ctx.fillStyle = c1;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -4); ctx.lineTo(-10, 0); ctx.lineTo(-6, 4); ctx.closePath(); ctx.fill();
      break;
    case 'web':
    case 'roots':
      ctx.rotate(ang);
      ctx.strokeStyle = c1; ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-14, i * 3); ctx.quadraticCurveTo(-4, i * 6, 6, 0); ctx.stroke(); }
      break;
    default: {
      const pulse = 1 + Math.sin(now / 50) * 0.15;
      ctx.shadowColor = c1; ctx.shadowBlur = 14;
      circle(ctx, 0, 0, 6 * pulse, c2);
      circle(ctx, 0, 0, 3.5 * pulse, c1);
    }
  }
  ctx.restore();
}

export { STYLE_COLORS, ellipse };
