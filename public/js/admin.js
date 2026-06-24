/* =========================================================================
   Admin dashboard logic
   Coded by Quentin Leopold · Bachelor's Thesis 2026
   ========================================================================= */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
  const TOKEN_KEY = 'loyalty_admin_token';

  let token = localStorage.getItem(TOKEN_KEY) || null;

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) },
    });
    if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
    return res;
  }

  /* ----------------------------- Auth ---------------------------------- */
  function showLogin() { $('#loginView').style.display = ''; $('#dashView').style.display = 'none'; }
  function showDash() { $('#loginView').style.display = 'none'; $('#dashView').style.display = ''; }

  function logout() {
    if (token) { fetch('/api/admin/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }).catch(() => {}); }
    token = null;
    localStorage.removeItem(TOKEN_KEY);
    showLogin();
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = $('#loginErr');
    errBox.textContent = '';
    const password = $('#pw').value;
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) { errBox.textContent = data.error || 'Login failed'; return; }
      token = data.token;
      localStorage.setItem(TOKEN_KEY, token);
      $('#pw').value = '';
      enterDashboard();
    } catch (err) {
      errBox.textContent = 'Could not reach the server.';
    }
  });

  $('#logoutBtn').addEventListener('click', logout);
  $('#refreshBtn').addEventListener('click', loadAll);
  $('#clearBtn').addEventListener('click', async () => {
    const confirmText = prompt(
      'This permanently deletes ALL responses (e.g. to clear test data before launch).\n\nType  DELETE  to confirm:'
    );
    if (confirmText !== 'DELETE') return;
    const res = await api('/api/admin/responses', { method: 'DELETE' });
    const data = await res.json();
    alert(`Deleted ${data.deleted ?? 0} response(s).`);
    loadAll();
  });

  $('#seedBtn').addEventListener('click', seedTestData);

  /* --------- TEST-DATA SEEDER (dev/testing only — remove before launch) ----
     Generates synthetic responses with spread timestamps and imports them via
     the admin-only /api/admin/import endpoint. Clears existing data first. */
  async function seedTestData() {
    if (prompt('Generate SYNTHETIC TEST data?\n\nThis CLEARS all current responses, then inserts fake records for testing only. Wipe again before collecting real data.\n\nType  SEED  to confirm:') !== 'SEED') return;
    const count = Math.max(1, Math.min(1000, Math.round(Number(prompt('How many test responses?', '185'))) || 0));
    if (!count) return;
    const startDate = (prompt('Spread from date (YYYY-MM-DD):', '2026-06-26') || '2026-06-26').trim();
    const endDate = (prompt('…to date (YYYY-MM-DD):', '2026-07-02') || '2026-07-02').trim();

    const btn = $('#seedBtn');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ Generating…';
    try {
      const schema = await (await fetch('/api/schema')).json();
      const recs = generateRecords(schema, count, startDate, endDate);
      await api('/api/admin/responses', { method: 'DELETE' });
      let inserted = 0;
      for (let i = 0; i < recs.length; i += 40) {
        const res = await api('/api/admin/import', {
          method: 'POST', body: JSON.stringify({ responses: recs.slice(i, i + 40) }),
        });
        inserted += (await res.json()).inserted || 0;
        btn.textContent = `⏳ ${Math.min(i + 40, recs.length)}/${recs.length}`;
      }
      alert(`Imported ${inserted} synthetic test responses.\n\nReminder: these are TEST data — use "Delete all" before real participants.`);
      loadAll();
    } catch (e) {
      alert('Seeding failed: ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }

  // Build synthetic records with realistic distributions + spread timestamps.
  function generateRecords(schema, count, startDate, endDate) {
    const ALL = schema.sections.flatMap((s) => s.questions);
    const BY = Object.fromEntries(ALL.map((q) => [q.id, q]));
    const rnd = Math.random;
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const opt = (id, i) => BY[id].options[i];
    const weighted = (p) => { const t = p.reduce((s, [, w]) => s + w, 0); let r = rnd() * t; for (const [v, w] of p) if ((r -= w) <= 0) return v; return p[p.length - 1][0]; };
    const gauss = (m, sd) => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const clampInt = (x, lo, hi) => Math.max(lo, Math.min(hi, Math.round(x)));
    const multi = (id, f) => { const o = BY[id].options; const s = o.filter((_, i) => rnd() < f(i)); if (!s.length) s.push(pick(o)); return s; };
    const BENEFIT = ['Saving money through discounts and collected points.', 'Free products after reaching enough points.', 'Cashback on my everyday purchases.', 'Exclusive member-only offers and prices.', 'Free shipping thanks to my membership.', 'Birthday vouchers and seasonal deals.', 'Collecting points every time I shop for groceries.', 'Early access to sales before everyone else.', 'A free coffee after a few visits.', 'Better prices at the drugstore with the app.'];
    const IMPROVE = ['One single app that combines all my loyalty cards.', 'Easier and faster point redemption.', 'More transparency about how my data is used.', 'Points that never expire.', 'Rewards that are actually relevant to me.', 'Faster checkout directly through the app.', 'Fewer marketing emails and less spam.', 'Cross-brand rewards instead of separate programs.'];

    const [SY, SM, SD] = startDate.split('-').map(Number);
    const [EY, EM, ED] = endDate.split('-').map(Number);
    const startMs = Date.UTC(SY, SM - 1, SD);
    const numDays = Math.max(1, Math.round((Date.UTC(EY, EM - 1, ED) - startMs) / 86400000) + 1);
    const HOUR_W = [1,0.5,0.3,0.2,0.2,0.4,1,2,3,4,4,5,6,6,5,5,6,7,8,7,6,4,3,2];
    const ts = () => { const d = Math.floor(rnd() * numDays); const h = weighted(HOUR_W.map((w, i) => [i, w])); return new Date(startMs + d * 86400000 + h * 3600000 + Math.floor(rnd() * 3600000)).toISOString(); };

    function buildAnswers() {
      const a = {};
      a.q1 = weighted([[opt('q1',0),40],[opt('q1',1),35],[opt('q1',2),12],[opt('q1',3),7],[opt('q1',4),4],[opt('q1',5),2]]);
      a.q2 = weighted([[opt('q2',0),45],[opt('q2',1),50],[opt('q2',2),3],[opt('q2',3),2]]);
      a.q3 = weighted([[opt('q3',0),30],[opt('q3',1),12],[opt('q3',2),35],[opt('q3',3),18],[opt('q3',4),3],[opt('q3',5),2]]);
      a.q4 = weighted([[opt('q4',0),28],[opt('q4',1),25],[opt('q4',2),22],[opt('q4',3),12],[opt('q4',4),5],[opt('q4',5),8]]);
      a.q5 = weighted([[opt('q5',0),45],[opt('q5',1),30],[opt('q5',2),12],[opt('q5',3),6],[opt('q5',4),4],[opt('q5',5),3]]);
      a.q6 = weighted([[opt('q6',0),8],[opt('q6',1),34],[opt('q6',2),28],[opt('q6',3),20],[opt('q6',4),10]]);
      a.q7 = weighted([[opt('q7',0),18],[opt('q7',1),32],[opt('q7',2),28],[opt('q7',3),16],[opt('q7',4),6]]);
      a.q8 = weighted([[opt('q8',0),55],[opt('q8',1),30],[opt('q8',2),8],[opt('q8',3),3],[opt('q8',4),4]]);
      a.q9 = weighted([[opt('q9',0),25],[opt('q9',1),40],[opt('q9',2),35]]);
      a.q10 = multi('q10', (i) => [0.55,0.45,0.5,0.3,0.4,0.45,0.3,0.35][i]);
      const member = rnd() < 0.75;
      a.q11 = member ? 'Yes' : 'No';
      if (member) {
        a.q12 = weighted([[opt('q12',0),20],[opt('q12',1),45],[opt('q12',2),25],[opt('q12',3),10]]);
        a.q13 = multi('q13', (i) => [0.6,0.3,0.45,0.5,0.25,0.4][i]);
        a.q14 = multi('q14', (i) => [0.45,0.6,0.2,0.3,0.55,0.25,0.4,0.45][i]);
        a.q15 = weighted([[opt('q15',0),35],[opt('q15',1),35],[opt('q15',2),30]]);
        a.q16 = weighted([[opt('q16',0),18],[opt('q16',1),34],[opt('q16',2),28],[opt('q16',3),14],[opt('q16',4),6]]);
      }
      const aff = gauss(member ? 0.45 : -0.55, 0.9), priv = gauss(0.3, 0.95);
      for (const q of ALL) {
        if (q.type !== 'likert') continue;
        if (q.id === 'q40') { a.q40 = rnd() < 0.93 ? 2 : pick([1, 3, 4, 5]); continue; }
        const inF = ['q31','q32','q33','q34','q35'].includes(q.id);
        const f = inF ? -priv * 0.7 + aff * 0.2 : aff;
        a[q.id] = clampInt(gauss(3 + (q.reverse ? -1 : 1) * f, 0.9), 1, 5);
      }
      a.q41 = rnd() < 0.45 ? pick(BENEFIT) : '';
      a.q42 = rnd() < 0.35 ? pick(IMPROVE) : '';
      return a;
    }

    const recs = [];
    for (let i = 0; i < count; i++) {
      const answers = buildAnswers();
      let dur = Math.round(gauss(360, 120));
      if (rnd() < 0.05) dur = Math.round(gauss(700, 120));
      recs.push({ submittedAt: ts(), durationSeconds: Math.max(75, Math.min(1200, dur)), answers });
    }
    recs.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    return recs;
  }
  $('#exportBtn').addEventListener('click', () => {
    window.location.href = '/api/admin/export.xlsx?token=' + encodeURIComponent(token);
  });

  /* --------------------------- Dashboard ------------------------------- */
  async function enterDashboard() { showDash(); await loadAll(); }

  async function loadAll() {
    try {
      const [statsRes, respRes] = await Promise.all([
        api('/api/admin/stats'),
        api('/api/admin/responses'),
      ]);
      const stats = await statsRes.json();
      const { responses } = await respRes.json();
      renderStats(stats);
      renderMeans(stats);
      renderTable(responses);
    } catch (e) { /* logout already handled on 401 */ }
  }

  function fmtDuration(s) {
    if (s == null) return '—';
    const m = Math.floor(s / 60), sec = s % 60;
    return m ? `${m}m ${sec}s` : `${sec}s`;
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function renderStats(s) {
    const memberPct = s.total ? Math.round((s.members / s.total) * 100) : 0;
    $('#stats').innerHTML = `
      <div class="stat"><div class="k">Total responses</div><div class="v grad">${s.total}</div></div>
      <div class="stat"><div class="k">Loyalty members</div><div class="v">${s.members}</div><div class="sub">${memberPct}% of respondents</div></div>
      <div class="stat"><div class="k">Avg. completion</div><div class="v">${fmtDuration(s.avgDuration)}</div></div>
      <div class="stat"><div class="k">Attention fails</div><div class="v">${s.attentionFails}</div><div class="sub">flagged for review</div></div>`;
  }

  function renderMeans(s) {
    const panel = $('#meansPanel');
    if (!s.likertMeans || !s.total) { panel.style.display = 'none'; return; }
    panel.style.display = '';
    const box = $('#means');
    box.innerHTML = '';
    s.likertMeans.forEach((m) => {
      const row = el('div', 'mean-row');
      const pct = m.mean ? ((m.mean - 1) / 4) * 100 : 0;
      row.innerHTML = `
        <div class="ql">Q${m.number}${m.reverse ? ' <span class="rev">↺</span>' : ''}</div>
        <div class="mean-bar"><b style="width:${pct}%"></b></div>
        <div class="mv">${m.mean ? m.mean.toFixed(2) : '—'}</div>
        <div class="qtext">${m.text}</div>`;
      box.appendChild(row);
    });
  }

  function renderTable(rows) {
    const body = $('#respBody');
    body.innerHTML = '';
    $('#respCount').textContent = `${rows.length} total`;
    $('#emptyState').style.display = rows.length ? 'none' : '';
    rows.forEach((r) => {
      const tr = el('tr');
      const att = r.attentionPassed === null
        ? '<span class="pill muted">n/a</span>'
        : r.attentionPassed ? '<span class="pill ok">pass</span>' : '<span class="pill fail">fail</span>';
      const member = r.isMember ? '<span class="pill yes">yes</span>' : '<span class="pill muted">no</span>';
      tr.innerHTML = `
        <td>#${r.id}</td>
        <td>${fmtDate(r.submittedAt)}</td>
        <td>${r.age || '—'}</td>
        <td>${member}</td>
        <td>${fmtDuration(r.durationSeconds)}</td>
        <td>${att}</td>
        <td style="text-align:right">
          <button class="link-btn" data-view="${r.id}">View</button>
          <button class="link-btn del-btn" data-del="${r.id}">Delete</button>
        </td>`;
      body.appendChild(tr);
    });
    body.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => openDetail(b.dataset.view)));
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => deleteResp(b.dataset.del)));
  }

  async function deleteResp(id) {
    if (!confirm(`Delete response #${id}? This cannot be undone.`)) return;
    await api('/api/admin/responses/' + id, { method: 'DELETE' });
    loadAll();
  }

  /* ----------------------------- Detail -------------------------------- */
  async function openDetail(id) {
    const res = await api('/api/admin/responses/' + id);
    const { response, schema } = await res.json();
    $('#modalTitle').textContent = `Response #${response.id}`;
    const att = response.attentionPassed === null ? 'n/a' : response.attentionPassed ? 'Passed ✓' : 'FAILED ✕';

    let html = `
      <div class="meta-grid">
        <div class="m"><div class="k">Submitted</div><div class="v">${fmtDate(response.submittedAt)}</div></div>
        <div class="m"><div class="k">Duration</div><div class="v">${fmtDuration(response.durationSeconds)}</div></div>
        <div class="m"><div class="k">Attention check</div><div class="v">${att}</div></div>
      </div>`;

    const labels = schema.likertLabels.reduce((acc, x) => { acc[x.value] = x.label; return acc; }, {});

    for (const sec of schema.sections) {
      html += `<div class="ans-section">Section ${sec.key} — ${sec.title}</div>`;
      for (const q of sec.questions) {
        const v = response.answers[q.id];
        const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
        let aHtml;
        if (empty) {
          aHtml = '<span class="a empty">— not answered —</span>';
        } else if (q.type === 'multiple') {
          aHtml = '<span class="a">' + v.map((x) => `<span class="chip">${esc(x)}</span>`).join('') + '</span>';
        } else if (q.type === 'likert') {
          aHtml = `<span class="a"><span class="scale"><span class="n">${v}</span>${labels[v] || ''}</span></span>`;
        } else {
          aHtml = `<span class="a">${esc(String(v))}</span>`;
        }
        html += `<div class="ans"><div class="q"><b>Q${q.number}.</b> ${esc(q.text)}</div>${aHtml}</div>`;
      }
    }
    $('#modalBody').innerHTML = html;
    $('#modalBg').classList.add('show');
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  $('#modalClose').addEventListener('click', () => $('#modalBg').classList.remove('show'));
  $('#modalBg').addEventListener('click', (e) => { if (e.target === $('#modalBg')) $('#modalBg').classList.remove('show'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#modalBg').classList.remove('show'); });

  /* ------------------------------ Boot --------------------------------- */
  async function boot() {
    if (token) {
      // Validate the stored token by hitting a protected endpoint.
      try {
        const res = await fetch('/api/admin/stats', { headers: { Authorization: 'Bearer ' + token } });
        if (res.ok) { enterDashboard(); return; }
      } catch (e) { /* fall through */ }
      token = null; localStorage.removeItem(TOKEN_KEY);
    }
    showLogin();
  }
  boot();
})();
