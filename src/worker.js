// Blitz on Cloudflare: this Worker answers /api/*; static files in /public are served by the assets binding.
//
// - D1 (binding DB) keeps quizzes, pictures, who-made-what and play history.
// - One Durable Object per game PIN (binding GAME) runs the live game: players, timer, scores,
//   and pushes updates to every screen over server-sent events.
// - No accounts: each browser gets a private cookie. Everything tied to it is kept for 7 days
//   after the last visit; a daily cron forgets browsers that haven't been back, and deletes
//   quizzes nobody has played or edited for 15 days.
//
// The API matches server.py (the local, standard-library Python version), so public/app.js runs on either.
import { DurableObject } from "cloudflare:workers";

const DAY = 86400;
const WEEK = 7 * DAY;
const GAME_TTL = 4 * 3600; // a live game lasts at most 4 hours
const QUIZ_TTL = 15 * DAY;
// Lifetime stats: everything a browser earns is kept as long as the browser is remembered (7 days
// after its last visit, renewed on every visit); when it's forgotten, its stats go too.
const RATING = "(points + 1000 * wins + 300 * podiums)"; // Blitz rating: points, plus 1,000 a win, 300 a 2nd/3rd place
const RATED_MIN_PLAYERS = 2;                            // solo games don't count, so nobody can farm wins alone
const statsOf = (u) => {
  const games = u?.games || 0, points = u?.points || 0, wins = u?.wins || 0, podiums = u?.podiums || 0;
  return { games, points, wins, podiums, best: u?.best || 0, rating: points + 1000 * wins + 300 * podiums };
}; // a quiz nobody has played or edited for 15 days is deleted
const COVER = 999;         // picture slot for the quiz's intro picture
const COOKIE = "blitz_uid";
const TIMES = [10, 20, 30, 60, 90, 120];
const IMG_RE = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/;
const KEEP_RE = /^\/api\/quizzes\/([\w-]+)\/image\/(\d+)(?:\?v=\d+)?$/; // "keep the picture you already have"
const ID_RE = /^[A-Za-z0-9_-]{6,40}$/;
const UID_RE = /^[A-Za-z0-9_-]{32}$/;
const MAX_BODY = 30_000_000;
const ENC = new TextEncoder();
const SSE_HEADERS = { "content-type": "text/event-stream", "cache-control": "no-store", "x-accel-buffering": "no" };

const now = () => Date.now() / 1000;
// A character a player designed: "~" and one base-36 digit per trait (public/app.js draws it).
const cleanLook = (v) => (typeof v === "string" && /^~[0-9a-z]{9}$/.test(v) ? v : null);
const token = (bytes) =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const text = (v) => (v === undefined || v === null ? "" : String(v));
const round4 = (v) => Math.round(v * 1e4) / 1e4;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
const fail = (error, status = 400) => json({ error }, status);

class UserError extends Error {}

// ---------- quizzes ----------

function cleanQuiz(body, quizId = null, old = null) {
  const title = cleanTitle(body.title).slice(0, 120).trim();   // line breaks kept, like question titles
  if (!title) throw new UserError("Give your quiz a title");
  const raw = body.questions;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 50) throw new UserError("Add at least one question");
  const questions = [];
  const images = []; // per question: null | {mime, data} | {keep: oldIndex}
  raw.forEach((q, i) => {
    const n = i + 1;
    if (!q || typeof q !== "object" || Array.isArray(q)) throw new UserError("Bad question");
    const qtitle = cleanTitle(q.title);
    if (!qtitle) throw new UserError(`Question ${n} needs a title`);
    const image = cleanImage(q.image, quizId, old, n);
    const time = TIMES.includes(q.time) ? q.time : 20;
    if (q.type === "pin") {
      if (!image) throw new UserError(`Question ${n} needs a picture to pin on`);
      questions.push({ type: "pin", title: qtitle, regions: cleanRegions(q.regions, n), penalty: PENALTIES.includes(q.penalty) ? q.penalty : 0, time, image: true });
      images.push(image);
      return;
    }
    if (OPINION.includes(q.type)) {
      const base = { type: q.type, title: qtitle, time, image: !!image, anon: q.anon === true };
      if (q.type === "poll") {
        const answers = (Array.isArray(q.answers) ? q.answers : []).map((a) => text(a).trim().slice(0, 100));
        if (answers.length < 2 || answers.length > 4 || !answers.every(Boolean)) throw new UserError(`Question ${n}: a poll needs 2 to 4 options`);
        Object.assign(base, { answers, other: q.other === true });
      } else if (q.type === "scale") {
        const mode = q.mode === "nps" ? "nps" : "likert";
        const defaults = mode === "nps" ? NPS_ENDS : LIKERT;
        const raw = Array.isArray(q.labels) ? q.labels : [];
        Object.assign(base, { mode, labels: defaults.map((def, k) => text(raw[k]).trim().slice(0, 40) || def) });
      } else if (q.type === "drop" && !image) {
        throw new UserError(`Question ${n} needs a picture to drop pins on`);
      }
      questions.push(base);
      images.push(image);
      return;
    }
    if (q.type === "tf") {
      if (q.correct !== 0 && q.correct !== 1) throw new UserError(`Question ${n}: pick True or False`);
      questions.push({ type: "tf", title: qtitle, answers: ["True", "False"], correct: q.correct, time, image: !!image });
      images.push(image);
      return;
    }
    if (q.type === "slider") {
      questions.push({ type: "slider", title: qtitle, ...cleanSlider(q, n), time, image: !!image });
      images.push(image);
      return;
    }
    if (q.type === "type") {
      const accepted = (Array.isArray(q.accepted) ? q.accepted : []).map((a) => text(a).trim().slice(0, TYPE_MAX)).filter(Boolean);
      if (!accepted.length || accepted.length > 4 || !accepted.every((a) => norm(a))) throw new UserError(`Question ${n}: write the right answer`);
      questions.push({ type: "type", title: qtitle, accepted, time, image: !!image });
      images.push(image);
      return;
    }
    if (q.type === "puzzle") {
      const items = (Array.isArray(q.answers) ? q.answers : []).map((a) => text(a).trim().slice(0, 100));
      if (items.length < 2 || items.length > 4 || !items.every(Boolean)) throw new UserError(`Question ${n}: a puzzle needs 2 to 4 items`);
      questions.push({ type: "puzzle", title: qtitle, answers: items, time, image: !!image });
      images.push(image);
      return;
    }
    if (!Array.isArray(q.answers)) throw new UserError(`Question ${n} needs answers`);
    const answers = q.answers.map((a) => text(a).trim().slice(0, 100));
    if (answers.length < 2 || answers.length > 4 || !answers.every(Boolean)) {
      throw new UserError(`Question ${n} needs 2 to 4 answers`);
    }
    const correct = q.correct;
    if (!Number.isInteger(correct) || correct < 0 || correct >= answers.length) {
      throw new UserError(`Mark the correct answer for question ${n}`);
    }
    questions.push({ type: "quiz", title: qtitle, answers, correct, time, image: !!image });
    images.push(image);
  });
  const cover = cleanCover(body.cover, quizId, old);
  return { title, questions, images, cover, isPublic: body.public === true };
}

// The quiz's intro picture: a new upload, "keep the one you have", or none.
function cleanCover(image, quizId, old) {
  if (!image) return null;
  if (typeof image === "string") {
    const m = IMG_RE.exec(image);
    if (m) return { mime: `image/${m[1]}`, data: m[2] };
    const k = KEEP_RE.exec(image);
    if (k && old && k[1] === quizId && +k[2] === COVER && old.cover) return { keep: COVER };
  }
  throw new UserError("The intro picture isn't supported");
}

function cleanImage(image, quizId, old, n) {
  if (!image) return null;
  if (typeof image === "string") {
    const m = IMG_RE.exec(image);
    if (m) return { mime: `image/${m[1]}`, data: m[2] };
    const k = KEEP_RE.exec(image);
    if (k && old && k[1] === quizId && +k[2] !== COVER && +k[2] < old.questions.length) {
      return old.questions[+k[2]].image ? { keep: +k[2] } : null;
    }
  }
  throw new UserError(`Question ${n} has an unsupported picture`);
}

// Slider questions: a range, a step, the right value, an optional unit, and how close counts.
const MARGINS = { exact: 0, low: 0.05, medium: 0.1, high: 0.2 }; // share of the range
const snap = (v, q) => Math.round((Math.round((v - q.min) / q.step) * q.step + q.min) * 1e6) / 1e6;
function cleanSlider(q, n) {
  const num = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
  const min = num(q.min), max = num(q.max), step = num(q.step), answer = num(q.answer);
  const fine = (v) => Number.isFinite(v) && Math.abs(v) <= 1e9;
  if (![min, max, step, answer].every(fine)) throw new UserError(`Question ${n}: fill in the slider numbers`);
  if (min >= max) throw new UserError(`Question ${n}: the slider's lowest value must be below its highest`);
  if (step <= 0 || (max - min) / step > 100000) throw new UserError(`Question ${n}: pick a bigger slider step`);
  if (answer < min || answer > max) throw new UserError(`Question ${n}: the right value must be inside the range`);
  const margin = Object.hasOwn(MARGINS, q.margin) ? q.margin : "medium";
  const sl = { min, max, step, margin, unit: text(q.unit).trim().slice(0, 12) };
  return { ...sl, answer: snap(answer, sl) };
}
// 1 for a spot-on guess; inside the margin, from 1 down to 0.5 at its edge; 0 outside it.
function sliderShare(q, v) {
  if (typeof v !== "number") return 0;
  const dist = Math.abs(v - q.answer);
  if (dist < 1e-9) return 1;
  const tol = MARGINS[q.margin] * (q.max - q.min);
  return tol && dist <= tol + 1e-9 ? 1 - 0.5 * (dist / tol) : 0;
}

// Type answer: players type it; case, accents, punctuation and extra spaces don't matter,
// and one slip of the keyboard is forgiven in longer answers (6+ letters, no digits).
const TYPE_MAX = 40;
const norm = (v) => String(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
function oneEdit(a, b) {   // true if a and b differ by at most one inserted, deleted or changed character
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
const typedRight = (q, v) => {
  const t = norm(v);
  return !!t && q.accepted.some((a) => { const k = norm(a); return t === k || (k.length >= 6 && !/\d/.test(k) && oneEdit(t, k)); });
};

// Puzzle: players see the items shuffled (the same shuffle for everyone in a game) and put them in order.
// perm[i] is the right position of the item shown i-th. Never shown already in order.
function puzzlePerm(seed, n) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909); return ((h >>>= 0) % 1e6) / 1e6; };
  const perm = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  return perm.every((v, i) => v === i) ? perm.map((_, i) => (i + 1) % n) : perm;
}
// What players typed, grouped (ignoring case and accents), most common first.
function typedTally(players) {
  const groups = new Map();
  for (const p of players) {
    if (typeof p.choice !== "string") continue;
    const k = norm(p.choice);
    const g = groups.get(k) || { text: p.choice, n: 0, ok: p.right };
    g.n++;
    groups.set(k, g);
  }
  return [...groups.values()].sort((a, b) => b.n - a.n || b.ok - a.ok).slice(0, 8);
}
const puzzleRight = (perm, choice) => Array.isArray(choice) && choice.length === perm.length && choice.every((d, k) => perm[d] === k);

// Target areas for a pin question: rectangles as fractions (0-1) of the picture.
function cleanRegions(regions, n) {
  if (!Array.isArray(regions) || regions.length < 1 || regions.length > 8) {
    throw new UserError(`Question ${n}: drag on the picture to mark the right area`);
  }
  return regions.map((r) => {
    const v = ["x", "y", "w", "h"].map((k) =>
      r && typeof r === "object" && r[k] !== null && r[k] !== "" && typeof r[k] !== "boolean" ? Number(r[k]) : NaN);
    const [x, y, w, h] = v;
    const ok = v.every(Number.isFinite) && x >= 0 && x <= 1 && y >= 0 && y <= 1 &&
      w > 0.005 && w <= 1.0001 - x && h > 0.005 && h <= 1.0001 - y;
    if (!ok) throw new UserError(`Question ${n} has a bad area`);
    return { x: round4(x), y: round4(y), w: round4(w), h: round4(h) };
  });
}

const isPin = (q) => q.type === "pin";

// Pin questions: a player may drop up to one pin per target area. Each area with at least one
// pin in it counts as found; finding every area is a full right answer.
const inRegion = (r, [x, y]) => r.x <= x && x <= r.x + r.w && r.y <= y && y <= r.y + r.h;
const pinsOf = (choice) => (Array.isArray(choice) && typeof choice[0] === "number" ? [choice] : choice || []);
// A pin counts for every area it sits in (so one pin where two areas overlap finds both); more pins in an
// area it already found add nothing. Pins outside every area are "stray".
const strayPins = (q, choice) => pinsOf(choice).filter((pt) => !q.regions.some((r) => inRegion(r, pt))).length;
const PENALTIES = [0, 100, 250, 500];
const areasFound = (q, choice) => q.regions.filter((r) => pinsOf(choice).some((pt) => inRegion(r, pt))).length;

function isRight(q, choice) {
  if (choice === null || choice === undefined || isOpinion(q)) return false;
  if (isPin(q)) return areasFound(q, choice) === q.regions.length;
  if (q.type === "slider") return sliderShare(q, choice) > 0;
  if (q.type === "type") return typedRight(q, choice);
  if (q.type === "puzzle") return puzzleRight(q.perm, choice);
  return choice === q.correct;
}

// ---------- collect opinions ----------
// Opinion questions have no right answer and score no points: Poll (optionally with "Other", which players
// type), Scale (agree…disagree with your own labels, or NPS 0–10), Drop pin, Word cloud, Open-ended and
// Brainstorm (ideas, then the host groups them, then everyone votes). Each can be anonymous: then the host
// sees what was said but never who said it, live or in the downloaded responses.
const OPINION = ["poll", "scale", "drop", "cloud", "open", "brain"];
const isOpinion = (q) => OPINION.includes(q.type);
const OTHER_MAX = 60, CLOUD_MAX = 25, OPEN_MAX = 250, IDEA_MAX = 75;
const IDEAS_PER = 3;   // ideas each player may add to a brainstorm
const VOTES_PER = 3;   // favourite ideas each player may vote for
const VOTE_TIME = 30;  // seconds to vote
const LIKERT = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const NPS_ENDS = ["Not likely at all", "Extremely likely"];
const ANSWER_MAX = { cloud: CLOUD_MAX, open: OPEN_MAX, brain: IDEA_MAX };
// A question title: line breaks kept (bullets, a longer question), trailing spaces and runs of blank lines tidied.
const cleanTitle = (v) => text(v).replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n")
  .replace(/\n{3,}/g, "\n\n").trim().slice(0, 300);
const oneLine = (v, max) => String(v).replace(/\s+/g, " ").trim().slice(0, max);
// Words for a cloud: the same word however it's written counts together; the commonest spelling is shown.
function tallyWords(list, limit = 60) {
  const groups = new Map();
  for (const t of list) {
    const k = norm(t);
    if (!k) continue;
    const g = groups.get(k) || { n: 0, forms: new Map() };
    g.n++;
    g.forms.set(t, (g.forms.get(t) || 0) + 1);
    groups.set(k, g);
  }
  return [...groups.values()]
    .map((g) => ({ text: [...g.forms].sort((a, b) => b[1] - a[1])[0][0], n: g.n }))
    .sort((a, b) => b.n - a.n || a.text.localeCompare(b.text)).slice(0, limit);
}

// ?v= changes on every edit, so browsers never show a stale cached picture.
const imageUrl = (id, v, i) => `/api/quizzes/${id}/image/${i}?v=${v}`;
const publicQuestions = (quiz) =>
  quiz.questions.map((q, i) => ({ ...q, image: q.image ? imageUrl(quiz.id, quiz.v, i) : null }));
const coverUrl = (quiz) => (quiz.cover ? imageUrl(quiz.id, quiz.v, COVER) : null);

async function loadQuiz(env, id) {
  if (typeof id !== "string" || !ID_RE.test(id)) return null;
  const row = await env.DB.prepare("SELECT * FROM quizzes WHERE id = ?").bind(id).first();
  return row ? { ...row, questions: JSON.parse(row.questions) } : null;
}

// The quiz, if this browser made it; otherwise an error response.
async function ownQuiz(env, id, uid) {
  const quiz = await loadQuiz(env, id);
  if (!quiz) return { error: fail("Quiz not found", 404) };
  if (quiz.owner !== uid) return { error: fail("This quiz belongs to someone else", 403) };
  return { quiz };
}

async function writeImages(env, id, questionImages, cover = null) {
  const images = new Map(questionImages.entries());
  images.set(COVER, cover); // the intro picture lives in its own slot
  // Pictures kept from the old version but moved to another position: read them before anything is overwritten.
  const moved = new Map();
  for (const [i, src] of images) {
    if (src && src.keep !== undefined && src.keep !== i && !moved.has(src.keep)) {
      moved.set(src.keep, await env.DB.prepare("SELECT mime, data FROM images WHERE quiz_id = ? AND idx = ?")
        .bind(id, src.keep).first());
    }
  }
  for (const [i, src] of images) {
    if (!src || src.keep === i) continue; // no picture, or the same picture in the same place
    const img = src.keep !== undefined ? moved.get(src.keep) : src;
    if (!img) continue;
    await env.DB.prepare("INSERT OR REPLACE INTO images (quiz_id, idx, mime, data) VALUES (?, ?, ?, ?)")
      .bind(id, i, img.mime, img.data).run();
  }
  const used = [...images].filter(([, src]) => src).map(([i]) => i);
  const keep = used.length ? ` AND idx NOT IN (${used.map(() => "?").join(",")})` : "";
  await env.DB.prepare(`DELETE FROM images WHERE quiz_id = ?${keep}`).bind(id, ...used).run();
}

async function getImage(env, id, i) {
  const row = ID_RE.test(id)
    ? await env.DB.prepare("SELECT mime, data FROM images WHERE quiz_id = ? AND idx = ?").bind(id, i).first()
    : null;
  if (!row) return fail("No picture", 404);
  const bin = atob(row.data);
  const bytes = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
  return new Response(bytes, {
    headers: {
      "content-type": row.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}

// ---------- people ----------

const upsertUser = (env, uid) =>
  env.DB.prepare("INSERT INTO users (uid, seen) VALUES (?, ?) ON CONFLICT(uid) DO UPDATE SET seen = excluded.seen")
    .bind(uid, now());

function forget(env, uid) {
  return env.DB.batch([
    env.DB.prepare("DELETE FROM images WHERE quiz_id IN (SELECT id FROM quizzes WHERE owner = ?)").bind(uid),
    env.DB.prepare("DELETE FROM quizzes WHERE owner = ?").bind(uid),
    env.DB.prepare("DELETE FROM played WHERE uid = ?").bind(uid),
    env.DB.prepare("DELETE FROM users WHERE uid = ?").bind(uid),
  ]);
}

// Quizzes nobody has played (or edited) for 15 days, unless a game of them is running right now.
async function pruneQuizzes(env) {
  const t = now();
  const idle = await env.DB.prepare(
    "SELECT id FROM quizzes WHERE MAX(updated, COALESCE(last_played, 0)) < ? " +
    "AND id NOT IN (SELECT quiz_id FROM games WHERE done = 0 AND created > ?) LIMIT 500",
  ).bind(t - QUIZ_TTL, t - GAME_TTL).all();
  for (const { id } of idle.results) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM images WHERE quiz_id = ?").bind(id),
      env.DB.prepare("DELETE FROM quizzes WHERE id = ?").bind(id),
    ]);
  }
  return idle.results.length;
}

async function prune(env) {
  const stale = await env.DB.prepare("SELECT uid FROM users WHERE seen < ? LIMIT 500").bind(now() - WEEK).all();
  for (const { uid } of stale.results) await forget(env, uid);
  await pruneQuizzes(env);
  await env.DB.prepare("DELETE FROM games WHERE created < ?").bind(now() - DAY).run();
}

async function getMe(env, uid) {
  const t = now();
  // One round trip to D1: read the last visit, the quizzes, live games and history,
  // and (only if this browser has anything) extend its 7 days.
  const [userRows, quizRows, liveRows, playedRows] = await env.DB.batch([
    env.DB.prepare("SELECT seen, name, look, games, points, wins, podiums, best FROM users WHERE uid = ?").bind(uid),
    env.DB.prepare("SELECT id, title, questions, v, cover, updated, plays, last_played, public, saves FROM quizzes WHERE owner = ?").bind(uid),
    env.DB.prepare("SELECT quiz_id FROM games WHERE owner = ? AND done = 0 AND created > ?").bind(uid, t - GAME_TTL),
    env.DB.prepare(
      "SELECT p.*, g.gid AS live_gid FROM played p " +
      "LEFT JOIN games g ON g.gid = p.gid AND g.done = 0 AND g.created > ? " +
      "WHERE p.uid = ? ORDER BY p.at DESC LIMIT 50",
    ).bind(t - GAME_TTL, uid),
  ]);
  const user = userRows.results[0];
  if (user && user.seen < t - WEEK) { // not seen for 7 days: forget them
    await forget(env, uid);
    return json({ quizzes: [], played: [], expires: null });
  }
  const live = new Set(liveRows.results.map((r) => r.quiz_id));
  const quizzes = quizRows.results.map((r) => {
    const qs = JSON.parse(r.questions);
    const first = qs.findIndex((q) => q.image); // no intro picture: use the first question's
    return {
      id: r.id, title: r.title, questions: qs.length, pins: qs.filter(isPin).length, public: !!r.public, saves: r.saves || 0,
      updated: r.updated, plays: r.plays, lastPlayed: r.last_played, live: live.has(r.id),
      cover: r.cover ? imageUrl(r.id, r.v, COVER) : first >= 0 ? imageUrl(r.id, r.v, first) : null,
      expires: Math.max(r.updated, r.last_played || 0) + QUIZ_TTL,
    };
  }).sort((a, b) => Math.max(b.updated, b.lastPlayed || 0) - Math.max(a.updated, a.lastPlayed || 0));
  const played = playedRows.results.map((e) => ({
    id: e.gid, pin: e.pin, quizTitle: e.quiz_title, name: e.name, at: e.at, score: e.score,
    rank: e.place, count: e.players, done: !!e.done, live: !!e.live_gid,
  }));
  const any = quizzes.length > 0 || played.length > 0 || (user?.games || 0) > 0;
  // Visiting the dashboard keeps everything for another 7 days. Skip the write if it was refreshed in the last hour.
  if (any && !(user && user.seen > t - 3600)) await upsertUser(env, uid).run();
  const stats = statsOf(user);
  if (stats.games) {
    const r = await env.DB.prepare(`SELECT COUNT(*) AS ahead FROM users WHERE games > 0 AND ${RATING} > ?`).bind(stats.rating).first();
    stats.rank = (r?.ahead || 0) + 1;
  }
  // The character this browser designed (it's also kept in the browser); the leaderboard shows it.
  const profile = { name: user?.name || null, look: cleanLook(user?.look) };
  return json({ quizzes, played, stats, profile, expires: any ? t + WEEK : null });
}

// The global leaderboard: the top 50 browsers by Blitz rating, plus where you stand.
async function leaderboard(env, uid) {
  const [top, mine, count] = await env.DB.batch([
    env.DB.prepare(`SELECT uid, name, look, games, points, wins, podiums, best, ${RATING} AS rating FROM users
      WHERE games > 0 ORDER BY rating DESC, wins DESC, games ASC LIMIT 50`),
    env.DB.prepare("SELECT name, look, games, points, wins, podiums, best FROM users WHERE uid = ?").bind(uid),
    env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE games > 0"),
  ]);
  const row = (r, i) => ({ rank: i + 1, name: r.name || "Player", look: r.look, ...statsOf(r), you: r.uid === uid });
  const me = mine.results[0];
  let you = null;
  if (me && me.games) {
    const st = statsOf(me);
    const r = await env.DB.prepare(`SELECT COUNT(*) AS ahead FROM users WHERE games > 0 AND ${RATING} > ?`).bind(st.rating).first();
    you = { rank: (r?.ahead || 0) + 1, name: me.name || "You", look: me.look, ...st, you: true };
  }
  return json({ players: top.results.map(row), you, total: count.results[0]?.n || 0 });
}

// ---------- API ----------

const room = (env, pin) => env.GAME.get(env.GAME.idFromName(pin));
const PIN_RE = /^\d{6}$/;

async function handleApi(request, env, url, uid) {
  const path = url.pathname;
  if (request.method === "GET") {
    if (path === "/api/info") return json({ lanUrl: null });
    if (path === "/api/me") return getMe(env, uid);
    if (path === "/api/leaderboard") return leaderboard(env, uid);
    if (path === "/api/stream") {
      const pin = text(url.searchParams.get("pin"));
      if (!PIN_RE.test(pin)) return new Response('data: {"t":"ended"}\n\n', { headers: SSE_HEADERS });
      return room(env, pin).fetch(request);
    }
    let m = path.match(/^\/api\/quizzes\/([\w-]+)\/image\/(\d+)$/);
    if (m) return getImage(env, m[1], +m[2]);
    m = path.match(/^\/api\/quizzes\/([\w-]+)$/);
    if (m) {
      const { quiz, error } = await ownQuiz(env, m[1], uid);
      if (error) return error;
      return json({ id: quiz.id, title: quiz.title, v: quiz.v, cover: coverUrl(quiz), public: !!quiz.public, questions: publicQuestions(quiz) });
    }
    if (path === "/api/public") return listPublic(env, uid, url);
    m = path.match(/^\/api\/public\/([\w-]+)$/);
    if (m) return previewPublic(env, uid, m[1]);
    return fail("Not found", 404);
  }
  if (request.method !== "POST") return fail("Not found", 404);
  if (+(request.headers.get("content-length") || 0) > MAX_BODY) return fail("That's too big — try smaller pictures", 413);
  let body;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch {
    return fail("Bad request");
  }
  try {
    if (path === "/api/quizzes") return await createQuiz(env, uid, body);
    if (path === "/api/host") return await host(env, uid, body);
    if (path === "/api/join") return await join(env, uid, body);
    if (path === "/api/me/look") {
      // A new character from the dashboard: the leaderboard shows it from now on (if this browser is on it).
      const look = cleanLook(body.look);
      if (!look) return fail("That look doesn't work", 400);
      await env.DB.prepare("UPDATE users SET look = ? WHERE uid = ?").bind(look, uid).run();
      return json({ ok: true });
    }
    if (path === "/api/act") return await act(env, body);
    const pm = path.match(/^\/api\/public\/([\w-]+)\/save$/);
    if (pm) return await savePublic(env, uid, pm[1]);
    const m = path.match(/^\/api\/quizzes\/([\w-]+)(\/delete)?$/);
    if (m) return await (m[2] ? deleteQuiz(env, uid, m[1]) : updateQuiz(env, uid, m[1], body));
  } catch (err) {
    if (err instanceof UserError) return fail(err.message);
    throw err;
  }
  return fail("Not found", 404);
}

async function createQuiz(env, uid, body) {
  const c = cleanQuiz(body);
  const id = token(8);
  const t = now();
  await writeImages(env, id, c.images, c.cover);
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO quizzes (id, owner, title, questions, v, cover, created, updated, plays, public) VALUES (?, ?, ?, ?, 1, ?, ?, ?, 0, ?)",
    ).bind(id, uid, c.title, JSON.stringify(c.questions), c.cover ? 1 : 0, t, t, c.isPublic ? 1 : 0),
    upsertUser(env, uid),
  ]);
  return json({ id });
}

async function updateQuiz(env, uid, id, body) {
  const { quiz: old, error } = await ownQuiz(env, id, uid);
  if (error) return error;
  const c = cleanQuiz(body, id, old);
  await writeImages(env, id, c.images, c.cover);
  await env.DB.batch([
    env.DB.prepare("UPDATE quizzes SET title = ?, questions = ?, cover = ?, public = ?, v = v + 1, updated = ? WHERE id = ?")
      .bind(c.title, JSON.stringify(c.questions), c.cover ? 1 : 0, c.isPublic ? 1 : 0, now(), id),
    upsertUser(env, uid),
  ]);
  return json({ id });
}

// ---------- public quizzes ----------
// A public quiz can be found by anyone on Explore, previewed (without its answers) and saved: saving makes
// a copy that belongs to whoever saved it, pictures included, so the quiz lives on even after its maker
// deletes it or their browser is forgotten. Each save also counts as activity for the original.
const typeOfQ = (q) => (["tf", "slider", "type", "puzzle", ...OPINION].includes(q.type) ? q.type : isPin(q) ? "pin" : "quiz");
const publicCard = (r, uid) => {
  const qs = JSON.parse(r.questions);
  const first = qs.findIndex((q) => q.image);
  return {
    id: r.id, title: r.title, questions: qs.length, types: [...new Set(qs.map(typeOfQ))],
    cover: r.cover ? imageUrl(r.id, r.v, COVER) : first >= 0 ? imageUrl(r.id, r.v, first) : null,
    plays: r.plays, saves: r.saves || 0, updated: r.updated, author: r.author || null, mine: r.owner === uid,
  };
};
async function listPublic(env, uid, url) {
  const q = text(url.searchParams.get("q")).trim().slice(0, 60);
  const sort = url.searchParams.get("sort") === "new" ? "q.updated DESC" : "(q.plays + 3 * q.saves) DESC, q.updated DESC";
  const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const rows = await env.DB.prepare(
    "SELECT q.id, q.owner, q.title, q.questions, q.v, q.cover, q.plays, q.saves, q.updated, u.name AS author FROM quizzes q " +
    `LEFT JOIN users u ON u.uid = q.owner WHERE q.public = 1 ${q ? "AND q.title LIKE ? ESCAPE '\\'" : ""} ORDER BY ${sort} LIMIT 60`,
  ).bind(...(q ? [like] : [])).all();
  return json({ quizzes: rows.results.map((r) => publicCard(r, uid)) });
}
async function previewPublic(env, uid, id) {
  const quiz = await loadQuiz(env, id);
  if (!quiz || !quiz.public) return fail("This quiz isn't public", 404);
  const author = await env.DB.prepare("SELECT name FROM users WHERE uid = ?").bind(quiz.owner).first();
  const card = publicCard({ ...quiz, questions: JSON.stringify(quiz.questions), author: author?.name }, uid);
  // Titles and pictures only: no answers, so players can't look them up before a game.
  return json({ ...card, questionList: quiz.questions.map((q, i) => ({ type: typeOfQ(q), title: q.title, time: q.time,
    image: q.image ? imageUrl(quiz.id, quiz.v, i) : null })) });
}
async function savePublic(env, uid, id) {
  const quiz = await loadQuiz(env, id);
  if (!quiz || !quiz.public) return fail("This quiz isn't public", 404);
  const copy = token(8);
  const t = now();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO quizzes (id, owner, title, questions, v, cover, created, updated, plays, public, source) VALUES (?, ?, ?, ?, 1, ?, ?, ?, 0, 0, ?)",
    ).bind(copy, uid, quiz.title, JSON.stringify(quiz.questions), quiz.cover ? 1 : 0, t, t, quiz.id),
    env.DB.prepare("INSERT INTO images (quiz_id, idx, mime, data) SELECT ?, idx, mime, data FROM images WHERE quiz_id = ?").bind(copy, quiz.id),
    env.DB.prepare("UPDATE quizzes SET saves = saves + 1, last_played = MAX(COALESCE(last_played, 0), ?) WHERE id = ?").bind(t, quiz.id),
    upsertUser(env, uid),
  ]);
  return json({ id: copy });
}

async function deleteQuiz(env, uid, id) {
  const { error } = await ownQuiz(env, id, uid);
  if (error) return error;
  const live = await env.DB.prepare("SELECT pin, gid FROM games WHERE quiz_id = ? AND done = 0").bind(id).all();
  for (const g of live.results) await room(env, g.pin).end(g.gid);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM images WHERE quiz_id = ?").bind(id),
    env.DB.prepare("DELETE FROM quizzes WHERE id = ?").bind(id),
    upsertUser(env, uid),
  ]);
  return json({ ok: true });
}

async function host(env, uid, body) {
  const { quiz, error } = await ownQuiz(env, body.quizId, uid);
  if (error) return error;
  const t = now();
  const running = await env.DB.prepare(
    "SELECT pin, gid, token FROM games WHERE quiz_id = ? AND owner = ? AND done = 0 AND created > ? ORDER BY created DESC LIMIT 1",
  ).bind(quiz.id, uid, t - GAME_TTL).first();
  if (body.resume) { // come back to a lobby/game you left open
    return json(running ? { pin: running.pin, token: running.token } : { pin: null });
  }
  if (running) await room(env, running.pin).end(running.gid);
  for (let tries = 0; tries < 30; tries++) {
    const pin = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    const gid = `${pin}-${Math.floor(t)}`;
    const tok = token(18);
    // Claim the PIN unless a live game is using it.
    const res = await env.DB.prepare(
      "INSERT INTO games (pin, gid, quiz_id, owner, token, created, done) VALUES (?, ?, ?, ?, ?, ?, 0) " +
      "ON CONFLICT(pin) DO UPDATE SET gid = excluded.gid, quiz_id = excluded.quiz_id, owner = excluded.owner, " +
      "token = excluded.token, created = excluded.created, done = 0 WHERE games.done = 1 OR games.created < ?",
    ).bind(pin, gid, quiz.id, uid, tok, t, t - GAME_TTL).run();
    if (!res.meta.changes) continue;
    await room(env, pin).init({
      pin, gid, token: tok, quizId: quiz.id, owner: uid, created: t,
      quiz: { title: quiz.title, cover: coverUrl(quiz), questions: publicQuestions(quiz) },
    });
    return json({ pin, token: tok });
  }
  return fail("Couldn't start a game — please try again", 503);
}

async function join(env, uid, body) {
  const pin = text(body.pin).replace(/\D/g, "");
  const game = PIN_RE.test(pin)
    ? await env.DB.prepare("SELECT gid FROM games WHERE pin = ? AND created > ?").bind(pin, now() - GAME_TTL).first()
    : null;
  if (!game) return fail("No game with that PIN", 404);
  const r = await room(env, pin).join(uid, body.name, !!body.rejoin, body.look);
  return json(r.body, r.status);
}

async function act(env, body) {
  const pin = text(body.pin);
  if (!PIN_RE.test(pin)) return fail("That game has ended", 404);
  const r = await room(env, pin).act(body);
  return json(r.body, r.status);
}

// ---------- schema (created on first use, so a fresh database just works) ----------

let schemaReady = null;
function ensureSchema(env) {
  schemaReady ??= env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, seen REAL NOT NULL, name TEXT, look TEXT, " +
      "games INTEGER NOT NULL DEFAULT 0, points INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, " +
      "podiums INTEGER NOT NULL DEFAULT 0, best INTEGER NOT NULL DEFAULT 0)"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, " +
      "questions TEXT NOT NULL, v INTEGER NOT NULL, created REAL NOT NULL, updated REAL NOT NULL, " +
      "plays INTEGER NOT NULL DEFAULT 0, last_played REAL, cover INTEGER NOT NULL DEFAULT 0)",
    ),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_quizzes_owner ON quizzes(owner)"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS images (quiz_id TEXT NOT NULL, idx INTEGER NOT NULL, mime TEXT NOT NULL, " +
      "data TEXT NOT NULL, PRIMARY KEY (quiz_id, idx))",
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS played (uid TEXT NOT NULL, gid TEXT NOT NULL, pin TEXT NOT NULL, " +
      "quiz_title TEXT NOT NULL, name TEXT NOT NULL, at REAL NOT NULL, score INTEGER NOT NULL DEFAULT 0, " +
      "place INTEGER, players INTEGER, done INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (uid, gid))",
    ),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS games (pin TEXT PRIMARY KEY, gid TEXT NOT NULL, quiz_id TEXT NOT NULL, " +
      "owner TEXT NOT NULL, token TEXT NOT NULL, created REAL NOT NULL, done INTEGER NOT NULL DEFAULT 0)",
    ),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_games_quiz ON games(quiz_id, owner)"),
  ])
    // Databases made before intro pictures existed get the column added; "duplicate column" means it's already there.
    .then(() => env.DB.prepare("ALTER TABLE quizzes ADD COLUMN cover INTEGER NOT NULL DEFAULT 0").run().catch(() => {}))
    // Public quizzes: whether it's public, how often it was saved, and which public quiz a copy came from.
    .then(() => Promise.all([["public", "INTEGER NOT NULL DEFAULT 0"], ["saves", "INTEGER NOT NULL DEFAULT 0"], ["source", "TEXT"]]
      .map(([c, type]) => env.DB.prepare(`ALTER TABLE quizzes ADD COLUMN ${c} ${type}`).run().catch(() => {}))))
    .then(() => env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_quizzes_public ON quizzes(public, plays)").run().catch(() => {}))
    // Lifetime stats columns for databases made before the leaderboard existed ("duplicate column" = already there).
    .then(() => Promise.all([["name", "TEXT"], ["look", "TEXT"], ["games", "INTEGER NOT NULL DEFAULT 0"], ["points", "INTEGER NOT NULL DEFAULT 0"],
      ["wins", "INTEGER NOT NULL DEFAULT 0"], ["podiums", "INTEGER NOT NULL DEFAULT 0"], ["best", "INTEGER NOT NULL DEFAULT 0"]]
      .map(([c, type]) => env.DB.prepare(`ALTER TABLE users ADD COLUMN ${c} ${type}`).run().catch(() => {}))))
    .catch((err) => {
      schemaReady = null; // retry on the next request
      throw err;
    });
  return schemaReady;
}

function identify(request) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [k, ...rest] = part.trim().split("=");
    const v = rest.join("=");
    if (k === COOKIE && UID_RE.test(v)) return { uid: v, known: true };
  }
  return { uid: token(24), known: false };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const { uid, known } = identify(request);
    let res;
    try {
      await ensureSchema(env);
      if (known) { // any visit keeps your stuff for 7 more days (written at most once an hour)
        const t = now();
        ctx.waitUntil(env.DB.prepare("UPDATE users SET seen = ? WHERE uid = ? AND seen < ? AND seen > ?")
          .bind(t, uid, t - 3600, t - WEEK).run().catch(() => {}));
      }
      res = await handleApi(request, env, url, uid);
    } catch (err) {
      console.error(err);
      res = fail("Something went wrong — please try again", 500);
    }
    if (/^\/api\/quizzes\/[\w-]+\/image\/\d+$/.test(url.pathname)) return res; // shared, cacheable: no cookie
    res = new Response(res.body, res);
    const secure = url.protocol === "https:" ? "; Secure" : "";
    res.headers.append("set-cookie", `${COOKIE}=${uid}; Max-Age=${WEEK}; Path=/; HttpOnly; SameSite=Lax${secure}`);
    return res;
  },

  async scheduled(event, env) {
    await ensureSchema(env);
    await prune(env);
  },
};

// ---------- live games: one Durable Object per PIN ----------

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.s = null;          // the game; persisted, so it survives the object being evicted
    this.subs = new Set();  // open event streams: {pid (null = host), writer}
    this.ping = null;
    this.v = Date.now();     // state version: screens ignore anything older than what they have
    this.log = [];          // per question: every reply, kept for the host's responses download
    ctx.blockConcurrencyWhile(async () => {
      this.s = (await ctx.storage.get("s")) ?? null;
      // Kept apart from the game (one entry per question), so long answers never crowd its storage.
      for (const [k, v] of await ctx.storage.list({ prefix: "log:" })) this.log[+k.slice(4)] = v;
    });
  }

  // State changes happen synchronously first; then we persist (and set the next wake-up).
  async persist() {
    const s = this.s;
    if (!s) return;
    await this.ctx.storage.put("s", s);
    const wake = s.phase === "question" || s.phase === "vote"
      ? s.started + this.limit() + 400
      : (s.created + GAME_TTL) * 1000;
    await this.ctx.storage.setAlarm(wake);
  }

  // How long the timed part of this screen lasts: the question's time, or the brainstorm vote.
  limit() {
    const s = this.s;
    return s.phase === "vote" ? VOTE_TIME * 1000 : s.quiz.questions[s.q].time * 1000;
  }

  async init(d) {
    if (this.s && this.s.gid !== d.gid) this.closeAll();
    this.log = [];
    const old = await this.ctx.storage.list({ prefix: "log:" });
    if (old.size) await this.ctx.storage.delete([...old.keys()]);
    this.s = { ...d, players: {}, phase: "lobby", q: -1, started: 0 };
    await this.persist();
    return true;
  }

  async alarm() {
    const s = this.s;
    if (!s) return;
    if (s.phase === "question" && Date.now() >= s.started + this.limit()) {
      return s.quiz.questions[s.q].type === "brain" ? this.toIdeas() : this.reveal();
    }
    if (s.phase === "vote" && Date.now() >= s.started + this.limit()) return this.reveal();
    if (Date.now() >= (s.created + GAME_TTL) * 1000) return this.end(s.gid);
    return this.persist(); // woke early: just re-arm
  }

  async join(uid, rawName, rejoin, rawLook) {
    const s = this.s;
    if (!s) return { status: 404, body: { error: "No game with that PIN" } };
    const mine = Object.keys(s.players).find((pid) => s.players[pid].uid === uid);
    if (rejoin) return { status: 200, body: mine ? { pin: s.pin, player: mine } : { player: null } };
    if (mine) return { status: 200, body: { pin: s.pin, player: mine } };
    if (s.phase === "final") return { status: 409, body: { error: "That game is already over" } };
    const name = text(rawName).split(/\s+/).filter(Boolean).join(" ").slice(0, 16);
    if (!name) return { status: 400, body: { error: "Pick a nickname" } };
    if (Object.values(s.players).some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return { status: 409, body: { error: "That nickname is taken" } };
    }
    if (Object.keys(s.players).length >= 200) return { status: 409, body: { error: "This game is full" } };
    const pid = token(12);
    // The character the player designed, or a random one picked once here so every screen shows the same one.
    const look = cleanLook(rawLook) || token(6);
    s.players[pid] = { uid, name, look, score: 0, choice: null, ms: 0, gained: 0, right: false };
    this.push();
    await this.persist();
    const t = now();
    await this.env.DB.batch([
      upsertUser(this.env, uid),
      this.env.DB.prepare(
        "INSERT OR REPLACE INTO played (uid, gid, pin, quiz_title, name, at, score, done) VALUES (?, ?, ?, ?, ?, ?, 0, 0)",
      ).bind(uid, s.gid, s.pin, s.quiz.title, name, t),
    ]);
    return { status: 200, body: { pin: s.pin, player: pid } };
  }

  async act(body) {
    const s = this.s;
    if (!s) return { status: 404, body: { error: "That game has ended" } };
    if (body.action === "look") {
      // A player changing their character (in the lobby, while waiting).
      const pid = text(body.player);
      if (!Object.hasOwn(s.players, pid)) return { status: 403, body: { error: "You're not in this game" } };
      const look = cleanLook(body.look);
      if (!look) return { status: 400, body: { error: "That look doesn't work" } };
      if (s.phase !== "final") { s.players[pid].look = look; this.push(); await this.persist(); }
      return { status: 200, body: { ok: true, state: this.state(pid) } };
    }
    if (body.action === "answer" || body.action === "draft") {
      const pid = text(body.player);
      if (!Object.hasOwn(s.players, pid)) return { status: 403, body: { error: "You're not in this game" } };
      await (body.action === "answer" ? this.answer(s.players[pid], body.choice) : this.draft(s.players[pid], body.choice));
      // The player's screen as it is now, so it can move on without waiting for the stream.
      return { status: 200, body: { ok: true, state: this.s ? this.state(pid) : null } };
    } else if (body.action === "group") {
      // Brainstorm: the host drops one idea onto another to group them.
      if (body.token !== s.token) return { status: 403, body: { error: "Only the host can do that" } };
      await this.group(body.a, body.b);
      return { status: 200, body: { ok: true, state: this.state(null) } };
    } else if (body.action === "next" || body.action === "end") {
      if (body.token !== s.token) return { status: 403, body: { error: "Only the host can do that" } };
      if (body.action === "end") await this.end(s.gid);
      // "Next" names the screen the host pressed it on. If the game has already moved on (time ran out
      // or everyone answered just before Skip, or a double tap), it does nothing, so the results are never skipped.
      else if (body.from === undefined || (body.from === s.phase && (body.q === undefined || body.q === s.q))) await this.advance();
      return { status: 200, body: { ok: true, state: this.s ? this.state(null) : null } };
    } else {
      return { status: 400, body: { error: "Unknown action" } };
    }
  }

  // -- state machine --
  async advance() {
    const s = this.s;
    if (s.phase === "lobby") {
      if (Object.keys(s.players).length) await this.ask(0);
    } else if (s.phase === "question") {
      await (s.quiz.questions[s.q].type === "brain" ? this.toIdeas() : this.reveal());
    } else if (s.phase === "ideas") {
      await this.startVote();
    } else if (s.phase === "vote") {
      await this.reveal();
    } else if (s.phase === "reveal") {
      if (s.q + 1 < s.quiz.questions.length) {
        await this.ask(s.q + 1);
      } else {
        s.phase = "final";
        this.push();
        await this.persist();
        await this.record();
      }
    }
  }

  async ask(i) {
    const s = this.s;
    Object.assign(s, { q: i, phase: "question", started: Date.now(), ideas: null });
    for (const p of Object.values(s.players)) Object.assign(p, { choice: null, draft: null, auto: false, ms: 0, gained: 0, right: false, found: 0, stray: 0, vote: null });
    this.push();
    await this.persist();
  }

  // Check a reply against the current question; returns it cleaned up, or undefined if it isn't valid.
  cleanChoice(q, choice) {
    if (q.type === "poll") {
      if (typeof choice === "string") return q.other ? oneLine(choice, OTHER_MAX) || undefined : undefined;   // "Other: …"
      return Number.isInteger(choice) && choice >= 0 && choice < q.answers.length ? choice : undefined;
    }
    if (q.type === "scale") return Number.isInteger(choice) && choice >= 0 && choice < (q.mode === "nps" ? 11 : 5) ? choice : undefined;
    if (q.type === "drop") {
      const c = choice;
      if (!c || typeof c.x !== "number" || typeof c.y !== "number" || c.x < 0 || c.x > 1 || c.y < 0 || c.y > 1) return;
      return [round4(c.x), round4(c.y)];
    }
    if (ANSWER_MAX[q.type]) return typeof choice === "string" ? oneLine(choice, ANSWER_MAX[q.type]) || undefined : undefined;
    if (isPin(q)) {
      // One pin ({x, y}) or several ([{x, y}, …]), at most one per target area.
      const list = Array.isArray(choice) ? choice : [choice];
      const ok = (c) => c && typeof c === "object" && typeof c.x === "number" && typeof c.y === "number" &&
        c.x >= 0 && c.x <= 1 && c.y >= 0 && c.y <= 1;
      if (!list.length || list.length > q.regions.length || !list.every(ok)) return;
      return list.map((c) => [round4(c.x), round4(c.y)]);
    } else if (q.type === "slider") {
      if (typeof choice !== "number" || !Number.isFinite(choice) || choice < q.min || choice > q.max) return;
      return snap(choice, q);
    } else if (q.type === "type") {
      if (typeof choice !== "string") return;
      choice = choice.replace(/\s+/g, " ").trim().slice(0, TYPE_MAX);
      return choice || undefined;
    } else if (q.type === "puzzle") {
      // The order the player put the shown items in: each shown index exactly once.
      const n = q.answers.length;
      if (!Array.isArray(choice) || choice.length !== n || new Set(choice).size !== n ||
        !choice.every((d) => Number.isInteger(d) && d >= 0 && d < n)) return;
      return choice;
    } else if (!Number.isInteger(choice) || choice < 0 || choice >= q.answers.length) {
      return;
    }
    return choice;
  }

  async answer(p, raw) {
    const s = this.s;
    if (s.phase === "vote") return this.vote(p, raw);
    if (s.phase !== "question") return;
    if (s.quiz.questions[s.q].type === "brain") {
      // Brainstorm: each idea is added on its own, up to IDEAS_PER (the same idea twice counts once).
      const idea = this.cleanChoice(s.quiz.questions[s.q], raw);
      const list = p.choice || [];
      if (idea === undefined || list.length >= IDEAS_PER || list.some((x) => norm(x) === norm(idea))) return;
      p.choice = [...list, idea];
      this.push();
      return this.persist();
    }
    if (p.choice !== null) return;
    const choice = this.cleanChoice(s.quiz.questions[s.q], raw);
    if (choice === undefined) return;
    p.choice = choice;
    p.ms = Date.now() - s.started;
    p.draft = null;
    if (Object.values(s.players).every((x) => x.choice !== null)) return this.reveal();
    this.push();
    await this.persist();
  }

  // Pins placed or an order set but not locked in yet. When time runs out it counts as the answer
  // (at the slowest speed); locking in earlier is what earns the speed bonus. An empty draft clears it.
  async draft(p, raw) {
    const s = this.s;
    if (s.phase !== "question" || p.choice !== null) return;
    const q = s.quiz.questions[s.q];
    if (!isPin(q) && q.type !== "puzzle" && q.type !== "drop") return;
    p.draft = Array.isArray(raw) && !raw.length ? null : this.cleanChoice(q, raw) ?? p.draft ?? null;
    await this.persist();
  }

  // Brainstorm, step 2: every idea on the host's screen, the same idea from different people as one.
  async toIdeas() {
    const s = this.s;
    const byKey = new Map();
    for (const p of Object.values(s.players)) {
      for (const t of p.choice || []) {
        const k = norm(t) || t;
        const g = byKey.get(k) || { id: byKey.size, text: t, n: 0, members: [] };
        g.n++;
        if (!g.members.includes(t)) g.members.push(t);
        byKey.set(k, g);
      }
    }
    s.ideas = [...byKey.values()];
    s.phase = "ideas";
    this.push();
    await this.persist();
  }

  // The host groups idea b into idea a (it keeps a's wording; b's count and wordings join it).
  async group(a, b) {
    const s = this.s;
    if (s.phase !== "ideas" || !Array.isArray(s.ideas) || a === b) return;
    const A = s.ideas.find((x) => x.id === a), B = s.ideas.find((x) => x.id === b);
    if (!A || !B) return;
    A.n += B.n;
    A.members = [...new Set([...A.members, ...B.members])];
    s.ideas = s.ideas.filter((x) => x !== B);
    this.push();
    await this.persist();
  }

  // Brainstorm, step 3: everyone votes for up to VOTES_PER favourites. With fewer than 2 ideas there's nothing to vote on.
  async startVote() {
    const s = this.s;
    if (!s.ideas || s.ideas.length < 2) return this.reveal();
    Object.assign(s, { phase: "vote", started: Date.now() });
    for (const p of Object.values(s.players)) p.vote = null;
    this.push();
    await this.persist();
  }

  async vote(p, raw) {
    const s = this.s;
    const ids = new Set(s.ideas.map((x) => x.id));
    const list = Array.isArray(raw) ? [...new Set(raw)] : [];
    if (p.vote || !list.length || list.length > VOTES_PER || !list.every((id) => ids.has(id))) return;
    p.vote = list;
    if (Object.values(s.players).every((x) => x.vote)) return this.reveal();
    this.push();
    await this.persist();
  }

  async reveal() {
    const s = this.s;
    const q = s.quiz.questions[s.q];
    if (isOpinion(q)) return this.revealOpinion(q);
    const qq = this.withPerm(q);
    for (const p of Object.values(s.players)) {
      if (p.choice === null && p.draft) { p.choice = p.draft; p.ms = q.time * 1000; p.auto = true; }  // didn't lock in: the draft counts
      p.draft = null;
      p.right = isRight(qq, p.choice);
      // Pin questions give credit for each area found; quiz questions are all or nothing.
      const share = isPin(q) ? (p.choice === null ? 0 : areasFound(q, p.choice) / q.regions.length)
        : q.type === "slider" ? sliderShare(q, p.choice) : p.right ? 1 : 0;
      if (isPin(q)) {
        p.found = p.choice === null ? 0 : areasFound(q, p.choice);
        p.stray = strayPins(q, p.choice);   // pins outside every area
      }
      // Right answers earn 500-1000: the faster, the closer to 1000. Partly right pins earn their share of that.
      const frac = Math.min(1, p.ms / (q.time * 1000));
      p.gained = share > 0 ? Math.round(1000 * (1 - frac / 2) * share) : 0;
      // The host can make stray pins cost points (never taking a total below zero).
      if (isPin(q) && q.penalty && p.stray) p.gained -= q.penalty * p.stray;
      if (p.gained < 0) p.gained = Math.max(p.gained, -p.score);
      p.score += p.gained;
    }
    s.phase = "reveal";
    this.push();
    await this.keepLog();
    await this.persist();
  }

  async revealOpinion(q) {
    const s = this.s;
    for (const p of Object.values(s.players)) {
      if (p.choice === null && p.draft) { p.choice = p.draft; p.auto = true; }   // a dropped pin that wasn't locked in still counts
      Object.assign(p, { gained: 0, right: false, draft: null });
    }
    if (q.type === "brain" && s.ideas) {
      for (const idea of s.ideas) idea.votes = Object.values(s.players).filter((p) => p.vote?.includes(idea.id)).length;
    }
    s.phase = "reveal";
    this.push();
    await this.keepLog();
    await this.persist();
  }

  // Every reply to this question, for the host's responses download (no names on anonymous questions).
  async keepLog() {
    const s = this.s;
    const q = s.quiz.questions[s.q];
    const anon = isOpinion(q) && q.anon;
    const entry = {
      question: this.question(), anon,
      ...(q.type === "brain" ? { ideas: (s.ideas || []).map(({ text, n, members, votes }) => ({ text, n, members, votes: votes || 0 })) } : {}),
      rows: Object.values(s.players).map((p) => ({
        name: anon ? null : p.name, choice: p.choice, gained: p.gained, ok: p.right, found: p.found || 0, stray: p.stray || 0,
        ...(q.type === "brain" && p.vote ? { vote: p.vote.map((id) => s.ideas.find((x) => x.id === id)?.text).filter(Boolean) } : {}),
      })),
    };
    if (q.type === "slider") entry.question.answer = q.answer;
    else if (q.type === "type") entry.question.accepted = q.accepted;
    else if (q.type === "puzzle") entry.question.solution = q.answers;
    else if (q.type === "quiz" || q.type === "tf") entry.question.correct = q.correct;
    if (anon) entry.rows.sort(() => 0.5 - Math.random());   // anonymous: not even in joining order
    this.log[s.q] = entry;
    await this.ctx.storage.put(`log:${s.q}`, entry);
  }

  // What the room said, added up (players see the totals; the host also sees the words and, if named, the names).
  opinion(q, host) {
    const s = this.s;
    const got = Object.values(s.players).filter((p) => p.choice !== null && p.choice !== undefined);
    const who = (p) => (q.anon ? {} : { name: p.name, look: p.look });
    const r = { total: got.length };
    if (q.type === "poll") {
      r.counts = q.answers.map((_, i) => got.filter((p) => p.choice === i).length);
      const others = got.filter((p) => typeof p.choice === "string");
      r.otherCount = others.length;
      if (host) r.others = others.map((p) => ({ text: p.choice, ...who(p) }));
    } else if (q.type === "scale") {
      r.counts = Array.from({ length: q.mode === "nps" ? 11 : 5 }, (_, k) => got.filter((p) => p.choice === k).length);
      const base = q.mode === "nps" ? 0 : 1;   // agree/disagree points are numbered 1–5
      r.avg = got.length ? Math.round((got.reduce((a, p) => a + p.choice + base, 0) / got.length) * 10) / 10 : null;
      if (q.mode === "nps" && got.length) {
        const pro = got.filter((p) => p.choice >= 9).length, det = got.filter((p) => p.choice <= 6).length;
        Object.assign(r, { nps: Math.round(((pro - det) / got.length) * 100), promoters: pro, passives: got.length - pro - det, detractors: det });
      }
    } else if (q.type === "cloud") {
      r.words = tallyWords(got.map((p) => p.choice));
    } else if (q.type === "drop") {
      if (host) r.pins = got.map((p) => ({ x: p.choice[0], y: p.choice[1], ...who(p) }));
    } else if (q.type === "open") {
      if (host) r.answers = got.map((p) => ({ text: p.choice, ...who(p) }));
      if (q.anon && host) r.answers.sort(() => 0.5 - Math.random());
    } else if (q.type === "brain") {
      r.ideas = (s.ideas || []).map(({ id, text, n, members, votes }) => ({ id, text, n, members, votes: votes || 0 }))
        .sort((a, b) => b.votes - a.votes || b.n - a.n);
    }
    return r;
  }

  // Game over: note it on the quiz and in every player's history.
  async record() {
    const s = this.s;
    const board = this.board();
    const db = this.env.DB;
    await db.batch([
      db.prepare("UPDATE quizzes SET plays = plays + 1, last_played = ? WHERE id = ?").bind(now(), s.quizId),
      db.prepare("UPDATE games SET done = 1 WHERE gid = ?").bind(s.gid),
      ...board.map((row, i) =>
        db.prepare("UPDATE played SET score = ?, place = ?, players = ?, done = 1 WHERE uid = ? AND gid = ?")
          .bind(row.score, i + 1, board.length, s.players[row.id].uid, s.gid)),
      // Lifetime stats (games with at least 2 players only): name and look from this game, totals added up.
      // (Forms, with only opinion questions, have no scores, so they don't count either.)
      ...(board.length < RATED_MIN_PLAYERS || s.quiz.questions.every(isOpinion) ? [] : board.map((row, i) =>
        db.prepare("UPDATE users SET name = ?, look = ?, games = games + 1, points = points + ?, wins = wins + ?, " +
          "podiums = podiums + ?, best = MAX(best, ?) WHERE uid = ?")
          .bind(row.name, row.look || null, row.score, i === 0 ? 1 : 0, i === 1 || i === 2 ? 1 : 0, row.score, s.players[row.id].uid))),
    ]);
  }

  async end(gid) {
    if (!this.s || this.s.gid !== gid) return;
    this.closeAll();
    this.s = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    await this.env.DB.prepare("UPDATE games SET done = 1 WHERE gid = ?").bind(gid).run();
  }

  // -- snapshots (same shape as server.py) --
  board() {
    return Object.entries(this.s.players)
      .map(([id, p]) => ({ id, name: p.name, look: p.look, score: p.score, gained: p.gained }))
      .sort((a, b) => b.score - a.score);
  }

  // A puzzle question with this game's shuffle attached (the same for every player).
  withPerm(q) {
    return q.type === "puzzle" ? { ...q, perm: puzzlePerm(`${this.s.gid}:${this.s.q}`, q.answers.length) } : q;
  }

  question() {
    const q = this.withPerm(this.s.quiz.questions[this.s.q]);
    // Puzzle items go out shuffled: shown[i] = answers[perm[i]].
    const answers = q.type === "puzzle" ? q.perm.map((k) => q.answers[k]) : q.type === "type" || (isOpinion(q) && q.type !== "poll") ? [] : q.answers || [];
    return { type: typeOfQ(q), title: q.title, answers, time: q.time, image: q.image,
      ...(isOpinion(q) ? { opinion: true, anon: !!q.anon } : {}),
      ...(q.type === "poll" ? { other: !!q.other } : {}),
      ...(q.type === "scale" ? { mode: q.mode, labels: q.labels } : {}),
      ...(q.type === "brain" ? { ideasMax: IDEAS_PER, votesMax: VOTES_PER, voteTime: VOTE_TIME } : {}),
      ...(isPin(q) ? { maxPins: q.regions.length, penalty: q.penalty || 0 } : {}),  // how many pins a player may drop (one per area)
      ...(q.type === "slider" ? { min: q.min, max: q.max, step: q.step, unit: q.unit } : {}) };
  }

  state(pid) {
    const s = this.s;
    const board = this.board();
    const st = {
      t: "state", v: this.v, now: Date.now(), phase: s.phase, pin: s.pin, quizTitle: s.quiz.title, cover: s.quiz.cover || null,
      qIndex: s.q, total: s.quiz.questions.length, count: board.length,
      form: s.quiz.questions.every(isOpinion),   // only opinion questions: a form, so no scores or podium
    };
    // The next question's picture, so screens can fetch it before it's needed.
    const upcoming = s.phase === "lobby" ? 0 : s.phase === "reveal" ? s.q + 1 : -1;
    if (upcoming >= 0 && s.quiz.questions[upcoming]?.image) st.preload = s.quiz.questions[upcoming].image;
    const live = ["question", "reveal", "ideas", "vote"].includes(s.phase);
    const q = live ? s.quiz.questions[s.q] : null;
    if (live) {
      st.question = this.question();
      const limit = s.phase === "vote" ? VOTE_TIME * 1000 : q.time * 1000;
      st.remaining = Math.max(0, Math.floor(limit - (Date.now() - s.started)));
      st.endsAt = s.started + limit;   // server clock; screens line their countdown up with "now"
      if (s.phase === "ideas" || s.phase === "vote") st.ideas = s.ideas.map(({ id, text, n, members }) => ({ id, text, n, members }));
      if (s.phase === "reveal" && isOpinion(q)) st.results = this.opinion(q, pid === null);
      else if (s.phase === "reveal") {
        if (isPin(q)) st.regions = q.regions;
        else if (q.type === "slider") Object.assign(st, { correct: q.answer, tolerance: MARGINS[q.margin] * (q.max - q.min) });
        else if (q.type === "type") st.accepted = q.accepted;
        else if (q.type === "puzzle") st.solution = q.answers;   // the right order
        else st.correct = q.correct;
      }
    }
    const players = Object.values(s.players);
    if (pid === null) {
      st.role = "host";
      st.players = board.map(({ name, score, gained, look }) => ({ name, score, gained, look }));
      if (s.phase === "final") st.responses = this.log.filter(Boolean);
      if (live) {
        st.answered = s.phase === "vote" ? players.filter((p) => p.vote).length : players.filter((p) => p.choice !== null).length;
        if (s.phase === "reveal" && isOpinion(q)) {
          // Who said what, only when the question isn't anonymous.
          if (!q.anon) st.replies = players.map((p) => ({ name: p.name, look: p.look, choice: p.choice }))
            .sort((a, b) => (a.choice === null) - (b.choice === null) || a.name.localeCompare(b.name));
        } else if (s.phase === "reveal") {
          if (isPin(q)) {
            st.pins = players.filter((p) => p.choice !== null)
              .flatMap((p) => pinsOf(p.choice).map((pt) => ({ x: pt[0], y: pt[1], ok: q.regions.some((r) => inRegion(r, pt)), name: p.name })));
            st.hits = players.filter((p) => p.right).length;
          } else if (q.type === "slider") {
            st.guesses = players.filter((p) => p.choice !== null).map((p) => ({ name: p.name, v: p.choice, ok: p.right }));
            st.hits = players.filter((p) => p.right).length;
          } else if (q.type === "type") {
            st.typed = typedTally(players);
            st.hits = players.filter((p) => p.right).length;
          } else if (q.type === "puzzle") {
            st.hits = players.filter((p) => p.right).length;
          } else {
            st.counts = st.question.answers.map((_, i) => players.filter((p) => p.choice === i).length);
          }
          // Who answered what (every type): the host can show each player's reply, best first.
          st.replies = players
            .map((p) => ({ name: p.name, look: p.look, choice: p.choice, ok: p.right, gained: p.gained, found: p.found || 0, stray: p.stray || 0, auto: !!p.auto }))
            .sort((a, b) => b.gained - a.gained || (a.choice === null) - (b.choice === null) || a.name.localeCompare(b.name));
        }
      }
    } else {
      const p = s.players[pid];
      Object.assign(st, {
        role: "player", name: p.name, look: p.look, score: p.score, gained: p.gained, choice: p.choice, right: p.right, found: p.found || 0,
        stray: p.stray || 0, auto: !!p.auto, draft: p.draft ?? null, vote: p.vote ?? null,
        rank: board.findIndex((r) => r.id === pid) + 1,
      });
    }
    return st;
  }

  // -- live updates over server-sent events --
  fetch(request) {
    const url = new URL(request.url);
    const pid = url.searchParams.get("player");
    const tok = url.searchParams.get("token");
    const { readable, writable } = new TransformStream();
    const sub = { pid: pid || null, writer: writable.getWriter() };
    const s = this.s;
    const ok = s && (pid ? Object.hasOwn(s.players, pid) : !!tok && tok === s.token);
    if (ok) {
      this.subs.add(sub);
      this.send(sub, this.state(sub.pid));
      this.startPing();
    } else {
      this.send(sub, { t: "ended" });
      sub.writer.close().catch(() => {});
    }
    return new Response(readable, { headers: SSE_HEADERS });
  }

  send(sub, msg) {
    const chunk = typeof msg === "string" ? msg : `data: ${JSON.stringify(msg)}\n\n`;
    sub.writer.write(ENC.encode(chunk)).catch(() => this.subs.delete(sub)); // a closed tab: stop sending to it
  }

  push() {
    this.v = Math.max((this.v || 0) + 1, Date.now());
    for (const sub of this.subs) this.send(sub, this.state(sub.pid));
  }

  startPing() {
    this.ping ??= setInterval(() => {
      if (!this.subs.size) {
        clearInterval(this.ping);
        this.ping = null;
        return;
      }
      const tick = { t: "tick", now: Date.now() };
      for (const sub of this.subs) this.send(sub, tick);
    }, 10000);
  }

  closeAll() {
    for (const sub of this.subs) {
      this.send(sub, { t: "ended" });
      sub.writer.close().catch(() => {});
    }
    this.subs.clear();
  }
}
