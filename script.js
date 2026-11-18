// Show the app immediately by default; the startup screen is an optional splash.
const startupScreen = document.getElementById("startup-screen");

function dismissStartupScreen() {
  startupScreen?.classList.add("hidden");
}

// A top-of-file fail-safe ensures the splash cannot remain stuck even if
// initialization later throws an error.
window.setTimeout(dismissStartupScreen, 1500);

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
