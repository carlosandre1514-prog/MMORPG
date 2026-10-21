// Sprites de personagens pré-renderizados a partir dos modelos 3D KayKit (ver tools/bake).
import { shadow } from './sprites.js';

const BASE = 'assets/sprites/';
const SCALE = 0.72; // pixels de mundo por pixel do quadro
const DIR_INDEX = [0, 1, 2, 3]; // baixo, esquerda, direita, cima (mesma ordem do manifesto)

// Quem usa qual sprite
export const NPC_SPRITES = { bran: 'cleric', lyra: 'ranger', kael: 'rogue', cael: 'hooded', brunhilda: 'warrior', ilyas: 'mage', elira: 'cleric', rurik: 'warrior' };
export const MONSTER_SPRITES = { cultist: 'cultist', ash_knight: 'ashknight' };
const CASTERS = new Set(['mage', 'cleric', 'cultist']);

class CharSpriteLib {
  constructor() {
    this.manifest = null;
    this.images = {};
    this.ready = false;
  }

  async load() {
    try {
      const res = await fetch(BASE + 'manifest.json');
      if (!res.ok) return false;
      this.manifest = await res.json();
      await Promise.all(Object.entries(this.manifest.sprites).map(([key, s]) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { this.images[key] = img; resolve(); };
        img.onerror = () => resolve();
        img.src = BASE + s.file;
      })));
      this.ready = Object.keys(this.images).length > 0;
    } catch {
      this.ready = false;
    }
    return this.ready;
  }

  has(key) { return this.ready && !!this.images[key]; }

  // Escolhe animação e quadro conforme o estado da entidade.
  pick(key, st) {
    const anims = this.manifest.sprites[key].anims;
    const now = performance.now();
    let name = 'idle', t = now;
    if (st.dead) { name = 'death'; t = now - (st.deathStart || now - 10000); }
    else if (st.atkStart && now - st.atkStart < 520) { name = CASTERS.has(key) ? 'cast' : 'attack'; t = (now - st.atkStart) * (anims[name].dur / 520); }
    else if (st.hurt && now - st.hurt < 260) { name = 'hit'; t = (now - st.hurt) * (anims.hit.dur / 260); }
    else if (st.moving) name = 'walk';
    const a = anims[name];
    let frame;
    if (name === 'walk') frame = Math.floor(((st.phase || 0) / (Math.PI * 2)) * a.frames) % a.frames;
    else if (a.loop) frame = Math.floor((t / a.dur) * a.frames) % a.frames;
    else frame = Math.min(a.frames - 1, Math.floor((t / a.dur) * a.frames));
    return { row: a.row + DIR_INDEX[st.dir || 0], frame: Math.max(0, frame) };
  }

  // Desenha com os pés em (x, y) em pixels de mundo.
  draw(ctx, key, x, y, st = {}) {
    const img = this.images[key];
    const m = this.manifest;
    const F = m.frame;
    const s = SCALE * (st.size || 1);
    const { row, frame } = this.pick(key, st);
    ctx.save();
    if (st.alpha != null) ctx.globalAlpha *= st.alpha;
    if (!st.dead) shadow(ctx, x, y, 11 * (st.size || 1), 4 * (st.size || 1), 0.3);
    if (st.glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y - 4, 1, x, y - 4, 22);
      g.addColorStop(0, st.glow); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha *= 0.45;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y - 4, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    const dx = x - m.anchorX * s, dy = y - m.anchorY * s;
    ctx.drawImage(img, frame * F, row * F, F, F, dx, dy, F * s, F * s);
    if (st.flash) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= st.flash * 0.55;
      ctx.drawImage(img, frame * F, row * F, F, F, dx, dy, F * s, F * s);
    }
    ctx.restore();
  }

  // Quadro parado (para retratos e prévias), desenhado num canvas de tamanho size.
  portrait(key, size, dir = 0, zoom = 1) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    if (!this.has(key)) return cv;
    const ctx = cv.getContext('2d');
    const m = this.manifest;
    const F = m.frame;
    const anim = m.sprites[key].anims.idle;
    const z = (size / F) * zoom;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.images[key], 0, (anim.row + dir) * F, F, F, size / 2 - m.anchorX * z, size * 0.9 - m.anchorY * z, F * z, F * z);
    return cv;
  }
}

export const charSprites = new CharSpriteLib();
