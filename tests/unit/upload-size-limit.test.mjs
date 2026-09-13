import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(rel) {
  return readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
}

test("uploadStoredFile compares decoded buffer size to the documented max", () => {
  const src = read("src/lib/server/files/functions.ts");
  assert.match(src, /const MAX_STORED_FILE_BYTES = 10 \* 1024 \* 1024/);

  const uploadFn = src.slice(
    src.indexOf("export const uploadStoredFile"),
    src.indexOf("export const deleteStoredFile"),
  );
  assert.match(uploadFn, /requireFileManagerAccess/);
  assert.match(uploadFn, /Buffer\.from\(data\.dataBase64,\s*"base64"\)/);
  assert.match(uploadFn, /buffer\.byteLength\s*>\s*MAX_STORED_FILE_BYTES/);
  assert.ok(
    uploadFn.indexOf("Buffer.from") < uploadFn.indexOf("buffer.byteLength"),
    "size check must run after base64 decode",
  );
  assert.ok(
    uploadFn.indexOf("buffer.byteLength") < uploadFn.indexOf("await writeFile"),
    "size check must run before writeFile",
  );
});
