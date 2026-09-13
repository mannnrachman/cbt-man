import path from "node:path";
import { defineConfig } from "@playwright/test";

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    headless: true,
  },
  // After `npm run build`, preview the production bundle (not `vite dev`).
  // migrate deploy + /api/health wait until SQLite can serve the landing loader.
  webServer: {
    command: `npx prisma migrate deploy && npm run preview -- --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? `file:${path.resolve("prisma/e2e.db")}`,
      // preview is NODE_ENV=production; empty DB hits seedIfNeeded on `/`.
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "e2e-smoke",
    },
  },
});
