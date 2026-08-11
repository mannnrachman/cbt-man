import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FORBIDDEN_PATHS = [
  [/^scratch\//, "artifact scratch"],
  [/(^|\/)ts_errors\.txt$/i, "dump error TypeScript"],
  [/(^|\/)diff_users\.txt$/i, "dump diff pengguna"],
  [/(^|\/)(?:raw_|temp_)[^/]*$/i, "file raw/temp"],
  [/^data\/uploads\//, "upload runtime"],
  [/^(dist|node_modules|coverage|artifacts|playwright-report)\//, "output/generated artifact"],
  [/^tests\/output\//, "output test"],
  [/(?:^|\/)[^/]+\.(?:db|sqlite)(?:-journal)?$/i, "database lokal"],
  [/(?:^|\/)[^/]+\.log$/i, "log"],
];

const LEGACY_PREFIXES = ["kamp", "univers"];
const LEGACY_SUFFIXES = ["us", "itas"];
const LEGACY_BRANDING = new RegExp(
  `\\bcbt[-_ ]?(?:${LEGACY_PREFIXES.map((prefix, index) => `${prefix}${LEGACY_SUFFIXES[index]}`).join("|")})\\b`,
  "i",
);
const BRANDING_POLICY_ALLOWLIST = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
]);
const GOVERNED_TEXT_PATH =
  /(?:^|\/)(?:README(?:\.[^/]*)?|[^/]+\.(?:css|graphql|gql|html|ini|js|jsx|json|md|mdx|mjs|prisma|scss|sql|sh|svg|tsx?|txt|toml|xml|ya?ml))$/i;
const CODE_PATH = /^src\/.*\.(?:ts|tsx)$/;
const GENERATED_ROUTE_TREE = "src/routeTree.gen.ts";
const MIGRATION_PATH = /^prisma\/migrations\//;

export function forbiddenReason(path) {
  const normalized = path.replaceAll("\\", "/");
  for (const [pattern, reason] of FORBIDDEN_PATHS) {
    if (pattern.test(normalized)) return reason;
  }
  return null;
}

export function hasLegacyBranding(content) {
  return LEGACY_BRANDING.test(content);
}

export function shouldScanBranding(path) {
  const normalized = path.replaceAll("\\", "/");
  return !BRANDING_POLICY_ALLOWLIST.has(normalized) && GOVERNED_TEXT_PATH.test(normalized);
}

export function packageIdentityErrors(packageJson, packageLock) {
  const errors = [];
  if (packageJson.name !== "cbt-man") {
    errors.push(
      `package.json harus bernama "cbt-man", mendapat ${JSON.stringify(packageJson.name)}`,
    );
  }
  if (packageLock.name !== "cbt-man") {
    errors.push(
      `package-lock.json harus bernama "cbt-man", mendapat ${JSON.stringify(packageLock.name)}`,
    );
  }
  if (packageLock.packages?.[""]?.name !== "cbt-man") {
    errors.push(
      `package-lock.json packages[""] harus bernama "cbt-man", mendapat ${JSON.stringify(packageLock.packages?.[""]?.name)}`,
    );
  }
  return errors;
}

export function migrationPolicyErrors(changes) {
  const errors = [];
  const migrationChanges = changes.filter((change) => MIGRATION_PATH.test(change.path));
  for (const change of migrationChanges) {
    if (change.code !== "A") {
      errors.push(`migration lama tidak boleh diubah/dihapus: ${change.path} (${change.status})`);
    }
  }

  const schemaChanged = changes.some((change) => change.path === "prisma/schema.prisma");
  const newMigration = migrationChanges.some(
    (change) => change.code === "A" && /\/migration\.sql$/.test(change.path),
  );
  if (schemaChanged && !newMigration) {
    errors.push("prisma/schema.prisma berubah tanpa migration baru di prisma/migrations/");
  }
  return errors;
}

export function generatedRouteErrors(changes) {
  const routeTreeChanged = changes.some(
    (change) => change.code !== "D" && change.path === GENERATED_ROUTE_TREE,
  );
  const routeSourceChanged = changes.some(
    (change) => change.code !== "D" && /^src\/routes\//.test(change.path),
  );
  return routeTreeChanged && !routeSourceChanged
    ? ["src/routeTree.gen.ts berubah tanpa perubahan source di src/routes/"]
    : [];
}

export function baseSha() {
  const explicit = process.env.CI_BASE_SHA?.trim();
  if (explicit && !/^0+$/.test(explicit)) return explicit;

  try {
    return git(["merge-base", "HEAD", "origin/main"]).trim();
  } catch {
    return git(["rev-parse", "HEAD^"]).trim();
  }
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

export function parseNameStatus(output) {
  const fields = output.split("\0");
  const changes = [];
  for (let index = 0; index < fields.length - 1; ) {
    const status = fields[index++];
    if (!status) break;
    const code = status[0];
    if (code === "R" || code === "C") index += 1;
    const path = fields[index++];
    changes.push({ code, status, path });
  }
  return changes;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function changedFiles(base) {
  const head = process.env.CI_HEAD_SHA?.trim() || "HEAD";
  const range = process.env.CI_BASE_SHA?.trim() ? `${base}..${head}` : `${base}...${head}`;
  return parseNameStatus(git(["diff", "--name-status", "--find-renames", "-z", range]));
}

function diffCheck(base) {
  const head = process.env.CI_HEAD_SHA?.trim() || "HEAD";
  const range = process.env.CI_BASE_SHA?.trim() ? `${base}..${head}` : `${base}...${head}`;
  const result = spawnSync("git", ["diff", "--check", range], { encoding: "utf8" });
  return result.status === 0 ? null : (result.stdout + result.stderr).trim();
}

function main() {
  const base = baseSha();
  const changes = changedFiles(base);
  const addedOrModified = changes.filter((change) => change.code !== "D");
  const errors = [];

  for (const change of addedOrModified) {
    const reason = forbiddenReason(change.path);
    if (reason) errors.push(`${change.path}: ${reason} tidak boleh masuk PR`);
  }

  errors.push(...migrationPolicyErrors(changes));
  errors.push(...generatedRouteErrors(changes));
  errors.push(...packageIdentityErrors(readJson("package.json"), readJson("package-lock.json")));

  for (const change of addedOrModified) {
    if (!existsSync(change.path)) continue;
    if (shouldScanBranding(change.path)) {
      const content = readFileSync(change.path, "utf8");
      if (hasLegacyBranding(content)) {
        errors.push(`${change.path}: legacy branding is not allowed`);
      }
    }
    if (CODE_PATH.test(change.path)) {
      const content = readFileSync(change.path, "utf8");
      if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(content)) {
        errors.push(`${change.path}: eval/new Function tidak diizinkan pada source CBT-MAN`);
      }
    }
  }

  const whitespace = diffCheck(base);
  if (whitespace) errors.push(`git diff --check gagal:\n${whitespace}`);

  if (errors.length > 0) {
    console.error("❌ Pemeriksaan hygiene PR gagal:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`✅ Hygiene PR bersih (${changes.length} file dibanding base ${base.slice(0, 12)}).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
