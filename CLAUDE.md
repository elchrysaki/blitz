# Blitz — working guide

Live quiz app (Kahoot-like): quizzes, forms (opinion questions), live games by PIN. Live at
https://blitz.euroavia.workers.dev — every push to `main` deploys (Cloudflare Workers Builds, ~40 s).
Details of every feature are in README.md; read only the section you need.

## Where things are (jump by section marker, don't read whole files)
Files are big. Find the section first, then read just that range:
`grep -n -- "---------- " public/app.js` (same for `public/styles.css`, `src/worker.js`, `server.py`).

- `public/app.js` (~3,500 lines, the whole front end, no framework): sections `player avatars`,
  `character editor`, `helpers`, `the server's clock` (live stream + `send()`), `phone menu`,
  `host results`, `opinion results` (+ CSV download), `dashboard`, `explore`, `leaderboard`, `home`,
  `confirm`, `create` (editor: `card()`, `opinionEdit()`, save payload in `#publish`), `import`,
  `host` (`renderHost`), `play` (`renderPlayer`).
- `public/styles.css`: one section per feature, same names. Colours/fonts only from `:root` tokens.
- `public/import.js`: importer + quiz download (`fromBlitz`, `finish`, `toText`, `exportQuiz`).
- `src/worker.js`: Cloudflare backend. `cleanQuiz` (validation), `collect opinions`, API routes,
  `GameRoom` Durable Object (`act`, `advance`, `answer`, `reveal`, `revealOpinion`, `state`).
- `server.py`: local backend, same API, Python stdlib only. **Keep it in step with worker.js.**

## Rules
- Any game/API change goes in BOTH `src/worker.js` and `server.py` (same field names, same results).
- No new colours or fonts; use the tokens. Mobile first: check 375 px and 320 px wide.
- Old saved quizzes must keep working (editor runs `upgradeDraft`; servers validate every field).
- Commit only when asked ("push commit" = commit + push + check it's live). Trailer:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Never use or repeat a token/password pasted in chat. Don't recreate other companies' characters/designs.
- Test data made on the live site gets deleted afterwards.

## Test (instead of writing new scripts)
- `python3 server.py` → http://localhost:3000 (run in the background; restart after editing server.py).
- `python3 tests/game_test.py [BASE_URL]` — full game: scoring, Skip guards, every opinion type,
  forms, responses. Default is local; pass the live URL to check a deploy (it cleans up).
- `sh tests/worker_check.sh` — runs the Cloudflare `GameRoom` code with fake storage (no Node needed).
- Syntax check front end: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc public/app.js`
  (a `ReferenceError: document` means it parsed fine).
- `tests/blitz.py` has `Client` / `Game` helpers for new scripted checks.
- Browser checks: in the built-in browser, inject `*{animation:none!important;transition:none!important}`
  before screenshots (background tabs freeze fade-ins); trust DOM reads over screenshots that lag.

## Save tokens
- Grep for the section or function, then read 40–120 lines around it. Never read a whole big file.
- Edit with small exact replacements (or a Python script asserting each match count once).
- Don't re-read a file after editing it; don't re-run checks that already passed.
- Reuse `tests/` scripts; extend them rather than writing throwaway ones.
- One screenshot per state you need to see, at 0.5 scale unless detail matters.
- Keep replies short: what changed, what was checked, what's left.
