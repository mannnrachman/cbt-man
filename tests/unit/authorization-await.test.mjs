import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("question mutation awaits the topic authorization result", () => {
  const server = readFileSync(
    new URL("../../src/lib/server/modul/functions.ts", import.meta.url),
    "utf8",
  );

  assert.match(server, /if \(!\(await operatorCanTouchTopikId\(caller, item\.topikId\)\)\)/);
  assert.match(server, /console\.error\("\[mutateSoalServer\]", err\)/);
  assert.match(server, /error: "Gagal menyimpan soal"/);
  assert.match(server, /console\.error\("\[mutateModulServer\]", err\)/);
  assert.match(server, /error: "Gagal menyimpan modul"/);
});

test("exam upsert authorizes both stored exam and requested topicSets", () => {
  const server = readFileSync(
    new URL("../../src/lib/server/ujian/functions.ts", import.meta.url),
    "utf8",
  );

  const upsertStart = server.indexOf('action === "remove" || action === "publish"');
  assert.ok(upsertStart >= 0);
  const upsertAuth = server.slice(upsertStart, server.indexOf("audit(caller, \"ujian\"", upsertStart));

  assert.match(upsertAuth, /if \(existing && !\(await operatorCanTouchUjian\(caller, item\.id\)\)\)/);
  assert.match(upsertAuth, /if \(!\(await operatorCanTouchTopicSets\(caller, item\.topicSets\)\)\)/);
  assert.match(
    upsertAuth,
    /if \(item\.mataKuliahId && mkIds\.length > 0 && !mkIds\.includes\(item\.mataKuliahId\)\)/,
  );
  assert.doesNotMatch(
    upsertAuth,
    /existing\s*\?\s*!\(await operatorCanTouchUjian[\s\S]*:\s*!\(await operatorCanTouchTopicSets/,
  );
});
