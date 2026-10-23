// Muralhas, torres e portões (estruturas 'wall', 'tower' e 'gate' do mapa) com as texturas de pedra e de
// telhas do Medieval Village MegaKit. Toda a fortificação vira poucas malhas: pedra, cornijas, telhados e ferro.
import * as THREE from 'three';

export const WALL_H = 4.6;
const TEX = 2; // metros por repetição de textura

// Acumula triângulos com normais e UVs para uma malha
export class Builder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; }
  quad(a, b, c, d, n, uvs) {
    for (const [p, t] of [[a, uvs[0]], [b, uvs[1]], [c, uvs[2]], [a, uvs[0]], [c, uvs[2]], [d, uvs[3]]]) {
      this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.uv.push(t[0], t[1]);
    }
  }
  // caixa sem a face de baixo; UVs em metros / TEX para a textura repetir em escala real
  box(x0, y0, z0, x1, y1, z1) {
    const u = (v) => v / TEX;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[u(x0), u(y0)], [u(x1), u(y0)], [u(x1), u(y1)], [u(x0), u(y1)]]);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[u(x1), u(y0)], [u(x0), u(y0)], [u(x0), u(y1)], [u(x1), u(y1)]]);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[u(z1), u(y0)], [u(z0), u(y0)], [u(z0), u(y1)], [u(z1), u(y1)]]);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[u(z0), u(y0)], [u(z1), u(y0)], [u(z1), u(y1)], [u(z0), u(y1)]]);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [[u(x0), u(z1)], [u(x1), u(z1)], [u(x1), u(z0)], [u(x0), u(z0)]]);
  }
  // cilindro aberto (lateral) com UV contínuo em volta
  cylinder(cx, cz, r, y0, y1, seg = 16) {
    const circ = 2 * Math.PI * r;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p = (a, y) => [cx + Math.sin(a) * r, y, cz + Math.cos(a) * r];
      const n = [Math.sin((a0 + a1) / 2), 0, Math.cos((a0 + a1) / 2)];
      const u0 = (i / seg) * circ / TEX, u1 = ((i + 1) / seg) * circ / TEX;
      this.quad(p(a0, y0), p(a1, y0), p(a1, y1), p(a0, y1), n, [[u0, y0 / TEX], [u1, y0 / TEX], [u1, y1 / TEX], [u0, y1 / TEX]]);
    }
  }
  // tampa circular (topo da torre)
  disc(cx, cz, r, y, seg = 16) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c = [cx, y, cz], p0 = [cx + Math.sin(a0) * r, y, cz + Math.cos(a0) * r], p1 = [cx + Math.sin(a1) * r, y, cz + Math.cos(a1) * r];
      const uv = (p) => [p[0] / TEX, p[2] / TEX];
      this.quad(c, p0, p1, c, [0, 1, 0], [uv(c), uv(p0), uv(p1), uv(c)]);
    }
  }
  // cone de telhado com as fileiras de telhas descendo a encosta
  cone(cx, cz, r, y0, hgt, seg = 16) {
    const slant = Math.hypot(r, hgt);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
      const b0 = [cx + Math.sin(a0) * r, y0, cz + Math.cos(a0) * r], b1 = [cx + Math.sin(a1) * r, y0, cz + Math.cos(a1) * r];
      const tip = [cx, y0 + hgt, cz];
      const n = new THREE.Vector3(Math.sin(am) * hgt, r, Math.cos(am) * hgt).normalize().toArray();
      const w = (2 * Math.PI * r) / seg / TEX;
      this.quad(b0, b1, tip, tip, n, [[0, 0], [w, 0], [w / 2, slant / TEX], [w / 2, slant / TEX]]);
    }
  }
  mesh(mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}

// Pontos para pendurar estandartes nas muralhas: castelo nas duas faces, cidade só na face de dentro.
// Devolve [{ x, z, rot, castle, i }] com x/z na face da muralha e rot virando a frente do estandarte para fora dela.
export function bannerSpots(structs, center) {
  const towers = structs.filter((s) => s.kind === 'tower');
  const nearTower = (x, z) => towers.some((t) => x > t.x - 0.8 && x < t.x + t.w + 0.8 && z > t.y - 0.8 && z < t.y + t.h + 0.8);
  const out = [];
  let i = 0;
  for (const s of structs) {
    if (s.kind !== 'wall') continue;
    const horiz = s.w >= s.h;
    const len = horiz ? s.w : s.h;
    const step = s.castle ? 5 : 11;
    for (let t = step / 2; t < len - 0.5; t += step) {
      for (const side of [1, -1]) {
        if (!s.castle && side !== (horiz ? (center.y > s.y ? 1 : -1) : (center.x > s.x ? 1 : -1))) continue;
        const x = horiz ? s.x + t : side > 0 ? s.x + s.w + 0.03 : s.x - 0.03;
        const z = horiz ? (side > 0 ? s.y + s.h + 0.03 : s.y - 0.03) : s.y + t;
        if (nearTower(x, z)) continue;
        const rot = horiz ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        out.push({ x, z, rot, castle: !!s.castle, i: i++ });
      }
    }
  }
  return out;
}

// mats: { stone, trim, roof, iron } (materiais compartilhados ou simples, se o kit não carregou)
export function buildFortifications(structs0, mats, onFlag) {
  // muralhas compridas viram trechos de até 14 tiles e cada trecho vai para o bloco (20 × 20 tiles) em que está:
  // cada bloco é uma malha com a própria esfera de corte, então só o que está na tela (ou na sombra) é desenhado
  const structs = [];
  for (const s of structs0) {
    if (s.kind !== 'wall' || Math.max(s.w, s.h) <= 14) { structs.push(s); continue; }
    const horiz = s.w >= s.h;
    const len = horiz ? s.w : s.h, n = Math.ceil(len / 14);
    for (let i = 0; i < n; i++) {
      const a = Math.floor((len * i) / n), b = Math.floor((len * (i + 1)) / n);
      structs.push(horiz ? { ...s, x: s.x + a, w: b - a } : { ...s, y: s.y + a, h: b - a });
    }
  }
  let stone, trim, roof, iron;
  const sets = new Map();
  const use = (s) => {
    const k = Math.floor((s.x + s.w / 2) / 20) + ',' + Math.floor((s.y + s.h / 2) / 20);
    let set = sets.get(k);
    if (!set) sets.set(k, (set = [new Builder(), new Builder(), new Builder(), new Builder()]));
    [stone, trim, roof, iron] = set;
  };
  const merlons = (x0, z0, x1, z1, y) => {
    // ameias ao longo das duas bordas do caminho de ronda
    const horiz = x1 - x0 >= z1 - z0;
    const len = horiz ? x1 - x0 : z1 - z0;
    const n = Math.max(1, Math.floor(len / 1.4));
    const step = len / n;
    for (let i = 0; i < n; i++) {
      const a = (horiz ? x0 : z0) + i * step + step * 0.2, b = a + step * 0.55;
      if (horiz) { stone.box(a, y, z0 - 0.05, b, y + 0.75, z0 + 0.22); stone.box(a, y, z1 - 0.22, b, y + 0.75, z1 + 0.05); }
      else { stone.box(x0 - 0.05, y, a, x0 + 0.22, y + 0.75, b); stone.box(x1 - 0.22, y, a, x1 + 0.05, y + 0.75, b); }
    }
  };
  for (const s of structs) {
    use(s);
    if (s.kind === 'wall') {
      const x0 = s.x, z0 = s.y, x1 = s.x + s.w, z1 = s.y + s.h;
      stone.box(x0, 0, z0, x1, WALL_H, z1);
      trim.box(x0 - 0.08, WALL_H - 0.18, z0 - 0.08, x1 + 0.08, WALL_H, z1 + 0.08);
      trim.box(x0 - 0.12, 0, z0 - 0.12, x1 + 0.12, 0.45, z1 + 0.12); // rodapé
      merlons(x0, z0, x1, z1, WALL_H);
    } else if (s.kind === 'tower') {
      const cx = s.x + s.w / 2, cz = s.y + s.h / 2;
      const r = s.w / 2 + 0.2;
      const H = s.castle ? 9.5 : 7.4;
      stone.cylinder(cx, cz, r + 0.25, 0, 1.0);
      trim.cylinder(cx, cz, r + 0.3, 0.95, 1.15);
      stone.cylinder(cx, cz, r, 1.0, H);
      trim.cylinder(cx, cz, r + 0.22, H - 0.05, H + 0.25);
      trim.disc(cx, cz, r + 0.22, H + 0.25);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const mx = cx + Math.sin(a) * (r + 0.05), mz = cz + Math.cos(a) * (r + 0.05);
        stone.box(mx - 0.28, H + 0.25, mz - 0.28, mx + 0.28, H + 1.0, mz + 0.28);
      }
      if (s.castle || s.w >= 3) {
        const rh = s.castle ? 4.2 : 3.2;
        roof.cone(cx, cz, r + 0.55, H + 0.9, rh);
        onFlag?.(cx, H + 0.9 + rh, cz, s.castle);
      }
    } else if (s.kind === 'gate') {
      // passagem coberta: lintel sobre a abertura, ameias e grade levadiça erguida
      const horiz = s.w >= s.h;
      const x0 = s.x - (horiz ? 0 : 0.35), x1 = s.x + s.w + (horiz ? 0 : 0.35);
      const z0 = s.y - (horiz ? 0.35 : 0), z1 = s.y + s.h + (horiz ? 0.35 : 0);
      stone.box(x0, 3.3, z0, x1, WALL_H + 0.4, z1);
      trim.box(x0 - 0.08, 3.15, z0 - 0.08, x1 + 0.08, 3.35, z1 + 0.08);
      trim.box(x0 - 0.1, WALL_H + 0.25, z0 - 0.1, x1 + 0.1, WALL_H + 0.45, z1 + 0.1);
      merlons(x0, z0, x1, z1, WALL_H + 0.45);
      const len = horiz ? s.w : s.h;
      for (let i = 0; i <= Math.round(len / 0.35); i++) {
        const t = (horiz ? s.x : s.y) + (i * len) / Math.round(len / 0.35);
        if (horiz) iron.box(t - 0.03, 2.75, s.y + 0.45, t + 0.03, 3.3, s.y + 0.55);
        else iron.box(s.x + 0.45, 2.75, t - 0.03, s.x + 0.55, 3.3, t + 0.03);
      }
      if (horiz) iron.box(s.x, 2.95, s.y + 0.44, s.x + s.w, 3.02, s.y + 0.56);
      else iron.box(s.x + 0.44, 2.95, s.y, s.x + 0.56, 3.02, s.y + s.h);
    }
  }
  const g = new THREE.Group();
  for (const set of sets.values()) {
    for (const [b, m] of [[set[0], mats.stone], [set[1], mats.trim], [set[2], mats.roof], [set[3], mats.iron]]) if (b.pos.length) g.add(b.mesh(m));
  }
  return g;
}
