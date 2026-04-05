# Finance Dashboard

A personal finance tracking dashboard I built for a frontend assignment. Lets you view your income and expenses, track spending by category, and understand your financial patterns at a glance.

---

## Why vanilla JS instead of React?

Honest reason — I haven't learned React yet. I'm currently learning backend development (MongoDB), and React is next on my list. I didn't want to half-learn a framework just to submit an assignment, so I went with what I actually know well: plain HTML, CSS, and JavaScript.

That said, I think vanilla JS is genuinely underrated for a project like this. No build step, no dependencies to install, no webpack config to figure out. You just open `index.html` and it runs. I used Chart.js from a CDN for the graphs since building charts from scratch didn't seem like the point of the assignment.

The state management is just a plain JavaScript object that I update and re-render from. It's not Redux, but it works the same way — one place where the data lives, and the UI reflects that data.

---

## How to run it

Download the files and open `index.html` in any browser. That's it.

No npm install. No build command. No server needed.

---

## Features

**Dashboard**
- Summary cards showing total balance, income, expenses, and savings rate
- Line chart showing net savings trend across months
- Doughnut chart with spending broken down by category
- Quick view of the 5 most recent transactions

**Transactions**
- Full table of all transactions
- Search by description or category
- Filter by income/expense type and by category
- Sort by date or amount
- Admin role can also export filtered transactions to CSV

**Role-based UI**
There's a role switcher in the sidebar. Viewer can see everything but can't modify anything. Admin can add, edit, and delete transactions. Roles are stored in localStorage so your selection persists.

Switch roles using the dropdown — the UI updates without any page reload.

**Insights**
- Which category you spend the most on
- How this month's expenses compare to last month
- Average daily spending across all recorded data
- Bar chart comparing income vs expenses per month

**Other stuff**
- Dark and light mode (toggle in the top right)
- Everything saves to localStorage — transactions, theme preference, and role
- Responsive — sidebar on desktop, bottom nav on mobile
- Works on empty data too (there's an actual message instead of a broken table)

---

## Project structure

```
finance-dashboard/
├── index.html     ← structure and layout
├── style.css      ← all styling, uses CSS variables for theming
├── data.js        ← mock transactions and category config
├── app.js         ← all the logic
└── README.md
```

---

## How I handled state

Everything lives in one `state` object at the top of `app.js`:

```js
let state = {
  transactions: [],
  role: 'viewer',
  theme: 'dark',
  activePage: 'dashboard',
  filters: { search: '', type: 'all', category: 'all', sort: 'date-desc' },
  nextId: 100,
};
```

Whenever something changes — a transaction is added, a filter is applied, the role is switched — I update this object and call the relevant render function. That render function reads from state and rebuilds the DOM. It's a simple pattern but it keeps the data flow easy to follow.

`localStorage` is synced after every change so nothing is lost on refresh.

---

## Assumptions I made

- Currency is INR since this felt like it was intended for an Indian fintech context
- The Mutual Fund SIP is listed as an expense since money is leaving the account (even though it's technically an investment)
- Savings rate is calculated as `(income - expenses) / income × 100`
- The mock data covers January through April 2026

---

## What I'd improve with more time

- A proper date range picker for filtering (right now you can only filter by category and type)
- Some kind of budget tracking — set a limit per category and show how close you are
- Export to PDF for a proper monthly statement
- Better mobile experience for the forms
