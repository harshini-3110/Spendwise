export const categories = {
  income: ["Salary", "Freelance", "Gift", "Other income"],
  expense: [
    "Food",
    "Transport",
    "Shopping",
    "Housing",
    "Learning",
    "Health",
    "Entertainment",
    "Other expense",
  ],
};
export function toPaise(value) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value)))
    throw Error("Enter a positive amount with up to two decimal places.");
  const [whole, fraction = ""] = String(value).split(".");
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n <= 0 || n > 1e9)
    throw Error("Amount must be between ₹0.01 and ₹10,000,000.");
  return n;
}
export function validDate(date) {
  return (
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  );
}
export function validTransactions(data) {
  return (
    Array.isArray(data) &&
    data.length <= 10000 &&
    new Set(data.map((t) => t?.id)).size === data.length &&
    data.every(
      (t) =>
        t &&
        typeof t.id === "string" &&
        ["income", "expense"].includes(t.type) &&
        Number.isSafeInteger(t.amount) &&
        t.amount > 0 &&
        t.amount <= 1e9 &&
        typeof t.description === "string" &&
        t.description.trim().length > 0 &&
        t.description.length <= 120 &&
        categories[t.type].includes(t.category) &&
        validDate(t.date),
    )
  );
}
export function totals(data) {
  const income = data
      .filter((t) => t.type === "income")
      .reduce((a, t) => a + t.amount, 0),
    expense = data
      .filter((t) => t.type === "expense")
      .reduce((a, t) => a + t.amount, 0);
  return { income, expense, balance: income - expense };
}
export function filtered(
  data,
  { query = "", type = "all", category = "all", month = "" },
) {
  return data
    .filter(
      (t) =>
        (t.description + " " + t.category)
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (type === "all" || t.type === type) &&
        (category === "all" || t.category === category) &&
        (!month || t.date.startsWith(month)),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function byCategory(data) {
  return Object.entries(
    data
      .filter((t) => t.type === "expense")
      .reduce(
        (a, t) => ((a[t.category] = (a[t.category] || 0) + t.amount), a),
        {},
      ),
  ).sort((a, b) => b[1] - a[1]);
}
export function monthly(data, today) {
  const [year, month] = today.split("-").map(Number);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 6 + i, 1)),
      key = d.toISOString().slice(0, 7);
    return {
      key,
      label: d.toLocaleDateString("en", { month: "short", timeZone: "UTC" }),
      ...totals(data.filter((t) => t.date.startsWith(key))),
    };
  });
}
export function demoTransactions(today) {
  const [y, m] = today.split("-");
  return [
    {
      id: "d1",
      type: "income",
      amount: 3500000,
      description: "Monthly salary",
      category: "Salary",
      date: `${y}-${m}-01`,
    },
    {
      id: "d2",
      type: "expense",
      amount: 850000,
      description: "A place to call home",
      category: "Housing",
      date: `${y}-${m}-02`,
    },
    {
      id: "d3",
      type: "expense",
      amount: 245000,
      description: "Groceries & good coffee",
      category: "Food",
      date: `${y}-${m}-03`,
    },
    {
      id: "d4",
      type: "income",
      amount: 650000,
      description: "Website illustration project",
      category: "Freelance",
      date: `${y}-${m}-04`,
    },
    {
      id: "d5",
      type: "expense",
      amount: 99900,
      description: "Design course",
      category: "Learning",
      date: `${y}-${m}-05`,
    },
    {
      id: "d6",
      type: "expense",
      amount: 78000,
      description: "Metro pass",
      category: "Transport",
      date: `${y}-${m}-06`,
    },
  ];
}
