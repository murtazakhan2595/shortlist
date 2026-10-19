import { expect, test } from "@playwright/test";

for (const path of ["/", "/capture", "/captures/0f8fad5b-d9cb-469f-a165-70867728950e"]) {
  test(`a visitor who is not signed in is sent from ${path} to the sign-in page`, async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveURL("/sign-in");
  });
}

test("the sign-in page shows the app's name", async ({ page }) => {
  await page.goto("/sign-in");

  await expect(page).toHaveTitle("Sign in | Shortlist");
  await expect(page.getByRole("heading", { level: 1, name: "Shortlist" })).toBeVisible();
});

for (const { path, heading } of [
  { path: "/privacy", heading: "Privacy policy" },
  { path: "/terms", heading: "Terms of use" },
]) {
  test(`${heading} is open without signing in, and linked from the sign-in page`, async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: heading }).click();

    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  });
}

test("wrong details are refused with a message", async ({ page }) => {
  await page.goto("/sign-in");

  await page.getByLabel("Email").fill("nobody@example.test");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Filtered by text: Next.js adds its own empty alert region that announces page changes.
  await expect(page.getByRole("alert").filter({ hasText: "Wrong email or password" })).toBeVisible();
  await expect(page).toHaveURL("/sign-in");
});
