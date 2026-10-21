// Renderização do mundo: câmera, camadas, entidades, iluminação e sobreposições.
import { TILE, F, RARITY } from '/shared/constants.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { NPCS } from '/shared/data/npcs.js';
import { ITEMS } from '/shared/data/items.js';
import { OBJ_INFO } from '/shared/tiles.js';
import { drawHumanoid, drawMonster, drawNpc, playerLook, drawIcon, shadow, circle, ellipse, rr } from './sprites.js';
import { charSprites, NPC_SPRITES, MONSTER_SPRITES } from './charsprites.js';

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.dpr = 1;
    this.W = 0; this.H = 0;
    this.lightCv = document.createElement('canvas');
    this.lightCtx = this.lightCv.getContext('2d');
    this.ambient = [];
    this.itemSprites = new Map();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.lightCv.width = Math.ceil(this.W / 3);
    this.lightCv.height = Math.ceil(this.H / 3);
  }

  // escala de pixels de mundo -> pixels de tela
  get zoom() { return this.game.zoom; }

  camera() {
    const g = this.game;
    const z = this.zoom;
    const vw = this.W / z, vh = this.H / z;
    const me = g.myEntity();
    let cx = (me ? me.rx : g.me.x) * TILE - vw / 2;
    let cy = (me ? me.ry : g.me.y) * TILE - 16 - vh / 2;
    const mw = g.zone.w * TILE, mh = g.zone.h * TILE;
    cx = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, cx));
    cy = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, cy));
    if (g.shake > 0) { cx += (Math.random() - 0.5) * g.shake; cy += (Math.random() - 0.5) * g.shake; }
    return { x: cx, y: cy, w: vw, h: vh };
  }

  screenToWorld(sx, sy) {
    const cam = this.cam || this.camera();
    return { x: (cam.x + sx / this.zoom) / TILE, y: (cam.y + sy / this.zoom) / TILE };
  }

  worldToScreen(wx, wy) {
    const cam = this.cam || this.camera();
    return { x: (wx * TILE - cam.x) * this.zoom, y: (wy * TILE - cam.y) * this.zoom };
  }

  render(t) {
    const g = this.game;
    const ctx = this.ctx;
    if (!g.zone || !g.terrain) return;
    const k = this.zoom * this.dpr;
    g.terrain.setScale(Math.min(2.5, Math.round(k * 2) / 2));
    const cam = this.camera();
    this.cam = cam;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
    ctx.imageSmoothingEnabled = true;

    const terrain = g.terrain;
    terrain.drawGround(ctx, cam.x, cam.y, cam.w, cam.h, k);
    const tx0 = Math.max(0, Math.floor(cam.x / TILE) - 1), ty0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const tx1 = Math.min(g.zone.w - 1, Math.ceil((cam.x + cam.w) / TILE) + 1), ty1 = Math.min(g.zone.h - 1, Math.ceil((cam.y + cam.h) / TILE) + 1);
    terrain.drawLiquidAnim(ctx, tx0, ty0, tx1, ty1, t);
    this.drawPortals(ctx, t);
    g.fx.drawGround(ctx);
    this.drawTargetRings(ctx, t);
    // itens no chão
    for (const e of g.entities.values()) if (e.k === 'i') this.drawGroundItem(ctx, e, t);

    // camada ordenada por profundidade
    const list = [];
    for (const ob of terrain.tallObjects) {
      if (ob.x < tx0 - 2 || ob.x > tx1 + 2 || ob.y < ty0 - 1 || ob.y > ty1 + 4) continue;
      list.push({ y: ob.y + 0.8, ob });
    }
    for (const st of g.zone.structures) {
      if (st.x > tx1 + 2 || st.x + st.w < tx0 - 2 || st.y > ty1 + 3 || st.y + st.h < ty0 - 3) continue;
      list.push({ y: st.y + st.h, st });
    }
    for (const e of g.entities.values()) {
      if (e.k === 'i') continue;
      if (e.rx < tx0 - 2 || e.rx > tx1 + 2 || e.ry < ty0 - 1 || e.ry > ty1 + 3) continue;
      list.push({ y: e.ry, e });
    }
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.ob) terrain.drawObject(ctx, it.ob, t);
      else if (it.st) terrain.drawStructure(ctx, it.st);
      else this.drawEntity(ctx, it.e, t);
    }
    g.fx.drawTop(ctx);
    this.drawAmbient(ctx, cam, t);

    // iluminação
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawLighting(cam, t);

    // sobreposições legíveis
    ctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
    for (const it of list) if (it.e) this.drawOverlay(ctx, it.e, t);
    for (const e of g.entities.values()) if (e.k === 'i' && (e === g.hover || g.showItemNames)) this.drawItemLabel(ctx, e);
    g.fx.drawTexts(ctx);
    if (g.groundCursor) this.drawGroundCursor(ctx, t);
  }

  // ------------------------------------------------------------------ entidades
  entityHeight(e) {
    if (e.k === 'p') return charSprites.has(e.cls) ? 52 : 46;
    if (e.k === 'n') {
      const n = NPCS[e.n];
      if (charSprites.has(NPC_SPRITES[n.id])) return 52;
      const tp = n.look.type;
      if (tp === 'cat') return 20;
      if (tp === 'board' || tp === 'lore' || tp === 'altar') return 38;
      if (tp === 'waystone') return 44;
      return n.small || n.look.small ? 34 : tp === 'dwarf' ? 40 : 46;
    }
    if (e.k === 'm') {
      const d = MONSTERS[e.m];
      if (charSprites.has(MONSTER_SPRITES[d.id])) return 52 * d.size;
      const base = { slime: 18, wolf: 24, boar: 24, goblin: 34, goblin_shaman: 34, spider: 22, spider_queen: 24, ent: 44, bat: 30, skeleton: 44, skeleton_archer: 44, golem: 44, golem_boss: 44, cultist: 44, wraith: 40, ash_knight: 46, morvath: 50 }[d.sprite] || 30;
      return base * d.size;
    }
    return 20;
  }

  drawEntity(ctx, e, t) {
    const g = this.game;
    const x = e.rx * TILE, y = e.ry * TILE;
    const now = performance.now();
    const flash = e.hurt ? Math.max(0, 1 - (now - e.hurt) / 180) : 0;
    const atk = e.atkStart ? Math.min(1, (now - e.atkStart) / 260) : 0;
    const atkV = atk >= 1 ? 0 : atk;
    const dead = e.f & F.DEAD;
    let alpha = 1;
    if (dead) alpha = e.k === 'p' ? 0.45 : Math.max(0, 1 - (now - (e.deathStart || now)) / 1400);
    if (e.f & F.INVULN) alpha *= 0.6;
    if (alpha <= 0) return;
    ctx.save();
    if (dead && e.k === 'm' && !charSprites.has(MONSTER_SPRITES[e.m])) {
      ctx.translate(x, y);
      ctx.scale(1, Math.max(0.3, alpha));
      ctx.translate(-x, -y);
    }
    const spriteState = { dir: e.dir, moving: e.moving, phase: e.phase, atkStart: e.atkStart, hurt: e.hurt, dead: !!dead, deathStart: e.deathStart, flash };
    if (e.k === 'p') {
      const look = e.look || (e.look = playerLook(e));
      if (charSprites.has(e.cls)) {
        charSprites.draw(ctx, e.cls, x, y, { ...spriteState, alpha: dead ? 1 : alpha, glow: look.glow });
      } else {
        if (dead) { ctx.translate(x, y); ctx.rotate(Math.PI / 2 * 0.9); ctx.translate(-x, -y); }
        drawHumanoid(ctx, x, y, { ...look, dir: e.dir, walk: e.phase, moving: e.moving, atk: atkV, flash, alpha });
      }
      this.drawStatusFx(ctx, e, x, y, t);
    } else if (e.k === 'm') {
      const d = MONSTERS[e.m];
      const shake = (e.f & F.CAST) ? Math.sin(now / 25) * 1.2 : 0;
      const sk = MONSTER_SPRITES[d.id];
      if (charSprites.has(sk)) charSprites.draw(ctx, sk, x + shake, y, { ...spriteState, alpha, size: d.size, glow: d.id === 'ash_knight' ? 'rgba(255,90,30,0.9)' : 'rgba(160,80,220,0.8)' });
      else drawMonster(ctx, x + shake, y, d.sprite, d.color, d.size, t, { dir: e.dir, moving: e.moving, phase: e.phase, atk: atkV, flash, alpha, boss: d.boss });
      this.drawStatusFx(ctx, e, x, y, t);
    } else if (e.k === 'n') {
      const n = NPCS[e.n];
      const dir = g.dialogNpc === e.n ? g.faceDirTo(e) : 0;
      const sk = NPC_SPRITES[n.id];
      if (charSprites.has(sk)) charSprites.draw(ctx, sk, x, y, { dir });
      else drawNpc(ctx, x, y, n, t, { dir, lit: n.id === 'altar' && g.questDone('ms19') });
    }
    ctx.restore();
  }

  drawStatusFx(ctx, e, x, y, t) {
    const f = e.f;
    const h = this.entityHeight(e);
    if (f & F.SHIELD) {
      ctx.save(); ctx.globalAlpha = 0.25 + Math.sin(t * 4) * 0.08;
      ctx.strokeStyle = '#bb8fce'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(187,143,206,0.15)';
      ctx.beginPath(); ctx.ellipse(x, y - h / 2, h * 0.45, h * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    if (f & F.STUN) {
      for (let i = 0; i < 3; i++) { const a = t * 5 + (i * Math.PI * 2) / 3; circle(ctx, x + Math.cos(a) * 9, y - h - 4 + Math.sin(a) * 3, 2.2, '#f4d03f'); }
    }
    if (f & F.ROOT) {
      ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 6, y + 2); ctx.quadraticCurveTo(x + i * 10, y - 8, x + i * 3, y - 14); ctx.stroke(); }
    }
    if (f & F.SLOW) { ctx.fillStyle = 'rgba(133,193,233,0.25)'; ellipse(ctx, x, y, 12, 5, 'rgba(133,193,233,0.35)'); }
    if (f & F.BURN && Math.random() < 0.3) this.game.fx.burst(x + (Math.random() - 0.5) * 12, y - Math.random() * h, 1, { style: 'fire', speed: 10, up: 30, life: 400, glow: true, grav: -30 });
    if (f & F.POISON && Math.random() < 0.2) this.game.fx.burst(x + (Math.random() - 0.5) * 12, y - Math.random() * h, 1, { style: 'poison', speed: 6, up: 20, life: 500, grav: -15 });
    if (f & F.BUFF && Math.random() < 0.08) this.game.fx.burst(x + (Math.random() - 0.5) * 16, y - 4, 1, { style: 'grace', speed: 4, up: 40, life: 700, glow: true, grav: -10 });
    if (f & F.CAST && e.k === 'p') {
      ctx.strokeStyle = 'rgba(133,193,233,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, y, 14, 5, 0, t * 3, t * 3 + 4.5); ctx.stroke();
    }
  }

  drawGroundItem(ctx, e, t) {
    const x = e.rx * TILE, y = e.ry * TILE;
    const base = ITEMS[e.i];
    if (!base) return;
    const r = e.r || 0;
    const col = base.type === 'quest' ? '#f1c40f' : RARITY[r].color;
    ctx.save();
    if (r >= 2 || base.type === 'quest') {
      ctx.globalCompositeOperation = 'lighter';
      const a = 0.25 + Math.sin(t * 4 + e.id) * 0.1;
      const g = ctx.createRadialGradient(x, y, 1, x, y, 16);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a + 0.3;
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      if (r >= 3) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = col;
        ctx.fillRect(x - 1.5, y - 50 - Math.sin(t * 3) * 4, 3, 46);
      }
    }
    ctx.globalAlpha = 1;
    shadow(ctx, x, y + 2, 7, 2.5, 0.3);
    ctx.translate(x - 9, y - 14 + Math.sin(t * 3 + e.id) * 1.5);
    ctx.scale(18 / 32, 18 / 32);
    drawIcon(ctx, base.icon);
    ctx.restore();
  }

  drawItemLabel(ctx, e) {
    const base = ITEMS[e.i];
    if (!base) return;
    const name = (e.name || base.name) + (e.q > 1 ? ` x${e.q}` : '');
    const col = base.type === 'quest' ? '#f1c40f' : RARITY[e.r || 0].color;
    label(ctx, name, e.rx * TILE, e.ry * TILE - 24, col, 9);
  }

  drawPortals(ctx, t) {
    for (const p of this.game.zone.def.portals) {
      const cx = (p.x + p.w / 2) * TILE, cy = (p.y + p.h / 2) * TILE;
      const rx = p.w * TILE * 0.55, ry = p.h * TILE * 0.55;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(120,180,255,${0.35 - i * 0.08})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx * (0.5 + i * 0.25), ry * (0.5 + i * 0.25), 0, t * (1 + i * 0.3), t * (1 + i * 0.3) + 4.4); ctx.stroke();
      }
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(rx, ry));
      g.addColorStop(0, 'rgba(150,200,255,0.35)'); g.addColorStop(1, 'rgba(80,120,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      label(ctx, '➜ ' + p.label, cx, cy - ry - 8, '#aed6f1', 10);
    }
  }

  drawTargetRings(ctx, t) {
    const g = this.game;
    const draw = (e, col, dashed) => {
      if (!e) return;
      const s = e.k === 'm' ? Math.max(1, MONSTERS[e.m].size) : 1;
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      if (dashed) { ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 20; }
      ctx.beginPath(); ctx.ellipse(e.rx * TILE, e.ry * TILE, 15 * s, 6 * s, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };
    const tgt = g.entities.get(g.target);
    if (tgt) draw(tgt, tgt.k === 'm' || g.isHostile(tgt) ? '#e74c3c' : '#58d68d', true);
    if (g.hover && g.hover !== tgt && g.hover.k !== 'i') draw(g.hover, 'rgba(255,255,255,0.5)', false);
  }

  drawGroundCursor(ctx, t) {
    const gc = this.game.groundCursor;
    ctx.save();
    ctx.strokeStyle = gc.valid ? 'rgba(255,200,80,0.9)' : 'rgba(255,80,80,0.8)';
    ctx.fillStyle = gc.valid ? 'rgba(255,200,80,0.15)' : 'rgba(255,80,80,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.ellipse(gc.x * TILE, gc.y * TILE, gc.r * TILE, gc.r * TILE * 0.75, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ nomes e barras
  drawOverlay(ctx, e, t) {
    const g = this.game;
    const x = e.rx * TILE, y = e.ry * TILE;
    const h = this.entityHeight(e);
    const top = y - h - 6;
    const isTarget = g.target === e.id, isHover = g.hover === e;
    if (e.k === 'p') {
      const mine = e.id === g.me.id;
      const party = g.party && g.party.m.some((m) => m.id === e.id);
      const hostile = g.isHostile(e);
      let col = mine ? '#ffffff' : party ? '#82e0aa' : hostile ? '#ff6b6b' : '#aed6f1';
      if (e.ti) label(ctx, `« ${e.ti} »`, x, top - 22, '#f7dc6f', 8);
      label(ctx, `${e.nm}`, x, top - 10, col, 10, true);
      if (e.g) label(ctx, `<${e.g}>`, x, top + 1, '#d2b4de', 8);
      if (!mine && (e.hp < e.mhp || isTarget)) bar(ctx, x, top + (e.g ? 8 : 2), 30, 3.5, e.hp / e.mhp, party ? '#2ecc71' : hostile ? '#e74c3c' : '#2ecc71');
      if (mine && g.me.casting) {
        const c = g.me.casting;
        const p = Math.min(1, (performance.now() - c.start) / c.dur);
        bar(ctx, x, y + 8, 34, 4, p, '#5dade2');
      }
    } else if (e.k === 'm') {
      const d = MONSTERS[e.m];
      if (e.f & F.DEAD) return;
      const diff = e.lv - g.me.level;
      const col = d.boss ? '#ff9a1f' : diff >= 5 ? '#ff4d4d' : diff >= 3 ? '#ff9f43' : diff >= -2 ? '#f7f7f7' : diff >= -5 ? '#58d68d' : '#95a5a6';
      if (d.boss || isTarget || isHover || e.hp < e.mhp) {
        if (d.boss) label(ctx, d.title, x, top - 20, '#f5cba7', 8);
        label(ctx, `${d.name}  Nv ${e.lv}`, x, top - 9, col, d.boss ? 11 : 9, d.boss);
        bar(ctx, x, top, d.boss ? 56 : 30, d.boss ? 5 : 3.5, e.hp / e.mhp, '#e74c3c');
      }
    } else if (e.k === 'n') {
      const n = NPCS[e.n];
      label(ctx, n.name, x, top - 4, '#f9e79f', 10, true);
      if (n.title && (isHover || isTarget || n.look.type === 'human' || n.look.type === 'dwarf')) label(ctx, `<${n.title}>`, x, top + 7, '#d5dbdb', 7);
      const mark = g.questMarker(n.id);
      if (mark) {
        const bob = Math.sin(t * 3) * 2;
        ctx.save();
        ctx.font = 'bold 20px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = '#000';
        ctx.strokeText(mark.s, x, top - 16 + bob);
        ctx.fillStyle = mark.c;
        ctx.shadowColor = mark.c; ctx.shadowBlur = 8;
        ctx.fillText(mark.s, x, top - 16 + bob);
        ctx.restore();
      }
    }
    if (e.bubble && performance.now() < e.bubble.until) bubble(ctx, e.bubble.text, x, top - (e.k === 'p' ? 30 : 30));
  }

  // ------------------------------------------------------------------ iluminação
  darkness() {
    const g = this.game;
    const def = g.zone.def;
    const tday = g.dayTime();
    // 0..1, onde 0.25 = 6h, 0.5 = meio-dia, 0.75 = 18h
    let night;
    if (tday < 0.2 || tday > 0.85) night = 1;
    else if (tday < 0.3) night = 1 - (tday - 0.2) / 0.1;
    else if (tday > 0.75) night = (tday - 0.75) / 0.1;
    else night = 0;
    const base = def.alwaysDark || 0;
    return Math.min(0.92, base + night * (def.night ?? 0.6) * (1 - base));
  }

  drawLighting(cam, t) {
    const g = this.game;
    const ctx = this.ctx;
    const dark = this.darkness();
    const def = g.zone.def;
    if (def.tint) {
      ctx.fillStyle = def.tint;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (dark < 0.02) return;
    const lc = this.lightCtx;
    const LW = this.lightCv.width, LH = this.lightCv.height;
    const sc = LW / this.W;
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, LW, LH);
    lc.fillStyle = `rgba(6,8,24,${dark})`;
    lc.fillRect(0, 0, LW, LH);
    lc.globalCompositeOperation = 'destination-out';
    const z = this.zoom;
    const hole = (px, py, r, a = 1) => {
      const sx = (px - cam.x) * z * sc, sy = (py - cam.y) * z * sc, sr = r * z * sc;
      if (sx < -sr || sy < -sr || sx > LW + sr || sy > LH + sr) return;
      const gr = lc.createRadialGradient(sx, sy, sr * 0.15, sx, sy, sr);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = gr;
      lc.beginPath(); lc.arc(sx, sy, sr, 0, Math.PI * 2); lc.fill();
    };
    const me = g.myEntity();
    if (me) hole(me.rx * TILE, me.ry * TILE - 14, def.dark ? 150 : 190, 0.95);
    for (const L of g.terrain.lights) {
      const flick = L.lava ? 1 : 0.92 + Math.sin(t * 9 + L.x * 3) * 0.05;
      hole(L.x * TILE, L.y * TILE - (L.lava ? 0 : 14), L.r * TILE * flick, 0.9);
    }
    for (const e of g.entities.values()) {
      if (e.k === 'p' && e !== me) hole(e.rx * TILE, e.ry * TILE - 14, 70, 0.6);
      if (e.k === 'n' && (NPCS[e.n].look.type === 'waystone' || NPCS[e.n].look.type === 'altar')) hole(e.rx * TILE, e.ry * TILE - 20, 90, 0.8);
      if (e.k === 'm' && (MONSTERS[e.m].id === 'morvath' || MONSTERS[e.m].id === 'kragmor')) hole(e.rx * TILE, e.ry * TILE - 20, 110, 0.7);
      if (e.k === 'i' && (e.r || 0) >= 2) hole(e.rx * TILE, e.ry * TILE, 40, 0.5);
    }
    for (const p of g.zone.def.portals) hole((p.x + p.w / 2) * TILE, (p.y + p.h / 2) * TILE, 90, 0.8);
    const dyn = [];
    g.fx.lights(dyn);
    for (const L of dyn) hole(L.px, L.py, L.r, 0.85);
    ctx.drawImage(this.lightCv, 0, 0, this.canvas.width, this.canvas.height);
    // brilho quente das fontes de luz
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const k = this.zoom * this.dpr;
    for (const L of g.terrain.lights) {
      const sx = (L.x * TILE - cam.x) * k, sy = (L.y * TILE - 14 - cam.y) * k, sr = L.r * TILE * k * 0.6;
      if (sx < -sr || sy < -sr || sx > this.canvas.width + sr || sy > this.canvas.height + sr) continue;
      const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      const col = L.lava ? '255,90,30' : L.o === 8 ? '170,100,220' : '255,170,70';
      gr.addColorStop(0, `rgba(${col},${0.22 * dark})`); gr.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ partículas ambientes
  drawAmbient(ctx, cam, t) {
    const g = this.game;
    const def = g.zone.def;
    const dark = this.darkness();
    let kind = null;
    if (def.ash) kind = 'ember';
    else if (g.zone.id === 'forest' && dark > 0.3) kind = 'firefly';
    else if (g.zone.id === 'mines') kind = 'dust';
    else if ((g.zone.id === 'fields' || g.zone.id === 'town') && dark < 0.2) kind = 'leaf';
    if (!kind) { this.ambient.length = 0; return; }
    const want = kind === 'leaf' ? 14 : 40;
    while (this.ambient.length < want) {
      this.ambient.push({ x: cam.x + Math.random() * cam.w, y: cam.y + Math.random() * cam.h, s: Math.random(), ph: Math.random() * 10 });
    }
    ctx.save();
    for (const p of this.ambient) {
      if (kind === 'ember') { p.y -= 0.4 + p.s * 0.5; p.x += Math.sin(t + p.ph) * 0.3; }
      else if (kind === 'firefly') { p.x += Math.sin(t * 0.7 + p.ph) * 0.4; p.y += Math.cos(t * 0.5 + p.ph * 2) * 0.3; }
      else if (kind === 'dust') { p.x += 0.1 * Math.sin(t * 0.3 + p.ph); p.y += 0.05; }
      else { p.x += 0.5 + p.s * 0.4; p.y += 0.3 + Math.sin(t + p.ph) * 0.4; }
      if (p.x < cam.x - 20 || p.x > cam.x + cam.w + 20 || p.y < cam.y - 20 || p.y > cam.y + cam.h + 20) {
        p.x = cam.x + Math.random() * cam.w;
        p.y = kind === 'ember' ? cam.y + cam.h + 10 : kind === 'leaf' ? cam.y - 10 : cam.y + Math.random() * cam.h;
        if (kind === 'leaf') p.x = cam.x - 10 + Math.random() * cam.w * 0.6;
      }
      if (kind === 'ember') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,${120 + p.s * 80},40,${0.5 + Math.sin(t * 3 + p.ph) * 0.3})`; ctx.fillRect(p.x, p.y, 1.6, 1.6); }
      else if (kind === 'firefly') { ctx.globalCompositeOperation = 'lighter'; const a = Math.max(0, Math.sin(t * 2 + p.ph)); circle(ctx, p.x, p.y, 1.6, `rgba(200,255,120,${a * 0.9})`); }
      else if (kind === 'dust') { ctx.fillStyle = 'rgba(220,210,190,0.25)'; ctx.fillRect(p.x, p.y, 1.2, 1.2); }
      else { ctx.fillStyle = p.s > 0.5 ? 'rgba(120,170,60,0.7)' : 'rgba(200,170,60,0.7)'; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 2 + p.ph); ctx.fillRect(-2, -1, 4, 2); ctx.restore(); }
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ helpers de texto
function label(ctx, text, x, y, color, size = 10, bold = false) {
  ctx.save();
  ctx.font = `${bold ? 'bold ' : ''}${size}px "Trebuchet MS", Verdana, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2.5;
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
  ctx.font = '9px "Trebuchet MS", sans-serif';
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if (ctx.measureText(line + ' ' + w).width > 120 && line) { lines.push(line); line = w; } else line = line ? line + ' ' + w : w;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 3);
  const w = Math.max(...shown.map((l) => ctx.measureText(l).width)) + 10;
  const h = shown.length * 11 + 6;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  rr(ctx, x - w / 2, y - h, w, h, 4); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x + 4, y); ctx.fill();
  ctx.fillStyle = '#1b1b1b'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  shown.forEach((l, i) => ctx.fillText(l, x, y - h + 3 + i * 11));
  ctx.restore();
}

export { label, bar, OBJ_INFO };
