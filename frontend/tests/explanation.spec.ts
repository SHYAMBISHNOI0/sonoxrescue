import { test, expect } from "@playwright/test";

test("the example connects the problem to actual source records and a safe next step", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "The scan exists, but its link to the patient’s order is unclear.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show the source records" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Hospital scheduling system" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Scanner / acquisition log" }),
  ).toBeVisible();
  await dialog.getByText("Inspect EV-1-1", { exact: true }).click();
  await expect(
    dialog.getByText("Order created", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("LOCAL-1", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("Example problem").selectOption("transfer");
  await expect(
    page.getByRole("heading", {
      name: "The scan was taken, but its transfer failed.",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Image transfer DICOM", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Transfer failed", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("Example problem").selectOption("identity");
  await expect(
    page.getByRole("heading", { name: "Stop and verify the patient." }),
  ).toBeVisible();
  await expect(page.getByText(/Reassignment stays blocked/)).toBeVisible();
});

test("the worklist gap is explained without pretending a missing log proves its cause", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Imaging orders RIS", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText(
        /order exists, but the scanner’s worklist selection record is missing/,
      ),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Follow this investigation" }).click();
  await expect(
    page.getByRole("region", { name: "Problem, evidence and solution" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review the proposed action" }),
  ).toBeVisible();
});
