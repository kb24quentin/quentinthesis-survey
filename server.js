/**
 * Loyalty Survey — server
 * Coded by Quentin Leopold · Bachelor's Thesis 2026
 *
 * Serves the animated questionnaire + a protected admin area with
 * per-response inspection and Excel export.
 *
 * Run:   npm install && npm start
 * Env:   PORT (default 3000)
 *        ADMIN_PASSWORD (default "admin" — CHANGE THIS before going live)
 */

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const ExcelJS = require('exceljs');

const store = require('./store');
const { SECTIONS, META, ALL_QUESTIONS, QUESTION_BY_ID, LIKERT_LABELS } = require('./schema');

// The "are you a member?" question drives skip logic — found by its branch flag,
// so renumbering the questionnaire never breaks the server.
const MEMBERSHIP_QID = (ALL_QUESTIONS.find((q) => q.branch) || {}).id || null;
const AGE_QID = 'q1';

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
// Secret used to sign admin tokens. Stateless so it works on serverless
// (Vercel) where there is no shared in-memory session across invocations.
const ADMIN_SECRET = process.env.ADMIN_SECRET || ('admin-secret::' + ADMIN_PASSWORD);
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ----------------------------- Admin auth ------------------------------ */
// Stateless signed tokens: "<expiry>.<hmac>". No server-side session store,
// so any serverless instance can verify a token issued by any other.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function signToken() {
  const exp = Date.now() + TOKEN_TTL_MS;
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(String(exp)).digest('hex');
  return `${exp}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(exp).digest('hex');
  return safeEqual(sig, expected);
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (verifyToken(token)) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || !safeEqual(password, ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  res.json({ token: signToken() });
});

// Logout is client-side (drop the token); kept for API symmetry.
app.post('/api/admin/logout', requireAdmin, (_req, res) => res.json({ ok: true }));

/* ----------------------------- Public API ------------------------------ */
app.get('/api/schema', (_req, res) => {
  res.json({ meta: META, sections: SECTIONS, likertLabels: LIKERT_LABELS });
});

// Validate a submission against the schema (incl. conditional questions).
function validateSubmission(answers) {
  const errors = [];

  for (const q of ALL_QUESTIONS) {
    // Conditional questions only required when their dependency is met.
    if (q.dependsOn) {
      const [depId, depVal] = Object.entries(q.dependsOn)[0];
      if (answers[depId] !== depVal) continue; // not applicable — skip
    }

    const val = answers[q.id];
    const empty = val === undefined || val === null || val === '' ||
      (Array.isArray(val) && val.length === 0);

    if (q.required && empty) {
      errors.push(`${q.id} is required`);
      continue;
    }
    if (empty) continue;

    if (q.type === 'single' && !q.options.includes(val)) {
      errors.push(`${q.id} has an invalid option`);
    }
    if (q.type === 'multiple') {
      if (!Array.isArray(val) || val.some((v) => !q.options.includes(v))) {
        errors.push(`${q.id} has an invalid selection`);
      }
    }
    if (q.type === 'likert') {
      const n = Number(val);
      if (!Number.isInteger(n) || n < 1 || n > 5) errors.push(`${q.id} must be 1–5`);
    }
    if (q.type === 'text' && typeof val !== 'string') {
      errors.push(`${q.id} must be text`);
    }
  }

  // Strip answers to any non-applicable conditional question (defensive —
  // e.g. user answered, then changed the branch question back to "No").
  for (const q of ALL_QUESTIONS) {
    if (!q.dependsOn) continue;
    const [depId, depVal] = Object.entries(q.dependsOn)[0];
    if (answers[depId] !== depVal) delete answers[q.id];
  }
  return errors;
}

function computeAttention(answers) {
  const checks = ALL_QUESTIONS.filter((q) => q.attentionCheck != null);
  if (checks.length === 0) return null;
  const passed = checks.every((q) => Number(answers[q.id]) === q.attentionCheck);
  return passed;
}

app.post('/api/submit', async (req, res) => {
  const body = req.body || {};
  const answers = body.answers || {};
  const errors = validateSubmission(answers);
  if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

  const record = {
    submittedAt: new Date().toISOString(),
    durationSeconds: Number.isFinite(body.durationSeconds) ? Math.round(body.durationSeconds) : null,
    attentionPassed: computeAttention(answers),
    userAgent: (req.headers['user-agent'] || '').slice(0, 300),
    answers,
  };
  try {
    const row = await store.insert(record);
    res.json({ ok: true, id: row.id });
  } catch (err) {
    console.error('submit failed:', err);
    res.status(500).json({ error: 'Could not save response' });
  }
});

/* ----------------------------- Admin API ------------------------------- */
app.get('/api/admin/responses', requireAdmin, async (_req, res) => {
  const rows = (await store.all()).map((r) => ({
    id: r.id,
    submittedAt: r.submittedAt,
    durationSeconds: r.durationSeconds,
    attentionPassed: r.attentionPassed,
    isMember: r.answers[MEMBERSHIP_QID] === 'Yes',
    age: r.answers[AGE_QID] || null,
  }));
  rows.sort((a, b) => b.id - a.id);
  res.json({ responses: rows });
});

app.get('/api/admin/responses/:id', requireAdmin, async (req, res) => {
  const row = await store.getById(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ response: row, schema: { sections: SECTIONS, likertLabels: LIKERT_LABELS } });
});

// Bulk delete — wipe ALL responses (e.g. to clear test data before launch).
app.delete('/api/admin/responses', requireAdmin, async (_req, res) => {
  const deleted = await store.clear();
  res.json({ ok: true, deleted });
});

app.delete('/api/admin/responses/:id', requireAdmin, async (req, res) => {
  const ok = await store.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.get('/api/admin/stats', requireAdmin, async (_req, res) => {
  const rows = await store.all();
  const total = rows.length;
  const members = rows.filter((r) => r.answers[MEMBERSHIP_QID] === 'Yes').length;
  const attentionFails = rows.filter((r) => r.attentionPassed === false).length;
  const durations = rows.map((r) => r.durationSeconds).filter((d) => Number.isFinite(d));
  const avgDuration = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  // Mean per Likert question (raw, not reverse-scored — analyst decides).
  const likertQs = ALL_QUESTIONS.filter((q) => q.type === 'likert');
  const likertMeans = likertQs.map((q) => {
    const vals = rows.map((r) => Number(r.answers[q.id])).filter((n) => n >= 1 && n <= 5);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return { id: q.id, number: q.number, text: q.text, reverse: !!q.reverse, mean, n: vals.length };
  });

  // Responses per day for the activity chart.
  const perDay = {};
  for (const r of rows) {
    const day = (r.submittedAt || '').slice(0, 10);
    if (day) perDay[day] = (perDay[day] || 0) + 1;
  }

  res.json({ total, members, nonMembers: total - members, attentionFails, avgDuration, likertMeans, perDay });
});

/* --------------------------- Excel export ------------------------------ */
app.get('/api/admin/export.xlsx', async (req, res) => {
  // Allow token via query param too, so a plain <a download> link works.
  const token = req.query.token || (req.headers.authorization || '').slice(7);
  if (!verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' });

  const rows = (await store.all()).sort((a, b) => a.id - b.id);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Quentin Leopold — Loyalty Survey';
  wb.created = new Date();

  /* Sheet 1: one row per response, one column per question. */
  const ws = wb.addWorksheet('Responses');
  const metaCols = [
    { header: 'ID', key: 'id', width: 6 },
    { header: 'Submitted At', key: 'submittedAt', width: 22 },
    { header: 'Duration (s)', key: 'duration', width: 12 },
    { header: 'Attention Check', key: 'attention', width: 15 },
  ];
  const qCols = ALL_QUESTIONS.map((q) => ({
    header: `Q${q.number}`,
    key: q.id,
    width: q.type === 'text' ? 40 : 18,
  }));
  ws.columns = [...metaCols, ...qCols];

  // Second header row with the full question text (helps the analyst).
  const textRow = ws.insertRow(2, {});
  metaCols.forEach((c, i) => { textRow.getCell(i + 1).value = ''; });
  ALL_QUESTIONS.forEach((q, i) => {
    textRow.getCell(metaCols.length + i + 1).value = q.text;
  });

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(2).font = { italic: true, size: 9, color: { argb: 'FF666666' } };
  ws.getRow(2).alignment = { wrapText: true, vertical: 'top' };
  ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 2 }];

  for (const r of rows) {
    const rowData = {
      id: r.id,
      submittedAt: r.submittedAt,
      duration: r.durationSeconds,
      attention: r.attentionPassed === null ? '—' : r.attentionPassed ? 'pass' : 'FAIL',
    };
    for (const q of ALL_QUESTIONS) {
      const v = r.answers[q.id];
      rowData[q.id] = Array.isArray(v) ? v.join('; ') : v === undefined ? '' : v;
    }
    ws.addRow(rowData);
  }

  /* Sheet 2: a small codebook so the numbers are self-explanatory. */
  const cb = wb.addWorksheet('Codebook');
  cb.columns = [
    { header: 'Question', key: 'q', width: 8 },
    { header: 'Section', key: 'sec', width: 10 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Reverse-coded', key: 'rev', width: 14 },
    { header: 'Text', key: 'text', width: 70 },
    { header: 'Options', key: 'opts', width: 60 },
  ];
  cb.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cb.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  for (const section of SECTIONS) {
    for (const q of section.questions) {
      cb.addRow({
        q: `Q${q.number}`,
        sec: section.key,
        type: q.type,
        rev: q.reverse ? 'yes' : '',
        text: q.text + (q.attentionCheck ? ' [ATTENTION CHECK — expected: Disagree]' : ''),
        opts: q.options ? q.options.join(' | ') : q.type === 'likert' ? '1–5 (Strongly Disagree → Strongly Agree)' : 'free text',
      });
    }
  }
  cb.getColumn('text').alignment = { wrapText: true, vertical: 'top' };
  cb.getColumn('opts').alignment = { wrapText: true, vertical: 'top' };

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="loyalty-survey-${stamp}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

/* ------------------------------ Routes --------------------------------- */
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Start a real HTTP server only when run directly (local dev / a VPS).
// On Vercel the app is imported as a serverless handler instead.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n  Loyalty Survey is running   (storage: ' + (store.backend || 'file') + ')');
    console.log(`  ➜  Survey:  http://localhost:${PORT}`);
    console.log(`  ➜  Admin:   http://localhost:${PORT}/admin`);
    if (ADMIN_PASSWORD === 'admin') {
      console.log('\n  ⚠  Admin password is the default ("admin").');
      console.log('     Set ADMIN_PASSWORD before sharing this publicly.\n');
    }
  });
}

module.exports = app;
