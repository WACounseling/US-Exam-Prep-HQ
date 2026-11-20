/* ==========================================================================
   PREP HQ: STATE, DATES, AND SAVING
   ========================================================================== */
(function () {
  const CFG = window.PREP_CONFIG;
  // Demo mode (add ?demo to the address): a made-up student, stored separately, never synced.
  const DEMO = typeof location !== "undefined" && new URLSearchParams(location.search).has("demo");
  const PREFIX = CFG.STORAGE_PREFIX || "examPrepHQ";
  const LS_KEY = DEMO ? `${PREFIX}.demo` : (PREFIX === "examPrepHQ" ? "examPrepHQ.v1" : `${PREFIX}.v1`);

  /* ---------- Date helpers (all dates are local YYYY-MM-DD strings) ---------- */
  const D = {
    pad: n => String(n).padStart(2, "0"),
    iso(d) { return `${d.getFullYear()}-${D.pad(d.getMonth() + 1)}-${D.pad(d.getDate())}`; },
    parse(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); },
    today() { return D.iso(new Date()); },
    addDays(s, n) { const d = D.parse(s); d.setDate(d.getDate() + n); return D.iso(d); },
    diff(a, b) { return Math.round((D.parse(b) - D.parse(a)) / 86400000); },
    dow(s) { return D.parse(s).getDay(); },
    isWeekend(s) { const w = D.dow(s); return w === 0 || w === 6; },
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    // Woodward editorial style: Jan., Feb., Aug., Sept., Oct., Nov., Dec. are abbreviated with a date.
    months: ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."],
    pretty(s, withDay = true) {
      const d = D.parse(s);
      const base = `${D.months[d.getMonth()]} ${d.getDate()}`;
      return withDay ? `${D.days[d.getDay()]}, ${base}` : base;
    },
    short(s) { const d = D.parse(s); return `${D.daysShort[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`; },
    toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; },
    toTime(min) { return `${D.pad(Math.floor(min / 60))}:${D.pad(min % 60)}`; },
    // Woodward style: a.m. / p.m.
    clock(t) {
      let [h, m] = t.split(":").map(Number);
      const ap = h >= 12 ? "p.m." : "a.m.";
      h = h % 12 || 12;
      return m === 0 ? `${h} ${ap}` : `${h}:${D.pad(m)} ${ap}`;
    }
  };

  const uid = () => Math.random().toString(36).slice(2, 10);

  // The main classes come from config; "Other" classes are added by each student.
  const BASE_EXAMS = CFG.EXAMS.slice();
  const OTHER_IDS = Array.from({ length: CFG.OTHER_SLOTS || 0 }, (_, i) => `other${i + 1}`);

  function freshState() {
    const classes = {};
    BASE_EXAMS.forEach(e => {
      classes[e.id] = { course: "", guideFrom: "", period: "", grade: "", confidence: 3, topics: [], guides: [], nickname: "", questions: "", skip: false };
    });
    OTHER_IDS.forEach(id => {
      classes[id] = { course: "", guideFrom: "", period: "", grade: "", confidence: 3, topics: [], guides: [], nickname: "", questions: "", enabled: false, name: "", examDate: "" };
    });
    return {
      version: 1,
      updatedAt: 0,
      onboarded: false,
      profile: { name: "", gradeLevel: (CFG.GRADE_LEVELS || ["7"])[0], langChoice: "World Language", langName: "" },
      classes,
      busy: [],
      tutorials: [],          // { id, classId, date, start, end, done }
      skips: [],              // times a student moved a session away from
      prefs: {
        startDate: D.today(),
        weekdayStart: "16:00", weekdayEnd: "20:30",
        weekendStart: "10:00", weekendEnd: "17:00",
        sessionLen: 30,
        maxWeekday: 2, maxWeekend: 3,
        freeDay: 6,           // keep Saturday free by default (-1 = none)
        offDates: []
      },
      // MindPrint profile, matching the report: skills in each category, strongest first.
      mindprint: { order: {}, strongest: "", top: {}, strategies: [] },
      mindprintReport: null,  // { name, link } of an uploaded report
      accom: { extended: "none", customMinutes: "" },
      plan: null,
      earnedBadges: [],
      drive: { folderId: "", guidesFolderId: "", schedulesFolderId: "", dataFileId: "", calendarId: "", calendarSyncedAt: 0, mindprintFolderId: "" }
    };
  }

  function merge(base, saved) {
    // Keep any new keys added in later versions.
    const out = Array.isArray(base) ? [] : {};
    for (const k of Object.keys(base)) out[k] = base[k];
    for (const k of Object.keys(saved || {})) {
      if (saved[k] && typeof saved[k] === "object" && !Array.isArray(saved[k]) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) {
        out[k] = merge(base[k], saved[k]);
      } else {
        out[k] = saved[k];
      }
    }
    return out;
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.mindprint && !saved.mindprint.order) delete saved.mindprint; // older format
        // Older versions allowed numbers; keep only letters.
        Object.values(saved.classes || {}).forEach(c => {
          const n = parseFloat(c.grade);
          if (!isNaN(n)) { const g = CFG.GRADES.find(x => n >= x.min); c.grade = g ? g.letter : ""; }
          else if (c.grade && !CFG.GRADES.some(x => x.letter === String(c.grade).trim().toUpperCase())) c.grade = "";
          else if (c.grade) c.grade = String(c.grade).trim().toUpperCase();
        });
        return merge(freshState(), saved);
      }
    } catch (e) { /* storage blocked or corrupt */ }
    return freshState();
  }

  // Active exams: main classes the student takes, plus their named "Other" classes with a date.
  function syncExams(state) {
    const st = state || Store.state;
    const active = BASE_EXAMS.filter(e => !(st.classes[e.id] && st.classes[e.id].skip));
    OTHER_IDS.forEach((id, i) => {
      const c = st.classes[id];
      if (c && c.enabled && c.name && c.examDate) {
        const style = (CFG.OTHER_STYLES || [])[i] || { color: "#4c3b8f", tint: "#ece8f7", icon: "⭐" };
        active.push({ id, name: c.name, short: c.name, date: c.examDate, color: style.color, tint: style.tint, icon: style.icon, other: true });
      }
    });
    CFG.EXAMS = active.sort((a, b) => a.date.localeCompare(b.date));
  }

  const listeners = [];
  let saveTimer = null;

  const Store = {
    D, uid,
    demo: DEMO,
    state: loadLocal(),
    freshState,
    merge,
    onSave(fn) { listeners.push(fn); },
    baseExams: BASE_EXAMS,
    otherIds: OTHER_IDS,
    syncExams,
    // Every class slot (for setup and My classes), including skipped and unused "Other" ones.
    allSlots() {
      const out = BASE_EXAMS.map(e => Object.assign({}, e));
      OTHER_IDS.forEach((id, i) => {
        const c = Store.state.classes[id] || {};
        const style = (CFG.OTHER_STYLES || [])[i] || {};
        out.push({ id, name: c.name || "Another class", short: c.name || "Other", date: c.examDate || "", color: style.color, tint: style.tint, icon: style.icon, other: true });
      });
      return out;
    },
    save(opts = {}) {
      syncExams();
      Store.state.updatedAt = Date.now();
      try { localStorage.setItem(LS_KEY, JSON.stringify(Store.state)); } catch (e) { /* ignore */ }
      clearTimeout(saveTimer);
      // Debounce cloud saves so typing doesn't trigger dozens of uploads.
      saveTimer = setTimeout(() => listeners.forEach(fn => fn(Store.state)), opts.now ? 0 : 1500);
    },
    replace(newState) {
      Store.state = merge(freshState(), newState);
      syncExams();
      try { localStorage.setItem(LS_KEY, JSON.stringify(Store.state)); } catch (e) { /* ignore */ }
    },
    reset() {
      // Keep the Drive folder links (so the same folder is reused) but forget everything else.
      const drive = Object.assign({}, Store.state.drive, { calendarSyncedAt: 0 });
      Store.state = freshState();
      Store.state.drive = drive;
      syncExams();
      Store.save({ now: true });
    },
    exam(id) { return CFG.EXAMS.find(e => e.id === id); },
    // "Pre-Algebra EP" -> "Pre-Algebra", "Physical Science 8 HP" -> "Physical Science", "French 1 HP" -> "French".
    shortCourse(name) {
      return String(name || "").replace(/\s+(CP|EP|HP|TP)$/i, "").replace(/\s+[178]$/, "").trim();
    },
    // Courses for one exam, filtered by grade (names with 7 or 8 only show for that grade).
    courseGroups(examId, gradeLevel) {
      const other = gradeLevel === "7" ? "8" : "7";
      return (CFG.COURSES && CFG.COURSES[examId] || []).map(g => ({
        group: g.group, list: g.allGrades ? g.list.slice() : g.list.filter(c => !new RegExp(`\\b${other}\\b`).test(c))
      })).filter(g => g.list.length);
    },
    guideFor(id) {
      const c = Store.state.classes[id];
      return c && c.course && window.GUIDES ? window.GUIDES[c.course] || null : null;
    },
    // "French 8 EP" -> "French"; Literature and other classes -> "".
    langOf(id) {
      const c = Store.state.classes[id];
      const m = c && c.course && c.course.match(/^(French|Spanish|Latin|German|Chinese|Mandarin)/i);
      return m ? m[1] : "";
    },
    // In-class exam parts (listening, essay, speaking) with dates; some depend on the student's period.
    periodOptions(id) {
      const g = Store.guideFor(id);
      const set = new Set();
      ((g && g.parts) || []).forEach(p => Object.keys(p.dates || {}).forEach(k => set.add(k)));
      return Array.from(set).sort();
    },
    partsFor(id) {
      const g = Store.guideFor(id), c = Store.state.classes[id];
      if (!g || !g.parts || !c || c.guideFrom !== c.course) return [];
      return g.parts.map(p => {
        let date = p.date || "", guess = false;
        if (p.dates) {
          if (c.period && p.dates[c.period]) date = p.dates[c.period];
          else { date = Object.values(p.dates).sort()[0]; guess = true; }
        }
        return { name: p.name, where: p.where || "In class", date, guess, classId: id };
      }).filter(p => p.date);
    },
    partDate(id, name) {
      const p = Store.partsFor(id).find(x => x.name === name);
      return p ? p.date : "";
    },
    allParts() {
      return CFG.EXAMS.flatMap(e => Store.partsFor(e.id));
    },
    // Fill a class's topics from its course's preloaded guide.
    applyGuide(id) {
      const c = Store.state.classes[id], g = Store.guideFor(id);
      if (!g) return false;
      c.topics = (g.topics || []).map(t => ({ id: uid(), text: t.text, details: (t.details || []).slice(), resources: (t.resources || []).slice(), part: t.part || "", conf: Number(c.confidence) || 3 }));
      c.guideFrom = c.course;
      c.guideVersion = g.updated || "";
      return true;
    },
    className(id) {
      const cls = Store.state.classes[id];
      if (/^other\d/.test(id)) return (cls && cls.name) || "Other class";
      if (cls && cls.course) return Store.shortCourse(cls.course);
      if (id === "lang") {
        const p = Store.state.profile;
        if (p.langChoice === "Literature") return "Literature";
        return p.langName ? p.langName : "World Language";
      }
      const ex = Store.exam(id);
      return ex ? ex.name : "All classes";
    },
    // "strength" = first (stronger) skill in its category, "support" = last (possible blocker).
    mpLevel(skillId) {
      const order = (Store.state.mindprint && Store.state.mindprint.order) || {};
      for (const list of Object.values(order)) {
        const i = list.indexOf(skillId);
        if (i === -1) continue;
        if (i === 0) return "strength";
        if (i === list.length - 1) return "support";
        return "middle";
      }
      return undefined;
    },
    mpHasStrategy(name) {
      const list = (Store.state.mindprint && Store.state.mindprint.strategies) || [];
      return list.some(x => x.toLowerCase() === name.toLowerCase());
    },
    mpIsSet() {
      const m = Store.state.mindprint || {};
      return !!(m.order && Object.keys(m.order).length);
    },
    persistLocal() {
      try { localStorage.setItem(LS_KEY, JSON.stringify(Store.state)); } catch (e) { /* ignore */ }
    },
    // Grades are letters only. These helpers convert to a number behind the scenes
    // (the middle of each letter's range). The number is never shown to students.
    letters() { return CFG.GRADES.map(g => g.letter); },
    gradeNum(letter) {
      const list = CFG.GRADES;
      const i = list.findIndex(g => g.letter === String(letter || "").trim().toUpperCase());
      if (i === -1) return NaN;
      const top = i === 0 ? 100 : list[i - 1].min;
      return list[i].min === 0 ? 55 : (list[i].min + top) / 2;
    },
    letterFor(num) {
      const g = CFG.GRADES.find(x => num >= x.min);
      return g ? g.letter : CFG.GRADES[CFG.GRADES.length - 1].letter;
    },
    examMinutes() {
      const a = Store.state.accom;
      const base = CFG.EXAM_MINUTES;
      if (a.extended === "1.5") return Math.round(base * 1.5);
      if (a.extended === "2") return base * 2;
      if (a.extended === "custom" && Number(a.customMinutes) > 0) return Number(a.customMinutes);
      return base;
    }
  };

  syncExams();
  window.Store = Store;
})();
