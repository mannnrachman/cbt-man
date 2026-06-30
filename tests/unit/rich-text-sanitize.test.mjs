/**
 * Unit tests for rich-text HTML sanitization (Issue #11).
 *
 * Run with:  node --test tests/unit/rich-text-sanitize.test.mjs
 *            (or)  npm run test:unit
 *
 * Two layers:
 *  (1) Behavioral — exercise the REAL `isomorphic-dompurify` with the same
 *      config as `src/lib/cbt/sanitize.ts` and assert the I/O matrix:
 *      script/onerror/javascript: are removed, valid formatting/img-data/
 *      tables survive.
 *  (2) Structural grep — every `dangerouslySetInnerHTML` in `src/` is either
 *      the allowlisted `chart.tsx` (CSS theme vars, not user HTML) or the
 *      sanitized `RichView`, and `peserta.index.tsx` no longer injects raw.
 *
 * Written as .mjs to match tests/unit/token-codes.test.mjs. The config is
 * mirrored here (not imported) because sanitize.ts is TS with `@/` aliases;
 * a drift guard belongs in a future integration test, but the structural grep
 * below ensures the sinks themselves cannot silently regress.
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { readdirSync, readFileSync as _rf } from "node:fs";
import { resolve, join } from "node:path";
import { test } from "node:test";
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p",
  "br",
  "span",
  "div",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "sub",
  "sup",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "pre",
  "code",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];
const ALLOWED_ATTR = ["href", "src", "alt", "title", "class", "colspan", "rowspan"];

function sanitizeHtml(html) {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["style"],
  });
}

test("strips <script> tags", () => {
  const out = sanitizeHtml("<p>hi<script>alert(1)</script></p>");
  assert.ok(!/script/i.test(out), `script must be removed, got: ${out}`);
  assert.ok(out.includes("hi"));
});

test("strips on* event handlers", () => {
  const out = sanitizeHtml('<img src="x" onerror="alert(1)">');
  assert.ok(!/onerror/i.test(out), `onerror must be removed, got: ${out}`);
});

test("neutralizes javascript: URLs", () => {
  const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
  assert.ok(!/javascript:/i.test(out), `javascript: scheme must be removed, got: ${out}`);
  assert.ok(out.includes("x"));
});

test("preserves valid formatting", () => {
  const out = sanitizeHtml("<strong>bold</strong><ul><li>a</li></ul>");
  assert.ok(out.includes("<strong>"));
  assert.ok(out.includes("<li>"));
});

test("preserves tables", () => {
  const out = sanitizeHtml('<table><tbody><tr><td class="border">c</td></tr></tbody></table>');
  assert.ok(out.includes("<table>"));
  assert.ok(out.includes("<td"));
});

test("preserves data: image URLs (post file:// rewrite)", () => {
  const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
  const out = sanitizeHtml(`<img src="${dataUrl}" alt="x">`);
  assert.ok(out.includes("<img"));
  assert.ok(out.includes("data:image/png"), `data: image must survive, got: ${out}`);
});

test("strips data: URLs on anchors (only img data: is allowed)", () => {
  const out = sanitizeHtml('<a href="data:text/html;base64,PHNjcmlwdD4=">click</a>');
  assert.ok(!/data:text\/html/i.test(out), `data: on <a href> must be stripped, got: ${out}`);
});

test("removes <style> and <iframe>", () => {
  const out = sanitizeHtml('<style>body{}</style><iframe src="x"></iframe><p>ok</p>');
  assert.ok(!/<style|<iframe/i.test(out), `style/iframe must be removed, got: ${out}`);
  assert.ok(out.includes("ok"));
});

test("math delimiters inside an attribute value cannot break out after sanitize", () => {
  // A `$...$` that survives sanitization inside an attribute must NOT be
  // expanded into KaTeX markup that re-opens the tag. We assert sanitize keeps
  // the payload contained; renderMath (in RichView) only transforms text
  // between tags, never attribute contents.
  const out = sanitizeHtml('<img src="data:image/png;base64,AAAA" alt="$a$ onerror=alert(1)">');
  assert.ok(
    !/onerror\s*=/i.test(out.replace(/alt="[^"]*"/, "")),
    `no live onerror attribute, got: ${out}`,
  );
});

// --- Structural: the sink inventory cannot silently regress ---

function read(rel) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

test("peserta dashboard no longer injects raw deskripsi", () => {
  const src = read("src/routes/_authenticated/peserta.index.tsx");
  assert.ok(
    !/dangerouslySetInnerHTML/.test(src),
    "peserta.index.tsx must render via RichView, not raw dangerouslySetInnerHTML",
  );
  assert.ok(/RichView/.test(src), "peserta.index.tsx must use RichView");
});

test("RichView sanitizes before rendering", () => {
  const src = read("src/components/cbt/RichEditor.tsx");
  assert.ok(/sanitizeHtml/.test(src), "RichEditor must call sanitizeHtml");
  // sanitize must run before renderMath in the RichView memo.
  const sanitizeIdx = src.indexOf("sanitizeHtml(h)");
  const renderMathIdx = src.indexOf("renderMath(h)");
  assert.ok(sanitizeIdx > 0 && renderMathIdx > 0, "both calls must be present");
  assert.ok(sanitizeIdx < renderMathIdx, "sanitizeHtml must run before renderMath");
});

test("every src dangerouslySetInnerHTML is an allowlisted sink", () => {
  // Recursively walk src/ so a sink added in ANY new file is caught.
  const allowed = new Set(["src/components/ui/chart.tsx", "src/components/cbt/RichEditor.tsx"]);
  const root = resolve(process.cwd(), "src");
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        // Match the actual JSX prop (`dangerouslySetInnerHTML={`), not the
        // word appearing in comments/strings.
        if (/dangerouslySetInnerHTML\s*=\s*\{/.test(_rf(abs, "utf8"))) {
          const rel = abs.slice(process.cwd().length + 1);
          if (!allowed.has(rel)) offenders.push(rel);
        }
      }
    }
  };
  walk(root);
  assert.deepEqual(
    offenders,
    [],
    `unexpected dangerouslySetInnerHTML sinks: ${offenders.join(", ")}`,
  );
});
