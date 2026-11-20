# Exam Prep HQ: Upper School

A free study-planning website for Woodward Academy Upper School students (grades 9–12) preparing for semester exams. Students upload their own study guides, and the site turns them, plus their grades, confidence, and schedule, into short daily study sessions. It works on laptops and iPads.

It's a plain website (HTML, CSS, and JavaScript). There's no server and no database. Students' information stays in their own browser and, if they sign in, their own Google Drive.

This is a separate copy of the Middle School site. It works the same way, with these differences:

| | Middle School | Upper School |
|---|---|---|
| Grades | 7–8 | 9–12 |
| Classes | Class levels (like "English 8 HP") with preloaded study guides | General classes: English, Science, Social Studies, Math, World Language, plus up to 2 **Other** classes the student names |
| Study guides | Loaded by staff on the manager page | Each student uploads their own (PDF, Word, photo, or pasted text) |
| Classes not taken | n/a | Students uncheck **I have this exam** for any class they don't take |
| Tutorials | 3:15–3:40 p.m. | Two times: **morning 10:40–11:10 a.m.** and **afternoon 3:15–3:40 p.m.** |
| MindPrint | Yes | No |

## What students do

- **Setup (about 5 minutes):** five short screens.
  1. Name and grade
  2. For each class: **I have this exam** (on or off), letter grade, and a 😵 to 😎 face. **+ Add another class** adds up to 2 Other classes, each with its own name and exam date (for example, "AP Psychology" on Dec. 10).
  3. What's already on their calendar (practices, rehearsals, jobs), with quick day buttons like **Mon & Wed** or **Every weekday**
  4. When they like to study
  5. Extended time (optional)
- **My classes:** upload each class's study guide. The reader finds the topics, and students rate each one. They can also turn classes on or off, add an Other class, or change an Other class's name or exam date.
- **Today:** that day's sessions. Tap **▶ Start** for a timer, numbered steps, and a check-in ("How does this topic feel now?") that adjusts the plan. Also: **Add a session today**, **Feeling overwhelmed?**, and one-tap tutorial suggestions.
- **My Study Plan:** every session, starting with the next 7 days. Tap any session for details, **Start**, **Move it**, or **Mark done**. Missed sessions can be done now, moved, or **fit into the next session** for that class.
- **My Weekly Schedule:** a 7-day calendar starting today. **+ Add** on any day adds a tutorial (morning or afternoon), something they're busy with, or a day off.
- **Print my plan**, **Add to my calendar** (Google, or the iPad's Calendar app), **Print my exam week page**, **Share with a parent or advisor**, and a **backup file** to move a plan to another device.
- **Short on time mode:** when an exam is close or topics don't all fit, the plan combines smaller topics into focus reviews and shows one calm note with **Add more study time**.
- **Help** (top of every page), **Aa** text and display settings, read-aloud, and **Start over**.
- **Demo mode:** add `?demo` to the site address to show a made-up 10th grader, Jordan, on a projector. Nothing is saved to anyone's account.

## 1. Put the site on GitHub Pages (about 10 minutes)

1. Sign in at [github.com](https://github.com).
2. Click **+** (top right), then **New repository**. Name it something like `Exam-Prep-HQ-Upper`, set it to **Public**, and click **Create repository**.
3. On the new repository page, click **uploading an existing file**.
4. Unzip `exam-prep-hq-upper.zip`. Open the `exam-prep-hq-upper` folder, select **everything inside it** (`index.html`, `css`, `js`, `assets`, `README.md`, `.nojekyll`), and drag it onto the upload page. Click **Commit changes**.
   - On a Mac, press `Cmd + Shift + .` in Finder to see the hidden `.nojekyll` file.
5. Go to **Settings > Pages**. Set **Source** to *Deploy from a branch*, choose **main** and **/ (root)**, and click **Save**.
6. After a minute or two, your link appears at the top of that page, like `https://YOUR-USERNAME.github.io/Exam-Prep-HQ-Upper/`.

**Keep this separate from the Middle School repository.** Don't upload these files into the Middle School repo, or the other way around.

## 2. Turn on Google sign-in (optional)

If you already set up Google sign-in for the Middle School site **under the same GitHub account**, you can reuse the same Client ID. Both sites share the same web address (`https://YOUR-USERNAME.github.io`), which is what Google checks. Paste the same ID into `js/config.js` here.

If you haven't set it up yet, follow the Google sign-in steps in the Middle School README (create a Google Cloud project, enable the Drive and Calendar APIs, set the consent screen to **Internal**, create a Web application Client ID with `https://YOUR-USERNAME.github.io` as the authorized origin, and ask IT to trust the app for students under 18). Then paste the Client ID into `GOOGLE_CLIENT_ID` in `js/config.js`.

Students who sign in get a Drive folder named **Exam Prep (Upper School) - Fall 2026**, separate from any Middle School folder.

## 3. Settings you can change (`js/config.js`)

- `EXAMS`: the five main classes, with exam dates (`YYYY-MM-DD`), colors, and icons. Currently: English Dec. 11, Science Dec. 14, Social Studies Dec. 15, Math Dec. 16, World Language Dec. 17.
- `OTHER_SLOTS`: how many Other classes a student can add (currently 2). `OTHER_STYLES` sets their colors and icons.
- `EXAM_MINUTES`: standard exam length (currently 70). Extended time is figured from this.
- `TUTORIAL_TIMES`: the tutorial times students choose from (morning 10:40–11:10 a.m., afternoon 3:15–3:40 p.m.). `TUTORIAL_START` / `TUTORIAL_END` is the time used for one-tap tutorial suggestions.
- `GRADE_LEVELS`: the grades shown in setup (9–12).
- `GRADES`: the letter grade scale. Students only pick letters, and percentages are never shown.
- `DRIVE_FOLDER_NAME` and `SEMESTER_LABEL`: change each semester so students get a fresh Drive folder.
- `STORAGE_PREFIX`: the name for saved data in the browser. **Keep it different from the Middle School site** (it's `examPrepHQ.upper`). Both sites share one web address, so they'd otherwise share saved plans on the same device.
- `MINDPRINT`: `false` hides every MindPrint option.

Tips, the tutorial guide, myths, and other reading content are in `js/content.js`.

## 4. Privacy

- GitHub only hosts the website files. It never receives student information.
- Student entries stay in their browser and, if they sign in, in their own Google Drive. There's no database, analytics, or tracking.
- Study guides are read inside the browser. Their text is never sent anywhere.
- Fonts load from Google Fonts. The PDF and Word readers load from cdnjs.cloudflare.com.

## 5. How the study guide reader works

Students upload a PDF, Word file, or photo, or paste the text. The reader looks for, in order:

1. **A summary table** ("Topics | What's covered | How to study"). The "How to study" column becomes the materials named in each session.
2. **Lesson or section packets** ("Unit 1: …", "Lesson 2 – …", "Topic 3: …"). Each becomes a topic, with its packet pages.
3. **Headings** (larger or bold text), with short lines under them as details.

Students always see what was found and choose which topics to keep before anything is added. They can rename, remove, or add topics on My classes. Photos and scanned PDFs without real text can't be read; students paste the text or type topics instead.

## 6. How the plan is built

- Each topic gets 1 to 4 sessions based on confidence and grade, spaced at least 2 days apart, with a practice exam for each class the day before its exam where possible.
- Sessions are 30 minutes (students can choose 20–45) with breaks, inside the study times they picked, and around busy times and tutorials.
- **Short on time:** if an exam is 4 days away or less, or topics don't all fit, the plan skips the gear check, combines up to 3 topics into one focus review, and shows a calm note instead of warnings. Students can tap **Add more study time**.
- Classes a student doesn't take, and exams that are over, are left out of the plan.

## 7. Layout and accessibility

- Checked on laptop screens (1366×768 and 1440×900) and iPad sizes in portrait and landscape. My Weekly Schedule shows a 7-day grid on laptops and iPad landscape, and one row per day on iPad portrait. Phones get bottom tabs.
- Every page passes automated WCAG 2.1 AA checks (axe-core).
- Printing works inside the page, which iPad Safari handles reliably.
- Please do a final check on a real iPad and a real laptop before launch.

## 8. Testing on your own computer

In the `exam-prep-hq-upper` folder, run `python3 -m http.server 8000` and open `http://localhost:8000` (add `?demo` for the demo student).
