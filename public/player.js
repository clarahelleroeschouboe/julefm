/* JULE FM – spillervisning (telefon) */
const main = $('#main');
let sess = null, S = null, conn = null, viewKey = '', U = {}, sending = false, lastFx = -1;
try { sess = JSON.parse(localStorage.getItem('jf_sess') || 'null'); } catch {}
const saveSess = () => { try { localStorage.setItem('jf_sess', JSON.stringify(sess)); } catch {} };
const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = (arr, seed) => arr[hash(seed) % arr.length];
const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2400); }

/* ---------- Join ---------- */
function showJoin(msg) {
  viewKey = 'join'; $('#top').hidden = true; $('#tbar').hidden = true; applyTheme('night'); snow(true);
  let last = {}; try { last = JSON.parse(localStorage.getItem('jf_last') || '{}'); } catch {}
  main.innerHTML = `
    <div class="center">
      <div class="onair rise">On air</div>
      <h1 class="h-xl t-xl rise" style="animation-delay:.05s">JULE<br><span class="logo"><i>FM</i></span></h1>
      <div class="dial rise" style="animation-delay:.1s"></div>
      <p class="rise" style="animation-delay:.15s;opacity:.8;font-size:1.05rem">Danmarks mest innovative radiostation sender live fra Kitchens julefrokost. Hvem er du i æteren?</p>
      ${msg ? `<div class="chip red">${esc(msg)}</div>` : ''}
      <input class="field rise" id="jn" maxlength="22" placeholder="Dit navn eller kælenavn" autocomplete="off" value="${esc(last.name || '')}" style="animation-delay:.2s">
      <input class="field rise" id="jt" maxlength="20" placeholder="Hold" autocomplete="off" value="${esc(last.team || '')}" style="animation-delay:.25s">
      <button class="btn rise" id="jgo" style="animation-delay:.3s">Gå live 📻</button>
      <div id="jerr" class="kicker" style="color:var(--no)"></div>
    </div>`;
  const go = async () => {
    const name = $('#jn').value.trim(), team = $('#jt').value.trim();
    if (!name) { $('#jerr').textContent = 'Skriv et navn først'; $('#jn').focus(); return; }
    $('#jgo').disabled = true;
    const r = await post('/api/join', { name, team }).catch(() => ({ error: 'Ingen forbindelse' }));
    $('#jgo').disabled = false;
    if (!r.pid) { $('#jerr').textContent = r.error || 'Noget gik galt'; return; }
    sess = { pid: r.pid, token: r.token, name: r.name, team };
    saveSess(); try { localStorage.setItem('jf_last', JSON.stringify({ name, team })); } catch {}
    start();
  };
  $('#jgo').onclick = go; $('#jn').onkeydown = $('#jt').onkeydown = e => { if (e.key === 'Enter') go(); };
}

/* ---------- Forbindelse ---------- */
async function rejoin(reason) {
  if (!sess) return;
  try {
    const r = await post('/api/join', { pid: sess.pid, token: sess.token, name: sess.name, team: sess.team });
    if (r.pid) { if (r.pid !== sess.pid) { sess = { pid: r.pid, token: r.token, name: r.name, team: sess.team }; saveSess(); toast('Du er tilmeldt igen – dine point blev nulstillet af serveren'); } }
  } catch {}
}
function start() {
  conn && conn.close(); $('#top').hidden = false;
  conn = connect({
    params: () => ({ role: 'player', pid: sess.pid, token: sess.token }),
    onState, onFatal: rejoin,
    onStatus: ok => { $('#dot').classList.toggle('off', !ok); $('#off').hidden = ok; }
  });
}
runTimer($('#tbar'), () => S && S.phase === 'open' && !S.paused && !(S.me && S.me.answer) ? S : null);
setInterval(() => { const e = $('#secs'); if (e && S && S.phase === 'open') e.textContent = secsLeft(S); }, 250);

function onState(s) {
  if (s.me === null) { rejoin(); }
  S = s; applyTheme(themeFor(s)); snow(['lobby', 'ended'].includes(s.phase));
  const me = s.me;
  if (me) { $('#rankchip').textContent = me.rank ? `#${me.rank}` : ''; const sc = $('#scorechip'); if (+sc.dataset.v !== me.score) { const from = +sc.dataset.v || 0; sc.dataset.v = me.score; if (s.phase === 'reveal') countUp(sc, me.score, 1200, from); else sc.textContent = fmt(me.score); } }
  $('#top .chip:nth-child(2)').hidden = !me;
  // banner + pause
  let b = $('.banner'); if (s.banner) { if (!b) { b = document.createElement('div'); b.className = 'banner'; b.innerHTML = '<div></div>'; document.body.appendChild(b); } const t = '📻 ' + s.banner + '   ·   '; if (b.firstChild.dataset.t !== s.banner) { b.firstChild.dataset.t = s.banner; b.firstChild.textContent = t.repeat(6); } } else if (b) b.remove();
  let p = $('.paused'); if (s.paused) { if (!p) { p = document.createElement('div'); p.className = 'paused'; p.innerHTML = '<div style="font-size:4rem">☕</div><div class="h-xl" style="font-size:2.6rem">Pause</div><div class="kicker">Quizmasteren holder en lille pause</div>'; document.body.appendChild(p); } } else if (p) p.remove();
  // fx
  if (s.fx && s.fx.id !== lastFx) {
    if (lastFx !== -1) { if (s.fx.type === 'confetti') Confetti.show(80); if (s.fx.type === 'win') Confetti.rain(160); }
    lastFx = s.fx.id;
  }
  render(s);
}

function render(s) {
  const q = s.q, me = s.me, answered = !!(me && me.answer);
  const key = [s.phase, q && q.id, answered ? 'A' : '', s.round && s.round.idx, s.twist && s.twist.id].join('|');
  $('#tbar').hidden = s.phase !== 'open' || answered;
  if (key !== viewKey) { viewKey = key; build(s); } else tick(s);
}
function tick(s) {
  if (s.phase === 'lobby') {
    const box = $('#names'); if (box && box.dataset.n !== String(s.lobby.length)) { box.dataset.n = s.lobby.length; box.innerHTML = s.lobby.slice(-40).map(n => `<span class="chip">${esc(n)}</span>`).join(''); $('#cnt').textContent = s.playerCount; }
  }
}
function build(s) {
  window.scrollTo(0, 0);
  const f = { lobby: vLobby, round_intro: vRound, ready: vReady, open: vOpen, locked: vOpen, reveal: vReveal, scoreboard: vBoard, ended: vEnded }[s.phase];
  f ? f(s) : (main.innerHTML = '');
}

/* ---------- Visninger ---------- */
function vLobby(s) {
  main.innerHTML = `<div class="center">
    <div class="kicker rise">Du er på kanalen</div>
    <h1 class="h-xl t-xl slam">Hej,<br>${esc(s.me ? s.me.name : '')}!</h1>
    ${s.me && s.me.team ? `<div class="chip ac" style="align-self:flex-start">🪑 ${esc(s.me.team)}</div>` : ''}
    <p style="font-size:1.1rem;opacity:.85">Musikken kommer fra storskærmen – din telefon er din svarbuzzer. Hold den klar og find glöggen frem.</p>
    <div class="kicker"><b id="cnt" class="num">${s.playerCount}</b> lyttere på kanalen</div>
    <div class="chips" id="names" data-n="${s.lobby.length}">${s.lobby.slice(-40).map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div>
  </div>`;
}
function vRound(s) {
  const r = s.round;
  main.innerHTML = `<div class="center" style="text-align:center;align-items:center">
    <div class="kicker rise">Program ${r.idx} / ${r.total}</div>
    <div class="emoji-xl floaty pop">${esc(r.emoji)}</div>
    <h1 class="h-xl t-l slam">${esc(r.title)}</h1>
    <p style="font-size:1.1rem;opacity:.9" class="rise">${esc(r.blurb)}</p>
    ${r.multiplier > 1 ? `<div class="pill-tw pop">⚡ Point ×${r.multiplier}</div>` : ''}
  </div>`;
}
function vReady(s) {
  const q = s.q;
  main.innerHTML = `<div class="center" style="text-align:center;align-items:center">
    <div class="kicker">Spørgsmål ${q.idx} af ${q.of}</div>
    <h1 class="h-xl t-xl slam" style="animation-iteration-count:1">GØR<br>KLAR</h1>
    <div class="chip ac">${esc(TYPE_LABEL[q.type] || '')}</div>
    ${q.type === 'wager' ? '<div class="pill-tw">🎲 Du skal satse point</div>' : ''}
    ${s.twist ? `<div class="pill-tw pop">🎡 ${esc(s.twist.label)} – ${esc(s.twist.desc)}</div>` : ''}
    <div class="emoji-xl floaty">${esc(q.emoji || '🎶')}</div>
  </div>`;
}

function initU(s) {
  const q = s.q, me = s.me;
  if (U.qid === q.id) return;
  const wo = me.wagerOpts || [];
  U = { qid: q.id, joker: false, seq: [], year: Math.round((q.yearMin + q.yearMax) / 2 / 1) , wager: wo.length > 1 ? wo[Math.min(2, wo.length - 1)] : (wo[0] || 0) };
  U.year = Math.round((q.yearMin + q.yearMax) / 2);
}
function ansLabel(q, a) {
  if (!a) return '';
  const o = q.options || [];
  switch (q.type) {
    case 'text': case 'year': return String(a.value);
    case 'order': return a.value.map(i => o[i]).join(' → ');
    default: return o[a.value] != null ? o[a.value] : '';
  }
}
function stageDots(s) {
  const q = s.q; if (!q.clips) return '';
  return `<div class="stagedots" id="sd">${Array.from({ length: q.clips }, (_, i) => `<span class="${i <= (s.stage || 0) ? 'on' : ''} ${i === (s.stage || 0) ? 'now' : ''}"></span>`).join('')}</div>`;
}
function vOpen(s) {
  const q = s.q, me = s.me; if (!me) return;
  initU(s);
  const answered = !!me.answer, closed = s.phase === 'locked';
  const head = `<div class="qhead"><span class="chip">${q.idx}/${q.of}</span><span class="chip ac">${esc(TYPE_LABEL[q.type] || '')}</span>${s.twist ? `<span class="pill-tw">🎡 ${esc(s.twist.label)}</span>` : ''}
    ${!answered && !closed ? `<span class="secs num" id="secs">${secsLeft(s)}</span>` : ''}</div>`;
  const prompt = `<div class="prompt rise">${q.emoji ? `<span style="margin-right:.25em">${esc(q.emoji)}</span>` : ''}${esc(q.prompt)}</div>${q.hint ? `<div class="kicker">${esc(q.hint)}</div>` : ''}${q.song ? `<div class="chip" style="align-self:flex-start"><span class="eq ${closed ? 'off' : ''}"><b></b><b></b><b></b></span> Lyt til storskærmen${q.clips ? ' · trin ' + ((s.stage || 0) + 1) + '/' + q.clips : ''}</div>` : ''}`;
  if (answered) {
    main.innerHTML = `${head}${prompt}<div class="lock pop"><div class="kicker">${closed ? 'Svar sendt – venter på afsløring' : '✅ Svar sendt'}</div>
      <div style="font-size:1.5rem;font-weight:800;letter-spacing:-.02em">${esc(ansLabel(q, me.answer))}</div>
      ${me.answer.wager ? `<div class="chip" style="background:var(--gold);color:#241800">🎲 Satset ${fmt(me.answer.wager)}</div>` : ''}${me.answer.joker ? '<div class="chip" style="background:var(--gold);color:#241800">🃏 Joker spillet – point ×2</div>' : ''}
      <span class="eq"><b></b><b></b><b></b><b></b><b></b></span></div>
      <div class="kicker" id="cnt2">${s.count ? s.count.answered + ' / ' + s.count.total + ' har svaret' : ''}</div>`;
    return;
  }
  if (closed) { main.innerHTML = `${head}${prompt}<div class="lock shake"><div style="font-size:2rem">⏰</div><div style="font-size:1.4rem;font-weight:800">Tiden er gået!</div><div class="kicker">Du nåede ikke at svare denne gang</div></div>`; return; }

  const jokerOK = me.joker > 0 && !['wager', 'vote'].includes(q.type);
  let body = '';
  if (jokerOK) body += `<button class="joker ${U.joker ? 'on' : ''}" id="jk">🃏 <span>${U.joker ? 'Joker er aktiv – point ×2 (men kun hvis du har ret)' : 'Brug din joker her (point ×2) – du har én'}</span></button>`;
  if (q.type === 'wager') {
    const wo = me.wagerOpts || [0];
    body += `<div><div class="kicker" style="margin-bottom:8px">Din indsats – rigtigt svar vinder den, forkert taber den</div><div class="stakes">${wo.map(w => `<button data-w="${w}" class="${w === U.wager ? 'sel' : ''}">${w ? fmt(w) : 'Ingen'}</button>`).join('')}</div></div>`;
  }
  if (['choice', 'tf', 'vote', 'wager'].includes(q.type)) {
    const two = q.options.length === 2;
    body += `<div class="tiles ${two ? 'two' : ''}" id="tl">${q.options.map((o, i) => `<button class="tile ${q.type === 'vote' ? 'vote' : ''} ${q.type === 'tf' ? 'big' : ''}" data-i="${i}">${q.type === 'tf' ? '' : `<span class="l">${LETTERS[i]}</span>`}<span>${esc(o)}</span></button>`).join('')}</div>`;
  } else if (q.type === 'text') {
    body += `<input class="field" id="tx" maxlength="60" placeholder="Skriv dit svar…" autocomplete="off" autocapitalize="words" spellcheck="false"><button class="btn" id="go">Send svar ➜</button>`;
  } else if (q.type === 'year') {
    body += `<div class="yearbox"><div class="y" id="yv">${U.year}</div><input type="range" id="yr" min="${q.yearMin}" max="${q.yearMax}" value="${U.year}">
      <div class="nudge"><button data-d="-5">−5</button><button data-d="-1">−1</button><button data-d="1">+1</button><button data-d="5">+5</button></div></div><button class="btn" id="go">Send svar ➜</button>`;
  } else if (q.type === 'order') {
    body += `<div class="kicker">Tryk i rækkefølge – nr. 1 først</div><div class="tiles" id="ol">${q.options.map((o, i) => `<button class="tile orderitem" data-i="${i}"><span class="n"></span><span>${esc(o)}</span></button>`).join('')}</div>
      <div style="display:flex;gap:10px"><button class="btn ghost" id="rs" style="flex:1">Nulstil</button><button class="btn" id="go" style="flex:2" disabled>Send svar ➜</button></div>`;
  }
  main.innerHTML = head + prompt + body;
  bindQuestion(s);
}
function bindQuestion(s) {
  const q = s.q;
  const send = v => submit(Object.assign({ value: v, wager: q.type === 'wager' ? U.wager : 0, joker: U.joker }, {}));
  const jk = $('#jk'); if (jk) jk.onclick = () => { U.joker = !U.joker; jk.classList.toggle('on', U.joker); jk.lastElementChild.textContent = U.joker ? 'Joker er aktiv – point ×2 (men kun hvis du har ret)' : 'Brug din joker her (point ×2) – du har én'; vib(15); };
  $$('.stakes button').forEach(b => b.onclick = () => { U.wager = +b.dataset.w; $$('.stakes button').forEach(x => x.classList.toggle('sel', x === b)); vib(10); });
  $$('#tl .tile').forEach(b => b.onclick = () => { b.classList.add('sel'); send(+b.dataset.i); });
  const tx = $('#tx'); if (tx) { tx.onkeydown = e => { if (e.key === 'Enter' && tx.value.trim()) send(tx.value.trim()); }; $('#go').onclick = () => { if (tx.value.trim()) send(tx.value.trim()); else tx.focus(); }; }
  const yr = $('#yr'); if (yr) {
    const set = v => { U.year = Math.max(q.yearMin, Math.min(q.yearMax, v)); yr.value = U.year; $('#yv').textContent = U.year; };
    yr.oninput = () => set(+yr.value); $$('.nudge button').forEach(b => b.onclick = () => { set(U.year + +b.dataset.d); vib(8); });
    $('#go').onclick = () => send(U.year);
  }
  if ($('#ol')) {
    const paint = () => { $$('#ol .tile').forEach(b => { const k = U.seq.indexOf(+b.dataset.i); b.classList.toggle('sel', k >= 0); b.querySelector('.n').textContent = k >= 0 ? k + 1 : ''; }); $('#go').disabled = U.seq.length !== q.options.length; };
    $$('#ol .tile').forEach(b => b.onclick = () => { const i = +b.dataset.i, k = U.seq.indexOf(i); if (k >= 0) U.seq.splice(k, 1); else U.seq.push(i); vib(8); paint(); });
    $('#rs').onclick = () => { U.seq = []; paint(); };
    $('#go').onclick = () => send(U.seq.slice());
    paint();
  }
}
async function submit(p) {
  if (sending) return; sending = true;
  const q = S.q;
  const r = await post('/api/answer', Object.assign({ pid: sess.pid, token: sess.token, qid: q.id }, p)).catch(() => ({ error: 'Ingen forbindelse – prøv igen' }));
  sending = false;
  if (r.ok || r.error === 'allerede svaret') {
    vib(40);
    if (S.me && !S.me.answer) { S.me.answer = { value: p.value, wager: p.wager, joker: p.joker }; viewKey = ''; render(S); }
  } else {
    vib([60, 40, 60]); toast(r.error === 'for sent' || r.error === 'lukket' ? 'For sent – tiden er gået' : r.error || 'Noget gik galt');
    $$('#tl .tile').forEach(b => b.classList.remove('sel'));
  }
}

const OK_LINES = ['RIGTIGT!', 'SÅ SKARPT!', 'DER SIDDER DEN!', 'KLARET!', 'NETOP!', 'HIT!'];
const NO_LINES = ['Av for den…', 'Næsten. Altså, nej.', 'Det var ikke dét.', 'Glöggen talte.', 'Ups.', 'Aldrig set før.'];
function vReveal(s) {
  const q = s.q, me = s.me, r = s.reveal || {}; if (!me) return;
  const L = me.last || { pts: 0, none: true }, st = L.none ? 'none' : L.correct === true ? 'ok' : L.correct === 'partial' ? 'mid' : 'no';
  const head = { ok: pick(OK_LINES, q.id), mid: 'TÆT PÅ!', no: pick(NO_LINES, q.id), none: 'Ingen svar' }[st];
  const sign = L.pts > 0 ? '+' : '';
  main.innerHTML = `
    <div class="res ${st} pop">
      <div class="kicker" style="opacity:.8">${L.none ? 'Du nåede det ikke' : esc(L.view || '')}</div>
      <div class="h-xl" style="font-size:2.4rem">${esc(head)}</div>
      <div class="pts num"><span id="pp">${sign}0</span></div>
      <div style="font-weight:700;opacity:.85">${[L.bonus ? `🔥 inkl. streak-bonus +${L.bonus}` : '', L.joker ? '🃏 Joker ×2' : '', L.out ? 'Kun de 5 hurtigste fik point' : '', L.diff != null && q.type === 'year' ? `${L.diff === 0 ? 'PRÆCIS!' : 'Ramte ' + L.diff + ' år ved siden af'}` : '', L.manual ? '✋ Rettet af quizmasteren' : ''].filter(Boolean).join(' · ')}</div>
    </div>
    <div class="card"><div class="kicker">${q.type === 'vote' ? 'Vinderholdet' : 'Rigtigt svar'}</div><div style="font-size:1.35rem;font-weight:800;letter-spacing:-.02em;margin-top:4px">${esc(r.correctText || '–')}</div></div>
    ${r.song ? `<div class="card song">${r.song.cover ? `<img src="${esc(r.song.cover)}" alt="">` : '<div class="cv">🎵</div>'}<div><b>${esc(r.song.title)}</b><span>${esc(r.song.artist)}${r.song.year ? ' · ' + esc(r.song.year) : ''}</span></div></div>` : ''}
    ${r.fact ? `<div class="card" style="font-size:1rem">💡 ${esc(r.fact)}</div>` : ''}
    <div class="card" style="display:flex;justify-content:space-between;align-items:center"><div><div class="kicker">Din placering</div><div class="h-xl" style="font-size:2.4rem;margin-top:2px">#${me.rank}<span style="font-size:1rem;opacity:.6;font-weight:600"> / ${me.of}</span></div></div>
      <div style="text-align:right;font-weight:700">${me.gapUp ? `<span class="kicker">${fmt(me.gapUp.gap)} point op til</span><br>${esc(me.gapUp.name)}` : '🏆 Du fører!'}</div></div>
    ${me.streak >= 2 ? `<div class="chip ac" style="align-self:flex-start">🔥 ${me.streak} rigtige i træk</div>` : ''}`;
  const pp = $('#pp'); if (L.pts) { const t0 = performance.now(); (function a(t) { const k = Math.min(1, (t - t0) / 900); pp.textContent = sign + fmt(L.pts * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(a); })(t0); } else pp.textContent = '0';
  if (st === 'ok') { vib([40, 30, 80]); setTimeout(() => Confetti.burst(90, { y: .3 }), 250); } else if (st === 'no') vib(200);
}
function vBoard(s) {
  const me = s.me, top = (s.board || []).slice(0, 8), inTop = me && top.some(x => x.id === me.id);
  main.innerHTML = `<div class="kicker">Stilling efter program ${s.round.idx} / ${s.round.total}</div><h1 class="h-xl t-l slam">${esc(s.round.emoji)} ${esc(s.round.title)} er slut</h1>
    ${me ? `<div class="card" style="display:flex;justify-content:space-between;align-items:center"><div><div class="kicker">Du ligger</div><div class="h-xl" style="font-size:3rem">#${me.rank}</div></div><div class="h-xl num" style="font-size:2.2rem">${fmt(me.score)}</div></div>` : ''}
    <div class="board">${top.map((x, i) => rowHTML(x, me, i)).join('')}${me && !inTop ? `<div class="kicker" style="text-align:center">…</div><div class="row me"><span class="rk">${me.rank}</span><span class="nm">${esc(me.name)}</span><span class="sc">${fmt(me.score)}</span></div>` : ''}</div>`;
}
function rowHTML(x, me, i) {
  const mv = x.prev - x.rank;
  return `<div class="row ${me && x.id === me.id ? 'me' : ''} ${x.rank === 1 ? 'top1' : ''}" style="animation-delay:${i * 50}ms"><span class="rk">${x.rank}</span><span class="nm">${esc(x.name)}${x.team ? `<small>${esc(x.team)}</small>` : ''}</span><span class="sc">${fmt(x.score)}${mv ? `<span class="mv ${mv > 0 ? 'up' : 'dn'}">${mv > 0 ? '▲' : '▼'}${Math.abs(mv)}</span>` : ''}</span></div>`;
}
function vEnded(s) {
  const me = s.me, bd = me && me.badge, top = (s.board || []).slice(0, 3);
  main.innerHTML = `<div class="kicker">Showet er slut – tak for i aften</div>
    <h1 class="h-xl t-xl slam">${me && me.rank === 1 ? '👑 DU<br>VANDT!' : me ? `#${me.rank}` : ''}</h1>
    ${me ? `<div class="h-xl num" style="font-size:2rem">${fmt(me.score)} point</div>` : ''}
    ${bd ? `<div class="badge-card pop" style="animation-delay:.6s"><div style="font-size:4rem">${esc(bd.emoji)}</div><div class="kicker" style="opacity:.7">Din titel</div><div class="h-xl" style="font-size:2rem">${esc(bd.title)}</div><div style="font-weight:600">${esc(bd.desc)}</div></div>` : ''}
    <div class="board">${top.map((x, i) => rowHTML(x, me, i)).join('')}</div>
    <div class="kicker" style="text-align:center;padding:10px">Glædelig jul 🎄</div>`;
  if (me && me.rank === 1) setTimeout(() => Confetti.rain(200), 400);
}

/* ---------- Start ---------- */
if (sess) start(); else showJoin();
