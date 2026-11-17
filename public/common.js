/* JULE FM – fælles klientkode: tema, SSE, lyd, konfetti */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('da-DK');
let clockOffset = 0;
const sNow = () => Date.now() + clockOffset;

/* ---------- Temaer: hver runde får sin egen farve ---------- */
const THEMES = {
  night: { bg: '#0B0F14', fg: '#F6EFDD', ac: '#C6FF3D', acfg: '#0B0F14' },
  tomat: { bg: '#E8362A', fg: '#FFF3E0', ac: '#FFD23F', acfg: '#2a0a00' },
  kobolt: { bg: '#2B3BFF', fg: '#FFF3E0', ac: '#C6FF3D', acfg: '#0B0F14' },
  lime: { bg: '#C6FF3D', fg: '#0B0F14', ac: '#E8362A', acfg: '#FFF3E0' },
  pink: { bg: '#FF9ED2', fg: '#2a0a1c', ac: '#2B3BFF', acfg: '#ffffff' },
  gran: { bg: '#0E4D3A', fg: '#F6EFDD', ac: '#FF7A59', acfg: '#240800' },
  guld: { bg: '#FFC53D', fg: '#1b1200', ac: '#E8362A', acfg: '#fff3e0' },
  creme: { bg: '#F6EFDD', fg: '#14201b', ac: '#0E4D3A', acfg: '#F6EFDD' }
};
const ROUND_THEMES = ['tomat', 'kobolt', 'lime', 'pink', 'gran', 'guld', 'night', 'creme'];
function applyTheme(name) {
  const t = THEMES[name] || THEMES.night, st = document.documentElement.style;
  if (document.body.dataset.theme === name) return;
  document.body.dataset.theme = name;
  st.setProperty('--bg', t.bg); st.setProperty('--fg', t.fg); st.setProperty('--ac', t.ac); st.setProperty('--acfg', t.acfg);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t.bg;
}
function themeFor(s) {
  if (!s || !s.round || ['lobby', 'ended'].includes(s.phase)) return 'night';
  if (s.round.idx === s.round.total && s.round.total > 2) return 'night';
  return ROUND_THEMES[(s.round.idx - 1) % ROUND_THEMES.length];
}

/* ---------- Server-sent events med auto-genopretning ---------- */
function connect({ params, onState, onStatus, onFatal }) {
  let es = null, dead = false, fatalAt = 0;
  const url = () => '/api/stream?' + new URLSearchParams(params());
  function open() {
    if (dead) return;
    try { es && es.close(); } catch {}
    es = new EventSource(url());
    es.onopen = () => onStatus && onStatus(true);
    es.onmessage = e => {
      let s; try { s = JSON.parse(e.data); } catch { return; }
      clockOffset = s.now - Date.now();
      onStatus && onStatus(true);
      onState(s);
    };
    es.onerror = () => {
      onStatus && onStatus(false);
      if (es.readyState === 2) { // server afviste (fx 401) – prøv igen om lidt
        if (onFatal && Date.now() - fatalAt > 4000) { fatalAt = Date.now(); onFatal(); }
        setTimeout(open, 2500);
      }
    };
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && (!es || es.readyState !== 1)) open(); });
  addEventListener('online', open);
  open();
  return { close() { dead = true; try { es.close(); } catch {} } };
}
async function post(url, body, token) {
  const r = await fetch(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'x-host-token': token } : {}), body: JSON.stringify(body || {}) });
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok && !j.error) j.error = 'Fejl ' + r.status;
  return Object.assign({ _status: r.status }, j);
}

/* ---------- Lydeffekter (syntetiseret – ingen filer) ---------- */
const Sfx = (() => {
  let ctx = null, on = true;
  const C = () => { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; };
  function tone(f, d = .15, type = 'sine', v = .18, at = 0, slide = 0) {
    if (!on) return; const c = C(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .05);
  }
  function noise(d = .3, v = .08, at = 0, hp = 800) {
    if (!on) return; const c = C(); if (!c) return;
    const b = c.createBuffer(1, c.sampleRate * d, c.sampleRate), a = b.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
    const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    g.gain.value = v; s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start(c.currentTime + at);
  }
  const arp = (notes, step = .09, type = 'triangle', v = .16, d = .22) => notes.forEach((n, i) => tone(n, d, type, v, i * step));
  return {
    unlock() { C(); }, set(v) { on = v; }, get on() { return on; },
    tick() { tone(1200, .05, 'square', .05); },
    beep() { tone(660, .12, 'square', .07); },
    go() { arp([523, 659, 784, 1047], .06, 'square', .08, .16); },
    lock() { tone(220, .25, 'sawtooth', .1, 0, 110); },
    ok() { arp([659, 880, 1175], .08, 'triangle', .16); },
    no() { tone(180, .35, 'sawtooth', .12, 0, 90); },
    reveal() { noise(.5, .1, 0, 2000); arp([392, 523, 659, 784], .07, 'triangle', .14); },
    whoosh() { noise(.45, .09, 0, 400); tone(200, .4, 'sine', .08, 0, 900); },
    pop() { tone(500, .1, 'sine', .12, 0, 900); },
    drum() { for (let i = 0; i < 28; i++) tone(90 + i * 3, .09, 'triangle', .08 + i * .004, i * (.16 - i * .003)); },
    fanfare() { arp([523, 523, 523, 698, 880, 784, 880, 1047], .13, 'sawtooth', .09, .4); tone(1047, 1.4, 'triangle', .14, 1.05); },
    spin(n = 22) { for (let i = 0; i < n; i++) tone(500 + (i % 3) * 120, .04, 'square', .05, i * (.07 + i * .004)); }
  };
})();

/* ---------- Konfetti ---------- */
const Confetti = (() => {
  let cv, cx, ps = [], raf = 0, W = 0, H = 0;
  const COL = () => { const s = getComputedStyle(document.documentElement); return [s.getPropertyValue('--ac').trim(), s.getPropertyValue('--fg').trim(), '#FFC53D', '#FF3B2F', '#2BD97C', '#7B8CFF', '#FF9ED2']; };
  function init() {
    cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99';
    document.body.appendChild(cv); cx = cv.getContext('2d'); size(); addEventListener('resize', size);
  }
  function size() { const d = Math.min(2, devicePixelRatio || 1); W = cv.width = innerWidth * d; H = cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); W /= d; H /= d; }
  function frame() {
    cx.clearRect(0, 0, W, H);
    ps = ps.filter(p => p.y < H + 40 && p.life > 0);
    for (const p of ps) {
      p.vy += p.g; p.vx *= .992; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.globalAlpha = Math.min(1, p.life / 40);
      if (p.s) { cx.beginPath(); cx.arc(0, 0, p.w / 2, 0, 7); cx.fill(); } else cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      cx.restore();
    }
    raf = ps.length ? requestAnimationFrame(frame) : 0;
    if (!raf) cx.clearRect(0, 0, W, H);
  }
  function burst(n = 120, o = {}) {
    if (!cv) init(); const col = COL(), x0 = (o.x ?? .5) * W, y0 = (o.y ?? .45) * H, pw = o.power || 1;
    for (let i = 0; i < n; i++) {
      const a = o.down ? Math.PI / 2 + (Math.random() - .5) * 2.4 : -Math.PI / 2 + (Math.random() - .5) * (o.spread || 2.2), sp = (6 + Math.random() * 11) * pw;
      ps.push({ x: o.down ? Math.random() * W : x0, y: o.down ? -20 : y0, vx: Math.cos(a) * sp * (o.down ? .3 : 1), vy: Math.sin(a) * sp * (o.down ? .4 : 1), g: .22 + Math.random() * .12,
        w: 6 + Math.random() * 9, h: 8 + Math.random() * 12, r: Math.random() * 6, vr: (Math.random() - .5) * .35, c: col[i % col.length], s: Math.random() < .25, life: 140 + Math.random() * 100 });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }
  return { burst, show: n => { burst(n, { x: .2, y: .9, spread: 1, power: 1.3 }); burst(n, { x: .8, y: .9, spread: 1, power: 1.3 }); }, rain: n => burst(n, { down: true }) };
})();

/* ---------- Snefnug (kun til lobby/finale) ---------- */
function snow(on) {
  let cv = $('canvas.snow');
  if (!on) { if (cv) cv.remove(); return; }
  if (cv) return;
  cv = document.createElement('canvas'); cv.className = 'snow'; document.body.appendChild(cv);
  const cx = cv.getContext('2d'); let W, H, fl = [];
  const rs = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; fl = Array.from({ length: Math.round(W * H / 14000) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: .8 + Math.random() * 2.6, v: .3 + Math.random() * .9, p: Math.random() * 6 })); };
  rs(); addEventListener('resize', rs);
  (function loop() { if (!cv.isConnected) return; cx.clearRect(0, 0, W, H); cx.fillStyle = 'rgba(246,239,221,.75)'; for (const f of fl) { f.y += f.v; f.p += .01; f.x += Math.sin(f.p) * .4; if (f.y > H + 5) { f.y = -5; f.x = Math.random() * W; } cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, 7); cx.fill(); } requestAnimationFrame(loop); })();
}

/* ---------- Tæller-animation ---------- */
function countUp(el, to, ms = 900, from = 0) {
  const t0 = performance.now(); el._cu = t0;
  (function step(t) { if (el._cu !== t0) return; const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); })(t0);
}

/* ---------- Timer-bjælke ---------- */
function runTimer(bar, getState) {
  const inner = bar.firstElementChild;
  (function loop() {
    const s = getState();
    if (!s) { inner.style.transform = 'scaleX(0)'; return requestAnimationFrame(loop); }
    const total = Math.max(1, s.deadline - s.openedAt), left = Math.max(0, s.deadline - sNow());
    inner.style.transform = 'scaleX(' + (s.frozen ? s.frozenK : left / total) + ')';
    bar.classList.toggle('low', left < 5000 && left > 0);
    requestAnimationFrame(loop);
  })();
}
const secsLeft = s => Math.max(0, Math.ceil((s.deadline - (s.paused ? s.now : sNow())) / 1000));
const TYPE_LABEL = { choice: 'Vælg svar', tf: 'Sandt / falsk', text: 'Skriv svaret', year: 'Gæt årstallet', order: 'Sortér', vote: 'Stem', wager: 'Væddemål' };
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
