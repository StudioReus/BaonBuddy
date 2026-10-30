const form = document.getElementById("transaction-form");
const list = document.getElementById("transaction-list");
const incomeEl = document.getElementById("total-income");
const expensesEl = document.getElementById("total-expenses");
const balanceEl = document.getElementById("remaining-balance");

const STORAGE_KEY = "budget-transactions";

function createId() {
  if (window.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const DEFAULT_TRANSACTIONS = [
  { id: createId(), type: "income", category: "Salary", amount: 2500, date: "2026-10-01" },
  { id: createId(), type: "expense", category: "Groceries", amount: 120.5, date: "2026-10-02" },
  { id: createId(), type: "expense", category: "Rent", amount: 900, date: "2026-10-03" }
];

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTransaction(rawTransaction = {}) {
  if (!rawTransaction || typeof rawTransaction !== "object") {
    return null;
  }

  const type = rawTransaction.type === "income" ? "income" : "expense";
  const category = typeof rawTransaction.category === "string" ? rawTransaction.category.trim() : "";
  const amount = safeNumber(rawTransaction.amount);
  const date = typeof rawTransaction.date === "string" ? rawTransaction.date : "";

  if (!category || !date || amount <= 0) {
    return null;
  }

  return {
    id: rawTransaction.id || createId(),
    type,
    category,
    amount,
    date
  };
}

function getTransactions() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (!Array.isArray(stored)) {
      throw new Error("Stored data is not an array");
    }

    const validTransactions = stored
      .map(normalizeTransaction)
      .filter(Boolean);

    if (validTransactions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validTransactions));
      return validTransactions;
    }
  } catch (error) {
    console.warn("Could not read saved transactions. Resetting to defaults.", error);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TRANSACTIONS));
  return DEFAULT_TRANSACTIONS.map((transaction) => ({ ...transaction }));
}

function saveTransactions(transactions) {
  const safeTransactions = transactions
    .map(normalizeTransaction)
    .filter(Boolean);

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

function getSummary(transactions) {
  const totalIncome = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + safeNumber(transaction.amount), 0);

  const totalExpenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + safeNumber(transaction.amount), 0);

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses
  };
}

function updateSummary() {
  const transactions = getTransactions();
  const { totalIncome, totalExpenses, balance } = getSummary(transactions);

  if (incomeEl) incomeEl.textContent = formatMoney(totalIncome);
  if (expensesEl) expensesEl.textContent = formatMoney(totalExpenses);
  if (balanceEl) {
    balanceEl.textContent = formatMoney(balance);
    balanceEl.style.color = balance >= 0 ? "#16a34a" : "#dc2626";
  }
}

function formatDate(dateString) {
  if (!dateString) return "No date";

  const date = new Date(dateString + "T00:00:00");

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function createTransactionItem(transaction) {
  const item = document.createElement("li");
  item.className = "transaction-item";

  const details = document.createElement("div");
  details.className = "transaction-details";

  const category = document.createElement("span");
  category.className = "transaction-category";
  category.textContent = transaction.category;

  const date = document.createElement("small");
  date.className = "transaction-date";
  date.textContent = formatDate(transaction.date);

  details.append(category, date);

  const amount = document.createElement("span");
  amount.className = `amount ${transaction.type === "income" ? "income" : "expense"}`;
  amount.textContent = `${transaction.type === "income" ? "+" : "-"}${formatMoney(transaction.amount)}`;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "delete-button";
  removeButton.setAttribute("aria-label", `Delete ${transaction.category}`);
  removeButton.textContent = "Delete";
  removeButton.addEventListener("click", () => {
    const transactions = getTransactions().filter((entry) => entry.id !== transaction.id);
    saveTransactions(transactions);
    renderTransactions();
  });

  item.append(details, amount, removeButton);
  return item;
}

function renderTransactions() {
  if (!list) return;

  const transactions = getTransactions();
  list.innerHTML = "";

  if (!transactions.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No transactions yet.";
    list.appendChild(empty);
    updateSummary();
    return;
  }

  transactions.forEach((transaction) => {
    list.appendChild(createTransactionItem(transaction));
  });

  updateSummary();
}

function handleSubmit(event) {
  event.preventDefault();

  if (!form) return;

  const type = document.getElementById("type")?.value || "expense";
  const category = document.getElementById("category")?.value.trim() || "";
  const amountValue = document.getElementById("amount")?.value;
  const date = document.getElementById("date")?.value || "";
  const amount = safeNumber(amountValue);

  if (!category || !date || amount <= 0) {
    alert("Please fill out all fields with a valid amount.");
    return;
  }

  const newTransaction = {
    id: createId(),
    type: type === "income" ? "income" : "expense",
    category,
    amount,
    date
  };

  const transactions = [...getTransactions(), newTransaction];
  saveTransactions(transactions);
  form.reset();
  renderTransactions();
}

if (form) {
  form.addEventListener("submit", handleSubmit);
}

renderTransactions();
