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
