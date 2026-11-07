import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { escapeCsvCell, encodeCsv } from "../../src/lib/utils/csv.ts";
import { escapeLike, toSearchPattern } from "../../src/lib/utils/sql.ts";

describe("Security: CSV export (formula injection)", () => {
  it("neutralises cells that start with formula triggers", () => {
    for (const evil of ["=1+1", "+SUM(A1)", "-2+3", "@cmd", "  =HYPERLINK(\"http://x\")", "\t=1", "\r=1"]) {
      const cell = escapeCsvCell(evil);
      assert.ok(cell.startsWith(`"'`), `must prefix a quote for ${JSON.stringify(evil)}, got ${cell}`);
    }
  });

  it("leaves normal text intact and doubles embedded quotes / keeps commas inside quotes", () => {
    assert.equal(escapeCsvCell("Bút bi, xanh"), '"Bút bi, xanh"');
    assert.equal(escapeCsvCell('Tên "đặc biệt"'), '"Tên ""đặc biệt"""');
    assert.equal(escapeCsvCell(null), '""');
    assert.equal(escapeCsvCell(0), '"0"');
  });

  it("encodes BOM + header + CRLF rows", () => {
    const csv = encodeCsv(["A", "B"], [[1, "x"], [2, "y"]]);
    assert.ok(csv.startsWith("\ufeff"));
    assert.equal(csv.slice(1), '"A","B"\r\n"1","x"\r\n"2","y"');
    assert.equal(encodeCsv(["A"], []).slice(1), '"A"');
  });
});

describe("Security: LIKE wildcard escaping in product search", () => {
  it("escapes %, _ and backslash", () => {
    assert.equal(escapeLike("100%_a\\b"), "100\\%\\_a\\\\b");
  });
  it("builds a bounded, trimmed pattern", () => {
    assert.equal(toSearchPattern("  abc "), "%abc%");
    assert.equal(toSearchPattern(null), "%%");
    assert.equal(toSearchPattern("%"), "%\\%%");
    assert.equal(toSearchPattern("x".repeat(500)).length, 100 + 2);
  });
});
