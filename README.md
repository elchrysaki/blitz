# Blitz

A no-login live quiz game. One person builds a quiz, shares a link or PIN, and everyone races to answer on their phones. Right answers score 500–1,000 points: the faster, the more.

## Question types

- **Quiz:** a title, an optional picture and 2–4 answers. Mark the right one.
- **True / False:** a title, an optional picture, and two big answers (✓ True, ✕ False). Mark the right one.
- **Type answer:** a title, an optional picture, the right answer and up to 3 other spellings to accept. Players type their answer (up to 40 characters). Capitals, accents, punctuation and extra spaces don't matter, and one typo is forgiven in answers of 6+ letters without digits. The host's reveal shows what players typed, grouped, with counts.
- **Puzzle:** a title, an optional picture and 2–4 items written in the right order. Every player sees the same shuffle (never already in order) and drags the items into place. Only the exact order scores. The reveal shows the right order; each item keeps the colour and letter it had while shuffled.
- **Slider:** a title, an optional picture, a range (from / to), the right value, an optional unit, the step size, and how close counts (exact, ±5%, ±10% or ±20% of the range). Players drag to their guess. A spot-on guess scores full points; inside the margin, the closer the better (from full down to half at the edge); outside it, nothing. The reveal shows every guess on a number line.
- **Pin:** a title and a picture. Drag on the picture to mark one or more target areas. Players drop map-style pins, up to one per area (tap a pin to remove it). A pin in every area scores full points; each area found earns its share, so finding 2 of 3 areas earns two thirds. An area counts once however many pins are in it, and one pin where two areas overlap finds both. The host can make **stray pins** (outside every area) cost 100, 250 or 500 points each (off by default; a total never drops below zero).
- **Pins and puzzle orders count without locking in.** What a player has placed is saved as they go; when time runs out it counts, scored as the slowest answer. Locking in earlier earns the speed bonus.

**Lobby characters:** every player gets an original big-head character in an old-school 3D, 2000s-diva style, drawn by the app as SVG. Each player gets a random character when they join; the server picks it, so the host and the player see the same one. The host's lobby shows them as a grid that players hop into as they join, and each player sees their own character while waiting.

**Import questions** (editor → "Already have your questions written?"): fills a quiz from questions you already wrote. It only reads what's there (no AI, nothing invented). The reader is `public/import.js`, loaded the first time the sheet opens.

- **Sources:** drop or choose files or a whole folder, or paste text (from a PDF, Google Docs, a website…). Reads Word (.docx), Excel (.xlsx, including Kahoot's quiz template), .csv / .tsv, .txt / .md and .json. Older formats (.doc, .xls, .pages, PDF) need saving as one of those, or copying and pasting.
- **Text:** numbered questions with lettered, numbered or bulleted answers. Mark the right one with `*`, `✓`, `[x]` or bold, or write `Answer: B` under it, or add an *Answer key* at the end (`1-B, 2-C`). `Time: 30`, `Image: paris.jpg`, `Answer: False` (True / False), `Answer: Canberra | Canberra ACT` (Type answer), `Answer: 330 m` + `Range: 0-500` (Slider), `Order: A > B > C` (Puzzle).
- **Spreadsheets:** a header row with *Question*, *Answer 1–4*, *Correct answer* and optionally *Time limit*, *Image*, *Type*.
- **Pictures** from the same folder go to the question they name (`Image: …`) or by number (`1.jpg`, `q2.png`, `03-volcano.webp`). One called `cover` becomes the intro picture.
- A preview lists every question found, its pictures and anything to check (no right answer marked, too many answers) before you add them. Pin questions are skipped, since their areas are drawn in the editor.

**Host results:** after every question the host sees what everyone replied, not just the right answer. Quiz and True / False questions get a bar chart of how many picked each answer (the right one ticked). Every type gets a "Who answered what" list: each player's character, their reply in words (the answer, the typed text, the number, the order they chose, or the areas they found), and the points it earned, best first.

**Old quizzes, new editor:** opening any quiz or unsaved draft in the editor brings it up to the current format, so every question type and option is there, whatever version the quiz was made with.

Each quiz can also have an **intro picture**, added under the title in the editor. It's shown whole (never cropped) in the host's preview, in the lobby while players join, and on each player's waiting screen. It's also the quiz's cover on the dashboard; without one, the first question's picture is used.

## No accounts

Each browser gets a private random cookie (`blitz_uid`, HttpOnly). Everything tied to it is kept for **7 days after your last visit**, and every visit adds another 7 days:

- **Dashboard** (`/dashboard`): your lifetime stats (Blitz rating, world rank, games, wins, 2nd/3rd places, total points, best game, win rate), then your quizzes, with Host, Edit and Delete. Below them, every game you joined (the latest 50), with your rank and score. While a game still exists (its lobby is open or it is running), its row shows the PIN and tapping it takes you straight back in.
- Quizzes can only be edited, hosted or deleted from the browser that made them.
- After 7 days without a visit, the server forgets that browser and deletes everything tied to it: its quizzes, its history and its stats (which also takes it off the leaderboard).
- **Quizzes nobody plays for 15 days are deleted** with their pictures, to save space. The 15 days count from the later of the last finished game and the last edit. A quiz with a game running right now is never deleted. In the last 5 days, the dashboard shows "Deleted in N days unless it's played".

## Stats and leaderboard

- When a game with **at least 2 players** ends, each player's lifetime stats go up: games, points, wins, 2nd/3rd places and best game. Solo games don't count, so nobody can farm wins alone. The leaderboard shows the name and character from each player's latest game.
- **Blitz rating** = every point scored + 1,000 per win + 300 per 2nd or 3rd place.
- **Leaderboard** (`/leaderboard`, `GET /api/leaderboard`): the top 50 by rating with a podium for the top 3, your own row highlighted, and your rank even if you're outside the top 50.
- **Win screen:** players get confetti, a medal or trophy for the top 3, their character jumping, a points count-up, and their new rating and world rank. The host's podium shows each winner's character and medal.

## Online: Cloudflare

The live site runs on Cloudflare Workers (worker `blitz`):

- **Worker** (`src/worker.js`): the `/api/*` routes. The files in `public/` are served as static assets, and app routes such as `/dashboard` fall back to `index.html`.
- **Durable Object** `GameRoom`: one per game PIN. It holds the players, the question timer (an alarm) and the scores, and streams updates to every screen over server-sent events.
- **D1** database `blitz-db`: quizzes, pictures, browsers (cookie IDs, last visit and lifetime stats), play history and game PINs. The tables are created automatically on first use.
- **Cron** (daily, 03:17 UTC): forgets browsers that haven't visited for 7 days, deletes quizzes idle for 15 days, and removes old PINs. (Locally, `server.py` does the same at startup and then every hour.)

Deploys happen through **Cloudflare Workers Builds**, which is connected to this GitHub repo. Every push to `main` runs `npx wrangler deploy`. To deploy by hand from a machine with Node.js:

```bash
npm install && npx wrangler deploy
```

## Look

The denim wallpaper never moves: it's a fixed layer sized to the tallest the screen can get (phones grow when the address bar hides) with a margin above and below, and the page doesn't rubber-band past its top or bottom.

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
- **Logo** (`public/brand/`): `mark.svg` is a vermilion tile with a gallery-white lightning bolt and cream denim-style stitching. `logo.svg` is the mark plus the "blitz." wordmark. `mark-180.png` is the phone home-screen icon and `mark-512.png` a larger export. The mark is only the browser tab icon (and the phone home-screen icon); the page itself shows just the "blitz." wordmark.

## Speed

- **No continuous effects.** The background glow is a static gradient, cards don't blur what's behind them, and the countdown ticker only runs while a timer is on screen and the tab is visible. Idle pages use almost no CPU or GPU. People with reduced motion turned on get no animations.
- **Service worker** (`public/sw.js`). The page, script and styles come from the network first, usually as a quick "not changed" check, so every visit gets the newest version. The saved copy is used if the network takes over 2.5 s or is offline. When a new version takes over right as the page opens, the page reloads once to show it. A tab left open (or a home-screen app resumed later) checks now and then whether a newer version is live (by the `app.js` and `styles.css` ETags); if so, it reloads at the next page change, or straight away when you come back to it, unless a live game is on screen. Quiz pictures are cached for good, since their URLs change whenever a picture changes. Live game data is never cached.
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
- `public/import.js`: reads questions from text, Word, Excel, CSV and JSON for the editor's Import (loaded on demand)
- `public/styles.css`: styles
