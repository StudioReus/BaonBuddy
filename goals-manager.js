(() => {
  const GOALS_KEY = "baonbuddy-savings-goals";
  const LEGACY_GOAL_KEY = "baonbuddy-savings-goal";
  const TRANSACTIONS_KEY = "budget-transactions";
  const panel = document.getElementById("savings-goal-panel");
  if (!panel) return;

  const money = (value) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value) || 0);
  const safeParse = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  const id = () => window.crypto?.randomUUID?.() || `goal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const normalize = (goal) => {
    if (!goal || typeof goal !== "object") return null;
    const name = typeof goal.name === "string" ? goal.name.trim().slice(0, 60) : "";
    const target = Number(goal.target);
    const saved = Math.max(0, Number(goal.saved) || 0);
    return name && Number.isFinite(target) && target > 0 ? { id: goal.id || id(), name, target, saved } : null;
  };
  const readGoals = () => {
    let raw = safeParse(GOALS_KEY, null);
    if (!Array.isArray(raw)) {
      const legacy = safeParse(LEGACY_GOAL_KEY, null);
      raw = legacy && typeof legacy === "object" ? [legacy] : [];
    }
    return raw.map(normalize).filter(Boolean);
  };
  const saveGoals = (goals) => {
    try {
      localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
      localStorage.removeItem(LEGACY_GOAL_KEY);
      return true;
    } catch (error) {
      console.warn("Could not save savings goals.", error);
      alert("Your browser couldn’t save this goal. Check that local storage is available and try again.");
      return false;
    }
  };
  const availableBaon = () => {
    const transactions = safeParse(TRANSACTIONS_KEY, []);
    const net = Array.isArray(transactions) ? transactions.reduce((sum, tx) => {
      const amount = Number(tx?.amount) || 0;
      return sum + (tx?.type === "income" ? amount : -amount);
    }, 0) : 0;
    return net - readGoals().reduce((sum, goal) => sum + goal.saved, 0);
  };
  const updateBalance = () => {
    const balance = document.getElementById("remaining-balance");
    const value = availableBaon();
    if (!balance) return;
    balance.textContent = money(value);
    balance.classList.toggle("negative", value < 0);
  };
  const esc = (text) => String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);

  const legacyQuestPanel = document.querySelector(".goal-quests");
  panel.innerHTML = `
    <div class="goal-content">
      <div class="goal-heading"><div class="goal-icon" aria-hidden="true">✦</div><div><p class="eyebrow">A LITTLE SAVING GOES A LONG WAY</p><h2 id="goal-title">Your savings goals</h2></div></div>
      <p class="goal-available">Available baon: <strong id="goal-available-baon"></strong></p>
      <div id="goals-list" class="goals-list" aria-live="polite"></div>
    </div>
    <form id="goal-form" class="goal-form">
      <p class="goal-form-title">Start another goal</p>
      <label for="goal-name-input">What are you saving for?</label>
      <input id="goal-name-input" name="goalName" type="text" maxlength="60" placeholder="A new pair of shoes…" required />
      <label for="goal-target-input">Savings target</label>
      <div class="goal-target-input"><span aria-hidden="true">₱</span><input id="goal-target-input" name="target" type="number" min="0.01" step="0.01" placeholder="0.00" required /></div>
      <button type="submit" class="goal-save-button"><span>Create goal</span><span aria-hidden="true">＋</span></button>
    </form>`;
  if (legacyQuestPanel) {
    const questPanel = document.getElementById("quests-panel");
    if (questPanel && !questPanel.contains(legacyQuestPanel)) questPanel.appendChild(legacyQuestPanel);
  }

  const goalsList = document.getElementById("goals-list");
  const render = () => {
    const goals = readGoals();
    const available = availableBaon();
    const availableLabel = document.getElementById("goal-available-baon");
    if (availableLabel) availableLabel.textContent = money(available);
    if (!goals.length) {
      goalsList.innerHTML = '<div class="goal-empty"><p>No goals yet. Create one and start saving from your baon.</p></div>';
    } else {
      goalsList.innerHTML = goals.map((goal) => {
        const percent = Math.min(100, Math.floor(goal.saved / goal.target * 100));
        const remaining = Math.max(0, goal.target - goal.saved);
        const limit = Math.max(0, Math.min(remaining, available));
        return `<article class="goal-card" data-goal-id="${esc(goal.id)}">
          <div class="goal-progress-copy"><div><h3>${esc(goal.name)}</h3><p>${goal.saved >= goal.target ? "Goal complete — congratulations! ✨" : `${money(remaining)} to go`}</p></div><strong>${percent}%</strong></div>
          <div class="progress-track" role="progressbar" aria-label="${esc(goal.name)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><div class="progress-fill" style="width:${percent}%"></div></div>
          <div class="goal-totals"><span>${money(goal.saved)} saved</span><span>Target: ${money(goal.target)}</span></div>
          <form class="goal-contribution-form" data-goal-id="${esc(goal.id)}"><label class="sr-only" for="contribution-${esc(goal.id)}">Add savings to ${esc(goal.name)}</label><span aria-hidden="true">₱</span><input id="contribution-${esc(goal.id)}" name="contribution" type="number" min="0.01" step="0.01" max="${Math.max(0, limit).toFixed(2)}" placeholder="${limit > 0 ? `Up to ${money(limit)}` : "No baon available"}" ${limit <= 0 ? "disabled" : "required"} /><button class="goal-add-button" type="submit" ${limit <= 0 ? "disabled" : ""}>Add savings</button></form>
          <button type="button" class="goal-clear-button" data-remove-goal="${esc(goal.id)}">Remove goal</button>
        </article>`;
      }).join("");
    }
    updateBalance();
  };

  panel.addEventListener("submit", (event) => {
    if (event.target.id === "goal-form") {
      event.preventDefault();
      event.stopImmediatePropagation();
      const name = document.getElementById("goal-name-input").value.trim();
      const target = Number(document.getElementById("goal-target-input").value);
      if (!name || !Number.isFinite(target) || target <= 0) return;
      const goals = readGoals();
      goals.push({ id: id(), name, target, saved: 0 });
      if (saveGoals(goals)) { event.target.reset(); render(); }
      return;
    }
    if (event.target.matches(".goal-contribution-form")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const goalId = event.target.dataset.goalId;
      const input = event.target.elements.contribution;
      const amount = Number(input.value);
      const goals = readGoals();
      const goal = goals.find((item) => item.id === goalId);
      const available = availableBaon();
      if (!goal || !Number.isFinite(amount) || amount <= 0 || amount > available || amount > goal.target - goal.saved) {
        alert(`Enter an amount no greater than the available baon (${money(Math.max(0, Math.min(available, goal ? goal.target - goal.saved : 0)))}).`);
        return;
      }
      goal.saved += amount;
      if (saveGoals(goals)) {
        event.target.reset();
        render();
        if (typeof window.completeQuest === "function") window.completeQuest("daily", "save-amount");
        if (typeof window.recordGoalSavings === "function") window.recordGoalSavings(amount);
      }
    }
  }, true);

  panel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-goal]");
    if (!button) return;
    const goals = readGoals().filter((goal) => goal.id !== button.dataset.removeGoal);
    if (saveGoals(goals)) render();
  });

  const balanceElement = document.getElementById("remaining-balance");
  if (balanceElement) new MutationObserver(updateBalance).observe(balanceElement, { childList: true, characterData: true, subtree: true });
  render();
})();
