const form = document.getElementById("transaction-form");
const list = document.getElementById("transaction-list");
const incomeEl = document.getElementById("total-income");
const expensesEl = document.getElementById("total-expenses");
const balanceEl = document.getElementById("remaining-balance");
const downloadButton = document.getElementById("download-csv");
const recurringToggle = document.getElementById("is-recurring");
const recurringOptions = document.getElementById("recurring-options");

const STORAGE_KEY = "budget-transactions";
const money = (value) => new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
}).format(Number(value) || 0);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]);
const localToday = () => {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

const readTransactions = () => {
  try {
    const transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(transactions) ? transactions : [];
  } catch {
    return [];
  }
};

const saveTransactions = (transactions) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch (error) {
    console.warn("Could not save transactions.", error);
    alert("Your browser couldn’t save this transaction. Check that local storage is available and try again.");
    return false;
  }
};

const formatDate = (date) => {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

const render = () => {
  const transactions = readTransactions();
  const income = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + (Number(transaction.amount) || 0), 0);
  const expenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + (Number(transaction.amount) || 0), 0);

  if (incomeEl) incomeEl.textContent = money(income);
  if (expensesEl) expensesEl.textContent = money(expenses);
  if (balanceEl) {
    const balance = income - expenses;
    balance.textContent = money(balance);
    balance.classList.toggle("negative", balance < 0);
  }

  if (!list) return;
  if (!transactions.length) {
    list.innerHTML = '<li class="empty-state"><strong>No transactions yet</strong><span>Add your first income or expense above.</span></li>';
    return;
  }

  list.innerHTML = [...transactions]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)))
    .map((transaction) => {
      const isIncome = transaction.type === "income";
      return `<li class="transaction-item">
        <span class="transaction-icon ${isIncome ? "income" : "expense"}" aria-hidden="true">${isIncome ? "↗" : "↘"}</span>
        <span class="transaction-details">
          <span class="transaction-category">${escapeHtml(transaction.category)}</span>
          <span class="transaction-date">${escapeHtml(formatDate(transaction.date))}${transaction.recurring ? ` · ${escapeHtml(transaction.frequency)}` : ""}</span>
        </span>
        <strong class="amount ${isIncome ? "income" : "expense"}">${isIncome ? "+" : "-"}${money(transaction.amount)}</strong>
        <button type="button" class="delete-button" data-delete-id="${escapeHtml(transaction.id)}" aria-label="Delete ${escapeHtml(transaction.category)} transaction">×</button>
      </li>`;
    })
    .join("");
};

document.querySelectorAll(".tab-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const tabName = button.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === tabName);
    });
  });
});

recurringToggle?.addEventListener("change", () => {
  recurringOptions?.classList.toggle("hidden", !recurringToggle.checked);
});

const dateInput = document.getElementById("date");
if (dateInput) {
  dateInput.value = localToday();
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const category = String(data.get("category") || "").trim();
  const amount = Number(data.get("amount"));
  const date = String(data.get("date") || "");
  const type = data.get("type") === "expense" ? "expense" : "income";
  if (!category || !date || !Number.isFinite(amount) || amount <= 0) return;

  const transactions = readTransactions();
  transactions.push({
    id: window.crypto?.randomUUID?.() || `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    category,
    amount,
    date,
    recurring: recurringToggle?.checked || false,
    frequency: String(data.get("frequency") || "monthly"),
  });

  if (saveTransactions(transactions)) {
    form.reset();
    if (dateInput) dateInput.value = localToday();
    recurringOptions?.classList.add("hidden");
    render();
  }
});

list?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;
  const transactions = readTransactions().filter((transaction) => transaction.id !== button.dataset.deleteId);
  if (saveTransactions(transactions)) render();
});

downloadButton?.addEventListener("click", () => {
  const transactions = readTransactions();
  if (!transactions.length) {
    alert("There are no transactions to download yet.");
    return;
  }

  const rows = [
    ["Date", "Type", "Category", "Amount", "Recurring", "Frequency"],
    ...transactions.map((transaction) => [
      transaction.date,
      transaction.type,
      transaction.category,
      transaction.amount,
      transaction.recurring ? "Yes" : "No",
      transaction.frequency || "",
    ]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "baonbuddy-transactions.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

render();
