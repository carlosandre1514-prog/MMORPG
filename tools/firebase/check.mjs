// Confere se o projeto do Firebase está pronto para o login do jogo (só leituras, não cria nada).
//   node tools/firebase/check.mjs [dominio-do-jogo ...]      ex.: node tools/firebase/check.mjs meujogo.onrender.com
// Verifica: chave de API, "E-mail/senha" ativado, Google ativado, domínios autorizados e certificados usados pelo servidor.
import { FIREBASE_CONFIG } from '../../shared/firebase.js';
import { fetchGoogleCerts } from '../../server/firebase.js';

const KEY = encodeURIComponent(FIREBASE_CONFIG.apiKey);
const wanted = ['localhost', ...process.argv.slice(2).map((d) => d.replace(/^https?:\/\//, '').replace(/[/:].*$/, ''))];
let bad = 0;
const line = (ok, msg, fix) => { if (!ok) bad++; console.log(`${ok ? '  OK  ' : ' FALTA'} ${msg}${!ok && fix ? `\n        -> ${fix}` : ''}`); };
const post = async (url, body) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

console.log(`Projeto ${FIREBASE_CONFIG.projectId}\n`);

// 1. e-mail e senha: uma tentativa de entrar com um e-mail que não existe. Se o método está desligado, o Firebase responde OPERATION_NOT_ALLOWED
const probe = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${KEY}`, { email: `verificacao-${Date.now()}@exemplo.invalid`, password: 'x-verificacao', returnSecureToken: true });
const msg = String(probe.json?.error?.message || '');
if (/API_KEY_INVALID|API key not valid/i.test(msg) || probe.status === 403 && /blocked|API_KEY/i.test(msg)) {
  line(false, 'Chave de API recusada pelo Firebase', 'confira apiKey em shared/firebase.js (Configurações do projeto > Seus apps > Web)');
} else if (/OPERATION_NOT_ALLOWED|PASSWORD_LOGIN_DISABLED/.test(msg)) {
  line(false, 'Login por e-mail e senha está DESLIGADO', 'Firebase > Authentication > Método de login > E-mail/senha > Ativar > Salvar');
} else {
  line(true, `Login por e-mail e senha ativado (resposta de teste: ${msg || probe.status})`);
}

// 2. configuração pública do projeto: provedores e domínios autorizados
const cfg = await (await fetch(`https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${KEY}`)).json().catch(() => ({}));
if (cfg.error) {
  line(false, `Não consegui ler a configuração do projeto (${cfg.error.message})`, 'a chave de API precisa permitir a API "Identity Toolkit"');
} else {
  const idps = (cfg.idpConfig || []).filter((p) => p.enabled !== false).map((p) => p.provider);
  line(idps.includes('GOOGLE'), `Login com o Google ${idps.includes('GOOGLE') ? 'ativado' : 'desligado'}`, 'Firebase > Authentication > Método de login > Google > Ativar (escolha o e-mail de suporte) > Salvar');
  const domains = cfg.authorizedDomains || [];
  console.log(`\n  Domínios autorizados: ${domains.join(', ') || '(nenhum)'}`);
  for (const d of wanted) {
    const okd = domains.some((x) => x === d || (d.endsWith('.' + x)));
    line(okd, `Domínio "${d}" autorizado`, `Firebase > Authentication > Configurações > Domínios autorizados > Adicionar domínio "${d}"`);
  }
}

// 3. certificados que o servidor usa para conferir os tokens
try {
  const c = await fetchGoogleCerts();
  line(c.keys.size > 0, `Certificados do Google carregados (${c.keys.size} chaves, valem ${Math.round(c.ttl / 3600)} h)`);
} catch (e) { line(false, `Servidor não alcançou os certificados do Google (${e.message})`, 'o servidor precisa de internet para https://www.googleapis.com'); }

console.log(bad ? `\n${bad} item(ns) para ajustar.` : '\nTudo certo: o login do jogo deve funcionar.');
process.exit(bad ? 1 : 0);
