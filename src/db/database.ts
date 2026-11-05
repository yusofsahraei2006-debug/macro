import * as SQLite from 'expo-sqlite';
import { MIGRATIONS } from './schema';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('fuel.db');
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  // Refuse to open a database written by a NEWER build (e.g. after installing an older IPA over a newer one).
  // Running old code against a newer schema could corrupt the user's diary.
  if (current > MIGRATIONS.length) {
    throw new Error(
      `Database is version ${current} but this build only understands up to ${MIGRATIONS.length}. Install a newer build.`,
    );
  }
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

/** Permanently removes all user data (privacy: delete-all-data). */
export async function deleteAllData() {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync(
      'DELETE FROM diary_entries; DELETE FROM water_entries; DELETE FROM saved_meals; DELETE FROM search_history; DELETE FROM foods; DELETE FROM weight_entries; DELETE FROM measurements; DELETE FROM activity_daily; DELETE FROM settings;',
    );
  });
}
