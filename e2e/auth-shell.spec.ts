import { expect, test } from "@playwright/test";

test("landing page renders Join and Sign in and redirects signed-out users from /places", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Join" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  await page.goto("/places");
  await expect(page).toHaveURL(/\/signin/);
});
