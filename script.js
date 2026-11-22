const TRANSACTIONS_KEY = "budget-transactions";
const GOALS_KEY = "baonbuddy-savings-goals";
const LEGACY_GOAL_KEY = "baonbuddy-savings-goal";
const LESSONS_KEY = "baonbuddy-completed-lessons";
const QUESTS_KEY = "baonbuddy-quests";
const WEEKLY_TARGET = 200;

const BaonBuddySounds = (() => {
  let context = null;
  let enabled = false;
  try { enabled = localStorage.getItem("baonbuddy-sounds") !== "off"; } catch { enabled = false; }
  function tone(frequency, duration, delay = 0, volume = 0.035) {
    if (!enabled) return;
    try {
      context ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, context.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + delay + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + duration);
    } catch { /* Audio is optional. */ }
  }
  return {
    tap: () => tone(440, 0.06),
    success: () => { tone(523.25, 0.12); tone(659.25, 0.12, 0.09); tone(783.99, 0.18, 0.18); },
    save: () => { tone(392, 0.08); tone(587.33, 0.14, 0.08); },
    setEnabled(value) {
      enabled = Boolean(value);
      try { localStorage.setItem("baonbuddy-sounds", enabled ? "on" : "off"); } catch {}
      if (enabled) tone(523.25, 0.09);
    },
    isEnabled: () => enabled
  };
})();
window.BaonBuddySounds = BaonBuddySounds;

const money = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(Number(value) || 0);
const makeId = () => window.crypto?.randomUUID?.() || `goal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function readGoals() {
  try {
    const saved = JSON.parse(localStorage.getItem(GOALS_KEY) || "null");
    if (Array.isArray(saved)) return saved.filter((goal) => goal && typeof goal.name === "string" && Number(goal.target) > 0).map((goal) => ({
      id: String(goal.id || makeId()), name: goal.name.trim().slice(0, 60), target: Number(goal.target), saved: Math.max(0, Number(goal.saved) || 0)
    }));
    const legacy = JSON.parse(localStorage.getItem(LEGACY_GOAL_KEY) || "null");
    if (legacy && typeof legacy.name === "string" && Number(legacy.target) > 0) {
      const migrated = [{ id: makeId(), name: legacy.name.trim().slice(0, 60), target: Number(legacy.target), saved: Math.max(0, Number(legacy.saved) || 0) }];
      localStorage.setItem(GOALS_KEY, JSON.stringify(migrated));
      localStorage.removeItem(LEGACY_GOAL_KEY);
      return migrated;
    }
  } catch (error) { console.warn("Could not load savings goals.", error); }
  return [];
}
function writeGoals(goals) {
  try { localStorage.setItem(GOALS_KEY, JSON.stringify(goals)); return true; }
  catch (error) { console.warn("Could not save savings goals.", error); alert("Your browser could not save your goals. Check available storage and try again."); return false; }
}
function transactionTotals() {
  try {
    const rows = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || "[]");
    if (!Array.isArray(rows)) return { income: 0, expenses: 0 };
    return rows.reduce((totals, row) => {
      const amount = Math.max(0, Number(row.amount) || 0);
      if (row.type === "income") totals.income += amount;
      else totals.expenses += amount;
      return totals;
    }, { income: 0, expenses: 0 });
  } catch { return { income: 0, expenses: 0 }; }
}
function availableBalance() {
  const { income, expenses } = transactionTotals();
  return Math.max(0, income - expenses - readGoals().reduce((sum, goal) => sum + goal.saved, 0));
}

function renderGoals() {
  const panel = document.querySelector(".goal-panel");
  if (!panel) return;
  const goals = readGoals();
  panel.replaceChildren();
  const header = document.createElement("div");
  header.className = "goal-heading";
  header.innerHTML = '<div class="goal-icon" aria-hidden="true">◎</div><div><p class="eyebrow">YOUR NEXT LITTLE WIN</p><h2>Savings goals</h2></div>';
  panel.appendChild(header);

  const available = document.createElement("p");
  available.className = "goal-available";
  available.setAttribute("aria-live", "polite");
  available.textContent = `Available baon: ${money(availableBalance())}`;
  panel.appendChild(available);

  const list = document.createElement("div");
  list.className = "goal-list";
  goals.forEach((goal) => list.appendChild(createGoalCard(goal)));
  panel.appendChild(list);

  const form = document.createElement("form");
  form.className = "goal-form";
  form.innerHTML = '<p class="goal-form-title">Add another goal</p><label>What are you saving for?<input name="name" maxlength="60" placeholder="e.g. New headphones" required /></label><label>Target amount (₱)<input name="target" type="number" min="0.01" step="0.01" placeholder="0.00" required /></label><button class="goal-save-button" type="submit">Create goal <span aria-hidden="true">→</span></button>';
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    const target = Number(form.elements.target.value);
    if (!name || !Number.isFinite(target) || target <= 0) { alert("Enter a goal name and a target greater than zero."); return; }
    if (writeGoals([...readGoals(), { id: makeId(), name, target, saved: 0 }])) renderGoals();
  });
  panel.appendChild(form);
}

function createGoalCard(goal) {
  const card = document.createElement("article");
  card.className = "goal-card";
  const percent = Math.min(100, Math.floor(goal.saved / goal.target * 100));
  const heading = document.createElement("div");
  heading.className = "goal-progress-copy";
  const copy = document.createElement("div");
  const title = document.createElement("h3"); title.textContent = goal.name;
  const message = document.createElement("p");
  message.textContent = goal.saved >= goal.target ? "You did it! This goal is complete. ✨" : `${money(goal.target - goal.saved)} to go — you’ve got this!`;
  copy.append(title, message);
  const percentText = document.createElement("strong"); percentText.textContent = `${percent}%`;
  heading.append(copy, percentText); card.appendChild(heading);
  const track = document.createElement("div"); track.className = "progress-track"; track.setAttribute("role", "progressbar"); track.setAttribute("aria-label", `${goal.name} progress`); track.setAttribute("aria-valuemin", "0"); track.setAttribute("aria-valuemax", "100"); track.setAttribute("aria-valuenow", String(percent));
  const fill = document.createElement("div"); fill.className = "progress-fill"; fill.style.width = `${percent}%`; track.appendChild(fill); card.appendChild(track);
  const totals = document.createElement("p"); totals.className = "goal-totals"; totals.textContent = `${money(goal.saved)} saved of ${money(goal.target)}`; card.appendChild(totals);

  if (goal.saved < goal.target) {
    const contributionForm = document.createElement("form"); contributionForm.className = "goal-contribution-form";
    const amount = document.createElement("input"); amount.type = "number"; amount.min = "0.01"; amount.step = "0.01"; amount.inputMode = "decimal"; amount.placeholder = "Add savings"; amount.setAttribute("aria-label", `Amount to add to ${goal.name}`); amount.required = true;
    amount.addEventListener("input", () => amount.setCustomValidity(""));
    const add = document.createElement("button"); add.className = "goal-add-button"; add.type = "submit"; add.textContent = "Add savings";
    const hint = document.createElement("small"); hint.className = "goal-available-hint"; hint.textContent = `Available to allocate: ${money(availableBalance())}`;
    contributionForm.append(amount, add, hint);
    contributionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!contributionForm.reportValidity()) return;
      const requested = Number(amount.value);
      const currentGoals = readGoals();
      const current = currentGoals.find((entry) => entry.id === goal.id);
      const availableNow = availableBalance();
      if (!current || !Number.isFinite(requested) || requested <= 0) return;
      if (requested > availableNow) {
        amount.setCustomValidity(`You only have ${money(availableNow)} of baon left to allocate.`);
        amount.reportValidity();
        return;
      }
      const contribution = Math.min(requested, current.target - current.saved);
      current.saved += contribution;
      if (writeGoals(currentGoals)) {
        recordSavings(contribution);
        BaonBuddySounds.save();
        if (window.BaonBuddyProgress) {
          if (current.saved >= current.target) window.BaonBuddyProgress.unlock("goal-reached");
        }
        renderGoals();
        updateRemainingBalance();
      }
    });
    card.appendChild(contributionForm);
  }
  if (goal.saved > 0) {
    const withdrawalForm = document.createElement("form");
    withdrawalForm.className = "goal-withdrawal-form";
    const withdrawal = document.createElement("input");
    withdrawal.type = "number";
    withdrawal.min = "0.01";
    withdrawal.step = "0.01";
    withdrawal.inputMode = "decimal";
    withdrawal.placeholder = "Remove from this goal";
    withdrawal.setAttribute("aria-label", `Amount to remove from ${goal.name}`);
    withdrawal.required = true;
    withdrawal.addEventListener("input", () => withdrawal.setCustomValidity(""));
    const removeMoney = document.createElement("button");
    removeMoney.type = "submit";
    removeMoney.textContent = "Remove money";
    withdrawalForm.append(withdrawal, removeMoney);
    withdrawalForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!withdrawalForm.reportValidity()) return;
      const requested = Number(withdrawal.value);
      const goals = readGoals();
      const current = goals.find((entry) => entry.id === goal.id);
      if (!current || !Number.isFinite(requested) || requested <= 0) return;
      if (requested > current.saved) {
        withdrawal.setCustomValidity(`This goal only has ${money(current.saved)} saved.`);
        withdrawal.reportValidity();
        return;
      }
      current.saved = Math.max(0, current.saved - requested);
      if (writeGoals(goals)) {
        BaonBuddySounds.tap();
        renderGoals();
        updateRemainingBalance();
      }
    });
    card.appendChild(withdrawalForm);
  }
  const actions = document.createElement("div"); actions.className = "goal-actions";
  const edit = document.createElement("button"); edit.type = "button"; edit.className = "goal-edit-button"; edit.textContent = "Edit goal";
  edit.addEventListener("click", () => showGoalEditor(card, goal));
  const remove = document.createElement("button"); remove.type = "button"; remove.className = "goal-clear-button"; remove.textContent = "Delete goal";
  remove.addEventListener("click", () => {
    if (!window.confirm(`Delete “${goal.name}”? Its allocated savings will return to your available baon.`)) return;
    if (writeGoals(readGoals().filter((entry) => entry.id !== goal.id))) { renderGoals(); updateRemainingBalance(); }
  });
  actions.append(edit, remove); card.appendChild(actions);
  return card;
}

function showGoalEditor(card, goal) {
  const form = document.createElement("form"); form.className = "goal-edit-form";
  form.innerHTML = `<label>Goal name<input name="name" maxlength="60" value="${escapeAttribute(goal.name)}" required /></label><label>Target amount (₱)<input name="target" type="number" min="0.01" step="0.01" value="${goal.target}" required /></label><button type="submit">Save changes</button><button type="button" class="goal-edit-cancel">Cancel</button>`;
  card.querySelector(".goal-actions")?.replaceWith(form);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = form.elements.name.value.trim(); const target = Number(form.elements.target.value);
    if (!name || !Number.isFinite(target) || target <= 0) return;
    const goals = readGoals(); const current = goals.find((entry) => entry.id === goal.id);
    if (current) { current.name = name; current.target = target; if (writeGoals(goals)) renderGoals(); }
  });
  form.querySelector(".goal-edit-cancel").addEventListener("click", renderGoals);
}
function escapeAttribute(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }

function updateRemainingBalance() {
  const balance = document.getElementById("remaining-balance");
  if (!balance) return;
  const { income, expenses } = transactionTotals();
  const base = income - expenses;
  const display = `${money(base - readGoals().reduce((sum, goal) => sum + goal.saved, 0))}`;
  lastDisplayedBalance = display;
  balance.textContent = display;
  balance.classList.toggle("negative", base - readGoals().reduce((sum, goal) => sum + goal.saved, 0) < 0);
}
let lastDisplayedBalance = null;
function observeBalance() {
  const balance = document.getElementById("remaining-balance");
  if (!balance || !window.MutationObserver) return;
  new MutationObserver(() => {
    if (balance.textContent !== lastDisplayedBalance) updateRemainingBalance();
  }).observe(balance, { childList: true, characterData: true, subtree: true });
}

function getQuestState() {
  try { return JSON.parse(localStorage.getItem(QUESTS_KEY) || "null") || { points: 0, currentStreak: 0, bestStreak: 0, lastCompletedDate: "", weeklySaved: 0, weekKey: "", dailyTasks: [], weeklyTasks: [] }; }
  catch { return { points: 0, currentStreak: 0, bestStreak: 0, lastCompletedDate: "", weeklySaved: 0, weekKey: "", dailyTasks: [], weeklyTasks: [] }; }
}
function completeQuest(type, id) {
  const state = getQuestState(); const tasks = type === "daily" ? state.dailyTasks : state.weeklyTasks;
  const task = tasks.find((entry) => entry.id === id); if (!task || task.completed) return;
  task.completed = true; state.points = (Number(state.points) || 0) + (Number(task.points) || 0);
  const date = today(); if (state.lastCompletedDate !== date) { state.currentStreak = state.lastCompletedDate ? state.currentStreak + 1 : 1; state.lastCompletedDate = date; state.bestStreak = Math.max(state.bestStreak || 0, state.currentStreak); }
  try { localStorage.setItem(QUESTS_KEY, JSON.stringify(state)); } catch { /* Optional gamification storage. */ }
  renderQuests();
}
function recordSavings(amount) {
  const state = getQuestState(); const week = `${new Date().getFullYear()}-W${Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1)) / 604800000)}`;
  if (state.weekKey !== week) { state.weekKey = week; state.weeklySaved = 0; }
  state.weeklySaved = (Number(state.weeklySaved) || 0) + amount;
  try { localStorage.setItem(QUESTS_KEY, JSON.stringify(state)); } catch { /* Optional gamification storage. */ }
  completeQuest("daily", "save-amount");
  const quest = state.weeklyTasks?.find((task) => task.id === "week-save");
  if (quest && state.weeklySaved >= WEEKLY_TARGET) completeQuest("weekly", "week-save");
  if (window.BaonBuddyProgress) {
    window.BaonBuddyProgress.addXp(10, 2);
    window.BaonBuddyProgress.unlock("first-save");
  }
  renderQuests();
}
function renderQuests() {
  const state = getQuestState();
  const points = document.getElementById("quest-points"); if (points) points.textContent = `${Number(state.points) || 0} XP`;
  const streak = document.getElementById("current-streak"); if (streak) streak.textContent = `${Number(state.currentStreak) || 0} day streak`;
  const best = document.getElementById("best-streak"); if (best) best.textContent = `Best: ${Number(state.bestStreak) || 0}`;
  const headerXp = document.getElementById("header-xp"); if (headerXp) headerXp.textContent = `${Number(state.points) || 0}`;
  const headerStreak = document.getElementById("header-streak"); if (headerStreak) headerStreak.textContent = `${Number(state.currentStreak) || 0}`;
}

function setupLessons() {
  window.BaonBuddyProgress?.setupLearn();
}

function addGoalStyles() {
  if (document.getElementById("goal-system-styles")) return;
  const style = document.createElement("style"); style.id = "goal-system-styles";
  style.textContent = `.goal-panel{display:block}.goal-available{margin:18px 0;color:#536579;font-weight:900}.goal-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:14px;margin:16px 0}.goal-card{padding:18px;border:1px solid #e8edf2;border-radius:18px;background:#fff}.goal-card .progress-track{margin-top:12px}.goal-card .goal-totals{margin:10px 0;color:#718094}.goal-actions{display:flex;gap:8px;align-items:center;margin-top:12px}.goal-actions button,.goal-edit-form button{padding:9px 12px;border:0;border-radius:10px;background:#fff1db;color:#85550d;font:inherit;font-weight:800;cursor:pointer}.goal-actions .goal-clear-button{margin-left:auto;background:transparent;color:#8a6e5f}.goal-edit-form{display:grid;gap:10px;margin-top:12px}.goal-edit-form label,.goal-form label{display:grid;gap:6px;color:#667789;font-size:.82rem;font-weight:800}.goal-edit-form input,.goal-form input{width:100%;min-height:42px;padding:9px 11px;border:1px solid #dfe5ec;border-radius:11px;background:white;font:inherit}.goal-edit-form{grid-template-columns:repeat(2,minmax(0,1fr))}.goal-edit-form button{grid-column:span 1}.goal-contribution-form{flex-wrap:wrap}.goal-withdrawal-form{display:flex;gap:8px;margin-top:10px}.goal-withdrawal-form input{min-width:0;flex:1;min-height:42px;padding:9px 11px;border:1px solid #dfe5ec;border-radius:11px}.goal-withdrawal-form button{border:1px solid #e7c9b7;border-radius:11px;background:#fff7f1;color:#9a5a35;font-weight:900}.goal-available-hint{flex-basis:100%;color:#718094;font-size:.78rem}.goal-form{margin-top:18px}.lesson-detail{margin-top:10px!important;padding-top:10px;border-top:1px solid #f0e5dc;line-height:1.55}.lesson-card button:focus-visible,.goal-panel button:focus-visible{outline:3px solid rgba(238,159,40,.35);outline-offset:2px}.sound-toggle{min-height:36px;padding:7px 10px;border:1px solid #e7ecf1;border-radius:999px;background:#fff;color:#647487;font:inherit;font-weight:900;cursor:pointer}.sound-toggle[aria-pressed="true"]{border-color:#efc889;background:#fff6df;color:#9a6510}@media(max-width:600px){.goal-edit-form{grid-template-columns:1fr}.goal-actions{flex-wrap:wrap}.goal-actions .goal-clear-button{margin-left:0}.goal-withdrawal-form{flex-wrap:wrap}.goal-withdrawal-form input,.goal-withdrawal-form button{width:100%}.header-stats .sound-toggle span{display:none}}`;
  document.head.appendChild(style);
}

function setupTabs() {
  const nav = document.querySelector(".tab-nav");
  const buttons = Array.from(document.querySelectorAll(".tab-btn"));
  const panels = Array.from(document.querySelectorAll(".tab-panel"));
  if (!nav || !buttons.length || !panels.length) return;

  nav.setAttribute("role", "tablist");

  const activateTab = (button, updateHash = true) => {
    const tabId = button.dataset.tab;
    if (!tabId) return;

    buttons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("role", "tab");
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
    });

    panels.forEach((panel) => {
      const active = panel.id === tabId;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-hidden", String(!active));
    });

    if (updateHash) history.replaceState(null, "", `#${tabId}`);
  };

  buttons.forEach((button, index) => {
    button.addEventListener("click", () => activateTab(button));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % buttons.length;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + buttons.length) % buttons.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = buttons.length - 1;
      buttons[nextIndex].focus();
      activateTab(buttons[nextIndex]);
    });
  });

  const hashButton = buttons.find((button) => `#${button.dataset.tab}` === location.hash);
  activateTab(hashButton || buttons.find((button) => button.classList.contains("active")) || buttons[0], false);
}

function setupParallax() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const buddy = document.querySelector(".welcome-buddy");
  const sticker = document.querySelector(".welcome-sticker");
  const lessonCards = Array.from(document.querySelectorAll(".lesson-card"));
  let frame = 0;

  const updateParallax = () => {
    frame = 0;
    const viewportCenter = window.innerHeight / 2;

    if (buddy) {
      const rect = buddy.closest(".welcome")?.getBoundingClientRect();
      if (rect) {
        buddy.style.setProperty("--parallax-y", `${((rect.top + rect.height / 2 - viewportCenter) * -0.035).toFixed(1)}px`);
      }
    }
    if (sticker) {
      const welcomeRect = sticker.closest(".welcome")?.getBoundingClientRect();
      if (welcomeRect) sticker.style.setProperty("--parallax-y-small", `${((welcomeRect.top - viewportCenter) * -0.018).toFixed(1)}px`);
    }

    lessonCards.forEach((card, index) => {
      if (!card.closest(".tab-panel")?.classList.contains("active")) return;
      const rect = card.getBoundingClientRect();
      const offset = (rect.top + rect.height / 2 - viewportCenter) * -0.018;
      const capped = Math.max(-8, Math.min(8, offset));
      card.style.setProperty("--lesson-parallax-y", `${(capped + (index % 2 ? 3 : -3)).toFixed(1)}px`);
    });
  };

  const requestUpdate = () => {
    if (!frame) frame = window.requestAnimationFrame(updateParallax);
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  document.querySelector(".tab-nav")?.addEventListener("click", () => setTimeout(requestUpdate, 40));
  requestUpdate();
}

function setupBuddy() {
  const button = document.getElementById("buddy-button");
  const tip = document.getElementById("buddy-tip");
  const close = tip?.querySelector(".buddy-tip-close");
  const title = document.getElementById("buddy-tip-title");
  const text = document.getElementById("buddy-tip-text");
  if (!button || !tip || !close || !title || !text) return;

  const tips = [
    ["Psst, beh!", "A 5-minute check-in can keep your baon on track."],
    ["Small win?", "Try saving even a little before your next transaction."],
    ["Need vs. want", "Pause for a moment before the next impulse buy."],
    ["You’ve got this!", "Consistency beats a perfect budget every time."]
  ];
  let tipIndex = 0;

  button.addEventListener("click", () => {
    const isOpen = button.getAttribute("aria-expanded") === "true";
    if (isOpen) {
      tip.hidden = true;
      button.setAttribute("aria-expanded", "false");
      return;
    }
    tipIndex = (tipIndex + 1) % tips.length;
    title.textContent = tips[tipIndex][0];
    text.textContent = tips[tipIndex][1];
    tip.hidden = false;
    button.setAttribute("aria-expanded", "true");
  });

  close.addEventListener("click", () => {
    tip.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.focus();
  });
}

function setupTutorial() {
  const backdrop = document.getElementById("tutorial-backdrop");
  const start = document.getElementById("start-tutorial");
  const close = document.getElementById("tutorial-close");
  const skip = document.getElementById("tutorial-skip");
  const back = document.getElementById("tutorial-back");
  const next = document.getElementById("tutorial-next");
  const title = document.getElementById("tutorial-title");
  const copy = document.getElementById("tutorial-copy");
  const stepLabel = document.getElementById("tutorial-step-label");
  const illustration = document.getElementById("tutorial-illustration");
  const progress = document.getElementById("tutorial-progress");
  if (!backdrop || !start || !close || !skip || !back || !next || !title || !copy || !stepLabel || !illustration || !progress) return;

  const TUTORIAL_KEY = "baonbuddy-tutorial-complete";
  const steps = [
    { tab: "dashboard", target: ".entry-form", icon: "₱", title: "Record your baon", copy: "Start on Home. Choose whether you received or spent money, then add an amount and a short description." },
    { tab: "dashboard", target: "#spending-summary-content", icon: "↗", title: "See where it went", copy: "Your cards and spending summary update automatically. This helps you check how much baon is left." },
    { tab: "goals", target: ".goal-panel", icon: "◎", title: "Set a savings goal", copy: "Open Goals to create something you want to save for, then add small contributions as you can." },
    { tab: "learn", target: ".lesson-path", icon: "▥", title: "Learn in small steps", copy: "Open Learn and pass one level at a time. Completing levels adds XP and unlocks the next challenge." },
    { tab: "goals", target: "#achievement-grid", icon: "★", title: "Earn rewards", copy: "Achievements award XP and coins. Use coins in the Buddy wardrobe, then come back and keep your streak going." }
  ];
  let stepIndex = 0;
  let previousFocus = null;

  const activateTab = (tabId) => {
    const button = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (button) button.click();
  };

  const clearHighlight = () => document.querySelectorAll(".tutorial-highlight").forEach((element) => element.classList.remove("tutorial-highlight"));

  const renderStep = () => {
    const step = steps[stepIndex];
    activateTab(step.tab);
    title.textContent = step.title;
    copy.textContent = step.copy;
    illustration.textContent = step.icon;
    stepLabel.textContent = `QUICK TOUR ${stepIndex + 1} OF ${steps.length}`;
    back.hidden = stepIndex === 0;
    next.innerHTML = stepIndex === steps.length - 1 ? 'Finish <span aria-hidden="true">✓</span>' : 'Next <span aria-hidden="true">→</span>';
    progress.replaceChildren(...steps.map((_, index) => {
      const dot = document.createElement("span");
      dot.className = index === stepIndex ? "active" : "";
      return dot;
    }));

    clearHighlight();
    window.setTimeout(() => {
      const target = document.querySelector(step.target);
      if (!target) return;
      target.classList.add("tutorial-highlight");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const open = () => {
    previousFocus = document.activeElement;
    stepIndex = 0;
    backdrop.hidden = false;
    document.body.classList.add("tutorial-open");
    renderStep();
    close.focus();
  };

  const closeTutorial = (markComplete = true) => {
    if (markComplete) {
      try { localStorage.setItem(TUTORIAL_KEY, "true"); } catch { /* Optional onboarding storage. */ }
    }
    clearHighlight();
    backdrop.hidden = true;
    document.body.classList.remove("tutorial-open");
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  };

  start.addEventListener("click", open);
  close.addEventListener("click", () => closeTutorial(true));
  skip.addEventListener("click", () => closeTutorial(true));
  back.addEventListener("click", () => { if (stepIndex > 0) { stepIndex -= 1; renderStep(); } });
  next.addEventListener("click", () => {
    if (stepIndex < steps.length - 1) { stepIndex += 1; renderStep(); }
    else closeTutorial(true);
  });
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeTutorial(true); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !backdrop.hidden) closeTutorial(true); });

  let completed = false;
  try { completed = localStorage.getItem(TUTORIAL_KEY) === "true"; } catch { completed = false; }
  if (!completed) window.setTimeout(open, 900);
}

function init() {
  const startup = document.getElementById("startup-screen");
  if (startup) window.setTimeout(() => startup.classList.add("hidden"), 500);
  addGoalStyles(); setupTabs(); setupBuddy(); setupTutorial(); renderGoals(); observeBalance(); updateRemainingBalance(); renderQuests(); setupLessons();
  setupParallax();
  const soundToggle = document.getElementById("sound-toggle");
  if (soundToggle) {
    const renderSoundToggle = () => {
      const enabled = BaonBuddySounds.isEnabled();
      soundToggle.setAttribute("aria-pressed", String(enabled));
      soundToggle.setAttribute("aria-label", enabled ? "Turn sounds off" : "Turn sounds on");
      soundToggle.innerHTML = enabled ? "🔊 <span>Sound on</span>" : "🔇 <span>Sound off</span>";
    };
    renderSoundToggle();
    soundToggle.addEventListener("click", () => {
      BaonBuddySounds.setEnabled(!BaonBuddySounds.isEnabled());
      renderSoundToggle();
    });
  }
  document.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("button")) BaonBuddySounds.tap();
  });
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    const result = originalSetItem.call(this, key, value);
    if (key === TRANSACTIONS_KEY) setTimeout(() => { updateRemainingBalance(); renderGoals(); }, 0);
    return result;
  };
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
window.completeQuest = completeQuest;
