// ===================================================================
//  Database connection (node:sqlite, built into Node 22.13+)
// ===================================================================
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH || join(__dirname, 'aastec.db');

function open() {
  const d = new DatabaseSync(DB_PATH);
  d.exec('PRAGMA foreign_keys = ON;');
  d.exec('PRAGMA journal_mode = WAL;');
  return d;
}

export let db = open();

export function reopenDb() {
  try { db.close(); } catch { /* already closed */ }
  db = open();
}

export const get = (sql, ...p) => db.prepare(sql).get(...p);
export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);
export const tx = (fn) => {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
};
export const nowISO = () => new Date().toISOString();
export const json = (s, fallback = null) => { try { return s == null ? fallback : JSON.parse(s); } catch { return fallback; } };
