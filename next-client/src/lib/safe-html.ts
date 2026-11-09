// Helpers for putting text into HTML that is written as a string (dangerouslySetInnerHTML).

/** Makes text safe for HTML text or a quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * JSON for a <script type="application/ld+json"> block. A "<" inside a string (for example "</script>" in a post title)
 * would end the script block, so < > & and the two line separator characters are written as \u escapes.
 * The result is still valid JSON with the same meaning.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
}

/** Gives every <img> that has no alt attribute the given alt text (escaped). */
export function addMissingImageAlt(html: string, altText: string): string {
  const safeAlt = escapeHtml(altText);
  return html.replace(/<img(?![^>]*\balt=)([^>]*)(\/?>)/gi, (_whole, attributes: string, end: string) => `<img alt="${safeAlt}"${attributes}${end}`);
}
