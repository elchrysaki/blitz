(() => {
  const app = document.getElementById('app');
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = 'ABCD';
  const TIMES = [10, 20, 30, 60];
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
  const pinText = (pin) => `${pin.slice(0, 3)} ${pin.slice(3)}`;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  const pct = (v) => `${(v * 100).toFixed(2)}%`;
  // The Blitz mark: vermilion tile, white bolt, denim-style stitching (same as public/brand/mark.svg).
  const MARK = '<svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#FF5A1F"/>'
    + '<rect x="5" y="5" width="54" height="54" rx="13.5" fill="none" stroke="#F6F1E9" stroke-opacity=".7" stroke-width="1.6" stroke-dasharray="3.2 2.6" stroke-linecap="round"/>'
    + '<path d="M37.5 9.5 17 36.5h12.2L25.4 54.5 47 26.4H34.6l2.9-16.9Z" fill="#F6F1E9" stroke="#032A3C" stroke-width="2.4" stroke-linejoin="round"/></svg>';
  const PIN = '<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 32 12 32s12-11.6 12-20.3C24 5.2 18.6 0 12 0z"/><circle cx="12" cy="11.5" r="4.5"/></svg>';
  const regionEl = (r, i, del) => `<div class="region" style="left:${pct(r.x)};top:${pct(r.y)};width:${pct(r.w)};height:${pct(r.h)}">${
    del ? `<button class="rdel" data-act="rdel" data-r="${i}" aria-label="Remove area">×</button>` : ''}</div>`;
  const marker = (x, y, cls = '', title = '') => `<span class="marker ${cls}" style="left:${pct(x)};top:${pct(y)}"${title ? ` title="${esc(title)}"` : ''}>${PIN}</span>`;
  const pinBox = (src, inner = '', cls = '') => `<div class="pinbox ${cls}"><img src="${src}" alt="" draggable="false" decoding="async">${inner}</div>`;
  const fracAt = (box, e) => { const b = box.getBoundingClientRect(); return [clamp((e.clientX - b.left) / b.width), clamp((e.clientY - b.top) / b.height)]; };

  let cleanup = null;      // tears down the current view's live connection
  let viewKey = '';        // identifies what's on screen, so live updates can patch instead of redraw
  let deadline = 0;        // performance.now() timestamp when the current question closes
  let duration = 1;

  // ---------- helpers ----------

  const store = {
    get(k, s = sessionStorage) { try { return JSON.parse(s.getItem(k)); } catch { return null; } },
    set(k, v, s = sessionStorage) { try { s.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k, s = sessionStorage) { try { s.removeItem(k); } catch {} },
  };

  async function api(url, body) {
    const res = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Something went wrong');
    return json;
  }

  // A short tap of haptic feedback on phones that support it, fired on the same frame as the visual change.
  const buzz = (pattern) => { try { navigator.vibrate?.(pattern); } catch {} };

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function live(url, onState, onEnded) {
    const es = new EventSource(url);
    es.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'ended') { es.close(); onEnded(); } else onState(m);
    };
    return () => es.close();
  }

  // One ticker drives every countdown on screen. It only runs while a countdown is visible
  // and the tab is in front, so idle pages cost nothing.
  let ticking = 0;
  function tick() {
    ticking = 0;
    const secs = document.querySelectorAll('[data-secs]');
    const bars = document.querySelectorAll('[data-bar]');
    if (!secs.length && !bars.length) return;
    const left = Math.max(0, deadline - performance.now());
    secs.forEach((el) => { const v = String(Math.ceil(left / 1000)); if (el.textContent !== v) el.textContent = v; });
    bars.forEach((el) => { el.style.transform = `scaleX(${left / duration})`; });
    if (left > 0 && !document.hidden) ticking = setTimeout(tick, 100);
  }
  const startTicker = () => { if (!ticking) tick(); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) startTicker(); });

  const nav = (right = '') => `
    <header class="nav">
      <a class="logo" href="/" data-link aria-label="Blitz home">${MARK}<span>blitz<i>.</i></span></a>
      <a class="navlink ${location.pathname === '/dashboard' ? 'on' : ''}" href="/dashboard" data-link>Dashboard</a>
      <span class="grow"></span>${right}
    </header>`;

  const tiles = (answers, each = () => ({})) => `
    <div class="tiles">${answers.map((a, i) => {
      const o = each(i);
      const tag = o.button ? 'button' : 'div';
      return `<${tag} class="tile t${i} ${o.cls || ''}" ${o.button ? `data-choice="${i}"` : ''}>
        <b>${L[i]}</b><span>${esc(a)}</span>${o.extra || ''}</${tag}>`;
    }).join('')}</div>`;

  const boardRows = (players, limit) => players.slice(0, limit).map((p, i) => `
    <li><span class="rank">${i + 1}</span><span class="name">${esc(p.name)}</span>
      ${p.gained ? `<span class="gain">+${fmt(p.gained)}</span>` : ''}<span class="score">${fmt(p.score)}</span></li>`).join('');

  // ---------- router ----------

  function go(path) { history.pushState(null, '', path); route(); }
  window.addEventListener('popstate', route);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]');
    if (a) { e.preventDefault(); go(a.getAttribute('href')); }
  });

  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    viewKey = '';
    window.scrollTo(0, 0);
    const p = location.pathname;
    if (p === '/create') return viewCreate();
    if (p === '/play') return viewPlay();
    if (p === '/dashboard') return viewDashboard();
    let m = p.match(/^\/host\/([\w-]+)$/);
    if (m) return viewHost(m[1]);
    m = p.match(/^\/edit\/([\w-]+)$/);
    if (m) return viewCreate(m[1]);
    viewHome();
  }

  const ago = (t) => {
    const s = Math.max(0, Date.now() / 1000 - t);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    const d = Math.floor(s / 86400);
    if (d === 1) return 'yesterday';
    if (d < 7) return `${d} days ago`;
    return new Date(t * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); // after a week, a date reads better
  };

  // ---------- dashboard ----------

  async function viewDashboard() {
    let alive = true;
    cleanup = () => { alive = false; };

    // Quizzes nobody plays or edits for 15 days are deleted; warn in the last few days.
    const daysLeft = (q) => (q.expires ? Math.max(1, Math.ceil((q.expires - Date.now() / 1000) / 86400)) : 99);
    const quizCard = (q) => `
      <article class="card qtile" data-id="${q.id}">
        <a class="cover" href="/host/${q.id}" data-link>
          ${q.cover ? `<img src="${q.cover}" alt="" loading="lazy" decoding="async">` : `<span class="cover-fallback">${esc(q.title.slice(0, 1).toUpperCase())}</span>`}
          ${q.live ? '<span class="livebadge">Live now</span>' : ''}
        </a>
        <div class="qtile-body">
          <h3>${esc(q.title)}</h3>
          <p class="meta">${q.questions} question${q.questions === 1 ? '' : 's'}${q.pins ? ` · ${q.pins} pin` : ''} · ${
            q.plays ? `played ${q.plays}×` : 'not played yet'}</p>
          <p class="meta dim">Edited ${ago(q.updated)}</p>
          ${daysLeft(q) <= 5 ? `<p class="meta warn">Deleted in ${daysLeft(q) <= 1 ? 'a day' : `${daysLeft(q)} days`} unless it’s played</p>` : ''}
          <div class="qtile-actions">
            <a class="btn primary small" href="/host/${q.id}" data-link>${q.live ? 'Back to game' : 'Host'}</a>
            <a class="btn small" href="/edit/${q.id}" data-link>Edit</a>
            <button class="ghost" data-del="${q.id}">Delete</button>
          </div>
        </div>
      </article>`;

    const playedRow = (e) => `
      <li class="prow">
        <span class="pavatar">${e.live ? '<i class="livedot"></i>' : e.done && e.rank ? ordinal(e.rank) : '–'}</span>
        <span class="pmain"><strong>${esc(e.quizTitle)}</strong>
          <small>as ${esc(e.name)} · ${ago(e.at)}</small></span>
        ${e.live ? `<a class="btn primary small" href="/play?pin=${e.pin}" data-link>Rejoin →</a>`
          : e.done ? `<span class="pscore">${fmt(e.score)} pts<small>${ordinal(e.rank)} of ${e.count}</small></span>`
          : '<span class="pscore dim">Left early</span>'}
      </li>`;

    // Draw at once from the last copy this browser saw, then refresh from the server.
    const CACHE = 'blitz:me';
    let shown = '';
    const paint = (me) => {
      const key = JSON.stringify(me);
      if (key === shown) return;
      const repaint = !!shown;
      shown = key;
      drawDashboard(me, quizCard, playedRow);
      if (repaint) app.firstElementChild.style.animation = 'none'; // quiet update, no second entrance
    };
    const cached = store.get(CACHE, localStorage);
    if (cached) paint(cached);
    else app.innerHTML = `<main class="page dash">${nav('<a class="btn primary small" href="/create" data-link>New quiz</a>')}
      <div class="solo"><p class="lede">Loading<span class="dots"></span></p></div></main>`;
    try {
      const me = await api('/api/me');
      store.set(CACHE, me, localStorage);
      if (alive) paint(me);
    } catch (err) { if (alive && !cached) toast(err.message); }
  }

  function drawDashboard(me, quizCard, playedRow) {
    app.innerHTML = `
      <main class="page dash">
        ${nav('<a class="btn primary small" href="/create" data-link>New quiz</a>')}
        <section class="create-head">
          <p class="eyebrow">Your dashboard</p>
          <h1 class="display">${me.quizzes.length || me.played.length ? 'Welcome <em>back.</em>' : 'Nothing here <em>yet.</em>'}</h1>
          <p class="lede">No sign-in needed. This browser is remembered for 7 days after your last visit, and each visit adds another 7.</p>
        </section>
        <section class="dash-sec">
          <div class="sec-head"><h2>My quizzes</h2><span class="count">${me.quizzes.length}</span></div>
          <div class="qgrid">
            ${me.quizzes.map(quizCard).join('')}
            <a class="card qtile newtile" href="/create" data-link><span>+</span>New quiz</a>
          </div>
        </section>
        <section class="dash-sec">
          <div class="sec-head"><h2>Recently played</h2><span class="count">${me.played.length}</span></div>
          ${me.played.length ? `<ul class="card plist">${me.played.map(playedRow).join('')}</ul>`
            : '<p class="empty">Games you join from this browser show up here.</p>'}
        </section>
      </main>`;

    app.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        const card = b.closest('.qtile');
        const title = $('h3', card).textContent;
        if (!confirm(`Delete “${title}”? This can’t be undone.`)) return;
        try {
          await api(`/api/quizzes/${b.dataset.del}/delete`, {});
          store.del(`blitz:draft:${b.dataset.del}`, localStorage);
          const c = store.get('blitz:me', localStorage);
          if (c) store.set('blitz:me', { ...c, quizzes: c.quizzes.filter((q) => q.id !== b.dataset.del) }, localStorage);
          card.remove();
          toast('Quiz deleted');
        } catch (err) { toast(err.message); }
      };
    });
  }

  // ---------- home ----------

  function viewHome() {
    app.innerHTML = `
      <main class="page home">
        ${nav('<a class="btn small" href="/create" data-link>New quiz</a>')}
        <section class="hero">
          <p class="eyebrow">Live quizzes · zero setup</p>
          <h1 class="mega">Ask.<br><em>Race.</em><br>Win.</h1>
          <p class="lede">Build a quiz in a minute, share one link, and watch the fastest right answers climb the board.</p>
          <div class="cta">
            <a class="btn primary" href="/create" data-link>Create a quiz <span>→</span></a>
            <form class="pinform" id="pinform">
              <input id="pin" inputmode="numeric" autocomplete="off" maxlength="7" placeholder="Game PIN" aria-label="Game PIN">
              <button class="btn">Join</button>
            </form>
          </div>
        </section>
        <section class="steps">
          <article><span>01</span><h3>Build</h3><p>A question, a picture, up to four answers. Mark the right one.</p></article>
          <article><span>02</span><h3>Share</h3><p>Open the lobby and send the link or the six-digit PIN.</p></article>
          <article><span>03</span><h3>Race</h3><p>Right answers score up to 1,000. Faster is worth more.</p></article>
        </section>
      </main>`;
    $('#pinform').onsubmit = (e) => {
      e.preventDefault();
      const pin = $('#pin').value.replace(/\D/g, '');
      if (pin.length !== 6) return toast('A game PIN has 6 digits');
      go(`/play?pin=${pin}`);
    };
  }

  // ---------- create ----------

  const blankQuestion = () => ({ type: 'quiz', title: '', image: null, answers: ['', '', '', ''], correct: 0, regions: [], time: 20 });

  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
      img.src = url;
    });
  }

  // Turn a saved quiz back into editor state. Pictures stay as URLs; the server keeps them on save.
  const fromSaved = (quiz) => ({
    v: quiz.v,
    title: quiz.title,
    cover: quiz.cover || null,
    questions: quiz.questions.map((q) => (q.type === 'pin'
      ? { ...blankQuestion(), type: 'pin', title: q.title, image: q.image, regions: q.regions, time: q.time }
      : { ...blankQuestion(), title: q.title, image: q.image, answers: [...q.answers, '', '', ''].slice(0, 4), correct: q.correct, time: q.time })),
  });

  async function viewCreate(editId) {
    const draftKey = editId ? `blitz:draft:${editId}` : 'blitz:draft';
    let d = store.get(draftKey, localStorage);
    if (editId) {
      let alive = true;
      cleanup = () => { alive = false; };
      app.innerHTML = `<main class="page create">${nav()}<div class="solo"><p class="lede">Loading<span class="dots"></span></p></div></main>`;
      let saved;
      try { saved = await api(`/api/quizzes/${editId}`); } catch (err) {
        if (!alive) return;
        app.innerHTML = `<main class="page center">${nav()}<div class="solo"><h1 class="display">${esc(err.message)}.</h1>
          <p class="lede">Quizzes can only be edited from the browser that made them.</p>
          <a class="btn primary" href="/dashboard" data-link>Go to dashboard</a></div></main>`;
        return;
      }
      if (!alive) return;
      if (!d || d.v !== saved.v) d = fromSaved(saved);   // unsaved local edits survive a refresh
    }
    d = d || { title: '', questions: [blankQuestion()] };
    const save = () => store.set(draftKey, d, localStorage);

    app.innerHTML = `
      <main class="page create">
        ${nav(`${editId ? `<a class="btn small" href="/host/${editId}" data-link>Cancel</a>` : ''}
          <button class="btn primary small" id="publish">${editId ? 'Save changes' : 'Save &amp; preview'} →</button>`)}
        <section class="create-head">
          <p class="eyebrow">${editId ? 'Editing quiz' : 'New quiz'}</p>
          <input class="title-input" id="title" maxlength="120" placeholder="Name your quiz" value="${esc(d.title)}" aria-label="Quiz title">
          <div id="cover"></div>
        </section>
        <div id="questions"></div>
        <button class="add" id="add"><span>+</span> Add question</button>
      </main>`;

    const list = $('#questions');
    const card = (q, i) => {
      const pin = q.type === 'pin';
      const regions = q.regions || [];
      const picture = q.image
        ? `<div class="drop has">
             ${pin ? pinBox(q.image, regions.map((r, k) => regionEl(r, k, true)).join(''), 'draw')
               : `<img src="${q.image}" alt=""><button class="ghost over" data-act="noimg">Remove picture</button>`}
           </div>`
        : `<label class="drop">
             <input type="file" accept="image/*" hidden>
             <span class="drop-hint"><b>Add a picture</b><small>${pin ? 'Required — players drop their pin on it' : 'Click or drop an image — optional'}</small></span>
           </label>`;
      return `
      <section class="card qcard" data-q="${i}">
        <header>
          <span class="num">${String(i + 1).padStart(2, '0')}</span>
          <div class="seg" role="group" aria-label="Question type">
            <button data-act="type" data-type="quiz" class="${pin ? '' : 'on'}" aria-pressed="${!pin}">Quiz</button>
            <button data-act="type" data-type="pin" class="${pin ? 'on' : ''}" aria-pressed="${pin}">Pin</button>
          </div>
          <span class="grow"></span>
          <label class="select">Time
            <select data-f="time">${TIMES.map((t) => `<option value="${t}" ${t === q.time ? 'selected' : ''}>${t}s</option>`).join('')}</select>
          </label>
          ${d.questions.length > 1 ? '<button class="ghost" data-act="del" aria-label="Remove question">Remove</button>' : ''}
        </header>
        <input class="q-input" data-f="title" maxlength="200" placeholder="${pin ? 'e.g. Tap the ugliest part of this UI' : 'Ask something…'}" value="${esc(q.title)}" aria-label="Question">
        ${picture}
        ${pin ? `<div class="pinrow"><p class="hint">${!q.image ? 'Add a picture, then drag on it to mark the right area.'
          : regions.length ? `${regions.length} area${regions.length === 1 ? '' : 's'} marked — pins landing inside score. Drag to add more.`
          : 'Drag on the picture to mark the right area. You can mark several.'}</p>
          ${q.image ? '<button class="ghost" data-act="noimg">Remove picture</button>' : ''}</div>` : `
        <div class="answers-edit">
          ${q.answers.map((a, k) => `
            <div class="ans t${k}">
              <b>${L[k]}</b>
              <input data-f="answer" data-k="${k}" maxlength="100" placeholder="${k < 2 ? 'Answer' : 'Answer (optional)'}" value="${esc(a)}" aria-label="Answer ${L[k]}">
              <label class="pick" title="Mark as correct">
                <input type="radio" name="correct-${i}" data-f="correct" value="${k}" ${q.correct === k ? 'checked' : ''}><i>✓</i>
              </label>
            </div>`).join('')}
        </div>
        <p class="hint">Tap ✓ on the correct answer.</p>`}
      </section>`;
    };
    const draw = () => { list.innerHTML = d.questions.map(card).join(''); };
    draw();

    // The intro picture: shown in the lobby while players join, and on the dashboard tile.
    const coverBox = $('#cover');
    const drawCover = () => {
      coverBox.innerHTML = d.cover
        ? `<div class="drop has intro"><img src="${d.cover}" alt="">
             <button class="ghost over" id="nocover">Remove intro picture</button></div>`
        : `<label class="drop intro">
             <input type="file" accept="image/*" hidden id="coverfile">
             <span class="drop-hint"><b>Add an intro picture</b><small>Shown in the lobby while players join — optional</small></span>
           </label>`;
    };
    const setCover = async (file) => {
      if (!file || !file.type.startsWith('image/')) return;
      try { d.cover = await shrink(file); } catch { return toast("Couldn't read that picture"); }
      save(); drawCover();
    };
    drawCover();
    coverBox.addEventListener('change', (e) => { if (e.target.id === 'coverfile') setCover(e.target.files[0]); });
    coverBox.addEventListener('click', (e) => {
      if (e.target.id !== 'nocover') return;
      e.preventDefault(); d.cover = null; save(); drawCover();
    });
    coverBox.addEventListener('dragover', (e) => { if (e.target.closest('.drop')) e.preventDefault(); });
    coverBox.addEventListener('drop', (e) => { e.preventDefault(); setCover(e.dataTransfer.files[0]); });

    const qOf = (el) => d.questions[+el.closest('[data-q]').dataset.q];
    const setImage = async (q, file) => {
      if (!file || !file.type.startsWith('image/')) return;
      try { q.image = await shrink(file); } catch { return toast("Couldn't read that picture"); }
      save(); draw();
    };

    $('#title').oninput = (e) => { d.title = e.target.value; save(); };
    list.addEventListener('input', (e) => {
      const f = e.target.dataset.f;
      if (!f) return;
      const q = qOf(e.target);
      if (f === 'title') q.title = e.target.value;
      else if (f === 'answer') q.answers[+e.target.dataset.k] = e.target.value;
      else if (f === 'time') q.time = +e.target.value;
      else if (f === 'correct') q.correct = +e.target.value;
      save();
    });
    list.addEventListener('change', (e) => {
      if (e.target.type === 'file') setImage(qOf(e.target), e.target.files[0]);
    });
    list.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!t) return;
      e.preventDefault();
      const i = +t.closest('[data-q]').dataset.q;
      const q = d.questions[i];
      const act = t.dataset.act;
      if (act === 'del') d.questions.splice(i, 1);
      if (act === 'noimg') { q.image = null; q.regions = []; }
      if (act === 'type') q.type = t.dataset.type;
      if (act === 'rdel') q.regions.splice(+t.dataset.r, 1);
      save(); draw();
    });
    // Drag on a pin picture to draw a target area.
    list.addEventListener('pointerdown', (e) => {
      const box = e.target.closest('.pinbox.draw');
      if (!box || e.target.closest('button') || e.button !== 0) return;
      const q = qOf(box);
      q.regions = q.regions || [];
      if (q.regions.length >= 8) return toast('Up to 8 areas per question');
      e.preventDefault();
      const [sx, sy] = fracAt(box, e);
      const el = document.createElement('div');
      el.className = 'region drawing';
      box.appendChild(el);
      let r = null;
      const move = (ev) => {
        const [x, y] = fracAt(box, ev);
        r = { x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy) };
        Object.assign(el.style, { left: pct(r.x), top: pct(r.y), width: pct(r.w), height: pct(r.h) });
      };
      const up = () => {
        box.removeEventListener('pointermove', move);
        box.removeEventListener('pointerup', up);
        box.removeEventListener('pointercancel', up);
        if (r && r.w > 0.02 && r.h > 0.02) {
          q.regions.push({ x: r4(r.x), y: r4(r.y), w: r4(r.w), h: r4(r.h) });
          save(); draw();
        } else el.remove();
      };
      box.setPointerCapture(e.pointerId);
      box.addEventListener('pointermove', move);
      box.addEventListener('pointerup', up);
      box.addEventListener('pointercancel', up);
    });
    list.addEventListener('dragover', (e) => { if (e.target.closest('.drop')) e.preventDefault(); });
    list.addEventListener('drop', (e) => {
      const drop = e.target.closest('.drop');
      if (!drop) return;
      e.preventDefault();
      setImage(qOf(drop), e.dataTransfer.files[0]);
    });
    $('#add').onclick = () => {
      d.questions.push(blankQuestion());
      save(); draw();
      list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('.q-input', list.lastElementChild).focus({ preventScroll: true });
    };

    $('#publish').onclick = async () => {
      const payload = { title: d.title.trim(), cover: d.cover || null, questions: [] };
      if (!payload.title) { $('#title').focus(); return toast('Give your quiz a title'); }
      for (const [i, q] of d.questions.entries()) {
        const n = i + 1;
        if (!q.title.trim()) return toast(`Question ${n} needs a title`);
        if (q.type === 'pin') {
          if (!q.image) return toast(`Question ${n} needs a picture to pin on`);
          if (!q.regions?.length) return toast(`Question ${n}: drag on the picture to mark the right area`);
          payload.questions.push({ type: 'pin', title: q.title.trim(), image: q.image, regions: q.regions, time: q.time });
          continue;
        }
        const kept = q.answers.map((a, k) => ({ a: a.trim(), k })).filter((x) => x.a);
        if (kept.length < 2) return toast(`Question ${n} needs at least 2 answers`);
        const correct = kept.findIndex((x) => x.k === q.correct);
        if (correct < 0) return toast(`Question ${n}: the answer marked correct is empty`);
        payload.questions.push({ title: q.title.trim(), image: q.image, answers: kept.map((x) => x.a), correct, time: q.time });
      }
      const btn = $('#publish');
      btn.disabled = true;
      try {
        const { id } = await api(editId ? `/api/quizzes/${editId}` : '/api/quizzes', payload);
        store.del(draftKey, localStorage);
        if (editId) toast('Changes saved');
        go(`/host/${id}`);
      } catch (err) { toast(err.message); btn.disabled = false; }
    };
  }

  // ---------- host ----------

  async function viewHost(id) {
    const sessionKey = `blitz:host:${id}`;
    let alive = true;
    let stop = null;
    cleanup = () => { alive = false; if (stop) stop(); };

    const problem = (msg) => {
      app.innerHTML = `<main class="page center">${nav()}<div class="solo"><h1 class="display">${esc(msg)}.</h1>
        <p class="lede">Quizzes can only be hosted from the browser that made them.</p>
        <a class="btn primary" href="/dashboard" data-link>Go to dashboard</a></div></main>`;
    };

    app.innerHTML = `<main class="page center">${nav()}<div class="solo"><p class="lede">Loading<span class="dots"></span></p></div></main>`;
    let quiz, info, running;
    try {
      [quiz, info, running] = await Promise.all([
        api(`/api/quizzes/${id}`),
        api('/api/info').catch(() => ({})),
        store.get(sessionKey) ? null : api('/api/host', { quizId: id, resume: true }).catch(() => null),
      ]);
    } catch (err) { if (alive) problem(err.message); return; }
    if (!alive) return;
    if (running?.pin) store.set(sessionKey, running);   // a lobby you left open (e.g. from the dashboard)

    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const origin = local && info.lanUrl ? info.lanUrl : location.origin;

    const act = (s, action) => api('/api/act', { pin: s.pin, token: s.token, action }).catch((e) => toast(e.message));

    function watch(session) {
      if (stop) stop();
      stop = live(`/api/stream?pin=${session.pin}&token=${encodeURIComponent(session.token)}`,
        (s) => renderHost(s, session),
        () => { store.del(sessionKey); if (alive) preview(); });
    }

    async function openLobby() {
      try {
        const session = await api('/api/host', { quizId: id });
        store.set(sessionKey, session);
        viewKey = '';
        watch(session);
      } catch (err) { toast(err.message); }
    }

    function preview() {
      viewKey = 'preview';
      const n = quiz.questions.length;
      app.innerHTML = `
        <main class="page preview">
          ${nav(`<a class="btn small" href="/edit/${id}" data-link>Edit</a><button class="btn primary small" id="open">Open lobby →</button>`)}
          <section class="create-head">
            <p class="eyebrow">Preview · ${n} question${n === 1 ? '' : 's'}</p>
            <h1 class="display">${esc(quiz.title)}</h1>
            <p class="lede">This is what players will see. When it looks right, open the lobby to get your link and PIN.</p>
          </section>
          ${quiz.cover ? `<figure class="intro-banner"><img src="${quiz.cover}" alt="" decoding="async"><figcaption>Intro · shown in the lobby</figcaption></figure>` : ''}
          ${quiz.questions.map((q, i) => `
            <section class="card pcard">
              <header><span class="num">${String(i + 1).padStart(2, '0')}</span><span class="grow"></span>
                <span class="pill dim">${q.type === 'pin' ? 'Pin' : 'Quiz'}</span><span class="pill">${q.time}s</span></header>
              <h2>${esc(q.title)}</h2>
              ${q.type === 'pin'
                ? `${pinBox(q.image, q.regions.map((r) => regionEl(r)).join(''))}<p class="hint">Pins inside the highlighted area${q.regions.length > 1 ? 's' : ''} score.</p>`
                : `${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
                   ${tiles(q.answers, (k) => (k === q.correct ? { cls: 'right', extra: '<em>✓ Correct</em>' } : { cls: 'soft' }))}`}
            </section>`).join('')}
          <div class="cta end"><button class="btn primary" id="open2">Open lobby →</button></div>
        </main>`;
      $('#open').onclick = $('#open2').onclick = openLobby;
    }

    function renderHost(s, session) {
      if (!alive) return;
      s.token = session.token;
      if (s.phase === 'question') { duration = s.question.time * 1000; deadline = performance.now() + s.remaining; queueMicrotask(startTicker); }
      const key2 = `host:${s.phase}:${s.qIndex}`;

      if (key2 === viewKey) {                       // same screen: patch the live bits only
        if (s.phase === 'lobby') lobbyBits(s);
        if (s.phase === 'question') $('#answered').textContent = `${s.answered} / ${s.count} answered`;
        return;
      }
      viewKey = key2;

      if (s.phase === 'lobby') {
        const link = `${origin}/play?pin=${s.pin}`;
        app.innerHTML = `
          <main class="page lobby">
            ${nav(`<span class="pill">${esc(s.quizTitle)}</span><button class="ghost" id="close">Close lobby</button>`)}
            ${s.cover ? `<figure class="intro-banner"><img src="${s.cover}" alt="" decoding="async"><figcaption>${esc(s.quizTitle)}</figcaption></figure>` : ''}
            <section class="lobby-grid">
              <div class="card joinbox">
                <p class="eyebrow">Join at <strong>${esc(origin.replace(/^https?:\/\//, ''))}</strong></p>
                <div class="pin" aria-label="Game PIN">${pinText(s.pin)}</div>
                <div class="linkrow">
                  <input readonly value="${esc(link)}" aria-label="Join link" id="link">
                  <button class="btn" id="copy">Copy link</button>
                </div>
              </div>
              <div class="roster">
                <div class="roster-head">
                  <h2><span id="pcount">0</span> <small id="plabel">players</small></h2>
                  <button class="btn primary" id="next" disabled>Start game →</button>
                </div>
                <div class="chips" id="chips"></div>
              </div>
            </section>
          </main>`;
        $('#link').onclick = (e) => e.target.select();
        $('#copy').onclick = async () => {
          try { await navigator.clipboard.writeText(link); toast('Link copied'); }
          catch { $('#link').select(); toast('Press ⌘C to copy'); }
        };
        $('#close').onclick = () => act(s, 'end');
        $('#next').onclick = () => act(s, 'next');
        lobbyBits(s);
        return;
      }

      if (s.phase === 'question' || s.phase === 'reveal') {
        const reveal = s.phase === 'reveal';
        const last = s.qIndex + 1 === s.total;
        const q = s.question;
        const pin = q.type === 'pin';
        const visual = pin
          ? `${pinBox(q.image, reveal
              ? s.regions.map((r) => regionEl(r)).join('') + s.pins.map((p) => marker(p.x, p.y, `small drop-in ${p.ok ? 'ok' : 'miss'}`, p.name)).join('')
              : '')}
             ${reveal ? `<p class="pinstat"><strong>${s.hits}</strong> of ${s.count} landed inside</p>` : ''}`
          : q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : '';
        app.innerHTML = `
          <main class="page stage ${reveal ? 'is-reveal' : ''} ${pin ? 'pinq' : ''}">
            <div class="timerbar"><i data-bar ${reveal ? 'style="transform:scaleX(0)"' : ''}></i></div>
            <header class="bar">
              <span class="pill">${s.qIndex + 1} / ${s.total}</span>
              <span class="pill dim">PIN ${pinText(s.pin)}</span>
              <span class="grow"></span>
              ${reveal
                ? `<button class="btn primary small" id="next">${last ? 'Show podium' : 'Next question'} →</button>`
                : `<span class="pill" id="answered">${s.answered} / ${s.count} answered</span>
                   <button class="btn small" id="next">Skip</button>`}
            </header>
            <section class="qwrap">
              <div class="qmain">
                <h1 class="qtitle">${esc(q.title)}</h1>
                ${visual}
              </div>
              ${reveal
                ? `<aside class="card side"><p class="eyebrow">Leaderboard</p><ol class="board">${boardRows(s.players, 5)}</ol></aside>`
                : '<div class="clock"><span data-secs></span></div>'}
            </section>
            ${pin ? '' : tiles(q.answers, (i) => (!reveal ? {} : {
              cls: i === s.correct ? 'right' : 'dimmed',
              extra: `<em>${i === s.correct ? '✓ ' : ''}${s.counts[i]}</em>`,
            }))}
          </main>`;
        $('#next').onclick = () => act(s, 'next');
        return;
      }

      // final
      const top = s.players.slice(0, 3);
      const order = [top[1], top[0], top[2]];
      app.innerHTML = `
        <main class="page final">
          ${nav(`<span class="pill">${esc(s.quizTitle)}</span>`)}
          <section class="final-head">
            <p class="eyebrow">Final standings</p>
            <h1 class="display">${top[0] ? `${esc(top[0].name)} <em>wins.</em>` : 'Game over.'}</h1>
          </section>
          <div class="podium">
            ${order.map((p, i) => (p ? `
              <div class="step s${[2, 1, 3][i]}">
                <strong>${esc(p.name)}</strong><span>${fmt(p.score)}</span>
                <div class="block">${[2, 1, 3][i]}</div>
              </div>` : '<div class="step"></div>')).join('')}
          </div>
          ${s.players.length > 3 ? `<ol class="board card rest" start="4">${s.players.slice(3).map((p, i) => `
            <li><span class="rank">${i + 4}</span><span class="name">${esc(p.name)}</span><span class="score">${fmt(p.score)}</span></li>`).join('')}</ol>` : ''}
          <div class="cta end">
            <button class="btn primary" id="again">Play again</button>
            <a class="btn" href="/" data-link>Done</a>
          </div>
        </main>`;
      $('#again').onclick = async () => { await act(s, 'end'); store.del(sessionKey); openLobby(); };
    }

    function lobbyBits(s) {
      $('#pcount').textContent = s.count;
      $('#plabel').textContent = s.count === 1 ? 'player' : 'players';
      $('#next').disabled = s.count === 0;
      $('#chips').innerHTML = s.players.length
        ? s.players.map((p) => `<span class="chip">${esc(p.name)}</span>`).join('')
        : '<p class="waiting">Waiting for players<span class="dots"></span></p>';
    }

    const session = store.get(sessionKey);
    if (session) watch(session); else preview();
  }

  // ---------- play ----------

  function viewPlay() {
    const sessionKey = 'blitz:player';
    const urlPin = (new URLSearchParams(location.search).get('pin') || '').replace(/\D/g, '');
    let alive = true;
    let stop = null;
    cleanup = () => { alive = false; if (stop) stop(); };

    const solo = (inner) => { app.innerHTML = `<main class="page center">${nav()}<div class="solo">${inner}</div></main>`; };

    function joinForm(note) {
      viewKey = 'join';
      solo(`
        <p class="eyebrow">${note || 'Join a game'}</p>
        <h1 class="display">You’re almost <em>in.</em></h1>
        <form class="joinform" id="join">
          <input id="pin" inputmode="numeric" autocomplete="off" maxlength="7" placeholder="Game PIN" value="${esc(urlPin)}" aria-label="Game PIN">
          <input id="name" autocomplete="off" maxlength="16" placeholder="Nickname" aria-label="Nickname">
          <button class="btn primary">Join game →</button>
        </form>`);
      $(urlPin ? '#name' : '#pin').focus();
      $('#join').onsubmit = async (e) => {
        e.preventDefault();
        const pin = $('#pin').value.replace(/\D/g, '');
        const name = $('#name').value.trim();
        if (pin.length !== 6) return toast('A game PIN has 6 digits');
        if (!name) return toast('Pick a nickname');
        try {
          const session = await api('/api/join', { pin, name });
          store.set(sessionKey, session);
          watch(session);
        } catch (err) { toast(err.message); }
      };
    }

    function watch(session) {
      if (stop) stop();
      stop = live(`/api/stream?pin=${session.pin}&player=${encodeURIComponent(session.player)}`,
        (s) => renderPlayer(s, session),
        () => { store.del(sessionKey); if (alive) joinForm('That game has ended'); });
    }

    function renderPlayer(s, session) {
      if (!alive) return;
      if (s.phase === 'question') { duration = s.question.time * 1000; deadline = performance.now() + s.remaining; queueMicrotask(startTicker); }
      const key = `play:${s.phase}:${s.qIndex}:${s.choice}`;
      if (key === viewKey) return;
      viewKey = key;
      const me = `<span class="pill">${esc(s.name)}</span><span class="pill score-pill">${fmt(s.score)}</span>`;
      const centered = (inner) => { app.innerHTML = `<main class="page center">${nav(me)}<div class="solo">${inner}</div></main>`; };

      if (s.phase === 'lobby') {
        return centered(`
          ${s.cover ? `<img class="intro-img" src="${s.cover}" alt="" decoding="async">`
            : `<div class="avatar">${esc(s.name.slice(0, 1).toUpperCase())}</div>`}
          <h1 class="display">You’re in, <em>${esc(s.name)}.</em></h1>
          <p class="lede">Eyes on the host’s screen — the game starts any second<span class="dots"></span></p>`);
      }

      if (s.phase === 'question' && s.choice === null && s.question.type === 'pin') {
        const q = s.question;
        app.innerHTML = `
          <main class="page stage player pinq">
            <div class="timerbar"><i data-bar></i></div>
            <header class="bar">
              <span class="pill">${s.qIndex + 1} / ${s.total}</span>
              <span class="grow"></span>
              <span class="pill timer"><span data-secs></span>s</span>
            </header>
            <section class="qwrap"><div class="qmain">
              <h1 class="qtitle">${esc(q.title)}</h1>
              ${pinBox(q.image, '', 'tap')}
              <p class="hint" id="pinhint">Tap the picture to drop your pin</p>
            </div></section>
            <div class="lockbar"><button class="btn primary" id="lock" disabled>Lock in pin →</button></div>
          </main>`;
        let pick = null;
        const box = $('.pinbox');
        box.onpointerdown = (e) => {
          if (box.classList.contains('locked')) return;
          e.preventDefault();
          const [x, y] = fracAt(box, e);
          pick = { x: r4(x), y: r4(y) };
          box.querySelector('.marker')?.remove();
          box.insertAdjacentHTML('beforeend', marker(x, y, 'drop-in'));
          buzz(8);
          $('#lock').disabled = false;
          $('#pinhint').textContent = 'Tap again to move it';
        };
        $('#lock').onclick = () => {
          if (!pick) return;
          $('#lock').disabled = true;
          box.classList.add('locked');
          buzz(12);
          api('/api/act', { pin: session.pin, player: session.player, action: 'answer', choice: pick })
            .catch((err) => { toast(err.message); $('#lock').disabled = false; box.classList.remove('locked'); });
        };
        return;
      }

      if (s.phase === 'question' && s.choice === null) {
        const q = s.question;
        app.innerHTML = `
          <main class="page stage player">
            <div class="timerbar"><i data-bar></i></div>
            <header class="bar">
              <span class="pill">${s.qIndex + 1} / ${s.total}</span>
              <span class="grow"></span>
              <span class="pill timer"><span data-secs></span>s</span>
            </header>
            <section class="qwrap"><div class="qmain">
              <h1 class="qtitle">${esc(q.title)}</h1>
              ${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
            </div></section>
            ${tiles(q.answers, () => ({ button: true }))}
          </main>`;
        $('.tiles').onclick = (e) => {
          const t = e.target.closest('[data-choice]');
          if (!t) return;
          document.querySelectorAll('.tile').forEach((el) => { el.disabled = true; el.classList.toggle('dimmed', el !== t); });
          buzz(12);
          api('/api/act', { pin: session.pin, player: session.player, action: 'answer', choice: +t.dataset.choice })
            .catch((err) => toast(err.message));
        };
        return;
      }

      if (s.phase === 'question') {
        return centered(`
          ${s.question.type === 'pin' ? `<div class="avatar pin-avatar">${PIN}</div>` : `<div class="avatar t${s.choice}">${L[s.choice]}</div>`}
          <h1 class="display">Locked <em>in.</em></h1>
          <p class="lede">Waiting for everyone else<span class="dots"></span></p>`);
      }

      if (s.phase === 'reveal') {
        const right = s.right;
        const pin = s.question.type === 'pin';
        const why = right ? (pin ? 'Right on target.' : 'Correct — nicely done.')
          : pin ? (s.choice === null ? 'Here’s where the right area was.' : 'Your pin landed outside the area.')
          : `The answer was <strong>${esc(s.question.answers[s.correct])}</strong>.`;
        buzz(right ? [14, 60, 14] : 40);
        return centered(`
          <div class="verdict ${right ? 'good' : 'bad'}">${right ? '✓' : '✕'}</div>
          <h1 class="display">${right ? `+${fmt(s.gained)}` : s.choice === null ? 'Time’s <em>up.</em>' : 'Not <em>quite.</em>'}</h1>
          <p class="lede">${why}</p>
          ${pin ? pinBox(s.question.image, s.regions.map((r) => regionEl(r)).join('')
            + (s.choice ? marker(s.choice[0], s.choice[1], `drop-in ${right ? 'ok' : 'miss'}`) : ''), 'result') : ''}
          <p class="standing">${ordinal(s.rank)} of ${s.count} · ${fmt(s.score)} pts</p>`);
      }

      centered(`
        <p class="eyebrow">Final result</p>
        <h1 class="mega small">${ordinal(s.rank)}</h1>
        <p class="lede">${s.rank === 1 ? 'You won. Take a bow.' : `out of ${s.count} players`}</p>
        <p class="standing">${fmt(s.score)} pts</p>
        <a class="btn" href="/" data-link>Done</a>`);
    }

    const session = store.get(sessionKey);
    if (session && (!urlPin || urlPin === session.pin)) watch(session);
    else if (urlPin.length === 6) {
      // This browser may already be in that game (e.g. "Rejoin" from the dashboard): skip the form.
      api('/api/join', { pin: urlPin, rejoin: true })
        .then((r) => {
          if (!alive) return;
          if (r.player) { store.set(sessionKey, r); watch(r); } else joinForm();
        })
        .catch(() => { if (alive) joinForm(); });
    } else joinForm();
  }

  // ---------- rounded text selection ----------
  // One rounded pill per selected line, drawn behind the words. Each pill lives in the
  // surface its line sits on (card, tile, nav, or the page), above that surface's background
  // and below its text. Only does work while something is selected.
  const SURFACES = '.card, .nav, .tile';
  const pageLayer = document.createElement('div');
  pageLayer.id = 'hl';
  pageLayer.setAttribute('aria-hidden', 'true');
  (document.querySelector('.aurora') || document.body.firstChild).after(pageLayer);  // just above the denim, below everything else
  const pills = [];
  let hlFrame = 0;
  const layerFor = (surface) => {
    if (!surface) return pageLayer;
    let layer = surface.querySelector(':scope > .hl-layer');
    if (!layer) { layer = document.createElement('span'); layer.className = 'hl-layer'; layer.setAttribute('aria-hidden', 'true'); surface.prepend(layer); }
    return layer;
  };
  const clearPills = () => { while (pills.length) pills.pop().remove(); };
  function drawSelection() {
    hlFrame = 0;
    const sel = getSelection();
    const field = document.activeElement?.matches?.('input, textarea');
    if (!sel || sel.isCollapsed || !sel.rangeCount || field) return clearPills();
    // Merge the browser's per-fragment boxes into one box per line.
    const lines = [];
    for (const r of sel.getRangeAt(0).getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      const line = lines.find((l) => Math.abs((l.top + l.bottom) / 2 - (r.top + r.bottom) / 2) < r.height / 3);
      if (line) {
        line.left = Math.min(line.left, r.left); line.right = Math.max(line.right, r.right);
        line.top = Math.min(line.top, r.top); line.bottom = Math.max(line.bottom, r.bottom);
      } else lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }
    while (pills.length > lines.length) pills.pop().remove();
    lines.forEach((l, i) => {
      const h = l.bottom - l.top;
      const cx = (l.left + l.right) / 2, cy = (l.top + l.bottom) / 2;
      const hit = document.elementsFromPoint(cx, cy).find((el) => !el.closest('#hl, .hl-layer'));
      const surface = hit?.closest(SURFACES);
      const layer = layerFor(surface);
      const box = surface ? surface.getBoundingClientRect() : { left: 0, top: 0 };
      const pill = pills[i] || (pills[i] = document.createElement('i'));
      if (pill.parentNode !== layer) layer.append(pill);
      const ph = h * 0.78, padX = Math.min(10, h * 0.18), radius = Math.min(14, ph * 0.32);
      pill.style.cssText = `left:${l.left - box.left - padX}px;top:${cy - box.top - ph / 2}px;` +
        `width:${l.right - l.left + padX * 2}px;height:${ph}px;border-radius:${radius}px ${radius * 0.7}px ${radius}px ${radius * 0.8}px`;
    });
  }
  const queueSelection = () => { if (!hlFrame) hlFrame = requestAnimationFrame(drawSelection); };
  document.addEventListener('selectionchange', queueSelection);
  addEventListener('scroll', () => { if (pills.length) queueSelection(); }, { passive: true, capture: true });
  addEventListener('resize', () => { if (pills.length) queueSelection(); });

  route();
})();
