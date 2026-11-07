/** Escapes LIKE/ILIKE wildcards so user input is matched literally (use with `escape '\'`, the PostgreSQL default). 
 * xử lý và chuẩn hóa từ khóa tìm kiếm do người dùng nhập vào trước khi đưa vào câu truy vấn SQL PostgreSQL sử dụng LIKE/ILIKE.
*/
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Normalises a free-text search term: trims, caps length, escapes wildcards. */
export function toSearchPattern(raw: string | null | undefined, maxLength = 100): string {
  const term = String(raw ?? "").trim().slice(0, maxLength);
  return `%${escapeLike(term)}%`;
}
