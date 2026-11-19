import { test } from "node:test";
import { strict as assert } from "node:assert";
import { compare, scan } from "../../scripts/check-ui-tokens.mjs";

const hits = (source) => scan(source).byRule;

test("flags raw palette colours, including variants and opacity", () => {
  assert.equal(hits('<div className="text-slate-500 dark:text-slate-400 hover:bg-emerald-50/50" />')["palette-colour"], 3);
  assert.equal(hits('<div className="border-t-slate-200 ring-violet-500" />')["palette-colour"], 2);
});

test("accepts token utilities", () => {
  const ok = '<div className="bg-card text-foreground text-muted-foreground border-border bg-primary/10 text-warn text-destructive" />';
  assert.equal(scan(ok).total, 0);
});

test("flags hex colours in classes but not in other attributes", () => {
  assert.equal(hits('<div className="bg-[#03A559] hover:text-[#fff]" />')["hex-colour"], 2);
  assert.equal(scan('<path fill="#03A559" />').total, 0);
});

test("flags text under 13px", () => {
  assert.equal(hits('<p className="text-xs text-[11px] md:text-[10px]" />')["small-text"], 3);
  assert.equal(scan('<p className="text-sm text-[13px] text-label text-[14px]" />').total, 0);
});

test("flags uppercase and wide tracking but allows tight", () => {
  assert.equal(hits('<p className="uppercase tracking-widest tracking-wider" />')["uppercase"], 1);
  assert.equal(hits('<p className="uppercase tracking-widest tracking-wider" />')["wide-tracking"], 2);
  assert.equal(scan('<h1 className="tracking-tight normal-case" />').total, 0);
});

test("flags gradients, glass, heavy weights, italics, shadows, big radii and decorative motion", () => {
  const found = hits(
    '<div className="bg-gradient-to-br backdrop-blur-xl font-extrabold italic shadow-lg rounded-3xl animate-pulse hover:scale-105 fade-in slide-in-from-bottom-8" />',
  );
  for (const id of ["gradient", "glass", "heavy-weight", "italic", "shadow", "big-radius", "decorative-motion"]) {
    assert.ok(found[id] >= 1, `${id} not flagged`);
  }
  assert.equal(found["decorative-motion"], 4);
});

test("leaves overlay shadow, spinners, transitions and normal radii alone", () => {
  const ok = '<div className="shadow-overlay animate-spin transition-colors rounded-lg rounded-md font-semibold font-medium" />';
  assert.equal(scan(ok).total, 0);
});

test("compare fails when a file exceeds its baseline and passes when it improves", () => {
  const current = { "src/a.tsx": { total: 3, byRule: { shadow: 3 } }, "src/b.tsx": { total: 1, byRule: { shadow: 1 } } };
  const { failures, improved } = compare(current, { "src/a.tsx": 2, "src/b.tsx": 4, "src/c.tsx": 5 });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /src\/a\.tsx: 3 violations, baseline 2/);
  assert.equal(improved.length, 2);
});

test("a new file with violations fails against an empty baseline", () => {
  const { failures } = compare({ "src/new.tsx": { total: 1, byRule: { italic: 1 } } }, {});
  assert.equal(failures.length, 1);
});

test("flags hex colours on directional borders", () => {
  assert.equal(hits('<div className="border-t-[#fff] border-x-[#03A559] divide-[#000]" />')["hex-colour"], 3);
});

test("flags rem font sizes under 13px but not 13px and up", () => {
  assert.equal(hits('<p className="text-[0.75rem] text-[.5rem] text-[0.8rem] text-[0.8124rem]" />')["small-text"], 4);
  assert.equal(scan('<p className="text-[0.8125rem] text-[0.875rem] text-[1rem]" />').total, 0);
});

test("the editor italic command is not an italic class", () => {
  assert.equal(scan('c: () => exec("italic"), d: document.execCommand(\'italic\')').total, 0);
  assert.equal(hits('<em className="italic" />')["italic"], 1);
});
