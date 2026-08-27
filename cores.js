/* Haus — Core Facility Finder
   Data: tools/core-facility-finder/data/core-facilities.json (metadata, curated)
         tools/core-facility-finder/data/contacts.json        (addresses, harvested)
   The contacts file is optional; it only exists once `cores.py verify` has run. */

const DATA_URL     = 'tools/core-facility-finder/data/core-facilities.json';
const CONTACTS_URL = 'tools/core-facility-finder/data/contacts.json';
const BRIEF_KEY    = 'haus.cores.brief';
const SHORT_KEY    = 'haus.cores.shortlist';

let DATA = null;
let CONTACTS = {};
let SHORTLIST = new Set();

/* ── storage (never let a locked-down browser break the page) ── */
function readStore(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
}

/* ── helpers ── */
const $  = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}

async function copy(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch (e) {
    // Clipboard API needs a secure context; fall back to a temporary textarea.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast(msg); }
    catch (e2) { toast('Could not copy — select the text manually'); }
    document.body.removeChild(ta);
  }
}

/* ── contact channels ── */
function channelsFor(fac) {
  const entry = CONTACTS[fac.id] || {};
  const chans = (entry.channels || []).slice();
  if (!chans.some((c) => c.kind === 'page' && c.value === fac.url)) {
    chans.push({ kind: 'page', label: 'facility page', value: fac.url });
  }
  return chans;
}
const emailsOf = (fac) => channelsFor(fac).filter((c) => c.kind === 'email').map((c) => c.value);

/* ── search, mirroring scripts/cores.py ── */
function expandQuery(query) {
  const syn = DATA.synonyms || {};
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const terms = [];
  if (syn[q]) terms.push(syn[q]);
  terms.push(query.trim());
  for (const tok of q.split(/[,;/]+/)) {
    const t = tok.trim();
    if (t && t !== q) terms.push(syn[t] || t);
  }
  const seen = new Set();
  return terms.filter((t) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function scoreOf(fac, terms, hasEmail) {
  if (!terms.length) return 1;
  const techs = fac.techniques.map((t) => t.toLowerCase());
  const name = (fac.facility + ' ' + fac.institution).toLowerCase();
  const all = (name + ' ' + fac.notes + ' ' + techs.join(' ')).toLowerCase();
  let total = 0;
  for (const term of terms) {
    const t = term.toLowerCase();
    if (techs.includes(t)) total += 10;
    else if (techs.some((x) => x.includes(t) || t.includes(x))) total += 6;
    else if (name.includes(t)) total += 4;
    else if (all.includes(t)) total += 2;
  }
  if (total && hasEmail) total += 2;
  return total;
}

function currentFilters() {
  return {
    q: $('q').value,
    continent: $('fContinent').value,
    country: $('fCountry').value,
    state: $('fState').value.trim().toLowerCase(),
    access: $('fAccess').value,
    emailOnly: $('fEmail').checked,
    shortOnly: $('fShort').checked,
  };
}

function matches() {
  const f = currentFilters();
  const terms = expandQuery(f.q);
  const hits = [];
  for (const fac of DATA.facilities) {
    if (f.continent && fac.continent !== f.continent && fac.group !== f.continent) continue;
    if (f.country && fac.country !== f.country) continue;
    if (f.access && fac.access !== f.access) continue;
    if (f.shortOnly && !SHORTLIST.has(fac.id)) continue;
    if (f.state) {
      const r = (fac.region || '').toLowerCase();
      const c = (fac.city || '').toLowerCase();
      if (!r.includes(f.state) && !c.includes(f.state)) continue;
    }
    const mails = emailsOf(fac);
    if (f.emailOnly && !mails.length) continue;
    const s = scoreOf(fac, terms, mails.length > 0);
    if (s) hits.push({ score: s, fac, terms });
  }
  hits.sort((a, b) => b.score - a.score
    || a.fac.institution.localeCompare(b.fac.institution)
    || a.fac.facility.localeCompare(b.fac.facility));
  return hits;
}

/* ── the enquiry draft (same wording as the CLI) ── */
function brief() {
  return {
    name: $('bName').value.trim(),
    org: $('bOrg').value.trim(),
    timeline: $('bTimeline').value.trim(),
    project: $('bProject').value.trim(),
  };
}

const ACCESS_PHRASE = {
  open: 'proposals from groups outside your institution',
  academic: 'academic users from other institutions',
  both: 'academic and commercial projects',
  commercial: 'new commercial clients',
};

function buildDraft(fac) {
  const b = brief();
  const need = $('q').value.trim() || 'core facility';
  const subject = need.charAt(0).toUpperCase() + need.slice(1) + ' enquiry — external project';
  const body =
`Dear ${fac.facility} team,

I am looking for ${need} capacity and found the ${fac.facility} at ${fac.institution}.

Brief summary of the work:
${b.project || '  [one or two sentences on the samples, the question and the scale]'}

What I would like to know:
  1. Do you take external ${ACCESS_PHRASE[fac.access]}, and what is the current lead time?
  2. What sample input and format do you need, and at what scale?
  3. What does a project of this size typically cost, and how is it invoiced?
  4. Is any of the analysis included, or is that a separate arrangement?
${b.timeline ? '\nTimeline: ' + b.timeline + '\n' : ''}
Happy to send a fuller protocol or jump on a call, whichever is easier.

Thank you,
${b.name || '[your name]'}${b.org ? '\n' + b.org : ''}`;
  return { subject, body };
}

const mailtoLink = (to, subject, body) =>
  'mailto:' + encodeURIComponent(to) +
  '?subject=' + encodeURIComponent(subject) +
  '&body=' + encodeURIComponent(body);

/* ── rendering ── */
const ACCENT = {
  'North America': '#1C3B2D', 'Europe': '#1A3D5C', 'Asia': '#B8924A',
  'Oceania': '#2A5C46', 'South America': '#9A7040', 'Africa': '#2A6090',
};
const ACCESS_LABEL = {
  open: 'Open · by proposal', academic: 'Academic', both: 'Academic + industry',
  commercial: 'Commercial',
};

function card(hit) {
  const { fac, terms } = hit;
  const mails = emailsOf(fac);
  const picked = SHORTLIST.has(fac.id);
  const termSet = new Set(terms.map((t) => t.toLowerCase()));
  const shown = fac.techniques.slice(0, 6);
  const extra = fac.techniques.length - shown.length;
  const tags = shown.map((t) =>
    `<span class="tag${termSet.has(t.toLowerCase()) ? ' hit' : ''}">${esc(t)}</span>`).join('')
    + (extra > 0 ? `<span class="tag">+${extra}</span>` : '');
  const loc = [fac.city, fac.region, fac.country].filter(Boolean).join(' · ');

  const primary = mails.length
    ? `<button class="btn btn-p" data-act="email" data-id="${fac.id}">Email ${esc(mails[0].split('@')[0])}@…</button>`
    : `<a class="btn btn-p" href="${esc(fac.url)}" target="_blank" rel="noopener noreferrer">Contact page ↗</a>`;

  return `<article class="card${picked ? ' picked' : ''}" style="--accent:${ACCENT[fac.continent] || '#1C3B2D'}" data-card="${fac.id}">
    <div class="c-top">
      <div>
        <h3 class="c-name">${esc(fac.facility)}</h3>
        <div class="c-inst">${esc(fac.institution)}</div>
      </div>
      <div class="c-id">${esc(fac.id)}</div>
    </div>
    <div class="c-loc">${esc(loc)}</div>
    <div class="tags">${tags}</div>
    <div class="badges">
      <span class="badge b-${fac.access}">${esc(ACCESS_LABEL[fac.access] || fac.access)}</span>
      <span class="badge ${mails.length ? 'b-email' : 'b-page'}">${mails.length ? 'Direct address' : 'Contact page only'}</span>
    </div>
    <p class="c-notes">${esc(fac.notes)}</p>
    <div class="actions">
      ${primary}
      <button class="btn btn-s" data-act="copy" data-id="${fac.id}">Copy draft</button>
      <button class="btn-i${picked ? ' on' : ''}" data-act="pick" data-id="${fac.id}"
              aria-pressed="${picked}">${picked ? '★ Shortlisted' : '☆ Shortlist'}</button>
    </div>
  </article>`;
}

function render() {
  const hits = matches();
  const grid = $('grid');
  grid.innerHTML = hits.map(card).join('');
  $('empty').style.display = hits.length ? 'none' : 'block';
  const total = DATA.facilities.length;
  $('count').textContent = hits.length === total
    ? `${total} facilities`
    : `${hits.length} of ${total} facilities`;
  renderShortlist();
}

function renderShortlist() {
  const bar = $('shortlist');
  $('slN').textContent = SHORTLIST.size;
  bar.classList.toggle('on', SHORTLIST.size > 0);
  document.body.style.paddingBottom = SHORTLIST.size > 0 ? '72px' : '0';
}

const byId = (id) => DATA.facilities.find((f) => f.id === id);

/* ── actions ── */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const fac = byId(btn.dataset.id);
  if (!fac) return;

  if (btn.dataset.act === 'email') {
    const { subject, body } = buildDraft(fac);
    window.location.href = mailtoLink(emailsOf(fac)[0], subject, body);
  } else if (btn.dataset.act === 'copy') {
    const { subject, body } = buildDraft(fac);
    copy(`Subject: ${subject}\n\n${body}`, 'Enquiry copied — paste it into their form');
  } else if (btn.dataset.act === 'pick') {
    SHORTLIST.has(fac.id) ? SHORTLIST.delete(fac.id) : SHORTLIST.add(fac.id);
    writeStore(SHORT_KEY, [...SHORTLIST]);
    render();
  }
});

function shortlisted() {
  return [...SHORTLIST].map(byId).filter(Boolean);
}

$('slCopyMail').onclick = () => {
  const addrs = shortlisted().flatMap(emailsOf);
  if (!addrs.length) {
    toast('No published addresses yet — run cores.py verify to harvest them');
    return;
  }
  copy(addrs.join(', '), `${addrs.length} address(es) copied`);
};

$('slCopyDrafts').onclick = () => {
  const facs = shortlisted();
  if (!facs.length) return;
  const text = facs.map((f) => {
    const { subject, body } = buildDraft(f);
    const to = emailsOf(f)[0] || f.url;
    return `── ${f.facility} — ${f.institution}\nTo: ${to}\nSubject: ${subject}\n\n${body}`;
  }).join('\n\n\n');
  copy(text, `${facs.length} draft(s) copied`);
};

$('slCsv').onclick = () => {
  const rows = [['id', 'facility', 'institution', 'city', 'region', 'country',
                 'group', 'access', 'techniques', 'email', 'url']];
  for (const f of shortlisted()) {
    rows.push([f.id, f.facility, f.institution, f.city, f.region, f.country,
               f.group || '', f.access, f.techniques.join('; '),
               emailsOf(f).join('; '), f.url]);
  }
  const csv = rows.map((r) => r.map((c) =>
    `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'core-facilities.csv';
  a.click();
  URL.revokeObjectURL(url);
};

$('slClear').onclick = () => {
  SHORTLIST.clear();
  writeStore(SHORT_KEY, []);
  render();
};

/* ── brief persistence ── */
let saveTimer;
function wireBrief() {
  const fields = ['bName', 'bOrg', 'bTimeline', 'bProject'];
  const saved = readStore(BRIEF_KEY, {});
  fields.forEach((id) => { if (saved[id]) $(id).value = saved[id]; });
  fields.forEach((id) => $(id).addEventListener('input', () => {
    const out = {};
    fields.forEach((f) => { out[f] = $(f).value; });
    writeStore(BRIEF_KEY, out);
    const flag = $('savedFlag');
    flag.classList.add('on');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => flag.classList.remove('on'), 1400);
  }));
}

/* ── boot ── */
async function boot() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`${DATA_URL} → ${res.status}`);
  DATA = await res.json();

  // Optional: only present after `cores.py verify` has been run and committed.
  try {
    const cr = await fetch(CONTACTS_URL);
    if (cr.ok) CONTACTS = (await cr.json()).contacts || {};
  } catch (e) { CONTACTS = {}; }

  SHORTLIST = new Set(readStore(SHORT_KEY, []));

  const withMail = DATA.facilities.filter((f) => emailsOf(f).length).length;
  $('statFac').textContent = DATA.facilities.length;
  $('statCountry').textContent = DATA.countries.length;
  $('statTech').textContent = DATA.techniques.length;
  $('statMail').textContent = withMail;
  if (withMail > 0) $('verifyNotice').style.display = 'none';

  $('techList').innerHTML = DATA.techniques
    .map((t) => `<option value="${esc(t)}">`).join('');
  const continents = [...new Set(DATA.facilities.map((f) => f.continent))].sort();
  const opts = (list) => list.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  $('fContinent').innerHTML += opts(continents);
  // Groups cut across continents — Mexico is in North America but nobody
  // searching Latin America means to exclude it.
  if ((DATA.groups || []).length) {
    $('fContinent').innerHTML +=
      `<optgroup label="Also">${opts(DATA.groups)}</optgroup>`;
  }
  $('fCountry').innerHTML += DATA.countries
    .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

  ['q', 'fState'].forEach((id) => $(id).addEventListener('input', render));
  ['fContinent', 'fCountry', 'fAccess', 'fEmail', 'fShort']
    .forEach((id) => $(id).addEventListener('change', render));

  wireBrief();
  render();
}

boot().catch((err) => {
  $('grid').innerHTML = '';
  $('empty').style.display = 'block';
  $('empty').textContent = 'Could not load the facility directory: ' + err.message;
});

/* nav shade on scroll, same behaviour as the other pages */
const nav = $('nav');
const shade = () => nav.classList.toggle('scrolled', window.scrollY > 40);
shade();
window.addEventListener('scroll', shade, { passive: true });
