// - updates live metrics and shapes
// - calls LLM 
// - changes background
// - emoji mood picker

(function () {
  const canvas = window.doodleCanvas.canvas;
  const interpretBtn = document.getElementById("interpret-btn");
  const summaryTextEl = document.getElementById("summary-text");
  const aiOutputEl = document.getElementById("ai-output");
  const aiEncouragementEl = document.getElementById("ai-encouragement");
  const statusBar = document.getElementById("status-bar");
  const energyPill = document.getElementById("energy-pill");
  const complexityPill = document.getElementById("complexity-pill");
  const shapeListEl = document.getElementById("shape-list");

  const moodButtons = document.querySelectorAll(".mood-btn");
  const likeBtn = document.getElementById("ai-like");
  const dislikeBtn = document.getElementById("ai-dislike");

  const calendarGrid = document.getElementById("calendar-grid");
  const calendarMonthLabel = document.getElementById(
    "calendar-month-label"
  );
  const calendarPrev = document.getElementById("calendar-prev");
  const calendarNext = document.getElementById("calendar-next");
  const calendarToday = document.getElementById("calendar-today");

  const MOOD_STORAGE_KEY = "doodle_mood_by_day";
  const JOURNAL_STORAGE_KEY = "doodle_journal_by_day";
  const FEEDBACK_STORAGE_KEY = "doodle_ai_feedback";
  const SKETCH_STORAGE_KEY = "doodle_strokes_by_day";

  // global state for calendar
  let currentYear;
  let currentMonth; // 0–11
  let selectedDateKey; // "YYYY-MM-DD"


  function todayKey() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function getCurrentYearMonth() {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }

  function formatYearMonth(year, month) {
    const date = new Date(year, month, 1);
    const name = date.toLocaleString("default", { month: "long" });
    return `${name} ${year}`;
  }

  function dateKeyFromParts(year, month, day) {
    // month: 0–11
    return (
      year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0"));}

  function saveMoodForDate(dateKey, mood) {
    if (!dateKey) return;
    const data = JSON.parse(localStorage.getItem(MOOD_STORAGE_KEY) || "{}");
    data[dateKey] = mood;
    localStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(data));
  }

  function loadMoodForDate(dateKey) {
    if (!dateKey) return null;
    const data = JSON.parse(localStorage.getItem(MOOD_STORAGE_KEY) || "{}");
    return data[dateKey] || null;
  }


  function saveJournalEntry(dateKey, journal) {
    if (!dateKey) return;
    const data = JSON.parse(
      localStorage.getItem(JOURNAL_STORAGE_KEY) || "{}"
    );
    data[dateKey] = journal;
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(data));
  }

  function loadJournalEntry(dateKey) {
    if (!dateKey) return null;
    const data = JSON.parse(
      localStorage.getItem(JOURNAL_STORAGE_KEY) || "{}"
    );
    return data[dateKey] || null;
  }

  function loadAllJournalEntries() {
    return JSON.parse(
      localStorage.getItem(JOURNAL_STORAGE_KEY) || "{}"
    );
  }


  function saveStrokesForDate(dateKey, strokes) {
    if (!dateKey) return;
    const data = JSON.parse(
      localStorage.getItem(SKETCH_STORAGE_KEY) || "{}"
    );
    data[dateKey] = strokes || [];
    localStorage.setItem(SKETCH_STORAGE_KEY, JSON.stringify(data));
  }

  function loadStrokesForDate(dateKey) {
    if (!dateKey) return null;
    const data = JSON.parse(
      localStorage.getItem(SKETCH_STORAGE_KEY) || "{}"
    );
    return data[dateKey] || null;
  }

  // hex -> simple names

  function hexToHsl(hex) {
    if (!hex) return { h: 0, s: 0, l: 0 };
    let c = hex.replace("#", "");
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    const r = parseInt(c.slice(0, 2), 16) / 255;
    const g = parseInt(c.slice(2, 4), 16) / 255;
    const b = parseInt(c.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
      s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h *= 60;
    }
    return { h, s, l };
  }

  function describeColor(hex) {
    if (!hex) return "unknown color";

    const { h, s, l } = hexToHsl(hex);
    if (s < 0.15) {
      if (l > 0.8) return "very light gray";
      if (l < 0.25) return "dark gray";
      return "gray";
    }

    let base;
    if (h < 15 || h >= 345) base = "red";
    else if (h < 45) base = "orange";
    else if (h < 65) base = "yellow";
    else if (h < 150) base = "green";
    else if (h < 210) base = "teal";
    else if (h < 260) base = "blue";
    else if (h < 300) base = "purple";
    else base = "pink";

    let tone = "";
    if (l > 0.78) tone = "very light ";
    else if (l > 0.6) tone = "light ";
    else if (l < 0.3) tone = "deep ";

    if (base === "blue" && l > 0.6) return "baby blue";
    if (base === "pink" && l > 0.6) return "soft pink";

    return (tone + base).trim();
  }

  // background change 

  function applyMoodColor(text) {
    if (!text) return;
    text = text.toLowerCase();

    let mood = "default";

    if (
      text.includes("calm") ||
      text.includes("gentle") ||
      text.includes("soft") ||
      text.includes("peaceful")
    ) {
      mood = "calm";
    } else if (
      text.includes("warm") ||
      text.includes("hope") ||
      text.includes("bright") ||
      text.includes("light")
    ) {
      mood = "warm";
    } else if (
      text.includes("energetic") ||
      text.includes("dynamic") ||
      text.includes("strong")
    ) {
      mood = "energetic";
    } else if (
      text.includes("sad") ||
      text.includes("heavy") ||
      text.includes("quiet") ||
      text.includes("tired")
    ) {
      mood = "sad";
    } else if (
      text.includes("love") ||
      text.includes("heart") ||
      text.includes("tender") ||
      text.includes("affection")
    ) {
      mood = "love";
    } else if (
      text.includes("playful") ||
      text.includes("fun") ||
      text.includes("curious")
    ) {
      mood = "playful";
    }

    const body = document.body;
    body.style.opacity = 0.4;

    setTimeout(() => {
      switch (mood) {
        case "calm":
          body.style.background =
            "linear-gradient(135deg, #d9eaff, #eef5ff)";
          break;
        case "warm":
          body.style.background =
            "linear-gradient(135deg, #ffe6f3, #ffeef6)";
          break;
        case "energetic":
          body.style.background =
            "linear-gradient(135deg, #fff7d1, #ffeab6)";
          break;
        case "sad":
          body.style.background =
            "linear-gradient(135deg, #d7d8e0, #f1f1f6)";
          break;
        case "love":
          body.style.background =
            "linear-gradient(135deg, #ffd9e8, #ffe9f4)";
          break;
        case "playful":
          body.style.background =
            "linear-gradient(135deg, #defaff, #e6f6ff)";
          break;
        default:
          body.style.background =
            "radial-gradient(circle at top left, #ffe6ff, #e0f2ff)";
          break;
      }
      body.style.opacity = 1;
    }, 200);
  }


  function setStatus(msg, isError = false) {
    statusBar.textContent = msg;
    if (isError) {
      statusBar.classList.add("status-error");
    } else {
      statusBar.classList.remove("status-error");
    }
  }

  function renderShapeList(shapes) {
    shapeListEl.innerHTML = "";
    if (!shapes || shapes.length === 0) {
      const li = document.createElement("li");
      li.className = "shape-empty";
      li.textContent = "No shapes confidently detected yet.";
      shapeListEl.appendChild(li);
      return;
    }

    shapes.forEach((s, idx) => {
      const li = document.createElement("li");
      if (s.type === "smiley-face") {
        li.textContent = `${idx + 1}. ${s.type}`;
      } else {
        li.textContent = `${idx + 1}. ${s.type} – ${describeColor(
          s.color
        )}`;
      }
      shapeListEl.appendChild(li);
    });
  }

  function updateLiveMetricsAndShapes() {
    const strokes = window.doodleState.strokes;
    const rect = canvas.getBoundingClientRect();
    const m = analyzeStrokes(strokes, rect.width, rect.height);

    if (!m.hasStrokes) {
      energyPill.textContent = "–";
      complexityPill.textContent = "–";
      renderShapeList([]);
      return;
    }

    energyPill.textContent = m.energy;
    complexityPill.textContent = m.complexity;

    const shapes = detectShapes(strokes);
    renderShapeList(shapes);
  }

  function saveFeedback(type) {
    const data = JSON.parse(
      localStorage.getItem(FEEDBACK_STORAGE_KEY) || "[]"
    );
    data.push({
      type,
      timestamp: new Date().toISOString(),
      reflection: (aiOutputEl.textContent || "").slice(0, 200),
    });
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(data));
  }


  function buildCalendar(year, month) {
    if (!calendarGrid || !calendarMonthLabel) return;

    calendarGrid.innerHTML = "";
    calendarMonthLabel.textContent = formatYearMonth(year, month);

    // weekday header
    const weekdayNames = ["S", "M", "T", "W", "T", "F", "S"];
    weekdayNames.forEach((w) => {
      const wd = document.createElement("div");
      wd.className = "calendar-weekday";
      wd.textContent = w;
      calendarGrid.appendChild(wd);
    });

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay(); // 0-6
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const allJournals = loadAllJournalEntries();
    let selectedDayCell = null;

    // empty cells before day 1
    for (let i = 0; i < startWeekday; i++) {
      const empty = document.createElement("div");
      empty.className = "calendar-day";
      empty.style.visibility = "hidden";
      calendarGrid.appendChild(empty);
    }

    // day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const d = document.createElement("button");
      d.type = "button";
      d.className = "calendar-day";
      d.textContent = day.toString();

      const dateKey = dateKeyFromParts(year, month, day);

      if (allJournals[dateKey]) {
        d.classList.add("has-entry");
      }

      if (dateKey === selectedDateKey) {
        d.classList.add("selected");
        selectedDayCell = d;
      }

      d.addEventListener("click", () => {
        selectedDateKey = dateKey;

        const allDayButtons = calendarGrid.querySelectorAll(".calendar-day");
        allDayButtons.forEach((btn) =>
          btn.classList.remove("selected")
        );
        d.classList.add("selected");

        const entry = loadJournalEntry(dateKey);
        if (entry) {
          summaryTextEl.textContent =
            entry.summary || "No summary stored for this day.";
          aiOutputEl.textContent =
            entry.reflection || "No reflection stored for this day.";
          if (aiEncouragementEl) {
            aiEncouragementEl.textContent = entry.encouragement || "";
          }
          setStatus(`Loaded entry from ${dateKey}.`, false);

          if (entry.reflection) {
            applyMoodColor(entry.reflection);
          }
        } else {
          summaryTextEl.textContent =
            "No saved summary for this date yet. You can draw and analyze a new entry.";
          aiOutputEl.textContent =
            "No reflection saved for this date. Try drawing for this day and asking for a reflection.";
          if (aiEncouragementEl) {
            aiEncouragementEl.textContent = "";
          }
          setStatus(`Selected ${dateKey}. No saved entry yet.`, false);
        }

        // load mood emoji for this date
        const mood = loadMoodForDate(dateKey);
        moodButtons.forEach((btn) =>
          btn.classList.remove("selected")
        );
        if (mood) {
          moodButtons.forEach((btn) => {
            if (btn.dataset.mood === mood) {
              btn.classList.add("selected");
            }
          });
        }

        // load strokes for this date (or clear if none)
        const sketch = loadStrokesForDate(dateKey);
        if (sketch && window.doodleCanvas && window.doodleCanvas.loadStrokes) {
          window.doodleCanvas.loadStrokes(sketch);
        } else if (
          window.doodleCanvas &&
          typeof window.doodleCanvas.clearCanvas === "function"
        ) {
          window.doodleCanvas.clearCanvas();
        }
      });

      calendarGrid.appendChild(d);
    }
  }

  interpretBtn.addEventListener("click", async () => {
    const strokes = window.doodleState.strokes;
    if (!strokes || strokes.length === 0) {
      setStatus(
        "There is no doodle to analyze. Try drawing first.",
        true);
      aiOutputEl.textContent =
        "Try drawing something first – even a simple circle, heart, or smiley face is enough.";
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const summary = summarizeDoodle(strokes, rect.width, rect.height);
    summaryTextEl.textContent = summary;

    setStatus("Summarized doodle. Asking the AI for a reflection...");
    aiOutputEl.textContent = "Thinking about your doodle... ✨";

    interpretBtn.disabled = true;
    interpretBtn.textContent = "Analyzing...";

    if (likeBtn && dislikeBtn) {
      likeBtn.classList.remove("selected");
      dislikeBtn.classList.remove("selected");
    }

    const saveKey = selectedDateKey || todayKey();

    try {
      const result = await interpretDoodle(summary);
      const reflection = result?.reflection || "";
      const encouragement = result?.encouragement || "";

      if (!reflection) {
        aiOutputEl.textContent =
          "I could not reach the AI right now, but your doodle already looks meaningful.";
        if (aiEncouragementEl) {
          aiEncouragementEl.textContent = "";
        }
        setStatus("AI call failed. Check API key or network.", true);
      } else {
        aiOutputEl.textContent = reflection;
        setStatus(`AI reflection ready for ${saveKey}.`);
        applyMoodColor(reflection);

        // mood emoji 
        let moodEmoji = null;
        let moodKey = null;
        moodButtons.forEach((btn) => {
          if (btn.classList.contains("selected")) {
            moodEmoji = btn.textContent.trim();
            moodKey = btn.dataset.mood;
          }
        });

        if (moodKey) {
          saveMoodForDate(saveKey, moodKey);
        }

        // save journal 
        saveJournalEntry(saveKey, {
          moodEmoji,
          summary,
          reflection,
          encouragement,
        });
        saveStrokesForDate(saveKey, strokes);
        buildCalendar(currentYear, currentMonth);
      }
    } catch (e) {
      console.error("Interpret error:", e);
      aiOutputEl.textContent =
        "Something went wrong while interpreting your doodle. Please try again.";
      setStatus("Error while interpreting doodle.", true);
    } finally {
      interpretBtn.disabled = false;
      interpretBtn.textContent = "Analyze this doodle ✨";
    }
  });

  function init() {
    setStatus("Ready. Start drawing whenever you like 🕊️");

    const ym = getCurrentYearMonth();
    currentYear = ym.year;
    currentMonth = ym.month;
    selectedDateKey = todayKey();

    buildCalendar(currentYear, currentMonth);

    // restore mood for selected date (today)
    const savedMood = loadMoodForDate(selectedDateKey);
    if (savedMood && moodButtons.length > 0) {
      moodButtons.forEach((btn) => {
        if (btn.dataset.mood === savedMood) {
          btn.classList.add("selected");
        }
      });
    }

    // restore strokes for today if any
    const savedStrokes = loadStrokesForDate(selectedDateKey);
    if (
      savedStrokes &&
      window.doodleCanvas &&
      typeof window.doodleCanvas.loadStrokes === "function"
    ) {
      window.doodleCanvas.loadStrokes(savedStrokes);
    }

    // mood emoji click handlers 
    moodButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mood = btn.dataset.mood;
        moodButtons.forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        const keyToUse = selectedDateKey || todayKey();
        saveMoodForDate(keyToUse, mood);
        setStatus(`Saved mood for ${keyToUse}: ${mood}.`);
      });
    });

    // AI like/dislike handlers
    if (likeBtn && dislikeBtn) {
      likeBtn.addEventListener("click", () => {
        if (!aiOutputEl.textContent || aiOutputEl.textContent === "-")
          return;
        likeBtn.classList.add("selected");
        dislikeBtn.classList.remove("selected");
        saveFeedback("like");
        setStatus("Thanks! Marked this reflection as helpful.");
      });

      dislikeBtn.addEventListener("click", () => {
        if (!aiOutputEl.textContent || aiOutputEl.textContent === "-")
          return;
        dislikeBtn.classList.add("selected");
        likeBtn.classList.remove("selected");
        saveFeedback("dislike");
        setStatus("Thanks! Marked this reflection as not accurate.");
      });
    }
    if (calendarToday) {
      calendarToday.addEventListener("click", () => {
        const ym = getCurrentYearMonth();
        currentYear = ym.year;
        currentMonth = ym.month;
        selectedDateKey = todayKey();

        buildCalendar(currentYear, currentMonth);

        // 오늘 날짜 데이터 로드
        const entry = loadJournalEntry(selectedDateKey);
        if (entry) {
          summaryTextEl.textContent =
            entry.summary || "No summary stored for this day.";
          aiOutputEl.textContent =
            entry.reflection || "No reflection stored for this day.";
          if (aiEncouragementEl) {
            aiEncouragementEl.textContent = entry.encouragement || "";
          }
          if (entry.reflection) {
            applyMoodColor(entry.reflection);
          }
        } else {
          summaryTextEl.textContent =
            "No saved summary for today yet. You can draw and analyze a new entry.";
          aiOutputEl.textContent =
            "No reflection saved for today yet. Try drawing something for today.";
          if (aiEncouragementEl) {
            aiEncouragementEl.textContent = "";
          }
        }

        // mood 이모지 복원
        const mood = loadMoodForDate(selectedDateKey);
        moodButtons.forEach((btn) => btn.classList.remove("selected"));
        if (mood) {
          moodButtons.forEach((btn) => {
            if (btn.dataset.mood === mood) {
              btn.classList.add("selected");
            }
          });
        }

        // 스케치 복원
        const sketch = loadStrokesForDate(selectedDateKey);
        if (
          sketch &&
          window.doodleCanvas &&
          typeof window.doodleCanvas.loadStrokes === "function"
        ) {
          window.doodleCanvas.loadStrokes(sketch);
        } else if (
          window.doodleCanvas &&
          typeof window.doodleCanvas.clearCanvas === "function"
        ) {
          window.doodleCanvas.clearCanvas();
        }

        setStatus(`Jumped to today: ${selectedDateKey}.`, false);
      });
    }

    // calendar month navigation
    if (calendarPrev) {
      calendarPrev.addEventListener("click", () => {
        currentMonth -= 1;
        if (currentMonth < 0) {
          currentMonth = 11;
          currentYear -= 1;
        }
        buildCalendar(currentYear, currentMonth);
        setStatus(
          `Moved to ${formatYearMonth(currentYear, currentMonth)}.`,
          false
        );
      });
    }

    if (calendarNext) {
      calendarNext.addEventListener("click", () => {
        currentMonth += 1;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear += 1;
        }
        buildCalendar(currentYear, currentMonth);
        setStatus(
          `Moved to ${formatYearMonth(currentYear, currentMonth)}.`,
          false
        );
      });
    }

    // watch doodle changes and auto-save strokes per date
    window.onDoodleChanged = function (strokes) {
      const keyToUse = selectedDateKey || todayKey();
      saveStrokesForDate(keyToUse, strokes || []);
      updateLiveMetricsAndShapes();
    };
    setInterval(updateLiveMetricsAndShapes, 1000);
    setStatus(
      `Today is ${selectedDateKey}. You can also pick another day in the calendar.`,
      false
    );
  }

  init();
})();
