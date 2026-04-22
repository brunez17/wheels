import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

function readFirebaseOptions(): FirebaseOptions {
  const extra = Constants.expoConfig?.extra as { firebase?: FirebaseOptions } | undefined;
  const cfg = extra?.firebase;
  if (
    !cfg?.apiKey ||
    !cfg?.authDomain ||
    !cfg?.projectId ||
    !cfg?.storageBucket ||
    !cfg?.messagingSenderId ||
    !cfg?.appId
  ) {
    throw new Error(
      'Falta configuración Firebase en app.json → expo.extra.firebase (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).'
    );
  }
  return cfg;
}

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const opts = readFirebaseOptions();
  app = getApps().length ? getApp() : initializeApp(opts);
  return app;
}

let auth: Auth | null = null;

type AsyncStorageShape = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

function getRnPersistence(AsyncStorageImpl: AsyncStorageShape) {
  // Metro usa el entry RN de @firebase/auth; los tipos públicos no declaran esta API.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getReactNativePersistence } = require('@firebase/auth') as {
    getReactNativePersistence: (s: AsyncStorageShape) => unknown;
  };
  return getReactNativePersistence(AsyncStorageImpl);
}

/** Auth con persistencia local: el mismo usuario anónimo sobrevive al reinicio de la app. */
export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  const firebaseApp = getFirebaseApp();
  try {
    auth = initializeAuth(firebaseApp, {
      persistence: getRnPersistence(AsyncStorage),
    } as Parameters<typeof initializeAuth>[1]);
  } catch (e) {
    const code =
      e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'auth/already-initialized') {
      auth = getAuth(firebaseApp);
    } else {
      throw e;
    }
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}
