const STORAGE_KEY = "money-manager.entries.v1";
const today = new Date().toISOString().slice(0, 10);
const page = document.body.dataset.page;

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

const monthKey = (value) => value.slice(0, 7);

const daysInMonth = (month) => {
  const [year, monthPart] = month.split("-").map(Number);
  return new Date(year, monthPart, 0).getDate();
};

const getSortedMonthKeys = () => {
  const keys = new Set(readEntries().map((entry) => monthKey(entry.date)));
  keys.add(monthKey(today));
  return Array.from(keys).sort((a, b) => (a < b ? 1 : -1));
};

const getMonthLabel = (key) => {
  const [year, month] = key.split("-");
  return `${year}年${Number(month)}月`;
};

const getViewMonth = () => {
  const urlMonth = new URLSearchParams(window.location.search).get("month");
  return urlMonth || monthKey(today);
};

const setViewMonth = (month) => {
  const url = new URL(window.location.href);
  url.searchParams.set("month", month);
  window.location.href = url.toString();
};

const getAdjacentMonth = (month, direction) => {
  const [year, monthPart] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthPart - 1 + direction, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const entriesForMonth = (month) =>
  readEntries()
    .filter((entry) => monthKey(entry.date) === month)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1));

const formatDate = (value) =>
  new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${value}T00:00:00`));

const updateSummary = (month) => {
  const entries = entriesForMonth(month);
  const income = entries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0);
  const expense = entries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0);
  const incomeTotal = document.getElementById("incomeTotal");
  const expenseTotal = document.getElementById("expenseTotal");
  const balanceTotal = document.getElementById("balanceTotal");
  if (incomeTotal) incomeTotal.textContent = formatMoney(income);
  if (expenseTotal) expenseTotal.textContent = formatMoney(expense);
  if (balanceTotal) balanceTotal.textContent = formatMoney(income - expense);
};

const renderMonthlyChart = (month) => {
  const chart = document.getElementById("monthlyChart");
  if (!chart) return;

  const totalDays = daysInMonth(month);
  const entries = entriesForMonth(month);
  const daily = Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const dayEntries = entries.filter((entry) => entry.date === date);
    const income = dayEntries.filter((entry) => entry.type === "income").reduce((sum, entry) => sum + entry.amount, 0);
    const expense = dayEntries.filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + entry.amount, 0);
    return { day, income, expense, balance: income - expense };
  });

  const width = 640;
  const height = 240;
  const padding = { top: 20, right: 16, bottom: 34, left: 60 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const values = daily.map((point) => point.balance);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = Math.max(maxValue - minValue, 1);

  const xForDay = (day) => padding.left + ((day - 1) / Math.max(totalDays - 1, 1)) * innerWidth;
  const yForValue = (value) => padding.top + ((maxValue - value) / range) * innerHeight;
  const points = daily.map((point) => `${xForDay(point.day)},${yForValue(point.balance)}`).join(" ");
  const areaPoints = [
    `${padding.left},${padding.top + innerHeight}`,
    ...daily.map((point) => `${xForDay(point.day)},${yForValue(point.balance)}`),
    `${padding.left + innerWidth},${padding.top + innerHeight}`,
  ].join(" ");
  const zeroY = yForValue(0);

  const ticks = [minValue, 0, maxValue]
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort((a, b) => b - a)
    .map(
      (value) => `
        <line x1="${padding.left}" x2="${padding.left + innerWidth}" y1="${yForValue(value)}" y2="${yForValue(value)}" class="chart-gridline"></line>
        <text x="${padding.left - 10}" y="${yForValue(value) + 4}" text-anchor="end" class="chart-axis-label">${formatMoney(value)}</text>
      `,
    )
    .join("");

  const dayTicks = daily
    .filter((point) => point.day === 1 || point.day === totalDays || point.day % 7 === 0)
    .map(
      (point) => `
        <text x="${xForDay(point.day)}" y="${height - 10}" text-anchor="middle" class="chart-axis-label">${point.day}</text>
      `,
    )
    .join("");

  const dots = daily
    .map(
      (point) => `
        <circle cx="${xForDay(point.day)}" cy="${yForValue(point.balance)}" r="3.5" class="chart-dot"></circle>
      `,
    )
    .join("");

  chart.innerHTML = `
    <div class="chart-legend">
      <span><i class="legend-swatch balance"></i> 日別残高</span>
      <span><i class="legend-swatch income"></i> 収入</span>
      <span><i class="legend-swatch expense"></i> 支出</span>
    </div>
    <svg viewBox="0 0 ${width} ${height}" class="line-chart" role="img" aria-label="月内の日別残高推移">
      <line x1="${padding.left}" x2="${padding.left + innerWidth}" y1="${zeroY}" y2="${zeroY}" class="chart-baseline"></line>
      ${ticks}
      <polyline points="${areaPoints}" class="chart-area"></polyline>
      <polyline points="${points}" class="chart-line"></polyline>
      ${dots}
      ${dayTicks}
    </svg>
  `;
};

const renderDataPage = () => {
  const entryList = document.getElementById("entryList");
  const emptyState = document.getElementById("emptyState");
  const exportButton = document.getElementById("exportButton");
  const prevMonthButton = document.getElementById("prevMonthButton");
  const currentMonthButton = document.getElementById("currentMonthButton");
  const nextMonthButton = document.getElementById("nextMonthButton");
  const monthLabel = document.getElementById("monthLabel");
  const daySummaryList = document.getElementById("daySummaryList");
  const monthlyChart = document.getElementById("monthlyChart");
  if (!entryList || !emptyState || !exportButton || !prevMonthButton || !currentMonthButton || !nextMonthButton || !monthLabel || !daySummaryList || !monthlyChart) return;

  const months = getSortedMonthKeys();
  const activeMonth = months.includes(getViewMonth()) ? getViewMonth() : months[0];

  monthLabel.textContent = `表示中: ${getMonthLabel(activeMonth)}`;

  const renderDaySummaries = (entries) => {
    daySummaryList.innerHTML = "";
    const grouped = new Map();
    for (const entry of entries) {
      const key = entry.date;
      const bucket = grouped.get(key) || { income: 0, expense: 0 };
      bucket[entry.type] += entry.amount;
      grouped.set(key, bucket);
    }

    const days = Array.from(grouped.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    for (const [date, totals] of days) {
      const row = document.createElement("div");
      row.className = "day-summary";
      row.innerHTML = `
        <div>
          <div class="day-summary-date">${formatDate(date)}</div>
          <div class="day-summary-meta">入金 ${formatMoney(totals.income)} / 出金 ${formatMoney(totals.expense)}</div>
        </div>
        <div class="day-summary-balance">${formatMoney(totals.income - totals.expense)}</div>
      `;
      daySummaryList.append(row);
    }
  };

  const render = () => {
    const entries = entriesForMonth(activeMonth);
    entryList.innerHTML = "";
    emptyState.hidden = entries.length > 0;
    updateSummary(activeMonth);
    renderMonthlyChart(activeMonth);
    renderDaySummaries(entries);

    for (const entry of entries) {
      const li = document.createElement("li");
      li.className = "entry-item";

      const meta = document.createElement("div");
      meta.className = "entry-meta";

      const title = document.createElement("div");
      title.className = "entry-title";
      const badge = document.createElement("span");
      badge.className = `badge ${entry.type === "expense" ? "expense" : ""}`;
      badge.textContent = entry.type === "income" ? "入金" : "出金";

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
        window.location.reload();
      });
      actions.append(deleteButton);

      li.append(meta, actions);
      entryList.append(li);
    }
  };

  prevMonthButton.addEventListener("click", () => {
    setViewMonth(getAdjacentMonth(activeMonth, -1));
  });
  currentMonthButton.addEventListener("click", () => {
    setViewMonth(monthKey(today));
  });
  nextMonthButton.addEventListener("click", () => {
    setViewMonth(getAdjacentMonth(activeMonth, 1));
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

  render();
};

const renderEntryPage = () => {
  const form = document.getElementById("entryForm");
  const amountInput = document.getElementById("amount");
  const dateInput = document.getElementById("entryDate");
  const noteInput = document.getElementById("note");
  const clearAllButton = document.getElementById("clearAllButton");
  if (!form || !amountInput || !dateInput || !noteInput || !clearAllButton) return;

  dateInput.value = today;
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

    writeEntries([nextEntry, ...readEntries()]);
    window.location.href = "./data.html?month=" + monthKey(date);
  });

  clearAllButton.addEventListener("click", () => {
    if (!confirm("すべての登録データを削除します。よろしいですか？")) return;
    writeEntries([]);
  });
};

if (page === "entry") {
  renderEntryPage();
}

if (page === "data") {
  renderDataPage();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
