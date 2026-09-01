import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as XLSX from "xlsx";

test("patched SheetJS preserves Excel import and export", () => {
  assert.equal(XLSX.version, "0.20.3");

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([["nama", "nilai"], ["Ayu", 90]]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Data");

  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const parsed = XLSX.read(bytes);
  assert.deepEqual(XLSX.utils.sheet_to_json(parsed.Sheets.Data), [{ nama: "Ayu", nilai: 90 }]);
});
