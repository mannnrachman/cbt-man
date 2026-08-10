import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  forbiddenReason,
  generatedRouteErrors,
  hasLegacyBranding,
  migrationPolicyErrors,
  packageIdentityErrors,
} from "../../scripts/check-pr-hygiene.mjs";
import { contractErrors } from "../../scripts/check-pr-body.mjs";

test("PR hygiene rejects historical CBT-MAN artifacts and legacy branding", () => {
  for (const path of [
    "scratch/seed-clinical.ts",
    "ts_errors.txt",
    "data/uploads/answer.pdf",
    "raw_dashboard.tsx",
    "temp_notes.txt",
    "prisma/dev.db",
    "tests/output/trace.zip",
  ]) {
    assert.ok(forbiddenReason(path), `${path} must be rejected`);
  }
  assert.equal(forbiddenReason("src/routes/_authenticated/admin.tsx"), null);
  assert.ok(hasLegacyBranding("CBT-Kampus"));
  assert.ok(hasLegacyBranding("cbt-universitas"));
  assert.equal(hasLegacyBranding("CBT-MAN"), false);
});

test("PR hygiene requires a new migration for schema changes and freezes applied migrations", () => {
  assert.deepEqual(
    migrationPolicyErrors([{ code: "M", status: "M", path: "prisma/schema.prisma" }]),
    ["prisma/schema.prisma berubah tanpa migration baru di prisma/migrations/"],
  );
  assert.deepEqual(
    migrationPolicyErrors([
      {
        code: "M",
        status: "M",
        path: "prisma/migrations/20260721013647_add_app_logo/migration.sql",
      },
    ]),
    [
      "migration lama tidak boleh diubah/dihapus: prisma/migrations/20260721013647_add_app_logo/migration.sql (M)",
    ],
  );
  assert.deepEqual(
    migrationPolicyErrors([
      { code: "M", status: "M", path: "prisma/schema.prisma" },
      {
        code: "A",
        status: "A",
        path: "prisma/migrations/20260810100000_fix_ujian_relations/migration.sql",
      },
    ]),
    [],
  );
});

test("PR hygiene only accepts generated route tree changes alongside route sources", () => {
  assert.deepEqual(
    generatedRouteErrors([{ code: "M", status: "M", path: "src/routeTree.gen.ts" }]),
    ["src/routeTree.gen.ts berubah tanpa perubahan source di src/routes/"],
  );
  assert.deepEqual(
    generatedRouteErrors([
      { code: "M", status: "M", path: "src/routeTree.gen.ts" },
      { code: "M", status: "M", path: "src/routes/_authenticated/admin.tsx" },
    ]),
    [],
  );
});

test("package identity stays CBT-MAN", () => {
  assert.deepEqual(
    packageIdentityErrors(
      { name: "cbt-man" },
      { name: "cbt-man", packages: { "": { name: "cbt-man" } } },
    ),
    [],
  );
  assert.equal(
    packageIdentityErrors(
      { name: "cbt-kampus" },
      { name: "cbt-man", packages: { "": { name: "cbt-man" } } },
    ).length,
    1,
  );
});

test("PR body requires CBT-MAN review evidence sections", () => {
  const valid = [
    "## Ringkasan\nReal problem",
    "## Scope dan non-goal\nNarrow scope",
    "## Keamanan, otorisasi, dan data\nNot relevant: docs only",
    "## Prisma dan migrasi\nNot relevant: docs only",
    "## Validasi yang benar-benar dijalankan\n`npm run test:unit`",
    "## Hygiene check\nClean",
    "## Risiko dan rollback\nRevert commit",
  ].join("\n\n");
  assert.deepEqual(contractErrors(valid), []);
  assert.ok(contractErrors("## Ringkasan\n- Masalah / kebutuhan:").length > 0);
});
