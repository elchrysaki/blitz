"""Tiny client for scripted tests against a Blitz server (local or live).

    from blitz import Client
    host = Client("http://localhost:3000")    # one cookie jar = one browser
    q = host.call("/api/quizzes", {...})
"""
import http.cookiejar
import json
import urllib.request

# A 1x1 PNG, enough for questions that need a picture.
PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


class Client:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, path, body=None):
        # A browser-like User-Agent and Origin: the live site turns away bare scripts.
        req = urllib.request.Request(self.base + path, data=None if body is None else json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 blitz-test",
                                              "Origin": self.base})
        return json.loads(self.opener.open(req).read() or b"{}")


class Game:
    """Host a quiz and drive it: game.next("question"), game.answer(player, choice)."""

    def __init__(self, base, quiz):
        self.base = base
        self.host = Client(base)
        self.quiz_id = self.host.call("/api/quizzes", quiz)["id"]
        h = self.host.call("/api/host", {"quizId": self.quiz_id})
        self.pin, self.token = h["pin"], h["token"]
        self.players = {}

    def join(self, name, look=None):
        c = Client(self.base)
        pid = c.call("/api/join", {"pin": self.pin, "name": name, **({"look": look} if look else {})})["player"]
        self.players[name] = (c, pid)
        return name

    def act(self, name, action, choice=None):
        c, pid = self.players[name]
        return c.call("/api/act", {"pin": self.pin, "player": pid, "action": action, "choice": choice})["state"]

    def answer(self, name, choice):
        return self.act(name, "answer", choice)

    def next(self, frm=None, q=None):
        body = {"pin": self.pin, "token": self.token, "action": "next"}
        if frm is not None:
            body["from"] = frm
        if q is not None:
            body["q"] = q
        return self.host.call("/api/act", body)["state"]

    def host_do(self, action, **extra):
        return self.host.call("/api/act", {"pin": self.pin, "token": self.token, "action": action, **extra})["state"]

    def close(self):
        """End the game and delete the quiz (always do this, especially on the live site)."""
        try:
            self.host_do("end")
        finally:
            self.host.call(f"/api/quizzes/{self.quiz_id}/delete", {})
