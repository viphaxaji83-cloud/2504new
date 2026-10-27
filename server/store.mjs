import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, readFileSync, chmodSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const defaults = (() => {
  const context = {window: {}, localStorage: {getItem: () => null}};
  vm.runInNewContext(readFileSync(path.join(projectRoot, 'dist/content.js'), 'utf8').split('window.MGTU_read =')[0], context);
  const data = JSON.parse(readFileSync(path.join(projectRoot, 'dist/data.json'), 'utf8').replace(/^\uFEFF/, ''));
  return {...JSON.parse(JSON.stringify(context.window.MGTU_DEFAULTS)), blocks: {}, programs: Object.fromEntries(data.programs.map(p => [p.id, p]))};
})();

export function openStore(directory = process.env.DATA_DIR || path.join(projectRoot, 'runtime-data')) {
  mkdirSync(directory, {recursive: true, mode: 0o700});
  const filename = path.join(directory, 'site.sqlite');
  const db = new DatabaseSync(filename);
  try { chmodSync(filename, 0o600); } catch {}
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','editor')), password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS content (
      id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL, revision INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS login_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, target_id TEXT, created_at INTEGER NOT NULL
    );`);
  db.prepare('INSERT OR IGNORE INTO content(id,json,revision,updated_at) VALUES(1,?,1,?)').run(JSON.stringify(defaults), Date.now());
  return db;
}

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {const result = fn(); db.exec('COMMIT'); return result;} catch (error) {db.exec('ROLLBACK'); throw error;}
}
export const publicUser = user => ({id: user.id, login: user.login, name: user.name, role: user.role, active: !!user.active, createdAt: user.created_at});
export function audit(db, actor, action, target = null) {
  db.prepare('INSERT INTO audit(actor_id,action,target_id,created_at) VALUES(?,?,?,?)').run(actor, action, target, Date.now());
}
