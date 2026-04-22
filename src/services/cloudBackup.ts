import {
  documentDirectory,
  downloadAsync,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '../config/firebaseApp';
import type { CarImageRow } from '../types/models';
import * as Repo from '../db/repository';

const DOC_ID = 'v1';
/** 2 = imágenes en Firestore (sin Firebase Storage). 1 = legado con URLs de Storage. */
const SCHEMA_VERSION = 2;
/** Tamaño máx. aprox. del string base64 por documento (Firestore ~1 MiB por doc). */
const MAX_B64_CHARS = 900_000;

const BACKUP_COLLECTION = 'wheelsBackup';
const IMAGES_SUBCOLLECTION = 'wheelImages';

export type CloudCarPayloadV2 = {
  brandIndex: number;
  name: string;
  series: string;
  year: number;
  quantity: number;
  primaryColor: string;
  secondaryColor: string | null;
  /** IDs de documentos en `users/{uid}/wheelImages/{id}` */
  imageDocIds: string[];
};

export type CloudInventoryPayload = {
  schemaVersion: number;
  updatedAtMs: number;
  brands: { name: string }[];
  cars: (CloudCarPayloadV2 | LegacyCarWithUrls)[];
};

export type LegacyCarWithUrls = CloudCarPayloadV2 & { imageUrls?: string[]; imageDocIds?: string[] };

function backupDocRef(uid: string) {
  return doc(getFirebaseDb(), 'users', uid, BACKUP_COLLECTION, DOC_ID);
}

function wheelImagesCollection(uid: string) {
  return collection(getFirebaseDb(), 'users', uid, IMAGES_SUBCOLLECTION);
}

function guessContentType(localPath: string): string {
  const lower = localPath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function deleteAllWheelImageDocs(uid: string): Promise<void> {
  const db = getFirebaseDb();
  const col = wheelImagesCollection(uid);
  while (true) {
    const snap = await getDocs(query(col, limit(500)));
    if (snap.empty) break;
    const batch = writeBatch(db);
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
  }
}

function mapFirebaseError(e: unknown, context: string): Error {
  const code =
    e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
  if (code === 'permission-denied') {
    return new Error(
      `${context}: permiso denegado en Firestore. Revisá reglas (users/tuUid/wheelsBackup y wheelImages) y que estés logueado con Google.`
    );
  }
  if (code === 'unauthenticated') {
    return new Error(`${context}: no autenticado. Probá cerrar la app y volver a entrar a Respaldo.`);
  }
  if (e instanceof Error) return new Error(`${context}: ${e.message}`);
  return new Error(`${context}: ${String(e)}`);
}

async function uploadImageDoc(uid: string, localUri: string): Promise<string> {
  try {
    const info = await getInfoAsync(localUri);
    if (!info.exists) {
      throw new Error(`La imagen ya no existe en el dispositivo: ${localUri.slice(-48)}`);
    }
    const b64 = await readAsStringAsync(localUri, { encoding: 'base64' });
    if (b64.length > MAX_B64_CHARS) {
      throw new Error(
        'Hay una foto demasiado grande para el respaldo sin Storage (límite ~700 KB por imagen). Comprimila o eliminála e intentá de nuevo.'
      );
    }
    const ref = await addDoc(wheelImagesCollection(uid), {
      b64,
      mimeType: guessContentType(localUri),
    });
    return ref.id;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Hay una foto')) throw e;
    if (e instanceof Error && e.message.startsWith('La imagen ya no existe')) throw e;
    throw mapFirebaseError(e, 'Error al subir una foto');
  }
}

async function requireSignedInUid(): Promise<string> {
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Iniciá sesión con Google en esta pantalla antes de subir o restaurar el respaldo.');
  }
  return uid;
}

export type RemoteBackupSummary = {
  updatedAtMs: number | null;
  schemaVersion: number | null;
  brandCount: number;
  carCount: number;
  /** Referencias a docs wheelImages (v2) o cantidad de URLs (v1). */
  imageRefsCount: number;
  uid: string;
};

/** Lee el documento principal del respaldo (sin listar la subcolección). Sirve para comprobar en consola vs la app. */
export async function fetchRemoteBackupSummary(): Promise<RemoteBackupSummary> {
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    return {
      updatedAtMs: null,
      schemaVersion: null,
      brandCount: 0,
      carCount: 0,
      imageRefsCount: 0,
      uid: '',
    };
  }
  try {
    const snap = await getDoc(backupDocRef(uid));
    if (!snap.exists()) {
      return {
        updatedAtMs: null,
        schemaVersion: null,
        brandCount: 0,
        carCount: 0,
        imageRefsCount: 0,
        uid,
      };
    }
    const data = snap.data() as CloudInventoryPayload & {
      updatedAtMs?: number;
      updatedAt?: Timestamp;
    };
    let updatedAtMs: number | null = null;
    if (typeof data.updatedAtMs === 'number') updatedAtMs = data.updatedAtMs;
    else if (data.updatedAt instanceof Timestamp) updatedAtMs = data.updatedAt.toMillis();

    const brands = Array.isArray(data.brands) ? data.brands : [];
    const cars = Array.isArray(data.cars) ? data.cars : [];
    let imageRefsCount = 0;
    for (const row of cars) {
      const r = row as LegacyCarWithUrls;
      if (Array.isArray(r.imageDocIds) && r.imageDocIds.length > 0) imageRefsCount += r.imageDocIds.length;
      else if (Array.isArray(r.imageUrls) && r.imageUrls.length > 0) imageRefsCount += r.imageUrls.length;
    }

    return {
      updatedAtMs,
      schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : null,
      brandCount: brands.length,
      carCount: cars.length,
      imageRefsCount,
      uid,
    };
  } catch (e) {
    throw mapFirebaseError(e, 'No se pudo leer el respaldo remoto');
  }
}

export async function uploadInventoryBackup(): Promise<{ updatedAtMs: number }> {
  const uid = await requireSignedInUid();
  try {
    await deleteAllWheelImageDocs(uid);
  } catch (e) {
    throw mapFirebaseError(e, 'No se pudieron borrar fotos viejas del respaldo');
  }

  const { brands, cars, images } = await Repo.exportDatabaseSnapshot();
  const brandList = [...brands].sort((a, b) => a.id - b.id);
  const brandIndexById = new Map<number, number>();
  brandList.forEach((b, i) => brandIndexById.set(b.id, i));

  const imagesByCar = new Map<number, CarImageRow[]>();
  for (const im of images) {
    const list = imagesByCar.get(im.carId) ?? [];
    list.push(im);
    imagesByCar.set(im.carId, list);
  }
  for (const list of imagesByCar.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

  const sortedCars = [...cars].sort((a, b) => a.id - b.id);
  const cloudBrands = brandList.map((b) => ({ name: b.name }));
  const cloudCars: CloudCarPayloadV2[] = [];

  for (const car of sortedCars) {
    const brandIndex = brandIndexById.get(car.brandId);
    if (brandIndex === undefined) {
      throw new Error(
        `Hay un auto "${car.name}" sin marca válida en la base local. Corregilo antes de subir el respaldo.`
      );
    }
    const ims = imagesByCar.get(car.id) ?? [];
    const imageDocIds: string[] = [];
    for (const im of ims) {
      imageDocIds.push(await uploadImageDoc(uid, im.localUri));
    }
    cloudCars.push({
      brandIndex,
      name: car.name,
      series: car.series,
      year: car.year,
      quantity: car.quantity,
      primaryColor: car.primaryColor,
      secondaryColor: car.secondaryColor,
      imageDocIds,
    });
  }

  const updatedAtMs = Date.now();
  const payload: CloudInventoryPayload = {
    schemaVersion: SCHEMA_VERSION,
    updatedAtMs,
    brands: cloudBrands,
    cars: cloudCars,
  };

  try {
    await setDoc(backupDocRef(uid), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (e) {
    throw mapFirebaseError(e, 'No se pudo guardar el documento principal del respaldo');
  }

  return { updatedAtMs };
}

async function restoreCarImages(
  uid: string,
  carId: number,
  c: LegacyCarWithUrls
): Promise<void> {
  const docIds = Array.isArray(c.imageDocIds) ? c.imageDocIds : [];
  const urls = Array.isArray(c.imageUrls) ? c.imageUrls : [];

  await Repo.ensureCarImagesDirectory();
  const base = documentDirectory;
  if (!base) throw new Error('Sin carpeta de documentos para restaurar imágenes.');

  let i = 0;

  if (docIds.length > 0) {
    for (const imageDocId of docIds) {
      try {
        const imgSnap = await getDoc(
          doc(getFirebaseDb(), 'users', uid, IMAGES_SUBCOLLECTION, imageDocId)
        );
        if (!imgSnap.exists()) {
          throw new Error(`Falta el documento de imagen wheelImages/${imageDocId}`);
        }
        const data = imgSnap.data() as { b64?: string; mimeType?: string };
        const b64 = data.b64;
        if (!b64) throw new Error(`Documento wheelImages/${imageDocId} sin campo b64`);
        const ext =
          data.mimeType?.includes('png') ? 'png' : data.mimeType?.includes('webp') ? 'webp' : 'jpg';
        const dest = `${base}car_images/restore_${carId}_${i++}.${ext}`;
        await writeAsStringAsync(dest, b64, { encoding: 'base64' });
        await Repo.addCarImage(carId, dest);
      } catch (e) {
        throw mapFirebaseError(e, `Error al restaurar la foto (${imageDocId})`);
      }
    }
    return;
  }

  for (const url of urls) {
    try {
      const dest = `${base}car_images/restore_${carId}_${i++}.jpg`;
      const { uri } = await downloadAsync(url, dest);
      await Repo.addCarImage(carId, uri);
    } catch (e) {
      throw new Error(
        `No se pudo descargar una imagen (¿URL de Storage vencida?). ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}

export async function downloadInventoryBackup(): Promise<{ updatedAtMs: number }> {
  const uid = await requireSignedInUid();
  let snap;
  try {
    snap = await getDoc(backupDocRef(uid));
  } catch (e) {
    throw mapFirebaseError(e, 'No se pudo leer el respaldo');
  }
  if (!snap.exists()) throw new Error('No hay respaldo en la nube todavía.');
  const raw = snap.data() as CloudInventoryPayload & { schemaVersion?: number };
  if (raw.schemaVersion !== 1 && raw.schemaVersion !== SCHEMA_VERSION) {
    throw new Error('El respaldo en la nube tiene una versión no compatible.');
  }
  const { brands, cars } = raw;
  if (!Array.isArray(brands) || !Array.isArray(cars)) {
    throw new Error('Formato de respaldo inválido.');
  }

  try {
    await Repo.deleteAllLocalData();
  } catch (e) {
    throw new Error(
      `No se pudo borrar la base local antes de restaurar: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const newBrandIds: number[] = [];
  for (const b of brands) {
    newBrandIds.push(await Repo.insertBrand(b.name));
  }

  for (const c of cars) {
    const brandId = newBrandIds[c.brandIndex];
    if (brandId == null) throw new Error('Datos de marca inconsistentes en el respaldo.');
    const carId = await Repo.insertCar(
      brandId,
      c.name,
      c.series,
      c.year,
      c.quantity,
      c.primaryColor,
      c.secondaryColor ?? null
    );
    await restoreCarImages(uid, carId, c as LegacyCarWithUrls);
  }

  return { updatedAtMs: raw.updatedAtMs ?? Date.now() };
}
