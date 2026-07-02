const STORAGE_KEY = "money-manager.entries.v1";

const form = document.getElementById("entryForm");
const amountInput = document.getElementById("amount");
const dateInput = document.getElementById("entryDate");
const noteInput = document.getElementById("note");
const entryList = document.getElementById("entryList");
const emptyState = document.getElementById("emptyState");
const incomeTotal = document.getElementById("incomeTotal");
const expenseTotal = document.getElementById("expenseTotal");
const balanceTotal = document.getElementById("balanceTotal");
const clearAllButton = document.getElementById("clearAllButton");
const exportButton = document.getElementById("exportButton");

const today = new Date().toISOString().slice(0, 10);
dateInput.value = today;

const readEntries = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeEntries = (entries) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
};

const formatMoney = (value) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);

const formatDate = (value) => new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${value}T00:00:00`));

const monthKey = (value) => value.slice(0, 7);
const currentMonth = () => monthKey(today);

const entriesForView = () =>
  readEntries()
    .filter((entry) => monthKey(entry.date) === currentMonth())
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt < b.createdAt ? 1 : -1));

const updateSummary = (entries) => {
  const income = entries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const expense = entries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0);
  incomeTotal.textContent = formatMoney(income);
  expenseTotal.textContent = formatMoney(expense);
  balanceTotal.textContent = formatMoney(income - expense);
};

const renderEntries = () => {
  const entries = entriesForView();
  entryList.innerHTML = "";
  emptyState.hidden = entries.length > 0;

  for (const entry of entries) {
    const li = document.createElement("li");
    li.className = "entry-item";

    const meta = document.createElement("div");
    meta.className = "entry-meta";

    const title = document.createElement("div");
    title.className = "entry-title";
    const badge = document.createElement("span");
    badge.className = `badge ${entry.type === "expense" ? "expense" : ""}`;
    badge.textContent = entry.type === "income" ? "出金" : "支出";

    const amount = document.createElement("div");
    amount.className = "entry-amount";
    amount.textContent = `${entry.type === "expense" ? "-" : "+"}${formatMoney(entry.amount)}`;

    const note = document.createElement("div");
    note.className = "entry-note";
    note.textContent = entry.note || "メモなし";

    const date = document.createElement("div");
    date.className = "entry-date";
    date.textContent = formatDate(entry.date);

    title.append(badge, amount);
    meta.append(title, note, date);

    const actions = document.createElement("div");
    actions.className = "entry-actions";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "secondary";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => {
      const nextEntries = readEntries().filter((item) => item.id !== entry.id);
      writeEntries(nextEntries);
      render();
    });
    actions.append(deleteButton);

    li.append(meta, actions);
    entryList.append(li);
  }

  updateSummary(entries);
};

const render = () => renderEntries();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number(amountInput.value);
  const date = dateInput.value;
  const note = noteInput.value.trim();
  const type = form.entryType.value;

  if (!Number.isFinite(amount) || amount <= 0 || !date) return;

  const nextEntry = {
    id: crypto.randomUUID(),
    type,
    amount: Math.round(amount),
    date,
    note,
    createdAt: new Date().toISOString(),
  };

  const nextEntries = [nextEntry, ...readEntries()];
  writeEntries(nextEntries);
  form.reset();
  form.entryType.value = "income";
  dateInput.value = today;
  amountInput.focus();
  render();
});

clearAllButton.addEventListener("click", () => {
  if (!confirm("すべての記録を削除しますか？")) return;
  writeEntries([]);
  render();
});

exportButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(readEntries(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `money-manager-${today}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

render();
