import {
  $,
  esc,
  toast,
  load,
  save,
  today,
  bindDialogs,
} from "./utils.js";
import {
  categories,
  toPaise,
  validTransactions,
  totals,
  filtered,
  byCategory,
  monthly,
  demoTransactions,
} from "./model.js";
const KEY = "spendwise.v1",
  money = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(n / 100);
let entries = load(KEY, () => demoTransactions(today()), validTransactions);
const form = $("#transaction-form"),
  dialog = $("#transaction-dialog");
bindDialogs();
$("#category-filter").innerHTML =
  '<option value="all">All categories</option>' +
  Object.values(categories)
    .flat()
    .map((c) => `<option>${c}</option>`)
    .join("");
function categoryOptions() {
  form.elements.category.innerHTML = categories[form.elements.type.value]
    .map((c) => `<option>${c}</option>`)
    .join("");
}
function render() {
  const all = totals(entries);
  $("#balance").textContent = money(all.balance);
  $("#income").textContent = money(all.income);
  $("#expenses").textContent = money(all.expense);
  const data = filtered(entries, {
      query: $("#search").value,
      type: $("#type-filter").value,
      category: $("#category-filter").value,
      month: $("#month").value,
    }),
    sum = totals(data);
  $("#result-count").textContent =
    `${data.length} of ${entries.length} entries`;
  $("#filtered-summary").textContent =
    `This view: ${money(sum.income)} in · ${money(sum.expense)} out · ${money(sum.balance)} net`;
  $("#transactions").innerHTML = data.length
    ? data
        .map(
          (t) =>
            `<article class="item"><div class="transaction-mark" aria-hidden="true">${t.type === "income" ? "↙" : "↗"}</div><div class="content"><h3>${esc(t.description)}</h3><small>${esc(t.category)} · ${esc(t.date)}</small></div><span class="amount ${t.type}">${t.type === "income" ? "+" : "−"}${money(t.amount)}</span><div class="actions"><button data-edit="${esc(t.id)}">Edit<span class="sr-only"> ${esc(t.description)}</span></button><button class="danger" data-delete="${esc(t.id)}">Delete<span class="sr-only"> ${esc(t.description)}</span></button></div></article>`,
        )
        .join("")
    : '<div class="empty"><strong>A clean page.</strong>Add your first transaction or adjust the filters.</div>';
  const groups = byCategory(data);
  $("#categories-chart").innerHTML = groups.length
    ? groups
        .map(
          ([name, value]) =>
            `<div class="chart-row"><div class="row between"><span>${esc(name)}</span><strong>${money(value)} · ${Math.round((value / sum.expense) * 100)}%</strong></div><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${(value / sum.expense) * 100}%"></div></div></div>`,
        )
        .join("")
    : '<p class="empty">No expenses in this view.</p>';
  const months = monthly(entries, today()),
    max = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1);
  $("#trend-chart").innerHTML =
    `<div class="trend" aria-hidden="true">${months.map((m) => `<div class="month-group"><div class="month-bar" style="height:${(m.income / max) * 100}%"></div><div class="month-bar expense" style="height:${(m.expense / max) * 100}%"></div></div>`).join("")}</div><div class="month-labels" aria-hidden="true">${months.map((m) => `<span>${m.label}</span>`).join("")}</div>`;
  $("#trend-table").innerHTML =
    `<details><summary>View chart data</summary><table><caption class="sr-only">Income and expenses for the last six months</caption><thead><tr><th>Month</th><th>Income</th><th>Expenses</th></tr></thead><tbody>${months.map((m) => `<tr><th>${m.key}</th><td>${money(m.income)}</td><td>${money(m.expense)}</td></tr>`).join("")}</tbody></table></details>`;
}
function commit(message) {
  save(KEY, entries);
  render();
  toast(message);
}
function edit(id) {
  form.reset();
  const t = entries.find((t) => t.id === id);
  form.elements.id.value = t?.id || "";
  form.elements.type.value = t?.type || "expense";
  categoryOptions();
  form.elements.category.value = t?.category || categories.expense[0];
  form.elements.amount.value = t ? (t.amount / 100).toFixed(2) : "";
  form.elements.description.value = t?.description || "";
  form.elements.date.value = t?.date || today();
  $("#dialog-title").textContent = t ? "Edit transaction" : "Add transaction";
  dialog.showModal();
  form.elements.amount.focus();
}
form.elements.type.onchange = categoryOptions;
$("#add").onclick = () => edit();
form.onsubmit = (e) => {
  e.preventDefault();
  try {
    const id = form.elements.id.value,
      t = {
        id: id || crypto.randomUUID(),
        type: form.elements.type.value,
        amount: toPaise(form.elements.amount.value),
        description: form.elements.description.value.trim(),
        category: form.elements.category.value,
        date: form.elements.date.value,
      };
    if (!validTransactions([t]))
      throw Error("Enter a description and a valid date.");
    entries = id ? entries.map((x) => (x.id === id ? t : x)) : [t, ...entries];
    commit(id ? "Transaction updated" : "Transaction added");
    dialog.close();
  } catch (error) {
    toast(error.message);
  }
};
$("#transactions").onclick = (e) => {
  const b = e.target.closest("button");
  if (b?.dataset.edit) edit(b.dataset.edit);
  if (b?.dataset.delete && confirm("Delete this transaction?")) {
    entries = entries.filter((t) => t.id !== b.dataset.delete);
    commit("Transaction deleted");
  }
};
for (const id of ["search", "type-filter", "category-filter", "month"])
  $("#" + id).oninput = render;
$("#clear").onclick = () => {
  $("#search").value = "";
  $("#type-filter").value = "all";
  $("#category-filter").value = "all";
  $("#month").value = "";
  render();
};
window.addEventListener("storage", (e) => {
  if (e.key === KEY) {
    entries = load(KEY, () => [], validTransactions);
    render();
    toast("Updated from another tab");
  }
});
render();
