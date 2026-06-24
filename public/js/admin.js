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
