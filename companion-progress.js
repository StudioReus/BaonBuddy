(() => {
  const PROGRESS_KEY = "baonbuddy-progress";
  const LESSONS_KEY = "baonbuddy-completed-lessons";
  const LEGACY_KEY = "baonbuddy-quests";
  const CHAPTERS = [
    { title: "Money Basics", short: "Basics", icon: "◒", levels: ["Money and you", "Needs and wants", "Income", "Expenses", "Emergency baon", "Tracking habits", "Budget words", "Simple plans", "Checking in", "Basics check"] },
    { title: "Plan Your Baon", short: "Planning", icon: "▦", levels: ["Your weekly plan", "A spending limit", "Food budget", "Fare planning", "School costs", "Flexible money", "Unplanned expenses", "Plan check-ins", "Adjusting a plan", "Planning check"] },
    { title: "Saving Goals", short: "Saving", icon: "◎", levels: ["Why save?", "Small amounts", "Clear goals", "A savings timeline", "Saving first", "Goal milestones", "Handling setbacks", "Separate savings", "Multiple goals", "Saving check"] },
    { title: "Smart Choices", short: "Choices", icon: "✓", levels: ["Pause before buying", "Compare prices", "Avoiding impulse buys", "Borrowing carefully", "Online shopping", "Subscriptions", "Scams and safety", "Value for money", "Responsible generosity", "Choices check"] },
    { title: "Investing Basics", short: "Investing", icon: "↗", levels: ["What investing means", "Risk and reward", "Time horizon", "Diversification", "Inflation", "Savings versus investing", "Common investments", "Fees and charges", "Red flags", "Investing check"] }
  ];

  const ACHIEVEMENTS = [
    { id: "first-step", title: "First Step", text: "Record your first transaction.", icon: "1" },
    { id: "check-in", title: "On a Roll", text: "Check in 7 days.", icon: "🔥" },
    { id: "first-lesson", title: "Curious Mind", text: "Complete your first lesson.", icon: "📖" },
    { id: "chapter-one", title: "Basics Builder", text: "Finish Money Basics.", icon: "◒" },
    { id: "first-save", title: "Small Saver", text: "Add savings to a goal.", icon: "◎" },
    { id: "goal-reached", title: "Goal Getter", text: "Complete a savings goal.", icon: "★" },
    { id: "activity-30", title: "Money Tracker", text: "Record 30 transactions.", icon: "✓" },
    { id: "graduate", title: "Money Graduate", text: "Complete all 50 levels.", icon: "♛" }
  ];
  const COSMETICS = [
    { id: "buddy-default", name: "Original Buddy", icon: "🐣", price: 0, effect: "", description: "The classic BaonBuddy look." },
    { id: "buddy-glasses", name: "Study Glasses", icon: "🤓", price: 20, effect: "glasses", description: "Adds a study-buddy badge." },
    { id: "buddy-star", name: "Star Buddy", icon: "⭐", price: 35, effect: "star", description: "Adds a star to your Buddy." },
    { id: "buddy-sunset", name: "Sunset Buddy", icon: "🌅", price: 50, effect: "sunset", description: "Gives your Buddy a warm sunset theme." },
    { id: "buddy-scholar", name: "Scholar Buddy", icon: "🎓", price: 75, effect: "scholar", description: "Adds a scholar badge for completed progress." }
  ];

  function defaultState() {
    let legacy = {};
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null") || {}; } catch { legacy = {}; }
    return {
      xp: Number(legacy.points) || 0,
      coins: Number(legacy.coins) || 0,
      streak: Number(legacy.currentStreak) || 0,
      bestStreak: Number(legacy.bestStreak) || 0,
      lastCompletedDate: String(legacy.lastCompletedDate || ""),
      dailyXpDate: "",
      dailyXp: 0,
      achievements: {},
      ownedItems: ["buddy-default"],
      equipped: "buddy-default"
    };
  }

  function read() {
    try { return { ...defaultState(), ...(JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null") || {}) }; }
    catch { return defaultState(); }
  }

  function write(state) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(state)); } catch { return false; }
    return true;
  }

  function today() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).slice(0).padStart(2, "0")}`;
  }

  function addXp(amount, coins = 0) {
    const state = read();
    state.xp += Math.max(0, amount);
    state.coins += Math.max(0, coins);
    if (state.dailyXpDate !== today()) {
      state.dailyXpDate = today();
      state.dailyXp = 0;
    }
    state.dailyXp += Math.max(0, amount);
    write(state);
    renderHeader(state);
  }

  function checkIn() {
    const state = read();
    const date = today();
    if (state.lastCompletedDate !== date) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
      state.streak = state.lastCompletedDate === yesterdayKey ? state.streak + 1 : 1;
      state.lastCompletedDate = date;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      write(state);
    }
    renderHeader(state);
  }

  function unlock(id) {
    const state = read();
    if (state.achievements[id]) return false;
    state.achievements[id] = today();
    const reward = id === "graduate" ? { xp: 150, coins: 30 } : id === "goal-reached" ? { xp: 50, coins: 12 } : { xp: 25, coins: 5 };
    state.xp += reward.xp;
    state.coins += reward.coins;
    write(state);
    renderAll();
    showAchievementToast(id, reward);
    return true;
  }

  function showAchievementToast(id, reward) {
    const achievement = ACHIEVEMENTS.find((item) => item.id === id);
    if (!achievement) return;
    document.querySelector(".achievement-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "achievement-toast";
    toast.innerHTML = `<span>${achievement.icon}</span><div><small>ACHIEVEMENT UNLOCKED</small><strong>${achievement.title}</strong><p>+${reward.xp} XP · +${reward.coins} coins</p></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  }

  function renderHeader(state = read()) {
    setText("header-xp", String(state.xp));
    setText("header-coins", String(state.coins));
    setText("header-streak", String(state.streak));
  }

  function renderAchievements() {
    const grid = document.getElementById("achievement-grid");
    const count = document.getElementById("achievement-count");
    if (!grid) return;
    const state = read();
    const unlocked = ACHIEVEMENTS.filter((item) => state.achievements[item.id]).length;
    if (count) count.textContent = `${unlocked} / ${ACHIEVEMENTS.length}`;
    grid.replaceChildren(...ACHIEVEMENTS.map((item) => {
      const earned = Boolean(state.achievements[item.id]);
      const card = document.createElement("article");
      card.className = `achievement-card${earned ? " earned" : ""}`;
      card.innerHTML = `<span class="achievement-icon" aria-hidden="true">${earned ? item.icon : "🔒"}</span><div><strong>${item.title}</strong><p>${item.text}</p></div>`;
      return card;
    }));
  }

  function renderDailyGoal(state = read()) {
    const ring = document.getElementById("daily-goal-ring");
    const value = document.getElementById("daily-goal-value");
    const message = document.getElementById("daily-goal-message");
    if (!ring || !value) return;
    const goal = 20;
    const earned = state.dailyXpDate === today() ? Math.min(goal, Number(state.dailyXp) || 0) : 0;
    const percent = Math.min(100, Math.round(earned / goal * 100));
    value.textContent = String(earned);
    ring.style.setProperty("--daily-progress", `${percent * 3.6}deg`);
    ring.setAttribute("aria-valuenow", String(earned));
    if (message) message.textContent = earned >= goal ? "Daily goal complete. Nice work!" : `Earn ${goal - earned} more XP today.`;
  }

  function renderShop() {
    const grid = document.getElementById("shop-grid");
    const coins = document.getElementById("shop-coins");
    if (!grid) return;
    const state = read();
    if (coins) coins.textContent = `${state.coins} ◉`;
    grid.replaceChildren(...COSMETICS.map((item) => {
      const owned = state.ownedItems.includes(item.id);
      const equipped = state.equipped === item.id;
      const card = document.createElement("article");
      card.className = `shop-item${equipped ? " equipped" : ""}`;
      card.innerHTML = `<span class="shop-icon" aria-hidden="true">${item.icon}</span><div><strong>${item.name}</strong><small>${item.description}</small><b>${owned ? (equipped ? "Equipped" : "Owned") : `${item.price} coins`}</b></div><button type="button"${owned ? "" : ' aria-label="Purchase ' + item.name + '"'}>${owned ? (equipped ? "Wearing" : "Equip") : "Get"}</button>`;
      card.querySelector("button").addEventListener("click", () => {
        const current = read();
        if (!current.ownedItems.includes(item.id)) {
          if (current.coins < item.price) {
            showShopNotice(`You need ${item.price - current.coins} more coins.`);
            return;
          }
          current.coins -= item.price;
          current.ownedItems.push(item.id);
        }
        current.equipped = item.id;
        write(current);
        document.body.dataset.buddyEffect = item.effect;
        renderAll();
        showShopNotice(`${item.name} equipped.`);
      });
      return card;
    }));
  }

  function showShopNotice(message) {
    document.querySelector(".achievement-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "achievement-toast";
    toast.innerHTML = `<span>◉</span><div><small>BUDDY SHOP</small><strong>${message}</strong></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
  }

  function renderAll() {
    renderHeader();
    renderDailyGoal();
    renderAchievements();
    renderShop();
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setupCompanion() {
    const state = read();
    const balanceText = document.getElementById("remaining-balance")?.textContent || "";
    const greeting = document.getElementById("buddy-greeting");
    const message = document.getElementById("buddy-message");
    const hours = new Date().getHours();
    if (greeting) greeting.textContent = hours < 12 ? "GOOD MORNING, BEH" : hours < 18 ? "UY BEH, LET'S CHECK IN" : "GOOD EVENING, BEH";
    if (message) {
      if (balanceText.startsWith("-")) message.textContent = "Your spending passed your income this time. We can adjust the plan without judgment.";
      else if (state.streak >= 7) message.textContent = `Seven-day energy! You’ve checked in ${state.streak} days in a row.`;
      else message.textContent = "Small check-ins add up. Want to log today or keep growing your baon knowledge?";
    }
    document.querySelector(".buddy-mood")?.addEventListener("click", () => {
      document.getElementById("buddy-button")?.click();
      document.getElementById("buddy-tip")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function setupLearn() {
    const tabs = document.getElementById("chapter-tabs");
    const path = document.getElementById("lesson-path");
    const progress = document.getElementById("journey-progress");
    const chapterProgress = document.getElementById("chapter-progress");
    if (!tabs || !path) return;
    let completed;
    try { completed = JSON.parse(localStorage.getItem(LESSONS_KEY) || "[]"); if (!Array.isArray(completed)) completed = []; } catch { completed = []; }
    if (progress) progress.textContent = `${completed.length} of 50 levels complete · ${Math.round(completed.length / 50 * 100)}%`;

    let activeChapter = 0;
    for (let index = 0; index < 40; index++) {
      if (!completed.includes(index)) break;
      activeChapter = Math.min(4, Math.floor((index + 1) / 10));
    }
    function renderChapter(chapterIndex) {
      activeChapter = chapterIndex;
      tabs.querySelectorAll("button").forEach((button, index) => {
        button.classList.toggle("active", index === chapterIndex);
        button.setAttribute("aria-selected", String(index === chapterIndex));
      });
      const chapter = CHAPTERS[chapterIndex];
      const first = chapterIndex * 10;
      const chapterDone = chapter.levels.filter((_, index) => completed.includes(first + index)).length;
      if (chapterProgress) chapterProgress.innerHTML = `<span>${chapter.title}</span><strong>${chapterDone}/10 complete</strong>`;
      path.replaceChildren();
      chapter.levels.forEach((title, localIndex) => {
        const levelIndex = first + localIndex;
        const earned = completed.includes(levelIndex);
        const unlocked = levelIndex === 0 || completed.includes(levelIndex - 1);
        const node = document.createElement("button");
        node.type = "button";
        node.className = `chapter-node chapter-position-${localIndex + 1}${earned ? " complete" : ""}${unlocked ? "" : " locked"}`;
        node.setAttribute("aria-label", `${earned ? "Completed" : unlocked ? "Start" : "Locked"} level ${levelIndex + 1}: ${title}`);
        node.innerHTML = `<span class="chapter-node-ring">${earned ? "✓" : unlocked ? localIndex + 1 : "🔒"}</span><span class="chapter-node-label\"><strong>${title}</strong><small>Level ${levelIndex + 1}</small></span>`;
        node.addEventListener("click", () => {
          if (!unlocked) {
            node.animate([{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }], { duration: 280 });
            return;
          }
          window.location.href = `/lesson.html?level=${levelIndex + 1}`;
        });
        path.appendChild(node);
      });
    }
    tabs.replaceChildren(...CHAPTERS.map((chapter, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "tab");
      button.innerHTML = `<span>${chapter.icon}</span><strong>${chapter.short}</strong><small>${index * 10 + 1}–${index * 10 + 10}</small>`;
      button.addEventListener("click", () => renderChapter(index));
      return button;
    }));
    renderChapter(activeChapter);
  }

  function evaluateAchievements() {
    try {
      const transactions = JSON.parse(localStorage.getItem("budget-transactions") || "[]");
      const transactionCount = Array.isArray(transactions) ? transactions.length : 0;
      if (transactionCount > 0) unlock("first-step");
      if (transactionCount >= 30) unlock("activity-30");
    } catch { /* Optional achievement check. */ }
    let completed = [];
    try { completed = JSON.parse(localStorage.getItem(LESSONS_KEY) || "[]"); if (!Array.isArray(completed)) completed = []; } catch { completed = []; }
    if (completed.length > 0) unlock("first-lesson");
    if (completed.length >= 10) unlock("chapter-one");
    if (completed.length >= 50) unlock("graduate");
  }

  const api = { CHAPTERS, ACHIEVEMENTS, read, write, addXp, checkIn, unlock, renderAll, setupLearn, evaluateAchievements };
  window.BaonBuddyProgress = api;
  document.addEventListener("DOMContentLoaded", () => {
    checkIn();
    evaluateAchievements();
    renderAll();
    setupCompanion();
    setupLearn();
    renderShop();
    const equipped = read().equipped;
    const cosmetic = COSMETICS.find((item) => item.id === equipped);
    document.body.dataset.buddyEffect = cosmetic?.effect || "";
  });
})();
