// Water Tracker PWA (local-only storage)
const GOAL_ML = 2000;

const els = {
  totalMl: document.getElementById("totalMl"),
  goalMl: document.getElementById("goalMl"),
  pct: document.getElementById("pct"),
  ringFg: document.querySelector(".ringFg"),
  barFill: document.getElementById("barFill"),
  log: document.getElementById("log"),
  msg: document.getElementById("msg"),
  dateLabel: document.getElementById("dateLabel"),
  resetBtn: document.getElementById("resetBtn"),
  undoBtn: document.getElementById("undoBtn"),
  installHintBtn: document.getElementById("installHintBtn"),
  sheet: document.getElementById("sheet"),
  closeSheet: document.getElementById("closeSheet"),
  history: document.getElementById("history"),
};

const STORAGE_KEY = "water-tracker-v1";
const RING_CIRC = 2 * Math.PI * 46; // r=46 from SVG

function todayKey(d = new Date()) {
  // local date key: YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nowTime(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDateLabel(yyyyMMdd) {
  // "2026-01-08" -> "8 Jan"
  const [y, m, d] = yyyyMMdd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function addDays(yyyyMMdd, delta) {
  const [y, m, d] = yyyyMMdd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return todayKey(dt);
}

function ensureHistoryShape(s) {
  if (!s.history || typeof s.history !== "object") s.history = {};
  return s;
}

function saveDayToHistory(dayKey, totalMl) {
  state.history[dayKey] = {
    total: totalMl,
    goal: state.goal,
    hit: totalMl >= state.goal
  };
}


function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const fresh = {
    goal: GOAL_ML,
    day: todayKey(),
    total: 0,
    entries: [],
    lastUndo: null,
    history: {}
  };

  if (!raw) return fresh;

  try {
    let s = JSON.parse(raw);
    s = ensureHistoryShape(s);

    const today = todayKey();

    // If day changed, store yesterday summary then reset for today
    if (s.day && s.day !== today) {
      // Save old day total into history
      saveDayToHistory(s.day, s.total || 0);

      // (Optional) keep only recent ~10 days to avoid bloating storage
      const keys = Object.keys(s.history).sort(); // ascending
      if (keys.length > 10) {
        for (let i = 0; i < keys.length - 10; i++) delete s.history[keys[i]];
      }

      s.day = today;
      s.total = 0;
      s.entries = [];
      s.lastUndo = null;
    }

    // Ensure basics exist
    if (typeof s.goal !== "number") s.goal = GOAL_ML;
    if (typeof s.total !== "number") s.total = 0;
    if (!Array.isArray(s.entries)) s.entries = [];
    if (!("lastUndo" in s)) s.lastUndo = null;

    return s;
  } catch {
    return fresh;
  }
}


function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function confettiPop() {
  // lightweight confetti (no libraries)
  const pieces = 26;
  for (let i = 0; i < pieces; i++) {
    const d = document.createElement("div");
    d.className = "confetti";
    d.style.left = Math.random() * 100 + "vw";
    d.style.transform = `translateY(0) rotate(${Math.random()*180}deg)`;
    d.style.background = ["#ff4fa3", "#60a5fa", "#22c55e", "#f59e0b", "#a78bfa"][i % 5];
    d.style.animationDuration = (0.9 + Math.random() * 0.8) + "s";
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1800);
  }
}

function updateUI() {
  // date label
  els.dateLabel.textContent = state.day;

  els.goalMl.textContent = state.goal;
  els.totalMl.textContent = state.total;

  const pct = clamp(Math.round((state.total / state.goal) * 100), 0, 999);
  els.pct.textContent = `${pct}%`;

  const progress = clamp(state.total / state.goal, 0, 1);
  const offset = RING_CIRC * (1 - progress);
  els.ringFg.style.strokeDasharray = `${RING_CIRC}`;
  els.ringFg.style.strokeDashoffset = `${offset}`;

  // change ring color when completed
  els.ringFg.style.stroke = progress >= 1 ? "var(--accent2)" : "var(--accent)";

  els.barFill.style.width = `${clamp(progress * 100, 0, 100)}%`;

  // log
  els.log.innerHTML = "";
  if (state.entries.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="t">No drinks logged yet</span><span class="v">💧</span>`;
    els.log.appendChild(li);
  } else {
    [...state.entries].reverse().forEach((e) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="t">${e.time}</span><span class="v">+${e.ml} ml</span>`;
      els.log.appendChild(li);
    });
  }

    // history (last 3 days incl today)
  els.history.innerHTML = "";

  // Make sure today's current progress is visible too (even before day ends)
  const temp = { ...state.history };
  temp[state.day] = {
    total: state.total,
    goal: state.goal,
    hit: state.total >= state.goal
  };

  const days = [addDays(state.day, -2), addDays(state.day, -1), state.day];

  days.forEach((dk) => {
    const h = temp[dk];
    const li = document.createElement("li");

    if (!h) {
      li.innerHTML = `<span class="t">${formatDateLabel(dk)}</span><span class="v">—</span>`;
    } else {
      const badge = h.hit ? "✅" : "💧";
      li.innerHTML = `<span class="t">${formatDateLabel(dk)}</span><span class="v">${h.total} ml ${badge}</span>`;
    }

    els.history.appendChild(li);
  });

  
  // message
  if (state.total === 0) els.msg.textContent = "Start with a sip 😈";
  else if (state.total < state.goal) els.msg.textContent = `${state.goal - state.total} ml to go`;
  else els.msg.textContent = `Goal smashed ✅`;

  // undo available?
  els.undoBtn.disabled = !state.lastUndo;
  els.undoBtn.style.opacity = state.lastUndo ? "1" : ".5";
}

function addWater(ml) {
  const entry = { ml, time: nowTime() };
  state.entries.push(entry);
  state.total += ml;
  state.lastUndo = entry;

  // squishy wiggle feedback
  document.querySelector(".card")?.classList.add("wiggle");
  setTimeout(() => document.querySelector(".card")?.classList.remove("wiggle"), 380);

  const wasBelow = state.total - ml < state.goal;
  const nowHit = state.total >= state.goal;

  saveState();
  updateUI();

  // silly messages
  const msgs = [
    "sip sip 😌💧",
    "hydration queen 👑💦",
    "water acquired ✅",
    "that’s a cute sip fr 🥺",
    "ok health era ✨",
    "slaydration 💅💧"
  ];

  if (wasBelow && nowHit) {
    els.msg.textContent = "GOAL SMASHED!!! 🎉💧";
    confettiPop();
  } else {
    els.msg.textContent = msgs[Math.floor(Math.random() * msgs.length)];
  }
}


function undo() {
  if (!state.lastUndo) return;
  // remove last matching entry from end
  for (let i = state.entries.length - 1; i >= 0; i--) {
    if (state.entries[i] === state.lastUndo) {
      state.total -= state.entries[i].ml;
      state.entries.splice(i, 1);
      break;
    }
  }
  state.lastUndo = null;
  state.total = Math.max(0, state.total);
  saveState();
  updateUI();
}

function resetDay() {
  // store current day as 0 after reset, but keep what was before in history
  saveDayToHistory(state.day, state.total);

  state.day = todayKey();
  state.total = 0;
  state.entries = [];
  state.lastUndo = null;

  saveState();
  updateUI();
}


let state = loadState();
updateUI();

// Buttons
document.querySelectorAll("[data-add]").forEach((btn) => {
  btn.addEventListener("click", () => addWater(Number(btn.dataset.add)));
});

els.undoBtn.addEventListener("click", undo);
els.resetBtn.addEventListener("click", () => {
  // simple confirm (no scary popups beyond browser confirm)
  const ok = confirm("Reset today's water to 0?");
  if (ok) resetDay();
});

els.installHintBtn.addEventListener("click", showSheet);

// iOS sometimes prefers touch events, so we handle both
els.closeSheet.addEventListener("click", hideSheet);
els.closeSheet.addEventListener("touchend", (e) => {
  e.preventDefault();
  hideSheet();
});

els.sheet.addEventListener("click", (e) => {
  if (e.target === els.sheet) hideSheet();
});








