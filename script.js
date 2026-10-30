const form = document.getElementById("transaction-form");
const list = document.getElementById("transaction-list");
const incomeEl = document.getElementById("total-income");
const expensesEl = document.getElementById("total-expenses");
const balanceEl = document.getElementById("remaining-balance");

const storageKey = "budget-transactions";

const defaultTransactions = [
  { type: "income", category: "Salary", amount: 2500, date: "2026-10-01" },
  { type: "expense", category: "Groceries", amount: 120.5, date: "2026-10-02" },
  { type: "expense", category: "Rent", amount: 900, date: "2026-10-03" }
];

function getTransactions() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(stored) && stored.length > 0) {
      return stored;
    }
  } catch (error) {
    console.warn("Could not read saved transactions:", error);
  }

  localStorage.setItem(storageKey, JSON.stringify(defaultTransactions));
  return defaultTransactions;
}

function saveTransactions(transactions) {
  localStorage.setItem(storageKey, JSON.stringify(transactions));
}

function formatMoney(value) {
  const amount = Number(value) || 0;
  const parts = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).formatToParts(amount);

  return parts
    .map((part) => (part.type === "currency" ? "₱" : part.value))
    .join("");
}

function updateSummary() {
  const transactions = getTransactions();

  const totalIncome = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const totalExpenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

  const balance = totalIncome - totalExpenses;

  incomeEl.textContent = formatMoney(totalIncome);
  expensesEl.textContent = formatMoney(totalExpenses);
  balanceEl.textContent = formatMoney(balance);
}

function renderTransactions() {
  const transactions = getTransactions();
  list.innerHTML = "";

  if (!transactions.length) {
    list.innerHTML = "<li>No transactions yet.</li>";
    updateSummary();
    return;
  }

  transactions.forEach((transaction) => {
    const item = document.createElement("li");

    const label = document.createElement("span");
    label.textContent = `${transaction.category}`;

    const amount = document.createElement("span");
    amount.classList.add(
      transaction.type === "income" ? "amount income" : "amount expense"
    );

    const sign = transaction.type === "income" ? "+" : "-";
    amount.textContent = `${sign}${formatMoney(Number(transaction.amount))}`;

    item.append(label, amount);
    list.appendChild(item);
  });

  updateSummary();
}

form.addEventListener("submit", function (event) {
  event.preventDefault();

  const transaction = {
    type: document.getElementById("type").value,
    category: document.getElementById("category").value.trim(),
    amount: Number(document.getElementById("amount").value),
    date: document.getElementById("date").value
  };

  if (!transaction.category || !transaction.amount || !transaction.date) {
    alert("Please fill out all fields.");
    return;
  }

  const transactions = getTransactions();
  transactions.push(transaction);
  saveTransactions(transactions);

  form.reset();
  renderTransactions();
});

renderTransactions();
