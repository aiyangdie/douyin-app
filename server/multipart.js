/**
 * Minimal `multipart/form-data` parser.
 *
 * Node ships no multipart parser and we are deliberately dependency-free, so
 * this implements just enough of RFC 7578 for our own clients: text fields and
 * a handful of file parts, fully buffered in memory.
 *
 * It is NOT a general-purpose parser — it assumes the boundary never appears
 * inside a part's payload (true for every real-world video container, and the
 * upload endpoint caps the body size anyway).
 */

/** @returns {{ fields: Record<string,string>, files: Array<{field:string,filename:string,contentType:string,data:Buffer}> }} */
export function parseMultipart(buffer, boundary) {
  const fields = {};
  const files = [];
  if (!boundary) return { fields, files };

  const delimiter = Buffer.from(`--${boundary}`);
  let cursor = buffer.indexOf(delimiter);
  if (cursor === -1) return { fields, files };

  while (cursor !== -1) {
    let partStart = cursor + delimiter.length;

    // `--` right after the delimiter marks the final boundary.
    if (buffer[partStart] === 0x2d && buffer[partStart + 1] === 0x2d) break;

    // Skip the CRLF that terminates the delimiter line.
    if (buffer[partStart] === 0x0d && buffer[partStart + 1] === 0x0a) partStart += 2;

    const next = buffer.indexOf(delimiter, partStart);
    if (next === -1) break;

    let partEnd = next;
    // The CRLF immediately before the next delimiter belongs to the framing.
    if (buffer[partEnd - 2] === 0x0d && buffer[partEnd - 1] === 0x0a) partEnd -= 2;

    const part = buffer.subarray(partStart, partEnd);
    const headerBreak = part.indexOf('\r\n\r\n');
    if (headerBreak !== -1) {
      const headers = part.subarray(0, headerBreak).toString('utf8');
      const body = part.subarray(headerBreak + 4);

      const name = /name="([^"]*)"/i.exec(headers)?.[1];
      const filename = /filename="([^"]*)"/i.exec(headers)?.[1];
      const contentType = /content-type:\s*([^\r\n;]+)/i.exec(headers)?.[1]?.trim();

      if (filename !== undefined) {
        files.push({
          field: name ?? 'file',
          filename,
          contentType: contentType ?? 'application/octet-stream',
          data: Buffer.from(body),
        });
      } else if (name !== undefined) {
        fields[name] = body.toString('utf8');
      }
    }

    cursor = next;
  }

  return { fields, files };
}

/** Extracts the boundary from a `Content-Type: multipart/form-data; boundary=...` header. */
export function boundaryFrom(contentTypeHeader) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentTypeHeader ?? '');
  return (match?.[1] ?? match?.[2] ?? '').trim() || null;
}
