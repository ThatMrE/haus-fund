/* ─────────────────────────────────────────────────────────────────────────────
   visa-data.js — Haus Visa Desk · data layer
   ─────────────────────────────────────────────────────────────────────────────

   THIS IS THE FILE YOU EDIT. visa.js is the renderer and rarely needs touching.

   Everything the generator knows — the programme facts, the issuing entities,
   the jurisdictions in the dropdown, the letter templates, and the compliance
   checks — lives here as plain data. Adding a country or a letter type is a
   data edit, not a code change. See tools/visa-letter-generator/README.md.

   TWO RULES THAT MUST SURVIVE EVERY EDIT
   ---------------------------------------
   1. NEVER INVENT A FACT. A template may only state something the operator
      typed in. Anything unfilled renders as a visible [bracketed placeholder]
      so an incomplete letter is obviously incomplete. These letters go to
      government adjudicators; a template that quietly fills in a plausible
      guess turns a drafting convenience into a false statement.
   2. NEVER PROMISE WHAT THE ROUTE FORBIDS. A B-1 letter must not offer wages.
      A visitor letter must not offer employment. The `checks` array on each
      template exists to catch exactly this, and it is not decoration — a
      letter that fails a `stop` check cannot be exported.

   Nothing here is legal advice, and nothing here substitutes for immigration
   counsel in the destination country.
   ───────────────────────────────────────────────────────────────────────── */

var VISA_DATA = (function () {
  "use strict";

  /* ── programme facts ──────────────────────────────────────────────────────
     Update once per cohort. Everything downstream reads from here. */
  var PROGRAM = {
    name: "Biopunk House Accelerator Program",
    cohort: "Cohort 3",
    start: "September 15, 2026",
    end: "December 12, 2026",
    days: null,             // derived below from start/end; drives the 90-day ceilings
    weeks: 12,
    city: "San Francisco, California",
    summary:
      "a live-in accelerator for early-stage biotechnology founders, " +
      "combining shared laboratory access, structured mentorship, and a residential cohort"
  };

  /* Programme policy: no cohort may run longer than this.
     89 is not arbitrary. Three separate regimes cap a stay at 90 days — US Visa
     Waiver Program admission, Schengen short stays, and Japanese Temporary
     Visitor status — so a cohort of 89 days lets a participant complete the
     whole programme on the lightest available route in all three. Raise it past
     90 and all three break at once, for every participant, silently. */
  var MAX_COHORT_DAYS = 89;

  /* ── issuing entities ─────────────────────────────────────────────────────
     legalName is what goes on the letter. Consular officers check the letterhead
     entity against the registry, so the trading name alone is not enough.
     regLabel/regNo are deliberately blank: fill them in from the actual
     incorporation documents rather than shipping a guess. */
  var ORGS = [
    {
      id: "biopunk-ventures",
      label: "Biopunk Ventures — accelerator operator",
      legalName: "Biopunk Ventures LLC",
      role: "the operating company that runs the Biopunk House Accelerator Program",
      regLabel: "State registration number",
      regNo: "",
      address: "",
      web: "haus.fund",
      email: "elliot@haus.fund"
    },
    {
      id: "haus-ventures-fund",
      label: "Haus Ventures Fund — investment vehicle",
      legalName: "Haus Ventures Fund I, L.P.",
      role: "the venture fund that invests in companies built inside the programme",
      regLabel: "State registration number",
      regNo: "",
      address: "",
      web: "haus.fund",
      email: "elliot@haus.fund"
    },
    {
      id: "biopunk-lab",
      label: "Biopunk Lab — shared research facility",
      legalName: "Biopunk Lab",
      role: "the shared wet-laboratory facility used by programme participants",
      regLabel: "State registration number",
      regNo: "",
      address: "",
      web: "haus.fund",
      email: "elliot@haus.fund"
    }
  ];

  /* ── helpers ──────────────────────────────────────────────────────────────
     V() is the whole anti-fabrication policy in three lines: an empty field
     becomes a bracketed placeholder that survives into the printed letter. */
  function V(value, placeholder) {
    var s = (value == null ? "" : String(value)).trim();
    return s || "[" + placeholder + "]";
  }
  function has(value) {
    return !!(value != null && String(value).trim());
  }
  function FIRST(name) {
    return (name || "").trim().split(/\s+/)[0] || "";
  }
  function LIST(text, fallback) {
    var arr = (text || "")
      .split("\n")
      .map(function (s) { return s.replace(/^[•\-\*\s]+/, "").trim(); })
      .filter(Boolean);
    return arr.length ? arr : fallback;
  }
  /* Inclusive day count between two free-text dates. Returns null when either
     side will not parse — the caller must treat null as "unknown", never 0. */
  function spanDays(a, b) {
    var d1 = Date.parse(a), d2 = Date.parse(b);
    if (isNaN(d1) || isNaN(d2)) return null;
    return Math.round((d2 - d1) / 86400000) + 1;
  }

  /* Derived, never hand-written: change the cohort dates above and every
     ceiling check and every piece of guidance prose follows automatically. */
  PROGRAM.days = spanDays(PROGRAM.start, PROGRAM.end);

  /* Editing PROGRAM is the one change most likely to break this tool, and it
     would break it quietly: every letter would still generate, and every one
     would describe a stay the participant's route does not permit. Say so
     loudly instead. */
  if (PROGRAM.days !== null && PROGRAM.days > MAX_COHORT_DAYS && typeof console !== "undefined") {
    console.error("visa-data: " + PROGRAM.cohort + " runs " + PROGRAM.days +
      " days, over the " + MAX_COHORT_DAYS + "-day cohort maximum. Participants " +
      "would exceed the 90-day ceilings on the US Visa Waiver Program, Schengen " +
      "short stays and Japanese Temporary Visitor status. Shorten PROGRAM.end.");
  }

  /* ── field definitions ────────────────────────────────────────────────────
     Grouped so the form can render them in sections. `req: true` means the
     letter is not exportable without it. */
  var APPLICANT_FIELDS = [
    { key: "fullName",   label: "Full name (exactly as in passport)", ph: "e.g. Ria Arora", req: true },
    { key: "dob",        label: "Date of birth", ph: "e.g. 14 March 1998", req: true },
    { key: "nationality",label: "Nationality / citizenship", ph: "e.g. India", req: true },
    { key: "passportNo", label: "Passport number", ph: "e.g. Z1234567", req: true },
    { key: "role",       label: "Role in the programme", ph: "e.g. Founder, Cohort 3", req: true },
    { key: "startDate",  label: "Start date", ph: PROGRAM.start, req: true },
    { key: "endDate",    label: "End date", ph: PROGRAM.end, req: true },
    { key: "email",      label: "Participant email", ph: "e.g. ria@example.com" }
  ];

  var HOST_FIELDS = [
    { key: "program",    label: "Programme name as it should read on the letter", ph: PROGRAM.name + " — " + PROGRAM.cohort, req: true },
    { key: "orgRegNo",   label: "Entity registration number", ph: "company / entity number on the register", req: true },
    { key: "orgAddress", label: "Registered address of the issuing entity", ph: "street, city, state, postcode, country", req: true },
    { key: "orgPhone",   label: "Entity telephone (with country code)", ph: "e.g. +1 415 555 0134", req: true },
    { key: "venue",      label: "Address where activities take place", ph: "street, city, state, postcode, country", req: true },
    { key: "signerName", label: "Signer full name", ph: "e.g. Elliot ___", req: true },
    { key: "signerTitle",label: "Signer title", ph: "e.g. Director", req: true },
    { key: "signerEmail",label: "Signer email", ph: "e.g. elliot@haus.fund", req: true },
    { key: "signerPhone",label: "Signer direct telephone", ph: "e.g. +1 415 555 0134", req: true }
  ];

  var COST_OPTIONS = [
    { id: "visitor", label: "The participant bears all costs" },
    { id: "host",    label: "We bear all costs (travel, accommodation, living)" },
    { id: "shared",  label: "Costs are shared — specify below" }
  ];

  /* ── reusable letter blocks ───────────────────────────────────────────────
     A letter is an array of blocks. visa.js knows four kinds:
       { p:  "paragraph" }
       { list: ["item", ...] }
       { h:  "SECTION HEADING" }
       { kv: [["label","value"], ...] }   → a particulars table
     Consular and immigration officers read the table first; it is what gets
     transcribed onto the file. Every template includes one. */

  function particulars(f, extraRows) {
    var rows = [
      ["Full name (as in passport)", V(f.fullName, "full name")],
      ["Date of birth", V(f.dob, "date of birth")],
      ["Nationality", V(f.nationality, "nationality")],
      ["Passport number", V(f.passportNo, "passport number")],
      ["Role in programme", V(f.role, "role")],
      ["Programme", V(f.program, "programme name")],
      ["Dates of participation", V(f.startDate, "start date") + " to " + V(f.endDate, "end date")],
      ["Location of activities", V(f.venue, "address where activities take place")]
    ];
    return { kv: rows.concat(extraRows || []) };
  }

  /* Who pays. Stated explicitly because most posts ask for it in terms, and an
     ambiguous answer reads as an evasion. */
  function costsBlock(f, currencyNote) {
    var detail = has(f.costDetail) ? " " + String(f.costDetail).trim() : "";
    if (f.costWho === "host") {
      return {
        p: "All costs associated with this visit — international travel, accommodation, " +
           "local transport, and day-to-day living expenses for the period stated above — " +
           "will be borne by " + V(f.orgLegal, "issuing entity") + "." + detail +
           (currencyNote ? " " + currencyNote : "")
      };
    }
    if (f.costWho === "shared") {
      return {
        p: "Costs for this visit are shared between " + V(f.orgLegal, "issuing entity") +
           " and the participant as follows:" + (detail || " [set out precisely which costs each party bears].") +
           (currencyNote ? " " + currencyNote : "")
      };
    }
    return {
      p: "All costs associated with this visit — international travel, accommodation, " +
         "local transport, and day-to-day living expenses — are borne by the participant, " +
         "who has confirmed to us that they hold sufficient funds for the whole of the " +
         "intended stay." + detail
    };
  }

  /* The signer is making representations to a government. Say so on the page. */
  function attestation() {
    return {
      p: "I confirm that the statements made in this letter are true, complete and " +
         "correct to the best of my knowledge and belief, and I am authorised to make " +
         "them on behalf of the issuing entity. I am available at the direct telephone " +
         "number and email address below to verify any detail of this letter."
    };
  }

  function enclosures(items) {
    return [{ h: "Enclosures" }, { list: items }];
  }

  /* ── shared compliance checks ─────────────────────────────────────────────
     Levels: "stop" blocks export, "warn" needs a deliberate override,
     "note" is informational. Each returns null when it has nothing to say. */
  var GLOBAL_CHECKS = [
    function datesOrdered(f) {
      var n = spanDays(f.startDate, f.endDate);
      if (n !== null && n <= 0) {
        return { level: "stop", msg: "The end date is on or before the start date. Fix the dates before issuing." };
      }
      return null;
    },
    function identityComplete(f) {
      if (!has(f.passportNo) || !has(f.dob)) {
        return {
          level: "warn",
          msg: "Passport number and date of birth are missing. Adjudicators match a support letter to the applicant on these two fields; a letter without them is routinely disregarded."
        };
      }
      return null;
    },
    function withinCohortPolicy(f) {
      var n = spanDays(f.startDate, f.endDate);
      if (n !== null && n > MAX_COHORT_DAYS) {
        return {
          level: "warn",
          msg: "These dates cover " + n + " days. Programme policy caps a cohort at " +
               MAX_COHORT_DAYS + " days precisely so participants stay inside the 90-day " +
               "ceilings on the US Visa Waiver Program, Schengen short stays and Japanese " +
               "Temporary Visitor status. Confirm this letter describes something other than " +
               "a standard cohort before issuing it."
        };
      }
      return null;
    },
    function nameMatchesPassport(f) {
      if (has(f.fullName) && /[a-z]/.test(f.fullName) === false) {
        return { level: "note", msg: "The name is all capitals. Reproduce it exactly as it appears in the passport's machine-readable zone, including the order of given and family names." };
      }
      return null;
    }
  ];

  /* Used by every route that runs against a 90-day ceiling. The cohort is set
     at MAX_COHORT_DAYS so it clears that ceiling — but by a single day, and the
     travel days are what eat the margin. Both the day of arrival and the day of
     departure count as days of presence in all three regimes, which is the part
     participants get wrong. */
  function ninetyDayMargin(f) {
    var n = spanDays(f.startDate, f.endDate);
    if (n === null || n > 90 || n < 45) return null;
    var slack = 90 - n;
    return {
      level: slack <= 2 ? "warn" : "note",
      msg: "These dates occupy " + n + " of the 90 days permitted, leaving " + slack +
           " day" + (slack === 1 ? "" : "s") + " of margin. The day of arrival and the day " +
           "of departure both count as days of presence, so a flight moved even slightly can " +
           "put the participant over. Confirm the actual travel dates, not just the programme dates."
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════
     UNITED STATES — San Francisco
     The programme is deliberately set at 89 days so that it clears the 90-day
     ceiling of the Visa Waiver Program. That margin is one day wide, and the
     travel days are what consume it — see ninetyDayMargin above.
     ═══════════════════════════════════════════════════════════════════════ */

  var US = {
    id: "us",
    name: "United States",
    city: "San Francisco, California",
    flag: "🇺🇸",
    node: "Haus House · San Francisco",
    blurb: "Home cohort. Twelve weeks, live-in, shared wet lab.",

    guidance: {
      routes: [
        "<b>B-1 business visitor</b> — meetings, conferences, negotiations and <i>independent research</i> are permitted. Productive labour and any US-source salary are not.",
        "<b>Visa Waiver Program / ESTA</b> — the same permitted activities as B-1, but admission is capped at 90 days and cannot be extended.",
        "<b>J-1 exchange visitor</b> — a structured, supervised training placement arranged through a designated sponsor organisation on Form DS-7002.",
        "<b>F-1 CPT</b> — enrolled students, authorised in advance by their school's DSO and recorded on the Form I-20.",
        "<b>F-1 OPT / STEM OPT</b> — recent graduates, in work directly related to the degree; STEM extensions require a Form I-983 training plan.",
        "<b>O-1A</b> — extraordinary ability; our letter is one piece of evidence in an attorney-filed petition.",
        "<b>International Entrepreneur Parole</b> — founders with a qualifying investment and a central role in a start-up of substantial potential."
      ],
      mustInclude: [
        "The full legal name and registered address of the issuing entity, not just the trading name.",
        "The applicant's name exactly as it appears in the passport, plus date of birth and passport number.",
        "Precise start and end dates and the physical address where activities take place.",
        "An unambiguous statement of whether the participant is being employed and paid, and by whom.",
        "A direct telephone number and email for the signer, so the post can verify the letter."
      ],
      watchOuts: [
        "<b>" + PROGRAM.days + " days against a 90-day ceiling.</b> " + PROGRAM.cohort + " runs " + PROGRAM.start + " to " + PROGRAM.end + " — " + PROGRAM.days + " days, set deliberately inside the 90-day limit on Visa Waiver Program admission so a participant can complete a full cohort without needing a visa that permits longer. The margin is " + (90 - PROGRAM.days) + " day" + ((90 - PROGRAM.days) === 1 ? "" : "s") + ", and both the arrival and departure days count against it. Arriving early, leaving late, or adding any side trip puts the participant over, and Visa Waiver admission cannot be extended once granted.",
        "<b>Bench work is productive labour.</b> Running experiments in the shared lab is not \"independent research\" in the loose sense a founder might mean it. Where a participant will do hands-on work that produces value for a US entity, the visitor routes are the wrong instrument.",
        "<b>Reimbursement is not salary.</b> A US source may cover or reimburse a B-1 visitor's expenses. It may not pay them for services. Letters that blur the two invite a finding of unauthorised employment.",
        "<b>Unpaid does not mean unregulated.</b> An unpaid internship at a for-profit entity has to satisfy the primary-beneficiary test under the Fair Labor Standards Act, independently of immigration status."
      ],
      sources: [
        { label: "9 FAM 402.2 — B visas (US Dept. of State)", url: "https://fam.state.gov/fam/09fam/09fam040202.html" },
        { label: "International Entrepreneur Rule (USCIS)", url: "https://www.uscis.gov/working-in-the-united-states/international-entrepreneur-rule" },
        { label: "B-1 visas and allowable uses — fact sheet", url: "https://kr.usembassy.gov/b1-visas-and-allowable-uses-fact-sheet/" }
      ]
    },

    templates: [
      /* ── B-1 / ESTA ────────────────────────────────────────────────────── */
      {
        id: "b1",
        name: "B-1 Business Visitor Invitation",
        tag: "B-1 · VWP",
        note: "Founders attending for meetings, demo day and independent research. No US employment, no US-source wages.",
        addressee: function () {
          return ["The Consular Officer", "Embassy or Consulate of the United States of America"];
        },
        fields: [
          { key: "post", label: "US embassy or consulate applied to", ph: "e.g. U.S. Consulate General, Mumbai", req: true },
          { key: "company", label: "Participant's company and country", ph: "e.g. Helix Therapeutics GmbH, Berlin, Germany", req: true },
          { key: "activities", label: "Activities during the visit (one per line)", ph: "Attend cohort programming and mentor sessions\nNegotiate partnership terms with US collaborators\nPresent at Demo Day on December 10, 2026\nUndertake independent research and literature review", multiline: true, req: true },
          { key: "entryRoute", label: "Intended route", type: "select", options: ["B-1 visa", "Visa Waiver Program (ESTA)"], req: true },
          { key: "labWork", label: "Will they do hands-on laboratory work for us?", type: "select", options: ["No — observation and independent research only", "Yes — hands-on bench work"], req: true },
          { key: "ties", label: "Ties to their home country", ph: "e.g. continues to direct Helix Therapeutics GmbH in Berlin, where the company and their family home are based", req: true }
        ],
        build: function (f) {
          var acts = LIST(f.activities, ["[Activity 1]", "[Activity 2]", "[Activity 3]"]);
          var blocks = [
            { p: "I write on behalf of " + V(f.orgLegal, "issuing entity") + ", " + V(f.orgRole, "role of the entity") +
                 ", to invite " + V(f.fullName, "full name") + ", a citizen of " + V(f.nationality, "nationality") +
                 " and " + V(f.role, "role") + " of " + V(f.company, "company and country") +
                 ", to visit us in " + PROGRAM.city + " from " + V(f.startDate, "start date") +
                 " to " + V(f.endDate, "end date") + "." },
            { p: "The " + V(f.program, "programme name") + " is " + PROGRAM.summary + "." },
            particulars(f, [["Intended route", V(f.entryRoute, "B-1 visa or ESTA")]]),
            { h: "Purpose of the visit" },
            { p: "During the visit " + V(f.fullName, "full name") + " will:" },
            { list: acts },
            { h: "Status of the visitor" },
            { p: "These are activities of a business visitor. " + V(f.fullName, "full name") +
                 " will not be employed by " + V(f.orgLegal, "issuing entity") +
                 " or by any other United States entity, will not receive any salary, wage or other " +
                 "remuneration from a United States source for services rendered, will not perform " +
                 "productive labour in the United States, and will not take part in the management " +
                 "or day-to-day operation of any United States business." },
            (f.costWho === "host" || f.costWho === "shared")
              ? { p: "Where this letter records that we meet costs, those payments are reimbursement of " +
                     "travel and living expenses only. They are not remuneration for services and no " +
                     "part of them is consideration for work performed in the United States." }
              : null,
            costsBlock(f),
            { p: V(f.fullName, "full name") + " maintains a residence and professional commitments outside " +
                 "the United States — " + V(f.ties, "ties to home country") + " — and will depart the " +
                 "United States at the conclusion of the visit." },
            attestation()
          ].filter(Boolean);
          return {
            subject: "Invitation to visit — " + V(f.fullName, "full name") + " — " + V(f.program, "programme name"),
            addressee: has(f.post)
              ? ["The Consular Officer", String(f.post).trim()]
              : ["The Consular Officer", "Embassy or Consulate of the United States of America"],
            blocks: blocks.concat(enclosures([
              "Programme description and cohort dates",
              "Certificate of formation / registration of the issuing entity",
              "Copy of this letter signed on entity letterhead"
            ]))
          };
        },
        checks: [
          function vwpCap(f) {
            var n = spanDays(f.startDate, f.endDate);
            if (f.entryRoute === "Visa Waiver Program (ESTA)" && n !== null && n > 90) {
              return {
                level: "stop",
                msg: "This visit is " + n + " days. Admission under the Visa Waiver Program is capped at 90 days and cannot be extended. Either shorten the dates in this letter to 90 days or fewer, or issue it for a B-1 visa application instead."
              };
            }
            if (f.entryRoute === "Visa Waiver Program (ESTA)" && n === null) {
              return { level: "warn", msg: "Dates could not be read, so the 90-day Visa Waiver ceiling could not be checked. Enter dates in a form like \"September 15, 2026\"." };
            }
            return null;
          },
          function productiveLabour(f) {
            if (f.labWork === "Yes — hands-on bench work") {
              return {
                level: "stop",
                msg: "Hands-on laboratory work for a US entity is productive labour, which the B-1 and visa-waiver routes do not permit. This is not a wording problem — the route is wrong. Use J-1, F-1 CPT/OPT, or an employment-authorised route, and take immigration advice before issuing anything."
              };
            }
            return null;
          },
          function paidVisitor(f) {
            if (/salary|wage|stipend|paid|compensat/i.test(f.costDetail || "")) {
              return {
                level: "warn",
                msg: "The cost note mentions pay. A B-1 visitor may be reimbursed for expenses but may not be paid for services from a US source. Reword this as reimbursement, or change route."
              };
            }
            return null;
          },
          ninetyDayMargin
        ]
      },

      /* ── J-1 ───────────────────────────────────────────────────────────── */
      {
        id: "j1",
        name: "J-1 Intern / Trainee Host Placement",
        tag: "J-1",
        note: "Structured supervised training, placed through a designated sponsor and documented on Form DS-7002.",
        fields: [
          { key: "sponsor", label: "Designated J-1 sponsor organisation", ph: "e.g. Cultural Vistas", req: true },
          { key: "category", label: "Category", type: "select", options: ["Intern", "Trainee"], req: true },
          { key: "field", label: "Occupational field", ph: "e.g. Biotechnology research and development", req: true },
          { key: "supervisor", label: "Supervisor name and title", ph: "e.g. [Name], Laboratory Director", req: true },
          { key: "hours", label: "Hours per week", ph: "e.g. 32", req: true },
          { key: "phases", label: "Training plan phases (one per line)", ph: "Phase 1 — laboratory induction, biosafety and instrument training\nPhase 2 — supervised research rotations under the laboratory director\nPhase 3 — independent project with weekly review and written evaluation", multiline: true, req: true },
          { key: "insurance", label: "Insurance and workers' compensation arrangements", ph: "e.g. participants are covered by our workers' compensation policy and by sponsor-arranged accident and sickness insurance meeting 22 CFR 62.14", req: true }
        ],
        build: function (f) {
          return {
            subject: "Host placement confirmation — " + V(f.fullName, "full name") + " — J-1 " + V(f.category, "category"),
            addressee: [V(f.sponsor, "designated J-1 sponsor organisation"), "Exchange Visitor Program sponsor"],
            blocks: [
              { p: V(f.orgLegal, "issuing entity") + " confirms that it will host " + V(f.fullName, "full name") +
                   ", a citizen of " + V(f.nationality, "nationality") + ", as a J-1 " + V(f.category, "category") +
                   " in the field of " + V(f.field, "occupational field") + " from " + V(f.startDate, "start date") +
                   " to " + V(f.endDate, "end date") + ", for " + V(f.hours, "hours") + " hours per week." },
              particulars(f, [
                ["Category", V(f.category, "Intern or Trainee")],
                ["Occupational field", V(f.field, "field")],
                ["Hours per week", V(f.hours, "hours")],
                ["Supervisor", V(f.supervisor, "supervisor name and title")]
              ]),
              { h: "Training plan" },
              { p: "This placement is a structured and continuously supervised training programme, not ordinary " +
                   "employment. The plan to be set out on Form DS-7002 comprises:" },
              { list: LIST(f.phases, ["[Phase 1]", "[Phase 2]", "[Phase 3]"]) },
              { p: V(f.supervisor, "supervisor name and title") + " will provide day-to-day supervision, " +
                   "structured mentorship and periodic written evaluations as required by the Exchange Visitor Program." },
              { h: "Programme obligations" },
              { p: "We confirm that the placement involves no unskilled or casual labour, no clinical care of " +
                   "patients, and no work that displaces a United States worker. " + V(f.insurance, "insurance and workers' compensation arrangements") +
                   " We will cooperate fully with " + V(f.sponsor, "sponsor") + " on site visits, evaluations and " +
                   "programme reporting, and we will notify the sponsor promptly of any material change to the placement." },
              costsBlock(f),
              attestation(),
              { h: "Enclosures" },
              { list: ["Draft Form DS-7002 training/internship placement plan", "Programme description and cohort dates", "Site and supervision details"] }
            ]
          };
        },
        checks: [
          function sponsorNamed(f) {
            if (!has(f.sponsor)) {
              return { level: "stop", msg: "A J-1 placement only exists through a designated sponsor organisation. Name the sponsor — without one there is no DS-2019 and no exchange visitor status." };
            }
            return null;
          },
          function internHours(f) {
            var h = parseFloat(f.hours);
            if (!isNaN(h) && h < 32) {
              return { level: "warn", msg: "Exchange Visitor Program intern and trainee placements are expected to be full-time, generally at least 32 hours per week. " + h + " hours may be refused by the sponsor." };
            }
            return null;
          }
        ]
      },

      /* ── F-1 CPT ───────────────────────────────────────────────────────── */
      {
        id: "cpt",
        name: "F-1 CPT Internship Offer",
        tag: "F-1 · CPT",
        note: "Enrolled students. Addressed to the student; their DSO authorises it on the Form I-20.",
        fields: [
          { key: "school", label: "University", ph: "e.g. University of California, Berkeley", req: true },
          { key: "major", label: "Field of study", ph: "e.g. Bioengineering", req: true },
          { key: "hours", label: "Hours per week", ph: "e.g. 20", req: true },
          { key: "paid", label: "Is the internship paid?", type: "select", options: ["Paid", "Unpaid"], req: true },
          { key: "payDetail", label: "Compensation (if paid)", ph: "e.g. $30.00 per hour, paid semi-monthly" },
          { key: "supervisor", label: "Supervisor name and title", ph: "e.g. [Name], Laboratory Director", req: true },
          { key: "duties", label: "Duties (one per line)", ph: "Conduct literature reviews in synthetic biology\nAssist with supervised experimental planning\nPrepare written summaries of research findings", multiline: true, req: true }
        ],
        build: function (f) {
          var unpaid = f.paid === "Unpaid";
          return {
            subject: "Internship offer and CPT details — " + V(f.fullName, "full name"),
            addressee: [V(f.fullName, "full name"), V(f.school, "university")],
            blocks: [
              { p: "Dear " + (FIRST(f.fullName) || "[first name]") + "," },
              { p: "On behalf of " + V(f.orgLegal, "issuing entity") + " I am pleased to offer you the position of " +
                   V(f.role, "role") + " from " + V(f.startDate, "start date") + " to " + V(f.endDate, "end date") +
                   ", at " + V(f.hours, "hours") + " hours per week. This letter sets out the terms of the internship " +
                   "and contains the details your school needs in order to authorise Curricular Practical Training." },
              particulars(f, [
                ["University", V(f.school, "university")],
                ["Field of study", V(f.major, "field of study")],
                ["Hours per week", V(f.hours, "hours")],
                ["Supervisor", V(f.supervisor, "supervisor name and title")],
                ["Compensation", unpaid ? "Unpaid — no wages, stipend or other compensation" : V(f.payDetail, "rate and pay frequency")]
              ]),
              { h: "Role and responsibilities" },
              { p: "Your responsibilities will include:" },
              { list: LIST(f.duties, ["[Duty 1]", "[Duty 2]", "[Duty 3]"]) },
              { p: "The work is designed to be educational and directly connected to your studies in " +
                   V(f.major, "field of study") + " at " + V(f.school, "university") + ", with " +
                   V(f.supervisor, "supervisor name and title") + " providing mentorship, structured feedback and " +
                   "day-to-day supervision throughout." },
              unpaid
                ? { p: "This is an unpaid internship. No wages, stipend or other compensation will be provided. " +
                       "The internship is structured so that you are the primary beneficiary of the arrangement: " +
                       "it is tied to your coursework, it complements rather than displaces the work of paid staff, " +
                       "and it carries no entitlement to a paid position at its conclusion." }
                : { p: "You will be compensated at " + V(f.payDetail, "rate and pay frequency") +
                       ", subject to lawful withholding and to your holding valid work authorisation for the period of the internship." },
              { h: "Work authorisation" },
              { p: "This offer is made to support your participation in Curricular Practical Training under F-1 " +
                   "student status. We understand and acknowledge that the opportunity must be authorised in " +
                   "advance by your school's Designated School Official and recorded on your Form I-20 before you " +
                   "begin work; that CPT must be an integral part of your established curriculum; and that this " +
                   "offer is contingent on your obtaining valid CPT authorisation for the dates, hours, location " +
                   "and role described above. We are glad to provide any further documentation your DSO requires." },
              attestation(),
              { h: "Acceptance" },
              { p: "I accept the position on the terms described above.\n\nSignature: ______________________________    Date: ______________" }
            ]
          };
        },
        checks: [
          function unpaidForProfit(f) {
            if (f.paid === "Unpaid") {
              return {
                level: "warn",
                msg: "An unpaid internship at a for-profit entity must satisfy the primary-beneficiary test under the Fair Labor Standards Act, separately from anything immigration requires. If the participant is doing work the organisation would otherwise pay someone to do, it is employment and must be paid. Confirm this with employment counsel before issuing."
              };
            }
            return null;
          },
          function paidDetailMissing(f) {
            if (f.paid === "Paid" && !has(f.payDetail)) {
              return { level: "stop", msg: "The internship is marked paid but no rate is given. A CPT offer letter must state the compensation — the DSO records it and the student's I-20 reflects it." };
            }
            return null;
          },
          function fullTimeCpt(f) {
            var h = parseFloat(f.hours);
            if (!isNaN(h) && h > 20) {
              return { level: "note", msg: "More than 20 hours a week is full-time CPT. Twelve months or more of full-time CPT eliminates the student's eligibility for OPT. Make sure the student and their DSO have weighed that." };
            }
            return null;
          }
        ]
      },

      /* ── F-1 OPT ───────────────────────────────────────────────────────── */
      {
        id: "opt",
        name: "F-1 OPT / STEM OPT Confirmation",
        tag: "F-1 · OPT",
        note: "Recent graduates. Confirms the role is directly related to the degree.",
        fields: [
          { key: "school", label: "Degree-granting university", ph: "e.g. University of California, Berkeley", req: true },
          { key: "major", label: "Degree and field", ph: "e.g. M.S. in Bioengineering", req: true },
          { key: "hours", label: "Hours per week", ph: "e.g. 40", req: true },
          { key: "stem", label: "Is this a STEM OPT extension?", type: "select", options: ["No — post-completion OPT", "Yes — 24-month STEM extension"], req: true },
          { key: "eVerify", label: "E-Verify company identification number (STEM OPT only)", ph: "required for STEM OPT employers" },
          { key: "supervisor", label: "Supervisor name and title", ph: "e.g. [Name], Laboratory Director", req: true },
          { key: "duties", label: "Training activities (one per line)", ph: "Lead protocol development for cell-free expression\nSupervised venture-building sprints with weekly review", multiline: true, req: true }
        ],
        build: function (f) {
          var stem = /^Yes/.test(f.stem || "");
          return {
            subject: "Confirmation of practical training — " + V(f.fullName, "full name"),
            addressee: ["To Whom It May Concern", "U.S. Citizenship and Immigration Services"],
            blocks: [
              { p: "This letter confirms that " + V(f.orgLegal, "issuing entity") + " has offered " +
                   V(f.fullName, "full name") + ", a citizen of " + V(f.nationality, "nationality") +
                   ", the position of " + V(f.role, "role") + " from " + V(f.startDate, "start date") + " to " +
                   V(f.endDate, "end date") + ", at " + V(f.hours, "hours") + " hours per week." },
              particulars(f, [
                ["Degree and field", V(f.major, "degree and field")],
                ["Degree-granting institution", V(f.school, "university")],
                ["Hours per week", V(f.hours, "hours")],
                ["Supervisor", V(f.supervisor, "supervisor name and title")],
                ["Training type", stem ? "24-month STEM OPT extension" : "Post-completion OPT"],
                ["E-Verify company ID", stem ? V(f.eVerify, "E-Verify company identification number") : "Not applicable"]
              ]),
              { h: "Relationship to the degree" },
              { p: "The position is directly related to " + V(f.fullName, "full name") + "'s " + V(f.major, "degree and field") +
                   " from " + V(f.school, "university") + ", and constitutes practical training in that field. Activities include:" },
              { list: LIST(f.duties, ["[Training activity 1]", "[Training activity 2]"]) },
              { p: V(f.supervisor, "supervisor name and title") + " will provide structured supervision, regular " +
                   "performance feedback and progressively responsible training appropriate to the field." },
              stem
                ? { p: "For the purposes of the 24-month STEM extension we confirm that " + V(f.orgLegal, "issuing entity") +
                       " is enrolled in E-Verify under company identification number " + V(f.eVerify, "E-Verify company identification number") +
                       "; that we will complete and sign the Form I-983 training plan and its evaluations; that the " +
                       "participant will be a paid employee working at least 20 hours per week under our direct " +
                       "supervision at the site named above; that the terms and conditions of the training are " +
                       "commensurate with those of similarly situated United States workers; and that we will report " +
                       "any material change or early termination to the Designated School Official within five business days." }
                : { p: "We understand this opportunity is undertaken pursuant to the participant's Optional Practical " +
                       "Training authorisation, and we will cooperate with the reporting requirements that apply to it." },
              attestation(),
              { h: "Enclosures" },
              { list: stem
                  ? ["Signed Form I-983 training plan", "Programme description and cohort dates"]
                  : ["Programme description and cohort dates"] }
            ]
          };
        },
        checks: [
          function stemNeedsEverify(f) {
            if (/^Yes/.test(f.stem || "") && !has(f.eVerify)) {
              return { level: "stop", msg: "STEM OPT requires the employer to be enrolled in E-Verify and to state its company identification number. Without it this letter cannot support the extension." };
            }
            return null;
          },
          function stemNeedsPay(f) {
            if (/^Yes/.test(f.stem || "") && f.costWho === "visitor" && /unpaid/i.test(f.costDetail || "")) {
              return { level: "stop", msg: "STEM OPT cannot be unpaid. The employer must pay the participant on terms commensurate with similarly situated US workers." };
            }
            return null;
          },
          function stemHours(f) {
            var h = parseFloat(f.hours);
            if (/^Yes/.test(f.stem || "") && !isNaN(h) && h < 20) {
              return { level: "stop", msg: "STEM OPT requires at least 20 hours per week of paid work. " + h + " hours does not qualify." };
            }
            return null;
          }
        ]
      },

      /* ── O-1A ──────────────────────────────────────────────────────────── */
      {
        id: "o1",
        name: "O-1A Support Letter",
        tag: "O-1A",
        note: "Evidence for an extraordinary-ability petition filed by the beneficiary's attorney. One exhibit, not the petition.",
        fields: [
          { key: "relationship", label: "How we know them and how they were selected", ph: "e.g. selected for Cohort 3 from 480 applications by a panel of eight reviewers", req: true },
          { key: "selectivity", label: "Selectivity of the programme", ph: "e.g. 20 places from 480 applications, a 4% admission rate", req: true },
          { key: "achievements", label: "Achievements we can personally attest to (one per line)", ph: "Raised a $4M seed round for engineered probiotics\nFirst-author publication in Nature Biotechnology, 2025", multiline: true, req: true },
          { key: "contribution", label: "Significance of their contribution to the field", ph: "e.g. their cell-free diagnostic platform reduced assay turnaround from days to minutes", req: true },
          { key: "signerCreds", label: "Signer's standing in the field", ph: "e.g. fifteen years in biotechnology venture investing; has evaluated more than 2,000 founding teams", req: true }
        ],
        build: function (f) {
          return {
            subject: "Letter in support of the O-1A petition of " + V(f.fullName, "full name"),
            addressee: ["To Whom It May Concern", "U.S. Citizenship and Immigration Services"],
            blocks: [
              { p: "I write in support of " + V(f.fullName, "full name") + ", a citizen of " + V(f.nationality, "nationality") +
                   ", in connection with a petition for O-1A classification as an individual of extraordinary ability. " +
                   "I am " + V(f.signerName, "signer name") + ", " + V(f.signerTitle, "signer title") + " of " +
                   V(f.orgLegal, "issuing entity") + ", " + V(f.orgRole, "role of the entity") + ". " +
                   V(f.signerCreds, "signer's standing in the field") + "." },
              particulars(f),
              { h: "How we know the beneficiary" },
              { p: V(f.relationship, "how we know them and how they were selected") + " " +
                   V(f.selectivity, "selectivity of the programme") + " Admission reflects our considered judgment " +
                   "that the beneficiary ranks among the most accomplished scientists and founders we evaluate." },
              { h: "Achievements" },
              { p: "The following are achievements I can attest to from our own diligence and from working directly with the beneficiary:" },
              { list: LIST(f.achievements, ["[Achievement 1]", "[Achievement 2]"]) },
              { h: "Significance to the field" },
              { p: "In my assessment, " + V(f.contribution, "significance of their contribution") + ". Work of this " +
                   "calibre places the beneficiary in the small percentage at the very top of the field, and their " +
                   "continued work in the United States — including as " + V(f.role, "role") + " in " +
                   V(f.program, "programme name") + " from " + V(f.startDate, "start date") + " to " +
                   V(f.endDate, "end date") + " — will substantially benefit the United States biotechnology sector." },
              { p: "This letter is offered as evidence in support of the petition. It is not itself an offer of " +
                   "employment, and the petitioner and the beneficiary's counsel remain responsible for the " +
                   "contents of the petition as filed." },
              attestation()
            ]
          };
        },
        checks: [
          function notThePetitioner(f) {
            return { level: "note", msg: "An O-1 petition needs a US petitioner (an employer or an agent) and, in most cases, a written advisory opinion from a peer group or labour organisation. This letter is supporting evidence only — it does not make Haus the petitioner, and it does not replace the advisory opinion." };
          },
          function vagueClaims(f) {
            var a = LIST(f.achievements, []);
            if (a.length && a.length < 3) {
              return { level: "warn", msg: "Only " + a.length + " achievement" + (a.length === 1 ? "" : "s") + " listed. O-1A adjudication turns on documented, verifiable evidence across multiple criteria. Thin lists draw requests for evidence." };
            }
            return null;
          }
        ]
      },

      /* ── International Entrepreneur Parole ─────────────────────────────── */
      {
        id: "iep",
        name: "International Entrepreneur Parole Support",
        tag: "IEP",
        note: "Founders applying under the International Entrepreneur Rule. Documents our investment and programme backing.",
        fields: [
          { key: "company", label: "Start-up name, jurisdiction and formation date", ph: "e.g. Mycelial Inc., a Delaware corporation formed 4 February 2025", req: true },
          { key: "ownership", label: "Founder's ownership percentage and role", ph: "e.g. 35% of outstanding equity; Chief Executive Officer", req: true },
          { key: "investAmount", label: "Amount we have invested", ph: "e.g. US$250,000", req: true },
          { key: "investDate", label: "Date of the investment", ph: "e.g. 12 August 2026", req: true },
          { key: "support", label: "Other support provided (one per line)", ph: "Residency and cohort programming for twelve weeks\nBench access at the shared wet laboratory\nMentorship from the partner and mentor network", multiline: true, req: true },
          { key: "growth", label: "Growth and public-benefit potential", ph: "e.g. plans to hire five US employees in the first year; platform for rapid biologics manufacturing", req: true },
          { key: "qualified", label: "Are we a qualified investor under the rule?", type: "select", options: ["Yes — we meet the rule's qualified-investor criteria", "No / not established"], req: true }
        ],
        build: function (f) {
          return {
            subject: "Letter in support of the international entrepreneur parole application of " + V(f.fullName, "full name"),
            addressee: ["To Whom It May Concern", "U.S. Citizenship and Immigration Services"],
            blocks: [
              { p: "I write on behalf of " + V(f.orgLegal, "issuing entity") + " in support of " + V(f.fullName, "full name") +
                   ", a citizen of " + V(f.nationality, "nationality") + " and founder of " + V(f.company, "start-up name and formation") +
                   ", in connection with an application for parole under the International Entrepreneur Rule." },
              particulars(f, [
                ["Start-up entity", V(f.company, "start-up name and formation")],
                ["Founder's ownership and role", V(f.ownership, "ownership percentage and role")],
                ["Investment by the issuing entity", V(f.investAmount, "amount") + " on " + V(f.investDate, "date")]
              ]),
              { h: "The founder's role" },
              { p: V(f.fullName, "full name") + " holds " + V(f.ownership, "ownership percentage and role") +
                   " and plays a central and active role in the operations of the company, such that their knowledge, " +
                   "skills and experience would substantially assist the company in conducting and growing its business." },
              { h: "Our investment and support" },
              { p: V(f.orgLegal, "issuing entity") + " invested " + V(f.investAmount, "amount") + " in " +
                   V(f.company, "start-up name") + " on " + V(f.investDate, "date") + ". Our wider support for the company includes:" },
              { list: LIST(f.support, ["[Support item 1]", "[Support item 2]"]) },
              /^Yes/.test(f.qualified || "")
                ? { p: "We make this investment as an investor that regularly makes substantial investments in start-up " +
                       "entities and whose portfolio companies have a demonstrated record of growth and job creation. " +
                       "Documentation of our investment history and portfolio outcomes is available on request." }
                : { p: "We do not assert qualified-investor status under the rule in this letter. This letter records our " +
                       "investment and our programme support as evidence of the company's potential; the applicant's " +
                       "counsel should establish the qualifying investment separately." },
              { h: "Potential for growth and job creation" },
              { p: "On the basis of our diligence and our ongoing work with the team, the company shows substantial " +
                   "potential for rapid growth and job creation: " + V(f.growth, "growth and public-benefit summary") +
                   ". The founder's presence in the United States from " + V(f.startDate, "start date") + " to " +
                   V(f.endDate, "end date") + " at " + V(f.venue, "address where activities take place") +
                   " is material to that trajectory." },
              attestation(),
              { h: "Enclosures" },
              { list: ["Executed investment documents and evidence of transfer of funds", "Programme participation agreement", "Capitalisation table showing the founder's ownership"] }
            ]
          };
        },
        checks: [
          function thresholds(f) {
            return {
              level: "note",
              msg: "The rule sets a minimum qualified investment, a minimum ownership percentage and a definition of qualified investor, and the dollar thresholds are adjusted for inflation every three years. Check the current figures on the USCIS page before relying on this letter, and have the applicant's counsel confirm the investment qualifies."
            };
          },
          function notQualified(f) {
            if (/^No/.test(f.qualified || "")) {
              return { level: "warn", msg: "This letter does not assert qualified-investor status, so it cannot on its own establish the qualifying investment. Make sure the applicant has another route to that element of the rule." };
            }
            return null;
          }
        ]
      },

      /* ── general acceptance ────────────────────────────────────────────── */
      {
        id: "accept",
        name: "Programme Acceptance / Residency Confirmation",
        tag: "GENERAL",
        note: "All-purpose confirmation of acceptance, for any visa file. Explicitly not an offer of employment.",
        fields: [
          { key: "selection", label: "Basis of selection", ph: "e.g. selected for Cohort 3 from 480 applications on scientific merit and team strength", req: true },
          { key: "benefits", label: "What the programme provides (one per line)", ph: "Residency in the cohort house for the full twelve weeks\nBench access at the shared wet laboratory\nMentorship, weekly programming and Demo Day", multiline: true, req: true },
          { key: "employment", label: "Does the programme include US employment?", type: "select", options: ["No — no employment relationship", "Yes — documented separately"], req: true }
        ],
        build: function (f) {
          var employed = /^Yes/.test(f.employment || "");
          return {
            subject: "Confirmation of programme acceptance — " + V(f.fullName, "full name"),
            addressee: ["To Whom It May Concern"],
            blocks: [
              { p: "This letter confirms that " + V(f.fullName, "full name") + ", a citizen of " + V(f.nationality, "nationality") +
                   ", has been accepted into " + V(f.program, "programme name") + ", operated by " + V(f.orgLegal, "issuing entity") +
                   " in " + PROGRAM.city + ", as " + V(f.role, "role") + " from " + V(f.startDate, "start date") +
                   " to " + V(f.endDate, "end date") + "." },
              particulars(f),
              { h: "Selection and participation" },
              { p: V(f.selection, "basis of selection") + " Participation includes:" },
              { list: LIST(f.benefits, ["[Programme benefit 1]", "[Programme benefit 2]"]) },
              costsBlock(f),
              { h: "Scope of this letter" },
              employed
                ? { p: "The participant's employment relationship with a United States entity is documented separately. " +
                       "This letter confirms programme acceptance only and should be read together with that documentation." }
                : { p: "This letter confirms acceptance into the programme and the details set out above. It does not " +
                       "constitute an offer of employment in the United States, and the participant will not receive " +
                       "wages or other remuneration from a United States source in connection with the programme." },
              { p: "It is provided at the participant's request for inclusion in their immigration file. The participant " +
                   "remains responsible for obtaining and maintaining the immigration status appropriate to their activities." },
              attestation()
            ]
          };
        },
        checks: [
          function coverAll(f) {
            return { level: "note", msg: "A general acceptance letter supports an application; it does not select the route. Confirm the participant has a status that actually permits what they will be doing here." };
          }
        ]
      }
    ]
  };

  /* ═══════════════════════════════════════════════════════════════════════
     JAPAN — Kobe node (Kobe Biomedical Innovation Cluster, Port Island)
     Japan is the jurisdiction where the paperwork is most prescribed. MOFA
     names the documents the inviting side produces, and a short-term visa is
     not processed at all without a concrete day-by-day schedule of stay.
     The inviting party sends these to the APPLICANT, who files them with the
     Japanese embassy or consulate — never directly to MOFA or the mission.
     ═══════════════════════════════════════════════════════════════════════ */

  var JP = {
    id: "jp",
    name: "Japan",
    city: "Kobe, Hyōgo Prefecture",
    flag: "🇯🇵",
    node: "Kobe · Kobe Biomedical Innovation Cluster, Port Island",
    blurb: "Bench and bed on the same island. Kobe is a National Strategic Special Zone with its own start-up visa.",

    guidance: {
      routes: [
        "<b>Temporary Visitor (短期滞在)</b> — up to 90 days for meetings, inspection, conferences and other non-remunerated business. No paid activity in Japan.",
        "<b>Designated Activities / Cultural Activities</b> — for stays past 90 days or for structured internships and research. Requires a Certificate of Eligibility applied for <i>in Japan</i> by the host, at the Regional Immigration Services Bureau, before the visa application.",
        "<b>Kobe Start-up Visa</b> — Kobe is one of the National Strategic Special Zones. Kobe City reviews a Japanese-language business plan and issues a Certificate of Confirmation of Start-up Activities, which supports six months of Business Manager status ahead of meeting the ordinary requirements, extendable on approved progress. Target sectors expressly include healthcare and biotechnology.",
        "<b>Business Manager (経営・管理)</b> — the ordinary route once the company is established, with office premises and capital requirements."
      ],
      hostDuties: [
        "Prepare the Letter of Reason for Invitation (招へい理由書) — purpose, background, and the nature of the relationship with the applicant.",
        "Prepare the Schedule of Stay (滞在予定表) — a concrete, dated itinerary. A short-term visa is not processed without one.",
        "Prepare a Letter of Guarantee (身元保証書) only where the inviting side bears the applicant's costs. It commits the guarantor to living expenses, return travel, and the applicant's compliance with Japanese law.",
        "Enclose materials on the inviting organisation — the Certificate of Registered Matters (登記事項証明書) or an equivalent company profile.",
        "Send the completed set to the applicant. The applicant files them; the inviting side does not send them to MOFA or to the mission."
      ],
      mustInclude: [
        "The applicant's name exactly as in the passport, date of birth, nationality, sex, occupation and passport number.",
        "The purpose of the invitation and the background to the relationship, in terms a reviewer can follow.",
        "A dated day-by-day schedule with places and contact points.",
        "An unambiguous statement of who bears which costs.",
        "The inviting organisation's full name, registered address, telephone, representative and the signer's position."
      ],
      watchOuts: [
        "<b>Ninety days is the ceiling for Temporary Visitor.</b> The cohort is set at " + PROGRAM.days + " days to sit inside it, so a Kobe cohort can run on Temporary Visitor status with " + (90 - PROGRAM.days) + " day" + ((90 - PROGRAM.days) === 1 ? "" : "s") + " to spare. A participant who wants to arrive early, stay on afterwards, or extend for any reason falls outside it and needs a Certificate of Eligibility instead — which is filed in Japan by the host and takes one to three months, so it is not a decision that can be left late.",
        "<b>No paid work on Temporary Visitor status.</b> Remunerated activity requires a work status; there is no equivalent of an incidental-work allowance.",
        "<b>The Certificate of Eligibility is filed in Japan, by the host.</b> Allow one to three months. A letter alone does not start the clock.",
        "<b>The Kobe start-up route wants a Japanese-language business plan</b> assessed by the city, not an English pitch deck. Budget time for translation and for the city's review."
      ],
      sources: [
        { label: "Visa — Ministry of Foreign Affairs of Japan", url: "https://www.mofa.go.jp/j_info/visit/visa/index.html" },
        { label: "Start-up Visa — Invest in Kobe", url: "https://investkobe.com/startup-visa" },
        { label: "Promoting acceptance of foreign entrepreneurs — JETRO", url: "https://www.jetro.go.jp/en/invest/setting_up/section2/page12.html" },
        { label: "Visa for COE holders — Embassy of Japan in the USA", url: "https://www.us.emb-japan.go.jp/itpr_en/visa-coe.html" }
      ]
    },

    templates: [
      /* ── 招へい理由書 ──────────────────────────────────────────────────── */
      {
        id: "invitation",
        name: "Letter of Reason for Invitation (招へい理由書)",
        tag: "短期滞在",
        note: "The core document the inviting side produces for a Temporary Visitor application. Pair it with the Schedule of Stay.",
        fields: [
          { key: "post", label: "Japanese embassy or consulate applied to", ph: "e.g. Consulate-General of Japan in San Francisco", req: true },
          { key: "sex", label: "Sex as recorded in the passport", ph: "as printed in the passport", req: true },
          { key: "occupation", label: "Occupation", ph: "e.g. Chief Executive Officer, Helix Therapeutics GmbH", req: true },
          { key: "company", label: "Applicant's employer or company", ph: "e.g. Helix Therapeutics GmbH, Berlin, Germany", req: true },
          { key: "relationship", label: "Background and nature of the relationship", ph: "e.g. selected for Cohort 3 in June 2026 following a competitive review; we have worked together on the cohort curriculum since then", req: true },
          { key: "purpose", label: "Purpose of the invitation", ph: "e.g. to take part in the Kobe residency of the accelerator at the Kobe Biomedical Innovation Cluster", req: true },
          { key: "activities", label: "Activities in Japan (one per line)", ph: "Cohort programming and mentor sessions at KBIC\nMeetings with Kobe City and JETRO Kobe\nObservation visits to partner laboratories on Port Island", multiline: true, req: true },
          { key: "accommodation", label: "Accommodation in Japan", ph: "name and address of the residence or hotel, with telephone", req: true }
        ],
        build: function (f) {
          return {
            subject: "Letter of Reason for Invitation (招へい理由書) — " + V(f.fullName, "full name"),
            addressee: [V(f.post, "Japanese embassy or consulate"), "Visa Section"],
            blocks: [
              { p: "I write on behalf of " + V(f.orgLegal, "issuing entity") + " to invite the person named below to " +
                   "Japan for a temporary visit, and to set out the reason for that invitation." },
              particulars(f, [
                ["Sex", V(f.sex, "sex as in passport")],
                ["Occupation", V(f.occupation, "occupation")],
                ["Employer / company", V(f.company, "employer or company")],
                ["Accommodation in Japan", V(f.accommodation, "accommodation with address and telephone")],
                ["Inviting organisation", V(f.orgLegal, "issuing entity")],
                ["Registered address", V(f.orgAddress, "registered address")],
                ["Telephone", V(f.orgPhone, "telephone")]
              ]),
              { h: "Purpose of the invitation" },
              { p: V(f.purpose, "purpose of the invitation") + "." },
              { h: "Background and relationship" },
              { p: V(f.relationship, "background and nature of the relationship") + "." },
              { h: "Activities during the stay" },
              { p: "During the visit the applicant will:" },
              { list: LIST(f.activities, ["[Activity 1]", "[Activity 2]", "[Activity 3]"]) },
              { p: "A dated Schedule of Stay (滞在予定表) accompanies this letter." },
              { h: "Costs of the stay" },
              costsBlock(f),
              { p: "The applicant will engage in no remunerated activity in Japan and will leave Japan on or before " +
                   "the end of the permitted period of stay." },
              attestation(),
              { h: "Enclosures" },
              { list: [
                "Schedule of Stay (滞在予定表)",
                (f.costWho === "host" || f.costWho === "shared") ? "Letter of Guarantee (身元保証書)" : "Letter of Guarantee (身元保証書) — not enclosed; the applicant bears their own costs",
                "Certificate of Registered Matters (登記事項証明書) or company profile of the inviting organisation"
              ] }
            ]
          };
        },
        checks: [
          function ninetyDays(f) {
            var n = spanDays(f.startDate, f.endDate);
            if (n !== null && n > 90) {
              return {
                level: "stop",
                msg: "This stay is " + n + " days. Temporary Visitor status is capped at 90 days. Either shorten the stay to 90 days or fewer, or switch to a Certificate of Eligibility route (Designated Activities, Cultural Activities, or the Kobe start-up visa) — an invitation letter cannot extend the ceiling."
              };
            }
            return null;
          },
          function scheduleRequired(f) {
            return { level: "note", msg: "Generate the Schedule of Stay (滞在予定表) as well and send both together. A short-term visa application is not processed without a concrete dated itinerary." };
          },
          function sendToApplicant(f) {
            return { level: "note", msg: "Send the completed set to the applicant, not to the embassy or consulate. The applicant files them with their own application." };
          },
          ninetyDayMargin
        ]
      },

      /* ── 滞在予定表 ────────────────────────────────────────────────────── */
      {
        id: "schedule",
        name: "Schedule of Stay (滞在予定表)",
        tag: "短期滞在",
        note: "The dated itinerary. Mandatory alongside the invitation letter — vague schedules are the usual reason for refusal.",
        fields: [
          { key: "post", label: "Japanese embassy or consulate applied to", ph: "e.g. Consulate-General of Japan in San Francisco", req: true },
          { key: "arrival", label: "Arrival details", ph: "e.g. 15 September 2026, flight NH7 arriving Kansai International Airport", req: true },
          { key: "departure", label: "Departure details", ph: "e.g. 14 December 2026, flight NH8 from Kansai International Airport", req: true },
          { key: "itinerary", label: "Itinerary — one line per day or block of days", ph: "15 Sep — Arrival, check in at cohort residence, Port Island\n16–20 Sep — Induction week at KBIC; contact: [name], [telephone]\n21 Sep–4 Oct — Cohort programming and mentor sessions at KBIC\n5 Oct — Meeting with Kobe City Enterprise Promotion Bureau", multiline: true, req: true },
          { key: "contactJp", label: "Contact person in Japan (name, telephone)", ph: "e.g. [name], programme manager, +81 78 555 0134", req: true },
          { key: "accommodation", label: "Accommodation in Japan", ph: "name and address of the residence or hotel, with telephone", req: true }
        ],
        build: function (f) {
          return {
            subject: "Schedule of Stay (滞在予定表) — " + V(f.fullName, "full name"),
            addressee: [V(f.post, "Japanese embassy or consulate"), "Visa Section"],
            blocks: [
              particulars(f, [
                ["Arrival", V(f.arrival, "arrival date and flight")],
                ["Departure", V(f.departure, "departure date and flight")],
                ["Accommodation in Japan", V(f.accommodation, "accommodation with address and telephone")],
                ["Contact in Japan", V(f.contactJp, "contact person and telephone")]
              ]),
              { h: "Itinerary" },
              { list: LIST(f.itinerary, ["[Date — activity, place, contact]", "[Date — activity, place, contact]"]) },
              { p: "The applicant will engage in no remunerated activity in Japan during this stay and will leave " +
                   "Japan on or before the end of the permitted period." },
              attestation()
            ]
          };
        },
        checks: [
          function thinItinerary(f) {
            var n = LIST(f.itinerary, []).length;
            if (n && n < 4) {
              return { level: "warn", msg: "Only " + n + " itinerary line" + (n === 1 ? "" : "s") + ". Reviewers expect a schedule that accounts for the whole stay with places and contact points. A sparse itinerary is a common ground of refusal." };
            }
            return null;
          },
          function ninetyDays(f) {
            var n = spanDays(f.startDate, f.endDate);
            if (n !== null && n > 90) {
              return { level: "stop", msg: "This schedule covers " + n + " days, past the 90-day Temporary Visitor ceiling. Shorten it or move to a Certificate of Eligibility route." };
            }
            return null;
          },
          ninetyDayMargin
        ]
      },

      /* ── 身元保証書 ────────────────────────────────────────────────────── */
      {
        id: "guarantee",
        name: "Letter of Guarantee (身元保証書)",
        tag: "短期滞在",
        note: "Only where we bear the applicant's costs. It is an undertaking to the Japanese government, not a formality.",
        fields: [
          { key: "post", label: "Japanese embassy or consulate applied to", ph: "e.g. Consulate-General of Japan in San Francisco", req: true },
          { key: "guarantorName", label: "Guarantor — full name of the representative", ph: "e.g. Elliot ___", req: true },
          { key: "guarantorTitle", label: "Guarantor — position", ph: "e.g. Representative Director", req: true },
          { key: "scope", label: "Which costs we guarantee", type: "select", options: ["All living costs and return travel", "Living costs only", "Return travel only"], req: true }
        ],
        build: function (f) {
          var scope = f.scope || "All living costs and return travel";
          var items = [];
          if (/living/i.test(scope)) items.push("Expenses of the applicant's stay in Japan, including accommodation and day-to-day living costs.");
          if (/return travel|All/i.test(scope)) items.push("The applicant's return travel expenses from Japan.");
          items.push("Ensuring that the applicant observes the laws and regulations of Japan during the stay.");
          return {
            subject: "Letter of Guarantee (身元保証書) — " + V(f.fullName, "full name"),
            addressee: [V(f.post, "Japanese embassy or consulate"), "Visa Section"],
            blocks: [
              { p: "I, " + V(f.guarantorName, "guarantor name") + ", " + V(f.guarantorTitle, "guarantor position") +
                   " of " + V(f.orgLegal, "issuing entity") + ", hereby act as guarantor for the person named below " +
                   "in respect of their temporary visit to Japan." },
              particulars(f, [
                ["Guarantor", V(f.guarantorName, "guarantor name") + ", " + V(f.guarantorTitle, "guarantor position")],
                ["Guarantor organisation", V(f.orgLegal, "issuing entity")],
                ["Registered address", V(f.orgAddress, "registered address")],
                ["Telephone", V(f.orgPhone, "telephone")],
                ["Scope of guarantee", scope]
              ]),
              { h: "Undertakings of the guarantor" },
              { p: "I undertake responsibility for the following:" },
              { list: items },
              { p: "I make these undertakings in full understanding of their nature and I am authorised to make them " +
                   "on behalf of the organisation named above." },
              attestation()
            ]
          };
        },
        checks: [
          function onlyIfPaying(f) {
            if (f.costWho === "visitor") {
              return { level: "warn", msg: "The cost section says the applicant bears their own costs, so a Letter of Guarantee is not required and issuing one contradicts the invitation letter. Either change the cost setting or do not send this document." };
            }
            return null;
          },
          function realObligation(f) {
            return { level: "note", msg: "This is a real undertaking to the Japanese government covering living costs, return travel and the applicant's compliance with Japanese law. Have the signer confirm the organisation is prepared to meet it before issuing." };
          }
        ]
      },

      /* ── COE host letter ───────────────────────────────────────────────── */
      {
        id: "coe",
        name: "Host Acceptance Letter for Certificate of Eligibility",
        tag: "COE",
        note: "For stays past 90 days. The host files the COE application in Japan; this letter is the acceptance and activity plan behind it.",
        fields: [
          { key: "status", label: "Status of residence sought", type: "select", options: ["Designated Activities (特定活動)", "Cultural Activities (文化活動)", "Business Manager (経営・管理)", "Researcher (研究)"], req: true },
          { key: "bureau", label: "Regional Immigration Services Bureau where the COE will be filed", ph: "e.g. Osaka Regional Immigration Services Bureau, Kobe Branch", req: true },
          { key: "supervisor", label: "Supervisor name and title", ph: "e.g. [name], Programme Director", req: true },
          { key: "hours", label: "Hours per week", ph: "e.g. 30", req: true },
          { key: "plan", label: "Activity plan (one per line)", ph: "Weeks 1–2 — induction, biosafety and facility orientation at KBIC\nWeeks 3–8 — supervised research programme with weekly review\nWeeks 9–12 — independent project and final presentation", multiline: true, req: true },
          { key: "funding", label: "How the participant is supported financially", ph: "e.g. a monthly living allowance of ¥___ paid by the host, plus accommodation provided at no cost", req: true },
          { key: "remunerated", label: "Is the activity remunerated in Japan?", type: "select", options: ["No — no remuneration in Japan", "Yes — remunerated"], req: true }
        ],
        build: function (f) {
          return {
            subject: "Host acceptance and activity plan — " + V(f.fullName, "full name") + " — " + V(f.status, "status of residence"),
            addressee: [V(f.bureau, "Regional Immigration Services Bureau"), "Ministry of Justice, Japan"],
            blocks: [
              { p: V(f.orgLegal, "issuing entity") + " confirms that it will host the person named below in " +
                   V(f.city || "Kobe, Hyōgo Prefecture", "host city") + " under " + V(f.status, "status of residence") +
                   " from " + V(f.startDate, "start date") + " to " + V(f.endDate, "end date") + ", and applies for a " +
                   "Certificate of Eligibility on that basis." },
              particulars(f, [
                ["Status of residence sought", V(f.status, "status of residence")],
                ["Hours per week", V(f.hours, "hours")],
                ["Supervisor", V(f.supervisor, "supervisor name and title")],
                ["Remuneration in Japan", /^Yes/.test(f.remunerated || "") ? "Yes" : "None"]
              ]),
              { h: "Activity plan" },
              { p: "The participant's activities will be supervised throughout by " + V(f.supervisor, "supervisor name and title") +
                   " and will comprise:" },
              { list: LIST(f.plan, ["[Phase 1]", "[Phase 2]", "[Phase 3]"]) },
              { h: "Financial support" },
              { p: V(f.funding, "how the participant is supported financially") + "." },
              costsBlock(f),
              { h: "Undertakings of the host" },
              { p: "We undertake to supervise the participant's activities for the whole of the period stated, to " +
                   "notify the Immigration Services Agency of any material change to those activities or to the " +
                   "period of stay, to keep records of attendance and progress, and to cooperate with any enquiry " +
                   "from the Agency or from the Ministry of Foreign Affairs." },
              attestation(),
              { h: "Enclosures" },
              { list: [
                "Certificate of Registered Matters (登記事項証明書) of the host organisation",
                "Company profile and description of the facility",
                "Detailed activity plan and weekly schedule",
                "Evidence of the financial support described above"
              ] }
            ]
          };
        },
        checks: [
          function leadTime(f) {
            return { level: "note", msg: "The host files the Certificate of Eligibility application in Japan and processing commonly runs one to three months, before the applicant can even apply for the visa. Start well ahead of the intended start date." };
          },
          function remunerationStatus(f) {
            if (/^Yes/.test(f.remunerated || "") && /Cultural Activities/.test(f.status || "")) {
              return { level: "stop", msg: "Cultural Activities status is for non-remunerated activities. If the participant is paid in Japan, this is the wrong status — take Japanese immigration advice before issuing." };
            }
            return null;
          },
          function shortStay(f) {
            var n = spanDays(f.startDate, f.endDate);
            if (n !== null && n <= 90) {
              return { level: "note", msg: "This stay is " + n + " days, within the Temporary Visitor ceiling. A Certificate of Eligibility may be unnecessary — the invitation letter and schedule of stay may be enough, and are far faster." };
            }
            return null;
          }
        ]
      },

      /* ── Kobe start-up visa ────────────────────────────────────────────── */
      {
        id: "kobe-startup",
        name: "Kobe Start-up Visa Support Letter",
        tag: "特区",
        note: "Supports an application to Kobe City for a Certificate of Confirmation of Start-up Activities under the National Strategic Special Zone scheme.",
        fields: [
          { key: "company", label: "Start-up name and country of formation", ph: "e.g. Mycelial Inc., a Delaware corporation", req: true },
          { key: "sector", label: "Sector", ph: "e.g. biotechnology — engineered microbial therapeutics", req: true },
          { key: "planSummary", label: "Business plan summary", ph: "e.g. to establish a Japanese subsidiary at the Kobe Biomedical Innovation Cluster and run a pilot with two Kobe hospital partners", req: true },
          { key: "support", label: "Support we provide in Kobe (one per line)", ph: "Residency and workspace at the Kobe node for the cohort period\nBench access at partner facilities on Port Island\nIntroductions to Kobe City and JETRO Kobe", multiline: true, req: true },
          { key: "milestones", label: "Milestones towards Business Manager status (one per line)", ph: "Month 1 — incorporate the Japanese subsidiary\nMonth 3 — secure independent office premises in Kobe\nMonth 5 — meet the capital and staffing requirements", multiline: true, req: true },
          { key: "japanesePlan", label: "Is a Japanese-language business plan prepared?", type: "select", options: ["Yes", "Not yet"], req: true }
        ],
        build: function (f) {
          return {
            subject: "Support letter — start-up activity confirmation for " + V(f.fullName, "full name"),
            addressee: ["Kobe City", "Enterprise Promotion Bureau — Start-up Visa Programme"],
            blocks: [
              { p: V(f.orgLegal, "issuing entity") + " writes in support of the application by " + V(f.fullName, "full name") +
                   ", a citizen of " + V(f.nationality, "nationality") + " and founder of " + V(f.company, "start-up name and formation") +
                   ", for a Certificate of Confirmation of Start-up Activities under the National Strategic Special Zone scheme in Kobe." },
              particulars(f, [
                ["Start-up entity", V(f.company, "start-up name and formation")],
                ["Sector", V(f.sector, "sector")],
                ["Intended base", "Kobe Biomedical Innovation Cluster, Port Island, Kobe"]
              ]),
              { h: "The proposed business" },
              { p: V(f.planSummary, "business plan summary") + "." },
              { h: "Support provided by the accelerator" },
              { p: "The founder has been accepted into " + V(f.program, "programme name") + " as " + V(f.role, "role") +
                   " for the period stated above. Our support in Kobe comprises:" },
              { list: LIST(f.support, ["[Support item 1]", "[Support item 2]"]) },
              { h: "Path to Business Manager status" },
              { p: "The founder's plan to meet the ordinary requirements for Business Manager status within the " +
                   "confirmation period is as follows:" },
              { list: LIST(f.milestones, ["[Milestone 1]", "[Milestone 2]"]) },
              costsBlock(f),
              { p: "We will report to Kobe City on the founder's progress against these milestones at the intervals " +
                   "the city requires, and will notify the city promptly if the founder ceases to take part in the programme." },
              attestation(),
              { h: "Enclosures" },
              { list: ["Business plan in Japanese", "Programme acceptance letter", "Evidence of workspace and facility access in Kobe"] }
            ]
          };
        },
        checks: [
          function japanesePlanRequired(f) {
            if (f.japanesePlan === "Not yet") {
              return { level: "stop", msg: "Kobe City assesses a business plan submitted in Japanese. Without it the application cannot be reviewed — commission the translation before sending this letter." };
            }
            return null;
          },
          function cityDecides(f) {
            return { level: "note", msg: "Kobe City, not the accelerator, issues the certificate, and the immigration decision follows the city's confirmation. This letter is supporting evidence for the city's review. Contact the Kobe City Enterprise Promotion Bureau or JETRO Kobe early — the review has its own timetable." };
          }
        ]
      }
    ]
  };

  /* ═══════════════════════════════════════════════════════════════════════
     VISITOR-LETTER FACTORY
     The remaining jurisdictions all issue a host invitation for a short
     business visit, so the scaffolding is shared. What is NOT shared is the
     substance: each country supplies its own `clauses`, and those clauses
     are where the jurisdiction's actual requirements live. Read them before
     editing — they are not boilerplate.
     ═══════════════════════════════════════════════════════════════════════ */

  var BASE_VISITOR_FIELDS = [
    { key: "post", label: "Embassy, consulate or authority applied to", ph: "the post where the application is lodged", req: true },
    { key: "company", label: "Participant's employer or company", ph: "e.g. Helix Therapeutics GmbH, Berlin, Germany", req: true },
    { key: "occupation", label: "Occupation", ph: "e.g. Chief Executive Officer", req: true },
    { key: "activities", label: "Activities during the visit (one per line)", ph: "Attend cohort programming and mentor sessions\nMeetings with local partners and investors\nPresent at the cohort showcase", multiline: true, req: true },
    { key: "accommodation", label: "Accommodation during the visit", ph: "name, full address and telephone", req: true },
    { key: "ties", label: "Ties to their country of residence", ph: "e.g. continues to direct their company in Berlin, where their family home is based", req: true }
  ];

  function visitorTemplate(cfg) {
    return {
      id: cfg.id,
      name: cfg.name,
      tag: cfg.tag,
      note: cfg.note,
      fields: BASE_VISITOR_FIELDS.concat(cfg.fields || []),
      build: function (f) {
        var head = [
          { p: cfg.opening(f) },
          particulars(f, (cfg.rows ? cfg.rows(f) : []).concat([
            ["Occupation", V(f.occupation, "occupation")],
            ["Employer / company", V(f.company, "employer or company")],
            ["Accommodation", V(f.accommodation, "accommodation with address and telephone")],
            ["Inviting organisation", V(f.orgLegal, "issuing entity")],
            ["Registered address", V(f.orgAddress, "registered address")],
            ["Telephone", V(f.orgPhone, "telephone")]
          ])),
          { h: "Purpose of the visit" },
          { p: "During the visit " + V(f.fullName, "full name") + " will:" },
          { list: LIST(f.activities, ["[Activity 1]", "[Activity 2]", "[Activity 3]"]) }
        ];
        var tail = [
          { p: V(f.fullName, "full name") + " maintains a residence and professional commitments outside the " +
               "host country — " + V(f.ties, "ties to country of residence") + " — and will leave on or before " +
               "the end of the permitted period of stay." },
          attestation()
        ];
        return {
          subject: cfg.subject(f),
          addressee: cfg.addressee(f),
          blocks: head.concat(cfg.clauses(f)).concat(tail).concat(enclosures(cfg.enclosures(f))).filter(Boolean)
        };
      },
      checks: cfg.checks || []
    };
  }

  /* Shared Schengen checks — France and Switzerland both run on the Visa Code. */
  var SCHENGEN_CHECKS = [
    function ninetyInOneEighty(f) {
      var n = spanDays(f.startDate, f.endDate);
      if (n !== null && n > 90) {
        return {
          level: "stop",
          msg: "This visit is " + n + " days. A uniform Schengen short-stay visa permits at most 90 days in any 180-day period across the whole Schengen area. Shorten the stay, or the participant needs a national long-stay visa or residence permit — an invitation letter cannot extend the ceiling."
        };
      }
      return null;
    },
    function priorSchengenDays(f) {
      var base = "The 90 days are counted across the whole Schengen area over a rolling 180-day " +
                 "window, not per country. ";
      var n = spanDays(f.startDate, f.endDate);
      var slack = (n === null) ? null : 90 - n;
      if (slack !== null && slack >= 0 && slack <= 5) {
        return {
          level: "warn",
          msg: base + "These dates already use " + n + " of them, so as little as " + (slack + 1) +
               " day" + (slack === 0 ? "" : "s") + " spent anywhere in the Schengen area in the " +
               "preceding 180 days would put the participant over. Ask what prior Schengen time " +
               "they have before committing to these dates — this is the margin that actually bites."
        };
      }
      return { level: "note", msg: base + "Ask the participant what other Schengen time they have used in the preceding six months before committing to these dates." };
    },
    function insurance(f) {
      return { level: "note", msg: "Travel medical insurance of at least €30,000, valid across the Schengen area and covering the entire stay including emergency treatment and repatriation, is a legal condition of the visa under Article 15 of the Visa Code. Confirm the participant holds it." };
    },
    ninetyDayMargin
  ];

  /* ── MEXICO — Monterrey node ─────────────────────────────────────────── */
  var MX = {
    id: "mx", name: "Mexico", city: "Monterrey, Nuevo León", flag: "🇲🇽",
    node: "Monterrey · fermentation and bioprocess scale-up",
    blurb: "Nearshoring momentum and scale-up capacity for fermentation and bioprocess.",
    guidance: {
      routes: [
        "<b>Visitor without permission to carry out paid activities</b> — the standard route for an unremunerated programme. Up to 180 days.",
        "<b>Visitor with permission to carry out paid activities</b> — needed where a Mexican entity pays the participant; requires prior authorisation from the Instituto Nacional de Migración.",
        "<b>Temporary resident</b> — for stays past 180 days.",
        "Many nationalities are visa-exempt for visitor purposes; others apply at a Mexican consulate. Some cases route through an INM authorisation before the consular appointment."
      ],
      hostDuties: [
        "Issue an original letter of responsibility (carta responsiva) on organisation letterhead, signed by a legal representative.",
        "State in terms that the activity is unremunerated in Mexico, unless an INM work authorisation has been obtained.",
        "State who bears the costs of the stay and the return journey.",
        "Enclose evidence that the inviting organisation exists and is registered."
      ],
      mustInclude: [
        "The applicant's full name as in the passport, nationality, date of birth and passport number.",
        "The exact activity the applicant will carry out and where.",
        "Precise entry and exit dates.",
        "An express statement that the activity is unremunerated in Mexico.",
        "The legal representative's name, position, signature and contact details."
      ],
      watchOuts: [
        "<b>Unremunerated must be stated, not implied.</b> A letter that describes work without disclaiming Mexican-source pay invites a finding that the wrong permit was sought.",
        "<b>The letter is expected in original.</b> Consulates commonly want a signed original on letterhead, not a scan.",
        "<b>Spanish is safer.</b> Consulates accept English in practice, but a Spanish version alongside removes an avoidable point of friction."
      ],
      sources: [
        { label: "Instituto Nacional de Migración — electronic authorisation", url: "https://www.inm.gob.mx/sae/publico/en/solicitud.html" },
        { label: "Visa with INM approval — Consulate of Mexico", url: "https://consulmex.sre.gob.mx/washington/images/2020/visas/eng/VISA_WITH_THE_APROVAL_OF_THE_INSTITUTO_NACIONAL_DE_MIGRACION_INM_enero_2020.pdf" }
      ]
    },
    templates: [
      visitorTemplate({
        id: "carta", name: "Letter of Responsibility (Carta Responsiva)", tag: "Visitante",
        note: "The original letter of responsibility from the inviting organisation. States the unremunerated activity and who bears costs.",
        fields: [
          { key: "inmAuth", label: "Has INM authorisation been obtained?", type: "select", options: ["Not required — unremunerated activity", "Yes — INM authorisation obtained"], req: true }
        ],
        subject: function (f) { return "Letter of responsibility — " + V(f.fullName, "full name"); },
        addressee: function (f) { return [V(f.post, "Mexican consulate or INM office"), "Consular Section"]; },
        opening: function (f) {
          return V(f.orgLegal, "issuing entity") + ", " + V(f.orgRole, "role of the entity") +
            ", invites the person named below to Mexico to take part in " + V(f.program, "programme name") +
            " at " + V(f.venue, "address where activities take place") + " from " + V(f.startDate, "start date") +
            " to " + V(f.endDate, "end date") + ", and accepts responsibility for the invitation on the terms set out below.";
        },
        clauses: function (f) {
          var paid = /^Yes/.test(f.inmAuth || "");
          return [
            { h: "Nature of the activity" },
            paid
              ? { p: "The activity is remunerated and prior authorisation has been obtained from the Instituto Nacional de Migración. " +
                     "The participant must apply for a visitor permit with permission to carry out paid activities on the basis of that authorisation." }
              : { p: "The activity described above is unremunerated. The participant will not receive any salary, wage, " +
                     "fee or other remuneration from a Mexican source, and will not enter into an employment relationship " +
                     "with any Mexican entity. No authorisation from the Instituto Nacional de Migración has been sought " +
                     "or is required on that basis." },
            { h: "Responsibility for the stay" },
            costsBlock(f),
            { p: V(f.orgLegal, "issuing entity") + " accepts responsibility for the participant during the programme " +
                 "period stated above and confirms that suitable accommodation has been arranged. This letter is issued " +
                 "in original on organisation letterhead and signed by a duly authorised representative." }
          ];
        },
        enclosures: function () {
          return ["Constitutive act or certificate of registration of the inviting organisation",
                  "Identification of the signing legal representative",
                  "Programme description and cohort dates"];
        },
        checks: [
          function oneEighty(f) {
            var n = spanDays(f.startDate, f.endDate);
            if (n !== null && n > 180) {
              return { level: "stop", msg: "This visit is " + n + " days. Visitor status is capped at 180 days. A longer stay needs temporary residence — apply for it before travel, not after arrival." };
            }
            return null;
          },
          function paidNeedsInm(f) {
            if (f.costWho === "host" && /stipend|salary|wage|pay/i.test(f.costDetail || "") && !/^Yes/.test(f.inmAuth || "")) {
              return { level: "stop", msg: "The cost note describes payment to the participant, but no INM authorisation is recorded. Paid activity in Mexico requires prior authorisation from the Instituto Nacional de Migración. Either recast this as reimbursement of expenses or obtain the authorisation first." };
            }
            return null;
          },
          function original(f) {
            return { level: "note", msg: "Print, sign and send the original on letterhead. Consulates routinely reject a scan of a letter of responsibility." };
          }
        ]
      })
    ]
  };

  /* ── UNITED KINGDOM — London node ────────────────────────────────────── */
  var GB = {
    id: "gb", name: "United Kingdom", city: "London", flag: "🇬🇧",
    node: "London · the European bridgehead",
    blurb: "Standard Visitor rules are generous on research — and unforgiving on work.",
    guidance: {
      routes: [
        "<b>Standard Visitor</b> — up to six months. Appendix Visitor sets out what is permitted: meetings, negotiations, conferences, professional development, and research, including independent research not tied to a formal exchange.",
        "<b>Electronic Travel Authorisation</b> — non-visa nationals need an ETA before travel. Full enforcement began 25 February 2026. It is not a visa and does not widen what a visitor may do.",
        "<b>Global Talent</b> or <b>Expansion Worker</b> — where the activity goes beyond visitor rules or the stay runs long."
      ],
      hostDuties: [
        "There is no sponsor licence and no Certificate of Sponsorship on the visitor route. Nothing is filed with the Home Office by the host.",
        "The invitation letter is supporting evidence only. It carries no formal sponsorship duty.",
        "Where the host provides accommodation or funds, say so plainly and be prepared to evidence the means to do it."
      ],
      mustInclude: [
        "The relationship between the host and the applicant, and how it arose.",
        "The purpose of the visit and the specific activities, mapped to permitted visitor activities.",
        "The dates of the visit and where the applicant will stay.",
        "What support the host provides — accommodation, travel, or maintenance — and what the applicant funds themselves.",
        "The host's full address and contact details."
      ],
      watchOuts: [
        "<b>Visitors may not work.</b> Not for a UK business, not for an overseas one while in the UK beyond permitted activities, and not on their own account. Research is permitted; producing work for a UK entity is not.",
        "<b>An ETA is not permission to do more.</b> The activity limits are identical to a visitor visa.",
        "<b>Six months is the ceiling</b>, and a pattern of repeat visits that amounts to living in the UK will be refused regardless of each stay being short.",
        "<b>No sponsorship framework exists here.</b> Do not describe the organisation as the applicant's sponsor — the word means something specific in UK immigration law and does not apply."
      ],
      sources: [
        { label: "Appendix Visitor: permitted activities", url: "https://www.davidsonmorris.com/appendix-visitor/" },
        { label: "Electronic Travel Authorisation factsheet", url: "https://homeofficemedia.blog.gov.uk/electronic-travel-authorisation-eta-factsheet-april-2026/" }
      ]
    },
    templates: [
      visitorTemplate({
        id: "invite", name: "Standard Visitor Invitation", tag: "Visitor",
        note: "Supporting evidence for a Standard Visitor application or an ETA-based visit. No sponsorship duty attaches.",
        fields: [
          { key: "route", label: "Route", type: "select", options: ["Standard Visitor visa", "Visa-free entry with an ETA"], req: true },
          { key: "permitted", label: "Which permitted activities apply", ph: "e.g. attending meetings and conferences, negotiating deals, and undertaking independent research", req: true }
        ],
        subject: function (f) { return "Invitation to visit the United Kingdom — " + V(f.fullName, "full name"); },
        addressee: function (f) {
          return /ETA/.test(f.route || "")
            ? ["To Whom It May Concern", "UK Border Force"]
            : ["The Entry Clearance Officer", V(f.post, "UK visa application centre")];
        },
        opening: function (f) {
          return V(f.orgLegal, "issuing entity") + ", " + V(f.orgRole, "role of the entity") +
            ", invites the person named below to the United Kingdom to take part in " + V(f.program, "programme name") +
            " from " + V(f.startDate, "start date") + " to " + V(f.endDate, "end date") + " at " +
            V(f.venue, "address where activities take place") + ".";
        },
        clauses: function (f) {
          return [
            { h: "Permitted activities" },
            { p: "These activities fall within the permitted activities for visitors set out in Appendix Visitor to the " +
                 "Immigration Rules — specifically " + V(f.permitted, "which permitted activities apply") + "." },
            { h: "Status of the visitor" },
            { p: V(f.fullName, "full name") + " will not work in the United Kingdom, will not undertake employment or " +
                 "self-employment here, will not provide goods or services to the public, and will not receive payment " +
                 "from a United Kingdom source for work done during the visit. There is no employment relationship " +
                 "between " + V(f.orgLegal, "issuing entity") + " and the participant." },
            { p: "The visitor route carries no sponsor licence and no Certificate of Sponsorship, and this letter is " +
                 "offered as supporting evidence rather than as any form of sponsorship undertaking." },
            { h: "Costs and accommodation" },
            costsBlock(f)
          ];
        },
        enclosures: function () {
          return ["Programme description and cohort dates", "Certificate of incorporation or registration of the inviting organisation", "Confirmation of the accommodation arrangements"];
        },
        checks: [
          function sixMonths(f) {
            var n = spanDays(f.startDate, f.endDate);
            if (n !== null && n > 183) {
              return { level: "stop", msg: "This visit is " + n + " days. A Standard Visitor may normally be admitted for at most six months. A longer stay needs a different route — Global Talent or Expansion Worker are the usual candidates." };
            }
            return null;
          },
          function etaReminder(f) {
            if (/ETA/.test(f.route || "")) {
              return { level: "note", msg: "Confirm the participant has applied for an Electronic Travel Authorisation before travel. Since 25 February 2026 it is enforced for non-visa nationals, and carriers refuse boarding without one." };
            }
            return null;
          },
          function sponsorWord(f) {
            return { level: "note", msg: "Avoid calling the organisation the applicant's \"sponsor\" anywhere in the file. On the UK visitor route no sponsorship framework exists, and the word invites the caseworker to look for a licence that does not exist." };
          }
        ]
      })
    ]
  };

  /* ── FRANCE — Paris node ──────────────────────────────────────────────── */
  var FR = {
    id: "fr", name: "France", city: "Paris", flag: "🇫🇷",
    node: "Paris · the continental node",
    blurb: "Schengen short-stay, with the attestation d'accueil trap for private accommodation.",
    guidance: {
      routes: [
        "<b>Schengen short-stay visa (type C)</b> — up to 90 days in any 180-day period, counted across the whole Schengen area.",
        "<b>Attestation d'accueil</b> — where the participant stays in private accommodation rather than a hotel, the host in France obtains this from the mairie of their commune. It is a validated municipal document, not a letter the host writes.",
        "<b>Talent Passport</b> or a national long-stay visa — for anything past 90 days or for remunerated activity."
      ],
      hostDuties: [
        "Provide a letter from the French correspondent describing the activity, purpose, duration and location precisely.",
        "Where private accommodation is used, apply to the mairie for the attestation d'accueil in good time — it is issued by the commune, carries a fee, and takes weeks.",
        "State whether the inviting organisation undertakes to cover the visitor's costs."
      ],
      mustInclude: [
        "The applicant's identity exactly as in the passport, with date of birth and passport number.",
        "The activity, its purpose, its duration and the precise location — a vague description is the usual ground of refusal.",
        "The dates of arrival and departure.",
        "Where the applicant will stay, and whether an attestation d'accueil applies.",
        "The undertaking on costs, and the host's registration details and contact."
      ],
      watchOuts: [
        "<b>The 90 days are Schengen-wide.</b> The cohort is set at " + PROGRAM.days + " days, which fits — but only for a participant who has spent no more than " + (90 - PROGRAM.days) + " day" + ((90 - PROGRAM.days) === 1 ? "" : "s") + " anywhere in the Schengen area in the preceding 180 days. Time in any Schengen state counts against the same rolling allowance, so a single prior conference trip can be enough to break it. Ask before you commit to dates.",
        "<b>Travel medical insurance of €30,000 is a legal condition</b> under Article 15 of the Visa Code, valid across the Schengen area for the whole stay, covering emergency treatment and repatriation.",
        "<b>An invitation letter is not an attestation d'accueil.</b> If the participant stays in private accommodation, only the mairie-validated document will do.",
        "<b>No remunerated activity on a short-stay visa.</b> Paid work needs a work authorisation and the corresponding long-stay route."
      ],
      sources: [
        { label: "Business trip — France-Visas", url: "https://france-visas.gouv.fr/en/voyage-d-affaires" },
        { label: "Schengen short-stay visa — service-public.fr", url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F16146?lang=en" }
      ]
    },
    templates: [
      visitorTemplate({
        id: "invite", name: "Business Invitation (Lettre d'Invitation)", tag: "Schengen C",
        note: "The French correspondent's letter. Must describe the activity, purpose, duration and location precisely.",
        fields: [
          { key: "housing", label: "Accommodation type", type: "select", options: ["Hotel or commercial accommodation", "Private accommodation — attestation d'accueil required"], req: true },
          { key: "attestation", label: "Attestation d'accueil status (if private accommodation)", ph: "e.g. applied for at the Mairie du 11e arrondissement on 3 July 2026" }
        ],
        subject: function (f) { return "Invitation — " + V(f.fullName, "full name") + " — " + V(f.program, "programme name"); },
        addressee: function (f) { return ["Monsieur, Madame le Consul", V(f.post, "French consulate or visa centre")]; },
        opening: function (f) {
          return V(f.orgLegal, "issuing entity") + ", " + V(f.orgRole, "role of the entity") +
            ", invites the person named below to France to take part in " + V(f.program, "programme name") +
            ", which takes place at " + V(f.venue, "address where activities take place") + " from " +
            V(f.startDate, "start date") + " to " + V(f.endDate, "end date") + ".";
        },
        clauses: function (f) {
          var priv = /Private/.test(f.housing || "");
          return [
            { h: "Nature and duration of the activity" },
            { p: "The purpose of the visit is professional participation in the programme described above. The activity " +
                 "runs for the dates stated, at the single location stated, and is not remunerated in France: the " +
                 "participant will receive no salary, fee or other payment from a French source and will enter into no " +
                 "employment relationship with any French entity." },
            { h: "Accommodation" },
            priv
              ? { p: "The participant will stay in private accommodation at " + V(f.accommodation, "accommodation address") +
                     ". An attestation d'accueil is required for this arrangement and its status is: " +
                     V(f.attestation, "attestation d'accueil status") + ". This letter does not substitute for that document." }
              : { p: "The participant will stay in commercial accommodation at " + V(f.accommodation, "accommodation address") +
                     ", so no attestation d'accueil is required." },
            { h: "Costs and insurance" },
            costsBlock(f, "The participant holds travel medical insurance valid throughout the Schengen area for the whole of the stay, with cover of at least €30,000 for emergency medical treatment and repatriation, as required by Article 15 of the Visa Code."),
            { p: "We understand that the permitted stay is at most 90 days in any 180-day period, counted across the " +
                 "whole Schengen area, and the dates above are set within that limit." }
          ];
        },
        enclosures: function (f) {
          var list = ["Programme description and cohort dates", "Extrait Kbis or equivalent registration document of the inviting organisation", "Evidence of travel medical insurance"];
          if (/Private/.test(f.housing || "")) list.push("Attestation d'accueil validated by the mairie");
          return list;
        },
        checks: SCHENGEN_CHECKS.concat([
          function attestationMissing(f) {
            if (/Private/.test(f.housing || "") && !has(f.attestation)) {
              return { level: "stop", msg: "Private accommodation requires an attestation d'accueil validated by the mairie of the host's commune. It is not something the organisation can issue, it carries a fee, and it takes weeks. Record its status before sending this letter." };
            }
            return null;
          }
        ])
      })
    ]
  };

  /* ── AUSTRALIA — Melbourne node ──────────────────────────────────────── */
  var AU = {
    id: "au", name: "Australia", city: "Melbourne, Victoria", flag: "🇦🇺",
    node: "Melbourne · the southern node",
    blurb: "Business Visitor stream is well-defined — and narrow on what counts as business.",
    guidance: {
      routes: [
        "<b>Visitor visa (subclass 600), Business Visitor stream</b> — the standard route for meetings, negotiations, conferences and exploratory business. Typically granted for up to three months.",
        "<b>Visitor visa (subclass 600), Tourist stream</b> — where the purpose is not business.",
        "<b>Temporary Activity (subclass 408)</b> or a skilled route — where the participant will actually work."
      ],
      hostDuties: [
        "Provide a letter of invitation from the host organisation in Australia setting out the business purpose.",
        "The applicant completes Form 1415 for the Business Visitor stream.",
        "State whether the host meets any of the applicant's costs, and be prepared to evidence it."
      ],
      mustInclude: [
        "The applicant's identity as in the passport, with date of birth and passport number.",
        "The business purpose of the visit and the specific engagements, with dates.",
        "The host organisation's Australian Business Number, address and contact details.",
        "Confirmation that the applicant will not work or provide goods or services to the public.",
        "Who bears the costs of travel, accommodation and living expenses."
      ],
      watchOuts: [
        "<b>Business visitor is not work.</b> The stream covers meetings, negotiations, conferences and general business enquiry. Hands-on work, selling goods or services to the public, or filling a role in an Australian business all fall outside it.",
        "<b>Three months is the usual grant</b>, so a twelve-week programme sits right at the edge. Build in the travel days.",
        "<b>Health and character requirements apply</b>, and a health examination can add weeks. Do not plan on a fast grant."
      ],
      sources: [
        { label: "Visitor visa (subclass 600) Business Visitor stream — Home Affairs", url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/visitor-600/business-visitor-stream" },
        { label: "Business Visitor stream document checklist", url: "https://static.tlscontact.com/media/global/ww/au/visitor_visa_subclass_600_-_document_checklist_-_business_stream.pdf" }
      ]
    },
    templates: [
      visitorTemplate({
        id: "invite", name: "Business Visitor Invitation (Subclass 600)", tag: "SC 600",
        note: "Host organisation letter for the Business Visitor stream. Pairs with the applicant's Form 1415.",
        fields: [
          { key: "abn", label: "Australian Business Number of the host entity", ph: "e.g. 12 345 678 901", req: true },
          { key: "engagements", label: "Specific engagements with dates (one per line)", ph: "22 Sep 2026 — cohort induction, Melbourne node\n14 Oct 2026 — partner meetings, Parkville biomedical precinct\n8 Dec 2026 — cohort showcase", multiline: true, req: true }
        ],
        subject: function (f) { return "Letter of invitation — business visit by " + V(f.fullName, "full name"); },
        addressee: function (f) { return ["The Visa Officer", V(f.post, "Department of Home Affairs")]; },
        opening: function (f) {
          return V(f.orgLegal, "issuing entity") + " (ABN " + V(f.abn, "Australian Business Number") + "), " +
            V(f.orgRole, "role of the entity") + ", invites the person named below to Australia for a temporary " +
            "business visit in connection with " + V(f.program, "programme name") + ", from " +
            V(f.startDate, "start date") + " to " + V(f.endDate, "end date") + " at " +
            V(f.venue, "address where activities take place") + ".";
        },
        clauses: function (f) {
          return [
            { h: "Scheduled engagements" },
            { list: LIST(f.engagements, ["[Date — engagement, location]", "[Date — engagement, location]"]) },
            { h: "Status of the visitor" },
            { p: "The purpose of the visit is business in the sense used in the Business Visitor stream: attending " +
                 "meetings and conferences, conducting negotiations, and making general business or employment " +
                 "enquiries. " + V(f.fullName, "full name") + " will not work in Australia, will not provide goods or " +
                 "services to the public, will not fill a position in an Australian business, and will receive no " +
                 "salary or other remuneration from an Australian source." },
            { h: "Costs" },
            costsBlock(f)
          ];
        },
        enclosures: function () {
          return ["Programme description and cohort dates", "Evidence of the host organisation's registration and ABN", "Itinerary of scheduled engagements"];
        },
        checks: [
          function threeMonths(f) {
            var n = spanDays(f.startDate, f.endDate);
            if (n !== null && n > 90) {
              return { level: "warn", msg: "This visit is " + n + " days. The Business Visitor stream is typically granted for up to three months, so a longer request may be cut back or refused. Either trim the dates or make the case for the longer period explicitly in the application." };
            }
            return null;
          },
          function notWork(f) {
            return { level: "note", msg: "If the participant will do hands-on work at the Melbourne node rather than attend meetings, the Business Visitor stream is the wrong instrument — look at Temporary Activity (subclass 408) instead." };
          },
          function form1415(f) {
            return { level: "note", msg: "Remind the applicant to complete Form 1415 for the Business Visitor stream. This letter supports that form; it does not replace it." };
          },
          ninetyDayMargin
        ]
      })
    ]
  };

  /* ── CHINA — Shanghai and Shenzhen nodes ─────────────────────────────── */
  var CN = {
    id: "cn", name: "China", city: "Shanghai / Shenzhen", flag: "🇨🇳",
    node: "Shanghai · Shenzhen",
    blurb: "The invitation must come from a registered Chinese entity — an overseas letterhead will not do.",
    guidance: {
      routes: [
        "<b>M visa</b> — commercial and trade activities.",
        "<b>F visa</b> — exchange, visit and study activities of a non-commercial nature, which is the usual fit for a research or academic exchange.",
        "<b>Z visa</b> — the only route for work. It requires a work permit notification issued to the employer before the visa application, and cannot be substituted by an M or F visa."
      ],
      hostDuties: [
        "The invitation must be issued by an entity registered in China. A letter on an overseas letterhead does not satisfy the requirement.",
        "The letter is typed, printed, signed by the legal representative or an authorised officer, and stamped with the entity's official seal (公章).",
        "The entity's own contact details and address must appear, so the mission can verify the invitation.",
        "For work, the employer obtains the work permit notification first — the invitation letter does not stand in for it."
      ],
      mustInclude: [
        "<b>Applicant block</b> — full name as in the passport, sex, date of birth, nationality, occupation and passport number.",
        "<b>Visit block</b> — purpose of the visit, dates of arrival and departure, places to be visited, number of entries sought, and who bears the costs.",
        "<b>Inviter block</b> — the entity's name, address, telephone, the signer's name and position, the date, the signature and the official seal."
      ],
      watchOuts: [
        "<b>Handwritten letters are commonly rejected.</b> Type it, print it, sign it, seal it.",
        "<b>Every data point must match the passport exactly.</b> A transposed digit in the passport number is a routine ground for return of the application.",
        "<b>M and F do not permit work.</b> Any remunerated activity, or work for a Chinese entity, needs a Z visa and a work permit.",
        "<b>Some consulates want the original</b> even where a scan is accepted for the online application. Ask the post before relying on a PDF."
      ],
      sources: [
        { label: "Invitation letter for a China visa — requirements and samples", url: "https://www.chinadiscovery.com/chinese-visa/invitation-letter.html" },
        { label: "China visa document checklist", url: "https://www.chinavisainfo.com/blog/china-visa-document-checklist-2026/" }
      ]
    },
    templates: [
      visitorTemplate({
        id: "invite", name: "Invitation Letter (M / F Visa)", tag: "M · F",
        note: "Must be issued by a China-registered entity, typed, signed and stamped with the official seal.",
        fields: [
          { key: "visaType", label: "Visa type", type: "select", options: ["F — exchange, visit and study (non-commercial)", "M — commercial and trade"], req: true },
          { key: "sex", label: "Sex as recorded in the passport", ph: "as printed in the passport", req: true },
          { key: "cnEntity", label: "Name of the China-registered inviting entity", ph: "the registered Chinese entity issuing this letter", req: true },
          { key: "cnLicence", label: "Unified social credit code of the Chinese entity", ph: "18-character unified social credit code", req: true },
          { key: "entries", label: "Number of entries sought", type: "select", options: ["Single entry", "Double entry", "Multiple entries"], req: true },
          { key: "places", label: "Places to be visited in China (one per line)", ph: "Shanghai — Zhangjiang Science City\nShenzhen — partner laboratory visits", multiline: true, req: true }
        ],
        subject: function (f) { return "Invitation letter — " + V(f.fullName, "full name") + " — " + (/^M/.test(f.visaType || "") ? "M visa" : "F visa"); },
        addressee: function (f) { return ["The Visa Officer", V(f.post, "Chinese embassy or consulate")]; },
        opening: function (f) {
          return V(f.cnEntity, "China-registered inviting entity") + " (unified social credit code " +
            V(f.cnLicence, "unified social credit code") + ") invites the person named below to visit China from " +
            V(f.startDate, "start date") + " to " + V(f.endDate, "end date") + " in connection with " +
            V(f.program, "programme name") + ", and applies for a " + (/^M/.test(f.visaType || "") ? "M" : "F") +
            " visa to be issued on that basis.";
        },
        rows: function (f) { return [["Sex", V(f.sex, "sex as in passport")]]; },
        clauses: function (f) {
          return [
            { h: "Details of the visit" },
            { kv: [
              ["Visa type sought", V(f.visaType, "visa type")],
              ["Entries sought", V(f.entries, "number of entries")],
              ["Date of arrival", V(f.startDate, "start date")],
              ["Date of departure", V(f.endDate, "end date")],
              ["Inviting entity in China", V(f.cnEntity, "China-registered inviting entity")],
              ["Unified social credit code", V(f.cnLicence, "unified social credit code")]
            ] },
            { p: "Places to be visited:" },
            { list: LIST(f.places, ["[City — place to be visited]"]) },
            { h: "Status of the visitor" },
            { p: "The purpose of the visit is " + (/^M/.test(f.visaType || "") ? "commercial and trade activity" : "non-commercial exchange, visit and study activity") +
                 ". " + V(f.fullName, "full name") + " will not take up employment in China, will not receive any " +
                 "salary or other remuneration from a Chinese source, and will leave China on or before the expiry " +
                 "of the permitted period of stay." },
            { h: "Costs" },
            costsBlock(f),
            { p: "This letter is issued on the letterhead of the inviting entity, signed by an authorised officer and " +
                 "affixed with the entity's official seal." }
          ];
        },
        enclosures: function () {
          return ["Copy of the business licence of the inviting entity", "Programme description and cohort dates", "Itinerary of places to be visited"];
        },
        checks: [
          function chineseEntityRequired(f) {
            if (!has(f.cnEntity) || !has(f.cnLicence)) {
              return { level: "stop", msg: "A China visa invitation must be issued by an entity registered in China, identified by its unified social credit code. A letter on an overseas letterhead does not meet the requirement, however well drafted." };
            }
            return null;
          },
          function sealRequired(f) {
            return { level: "warn", msg: "Print this letter on the Chinese entity's letterhead, have it signed by the legal representative or an authorised officer, and affix the official seal (公章). An unsealed invitation is routinely rejected, and handwritten letters are not accepted." };
          },
          function noWork(f) {
            if (f.costWho === "host" && /salary|wage|stipend|pay/i.test(f.costDetail || "")) {
              return { level: "stop", msg: "The cost note describes payment to the participant. M and F visas do not permit employment or remuneration from a Chinese source — that requires a Z visa and a work permit notification obtained by the employer before the visa application." };
            }
            return null;
          },
          function exactMatch(f) {
            return { level: "note", msg: "Check every identity field character by character against the passport biodata page. Mismatched names or passport numbers are the most common reason these letters are returned." };
          }
        ]
      })
    ]
  };

  /* ── SWITZERLAND — Basel (candidate node) ────────────────────────────── */
  var CH = {
    id: "ch", name: "Switzerland", city: "Basel", flag: "🇨🇭",
    node: "Basel · candidate node",
    blurb: "Schengen rules, plus a cantonal declaration of sponsorship that cannot be downloaded.",
    guidance: {
      routes: [
        "<b>Schengen short-stay visa (type C)</b> — up to 90 days in any 180-day period, counted across the whole Schengen area.",
        "<b>National long-stay visa (type D) and residence permit</b> — for anything longer, or for remunerated activity. Work authorisation is decided by the canton before the visa.",
        "Many nationalities are visa-exempt for short stays, in which case the invitation letter is evidence at the border rather than for a visa file."
      ],
      hostDuties: [
        "Write the letter of invitation to the Swiss representation handling the application. The State Secretariat for Migration issues guidance on it but prescribes no form.",
        "Write it in one of Switzerland's official languages — German, French or Italian. Some representations accept English; confirm with the post rather than assuming.",
        "Where the applicant lacks sufficient means, the representation may require a declaration of sponsorship (Verpflichtungserklärung). The form comes from the cantonal migration authority and is not published online — request it early.",
        "Expect the canton to assess the guarantor's solvency before accepting the declaration."
      ],
      mustInclude: [
        "The applicant's identity as in the passport, with date of birth, nationality and passport number.",
        "The relationship between the host and the applicant and how it arose.",
        "The purpose and precise dates of the visit, and the address where the applicant will stay.",
        "Whether the host covers the applicant's costs, and if so which.",
        "The host's full name or entity name, address, telephone and the signer's position."
      ],
      watchOuts: [
        "<b>The declaration of sponsorship is not a letter you write.</b> It is a cantonal form, obtained from the migration authority, with a solvency assessment behind it and a liability period attached. The coverage amount and the period are set by the authority — take them from the form, not from a template.",
        "<b>The 90 days are Schengen-wide.</b> At " + PROGRAM.days + " days the cohort leaves " + (90 - PROGRAM.days) + " day" + ((90 - PROGRAM.days) === 1 ? "" : "s") + " of allowance, and time in any Schengen state in the preceding 180 days counts against it.",
        "<b>Travel medical insurance of €30,000</b> valid across the Schengen area is a legal condition of the visa.",
        "<b>Work needs cantonal authorisation first.</b> The visa follows the labour-market decision, not the other way round."
      ],
      sources: [
        { label: "Letter of invitation and declaration of sponsorship — Swiss representation guidance", url: "https://static.tlscontact.com/media/th/bkk/ch/mb-verpflicht-erklaerung-e.pdf" },
        { label: "Who needs a visa invitation letter for Switzerland", url: "https://www.axa-schengen.com/en/visa/requirements/documents/invitation-switzerland" }
      ]
    },
    templates: [
      visitorTemplate({
        id: "invite", name: "Letter of Invitation (Schengen)", tag: "Schengen C",
        note: "Addressed to the Swiss representation. Note the cantonal declaration of sponsorship if we are covering costs.",
        fields: [
          { key: "canton", label: "Canton where the visit takes place", ph: "e.g. Basel-Stadt", req: true },
          { key: "language", label: "Language of the letter as sent", type: "select", options: ["German", "French", "Italian", "English — confirmed acceptable by the post"], req: true },
          { key: "sponsorship", label: "Declaration of sponsorship (Verpflichtungserklärung)", type: "select", options: ["Not required — the participant funds the visit", "Requested from the cantonal migration authority", "Completed and enclosed"], req: true },
          { key: "relationship", label: "How the relationship arose", ph: "e.g. selected for Cohort 3 in June 2026 following a competitive review", req: true }
        ],
        subject: function (f) { return "Letter of invitation — " + V(f.fullName, "full name"); },
        addressee: function (f) { return ["The Visa Section", V(f.post, "Swiss embassy or consulate")]; },
        opening: function (f) {
          return V(f.orgLegal, "issuing entity") + ", " + V(f.orgRole, "role of the entity") +
            ", invites the person named below to Switzerland to take part in " + V(f.program, "programme name") +
            " in the canton of " + V(f.canton, "canton") + ", from " + V(f.startDate, "start date") + " to " +
            V(f.endDate, "end date") + ", at " + V(f.venue, "address where activities take place") + ".";
        },
        clauses: function (f) {
          var sp = f.sponsorship || "";
          return [
            { h: "Relationship and purpose" },
            { p: V(f.relationship, "how the relationship arose") + ". The visit is for professional participation in " +
                 "the programme described above and involves no remunerated activity in Switzerland: the participant " +
                 "will receive no salary or other payment from a Swiss source and will enter into no employment " +
                 "relationship with any Swiss entity." },
            { h: "Costs, sponsorship and insurance" },
            costsBlock(f, "The participant holds travel medical insurance valid throughout the Schengen area for the whole of the stay, with cover of at least €30,000 for emergency medical treatment and repatriation."),
            /Not required/.test(sp)
              ? { p: "No declaration of sponsorship is offered: the participant funds the visit from their own means " +
                     "and holds evidence of sufficient funds for the whole of the intended stay." }
              : { p: "A declaration of sponsorship (Verpflichtungserklärung) has been " +
                     (/Completed/.test(sp) ? "completed and is enclosed with this letter" : "requested from the migration authority of the canton of " + V(f.canton, "canton")) +
                     ". Its scope, the amount guaranteed and the period of liability are as set out in that form by " +
                     "the cantonal authority, and we accept them as stated there." },
            { p: "We understand that the permitted stay is at most 90 days in any 180-day period across the whole " +
                 "Schengen area, and the dates above are set within that limit." }
          ];
        },
        enclosures: function (f) {
          var list = ["Programme description and cohort dates", "Commercial register extract of the inviting organisation", "Evidence of travel medical insurance"];
          if (/Completed/.test(f.sponsorship || "")) list.push("Declaration of sponsorship (Verpflichtungserklärung)");
          return list;
        },
        checks: SCHENGEN_CHECKS.concat([
          function languageWarning(f) {
            if (/^English/.test(f.language || "")) {
              return { level: "warn", msg: "The State Secretariat for Migration expects the letter of invitation in German, French or Italian. Some representations accept English — confirm with the specific post in writing before sending an English-only letter, and translate it if there is any doubt." };
            }
            return null;
          },
          function sponsorshipForm(f) {
            if (/Requested/.test(f.sponsorship || "")) {
              return { level: "warn", msg: "The declaration of sponsorship is still outstanding. The form is issued by the cantonal migration authority, is not available online, and the canton assesses the guarantor's solvency before accepting it. Do not treat this letter as covering the means requirement until the form is in hand." };
            }
            return null;
          }
        ])
      })
    ]
  };

  /* ── registry ─────────────────────────────────────────────────────────
     Order is the order of the dropdown. Add a jurisdiction by writing the
     object above and adding it here. */
  var JURISDICTIONS = [US, JP, MX, GB, FR, AU, CN, CH];

  return {
    PROGRAM: PROGRAM,
    ORGS: ORGS,
    JURISDICTIONS: JURISDICTIONS,
    APPLICANT_FIELDS: APPLICANT_FIELDS,
    HOST_FIELDS: HOST_FIELDS,
    COST_OPTIONS: COST_OPTIONS,
    GLOBAL_CHECKS: GLOBAL_CHECKS,
    helpers: { V: V, has: has, FIRST: FIRST, LIST: LIST, spanDays: spanDays }
  };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = VISA_DATA; }
