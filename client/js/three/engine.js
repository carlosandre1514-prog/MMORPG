// Motor 3D: cena, câmera, luz, atores sincronizados com as entidades do jogo e camada 2D de rótulos.
import * as THREE from 'three';
import { F, RARITY } from '/shared/constants.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { NPCS } from '/shared/data/npcs.js';
import { ITEMS } from '/shared/data/items.js';
import { ZoneScene, glowTexture } from './world3d.js';
import { Effects3D } from './fx3d.js';
import { characters, LOOKS } from './characters.js';
import { buildCreature, buildNpcProp } from './creatures.js';
import { medieval } from './medieval.js';
import { arms } from './arms.js';
import { itemIcon } from '../sprites.js';
import { Overlay } from './overlay.js';
import { updateSeeThrough } from './seethrough.js';
import { roomAt } from '/shared/housegeom.js';
import { GuideFx } from './guide3d.js';
import { quality, bootQuality, onGfxChange, lowerAutoPreset, PRESET_NAMES, showFps } from '../device.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const Q = quality(); // objeto único, atualizado no lugar quando o jogador muda os gráficos

// Atmosfera por zona: céu de dia/noite, névoa
const ATMOS = {
  town: { day: 0x9fd0f0, night: 0x0b1026, fog: [34, 80] },
  fields: { day: 0xa6d6f2, night: 0x0b1026, fog: [34, 85] },
  forest: { day: 0x8fb59a, night: 0x07140e, fog: [20, 55] },
  mines: { day: 0x1a1410, night: 0x0d0a08, fog: [14, 38] },
  ruins: { day: 0xa88676, night: 0x1a0d0c, fog: [20, 55] },
  arena: { day: 0x9db3cc, night: 0x111426, fog: [30, 75] },
  // Reino de Sahaar: céu poeirento de areia, névoa quente; as tumbas são fechadas como as minas
  zahrim: { day: 0xdcc59b, night: 0x14101c, fog: [42, 100] },
  dunes: { day: 0xe2c690, night: 0x15111a, fog: [38, 95] },
  tombs: { day: 0x2a2018, night: 0x120d08, fog: [14, 38] },
};

const lerp = (a, b, t) => a + (b - a) * t;
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
const DIR_ANGLE = [0, -Math.PI / 2, Math.PI / 2, Math.PI]; // baixo, esquerda, direita, cima

// Saque no chão em 3D: armas por classe (comum, nível alto, lendária) e materiais do Resource Bits
const LOOT_WEAPON = {
  warrior: ['sword_A', 'sword_C', 'sword_E'],
  berserker: ['axe_A', 'axe_B', 'axe_C'],
  assassin: ['dagger_A', 'dagger_A', 'dagger_B'],
  mage: ['staff_A', 'staff_B', 'staff_B'],
  ranger: ['bow_A_withString', 'bow_B_withString', 'bow_B_withString'],
  cleric: ['hammer_A', 'hammer_B', 'hammer_C'],
};
// armas de nível 30 (Solar): modelos de Sahaar, quando o reino já carregou
const LOOT_SOLAR = { warrior: 'Scimitar', ranger: 'Bow_Golden', cleric: 'Hammer_Small' };
const LOOT_RESOURCE = { mat_ore: 'Iron_Nuggets', enh_stone: 'Silver_Nugget_Large', mat_ember: 'Gold_Nugget_Large' };

export class Renderer3D {
  constructor(canvas, overlayCanvas, game) {
    this.game = game;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.antialias, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.shadows = Q.shadows;
    this.renderer.shadowMap.enabled = this.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.3, 220);
    this.yaw = 0;
    // câmera: 'far' (3ª pessoa longe), 'near' (3ª pessoa perto) ou 'first' (1ª pessoa); cada modo lembra a própria inclinação
    this.pitches = { far: 0.92, near: 0.34, first: 0.05 };
    this.camMode = loadStr('cam', 'far');
    if (!this.pitches[this.camMode]) this.camMode = 'far';
    this.camera.fov = this.camMode === 'first' ? 72 : this.camMode === 'near' ? 52 : 40;
    this.camera.near = this.camMode === 'first' ? 0.08 : 0.3;
    this.camera.updateProjectionMatrix();
    this.camTarget = new THREE.Vector3();
    this._sunDir = new THREE.Vector3(); // direção do sol (para a água)
    this.hemi = new THREE.HemisphereLight(0xfff4e0, 0x4a5a3a, 1.6);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap);
    const sc = this.sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.envOn = false;
    if (bootQuality().pbr) this.loadSky(); // céu de verdade como luz ambiente (só com materiais realistas: os leves não usam)
    this.pool = [];
    this.playerLight = new THREE.PointLight(0xffe0b0, 0, 12, 1.4);
    this.scene.add(this.playerLight);
    // luz quente dentro das casas (velas e lareira); com poucas luzes uma só faz as duas tarefas (cada luz custa em todos os pixels)
    this.ownRoomLight = new THREE.PointLight(0xffcf94, 0, 7, 1.2);
    this.roomLight = this.playerLight;
    this.applyLights();
    this.room = null;
    this.frameGap = this.capGap(); // ms mínimos entre quadros desenhados
    this.fx = new Effects3D(game, this.scene);
    this.guideFx = new GuideFx(this.scene);
    this.actors = new Map();
    this.zoneScene = null;
    this.overlay = new Overlay(overlayCanvas, this, game);
    // anéis de alvo e de seleção
    const ringGeo = new THREE.RingGeometry(0.42, 0.5, 40).rotateX(-Math.PI / 2);
    this.targetRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.9, depthWrite: false }));
    this.hoverRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
    this.scene.add(this.targetRing, this.hoverRing);
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.iconTex = new Map();
    this.lastLightPick = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    onGfxChange(() => this.applyGraphics());
    this.setFpsMeter(showFps());
  }

  // Liga/desliga as sombras e acerta o tamanho do mapa de sombra (Q.shadowMap)
  setShadows(on) {
    const was = this.shadows;
    this.shadows = on;
    this.renderer.shadowMap.enabled = on;
    this.sun.castShadow = on;
    const sh = this.sun.shadow;
    if (sh.mapSize.x !== Q.shadowMap) {
      sh.mapSize.set(Q.shadowMap, Q.shadowMap);
      if (sh.map) { sh.map.dispose(); sh.map = null; } // o three recria o mapa no próximo quadro
    }
    if (was !== on) this.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) m.needsUpdate = true; } });
  }

  // Luz ambiente vinda do céu (HDR do Poly Haven reduzido por tools/sky/convert.mjs): clareia o lado da sombra com a cor do céu
  async loadSky() {
    try {
      const tex = await new HDRLoader().loadAsync('/brackeys/sky/sky.hdr');
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.envRT = pm.fromEquirectangular(tex);
      pm.dispose();
      tex.dispose();
      this.scene.environment = this.envRT.texture;
      this.envOn = true;
    } catch (e) {
      console.warn('[cenário] céu HDR indisponível', e);
    }
  }

  capGap() { return Q.fps ? Math.round(1000 / Q.fps) : 0; }

  // Pool de luzes de ponto (tochas, fogo, magias) e a luz dos cômodos, conforme Q.lights / Q.fuse. Mudar o número de luzes recompila os materiais uma vez.
  applyLights() {
    while (this.pool.length > Q.lights) { const l = this.pool.pop(); this.scene.remove(l); l.dispose(); }
    while (this.pool.length < Q.lights) {
      const l = new THREE.PointLight(0xffaa55, 0, 8, 1.6);
      this.scene.add(l);
      this.pool.push(l);
    }
    if (Q.fuse) {
      if (this.ownRoomLight.parent) this.scene.remove(this.ownRoomLight);
      this.roomLight = this.playerLight;
    } else {
      if (!this.ownRoomLight.parent) this.scene.add(this.ownRoomLight);
      this.roomLight = this.ownRoomLight;
      this.playerLight.color.set(0xffe0b0); this.playerLight.distance = 12;
    }
    this.picked = null;
    this.lastLightPick = 0;
  }

  // O jogador mexeu em Opções > Gráficos: aplica ao vivo o que dá (anti-serrilhado, materiais e textura do chão pedem recarregar)
  applyGraphics() {
    this.maxDpr = null; // esquece os passos automáticos desta sessão
    this.frameGap = this.capGap();
    this.setShadows(Q.shadows);
    this.applyLights();
    this.resize();
    if (this.zoneScene) this.zoneScene.cull(this.game.me.x, this.game.me.y, true);
    this.qualityDone = false; this.fpsT = 0; this.fpsN = 0;
  }

  resize() {
    this.W = window.innerWidth; this.H = window.innerHeight;
    // resolução: limitada pelo aparelho, pelo passo da qualidade automática e por um orçamento de pixels (modo leve)
    this.dpr = Math.min(this.maxDpr || Q.dprMax, window.devicePixelRatio || 1, Math.max(0.5, Math.sqrt(Q.pixels / (this.W * this.H))));
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.W, this.H, false);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.camera.aspect = this.W / this.H;
    this.camera.updateProjectionMatrix();
    this.overlay.resize(this.W, this.H);
  }

  // ------------------------------------------------------------------ zona
  setZone(zone, terrain) {
    if (this.zoneScene) { this.scene.remove(this.zoneScene.group); this.zoneScene.dispose(); }
    for (const a of this.actors.values()) this.removeActor(a);
    this.actors.clear();
    this.fx.clear();
    this.zoneScene = new ZoneScene(zone, terrain, this.renderer);
    this.scene.add(this.zoneScene.group);
    this.atmos = ATMOS[zone.id] || ATMOS.fields;
    this.scene.fog = new THREE.Fog(this.atmos.day, this.atmos.fog[0], this.atmos.fog[1]);
    this.lights = terrain.lights.map((L) => ({ x: L.x, y: L.lava ? 0.4 : 1.15, z: L.y, r: L.r, lava: L.lava, o: L.o }));
    const me = this.game.me;
    this.camTarget.set(me.x, 0.8, me.y);
    // compila os shaders já (em paralelo, se o navegador deixar) para o jogo não engasgar na primeira vez que algo aparece
    if (this.renderer.extensions.has('KHR_parallel_shader_compile')) this.renderer.compileAsync(this.scene, this.camera).catch(() => {});
  }

  get dist() {
    const z = this.game.zoom;
    if (this.camMode === 'near') return 7.5 * Math.sqrt(2 / z);
    if (this.camMode === 'first') return 0.5;
    return 30 / z;
  }

  get pitch() { return this.pitches[this.camMode]; }
  set pitch(v) { this.pitches[this.camMode] = v; }
  get first() { return this.camMode === 'first'; }

  setCamMode(mode) {
    if (!this.pitches[mode]) return;
    this.camMode = mode;
    saveStr('cam', mode);
    this.camera.fov = mode === 'first' ? 72 : mode === 'near' ? 52 : 40;
    this.camera.near = mode === 'first' ? 0.08 : 0.3;
    this.camera.updateProjectionMatrix();
  }

  cycleCam() {
    const order = ['far', 'near', 'first'];
    this.setCamMode(order[(order.indexOf(this.camMode) + 1) % order.length]);
    return this.camMode;
  }

  // girar a câmera com o dedo/mouse (limites de inclinação por modo)
  rotate(dx, dy) {
    this.yaw -= dx * 0.008;
    const [lo, hi] = this.camMode === 'far' ? [0.45, 1.35] : this.camMode === 'near' ? [0.02, 1.2] : [-1.25, 1.25];
    this.pitch = Math.max(lo, Math.min(hi, this.pitch + dy * 0.005 * (this.camMode === 'first' ? 0.8 : 1)));
  }

  darkness() {
    const g = this.game;
    if (!g.zone) return 0;
    const def = g.zone.def;
    const tday = g.dayTime();
    let night;
    if (tday < 0.2 || tday > 0.85) night = 1;
    else if (tday < 0.3) night = 1 - (tday - 0.2) / 0.1;
    else if (tday > 0.75) night = (tday - 0.75) / 0.1;
    else night = 0;
    const base = def.alwaysDark || 0;
    return Math.min(0.92, base + night * (def.night ?? 0.6) * (1 - base));
  }

  // ------------------------------------------------------------------ atores
  createActor(e) {
    let a = null;
    if (e.k === 'p') {
      if (!characters.has(e.cls)) return null;
      a = { kind: 'char', model: characters.create(e.cls) };
    } else if (e.k === 'm') {
      const def = MONSTERS[e.m];
      if (characters.has(def.id)) a = { kind: 'char', model: characters.create(def.id) };
      else a = { kind: 'creature', model: buildCreature(def) };
      if (a.kind === 'char') a.model.root.scale.setScalar(def.size);
      if (LOOKS[def.id]?.float) a.float = LOOKS[def.id].float;
    } else if (e.k === 'n') {
      const npc = NPCS[e.n];
      if (LOOKS[npc.id] && characters.ready) a = { kind: 'char', model: characters.create(npc.id) };
      else a = { kind: 'creature', model: buildNpcProp(npc) };
    } else if (e.k === 'i') {
      a = { kind: 'item', model: this.itemModel(e) };
    }
    if (!a) return null;
    const root = a.model.root;
    root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    const box = new THREE.Box3().setFromObject(root);
    a.height = Math.max(0.4, box.max.y - box.min.y);
    a.facing = e.k === 'n' ? 0 : DIR_ANGLE[e.dir || 0];
    root.position.set(e.rx, 0, e.ry);
    this.scene.add(root);
    this.actors.set(e.id, a);
    return a;
  }

  itemModel(e) {
    const root = new THREE.Group();
    const base = ITEMS[e.i];
    const r = e.r || 0;
    const color = base && base.type === 'quest' ? '#f1c40f' : RARITY[r].color;
    const mesh = this.lootMesh(base);
    let sp = null;
    if (mesh) root.add(mesh);
    else {
      let tex = this.iconTex.get(e.i);
      if (!tex) {
        tex = new THREE.TextureLoader().load(itemIcon(e.i, 48));
        tex.colorSpace = THREE.SRGBColorSpace;
        this.iconTex.set(e.i, tex);
      }
      sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
      sp.scale.setScalar(0.55);
      sp.position.y = 0.4;
      root.add(sp);
    }
    if (r >= 1 || (base && base.type === 'quest')) {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.setScalar(mesh ? 1.1 : 0.9);
      glow.position.y = mesh ? 0.2 : 0.38;
      root.add(glow);
    }
    let beam = null;
    if (r >= 2) {
      beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 2.6, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      beam.position.y = 1.3;
      root.add(beam);
    }
    const ph = (e.id % 17) * 0.37;
    return {
      root, icon: sp,
      update: (dt, st) => {
        if (sp) sp.position.y = 0.38 + Math.sin(st.now / 400 + e.id) * 0.06;
        if (mesh) { mesh.rotation.y += dt * 0.7; mesh.position.y = 0.06 + Math.sin(st.now / 500 + ph) * 0.04; }
      },
      // só o que é próprio do item: sprites, raio de luz (geometria e texturas de ícone/brilho são compartilhadas)
      dispose() {
        root.traverse((o) => { if (o.isSprite) o.material.dispose(); });
        if (beam) { beam.geometry.dispose(); beam.material.dispose(); }
      },
    };
  }

  // Modelo 3D do item caído, quando existe (arma da classe ou material do Resource Bits)
  lootMesh(base) {
    if (!base) return null;
    let model = null;
    if (base.type === 'weapon' && LOOT_WEAPON[base.cls]) {
      const list = LOOT_WEAPON[base.cls];
      const solar = !base.unique && base.tier >= 7 && LOOT_SOLAR[base.cls];
      const name = solar && arms.has(solar) ? solar : base.unique ? list[2] : base.tier >= 4 ? list[1] : list[0];
      const lib = arms.has(name) ? arms : medieval;
      if (lib.has(name)) {
        const sz = lib.size(name);
        model = lib.mesh(name, lib.fit(name, 0.85, 0.85, 0.85));
        // armas altas ficam deitadas no chão
        if (sz.y > sz.x && sz.y > sz.z) { const lay = new THREE.Group(); lay.add(model); lay.rotation.z = Math.PI / 2; model = lay; }
      }
    } else if (LOOT_RESOURCE[base.id] && medieval.has(LOOT_RESOURCE[base.id])) {
      const name = LOOT_RESOURCE[base.id];
      model = medieval.mesh(name, medieval.fit(name, 0.45, 0.45, 0.42));
    }
    if (!model) return null;
    // centraliza no tile, apoiado no chão
    const holder = new THREE.Group();
    holder.add(model);
    const box = new THREE.Box3().setFromObject(holder);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(model.position.x - c.x, model.position.y - box.min.y, model.position.z - c.z);
    const spin = new THREE.Group();
    spin.add(holder);
    return spin;
  }

  removeActor(a) {
    this.scene.remove(a.model.root);
    if (a.model.dispose) a.model.dispose();
  }

  entityHeight(e) {
    const a = this.actors.get(e.id);
    if (a) return a.height;
    return e.k === 'i' ? 0.6 : 1.5;
  }

  syncActors(dt, now) {
    const g = this.game;
    for (const e of g.entities.values()) {
      let a = this.actors.get(e.id);
      if (!a) a = this.createActor(e);
      if (!a) continue;
      const root = a.model.root;
      root.visible = !(this.camMode === 'first' && e.id === g.me.id);
      root.position.set(e.rx, (a.float || 0) + (e.lift || 0), e.ry);
      if (a.kind === 'item') { a.model.update(dt, { now }); continue; }
      // orientação
      let want = a.facing;
      if (e.id === g.me.id) want = g.me.facing ?? want;
      else if (e.k === 'n') want = g.dialogNpc === e.n ? Math.atan2(g.me.x - e.rx, g.me.y - e.ry) : 0;
      else if (e.faceTarget && now - e.faceAt < 1500 && g.entities.get(e.faceTarget)) {
        const t = g.entities.get(e.faceTarget);
        want = Math.atan2(t.rx - e.rx, t.ry - e.ry);
      } else if (e.moving && e.vx != null && Math.hypot(e.vx, e.vy) > 0.05) want = Math.atan2(e.vx, e.vy);
      else if (!e.moving && now - (e.lastMoveAt || 0) > 400) want = DIR_ANGLE[e.dir || 0] ?? want;
      a.facing = want;
      root.rotation.y = lerpAngle(root.rotation.y, want, 1 - Math.exp(-dt * 14));
      const dead = !!(e.f & F.DEAD);
      const st = { now, moving: e.moving && !dead, speed: e.spd || 0, phase: e.phase, dead, deathStart: e.deathStart, atkStart: e.atkStart, hurt: e.hurt, lit: e.n === 'altar' && g.questDone('ms19') };
      // longe do jogador a animação é atualizada menos vezes (com o tempo acumulado), o que poupa CPU em quem tem muita gente por perto
      const far = Math.max(Math.abs(e.rx - g.me.x), Math.abs(e.ry - g.me.y));
      a.acc = (a.acc || 0) + dt;
      if (e.id !== g.me.id && far > 14 && (this.frameNo + (e.id | 0)) % (far > 28 ? 4 : 2) !== 0) { /* pula este quadro */ } else { a.model.update(a.acc, st); a.acc = 0; }
      // monstros mortos desaparecem
      if (dead && e.k === 'm' && a.kind === 'char') a.model.setOpacity(Math.max(0, 1 - (now - (e.deathStart || now)) / 1600));
      else if (a.kind === 'char' && e.k === 'p') a.model.setOpacity(e.f & F.INVULN ? 0.5 : 1);
    }
    for (const [id, a] of this.actors) {
      if (!g.entities.has(id)) { this.removeActor(a); this.actors.delete(id); }
    }
  }

  // ------------------------------------------------------------------ câmera e luz
  updateCamera(dt) {
    const g = this.game;
    const me = g.myEntity();
    const tx = me ? me.rx : g.me.x, tz = me ? me.ry : g.me.y;
    const k = 1 - Math.exp(-dt * 10);
    // em 1ª pessoa a câmera cola no personagem (sem atraso); nos outros modos ela o segue suavemente
    const kk = this.camMode === 'first' ? 1 : k;
    this.camTarget.x = lerp(this.camTarget.x, tx, kk);
    this.camTarget.z = lerp(this.camTarget.z, tz, kk);
    const c = this.camTarget;
    if (this.camMode === 'first') {
      // olhos do personagem: câmera na cabeça, olhando na direção do giro
      c.x = tx; c.z = tz; c.y = 1.32;
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      this.camera.position.set(c.x - Math.sin(this.yaw) * 0.12, c.y, c.z - Math.cos(this.yaw) * 0.12);
      this.camera.lookAt(this.camera.position.x - Math.sin(this.yaw) * cp, this.camera.position.y - sp, this.camera.position.z - Math.cos(this.yaw) * cp);
    } else {
      c.y = this.camMode === 'near' ? 1.15 : 0.8;
      const d = this.dist;
      this.camera.position.set(c.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d, c.y + Math.sin(this.pitch) * d, c.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d);
      this.camera.lookAt(c);
    }
    if (g.shake > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * g.shake * 0.02, (Math.random() - 0.5) * g.shake * 0.02, 0));
  }

  updateLights(now, t) {
    const dark = this.darkness();
    const at = this.atmos;
    const sky = new THREE.Color(at.day).lerp(new THREE.Color(at.night), dark);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    const zoomK = this.dist / 15;
    this.scene.fog.near = at.fog[0] * Math.max(1, zoomK * 0.9) * Q.farMul;
    this.scene.fog.far = at.fog[1] * Math.max(1, zoomK * 0.9) * Q.farMul;
    // nada além da névoa precisa ser desenhado
    const far = this.scene.fog.far + 25;
    if (Math.abs(this.camera.far - far) > 2) { this.camera.far = far; this.camera.updateProjectionMatrix(); }
    const cave = this.game.zone.def.gen.type === 'cave';
    // com o céu HDR ligado ele faz parte da luz ambiente: some de noite e nas cavernas
    const env = this.envOn ? (cave ? 0.04 : lerp(0.5, 0.08, dark)) : 0;
    if (this.envOn) this.scene.environmentIntensity = env;
    this.hemi.intensity = lerp(cave ? 0.9 : 1.7, 0.45, dark) * (this.envOn && !cave ? lerp(0.8, 1, dark) : 1);
    this.hemi.color.set(0xfff4e0).lerp(new THREE.Color(0x7080c0), dark);
    this.hemi.groundColor.set(this.game.zone.id === 'ruins' ? 0x5a3a30 : 0x4a5a3a).lerp(new THREE.Color(0x1a2030), dark);
    this.sun.intensity = lerp(cave ? 0.8 : 2.4, 0.45, dark);
    this.sun.color.set(0xfff1d6).lerp(new THREE.Color(0x8fa6ff), dark);
    const c = this.camTarget;
    this.sun.position.set(c.x - 14, 26, c.z + 10);
    this.sun.target.position.set(c.x, 0, c.z);
    // luz do jogador à noite
    const me = this.game.myEntity();
    if (me) this.playerLight.position.set(me.rx, 2.2, me.ry);
    this.playerLight.intensity = dark * 9;
    if (Q.fuse) { this.playerLight.color.set(0xffe0b0); this.playerLight.distance = 12; }
    // pool de luzes: tochas e efeitos mais próximos
    if (now - this.lastLightPick > 150) {
      this.lastLightPick = now;
      const cands = [];
      if (dark > 0.05) for (const L of this.lights) {
        const dd = (L.x - c.x) ** 2 + (L.z - c.z) ** 2;
        if (dd < 900) cands.push({ ...L, dd, c: L.lava ? '#ff5a1e' : L.o === 8 ? '#b57edc' : '#ffa84a', i: (L.lava ? 6 : 10) * dark, d: L.r * 1.7 });
      }
      const fxl = [];
      this.fx.lights(fxl);
      for (const L of fxl) cands.push({ ...L, dd: -1 });
      cands.sort((a, b) => a.dd - b.dd);
      this.picked = cands.slice(0, this.pool.length);
    }
    this.pool.forEach((l, i) => {
      const L = this.picked && this.picked[i];
      if (!L) { l.intensity = 0; return; }
      l.position.set(L.x, L.y, L.z);
      l.color.set(L.c);
      l.distance = L.d;
      const flick = L.dd >= 0 && !L.lava ? 0.9 + Math.sin(t * 11 + L.x) * 0.06 + Math.sin(t * 7 + L.z) * 0.05 : 1;
      l.intensity = L.i * flick;
    });
    this.zoneScene.update(t, dark, sky, this._sunDir.set(-14, 26, 10));
  }

  updateRings(t) {
    const g = this.game;
    const tg = g.entities.get(g.target);
    const place = (ring, e) => {
      if (!e || e.k === 'i') { ring.visible = false; return; }
      const a = this.actors.get(e.id);
      const s = e.k === 'm' ? Math.max(1, MONSTERS[e.m].size) : 1;
      ring.visible = true;
      ring.position.set(e.rx, 0.04, e.ry);
      ring.scale.setScalar(s * (1 + Math.sin(t * 4) * 0.04));
      ring.rotation.y = t;
      return a;
    };
    place(this.targetRing, tg);
    if (tg) this.targetRing.material.color.set(tg.k === 'm' || g.isHostile(tg) ? 0xff4040 : 0x58d68d);
    place(this.hoverRing, g.hover && g.hover !== tg ? g.hover : null);
  }

  render(t) {
    const g = this.game;
    if (!g.zone || !this.zoneScene) return;
    const now = performance.now();
    const raw = (now - (this.lastRender || now)) / 1000;
    const dt = Math.min(0.1, raw);
    this.lastRender = now;
    this.autoQuality(raw);
    this.meter(raw);
    if (this.bench) this.stepBench(raw);
    this.frameNo = (this.frameNo || 0) + 1;
    this.syncActors(dt, now);
    this.updateCamera(dt);
    this.updateLights(now, t);
    this.updateRings(t);
    this.zoneScene.cull(g.me.x, g.me.y);
    this.updateRoom(dt, now);
    this.guideFx.update(g.guide, g.me, t, g.zone.id);
    updateSeeThrough(this.camera, g.me.x, g.me.y, this.W, this.H, this.dpr, this.dist, this.camMode === 'first', this.room);
    this.zoneScene.prepareWater(this.renderer, this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
    this.overlay.draw(t);
  }

  // Dentro de uma casa: some o telhado (câmera de fora), as portas abrem e uma luz quente acende
  updateRoom(dt, now) {
    const g = this.game;
    const map = g.zone.map;
    const room = map.rooms ? roomAt(map, g.me.x, g.me.y, this.room ? 0.35 : -0.05) : null;
    if (room !== this.room) {
      this.room = room;
      if (room && room.st.label && now - (this.lastRoomToast || 0) > 4000) { this.lastRoomToast = now; g.ui.toast(`Você entrou: ${room.st.label}`, 'info'); }
    }
    this.zoneScene.setIndoor(room, this.camMode !== 'first');
    this.zoneScene.updateDoors(g.me.x, g.me.y, dt);
    const L = this.roomLight;
    if (Q.fuse) {
      // luz única: dentro de uma casa vira a luz quente do cômodo
      if (room) {
        L.position.set((room.inner[0] + room.inner[2]) / 2, 2.0, (room.inner[1] + room.inner[3]) / 2);
        L.color.set(0xffcf94); L.distance = Math.max(room.inner[2] - room.inner[0], room.inner[3] - room.inner[1]) * 0.8 + 2; L.intensity = 9;
      }
      return;
    }
    if (room) { L.position.set((room.inner[0] + room.inner[2]) / 2, 2.0, (room.inner[1] + room.inner[3]) / 2); L.distance = Math.max(room.inner[2] - room.inner[0], room.inner[3] - room.inner[1]) * 0.8 + 2; }
    const target = room ? 9 : 0;
    L.intensity += (target - L.intensity) * Math.min(1, dt * 6);
    if (L.intensity < 0.02) L.intensity = 0;
  }

  // Ajuste automático durante o jogo (Opções > Gráficos): se rodar lento, limita a 30 quadros, reduz a resolução, desliga as sombras
  // e, no perfil Automático, rebaixa o perfil de vez (lembrado nas próximas vezes).
  autoQuality(raw) {
    if (!Q.adapt || this.qualityDone || raw <= 0 || raw > 0.5) return;
    this.fpsT = (this.fpsT || 0) + raw;
    this.fpsN = (this.fpsN || 0) + 1;
    if (this.fpsT < 5) return;
    const fps = this.fpsN / this.fpsT;
    this.fpsT = 0; this.fpsN = 0;
    if (Q.low && this.frameGap < 33 && fps < 42) { this.frameGap = 33; return; } // 30 quadros firmes valem mais que 35 irregulares
    if (fps >= 28) { this.qualityDone = true; return; }
    if (this.dpr > 1) { this.maxDpr = 1; this.resize(); return; } // 1º passo: resolução menor
    if (this.shadows) {
      this.setShadows(false);
      this.game.ui.toast('Sombras desligadas para melhorar o desempenho (Opções > Gráficos para religar).');
      return; // mede de novo antes de ir mais longe
    }
    if (this.dpr > 0.8) { this.maxDpr = 0.8; this.resize(); return; }
    // último recurso: perfil automático um degrau abaixo (vale também nas próximas vezes)
    if (fps < 24) {
      const lower = lowerAutoPreset();
      if (lower) {
        this.game.ui.toast(`Gráficos reduzidos para "${PRESET_NAMES[lower]}" para o jogo rodar melhor (Opções > Gráficos).`);
        return;
      }
    }
    this.qualityDone = true;
  }

  // ------------------------------------------------------------------ medidor de FPS e teste de desempenho
  setFpsMeter(on) {
    if (!on) { if (this.fpsEl) this.fpsEl.style.display = 'none'; return; }
    if (!this.fpsEl) {
      this.fpsEl = document.createElement('div');
      this.fpsEl.id = 'fps-meter';
      document.body.appendChild(this.fpsEl);
    }
    this.fpsEl.style.display = '';
  }

  meter(raw) {
    if (raw > 1) return; // aba em segundo plano
    this.mT = (this.mT || 0) + raw; this.mN = (this.mN || 0) + 1;
    if (this.mT < 0.5) return;
    if (this.fpsEl && this.fpsEl.style.display !== 'none') {
      const info = this.renderer.info.render;
      const fps = this.mN / this.mT;
      this.fpsEl.textContent = `${fps.toFixed(0)} FPS · ${(1000 / fps).toFixed(1)} ms\n3D ${Math.round(this.W * this.dpr)}×${Math.round(this.H * this.dpr)} (${this.dpr.toFixed(2)}×) · ${info.calls} chamadas · ${(info.triangles / 1000).toFixed(0)} mil tri`;
    }
    this.mT = 0; this.mN = 0;
  }

  // Mede o desempenho por `seconds` segundos; done({ avg, low }) com a média e a média dos 5% piores quadros (em FPS)
  startBench(seconds, done, progress) {
    this.bench = { t: 0, frames: [], seconds, done, progress };
  }

  stepBench(raw) {
    const b = this.bench;
    if (raw > 0 && raw < 1) b.frames.push(raw);
    b.t += raw;
    if (b.progress) b.progress(Math.min(1, b.t / b.seconds));
    if (b.t < b.seconds) return;
    this.bench = null;
    const f = b.frames.sort((x, y) => y - x);
    const n = f.length || 1;
    const worst = f.slice(0, Math.max(1, Math.floor(n * 0.05)));
    b.done({ avg: n / (f.reduce((s, x) => s + x, 0) || 1), low: worst.length / (worst.reduce((s, x) => s + x, 0) || 1), frames: f.length });
  }

  // ------------------------------------------------------------------ projeções e seleção
  worldToScreen(wx, wy, h = 0) {
    const v = new THREE.Vector3(wx, h, wy).project(this.camera);
    return { x: (v.x + 1) / 2 * this.W, y: (1 - v.y) / 2 * this.H, behind: v.z > 1 };
  }

  screenToWorld(sx, sy) {
    const ndc = new THREE.Vector2((sx / this.W) * 2 - 1, -(sy / this.H) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, p)) return { x: this.game.me.x, y: this.game.me.y };
    return { x: p.x, y: p.z };
  }

  pick(sx, sy) {
    const g = this.game;
    let best = null, bestD = Infinity;
    const cam = this.camera.position;
    for (const e of g.entities.values()) {
      if (e.id === g.me.id) continue;
      if (e.k === 'm' && (e.f & F.DEAD)) continue;
      const a = this.actors.get(e.id);
      if (!a) continue;
      const foot = this.worldToScreen(e.rx, e.ry, 0);
      if (foot.behind) continue;
      if (e.k === 'i') {
        const p = this.worldToScreen(e.rx, e.ry, 0.4);
        if (Math.hypot(sx - p.x, sy - p.y) < 22) {
          const d = cam.distanceTo(new THREE.Vector3(e.rx, 0, e.ry)) - 2;
          if (d < bestD) { bestD = d; best = e; }
        }
        continue;
      }
      const head = this.worldToScreen(e.rx, e.ry, a.height);
      const ppu = Math.abs(foot.y - head.y) / a.height;
      const halfW = Math.max(16, ppu * 0.4 * (e.k === 'm' ? Math.max(1, MONSTERS[e.m].size) : 1));
      if (sx > foot.x - halfW && sx < foot.x + halfW && sy > head.y - 6 && sy < foot.y + 8) {
        const d = cam.distanceTo(new THREE.Vector3(e.rx, a.height / 2, e.ry));
        if (d < bestD) { bestD = d; best = e; }
      }
    }
    return best;
  }
}

function loadStr(k, def) {
  try { return localStorage.getItem('aethra_' + k) || def; } catch { return def; }
}
function saveStr(k, v) {
  try { localStorage.setItem('aethra_' + k, v); } catch { /* ignorado */ }
}
