import assert from "node:assert/strict";
import { test } from "node:test";

// The theme store must keep memory and DOM state in sync even when
// localStorage rejects writes (quota exhausted, privacy mode). Before the
// failure-tolerant storage adapter, the persist-wrapped setters threw after
// the in-memory update, so the subsequent apply() DOM update never ran.

function storageThatThrowsOnWrite() {
  const saved = new Map();
  return {
    getItem: (name) => saved.get(name) ?? null,
    setItem: (name, value) => {
      throw new Error("QuotaExceededError");
    },
    removeItem: (name) => saved.delete(name),
  };
}

function storageThatRecordsWrites() {
  const saved = new Map();
  return {
    getItem: (name) => saved.get(name) ?? null,
    setItem: (name, value) => saved.set(name, value),
    removeItem: (name) => saved.delete(name),
  };
}

async function withLocalStorage(impl, run) {
  const previous = globalThis.localStorage;
  globalThis.localStorage = impl;
  try {
    await run();
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
}

/** Minimal documentElement that records the data-* attributes apply() writes. */
async function withDocumentElement(run) {
  const attributes = new Map();
  const root = {
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
  };
  const previous = globalThis.document;
  globalThis.document = { documentElement: root };
  try {
    await run(attributes);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

test("appearance setters survive localStorage write failures", async () => {
  await withLocalStorage(storageThatThrowsOnWrite(), async () => {
    const { useThemeStore } = await import("../../src/lib/cbt/theme-store.ts");
    const state = useThemeStore.getState();
    await withDocumentElement(async (attributes) => {
      assert.doesNotThrow(() => state.setFont("serif"));
      assert.equal(attributes.get("data-font"), "serif");
      assert.doesNotThrow(() => state.setFontSize("besar"));
      assert.equal(attributes.get("data-font-size"), "besar");
      assert.doesNotThrow(() => state.setAccent("hijau"));
      assert.equal(attributes.get("data-accent"), "hijau");
    });
    const after = useThemeStore.getState();
    assert.equal(after.font, "serif");
    assert.equal(after.fontSize, "besar");
    assert.equal(after.accent, "hijau");
  });
});

test("appearance choices still persist when storage writes succeed", async () => {
  await withLocalStorage(storageThatRecordsWrites(), async () => {
    const { useThemeStore, STORAGE_KEY } = await import("../../src/lib/cbt/theme-store.ts");
    useThemeStore.getState().setFontSize("sangat-besar");
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    assert.ok(raw, "persisted payload must be written on successful setItem");
    const payload = JSON.parse(raw);
    assert.equal(payload.state.fontSize, "sangat-besar");
  });
});
