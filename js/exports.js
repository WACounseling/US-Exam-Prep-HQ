/* ==========================================================================
   PREP HQ: DOWNLOADS
   Printable/PDF, Word, Google Doc, Google Sheet, spreadsheet (CSV),
   and calendar (.ics) versions of the plan.
   ========================================================================== */
(function () {
  const CFG = window.PREP_CONFIG;
  const S = window.Store;
  const { D } = S;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function sessions() { return (S.state.plan && S.state.plan.sessions) || []; }
  function colorFor(id) { const e = S.exam(id); return e ? e.color : "#9d2235"; }

  function byDate() {
    const days = {};
    sessions().forEach(s => (days[s.date] = days[s.date] || []).push(s));
    CFG.EXAMS.forEach(e => (days[e.date] = days[e.date] || []));
    tutorials().forEach(t => (days[t.date] = days[t.date] || []));
    S.allParts().forEach(p => (days[p.date] = days[p.date] || []));
    return Object.keys(days).sort().map(d => ({ date: d, sessions: days[d], exams: CFG.EXAMS.filter(e => e.date === d), tutorials: tutorials().filter(t => t.date === d), parts: S.allParts().filter(p => p.date === d) }));
  }

  function tutorials() { return (S.state.tutorials || []).slice().sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)); }
  // "Topics to ask about" at tutorials: topics rated 1-2, or 3 if nothing is lower.
  function askTopics(classId) {
    const t = S.state.classes[classId].topics.filter(x => Number(x.conf) <= 2).map(x => x.text);
    return t.length ? t : S.state.classes[classId].topics.filter(x => Number(x.conf) === 3).map(x => x.text);
  }

  function busyFor(date) {
    const dow = D.dow(date);
    return S.state.busy.filter(b => (b.type === "weekly" && (b.days || []).includes(dow)) || (b.type === "once" && b.date === date));
  }

  /* ---------- One HTML document used for print, Word, and Google Docs ---------- */
  function planHTML(forPrint) {
    const inner = planBody();
    const name = S.state.profile.name ? `${esc(S.state.profile.name)}'s` : "My";
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name} Exam Prep Plan</title>
      ${forPrint ? '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800&display=swap" rel="stylesheet">' : ""}
      <style>body{font-family:Montserrat,Arial,sans-serif;color:#0d2b46;margin:24px;} h1{color:#9d2235;margin:0 0 4px;} @media print{h3{break-after:avoid;} table{break-inside:auto;} tr{break-inside:avoid;}}</style>
      </head><body>${inner}</body></html>`;
  }

  function planBody() {
    const name = S.state.profile.name ? `${esc(S.state.profile.name)}'s` : "My";
    const mins = S.examMinutes();
    const rows = byDate().map(day => {
      const exams = day.exams.map(e =>
        `<tr><td style="border:1px solid #ccc;padding:6px;">⭐</td><td style="border:1px solid #ccc;padding:6px;"><b>${esc(S.className(e.id))} exam</b></td><td style="border:1px solid #ccc;padding:6px;">${mins} minutes. You've got this.</td></tr>`).join("");
      const tuts = day.tutorials.map(t =>
        `<tr><td style="border:1px solid #ccc;padding:6px;white-space:nowrap;">☐ ${D.clock(t.start)}</td><td style="border:1px solid #ccc;padding:6px;border-left:6px solid #ffc513;"><b>🙋 ${esc(S.className(t.classId))} tutorial</b></td><td style="border:1px solid #ccc;padding:6px;">Ask about: ${esc(askTopics(t.classId).slice(0, 3).join("; ") || "your study guide and 2 or 3 specific questions")}</td></tr>`).join("");
      const parts = (day.parts || []).map(p =>
        `<tr><td style="border:1px solid #ccc;padding:6px;">⭐</td><td style="border:1px solid #ccc;padding:6px;"><b>${esc(S.className(p.classId))} ${esc(p.name.toLowerCase())} exam</b></td><td style="border:1px solid #ccc;padding:6px;">${esc(p.where)}${p.guess ? " (check your period's date)" : ""}</td></tr>`).join("");
      const busy = busyFor(day.date).map(b =>
        `<tr><td style="border:1px solid #ccc;padding:6px;color:#555;">${D.clock(b.start)}</td><td style="border:1px solid #ccc;padding:6px;color:#555;" colspan="2">${esc(b.label || "Busy")}</td></tr>`).join("");
      const ses = day.sessions.map(s =>
        `<tr><td style="border:1px solid #ccc;padding:6px;white-space:nowrap;">☐ ${D.clock(s.start)}</td><td style="border:1px solid #ccc;padding:6px;border-left:6px solid ${colorFor(s.classId)};"><b>${esc(s.title)}</b><br>${esc(s.topicText)}</td><td style="border:1px solid #ccc;padding:6px;">${esc(s.tip)}${(s.resources || []).length ? `<br><b>Use:</b> ${esc(s.resources.slice(0, 3).join("; "))}` : ""}</td></tr>`).join("");
      if (!exams && !ses && !tuts && !parts) return "";
      return `<h3 style="font-family:Montserrat,Arial,sans-serif;color:#9d2235;margin:18px 0 6px;">${D.pretty(day.date)}</h3>
        <table style="border-collapse:collapse;width:100%;font-family:Montserrat,Arial,sans-serif;font-size:11pt;">${exams}${parts}${tuts}${busy}${ses}</table>`;
    }).join("");

    const examList = CFG.EXAMS.map(e => `<li>${esc(S.className(e.id))}: ${D.pretty(e.date)}</li>`).join("");

    return `<h1>${name} Exam Prep Plan</h1>
      <p style="margin:0 0 12px;">${esc(CFG.SCHOOL_NAME)} ${esc(CFG.DIVISION)}, ${esc(CFG.SEMESTER_LABEL)}. Each exam is ${mins} minutes${mins > CFG.EXAM_MINUTES ? " with your extended time" : ""}.</p>
      <p><b>Exam dates</b></p><ul>${examList}</ul>
      <p>Check off ☐ each session when you finish it. Sessions are ${S.state.prefs.sessionLen} minutes with a break after.</p>
      ${rows || "<p>No sessions yet. Build your plan in Exam Prep HQ first.</p>"}
      `;
  }

  /* ---------- Exam week at a glance (one page) ---------- */
  function examWeekBody() {
    const st = S.state;
    const name = st.profile.name ? `${esc(st.profile.name)}'s` : "My";
    const mins = S.examMinutes();
    const extra = mins > CFG.EXAM_MINUTES;
    const preview = Math.round(mins * 0.07), check = Math.round(mins * 0.15), answer = mins - preview - check;
    const td = 'style="border:1px solid #bbb;padding:7px;vertical-align:top;"';
    const rows = CFG.EXAMS.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => {
      const test = sessions().find(x => x.classId === e.id && x.kind === "test");
      const tuts = (st.tutorials || []).filter(t => t.classId === e.id && t.date <= e.date).map(t => D.pretty(t.date));
      const g = S.guideFor(e.id);
      const parts = S.partsFor(e.id);
      return `<tr><td ${td}><b>${esc(S.className(e.id))}</b>${g && g.bring ? `<br><span style="font-size:9.5pt;">Bring: ${esc(g.bring)}</span>` : ""}</td><td ${td}>${D.pretty(e.date)}${g && g.examTime ? `<br>${esc(g.examTime)}` : ""}${parts.length ? `<br><span style="font-size:9.5pt;">In class: ${esc(parts.map(p => `${p.name} ${D.pretty(p.date, false)}`).join("; "))}</span>` : ""}</td>
        <td ${td}>${test ? `${D.pretty(test.date, false)}, ${D.clock(test.start)}` : "The day before"}</td>
        <td ${td}>${tuts.length ? esc(tuts.join("; ")) : "None planned"}</td>
        <td ${td}>☐ Packed &nbsp; ☐ Slept</td></tr>`;
    }).join("");
    const list = items => `<ul style="list-style:none;padding:0;margin:0;">${items.map(i => `<li style="margin:4px 0;">☐ ${i}</li>`).join("")}</ul>`;
    return `<h1 style="color:#9d2235;margin:0 0 4px;font-family:Montserrat,Arial,sans-serif;">${name} Exam Week</h1>
      <p style="margin:0 0 12px;">Each exam is <b>${mins} minutes</b>${extra ? " with your extended time. Use all of it" : ""}. Pacing plan: look it over for ${preview} minutes, answer for ${answer}, and check for ${check}.</p>
      <table style="border-collapse:collapse;width:100%;font-size:11pt;margin-bottom:14px;">
        <tr><th ${td} align="left">Exam</th><th ${td} align="left">Day</th><th ${td} align="left">Practice exam</th><th ${td} align="left">Tutorial</th><th ${td} align="left">Ready?</th></tr>${rows}</table>
      <table style="width:100%;border-collapse:collapse;"><tr>
        <td style="width:50%;vertical-align:top;padding-right:12px;"><h3 style="color:#0d2b46;margin:0 0 6px;">🌙 The night before</h3>${list(["Do your practice exam session", "Pack your supplies (pens, pencils, highlighter, calculator if allowed), water, and a snack", "Light review only, nothing new", "Screens off early and lights out on time"])}</td>
        <td style="width:50%;vertical-align:top;"><h3 style="color:#0d2b46;margin:0 0 6px;">☀️ Exam morning</h3>${list(["Eat breakfast", "Bring your supplies, water, and a snack", "Know which room you're in", "One slow breath: in for 4, out for 6", extra ? `Use all ${mins} minutes` : "Use all of your time"])}</td>
      </tr></table>
      <p style="margin-top:14px;font-size:10pt;color:#555;">You've prepared for this. One exam is one day; it doesn't measure how smart you are.</p>`;
  }

  // Print inside the page (works on iPad, where pop-up print windows are unreliable).
  function printInPage(html) {
    let area = document.getElementById("print-area");
    if (!area) { area = document.createElement("div"); area.id = "print-area"; document.body.appendChild(area); }
    area.innerHTML = html;
    document.body.classList.add("printing");
    const done = () => { document.body.classList.remove("printing"); area.innerHTML = ""; window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { window.print(); setTimeout(() => { if (!window.matchMedia("print").matches) done(); }, 1500); }, 150);
  }

  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function csv() {
    const q = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const head = ["Date", "Day", "Start", "End", "Class", "Session", "Study guide topic", "How to study", "Done"];
    const lines = [head.map(q).join(",")];
    sessions().forEach(s => lines.push([s.date, D.days[D.dow(s.date)], D.clock(s.start), D.clock(s.end), S.className(s.classId), s.title, s.topicText, s.tip + ((s.resources || []).length ? ` Use: ${s.resources.slice(0, 3).join("; ")}` : ""), s.done ? "Yes" : ""].map(q).join(",")));
    tutorials().forEach(t => lines.push([t.date, D.days[D.dow(t.date)], D.clock(t.start), D.clock(t.end), S.className(t.classId), "Tutorial", askTopics(t.classId).slice(0, 3).join("; "), "Bring 2 or 3 specific questions", t.done ? "Yes" : ""].map(q).join(",")));
    CFG.EXAMS.forEach(e => lines.push([e.date, D.days[D.dow(e.date)], "", "", S.className(e.id), "EXAM", "", `${S.examMinutes()} minutes`, ""].map(q).join(",")));
    return lines.join("\r\n");
  }

  function ics() {
    const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const fold = s => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    const dt = (date, time) => date.replace(/-/g, "") + "T" + time.replace(":", "") + "00";
    const ev = [];
    sessions().forEach(s => {
      ev.push(["BEGIN:VEVENT", `UID:${s.id}@examprephq`, `DTSTAMP:${stamp}`,
        `DTSTART:${dt(s.date, s.start)}`, `DTEND:${dt(s.date, s.end)}`,
        `SUMMARY:${fold("📚 " + s.title)}`, `DESCRIPTION:${fold(s.topicText + "\n" + s.tip + ((s.resources || []).length ? "\nUse: " + s.resources.slice(0, 3).join("; ") : ""))}`,
        "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", `DESCRIPTION:${fold(s.title)}`, "END:VALARM",
        "END:VEVENT"].join("\r\n"));
    });
    tutorials().forEach(t => {
      ev.push(["BEGIN:VEVENT", `UID:tut-${t.id}@examprephq`, `DTSTAMP:${stamp}`,
        `DTSTART:${dt(t.date, t.start)}`, `DTEND:${dt(t.date, t.end)}`,
        `SUMMARY:${fold("🙋 " + S.className(t.classId) + " tutorial")}`,
        `DESCRIPTION:${fold("Ask about: " + (askTopics(t.classId).slice(0, 3).join("; ") || "2 or 3 specific questions"))}`,
        "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Tutorial soon", "END:VALARM",
        "END:VEVENT"].join("\r\n"));
    });
    S.allParts().forEach(p => {
      ev.push(["BEGIN:VEVENT", `UID:part-${p.classId}-${p.name.replace(/\W+/g, "")}-${p.date}@examprephq`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${p.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${D.addDays(p.date, 1).replace(/-/g, "")}`,
        `SUMMARY:${fold("⭐ " + S.className(p.classId) + " " + p.name.toLowerCase() + " exam (in class)")}`, "END:VEVENT"].join("\r\n"));
    });
    CFG.EXAMS.forEach(e => {
      ev.push(["BEGIN:VEVENT", `UID:exam-${e.id}-${e.date}@examprephq`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${D.addDays(e.date, 1).replace(/-/g, "")}`,
        `SUMMARY:${fold("⭐ " + S.className(e.id) + " exam (" + S.examMinutes() + " min)")}`, "END:VEVENT"].join("\r\n"));
    });
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Exam Prep HQ//Plan//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Exam Prep Plan", ...ev, "END:VCALENDAR"].join("\r\n");
  }

  // Google Calendar event colors: 9 blue, 10 green, 6 orange, 7 teal, 11 red, 8 gray, 5 yellow
  const GCAL_COLORS = { english: "9", science: "10", social: "6", math: "7", lang: "11", general: "8" };

  function googleEvents() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
    const today = D.today();
    const at = (date, time) => ({ dateTime: `${date}T${time}:00`, timeZone: tz });
    const out = [];
    sessions().filter(s => s.date >= today && !s.done).forEach(s => out.push({
      summary: `📚 ${s.title}`,
      description: `Study guide topic: ${s.topicText}\n\n${s.tip}${(s.resources || []).length ? `\n\nUse: ${s.resources.slice(0, 3).join("; ")}` : ""}\n\nOpen Exam Prep HQ and tap Start for a timer and check-in.`,
      start: at(s.date, s.start), end: at(s.date, s.end),
      colorId: GCAL_COLORS[s.classId] || "8",
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] }
    }));
    tutorials().filter(t => t.date >= today && !t.done).forEach(t => out.push({
      summary: `🙋 ${S.className(t.classId)} tutorial`,
      description: `Ask about: ${askTopics(t.classId).slice(0, 3).join("; ") || "your study guide and 2 or 3 specific questions"}`,
      start: at(t.date, t.start), end: at(t.date, t.end), colorId: "5",
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }, { method: "popup", minutes: 12 * 60 }] }
    }));
    S.allParts().filter(p => p.date >= today).forEach(p => out.push({
      summary: `⭐ ${S.className(p.classId)} ${p.name.toLowerCase()} exam (in class)`,
      description: "Part of your exam happens in class today. Bring a fully charged iPad and anything your teacher asked for.",
      start: { date: p.date }, end: { date: D.addDays(p.date, 1) },
      colorId: GCAL_COLORS[p.classId] || "8",
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 6 * 60 }] }
    }));
    CFG.EXAMS.filter(e => e.date >= today).forEach(e => out.push({
      summary: `⭐ ${S.className(e.id)} exam (${S.examMinutes()} min)`,
      description: "You've prepared for this. Eat breakfast, bring your supplies, and use all your time.",
      start: { date: e.date }, end: { date: D.addDays(e.date, 1) },
      colorId: GCAL_COLORS[e.id],
      // 6 p.m. the night before: pack your bag and get to bed on time.
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 6 * 60 }] }
    }));
    return out;
  }

  const Exports = {
    planHTML,
    googleEvents,
    askTopics,
    print() { printInPage(planBody()); },
    printExamWeek() { printInPage(examWeekBody()); },
    examWeekBody,
    // Backup file: everything needed to move a plan to another device.
    backup() {
      const data = { app: "Exam Prep HQ", savedAt: new Date().toISOString(), state: Object.assign({}, S.state, { drive: {} }) };
      const name = (S.state.profile.name || "My") + " Exam Prep backup.json";
      download(name, JSON.stringify(data), "application/json");
    },
    word() { download("Exam Prep Plan.doc", "\ufeff" + planHTML(false), "application/msword"); },
    csv() { download("Exam Prep Plan.csv", "\ufeff" + csv(), "text/csv"); },
    ics() { download("Exam Prep Plan.ics", ics(), "text/calendar"); },
    async googleDoc() { return window.Drive.saveAsGoogleDoc(planHTML(false), `Exam Prep Plan (${D.pretty(D.today(), false)})`); },
    async googleSheet() { return window.Drive.saveAsGoogleSheet(csv(), `Exam Prep Plan (${D.pretty(D.today(), false)})`); }
  };

  window.Exports = Exports;
})();
