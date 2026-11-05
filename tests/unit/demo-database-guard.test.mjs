import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { confirmedDemoDatabaseUrl } from "../../scripts/lib/demo-database-guard.mjs";

test("demo database requires explicit development and the canonical local target", () => {
  const scratch = join(process.env.HOME, "tmp/cbt-man/demo-database-guard");
  mkdirSync(scratch, { recursive: true });
  const dir = mkdtempSync(join(scratch, "case-"));
  try {
    const target = join(dir, "demo.db");
    const other = join(dir, "production.db");
    writeFileSync(target, "unchanged");
    writeFileSync(other, "production unchanged");
    const env = { NODE_ENV: "development", DATABASE_URL: `file:${target}` };
    for (const NODE_ENV of [undefined, "", "production", "test", "staging", "Development"]) {
      assert.throws(() => confirmedDemoDatabaseUrl({ ...env, NODE_ENV }, target), /NODE_ENV=development/);
    }
    for (const DATABASE_URL of [undefined, "", "file:./dev.db", "postgresql://localhost/db", "file://remote/db", `file:${target}?mode=rw`, `file:${target}#other`]) {
      assert.throws(() => confirmedDemoDatabaseUrl({ ...env, DATABASE_URL }, target));
    }
    for (const confirmation of [undefined, "", other, "demo.db"]) {
      assert.throws(() => confirmedDemoDatabaseUrl(env, confirmation), /confirm-database/);
    }
    const link = join(dir, "alias.db");
    symlinkSync(other, link);
    assert.throws(() => confirmedDemoDatabaseUrl({ ...env, DATABASE_URL: `file:${link}` }, link), /confirm-database/);
    assert.equal(confirmedDemoDatabaseUrl(env, target), `file:${target}`);
    for (const NODE_ENV of [undefined, "", "production", "test", "staging"]) {
      const childEnv = { ...process.env, DATABASE_URL: `file:${other}` };
      if (NODE_ENV === undefined) delete childEnv.NODE_ENV;
      else childEnv.NODE_ENV = NODE_ENV;
      const result = spawnSync(process.execPath, ["scripts/prepare-live-preview-demo.mjs", "--confirm-database", other], {
        env: childEnv, encoding: "utf8",
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /NODE_ENV=development/);
    }
    const wrongTarget = spawnSync(process.execPath, ["scripts/prepare-live-preview-demo.mjs", "--confirm-database", target], {
      env: { ...process.env, NODE_ENV: "development", DATABASE_URL: `file:${other}` }, encoding: "utf8",
    });
    assert.notEqual(wrongTarget.status, 0);
    assert.match(wrongTarget.stderr, /confirm-database/);
    assert.equal(readFileSync(target, "utf8"), "unchanged");
    assert.equal(readFileSync(other, "utf8"), "production unchanged");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
