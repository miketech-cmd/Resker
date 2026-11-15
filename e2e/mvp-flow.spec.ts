import { expect, test } from "@playwright/test";

test.describe("MVP mobile end-to-end flow (390x844)", () => {
  test("public explore, PWA manifest/legal pages, and signed-in add -> visit -> list -> map flow", async ({
    page,
  }) => {
    // 1. Public manifest & legal checks
    const manifestRes = await page.request.get("/manifest.webmanifest");
    expect(manifestRes.status()).toBe(200);
    const manifestJson = (await manifestRes.json()) as {
      share_target?: { action?: string; params?: Record<string, string> };
      icons?: Array<{ src: string; purpose?: string }>;
    };
    expect(manifestJson.share_target?.action).toBe("/places?add=1");
    expect(manifestJson.icons?.some((i) => i.purpose === "maskable")).toBe(true);

    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();

    // 2. Public Explore & curated guide check
    await page.goto("/explore");
    await expect(page.getByRole("heading", { name: "Explore Public Lists" })).toBeVisible();
    await expect(page.getByText("Seattle Top Vegetarian-Friendly Picks")).toBeVisible();

    // 3. Sign up new test user
    const suffix = Date.now().toString(36).slice(-6);
    const username = `e2e_${suffix}`;
    await page.goto("/join");
    await page.getByLabel("Name").fill("E2E Reviewer");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Email").fill(`${username}@example.com`);
    await page.getByLabel("Password").fill("ReskerE2EPass123!");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/places/, { timeout: 15000 });

    // 4. Mock external Google resolve and trigger Android Share Target URL flow
    await page.route("**/api/places/resolve", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          alreadySaved: false,
          prefill: {
            googlePlaceId: `ChIJ-e2e-${suffix}`,
            googleMapsUri: "https://maps.google.com/?cid=999",
            lat: 47.6101,
            lng: -122.2015,
            name: "E2E Noodle Bar",
            address: "100 Main St, Bellevue, WA 98004, USA",
            city: "Bellevue",
            countryCode: "US",
            cuisines: ["Ramen", "Vegetarian"],
            priceLevel: 2,
          },
        }),
      });
    });

    await page.goto("/places?add=1&url=https%3A%2F%2Fmaps.app.goo.gl%2Ftestshare");
    await expect(page.getByText("Place details powered by Google.")).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("button", { name: /save to to try/i }).click();
    await expect(page.getByText("E2E Noodle Bar").first()).toBeVisible({ timeout: 10000 });

    // 5. Open detail & log a visit
    await page.getByText("E2E Noodle Bar").first().click();
    await expect(page).toHaveURL(/\/places\/.+/, { timeout: 10000 });
    await page.getByRole("button", { name: /log visit/i }).click();
    await page.getByPlaceholder(/add a dish/i).fill("Miso Mushroom Ramen");
    await page.getByPlaceholder(/add a dish/i).press("Enter");
    await page.getByRole("button", { name: /save visit/i }).click();
    await expect(page.getByText("Miso Mushroom Ramen")).toBeVisible({ timeout: 10000 });

    // 6. Add to a new public list
    await page.getByRole("button", { name: /lists/i }).click();
    await page.getByRole("button", { name: /create new list/i }).click();
    await page.getByLabel("List name").fill("E2E Seattle Veg");
    await page.getByRole("switch").click();
    await page.getByRole("button", { name: "Create list" }).click();
    await page.getByRole("button", { name: "Done" }).click();

    // 7. Navigate to Map & Lists
    await page.goto("/lists");
    await expect(page.getByText("E2E Seattle Veg")).toBeVisible();
    await expect(page.getByText("Public")).toBeVisible();
    await page.goto("/map");
    await expect(page.getByText(/saved spot/i)).toBeVisible({ timeout: 10000 });
  });
});
