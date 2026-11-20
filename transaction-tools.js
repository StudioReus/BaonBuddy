(() => {
  const STORAGE_KEY = "budget-transactions";
  const UNDO_KEY = "baonbuddy-transaction-undo";
  const CATEGORIES = ["Food", "Transport", "School", "Bills", "Shopping", "Health", "Entertainment", "Savings", "Allowance", "Other"];
  const COLORS = ["#e99a24", "#e06f61", "#5c9b82", "#7d78c8", "#5a91c6", "#d17baf", "#b6874e", "#7d9a51", "#7d8794", "#d19d32"];
  let editingId = null;
  let undoTimer = null;

  // Keep the metadata this module owns if the original dashboard normalizes the
  // same localStorage rows. The app remains local-first and works offline.
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (key === STORAGE_KEY) {
      try {
        const previous = JSON.parse(this.getItem(key) || "[]");
        const incoming = JSON.parse(value);
        if (Array.isArray(previous) && Array.isArray(incoming)) {
          const byId = new Map(previous.map((row) => [String(row.id), row]));
          value = JSON.stringify(incoming.map((row) => {
            const old = byId.get(String(row.id));
            if (!old) return row;
            const merged = { ...old, ...row };
            for (const field of ["description", "occurrenceKey", "recurrenceId", "nextOccurrence"]) {
              if (!(field in row) && field in old) merged[field] = old[field];
            }
            return merged;
          }));
        }
      } catch { /* Let the app handle unavailable or malformed storage. */ }
    }
    return originalSetItem.call(this, key, value);
  };

  document.addEventListener("DOMContentLoaded", init, { once: true });

  function init() {
    const form = $("transaction-form");
    const list = $("transaction-list");
    if (!form || !list) return;
    addStyles();
    setupCategories();
    setupFilters();
    setupSummary();
    setupImportExport();
    form.addEventListener("submit", submitTransaction, true);
    $("transaction-cancel")?.addEventListener("click", cancelEdit);
    $("transaction-cancel")?.addEventListener("click", (event) => event.preventDefault());
    $("is-recurring")?.addEventListener("change", () => $("recurring-options")?.classList.toggle("hidden", !$("is-recurring").checked));
    processRecurringTransactions();
    renderTransactions();
    updateSummary();
    restoreUndo();
  }

  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .transaction-tools { display:grid; gap:9px; margin:0 0 14px; }
      .transaction-tools input,.transaction-tools select,.summary-controls input,.summary-controls select { min-width:0; min-height:40px; padding:8px 10px; border:1px solid #e3e7ed; border-radius:11px; background:#fbfcfd; color:#263547; }
      .filter-row,.summary-controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .filter-row > * { flex:1 1 105px; }
      #transaction-search { width:100%; }
      .form-actions { display:flex; grid-column:1/-1; gap:9px; }
      .form-actions .primary-button { flex:1; }
      .form-actions .secondary-button { cursor:pointer; }
      .transaction-actions { display:flex; flex:0 0 auto; gap:4px; }
      .edit-button,.delete-button { min-width:32px; min-height:32px; border:0; border-radius:9px; background:#fff7e9; color:#85550d; cursor:pointer; font-weight:800; }
      .edit-button { display:grid; place-items:center; padding:6px; }
      .edit-button svg { width:16px; height:16px; }
      .transaction-item .delete-button { background:transparent; }
      .transaction-item .delete-button:hover { background:#fff0ed; color:#c54b46; }
      .transaction-tag { display:inline-block; width:max-content; max-width:100%; padding:2px 7px; border-radius:999px; background:#fff4df; color:#85550d; font-size:.66rem; font-weight:800; }
      .transaction-description { overflow:hidden; color:#806f64; font-size:.76rem; text-overflow:ellipsis; white-space:nowrap; }
      .spending-summary { margin-top:18px; }
      .summary-controls { margin-bottom:12px; color:#705b50; font-size:.82rem; font-weight:800; }
      .summary-controls input,.summary-controls select { min-width:120px; }
      .summary-period-label { margin:0 0 12px; color:#806f64; font-size:.85rem; font-weight:800; }
      .summary-cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:9px; }
      .summary-cards > div { display:grid; gap:5px; padding:12px; border:1px solid #f0e5dc; border-radius:13px; background:#fffdfa; }
      .summary-cards span { color:#806f64; font-size:.74rem; font-weight:700; }
      .summary-cards strong { font-size:.95rem; overflow-wrap:anywhere; }
      .spending-summary h3 { margin:16px 0 8px; font-size:.95rem; }
      .summary-visual { display:grid; grid-template-columns:minmax(150px,.8fr) minmax(0,1.2fr); gap:18px; align-items:center; margin-top:16px; }
      .spending-donut { display:grid; width:min(190px,100%); aspect-ratio:1; place-items:center; margin:auto; border-radius:50%; background:conic-gradient(#e9edf1 0deg 360deg); }
      .donut-hole { display:grid; width:64%; aspect-ratio:1; align-content:center; justify-items:center; border-radius:50%; background:#fff; text-align:center; }
      .donut-hole strong { font-size:.95rem; }.donut-hole span { color:#806f64; font-size:.7rem; }
      .category-breakdown { display:grid; gap:6px; margin:0; padding:0; list-style:none; }
      .category-breakdown li { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 10px; border-radius:9px; background:#fff8f0; font-size:.82rem; }
      .legend-label { display:flex; min-width:0; align-items:center; gap:7px; }.legend-label span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .legend-dot { width:9px; height:9px; flex:0 0 auto; border-radius:50%; }
      .analysis-list { display:grid; gap:6px; margin:0; padding:0; list-style:none; }
      .analysis-list li { padding:9px 11px; border-radius:10px; background:#fbfcfd; color:#5f6e7c; font-size:.82rem; line-height:1.45; }
      .undo-toast { position:fixed; z-index:200; right:18px; bottom:18px; display:flex; align-items:center; gap:12px; max-width:calc(100% - 36px); padding:12px 15px; border:1px solid #f0e5dc; border-radius:13px; background:#fff; box-shadow:0 10px 32px #26354724; font-size:.87rem; }
      .undo-toast button { border:0; background:transparent; color:#a9521d; cursor:pointer; font-weight:900; }
      .history #transaction-list { max-height:520px; }
      .csv-import-label { display:inline-flex; min-height:40px; align-items:center; justify-content:center; padding:8px 12px; border:1px solid #eadcae; border-radius:11px; background:white; color:#76632e; cursor:pointer; font-size:.8rem; font-weight:800; }
      .csv-import-label input { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); }
      .quest-copy { display:grid; min-width:0; gap:5px; line-height:1.45; }
      .quest-copy strong { line-height:1.35; overflow-wrap:anywhere; }
      .quest-hint { color:#718094; font-size:.78rem; line-height:1.45; overflow-wrap:anywhere; }
      .quest-action { display:flex; flex:0 0 auto; align-items:center; gap:8px; }
      .quest-item { align-items:flex-start; }
      @media(max-width:600px) { .summary-cards { grid-template-columns:repeat(2,minmax(0,1fr)); } .summary-visual { grid-template-columns:1fr; } .filter-row > * { flex-basis:calc(50% - 8px); } .form-actions { flex-wrap:wrap; } .quest-item { gap:8px; } .quest-action { flex-wrap:wrap; justify-content:flex-end; } }
    `;
    document.head.appendChild(style);
  }

  function setupCategories() {
    const select = $("transaction-category");
    const customField = $("custom-category-field");
    const customInput = $("custom-category");
    if (!select || !customField || !customInput) return;
    select.addEventListener("change", () => {
      const custom = select.value === "Other";
      customField.hidden = !custom;
      customInput.required = custom;
    });
    const description = $("category");
    if (description) {
      const label = document.querySelector('label[for="category"]');
      if (label) label.textContent = "Description";
      description.placeholder = "Lunch, weekly allowance…";
    }
  }

  function setupFilters() {
    const container = document.querySelector(".transaction-tools");
    if (!container) return;
    // Build the compact controls here so older markup can be upgraded without
    // removing its existing search field or filter affordances.
    let search = $("transaction-search");
    if (!search) {
      search = document.createElement("input"); search.id = "transaction-search"; search.type = "search";
      search.placeholder = "Search transactions…"; search.setAttribute("aria-label", "Search transactions");
      container.prepend(search);
    }
    let row = container.querySelector(".filter-row");
    if (!row) { row = document.createElement("div"); row.className = "filter-row"; container.appendChild(row); }
    const ensureSelect = (id, label, options) => {
      let select = $(id);
      if (!select) { select = document.createElement("select"); select.id = id; select.setAttribute("aria-label", label); row.appendChild(select); }
      if (!select.options.length || id === "category-filter") {
        const selected = select.value;
        select.replaceChildren(...options.map(([text, value]) => new Option(text, value)));
        if ([...select.options].some((option) => option.value === selected)) select.value = selected;
      }
      return select;
    };
    ensureSelect("type-filter", "Filter by transaction type", [["All types", "all"], ["Income", "income"], ["Expenses", "expense"]]);
    ensureSelect("category-filter", "Filter by category", [["All categories", "all"], ...[...new Set(readTransactions().map((tx) => tx.category))].sort().map((name) => [name, name])]);
    ensureSelect("sort-order", "Sort by date", [["Newest first", "newest"], ["Oldest first", "oldest"]]);
    let dateRow = container.querySelector(".date-filter-row");
    if (!dateRow) { dateRow = document.createElement("div"); dateRow.className = "filter-row date-filter-row"; container.appendChild(dateRow); }
    for (const [id, label] of [["date-from", "From date"], ["date-to", "To date"]]) {
      if (!$(id)) { const input = document.createElement("input"); input.type = "date"; input.id = id; input.setAttribute("aria-label", label); input.title = label; dateRow.appendChild(input); }
    }
    for (const control of [search, $("type-filter"), $("category-filter"), $("sort-order"), $("date-from"), $("date-to")]) {
      control?.addEventListener("input", renderTransactions);
      control?.addEventListener("change", renderTransactions);
    }
    container.querySelectorAll("#transaction-filter").forEach((legacy) => legacy.addEventListener("change", renderTransactions));
  }

  function setupSummary() {
    const root = $("spending-summary-content") || $("spending-summary-container") || $("spending-summary-content");
    const host = $("spending-summary-content") || $("spending-summary-content");
    const section = document.querySelector(".spending-summary");
    if (!section) return;
    let content = $("spending-summary-content");
    if (!content) {
      content = section.querySelector("#spending-summary-content") || section.querySelector("#spending-summary-container");
      if (!content) { content = document.createElement("div"); content.id = "spending-summary-content"; section.appendChild(content); }
    }
    content.innerHTML = `
      <div class="summary-controls"><label for="summary-period">View</label><select id="summary-period"><option value="day">Day</option><option value="week">Week</option><option value="month" selected>Month</option></select><label for="summary-date">Around</label><input id="summary-date" type="date" aria-label="Choose a date for the summary" /></div>
      <p class="summary-period-label" id="summary-period-label"></p>
      <div class="summary-cards"><div><span>Income</span><strong id="period-income">₱0.00</strong></div><div><span>Spending</span><strong id="period-expenses">₱0.00</strong></div><div><span>Net</span><strong id="period-net">₱0.00</strong></div><div><span>Transactions</span><strong id="period-count">0</strong></div></div>
      <div class="summary-visual"><div class="spending-donut" id="spending-donut" role="img" aria-label="Spending by category"><div class="donut-hole"><strong id="donut-total">₱0</strong><span>spent</span></div></div><ul class="category-breakdown" id="category-breakdown" aria-label="Spending category legend"></ul></div>
      <h3>Quick analysis</h3><ul class="analysis-list" id="summary-analysis"></ul>`;
    const date = $("summary-date"); date.value = todayKey();
    $("summary-period").addEventListener("change", updateSummary);
    date.addEventListener("change", updateSummary);
  }

  function setupImportExport() {
    $("download-csv")?.addEventListener("click", downloadCsv);
    const host = document.querySelector(".download-section");
    if (!host || $("import-csv")) return;
    const label = document.createElement("label");
    label.className = "csv-import-label";
    label.textContent = "Import CSV";
    const input = document.createElement("input"); input.id = "import-csv"; input.type = "file"; input.accept = ".csv,text/csv";
    input.setAttribute("aria-label", "Import transactions from CSV");
    input.addEventListener("change", importCsv);
    label.appendChild(input); host.appendChild(label);
  }

  function $(id) { return document.getElementById(id); }
  function readTransactions() {
    try { const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(data) ? data.map(normalize).filter(Boolean) : []; }
    catch { return []; }
  }
  function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    const date = String(raw.date || ""); const category = String(raw.category || "Other").trim(); const amount = Number(raw.amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !category || !Number.isFinite(amount) || amount <= 0) return null;
    const frequency = ["weekly", "monthly", "yearly"].includes(raw.frequency) ? raw.frequency : "monthly";
    return { ...raw, id: String(raw.id || createId()), type: raw.type === "income" ? "income" : "expense", category, description: String(raw.description || ""), amount, date, recurring: raw.recurring === true, frequency };
  }
  function writeTransactions(rows) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.map(normalize).filter(Boolean))); refreshCategoryFilter(); return true; }
    catch { alert("Your browser could not save this transaction. Please check available storage and try again."); return false; }
  }
  function refreshCategoryFilter() {
    const filter = $("category-filter"); if (!filter) return;
    const chosen = filter.value;
    const categories = [...new Set(readTransactions().map((row) => row.category))].sort((a, b) => a.localeCompare(b));
    filter.replaceChildren(new Option("All categories", "all"), ...categories.map((name) => new Option(name, name)));
    filter.value = categories.includes(chosen) ? chosen : "all";
  }
  function submitTransaction(event) {
    event.preventDefault(); event.stopImmediatePropagation();
    const form = $("transaction-form"); if (!form.reportValidity()) return;
    const chosen = $("transaction-category")?.value || "Other";
    const category = chosen === "Other" ? $("custom-category")?.value.trim() : chosen;
    const amount = Number($("amount").value); const date = $("date").value; const description = $("category").value.trim();
    if (!category || !Number.isFinite(amount) || amount <= 0 || !date) return;
    const rows = readTransactions(); const previous = editingId ? rows.find((row) => row.id === editingId) : null;
    const recurring = Boolean($("is-recurring")?.checked);
    const row = { ...(previous || {}), id: editingId || createId(), type: $("type").value, category, description, amount, date, recurring, frequency: $("frequency")?.value || "monthly" };
    row.nextOccurrence = recurring ? (previous?.recurring && previous.nextOccurrence ? previous.nextOccurrence : nextDate(date, row.frequency)) : undefined;
    const next = previous ? rows.map((item) => item.id === editingId ? row : item) : [...rows, row];
    if (!writeTransactions(next)) return;
    const wasEditing = Boolean(editingId); cancelEdit(); form.reset();
    if ($("date")) $("date").value = todayKey(); $("recurring-options")?.classList.add("hidden");
    const custom = $("custom-category-field"); if (custom) custom.hidden = true;
    if ($("custom-category")) $("custom-category").required = false;
    renderTransactions();
    if (!wasEditing && typeof completeQuest === "function") completeQuest("daily", "log-transaction");
    $("category")?.focus();
  }
  function startEdit(id) {
    const row = readTransactions().find((item) => item.id === id); if (!row) return;
    editingId = id; $("add-title").textContent = "Edit transaction";
    const submit = $("transaction-submit"); submit.textContent = "Save changes";
    const cancel = $("transaction-cancel"); if (cancel) cancel.hidden = false;
    $("type").value = row.type;
    const select = $("transaction-category");
    const isStandard = [...select.options].some((option) => option.value === row.category);
    select.value = isStandard ? row.category : "Other";
    const customField = $("custom-category-field"); const customInput = $("custom-category");
    customField.hidden = isStandard; customInput.required = !isStandard; customInput.value = isStandard ? "" : row.category;
    $("category").value = row.description || ""; $("amount").value = row.amount; $("date").value = row.date;
    $("is-recurring").checked = row.recurring; $("recurring-options")?.classList.toggle("hidden", !row.recurring);
    if ($("frequency")) $("frequency").value = row.frequency || "monthly";
    $("add-title").scrollIntoView({ behavior: "smooth", block: "center" }); select.focus();
  }
  function cancelEdit() {
    editingId = null; const form = $("transaction-form"); form?.reset();
    if ($("add-title")) $("add-title").textContent = "Add a transaction";
    if ($("transaction-submit")) $("transaction-submit").innerHTML = 'Save transaction <span aria-hidden="true">→</span>';
    if ($("transaction-cancel")) $("transaction-cancel").hidden = true;
    if ($("custom-category-field")) $("custom-category-field").hidden = true;
    if ($("custom-category")) $("custom-category").required = false;
    $("recurring-options")?.classList.add("hidden");
    if ($("date")) $("date").value = todayKey();
  }
  function renderTransactions() {
    const list = $("transaction-list"); if (!list) return;
    const query = ($("transaction-search")?.value || "").trim().toLocaleLowerCase();
    const type = $("type-filter")?.value || $("transaction-filter")?.value || "all";
    const category = $("category-filter")?.value || "all"; const from = $("date-from")?.value || ""; const to = $("date-to")?.value || "";
    const direction = $("sort-order")?.value || "newest";
    const rows = readTransactions().filter((row) => {
      const haystack = `${row.category} ${row.description} ${row.type}`.toLocaleLowerCase();
      return (!query || haystack.includes(query)) && (type === "all" || row.type === type) && (category === "all" || row.category === category) && (!from || row.date >= from) && (!to || row.date <= to);
    }).sort((a,b) => direction === "oldest" ? a.date.localeCompare(b.date) || a.id.localeCompare(b.id) : b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    list.replaceChildren();
    if (!rows.length) { const empty = document.createElement("li"); empty.className = "empty-state"; empty.textContent = readTransactions().length ? "No transactions match these filters." : "No transactions yet — add one to get started."; list.appendChild(empty); }
    else rows.forEach((row) => list.appendChild(createItem(row)));
    updateSummary();
  }
  function createItem(row) {
    const item = document.createElement("li"); item.className = "transaction-item";
    const icon = document.createElement("span"); icon.className = `transaction-icon ${row.type}`; icon.setAttribute("aria-hidden", "true"); icon.textContent = row.type === "income" ? "↗" : "−";
    const details = document.createElement("div"); details.className = "transaction-details";
    const title = document.createElement("span"); title.className = "transaction-category"; title.textContent = row.description || row.category;
    const tag = document.createElement("span"); tag.className = "transaction-tag"; tag.textContent = row.category;
    const meta = document.createElement("small"); meta.className = "transaction-date"; meta.textContent = `${formatDate(row.date)}${row.recurring ? ` · Repeats ${row.frequency}` : row.recurrenceId ? " · Recurring entry" : ""}`;
    details.append(title, tag, meta);
    const amount = document.createElement("span"); amount.className = `amount ${row.type}`; amount.textContent = `${row.type === "income" ? "+" : "−"}${formatMoney(row.amount)}`;
    const actions = document.createElement("div"); actions.className = "transaction-actions";
    const edit = document.createElement("button"); edit.type = "button"; edit.className = "edit-button"; edit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>'; edit.setAttribute("aria-label", `Edit ${row.description || row.category}`); edit.title = "Edit transaction"; edit.addEventListener("click", () => startEdit(row.id));
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "delete-button"; remove.textContent = "×"; remove.setAttribute("aria-label", `Delete ${row.description || row.category}`); remove.addEventListener("click", () => deleteTransaction(row.id));
    actions.append(edit, remove); item.append(icon, details, amount, actions); return item;
  }
  function deleteTransaction(id) {
    const rows = readTransactions(); const row = rows.find((item) => item.id === id); if (!row) return;
    if (!writeTransactions(rows.filter((item) => item.id !== id))) return;
    const undo = { row, expiresAt: Date.now() + 10000 }; localStorage.setItem(UNDO_KEY, JSON.stringify(undo));
    showUndo(undo); renderTransactions();
  }
  function showUndo(saved) {
    document.querySelector(".undo-toast")?.remove(); clearTimeout(undoTimer);
    const toast = document.createElement("div"); toast.className = "undo-toast"; toast.setAttribute("role", "status");
    const message = document.createElement("span"); message.textContent = `Deleted ${saved.row.description || saved.row.category}.`;
    const button = document.createElement("button"); button.type = "button"; button.textContent = "Undo";
    button.addEventListener("click", () => {
      try { const current = JSON.parse(localStorage.getItem(UNDO_KEY) || "null"); if (!current || current.expiresAt < Date.now()) return toast.remove();
        const rows = readTransactions(); if (!rows.some((row) => row.id === current.row.id)) rows.push(current.row);
        writeTransactions(rows); localStorage.removeItem(UNDO_KEY); toast.remove(); renderTransactions();
      } catch { toast.remove(); }
    });
    toast.append(message, button); document.body.appendChild(toast);
    undoTimer = setTimeout(() => { toast.remove(); localStorage.removeItem(UNDO_KEY); }, Math.max(0, saved.expiresAt - Date.now()));
  }
  function restoreUndo() { try { const saved = JSON.parse(localStorage.getItem(UNDO_KEY) || "null"); if (saved?.row && saved.expiresAt > Date.now()) showUndo(saved); else localStorage.removeItem(UNDO_KEY); } catch { localStorage.removeItem(UNDO_KEY); } }
  function updateSummary() {
    const rows = readTransactions();
    const income = rows.filter((row) => row.type === "income").reduce((sum,row) => sum + row.amount,0);
    const expenses = rows.filter((row) => row.type === "expense").reduce((sum,row) => sum + row.amount,0);
    setText("total-income",formatMoney(income)); setText("total-expenses",formatMoney(expenses)); setText("remaining-balance",formatMoney(income-expenses));
    $("remaining-balance")?.classList.toggle("negative", income-expenses < 0);
    updatePeriodSummary(rows);
  }
  function updatePeriodSummary(rows) {
    if (!$("summary-period")) return;
    const period = $("summary-period").value || "month"; const anchor = $("summary-date").value || todayKey();
    const [year,month,day] = anchor.split("-").map(Number); let start = new Date(year,month-1,day); let end = new Date(year,month-1,day);
    if (period === "week") { start.setDate(start.getDate() - ((start.getDay()+6)%7)); end = new Date(start); end.setDate(start.getDate()+6); }
    if (period === "month") { start = new Date(year,month-1,1); end = new Date(year,month,0); }
    const startKey = todayKey(start), endKey = todayKey(end); const matching = rows.filter((row) => row.date >= startKey && row.date <= endKey);
    const income = matching.filter((row) => row.type === "income").reduce((sum,row) => sum+row.amount,0);
    const expenses = matching.filter((row) => row.type === "expense").reduce((sum,row) => sum+row.amount,0);
    setText("period-income",formatMoney(income)); setText("period-expenses",formatMoney(expenses)); setText("period-net",formatMoney(income-expenses)); setText("period-count",String(matching.length));
    setText("summary-period-label",`${period[0].toUpperCase()+period.slice(1)}: ${period === "day" ? formatDate(startKey) : `${formatDate(startKey)} – ${formatDate(endKey)}`}`);
    setText("donut-total",formatCompactMoney(expenses));
    const totals = new Map(); matching.filter((row) => row.type === "expense").forEach((row) => totals.set(row.category,(totals.get(row.category)||0)+row.amount));
    const sorted = [...totals.entries()].sort((a,b) => b[1]-a[1]);
    const legend = $("category-breakdown"); legend.replaceChildren();
    if (!sorted.length) { const empty = document.createElement("li"); empty.textContent = "No spending in this period."; legend.appendChild(empty); }
    else sorted.forEach(([name,amount],index) => { const li=document.createElement("li"); const label=document.createElement("span"); label.className="legend-label"; const dot=document.createElement("span"); dot.className="legend-dot"; dot.style.backgroundColor=COLORS[index%COLORS.length]; const text=document.createElement("span"); text.textContent=name; label.append(dot,text); const value=document.createElement("strong"); value.textContent=formatMoney(amount); li.append(label,value); legend.appendChild(li); });
    const donut = $("spending-donut");
    if (expenses > 0) { let angle=0; const segments=sorted.map(([,amount],index) => { const next=angle+amount/expenses*360; const segment=`${COLORS[index%COLORS.length]} ${angle}deg ${next}deg`; angle=next; return segment; }); donut.style.background=`conic-gradient(${segments.join(",")})`; }
    else donut.style.background="conic-gradient(#e9edf1 0deg 360deg)";
    donut?.setAttribute("aria-label",expenses ? `Spending by category, total ${formatMoney(expenses)}` : "No spending in this period");
    const analysis=$("summary-analysis"); analysis.replaceChildren();
    const notes=[];
    if (!matching.length) notes.push("No transactions in this period yet. Add one to start your analysis.");
    else {
      if (sorted.length) notes.push(`Top spending: ${sorted[0][0]} at ${formatMoney(sorted[0][1])}${expenses ? ` (${Math.round(sorted[0][1]/expenses*100)}% of spending)` : ""}.`);
      const topIncome=matching.filter((row)=>row.type==="income").sort((a,b)=>b.amount-a.amount)[0];
      if (topIncome) notes.push(`Largest income: ${topIncome.description || topIncome.category} at ${formatMoney(topIncome.amount)}.`);
      notes.push(income-expenses >= 0 ? `You ended this period ${formatMoney(income-expenses)} ahead.` : `Spending was ${formatMoney(expenses-income)} above income.`);
    }
    notes.forEach((note)=>{const li=document.createElement("li");li.textContent=note;analysis.appendChild(li);});
  }
  function processRecurringTransactions() {
    const rows=readTransactions(), today=todayKey(); let changed=false;
    rows.filter((row)=>row.recurring).forEach((template)=>{
      let due=template.nextOccurrence || nextDate(template.date,template.frequency); let guard=0;
      while(due<=today && guard++<1200){
        const occurrenceKey=`${template.id}:${due}`;
        if(!rows.some((row)=>row.occurrenceKey===occurrenceKey)) rows.push({id:createId(),type:template.type,category:template.category,description:template.description,amount:template.amount,date:due,recurring:false,frequency:template.frequency,recurrenceId:template.id,occurrenceKey});
        due=nextDate(due,template.frequency); changed=true;
      }
      if(template.nextOccurrence!==due){template.nextOccurrence=due;changed=true;}
    });
    if(changed) writeTransactions(rows);
  }
  function nextDate(value,frequency){
    const [year,month,day]=value.split("-").map(Number);
    if(frequency==="weekly"){const date=new Date(year,month-1,day);date.setDate(date.getDate()+7);return todayKey(date);}
    let targetYear=year,targetMonth=month-1;
    if(frequency==="monthly")targetMonth++;else targetYear++;
    return todayKey(new Date(targetYear,targetMonth,Math.min(day,new Date(targetYear,targetMonth+1,0).getDate())));
  }
  async function importCsv(event){
    const input=event.target,file=input.files?.[0];if(!file)return;
    try{
      const matrix=parseCsv((await file.text()).replace(/^\uFEFF/,""));if(matrix.length<2)throw new Error("The CSV has no transaction rows.");
      const headers=matrix[0].map((header)=>header.trim().toLowerCase());const index=(name)=>headers.indexOf(name);
      if(["type","amount","date"].some((name)=>index(name)<0)||(index("category")<0&&index("description")<0))throw new Error("CSV must include Type, Category (or Description), Amount, and Date columns.");
      const valid=[];let skipped=0;
      matrix.slice(1).forEach((cells)=>{if(!cells.some((cell)=>cell.trim()))return;const description=index("description")>=0?cells[index("description")]?.trim()||"":"";const category=(index("category")>=0?cells[index("category")]?.trim():"")||description||"Other";const row=normalize({id:createId(),type:cells[index("type")]?.trim().toLowerCase(),category,description,amount:cells[index("amount")]?.trim(),date:cells[index("date")]?.trim(),recurring:index("recurring")>=0&&cells[index("recurring")]?.trim().toLowerCase()==="true",frequency:index("frequency")>=0?cells[index("frequency")]?.trim().toLowerCase():"monthly"});if(row)valid.push(row);else skipped++;});
      if(!valid.length)throw new Error("No valid transactions were found.");
      if(!window.confirm(`Import ${valid.length} transactions? Existing records will be kept. ${skipped?`${skipped} invalid row(s) will be skipped.`:""}`))return;
      const existing=readTransactions(),signatures=new Set(existing.map(signature)),additions=valid.filter((row)=>!signatures.has(signature(row)));
      if(!writeTransactions([...existing,...additions]))return;processRecurringTransactions();renderTransactions();alert(`Imported ${additions.length} transaction(s).${skipped?` Skipped ${skipped} invalid row(s).`:""}`);
    }catch(error){alert(`Could not import CSV: ${error.message}`);}finally{input.value="";}
  }
  function parseCsv(text){const rows=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(quoted&&ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=!quoted;else if(ch===","&&!quoted){row.push(cell);cell="";}else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell);rows.push(row);row=[];cell="";}else cell+=ch;}if(quoted)throw new Error("CSV contains an unclosed quoted field.");if(cell.length||row.length){row.push(cell);rows.push(row);}return rows;}
  function downloadCsv(){const rows=[["Type","Category","Description","Amount","Date","Recurring","Frequency"],...readTransactions().map((row)=>[row.type,row.category,row.description,row.amount.toFixed(2),row.date,row.recurring,row.frequency])];const csv=rows.map((row)=>row.map(escapeCsv).join(",")).join("\r\n");const url=URL.createObjectURL(new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="baonbuddy-transactions.csv";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function escapeCsv(value){const text=String(value??"");return /[",\n\r]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}
  function signature(row){return [row.type,row.category.toLowerCase(),row.description.toLowerCase(),row.amount,row.date].join("|");}
  function createId(){return window.crypto?.randomUUID?.()||`tx-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
  function todayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
  function formatMoney(value){return new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0);}
  function formatCompactMoney(value){return new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",notation:"compact",maximumFractionDigits:1}).format(Number(value)||0);}
  function formatDate(value){const date=new Date(`${value}T00:00:00`);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat("en-PH",{year:"numeric",month:"short",day:"numeric"}).format(date);}
  function setText(id,value){const node=$(id);if(node)node.textContent=value;}
})();
