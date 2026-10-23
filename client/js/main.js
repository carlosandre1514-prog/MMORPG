// Inicialização: login, seleção/criação de personagem e entrada no jogo.
import { CLASSES, CLASS_LIST, SKIN_TONES, HAIR_COLORS } from '/shared/data/classes.js';
import { SKILLS } from '/shared/data/skills.js';
import { ZONES } from '/shared/data/zones.js';
import { GAME_NAME } from '/shared/constants.js';
import { Net } from './net.js';
import { Game } from './game.js';
import { UI } from './ui/ui.js';
import { h, clear, esc } from './ui/dom.js';
import { drawHumanoid, playerLook, skillIcon } from './sprites.js';
import { audio } from './audio.js';
import { charSprites } from './charsprites.js';
import { characters } from './three/characters.js';
import { medieval } from './three/medieval.js';
import { setupLandscape } from './orientation.js';
import { title } from './three/title.js';
import { themeMusic } from './music.js';
import { firebaseAuth, errorText } from './auth.js';

setupLandscape();
const net = new Net();
const screens = document.getElementById('screens');
const canvas = document.getElementById('game');
const overlayCanvas = document.getElementById('overlay');
const uiRoot = document.getElementById('ui');
let ui = null, game = null, charList = [], maxChars = 4, account = '';
let notice = ''; // aviso depois do login (ex.: link de confirmação do e-mail), mostrado até entrar no mundo

function show(el) {
  clear(screens).appendChild(el);
  screens.style.display = 'flex';
  themeMusic.setScreen('menu');
  canvas.style.display = 'none';
  overlayCanvas.style.display = 'none';
  uiRoot.style.display = 'none';
}

function errorBox() { return h('div', { class: 'form-err' }); }

// ------------------------------------------------------------------ fundo animado e música das telas de menu
// Cena 3D de abertura (client/js/three/title.js); se o navegador não der WebGL, cai no fundo simples em 2D.
let flat2d = false;
function startBackdrop() {
  themeMusic.init();
  if (flat2d) return; // fundo simples já em andamento (sem WebGL)
  if (title.start()) return;
  flat2d = true;
  const cv = document.getElementById('backdrop');
  const ctx = cv.getContext('2d');
  const parts = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random(), v: 0.2 + Math.random() * 0.6 }));
  const fit = () => { cv.width = window.innerWidth; cv.height = window.innerHeight; };
  fit();
  window.addEventListener('resize', fit);
  const loop = (t) => {
    requestAnimationFrame(loop);
    if (screens.style.display === 'none') return;
    const W = cv.width, H = cv.height;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0f1c'); g.addColorStop(0.6, '#1a1424'); g.addColorStop(1, '#2b1610');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // brilho da chama no horizonte
    const fl = ctx.createRadialGradient(W / 2, H * 1.05, 10, W / 2, H * 1.05, H * 0.8);
    fl.addColorStop(0, `rgba(255,140,40,${0.35 + Math.sin(t / 900) * 0.05})`); fl.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = fl; ctx.fillRect(0, 0, W, H);
    // montanhas
    ctx.fillStyle = '#0d0b12';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H * 0.78 - Math.sin(x / 140) * 40 - Math.sin(x / 57) * 18);
    ctx.lineTo(W, H); ctx.fill();
    for (const p of parts) {
      p.y -= p.v * 0.0012; p.x += Math.sin(t / 2000 + p.s * 10) * 0.0004;
      if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
      ctx.fillStyle = `rgba(255,${150 + p.s * 90},60,${0.4 + Math.sin(t / 300 + p.s * 20) * 0.3})`;
      ctx.fillRect(p.x * W, p.y * H, 1.5 + p.s * 2, 1.5 + p.s * 2);
    }
  };
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------------ login
const logoBlock = () => h('div', { class: 'logo' }, h('div', { class: 'logo-main' }, 'AETHRA'), h('div', { class: 'logo-sub' }, 'A Chama Partida'));
const loreBlock = () => h('div', { class: 'lore-blurb' }, 'A Chama Primordial foi partida. A Névoa Cinzenta avança. Das cinzas, despertam os Portadores...');
const onlineLine = (info) => h('div', { class: 'muted small center' }, info.online != null ? `${info.online} jogador(es) online` : '');

// Sai da conta: encerra a sessão do Firebase (senão o próximo acesso entra sozinho) e recarrega
async function logout() {
  await firebaseAuth.signOut();
  location.reload();
}

// Entra no servidor com o login do Firebase: pega o token e manda em `fblogin`; quem confere a assinatura é o servidor
async function enterWithFirebase(err) {
  const token = await firebaseAuth.token();
  const r = await net.request({ t: 'fblogin', token }, (m) => m.t === 'chars' || m.t === 'err');
  if (r.t === 'err') { err.textContent = r.m; return false; }
  onChars(r);
  return true;
}

function loginScreen(info = {}, legacy = false) {
  if (!info.fb || legacy) return legacyLoginScreen(info);
  let mode = 'login';
  const email = h('input', { class: 'inp', type: 'email', placeholder: 'E-mail', maxlength: 120, autocomplete: 'email' });
  const pass = h('input', { class: 'inp', type: 'password', placeholder: 'Senha', maxlength: 64, autocomplete: 'current-password' });
  const pass2 = h('input', { class: 'inp', type: 'password', placeholder: 'Confirme a senha', maxlength: 64, autocomplete: 'new-password', style: { display: 'none' } });
  const err = errorBox();
  const ok = h('div', { class: 'form-ok' });
  const btn = h('button', { class: 'btn big' }, 'Entrar');
  const tabLogin = h('button', { class: 'tab on' }, 'Entrar');
  const tabReg = h('button', { class: 'tab' }, 'Criar conta');
  const forgot = h('button', { class: 'linkbtn' }, 'Esqueci a senha');
  const cont = h('div', { class: 'fb-continue' });
  const setMode = (m) => {
    mode = m;
    tabLogin.classList.toggle('on', m === 'login');
    tabReg.classList.toggle('on', m === 'register');
    pass2.style.display = m === 'register' ? '' : 'none';
    pass.autocomplete = m === 'login' ? 'current-password' : 'new-password';
    forgot.style.display = m === 'login' ? '' : 'none';
    btn.textContent = m === 'login' ? 'Entrar' : 'Criar conta e entrar';
    err.textContent = ''; ok.textContent = '';
  };
  tabLogin.onclick = () => setMode('login');
  tabReg.onclick = () => setMode('register');
  // roda uma ação de login mostrando o erro em português e travando os botões enquanto espera
  const run = async (fn) => {
    audio.init();
    err.textContent = ''; ok.textContent = '';
    btn.disabled = true;
    try {
      await fn();
    } catch (e) { const t = errorText(e); if (t) err.textContent = t; }
    btn.disabled = false;
  };
  const submit = () => run(async () => {
    if (mode === 'register' && pass.value !== pass2.value) throw new Error('As senhas não conferem.');
    if (mode === 'register') {
      await firebaseAuth.signUp(email.value, pass.value);
      notice = `Enviamos um link de confirmação para ${email.value.trim()} (olhe também o spam).`;
    } else await firebaseAuth.signIn(email.value, pass.value);
    try { localStorage.setItem('aethra_email', email.value.trim()); } catch { /* */ }
    await enterWithFirebase(err);
  });
  btn.onclick = submit;
  for (const el of [email, pass, pass2]) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  const google = h('button', { class: 'btn google', onclick: () => run(async () => { await firebaseAuth.google(); await enterWithFirebase(err); }) },
    h('span', { class: 'g-mark' }, 'G'), 'Entrar com o Google');
  forgot.onclick = () => run(async () => {
    if (!email.value.trim()) throw new Error('Digite o seu e-mail e clique em "Esqueci a senha".');
    await firebaseAuth.reset(email.value);
    ok.textContent = `Se ${email.value.trim()} tem conta, enviamos um link para criar uma nova senha (olhe também o spam).`;
  });
  const old = h('button', { class: 'linkbtn', onclick: () => loginScreen(info, true) }, 'Tenho uma conta antiga (usuário e senha)');
  try { email.value = localStorage.getItem('aethra_email') || ''; } catch { /* */ }
  const panel = h('div', { class: 'menu-panel login' }, logoBlock(), cont,
    h('div', { class: 'tabs' }, tabLogin, tabReg),
    email, pass, pass2, err, ok, btn,
    h('div', { class: 'or' }, h('span', {}, 'ou')), google,
    h('div', { class: 'row center small' }, forgot, old),
    onlineLine(info), loreBlock());
  show(h('div', { class: 'screen' }, panel));
  setTimeout(() => (email.value ? pass : email).focus(), 50);
  // quem já entrou neste navegador pode continuar com um clique
  firebaseAuth.current().then((u) => {
    if (!u || !cont.isConnected) return;
    const who = u.email || u.displayName || 'sua conta';
    cont.append(
      h('button', { class: 'btn big', onclick: () => run(async () => { await enterWithFirebase(err); }) }, `Continuar como ${who}`),
      h('button', { class: 'linkbtn', onclick: logout }, 'Usar outra conta'));
  });
}

// Login antigo (usuário e senha): contas criadas antes do Firebase e servidores sem Firebase. Criar conta por aqui só no modo DEV.
function legacyLoginScreen(info = {}) {
  let mode = 'login';
  const user = h('input', { class: 'inp', placeholder: 'Usuário', maxlength: 16, autocomplete: 'username' });
  const pass = h('input', { class: 'inp', type: 'password', placeholder: 'Senha', maxlength: 64, autocomplete: 'current-password' });
  const pass2 = h('input', { class: 'inp', type: 'password', placeholder: 'Confirme a senha', maxlength: 64, style: { display: 'none' } });
  const err = errorBox();
  const btn = h('button', { class: 'btn big' }, 'Entrar');
  const tabLogin = h('button', { class: 'tab on' }, 'Entrar');
  const tabReg = h('button', { class: 'tab' }, 'Criar conta');
  const setMode = (m) => {
    mode = m;
    tabLogin.classList.toggle('on', m === 'login');
    tabReg.classList.toggle('on', m === 'register');
    pass2.style.display = m === 'register' ? '' : 'none';
    btn.textContent = m === 'login' ? 'Entrar' : 'Criar conta e entrar';
    err.textContent = '';
  };
  tabLogin.onclick = () => setMode('login');
  tabReg.onclick = () => setMode('register');
  const submit = async () => {
    audio.init();
    err.textContent = '';
    if (mode === 'register' && pass.value !== pass2.value) { err.textContent = 'As senhas não conferem.'; return; }
    btn.disabled = true;
    try {
      const r = await net.request({ t: mode, user: user.value.trim(), pass: pass.value }, (m) => m.t === 'chars' || m.t === 'err');
      if (r.t === 'err') err.textContent = r.m;
      else { try { localStorage.setItem('aethra_user', user.value.trim()); } catch { /* */ } onChars(r); }
    } catch (e) { err.textContent = e.message; }
    btn.disabled = false;
  };
  btn.onclick = submit;
  for (const el of [user, pass, pass2]) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  try { user.value = localStorage.getItem('aethra_user') || ''; } catch { /* */ }
  // com Firebase no servidor, criar conta é pelo e-mail; o cadastro por usuário só existe no modo DEV (testes)
  const canRegister = !info.fb || info.dev;
  const panel = h('div', { class: 'menu-panel login' }, logoBlock(),
    info.fb ? h('div', { class: 'muted small center' }, 'Conta antiga, de antes do login por e-mail') : null,
    canRegister ? h('div', { class: 'tabs' }, tabLogin, tabReg) : null,
    user, pass, pass2, err, btn,
    info.fb ? h('button', { class: 'linkbtn', onclick: () => loginScreen(info) }, '← Voltar para o login com e-mail') : null,
    onlineLine(info), loreBlock());
  show(h('div', { class: 'screen' }, panel));
  setTimeout(() => (user.value ? pass : user).focus(), 50);
}

// ------------------------------------------------------------------ seleção de personagem
function onChars(m) {
  charList = m.list;
  maxChars = m.max;
  account = m.user;
  if (game) { game.stop(); game = null; startBackdrop(); } // de volta às telas de menu: a cena de abertura e a música voltam
  selectScreen(m.created);
}

function charPreview(c, size = 120, dir = 0) {
  if (charSprites.has(c.cls)) {
    const cv = charSprites.portrait(c.cls, size, dir, size >= 150 ? 1.05 : 1.35);
    cv.className = 'char-cv';
    return cv;
  }
  const cv = h('canvas', { width: size, height: size, class: 'char-cv' });
  const ctx = cv.getContext('2d');
  const app = {};
  for (const [slot, it] of Object.entries(c.equip || {})) if (it) app[slot[0]] = it.id;
  const look = playerLook({ cls: c.cls, sk: c.skin, hr: c.hair, app });
  const s = size / 40;
  ctx.setTransform(s * 0.9, 0, 0, s * 0.9, size / 2, size * 0.92);
  drawHumanoid(ctx, 0, 0, { ...look, dir });
  return cv;
}

function selectScreen(selectId) {
  const list = h('div', { class: 'char-list' });
  let selected = charList.find((c) => c.id === selectId) || charList[0] || null;
  const err = errorBox();
  const render = () => {
    clear(list);
    for (const c of charList) {
      const card = h('div', { class: 'char-card' + (selected && selected.id === c.id ? ' sel' : ''), onclick: () => { selected = c; render(); }, ondblclick: () => enter(c) },
        charPreview(c, 96),
        h('div', { class: 'cc-name' }, c.name),
        h('div', { class: 'cc-info' }, `Nível ${c.level} ${CLASSES[c.cls].name}`),
        h('div', { class: 'cc-zone' }, ZONES[c.zone]?.name || ''),
        c.title ? h('div', { class: 'cc-title' }, c.title) : null);
      list.appendChild(card);
    }
    if (charList.length < maxChars) {
      list.appendChild(h('div', { class: 'char-card new', onclick: () => createScreen() }, h('div', { class: 'cc-plus' }, '+'), h('div', { class: 'cc-name' }, 'Novo personagem')));
    }
  };
  const enter = async (c) => {
    if (!c) return;
    audio.init();
    err.textContent = '';
    net.send({ t: 'enter', id: c.id });
  };
  const del = () => {
    if (!selected) return;
    const name = prompt(`Para apagar ${selected.name} para sempre, digite o nome do personagem:`);
    if (!name) return;
    net.request({ t: 'delete', id: selected.id, confirm: name }, (m) => m.t === 'chars' || m.t === 'err').then((r) => {
      if (r.t === 'err') err.textContent = r.m; else onChars(r);
    });
  };
  render();
  const panel = h('div', { class: 'menu-panel select' },
    h('div', { class: 'menu-title' }, 'Escolha seu Portador'),
    h('div', { class: 'muted small center' }, `Conta: ${esc(account)}`),
    notice ? h('div', { class: 'form-ok' }, notice) : null,
    list, err,
    h('div', { class: 'row center' },
      h('button', { class: 'btn big', onclick: () => enter(selected), disabled: charList.length ? null : true }, 'Entrar no mundo'),
      charList.length ? h('button', { class: 'btn ghost', onclick: del }, 'Apagar') : null,
      h('button', { class: 'btn ghost', onclick: logout }, 'Sair')));
  show(h('div', { class: 'screen' }, panel));
  if (!charList.length) createScreen();
}

// ------------------------------------------------------------------ criação de personagem
function createScreen() {
  let cls = 'warrior', skin = 1, hair = 0;
  const name = h('input', { class: 'inp', placeholder: 'Nome do personagem', maxlength: 14 });
  const err = errorBox();
  const preview = h('div', { class: 'create-preview' });
  const info = h('div', { class: 'create-info' });
  const classBox = h('div', { class: 'class-list' });
  const skinBox = h('div', { class: 'swatches' });
  const hairBox = h('div', { class: 'swatches' });
  let dir = 0;
  const refresh = () => {
    clear(preview).appendChild(charPreview({ cls, skin, hair, equip: { weapon: { id: CLASSES[cls].startItems[0] }, chest: { id: 'chest_1' } } }, 200, dir));
    clear(classBox);
    for (const id of CLASS_LIST) {
      const c = CLASSES[id];
      classBox.appendChild(h('div', { class: 'class-card' + (id === cls ? ' sel' : ''), style: { borderColor: id === cls ? c.color : '' }, onclick: () => { cls = id; refresh(); } },
        charPreview({ cls: id, skin, hair, equip: { weapon: { id: c.startItems[0] } } }, 64),
        h('div', { class: 'cl-name', style: { color: c.color } }, c.name), h('div', { class: 'cl-role' }, c.role)));
    }
    const c = CLASSES[cls];
    clear(info).append(
      h('div', { class: 'cl-big', style: { color: c.color } }, c.name),
      h('div', { class: 'muted' }, c.role),
      h('div', { class: 'cl-desc' }, c.desc),
      h('div', { class: 'cl-skills' }, ...c.skills.map((sid) => {
        const sk = SKILLS[sid];
        return h('img', { src: skillIcon(sk, 32), 'data-tip': `<b>${esc(sk.name)}</b> <small>(nível ${sk.lvl})</small><div class="tt-desc">${esc(sk.desc)}</div>` });
      })),
      h('div', { class: 'small muted' }, `Atributo principal: ${{ str: 'Força', dex: 'Destreza', int: 'Inteligência' }[c.primary]}`));
    clear(skinBox);
    SKIN_TONES.forEach((col, i) => skinBox.appendChild(h('div', { class: 'swatch' + (i === skin ? ' sel' : ''), style: { background: col }, onclick: () => { skin = i; refresh(); } })));
    clear(hairBox);
    HAIR_COLORS.forEach((col, i) => hairBox.appendChild(h('div', { class: 'swatch' + (i === hair ? ' sel' : ''), style: { background: col }, onclick: () => { hair = i; refresh(); } })));
  };
  preview.addEventListener('click', () => { dir = (dir + 1) % 4; refresh(); });
  refresh();
  const create = async () => {
    err.textContent = '';
    try {
      const r = await net.request({ t: 'create', name: name.value.trim(), cls, skin, hair }, (m) => m.t === 'chars' || m.t === 'err');
      if (r.t === 'err') err.textContent = r.m;
      else onChars(r);
    } catch (e) { err.textContent = e.message; }
  };
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
  const panel = h('div', { class: 'menu-panel create' },
    h('div', { class: 'menu-title' }, 'Criar Portador'),
    h('div', { class: 'create-wrap' },
      h('div', { class: 'create-left' }, preview, h('div', { class: 'muted small center' }, 'Clique para girar'),
        ...(charSprites.ready ? [] : [h('div', { class: 'lbl' }, 'Pele'), skinBox, h('div', { class: 'lbl' }, 'Cabelo'), hairBox])),
      h('div', { class: 'create-right' }, classBox, info)),
    h('div', { class: 'row center' }, name, h('button', { class: 'btn big', onclick: create }, 'Criar')),
    notice ? h('div', { class: 'form-ok' }, notice) : null,
    err,
    charList.length ? h('button', { class: 'btn ghost small', onclick: () => selectScreen() }, 'Voltar') : null);
  show(h('div', { class: 'screen' }, panel));
  setTimeout(() => name.focus(), 50);
}

// ------------------------------------------------------------------ jogo
function enterGame() {
  notice = '';
  title.stop(); // libera a placa de vídeo para o mundo 3D
  themeMusic.setScreen('game');
  screens.style.display = 'none';
  canvas.style.display = 'block';
  overlayCanvas.style.display = 'block';
  uiRoot.style.display = 'block';
  if (!ui) ui = new UI(uiRoot, net);
  else ui.build();
  game = new Game(net, canvas, overlayCanvas, ui);
  ui.game = game;
  game.start();
}

net.on((m) => {
  if (m.t === 'world' && !game) {
    enterGame();
    // reprocessa a mensagem de mundo para o novo jogo
    game.onMessage(m);
  } else if (m.t === 'chars' && game) {
    onChars(m);
  } else if (m.t === 'err' && !game && screens.querySelector('.form-err')) {
    const e = screens.querySelector('.form-err');
    if (e && !e.textContent) e.textContent = m.m;
  }
});

net.onClose = () => {
  const ov = h('div', { class: 'modal-bg' }, h('div', { class: 'modal frame' },
    h('div', { class: 'modal-text' }, 'A conexão com o servidor foi perdida.'),
    h('button', { class: 'btn', onclick: () => location.reload() }, 'Reconectar')));
  document.body.appendChild(ov);
};

async function boot() {
  document.title = GAME_NAME;
  startBackdrop();
  firebaseAuth.preload(); // o SDK do Firebase carrega junto com o resto, para a tela de login já aparecer pronta
  const fill = h('div');
  const status = h('div', { class: 'muted center' }, 'Carregando modelos 3D...');
  show(h('div', { class: 'screen' }, h('div', { class: 'menu-panel' }, h('div', { class: 'logo' }, h('div', { class: 'logo-main' }, 'AETHRA')), status, h('div', { class: 'load-bar' }, fill))));
  const prog = [0, 0];
  const bar = () => { fill.style.width = Math.round(prog.reduce((a, b) => a + b, 0) / prog.length * 100) + '%'; };
  try {
    await Promise.all([
      Promise.race([charSprites.load(), new Promise((r) => setTimeout(r, 8000))]),
      characters.load((p) => { prog[0] = p; bar(); }),
      medieval.load((p) => { prog[1] = p; bar(); }),
    ]);
    status.textContent = 'Conectando...';
    await net.connect();
    const hello = await net.request({ t: 'hello' }, (m) => m.t === 'hello');
    loginScreen(hello);
  } catch (e) {
    show(h('div', { class: 'screen' }, h('div', { class: 'menu-panel' }, h('div', { class: 'logo' }, h('div', { class: 'logo-main' }, 'AETHRA')),
      h('div', { class: 'form-err' }, 'Não foi possível conectar ao servidor. Verifique se ele está rodando (npm start).'),
      h('button', { class: 'btn', onclick: () => location.reload() }, 'Tentar novamente'))));
  }
}

// acesso para depuração pelo console do navegador
window.aethra = { get game() { return game; }, get ui() { return ui; }, net, music: themeMusic, logout };

boot();
