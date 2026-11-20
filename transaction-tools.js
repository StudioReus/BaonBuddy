(() => {
  const STORAGE_KEY = "budget-transactions";
  const UNDO_KEY = "baonbuddy-transaction-undo";
  const CATEGORIES = ["Food", "Transport", "School", "Bills", "Shopping", "Health", "Entertainment", "Savings", "Allowance", "Other"];
  let editingId = null;
  let undoTimer = null;

  // The original app normalizes transactions on every page load. Preserve the newer
  // transaction metadata when its legacy localStorage writer rewrites the same IDs.
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (key === STORAGE_KEY) {
      try {
        const oldRows = JSON.parse(this.getItem(key) || "[]");
        const newRows = JSON.parse(value);
        if (Array.isArray(oldRows) && Array.isArray(newRows)) {
          const oldById = new Map(oldRows.map((row) => [row.id, row]));
          value = JSON.stringify(newRows.map((row) => {
            const old = oldById.get(row.id);
            if (!old) return row;
            const preserved = { ...old, ...row };
            for (const field of ["description", "occurrenceKey", "recurrenceId", "nextOccurrence"]) {
              if (!(field in row) && field in old) preserved[field] = old[field];
            }
            return preserved;
          }));
        }
      } catch { /* Leave malformed or unavailable storage to the app's own recovery. */ }
    }
    return originalSetItem.call(this, key, value);
  };

  document.addEventListener("DOMContentLoaded", init, { once: true });

  function init() {
    const form = document.getElementById("transaction-form");
    const list = document.getElementById("transaction-list");
    if (!form || !list) return;
    addStyles();
    setupCategories();
    setupFilters();
    setupSummary();
    setupImportExport();
    setupEditing();
    processRecurringTransactions();
    renderTransactions();
    updateSummary();
  }

  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .transaction-tools { display:grid; gap:9px; margin:0 0 14px; }
      .transaction-tools input,.transaction-tools select,.summary-controls input,.summary-controls select { min-width:0; min-height:40px; padding:8px 10px; border:1px solid #eee2d8; border-radius:10px; background:#fffdfa; color:#3d2a24; }
      .filter-row,.summary-controls { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .filter-row > * { flex:1 1 105px; }
      #transaction-search { width:100%; }
      .form-actions { display:flex; grid-column:1/-1; gap:9px; }
      .form-actions .primary-button { flex:1; }
      .form-actions .secondary-button { cursor:pointer; }
      .transaction-actions { display:flex; flex:0 0 auto; gap:4px; }
      .edit-button,.delete-button { min-width:30px; min-height:30px; border:0; border-radius:8px; background:#fff7e9; color:#85550d; cursor:pointer; font-weight:800; }
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
      .category-breakdown { display:grid; gap:6px; margin:0; padding:0; list-style:none; }
      .category-breakdown li { display:flex; justify-content:space-between; gap:10px; padding:8px 10px; border-radius:9px; background:#fff8f0; font-size:.82rem; }
      .undo-toast { position:fixed; z-index:200; right:18px; bottom:18px; display:flex; align-items:center; gap:12px; max-width:calc(100% - 36px); padding:12px 15px; border:1px solid #f0e5dc; border-radius:13px; background:#fff; box-shadow:0 10px 35px #3d2a2430; font-size:.84rem; }
      .undo-toast button { border:0; background:transparent; color:#a9521d; cursor:pointer; font-weight:900; }
      .history #transaction-list { max-height:520px; }
      @media(max-width:600px) { .summary-cards { grid-template-columns:repeat(2,minmax(0,1fr)); } .filter-row > * { flex-basis:calc(50% - 8px); } .form-actions { flex-wrap:wrap; } }
    `;
    document.head.appendChild(style);
  }

  function setupCategories() {
    const select = document.getElementById("transaction-category");
    const customField = document.getElementById("custom-category-field");
    const customInput = document.getElementById("custom-category");
    const description = document.getElementById("category");
    if (description) {
      const label = document.querySelector('label[for="category"]');
      if (label) label.textContent = "Description";
      description.placeholder = "Lunch, weekly allowance…";
    }
    const updateCustom = () => {
      const custom = select.value === "Other";
      customField.hidden = !custom;
      customInput.required = custom;
    };
    select.addEventListener("change", updateCustom);
    updateCustom();
    addExistingCategories();
  }

  function addExistingCategories() {
    const filter = document.getElementById("category-filter");
    const current = filter.value || "all";
    const categories = [...new Set(readTransactions().map((row) => row.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    filter.replaceChildren(new Option("All categories", "all"), ...categories.map((category) => new Option(category, category)));
    filter.value = categories.includes(current) ? current : "all";
  }

  function setupFilters() {
    ["transaction-search", "type-filter", "category-filter", "sort-order", "date-from", "date-to"].forEach((id) => {
      document.getElementById(id).addEventListener("input", renderTransactions);
      document.getElementById(id).addEventListener("change", renderTransactions);
    });
  }

  function setupSummary() {
    const date = document.getElementById("summary-date");
    date.value = date.value || todayKey();
    document.getElementById("summary-period").addEventListener("change", updateSummary);
    date.addEventListener("change", updateSummary);
  }

  function setupImportExport() {
    document.getElementById("download-csv").addEventListener("click", downloadCsv);
    document.getElementById("import-csv").addEventListener("change", importCsv);
  }

  function setupEditing() {
    const form = document.getElementById("transaction-form");
    // Capture before the original form listener so edit/add behavior is handled once.
    form.addEventListener("submit", submitTransaction, true);
    document.getElementById("cancel-edit").addEventListener("click", cancelEdit);
  }

  function readTransactions() {
    try {
      const rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(rows) ? rows.map(normalize).filter(Boolean) : [];
    } catch { return []; }
  }

  function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    const date = String(raw.date || "");
    const category = String(raw.category || "Other").trim();
    const amount = Number(raw.amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !category || !Number.isFinite(amount) || amount <= 0) return null;
    return { ...raw, id: String(raw.id || createId()), type: raw.type === "income" ? "income" : "expense", category, description: String(raw.description || ""), amount, date, recurring: raw.recurring === true, frequency: ["weekly", "monthly", "yearly"].includes(raw.frequency) ? raw.frequency : "monthly" };
  }

  function writeTransactions(rows) {
    const normalized = rows.map(normalize).filter(Boolean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    addExistingCategories();
    return normalized;
  }

  function submitTransaction(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = document.getElementById("transaction-form");
    if (!form.reportValidity()) return;
    const chosen = document.getElementById("transaction-category").value;
    const category = chosen === "Other" ? document.getElementById("custom-category").value.trim() : chosen;
    const amount = Number(document.getElementById("amount").value);
    const date = document.getElementById("date").value;
    const description = document.getElementById("category").value.trim();
    if (!category || !Number.isFinite(amount) || amount <= 0 || !date) return;
    const all = readTransactions();
    const existing = editingId ? all.find((row) => row.id === editingId) : null;
    const row = { ...(existing || {}), id: editingId || createId(), type: document.getElementById("type").value, category, description, amount, date, recurring: Boolean(document.getElementById("is-recurring").checked), frequency: document.getElementById("frequency").value || "monthly" };
    if (row.recurring && !row.nextOccurrence) row.nextOccurrence = nextDate(date, row.frequency);
    const updated = existing ? all.map((item) => item.id === editingId ? row : item) : [...all, row];
    if (!writeTransactions(updated)) return;
    const wasEditing = Boolean(editingId);
    cancelEdit();
    form.reset();
    document.getElementById("date").value = todayKey();
    document.getElementById("recurring-options").classList.add("hidden");
    document.getElementById("custom-category-field").hidden = true;
    document.getElementById("custom-category").required = false;
    renderTransactions();
    if (!wasEditing && typeof completeQuest === "function") completeQuest("daily", "log-transaction");
    document.getElementById("category").focus();
  }

  function startEdit(id) {
    const row = readTransactions().find((item) => item.id === id);
    if (!row) return;
    editingId = id;
    document.getElementById("add-title").textContent = "Edit transaction";
    document.getElementById("transaction-submit").textContent = "Save changes";
    document.getElementById("cancel-edit").hidden = false;
    document.getElementById("type").value = row.type;
    const categorySelect = document.getElementById("transaction-category");
    const isStandard = [...categorySelect.options].some((option) => option.value === row.category);
    categorySelect.value = isStandard ? row.category : "Other";
    if (!isStandard) {
      document.getElementById("custom-category-field").hidden = false;
      document.getElementById("custom-category").required = true;
      document.getElementById("custom-category").value = row.category;
    }
    document.getElementById("category").value = row.description || "";
    document.getElementById("amount").value = row.amount;
    document.getElementById("date").value = row.date;
    document.getElementById("is-recurring").checked = row.recurring;
    document.getElementById("recurring-options").classList.toggle("hidden", !row.recurring);
    document.getElementById("frequency").value = row.frequency || "monthly";
    document.getElementById("add-title").scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("transaction-category").focus();
  }

  function cancelEdit() {
    editingId = null;
    const form = document.getElementById("transaction-form");
    if (form) form.reset();
    const title = document.getElementById("add-title");
    if (title) title.textContent = "Add a transaction";
    const submit = document.getElementById("transaction-submit");
    if (submit) submit.textContent = "Save transaction →";
    const cancel = document.getElementById("cancel-edit");
    if (cancel) cancel.hidden = true;
    const customField = document.getElementById("custom-category-field");
    if (customField) customField.hidden = true;
    const customInput = document.getElementById("custom-category");
    if (customInput) customInput.required = false;
    const recurringOptions = document.getElementById("recurring-options");
    if (recurringOptions) recurringOptions.classList.add("hidden");
  }

  function renderTransactions() {
    const list = document.getElementById("transaction-list");
    if (!list) return;
    const query = document.getElementById("transaction-search").value.trim().toLocaleLowerCase();
    const type = document.getElementById("type-filter").value;
    const category = document.getElementById("category-filter").value;
    const from = document.getElementById("date-from").value;
    const to = document.getElementById("date-to").value;
    const direction = document.getElementById("sort-order").value;
    const rows = readTransactions().filter((row) => {
      const haystack = `${row.category} ${row.description} ${row.type}`.toLocaleLowerCase();
      return (!query || haystack.includes(query)) && (type === "all" || row.type === type) && (category === "all" || row.category === category) && (!from || row.date >= from) && (!to || row.date <= to);
    }).sort((a, b) => direction === "oldest" ? a.date.localeCompare(b.date) || a.id.localeCompare(b.id) : b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    list.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = readTransactions().length ? "No transactions match these filters." : "No transactions yet — add one to get started.";
      list.appendChild(empty);
    } else rows.forEach((row) => list.appendChild(createItem(row)));
    updateSummary();
  }

  function createItem(row) {
    const item = document.createElement("li");
    item.className = "transaction-item";
    const icon = document.createElement("span");
    icon.className = `transaction-icon ${row.type}`;
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = row.type === "income" ? "↗" : "−";
    const details = document.createElement("div");
    details.className = "transaction-details";
    const category = document.createElement("span");
    category.className = "transaction-category";
    category.textContent = row.description || row.category;
    const tag = document.createElement("span");
    tag.className = "transaction-tag";
    tag.textContent = row.category;
    const meta = document.createElement("small");
    meta.className = "transaction-date";
    meta.textContent = `${formatDate(row.date)}${row.recurring ? ` · Repeats ${row.frequency}` : row.recurrenceId ? " · Recurring entry" : ""}`;
    details.append(category, tag, meta);
    const amount = document.createElement("span");
    amount.className = `amount ${row.type}`;
    amount.textContent = `${row.type === "income" ? "+" : "−"}${formatMoney(row.amount)}`;
    const actions = document.createElement("div");
    actions.className = "transaction-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "edit-button";
    edit.textContent = "Edit";
    edit.setAttribute("aria-label", `Edit ${row.description || row.category}`);
    edit.addEventListener("click", () => startEdit(row.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Delete ${row.description || row.category}`);
    remove.addEventListener("click", () => deleteTransaction(row.id));
    actions.append(edit, remove);
    item.append(icon, details, amount, actions);
    return item;
  }

  function deleteTransaction(id) {
    const all = readTransactions();
    const row = all.find((item) => item.id === id);
    if (!row) return;
    writeTransactions(all.filter((item) => item.id !== id));
    localStorage.setItem(UNDO_KEY, JSON.stringify({ row, expiresAt: Date.now() + 10000 }));
    showUndo(row);
    renderTransactions();
  }

  function showUndo(row) {
    document.querySelector(".undo-toast")?.remove();
    clearTimeout(undoTimer);
    const toast = document.createElement("div");
    toast.className = "undo-toast";
    toast.setAttribute("role", "status");
    const message = document.createElement("span");
    message.textContent = `Deleted ${row.description || row.category}.`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Undo";
    button.addEventListener("click", () => {
      try {
        const saved = JSON.parse(localStorage.getItem(UNDO_KEY) || "null");
        if (!saved || saved.expiresAt < Date.now()) return toast.remove();
        writeTransactions([...readTransactions(), saved.row]);
        localStorage.removeItem(UNDO_KEY);
        toast.remove();
        renderTransactions();
      } catch { toast.remove(); }
    });
    toast.append(message, button);
    document.body.appendChild(toast);
    undoTimer = setTimeout(() => { toast.remove(); localStorage.removeItem(UNDO_KEY); }, 10000);
  }

  function updateSummary() {
    const rows = readTransactions();
    const income = rows.filter((row) => row.type === "income").reduce((sum, row) => sum + row.amount, 0);
    const expenses = rows.filter((row) => row.type === "expense").reduce((sum, row) => sum + row.amount, 0);
    setText("total-income", formatMoney(income));
    setText("total-expenses", formatMoney(expenses));
    setText("remaining-balance", formatMoney(income - expenses));
    const balance = document.getElementById("remaining-balance");
    if (balance) balance.classList.toggle("negative", income - expenses < 0);
    updatePeriodSummary(rows);
  }

  function updatePeriodSummary(rows) {
    const period = document.getElementById("summary-period")?.value || "month";
    const anchor = document.getElementById("summary-date")?.value || todayKey();
    const [year, month, day] = anchor.split("-").map(Number);
    let start = new Date(year, month - 1, day);
    let end = new Date(year, month - 1, day);
    if (period === "week") {
      const weekday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - weekday);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else if (period === "month") {
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 0);
    }
    const startKey = todayKey(start);
    const endKey = todayKey(end);
    const matching = rows.filter((row) => row.date >= startKey && row.date <= endKey);
    const income = matching.filter((row) => row.type === "income").reduce((sum, row) => sum + row.amount, 0);
    const expenses = matching.filter((row) => row.type === "expense").reduce((sum, row) => sum + row.amount, 0);
    setText("period-income", formatMoney(income));
    setText("period-expenses", formatMoney(expenses));
    setText("period-net", formatMoney(income - expenses));
    setText("period-count", String(matching.length));
    const periodLabel = period === "day" ? formatDate(startKey) : `${formatDate(startKey)} – ${formatDate(endKey)}`;
    setText("summary-period-label", `${period[0].toUpperCase()}${period.slice(1)}: ${periodLabel}`);
    const totals = new Map();
    matching.filter((row) => row.type === "expense").forEach((row) => totals.set(row.category, (totals.get(row.category) || 0) + row.amount));
    const breakdown = document.getElementById("category-breakdown");
    breakdown.replaceChildren();
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    if (!sorted.length) {
      const empty = document.createElement("li");
      empty.textContent = "No spending in this period.";
      breakdown.appendChild(empty);
    } else sorted.forEach(([name, amount]) => {
      const li = document.createElement("li");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      label.textContent = name;
      value.textContent = formatMoney(amount);
      li.append(label, value);
      breakdown.appendChild(li);
    });
  }

  function processRecurringTransactions() {
    const rows = readTransactions();
    const today = todayKey();
    let changed = false;
    const templates = rows.filter((row) => row.recurring);
    templates.forEach((template) => {
      let due = template.nextOccurrence || nextDate(template.date, template.frequency);
      let guard = 0;
      while (due <= today && guard++ < 1200) {
        const occurrenceKey = `${template.id}:${due}`;
        if (!rows.some((row) => row.occurrenceKey === occurrenceKey)) {
          rows.push({ id: createId(), type: template.type, category: template.category, description: template.description || "", amount: template.amount, date: due, recurring: false, frequency: template.frequency, recurrenceId: template.id, occurrenceKey });
        }
        due = nextDate(due, template.frequency);
        changed = true;
      }
      if (template.nextOccurrence !== due) {
        template.nextOccurrence = due;
        changed = true;
      }
    });
    if (changed) writeTransactions(rows);
  }

  function nextDate(dateString, frequency) {
    const [year, month, day] = dateString.split("-").map(Number);
    let yearOut = year;
    let monthOut = month - 1;
    if (frequency === "weekly") {
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + 7);
      return todayKey(date);
    }
    if (frequency === "monthly") monthOut += 1;
    else yearOut += 1;
    const lastDay = new Date(yearOut, monthOut + 1, 0).getDate();
    return todayKey(new Date(yearOut, monthOut, Math.min(day, lastDay)));
  }

  async function importCsv(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const matrix = parseCsv(text.replace(/^\uFEFF/, ""));
      if (matrix.length < 2) throw new Error("The CSV has no transaction rows.");
      const headers = matrix[0].map((header) => header.trim().toLowerCase());
      const index = (name) => headers.indexOf(name);
      if (["type", "amount", "date"].some((name) => index(name) < 0) || (index("category") < 0 && index("description") < 0)) throw new Error("CSV must include Type, Category (or Description), Amount, and Date columns.");
      const valid = [];
      let skipped = 0;
      matrix.slice(1).forEach((cells) => {
        if (!cells.some((cell) => cell.trim())) return;
        const description = index("description") >= 0 ? cells[index("description")]?.trim() || "" : "";
        const rawCategory = index("category") >= 0 ? cells[index("category")]?.trim() : "";
        const category = rawCategory || description || "Other";
        const row = normalize({ id: createId(), type: cells[index("type")]?.trim().toLowerCase(), category, description, amount: cells[index("amount")]?.trim(), date: cells[index("date")]?.trim(), recurring: ["yes", "true", "1"].includes((cells[index("recurring")] || "").trim().toLowerCase()), frequency: cells[index("frequency")]?.trim().toLowerCase() || "monthly" });
        if (row) valid.push(row); else skipped++;
      });
      if (!valid.length) throw new Error("No valid transactions were found.");
      if (!window.confirm(`Import ${valid.length} transactions? Existing records will be kept. ${skipped ? `${skipped} invalid row(s) will be skipped.` : ""}`)) return;
      const existing = readTransactions();
      const signatures = new Set(existing.map(signature));
      const additions = valid.filter((row) => !signatures.has(signature(row)));
      writeTransactions([...existing, ...additions]);
      processRecurringTransactions();
      renderTransactions();
      alert(`Imported ${additions.length} transaction(s).${skipped ? ` Skipped ${skipped} invalid row(s).` : ""}`);
    } catch (error) {
      alert(`Could not import CSV: ${error.message}`);
    } finally { input.value = ""; }
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted && char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { row.push(cell); cell = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += char;
    }
    if (quoted) throw new Error("CSV contains an unclosed quoted field.");
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function downloadCsv() {
    const rows = [["Type", "Category", "Description", "Amount", "Date", "Recurring", "Frequency"], ...readTransactions().map((row) => [row.type, row.category, row.description || "", row.amount.toFixed(2), row.date, row.recurring ? "Yes" : "No", row.recurring ? row.frequency : ""])];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "baonbuddy-transactions.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function escapeCsv(value) {
    const text = String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
  function signature(row) { return [row.type, row.category.toLowerCase(), row.description.toLowerCase(), row.amount, row.date].join("|"); }
  function createId() { return window.crypto?.randomUUID?.() || `tx-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function todayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
  function formatMoney(value) { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0); }
  function formatDate(value) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric" }).format(date); }
  function setText(id, value) { const node = document.getElementById(id); if (node) node.textContent = value; }
})();
