// See worker_check.sh. Plays a scored quiz and a form through the real GameRoom code.
globalThis.TextEncoder = class { encode(s) { return s; } };
globalThis.setInterval = () => 0; globalThis.clearInterval = () => {};
globalThis.crypto = { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 2 ** 32) >>> 0; return a; } };
const { GameRoom, cleanQuiz } = await import('./worker.mjs');

let fails = 0;
const check = (label, ok, got) => { print(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  -> ${JSON.stringify(got)}`}`); if (!ok) fails++; };
const store = new Map(); let alarm = null;
const clone = (v) => JSON.parse(JSON.stringify(v));
const ctx = { storage: {
  get: async (k) => (store.has(k) ? clone(store.get(k)) : undefined), put: async (k, v) => { store.set(k, clone(v)); },
  list: async ({ prefix }) => new Map([...store].filter(([k]) => k.startsWith(prefix))),
  delete: async (ks) => { for (const k of [].concat(ks)) store.delete(k); }, deleteAll: async () => store.clear(),
  setAlarm: async (t) => { alarm = t; }, deleteAlarm: async () => { alarm = null; } }, blockConcurrencyWhile: (f) => f() };
const stmt = () => ({ bind() { return this; }, run: async () => ({ meta: { changes: 1 } }), first: async () => null, all: async () => ({ results: [] }) });
const env = { DB: { prepare: stmt, batch: async () => [] } };
const settle = async () => { for (let i = 0; i < 20; i++) await null; };

async function play(questions) {
  const quiz = { title: 'T', cover: null, questions: cleanQuiz({ title: 'T', questions }, 'qid').questions.map((q, i) => ({ ...q, image: q.image ? `/img/${i}` : null })) };
  const room = new GameRoom(ctx, env); await settle();
  await room.init({ pin: '123456', gid: `g${Math.random()}`, token: 'T', quizId: 'q', owner: 'o', created: Date.now() / 1000, quiz });
  const A = (await room.join('u'.repeat(32), 'Ada', false, '~123456781')).body.player;
  const B = (await room.join('v'.repeat(32), 'Bo', false)).body.player;
  const host = (from, q) => room.act({ action: 'next', token: 'T', from, q }).then((r) => r.body.state);
  const ans = (p, choice) => room.act({ action: 'answer', player: p, choice }).then((r) => r.body.state);
  return { room, A, B, host, ans };
}

// cleanQuiz
check('title keeps line breaks', cleanQuiz({ title: 'x', questions: [{ title: ' Hi \r\n- a  \n\n\n- b', answers: ['1', '2'], correct: 0 }] }).questions[0].title === 'Hi\n- a\n\n- b');
try { cleanQuiz({ title: 'x', questions: [{ type: 'drop', title: 'no pic' }] }); check('drop needs a picture', false); } catch (e) { check('drop needs a picture', /picture/.test(e.message), e.message); }

// scored quiz + Skip guard
{
  const { room, A, B, host, ans } = await play([
    { type: 'quiz', title: '2+2', answers: ['3', '4'], correct: 1, time: 20 },
    { type: 'poll', title: 'Fun?', answers: ['Yes', 'No'], time: 20, anon: true }]);
  await host('lobby'); await ans(A, 1); let st = await ans(B, 0);
  check('quiz: all answered -> reveal', st.phase === 'reveal');
  check('quiz: right answer scores', room.state(A).gained > 0 && room.state(B).gained === 0);
  st = await host('question', 0);
  check('late Skip stays on results', st.phase === 'reveal' && st.qIndex === 0, [st.phase, st.qIndex]);
  await host('reveal', 0); st = await host('reveal', 0);
  check('double Next moves once', st.qIndex === 1 && st.phase === 'question', [st.phase, st.qIndex]);
  await ans(A, 0); st = await ans(B, 1);
  check('anonymous poll has no host names', !('replies' in room.state(null)) && st.results.counts.join() === '1,1');
  st = await host('reveal', 1);
  check('mixed quiz is not a form', st.phase === 'final' && !st.form && st.responses.length === 2);
}

// form with every opinion type
{
  const { room, A, B, host, ans } = await play([
    { type: 'poll', title: 'Lunch?', answers: ['Pizza', 'Sushi'], other: true, time: 20 },
    { type: 'scale', title: 'Calm?', labels: ['Nope', '', '', '', 'Totally'], time: 90, anon: true },
    { type: 'scale', mode: 'nps', title: 'Recommend?', time: 20, anon: true },
    { type: 'drop', title: 'Sit?', image: 'data:image/png;base64,iVBORw0KGgo=', time: 20 },
    { type: 'cloud', title: 'Word', time: 20, anon: true },
    { type: 'open', title: 'More?', time: 120 },
    { type: 'brain', title: 'Ideas', time: 60, anon: true }]);
  let st = await host('lobby');
  check('form flagged', st.form && st.question.other);
  await ans(A, 0); st = await ans(B, 'Ramen');
  check('poll + Other', room.state(null).results.others[0].text === 'Ramen', room.state(null).results);
  await host('reveal', 0); await ans(A, 4); st = await ans(B, 3);
  check('scale average 1-5', st.results.avg === 4.5, st.results);
  await host('reveal', 1); await ans(A, 10); st = await ans(B, 5);
  check('NPS', room.state(null).results.nps === 0, room.state(null).results);
  await host('reveal', 2); await room.act({ action: 'draft', player: A, choice: { x: 0.2, y: 0.3 } }); await ans(B, { x: 0.5, y: 0.5 });
  st = await host('question', 3);
  check('unlocked drop pin counts', st.results.total === 2 && room.state(A).auto);
  await host('reveal', 3); await ans(A, 'Chaotic'); st = await ans(B, 'chaotic!');
  check('cloud merges spellings', JSON.stringify(st.results.words) === '[{"text":"Chaotic","n":2}]', st.results.words);
  await host('reveal', 4); await ans(A, 'x'.repeat(400)); st = await host('question', 5);
  check('open capped at 250', st.results.answers[0].text.length === 250);
  await host('reveal', 5); for (const i of ['Hike', 'hike!', 'Boat', 'Cook', 'Extra']) await ans(A, i); await ans(B, 'Boat'); await ans(B, 'Karaoke');
  st = await host('question', 6);
  check('ideas merged, 3 each', JSON.stringify(st.ideas.map((i) => [i.text, i.n])) === '[["Hike",1],["Boat",2],["Cook",1],["Karaoke",1]]', st.ideas);
  st = (await room.act({ action: 'group', token: 'T', a: 0, b: 3 })).body.state;
  check('host groups ideas', st.ideas.length === 3 && st.ideas[0].members.join() === 'Hike,Karaoke');
  st = await host('ideas', 6);
  check('vote 30 s with alarm', st.phase === 'vote' && st.endsAt - st.now === 30000 && Math.abs(alarm - Date.now() - 30400) < 2000);
  await ans(A, [0, 1]); st = await ans(B, [1]);
  check('votes ranked', JSON.stringify(st.results.ideas.map((i) => [i.text, i.votes])) === '[["Boat",2],["Hike",1],["Cook",0]]');
  st = await host('reveal', 6);
  check('form final with all responses', st.phase === 'final' && st.form && st.responses.length === 7);
  check('anonymous log has no names', st.responses[6].rows.every((r) => r.name === null));
  const again = new GameRoom(ctx, env); await settle();
  check('responses survive a restart', again.state(null).responses.length === 7);
}

print(fails ? `\n${fails} FAILED` : '\nALL PASSED');
