// Criaturas e props 3D low-poly construídos com primitivas e animados proceduralmente.
// Convenção: frente do modelo voltada para +Z, pés em y = 0, 1 unidade = 1 tile.
import * as THREE from 'three';

function M(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
    transparent: o.opacity != null, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide,
  });
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function pivot(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

class Creature {
  constructor(size = 1) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.root.scale.setScalar(size);
    this.mats = [];
    this.legs = [];
    this.anim = null;
    this.float = 0;
  }

  m(color, o) { const x = M(color, o); this.mats.push(x); return x; }

  update(dt, st) {
    const now = st.now, t = now / 1000;
    const ph = st.phase || 0;
    for (let i = 0; i < this.legs.length; i++) {
      const L = this.legs[i];
      L.rotation.x = st.moving ? Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6 : 0;
    }
    this.body.position.y = this.float ? this.float + Math.sin(t * 2.4) * 0.08 : (st.moving ? Math.abs(Math.sin(ph)) * 0.04 : 0);
    const atk = st.atkStart ? (now - st.atkStart) / 350 : 2;
    this.body.position.z = atk < 1 ? Math.sin(atk * Math.PI) * 0.22 : 0;
    if (this.anim) this.anim(dt, st, t);
    // morte: tomba, afunda e some
    if (st.dead) {
      const d = Math.min(1, (now - (st.deathStart || now)) / 700);
      this.root.rotation.z = d * 1.3;
      this.body.position.y -= d * 0.15;
      this.setOpacity(Math.max(0, 1 - (now - (st.deathStart || now)) / 1500));
    } else if (this.root.rotation.z) {
      this.root.rotation.z = 0;
      this.setOpacity(1);
    }
    const flash = st.hurt ? Math.max(0, 1 - (now - st.hurt) / 200) : 0;
    if (flash > 0 || this.flashing) {
      for (const m of this.mats) {
        if (!m.userData.baseE) m.userData.baseE = m.emissive.clone();
        m.emissive.copy(m.userData.baseE).add(new THREE.Color(flash * 0.7, flash * 0.15, flash * 0.1));
      }
      this.flashing = flash > 0;
    }
  }

  setOpacity(a) {
    for (const m of this.mats) {
      if (m.userData.baseOpacity == null) m.userData.baseOpacity = m.opacity;
      m.transparent = a < 1 || m.userData.baseOpacity < 1;
      m.opacity = m.userData.baseOpacity * a;
    }
  }

  dispose() {
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of this.mats) m.dispose();
  }
}

// ------------------------------------------------------------------ construtores
const B = {
  slime(c, def) {
    const cr = new Creature(def.size);
    const mat = cr.m(c, { opacity: 0.82, rough: 0.3 });
    const blob = mesh(new THREE.SphereGeometry(0.34, 14, 10), mat, 0, 0.26, 0);
    blob.scale.set(1, 0.78, 1);
    cr.body.add(blob);
    const eye = cr.m(0x1b2631);
    cr.body.add(mesh(new THREE.SphereGeometry(0.045, 6, 4), eye, -0.11, 0.33, 0.28), mesh(new THREE.SphereGeometry(0.045, 6, 4), eye, 0.11, 0.33, 0.28));
    const shine = mesh(new THREE.SphereGeometry(0.07, 6, 4), cr.m(0xffffff, { opacity: 0.6 }), -0.12, 0.44, 0.12);
    cr.body.add(shine);
    cr.anim = (dt, st, t) => {
      const sq = Math.sin(t * (st.moving ? 10 : 3)) * 0.12;
      cr.body.scale.set(1 + sq, 1 - sq, 1 + sq);
      if (st.moving) cr.body.position.y = Math.abs(Math.sin(t * 5)) * 0.12;
    };
    return cr;
  },

  wolf(c, def) { return quadruped(c, def, { body: [0.34, 0.3, 0.78], h: 0.48, head: 0.28, legH: 0.36, tail: true, ears: true }); },

  boar(c, def) {
    const cr = quadruped(c, def, { body: [0.5, 0.42, 0.78], h: 0.42, head: 0.34, legH: 0.26, bristles: true });
    const tusk = cr.m(0xf0e6d2);
    for (const s of [-1, 1]) {
      const t = mesh(new THREE.ConeGeometry(0.035, 0.2, 5), tusk, s * 0.12, 0.38, 0.66);
      t.rotation.x = -1.0; t.rotation.z = s * 0.3;
      cr.body.add(t);
    }
    if (def.boss) {
      const eye = cr.m(0xff2a2a, { emissive: 0xff2a2a, ei: 1.5 });
      cr.body.add(mesh(new THREE.SphereGeometry(0.035, 5, 4), eye, -0.1, 0.55, 0.62), mesh(new THREE.SphereGeometry(0.035, 5, 4), eye, 0.1, 0.55, 0.62));
    }
    return cr;
  },

  spider(c, def) { return arachnid(c, def, false); },
  spider_queen(c, def) { return arachnid(c, def, true); },
  scorpion(c, def) { return scorpion(c, def, false); },
  scorpion_boss(c, def) { return scorpion(c, def, true); },

  ent(c, def) {
    const cr = new Creature(def.size * 0.8);
    const bark = cr.m(0x5d4037), dark = cr.m(0x3e2723);
    const trunk = mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.1, 7), bark, 0, 0.75, 0);
    cr.body.add(trunk);
    for (const s of [-1, 1]) {
      const leg = pivot(cr.body, s * 0.13, 0.3, 0);
      leg.add(mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.35, 6), dark, 0, -0.15, 0));
      cr.legs.push(leg);
      const arm = pivot(cr.body, s * 0.25, 1.05, 0);
      const a = mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 5), bark, s * 0.18, -0.25, 0.05);
      a.rotation.z = s * 0.6;
      arm.add(a);
      arm.userData.side = s;
      cr.arms = cr.arms || [];
      cr.arms.push(arm);
    }
    const leaves = [cr.m(0x3b5323), cr.m(0x4a6b2a), cr.m(0x5b4a2a)];
    [[0, 1.5, 0, 0.42], [-0.28, 1.35, 0.05, 0.3], [0.3, 1.4, -0.05, 0.32], [0.05, 1.75, -0.05, 0.3]].forEach(([x, y, z, r], i) => {
      cr.body.add(mesh(new THREE.IcosahedronGeometry(r, 0), leaves[i % 3], x, y, z));
    });
    const eye = cr.m(0xff3b1f, { emissive: 0xff3b1f, ei: 1.2 });
    cr.body.add(mesh(new THREE.SphereGeometry(0.04, 5, 4), eye, -0.08, 1.05, 0.24), mesh(new THREE.SphereGeometry(0.04, 5, 4), eye, 0.08, 1.05, 0.24));
    cr.anim = (dt, st, t) => {
      for (const a of cr.arms) a.rotation.x = Math.sin(t * 1.5 + a.userData.side) * 0.15 + (st.atkStart && st.now - st.atkStart < 400 ? -1.2 : 0);
    };
    return cr;
  },

  bat(c, def) {
    const cr = new Creature(def.size);
    cr.float = 0.95;
    const fur = cr.m(c), wing = cr.m(shade(c, 0.7), { side: THREE.DoubleSide });
    cr.body.add(mesh(new THREE.SphereGeometry(0.14, 8, 6), fur, 0, 0, 0));
    for (const s of [-1, 1]) {
      cr.body.add(mesh(new THREE.ConeGeometry(0.04, 0.1, 4), fur, s * 0.06, 0.15, 0));
      const w = pivot(cr.body, s * 0.1, 0.02, 0);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(s * 0.45, 0.12); shape.lineTo(s * 0.4, -0.1); shape.lineTo(s * 0.2, -0.05); shape.lineTo(0, -0.08);
      const wm = mesh(new THREE.ShapeGeometry(shape), wing);
      wm.rotation.x = -Math.PI / 2;
      w.add(wm);
      w.userData.s = s;
      (cr.wings = cr.wings || []).push(w);
    }
    const eye = cr.m(0xff4040, { emissive: 0xff4040 });
    cr.body.add(mesh(new THREE.SphereGeometry(0.025, 4, 3), eye, -0.05, 0.03, 0.12), mesh(new THREE.SphereGeometry(0.025, 4, 3), eye, 0.05, 0.03, 0.12));
    cr.anim = (dt, st, t) => { for (const w of cr.wings) w.rotation.z = Math.sin(t * 18) * 0.7 * w.userData.s; };
    return cr;
  },

  golem(c, def) { return golem(c, def, false); },
  golem_boss(c, def) { return golem(c, def, true); },

  wraith(c, def) {
    const cr = new Creature(def.size);
    cr.float = 0.25;
    const robe = cr.m(c, { opacity: 0.75, side: THREE.DoubleSide });
    const r = mesh(new THREE.ConeGeometry(0.36, 1.1, 8, 1, true), robe, 0, 0.6, 0);
    r.rotation.x = Math.PI;
    cr.body.add(r);
    cr.body.add(mesh(new THREE.SphereGeometry(0.2, 8, 6), cr.m(0x1b2631, { opacity: 0.9 }), 0, 1.25, 0));
    cr.body.add(mesh(new THREE.SphereGeometry(0.24, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), robe, 0, 1.28, -0.03));
    const eye = cr.m(0x85c1e9, { emissive: 0x85c1e9, ei: 2 });
    cr.body.add(mesh(new THREE.SphereGeometry(0.035, 5, 4), eye, -0.07, 1.27, 0.17), mesh(new THREE.SphereGeometry(0.035, 5, 4), eye, 0.07, 1.27, 0.17));
    for (const s of [-1, 1]) {
      const a = mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.55, 5), robe, s * 0.32, 0.85, 0.12);
      a.rotation.z = s * 0.5; a.rotation.x = -0.6;
      cr.body.add(a);
    }
    cr.anim = (dt, st, t) => { r.rotation.y = Math.sin(t * 3) * 0.2; };
    return cr;
  },

  // Sapo-boi do pântano: corpo largo, olhos saltados, papo que incha e pulos curtos; Nhaga é maior, com olhos de âmbar e coroa de juncos
  toad(c, def) {
    const cr = new Creature(def.size * 0.9);
    const boss = !!def.boss;
    const skin = cr.m(c, { rough: 0.6 }), dark = cr.m(shade(c, 0.55), { rough: 0.7 }), belly = cr.m(shade(c, 1.5), { rough: 0.5 });
    const ell = (rx, ry, rz, mat, x, y, z) => { const m = mesh(new THREE.SphereGeometry(1, 10, 8), mat, x, y, z); m.scale.set(rx, ry, rz); cr.body.add(m); return m; };
    ell(0.42, 0.3, 0.5, skin, 0, 0.36, -0.05);
    ell(0.34, 0.17, 0.32, belly, 0, 0.22, 0.05);
    ell(0.3, 0.2, 0.28, skin, 0, 0.5, 0.42);
    ell(0.27, 0.05, 0.2, dark, 0, 0.44, 0.52); // boca
    const eyeM = cr.m(boss ? 0xffb300 : 0xf4d03f, { emissive: boss ? 0xffa000 : 0x7a6a10, ei: boss ? 1.8 : 0.7 });
    const pupM = cr.m(0x111111);
    for (const sx of [-1, 1]) {
      ell(0.095, 0.095, 0.095, eyeM, sx * 0.17, 0.67, 0.44);
      ell(0.03, 0.075, 0.03, pupM, sx * 0.17, 0.67, 0.52);
    }
    const sac = ell(0.17, 0.12, 0.14, belly, 0, 0.38, 0.62);
    for (let i = 0; i < 9; i++) { // verrugas escuras no dorso
      const a = i * 2.4, r = 0.18 + (i % 3) * 0.06;
      ell(0.04, 0.035, 0.04, dark, Math.cos(a) * r, 0.58 + (i % 2) * 0.03, -0.12 + Math.sin(a) * r * 1.1);
    }
    // pernas: as de trás são grandes (coxa e pé espalmado)
    for (const [sx, front] of [[-1, true], [1, true], [-1, false], [1, false]]) {
      const leg = pivot(cr.body, sx * (front ? 0.26 : 0.36), front ? 0.28 : 0.3, front ? 0.28 : -0.3);
      if (front) leg.add(mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.28, 5), skin, 0, -0.14, 0), mesh(new THREE.BoxGeometry(0.16, 0.04, 0.14), dark, 0, -0.28, 0.04));
      else leg.add(mesh(new THREE.SphereGeometry(0.17, 7, 5), skin, 0, -0.06, 0), mesh(new THREE.BoxGeometry(0.2, 0.04, 0.3), dark, sx * 0.04, -0.28, 0.1));
      cr.legs.push(leg);
    }
    if (boss) { // coroa de juncos e musgo
      const reed = cr.m(0x6a8f3a), gold = cr.m(0xd4ac0d, { metal: 0.5, rough: 0.4 });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const cone = mesh(new THREE.ConeGeometry(0.035, 0.22 + (i % 2) * 0.08, 4), i % 3 === 0 ? gold : reed, Math.cos(a) * 0.14, 0.76, 0.42 + Math.sin(a) * 0.12);
        cone.rotation.x = Math.sin(a) * 0.3; cone.rotation.z = -Math.cos(a) * 0.3;
        cr.body.add(cone);
      }
    }
    cr.anim = (dt, st, t) => {
      sac.scale.set(0.17, 0.12 * (1 + Math.sin(t * 3.2) * 0.3), 0.14 * (1 + Math.sin(t * 3.2) * 0.2));
      if (st.moving) cr.body.position.y = Math.abs(Math.sin(st.phase || 0)) * 0.2;
    };
    return cr;
  },

  // Fogo-fátuo: núcleo luminoso com um halo e uma cauda de chamas que ondula atrás
  wisp(c, def) {
    const cr = new Creature(def.size);
    cr.float = 0.85;
    const core = cr.m(c, { emissive: c, ei: 2.6, rough: 0.2 });
    const halo = cr.m(c, { emissive: c, ei: 1.2, opacity: 0.28 });
    const orb = mesh(new THREE.SphereGeometry(0.16, 10, 8), core, 0, 0.35, 0);
    orb.castShadow = false;
    const aura = mesh(new THREE.SphereGeometry(0.3, 10, 8), halo, 0, 0.35, 0);
    aura.castShadow = false;
    cr.body.add(orb, aura);
    const tail = [];
    for (let i = 0; i < 4; i++) {
      const m = mesh(new THREE.SphereGeometry(0.12 - i * 0.02, 7, 5), cr.m(c, { emissive: c, ei: 1.5 - i * 0.25, opacity: 0.6 - i * 0.1 }), 0, 0.3 - i * 0.04, -0.2 - i * 0.16);
      m.castShadow = false;
      cr.body.add(m);
      tail.push(m);
    }
    cr.anim = (dt, st, t) => {
      const k = 1 + Math.sin(t * 5) * 0.12;
      orb.scale.setScalar(k);
      aura.scale.setScalar(1 + Math.sin(t * 3.1) * 0.15);
      tail.forEach((m, i) => { m.position.x = Math.sin(t * 4 - i * 0.9) * 0.08 * (i + 1); m.position.y = 0.3 - i * 0.04 + Math.sin(t * 3 - i) * 0.04; });
    };
    return cr;
  },

  // Yeti: gigante peludo com chifres, braços longos que balançam e rosto azulado
  yeti(c, def) {
    const cr = new Creature(def.size);
    const fur = cr.m(c, { rough: 1 }), shadeM = cr.m(shade(c, 0.78), { rough: 1 }), face = cr.m(0x9ec9e6, { rough: 0.7 });
    const horn = cr.m(0xe9dfc8, { rough: 0.5 }), eye = cr.m(0xff3b2f, { emissive: 0xff3b2f, ei: 1.4 });
    const ell = (rx, ry, rz, mat, x, y, z) => { const m = mesh(new THREE.SphereGeometry(1, 9, 7), mat, x, y, z); m.scale.set(rx, ry, rz); cr.body.add(m); return m; };
    ell(0.42, 0.5, 0.34, fur, 0, 1.0, 0);
    ell(0.34, 0.3, 0.3, shadeM, 0, 0.62, 0);
    ell(0.27, 0.27, 0.25, fur, 0, 1.58, 0.05);
    ell(0.17, 0.15, 0.1, face, 0, 1.55, 0.25);
    for (const sx of [-1, 1]) {
      cr.body.add(mesh(new THREE.SphereGeometry(0.035, 5, 4), eye, sx * 0.07, 1.6, 0.31));
      const h = mesh(new THREE.ConeGeometry(0.05, 0.3, 5), horn, sx * 0.2, 1.86, 0.02);
      h.rotation.z = -sx * 0.55; h.rotation.x = 0.15;
      cr.body.add(h);
      // tufos de pelo nos ombros
      for (let i = 0; i < 3; i++) {
        const tuft = mesh(new THREE.ConeGeometry(0.07, 0.22, 4), shadeM, sx * (0.42 + i * 0.05), 1.34 - i * 0.12, 0);
        tuft.rotation.z = -sx * 1.2;
        cr.body.add(tuft);
      }
    }
    cr.arms = [];
    for (const sx of [-1, 1]) {
      const arm = pivot(cr.body, sx * 0.5, 1.3, 0);
      arm.add(mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.75, 6), fur, 0, -0.36, 0), mesh(new THREE.SphereGeometry(0.16, 7, 5), shadeM, 0, -0.78, 0));
      cr.arms.push(arm);
      const leg = pivot(cr.body, sx * 0.2, 0.55, 0);
      leg.add(mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.55, 6), fur, 0, -0.27, 0), mesh(new THREE.BoxGeometry(0.24, 0.1, 0.34), shadeM, 0, -0.55, 0.06));
      cr.legs.push(leg);
    }
    cr.anim = (dt, st, t) => {
      const atk = st.atkStart ? (st.now - st.atkStart) / 450 : 2;
      for (const a of cr.arms) a.rotation.x = atk < 1 ? -Math.sin(atk * Math.PI) * 2.0 : (st.moving ? Math.sin(st.phase || 0) * 0.4 : Math.sin(t * 1.5) * 0.05);
    };
    return cr;
  },
};

function quadruped(c, def, o) {
  const cr = new Creature(def.size);
  const fur = cr.m(c), dark = cr.m(shade(c, 0.6)), light = cr.m(shade(c, 1.25));
  const [bw, bh, bl] = o.body;
  cr.body.add(mesh(new THREE.BoxGeometry(bw, bh, bl), fur, 0, o.h, 0));
  cr.body.add(mesh(new THREE.BoxGeometry(bw * 0.8, bh * 0.3, bl * 0.7), light, 0, o.h - bh * 0.42, 0.02));
  const head = mesh(new THREE.BoxGeometry(o.head, o.head * 0.9, o.head), fur, 0, o.h + 0.12, bl / 2 + o.head * 0.35);
  cr.body.add(head);
  cr.body.add(mesh(new THREE.BoxGeometry(o.head * 0.5, o.head * 0.4, o.head * 0.6), dark, 0, o.h + 0.06, bl / 2 + o.head * 0.9));
  const eye = cr.m(0x111111);
  cr.body.add(mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), eye, -o.head * 0.28, o.h + 0.2, bl / 2 + o.head * 0.86), mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), eye, o.head * 0.28, o.h + 0.2, bl / 2 + o.head * 0.86));
  if (o.ears) for (const s of [-1, 1]) cr.body.add(mesh(new THREE.ConeGeometry(0.06, 0.14, 4), fur, s * 0.09, o.h + 0.32, bl / 2 + o.head * 0.25));
  if (o.tail) {
    const t = mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.4, 5), fur, 0, o.h + 0.08, -bl / 2 - 0.12);
    t.rotation.x = -0.9;
    cr.body.add(t);
  }
  if (o.bristles) for (let i = 0; i < 5; i++) cr.body.add(mesh(new THREE.ConeGeometry(0.04, 0.14, 4), dark, 0, o.h + bh / 2 + 0.05, -bl / 2 + 0.1 + i * (bl / 5)));
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = pivot(cr.body, x * bw * 0.32, o.legH, z * bl * 0.34);
    leg.add(mesh(new THREE.BoxGeometry(0.08, o.legH, 0.08), dark, 0, -o.legH / 2, 0));
    cr.legs.push(leg);
  }
  return cr;
}

function arachnid(c, def, queen) {
  const cr = new Creature(def.size * 0.85);
  const shell = cr.m(c), dark = cr.m(shade(c, 0.55)), mark = cr.m(shade(c, 1.6));
  cr.body.add(mesh(new THREE.SphereGeometry(0.32, 10, 8), shell, 0, 0.42, -0.25));
  cr.body.add(mesh(new THREE.SphereGeometry(0.12, 6, 4), mark, 0, 0.62, -0.32));
  cr.body.add(mesh(new THREE.SphereGeometry(0.2, 8, 6), shell, 0, 0.36, 0.14));
  const eye = cr.m(queen ? 0xf4d03f : 0xe74c3c, { emissive: queen ? 0xf4d03f : 0xe74c3c, ei: 1.2 });
  for (let i = 0; i < 4; i++) cr.body.add(mesh(new THREE.SphereGeometry(0.03, 4, 3), eye, -0.06 + (i % 2) * 0.12, 0.42 + Math.floor(i / 2) * 0.05, 0.32));
  cr.spiderLegs = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const p = pivot(cr.body, s * 0.15, 0.38, 0.18 - i * 0.12);
      p.rotation.y = s * (0.5 - i * 0.35) + (s < 0 ? Math.PI : 0);
      const upper = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.4, 4), dark, 0.18, 0.12, 0);
      upper.rotation.z = -1.0;
      const lower = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.5, 4), dark, 0.42, -0.08, 0);
      lower.rotation.z = 0.5;
      p.add(upper, lower);
      p.userData.i = i + (s > 0 ? 4 : 0);
      cr.spiderLegs.push(p);
    }
  }
  if (queen) {
    const gold = cr.m(0xf4d03f, { metal: 0.6, rough: 0.3 });
    for (let i = -1; i <= 1; i++) cr.body.add(mesh(new THREE.ConeGeometry(0.03, 0.14, 4), gold, i * 0.07, 0.6, 0.12));
  }
  cr.anim = (dt, st, t) => {
    const ph = st.moving ? (st.phase || 0) * 1.5 : t * 1.2;
    for (const p of cr.spiderLegs) p.rotation.x = Math.sin(ph + p.userData.i * 1.3) * (st.moving ? 0.35 : 0.06);
  };
  return cr;
}

// Escorpião do deserto (Reino de Sahaar): carapaça, oito patas, duas pinças e a cauda curva com o ferrão; a rainha é maior, com espinhos dourados
function scorpion(c, def, boss) {
  const cr = new Creature(def.size * 0.9);
  const shell = cr.m(c, { rough: 0.55 }), dark = cr.m(shade(c, 0.6), { rough: 0.7 }), light = cr.m(shade(c, 1.25), { rough: 0.5 });
  const red = cr.m(boss ? 0xff3b1f : 0xc0392b, { emissive: boss ? 0xff3b1f : 0x7a1f12, ei: boss ? 1.6 : 0.8 });
  const ell = (rx, ry, rz, mat, x, y, z) => { const m = mesh(new THREE.SphereGeometry(1, 10, 8), mat, x, y, z); m.scale.set(rx, ry, rz); cr.body.add(m); return m; };
  ell(0.3, 0.16, 0.44, shell, 0, 0.3, 0.02);
  ell(0.17, 0.12, 0.2, light, 0, 0.36, 0.38);
  const eye = cr.m(boss ? 0xff3b1f : 0xf4d03f, { emissive: boss ? 0xff3b1f : 0xf4d03f, ei: 1.5 });
  for (const sx of [-1, 1]) cr.body.add(mesh(new THREE.SphereGeometry(0.035, 5, 4), eye, sx * 0.07, 0.45, 0.5));
  // abdômen em gomos
  [[-0.42, 0.14], [-0.62, 0.12], [-0.8, 0.1]].forEach(([z, r], i) => ell(r + 0.04, r, r + 0.06, i % 2 ? dark : shell, 0, 0.27 - i * 0.015, z));
  // cauda: gomos encadeados que sobem e se curvam para a frente, terminando no ferrão
  const tail = pivot(cr.body, 0, 0.3, -0.86);
  tail.rotation.x = -0.32;
  let parent = tail;
  const L = 0.27;
  for (let i = 0; i < 5; i++) {
    const seg = mesh(new THREE.CylinderGeometry(0.06 - i * 0.006, 0.07 - i * 0.006, L, 7), i % 2 ? dark : shell, 0, L / 2, 0);
    const knot = mesh(new THREE.SphereGeometry(0.075 - i * 0.007, 7, 5), shell, 0, L, 0);
    parent.add(seg, knot);
    const next = pivot(parent, 0, L, 0);
    next.rotation.x = 0.58;
    parent = next;
  }
  const sting = mesh(new THREE.ConeGeometry(0.06, boss ? 0.34 : 0.22, 6), red, 0, 0.12, 0);
  parent.add(sting);
  // pinças
  const claws = [];
  for (const s of [-1, 1]) {
    const arm = pivot(cr.body, s * 0.22, 0.28, 0.34);
    arm.rotation.y = -s * 0.5;
    const upper = mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.36, 6), shell, 0, 0, 0.18);
    upper.rotation.x = Math.PI / 2;
    const fore = pivot(arm, 0, 0, 0.36);
    fore.rotation.y = s * 0.7;
    const lower = mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.3, 6), dark, 0, 0, 0.15);
    lower.rotation.x = Math.PI / 2;
    const palm = mesh(new THREE.BoxGeometry(0.2, 0.1, 0.22), light, 0, 0, 0.36);
    const fingers = [-1, 1].map((f) => {
      const g = pivot(fore, f * 0.06, 0, 0.42);
      g.add(mesh(new THREE.BoxGeometry(0.06, 0.07, 0.24), f < 0 ? shell : dark, 0, 0, 0.12));
      return g;
    });
    fore.add(lower, palm);
    arm.add(upper);
    claws.push({ arm, fingers, s });
  }
  // oito patas
  const legs = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const p = pivot(cr.body, s * 0.2, 0.26, 0.2 - i * 0.15);
      const up = mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.32, 4), dark, s * 0.14, -0.06, 0);
      up.rotation.z = -s * 2.0;
      const lo = mesh(new THREE.CylinderGeometry(0.02, 0.014, 0.26, 4), dark, s * 0.3, -0.16, 0);
      lo.rotation.z = -s * 0.35;
      p.add(up, lo);
      p.userData.i = i + (s > 0 ? 4 : 0);
      legs.push(p);
    }
  }
  if (boss) {
    const gold = cr.m(0xf4d03f, { metal: 0.6, rough: 0.3 });
    for (let i = -2; i <= 2; i++) cr.body.add(mesh(new THREE.ConeGeometry(0.035, 0.18 - Math.abs(i) * 0.03, 5), gold, i * 0.08, 0.5 - Math.abs(i) * 0.03, 0.1 - Math.abs(i) * 0.04));
  }
  cr.anim = (dt, st, t) => {
    const ph = st.moving ? (st.phase || 0) * 1.4 : t * 1.1;
    for (const p of legs) p.rotation.y = Math.sin(ph + p.userData.i * 1.4) * (st.moving ? 0.38 : 0.05);
    const atk = st.atkStart ? (st.now - st.atkStart) / 500 : 2;
    // o golpe: a cauda desce sobre a presa e as pinças se abrem
    tail.rotation.x = -0.32 + Math.sin(t * 2.2) * 0.04 + (atk < 1 ? Math.sin(atk * Math.PI) * 0.95 : 0);
    for (const c of claws) {
      c.arm.rotation.y = -c.s * 0.5 + Math.sin(t * 1.6 + c.s) * 0.06;
      const open = atk < 1 ? Math.sin(atk * Math.PI) * 0.5 : 0.1 + Math.sin(t * 2.4) * 0.05;
      c.fingers[0].rotation.y = -open; c.fingers[1].rotation.y = open;
    }
  };
  return cr;
}

function golem(c, def, boss) {
  const cr = new Creature(def.size * 0.8);
  const stone = cr.m(c, { rough: 1 }), dark = cr.m(shade(c, 0.7), { rough: 1 }), light = cr.m(shade(c, 1.2), { rough: 1 });
  cr.body.add(mesh(new THREE.BoxGeometry(0.75, 0.7, 0.5), stone, 0, 1.0, 0));
  cr.body.add(mesh(new THREE.BoxGeometry(0.4, 0.25, 0.3), light, -0.12, 1.25, 0.15));
  cr.body.add(mesh(new THREE.BoxGeometry(0.36, 0.32, 0.34), stone, 0, 1.52, 0.04));
  const glow = boss ? 0xff9f1a : 0x5dade2;
  const eye = cr.m(glow, { emissive: glow, ei: 2 });
  cr.body.add(mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), eye, -0.08, 1.55, 0.22), mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), eye, 0.08, 1.55, 0.22));
  if (boss) {
    cr.core = mesh(new THREE.OctahedronGeometry(0.12, 0), cr.m(0xff9f1a, { emissive: 0xff9f1a, ei: 2 }), 0, 1.05, 0.27);
    cr.body.add(cr.core);
    for (let i = 0; i < 5; i++) cr.body.add(mesh(new THREE.OctahedronGeometry(0.1, 0), cr.m(0xa569bd, { emissive: 0x5b2c6f }), -0.3 + i * 0.15, 1.38 + (i % 2) * 0.06, -0.2));
  }
  cr.arms = [];
  for (const s of [-1, 1]) {
    const arm = pivot(cr.body, s * 0.5, 1.25, 0);
    arm.add(mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), dark, 0, -0.35, 0));
    cr.arms.push(arm);
    const leg = pivot(cr.body, s * 0.2, 0.65, 0);
    leg.add(mesh(new THREE.BoxGeometry(0.26, 0.65, 0.28), dark, 0, -0.32, 0));
    cr.legs.push(leg);
  }
  cr.anim = (dt, st, t) => {
    const atk = st.atkStart ? (st.now - st.atkStart) / 450 : 2;
    for (const a of cr.arms) a.rotation.x = atk < 1 ? -Math.sin(atk * Math.PI) * 1.8 : (st.moving ? Math.sin(st.phase || 0) * 0.3 : 0);
    if (cr.core) cr.core.scale.setScalar(1 + Math.sin(t * 4) * 0.2);
  };
  return cr;
}

export function buildCreature(def) {
  const fn = B[def.sprite] || B.slime;
  return fn(def.color, def);
}

// ------------------------------------------------------------------ props de NPC
export function buildNpcProp(npc) {
  const look = npc.look;
  const cr = new Creature(1);
  switch (look.type) {
    case 'cat': {
      const fur = cr.m(look.color), dark = cr.m(shade(look.color, 0.7));
      cr.body.add(mesh(new THREE.BoxGeometry(0.2, 0.18, 0.38), fur, 0, 0.2, 0));
      cr.body.add(mesh(new THREE.BoxGeometry(0.2, 0.18, 0.18), fur, 0, 0.32, 0.22));
      for (const s of [-1, 1]) cr.body.add(mesh(new THREE.ConeGeometry(0.04, 0.09, 4), fur, s * 0.06, 0.45, 0.22));
      const tail = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 5), dark, 0, 0.35, -0.24);
      tail.rotation.x = -0.4;
      cr.body.add(tail);
      for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) cr.body.add(mesh(new THREE.BoxGeometry(0.05, 0.12, 0.05), dark, x * 0.07, 0.06, z * 0.13));
      const eye = cr.m(0x145a32, { emissive: 0x0b3d1f });
      cr.body.add(mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), eye, -0.05, 0.35, 0.31), mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), eye, 0.05, 0.35, 0.31));
      cr.anim = (dt, st, t) => { tail.rotation.z = Math.sin(t * 3) * 0.4; };
      break;
    }
    case 'board': {
      const wood = cr.m(0x8d6e63), dark = cr.m(0x5d4037);
      for (const s of [-1, 1]) cr.body.add(mesh(new THREE.BoxGeometry(0.08, 1.3, 0.08), dark, s * 0.45, 0.65, 0));
      cr.body.add(mesh(new THREE.BoxGeometry(1.05, 0.65, 0.06), wood, 0, 1.0, 0.02));
      const papers = [0xf5e6c8, 0xfdebd0, 0xf9e79f, 0xfadbd8];
      papers.forEach((p, i) => cr.body.add(mesh(new THREE.BoxGeometry(0.18, 0.24, 0.01), cr.m(p), -0.33 + i * 0.22, 1.0 + (i % 2 ? 0.07 : -0.05), 0.06)));
      cr.body.add(mesh(new THREE.BoxGeometry(1.15, 0.07, 0.12), dark, 0, 1.36, 0.02));
      break;
    }
    case 'lore': {
      const stone = cr.m(0x7f8c8d, { rough: 1 });
      const s = mesh(new THREE.BoxGeometry(0.55, 0.9, 0.22), stone, 0, 0.45, 0);
      cr.body.add(s);
      cr.body.add(mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.22, 8, 1, false, 0, Math.PI), stone, 0, 0.9, 0)).children;
      cr.body.children[1].rotation.x = Math.PI / 2;
      cr.body.children[1].rotation.y = Math.PI / 2;
      const rune = cr.m(0x85c1e9, { emissive: 0x5dade2, ei: 1.5 });
      for (let i = 0; i < 4; i++) cr.body.add(mesh(new THREE.BoxGeometry(0.16, 0.04, 0.01), rune, -0.08 + (i % 2) * 0.16, 0.35 + i * 0.13, 0.115));
      cr.glow = rune;
      cr.anim = (dt, st, t) => { rune.emissiveIntensity = 1 + Math.sin(t * 2) * 0.6; };
      break;
    }
    case 'waystone': {
      const stone = cr.m(0x566573, { rough: 1 });
      const g = mesh(new THREE.CylinderGeometry(0.12, 0.3, 1.6, 6), stone, 0, 0.8, 0);
      cr.body.add(g);
      cr.body.add(mesh(new THREE.ConeGeometry(0.12, 0.3, 6), stone, 0, 1.75, 0));
      cr.body.add(mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.12, 8), cr.m(0x7f8c8d), 0, 0.06, 0));
      const rune = cr.m(0x5dade2, { emissive: 0x5dade2, ei: 2 });
      const gem = mesh(new THREE.OctahedronGeometry(0.11, 0), rune, 0, 1.15, 0.22);
      cr.body.add(gem);
      const orb = mesh(new THREE.OctahedronGeometry(0.1, 0), rune, 0, 2.2, 0);
      cr.body.add(orb);
      cr.anim = (dt, st, t) => { orb.position.y = 2.15 + Math.sin(t * 2) * 0.1; orb.rotation.y = t; rune.emissiveIntensity = 1.6 + Math.sin(t * 2.5) * 0.6; };
      break;
    }
    case 'altar': {
      const stone = cr.m(0x95a5a6, { rough: 1 }), dark = cr.m(0x566573);
      cr.body.add(mesh(new THREE.BoxGeometry(1.3, 0.55, 0.7), stone, 0, 0.28, 0));
      cr.body.add(mesh(new THREE.BoxGeometry(1.45, 0.14, 0.85), dark, 0, 0.6, 0));
      const cols = [0x58d68d, 0xe67e22, 0x85c1e9];
      cr.flames = cols.map((c, i) => {
        cr.body.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.16, 6), dark, -0.42 + i * 0.42, 0.75, 0));
        const f = mesh(new THREE.ConeGeometry(0.08, 0.32, 6), cr.m(c, { emissive: c, ei: 2.5, opacity: 0.9 }), -0.42 + i * 0.42, 1.0, 0);
        f.castShadow = false;
        cr.body.add(f);
        return f;
      });
      const big = mesh(new THREE.ConeGeometry(0.2, 0.9, 7), cr.m(0xffd54f, { emissive: 0xffb300, ei: 3, opacity: 0.9 }), 0, 1.4, 0);
      big.castShadow = false;
      cr.body.add(big);
      cr.big = big;
      cr.anim = (dt, st, t) => {
        for (const [i, f] of cr.flames.entries()) { f.visible = !!st.lit; f.scale.y = 1 + Math.sin(t * 9 + i) * 0.2; }
        big.visible = !!st.lit;
        big.scale.set(1 + Math.sin(t * 7) * 0.1, 1 + Math.sin(t * 5) * 0.2, 1);
      };
      break;
    }
    default: {
      cr.body.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.2, 8), cr.m(0x95a5a6), 0, 0.6, 0));
    }
  }
  cr.static = true;
  return cr;
}

export { M as material, mesh };
