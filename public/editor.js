/* JULE FM – visuel quiz-editor */
(() => {
  let Q = null, sel = { k: 'settings' }, dirty = false;
  const ICON = { choice: '🔘', tf: '⚖️', text: '✍️', year: '📅', order: '🔢', vote: '🗳️', wager: '🎲' };
  const NAME = { choice: 'Multiple choice', tf: 'Sandt / falsk', text: 'Fritekst', year: 'Årstal (slider)', order: 'Sortér rækkefølge', vote: 'Afstemning / battle', wager: 'Væddemål (sats point)' };
  const NEW = {
    choice: () => ({ type: 'choice', options: ['Svar A', 'Svar B', 'Svar C', 'Svar D'], correct: 0 }),
    tf: () => ({ type: 'tf', options: ['Sandt', 'Falsk'], correct: 0 }),
    text: () => ({ type: 'text', correct: ['Svar'] }),
    year: () => ({ type: 'year', correct: 2000, yearMin: 1960, yearMax: 2025, yearTolerance: 12 }),
    order: () => ({ type: 'order', options: ['Nr. 3', 'Nr. 1', 'Nr. 4', 'Nr. 2'], correct: [1, 3, 0, 2] }),
    vote: () => ({ type: 'vote', options: ['Valg A', 'Valg B'], mode: 'majority', points: 600 }),
    wager: () => ({ type: 'wager', options: ['Svar A', 'Svar B', 'Svar C', 'Svar D'], correct: 0 })
  };
  const KEEP = ['id', 'prompt', 'emoji', 'time', 'points', 'fact', 'hint', 'song', 'clips', 'scoring'];
  const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const cur = () => sel.k === 'round' ? Q.rounds[sel.r] : sel.k === 'q' ? Q.rounds[sel.r].questions[sel.q] : null;
  const setDirty = d => { dirty = d; const b = $('#edSave'); if (b) b.classList.toggle('dirty', d); const l = $('#edState'); if (l) l.textContent = d ? 'Ugemte ændringer' : 'Alt gemt'; };
  addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  window.initEditor = () => {
    $('#tab-edit').innerHTML = `<div class="row2" style="margin-bottom:12px"><button class="btn sm" id="edSave" style="width:auto">💾 Gem ændringer</button><span class="muted" id="edState">Henter…</span>
      <span class="muted" style="margin-left:auto">Ændringer slår igennem med det samme for nye spillere – gem før du starter quizzen.</span></div>
      <div class="ed"><div class="panel"><h3>Program &amp; spørgsmål</h3><div class="tree" id="edTree"></div></div><div class="panel" id="edForm"></div></div>`;
    $('#edSave').onclick = save; window.editorReload();
  };
  window.editorReload = async () => { try { Q = await getQuiz(); } catch (e) { return toast(e.message, true); } if (sel.k !== 'settings') { const r = Q.rounds[sel.r]; if (!r || (sel.k === 'q' && !r.questions[sel.q])) sel = { k: 'settings' }; } setDirty(false); render(); };
  async function save() {
    for (const r of Q.rounds) { if (!r.questions.length) return toast(`Programmet "${r.title}" har ingen spørgsmål`, true);
      for (const q of r.questions) { if (!String(q.prompt || '').trim()) return toast('Et spørgsmål mangler tekst', true); if (['choice', 'wager'].includes(q.type) && !(q.correct >= 0 && q.correct < q.options.length)) return toast(`Vælg rigtigt svar på "${q.prompt}"`, true); if (q.type === 'text' && !(q.correct || []).length) return toast(`"${q.prompt}" mangler rigtige svar`, true); } }
    try { await putQuiz(Q); setDirty(false); toast('Quiz gemt ✔'); await window.editorReload(); } catch (e) { toast(e.message, true); }
  }

  function render() { renderTree(); renderForm(); }
  function renderTree() {
    const t = $('#edTree'); t.innerHTML = '';
    const s = mk('div', 'tr' + (sel.k === 'settings' ? ' sel' : ''), '<span>⚙️</span><span class="t">Quiz-indstillinger</span>'); s.onclick = () => { sel = { k: 'settings' }; render(); }; t.appendChild(s);
    Q.rounds.forEach((r, ri) => {
      const rr = mk('div', 'tr round' + (sel.k === 'round' && sel.r === ri ? ' sel' : ''), `<span>${esc(r.emoji)}</span><span class="t">${ri + 1}. ${esc(r.title)}</span><small>×${r.multiplier || 1}</small>`);
      rr.onclick = () => { sel = { k: 'round', r: ri }; render(); }; t.appendChild(rr);
      r.questions.forEach((q, qi) => { const e = mk('div', 'tr' + (sel.k === 'q' && sel.r === ri && sel.q === qi ? ' sel' : ''), `<span>${ICON[q.type]}</span><span class="t">${esc(q.prompt)}</span>${q.song ? '<span>🎧</span>' : ''}`); e.onclick = () => { sel = { k: 'q', r: ri, q: qi }; render(); }; t.appendChild(e); });
    });
    const add = mk('button', 'btn sm ghost', '+ Nyt program'); add.style.marginTop = '10px';
    add.onclick = () => { Q.rounds.push({ id: 'r' + Math.random().toString(36).slice(2, 7), emoji: '🎵', title: 'Nyt program', blurb: '', multiplier: 1, questions: [Object.assign({ prompt: 'Nyt spørgsmål' }, NEW.choice())] }); sel = { k: 'round', r: Q.rounds.length - 1 }; setDirty(true); render(); };
    t.appendChild(add);
  }
  const L = (label, inner, extra) => `<label class="f" ${extra || ''}><span>${label}</span>${inner}</label>`;
  const inp = (p, v, k, o = '') => `<input type="${k === 'num' ? 'number' : 'text'}" data-p="${p}" data-k="${k || 'str'}" value="${esc(v == null ? '' : v)}" ${o}>`;
  function toolbar(kind) {
    return `<div class="row2" style="margin-bottom:4px"><button class="btn sm ghost" data-m="up">↑ Op</button><button class="btn sm ghost" data-m="down">↓ Ned</button>${kind === 'q' ? '<button class="btn sm ghost" data-m="dup">⧉ Dupliker</button>' : '<button class="btn sm ghost" data-m="addq">+ Spørgsmål</button>'}<button class="btn sm red" data-m="del" style="margin-left:auto">🗑 Slet</button></div>`;
  }
  function renderForm() {
    const f = $('#edForm'); f.innerHTML = '';
    if (sel.k === 'settings') {
      const s = Q.settings = Q.settings || {};
      f.innerHTML = `<h3>Quiz-indstillinger</h3><div class="fgrid">${L('Titel', inp('title', Q.title, 'str'))}${L('Undertitel (vises i lobbyen)', inp('subtitle', Q.subtitle, 'str'))}
        ${L('Standard-tid pr. spørgsmål (sek)', inp('settings.defaultTime', s.defaultTime, 'num', 'min="5" max="120"'))}${L('Basis-point pr. spørgsmål', inp('settings.baseQuestionPoints', s.baseQuestionPoints, 'num', 'min="100" step="50"'))}</div>
        <label class="ck"><input type="checkbox" data-p="settings.teamsEnabled" data-k="bool" ${s.teamsEnabled !== false ? 'checked' : ''}> Hold/borde (spillerne kan skrive et bord ved tilmelding)</label>
        <label class="ck"><input type="checkbox" data-p="settings.autoLock" data-k="bool" ${s.autoLock !== false ? 'checked' : ''}> Lås automatisk når alle har svaret</label>
        <div class="note">Point-systemet: Rigtigt svar giver op til basis-point (hurtigere = flere), årstal giver point efter hvor tæt du er, sortering giver point efter antal rigtige pladser, væddemål vinder/taber indsatsen. Programmer kan have en multiplikator (fx ×2 i finalen). Hver spiller har én 🃏 joker (×2), og 3+ rigtige i træk giver streak-bonus.</div>`;
    } else if (sel.k === 'round') {
      const r = Q.rounds[sel.r];
      f.innerHTML = `<h3>Program ${sel.r + 1}</h3>${toolbar('r')}<div class="fgrid">${L('Emoji', inp('emoji', r.emoji, 'str', 'maxlength="4"'))}${L('Titel', inp('title', r.title, 'str'))}${L('Point-multiplikator', inp('multiplier', r.multiplier || 1, 'num', 'min="1" max="5" step="0.5"'))}</div>${L('Intro-tekst (vises på skærmen)', `<textarea data-p="blurb" data-k="str">${esc(r.blurb || '')}</textarea>`)}
        <div class="muted">Programmets farve følger rækkefølgen automatisk. Det sidste program får mørkt "finale-look".</div>`;
    } else {
      const q = cur();
      f.innerHTML = `<h3>${ICON[q.type]} Spørgsmål ${sel.q + 1} i program ${sel.r + 1}</h3>${toolbar('q')}
        <div class="fgrid">${L('Type', `<select id="edType">${Object.keys(NAME).map(k => `<option value="${k}" ${k === q.type ? 'selected' : ''}>${NAME[k]}</option>`).join('')}</select>`)}${L('Emoji', inp('emoji', q.emoji, 'str', 'maxlength="4"'))}${L('Tid (sek – tom = standard)', inp('time', q.time, 'num', 'min="5" max="120"'))}${L('Basis-point (tom = standard)', inp('points', q.points, 'num', 'min="0" step="50"'))}</div>
        ${L('Spørgsmål', `<textarea data-p="prompt" data-k="str" style="min-height:3.2em">${esc(q.prompt)}</textarea>`)}
        <div id="edAns"></div>
        <div class="fgrid">${L('Sjov fakta (vises efter afsløring)', `<textarea data-p="fact" data-k="str" style="min-height:3em">${esc(q.fact || '')}</textarea>`)}${L('Hint (vises under spørgsmålet)', `<textarea data-p="hint" data-k="str" style="min-height:3em">${esc(q.hint || '')}</textarea>`)}</div>
        <label class="ck"><input type="checkbox" data-p="scoring" data-k="flat" ${q.scoring === 'flat' ? 'checked' : ''}> Ingen hastighedsbonus (fast point for rigtigt svar)</label>
        <div id="edSong" class="stack" style="gap:10px"></div>`;
      $('#edType').onchange = e => { const old = q; const n = NEW[e.target.value](); KEEP.forEach(k => { if (old[k] !== undefined) n[k] = old[k]; }); Q.rounds[sel.r].questions[sel.q] = n; setDirty(true); render(); };
      renderAns(q); renderSong(q);
    }
    bindGeneric(f);
    f.querySelectorAll('[data-m]').forEach(b => b.onclick = () => move(b.dataset.m));
  }
  function setPath(o, path, v) { const ks = path.split('.'); while (ks.length > 1) { const k = ks.shift(); o = o[k] = o[k] || {}; } const last = ks[0]; if (v === undefined || v === '' && last !== 'title' && last !== 'prompt') delete o[last]; else o[last] = v; }
  function bindGeneric(root) {
    root.querySelectorAll('[data-p]').forEach(el => {
      const h = () => {
        const k = el.dataset.k; let v;
        if (k === 'num') v = el.value === '' ? undefined : +el.value;
        else if (k === 'bool') v = el.checked;
        else if (k === 'flat') v = el.checked ? 'flat' : undefined;
        else if (k === 'lines') v = el.value.split('\n').map(s => s.trim()).filter(Boolean);
        else if (k === 'sec') v = el.value === '' ? undefined : Math.round(+el.value * 1000);
        else if (k === 'clips') { const a = el.value.split(/[,;\s]+/).map(Number).filter(n => n > 0); v = a.length ? a.map(n => ({ ms: Math.round(n * 1000) })) : undefined; }
        else v = el.value;
        const tgt = sel.k === 'settings' ? (el.dataset.p === 'title' || el.dataset.p === 'subtitle' ? Q : Q) : cur();
        if (el.dataset.p.startsWith('song.')) { const q = cur(); if (q.song) setPath(q, el.dataset.p, v); } else setPath(tgt, el.dataset.p, v);
        setDirty(true);
        if (['prompt', 'title', 'emoji'].includes(el.dataset.p)) renderTree();
        if (el.dataset.p === 'options') { const q = cur(); if (q.correct >= q.options.length) q.correct = 0; fillCorrect(q); }
      };
      el.oninput = h; el.onchange = h;
    });
  }
  function fillCorrect(q) { const s = $('#edCorrect'); if (s) s.innerHTML = q.options.map((o, i) => `<option value="${i}" ${q.correct === i ? 'selected' : ''}>${LETTERS[i]}. ${esc(o)}</option>`).join(''); }
  function renderAns(q) {
    const a = $('#edAns'); const lines = arr => esc((arr || []).join('\n'));
    if (['choice', 'wager'].includes(q.type)) a.innerHTML = `<div class="fgrid">${L('Svarmuligheder (én pr. linje, 2–6)', `<textarea data-p="options" data-k="lines" style="min-height:7em">${lines(q.options)}</textarea>`)}${L('Rigtigt svar', '<select id="edCorrect" data-p="correct" data-k="num"></select>')}</div>${q.type === 'wager' ? '<div class="muted">Spillerne vælger selv indsats (0 / 25 % / 50 % / 100 % af deres point, min. 1000). Rigtigt = vinder indsatsen, forkert = taber den.</div>' : ''}`;
    else if (q.type === 'tf') a.innerHTML = L('Rigtigt svar', `<select id="edCorrect" data-p="correct" data-k="num"></select>`);
    else if (q.type === 'vote') a.innerHTML = `<div class="fgrid">${L('Valgmuligheder (2–4 linjer)', `<textarea data-p="options" data-k="lines">${lines(q.options)}</textarea>`)}${L('Hvem får point?', `<select data-p="mode" data-k="str"><option value="majority" ${q.mode !== 'minority' ? 'selected' : ''}>Flertallet vinder</option><option value="minority" ${q.mode === 'minority' ? 'selected' : ''}>Mindretallet vinder (omvendt!)</option></select>`)}</div>`;
    else if (q.type === 'text') a.innerHTML = L('Accepterede svar (én pr. linje – stavefejl tilgives, første vises på skærmen)', `<textarea data-p="correct" data-k="lines">${lines(q.correct)}</textarea>`);
    else if (q.type === 'year') a.innerHTML = `<div class="fgrid">${L('Rigtigt årstal', inp('correct', q.correct, 'num'))}${L('Slider fra', inp('yearMin', q.yearMin, 'num'))}${L('Slider til', inp('yearMax', q.yearMax, 'num'))}${L('Tolerance (år til 0 point)', inp('yearTolerance', q.yearTolerance, 'num', 'min="1"'))}</div>`;
    else if (q.type === 'order') {
      a.innerHTML = L('Elementer i RIGTIG rækkefølge (én pr. linje) – spillerne ser dem i blandet rækkefølge', `<textarea id="edOrd" style="min-height:8em">${esc((q.correct || []).map(i => q.options[i]).join('\n'))}</textarea>`);
      $('#edOrd').oninput = e => {
        const items = e.target.value.split('\n').map(s => s.trim()).filter(Boolean); if (items.length < 2) return;
        let idx = items.map((_, i) => i); for (let t = 0; t < 8; t++) { idx = idx.sort(() => Math.random() - .5); if (idx.some((v, i) => v !== i)) break; }
        q.options = idx.map(i => items[i]); q.correct = items.map((_, k) => idx.indexOf(k)); setDirty(true);
      };
    }
    fillCorrect(q);
  }
  function renderSong(q) {
    const box = $('#edSong'), s = q.song;
    if (!s) { box.innerHTML = '<button class="btn sm ghost" id="addSong" style="align-self:flex-start">🎧 Tilføj sang til spørgsmålet</button>'; $('#addSong').onclick = () => { q.song = { query: '', title: '', artist: '', album: '', cover: '', year: '', uri: '', startMs: 0 }; setDirty(true); renderSong(q); }; return; }
    box.innerHTML = `<h3>🎧 Sang</h3>
      <div class="songbox">${s.cover ? `<img src="${esc(s.cover)}" alt="">` : '<div style="font-size:2.4rem">🎵</div>'}<div style="flex:1"><b>${esc(s.title || '(ingen titel)')}</b><br><span class="muted">${esc(s.artist || '')}${s.year ? ' · ' + esc(s.year) : ''}</span><br><span class="muted">${s.uri ? '✔ Matchet til Spotify' : '⚠ Ikke matchet til Spotify endnu'}</span></div>
        <button class="btn sm ghost" id="sTry">▶ Prøv</button><button class="btn sm red" id="sDel">Fjern</button></div>
      <div class="row2"><input type="text" id="sQ" placeholder="Søg: kunstner + titel" value="${esc(s.query || '')}" style="flex:1;min-width:200px"><button class="btn sm" id="sGo">🔎 Find på Spotify</button></div><div id="sRes" class="stack" style="gap:6px"></div>
      <div class="fgrid">${L('Titel (vises ved afsløring)', inp('song.title', s.title, 'str'))}${L('Kunstner', inp('song.artist', s.artist, 'str'))}${L('Udgivelsesår', inp('song.year', s.year, 'str'))}
        ${L('Startpunkt i sangen (sek)', `<input type="number" step="0.5" min="0" data-p="song.startMs" data-k="sec" value="${(s.startMs || 0) / 1000}">`)}
        ${L('Intro-trappen: klip-længder (sek, komma)', `<input type="text" data-p="clips" data-k="clips" placeholder="fx 1.5, 4, 8, 15" value="${esc((q.clips || []).map(c => c.ms / 1000).join(', '))}">`)}${L('Klip-længde uden trappe (sek)', `<input type="number" min="1" step="1" data-p="song.clipMs" data-k="sec" value="${s.clipMs ? s.clipMs / 1000 : ''}" placeholder="15">`)}</div>
      ${q.type === 'year' && s.year ? `<button class="btn sm ghost" id="sYear" style="align-self:flex-start">Brug ${esc(s.year)} som rigtigt årstal</button><div class="muted">Obs: Spotify angiver albummets udgivelsesår – tjek at det passer (opsamlingsalbum viser ofte et senere år).</div>` : ''}
      <div class="muted">Intro-trappen: hvert trin spiller et længere klip fra startpunktet, og point-potten skrumper. Quizzen stepper automatisk mellem trinene.</div>`;
    bindGeneric(box);
    $('#sDel').onclick = () => { delete q.song; delete q.clips; setDirty(true); renderSong(q); renderTree(); };
    $('#sQ').oninput = e => { s.query = e.target.value; setDirty(true); };
    $('#sTry').onclick = () => { if (!s.uri) return toast('Ikke matchet endnu', true); if (!SP.dev) return toast('Spotify er ikke klar – se fanen Spotify', true); SP.player.activateElement(); spPlay(s, s.startMs || 0, 12000).catch(e => toast(e.message, true)); };
    $('#sYear') && ($('#sYear').onclick = () => { q.correct = +s.year; setDirty(true); renderAns(q); });
    $('#sGo').onclick = async () => {
      const qq = $('#sQ').value.trim() || (s.title + ' ' + s.artist).trim(); if (!qq) return;
      if (!SP.tok) return toast('Log ind på Spotify først (fanen Spotify)', true);
      try { const r = await spSearch(qq); const res = $('#sRes'); res.innerHTML = r.map((t, i) => `<div class="hit" data-i="${i}"><img src="${esc(t.cover)}" alt=""><div><b>${esc(t.title)}</b><span>${esc(t.artist)} · ${esc(t.album)} (${esc(t.year)})</span></div></div>`).join('') || '<div class="muted">Ingen resultater</div>';
        res.onclick = e => { const h = e.target.closest('.hit'); if (!h) return; const t = r[+h.dataset.i]; Object.assign(s, { uri: t.uri, cover: t.cover, album: t.album, title: t.title, artist: t.artist, year: t.year, query: qq }); setDirty(true); renderSong(q); toast('Sang valgt'); }; }
      catch (e) { toast(e.message, true); }
    };
  }
  function move(m) {
    const arr = sel.k === 'q' ? Q.rounds[sel.r].questions : Q.rounds, i = sel.k === 'q' ? sel.q : sel.r;
    if (m === 'up' && i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; sel[sel.k === 'q' ? 'q' : 'r'] = i - 1; }
    else if (m === 'down' && i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; sel[sel.k === 'q' ? 'q' : 'r'] = i + 1; }
    else if (m === 'dup') { const c = JSON.parse(JSON.stringify(arr[i])); delete c.id; arr.splice(i + 1, 0, c); sel.q = i + 1; }
    else if (m === 'addq') { Q.rounds[sel.r].questions.push(Object.assign({ prompt: 'Nyt spørgsmål' }, NEW.choice())); sel = { k: 'q', r: sel.r, q: Q.rounds[sel.r].questions.length - 1 }; }
    else if (m === 'del') {
      if (sel.k === 'round' && Q.rounds.length < 2) return toast('Der skal mindst være ét program', true);
      if (!confirm(sel.k === 'q' ? 'Slet dette spørgsmål?' : 'Slet hele programmet med alle spørgsmål?')) return;
      arr.splice(i, 1); sel = sel.k === 'q' ? (arr.length ? { k: 'q', r: sel.r, q: Math.max(0, i - 1) } : { k: 'round', r: sel.r }) : { k: 'round', r: Math.max(0, i - 1) };
    }
    setDirty(true); render();
  }
})();
