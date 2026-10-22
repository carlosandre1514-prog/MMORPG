// Mapa em 3D: uma maquete leve da zona (casas com telhado e porta, muralhas, torres, árvores, rochas, paredes de caverna)
// desenhada com câmera ortográfica inclinada. Serve ao minimapa (gira junto com a câmera do jogo) e à janela de mapa.
// A maquete é uma cena à parte (poucos milhares de triângulos, quase todos em 3 malhas), desenhada em renderizadores
// próprios e copiada para os canvas 2D, onde a interface põe os marcadores (jogador, NPCs, monstros, rota da missão).
import * as THREE from 'three';
import { T, O } from '/shared/tiles.js';
import { houseGeom } from '/shared/housegeom.js';
import { hash2 } from '/shared/rng.js';
import { minimapColor } from '../terrain.js';
import { WALL_H } from './castle3d.js';

const FLOOR_H = 3; // altura de um andar (m), como nas peças do Medieval Village
const col = (hex) => new THREE.Color(hex);

// Sopa de triângulos coloridos (normais planas, uma cor por vértice): tudo vira uma malha só
class Soup {
  constructor() { this.p = []; this.c = []; }

  tri(a, b, c, k) {
    this.p.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) this.c.push(k.r, k.g, k.b);
  }

  quad(a, b, c, d, k) { this.tri(a, b, c, k); this.tri(a, c, d, k); }

  // caixa sem a face de baixo; side e top podem ter cores diferentes
  box(x0, y0, z0, x1, y1, z1, side, top = side) {
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], side);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], side);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], side);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], side);
  }

  // telhado de duas águas com a cumeeira ao longo de X (alongZ: ao longo de Z); o: beiral; frontão com a cor da parede
  gable(x0, z0, x1, z1, y0, rise, o, roof, wall, alongZ = false) {
    // trabalha em (u, v) com a cumeeira ao longo de u; em Z os eixos trocam e a ordem dos vértices inverte
    const P = (u, y, v) => (alongZ ? [v, y, u] : [u, y, v]);
    const tri = (a, b, c, k) => (alongZ ? this.tri(a, c, b, k) : this.tri(a, b, c, k));
    const quad = (a, b, c, d, k) => (alongZ ? this.quad(a, d, c, b, k) : this.quad(a, b, c, d, k));
    const [u0, v0, u1, v1] = alongZ ? [z0, x0, z1, x1] : [x0, z0, x1, z1];
    const vm = (v0 + v1) / 2, yr = y0 + rise;
    const ua = u0 - o, ub = u1 + o, va = v0 - o, vb = v1 + o;
    quad(P(ua, y0, vb), P(ub, y0, vb), P(ub, yr, vm), P(ua, yr, vm), roof);
    quad(P(ub, y0, va), P(ua, y0, va), P(ua, yr, vm), P(ub, yr, vm), roof);
    tri(P(u1, y0, v1), P(u1, y0, v0), P(u1, yr, vm), wall);
    tri(P(u0, y0, v0), P(u0, y0, v1), P(u0, yr, vm), wall);
  }

  // telhado em pirâmide
  pyramid(x0, z0, x1, z1, y0, rise, o, k) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, yr = y0 + rise;
    const a = x0 - o, b = x1 + o, c = z0 - o, d = z1 + o;
    this.tri([a, y0, d], [b, y0, d], [cx, yr, cz], k);
    this.tri([b, y0, c], [a, y0, c], [cx, yr, cz], k);
    this.tri([b, y0, d], [b, y0, c], [cx, yr, cz], k);
    this.tri([a, y0, c], [a, y0, d], [cx, yr, cz], k);
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    return g;
  }
}

const PLASTER = ['#e3d3ab', '#dccaa0', '#e8d9b8', '#d8c398'];
const STONE = ['#9b958a', '#8f897e', '#a39d92'];
const ROOF = ['#b5482c', '#a63f27', '#c2542f', '#9c3b25'];
const STONE_TYPES = new Set(['keep', 'keeptower', 'belltower', 'barracks', 'armory', 'smithy', 'bank', 'guardhouse', 'chapel']);

// Objetos pequenos do mapa como caixas: [largura, altura, profundidade, cor]
const BLOCKS = {
  [O.ROCK]: [0.9, 0.7, 0.9, '#7a766f'], [O.STALAG]: [0.6, 1.4, 0.6, '#6d665f'], [O.PILLAR]: [0.7, 2.6, 0.7, '#a8a39a'],
  [O.BROKENPILLAR]: [0.7, 1.0, 0.7, '#a8a39a'], [O.WELL]: [1.2, 0.9, 1.2, '#8d877d'], [O.FOUNTAIN]: [1.0, 0.8, 1.0, '#7fb6d9'],
  [O.TENT]: [1.7, 1.7, 1.7, '#b5482c'], [O.STALL]: [1.5, 1.4, 1.2, '#c9573a'], [O.GRAVE]: [0.5, 0.7, 0.3, '#8a8f95'],
  [O.ALTAR]: [1.4, 0.9, 0.9, '#b9b2a4'], [O.STATUE]: [0.8, 1.9, 0.8, '#a8a39a'], [O.BARREL]: [0.55, 0.7, 0.55, '#8b5a2b'],
  [O.CRATE]: [0.6, 0.6, 0.6, '#9b6b3a'], [O.HAY]: [1.0, 0.8, 1.0, '#d9b84e'], [O.CART]: [1.1, 0.7, 0.8, '#7b5a35'],
  [O.CRYSTAL]: [0.5, 1.2, 0.5, '#b57edc'], [O.BRAZIER]: [0.5, 0.6, 0.5, '#d9561c'], [O.ORE]: [0.9, 0.7, 0.9, '#6a6a73'],
  [O.RACK]: [1.1, 0.9, 0.3, '#7b5a35'], [O.TABLE]: [1.2, 0.7, 0.8, '#9b6b3a'], [O.KEG]: [0.8, 0.8, 0.8, '#8b5a2b'],
  [O.LUMBER]: [1.1, 0.5, 0.6, '#b98d56'], [O.PLANKS]: [1.1, 0.4, 0.7, '#b98d56'], [O.BRICKS]: [0.9, 0.5, 0.7, '#a85c42'],
  [O.CHEST]: [0.7, 0.5, 0.5, '#8b5a2b'], [O.ANVIL]: [0.6, 0.6, 0.4, '#3a3d44'], [O.TARGET]: [0.9, 1.3, 0.2, '#c9b17a'],
};
const TREES = new Set([O.TREE, O.PINE, O.BIGTREE, O.DEADTREE, O.BUSH]);

// Um renderizador (e canvas) por uso: minimapa e janela do mapa
class Surface {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(1);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
    this.W = 0; this.H = 0;
  }

  resize(W, H) {
    if (W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    this.renderer.setSize(W, H, false);
  }
}

export class MapView3D {
  constructor() {
    this.scene = new THREE.Scene();
    this.hemi = new THREE.HemisphereLight(0xdcecff, 0x7a6a4c, 1.5);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sun.position.set(-0.6, 1.0, 0.5);
    this.scene.add(this.hemi, this.sun);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.surfaces = {};
    this.zone = null;
  }

  surface(name) {
    return (this.surfaces[name] ||= new Surface());
  }

  // Monta a maquete da zona (descarta a anterior)
  setZone(zone) {
    this.clear();
    this.zone = zone;
    const { w, h, tiles, objs, structures } = zone.map;
    this.w = w; this.h = h;
    this.world.add(this.ground(zone));
    const soup = new Soup();
    const doors = [];
    for (const st of structures) {
      if (st.kind === 'house') this.house(soup, st, doors);
      else if (st.kind === 'wall') this.wall(soup, st);
      else if (st.kind === 'tower') this.tower(soup, st);
      else if (st.kind === 'gate') this.gate(soup, st);
    }
    for (const d of doors) soup.box(...d);
    if (soup.p.length) {
      const m = new THREE.Mesh(soup.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
      this.world.add(m);
    }
    this.scatter(tiles, objs, w, h);
  }

  clear() {
    this.world.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
    this.world.clear();
  }

  // chão: uma textura de 4 px por tile com as cores do terreno
  ground(zone) {
    const { w, h, tiles, objs } = zone.map;
    const S = 4;
    const cv = document.createElement('canvas');
    cv.width = w * S; cv.height = h * S;
    const ctx = cv.getContext('2d');
    const c = new THREE.Color();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const t = tiles[i], o = objs[i];
        c.set(minimapColor(t, 0)); // árvores, casas e rochas viram malhas por cima
        const v = 0.93 + hash2(x, y, 3) * 0.14;
        ctx.fillStyle = `rgb(${Math.min(255, c.r * 255 * v) | 0},${Math.min(255, c.g * 255 * v) | 0},${Math.min(255, c.b * 255 * v) | 0})`;
        ctx.fillRect(x * S, y * S, S, S);
        if (t === T.COBBLE || t === T.STONE) { ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(x * S, y * S, S, 1); ctx.fillRect(x * S + ((y + x) % 2) * 2, y * S, 1, S); }
        if (t === T.WATER || t === T.DEEP) { ctx.fillStyle = 'rgba(255,255,255,0.10)'; if (hash2(x, y, 5) < 0.3) ctx.fillRect(x * S + 1, y * S + 1, 2, 1); }
        if (o === O.FLOWERS) { ctx.fillStyle = hash2(x, y, 7) < 0.5 ? '#f4d03f' : '#e57fb0'; ctx.fillRect(x * S + 1, y * S + 1, 2, 2); }
        else if (o === O.LAMP || o === O.TORCH || o === O.LANTERN) { ctx.fillStyle = '#ffe28a'; ctx.fillRect(x * S + 1, y * S + 1, 2, 2); }
        else if (o === O.FENCE) { ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x * S, y * S + 1, S, 2); }
        else if (o === O.RUBBLE) { ctx.fillStyle = '#8b857c'; ctx.fillRect(x * S + 1, y * S + 2, 2, 1); }
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.magFilter = THREE.LinearFilter;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
    m.position.set(w / 2, 0, h / 2);
    return m;
  }

  house(soup, st, doors) {
    const k = st.seed || 1;
    const type = st.type || 'house';
    const stone = STONE_TYPES.has(type) || (type === 'house' && hash2(st.x, st.y, 17) < 0.45);
    const pal = stone ? STONE : PLASTER;
    const wall = col(pal[k % pal.length]);
    const floors = Math.max(1, st.floors || 1);
    const tall = /tower/.test(type);
    const hgt = floors * FLOOR_H;
    const x0 = st.x + 0.02, z0 = st.y + 0.02, x1 = st.x + st.w - 0.02, z1 = st.y + st.h - 0.02;
    const trim = wall.clone().multiplyScalar(0.8);
    soup.box(x0, 0, z0, x1, hgt, z1, wall, trim);
    // beiral abaixo do telhado
    const roof = col(type === 'keep' || tall ? '#35557f' : type === 'chapel' ? '#56677a' : ROOF[(k * 7) % ROOF.length]);
    if (tall) { soup.pyramid(x0, z0, x1, z1, hgt, Math.min(st.w, st.h) * 1.3, 0.3, roof); return this.door(st, doors, hgt); }
    const along = st.w >= st.h; // cumeeira ao longo do lado maior
    const rise = Math.min(st.w, st.h) * 0.42 + 0.4;
    soup.gable(x0, z0, x1, z1, hgt, rise, 0.3, roof, wall.clone().multiplyScalar(0.92), !along);
    // chaminé
    if (!stone || type === 'smithy') soup.box(x0 + 0.7, hgt, z0 + 0.7, x0 + 1.25, hgt + rise + 0.5, z0 + 1.25, col('#6d655c'));
    this.door(st, doors, hgt);
  }

  // porta escura no centro do vão, na face da casa, para dar para achar por onde entrar
  door(st, doors) {
    const g = houseGeom(st);
    if (!g) return;
    const [ix, iy] = g.inward;
    const wide = ix === 0; // fachada ao longo de X
    const hw = 0.65, t = 0.14, d = col('#3b2a1a');
    // face externa da casa no lado da porta
    const edge = wide ? (iy > 0 ? st.y : st.y + st.h) : (ix > 0 ? st.x : st.x + st.w);
    const out = wide ? -iy : -ix; // sentido para fora
    const e = edge + out * 0.05;
    const [dx, dz] = g.door;
    doors.push(wide ? [dx - hw, 0, e - t, dx + hw, 2.2, e + t, d, d] : [e - t, 0, dz - hw, e + t, 2.2, dz + hw, d, d]);
  }

  wall(soup, st) {
    const stone = col(st.castle ? '#aeb4bd' : '#a39d92');
    const top = stone.clone().multiplyScalar(1.12);
    soup.box(st.x, 0, st.y, st.x + st.w, WALL_H, st.y + st.h, stone, top);
    // ameias
    const long = st.w >= st.h;
    const n = Math.floor((long ? st.w : st.h) / 1.4);
    for (let i = 0; i < n; i++) {
      const a = 0.35 + i * 1.4;
      if (long) soup.box(st.x + a, WALL_H, st.y, st.x + a + 0.6, WALL_H + 0.35, st.y + st.h, top);
      else soup.box(st.x, WALL_H, st.y + a, st.x + st.w, WALL_H + 0.35, st.y + a + 0.6, top);
    }
  }

  tower(soup, st) {
    const stone = col(st.castle ? '#b9bfc8' : '#a8a196');
    const h = WALL_H + 2.2;
    soup.box(st.x, 0, st.y, st.x + st.w, h, st.y + st.h, stone, stone.clone().multiplyScalar(1.1));
    soup.pyramid(st.x, st.y, st.x + st.w, st.y + st.h, h, 2.6, 0.25, col(st.castle ? '#35557f' : '#a63f27'));
  }

  // portão: duas torrinhas e uma verga sobre a passagem
  gate(soup, st) {
    const stone = col('#aaa59a');
    const wide = st.w >= st.h;
    if (wide) { soup.box(st.x, 0, st.y, st.x + 0.5, WALL_H, st.y + st.h, stone); soup.box(st.x + st.w - 0.5, 0, st.y, st.x + st.w, WALL_H, st.y + st.h, stone); soup.box(st.x, 3.2, st.y, st.x + st.w, WALL_H, st.y + st.h, stone); }
    else { soup.box(st.x, 0, st.y, st.x + st.w, WALL_H, st.y + 0.5, stone); soup.box(st.x, 0, st.y + st.h - 0.5, st.x + st.w, WALL_H, st.y + st.h, stone); soup.box(st.x, 3.2, st.y, st.x + st.w, WALL_H, st.y + st.h, stone); }
  }

  // árvores, rochas, barracas e paredes de caverna: malhas instanciadas
  scatter(tiles, objs, w, h) {
    const trees = [], blocks = [];
    const wallTile = (x, y) => x >= 0 && y >= 0 && x < w && y < h && tiles[y * w + x] === T.CAVEWALL;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, o = objs[i], t = tiles[i];
        if (TREES.has(o)) trees.push([x + 0.5, y + 0.5, o, hash2(x, y, 11)]);
        else if (BLOCKS[o]) blocks.push([x + 0.5, y + 0.5, ...BLOCKS[o], 0]);
        else if (t === T.CAVEWALL) {
          let open = false;
          for (let dy = -1; dy <= 1 && !open; dy++) for (let dx = -1; dx <= 1; dx++) if (!wallTile(x + dx, y + dy) && (x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h)) { open = true; break; }
          if (open) { const v = 0.8 + hash2(x, y, 13) * 0.35; blocks.push([x + 0.5, y + 0.5, 1.02, 1.0 + hash2(x, y, 19) * 1.3, 1.02, new THREE.Color(0x8a7d70).multiplyScalar(v).getHexString(), 1]); }
        }
      }
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
    if (trees.length) {
      const leaves = new THREE.InstancedMesh(new THREE.ConeGeometry(0.62, 1.9, 6).translate(0, 1.55, 0), new THREE.MeshLambertMaterial(), trees.length);
      const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 5).translate(0, 0.35, 0), new THREE.MeshLambertMaterial({ color: 0x5a3d22 }), trees.length);
      trees.forEach(([x, z, o, r], i) => {
        const big = o === O.BIGTREE ? 1.5 : o === O.BUSH ? 0.45 : o === O.DEADTREE ? 0.9 : 1 + r * 0.25;
        const s = o === O.BUSH ? 0.6 : big;
        sc.set(s, o === O.BUSH ? 0.5 : s, s);
        m4.compose(pos.set(x, 0, z), q.identity(), sc);
        leaves.setMatrixAt(i, m4);
        trunks.setMatrixAt(i, o === O.BUSH ? m4.makeScale(0, 0, 0) : m4);
        const base = o === O.PINE ? 0x1f5a35 : o === O.DEADTREE ? 0x6b5a48 : o === O.BUSH ? 0x3f7d32 : 0x2f7a2f;
        leaves.setColorAt(i, c.set(base).multiplyScalar(0.85 + r * 0.3));
      });
      this.world.add(leaves, trunks);
    }
    if (blocks.length) {
      const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial(), blocks.length);
      blocks.forEach(([x, z, sx, sy, sz, color], i) => {
        m4.compose(pos.set(x, 0, z), q.identity(), sc.set(sx, sy, sz));
        boxes.setMatrixAt(i, m4);
        boxes.setColorAt(i, c.set(typeof color === 'string' && color[0] !== '#' && color.length === 6 ? '#' + color : color));
      });
      this.world.add(boxes);
    }
  }

  // Luz e fundo conforme a hora (darkness de 0 a 1)
  light(dark) {
    this.hemi.intensity = 1.5 - dark * 0.9;
    this.sun.intensity = 2.2 - dark * 1.6;
    this.hemi.color.set(0xdcecff).lerp(new THREE.Color(0x6a7ab8), dark);
    this.sun.color.set(0xfff1d6).lerp(new THREE.Color(0x8fa6ff), dark);
  }

  // Desenha a maquete em `ctx` (canvas 2D de W × H px) com a câmera dada. Devolve a função que projeta (x, y, altura) do
  // mapa em pixels, usada pelos marcadores.
  draw(name, ctx, W, H, cam) {
    const s = this.surface(name);
    s.resize(W, H);
    const { cx, cz, yaw = 0, pitch = 0.95, span, dark = 0 } = cam;
    const c = s.camera;
    const hw = span / 2, hh = hw * H / W;
    c.left = -hw; c.right = hw; c.top = hh; c.bottom = -hh;
    c.updateProjectionMatrix();
    const d = 150;
    c.position.set(cx + Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, cz + Math.cos(yaw) * Math.cos(pitch) * d);
    c.lookAt(cx, 0, cz);
    c.updateMatrixWorld();
    this.light(dark);
    s.renderer.setClearColor(dark > 0.5 ? 0x070a12 : 0x101722, 1);
    s.renderer.render(this.scene, c);
    ctx.drawImage(s.renderer.domElement, 0, 0, W, H);
    const v = new THREE.Vector3();
    return (x, y, hgt = 0) => {
      v.set(x, hgt, y).project(c);
      return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H];
    };
  }
}
