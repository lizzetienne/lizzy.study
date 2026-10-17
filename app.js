'use strict';

const app = document.getElementById('app');
let DATA = null;

/* ================= Hilfsfunktionen ================= */

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

function svg(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const rich = (tag, text, props) => h(tag, { ...props, html: inline(text) });

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Mischen, aber nie in der richtigen Reihenfolge lassen
function shuffleAway(list) {
  if (list.length < 2) return [...list];
  let a;
  do a = shuffle(list); while (a.every((x, i) => x === list[i]));
  return a;
}

const fmt = n => (Math.round(n * 100) / 100).toString().replace('.', ',').replace('-', '−');

const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
};

function icon(name, size = 22, width = 2) {
  return h('span', {
    class: 'icon', 'aria-hidden': 'true', style: 'display:flex',
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`,
  });
}

function bar(fraction) {
  const fill = h('i');
  requestAnimationFrame(() => { fill.style.width = `${Math.round(fraction * 100)}%`; });
  return h('div', { class: 'bar' }, fill);
}

/* ================= Fortschritt ================= */

const STORE_KEY = 'lizzy.study.progress';
let progress = {};
try { progress = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { progress = {}; }

function saveProgress() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch { /* privat / blockiert */ }
}

const taskKey = (s, t, i) => `${s.id}/${t.id}/${t.tasks[i].id || i}`;

function topicStats(s, t) {
  let right = 0;
  t.tasks.forEach((_, i) => { if (progress[taskKey(s, t, i)] === 'right') right++; });
  return { total: t.tasks.length, right };
}

function subjectStats(s) {
  return s.topics.reduce((acc, t) => {
    const st = topicStats(s, t);
    return { total: acc.total + st.total, right: acc.right + st.right };
  }, { total: 0, right: 0 });
}

const share = st => (st.total ? st.right / st.total : 0);

/* ================= Navigation ================= */

// Navigation ohne URL-Änderung, weil Claude-Seiten Links mit # abfangen
const ROUTE_KEY = 'lizzy.study.route';
const link = (...parts) => parts.map(encodeURIComponent).join('/');
let current = '';
try { current = sessionStorage.getItem(ROUTE_KEY) || ''; } catch { current = ''; }

function navigate(to) {
  current = to;
  try { sessionStorage.setItem(ROUTE_KEY, to); } catch { /* privat / blockiert */ }
  route();
}

document.addEventListener('click', e => {
  const target = e.target.closest('[data-route]');
  if (!target) return;
  e.preventDefault();
  navigate(target.dataset.route);
});
document.addEventListener('keydown', e => {
  const target = e.target.closest?.('[data-route]');
  if (target && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); navigate(target.dataset.route); }
});

function route() {
  const [sid, tid, mode] = current.split('/').filter(Boolean).map(decodeURIComponent);
  const s = sid && DATA.subjects.find(x => x.id === sid);
  const t = s && tid && s.topics.find(x => x.id === tid);
  window.scrollTo(0, 0);
  if (!s) return renderHome();
  if (!t) return renderSubject(s);
  if (mode === 'theorie') return renderTheory(s, t);
  if (mode === 'aufgaben') return renderTasks(s, t);
  renderTopic(s, t);
}

function page(...kids) {
  app.replaceChildren(h('main', { class: 'page' }, kids));
}

const go = route => ({ 'data-route': route, role: 'link', tabindex: 0 });

const homeButton = () => h('a', { class: 'home', ...go(link()), 'aria-label': 'Startseite' }, icon('home', 21, 1.9));

function topBar(href, label) {
  return h('nav', { class: 'top' }, h('a', { class: 'back', ...go(href) }, icon('back', 22, 2.2), label), homeButton());
}

/* ================= Seiten ================= */

function renderHome() {
  document.title = 'lizzy.study';
  page(
    h('nav', { class: 'top' }, h('div', { class: 'brand' }, 'lizzy', h('span', {}, '.study'))),
    h('h1', {}, 'Fächer'),
    h('p', { class: 'lead' }, 'Wähle ein Fach, um zu lernen und zu üben.'),
    h('div', { class: 'section grid' }, DATA.subjects.map(s => {
      const st = subjectStats(s);
      const n = s.topics.length;
      return h('a', { class: 'tile', ...go(link(s.id)) },
        h('div', { class: 'tile-mark' }, s.short || s.name.slice(0, 1)),
        h('div', { class: 'tile-name' }, s.name),
        h('div', { class: 'tile-meta' }, `${n} ${n === 1 ? 'Thema' : 'Themen'} · ${Math.round(share(st) * 100)} %`),
        bar(share(st)),
      );
    })),
  );
  app.prepend(
    h('div', { class: 'ornament', 'aria-hidden': 'true' }),
    h('div', { class: 'ornament alt', 'aria-hidden': 'true' }),
  );
}

function renderSubject(s) {
  document.title = `${s.name} · lizzy.study`;
  page(
    topBar(link(), 'Fächer'),
    h('h1', {}, s.name),
    s.description ? h('p', { class: 'lead' }, s.description) : null,
    h('div', { class: 'section' },
      h('div', { class: 'section-label' }, 'Themen'),
      h('div', { class: 'list' }, s.topics.map(t => {
        const st = topicStats(s, t);
        return h('a', { class: 'row', ...go(link(s.id, t.id)) },
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title' }, t.name),
            h('div', { class: 'row-meta' }, `${st.right} von ${st.total} Aufgaben richtig`),
            bar(share(st)),
          ),
          h('span', { class: 'chev' }, icon('next', 18)),
        );
      })),
    ),
  );
}

function readingMinutes(t) {
  const words = JSON.stringify(t.theory).split(/\s+/).length;
  return Math.max(1, Math.round(words / 160));
}

function renderTopic(s, t) {
  document.title = `${t.name} · lizzy.study`;
  const st = topicStats(s, t);
  page(
    topBar(link(s.id), s.name),
    h('div', { class: 'eyebrow' }, s.name),
    h('h1', {}, t.name),
    t.summary ? h('p', { class: 'lead' }, t.summary) : null,
    h('div', { class: 'section cards' },
      h('a', { class: 'card', ...go(link(s.id, t.id, 'theorie')) },
        h('div', { class: 'card-icon' }, icon('book', 22, 1.8)),
        h('div', { class: 'card-main' },
          h('div', { class: 'card-title' }, 'Theorie'),
          h('div', { class: 'card-meta' }, `Zusammenfassung · ca. ${readingMinutes(t)} Min.`),
        ),
        h('span', { class: 'chev' }, icon('next', 18)),
      ),
      h('a', { class: 'card', ...go(link(s.id, t.id, 'aufgaben')) },
        h('div', { class: 'card-icon' }, icon('pencil', 22, 1.8)),
        h('div', { class: 'card-main' },
          h('div', { class: 'card-title' }, 'Aufgaben'),
          h('div', { class: 'card-meta' }, `${t.tasks.length} Aufgaben · ${st.right} richtig`),
        ),
        h('span', { class: 'chev' }, icon('next', 18)),
      ),
    ),
    st.right ? h('button', {
      class: 'text-btn',
      onclick() {
        // Erst nachfragen: zweiter Tipp innerhalb von 4 Sekunden setzt zurück
        if (!this.classList.contains('armed')) {
          this.classList.add('armed');
          this.textContent = 'Nochmal tippen zum Zurücksetzen';
          setTimeout(() => { this.classList.remove('armed'); this.textContent = 'Fortschritt zurücksetzen'; }, 4000);
          return;
        }
        t.tasks.forEach((_, i) => delete progress[taskKey(s, t, i)]);
        saveProgress();
        renderTopic(s, t);
      },
    }, 'Fortschritt zurücksetzen') : null,
  );
}

/* ================= Theorie ================= */

const BLOCKS = {
  h: b => rich('h2', b.text),
  p: b => rich('p', b.text),
  formula: b => rich('div', b.text, { class: 'formula' }),
  note: b => rich('div', b.text, { class: 'note' }),
  list: b => h('ul', {}, b.items.map(x => rich('li', x))),
  example: b => h('div', { class: 'example' },
    h('div', { class: 'example-title' }, b.title || 'Beispiel'),
    b.steps ? h('ol', {}, b.steps.map(x => rich('li', x))) : rich('p', b.text),
  ),
  'linear-explorer': () => linearExplorer(),
};

function renderTheory(s, t) {
  document.title = `${t.name} · Theorie`;
  page(
    topBar(link(s.id, t.id), t.name),
    h('div', { class: 'eyebrow' }, 'Theorie'),
    h('h1', {}, t.name),
    h('article', { class: 'prose' }, t.theory.map(b => (BLOCKS[b.type] || BLOCKS.p)(b))),
    h('div', { class: 'prose-end' },
      h('a', { class: 'btn primary', ...go(link(s.id, t.id, 'aufgaben')) }, 'Zu den Aufgaben'),
    ),
  );
}

/* ================= Graph (lineare Funktionen) ================= */

const RANGE = 6;
const SIZE = 300;
const sx = x => (x + RANGE) * SIZE / (2 * RANGE);
const sy = y => (RANGE - y) * SIZE / (2 * RANGE);

function plot() {
  const root = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'plot', role: 'img' });
  for (let i = -RANGE; i <= RANGE; i++) {
    const cls = i === 0 ? 'axis' : 'grid-line';
    root.append(svg('line', { class: cls, x1: sx(i), x2: sx(i), y1: 0, y2: SIZE }));
    root.append(svg('line', { class: cls, y1: sy(i), y2: sy(i), x1: 0, x2: SIZE }));
    if (i !== 0 && i % 2 === 0) {
      const tx = svg('text', { class: 'tick', x: sx(i), y: sy(0) + 13, 'text-anchor': 'middle' });
      tx.textContent = fmt(i);
      const ty = svg('text', { class: 'tick', x: sx(0) - 6, y: sy(i) + 3, 'text-anchor': 'end' });
      ty.textContent = fmt(i);
      root.append(tx, ty);
    }
  }
  const line = svg('line', { class: 'plot-line' });
  const dot = svg('circle', { class: 'intercept', r: 4.5 });
  root.append(line, dot);
  return {
    el: root,
    setLine(m, b) {
      const x1 = -RANGE - 1, x2 = RANGE + 1;
      line.setAttribute('x1', sx(x1)); line.setAttribute('y1', sy(m * x1 + b));
      line.setAttribute('x2', sx(x2)); line.setAttribute('y2', sy(m * x2 + b));
      dot.setAttribute('cx', sx(0)); dot.setAttribute('cy', sy(b));
    },
    addPoint(x, y) {
      root.append(svg('circle', { class: 'target', cx: sx(x), cy: sy(y), r: 6 }));
    },
  };
}

function linearFormula(m, b) {
  let s = 'y = ';
  if (m === 0) return s + fmt(b);
  s += m === 1 ? 'x' : m === -1 ? '−x' : `${fmt(m)}x`;
  if (b > 0) s += ` + ${fmt(b)}`;
  if (b < 0) s += ` − ${fmt(-b)}`;
  return s;
}

function slider(name, value, onInput) {
  const out = h('output', {}, fmt(value));
  const input = h('input', { type: 'range', min: -4, max: 4, step: 0.5, value, 'aria-label': name });
  input.addEventListener('input', () => { out.textContent = fmt(+input.value); onInput(+input.value); });
  return { el: h('label', {}, h('div', { class: 'slider-head' }, h('span', {}, name), out), input), input };
}

function linearControls(start, onChange) {
  const p = plot();
  const formula = h('div', { class: 'formula-live' });
  const state = { ...start };
  const update = () => { p.setLine(state.m, state.b); formula.textContent = linearFormula(state.m, state.b); onChange?.(state); };
  const sm = slider('Steigung m', state.m, v => { state.m = v; update(); });
  const sb = slider('y-Achsenabschnitt b', state.b, v => { state.b = v; update(); });
  update();
  return { plot: p, state, sliders: [sm, sb], el: [p.el, formula, h('div', { class: 'sliders' }, sm.el, sb.el)] };
}

function linearExplorer() {
  return h('div', { class: 'explorer' }, linearControls({ m: 1, b: 0 }).el);
}

/* ================= Ziehen & Ablegen ================= */

let hovered = null;
function setHover(el) {
  if (hovered === el) return;
  hovered?.classList.remove('over');
  hovered = el;
  hovered?.classList.add('over');
}

const dropTarget = ev => document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-drop]') || null;

function enableDrag(el, { onTap, onDrop }) {
  el.addEventListener('pointerdown', e => {
    if (el.closest('.locked') || e.button > 0) return;
    const startX = e.clientX, startY = e.clientY;
    const rect = el.getBoundingClientRect();
    const offX = startX - rect.left, offY = startY - rect.top;
    let ghost = null;
    el.setPointerCapture(e.pointerId);

    const move = ev => {
      if (!ghost && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return;
      if (!ghost) {
        ghost = el.cloneNode(true);
        ghost.classList.add('ghost');
        ghost.style.width = `${rect.width}px`;
        document.body.append(ghost);
        el.classList.add('placeholder');
      }
      ghost.style.transform = `translate(${ev.clientX - offX}px, ${ev.clientY - offY}px)`;
      setHover(dropTarget(ev));
    };
    const end = ev => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      if (ghost) {
        const target = dropTarget(ev);
        ghost.remove();
        el.classList.remove('placeholder');
        setHover(null);
        if (ev.type === 'pointerup') onDrop(target);
      } else if (ev.type === 'pointerup') {
        onTap();
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });
}

// Wörter-Ablage mit Lücken: Ziehen oder erst Wort, dann Lücke antippen
function createBoard(words, onChange) {
  const pool = h('div', { class: 'pool', 'data-drop': '' }, h('div', { class: 'pool-label' }, 'Ziehen oder antippen'));
  const slots = [];
  let selected = null;

  function select(chip) {
    selected = chip;
    chips.forEach(c => c.classList.toggle('selected', c === chip));
    slots.forEach(s => s.classList.toggle('armed', !!chip));
  }

  function place(chip, target) {
    if (!target || target === pool) {
      pool.append(chip);
    } else {
      const existing = target.querySelector('.chip');
      if (existing && existing !== chip) {
        const from = chip.parentElement;
        (from?.classList.contains('slot') ? from : pool).append(existing);
      }
      target.append(chip);
    }
    select(null);
    onChange();
  }

  const chips = words.map(word => {
    const chip = h('button', { class: 'chip', type: 'button', 'data-value': word }, word);
    enableDrag(chip, {
      onTap() {
        if (chip.parentElement !== pool) return place(chip, pool);
        select(selected === chip ? null : chip);
      },
      onDrop: target => place(chip, target),
    });
    pool.append(chip);
    return chip;
  });

  return {
    pool,
    slots,
    makeSlot() {
      const slot = h('span', { class: 'slot', 'data-drop': '' });
      slot.addEventListener('click', () => { if (selected) place(selected, slot); });
      slots.push(slot);
      return slot;
    },
    filled: () => slots.every(s => s.querySelector('.chip')),
    value: slot => slot.querySelector('.chip')?.dataset.value,
  };
}

// Sortierbare Liste: Element ziehen, die anderen rücken nach
function enableSort(item, list, onChange) {
  item.addEventListener('pointerdown', e => {
    if (item.closest('.locked') || e.button > 0) return;
    e.preventDefault();
    item.classList.remove('settle');
    item.classList.add('dragging');
    let anchor = e.clientY;
    const mid = el => el.getBoundingClientRect().top + el.offsetHeight / 2;

    // Nur die Nachbarn werden umgehängt, nie das gezogene Element selbst
    const move = ev => {
      const y = ev.clientY;
      const before = item.offsetTop;
      let next, prev;
      while ((next = item.nextElementSibling) && y > mid(next)) list.insertBefore(next, item);
      while ((prev = item.previousElementSibling) && y < mid(prev)) list.insertBefore(prev, item.nextElementSibling);
      anchor += item.offsetTop - before;
      item.style.transform = `translateY(${y - anchor}px)`;
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      item.classList.remove('dragging');
      item.classList.add('settle');
      item.style.transform = '';
      onChange();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  });
}

/* ================= Aufgabentypen ================= */
// Jeder Typ liefert { el, check() }. check() gibt true, false oder 'retry' zurück.

function matchesAnswer(value, answer, tolerance = 0) {
  const v = value.trim().replace(',', '.');
  const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
  return [].concat(answer).some(a => typeof a === 'number'
    ? Math.abs(parseFloat(v) - a) <= (tolerance || 1e-9)
    : norm(v) === norm(String(a)));
}

const TASKS = {
  choice: {
    label: 'Auswahl',
    render(task, ctx) {
      let chosen = null;
      const box = h('div', { class: 'options' });
      const buttons = task.options.map((text, i) => h('button', {
        class: 'option', type: 'button',
        onclick() {
          if (box.classList.contains('locked')) return;
          chosen = i;
          buttons.forEach((b, j) => b.classList.toggle('selected', j === i));
          ctx.setReady(true);
        },
      }, h('span', { class: 'option-key' }, String.fromCharCode(65 + i)), rich('span', text)));
      box.append(...buttons);
      return {
        el: box,
        check() {
          box.classList.add('locked');
          buttons[chosen].classList.remove('selected');
          buttons[task.answer].classList.add('correct');
          if (chosen !== task.answer) buttons[chosen].classList.add('wrong');
          return chosen === task.answer;
        },
      };
    },
  },

  input: {
    label: 'Berechnen',
    render(task, ctx) {
      const numeric = task.numeric !== false;
      const field = h('input', {
        class: 'answer-input', placeholder: 'Deine Antwort', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
        inputmode: numeric ? 'decimal' : 'text',
      });
      field.addEventListener('input', () => ctx.setReady(field.value.trim() !== ''));
      field.addEventListener('keydown', e => { if (e.key === 'Enter') ctx.submit(); });
      const extra = h('div');
      let tries = 0;
      setTimeout(() => field.focus({ preventScroll: true }), 50);
      return {
        el: h('div', {}, h('div', { class: 'input-row' }, field, task.unit ? h('span', { class: 'unit' }, task.unit) : null), extra),
        check() {
          const ok = matchesAnswer(field.value, task.answer, task.tolerance);
          if (!ok && task.hint && tries++ === 0) {
            field.classList.remove('shake'); void field.offsetWidth; field.classList.add('shake');
            extra.replaceChildren(rich('div', `**Noch nicht.** Tipp: ${task.hint}`, { class: 'hint' }));
            return 'retry';
          }
          field.disabled = true;
          field.classList.add(ok ? 'correct' : 'wrong');
          const shown = [].concat(task.answer)[0];
          extra.replaceChildren(ok ? '' : h('div', { class: 'reveal' }, 'Richtige Lösung: ',
            h('strong', {}, typeof shown === 'number' ? fmt(shown) : shown, task.unit ? ` ${task.unit}` : '')));
          return ok;
        },
      };
    },
  },

  match: {
    label: 'Zuordnen',
    render(task, ctx) {
      const board = createBoard(shuffle(task.pairs.map(p => p[1])), () => ctx.setReady(board.filled()));
      const rows = task.pairs.map(([left]) => h('div', { class: 'match-row' }, rich('div', left, { class: 'match-left' }), board.makeSlot()));
      const box = h('div', {}, h('div', { class: 'match-rows' }, rows), board.pool);
      return {
        el: box,
        check() {
          box.classList.add('locked');
          return board.slots.map((slot, i) => {
            const ok = board.value(slot) === task.pairs[i][1];
            slot.classList.add(ok ? 'correct' : 'wrong');
            if (!ok) slot.append(h('span', { class: 'solution' }, task.pairs[i][1]));
            return ok;
          }).every(Boolean);
        },
      };
    },
  },

  gap: {
    label: 'Lückentext',
    render(task, ctx) {
      const parts = task.text.split(/\[([^\]]+)\]/);
      const answers = parts.filter((_, i) => i % 2);
      const board = createBoard(shuffle([...answers, ...(task.distractors || [])]), () => ctx.setReady(board.filled()));
      const text = h('p', { class: 'gap-text' }, parts.map((p, i) => (i % 2 ? board.makeSlot() : p)));
      const box = h('div', {}, text, board.pool);
      return {
        el: box,
        check() {
          box.classList.add('locked');
          return board.slots.map((slot, i) => {
            const ok = board.value(slot) === answers[i];
            slot.classList.add(ok ? 'correct' : 'wrong');
            if (!ok) slot.append(h('span', { class: 'solution' }, answers[i]));
            return ok;
          }).every(Boolean);
        },
      };
    },
  },

  order: {
    label: 'Reihenfolge',
    render(task, ctx) {
      const list = h('div', { class: 'order-list' });
      for (const text of shuffleAway(task.items)) {
        const item = h('div', { class: 'order-item', 'data-value': text }, h('span', { class: 'grip' }, icon('grip', 18)), rich('span', text));
        enableSort(item, list, () => {});
        list.append(item);
      }
      ctx.setReady(true);
      const box = h('div', {}, list);
      return {
        el: box,
        check() {
          box.classList.add('locked');
          const ok = [...list.children].map((item, i) => {
            const right = item.dataset.value === task.items[i];
            item.classList.add(right ? 'correct' : 'wrong');
            return right;
          }).every(Boolean);
          if (!ok) box.append(h('div', { class: 'order-solution' },
            h('div', { class: 'section-label' }, 'Richtige Reihenfolge'),
            h('ol', {}, task.items.map(x => rich('li', x)))));
          return ok;
        },
      };
    },
  },

  graph: {
    label: 'Graph einstellen',
    render(task, ctx) {
      const ctrl = linearControls({ m: 0, b: 0 });
      (task.points || []).forEach(([x, y]) => ctrl.plot.addPoint(x, y));
      ctx.setReady(true);
      const box = h('div', { class: 'explorer' }, ctrl.el);
      return {
        el: box,
        check() {
          ctrl.sliders.forEach(s => { s.input.disabled = true; });
          return ctrl.state.m === task.m && ctrl.state.b === task.b;
        },
      };
    },
  },
};

/* ================= Aufgaben-Ablauf ================= */

function renderTasks(s, t, only) {
  document.title = `${t.name} · Aufgaben`;
  const queue = only || t.tasks.map((_, i) => i);
  const results = {};
  let pos = 0;

  const fill = h('i');
  const count = h('div', { class: 'count' });
  const stage = h('section', { class: 'stage' });
  const dock = h('div', { class: 'dock' });

  page(
    h('nav', { class: 'task-top' },
      h('a', { class: 'close', ...go(link(s.id, t.id)), 'aria-label': 'Schließen' }, icon('close', 22, 2)),
      h('div', { class: 'bar' }, fill),
      count,
      homeButton(),
    ),
    stage,
  );
  app.append(dock);

  function updateTop() {
    fill.style.width = `${(pos / queue.length) * 100}%`;
    count.textContent = `${Math.min(pos + 1, queue.length)}/${queue.length}`;
  }

  function show() {
    if (pos >= queue.length) return finish();
    updateTop();
    const i = queue[pos];
    const task = t.tasks[i];
    const type = TASKS[task.type];
    let ready = false;

    const button = h('button', { class: 'btn primary', disabled: true, onclick: submit }, 'Prüfen');
    const ctx = {
      setReady(v) { ready = v; button.disabled = !v; },
      submit() { if (ready) submit(); },
    };
    const view = type.render(task, ctx);

    stage.replaceChildren(h('div', { class: 'task' },
      h('div', { class: 'task-type' }, type.label),
      rich('h2', task.prompt, { class: 'task-prompt' }),
      view.el,
    ));
    const skip = h('button', {
      class: 'skip-btn', type: 'button',
      onclick() { results[i] = 'skipped'; pos++; show(); },
    }, 'Überspringen');
    dock.replaceChildren(h('div', { class: 'dock-actions' }, button, skip));
    window.scrollTo(0, 0);

    function submit() {
      const result = view.check();
      if (result === 'retry') return;
      ready = false;
      results[i] = result;
      progress[taskKey(s, t, i)] = result ? 'right' : 'wrong';
      saveProgress();
      feedback(result, task);
    }
  }

  function feedback(ok, task) {
    const last = pos + 1 >= queue.length;
    const next = h('button', { class: `btn ${ok ? 'ok' : 'bad'}`, onclick() { pos++; show(); } }, last ? 'Auswertung' : 'Weiter');
    dock.replaceChildren(h('div', { class: `feedback ${ok ? 'ok' : 'bad'}`, role: 'status' },
      h('div', { class: 'fb-title' }, icon(ok ? 'check' : 'x', 20, 2.6), ok ? 'Richtig' : 'Nicht ganz'),
      task.explain ? rich('p', task.explain, { class: 'fb-text' }) : null,
      next,
    ));
    next.focus({ preventScroll: true });
  }

  function finish() {
    fill.style.width = '100%';
    count.textContent = `${queue.length}/${queue.length}`;
    const open = queue.filter(i => results[i] !== true);
    const skipped = queue.filter(i => results[i] === 'skipped').length;
    const right = queue.length - open.length;
    const message = open.length === 0 ? 'Alles richtig. Sehr gut.'
      : skipped === open.length ? 'Gut gemacht. Probiere jetzt noch die übersprungenen Aufgaben.'
      : right / queue.length >= 0.6 ? 'Gut gemacht. Wiederhole die falschen Aufgaben, um sie zu festigen.'
      : 'Lies dir die Theorie noch einmal durch und versuche es dann erneut.';
    const repeatLabel = skipped === 0 ? 'Falsche wiederholen'
      : skipped === open.length ? 'Übersprungene machen'
      : 'Falsche und übersprungene wiederholen';
    stage.replaceChildren(h('div', { class: 'result' },
      h('div', { class: 'eyebrow' }, 'Auswertung'),
      h('div', { class: 'score' }, String(right), h('span', {}, `/${queue.length}`)),
      h('p', { class: 'lead' }, message),
      skipped ? h('p', { class: 'result-note' }, `${skipped} ${skipped === 1 ? 'Aufgabe' : 'Aufgaben'} übersprungen`) : null,
    ));
    dock.replaceChildren(h('div', { class: 'btn-stack' },
      open.length ? h('button', { class: 'btn primary', onclick: () => renderTasks(s, t, open) }, repeatLabel) : null,
      h('button', { class: `btn ${open.length ? 'secondary' : 'primary'}`, onclick: () => renderTasks(s, t) }, 'Alle nochmal'),
      h('a', { class: 'btn secondary', ...go(link(s.id, t.id)) }, 'Zum Thema'),
    ));
  }

  show();
}

/* ================= Start ================= */

async function start() {
  app.replaceChildren(h('div', { class: 'loading' }, 'Lädt …'));
  const res = await fetch('content.json', { cache: 'no-store' });
  DATA = await res.json();
  route();
}

start();

// Beim lokalen Entwickeln automatisch neu laden, wenn sich eine Datei ändert
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  let version = null;
  setInterval(async () => {
    try {
      const v = await (await fetch('/__version', { cache: 'no-store' })).text();
      if (version && v !== version) location.reload();
      version = v;
    } catch { /* Server kurz weg */ }
  }, 800);
}
