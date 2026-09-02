import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createSeedDataset } from "../../src/lib/server/db/seed-shared.mjs";

test("seed uses the production secret and documented development password", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAdminPassword = process.env.ADMIN_PASSWORD;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.ADMIN_PASSWORD;

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

    process.env.NODE_ENV = "development";
    const developmentDataset = await createSeedDataset({
      uid: (prefix = "") => `${prefix}id`,
      now: 1,
      hashPassword: async (password) => `hash:${password}`,
    });

    assert.equal(developmentDataset.users[0].passwordHash, "hash:admin123");
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousAdminPassword;
  }
});
