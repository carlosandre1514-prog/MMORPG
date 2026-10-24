// Aba "Mundo" do Mapa: todas as regiões de Aethra juntas, cada uma na sua posição (zone.world), com neblina nas que o
// personagem ainda não conhece. Mostra os portões (altares), o jogador, o grupo e o destino da missão com o caminho até lá,
// para ficar claro para que lado ir. Clicar numa região mostra os detalhes, a direção e a rota a partir de onde o jogador está.
import { ZONES, ZONE_ORDER, portalSealed } from '/shared/data/zones.js';
import { KINGDOMS } from '/shared/data/kingdoms.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { generateMap } from '/shared/mapgen.js';
import { altarsIn } from '/shared/altars.js';
import { minimapColor } from '../terrain.js';
import { nextZone } from '../navigation.js';
import { h } from './dom.js';
import { ico, drawIcon } from './icons.js';

const PAD = 22; // margem do mapa em px (o tamanho do canvas vem da janela: this.wmW × this.wmH)

// ---------------------------------------------------------------- miniaturas (1 px por tile, geradas aos poucos)
const thumbs = new Map();
const rgbCache = new Map();
function rgb(hex) {
  let c = rgbCache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = hex.length === 7 ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [80, 80, 80];
    rgbCache.set(hex, c);
  }
  return c;
}

function buildThumb(id) {
  const z = ZONES[id];
  const m = generateMap(z);
  const cv = document.createElement('canvas');
  cv.width = z.w; cv.height = z.h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(z.w, z.h);
  for (let i = 0; i < z.w * z.h; i++) {
    const [r, g, b] = rgb(minimapColor(m.tiles[i], m.objs[i]));
    img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// 8 direções em português a partir de um vetor (norte em cima)
function compass(dx, dy) {
  const names = ['leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste', 'norte', 'nordeste'];
  const a = Math.atan2(dy, dx); // 0 = leste, cresce para o sul
  return names[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

const centerOf = (z) => ({ x: z.world.x + z.w / 2, y: z.world.y + z.h / 2 });
const portalPos = (z, p) => ({ x: z.world.x + p.x + p.w / 2, y: z.world.y + p.y + p.h / 2 });

export const worldMapMixin = {
  // zonas que o personagem já pisou, e as vizinhas (avistadas: aparecem esmaecidas)
  worldReveal() {
    const visited = new Set(this.game.me.visited || []);
    const near = new Set();
    for (const id of visited) for (const p of ZONES[id].portals) if (!visited.has(p.to)) near.add(p.to);
    for (const z of Object.values(ZONES)) if (!visited.has(z.id) && z.portals.some((p) => visited.has(p.to))) near.add(z.id);
    return { visited, near };
  },

  worldBounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ZONE_ORDER) {
      const z = ZONES[id];
      x0 = Math.min(x0, z.world.x); y0 = Math.min(y0, z.world.y);
      x1 = Math.max(x1, z.world.x + z.w); y1 = Math.max(y1, z.world.y + z.h);
    }
    return { x0, y0, x1, y1 };
  },

  worldFit() {
    const b = this.worldBounds();
    const scale = Math.min((this.wmW - PAD * 2) / (b.x1 - b.x0), (this.wmH - PAD * 2) / (b.y1 - b.y0));
    return { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, zoom: 1, base: scale };
  },

  renderMapWorld(body) {
    const g = this.game;
    // o mapa se adapta à janela do navegador (celulares na horizontal têm pouca altura)
    this.wmW = Math.max(280, Math.min(500, window.innerWidth - 60));
    this.wmH = Math.max(250, Math.min(560, window.innerHeight - 190));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = h('canvas', { width: Math.round(this.wmW * dpr), height: Math.round(this.wmH * dpr), class: 'map-cv', style: { width: this.wmW + 'px', height: this.wmH + 'px', cursor: 'grab', maxWidth: '100%' } });
    this.mapCv = cv; this.mapDpr = dpr;
    this.wmCam = this.worldFit();
    this.wmSel = g.zone.id;
    const cam = this.wmCam;
    const view = () => cam.base * cam.zoom;
    const clampCam = () => {
      const b = this.worldBounds(), sc = view();
      const hw = this.wmW / 2 / sc, hh = this.wmH / 2 / sc;
      cam.cx = Math.max(b.x0 + Math.min(hw, (b.x1 - b.x0) / 2), Math.min(b.x1 - Math.min(hw, (b.x1 - b.x0) / 2), cam.cx));
      cam.cy = Math.max(b.y0 + Math.min(hh, (b.y1 - b.y0) / 2), Math.min(b.y1 - Math.min(hh, (b.y1 - b.y0) / 2), cam.cy));
    };
    let drag = null;
    const local = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (this.wmW / r.width), (e.clientY - r.top) * (this.wmH / r.height)]; };
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: cam.cx, cy: cam.cy, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch { /* ponteiro sintético */ } });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; cv.style.cursor = 'grabbing'; }
      if (!drag.moved) return;
      cam.cx = drag.cx - dx / view(); cam.cy = drag.cy - dy / view();
      clampCam(); this.drawGlobalMap();
    });
    const end = (e) => {
      if (drag && !drag.moved && e.type === 'pointerup') {
        const [mx, my] = local(e);
        const wx = cam.cx + (mx - this.wmW / 2) / view(), wy = cam.cy + (my - this.wmH / 2) / view();
        const hit = ZONE_ORDER.find((id) => { const z = ZONES[id]; return wx >= z.world.x && wx < z.world.x + z.w && wy >= z.world.y && wy < z.world.y + z.h; });
        if (hit) this.mapSelect(hit);
      }
      drag = null; cv.style.cursor = 'grab';
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [mx, my] = local(e);
      const wx = cam.cx + (mx - this.wmW / 2) / view(), wy = cam.cy + (my - this.wmH / 2) / view();
      cam.zoom = Math.max(1, Math.min(4, cam.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
      cam.cx = wx - (mx - this.wmW / 2) / view(); cam.cy = wy - (my - this.wmH / 2) / view();
      clampCam(); this.drawGlobalMap();
    }, { passive: false });
    cv.addEventListener('dblclick', () => { Object.assign(cam, this.worldFit()); this.drawGlobalMap(); });

    const wrap = h('div', { class: 'map-wrap' }, cv);
    this.wmSide = h('div', { class: 'map-side' });
    wrap.appendChild(this.wmSide);
    this.mapSelect = (id) => { this.wmSel = id; this.renderWorldSide(); this.drawGlobalMap(); };
    body.appendChild(wrap);
    this.renderWorldSide();
    this.queueThumbs();
    this.drawGlobalMap();
  },

  // gera as miniaturas das regiões reveladas, uma por vez, sem travar o jogo
  queueThumbs() {
    if (this.wmQueueing) return;
    const { visited, near } = this.worldReveal();
    const todo = ZONE_ORDER.filter((id) => (visited.has(id) || near.has(id)) && !thumbs.has(id));
    if (!todo.length) return;
    this.wmQueueing = true;
    const step = () => {
      const id = todo.shift();
      if (id && !thumbs.has(id)) { try { thumbs.set(id, buildThumb(id)); } catch (e) { console.warn('[mapa] miniatura', id, e); thumbs.set(id, null); } }
      if (this.wins.map?.isOpen && this.mapTab === 'world') this.drawGlobalMap();
      if (todo.length) setTimeout(step, 12); else this.wmQueueing = false;
    };
    setTimeout(step, 0);
  },

  // cartão da região selecionada + a lista de reinos/viagem rápida
  renderWorldSide() {
    const g = this.game, side = this.wmSide;
    if (!side) return;
    const id = this.wmSel || g.zone.id;
    const zd = ZONES[id];
    const { visited, near } = this.worldReveal();
    const state = visited.has(id) ? 'visited' : near.has(id) ? 'near' : 'hidden';
    const here = g.zone.id;
    let card;
    if (state === 'hidden') {
      card = h('div', { class: 'wm-card' }, h('b', {}, '??? região desconhecida'),
        h('div', { class: 'small muted' }, 'Ainda não foi avistada. Explore as regiões vizinhas para revelá-la.'));
    } else {
      const bosses = [...new Set((zd.spawns || []).map((s) => MONSTERS[s.m]).filter((m) => m && m.boss).map((m) => m.name))];
      const found = altarsIn(id).filter((a) => !a.pvp && (g.me.altars || []).includes(a.id)).length;
      const total = altarsIn(id).filter((a) => !a.pvp).length;
      const rows = [h('div', { class: 'wm-name' }, zd.name), h('div', { class: 'small' }, `${zd.levels} · ${KINGDOMS[zd.kingdom]?.name || ''}`)];
      if (zd.desc) rows.push(h('div', { class: 'small muted', style: { margin: '4px 0' } }, zd.desc));
      rows.push(h('div', { class: 'small' }, state === 'visited' ? 'Explorada' : 'Avistada, ainda não explorada', total && state === 'visited' ? ` · altares ${found}/${total}` : ''));
      if (state === 'visited' && bosses.length) rows.push(h('div', { class: 'small' }, ico('skull', 'sm'), ' ', bosses.join(', ')));
      if (id !== here) {
        const a = centerOf(ZONES[here]), b = centerOf(zd);
        rows.push(h('div', { class: 'small wm-dir' }, ico('pin', 'sm'), ` A ${compass(b.x - a.x, b.y - a.y)} de ${ZONES[here].name}.`));
        const chain = [ZONES[here].name];
        let cur = here, guard = 0;
        while (cur !== id && guard++ < 14) { cur = nextZone(cur, id); if (!cur) break; chain.push(ZONES[cur].name); }
        if (cur === id) rows.push(h('div', { class: 'small muted' }, 'Rota: ' + chain.join(' → ')));
      } else rows.push(h('div', { class: 'small wm-dir' }, 'Você está aqui.'));
      const d = g.guide?.active ? g.guide.dest : null;
      if (d && d.zone === id) rows.push(h('div', { class: 'small', style: { color: '#ffd34d' } }, ico('target', 'sm'), ` Destino da missão: ${d.label}`));
      card = h('div', { class: 'wm-card' }, ...rows);
    }
    const fresh = this.mapSide(id, 'Arraste para mover · roda para aproximar · clique numa região · duplo clique para ver tudo.', card);
    side.replaceChildren(...fresh.childNodes);
  },

  drawGlobalMap() {
    const g = this.game, cv = this.mapCv;
    if (!cv || !cv.isConnected || !this.wmCam) return;
    const ctx = cv.getContext('2d');
    const dpr = this.mapDpr, cam = this.wmCam, sc = cam.base * cam.zoom;
    const S = (wx, wy) => [(wx - cam.cx) * sc + this.wmW / 2, (wy - cam.cy) * sc + this.wmH / 2];
    const { visited, near } = this.worldReveal();
    const now = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0f17'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // fundo: grade leve, como numa carta de navegação
    ctx.strokeStyle = 'rgba(120,150,190,0.07)'; ctx.lineWidth = 1;
    const step = 50 * sc;
    for (let x = ((this.wmW / 2 - cam.cx * sc) % step + step) % step; x < this.wmW; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.wmH); ctx.stroke(); }
    for (let y = ((this.wmH / 2 - cam.cy * sc) % step + step) % step; y < this.wmH; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.wmW, y); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';

    // estradas entre regiões que não se tocam (a ligação sai de um portão e chega ao outro)
    const drawn = new Set();
    ctx.lineWidth = 2;
    for (const id of ZONE_ORDER) {
      const z = ZONES[id];
      z.portals.forEach((p) => {
        const to = ZONES[p.to];
        const key = [id, p.to].sort().join('>');
        if (drawn.has(key)) return;
        drawn.add(key);
        if (!(visited.has(id) || visited.has(p.to))) return;
        const back = to.portals.find((q) => q.to === id);
        if (!back) return;
        const A = portalPos(z, p), B = portalPos(to, back);
        if (Math.hypot(A.x - B.x, A.y - B.y) < 4) return;
        const [ax, ay] = S(A.x, A.y), [bx, by] = S(B.x, B.y);
        ctx.strokeStyle = portalSealed(g.me, p) || portalSealed(g.me, back) ? 'rgba(170,110,230,0.7)' : 'rgba(150,170,200,0.6)';
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // regiões
    for (const id of ZONE_ORDER) {
      const z = ZONES[id];
      const state = visited.has(id) ? 'visited' : near.has(id) ? 'near' : 'hidden';
      const [x, y] = S(z.world.x, z.world.y);
      const w = z.w * sc, hh = z.h * sc;
      const th = thumbs.get(id);
      ctx.save();
      if (state === 'visited' && th) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(th, x, y, w, hh); }
      else if (state === 'near') {
        ctx.fillStyle = '#121a26'; ctx.fillRect(x, y, w, hh);
        if (th) { ctx.globalAlpha = 0.28; ctx.drawImage(th, x, y, w, hh); ctx.globalAlpha = 1; }
      } else { ctx.fillStyle = state === 'hidden' ? '#0e131b' : '#121a26'; ctx.fillRect(x, y, w, hh); }
      ctx.restore();
      const cur = id === g.zone.id, sel = id === this.wmSel;
      ctx.lineWidth = cur ? 2.5 : 1.2;
      ctx.strokeStyle = cur ? '#ffd27a' : state === 'visited' ? 'rgba(201,162,74,0.7)' : 'rgba(80,100,125,0.7)';
      if (state !== 'visited') ctx.setLineDash([4, 3]);
      ctx.strokeRect(x, y, w, hh);
      ctx.setLineDash([]);
      if (sel && !cur) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]); ctx.strokeRect(x - 2, y - 2, w + 4, hh + 4); ctx.setLineDash([]); }
      // nome e nível (as regiões desconhecidas só mostram "?")
      const cx = x + w / 2;
      if (state === 'hidden') {
        ctx.font = `bold ${Math.max(14, Math.min(28, w * 0.28))}px Georgia, serif`;
        ctx.fillStyle = 'rgba(150,170,195,0.55)'; ctx.fillText('?', cx, y + hh / 2 + 8);
        continue;
      }
      let fs = Math.max(8, Math.min(13, w * 0.115));
      ctx.font = `bold ${fs}px Georgia, serif`;
      while (ctx.measureText(z.name).width > w - 6 && fs > 6.5) { fs -= 0.5; ctx.font = `bold ${fs}px Georgia, serif`; }
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,16,0.95)';
      ctx.fillStyle = state === 'visited' ? '#fdf2e9' : '#9db1c6';
      ctx.strokeText(z.name, cx, y + fs + 3); ctx.fillText(z.name, cx, y + fs + 3);
      ctx.font = `${Math.max(7, fs - 2)}px sans-serif`;
      const sub = z.lvl ? `Nv ${z.lvl[0]}–${z.lvl[1]}` : z.safe ? 'Zona segura' : z.pvp ? 'JxJ' : '';
      if (sub) { ctx.fillStyle = z.pvp ? '#ff8a7a' : '#c9d6e4'; ctx.strokeText(sub, cx, y + fs * 2 + 3); ctx.fillText(sub, cx, y + fs * 2 + 3); }
    }

    // portões (altares): acesos se já descobertos
    for (const id of ZONE_ORDER) {
      if (!visited.has(id)) continue;
      const z = ZONES[id];
      z.portals.forEach((p, pi) => {
        const P = portalPos(z, p);
        const [x, y] = S(P.x, P.y);
        const lit = (g.me.altars || []).includes(`${id}:${pi}`);
        const sealed = portalSealed(g.me, p);
        const r = Math.max(3.5, Math.min(6, sc * 6));
        ctx.fillStyle = sealed ? '#a56bd8' : lit ? '#5dade2' : '#8a93a0';
        ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.75, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.75, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      });
    }

    // rota da missão: do jogador até o destino, passando pelos portões
    const gd = g.guide;
    const dest = gd && gd.active ? gd.dest : null;
    const me = g.me;
    const here = ZONES[g.zone.id];
    const mePos = S(here.world.x + me.x, here.world.y + me.y);
    if (dest && ZONES[dest.zone]) {
      const pts = [mePos];
      let cur = g.zone.id, guard = 0;
      while (cur !== dest.zone && guard++ < 14) {
        const nz = nextZone(cur, dest.zone);
        if (!nz) break;
        const p = ZONES[cur].portals.find((q) => q.to === nz);
        const back = ZONES[nz].portals.find((q) => q.to === cur);
        if (!p) break;
        const A = portalPos(ZONES[cur], p);
        pts.push(S(A.x, A.y));
        if (back) { const B = portalPos(ZONES[nz], back); pts.push(S(B.x, B.y)); }
        cur = nz;
      }
      const dz = ZONES[dest.zone];
      pts.push(S(dz.world.x + dest.x, dz.world.y + dest.y));
      ctx.save();
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2.5; ctx.setLineDash([2, 5]); ctx.lineCap = 'round';
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
      ctx.restore();
      const [dx, dy] = pts[pts.length - 1];
      const pulse = 6 + Math.sin(now / 220) * 1.8;
      ctx.fillStyle = 'rgba(255,211,77,0.3)'; ctx.beginPath(); ctx.arc(dx, dy, pulse + 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(dx, dy, pulse - 1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.font = 'bold 10px sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,16,0.95)'; ctx.fillStyle = '#ffe9a0';
      const ty = dy < 24 ? dy + 20 : dy - 12;
      ctx.strokeText(dest.label, dx, ty); ctx.fillText(dest.label, dx, ty);
    }

    // grupo e jogador
    if (g.party) for (const m of g.party.m) {
      if (m.id === me.id || !ZONES[m.z]) continue;
      const [x, y] = S(ZONES[m.z].world.x + m.x, ZONES[m.z].world.y + m.y);
      ctx.fillStyle = '#2ecc71'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.save();
    ctx.translate(mePos[0], mePos[1]); ctx.rotate(Math.PI - (me.facing || 0));
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();

    // rosa dos ventos
    ctx.font = 'bold 12px Georgia, serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,10,16,0.95)'; ctx.fillStyle = '#e8d9b0';
    ctx.strokeText('N', this.wmW - 22, 22); ctx.fillText('N', this.wmW - 22, 22);
    ctx.strokeStyle = '#e8d9b0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(this.wmW - 22, 28); ctx.lineTo(this.wmW - 22, 48); ctx.moveTo(this.wmW - 32, 38); ctx.lineTo(this.wmW - 12, 38); ctx.stroke();
    void drawIcon;
  },
};
