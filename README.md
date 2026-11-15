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

## Online: Cloudflare

The live site runs on Cloudflare Workers (worker `blitz`):

- **Worker** (`src/worker.js`): the `/api/*` routes. The files in `public/` are served as static assets, and app routes such as `/dashboard` fall back to `index.html`.
- **Durable Object** `GameRoom`: one per game PIN. It holds the players, the question timer (an alarm) and the scores, and streams updates to every screen over server-sent events.
- **D1** database `blitz-db`: quizzes, pictures, browsers (cookie IDs and last visit), play history and game PINs. The tables are created automatically on first use.
- **Cron** (daily, 03:17 UTC): forgets browsers that haven't visited for 7 days, and removes old PINs.

Deploys happen through **Cloudflare Workers Builds**, which is connected to this GitHub repo. Every push to `main` runs `npx wrangler deploy`. To deploy by hand from a machine with Node.js:

```bash
npm install && npx wrangler deploy
```

## Look

The colors and fonts are fixed. Use the tokens in `public/styles.css` (`:root`) and don't add new colors or fonts.

The palette comes from a teal-and-vermilion wall painting. The colors were white-balanced against the gallery wall, then pushed brighter and more saturated.

| Token | Color | Use |
| --- | --- | --- |
| `--ink-950` | `#032A3C` | page background (the painting's deepest teal) |
| `--teal-900` | `#06425C` | cards, nav |
| `--teal-700` | `#0A6C93` | raised details (step numbers, covers) |
| `--wall` | `#F6F1E9` | text (gallery white) |
| `--vermilion` | `#FF5A1F` | the one accent: primary buttons, highlighted words, labels, timer; answer A |
| `--turquoise` | `#1FA8D2` | answer B; also means correct |
| `--ice` | `#D4EEF6` | answer C (the pale swirls) |
| `--sand` | `#EBC9A5` | answer D (the maple floor) |
| `--ember` | `#B8360B` | wrong (the sun's burnt core) |

- **Bricolage Grotesque** (headlines, numbers, PIN, scores) and **DM Sans** (everything else). Both are served from `public/fonts/`.

## Speed

- **No continuous effects.** The background glow is a static gradient, cards don't blur what's behind them, and the countdown ticker only runs while a timer is on screen and the tab is visible. Idle pages use almost no CPU or GPU. People with reduced motion turned on get no animations.
- **Service worker** (`public/sw.js`). It serves the page, script and styles from the browser's cache at once, then quietly fetches fresh copies for next time, so after a deploy each browser picks up the new version on its second visit. Quiz pictures are cached for good, since their URLs change whenever a picture changes. Live game data is never cached.
- **Dashboard** draws instantly from the last copy saved in `localStorage` (`blitz:me`), then refreshes from the server.
- **Server.** The dashboard needs one D1 round trip, and Smart Placement runs the Worker near the database.

## Run it locally

Needs only Python 3.9+ (standard library, nothing to install):

```bash
python3 server.py
```

Open http://localhost:3000. Players on the same Wi-Fi join through the network link shown in the lobby. Locally, data is stored as JSON files in `data/`, which git ignores. `server.py` and `src/worker.js` implement the same API, so `public/app.js` works with either. Keep them in step when you change one.

## Files

- `src/worker.js`: the Cloudflare backend (API, D1 storage, `GameRoom` Durable Object)
- `wrangler.jsonc`: Cloudflare config (assets, D1, Durable Object, cron)
- `server.py`: the local backend (the same API, using Python's standard library)
- `public/app.js`: the whole front end (home, dashboard, editor, host, player)
- `public/styles.css`: styles
