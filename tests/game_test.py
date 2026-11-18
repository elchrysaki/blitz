"""End-to-end game test: every question type, Skip/Next guards, forms and the responses log.

    python3 tests/game_test.py                                   # local server (python3 server.py)
    python3 tests/game_test.py https://blitz.euroavia.workers.dev  # the live site (cleans up after itself)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from blitz import PNG, Game  # noqa: E402

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
fails = []


def check(label, ok, got=None):
    print(("ok   " if ok else "FAIL ") + label + ("" if ok else f"  -> {got!r}"))
    if not ok:
        fails.append(label)


# ---- a scored quiz: points, Skip never jumps past results ----
g = Game(BASE, {"title": "Test quiz", "questions": [
    {"type": "quiz", "title": "2+2?", "answers": ["3", "4"], "correct": 1, "time": 20},
    {"type": "type", "title": "Capital of Australia?", "accepted": ["Canberra"], "time": 20},
    {"type": "quiz", "title": "Line one\n- bullet", "answers": ["a", "b"], "correct": 0, "time": 20}]})
try:
    g.join("Ada"); g.join("Bo")
    st = g.next("lobby", -1)
    check("game starts", st["phase"] == "question" and st["endsAt"] - st["now"] == 20000, st["phase"])
    g.answer("Ada", 1); st = g.answer("Bo", 0)
    check("all answered -> results", st["phase"] == "reveal", st["phase"])
    check("right answer scores", st is not None and g.act("Ada", "answer")["gained"] > 0)
    st = g.next("question", 0)
    check("late Skip stays on results", st["phase"] == "reveal" and st["qIndex"] == 0, (st["phase"], st["qIndex"]))
    st = g.next("reveal", 0); st2 = g.next("reveal", 0)
    check("double-tap Next moves once", st2["qIndex"] == 1, st2["qIndex"])
    g.answer("Ada", "canberra"); st = g.answer("Bo", "Sydney")
    check("typed answer forgiving", g.act("Ada", "answer")["right"] and not st["right"])
    st = g.next("reveal", 1)
    check("multi-line title kept", st["question"]["title"] == "Line one\n- bullet", st["question"]["title"])
    g.answer("Ada", 0); g.answer("Bo", 0); st = g.next("reveal", 2)
    check("quiz ends with podium data", st["phase"] == "final" and not st["form"] and len(st["responses"]) == 3)
finally:
    g.close()

# ---- a form: every opinion type ----
g = Game(BASE, {"title": "Test form", "questions": [
    {"type": "poll", "title": "Lunch?", "answers": ["Mon", "Wed", "Fri"], "other": True, "time": 20},
    {"type": "scale", "title": "On track", "labels": ["Nope", "", "", "", "Totally"], "time": 20, "anon": True},
    {"type": "scale", "mode": "nps", "title": "Recommend?", "time": 20, "anon": True},
    {"type": "drop", "title": "Where?", "image": PNG, "time": 20},
    {"type": "cloud", "title": "One word", "time": 20, "anon": True},
    {"type": "open", "title": "Anything else?", "time": 60},
    {"type": "brain", "title": "Ideas", "time": 60, "anon": True}]})
try:
    g.join("Ada"); g.join("Bo")
    st = g.next("lobby", -1)
    check("form flagged", st["form"] and st["question"]["other"])
    g.answer("Ada", 1); st = g.answer("Bo", "Saturday")
    host = g.next("x")  # a "from" that doesn't match does nothing: just read the host's state
    check("poll + Other", host["results"]["counts"] == [0, 1, 0] and host["results"]["others"][0]["text"] == "Saturday", host["results"])
    g.next("reveal", 0); g.answer("Ada", 4); g.answer("Bo", 3)
    r = g.next("x")["results"]
    check("scale average is 1-5", r["avg"] == 4.5, r)
    check("anonymous: no names to host", "replies" not in g.next("x"))
    g.next("reveal", 1); g.answer("Ada", 10); g.answer("Bo", 5)
    r = g.next("x")["results"]
    check("NPS", r["nps"] == 0 and r["promoters"] == 1 and r["detractors"] == 1, r)
    g.next("reveal", 2); g.act("Ada", "draft", {"x": .2, "y": .3}); g.answer("Bo", {"x": .5, "y": .5})
    st = g.next("question", 3)
    check("unlocked drop pin counts", st["results"]["total"] == 2, st["results"])
    g.next("reveal", 3); g.answer("Ada", "Chaotic"); g.answer("Bo", "chaotic!")
    r = g.next("x")["results"]
    check("word cloud merges spellings", r["words"] == [{"text": "Chaotic", "n": 2}], r)
    g.next("reveal", 4); g.answer("Ada", "x" * 400); st = g.next("question", 5)
    check("open answers capped at 250", len(st["results"]["answers"][0]["text"]) == 250)
    g.next("reveal", 5)
    for idea in ["Hike", "hike!", "Boat", "Cook", "Extra"]:
        g.answer("Ada", idea)
    g.answer("Bo", "Boat"); g.answer("Bo", "Karaoke")
    st = g.next("question", 6)
    check("ideas merged, max 3 each", [(i["text"], i["n"]) for i in st["ideas"]] == [("Hike", 1), ("Boat", 2), ("Cook", 1), ("Karaoke", 1)], st["ideas"])
    st = g.host_do("group", a=0, b=3)
    check("host groups ideas", len(st["ideas"]) == 3 and st["ideas"][0]["members"] == ["Hike", "Karaoke"], st["ideas"])
    st = g.next("ideas", 6)
    check("vote phase, 30 s", st["phase"] == "vote" and st["endsAt"] - st["now"] == 30000)
    g.answer("Ada", [0, 1]); st = g.answer("Bo", [1])
    check("votes ranked", [(i["text"], i["votes"]) for i in st["results"]["ideas"]] == [("Boat", 2), ("Hike", 1), ("Cook", 0)])
    st = g.next("reveal", 6)
    check("form ends with every response", st["phase"] == "final" and len(st["responses"]) == 7)
    check("anonymous rows have no names", all(r["name"] is None for r in st["responses"][6]["rows"]))
finally:
    g.close()

print(f"\n{'ALL PASSED' if not fails else f'{len(fails)} FAILED'} against {BASE}")
sys.exit(1 if fails else 0)
