/**
 * Postgres-backed store (used in production / on Vercel).
 * Coded by Quentin Leopold · Bachelor's Thesis 2026.
 * Activated automatically when a DATABASE_URL / POSTGRES_URL env var exists.
 * Works with any Postgres — Neon (Vercel), Supabase, Railway, a VPS, etc.
 *
 * Pure-JS driver (`pg`), so `npm install` never needs to compile anything.
 */

const { Pool } = require('pg');

const CONNECTION =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

// Most hosted Postgres providers require TLS. Allow self-signed chains
// (Neon/Supabase use trusted certs, but rejectUnauthorized:false is the
// safe, universally-working setting for a serverless client).
const pool = new Pool({
  connectionString: CONNECTION,
  ssl: CONNECTION && !CONNECTION.includes('localhost') ? { rejectUnauthorized: false } : false,
  max: 3,
});

let ready = null;
function ensureTable() {
  if (!ready) {
    ready = pool.query(`
      CREATE TABLE IF NOT EXISTS responses (
        id               SERIAL PRIMARY KEY,
        submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        duration_seconds INTEGER,
        attention_passed BOOLEAN,
        user_agent       TEXT,
        answers          JSONB NOT NULL
      );
    `);
  }
  return ready;
}

// Map a DB row to the same shape the rest of the app expects.
function fromRow(r) {
  return {
    id: r.id,
    submittedAt: r.submitted_at instanceof Date ? r.submitted_at.toISOString() : r.submitted_at,
    durationSeconds: r.duration_seconds,
    attentionPassed: r.attention_passed,
    userAgent: r.user_agent,
    answers: r.answers,
  };
}

async function all() {
  await ensureTable();
  const { rows } = await pool.query('SELECT * FROM responses ORDER BY id ASC');
  return rows.map(fromRow);
}

async function getById(id) {
  await ensureTable();
  const { rows } = await pool.query('SELECT * FROM responses WHERE id = $1', [Number(id)]);
  return rows[0] ? fromRow(rows[0]) : null;
}

async function insert(record) {
  await ensureTable();
  const { rows } = await pool.query(
    `INSERT INTO responses (submitted_at, duration_seconds, attention_passed, user_agent, answers)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      record.submittedAt || new Date().toISOString(),
      record.durationSeconds,
      record.attentionPassed,
      record.userAgent,
      JSON.stringify(record.answers),
    ],
  );
  return fromRow(rows[0]);
}

async function remove(id) {
  await ensureTable();
  const { rowCount } = await pool.query('DELETE FROM responses WHERE id = $1', [Number(id)]);
  return rowCount > 0;
}

module.exports = { all, getById, insert, remove, backend: 'postgres' };
