# Blitz

A no-login live quiz game. One person builds a quiz, shares a link or PIN, and everyone races to answer on their phones. Right answers score 500–1,000 points: the faster, the more.

## Question types

- **Quiz:** a title, an optional picture and 2–4 answers. Mark the right one.
- **Pin:** a title and a picture. Drag on the picture to mark one or more target areas. Players tap to drop a map-style pin, and pins that land inside an area score.

## No accounts

Each browser gets a private random cookie (`blitz_uid`, HttpOnly). Everything tied to it is kept for **7 days after your last visit**, and every visit adds another 7 days:

- **Dashboard** (`/dashboard`): your quizzes, with Host, Edit and Delete. Below them, the games you recently played, with your rank and score. If a game is still running, you get a **Rejoin** button.
- Quizzes can only be edited, hosted or deleted from the browser that made them.
- After 7 days without a visit, the server forgets that browser and deletes its quizzes.

## Run it

Needs only Python 3.9+ (standard library, nothing to install):

```bash
python3 server.py
```

Open http://localhost:3000. Players on the same Wi-Fi join through the network link shown in the lobby. Data is stored as JSON files in `data/`, which git ignores.

## Files

- `server.py`: HTTP server, game state machine, live updates over server-sent events, and the cookie identity and storage
- `public/app.js`: the whole front end (home, dashboard, editor, host, player)
- `public/styles.css`: styles
