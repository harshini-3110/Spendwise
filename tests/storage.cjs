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
    for (const [name, key, collection, open] of [
      ["SpendWise", "spendwise.v1", "#transactions", "+ Add transaction"],
    ]) {
      const page = await browser.newPage();
      page.setDefaultTimeout(10000);
      page.on("dialog", (d) => d.accept());
      await page.goto(process.env.BASE_URL || "http://127.0.0.1:8002/");
      await page
        .locator(collection + " .item")
        .first()
        .waitFor();
      if (!(await page.locator(collection + " .item").count()))
        throw Error("first-visit sample data did not load");
      await page.getByRole("button", { name: open, exact: true }).click();
      await page.keyboard.press("Escape");
      if (await page.locator("dialog[open]").count())
        throw Error("Escape failed");
      await page.evaluate((key) => localStorage.setItem(key, "[]"), key);
      await page.reload();
      if (await page.locator(collection + " .item").count())
        throw Error("empty list was reseeded");
      await page.evaluate((key) => localStorage.setItem(key, "{broken"), key);
      await page.reload();
      await page
        .locator("#storage-warning")
        .filter({ hasText: "could not be read" })
        .waitFor();
      if ((await page.locator("#storage-warning").innerText()).includes("export"))
        throw Error("storage warning still recommends export");
      if (
        (await page.evaluate((key) => localStorage.getItem(key), key)) !==
        "{broken"
      )
        throw Error("corrupt data overwritten");
      const blockedPage = await browser.newPage();
      await blockedPage.addInitScript((storageKey) => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key === storageKey)
            throw new DOMException("Blocked", "QuotaExceededError");
          return original.call(this, key, value);
        };
      }, key);
      await blockedPage.goto(process.env.BASE_URL || "http://127.0.0.1:8002/");
      await blockedPage
        .getByRole("button", { name: open, exact: true })
        .click();
      await blockedPage.getByLabel("Amount (INR)").fill("1.00");
      await blockedPage
        .getByLabel("Description", { exact: true })
        .fill("Memory only");
      await blockedPage
        .getByRole("button", { name: "Save transaction" })
        .click();
      await blockedPage
        .locator("#storage-warning")
        .filter({ hasText: "remain in memory" })
        .waitFor();
      if ((await blockedPage.locator("#toast").innerText()).includes("export"))
        throw Error("storage failure toast still recommends export");
      await blockedPage.emulateMedia({ reducedMotion: "reduce" });
      const duration = await blockedPage
        .locator(collection + " .item")
        .first()
        .evaluate((e) => getComputedStyle(e).animationDuration);
      if (duration !== "0s") throw Error("reduced motion not honored");
      await blockedPage.close();
      await page.setViewportSize({ width: 390, height: 844 });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error("mobile overflow");
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.evaluate(
        () => (document.querySelector("#toast").textContent = ""),
      );
      await page.screenshot({
        path: "test-results/" + name.toLowerCase() + "-clean.png",
        fullPage: true,
      });
      await page.close();
      console.log(
        name +
          ": first-visit sample data, empty persistence, corrupt storage, storage failure, Escape and reduced motion passed",
      );
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
