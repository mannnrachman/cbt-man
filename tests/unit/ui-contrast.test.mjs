import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");

/** Reads `--name: #rrggbb;` declarations from the first block that opens with `selector {`. */
function readTokens(selector) {
  const open = css.indexOf(`\n${selector} {`);
  assert.notEqual(open, -1, `${selector} block not found in styles.css`);
  const close = css.indexOf("\n}", open);
  const block = css.slice(open, close);
  const tokens = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[m[1]] = m[2];
  return tokens;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// [foreground token, background token, minimum ratio, what it covers]
const pairs = [
  ["ink", "ground", 7, "body text on the page"],
  ["ink", "surface", 7, "body text on cards"],
  ["ink", "surface-2", 7, "body text on table heads and hover rows"],
  ["ink-muted", "ground", 4.5, "secondary text on the page"],
  ["ink-muted", "surface", 4.5, "secondary text on cards"],
  ["ink-muted", "surface-2", 4.5, "secondary text on table heads"],
  ["action-ink", "action", 4.5, "primary button label"],
  ["action", "ground", 4.5, "links on the page"],
  ["action", "surface", 4.5, "links on cards"],
  ["action", "surface-2", 4.5, "links on hover rows"],
  ["danger-ink", "danger", 4.5, "destructive button label"],
  ["danger", "ground", 4.5, "error text on the page"],
  ["danger", "surface-2", 4.5, "error text on hover rows"],
  ["warn", "ground", 4.5, "warning text on the page"],
  ["warn", "surface", 4.5, "warning text on cards"],
  ["warn", "surface-2", 4.5, "warning text on hover rows"],
];

for (const [scheme, selector] of [
  ["light", ":root"],
  ["dark", ".dark"],
]) {
  const tokens = readTokens(selector);
  for (const [fg, bg, min, label] of pairs) {
    test(`${scheme}: ${label} (${fg} on ${bg}) is at least ${min}:1`, () => {
      assert.ok(tokens[fg], `--${fg} is not a hex token in ${selector}`);
      assert.ok(tokens[bg], `--${bg} is not a hex token in ${selector}`);
      const ratio = contrast(tokens[fg], tokens[bg]);
      assert.ok(ratio >= min, `${tokens[fg]} on ${tokens[bg]} is ${ratio.toFixed(2)}:1, needs ${min}:1`);
    });
  }
}

/** The shared block that maps shadcn names onto the semantic palette. */
function sharedMapping() {
  const open = css.indexOf("\n:root,\n.dark {");
  assert.notEqual(open, -1, "shared :root, .dark mapping block not found in styles.css");
  return css.slice(open, css.indexOf("\n}", open));
}

test("the brand green is never the text or button colour", () => {
  const light = readTokens(":root");
  // 3.08:1 on the page ground: fine for a logo or chart mark, not for text.
  assert.ok(contrast(light.brand, light.ground) < 4.5);
  assert.notEqual(light.action.toLowerCase(), light.brand.toLowerCase());
  assert.ok(/--primary:\s*var\(--action\)/.test(sharedMapping()), "--primary must map to --action");
});

test("--accent is a neutral fill, not a hue", () => {
  const block = sharedMapping();
  assert.ok(/--accent:\s*var\(--surface-2\)/.test(block), "--accent must map to --surface-2");
  assert.ok(/--accent-foreground:\s*var\(--ink\)/.test(block), "--accent-foreground must map to --ink");
});

test("chart colours come from the palette, so none can be violet", () => {
  const block = sharedMapping();
  const charts = [...block.matchAll(/--chart-\d:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.equal(charts.length, 5);
  for (const value of charts) assert.ok(/^var\(--[a-z-]+\)$/.test(value), `--chart value "${value}" is not a palette token`);
});
