// Efeitos visuais 3D: projéteis, golpes, explosões, avisos de área, partículas e textos flutuantes.
import * as THREE from 'three';
import { quality } from '../device.js';
import { glowTexture } from './world3d.js';

export const STYLE_COLORS = {
  fire: ['#ffb74d', '#ff5722'], frost: ['#d6f3ff', '#5dade2'], arcane: ['#e1bee7', '#9b59b6'],
  arrow: ['#d5d8dc', '#8b5a2b'], arrow_big: ['#f7dc6f', '#8b5a2b'], poison: ['#b9f15a', '#3f6212'],
  holy: ['#fff8c4', '#f4d03f'], shadow: ['#d2a6f2', '#5b2c6f'], ash: ['#ffb74d', '#6d4c41'],
  heal: ['#abebc6', '#27ae60'], web: ['#ffffff', '#bdc3c7'], roots: ['#bcaaa4', '#4e342e'],
  void: ['#d2a6f2', '#3a0f4a'], meteor: ['#ffcc80', '#e65100'], stomp: ['#d7ccc8', '#8d6e63'],
  rock: ['#bcaaa4', '#5d4037'], charge: ['#ffab91', '#bf360c'], shout: ['#ffe082', '#ff8f00'],
  whirl: ['#eceff1', '#90a4ae'], frostnova: ['#e1f5fe', '#4fc3f7'], grace: ['#fffde7', '#ffd54f'],
  consec: ['#fff59d', '#f9a825'], arrows: ['#d7ccc8', '#6d4c41'], blink: ['#e1bee7', '#8e24aa'],
  roll: ['#fff9c4', '#c0a000'], fury: ['#ff8a65', '#c62828'], bless: ['#fff3e0', '#ef6c00'],
  faith: ['#fffde7', '#fbc02d'], hawk: ['#fff59d', '#f9a825'], elixir: ['#f8bbd0', '#ad1457'],
  enrage: ['#ff5252', '#b71c1c'], harden: ['#b39ddb', '#4527a0'], arcane_shield: ['#e1bee7', '#7b1fa2'],
};
const LIT_STYLES = new Set(['fire', 'holy', 'arcane', 'frost', 'ash', 'shadow', 'meteor', 'void', 'heal', 'poison']);
const Q = quality(); // limite de partículas muda ao vivo (Opções > Gráficos); os buffers já nascem no tamanho máximo
const MAX_BUFFER = 3000;

const col = (c) => new THREE.Color(c);

function addMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
}

export class Effects3D {
  constructor(game, scene) {
    this.game = game;
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.list = [];
    this.texts = [];
    // partículas
    this.pdata = [];
    const geo = new THREE.BufferGeometry();
    this.ppos = new Float32Array(MAX_BUFFER * 3);
    this.pcol = new Float32Array(MAX_BUFFER * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.ppos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.pcol, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, map: glowTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.ringGeo = new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2);
    this.discGeo = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  }

  now() { return performance.now(); }

  clear() {
    for (const e of this.list) this.removeObj(e);
    this.list = [];
    this.pdata = [];
    this.texts = [];
  }

  removeObj(e) { if (e.obj) { this.group.remove(e.obj); e.obj.traverse((o) => { if (o.material) o.material.dispose(); if (o.geometry && o.geometry !== this.ringGeo && o.geometry !== this.discGeo) o.geometry.dispose(); }); } }

  // posição 3D (x, altura, z) de uma entidade
  entPos(id, hFrac = 0.6) {
    const e = this.game.entities.get(id);
    if (!e) return null;
    const h = this.game.renderer.entityHeight(e);
    return new THREE.Vector3(e.rx, h * hFrac + (e.lift || 0), e.ry);
  }

  text(anchor, text, color, opts = {}) {
    this.texts.push({ anchor, text, color, start: this.now(), dur: opts.dur || 1100, size: opts.size || 14, vy: opts.vy ?? -40, crit: opts.crit, dx: (Math.random() - 0.5) * 18 });
  }

  burst(p, n, opts = {}) {
    const [c1, c2] = STYLE_COLORS[opts.style] || [opts.color || '#ffffff', opts.color2 || '#aaaaaa'];
    const a = col(c1), b = col(c2);
    for (let i = 0; i < n && this.pdata.length < Q.particles; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = (opts.speed || 2) * (0.4 + Math.random() * 0.8);
      this.pdata.push({
        x: p.x, y: p.h ?? p.y3 ?? 0.6, z: p.y,
        vx: Math.cos(ang) * sp, vy: (opts.up || 1) * (0.5 + Math.random()), vz: Math.sin(ang) * sp,
        life: (opts.life || 600) * (0.6 + Math.random() * 0.6), age: 0, c: Math.random() < 0.5 ? a : b, grav: opts.grav ?? -4,
      });
    }
  }

  add(e) {
    e.start = e.start ?? this.now();
    const g = this.game;
    switch (e.kind) {
      case 'proj': {
        const [c1, c2] = STYLE_COLORS[e.style] || ['#ffffff', '#aaaaaa'];
        const grp = new THREE.Group();
        if (e.style && e.style.startsWith('arrow') || e.style === 'poison') {
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: e.style === 'poison' ? 0x7cb342 : 0x8b5a2b }));
          const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: c1 }));
          tip.position.z = 0.32;
          grp.add(shaft, tip);
          if (e.style !== 'arrow') { const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c1, blending: THREE.AdditiveBlending, depthWrite: false })); gl.scale.setScalar(0.5); grp.add(gl); }
        } else if (e.style === 'web' || e.style === 'roots') {
          grp.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: c1, wireframe: true })));
        } else {
          grp.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), new THREE.MeshBasicMaterial({ color: c1 })));
          const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c2, blending: THREE.AdditiveBlending, depthWrite: false }));
          gl.scale.setScalar(0.85);
          grp.add(gl);
        }
        e.obj = grp;
        break;
      }
      case 'swing': {
        const style = e.style || 'slash';
        const color = style === 'heavy' || style === 'exec' ? 0xffcc80 : style === 'claw' ? 0xff8a80 : 0xffffff;
        const m = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 20, 1, -1.1, 2.2).rotateX(-Math.PI / 2), addMat(color, 0.9));
        e.obj = m;
        break;
      }
      case 'aoe': {
        const [c1, c2] = STYLE_COLORS[e.style] || ['#ffffff', '#aaaaaa'];
        const grp = new THREE.Group();
        grp.add(new THREE.Mesh(this.ringGeo, addMat(c1, 0.9)));
        const fill = new THREE.Mesh(this.discGeo, addMat(c2, 0.35));
        grp.add(fill);
        if (['meteor', 'fire', 'void', 'frostnova', 'grace'].includes(e.style)) {
          const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c1, blending: THREE.AdditiveBlending, depthWrite: false }));
          flash.position.y = 0.6;
          grp.add(flash);
          grp.userData.flash = flash;
        }
        grp.position.set(e.x, 0.05, e.y);
        e.obj = grp;
        const n = Math.min(60, 12 + e.r * 10);
        this.burst({ x: e.x, y: e.y, h: 0.3 }, n, { style: e.style, speed: e.r * 2.2, life: 700, up: 2.5, grav: -5 });
        break;
      }
      case 'tele': {
        const c = e.friendly ? 0xffaa3c : 0xff2828;
        const grp = new THREE.Group();
        const base = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
        const inner = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
        const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
        grp.add(base, inner, ring);
        grp.position.set(e.x, 0.04, e.y);
        grp.scale.setScalar(e.r);
        grp.userData.inner = inner;
        e.obj = grp;
        break;
      }
      case 'falling': {
        const grp = new THREE.Group();
        grp.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: 0xff8f00 })));
        const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff5722, blending: THREE.AdditiveBlending, depthWrite: false }));
        gl.scale.setScalar(1.6);
        grp.add(gl);
        e.obj = grp;
        break;
      }
      case 'area': {
        const [c1, c2] = STYLE_COLORS[e.style] || ['#ffffff', '#aaaaaa'];
        const grp = new THREE.Group();
        grp.add(new THREE.Mesh(this.discGeo, addMat(c2, 0.25)), new THREE.Mesh(this.ringGeo, addMat(c1, 0.9)));
        grp.position.set(e.x, 0.05, e.y);
        grp.scale.setScalar(e.r);
        e.obj = grp;
        break;
      }
      case 'buff': {
        const [c1] = STYLE_COLORS[e.style] || ['#ffffff'];
        e.obj = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 24).rotateX(Math.PI / 2), addMat(c1, 0.9));
        const p = this.entPos(e.id, 0.1);
        if (p) this.burst({ x: p.x, y: p.z, h: 0.2 }, 14, { style: e.style, speed: 0.8, up: 3, life: 900, grav: 1 });
        break;
      }
      case 'dash': {
        const [c1] = STYLE_COLORS[e.style] || ['#ffffff'];
        const dx = e.x - e.x0, dz = e.y - e.y0;
        const len = Math.max(0.1, Math.hypot(dx, dz));
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, len), addMat(c1, 0.55));
        m.position.set((e.x + e.x0) / 2, 0.6, (e.y + e.y0) / 2);
        m.rotation.y = Math.atan2(dx, dz);
        e.obj = m;
        break;
      }
      case 'lvl': case 'rv': case 'sp': {
        const color = e.kind === 'sp' ? 0xb05ce0 : 0xffd75a;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 5, 20, 1, true), addMat(color, 0.6));
        e.obj = m;
        break;
      }
      case 'ring': {
        const m = new THREE.Mesh(this.ringGeo, addMat(0xffffff, 0.8));
        m.position.set(e.x, 0.05, e.y);
        e.obj = m;
        break;
      }
      default: break;
    }
    if (e.obj) this.group.add(e.obj);
    this.list.push(e);
    return e;
  }

  projPos(e, now) {
    const t = Math.min(1, (now - e.start) / e.dur);
    const a = e.fromPos;
    let b = e.toPos;
    if (e.to != null) { const p = this.entPos(e.to, 0.55); if (p) b = p; }
    if (!a || !b) return null;
    const arc = e.style && e.style.startsWith('arrow') ? Math.sin(t * Math.PI) * 0.35 : 0;
    return { pos: new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + arc, a.z + (b.z - a.z) * t), dir: new THREE.Vector3().subVectors(b, a), t };
  }

  update(dt) {
    const now = this.now();
    const keep = [];
    for (const e of this.list) {
      const t = (now - e.start) / e.dur;
      if (t >= 1) { this.removeObj(e); continue; }
      keep.push(e);
      const o = e.obj;
      if (!o) continue;
      switch (e.kind) {
        case 'proj': {
          const p = this.projPos(e, now);
          if (!p) break;
          o.position.copy(p.pos);
          o.lookAt(p.pos.clone().add(p.dir));
          if (LIT_STYLES.has(e.style) && Math.random() < 0.7) {
            const [c1, c2] = STYLE_COLORS[e.style];
            this.pdata.length < Q.particles && this.pdata.push({ x: p.pos.x, y: p.pos.y, z: p.pos.z, vx: (Math.random() - 0.5) * 0.5, vy: 0.3 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.5, life: 380, age: 0, c: col(Math.random() < 0.5 ? c1 : c2), grav: 0.5 });
          }
          break;
        }
        case 'swing': {
          const a = this.game.entities.get(e.id);
          if (!a) break;
          const tg = e.target != null ? this.game.entities.get(e.target) : null;
          const ang = tg ? Math.atan2(tg.rx - a.rx, tg.ry - a.ry) : (a.facing || 0);
          o.position.set(a.rx + Math.sin(ang) * 0.35, 0.75, a.ry + Math.cos(ang) * 0.35);
          o.rotation.y = ang - Math.PI / 2 + t * 1.2;
          o.material.opacity = (1 - t) * 0.9;
          o.scale.setScalar(1 + t * 0.4);
          break;
        }
        case 'aoe': {
          const k = 0.3 + t * 0.7;
          o.scale.set(e.r * k, 1, e.r * k);
          o.children.forEach((c) => { if (c.material) c.material.opacity = (1 - t) * (c.isSprite ? 1 : 0.8); });
          if (o.userData.flash) o.userData.flash.scale.setScalar(e.r * 2.2 * (1 - t * 0.6));
          break;
        }
        case 'tele': {
          o.userData.inner.scale.setScalar(Math.max(0.01, t));
          o.children[2].material.opacity = 0.6 + Math.sin(now / 60) * 0.35;
          break;
        }
        case 'falling': {
          const ft = Math.min(1, t);
          o.position.set(e.x + (1 - ft) * 3, 0.3 + (1 - ft) * 9, e.y - (1 - ft) * 2);
          break;
        }
        case 'area': {
          const fade = Math.min(1, (1 - t) * 4, t * 8);
          o.children[0].material.opacity = 0.25 * fade;
          o.children[1].material.opacity = 0.9 * fade;
          o.rotation.y = now / 1500;
          if (Math.random() < 0.6) {
            const ang = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * e.r;
            const [c1] = STYLE_COLORS[e.style] || ['#ffffff'];
            const falling = e.style === 'arrows';
            this.pdata.length < Q.particles && this.pdata.push({ x: e.x + Math.cos(ang) * d, y: falling ? 3 : 0.1, z: e.y + Math.sin(ang) * d, vx: 0, vy: falling ? -9 : 1.2, vz: 0, life: falling ? 330 : 800, age: 0, c: col(c1), grav: 0 });
          }
          break;
        }
        case 'buff': {
          const p = this.entPos(e.id, 0);
          if (p) o.position.set(p.x, 0.1 + t * 1.6, p.z);
          o.material.opacity = 1 - t;
          o.scale.setScalar(1 + t * 0.5);
          break;
        }
        case 'dash': o.material.opacity = (1 - t) * 0.55; break;
        case 'lvl': case 'rv': case 'sp': {
          const p = e.id != null ? this.entPos(e.id, 0) : new THREE.Vector3(e.x, 0, e.y);
          if (p) o.position.set(p.x, 2.5, p.z);
          o.material.opacity = Math.sin(t * Math.PI) * 0.6;
          o.rotation.y = now / 300;
          break;
        }
        case 'ring': o.scale.setScalar(0.4 + t * 0.4); o.material.opacity = 1 - t; break;
        default: break;
      }
    }
    this.list = keep;
    // partículas
    let n = 0;
    const alive = [];
    for (const p of this.pdata) {
      p.age += dt * 1000;
      if (p.age >= p.life) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy += p.grav * dt;
      if (p.y < 0.02) { p.y = 0.02; p.vy = 0; p.vx *= 0.8; p.vz *= 0.8; }
      const a = 1 - p.age / p.life;
      this.ppos[n * 3] = p.x; this.ppos[n * 3 + 1] = p.y; this.ppos[n * 3 + 2] = p.z;
      this.pcol[n * 3] = p.c.r * a; this.pcol[n * 3 + 1] = p.c.g * a; this.pcol[n * 3 + 2] = p.c.b * a;
      n++;
      alive.push(p);
    }
    this.pdata = alive;
    const geo = this.points.geometry;
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    this.texts = this.texts.filter((tx) => now - tx.start < tx.dur);
  }

  // luzes dinâmicas dos efeitos
  lights(out) {
    const now = this.now();
    for (const e of this.list) {
      if (e.kind === 'proj' && LIT_STYLES.has(e.style)) {
        const p = this.projPos(e, now);
        if (p) out.push({ x: p.pos.x, y: p.pos.y, z: p.pos.z, c: STYLE_COLORS[e.style][0], i: 3, d: 4 });
      } else if (e.kind === 'aoe' && LIT_STYLES.has(e.style)) {
        const t = (now - e.start) / e.dur;
        out.push({ x: e.x, y: 0.8, z: e.y, c: STYLE_COLORS[e.style][0], i: 10 * (1 - t), d: e.r * 3 });
      }
    }
  }
}
