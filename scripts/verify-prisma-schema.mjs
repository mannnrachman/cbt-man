import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

// Keep the temporary database inside the workspace. Some restricted runners
// allow Prisma's schema engine to execute only against workspace paths.
const directory = mkdtempSync(join(process.cwd(), ".prisma-check-"));
const database = join(directory, "fresh.db");
const env = {
  ...process.env,
  DATABASE_URL: `file:${database}`,
  // Keep the Rust schema engine's diagnostics enabled in restricted CI
  // runners; otherwise a failed engine can surface as an empty error.
  RUST_LOG: "trace",
};

function run(args) {
  execFileSync("npx", ["prisma", ...args], { env, stdio: "inherit" });
}

try {
  run(["validate"]);
  run(["migrate", "deploy"]);
  run([
    "migrate",
    "diff",
    "--exit-code",
    "--from-url",
    env.DATABASE_URL,
    "--to-schema-datamodel",
    "prisma/schema.prisma",
  ]);
  console.log("✅ Fresh SQLite migrations match prisma/schema.prisma.");
} finally {
  rmSync(directory, { force: true, recursive: true });
}
