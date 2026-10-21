// Personagens 3D KayKit (CC0): carregamento, armas, variações de cor e animações por esqueleto.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const BASE = '/kaykit/';
const MODELS = ['Barbarian', 'Knight', 'Mage', 'Ranger', 'Rogue', 'Rogue_Hooded'];
const WEAPONS = ['axe_2handed', 'sword_1handed', 'shield_badge_color', 'staff', 'bow_withString', 'dagger', 'wand', 'spellbook_open', 'shield_round_barbarian'];
const TARGET_HEIGHT = 1.45; // altura de um humano adulto em tiles

// Aparências: modelo, armas, variação de cor (matiz em graus, saturação, brilho), escala e brilho emissivo.
export const LOOKS = {
  // classes jogáveis
  warrior: { model: 'Barbarian', right: 'axe_2handed' },
  mage: { model: 'Mage', right: 'staff' },
  ranger: { model: 'Ranger', left: 'bow_withString' },
  cleric: { model: 'Knight', right: 'sword_1handed', left: 'shield_badge_color' },
  // NPCs
  thalric: { model: 'Mage', right: 'staff', hue: 190, sat: 0.7 },
  bran: { model: 'Knight', right: 'sword_1handed', left: 'shield_badge_color', hue: -20 },
  lyra: { model: 'Ranger', left: 'bow_withString', hue: 40 },
  otto: { model: 'Rogue', hue: 25, sat: 1.1 },
  brunhilda: { model: 'Barbarian', right: 'axe_2handed', hue: 15, bright: 1.1 },
  fenwick: { model: 'Mage', left: 'spellbook_open', hue: 270 },
  marta: { model: 'Rogue_Hooded', hue: 300, sat: 0.8 },
  ilyas: { model: 'Mage', right: 'staff', hue: 160 },
  pip: { model: 'Ranger', scale: 0.62, hue: 180 },
  rurik: { model: 'Barbarian', right: 'axe_2handed', hue: -10, bright: 0.85 },
  osric: { model: 'Mage', right: 'staff', sat: 0.25, bright: 0.85 },
  gustavo: { model: 'Barbarian', hue: 45, sat: 0.8 },
  sylvara: { model: 'Ranger', right: 'staff', hue: 75 },
  kael: { model: 'Rogue', right: 'dagger', left: 'dagger' },
  durgan: { model: 'Barbarian', right: 'axe_2handed', scale: 0.8, hue: -15 },
  greta: { model: 'Barbarian', scale: 0.76, hue: 50, bright: 1.1 },
  elira: { model: 'Knight', right: 'sword_1handed', left: 'shield_badge_color', sat: 0.4, bright: 1.25 },
  cael: { model: 'Rogue_Hooded', hue: 200, sat: 0.6 },
  // inimigos humanoides
  cultist: { model: 'Rogue_Hooded', right: 'wand', left: 'spellbook_open', hue: 150, sat: 0.9, bright: 0.75 },
  ash_knight: { model: 'Knight', right: 'sword_1handed', left: 'shield_badge_color', sat: 0.3, bright: 0.5, emissive: [0.35, 0.06, 0.0] },
  skeleton: { model: 'Knight', right: 'sword_1handed', sat: 0, bright: 1.35 },
  skeleton_archer: { model: 'Ranger', left: 'bow_withString', sat: 0, bright: 1.3 },
  goblin: { model: 'Rogue', right: 'dagger', scale: 0.72, hue: 70, sat: 1.2 },
  goblin_shaman: { model: 'Mage', right: 'staff', scale: 0.72, hue: 95, sat: 1.1 },
  morvath: { model: 'Knight', right: 'staff', sat: 0.15, bright: 0.6, emissive: [0.4, 0.08, 0.02], float: 0.35 },
};

const CASTERS = new Set(['mage', 'thalric', 'fenwick', 'ilyas', 'osric', 'sylvara', 'cultist', 'goblin_shaman', 'morvath', 'cleric']);

const CLIPS = {
  idle: 'Idle_A', walk: 'Walking_A', run: 'Running_A', attack: 'Throw', cast: 'Use_Item',
  hit: 'Hit_A', death: 'Death_A', spawn: 'Spawn_Ground',
};

class CharacterLibrary {
  constructor() {
    this.models = {};
    this.weapons = {};
    this.clips = {};
    this.ready = false;
  }

  async load(onProgress = () => {}) {
    const loader = new GLTFLoader();
    const load = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));
    const jobs = [
      ...MODELS.map((m) => ['model', m, `${BASE}characters/${m}.glb`]),
      ...WEAPONS.map((w) => ['weapon', w, `${BASE}weapons/${w}.gltf`]),
      ['anim', 'general', `${BASE}animations/Rig_Medium_General.glb`],
      ['anim', 'move', `${BASE}animations/Rig_Medium_MovementBasic.glb`],
    ];
    let done = 0;
    await Promise.all(jobs.map(async ([kind, name, url]) => {
      const g = await load(url);
      if (kind === 'model') {
        g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
        const box = new THREE.Box3().setFromObject(g.scene);
        this.models[name] = { scene: g.scene, height: box.max.y - box.min.y };
      } else if (kind === 'weapon') {
        g.scene.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        this.weapons[name] = g.scene;
      } else {
        for (const c of g.animations) this.clips[c.name] = c;
      }
      onProgress(++done / jobs.length);
    }));
    this.ready = true;
  }

  has(key) { return this.ready && !!LOOKS[key]; }

  // Aplica variação de cor (matiz/saturação/brilho) via shader em um material próprio.
  applyTint(m, look) {
    const hue = ((look.hue || 0) * Math.PI) / 180;
    const sat = look.sat ?? 1, bright = look.bright ?? 1;
    if (look.emissive && m.emissive) m.emissive = new THREE.Color(...look.emissive);
    if (!hue && sat === 1 && bright === 1) return m;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uHue = { value: hue };
      shader.uniforms.uSat = { value: sat };
      shader.uniforms.uBright = { value: bright };
      shader.fragmentShader = 'uniform float uHue; uniform float uSat; uniform float uBright;\n' + shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float a = cos(uHue), b = sin(uHue);
          vec3 r = vec3(
            dot(c, vec3(0.213 + 0.787 * a - 0.213 * b, 0.715 - 0.715 * a - 0.715 * b, 0.072 - 0.072 * a + 0.928 * b)),
            dot(c, vec3(0.213 - 0.213 * a + 0.143 * b, 0.715 + 0.285 * a + 0.140 * b, 0.072 - 0.072 * a - 0.283 * b)),
            dot(c, vec3(0.213 - 0.213 * a - 0.787 * b, 0.715 - 0.715 * a + 0.715 * b, 0.072 + 0.928 * a + 0.072 * b)));
          float l = dot(r, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = max(mix(vec3(l), r, uSat) * uBright, 0.0);
        }`);
    };
    m.customProgramCacheKey = () => `tint:${hue.toFixed(3)}:${sat}:${bright}`;
    return m;
  }

  // Cria uma instância animada de um personagem.
  create(key) {
    const look = LOOKS[key];
    const src = this.models[look.model];
    const model = SkeletonUtils.clone(src.scene);
    const mats = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      // material próprio (variação de cor e brilho de dano por instância)
      o.material = this.applyTint(o.material.clone(), look);
      mats.push(o.material);
    });
    for (const [side, bone] of [['right', 'handslotr'], ['left', 'handslotl']]) {
      if (!look[side]) continue;
      let slot = null;
      model.traverse((o) => { if (!slot && o.name.replace(/[._]/g, '').toLowerCase() === bone) slot = o; });
      if (slot) {
        const w = this.weapons[look[side]].clone();
        w.traverse((o) => { if (o.isMesh) { o.material = this.applyTint(o.material.clone(), look); mats.push(o.material); } });
        slot.add(w);
      }
    }
    const root = new THREE.Group();
    const scale = (TARGET_HEIGHT / src.height) * (look.scale || 1);
    model.scale.setScalar(scale);
    root.add(model);
    return new CharacterActor(root, model, mats, key, this.clips, look);
  }
}

class CharacterActor {
  constructor(root, model, mats, key, clips, look) {
    this.root = root;
    this.model = model;
    this.mats = mats;
    this.key = key;
    this.look = look;
    this.caster = CASTERS.has(key);
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const [name, clipName] of Object.entries(CLIPS)) {
      const clip = clips[clipName];
      if (!clip) continue;
      const a = this.mixer.clipAction(clip);
      if (['attack', 'cast', 'hit', 'death', 'spawn'].includes(name)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions[name] = a;
    }
    this.state = null;
    this.baseEmissive = mats.map((m) => (m.emissive ? m.emissive.clone() : null));
    this.play('idle');
  }

  play(name, fade = 0.15) {
    const next = this.actions[name];
    if (!next) return;
    const cur = this.actions[this.state];
    if (this.state === name && !['attack', 'cast', 'hit'].includes(name)) return;
    next.reset();
    next.setEffectiveWeight(1);
    next.play();
    if (cur && cur !== next) cur.crossFadeTo(next, fade, false);
    this.state = name;
  }

  // st: { moving, speed, dead, atkStart, hurt, now }
  update(dt, st) {
    const now = st.now;
    let want;
    if (st.dead) want = 'death';
    else if (st.atkStart && now - st.atkStart < 650) want = this.caster ? 'cast' : 'attack';
    else if (st.hurt && now - st.hurt < 300 && !st.moving) want = 'hit';
    else if (st.moving) want = st.speed > 3.4 ? 'run' : 'walk';
    else want = 'idle';
    if (want === 'attack' || want === 'cast') {
      if (this.lastAtk !== st.atkStart) { this.lastAtk = st.atkStart; this.play(want, 0.08); this.actions[want].timeScale = 1.6; }
    } else if (want === 'hit') {
      if (this.lastHurt !== st.hurt && this.state !== 'attack' && this.state !== 'cast') { this.lastHurt = st.hurt; this.play('hit', 0.06); }
    } else if (want === 'death') {
      if (this.state !== 'death') this.play('death', 0.1);
    } else if (this.state !== want) {
      // ataques terminam antes de voltar ao ciclo
      const cur = this.actions[this.state];
      const busy = (this.state === 'attack' || this.state === 'cast') && cur && cur.isRunning() && cur.time < cur.getClip().duration * 0.7;
      if (!busy || st.moving) this.play(want, 0.18);
    }
    if (this.state === 'walk') this.actions.walk.timeScale = Math.max(0.6, Math.min(1.8, st.speed / 2.2));
    if (this.state === 'run') this.actions.run.timeScale = Math.max(0.7, Math.min(1.5, st.speed / 4.6));
    this.mixer.update(dt);
    // brilho vermelho ao sofrer dano
    const flash = st.hurt ? Math.max(0, 1 - (now - st.hurt) / 200) : 0;
    if (flash > 0 || this.flashing) {
      this.mats.forEach((m, i) => {
        if (!m.emissive) return;
        const base = this.baseEmissive[i];
        m.emissive.setRGB(base.r + flash * 0.6, base.g + flash * 0.12, base.b + flash * 0.1);
      });
      this.flashing = flash > 0;
    }
  }

  setOpacity(a) {
    for (const m of this.mats) { m.transparent = a < 1; m.opacity = a; }
  }

  dispose() {
    this.mixer.stopAllAction();
  }
}

export const characters = new CharacterLibrary();
