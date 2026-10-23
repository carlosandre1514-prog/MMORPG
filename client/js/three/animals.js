// Animais da fazenda: galinha, galo, pato, ganso, porco, ovelha, vaca, touro e cavalo. São montados com formas simples (cores por
// vértice, como o resto do cenário), andam, pastam e bicam dentro do curral e não têm vida nem colisão: são só ambiente.
// Tudo no referencial do animal: frente para +Z, y para cima, origem no chão. Medidas em tiles (o personagem tem 1,45).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lite } from './lite.js';
import { medieval } from './medieval.js';
import { hash2 } from '/shared/rng.js';
import { T } from '/shared/tiles.js';

// ------------------------------------------------------------------ peças com cor por vértice
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function bake(geo, color, pos, rot, scl) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  _m.compose(_v.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scl));
  g.applyMatrix4(_m);
  const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const Z3 = [0, 0, 0], O3 = [1, 1, 1];
const box = (w, h, d, color, pos = Z3, rot = Z3) => bake(new THREE.BoxGeometry(w, h, d), color, pos, rot, O3);
const ball = (r, color, pos = Z3, scl = O3, rot = Z3) => bake(new THREE.IcosahedronGeometry(r, 1), color, pos, rot, scl);
const cone = (r, h, color, pos = Z3, rot = Z3, seg = 6) => bake(new THREE.ConeGeometry(r, h, seg), color, pos, rot, O3);
const cyl = (rt, rb, h, color, pos = Z3, rot = Z3, seg = 6) => bake(new THREE.CylinderGeometry(rt, rb, h, seg), color, pos, rot, O3);

// Cada espécie devolve { body: [geometrias fixas], head, tail, legs, wings?: peças com pivô }, com o pivô em coordenadas do animal
// (peça = { at: [x, y, z], g: [geometrias no referencial do animal] }). A peça gira em torno do pivô.
const part = (at, g) => ({ at, g });

function legPair(color, x, z, hip, w, hoof) {
  // pata: caixa que desce do quadril (pivô em cima)
  const g = [box(w, hip, w, color, [x, hip / 2, z])];
  if (hoof) g.push(box(w * 1.05, hip * 0.16, w * 1.05, hoof, [x, hip * 0.08, z]));
  return part([x, hip, z], g);
}

const SPECIES = {
  cow(v) {
    const hide = v ? 0x7a4a2a : 0xf4f1ea, patch = v ? 0xf1e4cf : 0x23201f, pink = 0xe9a7a0;
    const patches = [[-0.385, 0.95, 0.15, 0.04, 0.3, 0.4], [0.385, 0.8, -0.3, 0.04, 0.32, 0.36], [0, 1.1, -0.1, 0.5, 0.04, 0.36], [-0.385, 0.75, -0.42, 0.04, 0.26, 0.3]]
      .map(([x, y, z, w, h, d]) => box(w, h, d, patch, [x, y, z]));
    return {
      height: 1.3,
      body: [box(0.72, 0.62, 1.3, hide, [0, 0.93, 0]), ...patches, box(0.2, 0.1, 0.24, pink, [0, 0.56, -0.18]),
        cone(0.04, 0.16, 0xf0e6cc, [-0.18, 1.35, 0.78], [0, 0, 0.5]), cone(0.04, 0.16, 0xf0e6cc, [0.18, 1.35, 0.78], [0, 0, -0.5])],
      head: part([0, 1.1, 0.62], [box(0.4, 0.42, 0.5, hide, [0, 0.1, 0.3]), box(0.3, 0.2, 0.2, pink, [0, 0.0, 0.58]), box(0.1, 0.06, 0.12, patch, [-0.1, 0.22, 0.58]),
        box(0.14, 0.08, 0.06, hide, [-0.26, 0.28, 0.2]), box(0.14, 0.08, 0.06, hide, [0.26, 0.28, 0.2]), box(0.06, 0.06, 0.06, 0x1a1412, [-0.14, 0.16, 0.5]), box(0.06, 0.06, 0.06, 0x1a1412, [0.14, 0.16, 0.5])]),
      tail: part([0, 1.18, -0.66], [box(0.05, 0.6, 0.05, hide, [0, -0.3, -0.04]), box(0.09, 0.12, 0.09, patch, [0, -0.62, -0.04])]),
      legs: [[-0.26, 0.5], [0.26, 0.5], [-0.26, -0.5], [0.26, -0.5]].map(([x, z]) => legPair(patch === 0x23201f ? 0xe9e5dc : hide, x, z, 0.62, 0.17, 0x2a2420)),
    };
  },
  bull() {
    const hide = 0x4a2d1c, dark = 0x2c1a10, horn = 0xf1e8d2;
    return {
      height: 1.45,
      body: [box(0.82, 0.7, 1.4, hide, [0, 1.0, 0]), box(0.7, 0.34, 0.5, hide, [0, 1.46, 0.28]), box(0.2, 0.12, 0.24, 0xc9877f, [0, 0.62, -0.2])],
      head: part([0, 1.18, 0.7], [box(0.46, 0.46, 0.52, dark, [0, 0.04, 0.3]), box(0.34, 0.22, 0.2, 0x8a5a4a, [0, -0.08, 0.6]), torus(0xd4b04a, [0, -0.2, 0.68]),
        cone(0.05, 0.3, horn, [-0.3, 0.3, 0.22], [0, 0, 1.0]), cone(0.05, 0.3, horn, [0.3, 0.3, 0.22], [0, 0, -1.0]), box(0.06, 0.06, 0.06, 0xd0402a, [-0.15, 0.14, 0.55]), box(0.06, 0.06, 0.06, 0xd0402a, [0.15, 0.14, 0.55])]),
      tail: part([0, 1.3, -0.7], [box(0.05, 0.62, 0.05, hide, [0, -0.3, -0.04]), box(0.1, 0.14, 0.1, dark, [0, -0.64, -0.04])]),
      legs: [[-0.3, 0.56], [0.3, 0.56], [-0.3, -0.54], [0.3, -0.54]].map(([x, z]) => legPair(dark, x, z, 0.65, 0.2, 0x15100c)),
    };
  },
  horse(v) {
    const coat = [0x8a4b22, 0x3a2a22, 0xc9b79b][v % 3], mane = [0x2a1a10, 0x14100e, 0xe8e0cf][v % 3];
    return {
      height: 1.75,
      body: [box(0.5, 0.62, 1.3, coat, [0, 1.12, 0]), box(0.42, 0.55, 0.45, coat, [0, 1.46, 0.62], [-0.6, 0, 0]), box(0.18, 0.5, 0.1, mane, [0, 1.62, 0.5], [-0.6, 0, 0])],
      head: part([0, 1.78, 0.78], [box(0.26, 0.5, 0.28, coat, [0, -0.1, 0.16], [0.7, 0, 0]), box(0.22, 0.2, 0.2, 0x2a201a, [0, -0.3, 0.34], [0.7, 0, 0]),
        box(0.07, 0.16, 0.05, coat, [-0.1, 0.18, 0.02]), box(0.07, 0.16, 0.05, coat, [0.1, 0.18, 0.02]), box(0.1, 0.34, 0.03, 0xf0ece4, [0, -0.08, 0.26], [0.7, 0, 0])]),
      tail: part([0, 1.34, -0.66], [box(0.1, 0.75, 0.12, mane, [0, -0.36, -0.06], [0.2, 0, 0])]),
      legs: [[-0.18, 0.5], [0.18, 0.5], [-0.18, -0.5], [0.18, -0.5]].map(([x, z]) => legPair(coat, x, z, 0.82, 0.13, 0x1a1410)),
    };
  },
  pig(v) {
    const skin = v ? 0xe9b9a8 : 0xf1a9a6, dark = 0xd98a88;
    return {
      height: 0.65,
      body: [ball(0.5, skin, [0, 0.47, 0], [0.62, 0.55, 1.05]), box(0.1, 0.1, 0.1, dark, [0, 0.5, -0.56]), cone(0.04, 0.1, dark, [0.04, 0.52, -0.64], [1.2, 0, 0.5], 5)],
      head: part([0, 0.58, 0.46], [ball(0.28, skin, [0, 0, 0.14], [0.95, 0.92, 1]), cyl(0.12, 0.13, 0.12, dark, [0, -0.04, 0.38], [Math.PI / 2, 0, 0], 8), box(0.05, 0.05, 0.02, 0x1a1210, [-0.04, -0.04, 0.45]), box(0.05, 0.05, 0.02, 0x1a1210, [0.04, -0.04, 0.45]),
        box(0.14, 0.16, 0.05, dark, [-0.2, 0.2, 0.08], [0.2, 0, 0.5]), box(0.14, 0.16, 0.05, dark, [0.2, 0.2, 0.08], [0.2, 0, -0.5]), box(0.05, 0.05, 0.05, 0x1a1210, [-0.12, 0.08, 0.3]), box(0.05, 0.05, 0.05, 0x1a1210, [0.12, 0.08, 0.3])]),
      tail: part([0, 0.6, -0.56], [cyl(0.015, 0.015, 0.2, dark, [0, 0.06, -0.1], [0.9, 0, 0], 4)]),
      legs: [[-0.18, 0.3], [0.18, 0.3], [-0.18, -0.3], [0.18, -0.3]].map(([x, z]) => legPair(skin, x, z, 0.24, 0.11, dark)),
    };
  },
  sheep(v) {
    const wool = v ? 0xdcd2c0 : 0xf4f0e6, face = 0x3b3330;
    return {
      height: 0.9,
      body: [ball(0.5, wool, [0, 0.66, 0], [0.62, 0.56, 0.9]), ball(0.2, wool, [0, 0.75, 0.38], [1, 0.9, 0.9]), ball(0.13, wool, [0, 0.62, -0.48])],
      head: part([0, 0.8, 0.5], [box(0.2, 0.24, 0.3, face, [0, -0.04, 0.14], [0.2, 0, 0]), box(0.14, 0.06, 0.1, wool, [0, 0.12, 0.08]), box(0.12, 0.05, 0.05, face, [-0.14, 0.04, 0.06], [0, 0, 0.5]), box(0.12, 0.05, 0.05, face, [0.14, 0.04, 0.06], [0, 0, -0.5]),
        box(0.04, 0.04, 0.04, 0xeedd88, [-0.06, 0.04, 0.28]), box(0.04, 0.04, 0.04, 0xeedd88, [0.06, 0.04, 0.28])]),
      tail: part([0, 0.6, -0.5], [ball(0.07, wool, [0, -0.02, -0.04])]),
      legs: [[-0.17, 0.3], [0.17, 0.3], [-0.17, -0.3], [0.17, -0.3]].map(([x, z]) => legPair(face, x, z, 0.34, 0.08, null)),
    };
  },
  chicken(v) {
    const fea = v ? 0xd8b078 : 0xf6f2ea, comb = 0xd8342a;
    return {
      height: 0.5,
      body: [ball(0.2, fea, [0, 0.3, 0], [0.8, 0.85, 1.1]), box(0.04, 0.2, 0.16, fea, [0, 0.46, -0.24], [-0.6, 0, 0]), box(0.03, 0.14, 0.12, fea, [0, 0.52, -0.26], [-0.9, 0, 0])],
      head: part([0, 0.42, 0.16], [ball(0.09, fea, [0, 0.07, 0.04]), cone(0.03, 0.08, 0xf0b030, [0, 0.06, 0.15], [Math.PI / 2, 0, 0], 4), box(0.02, 0.07, 0.07, comb, [0, 0.17, 0.03]), box(0.02, 0.05, 0.02, comb, [0, 0.0, 0.12]),
        box(0.02, 0.02, 0.02, 0x111111, [-0.07, 0.09, 0.08]), box(0.02, 0.02, 0.02, 0x111111, [0.07, 0.09, 0.08])]),
      tail: part([0, 0.3, -0.2], [box(0.02, 0.01, 0.01, fea, Z3)]),
      legs: [[-0.07, 0], [0.07, 0]].map(([x, z]) => legPair(0xe3b23a, x, z, 0.16, 0.03, null)),
      wings: [part([-0.17, 0.32, 0], [box(0.03, 0.14, 0.22, fea, [-0.01, -0.04, 0])]), part([0.17, 0.32, 0], [box(0.03, 0.14, 0.22, fea, [0.01, -0.04, 0])])],
    };
  },
  rooster() {
    const body = 0xa0481f, green = 0x1c5a3e, comb = 0xdc2a22;
    return {
      height: 0.68,
      body: [ball(0.23, body, [0, 0.38, 0], [0.78, 0.9, 1.1]), box(0.05, 0.3, 0.1, green, [0, 0.58, -0.3], [-0.4, 0, 0]), box(0.04, 0.34, 0.08, 0x2a8a52, [-0.04, 0.62, -0.32], [-0.6, 0, -0.15]), box(0.04, 0.34, 0.08, 0xc9792a, [0.04, 0.62, -0.32], [-0.6, 0, 0.15]), box(0.2, 0.1, 0.14, 0xe4a020, [0, 0.46, 0.14])],
      head: part([0, 0.54, 0.2], [ball(0.1, body, [0, 0.08, 0.04]), cone(0.035, 0.09, 0xf0b030, [0, 0.07, 0.17], [Math.PI / 2, 0, 0], 4), box(0.03, 0.12, 0.14, comb, [0, 0.2, 0.03]), box(0.03, 0.08, 0.03, comb, [0, -0.01, 0.14]),
        box(0.02, 0.02, 0.02, 0x111111, [-0.08, 0.1, 0.09]), box(0.02, 0.02, 0.02, 0x111111, [0.08, 0.1, 0.09])]),
      tail: part([0, 0.4, -0.24], [box(0.02, 0.01, 0.01, body, Z3)]),
      legs: [[-0.08, 0], [0.08, 0]].map(([x, z]) => legPair(0xe3b23a, x, z, 0.2, 0.035, null)),
      wings: [part([-0.2, 0.4, 0], [box(0.03, 0.16, 0.26, 0x7a3416, [-0.01, -0.05, 0])]), part([0.2, 0.4, 0], [box(0.03, 0.16, 0.26, 0x7a3416, [0.01, -0.05, 0])])],
    };
  },
  duck(v) {
    const body = v ? 0xf4ecc4 : 0x8a7a63, head = v ? 0xf4ecc4 : 0x1f6b3a;
    return {
      height: 0.4, water: true,
      body: [ball(0.16, body, [0, 0.2, 0], [0.8, 0.7, 1.15]), box(0.1, 0.07, 0.12, 0x4a3f33, [0, 0.3, -0.22], [-0.5, 0, 0]), ...(v ? [] : [box(0.1, 0.03, 0.03, 0xf4f0e6, [0, 0.31, 0.16])])],
      head: part([0, 0.28, 0.14], [ball(0.075, head, [0, 0.08, 0.04]), box(0.07, 0.03, 0.1, 0xf0a024, [0, 0.06, 0.15]), box(0.02, 0.02, 0.02, 0x111111, [-0.06, 0.1, 0.08]), box(0.02, 0.02, 0.02, 0x111111, [0.06, 0.1, 0.08])]),
      tail: part([0, 0.22, -0.18], [box(0.02, 0.01, 0.01, body, Z3)]),
      legs: [[-0.06, 0], [0.06, 0]].map(([x, z]) => legPair(0xf0902a, x, z, 0.1, 0.03, null)),
    };
  },
  goose() {
    const fea = 0xf7f5ef, bill = 0xf08a22;
    return {
      height: 0.72, water: true,
      body: [ball(0.2, fea, [0, 0.34, 0], [0.78, 0.78, 1.2]), box(0.1, 0.08, 0.14, fea, [0, 0.46, -0.27], [-0.5, 0, 0])],
      head: part([0, 0.44, 0.18], [cyl(0.035, 0.05, 0.34, fea, [0, 0.17, 0.03], [0.15, 0, 0]), ball(0.065, fea, [0, 0.35, 0.07]), box(0.06, 0.03, 0.11, bill, [0, 0.33, 0.17]), box(0.02, 0.02, 0.02, 0x111111, [-0.05, 0.37, 0.1]), box(0.02, 0.02, 0.02, 0x111111, [0.05, 0.37, 0.1])]),
      tail: part([0, 0.36, -0.26], [box(0.02, 0.01, 0.01, fea, Z3)]),
      legs: [[-0.07, 0], [0.07, 0]].map(([x, z]) => legPair(bill, x, z, 0.2, 0.035, null)),
      wings: [part([-0.17, 0.4, 0], [box(0.03, 0.15, 0.3, 0xe9e5dc, [-0.01, -0.05, 0])]), part([0.17, 0.4, 0], [box(0.03, 0.15, 0.3, 0xe9e5dc, [0.01, -0.05, 0])])],
    };
  },
};
function torus(color, pos) { return bake(new THREE.TorusGeometry(0.06, 0.012, 4, 8), color, pos, [Math.PI / 2, 0, 0], O3); }

export const ANIMAL_KINDS = Object.keys(SPECIES);
const VARIANTS = { cow: 2, horse: 3, pig: 2, sheep: 2, chicken: 2, duck: 2 };
const SPEED = { cow: 0.55, bull: 0.6, horse: 1.1, pig: 0.7, sheep: 0.6, chicken: 0.8, rooster: 0.8, duck: 0.6, goose: 0.65 };
const WATERFOWL = new Set(['duck', 'goose']);
const GRAZER = new Set(['cow', 'bull', 'horse', 'sheep', 'pig']);
const BIRD = new Set(['chicken', 'rooster', 'duck', 'goose']);

// as geometrias são montadas uma vez por espécie e variante e divididas entre todos os animais
const cache = new Map();
let material = null;
function template(kind, v) {
  const key = kind + ':' + v;
  let t = cache.get(key);
  if (t) return t;
  const s = SPECIES[kind](v);
  const local = (p) => { const g = mergeGeometries(p.g.map((x) => x.clone())); g.translate(-p.at[0], -p.at[1], -p.at[2]); return g; };
  t = { spec: s, body: mergeGeometries(s.body), head: local(s.head), tail: local(s.tail), legs: s.legs.map(local), wings: (s.wings || []).map(local) };
  for (const g of [t.body, t.head, t.tail, ...t.legs, ...t.wings]) medieval.shared.add(g); // não são descartadas com a zona
  cache.set(key, t);
  return t;
}
function mat() {
  if (!material) { material = lite(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true })); material.userData.shared = true; }
  return material;
}

class Animal {
  constructor(kind, seed, pen, env) {
    this.kind = kind;
    this.pen = pen; // retângulo em tiles { x0, z0, x1, z1 }
    this.env = env;
    const v = Math.floor(hash2(seed, 3, 77) * (VARIANTS[kind] || 1));
    const t = template(kind, v);
    this.t = t;
    this.root = new THREE.Group();
    const m = mat();
    const mk = (geo, at) => { const x = new THREE.Mesh(geo, m); if (at) x.position.set(...at); x.castShadow = true; x.receiveShadow = true; this.root.add(x); return x; };
    mk(t.body);
    this.head = mk(t.head, t.spec.head.at);
    this.tail = mk(t.tail, t.spec.tail.at);
    this.legs = t.legs.map((g, i) => mk(g, t.spec.legs[i].at));
    this.wings = t.wings.map((g, i) => mk(g, t.spec.wings[i].at));
    const k = 0.9 + hash2(seed, 5, 78) * 0.2;
    this.root.scale.setScalar(k);
    this.size = k;
    this.speed = SPEED[kind] * (0.85 + hash2(seed, 7, 79) * 0.3);
    this.x = pen.x0 + hash2(seed, 11, 80) * (pen.x1 - pen.x0);
    this.z = pen.z0 + hash2(seed, 13, 81) * (pen.z1 - pen.z0);
    if (!this.ok(this.x, this.z)) { const p = env.anyFree(pen); if (p) { this.x = p[0]; this.z = p[1]; } }
    this.heading = hash2(seed, 17, 82) * Math.PI * 2;
    this.state = 'idle'; this.timer = hash2(seed, 19, 83) * 3; this.sub = 'look';
    this.phase = hash2(seed, 23, 84) * 6.28;
    this.tx = this.x; this.tz = this.z;
    this.headA = 0; this.walkK = 0; this.rng = (a) => hash2(seed, a, 85);
    this.n = 0;
    this.place();
  }

  ok(x, z) { return this.env.canStand(this.kind, x, z, this.pen); }

  place() {
    const wet = this.t.spec.water && this.env.isWater(this.x, this.z);
    this.root.position.set(this.x, wet ? -0.07 : 0, this.z);
    this.root.rotation.y = this.heading;
  }

  think() {
    this.n++;
    const r = this.rng(this.n * 7 + Math.floor(this.x * 3 + this.z * 5));
    const r2 = this.rng(this.n * 13 + 1), r3 = this.rng(this.n * 17 + 2);
    const bird = BIRD.has(this.kind);
    if (r < (bird ? 0.5 : 0.4)) {
      // anda até um ponto do curral, se o caminho estiver livre
      const ang = r2 * Math.PI * 2, dist = (bird ? 1 : 1.5) + r3 * (bird ? 3 : 4.5);
      const tx = this.x + Math.sin(ang) * dist, tz = this.z + Math.cos(ang) * dist;
      let free = this.ok(tx, tz);
      for (let s = 1; free && s <= 6; s++) free = this.ok(this.x + (tx - this.x) * s / 6, this.z + (tz - this.z) * s / 6);
      if (free) { this.state = 'walk'; this.tx = tx; this.tz = tz; this.timer = 12; return; }
    }
    this.state = 'idle';
    this.sub = r < 0.8 ? (GRAZER.has(this.kind) || bird ? 'graze' : 'look') : 'look';
    this.timer = 1.5 + r3 * 4;
  }

  update(dt, t) {
    this.timer -= dt;
    let moving = false;
    if (this.state === 'walk') {
      const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz);
      if (d < 0.15 || this.timer <= 0) this.think();
      else {
        const want = Math.atan2(dx, dz);
        let da = want - this.heading;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        this.heading += Math.max(-3 * dt, Math.min(3 * dt, da));
        if (Math.abs(da) < 0.9) {
          const step = Math.min(d, this.speed * dt);
          const nx = this.x + Math.sin(this.heading) * step, nz = this.z + Math.cos(this.heading) * step;
          if (this.ok(nx, nz)) { this.x = nx; this.z = nz; moving = true; } else { this.state = 'idle'; this.sub = 'look'; this.timer = 1; }
        }
      }
    } else if (this.timer <= 0) this.think();
    // pose
    this.walkK += ((moving ? 1 : 0) - this.walkK) * Math.min(1, dt * 8);
    if (moving) this.phase += dt * this.speed * (BIRD.has(this.kind) ? 9 : 6.5);
    const swing = Math.sin(this.phase);
    const bird = BIRD.has(this.kind);
    this.legs.forEach((l, i) => {
      const ph = bird ? (i ? Math.PI : 0) : [0, Math.PI, Math.PI, 0][i];
      l.rotation.x = Math.sin(this.phase + ph) * (bird ? 0.7 : 0.55) * this.walkK;
    });
    const graze = this.state === 'idle' && this.sub === 'graze';
    let headTarget = graze ? (bird ? 0.55 + Math.max(0, Math.sin(t * 9 + this.x * 7)) * 0.5 : 0.95) : 0;
    if (this.state === 'idle' && this.sub === 'look') headTarget = Math.sin(t * 0.8 + this.x * 3) * 0.12;
    if (bird && moving) headTarget = Math.sin(this.phase * 2) * 0.12;
    this.headA += (headTarget - this.headA) * Math.min(1, dt * (bird && graze ? 14 : 3.5));
    this.head.rotation.x = this.headA;
    this.head.rotation.y = this.state === 'idle' && this.sub === 'look' ? Math.sin(t * 0.5 + this.z * 2) * 0.5 : 0;
    this.tail.rotation.z = Math.sin(t * (GRAZER.has(this.kind) ? 2.2 : 5) + this.x) * (GRAZER.has(this.kind) ? 0.18 : 0.08);
    this.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.1 + (moving ? Math.abs(swing) * 0.12 : 0)); });
    const bob = moving ? Math.abs(Math.sin(this.phase)) * 0.025 : 0;
    this.place();
    this.root.position.y += bob;
  }
}

// Todos os animais de uma zona: um grupo, currais (de `kind: 'pen'` das estruturas do mapa) e a lógica por perto do jogador.
export class Farm {
  constructor(zone) {
    this.group = new THREE.Group();
    this.animals = [];
    const m = zone.map;
    const tile = (x, z) => { const ix = Math.floor(x), iz = Math.floor(z); return ix < 0 || iz < 0 || ix >= m.w || iz >= m.h ? -1 : m.tiles[iz * m.w + ix]; };
    const isWater = (x, z) => { const t = tile(x, z); return t === T.WATER || t === T.DEEP; };
    const env = {
      isWater,
      canStand(kind, x, z, pen) {
        if (x < pen.x0 || x > pen.x1 || z < pen.z0 || z > pen.z1) return false;
        const ix = Math.floor(x), iz = Math.floor(z);
        if (isWater(x, z)) return WATERFOWL.has(kind);
        return !m.block[iz * m.w + ix];
      },
      anyFree(pen) {
        for (let i = 0; i < 40; i++) { const x = pen.x0 + Math.random() * (pen.x1 - pen.x0), z = pen.z0 + Math.random() * (pen.z1 - pen.z0); if (!m.block[Math.floor(z) * m.w + Math.floor(x)] && !isWater(x, z)) return [x, z]; }
        return null;
      },
    };
    let seed = 1;
    for (const st of zone.structures) {
      if (st.kind !== 'pen') continue;
      const pen = { x0: st.x + 1.15, z0: st.y + 1.15, x1: st.x + st.w - 1.15, z1: st.y + st.h - 1.15 };
      for (const [kind, n] of st.animals) for (let i = 0; i < n; i++) {
        if (!SPECIES[kind]) continue;
        const a = new Animal(kind, Math.floor(hash2(st.x, st.y, 90) * 1000) * 100 + seed++, pen, env);
        this.animals.push(a);
        this.group.add(a.root);
      }
    }
  }

  // r: raio (em tiles) em volta do jogador onde os animais existem e se mexem
  update(dt, t, px, pz, r) {
    const r2 = r * r;
    for (const a of this.animals) {
      const near = (a.x - px) ** 2 + (a.z - pz) ** 2 < r2;
      a.root.visible = near;
      if (near) a.update(Math.min(dt, 0.1), t);
    }
  }

  dispose() { /* geometrias e material são compartilhados entre zonas */ }
}
