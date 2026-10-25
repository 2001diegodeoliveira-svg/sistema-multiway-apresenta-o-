const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const env = require("../config/env");
const logger = require("../utils/logger");

let db = null;

function getDb() {
  if (db) return db;
  const dir = path.dirname(env.dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(env.dbPath);
  try {
    db.exec("PRAGMA journal_mode = WAL");
  } catch (e) {
    logger.warn("PRAGMA journal_mode falhou:", e.message);
  }
  db.exec("PRAGMA foreign_keys = ON");
  logger.info("SQLite (node:sqlite) aberto em", env.dbPath);
  runMigrations(db);
  return db;
}

function runMigrations(database) {
  const migDir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  database.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`
  );
  const applied = new Set(
    database.prepare("SELECT name FROM _migrations").all().map((r) => r.name)
  );
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(migDir, f), "utf8");
    database.exec("BEGIN");
    try {
      database.exec(sql);
      database
        .prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)")
        .run(f, new Date().toISOString());
      database.exec("COMMIT");
    } catch (e) {
      database.exec("ROLLBACK");
      throw e;
    }
    logger.info("Migração aplicada:", f);
  }
}

module.exports = { getDb };