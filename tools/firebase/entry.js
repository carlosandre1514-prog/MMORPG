// Só o que o jogo usa do Firebase Authentication (o esbuild descarta o resto)
export { initializeApp } from 'firebase/app';
export {
  getAuth, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification,
  GoogleAuthProvider, signInWithPopup,
} from 'firebase/auth';
