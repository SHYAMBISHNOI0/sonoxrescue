import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
test("navigation, search, metadata preview and graph inspection", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page
    .getByRole("link", { name: "Imaging Studies", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search patient, study UID or accession…" })
    .fill("SYN-01040");
  await expect(
    page.getByRole("button", { name: "ST-0001", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ST-0001", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.getByText("Drag to pan · 125%")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/investigations/INV-0001");
  await expect(
    page.getByRole("heading", { name: "Temporal evidence graph" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next event", exact: true }).click();
  for (const path of [
    "/",
    "/studies",
    "/investigations",
    "/graph",
    "/simulator",
    "/recovery",
    "/analytics",
    "/audit",
    "/health",
    "/research",
    "/settings",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("simulation updates records and preserves safe abstention", async ({
  page,
}) => {
  await page.goto("/simulator");
  await page.getByRole("button", { name: /Wrong patient identifier/ }).click();
  for (let i = 0; i < 7; i++)
    await page.getByRole("button", { name: "Next event", exact: true }).click();
  await page.getByRole("button", { name: "Complete simulation" }).click();
  await expect(page.getByText(/Run recorded/)).toBeVisible();
  await page.goto("/recovery");
  await expect(
    page.getByRole("button", { name: "Association blocked" }).first(),
  ).toBeDisabled();
});
test("approval does not claim recovery until execution and verification", async ({
  page,
}) => {
  await page.goto("/recovery");
  const card = page
    .locator(".recovery-card")
    .filter({ hasText: "Retry simulated transfer" })
    .first();
  await card.getByRole("button", { name: "Review & approve" }).click();
  await page
    .getByLabel("Reason for decision")
    .fill("Original simulated transfer failure confirmed");
  await page
    .getByLabel("Independent verification reference")
    .fill("RIS source log TEST-42");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirm approval" }).click();
  await expect(card.getByText("Approved", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Execute simulation" }).click();
  await expect(card.getByText("Executed", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Verify retrieval" }).click();
  await expect(card.getByText("Retrieval confirmed")).toBeVisible();
  await page.goto("/audit");
  await expect(
    page.locator(".audit-list strong").filter({ hasText: /^verify$/ }),
  ).toBeVisible();
});
test("research results start empty and are computed on demand", async ({
  page,
}) => {
  await page.goto("/research");
  await expect(
    page.getByText("Evidence starts with an experiment"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run experiment" }).click();
  await expect(
    page.getByRole("button", { name: "Export experiment", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
});
for (const width of [1440, 1280, 1024, 768, 390, 360])
  test(`responsive layouts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      "/",
      "/studies",
      "/investigations/INV-0001",
      "/simulator",
      "/recovery",
      "/analytics",
      "/audit",
      "/health",
      "/research",
      "/settings",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBeTruthy();
    }
    if (width === 1440 || width === 390) {
      await page.goto("/");
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator('main > div').filter({ has: page.locator('h1') })).toHaveCSS('opacity', '1');
      await page.screenshot({
        path: `../docs/screenshots/overview-${width}.png`,
        fullPage: true,
      });
    }
  });
