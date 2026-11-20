/* ==========================================================================
   EXAM PREP HQ: ALL THE READING CONTENT
   Teachers and counselors can edit the words here without touching the app code.
   Keep it short: students are more likely to read 2 sentences than 10.
   ========================================================================== */
window.CONTENT = {

  /* ---------- "How it works" on the home page ---------- */
  howItWorks: [
    { emoji: "✏️", title: "Tell us about your classes", body: "Five quick questions. About 5 minutes." },
    { emoji: "🗓️", title: "Get your plan", body: "Short study sessions that fit around your life." },
    { emoji: "✅", title: "Do one or two a day", body: "Check them off. That's it." }
  ],

  /* ---------- Tips (one idea per card, always with a "Try it") ---------- */
  tips: [
    {
      id: "study", emoji: "🧠", title: "Study smarter", blurb: "Four moves that beat rereading.",
      cards: [
        { title: "Quiz yourself", body: "Pulling answers out of your memory makes them stick. Rereading doesn't.", try: "Close your notes. Write everything you remember for 5 minutes. Then check." },
        { title: "Spread it out", body: "30 minutes on 3 different days beats 90 minutes the night before.", try: "Your plan already does this. Just follow it." },
        { title: "Mix it up", body: "Tests mix topics together, so your practice should too.", try: "Do practice problems from different units in random order." },
        { title: "Short sprints", body: "Your brain focuses best in short bursts.", try: "Phone in another room. Work 25 minutes, then take a 5-minute break." }
      ]
    },
    {
      id: "organize", emoji: "🗂️", title: "Get organized", blurb: "Find your stuff before you study it.",
      cards: [
        { title: "One folder per class", body: "Study guide, notes, and old quizzes all go together.", try: "Do one class a day this week. Small is fast." },
        { title: "Old quizzes are gold", body: "They show what your teacher asks and what you tend to miss.", try: "Star every question you got wrong. Those go on your study list." },
        { title: "A study spot", body: "Same place, good light, everything in reach.", try: "Stock it with pencils, index cards, water, and a timer." }
      ]
    },
    {
      id: "testday", emoji: "🎯", title: "Test day", blurb: "A plan for your 70 minutes.",
      cards: [
        { title: "First 2 minutes", body: "Breathe. Flip through the whole exam so nothing surprises you.", try: "Jot down formulas or memory tricks in the margin right away (if your teacher allows it)." },
        { title: "Easy ones first", body: "Answer what you know to bank points. Circle hard ones and come back.", try: "Check the clock halfway through. Are you about halfway done?" },
        { title: "Multiple choice", body: "Answer in your head first, then look at the choices.", try: "Cross out answers you know are wrong. Watch for NOT and EXCEPT." },
        { title: "Written answers", body: "Answer exactly what the question asks.", try: "Underline the task word (explain, compare) and use the question's words in your first sentence." },
        { title: "Mind went blank?", body: "It happens to everyone, and it passes.", try: "Breathe in for 4, out for 6. Skip to a question you know." }
      ]
    },
    { id: "tutorials", emoji: "🙋", title: "Tutorials", blurb: "Get the most from 3:15 to 3:40.", special: true },
    { id: "time", emoji: "⏱️", title: "Extended time", blurb: "Your time is yours. Use all of it.", special: true },
    {
      id: "balance", emoji: "🌿", title: "Stay balanced", blurb: "Sleep and fun are part of studying.",
      cards: [
        { title: "Sleep is study time", body: "Your brain saves what you learned while you sleep. Most kids your age need 9 or more hours.", try: "Pick a screens-off time for exam week and stick to it." },
        { title: "Keep moving", body: "Practices, walks, and dance breaks all help your brain focus.", try: "Use your 5-minute breaks to get up and move." },
        { title: "One exam is one day", body: "A test shows what you know that day. It doesn't measure how smart you are or who you are.", try: "Swap \"I'm bad at this\" for \"I'm still learning this.\"" },
        { title: "Nerves are normal", body: "A little nervousness means you care. If worry gets big or won't go away, talk to someone.", try: "Tell a parent, teacher, advisor, or counselor. That's a strong move." }
      ]
    },
    {
      id: "examweek", emoji: "✅", title: "Exam week checklist", blurb: "Little habits for calmer exam days.",
      checklist: [
        "Night before: pack pencils, calculator (if allowed), water, and a snack",
        "Night before: light review only, nothing new",
        "Night before: lights out on time",
        "Morning of: eat breakfast",
        "Morning of: know which room you're in",
        "After each exam: take a real break before studying for the next one"
      ]
    },
    { id: "myths", emoji: "🤔", title: "Myth or fact?", blurb: "Tap cards to test what you know.", special: true },
    { id: "help", emoji: "❓", title: "How do I…?", blurb: "Quick answers about using Exam Prep HQ.", special: true }
  ],

  /* ---------- Tutorials page ---------- */
  tutorials: {
    intro: "Tutorials are time with the person who wrote your exam. Come with a plan and you'll leave with answers.",
    phases: [
      { title: "Before", emoji: "📝", items: ["Try the study guide first.", "Pick 2 or 3 specific questions.", "Bring your study guide and notes."] },
      { title: "During", emoji: "💬", items: ["Ask your most important question first.", "Show your work: \"Where did I go wrong?\"", "Ask what kinds of questions will be on the exam."] },
      { title: "After", emoji: "✅", items: ["Try a similar problem on your own that night.", "Re-rate that topic in Exam Prep HQ.", "Still stuck? Go again. That's normal."] }
    ],
    starters: [
      "Can you show me how you'd start this problem?",
      "I understand ___, but I get lost at ___.",
      "I got this answer. Can you check my steps?",
      "What kinds of questions should I practice for this unit?",
      "What mistake do students usually make on this?"
    ],
    email: "Hi [Teacher name],\nThis is [your name] from [period]. I'm stuck on [topic or question number] on the study guide. I tried [what you did]. Could I come to tutorials on [day]?\nThank you,\n[Your name]"
  },

  /* ---------- Myth or fact flip cards ---------- */
  myths: [
    { claim: "Rereading my notes over and over is the best way to study.", answer: "Myth", why: "Rereading makes material feel familiar, which tricks you into thinking you know it. Quizzing yourself works much better." },
    { claim: "Pulling an all-nighter helps you remember more.", answer: "Myth", why: "Sleep is when your brain stores memories. Losing sleep makes it harder to remember and to think clearly on the test." },
    { claim: "Studying a little on many days beats one long session.", answer: "Fact", why: "That's spaced practice, one of the strongest study strategies scientists have found." },
    { claim: "Highlighting the whole page means I studied it.", answer: "Myth", why: "Highlighting alone is passive. Turn highlights into questions and answer them without looking." },
    { claim: "Feeling some nerves before a test is normal.", answer: "Fact", why: "Some nervousness can actually help you focus. Breathing slowly helps calm the rest." },
    { claim: "Music with lyrics helps everyone focus.", answer: "Myth", why: "Lyrics compete with reading and writing for your brain's attention. If you like music, try instrumental." },
    { claim: "Using extended time means I'm getting an unfair advantage.", answer: "Myth", why: "Accommodations level the playing field so the test measures what you know, not how fast you process." },
    { claim: "Practice tests are one of the best ways to prepare.", answer: "Fact", why: "They're retrieval practice plus a rehearsal for the real thing." }
  ],

  /* ---------- Confidence scale ---------- */
  confidence: [
    { v: 1, emoji: "😵", label: "Lost" },
    { v: 2, emoji: "😬", label: "Shaky" },
    { v: 3, emoji: "😐", label: "Okay" },
    { v: 4, emoji: "🙂", label: "Pretty good" },
    { v: 5, emoji: "😎", label: "Got it" }
  ],

  /* ---------- MindPrint ----------
     Matches the MindPrint Student Profile: three categories, skills listed
     strongest first. The first skill in a category is a "stronger skill" to
     lean on; the last could be a "blocker." The skill descriptions and tips
     below are Exam Prep HQ's own wording. */
  mindprint: {
    domains: [
      { id: "reasoning", name: "Complex Reasoning", sub: "Understanding new concepts", skills: ["verbal", "abstract", "spatial"] },
      { id: "memory", name: "Memory", sub: "Remembering information", skills: ["verbalMemory", "visualMemory"] },
      { id: "exec", name: "Executive Functions", sub: "Organizing and completing work", skills: ["workingMemory", "attention", "speed", "flexible"] }
    ],
    skills: {
      verbal: {
        name: "Verbal Reasoning", icon: "📘", what: "Understanding and using what you read and hear.",
        aliases: ["verbal reasoning"],
        strength: ["Explain each topic in your own words, out loud or in writing.", "Turn study guide items into questions and answer them in full sentences.", "For math word problems, reread the question and restate it in your own words first."],
        support: ["Pair key terms with a picture, example, or diagram.", "Read test questions twice and underline the task word.", "Ask your teacher what a strong answer looks like."]
      },
      abstract: {
        name: "Visual-Abstract Reasoning", icon: "📈", what: "Making sense of patterns, numbers, shapes, and big ideas.",
        aliases: ["visual-abstract reasoning", "visual abstract reasoning", "abstract reasoning"],
        strength: ["Look for the big idea that connects topics across units.", "Make compare-and-contrast charts.", "Do mixed practice where you choose the strategy."],
        support: ["Study worked examples step by step before trying problems.", "Connect each idea to a real-life example.", "Keep a list of problem types and the first step for each."]
      },
      spatial: {
        name: "Visual-Spatial Reasoning", icon: "🧭", what: "Picturing how things fit together in space, like graphs, diagrams, and maps.",
        aliases: ["visual-spatial reasoning", "visual spatial reasoning", "spatial reasoning", "spatial perception"],
        strength: ["Draw concept maps, timelines, and diagrams.", "Sketch a picture for each key term.", "Use color and layout to organize notes."],
        support: ["Turn diagrams and graphs into a few written sentences.", "Label every part of a graph or diagram you study.", "Use graph paper or lined spacing to keep math work neat."]
      },
      verbalMemory: {
        name: "Verbal Memory", icon: "🗂️", what: "Remembering what you read and hear.",
        aliases: ["verbal memory"],
        strength: ["Say information out loud as you study, or record yourself and listen back.", "Make up rhymes, acronyms, or sentences to remember lists.", "Teach someone at home what you learned."],
        support: ["Add pictures to flashcards.", "Review vocabulary in short, spaced sessions.", "Rewrite definitions in your own words."]
      },
      visualMemory: {
        name: "Visual Memory", icon: "📷", what: "Remembering formulas, figures, pictures, and charts.",
        aliases: ["visual memory"],
        strength: ["Color-code notes by topic.", "Make picture flashcards and sketchnotes.", "Picture where the information was on the page or slide."],
        support: ["Say formulas and steps out loud as you write them.", "Describe charts and diagrams in words.", "Rewrite key formulas from memory a few times across different days."]
      },
      workingMemory: {
        name: "Working Memory", icon: "📝", what: "Holding information in your head while you work through steps.",
        aliases: ["working memory"],
        strength: ["Practice multi-step problems and talk through your plan.", "Quiz yourself on how ideas connect.", "Help organize your study group."],
        support: ["Write every step down, even simple ones.", "Chunk big topics into small pieces.", "Use checklists so nothing gets skipped."]
      },
      attention: {
        name: "Attention", icon: "🎯", what: "Staying focused to work accurately.",
        aliases: ["attention"],
        strength: ["You can handle longer study blocks, so try 45-minute sessions.", "Use your focus for full-length practice exams.", "Help a study buddy stay on track."],
        support: ["Use short sprints: 20 minutes on, 5 minutes off.", "Phone in another room, one tab open.", "Write a 3-item to-do list before each session and check items off."]
      },
      speed: {
        name: "Speed", icon: "⏳", what: "Balancing speed and accuracy.",
        aliases: ["speed", "processing speed"],
        strength: ["Do timed practice to build exam stamina.", "Try quick-fire flashcard rounds.", "Save leftover test time for checking answers."],
        support: ["Make a test plan: what to do first and how long for each section.", "Check your pace at the halfway point.", "Practice untimed first, then timed.", "If you have extended time, practice with your full time."]
      },
      flexible: {
        name: "Flexible Thinking", icon: "🧩", what: "Adapting to new or tricky questions and situations.",
        aliases: ["flexible thinking"],
        strength: ["Mix up problem types and topics when you practice.", "Try solving a problem two different ways.", "Look at each topic from more than one point of view."],
        support: ["When stuck, pause and try a set list of steps.", "Start each session with a topic you know, then switch.", "Practice \"trick\" questions so they feel familiar."]
      }
    },

    /* Strategy names that appear on MindPrint reports, with how to use each
       one during exam prep. Matching ignores capitalization and spacing. */
    strategies: [
      { name: "Space Out Studying", when: "study", use: "Your Exam Prep HQ plan already does this. Stick to it, even when a topic feels done." },
      { name: "Quiz Yourself - Active Recall", when: "study", use: "Every \"quiz yourself\" session is active recall: close your notes and pull the answers from memory." },
      { name: "Say it Aloud to Remember", when: "study", use: "Say key terms, formulas, and steps out loud during each study session." },
      { name: "Re-read & Re-state Out Loud", when: "study", use: "For English and history readings, reread a short part, then restate it out loud in your own words." },
      { name: "Annotate While Reading", when: "study", use: "Mark up practice passages: underline claims, circle key words, and jot a word or two in the margin." },
      { name: "Talk Through Math Problems", when: "study", use: "Explain each step of a math problem out loud as you solve it." },
      { name: "Compare to Previous Problems", when: "study", use: "Before solving, find a problem you've done that looks similar and use it as a guide." },
      { name: "Solve Word Problems in Steps", when: "study", use: "Write what you know, what you need, and the steps before you calculate." },
      { name: "Follow Steps When Stuck on a Question", when: "test", use: "Make your own \"stuck plan\" (reread, underline, try an example, skip and come back) and use it on the exam." },
      { name: "Pause, Notice, Choose", when: "test", use: "When a question feels confusing, pause, notice what it's really asking, then choose your approach." },
      { name: "Strengthen Decision Making Skills", when: "test", use: "On multiple choice, cross out answers you know are wrong before choosing." },
      { name: "Pause to Take Feedback", when: "study", use: "After every practice set, stop and look at what you missed before moving on." },
      { name: "Create a Homework Schedule", when: "plan", use: "Your Exam Prep HQ plan is your study schedule. Add it to Google Calendar so you see it." },
      { name: "Use a Planner", when: "plan", use: "Put your study sessions, tutorials, and exams in your planner or Google Calendar." },
      { name: "Homework Checklist", when: "plan", use: "Check off each study session in Exam Prep HQ when you finish it." },
      { name: "Stay Focused in Class", when: "study", use: "Review days before exams count. Take notes on anything your teacher says will be on the exam." },
      { name: "Use a Visual Timer", when: "study", use: "Use a timer you can see during study sessions and timed practice exams." },
      { name: "Know When to Skim", when: "test", use: "On reading-heavy exams, skim the questions first, then read the passage closely." },
      { name: "Be Aware of Running Out of Time", when: "test", use: "Check the clock at the halfway point of every exam and adjust your pace." },
      { name: "Make a Test Plan", when: "test", use: "In the first two minutes, decide which sections to do first and how long to spend on each." },
      { name: "\"Throw Away\" Test Anxiety", when: "test", use: "Before an exam, write your worries on scrap paper for two minutes, then throw it away." },
      { name: "Pace Yourself on Tests", when: "test", use: "Use the pacing plan on the Extended time page for every exam." }
    ]
  },

  /* ---------- Extended time page ---------- */
  extended: {
    why: [
      { title: "It's fair, not extra", body: "It lets the exam measure what you know, not how fast you work." },
      { title: "It says nothing about how smart you are", body: "Lots of strong thinkers work carefully. Careful is good on an exam." },
      { title: "Use every minute", body: "Students who use their full time usually do better. When others leave, that's not your signal." }
    ],
    slowDown: [
      "Read every question all the way to the end.",
      "Underline key words like NOT, EXCEPT, and explain.",
      "Write out your math steps.",
      "Feeling rushed? Take a 30-second breathing break."
    ]
  },

  /* ---------- Default study guide topics when none were added ---------- */
  defaultTopics: {
    english: ["Vocabulary and literary terms", "Reading passages and close reading", "Grammar and writing skills"],
    science: ["Key vocabulary", "Diagrams, processes, and labs", "Practice questions from old quizzes"],
    social: ["Key people, places, and dates", "Causes and effects", "Maps, documents, and short responses"],
    math: ["Formulas and rules", "Practice problems by unit", "Mistakes from old tests"],
    lang: ["Vocabulary", "Grammar and verb forms", "Reading, listening, or writing practice"]
  }
};
