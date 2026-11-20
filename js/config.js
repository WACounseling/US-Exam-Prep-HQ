/* ==========================================================================
   PREP HQ: SETTINGS YOU CAN CHANGE
   This is the only file most people will ever need to edit.
   ========================================================================== */
window.PREP_CONFIG = {
  // 1) Paste your Google OAuth Client ID here (see README.md, "Turn on Google sign-in").
  //    Leave it empty and the site still works; students save on their own device only.
  GOOGLE_CLIENT_ID: "",

  // 2) Name of the folder the site creates in each student's Google Drive.
  DRIVE_FOLDER_NAME: "Exam Prep (Upper School) - Fall 2026",

  // 3) Optional: path to an official logo file you add to the /assets folder
  //    (for example "assets/wordmark-white.png"). Leave empty to show the school name as text.
  LOGO_URL: "",

  // Saved-data name. Must differ from the Middle School site, because both GitHub Pages
  // sites share one web address (your-username.github.io) and so share browser storage.
  STORAGE_PREFIX: "examPrepHQ.upper",

  SCHOOL_NAME: "Woodward Academy",
  DIVISION: "Upper School",

  // Grade choices in setup.
  GRADE_LEVELS: ["9", "10", "11", "12"],

  // MindPrint reports (Middle School only). false hides every MindPrint option.
  MINDPRINT: false,
  SEMESTER_LABEL: "Fall 2026 semester exams",

  // Tutorial times with teachers (school days only). Students pick the class, day, and time.
  TUTORIAL_TIMES: [
    { id: "morning", label: "Morning", start: "10:40", end: "11:10" },
    { id: "afternoon", label: "Afternoon", start: "15:15", end: "15:40" }
  ],
  // Default tutorial time (used for one-tap tutorial suggestions).
  TUTORIAL_START: "15:15",
  TUTORIAL_END: "15:40",

  // "Other" classes students can add (each with its own name and exam date).
  OTHER_SLOTS: 2,

  // Upper School students upload their own study guides, so there are no class-level menus.
  COURSES: {},

  // Letter grades. Students only ever pick a letter; percentages are never shown.
  // "min" is the lowest percentage for each letter. It's used only behind the scenes
  // to decide how much study time each class gets. Change it to match the official scale.
  GRADES: [
    { letter: "A+", min: 97 }, { letter: "A", min: 93 }, { letter: "A-", min: 90 },
    { letter: "B+", min: 87 }, { letter: "B", min: 83 }, { letter: "B-", min: 80 },
    { letter: "C+", min: 77 }, { letter: "C", min: 73 }, { letter: "C-", min: 70 },
    { letter: "D+", min: 67 }, { letter: "D", min: 63 }, { letter: "D-", min: 60 },
    { letter: "F", min: 0 }
  ],

  // 4) Exam length in minutes (standard time).
  EXAM_MINUTES: 70,

  // 5) The exam schedule. Dates are YYYY-MM-DD. Update these each semester.
  //    Keep the "id" values the same.
  EXAMS: [
    { id: "english", name: "English",        short: "English",  date: "2026-12-11", color: "#006097", tint: "#e3eef6", icon: "📖" },
    { id: "science", name: "Science",        short: "Science",  date: "2026-12-14", color: "#25683f", tint: "#e4f3ea", icon: "🔬" },
    { id: "social",  name: "Social Studies", short: "Social",   date: "2026-12-15", color: "#a14f0f", tint: "#fbeadb", icon: "🌎" },
    { id: "math",    name: "Math",           short: "Math",     date: "2026-12-16", color: "#007380", tint: "#dff3f4", icon: "📐" },
    { id: "lang",    name: "World Language", short: "Language", date: "2026-12-17", color: "#5a0207", tint: "#f6e3e1", icon: "🗣️" }
  ],

  // Colors for students' "Other" classes (their names and exam dates come from the student).
  OTHER_STYLES: [
    { color: "#4c3b8f", tint: "#ece8f7", icon: "⭐" },
    { color: "#6b5600", tint: "#f7f0d6", icon: "✳️" }
  ]};
