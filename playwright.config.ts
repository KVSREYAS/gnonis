import { defineConfig, devices } from "@playwright/test";
import { FAKE_SUPABASE_URL } from "./tests/e2e/fake-supabase";

const PORT = Number(process.env.E2E_PORT ?? 4319);
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;

// A second build with Supabase switched on, pointed at a fake URL that tests/e2e/accounts.spec.ts intercepts.
const ACCOUNTS_PORT = Number(process.env.E2E_ACCOUNTS_PORT ?? 4321);
const accountsURL = process.env.ACCOUNTS_BASE_URL ?? `http://127.0.0.1:${ACCOUNTS_PORT}`;

const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };
const phone = { ...devices["Pixel 7"] };
const ACCOUNTS = /accounts\.spec\.ts/;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "desktop", testIgnore: ACCOUNTS, use: { ...desktop, baseURL } },
    { name: "phone", testIgnore: ACCOUNTS, use: { ...phone, baseURL } },
    { name: "accounts-desktop", testMatch: ACCOUNTS, use: { ...desktop, baseURL: accountsURL } },
    { name: "accounts-phone", testMatch: ACCOUNTS, use: { ...phone, baseURL: accountsURL } },
  ],
  webServer: [
    ...(process.env.BASE_URL
      ? []
      : [
          {
            command: `npm run build && npx next start -H 127.0.0.1 -p ${PORT}`,
            url: baseURL,
            timeout: 240_000,
            reuseExistingServer: !process.env.CI,
            // The smoke tests cover guest (local-only) mode, so build without Supabase even if a .env sets it.
            env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" },
          },
        ]),
    ...(process.env.ACCOUNTS_BASE_URL
      ? []
      : [
          {
            command: `npx next build && npx next start -H 127.0.0.1 -p ${ACCOUNTS_PORT}`,
            url: accountsURL,
            timeout: 240_000,
            reuseExistingServer: !process.env.CI,
            env: {
              NEXT_DIST_DIR: ".next-accounts",
              NEXT_PUBLIC_SUPABASE_URL: FAKE_SUPABASE_URL,
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e",
            },
          },
        ]),
  ],
});
