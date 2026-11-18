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

// The startup overlay should never block the app if another script or a network
// resource fails. Keep it visible briefly, then let its CSS transition fade it out.
const startupScreen = document.getElementById("startup-screen");
if (startupScreen) {
  const dismissStartupScreen = () => startupScreen.classList.add("hidden");
  window.setTimeout(dismissStartupScreen, 700);
  window.setTimeout(dismissStartupScreen, 2500);
}
