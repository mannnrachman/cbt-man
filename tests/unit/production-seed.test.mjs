import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createSeedDataset } from "../../src/lib/server/db/seed-shared.mjs";

function restoreEnv(name, previous) {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

test("seed uses the production secret and documented development password", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAdminPassword = process.env.ADMIN_PASSWORD;
  const previousSeedDemo = process.env.SEED_DEMO;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.ADMIN_PASSWORD;
    delete process.env.SEED_DEMO;

    await assert.rejects(
      createSeedDataset({ uid: () => "id", now: 1, hashPassword: async () => "hash" }),
      /ADMIN_PASSWORD is required/,
    );

    process.env.ADMIN_PASSWORD = "configured-secret";
    const dataset = await createSeedDataset({
      uid: (prefix = "") => `${prefix}id`,
      now: 1,
      hashPassword: async (password) => `hash:${password}`,
    });

    assert.equal(dataset.users[0].passwordHash, "hash:configured-secret");
    assert.equal(dataset.users.length, 1);
    assert.equal(dataset.ujian.length, 0);

    process.env.NODE_ENV = "development";
    const developmentDataset = await createSeedDataset({
      uid: (prefix = "") => `${prefix}id`,
      now: 1,
      hashPassword: async (password) => `hash:${password}`,
    });

    assert.equal(developmentDataset.users[0].passwordHash, "hash:admin123");
    assert.ok(developmentDataset.ujian.length > 0);
  } finally {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("ADMIN_PASSWORD", previousAdminPassword);
    restoreEnv("SEED_DEMO", previousSeedDemo);
  }
});

test("SEED_DEMO=true seeds the full demo dataset in production with ADMIN_PASSWORD", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAdminPassword = process.env.ADMIN_PASSWORD;
  const previousSeedDemo = process.env.SEED_DEMO;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.ADMIN_PASSWORD;
    process.env.SEED_DEMO = "true";

    await assert.rejects(
      createSeedDataset({ uid: () => "id", now: 1, hashPassword: async () => "hash" }),
      /ADMIN_PASSWORD is required/,
    );

    process.env.ADMIN_PASSWORD = "configured-secret";
    const dataset = await createSeedDataset({
      uid: (prefix = "") => `${prefix}id`,
      now: 1,
      hashPassword: async (password) => `hash:${password}`,
    });

    assert.equal(dataset.users[0].passwordHash, "hash:configured-secret");
    assert.ok(dataset.users.some((user) => user.username === "operator1"));
    assert.ok(dataset.ujian.length > 0);
  } finally {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("ADMIN_PASSWORD", previousAdminPassword);
    restoreEnv("SEED_DEMO", previousSeedDemo);
  }
});

test("Dockerfile demo seed does not force NODE_ENV=development", () => {
  const dockerfile = readFileSync("Dockerfile", "utf8");

  assert.match(dockerfile, /SEED_DEMO:-false/);
  assert.match(dockerfile, /\/app\/data\/\.demo-seeded/);
  assert.match(dockerfile, /npm run prisma:seed/);
  assert.doesNotMatch(dockerfile, /NODE_ENV=development/);
});
