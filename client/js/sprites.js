// Arte procedural: personagens, monstros, NPCs e objetos desenhados com Canvas 2D.
// Coordenadas em pixels de mundo (TILE = 32). (x, y) = ponto dos pés da figura.
import { ITEMS } from '/shared/data/items.js';
import { SKIN_TONES, HAIR_COLORS } from '/shared/data/classes.js';

// ------------------------------------------------------------------ utilidades de cor
function parseColor(col) {
  if (col.startsWith('rgb')) {
    const m = col.match(/[\d.]+/g).map(Number);
    return [m[0], m[1], m[2]];
  }
  let c = col.replace('#', '');
  if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
  const n = parseInt(c, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(col, amt) {
  // amt -1..1 escurece/clareia
  let [r, g, b] = parseColor(col);
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function rgba(col, a) {
  const [r, g, b] = parseColor(col);
  return `rgba(${r},${g},${b},${a})`;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function shadow(ctx, x, y, rx, ry = rx * 0.38, a = 0.28) {
  ellipse(ctx, x, y, rx, ry, `rgba(0,0,0,${a})`);
}

// ------------------------------------------------------------------ armas
function drawWeapon(ctx, type, color, glow, swing) {
  // desenhado na mão (origem), apontando para cima; swing em radianos
  ctx.save();
  ctx.rotate(swing);
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
  }
  switch (type) {
    case 'sword':
      ctx.fillStyle = '#5a3d1e'; ctx.fillRect(-1, -2, 2, 5);
      ctx.fillStyle = '#c9a227'; ctx.fillRect(-4, -3, 8, 2);
      ctx.fillStyle = color || '#d5d8dc';
      ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(2, -3); ctx.lineTo(1.5, -19); ctx.lineTo(0, -22); ctx.lineTo(-1.5, -19); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-0.5, -18, 1, 14);
      break;
    case 'axe':
      ctx.fillStyle = '#5a3d1e'; ctx.fillRect(-1, -18, 2, 21);
      ctx.fillStyle = color || '#aab7b8';
      ctx.beginPath(); ctx.moveTo(1, -18); ctx.quadraticCurveTo(9, -16, 8, -9); ctx.lineTo(1, -11); ctx.closePath(); ctx.fill();
      break;
    case 'hammer':
    case 'mace':
      ctx.fillStyle = '#5a3d1e'; ctx.fillRect(-1, -14, 2, 17);
      ctx.fillStyle = color || '#95a5a6';
      if (type === 'hammer') { rr(ctx, -5, -19, 10, 6, 1.5); ctx.fill(); }
      else {
        circle(ctx, 0, -16, 4.2, color || '#95a5a6');
        ctx.fillStyle = shade(color || '#95a5a6', -0.3);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.fillRect(Math.cos(a) * 4.5 - 1, -16 + Math.sin(a) * 4.5 - 1, 2, 2); }
      }
      break;
    case 'pick':
      ctx.fillStyle = '#5a3d1e'; ctx.fillRect(-1, -16, 2, 19);
      ctx.strokeStyle = color || '#7f8c8d'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-7, -12); ctx.quadraticCurveTo(0, -19, 7, -12); ctx.stroke();
      break;
    case 'staff': {
      ctx.fillStyle = '#6e4b2a'; ctx.fillRect(-1, -24, 2, 30);
      const orb = color || '#5dade2';
      ctx.shadowColor = orb; ctx.shadowBlur = glow ? 14 : 8;
      circle(ctx, 0, -26, 3.6, orb);
      ctx.shadowBlur = 0;
      circle(ctx, -1, -27, 1.2, 'rgba(255,255,255,0.8)');
      break;
    }
    case 'bow':
      ctx.strokeStyle = color || '#8b5a2b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-4, -6, 11, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,240,240,0.8)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(-4 + Math.cos(-1.2) * 11, -6 + Math.sin(-1.2) * 11); ctx.lineTo(-4 + Math.cos(1.2) * 11, -6 + Math.sin(1.2) * 11); ctx.stroke();
      break;
    default: break;
  }
  ctx.restore();
}

const WEAPON_BY_CLASS = { warrior: 'sword', berserker: 'axe', mage: 'staff', ranger: 'bow', cleric: 'mace' };

// ------------------------------------------------------------------ humanoide
// o: { dir, walk, skin, hair, hairStyle, tunic, legs, armor, trim, robe, cape, beard, hat, pointyHat, hood,
//      helm, helmColor, weapon, weaponColor, glow, small, dwarf, atk (0..1), flash, alpha, circlet, apron, goggles, leaves }
export function drawHumanoid(ctx, x, y, o) {
  const s = o.small ? 0.72 : o.dwarf ? 0.82 : 1;
  const wide = o.dwarf ? 1.18 : 1;
  ctx.save();
  ctx.translate(x, y);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  shadow(ctx, 0, 0, 9 * s * wide);
  ctx.scale(s * wide, s);
  const dir = o.dir || 0;
  const side = dir === 1 || dir === 2;
  if (dir === 1) ctx.scale(-1, 1);
  const ph = o.walk || 0;
  const step = Math.sin(ph);
  const bob = o.moving ? Math.abs(Math.cos(ph)) * 1.2 : Math.sin(Date.now() / 600) * 0.4;
  ctx.translate(0, -bob);
  const body = o.armor || o.tunic || '#7f8c8d';
  const legsC = o.legs || shade(body, -0.35);
  const skin = o.skin || '#e0ac69';
  const trim = o.trim || shade(body, 0.3);
  const atk = o.atk || 0;
  const weapon = o.weapon;

  // capa atrás
  if (o.cape && dir !== 3) {
    ctx.fillStyle = shade(o.cape, -0.2);
    ctx.beginPath(); ctx.moveTo(-7, -24); ctx.lineTo(7, -24); ctx.lineTo(9, -4 + step); ctx.lineTo(-9, -4 - step); ctx.closePath(); ctx.fill();
  }
  // arma atrás quando de costas
  const handBack = dir === 3;
  const swingAng = atk > 0 ? (Math.sin(atk * Math.PI) * 1.9 - 0.4) : 0.15;
  if (weapon && handBack) {
    ctx.save(); ctx.translate(8, -15); drawWeapon(ctx, weapon, o.weaponColor, o.glow, swingAng * 0.6); ctx.restore();
  }
  // pernas
  const legY = -12;
  ctx.fillStyle = legsC;
  if (side) {
    ctx.save(); ctx.translate(-1, legY); ctx.rotate(step * 0.5); ctx.fillRect(-2, 0, 4, 11); ctx.fillStyle = '#3b2a1a'; ctx.fillRect(-2, 9, 5, 3); ctx.restore();
    ctx.fillStyle = shade(legsC, -0.15);
    ctx.save(); ctx.translate(1, legY); ctx.rotate(-step * 0.5); ctx.fillRect(-2, 0, 4, 11); ctx.fillStyle = '#2e2014'; ctx.fillRect(-2, 9, 5, 3); ctx.restore();
  } else {
    const l = o.moving ? step * 2 : 0;
    ctx.fillRect(-5, legY - Math.max(0, l), 4, 12);
    ctx.fillRect(1, legY - Math.max(0, -l), 4, 12);
    ctx.fillStyle = '#3b2a1a';
    ctx.fillRect(-5.5, -2 - Math.max(0, l), 5, 2.5);
    ctx.fillRect(0.5, -2 - Math.max(0, -l), 5, 2.5);
  }
  // corpo
  if (o.robe) {
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(-7, -25); ctx.lineTo(7, -25); ctx.lineTo(9.5, -3); ctx.lineTo(-9.5, -3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = trim;
    ctx.fillRect(-9.5, -5, 19, 2);
    if (!side) ctx.fillRect(-1, -24, 2, 20);
  } else {
    ctx.fillStyle = body;
    rr(ctx, -7, -25, 14, 14, 3); ctx.fill();
    ctx.fillStyle = shade(body, -0.25);
    ctx.fillRect(-7, -14, 14, 2.5);
    ctx.fillStyle = trim;
    ctx.fillRect(-7, -14, 14, 1.2);
    if (o.apron) { ctx.fillStyle = o.apron; ctx.fillRect(-5, -20, 10, 14); }
    if (o.armor && !side) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-5, -23, 3, 6);
    }
  }
  if (o.leaves) {
    ctx.fillStyle = '#58d68d';
    for (let i = 0; i < 4; i++) circle(ctx, -6 + i * 4, -25, 1.8, i % 2 ? '#2ecc71' : '#58d68d');
  }
  // braço de trás
  const armSwing = o.moving ? step * 2.5 : 0;
  ctx.fillStyle = shade(body, -0.15);
  if (!side) { rr(ctx, -10, -24 + armSwing * 0.3, 3.5, 11, 1.5); ctx.fill(); }
  // cabeça
  const hy = -31;
  circle(ctx, 0, hy, 7, skin);
  // cabelo / rosto
  const hair = o.hair || '#2b1d0e';
  const style = o.hairStyle || 'short';
  if (dir === 3) {
    if (style !== 'bald') { ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0, hy, 7.3, 0, Math.PI * 2); ctx.fill(); }
    if (style === 'long' || style === 'braid') { ctx.fillStyle = hair; ctx.fillRect(-6, hy, 12, 10); }
    if (style === 'bun') circle(ctx, 0, hy - 6, 3, hair);
  } else {
    // olhos
    ctx.fillStyle = '#1b1b1b';
    if (side) ctx.fillRect(3, hy - 1, 1.6, 2);
    else { ctx.fillRect(-3.2, hy - 1, 1.6, 2); ctx.fillRect(1.6, hy - 1, 1.6, 2); }
    if (o.goggles) {
      ctx.fillStyle = '#d4ac0d';
      if (side) circle(ctx, 3.5, hy - 1, 2.2, 'rgba(133,193,233,0.8)');
      else { circle(ctx, -2.5, hy - 1, 2.2, 'rgba(133,193,233,0.8)'); circle(ctx, 2.5, hy - 1, 2.2, 'rgba(133,193,233,0.8)'); }
    }
    if (o.beard) {
      ctx.fillStyle = o.beard;
      ctx.beginPath();
      if (side) { ctx.moveTo(-1, hy + 2); ctx.quadraticCurveTo(6, hy + 4, 4, hy + (o.dwarf ? 12 : 9)); ctx.lineTo(-2, hy + 5); }
      else { ctx.moveTo(-6, hy + 1); ctx.quadraticCurveTo(0, hy + (o.dwarf ? 16 : 12), 6, hy + 1); ctx.lineTo(4, hy + 3); ctx.lineTo(-4, hy + 3); }
      ctx.closePath(); ctx.fill();
    }
    if (style !== 'bald') {
      ctx.fillStyle = hair;
      ctx.beginPath();
      if (side) { ctx.arc(-1, hy - 1, 7.4, Math.PI * 0.95, Math.PI * 2.15); ctx.lineTo(-7, hy + 2); }
      else { ctx.arc(0, hy - 1, 7.4, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(7, hy - 2); ctx.lineTo(-7, hy - 2); }
      ctx.closePath(); ctx.fill();
      if (style === 'long' || style === 'braid') {
        ctx.fillRect(side ? -7 : -7.5, hy - 2, 3, 11);
        if (!side) ctx.fillRect(4.5, hy - 2, 3, 11);
      }
      if (style === 'messy' || style === 'wild') {
        for (let i = -2; i <= 2; i++) circle(ctx, i * 3, hy - 7 + Math.abs(i) * 0.6, 2.4, hair);
      }
      if (style === 'bun') circle(ctx, side ? -5 : 0, hy - 7, 3, hair);
    }
  }
  // chapéus e elmos
  if (o.helm) {
    const hc = o.helmColor || '#95a5a6';
    ctx.fillStyle = hc;
    ctx.beginPath(); ctx.arc(0, hy - 1, 7.8, Math.PI, 0); ctx.lineTo(7.8, hy + 1); ctx.lineTo(-7.8, hy + 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(hc, -0.3);
    ctx.fillRect(-7.8, hy, 15.6, 1.6);
    if (o.helm === 'crown') {
      ctx.fillStyle = hc;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 3 - 1.5, hy - 7); ctx.lineTo(i * 3, hy - 12); ctx.lineTo(i * 3 + 1.5, hy - 7); ctx.fill(); }
      circle(ctx, 0, hy - 6, 1.5, '#e74c3c');
    } else if (dir !== 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      if (side) ctx.fillRect(2, hy - 2, 5, 2); else ctx.fillRect(-5, hy - 2, 10, 2);
    }
  } else if (o.pointyHat) {
    ctx.fillStyle = o.hat || '#1b4f72';
    ctx.beginPath(); ctx.ellipse(0, hy - 5, 10, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, hy - 5); ctx.quadraticCurveTo(-1, hy - 14, 3, hy - 21); ctx.quadraticCurveTo(2, hy - 12, 6, hy - 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = o.trim || '#f4d03f';
    ctx.fillRect(-6, hy - 7, 12, 1.6);
  } else if (o.hat) {
    ctx.fillStyle = o.hat;
    ctx.beginPath(); ctx.ellipse(0, hy - 5, 9.5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    rr(ctx, -5.5, hy - 11, 11, 6.5, 2); ctx.fill();
  } else if (o.hood) {
    ctx.fillStyle = o.hood === true ? shade(body, -0.1) : o.hood;
    ctx.beginPath(); ctx.arc(0, hy - 0.5, 8.4, Math.PI * 0.9, Math.PI * 2.1); ctx.lineTo(8, hy + 5); ctx.lineTo(-8, hy + 5); ctx.closePath(); ctx.fill();
    if (dir !== 3) { ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(side ? 2 : 0, hy + 0.5, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1b1b1b'; if (side) ctx.fillRect(3.5, hy - 0.5, 1.6, 2); else { ctx.fillRect(-2.6, hy - 0.5, 1.5, 2); ctx.fillRect(1.1, hy - 0.5, 1.5, 2); } }
  } else if (o.circlet) {
    ctx.fillStyle = '#f4d03f';
    ctx.fillRect(-7, hy - 4, 14, 1.6);
    if (dir !== 3) circle(ctx, 0, hy - 3.3, 1.4, '#5dade2');
  }
  // braço da frente + arma
  ctx.fillStyle = body;
  if (side) { ctx.save(); ctx.translate(0, -23); ctx.rotate(-armSwing * 0.15 - atk * 1.2); rr(ctx, -1.8, 0, 3.6, 10, 1.5); ctx.fill(); circle(ctx, 0, 10, 1.9, skin); ctx.restore(); }
  else { rr(ctx, 6.5, -24 - armSwing * 0.3, 3.5, 11, 1.5); ctx.fill(); circle(ctx, 8.2, -13 - armSwing * 0.3, 1.9, skin); }
  if (weapon && !handBack) {
    ctx.save();
    if (side) { ctx.translate(Math.sin(atk * Math.PI) * 5, -14); }
    else ctx.translate(8.5, -13 - armSwing * 0.3);
    drawWeapon(ctx, weapon, o.weaponColor, o.glow, side ? swingAng : swingAng * 0.7);
    ctx.restore();
  }
  ctx.restore();
  if (o.flash) {
    ctx.save();
    ctx.globalAlpha = o.flash * 0.6;
    ctx.globalCompositeOperation = 'lighter';
    ellipse(ctx, x, y - 18 * s, 10 * s, 18 * s, '#ff6b6b');
    ctx.restore();
  }
}

// Monta as opções de aparência de um jogador a partir da classe e equipamentos.
export function playerLook(e) {
  const app = e.app || {};
  const look = {
    skin: SKIN_TONES[e.sk ?? 1] || SKIN_TONES[1],
    hair: HAIR_COLORS[e.hr ?? 0] || HAIR_COLORS[0],
    hairStyle: ['short', 'long', 'messy', 'short', 'braid', 'wild', 'bun', 'long'][(e.hr ?? 0) % 8],
    weapon: WEAPON_BY_CLASS[e.cls],
  };
  const chest = app.c && ITEMS[app.c];
  const legs = app.l && ITEMS[app.l];
  const head = app.h && ITEMS[app.h];
  const wpn = app.w && ITEMS[app.w];
  const classColor = { warrior: '#922b21', berserker: '#a04000', mage: '#1f4e8c', ranger: '#1e6b3c', cleric: '#d4ac0d' }[e.cls];
  look.tunic = classColor;
  if (chest) look.armor = chest.icon.c1;
  look.trim = classColor;
  if (legs) look.legs = shade(legs.icon.c1, -0.2);
  if (head) { look.helm = head.icon.shape === 'crown' ? 'crown' : 'helm'; look.helmColor = head.icon.c1; }
  if (wpn) look.weaponColor = e.cls === 'mage' ? wpn.icon.c1 === '#a0a0a0' ? '#5dade2' : wpn.icon.c1 : wpn.icon.c1;
  if (app.glow) look.glow = app.glow >= 10 ? '#ff9a1f' : app.glow >= 9 ? '#c060ff' : '#4fa3ff';
  if (wpn && wpn.unique) look.glow = '#ffd54f';
  if (e.cls === 'mage') { look.robe = true; if (!head) { look.pointyHat = true; look.hat = shade(look.armor || classColor, -0.1); } }
  if (e.cls === 'cleric') { look.robe = true; look.tunic = '#ecf0f1'; look.trim = '#d4ac0d'; if (chest) look.armor = shade(chest.icon.c1, 0.35); if (!head) look.circlet = true; }
  if (e.cls === 'ranger' && !head) look.hood = shade(look.armor || classColor, -0.15);
  if ((e.cls === 'warrior' || e.cls === 'berserker') && chest) look.cape = classColor;
  return look;
}

// ------------------------------------------------------------------ monstros
export function drawMonster(ctx, x, y, sprite, color, size, t, o = {}) {
  const fn = MONSTER_DRAW[sprite] || MONSTER_DRAW.slime;
  ctx.save();
  ctx.translate(x, y);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  if (o.dir === 1) ctx.scale(-1, 1);
  ctx.scale(size, size);
  fn(ctx, color, t, o);
  ctx.restore();
  if (o.flash) {
    ctx.save();
    ctx.globalAlpha = o.flash * 0.55;
    ctx.globalCompositeOperation = 'lighter';
    ellipse(ctx, x, y - 10 * size, 13 * size, 11 * size, '#ffffff');
    ctx.restore();
  }
}

const MONSTER_DRAW = {
  slime(ctx, c, t, o) {
    shadow(ctx, 0, 0, 11);
    const sq = Math.sin(t * (o.moving ? 10 : 3)) * 0.12;
    ctx.save();
    ctx.scale(1 + sq, 1 - sq);
    const g = ctx.createRadialGradient(-3, -12, 2, 0, -7, 13);
    g.addColorStop(0, shade(c, 0.45)); g.addColorStop(1, shade(c, -0.25));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.quadraticCurveTo(-12, -16, 0, -17); ctx.quadraticCurveTo(12, -16, 11, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-4, -12, 3, 2, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1b2631'; ctx.fillRect(-5, -9, 2.5, 3.5); ctx.fillRect(3, -9, 2.5, 3.5);
    ctx.restore();
  },
  wolf(ctx, c, t, o) {
    shadow(ctx, 0, 0, 14);
    const ph = o.phase || 0;
    const l = o.moving ? Math.sin(ph) * 3 : 0;
    ctx.fillStyle = shade(c, -0.3);
    ctx.fillRect(-9 + l, -7, 3, 7); ctx.fillRect(6 - l, -7, 3, 7);
    ctx.fillStyle = c;
    ctx.fillRect(-7 - l, -7, 3, 7); ctx.fillRect(4 + l, -7, 3, 7);
    ctx.beginPath(); ctx.ellipse(0, -10, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    // cauda
    ctx.strokeStyle = c; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-11, -11); ctx.quadraticCurveTo(-17, -14 + Math.sin(t * 6) * 2, -16, -6); ctx.stroke();
    // cabeça
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(11, -15, 6, 5, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, -15); ctx.lineTo(21, -12); ctx.lineTo(14, -10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -18); ctx.lineTo(9, -24); ctx.lineTo(12, -19); ctx.fill();
    ctx.fillStyle = shade(c, 0.4); ctx.beginPath(); ctx.ellipse(-1, -8, 8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d5dbdb'; ctx.fillRect(14, -17, 2, 2);
    ctx.fillStyle = '#111'; ctx.fillRect(20, -13, 2, 2);
  },
  boar(ctx, c, t, o) {
    shadow(ctx, 0, 0, 15);
    const l = o.moving ? Math.sin(o.phase || 0) * 2.5 : 0;
    ctx.fillStyle = shade(c, -0.35);
    ctx.fillRect(-9 + l, -6, 4, 6); ctx.fillRect(5 - l, -6, 4, 6);
    ctx.fillStyle = shade(c, -0.15);
    ctx.fillRect(-6 - l, -6, 4, 6); ctx.fillRect(8 + l, -6, 4, 6);
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(0, -11, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(c, -0.4);
    for (let i = -8; i < 8; i += 3) { ctx.beginPath(); ctx.moveTo(i, -18); ctx.lineTo(i + 1.5, -22); ctx.lineTo(i + 3, -18); ctx.fill(); }
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(13, -10, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(c, 0.25); ctx.beginPath(); ctx.ellipse(19, -9, 3, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0e6d2';
    ctx.beginPath(); ctx.moveTo(17, -7); ctx.quadraticCurveTo(22, -9, 21, -15); ctx.lineTo(18, -9); ctx.fill();
    ctx.fillStyle = o.boss ? '#e74c3c' : '#111'; ctx.fillRect(14, -14, 2, 2);
    if (o.boss) { ctx.fillStyle = '#7f8c8d'; ctx.fillRect(17, -9, 4, 2); }
  },
  goblin(ctx, c, t, o) { goblinBody(ctx, c, t, o, false); },
  goblin_shaman(ctx, c, t, o) { goblinBody(ctx, c, t, o, true); },
  spider(ctx, c, t, o) { spiderBody(ctx, c, t, o, false); },
  spider_queen(ctx, c, t, o) { spiderBody(ctx, c, t, o, true); },
  ent(ctx, c, t, o) {
    shadow(ctx, 0, 0, 13);
    const sw = Math.sin(t * 2) * 0.08;
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(-7, -6, 5, 6); ctx.fillRect(2, -6, 5, 6);
    ctx.fillStyle = c;
    rr(ctx, -8, -30, 16, 26, 5); ctx.fill();
    ctx.fillStyle = shade(c, -0.3);
    for (let i = 0; i < 4; i++) ctx.fillRect(-6 + i * 4, -28, 1.2, 22);
    ctx.save(); ctx.translate(-8, -24); ctx.rotate(-0.6 + sw); ctx.fillStyle = c; ctx.fillRect(-12, -2, 13, 4); ctx.restore();
    ctx.save(); ctx.translate(8, -24); ctx.rotate(0.6 - sw); ctx.fillStyle = c; ctx.fillRect(-1, -2, 13, 4); ctx.restore();
    const leaves = ['#3b5323', '#4a6b2a', '#5b4a2a'];
    for (let i = 0; i < 7; i++) circle(ctx, -9 + (i % 4) * 6, -34 - Math.floor(i / 4) * 6 + Math.sin(t + i) * 0.5, 6, leaves[i % 3]);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(-4, -22, 2.5, 2.5); ctx.fillRect(2, -22, 2.5, 2.5);
  },
  bat(ctx, c, t) {
    shadow(ctx, 0, 0, 7, 2.5, 0.2);
    const flap = Math.sin(t * 18);
    ctx.translate(0, -16 + Math.sin(t * 4) * 2);
    ctx.fillStyle = shade(c, -0.25);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-10, -8 * flap - 2, -16, 2 * flap); ctx.quadraticCurveTo(-8, 0, 0, 3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -8 * flap - 2, 16, 2 * flap); ctx.quadraticCurveTo(8, 0, 0, 3); ctx.fill();
    circle(ctx, 0, 0, 4.5, c);
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(-2, -7); ctx.lineTo(0, -3); ctx.lineTo(2, -7); ctx.lineTo(3, -3); ctx.fill();
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(-2, -1, 1.5, 1.5); ctx.fillRect(0.8, -1, 1.5, 1.5);
  },
  skeleton(ctx, c, t, o) { skeletonBody(ctx, c, t, o, 'sword'); },
  skeleton_archer(ctx, c, t, o) { skeletonBody(ctx, c, t, o, 'bow'); },
  golem(ctx, c, t, o) { golemBody(ctx, c, t, o, false); },
  golem_boss(ctx, c, t, o) { golemBody(ctx, c, t, o, true); },
  cultist(ctx, c, t, o) {
    drawHumanoid(ctx, 0, 0, { dir: o.dir === 1 ? 2 : o.dir, moving: o.moving, walk: o.phase, robe: true, tunic: c, trim: '#8e44ad', hood: shade(c, -0.25), skin: '#6c6c6c', weapon: 'staff', weaponColor: '#9b59b6', atk: o.atk });
    ctx.fillStyle = '#e74c3c';
    if (o.dir !== 3) { ctx.fillRect(-2.6, -31.5, 1.6, 1.6); ctx.fillRect(1.1, -31.5, 1.6, 1.6); }
  },
  wraith(ctx, c, t) {
    const fl = Math.sin(t * 3) * 2;
    shadow(ctx, 0, 0, 8, 3, 0.18);
    ctx.translate(0, -6 + fl);
    ctx.globalAlpha *= 0.85;
    const g = ctx.createLinearGradient(0, -34, 0, 4);
    g.addColorStop(0, shade(c, 0.2)); g.addColorStop(1, 'rgba(120,130,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-9, -22);
    ctx.quadraticCurveTo(0, -38, 9, -22);
    for (let i = 0; i <= 6; i++) ctx.lineTo(9 - i * 3, 2 + (i % 2 ? -5 : 0) + Math.sin(t * 6 + i) * 1.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b2631'; ctx.beginPath(); ctx.ellipse(0, -24, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#85c1e9'; ctx.shadowColor = '#85c1e9'; ctx.shadowBlur = 6;
    ctx.fillRect(-3.5, -26, 2, 2.5); ctx.fillRect(1.5, -26, 2, 2.5);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = shade(c, 0.1); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-8, -18); ctx.quadraticCurveTo(-15, -12, -13, -6 + fl); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -18); ctx.quadraticCurveTo(15, -12, 13, -6 - fl); ctx.stroke();
  },
  ash_knight(ctx, c, t, o) {
    drawHumanoid(ctx, 0, 0, { dir: o.dir === 1 ? 2 : o.dir, moving: o.moving, walk: o.phase, armor: c, legs: shade(c, -0.3), trim: '#e74c3c', helm: 'helm', helmColor: shade(c, 0.1), skin: '#333', weapon: 'sword', weaponColor: '#e74c3c', glow: '#e74c3c', cape: '#641e16', atk: o.atk });
    ctx.fillStyle = 'rgba(255,90,40,0.8)';
    for (let i = 0; i < 3; i++) circle(ctx, -6 + i * 6 + Math.sin(t * 3 + i) * 2, -40 - ((t * 20 + i * 7) % 12), 1.2, 'rgba(255,120,40,0.7)');
  },
  morvath(ctx, c, t, o) {
    const fl = Math.sin(t * 2) * 2;
    shadow(ctx, 0, 0, 12, 4, 0.3);
    ctx.save();
    ctx.translate(0, -4 + fl);
    // aura
    const g = ctx.createRadialGradient(0, -22, 4, 0, -22, 26);
    g.addColorStop(0, 'rgba(120,60,160,0.35)'); g.addColorStop(1, 'rgba(120,60,160,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -22, 26, 0, Math.PI * 2); ctx.fill();
    // manto
    ctx.fillStyle = '#3d3d3d';
    ctx.beginPath(); ctx.moveTo(-9, -28); ctx.lineTo(9, -28); ctx.lineTo(13, 0); ctx.lineTo(-13, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(-7, -28); ctx.lineTo(7, -28); ctx.lineTo(9, -2); ctx.lineTo(-9, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c0392b'; ctx.fillRect(-1, -27, 2, 25);
    // ombreiras
    ctx.fillStyle = '#566573'; circle(ctx, -9, -27, 4, '#566573'); circle(ctx, 9, -27, 4, '#566573');
    // cabeça
    circle(ctx, 0, -34, 6.5, '#aab7b8');
    ctx.fillStyle = '#1b1b1b'; ctx.fillRect(-4, -36, 8, 3);
    ctx.fillStyle = '#ff5733'; ctx.shadowColor = '#ff5733'; ctx.shadowBlur = 8;
    ctx.fillRect(-3, -35.5, 2, 2); ctx.fillRect(1, -35.5, 2, 2);
    ctx.shadowBlur = 0;
    // coroa
    ctx.fillStyle = '#7b7d7d';
    ctx.fillRect(-6, -41, 12, 3);
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 2.6 - 1.3, -41); ctx.lineTo(i * 2.6, -46 - (i === 0 ? 2 : 0)); ctx.lineTo(i * 2.6 + 1.3, -41); ctx.fill(); }
    circle(ctx, 0, -42, 1.3, '#e74c3c');
    // orbe de cinzas na mão
    ctx.shadowColor = '#e67e22'; ctx.shadowBlur = 10;
    circle(ctx, 12, -16 + Math.sin(t * 4) * 1.5, 3.5, '#e67e22');
    ctx.shadowBlur = 0;
    ctx.restore();
  },
};

function goblinBody(ctx, c, t, o, shaman) {
  const look = {
    dir: o.dir === 1 ? 2 : o.dir, moving: o.moving, walk: o.phase, skin: c, tunic: shaman ? '#6e2c00' : '#784212',
    legs: '#4a3520', hairStyle: 'bald', weapon: shaman ? 'staff' : 'axe', weaponColor: shaman ? '#a3e635' : '#95a5a6', atk: o.atk,
    small: true, robe: shaman,
  };
  drawHumanoid(ctx, 0, 0, look);
  // orelhas pontudas
  ctx.fillStyle = c;
  const hy = -31 * 0.72 - 0.5;
  ctx.beginPath(); ctx.moveTo(-4, hy); ctx.lineTo(-10, hy - 4); ctx.lineTo(-4, hy + 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4, hy); ctx.lineTo(10, hy - 4); ctx.lineTo(4, hy + 2); ctx.fill();
  if (shaman) {
    ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(-3, hy - 5); ctx.lineTo(0, hy - 14); ctx.lineTo(3, hy - 5); ctx.fill();
    ctx.fillStyle = '#f4d03f'; ctx.beginPath(); ctx.moveTo(1, hy - 5); ctx.lineTo(5, hy - 12); ctx.lineTo(5, hy - 5); ctx.fill();
  }
}

function spiderBody(ctx, c, t, o, queen) {
  shadow(ctx, 0, 0, 15);
  const ph = (o.phase || 0) + t * (o.moving ? 0 : 1.5);
  ctx.strokeStyle = shade(c, -0.35); ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 4; i++) {
      const a = Math.sin(ph * 1.5 + i * 1.3) * (o.moving ? 2.5 : 0.8);
      const bx = side * 4, by = -9 + i * 2;
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(side * (11 + i), by - 9 + a, side * (15 + i * 1.5), by + 7 + a); ctx.stroke();
    }
  }
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.ellipse(-6, -10, 9, 7.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(c, 0.15);
  ctx.beginPath(); ctx.ellipse(5, -9, 5.5, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = queen ? '#f4d03f' : '#e74c3c';
  for (let i = 0; i < 4; i++) ctx.fillRect(6 + (i % 2) * 3, -12 + Math.floor(i / 2) * 2.5, 1.6, 1.6);
  ctx.fillStyle = shade(c, 0.35);
  ctx.beginPath(); ctx.moveTo(-10, -14); ctx.lineTo(-6, -16); ctx.lineTo(-2, -14); ctx.lineTo(-6, -11); ctx.fill();
  if (queen) {
    ctx.fillStyle = '#f4d03f';
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(5 + i * 2.5 - 1.2, -14); ctx.lineTo(5 + i * 2.5, -18.5); ctx.lineTo(5 + i * 2.5 + 1.2, -14); ctx.fill(); }
    ctx.fillStyle = 'rgba(180,120,220,0.5)';
    ctx.beginPath(); ctx.ellipse(-6, -10, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function skeletonBody(ctx, c, t, o, weapon) {
  const dir = o.dir === 1 ? 2 : o.dir;
  drawHumanoid(ctx, 0, 0, { dir, moving: o.moving, walk: o.phase, tunic: '#5d4e37', legs: c, skin: c, hairStyle: 'bald', weapon, weaponColor: '#95a5a6', atk: o.atk, helm: weapon === 'sword' ? 'helm' : null, helmColor: '#7f6a3c' });
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  for (let i = 0; i < 3; i++) ctx.fillRect(-5, -22 + i * 3, 10, 1);
  if (dir !== 3) { ctx.fillStyle = '#111'; ctx.fillRect(-3.5, -32, 2.5, 2.5); ctx.fillRect(1, -32, 2.5, 2.5); }
}

function golemBody(ctx, c, t, o, boss) {
  shadow(ctx, 0, 0, 15);
  const l = o.moving ? Math.sin(o.phase || 0) * 2 : 0;
  ctx.fillStyle = shade(c, -0.3);
  rr(ctx, -10, -10 - Math.max(0, l), 8, 10, 2); ctx.fill();
  rr(ctx, 2, -10 - Math.max(0, -l), 8, 10, 2); ctx.fill();
  ctx.fillStyle = c;
  rr(ctx, -13, -32, 26, 24, 5); ctx.fill();
  ctx.fillStyle = shade(c, 0.2);
  rr(ctx, -11, -31, 10, 7, 2); ctx.fill();
  ctx.fillStyle = shade(c, -0.2);
  rr(ctx, -20, -30 + l, 8, 18, 3); ctx.fill();
  rr(ctx, 12, -30 - l, 8, 18, 3); ctx.fill();
  ctx.fillStyle = c;
  rr(ctx, -7, -42, 14, 11, 3); ctx.fill();
  const glow = boss ? '#ff9f1a' : '#5dade2';
  ctx.shadowColor = glow; ctx.shadowBlur = 8;
  ctx.fillStyle = glow;
  ctx.fillRect(-4, -38, 3, 2.5); ctx.fillRect(1.5, -38, 3, 2.5);
  if (boss) {
    const pulse = 0.6 + Math.sin(t * 3) * 0.4;
    ctx.globalAlpha *= pulse;
    circle(ctx, 0, -21, 4.5, '#ff9f1a');
    ctx.globalAlpha /= pulse;
    ctx.strokeStyle = 'rgba(255,159,26,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-9, -28); ctx.lineTo(-3, -22); ctx.lineTo(-8, -14); ctx.moveTo(9, -27); ctx.lineTo(4, -21); ctx.lineTo(9, -13); ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

// ------------------------------------------------------------------ NPCs especiais
export function drawNpc(ctx, x, y, npc, t, o = {}) {
  const look = npc.look;
  switch (look.type) {
    case 'human':
    case 'dwarf': {
      const opts = {
        ...look, dir: o.dir ?? 0, robe: !!look.robe, tunic: look.robe || look.tunic, armor: look.armor, small: look.small || npc.small,
        dwarf: look.type === 'dwarf', hairStyle: look.hairStyle || (look.type === 'dwarf' ? 'short' : 'short'),
        weapon: look.staff ? 'staff' : look.sword ? 'sword' : look.bow ? 'bow' : look.hammer ? 'hammer' : look.axe ? 'axe' : look.pick ? 'pick' : null,
        hood: look.hood ? shade(look.robe || '#555', -0.2) : null, pointyHat: look.pointyHat, hat: look.hat,
      };
      drawHumanoid(ctx, x, y, opts);
      break;
    }
    case 'cat': {
      ctx.save(); ctx.translate(x, y);
      shadow(ctx, 0, 0, 8);
      const c = look.color;
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(0, -6, 8, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      circle(ctx, 7, -10, 4, c);
      ctx.beginPath(); ctx.moveTo(4, -12); ctx.lineTo(5, -17); ctx.lineTo(7, -13); ctx.fill();
      ctx.beginPath(); ctx.moveTo(8, -13); ctx.lineTo(10, -17); ctx.lineTo(10.5, -12); ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-7, -7); ctx.quadraticCurveTo(-13, -10 + Math.sin(t * 3) * 3, -11, -16); ctx.stroke();
      ctx.fillStyle = shade(c, -0.3); ctx.fillRect(-2, -10, 2, 1); ctx.fillRect(2, -10, 2, 1);
      ctx.fillStyle = '#145a32'; ctx.fillRect(8, -11, 1.2, 1.5); ctx.fillRect(5.5, -11, 1.2, 1.5);
      ctx.restore();
      break;
    }
    case 'board': {
      ctx.save(); ctx.translate(x, y);
      shadow(ctx, 0, 0, 13);
      ctx.fillStyle = '#5d4037'; ctx.fillRect(-12, -26, 3, 26); ctx.fillRect(9, -26, 3, 26);
      ctx.fillStyle = '#8d6e63'; rr(ctx, -15, -34, 30, 20, 2); ctx.fill();
      ctx.fillStyle = '#6d4c41'; ctx.fillRect(-15, -35, 30, 3);
      const papers = ['#f5e6c8', '#fdebd0', '#f9e79f', '#fadbd8'];
      for (let i = 0; i < 4; i++) { ctx.fillStyle = papers[i]; ctx.fillRect(-12 + i * 6.5, -31 + (i % 2) * 3, 5.5, 8); }
      ctx.fillStyle = '#c0392b'; for (let i = 0; i < 4; i++) ctx.fillRect(-10 + i * 6.5, -31 + (i % 2) * 3, 1.5, 1.5);
      ctx.restore();
      break;
    }
    case 'lore': {
      ctx.save(); ctx.translate(x, y);
      shadow(ctx, 0, 0, 10);
      ctx.fillStyle = '#7f8c8d';
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-8, -20); ctx.quadraticCurveTo(0, -27, 8, -20); ctx.lineTo(9, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#95a5a6'; ctx.fillRect(-6, -18, 3, 15);
      const a = 0.5 + Math.sin(t * 2) * 0.3;
      ctx.fillStyle = `rgba(133,193,233,${a})`;
      ctx.shadowColor = '#85c1e9'; ctx.shadowBlur = 6;
      for (let i = 0; i < 4; i++) { ctx.fillRect(-4 + (i % 2) * 5, -17 + i * 3.5, 3, 1.5); }
      ctx.restore();
      break;
    }
    case 'waystone': {
      ctx.save(); ctx.translate(x, y);
      shadow(ctx, 0, 0, 10);
      ctx.fillStyle = '#566573';
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-5, -34); ctx.lineTo(0, -40); ctx.lineTo(5, -34); ctx.lineTo(7, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#717d7e'; ctx.beginPath(); ctx.moveTo(-5, -34); ctx.lineTo(0, -40); ctx.lineTo(0, 0); ctx.lineTo(-7, 0); ctx.fill();
      const a = 0.55 + Math.sin(t * 2.5) * 0.35;
      ctx.shadowColor = '#5dade2'; ctx.shadowBlur = 10;
      ctx.fillStyle = `rgba(93,173,226,${a})`;
      ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(3, -24); ctx.lineTo(0, -18); ctx.lineTo(-3, -24); ctx.closePath(); ctx.fill();
      ctx.fillRect(-0.8, -15, 1.6, 10);
      for (let i = 0; i < 3; i++) circle(ctx, Math.sin(t * 1.5 + i * 2) * 9, -20 - ((t * 10 + i * 9) % 26), 1.3, `rgba(133,193,233,${a})`);
      ctx.restore();
      break;
    }
    case 'altar': {
      ctx.save(); ctx.translate(x, y);
      shadow(ctx, 0, 0, 16);
      ctx.fillStyle = '#7f8c8d'; rr(ctx, -16, -14, 32, 14, 2); ctx.fill();
      ctx.fillStyle = '#95a5a6'; rr(ctx, -18, -18, 36, 6, 2); ctx.fill();
      ctx.fillStyle = '#566573'; ctx.fillRect(-12, -11, 24, 2);
      const lit = o.lit;
      const cols = ['#58d68d', '#e67e22', '#85c1e9'];
      for (let i = 0; i < 3; i++) {
        const fx = -9 + i * 9;
        ctx.fillStyle = '#4d5656'; ctx.fillRect(fx - 2.5, -22, 5, 4);
        if (lit) {
          ctx.shadowColor = cols[i]; ctx.shadowBlur = 12;
          ctx.fillStyle = cols[i];
          ctx.beginPath(); ctx.moveTo(fx - 2.5, -22); ctx.quadraticCurveTo(fx, -32 - Math.sin(t * 8 + i) * 2, fx + 2.5, -22); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      if (lit) {
        ctx.shadowColor = '#ffd54f'; ctx.shadowBlur = 20;
        ctx.fillStyle = '#ffd54f';
        ctx.beginPath(); ctx.moveTo(-5, -26); ctx.quadraticCurveTo(0, -48 - Math.sin(t * 6) * 4, 5, -26); ctx.fill();
        ctx.fillStyle = '#fff3a0';
        ctx.beginPath(); ctx.moveTo(-2.5, -26); ctx.quadraticCurveTo(0, -38 - Math.sin(t * 7) * 3, 2.5, -26); ctx.fill();
      }
      ctx.restore();
      break;
    }
    default: break;
  }
}

// ------------------------------------------------------------------ ícones de itens
const iconCache = new Map();

export function itemIcon(id, size = 36) {
  const key = id + ':' + size;
  if (iconCache.has(key)) return iconCache.get(key);
  const base = ITEMS[id];
  const cv = document.createElement('canvas');
  cv.width = cv.height = size * 2;
  const ctx = cv.getContext('2d');
  ctx.scale((size * 2) / 32, (size * 2) / 32);
  if (base) drawIcon(ctx, base.icon);
  const url = cv.toDataURL();
  iconCache.set(key, url);
  return url;
}

export function drawIcon(ctx, icon) {
  const { shape, c1, c2 } = icon;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (shape) {
    case 'sword':
      ctx.translate(16, 16); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = c2; ctx.fillRect(-1.5, 6, 3, 7);
      ctx.fillStyle = '#c9a227'; ctx.fillRect(-6, 4, 12, 3);
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(-2.5, 4); ctx.lineTo(2.5, 4); ctx.lineTo(2, -11); ctx.lineTo(0, -14); ctx.lineTo(-2, -11); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-0.5, -10, 1, 13);
      break;
    case 'staff':
      ctx.translate(16, 16); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#6e4b2a'; ctx.fillRect(-1.5, -8, 3, 22);
      ctx.shadowColor = c1; ctx.shadowBlur = 6;
      circle(ctx, 0, -10, 5, c1 === '#a0a0a0' ? '#5dade2' : c1);
      ctx.shadowBlur = 0; circle(ctx, -1.5, -11.5, 1.5, 'rgba(255,255,255,0.8)');
      break;
    case 'bow':
      ctx.translate(16, 16); ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = c1; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-6, 0, 13, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = '#ecf0f1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6 + Math.cos(-1.1) * 13, Math.sin(-1.1) * 13); ctx.lineTo(-6 + Math.cos(1.1) * 13, Math.sin(1.1) * 13); ctx.stroke();
      break;
    case 'axe':
      ctx.translate(16, 16); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#6e4b2a'; ctx.fillRect(-1.5, -12, 3, 26);
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(1.5, -12); ctx.quadraticCurveTo(13, -12, 12, -2); ctx.lineTo(1.5, -4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-1.5, -10); ctx.quadraticCurveTo(-8, -10, -7, -4); ctx.lineTo(-1.5, -5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(4, -9, 5, 1.4);
      break;
    case 'mace':
      ctx.translate(16, 16); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#6e4b2a'; ctx.fillRect(-1.5, -4, 3, 17);
      circle(ctx, 0, -7, 6, c1);
      ctx.fillStyle = shade(c1, -0.3);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.fillRect(Math.cos(a) * 6.5 - 1.5, -7 + Math.sin(a) * 6.5 - 1.5, 3, 3); }
      break;
    case 'helm':
      ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(16, 18, 11, Math.PI, 0); ctx.lineTo(27, 24); ctx.lineTo(5, 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c1, -0.35); ctx.fillRect(9, 17, 14, 3); ctx.fillRect(15, 7, 2, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(9, 10, 3, 6);
      break;
    case 'chest':
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(12, 5); ctx.lineTo(20, 5); ctx.lineTo(26, 8); ctx.lineTo(25, 15); ctx.lineTo(22, 14); ctx.lineTo(22, 27); ctx.lineTo(10, 27); ctx.lineTo(10, 14); ctx.lineTo(7, 15); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c1, -0.3); ctx.fillRect(10, 20, 12, 2.5);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(12, 8, 3, 9);
      break;
    case 'legs':
      ctx.fillStyle = c1; ctx.fillRect(9, 5, 14, 6); ctx.fillRect(9, 10, 6, 17); ctx.fillRect(17, 10, 6, 17);
      ctx.fillStyle = shade(c1, -0.3); ctx.fillRect(9, 5, 14, 2);
      break;
    case 'boots':
      ctx.fillStyle = c1; ctx.fillRect(7, 8, 6, 14); ctx.fillRect(7, 19, 10, 6); ctx.fillRect(18, 8, 6, 14); ctx.fillRect(18, 19, 10, 6);
      ctx.fillStyle = shade(c1, -0.4); ctx.fillRect(7, 23, 10, 2); ctx.fillRect(18, 23, 10, 2);
      break;
    case 'ring':
      ctx.strokeStyle = c1; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(16, 18, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowColor = c2; ctx.shadowBlur = 6; circle(ctx, 16, 9, 4, c2); ctx.shadowBlur = 0;
      break;
    case 'amulet':
      ctx.strokeStyle = '#d4ac0d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(8, 4); ctx.quadraticCurveTo(16, 20, 24, 4); ctx.stroke();
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(16, 14); ctx.lineTo(22, 21); ctx.lineTo(16, 28); ctx.lineTo(10, 21); ctx.closePath(); ctx.fill();
      ctx.shadowColor = c2; ctx.shadowBlur = 6; circle(ctx, 16, 21, 3, c2); ctx.shadowBlur = 0;
      break;
    case 'potion':
      ctx.fillStyle = 'rgba(220,230,240,0.35)'; ctx.beginPath(); ctx.arc(16, 20, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(16, 20, 8, -0.2, Math.PI + 0.2); ctx.fill();
      ctx.fillStyle = '#d5dbdb'; ctx.fillRect(13, 6, 6, 6);
      ctx.fillStyle = '#8b5a2b'; ctx.fillRect(12.5, 4, 7, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(11, 15, 2.5, 5);
      break;
    case 'elixir':
      ctx.fillStyle = 'rgba(220,230,240,0.35)'; ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(22, 10); ctx.lineTo(25, 27); ctx.lineTo(7, 27); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(9, 16); ctx.lineTo(23, 16); ctx.lineTo(25, 27); ctx.lineTo(7, 27); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c2; ctx.fillRect(12, 5, 8, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; circle(ctx, 13, 21, 1.5, 'rgba(255,255,255,0.7)'); circle(ctx, 19, 24, 1, 'rgba(255,255,255,0.7)');
      break;
    case 'scroll':
      ctx.fillStyle = c1; ctx.fillRect(8, 8, 16, 16);
      ctx.fillStyle = shade(c1, -0.2); circle(ctx, 8, 16, 3, shade(c1, -0.2)); circle(ctx, 24, 16, 3, shade(c1, -0.2));
      ctx.fillStyle = c2; ctx.fillRect(11, 12, 10, 1.5); ctx.fillRect(11, 16, 8, 1.5); ctx.fillRect(11, 20, 9, 1.5);
      break;
    case 'gem':
      ctx.shadowColor = c1; ctx.shadowBlur = 8;
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(16, 5); ctx.lineTo(25, 13); ctx.lineTo(16, 28); ctx.lineTo(7, 13); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = shade(c1, 0.4); ctx.beginPath(); ctx.moveTo(16, 5); ctx.lineTo(20, 13); ctx.lineTo(12, 13); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c2; circle(ctx, 16, 15, 2, c2);
      break;
    case 'slime':
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(6, 25); ctx.quadraticCurveTo(5, 9, 16, 8); ctx.quadraticCurveTo(27, 9, 26, 25); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(12, 14, 3, 2, -0.5, 0, Math.PI * 2); ctx.fill();
      break;
    case 'pelt':
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(6, 10); ctx.quadraticCurveTo(16, 4, 26, 10); ctx.lineTo(24, 26); ctx.quadraticCurveTo(16, 22, 8, 26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c1, -0.25); for (let i = 0; i < 5; i++) ctx.fillRect(9 + i * 3, 12 + (i % 2) * 4, 1.5, 6);
      break;
    case 'tusk':
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(8, 26); ctx.quadraticCurveTo(10, 8, 24, 5); ctx.quadraticCurveTo(15, 14, 14, 27); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c1, -0.2); ctx.fillRect(8, 24, 6, 3);
      break;
    case 'herb':
      ctx.strokeStyle = '#1e8449'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(16, 28); ctx.lineTo(16, 10); ctx.stroke();
      for (let i = 0; i < 3; i++) { ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(12 + (i % 2) * 8, 12 + i * 5, 5, 2.5, i % 2 ? 0.6 : -0.6, 0, Math.PI * 2); ctx.fill(); }
      circle(ctx, 16, 8, 3, '#d6eaf8');
      break;
    case 'cloth':
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(6, 8); ctx.lineTo(26, 6); ctx.lineTo(24, 26); ctx.lineTo(8, 24); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = shade(c1, 0.3); ctx.setLineDash([2, 2]); ctx.lineWidth = 1; ctx.strokeRect(10, 10, 12, 11); ctx.setLineDash([]);
      break;
    case 'silk':
      ctx.strokeStyle = c1; ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(16, 16, 11 - i * 2, 7 - i, i * 0.3, 0, Math.PI * 2); ctx.stroke(); }
      break;
    case 'bark':
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(8, 6); ctx.lineTo(22, 4); ctx.lineTo(26, 26); ctx.lineTo(10, 28); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = shade(c1, -0.4); ctx.lineWidth = 1.5; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(11 + i * 3.5, 7); ctx.lineTo(13 + i * 3.5, 26); ctx.stroke(); }
      break;
    case 'wing':
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(4, 10); ctx.quadraticCurveTo(16, 2, 28, 10); ctx.lineTo(24, 22); ctx.lineTo(20, 17); ctx.lineTo(16, 24); ctx.lineTo(12, 17); ctx.lineTo(8, 22); ctx.closePath(); ctx.fill();
      break;
    case 'bone':
      ctx.strokeStyle = c1; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(9, 23); ctx.lineTo(23, 9); ctx.stroke();
      for (const [x, y] of [[7, 21], [11, 25], [21, 7], [25, 11]]) circle(ctx, x, y, 3, c1);
      break;
    case 'ore':
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(6, 22); ctx.lineTo(10, 9); ctx.lineTo(20, 6); ctx.lineTo(27, 15); ctx.lineTo(23, 26); ctx.lineTo(11, 27); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#aab7b8'; ctx.fillRect(12, 13, 3, 3); ctx.fillRect(19, 18, 2, 2); ctx.fillRect(16, 10, 2, 2);
      break;
    case 'crystal':
      ctx.shadowColor = c1; ctx.shadowBlur = 8; ctx.fillStyle = c1;
      ctx.beginPath(); ctx.moveTo(13, 28); ctx.lineTo(9, 12); ctx.lineTo(14, 4); ctx.lineTo(18, 12); ctx.lineTo(16, 28); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(17, 28); ctx.lineTo(20, 14); ctx.lineTo(24, 11); ctx.lineTo(25, 20); ctx.lineTo(21, 28); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      break;
    case 'essence':
      for (let i = 0; i < 4; i++) { ctx.globalAlpha = 0.35 + i * 0.15; circle(ctx, 16 + Math.sin(i * 2) * 5, 18 - i * 3, 8 - i * 1.5, c1); }
      ctx.globalAlpha = 1; circle(ctx, 16, 12, 2, '#d2b4de');
      break;
    case 'ash':
      ctx.fillStyle = '#566573'; ctx.beginPath(); ctx.ellipse(16, 22, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = c1; ctx.shadowBlur = 6;
      for (let i = 0; i < 5; i++) circle(ctx, 10 + i * 3, 20 + (i % 2) * 3, 1.8, i % 2 ? '#f39c12' : c1);
      ctx.shadowBlur = 0;
      break;
    case 'ember':
    case 'brasa': {
      ctx.shadowColor = c1; ctx.shadowBlur = 12;
      ctx.fillStyle = c2 || c1;
      ctx.beginPath(); ctx.moveTo(16, 3); ctx.quadraticCurveTo(26, 16, 21, 25); ctx.quadraticCurveTo(16, 30, 11, 25); ctx.quadraticCurveTo(6, 16, 16, 3); ctx.fill();
      ctx.fillStyle = c1;
      ctx.beginPath(); ctx.moveTo(16, 10); ctx.quadraticCurveTo(22, 18, 19, 24); ctx.quadraticCurveTo(16, 27, 13, 24); ctx.quadraticCurveTo(10, 18, 16, 10); ctx.fill();
      ctx.shadowBlur = 0;
      if (shape === 'brasa') circle(ctx, 16, 21, 2.5, '#ffffff');
      break;
    }
    case 'sack':
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(10, 10); ctx.quadraticCurveTo(4, 26, 16, 28); ctx.quadraticCurveTo(28, 26, 22, 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c1, -0.3); ctx.fillRect(11, 8, 10, 3);
      ctx.fillStyle = '#f5e6c8'; ctx.fillRect(13, 15, 6, 6);
      break;
    case 'tag':
      ctx.fillStyle = c1; rr(ctx, 7, 9, 18, 13, 2); ctx.fill();
      ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(10, 9); ctx.lineTo(16, 3); ctx.lineTo(22, 9); ctx.stroke();
      ctx.fillStyle = shade(c1, -0.4); ctx.fillRect(10, 13, 12, 1.5); ctx.fillRect(10, 17, 8, 1.5);
      break;
    case 'sigil':
      ctx.fillStyle = '#2c2c2c'; circle(ctx, 16, 16, 11, '#2c2c2c');
      ctx.strokeStyle = c1; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(16, 16, 8, 4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, 16); ctx.quadraticCurveTo(16, 20, 24, 16); ctx.stroke();
      break;
    case 'crown':
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(5, 24); ctx.lineTo(6, 10); ctx.lineTo(11, 17); ctx.lineTo(16, 7); ctx.lineTo(21, 17); ctx.lineTo(26, 10); ctx.lineTo(27, 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c2; circle(ctx, 16, 19, 2.5, c2); circle(ctx, 10, 21, 1.5, c2); circle(ctx, 22, 21, 1.5, c2);
      break;
    case 'heart':
      ctx.shadowColor = c1; ctx.shadowBlur = 8;
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(16, 27); ctx.bezierCurveTo(2, 16, 8, 4, 16, 11); ctx.bezierCurveTo(24, 4, 30, 16, 16, 27); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = shade(c1, -0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(12, 12); ctx.lineTo(15, 18); ctx.lineTo(13, 22); ctx.stroke();
      break;
    default:
      circle(ctx, 16, 16, 9, c1);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ ícones de habilidades
const skillIconCache = new Map();

export function skillIcon(sk, size = 44) {
  const key = sk.id + ':' + size;
  if (skillIconCache.has(key)) return skillIconCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size * 2;
  const ctx = cv.getContext('2d');
  ctx.scale((size * 2) / 40, (size * 2) / 40);
  const { sym, c1, c2 } = sk.icon;
  const g = ctx.createRadialGradient(20, 16, 3, 20, 20, 28);
  g.addColorStop(0, shade(c2, 0.15)); g.addColorStop(1, shade(c2, -0.55));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 40, 40);
  ctx.strokeStyle = c1; ctx.fillStyle = c1; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = c1; ctx.shadowBlur = 6;
  const P = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); };
  switch (sym) {
    case 'sword': P([10, 30, 28, 12]); ctx.stroke(); P([24, 8, 32, 16]); ctx.stroke(); P([8, 26, 14, 32]); ctx.stroke(); break;
    case 'shout': for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(12, 20, 6 + i * 6, -0.8, 0.8); ctx.stroke(); } circle(ctx, 10, 20, 3, c1); break;
    case 'charge': P([6, 20, 22, 20]); ctx.stroke(); P([18, 12, 30, 20, 18, 28]); ctx.stroke(); P([6, 12, 12, 12]); ctx.stroke(); P([6, 28, 12, 28]); ctx.stroke(); break;
    case 'whirl': ctx.beginPath(); for (let a = 0; a < 12; a += 0.2) { const r = 2 + a * 1.2; ctx.lineTo(20 + Math.cos(a) * r, 20 + Math.sin(a) * r); } ctx.stroke(); break;
    case 'fury': P([20, 6, 26, 18, 20, 16, 24, 34, 12, 18, 18, 20, 14, 6]); ctx.closePath(); ctx.fill(); break;
    case 'exec': P([20, 4, 20, 26]); ctx.stroke(); P([12, 24, 28, 24]); ctx.stroke(); P([16, 24, 16, 30]); ctx.stroke(); P([24, 24, 24, 30]); ctx.stroke(); ctx.globalAlpha = 0.6; P([8, 34, 32, 34]); ctx.stroke(); ctx.globalAlpha = 1; break;
    case 'cleave': P([14, 34, 22, 8]); ctx.stroke(); ctx.beginPath(); ctx.moveTo(21, 8); ctx.quadraticCurveTo(36, 10, 31, 24); ctx.lineTo(24, 16); ctx.fill(); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(20, 22, 15, -2.4, -0.2); ctx.stroke(); ctx.globalAlpha = 1; break;
    case 'rend': for (let i = -1; i <= 1; i++) { P([10 + i * 7, 6, 26 + i * 7, 34]); ctx.stroke(); } ctx.fillStyle = '#ff6b5a'; circle(ctx, 14, 36, 1.8, '#ff6b5a'); circle(ctx, 28, 37, 1.6, '#ff6b5a'); break;
    case 'leap': ctx.beginPath(); ctx.arc(20, 30, 14, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); P([27, 24, 33, 30, 26, 32]); ctx.stroke(); ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.ellipse(32, 34, 6, 2.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; break;
    case 'frenzy': P([20, 4, 30, 18, 24, 18, 28, 36, 14, 20, 20, 20]); ctx.closePath(); ctx.fill(); circle(ctx, 14, 14, 2.4, '#fff3a0'); circle(ctx, 26, 14, 2.4, '#fff3a0'); break;
    case 'roar': ctx.beginPath(); ctx.moveTo(6, 14); ctx.lineTo(18, 20); ctx.lineTo(6, 28); ctx.closePath(); ctx.fill(); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(14, 21, 10 + i * 6, -0.9, 0.9); ctx.stroke(); } break;
    case 'massacre': ctx.beginPath(); ctx.arc(20, 17, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(14, 24, 12, 8); ctx.fillStyle = shade(c2, -0.4); circle(ctx, 15.5, 17, 3, shade(c2, -0.4)); circle(ctx, 24.5, 17, 3, shade(c2, -0.4)); ctx.fillRect(18, 25, 1.6, 6); ctx.fillRect(21.4, 25, 1.6, 6); break;
    case 'axe': P([12, 32, 26, 10]); ctx.stroke(); ctx.beginPath(); ctx.moveTo(22, 8); ctx.quadraticCurveTo(36, 10, 30, 22); ctx.lineTo(24, 14); ctx.fill(); break;
    case 'fire': ctx.beginPath(); ctx.moveTo(20, 6); ctx.quadraticCurveTo(32, 20, 26, 30); ctx.quadraticCurveTo(20, 36, 14, 30); ctx.quadraticCurveTo(8, 20, 20, 6); ctx.fill(); ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.moveTo(20, 16); ctx.quadraticCurveTo(25, 24, 22, 29); ctx.quadraticCurveTo(20, 31, 18, 29); ctx.quadraticCurveTo(15, 24, 20, 16); ctx.fill(); break;
    case 'frost': for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(20, 20); ctx.rotate((i * Math.PI) / 3); P([0, -14, 0, 14]); ctx.stroke(); P([-4, -10, 0, -6, 4, -10]); ctx.stroke(); P([-4, 10, 0, 6, 4, 10]); ctx.stroke(); ctx.restore(); } break;
    case 'shield': ctx.beginPath(); ctx.moveTo(20, 6); ctx.lineTo(32, 11); ctx.quadraticCurveTo(32, 26, 20, 34); ctx.quadraticCurveTo(8, 26, 8, 11); ctx.closePath(); ctx.stroke(); circle(ctx, 20, 19, 4, c1); break;
    case 'meteor': circle(ctx, 26, 26, 6, c1); P([22, 22, 8, 8]); ctx.stroke(); P([26, 18, 16, 6]); ctx.stroke(); P([18, 26, 6, 16]); ctx.stroke(); break;
    case 'blink': for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.3 + i * 0.35; circle(ctx, 10 + i * 9, 20, 4 + i, c1); } ctx.globalAlpha = 1; break;
    case 'nova': for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; P([20 + Math.cos(a) * 5, 20 + Math.sin(a) * 5, 20 + Math.cos(a) * 15, 20 + Math.sin(a) * 15]); ctx.stroke(); } circle(ctx, 20, 20, 4, c1); break;
    case 'arrow': P([8, 32, 30, 10]); ctx.stroke(); P([22, 10, 30, 10, 30, 18]); ctx.stroke(); P([8, 26, 12, 32, 6, 30]); ctx.stroke(); break;
    case 'poison': ctx.beginPath(); ctx.moveTo(20, 8); ctx.quadraticCurveTo(30, 22, 20, 32); ctx.quadraticCurveTo(10, 22, 20, 8); ctx.fill(); ctx.fillStyle = shade(c2, -0.3); circle(ctx, 17, 22, 2, shade(c2, -0.3)); circle(ctx, 23, 25, 1.5, shade(c2, -0.3)); break;
    case 'roll': ctx.beginPath(); ctx.arc(20, 20, 11, 0.3, Math.PI * 1.7); ctx.stroke(); P([28, 8, 31, 15, 24, 14]); ctx.stroke(); break;
    case 'rain': for (let i = 0; i < 5; i++) { P([8 + i * 6, 6 + (i % 2) * 4, 8 + i * 6, 24 + (i % 2) * 4]); ctx.stroke(); P([5 + i * 6, 20 + (i % 2) * 4, 8 + i * 6, 25 + (i % 2) * 4, 11 + i * 6, 20 + (i % 2) * 4]); ctx.stroke(); } break;
    case 'eye': ctx.beginPath(); ctx.moveTo(5, 20); ctx.quadraticCurveTo(20, 6, 35, 20); ctx.quadraticCurveTo(20, 34, 5, 20); ctx.stroke(); circle(ctx, 20, 20, 5, c1); break;
    case 'multi': for (let i = -1; i <= 1; i++) { P([8, 20, 32, 20 + i * 10]); ctx.stroke(); } break;
    case 'sun': circle(ctx, 20, 20, 7, c1); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; P([20 + Math.cos(a) * 10, 20 + Math.sin(a) * 10, 20 + Math.cos(a) * 15, 20 + Math.sin(a) * 15]); ctx.stroke(); } break;
    case 'heal': ctx.fillRect(16, 8, 8, 24); ctx.fillRect(8, 16, 24, 8); break;
    case 'bless': ctx.beginPath(); ctx.arc(20, 22, 10, Math.PI, 0); ctx.stroke(); P([20, 6, 20, 14]); ctx.stroke(); P([10, 10, 13, 14]); ctx.stroke(); P([30, 10, 27, 14]); ctx.stroke(); break;
    case 'consec': ctx.beginPath(); ctx.ellipse(20, 26, 14, 6, 0, 0, Math.PI * 2); ctx.stroke(); P([20, 6, 20, 24]); ctx.stroke(); P([14, 12, 26, 12]); ctx.stroke(); break;
    case 'faith': ctx.beginPath(); ctx.moveTo(20, 6); ctx.lineTo(32, 11); ctx.quadraticCurveTo(32, 26, 20, 34); ctx.quadraticCurveTo(8, 26, 8, 11); ctx.closePath(); ctx.fill(); ctx.fillStyle = shade(c2, -0.2); ctx.fillRect(18, 12, 4, 14); ctx.fillRect(14, 16, 12, 4); break;
    case 'grace': for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(20, 20, 4 + i * 5, 0, Math.PI * 2); ctx.globalAlpha = 1 - i * 0.25; ctx.stroke(); } ctx.globalAlpha = 1; break;
    default: circle(ctx, 20, 20, 8, c1);
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 38, 38);
  const url = cv.toDataURL();
  skillIconCache.set(key, url);
  return url;
}

export { rr, circle, ellipse };
