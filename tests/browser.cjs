const fs = require("node:fs");
fs.mkdirSync("test-results", { recursive: true });
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL
      ? { channel: process.env.BROWSER_CHANNEL }
      : {}),
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(response.status() + " " + response.url());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:8002/");
    const assertStoredBalance = async () => {
      const expected = await page.evaluate(() => {
        const transactions = JSON.parse(
          localStorage.getItem("spendwise.v1"),
        );
        const paise = transactions.reduce(
          (total, transaction) =>
            total +
            (transaction.type === "income"
              ? transaction.amount
              : -transaction.amount),
          0,
        );
        return new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 2,
        }).format(paise / 100);
      });
      if ((await page.locator("#balance").textContent()) !== expected)
        throw Error("displayed balance does not match exact stored amounts");
    };
    if (
      await page.locator("footer, #export, #import, #demo, #import-file").count()
    )
      throw Error("removed controls are still present");
    await page.locator("#transactions .item").first().waitFor();
    const original = await page.locator("#balance").textContent();
    const originalCount = await page.locator("#transactions .item").count();
    const originalChart = await page.locator("#categories-chart").innerText();
    await page.getByRole("button", { name: "+ Add transaction" }).click();
    await page.getByLabel("Amount (INR)").fill("0.29");
    await page
      .getByLabel("Description", { exact: true })
      .fill("Browser expense");
    await page.getByRole("button", { name: "Save transaction" }).click();
    if (
      (await page.locator("#transactions .item").count()) !==
      originalCount + 1
    )
      throw Error("transaction creation failed");
    await assertStoredBalance();
    if ((await page.locator("#balance").textContent()) === original)
      throw Error("expense did not update balance");
    if ((await page.locator("#categories-chart").innerText()) === originalChart)
      throw Error("expense did not update category chart");
    const expenseBalance = await page.locator("#balance").textContent();
    await page.reload();
    await page
      .getByRole("heading", { name: "Browser expense", exact: true })
      .waitFor();
    await assertStoredBalance();
    if ((await page.locator("#balance").textContent()) !== expenseBalance)
      throw Error("transaction did not persist after reload");
    await page
      .getByRole("button", { name: "Edit Browser expense", exact: true })
      .click();
    await page.getByLabel("Amount (INR)").fill("10.29");
    await page
      .getByLabel("Transaction type", { exact: true })
      .selectOption("income");
    await page
      .getByLabel("Transaction category", { exact: true })
      .selectOption("Freelance");
    await page.getByRole("button", { name: "Save transaction" }).click();
    await assertStoredBalance();
    if ((await page.locator("#balance").textContent()) === expenseBalance)
      throw Error("edit did not update balance");
    if ((await page.locator("#categories-chart").innerText()) !== originalChart)
      throw Error("income edit did not update category chart");
    await page.locator("#trend-table summary").click();
    if (!(await page.locator("#trend-table table").innerText()).includes("10.29"))
      throw Error("income edit did not update chart data");
    await page
      .getByLabel("Filter type", { exact: true })
      .selectOption("income");
    await page
      .getByRole("heading", { name: "Browser expense", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Delete Browser expense", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Reset filters", exact: true })
      .click();
    if ((await page.locator("#balance").textContent()) !== original)
      throw Error("balance did not reconcile");
    await assertStoredBalance();
    if ((await page.locator("#transactions .item").count()) !== originalCount)
      throw Error("transaction deletion failed");
    if ((await page.locator("#categories-chart").innerText()) !== originalChart)
      throw Error("deletion did not restore category chart");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.screenshot({
      path: "test-results/spendwise-desktop.png",
      fullPage: true,
    });
    for (const [width, height, label] of [
      [390, 844, "mobile"],
      [768, 1024, "tablet"],
      [1440, 900, "desktop"],
    ]) {
      await page.setViewportSize({ width, height });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error(label + " overflow");
      await page.screenshot({
        path: "test-results/spendwise-" + label + ".png",
        fullPage: true,
      });
    }
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      "SpendWise browser: CRUD, balances, chart updates, persistence, filters, and responsive layouts passed",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
