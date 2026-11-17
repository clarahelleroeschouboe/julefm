'use strict';
/* JULE FM – quizserver. Ingen eksterne pakker: kun Node 18+. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const PORT = +process.env.PORT || 3000;
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUB = path.join(__dirname, 'public');
fs.mkdirSync(DATA, { recursive: true });

let HOST_PW = process.env.HOST_PASSWORD;
if (!HOST_PW) {
  HOST_PW = crypto.randomBytes(3).toString('hex');
  console.log(`\n  ⚠  HOST_PASSWORD er ikke sat. Midlertidig quizmaster-kode: ${HOST_PW}\n`);
}

const now = () => Date.now();
const rid = (n = 8) => crypto.randomBytes(n).toString('hex');
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- Quiz-indhold ---------- */
let quiz = readJSON(path.join(DATA, 'quiz.json'), null) || readJSON(path.join(__dirname, 'quiz.default.json'), { title: 'JULE FM', settings: {}, rounds: [] });
const rounds = () => quiz.rounds || [];
const S = () => quiz.settings || {};

/* ---------- Spiltilstand ---------- */
const fresh = () => ({
  phase: 'lobby', paused: false, pausedAt: 0, roundIdx: 0, qIdx: 0, openedAt: 0, deadline: 0,
  twist: null, spin: 0, showBoard: false, banner: '', fx: { id: 0, type: '' },
  answers: {}, botPlans: {}, result: null, prevRank: {}, endedAt: 0, final: null, allAt: 0
});
let G = fresh(), players = {}, hostTokens = new Set();
const saved = readJSON(path.join(DATA, 'state.json'), null);
if (saved) {
  G = Object.assign(fresh(), saved.G || {});
  players = saved.players || {};
  hostTokens = new Set(saved.hostTokens || []);
  Object.values(players).forEach(p => { p.conn = 0; });
}
let saveT = null;
function saveSoon() {
  if (saveT) return;
  saveT = setTimeout(() => {
    saveT = null;
    try {
      const tmp = path.join(DATA, 'state.json.tmp');
      fs.writeFileSync(tmp, JSON.stringify({ G, players, hostTokens: [...hostTokens] }));
      fs.renameSync(tmp, path.join(DATA, 'state.json'));
    } catch (e) { console.error('save fejlede', e.message); }
  }, 800);
}

const R = () => rounds()[G.roundIdx];
const Q = () => R() && R().questions[G.qIdx];
const qTime = q => q.time || S().defaultTime || 20;
const qBase = q => q.points || S().baseQuestionPoints || 1000;
const stageSec = q => (q.clips && q.clips.length) ? (q.stageSec || Math.max(2, Math.round(qTime(q) / q.clips.length))) : 0;
const stageNow = (q, t) => (q.clips && q.clips.length) ? Math.min(q.clips.length - 1, Math.floor(Math.max(0, t - G.openedAt) / (stageSec(q) * 1000))) : 0;

const TWISTS = [
  { id: 'x2', label: 'DOBBELT OP', desc: 'Alle point tæller dobbelt', mult: 2 },
  { id: 'x3', label: 'TREDOBBELT', desc: 'Point ×3 – hold hovedet koldt', mult: 3 },
  { id: 'fast5', label: 'TOP 5 TAGER ALT', desc: 'Kun de 5 hurtigste rigtige får point (×2)', mult: 2 },
  { id: 'turbo', label: 'TURBO', desc: 'Hastighed tæller dobbelt', mult: 1 }
];

/* ---------- Hjælpere ---------- */
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'aa')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(the|a|en|et) /, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function textMatch(ans, accepted) {
  const a = norm(ans); if (!a) return false;
  for (const raw of accepted || []) {
    const c = norm(raw); if (!c) continue;
    if (a === c) return true;
    const tol = c.length <= 4 ? 0 : c.length <= 9 ? 1 : 2;
    if (lev(a, c) <= tol) return true;
    if (c.length >= 5 && (' ' + a + ' ').includes(' ' + c + ' ')) return true;
  }
  return false;
}
function clean(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); }

function newPlayer(name, team, bot) {
  const id = rid(5);
  players[id] = { id, name, team, token: rid(16), score: 0, joker: 1, streak: 0, bot: !!bot, conn: 0, joinedAt: now(), hist: [],
    stats: { n: 0, correct: 0, tSum: 0, tN: 0, ySum: 0, yN: 0, majority: 0, streakMax: 0, wagerNet: 0, jokerGain: 0, climb: 0 } };
  return players[id];
}
function uniqueName(name) {
  let n = name, i = 2;
  const taken = x => Object.values(players).some(p => p.name.toLowerCase() === x.toLowerCase());
  while (taken(n)) n = name.slice(0, 20) + ' ' + i++;
  return n;
}
function rankMap() {
  const arr = Object.values(players).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'da'));
  const m = {}; let last = null, rk = 0;
  arr.forEach((p, i) => { if (p.score !== last) { rk = i + 1; last = p.score; } m[p.id] = rk; });
  return { arr, m };
}
function teamBoard() {
  const m = {};
  for (const p of Object.values(players)) {
    const t = (p.team || '').trim(); if (!t) continue;
    const k = t.toLowerCase(); (m[k] = m[k] || { team: t, sum: 0, n: 0 }); m[k].sum += p.score; m[k].n++;
  }
  const arr = Object.values(m).map(x => ({ team: x.team, score: Math.round(x.sum / x.n), members: x.n })).sort((a, b) => b.score - a.score);
  arr.forEach((t, i) => { t.rank = i + 1; });
  return arr.length >= 2 ? arr : [];
}
function boardList(limit) {
  const { arr, m } = rankMap();
  return arr.slice(0, limit).map(p => ({ id: p.id, name: p.name, team: p.team, score: p.score, rank: m[p.id], prev: G.prevRank[p.id] || m[p.id], streak: p.streak, bot: p.bot }));
}
const live = () => Object.values(players).filter(p => p.bot || p.conn > 0);

function answerLabel(q, a) {
  if (!a) return '';
  const v = a.value, o = q.options || [];
  switch (q.type) {
    case 'choice': case 'tf': case 'vote': return o[v] != null ? o[v] : '';
    case 'wager': return (o[v] != null ? o[v] : '') + ' · satsede ' + (a.wager || 0);
    case 'order': return Array.isArray(v) ? v.map(i => o[i]).join(' → ') : '';
    default: return String(v);
  }
}
function correctText(q) {
  const o = q.options || [];
  switch (q.type) {
    case 'choice': case 'tf': case 'wager': return o[q.correct] != null ? o[q.correct] : '';
    case 'text': return (q.correct || [])[0] || '';
    case 'year': return String(q.correct);
    case 'order': return (q.correct || []).map(i => o[i]).join(' → ');
    case 'vote': return ((G.result && G.result.dist && G.result.dist.winners) || []).map(i => o[i]).join(' / ');
    default: return '';
  }
}
function wagerOpts(p) {
  const b = Math.max(1000, p.score), r = x => Math.max(0, Math.round(x / 50) * 50);
  return [...new Set([0, r(b * .25), r(b * .5), r(b)])];
}

/* ---------- Svar ---------- */
function validate(q, raw, p) {
  const o = q.options || [], n = o.length;
  switch (q.type) {
    case 'choice': case 'tf': case 'vote': { const v = +raw.value; return Number.isInteger(v) && v >= 0 && v < n ? { value: v } : null; }
    case 'wager': {
      const v = +raw.value, w = +raw.wager;
      if (!(Number.isInteger(v) && v >= 0 && v < n)) return null;
      if (!wagerOpts(p).includes(w)) return null;
      return { value: v, wager: w };
    }
    case 'text': { const v = clean(raw.value, 60); return v ? { value: v } : null; }
    case 'year': { const v = Math.round(+raw.value); return Number.isFinite(v) && v >= 1000 && v <= 2100 ? { value: v } : null; }
    case 'order': {
      const v = raw.value;
      if (!Array.isArray(v) || v.length !== n) return null;
      const s = new Set(v.map(Number));
      return s.size === n && [...s].every(i => Number.isInteger(i) && i >= 0 && i < n) ? { value: v.map(Number) } : null;
    }
  }
  return null;
}
function submit(pid, raw, bypassClock) {
  const p = players[pid], q = Q();
  if (!p || !q) return { error: 'ukendt' };
  if (G.phase !== 'open' || G.paused) return { error: 'lukket' };
  if (!bypassClock && now() > G.deadline + 400) return { error: 'for sent' };
  if (raw.qid !== q.id) return { error: 'gammelt spørgsmål' };
  if (G.answers[pid]) return { error: 'allerede svaret' };
  const v = validate(q, raw, p);
  if (!v) return { error: 'ugyldigt svar' };
  const t = now();
  G.answers[pid] = { value: v.value, wager: v.wager || 0, t: Math.max(0, t - G.openedAt), stage: stageNow(q, t), joker: !!raw.joker && p.joker > 0 && q.type !== 'wager' };
  queue();
  return { ok: true };
}

/* ---------- Point ---------- */
function twistMult() { const t = G.twist && TWISTS.find(x => x.id === G.twist); return t ? t.mult : 1; }
function scoreQuestion() {
  const q = Q(), r = R(), base = qBase(q), total = qTime(q) * 1000, o = q.options || [];
  const mult = (r.multiplier || 1) * twistMult();
  const res = { per: {}, dist: {}, fastest: [] };
  const { m: before } = rankMap(); G.prevRank = before;
  const ans = Object.entries(G.answers).filter(([id]) => players[id]);
  let winners = [];
  if (q.type === 'vote') {
    const c = o.map(() => 0); ans.forEach(([, a]) => c[a.value]++);
    const used = c.filter(x => x > 0);
    const target = q.mode === 'minority' ? Math.min(...used) : Math.max(...used);
    winners = used.length > 1 || q.mode !== 'minority' ? c.map((x, i) => x === target && x > 0 ? i : -1).filter(i => i >= 0) : c.map((x, i) => x > 0 ? i : -1).filter(i => i >= 0);
  }
  const rows = [];
  for (const [id, a] of ans) {
    const p = players[id]; let frac = 0, full = false;
    switch (q.type) {
      case 'choice': case 'tf': case 'wager': frac = a.value === q.correct ? 1 : 0; full = frac === 1; break;
      case 'text': frac = textMatch(a.value, q.correct) ? 1 : 0; full = frac === 1; break;
      case 'year': { const d = Math.abs(a.value - q.correct), tol = q.yearTolerance || 12; frac = Math.max(0, 1 - d / tol); full = d === 0; p.stats.ySum += d; p.stats.yN++; res.per[id] = { diff: d }; break; }
      case 'order': { const hits = a.value.filter((v, i) => v === q.correct[i]).length; frac = hits / o.length; full = hits === o.length; break; }
      case 'vote': frac = winners.includes(a.value) ? 1 : 0; full = frac === 1; if (full) p.stats.majority++; break;
    }
    rows.push({ id, a, p, frac, full });
  }
  const speedy = ['choice', 'tf', 'text'].includes(q.type) && q.scoring !== 'flat';
  const tw = G.twist;
  rows.forEach(x => {
    const { id, a, p, frac, full } = x; let pts = 0, bonus = 0;
    if (q.type === 'wager') {
      pts = frac ? a.wager : -a.wager; p.stats.wagerNet += pts;
    } else if (frac > 0) {
      const rem = 1 - Math.min(1, a.t / total);
      const mix = speedy ? (tw === 'turbo' ? 0.4 + 0.6 * rem : 0.7 + 0.3 * rem) : 1;
      const st = q.clips && q.clips.length ? Math.max(0.3, 1 - 0.23 * a.stage) : 1;
      pts = Math.round(base * frac * mix * st) * mult;
      x.pre = pts;
    }
    x.pts = pts; x.bonus = bonus;
  });
  if (tw === 'fast5') {
    rows.filter(x => x.pts > 0).sort((a, b) => a.a.t - b.a.t).forEach((x, i) => { if (i >= 5) { x.pts = 0; x.out = true; } });
  }
  rows.forEach(x => {
    const { id, a, p, full } = x; const old = p.score;
    p.stats.n++;
    if (x.frac > 0 && q.type !== 'wager' && x.pts > 0 && a.joker) { const g = x.pts; x.pts *= 2; p.stats.jokerGain += g; }
    if (a.joker) p.joker = Math.max(0, p.joker - 1);
    if (q.type !== 'wager' && q.type !== 'vote') {
      if (full) { p.streak++; p.stats.streakMax = Math.max(p.stats.streakMax, p.streak); if (p.streak >= 3 && x.pts > 0) x.bonus = Math.min(250, (p.streak - 2) * 50); }
      else p.streak = 0;
    }
    if (full) { p.stats.correct++; if (['choice', 'tf', 'text'].includes(q.type)) { p.stats.tSum += a.t; p.stats.tN++; } }
    p.score = Math.max(0, p.score + x.pts + x.bonus);
    res.per[id] = Object.assign(res.per[id] || {}, { pts: p.score - old, bonus: x.bonus, correct: full ? true : (x.frac > 0 ? 'partial' : false), out: !!x.out, t: a.t, stage: a.stage, joker: a.joker, view: answerLabel(q, a) });
  });
  for (const p of Object.values(players)) if (!G.answers[p.id] || !players[p.id]) { if (!G.answers[p.id]) { p.streak = 0; res.per[p.id] = { pts: 0, bonus: 0, correct: false, none: true }; } }

  /* statistik til skærmen */
  if (['choice', 'tf', 'vote', 'wager'].includes(q.type)) { res.dist.counts = o.map(() => 0); ans.forEach(([, a]) => res.dist.counts[a.value]++); if (q.type === 'vote') res.dist.winners = winners; }
  if (q.type === 'text') {
    const m = {}; ans.forEach(([, a]) => { const k = norm(a.value); m[k] = m[k] || { text: a.value, n: 0, ok: textMatch(a.value, q.correct) }; m[k].n++; });
    res.dist.texts = Object.values(m).sort((a, b) => b.n - a.n).slice(0, 8);
  }
  if (q.type === 'year') {
    const vals = ans.map(([, a]) => a.value); res.dist.guesses = vals.sort((a, b) => a - b);
    res.dist.avg = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  }
  if (q.type === 'order') res.dist.perfect = rows.filter(x => x.full).length;
  res.dist.answered = ans.length;
  res.fastest = rows.filter(x => x.full && x.pts > 0).sort((a, b) => a.a.t - b.a.t).slice(0, 3).map(x => ({ name: x.p.name, t: x.a.t }));
  G.result = res;
}

/* ---------- Faseskift ---------- */
function allAnswered() { const l = live(); return l.length > 0 && l.every(p => G.answers[p.id]); }
function planBots() {
  const q = Q(); G.botPlans = {}; if (!q) return;
  const total = qTime(q) * 1000, o = q.options || [];
  for (const p of Object.values(players)) {
    if (!p.bot) continue;
    const good = Math.random() < 0.55; let value, wager = 0;
    switch (q.type) {
      case 'choice': case 'tf': value = good ? q.correct : Math.floor(Math.random() * o.length); break;
      case 'vote': value = Math.random() < .6 ? 0 : Math.floor(Math.random() * o.length); break;
      case 'wager': value = good ? q.correct : Math.floor(Math.random() * o.length); wager = wagerOpts(p)[Math.floor(Math.random() * 4) % wagerOpts(p).length]; break;
      case 'year': value = Math.round(q.correct + (Math.random() - .5) * 2 * (good ? 4 : 22)); break;
      case 'order': { const idx = o.map((_, i) => i); value = good ? q.correct.slice() : shuffle(idx); break; }
      case 'text': value = good ? (q.correct || ['?'])[0] : ['aner det ikke', 'wonderwall?', 'jul i svinget', 'mariah'][Math.floor(Math.random() * 4)]; break;
    }
    G.botPlans[p.id] = { at: Math.round((0.12 + Math.random() * 0.7) * total), value, wager, joker: p.joker > 0 && Math.random() < .12 };
  }
}
function runBots(t) {
  const q = Q(); if (!q) return;
  for (const [id, pl] of Object.entries(G.botPlans || {})) {
    if (!players[id] || G.answers[id]) continue;
    if (t - G.openedAt >= pl.at) submit(id, { qid: q.id, value: pl.value, wager: pl.wager, joker: pl.joker }, true);
  }
}
function openQuestion() {
  const q = Q(); G.answers = {}; G.result = null; G.allAt = 0;
  G.openedAt = now(); G.deadline = G.openedAt + qTime(q) * 1000; G.phase = 'open'; G.paused = false;
  planBots();
}
function lock() { if (G.phase === 'open') { G.phase = 'locked'; G.paused = false; queue(); } }
function endRound() {
  const { m } = rankMap();
  for (const p of Object.values(players)) {
    const h = p.hist; if (h.length) p.stats.climb = Math.max(p.stats.climb, h[h.length - 1] - m[p.id]);
    h.push(m[p.id]);
  }
}
function finalize() {
  const { arr, m } = rankMap(); const assigned = {};
  const defs = [
    { id: 'speed', emoji: '⚡', title: 'Lynhurtig', desc: 'Hurtigste fingre i lokalet', val: p => p.stats.tN >= 4 ? p.stats.tSum / p.stats.tN : null, low: true },
    { id: 'sniper', emoji: '🎯', title: 'Skarpskytten', desc: 'Højeste træfsikkerhed', val: p => p.stats.n >= 8 ? p.stats.correct / p.stats.n : null },
    { id: 'time', emoji: '⏳', title: 'Tidsrejsende', desc: 'Bedste fornemmelse for årstal', val: p => p.stats.yN >= 3 ? p.stats.ySum / p.stats.yN : null, low: true },
    { id: 'herd', emoji: '🐑', title: 'Flokkens Hyrde', desc: 'Altid med flertallet', val: p => p.stats.majority >= 2 ? p.stats.majority : null },
    { id: 'streak', emoji: '🔥', title: 'Ildsjælen', desc: 'Længste stime af rigtige svar', val: p => p.stats.streakMax >= 3 ? p.stats.streakMax : null },
    { id: 'gamble', emoji: '🎲', title: 'Storspilleren', desc: 'Vandt mest på finalens væddemål', val: p => p.stats.wagerNet > 0 ? p.stats.wagerNet : null },
    { id: 'climb', emoji: '🚀', title: 'Raketten', desc: 'Største comeback i stillingen', val: p => p.stats.climb >= 3 ? p.stats.climb : null },
    { id: 'joker', emoji: '🃏', title: 'Joker-Magikeren', desc: 'Fik mest ud af sin joker', val: p => p.stats.jokerGain > 0 ? p.stats.jokerGain : null },
    { id: 'bust', emoji: '💸', title: 'Kasino-Konkurs', desc: 'Tabte mest på væddemålet', val: p => p.stats.wagerNet < 0 ? -p.stats.wagerNet : null }
  ];
  if (arr[0]) assigned[arr[0].id] = { emoji: '👑', title: 'JULEMESTER', desc: 'Vinder af hele molevitten' };
  for (const d of defs) {
    let best = null, bv = null;
    for (const p of arr) { if (assigned[p.id]) continue; const v = d.val(p); if (v == null) continue; if (bv == null || (d.low ? v < bv : v > bv)) { best = p; bv = v; } }
    if (best) assigned[best.id] = { emoji: d.emoji, title: d.title, desc: d.desc };
  }
  const last = arr[arr.length - 1];
  if (last && !assigned[last.id] && arr.length > 3) assigned[last.id] = { emoji: '🥴', title: 'Hyggens Hersker', desc: 'Kom for stemningen – og den leverede du' };
  const fb = [['🕺', 'Dansegulvets Sjæl', 'Aldrig stille et sekund'], ['🎄', 'Stemningsmageren', 'Gjorde aftenen bedre'], ['🍚', 'Risalamande-Eksperten', 'Fandt sikkert mandlen'], ['🥂', 'Hyggedirektøren', 'Kan altid smage på glöggen'], ['🎧', 'Nisse med Næse for Hits', 'Hørte mere end de fleste']];
  let i = 0; for (const p of arr) if (!assigned[p.id]) { const f = fb[i++ % fb.length]; assigned[p.id] = { emoji: f[0], title: f[1], desc: f[2] }; }
  G.final = { badges: assigned };
  endRound();
}
function nextAfterReveal() {
  const r = R();
  G.answers = {}; G.result = null; G.twist = null; G.showBoard = false;
  if (G.qIdx + 1 < r.questions.length) { G.qIdx++; G.phase = 'ready'; return; }
  if (G.roundIdx + 1 >= rounds().length) { finalize(); G.phase = 'ended'; G.endedAt = now(); G.fx = { id: G.fx.id + 1, type: 'win' }; return; }
  endRound(); G.phase = 'scoreboard';
}

/* ---------- Quizmaster-handlinger ---------- */
function doAction(a) {
  const t = now();
  switch (a.action) {
    case 'next': {
      if (G.paused && G.phase !== 'open') G.paused = false;
      switch (G.phase) {
        case 'lobby': if (!rounds().length) return { error: 'Ingen runder' }; G.roundIdx = 0; G.qIdx = 0; G.phase = 'round_intro'; break;
        case 'round_intro': G.qIdx = 0; G.phase = 'ready'; G.twist = null; break;
        case 'ready': openQuestion(); break;
        case 'open': lock(); break;
        case 'locked': scoreQuestion(); G.phase = 'reveal'; G.fx = { id: G.fx.id + 1, type: 'reveal' }; break;
        case 'reveal': nextAfterReveal(); break;
        case 'scoreboard': G.roundIdx++; G.qIdx = 0; G.phase = 'round_intro'; break;
        default: return { error: 'Ingen næste' };
      }
      break;
    }
    case 'goto': {
      const r = clamp(+a.r | 0, 0, rounds().length - 1), qn = +a.q;
      G.roundIdx = r; G.answers = {}; G.result = null; G.twist = null; G.paused = false; G.showBoard = false;
      if (qn >= 0 && R().questions[qn]) { G.qIdx = qn; G.phase = 'ready'; } else { G.qIdx = 0; G.phase = 'round_intro'; }
      break;
    }
    case 'pause': if (G.paused) return { ok: true }; G.paused = true; G.pausedAt = t; break;
    case 'resume': if (!G.paused) return { ok: true }; { const d = t - G.pausedAt; if (G.phase === 'open') { G.openedAt += d; G.deadline += d; } G.paused = false; } break;
    case 'extend': if (G.phase === 'open') G.deadline += clamp(+a.sec || 10, 1, 120) * 1000; break;
    case 'spin': {
      const q = Q(); if (!q || !['ready', 'open'].includes(G.phase)) return { error: 'Kun før/under spørgsmål' };
      const tw = TWISTS[Math.floor(Math.random() * TWISTS.length)]; G.twist = tw.id; G.spin++; G.fx = { id: G.fx.id + 1, type: 'spin' };
      break;
    }
    case 'cleartwist': G.twist = null; break;
    case 'board': G.showBoard = !G.showBoard; break;
    case 'banner': G.banner = clean(a.text, 80); break;
    case 'confetti': G.fx = { id: G.fx.id + 1, type: 'confetti' }; break;
    case 'adjust': { const p = players[a.pid]; if (!p) return { error: 'ukendt spiller' }; const d = Math.round(+a.delta) || 0; p.score = Math.max(0, p.score + d); if (G.result && G.result.per[p.id]) G.result.per[p.id].pts += d; break; }
    case 'flip': {
      const p = players[a.pid], q = Q(); if (!p || !q || G.phase !== 'reveal' || !G.result) return { error: 'Kun under afsløring' };
      const per = G.result.per[p.id] || (G.result.per[p.id] = { pts: 0, none: true });
      const base = qBase(q) * ((R().multiplier || 1) * twistMult());
      if (per.correct === true) { p.score = Math.max(0, p.score - per.pts); per.pts = 0; per.correct = false; }
      else { p.score += base; per.pts = (per.pts || 0) + base; per.correct = true; per.manual = true; }
      break;
    }
    case 'kick': { const p = players[a.pid]; if (!p) return { error: 'ukendt' }; delete players[a.pid]; delete G.answers[a.pid]; for (const c of clients) if (c.pid === a.pid) { try { c.res.end(); } catch {} } break; }
    case 'bots': {
      const names = ['Bot-Bent', 'Mariah Karrysovs', 'Nisse-Niels', 'Glögg-Gitte', 'Wham-Henning', 'Rudolf Rød', 'Risalamande-Rie', 'Kong Kaj', 'Jingle-Jens', 'Tinsel-Tina', 'Pebernød-Pia', 'DJ Mandel', 'Snemand Svend', 'Kanelsnurre', 'Hyggehans', 'Mettes Mikrofon', 'Skinke-Søren', 'Æbleskive-Ane', 'Lucia-Lars', 'Flæskesteg-Flemming'];
      const n = clamp(+a.n || 10, 1, 60), sh = shuffle(names);
      for (let i = 0; i < n; i++) { const p = newPlayer(uniqueName(sh[i % sh.length]), i % 3 === 0 ? 'Bord ' + (1 + (i % 5)) : '', true); p.score = G.phase === 'lobby' ? 0 : Math.round(Math.random() * 2500 / 50) * 50; }
      break;
    }
    case 'rmbots': for (const p of Object.values(players)) if (p.bot) { delete players[p.id]; delete G.answers[p.id]; } break;
    case 'reset': {
      const keep = a.mode !== 'all'; const ht = hostTokens; const q = quiz; G = fresh();
      if (keep) for (const p of Object.values(players)) { p.score = 0; p.joker = 1; p.streak = 0; p.hist = []; p.stats = { n: 0, correct: 0, tSum: 0, tN: 0, ySum: 0, yN: 0, majority: 0, streakMax: 0, wagerNet: 0, jokerGain: 0, climb: 0 }; }
      else players = {};
      hostTokens = ht; quiz = q; break;
    }
    default: return { error: 'Ukendt handling' };
  }
  queue();
  return { ok: true };
}

/* ---------- Snapshots ---------- */
function pubQ(q) {
  return { id: q.id, type: q.type, prompt: q.prompt, emoji: q.emoji || '', options: q.options || [], time: qTime(q), idx: G.qIdx + 1, of: R().questions.length,
    song: !!q.song, clips: q.clips ? q.clips.length : 0, stageSec: stageSec(q), mystery: !!q.mystery, mode: q.mode || '', hint: q.hint || '', points: qBase(q),
    yearMin: q.yearMin || 1950, yearMax: q.yearMax || 2025, scoring: q.scoring || '' };
}
function snapBase() {
  const r = R(), q = Q(), ph = G.phase;
  const s = { now: now(), title: quiz.title || 'JULE FM', subtitle: quiz.subtitle || '', phase: ph, paused: G.paused, deadline: G.deadline, openedAt: G.openedAt,
    showBoard: G.showBoard, banner: G.banner, fx: G.fx, playerCount: Object.keys(players).length, liveCount: live().length, teamsEnabled: S().teamsEnabled !== false,
    spin: G.spin, twist: G.twist ? TWISTS.find(x => x.id === G.twist) : null, endedAt: G.endedAt, roundCount: rounds().length };
  if (r && ph !== 'lobby') s.round = { idx: G.roundIdx + 1, total: rounds().length, emoji: r.emoji, title: r.title, blurb: r.blurb || '', multiplier: r.multiplier || 1, qCount: r.questions.length };
  if (q && ['ready', 'open', 'locked', 'reveal'].includes(ph)) {
    s.q = pubQ(q);
    s.count = { answered: Object.keys(G.answers).length, total: live().length };
    if (ph === 'open' || ph === 'locked') s.stage = stageNow(q, ph === 'locked' ? G.deadline : now());
    if (ph === 'reveal' && G.result) {
      s.reveal = { correct: q.type === 'vote' ? null : (q.correct == null ? null : q.correct), correctText: correctText(q), song: q.song ? { title: q.song.title, artist: q.song.artist, album: q.song.album || '', cover: q.song.cover || '', year: q.song.year || '' } : null,
        fact: q.fact || '', dist: G.result.dist, fastest: G.result.fastest };
    }
  }
  if (['lobby'].includes(ph)) s.lobby = Object.values(players).slice(-80).map(p => p.name);
  if (['reveal', 'scoreboard', 'ended'].includes(ph) || G.showBoard) { s.board = boardList(ph === 'ended' ? 40 : 15); s.teams = teamBoard(); }
  if (ph === 'ended' && G.final) s.badges = G.final.badges;
  return s;
}
function snapPublic() { return snapBase(); }
function snapPlayer(pid) {
  const s = snapBase(), p = players[pid];
  if (!p) { s.me = null; return s; }
  const { m, arr } = rankMap(), q = Q();
  const me = { id: p.id, name: p.name, team: p.team, score: p.score, rank: m[p.id], of: arr.length, joker: p.joker, streak: p.streak };
  const a = G.answers[pid]; if (a && G.phase !== 'ready') me.answer = { value: a.value, joker: a.joker, wager: a.wager };
  if (q && q.type === 'wager') me.wagerOpts = wagerOpts(p);
  if (G.phase === 'reveal' && G.result) me.last = G.result.per[pid] || null;
  const i = arr.findIndex(x => x.id === pid);
  if (i > 0) me.gapUp = { name: arr[i - 1].name, gap: arr[i - 1].score - p.score };
  if (G.phase === 'ended' && G.final) me.badge = G.final.badges[pid] || null;
  s.me = me; return s;
}
function snapHost() {
  const s = snapBase(), q = Q(), { arr, m } = rankMap();
  s.host = true;
  s.settings = S();
  s.quizMeta = rounds().map(r => ({ emoji: r.emoji, title: r.title, qs: r.questions.map(x => ({ type: x.type, prompt: String(x.prompt || '').slice(0, 60) })) }));
  s.roundIdx = G.roundIdx; s.qIdx = G.qIdx;
  s.players = arr.map(p => ({ id: p.id, name: p.name, team: p.team, score: p.score, rank: m[p.id], conn: p.conn > 0, bot: p.bot, joker: p.joker, streak: p.streak, answered: !!G.answers[p.id] }));
  if (q) {
    s.fullQ = q;
    s.answers = Object.entries(G.answers).filter(([id]) => players[id]).map(([id, a]) => ({ id, name: players[id].name, view: answerLabel(q, a), t: a.t, stage: a.stage, joker: a.joker, bot: players[id].bot }));
    if (G.result) s.results = G.result.per;
    if (!s.reveal && G.result) s.reveal = { correctText: correctText(q), dist: G.result.dist };
    s.liveDist = (['choice', 'tf', 'vote', 'wager'].includes(q.type)) ? (q.options || []).map((_, i) => Object.values(G.answers).filter(a => a.value === i).length) : null;
    s.stageNow = stageNow(q, G.phase === 'open' ? now() : G.deadline);
    s.nextQ = (R().questions[G.qIdx + 1] || null) && { prompt: R().questions[G.qIdx + 1].prompt, song: R().questions[G.qIdx + 1].song || null };
  }
  s.twists = TWISTS;
  return s;
}

/* ---------- SSE ---------- */
const clients = new Set();
function send(c) {
  let s;
  try { s = JSON.stringify(c.role === 'host' ? snapHost() : c.role === 'player' ? snapPlayer(c.pid) : snapPublic()); } catch (e) { console.error(e); return; }
  try { c.res.write('data: ' + s + '\n\n'); } catch { clients.delete(c); }
}
let qt = null;
function queue() { if (qt) return; qt = setTimeout(() => { qt = null; for (const c of clients) send(c); saveSoon(); }, 40); }
setInterval(() => { for (const c of clients) { try { c.res.write(': hb\n\n'); } catch {} } }, 15000);
setInterval(() => { for (const c of clients) send(c); }, 20000);
setInterval(() => {
  if (G.phase !== 'open' || G.paused) return;
  const t = now();
  if (t >= G.deadline) return lock();
  runBots(t);
  if (allAnswered()) { if (!G.allAt) G.allAt = t; else if (t - G.allAt > 1300 && S().autoLock !== false) lock(); }
}, 200);

/* ---------- HTTP ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const ROUTES = { '/': 'player.html', '/tv': 'tv.html', '/host': 'host.html' };
function serveStatic(req, res, p) {
  let f = ROUTES[p] || p.slice(1);
  const full = path.normalize(path.join(PUB, f));
  if (!full.startsWith(PUB) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end('Ikke fundet'); }
  const ext = path.extname(full);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
  fs.createReadStream(full).pipe(res);
}
function body(req, limit = 100000) {
  return new Promise((resolve, reject) => {
    let d = '', n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { reject(new Error('for stor')); req.destroy(); } else d += c; });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { reject(new Error('ugyldig JSON')); } });
    req.on('error', reject);
  });
}
const json = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
const hostOK = (req, url) => { const t = req.headers['x-host-token'] || url.searchParams.get('token') || ''; return t && hostTokens.has(t); };
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const attempts = new Map();

function validateQuiz(z) {
  if (!z || typeof z !== 'object' || !Array.isArray(z.rounds)) return 'Mangler runder';
  const types = ['choice', 'tf', 'text', 'year', 'order', 'vote', 'wager'];
  const ids = new Set();
  for (const r of z.rounds) {
    if (!r.id) r.id = 'r' + rid(3);
    if (!Array.isArray(r.questions)) r.questions = [];
    for (const q of r.questions) {
      if (!q.id || ids.has(q.id)) q.id = 'q' + rid(4);
      ids.add(q.id);
      if (!types.includes(q.type)) return 'Ukendt spørgsmålstype: ' + q.type;
      if (['choice', 'tf', 'vote', 'order', 'wager'].includes(q.type) && (!Array.isArray(q.options) || q.options.length < 2)) return 'Spørgsmål "' + (q.prompt || '?') + '" har for få svarmuligheder';
    }
  }
  z.settings = z.settings || {};
  return null;
}

async function api(req, res, url) {
  const p = url.pathname, ip = req.socket.remoteAddress;
  if (p === '/api/health') return json(res, 200, { ok: true, players: Object.keys(players).length, phase: G.phase });

  if (p === '/api/join' && req.method === 'POST') {
    const b = await body(req);
    if (b.pid && b.token && players[b.pid] && players[b.pid].token === b.token) return json(res, 200, { pid: b.pid, token: b.token, name: players[b.pid].name });
    let name = clean(b.name, 22); if (!name) return json(res, 400, { error: 'Skriv et navn' });
    if (Object.keys(players).length >= 150) return json(res, 400, { error: 'Fuldt hus' });
    const pl = newPlayer(uniqueName(name), S().teamsEnabled === false ? '' : clean(b.team, 20), false);
    queue(); return json(res, 200, { pid: pl.id, token: pl.token, name: pl.name });
  }
  if (p === '/api/answer' && req.method === 'POST') {
    const b = await body(req), pl = players[b.pid];
    if (!pl || pl.token !== b.token) return json(res, 401, { error: 'ikke logget ind' });
    const r = submit(b.pid, b, false); return json(res, r.ok ? 200 : 409, r);
  }
  if (p === '/api/host/login' && req.method === 'POST') {
    const a = attempts.get(ip) || { n: 0, t: now() }; if (now() - a.t > 60000) { a.n = 0; a.t = now(); }
    if (a.n >= 8) return json(res, 429, { error: 'For mange forsøg – vent et minut' });
    const b = await body(req);
    if (!crypto.timingSafeEqual(sha(b.password || ''), sha(HOST_PW))) { a.n++; attempts.set(ip, a); return json(res, 401, { error: 'Forkert kode' }); }
    const tok = rid(24); hostTokens.add(tok); saveSoon(); return json(res, 200, { token: tok });
  }
  if (p.startsWith('/api/host/')) {
    if (!hostOK(req, url)) return json(res, 401, { error: 'Kun for quizmasteren' });
    if (p === '/api/host/action' && req.method === 'POST') { const r = doAction(await body(req)); return json(res, r.error ? 400 : 200, r); }
    if (p === '/api/host/quiz' && req.method === 'GET') return json(res, 200, quiz);
    if (p === '/api/host/quiz' && req.method === 'PUT') {
      const z = await body(req, 2000000), err = validateQuiz(z); if (err) return json(res, 400, { error: err });
      quiz = z; fs.writeFileSync(path.join(DATA, 'quiz.json'), JSON.stringify(quiz, null, 1));
      if (G.roundIdx >= rounds().length || !Q() && !['lobby', 'round_intro', 'scoreboard', 'ended'].includes(G.phase)) { G = Object.assign(fresh(), {}); }
      queue(); return json(res, 200, { ok: true });
    }
    if (p === '/api/host/quiz-default' && req.method === 'POST') {
      quiz = readJSON(path.join(__dirname, 'quiz.default.json'), quiz); try { fs.unlinkSync(path.join(DATA, 'quiz.json')); } catch {}
      G = fresh(); queue(); return json(res, 200, { ok: true });
    }
  }
  if (p === '/api/stream') {
    const role = url.searchParams.get('role') || 'tv', pid = url.searchParams.get('pid');
    if (role === 'host' && !hostOK(req, url)) return json(res, 401, { error: 'Kun for quizmasteren' });
    if (role === 'player' && !(players[pid] && players[pid].token === url.searchParams.get('token'))) return json(res, 401, { error: 'ikke logget ind' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 1500\n\n');
    const c = { res, role: role === 'host' || role === 'player' ? role : 'tv', pid };
    clients.add(c); if (c.pid && players[c.pid]) players[c.pid].conn++;
    send(c); queue();
    req.on('close', () => { clients.delete(c); const pl = players[c.pid]; if (pl) { pl.conn = Math.max(0, pl.conn - 1); queue(); } });
    return;
  }
  json(res, 404, { error: 'ukendt endpoint' });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    serveStatic(req, res, url.pathname);
  } catch (e) {
    if (!res.headersSent) json(res, 400, { error: e.message }); else res.end();
  }
}).listen(PORT, () => console.log(`JULE FM kører på port ${PORT}\n  Spillere: /\n  Storskærm: /tv\n  Quizmaster: /host`));
process.on('SIGTERM', () => { try { fs.writeFileSync(path.join(DATA, 'state.json'), JSON.stringify({ G, players, hostTokens: [...hostTokens] })); } catch {} process.exit(0); });
