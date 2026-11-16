// Blitz importer: turns questions you already wrote into editor questions. No AI: it reads the
// structure that's there (numbers, letters, marks, columns) and never invents anything.
// Loaded on demand by the editor's Import sheet; exposes window.BlitzImport.
//
// Reads: plain text / Markdown (typed or pasted), CSV / TSV, Excel .xlsx (incl. Kahoot's quiz
// template), Word .docx and JSON. Pictures are matched to questions by the app (see app.js).
(() => {
  const TIMES = [10, 20, 30, 60];
  const LET = 'ABCD';
  const clean = (s) => String(s ?? '').replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
  const norm = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const snapTime = (v) => {
    const n = parseFloat(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? TIMES.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a)) : null;
  };
  const num = (v) => { const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

  // ---------- one answer line: strip its marker, notice whether it's marked as the right one ----------
  // Right-answer marks: [x] checkbox, a * or + stuck to the front, **bold**, a trailing *, ✓ or (correct).
  function markCorrect(text) {
    let t = text, correct = false;
    const tests = [
      [/^\*\*(.+)\*\*$/, 1], [/^__(.+)__$/, 1],
      [/^[*+✓✔]\s*(.+)$/, 1],
      [/^(.+?)\s*(?:\*|✓|✔|✅|←.*|<-.*|\((?:correct|right|true answer|answer)\)|\[(?:correct|right)\])$/i, 1],
    ];
    for (const [re, g] of tests) {
      const m = t.match(re);
      if (m) { t = m[g]; correct = true; }
    }
    return { text: clean(t), correct };
  }

  const RE = {
    // "1. What…", "1) …", "Q2: …", "Question 3 - …"
    qnum: /^\s*(?:q(?:uestion)?\s*)?(\d{1,3})\s*[.):\-–]\s*(.+)$/i,
    check: /^\s*(?:[-*•]\s*)?\[([ xX✓✔])\]\s*(.+)$/,                    // "- [x] Paris"
    letter: /^\s*[*+]?\s*\(?([a-dA-D])\s*[).:\]]\s+(.+)$/,                 // "a) …", "B. …", "(c) …", "*b) …"
    numOpt: /^\s*\(?([1-9])\s*[)\]]\s+(.+)$/,                               // "1) …" inside a question
    bullet: /^\s*(?:[-•–]|\*(?=\s)|\+(?=\s))\s+(.+)$/,                      // "- …", "• …", "* …"
    meta: /^\s*(answers?|correct(?:\s+answers?)?|right\s+answer|ans|solution|time(?:\s+limit)?|timer|seconds|secs|image|picture|photo|img|pic|type|kind|range|from|to|min|max|unit|step|margin|accept|also\s+accept|order|title|quiz)\s*[:=]\s*(.*)$/i,
    keyHead: /^\s*(?:#+\s*)?(?:answer\s*key|answers|key|solutions?|correct\s+answers)\s*:?\s*$/i,
  };
  const metaKey = (k) => {
    k = k.toLowerCase().replace(/\s+/g, ' ');
    if (/^(answers?|correct( answers?)?|right answer|ans|solution)$/.test(k)) return 'answer';
    if (/^(time( limit)?|timer|seconds|secs)$/.test(k)) return 'time';
    if (/^(image|picture|photo|img|pic)$/.test(k)) return 'image';
    if (k === 'kind') return 'type';
    if (k === 'from') return 'min';
    if (k === 'to') return 'max';
    if (k === 'also accept') return 'accept';
    return k;
  };

  // ---------- plain text / Markdown / pasted text ----------
  function parseText(src) {
    const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    const raw = [];
    const key = {};
    let title = null, cur = null, gap = false, inKey = false;
    const flush = () => { if (cur && (cur.title || cur.options.length)) raw.push(cur); cur = null; };
    const start = (t, n) => { flush(); cur = { title: clean(t), options: [], meta: {}, num: n ?? null }; };
    for (const line0 of lines) {
      const line = line0.replace(/[   ]/g, ' ').replace(/\t/g, ' ').trimEnd();
      if (!line.trim()) { gap = true; continue; }
      let m;
      if (RE.keyHead.test(line)) { flush(); inKey = true; gap = false; continue; }
      if (inKey) {   // "1. B", "2 - c", or several on one line: "1-B, 2-C, 3-A"
        const parts = line.split(/[,;]\s*|\s{2,}/).map((p) => p.match(/^\s*(\d{1,3})\s*[.):\-–=]?\s*(.+?)\s*$/)).filter(Boolean);
        if (parts.length) { parts.forEach((p) => { key[+p[1]] = clean(p[2]); }); continue; }
        inKey = false;
      }
      if ((m = line.match(/^\s*#{1,6}\s+(.+)$/)) && !raw.length && !cur && !title) { title = clean(m[1]); gap = false; continue; }
      if ((m = line.match(RE.meta))) {
        const k = metaKey(m[1]);
        if ((k === 'title' || k === 'quiz') && !cur && !raw.length) { title = clean(m[2]); gap = false; continue; }
        if (cur && !['title', 'quiz'].includes(k)) {
          if (k === 'range') {
            const r = m[2].match(/(-?[\d.,]+)\s*(?:-|–|to|\.\.)\s*(-?[\d.,]+)\s*(.*)$/i);
            if (r) { cur.meta.min = r[1]; cur.meta.max = r[2]; if (r[3] && !cur.meta.unit) cur.meta.unit = clean(r[3]); }
          } else cur.meta[k] = clean(m[2]);
          gap = false;
          continue;
        }
      }
      // An answer line (only once a question has started)
      if (cur && cur.title) {
        let o = null;
        if ((m = line.match(RE.check))) o = { ...markCorrect(m[2]), correct: m[1] !== ' ' || markCorrect(m[2]).correct };
        else if ((m = line.match(RE.letter)) && (cur.options.length || !RE.qnum.test(line))) {
          const leadStar = /^\s*[*+]/.test(line);
          const mc = markCorrect(m[2]);
          o = { text: mc.text, correct: mc.correct || leadStar };
        } else if ((m = line.match(RE.numOpt)) && +m[1] === cur.options.length + 1 && (cur.options.length || !gap)) o = markCorrect(m[2]);   // 1), 2), 3)… in sequence
        else if ((m = line.match(RE.bullet))) o = markCorrect(m[1]);
        if (o && o.text) { cur.options.push(o); gap = false; continue; }
      }
      if ((m = line.match(RE.qnum))) { start(m[2], +m[1]); gap = false; continue; }
      if ((m = line.match(/^\s*#{1,6}\s+(.+)$/))) { start(m[1]); gap = false; continue; }
      // A plain line: after a blank line it starts a new question; right under a question that ends in
      // "?" or ":" (or among plain answers) it's an answer; otherwise the question continues.
      if (!cur || gap) { start(line); gap = false; continue; }
      if (cur.options.length && /\?\s*$/.test(line)) { start(line); gap = false; continue; }   // a new question right after answers
      if (cur.options.length || /[?:]\s*$/.test(cur.title)) cur.options.push(markCorrect(clean(line)));
      else cur.title = clean(`${cur.title} ${line}`);
      gap = false;
    }
    flush();
    return { title, raw, key };
  }

  // ---------- tables: CSV / TSV / Excel ----------
  function parseDelimited(text) {
    const first = text.split(/\r?\n/, 1)[0] || '';
    const count = (c) => first.split(c).length - 1;
    const delim = [['\t', count('\t')], [';', count(';')], [',', count(',')]].sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function parseTable(rows0) {
    const rows = rows0.map((r) => r.map(clean));
    const isHead = (r) => r.some((c) => /^(question|prompt|q)\b/i.test(c)) && r.filter(Boolean).length >= 2;
    const h = rows.findIndex((r, i) => i < 15 && isHead(r));
    const cols = { q: 0, opts: [1, 2, 3, 4], answer: 5, time: 6, image: -1, type: -1, accept: -1, min: -1, max: -1, unit: -1, num: -1 };
    if (h >= 0) {
      const head = rows[h].map((c) => c.toLowerCase());
      const find = (re, not) => head.findIndex((c, i) => re.test(c) && !(not || []).includes(i));
      cols.q = find(/^(question|prompt|q)\b/);
      cols.opts = head.map((c, i) => (/^(answer|option|choice|antwort|réponse|respuesta)\s*[1-4a-d]\b|^[a-d]$|^(option|answer)\s*\(?[a-d]\)?$/.test(c) ? i : -1)).filter((i) => i >= 0).slice(0, 4);
      cols.answer = find(/correct|right answer|solution|^answer$|^key$|^ans$/, cols.opts);
      cols.time = find(/time|seconds|timer/);
      cols.image = find(/image|picture|photo|img|pic/);
      cols.type = find(/^type|kind/);
      cols.accept = find(/accept/);
      cols.min = find(/^(min|from|lowest)/);
      cols.max = find(/^(max|to|highest)/);
      cols.unit = find(/^unit/);
      if (cols.q < 0) cols.q = 0;
    }
    const raw = [];
    rows.slice(h + 1).forEach((r) => {
      const title = r[cols.q];
      if (!title) return;
      const at = (i) => (i >= 0 ? r[i] || '' : '');
      const meta = {};
      for (const k of ['answer', 'time', 'image', 'type', 'accept', 'min', 'max', 'unit']) if (at(cols[k])) meta[k] = at(cols[k]);
      raw.push({ title, options: cols.opts.map((i) => markCorrect(at(i))).filter((o) => o.text), meta, num: null });
    });
    return { title: null, raw, key: {} };
  }

  // ---------- zip files (.xlsx, .docx) ----------
  async function unzip(buf, want) {
    const v = new DataView(buf);
    const u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('That file looks damaged');
    const total = v.getUint16(eocd + 10, true);
    let p = v.getUint32(eocd + 16, true);
    const out = {};
    const dec = new TextDecoder();
    for (let n = 0; n < total; n++) {
      if (v.getUint32(p, true) !== 0x02014b50) break;
      const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
      const nameLen = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), comment = v.getUint16(p + 32, true);
      const local = v.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extra + comment;
      if (!want(name)) continue;
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const data = u8.subarray(start, start + size);
      if (method === 0) out[name] = dec.decode(data);
      else if (method === 8) {
        const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        out[name] = await new Response(s).text();
      }
    }
    return out;
  }
  const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const kids = (el, tag) => [...el.getElementsByTagName(tag)];

  async function readXlsx(buf) {
    const files = await unzip(buf, (n) => /^xl\/(sharedStrings\.xml|workbook\.xml|_rels\/workbook\.xml\.rels|worksheets\/sheet\d+\.xml)$/.test(n));
    const strings = files['xl/sharedStrings.xml'] ? kids(xml(files['xl/sharedStrings.xml']), 'si').map((si) => kids(si, 't').map((t) => t.textContent).join('')) : [];
    // the first sheet in the workbook's order
    let sheet = Object.keys(files).filter((n) => n.includes('worksheets/')).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))[0];
    try {
      const first = kids(xml(files['xl/workbook.xml']), 'sheet')[0];
      const rid = first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const rel = kids(xml(files['xl/_rels/workbook.xml.rels']), 'Relationship').find((r) => r.getAttribute('Id') === rid);
      const target = 'xl/' + rel.getAttribute('Target').replace(/^\/?xl\//, '');
      if (files[target]) sheet = target;
    } catch { /* fall back to the lowest-numbered sheet */ }
    if (!sheet) throw new Error('No sheet found in that spreadsheet');
    const colIdx = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
    const rows = [];
    kids(xml(files[sheet]), 'row').forEach((r) => {
      const out = [];
      kids(r, 'c').forEach((c) => {
        const t = c.getAttribute('t');
        const val = c.getElementsByTagName('v')[0]?.textContent ?? '';
        const text = t === 's' ? strings[+val] ?? '' : t === 'inlineStr' ? kids(c, 't').map((x) => x.textContent).join('') : val;
        out[colIdx(c.getAttribute('r') || '')] = text;
      });
      rows.push(Array.from(out, (x) => x ?? ''));
    });
    return parseTable(rows);
  }

  // Word: each paragraph becomes a line. Sub-level list items become answers; a paragraph that is
  // entirely bold (a common way to mark the right answer) is marked right.
  async function readDocx(buf) {
    const files = await unzip(buf, (n) => n === 'word/document.xml');
    const doc = xml(files['word/document.xml']);
    const lines = [];
    // Word's automatic list numbers aren't in the text. Top-level list items are questions when the
    // answers sit one level down (or when they end in "?" / ":"); otherwise they're answers.
    const paras = kids(doc, 'w:p');
    const nested = paras.some((p) => +(p.getElementsByTagName('w:ilvl')[0]?.getAttribute('w:val') || 0) >= 1 && p.getElementsByTagName('w:numPr').length);
    let qn = 0;
    paras.forEach((p) => {
      const runs = kids(p, 'w:r');
      const text = runs.map((r) => kids(r, 'w:t').map((t) => t.textContent).join('') + (r.getElementsByTagName('w:tab').length ? ' ' : '')).join('');
      if (!clean(text)) { lines.push(''); return; }
      const textRuns = runs.filter((r) => clean(kids(r, 'w:t').map((t) => t.textContent).join('')));
      const bold = textRuns.length && textRuns.every((r) => { const b = r.getElementsByTagName('w:b')[0]; return b && b.getAttribute('w:val') !== '0' && b.getAttribute('w:val') !== 'false'; });
      const lvl = p.getElementsByTagName('w:ilvl')[0]?.getAttribute('w:val');
      const listed = p.getElementsByTagName('w:numPr').length > 0;
      let line = clean(text);
      if (listed && +lvl >= 1 && !/^\(?[a-dA-D1-4][).]\s/.test(line)) line = `- ${line}`;
      else if (listed && !(+lvl >= 1) && !/^\d{1,3}[.)]\s/.test(line)) {
        line = nested || /[?:]\s*$/.test(line) ? `${++qn}. ${line}` : `- ${line}`;
      }
      if (bold && (listed || /^\(?[a-dA-D][).]\s/.test(line))) line = line.replace(/^(- |\(?[a-dA-D][).]\s+)?(.*)$/, (_, pre, rest) => `${pre || '- '}**${rest}**`);
      lines.push(line);
    });
    return parseText(lines.join('\n'));
  }

  // ---------- JSON (Blitz's own shape and common quiz shapes) ----------
  function parseJson(text) {
    const j = JSON.parse(text);
    const list = Array.isArray(j) ? j : j.questions || j.items || j.quiz?.questions || [];
    const raw = list.map((o) => {
      if (typeof o !== 'object' || !o) return null;
      const title = clean(o.question ?? o.title ?? o.q ?? o.text ?? o.prompt);
      const opts = o.answers ?? o.options ?? o.choices ?? [];
      const options = (Array.isArray(opts) ? opts : []).map((a) => (typeof a === 'object' && a
        ? { text: clean(a.text ?? a.answer ?? a.option ?? a.title), correct: !!(a.correct ?? a.isCorrect ?? a.right) }
        : { text: clean(a), correct: false })).filter((a) => a.text);
      const meta = {};
      if (Number.isInteger(o.correct) && o.correct >= 0 && o.correct < options.length) options[o.correct].correct = true;   // 0-based index
      else if (o.correct != null && typeof o.correct !== 'object') meta.answer = String(o.correct);
      for (const k of ['answer', 'correctAnswer', 'correct_answer']) if (o[k] != null && !meta.answer) meta.answer = Array.isArray(o[k]) ? o[k].join(' | ') : String(o[k]);
      if (Array.isArray(o.accepted)) meta.answer = o.accepted.join(' | ');
      for (const [k, to] of [['time', 'time'], ['timeLimit', 'time'], ['image', 'image'], ['type', 'type'], ['min', 'min'], ['max', 'max'], ['unit', 'unit'], ['step', 'step'], ['margin', 'margin']]) if (o[k] != null && o[k] !== '') meta[to] = String(o[k]);
      if (o.type === 'puzzle' && options.length && !meta.order) meta.order = options.map((a) => a.text).join(' > ');
      return title ? { title, options, meta, num: null } : null;
    }).filter(Boolean);
    return { title: clean(j.title) || null, raw, key: {} };
  }

  // ---------- turn what was read into editor questions ----------
  const TYPE_WORDS = { quiz: 'quiz', mc: 'quiz', multiple: 'quiz', 'multiple choice': 'quiz', choice: 'quiz', tf: 'tf', 'true/false': 'tf', 'true false': 'tf', truefalse: 'tf', boolean: 'tf',
    type: 'type', 'type answer': 'type', typed: 'type', text: 'type', open: 'type', short: 'type', 'short answer': 'type', puzzle: 'puzzle', order: 'puzzle', ordering: 'puzzle', sort: 'puzzle',
    slider: 'slider', range: 'slider', number: 'slider', numeric: 'slider', estimate: 'slider', pin: 'pin', map: 'pin' };
  const typeOf = (v) => (v ? TYPE_WORDS[clean(v).toLowerCase().replace(/[_-]/g, ' ')] ?? TYPE_WORDS[clean(v).toLowerCase().replace(/[^a-z/]/g, '')] ?? null : null);
  // Only true/false words make a True / False question (answers like "yes / no" stay as written).
  const isTrue = (s) => /^(true|t|vrai|wahr|verdadero|vero|σωστό|σωστο)$/i.test(clean(s));
  const isFalse = (s) => /^(false|f|faux|falsch|falso|λάθος|λαθος)$/i.test(clean(s));
  const splitList = (s) => String(s).split(/\s*(?:\||;|\/\/|\bor\b)\s*/i).map(clean).filter(Boolean);

  function pickAnswer(ans, options) {
    if (ans == null || ans === '') return -1;
    const a = clean(ans);
    let m = a.match(/^\(?([a-dA-D])\)?(?:[).:]|\s|$)/);
    if (m && (a.length <= 3 || !options.some((o) => norm(o.text) === norm(a)))) {
      const i = LET.indexOf(m[1].toUpperCase());
      if (i < options.length) return i;
    }
    m = a.match(/^([1-4])(?:\D|$)/);
    if (m && +m[1] <= options.length && !options.some((o) => norm(o.text) === norm(a))) return +m[1] - 1;
    const i = options.findIndex((o) => norm(o.text) === norm(a.replace(/^\(?[a-dA-D1-4][).:]\s*/, '')));
    return i;
  }

  function finish(c, n, key) {
    const meta = c.meta || {};
    const warnings = [];
    let ans = meta.answer ?? key[c.num ?? n] ?? null;
    let type = typeOf(meta.type);
    const time = snapTime(meta.time) || 20;
    const base = { title: clean(c.title).slice(0, 200), time, imageRef: meta.image || null, num: c.num ?? n };
    if (!base.title) return null;
    if (type === 'pin') return { skip: true, title: base.title, reason: 'Pin questions need their areas drawn on a picture, so add them in the editor' };
    let opts = c.options.filter((o) => o.text);
    // Puzzle: "Order: A > B > C" or type puzzle with the items listed in the right order
    if (type === 'puzzle' || meta.order) {
      let items = meta.order ? meta.order.split(/\s*(?:>|→|->|\||;|,)\s*/).map(clean).filter(Boolean) : opts.map((o) => o.text);
      if (items.length > 4) { warnings.push(`Only the first 4 of ${items.length} items fit a puzzle`); items = items.slice(0, 4); }
      if (items.length < 2) warnings.push('A puzzle needs at least 2 items');
      return { ...base, type: 'puzzle', answers: [...items.map((s) => s.slice(0, 100)), '', '', '', ''].slice(0, 4), warnings };
    }
    // True / False
    const tfOpts = opts.length === 2 && isTrue(opts[0].text) && isFalse(opts[1].text);
    const tfFlip = opts.length === 2 && isFalse(opts[0].text) && isTrue(opts[1].text);
    if (type === 'tf' || tfOpts || tfFlip || (!opts.length && ans != null && (isTrue(ans) || isFalse(ans)))) {
      let correct = -1;
      const marked = opts.findIndex((o) => o.correct);
      if (marked >= 0) correct = isTrue(opts[marked].text) ? 0 : 1;
      else if (ans != null) {
        if (isTrue(ans)) correct = 0; else if (isFalse(ans)) correct = 1;
        else { const i = pickAnswer(ans, opts); if (i >= 0) correct = isTrue(opts[i].text) ? 0 : 1; }
      }
      const unsure = correct < 0;
      if (unsure) { warnings.push('Not marked True or False — set it in the editor'); correct = 0; }
      return { ...base, type: 'tf', correct, unsure, warnings };
    }
    // No answers listed: a slider (a number with a range) or a typed answer
    if (!opts.length) {
      const a = ans != null ? clean(ans) : '';
      const numAns = a.match(/^(-?[\d.,\s]+?)\s*([^\d\s].*)?$/);
      const value = numAns ? num(numAns[1]) : null;
      if (type === 'slider' || (value !== null && (meta.min != null || meta.max != null))) {
        let min = num(meta.min), max = num(meta.max);
        const unit = clean(meta.unit || (numAns && numAns[2]) || '').slice(0, 12);
        if (value === null) warnings.push('No right number found — set it in the editor');
        const v = value ?? 50;
        if (min === null || max === null || min >= max) {   // no usable range: one around the answer
          const span = Math.max(10, Math.abs(v) || 10);
          min = min ?? Math.floor(v - span); max = max ?? Math.ceil(v + span);
          if (min >= max) max = min + 10;
          warnings.push('No range given — check From and To');
        }
        const step = num(meta.step) || (Number.isInteger(v) && Number.isInteger(min) && Number.isInteger(max) ? 1 : 0.1);
        const margin = { exact: 'exact', '0': 'exact', '5': 'low', '5%': 'low', low: 'low', '10': 'medium', '10%': 'medium', medium: 'medium', '20': 'high', '20%': 'high', high: 'high' }[clean(meta.margin || '').replace(/^±/, '').toLowerCase()] || 'medium';
        return { ...base, type: 'slider', min, max, step, answer: Math.min(max, Math.max(min, v)), unit, margin, warnings };
      }
      const accepted = [...(a ? splitList(a) : []), ...(meta.accept ? splitList(meta.accept) : [])].map((s) => s.slice(0, 40));
      if (!accepted.length) warnings.push('No answer found — add one in the editor');
      if (accepted.length > 4) warnings.push(`Only the first 4 of ${accepted.length} accepted answers are kept`);
      return { ...base, type: 'type', accepted: [...accepted, '', '', '', ''].slice(0, 4), warnings };
    }
    // Quiz: 2–4 answers, one marked right
    let correct = opts.findIndex((o) => o.correct);
    if (correct < 0) correct = pickAnswer(ans, opts);
    if (opts.length > 4) {
      warnings.push(`Only the first 4 of ${opts.length} answers fit`);
      if (correct >= 4) { const keep = opts[correct]; opts = [...opts.slice(0, 3), keep]; correct = 3; } else opts = opts.slice(0, 4);
    }
    if (opts.length < 2) warnings.push('Needs at least 2 answers');
    if (opts.filter((o) => o.correct).length > 1) warnings.push('Several answers were marked right — the first is used');
    const unsure = correct < 0;
    if (unsure) { warnings.push('No right answer marked — pick it in the editor'); correct = 0; }
    return { ...base, type: 'quiz', unsure, answers: [...opts.map((o) => o.text.slice(0, 100)), '', '', '', ''].slice(0, 4), correct, warnings };
  }

  function build(parsed) {
    const out = [], skipped = [];
    // A lone first line with no answers, followed by real questions, is the quiz's title.
    const [first, ...rest] = parsed.raw;
    if (first && rest.length && !first.options.length && !Object.keys(first.meta).length && first.num == null && !parsed.key[1] && rest.some((c) => c.options.length || Object.keys(c.meta).length)) {
      parsed = { ...parsed, title: parsed.title || first.title, raw: rest, key: Object.fromEntries(Object.entries(parsed.key).map(([k, v]) => [k, v])) };
    }
    parsed.raw.forEach((c, i) => {
      const q = finish(c, i + 1, parsed.key);
      if (!q) return;
      if (q.skip) skipped.push(q); else out.push(q);
    });
    return { title: parsed.title, questions: out, skipped };
  }

  // A file → { title, questions, skipped }. Text-like files and pasted text go through the same parser.
  async function readFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx')) return build(await readXlsx(await file.arrayBuffer()));
    if (name.endsWith('.docx')) return build(await readDocx(await file.arrayBuffer()));
    if (/\.(xls|doc|pages|numbers|key|pdf|odt|ods|pptx?)$/.test(name)) {
      throw new Error(`${file.name}: this format can't be read here. Save it as .docx, .xlsx, .csv or .txt — or copy the text and paste it`);
    }
    const text = await file.text();
    if (name.endsWith('.json')) return build(parseJson(text));
    if (/\.(csv|tsv)$/.test(name)) return build(parseTable(parseDelimited(text)));
    return build(parseText(text));
  }
  const readText = (text) => {
    const t = String(text).trim();
    if (/^[[{]/.test(t)) { try { return build(parseJson(t)); } catch { /* not JSON after all */ } }
    // Pasted from a spreadsheet: tab-separated rows with a "Question" header
    const first = t.split('\n', 1)[0];
    if (first.split('\t').length >= 3 && /question/i.test(first)) return build(parseTable(parseDelimited(t)));
    return build(parseText(t));
  };
  const QUESTION_FILE = /\.(txt|md|markdown|text|csv|tsv|json|xlsx|docx)$/i;
  const IMAGE_FILE = /\.(jpe?g|png|gif|webp|avif|heic|heif|bmp)$/i;

  window.BlitzImport = { readFile, readText, QUESTION_FILE, IMAGE_FILE, _parseText: parseText, _finish: finish };
})();
