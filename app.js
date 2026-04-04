// app.js - main logic for the finance dashboard

let state = {
  transactions: [],
  role: "viewer",
  theme: "dark",
  activePage: "dashboard",
  filters: {
    search: "",
    type: "all",
    category: "all",
    sort: "date-desc",
  },
  nextId: 100,
  pendingDeleteId: null,
};

// chart instances - need to keep track so we can destroy before redrawing
let lineChart = null;
let donutChart = null;
let barChart = null;

// localStorage stuff
function saveData() {
  localStorage.setItem("finflow_txns", JSON.stringify(state.transactions));
  localStorage.setItem("finflow_id", String(state.nextId));
  localStorage.setItem("finflow_theme", state.theme);
  localStorage.setItem("finflow_role", state.role);
}

function loadData() {
  const saved = localStorage.getItem("finflow_txns");
  const savedId = localStorage.getItem("finflow_id");
  const savedTheme = localStorage.getItem("finflow_theme");
  const savedRole = localStorage.getItem("finflow_role");

  state.transactions = saved ? JSON.parse(saved) : [...DEFAULT_TRANSACTIONS];
  state.nextId = savedId ? parseInt(savedId) : 100;
  state.theme = savedTheme || "dark";
  state.role = savedRole || "viewer";
}

// helpers
function toINR(amount) {
  return (
    "₹" +
    Number(amount).toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

function niceDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function monthLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function newId() {
  return state.nextId++;
}

// returns filtered + sorted list based on current filter state
function getFiltered() {
  let list = [...state.transactions];

  if (state.filters.search) {
    const q = state.filters.search.toLowerCase();
    list = list.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }

  if (state.filters.type !== "all") {
    list = list.filter((t) => t.type === state.filters.type);
  }

  if (state.filters.category !== "all") {
    list = list.filter((t) => t.category === state.filters.category);
  }

  switch (state.filters.sort) {
    case "date-desc":
      list.sort((a, b) => b.date.localeCompare(a.date));
      break;
    case "date-asc":
      list.sort((a, b) => a.date.localeCompare(b.date));
      break;
    case "amount-desc":
      list.sort((a, b) => b.amount - a.amount);
      break;
    case "amount-asc":
      list.sort((a, b) => a.amount - b.amount);
      break;
  }

  return list;
}

function getSummary() {
  const income = state.transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = state.transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const savingsRate =
    income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
  return { income, expense, balance, savingsRate };
}

// groups by month for charts
function getMonthlyData() {
  const grouped = {};

  state.transactions.forEach((t) => {
    const label = monthLabel(t.date);
    if (!grouped[label]) grouped[label] = { income: 0, expense: 0 };
    if (t.type === "income") grouped[label].income += t.amount;
    if (t.type === "expense") grouped[label].expense += t.amount;
  });

  // sort chronologically - bit of a hack but works fine
  const sorted = Object.entries(grouped).sort((a, b) => {
    return new Date("1 " + a[0]) - new Date("1 " + b[0]);
  });

  return sorted.map(([label, data]) => ({
    label,
    income: data.income,
    expense: data.expense,
    net: data.income - data.expense,
  }));
}

// spending by category (expenses only)
function getCatSpending() {
  const cats = {};
  state.transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      cats[t.category] = (cats[t.category] || 0) + t.amount;
    });
  return Object.entries(cats).sort((a, b) => b[1] - a[1]);
}

function getInsightData() {
  const monthly = getMonthlyData();
  const catData = getCatSpending();
  const topCat = catData.length ? catData[0] : ["N/A", 0];

  const curMonth = monthly[monthly.length - 1] || {
    expense: 0,
    income: 0,
    net: 0,
    label: "—",
  };
  const prevMonth = monthly[monthly.length - 2] || {
    expense: 0,
    income: 0,
    net: 0,
    label: "—",
  };

  const expenseDiff = curMonth.expense - prevMonth.expense;
  const incomeDiff = curMonth.income - prevMonth.income;

  // average daily spend
  const expenses = state.transactions.filter((t) => t.type === "expense");
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  let avgDaily = 0;
  if (expenses.length > 1) {
    const dates = expenses.map((t) => new Date(t.date));
    const daysDiff =
      Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000) + 1;
    avgDaily = Math.round(totalExp / daysDiff);
  } else {
    avgDaily = totalExp;
  }

  const curSavings =
    curMonth.income > 0
      ? Math.round(
          ((curMonth.income - curMonth.expense) / curMonth.income) * 100,
        )
      : 0;

  return {
    topCat,
    curMonth,
    prevMonth,
    expenseDiff,
    incomeDiff,
    avgDaily,
    curSavings,
  };
}

// render the 4 summary cards
function renderCards() {
  const { income, expense, balance, savingsRate } = getSummary();
  const el = document.getElementById("summary-cards");

  el.innerHTML = `
    <div class="sum-card balance">
      <div class="card-top">
        <span class="card-label">Total Balance</span>
        <div class="card-icon balance">💰</div>
      </div>
      <div class="card-value">${toINR(balance)}</div>
      <div class="card-meta">Net across all transactions</div>
    </div>
    <div class="sum-card income">
      <div class="card-top">
        <span class="card-label">Total Income</span>
        <div class="card-icon income">📥</div>
      </div>
      <div class="card-value income">${toINR(income)}</div>
      <div class="card-meta">All income sources</div>
    </div>
    <div class="sum-card expense">
      <div class="card-top">
        <span class="card-label">Total Expenses</span>
        <div class="card-icon expense">📤</div>
      </div>
      <div class="card-value expense">${toINR(expense)}</div>
      <div class="card-meta">All spending</div>
    </div>
    <div class="sum-card savings">
      <div class="card-top">
        <span class="card-label">Savings Rate</span>
        <div class="card-icon savings">🎯</div>
      </div>
      <div class="card-value">${savingsRate}%</div>
      <div class="card-meta">Of total income saved</div>
    </div>
  `;
}

// recent 5 transactions on the dashboard
function renderRecent() {
  const recent = [...state.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const el = document.getElementById("recent-list");

  if (!recent.length) {
    el.innerHTML =
      '<div class="empty-state"><div class="empty-emoji">💸</div><p>No transactions yet</p><span>Switch to Admin to add some</span></div>';
    return;
  }

  el.innerHTML = recent
    .map((t) => {
      const desc = document.createElement("div");
      desc.textContent = t.description;
      const safeDesc = desc.innerHTML;

      return `
      <div class="tx-item">
        <div class="tx-cat-icon">${catIcons[t.category] || "💳"}</div>
        <div class="tx-info">
          <div class="tx-desc">${safeDesc}</div>
          <div class="tx-meta">${niceDate(t.date)} · ${t.category}</div>
        </div>
        <div class="tx-amount ${t.type}">${t.type === "income" ? "+" : "-"}${toINR(t.amount)}</div>
      </div>
    `;
    })
    .join("");
}

// full transactions table
function renderTable() {
  const filtered = getFiltered();
  const tbody = document.getElementById("tx-body");
  const emptyMsg = document.getElementById("tx-empty");
  const table = document.getElementById("tx-table");
  const countEl = document.getElementById("tx-count");

  countEl.textContent = `${filtered.length} of ${state.transactions.length} transactions`;

  if (!filtered.length) {
    table.classList.add("hidden");
    emptyMsg.classList.remove("hidden");
    return;
  }

  table.classList.remove("hidden");
  emptyMsg.classList.add("hidden");

  const isAdmin = state.role === "admin";
  document.getElementById("col-actions").classList.toggle("hidden", !isAdmin);

  // using textContent approach to avoid any injection issues
  const rows = filtered.map((t) => {
    const tmpDesc = document.createElement("span");
    tmpDesc.textContent = t.description;

    return `
      <tr>
        <td class="td-date">${niceDate(t.date)}</td>
        <td class="td-desc">${tmpDesc.innerHTML}</td>
        <td><span class="cat-badge">${catIcons[t.category] || ""} ${t.category}</span></td>
        <td><span class="type-badge ${t.type}">${t.type}</span></td>
        <td class="td-amount ${t.type}">${t.type === "income" ? "+" : "-"}${toINR(t.amount)}</td>
        ${
          isAdmin
            ? `
        <td class="td-actions">
          <button class="btn-icon" onclick="openEdit(${t.id})">✏️</button>
          <button class="btn-icon del" onclick="openDeleteConfirm(${t.id})">🗑️</button>
        </td>`
            : '<td class="hidden"></td>'
        }
      </tr>
    `;
  });

  tbody.innerHTML = rows.join("");
}

function renderInsights() {
  const {
    topCat,
    curMonth,
    prevMonth,
    expenseDiff,
    incomeDiff,
    avgDaily,
    curSavings,
  } = getInsightData();
  const el = document.getElementById("insights-grid");

  const expTag =
    expenseDiff > 0
      ? `<span class="insight-tag down">↑ Spent ${toINR(Math.abs(expenseDiff))} more</span>`
      : `<span class="insight-tag up">↓ Saved ${toINR(Math.abs(expenseDiff))} more</span>`;

  const incTag =
    incomeDiff >= 0
      ? `<span class="insight-tag up">↑ ${toINR(Math.abs(incomeDiff))} vs last month</span>`
      : `<span class="insight-tag down">↓ ${toINR(Math.abs(incomeDiff))} vs last month</span>`;

  el.innerHTML = `
    <div class="insight-card">
      <div class="insight-label">🏆 Highest Spending Category</div>
      <div class="insight-value">${catIcons[topCat[0]] || ""} ${topCat[0]}</div>
      <div class="insight-sub">${toINR(topCat[1])} total spent</div>
      <span class="insight-tag neu">Top expense driver</span>
    </div>

    <div class="insight-card">
      <div class="insight-label">📅 This Month's Expenses (${curMonth.label})</div>
      <div class="insight-value">${toINR(curMonth.expense)}</div>
      <div class="insight-sub">Last month: ${toINR(prevMonth.expense)} (${prevMonth.label})</div>
      ${expTag}
    </div>

    <div class="insight-card">
      <div class="insight-label">💸 Average Daily Spend</div>
      <div class="insight-value">${toINR(avgDaily)}</div>
      <div class="insight-sub">Per day across all expenses</div>
      <span class="insight-tag neu">Based on all data</span>
    </div>

    <div class="insight-card">
      <div class="insight-label">📈 This Month's Income (${curMonth.label})</div>
      <div class="insight-value">${toINR(curMonth.income)}</div>
      <div class="insight-sub">Savings rate: ${curSavings}%</div>
      ${incTag}
    </div>
  `;
}

// chart colors depending on theme
function chartColors() {
  const dark = state.theme === "dark";
  return {
    grid: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    text: dark ? "#8899bb" : "#4a5568",
    tipBg: dark ? "#1a2235" : "#ffffff",
    cardBg: dark ? "#1a2235" : "#ffffff",
  };
}

function drawLineChart() {
  const monthly = getMonthlyData();
  const c = chartColors();
  const ctx = document.getElementById("lineChart").getContext("2d");

  if (lineChart) lineChart.destroy();

  lineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: monthly.map((m) => m.label),
      datasets: [
        {
          label: "Net Savings",
          data: monthly.map((m) => m.net),
          borderColor: "#06b6d4",
          backgroundColor: "rgba(6,182,212,0.1)",
          borderWidth: 2.5,
          pointBackgroundColor: "#06b6d4",
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.tipBg,
          borderColor: "rgba(6,182,212,0.4)",
          borderWidth: 1,
          titleColor: c.text,
          bodyColor: "#f0f4ff",
          padding: 12,
          callbacks: {
            label: (ctx) => " " + toINR(ctx.raw),
          },
        },
      },
      scales: {
        x: {
          grid: { color: c.grid },
          ticks: { color: c.text, font: { size: 11 } },
          border: { display: false },
        },
        y: {
          grid: { color: c.grid },
          ticks: {
            color: c.text,
            font: { size: 11 },
            callback: (v) => "₹" + (v / 1000).toFixed(0) + "k",
          },
          border: { display: false },
        },
      },
    },
  });
}

function drawDonutChart() {
  const cats = getCatSpending().slice(0, 6);
  const total = cats.reduce((s, [, v]) => s + v, 0);
  const c = chartColors();
  const ctx = document.getElementById("doughnutChart").getContext("2d");

  if (donutChart) donutChart.destroy();

  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: cats.map(([k]) => k),
      datasets: [
        {
          data: cats.map(([, v]) => v),
          backgroundColor: cats.map(([k]) => catColors[k] || "#64748b"),
          borderWidth: 2,
          borderColor: state.theme === "dark" ? "#1a2235" : "#ffffff",
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "68%",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.tipBg,
          borderWidth: 1,
          titleColor: c.text,
          bodyColor: "#f0f4ff",
          padding: 10,
          callbacks: {
            label: (ctx) =>
              `  ${toINR(ctx.raw)} (${Math.round((ctx.raw / total) * 100)}%)`,
          },
        },
      },
    },
  });

  // custom legend below the chart
  const legendEl = document.getElementById("donut-legend");
  legendEl.innerHTML = cats
    .map(
      ([k, v]) => `
    <div class="legend-item">
      <div class="legend-left">
        <div class="legend-dot" style="background:${catColors[k] || "#64748b"}"></div>
        <span class="legend-name">${k}</span>
      </div>
      <span class="legend-pct">${Math.round((v / total) * 100)}%</span>
    </div>
  `,
    )
    .join("");
}

function drawBarChart() {
  const monthly = getMonthlyData();
  const c = chartColors();
  const ctx = document.getElementById("barChart").getContext("2d");

  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: monthly.map((m) => m.label),
      datasets: [
        {
          label: "Income",
          data: monthly.map((m) => m.income),
          backgroundColor: "rgba(16,185,129,0.7)",
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: "Expenses",
          data: monthly.map((m) => m.expense),
          backgroundColor: "rgba(244,63,94,0.7)",
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: c.text,
            font: { size: 12 },
            usePointStyle: true,
            pointStyleWidth: 8,
          },
        },
        tooltip: {
          backgroundColor: c.tipBg,
          borderWidth: 1,
          titleColor: c.text,
          bodyColor: "#f0f4ff",
          padding: 12,
          callbacks: {
            label: (ctx) => `  ${ctx.dataset.label}: ${toINR(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: c.text, font: { size: 11 } },
          border: { display: false },
        },
        y: {
          grid: { color: c.grid },
          ticks: {
            color: c.text,
            callback: (v) => "₹" + (v / 1000).toFixed(0) + "k",
          },
          border: { display: false },
        },
      },
    },
  });
}

// navigation between pages
const pageTitles = {
  dashboard: "Dashboard",
  transactions: "Transactions",
  insights: "Insights",
};

function goTo(page) {
  state.activePage = page;

  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");

  document.querySelectorAll(".nav-item, .mob-item").forEach((a) => {
    a.classList.toggle("active", a.dataset.page === page);
  });

  document.getElementById("page-title").textContent = pageTitles[page];

  if (page === "dashboard") {
    renderCards();
    renderRecent();
    drawLineChart();
    drawDonutChart();
  } else if (page === "transactions") {
    renderTable();
  } else if (page === "insights") {
    renderInsights();
    drawBarChart();
  }

  closeSidebar();
}

// role switching
function setRole(role) {
  state.role = role;
  const isAdmin = role === "admin";

  document.getElementById("add-tx-btn").classList.toggle("hidden", !isAdmin);
  document.getElementById("export-btn").classList.toggle("hidden", !isAdmin);
  document.getElementById("role-hint").textContent = isAdmin
    ? "Full access — can add & edit"
    : "Read-only access";

  if (state.activePage === "transactions") renderTable();
  saveData();
}

// theme toggle
function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);

  document
    .querySelector(".icon-moon")
    .classList.toggle("hidden", theme === "light");
  document
    .querySelector(".icon-sun")
    .classList.toggle("hidden", theme === "dark");

  // redraw charts so colors update
  if (state.activePage === "dashboard") {
    drawLineChart();
    drawDonutChart();
  } else if (state.activePage === "insights") {
    drawBarChart();
  }

  saveData();
}

// add/edit modal
function openModal() {
  document.getElementById("modal-heading").textContent = "Add Transaction";
  document.getElementById("edit-id").value = "";
  document.getElementById("form-desc").value = "";
  document.getElementById("form-amount").value = "";
  document.getElementById("form-type").value = "expense";
  document.getElementById("form-category").value = "Food & Dining";
  document.getElementById("form-date").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("form-error").classList.add("hidden");
  document.getElementById("modal-backdrop").classList.remove("hidden");
}

function openEdit(id) {
  const t = state.transactions.find((t) => t.id === id);
  if (!t) return;

  document.getElementById("modal-heading").textContent = "Edit Transaction";
  document.getElementById("edit-id").value = t.id;
  document.getElementById("form-desc").value = t.description;
  document.getElementById("form-amount").value = t.amount;
  document.getElementById("form-type").value = t.type;
  document.getElementById("form-category").value = t.category;
  document.getElementById("form-date").value = t.date;
  document.getElementById("form-error").classList.add("hidden");
  document.getElementById("modal-backdrop").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.add("hidden");
}

function saveTransaction() {
  const desc = document.getElementById("form-desc").value.trim();
  const amount = parseFloat(document.getElementById("form-amount").value);
  const type = document.getElementById("form-type").value;
  const category = document.getElementById("form-category").value;
  const date = document.getElementById("form-date").value;
  const editId = document.getElementById("edit-id").value;

  if (!desc || !amount || amount <= 0 || !date) {
    document.getElementById("form-error").classList.remove("hidden");
    return;
  }

  if (editId) {
    const idx = state.transactions.findIndex((t) => t.id === parseInt(editId));
    if (idx !== -1) {
      state.transactions[idx] = {
        id: parseInt(editId),
        date,
        description: desc,
        amount,
        category,
        type,
      };
    }
    showToast("Transaction updated ✓");
  } else {
    state.transactions.push({
      id: newId(),
      date,
      description: desc,
      amount,
      category,
      type,
    });
    showToast("Transaction added ✓");
  }

  closeModal();
  saveData();
  goTo(state.activePage);
}

// delete
function openDeleteConfirm(id) {
  state.pendingDeleteId = id;
  document.getElementById("confirm-backdrop").classList.remove("hidden");
}

function closeDeleteConfirm() {
  state.pendingDeleteId = null;
  document.getElementById("confirm-backdrop").classList.add("hidden");
}

function confirmDelete() {
  if (!state.pendingDeleteId) return;
  state.transactions = state.transactions.filter(
    (t) => t.id !== state.pendingDeleteId,
  );
  closeDeleteConfirm();
  saveData();
  goTo(state.activePage);
  showToast("Deleted");
}

// export filtered transactions as CSV
function exportCSV() {
  const filtered = getFiltered();
  const rows = [["Date", "Description", "Category", "Type", "Amount"]];
  filtered.forEach((t) =>
    rows.push([t.date, `"${t.description}"`, t.category, t.type, t.amount]),
  );

  const csvContent = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "transactions.csv";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported ✓");
}

// toast
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  el.classList.add("show");
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.classList.add("hidden"), 300);
  }, 2500);
}

// mobile sidebar
function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-overlay").classList.remove("hidden");
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.add("hidden");
}

// populate category dropdown in filter bar
function buildCategoryFilter() {
  const sel = document.getElementById("filter-category");
  CATEGORIES.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = (catIcons[cat] || "") + " " + cat;
    sel.appendChild(opt);
  });
}

// wire up all events
function bindEvents() {
  document.querySelectorAll("[data-page]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      goTo(el.dataset.page);
    });
  });

  document
    .getElementById("role-select")
    .addEventListener("change", (e) => setRole(e.target.value));
  document
    .getElementById("theme-toggle")
    .addEventListener("click", () =>
      setTheme(state.theme === "dark" ? "light" : "dark"),
    );

  document.getElementById("hamburger").addEventListener("click", openSidebar);
  document
    .getElementById("sidebar-overlay")
    .addEventListener("click", closeSidebar);

  // filters
  document.getElementById("search-input").addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    renderTable();
  });
  document.getElementById("filter-type").addEventListener("change", (e) => {
    state.filters.type = e.target.value;
    renderTable();
  });
  document.getElementById("filter-category").addEventListener("change", (e) => {
    state.filters.category = e.target.value;
    renderTable();
  });
  document.getElementById("filter-sort").addEventListener("change", (e) => {
    state.filters.sort = e.target.value;
    renderTable();
  });

  // buttons
  document.getElementById("add-tx-btn").addEventListener("click", openModal);
  document.getElementById("export-btn").addEventListener("click", exportCSV);

  // modal
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document
    .getElementById("modal-save")
    .addEventListener("click", saveTransaction);
  document.getElementById("modal-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
  });

  // delete confirm
  document
    .getElementById("confirm-cancel")
    .addEventListener("click", closeDeleteConfirm);
  document
    .getElementById("confirm-delete")
    .addEventListener("click", confirmDelete);
  document.getElementById("confirm-backdrop").addEventListener("click", (e) => {
    if (e.target.id === "confirm-backdrop") closeDeleteConfirm();
  });

  // escape closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      closeDeleteConfirm();
      closeSidebar();
    }
  });
}

function init() {
  loadData();
  setTheme(state.theme);

  document.getElementById("role-select").value = state.role;
  setRole(state.role);

  buildCategoryFilter();
  bindEvents();

  // start on dashboard
  goTo("dashboard");
}

document.addEventListener("DOMContentLoaded", init);
