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

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTransaction(raw = {}) {
  if (!raw || typeof raw !== "object") return null;

  const type = raw.type === "income" ? "income" : "expense";
  const category = typeof raw.category === "string" ? raw.category.trim() : "";
  const amount = safeNumber(raw.amount);
  const date = typeof raw.date === "string" ? raw.date : "";
  const frequency = ["weekly", "monthly", "yearly"].includes(raw.frequency) ? raw.frequency : "monthly";

  if (!category || !date || amount <= 0) return null;

  return {
    id: raw.id || createId(),
    type,
    category,
    amount,
    date,
    recurring: raw.recurring === true,
    frequency
  };
}

function getTransactions() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) throw new Error("Stored data is not an array");
    const validTransactions = stored.map(normalizeTransaction).filter(Boolean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validTransactions));
    return validTransactions;
  } catch (error) {
    console.warn("Could not read saved transactions. Resetting to empty state.", error);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch (storageError) {
      console.warn("Could not reset saved transactions.", storageError);
    }
    return [];
  }
}

function saveTransactions(transactions) {
  const safeTransactions = transactions.map(normalizeTransaction).filter(Boolean);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeTransactions));
  return safeTransactions;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safeNumber(value));
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
  if (!goal) return;

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
  const contribution = document.getElementById("goal-contribution");
  const addButton = goalContributionForm?.querySelector("button[type='submit']");
  if (contribution && addButton) {
    const complete = goal.saved >= goal.target;
    contribution.disabled = complete;
    addButton.disabled = complete;
    contribution.placeholder = complete ? "Goal complete!" : "Add savings";
  }
}

function updateSummary() {
  const transactions = getTransactions();
  const totalIncome = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
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
  const rows = [
    ["Type", "Category", "Amount", "Date", "Recurring", "Frequency"],
    ...transactions.map((transaction) => [
      transaction.type,
      transaction.category,
      transaction.amount.toFixed(2),
      transaction.date,
      transaction.recurring ? "Yes" : "No",
      transaction.recurring ? transaction.frequency : ""
    ])
  ];
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
  icon.textContent = transaction.type === "income" ? "↗" : "↘";

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

function handleGoalSubmit(event) {
  event.preventDefault();
  const nameInput = document.getElementById("goal-name-input");
  const targetInput = document.getElementById("goal-target-input");
  const name = nameInput?.value.trim() || "";
  const target = safeNumber(targetInput?.value);
  if (!name || target <= 0) {
    alert("Add a goal name and a target greater than zero.");
    return;
  }
  const previous = getGoal();
  const goal = { name, target, saved: previous?.saved || 0 };
  if (saveGoal(goal)) {
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
  goal.saved = Math.min(goal.target, goal.saved + amount);
  if (saveGoal(goal)) {
    goalContributionForm.reset();
    renderGoal();
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
    id: createId(),
    type: type === "income" ? "income" : "expense",
    category,
    amount,
    date,
    recurring: Boolean(recurringToggle?.checked),
    frequency: document.getElementById("frequency")?.value || "monthly"
  };

  saveTransactions([...getTransactions(), transaction]);
  form.reset();
  if (recurringOptions) recurringOptions.classList.add("hidden");
  renderTransactions();
  document.getElementById("category")?.focus();
}

if (form) form.addEventListener("submit", handleSubmit);
if (downloadButton) downloadButton.addEventListener("click", downloadTransactionsCsv);
if (recurringToggle && recurringOptions) {
  recurringToggle.addEventListener("change", () => recurringOptions.classList.toggle("hidden", !recurringToggle.checked));
}

const dateInput = document.getElementById("date");
if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
renderTransactions();
renderGoal();

const startupScreen = document.getElementById("startup-screen");
window.addEventListener("load", () => {
  window.setTimeout(() => startupScreen?.classList.add("hidden"), 500);
});
