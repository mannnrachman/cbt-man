import { test } from "node:test";
import { strict as assert } from "node:assert";
import { cn } from "../../src/lib/utils.ts";

test("type-scale sizes do not erase a text colour", () => {
  assert.equal(cn("text-ui text-primary-foreground", "text-body"), "text-primary-foreground text-body");
  assert.equal(cn("bg-primary text-primary-foreground", "text-label"), "bg-primary text-primary-foreground text-label");
});

test("a later size still replaces an earlier size, and a later colour replaces a colour", () => {
  assert.equal(cn("text-ui", "text-body"), "text-body");
  assert.equal(cn("text-foreground", "text-muted-foreground"), "text-muted-foreground");
});
