const $ = (selector) => document.querySelector(selector);

const expenseForm = $("#expenseForm");
const expenseList = $("#expenseList");
const saveButton = $("#saveExpense");
const cancelButton = $("#cancelEdit");

let expenses = loadData("spendwise-expenses", []);
let budget = loadData("spendwise-budget", 0);
let editingId = null;

function loadData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : JSON.parse(saved);
  } catch {
    return fallback;
  }
}

function saveData() {
  localStorage.setItem("spendwise-expenses", JSON.stringify(expenses));
  localStorage.setItem("spendwise-budget", JSON.stringify(budget));
}

function money(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR"
  }).format(amount);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function currentMonth(date) {
  return date.slice(0, 7);
}

function render() {
  const thisMonth = new Date().toISOString().slice(0, 7);

  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const monthly = expenses
    .filter(item => currentMonth(item.date) === thisMonth)
    .reduce((sum, item) => sum + item.amount, 0);

  $("#totalSpent").textContent = money(total);
  $("#monthlySpent").textContent = money(monthly);
  $("#transactionCount").textContent = expenses.length;

  const remaining = budget - monthly;
  $("#budgetMessage").textContent = budget > 0
    ? remaining < 0
      ? `Budget exceeded by ${money(Math.abs(remaining))}!`
      : `${money(remaining)} remaining this month.`
    : "Set a budget to get started.";

  const category = $("#filterCategory").value;
  const month = $("#filterMonth").value;
  const sort = $("#sortBy").value;

  let visible = expenses.filter(item =>
    (category === "All" || item.category === category) &&
    (!month || currentMonth(item.date) === month)
  );

  visible.sort((a, b) => {
    if (sort === "newest") return b.date.localeCompare(a.date);
    if (sort === "oldest") return a.date.localeCompare(b.date);
    if (sort === "high") return b.amount - a.amount;
    return a.amount - b.amount;
  });

  $("#listCount").textContent = `${visible.length} records`;

  if (visible.length === 0) {
    expenseList.innerHTML =
      '<p class="empty-state">No expenses found. Add your first expense!</p>';
    return;
  }

  expenseList.innerHTML = visible.map(item => `
    <article class="expense-item">
      <div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.category)} · ${escapeHTML(item.date)}</p>
        ${item.description
          ? `<p>${escapeHTML(item.description)}</p>` : ""}
        <div class="item-actions">
          <button type="button" data-action="edit"
            data-id="${item.id}">Edit</button>
          <button type="button" class="delete-btn"
            data-action="delete" data-id="${item.id}">Delete</button>
        </div>
      </div>
      <span class="expense-amount">${money(item.amount)}</span>
    </article>
  `).join("");
}

expenseForm.addEventListener("submit", event => {
  event.preventDefault();

  const title = $("#title").value.trim();
  const amount = Number($("#amount").value);
  const category = $("#category").value;
  const date = $("#date").value;
  const description = $("#description").value.trim();

  if (!title || !category || !date || !Number.isFinite(amount) ||
      amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    alert("Please enter valid expense details.");
    return;
  }

  const expense = {
    id: editingId ?? (
      crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
    ),
    title,
    amount,
    category,
    date,
    description
  };

  if (editingId !== null) {
    expenses = expenses.map(item =>
      item.id === editingId ? expense : item
    );
  } else {
    expenses.push(expense);
  }

  saveData();
  resetForm();
  render();
});

function resetForm() {
  editingId = null;
  expenseForm.reset();
  $("#date").value = new Date().toISOString().slice(0, 10);
  $("#formHeading").textContent = "Add New Expense";
  saveButton.textContent = "+ Add Expense";
  cancelButton.classList.add("hidden");
}

cancelButton.addEventListener("click", resetForm);

expenseList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const item = expenses.find(item => item.id === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === "delete") {
    if (!confirm(`Delete "${item.title}"?`)) return;

    expenses = expenses.filter(item => item.id !== button.dataset.id);

    if (editingId === button.dataset.id) resetForm();

    saveData();
    render();
  }

  if (button.dataset.action === "edit") {
    editingId = item.id;
    $("#title").value = item.title;
    $("#amount").value = item.amount;
    $("#category").value = item.category;
    $("#date").value = item.date;
    $("#description").value = item.description;
    $("#formHeading").textContent = "Edit Expense";
    saveButton.textContent = "Save Changes";
    cancelButton.classList.remove("hidden");
    $("#title").focus();
  }
});

$("#budgetForm").addEventListener("submit", event => {
  event.preventDefault();

  const amount = Number($("#budgetAmount").value);

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Please enter a valid positive budget.");
    return;
  }

  budget = amount;
  saveData();
  render();
});

["filterCategory", "filterMonth", "sortBy"].forEach(id => {
  $(`#${id}`).addEventListener("change", render);
});

const themeToggle = $("#themeToggle");

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  themeToggle.textContent = theme === "dark"
    ? "☀️ Light Mode" : "🌙 Dark Mode";
}

applyTheme(loadData("spendwise-theme", "light"));

themeToggle.addEventListener("click", () => {
  const theme = document.body.classList.contains("dark")
    ? "light" : "dark";

  localStorage.setItem("spendwise-theme", JSON.stringify(theme));
  applyTheme(theme);
});

$("#date").value = new Date().toISOString().slice(0, 10);
render();

const exportJsonBtn = $("#exportJsonBtn");
const importJsonBtn = $("#importJsonBtn");
const importJsonInput = $("#importJsonInput");
const dataMessage = $("#dataMessage");

function showDataMessage(message) {
  dataMessage.textContent = message;
}

// Export expenses and budget to a JSON file
exportJsonBtn.addEventListener("click", () => {
  const backup = {
    app: "SpendWise",
    version: 1,
    exportedAt: new Date().toISOString(),
    budget: budget,
    expenses: expenses
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "spendwise-backup.json";
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
  showDataMessage("JSON backup downloaded successfully!");
});

// Open file picker for importing JSON
importJsonBtn.addEventListener("click", () => {
  importJsonInput.click();
});

const allowedCategories = new Set([
  "Food",
  "Travel",
  "Shopping",
  "Bills",
  "Education",
  "Health",
  "Other"
]);

function isValidDateString(date) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === Number(date.slice(0, 4)) &&
    parsed.getMonth() + 1 === Number(date.slice(5, 7)) &&
    parsed.getDate() === Number(date.slice(8, 10))
  );
}

function isValidImportedExpense(item) {
  return (
    item !== null &&
    typeof item === "object" &&
    typeof item.title === "string" &&
    item.title.trim().length > 0 &&
    item.title.length <= 60 &&
    typeof item.amount === "number" &&
    Number.isFinite(item.amount) &&
    item.amount > 0 &&
    allowedCategories.has(item.category) &&
    isValidDateString(item.date) &&
    (
      item.description === undefined ||
      (
        typeof item.description === "string" &&
        item.description.length <= 200
      )
    )
  );
}

function createImportedId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

// Read and validate the selected JSON file
importJsonInput.addEventListener("change", async () => {
  const file = importJsonInput.files[0];

  if (!file) return;

  try {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("File is too large. Maximum size is 2 MB.");
    }

    const parsed = JSON.parse(await file.text());

    // Accept either our backup object or an array of expenses
    const importedExpenses = Array.isArray(parsed)
      ? parsed
      : parsed?.expenses;

    if (!Array.isArray(importedExpenses)) {
      throw new Error("Invalid backup: expenses array not found.");
    }

    if (!importedExpenses.every(isValidImportedExpense)) {
      throw new Error(
        "Invalid expense data. Please select a valid SpendWise JSON backup."
      );
    }

    let importedBudget = budget;

    if (
      !Array.isArray(parsed) &&
      Object.prototype.hasOwnProperty.call(parsed, "budget")
    ) {
      if (
        typeof parsed.budget !== "number" ||
        !Number.isFinite(parsed.budget) ||
        parsed.budget < 0
      ) {
        throw new Error("Invalid budget in the backup file.");
      }

      importedBudget = parsed.budget;
    }

    if (
      !confirm(
        "Import this backup? Your current expenses and budget will be replaced."
      )
    ) {
      showDataMessage("Import cancelled. Your data was not changed.");
      return;
    }

    // Create unique IDs and copy only the expected fields
    const usedIds = new Set();

    const cleanExpenses = importedExpenses.map(item => {
      let id = item.id == null
        ? createImportedId()
        : String(item.id);

      if (!id.trim() || usedIds.has(id)) {
        id = createImportedId();
      }

      usedIds.add(id);

      return {
        id,
        title: item.title.trim(),
        amount: item.amount,
        category: item.category,
        date: item.date,
        description: item.description || ""
      };
    });

    // Save only after the entire file has passed validation
    expenses = cleanExpenses;
    budget = importedBudget;

    saveData();
    resetForm();
    render();

    showDataMessage(
      `Successfully imported ${expenses.length} expenses!`
    );
  } catch (error) {
    showDataMessage(
      error instanceof Error
        ? error.message
        : "Could not import this JSON file."
    );
  } finally {
    importJsonInput.value = "";
  }
});
