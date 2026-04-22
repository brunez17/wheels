import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth';
import Constants from 'expo-constants';
import { getFirebaseAuth } from './firebaseApp';

type Extra = { googleWebClientId?: string };

function readWebClientId(): string | null {
  const id = (Constants.expoConfig?.extra as Extra | undefined)?.googleWebClientId?.trim();
  return id && id.length > 0 ? id : null;
}

/** ID de cliente OAuth tipo "Web" (Google Cloud / Firebase). Sin esto no hay idToken para Firebase. */
export function getGoogleWebClientId(): string | null {
  return readWebClientId();
}

let configured = false;

export function configureGoogleSignIn(): void {
  const webClientId = readWebClientId();
  if (!webClientId || configured) return;
  GoogleSignin.configure({ webClientId });
  configured = true;
}

export async function signInWithGoogleForFirebase(): Promise<void> {
  const webClientId = readWebClientId();
  if (!webClientId) {
    throw new Error(
      'Falta extra.googleWebClientId en app.json (ID de cliente OAuth tipo Web de Google Cloud / Firebase).'
    );
  }
  if (!configured) {
    GoogleSignin.configure({ webClientId });
    configured = true;
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (res.type !== 'success') {
    throw new Error('Inicio de sesión cancelado.');
  }
  const idToken = res.data.idToken;
  if (!idToken) {
    throw new Error(
      'Google no devolvió idToken. Revisá que googleWebClientId sea el de tipo Web y que en Firebase esté registrada la huella SHA-1 de esta compilación Android.'
    );
  }
  const credential = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(getFirebaseAuth(), credential);
}

export async function signOutGoogleAndFirebase(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // puede fallar si no había sesión nativa
  }
  const auth = getFirebaseAuth();
  if (auth.currentUser) await signOut(auth);
}
