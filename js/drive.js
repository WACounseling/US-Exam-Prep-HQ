/* ==========================================================================
   PREP HQ: GOOGLE SIGN-IN + GOOGLE DRIVE
   Uses Google Identity Services (token model) and the Drive REST API.
   Scope "drive.file" means the site can ONLY see files it created itself,
   never the rest of a student's Drive.
   ========================================================================== */
(function () {
  const CFG = window.PREP_CONFIG;
  const SCOPES = "openid email profile https://www.googleapis.com/auth/drive.file";
  // Lets the site create ONE calendar of its own ("Exam Prep HQ") and manage events in it.
  // It can't see or change any of the student's other calendars.
  const CAL_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
  const CAL = "https://www.googleapis.com/calendar/v3";
  const DATA_FILE = "exam-prep-hq-data.json";
  const API = "https://www.googleapis.com/drive/v3";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

  let tokenClient = null;
  let token = null;
  let tokenExpires = 0;
  let pending = null;
  let grantedScopes = "";

  const Drive = {
    user: null,
    enabled: () => !!CFG.GOOGLE_CLIENT_ID && !window.Store.demo,
    signedIn: () => !!token && Date.now() < tokenExpires,

    loadLibrary() {
      return new Promise((resolve, reject) => {
        if (window.google && google.accounts && google.accounts.oauth2) return resolve();
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Couldn't reach Google. Check your internet connection."));
        document.head.appendChild(s);
      });
    },

    async init() {
      if (!Drive.enabled()) return;
      await Drive.loadLibrary();
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CFG.GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: resp => {
          if (!pending) return;
          const p = pending; pending = null;
          if (resp.error) return p.reject(new Error(resp.error_description || resp.error));
          token = resp.access_token;
          grantedScopes = resp.scope || grantedScopes;
          tokenExpires = Date.now() + (Number(resp.expires_in) - 60) * 1000;
          try { sessionStorage.setItem("examPrepHQ.hint", "1"); } catch (e) { /* ignore */ }
          p.resolve();
        },
        error_callback: err => {
          if (!pending) return;
          const p = pending; pending = null;
          p.reject(new Error(err && err.type === "popup_closed" ? "Sign-in window was closed." : "Sign-in didn't finish."));
        }
      });
    },

    requestToken(prompt, scope) {
      return new Promise((resolve, reject) => {
        if (!tokenClient) return reject(new Error("Google sign-in isn't set up yet."));
        pending = { resolve, reject };
        const want = scope || (Drive.hasCalendar() ? `${SCOPES} ${CAL_SCOPE}` : SCOPES);
        tokenClient.requestAccessToken({ prompt, scope: want, hint: Drive.user ? Drive.user.email : undefined });
      });
    },

    hasCalendar: () => grantedScopes.split(" ").includes(CAL_SCOPE),

    // withCalendar: ask for Drive and Calendar in one pop-up (used by the calendar button).
    async signIn(withCalendar) {
      if (!tokenClient) await Drive.init();
      await Drive.requestToken("", withCalendar ? `${SCOPES} ${CAL_SCOPE}` : SCOPES);
      Drive.user = await Drive.api("https://www.googleapis.com/oauth2/v3/userinfo");
      await Drive.ensureFolders();
      return Drive.user;
    },

    signOut() {
      if (token && window.google) google.accounts.oauth2.revoke(token, () => {});
      token = null; tokenExpires = 0; Drive.user = null; grantedScopes = "";
    },

    async fresh() {
      if (!Drive.signedIn()) await Drive.requestToken("");
    },

    async api(url, opts = {}) {
      await Drive.fresh();
      const res = await fetch(url, Object.assign({}, opts, {
        headers: Object.assign({ Authorization: `Bearer ${token}` }, opts.headers || {})
      }));
      if (res.status === 401) { token = null; await Drive.fresh(); return Drive.api(url, opts); }
      if (!res.ok) {
        let msg = `Google Drive error ${res.status}`;
        try { const j = await res.json(); if (j.error && j.error.message) msg = j.error.message; } catch (e) { /* ignore */ }
        throw new Error(msg);
      }
      const type = res.headers.get("content-type") || "";
      return type.includes("application/json") ? res.json() : res.text();
    },

    async findFolder(name, parentId) {
      const q = [
        `mimeType='application/vnd.google-apps.folder'`,
        `name='${name.replace(/'/g, "\\'")}'`,
        "trashed=false",
        parentId ? `'${parentId}' in parents` : "'root' in parents"
      ].join(" and ");
      const r = await Drive.api(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`);
      return r.files && r.files[0] ? r.files[0].id : null;
    },

    async makeFolder(name, parentId) {
      const meta = { name, mimeType: "application/vnd.google-apps.folder" };
      if (parentId) meta.parents = [parentId];
      const r = await Drive.api(`${API}/files?fields=id`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(meta)
      });
      return r.id;
    },

    async ensureFolders() {
      const d = window.Store.state.drive;
      const root = (await Drive.findFolder(CFG.DRIVE_FOLDER_NAME)) || (await Drive.makeFolder(CFG.DRIVE_FOLDER_NAME));
      d.folderId = root;
      d.guidesFolderId = (await Drive.findFolder("Study Guides", root)) || (await Drive.makeFolder("Study Guides", root));
      d.schedulesFolderId = (await Drive.findFolder("My Schedules", root)) || (await Drive.makeFolder("My Schedules", root));
      const q = `name='${DATA_FILE}' and '${root}' in parents and trashed=false`;
      const r = await Drive.api(`${API}/files?q=${encodeURIComponent(q)}&fields=files(id,modifiedTime)`);
      d.dataFileId = r.files && r.files[0] ? r.files[0].id : "";
    },

    async loadData() {
      const d = window.Store.state.drive;
      if (!d.dataFileId) return null;
      const txt = await Drive.api(`${API}/files/${d.dataFileId}?alt=media`);
      try { return typeof txt === "string" ? JSON.parse(txt) : txt; } catch (e) { return null; }
    },

    async saveData(state) {
      const d = state.drive;
      if (!d.folderId) await Drive.ensureFolders();
      const body = JSON.stringify(state);
      if (d.dataFileId) {
        await Drive.api(`${UPLOAD}/files/${d.dataFileId}?uploadType=media`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body
        });
      } else {
        const r = await Drive.upload(new Blob([body], { type: "application/json" }), { name: DATA_FILE, parents: [d.folderId] });
        d.dataFileId = r.id;
      }
    },

    async upload(blob, meta) {
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
      form.append("file", blob);
      return Drive.api(`${UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink`, { method: "POST", body: form });
    },

    async uploadGuide(file, className) {
      const d = window.Store.state.drive;
      if (!d.guidesFolderId) await Drive.ensureFolders();
      return Drive.upload(file, { name: `${className} - ${file.name}`, parents: [d.guidesFolderId] });
    },

    async uploadToSubfolder(file, folderName, stateKey, fileName) {
      const d = window.Store.state.drive;
      if (!d.folderId) await Drive.ensureFolders();
      if (!d[stateKey]) d[stateKey] = (await Drive.findFolder(folderName, d.folderId)) || (await Drive.makeFolder(folderName, d.folderId));
      return Drive.upload(file, { name: fileName || file.name, parents: [d[stateKey]] });
    },

    // Google converts the HTML or CSV into an editable Google Doc or Sheet.
    async saveAsGoogleDoc(html, name) {
      const d = window.Store.state.drive;
      if (!d.schedulesFolderId) await Drive.ensureFolders();
      return Drive.upload(new Blob([html], { type: "text/html" }), {
        name, parents: [d.schedulesFolderId], mimeType: "application/vnd.google-apps.document"
      });
    },
    async saveAsGoogleSheet(csv, name) {
      const d = window.Store.state.drive;
      if (!d.schedulesFolderId) await Drive.ensureFolders();
      return Drive.upload(new Blob([csv], { type: "text/csv" }), {
        name, parents: [d.schedulesFolderId], mimeType: "application/vnd.google-apps.spreadsheet"
      });
    },
    /* ---------- Google Calendar ---------- */
    // Call straight from a button click so the permission pop-up isn't blocked.
    async connectCalendar() {
      if (!Drive.user) return Drive.signIn(true);
      if (!Drive.hasCalendar() || !Drive.signedIn()) await Drive.requestToken("", `${SCOPES} ${CAL_SCOPE}`);
      if (!Drive.hasCalendar()) throw new Error("Calendar permission wasn't given. Check the box for Google Calendar and try again.");
    },

    async ensureCalendar() {
      const d = window.Store.state.drive;
      if (d.calendarId) {
        try { await Drive.api(`${CAL}/calendars/${encodeURIComponent(d.calendarId)}?fields=id`); return d.calendarId; }
        catch (e) { d.calendarId = ""; }
      }
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
      const r = await Drive.api(`${CAL}/calendars`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: "Exam Prep HQ", description: "Study sessions, tutorials, and exams from Exam Prep HQ. Updating your plan in Exam Prep HQ replaces these events.", timeZone: tz })
      });
      d.calendarId = r.id;
      return r.id;
    },

    // Replaces everything on the Exam Prep HQ calendar with the current plan.
    async syncCalendar(events, onProgress) {
      const calId = encodeURIComponent(await Drive.ensureCalendar());
      const ids = [];
      let pageToken = "";
      do {
        const r = await Drive.api(`${CAL}/calendars/${calId}/events?maxResults=250&showDeleted=false&fields=items(id),nextPageToken${pageToken ? `&pageToken=${pageToken}` : ""}`);
        (r.items || []).forEach(i => ids.push(i.id));
        pageToken = r.nextPageToken || "";
      } while (pageToken);

      const total = ids.length + events.length;
      let done = 0;
      const tick = () => { done++; if (onProgress) onProgress(done, total); };
      const pool = async (items, fn, size = 4) => {
        const queue = items.slice();
        const workers = Array.from({ length: size }, async () => {
          while (queue.length) { const it = queue.shift(); await fn(it); tick(); }
        });
        await Promise.all(workers);
      };
      await pool(ids, id => Drive.api(`${CAL}/calendars/${calId}/events/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {}));
      await pool(events, ev => Drive.api(`${CAL}/calendars/${calId}/events`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ev)
      }));
      return events.length;
    },

    // Share a file Exam Prep HQ made (like the plan's Google Doc) with someone, read-only.
    async shareWith(fileId, email) {
      return Drive.api(`${API}/files/${fileId}/permissions?sendNotificationEmail=true&emailMessage=${encodeURIComponent("Here's my exam study plan from Exam Prep HQ.")}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "user", role: "reader", emailAddress: email })
      });
    },

    folderLink() {
      const id = window.Store.state.drive.folderId;
      return id ? `https://drive.google.com/drive/folders/${id}` : "https://drive.google.com";
    }
  };

  window.Drive = Drive;
})();
