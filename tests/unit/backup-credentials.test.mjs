import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import test from "node:test";
import { z } from "zod";
import { createServerFn, database, load, runtime } from "../helpers/security-runtime.mjs";

test("privileged backup preserves current credentials and rejects unsafe restores", async () => {
  const db = database();
  let caller = "admin";
  const r = runtime(db.prisma, () => caller);
  const hashing = load("src/lib/cbt/hash.ts");
  const hash = await hashing.hashPassword("original-password");
  await db.prisma.unitAkademik.create({ data: { id: "unit", nama: "Unit", tipe: "prodi" } });
  for (const [id, role] of [["admin", "super_admin"], ["operator", "admin_prodi"], ["evaluator", "evaluator"], ["student", "mahasiswa"]]) {
    await db.prisma.user.create({ data: { id, username: id, namaLengkap: id, role, passwordHash: hash, unitId: "unit", createdAt: 1n } });
  }
  const salt = Buffer.alloc(16, 1);
  const legacyHash = `pbkdf2$10000$${salt.toString("base64")}$${pbkdf2Sync("legacy-password", salt, 10000, 32, "sha256").toString("base64")}`;
  await db.prisma.user.create({ data: { id: "legacy", username: "legacy", namaLengkap: "Legacy", role: "mahasiswa", passwordHash: legacyHash, unitId: "unit", createdAt: 1n } });
  await db.prisma.ujian.create({ data: { id: "exam", nama: "Exam", durasiMenit: 10, createdBy: "admin", createdAt: 1n } });
  await db.prisma.tokenUjian.create({ data: { id: "token", ujianId: "exam", kode: "ABC", dipakaiOleh: "student", dipakaiAt: 2n } });
  await db.prisma.tokenClaim.create({ data: { id: "claim", ujianId: "exam", pesertaId: "student", kode: "ABC", claimedAt: 2n } });
  const snapshot = load("src/lib/server/repos/snapshot.ts", {
    "@/lib/server/db/prisma": { prisma: db.prisma }, "@/lib/server/db/json": r.json,
    "@/lib/cbt/session-answers": load("src/lib/cbt/session-answers.ts", {
      "./state-machines.ts": load("src/lib/cbt/state-machines.ts", {
        "./availability.ts": load("src/lib/cbt/availability.ts"),
      }),
    }), "@/lib/cbt/ujian-scope": r.scope, "./mappers": r.mappers,
  });
  const files = [{ id: "file", name: "test", mime: "text/plain", size: 1, createdAt: 1, extension: "txt", dataBase64: "YQ==" }];
  const server = load("src/lib/server/backup/functions.ts", {
    "@tanstack/react-start": { createServerFn }, "../db/prisma": { prisma: db.prisma },
    "../db/auth": r.auth, "../db/audit": r.audit, "../db/json": r.json,
    "../repos/snapshot": snapshot, "../repos/mappers": r.mappers,
    "@/lib/cbt/types": r.types,
    "../files/functions": { fileBackupSchema: z.any(), exportFilesServer: async () => files },
  });
  try {
    const rows = await snapshot.loadSnapshotRows();
    const stale = snapshot.adminSnapshot(rows);
    for (const user of rows.users) {
      const publicSnapshot = await snapshot.buildSnapshotForUser(user);
      assert.equal(publicSnapshot.users.every(item => item.passwordHash === ""), true);
    }
    assert.equal(stale.users[0].passwordHash, "");
    const newHash = await hashing.hashPassword("current-password");
    await db.prisma.user.update({ where: { id: "admin" }, data: { passwordHash: newHash } });
    assert.equal(typeof server.exportBackupServer, "function", "dedicated privileged backup endpoint is required");
    const client = load("src/lib/cbt/backup.ts", {
      "./repos": { usersRepo: { all: () => stale.users } }, "./types": r.types,
      "@/lib/server/backup/functions": server, "@/lib/server/files/functions": {}, "sonner": {},
    });
    const backup = await client.exportBackup();
    assert.equal(backup.users.find(u => u.id === "admin").passwordHash, newHash);
    assert.deepEqual(backup.files, files);
    assert.equal(backup.tokenClaims[0].claimedAt, 2);
    assert.equal(backup.token[0].dipakaiOleh, "student");
    for (const id of ["operator", "evaluator", "student", "missing-session-user"]) {
      caller = id;
      await assert.rejects(server.exportBackupServer(), /Forbidden/);
      const deniedRestore = await server.importBackupServer({ data: { ...backup, files: undefined } });
      assert.equal(deniedRestore.ok, false);
      assert.equal((await db.prisma.user.findUnique({ where: { id: "admin" } })).passwordHash, newHash);
    }
    caller = "admin";
    for (const bad of ["", "plain-password", "pbkdf2$0$c2FsdA==$aGFzaA==", "pbkdf2$100000$bad$bad",
      newHash.replace("$100000$", "$100001$"), newHash.replace("$100000$", "$4294967295$")]) {
      const result = await server.importBackupServer({ data: { ...backup, files: undefined, users: backup.users.map(u => ({ ...u, passwordHash: bad })) } });
      assert.equal(result.ok, false);
      assert.match(result.error, /kredensial/i);
      assert.equal((await db.prisma.user.findUnique({ where: { id: "admin" } })).passwordHash, newHash);
    }
    const result = await server.importBackupServer({ data: { ...backup, files: undefined } });
    assert.equal(result.ok, true);
    assert.equal((await db.prisma.tokenClaim.findUnique({ where: { id: "claim" } })).claimedAt, 2n);
    assert.equal(await hashing.verifyPassword("current-password", (await db.prisma.user.findUnique({ where: { id: "admin" } })).passwordHash), true);
    assert.equal(await hashing.verifyPassword("legacy-password", (await db.prisma.user.findUnique({ where: { id: "legacy" } })).passwordHash), true);
    for (const id of ["operator", "evaluator", "student"]) {
      assert.equal(await hashing.verifyPassword("original-password", (await db.prisma.user.findUnique({ where: { id } })).passwordHash), true);
    }
  } finally { await db.close(); }
});
