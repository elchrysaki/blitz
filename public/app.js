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
  // An original big-head "2000s diva" for each nickname, drawn as SVG: chunky highlights, scrunchies,
  // butterfly clips, frosted tips, hoops, shades on the head, lip gloss. The same name always gets
  // the same character, so players recognise themselves on the big screen.
  const AV = {
    skin: ['#FBDCC4', '#F1BE94', '#D99B6C', '#B47648', '#8C5428', '#5E3A22'],
    hair: ['#2A1A12', '#4B2C1C', '#7A2331', '#B8732F', '#E6B866', '#EDE3D2', '#151B24'],
    streak: ['#F4D58D', '#EDE3D2', '#FF7A45', '#D4EEF6'],
    top: ['#FF5A1F', '#1FA8D2', '#D4EEF6', '#EBC9A5'],
    lips: ['#E8604A', '#C2412B', '#FF7A45', '#B8576A'],
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

  function avatar(name) {
    const key = (name || '?').trim();
    const pick = (arr, trait) => arr[hashName(`${trait}:${key}`) % arr.length];  // each trait from its own hash
    const chance = (pct, trait) => hashName(`${trait}?${key}`) % 100 < pct;
    const skin = pick(AV.skin, 's'), hair = pick(AV.hair, 'h'), streak = pick(AV.streak, 'k');
    const top = pick(AV.top, 't'), lips = pick(AV.lips, 'l');
    const style = pick([0, 1, 2, 3, 4, 5, 6], 'y'), outfit = pick([0, 1, 2, 3], 'o');
    const look = pick([0, 0, 1, 2], 'e'), mouth = pick([0, 0, 1, 2], 'm');
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

    // face
    const iris = look === 1 ? 2.2 : 0; // side-eye
    const eye = (cx, flip) => look === 2 && flip
      ? `<path d="M${cx - 6} 57Q${cx} 51 ${cx + 6} 57" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/><path d="M${cx + 6} 57l3-3" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`
      : `<ellipse cx="${cx}" cy="57" rx="6" ry="5.4" fill="#fff"/><circle cx="${cx + iris}" cy="57.6" r="3.7" fill="${ink}"/><circle cx="${cx + iris + 1.3}" cy="56.2" r="1.2" fill="#fff"/>
         <path d="M${cx - 6.5} 55.6Q${cx} 49.6 ${cx + 6.5} 55.6" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
         <path d="M${flip ? cx + 6 : cx - 6} 54.4l${flip ? 3.2 : -3.2} -2.6" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`;
    const brows = `<path d="M31 46Q37 41.5 44 45M56 45Q63 41.5 69 46" fill="none" stroke="${hair === '#EDE3D2' ? '#8B6A4A' : hair}" stroke-width="2.4" stroke-linecap="round"/>`;
    const mouths = [
      `<path d="M41 70Q45.5 66.5 50 68.6Q54.5 66.5 59 70Q55 76.6 50 76.6Q45 76.6 41 70Z" fill="${lips}"/><ellipse cx="53.5" cy="73" rx="2.6" ry="1.1" fill="#fff" opacity=".7"/>`,
      `<path d="M42 70Q50 73 58 68Q55 75.5 49 75.6Q44 75.4 42 70Z" fill="${lips}"/><ellipse cx="52" cy="72.6" rx="2.2" ry="1" fill="#fff" opacity=".7"/>`,
      `<path d="M40 68Q50 72 60 68Q57 79 50 79Q43 79 40 68Z" fill="${lips}"/><path d="M42 69.4Q50 72.6 58 69.4L57 71.6Q50 74 43 71.6Z" fill="#fff"/>`,
    ][mouth];

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
    const sticker = chance(22, 'star') ? `<path d="M73 61l1.6 3.2 3.5.5-2.5 2.5.6 3.5-3.2-1.7-3.2 1.7.6-3.5-2.5-2.5 3.5-.5Z" fill="#F4D58D"/>` : '';
    const mole = chance(20, 'mole') ? `<circle cx="61" cy="76.5" r="1.2" fill="${ink}"/>` : '';

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
    const chinShadow = `<ellipse cx="50" cy="92" rx="20" ry="5" fill="#140c08" opacity=".22"/>`;

    const svg = `<svg class="buddy-art" viewBox="0 0 100 120" aria-hidden="true">${defs}
      ${back}${outfits}
      <rect x="43" y="82" width="14" height="14" rx="5" fill="${skin}"/>
      <circle cx="17" cy="58" r="6.5" fill="${skin}"/><circle cx="83" cy="58" r="6.5" fill="${skin}"/>
      ${chinShadow}
      <circle cx="50" cy="53" r="34" fill="${skin}"/>${faceShine}
      ${hoops}
      <ellipse cx="29" cy="66" rx="6.4" ry="3.6" fill="#FF5A1F" opacity=".3"/><ellipse cx="71" cy="66" rx="6.4" ry="3.6" fill="#FF5A1F" opacity=".3"/>
      ${brows}${eye(38, false)}${eye(62, true)}${mouths}${mole}${sticker}${front}${gloss}${shades}${tiara}
    </svg>`;
    // swap the flat fills for the shaded ones
    return svg.replaceAll(`fill="${skin}"`, `fill="url(#sk${id})"`)
      .replaceAll(`fill="${hair}"`, `fill="url(#hr${id})"`)
      .replaceAll(`fill="${top}"`, `fill="url(#tp${id})"`);
  }
  const buddy = (name, cls = '') => `<div class="buddy ${cls}" data-name="${esc(name)}">${avatar(name)}<span>${esc(name)}</span></div>`;

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
            <button data-act="type" data-type="quiz" class="${pin ? '' : 'on'}" aria-pressed="${!pin}">Quiz</button>
            <button data-act="type" data-type="pin" class="${pin ? 'on' : ''}" aria-pressed="${pin}">Pin</button>
          </div>
          <span class="grow"></span>
          <label class="select"><span class="select-label">Time</span>
            <select data-f="time" aria-label="Time to answer">${TIMES.map((t) => `<option value="${t}" ${t === q.time ? 'selected' : ''}>${t}s</option>`).join('')}</select>
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
      // Add only the newcomers (they hop in); remove anyone who's gone. Everyone else stays put.
      const crowd = $('#crowd');
      const names = new Set(s.players.map((p) => p.name));
      crowd.querySelectorAll('.buddy').forEach((el) => { if (!names.has(el.dataset.name)) el.remove(); });
      const have = new Set([...crowd.querySelectorAll('.buddy')].map((el) => el.dataset.name));
      crowd.querySelector('.crowd-empty')?.remove();
      for (const p of s.players) if (!have.has(p.name)) crowd.insertAdjacentHTML('beforeend', buddy(p.name, 'new'));
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
          ${buddy(s.name, 'me new')}
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
