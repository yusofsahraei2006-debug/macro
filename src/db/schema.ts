// Versioned migrations. Each entry runs once, in order, inside a transaction.
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT,
    barcode TEXT,
    source TEXT NOT NULL DEFAULT 'custom',      -- custom | openfoodfacts | reference
    unit TEXT NOT NULL DEFAULT 'g',             -- base unit the values below are per
    kcal_per_unit REAL NOT NULL,
    protein_per_unit REAL NOT NULL,
    carbs_per_unit REAL NOT NULL,
    fat_per_unit REAL NOT NULL,
    sugar_per_unit REAL,
    fibre_per_unit REAL,
    serving_qty REAL NOT NULL DEFAULT 100,
    serving_unit TEXT NOT NULL DEFAULT 'g',
    image_uri TEXT,
    is_favourite INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_barcode ON foods(barcode) WHERE barcode IS NOT NULL;

  CREATE TABLE IF NOT EXISTS diary_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,                          -- YYYY-MM-DD
    meal TEXT NOT NULL,                          -- breakfast | lunch | dinner | snacks
    food_id INTEGER,
    name TEXT NOT NULL,
    brand TEXT,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    -- base per-unit values snapshotted at log time; totals are quantity * base
    kcal_per_unit REAL NOT NULL,
    protein_per_unit REAL NOT NULL,
    carbs_per_unit REAL NOT NULL,
    fat_per_unit REAL NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_diary_date ON diary_entries(date);

  CREATE TABLE IF NOT EXISTS water_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    ml REAL NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_water_date ON water_entries(date);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
  // Migration 2 (Phase 2): food source ids, search history, saved meals.
  `
  ALTER TABLE foods ADD COLUMN ext_id TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_foods_ext ON foods(source, ext_id) WHERE ext_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_foods_fav ON foods(is_favourite);

  CREATE TABLE IF NOT EXISTS search_history (
    query TEXT PRIMARY KEY,
    searched_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS saved_meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- Items snapshot nutrition so a saved meal keeps working offline and survives food edits/deletes.
  CREATE TABLE IF NOT EXISTS saved_meal_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    food_id INTEGER,
    name TEXT NOT NULL,
    brand TEXT,
    unit TEXT NOT NULL,
    quantity REAL NOT NULL,
    kcal_per_unit REAL NOT NULL,
    protein_per_unit REAL NOT NULL,
    carbs_per_unit REAL NOT NULL,
    fat_per_unit REAL NOT NULL,
    FOREIGN KEY (meal_id) REFERENCES saved_meals(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_meal_items_meal ON saved_meal_items(meal_id);
  `,
  // Migration 3 (Phase 3): weight, body measurements, cached daily activity. Canonical units: kg, cm, metres.
  `
  CREATE TABLE IF NOT EXISTS weight_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    kg REAL NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_weight_date ON weight_entries(date);

  CREATE TABLE IF NOT EXISTS measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    kind TEXT NOT NULL,                 -- waist | chest | arms | hips | custom:<name>
    cm REAL NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_meas_kind_date ON measurements(kind, date);

  -- Daily totals pulled from the activity source. Cached so charts load instantly, work offline, and
  -- (for the phone-motion source, which only exposes ~7 days) build up history over time.
  CREATE TABLE IF NOT EXISTS activity_daily (
    date TEXT NOT NULL,
    source TEXT NOT NULL,               -- healthkit | motion
    steps INTEGER,
    distance_m REAL,
    active_kcal REAL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (date, source)
  );
  `,
];
