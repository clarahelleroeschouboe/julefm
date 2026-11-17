/* JULE FM – quizmaster: login, live-kontrol, Spotify, test */
let TOKEN = null, H = null, conn = null;
try { TOKEN = localStorage.getItem('jf_host'); } catch {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function toast(t, err) { const d = document.createElement('div'); d.className = 'toast' + (err ? ' err' : ''); d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), err ? 4200 : 2200); }
const act = (a, o) => post('/api/host/action', Object.assign({ action: a }, o || {}), TOKEN).then(r => { if (r.error) toast(r.error, true); return r; });
const hostFetch = (url, opt = {}) => fetch(url, Object.assign({}, opt, { headers: Object.assign({ 'x-host-token': TOKEN, 'Content-Type': 'application/json' }, opt.headers || {}) }));
async function getQuiz() { const r = await hostFetch('/api/host/quiz'); if (!r.ok) throw new Error('Kunne ikke hente quiz'); return r.json(); }
async function putQuiz(q) { const r = await hostFetch('/api/host/quiz', { method: 'PUT', body: JSON.stringify(q) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Kunne ikke gemme'); try { localStorage.setItem('jf_backup', JSON.stringify(q)); } catch {} return j; }
async function patchQuiz(fn) { const q = await getQuiz(); fn(q); await putQuiz(q); window.editorReload && window.editorReload(); }

/* ---------- Login & opstart ---------- */
async function boot() {
  applyTheme('night');
  if (TOKEN) { const r = await hostFetch('/api/host/quiz').catch(() => null); if (r && r.ok) return enter(); }
  $('#login').hidden = false; $('#app').hidden = true;
}
$('#pwgo').onclick = async () => {
  const r = await post('/api/host/login', { password: $('#pw').value });
  if (r.token) { TOKEN = r.token; try { localStorage.setItem('jf_host', TOKEN); } catch {} $('#login').hidden = true; enter(); } else $('#pwerr').textContent = r.error || 'Fejl';
};
$('#pw').onkeydown = e => { if (e.key === 'Enter') $('#pwgo').click(); };
function enter() {
  $('#login').hidden = true; $('#app').hidden = false;
  buildLive(); buildSpotifyTab(); buildTestTab(); window.initEditor && window.initEditor();
  conn = connect({ params: () => ({ role: 'host', token: TOKEN }), onState, onStatus: ok => { $('#hdot').style.background = ok ? 'var(--ok)' : 'var(--no)'; }, onFatal: () => { TOKEN = null; try { localStorage.removeItem('jf_host'); } catch {} location.reload(); } });
  spBoot();
}
$('#tabs').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  ['live', 'edit', 'spotify', 'test'].forEach(t => { $('#tab-' + t).hidden = t !== b.dataset.t; });
};

/* ---------- Live ---------- */
const NEXT_LABEL = { lobby: 'Start showet ▶', round_intro: 'Vis første spørgsmål ▶', ready: 'Start spørgsmål ▶', open: 'Lås svar nu ⏹', locked: 'Afslør svaret ✨', reveal: 'Næste spørgsmål ▶', scoreboard: 'Næste program ▶', ended: 'Showet er slut 🎄' };
const PHASE_LABEL = { lobby: 'Lobby', round_intro: 'Program-intro', ready: 'Gør klar', open: 'Spørgsmål åbent', locked: 'Låst', reveal: 'Afsløring', scoreboard: 'Stilling', ended: 'Finale' };
function buildLive() {
  $('#tab-live').innerHTML = `<div class="grid"><div class="stack">
    <div class="panel"><div class="row2"><span class="ph" id="phase">–</span><span class="muted" id="where"></span><span class="timer num" id="timer" style="margin-left:auto">--</span></div>
      <button class="btn big-next" id="next">–</button>
      <div class="row2">
        <button class="btn sm ghost" id="bPause">⏸ Pause</button><button class="btn sm ghost" id="bExt">+10 sek</button>
        <button class="btn sm warn" id="bSpin">🎡 Frekvens-hjulet</button><button class="btn sm ghost" id="bClr">Fjern twist</button>
        <button class="btn sm ghost" id="bBoard">📊 Vis/skjul stilling</button><button class="btn sm ghost" id="bConf">🎉 Konfetti</button>
      </div><div class="muted">Tip: <b>mellemrum</b> = næste trin. Hjulet kan snurres lige før et spørgsmål (eller under det) – skærmen viser selv effekten.</div></div>
    <div class="panel"><h3>Aktuelt spørgsmål <span class="muted" style="text-transform:none;letter-spacing:0">(kun du kan se svaret)</span></h3><div id="qbox"></div></div>
    <div class="panel"><h3>Musik</h3>
      <div id="spstat" class="muted"></div>
      <div class="row2"><button class="btn sm" id="mPlay">▶ Afspil klip</button><button class="btn sm ghost" id="mFull">▶ Hele sangen</button><button class="btn sm ghost" id="mStop">⏹ Stop</button>
        <label class="ck" style="margin-left:auto"><input type="checkbox" id="auto" checked> Auto-afspil med quizzen</label></div>
      <label class="f"><span>Lydstyrke</span><input type="range" id="vol" min="0" max="100" value="80"></label>
      <div id="mnow" class="muted"></div></div>
    <div class="panel"><h3>Besked på skærmen (løbende tekstbånd)</h3><div class="row2"><input type="text" id="bn" maxlength="80" placeholder="Fx: Baren åbner om 5 minutter 🍻" style="flex:1"><button class="btn sm" id="bnS">Send</button><button class="btn sm ghost" id="bnC">Fjern</button></div></div>
  </div><div class="stack">
    <div class="panel"><h3>Lyttere <span id="pc"></span></h3><div class="pl" id="pl"></div></div>
    <div class="panel"><h3>Svar rulles ind</h3><div class="feed" id="feed"></div></div>
    <div class="panel"><h3>Hop til</h3><div class="row2"><select id="jr" style="flex:1"></select><select id="jq" style="flex:1"></select><button class="btn sm ghost" id="jg">Gå</button></div><div class="muted">Bruges til at springe frem/tilbage eller teste enkelte spørgsmål.</div></div>
  </div></div>`;
  $('#next').onclick = () => act('next');
  $('#bPause').onclick = () => act(H && H.paused ? 'resume' : 'pause');
  $('#bExt').onclick = () => act('extend', { sec: 10 });
  $('#bSpin').onclick = () => act('spin'); $('#bClr').onclick = () => act('cleartwist');
  $('#bBoard').onclick = () => act('board'); $('#bConf').onclick = () => act('confetti');
  $('#bnS').onclick = () => act('banner', { text: $('#bn').value }); $('#bnC').onclick = () => { $('#bn').value = ''; act('banner', { text: '' }); };
  $('#bn').onkeydown = e => { if (e.key === 'Enter') $('#bnS').click(); };
  $('#jr').onchange = fillJq;
  $('#jg').onclick = () => { if (!confirm('Hoppe til dette punkt? Point bevares.')) return; act('goto', { r: +$('#jr').value, q: +$('#jq').value }); };
  $('#pl').onclick = e => {
    const b = e.target.closest('button'); if (!b) return; const id = b.closest('.pr').dataset.id, a = b.dataset.a;
    if (a === 'p') act('adjust', { pid: id, delta: 100 }); if (a === 'm') act('adjust', { pid: id, delta: -100 });
    if (a === 'c') { const v = prompt('Ændr point med (fx 250 eller -300):'); if (v && +v) act('adjust', { pid: id, delta: +v }); }
    if (a === 'f') act('flip', { pid: id });
    if (a === 'k') { if (confirm('Fjern spilleren fra quizzen?')) act('kick', { pid: id }); }
  };
  $('#mPlay').onclick = () => playCurrent(false); $('#mFull').onclick = () => playCurrent(true); $('#mStop').onclick = () => spStop(true);
  $('#vol').oninput = e => { SP.vol = e.target.value / 100; SP.player && SP.player.setVolume(SP.vol); };
  $('#auto').checked = localStorage.getItem('jf_auto') !== '0'; $('#auto').onchange = e => { try { localStorage.setItem('jf_auto', e.target.checked ? '1' : '0'); } catch {} };
  document.addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName) && !$('#tab-live').hidden) { e.preventDefault(); act('next'); } });
  setInterval(() => { if (!H) return; const t = $('#timer'); if (H.phase === 'open') { t.textContent = H.paused ? '⏸' : secsLeft(H) + 's'; t.style.color = secsLeft(H) <= 5 ? 'var(--no)' : ''; } else { t.textContent = '--'; t.style.color = ''; } }, 250);
}
let metaSig = '';
function fillJq() {
  const r = +$('#jr').value, m = H && H.quizMeta[r]; if (!m) return;
  $('#jq').innerHTML = '<option value="-1">Program-intro</option>' + m.qs.map((q, i) => `<option value="${i}">${i + 1}. ${esc(q.prompt)}</option>`).join('');
}
function correctOf(q) {
  const o = q.options || [];
  switch (q.type) {
    case 'choice': case 'tf': case 'wager': return o[q.correct];
    case 'text': return (q.correct || []).join(' / ');
    case 'year': return String(q.correct);
    case 'order': return (q.correct || []).map(i => o[i]).join(' → ');
    case 'vote': return q.mode === 'minority' ? '(Mindretallet vinder)' : '(Flertallet vinder)';
  }
}
function onState(s) {
  H = s; applyTheme('night'); updateLive(); musicWatch(s);
}
function updateLive() {
  const s = H, q = s.fullQ, last = s.quizMeta[s.roundIdx];
  $('#phase').textContent = PHASE_LABEL[s.phase] || s.phase;
  $('#where').textContent = s.phase === 'lobby' ? `${s.playerCount} lyttere` : `Program ${s.roundIdx + 1}/${s.quizMeta.length}${q && !['round_intro', 'scoreboard', 'ended'].includes(s.phase) ? ` · spørgsmål ${s.qIdx + 1}/${last ? last.qs.length : '?'}` : ''}`;
  const nx = $('#next'); let lbl = NEXT_LABEL[s.phase] || 'Næste ▶';
  if (s.phase === 'reveal' && last && s.qIdx + 1 >= last.qs.length) lbl = s.roundIdx + 1 >= s.quizMeta.length ? 'Afslut quizzen – vis vinderne 👑' : 'Afslut program ▶';
  nx.textContent = lbl; nx.disabled = s.phase === 'ended';
  $('#bPause').textContent = s.paused ? '▶ Fortsæt' : '⏸ Pause'; $('#bPause').classList.toggle('warn', s.paused);
  $('#bBoard').classList.toggle('warn', s.showBoard);
  if (s.twist) $('#bSpin').textContent = '🎡 ' + s.twist.label; else $('#bSpin').textContent = '🎡 Frekvens-hjulet';
  // hop-til
  const sig = JSON.stringify(s.quizMeta.map(r => [r.title, r.qs.length]));
  if (sig !== metaSig) { metaSig = sig; $('#jr').innerHTML = s.quizMeta.map((r, i) => `<option value="${i}">${i + 1}. ${esc(r.emoji)} ${esc(r.title)}</option>`).join(''); fillJq(); }
  // spørgsmål
  const qb = $('#qbox');
  if (!q || ['lobby', 'ended'].includes(s.phase) && !q) qb.innerHTML = '<div class="muted">Ingen spørgsmål endnu.</div>';
  else {
    const o = q.options || [], live = s.liveDist || (s.reveal && s.reveal.dist && s.reveal.dist.counts);
    let opts = '';
    if (['choice', 'tf', 'wager', 'vote'].includes(q.type)) opts = o.map((t, i) => `<div class="copt ${q.correct === i && q.type !== 'vote' ? 'ok' : ''}"><b class="mono">${LETTERS[i]}</b><span>${esc(t)}</span><span class="bar">${live ? live[i] : ''}</span></div>`).join('');
    else if (q.type === 'order') opts = (q.correct || []).map((i, k) => `<div class="copt ok"><b class="mono">${k + 1}</b><span>${esc(o[i])}</span></div>`).join('');
    else opts = `<div class="copt ok"><b>✔</b><span>${esc(correctOf(q))}</span></div>`;
    qb.innerHTML = `<div class="qbox"><div class="row2"><span class="chip ac">${esc(TYPE_LABEL[q.type])}</span><span class="chip">${q.time || s.settings.defaultTime || 20}s</span>${q.clips ? `<span class="chip">Intro-trappen · trin ${(s.stageNow || 0) + 1}/${q.clips.length}</span>` : ''}${s.twist ? `<span class="pill-tw">🎡 ${esc(s.twist.label)}</span>` : ''}
      <span class="chip" style="margin-left:auto"><b class="num">${s.count ? s.count.answered : 0}</b>/${s.count ? s.count.total : 0} har svaret</span></div>
      <div class="p">${esc(q.emoji || '')} ${esc(q.prompt)}</div>${opts}
      ${q.song ? `<div class="muted">🎧 ${esc(q.song.title || q.song.query)} – ${esc(q.song.artist || '')}${q.song.uri ? '' : ' · <b style="color:var(--gold)">ikke matchet til Spotify endnu</b>'}</div>` : ''}
      ${q.fact ? `<div class="muted">💡 ${esc(q.fact)}</div>` : ''}${s.nextQ ? `<div class="muted">Næste: ${esc(s.nextQ.prompt)}</div>` : ''}</div>`;
  }
  // spillere
  $('#pc').textContent = `(${s.players.length}${s.players.some(p => p.bot) ? ', inkl. bots' : ''})`;
  $('#pl').innerHTML = s.players.map(p => {
    const r = s.results && s.results[p.id];
    return `<div class="pr ${p.bot ? 'bot' : ''}" data-id="${p.id}"><span class="rk">${p.rank}</span><span class="nm"><i class="st ${s.phase === 'open' ? (p.answered ? 'on' : '') : p.conn || p.bot ? '' : 'off'} ${s.phase !== 'open' && (p.conn || p.bot) ? 'on' : ''}"></i>${esc(p.name)}${p.team ? `<small>${esc(p.team)}</small>` : ''}${p.joker ? ' 🃏' : ''}${r ? ` <small style="color:${r.pts > 0 ? 'var(--ok)' : r.pts < 0 ? 'var(--no)' : ''}">${r.pts > 0 ? '+' : ''}${r.pts}</small>` : ''}</span>
      <span class="sc">${fmt(p.score)}</span><span class="a"><button data-a="m">−</button><button data-a="p">+</button><button data-a="c">±</button>${s.phase === 'reveal' ? '<button data-a="f" title="Vend rigtig/forkert">✔✘</button>' : ''}<button data-a="k">✕</button></span></div>`;
  }).join('') || '<div class="muted">Ingen er med endnu – vis QR-koden på storskærmen.</div>';
  $('#feed').innerHTML = (s.answers || []).slice(-14).reverse().map(a => `<div><b>${esc(a.name)}</b> → ${esc(a.view)} <span class="muted">${(a.t / 1000).toFixed(1)}s${a.joker ? ' 🃏' : ''}</span></div>`).join('');
  renderSpStatus();
}

/* ---------- Spotify (PKCE + Web Playback SDK) ---------- */
const REDIR = location.origin + '/host';
const SP = { tok: null, exp: 0, ref: null, dev: null, player: null, vol: .8, status: 'off', err: '', timer: null, cur: '', playing: false };
const SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';
const clientId = () => (H && H.settings && H.settings.spotifyClientId || '').trim();
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function spSave() { try { localStorage.setItem('jf_sp', JSON.stringify({ tok: SP.tok, exp: SP.exp, ref: SP.ref })); } catch {} }
async function spLogin() {
  const cid = clientId(); if (!cid) return toast('Indsæt dit Spotify Client ID først', true);
  const v = b64u(crypto.getRandomValues(new Uint8Array(48))), ch = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  localStorage.setItem('jf_spv', v);
  location.href = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({ client_id: cid, response_type: 'code', redirect_uri: REDIR, code_challenge_method: 'S256', code_challenge: ch, scope: SCOPES, state: 'jf' });
}
async function spTokenReq(body) {
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error_description || j.error || 'Spotify-login fejlede');
  SP.tok = j.access_token; SP.exp = Date.now() + j.expires_in * 1000; if (j.refresh_token) SP.ref = j.refresh_token; spSave();
}
async function spToken() {
  if (!SP.tok) throw new Error('Ikke logget ind på Spotify');
  if (Date.now() > SP.exp - 60000) { if (!SP.ref) throw new Error('Spotify-login udløbet – log ind igen'); await spTokenReq({ client_id: clientId(), grant_type: 'refresh_token', refresh_token: SP.ref }); }
  return SP.tok;
}
async function spApi(method, path, body) {
  const t = await spToken();
  const r = await fetch('https://api.spotify.com/v1' + path, { method, headers: Object.assign({ Authorization: 'Bearer ' + t }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
  if (r.status === 204 || r.status === 202) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || 'Spotify-fejl ' + r.status);
  return j;
}
async function spSearch(q) {
  const j = await spApi('GET', '/search?type=track&limit=8&market=DK&q=' + encodeURIComponent(q));
  return ((j.tracks && j.tracks.items) || []).map(t => ({ uri: t.uri, title: t.name, artist: t.artists.map(a => a.name).join(', '), album: t.album.name, cover: (t.album.images[1] || t.album.images[0] || {}).url || '', year: (t.album.release_date || '').slice(0, 4) }));
}
async function spBoot() {
  try { const t = JSON.parse(localStorage.getItem('jf_sp') || 'null'); if (t) { SP.tok = t.tok; SP.exp = t.exp; SP.ref = t.ref; } } catch {}
  const u = new URLSearchParams(location.search);
  if (u.get('code') && u.get('state') === 'jf') {
    try { await spTokenReq({ client_id: await waitCid(), grant_type: 'authorization_code', code: u.get('code'), redirect_uri: REDIR, code_verifier: localStorage.getItem('jf_spv') || '' }); toast('Spotify er logget ind ✔'); document.querySelector('[data-t=spotify]').click(); }
    catch (e) { SP.err = e.message; toast(e.message, true); }
    history.replaceState({}, '', '/host');
  } else if (u.get('error')) { toast('Spotify: ' + u.get('error'), true); history.replaceState({}, '', '/host'); }
  if (SP.tok) spInitPlayer();
  renderSpStatus();
}
async function waitCid() { for (let i = 0; i < 40 && !clientId(); i++) await sleep(150); return clientId(); }
function spInitPlayer() {
  if (SP.player || SP.status === 'loading') return; SP.status = 'loading'; renderSpStatus();
  window.onSpotifyWebPlaybackSDKReady = () => {
    const p = new Spotify.Player({ name: 'JULE FM Quizmaster', getOAuthToken: cb => spToken().then(cb).catch(e => { SP.err = e.message; renderSpStatus(); }), volume: SP.vol });
    p.addListener('ready', ({ device_id }) => { SP.dev = device_id; SP.status = 'ready'; SP.err = ''; renderSpStatus(); spApi('PUT', '/me/player', { device_ids: [device_id], play: false }).catch(() => {}); });
    p.addListener('not_ready', () => { SP.dev = null; SP.status = 'loading'; renderSpStatus(); });
    p.addListener('initialization_error', e => { SP.err = 'Din browser understøtter ikke Spotify-afspilleren (' + e.message + ')'; SP.status = 'error'; renderSpStatus(); });
    p.addListener('authentication_error', e => { SP.err = 'Spotify-login afvist – log ind igen (' + e.message + ')'; SP.status = 'error'; renderSpStatus(); });
    p.addListener('account_error', e => { SP.err = 'Spotify Premium er påkrævet for afspilning (' + e.message + ')'; SP.status = 'error'; renderSpStatus(); });
    p.addListener('playback_error', e => { toast('Afspilningsfejl: ' + e.message, true); });
    p.addListener('player_state_changed', st => { SP.playing = !!(st && !st.paused); SP.cur = st && st.track_window.current_track ? st.track_window.current_track.name + ' – ' + st.track_window.current_track.artists.map(a => a.name).join(', ') : ''; renderSpStatus(); });
    p.connect(); SP.player = p;
  };
  const sc = document.createElement('script'); sc.src = 'https://sdk.scdn.co/spotify-player.js'; sc.onerror = () => { SP.status = 'error'; SP.err = 'Kunne ikke hente Spotify-afspilleren (tjek internet/adblock)'; renderSpStatus(); }; document.head.appendChild(sc);
}
function spStop(fade) {
  clearTimeout(SP.timer); if (!SP.player) return;
  if (!fade) { SP.player.pause(); return; }
  let v = SP.vol; const step = () => { v -= SP.vol / 8; if (v <= 0.02) { SP.player.pause().then(() => SP.player.setVolume(SP.vol)); } else { SP.player.setVolume(v); setTimeout(step, 50); } }; step();
}
async function spPlay(song, posMs, lenMs) {
  if (!SP.dev) throw new Error('Spotify er ikke klar endnu');
  clearTimeout(SP.timer);
  SP.player.setVolume(SP.vol);
  await spApi('PUT', '/me/player/play?device_id=' + SP.dev, { uris: [song.uri], position_ms: Math.max(0, posMs | 0) });
  if (lenMs) SP.timer = setTimeout(() => spStop(true), lenMs);
}
function clipLen(s, q) { const st = s.stageNow || 0; if (q.clips && q.clips[st]) return q.clips[st].ms; return q.song.clipMs || Math.min(((q.time || s.settings.defaultTime || 20) * 1000), 20000); }
function playCurrent(full) {
  const q = H && H.fullQ; if (!q || !q.song) return toast('Spørgsmålet har ingen sang', true);
  if (!q.song.uri) return toast('Sangen er ikke matchet til Spotify – brug fanen Redigér quiz', true);
  if (SP.player) SP.player.activateElement && SP.player.activateElement();
  spPlay(q.song, q.song.startMs || 0, full ? 0 : clipLen(H, q)).catch(e => toast(e.message, true));
}
let mw = { k: '', ph: '' };
function musicWatch(s) {
  const q = s.fullQ, song = q && q.song, ph = s.phase;
  const auto = $('#auto') && $('#auto').checked && SP.dev && song && song.uri;
  if (!auto) { mw.ph = ph; return; }
  const key = q.id + '|' + s.openedAt;
  try {
    if (ph === 'open' && !s.paused) { const k = key + '|' + (s.stageNow || 0); if (mw.k !== k) { mw.k = k; spPlay(song, song.startMs || 0, clipLen(s, q)).catch(e => toast(e.message, true)); } }
    else if (ph === 'locked' && mw.ph !== 'locked') spStop(true);
    else if (ph === 'reveal' && mw.ph !== 'reveal') { mw.k = ''; spPlay(song, song.startMs || 0, 20000).catch(() => {}); }
    else if ((s.paused || ['scoreboard', 'round_intro', 'lobby', 'ready'].includes(ph)) && mw.ph !== ph && SP.playing) spStop(true);
  } catch (e) { toast(e.message, true); }
  mw.ph = ph;
}
function renderSpStatus() {
  const el = $('#spstat'); if (!el) return;
  const q = H && H.fullQ, song = q && q.song;
  const st = SP.status === 'ready' ? '<b style="color:var(--ok)">● Spotify klar</b> – afspilles i denne browser. Tilslut computeren til anlægget/projektoren.' : SP.status === 'loading' ? '⏳ Forbinder til Spotify…' : SP.err ? `<b style="color:var(--no)">${esc(SP.err)}</b>` : SP.tok ? 'Spotify logget ind…' : '<b style="color:var(--gold)">Spotify er ikke koblet til</b> – gå til fanen 🎵 Spotify. Du kan stadig køre quizzen og spille sangene manuelt.';
  el.innerHTML = st + (song && !SP.dev ? `<br>Manuelt: søg efter <b>${esc(song.query || song.title)}</b>${song.startMs ? ' og start ved ' + Math.floor(song.startMs / 60000) + ':' + String(Math.floor(song.startMs / 1000) % 60).padStart(2, '0') : ''}` : '');
  const n = $('#mnow'); if (n) n.innerHTML = SP.cur ? `<span class="eq ${SP.playing ? '' : 'off'}"><b></b><b></b><b></b></span> ${esc(SP.cur)}` : '';
  const sp = $('#spt'), sig = [SP.tok ? 1 : 0, SP.status, SP.err, clientId()].join('|');
  if (sp && sp.dataset.sig !== sig) { const act = document.activeElement; if (!(act && sp.contains(act) && act.tagName === 'INPUT')) { sp.dataset.sig = sig; sp.innerHTML = spTabInner(); } }
}

/* ---------- Spotify-fane ---------- */
function spTabInner() {
  const cid = clientId();
  return `<div class="note"><b>Vigtigt om Spotify:</b> Afspilning kræver at den Spotify-konto, der bliver logget ind på denne side, har <b>Premium</b>. Spotify kræver også, at ejeren af developer-appen har Premium. Musikken afspilles i <i>denne</i> browser (Web Playback SDK) – send lyden til højttalerne via computeren. Spotify tillader ikke baglæns-afspilning eller lydmanipulation, så der er ingen "baglæns"-runde; i stedet bruger quizzen <b>Intro-trappen</b> (klip bliver længere trin for trin).</div>
    <ol class="steps"><li>Gå til <code>developer.spotify.com/dashboard</code> → <b>Create app</b>. Vælg <i>Web API</i> + <i>Web Playback SDK</i>.</li>
      <li>Under <b>Redirect URIs</b> tilføjer du præcis: <code>${esc(REDIR)}</code> <button class="btn sm ghost" onclick="navigator.clipboard.writeText('${esc(REDIR)}');toast('Kopieret')">Kopiér</button><br><span class="muted">Spotify kræver https – det får du automatisk, når quizzen er online. Lokalt skal du bruge <code>http://127.0.0.1:3000/host</code>.</span></li>
      <li>Kopiér <b>Client ID</b> ind herunder og gem. (Der er ingen hemmelig nøgle – siden bruger sikkert PKCE-login.)</li>
      <li>Klik <b>Log ind med Spotify</b> og godkend.</li></ol>
    <div class="row2"><input type="text" id="cid" placeholder="Spotify Client ID" value="${esc(cid)}" style="flex:1;min-width:240px"><button class="btn sm" id="cidS">Gem</button></div>
    <div class="row2"><button class="btn sm" id="spLog">${SP.tok ? '🔄 Log ind igen' : '🎵 Log ind med Spotify'}</button><button class="btn sm ghost" id="spAct" ${SP.status === 'ready' ? '' : 'disabled'}>🔊 Aktivér lyd i browseren</button>
      <button class="btn sm ghost" id="spMatch" ${SP.tok ? '' : 'disabled'}>✨ Match alle sange automatisk</button><button class="btn sm ghost" id="spOut" ${SP.tok ? '' : 'disabled'}>Log ud</button></div>
    <div id="spmsg" class="muted"></div>
    <div class="row2"><input type="text" id="spq" placeholder="Prøvesøgning, fx: Wham Last Christmas" style="flex:1;min-width:220px"><button class="btn sm ghost" id="spqS" ${SP.tok ? '' : 'disabled'}>Søg</button></div><div id="spres" class="stack" style="gap:6px"></div>`;
}
function buildSpotifyTab() { $('#tab-spotify').innerHTML = `<div class="panel" style="max-width:900px"><h3>Spotify-kobling</h3><div id="spt" class="stack" style="gap:12px">${spTabInner()}</div></div>`; $('#spt').onclick = spTabClick; }
async function spTabClick(e) {
  const id = e.target.id;
  if (id === 'cidS') { const v = $('#cid').value.trim(); try { await patchQuiz(q => { q.settings = q.settings || {}; q.settings.spotifyClientId = v; }); toast('Client ID gemt'); } catch (er) { toast(er.message, true); } }
  if (id === 'spLog') { if (!clientId()) { const v = $('#cid').value.trim(); if (!v) return toast('Indsæt Client ID først', true); await patchQuiz(q => { q.settings = q.settings || {}; q.settings.spotifyClientId = v; }); await sleep(400); } spLogin(); }
  if (id === 'spAct') { SP.player && SP.player.activateElement(); toast('Lyd aktiveret'); }
  if (id === 'spOut') { SP.tok = SP.ref = null; SP.dev = null; try { SP.player && SP.player.disconnect(); } catch {} SP.player = null; SP.status = 'off'; localStorage.removeItem('jf_sp'); renderSpStatus(); }
  if (id === 'spqS') { try { const r = await spSearch($('#spq').value); $('#spres').innerHTML = r.map((t, i) => `<div class="hit" data-i="${i}"><img src="${esc(t.cover)}" alt=""><div><b>${esc(t.title)}</b><span>${esc(t.artist)} · ${esc(t.album)} (${esc(t.year)})</span></div></div>`).join('') || '<div class="muted">Ingen resultater</div>'; $('#spres')._r = r; } catch (er) { toast(er.message, true); } }
  const hit = e.target.closest('.hit'); if (hit && $('#spres')._r) { const t = $('#spres')._r[+hit.dataset.i]; if (SP.dev) { SP.player.activateElement(); spPlay(t, 0, 15000).then(() => toast('Spiller 15 sek…')).catch(er => toast(er.message, true)); } else toast('Spotify-afspilleren er ikke klar endnu', true); }
  if (id === 'spMatch') matchAll();
}
async function matchAll() {
  const msg = $('#spmsg'); let n = 0, miss = [];
  try {
    const quiz = await getQuiz(); const qs = quiz.rounds.flatMap(r => r.questions).filter(q => q.song && q.song.query && !q.song.uri);
    for (const q of qs) {
      msg.textContent = `Matcher ${++n} / ${qs.length}: ${q.song.query}…`;
      try {
        const r = await spSearch(q.song.query); if (!r.length) { miss.push(q.song.query); continue; }
        const t = r[0]; Object.assign(q.song, { uri: t.uri, cover: t.cover, album: t.album, title: q.song.title || t.title, artist: q.song.artist || t.artist });
      } catch (er) { miss.push(q.song.query + ' (' + er.message + ')'); }
      await sleep(200);
    }
    await putQuiz(quiz); window.editorReload && window.editorReload();
    msg.innerHTML = `Færdig: ${qs.length - miss.length} af ${qs.length} sange matchet.${miss.length ? '<br>Ikke fundet: ' + miss.map(esc).join(', ') : ''}<br>Tjek i <b>Redigér quiz</b> at det er de rigtige versioner (live-versioner/remix kan snige sig ind) og justér startpunkt.`;
  } catch (er) { msg.textContent = er.message; toast(er.message, true); }
}

/* ---------- Test & nulstil ---------- */
function buildTestTab() {
  $('#tab-test').innerHTML = `<div class="grid"><div class="stack"><div class="panel"><h3>Test uden rigtige deltagere</h3>
      <p class="muted">Bots svarer automatisk (nogle rigtigt, nogle forkert) og fylder stillingen op, så du kan prøve hele forløbet af – inkl. storskærm. Åbn <b>Storskærm</b> og <b>Spillervisning</b> i hver sin fane og tryk "Start showet".</p>
      <div class="row2"><input type="number" id="nb" value="14" min="1" max="60" style="width:90px"><button class="btn sm" id="bAdd">+ Tilføj bots</button><button class="btn sm ghost" id="bDel">Fjern alle bots</button></div>
      <div class="row2"><a class="lnk" href="/tv" target="_blank">📺 Åbn storskærm</a><a class="lnk" href="/" target="_blank">📱 Åbn som spiller</a></div></div>
    <div class="panel"><h3>Nulstil</h3><p class="muted">Nulstil inden julefrokosten, efter du har testet. Spillere kan skrive sig ind igen.</p>
      <div class="row2"><button class="btn sm warn" id="rKeep">Nulstil point – behold spillere</button><button class="btn sm red" id="rAll">Ryd alt (spillere + point)</button></div></div></div>
    <div class="stack"><div class="panel"><h3>Backup af quiz</h3><p class="muted">Gratis webhosts kan miste filer ved genstart. Hent en kopi af quizzen, når du har redigeret færdigt – og indlæs den igen, hvis den er væk.</p>
      <div class="row2"><button class="btn sm" id="bkDl">⬇ Hent quiz som fil</button><label class="btn sm ghost" style="cursor:pointer">⬆ Indlæs quiz-fil<input type="file" id="bkUp" accept=".json" hidden></label><button class="btn sm ghost" id="bkLoc">Gendan sidste lokale backup</button></div></div>
      <div class="panel"><h3>Standardquiz</h3><p class="muted">Gendanner det medfølgende indhold (7 programmer, 34 spørgsmål). Dine ændringer overskrives.</p><button class="btn sm red" id="qDef">Gendan standardquiz</button></div></div></div>`;
  $('#bAdd').onclick = () => act('bots', { n: +$('#nb').value }); $('#bDel').onclick = () => act('rmbots');
  $('#rKeep').onclick = () => confirm('Nulstil alle point og start forfra?') && act('reset', { mode: 'keep' });
  $('#rAll').onclick = () => confirm('Fjern ALLE spillere og start forfra?') && act('reset', { mode: 'all' });
  $('#bkDl').onclick = async () => { const q = await getQuiz(), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(q, null, 1)], { type: 'application/json' })); a.download = 'jule-fm-quiz.json'; a.click(); };
  $('#bkUp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const q = JSON.parse(await f.text()); await putQuiz(q); window.editorReload && window.editorReload(); toast('Quiz indlæst ✔'); } catch (er) { toast(er.message, true); } };
  $('#bkLoc').onclick = async () => { try { const q = JSON.parse(localStorage.getItem('jf_backup')); await putQuiz(q); window.editorReload && window.editorReload(); toast('Gendannet fra lokal backup'); } catch { toast('Ingen lokal backup fundet', true); } };
  $('#qDef').onclick = async () => { if (!confirm('Gendan standardquizzen? Dine ændringer går tabt.')) return; await hostFetch('/api/host/quiz-default', { method: 'POST', body: '{}' }); window.editorReload && window.editorReload(); toast('Standardquiz gendannet'); };
}

boot();
