const TRANSACTIONS_KEY = "budget-transactions";
const GOALS_KEY = "baonbuddy-savings-goals";
const LEGACY_GOAL_KEY = "baonbuddy-savings-goal";
const LESSONS_KEY = "baonbuddy-completed-lessons";
const QUESTS_KEY = "baonbuddy-quests";
const WEEKLY_TARGET = 200;

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
    const amount = document.createElement("input"); amount.type = "number"; amount.min = "0.01"; amount.step = "0.01"; amount.max = String(availableBalance()); amount.placeholder = "Add savings"; amount.setAttribute("aria-label", `Amount to add to ${goal.name}`); amount.required = true;
    const add = document.createElement("button"); add.className = "goal-add-button"; add.type = "submit"; add.textContent = "Add savings";
    const hint = document.createElement("small"); hint.className = "goal-available-hint"; hint.textContent = `Available to allocate: ${money(availableBalance())}`;
    contributionForm.append(amount, add, hint);
    contributionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const requested = Number(amount.value);
      const currentGoals = readGoals();
      const current = currentGoals.find((entry) => entry.id === goal.id);
      const availableNow = availableBalance();
      if (!current || !Number.isFinite(requested) || requested <= 0) return;
      if (requested > availableNow) { alert(`You only have ${money(availableNow)} of baon left to allocate.`); amount.max = String(availableNow); return; }
      const contribution = Math.min(requested, current.target - current.saved);
      current.saved += contribution;
      if (writeGoals(currentGoals)) { recordSavings(contribution); renderGoals(); updateRemainingBalance(); }
    });
    card.appendChild(contributionForm);
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
  renderQuests();
}
function renderQuests() {
  const state = getQuestState();
  const points = document.getElementById("quest-points"); if (points) points.textContent = `${Number(state.points) || 0} XP`;
  const streak = document.getElementById("current-streak"); if (streak) streak.textContent = `${Number(state.currentStreak) || 0} day streak`;
  const best = document.getElementById("best-streak"); if (best) best.textContent = `Best: ${Number(state.bestStreak) || 0}`;
}

function setupLessons() {
  const list = document.querySelector(".lesson-list"); if (!list) return;
  const lessons = [
    { title: "Budget basics", text: "A budget is a simple plan for your money. Track what comes in, what goes out, and set aside savings before spending the rest." },
    { title: "Needs vs wants", text: "Needs keep you safe and healthy, like food, transport, and school supplies. Wants are nice extras. Pause and prioritize needs before buying wants." },
    { title: "Save for your next goal", text: "Choose a clear target, break it into small amounts, and add money regularly. Keep savings separate from the money you can spend." },
    { title: "Money mindset", text: "Small, consistent choices matter more than being perfect. Review your spending without judgment and adjust your plan when life changes." }
  ];
  let completed = [];
  try { completed = JSON.parse(localStorage.getItem(LESSONS_KEY) || "[]"); if (!Array.isArray(completed)) completed = []; } catch { completed = []; }
  list.querySelectorAll(".lesson-card").forEach((card, index) => {
    const lesson = lessons[index]; if (!lesson) return;
    card.classList.toggle("complete", completed.includes(index));
    const button = card.querySelector("button"); if (!button) return;
    button.textContent = completed.includes(index) ? "Completed ✓" : "Start lesson";
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      let detail = card.querySelector(".lesson-detail");
      if (!detail) { detail = document.createElement("p"); detail.className = "lesson-detail"; detail.textContent = lesson.text; card.querySelector("div")?.appendChild(detail); }
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      detail.hidden = !open;
      if (open && !completed.includes(index)) {
        completed.push(index); localStorage.setItem(LESSONS_KEY, JSON.stringify(completed));
        card.classList.add("complete"); button.textContent = "Completed ✓";
      }
    });
  });
}

function addGoalStyles() {
  if (document.getElementById("goal-system-styles")) return;
  const style = document.createElement("style"); style.id = "goal-system-styles";
  style.textContent = `.goal-panel{display:block}.goal-available{margin:18px 0;color:#536579;font-weight:900}.goal-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:14px;margin:16px 0}.goal-card{padding:18px;border:1px solid #e8edf2;border-radius:18px;background:#fff}.goal-card .progress-track{margin-top:12px}.goal-card .goal-totals{margin:10px 0;color:#718094}.goal-actions{display:flex;gap:8px;align-items:center;margin-top:12px}.goal-actions button,.goal-edit-form button{padding:9px 12px;border:0;border-radius:10px;background:#fff1db;color:#85550d;font:inherit;font-weight:800;cursor:pointer}.goal-actions .goal-clear-button{margin-left:auto;background:transparent;color:#8a6e5f}.goal-edit-form{display:grid;gap:10px;margin-top:12px}.goal-edit-form label,.goal-form label{display:grid;gap:6px;color:#667789;font-size:.82rem;font-weight:800}.goal-edit-form input,.goal-form input{width:100%;min-height:42px;padding:9px 11px;border:1px solid #dfe5ec;border-radius:11px;background:white;font:inherit}.goal-edit-form{grid-template-columns:repeat(2,minmax(0,1fr))}.goal-edit-form button{grid-column:span 1}.goal-contribution-form{flex-wrap:wrap}.goal-available-hint{flex-basis:100%;color:#718094;font-size:.78rem}.goal-form{margin-top:18px}.lesson-detail{margin-top:10px!important;padding-top:10px;border-top:1px solid #f0e5dc;line-height:1.55}.lesson-card button:focus-visible,.goal-panel button:focus-visible{outline:3px solid rgba(238,159,40,.35);outline-offset:2px}@media(max-width:600px){.goal-edit-form{grid-template-columns:1fr}.goal-actions{flex-wrap:wrap}.goal-actions .goal-clear-button{margin-left:0}}`;
  document.head.appendChild(style);
}

function init() {
  addGoalStyles(); renderGoals(); observeBalance(); updateRemainingBalance(); renderQuests(); setupLessons();
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    const result = originalSetItem.call(this, key, value);
    if (key === TRANSACTIONS_KEY) setTimeout(() => { updateRemainingBalance(); renderGoals(); }, 0);
    return result;
  };
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
window.completeQuest = completeQuest;
