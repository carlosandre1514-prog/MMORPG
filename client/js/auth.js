// Login pelo Firebase Authentication: e-mail e senha, Google e recuperação de senha. O SDK está no repositório
// (client/vendor/firebase/firebase-auth.js, gerado por tools/firebase/build.mjs) e só é carregado quando a tela de login aparece.
// O cliente entra no Firebase, pede o token (ID token) e manda ao servidor na mensagem `fblogin`; quem confere é o servidor.
import { FIREBASE_CONFIG } from '/shared/firebase.js';

let sdk = null, auth = null, loading = null, readyUser = null;

function load() {
  loading ||= (async () => {
    sdk = await import('/vendor/firebase/firebase-auth.js');
    auth = sdk.getAuth(sdk.initializeApp(FIREBASE_CONFIG));
    auth.languageCode = 'pt-BR'; // e-mails de confirmação e de redefinição de senha em português
    await auth.authStateReady(); // espera o Firebase ler a sessão guardada no navegador
    readyUser = auth.currentUser;
    return auth;
  })();
  return loading;
}

// Traduz o código de erro do Firebase para uma frase que o jogador entende
const TEXTS = {
  'auth/invalid-email': 'E-mail inválido.',
  'auth/missing-email': 'Digite o e-mail.',
  'auth/missing-password': 'Digite a senha.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/email-already-in-use': 'Este e-mail já tem conta. Use a aba "Entrar".',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  'auth/network-request-failed': 'Sem conexão com o Firebase. Verifique a internet.',
  'auth/operation-not-allowed': 'Este tipo de login ainda não foi ativado no Firebase (Authentication > Método de login).',
  'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere os pop-ups para este site e tente de novo.',
  'auth/popup-closed-by-user': 'Login com o Google cancelado.',
  'auth/cancelled-popup-request': 'Login com o Google cancelado.',
  'auth/unauthorized-domain': 'Este endereço do jogo não está autorizado no Firebase (Authentication > Configurações > Domínios autorizados).',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'A configuração do Firebase está errada (chave de API).',
  'auth/requires-recent-login': 'Entre de novo para continuar.',
};
export function errorText(e) {
  const code = e && e.code;
  if (code && TEXTS[code]) return TEXTS[code];
  if (e && e.message && !code) return e.message;
  return `Não foi possível entrar${code ? ` (${code})` : ''}.`;
}

// "Lembrar de mim": sessão guardada no navegador (continua depois de fechar) ou só até fechar a aba
async function persist(remember) {
  await load();
  try { await sdk.setPersistence(auth, remember === false ? sdk.browserSessionPersistence : sdk.browserLocalPersistence); } catch { /* segue com o padrão */ }
}

export const firebaseAuth = {
  // começa a carregar o SDK (chamado cedo, enquanto o jogo carrega o resto)
  preload() { return load().catch(() => null); },
  // usuário que já estava conectado neste navegador (ou null)
  async current() { try { await load(); return auth.currentUser; } catch { return null; } },
  async signIn(email, pass, remember = true) {
    await persist(remember);
    return (await sdk.signInWithEmailAndPassword(auth, String(email).trim(), pass)).user;
  },
  // cria a conta e já pede o e-mail de confirmação (sem travar se o envio falhar)
  async signUp(email, pass, remember = true) {
    await persist(remember);
    const { user } = await sdk.createUserWithEmailAndPassword(auth, String(email).trim(), pass);
    sdk.sendEmailVerification(user).catch(() => {});
    return user;
  },
  async google(remember = true) {
    await persist(remember);
    return (await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider())).user;
  },
  async reset(email) {
    await load();
    await sdk.sendPasswordResetEmail(auth, String(email).trim());
  },
  // token de login atual (o SDK renova sozinho quando está perto de vencer)
  async token() {
    await load();
    if (!auth.currentUser) throw new Error('Entre com seu e-mail ou com o Google.');
    return auth.currentUser.getIdToken();
  },
  async signOut() {
    try { await load(); await sdk.signOut(auth); } catch { /* sem sessão para encerrar */ }
  },
};
