const form = document.getElementById("transaction-form");
const list = document.getElementById("transaction-list");
const incomeEl = document.getElementById("total-income");
const expensesEl = document.getElementById("total-expenses");
const balanceEl = document.getElementById("remaining-balance");
const downloadButton = document.getElementById("download-csv");
const recurringToggle = document.getElementById("is-recurring");
const recurringOptions = document.getElementById("recurring-options");
const goalForm = document.getElementById("goal-form");
const goalContributionForm = document.getElementById("goal-contribution-form");
const STORAGE_KEY = "budget-transactions";
const GOAL_STORAGE_KEY = "baonbuddy-savings-goal";
const QUESTS_KEY = "baonbuddy-quests";
const WEEKLY_SAVING_TARGET = 200;

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.tab;
    tabButtons.forEach((btn) => btn.classList.toggle("active", btn === button));
    tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === target));
  });
});

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getWeekKey(date) {
  const d = new Date(date);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${weekNo}`;
}

function normalizeTransaction(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  const type = raw.type === "income" ? "income" : "expense";
  const category = typeof raw.category === "string" ? raw.category.trim() : "";
  const amount = safeNumber(raw.amount);
  const date = typeof raw.date === "string" ? raw.date : "";
  const frequency = ["weekly", "monthly", "yearly"].includes(raw.frequency) ? raw.frequency : "monthly";
  if (!category || !date || amount <= 0) return null;
  return { id: raw.id || createId(), type, category, amount, date, recurring: raw.recurring === true, frequency };
}

function getTransactions() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) throw new Error("Stored data is not an array");
    const valid = stored.map(normalizeTransaction).filter(Boolean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    return valid;
  } catch (error) {
    console.warn("Could not read saved transactions. Resetting to empty state.", error);
    try { localStorage.setItem(STORAGE_KEY, "[]"); } catch (storageError) { console.warn("Could not reset saved transactions.", storageError); }
    return [];
  }
}

function saveTransactions(transactions) {
  const safeTransactions = transactions.map(normalizeTransaction).filter(Boolean);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeTransactions));
  return safeTransactions;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeNumber(value));
}

function getGoal() {
  try {
    const raw = JSON.parse(localStorage.getItem(GOAL_STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object") return null;
    const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 60) : "";
    const target = safeNumber(raw.target);
    const saved = Math.max(0, safeNumber(raw.saved));
    return name && target > 0 ? { name, target, saved } : null;
  } catch (error) {
    console.warn("Could not read the saved goal.", error);
    return null;
  }
}

function saveGoal(goal) {
  try {
    if (goal) localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(goal));
    else localStorage.removeItem(GOAL_STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn("Could not save your goal.", error);
    alert("Your browser couldn’t save this goal. Check that local storage is available and try again.");
    return false;
  }
}

function renderGoal() {
  const goal = getGoal();
  const empty = document.getElementById("goal-empty");
  const view = document.getElementById("goal-progress-view");
  const formHeading = document.getElementById("goal-form-heading");
  const saveLabel = document.getElementById("goal-save-label");
  const clearButton = document.getElementById("goal-clear");
  if (!empty || !view) return;

  empty.hidden = Boolean(goal);
  view.hidden = !goal;
  if (formHeading) formHeading.textContent = goal ? "Adjust your goal" : "Start a goal";
  if (saveLabel) saveLabel.textContent = goal ? "Update my goal" : "Create my goal";
  if (clearButton) clearButton.hidden = !goal;
  if (goal) {
    const percent = Math.min(100, Math.floor((goal.saved / goal.target) * 100));
    document.getElementById("goal-name").textContent = goal.name;
    document.getElementById("goal-percent").textContent = `${percent}%`;
    document.getElementById("goal-saved").textContent = `${formatMoney(goal.saved)} saved`;
    document.getElementById("goal-target").textContent = `of ${formatMoney(goal.target)}`;
    document.getElementById("goal-message").textContent = goal.saved >= goal.target
      ? "You did it! Your goal is complete. ✨"
      : `${formatMoney(goal.target - goal.saved)} to go — you’ve got this!`;
    const progress = document.getElementById("goal-progress-track");
    progress.setAttribute("aria-valuenow", String(percent));
    document.getElementById("goal-progress-fill").style.width = `${percent}%`;
  }
  const contribution = document.getElementById("goal-contribution");
  const addButton = goalContributionForm?.querySelector("button[type='submit']");
  if (contribution && addButton) {
    const complete = !goal || goal.saved >= goal.target;
    contribution.disabled = complete;
    addButton.disabled = complete;
    contribution.placeholder = !goal ? "Create a goal first" : complete ? "Goal complete!" : "Add savings";
  }
  renderQuests();
}

function updateSummary() {
  const transactions = getTransactions();
  const totalIncome = transactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpenses = transactions.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + transaction.amount, 0);
  const balance = totalIncome - totalExpenses;
  if (incomeEl) incomeEl.textContent = formatMoney(totalIncome);
  if (expensesEl) expensesEl.textContent = formatMoney(totalExpenses);
  if (balanceEl) {
    balanceEl.textContent = formatMoney(balance);
    balanceEl.classList.toggle("negative", balance < 0);
  }
}

function formatDate(dateString) {
  if (!dateString) return "No date";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadTransactionsCsv() {
  const transactions = getTransactions();
  const rows = [["Type", "Category", "Amount", "Date", "Recurring", "Frequency"], ...transactions.map((transaction) => [transaction.type, transaction.category, transaction.amount.toFixed(2), transaction.date, transaction.recurring ? "Yes" : "No", transaction.recurring ? transaction.frequency : ""])] ;
  const csvContent = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "baonbuddy-transactions.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createTransactionItem(transaction) {
  const item = document.createElement("li");
  item.className = "transaction-item";
  const icon = document.createElement("span");
  icon.className = `transaction-icon ${transaction.type}`;
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = transaction.type === "income" ? "↗" : "−";
  const details = document.createElement("div");
  details.className = "transaction-details";
  const category = document.createElement("span");
  category.className = "transaction-category";
  category.textContent = transaction.category;
  const meta = document.createElement("small");
  meta.className = "transaction-date";
  meta.textContent = `${formatDate(transaction.date)}${transaction.recurring ? ` · ${transaction.frequency}` : ""}`;
  details.append(category, meta);
  const amount = document.createElement("span");
  amount.className = `amount ${transaction.type}`;
  amount.textContent = `${transaction.type === "income" ? "+" : "−"}${formatMoney(transaction.amount)}`;
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "delete-button";
  removeButton.setAttribute("aria-label", `Delete ${transaction.category}`);
  removeButton.textContent = "×";
  removeButton.addEventListener("click", () => {
    saveTransactions(getTransactions().filter((entry) => entry.id !== transaction.id));
    renderTransactions();
  });
  item.append(icon, details, amount, removeButton);
  return item;
}

function renderTransactions() {
  if (!list) return;
  const transactions = getTransactions();
  list.replaceChildren();
  if (!transactions.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.innerHTML = '<span class="empty-icon" aria-hidden="true">✦</span><strong>Your story starts here</strong><span>Add your first transaction and watch your progress grow.</span>';
    list.appendChild(empty);
  } else {
    transactions.slice().reverse().forEach((transaction) => list.appendChild(createTransactionItem(transaction)));
  }
  updateSummary();
}

function defaultQuestState() {
  const today = todayKey();
  const weekKey = getWeekKey(new Date());
  return {
    points: 0, currentStreak: 0, bestStreak: 0, lastCompletedDate: "", weeklySaved: 0, weekKey,
    dailyTasks: [
      { id: "log-transaction", title: "Log a transaction", points: 25, completed: false, date: today },
      { id: "save-amount", title: "Add to your savings goal", points: 50, completed: false, date: today },
      { id: "check-budget", title: "Review your budget", points: 25, completed: false, date: today }
    ],
    weeklyTasks: [
      { id: "week-save", title: `Save ${formatMoney(WEEKLY_SAVING_TARGET)} this week`, points: 120, completed: false, weekKey },
      { id: "week-review", title: "Review your spending", points: 75, completed: false, weekKey }
    ]
  };
}

function getQuestState() {
  const defaults = defaultQuestState();
  try {
    const raw = JSON.parse(localStorage.getItem(QUESTS_KEY) || "null");
    if (!raw || typeof raw !== "object") return defaults;
    return {
      ...defaults,
      ...raw,
      points: Math.max(0, safeNumber(raw.points)),
      currentStreak: Math.max(0, safeNumber(raw.currentStreak)),
      bestStreak: Math.max(0, safeNumber(raw.bestStreak)),
      weeklySaved: Math.max(0, safeNumber(raw.weeklySaved)),
      dailyTasks: Array.isArray(raw.dailyTasks) ? raw.dailyTasks : defaults.dailyTasks,
      weeklyTasks: Array.isArray(raw.weeklyTasks) ? raw.weeklyTasks : defaults.weeklyTasks
    };
  } catch {
    return defaults;
  }
}

function saveQuestState(state) {
  try {
    localStorage.setItem(QUESTS_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn("Could not save quest progress.", error);
    return false;
  }
}

function refreshQuestDates() {
  const state = getQuestState();
  const today = todayKey();
  const weekKey = getWeekKey(new Date());
  state.dailyTasks = state.dailyTasks.map((task) => task.date !== today ? { ...task, completed: false, date: today } : task);
  if (!state.dailyTasks.some((task) => task.id === "check-budget")) {
    state.dailyTasks.push({ id: "check-budget", title: "Review your budget", points: 25, completed: false, date: today });
  }
  if (state.weekKey !== weekKey) {
    state.weeklySaved = 0;
    state.weekKey = weekKey;
  }
  state.weeklyTasks = state.weeklyTasks.map((task) => task.weekKey !== weekKey ? { ...task, completed: false, weekKey } : task);
  if (!state.weeklyTasks.some((task) => task.id === "week-save")) {
    state.weeklyTasks.push({ id: "week-save", title: `Save ${formatMoney(WEEKLY_SAVING_TARGET)} this week`, points: 120, completed: false, weekKey });
  }
  saveQuestState(state);
}

function completeQuest(type, id) {
  const state = getQuestState();
  const tasks = type === "daily" ? state.dailyTasks : state.weeklyTasks;
  const task = tasks.find((entry) => entry.id === id);
  if (!task || task.completed) return;
  task.completed = true;
  state.points += task.points;
  const today = todayKey();
  if (state.lastCompletedDate !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    state.currentStreak = state.lastCompletedDate === todayKey(yesterday) ? state.currentStreak + 1 : 1;
    state.lastCompletedDate = today;
    state.bestStreak = Math.max(state.bestStreak, state.currentStreak);
  }
  saveQuestState(state);
  renderQuests();
}

function recordGoalSavings(amount) {
  const state = getQuestState();
  state.weeklySaved += amount;
  saveQuestState(state);
  if (state.weeklySaved >= WEEKLY_SAVING_TARGET) completeQuest("weekly", "week-save");
  else renderQuests();
}

function createQuestItem(task, type) {
  const item = document.createElement("li");
  item.className = `quest-item${task.completed ? " completed" : ""}`;
  const copy = document.createElement("div");
  copy.className = "quest-copy";
  const title = document.createElement("strong");
  title.textContent = task.title;
  const hint = document.createElement("span");
  hint.className = "quest-hint";
  if (task.completed) hint.textContent = "Done — nice work!";
  else if (task.id === "log-transaction") hint.textContent = "Complete by adding a transaction";
  else if (task.id === "save-amount") hint.textContent = getGoal() ? "Complete by adding savings to your goal" : "Create a goal above to unlock this quest";
  else if (task.id === "week-save") hint.textContent = `${formatMoney(Math.min(getQuestState().weeklySaved, WEEKLY_SAVING_TARGET))} / ${formatMoney(WEEKLY_SAVING_TARGET)} saved toward this quest`;
  else hint.textContent = `Earn ${task.points} XP`;
  copy.append(title, hint);
  const action = document.createElement("div");
  action.className = "quest-action";
  const points = document.createElement("span");
  points.className = "quest-points";
  points.textContent = `+${task.points} XP`;
  action.appendChild(points);
  const isReview = task.id === "check-budget" || task.id === "week-review";
  if (isReview && !task.completed) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Review";
    button.setAttribute("aria-label", `Complete quest: ${task.title}`);
    button.addEventListener("click", () => {
      completeQuest(type, task.id);
      document.getElementById("history-title")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    action.appendChild(button);
  } else if (task.completed) {
    const done = document.createElement("span");
    done.className = "quest-done";
    done.setAttribute("aria-label", "Completed");
    done.textContent = "✓";
    action.appendChild(done);
  }
  item.append(copy, action);
  return item;
}

function renderQuests() {
  const state = getQuestState();
  const dailyList = document.getElementById("daily-quests");
  const weeklyList = document.getElementById("weekly-quests");
  if (!dailyList || !weeklyList) return;
  dailyList.replaceChildren(...state.dailyTasks.map((task) => createQuestItem(task, "daily")));
  weeklyList.replaceChildren(...state.weeklyTasks.map((task) => createQuestItem(task, "weekly")));
  document.getElementById("total-points").textContent = String(state.points);
  document.getElementById("current-streak").textContent = `${state.currentStreak} day streak`;
  document.getElementById("best-streak").textContent = `Best: ${state.bestStreak}`;
}

function handleGoalSubmit(event) {
  event.preventDefault();
  const name = document.getElementById("goal-name-input")?.value.trim() || "";
  const target = safeNumber(document.getElementById("goal-target-input")?.value);
  if (!name || target <= 0) {
    alert("Add a goal name and a target greater than zero.");
    return;
  }
  const previous = getGoal();
  if (saveGoal({ name, target, saved: previous?.saved || 0 })) {
    goalForm.reset();
    renderGoal();
  }
}

function handleGoalContribution(event) {
  event.preventDefault();
  const input = document.getElementById("goal-contribution");
  const amount = safeNumber(input?.value);
  const goal = getGoal();
  if (!goal || amount <= 0) return;
  const added = Math.min(amount, goal.target - goal.saved);
  goal.saved = Math.min(goal.target, goal.saved + amount);
  if (saveGoal(goal)) {
    goalContributionForm.reset();
    renderGoal();
    if (added > 0) {
      completeQuest("daily", "save-amount");
      recordGoalSavings(added);
    }
  }
}

const clearGoalButton = document.getElementById("goal-clear");
if (goalForm) goalForm.addEventListener("submit", handleGoalSubmit);
if (goalContributionForm) goalContributionForm.addEventListener("submit", handleGoalContribution);
if (clearGoalButton) {
  clearGoalButton.addEventListener("click", () => {
    if (saveGoal(null)) {
      goalForm.reset();
      renderGoal();
    }
  });
}

function handleSubmit(event) {
  event.preventDefault();
  if (!form) return;
  const type = document.getElementById("type")?.value || "expense";
  const category = document.getElementById("category")?.value.trim() || "";
  const amount = safeNumber(document.getElementById("amount")?.value);
  const date = document.getElementById("date")?.value || "";
  if (!category || !date || amount <= 0) {
    alert("Please add a category, date, and amount greater than zero.");
    return;
  }
  const transaction = {
    id: createId(), type: type === "income" ? "income" : "expense", category, amount, date,
    recurring: Boolean(recurringToggle?.checked), frequency: document.getElementById("frequency")?.value || "monthly"
  };
  saveTransactions([...getTransactions(), transaction]);
  form.reset();
  if (recurringOptions) recurringOptions.classList.add("hidden");
  renderTransactions();
  completeQuest("daily", "log-transaction");
  document.getElementById("category")?.focus();
}

if (form) form.addEventListener("submit", handleSubmit);
if (downloadButton) downloadButton.addEventListener("click", downloadTransactionsCsv);
if (recurringToggle && recurringOptions) {
  recurringToggle.addEventListener("change", () => recurringOptions.classList.toggle("hidden", !recurringToggle.checked));
}

const dateInput = document.getElementById("date");
if (dateInput && !dateInput.value) dateInput.value = todayKey();
refreshQuestDates();
renderTransactions();
renderGoal();
renderQuests();

const startupScreen = document.getElementById("startup-screen");
window.addEventListener("load", () => {
  window.setTimeout(() => startupScreen?.classList.add("hidden"), 500);
});
