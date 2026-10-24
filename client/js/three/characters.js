// Personagens 3D KayKit (CC0): carregamento, armas, variações de cor e animações por esqueleto.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { arms } from './arms.js';
import { buildMace } from './mace.js';
import { recolorImage } from './recolor.js';
import { buildHalo, attachToHead } from './halo.js';

const BASE = '/kaykit/';
const MODELS = ['Barbarian', 'Knight', 'Mage', 'Ranger', 'Rogue', 'Rogue_Hooded',
  'Skeleton_Warrior', 'Skeleton_Minion', 'Skeleton_Rogue', 'Skeleton_Mage'];
const WEAPONS = ['axe_2handed', 'sword_1handed', 'shield_badge_color', 'staff', 'bow_withString', 'dagger', 'wand', 'spellbook_open', 'shield_round_barbarian',
  'Skeleton_Axe', 'Skeleton_Blade', 'Skeleton_Crossbow', 'Skeleton_Staff', 'Skeleton_Shield_Large_A', 'Skeleton_Shield_Small_A',
  'sword_2handed', 'sword_2handed_color', 'axe_1handed'];
const TARGET_HEIGHT = 1.45; // altura de um humano adulto em tiles
// Zumbi (Kenney, CC0, reempacotado pelo Brackeys): o modelo e cada animação vêm em um GLB; só tem parado, correndo e pulando
const ZOMBIE_BASE = '/brackeys/zombie/';

// Aparências: modelo, armas, variação de cor (matiz em graus, saturação, brilho), escala e brilho emissivo.
// Mortos-vivos: eyes = cor do brilho dos olhos; rise = sobem do chão ao aparecer; ghost = translúcido.
// Corpo de adulto sobre o esqueleto atual (cabeçudo, de pernas curtas): cabeça menor, tronco, pernas e braços bem mais longos e
// ombros um pouco mais largos. Mexe só na escala dos ossos, então todas as animações e as armas nas mãos continuam valendo.
// Cada osso herda a escala do pai, então os filhos recebem a escala que desfaz o que herdaram.
export const ADULT = { head: 0.45, torso: 1.1, shoulder: 1.0, legs: 3.0, arms: 1.55, width: 1.0 };
function adultProportions(model) {
  const A = ADULT, hy = Math.sqrt(A.torso), hx = Math.sqrt(A.shoulder);
  model.traverse((o) => {
    if (!o.isBone) return;
    switch (o.name.replace(/[._]/g, '').toLowerCase()) {
      case 'spine': case 'chest': o.scale.set(hx, hy, hx); break;
      case 'head': o.scale.set(A.head / A.shoulder, A.head / A.torso, A.head / A.shoulder); break;
      case 'upperarml': case 'upperarmr': o.scale.set(1 / A.shoulder, A.arms / A.torso, 1 / A.shoulder); break;
      case 'handl': case 'handr': o.scale.set(1, 1 / A.arms, 1); break;
      case 'upperlegl': case 'upperlegr': o.scale.set(1, A.legs, 1); break;
      case 'footl': case 'footr': o.scale.set(1, 1 / A.legs, 1); break;
      default:
    }
  });
}

export const LOOKS = {
  // classes jogáveis
  warrior: { model: 'Knight', right: 'sword_1handed', left: 'shield_badge_color' },
  berserker: { model: 'Barbarian', right: 'axe_2handed' },
  mage: { model: 'Mage', right: 'staff' },
  ranger: { model: 'Ranger', left: 'bow_withString' },
  cleric: { model: 'Mage', right: '@mace', left: 'spellbook_open', hide: ['Hat'], recolor: 'cleric', halo: true },
  assassin: { model: 'Rogue_Hooded', right: 'dagger', left: 'dagger', recolor: 'assassin' },
  // cavaleiro da cena de abertura (acampamento das telas de login)
  hero_camp: { model: 'Knight', right: 'sword_1handed', hue: 215 },
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
  skeleton: { model: 'Skeleton_Minion', right: 'Skeleton_Axe', eyes: [0.35, 0.75, 1.0], rise: true },
  skeleton_archer: { model: 'Skeleton_Rogue', right: 'Skeleton_Crossbow', eyes: [0.45, 1.0, 0.55], rise: true },
  skeleton_guard: { model: 'Skeleton_Warrior', right: 'Skeleton_Blade', left: 'Skeleton_Shield_Large_A', scale: 1.12, eyes: [1.0, 0.45, 0.12], rise: true },
  wraith: { model: 'Skeleton_Mage', right: 'Skeleton_Staff', eyes: [0.4, 1.0, 0.95], ghost: true, float: 0.4, emissive: [0.05, 0.16, 0.2], spawnClip: 'Spawn_Air' },
  goblin: { model: 'Rogue', right: 'dagger', scale: 0.72, hue: 70, sat: 1.2 },
  goblin_shaman: { model: 'Mage', right: 'staff', scale: 0.72, hue: 95, sat: 1.1 },
  // Reino de Sahaar: NPCs
  soraya: { model: 'Mage', right: 'staff', hue: 45, sat: 1.25, bright: 1.25 },
  jamil: { model: 'Rogue', hue: 15, sat: 1.3, bright: 1.1 },
  dahmir: { model: 'Barbarian', right: 'Hammer_Double', hue: 28, sat: 0.9, bright: 0.85, scale: 1.05 },
  safiya: { model: 'Mage', left: 'spellbook_open', hue: 165, sat: 0.9 },
  karim: { model: 'Ranger', left: 'bow_withString', hue: 25, sat: 0.9, bright: 1.15 },
  nefer: { model: 'Rogue_Hooded', hue: 160, sat: 1.0, bright: 1.15 },
  // Reino de Sahaar: inimigos (escorpiões são criaturas procedurais em creatures.js; mumia e guardião são mortos-vivos)
  sand_bandit: { model: 'Rogue', right: 'Scimitar', left: 'Falchion', hue: 35, sat: 1.35, bright: 0.95 },
  dune_sorcerer: { model: 'Mage', right: 'staff', hue: 18, sat: 1.5, bright: 1.05, emissive: [0.08, 0.03, 0] },
  mummy: { kind: 'zombie', rise: true, hue: 38, sat: 0.4, bright: 1.5 },
  tomb_guard: { model: 'Skeleton_Warrior', right: 'Sword_Golden', left: 'Shield_Celtic_Golden', scale: 1.12, tint: [1.7, 1.3, 0.45], eyes: [1.0, 0.8, 0.2], emissive: [0.12, 0.08, 0], rise: true },
  sun_king: { model: 'Skeleton_Mage', right: 'Skeleton_Staff', tint: [1.9, 1.45, 0.35], eyes: [1.0, 0.85, 0.25], emissive: [0.4, 0.26, 0.02], float: 0.35, spawnClip: 'Spawn_Air' },
  // zumbis (Ruínas de Cinza): sobem do chão ao aparecer; kind 'zombie' usa o modelo do Kenney em vez do KayKit
  zombie: { kind: 'zombie', rise: true },
  zombie_brute: { kind: 'zombie', rise: true, hue: -40, sat: 1.15, bright: 0.72 },
  morvath: { model: 'Knight', right: 'staff', sat: 0.15, bright: 0.6, emissive: [0.4, 0.08, 0.02], float: 0.35 },
  // Oeste de Alvorada: Pântano das Brumas e Catacumbas Afogadas
  garrett: { model: 'Ranger', left: 'bow_withString', hue: -35, sat: 0.8, bright: 0.85 },
  zelia: { model: 'Mage', right: 'staff', hue: -115, sat: 0.6, bright: 0.85, scale: 0.92 },
  beatriz: { model: 'Mage', right: 'staff', hide: ['Hat'], sat: 0.15, bright: 1.4 },
  bog_witch: { model: 'Mage', right: 'staff', scale: 0.92, hue: -115, sat: 1.1, bright: 0.85 },
  drowned: { kind: 'zombie', rise: true, hue: 75, sat: 0.8, bright: 0.9 },
  drowned_skeleton: { model: 'Skeleton_Minion', right: 'Skeleton_Axe', tint: [0.55, 1.1, 1.0], eyes: [0.3, 1.0, 0.85], rise: true },
  ghoul: { kind: 'zombie', rise: true, hue: 20, sat: 0.35, bright: 1.35 },
  bone_priest: { model: 'Skeleton_Mage', right: 'Skeleton_Staff', tint: [0.85, 0.7, 1.2], eyes: [0.7, 0.35, 1.0], emissive: [0.08, 0.03, 0.14], rise: true },
  crypt_warden: { model: 'Skeleton_Warrior', right: 'Skeleton_Blade', left: 'Skeleton_Shield_Large_A', scale: 1.2, tint: [0.55, 1.0, 1.0], eyes: [0.3, 1.0, 0.85], rise: true },
  valdric: { model: 'Skeleton_Warrior', right: 'sword_2handed', left: 'Skeleton_Shield_Large_A', scale: 1.15, tint: [0.5, 1.15, 1.05], eyes: [0.3, 1.0, 0.85], emissive: [0, 0.16, 0.14], rise: true },
  // Norte de Alvorada: Picos Gelados e Cidadela de Gelo
  ysolde: { model: 'Mage', left: 'spellbook_open', hue: 300, sat: 0.7 },
  anselmo: { model: 'Rogue_Hooded', right: 'staff', sat: 0.1, bright: 0.8 },
  hjalmar: { model: 'Barbarian', right: 'axe_2handed', hue: 200, sat: 0.6, bright: 1.15 },
  runa: { model: 'Mage', right: 'staff', hide: ['Hat'], hue: 195, sat: 0.8, bright: 1.35 },
  frost_mage: { model: 'Mage', right: 'staff', hue: 200, sat: 0.9, bright: 1.35, emissive: [0.04, 0.1, 0.2] },
  frozen_knight: { model: 'Knight', right: 'sword_1handed', left: 'shield_badge_color', hue: 205, sat: 0.6, bright: 1.45, emissive: [0.04, 0.1, 0.18] },
  frost_wraith: { model: 'Skeleton_Mage', right: 'Skeleton_Staff', tint: [0.7, 0.95, 1.35], eyes: [0.6, 0.95, 1.0], ghost: true, float: 0.4, emissive: [0.1, 0.2, 0.3], spawnClip: 'Spawn_Air' },
  kaelisa: { model: 'Mage', right: 'staff', hide: ['Hat'], hue: 200, sat: 0.7, bright: 1.6, emissive: [0.1, 0.22, 0.38], float: 0.35 },
  // Cripta da Chama Primeva
  echo_aurelion: { model: 'Knight', right: 'sword_2handed', sat: 0.1, bright: 1.7, ghost: true, emissive: [0.35, 0.3, 0.15] },
  void_knight: { model: 'Knight', right: 'sword_1handed', left: 'shield_badge_color', sat: 0.15, bright: 0.3, emissive: [0.28, 0.04, 0.38] },
  fallen_keeper: { model: 'Knight', right: 'sword_2handed', hue: 42, sat: 0.4, bright: 0.75, emissive: [0.3, 0.2, 0.0] },
};

// armas montadas em código (nome com @)
const PROCEDURAL = { '@mace': () => buildMace(THREE) };

const CASTERS = new Set(['mage', 'thalric', 'fenwick', 'ilyas', 'osric', 'sylvara', 'cultist', 'goblin_shaman', 'morvath', 'cleric', 'wraith', 'soraya', 'safiya', 'dune_sorcerer', 'sun_king',
  'ysolde', 'zelia', 'beatriz', 'runa', 'bog_witch', 'bone_priest', 'frost_mage', 'frost_wraith', 'kaelisa']);

const CLIPS = {
  idle: 'Idle_A', walk: 'Walking_A', run: 'Running_A', attack: 'Throw', cast: 'Use_Item',
  hit: 'Hit_A', death: 'Death_A', spawn: 'Spawn_Ground', spawnAir: 'Spawn_Air',
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
    // o zumbi é opcional: se os arquivos faltarem, os monstros caem no modelo simples de primitivas
    const zombie = (async () => {
      try {
        const [m, idle, run, jump] = await Promise.all(['zombie', 'zombie_idle', 'zombie_run', 'zombie_jump'].map((n) => load(`${ZOMBIE_BASE}${n}.glb`)));
        m.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
        const box = new THREE.Box3().setFromObject(m.scene);
        const clips = {};
        for (const c of [...idle.animations, ...run.animations, ...jump.animations]) clips[c.name] = c;
        if (clips.Idle && clips.Run && clips.jump) this.zombie = { scene: m.scene, height: box.max.y - box.min.y, clips };
      } catch (e) { console.warn('[personagens] zumbi indisponível', e); }
    })();
    await Promise.all([zombie, ...jobs.map(async ([kind, name, url]) => {
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
    })]);
    this.ready = true;
  }

  has(key) { return this.ready && !!LOOKS[key] && (LOOKS[key].kind !== 'zombie' || !!this.zombie); }

  // Arma solta (saque no chão), na mesma escala das armas nas mãos dos personagens
  weaponModel(name) {
    const src = this.weapons[name];
    if (!src || !this.models.Knight) return null;
    const w = src.clone();
    w.scale.setScalar(TARGET_HEIGHT / this.models.Knight.height);
    return w;
  }

  // Aplica variação de cor (matiz/saturação/brilho) via shader em um material próprio.
  applyTint(m, look) {
    const hue = ((look.hue || 0) * Math.PI) / 180;
    const sat = look.sat ?? 1, bright = look.bright ?? 1;
    const tint = look.tint || [1, 1, 1]; // multiplica a cor (dourado, por exemplo)
    if (look.emissive && m.emissive) m.emissive = new THREE.Color(...look.emissive);
    if (!hue && sat === 1 && bright === 1 && !look.tint) return m;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uHue = { value: hue };
      shader.uniforms.uSat = { value: sat };
      shader.uniforms.uBright = { value: bright };
      shader.uniforms.uTint = { value: new THREE.Vector3(...tint) };
      shader.fragmentShader = 'uniform float uHue; uniform float uSat; uniform float uBright; uniform vec3 uTint;\n' + shader.fragmentShader.replace(
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
          diffuseColor.rgb = max(mix(vec3(l), r, uSat) * uBright * uTint, 0.0);
        }`);
    };
    m.customProgramCacheKey = () => `tint:${hue.toFixed(3)}:${sat}:${bright}:${tint.join(',')}`;
    return m;
  }

  // Textura recolorida (uma por modelo e paleta; é compartilhada por todos os personagens com a mesma aparência)
  recolored(map, look) {
    this.recolorCache ||= new Map();
    const key = `${look.model}:${look.recolor}`;
    let t = this.recolorCache.get(key);
    if (!t) {
      t = new THREE.CanvasTexture(recolorImage(map.image, look.recolor));
      t.flipY = map.flipY; t.colorSpace = map.colorSpace; t.wrapS = map.wrapS; t.wrapT = map.wrapT; t.anisotropy = map.anisotropy;
      this.recolorCache.set(key, t);
    }
    return t;
  }

  // Cria uma instância animada de um personagem. opts.adult: corpo de adulto (ver adultProportions)
  create(key, opts = {}) {
    const look = LOOKS[key];
    if (look.kind === 'zombie') return this.createZombie(key, look);
    const src = this.models[look.model];
    const model = SkeletonUtils.clone(src.scene);
    const adult = !!opts.adult && !look.kind;
    if (adult) adultProportions(model);
    const mats = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      // material próprio (variação de cor e brilho de dano por instância)
      if (look.hide && look.hide.some((n) => o.name.includes(n))) { o.visible = false; return; }
      o.material = o.material.clone();
      if (look.recolor && o.material.map) o.material.map = this.recolored(o.material.map, look);
      o.material = this.applyTint(o.material, look);
      // olhos que brilham no escuro (mortos-vivos)
      if (look.eyes && /eyes/i.test(o.name)) { o.material.emissive = new THREE.Color(...look.eyes); o.material.emissiveIntensity = 2.2; o.material.userData.glow = true; }
      if (look.ghost) { o.material.transparent = true; o.material.opacity = 0.72; o.material.depthWrite = false; }
      mats.push(o.material);
    });
    for (const [side, bone] of [['right', 'handslotr'], ['left', 'handslotl']]) {
      if (!look[side]) continue;
      let slot = null;
      model.traverse((o) => { if (!slot && o.name.replace(/[._]/g, '').toLowerCase() === bone) slot = o; });
      if (slot) {
        const w = PROCEDURAL[look[side]]?.() || this.weapons[look[side]]?.clone() || arms.held(look[side]); // armas de Sahaar só existem depois que o reino carrega
        if (!w) continue;
        w.traverse((o) => { if (o.isMesh) { o.material = o.userData.notint ? o.material.clone() : this.applyTint(o.material.clone(), look); mats.push(o.material); } });
        slot.add(w);
      }
    }
    if (look.halo) attachToHead(model, buildHalo(THREE));
    const root = new THREE.Group();
    let height = src.height;
    if (adult) {
      // o corpo de adulto tem outra altura: mede de novo (uma vez por modelo) para ele continuar com TARGET_HEIGHT e pisar no chão
      this.adultBox ||= {};
      const m = this.adultBox[look.model] ||= (() => {
        model.updateMatrixWorld(true);
        model.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.update(); }); // as matrizes dos ossos só se atualizam ao desenhar
        const box = new THREE.Box3().setFromObject(model, true);
        return { height: box.max.y - box.min.y, min: box.min.y };
      })();
      height = m.height;
      model.position.y = -m.min * (TARGET_HEIGHT / height) * (look.scale || 1);
    }
    const scale = (TARGET_HEIGHT / height) * (look.scale || 1);
    model.scale.setScalar(scale);
    if (adult) model.scale.x = model.scale.z = scale * ADULT.width;
    root.add(model);
    return new CharacterActor(root, model, mats, key, adult ? this.adultClips() : this.clips, look);
  }

  // Animações sem as trilhas de escala dos ossos: elas voltariam todos os ossos para 1 a cada quadro e desfariam o corpo de adulto
  adultClips() {
    if (!this._adultClips) {
      this._adultClips = {};
      for (const [n, c] of Object.entries(this.clips)) this._adultClips[n] = new THREE.AnimationClip(c.name, c.duration, c.tracks.filter((t) => !t.name.endsWith('.scale')));
    }
    return this._adultClips;
  }

  createZombie(key, look) {
    const src = this.zombie;
    const model = SkeletonUtils.clone(src.scene);
    const mats = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = this.applyTint(o.material.clone(), look);
      mats.push(o.material);
    });
    const root = new THREE.Group();
    // altura de um humano um pouco encurvado: o modelo está de pé, de braços abertos, com 3,8 de altura
    const scale = (TARGET_HEIGHT * 1.05 / src.height) * (look.scale || 1);
    model.scale.setScalar(scale);
    root.add(model);
    return new ZombieActor(root, model, mats, key, src.clips, look, src.height * scale);
  }
}

// Zumbi do Kenney: sem clipes de andar, atacar ou morrer, então "andar" é a corrida em câmera lenta, o ataque é o pulo
// (o bote) e a morte é uma queda para trás feita à mão.
class ZombieActor {
  constructor(root, model, mats, key, clips, look, height) {
    this.root = root;
    this.model = model;
    this.mats = mats;
    this.key = key;
    this.look = look;
    this.height = height; // altura do modelo já escalada (para o buraco de onde ele sobe)
    this.born = performance.now();
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = { idle: this.mixer.clipAction(clips.Idle), run: this.mixer.clipAction(clips.Run), attack: this.mixer.clipAction(clips.jump) };
    this.actions.attack.setLoop(THREE.LoopOnce, 1);
    this.actions.attack.clampWhenFinished = true;
    this.state = null;
    this.baseEmissive = mats.map((m) => (m.emissive ? m.emissive.clone() : null));
    this.mixer.update(Math.random() * 1.0); // cada zumbi começa num ponto diferente da animação
    this.play('idle', 0);
  }

  play(name, fade = 0.2) {
    const next = this.actions[name];
    if (!next) return;
    const cur = this.actions[this.state];
    if (this.state === name && name !== 'attack') return;
    next.reset();
    next.setEffectiveWeight(1);
    next.play();
    if (cur && cur !== next) cur.crossFadeTo(next, fade, false);
    this.state = name;
  }

  update(dt, st) {
    const now = st.now;
    const model = this.model;
    if (st.dead) {
      // tomba para trás e afunda um pouco; a animação fica congelada na última pose
      const d = Math.min(1, (now - (st.deathStart || now)) / 700);
      model.rotation.x = -d * (Math.PI / 2) * 0.96;
      model.position.y = -d * this.height * 0.07;
      return;
    }
    if (model.rotation.x) { model.rotation.x = 0; model.position.y = 0; }
    // sobe do chão ao aparecer
    const rise = this.look.rise ? Math.min(1, (now - this.born) / 1500) : 1;
    model.position.y = -(1 - rise) * this.height * 0.95;
    let want;
    if (rise < 1) want = 'idle';
    else if (st.atkStart && now - st.atkStart < 600) want = 'attack';
    else if (st.moving) want = 'run';
    else want = 'idle';
    if (want === 'attack') {
      if (this.lastAtk !== st.atkStart) { this.lastAtk = st.atkStart; this.play('attack', 0.08); this.actions.attack.timeScale = 1.1; }
    } else if (this.state !== want && !(this.state === 'attack' && this.actions.attack.isRunning() && this.actions.attack.time < this.actions.attack.getClip().duration * 0.8)) {
      this.play(want, 0.2);
    }
    if (this.state === 'run') this.actions.run.timeScale = Math.max(0.45, Math.min(1, st.speed / 5));
    this.mixer.update(dt);
    // recuo e brilho vermelho ao sofrer dano
    const flash = st.hurt ? Math.max(0, 1 - (now - st.hurt) / 200) : 0;
    model.rotation.x = -flash * 0.18;
    if (flash > 0 || this.flashing) {
      this.mats.forEach((m, i) => {
        if (!m.emissive) return;
        const base = this.baseEmissive[i];
        m.emissive.setRGB(base.r + flash * 0.6, base.g + flash * 0.12, base.b + flash * 0.1);
      });
      this.flashing = flash > 0;
    }
  }

  setOpacity(a) { for (const m of this.mats) { m.transparent = a < 1; m.opacity = a; } }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.model.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose(); });
    for (const m of this.mats) m.dispose();
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
      if (['attack', 'cast', 'hit', 'death', 'spawn', 'spawnAir'].includes(name)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions[name] = a;
    }
    this.state = null;
    this.baseEmissive = mats.map((m) => (m.emissive ? m.emissive.clone() : null));
    this.play('idle');
    // mortos-vivos despertam: saem do chão (ou descem do ar) quando aparecem
    if (look.rise || look.spawnClip) {
      const name = look.spawnClip === 'Spawn_Air' ? 'spawnAir' : 'spawn';
      const a = this.actions[name];
      if (a) { this.play(name, 0); this.risingUntil = performance.now() + a.getClip().duration * 1000 * 0.9; }
    }
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
    if (this.risingUntil && now < this.risingUntil && !st.dead) { this.mixer.update(dt); return; }
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
    const base = this.look.ghost ? 0.72 : 1;
    for (const m of this.mats) { m.transparent = a < 1 || base < 1; m.opacity = a * base; }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    // textura de ossos do esqueleto e materiais próprios (as geometrias e texturas vêm do modelo compartilhado)
    this.model.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose(); });
    for (const m of this.mats) m.dispose();
  }
}

export const characters = new CharacterLibrary();
