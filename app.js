(function () {
  'use strict';

  const TYPES = {
    batch: { label: 'Batch', w: 260, h: 104, swatch: '--accent' },
    database: { label: 'Base de données', w: 220, h: 200, swatch: '--db-stroke' },
    file: { label: 'Fichier', w: 240, h: 84, swatch: '--file-stroke' },
    app: { label: 'Application', w: 240, h: 104, swatch: '--app-stroke' },
    service: { label: 'Composant', w: 240, h: 84, swatch: '--service-stroke' },
    zone: { label: 'Zone', w: 320, h: 280, swatch: '--zone-stroke' }
  };
  const KINDS = {
    read: { label: 'Lecture', verb: 'Lit' },
    write: { label: 'Écriture', verb: 'Écrit' },
    publish: { label: 'Publication', verb: 'Publie' }
  };
  const TEXT_FIELDS = ['name', 'subtitle', 'schedule', 'description', 'reader', 'processor', 'writer'];
  const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  const MONO = 'ui-monospace, Consolas, monospace';
  const GRID = 10;
  const DRAFT_KEY = 'schema-architecture:brouillon';

  // Styles du dessin : injectés dans la page et repris tels quels dans les exports.
  const SVG_CSS = `
    .n-kicker { font: 600 10.5px ${MONO}; letter-spacing: .07em; fill: var(--muted); }
    .n-name { font: 600 15px ${FONT}; fill: var(--ink); }
    .n-sub { font: 12.5px ${FONT}; fill: var(--muted); }
    .n-shape { fill: var(--card); stroke: var(--service-stroke); stroke-width: 1.5; }
    .type-batch .n-shape { stroke: var(--accent); }
    .type-batch .n-bar { fill: var(--accent); }
    .type-batch .n-kicker { fill: var(--accent); }
    .type-database .n-shape, .type-database .n-top { fill: var(--db-fill); stroke: var(--db-stroke); stroke-width: 1.5; }
    .type-database .n-kicker { fill: var(--db-stroke); }
    .type-file .n-shape, .type-file .n-fold { fill: var(--file-fill); stroke: var(--file-stroke); stroke-width: 1.5; }
    .type-file .n-kicker { fill: var(--file-stroke); }
    .type-app .n-shape { fill: var(--app-fill); stroke: var(--app-stroke); }
    .type-app .n-rule { stroke: var(--app-stroke); stroke-width: 1.5; }
    .type-app .n-dot { fill: var(--app-stroke); }
    .type-app .n-kicker { fill: var(--app-stroke); }
    .type-zone .n-shape { fill: var(--zone-fill); stroke: var(--zone-stroke); stroke-dasharray: 6 5; pointer-events: none; }
    .type-zone .n-name { font: 600 13px ${FONT}; fill: var(--muted); }
    .e-line { fill: none; stroke-width: 2; }
    .e-read .e-line { stroke: var(--read); stroke-dasharray: 7 5; }
    .e-write .e-line { stroke: var(--write); }
    .e-publish .e-line { stroke: var(--publish); stroke-dasharray: 12 4 2 4; }
    .e-pill { fill: var(--panel); stroke-width: 1; }
    .e-read .e-pill { stroke: var(--read); }
    .e-write .e-pill { stroke: var(--write); }
    .e-publish .e-pill { stroke: var(--publish); }
    .e-text { font: 600 12px ${FONT}; text-anchor: middle; }
    .e-read .e-text, .a-read { fill: var(--read); }
    .e-write .e-text, .a-write { fill: var(--write); }
    .e-publish .e-text, .a-publish { fill: var(--publish); }
    .x-title { font: 600 20px ${FONT}; fill: var(--ink); }
    .x-legend { font: 12px ${FONT}; fill: var(--muted); }
  `;
  // Styles propres à l'interface : jamais exportés.
  const UI_CSS = `
    .node { cursor: move; }
    .present .node { cursor: pointer; }
    .node.selected .n-shape { stroke: var(--ink); stroke-width: 2.5; }
    .node.connect-target .n-shape { stroke: var(--accent); stroke-width: 3; }
    .dim { opacity: .16; }
    .edge { cursor: pointer; }
    .e-hit { fill: none; stroke: transparent; stroke-width: 16; }
    .edge.selected .e-line { stroke-width: 3.5; }
    .h-dot { fill: var(--panel); stroke: var(--accent); stroke-width: 2; opacity: 0; pointer-events: none; }
    .h-hit { fill: transparent; cursor: crosshair; }
    .node:hover .h-dot, .node.selected .h-dot { opacity: 1; }
    .h-resize { fill: var(--ink); cursor: nwse-resize; }
    .temp-line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-dasharray: 4 4; pointer-events: none; }
    .pulse-read { fill: var(--read); } .pulse-write { fill: var(--write); } .pulse-publish { fill: var(--publish); }
    .zone-grip { fill: transparent; }
  `;

  const $ = (id) => document.getElementById(id);
  const svg = $('canvas');
  const viewport = $('viewport');
  const measure = document.createElement('canvas').getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let schema = null;
  let exampleJson = '';
  let source = 'example'; // example | draft
  let selection = null; // { kind: 'node' | 'edge', id }
  let focusId = null;
  let present = false;
  let animate = false;
  let view = { x: 0, y: 0, k: 1 };
  let autoFit = true; // Recadrer quand la zone change de taille, tant que l'utilisateur n'a pas bougé la vue.
  let drag = null;
  let undoStack = [];
  let redoStack = [];
  let fieldEditing = false;
  let lastClick = { id: null, t: 0 };
  let toastTimer = 0;

  /* ---------- Données ---------- */

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function num(v, fallback, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function normalizeNode(raw, index) {
    const type = Object.hasOwn(TYPES, raw && raw.type) ? raw.type : 'service';
    const base = TYPES[type];
    const node = {
      id: String((raw && raw.id) || 'n' + index).slice(0, 80),
      type,
      x: num(raw && raw.x, 0, -20000, 20000),
      y: num(raw && raw.y, 0, -20000, 20000),
      w: num(raw && raw.w, base.w, 100, 4000),
      h: num(raw && raw.h, base.h, 50, 4000)
    };
    for (const field of TEXT_FIELDS) {
      node[field] = String((raw && raw[field]) || '').slice(0, 2000);
    }
    return node;
  }

  function normalize(raw) {
    if (!raw || !Array.isArray(raw.nodes)) throw new Error('Ce fichier ne contient pas de schéma.');
    const seen = new Set();
    const nodes = [];
    raw.nodes.slice(0, 500).forEach((n, i) => {
      const node = normalizeNode(n, i);
      if (!seen.has(node.id)) { seen.add(node.id); nodes.push(node); }
    });
    const edgeIds = new Set();
    const edges = [];
    (Array.isArray(raw.edges) ? raw.edges : []).slice(0, 2000).forEach((e, i) => {
      if (!e || !seen.has(String(e.from)) || !seen.has(String(e.to)) || e.from === e.to) return;
      let id = String(e.id || 'e' + i).slice(0, 80);
      while (edgeIds.has(id)) id += '-' + i;
      edgeIds.add(id);
      edges.push({
        id,
        from: String(e.from),
        to: String(e.to),
        kind: Object.hasOwn(KINDS, e.kind) ? e.kind : 'read',
        label: String(e.label || '').slice(0, 200)
      });
    });
    return { version: 1, title: String(raw.title || 'Schéma').slice(0, 120), nodes, edges };
  }

  const uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const nodeById = (id) => schema.nodes.find((n) => n.id === id);
  const edgeById = (id) => schema.edges.find((e) => e.id === id);

  /* ---------- Historique et brouillon ---------- */

  function pushHistory() {
    undoStack.push(JSON.stringify(schema));
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
  }

  function storage(action) {
    try { return action(window.localStorage); } catch (err) { return null; }
  }

  function saveDraft() {
    if (JSON.stringify(schema) === exampleJson) {
      storage((s) => s.removeItem(DRAFT_KEY));
      source = 'example';
    } else {
      storage((s) => s.setItem(DRAFT_KEY, JSON.stringify({ schema })));
      source = 'draft';
    }
  }

  function commit() {
    saveDraft();
    render();
  }

  function restore(stackFrom, stackTo) {
    if (!stackFrom.length) return;
    stackTo.push(JSON.stringify(schema));
    schema = JSON.parse(stackFrom.pop());
    if (selection && !(selection.kind === 'node' ? nodeById(selection.id) : edgeById(selection.id))) selection = null;
    if (focusId && !nodeById(focusId)) focusId = null;
    saveDraft();
    render();
    renderInspector();
  }

  function replaceSchema(next, nextSource) {
    schema = next;
    source = nextSource;
    selection = null;
    focusId = null;
    render();
    renderInspector();
    fit();
  }

  /* ---------- Géométrie ---------- */

  function sidesBetween(a, b) {
    const gapX = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
    const gapY = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
    if (gapX >= gapY) return b.x + b.w / 2 >= a.x + a.w / 2 ? ['r', 'l'] : ['l', 'r'];
    return b.y + b.h / 2 >= a.y + a.h / 2 ? ['b', 't'] : ['t', 'b'];
  }

  const DIR = { r: [1, 0], l: [-1, 0], t: [0, -1], b: [0, 1] };

  function sidePoint(n, side, along) {
    if (side === 'r') return { x: n.x + n.w, y: along };
    if (side === 'l') return { x: n.x, y: along };
    if (side === 't') return { x: along, y: n.y };
    return { x: along, y: n.y + n.h };
  }

  // Les liens restent droits quand c'est possible : chaque port vise le centre du nœud opposé.
  function routeEdges() {
    const byId = new Map(schema.nodes.map((n) => [n.id, n]));
    const items = [];
    const ports = new Map();
    const addPort = (node, side, other, item, slot) => {
      const key = node.id + '|' + side;
      if (!ports.has(key)) ports.set(key, { node, side, list: [] });
      ports.get(key).list.push({ other, item, slot });
    };
    for (const edge of schema.edges) {
      const a = byId.get(edge.from);
      const b = byId.get(edge.to);
      if (!a || !b) continue;
      const [sa, sb] = sidesBetween(a, b);
      const item = { edge, a, b, sa, sb };
      items.push(item);
      addPort(a, sa, b, item, 'pa');
      addPort(b, sb, a, item, 'pb');
    }
    for (const { node, side, list } of ports.values()) {
      const vertical = side === 'l' || side === 'r';
      const start = vertical ? node.y : node.x;
      const size = vertical ? node.h : node.w;
      const margin = Math.min(node.type === 'database' ? 34 : 18, size / 2);
      const lo = start + margin;
      const hi = start + size - margin;
      const center = start + size / 2;
      const wanted = (o) => {
        const oStart = vertical ? o.y : o.x;
        const oSize = vertical ? o.h : o.w;
        // Si le nœud opposé couvre notre centre, viser notre centre donne un lien droit.
        const aim = center >= oStart && center <= oStart + oSize ? center : oStart + oSize / 2;
        return Math.min(hi, Math.max(lo, aim));
      };
      list.sort((p, q) => wanted(p.other) - wanted(q.other) || (p.item.edge.id < q.item.edge.id ? -1 : 1));
      const gap = list.length > 1 ? Math.min(22, (hi - lo) / (list.length - 1)) : 0;
      const pos = [];
      list.forEach((p, i) => { pos[i] = i ? Math.max(wanted(p.other), pos[i - 1] + gap) : wanted(p.other); });
      if (pos.length && pos[pos.length - 1] > hi) {
        pos[pos.length - 1] = hi;
        for (let i = pos.length - 2; i >= 0; i--) pos[i] = Math.min(pos[i], pos[i + 1] - gap);
      }
      list.forEach((p, i) => { p.item[p.slot] = sidePoint(node, side, pos[i]); });
    }
    for (const it of items) {
      const dist = Math.hypot(it.pb.x - it.pa.x, it.pb.y - it.pa.y);
      const c = Math.min(140, Math.max(24, dist * 0.45));
      const c1 = { x: it.pa.x + DIR[it.sa][0] * c, y: it.pa.y + DIR[it.sa][1] * c };
      const c2 = { x: it.pb.x + DIR[it.sb][0] * c, y: it.pb.y + DIR[it.sb][1] * c };
      it.d = `M${it.pa.x} ${it.pa.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${it.pb.x} ${it.pb.y}`;
      it.mid = {
        x: (it.pa.x + 3 * c1.x + 3 * c2.x + it.pb.x) / 8,
        y: (it.pa.y + 3 * c1.y + 3 * c2.y + it.pb.y) / 8
      };
    }
    return items;
  }

  function textWidth(text, font) {
    measure.font = font;
    return measure.measureText(text).width;
  }

  function wrap(text, font, maxWidth, maxLines) {
    const words = String(text).trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    let index = 0;
    while (index < words.length && lines.length < maxLines) {
      const candidate = current ? current + ' ' + words[index] : words[index];
      if (textWidth(candidate, font) <= maxWidth) {
        current = candidate;
        index++;
      } else if (current) {
        lines.push(current);
        current = '';
      } else {
        // Mot plus long que la ligne : on le coupe.
        let cut = words[index].length - 1;
        while (cut > 1 && textWidth(words[index].slice(0, cut), font) > maxWidth) cut--;
        lines.push(words[index].slice(0, cut));
        words[index] = words[index].slice(cut);
      }
    }
    if (current && lines.length < maxLines) lines.push(current);
    const truncated = index < words.length || (current && lines[lines.length - 1] !== current);
    if (truncated && lines.length) {
      let last = lines[lines.length - 1];
      while (last.length > 1 && textWidth(last + '…', font) > maxWidth) last = last.slice(0, -1);
      lines[lines.length - 1] = last + '…';
    }
    return lines;
  }

  /* ---------- Dessin ---------- */

  function shapeSvg(n) {
    const { w, h } = n;
    if (n.type === 'database') {
      const ry = Math.min(18, h * 0.14);
      const rx = w / 2;
      return `<path class="n-shape" d="M0 ${ry}A${rx} ${ry} 0 0 1 ${w} ${ry}V${h - ry}A${rx} ${ry} 0 0 1 0 ${h - ry}Z"/>` +
        `<ellipse class="n-top" cx="${rx}" cy="${ry}" rx="${rx}" ry="${ry}"/>`;
    }
    if (n.type === 'file') {
      const f = 16;
      return `<path class="n-shape" d="M0 0H${w - f}L${w} ${f}V${h}H0Z"/>` +
        `<path class="n-fold" d="M${w - f} 0V${f}H${w}Z"/>`;
    }
    if (n.type === 'app') {
      return `<rect class="n-shape" width="${w}" height="${h}" rx="7"/>` +
        `<line class="n-rule" x1="0" y1="18" x2="${w}" y2="18"/>` +
        [10, 20, 30].map((x) => `<circle class="n-dot" cx="${x}" cy="9" r="2.5"/>`).join('');
    }
    if (n.type === 'batch') {
      return `<rect class="n-shape" width="${w}" height="${h}" rx="7"/>` +
        `<path class="n-bar" d="M7 0H5A5 5 0 0 0 0 5V${h - 5}A5 5 0 0 0 5 ${h}H7Z"/>`;
    }
    return `<rect class="n-shape" width="${w}" height="${h}" rx="7"/>`;
  }

  function nodeTextSvg(n) {
    if (n.type === 'zone') {
      const line = wrap(n.name, `600 13px ${FONT}`, n.w - 24, 1)[0] || '';
      return `<text class="n-name" x="12" y="23">${esc(line)}</text>`;
    }
    const centered = n.type === 'database';
    const padLeft = n.type === 'batch' ? 20 : 14;
    const maxW = n.w - (centered ? 28 : padLeft + 12);
    const top = n.type === 'app' ? 18 : n.type === 'database' ? Math.min(36, n.h * 0.28) : 0;
    const avail = n.h - top - 12;
    const kicker = n.type === 'batch' ? (n.schedule || 'Batch') : TYPES[n.type].label;
    const showKicker = n.type !== 'service';
    const nameLines = wrap(n.name, `600 15px ${FONT}`, maxW, 2);
    let subLines = wrap(n.subtitle, `12.5px ${FONT}`, maxW, 2);
    const blockHeight = () => (showKicker ? 16 : 0) + nameLines.length * 19 + subLines.length * 16;
    if (blockHeight() > avail) subLines = subLines.slice(0, 1);
    if (blockHeight() > avail) subLines = [];
    let y = top + (n.h - top - blockHeight()) / 2;
    const x = centered ? n.w / 2 : padLeft;
    const anchor = centered ? ' text-anchor="middle"' : '';
    let out = '';
    const put = (cls, text, lh) => {
      out += `<text class="${cls}" x="${x}" y="${y + lh - 4}"${anchor}>${esc(text)}</text>`;
      y += lh;
    };
    if (showKicker) put('n-kicker', kicker.toUpperCase(), 16);
    nameLines.forEach((l) => put('n-name', l, 19));
    subLines.forEach((l) => put('n-sub', l, 16));
    return out;
  }

  function nodeSvg(n, ui) {
    const classes = ['node', 'type-' + n.type];
    if (ui && ui.selectedNode === n.id) classes.push('selected');
    if (ui && ui.connectOver === n.id) classes.push('connect-target');
    if (ui && ui.keep && n.type !== 'zone' && !ui.keep.has(n.id)) classes.push('dim');
    let extra = '';
    if (ui && n.type === 'zone') extra += `<rect class="zone-grip" width="${n.w}" height="36"/>`;
    if (ui && ui.editing && (n.type !== 'zone' || ui.selectedNode === n.id)) {
      const pts = { t: [n.w / 2, 0], r: [n.w, n.h / 2], b: [n.w / 2, n.h], l: [0, n.h / 2] };
      for (const side of Object.keys(pts)) {
        const [cx, cy] = pts[side];
        extra += `<circle class="h-hit" cx="${cx}" cy="${cy}" r="12" data-connect="${side}"/>` +
          `<circle class="h-dot" cx="${cx}" cy="${cy}" r="5"/>`;
      }
    }
    if (ui && ui.editing && ui.selectedNode === n.id) {
      extra += `<rect class="h-resize" x="${n.w - 6}" y="${n.h - 6}" width="12" height="12" rx="2" data-resize="1"/>`;
    }
    return `<g class="${classes.join(' ')}" data-node="${esc(n.id)}" transform="translate(${n.x} ${n.y})">` +
      shapeSvg(n) + nodeTextSvg(n) + extra + '</g>';
  }

  function sceneSvg(ui) {
    const routes = routeEdges();
    const zones = schema.nodes.filter((n) => n.type === 'zone').sort((a, b) => b.w * b.h - a.w * a.h);
    const others = schema.nodes.filter((n) => n.type !== 'zone');
    let lines = '';
    let labels = '';
    for (const it of routes) {
      const e = it.edge;
      const classes = ['edge', 'e-' + e.kind];
      if (ui && ui.selectedEdge === e.id) classes.push('selected');
      if (ui && ui.keep && e.from !== ui.focus && e.to !== ui.focus) classes.push('dim');
      const cls = classes.join(' ');
      const id = esc(e.id);
      const hit = ui ? `<path class="e-hit" d="${it.d}"/>` : '';
      const pulse = ui && ui.pulse && !classes.includes('dim')
        ? `<circle class="pulse-${e.kind}" r="4.5"><animateMotion dur="2.4s" repeatCount="indefinite" path="${it.d}"/></circle>`
        : '';
      lines += `<g class="${cls}" data-edge="${id}">${hit}` +
        `<path class="e-line" d="${it.d}" marker-end="url(#arrow-${e.kind})"/>${pulse}</g>`;
      if (e.label) {
        const width = textWidth(e.label, `600 12px ${FONT}`) + 16;
        labels += `<g class="${cls}" data-edge="${id}">` +
          `<rect class="e-pill" x="${it.mid.x - width / 2}" y="${it.mid.y - 11}" width="${width}" height="22" rx="11"/>` +
          `<text class="e-text" x="${it.mid.x}" y="${it.mid.y + 4}">${esc(e.label)}</text></g>`;
      }
    }
    return zones.map((n) => nodeSvg(n, ui)).join('') + lines + labels + others.map((n) => nodeSvg(n, ui)).join('');
  }

  function markersSvg() {
    return Object.keys(KINDS).map((k) => (
      `<marker id="arrow-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" ` +
      `markerUnits="userSpaceOnUse" orient="auto"><path class="a-${k}" d="M0 0L10 5L0 10Z"/></marker>`
    )).join('');
  }

  function focusSet() {
    if (!focusId) return null;
    const keep = new Set([focusId]);
    for (const e of schema.edges) {
      if (e.from === focusId) keep.add(e.to);
      if (e.to === focusId) keep.add(e.from);
    }
    return keep;
  }

  function renderScene() {
    const ui = {
      editing: !present,
      selectedNode: selection && selection.kind === 'node' ? selection.id : null,
      selectedEdge: selection && selection.kind === 'edge' ? selection.id : null,
      connectOver: drag && drag.kind === 'connect' ? drag.over : null,
      keep: focusSet(),
      focus: focusId,
      pulse: animate && !drag
    };
    let html = sceneSvg(ui);
    if (drag && drag.kind === 'connect') {
      html += `<path class="temp-line" d="M${drag.start.x} ${drag.start.y}L${drag.cursor.x} ${drag.cursor.y}"/>`;
    }
    viewport.innerHTML = html;
    viewport.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
    updateGrid();
  }

  function updateGrid() {
    const dots = $('dots');
    if (dots) dots.setAttribute('patternTransform', `translate(${view.x} ${view.y}) scale(${view.k})`);
  }

  function renderFlows() {
    const batches = schema.nodes.filter((n) => n.type === 'batch').sort((a, b) => a.y - b.y || a.x - b.x);
    $('flows').innerHTML = batches.length
      ? batches.map((b) => (
        `<button type="button" data-flow="${esc(b.id)}" aria-pressed="${focusId === b.id}">` +
        `<b>${esc(b.name || 'Sans nom')}</b><small>${esc(b.schedule || 'Batch')}</small></button>`
      )).join('')
      : '<p class="flows-empty">Aucun batch pour l\'instant.</p>';
  }

  function renderChrome() {
    const title = $('title');
    if (document.activeElement !== title) title.value = schema.title;
    document.title = schema.title;
    const status = $('status');
    status.textContent = { example: 'Exemple', draft: 'Enregistré dans ce navigateur' }[source];
    status.classList.toggle('draft', source !== 'example');
    $('undo').disabled = !undoStack.length;
    $('redo').disabled = !redoStack.length;
    $('revert').disabled = source === 'example';
    $('mode').textContent = present ? 'Modifier' : 'Présenter';
    $('anim').setAttribute('aria-pressed', String(animate));
    document.body.classList.toggle('present', present);
    svg.setAttribute('aria-label', schema.title);
  }

  function render() {
    renderScene();
    if (!drag) {
      renderFlows();
      renderChrome();
    }
  }

  /* ---------- Panneau de droite ---------- */

  function field(label, name, value, multiline) {
    const control = multiline
      ? `<textarea data-field="${name}" rows="3">${esc(value)}</textarea>`
      : `<input data-field="${name}" value="${esc(value)}">`;
    return `<label class="field"><span>${label}</span>${control}</label>`;
  }

  function select(label, name, options, value) {
    const opts = options.map(([v, text]) => (
      `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(text)}</option>`
    )).join('');
    return `<label class="field"><span>${label}</span><select data-field="${name}">${opts}</select></label>`;
  }

  function editNodeHtml(n) {
    let html = '<h2>Élément</h2>';
    html += select('Type', 'type', Object.keys(TYPES).map((t) => [t, TYPES[t].label]), n.type);
    html += field('Nom', 'name', n.name);
    if (n.type !== 'zone') html += field('Sous-titre', 'subtitle', n.subtitle);
    if (n.type === 'batch') {
      html += field('Fréquence', 'schedule', n.schedule);
      html += field('Lecture (reader)', 'reader', n.reader);
      html += field('Traitement (processor)', 'processor', n.processor);
      html += field('Écriture (writer)', 'writer', n.writer);
    }
    html += field('Description', 'description', n.description, true);
    html += '<div class="actions"><button type="button" data-action="duplicate">Dupliquer</button>' +
      '<button type="button" class="danger" data-action="delete">Supprimer</button></div>';
    return html;
  }

  function editEdgeHtml(e) {
    const nodes = schema.nodes.map((n) => [n.id, n.name || TYPES[n.type].label]);
    return '<h2>Lien</h2>' +
      field('Libellé', 'label', e.label) +
      select('Nature', 'kind', Object.keys(KINDS).map((k) => [k, KINDS[k].label]), e.kind) +
      select('Depuis', 'from', nodes, e.from) +
      select('Vers', 'to', nodes, e.to) +
      '<div class="actions"><button type="button" data-action="reverse">Inverser le sens</button>' +
      '<button type="button" class="danger" data-action="delete">Supprimer</button></div>';
  }

  function detailHtml(n) {
    const peers = (list, key) => list.map((e) => {
      const other = nodeById(e[key]);
      return esc((e.label ? e.label + ' : ' : '') + (other ? other.name : ''));
    }).join('<br>');
    const incoming = schema.edges.filter((e) => e.to === n.id);
    const outgoing = schema.edges.filter((e) => e.from === n.id);
    const rows = [];
    if (n.type === 'batch') {
      if (n.reader) rows.push(['Lecture', esc(n.reader)]);
      if (n.processor) rows.push(['Traitement', esc(n.processor)]);
      if (n.writer) rows.push(['Écriture', esc(n.writer)]);
    }
    if (incoming.length) rows.push(['Reçoit de', peers(incoming, 'from')]);
    if (outgoing.length) rows.push(['Envoie vers', peers(outgoing, 'to')]);
    return '<div class="detail">' +
      `<div class="kicker">${esc(n.type === 'batch' ? (n.schedule || 'Batch') : TYPES[n.type].label)}</div>` +
      `<h3>${esc(n.name)}</h3>` +
      (n.subtitle ? `<p class="sub">${esc(n.subtitle)}</p>` : '') +
      (n.description ? `<p>${esc(n.description)}</p>` : '') +
      (rows.length ? '<dl>' + rows.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('') + '</dl>' : '') +
      '</div>';
  }

  function renderInspector() {
    const panel = $('inspector');
    let html;
    let empty = false;
    if (present) {
      const n = focusId && nodeById(focusId);
      empty = !n;
      html = n ? detailHtml(n) : '';
    } else if (selection && selection.kind === 'node' && nodeById(selection.id)) {
      html = editNodeHtml(nodeById(selection.id));
    } else if (selection && selection.kind === 'edge' && edgeById(selection.id)) {
      html = editEdgeHtml(edgeById(selection.id));
    } else {
      empty = true;
      html = '<div class="hint"><h2>Modifier le schéma</h2><ul>' +
        '<li><b>Déplacer</b> : glissez un élément. Une zone se déplace par son titre, avec son contenu.</li>' +
        '<li><b>Relier</b> : survolez un élément, puis glissez un de ses points vers un autre élément.</li>' +
        '<li><b>Modifier</b> : cliquez sur un élément ou un lien. Double-clic pour renommer.</li>' +
        '<li><b>Naviguer</b> : glissez le fond, zoomez à la molette.</li>' +
        '<li><kbd>Suppr</kbd> efface, <kbd>Ctrl+D</kbd> duplique, <kbd>Ctrl+Z</kbd> annule.</li>' +
        '</ul><p>Rien n\'est envoyé sur internet : le schéma reste dans ce navigateur. Pour le conserver ou ' +
        'le transmettre, utilisez <b>Fichiers &gt; Exporter en JSON</b>.</p></div>';
    }
    panel.innerHTML = html;
    panel.classList.toggle('is-empty', empty);
  }

  function focusNameField() {
    const input = document.querySelector('#inspector [data-field="name"]');
    if (input) { input.focus(); input.select(); }
  }

  /* ---------- Actions ---------- */

  function setSelection(next) {
    selection = next;
    render();
    renderInspector();
  }

  function setFocus(id) {
    focusId = id;
    render();
    renderInspector();
  }

  function addNode(type) {
    pushHistory();
    const rect = svg.getBoundingClientRect();
    const base = TYPES[type];
    const cx = (rect.width / 2 - view.x) / view.k;
    const cy = (rect.height / 2 - view.y) / view.k;
    const shift = (schema.nodes.length % 6) * 20;
    const node = normalizeNode({
      id: uid('n'),
      type,
      x: snap(cx - base.w / 2 + shift),
      y: snap(cy - base.h / 2 + shift),
      name: type === 'batch' ? 'Nouveau batch' : type === 'zone' ? 'Nouvelle zone' : TYPES[type].label,
      schedule: type === 'batch' ? 'Quotidien' : ''
    }, 0);
    schema.nodes.push(node);
    selection = { kind: 'node', id: node.id };
    focusId = null;
    commit();
    renderInspector();
    focusNameField();
  }

  function deleteSelection() {
    if (!selection) return;
    pushHistory();
    if (selection.kind === 'node') {
      schema.nodes = schema.nodes.filter((n) => n.id !== selection.id);
      schema.edges = schema.edges.filter((e) => e.from !== selection.id && e.to !== selection.id);
      if (focusId === selection.id) focusId = null;
    } else {
      schema.edges = schema.edges.filter((e) => e.id !== selection.id);
    }
    selection = null;
    commit();
    renderInspector();
  }

  function duplicateSelection() {
    if (!selection || selection.kind !== 'node') return;
    const original = nodeById(selection.id);
    if (!original) return;
    pushHistory();
    const copy = { ...original, id: uid('n'), x: original.x + 30, y: original.y + 30 };
    copy.name = original.name + ' (copie)';
    schema.nodes.push(copy);
    selection = { kind: 'node', id: copy.id };
    commit();
    renderInspector();
  }

  function guessKind(from, to) {
    if (from.type === 'batch' && to.type === 'app') return 'publish';
    if (from.type === 'batch') return 'write';
    return 'read';
  }

  function stepFlow(delta) {
    const batches = schema.nodes.filter((n) => n.type === 'batch').sort((a, b) => a.y - b.y || a.x - b.x);
    if (!batches.length) return;
    const index = batches.findIndex((b) => b.id === focusId);
    const next = index < 0
      ? (delta > 0 ? 0 : batches.length - 1)
      : (index + delta + batches.length) % batches.length;
    setFocus(batches[next].id);
  }

  function setPresent(value) {
    present = value;
    selection = null;
    focusId = null;
    animate = value && !reducedMotion;
    const url = new URL(location.href);
    if (value) url.searchParams.set('mode', 'presentation');
    else url.searchParams.delete('mode');
    // Certains navigateurs refusent de réécrire l'adresse d'un fichier local.
    try { history.replaceState(null, '', url); } catch (err) { /* sans conséquence */ }
    render();
    renderInspector();
    requestAnimationFrame(fit);
  }

  /* ---------- Vue ---------- */

  function snap(v) { return Math.round(v / GRID) * GRID; }

  function bounds() {
    if (!schema.nodes.length) return { x: 0, y: 0, w: 400, h: 300 };
    const x = Math.min(...schema.nodes.map((n) => n.x));
    const y = Math.min(...schema.nodes.map((n) => n.y));
    const r = Math.max(...schema.nodes.map((n) => n.x + n.w));
    const b = Math.max(...schema.nodes.map((n) => n.y + n.h));
    return { x, y, w: r - x, h: b - y };
  }

  function fit() {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const b = bounds();
    const pad = 44;
    const k = Math.min(1.25, Math.max(0.15, Math.min((rect.width - pad * 2) / b.w, (rect.height - pad * 2) / b.h)));
    view = { k, x: (rect.width - b.w * k) / 2 - b.x * k, y: (rect.height - b.h * k) / 2 - b.y * k };
    autoFit = true;
    renderScene();
  }

  function zoomAt(factor, sx, sy) {
    autoFit = false;
    const k = Math.min(3, Math.max(0.15, view.k * factor));
    view.x = sx - (sx - view.x) * (k / view.k);
    view.y = sy - (sy - view.y) * (k / view.k);
    view.k = k;
    viewport.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
    updateGrid();
  }

  function zoomCenter(factor) {
    const rect = svg.getBoundingClientRect();
    zoomAt(factor, rect.width / 2, rect.height / 2);
  }

  function toWorld(e) {
    const rect = svg.getBoundingClientRect();
    return { x: (e.clientX - rect.left - view.x) / view.k, y: (e.clientY - rect.top - view.y) / view.k };
  }

  /* ---------- Souris et tactile ---------- */

  function onPointerDown(e) {
    if (e.button > 0) return;
    closeMenu();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    const target = e.target;
    const nodeEl = target.closest('[data-node]');
    const edgeEl = target.closest('[data-edge]');
    const connectEl = target.closest('[data-connect]');
    const resizeEl = target.closest('[data-resize]');
    const world = toWorld(e);
    svg.setPointerCapture(e.pointerId);

    if (!present && connectEl && nodeEl) {
      const n = nodeById(nodeEl.dataset.node);
      const side = connectEl.dataset.connect;
      const along = side === 'l' || side === 'r' ? n.y + n.h / 2 : n.x + n.w / 2;
      drag = { kind: 'connect', from: n.id, start: sidePoint(n, side, along), cursor: world, over: null };
      return;
    }
    if (!present && resizeEl && nodeEl) {
      const n = nodeById(nodeEl.dataset.node);
      drag = { kind: 'resize', id: n.id, start: world, w: n.w, h: n.h, moved: false };
      return;
    }
    if (nodeEl) {
      const id = nodeEl.dataset.node;
      if (present) {
        setFocus(focusId === id ? null : id);
        drag = null;
        return;
      }
      const now = performance.now();
      const isDouble = lastClick.id === id && now - lastClick.t < 400;
      lastClick = { id, t: now };
      if (!selection || selection.id !== id) {
        focusId = null;
        setSelection({ kind: 'node', id });
      }
      if (isDouble) {
        focusNameField();
        return;
      }
      const n = nodeById(id);
      const origins = new Map([[id, { x: n.x, y: n.y }]]);
      if (n.type === 'zone') {
        for (const o of schema.nodes) {
          const cx = o.x + o.w / 2;
          const cy = o.y + o.h / 2;
          if (o !== n && cx >= n.x && cx <= n.x + n.w && cy >= n.y && cy <= n.y + n.h) {
            origins.set(o.id, { x: o.x, y: o.y });
          }
        }
      }
      drag = { kind: 'move', start: world, origins, moved: false, screen: { x: e.clientX, y: e.clientY } };
      return;
    }
    if (edgeEl && !present) {
      focusId = null;
      setSelection({ kind: 'edge', id: edgeEl.dataset.edge });
      return;
    }
    drag = { kind: 'pan', x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    svg.classList.add('panning');
  }

  function onPointerMove(e) {
    if (!drag) return;
    if (drag.kind === 'pan') {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        drag.moved = true;
        autoFit = false;
      }
      view.x = drag.vx + dx;
      view.y = drag.vy + dy;
      viewport.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
      updateGrid();
      return;
    }
    const world = toWorld(e);
    if (drag.kind === 'move') {
      if (!drag.moved) {
        if (Math.abs(e.clientX - drag.screen.x) + Math.abs(e.clientY - drag.screen.y) < 4) return;
        pushHistory();
        drag.moved = true;
      }
      const dx = world.x - drag.start.x;
      const dy = world.y - drag.start.y;
      for (const [id, o] of drag.origins) {
        const n = nodeById(id);
        n.x = snap(o.x + dx);
        n.y = snap(o.y + dy);
      }
      renderScene();
    } else if (drag.kind === 'resize') {
      if (!drag.moved) { pushHistory(); drag.moved = true; }
      const n = nodeById(drag.id);
      n.w = Math.max(n.type === 'zone' ? 160 : 120, snap(drag.w + world.x - drag.start.x));
      n.h = Math.max(n.type === 'zone' ? 100 : 60, snap(drag.h + world.y - drag.start.y));
      renderScene();
    } else if (drag.kind === 'connect') {
      drag.cursor = world;
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const el = under && under.closest('[data-node]');
      drag.over = el && el.dataset.node !== drag.from ? el.dataset.node : null;
      renderScene();
    }
  }

  function onPointerUp() {
    if (!drag) return;
    const finished = drag;
    drag = null;
    svg.classList.remove('panning');
    if (finished.kind === 'pan') {
      if (!finished.moved && (selection || focusId)) {
        selection = null;
        focusId = null;
        render();
        renderInspector();
      }
      return;
    }
    if (finished.kind === 'connect') {
      if (finished.over) {
        const from = nodeById(finished.from);
        const to = nodeById(finished.over);
        pushHistory();
        const kind = guessKind(from, to);
        const edge = { id: uid('e'), from: from.id, to: to.id, kind, label: KINDS[kind].verb };
        schema.edges.push(edge);
        selection = { kind: 'edge', id: edge.id };
        commit();
        renderInspector();
      } else {
        render();
      }
      return;
    }
    if (finished.moved) commit();
    else render();
  }

  /* ---------- Formulaire ---------- */

  function onInspectorInput(e) {
    const name = e.target.dataset && e.target.dataset.field;
    if (!name || !selection) return;
    const item = selection.kind === 'node' ? nodeById(selection.id) : edgeById(selection.id);
    if (!item) return;
    if (!fieldEditing) { pushHistory(); fieldEditing = true; }
    if (selection.kind === 'edge' && (name === 'from' || name === 'to')) {
      const other = name === 'from' ? item.to : item.from;
      if (e.target.value === other) {
        toast('Un lien doit relier deux éléments différents.');
        e.target.value = item[name];
        return;
      }
    }
    item[name] = e.target.value;
    saveDraft();
    render();
    if (e.target.tagName === 'SELECT') {
      fieldEditing = false;
      if (name === 'type') renderInspector();
    }
  }

  function onInspectorClick(e) {
    const action = e.target.dataset && e.target.dataset.action;
    if (action === 'delete') deleteSelection();
    if (action === 'duplicate') duplicateSelection();
    if (action === 'reverse' && selection && selection.kind === 'edge') {
      const edge = edgeById(selection.id);
      pushHistory();
      [edge.from, edge.to] = [edge.to, edge.from];
      commit();
      renderInspector();
    }
  }

  /* ---------- Exports ---------- */

  function download(filename, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function resolvedCss() {
    const probe = getComputedStyle($('theme-probe'));
    return SVG_CSS.replace(/var\((--[\w-]+)\)/g, (_, name) => probe.getPropertyValue(name).trim());
  }

  function exportSvgText() {
    const b = bounds();
    const pad = 36;
    const titleH = 44;
    const legendH = 34;
    const width = Math.ceil(b.w + pad * 2);
    const height = Math.ceil(b.h + pad * 2 + titleH + legendH);
    const probe = getComputedStyle($('theme-probe'));
    let legendX = 0;
    let legend = '';
    for (const k of Object.keys(KINDS)) {
      legend += `<g class="edge e-${k}" transform="translate(${legendX} 0)">` +
        `<path class="e-line" d="M0 0H34" marker-end="url(#arrow-${k})"/>` +
        `<text class="x-legend" x="42" y="4">${KINDS[k].label}</text></g>`;
      legendX += 130;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<style>${resolvedCss()}</style><defs>${markersSvg()}</defs>` +
      `<rect width="100%" height="100%" fill="${probe.getPropertyValue('--bg').trim()}"/>` +
      `<text class="x-title" x="${pad}" y="${pad + 12}">${esc(schema.title)}</text>` +
      `<g transform="translate(${pad - b.x} ${pad + titleH - b.y})">${sceneSvg(null)}</g>` +
      `<g transform="translate(${pad} ${height - pad + 4})">${legend}</g></svg>`;
  }

  function slug() {
    return (schema.title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) || 'schema';
  }

  function exportPng() {
    const text = exportSvgText();
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => download(slug() + '.png', blob));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast('La création de l\'image a échoué.');
    };
    img.src = url;
  }

  function exportJson() {
    download(slug() + '.json', JSON.stringify(schema, null, 2) + '\n', 'application/json');
    toast('Schéma exporté dans vos téléchargements.');
  }

  function importFile(file) {
    if (file.size > 5 * 1024 * 1024) {
      toast('Import impossible : le fichier dépasse 5 Mo.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast('Import impossible : le fichier n\'a pas pu être lu.');
    reader.onload = () => {
      try {
        const next = normalize(JSON.parse(String(reader.result)));
        pushHistory();
        schema = next;
        selection = null;
        focusId = null;
        commit();
        renderInspector();
        fit();
        toast('Schéma importé.');
      } catch (err) {
        toast('Import impossible : ce fichier n\'est pas un schéma JSON valide.');
      }
    };
    reader.readAsText(file);
  }

  /* ---------- Divers ---------- */

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
  }

  function closeMenu() {
    $('file-menu').open = false;
  }

  function onKeyDown(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (present) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); stepFlow(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); stepFlow(-1); }
      else if (e.key === 'Escape') { if (focusId) setFocus(null); else setPresent(false); }
      return;
    }
    if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) restore(redoStack, undoStack); else restore(undoStack, redoStack); }
    else if (mod && key === 'y') { e.preventDefault(); restore(redoStack, undoStack); }
    else if (mod && key === 'd') { e.preventDefault(); duplicateSelection(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); }
    else if (e.key === 'Escape') { setSelection(null); }
    else if (selection && selection.kind === 'node' && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const n = nodeById(selection.id);
      pushHistory();
      if (e.key === 'ArrowLeft') n.x -= GRID;
      if (e.key === 'ArrowRight') n.x += GRID;
      if (e.key === 'ArrowUp') n.y -= GRID;
      if (e.key === 'ArrowDown') n.y += GRID;
      commit();
    }
  }

  function buildStatic() {
    const style = document.createElement('style');
    style.textContent = SVG_CSS + UI_CSS;
    document.head.appendChild(style);
    $('defs').innerHTML = markersSvg() +
      '<pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">' +
      '<circle cx="1" cy="1" r="1" fill="var(--dot)"/></pattern>';
    $('palette').innerHTML = Object.keys(TYPES).map((t) => (
      `<button type="button" data-add="${t}" style="--swatch:var(${TYPES[t].swatch})">${TYPES[t].label}</button>`
    )).join('');
    $('legend').innerHTML = Object.keys(KINDS).map((k) => {
      const dash = { read: '7 5', write: 'none', publish: '12 4 2 4' }[k];
      return `<span><svg width="34" height="10" aria-hidden="true"><line x1="0" y1="5" x2="34" y2="5" ` +
        `stroke="var(--${k})" stroke-width="2" stroke-dasharray="${dash}"/></svg>${KINDS[k].label}</span>`;
    }).join('');
  }

  function bindEvents() {
    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerUp);
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });
    new ResizeObserver(() => { if (autoFit && schema && !drag) fit(); }).observe($('stage'));
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#file-menu')) closeMenu();
    });

    const inspector = $('inspector');
    inspector.addEventListener('input', onInspectorInput);
    inspector.addEventListener('click', onInspectorClick);
    inspector.addEventListener('focusout', () => { fieldEditing = false; renderFlows(); });

    $('title').addEventListener('input', (e) => {
      if (!fieldEditing) { pushHistory(); fieldEditing = true; }
      schema.title = e.target.value;
      saveDraft();
      renderChrome();
    });
    $('title').addEventListener('blur', () => { fieldEditing = false; });

    $('palette').addEventListener('click', (e) => {
      const button = e.target.closest('[data-add]');
      if (button) addNode(button.dataset.add);
    });
    $('flows').addEventListener('click', (e) => {
      const button = e.target.closest('[data-flow]');
      if (!button) return;
      const id = button.dataset.flow;
      const next = focusId === id ? null : id;
      focusId = next;
      if (!present) selection = next ? { kind: 'node', id } : null;
      render();
      renderInspector();
    });

    $('undo').addEventListener('click', () => restore(undoStack, redoStack));
    $('redo').addEventListener('click', () => restore(redoStack, undoStack));
    $('mode').addEventListener('click', () => setPresent(!present));
    $('anim').addEventListener('click', () => { animate = !animate; render(); });
    $('zoom-in').addEventListener('click', () => zoomCenter(1.25));
    $('zoom-out').addEventListener('click', () => zoomCenter(0.8));
    $('zoom-fit').addEventListener('click', fit);

    const menuAction = (id, action) => $(id).addEventListener('click', () => { closeMenu(); action(); });
    menuAction('export-json', exportJson);
    menuAction('import', () => $('import-file').click());
    menuAction('export-png', exportPng);
    menuAction('export-svg', () => download(slug() + '.svg', exportSvgText(), 'image/svg+xml'));
    menuAction('revert', () => {
      if (!window.confirm('Effacer le schéma enregistré dans ce navigateur et repartir de l\'exemple ? Exportez-le d\'abord en JSON pour le conserver.')) return;
      storage((s) => s.removeItem(DRAFT_KEY));
      undoStack = [];
      redoStack = [];
      replaceSchema(JSON.parse(exampleJson), 'example');
    });
    $('import-file').addEventListener('change', (e) => {
      if (e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = '';
    });

    // Un fichier déposé hors de la zone ne doit pas faire quitter la page au navigateur.
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      if (present) return;
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) importFile(file);
    });
  }

  function init() {
    buildStatic();
    bindEvents();
    exampleJson = JSON.stringify(normalize(window.SCHEMA_EXEMPLE || { nodes: [], edges: [] }));
    schema = JSON.parse(exampleJson);
    source = 'example';

    const draft = storage((s) => JSON.parse(s.getItem(DRAFT_KEY) || 'null'));
    if (draft && draft.schema) {
      try {
        const candidate = normalize(draft.schema);
        if (JSON.stringify(candidate) === exampleJson) {
          storage((s) => s.removeItem(DRAFT_KEY));
        } else {
          schema = candidate;
          source = 'draft';
        }
      } catch (err) {
        storage((s) => s.removeItem(DRAFT_KEY));
      }
    }
    present = new URLSearchParams(location.search).get('mode') === 'presentation';
    animate = present && !reducedMotion;
    render();
    renderInspector();
    requestAnimationFrame(fit);
  }

  init();
})();
