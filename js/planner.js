/* ==========================================================================
   PREP HQ: THE PLAN BUILDER
   Turns grades, study guide topics, confidence, busy times, and MindPrint
   info into spaced study sessions that finish before each exam.
   ========================================================================== */
(function () {
  const CFG = window.PREP_CONFIG;
  const { D, uid } = window.Store;

  /* ---------- Free time on one day ---------- */
  function busyOn(state, date) {
    const dow = D.dow(date);
    const tut = (state.tutorials || []).filter(t => t.date === date && t.start && t.end).map(t => [D.toMin(t.start), D.toMin(t.end)])
      .concat((state.skips || []).filter(k => k.date === date).map(k => [D.toMin(k.start), D.toMin(k.end)]));
    return tut.concat(state.busy
      .filter(b => (b.type === "weekly" && (b.days || []).includes(dow)) || (b.type === "once" && b.date === date))
      .filter(b => b.start && b.end)
      .map(b => [D.toMin(b.start), D.toMin(b.end)]));
  }

  function subtract(win, blocks) {
    let free = [win];
    blocks.forEach(([bs, be]) => {
      const next = [];
      free.forEach(([fs, fe]) => {
        if (be <= fs || bs >= fe) { next.push([fs, fe]); return; }
        if (bs > fs) next.push([fs, bs]);
        if (be < fe) next.push([be, fe]);
      });
      free = next;
    });
    return free;
  }

  function buildSlots(state, startDate) {
    const p = state.prefs;
    const exams = CFG.EXAMS;
    const examDates = new Set(exams.map(e => e.date));
    const lastExam = exams.map(e => e.date).sort().slice(-1)[0];
    const len = Number(p.sessionLen) || 30;
    const slots = [];
    for (let d = startDate; d < lastExam; d = D.addDays(d, 1)) {
      if ((p.offDates || []).includes(d)) continue;
      if (Number(p.freeDay) >= 0 && D.dow(d) === Number(p.freeDay) && !examDates.has(D.addDays(d, 1))) continue;
      const weekend = D.isWeekend(d);
      const win = weekend ? [D.toMin(p.weekendStart), D.toMin(p.weekendEnd)] : [D.toMin(p.weekdayStart), D.toMin(p.weekdayEnd)];
      if (!(win[1] > win[0])) continue;
      let cap = Number(weekend ? p.maxWeekend : p.maxWeekday) || 0;
      if (examDates.has(d)) cap = Math.max(1, cap - 1);   // lighter load on exam days
      if (d === D.today()) {
        // Don't schedule sessions that have already started today.
        const now = new Date();
        win[0] = Math.max(win[0], Math.ceil((now.getHours() * 60 + now.getMinutes() + 10) / 15) * 15);
      }
      let count = 0;
      subtract(win, busyOn(state, d)).forEach(([a, b]) => {
        let t = a;
        while (t + len <= b && count < cap) {
          slots.push({ date: d, start: t, end: t + len });
          count++;
          // 10-minute break after each session. With extra breaks on, the session's own
          // mini-breaks (5 minutes between 15-minute sprints) are added on top, so study time stays the same.
          t += len + 10 + (p.extraBreaks ? 5 * (Math.ceil(len / 15) - 1) : 0);
        }
      });
    }
    return slots;
  }

  /* ---------- Tasks: what needs to be studied ---------- */
  // Split a long list into even groups of about 3 ("Grammar" with 7 parts -> 3 + 2 + 2).
  function chunk(list) {
    const groups = Math.ceil(list.length / 3);
    const out = [];
    let i = 0;
    for (let g = 0; g < groups; g++) {
      const size = Math.ceil((list.length - i) / (groups - g));
      out.push(list.slice(i, i + size));
      i += size;
    }
    return out;
  }

  function topicsFor(state, examId) {
    const cls = state.classes[examId];
    if (cls.topics && cls.topics.length) {
      const out = [];
      cls.topics.filter(t => t.text && t.text.trim()).forEach(t => {
        const details = (t.details || []).filter(Boolean);
        if (details.length > 4) {
          // Big sections become smaller study sessions, each with the same rating.
          chunk(details).forEach((part, k) => out.push({ id: `${t.id}-p${k}`, baseId: t.id, name: t.text, items: part, text: `${t.text}: ${part.join(", ")}`, conf: t.conf, isPart: true, resources: t.resources || [], examPart: t.part || "" }));
        } else {
          out.push({ id: t.id, baseId: t.id, name: t.text, items: details, text: details.length ? `${t.text}: ${details.join(", ")}` : t.text, conf: t.conf, resources: t.resources || [], examPart: t.part || "" });
        }
      });
      return out;
    }
    return (window.CONTENT.defaultTopics[examId] || ["Study guide review"]).map((text, i) => ({
      id: `default-${examId}-${i}`, text, conf: Number(cls.confidence) || 3, isDefault: true
    }));
  }

  function buildTasks(state) {
    const tasks = [];
    CFG.EXAMS.forEach(e => {
      if (e.date <= D.today()) return;              // exam is today or over: nothing left to study for it
      const cls = state.classes[e.id];
      const grade = window.Store.gradeNum(cls.grade);
      const deadline = D.addDays(e.date, -1);
      topicsFor(state, e.id).forEach(t => {
        // Topics for an in-class part (listening, essay, speaking) finish the day before that part.
        let topicDeadline = deadline;
        if (t.examPart) {
          const pd = window.Store.partDate(e.id, t.examPart);
          if (pd) {
            if (pd <= D.today()) return;            // that part is over
            topicDeadline = D.addDays(pd, -1) < deadline ? D.addDays(pd, -1) : deadline;
          }
        }
        const conf = Number(t.conf) || Number(cls.confidence) || 3;
        let reps = conf <= 2 ? 3 : conf === 3 ? 2 : 1;
        if (t.isPart) reps = Math.min(reps, 2);   // parts are smaller, so 2 rounds is plenty
        if (!isNaN(grade) && grade < 80 && conf <= 3 && !t.isPart) reps = Math.min(4, reps + 1);
        if (!isNaN(grade) && grade >= 93 && conf >= 4) reps = 1;
        const weight = (6 - conf) + (isNaN(grade) ? 0 : grade < 80 ? 2 : grade < 88 ? 1 : 0);
        for (let r = 0; r < reps; r++) {
          const kind = r === 0 ? "rebuild" : (r === reps - 1 && reps >= 3 ? "mix" : "quiz");
          tasks.push({ classId: e.id, topicId: t.id, baseId: t.baseId || t.id, topicText: t.text, name: t.name || t.text, items: t.items || [], resources: t.resources || [], examPart: t.examPart || "", rep: r, reps, kind, weight, deadline: topicDeadline, earliest: null, done: false });
        }
      });
      const allRes = [];
      topicsFor(state, e.id).forEach(t => (t.resources || []).forEach(r => { if (!allRes.includes(r)) allRes.push(r); }));
      tasks.push({ classId: e.id, topicId: "final", baseId: "final", topicText: "Whole study guide", resources: allRes.slice(0, 3), rep: 99, kind: "test", weight: 99, deadline, earliest: D.addDays(e.date, -3), done: false });

      // Every class gets at least MIN_SESSIONS study sessions (plus its practice exam),
      // even if the student skipped its study guide or feels great about it.
      const MIN_SESSIONS = 5;
      const mine = tasks.filter(t => t.classId === e.id && t.kind !== "test");
      const firsts = mine.filter(t => t.rep === 0);
      let k = 0;
      while (mine.length < MIN_SESSIONS && firsts.length && k < 20) {
        const base = firsts[k % firsts.length];
        const reps = tasks.filter(t => t.classId === e.id && t.topicId === base.topicId && t.kind !== "test").length;
        const extra = Object.assign({}, base, { rep: reps, kind: "review", done: false, earliest: null });
        tasks.push(extra); mine.push(extra); k++;
      }
    });
    return tasks;
  }

  /* ---------- Personalized tips ---------- */
  function mp(state, skill) { return window.Store.mpLevel(skill); }
  const has = name => window.Store.mpHasStrategy(name);

  // What kind of topic is this? Used to pick a study method that fits.
  // The section name ("Figures of Speech: ...") decides first, then the details.
  function kindOf(task) {
    const full = (task.topicText || "").toLowerCase();
    const name = full.split(":")[0];
    const k = kindOfText(name, task.classId);
    return k !== "general" ? k : kindOfText(full, task.classId);
  }
  function kindOfText(t, classId) {
    const task = { classId };
    if (/\b(speaking|oral questions|interview|conversation)/.test(t)) return "speaking";
    if (/\b(listening)/.test(t)) return "listening";
    if (task.classId === "math" || /\b(equation|slope|function|graph|fraction|ratio|algebra|geometry|integer|expression|inequalit|probabilit|statistic|speed|velocity|acceleration|work and power|net force|displacement|metric|conversion)/.test(t)) return "math";
    if (/\b(grammar|comma|semicolon|participle|gerund|infinitive|verbal|voice|fragment|run-on|punctuation|clause|phrase|sentence|verb tense|conjugat|agreement|capitaliz|quotation|italic|parts of speech|prepositional|complement|subjects and verbs|noun position)/.test(t)) return "grammar";
    if (/\b(vocab|word list|key terms|terms|definitions)/.test(t)) return "vocab";
    if (/\b(figure|figurative|simile|metaphor|literary (terms|devices)|personification|irony)/.test(t)) return "devices";
    if (/\b(writing|essay|paragraph|thesis|response)/.test(t)) return "writing";
    if (/\b(literature|shakespeare|story|stories|novel|play|poem|poetry|chapter|act |character|theme|reading|passage)/.test(t)) return "literature";
    if (/\b(people|dates|events|war|revolution|empire|government|map|document|cause)/.test(t)) return "history";
    if (/\b(lab|diagram|process|cycle|cell|photosynth|genetic|punnett|force|energy|ecosystem|element|reaction)/.test(t)) return "science";
    return "general";
  }

  /* ---------- Overview + numbered steps, built from the study guide ---------- */
  const joinList = list => list.length <= 1 ? (list[0] || "") : list.length === 2 ? `${list[0]} and ${list[1]}` : `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
  // "Review sheets pgs. 2-5" -> "review sheets pgs. 2-5" (keeps names like "Veracross" capitalized)
  const lc = t => /^[A-Z][a-z]/.test(t) && !/^(Veracross|Quizlet|Google|Shakespeare|The |Writing with Power|Holt Handbook|Sadlier|Long Way Down|Ghost Boys|Good Enough|Formative)/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;

  // Pick the teacher's resources that fit a purpose: strong matches first, then weaker ones.
  function pickRes(res, purpose) {
    const R = res || [];
    const tests = {
      learn: [/review (sheet|packet)|study guide|slideshow|handout|lesson|textbook|writing with power|holt handbook/i, /notes|pg|page|packet/i],
      practice: [/practice|workbook|worksheet|problem|exercise|checkpoint|skills/i, /review packet|pretest|quizlet|packet/i],
      check: [/test analysis|old (quiz|test)|tests and quizzes|answer|key/i, /review sheet|quiz/i],
      vocab: [/vocab|word list|flashcard/i, /quizlet|pretest|list/i],
      formula: [/formula/i]
    };
    for (const re of tests[purpose]) { const hit = R.filter(r => re.test(r)); if (hit.length) return hit.slice(0, 2).map(lc); }
    return R.slice(0, 2).map(lc);
  }

  function otherTopics(state, task, n) {
    return topicsFor(state, task.classId).map(t => t.name || t.text)
      .filter((v, i, a) => a.indexOf(v) === i && v !== task.name).slice(0, n);
  }

  function buildSteps(task, state) {
    const kind = kindOf(task);
    const name = task.name || task.topicText;
    const items = (task.items || []).length ? task.items : [];
    const what = items.length ? joinList(items) : name;
    const res = task.resources || [];
    const learn = pickRes(res, "learn"), practice = pickRes(res, "practice"), check = pickRes(res, "check"), vocab = pickRes(res, "vocab");
    const open = list => list.length ? `Open your ${list[0]}${list[1] ? ` (also helpful: ${list[1]})` : ""}.` : "Open your notes, study guide, and old quizzes for this topic.";
    const one = list => list.length ? list[0] : "";
    const oneWork = items.length > 0 && items.every(i => /\b(characters?|plot|events|themes?|setting|symbols?|rules|title|genre)\b/i.test(i));
    const fromGuide = res.length > 0;
    let overview = "", steps = [];

    if (task.kind === "gear") {
      overview = "Get everything in one place so the rest of your sessions go faster.";
      steps = ["Find each class's study guide, notes, and old quizzes.", "Put each class's materials in one folder (paper or digital).", "On My classes, look for “✓ Study guide loaded.” If a class doesn't have one yet, it will appear when your teacher adds it, or you can upload your own copy.", "Star any old quiz questions you got wrong. Those are great to review."];
      return { overview, steps };
    }

    if (task.kind === "test") {
      const all = otherTopics(state, task, 8);
      const g = window.GUIDES && state.classes[task.classId] && state.classes[task.classId].course ? window.GUIDES[state.classes[task.classId].course] : null;
      overview = `Practice exam: a run-through of the whole ${window.Store.className(task.classId)} study guide, the day before the real thing.`;
      const allRes = [];
      topicsFor(state, task.classId).forEach(t => (t.resources || []).forEach(r => { if (!allRes.includes(r)) allRes.push(r); }));
      const hasPacket = allRes.some(r => /review (packet|sheet)/i.test(r));
      const extras = allRes.filter(r => !/\bpgs?\.|\bpp?\.|page|section|chapter|\bch\.|in the packet|review packet/i.test(r)).map(lc).slice(0, 3);
      const gather = [hasPacket ? "your whole review packet" : "your study guide", ...extras];
      if (!extras.some(r => /quiz/i.test(r))) gather.push("any old quizzes");
      steps = [
        `Gather ${joinList(gather)}.`,
        `Without notes, answer questions from every section${all.length ? `: ${joinList(all)}` : ""}.`,
        "Check your answers against the study guide. Mark everything you missed.",
        "Spend the last few minutes on just the parts you missed.",
        `Pack your bag for tomorrow${g && g.bring ? `: ${lc(g.bring)}` : ""}.`
      ];
      return { overview, steps };
    }

    const lang = window.Store.langOf ? window.Store.langOf(task.classId) : "";
    const partNote = task.examPart && window.Store.partDate(task.classId, task.examPart)
      ? ` Your ${task.examPart.toLowerCase()} section is in class on ${D.pretty(window.Store.partDate(task.classId, task.examPart))}.` : "";

    if (task.kind === "focus") {
      overview = `Exams are close, so focus on ${name}: find what you don't know yet and practice just that.${partNote}`;
      steps = [
        open(learn),
        `Skim ${task.combined ? "each topic" : (items.length ? what : "it")}. Put a star next to anything you can't explain yet.`,
        `Quiz yourself on just the starred parts${practice.length ? `, using your ${one(practice)}` : ""}.`,
        "Check your answers and fix mistakes in a different color.",
        "Say the 3 most important ideas out loud."
      ];
      return { overview, steps };
    }

    if (task.kind === "rebuild") {
      overview = `First round on ${name}. ${fromGuide ? "Use your teacher's materials to build" : "Build"} a study tool you'll use again.${partNote}`;
      const s1 = open(learn);
      const map = {
        grammar: [s1, `Read the rules for ${items.length ? what : name.toLowerCase()}.`, `On a fresh page, redo the practice sentences for ${items.length ? what : name.toLowerCase()} without looking at your old answers.`, `Check your work${check.length ? ` with your ${one(check)}` : ""} and circle anything you missed.`, "For each one you missed, write the rule in your own words."],
        devices: [s1, `For each one (${what}), write the definition in your own words.`, "Write your own example for each.", "Find one real example of each in something you've read this semester."],
        vocab: [open(vocab.length ? vocab : learn), `Make flashcards for ${items.length ? `every word in ${what}` : "every vocabulary word"}: the word on the front, the meaning and your own sentence on the back.`, "Say each word and its meaning out loud.", "Put the ones you don't know yet in a separate pile."],
        literature: oneWork
          ? [s1, `For ${name}, write the main characters, setting, what happens, and the big themes.${items.length ? ` Focus on ${what}.` : ""}`, "Add a few important moments or quotes.", "Explain the story out loud in about a minute."]
          : [s1, `For ${what}, write the main characters, setting, what happens, and the big themes.`, "Add one important moment or quote for each.", "Explain each one out loud in about a minute."],
        writing: [s1, items.length ? `Without looking, write out ${what}.` : `Write the parts of the ${name.toLowerCase()} from memory.`, `Check them against your ${learn.length ? one(learn) : "notes"} and fix anything you missed.`, "Outline one practice paragraph using that format."],
        math: [s1, `Find the examples for ${what} and redo 3 of them, showing every step${pickRes(res, "formula").length && /formula/i.test(res.join(" ")) ? ` (use the ${res.find(r => /formula/i.test(r)).replace(/^./, c => c.toLowerCase())})` : ""}.`, `Try 3 similar problems on your own${practice.length && one(practice) !== one(learn) ? ` from your ${one(practice)}` : ""}.`, "Check your answers. For each mistake, write what went wrong."],
        history: [s1, `Make a timeline or cause-and-effect chart for ${what}.`, "Add the key people, places, and dates.", "Explain it out loud from start to finish."],
        science: [s1, `Draw and label the key diagram or process for ${what} from memory.`, "Check it against your notes and fix or color the parts you missed.", "Explain each step out loud."],
        general: [s1, `Write a question and answer for each part of ${what}.`, "Read through them once, then cover the answers and quiz yourself.", "Put a star by anything you missed."],
        speaking: [s1, items.length ? `Write a few sentences${lang ? ` in ${lang}` : ""} for each of these: ${what}.` : `Write a short answer${lang ? ` in ${lang}` : ""} to each practice question.`, "Say each answer out loud 3 times, then try it without looking.", `Practice asking the questions too${lang === "French" ? ", with both tu and vous" : lang === "Spanish" ? ", with both tú and usted" : ""}.`],
        listening: [s1, `Have someone read aloud${lang ? ` in ${lang}` : ""} examples of each: ${what}. Or replay your class audio and review games. Write what you hear.`, "Check your spelling and accents.", "Redo any you missed until you get them right."],
        langwriting: [s1, items.length ? `Practice each of these${lang ? ` in ${lang}` : ""}: ${what}.` : `Write a practice paragraph${lang ? ` in ${lang}` : ""}.`, "Conjugate every verb and make sure adjectives agree.", "Check spelling and accents, then read it out loud."]
      };
      const k2 = kind === "writing" && lang ? "langwriting" : kind;
      steps = map[k2] || map.general;
    } else if (task.kind === "quiz" || task.kind === "review") {
      const quick = task.kind === "review";
      overview = quick
        ? `Quick review of ${name} to keep it fresh.`
        : `Practice round on ${name}. Pull it from memory, then check. This is what makes it stick.${partNote}`;
      const practiceStep = {
        grammar: `Redo the practice sentences for ${items.length ? what : name.toLowerCase()}${practice.length ? ` from your ${one(practice)}` : ""} without notes.`,
        devices: `Cover the definitions. Name each one (${what}) and give an example from memory.`,
        vocab: `Quiz yourself with your flashcards${vocab.length ? ` or your ${one(vocab)}` : ""}. Go through the misses twice.`,
        literature: `Without notes, answer for ${oneWork ? name : what}: Who are the main characters? What happens? Why does it matter?`,
        writing: `Write one practice paragraph in 15 minutes using the ${what}.`,
        math: `Do 6 practice problems on ${what}${practice.length ? ` from your ${one(practice)}` : ""} without notes.`,
        history: `Without notes, explain the causes, events, and results for ${what}.`,
        science: `Without notes, explain ${what} step by step, or redraw the diagram.`,
        general: `Without notes, answer your own questions about ${what}.`,
        speaking: `Have someone ask you the questions in a random order. Answer${lang ? ` in ${lang}` : ""} without notes, in full sentences.`,
        listening: `Have someone read aloud new examples (${what}) and write what you hear without looking at your notes.`,
        langwriting: `Without notes, write a new paragraph${lang ? ` in ${lang}` : ""} in 15 minutes. Then check verbs, agreement, spelling, and accents.`
      }[kind === "writing" && lang ? "langwriting" : kind] || `Without notes, answer your own questions about ${what}.`;
      steps = quick
        ? [open(check.length ? check : learn), `Look over ${what}. Spend extra time on anything you missed last time.`, practiceStep, "Circle anything that's still shaky."]
        : [`Close everything. On a blank page, write all you remember about ${kind === "grammar" && !items.length ? name.toLowerCase() : what} for 5 minutes.`, `Now open your ${learn.length ? one(learn) : "notes"} and check. Fill in what you missed in a different color.`, practiceStep, "Circle what you missed. That's your focus next time."];
    } else if (task.kind === "mix") {
      const others = otherTopics(state, task, 2);
      overview = `Mix it up. Practice ${name} together with other topics, the way the exam will.`;
      steps = [
        others.length ? `Pick a few questions on ${what}, plus a few on ${joinList(others)}.` : `Pick practice questions on ${what} and on other units.`,
        `Shuffle them and answer them without notes${practice.length ? ` (use your ${one(practice)})` : ""}.`,
        `Check your answers${check.length ? ` with your ${one(check)}` : ""}.`,
        `Teach ${name} out loud to someone (or a pet) in 2 minutes.`
      ];
    }
    return { overview, steps };
  }

  function tipFor(task, state) {
    const subj = task.classId;
    const kind = kindOf(task);
    const { overview, steps } = buildSteps(task, state);
    const extras = [];
    if (task.kind === "test") {
      if (has("Make a Test Plan") || mp(state, "speed") === "support") extras.push("Start by making a test plan: which sections first and how long for each.");
      if (has("Use a Visual Timer")) extras.push("Use a visual timer.");
      const mins = window.Store.examMinutes();
      extras.push(`The real exam is ${mins} minutes${mins > CFG.EXAM_MINUTES ? " with your extended time" : ""}.`);
    } else if (task.kind !== "gear") {
      if (kind === "math" && (has("Talk Through Math Problems") || mp(state, "verbal") === "strength")) extras.push("Talk through each step out loud.");
      else if (kind !== "math" && (has("Say it Aloud to Remember") || mp(state, "verbalMemory") === "strength")) extras.push("Say key ideas out loud as you go.");
      if ((task.kind === "quiz" || task.kind === "review") && has("Pause to Take Feedback")) extras.push("Pause to look at what you missed before moving on.");
      if (task.kind === "rebuild" && (mp(state, "spatial") === "strength" || mp(state, "visualMemory") === "strength")) extras.push("Add sketches, arrows, or colors. Pictures help you remember.");
    }
    if (mp(state, "attention") === "support") extras.push("Split this into two short sprints with a movement break.");
    if (mp(state, "workingMemory") === "support" && (subj === "math" || subj === "science")) extras.push("Write every step down.");
    const tips = extras.filter(x => !(/out loud/i.test(x) && steps.some(st => /out loud/i.test(st)))).slice(0, 2);
    return { overview, steps, extra: tips.join(" ") };
  }

  function instructions(task, state) {
    const t = tipFor(task, state);
    const flat = `${t.overview} ${t.steps.map((x, i) => `${i + 1}. ${x}`).join(" ")}${t.extra ? ` Tip: ${t.extra}` : ""}`;
    return { overview: t.overview, steps: t.steps, extra: t.extra, tip: flat };
  }

  function titleFor(task, state) {
    const cls = window.Store.className(task.classId);
    switch (task.kind) {
      case "rebuild": return `${cls}: build it`;
      case "quiz": return `${cls}: quiz yourself`;
      case "mix": return `${cls}: mix and teach`;
      case "review": return `${cls}: quick review`;
      case "focus": return `${cls}: focus review`;
      case "test": return `${cls}: practice exam`;
      case "gear": return "Gear check: get organized";
      default: return cls;
    }
  }

  /* ---------- The scheduler ---------- */
  function generate(state) {
    const today = D.today();
    const startDate = state.prefs.startDate > today ? state.prefs.startDate : today;
    const warnings = [];

    // Keep finished sessions from an earlier plan.
    const old = (state.plan && state.plan.sessions) || [];
    // Keep finished sessions, and missed sessions the student folded into later ones.
    const kept = old.filter(s => s.done || s.folded);
    if (CFG.EXAMS.every(e => e.date < today)) {
      return { generatedAt: Date.now(), startDate, sessions: kept, warnings: [], mode: "done", freeSlots: 0, totalSlots: 0 };
    }

    const tasks = buildTasks(state);
    const sameKind = (t, s) => t.kind === s.kind || (s.kind === "focus" && t.rep === 0 && t.kind !== "test");
    kept.forEach(s => {
      const match = tasks.find(t => !t.done && t.classId === s.classId && t.topicId === s.topicId && sameKind(t, s));
      if (match) { match.done = true; match.doneDate = s.date; }
      // A combined focus review also covered a second topic.
      [].concat(s.combinedWith || []).forEach(id => {
        const other = tasks.find(t => !t.done && t.classId === s.classId && t.topicId === id && t.rep === 0);
        if (other) { other.done = true; other.doneDate = s.date; }
      });
    });
    // Later reps can't happen before the next spacing gap after a finished rep.
    tasks.forEach(t => {
      if (t.done || t.kind === "test") return;
      const prev = tasks.find(x => x.done && x.classId === t.classId && x.topicId === t.topicId && x.rep === t.rep - 1);
      if (prev) t.earliest = D.addDays(prev.doneDate, 2);
    });

    const slots = buildSlots(state, startDate);
    // Fit the plan to the time available: if there are more sessions than open slots, drop extra
    // rounds for the topics the student feels best about first (every topic keeps its first round,
    // and every class keeps its practice exam).
    let trimmed = 0, merged = 0;
    // Short on time: the next exam is within 4 days, or first sessions won't all fit.
    const nextExam = CFG.EXAMS.map(e => e.date).filter(d => d > today).sort()[0];
    let short = !!nextExam && D.diff(startDate, nextExam) <= 4;
    const essentialDue = dl => tasks.filter(t => !t.done && t.deadline && t.deadline <= dl &&
      (t.kind === "test" || t.rep === 0)).length;
    const anyDeadlines = Array.from(new Set(tasks.filter(t => !t.done && t.deadline).map(t => t.deadline))).sort();
    if (anyDeadlines.some(dl => essentialDue(dl) > slots.filter(sl => sl.date <= dl).length - 1)) short = true;
    const gearSlot = (kept.some(s => s.kind === "gear") || short) ? 0 : 1;
    // Check each deadline in order (the earliest exam first): work due by then has to fit by then.
    const deadlines = Array.from(new Set(tasks.filter(t => !t.done && t.deadline).map(t => t.deadline))).sort();
    deadlines.forEach(dl => {
      const cap = slots.filter(sl => sl.date <= dl).length - gearSlot;
      const due = () => tasks.filter(t => !t.done && t.deadline && t.deadline <= dl);
      while (due().length > cap) {
        const removable = due().filter(t => t.kind !== "test" && t.rep > 0 &&
          !tasks.some(x => x.classId === t.classId && x.topicId === t.topicId && x.rep > t.rep && !x.done));
        if (removable.length) {
          removable.sort((a, b) => a.weight - b.weight || b.rep - a.rep);
          tasks.splice(tasks.indexOf(removable[0]), 1);
          trimmed++;
          continue;
        }
        // Combine the two most confident first-round topics of one class into a single focus review.
        const firsts = due().filter(t => t.rep === 0 && t.kind !== "test" && !t.examPart && (t.combinedCount || 1) < 3);
        const byClass = {};
        firsts.forEach(t => (byClass[t.classId] = byClass[t.classId] || []).push(t));
        const cls = Object.keys(byClass).filter(k => byClass[k].length >= 2)
          .sort((a, b) => byClass[b].length - byClass[a].length)[0];
        if (!cls) break;
        const pair = byClass[cls].sort((a, b) => (a.combinedCount || 1) - (b.combinedCount || 1) || a.weight - b.weight).slice(0, 2);
        const [a, b] = pair;
        if ((a.combinedCount || 1) + (b.combinedCount || 1) > 3) break;
        a.topicText = `${a.name || a.topicText} + ${b.name || b.topicText}`;
        a.name = a.topicText;
        a.items = [];
        a.resources = Array.from(new Set([...(a.resources || []), ...(b.resources || [])])).slice(0, 3);
        a.kind = "focus"; a.combined = true;
        a.combinedWith = [].concat(a.combinedWith || [], b.topicId, b.combinedWith || []);
        a.combinedCount = (a.combinedCount || 1) + (b.combinedCount || 1);
        tasks.splice(tasks.indexOf(b), 1);
        merged++;
      }
    });
    const capacity = slots.length - gearSlot;
    const need = () => tasks.filter(t => !t.done).length;
    while (need() > capacity) {
      const removable = tasks.filter(t => !t.done && t.kind !== "test" && t.rep > 0 &&
        !tasks.some(x => x.classId === t.classId && x.topicId === t.topicId && x.rep > t.rep && !x.done));
      if (!removable.length) break;
      removable.sort((a, b) => a.weight - b.weight || b.rep - a.rep);
      tasks.splice(tasks.indexOf(removable[0]), 1);
      trimmed++;
    }
    const sessions = [];
    const place = (slot, task) => {
      if (task.kind === "rebuild" && task.classId !== "general") {
        const ex = CFG.EXAMS.find(e => e.id === task.classId);
        if (ex && D.diff(slot.date, ex.date) <= 3) task.kind = "focus";
      }
      slot.task = task;
      task.done = true; task.scheduled = slot.date;
      sessions.push({
        id: uid(), date: slot.date, start: D.toTime(slot.start), end: D.toTime(slot.end),
        classId: task.classId, topicId: task.topicId, baseId: task.baseId || task.topicId, topicText: task.topicText, resources: task.resources || [],
        kind: task.kind, title: titleFor(task, state), ...instructions(task, state), done: false,
        ...(task.combinedWith ? { combinedWith: task.combinedWith } : {})
      });
    };

    // 1) Kick-off gear check in the very first slot (unless already done).
    if (!kept.some(s => s.kind === "gear") && !short && slots.length) {
      place(slots[0], { classId: "general", topicId: "gear", topicText: "All classes", kind: "gear" });
    }

    // 2) Reserve a practice exam as close to each exam as possible (ideally the day before).
    CFG.EXAMS.forEach(e => {
      const t = tasks.find(x => x.classId === e.id && x.kind === "test" && !x.done);
      if (!t) return;
      const candidates = slots.filter(s => !s.task && s.date <= t.deadline && s.date >= t.earliest);
      const pick = candidates.reverse().find(s => !slots.some(o => o.task && o.date === s.date && o.task.kind === "test")) || candidates[0];
      if (pick) place(pick, t);
    });

    // 3) If there's lots of time, add extra quick reviews for the shakiest topics
    //    (more spaced retrieval), but leave about 1 in 5 slots free for real life.
    const openCount = slots.filter(s => !s.task).length;
    const todo = () => tasks.filter(t => !t.done && t.kind !== "test").length;
    const target = Math.floor(openCount * 0.8);
    const byNeed = [];
    CFG.EXAMS.forEach(e => topicsFor(state, e.id).forEach(t => {
      const first = tasks.find(x => x.classId === e.id && x.topicId === t.id && x.rep === 0);
      if (first) byNeed.push(first);
    }));
    byNeed.sort((a, b) => b.weight - a.weight);
    let guard = 0;
    while (todo() < target && byNeed.length && guard++ < 200) {
      const base = byNeed[guard % byNeed.length];
      const reps = tasks.filter(x => x.classId === base.classId && x.topicId === base.topicId && x.kind !== "test");
      if (reps.length >= 5) { if (byNeed.every(b => tasks.filter(x => x.classId === b.classId && x.topicId === b.topicId).length >= 5)) break; continue; }
      tasks.push(Object.assign({}, base, { rep: reps.length, kind: "review", done: false, earliest: null, scheduled: null }));
    }

    // Spread the free slots evenly, preferring the last slot of the day so evenings end earlier.
    const open = slots.filter(s => !s.task);
    const freeCount = Math.max(0, open.length - todo());
    for (let k = 0; k < freeCount; k++) {
      let idx = Math.min(open.length - 1, Math.floor((k + 0.5) * open.length / freeCount));
      const day = open[idx].date;
      const lastOfDay = open.map((s, j) => (s.date === day && !s.free ? j : -1)).filter(j => j >= 0).pop();
      if (lastOfDay !== undefined) idx = lastOfDay;
      if (!open[idx].free) open[idx].free = true;
    }

    // 4) Fill the rest, spreading classes out in proportion to how much each needs.
    const recent = [];
    const fill = (slot, i, list) => {
      const sameDay = slots.filter(s => s.date === slot.date && s.task).map(s => s.task);
      const prevTask = i > 0 && list[i - 1].date === slot.date ? list[i - 1].task : null;
      let best = null, bestScore = -1;

      CFG.EXAMS.forEach(e => {
        if (slot.date > D.addDays(e.date, -1)) return;
        const remaining = tasks.filter(t => t.classId === e.id && !t.done && t.kind !== "test");
        if (!remaining.length) return;
        const eligible = remaining.filter(t => {
          if (t.deadline && slot.date > t.deadline) return false;     // never after its own deadline (like an in-class part)
          if (t.earliest && t.earliest > slot.date) return false;
          if (t.rep > 0 && !tasks.some(x => x.classId === t.classId && x.topicId === t.topicId && x.rep === t.rep - 1 && x.done)) return false;
          if (sameDay.some(x => x.classId === t.classId && x.topicId === t.topicId)) return false;
          return true;
        });
        if (!eligible.length) return;
        const avail = list.slice(i).filter(s => !s.task && s.date <= e.date).length || 1;
        let score = remaining.length / avail;
        // Work due before an in-class part is more urgent than the rest of the class.
        const examDeadline = D.addDays(e.date, -1);
        const early = remaining.filter(t => t.deadline && t.deadline < examDeadline && t.deadline >= slot.date);
        if (early.length) {
          const soonest = early.map(t => t.deadline).sort()[0];
          const urgent = early.filter(t => t.deadline <= D.addDays(soonest, 2)).length;
          const availEarly = list.slice(i).filter(s => !s.task && s.date <= soonest).length || 1;
          score = Math.max(score, urgent / availEarly);
        }
        const todayCount = sameDay.filter(x => x.classId === e.id).length;
        if (score < 1) {
          if (prevTask && prevTask.classId === e.id) score *= 0.5;
          if (todayCount >= 2) score *= 0.2;
          // Variety: a class that showed up in the last few sessions waits its turn.
          const lately = recent.slice(-3).filter(c => c === e.id).length;
          score *= Math.pow(0.5, lately);
        }
        if (score > bestScore) {
          bestScore = score;
          // Within a week of a deadline, that work goes first; otherwise the usual order (earlier rounds, shakier topics).
          const soonKey = t => (t.deadline && t.deadline <= D.addDays(slot.date, 7)) ? t.deadline : "9";
          eligible.sort((a, b) => soonKey(a).localeCompare(soonKey(b)) || a.rep - b.rep || b.weight - a.weight);
          best = eligible[0];
        }
      });

      if (best) {
        place(slot, best);
        recent.push(best.classId);
        // Space the next round of this topic at least two days later (one if time is short).
        const next = tasks.find(t => t.classId === best.classId && t.topicId === best.topicId && t.rep === best.rep + 1);
        if (next) {
          let e = D.addDays(slot.date, 2);
          if (e > next.deadline) e = D.addDays(slot.date, 1);
          next.earliest = e;
        }
      }
    };
    const working = open.filter(s => !s.free);
    working.forEach((slot, i) => fill(slot, i, working));
    // Second pass: if anything is still left, use the free slots after all.
    if (tasks.some(t => !t.done)) {
      const spare = open.filter(s => s.free && !s.task);
      spare.forEach((slot, i) => fill(slot, i, spare));
    }

    // 4b) Rescue: a topic's first session (or a practice exam) that didn't fit takes the slot of an
    //     extra round from any class, before its deadline. That extra round is dropped instead.
    const essentialLeft = () => tasks.filter(t => !t.done && t.deadline &&
      (t.kind === "test" || !tasks.some(x => x.done && x.classId === t.classId && x.topicId === t.topicId)));
    essentialLeft().forEach(t => {
      const cand = slots.filter(sl => sl.task && sl.date <= t.deadline && (!t.earliest || sl.date >= t.earliest) &&
        sl.task.kind !== "test" && sl.task.kind !== "gear" && sl.task.rep > 0 &&
        !(sl.task.classId === t.classId && sl.task.topicId === t.topicId))
        .sort((a, b) => b.task.rep - a.task.rep || b.date.localeCompare(a.date));
      const sl = cand[0];
      if (!sl) return;
      const old = sl.task;
      const idx = sessions.findIndex(x => x.date === sl.date && x.start === D.toTime(sl.start));
      if (idx >= 0) sessions.splice(idx, 1);
      tasks.splice(tasks.indexOf(old), 1);
      sl.task = null;
      place(sl, t);
      trimmed++;
    });

    // 4c) Missed sessions the student folded forward: add a short review to that class's next session.
    kept.filter(k => k.folded).forEach(f => {
      const target = sessions.filter(x => x.classId === f.classId && x.date >= today).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
      if (!target) return;
      target.also = (target.also || []).concat([{ topicText: f.topicText, resources: f.resources || [] }]);
      const res = ((f.resources || [])[0] || "").replace(/\s*\([^)]*\)\s*$/, "");
      const topic = (f.topicText || "").split(":")[0];
      target.steps = (target.steps || []).concat([`Also, from a missed session: spend 5 minutes on ${topic}${res ? ` (open your ${lc(res)})` : ""}.`]);
      target.tip = `${target.overview} ${target.steps.map((x, i) => `${i + 1}. ${x}`).join(" ")}${target.extra ? ` Tip: ${target.extra}` : ""}`;
      f.foldedInto = target.date;
    });

    // 5) Report anything that didn't fit.
    let shortfall = 0;
    CFG.EXAMS.forEach(e => {
      // Extra rounds of a topic that already has a session are dropped quietly; only warn when a
      // topic's first session or a practice exam can't fit.
      const missing = tasks.filter(t => t.classId === e.id && !t.done && (t.kind === "test" ||
        !tasks.some(x => x.done && x.classId === t.classId && x.topicId === t.topicId)));
      shortfall += missing.length;
    });
    const testsMissing = tasks.some(t => t.kind === "test" && !t.done);
    let note = "";
    if (short || merged) note = "Exams are close, so your plan focuses on what matters most: quick reviews of your shakiest topics and a practice exam for each class.";
    if (shortfall && !testsMissing) note = "Exams are close, so your plan focuses on what matters most: your shakiest topics and a practice exam for each class. Each practice exam covers the whole study guide.";
    else if (shortfall) warnings.push("Some practice exams didn't fit before their exams. Tap “Add more study time” to fit them in.");
    if (!slots.length) warnings.push("There's no open study time before your next exam. Tap “Add more study time.”");

    const all = kept.concat(sessions).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    return { generatedAt: Date.now(), startDate, sessions: all, warnings, note, mode: short || merged || shortfall ? "short" : "normal", merged, trimmed, shortfall, freeSlots: slots.filter(s => !s.task).length, totalSlots: slots.length };
  }

  // "Add a session today": one extra practice session, starting now, on the shakiest
  // topic for the soonest exam (skipping anything already done or scheduled today).
  function extraSession(state) {
    const today = D.today();
    const len = Number(state.prefs.sessionLen) || 30;
    const usedToday = new Set((state.plan ? state.plan.sessions : []).filter(x => x.date === today).map(x => x.classId + "|" + x.topicId));
    const cands = [];
    CFG.EXAMS.filter(e => e.date > today).forEach(e => {
      const days = D.diff(today, e.date);
      topicsFor(state, e.id).forEach(t => {
        if (usedToday.has(e.id + "|" + t.id)) return;
        const conf = Number(t.conf) || Number(state.classes[e.id].confidence) || 3;
        cands.push({ e, t, score: days + 3 * conf });
      });
    });
    if (!cands.length) return null;
    cands.sort((a, b) => a.score - b.score);
    const { e, t } = cands[0];
    const now = new Date();
    const startMin = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5;
    const task = { classId: e.id, topicId: t.id, baseId: t.baseId || t.id, topicText: t.text, name: t.name || t.text, items: t.items || [], resources: t.resources || [], kind: "quiz" };
    return {
      id: uid(), date: today, start: D.toTime(Math.min(startMin, 23 * 60)), end: D.toTime(Math.min(startMin + len, 23 * 60 + 59)),
      classId: e.id, topicId: t.id, baseId: task.baseId, topicText: t.text, resources: task.resources,
      kind: "quiz", isExtra: true, title: `${window.Store.className(e.id)}: extra practice`, ...instructions(task, state), done: false
    };
  }

  window.Planner = { generate, buildSlots, topicsFor, extraSession };
})();
