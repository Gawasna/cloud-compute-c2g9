/** Escapes one CSV cell: always quoted, quotes doubled, spreadsheet-formula prefixes neutralised. 
 * chuyển dữ liệu dạng bảng thành file CSV, đồng thời xử lý các vấn đề bảo mật và tương thích khi mở bằng Excel.
*/
export function escapeCsvCell(input: unknown): string {
  const plain = String(input ?? "");
  // Neutralise CSV/formula injection (=, +, -, @, and also TAB/CR which some spreadsheets treat as triggers).
  const safe = /^[\s\u0000-\u001f]*[=+@\-]/.test(plain) || /^[\t\r]/.test(plain) ? `'${plain}` : plain;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Encodes a table as UTF-8 CSV with BOM (so Excel shows Vietnamese correctly). */
export function encodeCsv(columns: string[], rows: unknown[][]): string {
  const header = columns.map(escapeCsvCell).join(",");
  const body = rows.map((r) => r.map(escapeCsvCell).join(",")).join("\r\n");
  return "\ufeff" + header + (body ? "\r\n" + body : "");
}
