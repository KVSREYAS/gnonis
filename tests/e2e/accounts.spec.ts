import { expect, test } from "@playwright/test";
import { fakeSession, mockSupabase } from "./fake-supabase";

// Runs against the accounts build (Supabase switched on, pointed at a fake URL). Every Supabase
// call is answered by mockSupabase, so these exercise the real login form without a real project.

const NEXT = "/courses/sample-bits-bytes";

test("tabs switch between signing in and creating an account", async ({ page }) => {
  await mockSupabase(page);
  await page.goto(`/login?next=${NEXT}`);
  await expect(page.getByTestId("tab-signin")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("name-input")).toHaveCount(0);
  await expect(page.getByTestId("google-signin")).toBeVisible();

  await page.getByTestId("tab-signup").click();
  await expect(page.getByTestId("tab-signup")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("name-input")).toBeVisible();
  await expect(page.getByTestId("password-input")).toHaveAttribute("autocomplete", "new-password");
  await expect(page.getByText("At least 8 characters.")).toBeVisible();
  await expect(page.getByTestId("google-signin")).toBeVisible();

  await page.getByTestId("tab-signup").press("ArrowLeft");
  await expect(page.getByTestId("tab-signin")).toBeFocused();
  await expect(page.getByTestId("password-input")).toHaveAttribute("autocomplete", "current-password");
});

test("create account validates, then signs straight in with the display name", async ({ page }) => {
  const supabase = await mockSupabase(page);
  await page.goto(`/login?next=${NEXT}`);
  await page.getByTestId("tab-signup").click();

  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("field-error")).toHaveCount(3);

  await page.getByTestId("name-input").fill("Sreyas K");
  await page.getByTestId("email-input").fill("sreyas@example.com");
  await page.getByTestId("password-input").fill("1234567");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("field-error")).toHaveText("Use at least 8 characters.");
  await expect(page.getByTestId("password-input")).toHaveAttribute("aria-invalid", "true");
  expect(supabase.signups).toHaveLength(0);

  await page.getByTestId("password-input").fill("12345678");
  await expect(page.getByTestId("field-error")).toHaveCount(0);
  await page.getByTestId("auth-submit").click();

  await expect(page).toHaveURL(new RegExp(`${NEXT}$`));
  await expect(page.getByTestId("account-button")).toBeVisible();
  expect(supabase.signups).toHaveLength(1);
  expect(supabase.signups[0]).toMatchObject({ email: "sreyas@example.com", password: "12345678", data: { full_name: "Sreyas K" } });

  await page.getByTestId("account-button").click();
  await expect(page.getByRole("dialog")).toContainText("Sreyas K");
});

test("sign-up without a session shows a check-your-email message", async ({ page }) => {
  await mockSupabase(page, {
    signup: (body) => ({ status: 200, body: { ...fakeSession(String(body.email), "x").user, identities: [{ id: "x" }] } }),
  });
  await page.goto("/login?mode=signup");
  await page.getByTestId("name-input").fill("Friend");
  await page.getByTestId("email-input").fill("friend@example.com");
  await page.getByTestId("password-input").fill("a-long-password");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("check-email")).toContainText("CHECK YOUR EMAIL");
  await expect(page.getByTestId("check-email")).toContainText("friend@example.com");
  await expect(page.getByTestId("account-button")).toHaveCount(0);

  await page.getByRole("button", { name: "Back to sign in" }).click();
  await expect(page.getByTestId("tab-signin")).toHaveAttribute("aria-selected", "true");
});

test("a wrong password gets a BUSTED message, then the right one signs in", async ({ page }) => {
  let attempts = 0;
  const supabase = await mockSupabase(page, {
    signin: (body) =>
      ++attempts === 1
        ? { status: 400, body: { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" } }
        : { status: 200, body: fakeSession(String(body.email), "Returning Player") },
  });
  await page.goto(`/login?next=${NEXT}`);
  await page.getByTestId("email-input").fill("sreyas@example.com");
  await page.getByTestId("password-input").fill("wrong-password");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toContainText("BUSTED");
  await expect(page.getByTestId("auth-error")).toContainText("Wrong email or password");

  await page.getByTestId("password-input").fill("right-password");
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(new RegExp(`${NEXT}$`));
  await expect(page.getByTestId("account-button")).toBeVisible();
  expect(supabase.signins.map((b) => b.password)).toEqual(["wrong-password", "right-password"]);
});

test("the password can be shown and hidden", async ({ page }) => {
  await mockSupabase(page);
  await page.goto("/login");
  await page.getByTestId("password-input").fill("secret-pass");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByTestId("password-input")).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(page.getByTestId("password-input")).toHaveAttribute("type", "password");
});
