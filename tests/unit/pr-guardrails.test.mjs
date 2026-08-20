import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  forbiddenReason,
  generatedRouteErrors,
  hasLegacyBranding,
  migrationPolicyErrors,
  shouldScanBranding,
  packageIdentityErrors,
} from "../../scripts/check-pr-hygiene.mjs";
import { contractErrors } from "../../scripts/check-pr-body.mjs";

test("PR hygiene rejects historical CBT-MAN artifacts and legacy branding", () => {
  for (const path of [
    "scratch/seed-clinical.ts",
    "ts_errors.txt",
    "data/uploads/answer.pdf",
    "raw_dashboard.tsx",
    "raw_answers.json",
    "temp_notes.txt",
    "temp_export.csv",
    "prisma/dev.db",
    "tests/output/trace.zip",
  ]) {
    assert.ok(forbiddenReason(path), `${path} must be rejected`);
  }
  assert.equal(forbiddenReason("src/routes/_authenticated/admin.tsx"), null);
  const oldCampusBrand = "CBT-" + ["Kamp", "us"].join("");
  const oldUniversityBrand = "cbt-" + ["univers", "itas"].join("");
  assert.ok(hasLegacyBranding(oldCampusBrand));
  assert.ok(hasLegacyBranding(oldUniversityBrand));
  assert.equal(hasLegacyBranding("CBT-MAN"), false);
  assert.equal(shouldScanBranding("README.md"), true);
  assert.equal(shouldScanBranding("scripts/check-pr-hygiene.mjs"), true);
  assert.equal(shouldScanBranding("CLAUDE.md"), false);
  assert.equal(shouldScanBranding(".github/PULL_REQUEST_TEMPLATE.md"), false);
});

test("production session cookies default secure but allow explicit private-HTTP override", () => {
  const session = readFileSync("src/lib/server/db/session.ts", "utf8");
  const compose = readFileSync("compose.yaml", "utf8");

  assert.match(session, /SESSION_COOKIE_SECURE !== "false"/);
  assert.match(compose, /SESSION_COOKIE_SECURE: "false"/);
});

test("migration normalizes only dangling optional relation IDs", () => {
  const sql = readFileSync(
    "prisma/migrations/20260810100000_fix_ujian_relation_constraints/migration.sql",
    "utf8",
  );
  assert.match(sql, /CASE WHEN "mataKuliahId" IS NULL/);
  assert.match(sql, /FROM "MataKuliah"/);
  assert.match(sql, /CASE WHEN "semesterId" IS NULL/);
  assert.match(sql, /FROM "Semester"/);
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
  const oldPackageName = "cbt-" + ["kamp", "us"].join("");
  assert.equal(
    packageIdentityErrors(
      { name: oldPackageName },
      { name: "cbt-man", packages: { "": { name: "cbt-man" } } },
    ).length,
    1,
  );
});

test("PR body requires CBT-MAN review evidence sections", () => {
  const valid = [
    "## Ringkasan\nReal problem",
    "## Issue, PR terkait, dan riwayat",
    "- Issue/PR terkait: #1",
    "- Apakah ini replacement dari PR closed/stale? Jika ya, tulis nomor PR dan kontribusi yang diekstrak: Tidak",
    "- Mengapa perubahan ini tidak duplikat dari pekerjaan yang ada?: New guard",
    "## Scope dan non-goal\nNarrow scope",
    "## Keamanan, otorisasi, dan data\nNot relevant: docs only",
    "## Prisma dan migrasi\nNot relevant: docs only",
    "## Validasi yang benar-benar dijalankan\n`npm run test:unit`",
    "## Hygiene check\nClean",
    "## Risiko dan rollback\nRevert commit",
  ].join("\n\n");
  assert.deepEqual(contractErrors(valid), []);
  assert.ok(contractErrors("## Ringkasan\n- Masalah / kebutuhan:").length > 0);
  assert.ok(
    contractErrors(valid.replace("## Issue, PR terkait, dan riwayat\n", "")).some((error) =>
      error.includes("Issue, PR terkait, dan riwayat"),
    ),
  );
  assert.ok(
    contractErrors(
      valid.replace(
        "- Mengapa perubahan ini tidak duplikat dari pekerjaan yang ada?: New guard",
        "- Mengapa perubahan ini tidak duplikat dari pekerjaan yang ada?:",
      ),
    ).some((error) => error.includes("field wajib belum diisi")),
  );
});
