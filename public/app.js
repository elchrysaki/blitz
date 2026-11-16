(() => {
  const app = document.getElementById('app');
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = 'ABCD';
  const TIMES = [10, 20, 30, 60];
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const signed = (n) => (n < 0 ? `−${fmt(-n)}` : `+${fmt(n)}`);   // points won or lost this question
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
  // A sand timer that drains and flips: the "we're waiting" signal.
  const HOURGLASS = `<svg class="hourglass" viewBox="0 0 32 40" aria-hidden="true">
      <path d="M7 3h18M7 37h18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <path d="M9 4c0 9 6 11 6 16S9 27 9 36M23 4c0 9-6 11-6 16s6 7 6 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
      <path class="sand-top" d="M11 9h10c-.6 4-3.6 6.5-5 8.6C14.6 15.5 11.6 13 11 9Z"/>
      <path class="sand-bottom" d="M11 34h10c0-3.6-2.6-6-5-7.4-2.4 1.4-5 3.8-5 7.4Z"/>
      <path class="sand-stream" d="M16 18.5v8" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`;
  const waitingChip = (text) => `<p class="waiting-chip" role="status">${HOURGLASS}<span>${text}<span class="dots"></span></span></p>`;
  const waitCount = (n) => (n > 1 ? `You and ${n - 1} other${n === 2 ? '' : 's'} are in` : 'You’re the first one here');
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
      <a class="navlink wide ${location.pathname === '/explore' ? 'on' : ''}" href="/explore" data-link>Explore</a>
      <a class="navlink wide wider ${location.pathname === '/leaderboard' ? 'on' : ''}" href="/leaderboard" data-link>Leaderboard</a>
      <span class="grow"></span>${right}
      <button class="menu-btn" type="button" aria-label="Menu" aria-haspopup="menu" aria-expanded="false"><i></i><i></i><i></i></button>
    </header>`;

  // ---------- phone menu ----------
  // On narrow screens the bar's links fold into a ☰ button; it opens a frosted panel under the bar
  // (the same glass as the pickers), springs out from the button, and closes on a pick, a tap
  // outside, Escape or any page change.
  const MENU = [
    ['/dashboard', 'Dashboard', 'Your quizzes, games and stats'],
    ['/explore', 'Explore', 'Public quizzes to play or save'],
    ['/leaderboard', 'Leaderboard', 'Everyone’s ratings'],
  ];
  let menu = null;
  function closeMenu(refocus = false) {
    if (!menu) return;
    const { panel, btn, off } = menu;
    menu = null;
    off();
    btn.setAttribute('aria-expanded', 'false');
    btn.classList.remove('open');
    panel.classList.add('out');
    setTimeout(() => panel.remove(), 160);
    if (refocus) btn.focus({ preventScroll: true });
  }
  function openMenu(btn) {
    closePicker(false);
    const here = location.pathname;
    const panel = document.createElement('nav');
    panel.className = 'menu-pop';
    panel.setAttribute('aria-label', 'Menu');
    panel.innerHTML = `
      ${MENU.map(([href, label, sub]) => `<a class="menu-item ${here === href ? 'on' : ''}" href="${href}" data-link ${here === href ? 'aria-current="page"' : ''}>
        <span><b>${label}</b><small>${sub}</small></span>${here === href ? '<i aria-hidden="true">●</i>' : CHEV}</a>`).join('')}
      <div class="menu-actions">
        <a class="btn primary small" href="/create" data-link>New quiz</a>
        <a class="btn small" href="/play" data-link>Join a game</a>
      </div>`;
    document.body.append(panel);
    const place = () => {
      const bar = btn.closest('.nav').getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      panel.style.top = `${bar.bottom + 8}px`;
      panel.style.right = `${Math.max(12, innerWidth - bar.right)}px`;
      panel.style.transformOrigin = `${panel.offsetWidth - (innerWidth - b.right - Math.max(12, innerWidth - bar.right)) - b.width / 2}px -8px`;
    };
    place();
    btn.setAttribute('aria-expanded', 'true');
    btn.classList.add('open');
    buzz(6);
    const outside = (e) => { if (!panel.contains(e.target) && !btn.contains(e.target)) closeMenu(); };
    const keys = (e) => { if (e.key === 'Escape') closeMenu(true); };
    setTimeout(() => document.addEventListener('pointerdown', outside, true));
    document.addEventListener('keydown', keys);
    addEventListener('resize', place);
    menu = { panel, btn, off: () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', keys);
      removeEventListener('resize', place);
    } };
    panel.querySelector('.menu-item')?.focus({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.menu-btn');
    if (!b) return;
    e.preventDefault();
    if (menu) closeMenu(); else openMenu(b);
  });

  // Answer tiles. True/False tiles are turquoise ✓ True and vermilion ✕ False instead of A–D.
  const tiles = (answers, each = () => ({}), kind = 'quiz') => `
    <div class="tiles ${kind === 'tf' ? 'tf' : ''}">${answers.map((a, i) => {
      const o = each(i);
      const tag = o.button ? 'button' : 'div';
      const tone = kind === 'tf' ? (i ? 't0' : 't1') : `t${i}`;
      return `<${tag} class="tile ${tone} ${o.cls || ''}" ${o.button ? `data-choice="${i}"` : ''}>
        <b>${kind === 'tf' ? (i ? '✕' : '✓') : L[i]}</b><span>${esc(a)}</span>${o.extra || ''}</${tag}>`;
    }).join('')}</div>`;
  // A puzzle's items as numbered rows (the right order on reveal and in the preview).
  // Each item keeps the colour and letter it had while shuffled (`shown` = the shuffled list), so the
  // reveal reads as "B goes first, then D…". Without `shown`, rows are simply numbered.
  const orderList = (items, cls = '', shown = null) => `<ol class="order ${cls}">${items.map((a, k) => {
    const d = shown ? shown.indexOf(a) : k;
    const mark = cls === 'shuffled' ? L[k] : k + 1;
    return `<li class="otile t${d < 0 ? k : d}" style="--i:${k}"><b>${mark}</b><span>${esc(a)}</span>${shown && cls !== 'shuffled' ? `<small>${L[d]}</small>` : ''}</li>`;
  }).join('')}</ol>`;
  // The accepted answers of a Type answer question, as chips.
  const acceptChips = (list) => `<div class="accepts">${list.map((a, k) => `<span class="accept ${k ? '' : 'main'}">${esc(a)}</span>`).join('')}</div>`;
  const TYPE_ICON = '<svg viewBox="0 0 32 32" aria-hidden="true"><text x="16" y="23" text-anchor="middle" font-family="Bricolage Grotesque, DM Sans, sans-serif" font-weight="800" font-size="19" fill="currentColor">Aa</text></svg>';
  const PUZZLE_ICON = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 8h20M6 16h20M6 24h20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  const TYPE_LABEL = { quiz: 'Quiz', tf: 'True / False', type: 'Type answer', puzzle: 'Puzzle', slider: 'Slider', pin: 'Pin' };

  const boardRows = (players, limit) => players.slice(0, limit).map((p, i) => `
    <li><span class="rank">${i + 1}</span><span class="name">${esc(p.name)}</span>
      ${p.gained ? `<span class="gain ${p.gained < 0 ? 'neg' : ''}">${signed(p.gained)}</span>` : ''}<span class="score">${fmt(p.score)}</span></li>`).join('');

  // ---------- host results ----------
  // Kahoot-style bars: how many picked each answer, the right one ticked.
  const answerChart = (q, counts, correct) => {
    const top = Math.max(1, ...counts);
    return `<div class="chart ${q.type === 'tf' ? 'tf' : ''}" role="img" aria-label="${counts.map((n, i) => `${q.answers[i]}: ${n}`).join(', ')}">
      ${counts.map((n, i) => {
        const tone = q.type === 'tf' ? (i ? 't0' : 't1') : `t${i}`;
        return `<div class="cbar ${tone} ${i === correct ? 'right' : ''}" style="--h:${Math.max(4, (n / top) * 100)}%;--i:${i}">
          <span class="cbar-n">${i === correct ? '✓ ' : ''}${n}</span><i></i>
          <b>${q.type === 'tf' ? (i ? '✕' : '✓') : L[i]}</b></div>`;
      }).join('')}
    </div>`;
  };
  // One player's reply, in words, for any question type.
  function replyText(q, r, s) {
    const c = r.choice;
    if (c === null || c === undefined) return 'No answer';
    switch (q.type) {
      case 'tf': return c ? 'False' : 'True';
      case 'type': return `“${c}”`;
      case 'slider': return withUnit(c, q.unit);
      case 'pin': {
        const n = s.regions.length;
        const found = n > 1 ? `Found ${r.found} of ${n} areas` : r.found ? 'Pin inside the area' : 'Pin outside the area';
        return `${found}${r.stray && (n > 1 || r.found) ? ` · ${r.stray} stray` : ''}${r.auto ? ' · not locked in' : ''}`;
      }
      case 'puzzle': return `${c.map((d) => q.answers[d]).join(' → ')}${r.auto ? ' · not locked in' : ''}`;
      default: return `${L[c]} · ${q.answers[c]}`;
    }
  }
  const repliesPanel = (q, s) => !s.replies?.length ? '' : `
    <section class="card replies">
      <div class="replies-head"><p class="eyebrow">Who answered what</p>
        <span class="replies-sum"><b>${s.replies.filter((r) => r.ok).length}</b> right · <b>${s.replies.filter((r) => r.choice !== null && !r.ok).length}</b> wrong${
          s.replies.some((r) => r.choice === null) ? ` · <b>${s.replies.filter((r) => r.choice === null).length}</b> no answer` : ''}</span></div>
      <ul class="rlist">${s.replies.map((r, k) => `
        <li class="${r.ok ? 'ok' : r.gained > 0 ? 'half' : r.choice === null ? 'none' : 'bad'}" style="--i:${Math.min(k, 12)}">
          <span class="r-art">${avatar(r.look || r.name)}</span>
          <span class="r-main"><strong>${esc(r.name)}</strong><small>${esc(replyText(q, r, s))}</small></span>
          <span class="r-pts ${r.gained < 0 ? 'neg' : ''}">${r.gained ? signed(r.gained) : r.choice === null ? '–' : '0'}</span>
        </li>`).join('')}</ul>
    </section>`;

  // ---------- celebrations ----------
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A one-off shower of paper in the four answer colours (pure CSS; nothing runs once it has landed).
  const confetti = (n = 70) => calm() ? '' : `<div class="confetti" aria-hidden="true">${Array.from({ length: n }, (_, i) => {
    const r = (k) => (Math.sin((i + 1) * 9301 + k * 49297) * 233280) % 1;        // steady pseudo-random, no flicker on redraws
    const a = Math.abs;
    return `<i style="--x:${(a(r(1)) * 100).toFixed(1)}vw;--dx:${(r(2) * 18).toFixed(1)}vw;--d:${(a(r(3)) * .9).toFixed(2)}s;--t:${(2.4 + a(r(4)) * 1.6).toFixed(2)}s;--s:${(.6 + a(r(5)) * .7).toFixed(2)};--r:${Math.round(r(6) * 900)}deg;--c:var(--${'abcd'[i % 4]})" class="${i % 3 ? '' : 'round'}"></i>`;
  }).join('')}</div>`;
  // Count a number up from 0 (eased), or just show it when motion is reduced.
  function countUp(el, to, ms = 1200) {
    if (!el) return;
    if (calm() || !to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const TROPHY = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 8h28v14a14 14 0 0 1-28 0z" fill="currentColor"/><path d="M18 13H9a9 9 0 0 0 11 13M46 13h9a9 9 0 0 1-11 13" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M28 35h8v10h-8z" fill="currentColor"/><rect x="20" y="45" width="24" height="8" rx="3" fill="currentColor"/><path d="M25 14v8a7 7 0 0 0 4 6" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="3" stroke-linecap="round"/></svg>`;
  const medal = (place) => place === 1 ? `<span class="medal m1">${TROPHY}</span>` : place <= 3 ? `<span class="medal m${place}">${place}</span>` : '';
  const RATING_RULE = 'Your rating is every point you’ve scored, plus 1,000 for each win and 300 for each 2nd or 3rd place. Only games with at least 2 players count.';

  // ---------- router ----------

  // ---------- staying up to date ----------
  // A tab left open (or a home-screen app resumed days later) keeps running the code it opened with.
  // Now and then, check whether a newer version is live; if so, reload at the next page change, or
  // right away when you come back to the tab, unless a live game is on screen.
  const ASSETS = ['/app.js', '/styles.css'];
  let tags = null, stale = false, lastCheck = 0;
  const inGame = () => /^\/(play|host\/)/.test(location.pathname);
  async function checkVersion() {
    if (stale || Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    const now = await Promise.all(ASSETS.map((u) => fetch(u, { method: 'HEAD', cache: 'no-store' })
      .then((r) => (r.ok ? r.headers.get('etag') || '' : null)).catch(() => null)));
    if (now.includes(null)) return;                       // offline or a hiccup: try again later
    if (!tags) { tags = now; return; }
    if (now.some((v, i) => v && tags[i] && v !== tags[i])) stale = true;
  }
  checkVersion();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    checkVersion().then(() => { if (stale && !inGame()) location.reload(); });
  });

  function go(path) { history.pushState(null, '', path); route(); }
  window.addEventListener('popstate', route);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]');
    if (a) { e.preventDefault(); go(a.getAttribute('href')); }
  });

  function route() {
    if (stale) { location.reload(); return; }   // a newer version is live: load it for this page
    checkVersion();
    closeMenu();
    if (cleanup) { cleanup(); cleanup = null; }
    if (typeof closePicker === 'function') closePicker(false);
    viewKey = '';
    window.scrollTo(0, 0);
    const p = location.pathname;
    if (p === '/create') return viewCreate();
    if (p === '/play') return viewPlay();
    if (p === '/dashboard') return viewDashboard();
    if (p === '/leaderboard') return viewLeaderboard();
    if (p === '/explore') return viewExplore();
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
          ${q.public ? '<span class="pubbadge">Public</span>' : ''}
        </a>
        <div class="qtile-body">
          <h3>${esc(q.title)}</h3>
          <p class="meta">${q.questions} question${q.questions === 1 ? '' : 's'}${q.pins ? ` · ${q.pins} pin` : ''} · ${
            q.plays ? `played ${q.plays}×` : 'not played yet'}${q.saves ? ` · saved ${q.saves}×` : ''}</p>
          <p class="meta dim">Edited ${ago(q.updated)}</p>
          ${daysLeft(q) <= 5 ? `<p class="meta warn">Deleted in ${daysLeft(q) <= 1 ? 'a day' : `${daysLeft(q)} days`} unless it’s played</p>` : ''}
          <div class="qtile-actions">
            <a class="btn primary small" href="/host/${q.id}" data-link>${q.live ? 'Back to game' : 'Host'}</a>
            <a class="btn small" href="/edit/${q.id}" data-link>Edit</a>
            <span class="qtile-more"><button class="ghost" data-dl="${q.id}">Download</button><button class="ghost" data-del="${q.id}">Delete</button></span>
          </div>
        </div>
      </article>`;

    // While the game still exists (lobby open or running) the whole row takes you back in.
    const playedRow = (e) => e.live ? `
      <li><a class="prow is-live" href="/play?pin=${e.pin}" data-link aria-label="Rejoin ${esc(e.quizTitle)}, PIN ${pinText(e.pin)}">
        <span class="pavatar"><i class="livedot"></i></span>
        <span class="pmain"><strong>${esc(e.quizTitle)}</strong>
          <small>as ${esc(e.name)} · ${ago(e.at)} · <b>Live now</b></small></span>
        <span class="ppin">PIN ${pinText(e.pin)}</span>
        <span class="btn primary small">Rejoin →</span>
      </a></li>` : `
      <li class="prow">
        <span class="pavatar">${e.done && e.rank ? ordinal(e.rank) : '–'}</span>
        <span class="pmain"><strong>${esc(e.quizTitle)}</strong>
          <small>as ${esc(e.name)} · ${ago(e.at)}</small></span>
        ${e.done ? `<span class="pscore">${fmt(e.score)} pts<small>${ordinal(e.rank)} of ${e.count}</small></span>`
          : '<span class="pscore dim">Game ended<small>you left early</small></span>'}
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

  // Lifetime stats on the dashboard: rating and world rank up top, the counts beside them.
  function statsCard(st) {
    if (!st || !st.games) return `
      <section class="dash-sec">
        <div class="sec-head"><h2>Your stats</h2></div>
        <div class="card stats-empty"><p>Finish a game with at least one other player and your rating, wins and podiums start counting here.</p>
          <a class="btn small" href="/leaderboard" data-link>See the leaderboard</a></div>
      </section>`;
    const tile = (n, label) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`;
    return `
      <section class="dash-sec">
        <div class="sec-head"><h2>Your stats</h2><span class="grow"></span><a class="ghost" href="/leaderboard" data-link>Leaderboard →</a></div>
        <div class="card stats">
          <div class="stat-hero">
            <span class="eyebrow">Blitz rating</span>
            <b>${fmt(st.rating)}</b>
            <span class="rankchip">#${fmt(st.rank || 1)} worldwide</span>
          </div>
          <div class="stat-grid">
            ${tile(fmt(st.games), st.games === 1 ? 'game' : 'games')}
            ${tile(fmt(st.wins), st.wins === 1 ? 'win' : 'wins')}
            ${tile(fmt(st.podiums), '2nd & 3rd')}
            ${tile(fmt(st.points), 'total points')}
            ${tile(fmt(st.best), 'best game')}
            ${tile(st.games ? Math.round((st.wins / st.games) * 100) + '%' : '–', 'win rate')}
          </div>
        </div>
      </section>`;
  }

  // ---------- explore: public quizzes ----------
  async function viewExplore() {
    let alive = true;
    cleanup = () => { alive = false; };
    let query = '', sort = 'popular', seq = 0, list = null;
    app.innerHTML = `
      <main class="page explore">
        ${nav('<a class="btn primary small" href="/create" data-link>New quiz</a>')}
        <section class="create-head">
          <p class="eyebrow">Public quizzes</p>
          <h1 class="display">Explore <em>quizzes.</em></h1>
          <p class="lede">Quizzes people made public. Preview one, then save your own copy to host it, change it or download it.</p>
          <div class="ex-tools">
            <label class="ex-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m15.5 15.5 5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
              <input id="exq" type="search" placeholder="Search by title" aria-label="Search public quizzes" autocomplete="off" enterkeyhint="search"></label>
            <div class="seg" id="exsort" role="group" aria-label="Sort">
              <button type="button" data-sort="popular" class="on" aria-pressed="true">Popular</button>
              <button type="button" data-sort="new" aria-pressed="false">New</button>
            </div>
          </div>
        </section>
        <div id="exlist"><p class="lede center-note">Loading<span class="dots"></span></p></div>
      </main>`;
    placeThumb($('#exsort'));
    document.fonts?.ready.then(() => placeThumb($('#exsort')));
    const TYPE_SHORT = { quiz: 'Quiz', tf: 'True/False', type: 'Type answer', puzzle: 'Puzzle', slider: 'Slider', pin: 'Pin' };
    const card = (q) => `
      <article class="card qtile excard" data-id="${q.id}">
        <button class="cover" data-preview="${q.id}" aria-label="Preview ${esc(q.title)}">
          ${q.cover ? `<img src="${q.cover}" alt="" loading="lazy" decoding="async">` : `<span class="cover-fallback">${esc(q.title.slice(0, 1).toUpperCase())}</span>`}
          ${q.mine ? '<span class="pubbadge">Yours</span>' : ''}
        </button>
        <div class="qtile-body">
          <h3>${esc(q.title)}</h3>
          <p class="meta">${q.questions} question${q.questions === 1 ? '' : 's'}${q.author ? ` · by ${esc(q.author)}` : ''}</p>
          <p class="meta dim">${q.plays ? `played ${fmt(q.plays)}×` : 'not played yet'}${q.saves ? ` · saved ${fmt(q.saves)}×` : ''}</p>
          <div class="ex-types">${q.types.map((t) => `<span>${TYPE_SHORT[t] || t}</span>`).join('')}</div>
          <div class="qtile-actions">
            ${q.mine ? `<a class="btn small" href="/host/${q.id}" data-link>Open</a>`
              : `<button class="btn primary small" data-save="${q.id}">Save a copy</button>`}
            <button class="ghost" data-preview="${q.id}">Preview</button>
          </div>
        </div>
      </article>`;
    const draw = () => {
      $('#exlist').innerHTML = !list.length
        ? `<div class="card stats-empty"><p>${query ? `No public quizzes match “${esc(query)}”.` : 'No public quizzes yet. Make one public in the editor (Private / Public under the title) and it shows up here.'}</p>
            <a class="btn primary small" href="/create" data-link>Make a quiz</a></div>`
        : `<div class="qgrid">${list.map(card).join('')}</div>`;
    };
    async function load() {
      const my = ++seq;
      try {
        const r = await api(`/api/public?sort=${sort}${query ? `&q=${encodeURIComponent(query)}` : ''}`);
        if (!alive || my !== seq) return;
        list = r.quizzes;
        draw();
      } catch (err) { if (alive) toast(err.message); }
    }
    let typing = 0;
    $('#exq').oninput = (e) => { clearTimeout(typing); typing = setTimeout(() => { query = e.target.value.trim(); load(); }, 250); };
    $('#exsort').onclick = (e) => {
      const b = e.target.closest('[data-sort]');
      if (!b || b.dataset.sort === sort) return;
      const from = thumbAt($('#exsort'));
      sort = b.dataset.sort;
      $('#exsort').querySelectorAll('button').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
      placeThumb($('#exsort'), from);
      load();
    };
    const saveCopy = async (id, btn) => {
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        const r = await api(`/api/public/${id}/save`, {});
        store.del('blitz:me', localStorage);
        toast('Saved to your dashboard — it’s yours now');
        go(`/host/${r.id}`);
      } catch (err) { toast(err.message); btn.disabled = false; btn.textContent = 'Save a copy'; }
    };
    $('#exlist').onclick = (e) => {
      const s = e.target.closest('[data-save]');
      if (s) return saveCopy(s.dataset.save, s);
      const p = e.target.closest('[data-preview]');
      if (p) openPreview(p.dataset.preview);
    };
    // Preview: the questions and pictures, never the answers.
    async function openPreview(id) {
      let q;
      try { q = await api(`/api/public/${id}`); } catch (err) { return toast(err.message); }
      const back = document.createElement('div');
      back.className = 'sheet-back';
      back.innerHTML = `
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="pv-h">
          <header class="sheet-head"><h2 id="pv-h">${esc(q.title)}</h2><button class="sheet-x" aria-label="Close">✕</button></header>
          <div class="sheet-body">
            ${q.cover ? `<img class="pv-cover" src="${q.cover}" alt="">` : ''}
            <p class="meta">${q.questions} question${q.questions === 1 ? '' : 's'}${q.author ? ` · by ${esc(q.author)}` : ''} · ${q.plays ? `played ${fmt(q.plays)}×` : 'not played yet'}${q.saves ? ` · saved ${fmt(q.saves)}×` : ''}</p>
            <p class="hint">Answers stay hidden until you save your own copy.</p>
            <ol class="imp-list">${q.questionList.map((x, i) => `
              <li><span class="iq-n">${i + 1}</span>
                <div class="iq-main"><div class="iq-top"><span class="iq-type">${TYPE_SHORT[x.type] || x.type}</span><span class="iq-time">${x.time}s</span></div><strong>${esc(x.title)}</strong></div>
                ${x.image ? `<img class="iq-pic" src="${x.image}" alt="" loading="lazy">` : ''}</li>`).join('')}</ol>
          </div>
          <footer class="sheet-foot">${q.mine ? `<a class="btn primary" href="/host/${q.id}" data-link>Open your quiz</a>` : `<button class="btn primary" id="pvSave">Save a copy</button>`}</footer>
        </div>`;
      document.body.append(back);
      document.documentElement.classList.add('sheet-open');
      const close = () => { document.documentElement.classList.remove('sheet-open'); back.classList.add('out'); document.removeEventListener('keydown', key); setTimeout(() => back.remove(), 180); };
      const key = (e) => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', key);
      back.querySelector('.sheet-x').onclick = close;
      back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
      back.addEventListener('click', (e) => { if (e.target.closest('a[data-link]')) close(); });
      const sv = back.querySelector('#pvSave');
      if (sv) sv.onclick = async () => { await saveCopy(q.id, sv); close(); };
      const prevCleanup = cleanup;
      cleanup = () => { close(); prevCleanup?.(); };
    }
    load();
  }

  // ---------- leaderboard ----------

  async function viewLeaderboard() {
    let alive = true;
    cleanup = () => { alive = false; };
    const CACHE = 'blitz:lb';
    const draw = (d) => {
      const [p1, p2, p3] = d.players;
      const step = (p, place) => p ? `
        <div class="step s${place} ${p.you ? 'you' : ''}">
          <div class="step-art">${avatar(p.look || p.name)}${medal(place)}</div>
          <strong ${p.you ? 'title="You"' : ''}>${esc(p.name)}</strong><span>${fmt(p.rating)}</span>
          <div class="block">${place}</div>
        </div>` : '<div class="step"></div>';
      const row = (p) => `
        <li class="${p.you ? 'you' : ''}">
          <span class="rank">${p.rank}</span>
          <span class="lb-art">${avatar(p.look || p.name)}</span>
          <span class="lb-main"><strong>${esc(p.name)}${p.you ? ' · you' : ''}</strong>
            <small>${fmt(p.games)} game${p.games === 1 ? '' : 's'} · ${fmt(p.wins)} win${p.wins === 1 ? '' : 's'} · ${fmt(p.podiums)} podium${p.podiums === 1 ? '' : 's'}</small></span>
          <span class="score">${fmt(p.rating)}</span>
        </li>`;
      const youOutside = d.you && !d.players.some((p) => p.you);
      app.innerHTML = `
        <main class="page lb">
          ${nav('<a class="btn primary small" href="/play" data-link>Join a game</a>')}
          <section class="create-head">
            <p class="eyebrow">Everyone, everywhere</p>
            <h1 class="display">Global <em>leaderboard.</em></h1>
            <p class="lede">${d.total ? `${fmt(d.total)} player${d.total === 1 ? '' : 's'} ranked. ` : ''}${RATING_RULE}</p>
          </section>
          ${d.players.length ? `
            <div class="podium lb-podium">${step(p2, 2)}${step(p1, 1)}${step(p3, 3)}</div>
            ${d.players.length > 3 || youOutside ? `<ol class="card board lboard">${d.players.slice(3).map(row).join('')}${youOutside ? `<li class="gap" aria-hidden="true">···</li>${row(d.you)}` : ''}</ol>` : ''}
            ${d.you ? '' : '<p class="hint center">Finish a game with at least one other player to get on the board.</p>'}`
          : `<div class="card stats-empty"><p>Nobody’s on the board yet. Finish a game with at least one other player to be the first.</p>
              <a class="btn primary small" href="/create" data-link>Make a quiz</a></div>`}
          <p class="hint center">Stats belong to this browser and are kept as long as it’s remembered (7 days after your last visit).</p>
        </main>`;
    };
    const cached = store.get(CACHE, localStorage);
    if (cached) draw(cached);
    else app.innerHTML = `<main class="page lb">${nav()}<div class="solo"><p class="lede">Loading<span class="dots"></span></p></div></main>`;
    try {
      const d = await api('/api/leaderboard');
      store.set(CACHE, d, localStorage);
      if (alive && JSON.stringify(d) !== JSON.stringify(cached)) { draw(d); if (cached) app.firstElementChild.style.animation = 'none'; }
    } catch (err) { if (alive && !cached) toast(err.message); }
  }

  function drawDashboard(me, quizCard, playedRow) {
    app.innerHTML = `
      <main class="page dash">
        ${nav('<a class="btn primary small" href="/create" data-link>New quiz</a>')}
        <section class="create-head">
          <p class="eyebrow">Your dashboard</p>
          <h1 class="display">${me.quizzes.length || me.played.length || me.stats?.games ? 'Welcome <em>back.</em>' : 'Nothing here <em>yet.</em>'}</h1>
          <p class="lede">No sign-in needed. This browser is remembered for 7 days after your last visit, and each visit adds another 7. Your stats stay as long as it’s remembered.</p>
        </section>
        ${statsCard(me.stats)}
        <section class="dash-sec">
          <div class="sec-head"><h2>My quizzes</h2><span class="count">${me.quizzes.length}</span><span class="grow"></span><a class="ghost" href="/explore" data-link>Explore public →</a></div>
          <div class="qgrid">
            ${me.quizzes.map(quizCard).join('')}
            <a class="card qtile newtile" href="/create" data-link><span>+</span>New quiz</a>
            <a class="card qtile newtile imptile" href="/create?import=1" data-link><span class="import-ic">${IMPORT_ICON}</span>Import a quiz<small>From a downloaded quiz, Word, Excel or text</small></a>
          </div>
        </section>
        <section class="dash-sec">
          <div class="sec-head"><h2>Recently played</h2><span class="count">${me.played.length}</span></div>
          ${me.played.length ? `<ul class="card plist">${me.played.map(playedRow).join('')}</ul>
            <p class="hint">Every game you’ve joined from this browser. Tap a live one to jump back in.</p>`
            : '<p class="empty">Games you join from this browser show up here.</p>'}
        </section>
      </main>`;

    app.querySelectorAll('[data-dl]').forEach((b) => { b.onclick = () => downloadQuiz(b.dataset.dl, b); });
    app.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        const card = b.closest('.qtile');
        const title = $('h3', card).textContent;
        const ok = await askConfirm({ title: `Delete “${title}”?`, body: 'It’s removed for good, with its pictures. Copies other people saved from it stay theirs.', yes: 'Delete', danger: true });
        if (!ok) return;
        b.disabled = true;
        try {
          await api(`/api/quizzes/${b.dataset.del}/delete`, {});
          store.del(`blitz:draft:${b.dataset.del}`, localStorage);
          const c = store.get('blitz:me', localStorage);
          if (c) store.set('blitz:me', { ...c, quizzes: c.quizzes.filter((q) => q.id !== b.dataset.del) }, localStorage);
          card.classList.add('leaving');
          setTimeout(() => {
            card.remove();
            const n = app.querySelectorAll('.qtile[data-id]').length;
            const badge = app.querySelector('.dash-sec .sec-head .count');
            if (badge) { badge.textContent = n; bump(badge); }
          }, 260);
          toast('Quiz deleted');
        } catch (err) { b.disabled = false; toast(err.message); }
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
          <a class="ghost home-explore" href="/explore" data-link>Or browse public quizzes →</a>
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

  // ---------- confirm ----------
  // Our own "Are you sure?" dialog. The browser's built-in confirm() can be switched off or silently
  // answer "no" (in-app browsers, home-screen apps, "prevent this page from creating dialogs"), which
  // made Delete do nothing. Resolves true or false.
  function askConfirm({ title, body = '', yes = 'OK', no = 'Cancel', danger = false }) {
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'sheet-back confirm-back';
      back.innerHTML = `
        <div class="sheet confirm" role="alertdialog" aria-modal="true" aria-labelledby="cf-h" aria-describedby="cf-b">
          <div class="confirm-body"><h2 id="cf-h">${esc(title)}</h2>${body ? `<p id="cf-b">${esc(body)}</p>` : ''}</div>
          <footer class="confirm-foot">
            <button class="btn" data-a="no">${esc(no)}</button>
            <button class="btn ${danger ? 'danger' : 'primary'}" data-a="yes">${esc(yes)}</button>
          </footer>
        </div>`;
      const prev = document.activeElement;
      const done = (v) => {
        document.removeEventListener('keydown', key, true);
        back.classList.add('out');
        setTimeout(() => back.remove(), 180);
        prev?.focus?.({ preventScroll: true });
        resolve(v);
      };
      const key = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
        if (e.key === 'Tab') {   // keep focus inside the dialog
          const bs = [...back.querySelectorAll('button')];
          const i = bs.indexOf(document.activeElement);
          e.preventDefault();
          bs[(i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus();
        }
      };
      back.addEventListener('click', (e) => {
        const a = e.target.closest('[data-a]');
        if (a) done(a.dataset.a === 'yes');
        else if (e.target === back) done(false);
      });
      document.addEventListener('keydown', key, true);
      document.body.append(back);
      back.querySelector('[data-a="no"]').focus({ preventScroll: true });   // the safe choice has focus
    });
  }

  // ---------- import helpers ----------
  let importLib = null;
  const loadImporter = () => importLib || (importLib = new Promise((resolve, reject) => {
    if (window.BlitzImport) return resolve(window.BlitzImport);
    const s = document.createElement('script');
    s.src = '/import.js';
    s.onload = () => resolve(window.BlitzImport);
    s.onerror = () => { importLib = null; reject(new Error("Couldn't load the importer — check your connection")); };
    document.head.append(s);
  }));
  // Everything dropped, including whole folders (and the folders inside them).
  async function filesFromDrop(dt) {
    const entries = [...(dt.items || [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
    if (!entries.length) return [...dt.files];
    const out = [];
    const walk = async (en) => {
      if (en.isFile) { try { out.push(await new Promise((res, rej) => en.file(res, rej))); } catch { /* unreadable: skip */ } }
      else if (en.isDirectory) {
        const reader = en.createReader();
        let batch;
        do { batch = await new Promise((res, rej) => reader.readEntries(res, rej)); for (const e of batch) await walk(e); } while (batch.length);
      }
    };
    for (const en of entries) await walk(en);
    return out;
  }
  // Download a quiz as a .zip: quiz.json (everything, Pin areas included), a readable quiz.txt and its
  // pictures. Import turns that file (or the unzipped folder) back into the same quiz, in any browser.
  const slug = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 60);
  async function downloadQuiz(id, btn) {
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Preparing…';
    try {
      const [lib, quiz] = await Promise.all([loadImporter(), api(`/api/quizzes/${id}`)]);
      const blob = await lib.exportQuiz(quiz);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${slug(quiz.title) || 'quiz'}.zip`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      toast('Downloaded — import the .zip to make this quiz again');
    } catch (err) { toast(err.message || "Couldn't download the quiz"); }
    finally { btn.disabled = false; btn.innerHTML = label; }
  }
  const IMPORT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SAMPLE_TXT = `Title: Sample quiz

1. What is the capital of France?
a) Berlin
b) *Paris
c) Rome
d) Madrid
Time: 20
Image: 1.jpg

2. The Moon has its own light.
Answer: False

3. What's the capital of Australia?
Answer: Canberra | Canberra ACT

4. How tall is the Eiffel Tower?
Answer: 330 m
Range: 0-500

5. Order the planets from the Sun
Order: Mercury > Venus > Earth > Mars
`;
  const SAMPLE_CSV = `Question,Answer 1,Answer 2,Answer 3,Answer 4,Correct answer,Time limit,Image
What is the capital of France?,Berlin,Paris,Rome,Madrid,2,20,1.jpg
Which is the largest ocean?,Atlantic,Pacific,Indian,Arctic,Pacific,30,
`;

  // ---------- create ----------

  const blankQuestion = () => ({ type: 'quiz', title: '', image: null, answers: ['', '', '', ''], correct: 0, regions: [], time: 20,
    min: 0, max: 100, step: 1, answer: 50, unit: '', margin: 'medium', accepted: ['', '', '', ''], penalty: 0 });
  const PENALTY_OPTS = [[0, 'Free', 'Pins outside the areas cost nothing'], [100, '−100 each', 'A small cost for guessing'],
    [250, '−250 each', 'Guessing costs points'], [500, '−500 each', 'Only pin when you’re sure']];
  const penaltyText = (n) => (n ? `−${fmt(n)} each` : 'Free');
  // Question types, with the one-line explanation shown in the type picker.
  const TYPES = [
    ['quiz', 'Quiz', 'Pick the right answer from 2–4'],
    ['tf', 'True / False', 'Two big buttons: true or false'],
    ['type', 'Type answer', 'Players type it in; you choose what counts'],
    ['puzzle', 'Puzzle', 'Put 2–4 items in the right order'],
    ['slider', 'Slider', 'Guess a number on a scale'],
    ['pin', 'Pin', 'Drop a pin on the right part of a picture'],
  ];
  const TYPE_MAX = 40;   // longest typed answer
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

  // Bring editor state from any older version of the app up to today's shape: every question gets
  // every field the current editor knows (new types and options included), so nothing is missing.
  const pad4 = (a) => [...(Array.isArray(a) ? a.map((x) => String(x ?? '')) : []), '', '', '', ''].slice(0, 4);
  function upgradeDraft(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.questions) || !d.questions.length) return null;
    return {
      ...d, title: String(d.title || ''), cover: d.cover || null, public: d.public === true,
      questions: d.questions.map((q) => {
        const u = { ...blankQuestion(), ...(q && typeof q === 'object' ? q : {}) };
        if (!TYPES.some(([t]) => t === u.type)) u.type = 'quiz';
        u.answers = pad4(q?.answers);
        u.accepted = pad4(q?.accepted);
        u.regions = Array.isArray(q?.regions) ? q.regions : [];
        if (!TIMES.includes(u.time)) u.time = 20;
        if (!Number.isInteger(u.correct) || u.correct < 0 || u.correct > 3) u.correct = 0;
        if (!MARGIN_SHARE.hasOwnProperty(u.margin)) u.margin = 'medium';
        if (!PENALTY_OPTS.some(([v]) => v === u.penalty)) u.penalty = 0;
        return u;
      }),
    };
  }

  // Turn a saved quiz back into editor state. Pictures stay as URLs; the server keeps them on save.
  const fromSaved = (quiz) => ({
    v: quiz.v,
    title: quiz.title,
    public: !!quiz.public,
    cover: quiz.cover || null,
    questions: quiz.questions.map((q) => (q.type === 'pin'
      ? { ...blankQuestion(), type: 'pin', title: q.title, image: q.image, regions: q.regions, time: q.time, penalty: q.penalty || 0 }
      : q.type === 'tf' ? { ...blankQuestion(), type: 'tf', title: q.title, image: q.image, correct: q.correct, time: q.time }
      : q.type === 'slider' ? { ...blankQuestion(), type: 'slider', title: q.title, image: q.image, time: q.time,
        min: q.min, max: q.max, step: q.step, answer: q.answer, unit: q.unit || '', margin: q.margin }
      : q.type === 'type' ? { ...blankQuestion(), type: 'type', title: q.title, image: q.image, time: q.time, accepted: [...q.accepted, '', '', ''].slice(0, 4) }
      : q.type === 'puzzle' ? { ...blankQuestion(), type: 'puzzle', title: q.title, image: q.image, time: q.time, answers: [...q.answers, '', '', ''].slice(0, 4) }
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
    let d = upgradeDraft(store.get(draftKey, localStorage));
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
      if (!d || d.v !== saved.v) d = upgradeDraft(fromSaved(saved));   // unsaved local edits survive a refresh
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
          <div class="vis">
            <span class="eyebrow">Who can see it</span>
            <div class="seg" id="vis" role="group" aria-label="Who can see this quiz">
              <button type="button" data-vis="0" class="${d.public ? '' : 'on'}" aria-pressed="${!d.public}">Private</button>
              <button type="button" data-vis="1" class="${d.public ? 'on' : ''}" aria-pressed="${!!d.public}">Public</button>
            </div>
            <p class="hint" id="visHint"></p>
          </div>
          <button class="import-cta" id="importOpen" type="button">
            <span class="import-ic" aria-hidden="true">${IMPORT_ICON}</span>
            <span><b>Already have your questions written?</b><small>Import them from a file, a folder with pictures, or pasted text</small></span>
            ${CHEV}</button>
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
          <button class="chip-btn type-chip" data-pick="qtype" aria-haspopup="dialog" aria-expanded="false" aria-label="Question type: ${TYPE_LABEL[q.type]}">
            <span>Type</span><b class="set-val" data-for="qtype">${TYPE_LABEL[q.type]}</b>${UPDOWN}</button>
          <span class="grow"></span>
          <button class="chip-btn" data-pick="time" aria-haspopup="dialog" aria-expanded="false" aria-label="Time to answer: ${q.time} seconds">
            <span>Time</span><b class="set-val" data-for="time">${q.time}s</b>${UPDOWN}</button>
        </header>
        <input class="q-input" data-f="title" maxlength="200" placeholder="${{ pin: 'e.g. Tap the ugliest part of this UI', tf: 'e.g. The Moon has its own light', slider: 'e.g. How tall is the Eiffel Tower?', type: 'e.g. What’s the capital of Australia?', puzzle: 'e.g. Put these planets in order from the Sun' }[q.type] || 'Ask something…'}" value="${esc(q.title)}" aria-label="Question">
        ${picture}
        ${pin ? `<div class="pinrow"><p class="hint">${!q.image ? 'Add a picture, then drag on it to mark the right area.'
          : regions.length ? `${regions.length} area${regions.length === 1 ? '' : 's'} marked — players get ${regions.length} pin${regions.length === 1 ? '' : 's'} and need one in every area for full points. Drag to add more.`
          : 'Drag on the picture to mark the right area. You can mark several.'}</p>
          ${q.image ? '<button class="ghost" data-act="noimg">Remove picture</button>' : ''}</div>
        <div class="settings"><div class="set-group" role="group" aria-label="Scoring">
          ${setRow('penalty', 'Stray pins', penaltyText(q.penalty))}
        </div></div>
        <p class="hint">Pins placed when time runs out count too; locking in early earns more. A pin counts once per area, and a pin where two areas overlap finds both.</p>` : q.type === 'tf' ? `
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
        <p class="hint">Players drag a slider to their guess. Spot on scores full points; inside the shaded band, the closer the better.</p>` : q.type === 'type' ? `
        <div class="answers-edit typed-edit">
          ${q.accepted.map((a, k) => `
            <div class="ans t1">
              <b>${k ? '+' : '✓'}</b>
              <input data-f="accepted" data-k="${k}" maxlength="${TYPE_MAX}" placeholder="${k ? 'Also accept (optional)' : 'Right answer'}" value="${esc(a)}" aria-label="${k ? `Also accept ${k}` : 'Right answer'}">
            </div>`).join('')}
        </div>
        <p class="hint">Players type their answer (up to ${TYPE_MAX} characters). Capitals, accents and punctuation don’t matter, and one typo is forgiven in answers of 6+ letters. Add other spellings players might use.</p>` : q.type === 'puzzle' ? `
        <ol class="answers-edit puzzle-edit">
          ${q.answers.map((a, k) => `
            <li class="ans t${k}">
              <b>${k + 1}</b>
              <input data-f="answer" data-k="${k}" maxlength="100" placeholder="${k < 2 ? `${['First', 'Second'][k]} item` : `${['Third', 'Fourth'][k - 2]} item (optional)`}" value="${esc(a)}" aria-label="Item ${k + 1}">
            </li>`).join('')}
        </ol>
        <p class="hint">Write the items in the right order, top to bottom. Players see them shuffled and drag them into place; only the exact order scores.</p>` : `
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
      const show = { time: `${q.time}s`, qtype: TYPE_LABEL[q.type], penalty: penaltyText(q.penalty), min: withUnit(q.min, q.unit), max: withUnit(q.max, q.unit), answer: withUnit(q.answer, q.unit),
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
      else if (f === 'accepted') q.accepted[+e.target.dataset.k] = e.target.value;
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
        if (field === 'qtype') {
          return openPicker(pickBtn, { title: 'Question type', kind: 'choices', value: q.type, options: TYPES, onChange: (v) => {
            if (q.type === v) return;
            q.type = v;
            if (v === 'tf' && q.correct > 1) q.correct = 0;
            q.accepted = q.accepted || ['', '', '', ''];
            save(); draw();
            const c = list.querySelector(`[data-q="${i}"]`);
            c?.classList.add('retype'); setTimeout(() => c?.classList.remove('retype'), 500);
          } });
        }
        const specs = {
          time: { title: 'Time to answer', kind: 'choices', value: q.time, options: TIMES.map((t) => [t, `${t} seconds`]), onChange: (v) => set(+v) },
          min: { title: 'From', kind: 'number', value: q.min, step: q.step, unit: q.unit, note: 'The lowest value on the slider.', onChange: (v) => set(v) },
          max: { title: 'To', kind: 'number', value: q.max, step: q.step, unit: q.unit, note: 'The highest value on the slider.', onChange: (v) => set(v) },
          answer: { title: 'Right answer', kind: 'number', value: q.answer, step: q.step, unit: q.unit, note: 'Must be between From and To.', onChange: (v) => set(v) },
          unit: { title: 'Unit', kind: 'text', value: q.unit, placeholder: 'e.g. m, %, years', suggestions: ['', 'm', 'km', '%', 'years', 'kg', '°C', '€'], onChange: (v) => set(v.trim()) },
          penalty: { title: 'Stray pins', kind: 'choices', value: q.penalty, options: PENALTY_OPTS, onChange: (v) => set(+v) },
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
    $('#importOpen').onclick = () => openImport();
    // Private (only you) or Public (on Explore: anyone can preview it without the answers, host or save a copy).
    const visHint = () => {
      $('#visHint').textContent = d.public
        ? 'Anyone can find it on Explore, see its questions (not the answers) and save their own copy. Copies stay theirs, even if you delete yours.'
        : 'Only you can see it. Share it by hosting a game, or by downloading it.';
    };
    visHint();
    placeThumb($('#vis'));
    document.fonts?.ready.then(() => placeThumb($('#vis')));
    $('#vis').onclick = (e) => {
      const b = e.target.closest('[data-vis]');
      if (!b || !!+b.dataset.vis === !!d.public) return;
      const from = thumbAt($('#vis'));
      d.public = !!+b.dataset.vis;
      $('#vis').querySelectorAll('button').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
      placeThumb($('#vis'), from);
      visHint(); bump($('#visHint')); buzz(6);
      save();
    };
    if (!editId && new URLSearchParams(location.search).has('import')) {   // "Import a quiz" from the dashboard
      history.replaceState(null, '', '/create');
      setTimeout(() => openImport(), 50);
    }

    // ---------- import: questions you already wrote, from files, a folder or pasted text ----------
    // The reading itself lives in /import.js (loaded the first time you open this); here we gather the
    // files, match pictures to questions, show what was found, and add it to the quiz.
    function openImport() {
      closePicker(false);
      const urls = [];
      let files = [], pasted = '', result = null, busy = false, seq = 0;
      const zipCache = new WeakMap();
      const back = document.createElement('div');
      back.className = 'sheet-back';
      back.innerHTML = `
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="imp-h">
          <header class="sheet-head"><h2 id="imp-h">Import questions</h2><button class="sheet-x" aria-label="Close">✕</button></header>
          <div class="sheet-body">
            <label class="imp-drop" id="impDrop">
              <input type="file" id="impFiles" multiple hidden accept=".zip,.txt,.md,.markdown,.csv,.tsv,.json,.xlsx,.docx,image/*">
              <span class="drop-hint"><b>Drop a file or a whole folder here</b>
                <small>A downloaded Blitz quiz (.zip), Word (.docx), Excel (.xlsx), .csv, .txt, .md or .json — plus pictures</small></span>
            </label>
            <div class="imp-pick">
              <button class="btn small" id="impChoose" type="button">Choose files</button>
              <button class="btn small" id="impFolder" type="button">Choose a folder</button>
              <input type="file" id="impDir" hidden webkitdirectory directory multiple>
            </div>
            <div id="impFileList"></div>
            <label class="imp-paste"><span class="eyebrow">Or paste them</span>
              <textarea id="impText" rows="7" spellcheck="false" placeholder="1. What is the capital of France?&#10;a) Berlin&#10;b) *Paris&#10;c) Rome&#10;&#10;2. The Moon has its own light.&#10;Answer: False"></textarea></label>
            <details class="imp-help"><summary>How to write them</summary>
              <div class="imp-help-body">
                <pre>1. What is the capital of France?
a) Berlin
b) *Paris          ← mark the right one: *, ✓, [x] or bold
c) Rome
Time: 30
Image: paris.jpg

2. The Moon has its own light.
Answer: False                  ← True / False

3. What's the capital of Australia?
Answer: Canberra | Canberra ACT  ← Type answer (| = also accept)

4. How tall is the Eiffel Tower?
Answer: 330 m
Range: 0-500                   ← Slider

5. Order the planets from the Sun
Order: Mercury > Venus > Earth ← Puzzle</pre>
                <ul>
                  <li><b>Right answers</b> can also be given as <code>Answer: B</code> under the question, or in an <b>Answer key</b> at the end (<code>1-B, 2-C</code>).</li>
                  <li><b>Spreadsheets</b> (.xlsx, .csv, or rows pasted from one): a header row with <i>Question</i>, <i>Answer 1–4</i>, <i>Correct answer</i> and optionally <i>Time limit</i> and <i>Image</i>. Kahoot's quiz template works as it is.</li>
                  <li><b>Word</b>: questions as lines or a numbered list, answers as a sub-list; bold marks the right one.</li>
                  <li><b>Pictures</b>: put them in the same folder, named <code>1.jpg</code>, <code>2.png</code>… for each question, or name them with <code>Image:</code>. One called <code>cover</code> becomes the intro picture.</li>
                  <li><b>PDF, Google Docs, a website</b>: copy the text and paste it above.</li>
                  <li>Pin questions can't be imported: their areas are drawn on the picture in the editor.</li>
                </ul>
                <p class="imp-samples">Samples: <a download="blitz-sample.txt" href="data:text/plain;charset=utf-8,${encodeURIComponent(SAMPLE_TXT)}">text</a> · <a download="blitz-sample.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}">spreadsheet (.csv)</a></p>
              </div></details>
            <div id="impOut" aria-live="polite"></div>
          </div>
          <footer class="sheet-foot"><span id="impSum" class="imp-sum"></span><button class="btn primary" id="impAdd" disabled>Add questions</button></footer>
        </div>`;
      document.body.append(back);
      document.documentElement.classList.add('sheet-open');
      const $s = (sel) => back.querySelector(sel);
      const close = () => {
        urls.forEach((u) => URL.revokeObjectURL(u));
        document.documentElement.classList.remove('sheet-open');
        back.classList.add('out');
        document.removeEventListener('keydown', esc_);
        setTimeout(() => back.remove(), 180);
      };
      const esc_ = (e) => { if (e.key === 'Escape' && !busy) close(); };
      document.addEventListener('keydown', esc_);
      $s('.sheet-x').onclick = () => !busy && close();
      back.addEventListener('pointerdown', (e) => { if (e.target === back && !busy) close(); });
      $s('#impChoose').onclick = () => $s('#impFiles').click();
      $s('#impFolder').onclick = () => $s('#impDir').click();
      const useless = (f) => /(^|\/)(\.|__MACOSX)/.test(f.webkitRelativePath || f.name) || f.name.startsWith('.');
      const take = (list) => {
        const add = [...list].filter((f) => !useless(f));
        const key = (f) => `${f.webkitRelativePath || f.name}:${f.size}`;
        const have = new Set(files.map(key));
        files = [...files, ...add.filter((f) => !have.has(key(f)))];
        refresh();
      };
      $s('#impFiles').onchange = (e) => { take(e.target.files); e.target.value = ''; };
      $s('#impDir').onchange = (e) => { take(e.target.files); e.target.value = ''; };
      const drop = $s('#impDrop');
      back.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
      back.addEventListener('dragleave', (e) => { if (e.target === back || !back.contains(e.relatedTarget)) drop.classList.remove('over'); });
      back.addEventListener('drop', async (e) => { e.preventDefault(); drop.classList.remove('over'); take(await filesFromDrop(e.dataTransfer)); });
      let typing = 0;
      $s('#impText').oninput = (e) => { clearTimeout(typing); typing = setTimeout(() => { pasted = e.target.value; refresh(); }, 250); };
      $s('#impFileList').onclick = (e) => {
        const b = e.target.closest('[data-rm]');
        if (b) { files.splice(+b.dataset.rm, 1); refresh(); }
      };
      setTimeout(() => $s('#impText').focus({ preventScroll: true }), 60);

      async function refresh() {
        const my = ++seq;
        const lib = await loadImporter().catch((err) => { toast(err.message); return null; });
        if (!lib || my !== seq) return;
        // A .zip (like a downloaded quiz) is opened and read like a dropped folder.
        const errors = [];
        const all = [];
        for (const f of files) {
          if (!/\.zip$/i.test(f.name)) { all.push(f); continue; }
          if (!zipCache.has(f)) zipCache.set(f, lib.filesFromZip(f).catch((err) => { errors.push(`${f.name}: ${err.message}`); return []; }));
          all.push(...await zipCache.get(f));
        }
        if (my !== seq) return;
        const docs0 = all.filter((f) => lib.QUESTION_FILE.test(f.name)).sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, undefined, { numeric: true }));
        const pics = all.filter((f) => lib.IMAGE_FILE.test(f.name) || (f.type.startsWith('image/') && !lib.QUESTION_FILE.test(f.name)));
        const other = all.filter((f) => !docs0.includes(f) && !pics.includes(f));
        errors.push(...other.map((f) => `${f.name}: not a question file or a picture`));
        let questions = [], skipped = [], title = null, coverRef = null;
        const read = [];
        for (const f of docs0) {
          try { read.push([f, await lib.readFile(f)]); }
          catch (err) { errors.push(err.message.includes(f.name) ? err.message : `${f.name}: ${err.message}`); }
        }
        // A downloaded Blitz quiz carries a readable quiz.txt copy too: use its quiz.json only.
        const docs = read.some(([, r]) => r.blitz) ? read.filter(([, r]) => r.blitz) : read;
        for (const [f, r] of docs) {
          questions.push(...r.questions); skipped.push(...r.skipped);
          title = title || r.title || f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
          coverRef = coverRef || r.coverRef || null;
        }
        if (pasted.trim()) {
          const r = lib.readText(pasted);
          questions.push(...r.questions); skipped.push(...r.skipped);
          title = title || r.title;
        }
        if (my !== seq) return;
        // Pictures: by name ("Image: paris.jpg"), else by number (1.jpg, q2.png, 03-volcano.webp); "cover" is the intro.
        const stem = (n) => n.toLowerCase().replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
        const byStem = new Map(pics.map((f) => [stem(f.name), f]));
        const byNum = new Map();
        pics.forEach((f) => { const m = stem(f.name).match(/^(?:q(?:uestion)?[\s._-]*)?0*(\d{1,3})(?:[\s._-].*)?$/); if (m && !byNum.has(+m[1])) byNum.set(+m[1], f); });
        const cover = (coverRef && byStem.get(stem(coverRef))) || pics.find((f) => /^(cover|intro|title|quiz)$/.test(stem(f.name))) || null;
        const used = new Set();
        questions = questions.map((q, i) => {
          let pic = null;
          const warnings = [...q.warnings];
          if (q.imageRef) {
            pic = byStem.get(stem(q.imageRef)) || null;
            if (!pic) warnings.push(`Picture “${q.imageRef}” wasn't among the files`);
          } else pic = byNum.get(i + 1) || null;
          if (pic) used.add(pic);
          return { ...q, pic, warnings };
        });
        const unused = pics.filter((f) => !used.has(f) && f !== cover);
        result = { questions, skipped, errors, title, cover, unused, docs: docs.map(([f]) => f), pics };
        render();
      }

      function thumb(f) { const u = URL.createObjectURL(f); urls.push(u); return u; }
      function render() {
        const r = result;
        // Files as small chips (a folder of pictures stays compact); ✕ removes one.
        $s('#impFileList').innerHTML = files.length ? `<ul class="imp-files">${files.map((f, i) => `
          <li class="${BlitzImport.IMAGE_FILE.test(f.name) ? 'pic' : ''}"><span title="${esc(f.webkitRelativePath || f.name)}">${esc(f.name)}</span><button data-rm="${i}" aria-label="Remove ${esc(f.name)}">✕</button></li>`).join('')}</ul>` : '';
        $s('#impDrop').classList.toggle('slim', files.length > 0);
        const ansLine = (q) => q.type === 'quiz' ? q.answers.filter(Boolean).map((a, k) => { const ok = k === q.correct && !q.unsure; return `<span class="ia ${ok ? 'ok' : ''}">${ok ? '✓ ' : ''}${esc(a)}</span>`; }).join('')
          : q.type === 'tf' ? (q.unsure ? '<span class="ia">True</span><span class="ia">False</span>' : `<span class="ia ok">✓ ${q.correct ? 'False' : 'True'}</span>`)
          : q.type === 'type' ? q.accepted.filter(Boolean).map((a, k) => `<span class="ia ${k ? '' : 'ok'}">${k ? '' : '✓ '}${esc(a)}</span>`).join('')
          : q.type === 'slider' ? `<span class="ia ok">✓ ${esc(withUnit(q.answer, q.unit))}</span><span class="ia">${esc(withUnit(q.min, q.unit))} – ${esc(withUnit(q.max, q.unit))}</span>`
          : q.type === 'puzzle' ? q.answers.filter(Boolean).map((a, k) => `<span class="ia">${k + 1}. ${esc(a)}</span>`).join('')
          : q.type === 'pin' ? `<span class="ia ok">${q.regions.length} area${q.regions.length === 1 ? '' : 's'}</span>${q.penalty ? `<span class="ia">Stray pins −${fmt(q.penalty)}</span>` : ''}` : '';
        $s('#impOut').innerHTML = !r || (!r.questions.length && !r.errors.length && !r.skipped.length) ? (files.length || pasted.trim() ? '<p class="hint">No questions found yet. Check “How to write them”.</p>' : '') : `
          ${r.errors.map((e) => `<p class="imp-err">${esc(e)}</p>`).join('')}
          ${r.questions.length ? `<p class="eyebrow imp-found">Found ${r.questions.length} question${r.questions.length === 1 ? '' : 's'}${r.pics.length ? ` · ${r.questions.filter((q) => q.pic).length} with pictures` : ''}${r.cover ? ' · an intro picture' : ''}</p>` : ''}
          <ol class="imp-list">${r.questions.map((q, i) => `
            <li class="${q.warnings.length ? 'warn' : ''}">
              <span class="iq-n">${i + 1}</span>
              <div class="iq-main">
                <div class="iq-top"><span class="iq-type">${TYPE_LABEL[q.type]}</span><span class="iq-time">${q.time}s</span></div>
                <strong>${esc(q.title)}</strong>
                <div class="iq-ans">${ansLine(q)}</div>
                ${q.warnings.map((w) => `<p class="iq-warn">${esc(w)}</p>`).join('')}
              </div>
              ${q.pic ? `<img class="iq-pic" src="${thumb(q.pic)}" alt="">` : ''}
            </li>`).join('')}</ol>
          ${r.skipped.map((q) => `<p class="imp-err">Skipped “${esc(q.title)}”: ${esc(q.reason)}.</p>`).join('')}
          ${r.unused.length ? `<p class="hint">Not used: ${r.unused.map((f) => esc(f.name)).join(', ')}. Name pictures 1.jpg, 2.jpg… or write <code>Image: name</code> under a question.</p>` : ''}`;
        const n = r ? r.questions.length : 0;
        $s('#impAdd').disabled = !n;
        $s('#impAdd').textContent = n ? `Add ${n} question${n === 1 ? '' : 's'}` : 'Add questions';
        const warns = r ? r.questions.filter((q) => q.warnings.length).length : 0;
        $s('#impSum').textContent = warns ? `${warns} to check in the editor` : '';
      }

      $s('#impAdd').onclick = async () => {
        const r = result;
        if (!r || !r.questions.length || busy) return;
        busy = true;
        const btn = $s('#impAdd');
        btn.disabled = true;
        const picOf = async (f) => { try { return await shrink(f); } catch { return null; } };
        const made = [];
        let missing = 0;
        for (const [i, q] of r.questions.entries()) {
          btn.textContent = q.pic ? `Adding pictures… ${i + 1}/${r.questions.length}` : btn.textContent;
          const image = q.pic ? await picOf(q.pic) : null;
          if (q.pic && !image) missing++;
          const base = { ...blankQuestion(), type: q.type, title: q.title, time: q.time, image };
          if (q.type === 'quiz') Object.assign(base, { answers: q.answers, correct: q.correct });
          if (q.type === 'tf') Object.assign(base, { correct: q.correct });
          if (q.type === 'type') Object.assign(base, { accepted: q.accepted });
          if (q.type === 'puzzle') Object.assign(base, { answers: q.answers });
          if (q.type === 'slider') Object.assign(base, { min: q.min, max: q.max, step: q.step, answer: q.answer, unit: q.unit, margin: q.margin });
          if (q.type === 'pin') Object.assign(base, { regions: q.regions, penalty: q.penalty || 0 });
          made.push(base);
        }
        // An untouched blank first question is replaced instead of left above the imports.
        const empty = (q) => !q.title.trim() && !q.image && q.answers.every((a) => !a.trim()) && q.accepted.every((a) => !a.trim());
        if (d.questions.length === 1 && empty(d.questions[0])) d.questions = [];
        const first = d.questions.length;
        d.questions.push(...made);
        if (!d.title.trim() && r.title) { d.title = r.title.slice(0, 120); $('#title').value = d.title; }
        if (!d.cover && r.cover) { const c = await picOf(r.cover); if (c) { d.cover = c; drawCover(); } }
        save(); draw();
        busy = false;
        close();
        toast(`Added ${made.length} question${made.length === 1 ? '' : 's'}${missing ? ` · ${missing} picture${missing === 1 ? '' : 's'} couldn't be read` : ''}`);
        list.children[first]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      refresh();
    }

    $('#add').onclick = () => {
      d.questions.push(blankQuestion());
      save(); draw();
      list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('.q-input', list.lastElementChild).focus({ preventScroll: true });
    };

    $('#publish').onclick = async () => {
      const payload = { title: d.title.trim(), cover: d.cover || null, public: !!d.public, questions: [] };
      if (!payload.title) { $('#title').focus(); return toast('Give your quiz a title'); }
      for (const [i, q] of d.questions.entries()) {
        const n = i + 1;
        if (!q.title.trim()) return toast(`Question ${n} needs a title`);
        if (q.type === 'pin') {
          if (!q.image) return toast(`Question ${n} needs a picture to pin on`);
          if (!q.regions?.length) return toast(`Question ${n}: drag on the picture to mark the right area`);
          payload.questions.push({ type: 'pin', title: q.title.trim(), image: q.image, regions: q.regions, time: q.time, penalty: q.penalty || 0 });
          continue;
        }
        if (q.type === 'tf') {
          payload.questions.push({ type: 'tf', title: q.title.trim(), image: q.image, correct: q.correct ? 1 : 0, time: q.time });
          continue;
        }
        if (q.type === 'type') {
          const accepted = q.accepted.map((a) => a.trim()).filter(Boolean);
          if (!accepted.length) return toast(`Question ${n}: write the right answer`);
          payload.questions.push({ type: 'type', title: q.title.trim(), image: q.image, time: q.time, accepted });
          continue;
        }
        if (q.type === 'puzzle') {
          const items = q.answers.map((a) => a.trim());
          const filled = items.filter(Boolean);
          if (filled.length < 2) return toast(`Question ${n}: a puzzle needs at least 2 items`);
          if (items.slice(0, filled.length).some((a) => !a)) return toast(`Question ${n}: fill the puzzle items from the top, without gaps`);
          payload.questions.push({ type: 'puzzle', title: q.title.trim(), image: q.image, time: q.time, answers: filled });
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
          ${nav(`<a class="btn small" href="/edit/${id}" data-link>Edit</a><button class="btn primary small" id="open">Open<span class="hide-xs"> lobby</span> →</button>`)}
          <section class="create-head">
            <p class="eyebrow">Preview · ${n} question${n === 1 ? '' : 's'}</p>
            <h1 class="display">${esc(quiz.title)}</h1>
            <p class="lede">Check your questions below. When you're happy, open the lobby to let people in.</p>
          </section>
          <section class="card readybox" aria-label="How hosting works">
            <div class="ready-text">
              <p class="eyebrow">Ready to play?</p>
              <h2>Opening the lobby starts a live game.</h2>
              <ol class="ready-steps">
                <li><b>1</b><span><strong>You get a PIN and a link</strong> to show on your screen or send to people.</span></li>
                <li><b>2</b><span><strong>Players join on their phones</strong> and pop in as characters while they wait.</span></li>
                <li><b>3</b><span><strong>Press Start when everyone's in.</strong> You run each question from this screen.</span></li>
              </ol>
            </div>
            <button class="btn primary ready-go" id="open3">Open lobby →</button>
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
                  : 'Pins inside the highlighted area score.'}${q.penalty ? ` Pins outside cost ${fmt(q.penalty)} points each.` : ''}</p>`
                : q.type === 'slider'
                ? `${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
                   ${numberLine(q, { answer: q.answer, tolerance: MARGIN_SHARE[q.margin] * (q.max - q.min) })}
                   <p class="hint">Right answer ${esc(withUnit(q.answer, q.unit))}${q.margin === 'exact' ? ', exact guesses only' : '; guesses in the shaded band score too'}.</p>`
                : q.type === 'type'
                ? `${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
                   ${acceptChips(q.accepted)}
                   <p class="hint">Players type their answer. ${q.accepted.length > 1 ? 'Any of these counts' : 'This counts'}, ignoring capitals, accents and a small typo.</p>`
                : q.type === 'puzzle'
                ? `${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
                   ${orderList(q.answers, 'soft')}
                   <p class="hint">The right order. Players see the items shuffled; only the exact order scores.</p>`
                : `${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
                   ${tiles(q.answers, (k) => (k === q.correct ? { cls: 'right', extra: '<em>✓ Correct</em>' } : { cls: 'soft' }), q.type)}`}
            </section>`).join('')}
          <div class="cta end"><button class="btn" id="dlQuiz">Download quiz</button><button class="btn primary" id="open2">Open lobby →</button></div>
        </main>`;
      $('#open').onclick = $('#open2').onclick = $('#open3').onclick = openLobby;
      $('#dlQuiz').onclick = () => downloadQuiz(id, $('#dlQuiz'));
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
                <div class="linkcard">
                  <svg class="link-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                  <span class="link-text" id="link"><span class="nb">${esc(link.replace(/^https?:\/\//, '').replace(/\/play.*/, ''))}</span><wbr><span class="nb">${esc(link.replace(/^.*(\/play)/, '$1'))}</span></span>
                  <button class="btn small" id="copy">Copy</button>
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
        $('#copy').onclick = async () => {
          const b = $('#copy');
          try {
            await navigator.clipboard.writeText(link);
            b.textContent = 'Copied ✓'; bump(b); buzz(10);
            clearTimeout(b._t); b._t = setTimeout(() => { b.textContent = 'Copy'; }, 1600);
          } catch {   // no clipboard access: select the link (with the usual highlight) so it can be copied by hand
            const r = document.createRange(); r.selectNodeContents($('#link'));
            getSelection().removeAllRanges(); getSelection().addRange(r);
            toast('Press ⌘C to copy');
          }
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
          : q.type === 'type'
          ? `${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
             ${reveal
               ? `${acceptChips(s.accepted)}
                  ${s.typed.length ? `<div class="typed">${s.typed.map((t) => `<span class="typed-chip ${t.ok ? 'ok' : ''}">${esc(t.text)}<em>${t.n}</em></span>`).join('')}</div>` : ''}
                  <p class="pinstat"><strong>${s.hits}</strong> of ${s.count} typed it right</p>`
               : `<div class="typebox ghosted" aria-hidden="true">${TYPE_ICON}<span>Type your answer<i class="caret"></i></span></div>`}`
          : q.type === 'puzzle'
          ? `${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
             ${reveal
               ? `${orderList(s.solution, 'reveal', q.answers)}<p class="pinstat"><strong>${s.hits}</strong> of ${s.count} got the order right</p>`
               : `${orderList(q.answers, 'shuffled')}<p class="pinstat">Shuffled — players drag them into the right order</p>`}`
          : `${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}${reveal ? answerChart(q, s.counts, s.correct) : ''}`;
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
            ${pin || ['slider', 'type', 'puzzle'].includes(q.type) ? '' : tiles(q.answers, (i) => (!reveal ? {} : {
              cls: i === s.correct ? 'right' : 'faded',
              extra: `<em>${i === s.correct ? '✓ ' : ''}${s.counts[i]}</em>`,
            }), q.type)}
            ${reveal ? repliesPanel(q, s) : ''}
          </main>`;
        $('#next').onclick = () => act(s, 'next');
        return;
      }

      // final
      const top = s.players.slice(0, 3);
      const order = [top[1], top[0], top[2]];
      app.innerHTML = `
        <main class="page final">
          ${confetti()}
          ${nav(`<span class="pill">${esc(s.quizTitle)}</span>`)}
          <section class="final-head">
            <p class="eyebrow">Final standings</p>
            <h1 class="display">${top[0] ? `${esc(top[0].name)} <em>wins.</em>` : 'Game over.'}</h1>
          </section>
          <div class="podium">
            ${order.map((p, i) => (p ? `
              <div class="step s${[2, 1, 3][i]}">
                <div class="step-art">${avatar(p.look || p.name)}${medal([2, 1, 3][i])}</div>
                <strong>${esc(p.name)}</strong><span>${fmt(p.score)}</span>
                <div class="block">${[2, 1, 3][i]}</div>
              </div>` : '<div class="step"></div>')).join('')}
          </div>
          ${s.players.length > 3 ? `<ol class="board card rest" start="4">${s.players.slice(3).map((p, i) => `
            <li><span class="rank">${i + 4}</span><span class="name">${esc(p.name)}</span><span class="score">${fmt(p.score)}</span></li>`).join('')}</ol>` : ''}
          <div class="cta end">
            <button class="btn primary" id="again">Play again</button>
            <a class="btn" href="/leaderboard" data-link>Leaderboard</a>
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
      if (key === viewKey) {   // same screen: just keep the lobby head-count fresh
        const wc = $('#wcount');
        if (wc && wc.textContent !== waitCount(s.count)) { wc.textContent = waitCount(s.count); bump(wc); }
        return;
      }
      viewKey = key;
      const me = `<span class="pill">${esc(s.name)}</span><span class="pill score-pill">${fmt(s.score)}</span>`;
      const centered = (inner) => { app.innerHTML = `<main class="page center">${nav(me)}<div class="solo">${inner}</div></main>`; };

      if (s.phase === 'lobby') {
        return centered(`
          <div class="waitroom">
            ${s.cover ? `<img class="intro-img small" src="${s.cover}" alt="" decoding="async">` : ''}
            <div class="me-stage">${buddy(s.name, s.look, 'me new')}</div>
            <h1 class="display">You’re in, <em>${esc(s.name)}.</em></h1>
            ${waitingChip('Waiting for the host to start')}
            <p class="lede"><span id="wcount">${waitCount(s.count)}</span> · PIN ${pinText(s.pin)}</p>
          </div>`);
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
        // Pins are saved as you go (a draft): when time runs out they count even if you never lock in.
        const picks = Array.isArray(s.draft) ? s.draft.map(([x, y]) => ({ x, y })) : [];
        let draftT = 0;
        const saveDraft = () => {
          clearTimeout(draftT);
          draftT = setTimeout(() => api('/api/act', { pin: session.pin, player: session.player, action: 'draft', choice: picks }).catch(() => {}), 250);
        };
        const box = $('.pinbox');
        const update = () => {
          box.querySelectorAll('.marker').forEach((m) => m.remove());
          picks.forEach((p, i) => box.insertAdjacentHTML('beforeend', marker(p.x, p.y, `${i === picks.length - 1 ? 'drop-in' : ''}`)));
          const left = max - picks.length;
          $('#pinhint').textContent = (!picks.length
            ? (max > 1 ? `Find ${max} spots: tap to drop up to ${max} pins, one in each` : 'Tap the picture to drop your pin')
            : `${left ? `${left} pin${left === 1 ? '' : 's'} left · tap a pin to remove it` : 'All pins placed · tap a pin to move it'}. They count when time’s up; lock in now for more points.`)
            + (q.penalty ? ` Pins outside the areas cost ${fmt(q.penalty)} points each.` : '');
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
          saveDraft();
        };
        update();
        $('#lock').onclick = () => {
          if (!picks.length) return;
          clearTimeout(draftT);
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

      // Shared top of a player's question screen.
      const playerHead = (q) => `
            <div class="timerbar"><i data-bar></i></div>
            <header class="bar">
              <span class="pill">${s.qIndex + 1} / ${s.total}</span>
              <span class="grow"></span>
              <span class="pill timer"><span data-secs></span>s</span>
            </header>`;

      if (s.phase === 'question' && s.choice === null && s.question.type === 'type') {
        const q = s.question;
        app.innerHTML = `
          <main class="page stage player typeq">
            ${playerHead(q)}
            <section class="qwrap"><div class="qmain">
              <h1 class="qtitle">${esc(q.title)}</h1>
              ${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
              <form class="typebox" id="typeform" autocomplete="off">
                ${TYPE_ICON}
                <input id="typed" maxlength="${TYPE_MAX}" placeholder="Type your answer" aria-label="Your answer"
                  autocapitalize="sentences" autocorrect="off" spellcheck="false" enterkeyhint="send">
                <span class="typecount" id="tcount">0/${TYPE_MAX}</span>
              </form>
            </div></section>
            <div class="lockbar"><button class="btn primary" id="lock" disabled>Lock in →</button></div>
          </main>`;
        const input = $('#typed');
        const sync = () => { $('#lock').disabled = !input.value.trim(); $('#tcount').textContent = `${input.value.length}/${TYPE_MAX}`; };
        input.oninput = sync;
        setTimeout(() => input.focus({ preventScroll: true }), 60);
        const send = () => {
          const v = input.value.trim();
          if (!v || $('#lock').disabled) return;
          $('#lock').disabled = true; input.disabled = true; buzz(12);
          api('/api/act', { pin: session.pin, player: session.player, action: 'answer', choice: v })
            .catch((err) => { toast(err.message); input.disabled = false; sync(); });
        };
        $('#typeform').onsubmit = (e) => { e.preventDefault(); send(); };
        $('#lock').onclick = send;
        return;
      }

      if (s.phase === 'question' && s.choice === null && s.question.type === 'puzzle') {
        const q = s.question;
        // Shown indices, top to bottom. The order is saved as you go (a draft): when time runs out it
        // counts even if you never lock in. Coming back (a reload) restores it.
        let order = Array.isArray(s.draft) && s.draft.length === q.answers.length ? [...s.draft] : q.answers.map((_, i) => i);
        app.innerHTML = `
          <main class="page stage player puzzleq">
            ${playerHead(q)}
            <section class="qwrap"><div class="qmain">
              <h1 class="qtitle">${esc(q.title)}</h1>
              ${q.image ? `<img class="qimg" src="${q.image}" alt="" decoding="async">` : ''}
              <ol class="order sortable" id="sort" aria-label="Drag the items into the right order"></ol>
              <p class="hint">Drag to reorder, top to bottom. Your order counts when time’s up; lock in now for more points.</p>
            </div></section>
            <div class="lockbar"><button class="btn primary" id="lock">Lock in →</button></div>
          </main>`;
        const box = $('#sort');
        const paint = (focus) => {
          box.innerHTML = order.map((d, k) => `
            <li class="otile t${d}" data-d="${d}" tabindex="0" aria-label="${k + 1}: ${esc(q.answers[d])}. Use the arrow keys to move it.">
              <b>${L[d]}</b><span>${esc(q.answers[d])}</span><i class="grip" aria-hidden="true"></i></li>`).join('');
          if (focus !== undefined) box.children[focus]?.focus({ preventScroll: true });
        };
        paint();
        const move = (from, to, focus) => {
          if (to < 0 || to >= order.length || to === from) return;
          const [d] = order.splice(from, 1);
          order.splice(to, 0, d);
          paint(focus ? to : undefined);
          box.children[to]?.classList.add('settle');
          buzz(8);
          api('/api/act', { pin: session.pin, player: session.player, action: 'draft', choice: order }).catch(() => {});
        };
        box.addEventListener('keydown', (e) => {
          const li = e.target.closest('li');
          if (!li || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
          e.preventDefault();
          const k = [...box.children].indexOf(li);
          move(k, k + (e.key === 'ArrowUp' ? -1 : 1), true);
        });
        // Drag: the item follows the finger; the others slide out of its way; let go to drop it there.
        box.addEventListener('pointerdown', (e) => {
          const li = e.target.closest('li');
          if (!li || box.classList.contains('locked') || e.button > 0) return;
          e.preventDefault();
          const items = [...box.children];
          const from = items.indexOf(li);
          const rects = items.map((el) => el.getBoundingClientRect());
          const gap = items.length > 1 ? rects[1].top - rects[0].bottom : 0;
          const room = rects[from].height + gap;   // how far the others slide to make space (rows can differ in height)
          const y0 = e.clientY;
          let to = from;
          li.classList.add('lifted');
          box.classList.add('dragging');
          li.setPointerCapture(e.pointerId);
          buzz(6);
          const onMove = (ev) => {
            const dy = Math.max(rects[0].top - rects[from].top - 12, Math.min(rects.at(-1).bottom - rects[from].bottom + 12, ev.clientY - y0));
            li.style.transform = `translateY(${dy}px) scale(1.03)`;
            // Its new place: after every other row whose middle it has passed.
            const mid = rects[from].top + rects[from].height / 2 + dy;
            const next = rects.filter((r, k) => k !== from && r.top + r.height / 2 < mid).length;
            if (next !== to) { to = next; buzz(4); }
            items.forEach((el, k) => {
              if (el === li) return;
              const shift = from < to && k > from && k <= to ? -room : from > to && k < from && k >= to ? room : 0;
              el.style.transform = shift ? `translateY(${shift}px)` : '';
            });
          };
          const onUp = () => {
            li.removeEventListener('pointermove', onMove);
            li.removeEventListener('pointerup', onUp);
            li.removeEventListener('pointercancel', onUp);
            box.classList.remove('dragging');
            if (to === from) { li.classList.remove('lifted'); li.style.transform = ''; return; }
            move(from, to);
          };
          li.addEventListener('pointermove', onMove);
          li.addEventListener('pointerup', onUp);
          li.addEventListener('pointercancel', onUp);
        });
        $('#lock').onclick = () => {
          $('#lock').disabled = true; box.classList.add('locked'); buzz(12);
          api('/api/act', { pin: session.pin, player: session.player, action: 'answer', choice: order })
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
            : s.question.type === 'type' ? `<div class="avatar icon-avatar">${TYPE_ICON}</div><p class="lede">“${esc(s.choice)}”</p>`
            : s.question.type === 'puzzle' ? `<div class="avatar icon-avatar">${PUZZLE_ICON}</div>`
            : `<div class="avatar t${s.choice}">${L[s.choice]}</div>`}
          <h1 class="display">Locked <em>in.</em></h1>
          ${waitingChip('Waiting for everyone else')}`);
      }

      if (s.phase === 'reveal') {
        const right = s.right;
        const pin = s.question.type === 'pin';
        const slider = s.question.type === 'slider';
        const areas = pin ? s.regions.length : 0;
        const partial = pin && !right && s.found > 0;
        const exact = slider && s.choice !== null && Math.abs(s.choice - s.correct) < 1e-9;
        const typed = s.question.type === 'type';
        const puzzle = s.question.type === 'puzzle';
        const why = typed ? (right ? (s.accepted.some((a) => a.trim().toLowerCase() === String(s.choice).trim().toLowerCase())
              ? 'Correct — nicely done.' : `Close enough — <strong>${esc(s.accepted[0])}</strong> counts.`)
            : s.choice === null ? `The answer was <strong>${esc(s.accepted[0])}</strong>.`
            : `The answer was <strong>${esc(s.accepted[0])}</strong> · you typed “${esc(s.choice)}”.`)
          : puzzle ? (right ? 'Perfect order.' : s.choice === null ? 'Here’s the right order.' : 'Not quite the right order. Here it is:')
          : slider ? (s.choice === null ? `The answer was <strong>${esc(withUnit(s.correct, s.question.unit))}</strong>.`
            : `The answer was <strong>${esc(withUnit(s.correct, s.question.unit))}</strong> · you said ${esc(withUnit(s.choice, s.question.unit))}.${exact ? ' Spot on!' : right ? ' Close enough.' : ''}`)
          : right ? (pin ? (areas > 1 ? `You found all ${areas} areas.` : 'Right on target.') : 'Correct — nicely done.')
          : pin ? (s.choice === null ? `Here’s where the right area${areas > 1 ? 's were' : ' was'}.`
            : partial ? `You found ${s.found} of ${areas} areas.` : `Your pin${pinsOf(s.choice).length > 1 ? 's' : ''} missed the area${areas > 1 ? 's' : ''}.`)
          : `The answer was <strong>${esc(s.question.answers[s.correct])}</strong>.`;
        // Pins or an order left on screen when time ran out still counted; stray pins may have cost points.
        const extra = [
          s.auto ? 'Time ran out, so what you had placed counted.' : '',
          pin && s.stray && s.question.penalty ? `${s.stray} stray pin${s.stray > 1 ? 's' : ''} cost ${fmt(s.stray * s.question.penalty)} points.` : '',
        ].filter(Boolean).join(' ');
        buzz(right ? [14, 60, 14] : 40);
        return centered(`
          <div class="verdict ${right ? 'good' : partial ? 'half' : 'bad'}">${right ? '✓' : partial ? '½' : '✕'}</div>
          <h1 class="display">${s.gained ? signed(s.gained) : s.choice === null ? 'Time’s <em>up.</em>' : 'Not <em>quite.</em>'}</h1>
          <p class="lede">${why}${extra ? `<br><small class="lede-note">${extra}</small>` : ''}</p>
          ${pin ? pinBox(s.question.image, s.regions.map((r) => regionEl(r)).join('')
            + pinsOf(s.choice).map((pt) => marker(pt[0], pt[1], `drop-in ${s.regions.some((r) => inRegion(r, pt)) ? 'ok' : 'miss'}`)).join(''), 'result') : ''}
          ${slider ? numberLine(s.question, { answer: s.correct, tolerance: s.tolerance, you: s.choice }) : ''}
          ${puzzle && !right ? orderList(s.solution, 'reveal', s.question.answers) : ''}
          <p class="standing">${ordinal(s.rank)} of ${s.count} · ${fmt(s.score)} pts</p>`);
      }

      // Final: the bigger the finish, the bigger the party.
      const place = s.rank;
      const podium = place <= 3 && s.count > 1;
      const line = s.count < 2 ? 'Solo run complete.'
        : place === 1 ? 'You won. Take a bow.'
        : place === 2 ? 'Silver! So close to the top.'
        : place === 3 ? 'Bronze — you made the podium.'
        : place <= Math.ceil(s.count / 2) ? `Top half of ${s.count}. Nice run.`
        : `${ordinal(place)} of ${s.count}. Run it back?`;
      buzz(podium ? [20, 80, 20, 80, 60] : 30);
      centered(`
        ${podium || s.count < 2 ? confetti(place === 1 ? 90 : 50) : ''}
        <div class="final-me ${podium ? `p${place}` : ''}">
          ${buddy(s.name, s.look, `me champ ${podium ? 'jump' : ''}`)}
          ${podium ? medal(place) : ''}
        </div>
        <p class="eyebrow">Final result</p>
        <h1 class="mega small ${podium ? `glow p${place}` : ''}">${ordinal(place)}</h1>
        <p class="lede">${line}</p>
        <p class="standing big"><span id="pts">0</span> pts</p>
        <div class="lifetime" id="life" hidden></div>
        <div class="cta end">
          <a class="btn primary" href="/leaderboard" data-link>See leaderboard</a>
          <a class="btn" href="/" data-link>Done</a>
        </div>`);
      countUp($('#pts'), s.score);
      // The server adds this game to your lifetime stats as it ends; show what it did for you.
      const life = $('#life');
      setTimeout(() => api('/api/me').then((me) => {
        const st = me.stats;
        if (!alive || !life.isConnected || !st) return;
        store.set('blitz:me', me, localStorage);
        life.innerHTML = s.count < 2
          ? '<span class="lchip">Solo games don’t count toward the leaderboard</span>'
          : st.games ? `${place === 1 ? `<span class="lchip hot">Win #${fmt(st.wins)}</span>` : ''}
            <span class="lchip">Rating <b>${fmt(st.rating)}</b></span>
            <span class="lchip">#${fmt(st.rank || 1)} worldwide</span>
            ${st.best === s.score && st.games > 1 ? '<span class="lchip hot">New personal best</span>' : ''}` : '';
        if (life.innerHTML.trim()) { life.hidden = false; bump(life); }
      }).catch(() => {}), 900);
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
  // Anything with its own solid background is a surface: the pill goes above that background, under its text.
  const SURFACES = '.card, .nav, .tile, .shot, .linkcard, .chip, .pill, .ppin, .buddy, .standing, .waiting-chip, .set-group, .ans, .pop, .readybox, .lchip, .stat, .otile, .accept, .typed-chip, .typebox, .chart, .rlist li, .slider-stage, .pinstat, .sheet, .imp-list li, .import-cta, .imp-files li, .imp-paste textarea, .ex-search, .ex-types span, .menu-pop, .menu-btn';
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
