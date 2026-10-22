// LizzoLevi MC: Tabs, Pixel-Sprites, Startseite und die Rechner (Nether, Formen, Verzaubern).
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem('mc.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mc.' + k, JSON.stringify(v)); } catch { /* privat/blockiert */ } },
};
const fmt = n => n.toLocaleString('de-DE');

// Lokal: bei jeder Dateiänderung neu laden (dev.py liefert /__version)
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  let last = null;
  setInterval(() => fetch('/__version', { cache: 'no-store' }).then(r => r.text()).then(v => {
    if (last && v !== last) location.reload();
    last = v;
  }).catch(() => {}), 1000);
}

/* ================= Pixel-Sprites (prozedural, 16×16) ================= */
function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

const SPRITES = {
  grass(p, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const drip = y === 4 && r() < .55 || y === 5 && r() < .2;
      p(x, y, y < 4 || drip ? pick(r, ['#5d9a3a', '#6aab42', '#4f8a30', '#73b548']) : pick(r, ['#7a5639', '#8b6342', '#6b4a30', '#7a5639', '#9a7450']));
    }
  },
  dirt(p, r) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, pick(r, ['#7a5639', '#8b6342', '#6b4a30', '#9a7450'])); },
  stone(p, r) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, pick(r, ['#7f7f7f', '#8a8a8a', '#747474', '#969696', '#7f7f7f'])); },
  bricks(p, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = y >> 2, off = row % 2 ? 4 : 0;
      const mortar = y % 4 === 3 || (x + off) % 8 === 7;
      p(x, y, mortar ? pick(r, ['#b5a99c', '#a89c8f']) : pick(r, ['#9c4a3a', '#8a3f31', '#a85543', '#93463a']));
    }
  },
  emerald(p) {
    // Smaragd: Raute mit hellen Kanten
    for (let y = 1; y < 15; y++) { const half = y < 8 ? y - 1 : 14 - y;
      for (let x = 7 - half; x <= 8 + half; x++) {
        const edge = x === 7 - half || x === 8 + half;
        p(x, y, edge ? '#0f6b2c' : (x + y) % 4 === 0 ? '#8af5b0' : y < 6 ? '#41d07a' : y < 10 ? '#17b14b' : '#0e8a37');
      } }
    p(6, 4, '#ffffff'); p(5, 5, '#d8ffe6');
  },
  netherrack(p, r) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, pick(r, ['#6f2222', '#7d2a2a', '#5e1b1b', '#8e3434', '#6f2222'])); },
  portal(p, r) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const frame = x < 3 || x > 12 || y < 2 || y > 13;
      if (frame) p(x, y, pick(r, ['#1a1028', '#231537', '#140b20', '#2e1d47']));
      else {
        const w = Math.sin((x * .9 + y * .5) + r() * .8);
        p(x, y, w > .4 ? '#b26bff' : w > -.2 ? '#8a3df0' : '#5a1aa8');
      }
    }
  },
  ring(p) {
    // Kreis mit Durchmesser 14 aus dem Formen-Rechner, Rand in Stein
    const g = shapeGrid({ shape: 'kreis', w: 14, d: 14, h: 1, hollow: true, t: 1 });
    for (let z = 0; z < 14; z++) for (let x = 0; x < 14; x++) if (g.cells[z * 14 + x])
      p(x + 1, z + 1, (x + z) % 3 ? '#9a9a9a' : '#7a7a7a');
    p(7, 7, '#3cb6bd'); p(8, 8, '#3cb6bd'); p(7, 8, '#2a9aa0'); p(8, 7, '#2a9aa0');
  },
  book(p, r) {
    for (let y = 2; y < 14; y++) for (let x = 3; x < 13; x++) {
      let c = pick(r, ['#7a3f1e', '#6b3518', '#86492a']);
      if (x === 3) c = '#4a230d';
      if (x === 12 || y === 13) c = '#e8dcc0';
      if (y === 2) c = '#5a2a10';
      p(x, y, c);
    }
    for (let x = 5; x < 11; x++) p(x, 6, '#c9a85a');
    for (let i = 0; i < 9; i++) { const x = 4 + i, y = 12 - i; if (x < 12 && y > 2) p(x, y, '#c48bff'); }
    p(10, 4, '#fff'); p(6, 10, '#e0c6ff');
  }
};
// Einfarbige Blöcke mit Rauschen (Materialien im Formen-Rechner)
const BLOCKS = {
  stone: { name: 'Stein', c: ['#7f7f7f', '#8a8a8a', '#747474', '#969696'] },
  quartz: { name: 'Quarz', c: ['#ece6dc', '#e3dccf', '#f3eee6', '#ddd5c7'] },
  glass: { name: 'Glas', c: ['#cfeef5', '#bfe6f0', '#dff6fa', '#a9d9e6'], edge: '#e8fbff' },
  prismarine: { name: 'Prismarin', c: ['#5fa898', '#4f9a8a', '#6bb8a6', '#4a8f86'] },
  planks: { name: 'Eichenholz', c: ['#a8814f', '#9c7646', '#b48c58', '#8f6b3e'], lines: '#7a5a32' },
  bricks: { name: 'Ziegel' },
  concrete: { name: 'Beton weiß', c: ['#d6dcdd', '#d0d6d7', '#dbe1e2'] },
  blackstone: { name: 'Schwarzstein', c: ['#2c2830', '#363038', '#24212a', '#3e3742'] },
};
SPRITES.solid = (p, r, key) => {
  const b = BLOCKS[key];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let c = pick(r, b.c);
    if (b.lines && y % 4 === 3) c = b.lines;
    if (b.edge && (x === 0 || y === 0 || x === 15 || y === 15 || (x === y && x > 9))) c = b.edge;
    p(x, y, c);
  }
};
const canvasCache = {}, urlCache = {};
function spriteCanvas(name, arg) {
  const key = name + (arg || '');
  if (canvasCache[key]) return canvasCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const x = c.getContext('2d'); const r = rng([...key].reduce((a, ch) => a * 31 + ch.charCodeAt(0) | 0, 7));
  SPRITES[name]((px, py, col) => { x.fillStyle = col; x.fillRect(px, py, 1, 1); }, r, arg);
  return canvasCache[key] = c;
}
function sprite(name, arg) {
  const key = name + (arg || '');
  return urlCache[key] || (urlCache[key] = spriteCanvas(name, arg).toDataURL());
}
const blockSprite = k => k === 'bricks' ? spriteCanvas('bricks') : spriteCanvas('solid', k);
// Mittlere Farbe eines Sprites (für die 3D-Vorschau)
const avgCache = {};
function blockColor(k) {
  if (avgCache[k]) return avgCache[k];
  const d = blockSprite(k).getContext('2d').getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  return avgCache[k] = [r / 256, g / 256, b / 256];
}
function paintSprites(root = document) {
  $$('img[data-sprite]', root).forEach(img => { const [n, a] = img.dataset.sprite.split(':'); img.src = sprite(n, a); });
}

/* ================= Tabs ================= */
const TABS = ['home', 'gebaeude', 'nether', 'formen', 'verzaubern', 'handel'];
const inited = {};
function show(tab) {
  if (!TABS.includes(tab)) tab = 'home';
  $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  $$('section.pane').forEach(s => { s.hidden = s.id !== tab; });
  document.title = tab === 'home' ? 'LizzoLevi MC' : $(`.tab[data-tab="${tab}"]`).textContent.trim() + ' · LizzoLevi MC';
  if (show.cur && show.cur !== tab) scrollTo({ top: 0 }); // neuer Tab beginnt oben
  show.cur = tab;
  if (!inited[tab]) { inited[tab] = true; (INIT[tab] || (() => {}))(); }
  $(`.tab[data-tab="${tab}"]`).scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
$$('.tab').forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.tab; }));
$$('[data-go]').forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.go; scrollTo({ top: 0 }); }));
window.addEventListener('hashchange', () => show(location.hash.slice(1)));

function toast(html) {
  const t = $('#toast'); t.innerHTML = html; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1600);
}
function copy(text) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
    () => toast('<span class="t-cost">Kopiert!</span>'), () => toast('Kopieren ging nicht'));
}

const INIT = {};

/* ================= Home: Pixel-Landschaft nach echter Uhrzeit ================= */
const SPLASHES = ['Jetzt mit Rechnern!', 'Kuppel inklusive!', '100% Blöcke!', 'Kuschelrad!', 'Nicht zu teuer!', 'Auch im Nether!',
  'Rund wie ein Kreis!', 'Endermen hassen ihn!', 'Lizzo + Levi!', 'Ellipsen!', 'Pixelig!', 'Mit Liebe gebaut!'];

INIT.home = () => {
  $('#splash').textContent = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
  $('#placeCount').textContent = store.get('places', []).length;
  const cv = $('#heroCanvas'), ctx = cv.getContext('2d');
  const P = 4; // Bildschirm-Pixel pro Spiel-Pixel
  const r = rng(42);
  const hill = [];
  let clouds = [];
  function setup() {
    const W = Math.ceil(cv.clientWidth / P), H = Math.ceil(cv.clientHeight / P);
    cv.width = W; cv.height = H;
    hill.length = 0;
    const cols = Math.ceil(W / 8) + 1;
    let h = 7;
    for (let i = 0; i < cols; i++) { h = Math.max(4, Math.min(11, h + Math.round((r() - .5) * 2.4))); hill.push(h); }
    clouds = Array.from({ length: Math.ceil(W / 60) + 2 }, () => ({ x: r() * W, y: 6 + r() * H * .3, w: 14 + Math.floor(r() * 4) * 6, s: .04 + r() * .05 }));
  }
  const grassTop = ['#5d9a3a', '#6aab42', '#4f8a30'], dirtC = ['#7a5639', '#8b6342', '#6b4a30'], stoneC = ['#7f7f7f', '#8a8a8a', '#747474'];
  function draw(t) {
    const W = cv.width, H = cv.height;
    const now = new Date(), hr = now.getHours() + now.getMinutes() / 60;
    // 0 = Nacht, 1 = Tag; weicher Übergang um 6–8 und 19–21 Uhr
    const day = Math.max(0, Math.min(1, hr < 12 ? (hr - 6) / 2 : (21 - hr) / 2));
    const sunset = Math.max(0, 1 - Math.abs(hr < 12 ? hr - 7 : hr - 20) / 1.5);
    const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    const top = mix([12, 16, 40], [100, 150, 255], day), bot = mix(mix([30, 34, 70], [170, 205, 255], day), [255, 150, 90], sunset * .7);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${top})`); g.addColorStop(1, `rgb(${bot})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Sterne
    if (day < .6) { const sr = rng(7); ctx.fillStyle = `rgba(255,255,255,${(1 - day / .6) * .9})`;
      for (let i = 0; i < W * H / 260; i++) { const x = sr() * W | 0, y = sr() * H * .6 | 0; if ((i + (t / 900 | 0)) % 9) ctx.fillRect(x, y, 1, 1); } }
    // Sonne/Mond wandern über den Himmel (6–18 Sonne, sonst Mond)
    const isSun = hr >= 6 && hr < 18, k = isSun ? (hr - 6) / 12 : ((hr + 6) % 24) / 12;
    const bx = W * (.08 + .84 * k), by = H * (.62 - Math.sin(Math.PI * k) * .48);
    ctx.fillStyle = isSun ? '#fff6a0' : '#e6e6f0'; ctx.fillRect(bx - 8, by - 8, 16, 16);
    ctx.fillStyle = isSun ? '#ffe14a' : '#c8c8d8'; ctx.fillRect(bx - 6, by - 6, 12, 12);
    if (!isSun) { ctx.fillStyle = '#a8a8b8'; ctx.fillRect(bx - 3, by - 2, 3, 3); ctx.fillRect(bx + 2, by + 1, 2, 2); }
    // Wolken
    ctx.fillStyle = `rgba(255,255,255,${.45 + day * .45})`;
    clouds.forEach(c => { const x = ((c.x + t * c.s / 16) % (W + c.w + 20)) - c.w - 10;
      ctx.fillRect(Math.round(x), Math.round(c.y), c.w, 4); ctx.fillRect(Math.round(x) + 6, Math.round(c.y) - 3, c.w - 12, 3); });
    // Gelände aus 8×8-Blöcken
    const shade = .45 + day * .55;
    ctx.save(); ctx.globalAlpha = 1;
    const tr = rng(3);
    hill.forEach((h, i) => {
      const x0 = i * 8, groundY = H - h * 8;
      for (let y = groundY; y < H; y += 8) {
        const depth = (y - groundY) / 8;
        for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) {
          let c = depth === 0 ? (py < 2 || (py === 2 && tr() < .5) ? pick(tr, grassTop) : pick(tr, dirtC)) : depth < 3 ? pick(tr, dirtC) : pick(tr, stoneC);
          ctx.fillStyle = c; ctx.fillRect(x0 + px, y + py, 1, 1);
        }
      }
      // Bäume
      if (i % 7 === 3) {
        ctx.fillStyle = '#6b4a30'; ctx.fillRect(x0 + 3, groundY - 14, 2, 14);
        ctx.fillStyle = '#3f7a28'; ctx.fillRect(x0 - 2, groundY - 22, 12, 9); ctx.fillStyle = '#4f8a30'; ctx.fillRect(x0, groundY - 26, 8, 5);
      }
    });
    ctx.restore();
    // Nachtschatten über allem
    if (shade < 1) { ctx.fillStyle = `rgba(8,10,30,${(1 - shade) * .8})`; ctx.fillRect(0, H * .45, W, H); }
    $('#clock').textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + (isSun ? ' ☀' : ' ☾');
  }
  setup();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t0 = performance.now();
  (function loop(now) {
    if (!$('#home').hidden) draw(still ? 0 : now - t0);
    if (!still) requestAnimationFrame(loop);
  })(performance.now());
  if (still) draw(0);
  addEventListener('resize', () => { setup(); draw(0); });
};

/* ================= Nether-Rechner ================= */
INIT.nether = () => {
  const f = { owX: $('#owX'), owY: $('#owY'), owZ: $('#owZ'), neX: $('#neX'), neY: $('#neY'), neZ: $('#neZ') };
  const num = el => { const v = parseFloat(el.value.replace(',', '.')); return Number.isFinite(v) ? v : null; };
  const st = store.get('nether', { ow: ['', '', ''] });
  [f.owX.value, f.owY.value, f.owZ.value] = st.ow;

  function tpLine(dim, x, y, z) {
    if (x == null || z == null) return '';
    return `/execute in minecraft:${dim} run tp @s ${x} ${y ?? '~'} ${z}`;
  }
  function render() {
    const ow = [num(f.owX), num(f.owY), num(f.owZ)], ne = [num(f.neX), num(f.neY), num(f.neZ)];
    $('#owTp').textContent = tpLine('overworld', ...ow.map(v => v == null ? null : Math.floor(v))) || 'Koordinaten eingeben …';
    $('#neTp').textContent = tpLine('the_nether', ...ne.map(v => v == null ? null : Math.floor(v))) || 'Koordinaten eingeben …';
    store.set('nether', { ow: [f.owX.value, f.owY.value, f.owZ.value] });
  }
  // Oberwelt → Nether: abrunden wie das Spiel (floor(x / 8)); Nether → Oberwelt: × 8
  function fromOw() {
    const [x, y, z] = [num(f.owX), num(f.owY), num(f.owZ)];
    f.neX.value = x == null ? '' : Math.floor(x / 8);
    f.neY.value = y == null ? '' : Math.floor(y);
    f.neZ.value = z == null ? '' : Math.floor(z / 8);
    render();
  }
  function fromNe() {
    const [x, y, z] = [num(f.neX), num(f.neY), num(f.neZ)];
    f.owX.value = x == null ? '' : Math.floor(x * 8);
    f.owY.value = y == null ? '' : Math.floor(y);
    f.owZ.value = z == null ? '' : Math.floor(z * 8);
    render();
  }
  [f.owX, f.owY, f.owZ].forEach(el => el.addEventListener('input', fromOw));
  [f.neX, f.neY, f.neZ].forEach(el => el.addEventListener('input', fromNe));
  ['#owTp', '#neTp'].forEach(s => $(s).addEventListener('click', e => { if (e.target.textContent.startsWith('/')) copy(e.target.textContent); }));

  // F3+C-Text oder einfach drei Zahlen
  $('#paste').addEventListener('input', e => {
    const s = e.target.value, info = $('#pasteInfo');
    const nums = (s.match(/-?\d+(?:[.,]\d+)?/g) || []).map(n => parseFloat(n.replace(',', '.')));
    if (nums.length < 3) { info.textContent = s.trim() ? 'Keine drei Zahlen gefunden.' : ''; return; }
    const nether = /the_nether/.test(s);
    const [x, y, z] = nums;
    if (nether) { f.neX.value = Math.floor(x); f.neY.value = Math.floor(y); f.neZ.value = Math.floor(z); fromNe(); }
    else { f.owX.value = Math.floor(x); f.owY.value = Math.floor(y); f.owZ.value = Math.floor(z); fromOw(); }
    info.innerHTML = `Erkannt: <b>${nether ? 'Nether' : /the_end/.test(s) ? 'End (als Oberwelt gerechnet)' : 'Oberwelt'}</b> · ${Math.floor(x)} / ${Math.floor(y)} / ${Math.floor(z)}`;
  });

  // Gespeicherte Orte
  function renderPlaces() {
    const list = store.get('places', []), box = $('#places');
    $('#placeCount').textContent = list.length;
    if (!list.length) { box.innerHTML = '<div class="empty">Noch keine Orte. Gib oben Koordinaten ein und speichere sie mit einem Namen.</div>'; return; }
    box.innerHTML = '';
    list.forEach((p, i) => {
      const el = document.createElement('div'); el.className = 'place';
      const nx = Math.floor(p.x / 8), nz = Math.floor(p.z / 8);
      el.innerHTML = `<img class="px" src="${sprite(i % 2 ? 'portal' : 'grass')}" alt="">
        <div><b></b><div class="c"><span>Oberwelt <i>${p.x} / ${p.y} / ${p.z}</i></span><span>Nether <i>${nx} / ${p.y} / ${nz}</i></span></div></div>
        <div class="acts"><button class="mcbtn sm" data-a="use" title="Oben einsetzen">↑</button><button class="mcbtn sm" data-a="del" title="Löschen">✕</button></div>`;
      $('b', el).textContent = p.name;
      el.addEventListener('click', e => {
        const a = e.target.closest('button')?.dataset.a;
        if (a === 'use') { f.owX.value = p.x; f.owY.value = p.y; f.owZ.value = p.z; fromOw(); scrollTo({ top: 0, behavior: 'smooth' }); }
        if (a === 'del') { list.splice(i, 1); store.set('places', list); renderPlaces(); }
      });
      box.append(el);
    });
  }
  $('#placeAdd').addEventListener('click', () => {
    const x = num(f.owX), z = num(f.owZ);
    if (x == null || z == null) { toast('Erst Koordinaten eingeben'); return; }
    const name = $('#placeName').value.trim() || `Ort ${store.get('places', []).length + 1}`;
    const list = store.get('places', []);
    list.unshift({ name, x: Math.floor(x), y: Math.floor(num(f.owY) ?? 64), z: Math.floor(z) });
    store.set('places', list); $('#placeName').value = ''; renderPlaces();
    toast(`<span class="t-name">${name.replace(/</g, '&lt;')}</span> gespeichert`);
  });
  $('#placeName').addEventListener('keydown', e => { if (e.key === 'Enter') $('#placeAdd').click(); });

  fromOw(); renderPlaces();
};

/* ================= Formen: Rasterberechnung ================= */
// Liefert ein Raster w×h×d (h = Ebenen). Blockmitten werden gegen die Ellipsengleichung geprüft,
// hohle Formen behalten alle Blöcke mit Abstand ≤ t zur Außenseite (Schritte über Kanten-Nachbarn).
function shapeGrid({ shape, w, d, h, hollow, t }) {
  if (shape === 'kreis') { d = w; h = 1; }
  if (shape === 'ellipse') h = 1;
  if (shape === 'kugel') { d = w; h = w; }
  const a = w / 2, c = d / 2, cx = (w - 1) / 2, cz = (d - 1) / 2, cy = (h - 1) / 2;
  const N = w * h * d, cells = new Uint8Array(N);
  const id = (x, y, z) => (y * d + z) * w + x;
  for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    let q = ((x - cx) / a) ** 2 + ((z - cz) / c) ** 2;
    if (shape === 'kugel') q += ((y - cy) / (h / 2)) ** 2;
    if (shape === 'kuppel') q += (y / h) ** 2;
    if (q <= 1) cells[id(x, y, z)] = 1;
  }
  if (hollow) {
    const flat = h === 1;
    const nb = flat ? [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]] : [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]];
    // Außerhalb zählt als „draußen“, außer unter der Kuppel (dort ist Boden)
    const outside = (x, y, z) => {
      if (x < 0 || z < 0 || x >= w || z >= d || y >= h) return true;
      if (y < 0) return shape !== 'kuppel';
      return !cells[id(x, y, z)];
    };
    const dist = new Int16Array(N); const q = [];
    for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      if (!cells[id(x, y, z)]) continue;
      if (nb.some(([dx, dy, dz]) => outside(x + dx, y + dy, z + dz))) { dist[id(x, y, z)] = 1; q.push(x, y, z); }
    }
    for (let i = 0; i < q.length; i += 3) {
      const x = q[i], y = q[i + 1], z = q[i + 2], dv = dist[id(x, y, z)];
      if (dv >= t) continue;
      for (const [dx, dy, dz] of nb) {
        const X = x + dx, Y = y + dy, Z = z + dz;
        if (X < 0 || Y < 0 || Z < 0 || X >= w || Y >= h || Z >= d) continue;
        const j = id(X, Y, Z);
        if (cells[j] && !dist[j]) { dist[j] = dv + 1; q.push(X, Y, Z); }
      }
    }
    for (let i = 0; i < N; i++) if (!dist[i]) cells[i] = 0;
  }
  return { w, h, d, cells, id };
}

/* ================= Formen: Oberfläche ================= */
INIT.formen = () => {
  const S = Object.assign({ shape: 'kreis', w: 21, d: 13, h: 10, hollow: true, t: 1, mat: 'stone' }, store.get('shape', {}));
  let G = null, layer = 0, done = new Set(), sel = null;
  const gridCv = $('#grid'), gctx = gridCv.getContext('2d');
  const isoCv = $('#iso');

  // Regler + Zahlenfeld koppeln
  function bind(key, rangeId, numId) {
    const r = $(rangeId), n = $(numId);
    const set = v => { v = Math.max(+r.min, Math.min(+r.max, Math.round(v) || +r.min)); S[key] = v; r.value = v; n.value = v; recompute(); };
    r.addEventListener('input', () => set(+r.value));
    n.addEventListener('change', () => set(+n.value));
    r.value = n.value = S[key];
  }
  bind('w', '#sW', '#sWn'); bind('d', '#sD', '#sDn'); bind('h', '#sH', '#sHn');
  $('#sT').value = S.t; $('#sTo').textContent = S.t;
  $('#sT').addEventListener('input', e => { S.t = +e.target.value; $('#sTo').textContent = S.t; recompute(); });

  const segs = (sel, attr, key, map = v => v) => $$(sel + ' button').forEach(b => {
    b.setAttribute('aria-pressed', map(b.dataset[attr]) === S[key]);
    b.addEventListener('click', () => {
      S[key] = map(b.dataset[attr]);
      $$(sel + ' button').forEach(x => x.setAttribute('aria-pressed', x === b));
      recompute(true);
    });
  });
  segs('#shapeSeg', 'shape', 'shape');
  segs('#fillSeg', 'fill', 'hollow', v => v === 'hohl');

  const mats = $('#mats');
  Object.entries(BLOCKS).forEach(([k, b]) => {
    const btn = document.createElement('button');
    btn.title = b.name; btn.setAttribute('aria-label', b.name); btn.setAttribute('aria-pressed', k === S.mat);
    btn.innerHTML = `<img class="px" src="${k === 'bricks' ? sprite('bricks') : sprite('solid', k)}" alt="">`;
    btn.addEventListener('click', () => { S.mat = k; $$('button', mats).forEach(x => x.setAttribute('aria-pressed', x === btn)); save(); drawGrid(); drawIso(); });
    mats.append(btn);
  });
  $('#resetDone').addEventListener('click', () => { done.clear(); drawGrid(); stats(); });

  const lr = $('#lRange');
  lr.addEventListener('input', () => { layer = +lr.value; sel = null; drawAll(); });
  $('#lPrev').addEventListener('click', () => { if (layer > 0) { layer--; lr.value = layer; sel = null; drawAll(); } });
  $('#lNext').addEventListener('click', () => { if (layer < G.h - 1) { layer++; lr.value = layer; sel = null; drawAll(); } });

  function save() { store.set('shape', S); }
  function recompute(changedType) {
    const is3d = S.shape === 'kugel' || S.shape === 'kuppel';
    $$('[data-for="d"]').forEach(e => e.hidden = !(S.shape === 'ellipse' || S.shape === 'kuppel'));
    $$('[data-for="h"]').forEach(e => e.hidden = S.shape !== 'kuppel');
    $('#sWlab').textContent = S.shape === 'ellipse' || S.shape === 'kuppel' ? 'Breite (X)' : 'Durchmesser';
    $('#thickF').hidden = !S.hollow;
    $('#layerNav').hidden = !is3d;
    $('#isoWrap').hidden = !is3d;
    // Größengrenzen: 3D bleibt bei 64, damit Handys nicht ins Schwitzen kommen
    const max = is3d ? 64 : 128;
    ['#sW', '#sD'].forEach(s => { $(s).max = max; });
    if (S.w > max) S.w = max; if (S.d > max) S.d = max;
    $('#sW').value = $('#sWn').value = S.w; $('#sD').value = $('#sDn').value = S.d;
    G = shapeGrid({ ...S, hollow: S.hollow });
    done.clear(); sel = null; runCache = null;
    lr.max = G.h - 1;
    if (changedType || layer > G.h - 1) layer = 0;
    lr.value = layer;
    fitView(); needFit = changedType || !T ? true : 'keep'; save(); drawAll();
  }

  function count(y) { let n = 0; const o = y * G.w * G.d; for (let i = 0; i < G.w * G.d; i++) n += G.cells[o + i]; return n; }
  function stats() {
    const total = G.cells.reduce((a, b) => a + b, 0), ln = count(layer);
    $('#sumL').textContent = fmt(ln);
    $('#sumT').textContent = fmt(total);
    const st = Math.floor(total / 64), rest = total % 64;
    $('#sumS').textContent = st ? `${st} × 64${rest ? ' + ' + rest : ''}` : String(rest);
    $('#sumDone').textContent = `${done.size} / ${fmt(ln)}`;
    $('#lName').textContent = G.h > 1 ? `Ebene ${layer + 1} / ${G.h}` : '';
  }

  // Raster-Fenster: feste Größe, Form wird eingepasst; schieben, zoomen (Mausrad/Pinch), antippen zum Abhaken
  const board = $('#board');
  let vs = 16, vx = 0, vy = 0, fitS = 16, runCache = null;
  function fitView() {
    const W = board.clientWidth, H = board.clientHeight;
    fitS = Math.min((W - 24) / G.w, (H - 24) / G.d, 44);
    vs = fitS; vx = (W - G.w * vs) / 2; vy = (H - G.d * vs) / 2;
  }
  function zoomAt(ns, cx, cy) {
    ns = Math.max(fitS * .5, Math.min(90, ns));
    vx = cx - (cx - vx) * ns / vs; vy = cy - (cy - vy) * ns / vs; vs = ns; drawGrid();
  }

  // Blöcke in gerade Stücke zerlegen: jeder Block gehört zur längeren seiner beiden Reihen
  // (waagrecht oder senkrecht). Jedes Stück bekommt eine Zahl = wie viele Blöcke am Stück.
  function computeRuns() {
    const { w, d } = G, off = layer * w * d, on = (x, z) => x >= 0 && z >= 0 && x < w && z < d && G.cells[off + z * w + x];
    const hl = new Uint16Array(w * d), vl = new Uint16Array(w * d);
    for (let z = 0; z < d; z++) for (let x = 0; x < w; ) {
      if (!on(x, z)) { x++; continue; } let e = x; while (on(e, z)) e++; for (let i = x; i < e; i++) hl[z * w + i] = e - x; x = e;
    }
    for (let x = 0; x < w; x++) for (let z = 0; z < d; ) {
      if (!on(x, z)) { z++; continue; } let e = z; while (on(x, e)) e++; for (let i = z; i < e; i++) vl[i * w + x] = e - z; z = e;
    }
    const horiz = (x, z) => on(x, z) && hl[z * w + x] >= vl[z * w + x];
    const vert = (x, z) => on(x, z) && !horiz(x, z);
    const out = [];
    for (let z = 0; z < d; z++) for (let x = 0; x < w; ) {
      if (!horiz(x, z)) { x++; continue; } let e = x; while (horiz(e, z)) e++; out.push({ x, z, n: e - x, h: true }); x = e;
    }
    for (let x = 0; x < w; x++) for (let z = 0; z < d; ) {
      if (!vert(x, z)) { z++; continue; } let e = z; while (vert(x, e)) e++; out.push({ x, z, n: e - z, h: false }); z = e;
    }
    return out;
  }

  function drawGrid() {
    const { w, d } = G;
    const W = board.clientWidth, H = board.clientHeight, dpr = devicePixelRatio || 1;
    if (gridCv.width !== Math.round(W * dpr) || gridCv.height !== Math.round(H * dpr)) { gridCv.width = Math.round(W * dpr); gridCv.height = Math.round(H * dpr); }
    const g = gctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
    const css = getComputedStyle(document.documentElement), col = v => css.getPropertyValue(v).trim();
    g.fillStyle = col('--panel'); g.fillRect(0, 0, W, H);
    const c = vs, X = x => vx + x * c, Z = z => vy + z * c;
    // nur sichtbare Zellen zeichnen
    const x0 = Math.max(0, Math.floor(-vx / c)), x1 = Math.min(w, Math.ceil((W - vx) / c));
    const z0 = Math.max(0, Math.floor(-vy / c)), z1 = Math.min(d, Math.ceil((H - vy) / c));
    g.fillStyle = col('--sunk'); g.fillRect(X(0), Z(0), w * c, d * c);
    const tex = blockSprite(S.mat), off = layer * w * d;
    for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
      const i = off + z * w + x;
      if (G.cells[i]) {
        g.drawImage(tex, X(x), Z(z), c + .5, c + .5);
        if (done.has(z * w + x)) { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(X(x), Z(z), c, c); }
      } else if (layer > 0 && G.cells[i - w * d]) {
        g.fillStyle = col('--line'); g.fillRect(X(x), Z(z), c, c); // Ebene darunter als Schatten
      }
    }
    // Gitter (ab 6 px pro Block), alle 5 ab Mitte kräftiger, Mittelachsen in Akzentfarbe
    const line = (n, k, size) => k === 0 || (k === .5 && n % 2) ? col('--accent') : (Math.round(k * 2) / 2) % 5 === (n % 2 ? .5 : 0) ? col('--line-10') : c >= 6 ? col('--line-5') : null;
    for (let x = x0; x <= x1; x++) { const f = line(w, Math.abs(x - w / 2)); if (!f) continue; g.fillStyle = f; g.globalAlpha = f === col('--line-5') ? .5 : 1; g.fillRect(X(x) - .5, Z(0), 1, d * c); }
    for (let z = z0; z <= z1; z++) { const f = line(d, Math.abs(z - d / 2)); if (!f) continue; g.fillStyle = f; g.globalAlpha = f === col('--line-5') ? .5 : 1; g.fillRect(X(0), Z(z) - .5, w * c, 1); }
    g.globalAlpha = 1;
    // Stücke umranden und Anzahl draufschreiben
    if (!runCache) runCache = computeRuns();
    if (c >= 7) {
      g.lineWidth = Math.max(1, c / 12); g.strokeStyle = 'rgba(0,0,0,.55)';
      const fs = Math.min(c * .62, 22);
      g.font = `700 ${fs}px "Press Start 2P", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const r of runCache) {
        const rw = r.h ? r.n : 1, rh = r.h ? 1 : r.n;
        if (X(r.x + rw) < 0 || X(r.x) > W || Z(r.z + rh) < 0 || Z(r.z) > H) continue;
        g.strokeRect(X(r.x) + 1, Z(r.z) + 1, rw * c - 2, rh * c - 2);
      }
      if (c >= 11) for (const r of runCache) {
        const rw = r.h ? r.n : 1, rh = r.h ? 1 : r.n, mx = X(r.x + rw / 2), mz = Z(r.z + rh / 2) + fs * .06;
        if (mx < -20 || mx > W + 20 || mz < -20 || mz > H + 20) continue;
        const t = String(r.n);
        g.lineWidth = Math.max(2, fs / 4); g.strokeStyle = '#000'; g.strokeText(t, mx, mz);
        g.fillStyle = r.n === 1 ? '#e8e8e8' : '#ffff55'; g.fillText(t, mx, mz);
      }
    }
    // abgehakte Blöcke: grüner Haken
    if (c >= 8) { g.strokeStyle = '#80ff20'; g.lineWidth = Math.max(1.5, c / 9);
      done.forEach(k => { const x = k % w, z = (k - x) / w; if (x < x0 || x >= x1 || z < z0 || z >= z1) return;
        g.beginPath(); g.moveTo(X(x) + c * .22, Z(z) + c * .52); g.lineTo(X(x) + c * .42, Z(z) + c * .72); g.lineTo(X(x) + c * .78, Z(z) + c * .3); g.stroke(); }); }
    if (sel) { g.lineWidth = 2; g.strokeStyle = col('--gold'); g.strokeRect(X(0), Z(sel.z) + 1, w * c, c - 2);
      g.strokeStyle = '#fff'; g.strokeRect(X(sel.x) + 1, Z(sel.z) + 1, c - 2, c - 2); }
    $('#bZoom').textContent = Math.round(vs / fitS * 100) + '%';
  }

  function runs(z) {
    const out = []; let s = -1; const off = layer * G.w * G.d + z * G.w;
    for (let x = 0; x <= G.w; x++) {
      const on = x < G.w && G.cells[off + x];
      if (on && s < 0) s = x;
      if (!on && s >= 0) { out.push(s === x - 1 ? `${s + 1}` : `${s + 1}–${x}`); s = -1; }
    }
    return out;
  }
  function tap(px, py) {
    const x = Math.floor((px - vx) / vs), z = Math.floor((py - vy) / vs);
    if (x < 0 || z < 0 || x >= G.w || z >= G.d) return;
    const filled = G.cells[layer * G.w * G.d + z * G.w + x];
    if (filled) { const k = z * G.w + x; done.has(k) ? done.delete(k) : done.add(k); }
    sel = { x, z };
    const rr = runs(z);
    $('#cellInfo').innerHTML = `Spalte <b>${x + 1}</b> · Reihe <b>${z + 1}</b> ${filled ? '' : '(leer)'} — Reihe ${z + 1}: ${rr.length ? 'Blöcke in Spalte <b>' + rr.join(', ') + '</b>' : 'keine Blöcke'}`;
    drawGrid(); stats();
  }
  const loc = e => { const r = gridCv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  gridCv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(vs * Math.exp(-e.deltaY * .0018), ...loc(e)); }, { passive: false });
  const pts = new Map(); let last = null, moved = 0;
  gridCv.addEventListener('pointerdown', e => { gridCv.setPointerCapture(e.pointerId); pts.set(e.pointerId, loc(e)); last = null; if (pts.size === 1) moved = 0; board.classList.add('drag'); });
  gridCv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, loc(e));
    const p = [...pts.values()];
    const mid = p.length > 1 ? [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2] : p[0];
    const dist = p.length > 1 ? Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) : 0;
    if (last && last.n === p.length) {
      const dx = mid[0] - last.mid[0], dy = mid[1] - last.mid[1]; moved += Math.abs(dx) + Math.abs(dy);
      vx += dx; vy += dy;
      if (dist && last.dist) { moved += 10; zoomAt(vs * dist / last.dist, ...mid); } else drawGrid();
    }
    last = { mid, dist, n: p.length };
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    const single = pts.size === 1; pts.delete(e.pointerId); last = null;
    if (!pts.size) board.classList.remove('drag');
    if (single && moved < 6 && e.type === 'pointerup') tap(...loc(e));
  };
  gridCv.addEventListener('pointerup', up); gridCv.addEventListener('pointercancel', up);
  const mid = () => [board.clientWidth / 2, board.clientHeight / 2];
  $('#bIn').addEventListener('click', () => zoomAt(vs * 1.5, ...mid()));
  $('#bOut').addEventListener('click', () => zoomAt(vs / 1.5, ...mid()));
  $('#bFit').addEventListener('click', () => { fitView(); drawGrid(); });

  // 3D-Vorschau mit three.js (wird erst geladen, wenn eine 3D-Form gewählt ist).
  // Maus: rechts gedrückt = um das Objekt drehen, links = verschieben, Rad = zoomen.
  // Touch: ein Finger dreht, zwei Finger zoomen/verschieben.
  const loadScript = src => new Promise((ok, fail) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = fail; document.head.append(el); });
  let threeP = null, T = null, meshKey = '', matKey = '', needFit = true;
  const ensureThree = () => threeP ||= loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')
    .then(() => loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'));

  function setupThree() {
    const renderer = new THREE.WebGLRenderer({ canvas: isoCv, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 4000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, .85));
    const sun = new THREE.DirectionalLight(0xffffff, .55); sun.position.set(1, 2, 1.4); scene.add(sun);
    const controls = new THREE.OrbitControls(camera, isoCv);
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.enableDamping = true; controls.dampingFactor = .12; controls.screenSpacePanning = true;
    const box = new THREE.BoxGeometry(1, 1, 1);
    T = { renderer, scene, camera, controls, box, meshes: [], fitDist: 50, anim: null, dirty: true };
    controls.addEventListener('change', () => { T.dirty = true; });
    controls.addEventListener('start', () => $('#isoWrap').classList.add('drag'));
    controls.addEventListener('end', () => $('#isoWrap').classList.remove('drag'));
    (function loop() {
      requestAnimationFrame(loop);
      if ($('#formen').hidden || $('#isoWrap').hidden) return;
      if (T.anim) T.anim();
      controls.update();
      if (!T.dirty) return;
      T.dirty = false;
      renderer.render(scene, camera);
      $('#iZoom').textContent = Math.round(T.fitDist / camera.position.distanceTo(controls.target) * 100) + '%';
    })();
  }

  function material(tint) {
    const tex = new THREE.CanvasTexture(blockSprite(S.mat));
    tex.magFilter = THREE.NearestFilter;
    const glass = S.mat === 'glass';
    return new THREE.MeshLambertMaterial({ map: tex, color: tint || 0xffffff, transparent: glass, opacity: glass ? .6 : 1, depthWrite: !glass });
  }
  function buildMeshes() {
    T.meshes.forEach(m => { T.scene.remove(m); m.material.map.dispose(); m.material.dispose(); m.dispose && m.dispose(); });
    T.meshes = [];
    // immer alle Ebenen zeigen, die gewählte Ebene ist gold
    const { w, h, d } = G, on = (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < w && z < d && y < h && G.cells[G.id(x, y, z)];
    const rest = [], cur = [];
    for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      if (!on(x, y, z)) continue;
      // nur Blöcke mit mindestens einer freien Seite
      if (on(x + 1, y, z) && on(x - 1, y, z) && on(x, y + 1, z) && on(x, y - 1, z) && on(x, y, z + 1) && on(x, y, z - 1)) continue;
      (y === layer && h > 1 ? cur : rest).push([x - w / 2 + .5, y + .5, z - d / 2 + .5]);
    }
    const m4 = new THREE.Matrix4();
    [[rest, null], [cur, 0xffd54a]].forEach(([list, tint]) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(T.box, material(tint), list.length);
      list.forEach((p, i) => { m4.makeTranslation(...p); mesh.setMatrixAt(i, m4); });
      T.scene.add(mesh); T.meshes.push(mesh);
    });
    T.dirty = true;
  }
  // keepDir: Blickrichtung behalten und nur Abstand/Mitte anpassen (z. B. beim Ändern der Höhe)
  function fitCamera(keepDir) {
    const { w, h, d } = G, r = Math.max(w, h, d);
    const dir = keepDir ? T.camera.position.clone().sub(T.controls.target).normalize() : new THREE.Vector3(1, .85, 1.25).normalize();
    T.controls.target.set(0, h * .42, 0);
    T.fitDist = r * 1.75;
    T.camera.position.copy(T.controls.target).addScaledVector(dir, T.fitDist);
    T.camera.near = r / 200; T.camera.far = r * 40; T.camera.updateProjectionMatrix();
    T.dirty = true;
  }
  // Kamera weich um das Ziel drehen bzw. näher/weiter weg
  function camTo(yaw, scale) {
    const off = T.camera.position.clone().sub(T.controls.target), t0 = performance.now();
    T.anim = () => {
      const k = Math.min(1, (performance.now() - t0) / 380), e = 1 - (1 - k) ** 3;
      const o = off.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw * e).multiplyScalar(1 + (scale - 1) * e);
      T.camera.position.copy(T.controls.target).add(o); T.dirty = true;
      if (k === 1) T.anim = null;
    };
  }

  function drawIso() {
    if ($('#isoWrap').hidden) return;
    ensureThree().then(() => {
      if (!T) setupThree();
      const W = isoCv.clientWidth, H = isoCv.clientHeight;
      T.renderer.setSize(W, H, false); T.camera.aspect = W / H; T.camera.updateProjectionMatrix();
      const key = [layer, S.shape, S.w, S.d, S.h, S.hollow, S.t, S.mat].join();
      if (key !== meshKey) { buildMeshes(); meshKey = key; }
      if (needFit) { fitCamera(needFit === 'keep'); needFit = false; }
      T.dirty = true;
    }).catch(() => { $('#iZoom').textContent = 'offline'; });
  }
  $('#iIn').addEventListener('click', () => T && camTo(0, 1 / 1.5));
  $('#iOut').addEventListener('click', () => T && camTo(0, 1.5));
  $('#iFit').addEventListener('click', () => T && fitCamera());
  $('#iL').addEventListener('click', () => T && camTo(-Math.PI / 2, 1));
  $('#iR').addEventListener('click', () => T && camTo(Math.PI / 2, 1));

  function drawAll() { runCache = null; drawGrid(); drawIso(); stats(); }
  addEventListener('resize', () => { if (!$('#formen').hidden) { fitView(); drawAll(); } });
  recompute();
};

/* ================= Verzauberungs-Reihenfolge ================= */
// [Name, Max-Level, Buch-Multiplikator] — Buch-Werte aus den Amboss-Regeln der Java Edition
const ENCH = {
  prot: ['Schutz', 4, 1], fire_prot: ['Feuerschutz', 4, 1], feather: ['Federfall', 4, 1], blast: ['Explosionsschutz', 4, 2],
  proj: ['Schusssicher', 4, 1], thorns: ['Dornen', 3, 4], resp: ['Atmung', 3, 2], aqua: ['Wasseraffinität', 1, 2],
  depth: ['Tiefenläufer', 3, 2], frost: ['Eisläufer', 2, 2], soul: ['Seelenläufer', 3, 4], sneak: ['Huschen', 3, 4],
  sharp: ['Schärfe', 5, 1], smite: ['Bann', 5, 1], bane: ['Nemesis der Gliederfüßer', 5, 1], knock: ['Rückstoß', 2, 1],
  fire_asp: ['Verbrennung', 2, 2], loot: ['Plünderung', 3, 2], sweep: ['Schwungkraft', 3, 2],
  eff: ['Effizienz', 5, 1], silk: ['Behutsamkeit', 1, 4], fortune: ['Glück', 3, 2],
  unb: ['Haltbarkeit', 3, 1], mend: ['Reparatur', 1, 2],
  power: ['Stärke', 5, 1], punch: ['Schlag', 2, 2], flame: ['Flamme', 1, 2], inf: ['Unendlichkeit', 1, 4],
  multi: ['Mehrfachschuss', 1, 2], pierce: ['Durchschuss', 4, 1], quick: ['Schnellladen', 3, 1],
  imp: ['Harpune', 5, 2], rip: ['Sog', 3, 2], loyal: ['Treue', 3, 1], chan: ['Entladung', 1, 4],
  luck: ['Glück des Meeres', 3, 2], lure: ['Köder', 3, 2],
  density: ['Dichte', 5, 1], breach: ['Bresche', 4, 2], wind: ['Windstoß', 3, 2], lunge: ['Ausfallschritt', 3, 2],
};
const CONFLICTS = [['prot', 'fire_prot', 'blast', 'proj'], ['sharp', 'smite', 'bane'], ['density', 'breach', 'smite', 'bane'],
  ['silk', 'fortune'], ['inf', 'mend'], ['depth', 'frost'], ['rip', 'loyal'], ['rip', 'chan'], ['multi', 'pierce']];
const ARMOR = ['prot', 'fire_prot', 'blast', 'proj', 'thorns'], END = ['unb', 'mend'], DIG = ['eff', 'silk', 'fortune'];
const ITEMS = [
  ['sword', 'Schwert', ['sharp', 'smite', 'bane', 'knock', 'fire_asp', 'loot', 'sweep', ...END]],
  ['pickaxe', 'Spitzhacke', [...DIG, ...END]],
  ['axe', 'Axt', [...DIG, 'sharp', 'smite', 'bane', ...END]],
  ['shovel', 'Schaufel', [...DIG, ...END]],
  ['hoe', 'Hacke', [...DIG, ...END]],
  ['helmet', 'Helm', [...ARMOR, 'resp', 'aqua', ...END]],
  ['chest', 'Harnisch', [...ARMOR, ...END]],
  ['legs', 'Hose', [...ARMOR, 'sneak', ...END]],
  ['boots', 'Stiefel', [...ARMOR, 'feather', 'depth', 'frost', 'soul', ...END]],
  ['bow', 'Bogen', ['power', 'punch', 'flame', 'inf', ...END]],
  ['crossbow', 'Armbrust', ['multi', 'pierce', 'quick', ...END]],
  ['trident', 'Dreizack', ['imp', 'rip', 'loyal', 'chan', ...END]],
  ['rod', 'Angel', ['luck', 'lure', ...END]],
  ['spear', 'Speer', ['sharp', 'smite', 'bane', 'knock', 'fire_asp', 'loot', 'lunge', ...END]],
  ['mace', 'Streitkolben', ['density', 'breach', 'smite', 'bane', 'wind', 'fire_asp', ...END]],
  ['elytra', 'Elytren', END],
  ['shield', 'Schild', END],
];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const pen = n => (1 << n) - 1; // Arbeitsstrafe nach n Amboss-Benutzungen

// Optimale Reihenfolge per DP über Teilmengen: für jede Menge (Bücher ± Gegenstand) und jede
// Arbeitsstufe die günstigste Kombination. Opfer (rechter Slot) ist immer ein Buch-Stapel.
function solve(books, priorWork) {
  const n = books.length, ITEM = 1 << n, FULL = (ITEM << 1) - 1, MAXW = 8;
  const val = new Array(FULL + 1).fill(0);
  for (let m = 1; m <= FULL; m++) for (let i = 0; i < n; i++) if (m >> i & 1) val[m] += books[i].lvl * ENCH[books[i].k][2];
  const best = Array.from({ length: FULL + 1 }, () => new Array(MAXW + 1).fill(null));
  books.forEach((b, i) => { best[1 << i][0] = { cost: 0, max: 0, leaf: i }; });
  best[ITEM][priorWork] = { cost: 0, max: 0, leaf: 'item' };
  for (let m = 1; m <= FULL; m++) {
    if (!(m & (m - 1))) continue; // Einzelteile sind schon gesetzt
    for (let A = (m - 1) & m; A; A = (A - 1) & m) {
      const B = m ^ A;
      if (B & ITEM) continue;
      for (let wa = 0; wa <= MAXW; wa++) { const a = best[A][wa]; if (!a) continue;
        for (let wb = 0; wb <= MAXW; wb++) { const b = best[B][wb]; if (!b) continue;
          const step = val[B] + pen(wa) + pen(wb);
          if (step >= 40) continue; // „Zu teuer!“ im Überlebensmodus
          const w = Math.min(MAXW, Math.max(wa, wb) + 1), cost = a.cost + b.cost + step;
          const cur = best[m][w];
          if (!cur || cost < cur.cost || (cost === cur.cost && Math.max(a.max, b.max, step) < cur.max))
            best[m][w] = { cost, max: Math.max(a.max, b.max, step), a, b, A, B, step };
        } }
    }
  }
  let res = null, rw = 0;
  best[FULL].forEach((r, w) => { if (r && (!res || r.cost < res.cost)) { res = r; rw = w; } });
  return res && { ...res, work: rw };
}

INIT.verzaubern = () => {
  const st = Object.assign({ item: 'sword', sel: {}, prior: 0 }, store.get('ench', {}));
  const itemsEl = $('#items'), enchEl = $('#enchs');
  ITEMS.forEach(([k, name]) => {
    const b = document.createElement('button'); b.className = 'slot'; b.dataset.item = k; b.title = name;
    b.innerHTML = `<img src="img/items/${k}.png" alt="" loading="lazy"><span>${name}</span>`;
    b.addEventListener('click', () => { st.item = k; st.sel = {}; renderItems(); renderEnch(); solveAndShow(); });
    itemsEl.append(b);
  });
  $('#prior').value = st.prior;
  $('#prior').addEventListener('change', e => { st.prior = +e.target.value; solveAndShow(); });
  $('#allMax').addEventListener('click', () => {
    // Pro Konfliktgruppe nur das erste Mögliche wählen
    st.sel = {};
    item()[2].forEach(k => { if (!blocked(k)) st.sel[k] = ENCH[k][1]; });
    renderEnch(); solveAndShow();
  });
  $('#noneE').addEventListener('click', () => { st.sel = {}; renderEnch(); solveAndShow(); });

  const item = () => ITEMS.find(i => i[0] === st.item);
  const blocked = k => Object.keys(st.sel).some(o => o !== k && CONFLICTS.some(g => g.includes(k) && g.includes(o)));
  function renderItems() { $$('.slot', itemsEl).forEach(b => b.setAttribute('aria-pressed', b.dataset.item === st.item)); }
  function renderEnch() {
    enchEl.innerHTML = '';
    item()[2].forEach(k => {
      const [name, max] = ENCH[k], on = k in st.sel, off = !on && blocked(k);
      const el = document.createElement('label'); el.className = 'ench' + (on ? ' on' : '') + (off ? ' off' : '');
      el.innerHTML = `<input type="checkbox" ${on ? 'checked' : ''} ${off ? 'disabled' : ''}><span class="nm">${name}<small>max. ${ROMAN[max]}</small></span>` +
        (max > 1 ? `<select aria-label="Stufe">${Array.from({ length: max }, (_, i) => `<option value="${i + 1}" ${(st.sel[k] ?? max) === i + 1 ? 'selected' : ''}>${ROMAN[i + 1]}</option>`).join('')}</select>` : '');
      $('input', el).addEventListener('change', e => { if (e.target.checked) st.sel[k] = +($('select', el)?.value ?? 1); else delete st.sel[k]; renderEnch(); solveAndShow(); });
      $('select', el)?.addEventListener('change', e => { if (k in st.sel) { st.sel[k] = +e.target.value; solveAndShow(); } });
      $('select', el)?.addEventListener('click', e => e.preventDefault());
      enchEl.append(el);
    });
  }

  function solveAndShow() {
    store.set('ench', st);
    const books = Object.entries(st.sel).map(([k, lvl]) => ({ k, lvl })).sort((a, b) => b.lvl * ENCH[b.k][2] - a.lvl * ENCH[a.k][2]);
    const out = $('#resBody'), iname = item()[1];
    if (!books.length) { out.innerHTML = `<div class="empty">Wähl links die Bücher aus, die du auf ${iname === 'Elytren' ? 'die' : 'dein'} ${iname} machen willst.</div>`; return; }
    if (books.length > 10) { out.innerHTML = '<div class="warnbox">Mehr als 10 Bücher auf einmal rechnet der Rechner nicht.</div>'; return; }
    const r = solve(books, st.prior);
    if (!r) { out.innerHTML = `<div class="warnbox"><b>Zu teuer!</b> Mit diesen Büchern${st.prior ? ' und der Vorarbeit' : ''} kommt mindestens ein Schritt auf 40 Level oder mehr. Probier weniger Bücher oder ein frisches ${iname}.</div>`; return; }
    const label = node => {
      if (node.leaf === 'item') return { item: true, names: [] };
      if (node.leaf !== undefined) { const b = books[node.leaf]; return { item: false, names: [`${ENCH[b.k][0]} ${ENCH[b.k][1] > 1 ? ROMAN[b.lvl] : ''}`.trim()] }; }
      const a = label(node.a), b = label(node.b); return { item: a.item || b.item, names: [...a.names, ...b.names] };
    };
    const tip = l => `<div class="tip"><span class="t-name">${l.item ? iname : 'Verzaubertes Buch'}</span>${l.names.length ? '<br><span class="t-ench">' + l.names.join('<br>') + '</span>' : ''}</div>`;
    const steps = [];
    (function walk(n) { if (n.leaf !== undefined) return; walk(n.a); walk(n.b); steps.push(n); })(r);
    out.innerHTML = `<div class="total"><span>Gesamt <b>${r.cost}</b> Level</span><span class="muted" style="font-family:var(--f-body);font-size:14px">${steps.length} Schritte · teuerster Schritt ${r.max} Level</span></div>
      <div class="xpbar" style="margin:8px 0 16px" title="Teuerster Schritt im Verhältnis zur Grenze von 39 Level"><i style="width:${Math.round(r.max / 39 * 100)}%"></i></div>
      <div class="steps">${steps.map(s => `<div class="step">${tip(label(s.a))}<span class="plus">+</span>${tip(label(s.b))}<span class="cost ${s.step > 30 ? 'warn' : ''}">Kosten <b>${s.step}</b></span></div>`).join('')}</div>
      <p class="muted" style="font-size:13px;margin:14px 0 0">Links = linker Amboss-Slot, rechts = rechter Slot. Danach ist das Teil ${r.work}× im Amboss gewesen – jede weitere Reparatur wird teurer.</p>`;
  }
  renderItems(); renderEnch(); solveAndShow();
};

/* ================= Handel: zoombarer Bildbetrachter ================= */
// Bereiche im Bild (Original 1778×1802, Bild ist ×2) und Ausschnitt für den Kopf als Avatar
const JOBS = [
  ['Bauer', 'Komposter', [28, 106, 306, 722], [38, 136]],
  ['Fleischer', 'Räucherofen', [318, 106, 594, 606], [328, 136]],
  ['Fischer', 'Fass', [605, 106, 882, 644], [615, 136]],
  ['Bibliothekar', 'Lesepult', [893, 106, 1170, 722], [903, 136]],
  ['Rüstungsschmied', 'Hochofen', [1182, 106, 1458, 872], [1192, 136]],
  ['Werkzeugschmied', 'Schmiedetisch', [1470, 106, 1748, 796], [1480, 136]],
  ['Schäfer', 'Webstuhl', [28, 745, 306, 1476], [38, 775]],
  ['Gerber', 'Kessel', [318, 630, 594, 1172], [328, 660]],
  ['Geistlicher', 'Braustand', [605, 670, 882, 1172], [615, 700]],
  ['Kartograf', 'Kartentisch', [893, 745, 1170, 1176], [903, 752]],
  ['Pfeilmacher', 'Bognertisch', [1182, 895, 1458, 1438], [1192, 925]],
  ['Waffenschmied', 'Schleifstein', [1470, 820, 1748, 1296], [1480, 850]],
  ['Steinmetz', 'Steinsäge', [893, 1195, 1170, 1772], [903, 1225]],
  ['Fahrender Händler', 'kommt mit zwei Lamas', [336, 1200, 864, 1758], [372, 1252]],
];

INIT.handel = () => {
  const vw = $('#viewer'), stage = $('#vstage'), img = $('#vimg'), mark = $('#vmark');
  const IW = 3556, IH = 3604, AV = 44, CROP = 220; // Avatar 44 px aus 220 px Bildausschnitt
  let active = -1;
  $('#jobs').innerHTML = JOBS.map(([n, ws, , [hx, hy]], i) => `<button class="job" data-i="${i}" style="--d:${i * 30}ms">
      <span class="av" style="background-size:${IW * AV / CROP}px ${IH * AV / CROP}px;background-position:-${hx * 2 * AV / CROP}px -${hy * 2 * AV / CROP}px"></span>
      <span class="jt"><b>${n}</b><small>${i === JOBS.length - 1 ? '' : 'Arbeitsblock: '}${ws}</small></span>
      <span class="jgo" aria-hidden="true">›</span></button>`).join('');
  $$('.job').forEach(b => b.addEventListener('click', () => select(+b.dataset.i === active ? -1 : +b.dataset.i)));
  let sc = 1, tx = 0, ty = 0, fit = 1;
  const MAX = 2; // 2 = Originalpixel ×4

  function clamp() {
    const W = vw.clientWidth, H = vw.clientHeight, w = IW * sc, h = IH * sc;
    tx = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, tx));
    ty = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, ty));
  }
  function apply() {
    clamp();
    stage.style.transform = `translate(${tx}px,${ty}px) scale(${sc})`;
    vw.classList.toggle('crisp', sc >= .75);
    $('#vZoom').textContent = Math.round(sc / fit * 100) + '%';
    if (active >= 0) {
      const [x0, y0, x1, y1] = JOBS[active][2];
      Object.assign(mark.style, { left: tx + x0 * 2 * sc + 'px', top: ty + y0 * 2 * sc + 'px', width: (x1 - x0) * 2 * sc + 'px', height: (y1 - y0) * 2 * sc + 'px' });
    }
  }
  // Weiche Kamerafahrt zu einem Ziel (Maßstab + Verschiebung)
  let anim = 0;
  function flyTo(nsc, ntx, nty, ms = 650) {
    cancelAnimationFrame(anim);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) ms = 1;
    const s0 = sc, x0 = tx, y0 = ty, t0 = performance.now();
    const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    (function step(now) {
      const k = Math.min(1, (now - t0) / ms), e = ease(k);
      sc = s0 + (nsc - s0) * e; tx = x0 + (ntx - x0) * e; ty = y0 + (nty - y0) * e; apply();
      if (k < 1) anim = requestAnimationFrame(step);
    })(t0);
  }
  function select(i) {
    active = i;
    $$('.job').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
    mark.classList.remove('show'); void mark.offsetWidth; // Animation neu starten
    if (i < 0) { mark.hidden = true; const f = Math.min(vw.clientWidth / IW, vw.clientHeight / IH); flyTo(f, (vw.clientWidth - IW * f) / 2, (vw.clientHeight - IH * f) / 2); return; }
    const [x0, y0, x1, y1] = JOBS[i][2].map(v => v * 2), W = vw.clientWidth, H = vw.clientHeight, pad = 28;
    const nsc = Math.max(fit, Math.min(MAX, (W - pad * 2) / (x1 - x0), (H - pad * 2 - 40) / (y1 - y0)));
    let ntx = W / 2 - (x0 + x1) / 2 * nsc, nty = H / 2 + 14 - (y0 + y1) / 2 * nsc;
    // gleiche Begrenzung wie beim Ziehen, damit die Fahrt nicht am Ende springt
    const w = IW * nsc, h = IH * nsc;
    ntx = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, ntx));
    nty = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, nty));
    $('#vmarkName').textContent = JOBS[i][0];
    mark.hidden = false; mark.classList.add('show');
    flyTo(nsc, ntx, nty);
    const r = vw.getBoundingClientRect();
    if (r.top < 60 || r.bottom > innerHeight) vw.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function zoomAt(nsc, cx, cy) {
    nsc = Math.max(fit, Math.min(MAX, nsc));
    tx = cx - (cx - tx) * nsc / sc; ty = cy - (cy - ty) * nsc / sc; sc = nsc; apply();
  }
  function toFit() { fit = Math.min(vw.clientWidth / IW, vw.clientHeight / IH); sc = fit; apply(); }
  const center = () => [vw.clientWidth / 2, vw.clientHeight / 2];
  const local = e => { const r = vw.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  vw.addEventListener('wheel', e => { e.preventDefault(); zoomAt(sc * Math.exp(-e.deltaY * .0018), ...local(e)); }, { passive: false });
  // Ziehen mit einem Finger/Maus, Pinch mit zwei Fingern
  const pts = new Map(); let last = null, lastTap = 0;
  vw.addEventListener('pointerdown', e => {
    if (e.target.closest('.vbar')) return;
    vw.setPointerCapture(e.pointerId); pts.set(e.pointerId, local(e)); vw.classList.add('drag');
    const now = Date.now();
    if (pts.size === 1 && now - lastTap < 300) { const [x, y] = local(e); sc > fit * 1.5 ? toFit() : zoomAt(sc * 3, x, y); lastTap = 0; }
    else lastTap = now;
    last = null;
  });
  vw.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, local(e));
    const p = [...pts.values()];
    const mid = p.length > 1 ? [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2] : p[0];
    const dist = p.length > 1 ? Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]) : 0;
    if (last && last.n === p.length) {
      tx += mid[0] - last.mid[0]; ty += mid[1] - last.mid[1];
      if (dist && last.dist) zoomAt(sc * dist / last.dist, ...mid); else apply();
    }
    last = { mid, dist, n: p.length };
  });
  const up = e => { pts.delete(e.pointerId); last = null; if (!pts.size) vw.classList.remove('drag'); };
  vw.addEventListener('pointerup', up); vw.addEventListener('pointercancel', up);

  $('#vIn').addEventListener('click', () => zoomAt(sc * 1.6, ...center()));
  $('#vOut').addEventListener('click', () => zoomAt(sc / 1.6, ...center()));
  $('#vFit').addEventListener('click', toFit);
  $('#vFull').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else (vw.requestFullscreen || vw.webkitRequestFullscreen || (() => {})).call(vw);
  });
  const refit = () => { const was = sc <= fit * 1.01; const old = fit; fit = Math.min(vw.clientWidth / IW, vw.clientHeight / IH); if (was || sc < fit) sc = fit; else sc = sc / old * fit > MAX ? MAX : sc; apply(); };
  addEventListener('resize', refit); document.addEventListener('fullscreenchange', refit);
  if (img.complete) toFit(); else img.addEventListener('load', toFit);
  toFit();
};

/* ================= Start ================= */
// Höhe der Kopfzeile für klebende Elemente darunter
const setTopH = () => document.documentElement.style.setProperty('--toph', $('.top').offsetHeight + 'px');
addEventListener('resize', setTopH); setTopH();
paintSprites();
show(location.hash.slice(1) || 'home');
