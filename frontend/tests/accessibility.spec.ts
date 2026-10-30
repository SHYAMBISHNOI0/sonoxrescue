import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("overview exposes accessible navigation and readable controls", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator('main > div').filter({ has: page.locator('h1') })).toHaveCSS('opacity', '1');
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      description: v.description,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});
