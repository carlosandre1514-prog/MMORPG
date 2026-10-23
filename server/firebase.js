// Confere os tokens de login do Firebase Authentication (JWT assinado com RS256) sem nenhuma dependência: usa só o `crypto` e o `fetch`
// do Node. O cliente entra no Firebase (e-mail e senha ou Google), pede o token e manda ao servidor; aqui checamos a assinatura com os
// certificados públicos do Google e as regras do Firebase (emissor, projeto, validade, uid). Documentação oficial:
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
import crypto from 'node:crypto';

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const SKEW = 60;        // s de tolerância entre o relógio do servidor e o do Google
const MAX_TOKEN = 8192; // um token real tem uns 1 a 2 KB

export class AuthError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// Baixa os certificados atuais do Google (kid -> chave pública) e por quanto tempo valem (cabeçalho Cache-Control).
export async function fetchGoogleCerts() {
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error(`certificados do Google: HTTP ${res.status}`);
  const certs = await res.json();
  const keys = new Map();
  for (const [kid, pem] of Object.entries(certs)) keys.set(kid, new crypto.X509Certificate(pem).publicKey);
  const m = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  return { keys, ttl: m ? Number(m[1]) : 3600 };
}

const b64json = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

// fetchKeys e clock podem ser trocados nos testes (chaves geradas na hora, relógio fixo)
export function createVerifier({ projectId, fetchKeys = fetchGoogleCerts, clock = () => Date.now() / 1000 } = {}) {
  if (!projectId) throw new Error('createVerifier: projectId é obrigatório');
  let keys = new Map(), expires = 0, lastTry = -Infinity, loading = null;

  // Atualiza as chaves quando venceram ou quando o token pede uma desconhecida (no máx. uma vez a cada 20 s, para ninguém
  // forçar downloads em série mandando tokens com kid aleatório). Se o Google estiver fora do ar, as chaves antigas continuam valendo.
  function refresh(force) {
    if (loading) return loading;
    const now = clock();
    if (!force && now < expires) return null;
    if (keys.size && now - lastTry < 20) return null;
    lastTry = now;
    loading = (async () => {
      try {
        const r = await fetchKeys();
        keys = r.keys;
        expires = clock() + Math.max(60, r.ttl);
      } catch (e) {
        if (!keys.size) throw new AuthError('unavailable', 'Não foi possível conferir o login agora. Tente de novo em instantes.');
      } finally { loading = null; }
    })();
    return loading;
  }

  async function verify(token) {
    const bad = () => new AuthError('invalid', 'Login inválido. Entre novamente.');
    if (typeof token !== 'string' || token.length > MAX_TOKEN) throw bad();
    const parts = token.split('.');
    if (parts.length !== 3) throw bad();
    let header, p;
    try { header = b64json(parts[0]); p = b64json(parts[1]); } catch { throw bad(); }
    if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || !p || typeof p !== 'object') throw bad();
    await refresh(false);
    let key = keys.get(header.kid);
    if (!key) { await refresh(true); key = keys.get(header.kid); }
    if (!key) throw bad();
    let okSig = false;
    try { okSig = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url')); } catch { okSig = false; }
    if (!okSig) throw bad();
    const now = clock();
    if (typeof p.exp !== 'number') throw bad();
    if (p.exp <= now) throw new AuthError('expired', 'Seu login expirou. Entre novamente.');
    if (typeof p.iat !== 'number' || p.iat > now + SKEW) throw bad();
    if (p.auth_time != null && (typeof p.auth_time !== 'number' || p.auth_time > now + SKEW)) throw bad();
    if (p.aud !== projectId || p.iss !== `https://securetoken.google.com/${projectId}`) throw bad();
    if (typeof p.sub !== 'string' || !p.sub || p.sub.length > 128) throw bad();
    const fb = p.firebase && typeof p.firebase === 'object' ? p.firebase : {};
    return {
      uid: p.sub,
      email: typeof p.email === 'string' ? p.email.slice(0, 254) : null,
      emailVerified: p.email_verified === true,
      name: typeof p.name === 'string' ? p.name.slice(0, 80) : null,
      provider: typeof fb.sign_in_provider === 'string' ? fb.sign_in_provider : null,
    };
  }

  return { projectId, verify };
}
