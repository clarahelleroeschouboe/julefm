/* JULE FM – storskærm / projektor */
const stage = $('#stage');
let S = null, viewKey = '', lastFx = -1, lastSecs = -1, endState = 0, lastPhase = '';
$('#gate').onclick = () => { Sfx.unlock(); $('#gate').remove(); try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); } catch {} };
document.addEventListener('keydown', e => { if (e.key === 'f') { try { document.documentElement.requestFullscreen(); } catch {} } });

connect({ params: () => ({ role: 'tv' }), onState });

function onState(s) {
  const prevPhase = S && S.phase; S = s;
  applyTheme(themeFor(s)); snow(['lobby', 'ended'].includes(s.phase));
  // pips
  const pe = $('#pips'), n = s.roundCount || 0;
  if (pe.children.length !== n) pe.innerHTML = Array.from({ length: n }, () => '<span></span>').join('');
  [...pe.children].forEach((e, i) => { const cur = s.round ? s.round.idx - 1 : -1; e.className = s.phase === 'ended' ? 'done' : i < cur ? 'done' : i === cur && s.phase !== 'lobby' ? 'now' : ''; });
  // banner / pause
  let b = $('.banner'); if (s.banner) { if (!b) { b = document.createElement('div'); b.className = 'banner'; b.style.fontSize = '1.6rem'; b.innerHTML = '<div></div>'; document.body.appendChild(b); } if (b.firstChild.dataset.t !== s.banner) { b.firstChild.dataset.t = s.banner; b.firstChild.textContent = ('📻 ' + s.banner + '   ·   ').repeat(6); } } else if (b) b.remove();
  let p = $('.paused'); if (s.paused) { if (!p) { p = document.createElement('div'); p.className = 'paused'; p.innerHTML = '<div style="font-size:12rem">☕</div><div class="h-xl" style="font-size:9rem">PAUSE</div><div class="kicker" style="font-size:1.6rem">Vi er tilbage om lidt</div>'; document.body.appendChild(p); } } else if (p) p.remove();
  // effekter
  if (s.fx && s.fx.id !== lastFx) {
    if (lastFx !== -1) {
      if (s.fx.type === 'reveal') { Sfx.reveal(); setTimeout(() => Confetti.burst(60, { y: .6, power: .8 }), 350); }
      if (s.fx.type === 'confetti') { Sfx.fanfare(); Confetti.show(120); }
      if (s.fx.type === 'spin' && s.twist) spinOverlay(s.twist);
    }
    lastFx = s.fx.id;
  }
  const key = [s.phase, s.q && s.q.id, s.round && s.round.idx, s.showBoard ? 'B' : '', s.phase === 'scoreboard' ? 'sb' : ''].join('|');
  if (key !== viewKey) { viewKey = key; build(s); } else tick(s);
}

function build(s) {
  endState = 0; lastSecs = -1;
  const board = s.showBoard && !['lobby', 'ended'].includes(s.phase) || s.phase === 'scoreboard';
  if (board) return vBoard(s);
  ({ lobby: vLobby, round_intro: vRound, ready: vReady, open: vOpen, locked: vOpen, reveal: vReveal, ended: vEnded }[s.phase] || (() => { stage.innerHTML = ''; }))(s);
}

/* ---------- Lobby ---------- */
function vLobby(s) {
  const url = location.origin + '/';
  stage.innerHTML = `<div class="lobby">
    <div><div class="onair rise" style="font-size:1.2rem;margin-bottom:1.6rem">Sender live · 24.12 MHz</div>
      <h1 class="wm slam">JULE<br><i>FM</i></h1>
      <p class="sub rise">${esc(s.subtitle || 'Musikquiz til julefrokosten')}</p></div>
    <div><div style="display:flex;gap:2rem;align-items:center"><div class="qrbox pop" id="qr"></div>
      <div><div class="kicker" style="font-size:1rem">Scan koden<br>og skriv<br>dit navn</div><div class="count"><b class="num" id="cnt">${s.playerCount}</b>lyttere</div></div></div>
      <div class="url">${esc(url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</div>
      <div class="cloud" id="cloud"></div></div></div>`;
  try { const qr = qrcode(0, 'M'); qr.addData(url); qr.make(); $('#qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch { $('#qr').innerHTML = '<div style="color:#000;font-weight:800;display:grid;place-items:center;height:100%;text-align:center">Åbn adressen<br>herunder</div>'; }
  tick(s);
}
function tick(s) {
  if (s.phase === 'lobby') {
    const c = $('#cloud'); if (c && c.dataset.n !== String(s.lobby.length)) { const old = +c.dataset.n || 0; c.dataset.n = s.lobby.length; c.innerHTML = s.lobby.slice(-36).map((n, i) => `<span class="chip" style="${i < s.lobby.length - old ? '' : 'animation:none'}">${esc(n)}</span>`).join(''); if (s.lobby.length > old && old) Sfx.pop(); const e = $('#cnt'); if (e) e.textContent = s.playerCount; }
  }
  if (s.phase === 'open' || s.phase === 'locked') {
    const a = $('#ans'); if (a && s.count) { a.textContent = s.count.answered; $('#tot').textContent = s.count.total; $('#ab').style.width = (s.count.total ? 100 * s.count.answered / s.count.total : 0) + '%'; }
    const sd = $('#sd'); if (sd) [...sd.children].forEach((e, i) => { e.className = (i <= (s.stage || 0) ? 'on ' : '') + (i === (s.stage || 0) ? 'now' : ''); });
    const pot = $('#pot'); if (pot && s.q.clips) pot.textContent = Math.round(100 * Math.max(.3, 1 - .23 * (s.stage || 0))) + '% af point-potten';
    const eq = $('.musicnow .eq'); if (eq) eq.classList.toggle('off', s.phase === 'locked');
  }
}
setInterval(() => {
  if (!S) return;
  if (S.phase === 'open') {
    const total = Math.max(1, S.deadline - S.openedAt), left = Math.max(0, S.deadline - sNow()), sec = Math.ceil(left / 1000);
    const ring = $('.ring'); if (ring && !S.paused) { $('.fg', ring).style.strokeDashoffset = 283 * (1 - left / total); ring.classList.toggle('low', sec <= 5); $('b', ring).textContent = sec;
      if (sec !== lastSecs) { if (sec <= 5 && sec > 0) Sfx.tick(); lastSecs = sec; } }
  }
  if (S.phase === 'ended') endTick();
}, 100);

/* ---------- Runde-intro / klar ---------- */
function vRound(s) {
  const r = s.round; Sfx.whoosh();
  stage.innerHTML = `<div class="intro"><div class="em floaty pop">${esc(r.emoji)}</div>
    <div><div class="kicker rise" style="font-size:1.4rem">Program ${r.idx} af ${r.total} · ${r.qCount} spørgsmål</div>
    <h1 class="h-xl slam" style="margin-top:.8rem">${esc(r.title)}</h1><p class="rise">${esc(r.blurb)}</p>
    ${r.multiplier > 1 ? `<div class="mult pop" style="animation-delay:.4s">⚡ POINT ×${r.multiplier}</div>` : ''}</div></div>`;
}
function vReady(s) {
  const q = s.q; Sfx.go();
  stage.innerHTML = `<div class="ready"><div class="kicker" style="font-size:1.5rem">Spørgsmål ${q.idx} af ${q.of} · ${esc(TYPE_LABEL[q.type] || '')}</div><h1 class="h-xl">GØR KLAR</h1>
    ${s.twist ? `<div class="pill-tw pop" style="font-size:2.2rem">🎡 ${esc(s.twist.label)} – ${esc(s.twist.desc)}</div>` : ''}
    ${q.type === 'wager' ? '<div class="pill-tw" style="font-size:2rem">🎲 Væddemål – sats dine point</div>' : ''}
    <div style="font-size:7rem" class="floaty">${esc(q.emoji || '🎶')}</div></div>`;
}

/* ---------- Spørgsmål ---------- */
function optsHTML(q, cls) {
  const big = q.type === 'tf' || (q.type === 'vote' && q.options.length === 2);
  return `<div class="opts ${q.options.length === 3 ? 'thr' : ''} ${big ? 'big' : ''} ${cls || ''}">${q.options.map((o, i) => `<div class="opt" data-i="${i}" style="animation:rise .45s ${i * 70}ms both"><div class="fill"></div>${q.type === 'tf' ? '' : `<span class="l">${LETTERS[i]}</span>`}<span class="t">${esc(o)}</span><span class="n"></span></div>`).join('')}</div>`;
}
function vOpen(s) {
  const q = s.q, locked = s.phase === 'locked';
  if (!locked) Sfx.go();
  else Sfx.lock();
  let body = '';
  if (['choice', 'tf', 'vote', 'wager'].includes(q.type)) body = optsHTML(q);
  else if (q.type === 'text') body = `<div class="hintbox">✍️ Skriv svaret på din telefon</div>`;
  else if (q.type === 'year') body = `<div class="hintbox">📅 Gæt årstallet · ${q.yearMin}–${q.yearMax}</div>`;
  else if (q.type === 'order') body = `<div class="kicker" style="font-size:1.3rem">Tryk i rækkefølge på din telefon – ældst/først øverst</div>` + optsHTML(q, 'one');
  stage.innerHTML = `<div class="q">
    <div class="qmain">
      <div class="qmeta"><span class="chip">${q.idx} / ${q.of}</span><span class="chip ac">${esc(TYPE_LABEL[q.type] || '')}</span>${s.twist ? `<span class="pill-tw">🎡 ${esc(s.twist.label)}</span>` : ''}${s.round.multiplier > 1 ? `<span class="pill-tw">⚡ ×${s.round.multiplier}</span>` : ''}${q.type === 'vote' && q.mode === 'minority' ? '<span class="pill-tw">🙃 Mindretallet vinder</span>' : ''}</div>
      <div class="qp rise">${q.emoji ? `<span style="margin-right:.2em">${esc(q.emoji)}</span>` : ''}${esc(q.prompt)}</div>
      ${q.song ? `<div class="musicnow"><span class="eq ${locked ? 'off' : ''}"><b></b><b></b><b></b><b></b><b></b></span><span>Lyt godt efter…</span>${q.clips ? `<div class="stagedots" id="sd">${Array.from({ length: q.clips }, () => '<span></span>').join('')}</div><span class="mono" id="pot" style="font-size:1.1rem;opacity:.8"></span>` : ''}</div>` : ''}
      ${body}
    </div>
    <div class="side"><div class="ring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="45"/><circle class="fg" cx="50" cy="50" r="45"/></svg><b>${secsLeft(s)}</b></div>
      <div class="answered"><b class="num"><span id="ans">0</span><span style="opacity:.4"> / </span><span id="tot">0</span></b>har svaret<div class="abar" style="margin-top:.6rem"><div id="ab"></div></div></div></div>
    ${locked ? `<div class="stamp">SVAR LÅST</div>` : ''}
  </div>`;
  tick(s);
}

/* ---------- Afsløring ---------- */
function vReveal(s) {
  const q = s.q, r = s.reveal || {}, d = r.dist || {}, tot = d.answered || 0;
  let viz = '';
  if (['choice', 'tf', 'wager', 'vote'].includes(q.type)) viz = optsHTML(q, q.type === 'vote' ? 'big' : '');
  else if (q.type === 'text') viz = `<div class="kicker" style="font-size:1.3rem">Rigtigt svar</div><div class="answerbig slam">${esc(r.correctText)}</div><div class="kicker" style="font-size:1.2rem;margin-top:1rem">Svar-hitlisten</div><div class="texts">${(d.texts || []).map(t => `<span class="chip ${t.ok ? 'ok' : ''}">${esc(t.text)}${t.n > 1 ? ' ×' + t.n : ''}</span>`).join('') || '<span class="chip">Ingen svar</span>'}</div>`;
  else if (q.type === 'year') {
    const lo = q.yearMin, hi = q.yearMax, pos = y => 100 * (y - lo) / (hi - lo), c = +r.correctText;
    viz = `<div class="kicker" style="font-size:1.3rem">Rigtigt årstal</div><div class="answerbig slam">${c}</div>
      <div class="tl"><div class="axis"></div>${(d.guesses || []).map((g, i) => `<span class="g" style="left:${pos(Math.max(lo, Math.min(hi, g)))}%;animation-delay:${i * 40}ms"></span>`).join('')}<span class="c" style="left:${pos(c)}%">${c}</span><span class="e" style="left:0">${lo}</span><span class="e" style="right:0">${hi}</span></div>
      <div class="kicker" style="font-size:1.2rem">${d.avg ? 'Gennemsnitligt gæt: ' + d.avg : ''}</div>`;
  } else if (q.type === 'order') {
    const seq = String(r.correctText || '').split(' → ');
    viz = `<div class="kicker" style="font-size:1.3rem">Rigtig rækkefølge · ${d.perfect || 0} havde alt rigtigt</div><div class="seq">${seq.map((t, i) => `<div class="opt ok" style="animation-delay:${i * 350}ms"><span class="l">${i + 1}</span><span class="t">${esc(t)}</span></div>`).join('')}</div>`;
  }
  const sg = r.song;
  const right = `<div class="songcard">${sg ? (sg.cover ? `<img src="${esc(sg.cover)}" alt="">` : '<div class="cv">🎵</div>') : `<div style="font-size:11rem" class="floaty">${esc(q.emoji || '🎶')}</div>`}
    ${sg ? `<div><h3>${esc(sg.title)}</h3><p>${esc(sg.artist)}${sg.year ? ' · ' + esc(sg.year) : ''}</p></div>` : ''}
    ${r.fact ? `<div class="fact rise" style="animation-delay:.8s">💡 ${esc(r.fact)}</div>` : ''}
    ${r.fastest && r.fastest.length ? `<div class="fast">${r.fastest.map((f, i) => `<span class="chip">${['🥇', '🥈', '🥉'][i]} ${esc(f.name)} · ${(f.t / 1000).toFixed(1)}s</span>`).join('')}</div>` : ''}</div>`;
  stage.innerHTML = `<div class="rv"><div style="display:flex;flex-direction:column;gap:1.5rem;justify-content:center"><div class="qp">${esc(q.prompt)}</div>${viz}</div>${right}</div>`;
  // fyld søjler + marker rigtige
  if (['choice', 'tf', 'wager', 'vote'].includes(q.type) && d.counts) {
    const max = Math.max(1, ...d.counts);
    $$('.opt').forEach((el, i) => {
      const c = d.counts[i] || 0, good = q.type === 'vote' ? (d.winners || []).includes(i) : i === r.correct;
      el.querySelector('.n').textContent = q.type === 'vote' && tot ? Math.round(100 * c / tot) + '%' : c;
      setTimeout(() => { el.querySelector('.fill').style.transform = `scaleX(${c / max})`; }, 150);
      setTimeout(() => { el.classList.add(good ? 'ok' : 'dim'); }, 1300);
    });
  }
}

/* ---------- Stilling ---------- */
function renderRows(el, list, rowH, delayPrev) {
  el.style.height = list.length * rowH + 'rem';
  const have = new Map($$('.brow', el).map(e => [e.dataset.id, e]));
  list.forEach((x, i) => {
    let r = have.get(x.id); const fresh = !r;
    if (fresh) { r = document.createElement('div'); r.className = 'brow'; r.dataset.id = x.id; r.innerHTML = '<span class="rk"></span><span class="nm"></span><span class="sc"></span>'; el.appendChild(r); }
    have.delete(x.id);
    r.style.height = (rowH - .4) + 'rem'; r.style.fontSize = rowH * .68 + 'rem';
    const tgt = i * rowH + 'rem';
    if (fresh && delayPrev) { r.style.transition = 'none'; r.style.top = Math.min(list.length - 1, Math.max(0, (x.prev || x.rank) - 1)) * rowH + 'rem'; r.offsetHeight; r.style.transition = ''; setTimeout(() => { r.style.top = tgt; }, delayPrev); } else r.style.top = tgt;
    const mv = (x.prev || x.rank) - x.rank;
    r.querySelector('.rk').textContent = x.rank;
    r.querySelector('.nm').innerHTML = esc(x.name) + (x.team ? `<small>${esc(x.team)}</small>` : '');
    r.querySelector('.sc').innerHTML = fmt(x.score) + (mv ? `<span class="mv ${mv > 0 ? 'up' : 'dn'}">${mv > 0 ? '▲' : '▼'}${Math.abs(mv)}</span>` : '');
    r.classList.toggle('first', x.rank === 1);
  });
  have.forEach(e => e.remove());
}
function vBoard(s) {
  const teams = s.teams || [], sb = s.phase === 'scoreboard';
  stage.innerHTML = `<div class="bd ${teams.length ? 't' : ''}"><div><h2 class="slam">${sb ? esc(s.round.emoji) + ' ' + esc(s.round.title) + ' – slut!' : 'Stillingen'}</h2><div class="rows" id="rows"></div></div>
    ${teams.length ? `<div><h2 style="font-size:3rem">Bordenes kamp</h2><div class="teams">${teams.slice(0, 7).map(t => `<div class="team"><div class="f" style="transform:scaleX(${t.score / Math.max(1, teams[0].score)})"></div><span>${t.rank}. ${esc(t.team)}</span><span class="num">${fmt(t.score)} <small style="opacity:.6;font-size:.7em">gns · ${t.members}</small></span></div>`).join('')}</div></div>` : ''}</div>`;
  const list = (s.board || []).slice(0, 9);
  renderRows($('#rows'), list, 2.45, sb || s.showBoard ? 900 : 0);
  if (sb) { Sfx.whoosh(); }
}

/* ---------- Finale ---------- */
function vEnded(s) {
  const b = (s.board || []), top = b.slice(0, 3), bd = s.badges || {};
  const slot = (x, k) => x ? `<div class="pod p${k}" id="pod${k}"><div class="crown">${k === 1 ? '👑' : ''}</div><div class="nm">${esc(x.name)}</div><div class="sc">${fmt(x.score)} point</div><div class="block">${k}</div></div>` : '';
  stage.innerHTML = `<div class="full" id="endwrap">
    <div id="pdv" style="flex:1;display:flex;flex-direction:column"><div style="text-align:center"><div class="kicker" style="font-size:1.5rem" id="endk">Og vinderen af JULE FM er…</div></div>
      <div class="podium">${slot(top[1], 2)}${slot(top[0], 1)}${slot(top[2], 3)}</div></div>
    <div id="awv" hidden><h2 class="h-xl" style="font-size:4.4rem;margin-bottom:1.2rem">Aftenens titler</h2><div class="awards">${b.slice(0, 24).map((x, i) => { const a = bd[x.id] || {}; return `<div class="award" style="animation-delay:${i * 60}ms"><span class="e">${esc(a.emoji || '🎄')}</span><div style="min-width:0"><b>${esc(x.name)}</b><span>${esc(a.title || '')}</span></div></div>`; }).join('')}</div></div></div>`;
  endState = 0; endTick();
}
function endTick() {
  if (!S || S.phase !== 'ended' || !$('#pdv')) return;
  const e = sNow() - S.endedAt;
  const step = e < 3200 ? 0 : e < 7500 ? 1 : e < 12500 ? 2 : e < 22000 ? 3 : 4;
  if (step === endState) return;
  const first = endState === 0 && step === 0;
  if (e < 1500 && endState === 0 && lastPhase !== 'ended') Sfx.drum();
  lastPhase = 'ended';
  endState = step;
  const show = k => { const p = $('#pod' + k); if (p && !p.classList.contains('in')) { p.classList.add('in'); Sfx.pop(); } };
  if (step >= 1) { show(3); if (!$('#pod3')) show(2); }
  if (step >= 2) show(2);
  if (step >= 3) { const p = $('#pod1'); if (p && !p.classList.contains('in')) { p.classList.add('in'); Sfx.fanfare(); Confetti.show(180); setTimeout(() => Confetti.rain(120), 900); $('#endk').textContent = 'Julemester!'; } }
  if (step >= 4) { $('#pdv').hidden = true; $('#awv').hidden = false; Sfx.reveal(); Confetti.rain(90); }
}

/* ---------- Frekvens-hjulet ---------- */
function spinOverlay(tw) {
  const all = ['DOBBELT OP', 'TREDOBBELT', 'TOP 5 TAGER ALT', 'TURBO'];
  const items = Array.from({ length: 26 }, (_, i) => all[(i * 7 + (i >> 1)) % all.length]); items[23] = tw.label;
  const ov = document.createElement('div'); ov.className = 'spinov';
  ov.innerHTML = `<div class="kicker" style="font-size:1.6rem;color:var(--gold)">🎡 Frekvens-hjulet snurrer</div><div class="reel"><div class="strip">${items.map(t => `<div class="it">${esc(t)}</div>`).join('')}</div></div><div class="h-xl" id="spd" style="font-size:2.6rem;color:var(--fg);opacity:0">${esc(tw.desc)}</div>`;
  document.body.appendChild(ov); Sfx.spin(30);
  const strip = $('.strip', ov), h = parseFloat(getComputedStyle(document.documentElement).fontSize) * 9;
  strip.style.transition = 'transform 4.2s cubic-bezier(.12,.7,.15,1)'; requestAnimationFrame(() => requestAnimationFrame(() => { strip.style.transform = `translateY(${-23 * h}px)`; }));
  setTimeout(() => { $('#spd').style.opacity = 1; Sfx.fanfare(); Confetti.show(80); }, 4300);
  setTimeout(() => ov.remove(), 7000);
}
