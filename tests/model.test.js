import test from "node:test";
import assert from "node:assert/strict";
import {
  toPaise,
  validTransactions,
  totals,
  filtered,
  byCategory,
  monthly,
  demoTransactions,
} from "../model.js";
test("money is exact in integer paise", () => {
  assert.equal(toPaise("0.29"), 29);
  assert.equal(toPaise("12.3"), 1230);
  for (const n of ["-1", "0", "1.001", "1e4", "NaN", "10000001"])
    assert.throws(() => toPaise(n));
});
test("balance and category amounts reconcile", () => {
  const data = demoTransactions("2026-10-22");
  assert.ok(validTransactions(data));
  const s = totals(data);
  assert.equal(s.balance, s.income - s.expense);
  assert.equal(
    byCategory(data).reduce((a, c) => a + c[1], 0),
    s.expense,
  );
  assert.deepEqual(totals([]), { income: 0, expense: 0, balance: 0 });
});
test("combined filtering and month rollover", () => {
  const data = demoTransactions("2026-10-22");
  assert.equal(
    filtered(data, {
      type: "expense",
      category: "Food",
      query: "COFFEE",
      month: "2026-10",
    }).length,
    1,
  );
  const m = monthly(data, "2027-02-01");
  assert.equal(m[0].key, "2026-09");
  assert.equal(m.at(-1).key, "2027-02");
  assert.equal(m.find((x) => x.key === "2026-10").income, 4150000);
});
test("rejects invalid transaction records", () => {
  const t = demoTransactions("2026-10-22")[0];
  for (const change of [
    { date: "2026-02-30" },
    { amount: 1.2 },
    { category: "Food" },
    { description: " " },
  ])
    assert.equal(validTransactions([{ ...t, ...change }]), false);
  assert.equal(validTransactions([t, t]), false);
});
