/* Haus — Biopunk Accelerator Skill Tree · renderer
   ─────────────────────────────────────────────────────────────────────────────

   Data comes from skilltree-data.js, which is GENERATED. To change a node's
   wording, edit the Founder Manual at
   netlify/functions/homeroom/app/data/curriculum.js; to change the graph, its
   videos or its reading, edit tools/biopunk-skill-tree/scripts/graph.mjs. Then:

     node tools/biopunk-skill-tree/scripts/build_tree.mjs
     node tools/biopunk-skill-tree/scripts/validate.mjs

   This file is the renderer and rarely needs touching.

   THREE THINGS THAT MUST SURVIVE EVERY EDIT
   ------------------------------------------
   1. NOTHING LOCKS. Dependencies draw the graph and populate "builds on" /
      "leads to". They never gate. Every node opens on the first visit whatever
      you finished before, and "next up" is a suggestion with no teeth.
   2. NO VIDEO LOADS UNTIL ASKED. Thirty-three YouTube iframes would mean
      thirty-three third-party connections on page load for a page most people
      read two nodes of. Each video is a poster button that swaps itself for the
      iframe on click, using youtube-nocookie.
   3. A LOCKED-DOWN BROWSER MUST NOT BREAK THE PAGE. Every localStorage access
      goes through readStore/writeStore, which swallow the private-mode throw.

   TWO MODES
   ---------
   Standalone (haus.fund/skilltree) keeps progress in localStorage, because
   there is nobody to attribute it to.

   Embedded (`?embed=1`, which is how /homeroom/library/tree loads it in an
   iframe) asks /homeroom/api/library who the member is and what they have
   finished, and shows THAT instead. Progress then becomes read-only here on
   purpose: in Homeroom a module is done when the deliverable exists, so the
   only way to mark one is the module's own form, and every node links to it.
   If that call fails for any reason — signed out, offline, 401 — the page
   falls back to localStorage and says nothing.
*/

(function () {
  'use strict';

  var DATA = typeof SKILLTREE !== 'undefined' ? SKILLTREE : null;
  var PROG_KEY = 'haus.skilltree.progress';
  var VIEW_KEY = 'haus.skilltree.view';

  /* Column tint per track. Ordered as TRACK_ORDER in graph.mjs. */
  var TRACK_COLOR = {
    'program': '#0D0D0D',
    'founder-fundamentals': '#1C3B2D',
    'customers-and-commercialization': '#B8924A',
    'fundraising-and-capital': '#1A3D5C',
    'legal-ip-and-regulatory': '#6B4E2A',
    'team-and-operations': '#2A5C46',
    'brand-network-and-life': '#7A3B52'
  };
  var TRACK_SHORT = {
    'program': 'Spine',
    'founder-fundamentals': 'Fundamentals',
    'customers-and-commercialization': 'Customers',
    'fundraising-and-capital': 'Capital',
    'legal-ip-and-regulatory': 'Legal / regulatory',
    'team-and-operations': 'Team / ops',
    'brand-network-and-life': 'Brand / network'
  };

  var CELL_W = 268, CELL_H = 132, NODE_W = 210, NODE_H = 82, PAD = 60;

  var byId = {};
  var progress = {};
  /* EMBED: rendered inside Homeroom. LIVE: Homeroom answered, so `progress`
     is the member's real progress and this page must not write to it. */
  var EMBED = false;
  var LIVE = false;
  var state = { view: 'map', q: '', tracks: {}, only: {}, active: null };
  var pan = { x: PAD, y: PAD, k: 1 };

  /* ── storage ─────────────────────────────────────────────────────────── */

  function readStore(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  /* ── helpers ─────────────────────────────────────────────────────────── */

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  };
  /* Inside the Homeroom iframe a site-relative link must replace the whole
     Homeroom page, not load Homeroom inside the tree. */
  function linkAttrs(url) {
    if (url.charAt(0) !== '/') return ' target="_blank" rel="noopener"';
    return EMBED ? ' target="_top"' : '';
  }

  function host(url) {
    if (url.charAt(0) === '/') return 'haus.fund';
    return url.replace(/^https:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
  function youtubeId(url) {
    var m = /[?&]v=([A-Za-z0-9_-]{11})/.exec(url);
    return m ? m[1] : '';
  }
  function trackOf(slug) {
    for (var i = 0; i < DATA.tracks.length; i++) {
      if (DATA.tracks[i].slug === slug) return DATA.tracks[i];
    }
    return { slug: slug, title: slug, focus: '', blurb: '' };
  }

  /* ── search ──────────────────────────────────────────────────────────── */

  function haystack(n) {
    if (!n._hay) {
      n._hay = [
        n.title.name, n.track, n.kind, n.deliverable, n.overview.description,
        n.overview.objectives.join(' '), n.steps.instructions.join(' '),
        n.resources.map(function (r) { return r.title; }).join(' '),
        n.video ? n.video.title + ' ' + n.video.source : ''
      ].join(' ').toLowerCase();
    }
    return n._hay;
  }

  function matches(n) {
    if (state.q && haystack(n).indexOf(state.q) === -1) return false;
    var anyTrack = false, t;
    for (t in state.tracks) { if (state.tracks[t]) { anyTrack = true; break; } }
    if (anyTrack && !state.tracks[n.track]) return false;
    if (state.only.video && !n.video) return false;
    if (state.only.deliverable && !n.deliverable) return false;
    if (state.only.live && !n.week) return false;
    if (state.only.spine && !n.onMainPath) return false;
    if (state.only.todo && progress[n.id] === 'done') return false;
    return true;
  }

  /* ── progress ────────────────────────────────────────────────────────── */

  function isNextUp(n) {
    if (progress[n.id] === 'done') return false;
    if (!n.dependencies.length) return false;
    for (var i = 0; i < n.dependencies.length; i++) {
      if (progress[n.dependencies[i]] !== 'done') return false;
    }
    return true;
  }

  function saveProgress() {
    if (!LIVE) writeStore(PROG_KEY, progress);
    paintProgress();
    render();
    if (state.active) renderDrawerFooter(byId[state.active]);
  }

  function paintProgress() {
    var total = DATA.nodes.length, done = 0;
    DATA.nodes.forEach(function (n) { if (progress[n.id] === 'done') done++; });
    $('progBar').style.width = (total ? Math.round((done / total) * 100) : 0) + '%';
    $('progLbl').textContent = done + ' / ' + total + ' done'
      + (LIVE ? ' · from Homeroom' : '');
  }

  /* ── chips ───────────────────────────────────────────────────────────── */

  function buildChips() {
    var html = '';
    DATA.tracks.forEach(function (t) {
      html += '<button type="button" class="chip" data-track="' + esc(t.slug) + '" aria-pressed="false">' +
        '<span class="dot" style="background:' + (TRACK_COLOR[t.slug] || '#CECAC1') + '"></span>' +
        esc(TRACK_SHORT[t.slug] || t.title) + '</button>';
    });
    html += '<span class="sep"></span>';
    [['spine', 'the spine'], ['live', 'live workshop'], ['video', 'has video'],
      ['deliverable', 'has deliverable'], ['todo', 'not done']].forEach(function (p) {
      html += '<button type="button" class="chip" data-only="' + p[0] + '" aria-pressed="false">' +
        esc(p[1]) + '</button>';
    });
    html += '<span class="note" id="countNote"></span>';
    $('chips').innerHTML = html;

    $('chips').addEventListener('click', function (ev) {
      var b = ev.target.closest('.chip');
      if (!b) return;
      if (b.dataset.track) state.tracks[b.dataset.track] = !state.tracks[b.dataset.track];
      else state.only[b.dataset.only] = !state.only[b.dataset.only];
      b.setAttribute('aria-pressed', String(
        b.dataset.track ? !!state.tracks[b.dataset.track] : !!state.only[b.dataset.only]));
      render();
    });
  }

  /* ── map ─────────────────────────────────────────────────────────────── */

  var mapBuilt = false;

  function buildMap() {
    var canvas = $('canvas');
    var cols = 0, rows = 0;
    DATA.nodes.forEach(function (n) {
      cols = Math.max(cols, n.initialPosition[0] + 1);
      rows = Math.max(rows, n.initialPosition[1] + 1);
    });
    canvas.style.width = (cols * CELL_W) + 'px';
    canvas.style.height = (rows * CELL_H + 40) + 'px';

    var frag = document.createDocumentFragment();

    /* column headings */
    DATA.tracks.forEach(function (t, i) {
      var h = document.createElement('div');
      h.className = 'colhead';
      h.style.left = (i * CELL_W) + 'px';
      h.style.top = '-30px';
      h.textContent = TRACK_SHORT[t.slug] || t.title;
      frag.appendChild(h);
    });

    DATA.nodes.forEach(function (n) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'node';
      el.id = 'n-' + n.id;
      el.dataset.id = n.id;
      el.style.left = (n.initialPosition[0] * CELL_W) + 'px';
      el.style.top = (n.initialPosition[1] * CELL_H) + 'px';
      el.style.setProperty('--tc', TRACK_COLOR[n.track] || '#CECAC1');
      el.innerHTML =
        '<div class="nm">' + esc(n.title.name) + '</div>' +
        '<div class="mt">' +
          '<span class="tick" data-tick>' + (progress[n.id] === 'done' ? '✓' : '') + '</span>' +
          '<span>' + (n.week ? 'wk ' + n.week : 'async') + '</span>' +
          '<span>' + esc(n.kind) + '</span>' +
          (n.video ? '<span class="cam">▶</span>' : '') +
        '</div>';
      frag.appendChild(el);
    });

    canvas.appendChild(frag);
    canvas.addEventListener('click', function (ev) {
      var b = ev.target.closest('.node');
      if (b) openNode(b.dataset.id);
    });

    drawEdges();
    mapBuilt = true;
  }

  function centreOf(n) {
    return {
      x: n.initialPosition[0] * CELL_W + NODE_W / 2,
      y: n.initialPosition[1] * CELL_H + NODE_H / 2
    };
  }

  function drawEdges() {
    var svg = $('edges');
    var parts = [];
    DATA.nodes.forEach(function (n) {
      n.dependencies.forEach(function (depId) {
        var dep = byId[depId];
        if (!dep) return;
        var a = centreOf(dep), b = centreOf(n);
        var dy = Math.max(30, Math.abs(b.y - a.y) * 0.45);
        var d = 'M' + a.x + ',' + a.y + ' C' + a.x + ',' + (a.y + dy) +
                ' ' + b.x + ',' + (b.y - dy) + ' ' + b.x + ',' + b.y;
        var spine = dep.onMainPath && n.onMainPath;
        parts.push('<path d="' + d + '" data-from="' + esc(depId) + '" data-to="' + esc(n.id) + '"' +
          (spine ? ' class="spine"' : '') + '></path>');
      });
    });
    svg.setAttribute('width', $('canvas').style.width);
    svg.setAttribute('height', $('canvas').style.height);
    svg.innerHTML = parts.join('');
  }

  function applyTransform() {
    $('canvas').style.transform =
      'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + pan.k + ')';
  }

  function fitMap() {
    var wrap = $('mapwrap');
    var w = parseFloat($('canvas').style.width) + PAD;
    var h = parseFloat($('canvas').style.height) + PAD * 2;
    var k = Math.min(wrap.clientWidth / w, wrap.clientHeight / h, 1);
    pan.k = Math.max(0.3, k);
    pan.x = (wrap.clientWidth - w * pan.k) / 2 + PAD * pan.k / 2;
    pan.y = PAD * pan.k;
    applyTransform();
  }

  function wireMapControls() {
    var wrap = $('mapwrap');
    var drag = null;

    wrap.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.node') || ev.target.closest('.zoom')) return;
      drag = { x: ev.clientX - pan.x, y: ev.clientY - pan.y, id: ev.pointerId, moved: false };
      wrap.classList.add('dragging');
      wrap.setPointerCapture(ev.pointerId);
    });
    wrap.addEventListener('pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      pan.x = ev.clientX - drag.x;
      pan.y = ev.clientY - drag.y;
      drag.moved = true;
      applyTransform();
    });
    function endDrag(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      drag = null;
      wrap.classList.remove('dragging');
    }
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', endDrag);

    wrap.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var r = wrap.getBoundingClientRect();
      zoomAt(ev.clientX - r.left, ev.clientY - r.top, ev.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });

    function zoomAt(cx, cy, factor) {
      var k = Math.min(2.2, Math.max(0.3, pan.k * factor));
      var ratio = k / pan.k;
      pan.x = cx - (cx - pan.x) * ratio;
      pan.y = cy - (cy - pan.y) * ratio;
      pan.k = k;
      applyTransform();
    }

    $('zIn').addEventListener('click', function () {
      zoomAt(wrap.clientWidth / 2, wrap.clientHeight / 2, 1.2);
    });
    $('zOut').addEventListener('click', function () {
      zoomAt(wrap.clientWidth / 2, wrap.clientHeight / 2, 1 / 1.2);
    });
    $('zFit').addEventListener('click', fitMap);
    $('zReset').addEventListener('click', function () {
      pan = { x: PAD, y: PAD, k: 1 };
      applyTransform();
    });
  }

  function paintMap() {
    var anyFilter = !!state.q, k;
    for (k in state.tracks) { if (state.tracks[k]) anyFilter = true; }
    for (k in state.only) { if (state.only[k]) anyFilter = true; }

    DATA.nodes.forEach(function (n) {
      var el = $('n-' + n.id);
      if (!el) return;
      var hit = matches(n);
      el.classList.toggle('dim', anyFilter && !hit);
      el.classList.toggle('done', progress[n.id] === 'done');
      el.classList.toggle('next', isNextUp(n));
      el.classList.toggle('spine', n.onMainPath);
      el.classList.toggle('active', state.active === n.id);
      var tick = el.querySelector('[data-tick]');
      if (tick) tick.textContent = progress[n.id] === 'done' ? '✓' : '';
    });

    var paths = $('edges').querySelectorAll('path');
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      var lit = state.active &&
        (p.dataset.from === state.active || p.dataset.to === state.active);
      p.classList.toggle('lit', !!lit);
    }
  }

  /* ── tracks view ─────────────────────────────────────────────────────── */

  function paintTracks() {
    var html = '';
    DATA.tracks.forEach(function (t) {
      var nodes = DATA.nodes.filter(function (n) { return n.track === t.slug; });
      var shown = nodes.filter(matches);
      if (!shown.length) return;
      var done = nodes.filter(function (n) { return progress[n.id] === 'done'; }).length;
      var pct = nodes.length ? Math.round((done / nodes.length) * 100) : 0;
      html += '<article class="tcard" style="--tc:' + (TRACK_COLOR[t.slug] || '#1C3B2D') + '">' +
        '<h3>' + esc(t.title) + '</h3>' +
        '<div class="focus">' + esc(t.focus) + '</div>' +
        '<p>' + esc(t.blurb) + '</p>' +
        '<div class="tbar"><span class="track"><i style="width:' + pct + '%"></i></span>' +
          '<span class="mono">' + done + '/' + nodes.length + '</span></div>' +
        '<ul class="rows">' + shown.map(function (n) {
          return '<li class="' + (progress[n.id] === 'done' ? 'done' : '') + '">' +
            '<button type="button" data-id="' + esc(n.id) + '">' +
              '<span class="rn">' + (progress[n.id] === 'done' ? '✓ ' : '') + esc(n.title.name) + '</span>' +
              '<span class="rm">' + (n.week ? 'wk ' + n.week : 'async') +
                (n.video ? ' · ▶' : '') + '</span>' +
            '</button></li>';
        }).join('') + '</ul></article>';
    });
    $('trackgrid').innerHTML = html;
  }

  /* ── calendar view ───────────────────────────────────────────────────── */

  var QUIET = {
    5: 'The retreat. No workshop — that is the programming.',
    8: 'The hackathon sprint. No workshop — that is the programming.'
  };

  function paintCalendar() {
    var html = '';
    for (var w = 1; w <= 12; w++) {
      var inWeek = DATA.nodes.filter(function (n) { return n.week === w && matches(n); });
      var quiet = !inWeek.length && QUIET[w];
      html += '<article class="week' + (quiet ? ' quiet' : '') + '">' +
        '<div class="wk">Week ' + w + '</div>' +
        '<div class="wl">' + (quiet ? 'no workshop' : inWeek.length + ' module' +
          (inWeek.length === 1 ? '' : 's')) + '</div>' +
        (quiet ? '<p class="note">' + esc(QUIET[w]) + '</p>'
               : '<ul class="rows">' + inWeek.map(rowFor).join('') + '</ul>') +
        '</article>';
    }
    var async = DATA.nodes.filter(function (n) { return !n.week && matches(n); });
    if (async.length) {
      html += '<article class="week async"><div class="wk">Async</div>' +
        '<div class="wl">' + async.length + ' modules · work them whenever</div>' +
        '<ul class="rows" style="columns:2;column-gap:32px;">' + async.map(rowFor).join('') + '</ul></article>';
    }
    $('weeks').innerHTML = html;
  }

  function rowFor(n) {
    return '<li class="' + (progress[n.id] === 'done' ? 'done' : '') + '">' +
      '<button type="button" data-id="' + esc(n.id) + '">' +
        '<span class="rn">' + (progress[n.id] === 'done' ? '✓ ' : '') + esc(n.title.name) + '</span>' +
        '<span class="rm">' + esc(TRACK_SHORT[n.track] || '') + '</span>' +
      '</button></li>';
  }

  /* ── drawer ──────────────────────────────────────────────────────────── */

  function openNode(id) {
    var n = byId[id];
    if (!n) return;
    state.active = id;
    var t = trackOf(n.track);

    $('dTrack').textContent = t.title;
    $('dTitle').textContent = n.title.name;
    $('dMeta').innerHTML = [
      n.kind,
      n.minutes + ' min',
      n.week ? '<span class="badge live">live · week ' + n.week + '</span>' : 'async',
      n.onMainPath ? '<span class="badge spine">on the spine</span>' : ''
    ].filter(Boolean).join('<span>/</span>');

    var html = '<p class="lede">' + esc(n.overview.description) + '</p>';

    if (n.video) {
      html += '<div class="sect"><h4>Watch first</h4><div class="vid" data-video="' +
        esc(youtubeId(n.video.url)) + '">' +
        '<button type="button" class="vidbtn">' +
          '<span class="play">▶</span>' +
          '<span class="vt">' + esc(n.video.title) + '</span>' +
          '<span class="vs">' + esc(n.video.source) + '</span>' +
        '</button></div>' +
        '<p class="sub" style="margin-top:8px;font-size:12.5px;">Loads from YouTube only when you press play. ' +
        '<a href="' + esc(n.video.url) + '" target="_blank" rel="noopener" style="color:#1C3B2D;">Open on YouTube ↗</a></p>' +
        '</div>';
    }

    html += '<div class="sect"><h4>After this you should be able to</h4><ul>' +
      n.overview.objectives.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') +
      '</ul></div>';

    html += '<div class="sect"><h4>The work</h4><ol>' +
      n.steps.instructions.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') +
      '</ol></div>';

    html += '<div class="sect"><h4>' + (n.deliverable ? 'Deliverable' : 'What done means') + '</h4>' +
      '<div class="deliv">' +
        (n.deliverable ? '<div class="nm">' + esc(n.deliverable) + '</div>' : '') +
        '<p>' + esc(n.submission.description) + '</p>' +
      '</div></div>';

    if (n.dependencies.length || n.leadsTo.length) {
      html += '<div class="sect"><h4>Trajectory</h4>';
      if (n.dependencies.length) {
        html += '<p class="sub" style="font-size:12.5px;margin-bottom:8px;">Builds on — guidance, not a gate. ' +
          'You can do this node first.</p><div class="traj" style="margin-bottom:14px;">' +
          n.dependencies.map(pill).join('') + '</div>';
      }
      if (n.leadsTo.length) {
        html += '<p class="sub" style="font-size:12.5px;margin-bottom:8px;">Leads to</p>' +
          '<div class="traj">' + n.leadsTo.map(pill).join('') + '</div>';
      }
      html += '</div>';
    }

    if (n.resources.length) {
      html += '<div class="sect"><h4>Reading</h4><ul class="reslist">' +
        n.resources.map(function (r) {
          var ext = r.url.charAt(0) !== '/';
          return '<li><a href="' + esc(r.url) + '"' + linkAttrs(r.url) + '>' +
            '<span>' + esc(r.title) + '</span>' +
            '<span class="host">' + esc(host(r.url)) + (ext ? ' ↗' : '') + '</span></a></li>';
        }).join('') + '</ul></div>';
    }

    $('dBody').innerHTML = html;
    $('dBody').scrollTop = 0;
    renderDrawerFooter(n);

    $('drawer').classList.add('on');
    $('drawer').setAttribute('aria-hidden', 'false');
    $('scrim').classList.add('on');
    if (history.replaceState) history.replaceState(null, '', '#' + n.id);

    paintMap();
  }

  function pill(id) {
    var n = byId[id];
    if (!n) return '';
    return '<button type="button" data-id="' + esc(id) + '">' +
      (progress[id] === 'done' ? '✓ ' : '') + esc(n.title.name) + '</button>';
  }

  function renderDrawerFooter(n) {
    var done = progress[n.id] === 'done';
    /* With Homeroom answering, done means the deliverable exists. The only
       place to change that is the module's own form, so this page shows the
       state and sends you there rather than offering a second, weaker truth. */
    $('dDone').hidden = LIVE;
    $('dDone').textContent = done ? 'Mark not done' : 'Mark done';
    $('dDone').className = 'btn ' + (done ? 'btn-s' : 'btn-p');
    $('dHomeroom').href = n.link;
    if (EMBED) $('dHomeroom').target = '_top';
    $('dHomeroom').className = 'btn ' + (LIVE ? 'btn-p' : 'btn-s');
    $('dHomeroom').textContent = n.deliverable
      ? (done ? 'Review the ' + n.deliverable : 'Log the ' + n.deliverable)
      : 'Open in Homeroom';
    var flag = $('dLive');
    if (flag) {
      flag.hidden = !LIVE;
      flag.textContent = done ? 'done in Homeroom' : 'not logged yet';
    }
  }

  function closeDrawer() {
    state.active = null;
    $('drawer').classList.remove('on');
    $('drawer').setAttribute('aria-hidden', 'true');
    $('scrim').classList.remove('on');
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    paintMap();
  }

  /* ── view switching ──────────────────────────────────────────────────── */

  function setView(v) {
    state.view = v;
    writeStore(VIEW_KEY, v);
    ['map', 'tracks', 'calendar'].forEach(function (name) {
      var id = 'view' + name.charAt(0).toUpperCase() + name.slice(1);
      $(id).classList.toggle('hidden', name !== v);
    });
    var btns = document.querySelectorAll('.views button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', String(btns[i].dataset.view === v));
    }
    if (v === 'map' && !mapBuilt) { buildMap(); fitMap(); }
    render();
  }

  function render() {
    var shown = DATA.nodes.filter(matches).length;
    var note = $('countNote');
    if (note) {
      note.textContent = shown === DATA.nodes.length
        ? DATA.nodes.length + ' nodes'
        : shown + ' of ' + DATA.nodes.length + ' nodes';
    }
    if (state.view === 'map') paintMap();
    if (state.view === 'tracks') paintTracks();
    if (state.view === 'calendar') paintCalendar();
    $('empty').classList.toggle('hidden', shown > 0 || state.view === 'map');
  }

  /* ── Homeroom ────────────────────────────────────────────────────────── */

  /*
   * Ask Homeroom for the signed-in member's module progress. Only ever called
   * in embed mode, and every failure path is the same: leave localStorage
   * progress alone and say nothing. A member who is signed out sees the
   * standalone behaviour rather than an error.
   */
  function loadHomeroomProgress() {
    if (!EMBED || typeof fetch !== 'function') return;
    fetch('/homeroom/api/library', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (body) {
      if (!body || !body.ok || !body.modules || !body.modules.length) return;
      var live = {};
      body.modules.forEach(function (m) {
        /* Only slugs this tree actually draws. The manual and the tree share
           slugs by construction; anything unknown is a module added to the
           manual since the last build, and belongs in the tree, not here. */
        if (m && m.slug && byId[m.slug] && m.state) live[m.slug] = m.state;
      });
      LIVE = true;
      progress = live;
      paintProgress();
      render();
      if (state.active) renderDrawerFooter(byId[state.active]);
      var reset = $('reset');
      if (reset) reset.hidden = true;
    }).catch(function () { /* signed out, offline, or Homeroom is down */ });
  }

  /* ── boot ────────────────────────────────────────────────────────────── */

  function init() {
    if (!DATA) return;
    try { EMBED = new URLSearchParams(location.search).get('embed') === '1'; }
    catch (e) { EMBED = false; }
    DATA.nodes.forEach(function (n) { byId[n.id] = n; });
    progress = readStore(PROG_KEY, {}) || {};

    $('sNodes').textContent = DATA.meta.counts.nodes;
    $('sTracks').textContent = DATA.meta.counts.tracks;
    $('sVideos').textContent = DATA.meta.counts.videos;
    $('sRes').textContent = DATA.meta.counts.resources;
    $('sDeliv').textContent = DATA.meta.counts.deliverables;

    buildChips();
    paintProgress();

    document.querySelector('.views').addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (b) setView(b.dataset.view);
    });

    var qTimer;
    $('q').addEventListener('input', function (ev) {
      clearTimeout(qTimer);
      var v = ev.target.value.trim().toLowerCase();
      qTimer = setTimeout(function () { state.q = v; render(); }, 120);
    });

    $('reset').addEventListener('click', function () {
      if (LIVE) return; /* Homeroom owns it; there is nothing local to clear */
      progress = {};
      saveProgress();
    });

    /* Node buttons in the list and calendar views, and the trajectory pills. */
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-id]');
      if (b) { openNode(b.dataset.id); return; }
      var vb = ev.target.closest('.vidbtn');
      if (vb) {
        var box = vb.parentNode;
        var id = box.dataset.video;
        if (!id) return;
        box.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + id +
          '?autoplay=1&rel=0" title="Technique video" allow="accelerometer; autoplay; ' +
          'clipboard-write; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
      }
    });

    $('dDone').addEventListener('click', function () {
      if (!state.active || LIVE) return;
      if (progress[state.active] === 'done') delete progress[state.active];
      else progress[state.active] = 'done';
      saveProgress();
    });
    $('dClose').addEventListener('click', closeDrawer);
    $('scrim').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && state.active) closeDrawer();
    });

    wireMapControls();
    window.addEventListener('resize', function () {
      if (state.view === 'map' && mapBuilt) fitMap();
    });

    setView(readStore(VIEW_KEY, 'map') || 'map');

    var hash = location.hash.replace('#', '');
    if (hash && byId[hash]) openNode(hash);

    var nav = $('nav');
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });

    loadHomeroomProgress();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
