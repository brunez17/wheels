import {
  copyAsync,
  deleteAsync,
  documentDirectory,
  makeDirectoryAsync,
} from 'expo-file-system/legacy';
import type { Brand, CarDetail, CarImageRow, CarListItem } from '../types/models';
import { getDatabase } from './database';

const IMAGES_DIR = `${documentDirectory}car_images/`;

async function ensureImagesDir(): Promise<void> {
  if (!documentDirectory) return;
  await makeDirectoryAsync(IMAGES_DIR, { intermediates: true }).catch(() => undefined);
}

/** Asegura la carpeta de imágenes (p. ej. antes de restaurar desde URLs). */
export async function ensureCarImagesDirectory(): Promise<void> {
  await ensureImagesDir();
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase();
}

function normalizeColor(hex: string): string {
  return hex.trim().toUpperCase();
}

export async function listBrands(): Promise<Brand[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    vehicleCount: number;
  }>(
    `SELECT b.id, b.name,
      (SELECT COUNT(*) FROM cars c WHERE c.brand_id = b.id) AS vehicleCount
     FROM brands b
     ORDER BY b.name COLLATE NOCASE ASC`
  );
  return rows;
}

export async function insertBrand(name: string): Promise<number> {
  const db = await getDatabase();
  const res = await db.runAsync('INSERT INTO brands (name) VALUES (?)', [name.trim()]);
  return Number(res.lastInsertRowId);
}

export async function updateBrand(id: number, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE brands SET name = ? WHERE id = ?', [name.trim(), id]);
}

async function deleteLocalUri(uri: string): Promise<void> {
  try {
    if (uri.startsWith('file://')) await deleteAsync(uri, { idempotent: true });
  } catch {
    /* ignore */
  }
}

export async function deleteBrand(id: number): Promise<void> {
  const db = await getDatabase();
  const images = await db.getAllAsync<{ local_uri: string }>(
    `SELECT i.local_uri FROM car_images i
     JOIN cars c ON c.id = i.car_id WHERE c.brand_id = ?`,
    [id]
  );
  for (const row of images) await deleteLocalUri(row.local_uri);
  await db.runAsync('DELETE FROM brands WHERE id = ?', [id]);
}

export async function listCars(brandId: number): Promise<CarListItem[]> {
  const db = await getDatabase();
  return db.getAllAsync<CarListItem>(
    `SELECT c.id AS id, c.brand_id AS brandId, c.name AS name, c.series AS series,
            c.year AS year, c.quantity AS quantity,
            c.primary_color AS primaryColor, c.secondary_color AS secondaryColor,
            (SELECT local_uri FROM car_images WHERE car_id = c.id
             ORDER BY sort_order ASC, id ASC LIMIT 1) AS thumbUri
     FROM cars c
     WHERE c.brand_id = ?
     ORDER BY c.name COLLATE NOCASE ASC, c.series COLLATE NOCASE ASC`,
    [brandId]
  );
}

export async function getCar(id: number): Promise<CarDetail | null> {
  const db = await getDatabase();
  return db.getFirstAsync<CarDetail>(
    `SELECT id, brand_id AS brandId, name, series, year, quantity,
            primary_color AS primaryColor, secondary_color AS secondaryColor
     FROM cars WHERE id = ?`,
    [id]
  );
}

export async function listCarImages(carId: number): Promise<CarImageRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<CarImageRow>(
    `SELECT id, car_id AS carId, local_uri AS localUri, sort_order AS sortOrder
     FROM car_images WHERE car_id = ? ORDER BY sort_order ASC, id ASC`,
    [carId]
  );
}

export async function hasDuplicateCar(
  brandId: number,
  name: string,
  series: string,
  primaryColor: string,
  excludeCarId?: number
): Promise<boolean> {
  const db = await getDatabase();
  const n = normalizeText(name);
  const s = normalizeText(series);
  const p = normalizeColor(primaryColor);
  const rows = await db.getAllAsync<{ id: number }>(
    `SELECT id FROM cars
     WHERE brand_id = ?
       AND lower(trim(name)) = ?
       AND lower(trim(series)) = ?
       AND upper(trim(primary_color)) = ?`,
    [brandId, n, s, p]
  );
  if (excludeCarId == null) return rows.length > 0;
  return rows.some((r) => r.id !== excludeCarId);
}

export async function insertCar(
  brandId: number,
  name: string,
  series: string,
  year: number,
  quantity: number,
  primaryColor: string,
  secondaryColor: string | null
): Promise<number> {
  const db = await getDatabase();
  const res = await db.runAsync(
    `INSERT INTO cars (brand_id, name, series, year, quantity, primary_color, secondary_color)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      brandId,
      name.trim(),
      series.trim(),
      year,
      quantity,
      normalizeColor(primaryColor),
      secondaryColor ? normalizeColor(secondaryColor) : null,
    ]
  );
  return Number(res.lastInsertRowId);
}

export async function updateCar(
  id: number,
  name: string,
  series: string,
  year: number,
  quantity: number,
  primaryColor: string,
  secondaryColor: string | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE cars SET name = ?, series = ?, year = ?, quantity = ?,
      primary_color = ?, secondary_color = ?
     WHERE id = ?`,
    [
      name.trim(),
      series.trim(),
      year,
      quantity,
      normalizeColor(primaryColor),
      secondaryColor ? normalizeColor(secondaryColor) : null,
      id,
    ]
  );
}

export async function deleteCar(id: number): Promise<void> {
  const db = await getDatabase();
  const images = await db.getAllAsync<{ local_uri: string }>(
    'SELECT local_uri FROM car_images WHERE car_id = ?',
    [id]
  );
  for (const row of images) await deleteLocalUri(row.local_uri);
  await db.runAsync('DELETE FROM cars WHERE id = ?', [id]);
}

export async function persistPickedImage(carId: number, sourceUri: string): Promise<string> {
  await ensureImagesDir();
  const extMatch = sourceUri.split('.').pop()?.split('?')[0];
  const ext = extMatch && extMatch.length <= 5 ? extMatch : 'jpg';
  const dest = `${IMAGES_DIR}car_${carId}_${Date.now()}.${ext}`;
  await copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function addCarImage(carId: number, localUri: string): Promise<void> {
  const db = await getDatabase();
  const max = await db.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(sort_order) AS m FROM car_images WHERE car_id = ?',
    [carId]
  );
  const next = (max?.m ?? -1) + 1;
  await db.runAsync(
    'INSERT INTO car_images (car_id, local_uri, sort_order) VALUES (?, ?, ?)',
    [carId, localUri, next]
  );
}

export async function removeCarImage(imageId: number): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ local_uri: string }>(
    'SELECT local_uri FROM car_images WHERE id = ?',
    [imageId]
  );
  if (row) await deleteLocalUri(row.local_uri);
  await db.runAsync('DELETE FROM car_images WHERE id = ?', [imageId]);
}

export type BrandRow = { id: number; name: string };
export type CarRow = {
  id: number;
  brandId: number;
  name: string;
  series: string;
  year: number;
  quantity: number;
  primaryColor: string;
  secondaryColor: string | null;
};

/** Snapshot completo para respaldo en la nube. */
export async function exportDatabaseSnapshot(): Promise<{
  brands: BrandRow[];
  cars: CarRow[];
  images: CarImageRow[];
}> {
  const db = await getDatabase();
  const brands = await db.getAllAsync<BrandRow>('SELECT id, name FROM brands ORDER BY id ASC');
  const cars = await db.getAllAsync<CarRow>(
    `SELECT id, brand_id AS brandId, name, series, year, quantity,
            primary_color AS primaryColor, secondary_color AS secondaryColor
     FROM cars ORDER BY id ASC`
  );
  const images = await db.getAllAsync<CarImageRow>(
    `SELECT id, car_id AS carId, local_uri AS localUri, sort_order AS sortOrder
     FROM car_images ORDER BY id ASC`
  );
  return { brands, cars, images };
}

/** Borra todo el inventario local y archivos de imágenes. */
export async function deleteAllLocalData(): Promise<void> {
  const db = await getDatabase();
  const imgs = await db.getAllAsync<{ local_uri: string }>('SELECT local_uri FROM car_images');
  for (const row of imgs) await deleteLocalUri(row.local_uri);
  await db.execAsync('DELETE FROM car_images;');
  await db.execAsync('DELETE FROM cars;');
  await db.execAsync('DELETE FROM brands;');
}
