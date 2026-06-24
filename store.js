/**
 * Storage adapter. Coded by Quentin Leopold · Bachelor's Thesis 2026.
 *
 *  • If a Postgres connection string is present in the environment
 *    (DATABASE_URL / POSTGRES_URL …) → use Postgres  (production / Vercel).
 *  • Otherwise → a tiny atomic JSON file under data/  (local dev, zero setup).
 *
 * Every method is async so callers don't care which backend is active.
 */

const fs = require('fs');
const path = require('path');

const HAS_PG =
  !!(process.env.DATABASE_URL || process.env.POSTGRES_URL ||
     process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING);

if (HAS_PG) {
  // Delegate entirely to the Postgres adapter.
  module.exports = require('./db-postgres');
} else {
  module.exports = createFileStore();
}

/* ------------------------- File store (local) -------------------------- */
function createFileStore() {
  const DATA_DIR = path.join(__dirname, 'data');
  const DB_FILE = path.join(DATA_DIR, 'responses.json');
  const TMP_FILE = path.join(DATA_DIR, 'responses.tmp.json');

  function ensure() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ responses: [], nextId: 1 }, null, 2));
    }
  }
  function read() {
    ensure();
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (err) {
      throw new Error('responses.json is unreadable: ' + err.message);
    }
  }
  function write(db) {
    ensure();
    fs.writeFileSync(TMP_FILE, JSON.stringify(db, null, 2));
    fs.renameSync(TMP_FILE, DB_FILE); // atomic on the same filesystem
  }

  return {
    backend: 'file',
    async all() {
      return read().responses;
    },
    async getById(id) {
      return read().responses.find((r) => r.id === Number(id)) || null;
    },
    async insert(record) {
      const db = read();
      const id = db.nextId;
      const row = { id, ...record };
      db.responses.push(row);
      db.nextId = id + 1;
      write(db);
      return row;
    },
    async remove(id) {
      const db = read();
      const before = db.responses.length;
      db.responses = db.responses.filter((r) => r.id !== Number(id));
      write(db);
      return db.responses.length < before;
    },
  };
}
