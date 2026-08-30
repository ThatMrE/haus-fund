/* ─────────────────────────────────────────────────────────────────────────────
   visa.js — Haus Visa Desk · renderer
   ─────────────────────────────────────────────────────────────────────────────

   The letters, the jurisdictions and the compliance rules all live in
   visa-data.js. This file only draws them: form on the left, live letter on
   the right, compliance panel in between. Adding a country or a letter type
   should never require a change here.

   THREE THINGS THIS FILE IS RESPONSIBLE FOR
   -----------------------------------------
   1. Placeholders stay visible. Anything the data layer emits as [bracketed]
      is rendered highlighted, and prints with a rule under it. An unfinished
      letter has to look unfinished on paper, not just on screen.
   2. A "stop" finding disables export. Print, copy and download are all shut
      off while a letter would state something the route forbids.
   3. Participant identity never touches storage. Only the entity and signer
      block is remembered between sessions — see saveOrg() for why.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  var D = window.VISA_DATA;
  var $ = function (id) { return document.getElementById(id); };

  /* Only the parts of the form that are the same for every letter this office
     ever issues. Deliberately NOT the participant block: a passport number or
     a date of birth left in localStorage on a shared laptop is a liability,
     and re-typing it each time costs seconds. */
  var ORG_STORE_KEY = "haus.visa.org.v1";
  var ORG_STORE_FIELDS = ["orgId", "program", "orgRegNo", "orgAddress", "orgPhone",
                          "venue", "signerName", "signerTitle", "signerEmail", "signerPhone"];

  var state = {
    jurId: D.JURISDICTIONS[0].id,
    tplId: D.JURISDICTIONS[0].templates[0].id,
    orgId: D.ORGS[0].id,
    f: {}
  };

  /* ── small helpers ─────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  /* Escape first, then light up the placeholders. Order matters: doing it the
     other way round would let the span markup be escaped away. */
  function marked(s) {
    return esc(s).replace(/\[([^\]\n]+)\]/g, '<span class="ph">[$1]</span>');
  }
  function jur() {
    return D.JURISDICTIONS.filter(function (j) { return j.id === state.jurId; })[0];
  }
  function tpl() {
    var j = jur();
    return j.templates.filter(function (t) { return t.id === state.tplId; })[0] || j.templates[0];
  }
  function org() {
    return D.ORGS.filter(function (o) { return o.id === state.orgId; })[0] || D.ORGS[0];
  }
  function todayLong() {
    try {
      return new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
    } catch (e) { return new Date().toDateString(); }
  }

  /* The object handed to build() and to every check: the raw form values plus
     the derived entity facts the templates read. */
  function fields() {
    var o = org();
    var merged = {};
    for (var k in state.f) if (Object.prototype.hasOwnProperty.call(state.f, k)) merged[k] = state.f[k];
    merged.orgLegal = o.legalName;
    merged.orgRole = o.role;
    merged.orgEmail = o.email;
    merged.orgWeb = o.web;
    merged.city = jur().city;
    if (!merged.program) merged.program = D.PROGRAM.name + " — " + D.PROGRAM.cohort;
    if (!merged.costWho) merged.costWho = "visitor";
    if (!merged.letterDate) merged.letterDate = todayLong();
    return merged;
  }

  /* Every field on screen for the current selection, in form order. */
  function allFieldDefs() {
    return D.HOST_FIELDS.concat(D.APPLICANT_FIELDS).concat(tpl().fields || []);
  }

  /* ── form rendering ────────────────────────────────────────────────────── */
  function fieldHTML(def) {
    var val = state.f[def.key] == null ? "" : state.f[def.key];
    var missing = def.req && !String(val).trim();
    var req = def.req ? ' <span class="req">*</span>' : "";
    var h = '<div class="field' + (missing ? " missing" : "") + '" data-fk="' + esc(def.key) + '">';
    h += '<label for="fx-' + esc(def.key) + '">' + esc(def.label) + req + "</label>";
    if (def.type === "select") {
      h += '<select id="fx-' + esc(def.key) + '" data-k="' + esc(def.key) + '">';
      h += def.options.map(function (o) {
        return '<option value="' + esc(o) + '"' + (o === val ? " selected" : "") + ">" + esc(o) + "</option>";
      }).join("");
      h += "</select>";
    } else if (def.multiline) {
      h += '<textarea id="fx-' + esc(def.key) + '" data-k="' + esc(def.key) + '" rows="4" placeholder="' +
           esc(def.ph || "") + '">' + esc(val) + "</textarea>";
      h += '<div class="hint">One per line.</div>';
    } else {
      h += '<input type="text" id="fx-' + esc(def.key) + '" data-k="' + esc(def.key) +
           '" value="' + esc(val) + '" placeholder="' + esc(def.ph || "") + '">';
    }
    return h + "</div>";
  }

  function renderJurisdictions() {
    $("jgrid").innerHTML = D.JURISDICTIONS.map(function (j) {
      return '<button class="jbtn' + (j.id === state.jurId ? " on" : "") + '" data-j="' + esc(j.id) + '">' +
             '<div class="jn"><span aria-hidden="true">' + j.flag + "</span>" + esc(j.name) + "</div>" +
             '<div class="jc">' + esc(j.city) + "</div></button>";
    }).join("");
    $("jblurb").textContent = jur().blurb;
  }

  function renderTemplates() {
    $("tlist").innerHTML = jur().templates.map(function (t) {
      return '<button class="tbtn' + (t.id === state.tplId ? " on" : "") + '" data-t="' + esc(t.id) + '">' +
             '<div class="tbtn-top"><span class="tn">' + esc(t.name) + '</span>' +
             '<span class="tg">' + esc(t.tag) + "</span></div>" +
             '<div class="tnote">' + esc(t.note) + "</div></button>";
    }).join("");
  }

  function renderForm() {
    $("orgFields").innerHTML =
      '<div class="field"><label for="fx-org">Issuing entity <span class="req">*</span></label>' +
      '<select id="fx-org">' + D.ORGS.map(function (o) {
        return '<option value="' + esc(o.id) + '"' + (o.id === state.orgId ? " selected" : "") + ">" + esc(o.label) + "</option>";
      }).join("") + "</select>" +
      '<div class="hint">' + esc(org().legalName) + " — the legal name printed on the letterhead.</div></div>" +
      '<div class="field"><label for="fx-letterDate">Date of the letter</label>' +
      '<input type="text" id="fx-letterDate" data-k="letterDate" value="' +
      esc(state.f.letterDate || todayLong()) + '"></div>' +
      D.HOST_FIELDS.map(fieldHTML).join("");

    $("appFields").innerHTML = D.APPLICANT_FIELDS.map(fieldHTML).join("");

    $("costFields").innerHTML =
      '<div class="field"><label for="fx-costWho">Who bears the costs of the visit <span class="req">*</span></label>' +
      '<select id="fx-costWho" data-k="costWho">' + D.COST_OPTIONS.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === (state.f.costWho || "visitor") ? " selected" : "") +
               ">" + esc(c.label) + "</option>";
      }).join("") + "</select></div>" +
      fieldHTML({ key: "costDetail", label: "Detail on costs (optional)",
                  ph: "e.g. we provide accommodation and a travel stipend of US$1,500; the participant funds international flights",
                  multiline: true });

    var t = tpl();
    $("specificStep").innerHTML = "06 &middot; " + esc(t.name);
    $("specFields").innerHTML = (t.fields || []).map(fieldHTML).join("");
  }

  /* ── letter rendering ──────────────────────────────────────────────────── */
  function blockHTML(b) {
    if (b.h) return "<h4>" + marked(b.h) + "</h4>";
    if (b.list) return "<ul>" + b.list.map(function (li) { return "<li>" + marked(li) + "</li>"; }).join("") + "</ul>";
    if (b.kv) {
      return '<table class="kv"><tbody>' + b.kv.map(function (r) {
        return "<tr><td>" + marked(r[0]) + "</td><td>" + marked(r[1]) + "</td></tr>";
      }).join("") + "</tbody></table>";
    }
    if (b.p) {
      /* A blank line inside a paragraph means a real paragraph break — the
         acceptance block in the CPT letter relies on it. */
      return String(b.p).split(/\n\n+/).map(function (para) {
        return "<p>" + marked(para).replace(/\n/g, "<br>") + "</p>";
      }).join("");
    }
    return "";
  }

  function renderPaper() {
    var f = fields(), o = org(), t = tpl(), out;
    try {
      out = t.build(f);
    } catch (err) {
      $("paper").innerHTML = '<p style="color:#8C2F13"><b>This letter could not be built.</b> ' +
        esc(err && err.message) + " Report it with the jurisdiction and letter type.</p>";
      return null;
    }

    var head =
      '<div class="lh-name">' + esc(o.legalName) + "</div>" +
      '<div class="lh-meta">' + marked(f.orgAddress || "[registered address]") +
      " &middot; " + marked(f.orgPhone || "[telephone]") + " &middot; " + esc(o.web) + "</div>" +
      '<div class="lh-rule"></div>' +
      '<div class="l-date">' + esc(f.letterDate) + "</div>" +
      '<div class="l-addr">' + out.addressee.map(function (l) { return marked(l); }).join("<br>") + "</div>" +
      '<div class="l-re">Re: ' + marked(out.subject) + "</div>";

    var body = out.blocks.map(blockHTML).join("");

    var sig =
      '<div class="sig"><div>Yours faithfully,</div><div class="rule"></div>' +
      '<div class="nm">' + marked(f.signerName || "[signer name]") + "</div>" +
      "<div>" + marked(f.signerTitle || "[signer title]") + ", " + esc(o.legalName) + "</div>" +
      "<div>" + marked(f.signerEmail || "[signer email]") + " &middot; " +
      marked(f.signerPhone || "[signer direct telephone]") + "</div></div>" +
      '<div class="l-foot">' + esc(o.legalName) + " &middot; " + esc(o.regLabel) + " " +
      marked(f.orgRegNo || "[registration number]") + " &middot; " +
      marked(f.orgAddress || "[registered address]") + "</div>" +
      '<div class="l-legal">Issued by ' + esc(o.legalName) + " in support of an immigration application. " +
      "This letter states facts within the issuer's knowledge and is not legal advice to the applicant.</div>";

    $("paper").innerHTML = head + body + sig;
    return out;
  }

  /* ── compliance ────────────────────────────────────────────────────────── */
  function runChecks(f) {
    var found = [];
    var t = tpl();

    /* Missing required fields surface as one finding, not twenty. They are a
       warning rather than a stop: an operator may legitimately want to print
       a draft, and the highlighted placeholders already make it obvious. */
    var missing = allFieldDefs().filter(function (d) {
      return d.req && !String(f[d.key] == null ? "" : f[d.key]).trim();
    });
    if (missing.length) {
      found.push({
        level: "warn",
        msg: "<b>" + missing.length + " required field" + (missing.length === 1 ? "" : "s") +
             " still empty.</b> They print as highlighted placeholders: " +
             missing.map(function (d) { return esc(d.label.toLowerCase()); }).join("; ") + "."
      });
    }

    D.GLOBAL_CHECKS.concat(t.checks || []).forEach(function (c) {
      var r;
      try { r = c(f); } catch (err) { r = { level: "warn", msg: "A compliance check failed to run: " + esc(err && err.message) }; }
      if (r && r.msg) found.push(r);
    });

    var order = { stop: 0, warn: 1, note: 2 };
    found.sort(function (a, b) { return order[a.level] - order[b.level]; });
    return found;
  }

  function renderChecks(f) {
    var found = runChecks(f);
    var stops = found.filter(function (x) { return x.level === "stop"; }).length;
    var warns = found.filter(function (x) { return x.level === "warn"; }).length;

    var v = $("verdict");
    v.className = "verdict " + (stops ? "v-stop" : warns ? "v-warn" : "v-ok");
    v.textContent = stops
      ? stops + " blocking " + (stops === 1 ? "issue" : "issues")
      : warns ? warns + " to resolve" : "Clear to issue";

    $("checkList").innerHTML = found.length
      ? found.map(function (x) {
          return '<div class="chk"><span class="dot d-' + x.level + '"></span><span>' + x.msg + "</span></div>";
        }).join("")
      : '<div class="chk-none">No issues found for this letter type. That is not a legal opinion — ' +
        'it means the automated checks in this tool found nothing, and counsel still has to review it.</div>';

    /* A stop is a hard gate. The letter stays on screen so the operator can see
       what is wrong, but it cannot leave the page. */
    ["bPrint", "bCopy", "bDoc"].forEach(function (id) { $(id).disabled = stops > 0; });
    $("bPrint").textContent = stops ? "Blocked — resolve the issues above" : "Print / save as PDF";
  }

  /* ── guidance ──────────────────────────────────────────────────────────── */
  function renderGuide() {
    var j = jur(), g = j.guidance;
    $("guideTitle").textContent = j.flag + "  " + j.name + " — what the authorities require";
    function section(title, items) {
      if (!items || !items.length) return "";
      return "<h4>" + esc(title) + "</h4><ul>" + items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul>";
    }
    $("guideBody").innerHTML =
      section("Routes", g.routes) +
      section("What the host has to do", g.hostDuties) +
      section("What the letter must contain", g.mustInclude) +
      section("Where these applications fail", g.watchOuts) +
      "<h4>Official sources</h4><div class=\"srcs\">" +
      (g.sources || []).map(function (s) {
        return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + " &#8599;</a>";
      }).join("") + "</div>";
  }

  /* ── plain text, for copy and for Word ─────────────────────────────────── */
  function plainText() {
    var f = fields(), o = org(), out;
    try { out = tpl().build(f); } catch (e) { return ""; }
    var L = [];
    L.push(o.legalName.toUpperCase());
    L.push([f.orgAddress || "[registered address]", f.orgPhone || "[telephone]", o.web].join(" · "));
    L.push("", f.letterDate, "");
    out.addressee.forEach(function (a) { L.push(a); });
    L.push("", "Re: " + out.subject, "");
    out.blocks.forEach(function (b) {
      if (b.h) { L.push(b.h.toUpperCase(), ""); }
      else if (b.list) { b.list.forEach(function (li) { L.push("  - " + li); }); L.push(""); }
      else if (b.kv) { b.kv.forEach(function (r) { L.push("  " + r[0] + ": " + r[1]); }); L.push(""); }
      else if (b.p) { L.push(b.p, ""); }
    });
    L.push("Yours faithfully,", "", "", f.signerName || "[signer name]");
    L.push((f.signerTitle || "[signer title]") + ", " + o.legalName);
    L.push((f.signerEmail || "[signer email]") + " · " + (f.signerPhone || "[signer direct telephone]"));
    L.push("", o.legalName + " · " + o.regLabel + " " + (f.orgRegNo || "[registration number]") +
              " · " + (f.orgAddress || "[registered address]"));
    return L.join("\n");
  }

  function fileStem() {
    var f = fields();
    var who = (f.fullName || "unnamed").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return (jur().id + "-" + tpl().id + "-" + who).toLowerCase();
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("on"); }, 2200);
  }

  /* ── persistence: entity and signer only ───────────────────────────────── */
  function saveOrg() {
    try {
      var keep = { orgId: state.orgId };
      ORG_STORE_FIELDS.forEach(function (k) { if (k !== "orgId" && state.f[k]) keep[k] = state.f[k]; });
      localStorage.setItem(ORG_STORE_KEY, JSON.stringify(keep));
    } catch (e) { /* private browsing, storage disabled — not worth surfacing */ }
  }
  function loadOrg() {
    try {
      var raw = localStorage.getItem(ORG_STORE_KEY);
      if (!raw) return;
      var keep = JSON.parse(raw);
      if (keep.orgId && D.ORGS.some(function (o) { return o.id === keep.orgId; })) state.orgId = keep.orgId;
      ORG_STORE_FIELDS.forEach(function (k) { if (k !== "orgId" && keep[k]) state.f[k] = keep[k]; });
    } catch (e) { /* corrupt or unavailable — start fresh */ }
  }

  /* ── wiring ────────────────────────────────────────────────────────────── */
  function refreshLetter() {
    var f = fields();
    renderPaper();
    renderChecks(f);
  }

  function refreshAll() {
    renderJurisdictions();
    renderTemplates();
    renderForm();
    renderGuide();
    refreshLetter();
  }

  /* One delegated listener per event type, so re-rendering the form never
     leaves orphaned handlers behind. */
  document.addEventListener("input", function (e) {
    var k = e.target.getAttribute && e.target.getAttribute("data-k");
    if (!k) return;
    state.f[k] = e.target.value;
    if (ORG_STORE_FIELDS.indexOf(k) !== -1) saveOrg();
    /* Only the field's own required-state can change on keystroke, so repaint
       that one wrapper rather than the whole form — repainting would steal
       focus mid-word. */
    var wrap = e.target.closest(".field");
    if (wrap) {
      var def = allFieldDefs().filter(function (d) { return d.key === k; })[0];
      if (def && def.req) wrap.classList.toggle("missing", !String(e.target.value).trim());
    }
    refreshLetter();
  });

  document.addEventListener("change", function (e) {
    if (e.target.id === "fx-org") {
      state.orgId = e.target.value;
      saveOrg();
      renderForm();
      refreshLetter();
    }
  });

  document.addEventListener("click", function (e) {
    var jb = e.target.closest && e.target.closest(".jbtn");
    if (jb) {
      state.jurId = jb.getAttribute("data-j");
      state.tplId = jur().templates[0].id;
      refreshAll();
      return;
    }
    var tb = e.target.closest && e.target.closest(".tbtn");
    if (tb) {
      state.tplId = tb.getAttribute("data-t");
      renderTemplates();
      renderForm();
      refreshLetter();
      return;
    }
  });

  $("bPrint").addEventListener("click", function () {
    if (this.disabled) return;
    window.print();
  });

  $("bCopy").addEventListener("click", function () {
    if (this.disabled) return;
    var txt = plainText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { toast("Letter copied"); },
                                              function () { fallbackCopy(txt); });
    } else { fallbackCopy(txt); }
  });

  function fallbackCopy(txt) {
    var ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("Letter copied"); }
    catch (e) { toast("Copy failed — select the letter and copy it manually"); }
    ta.remove();
  }

  /* Word opens an HTML payload served with the msword type and keeps the
     structure, which matters here: the particulars table is the part an
     officer reads first, and a plain-text export would flatten it. */
  $("bDoc").addEventListener("click", function () {
    if (this.disabled) return;
    var paper = $("paper").innerHTML;
    var html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
      'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      "<head><meta charset=\"utf-8\"><title>" + esc(tpl().name) + "</title><style>" +
      "body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;color:#1a1a1a;}" +
      ".lh-name{font-size:20pt;font-weight:bold;text-transform:uppercase;}" +
      ".lh-meta{font-size:8pt;color:#666;letter-spacing:1px;}" +
      ".lh-rule{border-bottom:2px solid #1C3B2D;margin:10px 0 20px;}" +
      ".l-re{font-size:9pt;font-weight:bold;color:#1C3B2D;text-transform:uppercase;margin-bottom:14px;}" +
      "h4{font-size:11pt;color:#1C3B2D;text-transform:uppercase;margin:16px 0 6px;}" +
      "table.kv{border-collapse:collapse;width:100%;font-size:10pt;margin-bottom:14px;}" +
      "table.kv td{border:1px solid #ccc;padding:5px 8px;}" +
      "table.kv td:first-child{width:38%;background:#f7f7f4;color:#555;}" +
      ".ph{border-bottom:1px solid #000;}" +
      ".sig .rule{width:250px;border-bottom:1px solid #000;height:42px;}" +
      ".sig .nm{font-weight:bold;}" +
      ".l-foot,.l-legal{font-size:7.5pt;color:#666;border-top:1px solid #ccc;margin-top:24px;padding-top:6px;}" +
      "</style></head><body>" + paper + "</body></html>";
    download(new Blob(["﻿" + html], { type: "application/msword" }), fileStem() + ".doc");
    toast("Downloaded — open it in Word and sign it");
  });

  $("bReset").addEventListener("click", function () {
    if (!window.confirm("Clear every field, including the saved entity and signer details?")) return;
    state.f = {};
    try { localStorage.removeItem(ORG_STORE_KEY); } catch (e) {}
    renderForm();
    refreshLetter();
    toast("Form cleared");
  });

  window.addEventListener("scroll", function () {
    document.getElementById("nav").classList.toggle("scrolled", window.scrollY > 40);
  }, { passive: true });

  /* ── boot ──────────────────────────────────────────────────────────────── */
  loadOrg();
  $("sJur").textContent = D.JURISDICTIONS.length;
  $("sTpl").textContent = D.JURISDICTIONS.reduce(function (n, j) { return n + j.templates.length; }, 0);
  $("sCohort").textContent = D.PROGRAM.start.replace(/,? \d{4}$/, "") + " – " + D.PROGRAM.end.replace(/,? \d{4}$/, "");
  $("sDays").textContent = D.PROGRAM.days;
  refreshAll();
})();
