import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  const db = await SQLite.openDatabaseAsync('wheels.db');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE
    );
    CREATE TABLE IF NOT EXISTS cars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      series TEXT NOT NULL,
      year INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      primary_color TEXT NOT NULL,
      secondary_color TEXT
    );
    CREATE TABLE IF NOT EXISTS car_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
      local_uri TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_cars_brand ON cars(brand_id);
    CREATE INDEX IF NOT EXISTS idx_car_images_car ON car_images(car_id);
  `);
  dbInstance = db;
  return db;
}
