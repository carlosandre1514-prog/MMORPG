// Telas iniciais: cena de abertura 3D, música de abertura e arquivos servidos pelo servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootServer } from './helpers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('a música de abertura é um MP3 de tamanho razoável e o servidor a entrega (e responde 404 para o que não existe)', async () => {
  const f = path.join(ROOT, 'assets/music/theme.mp3');
  const b = fs.readFileSync(f);
  assert.ok(b.length > 200_000 && b.length < 8_000_000, `tamanho ${b.length}`);
  assert.ok(b.toString('latin1', 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0), 'cabeçalho de MP3');
  const srv = await bootServer();
  try {
    const base = `http://127.0.0.1:${srv.port}`;
    const ok = await fetch(`${base}/music/theme.mp3`);
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-type') || '', /audio|mpeg|octet/);
    assert.equal(Buffer.from(await ok.arrayBuffer()).length, b.length);
    assert.equal(ok.headers.get('accept-ranges'), 'bytes');
    // pedidos parciais (Safari só toca áudio assim; também permite pular na faixa)
    const part = await fetch(`${base}/music/theme.mp3`, { headers: { Range: 'bytes=100-199' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), `bytes 100-199/${b.length}`);
    assert.deepEqual(Buffer.from(await part.arrayBuffer()), b.subarray(100, 200));
    const tail = await fetch(`${base}/music/theme.mp3`, { headers: { Range: 'bytes=-50' } });
    assert.equal(tail.status, 206);
    assert.deepEqual(Buffer.from(await tail.arrayBuffer()), b.subarray(b.length - 50));
    assert.equal((await fetch(`${base}/music/theme.mp3`, { headers: { Range: `bytes=${b.length + 5}-` } })).status, 416);
    assert.equal((await fetch(`${base}/music/nao-existe.mp3`)).status, 404);
    assert.equal((await fetch(`${base}/music/../server/main.js`)).status, 404);
  } finally { await srv.close(); }
});

test('main.js liga a cena de abertura e a música: começam nas telas de menu e param ao entrar no jogo', () => {
  const main = read('client/js/main.js');
  assert.match(main, /import \{ title \} from '\.\/three\/title\.js'/);
  assert.match(main, /import \{ themeMusic \} from '\.\/music\.js'/);
  // enterGame desmonta a cena e para a música; voltar ao menu (lista de personagens) liga de novo
  const enter = main.slice(main.indexOf('function enterGame()'));
  assert.ok(enter.indexOf('title.stop()') > 0 && enter.indexOf('title.stop()') < 200);
  assert.ok(enter.slice(0, 300).includes("themeMusic.setScreen('game')")); // a música continua dentro do jogo (some só em combate)
  assert.match(main, /game\.stop\(\); game = null; startBackdrop\(\)/);
  assert.match(read('client/index.html'), /<canvas id="backdrop">/);
});

test('o login pelo Firebase: SDK local, configuração do projeto e telas ligadas ao servidor', () => {
  const auth = read('client/js/auth.js'), main = read('client/js/main.js');
  assert.match(auth, /import\('\/vendor\/firebase\/firebase-auth\.js'\)/, 'o SDK vem do próprio servidor, sem CDN');
  assert.ok(fs.existsSync(path.join(ROOT, 'client/vendor/firebase/firebase-auth.js')));
  assert.match(read('client/vendor/firebase/LICENSE'), /Apache License/);
  assert.match(read('shared/firebase.js'), /projectId: 'mmorpg-aethra'/);
  // a tela de login manda o token ao servidor; a conta antiga fica em outra tela
  assert.match(main, /\{ t: 'fblogin', token \}/);
  assert.match(main, /function legacyLoginScreen/);
  assert.match(main, /info\.fb/);
  // sair encerra a sessão do Firebase antes de recarregar
  assert.match(main, /async function logout\(\) \{\s*await firebaseAuth\.signOut\(\);/);
  // os erros do Firebase aparecem em português
  for (const code of ['auth/invalid-credential', 'auth/email-already-in-use', 'auth/weak-password', 'auth/operation-not-allowed', 'auth/unauthorized-domain']) {
    assert.ok(auth.includes(`'${code}'`), code);
  }
  // domínio não autorizado: o aviso diz qual endereço e qual projeto, e a engrenagem do login mostra os mesmos dados
  assert.match(auth, /code === 'auth\/unauthorized-domain'[\s\S]*location\.hostname[\s\S]*FIREBASE_CONFIG\.projectId/);
  assert.match(read('client/js/ui/loginui.js'), /FIREBASE_CONFIG\.projectId[^\n]*location\.hostname/);
});

test('a tela de login: peças visuais, engrenagem, versão igual ao package.json e cena de acampamento', () => {
  const ui = read('client/js/ui/loginui.js'), main = read('client/js/main.js'), css = read('client/style.css');
  for (const fn of ['loginStage', 'lgCard', 'lgTabs', 'lgField', 'peekButton', 'lgSubmit', 'lgNotice', 'lgCheck']) assert.match(ui, new RegExp(`export function ${fn}\\b`), fn);
  assert.match(main, /loginStage\(info, card\)/);
  assert.match(main, /Lembrar de mim/);
  assert.match(css, /\.lg-card \{/);
  assert.match(css, /orientation: landscape\) \{ \/\* celular deitado/);
  assert.equal(JSON.parse(read('package.json')).version, read('shared/constants.js').match(/GAME_VERSION = '([^']+)'/)[1]);
  // a cena de abertura é o acampamento: cavaleiro, fogueira, castelo, rio e cachoeiras
  const title = read('client/js/three/title.js'), chars = read('client/js/three/characters.js');
  assert.match(chars, /hero_camp: \{ model: 'Knight'/);
  for (const k of ['FLAME_FS', 'OceanWater', 'FALL_FS', 'bannerTexture', "'hero_camp'", 'building_castle_blue']) assert.ok(title.includes(k), k);
  // o SDK do Firebase exporta o que o "Lembrar de mim" usa
  assert.match(read('tools/firebase/entry.js'), /browserSessionPersistence/);
});

test('a água usa o shader ocean (MIT): arquivos, licença, mundo, cena de abertura e opção de gráficos', () => {
  const ocean = read('client/js/three/ocean.js');
  assert.match(ocean, /Jérémy Bouny/);
  assert.match(ocean, /export class OceanWater/);
  for (const k of ['getNoise', 'reflectance', 'MIRROR', 'NOISE4', 'textureMatrix']) assert.ok(ocean.includes(k), k);
  // o pacote original é MIT: o texto e o aviso de direitos autorais acompanham o código
  const lic = read('client/assets/water/LICENSE.txt');
  assert.match(lic, /MIT License/);
  assert.match(lic, /Copyright \(c\) 2013 Jérémy Bouny/);
  assert.ok(fs.statSync(path.join(ROOT, 'client/assets/water/waternormals.jpg')).size > 100 * 1024);
  assert.match(read('docs/LICENCAS.md'), /ocean.*Bouny|Bouny.*ocean/i);
  // o mundo cria a água a partir dos tiles e o motor refaz o reflexo antes de desenhar cada quadro
  const world = read('client/js/three/world3d.js'), engine = read('client/js/three/engine.js');
  assert.match(world, /new OceanWater\(/);
  assert.match(world, /waterChunks\(/);
  assert.match(engine, /zoneScene\.prepareWater\(this\.renderer, this\.scene, this\.camera\)/);
  assert.match(read('client/js/three/title.js'), /new OceanWater\(/);
  // a opção Água existe nos gráficos e o reflexo do cenário só vem ligado nos perfis fortes
  assert.match(read('client/js/device.js'), /key: 'water', label: 'Água'/);
});

test('a música tema toca em repetição contínua, dentro do jogo, e some em combate', () => {
  const music = read('client/js/music.js');
  assert.match(music, /export const themeMusic/);
  assert.match(music, /nx\.play\(\)/, 'a próxima volta entra antes do fim'); // mistura entre voltas
  assert.match(music, /Math\.cos\(/, 'curva de potência igual na saída'); // mistura com curva de potência igual
  assert.ok(!/\.loop\s*=\s*true/.test(music), 'sem loop nativo (teria silêncio entre voltas)');
  // o jogo informa a bandeira de combate do jogador a cada quadro
  const game = read('client/js/game.js');
  assert.match(game, /themeMusic\.setCombat\(!!\(meEnt\.f & F\.COMBAT\)\)/);
  // com a faixa tocando, a música ambiente gerada por código fica calada
  assert.match(read('client/js/audio.js'), /this\.ambientOff/);
  // a opção Música dos ajustes controla a mesma preferência
  assert.match(read('client/js/ui/windows.js'), /Música \(some durante os combates\)/);
  // o servidor conhece os tipos de áudio
  assert.match(read('server/net/static.js'), /'\.mp3': 'audio\/mpeg'/);
});

test('a cena de abertura só usa modelos que existem nos packs do KayKit', () => {
  const src = read('client/js/three/title.js');
  const names = new Set([...src.matchAll(/(?:place|medieval\.has)\('([a-zA-Z_]+)'/g)].map((m) => m[1]));
  const list = [...src.matchAll(/\['([a-zA-Z_]+)', [0-9.]+\]/g)].map((m) => m[1]); // colunas do altar: [nome, altura]
  const trees = [...src.matchAll(/'((?:trees?|rock|mountain|building)_[a-zA-Z_]+)'/g)].map((m) => m[1]);
  const all = new Set([...names, ...list, ...trees]);
  assert.ok(all.size >= 12, `só ${all.size} modelos achados`);
  const packs = ['medieval', 'dungeon'].flatMap((p) => fs.readdirSync(path.join(ROOT, 'assets/kaykit', p)).filter((x) => x.endsWith('.glb')).map((x) => path.join(ROOT, 'assets/kaykit', p, x)));
  const have = new Set();
  for (const f of packs) {
    const b = fs.readFileSync(f), len = b.readUInt32LE(12);
    for (const n of JSON.parse(b.toString('utf8', 20, 20 + len)).nodes) have.add(n.name);
  }
  for (const n of all) assert.ok(have.has(n), `modelo ${n} não existe nos packs`);
});

test('logotipo em relevo e cartões no estilo do login', () => {
  const logo = read('client/js/ui/logo.js'), main = read('client/js/main.js'), ui = read('client/js/ui/loginui.js'), css = read('client/style.css'), win = read('client/js/ui/windows.js');
  assert.match(logo, /export function logoMark/);
  assert.match(logo, /feSpecularLighting/); // bisel de luz nas letras
  assert.match(logo, /aw-flame/); // chama no vão dos A
  assert.match(ui, /logoMark\('lg'\)/);
  assert.match(main, /logoMark\(\)/); // tela de carregamento
  assert.match(win, /logoMark\('intro'\)/); // cartão de introdução ao entrar no mundo
  assert.ok(!/logo-main/.test(main), 'o texto simples do logotipo saiu das telas');
  // todo cartão do jogo usa a mesma moldura: painéis, janelas, diálogos e convites, com cantos e losango
  assert.match(css, /\.menu-panel, \.win, \.modal, \.invite \{\s*background:/);
  assert.match(css, /\.menu-panel::after, \.win::after, \.modal::after, \.invite::after/);
  assert.match(css, /\.relief::before, \.relief::after/);
  // as molduras pequenas do HUD não pisam nos cartões
  assert.match(css, /\.frame:not\(\.modal\):not\(\.invite\)/);
  // não pode haver desfoque de fundo nas janelas (custa quadros por segundo sobre o jogo 3D)
  const card = css.slice(css.indexOf('Cartões: a mesma moldura'));
  assert.ok(!/backdrop-filter/.test(card), 'sem backdrop-filter nos cartões');
});

test('minimapa redondo gira com a câmera e a seta usa a direção real', () => {
  const ui = read('client/js/ui/ui.js'), win = read('client/js/ui/windows.js');
  assert.match(ui, /Math\.PI - \(me\.facing \|\| 0\) \+ rot/);
  assert.ok(!/\[Math\.PI, Math\.PI \/ 2, -Math\.PI \/ 2, 0\]\[me\.dir/.test(ui), 'a seta antiga de 4 lados saiu');
  assert.match(ui, /g\.renderer\.yaw/);
  assert.match(ui, /aethra_mm_north/);
  assert.match(ui, /lastMiniMap > \(quality\(\)\.low \? 66 : 33\)/);
  assert.match(win, /Math\.PI - \(g\.me\.facing \|\| 0\)/);
});

test('nenhum emoji no jogo: tudo é ícone desenhado (icons.js) e todo ícone usado existe', async () => {
  const dirs = ['client/js', 'server', 'shared'];
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(new URL('../' + d, import.meta.url), { withFileTypes: true })) { const p = d + '/' + e.name; if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  dirs.forEach(walk);
  files.push('client/index.html', 'client/style.css');
  const bad = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{2191}\u{2193}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
  for (const f of files) {
    if (f.includes('vendor')) continue;
    const src = read(f);
    const m = src.match(bad);
    assert.ok(!m, `${f}: símbolo/emoji "${m && m[0]}" (U+${m && m[0].codePointAt(0).toString(16)}) — use um ícone de icons.js`);
  }
  const { ICONS, STATUS_ICON } = await import('../client/js/ui/icons.js');
  const used = new Set();
  for (const f of files.filter((x) => x.startsWith('client/js'))) for (const m of read(f).matchAll(/\bico(?:HTML)?\('([a-z]+)'/g)) used.add(m[1]);
  for (const v of Object.values(STATUS_ICON)) used.add(v);
  for (const f of ['client/js/ui/ui.js']) for (const m of read(f).matchAll(/'(?:inventory|character|skills|quests|map|social|guild|legacy|ranking|help|options)', '[^']+', '[^']+', '([a-z]+)'/g)) used.add(m[1]);
  for (const m of read('client/js/ui/windows.js').matchAll(/SLOT_ICONS = \{([^}]*)\}/g)) for (const n of m[1].matchAll(/: '([a-z]+)'/g)) used.add(n[1]);
  for (const name of used) assert.ok(ICONS[name], `ícone "${name}" não existe em icons.js`);
  assert.ok(used.size >= 30, `${used.size} ícones usados`);
});
