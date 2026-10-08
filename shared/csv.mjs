// RFC-style CSV quoting, including embedded commas, quotes and newlines.
export function parseCsv(content) {
  const rows = [],
    row = [];
  let cell = "",
    quoted = false,
    closed = false;
  const source = content.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === "," || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && source[i + 1] === "\n") i++;
        if (row.some((v) => v.trim())) rows.push([...row]);
        row.length = 0;
      }
    } else {
      if (closed && !/\s/.test(c)) throw new Error("Malformed CSV");
      if (!closed) cell += c;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
