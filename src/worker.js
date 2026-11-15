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
const QUIZ_TTL = 15 * DAY; // a quiz nobody has played or edited for 15 days is deleted
const COVER = 999;         // picture slot for the quiz's intro picture
const COOKIE = "blitz_uid";
const TIMES = [10, 20, 30, 60];
const IMG_RE = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/;
const KEEP_RE = /^\/api\/quizzes\/([\w-]+)\/image\/(\d+)(?:\?v=\d+)?$/; // "keep the picture you already have"
const ID_RE = /^[A-Za-z0-9_-]{6,40}$/;
const UID_RE = /^[A-Za-z0-9_-]{32}$/;
const MAX_BODY = 30_000_000;
const ENC = new TextEncoder();
const SSE_HEADERS = { "content-type": "text/event-stream", "cache-control": "no-store", "x-accel-buffering": "no" };

const now = () => Date.now() / 1000;
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
  const title = text(body.title).trim().slice(0, 120);
  if (!title) throw new UserError("Give your quiz a title");
  const raw = body.questions;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 50) throw new UserError("Add at least one question");
  const questions = [];
  const images = []; // per question: null | {mime, data} | {keep: oldIndex}
  raw.forEach((q, i) => {
    const n = i + 1;
    if (!q || typeof q !== "object" || Array.isArray(q)) throw new UserError("Bad question");
    const qtitle = text(q.title).trim().slice(0, 200);
    if (!qtitle) throw new UserError(`Question ${n} needs a title`);
    const image = cleanImage(q.image, quizId, old, n);
    const time = TIMES.includes(q.time) ? q.time : 20;
    if (q.type === "pin") {
      if (!image) throw new UserError(`Question ${n} needs a picture to pin on`);
      questions.push({ type: "pin", title: qtitle, regions: cleanRegions(q.regions, n), time, image: true });
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
  return { title, questions, images, cover };
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

function isRight(q, choice) {
  if (choice === null || choice === undefined) return false;
  if (isPin(q)) {
    const [x, y] = choice;
    return q.regions.some((r) => r.x <= x && x <= r.x + r.w && r.y <= y && y <= r.y + r.h);
  }
  return choice === q.correct;
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
    env.DB.prepare("SELECT seen FROM users WHERE uid = ?").bind(uid),
    env.DB.prepare("SELECT id, title, questions, v, cover, updated, plays, last_played FROM quizzes WHERE owner = ?").bind(uid),
    env.DB.prepare("SELECT quiz_id FROM games WHERE owner = ? AND done = 0 AND created > ?").bind(uid, t - GAME_TTL),
    env.DB.prepare(
      "SELECT p.*, g.gid AS live_gid FROM played p " +
      "LEFT JOIN games g ON g.gid = p.gid AND g.done = 0 AND g.created > ? " +
      "WHERE p.uid = ? AND p.at > ? ORDER BY p.at DESC LIMIT 30",
    ).bind(t - GAME_TTL, uid, t - WEEK),
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
      id: r.id, title: r.title, questions: qs.length, pins: qs.filter(isPin).length,
      updated: r.updated, plays: r.plays, lastPlayed: r.last_played, live: live.has(r.id),
      cover: r.cover ? imageUrl(r.id, r.v, COVER) : first >= 0 ? imageUrl(r.id, r.v, first) : null,
      expires: Math.max(r.updated, r.last_played || 0) + QUIZ_TTL,
    };
  }).sort((a, b) => Math.max(b.updated, b.lastPlayed || 0) - Math.max(a.updated, a.lastPlayed || 0));
  const played = playedRows.results.map((e) => ({
    id: e.gid, pin: e.pin, quizTitle: e.quiz_title, name: e.name, at: e.at, score: e.score,
    rank: e.place, count: e.players, done: !!e.done, live: !!e.live_gid,
  }));
  const any = quizzes.length > 0 || played.length > 0;
  // Visiting the dashboard keeps everything for another 7 days. Skip the write if it was refreshed in the last hour.
  if (any && !(user && user.seen > t - 3600)) await upsertUser(env, uid).run();
  return json({ quizzes, played, expires: any ? t + WEEK : null });
}

// ---------- API ----------

const room = (env, pin) => env.GAME.get(env.GAME.idFromName(pin));
const PIN_RE = /^\d{6}$/;

async function handleApi(request, env, url, uid) {
  const path = url.pathname;
  if (request.method === "GET") {
    if (path === "/api/info") return json({ lanUrl: null });
    if (path === "/api/me") return getMe(env, uid);
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
      return json({ id: quiz.id, title: quiz.title, v: quiz.v, cover: coverUrl(quiz), questions: publicQuestions(quiz) });
    }
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
    if (path === "/api/act") return await act(env, body);
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
      "INSERT INTO quizzes (id, owner, title, questions, v, cover, created, updated, plays) VALUES (?, ?, ?, ?, 1, ?, ?, ?, 0)",
    ).bind(id, uid, c.title, JSON.stringify(c.questions), c.cover ? 1 : 0, t, t),
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
    env.DB.prepare("UPDATE quizzes SET title = ?, questions = ?, cover = ?, v = v + 1, updated = ? WHERE id = ?")
      .bind(c.title, JSON.stringify(c.questions), c.cover ? 1 : 0, now(), id),
    upsertUser(env, uid),
  ]);
  return json({ id });
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
  const r = await room(env, pin).join(uid, body.name, !!body.rejoin);
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
    env.DB.prepare("CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, seen REAL NOT NULL)"),
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
    ctx.blockConcurrencyWhile(async () => {
      this.s = (await ctx.storage.get("s")) ?? null;
    });
  }

  // State changes happen synchronously first; then we persist (and set the next wake-up).
  async persist() {
    const s = this.s;
    if (!s) return;
    await this.ctx.storage.put("s", s);
    const wake = s.phase === "question"
      ? s.started + s.quiz.questions[s.q].time * 1000 + 400
      : (s.created + GAME_TTL) * 1000;
    await this.ctx.storage.setAlarm(wake);
  }

  async init(d) {
    if (this.s && this.s.gid !== d.gid) this.closeAll();
    this.s = { ...d, players: {}, phase: "lobby", q: -1, started: 0 };
    await this.persist();
    return true;
  }

  async alarm() {
    const s = this.s;
    if (!s) return;
    if (s.phase === "question" && Date.now() >= s.started + s.quiz.questions[s.q].time * 1000) return this.reveal();
    if (Date.now() >= (s.created + GAME_TTL) * 1000) return this.end(s.gid);
    return this.persist(); // woke early: just re-arm
  }

  async join(uid, rawName, rejoin) {
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
    s.players[pid] = { uid, name, score: 0, choice: null, ms: 0, gained: 0, right: false };
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
    if (body.action === "answer") {
      const pid = text(body.player);
      if (!Object.hasOwn(s.players, pid)) return { status: 403, body: { error: "You're not in this game" } };
      await this.answer(s.players[pid], body.choice);
    } else if (body.action === "next" || body.action === "end") {
      if (body.token !== s.token) return { status: 403, body: { error: "Only the host can do that" } };
      await (body.action === "next" ? this.advance() : this.end(s.gid));
    } else {
      return { status: 400, body: { error: "Unknown action" } };
    }
    return { status: 200, body: { ok: true } };
  }

  // -- state machine --
  async advance() {
    const s = this.s;
    if (s.phase === "lobby") {
      if (Object.keys(s.players).length) await this.ask(0);
    } else if (s.phase === "question") {
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
    Object.assign(s, { q: i, phase: "question", started: Date.now() });
    for (const p of Object.values(s.players)) Object.assign(p, { choice: null, ms: 0, gained: 0, right: false });
    this.push();
    await this.persist();
  }

  async answer(p, choice) {
    const s = this.s;
    if (s.phase !== "question" || p.choice !== null) return;
    const q = s.quiz.questions[s.q];
    if (isPin(q)) {
      const valid = choice && typeof choice === "object" && typeof choice.x === "number" && typeof choice.y === "number";
      if (!valid || !(choice.x >= 0 && choice.x <= 1 && choice.y >= 0 && choice.y <= 1)) return;
      choice = [round4(choice.x), round4(choice.y)];
    } else if (!Number.isInteger(choice) || choice < 0 || choice >= q.answers.length) {
      return;
    }
    p.choice = choice;
    p.ms = Date.now() - s.started;
    if (Object.values(s.players).every((x) => x.choice !== null)) return this.reveal();
    this.push();
    await this.persist();
  }

  async reveal() {
    const s = this.s;
    const q = s.quiz.questions[s.q];
    for (const p of Object.values(s.players)) {
      p.right = isRight(q, p.choice);
      if (p.right) {
        // Right answers earn 500-1000: the faster, the closer to 1000.
        const frac = Math.min(1, p.ms / (q.time * 1000));
        p.gained = Math.round(1000 * (1 - frac / 2));
        p.score += p.gained;
      }
    }
    s.phase = "reveal";
    this.push();
    await this.persist();
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
      .map(([id, p]) => ({ id, name: p.name, score: p.score, gained: p.gained }))
      .sort((a, b) => b.score - a.score);
  }

  question() {
    const q = this.s.quiz.questions[this.s.q];
    return { type: isPin(q) ? "pin" : "quiz", title: q.title, answers: q.answers || [], time: q.time, image: q.image };
  }

  state(pid) {
    const s = this.s;
    const board = this.board();
    const st = {
      t: "state", phase: s.phase, pin: s.pin, quizTitle: s.quiz.title, cover: s.quiz.cover || null,
      qIndex: s.q, total: s.quiz.questions.length, count: board.length,
    };
    const live = s.phase === "question" || s.phase === "reveal";
    const q = live ? s.quiz.questions[s.q] : null;
    if (live) {
      st.question = this.question();
      st.remaining = Math.max(0, Math.floor(q.time * 1000 - (Date.now() - s.started)));
      if (s.phase === "reveal") {
        if (isPin(q)) st.regions = q.regions;
        else st.correct = q.correct;
      }
    }
    const players = Object.values(s.players);
    if (pid === null) {
      st.role = "host";
      st.players = board.map(({ name, score, gained }) => ({ name, score, gained }));
      if (live) {
        st.answered = players.filter((p) => p.choice !== null).length;
        if (s.phase === "reveal") {
          if (isPin(q)) {
            st.pins = players.filter((p) => p.choice !== null)
              .map((p) => ({ x: p.choice[0], y: p.choice[1], ok: p.right, name: p.name }));
            st.hits = players.filter((p) => p.right).length;
          } else {
            st.counts = st.question.answers.map((_, i) => players.filter((p) => p.choice === i).length);
          }
        }
      }
    } else {
      const p = s.players[pid];
      Object.assign(st, {
        role: "player", name: p.name, score: p.score, gained: p.gained, choice: p.choice, right: p.right,
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
    for (const sub of this.subs) this.send(sub, this.state(sub.pid));
  }

  startPing() {
    this.ping ??= setInterval(() => {
      if (!this.subs.size) {
        clearInterval(this.ping);
        this.ping = null;
        return;
      }
      for (const sub of this.subs) this.send(sub, ": ping\n\n");
    }, 15000);
  }

  closeAll() {
    for (const sub of this.subs) {
      this.send(sub, { t: "ended" });
      sub.writer.close().catch(() => {});
    }
    this.subs.clear();
  }
}
