import { expect, test } from "@playwright/test";

test("a visitor who is not signed in is sent to the sign-in page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/sign-in");
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
