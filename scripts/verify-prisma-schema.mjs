import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "cbt-man-prisma-"));
const database = join(directory, "fresh.db");
const env = { ...process.env, DATABASE_URL: `file:${database}` };

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
