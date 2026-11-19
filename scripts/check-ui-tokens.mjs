// Guards the UI system described in docs/redesign: colours come from tokens, text is at least
// 13px, no gradients/glass/pulses. Violations are counted per file against scripts/ui-baseline.json,
// which may only go down (it is empty now: every file is at zero). A file over its baseline fails.
//
//   npm run check:ui                       check against the baseline
//   npm run check:ui -- --write-baseline   record current counts (use after cleaning a file)
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

export const RULES = [
  {
    id: "palette-colour",
    hint: "use a token (text-foreground, bg-muted, border-border, text-primary, text-destructive, text-warn)",
    re: new RegExp(
      `(?<![\\w-])(?:[a-z0-9-]+:)*(?:bg|text|border(?:-[trblxyse])?|divide|ring|from|via|to|fill|stroke|outline|decoration|accent|caret|shadow)-(?:${PALETTE})-\\d{2,3}(?:\\/\\d+)?`,
      "g",
    ),
  },
  {
    id: "hex-colour",
    hint: "hex colours belong in src/styles.css only",
    re: /(?<![\w-])(?:[a-z0-9-]+:)*(?:bg|text|border(?:-[trblxyse])?|divide|ring|from|via|to|fill|stroke|shadow|outline|decoration|accent|caret)-\[#[0-9a-fA-F]{3,8}\]/g,
  },
  {
    id: "small-text",
    hint: "no text under 13px: use text-label (13) or text-ui (14)",
    // px below 13, or rem below 0.8125 (13px at the 16px root).
    re: /(?<![\w-])(?:[a-z0-9-]+:)*text-(?:xs|\[(?:[0-9]|1[0-2])(?:\.\d+)?px\]|\[0?\.(?:[0-7]\d*|8(?:0\d*|1(?:[01]\d*|2(?:[0-4]\d*)?)?)?)rem\])(?![\w-])/g,
  },
  {
    id: "uppercase",
    hint: "write labels in sentence case",
    re: /(?<![\w-])(?:[a-z0-9-]+:)*uppercase(?![\w-])/g,
  },
  {
    id: "wide-tracking",
    hint: "no tracked capitals",
    re: /(?<![\w-])(?:[a-z0-9-]+:)*tracking-(?:wide|wider|widest)(?![\w-])/g,
  },
  {
    id: "gradient",
    hint: "no gradients",
    re: /(?<![\w-])(?:[a-z0-9-]+:)*bg-(?:gradient|linear|radial|conic)-[\w[\]/.-]+/g,
  },
  {
    id: "glass",
    hint: "no backdrop blur; use bg-card",
    re: /(?<![\w-])(?:[a-z0-9-]+:)*backdrop-blur(?:-[\w[\]]+)?/g,
  },
  {
    id: "heavy-weight",
    hint: "headline weights are 400/500/600",
    re: /(?<![\w-])(?:[a-z0-9-]+:)*font-(?:bold|extrabold|black)(?![\w-])/g,
  },
  {
    id: "italic",
    hint: "italic only for quotations",
    // The editor's exec("italic") command is not a class.
    re: /(?<![\w-]|(?:exec|execCommand)\(\s*["'])(?:[a-z0-9-]+:)*italic(?![\w-])/g,
  },
  {
    id: "shadow",
    hint: "borders, not shadows; shadow-overlay is for floating layers",
    re: /(?<![\w-])(?:[a-z0-9-]+:)*shadow(?:-(?:sm|md|lg|xl|2xl|inner|sleek|popover-sleek|neo|\[[^\]]*\]))?(?![\w-])/g,
  },
  {
    id: "big-radius",
    hint: "radii are 8/12 (rounded-md/lg) and 20 for dialogs",
    re: /(?<![\w-])(?:[a-z0-9-]+:)*rounded(?:-[trblse]{1,2})?-(?:2xl|3xl|4xl|\[(?:1[6-9]|[2-9]\d)px\])(?![\w-])/g,
  },
  {
    id: "decorative-motion",
    hint: "no entrance animations, pulses or scale/translate hovers",
    re: /(?<![\w-])(?:[a-z0-9-]+:)*(?:animate-(?:in|pulse|bounce|ping)|fade-in(?:-\d+)?|slide-in-from-[\w-]+|zoom-in(?:-\d+)?|(?:hover|group-hover|active):-?(?:scale|translate-[xy])-[\w[\]./-]+)(?![\w-])/g,
  },
];

/** Counts violations in one source string. */
export function scan(source) {
  const byRule = {};
  let total = 0;
  for (const rule of RULES) {
    const n = [...source.matchAll(rule.re)].length;
    if (n) {
      byRule[rule.id] = n;
      total += n;
    }
  }
  return { total, byRule };
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

export function scanTree(root) {
  const result = {};
  for (const file of walk(join(root, "src"))) {
    const { total, byRule } = scan(readFileSync(file, "utf8"));
    if (total) result[relative(root, file).replaceAll("\\", "/")] = { total, byRule };
  }
  return result;
}

export function compare(current, baseline) {
  const failures = [];
  const improved = [];
  for (const [file, { total, byRule }] of Object.entries(current)) {
    const allowed = baseline[file] ?? 0;
    if (total > allowed) {
      const detail = Object.entries(byRule)
        .map(([id, n]) => `${id}×${n}`)
        .join(", ");
      failures.push(`${file}: ${total} violations, baseline ${allowed} (${detail})`);
    } else if (total < allowed) improved.push(`${file}: ${total} (baseline ${allowed})`);
  }
  for (const [file, allowed] of Object.entries(baseline)) {
    if (!(file in current) && allowed > 0) improved.push(`${file}: 0 (baseline ${allowed})`);
  }
  return { failures, improved };
}

const BASELINE = "scripts/ui-baseline.json";

function main() {
  const root = process.cwd();
  const current = scanTree(root);
  if (process.argv.includes("--write-baseline")) {
    const flat = Object.fromEntries(
      Object.entries(current)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([f, { total }]) => [f, total]),
    );
    writeFileSync(join(root, BASELINE), `${JSON.stringify(flat, null, 2)}\n`);
    const sum = Object.values(flat).reduce((a, b) => a + b, 0);
    console.log(`Baseline written: ${Object.keys(flat).length} files, ${sum} violations.`);
    return;
  }
  const baseline = existsSync(join(root, BASELINE)) ? JSON.parse(readFileSync(join(root, BASELINE), "utf8")) : {};
  const { failures, improved } = compare(current, baseline);
  if (improved.length) {
    console.log(`Below baseline (run with --write-baseline to lock in):\n  ${improved.join("\n  ")}`);
  }
  if (failures.length) {
    console.error(`UI token check failed:\n  ${failures.join("\n  ")}\n`);
    for (const rule of RULES) console.error(`  ${rule.id}: ${rule.hint}`);
    process.exit(1);
  }
  const total = Object.values(current).reduce((a, { total: t }) => a + t, 0);
  console.log(`✅ UI token check passed (${total} remaining violations, none above baseline).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
