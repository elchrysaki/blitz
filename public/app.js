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
  // ---------- player avatars ----------
  // Original egg-headed characters with a simple, graphic face (solid oval eyes, short brows,
  // a soft nose, a one-line mouth), 2000s hair and accessories, and old-school 3D shading.
  // Each player gets a random one when they join; the server picks it so every screen matches.
  const AV = {
    skin: ['#FBDCC4', '#F1BE94', '#D99B6C', '#B47648', '#8C5428', '#5E3A22'],
    hair: ['#2A1A12', '#4B2C1C', '#7A2331', '#B8732F', '#E6B866', '#EDE3D2', '#151B24'],
    streak: ['#F4D58D', '#EDE3D2', '#FF7A45', '#D4EEF6'],
    top: ['#FF5A1F', '#1FA8D2', '#D4EEF6', '#EBC9A5'],
  };
  const hashName = (str) => {
    let h = 2166136261;
    for (const ch of str.toLowerCase()) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  // Colour helpers for the 3D shading: mix a colour toward white (light) or near-black (shade).
  const mixHex = (hex, to, t) => '#' + [1, 3, 5].map((i) => {
    const a = parseInt(hex.slice(i, i + 2), 16), b = parseInt(to.slice(i, i + 2), 16);
    return Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
  }).join('');
  const light = (hex, t) => mixHex(hex, '#ffffff', t);
  const shade = (hex, t) => mixHex(hex, '#140c08', t);

  function avatar(seed) {
    const key = String(seed || '?').trim();   // the random "look" the server picked (or a name, as a fallback)
    const pick = (arr, trait) => arr[hashName(`${trait}:${key}`) % arr.length];  // each trait from its own hash
    const chance = (pct, trait) => hashName(`${trait}?${key}`) % 100 < pct;
    const skin = pick(AV.skin, 's'), hair = pick(AV.hair, 'h'), streak = pick(AV.streak, 'k');
    const top = pick(AV.top, 't');
    const style = pick([0, 1, 2, 3, 4, 5, 6], 'y'), outfit = pick([0, 1, 2, 3], 'o');
    const ink = '#1B1210', gold = '#E2A93B', gem = '#1FA8D2';
    const accent = top === '#FF5A1F' ? '#1FA8D2' : '#FF5A1F';   // scrunchies, clips, bandanas: a contrasting pop

    // hair behind the head
    const back = [
      `<path d="M13 50Q13 12 50 12Q87 12 87 50L90 106Q70 112 50 110Q30 112 10 106Z" fill="${hair}"/>`,
      `<path d="M60 22Q96 2 90 44Q94 66 80 74Q88 52 80 36Q76 26 64 26Z" fill="${hair}"/><circle cx="70" cy="20" r="7" fill="${accent}"/>`,
      `<circle cx="24" cy="20" r="13" fill="${hair}"/><circle cx="76" cy="20" r="13" fill="${hair}"/>`,
      `<path d="M13 48Q13 13 50 13Q87 13 87 48L87 78Q93 86 99 82Q93 92 80 87L20 87Q7 92 1 82Q7 86 13 78Z" fill="${hair}"/>`,
      '',
      `<path d="M14 50Q14 16 50 16Q86 16 86 50L86 90Q50 96 14 90Z" fill="${hair}"/>`,
      `<g fill="${hair}"><circle cx="16" cy="42" r="15"/><circle cx="84" cy="42" r="15"/><circle cx="14" cy="66" r="13"/><circle cx="86" cy="66" r="13"/><circle cx="20" cy="86" r="11"/><circle cx="80" cy="86" r="11"/><circle cx="30" cy="22" r="16"/><circle cx="70" cy="22" r="16"/><circle cx="50" cy="15" r="16"/></g>`,
    ][style];

    // outfit
    const outfits = [
      // tube top: bare shoulders, a band of colour
      `<path d="M14 120Q14 94 50 94Q86 94 86 120Z" fill="${skin}"/><rect x="18" y="104" width="64" height="16" rx="3" fill="${top}"/><path d="M18 106H82" stroke="#fff" stroke-opacity=".45" stroke-width="1.6"/>`,
      // velour hoodie with zip
      `<path d="M14 120Q14 92 50 92Q86 92 86 120Z" fill="${top}"/><path d="M36 93Q50 106 64 93" fill="none" stroke="${ink}" stroke-opacity=".25" stroke-width="2.4"/><path d="M50 101V120" stroke="${ink}" stroke-opacity=".3" stroke-width="1.6" stroke-dasharray="2 2"/>`,
      // halter
      `<path d="M14 120Q14 94 50 94Q86 94 86 120Z" fill="${skin}"/><path d="M30 120L44 96M70 120L56 96" stroke="${top}" stroke-width="3"/><path d="M24 120Q50 100 76 120Z" fill="${top}"/>`,
      // baby tee with a rhinestone star
      `<path d="M14 120Q14 92 50 92Q86 92 86 120Z" fill="${top}"/><path d="M50 103l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8Z" fill="#fff" opacity=".9"/>`,
    ][outfit];

    // face: simple and graphic — solid oval eyes, short rounded brows, a soft nose, a one-line mouth
    const browColor = hair === '#EDE3D2' ? '#8B6A4A' : shade(hair, 0.15);
    const eyeStyle = pick([0, 0, 0, 1, 2, 3], 'e');
    const eye = (cx, right) => {
      if (eyeStyle === 1 || (eyeStyle === 2 && right)) // happy arc (both), or a wink (right eye)
        return `<path d="M${cx - 4.6} 58.5Q${cx} 52.5 ${cx + 4.6} 58.5" fill="none" stroke="${ink}" stroke-width="2.8" stroke-linecap="round"/>`;
      if (eyeStyle === 3) return `<circle cx="${cx}" cy="57" r="2.8" fill="${ink}"/>`;  // dot eyes
      return `<ellipse cx="${cx}" cy="57" rx="3.4" ry="4.7" fill="${ink}"/><circle cx="${cx + 1.1}" cy="55.2" r="1.25" fill="#fff"/>`;
    };
    const brows = [
      'M32 47.5Q37.5 45.5 43 47.5M57 47.5Q62.5 45.5 68 47.5',   // relaxed
      'M32 46Q37.5 41.5 43 45M57 45Q62.5 41.5 68 46',           // raised
      'M32 45L43 48M57 48L68 45',                               // determined
      'M32 48L43 45.5M57 45.5L68 48',                           // worried
    ][pick([0, 0, 1, 2, 3], 'b')];
    const mouths = [
      `<path d="M42.5 71.5Q50 77.5 57.5 71.5" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`,
      `<path d="M41.5 70.5Q50 81 58.5 70.5Z" fill="${ink}"/><path d="M43.4 71.2Q50 73.6 56.6 71.2L56 72.8Q50 75 44 72.8Z" fill="#fff"/>`,
      `<ellipse cx="50" cy="73" rx="2.8" ry="3.4" fill="${ink}"/>`,
      `<path d="M44 73.5Q51 75.5 57 71" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`,
    ][pick([0, 0, 1, 1, 2, 3], 'm')];
    const nose = `<path d="M47.6 64.5Q50 67 52.4 64.5" fill="none" stroke="${shade(skin, 0.35)}" stroke-width="2" stroke-linecap="round"/>`;

    // hair in front of the face
    const front = [
      `<path d="M15 54Q15 15 50 14Q85 15 85 52Q80 33 64 29Q46 40 22 46Q18 49 15 54Z" fill="${hair}"/><path d="M34 21Q28 34 24 46M62 18Q56 26 50 38" stroke="${streak}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
      `<path d="M16 50Q16 15 50 15Q84 15 84 50Q78 27 50 26Q22 27 16 50Z" fill="${hair}"/><path d="M40 17Q46 22 50 26" stroke="${streak}" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/>`,
      `<path d="M16 50Q16 16 50 16Q84 16 84 50Q78 28 50 27Q22 28 16 50Z" fill="${hair}"/><path d="M50 17V27" stroke="${ink}" stroke-opacity=".25" stroke-width="1.6"/>
       <g transform="translate(26 31) rotate(-18)"><path d="M0 0Q-6 -7 -8 0Q-6 6 0 0Q6 -7 8 0Q6 6 0 0Z" fill="${accent}"/></g>
       <g transform="translate(74 31) rotate(18)"><path d="M0 0Q-6 -7 -8 0Q-6 6 0 0Q6 -7 8 0Q6 6 0 0Z" fill="${gem}"/></g>`,
      `<path d="M16 50Q16 15 50 15Q84 15 84 50L82 42Q50 30 18 42Z" fill="${hair}"/>`,
      `<path d="M16 48L18 22L28 30L33 10L45 25L53 7L61 24L70 11L74 30L82 21L84 48Q70 31 50 31Q30 31 16 48Z" fill="${hair}"/>
       <path d="M18 22L23 27L21 23ZM33 10L38 18L35 14ZM53 7L56 16L55 11ZM70 11L72 20L71 15ZM82 21L80 27L81 24Z" fill="${streak}" stroke="${streak}" stroke-width="4" stroke-linejoin="round"/>`,
      `<path d="M14 46Q15 11 50 11Q85 11 86 46Q50 30 14 46Z" fill="${accent}"/><g fill="#fff" opacity=".75"><circle cx="34" cy="24" r="1.6"/><circle cx="50" cy="18" r="1.6"/><circle cx="66" cy="24" r="1.6"/><circle cx="42" cy="32" r="1.3"/><circle cx="58" cy="32" r="1.3"/></g>
       <circle cx="85" cy="44" r="4.6" fill="${accent}"/><path d="M87 46L95 54L90 55Z" fill="${accent}"/>`,
      `<path d="M20 44Q50 20 80 44" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>`,
    ][style];

    // extras
    const hoops = chance(55, 'hoop') && style !== 6 ? `<g fill="none" stroke="${gold}" stroke-width="2.4"><circle cx="13" cy="72" r="7"/><circle cx="87" cy="72" r="7"/></g>` : '';
    const shades = chance(25, 'shades') && style !== 5 && style !== 4
      ? `<g><rect x="28" y="22" width="19" height="11" rx="5.5" fill="${pick(['#FF7A45', '#1FA8D2', '#D4EEF6'], 'lens')}" opacity=".85" stroke="${ink}" stroke-width="1.8"/><rect x="53" y="22" width="19" height="11" rx="5.5" fill="${pick(['#FF7A45', '#1FA8D2', '#D4EEF6'], 'lens')}" opacity=".85" stroke="${ink}" stroke-width="1.8"/><path d="M47 27H53" stroke="${ink}" stroke-width="1.8"/></g>` : '';
    const tiara = !shades && chance(14, 'tiara') && [0, 1, 3].includes(style)
      ? `<path d="M36 20L40 11L45 17L50 6L55 17L60 11L64 20Z" fill="#F6F1E9" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/><circle cx="50" cy="15" r="2.2" fill="${gem}"/>` : '';

    // Old-school 3D: every surface is lit from the top left, hair gets a gloss streak, the head casts a shadow.
    const id = hashName(key).toString(36);
    const defs = `<defs>
      <radialGradient id="sk${id}" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="${light(skin, 0.38)}"/><stop offset=".5" stop-color="${skin}"/><stop offset="1" stop-color="${shade(skin, 0.28)}"/></radialGradient>
      <linearGradient id="hr${id}" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="${light(hair, 0.3)}"/><stop offset=".45" stop-color="${hair}"/><stop offset="1" stop-color="${shade(hair, 0.35)}"/></linearGradient>
      <linearGradient id="tp${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light(top, 0.3)}"/><stop offset="1" stop-color="${shade(top, 0.22)}"/></linearGradient>
      <radialGradient id="gl${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>`;
    const gloss = style === 5 ? '' : `<ellipse cx="37" cy="${style === 6 ? 20 : 22}" rx="13" ry="5" fill="url(#gl${id})" transform="rotate(-22 37 22)"/>`;
    const faceShine = `<ellipse cx="37" cy="38" rx="9" ry="6" fill="url(#gl${id})" opacity=".55"/>`;
    const chinShadow = `<ellipse cx="50" cy="93" rx="17" ry="4.5" fill="#140c08" opacity=".22"/>`;

    const svg = `<svg class="buddy-art" viewBox="0 0 100 120" aria-hidden="true">${defs}
      ${back}${outfits}
      <rect x="43" y="82" width="14" height="14" rx="5" fill="${skin}"/>
      <circle cx="16.5" cy="58" r="6" fill="${skin}"/><circle cx="83.5" cy="58" r="6" fill="${skin}"/>
      ${chinShadow}
      <path d="M50 15C73 15 85 33 85 54C85 76 70 92 50 92C30 92 15 76 15 54C15 33 27 15 50 15Z" fill="${skin}"/>${faceShine}
      ${hoops}
      <ellipse cx="30" cy="67" rx="5.4" ry="3" fill="#FF5A1F" opacity=".2"/><ellipse cx="70" cy="67" rx="5.4" ry="3" fill="#FF5A1F" opacity=".2"/>
      <path d="${brows}" fill="none" stroke="${browColor}" stroke-width="3.2" stroke-linecap="round"/>${eye(38, false)}${eye(62, true)}${nose}${mouths}${front}${gloss}${shades}${tiara}
    </svg>`;
    // swap the flat fills for the shaded ones
    return svg.replaceAll(`fill="${skin}"`, `fill="url(#sk${id})"`)
      .replaceAll(`fill="${hair}"`, `fill="url(#hr${id})"`)
      .replaceAll(`fill="${top}"`, `fill="url(#tp${id})"`);
  }
  const buddy = (name, look, cls = '') => `<div class="buddy ${cls}" data-name="${esc(name)}">${avatar(look || name)}<span>${esc(name)}</span></div>`;

  const PIN = '<svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.4 12 32 12 32s12-11.6 12-20.3C24 5.2 18.6 0 12 0z"/><circle cx="12" cy="11.5" r="4.5"/></svg>';
  const regionEl = (r, i, del) => `<div class="region" style="left:${pct(r.x)};top:${pct(r.y)};width:${pct(r.w)};height:${pct(r.h)}">${
    del ? `<button class="rdel" data-act="rdel" data-r="${i}" aria-label="Remove area">×</button>` : ''}</div>`;
  const marker = (x, y, cls = '', title = '') => `<span class="marker ${cls}" style="left:${pct(x)};top:${pct(y)}"${title ? ` title="${esc(title)}"` : ''}>${PIN}</span>`;
  const pinBox = (src, inner = '', cls = '') => `<div class="pinbox ${cls}"><img src="${src}" alt="" draggable="false" decoding="async">${inner}</div>`;
  // A player's pins: [[x, y], …] (older games sent a single [x, y]).
  const pinsOf = (choice) => (Array.isArray(choice) && typeof choice[0] === 'number' ? [choice] : choice || []);
  const inRegion = (r, [x, y]) => r.x <= x && x <= r.x + r.w && r.y <= y && y <= r.y + r.h;
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
      <a class="logo" href="/" data-link aria-label="Blitz home"><span>blitz<i>.</i></span></a>
      <a class="navlink ${location.pathname === '/dashboard' ? 'on' : ''}" href="/dashboard" data-link>Dashboard</a>
      <span class="grow"></span>${right}
    </header>`;

  // Answer tiles. True/False tiles are turquoise ✓ True and vermilion ✕ False instead of A–D.
  const tiles = (answers, each = () => ({}), kind = 'quiz') => `
    <div class="tiles ${kind === 'tf' ? 'tf' : ''}">${answers.map((a, i) => {
      const o = each(i);
      const tag = o.button ? 'button' : 'div';
      const tone = kind === 'tf' ? (i ? 't0' : 't1') : `t${i}`;
      return `<${tag} class="tile ${tone} ${o.cls || ''}" ${o.button ? `data-choice="${i}"` : ''}>
        <b>${kind === 'tf' ? (i ? '✕' : '✓') : L[i]}</b><span>${esc(a)}</span>${o.extra || ''}</${tag}>`;
    }).join('')}</div>`;
  const TYPE_LABEL = { quiz: 'Quiz', tf: 'True / False', slider: 'Slider', pin: 'Pin' };

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
    if (typeof closePicker === 'function') closePicker(false);
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

  // ---------- home showcase ----------
  // Little live previews of the product, drawn with the app's own pieces (no screenshots).
  function showcase() {
    const crowd = ['Maya', 'Leo', 'Sofia', 'Kostas', 'Priya', 'Tom', 'Nia', 'Ravi']
      .map((n, i) => `<div class="mini-buddy" style="--d:${i * 70}ms">${avatar(`showcase-${n}`)}<span>${n}</span></div>`).join('');
    const podium = [['Priya', 2, '2,840'], ['Maya', 1, '3,410'], ['Leo', 3, '2,215']]
      .map(([n, place, pts]) => `<div class="mini-step s${place}">${avatar(`showcase-${n}`)}<strong>${n}</strong><small>${pts}</small><div class="mini-block">${place}</div></div>`).join('');
    const answers = ['Mars', 'Venus', 'Jupiter', 'Saturn'];
    // A believable made-up landing page in a browser window, to pin on.
    const page = `<svg viewBox="0 0 320 200" class="mini-page" aria-hidden="true">
        <defs>
          <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF7A45"/><stop offset="1" stop-color="#EBC9A5"/></linearGradient>
        </defs>
        <rect width="320" height="200" rx="12" fill="#FBF8F3"/>
        <path d="M0 12a12 12 0 0 1 12-12h296a12 12 0 0 1 12 12v8H0Z" fill="#E7E1D6"/>
        <circle cx="12" cy="10" r="3" fill="#FF5A1F"/><circle cx="22" cy="10" r="3" fill="#EBC9A5"/><circle cx="32" cy="10" r="3" fill="#1FA8D2"/>
        <rect x="96" y="5" width="128" height="10" rx="5" fill="#FBF8F3"/><text x="160" y="12.6" text-anchor="middle" font-size="6.4" fill="#7C8B91" font-family="DM Sans, sans-serif">lumencoffee.co</text>
        <text x="14" y="38" font-size="10" font-weight="800" fill="#032A3C" font-family="Bricolage Grotesque, sans-serif">lumen.</text>
        <g font-size="6.6" fill="#55666D" font-family="DM Sans, sans-serif"><text x="150" y="37">Shop</text><text x="174" y="37">Recipes</text><text x="206" y="37">About</text></g>
        <rect x="246" y="28" width="60" height="14" rx="7" fill="#032A3C"/><text x="276" y="37.6" text-anchor="middle" font-size="6.4" font-weight="700" fill="#FBF8F3" font-family="DM Sans, sans-serif">Order now</text>
        <text x="14" y="70" font-size="17" font-weight="800" fill="#032A3C" font-family="Bricolage Grotesque, sans-serif">Brew better</text>
        <text x="14" y="89" font-size="17" font-weight="800" fill="#FF5A1F" font-family="Bricolage Grotesque, sans-serif">mornings.</text>
        <rect x="14" y="98" width="128" height="5" rx="2.5" fill="#C9D2D5"/><rect x="14" y="108" width="104" height="5" rx="2.5" fill="#C9D2D5"/>
        <rect x="14" y="120" width="56" height="15" rx="7.5" fill="#FF5A1F"/><text x="42" y="129.8" text-anchor="middle" font-size="6.4" font-weight="700" fill="#FBF8F3" font-family="DM Sans, sans-serif">Start a box</text>
        <rect x="76" y="120" width="50" height="15" rx="7.5" fill="none" stroke="#032A3C" stroke-width="1"/><text x="101" y="129.8" text-anchor="middle" font-size="6.4" font-weight="700" fill="#032A3C" font-family="DM Sans, sans-serif">Our beans</text>
        <rect x="170" y="52" width="136" height="88" rx="10" fill="url(#sc-sky)"/>
        <circle cx="238" cy="104" r="18" fill="#FBF8F3" opacity=".9"/>
        <path d="M170 118Q200 98 230 116T306 110V130a10 10 0 0 1-10 10H180a10 10 0 0 1-10-10Z" fill="#0A6C93"/>
        <path d="M170 128Q214 112 250 126T306 124V130a10 10 0 0 1-10 10H180a10 10 0 0 1-10-10Z" fill="#032A3C"/>
        <g fill="#FFFFFF" stroke="#E7E1D6"><rect x="14" y="152" width="92" height="36" rx="8"/><rect x="114" y="152" width="92" height="36" rx="8"/><rect x="214" y="152" width="92" height="36" rx="8"/></g>
        <g fill="#1FA8D2"><circle cx="28" cy="166" r="6"/><circle cx="128" cy="166" r="6" fill="#FF5A1F"/><circle cx="228" cy="166" r="6" fill="#EBC9A5"/></g>
        <g fill="#C9D2D5"><rect x="40" y="162" width="52" height="4" rx="2"/><rect x="40" y="170" width="38" height="4" rx="2"/><rect x="140" y="162" width="52" height="4" rx="2"/><rect x="140" y="170" width="38" height="4" rx="2"/><rect x="240" y="162" width="52" height="4" rx="2"/><rect x="240" y="170" width="38" height="4" rx="2"/></g>
      </svg>`;
    // Where players tapped (percent of the page): most found the headline, two didn't.
    const taps = [[13, 36, 'ok'], [22, 33, 'ok'], [31, 37, 'ok'], [17, 44, 'ok'], [27, 45, 'ok'], [36, 43, 'ok'], [74, 52, 'miss'], [29, 64, 'miss']];
    return `
      <section class="showcase" aria-label="What a game looks like">
        <p class="eyebrow">See it in action</p>
        <h2 class="display">One link. A room full of <em>players.</em></h2>
        <div class="shots">
          <figure class="shot shot-lobby">
            <div class="shot-head"><span class="shot-tag">Lobby</span><span class="mini-count">8 players</span></div>
            <div class="mini-pin">482 913</div>
            <div class="mini-crowd">${crowd}</div>
            <figcaption>Everyone joins with a PIN and gets their own character.</figcaption>
          </figure>
          <figure class="shot shot-phone">
            <div class="phone">
              <div class="mini-timer"><i></i></div>
              <div class="mini-bar"><span>2 / 8</span><span class="mini-secs">14s</span></div>
              <p class="mini-q">Which planet is known as the red one?</p>
              <div class="mini-tiles">${answers.map((a, i) => `<div class="mini-tile t${i}"><b>${L[i]}</b>${a}</div>`).join('')}</div>
            </div>
            <figcaption>Players answer on their phones. Faster right answers score more.</figcaption>
          </figure>
          <figure class="shot shot-pin">
            <div class="shot-head"><span class="shot-tag">Pin mode</span><span class="mini-count">6 of 8 landed inside</span></div>
            <p class="mini-ask">Tap the main headline</p>
            <div class="mini-pinbox">${page}
              <div class="region" style="left:3%;top:24%;width:44%;height:23%"></div>
              ${taps.map(([x, y, c], i) => `<span class="marker small drop-in ${c}" style="left:${x}%;top:${y}%;animation-delay:${200 + i * 90}ms">${PIN}</span>`).join('')}
            </div>
            <figcaption>Put up any picture, mark the right area, and players drop a pin on it.</figcaption>
          </figure>
          <figure class="shot shot-podium">
            <div class="shot-head"><span class="shot-tag">Final podium</span></div>
            <div class="mini-podium">${podium}</div>
            <figcaption>A live leaderboard after every question, and a podium at the end.</figcaption>
          </figure>
        </div>
      </section>`;
  }

  function viewHome() {
    app.innerHTML = `
      <main class="page home">
        ${nav('<a class="btn small nav-cta" href="/create" data-link>New quiz</a>')}
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
        ${showcase()}
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

  const blankQuestion = () => ({ type: 'quiz', title: '', image: null, answers: ['', '', '', ''], correct: 0, regions: [], time: 20,
    min: 0, max: 100, step: 1, answer: 50, unit: '', margin: 'medium' });
  const TYPES = [['quiz', 'Quiz'], ['tf', 'True/False'], ['slider', 'Slider'], ['pin', 'Pin']];
  const MARGIN_LABELS = [['exact', 'Exact'], ['low', '±5%'], ['medium', '±10%'], ['high', '±20%']];  // of the range
  const MARGIN_SHARE = { exact: 0, low: 0.05, medium: 0.1, high: 0.2 };
  const STEPS = [0.01, 0.1, 0.5, 1, 5, 10, 100];
  const numFmt = (v) => Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const withUnit = (v, unit) => `${numFmt(v)}${unit ? ` ${unit}` : ''}`;
  // A number line: the range, a highlighted "close enough" band, the right value, and optional dots for guesses.
  const numberLine = (q, { answer, tolerance = 0, guesses = [], you = null } = {}) => {
    const at = (v) => `${((v - q.min) / (q.max - q.min)) * 100}%`;
    const band = answer !== undefined && tolerance > 0
      ? `<i class="nl-band" style="left:${at(Math.max(q.min, answer - tolerance))};right:calc(100% - ${at(Math.min(q.max, answer + tolerance))})"></i>` : '';
    return `<div class="numline">
      <div class="nl-track">${band}
        ${guesses.map((g) => `<i class="nl-dot ${g.ok ? 'ok' : ''}" style="left:${at(g.v)}" title="${esc(g.name)}: ${esc(withUnit(g.v, q.unit))}"></i>`).join('')}
        ${you !== null ? `<i class="nl-you" style="left:${at(you)}"></i>` : ''}
        ${answer !== undefined ? `<i class="nl-answer" style="left:${at(answer)}"><span>${esc(withUnit(answer, q.unit))}</span></i>` : ''}
      </div>
      <div class="nl-ends"><span>${esc(withUnit(q.min, q.unit))}</span><span>${esc(withUnit(q.max, q.unit))}</span></div>
    </div>`;
  };

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
      : q.type === 'tf' ? { ...blankQuestion(), type: 'tf', title: q.title, image: q.image, correct: q.correct, time: q.time }
      : q.type === 'slider' ? { ...blankQuestion(), type: 'slider', title: q.title, image: q.image, time: q.time,
        min: q.min, max: q.max, step: q.step, answer: q.answer, unit: q.unit || '', margin: q.margin }
      : { ...blankQuestion(), title: q.title, image: q.image, answers: [...q.answers, '', '', ''].slice(0, 4), correct: q.correct, time: q.time })),
  });

  // ---------- glass popover picker ----------
  // Tap a setting and a small frosted panel opens next to it (like Apple's calendar and settings
  // pickers): a list of choices, a number with − / +, or a short text with suggestions.
  // It springs out of the control you tapped, closes on Done, Escape or a tap outside.
  const CHEV = '<svg class="chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1.5 6.5 6.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const UPDOWN = '<svg class="chev" viewBox="0 0 10 14" aria-hidden="true"><path d="M2 5l3-3 3 3M2 9l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // Replay the little "bump" on an element whose value just changed.
  const bump = (el) => { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
  // Segmented control: a pill that slides to the selected choice on a spring.
  function placeThumb(seg, from) {
    let t = seg.querySelector('.seg-thumb');
    if (!t) { t = document.createElement('span'); t.className = 'seg-thumb'; t.setAttribute('aria-hidden', 'true'); seg.prepend(t); }
    const on = seg.querySelector('button.on');
    if (!on) return;
    const set = (x, w) => { t.style.setProperty('--x', `${x}px`); t.style.setProperty('--w', `${w}px`); };
    if (from) {                       // start where the old pill was, then glide
      t.classList.add('instant'); set(from.x, from.w); void t.offsetWidth; t.classList.remove('instant');
    } else if (!t.style.getPropertyValue('--w')) {
      t.classList.add('instant'); set(on.offsetLeft, on.offsetWidth); void t.offsetWidth; t.classList.remove('instant'); return;
    }
    set(on.offsetLeft, on.offsetWidth);
  }
  const thumbAt = (seg) => { const t = seg?.querySelector('.seg-thumb'); return t ? { x: parseFloat(t.style.getPropertyValue('--x')) || 0, w: parseFloat(t.style.getPropertyValue('--w')) || 0 } : null; };

  let pop = null;
  function closePicker(refocus = true) {
    if (!pop) return;
    const { el, anchor, off } = pop;
    pop = null;
    off();
    anchor.setAttribute('aria-expanded', 'false');
    el.classList.add('out');
    setTimeout(() => el.remove(), 140);
    if (refocus && document.contains(anchor)) anchor.focus({ preventScroll: true });
  }
  function openPicker(anchor, spec) {
    closePicker(false);
    const el = document.createElement('div');
    el.className = 'pop';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', spec.title);
    const head = `<div class="pop-head"><strong>${esc(spec.title)}</strong>${spec.kind === 'choices' ? '' : '<button class="pop-done">Done</button>'}</div>`;
    if (spec.kind === 'choices') {
      el.innerHTML = head + `<div class="pop-list" role="listbox">${spec.options.map(([v, label, sub]) => `
        <button class="pop-opt ${String(v) === String(spec.value) ? 'on' : ''}" role="option" aria-selected="${String(v) === String(spec.value)}" data-v="${esc(v)}">
          <span><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><i>✓</i></button>`).join('')}</div>`;
    } else if (spec.kind === 'number') {
      el.innerHTML = head + `<div class="pop-num">
          <button class="pop-step" data-d="-1" aria-label="Lower">−</button>
          <label><input inputmode="decimal" value="${esc(spec.value)}" aria-label="${esc(spec.title)}">${spec.unit ? `<span>${esc(spec.unit)}</span>` : ''}</label>
          <button class="pop-step" data-d="1" aria-label="Higher">+</button>
        </div>${spec.note ? `<p class="pop-note">${esc(spec.note)}</p>` : ''}`;
    } else {
      el.innerHTML = head + `<div class="pop-text"><input value="${esc(spec.value)}" maxlength="${spec.max || 12}" placeholder="${esc(spec.placeholder || '')}" aria-label="${esc(spec.title)}"></div>
        ${spec.suggestions ? `<div class="pop-chips">${spec.suggestions.map((v) => `<button class="pop-chip" data-v="${esc(v)}">${esc(v || 'None')}</button>`).join('')}</div>` : ''}`;
    }
    document.body.append(el);
    // Place it under the control (or above when there's no room), never off-screen. It follows the
    // control when the page scrolls (phones scroll to make room for the keyboard) instead of closing.
    let below = null;
    const place = () => {
      const a = anchor.getBoundingClientRect();
      const w = el.offsetWidth, h = el.offsetHeight, vw = innerWidth, vh = innerHeight;
      const left = Math.min(Math.max(12, a.left + a.width / 2 - w / 2), vw - w - 12);
      if (below === null) below = a.bottom + 10 + h <= vh - 12 || a.top - 10 - h < 12;
      const top = below ? a.bottom + 10 : a.top - 10 - h;
      Object.assign(el.style, { left: `${left}px`, top: `${top}px`, transformOrigin: `${a.left + a.width / 2 - left}px ${below ? 0 : h}px` });
    };
    place();
    anchor.setAttribute('aria-expanded', 'true');

    const input = el.querySelector('input');
    const num = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
    el.addEventListener('click', (e) => {
      const opt = e.target.closest('.pop-opt');
      if (opt) { spec.onChange(opt.dataset.v); buzz(6); return closePicker(); }
      const chip = e.target.closest('.pop-chip');
      if (chip) { input.value = chip.dataset.v; spec.onChange(chip.dataset.v); return closePicker(); }
      const stepBtn = e.target.closest('.pop-step');
      if (stepBtn) {
        const v = Math.round(((num(input.value) ?? 0) + stepBtn.dataset.d * (spec.step || 1)) * 1e6) / 1e6;
        input.value = v; spec.onChange(v); bump(input); buzz(6); return;
      }
      if (e.target.closest('.pop-done')) closePicker();
    });
    if (input) {
      input.addEventListener('input', () => {
        if (spec.kind === 'number') { const v = num(input.value); if (v !== null) spec.onChange(v); }
        else spec.onChange(input.value);
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); closePicker(); } });
    }
    const outside = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePicker(false); };
    const keys = (e) => { if (e.key === 'Escape') closePicker(); };
    let frame = 0;
    const follow = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; place(); }); };
    setTimeout(() => document.addEventListener('pointerdown', outside, true));
    document.addEventListener('keydown', keys);
    addEventListener('resize', follow);
    addEventListener('scroll', follow, { passive: true, capture: true });
    pop = { el, anchor, off: () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', keys);
      removeEventListener('resize', follow);
      removeEventListener('scroll', follow, { capture: true });
    } };
    (input || el.querySelector('.pop-opt.on') || el.querySelector('button'))?.focus({ preventScroll: true });
    if (input && spec.kind === 'number') input.select();
  }

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
          <button class="btn primary small" id="publish">${editId ? 'Save<span class="hide-sm"> changes</span>' : 'Save<span class="hide-sm"> &amp; preview</span>'} →</button>`)}
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
            ${TYPES.map(([t, label]) => `<button data-act="type" data-type="${t}" class="${q.type === t ? 'on' : ''}" aria-pressed="${q.type === t}">${label}</button>`).join('')}
          </div>
          <span class="grow"></span>
          <button class="chip-btn" data-pick="time" aria-haspopup="dialog" aria-expanded="false" aria-label="Time to answer: ${q.time} seconds">
            <span>Time</span><b class="set-val" data-for="time">${q.time}s</b>${UPDOWN}</button>
        </header>
        <input class="q-input" data-f="title" maxlength="200" placeholder="${{ pin: 'e.g. Tap the ugliest part of this UI', tf: 'e.g. The Moon has its own light', slider: 'e.g. How tall is the Eiffel Tower?' }[q.type] || 'Ask something…'}" value="${esc(q.title)}" aria-label="Question">
        ${picture}
        ${pin ? `<div class="pinrow"><p class="hint">${!q.image ? 'Add a picture, then drag on it to mark the right area.'
          : regions.length ? `${regions.length} area${regions.length === 1 ? '' : 's'} marked — players get ${regions.length} pin${regions.length === 1 ? '' : 's'} and need one in every area for full points. Drag to add more.`
          : 'Drag on the picture to mark the right area. You can mark several.'}</p>
          ${q.image ? '<button class="ghost" data-act="noimg">Remove picture</button>' : ''}</div>` : q.type === 'tf' ? `
        <div class="answers-edit">
          ${['True', 'False'].map((label, k) => `
            <div class="ans ${k ? 't0' : 't1'}">
              <b>${k ? '✕' : '✓'}</b>
              <span class="ans-fixed">${label}</span>
              <label class="pick" title="Mark as correct">
                <input type="radio" name="correct-${i}" data-f="correct" value="${k}" ${q.correct === k ? 'checked' : ''}><i>✓</i>
              </label>
            </div>`).join('')}
        </div>
        <p class="hint">Tap ✓ on the correct answer.</p>` : q.type === 'slider' ? `
        <div class="settings">
          <div class="set-group" role="group" aria-label="Range and answer">
            ${setRow('min', 'From', withUnit(q.min, q.unit))}
            ${setRow('max', 'To', withUnit(q.max, q.unit))}
            ${setRow('answer', 'Right answer', withUnit(q.answer, q.unit), 'accent')}
          </div>
          <div class="set-group" role="group" aria-label="Details">
            ${setRow('unit', 'Unit', q.unit || 'None')}
            ${setRow('step', 'Steps of', numFmt(q.step))}
            ${setRow('margin', 'Close enough', marginText(q.margin))}
          </div>
        </div>
        <div class="sl-preview">${sliderPreview(q)}</div>
        <p class="hint">Players drag a slider to their guess. Spot on scores full points; inside the shaded band, the closer the better.</p>` : `
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
        ${d.questions.length > 1 ? '<div class="qfoot"><button class="ghost" data-act="del">Remove question</button></div>' : ''}
      </section>`;
    };
    // One row in a settings list: label on the left, value and › on the right; tapping opens a picker.
    function setRow(field, label, value, cls = '') {
      return `<button class="set-row ${cls}" data-pick="${field}" aria-haspopup="dialog" aria-expanded="false">
        <span>${label}</span><b class="set-val" data-for="${field}">${esc(value)}</b>${CHEV}</button>`;
    }
    function marginText(m) { return m === 'exact' ? 'Exact only' : MARGIN_LABELS.find(([v]) => v === m)?.[1] || '±10%'; }
    // Refresh the values shown on one card without redrawing it (the open picker stays anchored).
    function paintCard(i) {
      const q = d.questions[i];
      const card = list.querySelector(`[data-q="${i}"]`);
      if (!card) return;
      const show = { time: `${q.time}s`, min: withUnit(q.min, q.unit), max: withUnit(q.max, q.unit), answer: withUnit(q.answer, q.unit),
        unit: q.unit || 'None', step: numFmt(q.step), margin: marginText(q.margin) };
      card.querySelectorAll('.set-val').forEach((el) => {
        if (el.textContent !== show[el.dataset.for]) { el.textContent = show[el.dataset.for]; bump(el); }
      });
      const prev = card.querySelector('.sl-preview');
      if (prev) prev.innerHTML = sliderPreview(q);
    }
    function sliderPreview(q) {
      const ok = [q.min, q.max, q.answer].every((v) => Number.isFinite(+v)) && +q.min < +q.max && +q.answer >= +q.min && +q.answer <= +q.max;
      if (!ok) return '<p class="hint warn">Set a range with the right answer inside it.</p>';
      const sq = { min: +q.min, max: +q.max, unit: q.unit };
      return numberLine(sq, { answer: +q.answer, tolerance: MARGIN_SHARE[q.margin] * (sq.max - sq.min) });
    }
    const draw = () => {
      closePicker(false);
      list.innerHTML = d.questions.map(card).join('');
      list.querySelectorAll('.seg').forEach((seg) => placeThumb(seg));
    };
    document.fonts?.ready.then(() => list.querySelectorAll('.seg').forEach((seg) => placeThumb(seg)));
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
      else if (f === 'correct') q.correct = +e.target.value;
      save();
    });
    list.addEventListener('change', (e) => {
      if (e.target.type === 'file') setImage(qOf(e.target), e.target.files[0]);
    });
    list.addEventListener('click', (e) => {
      const pickBtn = e.target.closest('[data-pick]');
      if (pickBtn) {
        e.preventDefault();
        const i = +pickBtn.closest('[data-q]').dataset.q;
        const q = d.questions[i];
        const field = pickBtn.dataset.pick;
        const set = (v) => { q[field] = v; save(); paintCard(i); };
        const specs = {
          time: { title: 'Time to answer', kind: 'choices', value: q.time, options: TIMES.map((t) => [t, `${t} seconds`]), onChange: (v) => set(+v) },
          min: { title: 'From', kind: 'number', value: q.min, step: q.step, unit: q.unit, note: 'The lowest value on the slider.', onChange: (v) => set(v) },
          max: { title: 'To', kind: 'number', value: q.max, step: q.step, unit: q.unit, note: 'The highest value on the slider.', onChange: (v) => set(v) },
          answer: { title: 'Right answer', kind: 'number', value: q.answer, step: q.step, unit: q.unit, note: 'Must be between From and To.', onChange: (v) => set(v) },
          unit: { title: 'Unit', kind: 'text', value: q.unit, placeholder: 'e.g. m, %, years', suggestions: ['', 'm', 'km', '%', 'years', 'kg', '°C', '€'], onChange: (v) => set(v.trim()) },
          step: { title: 'Steps of', kind: 'choices', value: q.step, options: STEPS.map((v) => [v, numFmt(v)]), onChange: (v) => set(+v) },
          margin: { title: 'Close enough', kind: 'choices', value: q.margin, onChange: (v) => set(v), options: [
            ['exact', 'Exact only', 'Only the exact value scores'],
            ['low', '±5% of the range', 'Very close guesses score too'],
            ['medium', '±10% of the range', 'Close guesses score too'],
            ['high', '±20% of the range', 'Rough guesses score too']] },
        };
        return openPicker(pickBtn, specs[field]);
      }
      const t = e.target.closest('[data-act]');
      if (!t) return;
      e.preventDefault();
      const i = +t.closest('[data-q]').dataset.q;
      const q = d.questions[i];
      const act = t.dataset.act;
      if (act === 'del') d.questions.splice(i, 1);
      if (act === 'noimg') { q.image = null; q.regions = []; }
      if (act === 'type') {
        if (q.type === t.dataset.type) return;
        const from = thumbAt(t.closest('.seg'));
        q.type = t.dataset.type;
        if (q.type === 'tf' && q.correct > 1) q.correct = 0;
        save(); draw();
        const seg = list.querySelector(`[data-q="${i}"] .seg`);
        if (seg && from) placeThumb(seg, from);
        return;
      }
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
        if (q.type === 'tf') {
          payload.questions.push({ type: 'tf', title: q.title.trim(), image: q.image, correct: q.correct ? 1 : 0, time: q.time });
          continue;
        }
        if (q.type === 'slider') {
          const [min, max, answer] = [q.min, q.max, q.answer].map(Number);
          if (![min, max, answer].every(Number.isFinite) || q.min === '' || q.max === '' || q.answer === '') return toast(`Question ${n}: fill in the slider numbers`);
          if (min >= max) return toast(`Question ${n}: “From” must be lower than “To”`);
          if (answer < min || answer > max) return toast(`Question ${n}: the right answer must be between ${numFmt(min)} and ${numFmt(max)}`);
          if ((max - min) / q.step > 100000) return toast(`Question ${n}: pick bigger steps for that range`);
          payload.questions.push({ type: 'slider', title: q.title.trim(), image: q.image, time: q.time, min, max, answer, step: q.step, unit: q.unit.trim(), margin: q.margin });
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
                <span class="pill dim">${TYPE_LABEL[q.type] || 'Quiz'}</span><span class="pill">${q.time}s</span></header>
              <h2>${esc(q.title)}</h2>
              ${q.type === 'pin'
                ? `${pinBox(q.image, q.regions.map((r) => regionEl(r)).join(''))}<p class="hint">${q.regions.length > 1
                  ? `Players drop up to ${q.regions.length} pins. A pin in every area scores full points; each area found earns its share.`
                  : 'Pins inside the highlighted area score.'}</p>`
                : q.type === 'slider'
                ? `${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
                   ${numberLine(q, { answer: q.answer, tolerance: MARGIN_SHARE[q.margin] * (q.max - q.min) })}
                   <p class="hint">Right answer ${esc(withUnit(q.answer, q.unit))}${q.margin === 'exact' ? ', exact guesses only' : '; guesses in the shaded band score too'}.</p>`
                : `${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
                   ${tiles(q.answers, (k) => (k === q.correct ? { cls: 'right', extra: '<em>✓ Correct</em>' } : { cls: 'soft' }), q.type)}`}
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
                <div class="crowd" id="crowd"></div>
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
             ${reveal ? `<p class="pinstat"><strong>${s.hits}</strong> of ${s.count} ${s.regions.length > 1 ? `found all ${s.regions.length} areas` : 'landed inside'}</p>` : ''}`
          : q.type === 'slider'
          ? `${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
             <div class="slider-stage">${reveal
               ? `${numberLine(q, { answer: s.correct, tolerance: s.tolerance, guesses: s.guesses })}
                  <p class="pinstat"><strong>${s.hits}</strong> of ${s.count} ${s.tolerance ? 'were close enough' : 'got it exactly'}</p>`
               : `${numberLine(q)}<p class="pinstat">Somewhere between <strong>${esc(withUnit(q.min, q.unit))}</strong> and <strong>${esc(withUnit(q.max, q.unit))}</strong></p>`}</div>`
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
            ${pin || q.type === 'slider' ? '' : tiles(q.answers, (i) => (!reveal ? {} : {
              cls: i === s.correct ? 'right' : 'dimmed',
              extra: `<em>${i === s.correct ? '✓ ' : ''}${s.counts[i]}</em>`,
            }), q.type)}
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
      // Add only the newcomers (they hop in); remove anyone who's gone. Everyone else stays put.
      const crowd = $('#crowd');
      const names = new Set(s.players.map((p) => p.name));
      crowd.querySelectorAll('.buddy').forEach((el) => { if (!names.has(el.dataset.name)) el.remove(); });
      const have = new Set([...crowd.querySelectorAll('.buddy')].map((el) => el.dataset.name));
      crowd.querySelector('.crowd-empty')?.remove();
      for (const p of s.players) if (!have.has(p.name)) crowd.insertAdjacentHTML('beforeend', buddy(p.name, p.look, 'new'));
      if (!s.players.length) {
        crowd.innerHTML = `<div class="crowd-empty"><div class="buddy ghost-buddy"></div><div class="buddy ghost-buddy"></div><div class="buddy ghost-buddy"></div>
          <p class="waiting">Waiting for players<span class="dots"></span></p></div>`;
      }
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
          ${s.cover ? `<img class="intro-img" src="${s.cover}" alt="" decoding="async">` : ''}
          ${buddy(s.name, s.look, 'me new')}
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
              <p class="hint" id="pinhint"></p>
            </div></section>
            <div class="lockbar"><button class="btn primary" id="lock" disabled>Lock in →</button></div>
          </main>`;
        // Drop up to one pin per target area; tap a pin to pick it back up.
        const max = q.maxPins || 1;
        const picks = [];
        const box = $('.pinbox');
        const update = () => {
          box.querySelectorAll('.marker').forEach((m) => m.remove());
          picks.forEach((p, i) => box.insertAdjacentHTML('beforeend', marker(p.x, p.y, `${i === picks.length - 1 ? 'drop-in' : ''}`)));
          const left = max - picks.length;
          $('#pinhint').textContent = !picks.length
            ? (max > 1 ? `Find ${max} spots: tap to drop up to ${max} pins, one in each` : 'Tap the picture to drop your pin')
            : left ? `${left} pin${left === 1 ? '' : 's'} left · tap a pin to remove it` : 'All pins placed · tap a pin to move it';
          $('#lock').disabled = !picks.length;
          $('#lock').textContent = picks.length > 1 ? `Lock in ${picks.length} pins →` : 'Lock in pin →';
        };
        box.onpointerdown = (e) => {
          if (box.classList.contains('locked')) return;
          e.preventDefault();
          const [x, y] = fracAt(box, e);
          const b = box.getBoundingClientRect();
          // Tapping close to a pin you placed removes it.
          const near = picks.findIndex((p) => Math.hypot((p.x - x) * b.width, (p.y - y) * b.height) < 22);
          if (near >= 0) picks.splice(near, 1);
          else if (picks.length < max) picks.push({ x: r4(x), y: r4(y) });
          else return toast(`That's all ${max} pins — tap one to move it`);
          buzz(8);
          update();
        };
        update();
        $('#lock').onclick = () => {
          if (!picks.length) return;
          $('#lock').disabled = true;
          box.classList.add('locked');
          buzz(12);
          api('/api/act', { pin: session.pin, player: session.player, action: 'answer', choice: picks })
            .catch((err) => { toast(err.message); $('#lock').disabled = false; box.classList.remove('locked'); });
        };
        return;
      }

      if (s.phase === 'question' && s.choice === null && s.question.type === 'slider') {
        const q = s.question;
        const mid = Math.round(((q.min + q.max) / 2 - q.min) / q.step) * q.step + q.min;
        app.innerHTML = `
          <main class="page stage player sliderq">
            <div class="timerbar"><i data-bar></i></div>
            <header class="bar">
              <span class="pill">${s.qIndex + 1} / ${s.total}</span>
              <span class="grow"></span>
              <span class="pill timer"><span data-secs></span>s</span>
            </header>
            <section class="qwrap"><div class="qmain">
              <h1 class="qtitle">${esc(q.title)}</h1>
              ${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
              <div class="guess">
                <output class="guess-value" id="gv"></output>
                <input type="range" id="guess" min="${q.min}" max="${q.max}" step="${q.step}" value="${mid}" aria-label="Your guess">
                <div class="nl-ends"><span>${esc(withUnit(q.min, q.unit))}</span><span>${esc(withUnit(q.max, q.unit))}</span></div>
                <div class="nudge"><button class="btn small" data-n="-1" aria-label="A step lower">−</button><button class="btn small" data-n="1" aria-label="A step higher">+</button></div>
              </div>
            </div></section>
            <div class="lockbar"><button class="btn primary" id="lock">Lock in →</button></div>
          </main>`;
        const range = $('#guess');
        const fill = (v) => range.style.setProperty('--fill', `${((v - q.min) / (q.max - q.min)) * 100}%`);
        const show = () => { $('#gv').textContent = withUnit(+range.value, q.unit); fill(+range.value); };
        // − / + glide the thumb to the next value on a spring (dragging stays 1:1 with the finger).
        let glide = 0;
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const glideTo = (target) => {
          cancelAnimationFrame(glide);
          target = Math.min(q.max, Math.max(q.min, Math.round(target * 1e6) / 1e6));
          $('#gv').textContent = withUnit(target, q.unit);
          bump($('#gv'));
          if (reduce) { range.value = target; return fill(target); }
          const from = +range.value, t0 = performance.now(), dur = 420;
          range.step = 'any';
          const tick = (now) => {
            const p = Math.min(1, (now - t0) / dur);
            const e = 1 - Math.exp(-6 * p) * Math.cos(9 * p);   // a soft spring with a hint of overshoot
            const v = p < 1 ? from + (target - from) * e : target;
            range.value = v; fill(v);
            if (p < 1) glide = requestAnimationFrame(tick);
            else { range.step = q.step; range.value = target; }
          };
          glide = requestAnimationFrame(tick);
        };
        range.oninput = () => { cancelAnimationFrame(glide); range.step = q.step; show(); };
        let pending = null;   // the value the − / + buttons are heading to (so quick taps add up)
        document.querySelectorAll('.nudge [data-n]').forEach((b) => {
          b.onclick = () => {
            const base = pending ?? +range.value;
            pending = Math.min(q.max, Math.max(q.min, base + b.dataset.n * q.step));
            glideTo(pending);
            clearTimeout(b._t); b._t = setTimeout(() => { pending = null; }, 450);
            buzz(6);
          };
        });
        show();
        $('#lock').onclick = () => {
          $('#lock').disabled = true;
          range.disabled = true;
          buzz(12);
          cancelAnimationFrame(glide);
          const v = pending ?? +range.value;   // mid-glide: lock in where it was heading
          const guess = Math.round((Math.round((v - q.min) / q.step) * q.step + q.min) * 1e6) / 1e6;
          range.step = q.step; range.value = guess; show();
          api('/api/act', { pin: session.pin, player: session.player, action: 'answer', choice: guess })
            .catch((err) => { toast(err.message); $('#lock').disabled = false; range.disabled = false; });
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
            ${tiles(q.answers, () => ({ button: true }), q.type)}
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
          ${s.question.type === 'pin' ? `<div class="avatar pin-avatar">${PIN}</div>`
            : s.question.type === 'slider' ? `<div class="avatar slider-avatar">${esc(withUnit(s.choice, s.question.unit))}</div>`
            : s.question.type === 'tf' ? `<div class="avatar ${s.choice ? 't0' : 't1'}">${s.choice ? '✕' : '✓'}</div>`
            : `<div class="avatar t${s.choice}">${L[s.choice]}</div>`}
          <h1 class="display">Locked <em>in.</em></h1>
          <p class="lede">Waiting for everyone else<span class="dots"></span></p>`);
      }

      if (s.phase === 'reveal') {
        const right = s.right;
        const pin = s.question.type === 'pin';
        const slider = s.question.type === 'slider';
        const areas = pin ? s.regions.length : 0;
        const partial = pin && !right && s.found > 0;
        const exact = slider && s.choice !== null && Math.abs(s.choice - s.correct) < 1e-9;
        const why = slider ? (s.choice === null ? `The answer was <strong>${esc(withUnit(s.correct, s.question.unit))}</strong>.`
            : `The answer was <strong>${esc(withUnit(s.correct, s.question.unit))}</strong> · you said ${esc(withUnit(s.choice, s.question.unit))}.${exact ? ' Spot on!' : right ? ' Close enough.' : ''}`)
          : right ? (pin ? (areas > 1 ? `You found all ${areas} areas.` : 'Right on target.') : 'Correct — nicely done.')
          : pin ? (s.choice === null ? `Here’s where the right area${areas > 1 ? 's were' : ' was'}.`
            : partial ? `You found ${s.found} of ${areas} areas.` : `Your pin${pinsOf(s.choice).length > 1 ? 's' : ''} missed the area${areas > 1 ? 's' : ''}.`)
          : `The answer was <strong>${esc(s.question.answers[s.correct])}</strong>.`;
        buzz(right ? [14, 60, 14] : 40);
        return centered(`
          <div class="verdict ${right ? 'good' : partial ? 'half' : 'bad'}">${right ? '✓' : partial ? '½' : '✕'}</div>
          <h1 class="display">${right || partial ? `+${fmt(s.gained)}` : s.choice === null ? 'Time’s <em>up.</em>' : 'Not <em>quite.</em>'}</h1>
          <p class="lede">${why}</p>
          ${pin ? pinBox(s.question.image, s.regions.map((r) => regionEl(r)).join('')
            + pinsOf(s.choice).map((pt) => marker(pt[0], pt[1], `drop-in ${s.regions.some((r) => inRegion(r, pt)) ? 'ok' : 'miss'}`)).join(''), 'result') : ''}
          ${slider ? numberLine(s.question, { answer: s.correct, tolerance: s.tolerance, you: s.choice }) : ''}
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
