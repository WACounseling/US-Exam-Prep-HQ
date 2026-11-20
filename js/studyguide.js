/* ==========================================================================
   EXAM PREP HQ: READING STUDY GUIDES
   Pulls text out of PDF, Word (.docx), and text files right in the browser,
   then guesses the list of topics. Students always get to edit the list.
   ========================================================================== */
(function () {
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const MAMMOTH = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";

  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve;
      s.onerror = () => reject(new Error("Couldn't load the file reader. Check your internet connection."));
      document.head.appendChild(s);
    });
    return loaded[src];
  }

  async function pdfText(file) {
    await loadScript(PDFJS);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const lines = [];
    for (let p = 1; p <= Math.min(doc.numPages, 20); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // Group text pieces into lines by their vertical position.
      let lastY = null, line = "";
      content.items.forEach(it => {
        const y = Math.round(it.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 3) { lines.push(line); line = ""; }
        line += (line && !line.endsWith(" ") && !it.str.startsWith(" ") ? " " : "") + it.str;
        lastY = y;
      });
      if (line) lines.push(line);
    }
    return lines.join("\n");
  }

  async function docxText(file) {
    await loadScript(MAMMOTH);
    const r = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return r.value;
  }

  async function extract(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) return pdfText(file);
    if (name.endsWith(".docx")) return docxText(file);
    if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) return file.text();
    return null; // images, Google Docs shortcuts, etc.: student types topics instead
  }

  const SKIP = /^(name|date|period|class|teacher|page \d+|due|directions?:?|study guide|exam review|semester exam|final exam|score|points?)\b/i;

  function topicsFromText(text) {
    if (!text) return [];
    const raw = text.split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    const out = [];
    const seen = new Set();
    const add = t => {
      t = t.replace(/^[\s•●○◦▪■□✓✔\-–—*>]+/, "")
           .replace(/^(\(?[0-9]{1,2}[.)]|\(?[a-zA-Z][.)]|[ivxIVX]{1,4}[.)])\s+/, "")
           .replace(/[_]{2,}.*$/, "")
           .replace(/\s*[:.]+$/, "")
           .trim();
      if (t.length < 3 || t.length > 110) return;
      if (SKIP.test(t)) return;
      if (/^[\d\s.,-]+$/.test(t)) return;
      const key = t.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(t);
    };

    // Pass 1: headings like "Unit 3: Ecosystems", "Chapter 4", "Topic", "Section".
    const heading = /^(unit|chapter|ch\.|topic|section|lesson|module|part|week)\s*[\dA-Z]+\b.*$/i;
    raw.forEach(l => { if (heading.test(l)) add(l); });

    // Pass 2: bullets and numbered items.
    if (out.length < 4) {
      const bullet = /^([•●○◦▪■□✓✔\-–*]|\(?\d{1,2}[.)]|\(?[a-z][.)]|[ivx]{1,4}[.)])\s+/i;
      raw.forEach(l => { if (bullet.test(l)) add(l); });
    }

    // Pass 3: short lines that look like titles (few words, starts with a capital).
    if (out.length < 4) {
      raw.forEach(l => {
        const words = l.split(" ").length;
        if (words >= 1 && words <= 8 && /^[A-Z]/.test(l) && !/[?]$/.test(l)) add(l);
      });
    }
    return out.slice(0, 30);
  }

  /* ---------- MindPrint report reader ----------
     Built for the MindPrint Student Profile. In the "My Profile" section each
     category lists its skills strongest first, followed by a "Top Strategy."
     The glossary at the end lists skills in a fixed order, so it's ignored.
     Students always confirm the result before it's saved. */
  // Same length in and out, so positions in the lowercase copy match the original.
  const norm = s => s.replace(/[\u2010-\u2015]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ");
  const squash = s => norm(s).toLowerCase().replace(/\s*-\s*/g, "-").replace(/[^a-z0-9"'&-]+/g, " ").trim();

  function firstIndex(hay, needles, from = 0) {
    let best = -1;
    needles.forEach(n => {
      const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/-/g, "\\s*-\\s*")}\\b`, "g");
      re.lastIndex = from;
      const m = re.exec(hay);
      if (m && (best === -1 || m.index < best)) best = m.index;
    });
    return best;
  }

  function readMindprint(text) {
    const result = { order: {}, top: {}, strategies: [], found: 0 };
    if (!text) return result;
    const MP = window.CONTENT.mindprint;
    const orig = norm(text);
    const t = orig.toLowerCase();

    // 1) The "My Profile" section only.
    let segStart = t.indexOf("my profile");
    if (segStart === -1) segStart = 0;
    let segEnd = t.length;
    ["subject checklist", "personalized recommendations", "recommended strategies", "glossary of terms"].forEach(m => {
      const i = t.indexOf(m, segStart);
      if (i !== -1 && i < segEnd) segEnd = i;
    });

    // 2) Find where each category box starts (its subtitle is the most reliable marker).
    const anchors = {
      reasoning: ["understanding new concepts", "complex reasoning"],
      memory: ["remembering information"],
      exec: ["organizing & completing", "organizing and completing"]
    };
    const starts = [];
    MP.domains.forEach(d => {
      const seg = t.slice(0, segEnd);
      let at = -1;
      for (const a of anchors[d.id]) { at = seg.indexOf(a, segStart); if (at !== -1) break; }
      if (at !== -1) starts.push({ id: d.id, at });
    });
    starts.sort((a, b) => a.at - b.at);

    // 3) Skills in each box, in the order they appear (strongest first).
    starts.forEach((s, i) => {
      const end = i + 1 < starts.length ? starts[i + 1].at : segEnd;
      const chunk = t.slice(s.at, end);
      const dom = MP.domains.find(d => d.id === s.id);
      const topAt = chunk.indexOf("top strategy");
      const listPart = topAt === -1 ? chunk : chunk.slice(0, topAt);
      const hits = dom.skills
        .map(id => ({ id, at: firstIndex(listPart, MP.skills[id].aliases) }))
        .filter(h => h.at !== -1)
        .sort((a, b) => a.at - b.at);
      if (hits.length >= 2) {
        const order = hits.map(h => h.id);
        dom.skills.forEach(id => { if (!order.includes(id)) order.push(id); });
        result.order[s.id] = order;
        result.found += hits.length;
      }
      // Top strategy: the words after "Top Strategy," minus the next box's heading.
      if (topAt !== -1) {
        let raw = orig.slice(s.at + topAt + "top strategy".length, s.at + Math.min(chunk.length, topAt + 90)).trim();
        raw = raw.replace(/\s*(Memory|Executive Functions|Complex Reasoning)\s*$/i, "").trim();
        if (raw && raw.length <= 70) result.top[s.id] = raw;
      }
    });

    // 4) Recommended strategies we know how to use for exam prep.
    const recStart = Math.max(0, t.indexOf("recommended strategies"));
    const glossary = t.indexOf("glossary of terms", recStart);
    const recText = squash(orig.slice(recStart, glossary === -1 ? undefined : glossary));
    const seen = [];
    const add = (name, at) => { if (!seen.some(x => x.name === name)) seen.push({ name, at }); };
    MP.strategies.forEach(st => {
      const at = recText.indexOf(squash(st.name));
      if (at !== -1) add(st.name, at);
    });
    // "Use Your Stronger ___" works with any skill name.
    Object.values(MP.skills).forEach(sk => sk.aliases.forEach(a => {
      const key = squash(`use your stronger ${a}`);
      let at = recText.indexOf(key);
      while (at !== -1) {
        const tail = recText.slice(at + key.length, at + key.length + 15);
        add(`Use Your Stronger ${sk.name}${tail.startsWith(" in group work") ? " in Group Work" : ""}`, at);
        at = recText.indexOf(key, at + key.length);
      }
    }));
    result.strategies = seen.sort((a, b) => a.at - b.at).map(x => x.name);
    return result;
  }

  /* ======================================================================
     STUDY GUIDE READER
     Works from layout, not just words. In order:
       1. A summary table ("Sections on the Exam | Specifics | How to study"):
          section names from the first column, specifics from the second.
       2. Page headings (much bigger text, like GRAMMAR) and the short
          subheadings under them at the left margin ("Participles—Underline...",
          "Commas: Directions...", "Semicolons").
       3. If neither is found, the older line-by-line guess.
     Practice questions, numbered items, answer blanks, and answer keys are skipped.
     Returns [{ text, details: [] }]. Students always review the list.
     ====================================================================== */
  const BULLET = /^[❖•●○◦▪■□✓✔➢►▶✦★◆◇→*–-]\s*/;
  const INSTRUCTION = /^(underline|indicate|punctuate|mark|identify|write|define|circle|label|answer|explain|complete|fill|choose|match|list|describe|read|directions|highlight|correct|rewrite|combine|use|solve|show|find|draw|compare)\b/i;
  const NOT_TOPICS = /^(name|date|period|class|teacher|score|notes?|quote|answer|essay question|due|page|directions|key)\b/i;

  const clean = t => t.replace(/\s+/g, " ").replace(/\s*\/\s*/g, "/").replace(/[\s:;,.\-–—]+$/, "").trim();
  const words = t => t.split(/\s+/).filter(Boolean).length;
  const capFirst = t => t.charAt(0).toUpperCase() + t.slice(1);
  const SMALL = /^(of|and|the|to|in|for|a|an|on|or|vs)$/i;
  const unCaps = t => (t === t.toUpperCase() && /[A-Z]{3}/.test(t))
    ? t.toLowerCase().split(" ").map((w, i) => (i > 0 && SMALL.test(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : t;

  // PDF -> pages of "runs" (pieces of text on one line that sit together).
  async function pdfPages(file) {
    await loadScript(PDFJS);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let p = 1; p <= Math.min(doc.numPages, 25); p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      pages.push(itemsToRuns(tc.items));
    }
    return pages;
  }

  function itemsToRuns(items) {
    const runs = [];
    let cur = null;
    items.forEach(it => {
      if (!it.str || !it.str.trim()) return;
      const x = it.transform[4], y = it.transform[5], h = it.height || Math.abs(it.transform[3]);
      const gap = cur ? x - cur.end : 0;
      if (cur && Math.abs(cur.y - y) <= 3 && gap > -2 && gap < 12) {
        cur.text += (gap > 1.5 ? " " : "") + it.str;
        cur.end = x + it.width;
        cur.size = Math.max(cur.size, h);
      } else {
        if (cur) runs.push(cur);
        cur = { text: it.str, x, y, end: x + it.width, size: h };
      }
    });
    if (cur) runs.push(cur);
    runs.forEach(r => { r.text = r.text.replace(/\s+/g, " ").trim(); r.size = Math.round(r.size * 10) / 10; });
    return runs;
  }

  function bodySize(pages) {
    const count = {};
    pages.flat().forEach(r => { const k = Math.round(r.size); count[k] = (count[k] || 0) + r.text.length; });
    return Number(Object.entries(count).sort((a, b) => b[1] - a[1])[0][0]);
  }

  /* 0) Packets organized by lesson or section ("Topic 1: … / Master Vocabulary / Lesson 1 – …").
     Each lesson or section becomes a topic, with the packet pages it covers as "Review packet pgs. X-Y". */
  const COVER_LINE = /^(my\s+)?(name|date|period|teacher|room|proctor|exam proctor|date\/time)\b|_{3,}/i;
  function pageLines(runs) {
    const rows = [];
    runs.slice().sort((a, b) => (b.y - a.y) || (a.x - b.x)).forEach(r => {
      const last = rows[rows.length - 1];
      if (last && Math.abs(last.y - r.y) <= 3) last.text += " " + r.text; else rows.push({ y: r.y, text: r.text });
    });
    return rows.map(r => clean(r.text));
  }
  function layoutTopics(pages) {
    const lines = pages.map(pageLines);
    const pgLabel = (a, b) => a === b ? `Review packet pg. ${a}` : `Review packet pgs. ${a}-${b}`;
    const last = pages.length;
    const ranges = list => list.map((h, i) => {
      const next = list[i + 1];
      let end = last;
      if (next) end = next.atTop ? Math.max(h.page, next.page - 1) : next.page;
      return Object.assign({}, h, { end });
    });
    // Lessons
    const lessons = [];
    lines.forEach((ls, i) => ls.forEach((l, k) => {
      const m = l.match(/^Lesson\s+\d+\s*[–—:-]\s*(.{3,70})$/i);
      if (m) lessons.push({ title: capFirst(clean(m[1])), page: i + 1, atTop: k <= 2 });
    }));
    if (lessons.length >= 3) {
      const out = [];
      const vocabPage = lines.findIndex(ls => ls.some(l => /^master vocabulary\b/i.test(l)));
      if (vocabPage >= 0) {
        const groups = lines[vocabPage].map(l => l.match(/^(Topic|Unit|Chapter)\s+\d+\s*[:–—-]\s*(.{3,60})$/i)).filter(Boolean).map(m => `${m[1]} ${m[0].match(/\d+/)[0]}: ${clean(m[2]).replace(/:$/, "")}`);
        out.push({ text: "Master Vocabulary", details: groups, resources: [`Review packet pg. ${vocabPage + 1} (vocabulary lists)`] });
      }
      ranges(lessons).forEach(h => out.push({ text: h.title, details: [], resources: [pgLabel(h.page, h.end)] }));
      return out;
    }
    // Sections on the practice pages (overview pages that only list vocabulary and goals are skipped)
    const isOverview = ls => ls.some(l => /^(master vocabulary|students (will|should) be able to)/i.test(l)) && ls.filter(l => /^\d{1,3}[.)]\s/.test(l)).length < 2;
    const seen = new Set();
    const sections = [];
    lines.forEach((ls, i) => {
      if (isOverview(ls)) return;
      ls.forEach((l, k) => {
        const m = l.match(/^(?:(Topic|Unit|Chapter)\s+(\d+)\s*[:–—-]\s*([A-Za-z&,' ]{3,50}?)|((?:Science\s+)?Process Skills|Measurement))\s*:?\s*$/i);
        if (!m) return;
        const title = m[4] ? capFirst(m[4].replace(/^Science\s+/i, "")) : `${capFirst(m[3].trim())} (${m[1]} ${m[2]})`;
        const key = title.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        sections.push({ title, page: i + 1, atTop: k <= 3 });
      });
    });
    if (sections.length >= 2) return ranges(sections).map(h => ({ text: h.title, details: [], resources: [pgLabel(h.page, h.end)] }));
    return [];
  }

  /* 1) Summary table */
  function tableTopics(pages, body) {
    const HEADER = /^(sections?|topics?|units?|content|areas?|skills?|categories|what's on the exam)\b|\bon the exam\b/i;
    for (const runs of pages) {
      const header = runs.find(r => HEADER.test(r.text) && words(r.text) <= 7);
      if (!header) continue;
      const cols = runs.filter(r => Math.abs(r.y - header.y) <= 3).sort((a, b) => a.x - b.x);
      if (cols.length < 2 || cols[0] !== header) continue;
      const below = runs.filter(r => r.y < header.y - 2 && r.y > 60);
      // Header words are often centered, so find where each column's text really starts.
      const h2 = cols[1].x, h3 = cols[2] ? cols[2].x : Infinity;
      const c3 = h3 === Infinity ? Infinity : Math.min(...below.filter(r => r.x > h2 + 40 && r.x >= h3 - 60).map(r => r.x).concat([h3]));
      const c2 = Math.min(...below.filter(r => r.x >= h2 - 60 && r.x < c3).map(r => r.x).concat([h2]));
      const col2 = c2 + 15, col3 = c3 === Infinity ? Infinity : c3 + 10;

      // Row labels: first column, normal-or-bigger text, not bullets.
      let labels = below.filter(r => r.x < col2 - 15 && r.size >= body * 0.95 && !BULLET.test(r.text) && /[A-Za-z]{3}/.test(r.text))
        .sort((a, b) => b.y - a.y);
      const merged = [];
      labels.forEach(l => {
        const prev = merged[merged.length - 1];
        if (prev && prev.y - l.y < prev.size * 1.6) { prev.text += " " + l.text; prev.y2 = l.y; }
        else merged.push(Object.assign({ y2: l.y }, l));
      });
      if (merged.length < 2) continue;

      // Turn the runs in one table cell into a list (bullets start new items; other lines continue them).
      const cellList = cells => {
        const hasBullets = cells.some(c => BULLET.test(c.text));
        const out = [];
        let fresh = true;
        cells.forEach(c => {
          if (/^[❖•●○◦▪■□✓✔➢►▶✦★◆◇]$/.test(c.text)) { fresh = true; return; }
          const isNew = !hasBullets || fresh || BULLET.test(c.text);
          const t = c.text.replace(BULLET, "");
          if (isNew || !out.length) out.push(t); else out[out.length - 1] += " " + t;
          fresh = false;
        });
        return out.map(d => capFirst(clean(d))).filter(Boolean);
      };
      const topics = merged.map((l, i) => {
        const top = l.y + l.size;
        const bottom = merged[i + 1] ? merged[i + 1].y + merged[i + 1].size : -Infinity;
        const inRow = r => r.y <= top && r.y > bottom;
        const sortRuns = (a, b) => (b.y - a.y) || (a.x - b.x);
        const details = cellList(below.filter(r => r.x >= col2 - 20 && r.x < col3 - 15 && inRow(r)).sort(sortRuns));
        // Third column ("How to study"): what to use when studying this section.
        const resources = col3 === Infinity ? [] : cellList(below.filter(r => r.x >= col3 - 15 && inRow(r)).sort(sortRuns));
        return { text: clean(unCaps(l.text)), details, resources };
      });
      return topics;
    }
    return [];
  }

  /* 2) Page headings and subheadings */
  function subheading(text) {
    const t = text.replace(/\s+/g, " ").trim();
    if (!/^[A-Z“"']/.test(t) || /^\d/.test(t) || /=/.test(t) || NOT_TOPICS.test(t) || INSTRUCTION.test(t)) return null;
    const m = t.match(/^(.{2,70}?)\s*(—|–|--|-\s|:)\s*(.*)$/);
    if (m) {
      const term = m[1], rest = m[3].trim();
      if (!rest || /_{3,}/.test(rest)) return null;                // "Fragment: ______", "Run- on:____", "Title:"
      if (words(term) > 6 || /_{2,}/.test(term)) return null;
      return clean(term);
    }
    if (/_{2,}/.test(t)) return null;
    const w = t.split(" ");
    const verbAt = w.findIndex((x, i) => i > 0 && INSTRUCTION.test(x));
    if (verbAt > 0 && verbAt <= 4 && !/,/.test(w.slice(0, verbAt).join(" "))) return clean(w.slice(0, verbAt).join(" "));
    if (w.length <= 6 && !/[.?!:]$/.test(t)) return clean(t);
    return null;
  }

  function headingTopics(pages, body, opts = {}) {
    const sections = [];
    let cur = null;
    pages.forEach((runs, pi) => {
      const bodyRuns = runs.filter(r => Math.abs(r.size - body) <= 2.5 && r.y > 60 && !/^\d+$/.test(r.text));
      const margin = bodyRuns.length ? Math.min(...bodyRuns.map(r => r.x)) : 0;
      const ordered = runs.slice().sort((a, b) => (b.y - a.y) || (a.x - b.x));
      ordered.forEach((r, ri) => {
        const t = r.text.trim();
        const big = r.size >= body * 1.35 || r.big;
        if (big) {
          if (words(t) > 7 || /\b20\d\d\b/.test(t) || /^\d/.test(t) || /review|packet|study guide|semester exam|final exam/i.test(t)) return;
          cur = { text: clean(unCaps(t)), details: [] };
          sections.push(cur);
          return;
        }
        if (!cur || Math.abs(r.x - margin) > 8) return;
        if (opts.needEmphasis && !r.emph) return;
        // Skip lines that are really wrapped text ("Love at first" / "sight").
        const structured = /(—|–|--|-\s|:)/.test(t) || t.split(" ").slice(1, 5).some(w => INSTRUCTION.test(w));
        if (!structured) {
          const next = ordered[ri + 1];
          if (/[,]$/.test(t) || /\b(or|and|the|of|to|a|at|in)$/i.test(t)) return;
          if (next && r.y - next.y < r.size * 1.8 && Math.abs(next.x - r.x) < 30 && /^[a-z]/.test(next.text)) return;
        }
        const sub = subheading(t);
        if (sub && !cur.details.some(d => d.toLowerCase() === sub.toLowerCase())) cur.details.push(capFirst(sub));
      });
    });
    return sections;
  }

  /* Match a page heading to a table section ("Figurative Language" ~ "Figures of Speech"). */
  function sameTopic(a, b) {
    const wa = a.toLowerCase().match(/[a-z]{4,}/g) || [], wb = b.toLowerCase().match(/[a-z]{4,}/g) || [];
    return wa.some(x => wb.some(y => x.slice(0, 5) === y.slice(0, 5)));
  }

  function combine(table, heads) {
    if (table.length >= 2) {
      table.forEach(t => {
        const h = heads.find(x => sameTopic(t.text, x.text));
        if (h && h.details.length >= 2) t.details = h.details;
      });
      return table;
    }
    const useful = heads.filter(h => h.details.length || heads.length >= 2);
    return useful.length >= 2 ? useful : [];
  }

  // Word files: tables and headings come through as HTML.
  async function docxPages(file) {
    await loadScript(MAMMOTH);
    const r = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const dom = new DOMParser().parseFromString(`<div>${r.value}</div>`, "text/html");
    const root = dom.body.firstChild;
    let table = [];
    const runs = [];
    let y = 100000;
    Array.from(root.children).forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (tag === "table" && !table.length) {
        const rows = Array.from(el.querySelectorAll("tr"));
        const cellLines = td => Array.from(td.querySelectorAll("p, li")).map(x => x.textContent.trim()).filter(Boolean);
        if (rows.length >= 3) {
          const first = rows[0].children[0] ? rows[0].children[0].textContent.trim() : "";
          const body = /^(sections?|topics?|units?|content|areas?|skills?)\b|\bon the exam\b/i.test(first) ? rows.slice(1) : rows;
          table = body.map(tr => {
            const c = tr.children;
            const list = td => td ? cellLines(td).map(d => capFirst(clean(d.replace(BULLET, "")))).filter(Boolean) : [];
            return c.length >= 2 ? { text: clean(unCaps(c[0].textContent.trim())), details: list(c[1]), resources: list(c[2]) } : null;
          }).filter(t => t && t.text && words(t.text) <= 6);
        }
        return;
      }
      const text = el.textContent.trim();
      if (!text) return;
      const strong = Array.from(el.querySelectorAll("strong")).map(s => s.textContent).join("").trim();
      runs.push({ text, x: 0, y: y--, size: /^h[12]$/.test(tag) ? 30 : 12, big: /^h[12]$/.test(tag), emph: /^h[3-6]$/.test(tag) || (strong.length && strong.length >= text.replace(/[:\-—].*$/, "").trim().length * 0.8) });
    });
    return { pages: [runs], table, text: root.textContent };
  }

  // Pasted text: ALL CAPS lines are sections; subheadings need a dash, colon, or instruction word.
  function textPages(text) {
    let y = 100000;
    const runs = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => {
      const caps = l === l.toUpperCase() && /[A-Z]{3}/.test(l) && words(l) <= 6;
      return { text: l, x: 0, y: y--, size: caps ? 30 : 12, big: caps, emph: !caps && (/(—|–|--|-\s|:)/.test(l) || l.split(" ").slice(1, 7).some(w => INSTRUCTION.test(w))) };
    });
    return [runs];
  }

  async function readGuide(file) {
    const name = file.name.toLowerCase();
    let topics = [];
    if (name.endsWith(".pdf")) {
      const pages = await pdfPages(file);
      if (!pages.flat().length) return { readable: false, topics: [] };
      const body = bodySize(pages);
      const table = tableTopics(pages, body);
      const layout = table.length >= 2 ? [] : layoutTopics(pages);
      topics = layout.length >= 2 ? layout : combine(table, headingTopics(pages, body));
      if (!topics.length) topics = topicsFromText(pages.map(rs => rs.sort((a, b) => b.y - a.y).map(r => r.text).join("\n")).join("\n")).map(t => ({ text: t, details: [] }));
    } else if (name.endsWith(".docx")) {
      const d = await docxPages(file);
      topics = combine(d.table, headingTopics(d.pages, 12, { needEmphasis: true }));
      if (!topics.length) topics = topicsFromText(d.text).map(t => ({ text: t, details: [] }));
    } else if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
      topics = readPasted(await file.text());
    } else {
      return { readable: false, topics: [] };
    }
    topics = topics.filter(t => t.text && !COVER_LINE.test(t.text));
    return { readable: true, topics: topics.slice(0, 20) };
  }

  function readPasted(text) {
    const t = combine([], headingTopics(textPages(text), 12, { needEmphasis: true }));
    return t.length ? t : topicsFromText(text).map(x => ({ text: x, details: [] }));
  }

  // Exposed for testing in Node.
  const _internals = { itemsToRuns, bodySize, tableTopics, headingTopics, combine, subheading, layoutTopics };

  window.StudyGuide = { extract, topicsFromText, readMindprint, readGuide, readPasted, _internals };
})();
