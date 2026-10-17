'use strict';

// Zusätze für die Fun-Quizze: Töne, Themen-Effekte und besondere Aufgabentypen.
// Wird nach app.js geladen und nutzt dessen Hilfsfunktionen (h, svg, rich, TASKS …).

/* ================= Töne (selbst erzeugt, keine Dateien) ================= */

const sfx = (() => {
  let ctx = null;
  let enabled = true;
  let active = false;
  try { enabled = localStorage.getItem('lizzy.sound') !== 'off'; } catch { enabled = true; }

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, { type = 'sine', dur = 0.15, vol = 0.2, to = null, delay = 0 } = {}) {
    const a = audio();
    if (!a) return;
    const t0 = a.currentTime + delay;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.12, vol = 0.25, freq = 1000, delay = 0 } = {}) {
    const a = audio();
    if (!a) return;
    const t0 = a.currentTime + delay;
    const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = a.createBufferSource();
    src.buffer = buffer;
    const filter = a.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = a.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(a.destination);
    src.start(t0);
  }

  const play = fn => (...args) => { if (enabled && active) fn(...args); };

  return {
    get enabled() { return enabled; },
    get active() { return active; },
    set active(v) { active = v; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem('lizzy.sound', enabled ? 'on' : 'off'); } catch { /* egal */ }
      return enabled;
    },
    correct: play(() => {
      tone(660, { type: 'triangle', dur: 0.14, vol: 0.16 });
      tone(990, { type: 'triangle', dur: 0.28, vol: 0.16, delay: 0.1 });
    }),
    wrong: play(() => tone(190, { type: 'sawtooth', dur: 0.3, vol: 0.07, to: 120 })),
    punch: play(() => {
      noise({ dur: 0.08, vol: 0.3, freq: 900 });
      tone(150, { dur: 0.12, vol: 0.28, to: 55 });
    }),
    tick: play(() => tone(1500, { type: 'square', dur: 0.03, vol: 0.04 })),
    stop: play(() => {
      tone(760, { dur: 1.1, vol: 0.2, to: 55 });
      noise({ dur: 0.9, vol: 0.1, freq: 380 });
    }),
    resume: play(() => tone(55, { dur: 0.7, vol: 0.2, to: 640 })),
    menacing: play(() => {
      tone(52, { type: 'sawtooth', dur: 1.4, vol: 0.05, to: 46 });
      tone(78, { type: 'sawtooth', dur: 1.2, vol: 0.03, to: 70, delay: 0.15 });
    }),
  };
})();

function soundToggle() {
  const button = h('button', { class: 'home sound-toggle', type: 'button', 'aria-label': 'Ton an oder aus' });
  const paint = () => button.replaceChildren(icon(sfx.enabled ? 'sound' : 'mute', 20, 1.9));
  button.addEventListener('click', () => { sfx.toggle(); paint(); });
  paint();
  return button;
}

/* ================= Themen-Effekte ================= */

// Schwebende ゴゴゴ-Zeichen am Rand, wie die bedrohlichen Soundeffekte im Manga
function themeLayer(theme) {
  if (theme !== 'jojo') return;
  const glyphs = Array.from({ length: 8 }, (_, i) => h('span', { style: `--i:${i}` }, 'ゴ'));
  app.prepend(h('div', { class: 'menacing', 'aria-hidden': 'true' }, glyphs));
  sfx.menacing();
}

function toBeContinued(stage) {
  const arrow = h('div', { class: 'tbc', 'aria-hidden': 'true' }, h('span', {}, 'TO BE CONTINUED'));
  stage.append(arrow);
}

/* ================= Silhouetten ================= */

const SILHOUETTES = {
  human: {
    ratio: 40 / 100,
    body: '<circle cx="20" cy="11" r="8.5"/><path d="M9 24c0-3 2-5 5-5h12c3 0 5 2 5 5v31H9z"/>'
      + '<rect x="2.5" y="21" width="6" height="32" rx="3"/><rect x="31.5" y="21" width="6" height="32" rx="3"/>'
      + '<rect x="10.5" y="54" width="8.5" height="46" rx="3"/><rect x="21" y="54" width="8.5" height="46" rx="3"/>',
    view: '0 0 40 100',
  },
  jotaro: {
    ratio: 40 / 100,
    body: '<circle cx="20" cy="12" r="8.5"/><path d="M11.5 9.5c0-5.5 3.8-8.5 8.5-8.5s8.5 3 8.5 8.5z"/><path d="M11.5 8.6h22v2.6h-22z"/>'
      + '<path d="M9 24c0-3 2-5 5-5h12c3 0 5 2 5 5v31H9z"/><path d="M9 50h10.2v30H7.6z"/><path d="M20.8 50H31l1.4 30H20.8z"/>'
      + '<rect x="2.5" y="21" width="6" height="32" rx="3"/><rect x="31.5" y="21" width="6" height="32" rx="3"/>'
      + '<rect x="10.5" y="54" width="8.5" height="46" rx="3"/><rect x="21" y="54" width="8.5" height="46" rx="3"/>',
    view: '0 0 40 100',
  },
  dog: {
    ratio: 60 / 40,
    body: '<path d="M14 17c0-5 4-8 10-8h18c5 0 8 3 8 8v9H14z"/><circle cx="12" cy="14" r="8"/>'
      + '<path d="M5.5 9L4 0l7 6z"/><path d="M14 6l3-6 2.5 8z"/><path d="M49 14l7-5 1.5 2.2-7 5z"/>'
      + '<rect x="17" y="24" width="4.5" height="16" rx="2"/><rect x="24" y="24" width="4.5" height="16" rx="2"/>'
      + '<rect x="39" y="24" width="4.5" height="16" rx="2"/><rect x="45.5" y="24" width="4.5" height="16" rx="2"/>',
    view: '0 0 60 40',
  },
};

function silhouette(kind) {
  const shape = SILHOUETTES[kind] || SILHOUETTES.human;
  return h('div', {
    class: 'silhouette',
    style: `aspect-ratio:${shape.ratio}`,
    html: `<svg viewBox="${shape.view}" preserveAspectRatio="xMidYMax meet" width="100%" height="100%" fill="currentColor">${shape.body}</svg>`,
  });
}

/* ================= Neue Aufgabentypen ================= */

Object.assign(TASKS, {
  // Figur per Ziehen auf die richtige Größe bringen
  scale: {
    label: 'Größe einstellen',
    render(task, ctx) {
      const max = task.max || 220;
      const H = 280;
      const px = cm => (cm / max) * H;
      const target = task.figures.find(f => f.target);
      let value = target.start || 150;

      const ruler = h('div', { class: 'ruler', style: `height:${H}px` });
      for (let cm = 0; cm <= max; cm += 20) ruler.append(h('span', { style: `bottom:${px(cm)}px` }, String(cm)));

      const readout = h('span', { class: 'scale-readout' });
      let targetBox = null;
      const figures = task.figures.map(f => {
        const box = h('div', { class: 'figure-box' }, silhouette(f.kind));
        const el = h('div', { class: `figure${f.target ? ' is-target' : ''}` }, box, h('div', { class: 'figure-name' }, f.name));
        if (f.target) {
          targetBox = box;
          const handle = h('div', { class: 'scale-handle', role: 'presentation' }, readout);
          box.prepend(handle);
          enableHeightDrag(handle, () => value, v => update(v), max / H);
        } else {
          box.style.height = `${px(f.cm)}px`;
        }
        return el;
      });

      const range = h('input', { type: 'range', min: 100, max: max, step: 1, value, 'aria-label': `Größe von ${target.name} in cm` });
      range.addEventListener('input', () => update(+range.value));

      function update(v) {
        value = Math.max(100, Math.min(max, Math.round(v)));
        targetBox.style.height = `${px(value)}px`;
        readout.textContent = `${value} cm`;
        range.value = value;
      }
      update(value);
      ctx.setReady(true);

      const floor = h('div', { class: 'scale-figures', style: `height:${H}px` }, figures);
      const stageEl = h('div', { class: 'scale-stage' }, ruler, floor);
      const box = h('div', {}, stageEl, h('div', { class: 'scale-slider' }, range));
      return {
        el: box,
        check() {
          box.classList.add('locked');
          range.disabled = true;
          const ok = Math.abs(value - target.target) <= (task.tolerance || 0);
          targetBox.parentElement.classList.add(ok ? 'correct' : 'wrong');
          if (!ok) {
            floor.append(h('div', { class: 'scale-solution', style: `bottom:${px(target.target)}px` },
              h('span', {}, `${target.name}: ${target.target} cm`)));
          }
          return ok;
        },
      };
    },
  },

  // Zeit anhalten und im richtigen Moment wieder laufen lassen
  timestop: {
    label: 'Zeit anhalten',
    render(task, ctx) {
      let count = 0;
      let timer = null;
      let stopped = false;
      const number = h('div', { class: 'ts-count' }, '0');
      const hand = svg('line', { class: 'ts-hand', x1: 0, y1: 0, x2: 0, y2: -38 });
      const dial = svg('svg', { viewBox: '-50 -50 100 100', class: 'ts-clock' });
      dial.append(svg('circle', { class: 'ts-face', r: 46 }));
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        dial.append(svg('line', { class: 'ts-mark', x1: Math.sin(a) * 38, y1: -Math.cos(a) * 38, x2: Math.sin(a) * 43, y2: -Math.cos(a) * 43 }));
      }
      dial.append(hand, svg('circle', { class: 'ts-pin', r: 3 }));
      const button = h('button', { class: 'ts-btn', type: 'button' }, 'ZA WARUDO!');
      const status = h('div', { class: 'ts-status' }, 'Die Zeit läuft normal.');

      function paint() {
        number.textContent = String(count);
        hand.style.transform = `rotate(${count * 30}deg)`;
      }
      function freeze() {
        stopped = true;
        count = 0;
        paint();
        ctx.setReady(false);
        document.body.classList.add('time-stopped');
        const ripple = h('div', { class: 'ts-ripple' });
        document.body.append(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
        sfx.stop();
        button.textContent = 'Zeit läuft weiter';
        status.textContent = 'Die Zeit steht still …';
        timer = setInterval(() => {
          count++;
          paint();
          sfx.tick();
          if (count >= 15) release();
        }, 1000);
      }
      function release() {
        clearInterval(timer);
        stopped = false;
        document.body.classList.remove('time-stopped');
        sfx.resume();
        button.textContent = 'Nochmal anhalten';
        status.textContent = `Die Zeit stand ${count} ${count === 1 ? 'Sekunde' : 'Sekunden'} still.`;
        ctx.setReady(true);
      }
      button.addEventListener('click', () => (stopped ? release() : freeze()));
      taskCleanup = () => { clearInterval(timer); document.body.classList.remove('time-stopped'); };

      const box = h('div', { class: 'ts' }, h('div', { class: 'ts-dial' }, dial, number), status, button);
      return {
        el: box,
        check() {
          clearInterval(timer);
          document.body.classList.remove('time-stopped');
          button.disabled = true;
          return count === task.answer;
        },
      };
    },
  },

  // Namen in einen Stammbaum ziehen
  family: {
    label: 'Stammbaum',
    render(task, ctx) {
      const answers = task.nodes.filter(n => n.slot).map(n => n.slot);
      const board = createBoard(shuffle([...answers, ...(task.distractors || [])]), () => ctx.setReady(board.filled()));
      const byId = Object.fromEntries(task.nodes.map(n => [n.id, n]));
      const lines = svg('svg', { class: 'tree-lines', viewBox: '0 0 100 100', preserveAspectRatio: 'none' });
      for (const [a, b] of task.edges) {
        const A = byId[a], B = byId[b];
        const mid = (A.y + B.y) / 2;
        lines.append(svg('path', { d: `M${A.x} ${A.y} V${mid} H${B.x} V${B.y}`, 'vector-effect': 'non-scaling-stroke' }));
      }
      const tree = h('div', { class: 'tree' }, lines);
      const pairs = [];
      for (const n of task.nodes) {
        const pos = `left:${n.x}%;top:${n.y}%`;
        if (n.slot) {
          const slot = board.makeSlot();
          slot.classList.add('tree-node');
          slot.style.cssText = pos;
          pairs.push([slot, n.slot]);
          tree.append(slot);
        } else {
          tree.append(h('div', { class: 'tree-node fixed', style: pos }, n.name));
        }
      }
      const box = h('div', {}, tree, board.pool);
      return {
        el: box,
        check() {
          box.classList.add('locked');
          return pairs.map(([slot, answer]) => {
            const ok = board.value(slot) === answer;
            slot.classList.add(ok ? 'correct' : 'wrong');
            if (!ok) slot.append(h('span', { class: 'solution' }, answer));
            return ok;
          }).every(Boolean);
        },
      };
    },
  },

  // Stand-Werte (A bis E) einstellen, mit Netzdiagramm
  radar: {
    label: 'Stand-Werte',
    render(task, ctx) {
      const grades = ['A', 'B', 'C', 'D', 'E'];
      const level = g => 5 - grades.indexOf(g);
      const values = task.stats.map(() => 'E');
      const n = task.stats.length;
      const R = 74;
      const point = (i, r) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return [Math.cos(a) * r, Math.sin(a) * r];
      };
      const chart = svg('svg', { viewBox: '-122 -104 244 210', class: 'radar' });
      for (let k = 1; k <= 5; k++) {
        chart.append(svg('polygon', { class: 'radar-ring', points: task.stats.map((_, i) => point(i, (R * k) / 5).join(',')).join(' ') }));
      }
      task.stats.forEach((st, i) => {
        const [x, y] = point(i, R);
        chart.append(svg('line', { class: 'radar-axis', x1: 0, y1: 0, x2: x, y2: y }));
        const [lx, ly] = point(i, R + 12);
        const label = svg('text', {
          class: 'radar-label', x: lx, y: ly + (ly > 0 ? 9 : ly < -R ? -2 : 3),
          'text-anchor': Math.abs(lx) < 4 ? 'middle' : lx > 0 ? 'start' : 'end',
        });
        label.textContent = st.short || st.label;
        chart.append(label);
      });
      const solution = svg('polygon', { class: 'radar-solution' });
      const shape = svg('polygon', { class: 'radar-shape' });
      chart.append(solution, shape);
      const draw = () => shape.setAttribute('points', values.map((g, i) => point(i, (R * level(g)) / 5).join(',')).join(' '));

      const rows = task.stats.map((st, i) => {
        const buttons = grades.map(g => h('button', {
          type: 'button', class: `grade${values[i] === g ? ' on' : ''}`,
          onclick() {
            if (box.classList.contains('locked')) return;
            values[i] = g;
            buttons.forEach(b => b.classList.toggle('on', b.textContent === g));
            draw();
          },
        }, g));
        return h('div', { class: 'stat-row' }, h('span', { class: 'stat-label' }, st.label), h('div', { class: 'grades' }, buttons));
      });
      draw();
      ctx.setReady(true);
      const box = h('div', { class: 'radar-box' }, chart, h('div', { class: 'stat-rows' }, rows));
      return {
        el: box,
        check() {
          box.classList.add('locked');
          const ok = task.stats.map((st, i) => {
            const right = values[i] === st.answer;
            rows[i].classList.add(right ? 'correct' : 'wrong');
            if (!right) rows[i].append(h('span', { class: 'solution' }, st.answer));
            return right;
          }).every(Boolean);
          if (!ok) solution.setAttribute('points', task.stats.map((st, i) => point(i, (R * level(st.answer)) / 5).join(',')).join(' '));
          return ok;
        },
      };
    },
  },

  // So schnell wie möglich tippen
  rush: {
    label: 'Bonus',
    render(task, ctx) {
      let taps = 0;
      let started = false;
      let done = false;
      let t0 = 0;
      let frame = 0;
      const counter = h('div', { class: 'rush-count' }, '0');
      const fill = h('i', { style: 'width:100%' });
      const fist = h('button', { class: 'rush-btn', type: 'button' }, 'ORA!');
      const arena = h('div', { class: 'rush-arena' }, fist);

      let ender = 0;
      function tick() {
        const p = Math.min(1, (performance.now() - t0) / (task.seconds * 1000));
        fill.style.width = `${(1 - p) * 100}%`;
        if (p < 1 && !done) frame = requestAnimationFrame(tick);
      }
      function finish() {
        done = true;
        cancelAnimationFrame(frame);
        fill.style.width = '0%';
        fist.disabled = true;
        fist.textContent = taps >= task.goal ? 'Geschafft!' : 'Vorbei';
        ctx.setReady(true);
      }

      fist.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (done) return;
        if (!started) {
          started = true;
          t0 = performance.now();
          frame = requestAnimationFrame(tick);
          ender = setTimeout(finish, task.seconds * 1000);
        }
        taps++;
        counter.textContent = String(taps);
        sfx.punch();
        fist.classList.remove('hit');
        void fist.offsetWidth;
        fist.classList.add('hit');
        const word = h('span', {
          class: 'ora',
          style: `left:${8 + Math.random() * 84}%;top:${10 + Math.random() * 70}%;--r:${Math.round(Math.random() * 40 - 20)}deg`,
        }, Math.random() < 0.5 ? 'オラ' : 'ORA');
        word.addEventListener('animationend', () => word.remove());
        arena.append(word);
      });
      taskCleanup = () => { cancelAnimationFrame(frame); clearTimeout(ender); };

      return {
        el: h('div', { class: 'rush' },
          h('div', { class: 'rush-goal' }, `Ziel: ${task.goal} Treffer in ${task.seconds} Sekunden. Die Zeit startet mit dem ersten Tipp.`),
          h('div', { class: 'bar rush-time' }, fill),
          arena,
          h('div', { class: 'rush-stats' }, counter, h('span', {}, 'Treffer')),
        ),
        check() {
          cancelAnimationFrame(frame);
          clearTimeout(ender);
          return taps >= task.goal;
        },
      };
    },
  },
});

// Ziehen nach oben/unten verändert einen Zahlenwert (für die Größen-Aufgabe)
function enableHeightDrag(handle, get, set, perPixel) {
  handle.addEventListener('pointerdown', e => {
    if (handle.closest('.locked')) return;
    e.preventDefault();
    const startY = e.clientY;
    const startValue = get();
    handle.classList.add('dragging');
    const move = ev => set(startValue + (startY - ev.clientY) * perPixel);
    const end = () => {
      handle.classList.remove('dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  });
}
