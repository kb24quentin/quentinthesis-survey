/* =========================================================================
   Loyalty Survey — frontend logic
   Loader animation · dynamic rendering · skip logic · submit
   Coded by Quentin Leopold · Bachelor's Thesis 2026
   ========================================================================= */
(() => {
  'use strict';

  // Bump this on each meaningful release — shown small on the start page.
  const APP_VERSION = 'v1.0';

  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>',
  };

  /* ------------------------- Loader animation -------------------------- */
  function buildLoader() {
    const target = $('#loaderName');
    const text = 'Quentin Leopold';
    let delay = 0.35;
    for (const ch of text) {
      if (ch === ' ') {
        target.appendChild(el('span', 'space', '&nbsp;'));
        continue;
      }
      const s = el('span', null, ch);
      s.style.animationDelay = delay.toFixed(2) + 's';
      target.appendChild(s);
      delay += 0.05;
    }
  }

  function hideLoader() {
    const loader = $('#loader');
    loader.classList.add('is-hidden');
    setTimeout(() => { loader.style.display = 'none'; }, 750);
  }

  /* ----------------------------- State --------------------------------- */
  const state = {
    schema: null,
    answers: {},
    stepIndex: 0,     // 0 = welcome, then one per section, then submit handled inline
    startedAt: null,
  };

  let SECTIONS = [];
  let LIKERT = [];

  /* --------------------------- Rendering ------------------------------- */
  function setProgress() {
    const total = SECTIONS.length;
    // stepIndex 0 = welcome (0%), 1..total = sections
    const pct = state.stepIndex === 0 ? 0 : Math.round((state.stepIndex / total) * 100);
    $('#progressBar').style.width = pct + '%';
    const topbar = $('#topbar');
    if (state.stepIndex === 0) {
      topbar.style.display = 'none';
    } else {
      topbar.style.display = '';
      const sec = SECTIONS[state.stepIndex - 1];
      $('#stepLabel').textContent = `Section ${sec.key} · ${state.stepIndex}/${total}`;
    }
  }

  function renderWelcome() {
    const m = state.schema.meta;
    const wrap = el('section', 'screen active');
    wrap.innerHTML = `
      <div class="hero">
        <span class="eyebrow">${m.context}</span>
        <h1>${m.title.replace('Customer Purchase Behavior', '<span class="grad">Customer Purchase Behavior</span>')}</h1>
        <p class="sub">Thank you for taking part. This questionnaire explores how loyalty programs &mdash; particularly digital ones &mdash; influence the way customers decide, shop, and stay loyal, across both online and in-store shopping.</p>
        <div class="facts">
          <div class="fact">${ICON.clock}<div><b>${m.estimatedMinutes} min</b><span>to complete</span></div></div>
          <div class="fact">${ICON.shield}<div><b>Anonymous</b><span>no personal data</span></div></div>
          <div class="fact">${ICON.lock}<div><b>GDPR-safe</b><span>academic use only</span></div></div>
        </div>
        <div class="consent">
          Your participation is <b>voluntary</b>, fully <b>anonymous</b>, and you may stop at any time.
          No personally identifiable information is collected. All data are processed solely for academic
          purposes and stored securely in accordance with the GDPR. By continuing, you consent to the use
          of your anonymised responses in this research.<br><br>
          For all rating questions: <b>1 = Strongly Disagree &middot; 5 = Strongly Agree</b>.
          A few statements are intentionally worded in the opposite direction to keep responses accurate.
        </div>
        <div class="nav">
          <div class="spacer"></div>
          <button class="btn btn-primary" id="startBtn">Begin survey ${ICON.arrow}</button>
        </div>
        <div class="app-version">${APP_VERSION} &middot; Quentin Leopold</div>
      </div>`;
    $('#app').appendChild(wrap);
    $('#startBtn').addEventListener('click', () => goTo(1));
  }

  function questionNode(q) {
    const node = el('div', 'q');
    node.dataset.qid = q.id;
    node.style.animationDelay = '0s';

    const note = q.note ? `<div class="q-note">${q.note}</div>` : '';
    node.innerHTML = `
      <div class="q-title"><span class="q-num">Q${q.number}</span><h3>${q.text}</h3></div>
      ${note}
      <div class="q-body"></div>`;
    const body = $('.q-body', node);

    if (q.type === 'single' || q.type === 'multiple') {
      const opts = el('div', 'options');
      q.options.forEach((opt) => {
        const label = el('label', 'opt');
        label.dataset.type = q.type;
        const mark = q.type === 'single'
          ? '<span class="mark"><span class="dot"></span></span>'
          : `<span class="mark">${ICON.check}</span>`;
        label.innerHTML = `
          <input type="${q.type === 'single' ? 'radio' : 'checkbox'}" name="${q.id}" value="${opt.replace(/"/g, '&quot;')}">
          ${mark}
          <span class="opt-text">${opt}</span>`;
        const input = $('input', label);
        input.addEventListener('change', () => {
          if (q.type === 'single') {
            opts.querySelectorAll('.opt').forEach((o) => o.classList.remove('selected'));
            label.classList.add('selected');
            state.answers[q.id] = opt;
            if (q.branch) applyBranch();
          } else {
            label.classList.toggle('selected', input.checked);
            const set = new Set(state.answers[q.id] || []);
            input.checked ? set.add(opt) : set.delete(opt);
            state.answers[q.id] = [...set];
          }
          node.classList.remove('invalid');
        });
        opts.appendChild(label);
      });
      body.appendChild(opts);

    } else if (q.type === 'likert') {
      const legend = el('div', 'likert-legend', '<span>Strongly Disagree</span><span>Strongly Agree</span>');
      const row = el('div', 'likert');
      LIKERT.forEach((pt) => {
        const b = el('button', null, `<span class="num">${pt.value}</span><span class="lab">${pt.label}</span>`);
        b.type = 'button';
        b.addEventListener('click', () => {
          row.querySelectorAll('button').forEach((x) => x.classList.remove('selected'));
          b.classList.add('selected');
          state.answers[q.id] = pt.value;
          node.classList.remove('invalid');
        });
        row.appendChild(b);
      });
      body.appendChild(legend);
      body.appendChild(row);

    } else if (q.type === 'text') {
      const ta = el('textarea');
      ta.placeholder = q.placeholder || 'Type your answer here…';
      ta.maxLength = 2000;
      const count = el('div', 'char-count', '0 / 2000');
      ta.addEventListener('input', () => {
        state.answers[q.id] = ta.value.trim();
        count.textContent = `${ta.value.length} / 2000`;
      });
      body.appendChild(ta);
      body.appendChild(count);
    }
    return node;
  }

  function renderSection(index) {
    const sec = SECTIONS[index - 1];
    const wrap = el('section', 'screen active');
    wrap.dataset.section = sec.key;

    const head = el('div', 'section-head');
    head.innerHTML = `
      <div class="section-tag">Section ${sec.key}</div>
      <h2>${sec.title}</h2>
      ${sec.intro ? `<p>${sec.intro}</p>` : ''}`;
    wrap.appendChild(head);

    sec.questions.forEach((q, i) => {
      const node = questionNode(q);
      node.style.animationDelay = (0.05 + i * 0.05).toFixed(2) + 's';
      wrap.appendChild(node);
    });

    const err = el('div', 'toast-err', 'Please answer the highlighted question(s) before continuing.');
    wrap.appendChild(err);

    const isLast = index === SECTIONS.length;
    const nav = el('div', 'nav');
    nav.innerHTML = `
      <button class="btn btn-ghost" id="backBtn">${ICON.back} Back</button>
      <div class="spacer"></div>
      <button class="btn btn-primary" id="nextBtn">${isLast ? 'Submit survey' : 'Continue'} ${isLast ? ICON.check : ICON.arrow}</button>`;
    wrap.appendChild(nav);

    $('#app').appendChild(wrap);
    $('#backBtn', wrap).addEventListener('click', () => goTo(index - 1));
    $('#nextBtn', wrap).addEventListener('click', () => {
      if (!validateSection(sec, wrap)) {
        err.classList.add('show');
        return;
      }
      err.classList.remove('show');
      isLast ? submit() : goTo(index + 1);
    });

    // Restore any previously chosen answers (when navigating back).
    restoreAnswers(sec, wrap);
    applyBranch();
  }

  /* -------------------------- Skip / branch ---------------------------- */
  // Schema-driven: any question whose `dependsOn` is no longer satisfied
  // (e.g. the membership question answered "No") is hidden and cleared.
  function applyBranch() {
    SECTIONS.forEach((sec) => sec.questions.forEach((q) => {
      if (!q.dependsOn) return;
      const node = document.querySelector(`.q[data-qid="${q.id}"]`);
      if (!node) return;
      const hide = !isApplicable(q);
      node.classList.toggle('hidden-dep', hide);
      if (hide) {
        delete state.answers[q.id];
        node.querySelectorAll('.opt.selected').forEach((o) => o.classList.remove('selected'));
        node.querySelectorAll('input').forEach((i) => { i.checked = false; });
        node.classList.remove('invalid');
      }
    }));
  }

  function isApplicable(q) {
    if (!q.dependsOn) return true;
    const [depId, depVal] = Object.entries(q.dependsOn)[0];
    return state.answers[depId] === depVal;
  }

  /* --------------------------- Validation ------------------------------ */
  function validateSection(sec, wrap) {
    let ok = true;
    let firstInvalid = null;
    for (const q of sec.questions) {
      if (!isApplicable(q)) continue;
      if (!q.required) continue;
      const v = state.answers[q.id];
      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
      const node = $(`.q[data-qid="${q.id}"]`, wrap);
      if (empty) {
        ok = false;
        node.classList.add('invalid');
        if (!firstInvalid) firstInvalid = node;
      } else {
        node.classList.remove('invalid');
      }
    }
    if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return ok;
  }

  function restoreAnswers(sec, wrap) {
    for (const q of sec.questions) {
      const v = state.answers[q.id];
      if (v === undefined) continue;
      const node = $(`.q[data-qid="${q.id}"]`, wrap);
      if (!node) continue;
      if (q.type === 'single') {
        node.querySelectorAll('.opt').forEach((o) => {
          const input = $('input', o);
          if (input.value === v) { input.checked = true; o.classList.add('selected'); }
        });
      } else if (q.type === 'multiple') {
        node.querySelectorAll('.opt').forEach((o) => {
          const input = $('input', o);
          if (v.includes(input.value)) { input.checked = true; o.classList.add('selected'); }
        });
      } else if (q.type === 'likert') {
        node.querySelectorAll('.likert button').forEach((b) => {
          if ($('.num', b).textContent == v) b.classList.add('selected');
        });
      } else if (q.type === 'text') {
        const ta = $('textarea', node);
        ta.value = v;
        $('.char-count', node).textContent = `${v.length} / 2000`;
      }
    }
  }

  /* --------------------------- Navigation ------------------------------ */
  function goTo(index) {
    const current = $('.screen.active');
    const proceed = () => {
      $('#app').innerHTML = '';
      state.stepIndex = index;
      if (index === 0) renderWelcome();
      else renderSection(index);
      setProgress();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    if (current) {
      current.classList.add('leaving');
      setTimeout(proceed, 300);
    } else {
      proceed();
    }
  }

  /* ----------------------------- Submit -------------------------------- */
  async function submit() {
    const btn = $('#nextBtn');
    btn.disabled = true;
    btn.innerHTML = 'Submitting…';
    const durationSeconds = state.startedAt ? (Date.now() - state.startedAt) / 1000 : null;
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: state.answers, durationSeconds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      renderDone();
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = 'Submit survey ' + ICON.check;
      const err = $('.toast-err');
      err.textContent = 'Something went wrong while submitting. Please try again.';
      err.classList.add('show');
    }
  }

  function renderDone() {
    $('#topbar').style.display = 'none';
    $('#progressBar').style.width = '100%';
    $('#app').innerHTML = '';
    const wrap = el('section', 'screen active');
    wrap.innerHTML = `
      <div class="done">
        <div class="check">${ICON.check}</div>
        <h1>Thank you!</h1>
        <p>Your responses have been recorded anonymously. They contribute directly to research on
        digital loyalty programs and customer behavior &mdash; and they genuinely help.</p>
        <p>All data are treated anonymously and used solely for academic purposes in accordance with the GDPR.</p>
        <div class="sig">A Bachelor&rsquo;s Thesis survey by <b>Quentin Leopold</b> &middot; Spring 2026</div>
      </div>`;
    $('#app').appendChild(wrap);
    confetti();
  }

  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer = el('div', 'confetti');
    const colors = ['#6366f1', '#8b5cf6', '#c026d3', '#10b981', '#f43f5e', '#f59e0b'];
    for (let i = 0; i < 90; i++) {
      const c = el('i');
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (2.5 + Math.random() * 2).toFixed(2) + 's';
      c.style.animationDelay = (Math.random() * 0.6).toFixed(2) + 's';
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      layer.appendChild(c);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 6000);
  }

  /* ------------------------------ Boot --------------------------------- */
  async function boot() {
    buildLoader();
    const minDisplay = new Promise((r) => setTimeout(r, 2100));
    let schema;
    try {
      const res = await fetch('/api/schema');
      schema = await res.json();
    } catch (e) {
      schema = null;
    }
    await minDisplay;

    if (!schema) {
      $('#app').innerHTML = '<div class="hero"><h1>Could not load the survey.</h1><p class="sub">Please refresh the page.</p></div>';
      hideLoader();
      return;
    }

    state.schema = schema;
    SECTIONS = schema.sections;
    LIKERT = schema.likertLabels;
    state.startedAt = Date.now();

    hideLoader();
    renderWelcome();
    setProgress();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
