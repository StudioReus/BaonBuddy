const form = document.getElementById("transaction-form");
const list = document.getElementById("transaction-list");
const incomeEl = document.getElementById("total-income");
const expensesEl = document.getElementById("total-expenses");
const balanceEl = document.getElementById("remaining-balance");
const downloadButton = document.getElementById("download-csv");
const STORAGE_KEY = "budget-transactions";

function createId() {
  return window.crypto?.randomUUID?.() || `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTransaction(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  const category = typeof raw.category === "string" ? raw.category.trim().slice(0, 60) : "";
  const amount = safeNumber(raw.amount);
  const date = typeof raw.date === "string" ? raw.date : "";
  if (!category || !date || amount <= 0) return null;
  const frequency = ["weekly", "monthly", "yearly"].includes(raw.frequency) ? raw.frequency : "monthly";
  return {
    id: typeof raw.id === "string" ? raw.id : createId(),
    type: raw.type === "income" ? "income" : "expense",
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
    if (!Array.isArray(stored)) throw new Error("Saved transactions are not an array");
    const transactions = stored.map(normalizeTransaction).filter(Boolean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    return transactions;
  } catch (error) {
    console.warn("Could not read saved transactions; starting with an empty list.", error);
    try { localStorage.setItem(STORAGE_KEY, "[]"); } catch (_) { /* Storage may be disabled. */ }
    return [];
  }
}

function saveTransactions(transactions) {
  const clean = transactions.map(normalizeTransaction).filter(Boolean);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  return clean;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(safeNumber(value));
}

function getSummary(transactions) {
  const totalIncome = transactions.filter((item) => item.type === "income")
    .reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const totalExpenses = transactions.filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + safeNumber(item.amount), 0);
  return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses };
}

function updateSummary() {
  const { totalIncome, totalExpenses, balance } = getSummary(getTransactions());
  if (incomeEl) incomeEl.textContent = formatMoney(totalIncome);
  if (expensesEl) expensesEl.textContent = formatMoney(totalExpenses);
  if (balanceEl) {
    balanceEl.textContent = formatMoney(balance);
    balanceEl.style.color = balance >= 0 ? "#39c38d" : "#ff6c7e";
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
    ...transactions.map((item) => [item.type, item.category, Number(item.amount).toFixed(2), item.date, item.recurring ? "Yes" : "No", item.frequency])
  ];
  const blob = new Blob([rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
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
  const details = document.createElement("div");
  details.className = "transaction-details";
  const category = document.createElement("span");
  category.className = "transaction-category";
  category.textContent = transaction.category;
  const date = document.createElement("small");
  date.className = "transaction-date";
  date.textContent = formatDate(transaction.date);
  details.append(category, date);
  if (transaction.recurring) {
    const badge = document.createElement("span");
    badge.className = "recurring-badge";
    badge.textContent = `Repeats ${transaction.frequency}`;
    details.appendChild(badge);
  }
  const amount = document.createElement("span");
  amount.className = `amount ${transaction.type}`;
  amount.textContent = `${transaction.type === "income" ? "+" : "−"}${formatMoney(transaction.amount)}`;
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "delete-button";
  removeButton.setAttribute("aria-label", `Delete ${transaction.category}`);
  removeButton.textContent = "Delete";
  removeButton.addEventListener("click", () => {
    saveTransactions(getTransactions().filter((entry) => entry.id !== transaction.id));
    renderTransactions();
  });
  item.append(details, amount, removeButton);
  return item;
}

function renderTransactions() {
  if (!list) return;
  const transactions = getTransactions();
  list.replaceChildren();
  if (!transactions.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No transactions yet.";
    list.appendChild(empty);
  } else {
    transactions.forEach((transaction) => list.appendChild(createTransactionItem(transaction)));
  }
  updateSummary();
}

function handleSubmit(event) {
  event.preventDefault();
  const type = document.getElementById("type")?.value || "expense";
  const category = document.getElementById("category")?.value.trim() || "";
  const amount = safeNumber(document.getElementById("amount")?.value);
  const date = document.getElementById("date")?.value || "";
  const recurring = document.getElementById("is-recurring")?.checked || false;
  const frequency = document.getElementById("frequency")?.value || "monthly";
  if (!category || !date || amount <= 0) {
    alert("Please fill out all fields with a valid amount.");
    return;
  }
  try {
    saveTransactions([...getTransactions(), { id: createId(), type, category, amount, date, recurring, frequency }]);
    form.reset();
    document.getElementById("recurring-options")?.classList.add("hidden");
    renderTransactions();
  } catch (error) {
    console.error("Could not save transaction.", error);
    alert("Your transaction could not be saved. Check your browser storage settings and try again.");
  }
}

form?.addEventListener("submit", handleSubmit);
downloadButton?.addEventListener("click", downloadTransactionsCsv);
renderTransactions();

const startupScreen = document.getElementById("startup-screen");
window.addEventListener("load", () => {
  window.setTimeout(() => {
    startupScreen?.classList.add("hidden");
    document.body.classList.add("app-ready");
  }, 900);
});

const orb1 = document.querySelector(".orb-1");
const orb2 = document.querySelector(".orb-2");
window.addEventListener("pointermove", (event) => {
  if (!orb1 || !orb2) return;
  const x = (event.clientX / window.innerWidth - 0.5) * 30;
  const y = (event.clientY / window.innerHeight - 0.5) * 30;
  orb1.style.transform = `translate(${x}px, ${y}px) scale(1.08)`;
  orb2.style.transform = `translate(${x * -0.7}px, ${y * -0.7}px) scale(1.06)`;
});

const recurringToggle = document.getElementById("is-recurring");
const recurringOptions = document.getElementById("recurring-options");
recurringToggle?.addEventListener("change", () => recurringOptions?.classList.toggle("hidden", !recurringToggle.checked));

// The browser sends only aggregate totals and category summaries—not individual transactions.
function getChatBudgetSummary() {
  const transactions = getTransactions();
  const totals = getSummary(transactions);
  const categoryTotals = new Map();
  transactions.filter((item) => item.type === "expense").forEach((item) => {
    const key = item.category.trim().slice(0, 32);
    categoryTotals.set(key, (categoryTotals.get(key) || 0) + item.amount);
  });
  const topCategories = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }));
  return {
    currency: "PHP",
    totalIncome: Math.round(totals.totalIncome * 100) / 100,
    totalExpenses: Math.round(totals.totalExpenses * 100) / 100,
    balance: Math.round(totals.balance * 100) / 100,
    topExpenseCategories: topCategories
  };
}

const chatPanel = document.getElementById("chat-panel");
const chatLauncher = document.getElementById("chat-launcher");
const chatClose = document.getElementById("chat-close");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessagesEl = document.getElementById("chat-messages");
const chatSend = document.getElementById("chat-send");
const conversation = [];

function addChatMessage(role, text, extraClass = "") {
  const message = document.createElement("div");
  message.className = `chat-message ${role === "user" ? "user-message" : "assistant-message"} ${extraClass}`.trim();
  message.textContent = text;
  chatMessagesEl?.appendChild(message);
  if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  return message;
}

function setChatOpen(open) {
  if (!chatPanel || !chatLauncher) return;
  chatPanel.hidden = !open;
  chatLauncher.setAttribute("aria-expanded", String(open));
  if (open) chatInput?.focus();
}

chatLauncher?.addEventListener("click", () => setChatOpen(chatPanel?.hidden));
chatClose?.addEventListener("click", () => setChatOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && chatPanel && !chatPanel.hidden) {
    setChatOpen(false);
    chatLauncher?.focus();
  }
});

chatForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = chatInput?.value.trim();
  if (!message || !chatSend || !chatInput) return;
  conversation.push({ role: "user", text: message });
  addChatMessage("user", message);
  chatInput.value = "";
  chatSend.disabled = true;
  chatInput.disabled = true;
  const thinking = addChatMessage("assistant", "Thinking…", "thinking-message");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation.slice(-8), budgetSummary: getChatBudgetSummary() }),
      signal: AbortSignal.timeout(30000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "I couldn't reach the AI service. Please try again.");
    const reply = typeof result.reply === "string" ? result.reply : "Sorry, I couldn't create a reply just now.";
    thinking.remove();
    conversation.push({ role: "model", text: reply });
    addChatMessage("model", reply);
  } catch (error) {
    thinking.remove();
    const reason = error.name === "TimeoutError" ? "That took too long. Please try again." : error.message;
    addChatMessage("model", reason || "Something went wrong. Please try again.", "error-message");
  } finally {
    chatSend.disabled = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
});
