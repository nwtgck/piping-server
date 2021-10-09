export function escapeHtmlAttribute(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// NOTE: key is lowercase
export function parseHeaders(rawHeaders: readonly string[]): Map<string, string[]> {
  const h = new Map<string, string[]>();
  for (let i = 1; i < rawHeaders.length; i += 2) {
    const key = rawHeaders[i-1].toLowerCase();
    const value = rawHeaders[i];
    const values = h.get(key);
    if (values === undefined) {
      h.set(key, [value]);
    } else {
      values.push(value);
    }
  }
  return h;
}
