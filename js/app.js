/* ==========================================================================
   EXAM PREP HQ: THE APP
   Built to feel simple for a middle schooler working on their own:
   a 5-step guided setup, a "Today" home page, and five tabs.
   Optional extras (study guides, MindPrint, tutorials, Google Calendar)
   are suggested one at a time after the plan exists.
   ========================================================================== */
(function () {
  const CFG = window.PREP_CONFIG;
  const C = window.CONTENT;
  const S = window.Store;
  const { D, uid } = S;
  const st = () => S.state;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const TABS = [
    { id: "today", label: "Today", short: "Today", icon: "🏠" },
    { id: "plan", label: "My Study Plan", short: "Study plan", icon: "📋" },
    { id: "week", label: "My Weekly Schedule", short: "Schedule", icon: "🗓️" },
    { id: "classes", label: "My classes", short: "Classes", icon: "📚" },
    { id: "tips", label: "Tips", short: "Tips", icon: "💡" }
  ];

  const WIZ_STEPS = 5;

  // Study-time choices (students pick one instead of typing times).
  const WEEKDAY_TIMES = [
    { start: "16:00", end: "18:00", label: "After tutorials", sub: "4 to 6 p.m." },
    { start: "18:30", end: "20:30", label: "After dinner", sub: "6:30 to 8:30 p.m." },
    { start: "16:00", end: "20:30", label: "Either one", sub: "4 to 8:30 p.m." }
  ];
  const WEEKEND_TIMES = [
    { start: "10:00", end: "12:30", label: "Mornings", sub: "10 a.m. to 12:30 p.m." },
    { start: "13:00", end: "17:00", label: "Afternoons", sub: "1 to 5 p.m." },
    { start: "10:00", end: "17:00", label: "Either one", sub: "10 a.m. to 5 p.m." }
  ];

  const ui = { weekOffset: 0, addDate: "", addMode: "", addFixedMode: false, dayChecks: {}, tutClass: null, busyType: "weekly", busyLabel: "", busyOpen: false, openClass: null, showPast: false, flipped: {}, examChecks: {}, mpEdit: false, mpAll: false, sync: "local" };

  const BADGES = [
    { id: "plan", e: "🗺️", name: "Plan made", test: s => !!s.plan },
    { id: "first", e: "⭐", name: "First session", test: s => doneCount(s) >= 1 },
    { id: "five", e: "🔥", name: "Five done", test: s => doneCount(s) >= 5 },
    { id: "guide", e: "📄", name: "Study guide added", test: s => Object.values(s.classes).some(c => c.topics.length) },
    { id: "tutorial", e: "🙋", name: "Went to tutorials", test: s => (s.tutorials || []).some(t => t.done) },
    { id: "half", e: "🏔️", name: "Halfway there", test: s => pct(s) >= 50 },
    { id: "ready", e: "🏆", name: "Exam ready", test: s => !!s.plan && s.plan.sessions.filter(x => x.kind === "test").length >= 5 && s.plan.sessions.filter(x => x.kind === "test").every(x => x.done) }
  ];

  function doneCount(s) { return s.plan ? s.plan.sessions.filter(x => x.done).length : 0; }
  function pct(s) { return s.plan && s.plan.sessions.length ? Math.round(100 * doneCount(s) / s.plan.sessions.length) : 0; }
  function askTopics(classId) { return window.Exports.askTopics(classId); }

  /* ---------- Saving, badges, feedback ---------- */
  let autoTimer = null;
  function save(opts = {}) {
    S.save();
    checkBadges();
    // When something that affects the plan changes, quietly rebuild it (finished sessions stay checked off).
    if (opts.planInputs && st().plan) {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        st().plan = window.Planner.generate(st());
        st().planStale = false;
        S.save();
        const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
        if (!$("#focus").open && !$("#modal").open && !typing) render();
      }, 700);
    }
  }

  function checkBadges() {
    const s = st();
    const fresh = BADGES.filter(b => !s.earnedBadges.includes(b.id) && b.test(s));
    if (!fresh.length) return;
    fresh.forEach(b => s.earnedBadges.push(b.id));
    S.persistLocal();
    toast(fresh.length === 1 ? `${fresh[0].e} Badge earned: ${fresh[0].name}` : `${fresh.map(b => b.e).join(" ")} ${fresh.length} badges earned`);
    confetti();
  }

  let toastTimer;
  let undoFn = null;
  function toast(msg, onUndo) {
    const t = $("#toast");
    undoFn = onUndo || null;
    t.innerHTML = `<span>${esc(msg)}</span>${onUndo ? ' <button class="toast-undo" data-act="undo">Undo</button>' : ""}`;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove("show"); undoFn = null; }, onUndo ? 7000 : 3200);
  }

  // Run a change that can be undone: snapshot first, then show "Undo" in the message.
  function undoable(msg, fn) {
    const snap = JSON.stringify(st());
    fn();
    toast(msg, () => {
      clearTimeout(autoTimer);
      S.replace(JSON.parse(snap));
      S.save({ now: true });
      closeModal();
      render();
      toast("Undone.");
    });
  }

  function confetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const wrap = document.createElement("div");
    wrap.className = "confetti";
    const colors = ["#9d2235", "#ffc513", "#6fccdd", "#47a972", "#f4a72a", "#0d2b46"];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement("i");
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = Math.random() * 0.4 + "s";
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 1800);
  }
  window.addEventListener("hashchange", () => document.querySelectorAll(".confetti").forEach(c => c.remove()));

  function openModal(html) { const m = $("#modal"); m.innerHTML = html; if (!m.open) m.showModal(); }
  function closeModal() { clearInterval(breatheTimer); const m = $("#modal"); if (m.open) m.close(); }

  /* ---------- Display settings: text size, easier font, high contrast (saved on this device) ---------- */
  const DISPLAY_KEY = `${CFG.STORAGE_PREFIX || "examPrepHQ"}.display`;
  function getDisplay() { try { return Object.assign({ size: "1", font: "default", contrast: "off" }, JSON.parse(localStorage.getItem(DISPLAY_KEY) || "{}")); } catch (e) { return { size: "1", font: "default", contrast: "off" }; } }
  function applyDisplay() {
    const d = getDisplay(), root = document.documentElement;
    root.style.fontSize = `${Number(d.size) * 100}%`;
    root.classList.toggle("hc", d.contrast === "on");
    root.classList.toggle("readable", d.font === "readable");
    if (d.font === "readable" && !document.getElementById("readable-font")) {
      const l = document.createElement("link");
      l.id = "readable-font"; l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap";
      document.head.appendChild(l);
    }
  }
  function setDisplay(key, v) {
    const d = getDisplay(); d[key] = v;
    try { localStorage.setItem(DISPLAY_KEY, JSON.stringify(d)); } catch (e) { /* ignore */ }
    applyDisplay();
  }
  function displayModal() {
    const d = getDisplay();
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button type="button" data-act="display-set" data-key="${key}" data-v="${v}" aria-pressed="${d[key] === v}">${l}</button>`).join("")}</div>`;
    openModal(`<div class="modal-body"><h3>Text and display</h3>
      <div class="field"><label>Text size</label>${seg("size", [["1", "Normal"], ["1.15", "Large"], ["1.3", "Extra large"]])}</div>
      <div class="field"><label>Font</label>${seg("font", [["default", "Standard"], ["readable", "Easier to read"]])}</div>
      <div class="field"><label>Contrast</label>${seg("contrast", [["off", "Standard"], ["on", "High contrast"]])}</div>
      <p class="xs muted">These settings are saved on this device. Tip: tap 🔊 next to any instruction to hear it read aloud.</p></div>
      <div class="modal-foot"><button class="btn" data-act="modal-close">Done</button></div>`);
  }

  /* ---------- Demo mode (for advisory): a made-up student, rebuilt fresh with dates from today ---------- */
  function buildDemo() {
    const s = st();
    const today = D.today();
    const weekdayFrom = n => { let d = D.addDays(today, n); while (D.isWeekend(d)) d = D.addDays(d, 1); return d; };
    s.profile = { name: "Jordan", gradeLevel: "10", langChoice: "World Language", langName: "" };
    const t = (text, conf, details = [], resources = []) => ({ id: uid(), text, conf, details, resources });
    Object.assign(s.classes.english, { grade: "B+", confidence: 3, topics: [
      t("Rhetorical Devices", 2, ["Ethos, pathos, and logos", "Anaphora", "Rhetorical questions"], ["Notes", "Class handouts"]),
      t("The Great Gatsby", 3, ["Characters", "Symbols", "Themes"], ["Your annotations"]),
      t("Argumentative Essay", 3, ["Thesis and claims", "Evidence and commentary"], ["Past essays and teacher feedback"])] });
    Object.assign(s.classes.math, { grade: "C+", confidence: 2, topics: [
      t("Quadratic Functions", 2, ["Graphing parabolas", "Vertex form", "Solving by factoring"], ["Unit 4 notes", "Practice worksheets"]),
      t("Systems of Equations", 3, ["Substitution", "Elimination"], ["Unit 3 notes"]),
      t("Exponent Rules", 2, ["Product and quotient rules", "Negative exponents"], ["Unit 5 notes"])] });
    Object.assign(s.classes.science, { grade: "B", confidence: 3, topics: [t("Stoichiometry", 2), t("Chemical Bonding", 3), t("The Periodic Table", 4)] });
    Object.assign(s.classes.social, { grade: "A-", confidence: 4 });
    Object.assign(s.classes.lang, { grade: "B+", confidence: 3 });
    Object.assign(s.classes.other1, { enabled: true, name: "AP Psychology", examDate: D.addDays(CFG.EXAMS.map(e => e.date).sort()[0], -1), grade: "B", confidence: 3,
      topics: [t("Research Methods", 3), t("Biological Bases of Behavior", 2), t("Sensation and Perception", 3)] });
    S.syncExams();
    s.busy = [{ id: uid(), label: "Basketball practice", type: "weekly", days: [1, 2, 4], start: "15:45", end: "17:45" }];
    s.tutorials = [{ id: uid(), classId: "math", date: weekdayFrom(2), start: (CFG.TUTORIAL_TIMES || [{}])[0].start || CFG.TUTORIAL_START, end: (CFG.TUTORIAL_TIMES || [{}])[0].end || CFG.TUTORIAL_END, done: false }];
    Object.assign(s.prefs, { startDate: today });
    s.accom = { extended: "none", customMinutes: "" };
    s.onboarded = true;
    s.plan = window.Planner.generate(s);
    S.persistLocal();
  }

  function demoBanner() {
    return S.demo ? `<div class="demo-banner" role="note"><b>Demo mode:</b> this is a made-up student, ${S.otherIds && S.otherIds.length ? "Jordan" : "Maya"}. Nothing here is saved to anyone's account.
      <button class="linkish" data-act="demo-reset">Reset demo</button> <a href="${location.pathname}">Exit demo</a></div>` : "";
  }

  /* ---------- Header ---------- */
  function renderBrand() {
    $("#brand").innerHTML = CFG.LOGO_URL
      ? `<img src="${esc(CFG.LOGO_URL)}" alt="${esc(CFG.SCHOOL_NAME)}"><span class="brand-text"><span class="brand-app">Exam Prep HQ</span></span>`
      : `<span class="brand-text"><span class="brand-school">${esc(`${CFG.SCHOOL_NAME} ${CFG.DIVISION}`.toUpperCase())}</span><span class="brand-app">Exam Prep HQ</span></span>`;
  }

  const startOverBtn = `<a class="btn small start-over" href="#tips/help" aria-label="Help: how do I…?"><span aria-hidden="true">?</span><span class="so-text">Help</span></a><button class="btn small start-over" data-act="display" aria-label="Text and display settings"><span aria-hidden="true">Aa</span></button><button class="btn small start-over" data-act="start-over" aria-label="Start over"><span aria-hidden="true">↺</span><span class="so-text">Start over</span></button>`;

  function renderAccount() {
    const a = $("#account");
    if (!window.Drive.enabled()) { a.innerHTML = `<span class="sync"><span class="sync-text">Saved on this device</span></span>${startOverBtn}`; return; }
    if (!window.Drive.user) { a.innerHTML = `${startOverBtn}<button class="btn light small" data-act="signin">Sign in with Google</button>`; return; }
    const labels = { saving: ["", "Saving..."], saved: ["ok", "Saved to Drive"], reconnect: ["warn", "Not saving"], error: ["warn", "Save failed"], local: ["", "Saved on this device"] };
    const [cls, txt] = labels[ui.sync] || labels.saved;
    const u = window.Drive.user;
    a.innerHTML = `
      <span class="sync ${cls}"><span class="sync-text">${txt}</span></span>
      ${ui.sync === "reconnect" || ui.sync === "error" ? `<button class="btn light small" data-act="reconnect">Reconnect</button>` : ""}
      ${startOverBtn}
      <button class="avatar" data-act="account-menu" aria-label="Account: ${esc(u.email || "")}">${esc((u.given_name || u.name || "?").charAt(0).toUpperCase())}</button>`;
  }

  function renderTabs(current) {
    $("#tabs").innerHTML = TABS.map(r =>
      `<a class="tab" href="#${r.id}" ${r.id === current ? 'aria-current="page"' : ""}><span class="t-icon" aria-hidden="true">${r.icon}</span><span class="t-long">${r.label}</span><span class="t-short" aria-hidden="true">${r.short}</span></a>`).join("");
  }

  /* ---------- Shared pieces ---------- */
  function colorVars(id) {
    const e = S.exam(id) || (S.allSlots ? S.allSlots().find(x => x.id === id) : null);
    return e ? `--c:${e.color};--tint:${e.tint};` : "--c:#9d2235;--tint:#f6e3e1;";
  }

  function confButtons(act, current, extra = "") {
    const sel = C.confidence.find(c => c.v === Number(current));
    return C.confidence.map(c =>
      `<button type="button" data-act="${act}" data-v="${c.v}" ${extra} aria-pressed="${Number(current) === c.v}" title="${c.label}" aria-label="${c.label}">${c.emoji}</button>`).join("")
      + `<span class="conf-label" aria-hidden="true">${sel ? sel.label : ""}</span>`;
  }

  // Read text aloud with the browser's built-in voice (free, works offline).
  function speak(text) {
    if (!("speechSynthesis" in window)) { toast("Read-aloud isn't available in this browser."); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }
  const speakBtn = text => ("speechSynthesis" in window) ? `<button type="button" class="icon-btn speak" data-act="speak" data-text="${esc(text)}" aria-label="Read aloud">🔊</button>` : "";

  // Pick your class level (filtered by grade). Choosing a course with a preloaded guide fills in its topics.
  function coursePicker(id, small) {
    const s = st(), c = s.classes[id];
    const groups = S.courseGroups(id, s.profile.gradeLevel);
    const opt = name => `<option value="${esc(name)}" ${c.course === name ? "selected" : ""}>${esc(name)}${window.GUIDES && window.GUIDES[name] ? " ✓" : ""}</option>`;
    return `<label class="${small ? "sr-only" : ""}" for="course-${id}">${small ? `${esc(S.exam(id).name)} class` : "My class"}</label>
      <select id="course-${id}" class="course-select" data-course="${id}">
        <option value="" ${c.course ? "" : "selected"}>Pick your class</option>
        ${Object.keys(window.GUIDES || {}).length ? `<option disabled>✓ = study guide ready</option>` : ""}
        ${c.course && !groups.some(g => g.list.includes(c.course)) ? opt(c.course) : ""}
        ${groups.length > 1 ? groups.map(g => `<optgroup label="${esc(g.group)}">${g.list.map(opt).join("")}</optgroup>`).join("") : (groups[0] ? groups[0].list.map(opt).join("") : "")}
      </select>`;
  }

  function guideStatus(id) {
    const c = st().classes[id], g = S.guideFor(id);
    if (!c.course) return "";
    if (g && c.guideFrom === c.course) return `<p class="guide-ok">✓ Study guide loaded${g.file ? ` · <a href="${esc(g.file)}" target="_blank" rel="noopener">Open the study guide</a>` : ""}</p>`;
    if (g) return `<p class="guide-ok"><button class="linkish small" data-act="use-guide" data-class="${id}">Use the ${esc(c.course)} study guide</button></p>`;
    return `<p class="xs muted guide-none">The ${esc(c.course)} study guide isn't loaded yet. It will appear here automatically when it's added, or you can upload it yourself below.</p>`;
  }

  // Letter grades only: a dropdown, so a number can never be entered.
  function gradePicker(id, value, label, small) {
    return `<label class="${small ? "sr-only" : ""}" for="g-${id}">${label}</label>
      <select id="g-${id}" class="grade-select" data-bind="classes.${id}.grade" data-plan="1" data-rerender="1">
        <option value="" ${value ? "" : "selected"}>${small ? "Grade" : "Not sure"}</option>
        ${S.letters().map(l => `<option value="${l}" ${value === l ? "selected" : ""}>${l}</option>`).join("")}
      </select>`;
  }

  function gates(small) {
    const today = D.today();
    return `<div class="gates ${small ? "small" : ""}" aria-label="Exam countdown">${CFG.EXAMS.map(e => {
      const n = D.diff(today, e.date);
      const num = n < 0 ? "✓" : String(n);
      const unit = n < 0 ? "done" : n === 0 ? "today" : n === 1 ? "day" : "days";
      return `<div class="gate ${n < 0 ? "past" : ""}" style="${colorVars(e.id)}">
        <div class="icon" aria-hidden="true">${e.icon}</div>
        <div class="num">${num}</div><div class="unit">${unit}</div>
        <div class="subj">${esc(S.className(e.id))}</div>
        <div class="when">${D.pretty(e.date, false)}</div>
        ${(() => { const first = S.partsFor(e.id).map(p => p.date).filter(d => d >= today).sort()[0]; return first ? `<div class="part-note">In class from ${D.pretty(first, false)}</div>` : ""; })()}
      </div>`;
    }).join("")}</div>`;
  }

  // Overview + numbered steps (falls back to the older single-paragraph tip).
  function stepsHTML(x, opts = {}) {
    const g = S.guideFor(x.classId);
    const c = st().classes[x.classId];
    const guideBtn = g && g.file && c && c.guideFrom === c.course ? `<a class="btn small ghost guide-btn" href="${esc(g.file)}" target="_blank" rel="noopener">📄 Open the study guide</a>` : "";
    if (!x.steps || !x.steps.length) return `<p class="s-tip">${esc(x.tip)} ${speakBtn(x.tip)}</p>${guideBtn}`;
    const list = `<ol class="s-steps ${opts.compact ? "compact" : ""}">${x.steps.map(t => `<li>${esc(t)}</li>`).join("")}</ol>`;
    return `<p class="s-overview">${esc(x.overview)} ${speakBtn(x.tip)}</p>
      ${opts.compact ? `<details class="steps-more"><summary>See the ${x.steps.length} steps</summary>${list}</details>` : list}
      ${x.extra ? `<p class="s-extra"><b>Tip:</b> ${esc(x.extra)}</p>` : ""}
      ${guideBtn}`;
  }

  // Short card for lists (My Study Plan, calendar): tap to open details.
  function sessionChip(x) {
    const late = !x.done && !x.folded && x.date < D.today();
    return `<div class="session compact ${x.done ? "done" : ""}" style="${colorVars(x.classId)}">
      <button class="check" data-act="toggle-session" data-id="${x.id}" aria-pressed="${!!x.done}" aria-label="Mark ${esc(x.title)} done">${x.done ? "✓" : ""}</button>
      <button class="s-open" data-act="details" data-id="${x.id}">
        <span class="time">${D.clock(x.start)}${late ? ' <span class="late-tag">Missed</span>' : ""}${x.folded ? ' <span class="done-tag">Fitted in</span>' : ""}</span>
        <span class="s-title">${esc(x.title)}</span>
        <span class="s-topic">${esc(x.topicText)}</span>
        <span class="chev" aria-hidden="true">›</span>
      </button>
    </div>`;
  }

  const ROUND = {
    gear: "Getting organized so studying goes faster.",
    rebuild: "First round: make your study tool for this topic.",
    quiz: "Practice round: pull it from memory, then check. This is what makes it stick.",
    mix: "Mix it up: practice this with other topics, the way the exam will.",
    review: "Quick review to keep it fresh.",
    test: "Practice exam: a run-through the day before the real thing."
  };

  // Details screen: what to do, materials, why now, and actions.
  function sessionDetails(id) {
    const x = st().plan && st().plan.sessions.find(y => y.id === id);
    if (!x) return;
    const late = !x.done && !x.folded && x.date < D.today();
    const res = x.resources || [];
    const inClass = x.classId !== "general";
    openModal(`
      <div class="details" style="${colorVars(x.classId)}">
        <div class="f-head">
          <div><div class="f-class">${esc(x.title)}</div><div class="f-topic">${esc(x.topicText)}</div></div>
          <button class="icon-btn f-close" data-act="modal-close" aria-label="Close">✕</button>
        </div>
        <div class="modal-body">
          <p class="d-when">${late ? '<span class="late-tag">Missed</span> ' : ""}${x.done ? '<span class="done-tag">✓ Done</span> ' : ""}${D.pretty(x.date)}, ${D.clock(x.start)} to ${D.clock(x.end)}</p>
          <h3 class="h4">What to do</h3>
          ${stepsHTML(x)}
          ${res.length ? `<h3 class="h4" style="margin-top:12px">From your study guide</h3><ul class="d-use">${res.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
          ${!x.steps ? `<p class="small muted">${esc(ROUND[x.kind] || "")}</p>` : ""}
        </div>
        <div class="modal-foot d-actions">
          ${!x.done ? `<button class="btn" data-act="details-start" data-id="${x.id}">▶ ${late ? "Do it now" : "Start"}</button>
            <button class="btn ghost" data-act="details-move" data-id="${x.id}">Move it</button>
            ${late ? `<button class="btn ghost" data-act="fold-session" data-id="${x.id}">Fit into next session</button>` : ""}` : ""}
          <button class="btn ghost" data-act="details-done" data-id="${x.id}">${x.done ? "Mark not done" : "✓ Mark done"}</button>
          ${inClass && !x.done ? `<button class="linkish small" data-act="details-stuck" data-id="${x.id}">🙋 Stuck? Ask my teacher</button>` : ""}
        </div>
      </div>`);
  }

  function sessionCard(x, opts = {}) {
    const late = !x.done && !x.folded && x.date < D.today();
    const res = (x.resources || []).slice(0, 3);
    const startable = !x.done && x.date <= D.today();
    return `<div class="session ${x.done ? "done" : ""}" style="${colorVars(x.classId)}">
      <button class="check" data-act="toggle-session" data-id="${x.id}" aria-pressed="${!!x.done}" aria-label="Mark ${esc(x.title)} done">${x.done ? "✓" : ""}</button>
      <div class="s-main">
        <div class="time">${D.clock(x.start)} to ${D.clock(x.end)}</div>
        <button class="s-title s-title-btn" data-act="details" data-id="${x.id}">${esc(x.title)}</button>
        <div class="s-topic">${esc(x.topicText)}</div>
        ${stepsHTML(x, { compact: true })}
        ${!x.done ? `<div class="s-actions">
          ${startable || opts.big ? `<button class="btn small start-btn" data-act="focus" data-id="${x.id}">▶ ${late ? "Do it now" : "Start"}</button>` : ""}
          <button class="linkish small" data-act="move-session" data-id="${x.id}">${late ? "Move to a new time" : "Can't do it? Move it"}</button>
          ${late ? `<button class="linkish small" data-act="fold-session" data-id="${x.id}">Fit it into my next ${esc(S.className(x.classId))} session</button>` : ""}
        </div>` : ""}

        ${x.folded ? `<p class="xs muted" style="margin:6px 0 0">Fitted into your next ${esc(S.className(x.classId))} session.</p>` : ""}
      </div>
    </div>`;
  }

  const partIcon = name => /listen/i.test(name) ? "🎧" : /speak/i.test(name) ? "🗣️" : /essay|writ/i.test(name) ? "✍️" : "📝";
  function partPill(p) {
    return `<div class="part-pill" style="${colorVars(p.classId)}"><span aria-hidden="true">${partIcon(p.name)}</span><span><b>${esc(S.className(p.classId))} ${esc(p.name.toLowerCase())} exam (${esc(p.where.toLowerCase())})</b>${p.guess ? `<br><span class="small">Pick your period on My classes to get your exact date.</span>` : ""}</span></div>`;
  }
  // Pick your class period (only for classes whose in-class exam dates differ by period).
  function periodPicker(id, small) {
    const opts = S.periodOptions(id);
    if (!opts.length) return "";
    const c = st().classes[id];
    return `<div class="period-pick"><label for="per-${id}" class="${small ? "small" : ""}">My ${esc(S.className(id))} period</label>
      <select id="per-${id}" data-bind="classes.${id}.period" data-plan="1" data-rerender="1">
        <option value="" ${c.period ? "" : "selected"}>Pick one</option>
        ${opts.map(o => `<option value="${o}" ${c.period === o ? "selected" : ""}>${o} period</option>`).join("")}
      </select></div>`;
  }

  function tutorialPill(t) {
    const topics = askTopics(t.classId).slice(0, 3);
    return `<div class="tut-pill"><span aria-hidden="true">🙋</span><span><b>${esc(S.className(t.classId))} tutorial, ${D.clock(t.start)}</b>${topics.length ? `<br><span class="small">Ask about: ${esc(topics.join("; "))}</span>` : ""}</span></div>`;
  }

  /* ======================================================================
     FOCUS SCREEN: Start -> timer -> check-in -> break
     ====================================================================== */
  const focus = { id: null, steps: [], i: 0, end: 0, left: 0, paused: false, timer: null, picked: null, stuck: false };

  function focusSteps(lenMin) {
    const steps = [];
    if (st().prefs.extraBreaks) {
      const n = Math.max(1, Math.ceil(lenMin / 15));
      const base = Math.floor(lenMin / n), extra = lenMin - base * n;
      for (let k = 0; k < n; k++) {
        steps.push({ type: "work", min: base + (k < extra ? 1 : 0), label: n > 1 ? `Sprint ${k + 1} of ${n}` : "Focus time" });
        if (k < n - 1) steps.push({ type: "mini", min: 5, label: "Short break" });
      }
    } else {
      steps.push({ type: "work", min: lenMin, label: "Focus time" });
    }
    steps.push({ type: "checkin" });
    steps.push({ type: "break", min: 10, label: "Break time" });
    return steps;
  }

  function openFocus(id) {
    const x = st().plan.sessions.find(y => y.id === id);
    if (!x) return;
    clearInterval(focus.timer);
    Object.assign(focus, { id, steps: focusSteps(Number(st().prefs.sessionLen) || 30), i: 0, paused: false, picked: null, stuck: false });
    startStep();
    const d = $("#focus");
    if (!d.open) d.showModal();
  }

  function startStep() {
    const step = focus.steps[focus.i];
    clearInterval(focus.timer);
    if (step.min) {
      focus.left = step.min * 60;
      focus.end = Date.now() + focus.left * 1000;
      focus.timer = setInterval(tick, 500);
    }
    renderFocus();
  }

  function tick() {
    if (focus.paused) return;
    focus.left = Math.max(0, Math.round((focus.end - Date.now()) / 1000));
    const t = $("#focus .f-time");
    if (t) t.textContent = mmss(focus.left);
    const step = focus.steps[focus.i];
    if (step && step.min) {
      const bar = $("#focus .f-ring");
      if (bar) bar.style.setProperty("--p", String(100 - Math.round(100 * focus.left / (step.min * 60))));
    }
    if (focus.left <= 0) {
      clearInterval(focus.timer);
      if (navigator.vibrate) navigator.vibrate(200);
      nextStep();
    }
  }
  const mmss = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  function nextStep() {
    if (focus.i < focus.steps.length - 1) { focus.i++; startStep(); }
    else closeFocus();
  }

  function closeFocus() {
    clearInterval(focus.timer);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const d = $("#focus");
    if (d.open) d.close();
    focus.id = null;
    render();
  }

  function renderFocus() {
    const x = st().plan.sessions.find(y => y.id === focus.id);
    if (!x) return;
    const step = focus.steps[focus.i];
    const res = (x.resources || []).slice(0, 3);
    const head = `<div class="f-head" style="${colorVars(x.classId)}">
        <div><div class="f-class">${esc(x.title)}</div><div class="f-topic">${esc(x.topicText)}</div></div>
        <button class="icon-btn f-close" data-act="focus-close" aria-label="Close">✕</button>
      </div>`;
    let body = "";
    if (step.type === "work") {
      body = `
        <p class="f-label">${esc(step.label)}</p>
        <div class="f-ring" style="--p:0"><span class="f-time" role="timer" aria-live="off">${mmss(focus.left)}</span></div>
        <div class="f-task">${stepsHTML(x)}</div>
        <div class="btn-row f-actions">
          <button class="btn ghost" data-act="focus-pause">${focus.paused ? "▶ Resume" : "⏸ Pause"}</button>
          <button class="btn" data-act="focus-next">I'm done</button>
        </div>
        <p class="f-help"><button class="linkish small" data-act="overwhelmed">Feeling overwhelmed?</button></p>`;
    } else if (step.type === "mini") {
      body = `
        <p class="f-label">${esc(step.label)}</p>
        <div class="f-ring rest" style="--p:0"><span class="f-time" role="timer">${mmss(focus.left)}</span></div>
        <p class="f-rest">Stand up, stretch, and get some water. Your next sprint starts when the timer ends.</p>
        <div class="btn-row f-actions"><button class="btn" data-act="focus-next">Start next sprint now</button></div>`;
    } else if (step.type === "checkin") {
      const cls = st().classes[x.classId];
      const topic = cls && cls.topics.find(t => t.id === x.baseId);
      const current = focus.picked || (topic ? topic.conf : null);
      body = `
        <p class="f-big">Nice work. 🎉</p>
        <p><b>How does ${topic ? `“${esc(topic.text)}”` : "this topic"} feel now?</b></p>
        <div class="conf big-conf" role="group" aria-label="How it feels now">${confButtons("focus-feel", current)}</div>
        <p class="xs muted">Your plan adjusts to your answer: shaky topics get more practice, solid ones get less.</p>
        ${x.classId !== "general" ? (focus.stuck
          ? `<div class="note small" style="margin-top:10px">Added to your questions for your teacher. <a href="#week" data-act="focus-tutorial" data-class="${x.classId}">Plan a tutorial</a></div>`
          : `<p style="margin-top:12px"><button class="btn small ghost" data-act="focus-stuck">🙋 Stuck? Ask my teacher</button></p>`) : ""}
        <div class="btn-row f-actions"><button class="btn big" data-act="focus-save">Save and take a break</button></div>`;
    } else {
      const later = st().plan.sessions.find(y => !y.done && y.date === D.today() && y.id !== focus.id);
      body = `
        <p class="f-label">${esc(step.label)}</p>
        <div class="f-ring rest" style="--p:0"><span class="f-time" role="timer">${mmss(focus.left)}</span></div>
        <p class="f-rest">Move around, get a snack, look at something far away. You earned it.</p>
        ${later ? `<p class="small">Up next today: <b>${esc(later.title)}</b> at ${D.clock(later.start)}</p>` : `<p class="small">That's everything for today.</p>`}
        <div class="btn-row f-actions"><button class="btn" data-act="focus-close">Done</button></div>`;
    }
    $("#focus").innerHTML = `<div class="f-wrap">${head}<div class="f-body">${body}</div></div>`;
    document.title = step.min ? `${mmss(focus.left)} ${step.type === "work" ? "Focus" : "Break"} | Exam Prep HQ` : "Exam Prep HQ";
  }

  function saveCheckin() {
    const s = st();
    const x = s.plan.sessions.find(y => y.id === focus.id);
    if (!x) return;
    x.done = true;
    let changed = false;
    const cls = s.classes[x.classId];
    const topic = cls && cls.topics.find(t => t.id === x.baseId);
    if (topic && focus.picked && Number(topic.conf) !== focus.picked) { if (!topic.firstConf) topic.firstConf = Number(topic.conf); topic.conf = focus.picked; changed = true; }
    save();
    if (changed) { rebuildQuiet(); toast("Got it. Your plan adjusted to how that topic feels."); }
    else toast("Session done. Nice work.");
    nextStep();
  }

  function saveCheckinIfNeeded() {
    const x = st().plan && st().plan.sessions.find(y => y.id === focus.id);
    if (x && !x.done && focus.steps[focus.i] && focus.steps[focus.i].type === "checkin") { focus.i = focus.steps.length - 1; saveCheckin(); }
  }

  function addStuck(x) {
    const cls = st().classes[x.classId];
    if (!cls) return;
    const line = `Stuck on: ${x.topicText}`;
    if (!(cls.questions || "").includes(line)) cls.questions = (cls.questions ? cls.questions.trim() + "\n" : "") + line;
    save();
  }

  // Rebuild in the background (keeps finished sessions); used by check-ins and Catch me up.
  function rebuildQuiet() {
    const s = st();
    s.plan = window.Planner.generate(s);
    s.planStale = false;
    save();
  }

  /* ======================================================================
     TODAY
     ====================================================================== */
  function pageToday() {
    const s = st();
    const today = D.today();
    const firstExam = CFG.EXAMS.map(e => e.date).sort()[0];
    const toFirst = D.diff(today, firstExam);

    const lastExam = CFG.EXAMS.map(e => e.date).sort().slice(-1)[0];
    if (s.plan && today > lastExam) {
      const done = s.plan.sessions.filter(x => x.done).length;
      return `
        <section class="hero brick">
          <h1>You did it${s.profile.name ? `, ${esc(s.profile.name)}` : ""}. 🎉</h1>
          <p>Exams are over. ${done ? `You finished ${done} study session${done === 1 ? "" : "s"}. ` : ""}Take a real break: you earned it.</p>
          ${gates(true)}
        </section>
        <section class="panel" style="margin-top:20px">
          <h2 class="h3">Before you forget</h2>
          <p>What helped you most this time: spaced sessions, practice exams, tutorials, or something else? Remembering it makes next semester easier.</p>
          <p class="small muted">Ready for next semester? Tap <b>Start over</b> at the top when it's time.</p>
        </section>`;
    }

    if (!s.plan) {
      return `
        <section class="hero brick">
          <h1>${toFirst > 0 ? `Exams start in ${toFirst} day${toFirst === 1 ? "" : "s"}.` : "Exams are here."}</h1>
          <p>Let's make a plan so you're ready, without the stress.</p>
          <div class="btn-row"><a class="btn light big" href="#start/1">Make my plan</a><span class="hero-note">Takes about 5 minutes</span></div>
          ${gates(false)}
        </section>
        <section class="how" aria-labelledby="how-h">
          <h2 id="how-h">How it works</h2>
          <ol class="how-steps">${C.howItWorks.map(h => `<li><span class="how-emoji" aria-hidden="true">${h.emoji}</span><b>${esc(h.title)}</b><span>${esc(h.body)}</span></li>`).join("")}</ol>
          <p class="small muted" style="margin-top:14px">Just want study tips? <a href="#tips">Browse tips</a>.</p>
        </section>`;
    }

    const todays = s.plan.sessions.filter(x => x.date === today);
    const tutsToday = (s.tutorials || []).filter(t => t.date === today && !t.done);
    const examToday = CFG.EXAMS.find(e => e.date === today);
    const next = s.plan.sessions.filter(x => !x.done && x.date > today).slice(0, 1);
    const allDone = todays.length && todays.every(x => x.done);
    const name = s.profile.name ? `, ${esc(s.profile.name)}` : "";

    let todayBody;
    const missedList = missedSessions();
    const missedHTML = missedList.length ? `<div class="missed-box"><h3 class="h4">Missed ${missedList.length === 1 ? "session" : `sessions (${missedList.length})`}</h3>
      <p class="xs muted" style="margin:-4px 0 8px">No problem. Do it now, move it to a new time, or fit it into your next session for that class.</p>
      <div class="sessions">${missedList.slice(0, 2).map(x => sessionCard(x)).join("")}</div></div>` : "";
    if (todays.length) {
      todayBody = `${allDone ? `<p class="win">🎉 You're done for today${name}. Go enjoy your evening.</p>` : ""}<div class="sessions">${todays.map(sessionCard).join("")}</div>`;
    } else {
      todayBody = missedList.length ? `<p class="small muted">Nothing else scheduled today.</p>` : `<p class="win">😌 No studying today. Enjoy it.</p>`;
    }
    if (next.length && (allDone || !todays.length)) {
      todayBody += `<h3 class="h4" style="margin-top:16px">Next up: ${D.pretty(next[0].date)}</h3><div class="sessions">${sessionCard(next[0])}</div>`;
    }

    return `
      <section class="hero brick compact">
        <h1>Hi${name}.</h1>
        <p>${toFirst > 0 ? `${toFirst} day${toFirst === 1 ? "" : "s"} until your first exam. You've got a plan.` : "It's exam time. You've prepared for this."}</p>
        ${gates(true)}
      </section>

      ${tourCard()}
      ${st().plan && st().plan.note ? planNote(true) : ""}
      ${s.planStale ? `<div class="warn" style="margin-top:18px">You changed some things. <button class="btn small" data-act="build">Update my plan</button></div>` : ""}
      ${catchUpBanner()}
      ${examDayCard()}

      <div class="grid today-grid" style="margin-top:20px">
        <section class="panel today-card" aria-labelledby="today-h">
          <h2 id="today-h">Today <span class="muted" style="font-weight:600;font-size:1rem">${D.pretty(today)}</span></h2>
          ${tutsToday.map(tutorialPill).join("")}
          ${missedHTML}
          ${todayBody}
          ${CFG.EXAMS.some(e => e.date > today) ? (studyDayOver()
            ? `<p class="xs muted add-today-note">🌙 Rest up. You can add an extra session tomorrow.</p>`
            : `<button class="btn ghost add-today" data-act="add-today">➕ Add a session today</button>
          <p class="xs muted" style="margin:6px 0 0">Have some time? Get one more quick practice session on your shakiest topic.</p>`) : ""}
        </section>

        <div class="stack">
          <section class="panel">
            <h3>My progress</h3>
            <div class="bar" role="img" aria-label="${pct(s)} percent done"><span style="width:${pct(s)}%"></span></div>
            <p class="small" style="margin:8px 0 0"><b>${doneCount(s)}</b> of ${s.plan.sessions.length} sessions done</p>
            ${s.earnedBadges.length ? `<p class="badge-row" aria-label="Badges earned">${BADGES.filter(b => s.earnedBadges.includes(b.id)).map(b => `<span title="${b.name}">${b.e}</span>`).join("")}</p>` : ""}
          </section>
          ${planTools(true)}
          <button class="panel calm-btn" data-act="overwhelmed"><span aria-hidden="true">😮‍💨</span><span><b>Feeling overwhelmed?</b><span class="small">Breathe, add breaks, or talk to someone.</span></span></button>
          ${nudges()}
        </div>
      </div>

      ${tipOfTheDay()}`;
  }

  function tourCard() {
    if (st().tourDone) return "";
    return `<section class="panel tour" aria-labelledby="tour-h" style="margin-top:18px">
      <h2 id="tour-h" class="h3">3 things to know</h2>
      <ol class="tour-list">
        <li><b>Tap ▶ Start</b> on a session. You get a timer, clear steps, and a break.</li>
        <li><b>Tap a face when you finish.</b> Your plan adjusts to how each topic feels.</li>
        <li><b>Print it, add it to your calendar, or make up a missed session</b> with the buttons on Today and My Study Plan. Not sure how to do something? Tap <b>Help</b> at the top.</li>
      </ol>
      <button class="btn small" data-act="tour-done">Got it</button>
    </section>`;
  }

  function missedSessions() {
    const s = st();
    return s.plan ? s.plan.sessions.filter(x => !x.done && !x.folded && x.date < D.today()) : [];
  }

  function catchUpBanner() {
    const n = missedSessions().length;
    if (!n) return "";
    return `<div class="warn catch" style="margin-top:18px"><span>You have ${n} missed session${n === 1 ? "" : "s"}. That's OK.</span> <button class="btn small" data-act="catch-up">Catch me up</button></div>`;
  }

  // Night before an exam, and exam morning: a short, calm checklist.
  function examDayCard() {
    const today = D.today();
    const examToday = CFG.EXAMS.find(e => e.date === today);
    const examTomorrow = CFG.EXAMS.find(e => e.date === D.addDays(today, 1));
    const mins = S.examMinutes();
    const extra = mins > CFG.EXAM_MINUTES;
    const preview = Math.round(mins * 0.07), check = Math.round(mins * 0.15), answer = mins - preview - check;
    const half = preview + Math.round(answer / 2);
    const list = (key, items) => `<ul class="checklist">${items.map((t, i) => `<li><label><input type="checkbox" data-daycheck="${key}-${i}" ${ui.dayChecks[`${key}-${i}`] ? "checked" : ""}> ${t}</label></li>`).join("")}</ul>`;
    let html = "";
    if (examToday) {
      html += `<section class="panel day-card" style="${colorVars(examToday.id)}" aria-labelledby="ed-h">
        <h2 id="ed-h">⭐ ${esc(S.className(examToday.id))} exam today${S.guideFor(examToday.id) && S.guideFor(examToday.id).examTime ? `, ${esc(S.guideFor(examToday.id).examTime)}` : ""}</h2>
        <p>You've prepared for this. A calm start helps.</p>
        ${list("morning-" + examToday.id, ["Eat breakfast", "Bring your supplies, water, and a snack", "Know which room you're in", "One slow breath: in for 4, out for 6"])}
        <p class="small"><b>Your pacing plan for ${mins} minutes${extra ? " (with your extended time)" : ""}:</b> look it over for ${preview} minutes, answer for ${answer}, check for ${check}. Around minute ${half}, you should be about halfway.${extra ? " Use all of your time." : ""}</p>
        <button class="btn small ghost" data-act="breathe">Breathe with me (1 minute)</button>
      </section>`;
    }
    const partTips = name => /listen/i.test(name) ? ["Bring earbuds and a fully charged iPad", "Do a quick listening warm-up: numbers, dates, and spelled words"]
      : /speak/i.test(name) ? ["Practice your interview answers out loud one more time", "Have your questions ready to ask, too"]
      : ["Review your word bank and verb conjugations", "Remember: spelling and accents count"];
    S.allParts().filter(x => x.date === today || x.date === D.addDays(today, 1)).forEach(x => {
      const when = x.date === today ? "today" : "tomorrow";
      html += `<section class="panel day-card part-card" style="${colorVars(x.classId)}" aria-label="${esc(S.className(x.classId))} ${esc(x.name)} ${when}">
        <h2>${partIcon(x.name)} ${esc(S.className(x.classId))} ${esc(x.name.toLowerCase())} exam in class ${when}</h2>
        ${list(`part-${x.classId}-${x.name}-${when}`, partTips(x.name))}
        ${x.guess ? `<p class="small">Not sure this is your day? Pick your period on My classes.</p>` : ""}
      </section>`;
    });
    if (examTomorrow) {
      html += `<section class="panel day-card" style="${colorVars(examTomorrow.id)}" aria-labelledby="nb-h">
        <h2 id="nb-h">🌙 ${esc(S.className(examTomorrow.id))} exam tomorrow</h2>
        <p>Tonight is for a light review and a good night's sleep, not cramming.</p>
        ${list("night-" + examTomorrow.id, ["Do tonight's practice exam session", (S.guideFor(examTomorrow.id) && S.guideFor(examTomorrow.id).bring) ? `Pack what your teacher asked for: ${esc(S.guideFor(examTomorrow.id).bring)}. Add water and a snack.` : "Pack your supplies (pens, pencils, highlighter, calculator if allowed), water, and a snack", "Light review only, nothing new", "Screens off early and lights out on time"])}
        ${S.guideFor(examTomorrow.id) && S.guideFor(examTomorrow.id).examTime ? `<p class="small">Exam time: <b>${esc(S.guideFor(examTomorrow.id).examTime)}</b></p>` : ""}
        ${extra ? `<p class="small">Remember: you have <b>${mins} minutes</b>. Plan to use all of them.</p>` : ""}
        <button class="btn small ghost" data-act="exp-examweek">⭐ Print my exam week page</button>
      </section>`;
    }
    return html ? `<div class="stack" style="margin-top:18px">${html}</div>` : "";
  }

  async function loadBackup(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { toast("That file isn't an Exam Prep HQ backup."); return; }
    if (!data || data.app !== "Exam Prep HQ" || !data.state || !data.state.classes) { toast("That file isn't an Exam Prep HQ backup."); return; }
    const when = data.savedAt ? new Date(data.savedAt) : null;
    openModal(`<div class="modal-body"><h3>Load this backup?</h3>
      <p>This replaces what's on this device with the backup${when ? ` saved ${D.pretty(D.iso(when))}` : ""}${data.state.profile && data.state.profile.name ? ` for ${esc(data.state.profile.name)}` : ""}.</p></div>
      <div class="modal-foot"><button class="btn ghost" data-act="modal-close">Cancel</button><button class="btn" data-act="backup-confirm">Load it</button></div>`);
    pendingBackup = data.state;
  }
  let pendingBackup = null;

  // After today's study window (or 9 p.m.), don't offer extra sessions.
  function studyDayOver() {
    const p = st().prefs, now = new Date();
    const end = D.isWeekend(D.today()) ? p.weekendEnd : p.weekdayEnd;
    const mins = now.getHours() * 60 + now.getMinutes();
    return mins >= Math.min(D.toMin(end || "20:30") - 20, 21 * 60);
  }

  function addToday() {
    if (studyDayOver()) { toast("It's late. Rest up and add one tomorrow."); return; }
    const s = st();
    const x = window.Planner.extraSession(s);
    if (!x) { toast("Nothing to add right now. You're in good shape."); return; }
    undoable(`Added: ${x.title}`, () => {
      s.plan.sessions.push(x);
      s.plan.sessions.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
      save();
    });
    render();
    sessionDetails(x.id);
  }

  // One-tap tutorial: the shakiest class that has no tutorial yet, on the next open school day.
  function tutorialSuggestion() {
    const s = st();
    const today = D.today();
    const shaky = id => {
      const c = s.classes[id];
      const t = c.topics.length ? c.topics.reduce((a, x) => a + Number(x.conf || 3), 0) / c.topics.length : Number(c.confidence) || 3;
      return t + (isNaN(S.gradeNum(c.grade)) ? 0 : S.gradeNum(c.grade) / 100);
    };
    const taken = new Set((s.tutorials || []).map(t => t.date));
    const cands = CFG.EXAMS.filter(e => D.diff(today, e.date) >= 2 && !(s.tutorials || []).some(t => t.classId === e.id && t.date >= today))
      .sort((a, b) => shaky(a.id) - shaky(b.id));
    for (const e of cands) {
      if (shaky(e.id) >= 4) continue;
      for (let d = D.addDays(today, 1); d < e.date; d = D.addDays(d, 1)) {
        if (D.isWeekend(d) || taken.has(d) || (s.prefs.offDates || []).includes(d) || CFG.EXAMS.some(x => x.date === d)) continue;
        return { classId: e.id, date: d };
      }
    }
    return null;
  }

  function catchUp() {
    rebuildQuiet();
    const s = st();
    const today = D.today();
    const examIn = id => { const e = S.exam(id); return e ? D.diff(today, e.date) : 99; };
    const confOf = x => { const c = s.classes[x.classId]; const t = c && c.topics.find(y => y.id === x.baseId); return t ? Number(t.conf) : (c ? Number(c.confidence) : 3); };
    const seen = new Set();
    const top = s.plan.sessions.filter(x => !x.done && x.date >= today && x.classId !== "general")
      .map(x => ({ x, score: examIn(x.classId) + 3 * confOf(x) }))
      .sort((a, b) => a.score - b.score)
      .filter(o => { const k = o.x.classId + o.x.baseId; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 3).map(o => o.x);
    render();
    openModal(`<div class="modal-body"><h3>You're caught up 👍</h3>
      <p>Missed sessions moved to new times. Finished ones stayed checked off.</p>
      ${top.length ? `<h4>Short on time? Do these first</h4><p class="small muted">Your shakiest topics for your soonest exams.</p>
        <ol class="priority">${top.map(x => `<li><b>${esc(x.title)}</b><br><span class="small">${esc(x.topicText)}. ${D.pretty(x.date)}, ${D.clock(x.start)}</span></li>`).join("")}</ol>` : ""}
      ${s.drive.calendarSyncedAt ? `<p class="small muted">Tip: tap “Update Google Calendar” in Save my plan so your reminders match.</p>` : ""}</div>
      <div class="modal-foot"><button class="btn" data-act="modal-close">OK</button></div>`);
  }

  function overwhelmedModal() {
    const s = st();
    const next = s.plan && s.plan.sessions.find(x => !x.done && x.date >= D.today());
    const on = !!s.prefs.extraBreaks;
    const target = $("#focus").open ? $("#focus") : null;
    const html = `
      <div class="modal-body calm">
        <h3>Feeling overwhelmed? That's normal.</h3>
        <p class="muted">Lots of students feel this way before exams. Here are a few things that help.</p>
        <div class="calm-row"><span class="e" aria-hidden="true">🫁</span><div><b>Breathe for one minute</b><p class="small">Slow breathing calms your body down fast.</p><button class="btn small" data-act="breathe">Breathe with me</button></div></div>
        <div class="calm-row"><span class="e" aria-hidden="true">💬</span><div><b>Talk to someone</b><p class="small">A parent, your advisor, a teacher, or a school counselor. You don't have to handle stress alone, and asking for help is a strong move. If you're having a really hard time, tell an adult today.</p></div></div>
        <div class="calm-row"><span class="e" aria-hidden="true">☕</span><div><b>Add more breaks</b><p class="small">Same study time, split into 15-minute sprints with 5-minute breaks in between.</p>
          <button class="btn small ${on ? "" : "ghost"}" data-act="extra-breaks" aria-pressed="${on}">${on ? "✓ Extra breaks are on" : "Turn on extra breaks"}</button></div></div>
        ${next && !target ? `<div class="calm-row"><span class="e" aria-hidden="true">👣</span><div><b>Just start</b><p class="small">Starting is the hardest part. Begin your next session and focus on the first 5 minutes.</p><button class="btn small ghost" data-act="focus-from-calm" data-id="${next.id}">Start my next session</button></div></div>` : ""}
      </div>
      <div class="modal-foot"><button class="btn" data-act="modal-close">Close</button></div>`;
    openModal(html);
  }

  // One minute of guided breathing: in for 4, out for 6.
  let breatheTimer = null;
  function breathe() {
    openModal(`<div class="modal-body breathe-box">
      <div class="breathe-circle" aria-hidden="true"></div>
      <p class="breathe-text" aria-live="polite">Get comfortable.</p>
      <p class="small muted breathe-count"></p></div>
      <div class="modal-foot"><button class="btn ghost" data-act="breathe-stop">Stop</button></div>`);
    let cycle = 0, t0 = Date.now();
    clearInterval(breatheTimer);
    const circle = $(".breathe-circle"), text = $(".breathe-text"), count = $(".breathe-count");
    const stepFn = () => {
      const el = (Date.now() - t0) / 1000;
      const inCycle = el % 10;
      cycle = Math.floor(el / 10);
      if (cycle >= 6) { clearInterval(breatheTimer); text.textContent = "Nice. Notice how you feel."; circle.className = "breathe-circle"; count.textContent = ""; return; }
      const inhale = inCycle < 4;
      text.textContent = inhale ? `Breathe in… ${4 - Math.floor(inCycle)}` : `Breathe out… ${6 - Math.floor(inCycle - 4)}`;
      circle.className = "breathe-circle " + (inhale ? "in" : "out");
      count.textContent = `Breath ${cycle + 1} of 6`;
    };
    stepFn();
    breatheTimer = setInterval(stepFn, 250);
  }

  // Suggest at most two optional upgrades at a time.
  function nudges() {
    const s = st();
    const list = [];
    // Teacher updated a guide since this student loaded it.
    CFG.EXAMS.forEach(e => {
      const c = s.classes[e.id], g = S.guideFor(e.id);
      if (g && c.guideFrom === c.course && g.updated && c.guideVersion && g.updated > c.guideVersion && e.date > D.today())
        list.unshift({ e: "🔄", t: `Your teacher updated the ${c.course} study guide`, d: "Tap to update your topics. Your face ratings stay.", act: "update-guide", data: `data-class="${e.id}"` });
    });
    // Only suggest uploading when no class level is picked (picked levels get their guide automatically).
    const missing = CFG.EXAMS.filter(e => !s.classes[e.id].topics.length && !s.classes[e.id].course && e.date >= D.today()).sort((a, b) => a.date.localeCompare(b.date));
    const noCourse = CFG.EXAMS.filter(e => !s.classes[e.id].course && e.date >= D.today());
    if (noCourse.length) list.push({ e: "📚", t: `Pick your ${noCourse[0].name} class`, d: "If its study guide is loaded, your topics fill in automatically.", href: "#classes", open: noCourse[0].id });
    else if (missing.length) list.push({ e: "📄", t: `Add your ${S.className(missing[0].id)} study guide`, d: `So your plan covers exactly what's on that exam.${missing.length > 1 ? ` (${missing.length - 1} more after that)` : ""}`, href: "#classes", open: missing[0].id });
    const sug = tutorialSuggestion();
    if (sug) list.unshift({ e: "🙋", t: `${S.className(sug.classId)} feels shaky. Add a tutorial?`, d: `One tap adds it: ${D.pretty(sug.date)}, ${D.clock(CFG.TUTORIAL_START)} to ${D.clock(CFG.TUTORIAL_END)}`, act: "tut-suggest", data: `data-class="${sug.classId}" data-d="${sug.date}"` });
    if (CFG.MINDPRINT && !S.mpIsSet()) list.push({ e: "🧩", t: "Add your MindPrint", d: "Get study tips that fit how you learn.", href: "#tips/mindprint" });
    if (!list.length) return "";
    return `<section class="panel nudges" aria-labelledby="nudge-h">
      <h3 id="nudge-h">Make your plan even better</h3>
      ${list.slice(0, 2).map(n => n.href
        ? `<a class="nudge" href="${n.href}" ${n.open ? `data-act="open-class" data-class="${n.open}"` : ""}><span class="e" aria-hidden="true">${n.e}</span><span><b>${n.t}</b><span class="small">${n.d}</span></span></a>`
        : `<button class="nudge" data-act="${n.act}" ${n.mode ? `data-mode="${n.mode}"` : ""} ${n.data || ""}><span class="e" aria-hidden="true">${n.e}</span><span><b>${n.t}</b><span class="small">${n.d}</span></span></button>`).join("")}
    </section>`;
  }

  function tipOfTheDay() {
    const cards = C.tips.filter(t => t.cards).flatMap(t => t.cards.map(c => Object.assign({ topic: t.id }, c)));
    const day = Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000);
    const c = cards[day % cards.length];
    return `<section class="panel tip-day" aria-labelledby="tod-h" style="margin-top:20px">
      <span class="tod-emoji" aria-hidden="true">💡</span>
      <div><h3 id="tod-h">Tip of the day: ${esc(c.title)}</h3><p style="margin:0">${esc(c.body)} <b>Try it:</b> ${esc(c.try)}</p>
      <a class="small" href="#tips/${c.topic}">More tips like this</a></div>
    </section>`;
  }

  /* ======================================================================
     GUIDED SETUP (#start/1 ... #start/5, then #start/done)
     ====================================================================== */
  function pageStart(step) {
    if (step === "done") return wizardDone();
    const n = Math.min(WIZ_STEPS, Math.max(1, Number(step) || 1));
    const steps = { 1: wizAboutYou, 2: wizClasses, 3: wizBusy, 4: wizStudyTimes, 5: wizExtras };
    const last = n === WIZ_STEPS;
    return `
      <section class="wizard" aria-labelledby="wiz-h">
        <div class="wiz-progress">
          <span class="small">Step ${n} of ${WIZ_STEPS}</span>
          <div class="bar"><span style="width:${(n / WIZ_STEPS) * 100}%"></span></div>
        </div>
        ${steps[n]()}
        <div class="wiz-nav">
          ${n > 1 ? `<a class="btn ghost" href="#start/${n - 1}">Back</a>` : `<a class="btn ghost" href="#today">Cancel</a>`}
          ${last ? `<button class="btn big" data-act="wiz-finish">Make my plan</button>` : `<a class="btn big" href="#start/${n + 1}">Next</a>`}
        </div>
      </section>`;
  }

  function wizAboutYou() {
    const p = st().profile;
    return `
      <h1 id="wiz-h">First, a little about you</h1>
      <div class="field"><label for="p-name">What's your first name? <span class="muted">(optional)</span></label><input id="p-name" type="text" data-bind="profile.name" value="${esc(p.name)}" autocomplete="given-name"></div>
      <div class="field"><label>What grade are you in?</label><div class="seg">${(CFG.GRADE_LEVELS || ["7", "8"]).map(g => `<button type="button" data-act="set" data-path="profile.gradeLevel" data-v="${g}" aria-pressed="${p.gradeLevel === g}">${g}th grade</button>`).join("")}</div></div>
      ${Object.keys(CFG.COURSES || {}).length ? `<p class="xs muted">Your grade decides which classes you'll see on the next screen.</p>` : ""}`;
  }

  // Upper School: main classes can be turned off, and students can add "Other" classes.
  function otherFields(id, compact) {
    const c = st().classes[id];
    const lastExam = S.baseExams.map(e => e.date).sort().slice(-1)[0];
    return `<div class="other-fields ${compact ? "compact" : ""}">
      <div class="field"><label for="on-${id}">Class name</label><input id="on-${id}" type="text" data-bind="classes.${id}.name" data-plan="1" value="${esc(c.name)}" placeholder="AP Psychology" maxlength="40"></div>
      <div class="field"><label for="od-${id}">Exam date</label><input id="od-${id}" type="date" data-bind="classes.${id}.examDate" data-plan="1" data-rerender="1" value="${esc(c.examDate)}" min="${D.today()}" max="${D.addDays(lastExam, 7)}"></div>
    </div>`;
  }
  function wizClassesUpper() {
    const s = st();
    const others = S.otherIds.filter(id => s.classes[id].enabled);
    const free = S.otherIds.find(id => !s.classes[id].enabled);
    const row = e => {
      const c = s.classes[e.id];
      const off = !e.other && c.skip;
      return `<div class="wiz-class upper ${off ? "off" : ""}" style="${colorVars(e.id)}">
        <div class="wc-name"><span aria-hidden="true">${e.icon}</span><span><b>${esc(e.other ? (c.name || "Another class") : e.name)}</b><span class="xs muted">${e.other ? (c.examDate ? `Exam ${D.pretty(c.examDate, false)}` : "Add the exam date") : `Exam ${D.pretty(e.date, false)}`}</span></span></div>
        ${e.other
          ? `<button class="linkish small wc-toggle" data-act="remove-other" data-class="${e.id}">Remove</button>`
          : `<label class="wc-toggle small"><input type="checkbox" data-act="toggle-skip" data-class="${e.id}" ${off ? "" : "checked"}> I have this exam</label>`}
        ${off ? "" : `
          ${e.other ? `<div class="wc-other">${otherFields(e.id, true)}</div>` : ""}
          <div class="wc-grade">${gradePicker(e.id, c.grade, `${esc(S.className(e.id))} letter grade`, true)}</div>
          <div class="conf" role="group" aria-label="How you feel about ${esc(S.className(e.id))}">${confButtons("class-conf", c.confidence, `data-class="${e.id}"`)}</div>`}
      </div>`;
    };
    const slots = S.allSlots();
    return `
      <h1 id="wiz-h">Your classes</h1>
      <p class="muted">For each exam, pick your letter grade and the face that matches how you feel. Classes you're less sure about get more study time. Not sure of your grade? Skip it.</p>
      <p class="small">Don't have one of these exams? Uncheck it. Have another exam? Add it at the bottom. You'll upload your study guides after setup, on My classes.</p>
      <div class="wiz-classes">${slots.filter(e => !e.other).map(row).join("")}${slots.filter(e => e.other && others.includes(e.id)).map(row).join("")}</div>
      ${free ? `<button class="btn ghost" data-act="add-other" style="margin-top:12px">+ Add another class</button>` : ""}`;
  }

  function wizClasses() {
    if (!Object.keys(CFG.COURSES || {}).length) return wizClassesUpper();
    const s = st();
    return `
      <h1 id="wiz-h">Your classes</h1>
      <p class="muted">For each exam, pick your class, your letter grade, and the face that matches how you feel. Classes you're less sure about get more study time. Not sure of your grade? Skip it.</p>
      <div class="wiz-classes">${CFG.EXAMS.map(e => {
        const c = s.classes[e.id];
        return `<div class="wiz-class" style="${colorVars(e.id)}">
          <div class="wc-name"><span aria-hidden="true">${e.icon}</span><span><b>${esc(e.name)}</b><span class="xs muted">Exam ${D.pretty(e.date, false)}</span></span></div>
          <div class="wc-course">${coursePicker(e.id, true)}</div>
          <div class="wc-grade">${gradePicker(e.id, c.grade, `${esc(S.className(e.id))} letter grade`, true)}</div>
          <div class="conf" role="group" aria-label="How you feel about ${esc(S.className(e.id))}">${confButtons("class-conf", c.confidence, `data-class="${e.id}"`)}</div>
          ${c.course && c.guideFrom === c.course ? `<div class="wc-period">${periodPicker(e.id, true)}</div>` : ""}
          ${c.course ? (S.guideFor(e.id) && c.guideFrom === c.course
            ? `<div class="wc-guide">✓ Study guide ready: ${c.topics.length} topics</div>`
            : S.guideFor(e.id) ? "" : `<div class="wc-guide pending">Your teacher's study guide will appear here when it's added. Nothing to do now.</div>`) : ""}
        </div>`;
      }).join("")}</div>`;
  }

  function wizBusy() {
    return `
      <h1 id="wiz-h">What's already on your calendar?</h1>
      <p class="muted">Add things like practices, rehearsals, or lessons so your plan works around them. Nothing to add? Just tap Next.</p>
      ${busyEditor()}`;
  }

  function wizStudyTimes() {
    return `<h1 id="wiz-h">When do you like to study?</h1>${studyTimeChoices()}`;
  }

  function wizExtras() {
    const s = st();
    const opts = [["none", "No"], ["1.5", "Time and a half"], ["2", "Double time"], ["unsure", "Not sure"]];
    return `
      <h1 id="wiz-h">${CFG.MINDPRINT ? "Two last questions" : "One last question"}</h1>
      <p class="muted">${CFG.MINDPRINT ? "Both are optional." : "It's optional."}</p>
      <div class="field"><label>Do you get extended time on tests?</label>
        <div class="seg">${opts.map(([v, l]) => `<button type="button" data-act="set" data-path="accom.extended" data-plan="1" data-v="${v}" aria-pressed="${s.accom.extended === v}">${l}</button>`).join("")}</div>
        ${s.accom.extended === "unsure" ? `<p class="xs muted" style="margin:6px 0 0">That's OK. Ask your advisor, then update it in Tips &gt; Extended time.</p>` : ""}
      </div>
      ${CFG.MINDPRINT ? `<div class="field" style="margin-top:20px"><label>Do you have your MindPrint report?</label>
        ${S.mpIsSet() ? `<p class="small">✓ MindPrint added.</p>` : `
        <label class="drop" data-mpdrop>
          <input type="file" accept=".pdf,.docx,.txt,image/*" data-mpupload>
          📤 Upload my MindPrint report<br><span class="xs muted">The PDF from MindPrint. You can skip this and add it later.</span>
        </label>`}
      </div>` : ""}`;
  }

  function wizardDone() {
    const s = st();
    if (!s.plan) return `<section class="wizard"><h1>Let's make your plan</h1><a class="btn big" href="#start/1">Start</a></section>`;
    const first = s.plan.sessions.find(x => !x.done && x.date >= D.today());
    return `
      <section class="wizard done-screen">
        <div class="big-emoji" aria-hidden="true">🎉</div>
        <h1>Your plan is ready${s.profile.name ? `, ${esc(s.profile.name)}` : ""}.</h1>
        <p>You have <b>${s.plan.sessions.length} short study sessions</b> before exams. You don't have to figure out what to study. Just open Exam Prep HQ and do what's on Today.</p>
        ${first ? `<h3 style="margin-top:18px">Your first session: ${D.pretty(first.date)}</h3><div class="sessions" style="text-align:left">${sessionCard(first)}</div>` : ""}
        <h3 style="margin-top:24px">Put it where you'll see it</h3>
        <div class="btn-row" style="justify-content:center">
          ${window.Drive.enabled() ? `<button class="btn" data-act="exp-gcal">🔔 Add to Google Calendar</button>` : ""}
          <button class="btn ${window.Drive.enabled() ? "ghost" : ""}" data-act="exp-print">🖨️ Print it</button>
        </div>
        <p style="margin-top:24px"><a class="btn ghost" href="#today">Go to Today</a></p>
      </section>`;
  }

  /* ---------- Quick day buttons for repeating activities ---------- */
  const QUICK_DAYS = [["Mon & Wed", "1,3"], ["Tue & Thu", "2,4"], ["Mon, Wed & Fri", "1,3,5"], ["Every weekday", "1,2,3,4,5"]];
  function dayPicker(checked) {
    const on = new Set(checked || []);
    return `<div class="quick-days" role="group" aria-label="Quick choices">${QUICK_DAYS.map(([l, d]) => `<button type="button" class="chip" data-act="day-quick" data-days="${d}">${l}</button>`).join("")}</div>
      <div class="daypick">${D.daysShort.map((d, i) => `<label><input type="checkbox" name="day" value="${i}" ${on.has(i) ? "checked" : ""}><span>${d}</span></label>`).join("")}</div>`;
  }

  /* ---------- Shared editors (used in setup and on My week) ---------- */
  const PRESETS = [["⚽", "Practice"], ["🏀", "Game"], ["🎭", "Rehearsal"], ["🎵", "Lesson"], ["📖", "Tutoring"], ["🙏", "Religious service"], ["🍽️", "Family time"], ["➕", "Something else"]];

  function busyEditor() {
    const s = st();
    const list = s.busy.length ? `<ul class="busy-list">${s.busy.map(b => `
      <li class="busy-item">
        <span class="grow"><b>${esc(b.label || "Busy")}</b><br><span class="when">${b.type === "weekly"
          ? `Every ${(b.days || []).map(d => D.daysShort[d]).join(", ")}`
          : D.pretty(b.date)}, ${D.clock(b.start)} to ${D.clock(b.end)}</span></span>
        <button class="icon-btn" data-act="busy-del" data-id="${b.id}" aria-label="Remove ${esc(b.label)}">🗑️</button>
      </li>`).join("")}</ul>` : "";

    const form = ui.busyOpen ? `
      <form data-busyform class="busy-form">
        <div class="field"><label for="b-label">What is it?</label><input id="b-label" type="text" value="${esc(ui.busyLabel === "Something else" ? "" : ui.busyLabel)}" required></div>
        <div class="field"><label>How often?</label>
          <div class="seg">
            <button type="button" data-act="busy-type" data-v="weekly" aria-pressed="${ui.busyType === "weekly"}">Every week</button>
            <button type="button" data-act="busy-type" data-v="once" aria-pressed="${ui.busyType === "once"}">Just once</button>
          </div>
        </div>
        ${ui.busyType === "weekly"
          ? `<fieldset class="field" style="border:0;padding:0;margin:0 0 14px"><legend class="small" style="font-weight:600;margin-bottom:4px">Which days? <span class="muted" style="font-weight:500">Tap a quick choice or pick days</span></legend>${dayPicker([])}</fieldset>`
          : `<div class="field"><label for="b-date">Date</label><input id="b-date" type="date" required min="${D.today()}"></div>`}
        <div class="fields">
          <div class="field"><label for="b-start">Starts</label><input id="b-start" type="time" value="16:00" required></div>
          <div class="field"><label for="b-end">Ends (with travel)</label><input id="b-end" type="time" value="17:30" required></div>
        </div>
        <div class="btn-row"><button class="btn" type="submit">Add it</button><button class="btn ghost" type="button" data-act="busy-cancel">Cancel</button></div>
      </form>` : `<div class="chips" style="margin-top:12px">${PRESETS.map(([e, l]) => `<button class="chip" type="button" data-act="preset" data-label="${l}">${e} ${l}</button>`).join("")}</div>`;

    return `${list}${form}`;
  }

  function studyTimeChoices() {
    const p = st().prefs;
    const pick = (list, which) => list.map(o => {
      const on = p[`${which}Start`] === o.start && p[`${which}End`] === o.end;
      return `<button type="button" class="choice" data-act="study-time" data-which="${which}" data-start="${o.start}" data-end="${o.end}" aria-pressed="${on}"><b>${o.label}</b><span>${o.sub}</span></button>`;
    }).join("");
    const free = [[-1, "No"], [6, "Saturday"], [0, "Sunday"]];
    return `
      <div class="field"><label>On school days</label><div class="choices">${pick(WEEKDAY_TIMES, "weekday")}</div></div>
      <div class="field"><label>On weekends</label><div class="choices">${pick(WEEKEND_TIMES, "weekend")}</div></div>
      <div class="field"><label>Want one day a week with no studying at all?</label>
        <div class="seg">${free.map(([v, l]) => `<button type="button" data-act="set" data-path="prefs.freeDay" data-num="1" data-plan="1" data-v="${v}" aria-pressed="${Number(p.freeDay) === v}">${l}</button>`).join("")}</div>
        <p class="xs muted" style="margin:6px 0 0">Rest helps your memory. Each session is ${p.sessionLen} minutes with a break after.</p>
      </div>`;
  }

  /* ======================================================================
     MY PLAN
     ====================================================================== */
  function pagePlan() {
    const s = st();
    if (!s.plan) {
      return `<div class="page-head"><h1>My Study Plan</h1></div>
        <section class="panel empty"><p class="big-emoji" aria-hidden="true">🗓️</p><h3>You don't have a plan yet</h3><p>It takes about 5 minutes.</p><a class="btn big" href="#start/1">Make my plan</a></section>`;
    }
    const plan = s.plan;
    const today = D.today();
    const thisWeek = D.addDays(today, -D.dow(today));
    const dates = new Set(plan.sessions.map(x => x.date));
    CFG.EXAMS.forEach(e => dates.add(e.date));
    (s.tutorials || []).forEach(t => dates.add(t.date));
    S.allParts().forEach(p => dates.add(p.date));

    // Next 7 days starting today; then the rest grouped by week; earlier days folded away.
    const all = Array.from(dates).sort();
    const end7 = D.addDays(today, 6);
    const pastDays = all.filter(d => d < today);
    const missedDays = pastDays.filter(d => plan.sessions.some(x => x.date === d && !x.done && !x.folded));
    const nextDays = all.filter(d => d >= today && d <= end7);
    // After the next 7 days, keep going in 7-day blocks with real dates.
    const later = {};
    all.filter(d => d > end7).forEach(d => { const k = D.addDays(today, 7 * Math.floor(D.diff(today, d) / 7)); (later[k] = later[k] || []).push(d); });
    const laterWeeks = Object.keys(later).sort();
    const groupHTML = (label, days, open) => {
      const n = days.reduce((c, d) => c + plan.sessions.filter(x => x.date === d).length, 0);
      const done = days.reduce((c, d) => c + plan.sessions.filter(x => x.date === d && x.done).length, 0);
      return `<details class="week" ${open ? "open" : ""}>
        <summary><h2 class="h3">${label}</h2><span class="small muted">${done} of ${n} done</span></summary>
        ${days.length ? days.map(dayHTML).join("") : `<p class="small muted" style="padding:8px 4px">Nothing scheduled.</p>`}
      </details>`;
    };
    const weeks = {};
    Array.from(dates).sort().forEach(d => { const w = D.addDays(d, -D.dow(d)); (weeks[w] = weeks[w] || []).push(d); });
    const weekKeys = Object.keys(weeks).sort();
    const past = weekKeys.filter(w => w < thisWeek);
    const current = weekKeys.filter(w => w >= thisWeek);

    const dayHTML = d => {
      const exams = CFG.EXAMS.filter(e => e.date === d);
      const tuts = (s.tutorials || []).filter(t => t.date === d);
      const ses = plan.sessions.filter(x => x.date === d);
      return `<div class="day ${d === today ? "today" : ""}">
        <div class="day-label"><b>${D.days[D.dow(d)]}</b><span>${D.pretty(d, false)}${d === today ? ", today" : ""}</span></div>
        <div class="sessions">
          ${exams.map(e => `<div class="exam-pill" style="${colorVars(e.id)}">⭐ ${esc(S.className(e.id))} exam (${S.examMinutes()} min)</div>`).join("")}
          ${S.allParts().filter(p => p.date === d).map(partPill).join("")}
          ${tuts.map(tutorialPill).join("")}
          ${ses.map(sessionChip).join("")}
        </div>
      </div>`;
    };
    const weekHTML = (w, open) => {
      const n = weeks[w].reduce((c, d) => c + plan.sessions.filter(x => x.date === d).length, 0);
      const done = weeks[w].reduce((c, d) => c + plan.sessions.filter(x => x.date === d && x.done).length, 0);
      const label = w === thisWeek ? "This week" : w === D.addDays(thisWeek, 7) ? "Next week" : `Week of ${D.pretty(w, false)}`;
      return `<details class="week" ${open ? "open" : ""}>
        <summary><h2 class="h3">${label}</h2><span class="small muted">${done} of ${n} done</span></summary>
        ${weeks[w].map(dayHTML).join("")}
      </details>`;
    };

    return `
      <div class="page-head"><h1>My Study Plan</h1><p>Every study session until exams. Tap a session to see what to do.</p></div>
      ${planTools(false)}
      ${s.planStale ? `<div class="warn">You changed some things. Tap <b>Update my plan</b> to catch up. Finished sessions stay checked off.</div>` : ""}
      ${catchUpBanner()}
      ${calendarStale() ? `<div class="warn">Your Google Calendar has an old version. <button class="linkish" data-act="exp-gcal">Update it</button></div>` : ""}
      ${planNote()}
      ${missedDays.length ? groupHTML("Missed", missedDays, true) : ""}
      ${pastDays.length ? `<p class="no-print"><button class="linkish small" data-act="toggle-past">${ui.showPast ? "Hide" : "Show"} earlier days</button></p>${ui.showPast ? groupHTML("Earlier", pastDays, false) : ""}` : ""}
      ${groupHTML("Next 7 days", nextDays, true)}
      ${laterWeeks.map(w => groupHTML(`${D.pretty(w, false)} to ${D.pretty(D.addDays(w, 6), false)}`, later[w], false)).join("")}
      <p class="small muted no-print" style="margin-top:30px">Want to start over? <button class="linkish" data-act="start-over">Start over</button></p>`;
  }

  // The three things students look for most, always visible and clearly named.
  function planTools(compact) {
    const missed = missedSessions().length;
    return `<section class="plan-tools no-print ${compact ? "compact" : ""}" aria-label="Plan tools">
      <button class="tool" data-act="exp-print"><span class="e" aria-hidden="true">🖨️</span><b>Print my plan</b><span>The whole schedule, as a checklist</span></button>
      <button class="tool" data-act="add-calendar"><span class="e" aria-hidden="true">📅</span><b>Add to my calendar</b><span>${st().drive.calendarSyncedAt ? (calendarStale() ? "Your calendar needs an update" : "Update it anytime") : "Google or Apple Calendar"}</span></button>
      <button class="tool ${missed ? "alert" : ""}" data-act="make-up"><span class="e" aria-hidden="true">🔁</span><b>Make up missed sessions${missed ? ` (${missed})` : ""}</b><span>${missed ? "Move them to new times" : "No missed sessions right now"}</span></button>
    </section>
    ${compact ? "" : `<p class="small no-print tools-more">Your plan updates on its own when you change your classes or schedule. <button class="linkish" data-act="exp-examweek">Print my exam week page</button> · <button class="linkish" data-act="save-menu">More ways to save or share</button></p>`}`;
  }

  // Add to calendar: direct Google Calendar sync when sign-in is on; otherwise a calendar file with clear steps.
  function addCalendar() {
    if (window.Drive.enabled()) { syncGoogleCalendar(); return; }
    if (isIOS) {
      openModal(`<div class="modal-body">
        <h3>📅 Add your plan to your iPad calendar</h3>
        <ol class="steps-list">
          <li><b>Tap the button below.</b><br><button class="btn small" data-act="exp-ics" style="margin-top:6px">Add to my calendar</button></li>
          <li>Your iPad shows your study sessions. <b>Tap “Add All,”</b> then choose a calendar.</li>
          <li>Open the <b>Calendar</b> app to see them.</li>
        </ol>
        <p class="xs muted">Using Google Calendar instead? Importing a file into Google Calendar needs a computer. Ask your teacher about turning on Google sign-in so it can be added directly. If your plan changes, add it again.</p>
      </div><div class="modal-foot"><button class="btn" data-act="modal-close">Done</button></div>`);
      return;
    }
    openModal(`<div class="modal-body">
      <h3>📅 Add your plan to your calendar</h3>
      <ol class="steps-list">
        <li><b>Download your calendar file.</b><br><button class="btn small" data-act="exp-ics" style="margin-top:6px">Download calendar file</button></li>
        <li><b>Google Calendar:</b> on a computer, open the import page, choose the file you just downloaded, pick a calendar, and click Import.<br>
          <a class="btn small ghost" style="margin-top:6px" href="https://calendar.google.com/calendar/r/settings/export" target="_blank" rel="noopener">Open Google Calendar import</a></li>
        <li><b>Apple Calendar or Outlook:</b> just open the downloaded file.</li>
      </ol>
      <p class="xs muted">Google Calendar doesn't keep reminders from imported files. To get reminders, turn on default notifications in Google Calendar's settings. If your plan changes, download a new file and import it again.</p>
    </div><div class="modal-foot"><button class="btn" data-act="modal-close">Done</button></div>`);
  }

  // Make up missed sessions: reschedule them, or explain how to move one ahead of time.
  // Fold missed sessions into the next session of the same class (nothing new is added to the plan).
  function foldSessions(ids) {
    const s = st();
    const snap = JSON.stringify(s);
    const xs = s.plan.sessions.filter(x => ids.includes(x.id));
    xs.forEach(x => { x.folded = true; x.foldedAt = D.today(); });
    rebuildQuiet();
    const targets = st().plan.sessions.filter(y => (y.also || []).length && y.date >= D.today());
    closeModal();
    render();
    const one = xs.length === 1 && targets.find(t => t.classId === xs[0].classId);
    toast(one ? `Added to your ${S.className(one.classId)} session on ${D.pretty(one.date)}` : `Added to your next sessions for ${Array.from(new Set(xs.map(x => S.className(x.classId)))).join(", ")}`, () => {
      clearTimeout(autoTimer); S.replace(JSON.parse(snap)); S.save({ now: true }); render(); toast("Undone.");
    });
  }

  function planNote(compact) {
    const plan = st().plan;
    if (!plan) return "";
    const w = (plan.warnings || []).map(x => `<div class="warn">${esc(x)} <button class="btn small" data-act="more-time">Add more study time</button></div>`).join("");
    const n = plan.note ? `<div class="calm-note ${compact ? "compact" : ""}"><span aria-hidden="true">🎯</span><span>${esc(plan.note)}${compact ? "" : " Want more practice?"} <button class="linkish" data-act="more-time">Add more study time</button></span></div>` : "";
    return w + n;
  }

  function moreTimeModal() {
    const p = st().prefs;
    const opts = [
      ["three", "Up to 3 sessions on school days", "Right now: up to " + (p.maxWeekday || 2), Number(p.maxWeekday) >= 3],
      ["weekday", "Study after tutorials and after dinner", "School days from 4 to 8:30 p.m.", p.weekdayStart <= "16:00" && p.weekdayEnd >= "20:30"],
      ["weekend", "Use weekend mornings and afternoons", "Weekends from 10 a.m. to 5 p.m.", p.weekendStart <= "10:00" && p.weekendEnd >= "17:00"],
      ["freeday", "Study on my free day too", "Your free day is " + (p.freeDay === "" || p.freeDay == null ? "off already" : D.days[Number(p.freeDay)]), p.freeDay === "" || p.freeDay == null]
    ];
    openModal(`<div class="modal-body"><h3>Add more study time</h3>
      <p class="muted">Tap one. Your plan updates right away, and you can change it back on My Weekly Schedule.</p>
      <div class="save-options one-col">${opts.map(([k, t, d, on]) => `<button class="dl" data-act="more-time-set" data-opt="${k}" ${on ? "disabled" : ""}><span class="e" aria-hidden="true">${on ? "✓" : "➕"}</span><b>${t}</b><span>${on ? "Already on" : d}</span></button>`).join("")}</div>
      <p class="small muted">Rest matters too. Sleep helps you remember what you studied.</p></div>
      <div class="modal-foot"><button class="btn ghost" data-act="modal-close">Done</button></div>`);
  }
  function applyMoreTime(opt) {
    const s = st(), p = s.prefs;
    const before = s.plan ? s.plan.sessions.filter(x => !x.done && x.date >= D.today()).length : 0;
    undoable("Study time added.", () => {
      if (opt === "three") p.maxWeekday = 3;
      if (opt === "weekday") { p.weekdayStart = "16:00"; p.weekdayEnd = "20:30"; }
      if (opt === "weekend") { p.weekendStart = "10:00"; p.weekendEnd = "17:00"; }
      if (opt === "freeday") p.freeDay = "";
      rebuildQuiet();
    });
    const after = st().plan.sessions.filter(x => !x.done && x.date >= D.today()).length;
    moreTimeModal();
    render();
    toast(after > before ? `Study time added: ${after - before} more session${after - before === 1 ? "" : "s"} fit now.` : "Study time added.");
  }

  function makeUp() {
    const missed = missedSessions();
    if (missed.length) {
      openModal(`<div class="modal-body"><h3>Make up ${missed.length} missed session${missed.length === 1 ? "" : "s"}</h3>
        <p class="muted">No problem. Pick what works for you.</p>
        <div class="save-options one-col">
          <button class="dl" data-act="catch-up"><span class="e" aria-hidden="true">📆</span><b>Move them to new times</b><span>Each one gets its own new session.</span></button>
          <button class="dl" data-act="fold-all"><span class="e" aria-hidden="true">➕</span><b>Fit them into my next sessions</b><span>Each class's next session gets a short extra review. Nothing new is added to your schedule.</span></button>
        </div></div>
        <div class="modal-foot"><button class="btn ghost" data-act="modal-close">Cancel</button></div>`);
      return;
    }
    openModal(`<div class="modal-body"><h3>You're all caught up 👍</h3>
      <p>You don't have any missed sessions.</p>
      <p><b>Can't do a session?</b> Tap <b>Move it</b> on that session and it moves to your next open time. Your finished sessions always stay checked off.</p></div>
      <div class="modal-foot"><button class="btn" data-act="modal-close">OK</button></div>`);
  }

  // Move one session: ask "later that day" or "another day", then block that time and rebuild.
  function moveMenu(id) {
    const x = st().plan.sessions.find(y => y.id === id);
    if (!x) return;
    const late = x.date < D.today();
    if (late) { moveSession(id, "day"); return; }
    const isToday = x.date === D.today();
    openModal(`<div class="modal-body"><h3>Move this session</h3>
      <p><b>${esc(x.title)}</b><br><span class="small">${esc(x.topicText)}</span></p>
      <div class="save-options one-col">
        <button class="dl" data-act="move-go" data-id="${x.id}" data-how="slot"><span class="e" aria-hidden="true">⏰</span><b>Later ${isToday ? "today" : "that day"}</b><span>Move it to the next open time.</span></button>
        <button class="dl" data-act="move-go" data-id="${x.id}" data-how="day"><span class="e" aria-hidden="true">📆</span><b>Another day</b><span>${isToday ? "Today's not going to work. Move it to another day." : "Move it to a different day."}</span></button>
      </div></div>
      <div class="modal-foot"><button class="btn ghost" data-act="modal-close">Cancel</button></div>`);
  }

  function moveSession(id, how) {
    const s = st();
    const x = s.plan.sessions.find(y => y.id === id);
    if (!x) return;
    s.skips = (s.skips || []).filter(k => k.date >= D.addDays(D.today(), -14));
    // "slot": block just this time. "day": block from this time to the end of that day.
    const snap = JSON.stringify(Object.assign({}, s, { skips: s.skips }));
    s.skips.push({ date: x.date, start: x.start, end: how === "day" ? "23:59" : x.end });
    rebuildQuiet();
    const moved = st().plan.sessions.find(y => !y.done && y.classId === x.classId && y.topicId === x.topicId && y.kind === x.kind);
    closeModal();
    render();
    toast(moved ? `Moved to ${D.pretty(moved.date)} at ${D.clock(moved.start)}` : "Moved. Check your study plan for the new time.", () => {
      clearTimeout(autoTimer); S.replace(JSON.parse(snap)); S.save({ now: true }); render(); toast("Undone.");
    });
  }

  function calendarStale() {
    const s = st();
    const synced = s.drive.calendarSyncedAt || 0;
    if (!synced || !s.plan) return false;
    return synced < Math.max(s.plan.generatedAt || 0, s.tutorialsUpdatedAt || 0);
  }

  function saveMenu() {
    const on = window.Drive.enabled();
    const signedIn = !!window.Drive.user;
    openModal(`
      <div class="modal-body">
        <h3>Save or share my plan</h3>
        <div class="save-options">
          ${on ? `<button class="dl featured" data-act="exp-gcal"><span class="e" aria-hidden="true">🔔</span><b>${st().drive.calendarSyncedAt ? "Update" : "Add to"} Google Calendar</b><span>Get a reminder before every session.</span></button>` : ""}
          <button class="dl" data-act="exp-print"><span class="e" aria-hidden="true">🖨️</span><b>Print it</b><span>Or save it as a PDF.</span></button>
          <button class="dl" data-act="share"><span class="e" aria-hidden="true">📤</span><b>Share with a parent or advisor</b><span>So they know when you're studying.</span></button>
          <button class="dl" data-act="exp-examweek"><span class="e" aria-hidden="true">⭐</span><b>Print my exam week page</b><span>One page for the fridge: exams, checklists, pacing.</span></button>
        </div>
        <h4 style="margin-top:16px">Moving to another device?</h4>
        <div class="btn-row"><button class="btn small ghost" data-act="backup-save">💾 Save a backup file</button><button class="btn small ghost" data-act="backup-load">📂 Load a backup</button></div>
        <details class="more">
          <summary class="small">More ways to save</summary>
          <div class="save-options small-options">
            <button class="dl" data-act="exp-gdoc" ${signedIn ? "" : "disabled"}><b>Google Doc</b><span>${signedIn ? "Saved in your Drive" : "Sign in first"}</span></button>
            <button class="dl" data-act="exp-gsheet" ${signedIn ? "" : "disabled"}><b>Google Sheet</b><span>${signedIn ? "Saved in your Drive" : "Sign in first"}</span></button>
            <button class="dl" data-act="exp-word"><b>Word file</b><span>Download</span></button>
            <button class="dl" data-act="exp-ics"><b>Calendar file</b><span>For Apple Calendar or Outlook</span></button>
            <button class="dl" data-act="exp-csv"><b>Spreadsheet</b><span>For Excel or Numbers</span></button>
          </div>
        </details>
      </div>
      <div class="modal-foot"><button class="btn ghost" data-act="modal-close">Close</button></div>`);
  }

  function startOverMenu() {
    const hasAnything = !!st().plan || Object.values(st().classes).some(c => c.grade || c.topics.length) || st().busy.length;
    openModal(`
      <div class="modal-body">
        <h3>Start over</h3>
        <div class="save-options one-col">
          <button class="dl" data-act="redo-setup"><span class="e" aria-hidden="true">✏️</span><b>Redo setup</b><span>Go through the 5 setup questions again. Your answers so far stay filled in, and you can change them.</span></button>
          <button class="dl danger" data-act="erase-ask" ${hasAnything ? "" : "disabled"}><span class="e" aria-hidden="true">🗑️</span><b>Erase everything</b><span>Clear all classes, study guides, busy times, tutorials, and your plan. Start completely fresh.</span></button>
        </div>
      </div>
      <p class="xs muted" style="padding:0 24px">Teachers: <a href="${location.pathname}?demo" target="_blank" rel="noopener">open a demo student</a> to show the site in advisory.</p>
      <div class="modal-foot"><button class="btn ghost" data-act="modal-close">Cancel</button></div>`);
  }

  function eraseConfirm() {
    const signedIn = !!window.Drive.user;
    const onCal = !!st().drive.calendarSyncedAt;
    openModal(`
      <div class="modal-body">
        <h3>Erase everything?</h3>
        <p>This clears all your classes, study guides, busy times, tutorials${CFG.MINDPRINT ? ", MindPrint," : ","} and your plan${signedIn ? ", on this device and in your Google Drive" : " on this device"}. <b>This can't be undone.</b></p>
        ${onCal ? `<p class="small muted">Your Google Calendar events stay until you make a new plan and tap "Add to Google Calendar" again, which replaces them.</p>` : ""}
      </div>
      <div class="modal-foot"><button class="btn ghost" data-act="modal-close">Keep my stuff</button><button class="btn danger-btn" data-act="erase-all">Yes, erase everything</button></div>`);
  }

  function eraseAll() {
    S.reset();
    Object.assign(ui, { openClass: null, showPast: false, flipped: {}, examChecks: {}, mpEdit: false, mpAll: false, busyOpen: false, busyLabel: "", busyType: "weekly" });
    closeModal();
    location.hash = "#today";
    render();
    toast("Everything's cleared. Tap “Make my plan” to start fresh.");
  }

  function shareModal() {
    const on = window.Drive.enabled(), signedIn = !!window.Drive.user;
    if (!on) {
      openModal(`<div class="modal-body"><h3>Share my plan</h3>
        <p>Print your plan or download it as a Word file, then give it to a parent or email it to your advisor.</p>
        <div class="btn-row"><button class="btn" data-act="exp-print">🖨️ Print it</button><button class="btn ghost" data-act="exp-word">📄 Word file</button></div></div>
        <div class="modal-foot"><button class="btn ghost" data-act="modal-close">Close</button></div>`);
      return;
    }
    openModal(`<form method="dialog"><div class="modal-body"><h3>Share my plan</h3>
      <p>We'll make a Google Doc of your plan and share it with them. They can see it but not change it.</p>
      ${signedIn ? "" : `<p class="small muted">You'll be asked to sign in with Google first.</p>`}
      <label for="share-email">Their email address</label>
      <input id="share-email" type="email" required autocomplete="email" placeholder="parent@example.com">
      <p class="xs muted" style="margin-top:6px">Your school may only allow sharing with school email addresses. If it doesn't work, print it instead.</p></div>
      <div class="modal-foot"><button class="btn ghost" type="button" data-act="modal-close">Cancel</button><button class="btn" type="submit">Share</button></div></form>`);
    $("#modal form").addEventListener("submit", async ev => {
      ev.preventDefault();
      const email = $("#share-email").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast("Check the email address."); return; }
      try {
        if (!window.Drive.user) await signIn(false);
        if (!window.Drive.user) return;
        toast("Sharing...");
        const doc = await window.Exports.googleDoc();
        await window.Drive.shareWith(doc.id, email);
        openModal(`<div class="modal-body"><h3>Shared 📤</h3><p>${esc(email)} will get an email with a link to your plan. If you update your plan later, share it again so they see the newest version.</p></div>
          <div class="modal-foot"><button class="btn" data-act="modal-close">OK</button></div>`);
      } catch (err) {
        toast(/domain|permission|forbidden|not allowed/i.test(err.message) ? "Your school doesn't allow sharing with that address. Try printing it instead." : `Couldn't share: ${err.message}`);
      }
    });
  }

  function buildPlan() {
    const s = st();
    s.plan = window.Planner.generate(s);
    s.planStale = false;
    save();
    toast(s.drive.calendarSyncedAt ? "Plan updated. Update Google Calendar to match." : "Your plan is updated.");
  }

  /* ======================================================================
     MY CLASSES
     ====================================================================== */
  function pageClasses() {
    const s = st();
    return `
      <div class="page-head"><h1>My classes</h1><p>${Object.keys(CFG.COURSES || {}).length ? "Tap a class to see its topics, rate how each one feels, or change your class level. Study guides load on their own." : "Tap a class to upload its study guide, see its topics, and rate how each one feels."}</p></div>
      <div class="stack">${CFG.EXAMS.map(e => classCard(e)).join("")}</div>
      ${S.otherIds && S.otherIds.length ? manageClasses() : ""}
      ${s.plan && s.planStale ? `<div class="btn-row" style="margin-top:20px"><button class="btn big" data-act="build">Update my plan</button></div>` : ""}`;
  }

  function manageClasses() {
    const s = st();
    const skipped = S.baseExams.filter(e => s.classes[e.id].skip);
    const pending = S.otherIds.filter(id => s.classes[id].enabled && !(s.classes[id].name && s.classes[id].examDate));
    const free = S.otherIds.find(id => !s.classes[id].enabled);
    return `<section class="panel" style="margin-top:20px" aria-labelledby="mc-h">
      <h2 class="h3" id="mc-h">Add or remove classes</h2>
      ${pending.map(id => `<div class="pending-other" style="${colorVars(id)}"><b>New class</b>${otherFields(id)}<button class="linkish small" data-act="remove-other" data-class="${id}">Remove</button><p class="xs muted">Add a name and exam date and it joins your plan.</p></div>`).join("")}
      ${skipped.length ? `<p class="small">Not taking: ${skipped.map(e => `<button class="chip" data-act="toggle-skip" data-class="${e.id}">+ ${esc(e.name)}</button>`).join(" ")}</p>` : ""}
      ${free ? `<button class="btn ghost small" data-act="add-other">+ Add another class</button>` : `<p class="small muted">You've added the most extra classes (${S.otherIds.length}).</p>`}
    </section>`;
  }

  // A student picks (or changes) their class level.
  function chooseCourse(id, course, el) {
    const c = st().classes[id];
    const fromGuide = !c.topics.length || (c.guideFrom && c.guideFrom === c.course);
    c.course = course;
    let loaded = false;
    if (S.guideFor(id) && fromGuide) loaded = S.applyGuide(id);
    else if (!S.guideFor(id) && c.guideFrom && fromGuide) { c.topics = []; c.guideFrom = ""; }
    save({ planInputs: true });
    if (loaded) toast(`${course} study guide loaded: ${c.topics.length} topics.`);
    rerenderKeepFocus(el);
    const again = document.getElementById(`course-${id}`);
    if (again) again.focus({ preventScroll: true });
  }

  // When a guide is added to the site later, fill it in for students who haven't added topics yet.
  function autoLoadGuides() {
    const s = st();
    const added = [];
    CFG.EXAMS.forEach(e => {
      const c = s.classes[e.id], g = S.guideFor(e.id);
      if (!g) return;
      if (!c.topics.length) { S.applyGuide(e.id); added.push(S.className(e.id)); }
    });
    if (added.length) {
      S.persistLocal();
      if (s.plan) { s.plan = window.Planner.generate(s); S.save(); }
      setTimeout(() => toast(`New study guide${added.length > 1 ? "s" : ""} loaded: ${added.join(", ")}`), 600);
    }
  }

  // Readiness: sessions done for this class, and how the faces have changed since the first check-in.
  function readiness(id) {
    const s = st();
    const ses = s.plan ? s.plan.sessions.filter(x => x.classId === id) : [];
    const done = ses.filter(x => x.done).length;
    const c = s.classes[id];
    const face = v => (C.confidence.find(x => x.v === Math.round(v)) || C.confidence[2]).emoji;
    const rated = c.topics.filter(t => t.firstConf);
    const trend = rated.length ? { from: face(rated.reduce((a, t) => a + Number(t.firstConf), 0) / rated.length), to: face(rated.reduce((a, t) => a + Number(t.conf), 0) / rated.length) } : null;
    return { total: ses.length, done, trend };
  }

  function classCard(e) {
    const c = st().classes[e.id];
    const name = S.className(e.id);
    const open = ui.openClass === e.id;
    const feel = C.confidence.find(x => x.v === Number(c.confidence));
    const status = c.topics.length ? `${c.topics.length} topic${c.topics.length === 1 ? "" : "s"}` : "No study guide yet";

    const body = !open ? "" : `
      <div class="class-body">
        <div>
          ${e.other ? `${otherFields(e.id)}<p><button class="linkish small" data-act="remove-other" data-class="${e.id}">Remove this class</button></p>` : ""}
          ${Object.keys(CFG.COURSES || {}).length ? `<div class="field">${coursePicker(e.id, false)}${guideStatus(e.id)}</div>` : ""}
          ${!e.other && S.otherIds && S.otherIds.length ? `<p class="xs"><button class="linkish small" data-act="toggle-skip" data-class="${e.id}">I don't have this exam</button></p>` : ""}
          ${periodPicker(e.id) ? `<div class="field">${periodPicker(e.id)}</div>` : ""}
          ${S.partsFor(e.id).length ? `<div class="parts-list"><b>In-class exam parts</b><ul>${S.partsFor(e.id).map(p => `<li>${partIcon(p.name)} ${esc(p.name)}: ${D.pretty(p.date)}${p.guess ? " (pick your period)" : ""}</li>`).join("")}<li>⭐ Exam day: ${D.pretty(e.date)}</li></ul></div>` : ""}
          <div class="field">${gradePicker(e.id, c.grade, "My letter grade", false)}</div>
          <div class="field"><label id="cl-${e.id}">How I feel about this class</label><div class="conf" role="group" aria-labelledby="cl-${e.id}">${confButtons("class-conf", c.confidence, `data-class="${e.id}"`)}</div></div>
          <label class="drop" data-drop="${e.id}">
            <input type="file" accept=".pdf,.docx,.txt,image/*" multiple data-upload="${e.id}">
            📤 ${S.guideFor(e.id) ? "Upload a different study guide" : "Upload study guide"}<br><span class="xs muted">PDF, Word, or photo</span>
          </label>
          ${c.guides.length ? `<ul class="guide-files">${c.guides.map((g, i) => `<li>📄 ${g.link ? `<a href="${esc(g.link)}" target="_blank" rel="noopener">${esc(g.name)}</a>` : esc(g.name)} <button class="icon-btn" data-act="guide-del" data-class="${e.id}" data-i="${i}" aria-label="Remove ${esc(g.name)}">✕</button></li>`).join("")}</ul>` : ""}
          <button class="linkish small" style="margin-top:8px" data-act="paste" data-class="${e.id}">Or paste the text</button>
        </div>
        <div>
          <h2 class="h4">Study guide topics</h2>
          ${c.topics.length ? `<p class="xs muted" style="margin:-4px 0 6px">Tap a face for each one. Shaky topics get more practice.</p><ul class="topics">${c.topics.map(t => `
            <li class="topic">
              <span class="topic-name"><input type="text" value="${esc(t.text)}" data-topic="${e.id}|${t.id}" aria-label="Topic name">${(t.details || []).length ? `<span class="topic-details">${esc(t.details.join(", "))}</span>` : ""}${(t.resources || []).length ? `<span class="topic-details"><b>Use:</b> ${esc(t.resources.join("; "))}</span>` : ""}</span>
              <div class="conf" role="group" aria-label="How you feel about ${esc(t.text)}">${confButtons("topic-conf", t.conf, `data-class="${e.id}" data-id="${t.id}"`)}</div>
              <button class="icon-btn" data-act="topic-del" data-class="${e.id}" data-id="${t.id}" aria-label="Delete ${esc(t.text)}">🗑️</button>
            </li>`).join("")}</ul>` : `<p class="small muted">Upload your study guide and we'll find the topics. Or type them below.</p>`}
          <form class="btn-row" style="margin-top:10px" data-addtopic="${e.id}">
            <label class="sr-only" for="add-${e.id}">Add a topic</label>
            <input id="add-${e.id}" type="text" placeholder="Add a topic" style="flex:1;min-width:160px">
            <button class="btn small" type="submit">Add</button>
          </form>
          <label for="q-${e.id}" style="margin-top:16px">Questions for my teacher <span class="muted">(bring these to tutorials)</span></label>
          <textarea id="q-${e.id}" data-bind="classes.${e.id}.questions" placeholder="${esc(QUESTION_EXAMPLES[e.id] || "")}">${esc(c.questions)}</textarea>
        </div>
      </div>`;

    return `<section class="class-card ${open ? "open" : ""}" style="${colorVars(e.id)}">
      <button class="class-head" data-act="class-toggle" data-class="${e.id}" aria-expanded="${open}">
        <span class="icon" aria-hidden="true">${e.icon}</span>
        <span class="ch-text"><b>${esc(c.course || name)}</b><span class="xs">Exam ${D.pretty(e.date)}</span></span>
        ${(() => { const r = readiness(e.id); return r.total ? `<span class="ready" aria-label="${r.done} of ${r.total} study sessions done"><span class="ready-bar"><span style="width:${Math.round(100 * r.done / r.total)}%"></span></span><span class="xs">${r.done} of ${r.total} done${r.trend && r.trend.from !== r.trend.to ? ` <span class="trend">${r.trend.from} → ${r.trend.to}</span>` : ""}</span></span>` : ""; })()}
        <span class="ch-meta">${c.grade ? `<span class="pill">${esc(c.grade)}</span>` : ""}<span aria-label="${feel ? feel.label : ""}">${feel ? feel.emoji : ""}</span><span class="xs ${c.topics.length ? "" : "muted"}">${status}</span></span>
        <span class="chev" aria-hidden="true">${open ? "▲" : "▼"}</span>
      </button>
      ${body}
    </section>`;
  }

  const QUESTION_EXAMPLES = {
    english: "Like: How do I pick strong evidence for a theme paragraph?",
    science: "Like: What's the difference between mitosis and meiosis?",
    social: "Like: How do I explain causes in a short answer?",
    math: "Like: When do I flip the inequality sign?",
    lang: "Like: When do I use one verb tense instead of another?"
  };

  /* ======================================================================
     MY WEEK
     ====================================================================== */
  function pageWeek() {
    const s = st();
    const p = s.prefs;
    const today = D.today();
    const thisWeek = D.addDays(today, -D.dow(today));
    const lastExam = CFG.EXAMS.map(e => e.date).sort().slice(-1)[0];
    const maxOffset = Math.max(0, Math.floor(D.diff(today, lastExam) / 7));
    ui.weekOffset = Math.min(Math.max(ui.weekOffset || 0, 0), maxOffset);
    const start = D.addDays(today, 7 * ui.weekOffset);
    const days = Array.from({ length: 7 }, (_, i) => D.addDays(start, i));
    const label = ui.weekOffset === 0 ? "Next 7 days" : days.some(d => CFG.EXAMS.some(e => e.date === d)) ? "Exam days" : "Coming up";
    const range = `${D.pretty(days[0], false)} to ${D.pretty(days[6], false)}`;

    const dayHTML = d => {
      const dow = D.dow(d);
      const items = [];
      CFG.EXAMS.filter(e => e.date === d).forEach(e => items.push({ t: "00:00", html: `<div class="cal-exam" style="${colorVars(e.id)}">⭐ ${esc(S.className(e.id))} exam</div>` }));
      S.allParts().filter(x => x.date === d).forEach(x => items.push({ t: "00:00", html: `<div class="cal-part" style="${colorVars(x.classId)}">${partIcon(x.name)} ${esc(S.className(x.classId))} ${esc(x.name.toLowerCase())} (in class)</div>` }));
      if ((p.offDates || []).includes(d)) items.push({ t: "00:01", html: `<button class="cal-item off" data-act="off-edit" data-d="${d}">😌 Day off</button>` });
      else if (Number(p.freeDay) === dow) items.push({ t: "00:01", html: `<div class="cal-item off static">😌 Free day</div>` });
      s.busy.filter(b => (b.type === "weekly" && (b.days || []).includes(dow)) || (b.type === "once" && b.date === d)).forEach(b =>
        items.push({ t: b.start, html: `<button class="cal-item busy" data-act="busy-edit" data-id="${b.id}"><span class="ci-time">${D.clock(b.start)}</span>${esc(b.label || "Busy")}</button>` }));
      (s.tutorials || []).filter(t => t.date === d).forEach(t =>
        items.push({ t: t.start, html: `<button class="cal-item tut ${t.done ? "done" : ""}" data-act="tut-edit" data-id="${t.id}"><span class="ci-time">${D.clock(t.start)}</span>🙋 ${esc(S.className(t.classId))} tutorial${t.done ? " ✓" : ""}</button>` }));
      (s.plan ? s.plan.sessions.filter(x => x.date === d) : []).forEach(x =>
        items.push({ t: x.start, html: `<button class="cal-item ses ${x.done ? "done" : ""} ${!x.done && !x.folded && x.date < today ? "late" : ""}" style="${colorVars(x.classId)}" data-act="details" data-id="${x.id}"><span class="ci-time">${D.clock(x.start)}${x.done ? " ✓" : ""}</span>${esc(x.title)}</button>` }));
      items.sort((a, b) => a.t.localeCompare(b.t));
      return `<div class="cal-day ${d === today ? "today" : ""} ${d < today ? "past" : ""}">
        <div class="cal-head"><b>${D.daysShort[dow]}</b> <span>${D.pretty(d, false)}</span>${d === today ? ' <span class="today-tag">Today</span>' : ""}</div>
        <div class="cal-items">${items.map(i => i.html).join("") || '<p class="cal-empty">Nothing yet</p>'}</div>
        ${d >= today ? `<button class="cal-add" data-act="add-open" data-d="${d}" aria-label="Add to ${D.pretty(d)}">+ Add</button>` : ""}
      </div>`;
    };

    return `
      <div class="page-head"><h1>My Weekly Schedule</h1><p>Your week at a glance. Tap anything to see it or change it. Your study plan updates on its own.</p></div>

      <div class="week-actions">
        <button class="btn small" data-act="add-open" data-mode="tutorial">🙋 Add a tutorial</button>
        <button class="btn small ghost" data-act="add-open" data-mode="busy">📅 Add something I'm busy with</button>
        <button class="btn small ghost" data-act="add-open" data-mode="dayoff">😌 Add a day off</button>
      </div>

      <section class="cal" aria-label="${label}">
        <div class="cal-nav">
          <button class="icon-btn cal-arrow" data-act="week-nav" data-dir="-1" ${ui.weekOffset === 0 ? "disabled" : ""} aria-label="Previous week">◀</button>
          <div class="cal-title"><b>${label}</b><span>${range}</span></div>
          <button class="icon-btn cal-arrow" data-act="week-nav" data-dir="1" ${ui.weekOffset >= maxOffset ? "disabled" : ""} aria-label="Next week">▶</button>
        </div>
        <div class="cal-key small"><span class="k ses">Study session</span><span class="k tut">Tutorial</span><span class="k busy">Busy</span><span class="k off">Day off</span></div>
        <div class="cal-grid">${days.map(dayHTML).join("")}</div>
      </section>

      <section class="panel" style="margin-top:20px" aria-labelledby="study-h">
        <div class="panel-title"><h2 class="h3" id="study-h">📚 My study times</h2></div>
        ${studyTimeChoices()}
        <details class="more">
          <summary class="small">More options</summary>
          <div class="fields" style="margin-top:12px">
            <div class="field"><label for="wd-s">School days from</label><input id="wd-s" type="time" data-bind="prefs.weekdayStart" data-plan="1" data-rerender="1" value="${p.weekdayStart}"></div>
            <div class="field"><label for="wd-e">until</label><input id="wd-e" type="time" data-bind="prefs.weekdayEnd" data-plan="1" data-rerender="1" value="${p.weekdayEnd}"></div>
            <div class="field"><label for="we-s">Weekends from</label><input id="we-s" type="time" data-bind="prefs.weekendStart" data-plan="1" data-rerender="1" value="${p.weekendStart}"></div>
            <div class="field"><label for="we-e">until</label><input id="we-e" type="time" data-bind="prefs.weekendEnd" data-plan="1" data-rerender="1" value="${p.weekendEnd}"></div>
          </div>
          <div class="field"><label>Session length</label><div class="seg">${[20, 25, 30, 45].map(v => `<button type="button" data-act="set" data-path="prefs.sessionLen" data-num="1" data-plan="1" data-v="${v}" aria-pressed="${Number(p.sessionLen) === v}">${v} min</button>`).join("")}</div></div>
          <div class="field"><label>Most sessions on a school day</label><div class="seg">${[1, 2, 3].map(v => `<button type="button" data-act="set" data-path="prefs.maxWeekday" data-num="1" data-plan="1" data-v="${v}" aria-pressed="${Number(p.maxWeekday) === v}">${v}</button>`).join("")}</div></div>
          <p class="small"><button class="linkish" data-act="list-all">See all my busy times and tutorials as a list</button></p>
        </details>
      </section>
      ${s.plan ? "" : `<div class="btn-row" style="margin-top:20px"><a class="btn big" href="#start/1">Make my plan</a></div>`}`;
  }

  /* ---------- Adding and editing from the calendar ---------- */
  const BUSY_PRESETS = [["⚽", "Practice"], ["🏀", "Game"], ["🎭", "Rehearsal"], ["🎵", "Lesson"], ["📖", "Tutoring"], ["🍽️", "Family time"], ["🩺", "Appointment"]];

  function addModal(date, mode) {
    ui.addDate = date || "";
    ui.addMode = mode || "";
    const today = D.today();
    const lastExam = CFG.EXAMS.map(e => e.date).sort().slice(-1)[0];
    const when = date ? D.pretty(date) : "";
    const dateField = date ? "" : `<div class="field"><label for="add-date">Which day?</label><input id="add-date" type="date" min="${today}" max="${lastExam}" required></div>`;
    let body;
    if (!mode) {
      body = `<p class="muted">What do you want to add${when ? ` to <b>${when}</b>` : ""}?</p>
        <div class="save-options one-col">
          <button class="dl" data-act="add-mode" data-mode="tutorial"><span class="e" aria-hidden="true">🙋</span><b>A tutorial</b><span>${(CFG.TUTORIAL_TIMES || []).length > 1 ? CFG.TUTORIAL_TIMES.map(t => `${D.clock(t.start)}`).join(" or ") : `${D.clock(CFG.TUTORIAL_START)} to ${D.clock(CFG.TUTORIAL_END)}`} with a teacher</span></button>
          <button class="dl" data-act="add-mode" data-mode="busy"><span class="e" aria-hidden="true">📅</span><b>Something I'm busy with</b><span>Practice, rehearsal, lesson, family plans</span></button>
          <button class="dl" data-act="add-mode" data-mode="dayoff"><span class="e" aria-hidden="true">😌</span><b>A day off from studying</b><span>Your sessions move to other days</span></button>
        </div>`;
    } else if (mode === "tutorial") {
      body = date && D.isWeekend(date) ? `<p>Tutorials are on school days. Pick a weekday instead.</p>` : `
        <form data-addform="tutorial">
          ${dateField}
          <div class="field"><label for="add-class">Which class?</label>
            <select id="add-class">${CFG.EXAMS.map(e => `<option value="${e.id}" ${ui.tutClass === e.id ? "selected" : ""}>${esc(S.className(e.id))}</option>`).join("")}</select></div>
          ${(CFG.TUTORIAL_TIMES || []).length > 1 ? `<div class="field"><label>Which tutorial time?</label><div class="seg">${CFG.TUTORIAL_TIMES.map((t, i) => `<button type="button" data-act="tut-time" data-v="${t.id}" aria-pressed="${(ui.tutTime || CFG.TUTORIAL_TIMES[CFG.TUTORIAL_TIMES.length - 1].id) === t.id}">${esc(t.label)}: ${D.clock(t.start)} to ${D.clock(t.end)}</button>`).join("")}</div></div>`
            : `<p class="small muted">${D.clock(CFG.TUTORIAL_START)} to ${D.clock(CFG.TUTORIAL_END)}${when ? `, ${when}` : ""}.</p>`}
          <p class="small muted">Your shakiest topics will show as “Ask about.”</p>
          <button class="btn" type="submit">Add tutorial</button>
        </form>`;
    } else if (mode === "busy") {
      body = `
        <form data-addform="busy">
          <div class="field"><label for="add-label">What is it?</label><input id="add-label" type="text" required placeholder="Soccer practice"></div>
          <div class="chips" style="margin:-4px 0 12px">${BUSY_PRESETS.map(([e, l]) => `<button type="button" class="chip" data-act="add-preset" data-label="${l}">${e} ${l}</button>`).join("")}</div>
          <div class="field"><label>How often?</label>
            <div class="seg">
              <button type="button" data-act="add-repeat" data-v="weekly" aria-pressed="${ui.addRepeat !== "once"}">Every week</button>
              <button type="button" data-act="add-repeat" data-v="once" aria-pressed="${ui.addRepeat === "once"}">${date ? `Just ${D.pretty(date, false)}` : "Just once"}</button>
            </div>
          </div>
          <div id="add-days" ${ui.addRepeat === "once" ? "hidden" : ""}>
            <fieldset class="field" style="border:0;padding:0;margin:0 0 12px"><legend class="small" style="font-weight:600;margin-bottom:4px">Which days? <span class="muted" style="font-weight:500">Tap a quick choice or pick days</span></legend>${dayPicker(date ? [D.dow(date)] : [])}</fieldset>
          </div>
          ${!date ? `<div class="field" id="add-once-date" ${ui.addRepeat === "once" ? "" : "hidden"}><label for="add-date">Which day?</label><input id="add-date" type="date" min="${today}" max="${lastExam}"></div>` : ""}
          <div class="fields">
            <div class="field"><label for="add-start">Starts</label><input id="add-start" type="time" value="16:00" required></div>
            <div class="field"><label for="add-end">Ends (with travel)</label><input id="add-end" type="time" value="17:30" required></div>
          </div>
          <button class="btn" type="submit" style="margin-top:4px">Add it</button>
        </form>`;
    } else {
      body = `<form data-addform="dayoff">${dateField}
        <p>No studying ${when ? `on <b>${when}</b>` : "that day"}. Your sessions will move to other days.</p>
        <button class="btn" type="submit">Add day off</button></form>`;
    }
    openModal(`<div class="modal-body"><h3>${mode === "tutorial" ? "🙋 Add a tutorial" : mode === "busy" ? "📅 Add something I'm busy with" : mode === "dayoff" ? "😌 Add a day off" : `Add to ${when || "my schedule"}`}</h3>${body}</div>
      <div class="modal-foot">${mode && !ui.addFixedMode ? `<button class="btn ghost" data-act="add-mode" data-mode="">Back</button>` : ""}<button class="btn ghost" data-act="modal-close">Cancel</button></div>`);
    const f = $("#modal form");
    if (f) f.addEventListener("submit", ev => { ev.preventDefault(); submitAdd(f.dataset.addform); });
  }

  function submitAdd(kind) {
    const s = st();
    const date = ui.addDate || ($("#add-date") || {}).value;
    const repeating = kind === "busy" && ui.addRepeat !== "once";
    if (!date && !repeating) { toast("Pick a day."); return; }
    if (kind === "tutorial") {
      if (D.isWeekend(date)) { toast("Tutorials are on school days. Pick a weekday."); return; }
      const times = CFG.TUTORIAL_TIMES || [{ id: "default", start: CFG.TUTORIAL_START, end: CFG.TUTORIAL_END }];
      const tt = times.find(t => t.id === ui.tutTime) || times[times.length - 1];
      if ((s.tutorials || []).some(t => t.date === date && t.start === tt.start)) { toast("You already have a tutorial at that time."); return; }
      const classId = $("#add-class").value;
      s.tutorials.push({ id: uid(), classId, date, start: tt.start, end: tt.end, done: false });
      s.tutorialsUpdatedAt = Date.now();
      toast(`Added: ${S.className(classId)} tutorial, ${D.pretty(date)}`);
    } else if (kind === "busy") {
      const label = $("#add-label").value.trim(), start = $("#add-start").value, end = $("#add-end").value;
      if (!label) { toast("Add what it is."); return; }
      if (end <= start) { toast("The end time needs to be after the start time."); return; }
      if (repeating) {
        const days = $$("#modal input[name=day]:checked").map(i => Number(i.value));
        if (!days.length) { toast("Pick at least one day."); return; }
        s.busy.push({ id: uid(), label, type: "weekly", days, start, end });
        toast(`Added ${label}: every ${days.map(d => D.daysShort[d]).join(", ")}. Your plan is updating around it.`);
      } else {
        s.busy.push({ id: uid(), label, type: "once", date, start, end });
        toast(`Added ${label} on ${D.pretty(date)}. Your plan is updating around it.`);
      }
    } else {
      if (!s.prefs.offDates.includes(date)) s.prefs.offDates.push(date);
      toast("Day off added. Your sessions are moving.");
    }
    ui.tutClass = null;
    closeModal();
    save({ planInputs: true });
    render();
  }

  function tutorialEdit(id) {
    const t = (st().tutorials || []).find(x => x.id === id);
    if (!t) return;
    const topics = askTopics(t.classId);
    const q = (st().classes[t.classId].questions || "").trim();
    openModal(`<div class="modal-body"><h3>🙋 ${esc(S.className(t.classId))} tutorial</h3>
      <p>${D.pretty(t.date)}, ${D.clock(t.start)} to ${D.clock(t.end)}</p>
      ${topics.length ? `<h4>Ask about</h4><ul>${topics.slice(0, 3).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${q ? `<h4>My questions</h4><p class="small" style="white-space:pre-line">${esc(q)}</p>` : ""}
      <p class="small"><a href="#tips/tutorials" data-act="modal-close">How to get the most from tutorials</a></p></div>
      <div class="modal-foot">
        <button class="btn ghost" data-act="tut-del" data-id="${t.id}">Remove</button>
        <button class="btn" data-act="tut-done" data-id="${t.id}">${t.done ? "Mark not gone" : "✓ I went"}</button>
      </div>`);
  }

  function busyEdit(id) {
    const b = st().busy.find(x => x.id === id);
    if (!b) return;
    const when = b.type === "weekly" ? `Every ${(b.days || []).map(d => D.days[d]).join(", ")}` : D.pretty(b.date);
    openModal(`<div class="modal-body"><h3>📅 ${esc(b.label || "Busy")}</h3>
      <p>${when}, ${D.clock(b.start)} to ${D.clock(b.end)}</p>
      <p class="small muted">Your study plan works around this. To change the time, remove it and add it again.</p></div>
      <div class="modal-foot"><button class="btn ghost" data-act="modal-close">Close</button><button class="btn" data-act="busy-del" data-id="${b.id}">${b.type === "weekly" ? "Remove (every week)" : "Remove"}</button></div>`);
  }

  function listAll() {
    const s = st();
    const busy = s.busy.map(b => `<li class="busy-item"><span class="grow"><b>${esc(b.label || "Busy")}</b><br><span class="when">${b.type === "weekly" ? `Every ${(b.days || []).map(d => D.daysShort[d]).join(", ")}` : D.pretty(b.date)}, ${D.clock(b.start)} to ${D.clock(b.end)}</span></span><button class="icon-btn" data-act="busy-del" data-id="${b.id}" aria-label="Remove ${esc(b.label)}">🗑️</button></li>`).join("");
    const tuts = (s.tutorials || []).slice().sort((a, b) => a.date.localeCompare(b.date)).map(t => `<li class="busy-item"><span class="grow"><b>${esc(S.className(t.classId))} tutorial</b><br><span class="when">${D.pretty(t.date)}${t.done ? ", went ✓" : ""}</span></span><button class="icon-btn" data-act="tut-del" data-id="${t.id}" aria-label="Remove tutorial">🗑️</button></li>`).join("");
    const offs = (s.prefs.offDates || []).slice().sort().map(d => `<li class="busy-item"><span class="grow"><b>Day off</b><br><span class="when">${D.pretty(d)}</span></span><button class="icon-btn" data-act="off-del" data-d="${d}" aria-label="Remove day off">🗑️</button></li>`).join("");
    openModal(`<div class="modal-body"><h3>Everything on my schedule</h3>
      <h4>Busy times</h4>${busy ? `<ul class="busy-list">${busy}</ul>` : `<p class="small muted">None yet.</p>`}
      <h4 style="margin-top:14px">Tutorials</h4>${tuts ? `<ul class="busy-list">${tuts}</ul>` : `<p class="small muted">None yet.</p>`}
      <h4 style="margin-top:14px">Days off</h4>${offs ? `<ul class="busy-list">${offs}</ul>` : `<p class="small muted">None yet.</p>`}</div>
      <div class="modal-foot"><button class="btn" data-act="modal-close">Done</button></div>`);
  }

  /* ======================================================================
     TIPS
     ====================================================================== */
  function pageTips(id) {
    if (!id) {
      return `
        <div class="page-head"><h1>Tips</h1><p>Short and useful. Pick one.</p></div>
        <div class="tip-grid">${C.tips.map(t => `<a class="tip-card" href="#tips/${t.id}"><span class="e" aria-hidden="true">${t.emoji}</span><b>${esc(t.title)}</b><span>${esc(t.blurb)}</span></a>`).join("")}</div>`;
    }
    const t = C.tips.find(x => x.id === id);
    if (!t) return pageTips();
    const back = `<a class="back" href="#tips">← All tips</a>`;
    const head = `<div class="page-head">${back}<h1><span aria-hidden="true">${t.emoji}</span> ${esc(t.title)}</h1></div>`;

    if (id === "tutorials") return head + tipsTutorials();
    if (id === "help") return head + tipsHelp();
    if (id === "time") return head + tipsTime();
    if (id === "mindprint") return CFG.MINDPRINT ? head + tipsMindprint() : `<div class="page-head"><h1>Tips</h1></div><p><a href="#tips">See all tips</a></p>`;
    if (id === "myths") return head + `<p class="muted">Guess, then tap to flip.</p><div class="myths">${C.myths.map((m, i) => `
      <button class="flip" data-act="flip" data-i="${i}" aria-pressed="${!!ui.flipped[i]}">
        <span class="flip-inner">
          <span class="face front"><span style="font-weight:700;font-size:1.05rem">${esc(m.claim)}</span><small>Tap to flip</small></span>
          <span class="face back"><span class="verdict ${m.answer.toLowerCase()}">${m.answer}</span><span class="small">${esc(m.why)}</span></span>
        </span>
      </button>`).join("")}</div>`;
    if (t.checklist) return head + `<section class="panel"><ul class="checklist">${t.checklist.map((c, i) => `<li><label><input type="checkbox" data-examcheck="${i}" ${ui.examChecks[i] ? "checked" : ""}> ${esc(c)}</label></li>`).join("")}</ul></section>`;
    return head + `<p class="muted">${esc(t.blurb)}</p><div class="tip-list">${t.cards.map(c => `
      <section class="tip-item"><h3>${esc(c.title)}</h3><p>${esc(c.body)}</p><div class="try"><b>Try it:</b> ${esc(c.try)}</div></section>`).join("")}</div>`;
  }

  const HELP = [
    { q: "Print my study plan", a: "Tap “Print my plan” on Today or My Study Plan. On an iPad, choose your printer, or tap Share to save it as a PDF.", btn: "Print it now", act: "exp-print" },
    { q: "Print one page for exam week", a: "It lists each exam, your practice exams and tutorials, and the night-before and exam-morning checklists.", btn: "Print my exam week page", act: "exp-examweek" },
    { q: "Add my plan to my calendar", a: "Tap “Add to my calendar” on Today or My Study Plan and follow the steps.", btn: "Add it now", act: "add-calendar" },
    { q: "Start a study session", a: "Tap any session, then tap ▶ Start. You get a timer, what to do, and a break.", btn: "Go to Today", href: "#today" },
    { q: "Move a session I can't do", a: "Tap the session, then “Move it.” Pick later today or another day.", btn: "Open my study plan", href: "#plan" },
    { q: "Make up a missed session", a: "Tap “Make up missed sessions.” Move them to new times, or fit them into your next session for each class.", btn: "Make them up", act: "make-up" },
    { q: "My plan says exams are close", a: "That's short-on-time mode. Your plan focuses on your shakiest topics and a practice exam for each class. Want more? Add more study time.", btn: "Add more study time", act: "more-time" },
    { q: "Add one more session today", a: "Tap “Add a session today” on Today. You get a quick practice session on your shakiest topic.", btn: "Add one now", act: "add-today" },
    { q: "Add a tutorial, practice, or day off", a: "Go to My Weekly Schedule and tap “+ Add” on any day.", btn: "Open my schedule", href: "#week" },
    { q: "Add a study guide", a: "Go to My classes, tap a class, then upload the study guide or paste its text.", btn: "Open My classes", href: "#classes" },
    { q: "Change how I feel about a topic", a: "On My classes, tap a different face. Your plan adjusts on its own. You can also do it after each session.", btn: "Open My classes", href: "#classes" },
    { q: "Undo something", a: "Right after you change something, tap “Undo” in the message at the bottom of the screen.", btn: null },
    { q: "Make the text bigger or hear it read aloud", a: "Tap “Aa” at the top for bigger text, an easier font, or high contrast. Tap 🔊 next to any instruction to hear it.", btn: "Open text settings", act: "display" },
    { q: "Use my plan on another device", a: "Save a backup file here, then load it on the other device.", btn: "Save a backup file", act: "backup-save", btn2: "Load a backup", act2: "backup-load" },
    { q: "Start over", a: "Tap “Start over” at the top. You can redo setup or erase everything.", btn: "Start over", act: "start-over" },
    { q: "I'm feeling overwhelmed", a: "That's normal before exams. Try breathing, extra breaks, or talking to someone.", btn: "Get help now", act: "overwhelmed" }
  ];

  function tipsHelp() {
    return `<p class="lead">Quick answers. Tap a button to do it right now.</p>
      <div class="help-list">${HELP.map(h => `<section class="help-item"><h2 class="h4">${esc(h.q)}</h2><p>${esc(h.a)}</p>
        ${h.btn ? `<div class="btn-row">${h.href ? `<a class="btn small" href="${h.href}">${esc(h.btn)}</a>` : `<button class="btn small" data-act="${h.act}">${esc(h.btn)}</button>`}${h.btn2 ? `<button class="btn small ghost" data-act="${h.act2}">${esc(h.btn2)}</button>` : ""}</div>` : ""}</section>`).join("")}</div>
`;
  }

  function tipsTutorials() {
    const T = C.tutorials;
    const s = st();
    const topics = CFG.EXAMS.map(e => ({ e, list: askTopics(e.id).slice(0, 3) })).filter(x => x.list.length);
    return `
      <p class="lead">${esc(T.intro)} They're ${D.clock(CFG.TUTORIAL_START)} to ${D.clock(CFG.TUTORIAL_END)}</p>
      <div class="phases">${T.phases.map(ph => `<section class="panel phase"><h2 class="h3"><span aria-hidden="true">${ph.emoji}</span> ${esc(ph.title)}</h2><ul>${ph.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul></section>`).join("")}</div>
      <div class="grid two" style="margin-top:20px;align-items:start">
        <section class="panel"><h3>Topics to ask about</h3>
          ${topics.length ? topics.map(x => `<div class="ask" style="${colorVars(x.e.id)}"><b>${esc(S.className(x.e.id))}</b><ul>${x.list.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>`).join("")
            : `<p class="small muted">These come from the topics you rate on <a href="#classes">My classes</a>. Your shakiest ones show up here.</p>`}
          <a class="btn small" href="#week" style="margin-top:10px">Plan a tutorial</a>
        </section>
        <section class="panel"><h3>Questions that work</h3>
          <ul class="starters">${T.starters.map(q => `<li>"${esc(q)}"</li>`).join("")}</ul>
          <h4 style="margin-top:16px">Need to email your teacher?</h4>
          <div class="try small email">${esc(T.email)}</div>
          <button class="btn small ghost" style="margin-top:8px" data-act="copy-email">Copy this email</button>
        </section>
      </div>`;
  }

  function tipsTime() {
    const s = st();
    const a = s.accom;
    const base = CFG.EXAM_MINUTES;
    const total = S.examMinutes();
    const preview = Math.round(total * 0.07), check = Math.round(total * 0.15), answer = total - preview - check;
    const half = preview + Math.round(answer / 2);
    const E = C.extended;
    const opts = [["none", "No"], ["1.5", "Time and a half"], ["2", "Double time"], ["custom", "Something else"]];
    return `
      <section class="panel">
        <div class="field"><label>Do you get extended time on tests?</label>
          <div class="seg">${opts.map(([v, l]) => `<button type="button" data-act="set" data-path="accom.extended" data-plan="1" data-v="${v}" aria-pressed="${a.extended === v}">${l}</button>`).join("")}</div></div>
        ${a.extended === "custom" ? `<div class="field"><label for="cm">Minutes per exam</label><input id="cm" type="number" min="${base}" max="300" data-bind="accom.customMinutes" data-plan="1" data-rerender="1" value="${esc(a.customMinutes)}" style="max-width:140px"></div>` : ""}
        <p class="xs muted">Not sure? Ask your advisor.</p>
        <div class="bignum">${total} minutes</div>
        <h2 class="h4" style="margin-top:14px">Your pacing plan</h2>
        <div class="pace" role="img" aria-label="Look over ${preview} minutes, answer ${answer} minutes, check ${check} minutes">
          <div class="p1" style="flex:${preview}">${preview}m</div><div class="p2" style="flex:${answer}">Answer: ${answer} min</div><div class="p3" style="flex:${check}">Check ${check}m</div>
        </div>
        <div class="pace-label"><span>Look it over</span><span>Minute ${half}: about halfway</span><span>Check your work</span></div>
      </section>
      <div class="grid two" style="margin-top:20px">
        <section class="panel"><h3>Why it matters</h3>${E.why.map(w => `<p><b>${esc(w.title)}.</b> ${esc(w.body)}</p>`).join("")}</section>
        <section class="panel"><h3>Slow down on purpose</h3><ul>${E.slowDown.map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>
      </div>`;
  }

  /* ---------- MindPrint ---------- */
  function tipsMindprint() {
    const s = st();
    const set = S.mpIsSet();
    const upload = `
      <label class="drop big-drop" data-mpdrop>
        <input type="file" accept=".pdf,.docx,.txt,image/*" data-mpupload>
        📤 Upload my MindPrint report<br><span class="xs muted">The PDF from MindPrint. We'll read it and you check it.</span>
      </label>
      ${s.mindprintReport ? `<p class="small" style="margin:8px 0 0">📄 ${s.mindprintReport.link ? `<a href="${esc(s.mindprintReport.link)}" target="_blank" rel="noopener">${esc(s.mindprintReport.name)}</a>` : esc(s.mindprintReport.name)}</p>` : ""}`;

    if (!set && !ui.mpEdit) {
      return `
        <p class="lead">MindPrint shows how your brain learns best. Add yours and your study sessions will play to your strengths.</p>
        <section class="panel">${upload}
          <p class="small" style="margin:12px 0 0">No PDF? <button class="linkish" data-act="mp-edit">Enter it yourself</button>. Don't have a report at all? Ask your advisor.</p>
        </section>`;
    }
    return `
      ${set ? `<section class="panel playbook">${playbookHTML()}</section>` : ""}
      <p style="margin-top:16px">${ui.mpEdit ? "" : `<button class="linkish" data-act="mp-edit">Change my MindPrint</button>`}</p>
      ${ui.mpEdit ? mpEditor(upload) : ""}`;
  }

  function mpEditor(upload) {
    const MP = C.mindprint;
    const m = st().mindprint;
    return `
      <section class="panel" style="margin-top:12px">
        <h3>My MindPrint profile</h3>
        ${upload}
        <p class="small muted" style="margin-top:14px">Or match your report by hand: use ▲ ▼ so each box lists your skills in the same order as your report (strongest first). Then tap the box that's highlighted on your report.</p>
        <div class="mp-boxes">${MP.domains.map(d => {
          const order = m.order[d.id] || d.skills;
          const isSet = !!m.order[d.id];
          const strongest = m.strongest === d.id;
          return `<div class="mp-box ${strongest ? "strongest" : ""} ${isSet ? "" : "unset"}">
            <div class="mp-box-head"><h4>${esc(d.name)}</h4></div>
            <ol class="mp-rank">${order.map((id, i) => `<li class="${i === 0 && isSet ? "first" : ""}">
              <span class="mp-name">${esc(MP.skills[id].name)}</span>
              <span class="mp-move">
                <button class="icon-btn" data-act="mp-move" data-cat="${d.id}" data-skill="${id}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Move ${esc(MP.skills[id].name)} up">▲</button>
                <button class="icon-btn" data-act="mp-move" data-cat="${d.id}" data-skill="${id}" data-dir="1" ${i === order.length - 1 ? "disabled" : ""} aria-label="Move ${esc(MP.skills[id].name)} down">▼</button>
              </span></li>`).join("")}</ol>
            ${isSet ? "" : `<button class="btn small" data-act="mp-confirm" data-cat="${d.id}">Matches my report</button>`}
            <button class="mp-star" data-act="mp-strongest" data-cat="${d.id}" aria-pressed="${strongest}">${strongest ? "★ Highlighted on my report" : "☆ Highlighted on my report?"}</button>
          </div>`;
        }).join("")}</div>
        <div class="btn-row" style="margin-top:14px"><button class="btn" data-act="mp-done">Done</button>
        ${S.mpIsSet() ? `<button class="linkish small" data-act="mp-clear">Clear my MindPrint</button>` : ""}</div>
      </section>`;
  }

  function playbookHTML() {
    const MP = C.mindprint;
    const m = st().mindprint;
    const doms = MP.domains.filter(d => m.order[d.id]);
    const strongestDom = MP.domains.find(d => d.id === m.strongest && m.order[d.id]);
    const superSkill = strongestDom ? MP.skills[m.order[strongestDom.id][0]] : null;

    const known = (m.strategies || []).map(name => {
      const def = MP.strategies.find(x => x.name.toLowerCase() === name.toLowerCase());
      return def && def.when === "test" ? def : null;
    }).filter(Boolean);
    const shown = ui.mpAll ? known : known.slice(0, 3);

    return `
      ${superSkill ? `<div class="superpower"><span class="sp-emoji" aria-hidden="true">${superSkill.icon}</span><div><b>Your superpower: ${esc(superSkill.name)}</b><span class="small">When you're stuck, start here.</span></div></div>` : ""}
      <div class="pb-cols">
        <div><h2 class="pb-sub h3">Lean on these</h2><ul class="pb-simple">${doms.map(d => {
          const sk = MP.skills[m.order[d.id][0]];
          return `<li><b>${esc(sk.name)}:</b> ${esc(sk.strength[0])}</li>`;
        }).join("")}</ul></div>
        <div><h2 class="pb-sub h3">Work around these</h2><ul class="pb-simple">${doms.map(d => {
          const list = m.order[d.id];
          const sk = MP.skills[list[list.length - 1]];
          return `<li><b>${esc(sk.name)}:</b> ${esc(sk.support[0])}</li>`;
        }).join("")}</ul></div>
      </div>
      ${known.length ? `<h2 class="pb-sub h3">From your report, for exam day</h2>
        <ul class="strat-list">${shown.map(k => `<li><b>${esc(k.name)}</b><span>${esc(k.use)}</span></li>`).join("")}</ul>
        ${known.length > 3 ? `<button class="linkish small" data-act="mp-all">${ui.mpAll ? "Show less" : `Show all ${known.length}`}</button>` : ""}` : ""}
      <p class="small muted" style="margin-top:12px">Your study sessions already include these ideas.</p>`;
  }

  /* ======================================================================
     UPLOADS
     ====================================================================== */
  async function handleFiles(classId, files) {
    const c = st().classes[classId];
    const name = S.className(classId);
    let found = [], unreadable = 0;
    for (const file of files) {
      toast(`Reading ${file.name}...`);
      const record = { name: file.name, link: "" };
      if (window.Drive.user) {
        try { const r = await window.Drive.uploadGuide(file, name); record.link = r.webViewLink || ""; }
        catch (err) { toast(`Couldn't save to Drive: ${err.message}`); }
      }
      c.guides.push(record);
      try {
        const r = await window.StudyGuide.readGuide(file);
        if (!r.readable) unreadable++; else found = found.concat(r.topics);
      } catch (err) { unreadable++; }
    }
    save({ planInputs: true });
    render();
    if (found.length) reviewTopics(classId, found);
    else if (unreadable) toast("Saved. We can't read photos, so type the topics in.");
    else toast("We couldn't find topics in that file. Type them in instead.");
  }

  function reviewTopics(classId, list) {
    // list items are { text, details } (older callers may pass plain strings)
    const items = list.map(x => typeof x === "string" ? { text: x, details: [] } : x);
    const existing = new Set(st().classes[classId].topics.map(t => t.text.toLowerCase()));
    const seen = new Set();
    const fresh = items.filter(t => { const k = t.text.toLowerCase(); if (existing.has(k) || seen.has(k)) return false; seen.add(k); return true; });
    if (!fresh.length) { toast("Those topics are already on your list."); return; }
    openModal(`
      <form method="dialog">
        <div class="modal-body">
          <h3>We found ${fresh.length} topic${fresh.length === 1 ? "" : "s"}</h3>
          <p class="muted">Uncheck anything that isn't really a topic. You can rename them after.</p>
          <ul class="pick-list">${fresh.map((t, i) => `<li><label><input type="checkbox" name="t" value="${i}" checked>
            <span><b>${esc(t.text)}</b>${t.details.length ? `<br><span class="small muted">${esc(t.details.join(", "))}</span>` : ""}${(t.resources || []).length ? `<br><span class="xs"><b>Use:</b> ${esc(t.resources.join("; "))}</span>` : ""}</span></label></li>`).join("")}</ul>
        </div>
        <div class="modal-foot"><button class="btn ghost" type="button" data-act="modal-close">Cancel</button><button class="btn" type="submit">Add them</button></div>
      </form>`);
    $("#modal form").addEventListener("submit", ev => {
      ev.preventDefault();
      const picks = $$("#modal input[name=t]:checked").map(i => fresh[Number(i.value)]);
      const c = st().classes[classId];
      picks.forEach(t => c.topics.push({ id: uid(), text: t.text, details: t.details || [], resources: t.resources || [], conf: Number(c.confidence) || 3 }));
      closeModal();
      save({ planInputs: true });
      render();
      toast(`Added ${picks.length}. Now tap a face for each one.`);
    });
  }

  function pasteModal(classId) {
    openModal(`
      <form method="dialog">
        <div class="modal-body">
          <h3>Paste your study guide</h3>
          <label for="paste-box" class="sr-only">Study guide text</label>
          <textarea id="paste-box" style="min-height:220px" placeholder="Paste the text here"></textarea>
        </div>
        <div class="modal-foot"><button class="btn ghost" type="button" data-act="modal-close">Cancel</button><button class="btn" type="submit">Find topics</button></div>
      </form>`);
    $("#modal form").addEventListener("submit", ev => {
      ev.preventDefault();
      const list = window.StudyGuide.readPasted($("#paste-box").value);
      closeModal();
      if (list.length) reviewTopics(classId, list); else toast("We couldn't find topics. Try adding them one at a time.");
    });
  }

  async function handleMindprint(file) {
    toast("Reading your report...");
    const rec = { name: file.name, link: "" };
    if (window.Drive.user) {
      try { const r = await window.Drive.uploadToSubfolder(file, "MindPrint", "mindprintFolderId", `MindPrint report - ${file.name}`); rec.link = r.webViewLink || ""; }
      catch (err) { toast(`Couldn't save to Drive: ${err.message}`); }
    }
    st().mindprintReport = rec;
    save();
    let found = null, readable = true;
    try {
      const text = await window.StudyGuide.extract(file);
      if (text == null) readable = false; else found = window.StudyGuide.readMindprint(text);
    } catch (e) { readable = false; }
    render();
    if (found && Object.keys(found.order || {}).length) reviewMindprint(found);
    else {
      ui.mpEdit = true;
      render();
      openModal(`<div class="modal-body"><h3>We saved your report</h3>
        <p>${readable ? "We couldn't read the skills from it." : "We can't read photos."} Open your report and use ▲ ▼ to put the skills in the same order. It takes about a minute.</p></div>
        <div class="modal-foot"><button class="btn" data-act="modal-close">OK</button></div>`);
    }
  }

  function reviewMindprint(found) {
    const MP = C.mindprint;
    const cats = MP.domains.filter(d => found.order[d.id]);
    openModal(`
      <form method="dialog">
        <div class="modal-body">
          <h3>Does this match your report?</h3>
          <div class="mp-boxes compact">${cats.map(d => `
            <div class="mp-box"><div class="mp-box-head"><h4>${esc(d.name)}</h4></div>
              <ol class="mp-rank">${found.order[d.id].map(id => `<li><span class="mp-name">${esc(MP.skills[id].name)}</span></li>`).join("")}</ol>
            </div>`).join("")}</div>
          <fieldset style="border:0;padding:0;margin:14px 0 0">
            <legend style="font-weight:700;margin-bottom:6px">Which box is highlighted on your report?</legend>
            <div class="seg">${MP.domains.map(d => `<label class="seg-radio"><input type="radio" name="strongest" value="${d.id}"><span>${esc(d.name)}</span></label>`).join("")}
              <label class="seg-radio"><input type="radio" name="strongest" value="" checked><span>Not sure</span></label></div>
          </fieldset>
        </div>
        <div class="modal-foot"><button class="btn ghost" type="button" data-act="mp-fix">No, let me fix it</button><button class="btn" type="submit">Yes, save it</button></div>
      </form>`);
    const apply = () => {
      const m = st().mindprint;
      Object.assign(m.order, found.order);
      Object.assign(m.top, found.top);
      if (found.strategies.length) m.strategies = found.strategies;
      const pick = $("#modal input[name=strongest]:checked");
      if (pick && pick.value) m.strongest = pick.value;
    };
    $("#modal form").addEventListener("submit", ev => {
      ev.preventDefault();
      apply();
      ui.mpEdit = false;
      closeModal();
      save({ planInputs: true });
      render();
      toast("MindPrint saved.");
    });
    $("#modal [data-act=mp-fix]").addEventListener("click", ev => {
      ev.stopPropagation();
      apply();
      ui.mpEdit = true;
      closeModal();
      save({ planInputs: true });
      render();
    });
  }

  /* ---------- Google Calendar ---------- */
  async function syncGoogleCalendar() {
    if (!st().plan) { toast("Make your plan first."); return; }
    try {
      if (!window.Drive.user) await signIn(true);
      else await window.Drive.connectCalendar();
      if (!window.Drive.user) return;
      if (!window.Drive.hasCalendar()) throw new Error("Calendar permission wasn't given. Try again and check the Google Calendar box.");
      closeModal();
      toast("Adding to Google Calendar...");
      const n = await window.Drive.syncCalendar(window.Exports.googleEvents(), (done, total) => {
        $("#toast").textContent = `Adding to Google Calendar: ${Math.round(100 * done / total)}%`;
      });
      st().drive.calendarSyncedAt = Date.now();
      save({ now: true });
      render();
      openModal(`<div class="modal-body"><h3>🔔 It's on your Google Calendar</h3>
        <p>${n} events are in a calendar called <b>Exam Prep HQ</b>. You'll get a reminder 10 minutes before each session.</p>
        <p class="small muted">If you update your plan, tap "Update Google Calendar" so it matches.</p></div>
        <div class="modal-foot"><button class="btn ghost" data-act="modal-close">Close</button><a class="btn" href="https://calendar.google.com" target="_blank" rel="noopener">Open Google Calendar</a></div>`);
    } catch (err) {
      toast(`Couldn't update Google Calendar: ${err.message}`);
    }
  }

  /* ======================================================================
     ROUTER + RENDER
     ====================================================================== */
  function route() {
    const [page, sub] = (location.hash || "#today").slice(1).split("/");
    const known = ["today", "plan", "classes", "week", "tips", "start"];
    return { page: known.includes(page) ? page : "today", sub };
  }

  let lastKey = null;
  function render() {
    const r = route();
    renderTabs(r.page === "start" ? "" : r.page);
    renderAccount();
    document.body.classList.toggle("in-setup", r.page === "start");
    const html = r.page === "today" ? pageToday() : r.page === "plan" ? pagePlan() : r.page === "classes" ? pageClasses()
      : r.page === "week" ? pageWeek() : r.page === "tips" ? pageTips(r.sub) : pageStart(r.sub);
    $("#main").innerHTML = demoBanner() + html;
    const tab = TABS.find(x => x.id === r.page);
    document.title = `${tab ? tab.label : "Make my plan"} | Exam Prep HQ`;
    bindDrops();
    const key = r.page + "/" + (r.sub || "");
    if (key !== lastKey) {
      if (lastKey !== null) { window.scrollTo(0, 0); $("#main").focus({ preventScroll: true }); }
      lastKey = key;
    }
  }

  function rerenderKeepFocus(el) {
    const key = el && el.dataset ? JSON.stringify(el.dataset) : null;
    render();
    if (!key) return;
    const match = $$("[data-act]").find(x => JSON.stringify(x.dataset) === key);
    if (match) match.focus({ preventScroll: true });
  }

  function setPath(path, value) {
    const parts = path.split(".");
    let o = st();
    parts.slice(0, -1).forEach(p => { o = o[p]; });
    o[parts[parts.length - 1]] = value;
  }

  function bindDrops() {
    const wire = (sel, fn) => $$(sel).forEach(z => {
      z.addEventListener("dragover", e => { e.preventDefault(); z.classList.add("over"); });
      z.addEventListener("dragleave", () => z.classList.remove("over"));
      z.addEventListener("drop", e => { e.preventDefault(); z.classList.remove("over"); if (e.dataTransfer.files.length) fn(z, Array.from(e.dataTransfer.files)); });
    });
    wire("[data-drop]", (z, files) => handleFiles(z.dataset.drop, files));
    wire("[data-mpdrop]", (z, files) => handleMindprint(files[0]));
  }

  /* ---------- Clicks ---------- */
  document.addEventListener("click", async e => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const s = st();
    switch (el.dataset.act) {
      case "set":
        setPath(el.dataset.path, el.dataset.num ? Number(el.dataset.v) : el.dataset.v);
        save({ planInputs: !!el.dataset.plan });
        rerenderKeepFocus(el);
        break;
      case "study-time":
        s.prefs[`${el.dataset.which}Start`] = el.dataset.start;
        s.prefs[`${el.dataset.which}End`] = el.dataset.end;
        save({ planInputs: true });
        rerenderKeepFocus(el);
        break;
      case "class-conf": {
        const c = s.classes[el.dataset.class];
        const old = Number(c.confidence);
        c.confidence = Number(el.dataset.v);
        c.topics.forEach(t => { if (Number(t.conf) === old) t.conf = c.confidence; });
        save({ planInputs: true });
        rerenderKeepFocus(el);
        break;
      }
      case "topic-conf": {
        const t = s.classes[el.dataset.class].topics.find(x => x.id === el.dataset.id);
        const anyDone = s.plan && s.plan.sessions.some(x => x.classId === el.dataset.class && x.done);
        if (t) { if (anyDone && !t.firstConf) t.firstConf = Number(t.conf); t.conf = Number(el.dataset.v); }
        save({ planInputs: true });
        rerenderKeepFocus(el);
        break;
      }
      case "topic-del":
        undoable("Topic removed.", () => { s.classes[el.dataset.class].topics = s.classes[el.dataset.class].topics.filter(x => x.id !== el.dataset.id); save({ planInputs: true }); });
        render(); break;
      case "guide-del":
        s.classes[el.dataset.class].guides.splice(Number(el.dataset.i), 1);
        save(); render(); break;
      case "class-toggle":
        ui.openClass = ui.openClass === el.dataset.class ? null : el.dataset.class;
        rerenderKeepFocus(el); break;
      case "paste": pasteModal(el.dataset.class); break;
      case "modal-close": closeModal(); break;

      case "preset": ui.busyOpen = true; ui.busyLabel = el.dataset.label; ui.busyType = "weekly"; render(); { const i = $("#b-label"); if (i) i.focus(); } break;
      case "busy-cancel": ui.busyOpen = false; render(); break;
      case "busy-type": ui.busyLabel = ($("#b-label") || {}).value || ""; ui.busyType = el.dataset.v; rerenderKeepFocus(el); break;
      case "busy-del": {
        const inList = $("#modal").open && $("#modal .busy-list");
        undoable("Removed. Your plan is updating.", () => { s.busy = s.busy.filter(b => b.id !== el.dataset.id); save({ planInputs: true }); });
        if (inList) listAll(); else closeModal();
        render(); break;
      }
      case "off-del": {
        const inList = $("#modal").open && $("#modal .busy-list");
        undoable("Day off removed.", () => { s.prefs.offDates = s.prefs.offDates.filter(d => d !== el.dataset.d); save({ planInputs: true }); });
        if (inList) listAll(); else closeModal();
        render(); break;
      }

      case "tut-done": {
        const t = s.tutorials.find(x => x.id === el.dataset.id);
        if (t) { t.done = !t.done; if (t.done) toast("Nice. If a topic feels better now, tap a happier face on My classes."); }
        s.tutorialsUpdatedAt = Date.now(); save(); if ($("#modal").open) closeModal(); rerenderKeepFocus(el); break;
      }
      case "tut-del": {
        const inList = $("#modal").open && $("#modal .busy-list");
        undoable("Tutorial removed.", () => { s.tutorials = s.tutorials.filter(x => x.id !== el.dataset.id); s.tutorialsUpdatedAt = Date.now(); save({ planInputs: true }); });
        if (inList) listAll(); else closeModal();
        render(); break;
      }

      case "wiz-finish":
        s.plan = window.Planner.generate(s);
        s.planStale = false;
        s.onboarded = true;
        save();
        location.hash = "#start/done";
        confetti();
        break;
      case "build": buildPlan(); render(); break;
      case "toggle-session": {
        const x = s.plan.sessions.find(y => y.id === el.dataset.id);
        if (x) undoable(x.done ? "Marked not done." : ["Nice work.", "Done. Another one down.", "That's how it's done.", "Keep it up."][Math.floor(Math.random() * 4)], () => { x.done = !x.done; save(); });
        rerenderKeepFocus(el); break;
      }
      case "toggle-past": ui.showPast = !ui.showPast; render(); break;
      case "reset":
      case "start-over": startOverMenu(); break;
      case "redo-setup": closeModal(); location.hash = "#start/1"; break;
      case "erase-ask": eraseConfirm(); break;
      case "erase-all": eraseAll(); break;

      case "undo": { const f = undoFn; undoFn = null; if (f) f(); break; }
      case "toggle-skip": {
        const c = s.classes[el.dataset.class];
        if (el.tagName === "INPUT") c.skip = !el.checked; else c.skip = !c.skip;
        if (!S.baseExams.some(e => !s.classes[e.id].skip) && !S.otherIds.some(id => s.classes[id].enabled)) { c.skip = false; toast("Keep at least one class."); }
        save({ planInputs: true }); rerenderKeepFocus(el); break;
      }
      case "add-other": {
        const id = S.otherIds.find(k => !s.classes[k].enabled);
        if (id) { Object.assign(s.classes[id], { enabled: true, name: "", examDate: "" }); save({ planInputs: true }); render(); const i = document.getElementById(`on-${id}`); if (i) i.focus(); }
        break;
      }
      case "remove-other": {
        const id = el.dataset.class;
        undoable(`Removed ${S.className(id)}.`, () => { Object.assign(s.classes[id], { enabled: false, name: "", examDate: "", topics: [], grade: "" }); save({ planInputs: true }); });
        render(); break;
      }
      case "add-today": addToday(); break;
      case "update-guide": {
        const id = el.dataset.class, c = s.classes[id];
        const old = {}; c.topics.forEach(t => { old[t.text.toLowerCase()] = t; });
        undoable(`${c.course} topics updated.`, () => {
          S.applyGuide(id);
          c.topics.forEach(t => { const o = old[t.text.toLowerCase()]; if (o) { t.conf = o.conf; if (o.firstConf) t.firstConf = o.firstConf; } });
          save({ planInputs: true });
        });
        render(); break;
      }
      case "use-guide": {
        const id = el.dataset.class;
        undoable(`${s.classes[id].course} study guide loaded.`, () => { S.applyGuide(id); save({ planInputs: true }); });
        render(); break;
      }
      case "backup-confirm": {
        const incoming = pendingBackup; pendingBackup = null;
        if (!incoming) break;
        const drive = s.drive;
        closeModal();
        undoable("Backup loaded.", () => { S.replace(Object.assign(incoming, { drive })); S.save({ now: true }); });
        render(); break;
      }
      case "tut-suggest": {
        const classId = el.dataset.class, date = el.dataset.d;
        undoable(`Added: ${S.className(classId)} tutorial, ${D.pretty(date)}`, () => {
          s.tutorials.push({ id: uid(), classId, date, start: CFG.TUTORIAL_START, end: CFG.TUTORIAL_END, done: false });
          s.tutorialsUpdatedAt = Date.now();
          save({ planInputs: true });
        });
        render(); break;
      }
      case "exp-examweek": closeModal(); window.Exports.printExamWeek(); break;
      case "backup-save": window.Exports.backup(); toast("Backup saved to your downloads. Load it on your other device."); break;
      case "backup-load": { const i = $("#backup-input"); if (i) i.click(); break; }
      case "help-go": closeModal(); location.hash = el.dataset.href; break;
      case "focus": openFocus(el.dataset.id); break;
      case "week-nav": ui.weekOffset = (ui.weekOffset || 0) + Number(el.dataset.dir); rerenderKeepFocus(el); break;
      case "add-open": ui.addFixedMode = !!el.dataset.mode; ui.addRepeat = "weekly"; addModal(el.dataset.d || "", el.dataset.mode || ""); break;
      case "add-mode": addModal(ui.addDate, el.dataset.mode); break;
      case "tut-time": ui.tutTime = el.dataset.v; $$('#modal [data-act="tut-time"]').forEach(b => b.setAttribute("aria-pressed", String(b === el))); break;
      case "add-preset": { const i = $("#add-label"); if (i) { i.value = el.dataset.label; i.focus(); } break; }
      case "add-repeat": {
        ui.addRepeat = el.dataset.v;
        $$('#modal [data-act="add-repeat"]').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === ui.addRepeat)));
        const days = $("#add-days"), once = $("#add-once-date");
        if (days) days.hidden = ui.addRepeat === "once";
        if (once) once.hidden = ui.addRepeat !== "once";
        break;
      }
      case "day-quick": {
        const want = new Set(el.dataset.days.split(",").map(Number));
        const form = el.closest("form") || el.closest(".modal-body") || document;
        $$("input[name=day]", form).forEach(i => { i.checked = want.has(Number(i.value)); });
        $$('[data-act="day-quick"]', form).forEach(b => b.setAttribute("aria-pressed", String(b === el)));
        break;
      }
      case "tut-edit": tutorialEdit(el.dataset.id); break;
      case "busy-edit": busyEdit(el.dataset.id); break;
      case "off-edit":
        openModal(`<div class="modal-body"><h3>😌 Day off</h3><p>No studying on ${D.pretty(el.dataset.d)}.</p></div>
          <div class="modal-foot"><button class="btn ghost" data-act="modal-close">Keep it</button><button class="btn" data-act="off-del" data-d="${el.dataset.d}">Remove day off</button></div>`);
        break;
      case "list-all": listAll(); break;
      case "details": sessionDetails(el.dataset.id); break;
      case "details-start": closeModal(); openFocus(el.dataset.id); break;
      case "details-move": moveMenu(el.dataset.id); break;
      case "details-done": {
        const x = s.plan.sessions.find(y => y.id === el.dataset.id);
        closeModal();
        if (x) undoable(x.done ? "Marked not done." : "Nice work.", () => { x.done = !x.done; save(); });
        render(); break;
      }
      case "details-stuck": {
        const x = s.plan.sessions.find(y => y.id === el.dataset.id);
        if (x) addStuck(x);
        closeModal();
        openModal(`<div class="modal-body"><h3>Added to your questions 🙋</h3><p>“Stuck on: ${esc(x ? x.topicText : "")}” is now in your questions for your ${esc(S.className(x ? x.classId : ""))} teacher. Bring it to tutorials.</p></div>
          <div class="modal-foot"><button class="btn ghost" data-act="modal-close">OK</button><a class="btn" href="#week" data-act="tut-from-stuck" data-class="${x ? x.classId : ""}">Plan a tutorial</a></div>`);
        break;
      }
      case "tut-from-stuck": e.preventDefault(); ui.tutClass = el.dataset.class; closeModal(); location.hash = "#week"; setTimeout(() => { ui.addFixedMode = true; addModal("", "tutorial"); }, 50); break;
      case "tour-done": s.tourDone = true; save(); render(); break;
      case "catch-up": closeModal(); catchUp(); break;
      case "overwhelmed": overwhelmedModal(); break;
      case "breathe": breathe(); break;
      case "breathe-stop": clearInterval(breatheTimer); closeModal(); break;
      case "extra-breaks":
        s.prefs.extraBreaks = !s.prefs.extraBreaks;
        if (s.plan) rebuildQuiet(); else save();
        toast(s.prefs.extraBreaks ? "Extra breaks are on. Same study time, more breathing room." : "Extra breaks are off.");
        overwhelmedModal();
        if ($("#focus").open) { const cur = focus.steps[focus.i]; if (cur && cur.type === "work" && focus.i === 0) { focus.steps = focusSteps(Number(s.prefs.sessionLen) || 30); startStep(); } }
        break;
      case "focus-from-calm": closeModal(); openFocus(el.dataset.id); break;
      case "open-class": ui.openClass = el.dataset.class; break;
      case "focus-close": closeFocus(); break;
      case "focus-next": nextStep(); break;
      case "focus-pause":
        focus.paused = !focus.paused;
        if (!focus.paused) focus.end = Date.now() + focus.left * 1000;
        renderFocus(); break;
      case "focus-feel": focus.picked = Number(el.dataset.v); renderFocus(); { const b = $(`#focus [data-act="focus-feel"][data-v="${el.dataset.v}"]`); if (b) b.focus(); } break;
      case "focus-stuck": { const x = s.plan.sessions.find(y => y.id === focus.id); if (x) addStuck(x); focus.stuck = true; renderFocus(); break; }
      case "focus-save": saveCheckin(); break;
      case "focus-tutorial": e.preventDefault(); ui.tutClass = el.dataset.class; saveCheckinIfNeeded(); closeFocus(); location.hash = "#week"; setTimeout(() => { ui.addFixedMode = true; addModal("", "tutorial"); }, 50); break;
      case "speak": e.stopPropagation(); speak(el.dataset.text); break;
      case "save-menu": saveMenu(); break;
      case "add-calendar": addCalendar(); break;
      case "make-up": makeUp(); break;
      case "fold-all": foldSessions(missedSessions().map(x => x.id)); break;
      case "fold-session": foldSessions([el.dataset.id]); break;
      case "more-time": moreTimeModal(); break;
      case "more-time-set": applyMoreTime(el.dataset.opt); break;
      case "move-session": moveMenu(el.dataset.id); break;
      case "move-go": moveSession(el.dataset.id, el.dataset.how); break;
      case "share": shareModal(); break;
      case "display": displayModal(); break;
      case "display-set": setDisplay(el.dataset.key, el.dataset.v); displayModal(); break;
      case "demo-reset": localStorage.removeItem(`${CFG.STORAGE_PREFIX || "examPrepHQ"}.demo`); location.reload(); break;
      case "exp-print": closeModal(); try { window.Exports.print(); } catch (err) { toast(err.message); } break;
      case "exp-word": window.Exports.word(); toast("Downloaded."); break;
      case "exp-csv": window.Exports.csv(); toast("Downloaded."); break;
      case "exp-ics": window.Exports.ics(); toast("Calendar file downloaded. Now import it (step 2)."); break;
      case "exp-gcal": await syncGoogleCalendar(); break;
      case "exp-gdoc":
      case "exp-gsheet": {
        toast("Saving to your Drive...");
        try {
          const r = el.dataset.act === "exp-gdoc" ? await window.Exports.googleDoc() : await window.Exports.googleSheet();
          openModal(`<div class="modal-body"><h3>Saved to Google Drive</h3><p>It's in your ${esc(CFG.DRIVE_FOLDER_NAME)} folder.</p></div>
            <div class="modal-foot"><button class="btn ghost" data-act="modal-close">Close</button><a class="btn" href="${esc(r.webViewLink)}" target="_blank" rel="noopener">Open it</a></div>`);
        } catch (err) { toast(`Couldn't save: ${err.message}`); }
        break;
      }

      case "flip": ui.flipped[el.dataset.i] = !ui.flipped[el.dataset.i]; el.setAttribute("aria-pressed", String(!!ui.flipped[el.dataset.i])); break;
      case "copy-email":
        try { await navigator.clipboard.writeText(C.tutorials.email); toast("Copied. Paste it into an email and fill in the blanks."); }
        catch (err) { toast("Couldn't copy. Select the text and copy it instead."); }
        break;

      case "mp-edit": ui.mpEdit = true; render(); break;
      case "mp-done": ui.mpEdit = false; render(); break;
      case "mp-all": ui.mpAll = !ui.mpAll; render(); break;
      case "mp-move": {
        const dom = C.mindprint.domains.find(d => d.id === el.dataset.cat);
        const list = (s.mindprint.order[dom.id] || dom.skills).slice();
        const i = list.indexOf(el.dataset.skill), j = i + Number(el.dataset.dir);
        if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
        s.mindprint.order[dom.id] = list;
        save({ planInputs: true }); rerenderKeepFocus(el); break;
      }
      case "mp-confirm": {
        const dom = C.mindprint.domains.find(d => d.id === el.dataset.cat);
        s.mindprint.order[dom.id] = dom.skills.slice();
        save({ planInputs: true }); render(); break;
      }
      case "mp-strongest":
        s.mindprint.strongest = s.mindprint.strongest === el.dataset.cat ? "" : el.dataset.cat;
        save({ planInputs: true }); rerenderKeepFocus(el); break;
      case "mp-clear": s.mindprint = { order: {}, strongest: "", top: {}, strategies: [] }; ui.mpEdit = false; save({ planInputs: true }); render(); break;

      case "signin":
      case "reconnect": await signIn(false); break;
      case "account-menu": {
        const u = window.Drive.user;
        openModal(`<div class="modal-body"><h3>Signed in</h3><p>${esc(u.name || "")}<br><span class="muted">${esc(u.email || "")}</span></p>
          <p class="small muted">Your plan saves to your Google Drive automatically.</p>
          <p><a href="${window.Drive.folderLink()}" target="_blank" rel="noopener">📁 Open my Exam Prep folder</a></p></div>
          <div class="modal-foot"><button class="btn ghost" data-act="modal-close">Close</button><button class="btn" data-act="signout">Sign out</button></div>`);
        break;
      }
      case "signout": window.Drive.signOut(); ui.sync = "local"; closeModal(); render(); toast("Signed out. Your plan is still saved on this device."); break;
    }
  });

  document.addEventListener("change", e => {
    const el = e.target;
    if (el.dataset.bind) {
      setPath(el.dataset.bind, el.value);
      save({ planInputs: !!el.dataset.plan });
      if (el.dataset.rerender) render();
    }
    if (el.dataset.course) chooseCourse(el.dataset.course, el.value, el);
    if (el.dataset.upload && el.files.length) handleFiles(el.dataset.upload, Array.from(el.files));
    if (el.dataset.mpupload !== undefined && el.files.length) handleMindprint(el.files[0]);
    if (el.id === "backup-input" && el.files.length) loadBackup(el.files[0]).finally(() => { el.value = ""; });
    if (el.dataset.examcheck !== undefined) ui.examChecks[el.dataset.examcheck] = el.checked;
    if (el.dataset.daycheck !== undefined) ui.dayChecks[el.dataset.daycheck] = el.checked;
  });

  document.addEventListener("input", e => {
    const el = e.target;
    if (el.dataset.topic) {
      const [cid, tid] = el.dataset.topic.split("|");
      const t = st().classes[cid].topics.find(x => x.id === tid);
      if (t) { t.text = el.value; save({ planInputs: true }); }
    }
  });

  document.addEventListener("submit", e => {
    const f = e.target;
    if (f.dataset.addtopic !== undefined) {
      e.preventDefault();
      const input = $("input", f);
      const text = input.value.trim();
      if (!text) return;
      const c = st().classes[f.dataset.addtopic];
      c.topics.push({ id: uid(), text, conf: Number(c.confidence) || 3 });
      save({ planInputs: true });
      render();
      const again = $(`#add-${f.dataset.addtopic}`);
      if (again) again.focus();
    }
    if (f.dataset.busyform !== undefined) {
      e.preventDefault();
      const label = $("#b-label").value.trim();
      const start = $("#b-start").value, end = $("#b-end").value;
      if (end <= start) { toast("The end time needs to be after the start time."); return; }
      const item = { id: uid(), label, type: ui.busyType, start, end };
      if (ui.busyType === "weekly") {
        item.days = $$("input[name=day]:checked", f).map(i => Number(i.value));
        if (!item.days.length) { toast("Pick at least one day."); return; }
      } else item.date = $("#b-date").value;
      st().busy.push(item);
      ui.busyLabel = ""; ui.busyOpen = false;
      save({ planInputs: true });
      render();
      toast(`Added ${label}.`);
    }
    if (f.dataset.tutform !== undefined) {
      e.preventDefault();
      const date = $("#t-date").value;
      if (!date) { toast("Pick a day."); return; }
      if (D.isWeekend(date)) { toast("Tutorials are on school days. Pick a weekday."); return; }
      const classId = $("#t-class").value;
      if (st().tutorials.some(t => t.date === date)) { toast("You already have a tutorial that day. Pick another day."); return; }
      st().tutorials.push({ id: uid(), classId, date, start: CFG.TUTORIAL_START, end: CFG.TUTORIAL_END, done: false });
      st().tutorialsUpdatedAt = Date.now();
      save({ planInputs: true });
      render();
      toast(`Added: ${S.className(classId)} tutorial, ${D.pretty(date)}.`);
    }
    if (f.dataset.offform !== undefined) {
      e.preventDefault();
      const d = $("#off-date").value;
      if (d && !st().prefs.offDates.includes(d)) st().prefs.offDates.push(d);
      save({ planInputs: true });
      render();
    }
  });

  /* ---------- Google sign-in + sync ---------- */
  async function signIn(withCalendar) {
    try {
      ui.sync = "saving";
      renderAccount();
      await window.Drive.signIn(withCalendar === true);
      const remote = await window.Drive.loadData();
      const drive = st().drive;
      if (remote && remote.updatedAt > (st().updatedAt || 0)) {
        S.replace(Object.assign(remote, { drive }));
        toast("Loaded your plan from Google Drive.");
      } else {
        await window.Drive.saveData(st());
        S.persistLocal();
        toast("Signed in. Your plan now saves to Google Drive.");
      }
      ui.sync = "saved";
      render();
    } catch (err) {
      ui.sync = window.Drive.user ? "error" : "local";
      renderAccount();
      toast(err.message || "Sign-in didn't finish.");
    }
  }

  S.onSave(async state => {
    if (!window.Drive.user) return;
    if (!window.Drive.signedIn()) { ui.sync = "reconnect"; renderAccount(); return; }
    ui.sync = "saving"; renderAccount();
    try { await window.Drive.saveData(state); S.persistLocal(); ui.sync = "saved"; }
    catch (err) { ui.sync = "error"; }
    renderAccount();
  });

  $("#focus").addEventListener("cancel", ev => { ev.preventDefault(); closeFocus(); });

  /* ---------- Start ---------- */
  window.addEventListener("hashchange", render);
  applyDisplay();
  if (S.demo && !st().plan) buildDemo();
  autoLoadGuides();
  if (st().plan && st().plan.sessions.some(x => !x.done && !x.steps)) { st().plan = window.Planner.generate(st()); S.save(); }
  renderBrand();
  render();
  if (window.Drive.enabled()) window.Drive.init().catch(() => {});
})();
