#!/usr/bin/env python3
"""Blitz — a tiny live-quiz server. Standard library only: `python3 server.py`.

No accounts: each browser gets a private random cookie. Everything tied to it
(your quizzes, the games you played) is kept for 7 days after your last visit,
and every visit pushes that window forward again.
"""
import base64
import json
import math
import os
import queue
import re
import secrets
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = int(os.environ.get("PORT", 3000))
ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, "public")
DATA = os.path.join(ROOT, "data")
QUIZZES = os.path.join(DATA, "quizzes")
USERS = os.path.join(DATA, "users")
os.makedirs(QUIZZES, exist_ok=True)
os.makedirs(USERS, exist_ok=True)

WEEK = 7 * 24 * 3600
RATED_MIN_PLAYERS = 2  # solo games don't count toward lifetime stats, so nobody can farm wins alone
QUIZ_TTL = 15 * 24 * 3600  # a quiz nobody has played or edited for 15 days is deleted
COVER = 999                # picture slot for the quiz's intro picture
COOKIE = "blitz_uid"
MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
        ".ico": "image/x-icon", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg"}
IMG_RE = re.compile(r"^data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$")
KEEP_RE = re.compile(r"^/api/quizzes/([\w-]+)/image/(\d+)(?:\?v=\d+)?$")  # "keep the picture you already have"
ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,40}$")
UID_RE = re.compile(r"^[A-Za-z0-9_-]{32}$")
TIMES = (10, 20, 30, 60)
SPA = ("/", "/create", "/play", "/dashboard", "/leaderboard")

LOCK = threading.RLock()
GAMES = {}  # pin -> Game


def write_json(path, obj):
    tmp = f"{path}.{secrets.token_hex(4)}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f)
    os.replace(tmp, path)


# ---------- quizzes (one JSON file each) ----------

def clean_quiz(body, quiz_id=None, old=None):
    title = str(body.get("title") or "").strip()[:120]
    if not title:
        raise ValueError("Give your quiz a title")
    raw = body.get("questions")
    if not isinstance(raw, list) or not 1 <= len(raw) <= 50:
        raise ValueError("Add at least one question")
    questions = []
    for n, q in enumerate(raw, 1):
        if not isinstance(q, dict):
            raise ValueError("Bad question")
        qtitle = str(q.get("title") or "").strip()[:200]
        if not qtitle:
            raise ValueError(f"Question {n} needs a title")
        image = clean_image(q.get("image"), quiz_id, old, n)
        limit = q.get("time") if q.get("time") in TIMES else 20
        if q.get("type") == "pin":
            if not image:
                raise ValueError(f"Question {n} needs a picture to pin on")
            questions.append({"type": "pin", "title": qtitle, "image": image,
                              "regions": clean_regions(q.get("regions"), n), "time": limit})
            continue
        if q.get("type") == "tf":
            if q.get("correct") not in (0, 1) or isinstance(q.get("correct"), bool):
                raise ValueError(f"Question {n}: pick True or False")
            questions.append({"type": "tf", "title": qtitle, "answers": ["True", "False"], "correct": q["correct"],
                              "image": image, "time": limit})
            continue
        if q.get("type") == "slider":
            questions.append(dict({"type": "slider", "title": qtitle, "image": image, "time": limit}, **clean_slider(q, n)))
            continue
        answers = q.get("answers")
        if not isinstance(answers, list):
            raise ValueError(f"Question {n} needs answers")
        answers = [str(a).strip()[:100] for a in answers]
        if not 2 <= len(answers) <= 4 or not all(answers):
            raise ValueError(f"Question {n} needs 2 to 4 answers")
        correct = q.get("correct")
        if isinstance(correct, bool) or not isinstance(correct, int) or not 0 <= correct < len(answers):
            raise ValueError(f"Mark the correct answer for question {n}")
        questions.append({"type": "quiz", "title": qtitle, "answers": answers, "correct": correct,
                          "image": image, "time": limit})
    return {"title": title, "questions": questions, "cover": clean_cover(body.get("cover"), quiz_id, old)}


def clean_cover(image, quiz_id, old):
    """The quiz's intro picture: a new upload, "keep the one you have", or none."""
    if not image:
        return None
    if isinstance(image, str):
        if IMG_RE.match(image):
            return image
        m = KEEP_RE.match(image)
        if m and old and m.group(1) == quiz_id and int(m.group(2)) == COVER and old.get("cover"):
            return old["cover"]
    raise ValueError("The intro picture isn't supported")


def clean_image(image, quiz_id, old, n):
    if not image:
        return None
    if isinstance(image, str):
        if IMG_RE.match(image):
            return image
        m = KEEP_RE.match(image)
        if m and old and m.group(1) == quiz_id and int(m.group(2)) != COVER and int(m.group(2)) < len(old["questions"]):
            return old["questions"][int(m.group(2))].get("image")
    raise ValueError(f"Question {n} has an unsupported picture")


# Slider questions: a range, a step, the right value, an optional unit, and how close counts.
MARGINS = {"exact": 0, "low": 0.05, "medium": 0.1, "high": 0.2}  # share of the range


def snap(v, q):
    return round(round((v - q["min"]) / q["step"]) * q["step"] + q["min"], 6)


def clean_slider(q, n):
    def num(v):
        if isinstance(v, bool):
            return float("nan")
        try:
            return float(v)
        except (TypeError, ValueError):
            return float("nan")
    lo, hi, step, answer = (num(q.get(k)) for k in ("min", "max", "step", "answer"))
    if not all(math.isfinite(v) and abs(v) <= 1e9 for v in (lo, hi, step, answer)):
        raise ValueError(f"Question {n}: fill in the slider numbers")
    if lo >= hi:
        raise ValueError(f"Question {n}: the slider's lowest value must be below its highest")
    if step <= 0 or (hi - lo) / step > 100000:
        raise ValueError(f"Question {n}: pick a bigger slider step")
    if not lo <= answer <= hi:
        raise ValueError(f"Question {n}: the right value must be inside the range")
    margin = q.get("margin") if q.get("margin") in MARGINS else "medium"
    sl = {"min": lo, "max": hi, "step": step, "margin": margin, "unit": str(q.get("unit") or "").strip()[:12]}
    sl["answer"] = snap(answer, sl)
    return sl


def slider_share(q, v):
    """1 for a spot-on guess; inside the margin, from 1 down to 0.5 at its edge; 0 outside it."""
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        return 0
    dist = abs(v - q["answer"])
    if dist < 1e-9:
        return 1
    tol = MARGINS[q["margin"]] * (q["max"] - q["min"])
    return 1 - 0.5 * dist / tol if tol and dist <= tol + 1e-9 else 0


def clean_regions(regions, n):
    """Target areas for a pin question: rectangles as fractions (0-1) of the picture."""
    if not isinstance(regions, list) or not 1 <= len(regions) <= 8:
        raise ValueError(f"Question {n}: drag on the picture to mark the right area")
    out = []
    for r in regions:
        try:
            x, y, w, h = (float(r[k]) for k in "xywh")
        except (TypeError, KeyError, ValueError):
            raise ValueError(f"Question {n} has a bad area")
        if not (0 <= x <= 1 and 0 <= y <= 1 and 0.005 < w <= 1.0001 - x and 0.005 < h <= 1.0001 - y):
            raise ValueError(f"Question {n} has a bad area")
        out.append({"x": round(x, 4), "y": round(y, 4), "w": round(w, 4), "h": round(h, 4)})
    return out


def is_pin(q):
    return q.get("type") == "pin"


# Pin questions: a player may drop up to one pin per target area. Each area with at least one
# pin in it counts as found; finding every area is a full right answer.
def in_region(r, pt):
    x, y = pt
    return r["x"] <= x <= r["x"] + r["w"] and r["y"] <= y <= r["y"] + r["h"]


def pins_of(choice):
    if not choice:
        return []
    return [choice] if isinstance(choice[0], (int, float)) else choice


def areas_found(q, choice):
    return sum(any(in_region(r, pt) for pt in pins_of(choice)) for r in q["regions"])


def is_right(q, choice):
    if choice is None:
        return False
    if is_pin(q):
        return areas_found(q, choice) == len(q["regions"])
    if q.get("type") == "slider":
        return slider_share(q, choice) > 0
    return choice == q["correct"]


def quiz_path(quiz_id):
    return os.path.join(QUIZZES, quiz_id + ".json")


def load_quiz(quiz_id):
    if not isinstance(quiz_id, str) or not ID_RE.match(quiz_id):
        return None
    try:
        with open(quiz_path(quiz_id), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def delete_quiz(quiz_id):
    if isinstance(quiz_id, str) and ID_RE.match(quiz_id):
        try:
            os.remove(quiz_path(quiz_id))
        except OSError:
            pass


def image_url(quiz_id, quiz, i):
    # ?v= changes on every edit, so browsers never show a stale cached picture.
    has = quiz.get("cover") if i == COVER else quiz["questions"][i].get("image")
    return f"/api/quizzes/{quiz_id}/image/{i}?v={quiz.get('v', 1)}" if has else None


def prune_quizzes():
    """Delete quizzes nobody has played (or edited) for 15 days, unless a game of them is running."""
    cutoff = time.time() - QUIZ_TTL
    running = {g.quiz_id for g in GAMES.values() if g.phase != "final"}
    for name in os.listdir(QUIZZES):
        quiz_id = name[:-5]
        if not name.endswith(".json") or quiz_id in running:
            continue
        quiz = load_quiz(quiz_id)
        if quiz and max(quiz.get("updated", 0), quiz.get("lastPlayed") or 0) < cutoff:
            delete_quiz(quiz_id)


# ---------- people (one JSON file per browser cookie) ----------

def user_path(uid):
    return os.path.join(USERS, uid + ".json")


def fresh_user():
    return {"created": [], "played": [], "seen": 0}


def load_user(uid):
    try:
        with open(user_path(uid), encoding="utf-8") as f:
            u = json.load(f)
    except (OSError, ValueError):
        return fresh_user()
    if u.get("seen", 0) < time.time() - WEEK:   # not seen for 7 days: forget them
        forget_user(uid, u)
        return fresh_user()
    return u


def save_user(uid, u):
    u["seen"] = time.time()
    u["played"] = u["played"][:50]  # history is kept as long as the browser is remembered
    write_json(user_path(uid), u)


def forget_user(uid, u):
    for quiz_id in u.get("created", []):
        delete_quiz(quiz_id)
    try:
        os.remove(user_path(uid))
    except OSError:
        pass


def touch_user(uid):
    """Any visit keeps your stuff for 7 more days (written at most once an hour)."""
    try:
        if time.time() - os.path.getmtime(user_path(uid)) < 3600:
            return
    except OSError:
        return  # nothing stored for this browser yet
    with LOCK:
        u = load_user(uid)
        if u["created"] or u["played"]:
            save_user(uid, u)


def stats_of(u):
    """Lifetime stats. Blitz rating = points, plus 1,000 a win, plus 300 a 2nd or 3rd place."""
    st = u.get("stats") or {}
    out = {k: st.get(k, 0) for k in ("games", "points", "wins", "podiums", "best")}
    out["rating"] = out["points"] + 1000 * out["wins"] + 300 * out["podiums"]
    return out


def ranked_users():
    """Everyone with at least one rated game, best first (only ever run locally, so a file scan is fine)."""
    rows = []
    for name in os.listdir(USERS):
        if not name.endswith(".json"):
            continue
        uid = name[:-5]
        u = load_user(uid)
        st = stats_of(u)
        if st["games"]:
            rows.append(dict(st, uid=uid, name=(u.get("stats") or {}).get("name") or "Player",
                             look=(u.get("stats") or {}).get("look")))
    rows.sort(key=lambda r: (-r["rating"], -r["wins"], r["games"]))
    return rows


def prune_users():
    for name in os.listdir(USERS):
        if name.endswith(".json"):
            load_user(name[:-5])  # loading an expired user forgets them


# ---------- live games ----------

class Game:
    def __init__(self, quiz_id, quiz, owner):
        self.pin = new_pin()
        self.token = secrets.token_urlsafe(18)
        self.quiz_id, self.quiz, self.owner = quiz_id, quiz, owner
        self.players = {}          # id -> {uid, name, score, choice, ms, gained, right}
        self.phase = "lobby"       # lobby | question | reveal | final
        self.q = -1
        self.started = 0.0
        self.created = time.time()
        self.gid = f"{self.pin}-{int(self.created)}"
        self.timer = None
        self.subs = []             # (player_id or None for host, Queue)

    # -- state machine --
    def advance(self):
        if self.phase == "lobby":
            if self.players:
                self.ask(0)
        elif self.phase == "question":
            self.reveal()
        elif self.phase == "reveal":
            if self.q + 1 < len(self.quiz["questions"]):
                self.ask(self.q + 1)
            else:
                self.phase = "final"
                self.record()
                self.push()

    def ask(self, i):
        self.q, self.phase, self.started = i, "question", time.time()
        for p in self.players.values():
            p["choice"], p["ms"], p["gained"], p["right"], p["found"] = None, 0, 0, False, 0
        self.timer = threading.Timer(self.quiz["questions"][i]["time"] + 0.4, self.timeout, [i])
        self.timer.daemon = True
        self.timer.start()
        self.push()

    def timeout(self, i):
        with LOCK:
            if self.phase == "question" and self.q == i:
                self.reveal()

    def answer(self, p, choice):
        if self.phase != "question" or p["choice"] is not None:
            return
        q = self.quiz["questions"][self.q]
        if is_pin(q):
            # One pin ({x, y}) or several ([{x, y}, ...]), at most one per target area.
            items = choice if isinstance(choice, list) else [choice]
            if not items or len(items) > len(q["regions"]):
                return
            pts = []
            for c in items:
                try:
                    x, y = float(c["x"]), float(c["y"])
                except (TypeError, KeyError, ValueError):
                    return
                if not (0 <= x <= 1 and 0 <= y <= 1):
                    return
                pts.append([round(x, 4), round(y, 4)])
            choice = pts
        elif q.get("type") == "slider":
            if isinstance(choice, bool) or not isinstance(choice, (int, float)) or not math.isfinite(choice) \
                    or not q["min"] <= choice <= q["max"]:
                return
            choice = snap(choice, q)
        elif isinstance(choice, bool) or not isinstance(choice, int) or not 0 <= choice < len(q["answers"]):
            return
        p["choice"], p["ms"] = choice, (time.time() - self.started) * 1000
        if all(x["choice"] is not None for x in self.players.values()):
            self.reveal()
        else:
            self.push()

    def reveal(self):
        if self.timer:
            self.timer.cancel()
        q = self.quiz["questions"][self.q]
        for p in self.players.values():
            p["right"] = is_right(q, p["choice"])
            # Pin questions give credit for each area found; quiz questions are all or nothing.
            if is_pin(q):
                p["found"] = 0 if p["choice"] is None else areas_found(q, p["choice"])
                share = p["found"] / len(q["regions"])
            elif q.get("type") == "slider":
                share = slider_share(q, p["choice"])
            else:
                share = 1 if p["right"] else 0
            if share > 0:
                # Right answers earn 500-1000: the faster, the closer to 1000. Partly right pins earn their share of that.
                frac = min(1.0, p["ms"] / (q["time"] * 1000))
                p["gained"] = round(1000 * (1 - frac / 2) * share)
                p["score"] += p["gained"]
        self.phase = "reveal"
        self.push()

    def record(self):
        """Game over: note it on the quiz and in every player's history."""
        quiz = load_quiz(self.quiz_id)
        if quiz:
            quiz["plays"] = quiz.get("plays", 0) + 1
            quiz["lastPlayed"] = time.time()
            write_json(quiz_path(self.quiz_id), quiz)
        board = self.board()
        for rank, row in enumerate(board, 1):
            uid = self.players[row["id"]]["uid"]
            u = load_user(uid)
            for e in u["played"]:
                if e["id"] == self.gid:
                    e.update(score=row["score"], rank=rank, count=len(board), done=True)
            if len(board) >= RATED_MIN_PLAYERS:
                st = u.setdefault("stats", {})
                st["name"], st["look"] = row["name"], row.get("look")
                st["games"] = st.get("games", 0) + 1
                st["points"] = st.get("points", 0) + row["score"]
                st["wins"] = st.get("wins", 0) + (rank == 1)
                st["podiums"] = st.get("podiums", 0) + (rank in (2, 3))
                st["best"] = max(st.get("best", 0), row["score"])
            save_user(uid, u)

    # -- snapshots --
    def board(self):
        rows = [{"id": pid, "name": p["name"], "look": p.get("look"), "score": p["score"], "gained": p["gained"]}
                for pid, p in self.players.items()]
        return sorted(rows, key=lambda r: -r["score"])

    def question(self):
        q = self.quiz["questions"][self.q]
        out = {"type": q.get("type") if q.get("type") in ("tf", "slider") else "pin" if is_pin(q) else "quiz", "title": q["title"],
               "answers": q.get("answers", []), "time": q["time"],
               "image": image_url(self.quiz_id, self.quiz, self.q)}
        if is_pin(q):
            out["maxPins"] = len(q["regions"])  # how many pins a player may drop (one per area)
        if q.get("type") == "slider":
            out.update({k: q[k] for k in ("min", "max", "step", "unit")})
        return out

    def state(self, pid):
        board = self.board()
        s = {"t": "state", "phase": self.phase, "pin": self.pin, "quizTitle": self.quiz["title"],
             "cover": image_url(self.quiz_id, self.quiz, COVER),
             "qIndex": self.q, "total": len(self.quiz["questions"]), "count": len(board)}
        live = self.phase in ("question", "reveal")
        if live:
            q = self.quiz["questions"][self.q]
            s["question"] = self.question()
            s["remaining"] = max(0, int(q["time"] * 1000 - (time.time() - self.started) * 1000))
            if self.phase == "reveal":
                if is_pin(q):
                    s["regions"] = q["regions"]
                elif q.get("type") == "slider":
                    s["correct"] = q["answer"]
                    s["tolerance"] = MARGINS[q["margin"]] * (q["max"] - q["min"])
                else:
                    s["correct"] = q["correct"]
        if pid is None:
            s["role"] = "host"
            s["players"] = [{k: r[k] for k in ("name", "score", "gained", "look")} for r in board]
            if live:
                picks = [p["choice"] for p in self.players.values()]
                s["answered"] = sum(c is not None for c in picks)
                if self.phase == "reveal":
                    if is_pin(q):
                        s["pins"] = [{"x": pt[0], "y": pt[1], "ok": any(in_region(r, pt) for r in q["regions"]), "name": p["name"]}
                                     for p in self.players.values() if p["choice"] is not None for pt in pins_of(p["choice"])]
                        s["hits"] = sum(p["right"] for p in self.players.values())
                    elif q.get("type") == "slider":
                        s["guesses"] = [{"name": p["name"], "v": p["choice"], "ok": p["right"]}
                                        for p in self.players.values() if p["choice"] is not None]
                        s["hits"] = sum(p["right"] for p in self.players.values())
                    else:
                        s["counts"] = [picks.count(i) for i in range(len(s["question"]["answers"]))]
        else:
            p = self.players[pid]
            s.update(role="player", name=p["name"], look=p.get("look"), score=p["score"], gained=p["gained"],
                     choice=p["choice"], right=p["right"], found=p.get("found", 0),
                     rank=[r["id"] for r in board].index(pid) + 1)
        return s

    def push(self):
        for pid, q in self.subs:
            q.put(json.dumps(self.state(pid)))

    def end(self):
        if self.timer:
            self.timer.cancel()
        for _, q in self.subs:
            q.put(json.dumps({"t": "ended"}))
            q.put(None)
        GAMES.pop(self.pin, None)


def new_pin():
    while True:
        pin = str(secrets.randbelow(900000) + 100000)
        if pin not in GAMES:
            return pin


def sweep():
    cutoff = time.time() - 4 * 3600
    for g in [g for g in GAMES.values() if g.created < cutoff]:
        g.end()
    prune_users()
    prune_quizzes()


def live_game(quiz_id, owner):
    for g in GAMES.values():
        if g.quiz_id == quiz_id and g.owner == owner and g.phase != "final":
            return g
    return None


def lan_url():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))  # no packet is sent; just picks the outbound interface
        ip = s.getsockname()[0]
        s.close()
        return None if ip.startswith("127.") else f"http://{ip}:{PORT}"
    except OSError:
        return None


# ---------- HTTP ----------

class Handler(BaseHTTPRequestHandler):
    uid = None

    def log_message(self, *args):
        pass

    def identify(self):
        """Who is this? The private cookie, or a brand-new one."""
        for part in (self.headers.get("Cookie") or "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == COOKIE and UID_RE.match(v):
                self.uid = v
                touch_user(v)
                return
        self.uid = secrets.token_urlsafe(24)

    def end_headers(self):
        if self.uid:  # refresh on every response: 7 days from your last visit
            self.send_header("Set-Cookie", f"{COOKIE}={self.uid}; Max-Age={WEEK}; Path=/; HttpOnly; SameSite=Lax")
        super().end_headers()

    def send_json(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def fail(self, code, msg):
        self.send_json(code, {"error": msg})

    def send_bytes(self, data, ctype, cache="no-cache"):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def own_quiz(self, quiz_id):
        """The quiz, if this browser made it; otherwise sends an error and returns None."""
        quiz = load_quiz(quiz_id)
        if not quiz:
            self.fail(404, "Quiz not found")
            return None
        if not secrets.compare_digest(quiz.get("owner", ""), self.uid):
            self.fail(403, "This quiz belongs to someone else")
            return None
        return quiz

    def do_GET(self):
        self.identify()
        url = urlparse(self.path)
        path = url.path
        qs = {k: v[0] for k, v in parse_qs(url.query).items()}
        try:
            if path == "/api/info":
                return self.send_json(200, {"lanUrl": lan_url()})
            if path == "/api/me":
                with LOCK:
                    return self.get_me()
            if path == "/api/leaderboard":
                with LOCK:
                    return self.get_leaderboard()
            if path == "/api/stream":
                return self.stream(qs)
            m = re.match(r"^/api/quizzes/([\w-]+)/image/(\d+)$", path)
            if m:
                return self.get_image(m.group(1), int(m.group(2)))
            m = re.match(r"^/api/quizzes/([\w-]+)$", path)
            if m:
                with LOCK:
                    quiz = self.own_quiz(m.group(1))
                if quiz:
                    q = [dict(x, image=image_url(m.group(1), quiz, i)) for i, x in enumerate(quiz["questions"])]
                    self.send_json(200, {"id": m.group(1), "title": quiz["title"], "v": quiz.get("v", 1),
                                         "cover": image_url(m.group(1), quiz, COVER), "questions": q})
                return
            if path.startswith("/api/"):
                return self.fail(404, "Not found")
            return self.static(path)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def static(self, path):
        if path in SPA or path.startswith(("/host/", "/edit/")):
            path = "/index.html"
        full = os.path.normpath(os.path.join(PUBLIC, path.lstrip("/")))
        if not full.startswith(PUBLIC + os.sep) or not os.path.isfile(full):
            self.send_response(404)
            self.end_headers()
            return
        with open(full, "rb") as f:
            self.send_bytes(f.read(), MIME.get(os.path.splitext(full)[1], "application/octet-stream"))

    def get_image(self, quiz_id, i):
        quiz = load_quiz(quiz_id)
        src = None
        if quiz and i == COVER:
            src = quiz.get("cover")
        elif quiz and i < len(quiz["questions"]):
            src = quiz["questions"][i].get("image")
        m = IMG_RE.match(src or "")
        if not m:
            return self.fail(404, "No picture")
        self.send_bytes(base64.b64decode(m.group(2)), "image/" + m.group(1), "public, max-age=31536000, immutable")

    def get_me(self):
        u = load_user(self.uid)
        mine = []
        for quiz_id in u["created"]:
            quiz = load_quiz(quiz_id)
            if not quiz or quiz.get("owner") != self.uid:
                continue
            # The intro picture, or else the first question's picture.
            cover = COVER if quiz.get("cover") else next((i for i, q in enumerate(quiz["questions"]) if q.get("image")), None)
            mine.append({"id": quiz_id, "title": quiz["title"], "questions": len(quiz["questions"]),
                         "pins": sum(is_pin(q) for q in quiz["questions"]),
                         "updated": quiz.get("updated", 0), "plays": quiz.get("plays", 0),
                         "lastPlayed": quiz.get("lastPlayed"), "live": bool(live_game(quiz_id, self.uid)),
                         "cover": image_url(quiz_id, quiz, cover) if cover is not None else None,
                         "expires": max(quiz.get("updated", 0), quiz.get("lastPlayed") or 0) + QUIZ_TTL})
        mine.sort(key=lambda q: -max(q["updated"], q["lastPlayed"] or 0))
        played = []
        for e in u["played"]:
            g = GAMES.get(e["pin"])
            played.append(dict(e, live=bool(g and g.gid == e["id"] and g.phase != "final")))
        if u["created"] or u["played"]:
            save_user(self.uid, u)  # visiting the dashboard keeps everything for another 7 days
        stats = stats_of(u)
        if stats["games"]:
            stats["rank"] = 1 + sum(1 for r in ranked_users() if r["rating"] > stats["rating"])
        self.send_json(200, {"quizzes": mine, "played": played, "stats": stats,
                             "expires": time.time() + WEEK if (u["created"] or u["played"]) else None})

    def get_leaderboard(self):
        rows = ranked_users()
        players = [dict({k: v for k, v in r.items() if k != "uid"}, rank=i + 1, you=r["uid"] == self.uid)
                   for i, r in enumerate(rows[:50])]
        you = None
        u = load_user(self.uid)
        st = stats_of(u)
        if st["games"]:
            you = dict(st, rank=1 + sum(1 for r in rows if r["rating"] > st["rating"]), you=True,
                       name=(u.get("stats") or {}).get("name") or "You", look=(u.get("stats") or {}).get("look"))
        self.send_json(200, {"players": players, "you": you, "total": len(rows)})

    def stream(self, qs):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        box = queue.Queue()
        with LOCK:
            g = GAMES.get(qs.get("pin"))
            pid = qs.get("player")
            ok = g and (pid in g.players if pid else qs.get("token") == g.token)
            if ok:
                sub = (pid or None, box)
                g.subs.append(sub)
                box.put(json.dumps(g.state(pid or None)))
            else:
                box.put(json.dumps({"t": "ended"}))
                box.put(None)
        try:
            while True:
                try:
                    msg = box.get(timeout=15)
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    continue
                if msg is None:
                    break
                self.wfile.write(f"data: {msg}\n\n".encode())
                self.wfile.flush()
        except OSError:
            pass
        finally:
            if ok:
                with LOCK:
                    if sub in g.subs:
                        g.subs.remove(sub)

    def do_POST(self):
        self.identify()
        n = int(self.headers.get("Content-Length") or 0)
        if n > 30_000_000:
            return self.fail(413, "That's too big — try smaller pictures")
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
            if not isinstance(body, dict):
                raise ValueError
        except ValueError:
            return self.fail(400, "Bad request")
        path = urlparse(self.path).path
        route = {"/api/quizzes": self.post_quiz, "/api/host": self.post_host,
                 "/api/join": self.post_join, "/api/act": self.post_act}.get(path)
        m = re.match(r"^/api/quizzes/([\w-]+)(/delete)?$", path)
        with LOCK:
            if route:
                return route(body)
            if m:
                return (self.delete_quiz if m.group(2) else self.update_quiz)(m.group(1), body)
            self.fail(404, "Not found")

    def post_quiz(self, body):
        try:
            quiz = clean_quiz(body)
        except ValueError as e:
            return self.fail(400, str(e))
        quiz_id = secrets.token_urlsafe(8)
        quiz.update(owner=self.uid, v=1, created=time.time(), updated=time.time(), plays=0)
        write_json(quiz_path(quiz_id), quiz)
        u = load_user(self.uid)
        u["created"].insert(0, quiz_id)
        save_user(self.uid, u)
        self.send_json(200, {"id": quiz_id})

    def update_quiz(self, quiz_id, body):
        old = self.own_quiz(quiz_id)
        if not old:
            return
        try:
            quiz = clean_quiz(body, quiz_id, old)
        except ValueError as e:
            return self.fail(400, str(e))
        keep = {k: old[k] for k in ("owner", "created", "plays", "lastPlayed") if k in old}
        quiz.update(keep, v=old.get("v", 1) + 1, updated=time.time())
        write_json(quiz_path(quiz_id), quiz)
        save_user(self.uid, load_user(self.uid))
        self.send_json(200, {"id": quiz_id})

    def delete_quiz(self, quiz_id, body):
        if not self.own_quiz(quiz_id):
            return
        g = live_game(quiz_id, self.uid)
        if g:
            g.end()
        delete_quiz(quiz_id)
        u = load_user(self.uid)
        u["created"] = [q for q in u["created"] if q != quiz_id]
        save_user(self.uid, u)
        self.send_json(200, {"ok": True})

    def post_host(self, body):
        quiz_id = body.get("quizId")
        quiz = self.own_quiz(quiz_id)
        if not quiz:
            return
        running = live_game(quiz_id, self.uid)
        if body.get("resume"):  # come back to a lobby/game you left open
            return self.send_json(200, {"pin": running.pin, "token": running.token} if running else {"pin": None})
        if running:
            running.end()
        sweep()
        g = Game(quiz_id, quiz, self.uid)
        GAMES[g.pin] = g
        self.send_json(200, {"pin": g.pin, "token": g.token})

    def post_join(self, body):
        g = GAMES.get(re.sub(r"\D", "", str(body.get("pin", ""))))
        if not g:
            return self.fail(404, "No game with that PIN")
        mine = next((pid for pid, p in g.players.items() if p["uid"] == self.uid), None)
        if body.get("rejoin"):  # same browser coming back: hand back the same player
            return self.send_json(200, {"pin": g.pin, "player": mine} if mine else {"player": None})
        if mine:
            return self.send_json(200, {"pin": g.pin, "player": mine})
        if g.phase == "final":
            return self.fail(409, "That game is already over")
        name = " ".join(str(body.get("name") or "").split())[:16]
        if not name:
            return self.fail(400, "Pick a nickname")
        if any(p["name"].lower() == name.lower() for p in g.players.values()):
            return self.fail(409, "That nickname is taken")
        if len(g.players) >= 200:
            return self.fail(409, "This game is full")
        pid = secrets.token_urlsafe(12)
        # A random character for this player, picked once here so every screen shows the same one.
        g.players[pid] = {"uid": self.uid, "name": name, "look": secrets.token_urlsafe(6),
                          "score": 0, "choice": None, "ms": 0, "gained": 0, "right": False}
        u = load_user(self.uid)
        u["played"].insert(0, {"id": g.gid, "pin": g.pin, "quizTitle": g.quiz["title"], "name": name,
                               "at": time.time(), "score": 0, "rank": None, "count": None, "done": False})
        save_user(self.uid, u)
        g.push()
        self.send_json(200, {"pin": g.pin, "player": pid})

    def post_act(self, body):
        g = GAMES.get(str(body.get("pin", "")))
        if not g:
            return self.fail(404, "That game has ended")
        action = body.get("action")
        if action == "answer":
            p = g.players.get(body.get("player"))
            if not p:
                return self.fail(403, "You're not in this game")
            g.answer(p, body.get("choice"))
        elif action in ("next", "end"):
            if body.get("token") != g.token:
                return self.fail(403, "Only the host can do that")
            g.advance() if action == "next" else g.end()
        else:
            return self.fail(400, "Unknown action")
        self.send_json(200, {"ok": True})


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 128


def housekeeping():
    """Once an hour: forget idle browsers and delete quizzes idle for 15 days."""
    while True:
        time.sleep(3600)
        with LOCK:
            prune_users()
            prune_quizzes()


if __name__ == "__main__":
    prune_users()
    prune_quizzes()
    threading.Thread(target=housekeeping, daemon=True).start()
    print(f"Blitz is running:  http://localhost:{PORT}")
    if lan_url():
        print(f"On your network:   {lan_url()}")
    Server(("0.0.0.0", PORT), Handler).serve_forever()
