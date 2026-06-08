import { PrismaClient } from "@prisma/client";
import { webcrypto } from "node:crypto";

import { createSeedDataset, seedDatabase } from "../src/lib/server/db/seed-shared.mjs";

const cryptoApi = globalThis.crypto ?? webcrypto;
const prisma = new PrismaClient();

function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function b64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function hashPassword(password) {
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const key = await cryptoApi.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await cryptoApi.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  return `pbkdf2$100000$${b64(salt)}$${b64(hash)}`;
}

async function main() {
  const dataset = await createSeedDataset({ uid, now: Date.now(), hashPassword });
  await seedDatabase({
    prisma,
    dataset,
    stringifyJson: JSON.stringify,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
